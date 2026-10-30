"use client"

import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react"
import EarthGlobe, { type GlobeLocation } from "./EarthGlobe"
import { searchGlobeLocation, submitListenerComment } from "./actions"
import { findCountryLocation } from "./earthMaps"

export type ListenerComment = {
  id: string
  displayName: string
  message: string
  createdAt: string
  pending: boolean
}

type IconName = "search" | "profile" | "studio" | "settings" | "contact" | "previous" | "pause" | "play" | "next" | "volume" | "more"

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, React.ReactNode> = {
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 4.5 4.5" />
      </>
    ),
    profile: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4.8 20c.7-4 3-6 7.2-6s6.5 2 7.2 6" />
      </>
    ),
    studio: (
      <>
        <path d="M5 20V9m4 11V4m5 16V7m5 13V11" />
        <path d="M3 20h18" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
      </>
    ),
    contact: (
      <>
        <path d="M4 5.5h16v12H8l-4 3v-15Z" />
        <path d="m5 7 7 5 7-5" />
      </>
    ),
    previous: (
      <>
        <path d="M6 5v14" />
        <path d="m18 6-9 6 9 6V6Z" />
      </>
    ),
    pause: (
      <>
        <path d="M8 5h3v14H8zM14 5h3v14h-3z" />
      </>
    ),
    play: <path d="m8 5 11 7-11 7V5Z" />,
    next: (
      <>
        <path d="M18 5v14" />
        <path d="m6 6 9 6-9 6V6Z" />
      </>
    ),
    volume: (
      <>
        <path d="M5 10v4h4l5 4V6l-5 4H5Z" />
        <path d="M17 9a4 4 0 0 1 0 6" />
        <path d="M19 6.5a8 8 0 0 1 0 11" />
      </>
    ),
    more: (
      <>
        <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
        <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
        <circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" />
      </>
    ),
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {paths[name]}
    </svg>
  )
}

type NavItem = {
  label: string
  icon: IconName
}

const navItems: NavItem[] = [
  { label: "Search", icon: "search" },
  { label: "Profile", icon: "profile" },
  { label: "Artist Studio", icon: "studio" },
  { label: "Settings", icon: "settings" },
  { label: "Contact Us", icon: "contact" },
]

const lyricLines = [
  "I found a language in the light",
  "A little rhythm in the blue",
  "Every city has a heartbeat",
  "And every road leads back to you",
  "We are dancing over borders",
  "Underneath a golden moon",
  "Let the whole wide world remind us",
  "There is always something new",
]

function PlayerScreen({
  onSignOut,
  initialComments,
}: {
  onSignOut: () => void
  initialComments: ListenerComment[]
}) {
  const [activeNav, setActiveNav] = useState("Profile")
  const [isPlaying, setIsPlaying] = useState(true)
  const [isPlayerExpanded, setIsPlayerExpanded] = useState(false)
  const [progress, setProgress] = useState(74)
  const [comments, setComments] = useState(initialComments)
  const [feedback, setFeedback] = useState("")
  const [feedbackStatus, setFeedbackStatus] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [searchStatus, setSearchStatus] = useState("")
  const [globeLocation, setGlobeLocation] = useState<GlobeLocation | null>(null)
  const [isSubmitting, startSubmitting] = useTransition()
  const [isSearching, startLocationSearch] = useTransition()
  const locationRequest = useRef(0)
  const searchTimer = useRef<number | null>(null)
  const duration = 238

  useEffect(() => {
    if (!isPlaying) return
    const timer = window.setInterval(
      () => setProgress((current) => (current >= duration ? 0 : current + 1)),
      1000,
    )
    return () => window.clearInterval(timer)
  }, [isPlaying])

  const formatTime = (seconds: number) =>
    `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
  const activeLyric = Math.min(
    lyricLines.length - 1,
    Math.floor((progress / duration) * lyricLines.length),
  )

  function findLocation(query: string) {
    const request = ++locationRequest.current
    const country = findCountryLocation(query)

    if (country) {
      setGlobeLocation({
        cameraDistance: country.cameraDistance,
        latitude: country.latitude,
        longitude: country.longitude,
        key: Date.now(),
      })
      setSearchStatus(`Showing ${country.label}`)
      return
    }

    setSearchStatus("Searching...")

    startLocationSearch(async () => {
      const result = await searchGlobeLocation(query)
      if (request !== locationRequest.current) return

      if (!result.ok) {
        setSearchStatus(result.error)
        return
      }

      setGlobeLocation({
        cameraDistance: result.location.cameraDistance,
        latitude: result.location.latitude,
        longitude: result.location.longitude,
        key: Date.now(),
      })
      setSearchStatus(`Showing ${result.location.label}`)
    })
  }

  useEffect(() => {
    locationRequest.current += 1
    if (searchTimer.current !== null) {
      window.clearTimeout(searchTimer.current)
    }

    const query = searchQuery.trim()
    if (query.length < 2) {
      setSearchStatus("")
      return
    }

    searchTimer.current = window.setTimeout(() => {
      findLocation(query)
      searchTimer.current = null
    }, 650)

    return () => {
      if (searchTimer.current !== null) {
        window.clearTimeout(searchTimer.current)
      }
    }
  }, [searchQuery])

  function handleFeedbackSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const message = feedback.trim()

    if (!message) {
      setFeedbackStatus("Write a comment before sending.")
      return
    }

    startSubmitting(async () => {
      const result = await submitListenerComment({
        displayName: "Alex Morgan",
        message,
      })

      if (!result.ok) {
        setFeedbackStatus(result.error)
        return
      }

      setComments((current) => [result.comment, ...current])
      setFeedback("")
      setFeedbackStatus("Thanks — your comment is awaiting review.")
    })
  }

  return (
    <main className="player-page">
      <aside className="player-sidebar">
        <button className="player-wordmark" type="button" onClick={onSignOut}>
          NewMusiq
        </button>

        <nav className="player-nav" aria-label="Main navigation">
          {navItems.map((item) => (
            <button
              className={activeNav === item.label ? "active" : ""}
              type="button"
              key={item.label}
              onClick={() => setActiveNav(item.label)}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-profile">
          <div className="profile-avatar">AM</div>
          <div>
            <strong>Alex Morgan</strong>
            <span>Listener</span>
          </div>
          <button type="button" aria-label="More account options">
            <Icon name="more" />
          </button>
        </div>
      </aside>

      <section className="now-playing" aria-label="Now playing">
        <header className="player-header">
          <form
            className="globe-search"
            aria-busy={isSearching}
            onSubmit={(event) => {
              event.preventDefault()
              if (searchTimer.current !== null) {
                window.clearTimeout(searchTimer.current)
                searchTimer.current = null
              }
              if (searchQuery.trim().length >= 2) {
                findLocation(searchQuery)
              }
            }}
          >
            <Icon name="search" />
            <input
              type="search"
              aria-label="Search the globe"
              placeholder="Search the globe"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
            <span className="globe-search-status" aria-live="polite">
              {searchStatus}
            </span>
          </form>
          <div className="live-indicator">
            <span />
            Live session
          </div>
        </header>

        <div className="player-content">
          <EarthGlobe targetLocation={globeLocation} />
        </div>

        <div
          className={`player-bottom-bar ${isPlayerExpanded ? "expanded" : ""}`}
          onClick={(event) => {
            if (
              !isPlayerExpanded &&
              !(event.target as HTMLElement).closest(".transport, .timeline")
            ) {
              setIsPlayerExpanded(true)
            }
          }}
        >
          {isPlayerExpanded && (
            <button
              className="collapse-player"
              type="button"
              aria-label="Collapse player"
              onClick={() => setIsPlayerExpanded(false)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m5 9 7 7 7-7" />
              </svg>
            </button>
          )}

          <div className="bottom-song-summary">
            <div className="mini-album">
              <img
                src="https://images.unsplash.com/photo-1706512199237-06867557fb85?auto=format&fit=crop&w=500&q=88"
                alt="Flowing gold and purple abstract forms"
              />
            </div>

            <div className="track-heading">
              <p>Worlds Between Us</p>
              <button
                className="expand-player-title"
                type="button"
                aria-expanded={isPlayerExpanded}
                onClick={() => setIsPlayerExpanded(true)}
              >
                Golden Moon
              </button>
              <a href="#artist">Maya Sol</a>
            </div>
          </div>

          <div className="transport">
            <button
              type="button"
              aria-label="Previous track"
              onClick={() => setProgress(0)}
            >
              <Icon name="previous" />
            </button>
            <button
              className="play-pause"
              type="button"
              aria-label={isPlaying ? "Pause" : "Play"}
              onClick={() => setIsPlaying((current) => !current)}
            >
              <Icon name={isPlaying ? "pause" : "play"} />
            </button>
            <button
              type="button"
              aria-label="Next track"
              onClick={() => setProgress(0)}
            >
              <Icon name="next" />
            </button>
          </div>

          <div className="timeline">
            <input
              aria-label="Song progress"
              type="range"
              min="0"
              max={duration}
              value={progress}
              onChange={(event) => setProgress(Number(event.target.value))}
              style={
                {
                  "--progress": `${(progress / duration) * 100}%`,
                } as React.CSSProperties
              }
            />
            <div>
              <span>{formatTime(progress)}</span>
              <span>-{formatTime(duration - progress)}</span>
            </div>
          </div>

          {isPlayerExpanded && (
            <div className="expanded-lyrics">
              <div className="lyrics-heading">
                <div>
                  <p className="player-kicker">Sing along</p>
                  <h2>Lyrics</h2>
                </div>
                <span>Synced</span>
              </div>
              <div className="lyrics-lines" aria-live="polite">
                {lyricLines.map((line, index) => (
                  <p
                    key={line}
                    className={
                      index === activeLyric
                        ? "active"
                        : index < activeLyric
                          ? "passed"
                          : ""
                    }
                  >
                    {line}
                  </p>
                ))}
              </div>
              <p className="lyrics-credit">
                Lyrics by Maya Sol and Imani Wells
              </p>
            </div>
          )}

          {isPlayerExpanded && (
            <section
              className="listener-comments"
              aria-labelledby="comments-title"
            >
              <div className="comments-heading">
                <div>
                  <p className="player-kicker">Listener room</p>
                  <h2 id="comments-title">Comments</h2>
                </div>
                <span>{comments.length}</span>
              </div>

              <div className="comment-list">
                {comments.length === 0 ? (
                  <div className="comments-empty">
                    <strong>Start the conversation</strong>
                    <span>Be the first listener to share a thought.</span>
                  </div>
                ) : (
                  comments.map((comment) => (
                    <article className="listener-comment" key={comment.id}>
                      <div className="comment-avatar" aria-hidden="true">
                        {comment.displayName
                          .split(" ")
                          .map((part) => part[0])
                          .join("")
                          .slice(0, 2)}
                      </div>
                      <div>
                        <div className="comment-meta">
                          <strong>{comment.displayName}</strong>
                          <span>
                            {comment.pending
                              ? "Pending review"
                              : new Intl.DateTimeFormat("en", {
                                  month: "short",
                                  day: "numeric",
                                }).format(new Date(comment.createdAt))}
                          </span>
                        </div>
                        <p>{comment.message}</p>
                      </div>
                    </article>
                  ))
                )}
              </div>

              <form className="feedback-form" onSubmit={handleFeedbackSubmit}>
                <label htmlFor="listener-feedback">Join the conversation</label>
                <div className="comment-composer">
                  <textarea
                    id="listener-feedback"
                    name="feedback"
                    maxLength={600}
                    rows={1}
                    placeholder="Add your feedback..."
                    value={feedback}
                    onChange={(event) => {
                      setFeedback(event.target.value)
                      setFeedbackStatus("")
                    }}
                  />
                  <button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Sending..." : "Post"}
                  </button>
                </div>
                <div className="feedback-form-footer">
                  <p className="feedback-status" aria-live="polite">
                    {feedbackStatus}
                  </p>
                  <span>{feedback.length}/600</span>
                </div>
              </form>
            </section>
          )}
        </div>
      </section>
    </main>
  )
}

function GlobeMark() {
  return (
    <div className="globe-wrap" aria-hidden="true">
      <div className="globe-glow" />
      <svg className="globe" viewBox="0 0 620 620" role="img">
        <defs>
          <linearGradient id="globeStroke" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#f0def7" />
            <stop offset="1" stopColor="#d9bde8" />
          </linearGradient>
        </defs>

        <g className="nm-mark">
          <path d="M92 147 C30 205 25 375 92 468" />
          <path d="M92 468 L254 73 L254 542" />
          <path d="M296 542 L296 73 L407 326 L500 197 C550 267 559 395 500 468" />
          <g className="nm-sheen">
            <path d="M92 147 C30 205 25 375 92 468" />
            <path d="M92 468 L254 73 L254 542" />
            <path d="M296 542 L296 73 L407 326 L500 197 C550 267 559 395 500 468" />
          </g>
        </g>
      </svg>
    </div>
  )
}

export default function App({
  initialComments,
}: {
  initialComments: ListenerComment[]
}) {
  const [screen, setScreen] = useState<"login" | "create" | "player">("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [country, setCountry] = useState("")
  const [state, setState] = useState("")
  const [zipCode, setZipCode] = useState("")
  const [profilePhoto, setProfilePhoto] = useState("")
  const [status, setStatus] = useState("")

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (
      !email ||
      !password ||
      (screen === "create" &&
        (!confirmPassword || !country || !state || !zipCode))
    ) {
      setStatus("Complete all fields to continue.")
      return
    }

    if (screen === "create" && password !== confirmPassword) {
      setStatus("Your passwords do not match.")
      return
    }

    if (screen === "login") {
      setScreen("player")
      setStatus("")
      return
    }

    setStatus("Your NewMusiq account is ready.")
  }

  function handleProfilePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    if (!file) return

    const reader = new FileReader()
    reader.onload = () => setProfilePhoto(String(reader.result))
    reader.readAsDataURL(file)
  }

  function showCreateAccount() {
    setScreen("create")
    setStatus("")
  }

  if (screen === "player") {
    return (
      <PlayerScreen
        initialComments={initialComments}
        onSignOut={() => {
          setScreen("login")
          setPassword("")
        }}
      />
    )
  }

  return (
    <main className={`login-page ${screen === "create" ? "create-mode" : ""}`}>
      <section className="login-panel" aria-labelledby="login-title">
        {screen === "create" && (
          <button
            className="account-back"
            type="button"
            onClick={() => {
              setScreen("login")
              setStatus("")
            }}
          >
            <span aria-hidden="true" />
            Back
          </button>
        )}
        <div className="login-shell">
          <a
            className="wordmark"
            href="#login"
            aria-label="NewMusiq login"
            onClick={() => {
              setScreen("login")
              setStatus("")
            }}
          >
            NewMusiq
          </a>

          <div className="form-block">
            <p className="eyebrow">Your music home</p>
            <h1 id="login-title">
              {screen === "login"
                ? "Login To Your Account"
                : "Create Your Account"}
            </h1>

            {screen === "create" && (
              <div className="photo-field">
                <input
                  id="profile-photo"
                  className="photo-input"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleProfilePhoto}
                />
                <label className="photo-picker" htmlFor="profile-photo">
                  {profilePhoto ? (
                    <img src={profilePhoto} alt="Selected profile preview" />
                  ) : (
                    <>
                      <span className="photo-plus">+</span>
                      <span>Add photo</span>
                    </>
                  )}
                </label>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-describedby="form-status"
              />

              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-describedby="form-status"
              />

              {screen === "create" && (
                <>
                  <label htmlFor="confirm-password">Confirm Password</label>
                  <input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    aria-describedby="form-status"
                  />

                  <label htmlFor="country">Country</label>
                  <input
                    id="country"
                    type="text"
                    autoComplete="country-name"
                    value={country}
                    onChange={(event) => setCountry(event.target.value)}
                    aria-describedby="form-status"
                  />

                  <label htmlFor="state">State</label>
                  <input
                    id="state"
                    type="text"
                    autoComplete="address-level1"
                    value={state}
                    onChange={(event) => setState(event.target.value)}
                    aria-describedby="form-status"
                  />

                  <label htmlFor="zip-code">Zip Code</label>
                  <input
                    id="zip-code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="postal-code"
                    value={zipCode}
                    onChange={(event) => setZipCode(event.target.value)}
                    aria-describedby="form-status"
                  />
                </>
              )}

              <button type="submit">
                {screen === "login" ? "Sign In" : "Create Account"}
              </button>
              <p
                id="form-status"
                className={`status ${
                  status.startsWith("Welcome") ||
                  status.startsWith("Your NewMusiq")
                    ? "success"
                    : ""
                }`}
                aria-live="polite"
              >
                {status}
              </p>
            </form>

            {screen === "login" && (
              <p className="create-account">
                New to NewMusiq?{" "}
                <a href="#create-account" onClick={showCreateAccount}>
                  Create an Account
                </a>
              </p>
            )}
          </div>
        </div>
      </section>

      <section
        className="brand-panel"
        aria-label="Explore the world through music"
      >
        <GlobeMark />
        <p>Explore the World Through Music</p>
      </section>
    </main>
  )
}
