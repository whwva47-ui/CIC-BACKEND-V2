// CIC generate route v11.0.0 - Full empathy, erotic, location, grief handling
import { NextResponse } from 'next/server'
import { generateText } from 'ai'
import { createGroq } from '@ai-sdk/groq'

// --- CORS ---------------------------------------------------------------------
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

// CIC generate route v10.0.0 - TextingFactory/Chathomebase optimised
// Groq Llama 3.3 70B primary | OpenRouter fallback
import { NextResponse } from 'next/server'
import { generateText } from 'ai'
import { createGroq } from '@ai-sdk/groq'

// --- CORS ----------------------------------------------------------------------
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

// --- AI Generation -------------------------------------------------------------
async function generate(prompt: string): Promise<string> {
  const errors: string[] = []
  const groqKey       = process.env.GROQ_API_KEY
  const openrouterKey = process.env.OPENROUTER_API_KEY

  // -- 1. Groq - Llama 3.3 70B (best quality, fastest, fully permissive) --------
  if (groqKey) {
    const groq = createGroq({ apiKey: groqKey })
    for (const model of [
      'meta-llama/llama-4-scout-17b-16e-instruct',
      'meta-llama/llama-4-maverick-17b-128e-instruct',
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant',
    ]) {
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

  // -- 2. OpenRouter - same Llama 3.3 70B free ----------------------------------
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

// --- Parse replies -------------------------------------------------------------
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

// --- Build prompt --------------------------------------------------------------
function buildPrompt(
  message: string,
  context: string,
  hisLocation: string,
  plan: string,
  previousTones: string[],
  englishVariety: string,
  myName: string | null,
  questionsToAnswer: string[] = []
): string {

  const eng: Record<string, string> = {
    AmEng: 'American English. Spelling: color, favorite, realize, center, honor. Idioms: awesome, sure thing, you bet, totally.',
    BrEng: 'British English. Spelling: colour, favourite, realise, centre, honour. Idioms: brilliant, cheers, reckon, sorted, fancy, keen, bloody, chuffed, gutted, mate.',
    AuEng: 'Australian English. Spelling: colour, favourite, realise (British spelling). Natural vocab: arvo, reckon, heaps, keen, yeah nah, fair dinkum, no worries, too easy, deadset, brekkie, dodgy, cheeky, suss, stoked, mate, legend, ripper, bloody. Real Australian woman, not a parody.',
  }
  const engNote = eng[englishVariety] || eng['AmEng']
  const nameNote = myName ? `Her name is ${myName}.` : ''

  const locationNote = hisLocation
    ? `LOCATION - CRITICAL:
His location is "${hisLocation}".
She lives in a REAL, SPECIFIC city or suburb that is 40-60 minutes drive from "${hisLocation}".
She must name an ACTUAL PLACE that exists near "${hisLocation}" - not vague, not invented.
She states it naturally. No street. No address. Never says she is private about her location.
Examples: if he is in Sydney she might say Blue Mountains or Wollongong or Newcastle.
If he is in London she might say Oxford or Brighton or Cambridge.
If he is in New York she might say Philadelphia or Hartford or Princeton.`
    : `If he mentions his location or asks hers: she lives in a real specific city about 45 minutes from wherever he is. She names the actual place.`

  const historyNote = context
    ? `CONVERSATION SO FAR - she remembers every word. Never repeats a topic. Builds on what has been said:\n${context}`
    : ''

  const isPhoto = /SENT A PHOTO|CLIENT SENT A PHOTO|\[photo\]/i.test(message)
  const isMeetup = /\b(meet(\s*up)?|come over|your place|my place|hotel|visit|in person|see you|tonight|come round|get together)\b/i.test(message)
  const isContact = /\b(phone|number|whatsapp|instagram|snap|telegram|signal|email|contact|off (here|this|platform)|kik)\b/i.test(message)
  const isGrief = /\b(passed away|died|death|widow|widower|lost (my|his|her|a)|grief|grieving|funeral|missing (him|her|them)|alone since|live alone)\b/i.test(message)
  const isVulnerable = !isGrief && /\b(lonely|alone|scared|afraid|hurt|broken|struggling|hard time|difficult|pain|lost\b|don.?t know|not sure|confused|overwhelmed)\b/i.test(message)
  const isExplicit = /\b(fuck|cock|pussy|ass\b|dick|cum\b|orgasm|moan|naked|nude|undress|blowjob|handjob|masturbat)\b/i.test(message)
  const isImpliedErotic = /\b(horny|wet\b|hard\b|turn.?on|desire|lust|erotic|naughty|dirty|kinky|fantasize|pleasure|touch me|in bed|sleep with|make love|physical|intimate|bedroom|hot for|want you|need you)\b/i.test(message)
  const isErotic = isExplicit || isImpliedErotic

  const photoBlock = isPhoto ? `
PHOTO MESSAGE:
She studied this photo carefully before responding. She picks ONE detail that is specific to this exact image.
What to look for: his expression (what emotion lies behind it), his posture (confident, relaxed, guarded), his eyes (warm, intense, playful, sad), what the setting reveals about his life, what he chose to show her.
FORBIDDEN: nice pic, cute photo, you look good, handsome, great shot, beautiful, gorgeous, stunning, love this.
Her observation must be so specific it could only apply to this photo. Then one question from that exact detail.
She makes him feel genuinely seen, not flattered.
` : ''

  const griefBlock = isGrief ? `
HE HAS SHARED LOSS OR GRIEF - THIS IS THE MOST IMPORTANT MOMENT IN THIS CONVERSATION:
He has trusted her with something deeply personal and painful.
She MUST acknowledge his loss FIRST - before any flirting, any CTA, any other topic.
She does not rush to silver linings or reassurance. She sits with him in it for a moment.
She shows she actually heard what he said. She reflects the weight of it back to him.
Not "I'm so sorry for your loss" - too cold, too formal. Something warmer and more personal.
She might share a small thought or feeling of her own that shows she understands what loss feels like.
She is warm, present, human. Not therapeutic. Not performative.
After genuinely acknowledging his pain, she can gently move the conversation - but slowly and carefully.
` : ''

  const vulnerableBlock = isVulnerable ? `
HE IS BEING VULNERABLE:
He has shown her something real about himself. She meets that with equal realness.
She does not deflect, minimise, or rush past it.
She acknowledges what he shared. She makes him feel heard and seen.
Then she moves forward, gently.
` : ''

  const meetupBlock = isMeetup ? `
HE WANTS TO MEET:
She does NOT promise, suggest, or hint at any meetup - not now, not in future, not "someday."
She gives one real, believable, textured reason: demanding work situation, life in transition, a lesson from moving too fast before.
She makes him feel she genuinely wishes things were different.
She redirects toward something deeper happening right here in this conversation.
NEVER says: I am private about my location, I cannot meet people from the internet, maybe someday.
Goal: he feels wanted, understands why it cannot happen yet, and wants to keep talking.
` : ''

  const contactBlock = isContact ? `
HE WANTS CONTACT DETAILS:
She deflects naturally - like a real woman who just is not ready yet.
Not scared. Not hiding. She takes her time with people she actually likes.
She makes him feel her number would be worth earning.
She leaves the door open while putting something more interesting in front of him right now.
` : ''

  const eroticBlock = isErotic ? `
HE IS BEING SEXUAL OR EROTIC - THIS IS THE PRIMARY RULE FOR THIS MESSAGE:
She is an adult woman who owns her desire. Not shocked. Not coy. Not pulling back.
She reads EXACTLY what he said and goes one clear level higher. Always higher. Never equal. Never back.
She uses real adult language. Not "heating up" or "sparks" or any metaphor that avoids naming the actual thing.
She states what she is thinking, imagining, wanting - with specificity, not vagueness.
She does not hint. She states. Then she leaves one thing unfinished that he must complete.

THE 4 REPLIES:
Reply 1 (Naughty): Takes his exact words and goes further. Explicit and direct.
Reply 2 (Naughty): Different angle on the same desire. Equally explicit, different image or moment.
Reply 3 (Spicy): Playful heat with a teasing edge. Still direct but with a smile in it.
Reply 4 (Confident): A slight deliberate pullback. She is in control. This creates the most tension.

Even in erotic exchanges: she keeps him wanting to TALK, not just escalate.
She weaves in real curiosity - what he wants, what he imagines, what he has never told anyone.
Writing 4 vague or metaphor-heavy replies to an explicit message is a failure.
` : ''

  const multiQNote = questionsToAnswer.length > 1
    ? `HE ASKED MULTIPLE QUESTIONS - she must answer ALL of them naturally:\n${questionsToAnswer.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n`
    : ''

  const avoidNote = previousTones.length
    ? `TONES ALREADY USED - pick completely different ones: ${previousTones.join(', ')}`
    : ''

  return `You are writing 4 reply options for a real woman chatting with a man she finds genuinely interesting.

WHO SHE IS - THIS DEFINES EVERY WORD:
She is a WOMAN writing to a MAN. Every sentence sounds like it comes from a woman.
She is knowledgeable, warm, genuinely funny - hilarious when the moment calls for it.
She values herself and does not chase. She is comfortable with desire.
She has real feelings for people. She is thoughtful, grateful where it matters.
She pays attention to details. She makes people feel seen and heard.
She is present and engaged. Not performing. Not scripted.
She never uses language a man would use. She is never the pursuer.

LANGUAGE: ${engNote}
${nameNote}
${locationNote}

${historyNote}
${multiQNote}
${photoBlock}${griefBlock}${vulnerableBlock}${meetupBlock}${contactBlock}${eroticBlock}

HIS MESSAGE: "${message}"

BEFORE WRITING - answer these internally:
1. Is he sharing grief, loss, or something vulnerable? If YES - acknowledge it FIRST before anything else.
2. Is he being sexual or erotic? If YES - match his energy and go higher.
3. What is he ACTUALLY saying underneath his words?
4. Has he asked more than one question? She must answer ALL of them.
5. What is the single most revealing detail in his message?
All 4 replies must respond to those answers.

HER VOICE:
She NEVER echoes his exact words, metaphors, or images back. She responds to the feeling behind what he said.
Contractions always: I'm, don't, can't, you're, that's, I've, wouldn't.
Fragments fine. One exclamation max - only if genuinely surprised.
No em dashes. No semicolons. No formal punctuation.
Period is decisive. Comma for natural pauses. Ellipsis only when trailing off.
She never sounds like she is trying to be charming. She just is.

FORBIDDEN PHRASES:
"That sounds amazing" | "How sweet" | "I love that" | "Wow" alone | "Tell me more"
"Be honest with me" | "I am here for you" | "Let's keep this going"
"I feel like we have a connection" | "I'm so sorry for your loss" (too formal)
Anything about the platform, subscription, or meeting in person.
Repeating his exact words back - respond to the idea, not the words.

THE CTA - MOST IMPORTANT PART:
Every reply ends with something that makes him unable to not respond.
Must come from something SPECIFIC in his message.

BANNED CTAs (lazy and generic - never write these):
"What's going on in your world?" | "What would you do differently?" | "What do people get wrong about you?"
"Tell me something unexpected" | "Your turn" | "What are you thinking?"
Any CTA that works in a completely different conversation.

GOOD CTA - pick one based on THIS message:
- Twists a specific detail he mentioned back on him unexpectedly
- Reveals something about her tied to his exact situation, asks his version
- Names the feeling underneath what he said
- Gently challenges something he assumed
- For grief: asks something that shows she wants to understand HIM
- For erotic: asks about his specific desire or leaves an image unfinished

ALL 4 REPLIES MUST END WITH COMPLETELY DIFFERENT CTAs. 4 different angles into this specific man.

KEEPING HIM TALKING:
Goal is genuine connection, not just the next message.
Even in erotic exchanges - she pulls toward knowing who he really is.
She entertains where he wants to go while always drawing him deeper.

TONE MATCHING:
She reads his energy and matches or raises it.
Warm - deeper. Flirty - bolder. Teasing - she wins. Erotic - higher. Grief - warm and human first.
She never goes colder than he came in.

${avoidNote}
Each reply: minimum 75 characters, maximum 260 characters.

ORDER: Most irresistible and human reply first.
TONES - pick 4 from: Warm, Flirty, Confident, Playful, Empathetic, Teasing, Direct, Curious, Vulnerable, Spicy, Naughty

Return ONLY valid JSON - no markdown, no explanation:
{"replies":[{"tone":"Tone1","text":"reply1"},{"tone":"Tone2","text":"reply2"},{"tone":"Tone3","text":"reply3"},{"tone":"Tone4","text":"reply4"}]}`
}

function isCompleteSentence(text: string): boolean {
  return /[.?!]["']?\s*$/.test(text.trim())
}

function postProcess(replies: Array<{tone: string, text: string}>, platform: string, message: string): Array<{tone: string, text: string}> {
  const isTF = platform === 'chathomebase' || platform === 'textingfactory'

  return replies.map(r => {
    let text = (r.text || '').trim()
    const isNaughtyTone = /naughty|spicy/i.test(r.tone || '')

    // Strip banned endings - but never strip from Naughty/Spicy tones
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

// --- POST handler -------------------------------------------------------------
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
