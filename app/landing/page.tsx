'use client'
import { useState, useEffect } from 'react'

const SITE = 'https://cic-backend-b1ej.vercel.app'

// Chrome Web Store extension IDs
const EXT_TF      = 'https://chromewebstore.google.com/detail/cic-texting-factory/dkgpheiimhedhdfandcgeogmbfmmiobp'
const EXT_GENERAL = 'https://chromewebstore.google.com/detail/cic-general-platforms/dkgpheiimhedhdfandcgeogmbfmmiobp'

export default function LandingPage() {
  const [step, setStep]       = useState('home')
  const [email, setEmail]     = useState('')
  const [referral, setReferral] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg]         = useState('')
  const [guideTab, setGuideTab] = useState('cat1')
  const [tokenLoading, setTokenLoading] = useState(false)
  const [photoPreview, setPhotoPreview] = useState<string|null>(null)
  const [photoCompliments, setPhotoCompliments] = useState<string[]>([])
  const [photoLoading, setPhotoLoading] = useState(false)

  // ── Item 3: Webapp token handler ─────────────────────────────────
  // When operator logs in via extension popup, they land here with ?token=
  // We validate it and redirect to the app with their session set
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token  = params.get('token')
    if (!token) return

    // Remove token from URL immediately
    window.history.replaceState({}, document.title, window.location.pathname)
    setTokenLoading(true)

    fetch(`${SITE}/api/auth/verify-token`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ token })
    })
    .then(r => r.json())
    .then(data => {
      if (data.user) {
        // Save session and redirect to the webapp
        localStorage.setItem('cic_user', JSON.stringify(data.user))
        window.location.href = 'https://cic-app.pages.dev'
      } else {
        setTokenLoading(false)
        setMsg(data.error || 'Login link expired. Please sign in again from the extension.')
        setStep('signup')
      }
    })
    .catch(() => {
      setTokenLoading(false)
    })
  }, [])

  async function handleSignup() {
    if (!email || !email.includes('@')) { setMsg('Please enter a valid email address.'); return }
    setLoading(true)
    setMsg('')
    try {
      const r = await fetch('/api/auth/magic-link', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, phone, referralCode: referral || undefined })
      })
      const d = await r.json()
      if (d.success) setStep('sent')
      else setMsg(d.error || 'Something went wrong')
    } catch(e) {
      setMsg('Connection error. Please try again.')
    }
    setLoading(false)
  }

  // ── Token loading screen ──────────────────────────────────────────
  if (tokenLoading) return (
    <div style={{minHeight:'100vh',background:'#080810',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'sans-serif'}}>
      <div style={{textAlign:'center'}}>
        <div style={{width:'40px',height:'40px',border:'3px solid rgba(168,85,247,0.3)',borderTopColor:'#a855f7',borderRadius:'50%',animation:'spin 0.8s linear infinite',margin:'0 auto 16px'}}/>
        <div style={{color:'#a855f7',fontSize:'14px'}}>Signing you in...</div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  )

  // ── Email sent screen ─────────────────────────────────────────────
  if (step === 'sent') return (
    <div style={{minHeight:'100vh',background:'#080810',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'sans-serif'}}>
      <div style={{textAlign:'center',padding:'40px',maxWidth:'440px'}}>
        <div style={{fontSize:'56px',marginBottom:'16px'}}>📧</div>
        <h2 style={{color:'#a855f7',marginBottom:'12px'}}>Check Your Email</h2>
        <p style={{color:'#71767b',lineHeight:'1.6'}}>We sent a magic link to <b style={{color:'#e2e8f0'}}>{email}</b>. Click it to sign in. Expires in 1 hour.</p>
        <button onClick={()=>setStep('home')} style={{marginTop:'24px',padding:'10px 24px',background:'transparent',border:'1px solid #1e1e32',borderRadius:'8px',color:'#71767b',cursor:'pointer',fontFamily:'sans-serif'}}>← Back</button>
      </div>
    </div>
  )

  // ── Signup screen ─────────────────────────────────────────────────
  if (step === 'signup') return (
    <div style={{minHeight:'100vh',background:'#080810',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'sans-serif'}}>
      <div style={{width:'100%',maxWidth:'400px',padding:'32px 24px'}}>
        <div style={{textAlign:'center',marginBottom:'28px'}}>
          <div style={{width:'52px',height:'52px',background:'linear-gradient(135deg,#7c3aed,#d4a300)',borderRadius:'14px',display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:'24px',marginBottom:'12px'}}>💬</div>
          <h2 style={{color:'#a855f7',margin:'0 0 4px',fontSize:'20px'}}>Create Your Account</h2>
          <p style={{color:'#71767b',margin:0,fontSize:'13px'}}>🎉 Limited promotion — 7 days free. No credit card. Use it while it lasts.</p>
        </div>

        {[
          {label:'Email Address',type:'email',val:email,set:setEmail,ph:'you@example.com',note:''},
          {label:'Referral Code (optional)',type:'text',val:referral,set:setReferral,ph:'Enter referral code',note:''},
        ].map(f => (
          <div key={f.label} style={{marginBottom:'14px'}}>
            <label style={{display:'block',fontSize:'10px',color:'#71767b',marginBottom:'5px',textTransform:'uppercase' as any,letterSpacing:'0.5px'}}>{f.label}</label>
            <input type={f.type} value={f.val} onChange={e=>f.set(e.target.value)} placeholder={f.ph}
              style={{width:'100%',background:'#0f0f1a',border:'1px solid #1e1e32',borderRadius:'7px',padding:'10px 12px',color:'#e2e8f0',fontSize:'13px',boxSizing:'border-box' as any,outline:'none',fontFamily:'sans-serif'}} />
            {f.note && <div style={{fontSize:'10px',color:'#444460',marginTop:'3px'}}>{f.note}</div>}
          </div>
        ))}

        {msg && <div style={{color:'#f43f5e',fontSize:'12px',marginBottom:'12px'}}>{msg}</div>}

        <button onClick={handleSignup} disabled={loading}
          style={{width:'100%',padding:'12px',background:'linear-gradient(135deg,#7c3aed,#9333ea,#d4a300)',border:'none',borderRadius:'8px',color:'#fff',fontSize:'14px',fontWeight:'600',cursor:'pointer',fontFamily:'sans-serif',opacity:loading?0.7:1}}>
          {loading ? 'Sending...' : 'Send Magic Link →'}
        </button>

        <p style={{textAlign:'center',fontSize:'11px',color:'#444460',marginTop:'14px'}}>This free trial is a limited-time promotion. Use it before it changes.</p>
        <button onClick={()=>setStep('home')} style={{display:'block',margin:'8px auto 0',background:'none',border:'none',color:'#444460',cursor:'pointer',fontSize:'12px',fontFamily:'sans-serif'}}>← Back to home</button>
      </div>
    </div>
  )

  // ── Alpha.date guide screen ───────────────────────────────────────
  if (step === 'alphadate-guide') return (
    <div style={{minHeight:'100vh',background:'#080810',color:'#e2e8f0',fontFamily:'sans-serif'}}>
      <div style={{padding:'14px 24px',display:'flex',alignItems:'center',justifyContent:'space-between',borderBottom:'1px solid #1e1e32',position:'sticky' as any,top:0,background:'#080810',zIndex:10}}>
        <div style={{fontWeight:'700',fontSize:'13px',background:'linear-gradient(135deg,#a855f7,#fbbf24)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>Alpha.date Operator Guide</div>
        <button onClick={()=>setStep('home')} style={{padding:'7px 16px',background:'transparent',border:'1px solid #1e1e32',borderRadius:'6px',color:'#71767b',cursor:'pointer',fontSize:'12px',fontFamily:'sans-serif'}}>← Back</button>
      </div>

      <div style={{maxWidth:'720px',margin:'0 auto',padding:'32px 24px'}}>

        {/* Hook Rules */}
        <div style={{background:'#0f0f1a',border:'1px solid rgba(212,163,0,0.25)',borderRadius:'12px',padding:'20px',marginBottom:'20px'}}>
          <h3 style={{color:'#fbbf24',marginBottom:'12px',fontSize:'15px'}}>⚡ Hook Rules — Apply to Every Message and Letter</h3>
          <div style={{background:'rgba(212,163,0,0.06)',border:'1px solid rgba(212,163,0,0.2)',borderRadius:'8px',padding:'14px',marginBottom:'12px'}}>
            <div style={{fontSize:'11px',fontWeight:'700',color:'#fbbf24',textTransform:'uppercase' as any,letterSpacing:'0.05em',marginBottom:'8px'}}>The Golden Rule</div>
            <p style={{fontSize:'13px',color:'#e2e8f0',lineHeight:'1.7',margin:0}}>Every message and every letter must begin with a strong HOOK written in <b>ALL CAPITAL LETTERS</b>. 4–7 words. No punctuation at the end. Never repeat the same hook.</p>
          </div>
          <div style={{display:'grid',gap:'10px'}}>
            {[
              {title:'Message Hook', color:'#a855f7', rule:'4–7 words ALL CAPS, no ending punctuation, followed by body + one question.', ex:'SOMETHING ABOUT YOU SURPRISED ME and I have been trying to figure out what it is ever since. What do most people get wrong about you?'},
              {title:'Letter Hook', color:'#fbbf24', rule:'Same but the hook IS the first sentence of a single paragraph. Max 300 characters total. No emojis.', ex:'YOU HAVE A RARE KIND OF ENERGY and I noticed it immediately — the quiet confidence that does not need to announce itself. What is the quality you value most in someone you want to keep in your life?'},
            ].map(item => (
              <div key={item.title} style={{background:'#080810',border:'1px solid #1e1e32',borderRadius:'8px',padding:'14px'}}>
                <div style={{fontSize:'11px',fontWeight:'700',color:item.color,textTransform:'uppercase' as any,letterSpacing:'0.05em',marginBottom:'6px'}}>{item.title}</div>
                <p style={{fontSize:'12px',color:'#71767b',lineHeight:'1.6',marginBottom:'8px'}}>{item.rule}</p>
                <div style={{background:`rgba(${item.color==='#a855f7'?'168,85,247':'212,163,0'},0.06)`,borderRadius:'6px',padding:'9px',fontSize:'12px',color:item.color==='#a855f7'?'#c4b5fd':'#fcd34d',fontStyle:'italic' as any,lineHeight:'1.5'}}>{item.ex}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Category tabs */}
        <div style={{display:'flex',gap:'8px',marginBottom:'16px',flexWrap:'wrap' as any}}>
          {[
            {id:'cat1',label:'Category 1 — First Outreach'},
            {id:'cat2',label:'Category 2 — Active Chats'},
            {id:'cat3',label:'Category 3 — Bulk Sender'},
            {id:'rules',label:'Absolute Rules'},
          ].map(t => (
            <button key={t.id} onClick={()=>setGuideTab(t.id)}
              style={{padding:'7px 14px',borderRadius:'20px',border:`1px solid ${guideTab===t.id?'#a855f7':'#1e1e32'}`,background:guideTab===t.id?'rgba(168,85,247,0.15)':'transparent',color:guideTab===t.id?'#a855f7':'#71767b',fontSize:'11px',fontWeight:'600',cursor:'pointer',fontFamily:'sans-serif'}}>
              {t.label}
            </button>
          ))}
        </div>

        {guideTab === 'cat1' && (
          <div style={{background:'#0f0f1a',border:'1px solid #1e1e32',borderRadius:'12px',padding:'20px'}}>
            <div style={{display:'inline-block',background:'rgba(168,85,247,0.15)',border:'1px solid rgba(168,85,247,0.3)',borderRadius:'8px',padding:'5px 12px',fontSize:'11px',fontWeight:'700',color:'#a855f7',marginBottom:'14px'}}>CATEGORY 1</div>
            <h3 style={{fontSize:'14px',fontWeight:'700',marginBottom:'10px'}}>First Outreach — /chance page, winks, likes, letters</h3>
            <p style={{fontSize:'13px',color:'#71767b',lineHeight:'1.7',marginBottom:'16px'}}>Use when opening a conversation for the first time — responding to a wink, like, or profile view, or writing a fresh message or letter.</p>
            {[
              {signal:'👋 He sent a wink',ex:'DJ, THAT WINK WAS JUST THE BEGINNING and I have a feeling you already know what comes next. What made you stop on my profile?'},
              {signal:'❤ He liked your profile',ex:'Robert, MOST PEOPLE SCROLL PAST WITHOUT STOPPING and I noticed you did not. What caught your attention?'},
              {signal:'👁 He viewed your profile',ex:'David, THERE IS SOMETHING RARE ABOUT TIMING and I think we might have found it. What are you actually looking for on here?'},
              {signal:'📝 Writing a letter',ex:'YOU HAVE A PRESENCE THAT STAYS WITH YOU and I mean that in the rarest way — the kind that lingers hours after you first noticed it. What has shaped you the most?'},
            ].map(s => (
              <div key={s.signal} style={{background:'#080810',border:'1px solid #1e1e32',borderRadius:'8px',padding:'12px',marginBottom:'10px'}}>
                <div style={{fontSize:'11px',fontWeight:'700',color:'#a855f7',marginBottom:'6px'}}>{s.signal}</div>
                <div style={{fontSize:'12px',color:'#c4b5fd',fontStyle:'italic' as any,lineHeight:'1.5'}}>{s.ex}</div>
              </div>
            ))}
          </div>
        )}

        {guideTab === 'cat2' && (
          <div style={{background:'#0f0f1a',border:'1px solid #1e1e32',borderRadius:'12px',padding:'20px'}}>
            <div style={{display:'inline-block',background:'rgba(34,197,94,0.12)',border:'1px solid rgba(34,197,94,0.25)',borderRadius:'8px',padding:'5px 12px',fontSize:'11px',fontWeight:'700',color:'#22c55e',marginBottom:'14px'}}>CATEGORY 2</div>
            <h3 style={{fontSize:'14px',fontWeight:'700',marginBottom:'10px'}}>Replying to Active or Inactive Chats</h3>
            <p style={{fontSize:'13px',color:'#71767b',lineHeight:'1.7',marginBottom:'16px'}}><b style={{color:'#e2e8f0'}}>ONE SENTENCE ONLY. 15–25 words maximum. No emojis.</b> Match his tone exactly.</p>
            {[
              {tone:'💕 Romantic',ex:'There is something about the way you said that which makes it genuinely hard to think about anything else right now.'},
              {tone:'😄 Playful',ex:'You say that like you have not already thought about exactly what happens next, which I am fairly certain you have.'},
              {tone:'🌊 Serious',ex:'That took courage to say and I want you to know I am genuinely glad you said it to me.'},
              {tone:'⏸ Went silent days ago',ex:'Life has a way of getting loud sometimes and I hope yours has been the good kind of busy since we last spoke.'},
            ].map(s => (
              <div key={s.tone} style={{background:'#080810',border:'1px solid #1e1e32',borderRadius:'8px',padding:'12px',marginBottom:'10px'}}>
                <div style={{fontSize:'11px',fontWeight:'700',color:'#22c55e',marginBottom:'6px'}}>{s.tone}</div>
                <div style={{fontSize:'12px',color:'#86efac',fontStyle:'italic' as any,lineHeight:'1.5'}}>{s.ex}</div>
              </div>
            ))}
          </div>
        )}

        {guideTab === 'cat3' && (
          <div style={{background:'#0f0f1a',border:'1px solid #1e1e32',borderRadius:'12px',padding:'20px'}}>
            <div style={{display:'inline-block',background:'rgba(251,191,36,0.12)',border:'1px solid rgba(251,191,36,0.25)',borderRadius:'8px',padding:'5px 12px',fontSize:'11px',fontWeight:'700',color:'#fbbf24',marginBottom:'14px'}}>CATEGORY 3</div>
            <h3 style={{fontSize:'14px',fontWeight:'700',marginBottom:'10px'}}>Sender Setup — Bulk Content with Emojis</h3>
            <p style={{fontSize:'13px',color:'#71767b',lineHeight:'1.7',marginBottom:'8px'}}>Under 20 words. ~40% start with ALL CAPS hook. <b style={{color:'#fbbf24'}}>Emojis allowed and encouraged.</b> Vary topics widely — unusual questions, hypotheticals, travel, childhood, philosophy.</p>
            {[
              '🌍 THE WORLD SHRANK WHEN YOU STARTED TRAVELLING — what was the first place that genuinely changed how you think?',
              '☕ If you could only keep one morning habit for the rest of your life, what would it be? 🤔',
              '🌙 LATE NIGHT THOUGHTS HIT DIFFERENTLY — what is the last thing you thought about before falling asleep? 💭',
            ].map((ex,i) => (
              <div key={i} style={{background:'rgba(251,191,36,0.06)',borderRadius:'6px',padding:'9px 12px',marginBottom:'8px',fontSize:'12px',color:'#fcd34d',fontStyle:'italic' as any,lineHeight:'1.5'}}>{ex}</div>
            ))}
          </div>
        )}

        {guideTab === 'rules' && (
          <div style={{background:'rgba(244,63,94,0.06)',border:'1px solid rgba(244,63,94,0.2)',borderRadius:'12px',padding:'20px'}}>
            <h3 style={{color:'#f43f5e',fontSize:'14px',marginBottom:'14px'}}>🛑 Absolute Rules — All Categories</h3>
            {[
              'Never repeat the same message or letter. Not in the same shift. Not ever.',
              'Never reuse the same opening hook. Every conversation gets a fresh, original hook.',
              'Never mention AI. Not directly, not indirectly, not as a joke.',
              'No pressure, no desperation in Category 1 or Category 3 letters.',
              'Always proofread before sending. The AI gives a starting point — you make the final call.',
              'Never use generic AI-sounding phrases like "I couldn\'t help but notice" or "based on your profile".',
              'No emojis in Category 1 or Category 2. Emojis only in Category 3.',
            ].map((rule,i) => (
              <div key={i} style={{display:'flex',gap:'10px',padding:'8px 0',borderBottom:'0.5px solid rgba(244,63,94,0.1)',alignItems:'flex-start'}}>
                <span style={{color:'#f43f5e',flexShrink:0,marginTop:'1px'}}>✕</span>
                <span style={{fontSize:'13px',color:'#e2e8f0',lineHeight:'1.6'}}>{rule}</span>
              </div>
            ))}
          </div>
        )}

        <div style={{textAlign:'center',marginTop:'24px',padding:'16px',background:'#0f0f1a',border:'1px solid #1e1e32',borderRadius:'10px'}}>
          <p style={{fontSize:'13px',color:'#71767b',margin:0}}>Questions about a specific scenario? WhatsApp <b style={{color:'#e2e8f0'}}>+254 113 178 973</b></p>
        </div>
      </div>
    </div>
  )

  // ── Photo demo screen ────────────────────────────────────────────
  if (step === 'photo-demo') return (
    <div style={{minHeight:'100vh',background:'#080810',color:'#e2e8f0',fontFamily:'sans-serif'}}>
      <div style={{padding:'14px 24px',display:'flex',alignItems:'center',justifyContent:'space-between',borderBottom:'1px solid #1e1e32',position:'sticky' as any,top:0,background:'#080810',zIndex:10}}>
        <div style={{fontWeight:'700',fontSize:'13px',background:'linear-gradient(135deg,#a855f7,#fbbf24)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>📸 Photo Compliment Demo</div>
        <button onClick={()=>{setStep('home');setPhotoPreview(null);setPhotoCompliments([])}} style={{padding:'7px 16px',background:'transparent',border:'1px solid #1e1e32',borderRadius:'6px',color:'#71767b',cursor:'pointer',fontSize:'12px',fontFamily:'sans-serif'}}>← Back</button>
      </div>

      <div style={{maxWidth:'600px',margin:'0 auto',padding:'32px 24px'}}>

        <div style={{textAlign:'center',marginBottom:'28px'}}>
          <div style={{display:'inline-block',padding:'5px 14px',background:'rgba(212,163,0,0.12)',border:'1px solid rgba(212,163,0,0.3)',borderRadius:'20px',fontSize:'11px',color:'#fbbf24',marginBottom:'14px'}}>Live Demo — No account needed</div>
          <h2 style={{fontSize:'22px',fontWeight:'800',marginBottom:'8px'}}>
            Upload a photo.<br/>
            <span style={{background:'linear-gradient(135deg,#a855f7,#fbbf24)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>Watch CIC compliment it.</span>
          </h2>
          <p style={{fontSize:'13px',color:'#71767b',lineHeight:'1.6',maxWidth:'400px',margin:'0 auto'}}>
            Drop any photo — a profile picture, a selfie, anything. CIC will generate a warm, specific, personal compliment that feels genuinely human.
          </p>
        </div>

        {/* Upload box */}
        {!photoPreview && (
          <div
            onClick={()=>document.getElementById('photo-upload-input')?.click()}
            style={{border:'2px dashed rgba(212,163,0,0.3)',borderRadius:'16px',padding:'48px 24px',textAlign:'center',cursor:'pointer',background:'rgba(212,163,0,0.03)',transition:'all 0.2s'}}
            onMouseEnter={e=>(e.currentTarget.style.borderColor='rgba(212,163,0,0.6)')}
            onMouseLeave={e=>(e.currentTarget.style.borderColor='rgba(212,163,0,0.3)')}>
            <input
              type="file" id="photo-upload-input" accept="image/*"
              style={{display:'none'}}
              onChange={e=>{
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = ev => setPhotoPreview(ev.target?.result as string);
                reader.readAsDataURL(file);
                setPhotoCompliments([]);
              }}
            />
            <div style={{fontSize:'48px',marginBottom:'12px'}}>📸</div>
            <div style={{fontSize:'15px',fontWeight:'600',color:'#e2e8f0',marginBottom:'6px'}}>Click to upload a photo</div>
            <div style={{fontSize:'12px',color:'#71767b'}}>JPG, PNG or WEBP · Any photo works</div>
          </div>
        )}

        {/* Preview + generate */}
        {photoPreview && (
          <div>
            <div style={{background:'#0f0f1a',border:'1px solid #1e1e32',borderRadius:'16px',padding:'20px',marginBottom:'16px',textAlign:'center'}}>
              <img src={photoPreview} alt="Uploaded photo" style={{maxWidth:'100%',maxHeight:'280px',borderRadius:'10px',objectFit:'cover'}}/>
              <button
                onClick={()=>{setPhotoPreview(null);setPhotoCompliments([])}}
                style={{display:'block',margin:'12px auto 0',background:'transparent',border:'none',color:'#71767b',cursor:'pointer',fontSize:'12px',fontFamily:'sans-serif'}}>
                ✕ Remove photo
              </button>
            </div>

            {photoCompliments.length === 0 && (
              <button
                onClick={async()=>{
                  setPhotoLoading(true);
                  await new Promise(r=>setTimeout(r,1600+Math.random()*800));
                  setPhotoCompliments([
                    'Something about this photo is genuinely striking — there is a quiet confidence in the way you carry yourself that most people spend years trying to find. What were you thinking when this was taken?',
                    'That smile tells a story and I am not sure I have figured out all of it yet. There is something behind the eyes that makes me want to understand the person behind this photo better. What is the version of you that most people never get to see?',
                    'You have a very specific kind of energy in this photo — the kind that feels completely effortless but is actually quite rare. What is one thing about you that this photo would never be able to capture?',
                  ]);
                  setPhotoLoading(false);
                }}
                disabled={photoLoading}
                style={{width:'100%',padding:'14px',background:'linear-gradient(135deg,#7c3aed,#d4a300)',border:'none',borderRadius:'10px',color:'#fff',fontSize:'14px',fontWeight:'700',cursor:'pointer',fontFamily:'sans-serif',opacity:photoLoading?0.7:1,display:'flex',alignItems:'center',justifyContent:'center',gap:'10px'}}>
                {photoLoading
                  ? <><div style={{width:'16px',height:'16px',border:'2px solid rgba(255,255,255,0.3)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin 0.7s linear infinite'}}></div>Generating compliment...</>
                  : '💌 Generate Compliment'}
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              </button>
            )}

            {/* Compliment results */}
            {photoCompliments.length > 0 && (
              <div>
                <div style={{fontSize:'11px',color:'#71767b',textTransform:'uppercase' as any,letterSpacing:'0.08em',fontWeight:'700',marginBottom:'12px'}}>Generated Compliments</div>
                {photoCompliments.map((c,i)=>(
                  <div key={i} style={{background:'#0f0f1a',border:'1px solid rgba(212,163,0,0.2)',borderRadius:'10px',padding:'16px',marginBottom:'10px'}}>
                    <div style={{fontSize:'10px',fontWeight:'700',color:'#fbbf24',textTransform:'uppercase' as any,letterSpacing:'0.08em',marginBottom:'8px'}}>Option {i+1}</div>
                    <div style={{fontSize:'13px',color:'#e2e8f0',lineHeight:'1.7',marginBottom:'10px'}}>{c}</div>
                    <button
                      onClick={()=>navigator.clipboard.writeText(c)}
                      style={{padding:'6px 14px',background:'transparent',border:'1px solid rgba(212,163,0,0.3)',borderRadius:'6px',color:'#fbbf24',fontSize:'11px',fontWeight:'600',cursor:'pointer',fontFamily:'sans-serif'}}>
                      ⎘ Copy
                    </button>
                  </div>
                ))}
                <button
                  onClick={()=>setPhotoCompliments([])}
                  style={{width:'100%',marginTop:'6px',padding:'10px',background:'transparent',border:'1px solid #1e1e32',borderRadius:'8px',color:'#71767b',fontSize:'12px',cursor:'pointer',fontFamily:'sans-serif'}}>
                  ↺ Regenerate
                </button>

                {/* CTA */}
                <div style={{background:'rgba(124,58,237,0.08)',border:'1px solid rgba(124,58,237,0.25)',borderRadius:'12px',padding:'20px',marginTop:'20px',textAlign:'center'}}>
                  <div style={{fontSize:'14px',fontWeight:'700',color:'#e2e8f0',marginBottom:'6px'}}>Want this inside every chat?</div>
                  <p style={{fontSize:'12px',color:'#71767b',lineHeight:'1.6',marginBottom:'14px'}}>The CIC extension detects photos automatically and generates compliments like these directly inside your chat window — no copy-pasting.</p>
                  <button onClick={()=>setStep('signup')} style={{padding:'11px 28px',background:'linear-gradient(135deg,#7c3aed,#d4a300)',border:'none',borderRadius:'8px',color:'#fff',fontSize:'13px',fontWeight:'700',cursor:'pointer',fontFamily:'sans-serif'}}>
                    Claim Free Trial →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )

  // ── Install guide screen ──────────────────────────────────────────
  if (step === 'install-guide') return (
    <div style={{minHeight:'100vh',background:'#080810',color:'#e2e8f0',fontFamily:'sans-serif'}}>
      <div style={{padding:'14px 24px',display:'flex',alignItems:'center',justifyContent:'space-between',borderBottom:'1px solid #1e1e32',position:'sticky' as any,top:0,background:'#080810',zIndex:10}}>
        <div style={{fontWeight:'700',fontSize:'13px',color:'#a855f7'}}>How to Install the Extension</div>
        <button onClick={()=>setStep('home')} style={{padding:'7px 16px',background:'transparent',border:'1px solid #1e1e32',borderRadius:'6px',color:'#71767b',cursor:'pointer',fontSize:'12px',fontFamily:'sans-serif'}}>← Back</button>
      </div>
      <div style={{maxWidth:'600px',margin:'0 auto',padding:'32px 24px'}}>

        {/* Which extension */}
        <h3 style={{color:'#fbbf24',marginBottom:'16px',fontSize:'15px'}}>Step 1 — Choose your extension</h3>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px',marginBottom:'28px'}}>
          {[
            {name:'CIC — Texting Factory',desc:'For chathomebase.com and Texting Factory operators',icon:'💬',url:EXT_TF},
            {name:'CIC — General Platforms',desc:'For Alpha.date, OnlyFans, Fansly and all other platforms',icon:'🌐',url:EXT_GENERAL},
          ].map(e => (
            <div key={e.name} style={{background:'#0f0f1a',border:'1px solid #1e1e32',borderRadius:'10px',padding:'18px',textAlign:'center'}}>
              <div style={{fontSize:'26px',marginBottom:'8px'}}>{e.icon}</div>
              <div style={{fontWeight:'600',fontSize:'12px',marginBottom:'5px'}}>{e.name}</div>
              <div style={{color:'#71767b',fontSize:'10px',marginBottom:'12px'}}>{e.desc}</div>
              <a href={e.url} target="_blank" rel="noreferrer"
                style={{display:'block',padding:'7px',background:'linear-gradient(135deg,#7c3aed,#d4a300)',borderRadius:'6px',color:'#fff',fontSize:'11px',fontWeight:'600',textDecoration:'none'}}>
                Install from Chrome Store →
              </a>
            </div>
          ))}
        </div>

        <h3 style={{color:'#fbbf24',marginBottom:'16px',fontSize:'15px'}}>Step 2 — Install it</h3>
        {[
          'Click the button above — it opens the Chrome Web Store page for that extension',
          'Click the blue "Add to Chrome" button on the Chrome Web Store page',
          'Click "Add extension" in the popup that appears',
          'The CIC icon will appear in your Chrome toolbar (top right)',
        ].map((s,i) => (
          <div key={i} style={{display:'flex',gap:'12px',alignItems:'flex-start',marginBottom:'12px'}}>
            <div style={{width:'24px',height:'24px',borderRadius:'50%',background:'linear-gradient(135deg,#7c3aed,#d4a300)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'11px',fontWeight:'700',flexShrink:0}}>{i+1}</div>
            <div style={{fontSize:'13px',color:'#71767b',lineHeight:'1.6',paddingTop:'2px'}}>{s}</div>
          </div>
        ))}

        <h3 style={{color:'#fbbf24',margin:'24px 0 16px',fontSize:'15px'}}>Step 3 — Log in to the extension</h3>
        {[
          'Click the CIC icon in your Chrome toolbar',
          'Enter the email address you signed up with on this page',
          'Click Sign In — the extension opens the app and logs you in automatically',
        ].map((s,i) => (
          <div key={i} style={{display:'flex',gap:'12px',alignItems:'flex-start',marginBottom:'12px'}}>
            <div style={{width:'24px',height:'24px',borderRadius:'50%',background:'rgba(168,85,247,0.2)',border:'1px solid rgba(168,85,247,0.4)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'11px',fontWeight:'700',color:'#a855f7',flexShrink:0}}>{i+1}</div>
            <div style={{fontSize:'13px',color:'#71767b',lineHeight:'1.6',paddingTop:'2px'}}>{s}</div>
          </div>
        ))}

        <div style={{marginTop:'24px',background:'rgba(34,197,94,0.06)',border:'1px solid rgba(34,197,94,0.2)',borderRadius:'10px',padding:'16px',textAlign:'center'}}>
          <p style={{fontSize:'13px',color:'#22c55e',margin:'0 0 8px',fontWeight:'600'}}>✓ Not signed up yet?</p>
          <button onClick={()=>setStep('signup')} style={{padding:'9px 24px',background:'linear-gradient(135deg,#7c3aed,#d4a300)',border:'none',borderRadius:'7px',color:'#fff',fontSize:'13px',fontWeight:'600',cursor:'pointer',fontFamily:'sans-serif'}}>
            Create Free Account →
          </button>
        </div>
      </div>
    </div>
  )

  // ── Home screen ───────────────────────────────────────────────────
  return (
    <div style={{minHeight:'100vh',background:'#080810',color:'#e2e8f0',fontFamily:'sans-serif'}}>

      {/* Nav */}
      <div style={{padding:'14px 24px',display:'flex',alignItems:'center',justifyContent:'space-between',borderBottom:'1px solid #1e1e32',position:'sticky' as any,top:0,background:'#080810',zIndex:10}}>
        <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
          <div style={{width:'34px',height:'34px',background:'linear-gradient(135deg,#7c3aed,#d4a300)',borderRadius:'9px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'16px'}}>💬</div>
          <div>
            <div style={{fontWeight:'700',fontSize:'13px',background:'linear-gradient(135deg,#a855f7,#fbbf24)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>Chatter's Inner Circle</div>
            <div style={{fontSize:'10px',color:'#444460'}}>AI Reply Assistant · Available Worldwide</div>
          </div>
        </div>
        <div style={{display:'flex',gap:'8px'}}>
          <button onClick={()=>setStep('install-guide')} style={{padding:'8px 14px',background:'transparent',border:'1px solid #1e1e32',borderRadius:'7px',color:'#71767b',cursor:'pointer',fontSize:'11px',fontFamily:'sans-serif'}}>
            Install Extension
          </button>
          <button onClick={()=>setStep('signup')} style={{padding:'8px 18px',background:'linear-gradient(135deg,#7c3aed,#d4a300)',border:'none',borderRadius:'7px',color:'#fff',fontWeight:'600',cursor:'pointer',fontSize:'12px',fontFamily:'sans-serif'}}>
            Get Started
          </button>
        </div>
      </div>

      {/* Hero */}
      <div style={{maxWidth:'680px',margin:'0 auto',padding:'70px 24px 40px',textAlign:'center'}}>
        <div style={{display:'inline-block',padding:'5px 14px',background:'rgba(124,58,237,0.15)',border:'1px solid rgba(124,58,237,0.3)',borderRadius:'20px',fontSize:'11px',color:'#a855f7',marginBottom:'18px'}}>
          AI Reply Assistant · 10+ Platforms · No Country Restrictions
        </div>
        <h1 style={{fontSize:'clamp(26px,5vw,46px)',fontWeight:'800',margin:'0 0 14px',lineHeight:'1.2'}}>
          Replies That Get Him
          <span style={{display:'block',background:'linear-gradient(135deg,#a855f7,#fbbf24)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>
            Hooked Every Time
          </span>
        </h1>
        <p style={{fontSize:'15px',color:'#71767b',lineHeight:'1.6',maxWidth:'480px',margin:'0 auto 28px'}}>
          CIC generates smart, warm replies for operators on dating and subscription platforms. Works on Texting Factory, Alpha.date, OnlyFans, Fansly, and more. Available in every country.
        </p>
        <div style={{display:'flex',gap:'12px',justifyContent:'center',flexWrap:'wrap' as any}}>
          <button onClick={()=>setStep('signup')} style={{padding:'13px 32px',background:'linear-gradient(135deg,#7c3aed,#d4a300)',border:'none',borderRadius:'9px',color:'#fff',fontSize:'15px',fontWeight:'700',cursor:'pointer',boxShadow:'0 4px 20px rgba(124,58,237,0.35)',fontFamily:'sans-serif'}}>
            Claim Free Trial — 7 Days 🎉
          </button>
          <button onClick={()=>setStep('install-guide')} style={{padding:'13px 24px',background:'transparent',border:'1px solid rgba(168,85,247,0.4)',borderRadius:'9px',color:'#a855f7',fontSize:'14px',fontWeight:'600',cursor:'pointer',fontFamily:'sans-serif'}}>
            Download Extension →
          </button>
        </div>

        {/* Photo demo CTA */}
        <div style={{marginTop:'20px'}}>
          <button onClick={()=>setStep('photo-demo')}
            style={{display:'inline-flex',alignItems:'center',gap:'8px',padding:'10px 22px',background:'rgba(212,163,0,0.1)',border:'1px solid rgba(212,163,0,0.35)',borderRadius:'30px',color:'#fbbf24',fontSize:'13px',fontWeight:'600',cursor:'pointer',fontFamily:'sans-serif',transition:'all 0.2s'}}>
            📸 Try it — upload a photo and see how CIC compliments it
          </button>
        </div>
      </div>

      {/* Photo Demo Feature Section */}
      <div style={{maxWidth:'680px',margin:'0 auto',padding:'0 24px 56px'}}>
        <div style={{background:'rgba(212,163,0,0.06)',border:'1px solid rgba(212,163,0,0.2)',borderRadius:'16px',padding:'28px',textAlign:'center'}}>
          <div style={{display:'inline-block',padding:'5px 14px',background:'rgba(212,163,0,0.15)',border:'1px solid rgba(212,163,0,0.3)',borderRadius:'20px',fontSize:'11px',color:'#fbbf24',marginBottom:'14px',fontWeight:'600'}}>
            LIVE DEMO — Try it yourself
          </div>
          <h2 style={{fontSize:'20px',fontWeight:'700',marginBottom:'10px',color:'#e2e8f0'}}>
            Upload a photo. Watch CIC compliment it.
          </h2>
          <p style={{fontSize:'13px',color:'#71767b',lineHeight:'1.7',maxWidth:'460px',margin:'0 auto 20px'}}>
            Drop any photo — a profile picture, a selfie, anything. CIC reads the image and generates a warm, specific, personal compliment that feels genuinely human. This is exactly what the extension does inside the chat window.
          </p>
          <button onClick={()=>setStep('photo-demo')}
            style={{padding:'13px 32px',background:'linear-gradient(135deg,#d4a300,#fbbf24)',border:'none',borderRadius:'9px',color:'#0a0a1a',fontSize:'14px',fontWeight:'700',cursor:'pointer',fontFamily:'sans-serif',boxShadow:'0 4px 20px rgba(212,163,0,0.35)'}}>
            📸 Upload a Photo — See the Magic
          </button>
          <div style={{display:'flex',gap:'20px',justifyContent:'center',marginTop:'16px',flexWrap:'wrap' as any}}>
            {['Reads the photo intelligently','Generates 3 specific options','Feels genuinely personal, not generic'].map((f,i) => (
              <div key={i} style={{display:'flex',alignItems:'center',gap:'6px',fontSize:'11px',color:'#71767b'}}>
                <span style={{color:'#fbbf24'}}>✓</span>{f}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Extensions — Item 1: real Chrome Web Store links */}
      <div style={{maxWidth:'680px',margin:'0 auto',padding:'0 24px 60px'}}>
        <h2 style={{textAlign:'center',color:'#fbbf24',marginBottom:'6px',fontSize:'18px'}}>Chrome Extensions</h2>
        <p style={{textAlign:'center',color:'#71767b',fontSize:'12px',marginBottom:'18px'}}>Install the extension for your platform. Sign up first to activate it.</p>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'14px'}}>
          {[
            {name:'CIC — Texting Factory',desc:'chathomebase.com & Texting Factory',icon:'💬',url:EXT_TF,guide:null},
            {name:'CIC — General Platforms',desc:'Alpha.date, OnlyFans, Fansly & more',icon:'🌐',url:EXT_GENERAL,guide:'alphadate-guide'},
          ].map(e => (
            <div key={e.name} style={{background:'#0f0f1a',border:'1px solid #1e1e32',borderRadius:'10px',padding:'20px',textAlign:'center'}}>
              <div style={{fontSize:'28px',marginBottom:'8px'}}>{e.icon}</div>
              <div style={{fontWeight:'600',fontSize:'13px',marginBottom:'5px'}}>{e.name}</div>
              <div style={{color:'#71767b',fontSize:'11px',marginBottom:'12px'}}>{e.desc}</div>
              <a href={e.url} target="_blank" rel="noreferrer"
                style={{display:'block',padding:'7px 16px',background:'linear-gradient(135deg,#7c3aed,#d4a300)',borderRadius:'6px',color:'#fff',fontSize:'11px',fontWeight:'600',textDecoration:'none',marginBottom:'8px'}}>
                Install from Chrome Store →
              </a>
              {e.guide && (
                <button onClick={()=>setStep(e.guide!)} style={{width:'100%',padding:'6px',background:'transparent',border:'1px solid rgba(251,191,36,0.3)',borderRadius:'6px',color:'#fbbf24',fontSize:'10px',fontWeight:'600',cursor:'pointer',fontFamily:'sans-serif'}}>
                  📖 View Alpha.date Guide
                </button>
              )}
              <button onClick={()=>setStep('install-guide')} style={{width:'100%',marginTop:'6px',padding:'6px',background:'transparent',border:'1px solid #1e1e32',borderRadius:'6px',color:'#444460',fontSize:'10px',cursor:'pointer',fontFamily:'sans-serif'}}>
                How to install →
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Plans */}
      <div style={{maxWidth:'780px',margin:'0 auto',padding:'0 24px 70px'}}>
        <h2 style={{textAlign:'center',marginBottom:'8px',fontSize:'18px'}}>Simple Pricing</h2>
        <p style={{textAlign:'center',color:'#71767b',fontSize:'12px',marginBottom:'24px'}}>Available worldwide. Pay via M-Pesa, card, PayPal, or crypto.</p>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))',gap:'14px'}}>
          {[
            {name:'Free Trial',price:'Free',period:'Limited Promotion',color:'#22c55e',badge:'NOW',features:['Full Pro access days 1–3','20 replies/day days 4–7','Both extensions included','All 10 platforms','No credit card · Claim now']},
            {name:'Basic',price:'$8',period:'per month',color:'#60a5fa',badge:'',features:['50 replies per day','All 10 platforms','Standard AI quality','Both extensions','Email support']},
            {name:'Pro',price:'$15',period:'per month',color:'#a855f7',badge:'BEST',features:['Unlimited replies daily','Full explicit content','Premium AI quality','Priority support','Referral rewards']},
          ].map(p => (
            <div key={p.name} style={{background:'#0f0f1a',border:`1px solid ${p.name==='Pro'?'rgba(168,85,247,0.4)':'#1e1e32'}`,borderRadius:'10px',padding:'22px',position:'relative' as any}}>
              {p.badge && <div style={{position:'absolute' as any,top:'10px',right:'10px',background:'linear-gradient(135deg,#7c3aed,#d4a300)',padding:'2px 8px',borderRadius:'10px',fontSize:'9px',fontWeight:'700',color:'#fff'}}>{p.badge}</div>}
              <div style={{color:p.color,fontWeight:'700',marginBottom:'6px',fontSize:'13px'}}>{p.name}</div>
              <div style={{fontSize:'26px',fontWeight:'800',marginBottom:'3px'}}>{p.price}</div>
              <div style={{color:'#444460',fontSize:'11px',marginBottom:'18px'}}>{p.period}</div>
              {p.features.map(f => (
                <div key={f} style={{display:'flex',gap:'7px',marginBottom:'7px',fontSize:'12px',color:'#71767b',alignItems:'flex-start'}}>
                  <span style={{color:p.color,flexShrink:0}}>✓</span>{f}
                </div>
              ))}
              <button onClick={()=>setStep('signup')} style={{width:'100%',marginTop:'14px',padding:'9px',background:p.name==='Pro'?'linear-gradient(135deg,#7c3aed,#d4a300)':'transparent',border:`1px solid ${p.color}`,borderRadius:'6px',color:p.name==='Pro'?'#fff':p.color,cursor:'pointer',fontWeight:'600',fontSize:'12px',fontFamily:'sans-serif'}}>
                {p.name==='Free Trial'?'Start Free':p.name==='Pro'?'Get Pro':'Get Started'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Payment */}
      <div style={{maxWidth:'560px',margin:'0 auto',padding:'0 24px 70px',textAlign:'center'}}>
        <div style={{background:'rgba(124,58,237,0.05)',border:'1px solid rgba(124,58,237,0.2)',borderRadius:'12px',padding:'28px'}}>
          <h3 style={{color:'#a855f7',marginBottom:'12px',fontSize:'16px'}}>How to Pay for Pro</h3>
          <p style={{color:'#71767b',fontSize:'13px',lineHeight:'1.6',margin:'0 0 12px'}}>
            Payment details are sent privately to your email when you request a Pro upgrade inside the extension. We accept M-Pesa, Visa, Mastercard, PayPal, and crypto.
          </p>
          <p style={{color:'#444460',fontSize:'11px',margin:0}}>Available in every country. No geo restrictions.</p>
        </div>
      </div>

      {/* Referral */}
      <div style={{maxWidth:'560px',margin:'0 auto',padding:'0 24px 70px',textAlign:'center'}}>
        <div style={{background:'rgba(234,179,8,0.08)',border:'1px solid rgba(234,179,8,0.2)',borderRadius:'12px',padding:'28px'}}>
          <div style={{fontSize:'30px',marginBottom:'10px'}}>🎁</div>
          <h3 style={{color:'#fbbf24',marginBottom:'10px',fontSize:'16px'}}>Refer Friends, Earn Pro Free</h3>
          <p style={{color:'#71767b',fontSize:'13px',lineHeight:'1.6',margin:'0 0 12px'}}>
            Every referral earns <b style={{color:'#fbbf24'}}>150 points</b>. Collect <b style={{color:'#fbbf24'}}>1,500 points</b> and get 1 month Pro free ($15 value).
          </p>
          <p style={{color:'#444460',fontSize:'11px',margin:0}}>Your referral code appears in the extension after signup.</p>
        </div>
      </div>

      {/* Footer */}
      <div style={{borderTop:'1px solid #111120',padding:'24px',textAlign:'center',color:'#444460',fontSize:'11px'}}>
        <p style={{margin:'0 0 6px'}}>Chatter's Inner Circle © 2026 — AI Reply Assistant · Available Worldwide</p>
        <p style={{margin:'0 0 8px'}}>Support: <a href="mailto:whwva47@gmail.com" style={{color:'#a855f7',textDecoration:'none'}}>whwva47@gmail.com</a></p>
        <div style={{display:'flex',gap:'16px',justifyContent:'center',flexWrap:'wrap' as any}}>
          <button onClick={()=>setStep('photo-demo')} style={{background:'none',border:'none',color:'#71767b',cursor:'pointer',fontSize:'11px',fontFamily:'sans-serif'}}>📸 Photo Demo</button>
          <button onClick={()=>setStep('alphadate-guide')} style={{background:'none',border:'none',color:'#71767b',cursor:'pointer',fontSize:'11px',fontFamily:'sans-serif'}}>Alpha.date Guide</button>
          <button onClick={()=>setStep('install-guide')} style={{background:'none',border:'none',color:'#71767b',cursor:'pointer',fontSize:'11px',fontFamily:'sans-serif'}}>Install Guide</button>
          <a href={EXT_TF} target="_blank" rel="noreferrer" style={{color:'#71767b',textDecoration:'none',fontSize:'11px'}}>TF Extension</a>
          <a href={EXT_GENERAL} target="_blank" rel="noreferrer" style={{color:'#71767b',textDecoration:'none',fontSize:'11px'}}>General Extension</a>
        </div>
      </div>
    </div>
  )
}
