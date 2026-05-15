import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Card, Skeleton, Alert, Button } from 'antd'

type Tournament = {
  id: number
  name: string
  image: string
  entryFee: number
  currency: string
  players: number
  status: string
  description: string
}

type RegisterResponse = {
  tournament: Tournament
  registeredCount: number
  seatsLeft: number
  message?: string
}

export default function Register() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [result, setResult] = useState<RegisterResponse | null>(null)

  useEffect(() => {
    async function register() {
      if (!id) {
        setError('Invalid tournament')
        setLoading(false)
        return
      }

      try {
        const response = await fetch(`/api/register/${id}`, {
          method: 'POST',
          credentials: 'include',
        })
        const data = await response.json()

        if (!response.ok) {
          setError(data.error || 'Unable to register for this tournament')
          return
        }

        setResult(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Network error')
      } finally {
        setLoading(false)
      }
    }

    register()
  }, [id])

  return (
    <main className="register-page">
      <div className="tournament-header">
        <div>
          <h1>Register for Tournament</h1>
        </div>
      </div>

      {loading ? (
        <Card className="register-card">
          <Skeleton active paragraph={{ rows: 6 }} />
        </Card>
      ) : error ? (
        <Card className="register-card">
          <Alert type="error" message="Registration error" description={error} showIcon />
          <div style={{ marginTop: 20, display: 'flex', justifyContent: 'space-between' }}>
            <Button type="default" onClick={() => navigate('/tournments')}>
              Back to tournaments
            </Button>
          </div>
        </Card>
      ) : result ? (
        <Card className="register-card">
          <Alert
            type="success"
            message={result.message || 'Registered successfully'}
            description={
              <div>
                <p>
                  You are registered for <strong>{result.tournament.name}</strong>.
                </p>
                <p>
                  Registered: {result.registeredCount} / {result.tournament.players}
                </p>
                <p>Status: {result.tournament.status}</p>
              </div>
            }
            showIcon
          />
          <div style={{ marginTop: 20, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Button type="primary" onClick={() => navigate(`/tournment/${id}`)}>
              Go to tournament page
            </Button>
            <Button type="default" onClick={() => navigate('/tournments')}>
              Back to tournaments
            </Button>
          </div>
        </Card>
      ) : null}
    </main>
  )
}
