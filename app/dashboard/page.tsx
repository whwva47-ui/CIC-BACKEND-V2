'use client'
import { useState, useRef, useEffect } from 'react'

const BACKEND = 'https://chattersinnercircle.vercel.app'
const EXT_TF  = 'https://chromewebstore.google.com/detail/cic-texting-factory/dkgpheiimhedhdfandcgeogmbfmmiobp'
const EXT_GEN = 'https://chromewebstore.google.com/detail/cic-general-cic/dkgpheiimhedhdfandcgeogmbfmmiobp'
const LANDING = '/landing'

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500&display=swap');
:root{
  --bg:#06060E;--bg2:#0A0A16;--bg3:#0F0F20;--bg4:#141428;
  --card:#0D0D1E;--glass:rgba(13,13,30,0.75);
  --bd:rgba(139,92,246,0.12);--bd2:rgba(212,163,0,0.18);--bd3:rgba(139,92,246,0.25);
  --p:#7C3AED;--pl:#A855F7;--pll:#C4B5FD;
  --g:#D4A300;--gl:#F5D98A;--gll:#FEF3C7;
  --t1:#EDE9FE;--t2:#A78BFA;--t3:#4A4870;--t4:#2A2848;
  --ok:#34D399;--err:#F87171;--warn:#FBD96A;
  --serif:'Cinzel',serif;--sans:'DM Sans',sans-serif;
  --r:10px;--rl:16px;--rxl:20px;
  --sh:0 8px 40px rgba(0,0,0,0.6);
  --sh-p:0 4px 24px rgba(124,58,237,0.25);
  --sh-g:0 4px 24px rgba(212,163,0,0.2);
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;overflow:hidden}
body{font-family:var(--sans);background:var(--bg);color:var(--t1);-webkit-font-smoothing:antialiased}

/* Grain */
body::before{content:'';position:fixed;inset:0;
  background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E");
  pointer-events:none;z-index:0;opacity:0.5}

/* Orbs */
.orb{position:fixed;border-radius:50%;pointer-events:none;z-index:0;filter:blur(100px)}
.orb1{width:700px;height:700px;background:var(--p);opacity:0.055;top:-300px;right:-200px}
.orb2{width:550px;height:550px;background:var(--g);opacity:0.045;bottom:-250px;left:-200px}
.orb3{width:300px;height:300px;background:var(--pl);opacity:0.035;top:40%;left:40%}

/* LAYOUT */
.workspace{position:relative;z-index:1;display:grid;grid-template-columns:220px 1fr;grid-template-rows:52px 1fr;height:100vh;overflow:hidden}

/* TOPBAR */
.topbar{grid-column:1/-1;background:rgba(6,6,14,0.96);backdrop-filter:blur(20px);border-bottom:1px solid var(--bd);display:flex;align-items:center;padding:0 20px;gap:16px;z-index:20}
.topbar-brand{font-family:var(--serif);font-size:15px;font-weight:700;background:linear-gradient(135deg,var(--pl),var(--gl));-webkit-background-clip:text;-webkit-text-fill-color:transparent;letter-spacing:0.04em;white-space:nowrap}
.topbar-sep{width:1px;height:28px;background:var(--bd3);flex-shrink:0}
.topbar-status{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--t3)}
.status-dot{width:6px;height:6px;border-radius:50%;animation:pulse 2s infinite}
.status-dot.ok{background:var(--ok)}
.status-dot.warn{background:var(--warn)}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
.topbar-right{margin-left:auto;display:flex;align-items:center;gap:10px}
.plan-badge{padding:3px 12px;border-radius:20px;font-size:10px;font-weight:700;border:1px solid rgba(212,163,0,0.3);background:rgba(212,163,0,0.1);color:var(--gl)}

/* SIDEBAR */
.sidebar{background:rgba(8,8,18,0.98);backdrop-filter:blur(20px);border-right:1px solid var(--bd);display:flex;flex-direction:column;overflow-y:auto;overflow-x:hidden}
.sb-section{font-size:9px;font-weight:700;color:var(--t3);letter-spacing:0.12em;text-transform:uppercase;padding:16px 16px 6px}
.sb-item{display:flex;align-items:center;gap:10px;padding:9px 16px;font-size:12.5px;color:var(--t2);cursor:pointer;border-left:2px solid transparent;transition:all 0.15s;user-select:none;position:relative}
.sb-item:hover{color:var(--t1);background:rgba(124,58,237,0.06)}
.sb-item.active{color:var(--gl);background:rgba(212,163,0,0.06);border-left-color:var(--g)}
.sb-item.locked{color:var(--t3);cursor:not-allowed}
.sb-icon{width:16px;text-align:center;font-size:13px;flex-shrink:0}
.sb-badge{margin-left:auto;font-size:9px;font-weight:700;padding:2px 7px;border-radius:10px}
.sb-badge.pro{background:rgba(212,163,0,0.15);color:var(--gl);border:1px solid rgba(212,163,0,0.25)}
.sb-badge.new{background:rgba(52,211,153,0.12);color:var(--ok);border:1px solid rgba(52,211,153,0.25)}
.sb-bottom{margin-top:auto;padding:12px 16px;border-top:1px solid var(--bd)}

/* MAIN */
.main{overflow-y:auto;overflow-x:hidden;background:var(--bg);position:relative}

/* FLOATING WINDOW */
.float-win{position:absolute;top:24px;left:24px;right:24px;bottom:24px;background:var(--glass);backdrop-filter:blur(24px);border:1px solid var(--bd3);border-radius:var(--rxl);box-shadow:var(--sh);display:flex;flex-direction:column;overflow:hidden}
.win-titlebar{display:flex;align-items:center;gap:10px;padding:14px 20px;border-bottom:1px solid var(--bd);background:rgba(0,0,0,0.25);flex-shrink:0}
.win-dots{display:flex;gap:6px}
.win-dot{width:10px;height:10px;border-radius:50%}
.win-title{font-family:var(--serif);font-size:13px;font-weight:600;color:var(--t2);margin-left:4px}
.win-tag{margin-left:auto;font-size:10px;color:var(--t3);padding:2px 10px;border:1px solid var(--bd);border-radius:20px}
.win-body{flex:1;overflow-y:auto;overflow-x:hidden;padding:24px}

/* POPUP SIMULATOR */
.popup-frame{width:340px;background:rgba(10,10,22,0.98);border:1px solid var(--bd3);border-radius:14px;box-shadow:0 20px 60px rgba(0,0,0,0.8);overflow:hidden;margin:0 auto}
.popup-head{background:linear-gradient(135deg,rgba(124,58,237,0.3),rgba(212,163,0,0.15));padding:16px 18px;border-bottom:1px solid var(--bd)}
.popup-brand{font-family:var(--serif);font-size:14px;font-weight:700;background:linear-gradient(135deg,var(--pll),var(--gl));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.popup-body{padding:18px}

/* CHAT SIMULATION */
.chat-area{background:rgba(0,0,0,0.3);border:1px solid var(--bd);border-radius:var(--r);padding:14px;min-height:180px;margin-bottom:14px}
.chat-msg{display:flex;gap:8px;margin-bottom:10px;align-items:flex-end}
.chat-msg.out{flex-direction:row-reverse}
.chat-avatar{width:26px;height:26px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:10px}
.chat-bubble{max-width:75%;padding:8px 12px;border-radius:14px;font-size:12.5px;line-height:1.55}
.chat-bubble.in{background:rgba(255,255,255,0.06);border:1px solid var(--bd);border-bottom-left-radius:3px;color:var(--t2)}
.chat-bubble.out{background:linear-gradient(135deg,rgba(124,58,237,0.3),rgba(168,85,247,0.2));border:1px solid rgba(124,58,237,0.3);border-bottom-right-radius:3px;color:var(--t1)}
.typing-ind{display:flex;gap:3px;padding:8px 12px;background:rgba(255,255,255,0.04);border:1px solid var(--bd);border-radius:14px;width:fit-content}
.typing-ind span{width:5px;height:5px;border-radius:50%;background:var(--t3);animation:typingdot 1.2s infinite}
.typing-ind span:nth-child(2){animation-delay:0.2s}
.typing-ind span:nth-child(3){animation-delay:0.4s}
@keyframes typingdot{0%,60%,100%{opacity:0.3;transform:translateY(0)}30%{opacity:1;transform:translateY(-3px)}}
.cursor-blink{display:inline-block;width:2px;height:13px;background:var(--pl);animation:blink 1s step-end infinite;vertical-align:middle;margin-left:1px}
@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}

/* REPLY CARDS */
.reply-card{background:rgba(255,255,255,0.03);border:1px solid var(--bd);border-radius:var(--r);padding:12px 14px;margin-bottom:8px;cursor:pointer;transition:all 0.15s;position:relative}
.reply-card:hover{border-color:var(--g);background:rgba(212,163,0,0.04)}
.reply-card.selected{border-color:var(--g);background:rgba(212,163,0,0.06)}
.reply-card.selected::after{content:'Selected';position:absolute;top:8px;right:10px;font-size:9px;font-weight:700;color:var(--gl)}
.reply-tone{font-size:9px;font-weight:700;color:var(--gl);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:5px}
.reply-text{font-size:12px;color:var(--t1);line-height:1.6}

/* CONTROLS */
.ctrl-row{display:flex;gap:8px;flex-wrap:wrap}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:9px 18px;border-radius:var(--r);font-family:var(--sans);font-size:12.5px;font-weight:600;cursor:pointer;border:none;transition:all 0.18s;white-space:nowrap}
.btn-primary{background:linear-gradient(135deg,var(--p),var(--pl));color:#fff;box-shadow:var(--sh-p)}
.btn-primary:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 6px 28px rgba(124,58,237,0.4)}
.btn-gold{background:linear-gradient(135deg,var(--g),var(--gl));color:#0a0a1a;box-shadow:var(--sh-g)}
.btn-gold:hover:not(:disabled){transform:translateY(-1px)}
.btn-ghost{background:rgba(124,58,237,0.08);color:var(--pll);border:1px solid var(--bd3)}
.btn-ghost:hover{background:rgba(124,58,237,0.15)}
.btn-danger{background:rgba(248,113,113,0.1);color:var(--err);border:1px solid rgba(248,113,113,0.25)}
.btn-sm{padding:6px 12px;font-size:11.5px}
.btn-xs{padding:4px 9px;font-size:10.5px;border-radius:7px}
.btn-full{width:100%}
.btn:disabled{opacity:0.38;cursor:not-allowed;transform:none !important}
.btn-muted{background:rgba(255,255,255,0.03);color:var(--t3);border:1px solid var(--bd);cursor:not-allowed}

/* INPUTS */
.lbl{display:block;font-size:10px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:5px}
.inp{width:100%;padding:10px 13px;background:rgba(0,0,0,0.35);border:1px solid var(--bd);border-radius:var(--r);color:var(--t1);font-size:13px;font-family:var(--sans);outline:none;transition:border-color 0.2s}
.inp:focus{border-color:var(--pl)}
.inp::placeholder{color:var(--t3)}
.inp:read-only{opacity:0.5;cursor:not-allowed}
textarea.inp{resize:none;line-height:1.6}
select.inp{cursor:pointer;appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 5 5-5z' fill='%234A4870'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center}

/* CARDS */
.card{background:rgba(13,13,30,0.8);border:1px solid var(--bd);border-radius:var(--rl);padding:20px}
.card-gold{border-color:var(--bd2)}
.card-glow{border-color:var(--bd3);box-shadow:0 0 30px rgba(124,58,237,0.08)}

/* GRID */
.g2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}

/* INSTALL CENTER */
.ext-card{background:rgba(13,13,30,0.9);border:1px solid var(--bd);border-radius:var(--rl);padding:20px;display:flex;flex-direction:column;gap:12px}
.ext-card:hover{border-color:var(--bd3)}
.ext-icon{width:48px;height:48px;border-radius:12px;background:linear-gradient(135deg,var(--p),var(--g));display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0}
.ext-name{font-family:var(--serif);font-size:14px;font-weight:600;color:var(--t1)}
.ext-ver{font-size:10px;color:var(--t3)}
.ext-desc{font-size:12px;color:var(--t3);line-height:1.65}
.feature-row{display:flex;gap:7px;font-size:11.5px;color:var(--t3);line-height:1.5}

/* TYPING SIM */
.typing-window{background:rgba(0,0,0,0.4);border:1px solid var(--bd);border-radius:var(--r);padding:16px;font-size:13px;color:var(--t1);line-height:1.7;min-height:80px;position:relative}
.wpm-slider{width:100%;accent-color:var(--g);cursor:pointer}

/* STATS */
.stat-box{background:rgba(13,13,30,0.8);border:1px solid var(--bd);border-radius:var(--rl);padding:18px;text-align:center}
.stat-num{font-family:var(--serif);font-size:26px;font-weight:700;margin-bottom:4px}
.stat-num.p{background:linear-gradient(135deg,var(--pl),var(--pll));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.stat-num.g{background:linear-gradient(135deg,var(--g),var(--gl));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.stat-num.ok{color:var(--ok)}
.stat-lbl{font-size:11px;color:var(--t3)}
.prog{height:3px;background:rgba(255,255,255,0.05);border-radius:2px;margin-top:8px;overflow:hidden}
.prog-fill{height:100%;border-radius:2px;background:linear-gradient(90deg,var(--p),var(--g))}

/* GUIDE TABS */
.guide-tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px}
.guide-tab{padding:6px 14px;border-radius:20px;font-size:11.5px;font-weight:600;cursor:pointer;border:1px solid var(--bd);background:transparent;color:var(--t3);font-family:var(--sans);transition:all 0.15s}
.guide-tab:hover{color:var(--t1);border-color:var(--pl)}
.guide-tab.active{background:rgba(124,58,237,0.12);color:var(--pll);border-color:var(--bd3)}
.ex-box{background:rgba(0,0,0,0.3);border-radius:var(--r);padding:11px 14px;margin-bottom:8px}
.ex-lbl{font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:5px}
.ex-txt{font-size:12px;font-style:italic;color:var(--t2);line-height:1.6}

/* QA */
.qa-item{border:1px solid var(--bd);border-radius:var(--r);margin-bottom:8px;overflow:hidden}
.qa-q{padding:12px 14px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;font-size:12.5px;font-weight:500;color:var(--t1);transition:background 0.15s;user-select:none}
.qa-q:hover{background:rgba(124,58,237,0.05)}
.qa-q.open{background:rgba(124,58,237,0.08);color:var(--pll)}
.qa-a{display:none;padding:0 14px 12px;font-size:12px;color:var(--t3);line-height:1.7;border-top:1px solid var(--bd)}
.qa-a.open{display:block}

/* SPINNER */
.spin{width:14px;height:14px;border:2px solid rgba(255,255,255,0.15);border-top-color:#fff;border-radius:50%;animation:spin 0.7s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}

/* SCROLLBAR */
::-webkit-scrollbar{width:3px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:rgba(124,58,237,0.3);border-radius:2px}
`

type Section = 'demo' | 'chat-agent' | 'reactivation' | 'typing' | 'photo' | 'alphadate-guide' | 'tf-guide' | 'qa' | 'extensions' | 'install' | 'analytics' | 'billing'

const DEMO_REPLIES = [
  { tone:'Warm', text:"Careful flirting with me this confidently -- most people work up to it slowly. There is something refreshing about someone who just says what they mean. What are you like when you are not trying to impress anyone?" },
  { tone:'Playful', text:"Is that how you open every conversation, or did you save that one especially for me? Either way it worked, and I am genuinely curious what comes next from you." },
  { tone:'Mysterious', text:"There is a version of tonight I had already planned in my head, and then you said that and it changed completely. Tell me something about yourself that would actually surprise me." },
  { tone:'Deep', text:"You know what I find rare? Someone who can be playful and mean it at the same time. Most people are one or the other. What is it about you that makes you so comfortable being both?" },
]

const REACTIVATION_MSGS = [
  { tone:'Warm re-engage', text:"SOMETHING MADE ME THINK OF YOU TODAY -- not in a general way, in a specific one. The kind that makes you wonder what someone is actually up to. What has your week looked like?" },
  { tone:'Curious pull-back', text:"MOST PEOPLE WHO GO QUIET EVENTUALLY COME BACK and I have a feeling you are one of those people. I am not asking why you disappeared -- I am asking what would make you stay this time." },
  { tone:'Playful challenge', text:"I GAVE YOU A WEEK AND YOU STILL HAVE NOT CONVINCED ME you are as interesting as I thought. Last chance -- say something that proves me wrong." },
]

const QA = [
  { q: 'How does the typing simulator work?', a: 'The extension types each character with a randomised delay between 40-200ms, plus natural pauses at spaces, commas, and full stops -- exactly mimicking how a real person types. It is completely undetectable by any platform.' },
  { q: 'What platforms does CIC work on?', a: 'Alpha.date, Texting Factory, OnlyFans, Fansly, LoyalFans, FanCentro, AdmireMe, FanVue, ManyVids, Unlockd, ChatterApply.com. The General CIC extension also works on any website when triggered manually.' },
  { q: 'Can I use it on more than one machine?', a: 'By default one active session per account. If you log in on a second machine the first is automatically logged out. Contact admin to enable multi-device access for your account.' },
  { q: 'What is the difference between Free Trial, Basic, and Pro?', a: 'Free Trial (7 days): days 1-3 full Pro access, days 4-7 limited to 20 replies/day. Basic ($8/month): 50 replies/day, no explicit content. Pro ($15/month): unlimited replies, full explicit content, premium AI model.' },
  { q: 'How do I pay?', a: 'Click Upgrade inside the extension. Choose your payment method. Admin contacts you within minutes with payment details. We accept M-Pesa, Visa, Mastercard, PayPal, USDT, BTC, ETH, and bank transfer. Available in every country.' },
  { q: 'What is the Alpha.date category system?', a: 'Three modes: Category 1 -- first outreach, winks, likes, letters, /chance page. Category 2 -- replying to active or silent conversations, one sentence 15-25 words. Category 3 -- bulk sender with emojis. Wrong category is the most common new operator mistake.' },
  { q: 'Why does the extension say "Extension context invalidated"?', a: 'This happens when Chrome updates the extension while you are mid-session. Refresh the page and the extension reconnects automatically.' },
  { q: 'How does General CIC work on any website?', a: 'On non-partner sites the extension adds a floating trigger button. Click it and a mini panel opens. Type or paste the message you want to reply to, choose a tone, and CIC generates a reply. You can then have it type the reply into any focused text field on the page.' },
]

export default function Dashboard() {
  const [section, setSection] = useState<Section>('demo')
  const [openQA, setOpenQA]   = useState<number|null>(null)
  const [guideTab, setGuideTab] = useState('cat1')

  // Demo state
  const [demoStep, setDemoStep] = useState<'idle'|'scanning'|'generating'|'replies'|'typing'|'done'>('idle')
  const [selectedReply, setSelectedReply] = useState<number|null>(null)
  const [typedText, setTypedText]         = useState('')
  const [isTyping, setIsTyping]           = useState(false)
  const [demoInput, setDemoInput]         = useState('Hey babe are you free later tonight?')

  // Chat agent
  const [caMsg, setCaMsg]     = useState('')
  const [caTone, setCaTone]   = useState('Warm and genuine')
  const [caPlat, setCaPlat]   = useState('alphadate')
  const [caReplies, setCaReplies] = useState<typeof DEMO_REPLIES>([])
  const [caLoading, setCaLoading] = useState(false)
  const [caCopied, setCaCopied]   = useState<number|null>(null)
  const [savedReplies, setSavedReplies] = useState<Array<{text:string,tone:string}>>([])

  // Reactivation
  const [reMsg, setReMsg]     = useState('')
  const [reLoading, setReLoading] = useState(false)
  const [reReplies, setReReplies] = useState<typeof REACTIVATION_MSGS>([])

  // Typing sim
  const [simInput, setSimInput] = useState('Something about the way you said that made me stop. I feel like there is a whole story behind those words.')
  const [simWPM, setSimWPM]     = useState(65)
  const [simText, setSimText]   = useState('')
  const [simRunning, setSimRunning] = useState(false)
  const [simChars, setSimChars]     = useState(0)
  const [simTime, setSimTime]       = useState('0.0s')
  const [simView, setSimView]       = useState<'live'|'video'>('live')

  // Photo
  const [photo, setPhoto]           = useState<string|null>(null)
  const [photoResults, setPhotoResults] = useState<string[]>([])
  const [photoLoading, setPhotoLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

  // --- DEMO SIMULATION ---
  async function runDemo() {
    setDemoStep('scanning'); setSelectedReply(null); setTypedText(''); setIsTyping(false)
    await sleep(1200)
    setDemoStep('generating')
    await sleep(1600)
    setDemoStep('replies')
  }

  async function typeReply(idx: number) {
    setSelectedReply(idx)
    setDemoStep('typing')
    const text = DEMO_REPLIES[idx].text
    setTypedText(''); setIsTyping(true)
    for (let i = 0; i < text.length; i++) {
      await sleep(30 + Math.random() * 80 + (text[i] === ' ' ? 30 : 0) + (text[i] === '.' ? 80 : 0))
      setTypedText(text.slice(0, i + 1))
    }
    setIsTyping(false)
    setDemoStep('done')
  }

  // --- CHAT AGENT ---
  async function generateReplies() {
    if (!caMsg.trim()) return
    setCaLoading(true); setCaReplies([])
    await sleep(1400 + Math.random() * 600)
    setCaReplies(DEMO_REPLIES)
    setCaLoading(false)
  }

  function saveReply(text: string, tone: string) {
    if (savedReplies.find(r => r.text === text)) return
    setSavedReplies(prev => [...prev, { text, tone }])
  }

  function copyReply(text: string, idx: number) {
    navigator.clipboard.writeText(text)
    setCaCopied(idx)
    setTimeout(() => setCaCopied(null), 1500)
  }

  // --- REACTIVATION ---
  async function generateReactivation() {
    if (!reMsg.trim()) return
    setReLoading(true); setReReplies([])
    await sleep(1600)
    setReReplies(REACTIVATION_MSGS)
    setReLoading(false)
  }

  // --- TYPING SIM ---
  async function startSim() {
    const text = simInput.trim()
    if (!text || simRunning) return
    setSimRunning(true); setSimText(''); setSimChars(0); setSimTime('0.0s')
    const t0 = Date.now()
    const msPerChar = Math.round(60000 / simWPM / 5)
    const timer = setInterval(() => setSimTime(((Date.now()-t0)/1000).toFixed(1)+'s'), 100)
    for (let i = 0; i < text.length; i++) {
      await sleep(msPerChar * (0.4 + Math.random() * 1.6) +
        (text[i] === ' ' ? Math.random()*50 : 0) +
        ('.,!?'.includes(text[i]) ? Math.random()*100 : 0))
      setSimText(text.slice(0, i+1))
      setSimChars(i+1)
    }
    clearInterval(timer)
    setSimRunning(false)
  }

  // --- PHOTO ---
  function handlePhoto(file: File) {
    const r = new FileReader()
    r.onload = e => { setPhoto(e.target?.result as string); setPhotoResults([]) }
    r.readAsDataURL(file)
  }

  async function genPhotoCompliments() {
    setPhotoLoading(true)
    await sleep(1800)
    setPhotoResults([
      "There is something in how you carry yourself in that photo -- it is not posed, it is just you, and that is actually the rarest thing. Most people forget to be themselves the moment a camera appears. What were you thinking when this was taken?",
      "I have looked at this photo twice now and both times I noticed something different. The first time it was the confidence. The second time it was something quieter behind it. What is the version of you that most people never get to see?",
      "You have one of those faces that tells a story without saying anything. There is warmth there but also something private, like you have decided what you share and what you keep. What would actually surprise me about you?",
    ])
    setPhotoLoading(false)
  }

  const NAV = [
    { id:'demo',          icon:'◈', label:'Live Demo',        section:'Main' },
    { id:'chat-agent',    icon:'🤖', label:'Chat Agent',       section:'Main' },
    { id:'reactivation',  icon:'⚡', label:'Reactivation',     section:'Main' },
    { id:'typing',        icon:'⌨', label:'Typing Simulator', section:'Tools' },
    { id:'photo',         icon:'📸', label:'Photo Compliments',section:'Tools' },
    { id:'alphadate-guide',icon:'🌐',label:'Alpha.date Guide', section:'Learn' },
    { id:'tf-guide',      icon:'💬', label:'TF Guide',         section:'Learn' },
    { id:'qa',            icon:'❓', label:'Q & A',            section:'Learn' },
    { id:'extensions',    icon:'🔌', label:'Extensions',       section:'Downloads' },
    { id:'install',       icon:'📦', label:'Install Guide',    section:'Downloads' },
    { id:'analytics',     icon:'📊', label:'Analytics',        section:'Account', badge:''},
    { id:'billing',       icon:'💳', label:'Billing',          section:'Account', badge:''},
  ]

  const sections = [...new Set(NAV.map(n => n.section))]

  return (
    <>
      <style>{CSS}</style>
      <div className="orb orb1"/><div className="orb orb2"/><div className="orb orb3"/>

      <div className="workspace">
        {/* TOPBAR */}
        <header className="topbar">
          <div className="topbar-brand">Chatter's Inner Circle</div>
          <div className="topbar-sep"/>
          <div className="topbar-status">
            <div className="status-dot ok"/>
            <span>AI Active</span>
          </div>
          <div className="topbar-sep"/>
          <div className="topbar-status">
            <div className="status-dot ok"/>
            <span>Extension Connected</span>
          </div>
          <div className="topbar-right">
            <div className="plan-badge">👑 Pro</div>
            <button className="btn btn-ghost btn-sm" onClick={() => setSection('billing')}>Upgrade</button>
            <a href={LANDING} className="btn btn-primary btn-sm" style={{textDecoration:'none'}}>+ New Operator</a>
          </div>
        </header>

        {/* SIDEBAR */}
        <nav className="sidebar">
          {sections.map(sec => (
            <div key={sec}>
              <div className="sb-section">{sec}</div>
              {NAV.filter(n => n.section === sec).map(item => (
                <div key={item.id}
                  className={`sb-item ${section === item.id ? 'active' : ''}`}
                  onClick={() => setSection(item.id as Section)}>
                  <span className="sb-icon">{item.icon}</span>
                  <span>{item.label}</span>
                  {item.badge === 'pro' && <span className="sb-badge pro">PRO</span>}
                  {item.badge === 'new' && <span className="sb-badge new">NEW</span>}
                  {item.id === 'chat-agent' && savedReplies.length > 0 &&
                    <span className="sb-badge pro">{savedReplies.length}</span>}
                </div>
              ))}
            </div>
          ))}
          <div className="sb-bottom">
            <div style={{fontSize:10,color:'var(--t3)',marginBottom:6}}>Extension v1.5.1</div>
            <a href="mailto:whwva47@gmail.com" style={{fontSize:11,color:'var(--t3)',textDecoration:'none'}}>whwva47@gmail.com</a>
          </div>
        </nav>

        {/* MAIN */}
        <main className="main">

          {/* ═══ LIVE DEMO ═══ */}
          {section === 'demo' && (
            <div className="float-win">
              <div className="win-titlebar">
                <div className="win-dots">
                  <div className="win-dot" style={{background:'#FF5F57'}}/>
                  <div className="win-dot" style={{background:'#FEBC2E'}}/>
                  <div className="win-dot" style={{background:'#28C840'}}/>
                </div>
                <div className="win-title">Extension Live Demo</div>
                <div className="win-tag">Simulated Operator Workflow</div>
              </div>
              <div className="win-body">
                <div className="g2" style={{gap:20}}>
                  {/* Left: Platform chat + popup */}
                  <div>
                    <div style={{fontSize:11,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:10,fontWeight:700}}>Platform Chat Window</div>
                    <div className="chat-area" style={{marginBottom:14}}>
                      {/* His message */}
                      <div className="chat-msg">
                        <div className="chat-avatar" style={{background:'var(--bg4)',color:'var(--t3)'}}>👤</div>
                        <div className="chat-bubble in">{demoInput}</div>
                      </div>
                      {/* Her reply */}
                      {(demoStep === 'typing' || demoStep === 'done') && (
                        <div className="chat-msg out">
                          <div className="chat-bubble out">
                            {typedText}
                            {isTyping && <span className="cursor-blink"/>}
                          </div>
                          <div className="chat-avatar" style={{background:'linear-gradient(135deg,var(--p),var(--g))'}}>CIC</div>
                        </div>
                      )}
                      {demoStep === 'typing' && !typedText && (
                        <div className="chat-msg out" style={{justifyContent:'flex-end'}}>
                          <div className="typing-ind"><span/><span/><span/></div>
                        </div>
                      )}
                    </div>
                    <div style={{marginBottom:12}}>
                      <label className="lbl">His message</label>
                      <input className="inp" value={demoInput} onChange={e=>setDemoInput(e.target.value)} placeholder="Type his message here..."/>
                    </div>
                    <div className="ctrl-row">
                      <button className="btn btn-primary" onClick={runDemo} disabled={demoStep==='scanning'||demoStep==='generating'}>
                        {demoStep==='scanning'?<><span className="spin"/> Scanning...</>:
                         demoStep==='generating'?<><span className="spin"/> Generating...</>:
                         '✨ Generate Replies'}
                      </button>
                      {demoStep==='done' && <button className="btn btn-ghost btn-sm" onClick={()=>{setDemoStep('idle');setTypedText('');setSelectedReply(null)}}>↺ Reset</button>}
                    </div>
                  </div>

                  {/* Right: Popup simulator */}
                  <div>
                    <div style={{fontSize:11,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:10,fontWeight:700}}>CIC Extension Popup</div>
                    <div className="popup-frame">
                      <div className="popup-head">
                        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                          <div style={{width:22,height:22,background:'linear-gradient(135deg,var(--p),var(--g))',borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11}}>💬</div>
                          <div className="popup-brand">CIC Assistant</div>
                          <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:5,fontSize:10,color:'var(--ok)'}}>
                            <div style={{width:5,height:5,borderRadius:'50%',background:'var(--ok)'}}/>AI Active
                          </div>
                        </div>
                        {demoStep==='idle' && <div style={{fontSize:11,color:'var(--t3)'}}>Ready. Enter a message or scan the chat.</div>}
                        {demoStep==='scanning' && <div style={{fontSize:11,color:'var(--warn)'}}>Scanning chat window...</div>}
                        {demoStep==='generating' && <div style={{fontSize:11,color:'var(--pl)'}}>Generating replies...</div>}
                        {(demoStep==='replies'||demoStep==='typing'||demoStep==='done') && <div style={{fontSize:11,color:'var(--ok)'}}>4 replies ready -- click one to type it</div>}
                      </div>
                      <div className="popup-body">
                        {(demoStep==='idle'||demoStep==='scanning'||demoStep==='generating') && (
                          <div>
                            <div style={{marginBottom:10}}>
                              <div className="lbl">Detected message</div>
                              <div style={{background:'rgba(0,0,0,0.3)',border:'1px solid var(--bd)',borderRadius:8,padding:'8px 11px',fontSize:12,color:demoStep==='idle'?'var(--t3)':'var(--t1)',fontStyle:demoStep==='idle'?'italic':'normal',minHeight:42}}>
                                {demoStep==='idle'?'Waiting for scan...':demoInput}
                              </div>
                            </div>
                            <button className={`btn btn-full btn-sm ${demoStep!=='idle'?'btn-muted':''}`} disabled={demoStep!=='idle'}>
                              {demoStep==='scanning'?'Scanning...':demoStep==='generating'?'Generating...':'Scan Page'}
                            </button>
                          </div>
                        )}
                        {(demoStep==='replies'||demoStep==='typing'||demoStep==='done') && (
                          <div>
                            {DEMO_REPLIES.map((r, i) => (
                              <div key={i}
                                className={`reply-card ${selectedReply===i?'selected':''}`}
                                onClick={()=>demoStep==='replies'?typeReply(i):undefined}
                                style={{cursor:demoStep==='replies'?'pointer':'default'}}>
                                <div className="reply-tone">{r.tone}</div>
                                <div className="reply-text">{r.text.slice(0,60)}...</div>
                              </div>
                            ))}
                            <div className="ctrl-row" style={{marginTop:10}}>
                              <button className={`btn btn-full btn-sm ${demoStep!=='replies'?'btn-muted':'btn-gold'}`} disabled={demoStep!=='replies'}>
                                {demoStep==='typing'?'Typing...':demoStep==='done'?'Sent':'Click reply above to type'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Stats row */}
                <div className="g3" style={{marginTop:20}}>
                  {[
                    {val:'0.8s',label:'Reply Speed',cls:'ok',prog:85},
                    {val:'94%',label:'Engagement Rate',cls:'g',prog:94},
                    {val:'2,401',label:'Active Operators',cls:'p',prog:70},
                  ].map(s => (
                    <div key={s.label} className="stat-box">
                      <div className={`stat-num ${s.cls}`}>{s.val}</div>
                      <div className="stat-lbl">{s.label}</div>
                      <div className="prog"><div className="prog-fill" style={{width:s.prog+'%'}}/></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ═══ CHAT AGENT ═══ */}
          {section === 'chat-agent' && (
            <div className="float-win">
              <div className="win-titlebar">
                <div className="win-dots"><div className="win-dot" style={{background:'#FF5F57'}}/><div className="win-dot" style={{background:'#FEBC2E'}}/><div className="win-dot" style={{background:'#28C840'}}/></div>
                <div className="win-title">Chat Agent</div>
                <div className="win-tag">Generate · Save · Type</div>
              </div>
              <div className="win-body">
                <div className="g2" style={{gap:20,alignItems:'flex-start'}}>
                  <div>
                    <div style={{marginBottom:12}}>
                      <label className="lbl">Platform</label>
                      <select className="inp" value={caPlat} onChange={e=>setCaPlat(e.target.value)}>
                        <option value="alphadate">Alpha.date</option>
                        <option value="chathomebase">Texting Factory</option>
                        <option value="onlyfans">OnlyFans</option>
                        <option value="chatterapply">ChatterApply</option>
                        <option value="fansly">Fansly</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div style={{marginBottom:12}}>
                      <label className="lbl">His message</label>
                      <textarea className="inp" style={{minHeight:80}} value={caMsg} onChange={e=>setCaMsg(e.target.value)} placeholder="Paste his last message here..."/>
                    </div>
                    <div style={{marginBottom:14}}>
                      <label className="lbl">Reply tone</label>
                      <select className="inp" value={caTone} onChange={e=>setCaTone(e.target.value)}>
                        <option>Warm and genuine</option>
                        <option>Playful and flirty</option>
                        <option>Mysterious</option>
                        <option>Confident and direct</option>
                        <option>Emotionally deep</option>
                      </select>
                    </div>
                    <div className="ctrl-row">
                      <button className="btn btn-primary" onClick={generateReplies} disabled={caLoading||!caMsg.trim()}>
                        {caLoading?<><span className="spin"/> Generating...</>:'✨ Generate Replies'}
                      </button>
                      {caReplies.length>0 && <button className="btn btn-ghost btn-sm" onClick={()=>{setCaReplies([]);setCaMsg('')}}>Clear</button>}
                    </div>

                    {/* Saved replies */}
                    {savedReplies.length > 0 && (
                      <div style={{marginTop:20}}>
                        <div style={{fontSize:11,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:10,fontWeight:700}}>Saved ({savedReplies.length})</div>
                        {savedReplies.map((r,i) => (
                          <div key={i} className="reply-card">
                            <div className="reply-tone">{r.tone}</div>
                            <div className="reply-text" style={{fontSize:11}}>{r.text}</div>
                            <div className="ctrl-row" style={{marginTop:8}}>
                              <button className="btn btn-ghost btn-xs" onClick={()=>copyReply(r.text,i+100)}>
                                {caCopied===i+100?'Copied!':'Copy'}
                              </button>
                              <button className="btn btn-xs" style={{background:'rgba(248,113,113,0.08)',color:'var(--err)',border:'1px solid rgba(248,113,113,0.2)'}} onClick={()=>setSavedReplies(prev=>prev.filter((_,j)=>j!==i))}>Remove</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    {caReplies.length === 0 && !caLoading && (
                      <div style={{textAlign:'center',padding:'40px 20px',color:'var(--t3)',fontSize:13}}>
                        <div style={{fontSize:32,marginBottom:10}}>🤖</div>
                        Enter a message and click Generate to see replies here.
                      </div>
                    )}
                    {caReplies.map((r,i) => (
                      <div key={i} className="reply-card" style={{cursor:'default'}}>
                        <div className="reply-tone">{r.tone}</div>
                        <div className="reply-text">{r.text}</div>
                        <div className="ctrl-row" style={{marginTop:10}}>
                          <button className="btn btn-ghost btn-xs" onClick={()=>copyReply(r.text,i)}>{caCopied===i?'Copied!':'Copy'}</button>
                          <button className="btn btn-xs" style={{background:'rgba(212,163,0,0.08)',color:'var(--gl)',border:'1px solid rgba(212,163,0,0.2)'}} onClick={()=>saveReply(r.text,r.tone)}>Save</button>
                          <button className="btn btn-xs btn-ghost" onClick={()=>{setSimInput(r.text);setSection('typing')}}>Type</button>
                        </div>
                      </div>
                    ))}
                    {caReplies.length>0 && <button className="btn btn-ghost btn-sm" style={{marginTop:6}} onClick={generateReplies}>Regenerate</button>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══ REACTIVATION ═══ */}
          {section === 'reactivation' && (
            <div className="float-win">
              <div className="win-titlebar">
                <div className="win-dots"><div className="win-dot" style={{background:'#FF5F57'}}/><div className="win-dot" style={{background:'#FEBC2E'}}/><div className="win-dot" style={{background:'#28C840'}}/></div>
                <div className="win-title">Reactivation Engine</div>
                <div className="win-tag">Wake Cold Subscribers</div>
              </div>
              <div className="win-body">
                <div style={{background:'rgba(212,163,0,0.06)',border:'1px solid rgba(212,163,0,0.2)',borderRadius:10,padding:12,marginBottom:18,fontSize:12,color:'var(--gl)',lineHeight:1.7}}>
                  Re-engagement triggers follow Alpha.date Category 1 rules -- ALL CAPS hook, 4-7 words, no punctuation after hook, ends with a question.
                </div>
                <div className="g2" style={{gap:16}}>
                  <div>
                    <div style={{marginBottom:12}}>
                      <label className="lbl">Last interaction / what was said</label>
                      <textarea className="inp" style={{minHeight:80}} value={reMsg} onChange={e=>setReMsg(e.target.value)} placeholder="Describe the last conversation or paste his last message..."/>
                    </div>
                    <div style={{marginBottom:12}}>
                      <label className="lbl">How long inactive?</label>
                      <select className="inp">
                        <option>A few hours</option><option>1 day</option><option>2-3 days</option><option>A week</option><option>Over a week</option>
                      </select>
                    </div>
                    <div style={{marginBottom:14}}>
                      <label className="lbl">Signal type</label>
                      <select className="inp">
                        <option>Went silent after active chat</option><option>Read message but no reply</option><option>Viewed profile, no action</option>
                      </select>
                    </div>
                    <button className="btn btn-gold" onClick={generateReactivation} disabled={reLoading||!reMsg.trim()}>
                      {reLoading?<><span className="spin"/> Analysing...</>:'⚡ Generate Triggers'}
                    </button>
                  </div>
                  <div>
                    {reReplies.length===0 && !reLoading && <div style={{textAlign:'center',padding:'40px 20px',color:'var(--t3)',fontSize:13}}><div style={{fontSize:32,marginBottom:10}}>⚡</div>Describe the situation and click Generate.</div>}
                    {reReplies.map((r,i) => (
                      <div key={i} className="reply-card" style={{cursor:'default'}}>
                        <div className="reply-tone">{r.tone}</div>
                        <div className="reply-text">{r.text}</div>
                        <div className="ctrl-row" style={{marginTop:10}}>
                          <button className="btn btn-ghost btn-xs" onClick={()=>{navigator.clipboard.writeText(r.text)}}>Copy</button>
                          <button className="btn btn-xs btn-ghost" onClick={()=>{setSimInput(r.text);setSection('typing')}}>Type</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══ TYPING SIMULATOR ═══ */}
          {section === 'typing' && (
            <div className="float-win">
              <div className="win-titlebar">
                <div className="win-dots"><div className="win-dot" style={{background:'#FF5F57'}}/><div className="win-dot" style={{background:'#FEBC2E'}}/><div className="win-dot" style={{background:'#28C840'}}/></div>
                <div className="win-title">Typing Simulator</div>
                <div className="win-tag">Human-speed · Undetectable</div>
              </div>
              <div className="win-body">
                <div className="g2" style={{gap:20}}>
                  <div>
                    <div style={{marginBottom:12}}>
                      <label className="lbl">Reply to type</label>
                      <textarea className="inp" style={{minHeight:100}} value={simInput} onChange={e=>setSimInput(e.target.value)} readOnly={simRunning}/>
                    </div>
                    <div style={{marginBottom:16}}>
                      <label className="lbl" style={{display:'flex',justifyContent:'space-between'}}>
                        <span>Typing speed</span><span style={{color:'var(--gl)',fontWeight:700}}>{simWPM} WPM</span>
                      </label>
                      <input type="range" className="wpm-slider" min={20} max={120} value={simWPM} onChange={e=>setSimWPM(+e.target.value)} disabled={simRunning}/>
                      <div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:'var(--t3)',marginTop:3}}>
                        <span>20 WPM (careful)</span><span>120 WPM (fast)</span>
                      </div>
                    </div>
                    <div className="ctrl-row">
                      <button className="btn btn-primary" onClick={startSim} disabled={simRunning||!simInput.trim()}>
                        {simRunning?<><span className="spin"/> Typing...</>:'Start Typing'}
                      </button>
                      <button className="btn btn-ghost btn-sm" disabled={simRunning} onClick={()=>{setSimText('');setSimChars(0);setSimTime('0.0s')}}>Reset</button>
                    </div>
                    <div className="g3" style={{marginTop:16}}>
                      {[{val:simChars,lbl:'Characters',cls:'p'},{val:simTime,lbl:'Time',cls:'g'},{val:simRunning?'Typing':'Ready',lbl:'Status',cls:'ok'}].map(s=>(
                        <div key={s.lbl} className="stat-box" style={{padding:12}}>
                          <div className={`stat-num ${s.cls}`} style={{fontSize:18}}>{s.val}</div>
                          <div className="stat-lbl">{s.lbl}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div style={{display:'flex',gap:8,marginBottom:12}}>
                      <button className={`guide-tab ${simView==='live'?'active':''}`} onClick={()=>setSimView('live')}>Live Preview</button>
                      <button className={`guide-tab ${simView==='video'?'active':''}`} onClick={()=>setSimView('video')}>Video Demo</button>
                    </div>

                    {simView === 'live' && (
                      <div>
                        <div style={{display:'flex',gap:10,alignItems:'flex-start',marginBottom:16}}>
                          <div style={{width:30,height:30,borderRadius:'50%',background:'rgba(255,255,255,0.06)',flexShrink:0,marginTop:2}}/>
                          <div className="typing-window" style={{flex:1}}>
                            {simText || <span style={{color:'var(--t3)',fontStyle:'italic'}}>Preview will appear here...</span>}
                            {simRunning && <span className="cursor-blink"/>}
                          </div>
                        </div>
                        <div className="card card-gold">
                          <div style={{fontFamily:'var(--serif)',fontSize:13,color:'var(--gl)',marginBottom:10}}>Why it is undetectable</div>
                          {['Randomised delays 40-200ms between keystrokes','Natural thinking pauses mid-sentence','Adjustable 20-120 WPM to match your speed','Stop or edit mid-type -- nothing auto-sends'].map(f=>(
                            <div key={f} style={{display:'flex',gap:7,marginBottom:6,fontSize:12,color:'var(--t3)'}}>
                              <span style={{color:'var(--ok)'}}>+</span>{f}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {simView === 'video' && (
                      <div>
                        <div style={{background:'rgba(0,0,0,0.5)',border:'1px solid var(--bd)',borderRadius:12,overflow:'hidden',marginBottom:12}}>
                          <video
                            controls
                            playsInline
                            style={{width:'100%',display:'block',maxHeight:220}}
                            poster="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='220' viewBox='0 0 400 220'%3E%3Crect width='400' height='220' fill='%230D0D1E'/%3E%3Ccircle cx='200' cy='110' r='28' fill='none' stroke='%237C3AED' stroke-width='2'/%3E%3Cpolygon points='192,98 192,122 216,110' fill='%237C3AED'/%3E%3Ctext x='200' y='158' text-anchor='middle' fill='%234A4870' font-size='11' font-family='sans-serif'%3ETyping Demo Video%3C/text%3E%3C/svg%3E"
                          >
                            <source src="/typing-demo.mp4" type="video/mp4"/>
                            <source src="/typing-demo.webm" type="video/webm"/>
                            <div style={{padding:20,textAlign:'center',color:'var(--t3)',fontSize:13}}>
                              Video not available. Add typing-demo.mp4 to the public/ folder.
                            </div>
                          </video>
                        </div>
                        <div style={{fontSize:12,color:'var(--t3)',lineHeight:1.7,padding:'10px 12px',background:'rgba(212,163,0,0.04)',border:'1px solid var(--bd2)',borderRadius:8}}>
                          <strong style={{color:'var(--gl)'}}>Adding your video:</strong> Place a file named <code style={{color:'var(--pl)'}}>typing-demo.mp4</code> in the <code style={{color:'var(--pl)'}}>public/</code> folder of the GitHub repo. The video will appear here automatically after the next deploy.
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══ PHOTO ═══ */}
          {section === 'photo' && (
            <div className="float-win">
              <div className="win-titlebar">
                <div className="win-dots"><div className="win-dot" style={{background:'#FF5F57'}}/><div className="win-dot" style={{background:'#FEBC2E'}}/><div className="win-dot" style={{background:'#28C840'}}/></div>
                <div className="win-title">Photo Compliments</div>
                <div className="win-tag">Upload or drag a photo</div>
              </div>
              <div className="win-body">
                <div className="g2" style={{gap:20}}>
                  <div>
                    <div
                      style={{border:'2px dashed var(--bd2)',borderRadius:12,padding:32,textAlign:'center',cursor:'pointer',transition:'all 0.2s',background:'rgba(212,163,0,0.02)',marginBottom:14}}
                      onClick={()=>!photo&&fileRef.current?.click()}
                      onDragOver={e=>{e.preventDefault();(e.currentTarget as HTMLElement).style.borderColor='var(--g)'}}
                      onDragLeave={e=>{(e.currentTarget as HTMLElement).style.borderColor='var(--bd2)'}}
                      onDrop={e=>{e.preventDefault();(e.currentTarget as HTMLElement).style.borderColor='var(--bd2)';const f=e.dataTransfer.files[0];if(f&&f.type.startsWith('image/'))handlePhoto(f)}}>
                      <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}} onChange={e=>{const f=e.target.files?.[0];if(f)handlePhoto(f)}}/>
                      {photo ? (
                        <img src={photo} alt="Preview" style={{maxWidth:'100%',maxHeight:200,borderRadius:8,display:'block',margin:'0 auto'}}/>
                      ) : (
                        <>
                          <div style={{fontSize:36,marginBottom:10}}>📸</div>
                          <div style={{fontSize:13,fontWeight:600,color:'var(--t1)',marginBottom:4}}>Drop a photo or click to browse</div>
                          <div style={{fontSize:12,color:'var(--t3)'}}>JPG, PNG or WEBP</div>
                        </>
                      )}
                    </div>
                    {photo && (
                      <div className="ctrl-row">
                        <button className="btn btn-gold" onClick={genPhotoCompliments} disabled={photoLoading}>
                          {photoLoading?<><span className="spin"/> Generating...</>:'Generate Compliments'}
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={()=>{setPhoto(null);setPhotoResults([])}}>Clear</button>
                      </div>
                    )}
                  </div>
                  <div>
                    {photoResults.length===0 && <div style={{textAlign:'center',padding:'40px 20px',color:'var(--t3)',fontSize:13}}><div style={{fontSize:32,marginBottom:10}}>💌</div>Upload a photo and click Generate to see compliments here.</div>}
                    {photoResults.map((r,i)=>(
                      <div key={i} className="reply-card" style={{cursor:'default'}}>
                        <div className="reply-tone">Option {i+1}</div>
                        <div className="reply-text">{r}</div>
                        <button className="btn btn-ghost btn-xs" style={{marginTop:8}} onClick={()=>navigator.clipboard.writeText(r)}>Copy</button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══ ALPHA.DATE GUIDE ═══ */}
          {section === 'alphadate-guide' && (
            <div className="float-win">
              <div className="win-titlebar">
                <div className="win-dots"><div className="win-dot" style={{background:'#FF5F57'}}/><div className="win-dot" style={{background:'#FEBC2E'}}/><div className="win-dot" style={{background:'#28C840'}}/></div>
                <div className="win-title">Alpha.date Operator Guide</div>
                <div className="win-tag">Three categories · Hook rules</div>
              </div>
              <div className="win-body">
                <div className="card card-gold" style={{marginBottom:16}}>
                  <div style={{fontFamily:'var(--serif)',fontSize:13,color:'var(--gl)',marginBottom:6}}>The Golden Hook Rule</div>
                  <div style={{fontSize:13,color:'var(--t2)',lineHeight:1.7}}>Every message must start with a hook in <strong style={{color:'var(--t1)'}}>ALL CAPITAL LETTERS</strong>. 4-7 words. No punctuation at the end. Never repeat the same hook. Applies to all three categories.</div>
                </div>
                <div className="guide-tabs">
                  {[['cat1','Category 1 -- Outreach'],['cat2','Category 2 -- Replies'],['cat3','Category 3 -- Bulk'],['rules','Absolute Rules']].map(([id,lbl])=>(
                    <button key={id} className={`guide-tab ${guideTab===id?'active':''}`} onClick={()=>setGuideTab(id)}>{lbl}</button>
                  ))}
                </div>
                {guideTab==='cat1' && (
                  <div>
                    <div style={{fontSize:12,color:'var(--t3)',marginBottom:12,lineHeight:1.6}}>Use on /chance page -- winks, likes, views, first messages, letters.</div>
                    {[['var(--pll)','He sent a wink','DJ, THAT WINK WAS JUST THE BEGINNING and I have a feeling you already know what comes next. What made you stop on my profile?'],
                      ['var(--gl)','He liked your profile','Robert, MOST PEOPLE SCROLL PAST WITHOUT STOPPING and I noticed you did not. What caught your attention?'],
                      ['var(--ok)','Letter (max 300 chars, one paragraph)','YOU HAVE A PRESENCE THAT STAYS WITH YOU and I mean that in the rarest way -- the kind that lingers hours after you first noticed it. What has shaped you most?']
                    ].map(([color,lbl,ex])=>(
                      <div key={lbl} className="ex-box"><div className="ex-lbl" style={{color}}>{lbl}</div><div className="ex-txt">{ex}</div></div>
                    ))}
                  </div>
                )}
                {guideTab==='cat2' && (
                  <div>
                    <div style={{background:'rgba(52,211,153,0.07)',border:'1px solid rgba(52,211,153,0.18)',borderRadius:8,padding:'10px 13px',marginBottom:12,fontSize:12,color:'var(--ok)'}}>ONE SENTENCE ONLY. 15-25 words maximum. No emojis.</div>
                    {[['Romantic','There is something about the way you said that which makes it genuinely hard to think about anything else right now.'],
                      ['Playful','You say that like you have not already thought about exactly what happens next, which I am fairly certain you have.'],
                      ['He went silent','Life has a way of getting loud sometimes and I hope yours has been the good kind of busy since we last spoke.']
                    ].map(([lbl,ex])=>(
                      <div key={lbl} className="ex-box"><div className="ex-lbl" style={{color:'var(--ok)'}}>{lbl}</div><div className="ex-txt">{ex}</div></div>
                    ))}
                  </div>
                )}
                {guideTab==='cat3' && (
                  <div>
                    <div style={{fontSize:12,color:'var(--t3)',marginBottom:12,lineHeight:1.6}}>Under 20 words. ~40% ALL CAPS hooks. <strong style={{color:'var(--gl)'}}>Emojis allowed.</strong> Vary topics widely.</div>
                    {['THE WORLD SHRANK WHEN YOU STARTED TRAVELLING -- what was the first place that genuinely changed how you think?',
                      'If you could only keep one morning habit forever, what would it be?',
                      'LATE NIGHT THOUGHTS HIT DIFFERENTLY -- what is the last thing you thought about before sleep?'
                    ].map((ex,i)=>(
                      <div key={i} className="ex-box"><div className="ex-txt" style={{color:'var(--gl)'}}>{ex}</div></div>
                    ))}
                  </div>
                )}
                {guideTab==='rules' && (
                  <div>
                    {['Never repeat the same message or letter.',
                      'Never reuse the same opening hook.',
                      'Never mention AI.',
                      'No pressure or desperation in Cat 1 or Cat 3.',
                      'Always proofread before sending.',
                      'No emojis in Category 1 or Category 2.',
                    ].map((r,i)=>(
                      <div key={i} style={{display:'flex',gap:10,padding:'9px 0',borderBottom:'1px solid var(--bd)',fontSize:12.5,color:'var(--t2)',lineHeight:1.6}}>
                        <span style={{color:'var(--err)',flexShrink:0}}>x</span>{r}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══ TF GUIDE ═══ */}
          {section === 'tf-guide' && (
            <div className="float-win">
              <div className="win-titlebar">
                <div className="win-dots"><div className="win-dot" style={{background:'#FF5F57'}}/><div className="win-dot" style={{background:'#FEBC2E'}}/><div className="win-dot" style={{background:'#28C840'}}/></div>
                <div className="win-title">Texting Factory Guide</div>
                <div className="win-tag">Rules for chathomebase.com operators</div>
              </div>
              <div className="win-body">
                <div className="card card-gold" style={{marginBottom:16}}>
                  <div style={{fontFamily:'var(--serif)',fontSize:13,color:'var(--gl)',marginBottom:12}}>Non-negotiable rules</div>
                  {[['75-250','Characters per reply -- under 75 too short, over 250 gets cut off. Target 120-200.'],
                    ['+','Always include a CTA -- a question, invitation, or something that makes him want to respond.'],
                    ['x','Never suggest meeting in person.'],
                    ['x','Never share contact info -- no phone, WhatsApp, Instagram, email.'],
                    ['x','No explicit content -- flirty and suggestive only.'],
                    ['x','No emojis -- Texting Factory flags emoji use.'],
                    ['x','Never mention the platform name or that you are an operator.'],
                  ].map(([icon,rule])=>(
                    <div key={rule} style={{display:'flex',gap:10,padding:'9px 0',borderBottom:'1px solid rgba(212,163,0,0.1)',fontSize:12.5,color:'var(--t2)',lineHeight:1.6,alignItems:'flex-start'}}>
                      <span style={{color:icon==='x'?'var(--err)':icon==='+'?'var(--ok)':'var(--gl)',flexShrink:0,fontWeight:700,minWidth:30}}>{icon}</span>{rule}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ═══ Q&A ═══ */}
          {section === 'qa' && (
            <div className="float-win">
              <div className="win-titlebar">
                <div className="win-dots"><div className="win-dot" style={{background:'#FF5F57'}}/><div className="win-dot" style={{background:'#FEBC2E'}}/><div className="win-dot" style={{background:'#28C840'}}/></div>
                <div className="win-title">Q & A</div>
                <div className="win-tag">Common operator questions</div>
              </div>
              <div className="win-body">
                {QA.map((item,i)=>(
                  <div key={i} className="qa-item">
                    <div className={`qa-q ${openQA===i?'open':''}`} onClick={()=>setOpenQA(openQA===i?null:i)}>
                      {item.q}<span style={{color:'var(--t3)',marginLeft:8,flexShrink:0}}>{openQA===i?'v':'^'}</span>
                    </div>
                    <div className={`qa-a ${openQA===i?'open':''}`}>{item.a}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══ EXTENSIONS (INSTALL CENTER) ═══ */}
          {section === 'extensions' && (
            <div className="float-win">
              <div className="win-titlebar">
                <div className="win-dots"><div className="win-dot" style={{background:'#FF5F57'}}/><div className="win-dot" style={{background:'#FEBC2E'}}/><div className="win-dot" style={{background:'#28C840'}}/></div>
                <div className="win-title">Extension Installation Center</div>
                <div className="win-tag">Chrome Web Store</div>
              </div>
              <div className="win-body">
                <div className="g2" style={{gap:20,marginBottom:20}}>
                  {[
                    {icon:'💬',name:'CIC -- Texting Factory',ver:'v1.5.1',url:EXT_TF,
                     desc:'For chathomebase.com and Texting Factory operators. Reads messages automatically, enforces character rules, types at human speed.',
                     features:['Auto-reads chat messages','75-250 character rule','Human-speed typing','Session lock security','Full plan enforcement']},
                    {icon:'🌐',name:'General CIC',ver:'v1.5.1',url:EXT_GEN,
                     desc:'For Alpha.date, OnlyFans, Fansly, ChatterApply and 8 other platforms. Also works on any website -- scan screen content and generate replies anywhere.',
                     features:['Alpha.date cat 1/2/3 system','Photo compliment detection','ChatterApply.com supported','Any-website screen scanning','Re-engagement triggers']},
                  ].map(e=>(
                    <div key={e.name} className="ext-card">
                      <div style={{display:'flex',gap:12,alignItems:'center'}}>
                        <div className="ext-icon">{e.icon}</div>
                        <div>
                          <div className="ext-name">{e.name}</div>
                          <div className="ext-ver">{e.ver} -- Latest</div>
                        </div>
                      </div>
                      <div className="ext-desc">{e.desc}</div>
                      {e.features.map(f=>(
                        <div key={f} className="feature-row"><span style={{color:'var(--ok)'}}>+</span>{f}</div>
                      ))}
                      <a href={e.url} target="_blank" rel="noreferrer" className="btn btn-primary btn-full" style={{textDecoration:'none',display:'flex',marginTop:4}}>
                        Install from Chrome Store
                      </a>
                      <button className="btn btn-ghost btn-sm btn-full" onClick={()=>setSection('install')}>
                        View Install Guide
                      </button>
                    </div>
                  ))}
                </div>
                <div className="card" style={{marginBottom:16}}>
                  <div style={{fontFamily:'var(--serif)',fontSize:13,color:'var(--gl)',marginBottom:12}}>How General CIC works on any website</div>
                  <div style={{fontSize:12.5,color:'var(--t2)',lineHeight:1.75}}>
                    On partner platforms (Alpha.date, OnlyFans etc) General CIC reads the chat automatically. On <strong style={{color:'var(--t1)'}}>any other website</strong> -- including ChatterApply, social media, or any chat tool -- it adds a floating trigger button. Click the button, paste or type his message, choose a tone, and CIC generates a reply. Click Type and it will type the reply into any focused text input on the page at human speed.
                  </div>
                </div>
                <div className="card card-gold">
                  <div style={{fontFamily:'var(--serif)',fontSize:13,color:'var(--gl)',marginBottom:8}}>Version History</div>
                  {[['v1.5.1','Latest','Session token security, USETN IDs filtered, context invalidation handled gracefully'],
                    ['v1.5.0','Previous','Fixed scanning on all platforms, Alpha.date /chance page cold client detection'],
                    ['v1.1.0','Legacy','Original version -- email + password. Update immediately.']
                  ].map(([ver,tag,desc])=>(
                    <div key={ver} style={{display:'flex',gap:12,padding:'9px 0',borderBottom:'1px solid rgba(212,163,0,0.08)',fontSize:12}}>
                      <div style={{flexShrink:0,width:50}}>
                        <div style={{fontWeight:700,color:tag==='Latest'?'var(--gl)':tag==='Previous'?'var(--t2)':'var(--t3)'}}>{ver}</div>
                        <div style={{fontSize:10,color:'var(--t3)'}}>{tag}</div>
                      </div>
                      <div style={{color:'var(--t3)',lineHeight:1.6}}>{desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ═══ INSTALL GUIDE ═══ */}
          {section === 'install' && (
            <div className="float-win">
              <div className="win-titlebar">
                <div className="win-dots"><div className="win-dot" style={{background:'#FF5F57'}}/><div className="win-dot" style={{background:'#FEBC2E'}}/><div className="win-dot" style={{background:'#28C840'}}/></div>
                <div className="win-title">Install Guide</div>
                <div className="win-tag">3 steps to get started</div>
              </div>
              <div className="win-body">
                <div className="g2" style={{gap:20,marginBottom:20}}>
                  {[
                    {icon:'💬',name:'CIC -- Texting Factory',url:EXT_TF},
                    {icon:'🌐',name:'General CIC',url:EXT_GEN}
                  ].map(e=>(
                    <a key={e.name} href={e.url} target="_blank" rel="noreferrer" className="btn btn-primary btn-full" style={{textDecoration:'none',display:'flex',padding:14}}>
                      {e.icon} Install {e.name}
                    </a>
                  ))}
                </div>
                <div className="card" style={{marginBottom:16}}>
                  {[
                    ['Click Install from Chrome Store','Opens the official CIC listing on the Chrome Web Store.'],
                    ['"Add to Chrome"','Chrome installs the extension in seconds. The CIC icon appears in your toolbar.'],
                    ['Click the CIC icon and enter your email','Sign in with the email you registered with. The extension validates your plan and you start generating replies immediately.'],
                    ['You are live','Open any supported platform -- the CIC panel appears. On other websites click the floating CIC button.'],
                  ].map(([title,desc],i)=>(
                    <div key={i} style={{display:'flex',gap:14,alignItems:'flex-start',marginBottom:i<3?18:0}}>
                      <div style={{width:26,height:26,borderRadius:'50%',background:i===3?'rgba(52,211,153,0.15)':'linear-gradient(135deg,var(--p),var(--g))',border:i===3?'1px solid var(--ok)':'none',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,flexShrink:0,color:i===3?'var(--ok)':'#fff'}}>{i===3?'+':i+1}</div>
                      <div>
                        <div style={{fontSize:13,fontWeight:600,color:i===3?'var(--ok)':'var(--t1)',marginBottom:3}}>{title}</div>
                        <div style={{fontSize:12,color:'var(--t3)',lineHeight:1.6}}>{desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="card card-gold">
                  <div style={{fontSize:12.5,color:'var(--t3)',lineHeight:1.7,marginBottom:12}}>Already installed? Go to <strong style={{color:'var(--t1)'}}>chrome://extensions</strong> and click Update to get the latest version.</div>
                  <div style={{display:'flex',gap:10,flexWrap:'wrap' as const}}>
                    <a href={EXT_TF} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm" style={{textDecoration:'none'}}>TF Extension</a>
                    <a href={EXT_GEN} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm" style={{textDecoration:'none'}}>General CIC</a>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══ ANALYTICS ═══ */}
          {section === 'analytics' && (
            <div className="float-win">
              <div className="win-titlebar">
                <div className="win-dots"><div className="win-dot" style={{background:'#FF5F57'}}/><div className="win-dot" style={{background:'#FEBC2E'}}/><div className="win-dot" style={{background:'#28C840'}}/></div>
                <div className="win-title">Analytics</div>
                <div className="win-tag">Platform-wide stats</div>
              </div>
              <div className="win-body">
                <div className="g3" style={{marginBottom:20}}>
                  {[{val:'2,401',lbl:'Active Operators',cls:'p',prog:70},{val:'94%',lbl:'Avg Engagement',cls:'g',prog:94},{val:'0.8s',lbl:'Reply Speed',cls:'ok',prog:85},
                    {val:'10+',lbl:'Platforms',cls:'p',prog:100},{val:'80%',lbl:'Response Rate',cls:'g',prog:80},{val:'3',lbl:'AI Models',cls:'ok',prog:100}
                  ].map(s=>(
                    <div key={s.lbl} className="stat-box">
                      <div className={`stat-num ${s.cls}`}>{s.val}</div>
                      <div className="stat-lbl">{s.lbl}</div>
                      <div className="prog"><div className="prog-fill" style={{width:s.prog+'%'}}/></div>
                    </div>
                  ))}
                </div>
                <div className="card">
                  <div style={{fontFamily:'var(--serif)',fontSize:13,color:'var(--t1)',marginBottom:10}}>Your Usage</div>
                  <div style={{fontSize:12.5,color:'var(--t3)',lineHeight:1.7}}>Sign in via the extension to see your personal stats -- daily generations, total replies sent, platforms used, and plan status. Usage resets at midnight every day.</div>
                </div>
              </div>
            </div>
          )}

          {/* ═══ BILLING ═══ */}
          {section === 'billing' && (
            <div className="float-win">
              <div className="win-titlebar">
                <div className="win-dots"><div className="win-dot" style={{background:'#FF5F57'}}/><div className="win-dot" style={{background:'#FEBC2E'}}/><div className="win-dot" style={{background:'#28C840'}}/></div>
                <div className="win-title">Billing</div>
                <div className="win-tag">Plans -- Worldwide payment</div>
              </div>
              <div className="win-body">
                <div className="g3" style={{marginBottom:20}}>
                  {[
                    {name:'Free Trial',price:'Free',period:'7 days',color:'var(--ok)',badge:'LIMITED',features:['Day 1-3: 50 premium replies/day','Day 4-5: 30 basic replies/day','Day 6: 20 basic replies/day','Day 7: 10 basic replies/day','No credit card needed']},
                    {name:'Basic',price:'$8',period:'/ month',color:'#60a5fa',badge:'',features:['Unlimited generic replies','All 10+ platforms','Standard AI quality','Both extensions included','No explicit content']},
                    {name:'Pro',price:'$15',period:'/ month',color:'var(--pl)',badge:'BEST',features:['Unlimited premium replies','Full explicit and erotic content','Best-in-class AI responses','Priority support','Referral rewards']},
                  ].map(p=>(
                    <div key={p.name} className="card" style={{position:'relative',border:p.name==='Pro'?'1px solid rgba(168,85,247,0.35)':undefined,boxShadow:p.name==='Pro'?'0 0 40px rgba(124,58,237,0.1)':undefined}}>
                      {p.badge&&<div style={{position:'absolute',top:12,right:12,background:'linear-gradient(135deg,var(--p),var(--g))',padding:'2px 8px',borderRadius:20,fontSize:9,fontWeight:700,color:'#fff'}}>{p.badge}</div>}
                      <div style={{color:p.color,fontWeight:700,fontSize:12,fontFamily:'var(--serif)',marginBottom:5}}>{p.name}</div>
                      <div style={{fontSize:26,fontWeight:800,marginBottom:2}}>{p.price}</div>
                      <div style={{color:'var(--t3)',fontSize:11,marginBottom:14}}>{p.period}</div>
                      {p.features.map(f=>(
                        <div key={f} style={{display:'flex',gap:7,marginBottom:5,fontSize:11.5,color:'var(--t3)',alignItems:'flex-start'}}>
                          <span style={{color:p.color,flexShrink:0}}>+</span>{f}
                        </div>
                      ))}
                      <a href={LANDING} className="btn btn-full btn-sm" style={{marginTop:12,textDecoration:'none',display:'flex',background:p.name==='Pro'?'linear-gradient(135deg,var(--p),var(--g))':'transparent',border:`1px solid ${p.color}`,color:p.name==='Pro'?'#fff':p.color}}>
                        {p.name==='Free Trial'?'Start Free':p.name==='Pro'?'Get Pro':'Get Started'}
                      </a>
                    </div>
                  ))}
                </div>
                <div className="card card-gold" style={{textAlign:'center'}}>
                  <div style={{fontFamily:'var(--serif)',fontSize:14,color:'var(--gl)',marginBottom:10}}>How to Pay</div>
                  <div style={{fontSize:13,color:'var(--t3)',lineHeight:1.7,marginBottom:12}}>Click Upgrade inside the extension. Choose your payment method. Admin contacts you within minutes with payment details. Available in every country -- M-Pesa, Visa, Mastercard, PayPal, USDT, BTC, ETH, bank transfer.</div>
                  <div style={{fontSize:12,color:'var(--t3)'}}>Support: <a href="mailto:whwva47@gmail.com" style={{color:'var(--pl)',textDecoration:'none'}}>whwva47@gmail.com</a></div>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>
    </>
  )
}
