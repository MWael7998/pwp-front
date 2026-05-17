import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { io } from 'socket.io-client'
import type { GameProps } from '../Game'
import LeaveConfirmDialog from '../../components/LeaveConfirmDialog'
import ForfeitWinDialog from '../../components/ForfeitWinDialog'

const W = 700
const H = 420
const PUCK_R = 14
const PADDLE_R = 32
const GOAL_H = 140
const WALL_T = 8
const WIN_SCORE = 3
const MAX_SPEED = 13
const FRICTION = 0.997
const TICK_MS = 16   // ~60hz logic tick — runs even when window is backgrounded

type Paddle = { x: number; y: number; vx: number; vy: number }
type Puck   = { x: number; y: number; vx: number; vy: number }

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)) }

function resolveCollision(puck: Puck, paddle: Paddle) {
  const dx = puck.x - paddle.x
  const dy = puck.y - paddle.y
  const dist = Math.sqrt(dx * dx + dy * dy)
  const min  = PUCK_R + PADDLE_R
  if (dist >= min || dist === 0) return
  const nx = dx / dist, ny = dy / dist
  const rel = puck.vx * nx + puck.vy * ny
  puck.vx = puck.vx - 2 * rel * nx + paddle.vx * 0.6
  puck.vy = puck.vy - 2 * rel * ny + paddle.vy * 0.6
  puck.x  = paddle.x + nx * (min + 1)
  puck.y  = paddle.y + ny * (min + 1)
  const spd = Math.sqrt(puck.vx ** 2 + puck.vy ** 2)
  if (spd > MAX_SPEED) { puck.vx = puck.vx / spd * MAX_SPEED; puck.vy = puck.vy / spd * MAX_SPEED }
  if (spd < 2)         { puck.vx = nx * 3; puck.vy = ny * 3 }
}

export default function AirHockeyGame({ player, opponent, room, side }: GameProps) {
  const navigate = useNavigate()
  const isHost   = side === 'left'

  // Parse tournamentId and matchId from room string "t{tid}_m{mid}"
  const [, tournamentId, matchId] = room.match(/^t(\d+)_m(\d+)$/) || []

  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const socketRef  = useRef<ReturnType<typeof io> | null>(null)
  const activeRef  = useRef(false)
  const pointerRef = useRef({ x: isHost ? PADDLE_R + 40 : W - PADDLE_R - 40, y: H / 2 })

  // All mutable game state lives here — never triggers re-renders
  const gs = useRef({
    puck:        { x: W / 2, y: H / 2, vx: isHost ? -3.5 : 0, vy: isHost ? 2 : 0 } as Puck,
    leftPaddle:  { x: PADDLE_R + 40,     y: H / 2, vx: 0, vy: 0 } as Paddle,
    rightPaddle: { x: W - PADDLE_R - 40, y: H / 2, vx: 0, vy: 0 } as Paddle,
    score:       { left: 0, right: 0 },
    over:        false,
  })

  const [scoreDisplay, setScoreDisplay] = useState({ left: 0, right: 0 })
  const [winner, setWinner]             = useState<string | null>(null)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [forfeitWin, setForfeitWin]     = useState(false)

  // ─── draw ─────────────────────────────────────────────────────────────────
  const drawRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx    = canvas.getContext('2d')!
    const g      = gs.current
    const goalTop = (H - GOAL_H) / 2
    const goalBot = (H + GOAL_H) / 2

    function draw() {
      ctx.clearRect(0, 0, W, H)

      // Rink
      ctx.fillStyle = '#060e1e'; ctx.fillRect(0, 0, W, H)
      const bg = ctx.createRadialGradient(W / 2, H / 2, 20, W / 2, H / 2, W * 0.6)
      bg.addColorStop(0, 'rgba(30,58,138,0.18)'); bg.addColorStop(1, 'transparent')
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H)

      // Walls
      ctx.fillStyle = '#1e3a5f'
      ctx.fillRect(0, 0, W, WALL_T);              ctx.fillRect(0, H - WALL_T, W, WALL_T)
      ctx.fillRect(0, WALL_T, WALL_T, goalTop - WALL_T);  ctx.fillRect(0, goalBot, WALL_T, H - goalBot - WALL_T)
      ctx.fillRect(W - WALL_T, WALL_T, WALL_T, goalTop - WALL_T); ctx.fillRect(W - WALL_T, goalBot, WALL_T, H - goalBot - WALL_T)

      // Goal mouths
      ctx.fillStyle = 'rgba(37,99,235,0.09)';  ctx.fillRect(0,      goalTop, 22, GOAL_H)
      ctx.fillStyle = 'rgba(239,68,68,0.09)';  ctx.fillRect(W - 22, goalTop, 22, GOAL_H)

      // Goal posts
      const post = (x: number, y: number) => {
        ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2)
        ctx.fillStyle = '#e2e8f0'; ctx.fill()
        ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 1.5; ctx.stroke()
      }
      post(WALL_T, goalTop); post(WALL_T, goalBot); post(W - WALL_T, goalTop); post(W - WALL_T, goalBot)

      // Center line + circle
      ctx.strokeStyle = 'rgba(30,58,138,0.45)'; ctx.lineWidth = 2; ctx.setLineDash([6, 6])
      ctx.beginPath(); ctx.moveTo(W / 2, WALL_T); ctx.lineTo(W / 2, H - WALL_T); ctx.stroke()
      ctx.setLineDash([])
      ctx.beginPath(); ctx.arc(W / 2, H / 2, 70, 0, Math.PI * 2); ctx.stroke()
      ctx.beginPath(); ctx.arc(W / 2, H / 2, 5, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(30,58,138,0.8)'; ctx.fill()

      // Goal arcs
      ctx.strokeStyle = 'rgba(59,130,246,0.28)'; ctx.lineWidth = 2
      ctx.beginPath(); ctx.arc(WALL_T,     H / 2, GOAL_H / 2 + 16, -Math.PI / 2, Math.PI / 2); ctx.stroke()
      ctx.beginPath(); ctx.arc(W - WALL_T, H / 2, GOAL_H / 2 + 16,  Math.PI / 2, 3 * Math.PI / 2); ctx.stroke()

      // Puck
      ctx.beginPath(); ctx.arc(g.puck.x + 3, g.puck.y + 4, PUCK_R, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fill()
      const pg = ctx.createRadialGradient(g.puck.x - 4, g.puck.y - 4, 2, g.puck.x, g.puck.y, PUCK_R)
      pg.addColorStop(0, '#e2e8f0'); pg.addColorStop(1, '#475569')
      ctx.beginPath(); ctx.arc(g.puck.x, g.puck.y, PUCK_R, 0, Math.PI * 2)
      ctx.fillStyle = pg; ctx.fill()
      ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 1.5; ctx.stroke()

      // Paddle helper
      const paddle = (p: Paddle, c0: string, c1: string, rim: string, isOwn: boolean) => {
        if (isOwn && activeRef.current) {
          ctx.beginPath(); ctx.arc(p.x, p.y, PADDLE_R + 10, 0, Math.PI * 2)
          ctx.fillStyle = c0 + '28'; ctx.fill()
        }
        const grad = ctx.createRadialGradient(p.x - 8, p.y - 8, 4, p.x, p.y, PADDLE_R)
        grad.addColorStop(0, c0); grad.addColorStop(1, c1)
        ctx.beginPath(); ctx.arc(p.x, p.y, PADDLE_R, 0, Math.PI * 2)
        ctx.fillStyle = grad; ctx.fill()
        ctx.strokeStyle = rim; ctx.lineWidth = isOwn ? 2.5 : 1.5; ctx.stroke()
        ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2)
        ctx.fillStyle = rim; ctx.fill()
      }
      paddle(g.leftPaddle,  '#60a5fa', '#1d4ed8', '#93c5fd',  isHost)
      paddle(g.rightPaddle, '#f87171', '#991b1b', '#fca5a5', !isHost)
    }

    drawRef.current = draw

    // rAF loop — only renders, no logic; pauses in background (fine, you can't see it)
    let raf: number
    function renderLoop() {
      draw()
      raf = requestAnimationFrame(renderLoop)
    }
    raf = requestAnimationFrame(renderLoop)

    return () => {
      cancelAnimationFrame(raf)
      drawRef.current = null
    }
  }, [isHost])

  // ─── socket + logic tick ──────────────────────────────────────────────────
  useEffect(() => {
    const socket = io('http://localhost:4000', { withCredentials: true })
    socketRef.current = socket
    const g      = gs.current
    const goalTop = (H - GOAL_H) / 2
    const goalBot = (H + GOAL_H) / 2

    socket.on('connect', () => {
      socket.emit('join_match', { roomId: room, playerName: player })
    })

    // ── socket receivers ───────────────────────────────────────────────────
    if (isHost) {
      socket.on('ah_paddle', ({ x, y }: { x: number; y: number }) => {
        g.rightPaddle.vx = x - g.rightPaddle.x
        g.rightPaddle.vy = y - g.rightPaddle.y
        g.rightPaddle.x  = x
        g.rightPaddle.y  = y
      })
    } else {
      socket.on('ah_state', (data: {
        puck: Puck
        leftPaddle:  { x: number; y: number }
        rightPaddle: { x: number; y: number }
        score: { left: number; right: number }
      }) => {
        // Update ALL shared state from authoritative host data
        g.puck.x  = data.puck.x;  g.puck.y  = data.puck.y
        g.puck.vx = data.puck.vx; g.puck.vy = data.puck.vy
        g.leftPaddle.x  = data.leftPaddle.x
        g.leftPaddle.y  = data.leftPaddle.y
        g.rightPaddle.x = data.rightPaddle.x
        g.rightPaddle.y = data.rightPaddle.y

        // Immediately paint the received state — don't wait for next rAF tick
        drawRef.current?.()

        if (data.score.left !== g.score.left || data.score.right !== g.score.right) {
          g.score = data.score
          setScoreDisplay({ ...data.score })
        }
      })
    }

    socket.on('ah_gameover', ({ winner: w }: { winner: string }) => {
      g.over = true
      setWinner(w)
    })
    socket.on('opponent_forfeited', ({ winner: w }: { winner: string }) => {
      if (w === player) { g.over = true; setForfeitWin(true) }
    })

    // ── logic helpers ──────────────────────────────────────────────────────
    function movePaddle(paddle: Paddle, minX: number, maxX: number) {
      const px = paddle.x, py = paddle.y
      if (activeRef.current) {
        paddle.x += (clamp(pointerRef.current.x, minX, maxX) - paddle.x) * 0.4
        paddle.y += (clamp(pointerRef.current.y, WALL_T + PADDLE_R, H - WALL_T - PADDLE_R) - paddle.y) * 0.4
      }
      paddle.vx = paddle.x - px
      paddle.vy = paddle.y - py
    }

    function resetPuck(toward: 'left' | 'right') {
      g.puck.x  = W / 2; g.puck.y  = H / 2
      g.puck.vx = (toward === 'left' ? -1 : 1) * (3 + Math.random() * 2)
      g.puck.vy = (Math.random() - 0.5) * 5
    }

    function declareWinner(w: string) {
      g.over = true
      setWinner(w)
      socket.emit('ah_gameover', { room, winner: w })
      if (tournamentId && matchId) {
        socket.emit('report_match_result', { tournamentId, matchId, winner: w })
      }
    }

    // ── setInterval logic tick — never pauses when window loses focus ──────
    const tick = setInterval(() => {
      if (g.over) return

      if (isHost) {
        // Move own (left) paddle
        movePaddle(g.leftPaddle, PADDLE_R, W / 2 - PADDLE_R)

        // Puck physics
        g.puck.x += g.puck.vx; g.puck.y += g.puck.vy
        g.puck.vx *= FRICTION;  g.puck.vy *= FRICTION

        // Wall bounce — top / bottom
        if (g.puck.y - PUCK_R < WALL_T)     { g.puck.y = WALL_T + PUCK_R;     g.puck.vy =  Math.abs(g.puck.vy) }
        if (g.puck.y + PUCK_R > H - WALL_T) { g.puck.y = H - WALL_T - PUCK_R; g.puck.vy = -Math.abs(g.puck.vy) }

        // Side walls — bounce where there is no goal
        if (g.puck.x - PUCK_R < WALL_T && !(g.puck.y > goalTop && g.puck.y < goalBot)) {
          g.puck.x = WALL_T + PUCK_R; g.puck.vx = Math.abs(g.puck.vx)
        }
        if (g.puck.x + PUCK_R > W - WALL_T && !(g.puck.y > goalTop && g.puck.y < goalBot)) {
          g.puck.x = W - WALL_T - PUCK_R; g.puck.vx = -Math.abs(g.puck.vx)
        }

        // Paddle collisions
        resolveCollision(g.puck, g.leftPaddle)
        resolveCollision(g.puck, g.rightPaddle)

        // Goal detection
        if (g.puck.x - PUCK_R < WALL_T && g.puck.y > goalTop && g.puck.y < goalBot) {
          g.score.right++
          setScoreDisplay({ ...g.score })
          if (g.score.right >= WIN_SCORE) { declareWinner(opponent); return }
          resetPuck('right')
        } else if (g.puck.x + PUCK_R > W - WALL_T && g.puck.y > goalTop && g.puck.y < goalBot) {
          g.score.left++
          setScoreDisplay({ ...g.score })
          if (g.score.left >= WIN_SCORE) { declareWinner(player); return }
          resetPuck('left')
        }

        // Broadcast authoritative state to guest
        socket.emit('ah_state', {
          room,
          puck:        { x: g.puck.x,        y: g.puck.y,        vx: g.puck.vx,        vy: g.puck.vy },
          leftPaddle:  { x: g.leftPaddle.x,  y: g.leftPaddle.y },
          rightPaddle: { x: g.rightPaddle.x, y: g.rightPaddle.y },
          score:       g.score,
        })

      } else {
        // Guest: move own (right) paddle and send to host
        movePaddle(g.rightPaddle, W / 2 + PADDLE_R, W - PADDLE_R)
        socket.emit('ah_paddle', { room, x: g.rightPaddle.x, y: g.rightPaddle.y })
      }
    }, TICK_MS)

    return () => {
      clearInterval(tick)
      socket.disconnect()
      socketRef.current = null
    }
  }, [isHost, player, opponent, room])

  // ─── pointer events ───────────────────────────────────────────────────────
  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const r = canvasRef.current!.getBoundingClientRect()
    return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) }
  }
  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    activeRef.current = true; pointerRef.current = pos(e)
    ;(e.target as HTMLCanvasElement).setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => { if (activeRef.current) pointerRef.current = pos(e) }
  const onPointerUp   = () => { activeRef.current = false }

  // ─── UI ───────────────────────────────────────────────────────────────────
  const myScore  = isHost ? scoreDisplay.left  : scoreDisplay.right
  const oppScore = isHost ? scoreDisplay.right : scoreDisplay.left

  return (
    <div style={page}>
      <div style={scoreboard}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#93c5fd', letterSpacing: 1, marginBottom: 4 }}>
            {player} <span style={{ color: '#1e3a5f' }}>(You)</span>
          </div>
          <div style={{ fontSize: 44, fontWeight: 900, color: '#f1f5f9', fontVariantNumeric: 'tabular-nums' }}>{myScore}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: '#1e3a5f', textTransform: 'uppercase', letterSpacing: 2.5, fontWeight: 700 }}>Air Hockey</div>
          <div style={{ fontSize: 11, color: '#334155', marginTop: 4 }}>First to {WIN_SCORE}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#fca5a5', letterSpacing: 1, marginBottom: 4 }}>{opponent}</div>
          <div style={{ fontSize: 44, fontWeight: 900, color: '#f1f5f9', fontVariantNumeric: 'tabular-nums' }}>{oppScore}</div>
        </div>
      </div>

      <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', boxShadow: '0 0 48px rgba(37,99,235,0.18)' }}>
        <canvas
          ref={canvasRef} width={W} height={H}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove}
          onPointerUp={onPointerUp} onPointerLeave={onPointerUp}
          style={{ display: 'block', width: '100%', maxWidth: W, touchAction: 'none', cursor: 'none', userSelect: 'none' }}
        />
        {winner && (
          <div style={{
            position: 'absolute', inset: 0, background: 'rgba(4,8,16,0.88)', backdropFilter: 'blur(6px)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14,
          }}>
            <div style={{ fontSize: 11, color: '#4b5563', textTransform: 'uppercase', letterSpacing: 3, fontWeight: 700 }}>
              {winner === player ? 'Victory' : 'Defeated'}
            </div>
            <div style={{ fontSize: 38, fontWeight: 900, color: winner === player ? '#22c55e' : '#ef4444' }}>{winner}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>
              {scoreDisplay.left} — {scoreDisplay.right}
            </div>
            <button onClick={() => navigate(tournamentId ? `/tournment/${tournamentId}` : -1 as any)} style={backBtn}>Back to Bracket</button>
          </div>
        )}
      </div>

      <div style={{ fontSize: 10, color: '#1e3a5f', textTransform: 'uppercase', letterSpacing: 2, fontWeight: 700 }}>
        Hold &amp; drag · your paddle is {isHost ? 'blue (left)' : 'red (right)'}
      </div>
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

const page: React.CSSProperties = {
  minHeight: '100vh', background: '#040810',
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  padding: 24, gap: 14,
}
const scoreboard: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 48,
  background: '#060e1e', border: '1px solid #1e3a5f', borderRadius: 12,
  padding: '14px 36px', width: '100%', maxWidth: W, boxSizing: 'border-box',
}
const backBtn: React.CSSProperties = {
  padding: '9px 24px', borderRadius: 8, border: '1px solid #1e293b',
  background: '#0f172a', color: '#64748b', fontSize: 12, fontWeight: 700,
  cursor: 'pointer', letterSpacing: 1, textTransform: 'uppercase',
}
