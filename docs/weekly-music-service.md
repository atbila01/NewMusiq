# Temporary weekly regional music service

## Requested on 2026-11-02

Connect Emergent's weekly regional recommendations until the replacement AI agent
is ready. This is an interim service; do not disable it merely because an agent
has been created. Switch only after its replacement is connected and verified.

## Activation history (2026-11-03)

At this stage, sixteen automated tests and the production build passed locally. Live provider
generation and authenticated end-to-end verification remain pending.
On 2026-11-03 the user chose OpenAI and saved a
Production secret in Vercel as `OpenAI_API_Key`. The adapter accepts that exact
name as well as `OPENAI_API_KEY`; the value was never revealed or copied.

The current adapter uses NewMusiq's existing authenticated Vercel discovery API
and Supabase. It does not forward NewMusiq account tokens to Emergent or adopt
its Clerk/MongoDB accounts. It requires an OpenAI connection because Emergent's
Python SDK key and separate authenticated endpoint are not configured here.

- Research 10-15 candidate songs with web search and retain up to 15.
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
| `OPENAI_WEEKLY_MODEL` | Optional; defaults to `gpt-5-mini` |

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

## Live activation result (2026-11-03)

Production ccb0cfe91d32aaebfa80cda5873241df49ba1265 is Ready as Vercel
5aSRiNi7spjgqs6X6DsSYqRAsDCc. Supabase cache and Production settings are installed.
The signed-in account selected Texas and California through place confirmation.
Both live requests reached the private cache and fell back to heritage. The
California runtime diagnostic confirms `provider_http_401`, `invalid_api_key`.
The saved OpenAI_API_Key secret is rejected by OpenAI. No AI recommendations were
successfully generated, and cache-hit verification remains unfulfilled.

Replace that secret securely in Vercel using a valid OpenAI API key, then redeploy
and rerun the regional and repeated-visit checks. The secret is write-only and
was never revealed in chat. Sixteen tests and the build passed for the deployed
source. Safe diagnostics log only controlled error codes, never provider error
messages, prompts or keys. Heritage remains available while the key is corrected.

### Follow-up configuration correction (2026-11-03)

After the user reported an update, Vercel showed a new Ready deployment
5uVLbn4bFM8AkHUFhEdsbMr1esLB at ccb0cfe. The recent environment edit was on
WEEKLY_MUSIC_ENABLED; OpenAI_API_Key still showed its original creation time.
The signed-in Texas request returned heritage without an AI-failure notice,
consistent with the activation flag no longer equaling true. Restored the flag
to true and opened the exact OpenAI_API_Key editor for the user to replace the
write-only key. No secret was read or copied. Awaiting that replacement and a
redeployment before attempting another provider call.

### Citation compatibility correction (2026-11-04)

The replacement key now reaches completed provider research on Ready deployment
Cz86hVhUuuVrVQRj2tgTtpLTG8da at ccb0cfe. Texas was rejected by the source
matching check, so no successful generation is claimed. Source validation now
accepts returned URL citations and opened research pages, and ignores UTM tags
and fragments when matching the same page. Other query parameters stay exact.
Seventeen tests and the production build passed. Live verification is pending.


### Regional quality verification (2026-11-04)

44bf8fc reached Ready Production as 6YxNxpoVRoMAENeK33tDzYrsCXkX.
Washington generated and saved ten sourced picks, but the regional claims were
too broad. The adapter now requires each local connection to name the requested
region and prompts for documented birthplace, band formation or residence.
Previously cached selections that fail this check are withheld in favor of
heritage; no database records are deleted. Source links still require returned
research evidence. This is a minimum relevance check, not independent editorial
verification. Output remains unreviewed. Final live checks are pending.


### Research quality correction

The first Texas result also included unsupported regional and chart claims.
Changed the default research model to gpt-5-mini with low reasoning and requested
10-15 established songs with specific birthplace/formation evidence, excluding
release-date and popularity claims. Only research_version=2 cache payloads can
be displayed; earlier test selections remain stored but are withheld. Existing
retry and spending-attempt limits are preserved, including Texas's three attempts.


## Historical funding blocker (2026-11-04)

3b52bfaf3f49d404889937b32a363d02d559e608 is Ready, Current Production as
Vercel 5kxriofwNBs22PHMFfn2Z1Vaz2r4. The public signed-in website loads.
Eighteen tests and the production build passed. The replacement key is accepted.
The final California request returned provider_http_429 / credit_balance_exhausted.
No further paid research calls were attempted after that response. User must
add API credit before final quality, regional generation and repeat-cache checks.
Earlier Texas/Washington trials were saved but failed content-quality review;
the new research_version=2 gate withholds those payloads without deleting them.
Texas and California have used their three region/week attempts. Do not bypass
these limits; use an untested region for post-funding verification or wait for
the next UTC ISO week. Successful generation with the revised model remains
unverified. The temporary service is configured and enabled, with heritage fallback.

## Funded live verification (2026-11-05)

The user confirmed funding. Production 6eda41f57a1b09657126696194cdf587efe5a66c
was Ready and Current as Ei2YipjYppuCwsWMv8uPqYnDJzRY. Using the signed-in
public globe and explicit place confirmation, New York generated eight sourced
picks with research_version=2 for 2026-W45, saved at 2026-11-05T23:07:35.251Z.
The page displayed source links, the weekly date, methodology and unreviewed label.
After a full page reload and a second confirmed New York visit, the same list
returned with attempts=1 and exactly the same saved timestamp: a live cache hit.
The API-credit blocker is resolved. No source or environment changes were required.
Earlier Texas, California and Washington trial payloads remain withheld; existing
retry limits and the next-week refresh are preserved.

Louisiana independently generated ten sourced picks, research_version=2, saved
at 2026-11-05T23:08:48.274Z, with attempts=1. Both funded lists have specific
regional connections and no claimed chart positions. New York repeat-cache and
both regional live-generation checks passed; individual recommendations remain
unreviewed AI output, not independently fact-checked canonical catalog data.
