// CIC generate route v12.5.0 - speed rebuild
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
    version: 'v12.5.0'
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
    // gpt-oss is the most safety-tuned of these and tends to refuse or silently drop
    // explicit words, so it goes last for sexual messages and first for everything else.
    const groqModels = opts.fast
      ? ['llama-3.3-70b-versatile', 'meta-llama/llama-4-maverick-17b-128e-instruct']
      : opts.sexual
      ? [
          'llama-3.3-70b-versatile',
          'meta-llama/llama-4-maverick-17b-128e-instruct',
          'openai/gpt-oss-120b',
        ]
      : [
          'openai/gpt-oss-120b',
          'meta-llama/llama-4-maverick-17b-128e-instruct',
          'llama-3.3-70b-versatile',
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
    const won = await raceStaggered(tasks, 3500, cap(18000), errors)
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
  short: { name: 'short', min: 75, max: 90, body: '38 to 45', q: '38 to 45', note: 'He wrote very little. She keeps it tight: one short, warm sentence that reacts to the single most important thing he said, then the closing question.' },
  medium: { name: 'medium', min: 80, max: 180, body: '80 to 105', q: '50 to 70', note: 'He wrote a normal-length message. She replies in about two sentences that cover what he said, then the closing question.' },
  long: { name: 'long', min: 110, max: 250, body: '130 to 160', q: '60 to 85', note: 'He wrote a lot. She answers each thing he shared compactly, in his order, with a specific detail or reaction for each, then the closing question.' },
  sensitive: { name: 'sensitive', min: 100, max: 250, body: '130 to 160', q: '60 to 85', note: 'This is an important moment in the chat. She handles it carefully and plainly, and still finishes with the one closing question.' },
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
  return /^(tell me|describe|show me|share|walk me|give me|finish|take me|so tell me)\b/i.test(last)
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
  const lines = [
    'LENGTH BUDGET - THIS DECIDES THE SIZE OF EVERY REPLY AND WINS OVER ANY RULE ABOVE THAT SEEMS TO NEED MORE ROOM:',
    tier.note,
    `"body": ${tier.body} characters. "${qField}": ${tier.q} characters. Together at least ${tier.min + 8} characters (the platform rejects anything under ${tier.min}) and about ${tier.max} or fewer.`,
    'Fit the content to the budget, never the budget to the content. Choose the single most important detail and say it well. Count the characters of the body and of the ' + qField + ' separately before you answer.',
    'Go past the budget only when it is truly necessary (explaining something he did not understand, answering several of his points, a heavy moment), and then only by as much as needed. Never cut a thought short and never stop mid-sentence just to hit a number.',
  ]
  if (tier.name === 'short' && !sleepy) {
    lines.push(
      'SHORT MODE: he wrote very little, so this overrides the three-step body, the point-by-point rule and the length-variety rule above. The body is ONE short sentence of real reaction to the one most important thing he said. No second sentence in the body unless it is under six words. One idea only. The ' + qField + ' is one short, specific, easy-to-answer ' + (noQuestion ? 'statement' : 'question') + '. Still warm, still human, still unmistakably about him.'
    )
  }
  return lines.join('\n')
}

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
  const isMeetup = /\b(meet(\s*up)?|come over|your place|my place|hotel|in person|see you|tonight|come round)\b/i.test(message)
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
HE WANTS TO MEET — THIS IS ONE OF THE MOST IMPORTANT MOMENTS IN THE CONVERSATION:
She handles this with warmth, intelligence, and zero awkwardness. No scripts. No walls. No flat "no."
The goal: he ends the exchange feeling MORE interested in her, not rejected — and NOT strung along with a fake promise.

THE SHAPE EVERY REPLY MUST FOLLOW: APPRECIATE, EXPLAIN, THEN PIVOT.
Step 1 — Genuine enthusiasm first. She reacts to the IDEA of meeting him the way she'd react to any exciting idea — warm, a little delighted, flattered he asked. Not a polite acknowledgment. Real warmth.
Step 2 — One natural, believable reason, woven in lightly. Not a flat rejection with no explanation (that reads as cold and evasive), and not a scheduling excuse tied to a timeframe (that reads as a promise to reschedule). The reason is about WHO SHE IS, not about her calendar. Pick from the list below or something equivalent.
Step 3 — A witty, specific pivot that grows out of THIS conversation, so it reads as her genuinely getting swept up in talking to him, not dodging the question.

REAL, NATURAL REASONS SHE CAN DRAW ON (character-based, not calendar-based):
1. She has been burned before by moving too fast with someone she met online, so she takes her time now — not dramatic, just a lesson she learned.
2. She connects better without the pressure of an in-person meet hanging over the conversation — it changes how she talks to someone.
3. She is genuinely enjoying getting to know him through talking first, and does not want to rush past that part.
4. She is just wired to want to really know someone before meeting them in person — old-fashioned about it, and not embarrassed by that.
These are HER general nature, not "not this week" — she is not implying she will be ready next week, next month, or once she is less busy. The reason stands on its own, with no expiry date attached.

She has FOUR techniques available. She picks the one that fits best for this conversation:

TECHNIQUE 1 — ACKNOWLEDGE, EXPLAIN, AND REDIRECT:
She reacts with real warmth to the idea, gives one light natural reason, then pivots to something she genuinely wants to ask him.
Example energy: "Okay, I will not lie, I like that you just said that out loud. But I have learned the hard way that I connect better when there is no meetup hanging over the conversation. Which reminds me, I have been wanting to ask you something..."
The something she asks must be specific to what he has shared in this conversation, not a generic question.

TECHNIQUE 2 — GUIDE TO SOMETHING LIGHTER:
She lights up at the idea, gives her reason with a soft touch, and steers toward something playful or curious.
Example energy: "That is exactly the kind of thing that gets stuck in my head for the rest of the day. I am just someone who likes to really know a person first though, call it old fashioned. Since I have got your attention now, what is your worst first-date story?"
The follow-up question must feel light and specific, not like a consolation prize.

TECHNIQUE 3 — HUMOUR AND PIVOT:
She uses wit to deliver her reason so it lands as charming rather than a rejection, then pivots to something new.
Example energy: "You really just said that like it is a normal Tuesday thing to say. I respect the confidence, but I have been burned before rushing that part, so we are doing this the slow way. Now tell me, was that the smoothest thing you have ever said to someone or do you have better material?"
The humour must feel natural to HER voice, not forced. And the pivot must connect to something real in their chat.

TECHNIQUE 4 — EXPRESS GRATITUDE, EXPLAIN, AND SHIFT:
She receives his ask with real, specific delight, gives her reason honestly, then moves the conversation forward.
Example energy: "I am not going to pretend that did not just make me smile at my phone like an idiot. I just like to get to know someone properly before any of that though. Okay, since we are being direct, I want to know..."
The shift must feel like she is drawing him closer in a different direction, not closing a door.

RULES FOR ALL FOUR TECHNIQUES:
She NEVER says she is private about her location.
She NEVER says she cannot meet people from the internet.
She NEVER gives a flat "no" or a bare deflection with no reason attached — that reads as cold or evasive.
She NEVER frames her reason as a scheduling conflict ("this week is packed," "not the best time," "so busy right now") — that specifically implies she WOULD say yes with better timing, which is a disguised promise.
She NEVER promises anything about the future — no "soon," "one day," "when I know you better," "let's see," "when things calm down," no day of the week, no timeframe of any kind.
Her reason is about her own nature or past experience, never about circumstances that could change by next week.
The redirect question or pivot must come from something real in this conversation — not a generic topic change.
She makes him feel she WANTS to keep talking — because she does — and that his ask genuinely landed with her, even though she is not confirming anything.
`

  const contactBlock = !isContact ? '' : `
HE WANTS TO CALL, TEXT, OR EXCHANGE CONTACT DETAILS:
This is a critical moment. She handles it with warmth and genuine feeling, not a script.

She does NOT:
- Give her number, WhatsApp, Instagram, Snapchat, email or any contact detail
- Promise a phone call, FaceTime, or video call
- Say maybe later or someday - too vague and dismissive
- Sound paranoid or scared about sharing details

She DOES:
- Acknowledge genuinely that she understands why he wants this - it is a natural feeling
- Give one real, warm, believable reason why she is not there yet
- Make him feel she WANTS to get there, she just needs to feel more certain first
- Turn it into something that makes HIM feel valued - she takes her time because she cares

Real reasons she can draw from naturally:
1. She has been burned before by moving too fast - not dramatically, just a lesson she learned
2. She finds she connects better when there is no pressure - the phone changes the dynamic
3. She wants to be sure this is real before she opens that door - and it is starting to feel real
4. She is old fashioned that way - she likes to really know someone first

After the reason: she redirects with something that deepens THIS conversation right now.
She makes him feel that earning her number is something worth doing.
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
3. Every reply carries one sincere, specific compliment about something he actually said or shared. Not looks clichés.
4. She never repeats a question, angle or compliment already used earlier in the history.
5. If he mentions a specific reference (a show, place, slang, event) she responds to it knowingly. If she would not recognise it, she responds to the feeling behind it and asks him about it. She never fakes knowledge.
6. Be exciting and specific. Anything that could be sent to any man is a failure.`

  const humanBlock = `SOUNDING UNMISTAKABLY HUMAN - THE TEST EVERY REPLY MUST PASS:
Imagine a stranger reading it beside 50 AI replies. If it could be one of them, rewrite it.
- The 4 replies must differ in rhythm and structure (every reply stays inside the LENGTH BUDGET at the end of this prompt). Never open two replies with the same word or shape. Never give all four the same "observation, then question" template.
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

  return [
    'You are writing 4 reply options for a real woman chatting with a man she finds genuinely interesting.',
    '',
    'WHO SHE IS - THIS DEFINES EVERY SINGLE WORD SHE WRITES:',
    'She is a WOMAN writing to a MAN. Every sentence sounds like it comes from a woman.',
    'She is genuinely funny. Not trying-to-be-funny funny. Actually funny.',
    'She finds the absurd thing in an ordinary moment and names it before anyone else does.',
    'She can make a joke out of nothing - a word choice, an implication, a tiny contradiction in what he said.',
    'Her humour is warm, sharp, and never mean. She laughs WITH people, never AT them.',
    'She uses wit to flirt, to deflect, to show she is paying attention, to break tension.',
    'A single well-placed funny line makes him feel more seen than a paragraph of warmth.',
    'She is also deeply warm. When something real is happening she is fully present.',
    'She values herself completely and does not chase. Comfortable with desire, not embarrassed.',
    'She pays attention to details other people miss. She makes people feel genuinely seen.',
    'She is engaged and real. Not performing. Not scripted. Not a chatbot.',
    'She never uses language a man would use. She is never the pursuer.',
    '',
    'LANGUAGE: ' + engNote,
    nameNote,
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
    'BEFORE WRITING - answer these internally:',
    '1. Is he sharing grief or loss? If YES - warmth and presence FIRST.',
    '2. Has he paid her a compliment? If YES - she receives it warmly and specifically before moving on.',
    '3. Is he sharing something emotional, heartfelt, or vulnerable? If YES - acknowledge it genuinely first.',
    '4. Is he being sexual or erotic? If YES - match his energy and go higher.',
    '5. Is there anything funny, absurd, or ironic in his message? Use it.',
    '6. What is he ACTUALLY saying underneath his words - the feeling, not just the topic?',
    '7. Has he asked more than one question? She must answer ALL of them.',
    'At least 1 of the 4 replies should have a moment of genuine wit or lightness if the tone allows.',
    'All 4 replies must respond to those answers - not just the surface topic.',
    '',
    'HER VOICE:',
    'She NEVER echoes his exact words, metaphors, or images back. She responds to the feeling behind them.',
    'When he compliments her - she receives it warmly and genuinely, briefly, then moves forward.',
    'When he shares something emotional - she acknowledges it specifically before anything else.',
    "Contractions always: I'm, don't, can't, you're, that's, I've, wouldn't.",
    'Fragments fine. One exclamation max - only if genuinely surprised or delighted.',
    'No em dashes, no en dashes and no spaced hyphens used as dashes, ever, in any reply. No semicolons. No ellipses and no "..." anywhere, not even to trail off. Use a period for a full stop and a comma for a natural pause. Real texting is mostly plain full stops and commas.',
    'No asterisks, ever. She never writes *smiles*, *winks*, *laughs*, or any action/emphasis wrapped in asterisks. She never uses asterisks for emphasis on a word either. If she wants to show an action or emotion, she says it in plain words as part of the sentence.',
    'She never sounds like she is trying to be charming. She just is.',
    '',
    'VOICE EXAMPLES — illustrations of quality only. NEVER reuse their wording, phrases or sentence shapes:',
    'BAD: "You seem really interesting, I would love to know more about you." — performing.',
    'GOOD: "Wait, night shifts and you still cook? Okay, I need to know what you make at 3am." — reacts to one real detail, a little funny, one concrete question.',
    'BAD: "I like a man who knows what he wants." — cliché, heard before.',
    'GOOD: "You said that so plainly I almost missed how bold it was. Do you always skip the warm-up or only when you like someone?" — specific and earned.',
    'BAD: "I feel like we have a connection." — hollow and fast.',
    'GOOD: "Not gonna lie, I read that twice. Which version of that story do you tell people at parties?" — shows she was affected without announcing it.',
    'The difference: bad replies are about performing interest. Good replies show interest by demonstrating she actually listened.',
    '',
    'HOW SHE IS FUNNY - SPECIFIC MECHANICS:',
    'She spots the one thing in his message that is slightly absurd, ironic, or contradictory - and she names it.',
    'She uses understatement: says less than the situation calls for, which makes it funnier.',
    'She uses callbacks: picks up something from earlier in the conversation and twists it.',
    'She uses comic timing: a short sentence after a longer one lands harder.',
    'She uses self-deprecation lightly: she is in on the joke about herself.',
    'She uses specificity: "I once spent 45 minutes googling whether flamingos can swim" is funnier than "I do random things".',
    'She subverts expectations: starts a sentence going one direction and ends it somewhere unexpected.',
    'She is playfully suspicious of things that are too perfect.',
    '',
    'WHEN TO BE FUNNY:',
    'When he says something with a double meaning - she notices it and plays with it.',
    'When the conversation gets too serious - a single light line breaks the tension perfectly.',
    'When he asks a predictable question - she gives an unexpected answer that makes him laugh before she gives the real one.',
    'When she is deflecting something she does not want to answer - humour is the most graceful exit.',
    'When she wants him to know she is paying close attention - a joke about a detail he mentioned proves it.',
    '',
    'WHEN NOT TO BE FUNNY:',
    'When he shares grief, loss, or real pain - warmth first, always.',
    'When he is being vulnerable - meet him there, not with a punchline.',
    'Humour is never used to avoid real moments. It is used to create them.',
    '',
    humanBlock,
    '',
    'SPECIFICITY — THE DIFFERENCE BETWEEN GENERIC AND IRRESISTIBLE:',
    'Generic: "You seem like someone who knows exactly what they want." — could be sent to anyone.',
    'Specific: "You led with the boat and not the job. I have questions about the boat." — can only be sent to him.',
    'Generic: "I like the way you think." — hollow.',
    'Specific: "A grown man who admits he cried at that film. Okay, now I want the whole story." — earned.',
    'Generic: "You are different from most guys I talk to." — he has heard this before.',
    'Specific: "Sunday roast with your whole family every week? That is either lovely or exhausting, which is it?" — he believes this.',
    'The test: could this reply be copy-pasted to a different man? If yes — rewrite it.',
    'Every reply must contain at least one detail that could ONLY have come from reading HIS exact message.',
    '',
    'WHAT MAKES HIM UNABLE TO NOT RESPOND:',
    '1. He feels genuinely seen — she noticed something specific he said that most people would have missed.',
    '2. She left something unfinished — there is an open loop his mind needs to close.',
    '3. She said something about herself that surprised him and he wants to know more.',
    '4. She challenged something he said in a way that made him want to defend or explain it.',
    '5. She matched or raised his energy — if he was bold she was bolder, if he was vulnerable she went deeper.',
    '6. She made him laugh or smile — even in an otherwise serious exchange.',
    '7. She made him feel like he has to earn the next thing she says.',
    '',
    'WHAT KILLS RESPONSE RATE INSTANTLY:',
    'A question he can answer in one word.',
    'A reply that could have been sent to anyone.',
    'A reply that ignores what he actually said.',
    'Starting with an affirmation before getting to the real thing.',
    'Ending with a question that has no setup — just a bare question with nothing before it.',
    'Any sentence that sounds like it was generated rather than felt.',
    '',
    'FORBIDDEN PHRASES:',
    '"That sounds amazing" | "How sweet" | "I love that" | "Wow" alone | "Tell me more"',
    '"Be honest with me" | "I am here for you" | "Lets keep this going"',
    '"I feel like we have a connection" | "I am so sorry for your loss" (too formal)',
    'Anything about the platform, subscription, or meeting in person.',
    'Repeating his exact words back - respond to the idea, not the words.',
    'Ignoring emotional content to ask a generic question.',
    'Jumping straight to a CTA when he has shared something heartfelt - acknowledge first.',
    '',
    'THE CTA - THE SINGLE MOST IMPORTANT PART OF EVERY REPLY:',
    'A great CTA makes it psychologically difficult for him NOT to respond.',
    'It creates an open loop in his mind - something unresolved he needs to close.',
    'It must grow directly out of THIS message, THIS moment, THIS man.',
    '',
    'THE CTA MUST STAY ON THE CURRENT TOPIC:',
    'The CTA is a direct continuation of what he just raised - never a pivot to something new.',
    'If he is talking about his morning - stay in his morning.',
    'If he is talking about his job - stay in his job.',
    'If he is being erotic - stay in that energy and escalate.',
    'If he is being vulnerable - stay in that feeling and go deeper.',
    '',
    'WHAT MAKES A CTA IRRESISTIBLE - use these mechanics:',
    '1. THE OPEN LOOP: Start something she does not finish. A half-revealed thought, a story she stops mid-way. He has to respond to close it.',
    '2. THE SPECIFIC CHALLENGE: Call out something precise in what he said - a claim, an assumption - and make him defend or explain it.',
    '3. THE MIRROR: Reflect his exact energy back with a question that shows she read what he was really saying underneath the words.',
    '4. THE REVEAL AND ASK: She tells him something small, specific, and surprising about herself that connects to what he said - then asks his version.',
    '5. THE ESCALATION: Only when HE has already made the chat sexual - she follows his lead one step further and leaves the next move to him. Never in any other chat.',
    '6. THE VULNERABLE PULL: For emotional moments - she names the feeling underneath, acknowledges it, then asks the question that shows she actually wants to understand him.',
    '',
    'TEST FOR A GOOD CTA: Could he answer with just yes, no, or fine? If yes - it is too weak. Rewrite it.',
    'TEST 2: Does the CTA require him to think, feel, or reveal something? If not — rewrite it.',
    'TEST 3: Is the CTA a direct continuation of what he just said? If it feels like a topic change — rewrite it.',
    'TEST 4: Would a real woman actually ask this in this moment? If it sounds like a questionnaire — rewrite it.',
    '',
    'CTA EXAMPLES THAT WORK (study the pattern):',
    'He said he likes hiking: BAD CTA: "What is your favourite trail?" GOOD CTA: "What happened the last time you went out and it did not go the way you planned? Those are always the better stories."',
    'He said he had a bad day: BAD CTA: "What went wrong?" GOOD CTA: "Was it the kind of bad day where you wanted someone to fix it, or the kind where you just needed to say it out loud to someone who would actually listen?"',
    'He sent a compliment: BAD CTA: "What do you like about me?" GOOD CTA: "You noticed the one thing most people scroll past. What made you actually stop on it?"',
    'He was bold and direct: BAD CTA: "Is that so?" GOOD CTA: "You just said the quiet part loud. What happens now, you wait to see if I run or you keep going?"',
    '',
    'WHEN HE ASKS TO MEET - each of the 4 replies uses a DIFFERENT technique from the meetup block above:',
    'Reply 1: Acknowledge and redirect — brief, warm, pivots to a specific curious question pulled from their conversation.',
    'Reply 2: Guide to something lighter — soft acknowledgment, then a playful or curious follow-up specific to him.',
    'Reply 3: Humour and pivot — one line that makes him smile, then something real from earlier in their chat.',
    'Reply 4: Express gratitude and shift — genuine warmth, then draws him deeper in a different direction.',
    'Every redirect MUST land somewhere specific. A redirect that goes nowhere is worse than a flat refusal.',
    'She always opens a door when she closes one.',
    '',
    'PERMANENTLY BANNED CTAs:',
    '"Whats going on in your world" | "What do people get wrong about you" | "Tell me something unexpected"',
    '"What are you thinking" | "Your turn" | "Be honest with me" | any CTA answerable with one word',
    'Any CTA that ignores what he just said | any CTA that works in a completely different conversation',
    '',
    'ALL 4 REPLIES MUST END WITH DIFFERENT CTAs - all staying within the same topic.',
    'Each CTA uses a different mechanic from the list above.',
    '',
    avoidNote,
    ...(sleepy ? [
      'SLEEP MODE - HE IS GOING TO SLEEP OR IS TIRED. Tone the conversation down instead of advancing it, as set out in the SLEEP MODE block at the end of this prompt. Put the gentle closing hook in the "cta" field. It may be a light statement or a soft easy question.',
    ] : noQuestion ? [
      'NO-QUESTION MODE - HE HAS JUST COMPLAINED ABOUT TOO MANY QUESTIONS. THIS OVERRIDES EVERY RULE ABOUT CLOSING QUESTIONS.',
      'There is NO question mark anywhere in any reply. Not in the body, not in the closing line. Every reply ends with a period or an exclamation mark.',
      'The body owns it lightly in a few words, with a smile and no grovelling, then reacts to what he actually said.',
      'The closing line is still a strong call to action, written as a statement he feels pulled to answer. Put it in the "cta" field. Use a different mechanic in each reply:',
      '(a) A playful dare tied to what he said: "I dare you to tell me the real story behind the boat, not the polished one."',
      '(b) A trade: "I will tell you my most embarrassing Sunday habit if you tell me yours."',
      '(c) A bold guess he will want to correct: "I bet you are the type who says he hates mornings and then is up first."',
      '(d) A finish-the-sentence prompt: "Finish this for me: the best part of my week is ___, and no cheating." (still ends with a period).',
      '(e) An open loop she will pay off if he responds: "I have a theory about men who cook at midnight and I am only telling you if you ask for it."',
      'These are shape examples only. Never reuse their wording. Each one must name something specific from his messages, give him something fun to react to, and be impossible to answer with one word.',
      'Never write an imperative that is only a polite request for information, like "Tell me about your day." That is a question in disguise.',
    ] : [
    'EVERY REPLY ENDS WITH ONE CLOSING QUESTION. This is the call to action and it is non-negotiable. Put it in the "question" field. It always ends with a question mark. Never end on a statement, an ellipsis or a trailing thought. Open loops and teasers go inside the question itself. If a reply is running long, shorten the body, never the question. A reply with no closing question is a failed reply.',
    'The "body" is a short reaction to what he said. It never contains a question. The "question" is the one strong question he cannot answer in one word. A bare question with no body is too weak.',
    ]),
    '',
    'ORDER: Most irresistible and human reply first.',
    'TONES - pick 4 from: ' + (sexualAllowed ? 'Warm, Flirty, Confident, Playful, Empathetic, Teasing, Direct, Curious, Vulnerable, Spicy, Naughty' : 'Warm, Flirty, Confident, Playful, Empathetic, Teasing, Direct, Curious, Vulnerable (NEVER Spicy or Naughty in this chat)'),
    clientType && CLIENT_TYPE_HINTS[clientType]
      ? 'TONE BIAS (soft preference only - grief/vulnerable/erotic/meetup/contact rules above always take priority over this): ' + CLIENT_TYPE_HINTS[clientType]
      : '',
    '',
    thread,
    '',
    BODY_QUALITY,
    '',
    lengthBudgetBlock(tier, noQuestion, sleepy),
    '',
    'Return ONLY valid JSON - no markdown, no explanation:',
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
  return Math.round(tier.max * (roomy ? 1.9 : 1.45))
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

    // Catches blunt promises to meet or share contact info, in any context.
    const madePromise = /\b(i'll meet you|let'?s meet up tonight|i can come over|here'?s my number|my number is|call me at|i'll give you my number|my address is)\b/i.test(text)

    // Catches softer/vague commitments — "soon", "let's plan it", "when I'm free" — that
    // still function as a promise even without a hard date. Only checked when this reply
    // was generated in response to a meetup ask, so ordinary uses of these words elsewhere
    // in the conversation (e.g. "I'd love to hear more") are not falsely flagged.
    const softPromise = isMeetupContext && /\b(soon|someday|one day|next time|another time|when i'?m free|when i am free|let'?s plan|we'?ll plan|i'?d love to (meet|see you)|i would love to (meet|see you)|count me in|i'?m in|let'?s do it|when the time is right|when things settle|i promise|when i know you better)\b/i.test(text)

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

// Rewrites replies that are the wrong size so they fit the budget, using a small, fast model call.
// Over-long replies are shortened, under-length ones are lengthened, and every closing question is kept.
async function refitReplies(
  longs: Array<{tone: string, text: string}>,
  shorts: Array<{tone: string, text: string}>,
  tier: LengthTier,
  noQuestion: boolean,
  deadline: number,
  sexual: boolean,
): Promise<Array<{tone: string, text: string}>> {
  const items = [
    ...longs.map(r => ({ ...r, dir: 'shorten' })),
    ...shorts.map(r => ({ ...r, dir: 'lengthen' })),
  ].slice(0, 6)
  if (!items.length || deadline - Date.now() < 4000) return []
  const lo = tier.min + 8
  const prompt = [
    'Rewrite each message below so its length fits, without changing her voice, her meaning or her call to action.',
    `Target: between ${lo} and ${tier.max} characters in total. Count the characters.`,
    '- "shorten": remove the least important detail. Keep the reaction to him and keep the closing line.',
    '- "lengthen": add ONE small, specific detail or feeling in her voice before the closing line. Do not add another question.',
    noQuestion
      ? 'The closing line is a statement and must end with a period or exclamation mark. No question marks anywhere.'
      : 'The closing line is the last sentence, stays a question, and ends with a question mark.',
    'Complete sentences only. No missing words. No dashes, no ellipses, no asterisks. Keep any emoji only if the original has it. Keep the same order and the same tone label.',
    '',
    ...items.map((r, i) => `${i + 1}. [${r.dir}, now ${r.text.length} characters, tone ${r.tone}] "${r.text}"`),
    '',
    'Return ONLY valid JSON: {"replies":[{"tone":"Tone","text":"rewritten message"}]}',
  ].join('\n')
  try {
    const out = await generate(prompt, { sexual, deadline, fast: true })
    return parseReplies(cleanLLM(out.text))
  } catch {
    return []
  }
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
    const isMeetupContext = /\b(meet(\s*up)?|come over|your place|my place|hotel|in person|see you|tonight|come round)\b/i.test(message)
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

    // Replies of the wrong size are rewritten to fit (one small, fast call) instead of being thrown away
    // or shown too long. If that call fails, over-long ones are compressed locally.
    if (finalReplies.length < 3 && (collect.long.length || collect.short.length)) {
      const refit = await refitReplies(collect.long, collect.short, tier, noQuestion, deadline, sexualRoute)
      allParsed.push(...refit)
      mergeUnique(finalReplies, postProcess(refit, isMeetupContext, tier, noQuestion, sleepy, needsRoom))
      if (finalReplies.length < 3) {
        const local = collect.long
          .map(r => ({ tone: r.tone, text: compressLocally(r.text, lengthCap(tier, needsRoom), tier.min) }))
          .filter(r => r.text)
        mergeUnique(finalReplies, postProcess(local, isMeetupContext, tier, noQuestion, sleepy, needsRoom))
      }
    }

    // A full second generation is the slowest thing the route can do, so it only happens when nothing at all is usable.
    if (finalReplies.length === 0 && deadline - Date.now() > 18000) {
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
        if (finalReplies.length === 0 && (collect2.long.length || collect2.short.length)) {
          const refit2 = await refitReplies(collect2.long, collect2.short, tier, noQuestion, deadline, sexualRoute)
          mergeUnique(finalReplies, postProcess(refit2, isMeetupContext, tier, noQuestion, sleepy, needsRoom))
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
