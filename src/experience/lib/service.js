import { supabase } from '../../lib/supabase';
import { BILLING_PLANS } from '../../../supabase/functions/_shared/billing-plans.js';
import { membershipForAccount } from './account-model';

const TABLE = 'experience_records';
const BUCKET = 'experience-media';
const response = data => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
const fail = (message, status = 400) => { const e = new Error(message); e.status = status; throw e; };
const checked = ({ data, error }) => { if (error) fail(error.message, error.status || 400); return data; };
const unpack = r => ({ ...r.payload, id: r.id, user_id: r.user_id, status: r.status, created_at: r.created_at });
const json = options => typeof options.body === 'string' ? JSON.parse(options.body) : {};
const defaults = { autoplay: true, crossfade: 0, normalize: true, audio_quality: 'normal', explicit: true, notify_releases: true, notify_comments: true, notify_email: false, private_session: false, show_activity: false, language: 'English' };
async function identity() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) fail('Please sign in again.', 401);
  return data.user;
}
async function records(kind, uid) {
  let q = supabase.from(TABLE).select('*').eq('kind', kind).order('created_at', { ascending: false }).limit(500);
  if (uid) q = q.eq('user_id', uid);
  return (checked(await q) || []).map(unpack);
}
async function put(kind, user, payload, id = crypto.randomUUID()) {
  const old = checked(await supabase.from(TABLE).select('id').eq('id', id).eq('user_id', user.id).maybeSingle());
  const q = old ? supabase.from(TABLE).update({ payload }).eq('id', id).eq('user_id', user.id) : supabase.from(TABLE).insert({ id, kind, user_id: user.id, payload });
  return unpack(checked(await q.select().single()));
}
async function getRecord(kind, id) {
  const r = checked(await supabase.from(TABLE).select('*').eq('kind', kind).eq('id', id).single());
  return unpack(r);
}
async function patchRecord(kind, id, user, changes) {
  const old = await getRecord(kind, id);
  if (old.user_id !== user.id) fail('Not allowed.', 403);
  const { user_id, created_at, status, ...payload } = old;
  return put(kind, user, { ...payload, ...changes }, id);
}
async function remove(kind, id, user) { checked(await supabase.from(TABLE).delete().eq('id', id).eq('kind', kind).eq('user_id', user.id)); return { ok: true }; }
async function media(path) { return checked(await supabase.storage.from(BUCKET).download(path)); }
async function upload(user, kind, file) {
  if (!file?.size) return '';
  const image = kind !== 'audio';
  if (file.size > (image ? 5 : 25) * 1024 * 1024) fail(image ? 'Images must be under 5 MB.' : 'Audio must be under 25 MB.');
  if (image ? !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) : !file.type.startsWith('audio/')) fail('Unsupported file type.');
  const path = `${user.id}/${kind}/${crypto.randomUUID()}`;
  checked(await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type }));
  return path;
}
async function access() { return checked(await supabase.rpc('experience_access')); }
async function profile(user) {
  const entitlement = await access();
  const account = checked(await supabase.from('billing_accounts').select('plan,status,trial_end,period_end').eq('user_id', user.id).maybeSingle());
  const m = user.user_metadata || {};
  const p = m.newmusiq_profile || {};
  return { user_id: user.id, email: user.email, username: p.username || m.name || user.email?.split('@')[0] || 'Listener',
    country: p.country || '', state: p.state || '', zip_code: p.zip_code || '', completed: p.completed ?? true,
    has_photo: Boolean(p.photo_path), photo_path: p.photo_path || '', show_tour: p.show_tour ?? false,
    ...membershipForAccount(account, Date.now(), entitlement) };
}
export async function experienceApi(path, options = {}) {
  const user = await identity();
  const method = options.method || 'GET';
  const url = new URL(path, window.location.origin);
  const p = url.pathname;
  const parts = p.split('/').filter(Boolean).map(decodeURIComponent);
  const body = json(options);
  const meta = user.user_metadata || {};
  if (p === '/me/role') return response(await access());
  if (p === '/me' && method === 'GET') return response(await profile(user));
  if (p === '/me' && method === 'PUT') {
    const f = options.body;
    const username = String(f.get('username') || '').trim();
    if (!/^[\p{L}\p{N} ._-]{1,80}$/u.test(username)) fail('Use a display name of 1–80 letters or numbers.');
    const next = { ...(meta.newmusiq_profile || {}), username, completed: true };
    for (const key of ['country', 'state', 'zip_code']) next[key] = String(f.get(key) || '').trim().slice(0, 80);
    if (f.get('photo')?.size) next.photo_path = await upload(user, 'avatar', f.get('photo'));
    checked(await supabase.auth.updateUser({ data: { name: username, newmusiq_profile: next } }));
    return response(await profile({ ...user, user_metadata: { ...meta, newmusiq_profile: next } }));
  }
  if (p === '/me/photo') return new Response(await media((await profile(user)).photo_path));
  if (p === '/me/tour-done') {
    checked(await supabase.auth.updateUser({ data: { newmusiq_profile: { ...meta.newmusiq_profile, show_tour: false } } }));
    return response({ ok: true });
  }
  if (p === '/me' && method === 'DELETE') {
    const result = checked(await supabase.functions.invoke('experience-admin', {body:{action:'delete-account',confirmation:'DELETE MY ACCOUNT'}}));
    if(result.error) fail(result.error); return response(result);
  }
  if (p === '/me/settings') {
    if (method === 'PUT') {
      const values = Object.fromEntries(Object.entries(body).filter(([k]) => Object.hasOwn(defaults, k)));
      checked(await supabase.auth.updateUser({ data: { newmusiq_settings: { ...meta.newmusiq_settings, ...values } } }));
      return response({ ...defaults, ...meta.newmusiq_settings, ...values });
    }
    return response({ ...defaults, ...meta.newmusiq_settings });
  }
  if (p === '/payments/checkout') {
    if ((await access()).complimentary) fail('Your account already has complimentary access. No subscription is needed.');
    if (!Object.hasOwn(BILLING_PLANS, body.plan)) fail('Choose a NewMusiq plan.');
    const data = checked(await supabase.functions.invoke('billing', { body: { action: 'checkout', plan: body.plan } }));
    if (data.error) fail(data.error);
    const target = new URL(data.url);
    if (target.protocol !== 'https:' || target.hostname !== 'checkout.stripe.com') fail('Unexpected checkout URL.');
    return response({ checkout_url: target.href });
  }
  if (parts[0] === 'payments' && parts[1] === 'status') {
    checked(await supabase.functions.invoke('billing', { body: { action: 'refresh' } }));
    const p = await profile(user);
    return response({ payment_status: p.plan_level ? 'paid' : 'pending' });
  }
  if (p === '/me/likes') {
    if (method === 'GET') return response(await records('like', user.id));
    if (!['song', 'track', 'video'].includes(body.kind) || !body.ref_id) fail('Choose a song to save.');
    const key = `${body.kind}:${body.ref_id}`;
    const existing = (await records('like', user.id)).find(l => l.key === key);
    return response(existing || await put('like', user, { ...body, key }));
  }
  if (parts[0] === 'me' && parts[1] === 'likes' && method === 'DELETE') {
    const found = (await records('like', user.id)).find(l => l.key === parts[2]);
    return response(found ? await remove('like', found.id, user) : { ok: true });
  }
  if (p === '/me/playlists') {
    if (method === 'GET') {
      const saved = await records('playlist', user.id);
      const legacy = checked(await supabase.from('playlists').select('playlist_id,name,playlist_songs(song_id,songs(song_id,name))').eq('user_id', user.id));
      return response([...saved, ...(legacy || []).map(v => ({ id: `legacy-${v.playlist_id}`, name: v.name, items: (v.playlist_songs || []).map(s => ({ kind: 'track', ref_id: `legacy-${s.song_id}`, title: s.songs?.name || 'Song', artist: '', key: `song:${s.song_id}` })), legacy: true }))]);
    }
    const name = String(options.body.get('name') || '').trim();
    if (!name || name.length > 60) fail('Playlist name must be 1–60 characters.');
    const cover_path = await upload(user, 'cover', options.body.get('cover'));
    return response(await put('playlist', user, { name, cover_path, has_cover: Boolean(cover_path), items: [] }));
  }
  if (parts[0] === 'me' && parts[1] === 'playlists' && parts[2]) {
    const id = parts[2];
    if (id.startsWith('legacy-')) fail('This is an existing NewMusiq playlist. Its songs are preserved; create a new playlist to add videos.');
    if (method === 'DELETE' && parts.length === 3) return response(await remove('playlist', id, user));
    const playlist = await getRecord('playlist', id);
    if (parts[3] === 'cover') return new Response(await media(playlist.cover_path));
    if (parts[3] === 'items') {
      const items = playlist.items || [];
      const key = `${body.kind}:${body.ref_id}`;
      const next = method === 'DELETE' ? items.filter(i => i.key !== parts[4]) : [...items.filter(i => i.key !== key), { ...body, key }];
      return response(await patchRecord('playlist', id, user, { items: next }));
    }
  }
  if (p === '/me/visits') {
    if (method === 'GET') return response(await records('visit', user.id));
    const old = (await records('visit', user.id)).find(v => v.country === body.country && v.state === body.state);
    return response(await put('visit', user, { country: String(body.country || '').slice(0, 100), state: String(body.state || '').slice(0, 100), count: (old?.count || 0) + 1 }, old?.id));
  }
  if (p === '/feedback') {
    if (String(body.message || '').trim().length < 3 || body.message.length > 2000) fail('Write a message between 3 and 2,000 characters.');
    return response(await put('feedback', user, { topic: String(body.topic || 'General feedback').slice(0, 60), message: body.message.trim(), username: meta.name || '', email: user.email }));
  }
  if (p === '/comments' || p === '/me/comments') {
    if (method === 'GET') return response((await records('comment', p === '/me/comments' ? user.id : undefined)).map(c => ({ ...c, pending: c.status === 'pending' })));
    if (!(await profile(user)).plan_level) fail('An active NewMusiq membership is required to comment.', 403);
    if (!body.message?.trim() || body.message.length > 600) fail('Comments must be 1–600 characters.');
    const c = await put('comment', user, { message: body.message.trim(), display_name: meta.name || 'Listener' });
    return response({ ...c, pending: true });
  }
  if (p === '/tracks/mine') return response(await records('track', user.id));
  if (p === '/tracks' && method === 'GET') return response(await records('track'));
  if (p === '/tracks' && method === 'POST') {
    if ((await profile(user)).plan_level < 3) fail('An active Artist subscription and verified artist ownership are required.', 403);
    const f = options.body;
    const title = String(f.get('title') || '').trim();
    if (!title || title.length > 100) fail('Add a song title of up to 100 characters.');
    const audio_path = await upload(user, 'audio', f.get('audio'));
    if (!audio_path) fail('Choose an audio file.');
    const cover_path = await upload(user, 'cover', f.get('cover'));
    return response(await put('track', user, { title, artist_name: meta.artistName || meta.name || 'Artist', audio_path, cover_path, has_cover: Boolean(cover_path), featured: String(f.get('featured') || '').slice(0, 200), release_type: f.get('release_type') === 'album' ? 'album' : 'single', album_title: String(f.get('album_title') || '').slice(0, 120), location: String(f.get('location') || '').slice(0, 120), lyrics: String(f.get('lyrics') || '').slice(0, 20000) }));
  }
  if (parts[0] === 'tracks' && parts[1]) {
    if (parts[1].startsWith('legacy-')) {
      const songId = Number(parts[1].slice(7));
      if (!Number.isSafeInteger(songId) || songId < 1) fail('Song not found.',404);
      const song = checked(await supabase.from('songs').select('song_id,name,lyrics').eq('song_id',songId).single());
      if (parts[2] === 'lyrics') return response({lines:[],text:song.lyrics || '',synced:false});
      if (parts[2] === 'play') { checked(await supabase.from('song_streams').insert({user_id:user.id,track_key:`song:${songId}`,song_id:songId})); return response({ok:true}); }
      if (parts[2] === 'audio') {
        if (!(await profile(user)).plan_level) fail('A NewMusiq membership is required to listen.',403);
        return new Response(checked(await supabase.storage.from('songs').download(`${songId}.mp3`)));
      }
      fail('This song does not have a preview.',403);
    }
    const track = await getRecord('track', parts[1]);
    if (parts[2] === 'cover') return new Response(await media(track.cover_path));
    if (parts[2] === 'lyrics') return response({ lines: [], text: track.lyrics || '', synced: false });
    if (parts[2] === 'play') return response(await put('play', user, { track_id: track.id, owner_id: track.user_id }));
    if (parts[2] === 'audio') return new Response(await media(track.audio_path));
    if (parts[2] === 'preview') fail('This release does not have a preview yet. A membership is required to play it.', 403);
    if (method === 'DELETE') return response(await remove('track', track.id, user));
  }
  if (p === '/studio/analytics') {
    return response(checked(await supabase.rpc('experience_studio_stats')));
  }

  if (parts[0] === 'admin' || parts[0] === 'users') {
    if ((await access()).role !== 'admin') fail('Administrator access required.', 403);
    if (p === '/admin/subscriptions') return response(checked(await supabase.rpc('experience_subscription_summary')));
    if (parts[0] === 'users' && method === 'PATCH') fail('Administrator access is restricted to the two approved accounts.',403);
    if (parts[0] === 'users') { const action = method === 'PATCH' ? 'set-role' : 'list-users'; const result = checked(await supabase.functions.invoke('experience-admin',{body:{action,user_id:parts[1],role:body.role}})); if(result.error) fail(result.error); return response(result); }
    const kind = { comments: 'comment', feedback: 'feedback', tracks: 'track' }[parts[1]];
    if (kind && method === 'GET') return response((await records(kind)).filter(r => !url.searchParams.get('status') || r.status===url.searchParams.get('status')).map(r => ({...r,is_deleted:r.status==='hidden'})));
    if (kind && method === 'PATCH') {
      const status = body.status || (body.hidden ? 'hidden' : 'approved');
      checked(await supabase.from(TABLE).update({ status }).eq('kind', kind).eq('id', parts[2]));
      return response({ ok: true });
    }
    fail('This administration action requires the NewMusiq server integration.', 503);
  }
  if (p === '/search' && method === 'GET') {
    const q = String(url.searchParams.get('q') || '').trim();
    if(q.length<2)return response({songs:[],releases:[]});
    const local = checked(await supabase.from('songs').select('song_id,name,song_artists(artists(name))').ilike('name',`%${q.replace(/[%_]/g,'')}%`).limit(30));
    const uploaded=(await records('track')).filter(t=>`${t.title} ${t.artist_name}`.toLowerCase().includes(q.toLowerCase()));
    const releases=[...uploaded,...(local || []).map(t=>({id:`legacy-${t.song_id}`,title:t.name,artist_name:(t.song_artists || []).map(a=>a.artists?.name).filter(Boolean).join(', ')}))];
    const {data:{session}}=await supabase.auth.getSession();
    try {
      const remote=await fetch(`/api/discovery?path=${encodeURIComponent(path)}`,{headers:{Authorization:`Bearer ${session?.access_token || ''}`}});
      const data=await remote.json();
      return response({songs:remote.ok ? data.songs || [] : [],releases,message:remote.ok ? data.message : data.detail});
    } catch { return response({songs:[],releases,message:'External search is unavailable. Showing your NewMusiq library.'}); }
  }
  // Public discovery is served by our own API; account tokens never go to Emergent.
  if (p.startsWith('/music/') || p.startsWith('/search') || p.startsWith('/geo/')) {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`/api/discovery?path=${encodeURIComponent(path)}`, { ...options, headers: { ...options.headers, Authorization: `Bearer ${session?.access_token || ''}` } });
    if (!res.ok) { const data = await res.json().catch(() => ({})); fail(data.detail || 'Discovery is unavailable right now.', res.status); }
    return res;
  }
  fail('This feature is not connected yet. Please try again after setup is complete.', 503);
}
