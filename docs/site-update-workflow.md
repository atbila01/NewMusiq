# Automatic NewMusiq updates

## User authorization

On 2026-10-30 the user requested changes from this workspace and MaknCheese04's
Emergent branch reach the site automatically. Their final choice was direct live
updates after verification, superseding a brief preview-first answer.

## Active monitor

Codex heartbeat `sync-newmusiq-site-updates` is active every 15 minutes in this
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
