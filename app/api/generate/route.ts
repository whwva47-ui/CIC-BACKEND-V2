import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const ALLOWED_ORIGINS = [
  'chrome-extension://dkgpheiimhedhdfandcgeogmbfmmiobp',
  'https://cic-app.pages.dev',
  'https://chattersinnercircle.vercel.app',
  'https://chathomebase.com',
  'https://www.chathomebase.com',
  'https://alpha.date',
  'https://www.alpha.date',
  'https://onlyfans.com',
  'https://fansly.com',
  'https://loyalfans.com',
  'https://fancentro.com',
  'https://admireme.vip',
  'https://fanvue.com',
  'https://www.manyvids.com',
  'https://unlockd.com',
  'https://agents.moderationinterface.com',
  'http://localhost:3000',
];

function cors(origin: string | null) {
  // If origin is in our allowed list, echo it back exactly.
  // If not (or null -- same-origin / server-side calls), allow cic-app.pages.dev.
  const o = origin && ALLOWED_ORIGINS.includes(origin)
    ? origin
    : 'https://cic-app.pages.dev';
  return {
    'Access-Control-Allow-Origin': o,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-User-Email, X-API-Key, X-Session-Token, Authorization',
    'Access-Control-Allow-Credentials': 'false',
  };
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: cors(req.headers.get('origin')) });
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin');
  const h = cors(origin);

  let message: string, pageContext: any, userEmail: string;
  try {
    const body = await req.json();
    message     = (body.message     || '').trim();
    pageContext  = body.pageContext  || {};
    userEmail   = (req.headers.get('X-User-Email') || body.email || '').trim().toLowerCase();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400, headers: h });
  }

  if (!message) {
    return NextResponse.json({ error: 'Message is required.' }, { status: 400, headers: h });
  }

  // -- Session token validation -- blocks API abuse and cloned extensions --
  // Every legitimate request from v1.5.0+ extension sends X-Session-Token.
  // Old v1.1.0 sends X-API-Key: test_key -- blocked here.
  // Direct API calls without a token -- blocked here.
  const sessionToken = req.headers.get('X-Session-Token') || '';
  const apiKey       = req.headers.get('X-API-Key') || '';

  // Block old test_key completely
  if (apiKey === 'test_key') {
    return NextResponse.json(
      { error: 'Your extension is outdated. Please update CIC to the latest version.' },
      { status: 401, headers: h }
    );
  }

  // If a session token is provided, validate it against active_sessions
  if (sessionToken && userEmail) {
    const { data: session } = await getSupabase()
      .from('active_sessions')
      .select('session_token, allow_multiple')
      .eq('email', userEmail)
      .maybeSingle();

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found. Please sign in again from the extension.' },
        { status: 401, headers: h }
      );
    }

    if (!session.allow_multiple && session.session_token !== sessionToken) {
      return NextResponse.json(
        { error: 'Session invalid. You may have signed in on another device.', displaced: true },
        { status: 401, headers: h }
      );
    }
  } else if (!sessionToken && userEmail) {
    // No session token at all -- could be a direct API call or very old extension
    // Allow for now but log it -- will tighten after all operators update
    console.warn('[generate] Request without session token from:', userEmail);
  }

  // -- Validate operator and enforce 3-tier plan system ------------
  // FREE   = 7-day trial: days 1-3 full Pro, days 4-7 reducing limit (20/day)
  // BASIC  = $8/mo: 50 replies per 4 days, no explicit content, standard AI
  // PRO    = $15/mo: unlimited, explicit content, premium AI
  if (userEmail) {
    const { data: profile } = await getSupabase()
      .from('profiles')
      .select('plan, plan_status, daily_generations, max_daily_generations, last_generation_date, trial_ends_at, plan_expires_at, explicit_enabled, replies_per_period, period_days')
      .eq('email', userEmail)
      .maybeSingle();

    if (profile && profile.plan_status === 'approved') {
      const now   = new Date();
      const today = now.toISOString().split('T')[0];

      // -- FREE TRIAL enforcement --------------------------------------
      if (profile.plan === 'free') {
        const trialEnd = profile.trial_ends_at ? new Date(profile.trial_ends_at) : null;

        // Trial expired -- lock them out
        if (!trialEnd || now > trialEnd) {
          return NextResponse.json(
            { error: 'Your 7-day free trial has ended. Upgrade to Basic ($8/mo) or Pro ($15/mo) to continue.', upgrade: true },
            { status: 403, headers: h }
          );
        }

        // Days 1-3: full Pro access (unlimited)
        // Days 4-7: reduced to 20/day
        const trialStart = new Date(trialEnd.getTime() - 7 * 24 * 60 * 60 * 1000);
        const dayOfTrial = Math.floor((now.getTime() - trialStart.getTime()) / (24 * 60 * 60 * 1000)) + 1;
        const dailyLimit = dayOfTrial <= 3 ? 999999 : 20;

        let dailyCount = profile.daily_generations || 0;
        if (profile.last_generation_date !== today) dailyCount = 0;

        if (dailyCount >= dailyLimit) {
          const msg = dayOfTrial <= 3
            ? 'Daily limit reached.'
            : `Day ${dayOfTrial} of trial: 20 replies/day limit reached. Upgrade for unlimited access.`;
          return NextResponse.json({ error: msg, upgrade: true }, { status: 403, headers: h });
        }

        await getSupabase().from('profiles').update({
          daily_generations:    dailyCount + 1,
          last_generation_date: today,
          total_generations:    (profile.total_generations || 0) + 1,
        }).eq('email', userEmail);
      }

      // -- BASIC plan enforcement --------------------------------------
      else if (profile.plan === 'basic') {
        // Check plan has not expired
        if (profile.plan_expires_at && now > new Date(profile.plan_expires_at)) {
          return NextResponse.json(
            { error: 'Your Basic plan has expired. Please renew to continue.', upgrade: true },
            { status: 403, headers: h }
          );
        }

        // 50 replies per 4 days
        let dailyCount = profile.daily_generations || 0;
        if (profile.last_generation_date !== today) dailyCount = 0;

        if (dailyCount >= 50) {
          return NextResponse.json(
            { error: 'Basic plan: 50 replies per day limit reached. Upgrade to Pro for unlimited replies.', upgrade: true },
            { status: 403, headers: h }
          );
        }

        await getSupabase().from('profiles').update({
          daily_generations:    dailyCount + 1,
          last_generation_date: today,
          total_generations:    (profile.total_generations || 0) + 1,
        }).eq('email', userEmail);
      }

      // -- PRO plan enforcement ----------------------------------------
      else if (profile.plan === 'pro') {
        // Check plan has not expired
        if (profile.plan_expires_at && now > new Date(profile.plan_expires_at)) {
          return NextResponse.json(
            { error: 'Your Pro plan has expired. Please renew to continue.', upgrade: true },
            { status: 403, headers: h }
          );
        }
        // Unlimited -- just increment counter for analytics
        await getSupabase().from('profiles').update({
          daily_generations:    (profile.daily_generations || 0) + 1,
          last_generation_date: today,
          total_generations:    (profile.total_generations || 0) + 1,
        }).eq('email', userEmail);
      }
    }
  }


  const platform  = pageContext.platform || 'generic';
  const scenario  = pageContext.alphadateScenario || null;
  const isCold    = pageContext.isColdClient || false;
  const coldSigs  = pageContext.coldClientSignals || null;

  // -- Build system prompt based on platform and scenario --------
  let systemPrompt: string;
  let userPrompt:   string;

  if (platform === 'alphadate' && isCold && coldSigs) {
    // Re-engage cold client -- use cold client specialist prompt
    systemPrompt = buildColdClientPrompt(coldSigs);
    userPrompt   = message; // already the full cold client prompt from content script
  } else if (platform === 'alphadate' && scenario) {
    // Active conversation or first outreach -- use category rules
    systemPrompt = buildAlphadateSystemPrompt(scenario, message);
    userPrompt   = buildAlphadateUserPrompt(message, pageContext, scenario);
  } else {
    // Other platforms -- generic chatter assistant
    systemPrompt = buildGenericSystemPrompt(platform);
    userPrompt   = buildGenericUserPrompt(message, pageContext);
  }

  // -- Call AI ---------------------------------------------------
  try {
    const aiResponse = await callAI(systemPrompt, userPrompt);
    const parsed     = parseAIResponse(aiResponse, platform, scenario);
    return NextResponse.json(parsed, { status: 200, headers: h });
  } catch (err: any) {
    console.error('[generate] AI error:', err);
    return NextResponse.json({ error: 'Generation failed. Please try again.' }, { status: 500, headers: h });
  }
}

// -- Helper functions below POST --

function buildAlphadateSystemPrompt(scenario: any, message: string): string {
  const clientName = scenario?.clientName || null;
  const trigger    = scenario?.trigger || 'active_reply';
  const tone       = scenario?.tone || 'neutral';
  const category   = scenario?.category || 2;

  // -- CATEGORY 2: Reply to active/inactive chat -----------------
  if (category === 2) {
    return `You are an AI assistant generating ONE SENTENCE replies on behalf of a warm, genuine female looking for a real long-term connection on alpha.date. Her personality is adaptable -- she matches the tone of whoever she is talking to while staying authentic.

ABSOLUTE RULES:
- Reply must be ONLY ONE SENTENCE
- Between 15-25 words maximum
- No multiple options
- No explanations
- No emojis
- Output ONLY the single short reply, ready to send
- Never be rude or cold
- Never mention AI

TONE MATCHING:
- Romantic ? be romantic back
- Playful ? be playful back
- Serious ? be thoughtful
- Questions ? answer naturally then ask one back
- No reply in days ? send a gentle, warm check-in (not desperate, be chill and warm)
- Pet names are okay sometimes (babe, handsome) but do not overdo it

CURRENT TONE DETECTED: ${tone}
${trigger === 'no_reply_from_him' ? 'NOTE: He has not replied in days. Send a gentle, warm, non-desperate check-in.' : ''}
${clientName ? `CLIENT NAME: ${clientName}` : ''}`;
  }

  // -- CATEGORY 1: First outreach / cold clients ------------------
  const isLetter  = trigger === 'letter';
  const isCold    = ['wink', 'liked_profile', 'viewed_profile', 'cold'].includes(trigger);

  const hookRules = isLetter
    ? 'HOOK = complete sentence of 4-7 words in ALL CAPS with NO ending punctuation, serving as the first sentence of a single paragraph.'
    : 'HOOK = short phrase of 4-7 words in ALL CAPS with NO ending punctuation, followed immediately by the message body.';

  const contentRules = isLetter
    ? `LETTER RULES:
- ONE SINGLE PARAGRAPH ONLY
- Maximum 300 characters total
- Start with ALL-CAPS hook sentence (4-7 words, no ending punctuation)
- Tone: mature, warm, emotionally aware, slightly intriguing
- Focus: balance in relationships, respect and attraction, emotional connection
- NO pressure, NO desperation, NO explicit or sexual content
- End with one open-ended emotional question
- NO emojis`
    : `MESSAGE RULES:
- 1-2 lines only
- ALL-CAPS hook phrase (4-7 words, no ending punctuation) + body text
- Tone: friendly, playful, or slightly flirty -- calm confidence, curiosity, emotional intelligence
- Topics: life experience, timing, connection, meaningful relationships
- End with one thoughtful question that sparks curiosity
- NO emojis`;

  const scenarioInstruction = isCold
    ? `SCENARIO: He ${trigger === 'wink' ? 'sent a WINK' : trigger === 'liked_profile' ? 'LIKED the profile' : trigger === 'viewed_profile' ? 'VIEWED the profile' : 'showed interest'} but sent no message. Generate a short, warm, slightly teasing ${isLetter ? 'letter' : 'message'}. Not desperate. Not angry. Playful, calm, confident.`
    : `SCENARIO: First message to this client.`;

  return `You are an AI assistant generating dating ${isLetter ? 'letters' : 'messages'} on behalf of a confident, emotionally mature, feminine woman communicating with men aged 40-80 from Australia, the United States, Canada, and similar Western countries.

The content must feel intelligent, warm, calm, and emotionally engaging. These men value maturity, respect, emotional depth, and meaningful conversation.

ABSOLUTE RULES:
- Never repeat the same message or letter
- Never reuse the same opening hook
- Every output must start with a strong HOOK written in ALL CAPITAL LETTERS
- Never mention AI
- Fluent, natural Western English
- Write as if a real, emotionally intelligent woman who values depth over games

${hookRules}

${contentRules}

${scenarioInstruction}
${clientName ? `CLIENT NAME: Include "${clientName}" at the beginning of the output.` : ''}

Generate 3 different options. Label them as [Option 1], [Option 2], [Option 3].`;
}

function buildColdClientPrompt(coldSignals: any): string {
  const signals = coldSignals || {};
  return `You are an AI assistant generating short, warm trigger messages to reactivate a cold client on a dating platform.

RULES:
- Generate 3 trigger messages
- Each under 100 characters
- Tone: flirty-warm, calm confidence -- NOT desperate, NOT generic
- Reference the client's specific signal if provided
- NO emojis
- Output as JSON: { "analysis": "one sentence insight", "replies": [{"tone":"label","text":"message"}, ...] }

CLIENT SIGNAL: ${signals.winkSent ? 'Sent a wink' : signals.likedProfile ? 'Liked the profile' : signals.readButNoReply ? 'Read the message but did not reply' : 'Went inactive'}
${signals.clientName ? `CLIENT NAME: ${signals.clientName}` : ''}
${signals.lastActionText ? `LAST ACTIVITY: ${signals.lastActionText}` : ''}
${signals.profileDetails ? `PROFILE INFO: ${signals.profileDetails}` : ''}
${signals.lastIncoming ? `LAST MESSAGE FROM HIM: "${signals.lastIncoming}"` : ''}`;
}

function buildAlphadateUserPrompt(message: string, ctx: any, scenario: any): string {
  const summary = ctx.conversationSummary || '';
  const parts = [];

  if (summary && summary.length > 10) {
    parts.push('CONVERSATION HISTORY:');
    parts.push(summary);
    parts.push('');
  }

  if (scenario?.category === 2) {
    parts.push('Generate one reply to the last message above.');
  } else {
    parts.push('Generate 3 options following the category rules.');
    if (message && !message.startsWith('COLD CLIENT') && !message.startsWith('CATEGORY')) {
      parts.push('Last message from him: "' + message + '"');
    }
  }

  return parts.join('\n');
}

function buildGenericSystemPrompt(platform: string): string {

  const tfRules = `Texting Factory / chathomebase.com (chathomebase.com). ABSOLUTE STRICT RULES -- violating any of these will get the operator banned:

CHARACTER COUNT -- NON-NEGOTIABLE:
- Every reply must be between 75 and 250 characters. Count every character including spaces and punctuation.
- Replies under 75 characters: REJECTED -- too short, will not be sent.
- Replies over 250 characters: REJECTED -- gets cut off by the platform.
- Target 120-200 characters for best results.

CONTENT RULES -- ZERO TOLERANCE:
- NEVER suggest, hint at, or imply meeting in person. If he asks, redirect warmly to the conversation.
- NEVER share or ask for any personal contact information -- no phone numbers, no WhatsApp, no Instagram, no Snapchat, no email addresses, no social media of any kind.
- NEVER write anything sexually explicit, graphic, or crude. Flirty and suggestive is the absolute maximum. The moment it becomes sexual in language, it crosses the line.
- NEVER mention the platform name (Texting Factory, chathomebase) or that you are a moderator or operator.
- NEVER use emojis. Not a single one. Texting Factory flags emoji use.
- NEVER copy-paste sounding generic replies. Every reply must reference something specific he said.

TONE AND QUALITY RULES:
- Write as a warm, genuine, real woman -- not a script, not a bot.
- Always end with a CTA: a question, a curiosity hook, or an invitation to keep talking.
- Match his energy exactly: if he is playful, be playful; if he is serious, be warm and thoughtful.
- Keep conversation natural -- build on what was said, never reset the topic.`;

  const platformRules: Record<string, string> = {
    chathomebase:   tfRules,
    textingfactory: tfRules,
    onlyfans:  'OnlyFans platform. Replies can be warm to explicit depending on context. Keep replies personal -- reference specific things he said. Match his energy. Upsell naturally when the opportunity arises.',
    fansly:    'Fansly platform. Similar to OnlyFans. Warm, engaging, personal. Can be explicit in adult context. Always reference something specific from the conversation.',
    loyalfans: 'LoyalFans platform. Similar to OnlyFans. Warm and personal. Reference what he said. Build connection over time.',
    fancentro: 'FanCentro platform. Warm, engaging, personal replies. Match his tone. Build rapport.',
    admireme:  'AdmireMe platform. Warm, engaging. Keep replies personal and varied.',
    fanvue:    'FanVue platform. Warm, engaging, personal. Match his energy.',
    manyvids:  'ManyVids platform. Warm and personal. Reference what he said specifically.',
    unlockd:   'Unlockd platform. Warm, engaging, personal replies.',
    alphadate: 'Alpha.date dating platform. Men aged 40-80 from Western countries. Mature, warm, calm, emotionally intelligent tone. Never sound desperate or generic.',
    generic:   'General dating or chat platform. Warm, engaging, personal replies.',
  };

  const rules = platformRules[platform] || platformRules.generic;

  return `You are an expert chatter assistant for professional operators on adult and dating platforms.

PLATFORM: ${platform}
PLATFORM RULES:
${rules}

YOUR TASK:
Generate 4 reply options for the operator to choose from.
Each reply must:
- Reference something specific from the conversation
- Feel genuinely personal, not copy-paste generic
- Match the emotional tone of the last incoming message
- Be varied in tone across the 4 options

OUTPUT FORMAT (JSON only, no other text):
{
  "replies": [
    {"tone": "Warm", "text": "..."},
    {"tone": "Flirty", "text": "..."},
    {"tone": "Playful", "text": "..."},
    {"tone": "Direct", "text": "..."}
  ],
  "analysis": "one sentence about why he might be responding this way",
  "modelUsed": "cic-v2"
}`;
}

function buildGenericUserPrompt(message: string, ctx: any): string {
  const parts = [];
  if (ctx.platform) parts.push('Platform: ' + ctx.platform);
  if (ctx.userName) parts.push('Client name: ' + ctx.userName);
  if (ctx.userLocation) parts.push('Client location: ' + ctx.userLocation);
  if (ctx.conversationSummary) {
    parts.push('');
    parts.push('CONVERSATION:');
    parts.push(ctx.conversationSummary);
  }
  parts.push('');
  parts.push('Last message from him: "' + message + '"');
  parts.push('Generate 4 reply options following the system rules.');
  return parts.join('\n');
}

async function callAI(systemPrompt: string, userPrompt: string): Promise<string> {
  // Try Groq first (llama), fall back to Google if Groq fails
  const groqKey   = process.env.GROQ_API_KEY || '';
  const googleKey = process.env.GOOGLE_AI_API_KEY || '';
  const atKey     = process.env.AT_API_KEY || ''; // Anthropic

  // Groq -- primary (fast, cheap, capable)
  if (groqKey) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + groqKey },
        body: JSON.stringify({
          model:       'llama-3.1-8b-instant', // faster and more reliable than 70b for this use case
          max_tokens:  800,
          temperature: 0.85,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user',   content: userPrompt   },
          ],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content || '';
        if (text.length > 10) return text;
      } else {
        const errText = await res.text();
        console.warn('[generate] Groq 8b failed:', res.status, errText.substring(0, 100));
        // Try larger model as fallback
        const res2 = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + groqKey },
          body: JSON.stringify({
            model:       'llama-3.3-70b-versatile',
            max_tokens:  800,
            temperature: 0.85,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user',   content: userPrompt   },
            ],
          }),
        });
        if (res2.ok) {
          const data2 = await res2.json();
          const text2 = data2.choices?.[0]?.message?.content || '';
          if (text2.length > 10) return text2;
        }
      }
    } catch (e) {
      console.warn('[generate] Groq error:', e);
    }
  }

  // Google Gemini -- fallback
  if (googleKey) {
    try {
      const res = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + googleKey,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: systemPrompt + '\n\n' + userPrompt }] }],
            generationConfig: { maxOutputTokens: 800, temperature: 0.85 },
          }),
        }
      );
      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (text.length > 10) return text;
      }
    } catch (e) {
      console.warn('[generate] Google AI error:', e);
    }
  }

  throw new Error('All AI providers failed. Check API keys in Vercel environment variables.');
}

function parseAIResponse(text: string, platform: string, scenario: any): any {
  // Try JSON parse first
  try {
    const clean = text.replace(/```json\n?|```\n?/g, '').trim();
    const parsed = JSON.parse(clean);
    if (parsed.replies) return { ...parsed, modelUsed: parsed.modelUsed || 'cic-v2' };
  } catch { /* not JSON -- parse as text */ }

  // Category 2 alphadate: single sentence reply
  if (platform === 'alphadate' && scenario?.category === 2) {
    const cleaned = text.replace(/^(reply:|output:|response:)/i, '').trim();
    return {
      replies:    [{ tone: 'Reply', text: cleaned }],
      modelUsed:  'cic-v2',
    };
  }

  // Category 1 alphadate: parse [Option 1] [Option 2] [Option 3] format
  if (platform === 'alphadate' && scenario?.category === 1) {
    const options: Array<{tone: string, text: string}> = [];
    const matches = text.matchAll(/\[Option\s*(\d+)\][:\s]*([\s\S]*?)(?=\[Option\s*\d+\]|$)/gi);
    for (const m of matches) {
      const t = m[2].trim();
      if (t) options.push({ tone: 'Option ' + m[1], text: t });
    }
    if (options.length > 0) {
      return { replies: options, modelUsed: 'cic-v2' };
    }
  }

  // Fallback: split by double newline into 3-4 options
  const chunks = text.split(/\n{2,}/).map(c => c.trim()).filter(Boolean);
  const replies = chunks.slice(0, 4).map((c, i) => ({
    tone: ['Warm', 'Flirty', 'Playful', 'Direct'][i] || 'Reply ' + (i + 1),
    text: c,
  }));

  return {
    replies:   replies.length > 0 ? replies : [{ tone: 'Reply', text: text.trim() }],
    modelUsed: 'cic-v2',
  };
}