/**
 * "We serve customers across India" visual.
 *
 * A supply-network diagram — Dhanbad as the hub, connected to the regions of India
 * we serve. It is intentionally NOT a map outline: it makes no claim about
 * warehouses, branches or delivery times, and it never mis-draws India's borders.
 * Node positions loosely echo real geography (north at top, south at bottom).
 */
const REGIONS = [
  { label: "North India", x: 246, y: 74, labelAbove: true },
  { label: "North-East India", x: 470, y: 112, labelAbove: true },
  { label: "West India", x: 86, y: 196, labelAbove: false },
  { label: "Central India", x: 214, y: 262, labelAbove: false },
  { label: "East India", x: 458, y: 276, labelAbove: false },
  { label: "South India", x: 300, y: 356, labelAbove: false },
] as const;

const HUB = { x: 346, y: 188 };

export function SupplyNetwork({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 560 420"
      className={className}
      role="img"
      aria-label="Diagram of Dhanbad, Jharkhand connected to North, North-East, West, Central, East and South India"
    >
      <defs>
        <pattern id="supply-dots" width="22" height="22" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.4" fill="#a0b3f0" opacity=".45" />
        </pattern>
      </defs>
      <rect x="4" y="4" width="552" height="412" rx="28" fill="#f2f5fe" />
      <rect x="4" y="4" width="552" height="412" rx="28" fill="url(#supply-dots)" />

      {/* connections */}
      {REGIONS.map((region) => {
        const mx = (region.x + HUB.x) / 2;
        const my = (region.y + HUB.y) / 2 - 26;
        return (
          <path
            key={region.label}
            d={`M${HUB.x} ${HUB.y} Q${mx} ${my} ${region.x} ${region.y}`}
            fill="none"
            stroke="#3a4eb8"
            strokeWidth="2"
            strokeDasharray="2 7"
            strokeLinecap="round"
            opacity=".7"
          />
        );
      })}

      {/* regions */}
      {REGIONS.map((region) => (
        <g key={region.label}>
          <circle cx={region.x} cy={region.y} r="16" fill="#ffffff" stroke="#6f89e3" strokeWidth="2" />
          <circle cx={region.x} cy={region.y} r="6" fill="#4c66d2" />
          <text
            x={region.x}
            y={region.labelAbove ? region.y - 26 : region.y + 38}
            textAnchor="middle"
            fontSize="15"
            fontWeight="700"
            fill="#262f62"
            stroke="#f2f5fe"
            strokeWidth="6"
            strokeLinejoin="round"
            paintOrder="stroke"
            style={{ fontFamily: "var(--font-display), system-ui, sans-serif" }}
          >
            {region.label}
          </text>
        </g>
      ))}

      {/* hub */}
      <g>
        <circle cx={HUB.x} cy={HUB.y} r="26" fill="#fbb724" className="origin-center animate-pulse-ring" style={{ transformBox: "fill-box" }} />
        <circle cx={HUB.x} cy={HUB.y} r="22" fill="#262f62" />
        <circle cx={HUB.x} cy={HUB.y} r="8" fill="#fbb724" />
        <text
          x={HUB.x}
          y={HUB.y + 54}
          textAnchor="middle"
          fontSize="17"
          fontWeight="800"
          fill="#161b3b"
          stroke="#f2f5fe"
          strokeWidth="7"
          strokeLinejoin="round"
          paintOrder="stroke"
          style={{ fontFamily: "var(--font-display), system-ui, sans-serif" }}
        >
          Dhanbad, Jharkhand
        </text>
      </g>
    </svg>
  );
}
