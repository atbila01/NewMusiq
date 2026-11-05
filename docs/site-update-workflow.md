# Automatic NewMusiq updates

## User authorization

On 2026-10-30 the user requested changes from this workspace and MaknCheese04's
Emergent branch reach the site automatically. Their final choice was direct live
updates after verification, superseding a brief preview-first answer.

## Active monitor

Codex heartbeat `sync-newmusiq-site-updates` is active every hour in this
chat. The computer must be awake and the desktop app running for local work.
This is polling, not an instant webhook. Unsaved edits and ongoing uncommitted
work are not published; completed work must be committed/pushed first.

Sources and starting revisions are recorded in `site-sync-state.json`:
- atbila01/NewMusiq: codex/emergent-integration, Emergent, and Makayla.
- MaknCheese04/NewMusiqMLM: Emergent.

Production is the existing Vercel project `new-music/newmusiq`, tracking
`atbila01/NewMusiq:Makayla`.

## Integration and delivery rules

1. Fetch source commits and inspect their actual changes. Port Emergent frontend
   updates from frontend/src to src/experience with the existing alias/auth
   adaptations. Its raw backend uses different accounts/data and cannot be
   blindly merged into NewMusiq.
2. Preserve Supabase accounts, existing NewMusiq billing and plan definitions,
   rotating night-Earth texture, and explicit place confirmation.
3. Run account/discovery tests and a production build, plus checks appropriate
   to the change. `npm run build` now runs the tests before Vite, including in
   Vercel. Failed tests/builds cannot become a successful production build.
4. Promote passing reviewed commits to Makayla without force pushes. Check the
   exact deployed SHA and Ready state, then load the public site.
5. Record source revisions and deployment results. Ignore cursor/documentation-only
   commits when deciding whether application code needs a new deployment. Remain
   quiet with no changes. Report conflicts, failures or necessary user action.

## Existing limits

The account-management function experience-admin remains blocked by the prior
approval rejection. This live-update authorization does not approve deployment
of its permanent deletion, subscription cancellation or role-management features.
Do not deploy that function through another mechanism to bypass review.
AI/provider integrations documented in emergent-integration.md remain incomplete;
automatic updates must not claim they are live until separately connected/tested.

## Hourly cadence (2026-11-02)

The user changed monitoring to every hour, superseding the daily schedule and
its commit-volume frequency question. Review both Emergent branches each hour,
adapt relevant frontend changes, test, publish to Makayla, and verify production.
Keep quiet when unchanged; report new live updates, failures or required action.

The 2026-11-02 source review found wordmark typography and account-form spacing
changes, now ported into src/experience. The fork also tightened its weekly AI
chart duplicate filter (MAX_SHARED=1). That backend remains unavailable in the
Supabase-adapted site and is explicitly pending, not integrated or live.
Restored archived Figma files, generated browser reports, a JPEG and Emergent job
metadata are not current application changes.

## Weekly service activation status (2026-11-03)

The temporary weekly adapter and private cache are deployed. MAX_SHARED=1 means
at most one previously used song per new list, not globally exclusive songs.
Live provider verification is blocked: OpenAI rejected the saved Production key
with HTTP 401 invalid_api_key. Preserve the heritage fallback and do not describe
weekly AI selections as working until a replacement key and live generation pass.
See weekly-music-service.md for exact setup, limits and pending verification.

### Superseding activation result (2026-11-04)

The replacement OpenAI key is accepted. Ready Production 3b52bfa includes source
citation matching and research-quality checks; earlier weak trial lists are
withheld. Final revised-model verification is blocked by OpenAI HTTP 429
credit_balance_exhausted. Heritage remains available; do not claim the revised
weekly generation or cache-hit flow is verified until API credit is added and
those checks pass. See weekly-music-service.md for retry-limit implications.

### Funded activation verified (2026-11-05)

The API credit blocker is resolved. On Ready/Current production 6eda41f, signed-in
New York and Louisiana generated eight and ten sourced weekly picks respectively.
A reloaded New York repeat visit returned the same saved timestamp with attempts=1,
verifying cache reuse. No environment/source changes were necessary. The temporary
service remains enabled until a replacement is connected and verified. Earlier
Texas/California/Washington trials stay withheld, with retry limits preserved.
