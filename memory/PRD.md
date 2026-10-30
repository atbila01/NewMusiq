# NewMusiq — PRD

## Original problem statement
"Copy what exists in the following link so I can expand on it: https://plug-fax-36444509.figma.site"
User choices: real accounts (sign up / log in), land on the existing home page after login, profile photo saved and shown.

## Architecture
- Original Figma Make export (Next.js + Payload CMS) preserved in /app/figma_source (reference only).
- Ported to: Vite + React 19 frontend (/app/frontend), FastAPI backend (/app/backend), MongoDB.
- Auth: Emergent-managed Clerk (email + password). Profile data in Mongo `profiles` keyed by Clerk user_id.
- Photos: Emergent object storage (path newmusiq/avatars/{user_id}/...), served via authenticated GET /api/me/photo.
- Comments: Mongo `comments`, new comments are "pending"; listeners see approved + their own pending.
- Globe: three.js with world-atlas countries + admin-1 borders; search by country (client) or any place (/api/geo/search → OpenStreetMap Nominatim).

## Implemented (2026-10-22)
- Login page & Create account page with original split layout, NewMusiq wordmark, animated NM mark
- Profile completion step (photo, display name, country, state, zip) after sign-up; edit profile from account menu
- Home/player: sidebar nav, 3D globe (drag/zoom/fit/search), live indicator, player bar, expanded player w/ synced lyrics and listener comments
- Sign out from account menu

## Iteration 2 (2026-10-22)
- Login page first (Clerk sign-in card, email + password) with "New to NewMusiq? Create an Account" link
- Create account: Clerk sign-up on left, plan picker on right (Standard $4.99 / Pro $9.99 / Artist $14.99, monthly, tiered)
- Step 2 profile: photo on top, username (unique), country/state/zip; then Stripe subscription checkout (claimable sandbox, managed tax mode)
- /subscribe (choose/change plan, old subscription cancelled on upgrade), /payment/success polling, /payment/cancel
- Gating: home needs any plan; comments need Pro; Artist Studio upload (audio <=25MB + cover) needs Artist; Search panel lists all artist releases (playable)
- Edit profile: change subscription + delete account (cancels Stripe sub, removes data, deletes Clerk login)
- Globe: state/region borders thinner/darker, hidden at default view, fade in when zoomed or searching a region
- Login screen NM logo: two globes (N, M facing outward) bounce together into still NM logo, repeats every 10s
- Mobile: avatar button in header opens account menu
- Note: username login not possible with managed sign-in (email only); username shown in app

## Backlog
- P1: Real audio playback & track library; nav sections (Search, Artist Studio, Settings, Contact Us) are visual only
- P1: Admin moderation for comments (approve/hide)
- P1: Play artist uploads in the main bottom player; pin releases on the globe by location
- P2: Pins on globe for artists/tracks by region

## Iteration 2 fixes (after test report iteration_2)
- Mobile account menu now above the globe (header z-index)
- Object storage calls retry and return a friendly 502 instead of a crash
- Change plan page preselects the current plan (no accidental downgrade)
- Globe easing is frame-rate independent (searched regions land centered)
- Playing a New Release pauses the demo player

## Iteration 3 (2026-10-22)
- "No thanks, I'm just browsing" option under the 3 plans (sign-up, complete-profile, subscribe pages)
- Browsing users (profile.browsing=true, POST /api/me/browse): globe explore/search only; bottom player replaced by "Browsing mode" bar with See plans; New Releases, comments, Artist Studio locked (backend 403)

## Iteration 4 (2026-10-22)
- Free 15s previews of artist releases for browsing users (ffmpeg via imageio-ffmpeg, cached preview_path)
- Globe pins: tracks geocoded on upload (lat/lon), glowing pins scale with zoom; click pin plays track
- Artist uploads + Apple previews play in the main bottom player (PlayerProvider in lib/player.jsx)
- Admin (/admin): approve/hide comments, People list with role changes. Roles in `users` collection; ADMIN_EMAIL env (not set yet). Test user alexmorgan set admin in preview DB.

## Iteration 5 (2026-10-22) — Region pop-up
- Click any country (or US state) on globe -> RegionPopup (offline detection via world-atlas + us-atlas polygons)
- "Music genres from this area": user-provided summaries for WA, OR, CA, NV, MT, UT, AZ, NE, OK, TX (backend/regional_genres.py) + 2 curated songs each, resolved via iTunes Search with 30s previews
- "Top genres right now" (counted from live chart) -> click = generated playlist (iTunes Search)
- "Top songs right now": live Apple Music most-played chart per country (rss.marketingtools.apple.com, cached 1h); US states use the US chart (no state charts exist)
- Song detail view (album, release, length, play 30s preview, open in Apple Music); browsing users can view but not play
- Cultural side borders per region (lib/patterns.js: evergreen, surf, deco, canyon, lonestar, western, seigaiha, papel, kente, stars, waves)
- Offline US state search in globe search (Nominatim rate-limits)
- Fixes after test iteration 4: mobile popup no sideways overflow & sits above player; uploads fall back to offline country/state coordinates for pins when OpenStreetMap is rate-limited; Escape closes region popup
- Known: Apple chart genre names follow the storefront language (e.g. Japanese in JP); centred-search camera can land slightly off-centre on some countries

## Iteration 6 (2026-10-22)
- Pins removed. ADMIN_EMAIL=murphmaklane@gmail.com (role admin set in preview DB too)
- Sidebar nav -> full screens (routes inside shell): / Explore globe, /search, /profile, /studio, /studio/upload, /settings, /admin (admins only), /contact
- Search: songs & artists (iTunes) + NewMusiq releases; by lyrics (GPT-5.4 identifies); sing/hum (Whisper transcribes -> GPT identifies; pure humming w/o words not supported)
- Profile: liked songs, playlists (create/add/remove/delete), most visited places (from region pop-ups), my comments (click -> globe region or expanded player)
- Studio: analytics (plays/listeners, line chart week/month/year, most played/liked), Albums + Singles shelves, Upload FAB -> upload screen (audio, cover, title, featured artists, single/album, location, lyrics). AI lyric sync: Whisper segments aligned to lines; synced lyrics in expanded player
- Settings: Spotify-style (account, playback, notifications, privacy, language, about, sign out, delete account)
- Admin: comments, Contact Us feedback, subscriptions (+MRR), artist content hide/restore, people/roles
- Fonts: Pacifico wordmark (gold gradient + staff lines on login), Yanone Kaffeesatz for all other text
- Region pop-up: top songs + top genre playlists are weekly AI-curated (GPT-5.4-mini, cached per region per ISO week in region_weekly) — NOT live web search; songs open official YouTube video (youtube-nocookie embed; found via YouTube search page scrape, or YouTube Data API if YOUTUBE_API_KEY set). YouTube ads cannot be blocked.

## 2026-06 Sign-in update
- Custom one-screen sign-in card (/sign-in): "Email or username" + password + Sign In, then Continue with Google. Email path uses Clerk signIn.password (+ email code if Clerk asks); username path uses POST /api/auth/username-sign-in (backend/login.py: verifies password via Clerk, rate-limited 5 fails/15min per username, returns one-time ticket).
- Forgot password -> /sign-in/reset (Clerk component). Other /sign-in/* subpaths (sso-callback, ticket) use Clerk <SignIn/>.
- Google enabled on Clerk (sign_in ["email","google"]). Apple sign-in NOT available with managed auth.
- Search screen: search bar back on the left, slimmer (36px), mode buttons left-aligned.
- Pending: hum/melody matching not real yet; last round (Liked Songs playlist, playlist modal, upload order) not fully tested.

## 2026-06 Plans + sign-in extras
- Free "just browsing" option removed (PlanPicker, Subscribe, ProfileSetup); /api/me/browse removed; profile.browsing always false, so existing browsing users are sent to /subscribe.
- Sign-in: show/hide password eye (signin-password-toggle); Remember me checkbox (default on). Unticked -> localStorage nm-forget-me + session cookie nm_alive; RememberGuard (lib/remember.jsx) signs out once the browser is closed.
- Hum matching: user chose to skip for now (needs a recognition service such as ACRCloud).

## 2026-06 Welcome tour
- WelcomeTour.jsx (rendered in GlobeHome): 3 spotlight steps (globe .player-content, nav-search, nav-profile). Shows once per account: PUT /me sets tour_pending on first profile completion; Profile.show_tour = tour_pending && paid plan; POST /api/me/tour-done clears it. Existing accounts (no field) never see it.
- Test: mongosh newmusiq --eval db.profiles.updateOne({username_lower:"alexmorgan"},{$set:{tour_pending:true}}) to replay.
