export default function WatermarkSeal({ schoolName = "BVM SCHOOL OF EXCELLENCE, KOTHAKOTA" }) {
  return (
    <svg
      viewBox="0 0 300 300"
      width="300"
      height="300"
      className="watermark-seal"
      style={{
        opacity: 0.08,
        filter: 'grayscale(100%)',
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact'
      }}
    >
      {/* Outer circle */}
      <circle cx="150" cy="150" r="140" fill="none" stroke="#000" strokeWidth="2" />
      
      {/* Inner circle */}
      <circle cx="150" cy="150" r="130" fill="none" stroke="#000" strokeWidth="1" />

      {/* Circular text path - top */}
      <defs>
        <path
          id="circleTop"
          d="M 40,150 A 110,110 0 0,1 260,150"
          fill="none"
        />
        <path
          id="circleBottom"
          d="M 260,150 A 110,110 0 0,1 40,150"
          fill="none"
        />
      </defs>

      {/* Top text - school name */}
      <text
        fontSize="16"
        fontWeight="bold"
        letterSpacing="2"
        fill="#000"
        textAnchor="middle"
      >
        <textPath href="#circleTop" startOffset="50%">
          {schoolName}
        </textPath>
      </text>

      {/* Center decoration circle */}
      <circle cx="150" cy="150" r="8" fill="#000" />

      {/* Decorative dots */}
      <circle cx="60" cy="150" r="3" fill="#000" />
      <circle cx="240" cy="150" r="3" fill="#000" />
      <circle cx="150" cy="60" r="3" fill="#000" />
      <circle cx="150" cy="240" r="3" fill="#000" />
    </svg>
  );
}