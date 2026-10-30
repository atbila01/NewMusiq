import { useState } from "react"
import Screen from "./Screen"
import { useApi } from "@/lib/profile"

const TOPICS = ["General feedback", "Report a problem", "Billing & plans", "Artist support", "Feature idea"]

export default function ContactScreen() {
  const api = useApi()
  const [topic, setTopic] = useState(TOPICS[0])
  const [message, setMessage] = useState("")
  const [status, setStatus] = useState("")

  async function send(e) {
    e.preventDefault()
    if (message.trim().length < 3) return setStatus("Tell us a little more.")
    try {
      await api("/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic, message }) })
      setMessage(""); setStatus("Thanks! Our team will read your message soon.")
    } catch (err) { setStatus(err.message) }
  }

  return (
    <Screen kicker="We're listening" title="Contact Us" testId="contact-screen">
      <form className="screen-form" onSubmit={send}>
        <label htmlFor="topic">Topic</label>
        <select id="topic" value={topic} onChange={(e) => setTopic(e.target.value)} data-testid="contact-topic">
          {TOPICS.map((t) => <option key={t}>{t}</option>)}
        </select>
        <label htmlFor="msg">Message</label>
        <textarea id="msg" rows={7} maxLength={2000} value={message} onChange={(e) => setMessage(e.target.value)} data-testid="contact-message" />
        <button type="submit" data-testid="contact-submit">Send message</button>
        <p className="status success" data-testid="contact-status">{status}</p>
      </form>
    </Screen>
  )
}
