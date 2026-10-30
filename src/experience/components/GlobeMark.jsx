const N_PATHS = ["M92 147 C30 205 25 375 92 468", "M92 468 L254 73 L254 542"]
const M_PATHS = ["M296 542 L296 73 L407 326 L500 197 C550 267 559 395 500 468"]

function Half({ side, paths, cx }) {
  return (
    <g className={`nm-half nm-${side}`} data-testid={`nm-half-${side}`}>
      <g className="nm-ghost">
        <circle cx={cx} cy="307" r="250" />
        <ellipse cx={cx} cy="307" rx="250" ry="70" />
        <ellipse cx={cx} cy="307" rx="105" ry="250" />
      </g>
      {paths.map((d) => <path key={d} d={d} />)}
      <g className="nm-sheen">
        {paths.map((d) => <path key={d} d={d} />)}
      </g>
    </g>
  )
}

export default function GlobeMark() {
  return (
    <div className="globe-wrap" aria-hidden="true" data-testid="nm-logo-animation">
      <div className="globe-glow" />
      <svg className="globe" viewBox="0 0 620 620" role="img">
        <defs>
          <linearGradient id="globeStroke" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#f0def7" />
            <stop offset="1" stopColor="#d9bde8" />
          </linearGradient>
        </defs>
        <g className="nm-mark nm-bounce">
          <Half side="n" paths={N_PATHS} cx="160" />
          <Half side="m" paths={M_PATHS} cx="425" />
        </g>
      </svg>
    </div>
  )
}
