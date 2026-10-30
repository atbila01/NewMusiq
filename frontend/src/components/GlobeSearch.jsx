import { useEffect, useRef, useState } from "react"
import Icon from "./Icon"
import { findCountryLocation } from "@/lib/earthMaps"
import { findStateLocation } from "@/lib/regions"
import { API } from "@/lib/profile"

export default function GlobeSearch({ onLocate }) {
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState("")
  const [busy, setBusy] = useState(false)
  const request = useRef(0)
  const timer = useRef(null)

  async function find(q) {
    const id = ++request.current
    const country = findCountryLocation(q) || findStateLocation(q)
    if (country) {
      onLocate({ ...country, key: Date.now() })
      return setStatus(`Showing ${country.label}`)
    }
    setStatus("Searching...")
    setBusy(true)
    try {
      const result = await (await fetch(`${API}/geo/search?q=${encodeURIComponent(q)}`)).json()
      if (id !== request.current) return
      if (!result.ok) return setStatus(result.error)
      onLocate({ ...result.location, key: Date.now() })
      setStatus(`Showing ${result.location.label}`)
    } catch {
      if (id === request.current) setStatus("Location search is unavailable right now.")
    } finally {
      if (id === request.current) setBusy(false)
    }
  }

  useEffect(() => {
    request.current += 1
    clearTimeout(timer.current)
    const q = query.trim()
    if (q.length < 2) { setStatus(""); setBusy(false); return }
    timer.current = setTimeout(() => find(q), 650)
    return () => clearTimeout(timer.current)
  }, [query])

  return (
    <form className="globe-search" aria-busy={busy} data-testid="globe-search-form"
      onSubmit={(e) => { e.preventDefault(); clearTimeout(timer.current); if (query.trim().length >= 2) find(query.trim()) }}>
      <Icon name="search" />
      <input type="search" aria-label="Search the globe" placeholder="Search the globe" value={query}
        data-testid="globe-search-input" onChange={(e) => setQuery(e.target.value)} />
      <span className="globe-search-status" aria-live="polite" data-testid="globe-search-status">{status}</span>
    </form>
  )
}
