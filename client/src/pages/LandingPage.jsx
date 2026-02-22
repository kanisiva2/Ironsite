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

  // Vine paths — viewBox "0 0 220 500", column center x=110
  // Shaft runs x=71..149 (78px wide); left vine climbs x≈72, right x≈148
  const stemD = isLeft
    ? 'M72,494 C64,408 88,362 52,298 C20,240 56,188 34,124 C14,66 44,14 72,8'
    : 'M148,494 C156,408 132,362 168,298 C200,240 164,188 186,124 C206,66 176,14 148,8'

  const tendrils = isLeft
    ? [
        'M52,298 C30,284 2,288 -18,274',
        'M34,210 C12,196 -16,200 -36,186',
        'M40,134 C18,120 -10,124 -30,110',
        'M56,48 C34,34 6,38 -14,24',
      ]
    : [
        'M168,298 C190,284 218,288 238,274',
        'M186,210 C208,196 236,200 256,186',
        'M180,134 C202,120 230,124 250,110',
        'M164,48 C186,34 214,38 234,24',
      ]

  const tendrilDelays = [1.4, 1.7, 2.0, 2.3]

  const leaves = isLeft
    ? [{ cx: -18, cy: 274 }, { cx: -36, cy: 186 }, { cx: -30, cy: 110 }, { cx: -14, cy: 24 }]
    : [{ cx: 238, cy: 274 }, { cx: 256, cy: 186 }, { cx: 250, cy: 110 }, { cx: 234, cy: 24 }]

  const leafDelays = [1.78, 2.08, 2.38, 2.68]

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* Abacus */}
      <div style={{ width: 100, height: 14, borderRadius: '3px 3px 0 0', background: 'linear-gradient(180deg, #e6d4b2 0%, #d4c09a 100%)', boxShadow: '0 -3px 10px rgba(118,86,34,0.12)' }} />
      {/* Echinus */}
      <div style={{ width: 90, height: 22, background: 'linear-gradient(180deg, #ddd0b5 0%, #eaded0 100%)', clipPath: 'polygon(0% 0%, 100% 0%, 94% 100%, 6% 100%)' }} />
      {/* Neck */}
      <div style={{ width: 78, height: 10, background: 'linear-gradient(180deg, #d2c4a2 0%, #dfd1b8 100%)', borderBottom: '1px solid rgba(118,86,34,0.16)' }} />
      {/* Shaft */}
      <div style={{ width: 78, height: 420, background: SHAFT_BG }} />
      {/* Torus */}
      <div style={{ width: 86, height: 13, background: 'linear-gradient(180deg, #dfd1b8 0%, #d2c4a2 100%)' }} />
      {/* Plinth */}
      <div style={{ width: 100, height: 20, borderRadius: '0 0 4px 4px', background: 'linear-gradient(180deg, #ead8bc 0%, #d0ba98 100%)', boxShadow: '0 8px 28px rgba(118,86,34,0.24), 0 2px 6px rgba(118,86,34,0.1)' }} />

      {/* SVG Vine overlay */}
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

        {/* Main stem */}
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
            animation: `vineGrow 3.2s ease-out ${isLeft ? '0.55s' : '0.7s'} both`,
          }}
        />

        {/* Tendrils */}
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

        {/* Diamond leaves at tendril tips */}
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
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg, #c8965c 0%, #a07535 100%)',
            fontSize: '0.8rem', fontWeight: 700, color: '#fff', letterSpacing: '0.04em',
            boxShadow: '0 2px 10px rgba(160,120,60,0.38)',
          }}>IS</div>
          <span style={{
            fontFamily: 'var(--font-display)', fontSize: '1.1rem',
            fontWeight: 500, letterSpacing: '0.07em', color: 'var(--color-text)',
          }}>
            Ironsite
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
            Begin Your Journey
          </Link>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────── */}
      <section style={{
        minHeight: '100vh', position: 'relative',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        paddingTop: '5rem', paddingBottom: '4rem',
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
          display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
          width: '100%', padding: '0 clamp(1rem, 3vw, 4rem)',
          position: 'relative', zIndex: 1,
        }}>
          {/* Left column */}
          <div
            className="landing-columns"
            style={{ flexShrink: 0, animation: 'columnRise 1.2s cubic-bezier(0.22,1,0.36,1) 0.1s both' }}
          >
            <GreekColumn side="left" />
          </div>

          {/* Center hero content */}
          <div style={{ textAlign: 'center', flex: 1, maxWidth: 480, margin: '0 auto', paddingBottom: '2.5rem', paddingLeft: '1rem', paddingRight: '1rem' }}>
            {/* Star ornament bar */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center',
              marginBottom: '1.25rem', animation: 'heroTextReveal 0.8s ease-out 0.35s both',
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
              animation: 'heroTextReveal 0.8s ease-out 0.42s both',
            }}>
              AI Architectural Atelier
            </p>

            {/* Monumental brand name */}
            <h1 style={{
              fontFamily: 'var(--font-display)', fontWeight: 300,
              fontSize: 'clamp(2.8rem, 6.5vw, 5rem)', letterSpacing: '0.22em',
              color: 'var(--color-text)', margin: '0 0 0.3rem',
              animation: 'heroTextReveal 1s ease-out 0.5s both',
            }}>
              IRONSITE
            </h1>

            {/* Gold rule */}
            <div style={{
              height: 1, width: 72, margin: '0.9rem auto',
              background: 'linear-gradient(90deg, transparent, var(--color-primary), transparent)',
              animation: 'heroTextReveal 0.8s ease-out 0.65s both',
            }} />

            {/* Tagline */}
            <p style={{
              fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 300,
              fontSize: '1.02rem', letterSpacing: '0.03em', lineHeight: 1.68,
              color: 'var(--color-text-muted)', marginBottom: '2rem',
              animation: 'heroTextReveal 0.8s ease-out 0.72s both',
            }}>
              Commission your vision.<br />
              Sculpt every chamber. Inhabit the ideal.
            </p>

            {/* CTA buttons */}
            <div style={{
              display: 'flex', gap: '0.85rem', justifyContent: 'center', flexWrap: 'wrap',
              animation: 'heroTextReveal 0.8s ease-out 0.88s both',
            }}>
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
            </div>
          </div>

          {/* Right column */}
          <div
            className="landing-columns"
            style={{ flexShrink: 0, animation: 'columnRise 1.2s cubic-bezier(0.22,1,0.36,1) 0.2s both' }}
          >
            <GreekColumn side="right" />
          </div>
        </div>

        {/* Bottom ornamental divider */}
        <div
          className="ornamental-divider"
          style={{
            width: '100%', maxWidth: 560, marginTop: '3.5rem',
            animation: 'heroTextReveal 0.8s ease-out 1.1s both',
          }}
        >
          ◆
        </div>

        {/* Scroll hint */}
        <p style={{
          fontSize: '0.63rem', letterSpacing: '0.22em', textTransform: 'uppercase',
          color: 'var(--color-text-muted)', marginTop: '1.25rem',
          animation: 'heroTextReveal 0.8s ease-out 1.3s both',
        }}>
          Discover the Atelier
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
              The Atelier Experience
            </p>
            <h2 style={{
              fontFamily: 'var(--font-display)', fontWeight: 300,
              fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', letterSpacing: '0.04em',
              color: 'var(--color-text)', margin: '0 0 1rem',
            }}>
              Craft Space. Sculpt Vision.
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
                title: 'Architectural Dialogue',
                body: 'Converse with an AI architect who understands proportion, light, and the timeless grammar of classical form.',
              },
              {
                glyph: '◈',
                title: 'Visual Prototyping',
                body: 'Render photorealistic impressions of your estate, refined through each exchange until the vision is precise.',
              },
              {
                glyph: '◉',
                title: 'Immersive 3D Estates',
                body: 'Step inside your creation with spatially accurate three-dimensional models built from your approved designs.',
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
          © 2025 Ironsite — AI Architectural Atelier
        </p>
      </footer>
    </div>
  )
}
