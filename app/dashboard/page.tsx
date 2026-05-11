'use client'

import { useState } from 'react'

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState('live demo')

  const sidebar = [
    'Live Demo',
    'Extensions',
    'Install Guide',
    'AI Functions',
    'Analytics',
    'Billing',
    'Settings',
  ]

  const packages = [
    {
      title: 'Texting Factory',
      price: '$19/mo',
      desc: 'Optimized for Texting Factory workflows and fast AI reply generation.',
      download: 'TEXTING_FACTORY_EXTENSION_LINK'
    },
    {
      title: 'General Platforms',
      price: '$39/mo',
      desc: 'Supports Alpha.date, OF, Fansly and multi-platform workflows.',
      download: 'GENERAL_PLATFORMS_EXTENSION_LINK'
    },
    {
      title: 'Premium AI Suite',
      price: '$79/mo',
      desc: 'Advanced AI memory, engagement analytics and custom personalities.',
      download: 'PREMIUM_UPGRADE_LINK'
    }
  ]

  return (
    <div
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(circle at top,#111827 0%,#050510 45%,#020308 100%)',
        color: 'white',
        display: 'flex',
        fontFamily: 'var(--font-inter)',
      }}
    >
      <div
        style={{
          width: '290px',
          padding: '28px',
          borderRight: '1px solid rgba(255,255,255,0.05)',
          background: 'rgba(255,255,255,0.03)',
          backdropFilter: 'blur(18px)',
        }}
      >
        <div
          className="heading-font"
          style={{
            fontSize: '36px',
            fontWeight: '900',
            lineHeight: '0.9',
            letterSpacing: '-3px',
            marginBottom: '50px',
          }}
        >
          <span
            style={{
              background:
                'linear-gradient(135deg,#a855f7,#ec4899,#fbbf24)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            CIC
          </span>
          <br />
          Workspace
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          {sidebar.map((item) => (
            <div
              key={item}
              onClick={() => setActiveTab(item.toLowerCase())}
              style={{
                padding: '16px 18px',
                borderRadius: '18px',
                background:
                  activeTab === item.toLowerCase()
                    ? 'linear-gradient(135deg,#7c3aed,#ec4899)'
                    : 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.06)',
                color: 'white',
                fontWeight: '600',
                cursor: 'pointer',
                transition: '0.25s',
              }}
            >
              {item}
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          flex: 1,
          padding: '40px',
          overflowY: 'auto',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
        }}
      >
        {activeTab === 'live demo' && (
          <div
            style={{
              width: '100%',
              maxWidth: '960px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '34px',
              padding: '34px',
              backdropFilter: 'blur(18px)',
              boxShadow: '0 20px 70px rgba(0,0,0,0.35)',
            }}
          >
            <div
              className="heading-font"
              style={{
                fontSize: '54px',
                fontWeight: '900',
                marginBottom: '14px',
                letterSpacing: '-3px',
              }}
            >
              Extension Live Demo
            </div>

            <div
              style={{
                color: '#94a3b8',
                marginBottom: '28px',
                fontSize: '20px',
              }}
            >
              Simulated operator workflow showing the real CIC popup experience.
            </div>

            <div
              style={{
                background: '#09090f',
                borderRadius: '28px',
                overflow: 'hidden',
                border: '1px solid rgba(255,255,255,0.08)',
                marginBottom: '30px',
              }}
            >
              <div
                style={{
                  padding: '18px 24px',
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'rgba(255,255,255,0.03)',
                }}
              >
                <div
                  className="heading-font"
                  style={{
                    fontSize: '24px',
                    fontWeight: '800',
                  }}
                >
                  CIC Assistant
                </div>

                <div
                  style={{
                    color: '#4ade80',
                    fontWeight: '700',
                  }}
                >
                  ● AI ACTIVE
                </div>
              </div>

              <div style={{ padding: '28px' }}>
                <div
                  style={{
                    background: '#111827',
                    padding: '20px',
                    borderRadius: '22px',
                    marginBottom: '24px',
                    maxWidth: '72%',
                    lineHeight: '1.8',
                  }}
                >
                  Hey babe 😘 are you free later tonight?
                </div>

                <div
                  style={{
                    marginLeft: 'auto',
                    background:
                      'linear-gradient(135deg,#7c3aed,#ec4899)',
                    padding: '22px',
                    borderRadius: '22px',
                    maxWidth: '82%',
                    lineHeight: '1.8',
                    marginBottom: '24px',
                    boxShadow:
                      '0 14px 40px rgba(168,85,247,0.35)',
                  }}
                >
                  Careful 😏 flirting with me this confidently should probably require supervision.
                </div>

                <video
                  autoPlay
                  muted
                  loop
                  playsInline
                  controls
                  style={{
                    width: '100%',
                    borderRadius: '20px',
                    border:
                      '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  <source
                    src="/typing-demo.mp4"
                    type="video/mp4"
                  />
                </video>
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3,1fr)',
                gap: '18px',
              }}
            >
              {[
                ['Reply Speed', '0.8s'],
                ['Engagement', '94%'],
                ['Operators Online', '2,401'],
              ].map((stat) => (
                <div
                  key={stat[0]}
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    borderRadius: '22px',
                    padding: '24px',
                    border:
                      '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <div
                    style={{
                      color: '#94a3b8',
                      marginBottom: '10px',
                    }}
                  >
                    {stat[0]}
                  </div>

                  <div
                    className="heading-font"
                    style={{
                      fontSize: '42px',
                      fontWeight: '900',
                    }}
                  >
                    {stat[1]}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'extensions' && (
          <div style={{ width:'100%', maxWidth:'950px' }}>
            {packages.map((pkg) => (
              <div
                key={pkg.title}
                style={{
                  background:'rgba(255,255,255,0.04)',
                  border:'1px solid rgba(255,255,255,0.08)',
                  borderRadius:'30px',
                  padding:'34px',
                  marginBottom:'24px',
                }}
              >
                <div
                  className="heading-font"
                  style={{
                    fontSize:'38px',
                    fontWeight:'900',
                    marginBottom:'12px',
                  }}
                >
                  {pkg.title}
                </div>

                <div
                  style={{
                    fontSize:'58px',
                    fontWeight:'900',
                    marginBottom:'18px',
                  }}
                >
                  {pkg.price}
                </div>

                <p
                  style={{
                    color:'#94a3b8',
                    lineHeight:'1.8',
                    marginBottom:'24px',
                    fontSize:'18px',
                  }}
                >
                  {pkg.desc}
                </p>

                <div
                  style={{
                    background:'#09090f',
                    borderRadius:'22px',
                    padding:'24px',
                    marginBottom:'24px',
                    border:'1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <div
                    className="heading-font"
                    style={{
                      fontSize:'24px',
                      marginBottom:'16px',
                    }}
                  >
                    Installation Guide
                  </div>

                  <ol
                    style={{
                      color:'#cbd5e1',
                      lineHeight:'2',
                      paddingLeft:'20px',
                    }}
                  >
                    <li>Download the extension package</li>
                    <li>Open Chrome Extensions</li>
                    <li>Enable Developer Mode</li>
                    <li>Click Load Unpacked</li>
                    <li>Select extracted extension folder</li>
                    <li>Pin CIC extension to toolbar</li>
                  </ol>
                </div>

                <button
                  style={{
                    padding:'18px 34px',
                    borderRadius:'18px',
                    border:'none',
                    background:
                      'linear-gradient(135deg,#7c3aed,#ec4899)',
                    color:'white',
                    fontWeight:'800',
                    fontSize:'16px',
                    cursor:'pointer',
                  }}
                >
                  Download Extension
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
