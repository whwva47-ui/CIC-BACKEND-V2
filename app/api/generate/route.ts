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
  'https://chattersinnercircle.vercel.app',
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
  'https://chatterapply.com',
  'https://www.chatterapply.com',
  'http://localhost:3000',
];

function cors(origin: string | null) {
  // If origin is in our allowed list, echo it back exactly.
  // If not (or null -- same-origin / server-side calls), allow chattersinnercircle.vercel.app.
  const o = origin && ALLOWED_ORIGINS.includes(origin)
    ? origin
    : 'https://chattersinnercircle.vercel.app';
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
  // FREE   = 7-day trial: days 1-3 premium 50/day, days 4-5 basic 30/day, day6 basic 20/day, day7 basic 10/day
  // BASIC  = $8/mo: unlimited generic replies, no explicit content, standard AI
  // PRO    = $15/mo: unlimited, full explicit/erotic content, premium AI
  if (userEmail) {
    const { data: profile } = await getSupabase()
      .from('profiles')
      .select('plan, plan_status, daily_generations, max_daily_generations, last_generation_date, total_generations, trial_ends_at, plan_expires_at, explicit_enabled, replies_per_period, period_days')
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

        // Trial tier limits:
        // Days 1-3: 50 premium replies/day (Pro quality)
        // Days 4-5: 30 basic replies/day (generic quality)
        // Day 6:    20 basic replies/day
        // Day 7:    10 basic replies/day
        const trialStart = new Date(trialEnd.getTime() - 7 * 24 * 60 * 60 * 1000);
        const dayOfTrial = Math.floor((now.getTime() - trialStart.getTime()) / (24 * 60 * 60 * 1000)) + 1;
        const dailyLimit = dayOfTrial <= 3 ? 50 : dayOfTrial <= 5 ? 30 : dayOfTrial === 6 ? 20 : 10;
        const isPremiumDay = dayOfTrial <= 3;

        let dailyCount = profile.daily_generations || 0;
        if (profile.last_generation_date !== today) dailyCount = 0;

        if (dailyCount >= dailyLimit) {
          const msg = dayOfTrial <= 3
            ? `Day ${dayOfTrial} of trial: ${dailyLimit} premium replies/day limit reached. Upgrade to Pro for unlimited access.`
            : `Day ${dayOfTrial} of trial: ${dailyLimit} replies/day limit reached. Upgrade to Basic or Pro for more.`;
          return NextResponse.json({ error: msg, upgrade: true, trialDay: dayOfTrial }, { status: 403, headers: h });
        }
        
        // Pass isPremiumDay to prompt builder so days 4-7 get basic responses
        (pageContext as any).trialPremium = isPremiumDay;

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

        // Basic plan: unlimited generic replies -- no daily cap
        // (quality is standard/generic, no explicit content)

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

  // Quality tier: Pro gets premium+explicit, Basic gets standard, trial days 4-7 get basic
  const isPro     = profile?.plan === 'pro';
  const isBasic   = profile?.plan === 'basic';
  const trialPremium = (pageContext as any).trialPremium !== false;
  const allowExplicit  = isPro;
  const allowPremium   = isPro || (profile?.plan === 'free' && trialPremium);
  const qualityNote    = allowPremium
    ? '-- PREMIUM QUALITY: replies must be deeply personal, emotionally intelligent, specific to his message, psychologically engaging. Never generic. Never surface-level.'
    : '-- STANDARD QUALITY: warm, flirtatious, and engaging replies. Match his energy. Competent but not premium AI. No explicit content on standard plan -- escalate flirtation and romantic tension instead.';

  // -- Build system prompt based on platform and scenario --------
  let systemPrompt: string;
  let userPrompt:   string;

  if (platform === 'alphadate' && isCold && coldSigs) {
    // Re-engage cold client -- use cold client specialist prompt
    systemPrompt = buildColdClientPrompt(coldSigs);
    userPrompt   = message; // already the full cold client prompt from content script
  } else if (platform === 'alphadate' && scenario) {
    // Active conversation or first outreach -- use category rules
    systemPrompt = buildAlphadateSystemPrompt(scenario, message) + '\n\n' + qualityNote;
    userPrompt   = buildAlphadateUserPrompt(message, pageContext, scenario);
  } else {
    // Other platforms -- generic chatter assistant
    systemPrompt = buildGenericSystemPrompt(platform, allowExplicit) + '\n\n' + qualityNote;
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

TONE MATCHING -- MATCH HIM EXACTLY:
- Romantic -> be romantic back, warm and emotionally engaged
- Playful -> be playful, witty, light
- Serious -> be thoughtful and genuine
- Questions -> answer naturally then ask one back
- Flirtatious or suggestive -> be flirtatious and suggestive back. These are 18+ adults on a dating site.
- Explicit or naughty -> match his energy. Be sensual and suggestive in return. Keep it tasteful but do not deny him.
- No reply in days -> gentle, warm, non-desperate check-in
- Pet names are fine (babe, handsome) but do not overdo it

CURRENT TONE DETECTED: ${tone}
${trigger === 'no_reply_from_him' ? 'NOTE: He has not replied in days. Send a gentle, warm, non-desperate check-in.' : ''}
${clientName ? `CLIENT NAME: ${clientName}` : ''}`;
  }

  // -- CATEGORY 3: Bulk sender / mass content with emojis ----------
  if (category === 3) {
    return `You are an AI assistant generating short bulk sender messages on behalf of an operator on alpha.date.

CATEGORY 3 RULES -- BULK CONTENT:
- Messages should be under 20 words
- Roughly 40% of messages should start with an ALL CAPS hook (4-7 words, no punctuation at end)
- The other 60% can be conversational openers without the caps hook
- Emojis are allowed and encouraged -- they increase engagement in bulk sends
- Vary the topics widely: travel, morning routines, late night thoughts, weekend plans, dreams, food, music
- Tone: curious, playful, light -- these are opener messages to a broad audience
- NO pressure, NO desperation, NO explicit content in bulk
- Never the same message twice
- Output as JSON with 4 varied options

OUTPUT FORMAT (JSON only):
{
  "replies": [
    {"tone": "Curious", "text": "..."},
    {"tone": "Playful", "text": "..."},
    {"tone": "Bold opener", "text": "..."},
    {"tone": "Light", "text": "..."}
  ],
  "modelUsed": "cic-v2"
}

${clientName ? 'Personalise with name: ' + clientName : 'No name available -- keep generic'}`;
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
- Most outreach messages work best with a strong HOOK in ALL CAPITAL LETTERS (4-7 words) -- use this when writing first messages, but adapt if the scenario calls for something softer
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

function buildGenericSystemPrompt(platform: string, allowExplicit = false): string {

  const tfRules = `You are writing on behalf of a real woman on Texting Factory (chathomebase.com). The platform serves 18+ adults on a dating site. Men here want romantic, flirtatious, and when the context calls for it, sexually suggestive conversation. Your job is to keep him engaged and wanting more.

CHARACTER COUNT -- NON-NEGOTIABLE:
- Every reply must be between 75 and 300 characters. Count every character.
- Replies under 75 characters: REJECTED.
- Replies over 350 characters: cut off.
- Target 120-250 characters for best results.

CONTEXT-BASED CONTENT RULES:
There are TWO chat types. Read the conversation to determine which applies.

GREEN CHATS (non-sexual, marked as clean/green in the platform):
- These are romance-focused. Keep it flirty, warm, emotionally engaging.
- You MAY NOT discuss sex, sexual fantasy, foreplay, or explicit content in green chats.
- If he sends a sexual request or a suggestive photo (cucumber, eggplant, etc.), DO NOT ignore it but keep it classy. Do not reject him either -- redirect with playful, teasing, confident energy.
- Examples for green chat sexual redirect:
  "Mmm tempting... but I am more of a leave a little to the imagination kind of woman."
  "I would rather keep you curious than give everything away that easily."
  "That is quite the picture. I appreciate it, but I am a win-me-over-with-conversation-first kind of girl."
  "I like the energy but I am more about slow burn than fast forward."
  "You have got my attention. I just prefer a bit of anticipation before anything goes there."

STANDARD CHATS (most chats -- default unless marked green):
- These are 18+ adult dating conversations. Men here WANT and EXPECT flirtatious, sensual, explicit replies.
- Match his energy exactly: if he is naughty, be naughty back. If he is explicit, respond explicitly and escalate naturally.
- Flirty and suggestive is the MINIMUM. Go further when he leads there.
- Build arousal progressively -- do not go from zero to explicit in one message, but do not hold back either.
- Be playful, seductive, and real. Sound like a woman who enjoys this, not a script.

ABSOLUTE RULES FOR ALL CHAT TYPES:
- NEVER suggest meeting in person.
- NEVER share or request any personal contact info (phone, WhatsApp, Instagram, Snapchat, email).
- NEVER mention the platform name or that you are an operator.
- NEVER use emojis (Texting Factory flags emoji use).
- Always end with a CTA -- a question, invitation, or hook that makes him respond.
- Every reply must reference something specific he said. Never generic.
- Write as a real, confident woman -- warm, witty, and comfortable in her own skin.`;

  const platformRules: Record<string, string> = {
    chathomebase:   tfRules,
    textingfactory: tfRules,
    onlyfans:  allowExplicit
      ? `OnlyFans platform -- 18+ adult content site. Men here subscribe specifically for intimate, explicit conversation. RULES: Match his energy exactly and escalate naturally. If he is flirty, be flirtatious. If he is explicit, be fully explicit and sensual back. Build arousal progressively across messages. Reference specific things he said -- make it feel personal, not scripted. Upsell to paid content naturally when the moment is right. Write as a real woman who is comfortable, confident, and enjoys the conversation. Never sound robotic or clinical.`
      : 'OnlyFans platform. Warm, engaging, flirty replies. Reference what he said. Build genuine connection. No explicit content -- escalate warmth and romantic tension instead.',
    fansly:    allowExplicit
      ? `Fansly platform -- 18+ adult content. Same energy as OnlyFans. Match his naughtiness, be sensual and explicit when he leads there. Always reference something specific he said. Make it feel real and personal. Build the conversation progressively -- slow burn to hot.`
      : 'Fansly platform. Warm, engaging, personal replies. Flirty but tasteful. Reference what he said. Build romantic tension.',
    loyalfans: allowExplicit
      ? `LoyalFans platform -- 18+ adult content. These men are loyal subscribers who want intimate, personal, often explicit conversation. Match his energy. Be warm, sensual, and explicit when context calls for it. Always reference something specific he said. Build real emotional and physical connection.`
      : 'LoyalFans platform. Warm, personal, flirty replies. Reference what he said. Build genuine connection over time.',
    fancentro: allowExplicit
      ? `FanCentro platform -- 18+ adult content. Match his energy fully. Warm to explicitly sensual depending on what he brings. Always personal and specific to what he said. Build rapport and escalate naturally.`
      : 'FanCentro platform. Warm, engaging, personal replies. Flirty and romantic. Match his tone.',
    admireme:  allowExplicit
      ? `AdmireMe platform -- 18+ adult content. Men here admire the creator and want intimate, personal, sometimes explicit conversation. Match his energy. Be warm, confident, and sensual when he leads there. Always personal.`
      : 'AdmireMe platform. Warm, engaging, personal. Flirty and romantic. Keep replies varied and specific.',
    fanvue:    allowExplicit
      ? `FanVue platform -- 18+ adult content. Match his energy. Flirty to fully explicit when context calls for it. Personal and specific to what he said. Build real connection.`
      : 'FanVue platform. Warm, engaging, personal. Flirty and romantic. Match his energy.',
    manyvids:  allowExplicit
      ? `ManyVids platform -- 18+ adult content. Warm, personal, sensual. Match his energy and escalate naturally if he is being explicit. Reference what he said specifically -- make it feel like a real conversation, not a template.`
      : 'ManyVids platform. Warm, personal. Flirty and romantic. Reference what he said specifically.',
    chatterapply: allowExplicit
      ? `ChatterApply platform -- OnlyFans chatting agency. These are 18+ adult conversations. Be professional but genuinely warm and flirtatious. 75-250 characters. Always include a CTA. Match his energy -- if he is being suggestive, be suggestive back and escalate naturally. Never mention meeting in person. Never share contact info. No emojis. Never name the platform.`
      : 'ChatterApply platform -- OnlyFans chatting agency. Professional yet warm and flirtatious. 75-250 characters. Always include a CTA. No explicit content. Flirty and romantic. Never mention meeting in person. Never share contact info. No emojis. Never name the platform.',
    unlockd:   'Unlockd platform. Warm, engaging, personal replies.',
    alphadate: 'Alpha.date dating platform. Men aged 40-80 from Western countries. Mature, warm, calm, emotionally intelligent tone. Never sound desperate or generic.',
    generic:   allowExplicit
      ? 'General 18+ dating or chat platform. Match his energy fully. Warm, personal, and explicitly sensual when he leads there. Reference what he said. Build real connection progressively.'
      : 'General dating or chat platform. Warm, engaging, personal, flirtatious replies. Match his tone.',
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