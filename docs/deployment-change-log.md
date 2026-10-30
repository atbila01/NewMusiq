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
