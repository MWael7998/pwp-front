import React, { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'

const HIDDEN_ON = ['/', '/entry']

export default function TopBar() {
  const location = useLocation()
  const [user, setUser]     = useState<string | null>(null)
  const [points, setPoints] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/session', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { setUser(d.user); setPoints(d.points) })
      .catch(() => {})
  }, [location.pathname])

  if (HIDDEN_ON.includes(location.pathname) || !user) return null

  return (
    <div style={bar}>
      <div style={left}>
        <div style={dot} />
        <span style={greeting}>Welcome, </span>
        <span style={name}>{user}</span>
      </div>
      <div style={right}>
        <span style={label}>Points</span>
        <span style={pts}>{points !== null ? points.toLocaleString() : '—'}</span>
      </div>
    </div>
  )
}

const bar: React.CSSProperties = {
  position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
  height: 48,
  background: 'rgba(8,12,24,0.92)',
  backdropFilter: 'blur(12px)',
  borderBottom: '1px solid rgba(30,58,138,0.35)',
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '0 28px',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
}

const left: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8,
}

const dot: React.CSSProperties = {
  width: 7, height: 7, borderRadius: '50%',
  background: '#22c55e',
  boxShadow: '0 0 6px #22c55e',
}

const greeting: React.CSSProperties = {
  fontSize: 13, color: '#475569', fontWeight: 500,
}

const name: React.CSSProperties = {
  fontSize: 13, color: '#e2e8f0', fontWeight: 700, letterSpacing: 0.3,
}

const right: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10,
}

const label: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, color: '#334155',
  textTransform: 'uppercase', letterSpacing: 2,
}

const pts: React.CSSProperties = {
  fontSize: 15, fontWeight: 800, color: '#fbbf24',
  fontVariantNumeric: 'tabular-nums',
  letterSpacing: 0.5,
}
