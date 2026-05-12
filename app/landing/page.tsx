'use client'
import { useState, useRef } from 'react'

const SITE    = process.env.NEXT_PUBLIC_SITE_URL || 'https://chattersinnercircle.vercel.app'
const EXT_TF  = 'https://chromewebstore.google.com/detail/cic-texting-factory/dkgpheiimhedhdfandcgeogmbfmmiobp'
const EXT_GEN = 'https://chromewebstore.google.com/detail/cic-general-cic/dkgpheiimhedhdfandcgeogmbfmmiobp'

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500&display=swap');
:root{
  --bg:#06060E;--bg2:#0C0C1A;--bg3:#111128;--card:#0E0E22;
  --bd:rgba(139,92,246,0.15);--bd2:rgba(212,163,0,0.2);
  --p:#7C3AED;--pl:#A855F7;--pll:#C4B5FD;
  --g:#D4A300;--gl:#F5D98A;
  --t1:#EDE9FE;--t2:#A78BFA;--t3:#6D6A8A;
  --ok:#34D399;--err:#F87171;
  --serif:'Cinzel',serif;--sans:'DM Sans',sans-serif;
  --r:10px;--rl:16px;
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:var(--sans);background:var(--bg);color:var(--t1);min-height:100vh;overflow-x:hidden;-webkit-font-smoothing:antialiased}
body::before{content:'';position:fixed;inset:0;
  background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
  pointer-events:none;z-index:0;opacity:0.4}
.orb{position:fixed;border-radius:50%;pointer-events:none;z-index:0;filter:blur(80px)}
.orb1{width:520px;height:520px;background:var(--p);opacity:0.1;top:-200px;right:-150px}
.orb2{width:420px;height:420px;background:var(--g);opacity:0.08;bottom:-150px;left:-100px}
.z1{position:relative;z-index:1}

/* NAV */
.nav{display:flex;align-items:center;justify-content:space-between;padding:16px 28px;border-bottom:1px solid var(--bd);background:rgba(6,6,14,0.92);backdrop-filter:blur(16px);position:sticky;top:0;z-index:50}
.nav-brand{font-family:var(--serif);font-size:15px;font-weight:700;background:linear-gradient(135deg,var(--pl),var(--gl));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.nav-sub{font-size:9px;color:var(--t3);letter-spacing:0.1em;text-transform:uppercase;margin-top:1px}

/* BUTTONS */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:10px 22px;border-radius:var(--r);font-family:var(--sans);font-size:13px;font-weight:600;cursor:pointer;border:none;transition:all 0.2s;text-decoration:none}
.btn-primary{background:linear-gradient(135deg,var(--p),var(--pl));color:#fff;box-shadow:0 2px 20px rgba(124,58,237,0.35)}
.btn-primary:hover{transform:translateY(-1px);box-shadow:0 4px 28px rgba(124,58,237,0.5)}
.btn-gold{background:linear-gradient(135deg,var(--g),var(--gl));color:#0a0a1a;box-shadow:0 2px 16px rgba(212,163,0,0.3)}
.btn-gold:hover{transform:translateY(-1px)}
.btn-ghost{background:rgba(124,58,237,0.08);color:var(--pll);border:1px solid var(--bd)}
.btn-ghost:hover{background:rgba(124,58,237,0.15)}
.btn-outline{background:transparent;color:var(--pl);border:1px solid rgba(168,85,247,0.35)}
.btn-outline:hover{border-color:var(--pl);background:rgba(124,58,237,0.06)}
.btn-lg{padding:14px 32px;font-size:15px}
.btn-sm{padding:7px 16px;font-size:12px}
.btn-full{width:100%;justify-content:center}
.btn:disabled{opacity:0.5;cursor:not-allowed;transform:none}

/* INPUTS */
.lbl{display:block;font-size:10px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px}
.inp{width:100%;padding:12px 14px;background:rgba(0,0,0,0.3);border:1px solid var(--bd);border-radius:var(--r);color:var(--t1);font-size:14px;font-family:var(--sans);outline:none;transition:border-color 0.2s}
.inp:focus{border-color:var(--pl)}
.inp::placeholder{color:var(--t3)}

/* CARDS */
.card{background:var(--card);border:1px solid var(--bd);border-radius:var(--rl);padding:22px}
.card-gold{border-color:var(--bd2)}
.card-glow{border-color:rgba(124,58,237,0.3);box-shadow:0 0 40px rgba(124,58,237,0.08)}

/* LAYOUT */
.section{max-width:680px;margin:0 auto;padding:0 24px 64px}
.g2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}
@media(max-width:600px){.g2,.g3{grid-template-columns:1fr}}

/* PHOTO DROP */
.drop-zone{border:2px dashed var(--bd2);border-radius:var(--rl);padding:32px;text-align:center;cursor:pointer;transition:all 0.2s;background:rgba(212,163,0,0.02)}
.drop-zone:hover{border-color:var(--g);background:rgba(212,163,0,0.05)}

/* SPINNER */
.spin{width:15px;height:15px;border:2px solid rgba(255,255,255,0.2);border-top-color:#fff;border-radius:50%;animation:spin 0.7s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}

/* SCROLLBAR */
::-webkit-scrollbar{width:4px}
::-webkit-scrollbar-track{background:var(--bg2)}
::-webkit-scrollbar-thumb{background:rgba(124,58,237,0.3);border-radius:2px}
`

type Step = 'home' | 'signup' | 'sent'

export default function LandingPage() {
  const [step, setStep]     = useState<Step>('home')
  const [email, setEmail]   = useState('')
  const [referral, setReferral] = useState('')
  const [loading, setLoading]   = useState(false)
  const [msg, setMsg]           = useState('')
  const [photoPreview, setPhotoPreview] = useState<string|null>(null)
  const [photoResults, setPhotoResults] = useState<string[]>([])
  const [photoLoading, setPhotoLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleSignup() {
    if (!email.includes('@')) { setMsg('Please enter a valid email address.'); return }
    setLoading(true); setMsg('')
    try {
      const r = await fetch('/api/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, referralCode: referral || undefined })
      })
      const d = await r.json()
      if (d.success) setStep('sent')
      else setMsg(d.error || 'Something went wrong. Please try again.')
    } catch { setMsg('Connection error. Please try again.') }
    setLoading(false)
  }

  function handlePhoto(file: File) {
    const reader = new FileReader()
    reader.onload = e => { setPhotoPreview(e.target?.result as string); setPhotoResults([]) }
    reader.readAsDataURL(file)
  }

  async function generateCompliments() {
    setPhotoLoading(true)
    await new Promise(r => setTimeout(r, 1800))
    setPhotoResults([
      "There is something in how you carry yourself in that photo -- it is not posed, it is just you, and that is actually the rarest thing. Most people forget to be themselves the moment a camera appears. What were you thinking when this was taken?",
      "I have looked at this photo twice now and noticed something different each time. The first time it was the confidence. The second time it was something quieter behind it. What is the version of you that most people never get to see?",
      "You have one of those faces that tells a story without saying anything. There is warmth there but also something private -- like you have decided what you share and what you keep. What would actually surprise me about you?",
    ])
    setPhotoLoading(false)
  }

  // ── SENT SCREEN ──────────────────────────────────────────────────────────
  if (step === 'sent') return (
    <>
      <style>{CSS}</style>
      <div style={{ background:'var(--bg)', minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
        <div className="orb orb1"/><div className="orb orb2"/>
        <div className="z1 card card-glow" style={{ maxWidth:420, width:'100%', textAlign:'center', padding:'40px 32px' }}>
          <div style={{ fontSize:52, marginBottom:16 }}>📧</div>
          <div style={{ fontFamily:'var(--serif)', fontSize:20, color:'var(--pl)', marginBottom:12 }}>Check Your Email</div>
          <p style={{ color:'var(--t3)', lineHeight:1.75, fontSize:14, marginBottom:6 }}>
            We sent a magic link to <strong style={{ color:'var(--t1)' }}>{email}</strong>.
          </p>
          <p style={{ color:'var(--t3)', fontSize:13, lineHeight:1.7, marginBottom:24 }}>
            Click it to sign in. You will land directly on your dashboard. Check spam if it does not arrive within 60 seconds.
          </p>
          <a href="/dashboard" className="btn btn-primary btn-full btn-lg" style={{ marginBottom:10 }}>
            Go to Dashboard →
          </a>
          <button className="btn btn-ghost btn-full btn-sm" onClick={() => setStep('home')}>
            Back to home
          </button>
        </div>
      </div>
    </>
  )

  // ── SIGNUP SCREEN ─────────────────────────────────────────────────────────
  if (step === 'signup') return (
    <>
      <style>{CSS}</style>
      <div style={{ background:'var(--bg)', minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
        <div className="orb orb1"/><div className="orb orb2"/>
        <div className="z1 card card-glow" style={{ maxWidth:400, width:'100%', padding:'36px 28px' }}>
          <div style={{ textAlign:'center', marginBottom:28 }}>
            <div style={{ width:56, height:56, background:'linear-gradient(135deg,var(--p),var(--g))', borderRadius:16, display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:26, marginBottom:14 }}>💬</div>
            <div style={{ fontFamily:'var(--serif)', fontSize:20, background:'linear-gradient(135deg,var(--pll),var(--gl))', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', fontWeight:700 }}>
              Create Your Account
            </div>
            <p style={{ color:'var(--t3)', fontSize:13, marginTop:6, lineHeight:1.6 }}>
              Limited promotion -- 7 days free. No credit card.
            </p>
          </div>

          <div style={{ marginBottom:14 }}>
            <label className="lbl">Email Address</label>
            <input className="inp" type="email" value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSignup()}
              placeholder="your@email.com" autoFocus/>
          </div>
          <div style={{ marginBottom:20 }}>
            <label className="lbl">Referral Code (optional)</label>
            <input className="inp" type="text" value={referral}
              onChange={e => setReferral(e.target.value)}
              placeholder="Enter referral code"/>
          </div>

          {msg && <div style={{ color:'var(--err)', fontSize:13, marginBottom:14, lineHeight:1.5 }}>{msg}</div>}

          <button className="btn btn-primary btn-full btn-lg" onClick={handleSignup} disabled={loading}>
            {loading ? <><span className="spin"/> Sending...</> : 'Send Magic Link →'}
          </button>
          <p style={{ textAlign:'center', fontSize:11, color:'var(--t3)', marginTop:14, lineHeight:1.6 }}>
            This free trial is a limited-time promotion.
          </p>
          <button onClick={() => setStep('home')} style={{ display:'block', margin:'12px auto 0', background:'none', border:'none', color:'var(--t3)', cursor:'pointer', fontSize:12, fontFamily:'var(--sans)' }}>
            ← Back to home
          </button>
        </div>
      </div>
    </>
  )

  // ── HOME SCREEN ───────────────────────────────────────────────────────────
  return (
    <>
      <style>{CSS}</style>
      <div style={{ background:'var(--bg)', minHeight:'100vh' }}>
        <div className="orb orb1"/><div className="orb orb2"/>

        {/* NAV */}
        <nav className="nav z1">
          <div>
            <div className="nav-brand">Chatter's Inner Circle</div>
            <div className="nav-sub">AI Reply Assistant</div>
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <a href="/dashboard" className="btn btn-ghost btn-sm">Dashboard</a>
            <button className="btn btn-primary btn-sm" onClick={() => setStep('signup')}>Sign Up Free</button>
          </div>
        </nav>

        <div className="z1">

          {/* HERO */}
          <div style={{ maxWidth:700, margin:'0 auto', padding:'80px 24px 56px', textAlign:'center' }}>
            <div style={{ display:'inline-block', padding:'5px 16px', background:'rgba(124,58,237,0.12)', border:'1px solid rgba(124,58,237,0.3)', borderRadius:20, fontSize:11, color:'var(--pl)', marginBottom:20, letterSpacing:'0.05em' }}>
              AI Reply Assistant -- 10+ Platforms -- Available Worldwide
            </div>
            <h1 style={{ fontFamily:'var(--serif)', fontSize:'clamp(28px,5vw,50px)', fontWeight:700, lineHeight:1.15, marginBottom:16, letterSpacing:'0.02em' }}>
              Replies That Keep Him{' '}
              <span style={{ background:'linear-gradient(135deg,var(--pl),var(--gl))', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', display:'block' }}>
                Coming Back
              </span>
            </h1>
            <p style={{ fontSize:16, color:'var(--t3)', lineHeight:1.75, maxWidth:520, margin:'0 auto 32px' }}>
              Professional AI replies for operators on dating and subscription platforms. Works on Texting Factory, Alpha.date, OnlyFans, Fansly, ChatterApply and more.
            </p>
            <div style={{ display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap' as const }}>
              <button className="btn btn-primary btn-lg" onClick={() => setStep('signup')}>
                Start Free -- 7 Days
              </button>
              <a href="/dashboard" className="btn btn-outline btn-lg">
                See the Dashboard →
              </a>
            </div>
          </div>

          {/* PHOTO DEMO */}
          <div className="section">
            <div className="card card-gold" style={{ padding:28 }}>
              <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
                <div style={{ width:36, height:36, background:'linear-gradient(135deg,var(--p),var(--g))', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>📸</div>
                <div>
                  <div style={{ fontFamily:'var(--serif)', fontSize:15, color:'var(--t1)' }}>Live Demo -- Photo Compliments</div>
                  <div style={{ fontSize:12, color:'var(--t3)', marginTop:2 }}>Upload any photo. See how the AI reads it and generates a personal compliment.</div>
                </div>
              </div>

              <div
                className="drop-zone"
                onClick={() => !photoPreview && fileRef.current?.click()}
                onDragOver={e => { e.preventDefault(); (e.currentTarget as HTMLElement).style.borderColor='var(--g)' }}
                onDragLeave={e => (e.currentTarget as HTMLElement).style.borderColor='var(--bd2)'}
                onDrop={e => { e.preventDefault(); (e.currentTarget as HTMLElement).style.borderColor='var(--bd2)'; const f=e.dataTransfer.files[0]; if(f&&f.type.startsWith('image/'))handlePhoto(f) }}>
                <input ref={fileRef} type="file" accept="image/*" style={{ display:'none' }}
                  onChange={e => { const f=e.target.files?.[0]; if(f)handlePhoto(f) }}/>
                {photoPreview ? (
                  <img src={photoPreview} alt="Preview" style={{ maxWidth:'100%', maxHeight:200, borderRadius:8, display:'block', margin:'0 auto' }}/>
                ) : (
                  <>
                    <div style={{ fontSize:32, marginBottom:10 }}>📷</div>
                    <div style={{ fontSize:13, fontWeight:600, color:'var(--t1)', marginBottom:4 }}>Drop a photo here or click to browse</div>
                    <div style={{ fontSize:12, color:'var(--t3)' }}>JPG, PNG or WEBP -- any photo works</div>
                  </>
                )}
              </div>

              {photoPreview && (
                <div style={{ display:'flex', gap:10, marginTop:14 }}>
                  <button className="btn btn-gold" onClick={generateCompliments} disabled={photoLoading}>
                    {photoLoading ? <><span className="spin"/> Generating...</> : 'Generate Compliment'}
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => { setPhotoPreview(null); setPhotoResults([]) }}>Clear</button>
                </div>
              )}

              {photoResults.length > 0 && (
                <div style={{ marginTop:16 }}>
                  {photoResults.map((r, i) => (
                    <div key={i} style={{ background:'rgba(0,0,0,0.3)', border:'1px solid var(--bd)', borderRadius:10, padding:'12px 14px', marginBottom:8, fontSize:13, color:'var(--t1)', lineHeight:1.7 }}>
                      <div style={{ fontSize:9, fontWeight:700, color:'var(--gl)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>Option {i+1}</div>
                      {r}
                    </div>
                  ))}
                  <div style={{ marginTop:14, padding:'14px 16px', background:'rgba(124,58,237,0.06)', border:'1px solid var(--bd)', borderRadius:10, textAlign:'center' }}>
                    <p style={{ fontSize:13, color:'var(--t2)', marginBottom:12 }}>The extension does this automatically inside your chat window.</p>
                    <button className="btn btn-primary" onClick={() => setStep('signup')}>Claim Free Trial →</button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* PLATFORMS */}
          <div className="section">
            <div style={{ textAlign:'center', marginBottom:20 }}>
              <div style={{ fontFamily:'var(--serif)', fontSize:18, marginBottom:6 }}>Works on Every Platform</div>
              <div style={{ fontSize:13, color:'var(--t3)' }}>Install the Chrome extension for your platform and generate replies directly inside the chat window.</div>
            </div>
            <div className="g2" style={{ marginBottom:16 }}>
              {[
                { icon:'💬', name:'CIC -- Texting Factory', desc:'For chathomebase.com operators. Character rules enforced automatically.', url:EXT_TF },
                { icon:'🌐', name:'General CIC', desc:'Alpha.date, OnlyFans, Fansly, ChatterApply and 8 more platforms.', url:EXT_GEN },
              ].map(e => (
                <div key={e.name} className="card" style={{ textAlign:'center' }}>
                  <div style={{ fontSize:28, marginBottom:8 }}>{e.icon}</div>
                  <div style={{ fontFamily:'var(--serif)', fontSize:13, marginBottom:6 }}>{e.name}</div>
                  <div style={{ fontSize:12, color:'var(--t3)', marginBottom:14, lineHeight:1.6 }}>{e.desc}</div>
                  <a href={e.url} target="_blank" rel="noreferrer" className="btn btn-primary btn-full btn-sm" style={{ marginBottom:8 }}>
                    Install from Chrome Store
                  </a>
                </div>
              ))}
            </div>
            <div style={{ textAlign:'center', fontSize:12, color:'var(--t3)' }}>
              Sign up first then install the extension -- it validates your account automatically.
            </div>
          </div>

          {/* PRICING */}
          <div className="section">
            <div style={{ textAlign:'center', marginBottom:20 }}>
              <div style={{ fontFamily:'var(--serif)', fontSize:18, marginBottom:6 }}>Simple Pricing</div>
              <div style={{ fontSize:13, color:'var(--t3)' }}>Pay via M-Pesa, card, PayPal, or crypto. Available in every country.</div>
            </div>
            <div className="g3">
              {[
                { name:'Free Trial', price:'Free', period:'7 days', color:'var(--ok)', badge:'NOW', features:['Day 1-3: 50 premium replies/day','Day 4-5: 30 basic replies/day','Day 6: 20 basic replies/day','Day 7: 10 basic replies/day','No credit card needed'] },
                { name:'Basic', price:'$8', period:'per month', color:'#60a5fa', badge:'', features:['Unlimited generic replies','All 10+ platforms','Standard AI quality','Both extensions included','No explicit content'] },
                { name:'Pro', price:'$15', period:'per month', color:'var(--pl)', badge:'BEST', features:['Unlimited premium replies','Full explicit and erotic content','Best-in-class AI responses','Priority support','Referral rewards'] },
              ].map(p => (
                <div key={p.name} className="card" style={{ position:'relative', border:p.name==='Pro'?'1px solid rgba(168,85,247,0.4)':undefined }}>
                  {p.badge && <div style={{ position:'absolute', top:10, right:10, background:'linear-gradient(135deg,var(--p),var(--g))', padding:'2px 8px', borderRadius:20, fontSize:9, fontWeight:700, color:'#fff' }}>{p.badge}</div>}
                  <div style={{ color:p.color, fontWeight:700, fontSize:12, fontFamily:'var(--serif)', marginBottom:5 }}>{p.name}</div>
                  <div style={{ fontSize:26, fontWeight:800, marginBottom:2 }}>{p.price}</div>
                  <div style={{ color:'var(--t3)', fontSize:11, marginBottom:14 }}>{p.period}</div>
                  {p.features.map(f => (
                    <div key={f} style={{ display:'flex', gap:6, marginBottom:5, fontSize:11.5, color:'var(--t3)', alignItems:'flex-start' }}>
                      <span style={{ color:p.color, flexShrink:0 }}>+</span>{f}
                    </div>
                  ))}
                  <button className="btn btn-full btn-sm" style={{ marginTop:14, background:p.name==='Pro'?'linear-gradient(135deg,var(--p),var(--g))':'transparent', border:`1px solid ${p.color}`, color:p.name==='Pro'?'#fff':p.color }} onClick={() => setStep('signup')}>
                    {p.name==='Free Trial'?'Start Free':p.name==='Pro'?'Get Pro':'Get Started'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* FOOTER */}
          <footer style={{ borderTop:'1px solid var(--bd)', padding:'24px', textAlign:'center', color:'var(--t3)', fontSize:12 }}>
            <p style={{ marginBottom:8 }}>Chatter's Inner Circle -- AI Reply Assistant -- Available Worldwide</p>
            <p style={{ marginBottom:14 }}>
              Support: <a href="mailto:whwva47@gmail.com" style={{ color:'var(--pl)', textDecoration:'none' }}>whwva47@gmail.com</a>
              {' '}
            </p>
            <div style={{ display:'flex', gap:16, justifyContent:'center', flexWrap:'wrap' as const }}>
              <a href="/dashboard" style={{ color:'var(--t3)', textDecoration:'none' }}>Dashboard</a>
              <a href={EXT_TF} target="_blank" rel="noreferrer" style={{ color:'var(--t3)', textDecoration:'none' }}>TF Extension</a>
              <a href={EXT_GEN} target="_blank" rel="noreferrer" style={{ color:'var(--t3)', textDecoration:'none' }}>General CIC</a>
              <button onClick={() => setStep('signup')} style={{ background:'none', border:'none', color:'var(--t3)', cursor:'pointer', fontSize:12, fontFamily:'var(--sans)' }}>Sign Up</button>
            </div>
          </footer>

        </div>
      </div>
    </>
  )
}
