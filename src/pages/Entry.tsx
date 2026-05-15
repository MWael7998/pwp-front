import {useNavigate } from 'react-router-dom'
import { Input, Button } from 'antd'
import { useState } from 'react'
import logo from '../assets/react.svg'

export default function Entry() {
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function submit(e) {
    e.preventDefault()
    setError('')

    const trimmedName = name.trim()

    if (!trimmedName) {
      setError('Please enter your name')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: trimmedName }),
      })

      const data = await response.json()
      if (!response.ok) {
        setError(data.error || 'Unable to fetch tournaments')
        return
      }

      navigate('/tournments')
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'Network error while fetching tournaments')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="entry-card">
      <img className="logo" src={logo} alt="logo" />
      <h2>PWP</h2>

      <form onSubmit={submit}>
        <div className="entry-input">
          <Input
            placeholder="Enter your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="entry-actions">
          <Button type="primary" htmlType="submit" loading={loading}>
            Submit
          </Button>
        </div>
        {error ? <p style={{ color: 'red', marginTop: 12 }}>{error}</p> : null}
      </form>
    </div>
  )
}
