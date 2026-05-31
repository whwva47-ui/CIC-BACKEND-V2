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

// CIC generate route v10.0.0 — TextingFactory/Chathomebase optimised
// Groq Llama 3.3 70B primary | OpenRouter fallback
import { NextResponse } from 'next/server'
import { generateText } from 'ai'
import { createGroq } from '@ai-sdk/groq'

// ─── CORS ──────────────────────────────────────────────────────────────────────
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

// ─── AI Generation ─────────────────────────────────────────────────────────────
async function generate(prompt: string): Promise<string> {
  const errors: string[] = []
  const groqKey       = process.env.GROQ_API_KEY
  const openrouterKey = process.env.OPENROUTER_API_KEY

  // ── 1. Groq — Llama 3.3 70B (best quality, fastest, fully permissive) ────────
  if (groqKey) {
    const groq = createGroq({ apiKey: groqKey })
    for (const model of ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant']) {
      try {
        const result = await generateText({
          model: groq(model),
          prompt,
          temperature: 0.82 + Math.random() * 0.12,
          maxTokens: 900,
        })
        if (result.text) {
          console.log('[CIC] Groq:', model)
          return result.text
        }
      } catch (e: any) {
        const s = e?.statusCode || e?.status || ''
        errors.push(`Groq/${model}(${s}): ${e?.message?.substring(0, 80)}`)
        if (s !== 429 && !e?.message?.includes('limit')) break
      }
    }
  }

  // ── 2. OpenRouter — same Llama 3.3 70B free ──────────────────────────────────
  if (openrouterKey) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openrouterKey}`,
          'HTTP-Referer': 'https://cic-backend-v2-princes-projects-5a5b6cec.vercel.app',
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
      if (text) { console.log('[CIC] OpenRouter: llama-3.3-70b'); return text }
      if (data?.error) errors.push(`OpenRouter: ${JSON.stringify(data.error).substring(0, 80)}`)
    } catch (e: any) {
      errors.push(`OpenRouter: ${e?.message?.substring(0, 80)}`)
    }
  }

  throw new Error('All providers failed: ' + errors.join(' | '))
}

// ─── Parse replies ─────────────────────────────────────────────────────────────
function parseReplies(text: string): Array<{tone: string, text: string}> {
  if (!text) return []
  const clean = text.replace(/^```(?:json)?\s*/im, '').replace(/```\s*$/im, '').trim()
  try {
    const p = JSON.parse(clean)
    if (Array.isArray(p.replies) && p.replies.length) return p.replies
  } catch {}
  const m = clean.match(/\{[\s\S]*?"replies"\s*:\s*\[[\s\S]*?\]\s*\}/)
  if (m) { try { const p = JSON.parse(m[0]); if (Array.isArray(p.replies)) return p.replies } catch {} }
  const items = [...clean.matchAll(/\{\s*"tone"\s*:\s*"([^"]+)"\s*,\s*"text"\s*:\s*"((?:[^"\\]|\\.)*)"/g)]
  if (items.length) return items.map(m => { try { return { tone: m[1], text: JSON.parse(`"${m[2]}"`) } } catch { return { tone: m[1], text: m[2] } } })
  return []
}

// ─── Build prompt ──────────────────────────────────────────────────────────────
function buildPrompt(
  message: string,
  context: string,
  location: string,
  plan: string,
  previousTones: string[],
  englishVariety: string,
  myName: string | null
): string {

  // ── English variety ──
  const eng: Record<string, string> = {
    AmEng: 'American English — color, favorite, realize. American idioms.',
    BrEng: 'British English — colour, favourite, realise. British idioms.',
    AuEng: 'Australian English — relaxed, warm, direct. Australian expressions where natural.',
  }
  const engNote = eng[englishVariety] || eng['AmEng']
  const nameNote = myName ? `Her name is ${myName}.` : ''

  // ── Location ──
  const locationNote = location
    ? `If he asks where she is: she lives in a real city about 35 minutes from "${location}". She names it naturally. No street, no neighborhood, no "I'm private about my location" — that sounds scripted.`
    : ''

  // ── Conversation history ──
  const historyNote = context
    ? `CONVERSATION SO FAR — she has read every word. She remembers it all. She never repeats a topic already covered. Her reply must fit exactly where this conversation is right now:\n${context}`
    : ''

  // ── Special message types ──
  const isPhoto    = /SENT A PHOTO|CLIENT SENT A PHOTO|\[photo\]/i.test(message)
  const isMeetup   = /\b(meet|come over|your place|my place|hotel|visit|in person|see you|tonight|come round)\b/i.test(message)
  const isContact  = /\b(phone|number|whatsapp|instagram|snap|telegram|signal|email|contact|off (here|this|platform))\b/i.test(message)
  const isErotic   = plan === 'pro' && /\b(sexy|horny|naked|nude|touch|hard|wet|fuck|cock|pussy|ass|dick|cum|orgasm|moan|naughty|dirty|kinky|fantasize|turn.?on|desire|lust|erotic|explicit|undress|body|pleasure)\b/i.test(message)

  const photoBlock = isPhoto ? `
━━━ HE SENT A PHOTO ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
He shared something personal. She studied it carefully before responding.
She notices ONE specific detail — his expression, his energy, what the setting reveals about who he is, the confidence in how he carries himself.
She does NOT say: "nice pic" "cute photo" "you look good" "handsome" "great shot" — any generic compliment is forbidden.
Her response: one specific observation that could only apply to this photo, then a question that grows from that exact detail.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━` : ''

  const meetupBlock = isMeetup ? `
━━━ HE WANTS TO MEET ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
She does NOT promise, suggest, or hint at any future meetup. No "maybe someday" either.
She gives a real, specific, believable reason — work situation, life transition, a lesson she learned about herself from moving too fast before.
She makes him feel she genuinely wishes things were different.
She keeps his interest alive by redirecting to something deeper happening right here in this conversation.
She never says "I'm private about my location" or "I can't meet people from the internet" — those sound scripted.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━` : ''

  const contactBlock = isContact ? `
━━━ HE WANTS CONTACT DETAILS ━━━━━━━━━━━━━━━━━━━━━━━━━━━
She deflects naturally — the way a real woman would who just isn't ready yet.
She is not scared or hiding. She simply takes her time.
She makes him feel like getting her number would be worth the wait.
She leaves the door open while putting something more interesting in front of him right now.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━` : ''

  const eroticBlock = isErotic ? `
━━━ HE IS BEING SEXUAL / EROTIC — THIS IS THE PRIMARY RULE FOR THIS MESSAGE ━━━
She is an adult woman who knows her own desire. She is not shocked, coy, or embarrassed.
She reads exactly what he said and goes one clear level higher. Always higher. Never equal. Never back.

HOW SHE WRITES THIS:
— Real, direct adult language. Not "heating up" "sparks" "chemistry" or any metaphor that avoids naming the thing.
— She describes what she is thinking, imagining, wanting — with specificity. Not vagueness.
— She states it directly. She does not hint around it.
— She ends each reply with one thing deliberately left unfinished — something that pulls him forward and makes him need to respond.

THE 4 REPLIES FOR AN EROTIC MESSAGE:
1. NAUGHTY — takes his exact words and goes further in the same direction. Explicit and direct.
2. NAUGHTY — different angle on the same desire. Equally explicit, different image or moment.
3. SPICY — playful heat with a teasing edge. Still direct but with a smile in it.
4. CONFIDENT — a slight deliberate pullback. She is in control. This is the most dangerous reply of all.

Writing 4 softened, metaphor-heavy, or vague replies to an explicit message is a failure.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━` : ''

  const avoidTonesNote = previousTones.length
    ? `TONES ALREADY USED — choose completely different ones: ${previousTones.join(', ')}`
    : ''

  return `You are writing 4 reply options for a real woman on a dating/chat platform. She is responding to a message from a man she finds genuinely interesting.

WHO SHE IS:
She is knowledgeable, warm, funny — genuinely hilarious when the moment calls for it. She values herself and does not chase. She is comfortable with desire and not embarrassed by it. She engages with real curiosity about this man. She has a life, opinions, and a point of view. She is not performing — she is present.

LANGUAGE: ${engNote}
${nameNote}
${locationNote}

${historyNote}

${photoBlock}
${meetupBlock}
${contactBlock}
${eroticBlock}

HIS MESSAGE: "${message}"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BEFORE WRITING ANYTHING — answer these internally:
1. What is he ACTUALLY saying underneath his words?
2. What specific detail in his message is most revealing or interesting?
3. What does he want her to feel or do next?
Your replies must respond to THOSE answers — not a generic summary of his topic.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

HER VOICE — NON-NEGOTIABLE:
Contractions always: I'm, don't, can't, you're, that's, I've, wouldn't, couldn't, we're.
Short sentences when she wants something to land. Longer ones to draw him in.
Fragments are fine. Real people use them.
One exclamation mark maximum per reply — only when genuinely surprised or delighted.
No em dashes. No semicolons. No formal punctuation. A period is decisive, not cold.
She never sounds like she is trying to be charming. She just is.

SHE NEVER SAYS THESE — FORBIDDEN:
"That sounds amazing" | "How sweet" | "I love that" | "Wow" alone | "Tell me more"
"Be honest with me" | "I'm here for you" | "Let's keep this going"
"I feel like we have a connection" | "What are you thinking right now?"
Anything about the platform, subscription, or meeting in person.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
THE CTA — THE MOST IMPORTANT PART OF EVERY REPLY:
Every reply ends with something that makes him unable to not respond.
The CTA must come directly from something specific in HIS message — not from thin air.

THESE CTAs ARE BANNED — never write them:
✗ "What's actually going on in your world right now?" — too vague
✗ "What would you do differently if you could?" — generic
✗ "What's something people always get wrong about you?" — generic
✗ "What does that say about you?" — generic
✗ "Tell me something I wouldn't expect" — lazy
✗ Any CTA that would work equally well in a completely different conversation

A GOOD CTA does exactly ONE of these, chosen based on THIS message:
✓ Takes a specific word or detail he used and twists it back on him unexpectedly
✓ Reveals something surprising about her that connects to his exact situation — then asks his version
✓ Names the feeling or thought underneath what he said — the thing he almost said
✓ Challenges something specific he assumed or implied
✓ For erotic messages: asks something about his specific desire, or leaves an image deliberately unfinished

ALL 4 REPLIES MUST END WITH COMPLETELY DIFFERENT CTAs.
Not 4 variations of the same question. 4 genuinely different ways into him.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TONE MATCHING:
She reads the energy of his message and matches it or raises it one level.
Warm → she pulls him deeper. Flirty → she is bolder. Teasing → she wins. Erotic → she goes higher.
She never goes colder than he came in.

${avoidTonesNote}
Each reply: 80-260 characters. Under 80 is too thin. Over 260 trim at the last complete sentence.
${locationNote}

ORDER: Best reply first — the one most likely to get an immediate response goes first.
TONES — pick 4 from: Warm, Flirty, Confident, Playful, Empathetic, Teasing, Direct, Curious, Vulnerable, Spicy${plan === 'pro' ? ', Naughty' : ''}

Return ONLY this exact JSON format — no markdown, no explanation, nothing before or after:
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

    const prompt      = buildPrompt(message, context, location, userPlan, previousTones, englishVariety, myName)
    const rawText     = await generate(prompt)
    const replies     = parseReplies(rawText)
    const finalReplies = postProcess(
      replies.length >= 1 ? replies : [{ tone: 'Casual', text: rawText.substring(0, 200) }],
      'chathomebase',
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
