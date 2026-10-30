import { useEffect, useState } from "react"
import UpgradeCard from "./UpgradeCard"
import { initials, useApi, useProfile } from "@/lib/profile"

const dateFmt = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" })

export default function ListenerComments() {
  const { profile } = useProfile()
  if ((profile?.plan_level || 0) < 2) {
    return (
      <section className="listener-comments" data-testid="listener-comments">
        <div className="comments-heading">
          <div>
            <p className="player-kicker">Listener room</p>
            <h2>Comments</h2>
          </div>
        </div>
        <UpgradeCard plan="Pro Listener" testId="comments-upgrade" title="Join the conversation"
          text="Pro Listener ($9.99/mo) unlocks the commentary service: talk with other listeners and artists and comment on the music you hear." />
      </section>
    )
  }
  return <CommentsRoom />
}

function CommentsRoom() {
  const api = useApi()
  const [comments, setComments] = useState([])
  const [feedback, setFeedback] = useState("")
  const [status, setStatus] = useState("")
  const [sending, setSending] = useState(false)

  useEffect(() => {
    api("/comments").then((r) => r.json()).then(setComments).catch(() => {})
  }, [api])

  async function submit(e) {
    e.preventDefault()
    const message = feedback.trim()
    if (!message) return setStatus("Write a comment before sending.")
    setSending(true)
    try {
      const res = await api("/comments", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message }),
      })
      const comment = await res.json()
      setComments((c) => [comment, ...c])
      setFeedback("")
      setStatus("Thanks — your comment is awaiting review.")
    } catch (err) {
      setStatus(err.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="listener-comments" aria-labelledby="comments-title" data-testid="listener-comments">
      <div className="comments-heading">
        <div>
          <p className="player-kicker">Listener room</p>
          <h2 id="comments-title">Comments</h2>
        </div>
        <span data-testid="comments-count">{comments.length}</span>
      </div>
      <div className="comment-list" data-testid="comment-list">
        {comments.length === 0 ? (
          <div className="comments-empty">
            <strong>Start the conversation</strong>
            <span>Be the first listener to share a thought.</span>
          </div>
        ) : comments.map((c) => (
          <article className="listener-comment" key={c.id} data-testid="comment-item">
            <div className="comment-avatar" aria-hidden="true">{initials(c.display_name)}</div>
            <div>
              <div className="comment-meta">
                <strong>{c.display_name}</strong>
                <span>{c.pending ? "Pending review" : dateFmt.format(new Date(c.created_at))}</span>
              </div>
              <p>{c.message}</p>
            </div>
          </article>
        ))}
      </div>
      <form className="feedback-form" onSubmit={submit} data-testid="comment-form">
        <label htmlFor="listener-feedback">Join the conversation</label>
        <div className="comment-composer">
          <textarea id="listener-feedback" name="feedback" maxLength={600} rows={1} placeholder="Add your feedback..."
            value={feedback} data-testid="comment-input" onChange={(e) => { setFeedback(e.target.value); setStatus("") }} />
          <button type="submit" disabled={sending} data-testid="comment-submit-button">{sending ? "Sending..." : "Post"}</button>
        </div>
        <div className="feedback-form-footer">
          <p className="feedback-status" aria-live="polite" data-testid="comment-status">{status}</p>
          <span>{feedback.length}/600</span>
        </div>
      </form>
    </section>
  )
}
