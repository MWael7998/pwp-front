import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { io } from 'socket.io-client'
import type { GameProps } from '../Game'
import LeaveConfirmDialog from '../../components/LeaveConfirmDialog'
import ForfeitWinDialog from '../../components/ForfeitWinDialog'

const START_PRICE = 1000
const TICK_MS = 1000
const DROP_AMOUNT = 20
const MIN_PRICE = 0

export default function DutchAuctionGame({ player, opponent, room, side }: GameProps) {
  const navigate = useNavigate()
  const isHost = side === 'left'
  const [, tournamentId, matchId] = room.match(/^t(\d+)_m(\d+)$/) || []

  const socketRef = useRef<ReturnType<typeof io> | null>(null)
  const bidsRef   = useRef<Record<string, number>>({})

  const [price, setPrice]     = useState(START_PRICE)
  const [running, setRunning] = useState(false)
  const [myBid, setMyBid]     = useState<number | null>(null)
  const [winner, setWinner]   = useState<string | null>(null)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [forfeitWin, setForfeitWin] = useState(false)

  useEffect(() => {
    const socket = io('http://localhost:4000', { withCredentials: true })
    socketRef.current = socket
    socket.on('connect', () => {
      socket.emit('join_match', { roomId: room, playerName: player })
    })

    // Guest receives host's bid and both bids are now known
    socket.on('da_bid', ({ name, price: p }: { name: string; price: number }) => {
      bidsRef.current[name] = p
      checkFinish(socket)
    })

    socket.on('da_gameover', ({ winner: w }: { winner: string }) => {
      setWinner(w)
    })
    socket.on('opponent_forfeited', ({ winner: w }: { winner: string }) => {
      if (w === player) setForfeitWin(true)
    })

    return () => { socket.disconnect(); socketRef.current = null }
  }, [player, room])

  function checkFinish(socket: ReturnType<typeof io>) {
    const bids = bidsRef.current
    if (!(player in bids) || !(opponent in bids)) return
    // Higher bid wins (bid early = high price = aggressive)
    const w = bids[player] >= bids[opponent] ? player : opponent
    setWinner(w)
    socket.emit('da_gameover', { room, winner: w })
    if (isHost && tournamentId && matchId) {
      socket.emit('report_match_result', { tournamentId, matchId, winner: w })
    }
  }

  useEffect(() => {
    if (!running || myBid !== null) return
    const iv = setInterval(() => {
      setPrice(p => {
        if (p - DROP_AMOUNT <= MIN_PRICE) { setRunning(false); return MIN_PRICE }
        return p - DROP_AMOUNT
      })
    }, TICK_MS)
    return () => clearInterval(iv)
  }, [running, myBid])

  function placeBid() {
    setMyBid(price)
    setRunning(false)
    bidsRef.current[player] = price
    socketRef.current?.emit('da_bid', { room, name: player, price })
    if (socketRef.current) checkFinish(socketRef.current)
  }

  const pct = price / START_PRICE
  const priceColor = pct > 0.6 ? '#22c55e' : pct > 0.3 ? '#f59e0b' : '#ef4444'

  return (
    <div style={page}>
      <div style={panel}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#78350f', textTransform: 'uppercase', letterSpacing: 2.5, marginBottom: 4 }}>
          Dutch Auction
        </div>
        <div style={{ fontSize: 13, color: '#64748b', marginBottom: 28 }}>
          <span style={{ color: '#93c5fd' }}>{player}</span> vs <span style={{ color: '#94a3b8' }}>{opponent}</span>
        </div>

        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 11, color: '#4b5563', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8 }}>
            Current Price
          </div>
          <div style={{ fontSize: 72, fontWeight: 900, color: priceColor, letterSpacing: -4, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
            {price}
          </div>
          <div style={{ fontSize: 13, color: '#4b5563', marginTop: 4 }}>Points</div>
        </div>

        <div style={{ height: 8, background: '#0f172a', borderRadius: 4, marginBottom: 32, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct * 100}%`, background: priceColor, borderRadius: 4, transition: 'width 0.4s, background 0.4s' }} />
        </div>

        {winner ? (
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ padding: '16px', borderRadius: 10, background: winner === player ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${winner === player ? '#166534' : '#7f1d1d'}` }}>
              <div style={{ fontSize: 13, color: winner === player ? '#4ade80' : '#f87171', fontWeight: 700, marginBottom: 4 }}>
                {winner === player ? 'You Win!' : 'You Lost'}
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#94a3b8' }}>{winner} wins the auction</div>
            </div>
            <button
              onClick={() => navigate(tournamentId ? `/tournment/${tournamentId}` : -1 as any)}
              style={backBtn}
            >Back to Bracket</button>
          </div>
        ) : myBid !== null ? (
          <div style={{ textAlign: 'center', padding: '16px', borderRadius: 10, background: 'rgba(34,197,94,0.1)', border: '1px solid #166534' }}>
            <div style={{ fontSize: 13, color: '#4ade80', fontWeight: 700, marginBottom: 4 }}>Bid placed!</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#f1f5f9' }}>{myBid} Points</div>
            <div style={{ fontSize: 12, color: '#4b5563', marginTop: 8 }}>Waiting for {opponent}…</div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 10 }}>
            {!running ? (
              <button onClick={() => setRunning(true)} style={primaryBtn('#d97706')}>
                {price === START_PRICE ? 'Start Auction' : 'Resume'}
              </button>
            ) : (
              <button onClick={placeBid} style={primaryBtn('#1d4ed8')}>
                Bid Now — {price} pts
              </button>
            )}
            <button onClick={() => setShowLeaveConfirm(true)} style={backBtn}>Leave</button>
          </div>
        )}
      </div>
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

function primaryBtn(bg: string): React.CSSProperties {
  return {
    flex: 1, padding: '12px 0', borderRadius: 10, border: 'none',
    background: bg, color: '#fff', fontSize: 14, fontWeight: 800,
    cursor: 'pointer', letterSpacing: 1, textTransform: 'uppercase',
  }
}

const page: React.CSSProperties = {
  minHeight: '100vh', background: '#0c0800',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  padding: 24,
}
const panel: React.CSSProperties = {
  background: '#111007', border: '1px solid #78350f', borderRadius: 20,
  padding: '36px 40px', width: 400,
  boxShadow: '0 0 60px rgba(217,119,6,0.15)',
}
const backBtn: React.CSSProperties = {
  padding: '12px 18px', borderRadius: 10, border: '1px solid #1e293b',
  background: 'transparent', color: '#4b5563', fontSize: 13, fontWeight: 700,
  cursor: 'pointer',
}
