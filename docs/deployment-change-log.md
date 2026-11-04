# Deployment change log

## 2026-10-29 — Vercel production branch

- Created and verified `backups/NewMusiq-before-vercel-switch-2026-10-29.bundle`, containing the complete local Git history and all local refs, including `main`, `Makayla`, and `jackson`.
- User confirmed the intended production source is the existing `Makayla` branch in `atbila01/NewMusiq`.
- Changed Vercel project `new-music/newmusiq` Production environment branch tracking from `main` to `Makayla`.
- Verified Vercel's confirmation: “Branch tracking saved; redeploy a deployment from ‘Makayla’ to this environment”.
- No new deployment was triggered. The existing live deployment was not replaced during this change.
- To reverse the setting, restore Production environment branch tracking to `main`.

## 2026-10-29 — Makayla deployed to production

- User requested deploying Makayla to the live site.
- Created production deployment CjbC19FpYhZa4WfQCcBTcscrEB2N from Makayla commit 862e4d67d8e9d3e89bc0ea40e331dd0ec7602139.
- Vercel verified Ready, Production, Current, with newmusiq-gamma.vercel.app assigned. Build completed in 9 seconds, with four build warnings.


## 2026-10-30 — Emergent interface integration in progress

- Prepared codex/emergent-integration using current NewMusiq accounts/billing and Emergent interface.
- Applied additive Supabase migration 20261030034010; access-policy checks passed.
- Frontend production build and seven tests passed; revolving night-Earth map visually checked locally.
- Live production remains Makayla. Authenticated flows and AI feature parity remain unverified/incomplete.
- Production deployment of experience-admin was rejected by automatic approval review; explicit approval is required for deletion, subscription cancellation and role-management capabilities.
- See emergent-integration.md for current scope and evidence.

## 2026-10-30 — Automatic update workflow

- User chose direct live updates after passing checks (supersedes preview-first).
- Created active 15-minute Codex heartbeat sync-newmusiq-site-updates for this chat.
- Monitoring both atbila01/NewMusiq and MaknCheese04/NewMusiqMLM Emergent sources.
- Build now runs account/discovery tests before Vite, including on Vercel.
- Reviewed current new source commits: audio fixture pointer and archived Figma deletions only; no additional app behavior to port.
- Existing account-management deployment rejection remains in force.

### Initial automatic live release verified

- Promoted reviewed integration to origin/Makayla at 58c3033b874de75b816957632ad929664e410b57 without force-pushing.
- Vercel Production Overview confirmed Makayla and this exact commit as Ready.
- https://newmusiq-gamma.vercel.app/ returned HTTP 200 with /assets/index-gRXG9t4d.js, matching the verified build.
- Automation sync-newmusiq-site-updates is ACTIVE every 15 minutes. Computer/app availability is required; this is not instant webhook delivery.
- The separate experience-admin production deployment remains unapproved and undeployed.

## 2026-10-30 — Exclusive complimentary administrators

- User approved complimentary access for aliyahbilal236@gmail.com and murphmaklane@gmail.com, with these as the only site administrators and an Admin button in Settings.
- Applied migration 20261030123016 to the existing Supabase project: private grants bound to existing verified identities, current-session validation, authoritative role/membership RPC, and complimentary comment/audio access while retaining artist verification.
- Replaced metadata-based frontend role checks, disabled role promotion, and removed subscription purchase prompts for complimentary accounts. Existing paid subscriptions were not canceled or modified.
- Eight account/discovery tests and production build passed. Live database verification passed for both approved identities, an ordinary account and no-account requests; private grants are unreadable by clients and anonymous RPC execution is revoked.
- Promoted 586ef79926ff29b70162426b157ff561aa8ec096 to Makayla without force-pushing. Vercel production D9vgaYDuABkGT3YQwNhiiV5MPFMe verified Ready at that exact revision; public HTTP 200 serves /assets/index-BWgcpHrO.js, matching the tested build.
- A transaction under the authenticated database role confirmed {role: admin, complimentary: true} and successful comment insertion, then rolled back all test data.
- The separate experience-admin function remains undeployed; its source now also refuses role changes. This change does not enable account deletion, subscription cancellation, People management or unfinished AI services.
- Live browser verification used the already signed-in ordinary account: Settings loaded and correctly omitted Admin. No credentials were requested or used to sign into the two privileged accounts; their positive authorization was verified under the authenticated database role, not by a visual login session.

## 2026-10-30 — Artist verification review and publication

- Added Settings > Admin > Artists for the two approved administrators: evidence links, identity status, review notes, explicit decision confirmation, approval/publication and rejection.
- Applied migration 20261030124641: admin/session-authorized private review implementation, narrow client RPCs, reviewer/time audit, no self review, no unverified approval, locked pending-claim transitions, duplicate artist-name protection and restricted evidence visibility. Older reviewer metadata and service-role review calls no longer authorize reviews.
- Approval creates the public artist catalog record when needed; catalog artists now appear in site search and /artists/:artistId pages. Music releases remain separate.
- Eight account/discovery tests and production build passed. Nine transactional database checks passed under the authenticated role: both administrators can review; ordinary member denied; unverified identity blocked; self review blocked; verified artist published with audit; repeated approval blocked; rejection does not publish; invalid session blocked. Every fixture and decision was rolled back.
- Production verified on the 13:01 UTC monitor run: Vercel C8DqRfxDh9AS8GvqNqhxC8a6pi3V is Ready on Makayla at ffd4690048d4ad21c58c97f664613289b748f152. Public HTTP 200 serves /assets/index-WFan1HDb.js, matching the tested build. This resolves the prior browser-verification interruption. Positive privileged actions were tested transactionally in the database; no real artist was approved during verification.
- Existing NewMusiq accounts, complimentary access, billing, night-Earth texture and place confirmation preserved. The rejected experience-admin function was not deployed.

## 2026-10-30 — Daily update monitoring

- User changed sync-newmusiq-site-updates from every 15 minutes to once a day.
- Saved a seven-day rolling average trigger: above three unique source commits per day, ask the user for a new frequency and keep daily checks until they reply.
- Shared commits, merges and automated documentation/bookkeeping do not inflate the activity count. Quiet notification behavior and existing release restrictions are preserved.
- Scheduling/documentation change only; no application release is needed.

## 2026-11-02 — Hourly monitoring and Emergent frontend sync

- Updated existing heartbeat sync-newmusiq-site-updates to ACTIVE every hour;
  preserved its original chat and quiet notification policy. Supersedes daily cadence.
- Reviewed fork Emergent bdb7fb60d180f54ef5ff99569e09dffff5e814d2 against fdb0d28.
  Adapted Fraunces wordmark and desktop/mobile account-form spacing into src/experience.
- Weekly AI duplicate-filter change remains pending because its backend is not connected.
  Archived Figma/generated artifacts do not replace the current application.
- npm test: eight passed. npm run build: passed (existing chunk-size warning).
  Local Windows dependency repair was needed; dependency files are excluded from release.
- Publication and exact production verification pending below.

### Live verification

- Published reviewed commit 09ca07c70095d5e9cdf0ef0b3bb204c806dffbce to origin/Makayla.
- Vercel production DXC5hMJXCCERcERPTGYXe6Sz7anP confirmed Ready at that exact SHA.
- Public HTTP 200 serves index-Qo27fcD4.js and index-tZmEaZuA.css, matching local build.
- Live /sign-in and /sign-up render; computed wordmark is Fraunces weight 850,
  with form margin 30px. No account was created and authenticated flows were not retested.
- Existing backend gaps remain explicit; experience-admin was not deployed.

## 2026-11-02 — Temporary weekly music service prepared

- User requested activating Emergent-style weekly recommendations until a
  replacement AI agent is ready. Prepared an OpenAI Responses/web-search adapter
  behind the existing authenticated discovery API, private weekly cache migration,
  serialized generation and request ceilings, linked sources, unreviewed labels,
  and dated stale/heritage fallback. No canonical music records are published.
- Corrected MAX_SHARED interpretation: each new list may retain at most one song
  already used elsewhere; this does not guarantee globally exclusive songs.
- Fifteen tests and production build passed locally; existing chunk-size warning.
- Live Vercel configuration inspection found no project environment variables;
  unauthenticated discovery currently returns HTTP 503 setup incomplete. Local
  environment files contain no available AI provider key. Provider selection
  was requested from the user; no secrets were requested in chat.
- Activation blocked on provider/server configuration and database application.
  Supabase MCP calls are not usable in this chat. Migration/SQL permission tests,
  funded-provider research and authenticated live flow have NOT been verified.
- Saved on the separate codex/temporary-weekly-music branch, outside hourly-sync
  monitored branches. Production remains the verified 09ca07c frontend release.
  Exact configuration and activation checks: weekly-music-service.md.

## 2026-11-03 — Weekly service activation setup

- User selected OpenAI and saved Production secret OpenAI_API_Key. Adapter accepts
  that name without revealing, renaming or re-entering the user’s secret.
- Imported existing public VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY into
  Vercel Production/Preview; this resolves the previously missing server config
  after redeployment.
- Applied and registered 20261102200000 after transactional checks passed and
  test fixtures rolled back. Private cache RLS and service-only RPC grants verified.
- With explicit user approval, saved existing Supabase server key directly as
  Production SUPABASE_SERVICE_ROLE_KEY and WEEKLY_MUSIC_ENABLED=true. No keys in Git.
- Advisor review: zero errors; seven warnings concern older catalog policies and
  password protection, none the new cache/functions. Authenticated live tests and
  exact production revision verification pending below.

### Production rollout verified; provider flow pending

- Makayla 4139bd6cb877d79b56c43e59577677618f0cd988 is Ready on Vercel production
  BEbun21DyeDt9H9Xi6Qb8VbtCSR2. Public HTTP 200 serves index-C6LsVhX-.js and
  index-tZmEaZuA.css, matching the tested build.
- Signed-out discovery returns HTTP 401, replacing the prior setup-incomplete 503.
- Weekly feature flag and provider/cache credentials are configured. Real AI
  generation and repeated-request cache verification remain pending because
  the in-app NewMusiq session still shows sign-in. No working-provider claim yet.
