import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

export function ArtistAccessPage({ onArtistSelect }) {
  const { user } = useAuth();
  const [supabaseArtists, setSupabaseArtists] = useState([]);
  useEffect(() => { let active=true; supabase.from('artists').select('*').then(({data,error})=>{if(active && !error)setSupabaseArtists(data || []);}); return()=>{active=false;}; }, []);
  const [claims, setClaims] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [requestedName, setRequestedName] = useState(user.user_metadata?.artistName || '');
  const [artistId, setArtistId] = useState('');
  const [evidence, setEvidence] = useState('');
  const [notes, setNotes] = useState({});
  const [reviewer,setReviewer] = useState(false);
  useEffect(()=>{let active=true;supabase.rpc('experience_access').then(({data,error})=>{if(active)setReviewer(!error && data?.role==='admin');});return()=>{active=false;};},[user.id]);
  const verificationEnabled = import.meta.env.VITE_ARTIST_IDENTITY_ENABLED === 'true';
  const load = async () => {
    const own = await supabase.from('artist_claims').select('*,artists(name)').eq('user_id',user.id).order('created_at',{ascending:false});
    if (own.error) throw own.error;
    setClaims(own.data || []);
    if (reviewer) {
      const pending = await supabase.from('artist_claims').select('*,artists(name)').eq('ownership_status','pending').order('created_at');
      if (pending.error) throw pending.error;
      setReviews(pending.data || []);
    }
  };
  useEffect(() => { load().catch(() => setStatus('Could not load artist requests. Please refresh.')); }, [user.id,reviewer]);
  const run = async work => {
    setBusy(true); setStatus('');
    try { await work(); } catch(error) { setStatus(error.message || 'Request failed. Please try again.'); }
    finally { setBusy(false); }
  };
  const invoke = async (name, body) => {
    const {data,error} = await supabase.functions.invoke(name,{body});
    if (error) {
      let message = 'This service is unavailable. Please try again or contact support.';
      try { message = (await error.context.json()).error || message; } catch {}
      throw new Error(message);
    }
    if (data?.error) throw new Error(data.error);
    return data;
  };
  const verify = (claim, action) => run(async () => {
    const data = await invoke('artist-verification',{claimId:claim.claim_id,action});
    if (action === 'start' && data.url) {
      const url = new URL(data.url);
      if (url.protocol !== 'https:' || url.hostname !== 'verify.stripe.com') throw new Error('Unexpected verification link. Please contact support.');
      window.location.assign(url.href);
    } else {
      await load();
      setStatus(data.testMode ? 'Test verification only. Live ID verification is required to unlock editing.' : 'Verification status refreshed.');
    }
  });
  return <div className="artist-access-page">
    <h1>Artist access</h1>
    <p>Verify your identity, then let our team confirm your connection to the artist or band. ID images stay with the verification provider.</p>
    {!verificationEnabled && <p className="onboarding-note">ID verification is not active yet. You can submit an access request now; page editing stays locked until identity and ownership are approved.</p>}
    <button type="button" disabled={busy} onClick={() => run(load)}>Refresh requests</button>
    <p role="status">{status}</p>
    {claims.map(claim => <section className="artist-access-card" key={claim.claim_id}>
      <h2>{claim.artists?.name || claim.requested_name}</h2>
      <p>ID verification: {claim.identity_status.replaceAll('_',' ')} · Page ownership: {claim.ownership_status}</p>
      {claim.review_note && <p>Review note: {claim.review_note}</p>}
      {claim.identity_status !== 'verified' && <button disabled={busy || !verificationEnabled} onClick={() => verify(claim,'start')}>Verify my ID</button>}
      {verificationEnabled && <button disabled={busy} onClick={() => verify(claim,'refresh')}>Check verification status</button>}
      {claim.identity_status === 'verified' && claim.ownership_status === 'pending' && <p>Your ID is verified. Page ownership is awaiting review.</p>}
      {claim.identity_status === 'verified' && claim.ownership_status === 'approved' && <button onClick={() => onArtistSelect(claim.artists?.name || claim.requested_name)}>Open and customize my page</button>}
    </section>)}
    <section className="artist-access-card"><h2>Request access to an artist page</h2>
      <form onSubmit={event => {event.preventDefault();run(async () => {
        const {error} = await supabase.from('artist_claims').insert({user_id:user.id,artist_id:artistId ? Number(artistId) : null,requested_name:requestedName.trim(),evidence_url:evidence.trim()});
        if (error) throw new Error(error.code === '23505' ? 'You already have a request for this artist. Check its status above.' : 'Could not submit your request. Please try again.');
        await load(); setStatus('Request saved. Complete ID verification above.');
      });}}>
        <fieldset disabled={busy}>
          <label>Artist page<select value={artistId} onChange={event => {setArtistId(event.target.value);const artist=supabaseArtists.find(item=>String(item.artist_id)===event.target.value);if(artist)setRequestedName(artist.name);}}>
            <option value="">Request a new page</option>{supabaseArtists.map(artist=><option key={artist.artist_id} value={artist.artist_id}>{artist.name}</option>)}
          </select></label>
          <label>Artist / band name<input required maxLength={100} value={requestedName} onChange={event=>setRequestedName(event.target.value)} /></label>
          <label>Official website or profile for ownership review<input type="url" pattern="https://.*" required maxLength={1000} value={evidence} onChange={event=>setEvidence(event.target.value)} /></label>
          <button type="submit">Request access</button>
        </fieldset>
      </form>
    </section>
    {reviewer && <section className="artist-access-card"><h2>Page-ownership reviews</h2>
      <p>Confirm the applicant controls the official artist presence before approving. ID verification alone does not establish ownership of a band or artist page.</p>
      {!reviews.length && <p>No pending requests.</p>}
      {reviews.map(claim=><article key={claim.claim_id}>
        <h3>{claim.artists?.name || claim.requested_name}</h3>
        <p>ID: {claim.identity_status} · Applicant: {claim.user_id}</p>
        <a href={claim.evidence_url} target="_blank" rel="noreferrer">View ownership evidence</a>
        <label>Review note<textarea maxLength={2000} value={notes[claim.claim_id] || ''} onChange={event=>setNotes(previous=>({...previous,[claim.claim_id]:event.target.value}))} /></label>
        {[true,false].map(approve=><button key={String(approve)} disabled={busy || claim.user_id===user.id || (approve && claim.identity_status !== 'verified')} onClick={()=>run(async()=>{
          const {error}=await supabase.rpc('review_artist_claim',{claim:claim.claim_id,approved:approve,note:notes[claim.claim_id] || ''}); if(error)throw error; await load(); setStatus('Review saved.');
        })}>{approve ? 'Approve & publish artist' : 'Reject request'}</button>)}
      </article>)}
    </section>}
  </div>;
}
