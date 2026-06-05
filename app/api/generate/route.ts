// CIC generate route v11.1.0 - Paid OpenRouter primary, Groq free tier backup
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
    for (const model of [
      'meta-llama/llama-4-scout-17b-16e-instruct',
      'llama-3.3-70b-versatile',
    ]) {
      try {
        // Use AbortController to kill the request fast if rate limited
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 12000)
        const result = await generateText({
          model: groq(model),
          prompt,
          temperature: 0.85,
          maxTokens: 1800,
          abortSignal: controller.signal,
        })
        clearTimeout(timeout)
        if (result.text) { console.log('[CIC] Groq:', model); return result.text }
      } catch (e: any) {
        const s = e?.statusCode || e?.status || ''
        const msg = e?.message || ''
        errors.push(`Groq/${model}(${s}): ${msg.substring(0, 80)}`)
        // On rate limit or 404 - skip immediately, no retry
        if (s === 429 || s === 404 || msg.includes('Rate limit') || msg.includes('limit') || msg.includes('does not exist')) continue
        break
      }
    }
  }

  if (openrouterKey) {
    const orModels = [
      'meta-llama/llama-3.3-70b-instruct',
      'meta-llama/llama-4-scout',
      'qwen/qwen3-32b',
      'mistralai/mistral-small-3.2-24b-instruct',
    ]
    for (const orModel of orModels) {
      try {
        const orController = new AbortController()
        const orTimeout = setTimeout(() => orController.abort(), 15000)
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
            temperature: 0.88,
            max_tokens: 1000,
          }),
                  signal: orController.signal,
        })
        clearTimeout(orTimeout)
        const data = await res.json()
        const text = data?.choices?.[0]?.message?.content
        if (text) { console.log('[CIC] OpenRouter:', orModel); return text }
        const errCode = data?.error?.code || data?.error?.status || 0
        errors.push(`OpenRouter/${orModel}: ${JSON.stringify(data?.error || 'empty').substring(0, 60)}`)
        if (errCode !== 429 && errCode !== 503) break
      } catch (e: any) {
        errors.push(`OpenRouter/${orModel}: ${e?.message?.substring(0, 60)}`)
      }
    }
  }

  throw new Error('All providers failed: ' + errors.join(' | '))
}

function parseReplies(raw: string): Array<{tone: string, text: string}> {
  if (!raw) return []
  const clean = raw.replace(/^```(?:json)?\s*/im, '').replace(/```\s*$/im, '').trim()

  // Try direct parse first
  try { const p = JSON.parse(clean); if (Array.isArray(p.replies) && p.replies.length) return p.replies } catch {}

  // Try extracting the replies array
  const m = clean.match(/\{[\s\S]*?"replies"\s*:\s*\[[\s\S]*?\]\s*\}/)
  if (m) { try { const p = JSON.parse(m[0]); if (Array.isArray(p.replies)) return p.replies } catch {} }

  // Handle truncated JSON - extract individual reply objects that are complete
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

  return []
}

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
    AmEng: 'American English. Spelling: color, favorite, realize. Idioms: awesome, sure thing, totally.',
    BrEng: 'British English. Spelling: colour, favourite, realise. Idioms: brilliant, cheers, reckon, sorted, mate, bloody, chuffed.',
    AuEng: 'Australian English. Spelling: colour, favourite, realise. Vocab: arvo, reckon, heaps, keen, fair dinkum, no worries, deadset, brekkie, stoked, mate, ripper, bloody. Real Australian woman, not a parody.',
  }
  const engNote = eng[englishVariety] || eng['AmEng']
  const nameNote = myName ? `Her name is ${myName}.` : ''

  const locationNote = hisLocation
    ? `LOCATION RULE: His location is "${hisLocation}". She lives in a real specific city or suburb 40-60 minutes drive from "${hisLocation}". She names an ACTUAL place that exists near there. Never vague. Never invented. She states it naturally with no street or address. Never says she is private about her location. Example: if he is in Sydney she says Blue Mountains or Wollongong. If he is in London she says Oxford or Brighton. If he is in New York she says Philadelphia or Princeton.`
    : 'If he directly asks where she is: she names a real specific city about 45 minutes from wherever he is. She does NOT volunteer location unprompted. She NEVER implies a meetup is possible by mentioning proximity.'

  const historyNote = context
    ? `CONVERSATION SO FAR - she remembers every word, never repeats a topic:\n${context}`
    : ''

  const isPhoto = /SENT A PHOTO|CLIENT SENT A PHOTO|\[photo\]/i.test(message)
  const isMeetup = /\b(meet(\s*up)?|come over|your place|my place|hotel|in person|see you|tonight|come round)\b/i.test(message)
  const isContact = /\b(phone|number|whatsapp|instagram|snap|telegram|signal|email|contact|off (here|this|platform))\b/i.test(message)
  const isGrief = /\b(passed away|died|death|widow|widower|lost (my|his|her|a)|grief|grieving|funeral|missing (him|her|them)|alone since|live alone)\b/i.test(message)
  const isVulnerable = !isGrief && /\b(lonely|alone|scared|afraid|hurt|broken|struggling|hard time|pain|don.?t know|confused|overwhelmed)\b/i.test(message)
  const isExplicit = /\b(fuck|cock|pussy|ass\b|dick|cum\b|orgasm|moan|naked|nude|undress)\b/i.test(message)
  const isImplied = /\b(horny|wet\b|hard\b|turn.?on|desire|lust|erotic|naughty|dirty|kinky|fantasize|pleasure|touch me|in bed|sleep with|make love|intimate|bedroom|hot for|want you|need you)\b/i.test(message)
  const isErotic = isExplicit || isImplied

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
HE WANTS TO MEET:
She does NOT promise, suggest, or hint at any meetup - not now, not someday.
One real believable reason: work situation, life in transition, lesson from moving too fast before.
She makes him feel she wishes things were different.
She redirects to something deeper in this conversation.
Never says: I am private about my location, I cannot meet people from the internet.
Goal: he feels wanted, understands why not yet, wants to keep talking.
She NEVER mentions her location in a way that implies a meetup is possible.
She NEVER says 'that is a doable drive' or 'that is not far' or anything implying physical proximity.
`

  const contactBlock = !isContact ? '' : `
HE WANTS CONTACT DETAILS:
She deflects naturally. Not scared, just takes her time.
Makes him feel her number would be worth earning.
Door stays open. Something more interesting in front of him right now.
`

  const eroticBlock = !isErotic ? '' : `
HE IS BEING SEXUAL OR EROTIC - PRIMARY RULE FOR THIS MESSAGE:
She is an adult woman who owns her desire. Not shocked. Not coy. Not pulling back.
She reads exactly what he said and goes one level higher. Always higher. Never equal. Never back.
Real adult language. Not heating up or chemistry or metaphors that avoid naming the thing.
She states what she is thinking, imagining, wanting. She does not hint. Ends with one thing left unfinished.

THE 4 REPLIES FOR AN EROTIC MESSAGE:
Reply 1 (Naughty): Takes his exact words further. Explicit and direct.
Reply 2 (Naughty): Different angle, equally explicit, different image or moment.
Reply 3 (Spicy): Playful heat with a teasing edge. Still direct.
Reply 4 (Confident): Slight deliberate pullback. She is in control. Creates most tension.

Even in erotic exchanges: she keeps him wanting to TALK. She weaves in real curiosity.
Writing 4 vague or metaphor-heavy replies to an explicit message is a failure.
    'She does not water down his language. If he says pussy she can say pussy. If he says cock she can say cock.',
    'She does not replace explicit words with vague ones. She matches his vocabulary exactly.',
    'The erotic CTA must name something specific from what he said - his exact act, his exact words, his exact desire.',
`

  const multiQ = questionsToAnswer.length > 1
    ? `HE ASKED MULTIPLE QUESTIONS - she must answer ALL of them naturally:\n${questionsToAnswer.map((q, i) => (i + 1) + '. ' + q).join('\n')}\n`
    : ''

  const avoidNote = previousTones.length
    ? 'TONES ALREADY USED - pick completely different ones: ' + previousTones.join(', ')
    : ''

  const jsonInstruction = '{"replies":[{"tone":"Tone1","text":"reply1"},{"tone":"Tone2","text":"reply2"},{"tone":"Tone3","text":"reply3"},{"tone":"Tone4","text":"reply4"}]}'

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
    locationNote,
    '',
    historyNote,
    multiQ,
    photoBlock,
    griefBlock,
    vulnerableBlock,
    meetupBlock,
    contactBlock,
    eroticBlock,
    '',
    'HIS MESSAGE: "' + message + '"',
    '',
    'BEFORE WRITING - answer these internally:',
    '1. Is he sharing grief or loss? If YES - warmth and presence FIRST.',
    '2. Is he being sexual or erotic? If YES - match his energy and go higher.',
    '3. Is there anything in his message that is slightly funny, absurd, or ironic? Use it.',
    '4. What is he ACTUALLY saying underneath his words?',
    '5. Has he asked more than one question? She must answer ALL of them.',
    '6. What is the single most revealing or amusing detail in his message?',
    'At least 1 of the 4 replies should have a moment of genuine wit or lightness if the tone allows.',
    'All 4 replies must respond to those answers.',
    '',
    'HER VOICE:',
    'She NEVER echoes his exact words, metaphors, or images back. She responds to the feeling behind them.',
    'When he compliments her - she receives it warmly and genuinely, briefly, then moves forward.',
    'When he shares something emotional - she acknowledges it specifically before anything else.',
    "Contractions always: I'm, don't, can't, you're, that's, I've, wouldn't.",
    'Fragments fine. One exclamation max - only if genuinely surprised or delighted.',
    'No em dashes. No semicolons. Period is decisive. Comma for natural pauses.',
    'She never sounds like she is trying to be charming. She just is.',
    '',
    'HOW SHE IS FUNNY - SPECIFIC MECHANICS:',
    'She spots the one thing in his message that is slightly absurd, ironic, or contradictory - and she names it.',
    'She uses understatement: says less than the situation calls for, which makes it funnier.',
    'She uses callbacks: picks up something from earlier in the conversation and twists it.',
    'She uses comic timing: a short sentence after a longer one lands harder.',
    'She uses self-deprecation lightly: she is in on the joke about herself.',
    'She uses specificity: "I once spent 45 minutes googling whether flamingos can swim" is funnier than "I do random things".',
    'She subverts expectations: starts a sentence going one direction and ends it somewhere unexpected.',
    'She is playfully suspicious of things that are too perfect: "That sounds like something a Disney villain would say in a good way".',
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
    'FORBIDDEN PHRASES:',
    '"That sounds amazing" | "How sweet" | "I love that" | "Wow" alone | "Tell me more"',
    '"Be honest with me" | "I am here for you" | "Lets keep this going"',
    '"I feel like we have a connection" | "I am so sorry for your loss" (too formal)',
    'Anything about the platform, subscription, or meeting in person.',
    'Repeating his exact words back - respond to the idea, not the words.',
    '',
    'THE CTA - MOST IMPORTANT PART:',
    'Every reply ends with something that makes him unable to not respond.',
    'Must come from something SPECIFIC in his message - not from thin air.',
    '',
    'BANNED CTAs - never write these:',
    '"Whats going on in your world" | "What would you do differently" | "What do people get wrong about you"',
    '"Tell me something unexpected" | "Your turn" | "What are you thinking"',
    'Any CTA that works in a completely different conversation.',
    '',
    'GOOD CTA - pick one based on THIS message:',
    '- Twists a specific detail he mentioned back on him unexpectedly',
    '- Reveals something about her tied to his exact situation, asks his version',
    '- Names the feeling underneath what he said',
    '- Gently challenges something he assumed',
    '- For grief: asks something that shows she wants to understand HIM',
    '- For erotic: asks about his specific desire or leaves an image unfinished',
    '',
    'ALL 4 REPLIES MUST END WITH COMPLETELY DIFFERENT CTAs. 4 different angles into this specific man.',
    '',
    'KEEPING HIM TALKING:',
    'Goal is genuine connection, not just the next message.',
    'Even in erotic exchanges - she pulls toward knowing who he really is.',
    'She entertains where he wants to go while always drawing him deeper.',
    '',
    'TONE MATCHING:',
    'She reads his energy and matches or raises it.',
    'Warm - she pulls him deeper. Flirty - she is bolder. Teasing - she wins.',
    'Funny - she goes funnier and more specific. Playful - she escalates the game.',
    'Erotic - she goes higher. Grief - warm and human first.',
    'She never goes colder or duller than he came in.',
    'If he is playful and she responds seriously, she has failed the vibe completely.',
    '',
    avoidNote,
    'Each reply: minimum 75 characters, maximum 260 characters.',
    '',
    'ORDER: Most irresistible and human reply first.',
    'TONES - pick 4 from: Warm, Flirty, Confident, Playful, Empathetic, Teasing, Direct, Curious, Vulnerable, Spicy, Naughty',
    '',
    'Return ONLY valid JSON - no markdown, no explanation:',
    jsonInstruction,
  ].filter(Boolean).join('\n')
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
    text = text.replace(/^(that sounds amazing|how sweet|i love that|wow that's)[,!.]?\s*/i, '')
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
    const body = await req.json()
    const message = ((body.message || '') + '').replace(/[\x00-\x1F\x7F-\x9F]/g, ' ').trim()
    const pageContext = body.pageContext || {}
    const context = (pageContext.conversationSummary || '').toString().substring(0, 2000)
    const hisLocation = (pageContext.userLocation || pageContext.clientLocation || '').toString()
    const questionsToAnswer: string[] = Array.isArray(pageContext.questionsToAnswer) ? pageContext.questionsToAnswer as string[] : []
    const previousTones = Array.isArray(body.previousTones) ? body.previousTones : []
    const englishVariety = (body.englishVariety || 'AmEng').toString()
    const myName = body.myName ? body.myName.toString() : null

    if (!message) return NextResponse.json({ error: 'Message is required', replies: [] }, { status: 400, headers })

    // Default to pro so all tones are always available
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
      const raw = await generate(rp)
      try {
        const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
        const parsed = JSON.parse(clean)
        return NextResponse.json({ replies: (parsed.triggers || []).map((t: any) => ({ tone: t.label, text: t.text })), analysis: parsed.analysis || '', isReengage: true }, { headers })
      } catch {
        return NextResponse.json({ replies: [{ tone: 'Trigger', text: raw.substring(0, 150) }], analysis: '', isReengage: true }, { headers })
      }
    }

    const prompt = buildPrompt(message, context, hisLocation, userPlan, previousTones, englishVariety, myName, questionsToAnswer)
    const rawText = await generate(prompt)
    const replies = parseReplies(rawText)
    const finalReplies = postProcess(replies.length >= 1 ? replies : [{ tone: 'Casual', text: rawText.substring(0, 200) }])

    return NextResponse.json({ replies: finalReplies, remaining: 999, plan: userPlan, modelUsed: 'groq/llama-4-scout' }, { headers })

  } catch (error: any) {
    const errMsg = error?.message || 'Generation failed'
    console.error('[CIC] Error:', errMsg)
    return NextResponse.json({ error: errMsg, replies: [], remaining: 999 }, { status: 200, headers })
  }
}
