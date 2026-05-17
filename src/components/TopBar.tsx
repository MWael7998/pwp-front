import React, { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'

const HIDDEN_ON = ['/', '/entry']

export default function TopBar() {
  const location         = useLocation()
  const { theme, toggle } = useTheme()
  const [user, setUser]     = useState<string | null>(null)
  const [points, setPoints] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/session', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { setUser(d.user); setPoints(d.points) })
      .catch(() => {})
  }, [location.pathname])

  if (HIDDEN_ON.includes(location.pathname) || !user) return null

  const isDark = theme === 'dark'

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
      height: 52,
      background: 'var(--topbar-bg)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderBottom: '1px solid var(--topbar-border)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 28px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      transition: 'background 0.25s ease, border-color 0.25s ease',
    }}>

      {/* Left: user */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', flexShrink: 0 }} />
        <span style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 500 }}>Welcome, </span>
        <span style={{ fontSize: 13, color: 'var(--text-1)', fontWeight: 600, letterSpacing: 0.2 }}>{user}</span>
      </div>

      {/* Right: points + theme toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 2 }}>
            Points
          </span>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums', letterSpacing: 0.3 }}>
            {points !== null ? points.toLocaleString() : '—'}
          </span>
        </div>

        {/* Theme toggle */}
        <button
          onClick={toggle}
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 12px', borderRadius: 99,
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            color: 'var(--text-2)',
            fontSize: 12, fontWeight: 600,
            cursor: 'pointer',
            transition: 'background 0.2s ease, border-color 0.2s ease, color 0.2s ease',
            letterSpacing: 0.3,
          }}
          onMouseEnter={e => {
            const el = e.currentTarget
            el.style.color = 'var(--text-1)'
            el.style.borderColor = 'var(--accent)'
          }}
          onMouseLeave={e => {
            const el = e.currentTarget
            el.style.color = 'var(--text-2)'
            el.style.borderColor = 'var(--border)'
          }}
        >
          {isDark
            ? <SunIcon />
            : <MoonIcon />}
          {isDark ? 'Light' : 'Dark'}
        </button>
      </div>
    </div>
  )
}

function SunIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}
