import { Link } from 'react-router-dom'

const SHAFT_BG = `
  repeating-linear-gradient(
    90deg,
    rgba(148, 108, 48, 0.09) 0px,
    rgba(255, 252, 244, 0.72) 3px,
    rgba(248, 238, 222, 0.88) 6px,
    rgba(148, 108, 48, 0.09) 9px
  ),
  linear-gradient(180deg, #f6ecdc 0%, #e9d8ba 38%, #f2e5cc 66%, #e9d8ba 100%)
`

function GreekColumn({ side }) {
  const isLeft = side === 'left'

  // Shaft runs x=71..149 (center=110). Vine climbs the shaft face.
  const stemD = isLeft
    ? 'M85,470 C78,420 130,390 135,340 C140,290 75,270 80,220 C85,170 138,150 132,100 C126,60 88,50 92,30'
    : 'M135,470 C142,420 90,390 85,340 C80,290 145,270 140,220 C135,170 82,150 88,100 C94,60 132,50 128,30'

  const tendrils = isLeft
    ? [
        'M135,340 C144,330 150,322 148,312',
        'M80,220 C70,212 66,204 68,194',
        'M132,100 C142,92 146,84 143,74',
        'M92,30 C82,22 78,14 80,6',
      ]
    : [
        'M85,340 C76,330 70,322 72,312',
        'M140,220 C150,212 154,204 152,194',
        'M88,100 C78,92 74,84 77,74',
        'M128,30 C138,22 142,14 140,6',
      ]

  const vineBaseDelay = 1.8
  const tendrilDelays = [2.6, 2.9, 3.2, 3.5]
  const leafDelays = [2.98, 3.28, 3.58, 3.88]

  const leaves = isLeft
    ? [{ cx: 148, cy: 312 }, { cx: 68, cy: 194 }, { cx: 143, cy: 74 }, { cx: 80, cy: 6 }]
    : [{ cx: 72, cy: 312 }, { cx: 152, cy: 194 }, { cx: 77, cy: 74 }, { cx: 140, cy: 6 }]

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ width: 100, height: 14, borderRadius: '3px 3px 0 0', background: 'linear-gradient(180deg, #e6d4b2 0%, #d4c09a 100%)', boxShadow: '0 -3px 10px rgba(118,86,34,0.12)' }} />
      <div style={{ width: 90, height: 22, background: 'linear-gradient(180deg, #ddd0b5 0%, #eaded0 100%)', clipPath: 'polygon(0% 0%, 100% 0%, 94% 100%, 6% 100%)' }} />
      <div style={{ width: 78, height: 10, background: 'linear-gradient(180deg, #d2c4a2 0%, #dfd1b8 100%)', borderBottom: '1px solid rgba(118,86,34,0.16)' }} />
      <div style={{ width: 78, height: 420, background: SHAFT_BG }} />
      <div style={{ width: 86, height: 13, background: 'linear-gradient(180deg, #dfd1b8 0%, #d2c4a2 100%)' }} />
      <div style={{ width: 100, height: 20, borderRadius: '0 0 4px 4px', background: 'linear-gradient(180deg, #ead8bc 0%, #d0ba98 100%)', boxShadow: '0 8px 28px rgba(118,86,34,0.24), 0 2px 6px rgba(118,86,34,0.1)' }} />

      <svg
        viewBox="0 0 220 500"
        width={220}
        height={500}
        style={{
          position: 'absolute',
          top: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          overflow: 'visible',
          pointerEvents: 'none',
        }}
      >
        <defs>
          <linearGradient id={`vg-${side}`} x1="0" y1="0" x2="0.35" y2="1">
            <stop offset="0%" stopColor="#f0cc88" />
            <stop offset="48%" stopColor="#c8965c" />
            <stop offset="100%" stopColor="#9a6530" />
          </linearGradient>
        </defs>

        <path
          d={stemD}
          fill="none"
          stroke={`url(#vg-${side})`}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            strokeDasharray: 700,
            strokeDashoffset: 700,
            animation: `vineGrow 3.2s ease-out ${vineBaseDelay + (isLeft ? 0 : 0.15)}s both`,
          }}
        />

        {tendrils.map((d, i) => (
          <path
            key={i}
            d={d}
            fill="none"
            stroke={`url(#vg-${side})`}
            strokeWidth="2"
            strokeLinecap="round"
            style={{
              strokeDasharray: 130,
              strokeDashoffset: 130,
              animation: `tendrillGrow 1.2s ease-out ${tendrilDelays[i]}s both`,
            }}
          />
        ))}

        {leaves.map(({ cx, cy }, i) => (
          <polygon
            key={i}
            points={`${cx},${cy - 9} ${cx + 7},${cy} ${cx},${cy + 9} ${cx - 7},${cy}`}
            fill={`url(#vg-${side})`}
            style={{
              opacity: 0,
              animation: `leafReveal 0.8s ease-out ${leafDelays[i]}s both`,
            }}
          />
        ))}
      </svg>
    </div>
  )
}

const PARTICLES = [
  { size: 4, top: '12%', left: '6%',   dur: '5.5s', del: '0s'    },
  { size: 3, top: '28%', left: '15%',  dur: '7s',   del: '0.8s'  },
  { size: 5, top: '48%', left: '4%',   dur: '6.5s', del: '1.6s'  },
  { size: 3, top: '68%', left: '11%',  dur: '5s',   del: '0.4s'  },
  { size: 4, top: '82%', left: '22%',  dur: '7.5s', del: '1.2s'  },
  { size: 3, top: '14%', right: '7%',  dur: '6s',   del: '0.6s'  },
  { size: 4, top: '35%', right: '13%', dur: '8s',   del: '1.0s'  },
  { size: 5, top: '55%', right: '6%',  dur: '5.5s', del: '0.2s'  },
  { size: 3, top: '72%', right: '20%', dur: '7s',   del: '1.8s'  },
  { size: 4, top: '90%', right: '10%', dur: '6.5s', del: '0.9s'  },
]

export default function LandingPage() {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-surface-alt)', overflowX: 'hidden' }}>

      {/* ── Fixed header ─────────────────────────────── */}
      <header style={{
        position: 'fixed', inset: '0 0 auto 0', zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 2.5rem', height: '4rem',
        backdropFilter: 'blur(14px) saturate(1.4)',
        WebkitBackdropFilter: 'blur(14px) saturate(1.4)',
        backgroundColor: 'rgba(250,246,240,0.82)',
        borderBottom: '1px solid var(--color-border)',
        boxShadow: '0 1px 0 0 var(--color-border), 0 3px 0 0 rgba(200,150,92,0.12)',
        animation: 'headerFadeIn 0.6s ease-out 2.0s both',
      }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{
            fontFamily: 'var(--font-display)', fontSize: '1.1rem',
            fontWeight: 500, letterSpacing: '0.07em', color: 'var(--color-text)',
          }}>
            Archvision
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link
            to="/login"
            style={{
              fontSize: '0.875rem', color: 'var(--color-text-muted)',
              textDecoration: 'none', letterSpacing: '0.04em',
            }}
          >
            Sign In
          </Link>
          <Link
            to="/register"
            className="bg-primary"
            style={{
              padding: '0.5rem 1.25rem', borderRadius: '0.625rem',
              fontSize: '0.78rem', textDecoration: 'none', color: '#fff',
              fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase',
            }}
          >
            Get Started
          </Link>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────── */}
      <section style={{
        minHeight: '100vh', position: 'relative',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        paddingTop: '5rem', paddingBottom: '4rem',
        overflow: 'hidden',
      }}>
        {/* Floating gold particles */}
        {PARTICLES.map((p, i) => (
          <div key={i} style={{
            position: 'absolute',
            width: p.size, height: p.size,
            top: p.top, left: p.left, right: p.right,
            borderRadius: '50%',
            background: 'radial-gradient(circle, #e8b860 0%, rgba(200,150,92,0.2) 100%)',
            animation: `particleFloat ${p.dur} ease-in-out ${p.del} infinite`,
            pointerEvents: 'none',
          }} />
        ))}

        {/* Ambient radial glow */}
        <div style={{
          position: 'absolute', top: '15%', left: '50%', transform: 'translateX(-50%)',
          width: 640, height: 520, pointerEvents: 'none',
          background: 'radial-gradient(ellipse, rgba(200,150,92,0.11) 0%, transparent 68%)',
          animation: 'ambientGlow 7s ease-in-out infinite alternate',
        }} />

        {/* Columns + center hero content */}
        <div style={{
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          width: '100%', maxWidth: 1320,
          padding: '0 2rem',
          position: 'relative', zIndex: 1,
          gap: 'clamp(0.5rem, 3vw, 2.5rem)',
        }}>
          {/* Left column — starts at center, slides left */}
          <div
            className="landing-columns scroll-column-left"
            style={{ flexShrink: 0 }}
          >
            <GreekColumn side="left" />
          </div>

          {/* Center hero content — fades in after pillars open */}
          <div className="scroll-content" style={{
            textAlign: 'center', flex: '1 1 700px', maxWidth: 800,
            margin: '0 auto', paddingBottom: '2.5rem',
            paddingLeft: '2rem', paddingRight: '2rem',
          }}>
            {/* Star ornament bar */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center',
              marginBottom: '1.25rem',
            }}>
              <div style={{ height: 1, width: 44, background: 'linear-gradient(90deg, transparent, rgba(200,150,92,0.5))' }} />
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 0L8.3 5.2H14L9.4 8.3L11.2 14L7 10.8L2.8 14L4.6 8.3L0 5.2H5.7Z" fill="#c8965c" opacity="0.72" />
              </svg>
              <div style={{ height: 1, width: 44, background: 'linear-gradient(90deg, rgba(200,150,92,0.5), transparent)' }} />
            </div>

            {/* Eyebrow */}
            <p style={{
              fontSize: '0.64rem', letterSpacing: '0.3em', textTransform: 'uppercase',
              color: 'var(--color-text-muted)', marginBottom: '0.55rem',
            }}>
              AI Architecture Studio
            </p>

            {/* Brand name */}
            <h1 style={{
              fontFamily: 'var(--font-display)', fontWeight: 300,
              fontSize: 'clamp(2.3rem, 6vw, 5.6rem)', letterSpacing: '0.14em',
              lineHeight: 0.95, whiteSpace: 'nowrap',
              color: 'var(--color-text)', margin: '0 0 0.3rem',
            }}>
              ARCHVISION
            </h1>

            {/* Gold rule */}
            <div style={{
              height: 1, width: 72, margin: '0.9rem auto',
              background: 'linear-gradient(90deg, transparent, var(--color-primary), transparent)',
            }} />

            {/* Tagline */}
            <p style={{
              fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 300,
              fontSize: '1.02rem', letterSpacing: '0.03em', lineHeight: 1.68,
              color: 'var(--color-text-muted)', marginBottom: '2rem',
            }}>
              Describe your dream space.<br />
              Watch it come to life in 3D.
            </p>

            {/* CTA buttons */}
            <div style={{
              display: 'flex', gap: '0.85rem', justifyContent: 'center', flexWrap: 'wrap',
            }}>
              <Link
                to="/login"
                style={{
                  padding: '0.72rem 1.5rem', borderRadius: '0.75rem',
                  fontSize: '0.76rem', fontWeight: 500, letterSpacing: '0.1em',
                  textTransform: 'uppercase', textDecoration: 'none',
                  color: 'var(--color-text-muted)',
                  border: '1px solid var(--color-border)',
                }}
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="bg-primary"
                style={{
                  padding: '0.72rem 1.8rem', borderRadius: '0.75rem',
                  fontSize: '0.76rem', fontWeight: 500, letterSpacing: '0.1em',
                  textTransform: 'uppercase', textDecoration: 'none', color: '#fff',
                }}
              >
                Start Designing
              </Link>
            </div>
          </div>

          {/* Right column — starts at center, slides right */}
          <div
            className="landing-columns scroll-column-right"
            style={{ flexShrink: 0 }}
          >
            <GreekColumn side="right" />
          </div>
        </div>

        {/* Bottom ornamental divider */}
        <div
          className="ornamental-divider scroll-content"
          style={{
            width: '100%', maxWidth: 560, marginTop: '3.5rem',
          }}
        >
          ◆
        </div>

        {/* Scroll hint */}
        <p className="scroll-content" style={{
          fontSize: '0.63rem', letterSpacing: '0.22em', textTransform: 'uppercase',
          color: 'var(--color-text-muted)', marginTop: '1.25rem',
        }}>
          See How It Works
        </p>
      </section>

      {/* ── Features ─────────────────────────────────── */}
      <section style={{
        padding: '6rem 2.5rem',
        background: 'var(--color-surface)',
        borderTop: '1px solid var(--color-border)',
        borderBottom: '1px solid var(--color-border)',
      }}>
        <div style={{ maxWidth: 1040, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
            <p style={{
              fontSize: '0.64rem', letterSpacing: '0.3em', textTransform: 'uppercase',
              color: 'var(--color-text-muted)', marginBottom: '0.75rem',
            }}>
              How It Works
            </p>
            <h2 style={{
              fontFamily: 'var(--font-display)', fontWeight: 300,
              fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', letterSpacing: '0.04em',
              color: 'var(--color-text)', margin: '0 0 1rem',
            }}>
              Design Any Room with AI
            </h2>
            <div style={{
              height: 1, width: 64, margin: '0 auto',
              background: 'linear-gradient(90deg, transparent, var(--color-primary), transparent)',
            }} />
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1.75rem',
          }}>
            {[
              {
                glyph: '⊞',
                title: 'Talk to Your AI Architect',
                body: 'Have a conversation about your room — dimensions, style, budget, materials. The AI asks the right questions and guides your design.',
              },
              {
                glyph: '◈',
                title: 'See It in 2D',
                body: 'Get photorealistic images of your room design. Give feedback, adjust details, and approve the ones you love.',
              },
              {
                glyph: '◉',
                title: 'Explore It in 3D',
                body: 'Your approved designs become a full 3D environment you can walk through and explore from every angle.',
              },
            ].map(({ glyph, title, body }) => (
              <div
                key={title}
                className="card-lift"
                style={{
                  borderRadius: '1rem',
                  border: '1px solid var(--color-border)',
                  padding: '2.25rem 2rem',
                  background: 'var(--color-surface)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                }}
              >
                <div style={{
                  fontSize: '1.5rem', marginBottom: '1rem',
                  color: 'var(--color-primary)', fontWeight: 300,
                }}>
                  {glyph}
                </div>
                <h3 style={{
                  fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: '1.2rem',
                  color: 'var(--color-text)', marginBottom: '0.6rem', letterSpacing: '0.02em',
                }}>
                  {title}
                </h3>
                <p style={{
                  fontSize: '0.88rem', color: 'var(--color-text-muted)', lineHeight: 1.72, margin: 0,
                }}>
                  {body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────── */}
      <footer style={{ padding: '3rem 2.5rem', textAlign: 'center', background: 'var(--color-surface-alt)' }}>
        <div className="ornamental-divider" style={{ maxWidth: 380, margin: '0 auto 1.5rem' }}>◇</div>
        <p style={{
          fontSize: '0.76rem', color: 'var(--color-text-muted)',
          letterSpacing: '0.08em', textTransform: 'uppercase',
        }}>
          © 2026 Archvision — AI Architecture Studio
        </p>
      </footer>
    </div>
  )
}
