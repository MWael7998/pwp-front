import { useNavigate } from 'react-router-dom'
import { Input, Button } from 'antd'
import { useState } from 'react'
import logo from '../assets/react.svg'
import { useTheme } from '../context/ThemeContext'

export default function Entry() {
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { theme, toggle } = useTheme()
  const isDark = theme === 'dark'

  async function submit(e: React.SyntheticEvent) {
    e.preventDefault()
    setError('')
    const trimmedName = name.trim()
    if (!trimmedName) { setError('Please enter your name'); return }
    setLoading(true)
    try {
      const response = await fetch('/api/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: trimmedName }),
      })
      const data = await response.json()
      if (!response.ok) { setError(data.error || 'Unable to fetch tournaments'); return }
      navigate('/tournments')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="entry-wrap">
      <button
        onClick={toggle}
        title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        style={{
          position: 'fixed', top: 16, right: 20,
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 14px', borderRadius: 99,
          background: 'var(--surface-2)', border: '1px solid var(--border)',
          color: 'var(--text-2)', fontSize: 12, fontWeight: 600,
          cursor: 'pointer', letterSpacing: 0.3,
        }}
      >
        {isDark ? '☀ Light' : '☾ Dark'}
      </button>
      <div className="entry-card">
        <img className="entry-logo" src={logo} alt="logo" />
        <h2 className="entry-wordmark">PWP</h2>
        <p className="entry-tagline">Enter your name to continue</p>
        <form onSubmit={submit}>
          <div className="entry-field">
            <Input
              placeholder="Your name"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
            />
          </div>
          <Button className="entry-submit" type="primary" htmlType="submit" loading={loading}>
            Continue
          </Button>
          {error && <p className="entry-error">{error}</p>}
        </form>
      </div>
    </div>
  )
}
