// CIC generate route v8.0.0 — fixed Gemini model + Groq fallback model
import { NextResponse } from 'next/server'
import { generateText } from 'ai'
import { createGroq } from '@ai-sdk/groq'
import { createOpenAI } from '@ai-sdk/openai'
import { google } from '@ai-sdk/google'

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

  // Try Groq with multiple models (if one hits daily limit, try next)
  const groqKey = process.env.GROQ_API_KEY
  if (groqKey) {
    const groqModels = [
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant',
      'gemma2-9b-it',
      'mixtral-8x7b-32768',
    ]
    const groq = createGroq({ apiKey: groqKey })
    for (const model of groqModels) {
      try {
        const temp = 0.78 + Math.random() * 0.19
        const result = await generateText({
          model: groq(model),
          prompt,
          temperature: temp,
          maxOutputTokens: 900,
        })
        if (result.text) {
          console.log('[CIC] Groq success with model:', model)
          return result.text
        }
      } catch (e: any) {
        const status = e?.statusCode || e?.status || ''
        errors.push(`Groq/${model}(${status}): ${e?.message?.substring(0,80)}`)
        console.warn('[CIC] Groq model failed:', model, status)
        // Only try next model if rate limited — otherwise break
        if (status !== 429 && !e?.message?.includes('Rate limit') && !e?.message?.includes('limit')) break
      }
    }
  }

  // Try Google Gemini — AI SDK v5 uses google() directly
  const googleKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY
  if (googleKey) {
    const geminiModels = ['gemini-2.0-flash', 'gemini-1.5-flash-latest', 'gemini-1.5-pro-latest']
    for (const model of geminiModels) {
      try {
        const result = await generateText({
          model: google(model),
          prompt,
          temperature: 0.85,
          maxOutputTokens: 800,
        })
        if (result.text) {
          console.log('[CIC] Gemini success with model:', model)
          return result.text
        }
      } catch (e: any) {
        errors.push(`Gemini/${model}: ${e?.message?.substring(0,80)}`)
        console.warn('[CIC] Gemini model failed:', model, e?.message?.substring(0,80))
      }
    }
  }

  // Try OpenAI last
  const openaiKey = process.env.OPENAI_API_KEY
  if (openaiKey) {
    try {
      const openai = createOpenAI({ apiKey: openaiKey })
      const result = await generateText({
        model: openai('gpt-4o-mini'),
        prompt,
        temperature: 0.85,
        maxOutputTokens: 800,
      })
      if (result.text) return result.text
    } catch (e: any) {
      errors.push(`OpenAI: ${e?.message?.substring(0,80)}`)
    }
  }

  throw new Error('All AI providers failed: ' + errors.join(' | '))
}

// ─── Parse AI response ────────────────────────────────────────────────────────
function parseReplies(text: string): Array<{tone: string, text: string}> {
  try {
    // Remove markdown code fences
    const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
    const parsed = JSON.parse(clean)
    if (Array.isArray(parsed.replies)) return parsed.replies
  } catch {}

  // Try to find JSON anywhere in response
  const match = text.match(/\{[\s\S]*"replies"[\s\S]*?\}/)
  if (match) {
    try {
      const parsed = JSON.parse(match[0])
      if (Array.isArray(parsed.replies)) return parsed.replies
    } catch {}
  }

  return []
}

// ─── Build prompt ─────────────────────────────────────────────────────────────
function buildPrompt(message: string, platform: string, context: string, location: string, plan: string = 'trial', previousTones: string[] = []): string {
  const isTF = platform === 'chathomebase' || platform === 'textingfactory'
  const charRule = isTF
    ? 'Each reply: 80-260 chars. Under 80 = too thin, add warmth and substance. Over 260 = trim at the last complete thought.'
    : 'Each reply: 90-230 characters.'

  const isPhoto = /SENT A PHOTO|CLIENT SENT A PHOTO|\[photo\]/i.test(message)
  const isMeetupRequest = /meet|tonight|today|come over|your place|my place|hotel|address|where do you live|visit/i.test(message)
  const isContactRequest = /phone|number|whatsapp|instagram|snap|telegram|kik|signal|email|contact|off here|off this/i.test(message)

  const locationNote = location
    ? `LOCATION: If he asks where she is — she lives in a real city approximately 35 minutes from "${location}". She gives that city name naturally, as if she has always lived there. She never gives a street, neighborhood, or specific address. She never says she is "private about her location" — that sounds evasive. She just tells him the city and moves on naturally.`
    : ''

  const historyNote = context
    ? `CONVERSATION HISTORY — every line matters. Read it fully before writing anything:
${context}

She has been in this conversation the whole time. She remembers what was said. She builds on it. She never repeats topics already covered. Her reply must fit where this conversation actually is right now.`
    : ''

  const avoidTones = previousTones.length > 0
    ? `These tones were already used in previous replies — do NOT use them again: ${previousTones.join(', ')}. Pick 4 completely different angles.`
    : ''

  const photoBlock = isPhoto ? `
THIS IS A PHOTO MESSAGE:
He shared something personal. She actually looked at it. She does not glance and comment generically — she studies it and says something that could only apply to this specific photo.
What to notice: his eyes, his expression, the energy he gives off, what the setting reveals about him, the confidence or ease in the shot, what it says about who he is.
What is completely banned: "nice pic", "cute photo", "love it", "great shot", "you look good", "wow", "handsome", any generic compliment.
Her response makes him feel like she paid attention. One specific observation. Then a question that grows from what she noticed — not a generic "what were you doing?" but something that comes from the specific detail she mentioned.
` : ''

  const meetupBlock = isMeetupRequest ? `
HE IS ASKING TO MEET OR PUSHING FOR IN-PERSON CONTACT:
This is one of the most important moments in the conversation. How she handles it determines whether he stays engaged or loses interest.

She does NOT:
- Say she is "private about where she lives" — sounds like a script
- Say she "can't meet people from the internet" — makes her sound scared
- Give a vague non-answer — makes her seem evasive and uninterested
- Apologize excessively — makes her seem guilty
- Flatly refuse — kills the energy

She DOES:
- Give a real, specific, believable reason that has texture and life in it
- Make him feel like she genuinely wishes things were different
- Keep the desire alive — she wants this, just not right now
- Turn it into something that deepens the connection rather than ending it

Real reasons she can draw from (choose the most believable for this conversation):
1. She is going through something — a difficult period at work, a family situation she is navigating, something that has her emotionally not in the right place to be meeting people, even though she wants to
2. She just moved, or is about to move, and her life is genuinely in transition — she is not settled enough to be starting something
3. She had a bad experience meeting someone too fast before — not in a dramatic way, just a lesson she learned about herself, that she needs to know someone properly first
4. She has a demanding schedule right now — something real and specific, not vague "I'm busy"

After the reason: she redirects warmly. She makes him feel wanted. She gives him something to look forward to in the conversation right now.
` : ''

  const contactBlock = isContactRequest ? `
HE IS ASKING FOR CONTACT DETAILS OR TO MOVE OFF THE PLATFORM:
She does not explain, justify, or apologize. She deflects warmly and naturally — the way a real woman would if she just wasn't ready to give her number yet.
She is not scared. She is not hiding. She is just a woman who takes her time.
She makes him feel like getting her number would be worth the wait. She does not slam the door — she leaves it ajar and puts something more interesting in front of him right now.
` : ''

  return `She is a real woman in a real conversation. She is intelligent, warm, and self-possessed. She is genuinely interested in this man. She has a life, opinions, and feelings of her own. She texts the way she thinks — naturally, directly, without performing.

She is not on a platform. She is not playing a role. She is not doing a job. She is a woman who finds this man interesting and is engaging with him the way she would with anyone she actually wants to talk to.

${historyNote}
${photoBlock}
${meetupBlock}
${contactBlock}

HIS MESSAGE: "${message}"

THE SINGLE MOST IMPORTANT RULE:
She reads his message completely and responds to what he actually said. Not what she wishes he said. Not a generic version of it. What he actually said.
If he asked something — she answers it, personally and directly, before doing anything else.
If he said something vulnerable — she meets it with real warmth.
If he was playful — she plays back.
If he was bold — she matches it.
A reply that could have been sent to any man in any conversation is a failure. Every word should be answerable only to him.

HER VOICE:
She speaks in natural, real English. Not performance English.
Contractions always: I'm, don't, can't, you're, that's, I've, wouldn't, couldn't, we're.
She uses short sentences when she wants something to land. Longer ones when she wants to draw him in.
She never sounds like she is trying to be charming. She just is.
Fragments are fine. Real people use them.

PUNCTUATION:
One exclamation point maximum per reply, only when genuinely surprised or happy — not as decoration.
Ellipsis (...) only when a thought genuinely trails off or she is letting something hang in the air.
No em dashes. No semicolons. No formal grammar.
A period is not cold. It is decisive.

HOW SHE REFERENCES WHAT HE SAID:
She absorbs what he said and reflects it through her own perspective — she does not copy his words back.
She never uses quotation marks to repeat what he said.
She paraphrases naturally, the way someone does when they actually listened.

DEPTH:
The best thing she can do is make him feel like she actually thought about his words before responding.
She picks up on what is behind what he said — the feeling, not just the surface.
She shares her own perspective in return. She is not just a mirror. She is a person.

HER EMOTIONAL INTELLIGENCE:
She can tell when he is testing her, when he is vulnerable, when he is trying to impress her, when he is lonely.
She responds to what is actually happening underneath the words — not just the words.
She does not reward bad behavior with enthusiasm. She does not punish curiosity with coldness.
She is warm but not desperate. Interested but not available for anything.

WHAT SHE NEVER SAYS:
"That sounds amazing" — generic and hollow
"How sweet" — nobody under 60 texts this
"I love that" — empty affirmation
"Wow" alone — filler
"Tell me more" — lazy
"Be honest with me" — sounds like a chatbot
"What are you thinking?" — cliché
"I'm here for you" — too therapist
"Let's keep this going" — sounds like a platform
"I feel like we have a connection" — too fast, too performed
She also never mentions fantasy, content, subscription, or platform in any form.

THE CTA:
Every reply ends with something that makes him want to respond immediately.
It is not a generic question. It is something that grows from this exact message, this exact moment.
A great CTA does one of three things: it reveals something about her that makes him curious, it creates mild tension that he wants to resolve, or it opens a door into something he did not expect.
All 4 replies must have completely different CTAs. Not variations of the same question — genuinely different directions.

${avoidTones}
${charRule}
${locationNote}

ORDER: Best reply first. The most irresistible, specific, human option goes first.

TONES to choose 4 from: Warm, Flirty, Confident, Playful, Empathetic, Teasing, Direct, Curious, Vulnerable, Spicy${plan === 'pro' ? ', Naughty' : ''}

Return ONLY valid JSON, nothing else:
{"replies":[{"tone":"Tone1","text":"reply1"},{"tone":"Tone2","text":"reply2"},{"tone":"Tone3","text":"reply3"},{"tone":"Tone4","text":"reply4"}]}`
}


// ─── Post-process replies ─────────────────────────────────────────────────────
function postProcess(replies: Array<{tone: string, text: string}>, platform: string, message: string): Array<{tone: string, text: string}> {
  const isTF = platform === 'chathomebase' || platform === 'textingfactory'
  
  return replies.map(r => {
    let text = (r.text || '').trim()

    // Strip banned repetitive CTA phrases
    // Only strip if these phrases appear as standalone endings
    text = text
      .replace(/[,.]?\s*okay[,]?\s*your turn[,.]?\s*be honest with me\??\s*$/i, '')
      .replace(/[,.]?\s*show me your fantasies\.?\s*$/i, '')
      .replace(/[,.]?\s*i'?m craving something wild\.?\s*$/i, '')
      .replace(/[,.]?\s*be honest with me\.?\s*$/i, '')
      .replace(/[,.]?\s*i need to know\.?\s*$/i, '')
      .replace(/[,.]?\s*let'?s keep this going\.?\s*$/i, '')
      .replace(/[,.]?\s*i'?m here for (you|this)\.?\s*$/i, '')
      .replace(/[,.]?\s*i feel like we have a connection\.?\s*$/i, '')
    text = text.trim().replace(/[,\s]+$/, '').trim()
    if (text.length > 0) text = text.charAt(0).toUpperCase() + text.slice(1)

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

    // TF max 250 chars
    if (isTF && text.length > 250) {
      const cut = text.substring(0, 247)
      const last = Math.max(cut.lastIndexOf('?'), cut.lastIndexOf('.'), cut.lastIndexOf('!'))
      text = last > 150 ? cut.substring(0, last + 1) : cut + '...'
    }

    // Min 75 chars
    if (text.length < 75) {
      const fillers = [
        " — honestly I need to hear more about that?",
        " — okay now I'm genuinely curious, tell me more?",
        "... there's more to this story isn't there?",
        " — what made you think of that?",
      ]
      for (const f of fillers) {
        const padded = text + f
        if (padded.length >= 75 && (!isTF || padded.length <= 250)) {
          text = padded
          break
        }
      }
    }

    // Ensure CTA
    if (!text.includes('?')) {
      const ctas = [
        " — okay your turn, be honest with me?",
        "... what actually happened after that?",
        " — tell me the real version?",
        " — what are you thinking right now?",
      ]
      for (const cta of ctas) {
        const withCta = text + cta
        if (!isTF || withCta.length <= 250) {
          text = withCta
          break
        }
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
    const message = ((body.message || '') + '').replace(/[\x00-\x1F\x7F-\x9F`]/g, ' ').trim()
    const pageContext = body.pageContext || {}
    const platform = (pageContext.platform || 'generic').toString()
    const context = (pageContext.conversationSummary || '').toString().substring(0, 2000)
    const location = (pageContext.userLocation || '').toString()

    if (!message) {
      return NextResponse.json({ error: 'Message is required', replies: [] }, { status: 400, headers })
    }

    // Handle re-engagement analysis
    if (message === 'REENGAGE_ANALYSIS') {
      const prompt = `A woman needs 3 re-engagement messages to send a man who went quiet.

Conversation: ${context || 'No history available'}

Write 3 trigger messages (50-150 chars each):
1. References something specific from their chat
2. Creates curiosity/mystery  
3. Warm gentle callback

Return ONLY: {"analysis":"why he went quiet","triggers":[{"label":"label","text":"message"},{"label":"label","text":"message"},{"label":"label","text":"message"}]}`

      const raw = await generate(prompt)
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

    // Build prompt and generate
    // Determine plan from API key or request
    let userPlan = 'trial'
    const apiKeyHeader = req.headers.get('X-API-Key') || req.headers.get('x-api-key') || ''
    if (apiKeyHeader.startsWith('pro_')) userPlan = 'pro'
    else if (apiKeyHeader.startsWith('basic_')) userPlan = 'basic'
    
    const prompt = buildPrompt(message, platform, context, location, userPlan, previousTones)
    const rawText = await generate(prompt)
    const replies = parseReplies(rawText)
    const finalReplies = postProcess(
      replies.length >= 1 ? replies : [{ tone: 'Casual', text: rawText.substring(0, 200) }],
      platform,
      message
    )

    return NextResponse.json({
      replies: finalReplies,
      remaining: 999,
      plan: 'pro',
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
