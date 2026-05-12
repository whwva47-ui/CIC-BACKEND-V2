'use client'
import { useState, useRef } from 'react'

const SITE    = process.env.NEXT_PUBLIC_SITE_URL || 'https://chattersinnercircle.vercel.app'
const EXT_TF  = 'https://chromewebstore.google.com/detail/cic-texting-factory/dkgpheiimhedhdfandcgeogmbfmmiobp'
const EXT_GEN = 'https://chromewebstore.google.com/detail/cic-general-platforms/dkgpheiimhedhdfandcgeogmbfmmiobp'

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;1,9..40,300&display=swap');

  :root {
    --bg:  #06060E; --bg2: #0C0C1A; --bg3: #111128; --card: #0E0E22;
    --bd:  rgba(139,92,246,0.15); --bd2: rgba(212,163,0,0.2);
    --p:   #7C3AED; --pl: #A855F7; --pll: #C4B5FD;
    --g:   #D4A300; --gl: #F5D98A; --gll: #FEF3C7;
    --t1:  #EDE9FE; --t2: #A78BFA; --t3: #6D6A8A;
    --ok:  #34D399; --err: #F87171;
    --serif: 'Cinzel', serif; --sans: 'DM Sans', sans-serif;
    --r: 10px; --rl: 16px;
  }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { scroll-behavior: smooth; }

  .cic-root {
    font-family: var(--sans);
    background: var(--bg);
    color: var(--t1);
    min-height: 100vh;
    overflow-x: hidden;
    -webkit-font-smoothing: antialiased;
    position: relative;
  }

  /* Grain */
  .cic-root::before {
    content: '';
    position: fixed; inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
    pointer-events: none; z-index: 0; opacity: 0.35;
  }

  .orb {
    position: fixed; border-radius: 50%; pointer-events: none;
    z-index: 0; filter: blur(80px); opacity: 0.1;
  }
  .orb1 { width: 520px; height: 520px; background: var(--p); top: -200px; right: -150px; }
  .orb2 { width: 420px; height: 420px; background: var(--g); bottom: -150px; left: -100px; }

  .z1 { position: relative; z-index: 1; }

  /* Nav */
  .nav {
    padding: 14px 28px;
    display: flex; align-items: center; justify-content: space-between;
    border-bottom: 1px solid var(--bd);
    position: sticky; top: 0; background: rgba(6,6,14,0.92);
    backdrop-filter: blur(12px); z-index: 50;
  }
  .brand { font-family: var(--serif); font-size: 15px; font-weight: 700; letter-spacing: 0.05em; background: linear-gradient(135deg, var(--pl), var(--gl)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
  .nav-sub { font-size: 10px; color: var(--t3); letter-spacing: 0.1em; text-transform: uppercase; margin-top: 1px; }

  /* Buttons */
  .btn { display: inline-flex; align-items: center; justify-content: center; gap: 7px; padding: 10px 22px; border-radius: var(--r); font-family: var(--sans); font-size: 13px; font-weight: 600; cursor: pointer; border: none; transition: all 0.2s ease; }
  .btn-primary { background: linear-gradient(135deg, var(--p), var(--pl)); color: #fff; box-shadow: 0 2px 20px rgba(124,58,237,0.35); }
  .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 4px 28px rgba(124,58,237,0.5); }
  .btn-gold { background: linear-gradient(135deg, var(--g), var(--gl)); color: #0a0a1a; box-shadow: 0 2px 20px rgba(212,163,0,0.3); }
  .btn-gold:hover { transform: translateY(-1px); box-shadow: 0 4px 28px rgba(212,163,0,0.45); }
  .btn-ghost { background: rgba(124,58,237,0.1); color: var(--pll); border: 1px solid var(--bd); }
  .btn-ghost:hover { background: rgba(124,58,237,0.2); }
  .btn-outline { background: transparent; color: var(--pl); border: 1px solid rgba(168,85,247,0.4); }
  .btn-outline:hover { border-color: var(--pl); background: rgba(124,58,237,0.08); }
  .btn-lg { padding: 14px 32px; font-size: 15px; }
  .btn-sm { padding: 7px 14px; font-size: 12px; }
  .btn-full { width: 100%; }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

  /* Cards */
  .card { background: var(--card); border: 1px solid var(--bd); border-radius: var(--rl); padding: 22px; }
  .card-gold { border-color: var(--bd2); }
  .card-glow { border-color: rgba(168,85,247,0.3); box-shadow: 0 0 30px rgba(124,58,237,0.1); }

  /* Inputs */
  .label { display: block; font-size: 10px; font-weight: 700; color: var(--t3); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 6px; }
  .input { width: 100%; padding: 12px 14px; background: var(--bg3); border: 1px solid var(--bd); border-radius: var(--r); color: var(--t1); font-size: 14px; font-family: var(--sans); outline: none; transition: border-color 0.2s; }
  .input:focus { border-color: var(--pl); }
  .input::placeholder { color: var(--t3); }

  /* Hero */
  .hero { max-width: 720px; margin: 0 auto; padding: 80px 24px 48px; text-align: center; }
  .hero-badge { display: inline-block; padding: 5px 16px; background: rgba(124,58,237,0.12); border: 1px solid rgba(124,58,237,0.3); border-radius: 20px; font-size: 11px; color: var(--pl); margin-bottom: 20px; letter-spacing: 0.05em; }
  .hero-title { font-family: var(--serif); font-size: clamp(28px,5vw,52px); font-weight: 700; line-height: 1.15; margin-bottom: 16px; letter-spacing: 0.02em; }
  .hero-grad { background: linear-gradient(135deg, var(--pl), var(--gl)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; display: block; }
  .hero-sub { font-size: 16px; color: var(--t3); line-height: 1.7; max-width: 520px; margin: 0 auto 32px; }

  /* Section */
  .section { max-width: 760px; margin: 0 auto; padding: 0 24px 64px; }
  .section-title { font-family: var(--serif); font-size: 22px; font-weight: 600; text-align: center; margin-bottom: 8px; }
  .section-sub { font-size: 13px; color: var(--t3); text-align: center; margin-bottom: 24px; }

  /* Grid */
  .g2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .g3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
  @media (max-width: 640px) { .g2, .g3 { grid-template-columns: 1fr; } }

  /* Pricing */
  .plan-best { border-color: rgba(168,85,247,0.4) !important; box-shadow: 0 0 40px rgba(124,58,237,0.12); }
  .plan-badge { position: absolute; top: 12px; right: 12px; background: linear-gradient(135deg, var(--p), var(--g)); padding: 3px 10px; border-radius: 20px; font-size: 9px; font-weight: 700; color: #fff; }

  /* Photo drop */
  .drop-zone { border: 2px dashed var(--bd2); border-radius: var(--rl); padding: 40px; text-align: center; cursor: pointer; transition: all 0.2s; background: rgba(212,163,0,0.03); }
  .drop-zone:hover, .drop-zone.over { border-color: var(--g); background: rgba(212,163,0,0.07); }

  /* Tabs */
  .tab-btn { padding: 7px 16px; border-radius: 20px; font-size: 12px; font-weight: 600; cursor: pointer; border: 1px solid var(--bd); background: transparent; color: var(--t3); font-family: var(--sans); transition: all 0.2s; }
  .tab-btn:hover { color: var(--t1); border-color: var(--pl); }
  .tab-btn.active { background: rgba(124,58,237,0.15); color: var(--pll); border-color: rgba(124,58,237,0.4); }

  /* Guide */
  .ex-card { background: var(--bg3); border-radius: var(--r); padding: 12px 14px; margin-bottom: 8px; }
  .ex-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 5px; }
  .ex-text { font-size: 13px; font-style: italic; line-height: 1.6; }

  /* Spinner */
  .spin { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.25); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* Scrollbar */
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: var(--bg2); }
  ::-webkit-scrollbar-thumb { background: rgba(124,58,237,0.4); border-radius: 2px; }
`

type Step = 'home' | 'signup' | 'sent' | 'photo-demo' | 'alphadate-guide' | 'install-guide'

export default function LandingPage() {
  const [step, setStep]               = useState<Step>('home')
  const [email, setEmail]             = useState('')
  const [referral, setReferral]       = useState('')
  const [loading, setLoading]         = useState(false)
  const [msg, setMsg]                 = useState('')
  const [photoPreview, setPhotoPreview] = useState<string|null>(null)
  const [photoLoading, setPhotoLoading] = useState(false)
  const [photoResults, setPhotoResults] = useState<string[]>([])
  const [guideTab, setGuideTab]       = useState('cat1')
  const fileRef = useRef<HTMLInputElement>(null)



  async function handleSignup() {
    if (!email.includes('@')) { setMsg('Enter a valid email address.'); return }
    setLoading(true); setMsg('')
    try {
      const r = await fetch('/api/auth/magic-link', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, referralCode: referral || undefined })
      })
      const d = await r.json()
      if (d.success) setStep('sent')
      else setMsg(d.error || 'Something went wrong.')
    } catch { setMsg('Connection error. Please try again.') }
    setLoading(false)
  }

  function handlePhoto(file: File) {
    const reader = new FileReader()
    reader.onload = e => { setPhotoPreview(e.target?.result as string); setPhotoResults([]); }
    reader.readAsDataURL(file)
  }

  async function generateCompliments() {
    setPhotoLoading(true)
    await new Promise(r => setTimeout(r, 1800))
    setPhotoResults([
      'SOMETHING IN YOUR PRESENCE STOPPED ME -- there is a quiet confidence in that photo that does not announce itself, just exists. What is the story behind the person in that picture?',
      'YOU CARRY SOMETHING RARE IN THAT PHOTO -- the kind of warmth that makes a stranger want to know what you are actually like when nobody is watching. What would surprise me most about you?',
      'THAT PHOTO TELLS ME MORE THAN YOU THINK -- there is depth there, something behind the eyes that I cannot quite figure out yet. What is the one thing people always get wrong about you?',
    ])
    setPhotoLoading(false)
  }

  // Screens


  if (step === 'sent') return (
    <>
      <style>{CSS}</style>
      <div className="cic-root" style={{ display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div className="orb orb1"/><div className="orb orb2"/>
        <div className="z1 card" style={{ maxWidth:420, textAlign:'center', padding:'40px 32px' }}>
          <div style={{ fontSize:52, marginBottom:16 }}>📧</div>
          <div style={{ fontFamily:'var(--serif)', fontSize:20, color:'var(--pl)', marginBottom:12 }}>Check Your Email</div>
          <p style={{ color:'var(--t3)', lineHeight:1.7, fontSize:14 }}>
            We sent a magic link to <strong style={{ color:'var(--t1)' }}>{email}</strong>.<br/>Click it to sign in. Expires in 1 hour.
          </p>
          <p style={{ color:'var(--t3)', fontSize:12, marginTop:12 }}>Check spam if it does not arrive within 60 seconds.</p>
          <div style={{display:'flex',gap:10,justifyContent:'center',marginTop:20,flexWrap:'wrap'}}>
            <button className="btn btn-ghost btn-sm" onClick={() => setStep('home')}>Back to home</button>
            <a href="/dashboard" className="btn btn-primary btn-sm" style={{textDecoration:'none'}}>Go to Dashboard</a>
          </div>
        </div>
      </div>
    </>
  )

  if (step === 'signup') return (
    <>
      <style>{CSS}</style>
      <div className="cic-root" style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', padding:24 }}>
        <div className="orb orb1"/><div className="orb orb2"/>
        <div className="z1 card card-glow" style={{ width:'100%', maxWidth:400, padding:'36px 28px' }}>
          <div style={{ textAlign:'center', marginBottom:28 }}>
            <div style={{ width:56, height:56, background:'linear-gradient(135deg,var(--p),var(--g))', borderRadius:16, display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:26, marginBottom:14 }}>💬</div>
            <div style={{ fontFamily:'var(--serif)', fontSize:20, background:'linear-gradient(135deg,var(--pll),var(--gl))', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', fontWeight:700 }}>Create Your Account</div>
            <p style={{ color:'var(--t3)', fontSize:13, marginTop:6 }}>🎉 Limited promotion -- 7 days free. No credit card.</p>
          </div>

          <div style={{ marginBottom:14 }}>
            <label className="label">Email Address</label>
            <input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&handleSignup()} placeholder="your@email.com"/>
          </div>
          <div style={{ marginBottom:20 }}>
            <label className="label">Referral Code (optional)</label>
            <input className="input" type="text" value={referral} onChange={e=>setReferral(e.target.value)} placeholder="Enter referral code"/>
          </div>

          {msg && <div style={{ color:'var(--err)', fontSize:13, marginBottom:14 }}>{msg}</div>}

          <button className="btn btn-primary btn-full btn-lg" onClick={handleSignup} disabled={loading}>
            {loading ? <><span className="spin"/>&nbsp;Sending...</> : 'Send Magic Link →'}
          </button>
          <p style={{ textAlign:'center', fontSize:11, color:'var(--t3)', marginTop:14 }}>
            This free trial is a limited-time promotion. Use it before it changes.
          </p>
          <button onClick={()=>setStep('home')} style={{ display:'block', margin:'10px auto 0', background:'none', border:'none', color:'var(--t3)', cursor:'pointer', fontSize:12, fontFamily:'var(--sans)' }}>← Back to home</button>
        </div>
      </div>
    </>
  )

  if (step === 'alphadate-guide') return (
    <>
      <style>{CSS}</style>
      <div className="cic-root">
        <div className="orb orb1"/><div className="orb orb2"/>
        <div className="z1">
          <div className="nav">
            <div><div className="brand">Alpha.date Guide</div><div className="nav-sub">Operator Rules</div></div>
            <button className="btn btn-ghost btn-sm" onClick={()=>setStep('home')}>← Back</button>
          </div>
          <div style={{ maxWidth:720, margin:'0 auto', padding:'40px 24px 80px' }}>
            <div className="card card-gold" style={{ marginBottom:20 }}>
              <div style={{ fontFamily:'var(--serif)', fontSize:16, color:'var(--gl)', marginBottom:10 }}>⚡ The Golden Hook Rule</div>
              <p style={{ fontSize:14, color:'var(--t2)', lineHeight:1.75 }}>Every message and letter must begin with a strong hook in <strong style={{color:'var(--t1)'}}>ALL CAPITAL LETTERS</strong>. 4-7 words. No punctuation at the end. Never repeat the same hook. Applies to all three categories.</p>
            </div>

            <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:20 }}>
              {[['cat1','Category 1 -- Outreach'],['cat2','Category 2 -- Replies'],['cat3','Category 3 -- Bulk'],['rules','Absolute Rules']].map(([id,label]) => (
                <button key={id} className={`tab-btn ${guideTab===id?'active':''}`} onClick={()=>setGuideTab(id)}>{label}</button>
              ))}
            </div>

            {guideTab === 'cat1' && (
              <div className="card">
                <div style={{ fontFamily:'var(--serif)', fontSize:15, marginBottom:12 }}>First Outreach -- /chance page, winks, likes, letters</div>
                {[
                  ['var(--pll)','👋 He sent a wink','DJ, THAT WINK WAS JUST THE BEGINNING and I have a feeling you already know what comes next. What made you stop on my profile?'],
                  ['var(--gl)','❤ He liked your profile','Robert, MOST PEOPLE SCROLL PAST WITHOUT STOPPING and I noticed you did not. What caught your attention?'],
                  ['var(--ok)','📝 Writing a letter (max 300 chars)','YOU HAVE A PRESENCE THAT STAYS WITH YOU and I mean that in the rarest way -- the kind that lingers hours after you first noticed it. What has shaped you most?'],
                ].map(([color,label,ex]) => (
                  <div key={label} className="ex-card" style={{ marginBottom:10 }}>
                    <div className="ex-label" style={{ color }}>{label}</div>
                    <div className="ex-text" style={{ color:'var(--t2)' }}>{ex}</div>
                  </div>
                ))}
              </div>
            )}

            {guideTab === 'cat2' && (
              <div className="card">
                <div style={{ fontFamily:'var(--serif)', fontSize:15, marginBottom:8 }}>Replying to Active or Inactive Chats</div>
                <div style={{ background:'rgba(52,211,153,0.08)', border:'1px solid rgba(52,211,153,0.2)', borderRadius:'var(--r)', padding:'10px 14px', marginBottom:14, fontSize:13, color:'var(--ok)' }}>
                  <strong>ONE SENTENCE ONLY. 15-25 words maximum. No emojis.</strong>
                </div>
                {[
                  ['💕 Romantic','There is something about the way you said that which makes it genuinely hard to think about anything else right now.'],
                  ['😄 Playful','You say that like you have not already thought about exactly what happens next, which I am fairly certain you have.'],
                  ['⏸ He went silent','Life has a way of getting loud sometimes and I hope yours has been the good kind of busy since we last spoke.'],
                ].map(([label,ex]) => (
                  <div key={label} className="ex-card" style={{ marginBottom:8 }}>
                    <div className="ex-label" style={{ color:'var(--ok)' }}>{label}</div>
                    <div className="ex-text" style={{ color:'var(--t2)' }}>{ex}</div>
                  </div>
                ))}
              </div>
            )}

            {guideTab === 'cat3' && (
              <div className="card">
                <div style={{ fontFamily:'var(--serif)', fontSize:15, marginBottom:8 }}>Sender Setup -- Bulk Content with Emojis</div>
                <p style={{ fontSize:13, color:'var(--t3)', lineHeight:1.7, marginBottom:14 }}>Under 20 words. ~40% ALL CAPS hooks. <strong style={{color:'var(--gl)'}}>Emojis allowed and encouraged.</strong> Vary topics widely.</p>
                {[
                  '🌍 THE WORLD SHRANK WHEN YOU STARTED TRAVELLING -- what was the first place that genuinely changed how you think?',
                  '☕ If you could only keep one morning habit forever, what would it be? 🤔',
                  '🌙 LATE NIGHT THOUGHTS HIT DIFFERENTLY -- what is the last thing you thought about before sleep? 💭',
                ].map((ex,i) => (
                  <div key={i} style={{ background:'rgba(212,163,0,0.06)', borderRadius:'var(--r)', padding:'10px 14px', marginBottom:8, fontSize:13, color:'var(--gl)', fontStyle:'italic', lineHeight:1.6 }}>{ex}</div>
                ))}
              </div>
            )}

            {guideTab === 'rules' && (
              <div className="card" style={{ borderColor:'rgba(248,113,113,0.3)' }}>
                <div style={{ fontFamily:'var(--serif)', fontSize:15, color:'var(--err)', marginBottom:14 }}>🛑 Absolute Rules -- All Categories</div>
                {['Never repeat the same message or letter. Not in the same shift. Not ever.',
                  'Never reuse the same opening hook. Every conversation gets a fresh original hook.',
                  'Never mention AI. Not directly, not indirectly, not as a joke.',
                  'No pressure or desperation in Category 1 or Category 3 letters.',
                  'Always proofread before sending. You make the final call on every message.',
                  'No emojis in Category 1 or Category 2. Only Category 3.',
                ].map((r,i) => (
                  <div key={i} style={{ display:'flex', gap:10, padding:'8px 0', borderBottom:'1px solid rgba(248,113,113,0.1)', fontSize:13, color:'var(--t2)', lineHeight:1.6 }}>
                    <span style={{ color:'var(--err)', flexShrink:0 }}>✕</span>{r}
                  </div>
                ))}
              </div>
            )}

            <div style={{ textAlign:'center', marginTop:24, padding:'20px', background:'var(--card)', border:'1px solid var(--bd)', borderRadius:'var(--rl)' }}>
              <p style={{ fontSize:13, color:'var(--t3)' }}>Questions? WhatsApp <strong style={{color:'var(--t1)'}}>+254 113 178 973</strong></p>
            </div>
          </div>
        </div>
      </div>
    </>
  )

  if (step === 'install-guide') return (
    <>
      <style>{CSS}</style>
      <div className="cic-root">
        <div className="orb orb1"/><div className="orb orb2"/>
        <div className="z1">
          <div className="nav">
            <div><div className="brand">Install Guide</div><div className="nav-sub">3 steps</div></div>
            <button className="btn btn-ghost btn-sm" onClick={()=>setStep('home')}>← Back</button>
          </div>
          <div style={{ maxWidth:640, margin:'0 auto', padding:'40px 24px 80px' }}>
            <div className="section-title" style={{ marginBottom:8 }}>Choose Your Extension</div>
            <div className="section-sub" style={{ marginBottom:24 }}>Install the one that matches your platform</div>

            <div className="g2" style={{ marginBottom:32 }}>
              {[
                { name:'CIC -- Texting Factory', desc:'chathomebase.com and Texting Factory operators', icon:'💬', url:EXT_TF },
                { name:'CIC -- General OF Extension', desc:'Alpha.date, OnlyFans, Fansly and 7 other platforms', icon:'🌐', url:EXT_GEN },
              ].map(e => (
                <div key={e.name} className="card card-gold" style={{ textAlign:'center' }}>
                  <div style={{ fontSize:30, marginBottom:10 }}>{e.icon}</div>
                  <div style={{ fontWeight:700, fontSize:14, marginBottom:6 }}>{e.name}</div>
                  <div style={{ color:'var(--t3)', fontSize:12, marginBottom:14, lineHeight:1.5 }}>{e.desc}</div>
                  <a href={e.url} target="_blank" rel="noreferrer" className="btn btn-gold btn-full" style={{ textDecoration:'none', display:'flex' }}>Install from Chrome Store →</a>
                </div>
              ))}
            </div>

            {[
              ['Click Install from Chrome Store', 'Opens the official CIC listing on the Chrome Web Store.'],
              ['Click "Add to Chrome"', 'Chrome installs the extension in seconds. The CIC icon appears in your toolbar.'],
              ['Click the CIC icon and enter your email', 'Sign in with your registered email. The extension validates your plan and you start generating replies immediately.'],
            ].map(([title, desc], i) => (
              <div key={i} style={{ display:'flex', gap:14, alignItems:'flex-start', marginBottom:16 }}>
                <div style={{ width:28, height:28, borderRadius:'50%', background:'linear-gradient(135deg,var(--p),var(--g))', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, flexShrink:0, color:'#fff' }}>{i+1}</div>
                <div>
                  <div style={{ fontSize:14, fontWeight:600, color:'var(--t1)', marginBottom:3 }}>{title}</div>
                  <div style={{ fontSize:13, color:'var(--t3)', lineHeight:1.6 }}>{desc}</div>
                </div>
              </div>
            ))}

            <div style={{ marginTop:24, background:'rgba(52,211,153,0.06)', border:'1px solid rgba(52,211,153,0.2)', borderRadius:'var(--rl)', padding:20, textAlign:'center' }}>
              <div style={{ color:'var(--ok)', fontWeight:600, marginBottom:10 }}>Not signed up yet?</div>
              <button className="btn btn-primary" onClick={()=>setStep('signup')}>Create Free Account →</button>
            </div>
          </div>
        </div>
      </div>
    </>
  )

  if (step === 'photo-demo') return (
    <>
      <style>{CSS}</style>
      <div className="cic-root">
        <div className="orb orb1"/><div className="orb orb2"/>
        <div className="z1">
          <div className="nav">
            <div><div className="brand">Photo Demo</div><div className="nav-sub">See the AI in action</div></div>
            <button className="btn btn-ghost btn-sm" onClick={()=>{ setStep('home'); setPhotoPreview(null); setPhotoResults([]); }}>← Back</button>
          </div>
          <div style={{ maxWidth:640, margin:'0 auto', padding:'40px 24px 80px' }}>
            <div style={{ textAlign:'center', marginBottom:32 }}>
              <div style={{ fontFamily:'var(--serif)', fontSize:24, marginBottom:8 }}>Upload a Photo. Watch CIC Compliment It.</div>
              <p style={{ color:'var(--t3)', fontSize:14, lineHeight:1.7 }}>This is exactly what the extension does inside the chat window -- reads the photo and generates warm, specific, personal compliments that feel genuinely human.</p>
            </div>

            <div className="card card-gold" style={{ marginBottom:20 }}>
              <div
                className={`drop-zone ${photoPreview?'':'active'}`}
                onClick={()=>!photoPreview&&fileRef.current?.click()}
                onDragOver={e=>{ e.preventDefault(); e.currentTarget.classList.add('over'); }}
                onDragLeave={e=>e.currentTarget.classList.remove('over')}
                onDrop={e=>{ e.preventDefault(); e.currentTarget.classList.remove('over'); const f=e.dataTransfer.files[0]; if(f&&f.type.startsWith('image/'))handlePhoto(f); }}
              >
                <input ref={fileRef} type="file" accept="image/*" style={{ display:'none' }} onChange={e=>{ const f=e.target.files?.[0]; if(f)handlePhoto(f); }}/>
                {photoPreview ? (
                  <img src={photoPreview} alt="Preview" style={{ maxWidth:'100%', maxHeight:240, borderRadius:'var(--r)', margin:'0 auto', display:'block' }}/>
                ) : (
                  <>
                    <div style={{ fontSize:40, marginBottom:12 }}>📸</div>
                    <div style={{ fontSize:15, fontWeight:600, color:'var(--t1)', marginBottom:6 }}>Drop a photo here or click to browse</div>
                    <div style={{ fontSize:13, color:'var(--t3)' }}>JPG, PNG or WEBP -- any photo works</div>
                  </>
                )}
              </div>
              {photoPreview && (
                <div style={{ marginTop:16, display:'flex', gap:10 }}>
                  <button className="btn btn-gold btn-full" onClick={generateCompliments} disabled={photoLoading}>
                    {photoLoading ? <><span className="spin"/>&nbsp;Generating...</> : '💌 Generate Compliments'}
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={()=>{ setPhotoPreview(null); setPhotoResults([]); }} style={{ flexShrink:0 }}>Clear</button>
                </div>
              )}
            </div>

            {photoResults.length > 0 && (
              <div className="card">
                <div style={{ fontFamily:'var(--serif)', fontSize:15, color:'var(--gl)', marginBottom:14 }}>💌 Generated Compliments</div>
                {photoResults.map((r,i) => (
                  <div key={i} className="card-gold" style={{ background:'var(--bg3)', borderRadius:'var(--r)', padding:'14px', marginBottom:10, border:'1px solid var(--bd2)' }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'var(--gl)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>Option {i+1}</div>
                    <div style={{ fontSize:14, color:'var(--t1)', lineHeight:1.7 }}>{r}</div>
                    <button className="btn btn-ghost btn-sm" style={{ marginTop:10 }} onClick={()=>navigator.clipboard.writeText(r)}>⎘ Copy</button>
                  </div>
                ))}
                <div style={{ marginTop:16, background:'rgba(124,58,237,0.08)', border:'1px solid var(--bd)', borderRadius:'var(--r)', padding:16, textAlign:'center' }}>
                  <p style={{ fontSize:13, color:'var(--t2)', marginBottom:12 }}>The extension does this automatically inside every chat window -- no copy-paste needed.</p>
                  <button className="btn btn-primary" onClick={()=>setStep('signup')}>Claim Free Trial →</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )

  // HOME
  return (
    <>
      <style>{CSS}</style>
      <div className="cic-root">
        <div className="orb orb1"/>
        <div className="orb orb2"/>
        <div className="z1">

          {/* Nav */}
          <nav className="nav">
            <div>
              <div className="brand">Chatter's Inner Circle</div>
              <div className="nav-sub">AI Reply Assistant · Available Worldwide</div>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button className="btn btn-ghost btn-sm" onClick={()=>setStep('install-guide')}>Extensions</button>
              <a href="/dashboard" className="btn btn-ghost btn-sm" style={{textDecoration:'none'}}>Dashboard</a>
              <button className="btn btn-primary btn-sm" onClick={()=>setStep('signup')}>Get Started</button>
            </div>
          </nav>

          {/* Hero */}
          <section className="hero">
            <div className="hero-badge">AI Reply Assistant · 10+ Platforms · No Country Restrictions</div>
            <h1 className="hero-title">
              Replies That Get Him
              <span className="hero-grad">Hooked Every Time</span>
            </h1>
            <p className="hero-sub">
              CIC generates smart, warm replies for professional operators on dating and subscription platforms. Works on Texting Factory, Alpha.date, OnlyFans, Fansly, and more.
            </p>
            <div style={{ display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap', marginBottom:16 }}>
              <button className="btn btn-primary btn-lg" onClick={()=>setStep('signup')}>Claim Free Trial -- 7 Days 🎉</button>
              <button className="btn btn-outline btn-lg" onClick={()=>setStep('install-guide')}>Download Extension →</button>
            </div>
            <button
              onClick={()=>setStep('photo-demo')}
              style={{ background:'rgba(212,163,0,0.1)', border:'1px solid rgba(212,163,0,0.3)', borderRadius:30, padding:'9px 22px', color:'var(--gl)', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'var(--sans)', transition:'all 0.2s' }}>
              📸 Try it -- upload a photo and see how CIC compliments it
            </button>
          </section>

          {/* Photo demo section */}
          <section className="section">
            <div className="card card-gold" style={{ textAlign:'center', padding:32 }}>
              <div style={{ display:'inline-block', padding:'5px 16px', background:'rgba(212,163,0,0.15)', border:'1px solid rgba(212,163,0,0.3)', borderRadius:20, fontSize:11, color:'var(--gl)', marginBottom:14, fontWeight:600, letterSpacing:'0.05em' }}>LIVE DEMO -- Try it yourself</div>
              <div style={{ fontFamily:'var(--serif)', fontSize:22, marginBottom:10 }}>Upload a photo. Watch CIC compliment it.</div>
              <p style={{ color:'var(--t3)', fontSize:14, lineHeight:1.7, maxWidth:480, margin:'0 auto 20px' }}>Drop any photo and CIC reads it, then generates a warm, specific, personal compliment that feels genuinely human. This is exactly what the extension does inside the chat window.</p>
              <button className="btn btn-gold btn-lg" onClick={()=>setStep('photo-demo')}>📸 Upload a Photo -- See the Magic</button>
              <div style={{ display:'flex', gap:24, justifyContent:'center', marginTop:16, flexWrap:'wrap' }}>
                {['Reads the photo intelligently','Generates 3 specific options','Feels genuinely personal'].map(f => (
                  <div key={f} style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'var(--t3)' }}>
                    <span style={{ color:'var(--gl)' }}>✓</span>{f}
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Extensions */}
          <section className="section">
            <div className="section-title" style={{ fontFamily:'var(--serif)', color:'var(--gl)' }}>Chrome Extensions</div>
            <div className="section-sub">Install the extension for your platform. Sign up first to activate it.</div>
            <div className="g2">
              {[
                { name:'CIC -- Texting Factory', desc:'chathomebase.com and Texting Factory', icon:'💬', url:EXT_TF, guide: null as string|null },
                { name:'CIC -- General OF Extension', desc:'Alpha.date, OnlyFans, Fansly and more', icon:'🌐', url:EXT_GEN, guide:'alphadate-guide' },
              ].map(e => (
                <div key={e.name} className="card" style={{ textAlign:'center' }}>
                  <div style={{ fontSize:30, marginBottom:10 }}>{e.icon}</div>
                  <div style={{ fontWeight:700, fontSize:14, marginBottom:5 }}>{e.name}</div>
                  <div style={{ color:'var(--t3)', fontSize:12, marginBottom:14 }}>{e.desc}</div>
                  <a href={e.url} target="_blank" rel="noreferrer" className="btn btn-primary btn-full btn-sm" style={{ textDecoration:'none', display:'flex', marginBottom:8 }}>Install from Chrome Store →</a>
                  {e.guide && <button className="btn btn-ghost btn-full btn-sm" onClick={()=>setStep(e.guide as Step)}>📖 Alpha.date Operator Guide</button>}
                  <button className="btn btn-ghost btn-full btn-sm" style={{ marginTop:6 }} onClick={()=>setStep('install-guide')}>How to install →</button>
                </div>
              ))}
            </div>
          </section>

          {/* Pricing */}
          <section className="section">
            <div className="section-title" style={{ fontFamily:'var(--serif)' }}>Simple Pricing</div>
            <div className="section-sub">Available worldwide. Pay via M-Pesa, card, PayPal, or crypto.</div>
            <div className="g3">
              {[
                { name:'Free Trial', price:'Free', period:'Limited Promotion', color:'var(--ok)', badge:'NOW', features:['Full Pro access days 1-3','20 replies/day days 4-7','Both extensions included','All 10 platforms','No credit card needed'] },
                { name:'Basic', price:'$8', period:'per month', color:'#60a5fa', badge:'', features:['50 replies per day','All 10 platforms','Standard AI quality','Both extensions','Email support'] },
                { name:'Pro', price:'$15', period:'per month', color:'var(--pl)', badge:'BEST', features:['Unlimited replies daily','Full explicit content','Premium AI quality','Priority support','Referral rewards'] },
              ].map(p => (
                <div key={p.name} className={`card ${p.name==='Pro'?'plan-best':''}`} style={{ position:'relative' }}>
                  {p.badge && <div className="plan-badge">{p.badge}</div>}
                  <div style={{ color:p.color, fontWeight:700, fontSize:13, marginBottom:6, fontFamily:'var(--serif)' }}>{p.name}</div>
                  <div style={{ fontSize:28, fontWeight:800, marginBottom:3 }}>{p.price}</div>
                  <div style={{ color:'var(--t3)', fontSize:11, marginBottom:18 }}>{p.period}</div>
                  {p.features.map(f => (
                    <div key={f} style={{ display:'flex', gap:7, marginBottom:7, fontSize:12, color:'var(--t3)', alignItems:'flex-start' }}>
                      <span style={{ color:p.color, flexShrink:0 }}>✓</span>{f}
                    </div>
                  ))}
                  <button className="btn btn-full btn-sm" style={{ marginTop:14, background:p.name==='Pro'?'linear-gradient(135deg,var(--p),var(--g))':'transparent', border:`1px solid ${p.color}`, color:p.name==='Pro'?'#fff':p.color }} onClick={()=>setStep('signup')}>
                    {p.name==='Free Trial'?'Start Free':p.name==='Pro'?'Get Pro':'Get Started'}
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Payment */}
          <section className="section" style={{ maxWidth:580 }}>
            <div className="card" style={{ textAlign:'center', padding:28 }}>
              <div style={{ fontFamily:'var(--serif)', fontSize:18, color:'var(--pl)', marginBottom:12 }}>How to Pay for Pro</div>
              <p style={{ color:'var(--t3)', fontSize:14, lineHeight:1.7 }}>Payment details are sent privately to your email when you request an upgrade inside the extension. We accept M-Pesa, Visa, Mastercard, PayPal, and crypto. Available in every country.</p>
            </div>
          </section>

          {/* Referral */}
          <section className="section" style={{ maxWidth:580 }}>
            <div className="card card-gold" style={{ textAlign:'center', padding:28 }}>
              <div style={{ fontSize:36, marginBottom:12 }}>🎁</div>
              <div style={{ fontFamily:'var(--serif)', fontSize:18, color:'var(--gl)', marginBottom:10 }}>Refer Friends, Earn Pro Free</div>
              <p style={{ color:'var(--t3)', fontSize:14, lineHeight:1.7 }}>Every referral earns <strong style={{color:'var(--gl)'}}>150 points</strong>. Collect <strong style={{color:'var(--gl)'}}>1,500 points</strong> and get 1 month Pro free ($15 value). Your referral code appears in the extension after signup.</p>
            </div>
          </section>

          {/* Footer */}
          <footer style={{ borderTop:'1px solid var(--bd)', padding:'24px', textAlign:'center', color:'var(--t3)', fontSize:12 }}>
            <p style={{ marginBottom:8 }}>Chatter's Inner Circle &copy; 2026 -- AI Reply Assistant · Available Worldwide</p>
            <p style={{ marginBottom:12 }}>Support: <a href="mailto:whwva47@gmail.com" style={{ color:'var(--pl)', textDecoration:'none' }}>whwva47@gmail.com</a> · WhatsApp: +254 113 178 973</p>
            <div style={{ display:'flex', gap:16, justifyContent:'center', flexWrap:'wrap' }}>
              <a href="/dashboard" style={{ color:'var(--t3)', textDecoration:'none', fontSize:12 }}>Dashboard</a>
              <button onClick={()=>setStep('photo-demo')} style={{ background:'none', border:'none', color:'var(--t3)', cursor:'pointer', fontSize:12, fontFamily:'var(--sans)' }}>Photo Demo</button>
              <button onClick={()=>setStep('alphadate-guide')} style={{ background:'none', border:'none', color:'var(--t3)', cursor:'pointer', fontSize:12, fontFamily:'var(--sans)' }}>Alpha.date Guide</button>
              <button onClick={()=>setStep('install-guide')} style={{ background:'none', border:'none', color:'var(--t3)', cursor:'pointer', fontSize:12, fontFamily:'var(--sans)' }}>Install Guide</button>
              <a href={EXT_TF} target="_blank" rel="noreferrer" style={{ color:'var(--t3)', textDecoration:'none', fontSize:12 }}>TF Extension</a>
              <a href={EXT_GEN} target="_blank" rel="noreferrer" style={{ color:'var(--t3)', textDecoration:'none', fontSize:12 }}>General Extension</a>
            </div>
          </footer>

        </div>
      </div>
    </>
  )
}
