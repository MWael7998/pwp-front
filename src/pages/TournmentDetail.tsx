import { useParams } from 'react-router-dom'

export default function TournmentDetail() {
  const params = useParams()
  const id = params.id

  return (
    <main>
      <h1>Tournment {id}</h1>
      <p>Details for tournment {id} would go here.</p>
    </main>
  )
}
