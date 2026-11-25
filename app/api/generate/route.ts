// CIC generate route v12.6.0 - lean prompt, 80-220 chars, no rewrite call, Llama first
import { NextResponse } from 'next/server'

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
  }
}

export const maxDuration = 60

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: cors() })
}

export async function GET() {
  const groqKey = process.env.GROQ_API_KEY
  const orKey = process.env.OPENROUTER_API_KEY
  return new Response(JSON.stringify({
    status: 'ok',
    groq: !!groqKey,
    openrouter: !!orKey,
    version: 'v12.6.0'
  }), { headers: { 'Content-Type': 'application/json', ...cors() } })
}

type GenResult = { text: string; model: string }

// ═══ SPEED LAYER ═══════════════════════════════════════════════════════════════
// Staggered race: the first model starts at once. If it has not answered after `staggerMs`, the next
// model starts in parallel (and starts immediately if the first one fails). The first valid answer
// wins and the rest are cancelled. A slow or rate-limited model no longer holds up the whole reply.
// Strips reasoning blocks some models leak into their output.
function cleanLLM(t: string): string {
  return (t || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/\[THINKING\][\s\S]*?\[\/THINKING\]/gi, '')
    .replace(/\[REASONING\][\s\S]*?\[\/REASONING\]/gi, '')
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
    .trim()
}

// A model that answers with a refusal, an empty set or cut-off JSON has not answered. Treating that as a
// failure lets the next model start at once, instead of the operator getting an error.
function requireReadable(text: string): string {
  const got = parseReplies(cleanLLM(text)).filter(r => (r.text || '').length >= 40)
  if (!got.length) throw new Error('unreadable output')
  return text
}

type RaceTask = { label: string; run: (signal: AbortSignal) => Promise<string>; staggerMs?: number }

function raceStaggered(tasks: RaceTask[], staggerMs: number, capMs: number, errors: string[]): Promise<GenResult | null> {
  if (!tasks.length) return Promise.resolve(null)
  return new Promise<GenResult | null>((resolve) => {
    const ctrls: AbortController[] = []
    let started = 0
    let finished = 0
    let done = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const finish = (r: GenResult | null) => {
      if (done) return
      done = true
      if (timer) clearTimeout(timer)
      ctrls.forEach(c => { try { c.abort() } catch { /* already finished */ } })
      resolve(r)
    }
    const failed = () => {
      finished++
      if (done) return
      if (finished >= tasks.length) finish(null)
      else launchNext()
    }
    const launchNext = () => {
      if (done || started >= tasks.length) return
      const t = tasks[started++]
      const ctrl = new AbortController()
      ctrls.push(ctrl)
      const to = setTimeout(() => ctrl.abort(), capMs)
      t.run(ctrl.signal).then((text) => {
        clearTimeout(to)
        if (text) finish({ text, model: t.label })
        else { if (!done) errors.push(t.label + ': empty'); failed() }
      }).catch((e: any) => {
        clearTimeout(to)
        if (!done) errors.push(t.label + ': ' + String(e?.message || e).substring(0, 80))
        failed()
      })
      if (timer) clearTimeout(timer)
      if (started < tasks.length) timer = setTimeout(launchNext, t.staggerMs ?? staggerMs)
    }
    launchNext()
  })
}

async function callAnthropic(model: string, key: string, prompt: string, signal: AbortSignal): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model, max_tokens: 900, temperature: 0.9, messages: [{ role: 'user', content: prompt }] }),
    signal,
  })
  const data: any = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(data?.error || 'error').substring(0, 80)}`)
  return (data?.content?.[0]?.text || '').toString()
}

// Groq through its OpenAI-compatible API, so reasoning effort and JSON mode can be set directly.
// gpt-oss models think before they answer; on "low" that costs a fraction of a second instead of
// several seconds, and the replies are short and creative, so deep reasoning adds nothing here.
async function callGroq(model: string, key: string, prompt: string, signal: AbortSignal, effort: string = 'medium'): Promise<string> {
  const isOss = model.startsWith('openai/gpt-oss')
  const base: Record<string, unknown> = {
    model,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.9,
    max_completion_tokens: isOss ? 4000 : 1200,
  }
  const rich = { ...base, response_format: { type: 'json_object' }, ...(isOss ? { reasoning_effort: effort, include_reasoning: false } : {}) }
  const post = (body: Record<string, unknown>) => fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
    signal,
  })
  let res = await post(rich)
  // A model that does not accept one of the optional settings is retried once with plain settings.
  if (res.status === 400) res = await post(base)
  const data: any = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err: any = new Error(`${res.status} ${String(data?.error?.message || 'error').substring(0, 80)}`)
    throw err
  }
  return (data?.choices?.[0]?.message?.content || '').toString()
}

// Provider chain. Optional Anthropic first (non-sexual messages only, needs ANTHROPIC_API_KEY),
// then Groq (model order depends on message type), OpenRouter, Gemini.
async function generate(
  prompt: string,
  opts: { sexual?: boolean; avoid?: string[]; deadline?: number; fast?: boolean } = {}
): Promise<GenResult> {
  const errors: string[] = []
  const t0 = Date.now()
  // Every attempt shares one deadline so the whole request stays under Vercel's time limit.
  const left = () => (opts.deadline ?? Infinity) - Date.now()
  const cap = (ms: number) => Math.max(1500, Math.min(ms, left() - 1000))
  const hasTime = (need = 4000) => left() > need
  const avoid = new Set(opts.avoid || [])
  const groqKey = process.env.GROQ_API_KEY
  const openrouterKey = process.env.OPENROUTER_API_KEY
  const googleKey = process.env.GOOGLE_AI_API_KEY
  const anthropicKey = process.env.ANTHROPIC_API_KEY
  const stripThink = (t: string) => t.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()

  // ── Claude + Groq, staggered race ────────────────────────────────────────
  // Claude writes the most natural replies, so for non-sexual chats it goes first. A Groq model starts
  // in parallel if Claude has not answered after 6 seconds, so a slow Claude never stalls the operator.
  // Set CIC_CLAUDE_BACKUP=1 to flip it (Groq first, Claude as backup) when speed matters more.
  const tasks: RaceTask[] = []
  const claudeModel = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5'
  const useClaude = !opts.fast && !!anthropicKey && !opts.sexual && !avoid.has('anthropic') && hasTime(12000)
  const claudeFirst = process.env.CIC_CLAUDE_BACKUP !== '1'
  const claudeTask: RaceTask = {
    label: 'anthropic/' + claudeModel,
    staggerMs: 6000,
    run: (signal: AbortSignal) => callAnthropic(claudeModel, anthropicKey || '', prompt, signal).then(stripThink).then(requireReadable),
  }
  if (useClaude && claudeFirst) tasks.push(claudeTask)
  if (groqKey && !avoid.has('groq')) {
    // Llama 3.3 70B writes the most natural, flirty replies, so it goes first. gpt-oss is the most
    // safety-tuned and tends to drop explicit words, so it is only a backup.
    const groqModels = opts.fast
      ? ['llama-3.3-70b-versatile']
      : opts.sexual
      ? [
          'llama-3.3-70b-versatile',
          'openai/gpt-oss-120b',
        ]
      : [
          'llama-3.3-70b-versatile',
          'openai/gpt-oss-120b',
          'openai/gpt-oss-20b',
        ]
    // With Claude in the race, Groq is the quick backup (low reasoning). On its own it thinks a bit more.
    const effort = opts.fast ? 'low' : (process.env.GROQ_REASONING || (useClaude && claudeFirst ? 'low' : 'medium'))
    for (const m of groqModels) {
      tasks.push({
        label: 'groq/' + m,
        run: (signal: AbortSignal) => callGroq(m, groqKey || '', prompt, signal, effort).then(stripThink).then(requireReadable),
      })
    }
  }
  if (useClaude && !claudeFirst) tasks.push(claudeTask)
  if (tasks.length && hasTime()) {
    const won = await raceStaggered(tasks, 9000, cap(18000), errors)
    if (won) { console.log('[CIC] Won by', won.model, Date.now() - t0, 'ms'); return won }
  }

  // ── OpenRouter fallback ───────────────────────────────────────────────────
  if (openrouterKey && !avoid.has('openrouter') && hasTime(5000)) {
    const orModels = [
      'google/gemma-3-27b-it',
      'mistralai/mistral-small-3.2-24b-instruct',
      'microsoft/phi-4-reasoning-plus:free',
    ]
    for (const orModel of orModels) {
      if (!hasTime()) { errors.push('OpenRouter: out of time'); break }
      try {
        const orController = new AbortController()
        const orTimeout = setTimeout(() => orController.abort(), cap(12000))
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openrouterKey}`,
            'HTTP-Referer': 'https://cic-backend-v2-princes-projects-5a5b6cec.vercel.app',
          },
          body: JSON.stringify({
            model: orModel,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.9,
            max_tokens: 1000,
            // Disable thinking mode for models that support it (Qwen, DeepSeek)
            chat_template_kwargs: { thinking: false },
          }),
          signal: orController.signal,
        })
        clearTimeout(orTimeout)
        const data = await res.json()
        const text = data?.choices?.[0]?.message?.content
        if (text) {
          const cleanText = stripThink(text)
          if (cleanText) { console.log('[CIC] OpenRouter:', orModel, Date.now() - t0, 'ms'); return { text: cleanText, model: 'openrouter/' + orModel } }
        }
        const errCode = data?.error?.code || data?.error?.status || 0
        errors.push(`OpenRouter/${orModel}: ${JSON.stringify(data?.error || 'empty').substring(0, 60)}`)
        if (errCode !== 429 && errCode !== 503) break
      } catch (e: any) {
        errors.push(`OpenRouter/${orModel}: ${e?.message?.substring(0, 60)}`)
      }
    }
  }

  // ── Google Gemini fallback ────────────────────────────────────────────────
  // gemini-1.5 models are retired. Check Google AI Studio for the current model names.
  if (googleKey && !avoid.has('gemini') && hasTime(5000)) {
    for (const geminiModel of ['gemini-2.5-flash', 'gemini-2.5-pro']) {
      if (!hasTime()) { errors.push('Gemini: out of time'); break }
      try {
        const gemCtrl = new AbortController()
        const gemTimeout = setTimeout(() => gemCtrl.abort(), cap(12000))
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${googleKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.9, maxOutputTokens: 1000 }
          }),
          signal: gemCtrl.signal,
        })
        clearTimeout(gemTimeout)
        const data = await res.json()
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
        if (text) { console.log('[CIC] Gemini:', geminiModel, Date.now() - t0, 'ms'); return { text: stripThink(text), model: 'gemini/' + geminiModel } }
        errors.push(`Gemini/${geminiModel}: ${JSON.stringify(data?.error || 'empty').substring(0, 60)}`)
      } catch (e: any) {
        errors.push(`Gemini/${geminiModel}: ${e?.message?.substring(0, 60)}`)
      }
    }
  }

  console.error('[CIC] All providers failed:', errors.join(' | '))
  throw new Error('All providers failed: ' + errors.join(' | '))
}

// Replies now arrive as {tone, body, question}. They are joined here so the closing question is
// always the last thing in the text. The old {tone, text} shape is still accepted.
const TRAIL_EMOJI = /[\s\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\uFE0F]+$/u

// Puts a closing mark on a sentence that lacks one, in front of any trailing emoji ("honey 😘" becomes "honey. 😘").
function ensureEndMark(text: string, mark: string, emojiEnds: boolean = false): string {
  const t = text.trim()
  const m = t.match(TRAIL_EMOJI)
  const tail = m ? m[0] : ''
  const core = tail ? t.slice(0, t.length - tail.length) : t
  if (!core) return t
  if (/[.!?…]["')\]]*$/.test(core)) return t
  // A body that already ends in an emoji ("honey 😘") reads as finished; no full stop is forced in front of it.
  if (emojiEnds && tail.trim()) return t
  return core + mark + tail
}

function normalizeReply(r: any): { tone: string; text: string } {
  const tone = ((r && r.tone) || 'Reply').toString()
  if (r && typeof r.text === 'string' && r.text.trim()) return { tone, text: r.text }
  const body = ((r && r.body) || '').toString().trim()
  const q = ((r && (r.question || r.cta || r.closing)) || '').toString().trim()
  if (!body && !q) return { tone, text: '' }
  const lead = body ? ensureEndMark(body, '.', true) : ''
  // A closing line with no mark at all: a question word or helper verb makes it a question, anything else a statement.
  const closing = q ? ensureEndMark(q, /^(what|why|how|when|where|who|which|whose|do|does|did|is|are|was|were|will|would|can|could|should|have|has|had|am|ever|if)\b/i.test(q) ? '?' : '.') : ''
  return { tone, text: [lead, closing].filter(Boolean).join(' ') }
}

function parseReplies(raw: string): Array<{tone: string, text: string}> {
  if (!raw) return []
  // Strip chain-of-thought thinking blocks (Qwen, DeepSeek, o1-style models)
  let clean = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
  clean = clean.replace(/^```(?:json)?\s*/im, '').replace(/```\s*$/im, '').trim()

  try { const p = JSON.parse(clean); if (Array.isArray(p.replies) && p.replies.length) return p.replies.map(normalizeReply) } catch {}

  const m = clean.match(/\{[\s\S]*?"replies"\s*:\s*\[[\s\S]*?\]\s*\}/)
  if (m) { try { const p = JSON.parse(m[0]); if (Array.isArray(p.replies)) return p.replies.map(normalizeReply) } catch {} }

  const replies: Array<{tone: string, text: string}> = []
  const replyPattern = /\{\s*"tone"\s*:\s*"([^"]+)"\s*,\s*"text"\s*:\s*"((?:[^\\"]|\\.)*)"\s*\}/g
  let match
  while ((match = replyPattern.exec(clean)) !== null) {
    try {
      const text = JSON.parse('"' + match[2] + '"')
      if (text && text.length > 5) replies.push({ tone: match[1], text })
    } catch {
      if (match[2] && match[2].length > 5) replies.push({ tone: match[1], text: match[2] })
    }
  }
  if (replies.length > 0) return replies

  // Last resort for truncated or malformed JSON: pull {tone, body, question} objects one by one.
  const bqPattern = /\{\s*"tone"\s*:\s*"([^"]+)"\s*,\s*"body"\s*:\s*"((?:[^\\"]|\\.)*)"\s*,\s*"question"\s*:\s*"((?:[^\\"]|\\.)*)"\s*\}/g
  let bq
  while ((bq = bqPattern.exec(clean)) !== null) {
    try {
      const n = normalizeReply({ tone: bq[1], body: JSON.parse('"' + bq[2] + '"'), question: JSON.parse('"' + bq[3] + '"') })
      if (n.text.length > 5) replies.push(n)
    } catch { /* skip malformed object */ }
  }
  return replies
}

// The extension sends history as "[3] HIM: text" and "[4] ME: text". Pull out only his lines.
function getHisLines(context: string): string[] {
  if (!context) return []
  return (context.match(/(?:^|\n)\s*(?:\[\d+\]\s*)?(?:Him|He|Client)\s*:\s*(.+)/gi) || [])
    .map(l => l.replace(/^\s*(?:\[\d+\]\s*)?(?:Him|He|Client)\s*:\s*/i, '').trim())
    .filter(Boolean)
}

// Green-chat rule: she may only CONTINUE a sexual conversation, never start one.
// "Sexual" is judged from HIS words only, in the current message or anywhere in the history.
const EXPLICIT_RE = /\b(fuck|cock|pussy|ass\b|dick|cum\b|orgasm|moan|naked|nude|undress)\b/i
const IMPLIED_RE = /\b(horny|turn.?on|lust|erotic|naughty|dirty talk|kinky|fantasize|touch me|in bed|sleep with|make love|bedroom)\b/i
function isSexualText(t: string): boolean {
  return EXPLICIT_RE.test(t) || IMPLIED_RE.test(t)
}
function heHasGoneSexual(context: string, message: string): boolean {
  if (isSexualText(message)) return true
  return getHisLines(context).some(isSexualText)
}

// Lightweight, zero-cost client-type inference from existing conversation context.
// Runs on data we already have (context string) — no extra API call, no extra latency.
// This only ever produces a soft tone-selection HINT — it never overrides the
// grief/vulnerable/erotic/meetup/contact blocks, which stay hard priority.
function detectClientType(context: string, currentMessage: string): string | null {
  if (!context || context.length < 40) return null // not enough history to classify yet

  // Pull out just his lines from the conversation summary, if it's speaker-tagged.
  // Falls back to treating the whole context as signal if we can't isolate his turns.
  const hisLines = getHisLines(context)

  const sample = hisLines.length >= 2 ? hisLines : [currentMessage]
  const avgLen = sample.reduce((sum, l) => sum + l.length, 0) / sample.length
  const avgWords = sample.reduce((sum, l) => sum + l.split(/\s+/).filter(Boolean).length, 0) / sample.length

  const eroticSignal = /\b(fuck|cock|pussy|dick|cum|naked|nude|horny|wet|hard|turn.?on|kinky|fantasize)\b/i.test(sample.join(' '))
  const straightToPoint = avgWords <= 12 && /\b(you|your|when|come|want|meet|show)\b/i.test(sample.join(' '))

  if (eroticSignal && straightToPoint) return 'naughty'
  if (avgWords <= 5) return 'silent'
  if (avgWords >= 20 || avgLen >= 120) return 'talker'
  return null // mixed/ambiguous — let the model default naturally, don't force a lane
}

const CLIENT_TYPE_HINTS: Record<string, string> = {
  talker: 'He tends to write long, story-driven messages — lean into playful curiosity and follow-up hooks that invite him to keep telling his story, over drier or more clipped tones.',
  naughty: 'He tends to get straight to the point with direct, forward messages — matching directness while holding a little back (push-pull) tends to land better than fully warm/soft tones here.',
  silent: 'He tends to write short, guarded replies — favor a light tease or gentle curiosity that re-engages without pressure, over long warm paragraphs he is unlikely to match.',
}

// ═══ CONVERSATION THREAD ════════════════════════════════════════════════════════
// The history sits near the top of a very long prompt, where models give it the least attention.
// So the last exchanges, what he is replying to, and her own voice are also restated right before
// the model writes, in a compact block.
type HistLine = { who: 'HIM' | 'ME'; text: string }

function parseHistory(context: string): HistLine[] {
  const out: HistLine[] = []
  for (const raw of (context || '').split('\n')) {
    const m = raw.match(/^\s*\[\d+\]\s*(HIM|HER|ME)\s*:\s*(.+?)\s*$/i)
    if (!m) continue
    let text = m[2]
    if (/^\[CLIENT (SENT|SHARED) A PHOTO/i.test(text)) text = '(he sent a photo)'
    out.push({ who: m[1].toUpperCase() === 'HIM' ? 'HIM' : 'ME', text })
  }
  return out
}

function clip(t: string, n: number): string {
  return t.length > n ? t.slice(0, n - 1).trimEnd() : t
}

function describeVoice(herLines: string[]): string {
  const sample = herLines.slice(-5)
  if (!sample.length) return ''
  const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u
  const usesEmoji = sample.some(t => emoji.test(t))
  const exclaim = sample.filter(t => t.includes('!')).length
  const asks = sample.filter(t => t.includes('?')).length
  const all = sample.join(' ')
  const sentences = all.split(/[.!?]+\s/).filter(x => x.trim().length > 0)
  const avgWords = Math.round(all.split(/\s+/).filter(Boolean).length / Math.max(1, sentences.length))
  const contractions = (all.match(/\b\w+'(m|re|s|ve|ll|d|t)\b/gi) || []).length
  const playful = /\b(haha+|lol|lmao|hehe)\b|😂|😅|😉|😜/i.test(all)
  return [
    usesEmoji ? 'she has used emojis, so one is fine if it fits' : 'she has not used emojis, so use none',
    exclaim >= 2 ? 'she often uses exclamation marks' : 'she rarely uses exclamation marks',
    asks >= sample.length - 1 ? 'she usually ends with a question' : '',
    'her sentences average about ' + avgWords + ' words',
    contractions === 0 ? 'she writes without contractions, plainly and a little formally' : contractions >= 3 ? 'she uses contractions' : '',
    playful ? 'she has been playful and laughs in text' : 'she has been earnest and warm rather than jokey, so keep humour very light unless he starts it',
  ].filter(Boolean).join('; ')
}

// He mentions something he ordered, paid for, was promised or is waiting on. Such a message must be
// met plainly and honestly. It is never joked away or stalled, and the operator is told to check.
// He says he did not understand something she wrote. She must explain it simply, then carry on.
function detectConfusion(message: string): boolean {
  return /\b(what do you mean|what did you mean|what you mean|what does that mean|what is that supposed to mean|don'?t (know|understand|get) what you mean|do not (know|understand) what you mean|(i )?(don'?t|do not|didn'?t|did not) (understand|get|follow)|(i'?m|i am|im) (confused|lost)|confus(ed|ing)|makes? no sense|doesn'?t make sense|not sure what you mean|explain (that|what|it)|come again|huh\b|what\?+$|meaning\?)/i.test(message)
}

function detectOrderTopic(context: string, message: string): boolean {
  const recent = [...getHisLines(context).slice(-1), message].filter(Boolean).join(' \n ')
  return /\b(my order|an order|the order|put in an order|placed an order|ordered|custom (photo|pic|video|content|request)s?|special (photo|pic|video)s?|i paid|already paid|payment|purchased?|bought|invoice|refund|tipped|you promised|you said you would|you owe|still waiting|haven'?t (got|received|gotten)|didn'?t (get|receive)|where (is|are) (my|the)|send (them|it|those) to me)\b/i.test(recent)
}

// He says something painful or hard. Care comes first, before humour, wit or the call to action.
function detectCareFirst(message: string): boolean {
  return /\b(i was hurt|got hurt|hurt my|injur(y|ed)|surgery|hospital|in pain|pain|sick|ill\b|cancer|chemo|lonely|so alone|depress(ed|ion)|anxious|anxiety|panic|worried|scared|afraid|stressed|exhausted|burn(ed|t) out|rough (day|week|time|year)|hard time|bad day|struggl(e|ing)|lost my|passed away|funeral|divorc(e|ed)|laid off|got fired|broke up|breakup|miss(ing)? (her|him|my))\b/i.test(message)
}

function buildThreadBlock(context: string, noQuestion: boolean = false, sleepy: boolean = false, message: string = ''): string {
  const hist = parseHistory(context)
  if (!hist.length) {
    return [
      'CONVERSATION CONTEXT: no earlier messages could be read from the chat.',
      'Treat this as the start of the thread. Answer his message directly and warmly, ask one question about what he just said, and do NOT invent shared history, plans or details that nobody mentioned.',
    ].join('\n')
  }

  const thread = hist.slice(-6)
    .map(l => (l.who === 'HIM' ? 'HIM' : 'HER (you, earlier)') + ': ' + clip(l.text, l.who === 'HIM' ? 800 : 500))
    .join('\n')

  // His unanswered messages are the run of HIM lines at the very end of the history.
  const pending: string[] = []
  for (let i = hist.length - 1; i >= 0 && hist[i].who === 'HIM'; i--) pending.unshift(hist[i].text)
  let herLast = ''
  for (let i = hist.length - pending.length - 1; i >= 0; i--) {
    if (hist[i].who === 'ME') { herLast = hist[i].text; break }
  }
  const herLines = hist.filter(l => l.who === 'ME').map(l => l.text)

  const parts: string[] = [
    'THE CONVERSATION SO FAR - THIS IS WHAT SHE IS CONTINUING (newest last):',
    thread,
  ]
  if (herLast) parts.push('He is answering her last message: "' + clip(herLast, 500) + '"')
  if (pending.length >= 2) {
    parts.push('He sent ' + pending.length + ' messages in a row since her last reply. She answers them as one thought: ' +
      pending.map(p => '"' + clip(p, 400) + '"').join(' | '))
  }
  if (herLines.length) {
    const voice = describeVoice(herLines)
    parts.push('HER REAL VOICE SO FAR (her own earlier messages, in her words. Copy the voice, never the wording): ' +
      herLines.slice(-3).map(t => '"' + clip(t, 320) + '"').join(' | '))
    if (voice) parts.push('Her habits: ' + voice + '.')
  }
  // Break his latest message(s) into the separate things he said, so none of them is skipped.
  const latest = (pending.length ? pending.join(' ') : message).replace(/\s+/g, ' ').trim()
  const points = (latest.match(/[^.!?]+[.!?]*/g) || []).map(x => x.trim()).filter(x => x.length > 3).slice(0, 6)
  if (points.length) {
    parts.push(
      '',
      'EVERYTHING HE SAID IN HIS LATEST MESSAGE, IN ORDER. THE BODY MUST DEAL WITH EACH POINT:',
      points.map((x, i) => (i + 1) + '. ' + clip(x, 400)).join('\n'),
      'For each point, give a real, specific response in one short clause or sentence: a question gets a personal answer with her own detail, news or a feeling gets a reaction that fits it (sadness gets care first), a compliment gets received warmly and answered with her own specific one, a plan or request gets a clear answer. Cover them in his order and do not skip any, even a small aside. Do not repeat his words back. Do not turn the body into a list. It should read as one natural text.',
      'Only after every point is handled does the closing call to action come in. It builds on the most alive point on the SAME topic. It never changes the subject.'
    )
  }
  parts.push(
    '',
    'CONTINUITY - CHECK THIS LAST, BEFORE WRITING:',
    '1. Every reply is the natural NEXT TURN of this exact conversation. It picks up a specific detail from the thread above, never a topic from nowhere.',
    '2. If his message is short or vague ("ok", "lol", "yes", "hmm", "haha"), read it as his answer to HER last message and keep that same topic moving. It is not a fresh start and the subject does not change.',
    '3. Same woman, same voice. Match the warmth, humour, rhythm and habits of her earlier messages. Do not suddenly become more poetic, more intense, more formal or more heated than she has been so far. Move the energy forward by one notch at most.',
    sleepy
      ? '4. He is winding down for sleep. Tone the conversation down. Do not open a new topic or push the energy forward (see SLEEP MODE).'
      : noQuestion
      ? '4. He has just said she asks too many questions. Own it lightly in a few words, answer what he said, then close with a statement call to action that is NOT a question (see NO-QUESTION MODE). It grows out of what is being discussed right now.'
      : '4. Answer what he asked before asking anything new. The closing question grows out of what is being discussed right now. If it could be pasted into a different conversation, rewrite it.',
    '5. Never restate or quote his words back to him. Move the thread forward.',
    '6. Use only facts that appear in the thread. Never invent details about him or about earlier messages.',
    '7. THE REAL THREAD BEATS THE PERSONA. The description of Mia at the top is only a default. If her earlier messages in this chat are plain, earnest, formal, shy or bold, write in THAT register, with her sentence length, warmth and vocabulary. Be witty only if she has been, or he is. Never swap her for a different woman.',
    '8. READ EACH REPLY BACK BEFORE ANSWERING. Every sentence is complete, no word is missing, nothing stops mid-thought, no sentence is a stranded fragment, and the reply makes sense on its own and as the next turn of this chat.',
  )
  if (detectConfusion(latest)) {
    parts.push(
      '',
      'HE DID NOT UNDERSTAND SOMETHING SHE SAID. EXPLAINING IT COMES FIRST:',
      herLast ? 'The message he is confused about is HER LAST MESSAGE: "' + clip(herLast, 500) + '"' : 'He is confused about something she said earlier in the thread above.',
      'Start by explaining what she meant, in plain everyday words and short sentences, as if telling a friend. Use one simple concrete example or a clearer restatement of her own point. Stay consistent with what she already said and do not invent a different story.',
      'Answer his exact confusion: if he quotes a phrase, explain that phrase. Do not repeat her original wording, do not apologise at length, and do not make him feel slow. A light, warm "that came out wordy, let me say it simply" is fine, once.',
      'Then keep the conversation moving on the same topic with a closing call to action that is EASIER to answer than the last one: simple, concrete and personal, not abstract.'
    )
  }
  if (detectCareFirst(latest)) {
    parts.push(
      '',
      'HE SAID SOMETHING THAT HURTS OR WEIGHS ON HIM. CARE COMES FIRST:',
      'The first sentence of every reply responds to that specific thing, warmly and plainly, in her own words. No joke, no wit, no change of subject, no advice, no cheerleading. He should feel she stopped and took it in. Then she responds to the rest of what he said, and the closing line asks about HIM and how he is, tied to what he shared.'
    )
  }
  if (detectOrderTopic(context, message)) {
    parts.push(
      '',
      'HE IS TALKING ABOUT SOMETHING HE ORDERED, PAID FOR, WAS PROMISED OR IS WAITING ON. THIS COMES BEFORE EVERYTHING ELSE:',
      'Answer it first, plainly and warmly, so he feels heard and not brushed off. Never joke it away, call it formal, belittle it, change the subject, or turn it into flirting. No sexual escalation in this reply.',
      'She never says it has been sent, never says it is on its way, and never gives a time, a day or a promise she cannot keep. She stays honest: she tells him she is going to look into it properly, and asks the one useful thing that helps her find it (which request, and roughly when he placed it).',
      'Do not invent details of the order. Use only what he wrote.'
    )
  }
  if (sleepy) {
    parts.push(
      '',
      'SLEEP MODE - HE IS GOING TO SLEEP OR IS TIRED. THIS OVERRIDES EVERY RULE ABOUT ADVANCING THE CONVERSATION:',
      'Do not escalate, do not open a new topic and do not make the energy hotter. Slow everything down and soften it. If the chat had been sexual, bring it down to affection and warmth, not a push for more.',
      'The body is short and calm. Acknowledge that he is tired, wish him rest, and add one small specific warm touch drawn from what you two talked about today.',
      'The closing line is still a call to action, but a gentle parting hook that makes him want to come back: something to carry into his dreams or to tell her when he wakes up, tied to the topic already on the table. It can be a very light statement or a soft, easy question. It must not ask for effort, long answers or a decision. No promises to meet, no promised time or day.',
      'Do not try to keep him awake. Do not guilt him for leaving. Four different warm, human ways to say goodnight.'
    )
  }
  return parts.join('\n')
}

// ═══ MATCH HIS ENERGY: length tiers ═════════════════════════════════════════════
// The 75 character floor stays. Short messages get short replies, long messages get fuller ones.
type LengthTier = { name: string; min: number; max: number; note: string; body: string; q: string }
const LENGTH_TIERS: Record<string, LengthTier> = {
  short: { name: 'short', min: 80, max: 220, body: '', q: '', note: 'He wrote very little. About 80 to 130 characters in total: react warmly to the most important thing he said, answer anything he asked, then the closing question.' },
  medium: { name: 'medium', min: 80, max: 220, body: '', q: '', note: 'He wrote a normal-length message. About 110 to 170 characters in total: answer what he asked, show she felt what he said, then the closing question.' },
  long: { name: 'long', min: 80, max: 220, body: '', q: '', note: 'He wrote a lot. Use the upper part of the range, up to 220 characters in total. Address every concern and every question in his message, each in a few words and in his order, so he feels fully heard, then the closing question.' },
  sensitive: { name: 'sensitive', min: 80, max: 220, body: '', q: '', note: 'This is an important moment. Up to 220 characters in total. Care and a plain, honest answer come first, then the closing question.' },
}

// He is winding down for the night: the reply should tone the conversation down, not push it forward.
function detectSleepy(context: string, message: string): boolean {
  const last = message || ''
  if (/\b(can'?t|cannot|couldn'?t|unable to|not able to|won'?t be able to|trouble|hard to) (get to )?sleep\b|\bnot (even )?sleepy\b|\bnot (even )?tired\b|\bnever sleep|\b(but|though|still) (i )?(wanna|want to|gonna|will|can) (keep|stay)|\b(keep|stay) (talking|chatting|up|awake)|\bnot ready (to|for) (sleep|bed)|\bno(t)? (going|going to) (to )?(bed|sleep) yet/i.test(last)) return false
  return /\b(good ?night|goodnight|g'?night|gnight|nighty|night night|nite nite|sweet dreams|going to (bed|sleep)|gonna (go to )?(bed|sleep)|off to (bed|sleep)|heading (to|for) (bed|sleep)|head(ed)? to bed|time (for|to go to) bed|time to sleep|need (to get )?(some )?sleep|(getting|feeling|so|very|really|pretty) (sleepy|tired|exhausted)|i'?m (so |very |really )?(sleepy|exhausted)|i'?m (so |very |really )?tired(?! of)|call it a night|hit the (hay|sack)|turn(ing)? in for the night|about to (sleep|crash)|crash(ing)? (now|soon)|eyes (are )?(closing|heavy)|can'?t keep my eyes open|bedtime|sleep time|knocked out|i have to sleep)\b/i.test(last)
}

// When he complains about being asked too many questions, the closing call to action must NOT be a question.
function detectQuestionFatigue(context: string, message: string): boolean {
  const recent = [...getHisLines(context).slice(-2), message].filter(Boolean).join(' \n ')
  return /(so|too|way too|many|all (these|the)|with the|stop (with )?the|enough|quit|no more) ?(many )?questions|questions? (questions?|again|already|all the time|all day)|(20|twenty) questions|(an? )?interview|interrogat|stop asking|quit asking|(you|u) ask (so|too|a lot)|always asking|keep asking|asking (me )?(so|too|a lot|lots)|(you|u) (ask|asking) (a lot|lots)|why (so|are you asking)|what'?s with (all )?the questions/i.test(recent)
}

function getLengthTier(message: string): LengthTier {
  if (/\b(meet(\s*up)?|come over|your place|my place|hotel|in person|see you|come round)\b/i.test(message)) return LENGTH_TIERS.sensitive
  if (/\b(phone|whatsapp|instagram|snap|telegram|call me|give me your|text me|hear your voice|facetime|video call|voice call|move off|take this off)\b/i.test(message)) return LENGTH_TIERS.sensitive
  if (/\b(passed away|died|death|widow|widower|funeral|grief|grieving|lost (my|his|her|a))\b/i.test(message)) return LENGTH_TIERS.sensitive
  if (/SENT A PHOTO|SHARED A PHOTO|\[photo\]/i.test(message)) return LENGTH_TIERS.medium
  const clean = message.replace(/\[[^\]]*\]/g, ' ').replace(/\s+/g, ' ').trim()
  const words = clean ? clean.split(' ').length : 0
  if (words <= 6 || clean.length < 35) return LENGTH_TIERS.short
  if (words <= 20 && clean.length <= 140) return LENGTH_TIERS.medium
  return LENGTH_TIERS.long
}

function endsWithQuestion(t: string): boolean {
  return /\?["')\]]*$/.test(t.trim().replace(TRAIL_EMOJI, ''))
}

// A call to action is a closing question, or a closing invitation such as "Tell me about ...".
function hasCTA(t: string): boolean {
  const core = t.trim().replace(TRAIL_EMOJI, '')
  if (endsWithQuestion(core)) return true
  const last = (core.match(/[^.!?]+[.!?]+["')\]]*$/) || [''])[0].trim()
  return /^(please |now |so |okay |ok |and )*(tell me|describe|show me|share|walk me|paint me|paint a|take me|give me|finish|i('d| would) (like|love) to (know|hear)|i want to (know|hear)|i need to (know|hear)|let me (hear|in on)|i'?m (curious|dying) to)\b/i.test(last)
}

// Splits "lead + closing question" so trimming can shorten the lead and never the question.
function splitClosing(text: string): { lead: string; closing: string } | null {
  const t = text.trim()
  if (!/\?["')\]]?$/.test(t)) return null
  const body = t.replace(/\?["')\]]?$/, '')
  const m = body.match(/^[\s\S]*[.!?]["')\]]?\s+/)
  const idx = m ? m[0].length : 0
  return { lead: t.slice(0, idx).trim(), closing: t.slice(idx).trim() }
}

// ═══ LOCAL CONTEXT (US cities) ═══════════════════════════════════════════════
// When he mentions a US city, pull light local material: weather and time of day, local headlines,
// and sports headlines if he follows a sport. Free sources with no API keys: Open-Meteo (geocoding
// and weather) and Google News RSS. Every call is time-capped and fails silently, so this can never
// block or break a reply.
const STATE_NAMES: Record<string, string> = {
  AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',DE:'Delaware',DC:'District of Columbia',
  FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',
  MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',
  NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',
  PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',
  WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming',
}

// Words that follow "in/from/near" but are not places, and words that end a place name.
const CITY_STOP = new Set(['the','a','an','my','your','our','their','his','her','this','that','these','those','it','me','you','us','bed','love','case','fact','general','person','public','private','charge','control','touch','town','school','work','college','real','life','mood','time','between','front','back','car','home','house','here','there','no','one','some','any','every','all','just','about','around','like','such','more','most','how','what','when','where','why','which','who','good','bad','trouble','need','person','style','way','order','shape','mind','heaven','hell','love'])
const CITY_CUT = new Set(['and','but','with','for','right','now','today','tonight','rn','so','on','at','where','when','because','though','since','while','until','this','that','which','who','too','also','as','if','or','is','was','are','am','it','its','lol','haha','anyway','currently','still','again','then','area','state','county','city'])

function extractCityCandidates(lines: string[]): Array<{ name: string; state?: string }> {
  const out: Array<{ name: string; state?: string }> = []
  const seen = new Set<string>()
  const re = /\b(?:live in|living in|lives in|from|based in|moved to|moving to|visiting|outside of|outside|near|in)\s+([A-Za-z][A-Za-z.'-]+(?:\s+[A-Za-z][A-Za-z.'-]+){0,3})(?:\s*,\s*([A-Za-z]{2})\b)?/gi
  for (let i = lines.length - 1; i >= 0; i--) {
    const matches = Array.from(lines[i].matchAll(re)).reverse()
    for (const m of matches) {
      let words = m[1].split(/\s+/)
      const cutIdx = words.findIndex(w => CITY_CUT.has(w.toLowerCase().replace(/[.'-]/g, '')))
      if (cutIdx === 0) continue
      if (cutIdx > 0) words = words.slice(0, cutIdx)
      if (!words.length || CITY_STOP.has(words[0].toLowerCase())) continue
      const st = m[2] && STATE_NAMES[m[2].toUpperCase()] ? m[2].toUpperCase() : undefined
      for (let n = words.length; n >= 1; n--) {
        const name = words.slice(0, n).join(' ').replace(/[.,]+$/, '')
        if (name.length < 3) continue
        const key = name.toLowerCase() + '|' + (st || '')
        if (!seen.has(key)) { seen.add(key); out.push({ name, state: st }) }
      }
    }
  }
  return out.slice(0, 6)
}

async function fetchTimed(url: string, ms = 2500): Promise<Response | null> {
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), ms)
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CIC/1.0)' } })
    clearTimeout(t)
    return res.ok ? res : null
  } catch { return null }
}

type GeoHit = { name: string; admin1: string; lat: number; lon: number }
const geoCache = new Map<string, GeoHit | null>()
async function geocodeUS(c: { name: string; state?: string }): Promise<GeoHit | null> {
  const key = c.name.toLowerCase() + '|' + (c.state || '')
  if (geoCache.has(key)) return geoCache.get(key)!
  const res = await fetchTimed(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(c.name)}&count=8&language=en&format=json&countryCode=US`)
  if (!res) return null // network failure: do not cache
  const data: any = await res.json().catch(() => null)
  const list: any[] = (data?.results || []).filter((r: any) => r.country_code === 'US')
  const wantState = c.state ? STATE_NAMES[c.state] : undefined
  const pick = (wantState ? list.find(r => r.admin1 === wantState) : undefined) || list.find(r => (r.population || 0) >= 50000)
  const hit: GeoHit | null = pick ? { name: pick.name, admin1: pick.admin1, lat: pick.latitude, lon: pick.longitude } : null
  geoCache.set(key, hit)
  return hit
}

function wxDesc(code: number): string {
  if (code === 0) return 'clear'
  if (code <= 3) return code === 1 ? 'mostly clear' : code === 2 ? 'partly cloudy' : 'overcast'
  if (code === 45 || code === 48) return 'foggy'
  if (code >= 51 && code <= 57) return 'drizzly'
  if (code >= 61 && code <= 67) return 'rainy'
  if (code >= 71 && code <= 77) return 'snowing'
  if (code >= 80 && code <= 82) return 'showery'
  if (code === 85 || code === 86) return 'snow showers'
  if (code >= 95) return 'stormy'
  return 'unsettled'
}

async function fetchWeather(lat: number, lon: number): Promise<string> {
  const res = await fetchTimed(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&temperature_unit=fahrenheit&timezone=auto&forecast_days=1`)
  if (!res) return ''
  const data: any = await res.json().catch(() => null)
  const cur = data?.current
  if (!cur || typeof cur.temperature_2m !== 'number') return ''
  const hour = parseInt(String(cur.time || '').slice(11, 13), 10)
  const part = isNaN(hour) ? '' : hour < 5 ? 'late night' : hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : hour < 21 ? 'evening' : 'night'
  const hi = data?.daily?.temperature_2m_max?.[0]
  const lo = data?.daily?.temperature_2m_min?.[0]
  let out = (part ? `It is ${part} there. ` : '') + `${Math.round(cur.temperature_2m)}F and ${wxDesc(cur.weather_code)} right now`
  if (typeof hi === 'number' && typeof lo === 'number') out += `, today's high ${Math.round(hi)}F and low ${Math.round(lo)}F`
  return out + '.'
}

// Skip anything heavy: politics, crime, accidents, tragedy. Light local material only.
const HEADLINE_BAD = /(shoot|shot\b|gun|kill|dead|death|dies|died|murder|crash|fatal|arrest|police|stabb|victim|assault|abuse|robber|theft|stolen|crime|overdose|dui\b|trump|biden|election|congress|senate|democrat|republican|politic|vote|court|trial|war\b|attack|fire\b|missing|lawsuit|suspect|charged|injur|hospital|drown|bomb|threat|scandal|protest|immigra)/i
function decodeEntities(t: string): string {
  return t.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
}
async function fetchHeadlines(query: string, max = 3): Promise<string[]> {
  const res = await fetchTimed(`https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`)
  if (!res) return []
  const xml = await res.text().catch(() => '')
  const titles = Array.from(xml.matchAll(/<item>[\s\S]*?<title>([\s\S]*?)<\/title>/g))
    .map(m => decodeEntities(m[1]).replace(/\s+-\s+[^-]+$/, '').trim())
  return titles.filter(t => t.length > 12 && !HEADLINE_BAD.test(t)).slice(0, max)
}

const SPORT_WORDS: Array<[RegExp, string]> = [
  [/\b(college football|college basketball|march madness)\b/i, 'college sports'],
  [/\b(nfl|football|touchdown|quarterback)\b/i, 'NFL football'],
  [/\b(nba|basketball|hoops)\b/i, 'NBA basketball'],
  [/\b(mlb|baseball)\b/i, 'MLB baseball'],
  [/\b(nhl|hockey)\b/i, 'NHL hockey'],
  [/\b(mls|soccer)\b/i, 'MLS soccer'],
  [/\b(golf|pga)\b/i, 'golf'],
  [/\bnascar\b/i, 'NASCAR'],
  [/\b(ufc|mma)\b/i, 'UFC'],
]
const localCache = new Map<string, { at: number; text: string }>()

async function getLocalContext(context: string, message: string): Promise<string> {
  const lines = [...getHisLines(context), message].filter(Boolean)
  const cands = extractCityCandidates(lines)
  if (!cands.length) return ''

  const work = (async (): Promise<string> => {
    let place: GeoHit | null = null
    for (const c of cands.slice(0, 4)) { place = await geocodeUS(c); if (place) break }
    if (!place) return ''
    const label = `${place.name}, ${place.admin1}`

    const hisText = lines.join(' ')
    const sport = (SPORT_WORDS.find(([re]) => re.test(hisText)) || [])[1]
    const weatherTalk = /\b(weather|rain|raining|snow|snowing|cold|freezing|hot|humid|heat|storm|hurricane|tornado|sunny|windy|forecast)\b/i.test(lines.slice(-3).join(' '))

    const ck = `${label}|${sport || ''}|${weatherTalk ? 'w' : ''}`.toLowerCase()
    const cached = localCache.get(ck)
    if (cached && Date.now() - cached.at < 15 * 60 * 1000) return cached.text

    const [wx, news, sports] = await Promise.all([
      fetchWeather(place.lat, place.lon),
      fetchHeadlines(`${place.name} ${place.admin1} local news`),
      sport ? fetchHeadlines(`${place.name} ${sport}`) : Promise.resolve([] as string[]),
    ])
    if (!wx && !news.length && !sports.length) return ''

    const parts: string[] = [`LOCAL CONTEXT - he mentioned ${label}. This is OPTIONAL background, never a script:`]
    if (wx) parts.push(`- Weather and time there: ${wx}${weatherTalk ? ' (he has been talking about the weather, so this is a natural hook)' : ''}`)
    if (news.length) parts.push('- Local headlines: ' + news.map(h => `"${h}"`).join(' | '))
    if (sports.length) parts.push(`- Sports he follows (${sport}): ` + sports.map(h => `"${h}"`).join(' | '))
    parts.push(
      'RULES FOR THIS: Use at most ONE item, and only if it connects to what he just said or gives her question a natural hook. Never list several. ' +
      'She never says she looked anything up. She mentions it only the way someone who happens to know would, and she never invents details beyond what is listed here. ' +
      'She never claims to be in his city or to be having the same weather. No politics, crime, accidents or tragedy even if one slipped through. ' +
      'If nothing here fits his message naturally, she ignores this section completely.'
    )
    const text = '\n' + parts.join('\n') + '\n'
    localCache.set(ck, { at: Date.now(), text })
    return text
  })()

  // Hard cap so lookups can never slow a reply by more than a few seconds.
  return Promise.race([work, new Promise<string>(r => setTimeout(() => r(''), 1800))]).catch(() => '')
}

const BODY_QUALITY = [
  'BODY QUALITY - THE PART BEFORE THE CALL TO ACTION IS WHAT MAKES HIM FEEL HEARD:',
  'The body is where she earns the right to ask. It must do three things in this order, in as many sentences as the length limit allows:',
  '1. REACT to ONE specific detail he actually wrote (a word, a place, a habit, a feeling), in her own reaction. Not a summary of what he said and not a compliment that fits anyone.',
  '2. GIVE something of her own: a small opinion, a quick personal detail, a funny honest admission, or a tiny story beat. Real people trade a little of themselves. A body made only of reacting to him feels like an interviewer.',
  '3. BRIDGE: the last words of the body lead naturally into the closing line, so the closing line feels like the next thing she would say and not a switch.',
  'Rules for the body:',
  '- One idea per sentence. Short sentences are fine. A fragment is fine. Never stack three adjectives.',
  '- Vary the opening. Never open with "Wow", "Aww", "That is so", "That sounds", "I love that", "Oh wow", "Haha" every time. Start from the detail itself, or a reaction in her own words.',
  '- Never repeat or echo his sentence back to him, and never say "you said". Show she listened by what she does with it.',
  '- Specific beats vague. "Night shifts and still cooking" beats "that is impressive". Concrete nouns beat adjectives.',
  '- If he answered something she asked, acknowledge his answer first, then move on. Never ignore it.',
  '- If he complimented her, take it with a bit of personality (a light tease, a shy admission), never a plain "thank you" and never fishing for more.',
  '- If he shared something heavy, one honest human sentence first. No advice, no cheerleading, no therapy words.',
  '- Humour must be light and from the situation. Never a joke that could be pasted anywhere.',
  '- Her voice must stay consistent with the earlier messages in the thread above.',
  'Before writing each reply, check the body: could a different woman send it to a different man? If yes, rewrite it with something only he gave her.',
].join('\n')


function lengthBudgetBlock(tier: LengthTier, noQuestion: boolean, sleepy: boolean): string {
  const qField = noQuestion ? 'cta' : 'question'
  return [
    'LENGTH: every reply is between 80 and 220 characters in total ("body" plus "' + qField + '"). Never under 80, never over 220.',
    tier.note,
    'Do not count characters one by one. Write natural sentences, and if a reply feels thin, add one small specific detail or feeling, never filler. Every sentence is complete and no thought is cut off.',
    'Every question he asked gets answered inside the body. Never skip one to save room, shorten something else instead.',
  ].join('\n')
}

const MEETUP_RE = /\b(meet(\s*up)?|meeting|get(ting)? together|come over|your place|my place|hotel|in person|see you|tonight|come round)\b/i

function buildPrompt(
  message: string,
  context: string,
  plan: string,
  previousTones: string[],
  englishVariety: string,
  myName: string | null,
  questionsToAnswer: string[] = [],
  clientType: string | null = null,
  localContext: string = '',
  tier: LengthTier = LENGTH_TIERS.medium,
  thread: string = '',
  noQuestion: boolean = false,
  sleepy: boolean = false
): string {
  const eng: Record<string, string> = {
    AmEng: 'American English. Spelling: color, favorite, realize. Idioms: awesome, sure thing, totally.',
    BrEng: 'British English. Spelling: colour, favourite, realise. Idioms: brilliant, cheers, reckon, sorted, mate, bloody, chuffed.',
    AuEng: 'Australian English. Spelling: colour, favourite, realise. Vocab: arvo, reckon, heaps, keen, fair dinkum, no worries, deadset, brekkie, stoked, mate, ripper, bloody. Real Australian woman, not a parody.',
  }
  const engNote = eng[englishVariety] || eng['AmEng']
  const nameNote = myName ? `Her name is ${myName}.` : ''

  const historyNote = context
    ? `CONVERSATION HISTORY - she has read every single message. This is critical:\n${context}\n\nBEFORE WRITING: scan every reply she has already sent in this history. She MUST NOT repeat any angle, question, observation, or idea she has already used. If she already asked about his job - she does not ask about his job again. If she already complimented something - she does not repeat that compliment. Every reply must be genuinely new ground.`
    : ''

  const isPhoto = /SENT A PHOTO|CLIENT SENT A PHOTO|\[photo\]/i.test(message)
  const isMeetup = MEETUP_RE.test(message)
  const isContact = /\b(phone|number|whatsapp|instagram|snap|telegram|signal|email|contact|off (here|this|platform)|call me|give me your|text me|hear your voice|real phone|facetime|video call|voice call|move off|take this off|talk on the phone|talk properly|talk for real)\b/i.test(message)
  const isGrief = /\b(passed away|died|death|widow|widower|lost (my|his|her|a)|grief|grieving|funeral|missing (him|her|them)|alone since|live alone)\b/i.test(message)
  const isVulnerable = !isGrief && /\b(lonely|alone|scared|afraid|hurt|broken|struggling|hard time|pain|don.?t know|confused|overwhelmed)\b/i.test(message)
  const isErotic = isSexualText(message)
  const heWentSexualEarlier = !isErotic && getHisLines(context).some(isSexualText)
  const sexualAllowed = isErotic || heWentSexualEarlier

  const photoBlock = !isPhoto ? '' : `
PHOTO MESSAGE:
She studied this photo before responding. ONE specific observation only.
Look for: his expression (what emotion behind it), his eyes, posture, energy, what setting reveals.
FORBIDDEN: nice pic, cute photo, you look good, handsome, great shot, beautiful, gorgeous.
Observation must be so specific it fits only this photo. Then one question from that detail.
She makes him feel genuinely seen, not flattered.
`

  const griefBlock = !isGrief ? '' : `
HE HAS SHARED LOSS OR GRIEF - MOST IMPORTANT MOMENT IN THIS CONVERSATION:
He has trusted her with real pain. She MUST acknowledge his loss FIRST.
Before any flirting, before any CTA, before anything else.
She does not rush to silver linings. She sits with him in it.
Not 'I am so sorry for your loss' - too cold, too formal.
Something warmer and more personal that shows she actually felt what he said.
She might share a small thought of her own that shows she understands loss.
Warm, present, human. Not therapeutic. Not performative.
After genuinely acknowledging his pain, she moves the conversation gently.
`

  const vulnerableBlock = !isVulnerable ? '' : `
HE IS BEING VULNERABLE:
He has shown something real. She meets it with equal realness.
She acknowledges what he shared. Makes him feel heard and seen.
Then moves forward gently.
`

  const meetupBlock = !isMeetup ? '' : `
HE IS ASKING TO GET TOGETHER. HANDLE IT WITH WARMTH AND NO PROMISE:
He must leave the exchange feeling wanted and heard, not rejected, and NOT strung along.
WORDS: she never writes "meet", "meeting", "meet up" or "meetup". When she has to refer to it she says "getting together", as in "getting together is a big step for me". She never writes "when we get together", "soon", "one day", "someday", a day of the week, a time, or anything that sounds like a plan or a maybe-later.
SHAPE: (1) real warmth first, she is a little delighted he asked. (2) One honest reason about her own pace, never about her calendar: she likes to really know someone first, she is enjoying getting to know him through talking, she goes at her own speed. No invented stories about her past, no excuses about being busy. (3) A specific, playful pivot that grows out of THIS chat and gives him something real to answer.
If he pushes, she stays warm and steady and does not cave, does not lecture and does not apologise.
Four replies, four techniques: (a) acknowledge, one honest reason, redirect to something he said earlier. (b) soft and playful reason, steer to something lighter. (c) a witty line first, then the reason, then a real question. (d) tell him his asking landed, say her reason honestly, draw him deeper into the current topic.
Never a flat no. Never a bare deflection. Never "I cannot meet people from the internet". Never say she keeps her location private.
`

  const contactBlock = !isContact ? '' : `
HE WANTS HER NUMBER, A CALL, A VIDEO CHAT OR TO MOVE OFF THIS APP:
She does not give any contact detail (number, WhatsApp, Instagram, Snapchat, email) and does not promise a call or video chat, now or later.
She understands why he asks and says so warmly. She gives one honest reason about her pace: she likes to really know someone first and she is enjoying talking here. No invented history, no scared tone, no "maybe later", no "someday".
Then she turns it into something that makes HIM feel valued and deepens THIS conversation right now.
`

  const eroticBlock = !isErotic ? '' : `
HE IS BEING SEXUAL OR EROTIC - PRIMARY RULE FOR THIS MESSAGE:
She is an adult woman who owns her desire. Not shocked. Not coy. Not pulling back.
She reads exactly what he said and matches his heat, going at most a half-step further, and only on what HE brought up. She never introduces a new act, body part, or scenario he has not mentioned first.
Real adult language. Not heating up or chemistry or metaphors that avoid naming the thing.
She states what she is thinking, imagining, wanting. She does not hint. Her closing question leaves the next move to him.

THE 4 REPLIES FOR AN EROTIC MESSAGE:
Reply 1 (Naughty): Takes his exact words further. Explicit and direct.
Reply 2 (Naughty): Different angle, equally explicit, different image or moment.
Reply 3 (Spicy): Playful heat with a teasing edge. Still direct.
Reply 4 (Confident): Slight deliberate pullback. She is in control. Creates most tension.

She does not water down his language. If he says pussy she can say pussy. If he says cock she can say cock.
She does not replace explicit words with vague ones. She matches his vocabulary exactly.
The erotic CTA must name something specific from what he said - his exact act, his exact words, his exact desire.
`

  const curiosityIdeas = `Curiosity questions she can use (in fresh, creative wording every time, never the same phrasing twice): pace and style (slow burn or all at once), control or being surprised, lights on or off, whispers or nails down the back, where his hands go first, a spot he loves kissed or touched, whether he has tried roleplay, what mentally turns him on as much as physically, a wild experience he still thinks about, what makes it unforgettable for him.`

  const continueBlock = !heWentSexualEarlier ? '' : `
HE STEERED THIS CHAT SEXUAL EARLIER - SHE MAY CONTINUE, NEVER LEAD:
Sexual talk is allowed here because HE started it. She does not need to redirect and does not need to force it either. She follows his lead naturally, stays on topics he has raised, and never introduces a new sexual act or scenario of her own.
${curiosityIdeas}
`

  const noSexualBlock = sexualAllowed ? '' : `
GREEN CHAT RULE - NEVER START, ONLY CONTINUE:
He has not brought up anything sexual in this conversation. She must NOT introduce sexual topics, innuendo, body references or sexual questions. Her flirting stays romantic, teasing and emotional: chemistry, curiosity, attraction to who he is. If he raises it himself later she may follow his lead, but she never goes first.
`

  const platformBlock = `PLATFORM QUALITY STANDARDS (operators are reviewed daily on these):
1. Every reply ends with ONE strong call to action: a single question he cannot answer in one word. One strong question beats several small ones.
2. She answers every question he asked, personally and specifically.
3. Where it fits, she gives one sincere, specific compliment about something he actually said or shared. Not looks cliches.
4. She never repeats a question, angle or compliment already used earlier in the history.
5. If he mentions a specific reference (a show, place, slang, event) she responds to it knowingly. If she would not recognise it, she responds to the feeling behind it and asks him about it. She never fakes knowledge.
6. Be exciting and specific. Anything that could be sent to any man is a failure.`

  const humanBlock = `SOUNDING UNMISTAKABLY HUMAN - THE TEST EVERY REPLY MUST PASS:
Imagine a stranger reading it beside 50 AI replies. If it could be one of them, rewrite it.
- The 4 replies must differ in rhythm and structure (every reply stays inside the LENGTH rule at the end of this prompt). Never open two replies with the same word or shape. Never give all four the same "observation, then question" template.
- She writes like a woman actually texting: contractions, a fragment now and then, a thought that trails, a small opinion stated flatly. Nothing polished to death.
- Concrete beats abstract. A tiny believable detail (an object, a place, a habit, a half-memory) is worth more than any adjective.
- One idea per reply, then the single question. No wrap-up line that neatly explains her own feelings.
- Banned AI tells: "I can't help but", "genuinely" or "honestly" more than once across the whole set, "it's not X, it's Y" constructions, three adjectives in a row, "that says a lot about you", "I'm still thinking about", "most people would have", "most guys", "there's something about", "you have a way of", "I love how", "that's rare", and stacked rhetorical questions.
- Compliments are specific to something he said. Never "handsome", "cute", "sweet" or "amazing" standing alone.`

  const hasQuestions = questionsToAnswer.length > 0
  const multiQ = hasQuestions
    ? `HE HAS ASKED THE FOLLOWING — she must address ALL of them naturally before her CTA:
${questionsToAnswer.map((q, i) => (i + 1) + '. ' + q).join('\n')}

CRITICAL: She answers these questions as a real woman would — personally, specifically, with her own perspective and a detail that only she would give. Not a list. Woven naturally into her reply.
After answering — her CTA must grow directly from ONE of his questions, going deeper into that same topic. She does not pivot to something new after answering him. She picks the most interesting question he asked and pulls him deeper into it.
`
    : ''

  const avoidNote = previousTones.length
    ? `REGENERATION - tones already shown, pick completely different ones AND completely different angles. Different energy, different emotional register, different first word: ${previousTones.join(', ')}`
    : ''

  const jsonInstruction = (noQuestion || sleepy)
    ? '{"replies":[{"tone":"Tone1","body":"short reaction to him","cta":"closing call to action"},{"tone":"Tone2","body":"...","cta":"..."},{"tone":"Tone3","body":"...","cta":"..."},{"tone":"Tone4","body":"...","cta":"..."}]}'
    : '{"replies":[{"tone":"Tone1","body":"short reaction to him","question":"closing question ending with ?"},{"tone":"Tone2","body":"...","question":"..."},{"tone":"Tone3","body":"...","question":"..."},{"tone":"Tone4","body":"...","question":"..."}]}'

  const careBlock = [
    'HE MUST FEEL SEEN, HEARD AND CARED FOR IN EVERY REPLY. THIS IS THE FIRST PRIORITY:',
    '1. Every question he asked is answered personally, inside the body, before the closing question. Never leave one unanswered.',
    '2. Read the feeling under his words (tired, lonely, excited, unsure, teasing, hungry for attention) and answer THAT feeling in her own words in the first sentence, then the facts.',
    '3. Match his tone. Playful with playful, tender with tender, plain with plain, heated with heated (only as far as the rules below allow). Never colder or more formal than he is.',
    '4. If his message is long or holds several concerns, each concern gets its own short, real response in his order. Nothing he cared about is skipped.',
    '5. She shows care through a specific detail he gave her, never by announcing it. "I care about you" and "I am here for you" are banned.',
  ].join('\n')

  return [
    'You are writing 4 reply options for a real woman chatting with a man she finds genuinely interesting.',
    '',
    'WHO SHE IS: a WOMAN writing to a MAN. Warm, naturally funny, confident, comfortable with desire, never desperate and never the pursuer. She texts like a real person: contractions, short sentences, an occasional fragment, one small opinion stated plainly. Wit comes from something in HIS message, and never when he is hurting.',
    '',
    'LANGUAGE: ' + engNote,
    nameNote,
    '',
    careBlock,
    '',
    platformBlock,
    '',
    historyNote,
    localContext,
    multiQ,
    photoBlock,
    griefBlock,
    vulnerableBlock,
    meetupBlock,
    contactBlock,
    eroticBlock,
    continueBlock,
    noSexualBlock,
    '',
    'HIS MESSAGE: "' + message + '"',
    '',
    'PUNCTUATION AND STYLE:',
    "Contractions always. One exclamation mark at most. No em dashes, en dashes or spaced hyphens used as dashes. No semicolons, no ellipses, no asterisks, no *actions*. Use a period for a full stop and a comma for a pause, the way people really text.",
    'She never echoes his exact words back. She responds to the idea and the feeling behind them.',
    '',
    humanBlock,
    '',
    'THE CLOSING CALL TO ACTION:',
    'It grows straight out of what he is talking about right now and never changes the subject. It cannot be answered with one word, and it makes him want to reply: it asks him to feel, explain or reveal something, or it opens a small loop only he can close. Use a different mechanic in each of the 4 replies (a specific challenge, a mirror of his energy, a small reveal then asking his side, an open loop, a vulnerable pull, or, only if he already made the chat sexual, one step further that leaves the next move to him).',
    'Banned: "What is going on in your world", "Tell me something unexpected", "What are you thinking", "Your turn", "Be honest with me", any question that would work in a different conversation.',
    '',
    avoidNote,
    ...(sleepy ? [
      'SLEEP MODE - HE IS GOING TO SLEEP OR IS TIRED. Tone the conversation down instead of advancing it, as set out in the SLEEP MODE block below. Put the gentle closing hook in the "cta" field. It may be a light statement or a soft easy question.',
    ] : noQuestion ? [
      'NO-QUESTION MODE - HE HAS JUST COMPLAINED ABOUT TOO MANY QUESTIONS. THIS OVERRIDES EVERY RULE ABOUT CLOSING QUESTIONS.',
      'There is NO question mark anywhere in any reply. Every reply ends with a period or an exclamation mark.',
      'The body owns it lightly in a few words, with a smile and no grovelling, then reacts to what he actually said.',
      'The closing line is still a strong call to action written as a statement he feels pulled to answer. Put it in the "cta" field. Use a different mechanic in each reply: a playful dare, a trade ("I will tell you mine if you tell me yours"), a bold guess he will want to correct, a finish-the-sentence prompt, or an open loop she pays off if he answers. Each names something specific from his messages. Never a polite request for information in disguise, like "Tell me about your day."',
    ] : [
      'EVERY REPLY ENDS WITH ONE CLOSING CALL TO ACTION. Put it in the "question" field. If space is tight, shorten the body, never the closing line. The "body" is her reaction and her answers to what he asked, and it contains no question. A reply with no closing call to action is a failed reply.',
      'MIX THE FORM so it never feels like an interview. In the 4 replies, exactly 2 or 3 closings are INVITATIONS written as warm requests ending in a period, and the rest are questions ending in a question mark. Invitations start with words like: "Describe", "Paint me a picture of", "Walk me through", "Tell me about the moment", "I would like to know more about", "I want to hear how", "Show me what", "Take me back to", "Give me the story behind". An invitation names something specific from his message and asks for a scene, a feeling or a story, so it cannot be answered in one word. Never a bare "Tell me more" and never "Tell me about your day".',
    ]),
    '',
    'ORDER: most irresistible and human reply first.',
    'TONES - pick 4 from: ' + (sexualAllowed ? 'Warm, Flirty, Confident, Playful, Empathetic, Teasing, Direct, Curious, Vulnerable, Spicy, Naughty' : 'Warm, Flirty, Confident, Playful, Empathetic, Teasing, Direct, Curious, Vulnerable (NEVER Spicy or Naughty in this chat)'),
    clientType && CLIENT_TYPE_HINTS[clientType]
      ? 'TONE BIAS (soft preference only, the grief, vulnerable, erotic, meetup and contact rules above always win): ' + CLIENT_TYPE_HINTS[clientType]
      : '',
    '',
    thread,
    '',
    BODY_QUALITY,
    '',
    lengthBudgetBlock(tier, noQuestion, sleepy),
    '',
    'Return ONLY valid JSON, no markdown, no explanation:',
    jsonInstruction,
  ].filter(Boolean).join('\n')
}

function isCompleteSentence(text: string): boolean {
  return /[.?!]["')\]]*$/.test(text.trim().replace(TRAIL_EMOJI, ''))
}

// Like splitClosing, but for no-question mode: the closing call to action is the last sentence.
function splitLastSentence(text: string): { lead: string; closing: string } | null {
  const t = text.trim()
  const m = t.match(/^([\s\S]*[.!]["')\]]?\s+)([^.!]+[.!]["')\]]?)$/)
  if (!m) return null
  return { lead: m[1].trim(), closing: m[2].trim() }
}

// Catches replies where the model dropped a word or left a thought hanging, which a plain
// length or punctuation check cannot see.
function hasBrokenSyntax(text: string): boolean {
  const t = text.trim()
  // Doubled small words: "the the", "and and"
  if (/\b(the|a|an|of|and|but|or|with)\s+\1\b/i.test(t)) return true
  // A sentence that stops on a word that cannot end one: "...in a picture of?" "...and". Words that can end a real question ("to", "with", "that", "so") are not on this list.
  if (/\b(the|a|an|of|and|but|your|my|our|their)\s*[.!?]["')\]]?(\s|$)/i.test(t)) return true
  // Article followed directly by a pronoun and verb: "describe the you want", "a I would"
  if (/\b(the|a|an)\s+(you|i|we|they|he|she)\s+(want|wanna|need|would|are|were|have|had|do|did|can|could|will|am)\b/i.test(t)) return true
  // "to" followed by a conjugated verb pronoun pair, e.g. "to you want"
  if (/\bto\s+(you|i|we|they)\s+(want|need|would|are|were|have|had|do|did|can|could|will|am)\b/i.test(t)) return true
  // A short fragment sentence that is just a subject + verb with nothing after, followed by a capital word:
  // "Ordering photos feels. Formal"
  if (/(^|[.!?]\s)(\w+\s){1,3}(feels?|seems?|looks?|sounds?)\.\s+[A-Z]/.test(t)) return true
  return false
}

function lengthCap(tier: LengthTier, roomy: boolean): number {
  return tier.max + (roomy ? 80 : 30)
}

function postProcess(replies: Array<{tone: string, text: string}>, isMeetupContext: boolean = false, tier: LengthTier = LENGTH_TIERS.long, noQuestion: boolean = false, sleepy: boolean = false, roomy: boolean = false, collect?: { long: Array<{tone: string, text: string}>, short: Array<{tone: string, text: string}> }): Array<{tone: string, text: string}> {
  // The tier maximum is the target. Going past it is allowed when the chat truly needs the room
  // (explaining, several points to answer, a heavy moment), and in the relaxed pass. Beyond that, a reply is dropped.
  const capMax = lengthCap(tier, roomy)
  const mapped = replies.map((r) => {
    let text = (r.text || '').trim()

    // Safety net behind the "no em dash, no asterisk" prompt rule — models sometimes
    // revert to these regardless of instruction, so clean them here as a guarantee.
    // Asterisk-wrapped action/emphasis text (e.g. *smiles*, *really*) gets removed
    // entirely, since it usually reads as a stage direction rather than something
    // she'd actually type. Any stray asterisk left over is stripped outright.
    text = text.replace(/\*[^*]{1,40}\*/g, '').replace(/\*/g, '')
    // Em dash becomes a period when followed by a capital letter (it was doing the
    // job of a sentence break), otherwise a comma (it was doing the job of a pause).
    text = text.replace(/\s*—\s*/g, (match, offset) => (/[A-Z]/.test(text.charAt(offset + match.length)) ? '. ' : ', '))
    // En dashes and hyphens used as dashes (" - ", "--") read the same as em dashes, so they get the same treatment.
    text = text.replace(/\s*(?:–|--+)\s*|\s+-\s+/g, (match, offset) => (/[A-Z]/.test(text.charAt(offset + match.length)) ? '. ' : ', '))
    // Ellipses. After ? or ! they just go. Before a lowercase word the sentence simply continues
    // (turning that into a full stop would split one sentence into two fragments). Before a capital
    // letter it becomes a full stop. At the end it becomes a full stop.
    text = text.replace(/([?!])\s*(?:\.{2,}|…)/g, '$1')
    text = text.replace(/\s*(?:\.{2,}|…)\s*/g, (match, offset) => {
      const next = text.charAt(offset + match.length)
      if (!next) return '.'
      return /[a-z]/.test(next) ? ' ' : '. '
    })
    text = text.replace(/,\s*([.!?])/g, '$1').replace(/\.\s*\./g, '.').replace(/\s{2,}/g, ' ').trim()

    const isNaughty = /naughty|spicy/i.test(r.tone || '')
    if (!isNaughty) {
      text = text
        .replace(/[,.]?\s*be honest with me\.?\s*$/i, '')
        .replace(/[,.]?\s*show me your fantasies\.?\s*$/i, '')
        .replace(/[,.]?\s*let'?s keep this going\.?\s*$/i, '')
        .replace(/[,.]?\s*i feel like we have a connection\.?\s*$/i, '')
      text = text.trim().replace(/[,\s]+$/, '').trim()
    } else {
      text = text.trim()
    }
    if (text.length > 0) text = text.charAt(0).toUpperCase() + text.slice(1)

    // Real commitments only. Blunt promises to meet or share contact details are dropped in any context.
    const madePromise = /\b(i'?ll meet you|i'?ll see you|i can come over|here'?s my (number|whatsapp|insta|instagram|snap|snapchat|telegram)|my (number|whatsapp|insta|instagram|snap|snapchat|telegram) is|call me at|i'?ll give you my (number|whatsapp)|add me on|my address is|text me at)\b/i.test(text)

    // Softer commitments are checked only when he asked to get together. Words like "soon" or "one day" on their own
    // are fine in ordinary talk, so only phrases that agree to a plan, a day or a "when we..." are caught.
    const softPromise = isMeetupContext && (
      /\b(let'?s|we should|we could|we can|we will|we'?ll) (get together|meet|see each other|plan|set (it|something) up|make (it|that) happen|do it)\b/i.test(text) ||
      /\bwhen we (get together|meet|see each other|finally)\b/i.test(text) ||
      /\b(see|meet) you (soon|tomorrow|tonight|then|on|this|next|there)\b/i.test(text) ||
      /\bcan'?t wait to (meet|see you|get together)\b/i.test(text) ||
      /\bi'?d love to (meet|see you|get together)\b|\bi would love to (meet|see you|get together)\b/i.test(text) ||
      /\b(one day|someday|some day) (we|i'?ll|soon)\b|\bnext time we\b/i.test(text) ||
      /\bwhen i'?m free\b|\bwhen i am free\b|\bwhen things (settle|calm)\b|\bwhen the time is right\b|\bwhen i know you better\b|\bi promise\b|\bcount me in\b|\bi'?m in[.!,]/i.test(text) ||
      /\b(sounds|works) (good|great|lovely|perfect|like a plan)\b/i.test(text) ||
      // The words meet, meeting and meet up are not used for this topic. "Getting together" is.
      /\b(meet ?ups?|meeting|meet up)\b|\bmeet (you|him|in person)\b/i.test(text)
    )

    // A reply that promises a meetup or contact details is dropped, not swapped for canned text.
    if (madePromise || softPromise) return { tone: r.tone || 'Reply', text: '' }

    text = text.replace(/^(that sounds amazing|how sweet|i love that|wow that's|aww+|oh wow|that is so (sweet|nice|cool|amazing)|that's so (sweet|nice|cool|amazing))[,!.]?\s*/i, '')
    if (text.length > 0) text = text.charAt(0).toUpperCase() + text.slice(1)

    if (!isCompleteSentence(text)) {
      const lp = Math.max(text.lastIndexOf('?'), text.lastIndexOf('.'), text.lastIndexOf('!'))
      if (lp > 30) text = text.substring(0, lp + 1).trim()
      else return { tone: r.tone || 'Reply', text: '' }
    }

    // 75 character minimum is enforced by the filter below. Short replies are dropped
    // (and topped up by the retry in POST) instead of padded with identical stock sentences.

    return { tone: r.tone || 'Reply', text }
  })
  // Length is handled below. A reply that is the wrong size but otherwise sound is handed to the caller
  // (collect), who rewrites it to fit instead of throwing it away or showing it too long.
  const out: Array<{tone: string, text: string}> = []
  for (const r of mapped) {
    if (!r.text) continue
    const sound = !hasBrokenSyntax(r.text) && !hasDroppedWordArtifact(r.text) && (
      sleepy ? /[.!?]["')\]]*$/.test(r.text.replace(TRAIL_EMOJI, ''))
      : noQuestion ? (!r.text.includes('?') && /[.!]["')\]]*$/.test(r.text.replace(TRAIL_EMOJI, '')))
      : (hasCTA(r.text) && (r.text.match(/\?/g) || []).length <= 2)
    )
    if (!sound) continue
    if (r.text.length > capMax) { collect?.long.push(r); continue }
    if (r.text.length < tier.min) { if (r.text.length >= 30) collect?.short.push(r); continue }
    out.push(r)
  }
  return out
}

// Detects a specific, mechanical signature of a word having been silently dropped
// mid-sentence — most commonly seen when a model self-censors a single explicit word
// but still completes the surrounding sentence and punctuation. English never puts a
// space directly before terminal punctuation, so "actually ?" or "hard ." is a
// reliable tell regardless of topic. This is a pure grammar check, not a content
// filter — it fires the same way on any topic. Deliberately does NOT flag "..." since
// ellipses are cleaned out earlier in postProcess.
function hasDroppedWordArtifact(text: string): boolean {
  const spaceBeforePeriod = /\s\.(?!\.)/.test(text) // excludes " ..." (spaced ellipsis)
  const spaceBeforeOther = /\s[?!,]/.test(text)
  return spaceBeforePeriod || spaceBeforeOther || /,\s*,/.test(text)
}

// Last resort when the rewrite call fails: keep the closing line, and from her first sentence keep as many
// whole clauses as fit, so the reply still reads as complete.
function compressLocally(text: string, cap: number, min: number): string {
  const sentences = text.match(/[^.!?]+[.!?]+["')\]]*\s*/g)
  if (!sentences || sentences.length < 2) return ''
  const closing = sentences[sentences.length - 1].trim()
  const first = sentences[0].trim().replace(/[.!?]+["')\]]*$/, '')
  const clauses = first.split(/,\s+/)
  let best = ''
  for (let k = 1; k <= clauses.length; k++) {
    const candidate = (clauses.slice(0, k).join(', ') + '. ' + closing).trim()
    if (candidate.length <= cap) best = candidate
    else break
  }
  return best.length >= min ? best : ''
}

// Says why replies were thrown away, so an empty result can be traced in the logs.
function diagnoseDrops(parsed: Array<{tone: string, text: string}>, tier: LengthTier): string {
  const c = { parsed: parsed.length, short: 0, long: 0, noQuestion: 0, broken: 0, artifact: 0 }
  for (const r of parsed) {
    const t = (r.text || '').trim()
    if (t.length < tier.min) c.short++
    if (t.length > lengthCap(tier, false)) c.long++
    if (!endsWithQuestion(t)) c.noQuestion++
    if (hasBrokenSyntax(t)) c.broken++
    if (hasDroppedWordArtifact(t)) c.artifact++
  }
  return JSON.stringify(c)
}

function mergeUnique(target: Array<{tone: string, text: string}>, extra: Array<{tone: string, text: string}>, max: number = 4) {
  const seen = new Set(target.map(r => r.text))
  for (const r of extra) {
    if (target.length >= max) break
    if (!seen.has(r.text)) { target.push(r); seen.add(r.text) }
  }
}

export async function POST(req: Request) {
  const reqStart = Date.now()
  const headers = cors()
  try {
    const body = await req.json()
    const message = ((body.message || '') + '').replace(/[\x00-\x1F\x7F-\x9F]/g, ' ').trim()
    const pageContext = body.pageContext || {}
    // Keep more context — prioritise recent messages, they matter most
    const fullContext = (pageContext.conversationSummary || '').toString()
    // If over limit, keep the end (most recent) not the beginning
    const context = fullContext.length > 6000
      ? '...[earlier messages]...\n' + fullContext.slice(-5600)
      : fullContext
    const questionsToAnswer: string[] = Array.isArray(pageContext.questionsToAnswer) ? pageContext.questionsToAnswer as string[] : []
    const previousTones = Array.isArray(body.previousTones) ? body.previousTones : []
    const englishVariety = (body.englishVariety || 'AmEng').toString()
    const myName = body.myName ? body.myName.toString() : null

    if (!message) return NextResponse.json({ error: 'Message is required', replies: [] }, { status: 400, headers })

    let userPlan = 'pro'
    const apiKey = req.headers.get('X-API-Key') || req.headers.get('x-api-key') || ''
    if (apiKey.startsWith('trial_')) userPlan = 'trial'
    else if (apiKey.startsWith('basic_')) userPlan = 'basic'

    if (message === 'REENGAGE_ANALYSIS') {
      const rp = [
        'A woman needs 3 short re-engagement messages (50-150 chars) for a man who went quiet.',
        'Conversation: ' + (context || 'No history'),
        '1. References something specific from their chat',
        '2. Creates curiosity or mystery',
        '3. Warm gentle callback',
        'Return ONLY valid JSON: {"analysis":"why he went quiet","triggers":[{"label":"l","text":"t"},{"label":"l","text":"t"},{"label":"l","text":"t"}]}',
      ].join('\n')
      const raw = (await generate(rp, { deadline: reqStart + 45000 })).text
      try {
        const clean = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
        const parsed = JSON.parse(clean)
        return NextResponse.json({ replies: (parsed.triggers || []).map((t: any) => ({ tone: t.label, text: t.text })), analysis: parsed.analysis || '', isReengage: true }, { headers })
      } catch {
        return NextResponse.json({ replies: [{ tone: 'Trigger', text: raw.substring(0, 150) }], analysis: '', isReengage: true }, { headers })
      }
    }

    const clientType = detectClientType(context, message)
    // Same detection buildPrompt uses internally — computed here too so postProcess
    // knows whether to apply the stricter soft-promise check.
    const isMeetupContext = MEETUP_RE.test(message)
    // Sexual chats route to the Groq chain that is less likely to refuse. Everything else uses the quality chain.
    const sexualRoute = heHasGoneSexual(context, message)
    let localContext = ''
    try { localContext = await getLocalContext(context, message) } catch { /* local context is optional */ }
    let tier = getLengthTier(message)
    // An explanation needs room, so a short confused message does not get a one-liner.
    if (detectConfusion(message) && tier.name === 'short') tier = LENGTH_TIERS.medium
    const sleepy = detectSleepy(context, message)
    // Moments that genuinely need more than the usual number of characters.
    const needsRoom = !sleepy && (detectConfusion(message) || detectCareFirst(message) || detectOrderTopic(context, message) || tier.name === 'sensitive')
    const noQuestion = !sleepy && detectQuestionFatigue(context, message)
    const prompt = buildPrompt(message, context, userPlan, previousTones, englishVariety, myName, questionsToAnswer, clientType, localContext, tier, buildThreadBlock(context, noQuestion, sleepy, message), noQuestion, sleepy)

    // Vercel kills the function at maxDuration (60s). Stop trying well before that.
    const deadline = reqStart + 45000
    const first = await generate(prompt, { sexual: sexualRoute, deadline })
    // No raw-text fallback: if the output can't be parsed, nothing is shown rather than junk or a refusal message.
    const parsedFirst = parseReplies(cleanLLM(first.text))
    const allParsed = [...parsedFirst]
    const collect = { long: [] as Array<{tone: string, text: string}>, short: [] as Array<{tone: string, text: string}> }
    let finalReplies = postProcess(parsedFirst, isMeetupContext, tier, noQuestion, sleepy, needsRoom, collect)

    // Over-long replies are trimmed locally (no extra AI call). Replies under the minimum are never padded.
    if (finalReplies.length < 4 && collect.long.length) {
      const local = collect.long
        .map(r => ({ tone: r.tone, text: compressLocally(r.text, lengthCap(tier, needsRoom), tier.min) }))
        .filter(r => r.text)
      mergeUnique(finalReplies, postProcess(local, isMeetupContext, tier, noQuestion, sleepy, needsRoom))
    }

    // A full second generation is the slowest thing the route can do, so it only happens when nothing at all is usable.
    if (finalReplies.length < 2 && deadline - Date.now() > 18000) {
      try {
        const retry = await generate(prompt, {
          sexual: sexualRoute,
          deadline,
          avoid: first.model.startsWith('anthropic') ? ['anthropic'] : [],
        })
        const parsedRetry = parseReplies(cleanLLM(retry.text))
        allParsed.push(...parsedRetry)
        const collect2 = { long: [] as Array<{tone: string, text: string}>, short: [] as Array<{tone: string, text: string}> }
        mergeUnique(finalReplies, postProcess(parsedRetry, isMeetupContext, tier, noQuestion, sleepy, needsRoom, collect2))
        if (finalReplies.length < 4 && collect2.long.length) {
          const local2 = collect2.long
            .map(r => ({ tone: r.tone, text: compressLocally(r.text, lengthCap(tier, needsRoom), tier.min) }))
            .filter(r => r.text)
          mergeUnique(finalReplies, postProcess(local2, isMeetupContext, tier, noQuestion, sleepy, needsRoom))
        }
      } catch {
        // Retry failed. Fall through to the error below.
      }
    }

    console.log('[CIC] lengths | tier', tier.name, '| raw', JSON.stringify(parsedFirst.map(r => (r.text || '').length)), '| final', JSON.stringify(finalReplies.map(r => r.text.length)))

    if (!finalReplies.length) {
      const diag = diagnoseDrops(allParsed, tier)
      console.error('[CIC] Empty result:', JSON.stringify({
        drops: diag, rawStart: String(first.text || '').slice(0, 160), tier: tier.name, noQuestion, sleepy, sexualRoute,
        model: first.model, ms: Date.now() - reqStart,
      }))
      return NextResponse.json({ error: 'Could not produce a clean set of replies. Tap Generate again. [' + first.model + ' ' + diag + ']', replies: [], remaining: 999 }, { status: 200, headers })
    }

    const elapsedMs = Date.now() - reqStart
    console.log('[CIC] Done in', elapsedMs, 'ms |', first.model, '|', finalReplies.length, 'replies | tier', tier.name, '| sexual', sexualRoute, '| noQ', noQuestion, '| sleepy', sleepy)
    const notice = detectOrderTopic(context, message)
      ? 'He mentions an order, payment or something he is waiting for. Check the order log on the platform and answer him honestly before you send anything.'
      : ''
    return NextResponse.json({ replies: finalReplies, remaining: 999, plan: userPlan, modelUsed: first.model, elapsedMs, notice }, { headers })

  } catch (error: any) {
    const errMsg = error?.message || 'Generation failed'
    console.error('[CIC] Error:', errMsg)
    // Return a soft fallback so the operator sees something rather than nothing
    const isRateLimit = errMsg.includes('Rate limit') || errMsg.includes('429') || errMsg.includes('All providers failed')
    if (isRateLimit) {
      return NextResponse.json({
        error: 'All AI providers are busy right now. Please wait 30 seconds and try again.',
        replies: [],
        remaining: 999,
        retryAfter: 30
      }, { status: 200, headers })
    }
    return NextResponse.json({ error: errMsg, replies: [], remaining: 999 }, { status: 200, headers })
  }
}
