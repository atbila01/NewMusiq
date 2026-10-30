# NewMusiq project workflow

Read docs/site-update-workflow.md and docs/emergent-integration.md for current
architecture and release status. The user authorized automatically publishing
completed, passing task changes to the LIVE site; a brief preview-first preference
was superseded on 2026-10-30.

## Current application

- Existing NewMusiq Supabase accounts, storage and billing remain authoritative.
- Emergent interface lives in src/experience. Account adapters call the existing
  src/context/AuthContext and Supabase backend; do not restore Clerk/MongoDB auth.
- Preserve the rotating globe's existing night-Earth texture and place confirmation.
- Pricing comes from supabase/functions/_shared/billing-plans.js.
- Older untracked frontend/, backend/, figma_source/ and .figma/ directories can
  remain on disk after branch changes. They are not the current application.

## After completing an authorized site change

1. Review the diff; run npm test and npm run build plus checks relevant to the task.
   Do not claim a live flow was verified from a local build alone.
2. Update the relevant project/change documentation. Commit and push only the
   task's reviewed source files, not .env, secrets, node_modules, backup bundles,
   unrelated changes or another active chat's edits.
3. Integrate passing changes into origin/Makayla without force-pushing. It is the
   production source for Vercel new-music/newmusiq. Preserve others' work; resolve
   routine conflicts only when the intended behavior is clear.
4. Verify Vercel's exact production revision is Ready and the public site loads.
   Report a failed or blocked deployment precisely and retain the working version.

## Collaborator updates

An active daily Codex heartbeat monitors atbila01/NewMusiq and
MaknCheese04/NewMusiqMLM:Emergent. See docs/site-sync-state.json for reviewed heads.
Port relevant Emergent frontend changes into the adapted current structure;
never blindly replace the NewMusiq account/payment integration with fork code.

## Existing specific deployment rejection

Automatic approval review rejected deploying the prepared experience-admin Edge
Function because it adds permanent account/storage deletion, subscription
cancellation and admin-role management. General live-update authorization does
not override that rejection. Do not deploy it by another mechanism without
explicit approval for that exact function. AI integration gaps are documented;
do not represent unavailable providers/features as working.
