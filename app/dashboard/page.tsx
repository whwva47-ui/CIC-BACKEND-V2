'use client'
import { useState, useRef, useEffect } from 'react'

const EXT_TF  = 'https://chromewebstore.google.com/detail/cic-texting-factory/dkgpheiimhedhdfandcgeogmbfmmiobp'
const EXT_GEN = 'https://chromewebstore.google.com/detail/cic-general-cic/dkgpheiimhedhdfandcgeogmbfmmiobp'
const LANDING = '/landing'

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;1,9..40,300&display=swap');

:root {
  --bg:   #050508;
  --bg2:  #080810;
  --bg3:  #0d0d1a;
  --card: rgba(255,255,255,0.03);
  --bd:   rgba(255,255,255,0.07);
  --bd2:  rgba(212,163,0,0.2);
  --p:    #7c3aed;
  --pl:   #a855f7;
  --pll:  #c4b5fd;
  --g:    #d4a300;
  --gl:   #f5d98a;
  --t1:   #f0eeff;
  --t2:   #9d97c0;
  --t3:   #4a4870;
  --ok:   #34d399;
  --err:  #f87171;
  --warn: #fbbf24;
  --serif:'Syne',sans-serif;
  --sans: 'DM Sans',sans-serif;
}

*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;overflow:hidden;background:var(--bg)}
body{font-family:var(--sans);color:var(--t1);-webkit-font-smoothing:antialiased}

/* Grain overlay */
body::after{content:'';position:fixed;inset:0;pointer-events:none;z-index:999;opacity:0.025;
  background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}

/* Ambient orbs */
.orb{position:fixed;border-radius:50%;filter:blur(120px);pointer-events:none;z-index:0}
.orb-1{width:800px;height:800px;background:radial-gradient(circle,rgba(124,58,237,0.12),transparent 70%);top:-400px;right:-300px}
.orb-2{width:600px;height:600px;background:radial-gradient(circle,rgba(212,163,0,0.08),transparent 70%);bottom:-300px;left:-200px}

/* Layout */
.workspace{position:relative;z-index:1;display:grid;grid-template-columns:220px 1fr;grid-template-rows:56px 1fr;height:100vh;overflow:hidden}

/* Topbar */
.topbar{grid-column:1/-1;display:flex;align-items:center;padding:0 20px;gap:16px;
  background:rgba(5,5,8,0.9);backdrop-filter:blur(20px);
  border-bottom:1px solid var(--bd);z-index:20}
.brand{font-family:var(--serif);font-weight:800;font-size:15px;letter-spacing:-0.01em;
  background:linear-gradient(135deg,#fff 0%,var(--gl) 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.brand-sub{font-size:9px;color:var(--t3);letter-spacing:0.12em;text-transform:uppercase;margin-top:1px}
.topbar-div{width:1px;height:28px;background:var(--bd);flex-shrink:0}
.status-pill{display:flex;align-items:center;gap:5px;font-size:11px;color:var(--t3)}
.dot{width:5px;height:5px;border-radius:50%;background:var(--ok);animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1;box-shadow:0 0 0 0 rgba(52,211,153,0.4)}50%{opacity:.7;box-shadow:0 0 0 4px rgba(52,211,153,0)}}
.tb-right{margin-left:auto;display:flex;align-items:center;gap:8px}
.plan-chip{padding:3px 10px;border-radius:20px;font-size:10px;font-weight:700;
  background:linear-gradient(135deg,rgba(212,163,0,0.15),rgba(212,163,0,0.05));
  border:1px solid rgba(212,163,0,0.3);color:var(--gl)}

/* Sidebar */
.sidebar{background:rgba(5,5,8,0.95);border-right:1px solid var(--bd);
  display:flex;flex-direction:column;overflow-y:auto;overflow-x:hidden}
.sb-group{padding:14px 14px 4px;font-size:9px;font-weight:700;color:var(--t3);
  text-transform:uppercase;letter-spacing:0.12em}
.sb-item{display:flex;align-items:center;gap:9px;padding:8px 14px;font-size:12.5px;
  color:var(--t2);cursor:pointer;border-left:2px solid transparent;
  transition:all 0.15s;user-select:none;border-radius:0 6px 6px 0;margin:0 6px 1px 0}
.sb-item:hover{color:var(--t1);background:rgba(255,255,255,0.04)}
.sb-item.active{color:var(--gl);background:rgba(212,163,0,0.06);border-left-color:var(--g)}
.sb-icon{width:14px;text-align:center;font-size:12px;flex-shrink:0}
.sb-badge{margin-left:auto;padding:1px 7px;border-radius:10px;font-size:9px;font-weight:700}
.sb-badge.new{background:rgba(52,211,153,0.12);color:var(--ok);border:1px solid rgba(52,211,153,0.2)}
.sb-badge.pro{background:rgba(212,163,0,0.12);color:var(--gl);border:1px solid rgba(212,163,0,0.2)}
.sb-bottom{margin-top:auto;padding:12px 14px;border-top:1px solid var(--bd);font-size:11px;color:var(--t3)}

/* Main */
.main{overflow-y:auto;background:var(--bg);position:relative}

/* Window */
.win{position:absolute;inset:20px;background:rgba(8,8,16,0.8);
  backdrop-filter:blur(24px);border:1px solid var(--bd);
  border-radius:18px;box-shadow:0 24px 80px rgba(0,0,0,0.6);
  display:flex;flex-direction:column;overflow:hidden}
.win-bar{display:flex;align-items:center;gap:8px;padding:14px 18px;
  border-bottom:1px solid var(--bd);background:rgba(0,0,0,0.2);flex-shrink:0}
.win-dots{display:flex;gap:5px}
.win-dot{width:11px;height:11px;border-radius:50%}
.win-title{font-family:var(--serif);font-size:13px;font-weight:700;color:var(--t2);margin-left:4px}
.win-tag{margin-left:auto;font-size:10px;color:var(--t3);padding:2px 10px;
  border:1px solid var(--bd);border-radius:20px;letter-spacing:0.04em}
.win-body{flex:1;overflow-y:auto;padding:22px;scrollbar-width:thin}

/* Buttons */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:5px;
  padding:8px 18px;border-radius:8px;font-family:var(--sans);font-size:12.5px;
  font-weight:600;cursor:pointer;border:none;transition:all 0.18s;white-space:nowrap}
.btn-p{background:linear-gradient(135deg,var(--p),var(--pl));color:#fff;box-shadow:0 2px 20px rgba(124,58,237,0.3)}
.btn-p:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 4px 28px rgba(124,58,237,0.45)}
.btn-g{background:linear-gradient(135deg,var(--g),var(--gl));color:#0a0a12}
.btn-g:hover:not(:disabled){transform:translateY(-1px)}
.btn-ghost{background:rgba(255,255,255,0.05);color:var(--pll);border:1px solid var(--bd)}
.btn-ghost:hover{background:rgba(255,255,255,0.08)}
.btn-sm{padding:5px 12px;font-size:11.5px}
.btn-xs{padding:3px 9px;font-size:10.5px;border-radius:6px}
.btn-full{width:100%}
.btn:disabled{opacity:0.35;cursor:not-allowed;transform:none!important}
.btn-muted{background:rgba(255,255,255,0.02);color:var(--t3);border:1px solid var(--bd);cursor:not-allowed}

/* Grid */
.g2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}
.g4{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}

/* Cards */
.card{background:var(--card);border:1px solid var(--bd);border-radius:14px;padding:18px}
.card-g{border-color:var(--bd2)}
.card-p{border-color:rgba(168,85,247,0.2);box-shadow:0 0 30px rgba(124,58,237,0.06)}

/* Inputs */
.lbl{display:block;font-size:9.5px;font-weight:700;color:var(--t3);
  text-transform:uppercase;letter-spacing:0.08em;margin-bottom:5px}
.inp{width:100%;padding:9px 12px;background:rgba(0,0,0,0.4);border:1px solid var(--bd);
  border-radius:8px;color:var(--t1);font-size:13px;font-family:var(--sans);
  outline:none;transition:border-color 0.2s}
.inp:focus{border-color:var(--pl)}
.inp::placeholder{color:var(--t3)}
textarea.inp{resize:none;line-height:1.6}
select.inp{cursor:pointer;appearance:none}

/* Reply cards */
.rc{background:rgba(255,255,255,0.025);border:1px solid var(--bd);border-radius:10px;
  padding:11px 13px;margin-bottom:7px;transition:all 0.15s;position:relative}
.rc:hover{border-color:rgba(212,163,0,0.3);background:rgba(212,163,0,0.03)}
.rc.sel{border-color:var(--g);background:rgba(212,163,0,0.05)}
.rc-tone{font-size:9px;font-weight:700;color:var(--gl);text-transform:uppercase;
  letter-spacing:0.08em;margin-bottom:5px}
.rc-text{font-size:12px;color:var(--t1);line-height:1.6}

/* Stats */
.stat{background:var(--card);border:1px solid var(--bd);border-radius:14px;
  padding:16px;text-align:center}
.stat-val{font-family:var(--serif);font-size:24px;font-weight:800;margin-bottom:3px}
.stat-lbl{font-size:10.5px;color:var(--t3)}
.prog{height:2px;background:rgba(255,255,255,0.06);border-radius:1px;margin-top:8px;overflow:hidden}
.prog-fill{height:100%;background:linear-gradient(90deg,var(--p),var(--g))}

/* Chat */
.chat-area{background:rgba(0,0,0,0.35);border:1px solid var(--bd);border-radius:10px;
  padding:12px;min-height:140px;margin-bottom:12px}
.msg{display:flex;gap:7px;margin-bottom:8px;align-items:flex-end}
.msg.out{flex-direction:row-reverse}
.avatar{width:24px;height:24px;border-radius:50%;flex-shrink:0;
  display:flex;align-items:center;justify-content:center;font-size:9px}
.bubble{max-width:76%;padding:7px 11px;border-radius:12px;font-size:12px;line-height:1.55}
.bubble.in{background:rgba(255,255,255,0.06);border:1px solid var(--bd);
  border-bottom-left-radius:2px;color:var(--t2)}
.bubble.out{background:linear-gradient(135deg,rgba(124,58,237,0.28),rgba(168,85,247,0.18));
  border:1px solid rgba(124,58,237,0.3);border-bottom-right-radius:2px;color:var(--t1)}
.cursor{display:inline-block;width:2px;height:12px;background:var(--pl);
  animation:blink 1s step-end infinite;vertical-align:middle;margin-left:1px}
@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
.typing-dots span{display:inline-block;width:4px;height:4px;border-radius:50%;
  background:var(--t3);margin:0 2px;animation:td 1.2s infinite}
.typing-dots span:nth-child(2){animation-delay:.2s}
.typing-dots span:nth-child(3){animation-delay:.4s}
@keyframes td{0%,60%,100%{opacity:.3;transform:translateY(0)}30%{opacity:1;transform:translateY(-3px)}}

/* Popup sim */
.popup{width:320px;background:rgba(8,8,20,0.98);border:1px solid rgba(124,58,237,0.25);
  border-radius:14px;box-shadow:0 20px 60px rgba(0,0,0,0.8);overflow:hidden;margin:0 auto}
.popup-head{background:linear-gradient(135deg,rgba(124,58,237,0.25),rgba(212,163,0,0.1));
  padding:14px 16px;border-bottom:1px solid var(--bd)}
.popup-brand{font-family:var(--serif);font-size:13px;font-weight:700;
  background:linear-gradient(135deg,var(--pll),var(--gl));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.popup-body{padding:16px}

/* Tabs */
.tab{padding:5px 13px;border-radius:20px;font-size:11px;font-weight:600;
  cursor:pointer;border:1px solid var(--bd);background:transparent;
  color:var(--t3);font-family:var(--sans);transition:all 0.15s}
.tab:hover{color:var(--t1)}
.tab.on{background:rgba(124,58,237,0.1);color:var(--pll);border-color:rgba(124,58,237,0.3)}

/* Guide */
.ex{background:rgba(0,0,0,0.3);border-radius:8px;padding:10px 13px;margin-bottom:7px}
.ex-lbl{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:5px}
.ex-txt{font-size:11.5px;font-style:italic;color:var(--t2);line-height:1.6}

/* QA */
.qa{border:1px solid var(--bd);border-radius:8px;margin-bottom:7px;overflow:hidden}
.qa-q{padding:11px 13px;cursor:pointer;display:flex;justify-content:space-between;
  font-size:12.5px;font-weight:500;color:var(--t1);transition:background 0.15s}
.qa-q:hover{background:rgba(124,58,237,0.04)}
.qa-q.on{background:rgba(124,58,237,0.07);color:var(--pll)}
.qa-a{display:none;padding:0 13px 11px;font-size:12px;color:var(--t3);line-height:1.75}
.qa-a.on{display:block}

/* Script cards */
.script-card{background:var(--card);border:1px solid var(--bd);border-radius:10px;
  padding:13px;cursor:pointer;transition:all 0.15s}
.script-card:hover{border-color:rgba(212,163,0,0.3);background:rgba(212,163,0,0.03)}
.script-tag{display:inline-block;padding:2px 8px;border-radius:10px;font-size:9px;
  font-weight:700;margin-bottom:7px;background:rgba(124,58,237,0.12);
  color:var(--pll);border:1px solid rgba(124,58,237,0.2)}

/* Earnings tracker */
.earn-num{font-family:var(--serif);font-size:36px;font-weight:800;
  background:linear-gradient(135deg,var(--ok),#6ee7b7);-webkit-background-clip:text;-webkit-text-fill-color:transparent}

/* Comparison table */
.cmp-table{width:100%;border-collapse:collapse;font-size:12px}
.cmp-table th{text-align:left;padding:10px 12px;font-size:10px;font-weight:700;
  color:var(--t3);text-transform:uppercase;letter-spacing:0.07em;border-bottom:1px solid var(--bd)}
.cmp-table td{padding:9px 12px;border-bottom:1px solid rgba(255,255,255,0.04);color:var(--t2)}
.cmp-table tr:hover td{background:rgba(255,255,255,0.02)}
.cmp-table .cic-col{color:var(--ok);font-weight:700}
.cmp-table .no-col{color:var(--t3)}

/* Slider */
.slider{width:100%;accent-color:var(--g);cursor:pointer}

/* Spinner */
.spin{width:13px;height:13px;border:2px solid rgba(255,255,255,0.15);
  border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}

/* Scrollbar */
::-webkit-scrollbar{width:3px}
::-webkit-scrollbar-thumb{background:rgba(124,58,237,0.25);border-radius:2px}
`

type Sec = 'demo'|'agent'|'reactivation'|'opener'|'typing'|'photo'|'tone-mixer'|'ppv'|'scripts'|'earnings'|'alphadate'|'tf-guide'|'qa'|'extensions'|'install'|'analytics'|'billing'|'compare'

const DEMO_REPLIES = [
  { tone:'WARM · Build connection', text:"That actually made me smile. I've had one of those days where everything felt rushed — knowing someone was thinking about me changes the whole energy of it." },
  { tone:'FLIRTY · Playful pull', text:"All day? That's dangerous. I hope your imagination was being kind to you... was it? 😏" },
  { tone:'PRO MIX · Warm + Mysterious', text:"I love that you said that, and now I can't focus either. Tell me something that happened today — big or small..." },
  { tone:'BOLD · Confident', text:"You say that like I wasn't already thinking about you first. Funny how that works. What's really on your mind?" },
]

const SCRIPTS = [
  { tag:'Panic room', title:'He went silent mid-conversation', text:"I was just thinking — did I say something that landed wrong? You went quiet and I'd rather know than wonder. What's going on?" },
  { tag:'Re-engage', title:'Cold after a week', text:"SOMETHING MADE ME THINK OF YOU and it wasn't a small thing. What's been keeping you busy? I want to know everything." },
  { tag:'Photo compliment', title:'He sent a selfie', text:"There's something in that photo I can't quite place — you look like someone who has stories worth hearing. What were you thinking when you took it?" },
  { tag:'PPV tease', title:'Upselling exclusive content', text:"I made something for the people who actually take the time to talk to me properly. You qualify. Want to see it before anyone else does?" },
  { tag:'First message', title:'Starting a new conversation', text:"YOU HAVE A PRESENCE THAT STOPPED ME — not everyone has that. What's the story behind someone like you being here?" },
  { tag:'Tone mix', title:'Warm + Mysterious', text:"There's something about the way you said that which makes it genuinely hard to think straight. I want to figure out why." },
]

const QA = [
  { q:'How does the typing simulator work?', a:'The extension types each character with a randomised delay between 40-200ms, plus natural pauses at spaces and punctuation — exactly mimicking how a real person composes. Every platform bot-detection passes.' },
  { q:'What platforms does CIC work on?', a:'Alpha.date, Texting Factory, OnlyFans, Fansly, LoyalFans, FanCentro, AdmireMe, FanVue, ManyVids, Unlockd, Emoderators, Cloudworkers, and ChatterApply. General CIC also works on any website.' },
  { q:'What is the Tone Mixer?', a:'Blend two tones — Warm + Mysterious, Flirty + Vulnerable, Bold + Humorous. The AI generates replies that are genuinely hybrid, not just one tone with a dash of the other. Replies no other chatter will be sending.' },
  { q:'Can I use it on more than one device?', a:'By default one active session per account. Contact admin to enable multi-device access.' },
  { q:'What is the colour tier system for Emoderators?', a:'Emoderators assigns subscribers colour tiers (yellow, green, blue, etc.) based on activity and spend. CIC detects the tier automatically and adjusts reply strategy — higher tiers get more investment, lower tiers get qualification replies.' },
  { q:'How do I pay?', a:'M-Pesa, Visa, Mastercard, PayPal, USDT, BTC, ETH, and bank transfer. Available in every country. Click Upgrade in the extension — admin contacts you within minutes.' },
]

export default function Dashboard() {
  const [sec, setSec] = useState<Sec>('demo')
  const [openQA, setOpenQA] = useState<number|null>(null)
  const [guideTab, setGuideTab] = useState('cat1')
  const [simView, setSimView] = useState<'live'|'video'>('live')
  const [copiedScript, setCopiedScript] = useState<number|null>(null)

  // Demo
  const [demoStep, setDemoStep] = useState<'idle'|'scanning'|'generating'|'replies'|'typing'|'done'>('idle')
  const [selReply, setSelReply] = useState<number|null>(null)
  const [typedTxt, setTypedTxt] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [demoMsg, setDemoMsg] = useState("Hey, been thinking about you all day honestly. What have you been up to?")

  // Agent
  const [agMsg, setAgMsg] = useState('')
  const [agTone, setAgTone] = useState('Warm and genuine')
  const [agPlat, setAgPlat] = useState('onlyfans')
  const [agReplies, setAgReplies] = useState<typeof DEMO_REPLIES>([])
  const [agLoading, setAgLoading] = useState(false)
  const [agCopied, setAgCopied] = useState<number|null>(null)

  // Reactivation
  const [reMsg, setReMsg] = useState('')
  const [reLoading, setReLoading] = useState(false)
  const [reReplies, setReReplies] = useState<{tone:string,text:string}[]>([])

  // Opener
  const [opPlat, setOpPlat] = useState('emoderators')
  const [opTier, setOpTier] = useState('yellow')
  const [opContext, setOpContext] = useState('')
  const [opLoading, setOpLoading] = useState(false)
  const [opReplies, setOpReplies] = useState<{tone:string,text:string}[]>([])

  // Typing sim
  const [simText, setSimText] = useState("That actually made me smile. I've had one of those days where everything felt rushed — knowing someone was thinking about me changes the whole energy of it.")
  const [simWPM, setSimWPM] = useState(65)
  const [simOut, setSimOut] = useState('')
  const [simRunning, setSimRunning] = useState(false)
  const [simChars, setSimChars] = useState(0)
  const [simTime, setSimTime] = useState('0.0s')

  // Tone mixer
  const [tone1, setTone1] = useState('Warm')
  const [tone2, setTone2] = useState('Mysterious')
  const [mixMsg, setMixMsg] = useState('')
  const [mixLoading, setMixLoading] = useState(false)
  const [mixReplies, setMixReplies] = useState<{tone:string,text:string}[]>([])

  // PPV
  const [ppvAngle, setPpvAngle] = useState('exclusivity')
  const [ppvLoading, setPpvLoading] = useState(false)
  const [ppvReplies, setPpvReplies] = useState<{tone:string,text:string}[]>([])

  // Earnings
  const [earnShifts, setEarnShifts] = useState(4)
  const [earnHours, setEarnHours] = useState(6)
  const [earnRate, setEarnRate] = useState(8)
  const earnBoost = Math.round(earnShifts * earnHours * earnRate * 4.3 * 0.6)

  const sleep = (ms:number) => new Promise(r=>setTimeout(r,ms))

  async function runDemo() {
    setDemoStep('scanning'); setSelReply(null); setTypedTxt(''); setIsTyping(false)
    await sleep(1200); setDemoStep('generating')
    await sleep(1600); setDemoStep('replies')
  }

  async function typeReply(idx:number) {
    setSelReply(idx); setDemoStep('typing')
    const text = DEMO_REPLIES[idx].text
    setTypedTxt(''); setIsTyping(true)
    for (let i=0;i<text.length;i++) {
      await sleep(28+Math.random()*75+(text[i]===' '?25:0)+(text[i]==='.'?70:0))
      setTypedTxt(text.slice(0,i+1))
    }
    setIsTyping(false); setDemoStep('done')
  }

  async function generateReplies(setLoading:any, setReplies:any, customReplies?:any[]) {
    setLoading(true); setReplies([])
    await sleep(1400+Math.random()*700)
    setReplies(customReplies || DEMO_REPLIES)
    setLoading(false)
  }

  async function startSim() {
    if (simRunning || !simText.trim()) return
    setSimRunning(true); setSimOut(''); setSimChars(0); setSimTime('0.0s')
    const t0 = Date.now()
    const mpc = Math.round(60000/simWPM/5)
    const timer = setInterval(()=>setSimTime(((Date.now()-t0)/1000).toFixed(1)+'s'),100)
    for (let i=0;i<simText.length;i++) {
      await sleep(mpc*(0.4+Math.random()*1.6)+(simText[i]===' '?Math.random()*40:0)+('.,!?'.includes(simText[i])?Math.random()*80:0))
      setSimOut(simText.slice(0,i+1)); setSimChars(i+1)
    }
    clearInterval(timer); setSimRunning(false)
  }

  function copyScript(text:string, idx:number) {
    navigator.clipboard.writeText(text)
    setCopiedScript(idx); setTimeout(()=>setCopiedScript(null),1500)
  }

  const NAV = [
    {id:'demo',icon:'◈',label:'Live Demo',group:'Main'},
    {id:'agent',icon:'🤖',label:'Chat Agent',group:'Main'},
    {id:'reactivation',icon:'⚡',label:'Reactivation',group:'Main'},
    {id:'opener',icon:'🚀',label:'Opener Generator',group:'Main'},
    {id:'typing',icon:'⌨',label:'Typing Simulator',group:'Tools'},
    {id:'photo',icon:'📸',label:'Photo Compliments',group:'Tools'},
    {id:'tone-mixer',icon:'👑',label:'Tone Mixer',group:'Tools',badge:'new'},
    {id:'ppv',icon:'💰',label:'PPV Builder',group:'Tools',badge:'pro'},
    {id:'scripts',icon:'📖',label:'Scripts Library',group:'Tools'},
    {id:'earnings',icon:'📊',label:'Earnings Tracker',group:'Tools',badge:'new'},
    {id:'alphadate',icon:'🌐',label:'Alpha.date Guide',group:'Learn'},
    {id:'tf-guide',icon:'💬',label:'TF Guide',group:'Learn'},
    {id:'qa',icon:'❓',label:'Q & A',group:'Learn'},
    {id:'compare',icon:'⚖',label:'Why CIC',group:'Learn'},
    {id:'extensions',icon:'🔌',label:'Extensions',group:'Downloads'},
    {id:'install',icon:'📦',label:'Install Guide',group:'Downloads'},
    {id:'analytics',icon:'📈',label:'Analytics',group:'Account'},
    {id:'billing',icon:'💳',label:'Billing',group:'Account'},
  ]
  const groups = [...new Set(NAV.map(n=>n.group))]

  const WinBar = ({title,tag}:{title:string,tag:string}) => (
    <div className="win-bar">
      <div className="win-dots">
        <div className="win-dot" style={{background:'#FF5F57'}}/>
        <div className="win-dot" style={{background:'#FEBC2E'}}/>
        <div className="win-dot" style={{background:'#28C840'}}/>
      </div>
      <div className="win-title">{title}</div>
      <div className="win-tag">{tag}</div>
    </div>
  )

  const EmptyState = ({icon,text}:{icon:string,text:string}) => (
    <div style={{textAlign:'center',padding:'40px 20px',color:'var(--t3)',fontSize:13}}>
      <div style={{fontSize:32,marginBottom:10}}>{icon}</div>{text}
    </div>
  )

  return (
    <>
      <style>{CSS}</style>
      <div className="orb orb-1"/><div className="orb orb-2"/>

      <div className="workspace">
        {/* TOPBAR */}
        <header className="topbar">
          <div>
            <div className="brand">Chatter's Inner Circle</div>
            <div className="brand-sub">AI Reply Engine</div>
          </div>
          <div className="topbar-div"/>
          <div className="status-pill"><div className="dot"/>AI Active</div>
          <div className="topbar-div"/>
          <div className="status-pill"><div className="dot"/>Extension Connected</div>
          <div className="tb-right">
            <div className="plan-chip">👑 Pro</div>
            <button className="btn btn-ghost btn-sm" onClick={()=>setSec('billing')}>Upgrade</button>
            <a href={LANDING} className="btn btn-p btn-sm" style={{textDecoration:'none'}}>+ New Operator</a>
          </div>
        </header>

        {/* SIDEBAR */}
        <nav className="sidebar">
          {groups.map(g=>(
            <div key={g}>
              <div className="sb-group">{g}</div>
              {NAV.filter(n=>n.group===g).map(item=>(
                <div key={item.id} className={`sb-item ${sec===item.id?'active':''}`} onClick={()=>setSec(item.id as Sec)}>
                  <span className="sb-icon">{item.icon}</span>
                  <span>{item.label}</span>
                  {item.badge==='new'&&<span className="sb-badge new">NEW</span>}
                  {item.badge==='pro'&&<span className="sb-badge pro">PRO</span>}
                </div>
              ))}
            </div>
          ))}
          <div className="sb-bottom">
            <div style={{marginBottom:4}}>Extension v1.6.5</div>
            <a href="mailto:whwva47@gmail.com" style={{color:'var(--t3)',textDecoration:'none'}}>whwva47@gmail.com</a>
          </div>
        </nav>

        {/* MAIN */}
        <main className="main">

          {/* ══ LIVE DEMO ══ */}
          {sec==='demo'&&(
            <div className="win">
              <WinBar title="Extension Live Demo" tag="Simulated Operator Workflow"/>
              <div className="win-body">
                <div className="g2" style={{gap:20}}>
                  <div>
                    <div style={{fontSize:10,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:10,fontWeight:700}}>Platform Chat Window</div>
                    <div className="chat-area">
                      <div className="msg">
                        <div className="avatar" style={{background:'var(--bg3)',color:'var(--t3)'}}>👤</div>
                        <div className="bubble in">{demoMsg}</div>
                      </div>
                      {(demoStep==='typing'||demoStep==='done')&&(
                        <div className="msg out">
                          <div className="bubble out">{typedTxt}{isTyping&&<span className="cursor"/>}</div>
                          <div className="avatar" style={{background:'linear-gradient(135deg,var(--p),var(--g))'}}>CIC</div>
                        </div>
                      )}
                    </div>
                    <div style={{marginBottom:10}}>
                      <label className="lbl">His message</label>
                      <input className="inp" value={demoMsg} onChange={e=>setDemoMsg(e.target.value)}/>
                    </div>
                    <div style={{display:'flex',gap:8}}>
                      <button className="btn btn-p" onClick={runDemo} disabled={demoStep==='scanning'||demoStep==='generating'}>
                        {demoStep==='scanning'?<><span className="spin"/> Scanning...</>:demoStep==='generating'?<><span className="spin"/> Generating...</>:'✦ Generate Replies'}
                      </button>
                      {demoStep==='done'&&<button className="btn btn-ghost btn-sm" onClick={()=>{setDemoStep('idle');setTypedTxt('');setSelReply(null)}}>↺ Reset</button>}
                    </div>
                  </div>
                  <div>
                    <div style={{fontSize:10,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:10,fontWeight:700}}>CIC Extension Popup</div>
                    <div className="popup">
                      <div className="popup-head">
                        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:3}}>
                          <div style={{width:20,height:20,background:'linear-gradient(135deg,var(--p),var(--g))',borderRadius:5,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10}}>✦</div>
                          <div className="popup-brand">CIC Assistant</div>
                          <div style={{marginLeft:'auto',fontSize:9,color:'var(--ok)',display:'flex',alignItems:'center',gap:4}}><div className="dot" style={{width:4,height:4}}/>AI Active</div>
                        </div>
                        <div style={{fontSize:10,color:demoStep==='scanning'?'var(--warn)':demoStep==='generating'?'var(--pll)':demoStep==='replies'||demoStep==='typing'||demoStep==='done'?'var(--ok)':'var(--t3)'}}>
                          {demoStep==='idle'?'Ready. Click Generate to see replies.':demoStep==='scanning'?'Scanning chat window...':demoStep==='generating'?'Generating 4 replies...':'4 replies ready — click one to type it'}
                        </div>
                      </div>
                      <div className="popup-body">
                        {(demoStep==='idle'||demoStep==='scanning'||demoStep==='generating')&&(
                          <button className={`btn btn-full btn-sm ${demoStep!=='idle'?'btn-muted':''}`} disabled={demoStep!=='idle'}>
                            {demoStep==='scanning'?'Scanning...':demoStep==='generating'?'Generating...':'Scan Page'}
                          </button>
                        )}
                        {(demoStep==='replies'||demoStep==='typing'||demoStep==='done')&&(
                          <>
                            {DEMO_REPLIES.map((r,i)=>(
                              <div key={i} className={`rc ${selReply===i?'sel':''}`}
                                onClick={()=>demoStep==='replies'?typeReply(i):undefined}
                                style={{cursor:demoStep==='replies'?'pointer':'default'}}>
                                <div className="rc-tone">{r.tone}</div>
                                <div className="rc-text">{r.text.slice(0,55)}...</div>
                              </div>
                            ))}
                            <button className={`btn btn-full btn-sm ${demoStep!=='replies'?'btn-muted':'btn-g'}`} disabled={demoStep!=='replies'}>
                              {demoStep==='typing'?'Typing...':demoStep==='done'?'✓ Sent':'Click a reply above to type it'}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="g3" style={{marginTop:16}}>
                  {[{val:'60%',lbl:'Higher response rate',pct:60,c:'var(--ok)'},{val:'2 sec',lbl:'Reply generation',pct:95,c:'var(--gl)'},{val:'2,401',lbl:'Active operators',pct:70,c:'var(--pll)'}].map(s=>(
                    <div key={s.lbl} className="stat">
                      <div className="stat-val" style={{color:s.c}}>{s.val}</div>
                      <div className="stat-lbl">{s.lbl}</div>
                      <div className="prog"><div className="prog-fill" style={{width:s.pct+'%'}}/></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ══ CHAT AGENT ══ */}
          {sec==='agent'&&(
            <div className="win">
              <WinBar title="Chat Agent" tag="Generate · Save · Type"/>
              <div className="win-body">
                <div className="g2" style={{gap:20}}>
                  <div>
                    <div style={{marginBottom:11}}>
                      <label className="lbl">Platform</label>
                      <select className="inp" value={agPlat} onChange={e=>setAgPlat(e.target.value)}>
                        <option value="onlyfans">OnlyFans</option>
                        <option value="emoderators">Emoderators</option>
                        <option value="cloudworkers">Cloudworkers</option>
                        <option value="chathomebase">Texting Factory</option>
                        <option value="alphadate">Alpha.date</option>
                        <option value="fansly">Fansly</option>
                        <option value="chatterapply">ChatterApply</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div style={{marginBottom:11}}>
                      <label className="lbl">His message</label>
                      <textarea className="inp" style={{minHeight:80}} value={agMsg} onChange={e=>setAgMsg(e.target.value)} placeholder="Paste his last message..."/>
                    </div>
                    <div style={{marginBottom:14}}>
                      <label className="lbl">Reply tone</label>
                      <select className="inp" value={agTone} onChange={e=>setAgTone(e.target.value)}>
                        <option>Warm and genuine</option>
                        <option>Playful and flirty</option>
                        <option>Mysterious</option>
                        <option>Confident and direct</option>
                        <option>Emotionally deep</option>
                      </select>
                    </div>
                    <div style={{display:'flex',gap:8}}>
                      <button className="btn btn-p" onClick={()=>generateReplies(setAgLoading,setAgReplies)} disabled={agLoading||!agMsg.trim()}>
                        {agLoading?<><span className="spin"/> Generating...</>:'✦ Generate Replies'}
                      </button>
                      {agReplies.length>0&&<button className="btn btn-ghost btn-sm" onClick={()=>{setAgReplies([]);setAgMsg('')}}>Clear</button>}
                    </div>
                  </div>
                  <div>
                    {agReplies.length===0&&!agLoading&&<EmptyState icon="🤖" text="Enter a message and click Generate."/>}
                    {agReplies.map((r,i)=>(
                      <div key={i} className="rc" style={{cursor:'default'}}>
                        <div className="rc-tone">{r.tone}</div>
                        <div className="rc-text">{r.text}</div>
                        <div style={{display:'flex',gap:6,marginTop:8}}>
                          <button className="btn btn-ghost btn-xs" onClick={()=>{navigator.clipboard.writeText(r.text);setAgCopied(i);setTimeout(()=>setAgCopied(null),1500)}}>{agCopied===i?'Copied!':'Copy'}</button>
                          <button className="btn btn-xs" style={{background:'rgba(212,163,0,0.08)',color:'var(--gl)',border:'1px solid rgba(212,163,0,0.2)'}} onClick={()=>{setSimText(r.text);setSec('typing')}}>Type</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══ REACTIVATION ══ */}
          {sec==='reactivation'&&(
            <div className="win">
              <WinBar title="Reactivation Engine" tag="Wake cold subscribers"/>
              <div className="win-body">
                <div style={{background:'rgba(212,163,0,0.05)',border:'1px solid rgba(212,163,0,0.15)',borderRadius:10,padding:11,marginBottom:16,fontSize:12,color:'var(--gl)',lineHeight:1.7}}>
                  Re-engagement triggers follow Alpha.date Cat 1 rules — ALL CAPS hook, 4-7 words, ends with a question.
                </div>
                <div className="g2" style={{gap:16}}>
                  <div>
                    <div style={{marginBottom:11}}>
                      <label className="lbl">Last interaction</label>
                      <textarea className="inp" style={{minHeight:80}} value={reMsg} onChange={e=>setReMsg(e.target.value)} placeholder="Describe what was said or paste his last message..."/>
                    </div>
                    <div style={{marginBottom:11}}>
                      <label className="lbl">How long inactive?</label>
                      <select className="inp">
                        <option>A few hours</option><option>1 day</option><option>2-3 days</option><option>A week</option><option>Over a week</option>
                      </select>
                    </div>
                    <button className="btn btn-g" onClick={()=>generateReplies(setReLoading,setReReplies,[
                      {tone:'Warm re-engage',text:"SOMETHING MADE ME THINK OF YOU and it wasn't a small thing — the specific kind of thought that makes you stop what you're doing. What's been keeping you?"},
                      {tone:'Curious pull-back',text:"MOST PEOPLE WHO GO QUIET EVENTUALLY COME BACK and I have a feeling you're one of those people. What would make you stay this time?"},
                      {tone:'Playful challenge',text:"I GAVE YOU A WEEK and I'm still not convinced you're as interesting as I thought. Last chance — say something that proves me wrong."},
                    ])} disabled={reLoading||!reMsg.trim()}>
                      {reLoading?<><span className="spin"/> Analysing...</>:'⚡ Generate Triggers'}
                    </button>
                  </div>
                  <div>
                    {reReplies.length===0&&!reLoading&&<EmptyState icon="⚡" text="Describe the situation and click Generate."/>}
                    {reReplies.map((r,i)=>(
                      <div key={i} className="rc" style={{cursor:'default'}}>
                        <div className="rc-tone">{r.tone}</div>
                        <div className="rc-text">{r.text}</div>
                        <div style={{display:'flex',gap:6,marginTop:8}}>
                          <button className="btn btn-ghost btn-xs" onClick={()=>navigator.clipboard.writeText(r.text)}>Copy</button>
                          <button className="btn btn-xs btn-ghost" onClick={()=>{setSimText(r.text);setSec('typing')}}>Type</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══ OPENER GENERATOR ══ */}
          {sec==='opener'&&(
            <div className="win">
              <WinBar title="Opener Generator" tag="Compelling first messages"/>
              <div className="win-body">
                <div className="g2" style={{gap:16}}>
                  <div>
                    <div style={{marginBottom:11}}>
                      <label className="lbl">Platform</label>
                      <select className="inp" value={opPlat} onChange={e=>setOpPlat(e.target.value)}>
                        <option value="emoderators">Emoderators</option>
                        <option value="cloudworkers">Cloudworkers</option>
                        <option value="onlyfans">OnlyFans</option>
                        <option value="alphadate">Alpha.date</option>
                        <option value="fansly">Fansly</option>
                      </select>
                    </div>
                    {opPlat==='emoderators'&&(
                      <div style={{marginBottom:11}}>
                        <label className="lbl">Subscriber colour tier</label>
                        <select className="inp" value={opTier} onChange={e=>setOpTier(e.target.value)}>
                          <option value="yellow">🟡 Yellow (new)</option>
                          <option value="green">🟢 Green (engaged)</option>
                          <option value="blue">🔵 Blue (spender)</option>
                          <option value="gold">🟤 Gold (VIP)</option>
                        </select>
                      </div>
                    )}
                    <div style={{marginBottom:14}}>
                      <label className="lbl">Context (optional)</label>
                      <textarea className="inp" style={{minHeight:60}} value={opContext} onChange={e=>setOpContext(e.target.value)} placeholder="Profile details, previous interaction, or what you know about him..."/>
                    </div>
                    <button className="btn btn-p" onClick={()=>generateReplies(setOpLoading,setOpReplies,[
                      {tone:'Bold opener',text:"YOU HAVE A PRESENCE THAT STOPPED ME — not everyone on here has that. The kind that makes you want to know the story behind the person. What's yours?"},
                      {tone:'Warm curiosity',text:"Something about your profile made me stop scrolling. I can't quite place it yet — but I want to. What's the one thing most people get wrong about you?"},
                      {tone:'Playful',text:"I was going to say something clever but honestly I just wanted to see if you're as interesting to talk to as you look. Prove me right?"},
                    ])} disabled={opLoading}>
                      {opLoading?<><span className="spin"/> Generating...</>:'🚀 Generate Openers'}
                    </button>
                  </div>
                  <div>
                    {opReplies.length===0&&!opLoading&&<EmptyState icon="🚀" text="Configure and click Generate Openers."/>}
                    {opReplies.map((r,i)=>(
                      <div key={i} className="rc" style={{cursor:'default'}}>
                        <div className="rc-tone">{r.tone}</div>
                        <div className="rc-text">{r.text}</div>
                        <button className="btn btn-ghost btn-xs" style={{marginTop:8}} onClick={()=>navigator.clipboard.writeText(r.text)}>Copy</button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══ TYPING SIMULATOR ══ */}
          {sec==='typing'&&(
            <div className="win">
              <WinBar title="Typing Simulator" tag="Human-speed · Undetectable"/>
              <div className="win-body">
                <div className="g2" style={{gap:20}}>
                  <div>
                    <div style={{marginBottom:11}}>
                      <label className="lbl">Reply to type</label>
                      <textarea className="inp" style={{minHeight:100}} value={simText} onChange={e=>setSimText(e.target.value)} readOnly={simRunning}/>
                    </div>
                    <div style={{marginBottom:16}}>
                      <label className="lbl" style={{display:'flex',justifyContent:'space-between'}}>
                        <span>Typing speed</span><span style={{color:'var(--gl)',fontWeight:700}}>{simWPM} WPM</span>
                      </label>
                      <input type="range" className="slider" min={20} max={120} value={simWPM} onChange={e=>setSimWPM(+e.target.value)} disabled={simRunning}/>
                      <div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:'var(--t3)',marginTop:3}}>
                        <span>20 WPM · cautious</span><span>120 WPM · lightning</span>
                      </div>
                    </div>
                    <div style={{display:'flex',gap:8}}>
                      <button className="btn btn-p" onClick={startSim} disabled={simRunning||!simText.trim()}>
                        {simRunning?<><span className="spin"/> Typing...</>:'Start Typing'}
                      </button>
                      <button className="btn btn-ghost btn-sm" disabled={simRunning} onClick={()=>{setSimOut('');setSimChars(0);setSimTime('0.0s')}}>Reset</button>
                    </div>
                    <div className="g3" style={{marginTop:14}}>
                      {[{val:simChars,lbl:'Characters',c:'var(--pll)'},{val:simTime,lbl:'Time',c:'var(--gl)'},{val:simRunning?'Typing':'Ready',lbl:'Status',c:'var(--ok)'}].map(s=>(
                        <div key={s.lbl} className="stat" style={{padding:12}}>
                          <div className="stat-val" style={{fontSize:18,color:s.c}}>{s.val}</div>
                          <div className="stat-lbl">{s.lbl}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div style={{display:'flex',gap:7,marginBottom:11}}>
                      <button className={`tab ${simView==='live'?'on':''}`} onClick={()=>setSimView('live')}>Live Preview</button>
                      <button className={`tab ${simView==='video'?'on':''}`} onClick={()=>setSimView('video')}>Video Demo</button>
                    </div>
                    {simView==='live'&&(
                      <>
                        <div style={{background:'rgba(0,0,0,0.4)',border:'1px solid var(--bd)',borderRadius:10,padding:14,fontSize:13,color:'var(--t1)',lineHeight:1.7,minHeight:80,marginBottom:12}}>
                          {simOut||<span style={{color:'var(--t3)',fontStyle:'italic'}}>Preview will appear here...</span>}
                          {simRunning&&<span className="cursor"/>}
                        </div>
                        <div className="card">
                          <div style={{fontFamily:'var(--serif)',fontSize:13,color:'var(--gl)',marginBottom:10}}>Why it is undetectable</div>
                          {['Randomised delays 40–200ms between keystrokes','Natural thinking pauses mid-sentence','Adjustable 20–120 WPM to match your speed','Stop or edit mid-type — nothing auto-sends'].map(f=>(
                            <div key={f} style={{display:'flex',gap:6,marginBottom:6,fontSize:12,color:'var(--t3)'}}>
                              <span style={{color:'var(--ok)'}}>✓</span>{f}
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                    {simView==='video'&&(
                      <div>
                        <div style={{background:'rgba(0,0,0,0.5)',border:'1px solid var(--bd)',borderRadius:10,overflow:'hidden',marginBottom:10}}>
                          <video controls playsInline style={{width:'100%',display:'block',maxHeight:200}}
                            poster="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='200' viewBox='0 0 400 200'%3E%3Crect width='400' height='200' fill='%23050508'/%3E%3Ccircle cx='200' cy='100' r='24' fill='none' stroke='%237c3aed' stroke-width='2'/%3E%3Cpolygon points='193,89 193,111 214,100' fill='%237c3aed'/%3E%3C/svg%3E">
                            <source src="/typing-demo.mp4" type="video/mp4"/>
                          </video>
                        </div>
                        <div style={{fontSize:12,color:'var(--t3)',padding:'9px 11px',background:'rgba(212,163,0,0.04)',border:'1px solid var(--bd2)',borderRadius:8,lineHeight:1.7}}>
                          Add <code style={{color:'var(--pl)'}}>typing-demo.mp4</code> to <code style={{color:'var(--pl)'}}>public/</code> in the GitHub repo to enable this video.
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══ TONE MIXER ══ */}
          {sec==='tone-mixer'&&(
            <div className="win">
              <WinBar title="Tone Mixer" tag="Dual-tone replies no one else sends"/>
              <div className="win-body">
                <div style={{background:'rgba(212,163,0,0.05)',border:'1px solid rgba(212,163,0,0.15)',borderRadius:10,padding:11,marginBottom:16,fontSize:12,color:'var(--gl)',lineHeight:1.7}}>
                  Blend two tones into a single reply. Warm + Mysterious, Flirty + Vulnerable, Bold + Humorous. Replies no other chatter on the platform will be sending.
                </div>
                <div className="g2" style={{gap:16}}>
                  <div>
                    <div style={{display:'flex',gap:10,marginBottom:11}}>
                      <div style={{flex:1}}>
                        <label className="lbl">First tone</label>
                        <select className="inp" value={tone1} onChange={e=>setTone1(e.target.value)}>
                          {['Warm','Flirty','Bold','Mysterious','Vulnerable','Playful','Direct','Romantic'].map(t=><option key={t}>{t}</option>)}
                        </select>
                      </div>
                      <div style={{display:'flex',alignItems:'flex-end',paddingBottom:10,color:'var(--g)',fontWeight:700,fontSize:16}}>+</div>
                      <div style={{flex:1}}>
                        <label className="lbl">Second tone</label>
                        <select className="inp" value={tone2} onChange={e=>setTone2(e.target.value)}>
                          {['Mysterious','Vulnerable','Humorous','Romantic','Direct','Playful','Warm','Flirty'].map(t=><option key={t}>{t}</option>)}
                        </select>
                      </div>
                    </div>
                    <div style={{marginBottom:14}}>
                      <label className="lbl">His message</label>
                      <textarea className="inp" style={{minHeight:80}} value={mixMsg} onChange={e=>setMixMsg(e.target.value)} placeholder="Paste his message..."/>
                    </div>
                    <button className="btn btn-g" onClick={()=>generateReplies(setMixLoading,setMixReplies,[
                      {tone:`${tone1} + ${tone2} · Light blend`,text:"There's something about the way you said that which makes it genuinely hard to think straight. I want to figure out why — but I also want to keep you curious for a moment longer."},
                      {tone:`${tone1} + ${tone2} · Deep blend`,text:"That landed somewhere unexpected. I don't know if it was what you said or how you said it — but I'd like to understand you better. Tell me more."},
                      {tone:`${tone1} + ${tone2} · Bold blend`,text:"You say things like that as if you don't already know exactly what effect they have. I'm genuinely intrigued. What's actually going on with you today?"},
                    ])} disabled={mixLoading||!mixMsg.trim()}>
                      {mixLoading?<><span className="spin"/> Mixing...</>:'👑 Mix Tones'}
                    </button>
                  </div>
                  <div>
                    {mixReplies.length===0&&!mixLoading&&<EmptyState icon="👑" text="Select two tones, enter his message, and mix."/>}
                    {mixReplies.map((r,i)=>(
                      <div key={i} className="rc" style={{cursor:'default'}}>
                        <div className="rc-tone">{r.tone}</div>
                        <div className="rc-text">{r.text}</div>
                        <button className="btn btn-ghost btn-xs" style={{marginTop:8}} onClick={()=>navigator.clipboard.writeText(r.text)}>Copy</button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══ PPV BUILDER ══ */}
          {sec==='ppv'&&(
            <div className="win">
              <WinBar title="PPV Upsell Builder" tag="Convert fans into buyers"/>
              <div className="win-body">
                <div className="g2" style={{gap:16}}>
                  <div>
                    <div style={{marginBottom:14}}>
                      <label className="lbl">Upsell angle</label>
                      {['exclusivity','tease','direct','loyalty','curiosity'].map(a=>(
                        <button key={a} onClick={()=>setPpvAngle(a)}
                          className="btn btn-sm" style={{margin:'0 6px 6px 0',
                          background:ppvAngle===a?'linear-gradient(135deg,var(--p),var(--g))':'rgba(255,255,255,0.04)',
                          color:ppvAngle===a?'#fff':'var(--t3)',
                          border:`1px solid ${ppvAngle===a?'transparent':'var(--bd)'}`,
                          textTransform:'capitalize'}}>
                          {a}
                        </button>
                      ))}
                    </div>
                    <button className="btn btn-p" onClick={()=>generateReplies(setPpvLoading,setPpvReplies,[
                      {tone:'Exclusivity angle',text:"I made something I'm only sending to a few people — the ones who actually talk to me properly. You qualify. Want to see it before everyone else does?"},
                      {tone:'Tease angle',text:"There's something in my vault that I think about when we talk. I've been selective about who gets to see it. You've been on my mind. Interested?"},
                      {tone:'Loyalty angle',text:"I do something special for people who show up consistently — and you have. I want to send you something that's not available anywhere else. Say the word."},
                    ])} disabled={ppvLoading}>
                      {ppvLoading?<><span className="spin"/> Building...</>:'💰 Build PPV Message'}
                    </button>
                  </div>
                  <div>
                    {ppvReplies.length===0&&!ppvLoading&&<EmptyState icon="💰" text="Choose an angle and click Build PPV Message."/>}
                    {ppvReplies.map((r,i)=>(
                      <div key={i} className="rc" style={{cursor:'default'}}>
                        <div className="rc-tone">{r.tone}</div>
                        <div className="rc-text">{r.text}</div>
                        <button className="btn btn-ghost btn-xs" style={{marginTop:8}} onClick={()=>navigator.clipboard.writeText(r.text)}>Copy</button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══ SCRIPTS LIBRARY ══ */}
          {sec==='scripts'&&(
            <div className="win">
              <WinBar title="Scripts Library" tag="60+ situation scripts"/>
              <div className="win-body">
                <div className="g2" style={{gap:12}}>
                  {SCRIPTS.map((s,i)=>(
                    <div key={i} className="script-card" onClick={()=>copyScript(s.text,i)}>
                      <div className="script-tag">{s.tag}</div>
                      <div style={{fontFamily:'var(--serif)',fontSize:13,fontWeight:600,marginBottom:7,color:'var(--t1)'}}>{s.title}</div>
                      <div style={{fontSize:11.5,color:'var(--t3)',lineHeight:1.6,marginBottom:10}}>{s.text.slice(0,100)}...</div>
                      <button className="btn btn-ghost btn-xs">{copiedScript===i?'✓ Copied':'Click to copy'}</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ══ EARNINGS TRACKER ══ */}
          {sec==='earnings'&&(
            <div className="win">
              <WinBar title="Earnings Tracker" tag="See your boost live"/>
              <div className="win-body">
                <div className="g2" style={{gap:20}}>
                  <div>
                    <div className="card" style={{marginBottom:14,textAlign:'center'}}>
                      <div style={{fontSize:11,color:'var(--t3)',marginBottom:6}}>Estimated monthly boost with CIC</div>
                      <div className="earn-num">${earnBoost.toLocaleString()}</div>
                      <div style={{fontSize:11,color:'var(--t3)',marginTop:4}}>vs your subscription cost</div>
                    </div>
                    {[
                      {label:'Shifts per week',val:earnShifts,set:setEarnShifts,min:1,max:7},
                      {label:'Hours per shift',val:earnHours,set:setEarnHours,min:1,max:12},
                      {label:'Hourly rate (USD)',val:earnRate,set:setEarnRate,min:4,max:30},
                    ].map(s=>(
                      <div key={s.label} style={{marginBottom:14}}>
                        <label className="lbl" style={{display:'flex',justifyContent:'space-between'}}>
                          <span>{s.label}</span><span style={{color:'var(--gl)',fontWeight:700}}>{s.label.includes('USD')?'$':''}{s.val}{s.label.includes('week')||s.label.includes('shift')?'':''}</span>
                        </label>
                        <input type="range" className="slider" min={s.min} max={s.max} value={s.val} onChange={e=>s.set(+e.target.value)}/>
                      </div>
                    ))}
                  </div>
                  <div>
                    <div className="card card-g" style={{marginBottom:12,padding:20}}>
                      <div style={{fontFamily:'var(--serif)',fontSize:14,color:'var(--gl)',marginBottom:14}}>Member results</div>
                      {[
                        {name:'Aisha W.',platform:'Emoderators · Nairobi',result:'+$347/month',quote:'The Emoderators colour scripts alone paid for months of subscription.'},
                        {name:'Marco R.',platform:'OnlyFans · Madrid',result:'+$289/month',quote:'Reactivation messages are witchcraft — guys who hadn\'t responded in a week came back in minutes.'},
                        {name:'Sophia N.',platform:'Cloudworkers · Toronto',result:'+$412/month',quote:'The typing sim is pure genius. Platforms never flagged me once.'},
                      ].map((m,i)=>(
                        <div key={i} style={{padding:'10px 0',borderBottom:i<2?'1px solid var(--bd)':'none'}}>
                          <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                            <div style={{fontWeight:600,fontSize:12}}>{m.name} <span style={{color:'var(--t3)',fontWeight:400}}>· {m.platform}</span></div>
                            <div style={{color:'var(--ok)',fontWeight:700,fontSize:12}}>{m.result}</div>
                          </div>
                          <div style={{fontSize:11,color:'var(--t3)',lineHeight:1.6,fontStyle:'italic'}}>"{m.quote}"</div>
                        </div>
                      ))}
                    </div>
                    <div className="card" style={{textAlign:'center'}}>
                      <div style={{fontSize:12,color:'var(--t3)',marginBottom:10}}>Members report an average of <strong style={{color:'var(--ok)'}}>$347 extra per month</strong> with CIC Pro</div>
                      <button className="btn btn-p btn-sm" onClick={()=>setSec('billing')}>Upgrade to Pro</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══ WHY CIC / COMPARE ══ */}
          {sec==='compare'&&(
            <div className="win">
              <WinBar title="Why CIC Pro" tag="No competitor comes close"/>
              <div className="win-body">
                <table className="cmp-table">
                  <thead>
                    <tr>
                      <th>Feature</th>
                      <th>Generic AI</th>
                      <th>Other tools</th>
                      <th style={{color:'var(--gl)'}}>✦ CIC Pro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['Platform-specific scripts (OF, EM, CW, TF)','✕','✕','✓'],
                      ['Available globally — no country restrictions','Partial','✕','✓'],
                      ['Human typing simulation (undetectable)','✕','✕','✓'],
                      ['M-Pesa + Card + PayPal + Crypto payments','✕','✕','✓'],
                      ['Colour-tier awareness (Emoderators)','✕','✕','✓'],
                      ['Tone Mixer — dual-tone replies','✕','✕','✓'],
                      ['PPV Upsell Builder','✕','Partial','✓'],
                      ['Earnings Tracker + ROI calculator','✕','✕','✓'],
                      ['Chrome extension — types in-platform','✕','✕','✓'],
                      ['Opener Generator (platform-aware)','✕','✕','✓'],
                      ['60+ situation scripts','✕','✕','✓'],
                      ['Referral programme','✕','✕','✓'],
                    ].map(([f,a,b,c],i)=>(
                      <tr key={i}>
                        <td style={{color:'var(--t1)',fontWeight:500}}>{f}</td>
                        <td className="no-col">{a}</td>
                        <td className="no-col">{b}</td>
                        <td className={c==='✓'?'cic-col':'no-col'}>{c}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{marginTop:20,textAlign:'center'}}>
                  <button className="btn btn-p" onClick={()=>setSec('billing')}>Get Pro Now →</button>
                </div>
              </div>
            </div>
          )}

          {/* ══ ALPHA.DATE GUIDE ══ */}
          {sec==='alphadate'&&(
            <div className="win">
              <WinBar title="Alpha.date Operator Guide" tag="Three categories · Hook rules"/>
              <div className="win-body">
                <div className="card card-g" style={{marginBottom:14}}>
                  <div style={{fontFamily:'var(--serif)',fontSize:13,color:'var(--gl)',marginBottom:5}}>The Golden Hook Rule</div>
                  <div style={{fontSize:12.5,color:'var(--t2)',lineHeight:1.75}}>Every message must start with a hook in <strong style={{color:'var(--t1)'}}>ALL CAPITAL LETTERS</strong>. 4-7 words. No punctuation at the end. Never repeat the same hook.</div>
                </div>
                <div style={{display:'flex',gap:6,flexWrap:'wrap' as const,marginBottom:14}}>
                  {[['cat1','Category 1 — Outreach'],['cat2','Category 2 — Replies'],['cat3','Category 3 — Bulk'],['rules','Absolute Rules']].map(([id,lbl])=>(
                    <button key={id} className={`tab ${guideTab===id?'on':''}`} onClick={()=>setGuideTab(id)}>{lbl}</button>
                  ))}
                </div>
                {guideTab==='cat1'&&(
                  <>
                    <div style={{fontSize:12,color:'var(--t3)',marginBottom:10,lineHeight:1.6}}>Use on /chance page — winks, likes, views, first messages, letters. Men aged 40-80 from Australia, USA, Canada, UK.</div>
                    {[['var(--pll)','He sent a wink','DJ, THAT WINK WAS JUST THE BEGINNING and I have a feeling you already know what comes next. What made you stop on my profile?'],
                      ['var(--gl)','He liked your profile','Robert, MOST PEOPLE SCROLL PAST WITHOUT STOPPING and I noticed you did not. What caught your attention?'],
                      ['var(--ok)','Letter (max 300 chars, one paragraph)','YOU HAVE A PRESENCE THAT STAYS WITH YOU and I mean that in the rarest way — the kind that lingers hours after you first noticed it. What has shaped you most?']
                    ].map(([color,lbl,ex])=>(
                      <div key={String(lbl)} className="ex"><div className="ex-lbl" style={{color:String(color)}}>{lbl}</div><div className="ex-txt">{ex}</div></div>
                    ))}
                  </>
                )}
                {guideTab==='cat2'&&(
                  <>
                    <div style={{background:'rgba(52,211,153,0.06)',border:'1px solid rgba(52,211,153,0.15)',borderRadius:8,padding:'9px 12px',marginBottom:10,fontSize:12,color:'var(--ok)'}}>ONE SENTENCE ONLY. 15-25 words maximum. No emojis. Match his tone exactly.</div>
                    {[['Romantic','There is something about the way you said that which makes it genuinely hard to think about anything else right now.'],
                      ['Playful','You say that like you haven\'t already thought about exactly what happens next, which I am fairly certain you have.'],
                      ['Flirtatious/naughty','Match his energy. If he is being suggestive, be suggestive back. These are 18+ adults on a dating site.'],
                      ['He went silent','Life has a way of getting loud sometimes and I hope yours has been the good kind of busy since we last spoke.']
                    ].map(([lbl,ex])=>(
                      <div key={String(lbl)} className="ex"><div className="ex-lbl" style={{color:'var(--ok)'}}>{lbl}</div><div className="ex-txt">{ex}</div></div>
                    ))}
                  </>
                )}
                {guideTab==='cat3'&&(
                  <>
                    <div style={{fontSize:12,color:'var(--t3)',marginBottom:10,lineHeight:1.6}}>Under 20 words. ~40% ALL CAPS hooks. <strong style={{color:'var(--gl)'}}>Emojis allowed.</strong> Vary topics widely.</div>
                    {['THE WORLD SHRANK WHEN YOU STARTED TRAVELLING — what was the first place that genuinely changed how you think?',
                      'If you could only keep one morning habit forever, what would it be? ☕',
                      'LATE NIGHT THOUGHTS HIT DIFFERENTLY — what is the last thing you thought about before sleep? 💭'].map((ex,i)=>(
                      <div key={i} className="ex"><div className="ex-txt" style={{color:'var(--gl)'}}>{ex}</div></div>
                    ))}
                  </>
                )}
                {guideTab==='rules'&&(
                  ['Never repeat the same message or letter.',
                    'Never reuse the same opening hook.',
                    'Never mention AI.',
                    'No pressure or desperation in Cat 1 or Cat 3.',
                    'Always proofread before sending.',
                    'No emojis in Category 1 or Category 2.',
                    'Match his energy on flirtation and explicitness — these are 18+ adults.',
                  ].map((r,i)=>(
                    <div key={i} style={{display:'flex',gap:9,padding:'9px 0',borderBottom:'1px solid var(--bd)',fontSize:12.5,color:'var(--t2)',lineHeight:1.6}}>
                      <span style={{color:'var(--err)',flexShrink:0}}>✕</span>{r}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ══ TF GUIDE ══ */}
          {sec==='tf-guide'&&(
            <div className="win">
              <WinBar title="Texting Factory Guide" tag="chathomebase.com operators"/>
              <div className="win-body">
                <div className="card card-g">
                  <div style={{fontFamily:'var(--serif)',fontSize:13,color:'var(--gl)',marginBottom:12}}>Non-negotiable rules</div>
                  {[['75-300','Characters per reply — under 75 rejected, over 350 cut off. Target 120-250.'],
                    ['+','Always end with a CTA — a question, invitation, or hook.'],
                    ['18+','Standard chats: match his energy fully. If naughty, be naughty back. These are adults.'],
                    ['GREEN','Green chats only: keep it romantic and clean. Deflect explicit with playful confidence — never reject.'],
                    ['✕','Never suggest meeting in person.'],
                    ['✕','Never share contact info — no phone, WhatsApp, Instagram, Snapchat, email.'],
                    ['✕','No emojis — Texting Factory flags emoji use.'],
                    ['✕','Never mention the platform name or that you are an operator.'],
                  ].map(([icon,rule])=>(
                    <div key={String(rule)} style={{display:'flex',gap:10,padding:'9px 0',borderBottom:'1px solid rgba(212,163,0,0.08)',fontSize:12.5,color:'var(--t2)',lineHeight:1.6,alignItems:'flex-start'}}>
                      <span style={{color:String(icon)==='✕'?'var(--err)':String(icon)==='+'?'var(--ok)':String(icon)==='18+'?'var(--pll)':String(icon)==='GREEN'?'var(--ok)':'var(--gl)',flexShrink:0,fontWeight:700,minWidth:36}}>{icon}</span>{rule}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ══ Q&A ══ */}
          {sec==='qa'&&(
            <div className="win">
              <WinBar title="Q & A" tag="Common operator questions"/>
              <div className="win-body">
                {QA.map((item,i)=>(
                  <div key={i} className="qa">
                    <div className={`qa-q ${openQA===i?'on':''}`} onClick={()=>setOpenQA(openQA===i?null:i)}>
                      {item.q}<span style={{color:'var(--t3)',marginLeft:8,flexShrink:0,fontSize:11}}>{openQA===i?'▲':'▼'}</span>
                    </div>
                    <div className={`qa-a ${openQA===i?'on':''}`}>{item.a}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ══ EXTENSIONS ══ */}
          {sec==='extensions'&&(
            <div className="win">
              <WinBar title="Extension Installation Center" tag="Chrome Web Store"/>
              <div className="win-body">
                <div className="g2" style={{gap:16,marginBottom:16}}>
                  {[
                    {icon:'💬',name:'CIC — Texting Factory',ver:'v1.6.5',url:EXT_TF,
                      desc:'For chathomebase.com operators. Enforces 75-300 char rule, human-speed typing, session lock.',
                      features:['Auto-reads chat messages','75-300 char rule enforced','Human-speed typing','Session lock security']},
                    {icon:'🌐',name:'General CIC',ver:'v2.0.1',url:EXT_GEN,
                      desc:'For Alpha.date, OnlyFans, Fansly, Emoderators, Cloudworkers, ChatterApply and more.',
                      features:['Alpha.date cat 1/2/3 system','Photo compliment detection','Colour-tier detection','Any-website mode']},
                  ].map(e=>(
                    <div key={e.name} className="card card-p" style={{display:'flex',flexDirection:'column',gap:11}}>
                      <div style={{display:'flex',gap:11,alignItems:'center'}}>
                        <div style={{width:44,height:44,background:'linear-gradient(135deg,var(--p),var(--g))',borderRadius:12,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,flexShrink:0}}>{e.icon}</div>
                        <div>
                          <div style={{fontFamily:'var(--serif)',fontSize:13,fontWeight:700}}>{e.name}</div>
                          <div style={{fontSize:10,color:'var(--t3)'}}>{e.ver} — Latest</div>
                        </div>
                      </div>
                      <div style={{fontSize:12,color:'var(--t3)',lineHeight:1.65}}>{e.desc}</div>
                      {e.features.map(f=><div key={f} style={{display:'flex',gap:6,fontSize:11.5,color:'var(--t3)'}}><span style={{color:'var(--ok)'}}>+</span>{f}</div>)}
                      <a href={e.url} target="_blank" rel="noreferrer" className="btn btn-p btn-full btn-sm" style={{textDecoration:'none',display:'flex',marginTop:4}}>Install from Chrome Store</a>
                      <button className="btn btn-ghost btn-full btn-sm" onClick={()=>setSec('install')}>View Install Guide</button>
                    </div>
                  ))}
                </div>
                <div className="card card-g">
                  <div style={{fontFamily:'var(--serif)',fontSize:13,color:'var(--gl)',marginBottom:8}}>Version History</div>
                  {[['v2.0.1','Latest','Iframe support, all-site CORS fix, ChatterApply typing test'],
                    ['v1.6.5','Previous','Regex fix, service worker keepalive, faster responses'],
                    ['v1.5.1','Legacy','Session token security. Update immediately.']
                  ].map(([ver,tag,desc])=>(
                    <div key={ver} style={{display:'flex',gap:11,padding:'8px 0',borderBottom:'1px solid rgba(212,163,0,0.07)',fontSize:12}}>
                      <div style={{flexShrink:0,width:52}}>
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

          {/* ══ INSTALL GUIDE ══ */}
          {sec==='install'&&(
            <div className="win">
              <WinBar title="Install Guide" tag="3 steps to get started"/>
              <div className="win-body">
                <div className="g2" style={{gap:12,marginBottom:16}}>
                  {[{icon:'💬',name:'CIC — Texting Factory',url:EXT_TF},{icon:'🌐',name:'General CIC',url:EXT_GEN}].map(e=>(
                    <a key={e.name} href={e.url} target="_blank" rel="noreferrer" className="btn btn-p btn-full" style={{textDecoration:'none',display:'flex',padding:13}}>
                      {e.icon} Install {e.name}
                    </a>
                  ))}
                </div>
                <div className="card" style={{marginBottom:14}}>
                  {[['Click Install from Chrome Store','Opens the official CIC listing on the Chrome Web Store.'],
                    ['"Add to Chrome"','Chrome installs in seconds. The CIC icon appears in your toolbar.'],
                    ['Click the CIC icon and enter your email','Sign in with your registered email. The extension validates your plan.'],
                    ['You are live','Open any supported platform — CIC panel appears automatically. On other sites click the floating CIC button.'],
                  ].map(([title,desc],i)=>(
                    <div key={i} style={{display:'flex',gap:13,alignItems:'flex-start',marginBottom:i<3?16:0}}>
                      <div style={{width:24,height:24,borderRadius:'50%',background:i===3?'rgba(52,211,153,0.12)':'linear-gradient(135deg,var(--p),var(--g))',border:i===3?'1px solid var(--ok)':'none',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,flexShrink:0,color:i===3?'var(--ok)':'#fff'}}>{i===3?'✓':i+1}</div>
                      <div>
                        <div style={{fontSize:13,fontWeight:600,color:i===3?'var(--ok)':'var(--t1)',marginBottom:3}}>{title}</div>
                        <div style={{fontSize:12,color:'var(--t3)',lineHeight:1.6}}>{desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="card card-g" style={{textAlign:'center'}}>
                  <div style={{fontSize:12.5,color:'var(--t3)',marginBottom:10}}>Already installed? Go to <strong style={{color:'var(--t1)'}}>chrome://extensions</strong> and click Update.</div>
                  <div style={{display:'flex',gap:8,justifyContent:'center'}}>
                    <a href={EXT_TF} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm" style={{textDecoration:'none'}}>TF Extension</a>
                    <a href={EXT_GEN} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm" style={{textDecoration:'none'}}>General CIC</a>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══ ANALYTICS ══ */}
          {sec==='analytics'&&(
            <div className="win">
              <WinBar title="Analytics" tag="Platform-wide stats"/>
              <div className="win-body">
                <div className="g4" style={{marginBottom:16}}>
                  {[{val:'2,401',lbl:'Active Operators',c:'var(--pll)',p:70},{val:'60%',lbl:'Higher Response Rate',c:'var(--ok)',p:60},{val:'2 sec',lbl:'Reply Generation',c:'var(--gl)',p:95},{val:'10+',lbl:'Platforms',c:'var(--pll)',p:100}].map(s=>(
                    <div key={s.lbl} className="stat">
                      <div className="stat-val" style={{color:s.c,fontSize:22}}>{s.val}</div>
                      <div className="stat-lbl">{s.lbl}</div>
                      <div className="prog"><div className="prog-fill" style={{width:s.p+'%'}}/></div>
                    </div>
                  ))}
                </div>
                <div className="card">
                  <div style={{fontFamily:'var(--serif)',fontSize:13,marginBottom:8}}>Your Usage</div>
                  <div style={{fontSize:12.5,color:'var(--t3)',lineHeight:1.7}}>Sign in via the extension to see your personal stats — daily generations, total replies sent, platforms used, and plan status. Usage resets at midnight every day.</div>
                </div>
              </div>
            </div>
          )}

          {/* ══ BILLING ══ */}
          {sec==='billing'&&(
            <div className="win">
              <WinBar title="Billing" tag="Plans · Worldwide payment"/>
              <div className="win-body">
                <div className="g3" style={{marginBottom:16}}>
                  {[
                    {name:'Free Trial',price:'Free',period:'3 days full Pro',color:'var(--ok)',badge:'LIMITED',features:['Full Pro access 3 days','All platforms','Both extensions','No credit card']},
                    {name:'Pro Monthly',price:'$9.99',period:'per month',color:'var(--pl)',badge:'POPULAR',features:['Unlimited replies','Full explicit content','Premium AI quality','Tone Mixer + PPV Builder','60+ scripts','Priority support']},
                    {name:'Pro 3-Month',price:'$24',period:'save $5.97',color:'var(--gl)',badge:'BEST VALUE',features:['Everything in Pro Monthly','3 months continuous','Best value for active chatters','All global payment methods']},
                  ].map(p=>(
                    <div key={p.name} className="card" style={{position:'relative',border:p.name==='Pro Monthly'?'1px solid rgba(168,85,247,0.35)':undefined,boxShadow:p.name==='Pro Monthly'?'0 0 40px rgba(124,58,237,0.08)':undefined}}>
                      {p.badge&&<div style={{position:'absolute',top:11,right:11,background:'linear-gradient(135deg,var(--p),var(--g))',padding:'2px 8px',borderRadius:20,fontSize:8,fontWeight:700,color:'#fff'}}>{p.badge}</div>}
                      <div style={{color:p.color,fontWeight:700,fontSize:12,fontFamily:'var(--serif)',marginBottom:5}}>{p.name}</div>
                      <div style={{fontSize:26,fontWeight:800,marginBottom:2}}>{p.price}</div>
                      <div style={{color:'var(--t3)',fontSize:11,marginBottom:14}}>{p.period}</div>
                      {p.features.map(f=>(
                        <div key={f} style={{display:'flex',gap:6,marginBottom:5,fontSize:11.5,color:'var(--t3)'}}>
                          <span style={{color:p.color,flexShrink:0}}>+</span>{f}
                        </div>
                      ))}
                      <a href={LANDING} className="btn btn-full btn-sm" style={{marginTop:12,textDecoration:'none',display:'flex',background:p.name==='Pro Monthly'?'linear-gradient(135deg,var(--p),var(--g))':p.name==='Pro 3-Month'?'linear-gradient(135deg,var(--g),var(--gl))':'transparent',border:`1px solid ${p.color}`,color:p.name==='Free Trial'?p.color:'#fff'}}>
                        {p.name==='Free Trial'?'Start Free':p.name==='Pro Monthly'?'Get Pro Monthly':'Get 3-Month Deal'}
                      </a>
                    </div>
                  ))}
                </div>
                <div className="card card-g" style={{textAlign:'center'}}>
                  <div style={{fontFamily:'var(--serif)',fontSize:14,color:'var(--gl)',marginBottom:8}}>Pay your way — every country</div>
                  <div style={{fontSize:12.5,color:'var(--t3)',lineHeight:1.7,marginBottom:12}}>
                    📱 M-Pesa · 💳 Visa/Mastercard · 🅿 PayPal · ₿ USDT/BTC/ETH · 🏦 Bank Transfer<br/>
                    Click Upgrade in the extension. Admin contacts you within minutes.
                  </div>
                  <div style={{fontSize:12,color:'var(--t3)'}}>Support: <a href="mailto:whwva47@gmail.com" style={{color:'var(--pl)',textDecoration:'none'}}>whwva47@gmail.com</a></div>
                </div>
              </div>
            </div>
          )}

          {/* ══ PHOTO ══ */}
          {sec==='photo'&&(
            <div className="win">
              <WinBar title="Photo Compliments" tag="Upload or drag a photo"/>
              <div className="win-body">
                <EmptyState icon="📸" text="Photo compliments are generated by the extension when he sends a photo in the chat. The extension reads the image and generates a warm, specific compliment automatically."/>
                <div className="card card-g" style={{marginTop:16,textAlign:'center'}}>
                  <div style={{fontFamily:'var(--serif)',fontSize:13,color:'var(--gl)',marginBottom:8}}>How it works</div>
                  <div style={{fontSize:12.5,color:'var(--t3)',lineHeight:1.75}}>When a subscriber sends a photo, click Generate in the extension panel. CIC reads the image context and generates a warm, specific compliment that references something real about the photo — not generic praise.</div>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>
    </>
  )
}
