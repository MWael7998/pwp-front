import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { io } from 'socket.io-client'
import type { GameProps } from '../Game'
import LeaveConfirmDialog from '../../components/LeaveConfirmDialog'
import ForfeitWinDialog from '../../components/ForfeitWinDialog'

const WIN_SCORE = 3

export default function HeadBallGame({ player, opponent, room, side }: GameProps) {
  const navigate = useNavigate()
  const isHost = side === 'left'
  const [, tournamentId, matchId] = room.match(/^t(\d+)_m(\d+)$/) || []

  const socketRef = useRef<ReturnType<typeof io> | null>(null)
  const [score, setScore] = useState({ left: 0, right: 0 })
  const [winner, setWinner] = useState<string | null>(null)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [forfeitWin, setForfeitWin] = useState(false)

  useEffect(() => {
    const socket = io('http://localhost:4000', { withCredentials: true })
    socketRef.current = socket
    socket.on('connect', () => {
      socket.emit('join_match', { roomId: room, playerName: player })
    })
    socket.on('hb_score', (data: { left: number; right: number }) => {
      setScore(data)
    })
    socket.on('hb_gameover', ({ winner: w }: { winner: string }) => {
      setWinner(w)
    })
    socket.on('opponent_forfeited', ({ winner: w }: { winner: string }) => {
      if (w === player) setForfeitWin(true)
    })
    return () => { socket.disconnect(); socketRef.current = null }
  }, [player, room])

  function addGoal(side: 'left' | 'right') {
    if (!isHost || winner) return
    const socket = socketRef.current
    if (!socket) return

    const next = { ...score, [side]: score[side] + 1 }
    setScore(next)
    socket.emit('hb_score', { room, ...next })

    const w = next.left >= WIN_SCORE ? player : next.right >= WIN_SCORE ? opponent : null
    if (w) {
      setWinner(w)
      socket.emit('hb_gameover', { room, winner: w })
      if (tournamentId && matchId) {
        socket.emit('report_match_result', { tournamentId, matchId, winner: w })
      }
    }
  }

  const myScore  = isHost ? score.left  : score.right
  const oppScore = isHost ? score.right : score.left

  return (
    <div style={page}>
      <div style={scoreboard}>
        <ScoreSlot name={player} score={myScore} you />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#4b5563', letterSpacing: 2, textTransform: 'uppercase' }}>Head Ball</div>
          <div style={{ fontSize: 32, fontWeight: 900, color: '#f1f5f9', letterSpacing: -1 }}>
            {myScore} — {oppScore}
          </div>
        </div>
        <ScoreSlot name={opponent} score={oppScore} />
      </div>

      <div style={{ position: 'relative', ...fieldStyle }}>
        <div style={fieldLine} />
        <div style={centerCircle} />
        <div style={goal('left')} />
        <div style={goal('right')} />
        <div style={ball} />

        {winner && (
          <div style={{
            position: 'absolute', inset: 0, background: 'rgba(2,8,2,0.88)', backdropFilter: 'blur(6px)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14,
            borderRadius: 12,
          }}>
            <div style={{ fontSize: 11, color: '#4b5563', textTransform: 'uppercase', letterSpacing: 3, fontWeight: 700 }}>
              {winner === player ? 'Victory' : 'Defeated'}
            </div>
            <div style={{ fontSize: 38, fontWeight: 900, color: winner === player ? '#22c55e' : '#ef4444' }}>{winner}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#64748b' }}>{myScore} — {oppScore}</div>
            <button
              onClick={() => navigate(tournamentId ? `/tournment/${tournamentId}` : -1 as any)}
              style={backBtn}
            >Back to Bracket</button>
          </div>
        )}
      </div>

      {isHost && !winner && (
        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          <button onClick={() => addGoal('left')}  style={goalBtn('#1d4ed8')}>+1 My Goal</button>
          <button onClick={() => addGoal('right')} style={goalBtn('#7f1d1d')}>+1 Opp Goal</button>
        </div>
      )}
      {!winner && (
        <button onClick={() => setShowLeaveConfirm(true)} style={backBtn}>Leave</button>
      )}

      {forfeitWin && (
        <ForfeitWinDialog
          onProceed={() => navigate(tournamentId ? `/tournment/${tournamentId}` : -1 as any)}
        />
      )}

      {showLeaveConfirm && (
        <LeaveConfirmDialog
          onCancel={() => setShowLeaveConfirm(false)}
          onConfirm={() => {
            socketRef.current?.emit('player_left', { tournamentId, matchId, opponentName: opponent })
            navigate(tournamentId ? `/tournment/${tournamentId}` : -1 as any)
          }}
        />
      )}
    </div>
  )
}

function ScoreSlot({ name, score, you }: { name: string; score: number; you?: boolean }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: you ? '#93c5fd' : '#64748b', marginBottom: 4 }}>
        {name}{you ? ' (You)' : ''}
      </div>
      <div style={{ fontSize: 44, fontWeight: 900, color: you ? '#f1f5f9' : '#94a3b8' }}>{score}</div>
    </div>
  )
}

const page: React.CSSProperties = {
  minHeight: '100vh', background: '#040e04',
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  padding: 24, gap: 16,
}
const scoreboard: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  gap: 40, background: '#071507', border: '1px solid #14532d',
  borderRadius: 16, padding: '16px 36px', width: '100%', maxWidth: 640,
}
const fieldStyle: React.CSSProperties = {
  width: 640, height: 360, background: '#15803d', borderRadius: 12,
  border: '3px solid #166534', overflow: 'hidden',
}
const fieldLine: React.CSSProperties = {
  position: 'absolute', left: '50%', top: 0, bottom: 0,
  width: 2, background: 'rgba(255,255,255,0.3)', transform: 'translateX(-50%)',
}
const centerCircle: React.CSSProperties = {
  position: 'absolute', left: '50%', top: '50%',
  width: 100, height: 100, borderRadius: '50%',
  border: '2px solid rgba(255,255,255,0.3)',
  transform: 'translate(-50%, -50%)',
}
const ball: React.CSSProperties = {
  position: 'absolute', left: '50%', top: '50%',
  width: 24, height: 24, borderRadius: '50%',
  background: '#f1f5f9', border: '2px solid #0f172a',
  transform: 'translate(-50%, -50%)',
  boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
}
function goal(side: 'left' | 'right'): React.CSSProperties {
  return {
    position: 'absolute', [side]: 0, top: '30%',
    width: 20, height: '40%',
    background: 'rgba(255,255,255,0.15)',
    border: '2px solid rgba(255,255,255,0.4)',
    borderLeft: side === 'right' ? '2px solid rgba(255,255,255,0.4)' : 'none',
    borderRight: side === 'left' ? '2px solid rgba(255,255,255,0.4)' : 'none',
  }
}
function goalBtn(bg: string): React.CSSProperties {
  return {
    padding: '8px 18px', borderRadius: 8, border: 'none',
    background: bg, color: '#fff', fontSize: 12, fontWeight: 700,
    cursor: 'pointer', letterSpacing: 1, textTransform: 'uppercase',
  }
}
const backBtn: React.CSSProperties = {
  padding: '8px 24px', borderRadius: 8, border: '1px solid #1e293b',
  background: '#0f172a', color: '#64748b', fontSize: 12, fontWeight: 700,
  cursor: 'pointer', letterSpacing: 1, textTransform: 'uppercase',
}
