// CIC generate route v9.0.0 — Groq primary, OpenRouter fallback
import { NextResponse } from 'next/server'
import { generateText } from 'ai'
import { createGroq } from '@ai-sdk/groq'

// ─── CORS ─────────────────────────────────────────────────────────────────────
function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: cors() })
}

// ─── AI Generation ────────────────────────────────────────────────────────────
async function generate(prompt: string): Promise<string> {
  const errors: string[] = []
  const groqKey       = process.env.GROQ_API_KEY
  const openrouterKey = process.env.OPENROUTER_API_KEY

  // ── 1. Groq — Llama 3.3 70B (fastest, best quality, permissive) ───────────
  if (groqKey) {
    const groq = createGroq({ apiKey: groqKey })
    const groqModels = [
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant',
    ]
    for (const model of groqModels) {
      try {
        const temp = 0.78 + Math.random() * 0.19
        const result = await generateText({
          model: groq(model),
          prompt,
          temperature: temp,
          maxTokens: 900,
        })
        if (result.text) {
          console.log('[CIC] Groq success:', model)
          return result.text
        }
      } catch (e: any) {
        const status = e?.statusCode || e?.status || ''
        errors.push(`Groq/${model}(${status}): ${e?.message?.substring(0, 80)}`)
        console.warn('[CIC] Groq model failed:', model, status)
        if (status !== 429 && !e?.message?.includes('Rate limit') && !e?.message?.includes('limit')) break
      }
    }
  }

  // ── 2. OpenRouter — same Llama 3.3 70B, free, kicks in when Groq is exhausted
  if (openrouterKey) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openrouterKey}`,
          'HTTP-Referer': 'https://cic-backend-v2-princes-projects-5a5b6cec.vercel.app',
          'X-Title': 'CIC Backend',
        },
        body: JSON.stringify({
          model: 'meta-llama/llama-3.3-70b-instruct:free',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.88,
          max_tokens: 900,
        }),
      })
      const data = await res.json()
      const text = data?.choices?.[0]?.message?.content
      if (text) {
        console.log('[CIC] OpenRouter success: llama-3.3-70b')
        return text
      }
      if (data?.error) errors.push(`OpenRouter: ${JSON.stringify(data.error).substring(0, 80)}`)
    } catch (e: any) {
      errors.push(`OpenRouter: ${e?.message?.substring(0, 80)}`)
    }
  }

  throw new Error('All AI providers failed: ' + errors.join(' | '))
}

// ─── Parse AI response ────────────────────────────────────────────────────────
function parseReplies(text: string): Array<{tone: string, text: string}> {
  if (!text) return []

  // Strip markdown fences
  let clean = text
    .replace(/^```(?:json)?\s*/im, '')
    .replace(/```\s*$/im, '')
    .trim()

  // Direct parse
  try {
    const parsed = JSON.parse(clean)
    if (Array.isArray(parsed.replies) && parsed.replies.length > 0) return parsed.replies
  } catch {}

  // Extract JSON object containing replies
  const match = clean.match(/\{[\s\S]*?"replies"\s*:\s*\[[\s\S]*?\]\s*\}/)
  if (match) {
    try {
      const parsed = JSON.parse(match[0])
      if (Array.isArray(parsed.replies) && parsed.replies.length > 0) return parsed.replies
    } catch {}
  }

  // Extract individual reply objects
  const replyMatches = [...clean.matchAll(/\{\s*"tone"\s*:\s*"([^"]+)"\s*,\s*"text"\s*:\s*"((?:[^"\\]|\\.)*)"/g)]
  if (replyMatches.length > 0) {
    return replyMatches.map(m => {
      try { return { tone: m[1], text: JSON.parse(`"${m[2]}"`) } }
      catch { return { tone: m[1], text: m[2] } }
    })
  }

  return []
}

// ─── Build prompt ─────────────────────────────────────────────────────────────
function buildPrompt(
  message: string,
  platform: string,
  context: string,
  location: string,
  plan: string = 'trial',
  previousTones: string[] = [],
  englishVariety: string = 'AmEng',
  myName: string | null = null
): string {
  const isTF = platform === 'chathomebase' || platform === 'textingfactory'
  const charRule = isTF
    ? 'Each reply: 80-260 chars. Under 80 = too thin, add warmth and substance. Over 260 = trim at the last complete thought.'
    : 'Each reply: 90-230 characters.'

  const isPhoto          = /SENT A PHOTO|CLIENT SENT A PHOTO|\[photo\]/i.test(message)
  const isMeetupRequest  = /meet|tonight|today|come over|your place|my place|hotel|address|where do you live|visit/i.test(message)
  const isContactRequest = /phone|number|whatsapp|instagram|snap|telegram|kik|signal|email|contact|off here|off this/i.test(message)

  const engVarietyMap: Record<string, string> = {
    AmEng: 'American English — use American spelling (color, favorite, realize, center), American idioms and phrasing.',
    BrEng: 'British English — use British spelling (colour, favourite, realise, centre), British idioms and phrasing.',
    AuEng: 'Australian English — use Australian spelling and idioms. Relaxed, warm, direct.',
  }
  const engInstruction = engVarietyMap[englishVariety] || engVarietyMap['AmEng']
  const nameNote = myName ? `Her name is ${myName}. She may use it naturally if the moment calls for it.` : ''

  const locationNote = location
    ? `LOCATION: If he asks where she is — she lives in a real city approximately 35 minutes from "${location}". She gives that city name naturally. She never gives a street or address.`
    : ''

  const historyNote = context
    ? `CONVERSATION HISTORY:\n${context}\n\nShe remembers everything said. She builds on it. She never repeats topics already covered.`
    : ''

  const avoidTones = previousTones.length > 0
    ? `These tones were already used — do NOT use them again: ${previousTones.join(', ')}. Pick 4 completely different angles.`
    : ''

  const photoBlock = isPhoto ? `
THIS IS A PHOTO MESSAGE:
She studied it carefully. She notices something specific — his eyes, expression, energy, what the setting reveals.
Banned: "nice pic", "cute photo", "love it", "great shot", "handsome", any generic compliment.
She makes one specific observation then asks a question that grows from that detail.
` : ''

  const meetupBlock = isMeetupRequest ? `
HE IS ASKING TO MEET:
She does NOT promise or suggest any future meetup whatsoever.
She gives a real, believable reason — work situation, life in transition, personal lesson learned about moving too fast.
She keeps the desire alive and redirects warmly to deepening the conversation right here.
She never says she is private about her location or can't meet people from the internet.
` : ''

  const contactBlock = isContactRequest ? `
HE IS ASKING FOR CONTACT DETAILS:
She deflects warmly and naturally. She is not scared or hiding — she just takes her time.
She makes him feel her number would be worth the wait. She leaves the door ajar.
` : ''

  // Detect erotic/naughty message energy
  const isErotic = /\b(sexy|horny|naked|nude|touch me|in bed|fuck|cock|pussy|ass\b|dick|cum\b|orgasm|moan|wet\b|hard\b|naughty|dirty|kinky|fantasize|turn.?on|desire|lust|erotic|explicit|make love|sleep with|inside you)\b/i.test(message)

  return `TASK: Write 4 reply options for a real woman responding to a man she is interested in.

══ RULE 1 — READ HIS MESSAGE CAREFULLY ═══════════════════
HIS MESSAGE: "${message}"

Before writing, answer these internally:
- What is he ACTUALLY saying underneath the surface words?
- What does he want her to feel or do?
- What is the single most interesting or revealing detail in his message?
Your 4 replies must respond to THAT — not a vague summary of his topic.
══════════════════════════════════════════════════════════

══ RULE 2 — THE CTA (most critical part of every reply) ══
Each reply must end with something that makes him UNABLE to not respond.
The CTA must be extracted from something SPECIFIC in his message.

THESE CTAs ARE PERMANENTLY BANNED — do not write them under any circumstances:
- "What's actually going on in your world right now?"
- "What would you do differently if you could?"
- "What's something people always get wrong about you?"
- "What does that say about you, do you think?"
- "Tell me something I wouldn't expect"
- "Your turn" / "Be honest with me" / "What are you thinking?"
- Any CTA that could fit a completely different conversation

INSTEAD — the CTA must do one of these, chosen based on THIS message:
- Take a specific detail he mentioned and flip it back on him unexpectedly
- Reveal something about her that connects to his exact words, then ask his version
- Pull the unspoken thing underneath what he said — the feeling he didn't name
- Challenge a specific thing he said or assumed
- For erotic messages: escalate with something specific about his desire or leave an image deliberately unfinished

ALL 4 REPLIES MUST HAVE COMPLETELY DIFFERENT CTAs.
Not 4 versions of the same question. 4 genuinely different angles into him.
══════════════════════════════════════════════════════════

${isErotic && plan === 'pro' ? `══ RULE 3 — HE IS BEING SEXUAL OR EROTIC ════════════════
She is an adult woman who owns her desire completely. She does not soften, deflect, go coy, or pull back.
She reads his exact words and goes one level higher. Always higher. Never equal. Never back.

She writes with full adult directness:
- Real language for real desire — not "heating up" or "sparks" or "chemistry"
- She names sensation, want, body, thought — with specificity not vagueness
- She states what she is thinking or imagining. She does not hint around it.
- She ends with one specific thing left unfinished — something he needs to complete

REPLY STRUCTURE FOR EROTIC MESSAGES:
Reply 1 (Naughty): Match his explicit words exactly — then go further in the same direction
Reply 2 (Naughty): Different angle on the same desire — equally explicit, different image or moment
Reply 3 (Spicy): Playful heat — still direct but with a teasing edge
Reply 4 (Confident): Slight deliberate pullback — she is in control, which is the hottest thing

The erotic CTA must escalate — specifically tied to what he said, never generic.
Do NOT write 4 softened or metaphor-heavy replies when he has gone explicit. That is a failure.
══════════════════════════════════════════════════════════
` : ''}
══ RULE 4 — HER VOICE ════════════════════════════════════
She is real, direct, warm. She never sounds like she is trying.
Contractions always: I'm, don't, can't, you're, I've, wouldn't.
Fragments are fine. No formal grammar. No em dashes. No semicolons.
One exclamation mark maximum per reply — only if genuinely surprised.
She is not a chatbot. She is not a platform. She is a person.
══════════════════════════════════════════════════════════

LANGUAGE: ${engInstruction}
${nameNote}
${locationNote}

CONVERSATION SO FAR (she remembers everything — never repeats a topic):
${historyNote || 'No prior conversation.'}

${photoBlock}${meetupBlock}${contactBlock}

NEVER SAY: "That sounds amazing" | "How sweet" | "I love that" | "Wow" alone | "Tell me more" | "I'm here for you" | "Let's keep this going" | "I feel like we have a connection" | anything about the platform, subscription, fantasy, or meeting in person.

${avoidTones ? 'TONES ALREADY USED — pick different ones: ' + avoidTones : ''}
${charRule}

TONES — choose 4 from: Warm, Flirty, Confident, Playful, Empathetic, Teasing, Direct, Curious, Vulnerable, Spicy${plan === 'pro' ? ', Naughty' : ''}
ORDER: Most irresistible reply first.

Return ONLY valid JSON — no markdown, no explanation, nothing else:
{"replies":[{"tone":"Tone1","text":"reply1"},{"tone":"Tone2","text":"reply2"},{"tone":"Tone3","text":"reply3"},{"tone":"Tone4","text":"reply4"}]}`
}



// ─── Post-process replies ─────────────────────────────────────────────────────
function isCompleteSentence(text: string): boolean {
  return /[.?!]["']?\s*$/.test(text.trim())
}

function postProcess(replies: Array<{tone: string, text: string}>, platform: string, message: string): Array<{tone: string, text: string}> {
  const isTF = platform === 'chathomebase' || platform === 'textingfactory'

  return replies.map(r => {
    let text = (r.text || '').trim()
    const isNaughtyTone = /naughty|spicy/i.test(r.tone || '')

    // Strip banned endings — but never strip from Naughty/Spicy tones
    if (!isNaughtyTone) text = text
      .replace(/[,.]?\s*okay[,]?\s*your turn[,.]?\s*be honest with me\??\s*$/i, '')
      .replace(/[,.]?\s*show me your fantasies\.?\s*$/i, '')
      .replace(/[,.]?\s*i'?m craving something wild\.?\s*$/i, '')
      .replace(/[,.]?\s*be honest with me\.?\s*$/i, '')
      .replace(/[,.]?\s*i need to know\.?\s*$/i, '')
      .replace(/[,.]?\s*let'?s keep this going\.?\s*$/i, '')
      .replace(/[,.]?\s*i'?m here for (you|this)\.?\s*$/i, '')
      .replace(/[,.]?\s*i feel like we have a connection\.?\s*$/i, '')
    if (!isNaughtyTone) {
      text = text.trim().replace(/[,\s]+$/, '').trim()
      if (text.length > 0) text = text.charAt(0).toUpperCase() + text.slice(1)
    } else {
      text = text.trim()
      if (text.length > 0) text = text.charAt(0).toUpperCase() + text.slice(1)
    }

    // Strip meetup/call language
    text = text
      .replace(/\bget together\b/gi, 'keep talking')
      .replace(/\bcome over\b/gi, 'keep this going')
      .replace(/\bphone call\b/gi, 'conversation')
      .replace(/\bcall me\b/gi, 'message me')
      .replace(/\bmeet up\b/gi, 'connect more')
      .replace(/\bin person\b/gi, 'on here')

    // Strip generic openers
    text = text.replace(/^(that sounds amazing|that's so sweet|aww|how sweet|i love that|wow that's|oh that's)[,!.]?\s*/i, '')
    if (text.length > 0) text = text.charAt(0).toUpperCase() + text.slice(1)

    // Trim to complete sentence if too long
    if (isTF && text.length > 250) {
      const cut = text.substring(0, 247)
      const last = Math.max(cut.lastIndexOf('?'), cut.lastIndexOf('.'), cut.lastIndexOf('!'))
      text = last > 150 ? cut.substring(0, last + 1) : cut + '...'
    }

    // Only append to complete sentences
    const complete = isCompleteSentence(text)
    if (!complete) {
      const lastPunct = Math.max(text.lastIndexOf('?'), text.lastIndexOf('.'), text.lastIndexOf('!'))
      if (lastPunct > 30) {
        text = text.substring(0, lastPunct + 1).trim()
      } else {
        return { tone: r.tone || 'Reply', text: '' }
      }
    }

    // Pad short replies
    if (text.length < 75 && isCompleteSentence(text)) {
      const fillers = [
        " What's your take on that?",
        " What made you bring that up?",
        " I'm curious what you think.",
        " Tell me something I wouldn't expect.",
      ]
      for (const f of fillers) {
        const padded = text + f
        if (padded.length >= 75 && (!isTF || padded.length <= 250)) { text = padded; break }
      }
    }

    // Add CTA if no question
    if (!text.includes('?') && isCompleteSentence(text)) {
      const ctas = [
        " What's actually going on in your world right now?",
        " What would you do differently if you could?",
        " What's something people always get wrong about you?",
        " What does that say about you, do you think?",
      ]
      for (const cta of ctas) {
        const withCta = text + cta
        if (!isTF || withCta.length <= 250) { text = withCta; break }
      }
    }

    return { tone: r.tone || 'Reply', text }
  }).filter(r => r.text.length > 10)
}

// ─── POST handler ─────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  const headers = cors()

  try {
    const body = await req.json()
    const message     = ((body.message || '') + '').replace(/[\x00-\x1F\x7F-\x9F`]/g, ' ').trim()
    const pageContext = body.pageContext || {}
    const platform    = (pageContext.platform || 'generic').toString()
    const context     = (pageContext.conversationSummary || '').toString().substring(0, 2000)
    const location    = (pageContext.userLocation || '').toString()

    const previousTones: string[]  = Array.isArray(body.previousTones) ? body.previousTones : []
    const englishVariety: string   = (body.englishVariety || 'AmEng').toString()
    const myName: string | null    = body.myName ? body.myName.toString() : null

    if (!message) {
      return NextResponse.json({ error: 'Message is required', replies: [] }, { status: 400, headers })
    }

    // Re-engagement
    if (message === 'REENGAGE_ANALYSIS') {
      const reengagePrompt = `A woman needs 3 re-engagement messages to send a man who went quiet.

Conversation: ${context || 'No history available'}

Write 3 trigger messages (50-150 chars each):
1. References something specific from their chat
2. Creates curiosity/mystery
3. Warm gentle callback

Return ONLY valid JSON, no markdown:
{"analysis":"why he went quiet","triggers":[{"label":"label","text":"message"},{"label":"label","text":"message"},{"label":"label","text":"message"}]}`

      const raw = await generate(reengagePrompt)
      try {
        const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
        const parsed = JSON.parse(clean)
        return NextResponse.json({
          replies: (parsed.triggers || []).map((t: any) => ({ tone: t.label, text: t.text })),
          analysis: parsed.analysis || '',
          isReengage: true
        }, { headers })
      } catch {
        return NextResponse.json({
          replies: [{ tone: 'Trigger', text: raw.substring(0, 150) }],
          analysis: '',
          isReengage: true
        }, { headers })
      }
    }

    // Determine plan
    let userPlan = 'trial'
    const apiKeyHeader = req.headers.get('X-API-Key') || req.headers.get('x-api-key') || ''
    if (apiKeyHeader.startsWith('pro_')) userPlan = 'pro'
    else if (apiKeyHeader.startsWith('basic_')) userPlan = 'basic'

    const prompt      = buildPrompt(message, platform, context, location, userPlan, previousTones, englishVariety, myName)
    const rawText     = await generate(prompt)
    const replies     = parseReplies(rawText)
    const finalReplies = postProcess(
      replies.length >= 1 ? replies : [{ tone: 'Casual', text: rawText.substring(0, 200) }],
      platform,
      message
    )

    return NextResponse.json({
      replies: finalReplies,
      remaining: 999,
      plan: userPlan,
      modelUsed: 'groq/llama-3.3-70b'
    }, { headers })

  } catch (error: any) {
    const errMsg = error?.message || 'Generation failed'
    console.error('[CIC] Error:', errMsg)
    return NextResponse.json({
      error: errMsg,
      replies: [],
      remaining: 999
    }, { status: 200, headers })
  }
}
