export default function Screen({ kicker, title, children, testId, actions }) {
  return (
    <div className="screen" data-testid={testId}>
      <header className="screen-head">
        <div>
          <p className="player-kicker">{kicker}</p>
          <h1>{title}</h1>
        </div>
        {actions}
      </header>
      {children}
    </div>
  )
}
