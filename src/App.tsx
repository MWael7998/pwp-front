import { Routes, Route } from 'react-router-dom'
import Entry from './pages/Entry'
import Tournments from './pages/Tournments'
import TournmentDetail from './pages/TournmentDetail'
import Register from './pages/Register'
import Result from './pages/Result'

function App() {
	return (
		<div className="App w-full h-screen flex items-center justify-center">

			<Routes>
				<Route path="/entry" element={<Entry />} />
				<Route path="/tournments" element={<Tournments />} />
				<Route path="/tournment/:id" element={<TournmentDetail />} />
				<Route path="/register/:id" element={<Register />} />
				<Route path="/result" element={<Result />} />
				<Route path="/" element={<Entry />} />
			</Routes>
		</div>
	)
}

export default App
