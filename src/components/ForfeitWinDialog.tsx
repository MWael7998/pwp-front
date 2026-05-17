import React from 'react'

interface Props {
  onProceed: () => void
}

export default function ForfeitWinDialog({ onProceed }: Props) {
  return (
    <div style={overlay}>
      <div style={card}>
        <div style={medal}>◆</div>
        <div style={title}>You Win</div>
        <div style={body}>Your opponent left the match and has been disqualified.</div>
        <button
          style={btn}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          onClick={onProceed}
        >
          Proceed
        </button>
      </div>
    </div>
  )
}

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 9000,
  background: 'rgba(0,0,0,0.82)',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}

const card: React.CSSProperties = {
  background: '#18181c',
  border: '1px solid #2a2a34',
  borderRadius: 24,
  padding: '48px 52px',
  maxWidth: 380,
  width: '90%',
  textAlign: 'center',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
}

const medal: React.CSSProperties = {
  fontSize: 30, color: '#c4a46b', marginBottom: 20,
}

const title: React.CSSProperties = {
  fontSize: 26, fontWeight: 900, color: '#ede8df',
  letterSpacing: -0.8, marginBottom: 12,
}

const body: React.CSSProperties = {
  fontSize: 14, color: '#8a837a', lineHeight: 1.65, marginBottom: 36,
}

const btn: React.CSSProperties = {
  width: '100%', padding: '14px 0',
  borderRadius: 12, border: 'none',
  background: '#c4a46b', color: '#1a1410',
  fontSize: 13, fontWeight: 800, cursor: 'pointer',
  letterSpacing: 1.5, textTransform: 'uppercase',
}
