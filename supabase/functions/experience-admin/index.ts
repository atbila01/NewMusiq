import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info' };
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const check = (result: any) => { if (result.error) throw new Error(result.error.message); return result.data; };
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const auth = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
    const { data, error } = await auth.auth.getUser(token);
    if (error || !data.user) return json({ error: 'Please sign in again.' }, 401);
    const user = data.user;
    const body = await req.json();
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
    if (body.action === 'delete-account') {
      if (body.confirmation !== 'DELETE MY ACCOUNT') return json({ error: 'Account deletion must be confirmed.' }, 400);
      const account = check(await admin.from('billing_accounts').select('customer_id,subscription_id,status').eq('user_id', user.id).maybeSingle());
      if (account?.subscription_id && !['canceled', 'incomplete_expired'].includes(account.status)) {
        const key = Deno.env.get('STRIPE_SECRET_KEY');
        if (!key) return json({ error: 'Billing must be connected before your paid account can be deleted.' }, 503);
        // Cancel the subscription already linked by the existing NewMusiq billing service.
        const result = await fetch(`https://api.stripe.com/v1/subscriptions/${encodeURIComponent(account.subscription_id)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${key}`, 'Idempotency-Key': `delete-account-${user.id}` } });
        if (!result.ok) return json({ error: 'Your subscription could not be closed. Your account has not been deleted.' }, 502);
      }
      // Revoke refresh tokens, remove private uploads, then delete the Auth identity.
      check(await admin.auth.admin.signOut(token, 'global'));
      const folders = ['audio', 'cover', 'avatar'];
      for (const folder of folders) {
        const prefix = `${user.id}/${folder}`;
        while (true) {
          const files = check(await admin.storage.from('experience-media').list(prefix, { limit: 100 }));
          if (!files?.length) break;
          check(await admin.storage.from('experience-media').remove(files.map((f: any) => `${prefix}/${f.name}`)));
        }
      }
      check(await admin.auth.admin.deleteUser(user.id));
      return json({ ok: true });
    }
    if (check(await auth.rpc('experience_access'))?.role !== 'admin') return json({ error: 'Administrator access required.' }, 403);
    if (body.action === 'list-users') {
      const users = check(await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })).users;
      return json({ roles: ['admin', 'member'], users: users.map((u: any) => ({ user_id: u.id, username: u.user_metadata?.name || '', email: u.email || '', role: u.app_metadata?.role === 'admin' ? 'admin' : 'member' })) });
    }
    if (body.action === 'set-role') return json({ error: 'Administrator access is restricted to the two approved accounts.' }, 403);
    return json({ error: 'Unknown action.' }, 400);
  } catch (err) { return json({ error: err instanceof Error ? err.message : 'The account service is unavailable.' }, 400); }
});
