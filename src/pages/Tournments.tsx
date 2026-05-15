import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Card, Skeleton, Tag, Modal, Button } from 'antd'
import * as QRCode from 'qrcode'

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

const statusColorMap: Record<string, string> = {
  ongoing: 'green',
  'waiting for players': 'orange',
  full: 'red',
}

export default function Tournments() {
  const enableQrDemo = import.meta.env.VITE_ENABLE_QR_DEMO === 'true'
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [userName, setUserName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null)
  const [qrSrc, setQrSrc] = useState('')
  const [qrLoading, setQrLoading] = useState(false)
  const [qrError, setQrError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    async function loadTournaments() {
      try {
        const response = await fetch('/api/tournaments', {
          credentials: 'include',
        })
        const data = await response.json()
        if (!response.ok) {
          throw new Error(data.error || 'Unable to load tournaments')
        }
        setTournaments(data.tournaments || [])
        setUserName(data.user || null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    loadTournaments()
  }, [])

  async function openQrModal(tournament: Tournament) {
    if (!enableQrDemo) {
      return
    }
    setSelectedTournament(tournament)
    setQrLoading(true)
    setQrError('')

    try {
      const url = `${window.location.origin}/tournment/${tournament.id}`
      const dataUrl = await QRCode.toDataURL(url, {
        width: 280,
        margin: 1,
      })
      setQrSrc(dataUrl)
    } catch {
      setQrError('Unable to render QR code')
    } finally {
      setQrLoading(false)
    }
  }

  function closeQrModal() {
    setSelectedTournament(null)
    setQrSrc('')
    setQrError('')
  }

  if (loading) {
    return (
      <main className="tournament-page">
        <div className="tournament-header">
          <h1>Tournaments</h1>
        </div>
        <div className="tournament-grid">
          {Array.from({ length: 3 }).map((_, index) => (
            <Card key={index} className="tournament-card" hoverable>
              <Skeleton active title paragraph={{ rows: 4 }} />
            </Card>
          ))}
        </div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="tournament-page">
        <div className="tournament-header">
          <h1>Tournaments</h1>
        </div>
        <p className="error-text">Error: {error}</p>
      </main>
    )
  }

  return (
    <main className="tournament-page">
      <div className="tournament-header">
        <div>
          <h1>Tournaments</h1>
          {userName ? <p className="welcome-text">Welcome, {userName}</p> : null}
        </div>
      </div>

      <div className="tournament-grid">
        {tournaments.map((tournament) => (
          <Card
            key={tournament.id}
            className="tournament-card"
            hoverable={enableQrDemo}
            bodyStyle={{ padding: 0 }}
            onClick={() => openQrModal(tournament)}
            style={enableQrDemo ? { cursor: 'pointer' } : undefined}
          >
            <div className="tournament-card-cover">
              <img className="tournament-card-image" src={tournament.image} alt={tournament.name} />
              <div className="tournament-status-pill">
                <Tag color={statusColorMap[tournament.status] || 'default'}>
                  {tournament.status}
                </Tag>
              </div>
              <div className="tournament-card-overlay">
                <div className="tournament-card-title">
                  <h3>{tournament.name}</h3>
                </div>
                <p>{tournament.description}</p>
                <div className="tournament-card-meta">
                  <span>Entry fee: {tournament.currency} {tournament.entryFee}</span>
                  <span>Players: {tournament.players}</span>
                </div>
                <Link to={`/tournment/${tournament.id}`} className="tournament-link" onClick={(e) => e.stopPropagation()}>
                  View details
                </Link>
              </div>
            </div>
          </Card>
        ))}
      </div>
      <Modal
        title={selectedTournament ? `Scan to open ${selectedTournament.name}` : 'Tournament QR'}
        open={!!selectedTournament}
        onCancel={closeQrModal}
        footer={null}
      >
        {qrLoading ? (
          <Skeleton active paragraph={{ rows: 5 }} />
        ) : qrError ? (
          <p className="error-text">{qrError}</p>
        ) : (
          <div className="qr-modal-content">
            {qrSrc ? <img src={qrSrc} alt="Tournament QR code" className="qr-image" /> : null}
            <p>
              Scan this QR code with your phone to open{' '}
              <strong>{selectedTournament?.name}</strong> directly.
            </p>
            <p className="qr-link-text">{selectedTournament ? `${window.location.origin}/tournment/${selectedTournament.id}` : ''}</p>
            {selectedTournament ? (
              <Button
                type="primary"
                block
                onClick={() => {
                  closeQrModal()
                  navigate(`/tournment/${selectedTournament.id}`)
                }}
              >
                Continue
              </Button>
            ) : null}
            <Button block onClick={closeQrModal}>
              Close
            </Button>
          </div>
        )}
      </Modal>
    </main>
  )
}
