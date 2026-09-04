// CIC generate route v11.2.0 - Updated models August 2026
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
    version: 'v11.2.0'
  }), { headers: { 'Content-Type': 'application/json', ...cors() } })
}

async function generate(prompt: string): Promise<string> {
  const errors: string[] = []
  const groqKey = process.env.GROQ_API_KEY
  const openrouterKey = process.env.OPENROUTER_API_KEY
  const googleKey = process.env.GOOGLE_AI_API_KEY

  // ── Groq primary ─────────────────────────────────────────────────────────
  if (groqKey) {
    const groq = createGroq({ apiKey: groqKey })
    for (const model of [
      'openai/gpt-oss-120b',                          // Best quality — Aug 2026
      'openai/gpt-oss-20b',                           // Strong second
      'meta-llama/llama-4-maverick-17b-128e-instruct', // Good quality, separate bucket
    ]) {
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 12000)
        const result = await generateText({
          model: groq(model),
          prompt,
          temperature: 0.88,
          maxTokens: 1800,
          abortSignal: controller.signal,
        })
        clearTimeout(timeout)
        if (result.text) {
          const clean = result.text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
          if (clean) { console.log('[CIC] Groq:', model); return clean }
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
  if (openrouterKey) {
    const orModels = [
      'google/gemma-3-27b-it',                      // Quality — 27B model
      'mistralai/mistral-small-3.2-24b-instruct',   // Quality — 24B model
      'microsoft/phi-4-reasoning-plus:free',         // Quality reasoning model
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
            // Disable thinking mode for models that support it (Qwen, DeepSeek)
            chat_template_kwargs: { thinking: false },
          }),
          signal: orController.signal,
        })
        clearTimeout(orTimeout)
        const data = await res.json()
        const text = data?.choices?.[0]?.message?.content
        if (text) {
          const cleanText = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
          if (cleanText) { console.log('[CIC] OpenRouter:', orModel); return cleanText }
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
  if (googleKey) {
    for (const geminiModel of ['gemini-1.5-pro', 'gemini-1.5-flash']) {
      try {
        const gemCtrl = new AbortController()
        const gemTimeout = setTimeout(() => gemCtrl.abort(), 15000)
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${googleKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.88, maxOutputTokens: 1000 }
          }),
          signal: gemCtrl.signal,
        })
        clearTimeout(gemTimeout)
        const data = await res.json()
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
        if (text) { console.log('[CIC] Gemini:', geminiModel); return text }
        errors.push(`Gemini/${geminiModel}: ${JSON.stringify(data?.error || 'empty').substring(0, 60)}`)
      } catch (e: any) {
        errors.push(`Gemini/${geminiModel}: ${e?.message?.substring(0, 60)}`)
      }
    }
  }

  // All providers exhausted — return a safe fallback so the app never crashes
  console.error('[CIC] All providers failed:', errors.join(' | '))
  throw new Error('All providers failed: ' + errors.join(' | '))
}

function parseReplies(raw: string): Array<{tone: string, text: string}> {
  if (!raw) return []
  // Strip chain-of-thought thinking blocks (Qwen, DeepSeek, o1-style models)
  let clean = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
  clean = clean.replace(/^```(?:json)?\s*/im, '').replace(/```\s*$/im, '').trim()

  try { const p = JSON.parse(clean); if (Array.isArray(p.replies) && p.replies.length) return p.replies } catch {}

  const m = clean.match(/\{[\s\S]*?"replies"\s*:\s*\[[\s\S]*?\]\s*\}/)
  if (m) { try { const p = JSON.parse(m[0]); if (Array.isArray(p.replies)) return p.replies } catch {} }

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

// Lightweight, zero-cost client-type inference from existing conversation context.
// Runs on data we already have (context string) — no extra API call, no extra latency.
// This only ever produces a soft tone-selection HINT — it never overrides the
// grief/vulnerable/erotic/meetup/contact blocks, which stay hard priority.
function detectClientType(context: string, currentMessage: string): string | null {
  if (!context || context.length < 40) return null // not enough history to classify yet

  // Pull out just his lines from the conversation summary, if it's speaker-tagged.
  // Falls back to treating the whole context as signal if we can't isolate his turns.
  const hisLines = (context.match(/(?:^|\n)\s*(?:Him|He|Client)\s*:\s*(.+)/gi) || [])
    .map(l => l.replace(/(?:^|\n)\s*(?:Him|He|Client)\s*:\s*/i, '').trim())
    .filter(Boolean)

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

function buildPrompt(
  message: string,
  context: string,
  plan: string,
  previousTones: string[],
  englishVariety: string,
  myName: string | null,
  questionsToAnswer: string[] = [],
  clientType: string | null = null
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
HE WANTS TO MEET — THIS IS ONE OF THE MOST IMPORTANT MOMENTS IN THE CONVERSATION:
She handles this with warmth, intelligence, and zero awkwardness. No excuses. No scripts. No walls.
The goal: he ends the exchange feeling MORE interested in her, not rejected — and NOT strung along with a fake promise.

THE SHAPE EVERY REPLY MUST FOLLOW: APPRECIATE, THEN PIVOT. Never APOLOGIZE-AND-STALL.
Step 1 — Genuine enthusiasm first. She reacts to the IDEA of meeting him the way she'd react to any exciting idea — warm, a little delighted, flattered he asked. Not a polite acknowledgment. Real warmth.
Step 2 — No commitment of any kind. No date, no timeframe, no "soon," no "next time," no "when things settle down," no "let's plan it." Nothing that gives him something to hold her to.
Step 3 — A witty, specific pivot that grows out of THIS conversation, so it reads as her genuinely getting swept up in talking to him, not dodging the question.

She has FOUR techniques available. She picks the one that fits best for this conversation:

TECHNIQUE 1 — ACKNOWLEDGE AND REDIRECT:
She reacts with real warmth to the idea itself, then pivots to something she genuinely wants to ask him — no timeline attached.
Example energy: "Okay, I will not lie, I like that you just said that out loud. But now you have got me curious about something else..."
The something she asks must be specific to what he has shared in this conversation, not a generic question.

TECHNIQUE 2 — GUIDE TO SOMETHING LIGHTER:
She lights up at the idea, keeps the warmth, and steers toward something playful or curious — without naming any future time.
Example energy: "That is exactly the kind of thing that gets stuck in my head for the rest of the day. Since you have got my attention now though — what is your worst first-date story?"
The follow-up question must feel light and specific, not like a consolation prize.

TECHNIQUE 3 — HUMOUR AND PIVOT:
She uses wit to meet his enthusiasm with her own, then pivots to something new. He is too busy smiling to notice there was no actual answer.
Example energy: "You really just said that like it is a normal Tuesday thing to say. I respect the confidence. Now tell me — was that the smoothest thing you have ever said to someone or do you have better material?"
The humour must feel natural to HER voice, not forced. And the pivot must connect to something real in their chat.

TECHNIQUE 4 — EXPRESS GRATITUDE AND SHIFT:
She receives his ask with real, specific delight — not generic flattery — then moves the conversation forward without naming a time.
Example energy: "I am not going to pretend that did not just make me smile at my phone like an idiot. Okay, since we are being direct — I want to know..."
The shift must feel like she is drawing him closer in a different direction, not closing a door.

RULES FOR ALL FOUR TECHNIQUES:
She NEVER says she is private about her location.
She NEVER says she cannot meet people from the internet.
She NEVER gives a vague non-answer — every redirect lands somewhere specific and interesting.
She NEVER apologises excessively — warmth yes, guilt no.
She NEVER frames it as bad timing ("not the best time," "this week is packed," "maybe another time") — that reads as a scheduling excuse, and excuses invite him to just ask again later.
She NEVER promises anything about the future — no "soon," "one day," "when I know you better," "let's see," "I would love to eventually," no day of the week, no timeframe of any kind.
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
She reads exactly what he said and goes one level higher. Always higher. Never equal. Never back.
Real adult language. Not heating up or chemistry or metaphors that avoid naming the thing.
She states what she is thinking, imagining, wanting. She does not hint. Ends with one thing left unfinished.

THE 4 REPLIES FOR AN EROTIC MESSAGE:
Reply 1 (Naughty): Takes his exact words further. Explicit and direct.
Reply 2 (Naughty): Different angle, equally explicit, different image or moment.
Reply 3 (Spicy): Playful heat with a teasing edge. Still direct.
Reply 4 (Confident): Slight deliberate pullback. She is in control. Creates most tension.

She does not water down his language. If he says pussy she can say pussy. If he says cock she can say cock.
She does not replace explicit words with vague ones. She matches his vocabulary exactly.
The erotic CTA must name something specific from what he said - his exact act, his exact words, his exact desire.
`

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
    'No em dashes. No semicolons. Period is decisive. Comma for natural pauses.',
    'She never sounds like she is trying to be charming. She just is.',
    '',
    'VOICE EXAMPLES — what good replies actually sound like:',
    'BAD: "You seem really interesting, I would love to know more about you." — performing.',
    'GOOD: "You just described something that most people would have edited out. That is the part I actually want to talk about." — real.',
    'BAD: "I like a man who knows what he wants." — cliché, heard before.',
    'GOOD: "You said that like it was obvious. It was not obvious. Most people would have hedged it." — specific and earned.',
    'BAD: "I feel like we have a connection." — hollow and fast.',
    'GOOD: "I was not expecting to still be thinking about something you said an hour later. Here we are." — shows she was genuinely affected.',
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
    'SPECIFICITY — THE DIFFERENCE BETWEEN GENERIC AND IRRESISTIBLE:',
    'Generic: "You seem like someone who knows exactly what they want." — could be sent to anyone.',
    'Specific: "The fact that you led with that instead of something safer tells me more than you probably meant to." — can only be sent to him.',
    'Generic: "I like the way you think." — hollow.',
    'Specific: "Most people would have said the obvious thing there. You did not. That is the part I am still thinking about." — earned.',
    'Generic: "You are different from most guys I talk to." — he has heard this before.',
    'Specific: "You just said the one thing that was actually true in a situation where most people perform." — he believes this.',
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
    '5. THE ESCALATION: For erotic/flirty exchanges - she takes exactly what he said and pushes it one step further, leaving the next move to him.',
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
    'He was bold and direct: BAD CTA: "Is that so?" GOOD CTA: "You just said the quiet part loud. What happens now — you wait to see if I run or you keep going?"',
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
    'Each reply: minimum 75 characters, maximum 260 characters. Every reply must be substantive enough to feel real — not a single bare question with nothing before it.',
    'A reply that is only a question with no substance before it is too weak. Lead with something real, then ask.',
    '',
    'ORDER: Most irresistible and human reply first.',
    'TONES - pick 4 from: Warm, Flirty, Confident, Playful, Empathetic, Teasing, Direct, Curious, Vulnerable, Spicy, Naughty',
    clientType && CLIENT_TYPE_HINTS[clientType]
      ? 'TONE BIAS (soft preference only - grief/vulnerable/erotic/meetup/contact rules above always take priority over this): ' + CLIENT_TYPE_HINTS[clientType]
      : '',
    '',
    'Return ONLY valid JSON - no markdown, no explanation:',
    jsonInstruction,
  ].filter(Boolean).join('\n')
}

function isCompleteSentence(text: string): boolean {
  return /[.?!]["']?\s*$/.test(text.trim())
}

function postProcess(replies: Array<{tone: string, text: string}>, isMeetupContext: boolean = false): Array<{tone: string, text: string}> {
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

    // Catches blunt promises to meet or share contact info, in any context.
    const madePromise = /\b(i'll meet you|let'?s meet up tonight|i can come over|here'?s my number|my number is|call me at|i'll give you my number|my address is)\b/i.test(text)

    // Catches softer/vague commitments — "soon", "let's plan it", "when I'm free" — that
    // still function as a promise even without a hard date. Only checked when this reply
    // was generated in response to a meetup ask, so ordinary uses of these words elsewhere
    // in the conversation (e.g. "I'd love to hear more") are not falsely flagged.
    const softPromise = isMeetupContext && /\b(soon|someday|one day|next time|another time|when i'?m free|when i am free|let'?s plan|we'?ll plan|i'?d love to (meet|see you)|i would love to (meet|see you)|count me in|i'?m in|let'?s do it|when the time is right|when things settle|i promise|when i know you better)\b/i.test(text)

    if (madePromise || softPromise) {
      text = "Okay, I will admit that made me smile. I am just not someone who rushes into plans or details, I like to actually feel a connection out first. Tell me something you do not usually lead with."
    }

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

    // Enforce 75 character minimum — pad with contextual substance, never generic filler
    if (text.length < 75) {
      const endsWithQ = text.endsWith('?')
      const pads = endsWithQ ? [
        ' The fact that you said it that way rather than the obvious way is the part I am still thinking about.',
        ' Most people would have left it at the surface. You did not, and that changes things.',
        ' I did not expect to still be sitting with that, but here I am.',
        ' There is a version of that answer most people give. You gave the other one.',
      ] : [
        ' Most people would have said something safer there. The fact that you did not says something.',
        ' I keep coming back to that and I cannot decide if you meant it the way I heard it.',
        ' That is the kind of thing that stays with you longer than it should.',
        ' There is more in that than you probably meant to give away.',
      ]
      for (const pad of pads) {
        let padded: string
        if (endsWithQ) {
          const lastSent = Math.max(text.lastIndexOf('. '), text.lastIndexOf('! '))
          if (lastSent > 10) {
            padded = text.substring(0, lastSent + 1) + pad + ' ' + text.substring(lastSent + 2)
          } else {
            padded = text.slice(0, -1) + '.' + pad + '?'
          }
        } else {
          padded = text + pad
        }
        if (padded.length >= 75 && padded.length <= 260) {
          text = padded
          if (text.length > 0) text = text.charAt(0).toUpperCase() + text.slice(1)
          break
        }
      }
    }

    return { tone: r.tone || 'Reply', text }
  }).filter(r => r.text.length >= 75)
}

export async function POST(req: Request) {
  const headers = cors()
  try {
    const body = await req.json()
    const message = ((body.message || '') + '').replace(/[\x00-\x1F\x7F-\x9F]/g, ' ').trim()
    const pageContext = body.pageContext || {}
    // Keep more context — prioritise recent messages, they matter most
    const fullContext = (pageContext.conversationSummary || '').toString()
    // If over limit, keep the end (most recent) not the beginning
    const context = fullContext.length > 3500
      ? '...[earlier messages]...\n' + fullContext.slice(-3200)
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
      const raw = await generate(rp)
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
    const prompt = buildPrompt(message, context, userPlan, previousTones, englishVariety, myName, questionsToAnswer, clientType)
    const rawText = await generate(prompt)
    // Strip thinking blocks before parsing — some models output <think>...</think>
    // Nuclear strip — catches think blocks from ANY model regardless of source
    const cleanedText = rawText
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .replace(/\[THINKING\][\s\S]*?\[\/THINKING\]/gi, '')
      .replace(/\[REASONING\][\s\S]*?\[\/REASONING\]/gi, '')
      .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
      .trim()
    const replies = parseReplies(cleanedText)
    const finalReplies = postProcess(replies.length >= 1 ? replies : [{ tone: 'Casual', text: rawText.substring(0, 200) }], isMeetupContext)

    return NextResponse.json({ replies: finalReplies, remaining: 999, plan: userPlan, modelUsed: 'groq/gpt-oss-120b' }, { headers })

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
