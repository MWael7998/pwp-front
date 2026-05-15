import { Link } from 'react-router-dom'

export default function Result() {
  return (
    <main>
      <h1>Result</h1>
      <p>Final results will be shown here.</p>
      <Link to="/tournments">Back to Tournments</Link>
    </main>
  )
}
