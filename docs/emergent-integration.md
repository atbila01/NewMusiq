# Emergent interface integration

## Confirmed decision (2026-10-30)

Use Emergent's interface and revolving globe, with the Earth-at-night texture from
the current NewMusiq site. Keep existing NewMusiq Supabase accounts and the existing
NewMusiq payment backend. This supersedes the earlier plan to preserve the flat
Leaflet map interface unchanged.

Branch: `codex/emergent-integration`, based on Makayla.
Source interface: Emergent `6d2aecb`.
Emergent production reference: https://plug-fax-clone.emergent.host.
Supabase project: `dcoivxvmgoggevpqurcc`.

## Implemented locally

- Emergent account, explore, search, library, studio, upload, preferences, support,
  and moderation screens, routed through the existing NewMusiq AuthProvider.
- Existing Supabase sign-in, registration, recovery and current-account profile
  updates; no Clerk credentials or sessions are substituted for NewMusiq users.
- Existing NewMusiq billing function and billing_accounts determine checkout and
  entitlement. Prices and trials come from the existing shared billing plans.
- Revolving globe uses the existing NASA night-Earth image, rather than the gold
  generated land texture. Map selection requires confirmation; reduced-motion
  preferences disable automatic rotation.
- New account-owned likes, playlists, place history, feedback, comments, release
  metadata and private media use Supabase. Existing database playlists and songs
  remain readable in the combined library. Existing artist verification remains
  available from Studio.
- Uploaded playback and existing Supabase song playback use actual stored audio;
  the imported simulated demo player is no longer shown as a real recording.
- Authenticated discovery API provides video search, regional heritage panels and
  geographic lookup. Account access tokens are not forwarded to Emergent.
- AI lyric identification has an explicit configuration check; it requires the
  server's OPENAI_API_KEY. Voice identification, automatic lyric alignment and
  weekly AI rankings are not implemented in the replacement backend yet. Regional
  heritage selections are labeled as heritage, not live or AI-generated charts.

## Applied to Supabase

Migration `20261030034010_emergent_experience` was applied through the signed-in
SQL editor, then registered in schema_migrations. It adds experience_records and
experience-media, private aggregation functions and explicit grants/RLS.

Verification:
- An authenticated member could insert and edit their own transactional test
  playlist; changing moderation status was rejected. The test was rolled back.
- Final introspection: RLS enabled=true; anon table SELECT=false; authenticated
  INSERT status=false; authenticated UPDATE kind=false.
- Admin decisions check the current stored app role and active session, not
  user-editable metadata or a deleted account's surviving access token.
- Existing account and billing tables were not migrated or replaced.

## Verification

- Production frontend build passed with code splitting.
- Seven account-entitlement and discovery tests passed.
- Local visual preview confirmed the night-Earth globe renders and rotates;
  searching Texas displayed the explicit confirmation dialog.
- Authenticated end-to-end account, checkout, uploads and moderation have not been
  live-verified. No payment was initiated.

## Deployment approval required

The exact source for the proposed experience-admin function is
`supabase/functions/experience-admin/index.ts`. It implements server-verified
administrator user listing/role updates, and user-confirmed self-deletion with
subscription cancellation and private-media removal.

Automatic approval review rejected deploying this production Edge Function
because permanent deletion, subscription cancellation and admin-role management
require explicit approval for that specific deployment. Its prepared source is
loaded in the Supabase editor, but the function has NOT been deployed. Do not
bypass that rejection through another deployment method.

The core interface was deployed through Makayla at 58c3033 on 2026-10-30 and
verified Ready with a public HTTP 200. The full feature migration remains incomplete:
provider integrations, the sensitive account function and authenticated end-to-end
verification still need completion. See deployment-change-log.md for evidence.

## MCP setup

The project's Supabase MCP URL is registered in Codex. Two login attempts failed
with OAuth metadata-discovery response-decoding errors; configuration does not
prove authenticated tool availability. The SQL editor was used as the authorized
fallback.

## Complimentary administrators (2026-10-30)

The user explicitly approved complimentary membership and exclusive site administrator
access for aliyahbilal236@gmail.com and murphmaklane@gmail.com. Both existing email
identities were confirmed in Supabase before applying migration 20261030123016.
A private allowlist binds the grants to those existing user IDs and verified email
addresses. Every privileged check requires a current database session. Client
metadata, stale JWT roles and profile fields cannot grant this access.

The experience_access RPC supplies membership and role to the UI. Settings offers
Admin only to these administrators; paid membership prompts are removed for their
accounts. Comment/audio policies honor complimentary access. Publishing still
requires verified artist ownership. Billing records and paid subscriptions are
unchanged; existing subscribers must cancel separately if desired.

General role changes are disabled. The prepared experience-admin function also
rejects role changes and uses the authoritative role RPC, but remains UNDEPLOYED
under its existing approval restriction. Account deletion, cancellation and People
management are not enabled by this change. Existing AI limitations still apply.
