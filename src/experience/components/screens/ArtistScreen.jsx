import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Screen from './Screen'
import { useApi } from '../../lib/profile'

export default function ArtistScreen() {
  const { artistId } = useParams()
  const api = useApi()
  const [artist, setArtist] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let active=true
    setArtist(null); setError('')
    api(`/artists/${artistId}`).then(r=>r.json()).then(data=>{if(active)setArtist(data)}).catch(e=>{if(active)setError(e.message || 'Artist could not be loaded.')})
    return ()=>{active=false}
  }, [artistId,api])
  const image=artist?.design?.portrait_url
  return <Screen kicker="On NewMusiq" title={artist?.name || 'Artist'} testId="artist-screen">
    {error && <p role="alert">{error}</p>}
    {!artist && !error && <p role="status">Loading artist…</p>}
    {artist && <section className="screen-section">
      {/^https:\/\//i.test(image || '') && <img src={image} alt={artist.name} style={{width:160,maxWidth:'100%',borderRadius:16}} />}
      {artist.design?.tagline && <h2>{artist.design.tagline}</h2>}
      {artist.design?.hometown && <p>Place of origin: {artist.design.hometown}</p>}
      <p>{artist.design?.bio || 'This artist is published on NewMusiq. More profile details are coming soon.'}</p>
      <Link className="ghost-btn" to={`/search?artist=${encodeURIComponent(artist.name)}`}>Find music by {artist.name}</Link>
    </section>}
  </Screen>
}
