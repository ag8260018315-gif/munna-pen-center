/**
 * Hero artwork: a wholesale carton of stationery with registers, a pen cup,
 * a file, a ruler and a calculator. Flat vector, brand palette, no external assets.
 * Replace with a real photograph later by swapping this component for <Image>.
 */
export function HeroIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 600 500"
      className={className}
      role="img"
      aria-label="Illustration of a carton filled with pens and pencils beside a stack of registers, a pen cup, a file and a calculator — wholesale stationery supplies"
    >
      {/* Backdrop */}
      <rect x="8" y="8" width="584" height="484" rx="40" fill="#e9eefc" />
      <circle cx="300" cy="250" r="205" fill="#dce4fb" />
      <circle cx="505" cy="82" r="14" fill="#fbb724" opacity=".9" />
      <circle cx="78" cy="118" r="8" fill="#4c66d2" opacity=".35" />
      <circle cx="540" cy="420" r="9" fill="#4c66d2" opacity=".3" />

      {/* Ground shadow */}
      <ellipse cx="300" cy="446" rx="248" ry="14" fill="#262f62" opacity=".12" />

      {/* ── Pencils & rulers sticking out of the carton ── */}
      <g>
        {[
          { x: 352, h: 78, c: "#4c66d2", r: -9 },
          { x: 384, h: 104, c: "#fbb724", r: -3 },
          { x: 418, h: 86, c: "#313f95", r: 4 },
          { x: 452, h: 112, c: "#f59e0b", r: 9 },
          { x: 486, h: 80, c: "#6f89e3", r: 14 },
        ].map((p) => (
          <g key={p.x} transform={`rotate(${p.r} ${p.x} 222)`}>
            <rect x={p.x - 8} y={222 - p.h} width="16" height={p.h + 20} rx="2" fill={p.c} />
            <rect x={p.x - 3} y={222 - p.h} width="3" height={p.h + 20} fill="#ffffff" opacity=".28" />
            <path d={`M${p.x - 8} ${222 - p.h} L${p.x} ${222 - p.h - 22} L${p.x + 8} ${222 - p.h} Z`} fill="#f3d9b1" />
            <path d={`M${p.x - 3.2} ${222 - p.h - 8.8} L${p.x} ${222 - p.h - 22} L${p.x + 3.2} ${222 - p.h - 8.8} Z`} fill="#262f62" />
          </g>
        ))}
      </g>

      {/* ── Carton ── */}
      <g>
        <rect x="318" y="210" width="214" height="170" rx="6" fill="#e8c78f" />
        <rect x="318" y="210" width="214" height="30" rx="6" fill="#d6ac6c" />
        <rect x="318" y="228" width="214" height="12" fill="#d6ac6c" />
        <rect x="402" y="210" width="40" height="170" fill="#fbb724" opacity=".92" />
        <rect x="402" y="210" width="40" height="30" fill="#e5a317" />
        {/* shipping label */}
        <rect x="462" y="274" width="54" height="42" rx="3" fill="#ffffff" />
        <rect x="469" y="282" width="40" height="4" rx="2" fill="#9aa8d8" />
        <rect x="469" y="291" width="30" height="4" rx="2" fill="#c9d5f8" />
        <rect x="469" y="300" width="36" height="4" rx="2" fill="#c9d5f8" />
        {/* handle slots */}
        <rect x="334" y="304" width="46" height="9" rx="4.5" fill="#b98c4c" opacity=".75" />
      </g>

      {/* ── Register stack ── */}
      <g>
        <rect x="52" y="372" width="238" height="46" rx="7" fill="#262f62" />
        <rect x="266" y="378" width="18" height="34" rx="3" fill="#ffffff" opacity=".9" />
        <rect x="74" y="384" width="62" height="22" rx="3" fill="#ffffff" opacity=".92" />
        <rect x="84" y="391" width="42" height="3.5" rx="1.75" fill="#9aa8d8" />
        <rect x="84" y="398" width="30" height="3.5" rx="1.75" fill="#c9d5f8" />

        <rect x="68" y="326" width="212" height="46" rx="7" fill="#4c66d2" />
        <rect x="256" y="332" width="18" height="34" rx="3" fill="#ffffff" opacity=".9" />
        <rect x="88" y="338" width="62" height="22" rx="3" fill="#ffffff" opacity=".92" />
        <rect x="98" y="345" width="42" height="3.5" rx="1.75" fill="#9aa8d8" />
        <rect x="98" y="352" width="30" height="3.5" rx="1.75" fill="#c9d5f8" />

        <rect x="58" y="280" width="226" height="46" rx="7" fill="#fbb724" />
        <rect x="260" y="286" width="18" height="34" rx="3" fill="#ffffff" opacity=".9" />
        <rect x="78" y="292" width="62" height="22" rx="3" fill="#ffffff" opacity=".92" />
        <rect x="88" y="299" width="42" height="3.5" rx="1.75" fill="#f1c778" />
        <rect x="88" y="306" width="30" height="3.5" rx="1.75" fill="#f6dba3" />
      </g>

      {/* ── Pen cup with pens ── */}
      <g>
        {[
          { x: 104, y2: 150, c: "#313f95", r: -14 },
          { x: 122, y2: 126, c: "#f59e0b", r: -6 },
          { x: 140, y2: 142, c: "#4c66d2", r: 2 },
          { x: 158, y2: 120, c: "#262f62", r: 9 },
          { x: 176, y2: 148, c: "#fbb724", r: 16 },
        ].map((p) => (
          <g key={p.x} transform={`rotate(${p.r} ${p.x} 244)`}>
            <rect x={p.x - 5} y={p.y2} width="10" height={244 - p.y2} rx="5" fill={p.c} />
            <rect x={p.x - 5} y={p.y2} width="10" height="22" rx="5" fill="#ffffff" opacity=".22" />
            <rect x={p.x + 3} y={p.y2 + 6} width="2.4" height="30" rx="1.2" fill="#ffffff" opacity=".7" />
          </g>
        ))}
        <path d="M94 218 H186 L180 280 H100 Z" fill="#ffffff" />
        <path d="M94 218 H186 L184 232 H96 Z" fill="#c9d5f8" />
        <rect x="112" y="244" width="56" height="5" rx="2.5" fill="#4c66d2" opacity=".5" />
      </g>

      {/* ── File / binder standing between ── */}
      <g>
        <rect x="292" y="262" width="34" height="118" rx="5" fill="#6f89e3" />
        <rect x="300" y="276" width="18" height="38" rx="3" fill="#ffffff" opacity=".9" />
        <circle cx="309" cy="338" r="6" fill="#262f62" opacity=".4" />
      </g>

      {/* ── Ruler ── */}
      <g>
        <rect x="52" y="428" width="270" height="22" rx="4" fill="#fccb4d" />
        {Array.from({ length: 28 }, (_, i) => (
          <rect key={i} x={64 + i * 9.4} y="428" width="1.6" height={i % 5 === 0 ? 11 : 6} fill="#8a5a06" opacity=".7" />
        ))}
      </g>

      {/* ── Calculator ── */}
      <g>
        <rect x="402" y="318" width="126" height="132" rx="13" fill="#161b3b" />
        <rect x="414" y="330" width="102" height="30" rx="6" fill="#c9e3f3" />
        <rect x="470" y="338" width="36" height="5" rx="2.5" fill="#262f62" />
        <rect x="486" y="347" width="20" height="5" rx="2.5" fill="#262f62" />
        {[0, 1, 2].map((row) =>
          [0, 1, 2, 3].map((col) => (
            <rect
              key={`${row}-${col}`}
              x={414 + col * 26}
              y={370 + row * 21}
              width="21"
              height="15"
              rx="4"
              fill={col === 3 ? "#fbb724" : "#4c5a9e"}
            />
          )),
        )}
        <rect x="414" y="433" width="47" height="11" rx="4" fill="#4c5a9e" />
        <rect x="466" y="433" width="21" height="11" rx="4" fill="#4c5a9e" />
        <rect x="492" y="433" width="21" height="11" rx="4" fill="#fbb724" />
      </g>
    </svg>
  );
}
