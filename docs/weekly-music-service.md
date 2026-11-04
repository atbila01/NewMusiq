# Temporary weekly regional music service

## Requested on 2026-11-02

Connect Emergent's weekly regional recommendations until the replacement AI agent
is ready. This is an interim service; do not disable it merely because an agent
has been created. Switch only after its replacement is connected and verified.

## Activation in progress (2026-11-03)

Sixteen automated tests and the production build passed locally. Live provider
generation and authenticated end-to-end verification remain pending.
On 2026-11-03 the user chose OpenAI and saved a
Production secret in Vercel as `OpenAI_API_Key`. The adapter accepts that exact
name as well as `OPENAI_API_KEY`; the value was never revealed or copied.

The current adapter uses NewMusiq's existing authenticated Vercel discovery API
and Supabase. It does not forward NewMusiq account tokens to Emergent or adopt
its Clerk/MongoDB accounts. It requires an OpenAI connection because Emergent's
Python SDK key and separate authenticated endpoint are not configured here.

- Research up to 25 candidate songs with web search and retain up to 15.
- Keep source links returned by the research tool; discard candidates with
  missing/unretrieved links. These links are research references, not a guarantee
  that every AI claim has been independently checked.
- Label output as unreviewed AI recommendations, not measured popularity charts.
  Store no canonical artist, ownership, billing or song records.
- Keep at most one already-used song in each new regional list. This matches
  Emergent's MAX_SHARED=1; it does not make every song globally unique.
- Preserve international artist/title characters during duplicate checks.
- Derive up to five genre playlists from retained recommendations. These are not
  independent genre popularity rankings or eight-song genre lists.
- Persist the current UTC ISO-week selection per country or US state in a private
  cache. Refresh on the first authorized visit in a new week, not an unattended
  global rebuild. Keep previous dates/week visible when serving an older list.
- One database lease serializes research across instances and regions. Permit
  at most 20 generation attempts per UTC day, three per region/week, with a
  two-minute retry cooldown. Each attempt permits up to three search-tool calls
  and 6,500 output tokens. These are usage limits, not a guaranteed dollar cap.
- Keep heritage available if the provider, cache, budget or research fails.

## Connection fields

In Vercel project `new-music/newmusiq`, set server-only Production variables:

| Name | Value / purpose |
| --- | --- |
| `SUPABASE_URL` | Existing project URL `https://dcoivxvmgoggevpqurcc.supabase.co` |
| `SUPABASE_ANON_KEY` | Existing project's public client key, for checking user sessions |
| `SUPABASE_SERVICE_ROLE_KEY` | Existing project's server-only key, for the narrow cache RPCs |
| `OPENAI_API_KEY` | A funded API key; enter directly in Vercel, never chat or Git |
| `WEEKLY_MUSIC_ENABLED` | `true` once the database and provider checks pass |
| `OPENAI_WEEKLY_MODEL` | Optional; defaults to `gpt-4.1-mini` |

Never prefix server secrets with `VITE_`. The service-role and OpenAI keys must
never appear in the browser bundle. Production configuration changes require
a new deployment to take effect.

Live inspection on 2026-11-02 found no project environment variables. The existing
discovery endpoint returned HTTP 503, `NewMusiq discovery setup is incomplete.`
The local `.env` contains public Supabase client configuration only, no AI key.

On 2026-11-03, imported the existing public `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY` settings into Vercel Production and Preview. The API
already supports these names for verifying existing account sessions. The
private cache migration was applied on 2026-11-03 after a successful transactional
dry run. Grant checks, singleton worker leasing, invalid-lease rejection, retry
cooldown and the daily ceiling passed, with every test fixture rolled back.
The schema migration was registered as 20261102200000. Both private tables have
RLS; anonymous/member roles cannot execute cache generation or completion.

The user explicitly approved transferring the existing Supabase server secret
directly into Vercel Production `SUPABASE_SERVICE_ROLE_KEY`. It was saved without
displaying it in chat or writing it to Git. `WEEKLY_MUSIC_ENABLED=true` is also
saved for Production, effective on the next deployment. Advisor review found zero
errors and seven warnings affecting older catalog policies/password protection;
none names the new cache or RPCs. Production release verification is still pending.

## Release checklist

1. Apply `supabase/migrations/20261102200000_weekly_music.sql` to the existing
   Supabase project, then run `tests/sql/weekly-music.sql`; all fixtures roll back.
   Check Supabase security advisors. Connected MCP calls were unavailable in this
   chat, so no production database application has been claimed.
2. Add the server configuration securely. Verify funded OpenAI model/search access.
3. Run `npm test`, `npm run build`, review the task diff, and publish passing source
   to `Makayla` under the existing live-update authorization.
4. Verify the exact production SHA is Ready. From a signed-in account, confirm
   Texas and another region return researched songs, source links, UTC week,
   generated time, the unreviewed label, and a cache hit on repeat visits.
5. Confirm unauthenticated discovery is rejected before any provider request,
   private cache RPCs reject ordinary users, stale/failure fallback is labeled,
   and the browser bundle contains no server secrets.

## Replacement

Set `WEEKLY_MUSIC_ENABLED=false` and redeploy to return to heritage selections.
Keep the cache for review and connect the new agent through the same response
shape. Replace only after its live acceptance checks pass. No automatic expiration
or deletion is configured.

## Documentation references

- [OpenAI web search](https://developers.openai.com/api/docs/guides/tools-web-search)
- [OpenAI structured output](https://developers.openai.com/api/docs/guides/structured-outputs)
- [Supabase server secrets](https://supabase.com/docs/guides/functions/secrets)
