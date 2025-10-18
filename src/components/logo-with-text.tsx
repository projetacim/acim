import type { SVGProps } from 'react';

export function LogoWithText(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 200 250"
      {...props}
    >
      <defs>
        <path
          id="wreath-leaf"
          d="M10,0 C0,10 0,20 10,30 C20,20 20,10 10,0 Z"
          fill="currentColor"
        />
      </defs>
      <g transform="translate(100, 100)">
        {/* Star of David */}
        <g stroke="currentColor" strokeWidth="6" fill="none">
          <polygon points="0,-60 52,-30 0,0" />
          <polygon points="0,-60 -52,-30 0,0" />
          <polygon points="0,60 52,30 0,0" />
          <polygon points="0,60 -52,30 0,0" />
          <polygon points="0,-60 52,-30 -52,30 0,60 -52,30 52,30 0,-60" stroke="none" fill="currentColor" />
          <polygon points="0,-48 41.5,-24 -41.5,24 0,48 -41.5,24 41.5,-24 0,-48" stroke="white" strokeWidth="3" />
        </g>
        
        {/* Laurel Wreath */}
        <g transform="scale(1.2)">
            <g transform="scale(-1, 1)">
              <g transform="translate(-10, -80) rotate(-20)">
                {[...Array(6)].map((_, i) => (
                  <use key={`left-${i}`} href="#wreath-leaf" transform={`translate(0, ${i * 25}) rotate(${i * 5})`} />
                ))}
              </g>
            </g>
            <g transform="translate(-10, -80) rotate(20)">
              {[...Array(6)].map((_, i) => (
                <use key={`right-${i}`} href="#wreath-leaf" transform={`translate(0, ${i * 25}) rotate(${-i * 5})`} />
              ))}
            </g>
        </g>
      </g>
      <text
        x="50%"
        y="225"
        dominantBaseline="middle"
        textAnchor="middle"
        fill="currentColor"
        fontSize="50"
        fontFamily="sans-serif"
        fontWeight="bold"
        letterSpacing="10"
      >
        ACIM
      </text>
    </svg>
  );
}