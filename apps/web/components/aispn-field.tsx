type AispnFieldProps = {
  offenseLabel: string;
  defenseLabel: string;
  down: number;
  distance: number;
  yardLine: number; // 0-100, offense moving left-to-right toward 100
  qtr?: number;
  timeSeconds?: number;
  lastPlay?: string | null;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function clock(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function ordinalDown(down: number) {
  if (down === 1) return "1st";
  if (down === 2) return "2nd";
  if (down === 3) return "3rd";
  return `${down}th`;
}

function ordinalShort(down: number) {
  if (down === 1) return "1ST";
  if (down === 2) return "2ND";
  if (down === 3) return "3RD";
  return "4TH";
}

export function AispnField(props: AispnFieldProps) {
  const yardLine = clamp(Number.isFinite(props.yardLine) ? props.yardLine : 25, 0, 100);
  const down = clamp(Number.isFinite(props.down) ? props.down : 1, 1, 4);
  const distance = clamp(Number.isFinite(props.distance) ? props.distance : 10, 1, 99);
  const firstDownAt = clamp(yardLine + distance, 0, 100);

  // Render 120 yards including endzones. Ball and markers are on the 100-yard field between goal lines.
  const fieldLeft = 10; // left goal line is at x=10
  const fieldRight = 110; // right goal line is at x=110
  const ballX = fieldLeft + yardLine;
  const firstX = fieldLeft + firstDownAt;

  const playClock =
    typeof props.qtr === "number" && typeof props.timeSeconds === "number"
      ? `Q${props.qtr} ${clock(props.timeSeconds)}`
      : null;

  const situation = `${ordinalDown(down)} & ${distance} | Ball on ${yardLine}`;

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-900/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-slate-400">AISPN FIELD VIEW</p>
          <p className="mt-1 text-sm text-slate-200">
            <span className="font-semibold text-emerald-200">{props.offenseLabel}</span>
            <span className="text-slate-400"> possession</span>
            <span className="text-slate-500"> vs </span>
            <span className="font-semibold text-slate-200">{props.defenseLabel}</span>
          </p>
        </div>
        <div className="text-right text-xs text-slate-400">
          {playClock && <p>{playClock}</p>}
          <p className="text-slate-200">{situation}</p>
        </div>
      </div>

      {props.lastPlay ? (
        <p className="mt-2 line-clamp-2 text-xs text-slate-400">
          Last: <span className="text-slate-300">{props.lastPlay}</span>
        </p>
      ) : null}

      <div className="mt-3 overflow-hidden rounded-lg border border-slate-700/50 bg-gradient-to-b from-slate-950 to-slate-900">
        <svg
          viewBox="0 0 120 36"
          className="h-[180px] w-full md:h-[220px]"
          role="img"
          aria-label="Football field with ball spot and first-down marker"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="aispnGrass" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#0b3a2b" />
              <stop offset="1" stopColor="#062a21" />
            </linearGradient>
            <linearGradient id="aispnEndzone" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#081825" />
              <stop offset="1" stopColor="#050e18" />
            </linearGradient>
            <filter id="aispnGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="0.7" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Endzones */}
          <rect x="0" y="0" width="10" height="36" fill="url(#aispnEndzone)" />
          <rect x="110" y="0" width="10" height="36" fill="url(#aispnEndzone)" />
          <rect x="10" y="0" width="100" height="36" fill="url(#aispnGrass)" />

          {/* Yard stripes (every 5 yards on the field of play) */}
          {Array.from({ length: 21 }).map((_, i) => {
            const x = fieldLeft + i * 5;
            const isTen = i % 2 === 0;
            return (
              <line
                key={`stripe-${i}`}
                x1={x}
                y1="0"
                x2={x}
                y2="36"
                stroke={isTen ? "rgba(226,232,240,0.35)" : "rgba(226,232,240,0.16)"}
                strokeWidth={isTen ? 0.45 : 0.25}
              />
            );
          })}

          {/* Hash marks */}
          {Array.from({ length: 50 }).map((_, i) => {
            const x = fieldLeft + i * 2;
            return (
              <g key={`hash-${i}`} opacity="0.35">
                <line x1={x} y1="12" x2={x} y2="13.2" stroke="rgba(226,232,240,0.45)" strokeWidth="0.25" />
                <line x1={x} y1="22.8" x2={x} y2="24" stroke="rgba(226,232,240,0.45)" strokeWidth="0.25" />
              </g>
            );
          })}

          {/* Yard numbers */}
          {([10, 20, 30, 40, 50, 40, 30, 20, 10] as const).map((n, idx) => {
            const x = fieldLeft + (idx + 1) * 10;
            return (
              <text
                key={`num-${idx}`}
                x={x}
                y="33"
                textAnchor="middle"
                fontSize="3.4"
                fill="rgba(226,232,240,0.45)"
                style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace" }}
              >
                {n}
              </text>
            );
          })}

          {/* First down marker */}
          <line x1={firstX} y1="0" x2={firstX} y2="36" stroke="rgba(250, 204, 21, 0.9)" strokeWidth="0.65" strokeDasharray="1.4 1.2" />

          {/* Line of scrimmage */}
          <line x1={ballX} y1="0" x2={ballX} y2="36" stroke="rgba(56, 189, 248, 0.95)" strokeWidth="0.8" filter="url(#aispnGlow)" />

          {/* Ball marker */}
          <g
            filter="url(#aispnGlow)"
            style={{
              transform: `translate(${ballX}px, 18px)`,
              transition: "transform 0.6s cubic-bezier(0.4,0,0.2,1)",
            }}
          >
            <circle r="1.45" fill="#eab308" stroke="rgba(17,24,39,0.8)" strokeWidth="0.55" />
            <circle r="0.55" fill="rgba(17,24,39,0.35)" />
          </g>

          {/* Drive direction hint */}
          <g opacity="0.8">
            <path d={`M ${ballX + 1.4} 5 L ${ballX + 5.2} 5 L ${ballX + 4.1} 3.5 M ${ballX + 5.2} 5 L ${ballX + 4.1} 6.5`} stroke="rgba(226,232,240,0.55)" strokeWidth="0.5" fill="none" />
          </g>

          {/* Label blocks */}
          <g>
            <rect x="1.2" y="1.2" width="17.5" height="5.6" rx="1.2" fill="rgba(2,6,23,0.65)" stroke="rgba(148,163,184,0.25)" />
            <text x="2.2" y="5.0" fontSize="3.0" fill="rgba(226,232,240,0.85)" style={{ fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial" }}>
              POSSESSION
            </text>
          </g>

          <text
            x="60"
            y="6.4"
            textAnchor="middle"
            fill="rgba(226,232,240,0.9)"
            fontSize="3.2"
            fontWeight="700"
            style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace" }}
          >
            {ordinalShort(down)} &amp; {distance}
          </text>
        </svg>
      </div>
    </div>
  );
}
