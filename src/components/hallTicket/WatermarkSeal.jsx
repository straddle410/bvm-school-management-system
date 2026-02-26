export default function WatermarkSeal({ schoolName = "BVM SCHOOL OF EXCELLENCE, KOTHAKOTA" }) {
  return (
    <svg
      viewBox="0 0 300 300"
      preserveAspectRatio="xMidYMid meet"
      style={{
        width: '100%',
        height: '100%',
        opacity: '0.08 !important',
        filter: 'grayscale(100%)',
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact',
        display: 'block'
      }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <style>
          {`
            .watermark-circle { fill: none; stroke: #000000; stroke-width: 2; }
            .watermark-text { font-size: 14px; font-weight: bold; fill: #000000; letter-spacing: 1px; }
            .watermark-dot { fill: #000000; }
          `}
        </style>
        <path id="circlePath" d="M 40,150 A 110,110 0 0,1 260,150" fill="none" />
      </defs>

      {/* Outer circle */}
      <circle cx="150" cy="150" r="140" className="watermark-circle" />
      
      {/* Inner circle */}
      <circle cx="150" cy="150" r="130" className="watermark-circle" strokeWidth="1" />

      {/* Circular text */}
      <text className="watermark-text">
        <textPath href="#circlePath" startOffset="50%" textAnchor="middle">
          {schoolName}
        </textPath>
      </text>

      {/* Center decoration */}
      <circle cx="150" cy="150" r="8" className="watermark-dot" />

      {/* Side dots */}
      <circle cx="60" cy="150" r="3" className="watermark-dot" />
      <circle cx="240" cy="150" r="3" className="watermark-dot" />
      <circle cx="150" cy="60" r="3" className="watermark-dot" />
      <circle cx="150" cy="240" r="3" className="watermark-dot" />
    </svg>
  );
}