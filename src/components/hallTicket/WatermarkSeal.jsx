export default function WatermarkSeal({ schoolName = "BVM SCHOOL OF EXCELLENCE, KOTHAKOTA" }) {
  return (
    <svg
      viewBox="0 0 300 300"
      preserveAspectRatio="xMidYMid meet"
      width="300"
      height="300"
      style={{
        width: '100%',
        height: '100%',
        display: 'block'
      }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <path id="circlePath" d="M 40,150 A 110,110 0 0,1 260,150" fill="none" />
      </defs>

      {/* Outer circle */}
      <circle cx="150" cy="150" r="140" fill="none" stroke="#333333" strokeWidth="3" />
      
      {/* Inner circle */}
      <circle cx="150" cy="150" r="130" fill="none" stroke="#333333" strokeWidth="1.5" />

      {/* Circular text */}
      <text fontSize="16" fontWeight="bold" letterSpacing="1" fill="#333333">
        <textPath href="#circlePath" startOffset="50%" textAnchor="middle">
          {schoolName}
        </textPath>
      </text>

      {/* Center decoration */}
      <circle cx="150" cy="150" r="10" fill="#333333" />

      {/* Side dots */}
      <circle cx="60" cy="150" r="4" fill="#333333" />
      <circle cx="240" cy="150" r="4" fill="#333333" />
      <circle cx="150" cy="60" r="4" fill="#333333" />
      <circle cx="150" cy="240" r="4" fill="#333333" />
    </svg>
  );
}