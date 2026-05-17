import React, { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { io, Socket } from 'socket.io-client'

type Match        = { id: number; playerA: string; playerB: string; winner?: string | null }
type BracketRound = { round: number; matches: Match[] }
type Tournament   = {
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

// CSS variable references — values come from index.css, switch automatically with data-theme
const C = {
  bg:         'var(--bg)',
  surface:    'var(--surface)',
  surface2:   'var(--surface-2)',
  surface3:   'var(--surface-3)',
  border:     'var(--border)',
  borderSub:  'var(--border-sub)',
  text1:      'var(--text-1)',
  text2:      'var(--text-2)',
  text3:      'var(--text-3)',
  accent:     'var(--accent)',
  accentBg:   'var(--accent-bg)',
  accentRing: 'var(--accent-ring)',
  onAccent:   'var(--on-accent)',
  green:      'var(--green)',
  greenBg:    'var(--green-bg)',
  amber:      'var(--amber)',
  amberBg:    'var(--amber-bg)',
  amberRing:  'var(--amber-ring)',
  red:        'var(--red)',
  overlay:    'var(--overlay)',
} as const

// ─── Bracket geometry ─────────────────────────────────
const MATCH_H    = 80
const MATCH_W    = 188
const COL_W      = 252
const LABEL_H    = 38
const GAP        = 22
const TIMEOUT_MS = 2 * 60 * 1000

function computeTops(n: number): number[][] {
  const slot = MATCH_H + GAP
  const all: number[][] = []
  let prev = Array.from({ length: n }, (_, i) => i * slot)
  all.push(prev)
  while (prev.length > 1) {
    const next: number[] = []
    for (let i = 0; i < prev.length; i += 2)
      next.push((prev[i] + prev[i + 1] + MATCH_H) / 2 - MATCH_H / 2)
    all.push(next)
    prev = next
  }
  return all
}

function fmtCountdown(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function statusTheme(s: string) {
  if (s === 'started' || s === 'ongoing')
    return { color: C.green, bg: C.greenBg, border: 'var(--green-border)' }
  if (s === 'waiting for players')
    return { color: C.amber, bg: C.amberBg, border: 'var(--amber-border)' }
  return { color: C.text2, bg: 'transparent', border: C.border }
}

// ─── Main component ───────────────────────────────────
export default function TournamentDetail() {
  const { id }    = useParams()
  const navigate  = useNavigate()
  const socketRef  = useRef<Socket | null>(null)
  const bracketRef = useRef<BracketRound[]>([])

  const [tournament, setTournament]                   = useState<Tournament | null>(null)
  const [currentUser, setCurrentUser]                 = useState<string | null>(null)
  const [registrationMessage, setRegistrationMessage] = useState<string | null>(null)
  const [error, setError]       = useState('')
  const [bracket, setBracket]   = useState<BracketRound[]>([])
  const [lobbyState, setLobbyState] = useState<LobbyState | null>(null)
  const [showPopup, setShowPopup]   = useState(false)
  const [countdown, setCountdown]   = useState<number | null>(null)
  const [readyToPlay, setReadyToPlay] = useState(false)
  const [tournamentWinner, setTournamentWinner] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    fetch(`/api/tournaments/${id}`, { credentials: 'include' })
      .then(r => r.json().then(d => ({ status: r.status, d })))
      .then(({ status, d }) => {
        if (status === 409) { setError(d.error || 'Tournament is full'); return }
        if (status === 402) { setError(d.error || 'Insufficient points'); return }
        if (status >= 400) { setError(d.error || 'Failed to load'); return }
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

  useEffect(() => {
    if (!id || !currentUser) return
    const socket = io('http://localhost:4000', { withCredentials: true })
    socketRef.current = socket

    socket.on('connect', () =>
      socket.emit('join_tournament', { tournamentId: id, playerName: currentUser }))

    socket.on('bracket_updated', ({ bracket: b }: { bracket: BracketRound[] }) => {
      bracketRef.current = b; setBracket(b)
    })

    socket.on('match_lobby_update', (state: LobbyState) => {
      setLobbyState(state)
      if (state.players.includes(currentUser!)) setShowPopup(true)
      if (state.players.length >= 2) setReadyToPlay(true)
    })

    socket.on('match_result', () => { setShowPopup(false); setLobbyState(null); setReadyToPlay(false) })

    socket.on('tournament_winner', ({ winner }: { winner: string }) => {
      setShowPopup(false)
      setLobbyState(null)
      setTournamentWinner(winner)
    })

    socket.on('match_confirmed', ({ matchId, gameHosted }: { matchId: number; gameHosted: string }) => {
      const m = bracketRef.current.flatMap(r => r.matches).find(x => x.id === matchId)
      if (!m) return
      const opponent = m.playerA === currentUser ? m.playerB : m.playerA
      const side     = m.playerA === currentUser ? 'left' : 'right'
      navigate(
        `/game?room=t${id}_m${matchId}&player=${encodeURIComponent(currentUser!)}&opponent=${encodeURIComponent(opponent)}&gameHosted=${encodeURIComponent(gameHosted)}&side=${side}`
      )
    })

    return () => { socket.disconnect() }
  }, [id, currentUser, navigate])

  useEffect(() => {
    if (!bracket.length || !currentUser || !id || !socketRef.current) return
    // Find the earliest unplayed match this player is in across all rounds.
    // Skip matches that already have a winner — without this, round 1's completed
    // match gets found first and we join a ghost lobby for a finished game.
    const myMatch = bracket
      .flatMap(r => r.matches)
      .find(
        m => !m.winner &&
             (m.playerA === currentUser || m.playerB === currentUser) &&
             m.playerA && m.playerB &&
             !m.playerA.startsWith('Winner of') && !m.playerB.startsWith('Winner of')
      )
    if (myMatch)
      socketRef.current.emit('join_match_lobby', { tournamentId: id, matchId: myMatch.id, playerName: currentUser })
  }, [bracket, currentUser, id])

  useEffect(() => {
    if (!lobbyState?.timerStartedAt) { setCountdown(null); return }
    const started = lobbyState.timerStartedAt
    const tick = () => setCountdown(Math.max(0, TIMEOUT_MS - (Date.now() - started)))
    tick()
    const iv = setInterval(tick, 500)
    return () => clearInterval(iv)
  }, [lobbyState?.timerStartedAt])

  // Bracket layout
  const n0      = bracket[0]?.matches.length || 0
  const allTops = n0 > 0 ? computeTops(n0) : []
  const canvasH = n0 > 0 ? n0 * (MATCH_H + GAP) - GAP + LABEL_H + 24 : 0
  const canvasW = bracket.length * COL_W

  const connectors: string[] = []
  for (let r = 0; r < bracket.length - 1; r++) {
    const currTops = allTops[r] || []
    const nextTops = allTops[r + 1] || []
    nextTops.forEach((nextTop, ni) => {
      const yA   = LABEL_H + (currTops[ni * 2] ?? 0) + MATCH_H / 2
      const yB   = LABEL_H + (currTops[ni * 2 + 1] ?? 0) + MATCH_H / 2
      const yDst = LABEL_H + nextTop + MATCH_H / 2
      const x1   = r * COL_W + MATCH_W
      const midX = r * COL_W + MATCH_W + (COL_W - MATCH_W) / 2
      const x2   = (r + 1) * COL_W
      connectors.push(
        `M ${x1} ${yA} H ${midX} M ${x1} ${yB} H ${midX} M ${midX} ${yA} V ${yB} M ${midX} ${yDst} H ${x2}`
      )
    })
  }

  if (error) return (
    <div style={page}>
      <div style={{ maxWidth: 440, margin: '0 auto', padding: '100px 32px 0', textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 20 }}>◎</div>
        <p style={{ color: C.text1, fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Cannot Enter Tournament</p>
        <p style={{ color: C.text2, fontSize: 14, lineHeight: 1.6, marginBottom: 32 }}>{error}</p>
        <button
          onClick={() => navigate('/tournments')}
          style={{
            padding: '10px 24px', borderRadius: 99, border: `1px solid ${C.border}`,
            background: C.surface2, color: C.text2, fontSize: 13, fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          ← Back to Tournaments
        </button>
      </div>
    </div>
  )
  if (!tournament) return (
    <div style={page}>
      <p style={{ color: C.text3, fontSize: 14, textAlign: 'center', paddingTop: 100 }}>Loading…</p>
    </div>
  )

  const theme    = statusTheme(tournament.status)

  // Opponent name: prefer lobby (confirmed present) else fall back to bracket (next unplayed match)
  const nextMatchOpponent = (() => {
    const m = bracket.flatMap(r => r.matches).find(
      mx => !mx.winner &&
            (mx.playerA === currentUser || mx.playerB === currentUser) &&
            mx.playerA && mx.playerB &&
            !mx.playerA.startsWith('Winner of') && !mx.playerB.startsWith('Winner of')
    )
    if (!m) return ''
    return m.playerA === currentUser ? m.playerB : m.playerA
  })()
  const opponent = lobbyState?.players.find(p => p !== currentUser) ?? nextMatchOpponent

  return (
    <div style={page}>
      <div style={inner}>

        {/* Header */}
        <header style={{ marginBottom: 52 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18, flexWrap: 'wrap', marginBottom: 16 }}>
            <h1 style={{ margin: 0, fontSize: 42, fontWeight: 900, color: C.text1, letterSpacing: -1.5, lineHeight: 1.05 }}>
              {tournament.name}
            </h1>
            <span style={{
              alignSelf: 'flex-start', marginTop: 10,
              padding: '5px 14px', borderRadius: 99,
              fontSize: 10, fontWeight: 700,
              background: theme.bg, color: theme.color, border: `1px solid ${theme.border}`,
              textTransform: 'uppercase', letterSpacing: 1.5, whiteSpace: 'nowrap',
            }}>
              {tournament.status}
            </span>
          </div>
          {tournament.description && (
            <p style={{ margin: 0, color: C.text2, fontSize: 15, maxWidth: 580, lineHeight: 1.65 }}>
              {tournament.description}
            </p>
          )}
        </header>

        {/* Stats strip */}
        <div style={{ display: 'flex', gap: 1, background: C.border, borderRadius: 18, overflow: 'hidden', width: 'fit-content', marginBottom: 48 }}>
          {[
            { label: 'Players',    value: `${tournament.registeredCount} / ${tournament.players}` },
            { label: 'Seats left', value: String(tournament.seatsLeft) },
          ].map(s => (
            <div key={s.label} style={{ background: C.surface, padding: '20px 36px', transition: 'background 0.25s ease' }}>
              <div style={{ fontSize: 10, color: C.text3, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1.8, fontWeight: 600 }}>
                {s.label}
              </div>
              <div style={{ fontSize: 30, fontWeight: 800, color: C.text1, letterSpacing: -0.8, fontVariantNumeric: 'tabular-nums' }}>
                {s.value}
              </div>
            </div>
          ))}
        </div>

        {/* Registration notice */}
        {registrationMessage && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: C.accentBg, border: `1px solid ${C.accentRing}`,
            borderRadius: 12, padding: '13px 18px',
            color: C.accent, fontSize: 13, fontWeight: 500, marginBottom: 52,
          }}>
            <span style={{ fontSize: 15, lineHeight: 1 }}>◎</span>
            {registrationMessage}
          </div>
        )}

        {/* Bracket */}
        <section style={{ marginBottom: 64 }}>
          <div style={sectionLabel}>Bracket</div>
          {bracket.length > 0 ? (
            <div style={{
              overflowX: 'auto',
              background: C.surface, borderRadius: 22,
              padding: '32px 36px', border: `1px solid ${C.border}`,
              transition: 'background 0.25s ease',
            }}>
              <div style={{ position: 'relative', height: canvasH, width: canvasW, minWidth: canvasW }}>
                <svg style={{ position: 'absolute', inset: 0, width: canvasW, height: canvasH, pointerEvents: 'none' }}>
                  {connectors.map((d, i) => (
                    <path key={i} d={d} fill="none" style={{ stroke: 'var(--border)' }} strokeWidth={1.5} strokeLinecap="round" />
                  ))}
                </svg>

                {bracket.map((round, rIdx) => {
                  const tops   = allTops[rIdx] || []
                  const isLast = rIdx === bracket.length - 1
                  const isSemi = rIdx === bracket.length - 2 && bracket.length > 2
                  const label  = isLast ? 'Final' : isSemi ? 'Semi-Final' : `Round ${round.round}`

                  return (
                    <div key={round.round} style={{ position: 'absolute', left: rIdx * COL_W, top: 0 }}>
                      <div style={{
                        width: MATCH_W, height: LABEL_H,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 9, fontWeight: 700, color: C.text3,
                        textTransform: 'uppercase', letterSpacing: 2.5,
                      }}>
                        {label}
                      </div>

                      {round.matches.map((match, mIdx) => {
                        const top  = LABEL_H + (tops[mIdx] ?? mIdx * (MATCH_H + GAP))
                        const hiA  = match.playerA === currentUser
                        const hiB  = match.playerB === currentUser
                        const glow = hiA || hiB

                        return (
                          <div key={match.id} style={{ position: 'absolute', top, left: 0, width: MATCH_W }}>
                            <div style={{
                              padding: '8px 10px', borderRadius: 12,
                              background: glow ? C.accentBg : C.surface2,
                              border: `1px solid ${glow ? C.accentRing : C.borderSub}`,
                              display: 'flex', flexDirection: 'column', gap: 4,
                              transition: 'background 0.25s ease',
                            }}>
                              <BracketSlot name={match.playerA} me={hiA} isWinner={!!match.winner && match.winner === match.playerA} />
                              <div style={{ textAlign: 'center', fontSize: 8, color: C.text3, fontWeight: 800, letterSpacing: 2 }}>VS</div>
                              <BracketSlot name={match.playerB} me={hiB} isWinner={!!match.winner && match.winner === match.playerB} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div style={{
              background: C.surface, border: `1px solid ${C.border}`, borderRadius: 22,
              padding: '60px 32px', textAlign: 'center', color: C.text3, fontSize: 14, lineHeight: 1.65,
              transition: 'background 0.25s ease',
            }}>
              The bracket will appear once enough players have registered.
            </div>
          )}
        </section>

        {/* Players roster */}
        <section>
          <div style={sectionLabel}>Players</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {Array.from({ length: tournament.players }, (_, i) => {
              const pname = tournament.registeredUsers[i]
              const isMe  = pname === currentUser
              return (
                <div key={i} style={{
                  padding: '8px 20px', borderRadius: 99, fontSize: 13, fontWeight: 600,
                  background: isMe ? C.accentBg   : pname ? C.surface2    : 'transparent',
                  color:      isMe ? C.accent      : pname ? C.text2       : C.text3,
                  border: isMe
                    ? `1px solid ${C.accentRing}`
                    : pname
                    ? `1px solid ${C.border}`
                    : `1px dashed ${C.borderSub}`,
                  transition: 'background 0.25s ease',
                }}>
                  {pname || `Slot ${i + 1}`}
                </div>
              )
            })}
          </div>
        </section>

      </div>

      {/* Tournament winner popup */}
      {tournamentWinner && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1100,
          background: C.overlay,
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: C.surface, border: `1px solid ${C.accentRing}`,
            borderRadius: 32, padding: '60px 64px',
            minWidth: 360, maxWidth: 440, textAlign: 'center',
            boxShadow: `0 0 80px ${C.accentRing}`,
            transition: 'background 0.25s ease',
          }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>🏆</div>
            <div style={{ fontSize: 10, color: C.text3, textTransform: 'uppercase', letterSpacing: 2.5, fontWeight: 700, marginBottom: 20 }}>
              Tournament Champion
            </div>
            <div style={{ fontSize: 34, fontWeight: 900, color: C.accent, letterSpacing: -0.5, marginBottom: 8 }}>
              {tournamentWinner}
            </div>

            {tournamentWinner === currentUser ? (
              <>
                <div style={{ fontSize: 15, color: C.green, fontWeight: 700, marginBottom: 6 }}>
                  You Won!
                </div>
                <div style={{ fontSize: 13, color: C.text2, lineHeight: 1.65, marginBottom: 40 }}>
                  Congratulations — you are the champion of this tournament and claim the prize!
                </div>
              </>
            ) : (
              <div style={{ fontSize: 13, color: C.text2, lineHeight: 1.65, marginBottom: 40 }}>
                Better luck next time. The tournament has ended.
              </div>
            )}

            <button
              onClick={() => {
                fetch(`/api/tournaments/${id}/reset`, { method: 'POST', credentials: 'include' })
                navigate('/tournments')
              }}
              style={{
                width: '100%', padding: '16px 0', borderRadius: 14, border: 'none',
                background: C.accent, color: C.onAccent,
                fontSize: 13, fontWeight: 800, cursor: 'pointer',
                letterSpacing: 1.5, textTransform: 'uppercase',
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              Back
            </button>
          </div>
        </div>
      )}

      {/* Match popup */}
      {showPopup && lobbyState && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: C.overlay,
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: C.surface, border: `1px solid ${C.border}`,
            borderRadius: 28, padding: '52px 56px',
            minWidth: 340, maxWidth: 420, textAlign: 'center',
            transition: 'background 0.25s ease',
          }}>
            <div style={{ fontSize: 10, color: C.text3, textTransform: 'uppercase', letterSpacing: 2.5, fontWeight: 600, marginBottom: 24 }}>
              Next Match
            </div>

            <div style={{ fontSize: 30, fontWeight: 800, color: C.text1, letterSpacing: -0.5, marginBottom: 6 }}>
              {opponent || '—'}
            </div>

            {!readyToPlay && (lobbyState.players.length ?? 0) < 2 ? (
              /* Waiting for opponent to connect */
              <>
                <div style={{ fontSize: 13, color: C.text2, marginBottom: 48 }}>
                  Waiting for opponent to connect…
                </div>
                <div style={{
                  width: '100%', padding: '16px 0', borderRadius: 14,
                  background: C.surface2, border: `1px solid ${C.border}`,
                  color: C.text3, fontSize: 13, fontWeight: 700,
                  letterSpacing: 1.5, textTransform: 'uppercase',
                }}>
                  Waiting…
                </div>
              </>
            ) : (
              /* Both players in — show countdown and Play Now */
              <>
                <div style={{ fontSize: 13, color: C.text2, marginBottom: 48 }}>
                  is ready to play
                </div>
                <div style={{
                  fontSize: 68, fontWeight: 900, letterSpacing: -4, marginBottom: 48,
                  color: countdown !== null && countdown < 30000 ? C.red : C.text1,
                  fontVariantNumeric: 'tabular-nums', lineHeight: 1,
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
                    width: '100%', padding: '16px 0',
                    borderRadius: 14, border: 'none',
                    background: C.accent, color: C.onAccent,
                    fontSize: 13, fontWeight: 800, cursor: 'pointer',
                    letterSpacing: 1.5, textTransform: 'uppercase',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                >
                  Play Now
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────

function BracketSlot({ name, me, isWinner }: { name: string; me: boolean; isWinner?: boolean }) {
  const isEmpty       = !name
  const isPlaceholder = !isEmpty && name.startsWith('Winner of')
  return (
    <div style={{
      padding: '5px 9px', borderRadius: 7, fontSize: 11,
      fontWeight: me || isWinner ? 700 : 500,
      background: isWinner ? C.greenBg : me ? C.accentBg : isEmpty || isPlaceholder ? 'transparent' : C.surface3,
      color: isWinner ? C.green : me ? C.accent : isEmpty ? C.borderSub : isPlaceholder ? C.text3 : C.text2,
      border: isWinner
        ? `1px solid var(--green-border)`
        : me
        ? `1px solid ${C.accentRing}`
        : isEmpty || isPlaceholder
        ? `1px dashed ${C.borderSub}`
        : `1px solid ${C.border}`,
      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      maxWidth: MATCH_W - 22, minHeight: 24,
      transition: 'background 0.25s ease',
    }}>
      {isEmpty ? '' : name}
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────

const page: React.CSSProperties = {
  minHeight: '100vh',
  background: 'var(--bg)',
  color: 'var(--text-1)',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  paddingTop: 52,
  transition: 'background 0.25s ease',
}

const inner: React.CSSProperties = {
  maxWidth: 1120,
  margin: '0 auto',
  padding: '52px 36px 80px',
}

const sectionLabel: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, color: 'var(--text-3)',
  textTransform: 'uppercase', letterSpacing: 2.5, marginBottom: 18,
}
