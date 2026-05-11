'use client'

import { useState } from 'react'

export default function LandingPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState('signup')

  async function handleSignup() {
    if (!email.includes('@')) return

    setLoading(true)

    try {
      const r = await fetch('/api/auth/magic-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      })

      const d = await r.json()

      if (d.success) {
        setStep('sent')
      }
    } catch (e) {
      console.log(e)
    }

    setLoading(false)
  }

  if (step === 'sent') {
    return (
      <div style={{
        minHeight:'100vh',
        background:'#050510',
        color:'white',
        display:'flex',
        alignItems:'center',
        justifyContent:'center',
        fontFamily:'sans-serif'
      }}>

        <div style={{
          maxWidth:'500px',
          textAlign:'center',
          padding:'40px'
        }}>

          <h1 style={{
            fontSize:'52px',
            fontWeight:'800',
            marginBottom:'24px',
            background:'linear-gradient(135deg,#a855f7,#fbbf24)',
            WebkitBackgroundClip:'text',
            WebkitTextFillColor:'transparent'
          }}>
            Check Your Email
          </h1>

          <p style={{
            color:'#94a3b8',
            fontSize:'22px',
            lineHeight:'1.8'
          }}>
            We sent a magic link to
            <br />

            <span style={{
              color:'white',
              fontWeight:'700'
            }}>
              {email}
            </span>
          </p>

        </div>

      </div>
    )
  }

  return (
    <div style={{
      minHeight:'100vh',
      background:'#050510',
      color:'white',
      display:'flex',
      alignItems:'center',
      justifyContent:'center',
      fontFamily:'sans-serif'
    }}>

      <div style={{
        maxWidth:'900px',
        width:'100%',
        textAlign:'center',
        padding:'40px'
      }}>

        <div style={{
          display:'inline-block',
          padding:'8px 18px',
          border:'1px solid rgba(168,85,247,0.4)',
          borderRadius:'999px',
          color:'#c084fc',
          fontSize:'13px',
          marginBottom:'30px'
        }}>
          AI Reply Assistant • 10+ Platforms
        </div>

        <h1 style={{
          fontSize:'72px',
          fontWeight:'900',
          lineHeight:'1.1',
          marginBottom:'24px'
        }}>
          Replies That Get Him
          <br />

          <span style={{
            background:'linear-gradient(135deg,#a855f7,#fbbf24)',
            WebkitBackgroundClip:'text',
            WebkitTextFillColor:'transparent'
          }}>
            Hooked Every Time
          </span>
        </h1>

        <p style={{
          color:'#94a3b8',
          fontSize:'22px',
          lineHeight:'1.7',
          maxWidth:'700px',
          margin:'0 auto 40px'
        }}>
          Smart AI replies for operators on dating and subscription platforms.
        </p>

        <div style={{
          display:'flex',
          gap:'14px',
          maxWidth:'700px',
          margin:'0 auto'
        }}>

          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            style={{
              flex:1,
              background:'#111827',
              border:'1px solid #27272a',
              borderRadius:'14px',
              padding:'18px 22px',
              color:'white',
              fontSize:'18px',
              outline:'none'
            }}
          />

          <button
            onClick={handleSignup}
            disabled={loading}
            style={{
              padding:'18px 34px',
              border:'none',
              borderRadius:'14px',
              background:'linear-gradient(135deg,#7c3aed,#fbbf24)',
              color:'white',
              fontWeight:'700',
              fontSize:'17px',
              cursor:'pointer'
            }}
          >
            {loading ? 'Sending...' : 'Get Started'}
          </button>

        </div>

      </div>

    </div>
  )
}
