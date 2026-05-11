'use client'

export default function DashboardPage() {
  const packages = [
    {
      title: 'Texting Factory',
      price: '$19',
      desc: 'Optimized for TF operators with fast AI reply workflows.',
      button: 'Install Extension',
      glow: 'rgba(168,85,247,0.45)'
    },
    {
      title: 'General Platforms',
      price: '$39',
      desc: 'Works with Alpha.date, OF, Fansly and multiple platforms.',
      button: 'Install Extension',
      glow: 'rgba(236,72,153,0.45)'
    },
    {
      title: 'Premium AI Suite',
      price: '$79',
      desc: 'Advanced AI memory, custom personalities and analytics.',
      button: 'Upgrade Premium',
      glow: 'rgba(251,191,36,0.45)'
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
      {/* SIDEBAR */}
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
          Dashboard
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          {[
            'Live Demo',
            'Extensions',
            'AI Tools',
            'Install Guide',
            'Analytics',
            'Referrals',
            'Billing',
            'Settings',
          ].map((item, index) => (
            <div
              key={item}
              style={{
                padding: '16px 18px',
                borderRadius: '18px',
                background:
                  index === 0
                    ? 'linear-gradient(135deg,#7c3aed,#ec4899)'
                    : 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.06)',
                color: 'white',
                fontWeight: '600',
                cursor: 'pointer',
                transition: '0.25s',
                boxShadow:
                  index === 0
                    ? '0 10px 40px rgba(168,85,247,0.35)'
                    : '0 8px 30px rgba(0,0,0,0.25)',
              }}
            >
              {item}
            </div>
          ))}
        </div>
      </div>

      {/* MAIN */}
      <div
        style={{
          flex: 1,
          padding: '40px',
          overflowY: 'auto',
        }}
      >
        {/* HERO */}
        <div
          style={{
            marginBottom: '40px',
          }}
        >
          <div
            style={{
              display: 'inline-block',
              padding: '8px 18px',
              borderRadius: '999px',
              background: 'rgba(168,85,247,0.12)',
              border: '1px solid rgba(168,85,247,0.25)',
              color: '#d8b4fe',
              fontSize: '13px',
              marginBottom: '24px',
            }}
          >
            LIVE OPERATOR WORKSPACE
          </div>

          <h1
            className="heading-font"
            style={{
              fontSize: '76px',
              lineHeight: '0.95',
              fontWeight: '900',
              letterSpacing: '-4px',
              marginBottom: '24px',
              maxWidth: '900px',
            }}
          >
            Watch CIC Generate
            <br />
            Replies In Real Time
          </h1>

          <p
            style={{
              color: '#94a3b8',
              fontSize: '22px',
              lineHeight: '1.7',
              maxWidth: '850px',
            }}
          >
            Experience the exact workflow operators use to generate
            high-converting AI replies across dating and subscription
            platforms.
          </p>
        </div>

        {/* LIVE DEMO */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.3fr 1fr',
            gap: '24px',
            marginBottom: '40px',
          }}
        >
          {/* CHAT WINDOW */}
          <div
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '32px',
              padding: '30px',
              backdropFilter: 'blur(16px)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '26px',
              }}
            >
              <div
                className="heading-font"
                style={{
                  fontSize: '28px',
                  fontWeight: '800',
                }}
              >
                Live AI Reply Demo
              </div>

              <div
                style={{
                  color: '#4ade80',
                  fontWeight: '700',
                  fontSize: '14px',
                }}
              >
                ● ACTIVE
              </div>
            </div>

            {/* INCOMING */}
            <div
              style={{
                background: '#111827',
                padding: '20px',
                borderRadius: '22px',
                marginBottom: '20px',
                maxWidth: '80%',
              }}
            >
              Hey babe 😘 what are you doing tonight?
            </div>

            {/* AI REPLY */}
            <div
              style={{
                marginLeft: 'auto',
                background:
                  'linear-gradient(135deg,#7c3aed,#ec4899)',
                padding: '20px',
                borderRadius: '22px',
                marginBottom: '22px',
                maxWidth: '85%',
                boxShadow:
                  '0 12px 40px rgba(168,85,247,0.35)',
              }}
            >
              Honestly? Probably thinking about how dangerous it is
              to let you flirt this confidently 😏
            </div>

            {/* AI STATUS */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3,1fr)',
                gap: '16px',
                marginTop: '30px',
              }}
            >
              {[
                ['Reply Speed', '0.8s'],
                ['Engagement', '94%'],
                ['AI Active', 'Online'],
              ].map((stat) => (
                <div
                  key={stat[0]}
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    borderRadius: '20px',
                    padding: '18px',
                    border:
                      '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <div
                    style={{
                      color: '#94a3b8',
                      fontSize: '13px',
                      marginBottom: '10px',
                    }}
                  >
                    {stat[0]}
                  </div>

                  <div
                    className="heading-font"
                    style={{
                      fontSize: '26px',
                      fontWeight: '800',
                    }}
                  >
                    {stat[1]}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* PERFORMANCE PANEL */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '22px',
            }}
          >
            {[
              ['Platforms Supported', '10+'],
              ['Operators Active', '2,400+'],
              ['Replies Generated', '3.2M'],
            ].map((item) => (
              <div
                key={item[0]}
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '28px',
                  padding: '28px',
                  backdropFilter: 'blur(16px)',
                  boxShadow:
                    '0 20px 60px rgba(0,0,0,0.35)',
                }}
              >
                <div
                  style={{
                    color: '#94a3b8',
                    marginBottom: '12px',
                  }}
                >
                  {item[0]}
                </div>

                <div
                  className="heading-font"
                  style={{
                    fontSize: '54px',
                    fontWeight: '900',
                    letterSpacing: '-3px',
                  }}
                >
                  {item[1]}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* PACKAGES */}
        <div
          style={{
            marginTop: '20px',
          }}
        >
          <h2
            className="heading-font"
            style={{
              fontSize: '52px',
              fontWeight: '900',
              letterSpacing: '-3px',
              marginBottom: '28px',
            }}
          >
            Choose Your Package
          </h2>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit,minmax(320px,1fr))',
              gap: '26px',
            }}
          >
            {packages.map((pkg) => (
              <div
                key={pkg.title}
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '32px',
                  padding: '34px',
                  backdropFilter: 'blur(18px)',
                  boxShadow:
                    '0 20px 70px rgba(0,0,0,0.35)',
                  transition: '0.25s',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform =
                    'translateY(-10px)'
                  e.currentTarget.style.boxShadow =
                    `0 25px 90px ${pkg.glow}`
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform =
                    'translateY(0px)'
                  e.currentTarget.style.boxShadow =
                    '0 20px 70px rgba(0,0,0,0.35)'
                }}
              >
                <div
                  className="heading-font"
                  style={{
                    fontSize: '34px',
                    fontWeight: '900',
                    marginBottom: '18px',
                    letterSpacing: '-2px',
                  }}
                >
                  {pkg.title}
                </div>

                <div
                  style={{
                    fontSize: '68px',
                    fontWeight: '900',
                    marginBottom: '18px',
                  }}
                >
                  {pkg.price}
                  <span
                    style={{
                      fontSize: '18px',
                      color: '#94a3b8',
                    }}
                  >
                    /mo
                  </span>
                </div>

                <p
                  style={{
                    color: '#94a3b8',
                    lineHeight: '1.8',
                    marginBottom: '32px',
                    fontSize: '17px',
                  }}
                >
                  {pkg.desc}
                </p>

                <button
                  style={{
                    width: '100%',
                    padding: '18px',
                    border: 'none',
                    borderRadius: '18px',
                    background:
                      'linear-gradient(135deg,#7c3aed,#ec4899)',
                    color: 'white',
                    fontWeight: '800',
                    fontSize: '16px',
                    cursor: 'pointer',
                    boxShadow:
                      '0 10px 40px rgba(168,85,247,0.35)',
                  }}
                >
                  {pkg.button}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
