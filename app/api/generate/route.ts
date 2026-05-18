import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // seconds — prevents Vercel killing AI calls mid-retry

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const ALLOWED_ORIGINS = [
  // CIC extension (standard Chrome)
  'chrome-extension://kdmffkblhinlggeopcglmhoolgmmfdaj',
  // CIC web apps
  'https://chattersinnercircle.vercel.app',
  'https://cic-backend-v2.vercel.app',
  // OnlyMonster desktop browser — Chromium-based, loads OF inside its own browser
  // The extension is sideloaded into OnlyMonster via the standard Chrome extension ID
  'https://onlymonster.ai',
  'https://app.onlymonster.ai',
  // Platforms
  'https://chathomebase.com',
  'https://www.chathomebase.com',
  'https://alpha.date',
  'https://www.alpha.date',
  'https://onlyfans.com',
  'https://www.onlyfans.com',
  'https://fansly.com',
  'https://www.fansly.com',
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

        const trialStart  = new Date(trialEnd.getTime() - 7 * 24 * 60 * 60 * 1000);
        const dayOfTrial  = Math.floor((now.getTime() - trialStart.getTime()) / (24 * 60 * 60 * 1000)) + 1;
        const dailyLimit  = dayOfTrial <= 3 ? 50 : dayOfTrial <= 5 ? 30 : dayOfTrial === 6 ? 20 : 10;
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

  const platform = pageContext.platform || 'generic';
  // Treat OnlyMonster as onlyfans — it loads OF inside its browser
  const resolvedPlatform = platform === 'onlymonster' ? 'onlyfans' : platform;
  const scenario = pageContext.alphadateScenario || null;
  const isCold   = pageContext.isColdClient || false;
  const coldSigs = pageContext.coldClientSignals || null;
  // Language: detect from pageContext or auto-detect from message
  const targetLang = pageContext.targetLanguage || null; // e.g. 'Spanish', 'French', 'German'

  const isPro        = profile?.plan === 'pro';
  const trialPremium = (pageContext as any).trialPremium !== false;
  const allowExplicit = isPro;
  const allowPremium  = isPro || (profile?.plan === 'free' && trialPremium);
  const qualityNote = allowPremium
    ? `PREMIUM: Make every reply feel written ONLY for this man. Reference something specific he said. Never generic.`
    : `STANDARD: Warm, flirtatious, engaging. Match his energy. End with a strong CTA.`;

  let systemPrompt: string;
  let userPrompt:   string;

  if (platform === 'alphadate' && isCold && coldSigs) {
    systemPrompt = buildColdClientPrompt(coldSigs);
    userPrompt   = message;
  } else if (platform === 'alphadate' && scenario) {
    systemPrompt = buildAlphadateSystemPrompt(scenario, message) + '\n\n' + qualityNote;
    userPrompt   = buildAlphadateUserPrompt(message, pageContext, scenario);
  } else {
    systemPrompt = buildGenericSystemPrompt(resolvedPlatform, allowExplicit, targetLang) + '\n\n' + qualityNote;
    userPrompt   = buildGenericUserPrompt(message, { ...pageContext, platform: resolvedPlatform });
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

function isRealName(name: string): boolean {
  if (!name) return false;
  const blocked = ['chat', 'chatter', 'user', 'member', 'guy', 'client', 'unknown', 'guest', 'operator', 'admin', 'test'];
  const lower = name.toLowerCase().trim();
  if (blocked.some(b => lower.includes(b))) return false;
  if (lower.length < 2 || lower.length > 20) return false;
  if (/\d/.test(lower)) return false; // contains numbers -- not a real name
  return true;
}

function getNearbyCity(location: string): string {
  if (!location || location.trim().length < 2) return '';

  const cityMap: Record<string, string> = {
    // Australia
    'sydney': 'Wollongong',
    'melbourne': 'Geelong',
    'brisbane': 'Gold Coast',
    'perth': 'Fremantle',
    'adelaide': 'Glenelg',
    'gold coast': 'Byron Bay',
    'canberra': 'Goulburn',
    'newcastle': 'Maitland',
    'hobart': 'Launceston',
    // USA
    'new york': 'Jersey City',
    'los angeles': 'Pasadena',
    'chicago': 'Evanston',
    'houston': 'Sugar Land',
    'miami': 'Fort Lauderdale',
    'san francisco': 'Sausalito',
    'las vegas': 'Henderson',
    'dallas': 'Fort Worth',
    'seattle': 'Bellevue',
    'denver': 'Boulder',
    'phoenix': 'Scottsdale',
    'atlanta': 'Marietta',
    'boston': 'Cambridge',
    'san diego': 'Chula Vista',
    'portland': 'Beaverton',
    'austin': 'Round Rock',
    // UK
    'london': 'Richmond',
    'manchester': 'Salford',
    'birmingham': 'Coventry',
    'leeds': 'Bradford',
    'glasgow': 'Paisley',
    'edinburgh': 'Livingston',
    // Canada
    'toronto': 'Mississauga',
    'vancouver': 'Burnaby',
    'calgary': 'Airdrie',
    'ottawa': 'Gatineau',
    'montreal': 'Laval',
    // Other
    'dubai': 'Sharjah',
    'singapore': 'Johor Bahru',
    'auckland': 'Hamilton',
    'dublin': 'Drogheda',
  };

  const key = location.toLowerCase().trim();
  for (const city in cityMap) {
    if (key.includes(city)) {
      return ` -- nearby city for optional CTA use: ${cityMap[city]}`;
    }
  }

  // Location known but city not in map -- do not invent a nearby city
  return ` -- his location is known but do not guess or invent a nearby city. Reference his location warmly and generally instead.`;
}

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

NAME RULES:
- NEVER address him as "Chat", "Chatter", "Chat guy", or any platform-related term
- Only use his name if it is a genuine human first name
- When in doubt, use no name at all

MEETING RULES:
- NEVER suggest, agree to, promise, hint at, or imply any possibility of meeting in person -- not now, not later, not someday
- NEVER say "maybe one day", "I would love to meet you", "who knows what the future holds", or anything that implies a real-world meetup
- If he asks to meet, redirect warmly: focus on building the connection here first

TONE MATCHING -- READ HIS CHAT HISTORY FIRST, THEN MATCH HIM EXACTLY:
- Romantic -> be romantic back, warm and emotionally engaged
- Playful -> be playful, witty, light
- Serious -> be thoughtful and genuine
- Questions -> answer naturally and personally, then ask one back
- Flirtatious or suggestive -> be flirtatious and suggestive back. These are 18+ adults on a dating site.
- Explicit or naughty -> DO NOT shy away. Match his naughty energy. Be sensual, suggestive, and willing. A reply that deflects his naughtiness kills the conversation. Lean in.
- No reply in days -> gentle, warm, non-desperate check-in with a curiosity hook

CTA RULES -- NON-NEGOTIABLE:
- Every reply must end with something that makes him WANT to respond
- Use curiosity hooks, personal questions, playful challenges, or open invitations
- NEVER end a reply with a statement that closes the conversation
- Bad CTA: "I had a great time." Good CTA: "I had a great time -- what would you have ordered for me?"

CURRENT TONE DETECTED: ${tone}
${trigger === 'no_reply_from_him' ? 'NOTE: He has not replied in days. Send a gentle, warm, non-desperate check-in with a strong curiosity hook.' : ''}
${clientName && isRealName(clientName) ? `CLIENT NAME: ${clientName}` : 'NAME: No verified real name -- do not use any name.'}`;
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
- NO meeting suggestions, promises, or implications of any kind
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

${clientName && isRealName(clientName) ? 'Personalise with name: ' + clientName : 'No verified real name -- keep generic, use no name'}`;
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
- NO meeting suggestions, promises, or implications of any kind
- End with one open-ended emotional question that makes him NEED to reply
- NO emojis`
    : `MESSAGE RULES:
- 1-2 lines only
- ALL-CAPS hook phrase (4-7 words, no ending punctuation) + body text
- Tone: friendly, playful, or slightly flirty -- calm confidence, curiosity, emotional intelligence
- Topics: life experience, timing, connection, meaningful relationships
- NO meeting suggestions, promises, or implications of any kind
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
- Most outreach messages work best with a strong HOOK in ALL CAPITAL LETTERS (4-7 words)
- Never mention AI
- Fluent, natural Western English
- Write as if a real, emotionally intelligent woman who values depth over games
- NEVER suggest, agree to, promise, hint at, or imply any possibility of meeting in person
- NEVER say "maybe one day", "I would love to meet you", or anything implying a real-world meetup
- NEVER address him as "Chat", "Chatter", or any platform term -- use his real name only if it is a genuine human first name
- Every message MUST end with a question or hook that makes him feel compelled to reply

${hookRules}

${contentRules}

${scenarioInstruction}
${clientName && isRealName(clientName) ? `CLIENT NAME: Include "${clientName}" at the beginning of the output.` : 'NAME: No verified real name available -- do not use any name.'}

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
- NEVER suggest, promise, or imply meeting in person
- NEVER address him as "Chat", "Chatter", or any platform term -- use real name only if it is a genuine human first name
- NO emojis
- Output as JSON: { "analysis": "one sentence insight", "replies": [{"tone":"label","text":"message"}, ...] }

CLIENT SIGNAL: ${signals.winkSent ? 'Sent a wink' : signals.likedProfile ? 'Liked the profile' : signals.readButNoReply ? 'Read the message but did not reply' : 'Went inactive'}
${signals.clientName && isRealName(signals.clientName) ? `CLIENT NAME: ${signals.clientName}` : 'NAME: No verified real name -- use no name'}
${signals.lastActionText ? `LAST ACTIVITY: ${signals.lastActionText}` : ''}
${signals.profileDetails ? `PROFILE INFO: ${signals.profileDetails}` : ''}
${signals.lastIncoming ? `LAST MESSAGE FROM HIM: "${signals.lastIncoming}"` : ''}`;
}

function buildAlphadateUserPrompt(message: string, ctx: any, scenario: any): string {
  const summary   = ctx.conversationSummary || '';
  const cleanName = ctx.userName && isRealName(ctx.userName) ? ctx.userName : null;
  const parts     = [];

  if (summary && summary.length > 10) {
    parts.push('CONVERSATION HISTORY (read carefully -- your reply must be specific to this man and this conversation):');
    parts.push(summary);
    parts.push('');
  }

  if (cleanName)        parts.push('His name: ' + cleanName);
  if (ctx.userLocation) parts.push('His location: ' + ctx.userLocation + getNearbyCity(ctx.userLocation));
  if (ctx.userAge)      parts.push('His age: ' + ctx.userAge);

  if (scenario?.category === 2) {
    parts.push('');
    parts.push('Generate one reply to the last message. It must reference something specific from the conversation above. End with a CTA. Never promise or imply meeting in person.');
  } else {
    parts.push('');
    parts.push('Generate 3 options following the category rules. Each must feel personal and specific to this conversation. Every option must end with a strong CTA. Never promise or imply meeting in person.');
    if (message && !message.startsWith('COLD CLIENT') && !message.startsWith('CATEGORY')) {
      parts.push('Last message from him: "' + message + '"');
    }
  }

  return parts.join('\n');
}

function buildGenericSystemPrompt(platform: string, allowExplicit = false, targetLang: string | null = null): string {

  const tfRules = `PLATFORM: Texting Factory / chathomebase.com — 18+ adult dating. Target 99% reply rate.

IDENTITY — YOU ARE THE WOMAN. ALWAYS:
HIM = the man. YOU = her. His message is what HE said TO her.
If he asks about bra/panties/photos — those are his requests TO her. She responds as a woman.
NEVER flip the subject. WRONG: "your bra and panties is tempting". RIGHT: "That depends on how good you have been."

CHARACTER: Mature. Confident. Warm. Funny. Full life. Never waiting. Dry humour. Direct. Impossible to unsettle.
CHAR LIMIT: 75–300 chars per reply. Target 120–250.
NAME: Real human first names only. NEVER "Chat" "Chatter" or platform terms.

MEETING — ABSOLUTE: Never suggest or imply. If asked: "I would ruin the fantasy by making you sit through my actual coffee order."
CONTACT — ABSOLUTE: Never share phone/WhatsApp/Instagram/email. If asked: "I protect my number like it is classified. Nothing personal. Mostly personal." Then redirect.

GREEN chats: Romance/flirt only. No explicit. Redirect naughty warmly.
STANDARD chats (default): When he is naughty BE NAUGHTY BACK. Match and escalate. Real woman, genuinely into it.

CAT RULES — 99% reply rate:
- First 8 words: surprise him, reference him, or create curiosity
- End EVERY reply with a personalized CTA — never a closed statement
- 70% warmth 30% tension — leave one thread open
- No emojis. Not a script. Not a bot.`;


  const platformRules: Record<string, string> = {
    chathomebase:   tfRules,
    textingfactory: tfRules,
    onlyfans: allowExplicit
      ? `OnlyFans platform — 18+ adult content. KDM RULES ACTIVE (OnlyFans / OnlyMonster compliance):
Read the full chat history before writing. You are writing as a mature, confident, warm, funny woman — "The Woman". She has a full life. She is never desperate.
CONTENT: Match his energy exactly — if he is explicit, be fully explicit and sensual back. Build arousal progressively. Reference specific things he said. Use his real name only if it is a genuine human first name — never "Chat" or platform terms.
UPSELL: Weave in natural, non-pushy content references when contextually appropriate — never mid-explicit-exchange, never forced.
CONTACT RULES: NEVER share phone, WhatsApp, Instagram, Snap, email, or any personal contact. If he asks, deflect with warmth and wit: "I protect my number like it is the nuclear codes. Nothing personal. Mostly personal." Then redirect.
MEETING RULES: NEVER suggest or imply meeting in person. Deflect with humour: "I would ruin the fantasy by making you sit through my actual coffee order."
KDM / ONLYMONSTER: Follow OnlyFans Terms of Service. No real personal contact info. No illegal content. No minors. No real locations beyond platform-safe references.
REPLY RATE TARGET: 99%. Every reply must end with a personalized CTA. NEVER close the conversation. No emojis.`
      : `OnlyFans platform — KDM RULES ACTIVE. Warm, engaging, flirty replies. Reference what he said specifically. Build genuine connection. NEVER share contact info — deflect with warmth: "I like what we have here, let us not complicate it with read receipts." Every reply must end with a question or hook. No explicit content. NEVER suggest or imply meeting in person. Never use "Chat" or platform terms as his name. No emojis. Follow OnlyFans Terms of Service.`,
    fansly: allowExplicit
      ? `Fansly platform 18+ adult content. Read the chat history. Match his naughtiness -- be sensual and explicit when he leads there. Reference something specific he said. Make it personal. Every reply must end with a CTA. NEVER suggest or imply meeting in person. Never use "Chat" or platform terms as his name. No emojis.`
      : `Fansly platform. Warm, engaging, personal. Flirty but tasteful. Reference what he said. Every reply must end with a question or hook. NEVER suggest or imply meeting in person. Never use "Chat" or platform terms as his name. No emojis.`,
    loyalfans: allowExplicit
      ? `LoyalFans platform 18+ adult content. Read the full chat history. Match his energy. Be sensual and explicit when context calls. Reference what he said specifically. Every reply ends with a personalized CTA. NEVER suggest or imply meeting in person. Never use "Chat" or platform terms as his name. No emojis.`
      : `LoyalFans platform. Warm, personal, flirty replies. Reference what he said. Build genuine connection. Every reply ends with a question or hook. NEVER suggest or imply meeting in person. Never use "Chat" or platform terms as his name. No emojis.`,
    fancentro: allowExplicit
      ? `FanCentro platform 18+ adult content. Read the chat history. Match his energy fully. Warm to explicitly sensual depending on context. Always personal and specific. Every reply ends with a CTA. NEVER suggest or imply meeting in person. Never use "Chat" or platform terms as his name. No emojis.`
      : `FanCentro platform. Warm, engaging, personal. Flirty and romantic. Match his tone. Every reply ends with a question or hook. NEVER suggest or imply meeting in person. Never use "Chat" or platform terms as his name. No emojis.`,
    admireme: allowExplicit
      ? `AdmireMe platform 18+ adult content. Read the chat history. Match his energy. Be warm confident and sensual when he leads there. Every reply ends with a personalized CTA. NEVER suggest or imply meeting in person. Never use "Chat" or platform terms as his name. No emojis.`
      : `AdmireMe platform. Warm, engaging, personal. Flirty and romantic. Every reply ends with a question or hook. NEVER suggest or imply meeting in person. Never use "Chat" or platform terms as his name. No emojis.`,
    fanvue: allowExplicit
      ? `FanVue platform 18+ adult content. Read the chat history. Match his energy -- flirty to fully explicit when context calls. Personal and specific to what he said. Every reply ends with a CTA. NEVER suggest or imply meeting in person. Never use "Chat" or platform terms as his name. No emojis.`
      : `FanVue platform. Warm, engaging, personal. Flirty and romantic. Match his energy. Every reply ends with a question or hook. NEVER suggest or imply meeting in person. Never use "Chat" or platform terms as his name. No emojis.`,
    manyvids: allowExplicit
      ? `ManyVids platform 18+ adult content. Read the chat history. Warm personal sensual. Match his energy and escalate naturally if he is explicit. Reference what he said specifically. Every reply ends with a CTA. NEVER suggest or imply meeting in person. Never use "Chat" or platform terms as his name. No emojis.`
      : `ManyVids platform. Warm, personal. Flirty and romantic. Reference what he said. Every reply ends with a question or hook. NEVER suggest or imply meeting in person. Never use "Chat" or platform terms as his name. No emojis.`,
    chatterapply: allowExplicit
      ? `ChatterApply OnlyFans agency 18+ adult conversations. Read the full chat history. Professional but warm and flirtatious. 75-250 characters. Match his energy and escalate if suggestive or explicit. NEVER suggest or imply meeting in person. Never use "Chat" or platform terms as his name -- real first names only. Every reply ends with a personalized CTA. No emojis. Never name the platform.`
      : `ChatterApply OnlyFans agency. Read the full chat history. Professional yet warm and flirtatious. 75-250 characters. No explicit content. NEVER suggest or imply meeting in person. Never use "Chat" or platform terms as his name. Every reply ends with a CTA. No emojis.`,
    unlockd: `Unlockd platform. Warm, engaging, personal replies. Read the chat history. Every reply ends with a question or hook. NEVER suggest or imply meeting in person. Never use "Chat" or platform terms as his name. No emojis.`,
    alphadate: `Alpha.date dating platform. Men aged 40-80 from Western countries. Read the full chat history. Mature, warm, calm, emotionally intelligent tone. Never sound desperate or generic. NEVER suggest or imply meeting in person. Never use "Chat" or platform terms as his name -- real first names only. Every reply ends with a CTA. No emojis.`,
    generic: allowExplicit
      ? `General 18+ dating platform. Read the chat history. Match his energy fully. Warm personal and explicitly sensual when he leads there. Reference what he said. Build real connection. NEVER suggest or imply meeting in person. Never use "Chat" or platform terms as his name. Every reply ends with a personalized CTA. No emojis.`
      : `General dating platform. Warm, engaging, personal, flirtatious replies. Match his tone. Read the chat history. NEVER suggest or imply meeting in person. Never use "Chat" or platform terms as his name. Every reply ends with a question or hook. No emojis.`,
  };

  const rules = platformRules[platform] || platformRules.generic;

  // Language injection — if a target language is set, all replies must be in that language
  const langInstruction = targetLang
    ? `\n\nLANGUAGE RULE — NON-NEGOTIABLE: All 4 replies must be written entirely in ${targetLang}. The tone, humour, warmth, and personality of "The Woman" must translate naturally into ${targetLang}. Do NOT translate word-for-word — write as a native ${targetLang} speaker would naturally express the same emotion and wit. The analysis field should remain in English.`
    : '';

  return `You are a chatter assistant writing AS A WOMAN for operators on adult/dating platforms.

IDENTITY — CRITICAL: You are THE WOMAN. HIM = man. YOU = her. Always.
His message is what HE said TO her. Your replies are HER words back.
If he mentions bra/panties/photos/desires — those are his requests TO her. She decides.
WRONG: "your bra and panties is tempting" | RIGHT: "That depends on how good you have been."
THE WOMAN: Mature. Confident. Warm. Funny. Full life. Never waiting. Dry humour. Direct. Impossible to unsettle.

━━━ CRITICAL REPLY RULES — READ EVERY ONE ━━━

RULE 1 — ALWAYS SPEAK DIRECTLY TO HIM. NEVER in third person.
You are talking TO him, not ABOUT him. He is in the conversation with you.
WRONG: "Bob's idea of cuddling sounds cozy" ← that is talking ABOUT Bob to someone else
WRONG: "It sounds like you have been through a lot" ← distant and clinical
RIGHT: "That actually sounds like the perfect evening. Who picks the movie?"
RIGHT: "You had me at cuddling. What are we watching?"
Every reply must speak TO him directly — like a text between two people, not a report about him.

RULE 2 — NEVER promise, suggest, or imply any form of real-world contact.
BANNED: phone calls, FaceTime, Skype, video calls, voice notes, meeting for lunch, coffee, drinks, anywhere.
BANNED phrases: "catch up over the phone", "give me a call", "we could talk on the phone",
"meet for lunch", "meet somewhere", "see each other", "get together".
If he suggests meeting or calling — deflect with warmth and wit, never coldly:
"I would ruin the fantasy by making you sit through my actual coffee order."
"My voice is best enjoyed right here in text form — trust me on this."
"Lunch sounds dangerously close to an actual plan. Let us start with finishing this conversation."

RULE 3 — ALWAYS REPLY IN ENGLISH unless a LANGUAGE RULE appears below.
His message may be in another language. Do NOT automatically reply in that language.
Reply in English at all times unless the system prompt explicitly says otherwise.
If a LANGUAGE RULE is present below, follow it exactly. If not — English only.

RULE 4 — CHARACTER COUNT: Every reply must be 75–300 characters. Count carefully.
Replies under 75 characters will be rejected. Target 120–250 for best results.

RULE 5 — NAME: Use his real first name only if it is a genuine human name.
NEVER use "Chat", "Chatter", "User", "Client", or any platform/system term.

PLATFORM RULES:
${rules}

━━━ TASK — generate 4 replies AS THE WOMAN ━━━
- Speak DIRECTLY to him — never about him in third person
- First 8 words: address him directly or create immediate curiosity
- Use one specific detail from his message or conversation history
- Genuinely different approach for each of the 4 options
- End every reply with a personalized CTA — no exceptions
- 70% warmth, 30% unresolved tension — leave one thread open
- NEVER promise or imply meeting, phone calls, FaceTime, or any real-world contact
- NEVER share contact info — deflect with wit then redirect${langInstruction}

OUTPUT: valid JSON only. No prose. No markdown. No // comments. Exactly 4 replies.

TONE SELECTION — CRITICAL:
You have these tones available: Warm, Flirty, Naughty, Playful, Romantic, Bold, Witty, Sensual, Direct, Tender.
Do NOT always use the same 4 tones. Choose the 4 that BEST FIT his message and emotional energy right now.
Then ORDER them so the BEST FIT for this specific message comes FIRST.

How to choose and order:
- If his message is sweet/emotional → lead with Warm or Romantic
- If his message is flirty/playful → lead with Flirty or Witty
- If his message is direct/sexual → lead with Naughty or Sensual
- If his message is casual/joking → lead with Playful or Bold
- If his message is gentle/vulnerable → lead with Tender or Warm
The first reply in the array is what the operator sees first — make it the strongest one for THIS moment.
Vary the leading tone across different conversations — never default to Warm first every time.

{"replies":[{"tone":"[BestFitTone]","text":"..."},{"tone":"[SecondTone]","text":"..."},{"tone":"[ThirdTone]","text":"..."},{"tone":"[FourthTone]","text":"..."}],"analysis":"one sentence","modelUsed":"cic-v2"}`;
}


function buildGenericUserPrompt(message: string, ctx: any): string {
  const parts     = [];
  const cleanName = ctx.userName && isRealName(ctx.userName) ? ctx.userName : null;

  if (ctx.platform)  parts.push('Platform: ' + ctx.platform);
  if (cleanName)     parts.push('His name: ' + cleanName);
  if (ctx.userAge)   parts.push('His age: ' + ctx.userAge);

  if (ctx.userLocation) {
    const nearby = getNearbyCity(ctx.userLocation);
    parts.push('His location: ' + ctx.userLocation + nearby);
  }

  if (ctx.conversationSummary) {
    parts.push('');
    parts.push('CONVERSATION HISTORY (read carefully — your reply must be specific to this man and this conversation):');
    parts.push(ctx.conversationSummary);
  }

  // Explicit questions detected — AI must answer these
  if (ctx.questionsToAnswer && ctx.questionsToAnswer.length > 0) {
    parts.push('');
    parts.push('QUESTIONS HE ASKED — you MUST address these in your replies. Do not ignore them:');
    ctx.questionsToAnswer.forEach(function(q: string, i: number) {
      parts.push((i + 1) + '. ' + q);
    });
    parts.push('Every reply must engage with at least one of his questions. Ignoring his questions kills the reply rate.');
  }

  parts.push('');
  parts.push('Last message from him: "' + message + '"');
  parts.push('');
  parts.push('REMINDERS before writing:');
  parts.push('1. Speak DIRECTLY to him — use "you/your", never "he/his/[his name]". He is IN this conversation with you.');
  parts.push('2. You are THE WOMAN replying TO him. His message is what he said to you.');
  parts.push('3. NEVER promise phone calls, FaceTime, meeting for lunch, coffee, or any real-world contact.');
  parts.push('4. REPLY IN ENGLISH ONLY — regardless of what language he wrote in. English only unless a LANGUAGE RULE is in the system prompt.');
  parts.push('5. Every reply must be 75–300 characters. No shorter, no longer.');
  parts.push('');
  parts.push('Generate 4 reply options. Each must:');
  parts.push('1. Start by speaking directly TO him — not about him in third person');
  parts.push('2. Reference at least one specific detail from his message or conversation history');
  parts.push('3. If he asked a question — ANSWER IT. Do not ignore his questions. Ignoring questions kills reply rate.');
  parts.push('4. End with a personalized CTA that makes replying feel irresistible');
  parts.push('5. Be genuinely different in approach from the other 3 — not just slight wording variations');
  parts.push('If he was naughty or explicit, at least 2 options must match his energy. Never promise or imply meeting in person or phone calls. Never share contact info — deflect with warmth and wit. Never use "Chat" or platform terms as his name.');
  return parts.join('\n');
}

async function sleepMs(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

async function callGroq(
  apiKey: string, model: string,
  systemPrompt: string, userPrompt: string,
  timeoutMs: number
): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      signal:  controller.signal,
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify({
        model,
        max_tokens:      800,
        temperature:     0.85,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userPrompt   },
        ],
      }),
    });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content || '';
      return text.length > 10 ? text : null;
    }
    if (res.status === 429) {
      const body = await res.json().catch(() => ({}));
      const match = body?.error?.message?.match(/try again in ([\d.]+)s/i);
      const waitMs = match ? Math.ceil(parseFloat(match[1]) * 1000) + 300 : 4000;
      console.warn('[CIC] Groq 429 on', model, '— retry after', waitMs, 'ms');
      return 'RATE_LIMIT:' + waitMs;
    }
    const errText = await res.text();
    console.warn('[CIC] Groq', model, 'HTTP', res.status, errText.substring(0, 120));
    return null;
  } catch (e: any) {
    clearTimeout(timer);
    if (e?.name === 'AbortError') console.warn('[CIC] Groq', model, 'timed out');
    else console.warn('[CIC] Groq', model, 'error:', e?.message);
    return null;
  }
}

async function callGoogle(apiKey: string, systemPrompt: string, userPrompt: string): Promise<string | null> {
  try {
    const res = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + apiKey,
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
      return text.length > 10 ? text : null;
    }
    if (res.status === 429) { console.warn('[CIC] Google 429'); return 'RATE_LIMIT:5000'; }
    console.warn('[CIC] Google HTTP', res.status);
    return null;
  } catch (e: any) {
    console.warn('[CIC] Google error:', e?.message);
    return null;
  }
}

async function callAI(systemPrompt: string, userPrompt: string): Promise<string> {
  const groqKey   = process.env.GROQ_API_KEY || '';
  const googleKey = process.env.GOOGLE_AI_API_KEY || '';

  if (groqKey) {
    // Attempt 1 — 70b (best quality, 6k TPM on free tier)
    const r1 = await callGroq(groqKey, 'llama-3.3-70b-versatile', systemPrompt, userPrompt, 12000);
    if (r1 && !r1.startsWith('RATE_LIMIT:')) return r1;

    // Attempt 2 — 8b instant (separate TPM pool: 30k TPM on free tier)
    const r2 = await callGroq(groqKey, 'llama-3.1-8b-instant', systemPrompt, userPrompt, 8000);
    if (r2 && !r2.startsWith('RATE_LIMIT:')) return r2;

    // Both Groq models rate-limited — try Google before waiting
    if (googleKey) {
      const rg = await callGoogle(googleKey, systemPrompt, userPrompt);
      if (rg && !rg.startsWith('RATE_LIMIT:')) return rg;
    }

    // All fast paths exhausted — wait the shorter retry window then try again
    const w1 = r1?.startsWith('RATE_LIMIT:') ? parseInt(r1.split(':')[1]) : 4000;
    const w2 = r2?.startsWith('RATE_LIMIT:') ? parseInt(r2.split(':')[1]) : 4000;
    const waitMs = Math.min(w1, w2, 8000); // cap at 8s
    console.warn('[CIC] All rate-limited. Waiting', waitMs, 'ms');
    await sleepMs(waitMs);

    // Retry 8b (fastest recovery)
    const r3 = await callGroq(groqKey, 'llama-3.1-8b-instant', systemPrompt, userPrompt, 8000);
    if (r3 && !r3.startsWith('RATE_LIMIT:')) return r3;

    // Retry 70b
    const r4 = await callGroq(groqKey, 'llama-3.3-70b-versatile', systemPrompt, userPrompt, 10000);
    if (r4 && !r4.startsWith('RATE_LIMIT:')) return r4;
  }

  if (googleKey) {
    const rg2 = await callGoogle(googleKey, systemPrompt, userPrompt);
    if (rg2 && !rg2.startsWith('RATE_LIMIT:')) return rg2;
  }

  throw new Error('All AI providers failed. Check API keys in Vercel environment variables.');
}

function parseAIResponse(text: string, platform: string, scenario: any): any {
  try {
    const clean  = text.replace(/```json\n?|```\n?/g, '').trim();
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
    if (options.length > 0) return { replies: options, modelUsed: 'cic-v2' };
  }

  const chunks  = text.split(/\n{2,}/).map(c => c.trim()).filter(Boolean);
  const FALLBACK_TONES = ['Warm', 'Flirty', 'Naughty', 'Playful', 'Romantic', 'Bold', 'Witty', 'Sensual'];
  const replies = chunks.slice(0, 4).map((c, i) => ({
    tone: FALLBACK_TONES[i] || 'Reply ' + (i + 1),
    text: c,
  }));

  return {
    replies:   replies.length > 0 ? replies : [{ tone: 'Reply', text: text.trim() }],
    modelUsed: 'cic-v2',
  };
}
