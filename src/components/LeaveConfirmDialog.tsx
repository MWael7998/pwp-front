import React from 'react'

interface Props {
  onConfirm: () => void
  onCancel: () => void
}

export default function LeaveConfirmDialog({ onConfirm, onCancel }: Props) {
  return (
    <div style={overlay}>
      <div style={card}>
        <div style={iconWrap}>⚠</div>
        <div style={title}>Leave the match?</div>
        <div style={body}>
          If you leave now, you forfeit the match and your opponent advances in the bracket.
        </div>
        <div style={actions}>
          <button style={cancelBtn} onClick={onCancel}>Stay</button>
          <button style={confirmBtn} onClick={onConfirm}>Yes, Forfeit</button>
        </div>
      </div>
    </div>
  )
}

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 9000,
  background: 'rgba(0,0,0,0.80)',
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}

const card: React.CSSProperties = {
  background: '#18181c',
  border: '1px solid #2a2a34',
  borderRadius: 22,
  padding: '40px 44px',
  maxWidth: 380,
  width: '90%',
  textAlign: 'center',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
}

const iconWrap: React.CSSProperties = {
  fontSize: 28, marginBottom: 18, color: '#c49a58',
}

const title: React.CSSProperties = {
  fontSize: 18, fontWeight: 800, color: '#ede8df',
  letterSpacing: -0.4, marginBottom: 12,
}

const body: React.CSSProperties = {
  fontSize: 14, color: '#8a837a', lineHeight: 1.65, marginBottom: 32,
}

const actions: React.CSSProperties = {
  display: 'flex', gap: 10,
}

const cancelBtn: React.CSSProperties = {
  flex: 1, padding: '12px 0', borderRadius: 12,
  border: '1px solid #2a2a34',
  background: 'transparent', color: '#8a837a',
  fontSize: 13, fontWeight: 700, cursor: 'pointer',
  letterSpacing: 0.3,
}

const confirmBtn: React.CSSProperties = {
  flex: 1, padding: '12px 0', borderRadius: 12,
  border: 'none',
  background: '#7a2e2e', color: '#f5c0c0',
  fontSize: 13, fontWeight: 700, cursor: 'pointer',
  letterSpacing: 0.3,
}
