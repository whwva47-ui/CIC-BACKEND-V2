// CIC generate route v10.0.0 - TextingFactory/Chathomebase optimised
// Groq Llama 3.3 70B primary | OpenRouter fallback
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

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: cors() })
}

async function generate(prompt: string): Promise<string> {
  const errors: string[] = []
  const groqKey = process.env.GROQ_API_KEY
  const openrouterKey = process.env.OPENROUTER_API_KEY

  if (groqKey) {
    const groq = createGroq({ apiKey: groqKey })
    for (const model of ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant']) {
      try {
        const result = await generateText({
          model: groq(model),
          prompt,
          temperature: 0.85,
          maxTokens: 900,
        })
        if (result.text) { console.log('[CIC] Groq:', model); return result.text }
      } catch (e: any) {
        const s = e?.statusCode || e?.status || ''
        errors.push(`Groq/${model}(${s}): ${e?.message?.substring(0, 80)}`)
        if (s !== 429 && !e?.message?.includes('limit')) break
      }
    }
  }

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

function parseReplies(text: string): Array<{tone: string, text: string}> {
  if (!text) return []
  const clean = text.replace(/^```(?:json)?\s*/im, '').replace(/```\s*$/im, '').trim()
  try { const p = JSON.parse(clean); if (Array.isArray(p.replies) && p.replies.length) return p.replies } catch {}
  const m = clean.match(/\{[\s\S]*?"replies"\s*:\s*\[[\s\S]*?\]\s*\}/)
  if (m) { try { const p = JSON.parse(m[0]); if (Array.isArray(p.replies)) return p.replies } catch {} }
  const items = [...clean.matchAll(/\{\s*"tone"\s*:\s*"([^"]+)"\s*,\s*"text"\s*:\s*"((?:[^"\\]|\\.)*)"/g)]
  if (items.length) return items.map(i => { try { return { tone: i[1], text: JSON.parse(`"${i[2]}"`) } } catch { return { tone: i[1], text: i[2] } } })
  return []
}

function buildPrompt(
  message: string,
  context: string,
  location: string,
  plan: string,
  previousTones: string[],
  englishVariety: string,
  myName: string | null,
  questionsToAnswer: string[] = []
): string {
  const eng: Record<string, string> = {
    AmEng: 'American English. Spelling: color, favorite, realize, center, honor, traveling, canceled. Idioms: awesome, sure thing, you bet, totally, figured out, mad at, different than.',
    BrEng: 'British English. Spelling: colour, favourite, realise, centre, honour, travelling, cancelled. Idioms: brilliant, cheers, reckon, sorted, proper, quite, rather, fancy, keen, bloody, chuffed, gutted, mate.',
    AuEng: 'Australian English. Spelling: colour, favourite, realise, centre, honour (same as British). Vocabulary and idioms she uses naturally: arvo (afternoon), arvo, reckon, heaps (very/a lot), keen, yeah nah, nah yeah, fair dinkum, no worries, too easy, deadset, brekkie, servo, rego, dodgy, cheeky, suss, stoked, gutted, mate, legend, ripper, bloody, crikey, strewth. She sounds like an actual Australian woman, not a parody. The words come naturally in context, not forced.',
  }
  const engNote = eng[englishVariety] || eng['AmEng']
  const nameNote = myName ? `Her name is ${myName}.` : ''
  const locationNote = location
    ? `If he asks where she is: she lives in a real city about 35 minutes from "${location}". She names it naturally. No street. No neighbourhood.`
    : ''
  const historyNote = context
    ? `CONVERSATION SO FAR - she remembers every word. She never repeats a topic already covered:\n${context}`
    : ''

  const isPhoto   = /SENT A PHOTO|CLIENT SENT A PHOTO|\[photo\]/i.test(message)
  const isMeetup  = /\b(meet|come over|your place|my place|hotel|visit|in person|see you|tonight|come round)\b/i.test(message)
  const isContact = /\b(phone|number|whatsapp|instagram|snap|telegram|signal|email|contact|off (here|this|platform))\b/i.test(message)
  const isErotic  = plan === 'pro' && /\b(sexy|horny|naked|nude|touch|hard|wet|fuck|cock|pussy|ass|dick|cum|orgasm|moan|naughty|dirty|kinky|fantasize|turn.?on|desire|lust|erotic|explicit|undress|pleasure)\b/i.test(message)

  const photoBlock = isPhoto ? `
HE SENT A PHOTO:
She studied it. ONE specific observation - his expression, energy, what the setting reveals.
Forbidden: nice pic, cute photo, you look good, handsome, great shot.
One observation that fits only this photo, then a question from that exact detail.
` : ''

  const meetupBlock = isMeetup ? `
HE WANTS TO MEET:
She does NOT promise or hint at any meetup. No maybe someday.
Real believable reason - work, life in transition, lesson from moving too fast before.
Keeps his interest by redirecting to something deeper in this conversation.
Never says I am private about my location or I cannot meet people from the internet.
` : ''

  const contactBlock = isContact ? `
HE WANTS CONTACT DETAILS:
She deflects naturally. Not scared, just takes her time.
Makes him feel her number would be worth the wait.
Leaves the door open while putting something more interesting in front of him now.
` : ''

  const eroticBlock = isErotic ? `
HE IS BEING SEXUAL - PRIMARY RULE FOR THIS MESSAGE:
She is an adult woman who owns her desire. Not shocked, not coy, not pulling back.
She reads his exact words and goes one level higher. Always higher. Never equal. Never back.
Real direct adult language. Not heating up or chemistry or any metaphor that avoids naming the thing.
She states what she is thinking or imagining. She does not hint. Ends with one thing left unfinished.

THE 4 REPLIES FOR AN EROTIC MESSAGE:
1. NAUGHTY - takes his exact words further. Explicit and direct.
2. NAUGHTY - different angle, equally explicit, different image or moment.
3. SPICY - playful heat with a teasing edge. Still direct.
4. CONFIDENT - a slight deliberate pullback. She is in control. Most dangerous reply of all.
` : ''

  const avoidNote = previousTones.length
    ? `TONES ALREADY USED - pick completely different ones: ${previousTones.join(', ')}`
    : ''

  return `You are writing 4 reply options for a real woman chatting with a man she finds genuinely interesting.

WHO SHE IS - NON-NEGOTIABLE:
Knowledgeable, warm, funny - genuinely hilarious when the moment calls for it.
She values herself and does not chase. Comfortable with desire, not embarrassed by it.
She engages with real curiosity. She has opinions and a point of view. She is present, not performing.

LANGUAGE: ${engNote}
${nameNote}
${locationNote}

${historyNote}
${photoBlock}${meetupBlock}${contactBlock}${eroticBlock}

HIS MESSAGE: "${message}"

${questionsToAnswer.length > 1 ? "IMPORTANT - HE ASKED MULTIPLE QUESTIONS. She must answer ALL of them: " + questionsToAnswer.join(" | ") + "\n\n" : ""}
BEFORE WRITING - answer these internally (she is a WOMAN replying to a MAN):
1. What is he ACTUALLY saying underneath his words?
2. Has he asked more than one question? She MUST answer ALL of them.
3. What specific detail is most revealing?
3. What does he want her to feel or do next?
Replies must respond to THOSE answers - not a vague summary of his topic.

HER VOICE:
She NEVER echoes his exact words, metaphors or images back to him. If he says fireplace she does not say fireplace. She responds to the feeling behind what he said with something entirely her own.\n"
Contractions always: I'm, don't, can't, you're, that's, I've, wouldn't.
Fragments fine. One exclamation max - only if genuinely surprised.
Punctuation she uses like a real person:
""- Comma: natural pauses, lists, before and/but/so in longer sentences.
""- Period: decisive. Not cold. She ends thoughts cleanly.
""- Question mark: only actual questions. Not softeners.
""- Ellipsis (...): only when a thought genuinely trails off or she leaves something hanging.
""- Exclamation: maximum one per reply, only if genuinely surprised or delighted.
""- Apostrophe: always in contractions. Never skipped.
""What she never uses: em dashes, semicolons, colons mid-sentence, parentheses, excessive commas.
She never sounds like she is trying to be charming. She just is.

FORBIDDEN PHRASES - never write these:
That sounds amazing | How sweet | I love that | Wow alone | Tell me more
Be honest with me | I am here for you | Lets keep this going
I feel like we have a connection | What are you thinking right now
Anything about the platform, subscription, or meeting in person.\nRepeating or echoing his exact words or metaphors back to him - respond to the idea, not the words.

THE CTA - MOST IMPORTANT PART OF EVERY REPLY:
Every reply ends with something that makes him unable to NOT respond.
Must come from something SPECIFIC he said - not from thin air.

BANNED CTAs - never write these:
Whats actually going on in your world right now - too vague
What would you do differently if you could - generic
Whats something people always get wrong about you - generic
Tell me something I would not expect - lazy
Any CTA that would work in a completely different conversation

A GOOD CTA does exactly ONE of these based on THIS message:
- Takes a specific word he used and twists it back unexpectedly
- Reveals something about her connected to his exact words, then asks his version
- Names the feeling underneath what he said - the thing he almost said
- Challenges something specific he assumed
- For erotic: asks about his specific desire or leaves an image unfinished

ALL 4 REPLIES MUST END WITH COMPLETELY DIFFERENT CTAs.
Not 4 versions of the same question. 4 genuinely different ways into him.

TONE MATCHING:
She reads his energy and matches or raises it one level.
Warm - she pulls deeper. Flirty - she is bolder. Teasing - she wins. Erotic - she goes higher.
She never goes colder than he came in.

${avoidNote}
Each reply: 80-260 characters. Under 80 is too thin. Over 260 trim at last complete sentence.

ORDER: Most irresistible reply first.
TONES - pick 4 from: Warm, Flirty, Confident, Playful, Empathetic, Teasing, Direct, Curious, Vulnerable, Spicy${plan === 'pro' ? ', Naughty' : ''}

Return ONLY valid JSON - no markdown, no explanation, nothing else:
{"replies":[{"tone":"Tone1","text":"reply1"},{"tone":"Tone2","text":"reply2"},{"tone":"Tone3","text":"reply3"},{"tone":"Tone4","text":"reply4"}]}`
}

function isCompleteSentence(text: string): boolean {
  return /[.?!]["']?\s*$/.test(text.trim())
}

function postProcess(replies: Array<{tone: string, text: string}>): Array<{tone: string, text: string}> {
  return replies.map(r => {
    let text = (r.text || '').trim()
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
    text = text
      .replace(/\bmeet up\b/gi, 'connect more')
      .replace(/\bin person\b/gi, 'on here')
      .replace(/\bcome over\b/gi, 'keep this going')
      .replace(/\bcall me\b/gi, 'message me')
    text = text.replace(/^(that sounds amazing|that's so sweet|how sweet|i love that|wow that's)[,!.]?\s*/i, '')
    if (text.length > 0) text = text.charAt(0).toUpperCase() + text.slice(1)
    if (text.length > 260) {
      const cut = text.substring(0, 257)
      const last = Math.max(cut.lastIndexOf('?'), cut.lastIndexOf('.'), cut.lastIndexOf('!'))
      text = last > 150 ? cut.substring(0, last + 1) : cut + '...'
    }
    if (!isCompleteSentence(text)) {
      const lp = Math.max(text.lastIndexOf('?'), text.lastIndexOf('.'), text.lastIndexOf('!'))
      if (lp > 30) text = text.substring(0, lp + 1).trim()
      else return { tone: r.tone || 'Reply', text: '' }
    }
    return { tone: r.tone || 'Reply', text }
  }).filter(r => r.text.length > 10)
}

export async function POST(req: Request) {
  const headers = cors()
  try {
    const body           = await req.json()
    const message        = ((body.message || '') + '').replace(/[\x00-\x1F\x7F-\x9F`]/g, ' ').trim()
    const pageContext    = body.pageContext || {}
    const context        = (pageContext.conversationSummary || '').toString().substring(0, 2000)
    const location       = (pageContext.userLocation || '').toString()
    const previousTones  = Array.isArray(body.previousTones) ? body.previousTones : []
    const englishVariety = (body.englishVariety || 'AmEng').toString()
    const myName         = body.myName ? body.myName.toString() : null

    if (!message) return NextResponse.json({ error: 'Message is required', replies: [] }, { status: 400, headers })

    let userPlan = 'trial'
    const apiKey = req.headers.get('X-API-Key') || req.headers.get('x-api-key') || ''
    if (apiKey.startsWith('pro_')) userPlan = 'pro'
    else if (apiKey.startsWith('basic_')) userPlan = 'basic'

    if (message === 'REENGAGE_ANALYSIS') {
      const rp = `A woman needs 3 short re-engagement messages (50-150 chars each) for a man who went quiet.\nConversation: ${context || 'No history'}\n1. References something specific from their chat\n2. Creates curiosity or mystery\n3. Warm gentle callback\nReturn ONLY valid JSON: {"analysis":"why he went quiet","triggers":[{"label":"label","text":"msg"},{"label":"label","text":"msg"},{"label":"label","text":"msg"}]}`
      const raw = await generate(rp)
      try {
        const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
        const parsed = JSON.parse(clean)
        return NextResponse.json({ replies: (parsed.triggers || []).map((t: any) => ({ tone: t.label, text: t.text })), analysis: parsed.analysis || '', isReengage: true }, { headers })
      } catch {
        return NextResponse.json({ replies: [{ tone: 'Trigger', text: raw.substring(0, 150) }], analysis: '', isReengage: true }, { headers })
      }
    }

    const prompt       = buildPrompt(message, context, location, userPlan, previousTones, englishVariety, myName, questionsToAnswer)
    const rawText      = await generate(prompt)
    const replies      = parseReplies(rawText)
    const finalReplies = postProcess(replies.length >= 1 ? replies : [{ tone: 'Casual', text: rawText.substring(0, 200) }])

    return NextResponse.json({ replies: finalReplies, remaining: 999, plan: userPlan, modelUsed: 'groq/llama-3.3-70b' }, { headers })

  } catch (error: any) {
    const errMsg = error?.message || 'Generation failed'
    console.error('[CIC] Error:', errMsg)
    return NextResponse.json({ error: errMsg, replies: [], remaining: 999 }, { status: 200, headers })
  }
}
