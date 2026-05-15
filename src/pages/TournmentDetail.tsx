import React, { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { io, Socket } from 'socket.io-client'

type Match = { id: number; playerA: string; playerB: string }
type BracketRound = { round: number; matches: Match[] }
type Tournament = {
  id: number | string
  name: string
  description: string
  status: string
  players: number
  registeredCount: number
  seatsLeft: number
  registeredUsers: string[]
  bracket: BracketRound[]
}
type LobbyState = {
  matchId: number
  players: string[]
  timerStartedAt: number | null
}

const MATCH_H = 84
const MATCH_W = 164
const COL_W = 224
const LABEL_H = 30
const GAP = 20
const TIMEOUT_MS = 2 * 60 * 1000

function computeTops(n: number): number[][] {
  const slot = MATCH_H + GAP
  const all: number[][] = []
  let prev = Array.from({ length: n }, (_, i) => i * slot)
  all.push(prev)
  while (prev.length > 1) {
    const next: number[] = []
    for (let i = 0; i < prev.length; i += 2) {
      next.push((prev[i] + prev[i + 1] + MATCH_H) / 2 - MATCH_H / 2)
    }
    all.push(next)
    prev = next
  }
  return all
}

function fmtCountdown(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export default function TournamentDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const socketRef = useRef<Socket | null>(null)
  const bracketRef = useRef<BracketRound[]>([])

  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [currentUser, setCurrentUser] = useState<string | null>(null)
  const [registrationMessage, setRegistrationMessage] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [bracket, setBracket] = useState<BracketRound[]>([])
  const [lobbyState, setLobbyState] = useState<LobbyState | null>(null)
  const [showPopup, setShowPopup] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)

  // Fetch initial tournament data
  useEffect(() => {
    if (!id) return
    fetch(`/api/tournaments/${id}`, { credentials: 'include' })
      .then(r => r.json().then(d => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!ok) { setError(d.error || 'Failed to load'); return }
        setCurrentUser(d.user || null)
        setRegistrationMessage(d.registrationMessage || null)
        if (d.tournament) {
          setTournament(d.tournament)
          const b = d.tournament.bracket || []
          bracketRef.current = b
          setBracket(b)
        }
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Network error'))
  }, [id])

  // Connect socket once — never reconnects
  useEffect(() => {
    if (!id || !currentUser) return

    const socket = io('http://localhost:4000', { withCredentials: true })
    socketRef.current = socket

    socket.on('connect', () => {
      socket.emit('join_tournament', { tournamentId: id, playerName: currentUser })
    })

    socket.on('bracket_updated', ({ bracket: b }: { bracket: BracketRound[] }) => {
      bracketRef.current = b
      setBracket(b)
    })

    socket.on('match_lobby_update', (state: LobbyState) => {
      setLobbyState(state)
      if (state.players.length >= 2) setShowPopup(true)
    })

    socket.on('match_result', () => {
      setShowPopup(false)
      setLobbyState(null)
    })

    socket.on('match_confirmed', ({ matchId, gameHosted }: { matchId: number; gameHosted: string }) => {
      const m = bracketRef.current.flatMap(r => r.matches).find(x => x.id === matchId)
      if (!m) return
      const opponent = m.playerA === currentUser ? m.playerB : m.playerA
      const side = m.playerA === currentUser ? 'left' : 'right'
      navigate(
        `/game?room=t${id}_m${matchId}&player=${encodeURIComponent(currentUser!)}&opponent=${encodeURIComponent(opponent)}&gameHosted=${encodeURIComponent(gameHosted)}&side=${side}`
      )
    })

    return () => { socket.disconnect() }
  }, [id, currentUser, navigate])

  // Auto-join match lobby when both players are paired in the bracket
  useEffect(() => {
    if (!bracket.length || !currentUser || !id || !socketRef.current) return
    const myMatch = bracket[0]?.matches.find(
      m => (m.playerA === currentUser || m.playerB === currentUser) &&
        m.playerA && m.playerB &&
        !m.playerA.startsWith('Winner of') && !m.playerB.startsWith('Winner of')
    )
    if (myMatch) {
      socketRef.current.emit('join_match_lobby', { tournamentId: id, matchId: myMatch.id, playerName: currentUser })
    }
  }, [bracket, currentUser, id])

  // Countdown tick
  useEffect(() => {
    if (!lobbyState?.timerStartedAt) { setCountdown(null); return }
    const started = lobbyState.timerStartedAt
    const tick = () => setCountdown(Math.max(0, TIMEOUT_MS - (Date.now() - started)))
    tick()
    const iv = setInterval(tick, 500)
    return () => clearInterval(iv)
  }, [lobbyState?.timerStartedAt])

  const n0 = bracket[0]?.matches.length || 0
  const allTops = n0 > 0 ? computeTops(n0) : []
  const canvasH = n0 > 0 ? n0 * (MATCH_H + GAP) - GAP + LABEL_H + 24 : 0
  const canvasW = bracket.length * COL_W

  const connectors: string[] = []
  for (let r = 0; r < bracket.length - 1; r++) {
    const currTops = allTops[r] || []
    const nextTops = allTops[r + 1] || []
    nextTops.forEach((nextTop, ni) => {
      const yA = LABEL_H + (currTops[ni * 2] ?? 0) + MATCH_H / 2
      const yB = LABEL_H + (currTops[ni * 2 + 1] ?? 0) + MATCH_H / 2
      const yDest = LABEL_H + nextTop + MATCH_H / 2
      const x1 = r * COL_W + MATCH_W
      const midX = r * COL_W + MATCH_W + (COL_W - MATCH_W) / 2
      const x2 = (r + 1) * COL_W
      connectors.push(`M ${x1} ${yA} H ${midX} M ${x1} ${yB} H ${midX} M ${midX} ${yA} V ${yB} M ${midX} ${yDest} H ${x2}`)
    })
  }

  if (error) return <div style={page}><p style={{ color: '#f87171', fontSize: 14 }}>{error}</p></div>
  if (!tournament) return <div style={page}><p style={{ color: '#4b5563' }}>Loading…</p></div>

  const statusColors: Record<string, [string, string]> = {
    started: ['#22c55e', '#052e16'],
    ongoing: ['#f59e0b', '#1c1200'],
    'waiting for players': ['#3b82f6', '#0c1a3d'],
  }
  const [sc, sbg] = statusColors[tournament.status] || ['#6b7280', '#111827']

  const opponent = lobbyState ? lobbyState.players.find(p => p !== currentUser) ?? '' : ''

  return (
    <div style={page}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: 30, fontWeight: 800, color: '#f1f5f9' }}>{tournament.name}</h1>
        <span style={{
          padding: '3px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700,
          background: sbg, color: sc, border: `1px solid ${sc}55`,
          textTransform: 'uppercase', letterSpacing: 1,
        }}>
          {tournament.status}
        </span>
      </div>
      <p style={{ color: '#6b7280', marginBottom: 24, fontSize: 14, maxWidth: 560 }}>{tournament.description}</p>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        {[
          { label: 'Players', value: `${tournament.registeredCount} / ${tournament.players}` },
          { label: 'Seats Left', value: String(tournament.seatsLeft) },
        ].map(s => (
          <div key={s.label} style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 10, padding: '12px 20px' }}>
            <div style={{ fontSize: 10, color: '#4b5563', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1.5 }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#e2e8f0' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {registrationMessage && (
        <div style={{
          background: '#0c1e3a', border: '1px solid #1e40af', borderRadius: 8,
          padding: '10px 16px', color: '#60a5fa', fontSize: 13, marginBottom: 28,
        }}>
          {registrationMessage}
        </div>
      )}

      {/* Bracket */}
      {bracket.length > 0 ? (
        <section style={{ marginBottom: 44 }}>
          <div style={sectionLabel}>Bracket</div>
          <div style={{ overflowX: 'auto', background: '#060c1a', borderRadius: 16, padding: '24px 28px', border: '1px solid #0f1d35' }}>
            <div style={{ position: 'relative', height: canvasH, width: canvasW, minWidth: canvasW }}>
              <svg style={{ position: 'absolute', inset: 0, width: canvasW, height: canvasH, pointerEvents: 'none' }}>
                {connectors.map((d, i) => <path key={i} d={d} fill="none" stroke="#1e3a5f" strokeWidth={1.5} />)}
              </svg>

              {bracket.map((round, rIdx) => {
                const tops = allTops[rIdx] || []
                const isLast = rIdx === bracket.length - 1
                const isSemi = rIdx === bracket.length - 2 && bracket.length > 2
                const roundLabel = isLast ? 'Final' : isSemi ? 'Semi-Final' : `Round ${round.round}`

                return (
                  <div key={round.round} style={{ position: 'absolute', left: rIdx * COL_W, top: 0 }}>
                    <div style={{
                      width: MATCH_W, height: LABEL_H, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: 2,
                    }}>
                      {roundLabel}
                    </div>
                    {round.matches.map((match, mIdx) => {
                      const top = LABEL_H + (tops[mIdx] ?? mIdx * (MATCH_H + GAP))
                      const hiA = match.playerA === currentUser
                      const hiB = match.playerB === currentUser
                      const glow = hiA || hiB
                      const isWaiting = lobbyState?.matchId === match.id && lobbyState.players.length < 2

                      return (
                        <div key={match.id} style={{ position: 'absolute', top, left: 0, width: MATCH_W }}>
                          <div style={{
                            padding: '8px 10px', borderRadius: 10,
                            background: glow ? 'rgba(29,78,216,0.14)' : '#0d1425',
                            border: glow ? '1px solid #2563eb' : '1px solid #162032',
                            boxShadow: glow ? '0 0 20px rgba(37,99,235,0.18)' : '0 2px 10px rgba(0,0,0,0.5)',
                            display: 'flex', flexDirection: 'column', gap: 5,
                          }}>
                            <PlayerSlot name={match.playerA} me={hiA} />
                            <div style={{ textAlign: 'center', fontSize: 9, color: '#1e3a5f', fontWeight: 800, letterSpacing: 1.5 }}>VS</div>
                            <PlayerSlot name={match.playerB} me={hiB} />
                            {isWaiting && (
                              <div style={{
                                marginTop: 4, padding: '3px 6px', borderRadius: 6, fontSize: 10, fontWeight: 600,
                                background: 'rgba(245,158,11,0.10)', border: '1px solid #78350f', color: '#fbbf24', textAlign: 'center',
                              }}>
                                Waiting for opponent…
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      ) : (
        <div style={{
          background: '#060c1a', border: '1px solid #0f1d35', borderRadius: 16,
          padding: '40px 24px', textAlign: 'center', color: '#334155', fontSize: 14, marginBottom: 44,
        }}>
          Bracket will appear once enough players have registered.
        </div>
      )}

      {/* Players */}
      <section>
        <div style={sectionLabel}>Players</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {Array.from({ length: tournament.players }, (_, i) => {
            const name = tournament.registeredUsers[i]
            const isMe = name === currentUser
            return (
              <div key={i} style={{
                padding: '7px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600,
                background: isMe ? '#1d4ed8' : name ? '#0f172a' : 'transparent',
                color: isMe ? '#fff' : name ? '#94a3b8' : '#1e293b',
                border: isMe ? '1px solid #3b82f6' : name ? '1px solid #1e293b' : '1px dashed #1e293b',
              }}>
                {name || `Slot ${i + 1}`}
              </div>
            )
          })}
        </div>
      </section>

      {/* Match popup — appears when opponent joins */}
      {showPopup && lobbyState && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: '#0d1425', border: '1px solid #1e3a5f', borderRadius: 20,
            padding: '36px 40px', minWidth: 320, maxWidth: 400, textAlign: 'center',
            boxShadow: '0 0 60px rgba(37,99,235,0.25)',
          }}>
            <div style={{ fontSize: 13, color: '#4b5563', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8 }}>
              Match Ready
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#f1f5f9', marginBottom: 4 }}>
              {opponent} joined!
            </div>
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 28 }}>
              Confirm before the timer runs out
            </div>

            <div style={{
              fontSize: 52, fontWeight: 900, letterSpacing: -2, marginBottom: 28,
              color: countdown !== null && countdown < 30000 ? '#ef4444' : '#3b82f6',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {countdown !== null ? fmtCountdown(countdown) : '2:00'}
            </div>

            <button
              onClick={() => {
                setShowPopup(false)
                socketRef.current?.emit('click_join_match', {
                  tournamentId: id,
                  matchId: lobbyState.matchId,
                  playerName: currentUser,
                })
              }}
              style={{
                width: '100%', padding: '13px 0', borderRadius: 10, border: 'none',
                background: '#1d4ed8', color: '#fff', fontSize: 15, fontWeight: 800,
                cursor: 'pointer', letterSpacing: 1, textTransform: 'uppercase',
                boxShadow: '0 0 24px rgba(37,99,235,0.4)',
              }}
            >
              Confirm
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function PlayerSlot({ name, me }: { name: string; me: boolean }) {
  const isEmpty = !name
  const isPlaceholder = !isEmpty && name.startsWith('Winner of')
  return (
    <div style={{
      padding: '5px 8px', borderRadius: 6, fontSize: 12,
      fontWeight: me ? 700 : 600,
      background: me ? '#1d4ed8' : (isEmpty || isPlaceholder) ? 'transparent' : '#111c2e',
      color: me ? '#fff' : isEmpty ? '#1e293b' : isPlaceholder ? '#1e3a5f' : '#94a3b8',
      border: me ? '1px solid #3b82f6' : (isEmpty || isPlaceholder) ? '1px dashed #1e3a5f' : '1px solid #1a2c44',
      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      maxWidth: MATCH_W - 20, minHeight: 22,
    }}>
      {isEmpty ? '' : name}
    </div>
  )
}

const page: React.CSSProperties = {
  minHeight: '100vh', width: '100%', background: '#080c18', color: '#e2e8f0',
  padding: '36px 28px',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  boxSizing: 'border-box',
}

const sectionLabel: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, color: '#334155',
  textTransform: 'uppercase', letterSpacing: 2.5, marginBottom: 14,
}
