import { Routes, Route, useLocation } from 'react-router-dom'
import Entry from './pages/Entry'
import Tournments from './pages/Tournments'
import TournmentDetail from './pages/TournmentDetail'
import Register from './pages/Register'
import Result from './pages/Result'
import Game from './pages/Game'
import TopBar from './components/TopBar'
import { ThemeProvider } from './context/ThemeContext'

const NO_BAR = ['/', '/entry']

function Inner() {
	const location = useLocation()
	const hasBar = !NO_BAR.includes(location.pathname)

	return (
		<div className="App w-full min-h-screen" style={{ paddingTop: hasBar ? 52 : 0 }}>
			<TopBar />
			<Routes>
				<Route path="/entry" element={<Entry />} />
				<Route path="/tournments" element={<Tournments />} />
				<Route path="/tournment/:id" element={<TournmentDetail />} />
				<Route path="/register/:id" element={<Register />} />
				<Route path="/result" element={<Result />} />
				<Route path="/game" element={<Game />} />
				<Route path="/" element={<Entry />} />
			</Routes>
		</div>
	)
}

function App() {
	return (
		<ThemeProvider>
			<Inner />
		</ThemeProvider>
	)
}

export default App
