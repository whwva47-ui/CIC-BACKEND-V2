// CIC generate route v11.7.0 - Updated models August 2026
import { NextResponse } from 'next/server'
import { generateText } from 'ai'
import { createGroq } from '@ai-sdk/groq'

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
    version: 'v11.7.0'
  }), { headers: { 'Content-Type': 'application/json', ...cors() } })
}

type GenResult = { text: string; model: string }

// Provider chain. Optional Anthropic first (non-sexual messages only, needs ANTHROPIC_API_KEY),
// then Groq (model order depends on message type), OpenRouter, Gemini.
async function generate(
  prompt: string,
  opts: { sexual?: boolean; avoid?: string[]; deadline?: number } = {}
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

  // ── Anthropic (optional) ─────────────────────────────────────────────────
  if (anthropicKey && !opts.sexual && !avoid.has('anthropic') && hasTime(12000)) {
    try {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), cap(15000))
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-5-5',
          max_tokens: 800,
          temperature: 0.8,
          messages: [{ role: 'user', content: prompt }],
        }),
        signal: ctrl.signal,
      })
      clearTimeout(timer)
      const data = await res.json()
      const text = data?.content?.[0]?.text
      if (text) {
        const clean = stripThink(text)
        if (clean) { console.log('[CIC] Anthropic: claude-sonnet-5-5', Date.now() - t0, 'ms'); return { text: clean, model: 'anthropic/claude-sonnet-5-5' } }
      }
      errors.push(`Anthropic: ${JSON.stringify(data?.error || 'empty').substring(0, 80)}`)
    } catch (e: any) {
      errors.push(`Anthropic: ${e?.message?.substring(0, 60)}`)
    }
  }

  // ── Groq ─────────────────────────────────────────────────────────────────
  if (groqKey && !avoid.has('groq')) {
    const groq = createGroq({ apiKey: groqKey })
    // gpt-oss is the most safety-tuned of these and tends to refuse or silently drop
    // explicit words, so it goes last for sexual messages and first for everything else.
    const groqModels = opts.sexual
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
    for (const model of groqModels) {
      if (!hasTime()) { errors.push('Groq: out of time'); break }
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), cap(10000))
        const result = await generateText({
          model: groq(model),
          prompt,
          temperature: 0.8,
          maxTokens: 1800,
          abortSignal: controller.signal,
        })
        clearTimeout(timeout)
        if (result.text) {
          const clean = stripThink(result.text)
          if (clean) { console.log('[CIC] Groq:', model, Date.now() - t0, 'ms'); return { text: clean, model: 'groq/' + model } }
        }
      } catch (e: any) {
        const s = e?.statusCode || e?.status || ''
        const msg = e?.message || ''
        errors.push(`Groq/${model}(${s}): ${msg.substring(0, 80)}`)
        // On rate limit — skip immediately to next model, no delay
        if (s === 429 || msg.includes('Rate limit') || msg.includes('rate limit')) continue
        // On model not found — skip immediately
        if (s === 404 || msg.includes('does not exist') || msg.includes('not found')) continue
        // On other errors — break and try next provider
        break
      }
    }
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
            temperature: 0.8,
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
            generationConfig: { temperature: 0.8, maxOutputTokens: 1000 }
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
function normalizeReply(r: any): { tone: string; text: string } {
  const tone = ((r && r.tone) || 'Reply').toString()
  if (r && typeof r.text === 'string' && r.text.trim()) return { tone, text: r.text }
  const body = ((r && r.body) || '').toString().trim()
  const q = ((r && (r.question || r.cta || r.closing)) || '').toString().trim()
  if (!body && !q) return { tone, text: '' }
  const lead = body && !/[.!?…"']$/.test(body) ? body + '.' : body
  return { tone, text: [lead, q].filter(Boolean).join(' ') }
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
  return [
    usesEmoji ? 'she has used emojis, so one is fine if it fits' : 'she has not used emojis, so use none',
    exclaim >= 2 ? 'she often uses exclamation marks' : 'she rarely uses exclamation marks',
    asks >= sample.length - 1 ? 'she usually ends with a question' : '',
  ].filter(Boolean).join('; ')
}

function buildThreadBlock(context: string, noQuestion: boolean = false): string {
  const hist = parseHistory(context)
  if (!hist.length) {
    return [
      'CONVERSATION CONTEXT: no earlier messages could be read from the chat.',
      'Treat this as the start of the thread. Answer his message directly and warmly, ask one question about what he just said, and do NOT invent shared history, plans or details that nobody mentioned.',
    ].join('\n')
  }

  const thread = hist.slice(-8)
    .map(l => (l.who === 'HIM' ? 'HIM' : 'HER (you, earlier)') + ': ' + clip(l.text, 220))
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
  if (herLast) parts.push('He is answering her last message: "' + clip(herLast, 220) + '"')
  if (pending.length >= 2) {
    parts.push('He sent ' + pending.length + ' messages in a row since her last reply. She answers them as one thought: ' +
      pending.map(p => '"' + clip(p, 160) + '"').join(' | '))
  }
  if (herLines.length) {
    const voice = describeVoice(herLines)
    parts.push('HER VOICE SO FAR (her own earlier messages, for voice only, never copy their wording): ' +
      herLines.slice(-3).map(t => '"' + clip(t, 140) + '"').join(' | '))
    if (voice) parts.push('Her habits: ' + voice + '.')
  }
  parts.push(
    '',
    'CONTINUITY - CHECK THIS LAST, BEFORE WRITING:',
    '1. Every reply is the natural NEXT TURN of this exact conversation. It picks up a specific detail from the thread above, never a topic from nowhere.',
    '2. If his message is short or vague ("ok", "lol", "yes", "hmm", "haha"), read it as his answer to HER last message and keep that same topic moving. It is not a fresh start and the subject does not change.',
    '3. Same woman, same voice. Match the warmth, humour, rhythm and habits of her earlier messages. Do not suddenly become more poetic, more intense, more formal or more heated than she has been so far. Move the energy forward by one notch at most.',
    noQuestion
      ? '4. He has just said she asks too many questions. Own it lightly in a few words, answer what he said, then close with a statement call to action that is NOT a question (see NO-QUESTION MODE). It grows out of what is being discussed right now.'
      : '4. Answer what he asked before asking anything new. The closing question grows out of what is being discussed right now. If it could be pasted into a different conversation, rewrite it.',
    '5. Never restate or quote his words back to him. Move the thread forward.',
    '6. Use only facts that appear in the thread. Never invent details about him or about earlier messages.',
  )
  return parts.join('\n')
}

// ═══ MATCH HIS ENERGY: length tiers ═════════════════════════════════════════════
// The 75 character floor stays. Short messages get short replies, long messages get fuller ones.
type LengthTier = { name: string; min: number; max: number; note: string }
const LENGTH_TIERS: Record<string, LengthTier> = {
  short: { name: 'short', min: 75, max: 130, note: 'He wrote very little. She matches it: one short, punchy sentence of reaction and then the question. Quick and light, no paragraph. She never out-writes him.' },
  medium: { name: 'medium', min: 80, max: 190, note: 'He wrote a normal-length message. She replies in two or three sentences of reaction, then the question.' },
  long: { name: 'long', min: 110, max: 260, note: 'He wrote a lot, so she gives it real attention: three or four sentences that pick up specific details he shared, then the question.' },
  sensitive: { name: 'sensitive', min: 100, max: 260, note: 'This is an important moment in the chat, so she takes the room she needs to handle it well, and still finishes with the one closing question.' },
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
  return /\?["')\]]?\s*$/.test(t.trim())
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
      'She can say she saw or heard it, but she never invents details beyond what is listed here. ' +
      'She never claims to be in his city or to be having the same weather. No politics, crime, accidents or tragedy even if one slipped through. ' +
      'If nothing here fits his message naturally, she ignores this section completely.'
    )
    const text = '\n' + parts.join('\n') + '\n'
    localCache.set(ck, { at: Date.now(), text })
    return text
  })()

  // Hard cap so lookups can never slow a reply by more than a few seconds.
  return Promise.race([work, new Promise<string>(r => setTimeout(() => r(''), 3000))]).catch(() => '')
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
  noQuestion: boolean = false
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
- The 4 replies must differ in length, rhythm and structure. One can be two short sentences, another can run three. Never open two replies with the same word or shape. Never give all four the same "observation, then question" template.
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

  const jsonInstruction = noQuestion
    ? '{"replies":[{"tone":"Tone1","body":"short reaction to him","cta":"closing call to action, a statement, no question mark"},{"tone":"Tone2","body":"...","cta":"..."},{"tone":"Tone3","body":"...","cta":"..."},{"tone":"Tone4","body":"...","cta":"..."}]}'
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
    'LENGTH - MATCH HIS ENERGY: ' + tier.note,
    `Each reply (body and question together): minimum ${tier.min} characters, maximum ${tier.max} characters. Count them. Going over ${tier.max} is a failure.`,
    ...(noQuestion ? [
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
    'Return ONLY valid JSON - no markdown, no explanation:',
    jsonInstruction,
  ].filter(Boolean).join('\n')
}

function isCompleteSentence(text: string): boolean {
  return /[.?!]["']?\s*$/.test(text.trim())
}

// Like splitClosing, but for no-question mode: the closing call to action is the last sentence.
function splitLastSentence(text: string): { lead: string; closing: string } | null {
  const t = text.trim()
  const m = t.match(/^([\s\S]*[.!]["')\]]?\s+)([^.!]+[.!]["')\]]?)$/)
  if (!m) return null
  return { lead: m[1].trim(), closing: m[2].trim() }
}

function postProcess(replies: Array<{tone: string, text: string}>, isMeetupContext: boolean = false, tier: LengthTier = LENGTH_TIERS.long, noQuestion: boolean = false): Array<{tone: string, text: string}> {
  return replies.map((r) => {
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
    // Ellipses: dropped after ? or !, otherwise a plain full stop. Looks less like AI padding.
    text = text.replace(/([?!])\s*(?:\.{2,}|…)/g, '$1')
    text = text.replace(/\s*(?:\.{2,}|…)\s*/g, (match, offset) => (offset + match.length >= text.length ? '.' : '. '))
    text = text.replace(/,\s*([.!?])/g, '$1').replace(/\.\s*\./g, '.').replace(/\s{2,}/g, ' ').trim()
    text = text.replace(/([.!?]\s+)([a-z])/g, (_m, a, b) => a + b.toUpperCase())

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

    text = text.replace(/^(that sounds amazing|how sweet|i love that|wow that's)[,!.]?\s*/i, '')
    if (text.length > 0) text = text.charAt(0).toUpperCase() + text.slice(1)

    // Too long: shorten the lead sentence(s) and always keep the closing question intact.
    if (text.length > tier.max) {
      const parts = noQuestion ? splitLastSentence(text) : splitClosing(text)
      const empty = { tone: r.tone || 'Reply', text: '' }
      if (!parts || !parts.lead) return empty
      const room = tier.max - parts.closing.length - 1
      if (room < 25) return empty
      let lead = parts.lead
      if (lead.length > room) {
        const cut = lead.substring(0, room)
        const last = Math.max(cut.lastIndexOf('.'), cut.lastIndexOf('!'), cut.lastIndexOf('?'))
        if (last < 20) return empty
        lead = cut.substring(0, last + 1)
      }
      text = lead + ' ' + parts.closing
    }

    if (!isCompleteSentence(text)) {
      const lp = Math.max(text.lastIndexOf('?'), text.lastIndexOf('.'), text.lastIndexOf('!'))
      if (lp > 30) text = text.substring(0, lp + 1).trim()
      else return { tone: r.tone || 'Reply', text: '' }
    }

    // 75 character minimum is enforced by the filter below. Short replies are dropped
    // (and topped up by the retry in POST) instead of padded with identical stock sentences.

    return { tone: r.tone || 'Reply', text }
  }).filter(r => r.text.length >= tier.min && r.text.length <= tier.max && (noQuestion ? (!r.text.includes('?') && /[.!]["')\]]?$/.test(r.text)) : endsWithQuestion(r.text)) && !hasDroppedWordArtifact(r.text) && (r.text.match(/\?/g) || []).length <= 2)
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
    const tier = getLengthTier(message)
    const noQuestion = detectQuestionFatigue(context, message)
    const prompt = buildPrompt(message, context, userPlan, previousTones, englishVariety, myName, questionsToAnswer, clientType, localContext, tier, buildThreadBlock(context, noQuestion), noQuestion)
    const cleanLLM = (t: string) => t
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .replace(/\[THINKING\][\s\S]*?\[\/THINKING\]/gi, '')
      .replace(/\[REASONING\][\s\S]*?\[\/REASONING\]/gi, '')
      .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
      .trim()

    // Vercel kills the function at maxDuration (60s). Stop trying well before that.
    const deadline = reqStart + 45000
    const first = await generate(prompt, { sexual: sexualRoute, deadline })
    // No raw-text fallback: if the output can't be parsed, nothing is shown rather than junk or a refusal message.
    let finalReplies = postProcess(parseReplies(cleanLLM(first.text)), isMeetupContext, tier, noQuestion)

    // If filters dropped replies (too short, promise, dropped-word artifact, refusal), top the batch up
    // with ONE retry. If the first provider was Anthropic, the retry skips it.
    // Retry only if we are short AND there is plenty of time left. A slow retry is worse than three good replies.
    if (finalReplies.length < 3 && deadline - Date.now() > 15000) {
      try {
        const retry = await generate(prompt, {
          sexual: sexualRoute,
          deadline,
          avoid: first.model.startsWith('anthropic') ? ['anthropic'] : [],
        })
        const retryReplies = postProcess(parseReplies(cleanLLM(retry.text)), isMeetupContext, tier, noQuestion)
        const existingTexts = new Set(finalReplies.map(r => r.text))
        for (const r of retryReplies) {
          if (finalReplies.length >= 4) break
          if (!existingTexts.has(r.text)) { finalReplies.push(r); existingTexts.add(r.text) }
        }
      } catch {
        // Retry failed — proceed with whatever clean replies survived the first pass.
      }
    }

    if (!finalReplies.length) {
      return NextResponse.json({ error: 'Could not produce a clean set of replies. Tap Generate again.', replies: [], remaining: 999 }, { status: 200, headers })
    }

    const elapsedMs = Date.now() - reqStart
    console.log('[CIC] Done in', elapsedMs, 'ms |', first.model, '|', finalReplies.length, 'replies')
    return NextResponse.json({ replies: finalReplies, remaining: 999, plan: userPlan, modelUsed: first.model, elapsedMs }, { headers })

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
