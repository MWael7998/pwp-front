import { useEffect, useState, useRef } from 'react'
import { useParams } from 'react-router-dom'

type Match = {
  id: number
  playerA: string
  playerB: string
}

type BracketRound = {
  round: number
  matches: Match[]
}

type TournamentDetail = {
  id: number | string
  name: string
  description: string
  status: string
  players: number
  registeredCount: number
  seatsLeft: number
  registeredUsers: string[]
  bracket: BracketRound[]
  seeding?: {
    leftSide: string[]
    rightSide: string[]
  }
}

export default function TournmentDetail() {
  const params = useParams()
  const id = params.id
  const [tournament, setTournament] = useState<TournamentDetail | null>(null)
  const [currentUser, setCurrentUser] = useState<string | null>(null)
  const [registrationMessage, setRegistrationMessage] = useState<string | null>(null)
  const [error, setError] = useState('')
  const bracketRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function loadTournament() {
      if (!id) return

      try {
        const response = await fetch(`/api/tournaments/${id}`, {
          credentials: 'include',
        })
        const data = await response.json()

        if (!response.ok) {
          setError(data.error || 'Unable to fetch tournament details')
          return
        }

        setCurrentUser(data.user || null)
        setRegistrationMessage(data.registrationMessage || null)

        if (data.tournament) {
          setTournament(data.tournament)
          console.log('Tournament users:', data.tournament.registeredUsers || [])
          console.log('Bracket data:', data.tournament.bracket || [])
        }
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : 'Network error while loading tournament')
      }
    }

    loadTournament()
  }, [id])

  const highlightMatch = (match: Match) => {
    return (
      currentUser && (match.playerA === currentUser || match.playerB === currentUser)
    )
  }

  const getAllPlayerSlots = () => {
    if (!tournament) return []
    const totalSlots = tournament.players
    const slots: string[] = []
    for (let i = 0; i < totalSlots; i++) {
      if (i < tournament.registeredUsers.length) {
        slots.push(tournament.registeredUsers[i])
      } else {
        slots.push(`[Empty Slot ${i + 1}]`)
      }
    }
    return slots
  }

  const getTeamBoxStyle = (isHighlighted: boolean) => ({
    padding: '8px 12px',
    borderRadius: '6px',
    background: isHighlighted ? '#1a73e8' : '#121212',
    color: isHighlighted ? '#fff' : '#d0d0d0',
    border: isHighlighted ? '2px solid #1a73e8' : '1px solid #555',
    fontSize: '13px',
    fontWeight: 600,
    textAlign: 'center' as const,
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden' as const,
    textOverflow: 'ellipsis' as const,
  })

  return (
    <main style={{ padding: 24 }}>
      <h1>Tournment {id}</h1>
      {error ? <p style={{ color: 'red' }}>{error}</p> : null}
      {registrationMessage ? <p style={{ color: '#1a73e8' }}>{registrationMessage}</p> : null}
      {tournament ? (
        <>
          <p>{tournament.description}</p>
          <p>Status: {tournament.status}</p>
          <p>
            Registered: {tournament.registeredCount} / {tournament.players}
          </p>
          <p>Seats left: {tournament.seatsLeft}</p>

          <section style={{ marginTop: 24 }}>
            <h2>Bracket</h2>
            <div
              ref={bracketRef}
              style={{
                overflowX: 'auto',
                background: '#0a0e27',
                borderRadius: 12,
                padding: 24,
                position: 'relative',
              }}
            >
              <div style={{ display: 'flex', gap: 40, alignItems: 'flex-start', minWidth: 'max-content' }}>
                {/* Left Side Seeds */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 160 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 4 }}>Seeds (Left)</div>
                  {tournament.seeding?.leftSide?.map((user, idx) => {
                    const isCurrentUser = currentUser === user
                    return (
                      <div
                        key={idx}
                        style={{
                          ...getTeamBoxStyle(isCurrentUser),
                          background: isCurrentUser ? '#1a73e8' : '#121212',
                          color: isCurrentUser ? '#fff' : '#d0d0d0',
                        }}
                      >
                        {user}
                      </div>
                    )
                  })}
                </div>

                {/* Rounds */}
                {tournament?.bracket?.map((round) => (
                  <div key={round.round} style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 140 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#888', textAlign: 'center' }}>
                      {round.round === tournament.bracket.length ? 'Final' : `Round ${round.round}`}
                    </div>
                    {round.matches.map((match) => {
                      const isHighlighted = highlightMatch(match)
                      return (
                        <div
                          key={match.id}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 6,
                            padding: 10,
                            borderRadius: 8,
                            background: isHighlighted ? 'rgba(26, 115, 232, 0.15)' : 'rgba(0, 0, 0, 0.4)',
                            border: isHighlighted ? '1px solid #1a73e8' : '1px solid #333',
                            minHeight: 60,
                          }}
                        >
                          <div style={getTeamBoxStyle(match.playerA === currentUser)}>
                            {match.playerA}
                          </div>
                          <div style={{ textAlign: 'center', fontSize: 11, color: '#666' }}>vs</div>
                          <div style={getTeamBoxStyle(match.playerB === currentUser)}>
                            {match.playerB}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ))}

                {/* Right Side Seeds */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 160 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 4 }}>Seeds (Right)</div>
                  {tournament.seeding?.rightSide?.map((user, idx) => {
                    const isCurrentUser = currentUser === user
                    return (
                      <div
                        key={idx}
                        style={{
                          ...getTeamBoxStyle(isCurrentUser),
                          background: isCurrentUser ? '#1a73e8' : '#121212',
                          color: isCurrentUser ? '#fff' : '#d0d0d0',
                        }}
                      >
                        {user}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </section>

          <section style={{ marginTop: 24 }}>
            <h2>Registered players</h2>
            <ul>
              {getAllPlayerSlots().map((slot, idx) => {
                const isEmpty = slot.includes('[Empty')
                return (
                  <li key={idx} style={{ color: isEmpty ? '#888888' : '#ffffff' }}>
                    {isEmpty ? <em>{slot}</em> : slot}
                  </li>
                )
              })}
            </ul>
          </section>
        </>
      ) : (
        <p>Loading tournament details…</p>
      )}
    </main>
  )
}
