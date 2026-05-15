import React from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import HeadBallGame from './games/HeadBallGame'
import DutchAuctionGame from './games/DutchAuctionGame'
import AirHockeyGame from './games/AirHockeyGame'

export type GameProps = {
  player: string
  opponent: string
  room: string
  side: string
}

const GAME_MAP: Record<string, React.ComponentType<GameProps>> = {
  'Head Ball': HeadBallGame,
  'Dutch Auction': DutchAuctionGame,
  'AirHockey': AirHockeyGame,
}

export default function Game() {
  const [params] = useSearchParams()
  const navigate = useNavigate()

  const room = params.get('room') || ''
  const player = params.get('player') || ''
  const opponent = params.get('opponent') || ''
  const gameHosted = params.get('gameHosted') || ''

  const GameComponent = GAME_MAP[gameHosted]

  if (!GameComponent) {
    return (
      <div style={page}>
        <div style={{ textAlign: 'center', color: '#64748b' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9', marginBottom: 8 }}>Unknown game</div>
          <div style={{ fontSize: 13, marginBottom: 24 }}>"{gameHosted}" has no registered game component.</div>
          <button onClick={() => navigate(-1)} style={backBtn}>Back to Bracket</button>
        </div>
      </div>
    )
  }

  const side = params.get('side') || 'left'
  return <GameComponent player={player} opponent={opponent} room={room} side={side} />
}

const page: React.CSSProperties = {
  minHeight: '100vh', background: '#080c18',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
}

const backBtn: React.CSSProperties = {
  padding: '10px 24px', borderRadius: 8, border: '1px solid #1e293b',
  background: '#0f172a', color: '#64748b', fontSize: 12, fontWeight: 700,
  cursor: 'pointer', letterSpacing: 1, textTransform: 'uppercase',
}
