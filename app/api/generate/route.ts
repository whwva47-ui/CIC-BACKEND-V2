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
  'chrome-extension://kdmffkblhinlggeopcglmhoolgmmfdaj',
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

  const sessionToken = req.headers.get('X-Session-Token') || '';
  const apiKey       = req.headers.get('X-API-Key') || '';

  if (apiKey === 'test_key') {
    return NextResponse.json(
      { error: 'Your extension is outdated. Please update CIC to the latest version.' },
      { status: 401, headers: h }
    );
  }

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
    console.warn('[generate] Request without session token from:', userEmail);
  }

  let profile: any = null;
  if (userEmail) {
    const { data: profileData } = await getSupabase()
      .from('profiles')
      .select('plan, plan_status, daily_generations, max_daily_generations, last_generation_date, total_generations, trial_ends_at, plan_expires_at, explicit_enabled, replies_per_period, period_days')
      .eq('email', userEmail)
      .maybeSingle();
    profile = profileData;

    if (profile && profile.plan_status === 'approved') {
      const now   = new Date();
      const today = now.toISOString().split('T')[0];

      if (profile.plan === 'free') {
        const trialEnd = profile.trial_ends_at ? new Date(profile.trial_ends_at) : null;

        if (!trialEnd || now > trialEnd) {
          return NextResponse.json(
            { error: 'Your 7-day free trial has ended. Upgrade to Basic ($8/mo) or Pro ($15/mo) to continue.', upgrade: true },
            { status: 403, headers: h }
          );
        }

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

        (pageContext as any).trialPremium = isPremiumDay;

        await getSupabase().from('profiles').update({
          daily_generations:    dailyCount + 1,
          last_generation_date: today,
          total_generations:    (profile.total_generations || 0) + 1,
        }).eq('email', userEmail);
      }

      else if (profile.plan === 'basic') {
        if (profile.plan_expires_at && now > new Date(profile.plan_expires_at)) {
          return NextResponse.json(
            { error: 'Your Basic plan has expired. Please renew to continue.', upgrade: true },
            { status: 403, headers: h }
          );
        }

        let dailyCount = profile.daily_generations || 0;
        if (profile.last_generation_date !== today) dailyCount = 0;

        await getSupabase().from('profiles').update({
          daily_generations:    dailyCount + 1,
          last_generation_date: today,
          total_generations:    (profile.total_generations || 0) + 1,
        }).eq('email', userEmail);
      }

      else if (profile.plan === 'pro') {
        if (profile.plan_expires_at && now > new Date(profile.plan_expires_at)) {
          return NextResponse.json(
            { error: 'Your Pro plan has expired. Please renew to continue.', upgrade: true },
            { status: 403, headers: h }
          );
        }
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

  const isPro        = profile?.plan === 'pro';
  const trialPremium = (pageContext as any).trialPremium !== false;
  const allowExplicit = isPro;
  const allowPremium  = isPro || (profile?.plan === 'free' && trialPremium);
  const qualityNote   = allowPremium
    ? `-- PREMIUM QUALITY: replies must be deeply personal, emotionally intelligent, and directly tied to what he said and his chat history. Never generic. Never surface-level. Every reply must feel like it could ONLY have been written for this specific man in this specific conversation.`
    : `-- STANDARD QUALITY: warm, flirtatious, and engaging replies. Match his energy. No explicit content -- escalate flirtation and romantic tension instead. Always end with a strong CTA.`;

  let systemPrompt: string;
  let userPrompt:   string;

  if (platform === 'alphadate' && isCold && coldSigs) {
    systemPrompt = buildColdClientPrompt(coldSigs);
    userPrompt   = message;
  } else if (platform === 'alphadate' && scenario) {
    systemPrompt = buildAlphadateSystemPrompt(scenario, message) + '\n\n' + qualityNote;
    userPrompt   = buildAlphadateUserPrompt(message, pageContext, scenario);
  } else {
    systemPrompt = buildGenericSystemPrompt(platform, allowExplicit) + '\n\n' + qualityNote;
    userPrompt   = buildGenericUserPrompt(message, pageContext);
  }

  try {
    const aiResponse = await callAI(systemPrompt, userPrompt);
    const parsed     = parseAIResponse(aiResponse, platform, scenario);
    return NextResponse.json(parsed, { status: 200, headers: h });
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    console.error('[generate] AI error:', errMsg);
    if (errMsg.includes('API keys')) {
      return NextResponse.json({ error: 'AI service unavailable. Contact admin.' }, { status: 500, headers: h });
    }
    if (errMsg.includes('401') || errMsg.includes('auth')) {
      return NextResponse.json({ error: 'AI authentication failed. Contact admin.' }, { status: 500, headers: h });
    }
    return NextResponse.json({ error: 'Generation failed. Please try again in a moment.' }, { status: 500, headers: h });
  }
}

// ─── Helper functions ────────────────────────────────────────────────────────

function buildAlphadateSystemPrompt(scenario: any, message: string): string {
  const clientName = scenario?.clientName || null;
  const trigger    = scenario?.trigger || 'active_reply';
  const tone       = scenario?.tone || 'neutral';
  const category   = scenario?.category || 2;

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
- ALWAYS end with a question or hook that compels him to reply

TONE MATCHING -- MATCH HIM EXACTLY. READ HIS CHAT HISTORY FIRST:
- Romantic -> be romantic back, warm and emotionally engaged
- Playful -> be playful, witty, light
- Serious -> be thoughtful and genuine
- Questions -> answer naturally and personally, then ask one back
- Flirtatious or suggestive -> be flirtatious and suggestive back. These are 18+ adults on a dating site.
- Explicit or naughty -> DO NOT shy away. Match his naughty energy. Be sensual, suggestive, and willing. These are consenting adults. A reply that ignores or deflects his naughtiness KILLS the conversation. Lean in.
- No reply in days -> gentle, warm, non-desperate check-in with a hook

CTA RULES -- NON-NEGOTIABLE:
- Every single reply must end with something that makes him WANT to respond
- Use curiosity hooks, personal questions, playful challenges, or open invitations
- NEVER end a reply with a statement that closes the conversation
- Bad CTA: "I had a great time." Good CTA: "I had a great time -- what would you have ordered for me?"

CURRENT TONE DETECTED: ${tone}
${trigger === 'no_reply_from_him' ? 'NOTE: He has not replied in days. Send a gentle, warm, non-desperate check-in with a strong curiosity hook.' : ''}
${clientName ? `CLIENT NAME: ${clientName}` : ''}`;
  }

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
- Every message MUST end with a question or hook that invites a reply
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

  const isLetter = trigger === 'letter';
  const isCold   = ['wink', 'liked_profile', 'viewed_profile', 'cold'].includes(trigger);

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
- End with one open-ended emotional question that makes him NEED to reply
- NO emojis`
    : `MESSAGE RULES:
- 1-2 lines only
- ALL-CAPS hook phrase (4-7 words, no ending punctuation) + body text
- Tone: friendly, playful, or slightly flirty -- calm confidence, curiosity, emotional intelligence
- Topics: life experience, timing, connection, meaningful relationships
- End with one thoughtful question that sparks curiosity and demands a reply
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
- Every message MUST end with a question or hook that makes him feel compelled to reply

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
- Every message MUST end with a question or hook that makes him want to reply
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
    parts.push('CONVERSATION HISTORY (read this carefully -- your reply must be specific to this conversation):');
    parts.push(summary);
    parts.push('');
  }

  if (ctx.userName)     parts.push('His name: ' + ctx.userName);
  if (ctx.userLocation) parts.push('His city: ' + ctx.userLocation + getNearbyCity(ctx.userLocation));
  if (ctx.userAge)      parts.push('His age: ' + ctx.userAge);

  if (scenario?.category === 2) {
    parts.push('');
    parts.push('Generate one reply to the last message. It must reference something specific from the conversation above. End with a CTA.');
  } else {
    parts.push('');
    parts.push('Generate 3 options following the category rules. Each must feel personal and specific to this conversation. Every option must end with a strong CTA.');
    if (message && !message.startsWith('COLD CLIENT') && !message.startsWith('CATEGORY')) {
      parts.push('Last message from him: "' + message + '"');
    }
  }

  return parts.join('\n');
}

function buildGenericSystemPrompt(platform: string, allowExplicit = false): string {

  const tfRules = `You are writing on behalf of a real woman on Texting Factory (chathomebase.com). The platform serves 18+ adults on a dating site. Men here want romantic, flirtatious, and when the context calls for it, sexually explicit conversation. Your job is to keep him engaged, aroused, and wanting more -- targeting a reply rate of 95-100%.

CHARACTER COUNT -- NON-NEGOTIABLE:
- Every reply must be between 75 and 300 characters. Count every character.
- Replies under 75 characters: REJECTED.
- Replies over 350 characters: cut off.
- Target 120-250 characters for best results.

READ THE CONVERSATION HISTORY FIRST. Every reply must:
- Reference something SPECIFIC he said -- his name, his job, his city, something he mentioned
- Never sound copy-paste or generic
- Build naturally on what came before -- never reset the topic without reason
- Feel like it was written ONLY for this man in this specific conversation

CONTEXT-BASED CONTENT RULES:
There are TWO chat types. Read the conversation to determine which applies.

GREEN CHATS (non-sexual, marked as clean/green in the platform):
- Romance-focused. Keep it flirty, warm, emotionally engaging.
- DO NOT discuss sex, sexual fantasy, foreplay, or explicit content.
- If he sends a sexual request or suggestive photo, redirect with playful confident energy -- never reject him coldly.
- Examples for green chat redirect:
  "Mmm tempting... but I am more of a leave a little to the imagination kind of woman. Tell me something that would actually impress me though?"
  "I would rather keep you curious than give everything away that easily. What made you think of sending that?"
  "I like the energy but I am more about slow burn. What is one thing about you most women never notice?"

STANDARD CHATS (most chats -- default unless marked green):
- 18+ adult dating. Men here WANT and EXPECT flirtatious, sensual, and explicit replies.
- When he is naughty, BE NAUGHTY BACK. Do not deflect. Do not shy away. Match and slightly escalate his energy.
- If he describes a fantasy, engage with it. Add detail. Make it feel real and mutual.
- If he says something explicit, respond explicitly -- be the woman who is into it, not the woman who is uncomfortable.
- Build arousal progressively -- do not jump to fully explicit in message one, but move there naturally as he leads.
- Sound like a real woman who genuinely enjoys this -- not a script, not a bot, not a reluctant participant.
- The goal is for him to feel like he CANNOT stop replying. Every message should leave him wanting more.

CTA RULES -- NON-NEGOTIABLE. EVERY REPLY MUST END WITH A CTA:
- A CTA is a question, challenge, curiosity hook, or open invitation that makes replying feel irresistible
- Personalize the CTA to him -- use his name, his city, or something he said
- Bad CTA: "I miss you." Good CTA: "I miss you... what would you do if I was actually there right now?"
- Bad CTA: "That sounds fun." Good CTA: "That sounds fun -- are you the kind of man who actually follows through?"
- Bad CTA: "I liked that." Good CTA: "I liked that -- what else are you not telling me?"

LOCATION CTA RULE:
- If you know his city, use a city approximately 40 minutes away as a playful reference
- Example: if he is in Sydney, reference Wollongong or the Blue Mountains
- Frame it as: "I was just thinking about [nearby city] -- have you ever been there at night?"

ABSOLUTE RULES FOR ALL CHAT TYPES:
- NEVER suggest meeting in person. If he asks, redirect warmly to the conversation.
- NEVER share or request personal contact info -- no phone, WhatsApp, Instagram, email, social media.
- NEVER mention the platform name or that you are a moderator or operator.
- NEVER use emojis. Not a single one. Texting Factory flags emoji use and operators can get banned.
- Write as a warm, genuine, real woman -- not a script, not a bot.`;

  const platformRules: Record<string, string> = {
    chathomebase:   tfRules,
    textingfactory: tfRules,
    onlyfans: allowExplicit
      ? `OnlyFans platform 18+ adult content. Read the full chat history before writing. Match his energy exactly -- if he is explicit, be fully explicit and sensual back. Build arousal progressively. Reference specific things he said. Use his name if known. Upsell naturally. Every reply must end with a personalized CTA. Write as a real comfortable confident woman. No emojis.`
      : `OnlyFans platform. Warm, engaging, flirty replies. Reference what he said specifically. Build genuine connection. Every reply must end with a question or hook. No explicit content. No emojis.`,
    fansly: allowExplicit
      ? `Fansly platform 18+ adult content. Read the chat history. Match his naughtiness -- be sensual and explicit when he leads there. Reference something specific he said. Make it personal. Slow burn to hot. Every reply must end with a CTA. No emojis.`
      : `Fansly platform. Warm, engaging, personal. Flirty but tasteful. Reference what he said. Every reply must end with a question or hook. No emojis.`,
    loyalfans: allowExplicit
      ? `LoyalFans platform 18+ adult content. Read the full chat history. Loyal subscribers want intimate explicit conversation. Match his energy. Be sensual and explicit when context calls. Reference what he said specifically. Every reply ends with a personalized CTA. No emojis.`
      : `LoyalFans platform. Warm, personal, flirty replies. Reference what he said. Build genuine connection. Every reply ends with a question or hook. No emojis.`,
    fancentro: allowExplicit
      ? `FanCentro platform 18+ adult content. Read the chat history. Match his energy fully. Warm to explicitly sensual depending on context. Always personal and specific. Build rapport and escalate naturally. Every reply ends with a CTA. No emojis.`
      : `FanCentro platform. Warm, engaging, personal. Flirty and romantic. Match his tone. Every reply ends with a question or hook. No emojis.`,
    admireme: allowExplicit
      ? `AdmireMe platform 18+ adult content. Read the chat history. Men here admire the creator and want intimate explicit conversation. Match his energy. Be warm confident and sensual when he leads there. Every reply ends with a personalized CTA. No emojis.`
      : `AdmireMe platform. Warm, engaging, personal. Flirty and romantic. Keep replies varied. Every reply ends with a question or hook. No emojis.`,
    fanvue: allowExplicit
      ? `FanVue platform 18+ adult content. Read the chat history. Match his energy -- flirty to fully explicit when context calls. Personal and specific to what he said. Build real connection. Every reply ends with a CTA. No emojis.`
      : `FanVue platform. Warm, engaging, personal. Flirty and romantic. Match his energy. Every reply ends with a question or hook. No emojis.`,
    manyvids: allowExplicit
      ? `ManyVids platform 18+ adult content. Read the chat history. Warm personal sensual. Match his energy and escalate naturally if he is explicit. Reference what he said specifically. Every reply ends with a CTA. No emojis.`
      : `ManyVids platform. Warm, personal. Flirty and romantic. Reference what he said. Every reply ends with a question or hook. No emojis.`,
    chatterapply: allowExplicit
      ? `ChatterApply OnlyFans agency 18+ adult conversations. Read the full chat history. Professional but warm and flirtatious. 75-250 characters. Match his energy and escalate if suggestive or explicit. Never meeting in person. Never contact info. Every reply ends with a personalized CTA. No emojis. Never name the platform.`
      : `ChatterApply OnlyFans agency. Read the full chat history. Professional yet warm and flirtatious. 75-250 characters. No explicit content. Never meeting in person. No contact info. Every reply ends with a CTA. No emojis.`,
    unlockd: `Unlockd platform. Warm, engaging, personal replies. Read the chat history. Every reply ends with a question or hook. No emojis.`,
    alphadate: `Alpha.date dating platform. Men aged 40-80 from Western countries. Read the full chat history. Mature, warm, calm, emotionally intelligent tone. Never sound desperate or generic. Every reply ends with a CTA. No emojis.`,
    generic: allowExplicit
      ? `General 18+ dating platform. Read the chat history. Match his energy fully. Warm personal and explicitly sensual when he leads there. Reference what he said. Build real connection. Every reply ends with a personalized CTA. No emojis.`
      : `General dating platform. Warm, engaging, personal, flirtatious replies. Match his tone. Read the chat history. Every reply ends with a question or hook. No emojis.`,
  };

  const rules = platformRules[platform] || platformRules.generic;

  return `You are an expert chatter assistant for professional operators on adult and dating platforms. Your goal is a 95-100% reply rate from men.

PLATFORM: ${platform}
PLATFORM RULES:
${rules}

YOUR TASK:
Generate 4 reply options for the operator to choose from.
Each reply must:
- Reference something SPECIFIC from the conversation history -- his name, his job, something he said, his location
- Feel genuinely personal -- if it could be sent to any man, rewrite it
- Match the emotional and sexual tone of his last message exactly
- Be varied in tone across the 4 options
- End with a strong personalized CTA -- EVERY single option, no exceptions

OUTPUT FORMAT (JSON only, no other text):
{
  "replies": [
    {"tone": "Warm", "text": "..."},
    {"tone": "Flirty", "text": "..."},
    {"tone": "Naughty", "text": "..."},
    {"tone": "Playful", "text": "..."}
  ],
  "analysis": "one sentence about his emotional state and what will make him reply",
  "modelUsed": "cic-v2"
}`;
}

function buildGenericUserPrompt(message: string, ctx: any): string {
  const parts = [];
  if (ctx.platform)  parts.push('Platform: ' + ctx.platform);
  if (ctx.userName)  parts.push('His name: ' + ctx.userName);
  if (ctx.userAge)   parts.push('His age: ' + ctx.userAge);

  if (ctx.userLocation) {
    const nearby = getNearbyCity(ctx.userLocation);
    parts.push('His city: ' + ctx.userLocation + nearby);
  }

  if (ctx.conversationSummary) {
    parts.push('');
    parts.push('CONVERSATION HISTORY (read carefully -- your reply must be specific to this man and this conversation):');
    parts.push(ctx.conversationSummary);
  }

  parts.push('');
  parts.push('Last message from him: "' + message + '"');
  parts.push('');
  parts.push('Generate 4 reply options. Each must reference something specific from the conversation above. Each must end with a personalized CTA. If he was naughty, at least 2 options must match his naughty energy.');
  return parts.join('\n');
}

function getNearbyCity(location: string): string {
  if (!location) return '';

  const cityMap: Record<string, string> = {
    // Australia
    'sydney': ' (nearby: Wollongong or Blue Mountains)',
    'melbourne': ' (nearby: Geelong or Ballarat)',
    'brisbane': ' (nearby: Gold Coast or Ipswich)',
    'perth': ' (nearby: Fremantle or Mandurah)',
    'adelaide': ' (nearby: Glenelg or Mount Barker)',
    'gold coast': ' (nearby: Byron Bay or Brisbane)',
    // USA
    'new york': ' (nearby: Jersey City or Hoboken)',
    'los angeles': ' (nearby: Pasadena or Santa Monica)',
    'chicago': ' (nearby: Evanston or Oak Park)',
    'houston': ' (nearby: Sugar Land or The Woodlands)',
    'miami': ' (nearby: Fort Lauderdale or Coral Gables)',
    'san francisco': ' (nearby: Oakland or Sausalito)',
    'las vegas': ' (nearby: Henderson or Boulder City)',
    'dallas': ' (nearby: Fort Worth or Plano)',
    'seattle': ' (nearby: Bellevue or Tacoma)',
    'denver': ' (nearby: Boulder or Aurora)',
    // UK
    'london': ' (nearby: Richmond or Windsor)',
    'manchester': ' (nearby: Salford or Stockport)',
    'birmingham': ' (nearby: Coventry or Wolverhampton)',
    // Canada
    'toronto': ' (nearby: Mississauga or Oakville)',
    'vancouver': ' (nearby: Burnaby or Richmond)',
    'calgary': ' (nearby: Airdrie or Cochrane)',
    // Other
    'dubai': ' (nearby: Sharjah or Abu Dhabi)',
    'singapore': ' (nearby: Johor Bahru)',
  };

  const key = location.toLowerCase().trim();
  for (const city in cityMap) {
    if (key.includes(city)) return cityMap[city];
  }
  return '';
}

async function callAI(systemPrompt: string, userPrompt: string): Promise<string> {
  const groqKey   = process.env.GROQ_API_KEY || '';
  const googleKey = process.env.GOOGLE_AI_API_KEY || '';

  if (groqKey) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        signal: controller.signal,
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + groqKey },
        body: JSON.stringify({
          model:       'llama-3.1-8b-instant',
          max_tokens:  500,
          temperature: 0.82,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user',   content: userPrompt   },
          ],
        }),
      });
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content || '';
        if (text.length > 10) return text;
      } else {
        const errText = await res.text();
        console.warn('[generate] Groq 8b failed:', res.status, errText.substring(0, 100));
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
  try {
    const clean = text.replace(/```json\n?|```\n?/g, '').trim();
    const parsed = JSON.parse(clean);
    if (parsed.replies) return { ...parsed, modelUsed: parsed.modelUsed || 'cic-v2' };
  } catch { /* not JSON -- parse as text */ }

  if (platform === 'alphadate' && scenario?.category === 2) {
    const cleaned = text.replace(/^(reply:|output:|response:)/i, '').trim();
    return {
      replies:   [{ tone: 'Reply', text: cleaned }],
      modelUsed: 'cic-v2',
    };
  }

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

  const chunks = text.split(/\n{2,}/).map(c => c.trim()).filter(Boolean);
  const replies = chunks.slice(0, 4).map((c, i) => ({
    tone: ['Warm', 'Flirty', 'Naughty', 'Playful'][i] || 'Reply ' + (i + 1),
    text: c,
  }));

  return {
    replies:   replies.length > 0 ? replies : [{ tone: 'Reply', text: text.trim() }],
    modelUsed: 'cic-v2',
  };
}
