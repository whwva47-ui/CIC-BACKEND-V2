'use client'
export default function DashboardPage() {
  const cards = [
    {
      title: 'Extensions',
      desc: 'Download and manage all CIC extensions',
      icon: '⚡'
    },
    {
      title: 'AI Tools',
      desc: 'Generate smart replies and engagement flows',
      icon: '🧠'
    },
    {
      title: 'Install Guide',
      desc: 'Step-by-step onboarding instructions',
      icon: '📘'
    },
    {
      title: 'Referrals',
      desc: 'Track invites and commissions',
      icon: '💎'
    },
    {
      title: 'Billing',
      desc: 'Manage plans and subscriptions',
      icon: '💳'
    },
    {
      title: 'Settings',
      desc: 'Customize workspace preferences',
      icon: '⚙️'
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
          background: 'rgba(255,255,255,0.02)',
          backdropFilter: 'blur(18px)',
        }}
      >
        <div
          style={{
            fontSize: '34px',
            fontWeight: '900',
            marginBottom: '40px',
            lineHeight: '1',
            letterSpacing: '-2px',
          }}
          className="heading-font"
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
            'Home',
            'Extensions',
            'Install Guide',
            'AI Tools',
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

      {/* MAIN CONTENT */}
      <div
        style={{
          flex: 1,
          padding: '50px',
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
            OPERATOR WORKSPACE ACTIVE
          </div>

          <h1
            className="heading-font"
            style={{
              fontSize: '72px',
              lineHeight: '0.95',
              fontWeight: '900',
              letterSpacing: '-4px',
              marginBottom: '22px',
              maxWidth: '850px',
            }}
          >
            Everything You Need
            <br />
            To Run CIC
          </h1>

          <p
            style={{
              color: '#94a3b8',
              fontSize: '22px',
              lineHeight: '1.7',
              maxWidth: '800px',
            }}
          >
            Access extensions, AI tools, onboarding guides, billing,
            referrals and operator utilities from one premium workspace.
          </p>
        </div>

        {/* FLOATING CARDS */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))',
            gap: '24px',
          }}
        >
          {cards.map((card) => (
            <div
              key={card.title}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '28px',
                padding: '32px',
                backdropFilter: 'blur(16px)',
                boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
                transition: '0.25s ease',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-8px)'
                e.currentTarget.style.border =
                  '1px solid rgba(168,85,247,0.45)'
                e.currentTarget.style.boxShadow =
                  '0 25px 80px rgba(168,85,247,0.18)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0px)'
                e.currentTarget.style.border =
                  '1px solid rgba(255,255,255,0.08)'
                e.currentTarget.style.boxShadow =
                  '0 20px 60px rgba(0,0,0,0.35)'
              }}
            >
              <div
                style={{
                  fontSize: '42px',
                  marginBottom: '22px',
                }}
              >
                {card.icon}
              </div>

              <h2
                className="heading-font"
                style={{
                  fontSize: '30px',
                  fontWeight: '800',
                  marginBottom: '14px',
                  letterSpacing: '-1px',
                }}
              >
                {card.title}
              </h2>

              <p
                style={{
                  color: '#94a3b8',
                  lineHeight: '1.8',
                  fontSize: '17px',
                }}
              >
                {card.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
