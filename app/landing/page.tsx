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

  // EMAIL SENT SCREEN
  if (step === 'sent') {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="max-w-md text-center px-6">

          <h1 className="text-5xl font-bold mb-6 text-purple-500">
            Check Your Email
          </h1>

          <p className="text-gray-400 text-xl leading-9">
            We sent a magic link to
            <br />

            <span className="text-white font-semibold">
              {email}
            </span>
          </p>

        </div>
      </div>
    )
  }

  // SIGNUP SCREEN
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">

      <div className="max-w-2xl w-full text-center px-6">

        <div className="inline-block px-4 py-2 border border-purple-500 rounded-full text-purple-400 text-sm mb-6">
          AI Reply Assistant
        </div>

        <h1 className="text-6xl font-bold leading-tight mb-6">
          Replies That Get Him
          <br />

          <span className="bg-gradient-to-r from-purple-500 to-yellow-400 text-transparent bg-clip-text">
            Hooked Every Time
          </span>
        </h1>

        <p className="text-gray-400 text-lg leading-8 mb-10">
          Smart AI replies for operators on dating and subscription platforms.
        </p>

        <div className="flex gap-4 max-w-2xl mx-auto">

          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            className="flex-1 bg-[#111] border border-[#222] rounded-xl px-5 py-4 text-white outline-none"
          />

          <button
            onClick={handleSignup}
            disabled={loading}
            className="px-8 py-4 rounded-xl bg-gradient-to-r from-purple-600 to-yellow-500 font-bold"
          >
            {loading ? 'Sending...' : 'Get Started'}
          </button>

        </div>

      </div>

    </div>
  )
}
