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

export default function Lyrics({ progress, duration }) {
  const active = Math.min(lyricLines.length - 1, Math.floor((progress / duration) * lyricLines.length))
  return (
    <div className="expanded-lyrics" data-testid="player-lyrics">
      <div className="lyrics-heading">
        <div>
          <p className="player-kicker">Sing along</p>
          <h2>Lyrics</h2>
        </div>
        <span>Synced</span>
      </div>
      <div className="lyrics-lines" aria-live="polite">
        {lyricLines.map((line, i) => (
          <p key={line} className={i === active ? "active" : i < active ? "passed" : ""}>{line}</p>
        ))}
      </div>
      <p className="lyrics-credit">Lyrics by Maya Sol and Imani Wells</p>
    </div>
  )
}
