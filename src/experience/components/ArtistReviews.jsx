import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApi, useProfile } from '../lib/profile'

export default function ArtistReviews() {
  const api = useApi()
  const { profile } = useProfile()
  const [items, setItems] = useState(null)
  const [notes, setNotes] = useState({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [confirm, setConfirm] = useState(null)
  const load = useCallback(async () => {
    try { setItems(await (await api('/admin/artists')).json()); setError('') }
    catch (e) { setError(e.message || 'Artist requests could not be loaded.') }
  }, [api])
  useEffect(() => { load() }, [load])
  async function review() {
    const decision = confirm
    setBusy(true); setError(''); setMessage('')
    try {
      await api(`/admin/artists/${decision.id}`, { method: 'PATCH', body: JSON.stringify({ approve: decision.approve, note: notes[decision.id] || '' }) })
      setConfirm(null)
      await load()
      setMessage(decision.approve ? 'Artist approved and published in the NewMusiq catalog.' : 'Artist request rejected. Your review note is available to the applicant.')
    } catch (e) { setError(e.message || 'Review could not be saved.') }
    finally { setBusy(false) }
  }
  return <section className="admin-card" data-testid="admin-artists">
    <h2>Artist verification & publishing</h2>
    <p className="rp-muted">Review official ownership evidence after identity verification. Approval publishes a new artist in the catalog, or grants access to an existing artist page. It does not publish music automatically. Another administrator must review your own request.</p>
    <button type="button" className="ghost-btn" disabled={busy} onClick={load}>Refresh requests</button>
    {error && <p role="alert">{error}</p>}
    {message && <p role="status">{message}</p>}
    {!items ? !error && <p role="status">Loading artist requests…</p> : items.length === 0 ? <p className="rp-muted">No artist requests yet.</p> : items.map(c => {
      const pending = c.ownership_status === 'pending'
      const self = c.user_id === profile?.user_id
      const evidence = /^https:\/\//i.test(c.evidence_url || '') ? c.evidence_url : null
      return <article className="admin-row" key={c.claim_id} data-testid="admin-artist-request">
        <div>
          <h3>{c.artist_name}</h3>
          {c.artist_id && c.ownership_status === 'approved' && <Link to={`/artists/${c.artist_id}`}>View published artist</Link>}
          <p>Identity: {c.identity_status.replaceAll('_', ' ')} · Ownership: {c.ownership_status}</p>
          <p className="rp-muted">Applicant: {c.user_id}</p>
          {evidence && <a href={evidence} target="_blank" rel="noopener noreferrer">View official ownership evidence</a>}
          {pending ? <>
            <label>Review note<textarea maxLength={2000} disabled={busy} value={notes[c.claim_id] || ''} onChange={e => setNotes(v => ({ ...v, [c.claim_id]: e.target.value }))} /></label>
            {self && <p className="rp-muted">The other administrator must review this request.</p>}
            {c.identity_status !== 'verified' && <p className="rp-muted">Waiting for verified identity before approval.</p>}
            {confirm?.id === c.claim_id ? <div role="group" aria-label="Confirm artist review">
              <p>{confirm.approve ? `Confirm ownership evidence for ${c.artist_name} and publish the artist?` : `Reject ${c.artist_name}'s request?`}</p>
              <button type="button" disabled={busy} onClick={review}>{busy ? 'Saving…' : confirm.approve ? 'Confirm approval & publish' : 'Confirm rejection'}</button>
              <button type="button" className="ghost-btn" disabled={busy} onClick={() => setConfirm(null)}>Cancel</button>
            </div> : <div>
              <button type="button" disabled={busy || self || c.identity_status !== 'verified'} onClick={() => setConfirm({ id: c.claim_id, approve: true })}>Approve & publish artist</button>
              <button type="button" className="ghost-btn" disabled={busy || self} onClick={() => setConfirm({ id: c.claim_id, approve: false })}>Reject request</button>
            </div>}
          </> : <p>{c.ownership_status === 'approved' ? 'Published artist · access approved' : 'Request rejected'}{c.review_note ? ` · ${c.review_note}` : ''}{c.reviewed_at ? ` · ${new Date(c.reviewed_at).toLocaleDateString()}` : ''}</p>}
        </div>
      </article>
    })}
  </section>
}
