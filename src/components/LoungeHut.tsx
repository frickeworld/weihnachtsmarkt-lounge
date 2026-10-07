import { useId } from 'react';

/** LED-Punkte gleichmäßig auf einer Strecke verteilen. */
function bulbsOnLine(x1: number, y1: number, x2: number, y2: number, n: number) {
  return Array.from({ length: n }, (_, i) => {
    const t = n === 1 ? 0.5 : i / (n - 1);
    return { x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t };
  });
}

/**
 * Illustration der Lounge-Hütte: Holzhütte im Weihnachtsmarkt-Stil mit LED-Kette an Dach und
 * Giebel, warmem Bernstein-Licht innen, Tafel mit Bänken und leichtem Schneefall.
 * Reine Vektorgrafik (keine Bildrechte, sofort geladen). LEDs funkeln und Schnee fällt nur ohne
 * „Bewegung reduzieren“.
 */
export function LoungeHut({ className = '' }: { className?: string }) {
  const id = useId().replace(/:/g, '');
  const roofLeft = bulbsOnLine(96, 196, 400, 52, 14);
  const roofRight = bulbsOnLine(400, 52, 704, 196, 14);
  const eave = bulbsOnLine(150, 214, 650, 214, 18);
  const flakes = Array.from({ length: 34 }, (_, i) => ({
    x: (i * 97) % 800,
    y: (i * 53) % 300,
    r: 1.2 + ((i * 7) % 3) * 0.7,
    d: 6 + ((i * 5) % 7),
    delay: -((i * 13) % 11),
  }));

  return (
    <svg
      viewBox="0 0 800 440"
      className={className}
      role="img"
      aria-labelledby={`${id}-t`}
      preserveAspectRatio="xMidYMid slice"
    >
      <title id={`${id}-t`}>
        Illustration: beleuchtete Holzhütte der Lounge auf dem Weihnachtsmarkt mit langer Tafel,
        warmem orangenem Licht und Lichterkette am Dach
      </title>
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#141311" />
          <stop offset="0.65" stopColor="#24221E" />
          <stop offset="1" stopColor="#3a2a1c" />
        </linearGradient>
        <radialGradient id={`${id}-glow`} cx="0.5" cy="0.55" r="0.6">
          <stop offset="0" stopColor="#FFC977" stopOpacity="0.95" />
          <stop offset="0.45" stopColor="#E8892B" stopOpacity="0.85" />
          <stop offset="1" stopColor="#8A3F0E" stopOpacity="0.9" />
        </radialGradient>
        <radialGradient id={`${id}-halo`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#E8892B" stopOpacity="0.45" />
          <stop offset="1" stopColor="#E8892B" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-wood`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6b4426" />
          <stop offset="1" stopColor="#4a2e19" />
        </linearGradient>
        <pattern id={`${id}-planks`} width="800" height="16" patternUnits="userSpaceOnUse">
          <rect width="800" height="16" fill={`url(#${id}-wood)`} />
          <path d="M0 15.5H800" stroke="#3a2414" strokeWidth="1.5" />
        </pattern>
      </defs>

      {/* Himmel, Sterne, Bokeh des Marktes */}
      <rect width="800" height="440" fill={`url(#${id}-sky)`} />
      {[60, 180, 520, 610, 740].map((x, i) => (
        <circle key={x} cx={x} cy={30 + ((i * 37) % 70)} r="1.3" fill="#F8F3E8" opacity="0.7" />
      ))}
      {[
        [40, 300, 26, '#E8892B'],
        [110, 270, 18, '#E8D6A8'],
        [690, 280, 22, '#E8892B'],
        [760, 250, 16, '#E8D6A8'],
        [20, 230, 12, '#C6A45C'],
        [780, 330, 20, '#C6A45C'],
      ].map(([x, y, r, c]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill={c as string} opacity="0.22" />
      ))}

      {/* Lichtschein */}
      <ellipse cx="400" cy="330" rx="330" ry="120" fill={`url(#${id}-halo)`} />

      {/* Boden mit Schnee */}
      <path d="M0 380 Q200 362 400 372 T800 376 V440 H0Z" fill="#E9E4DA" />
      <path d="M0 392 Q220 380 420 388 T800 390 V440 H0Z" fill="#F8F3E8" />

      {/* Tannen links und rechts */}
      {[
        [70, 382, 1],
        [735, 384, 1.1],
      ].map(([x, y, s]) => (
        <g key={x} transform={`translate(${x} ${y}) scale(${s})`}>
          <rect x="-5" y="-14" width="10" height="16" fill="#3a2414" />
          <path d="M0 -120 L-34 -60 H-18 L-44 -14 H44 L18 -60 H34Z" fill="#1F3A2E" />
          <path d="M0 -120 L-14 -96 L0 -100 L14 -96Z" fill="#F8F3E8" opacity="0.85" />
        </g>
      ))}

      {/* Hütte: Wände */}
      <rect x="150" y="196" width="500" height="182" fill={`url(#${id}-planks)`} />
      {/* Öffnung mit warmem Licht */}
      <rect x="196" y="226" width="408" height="150" rx="6" fill={`url(#${id}-glow)`} />
      {/* Rückwand-Details: Girlande innen */}
      <path
        d="M206 238 Q300 262 400 240 T594 238"
        fill="none"
        stroke="#2c4a33"
        strokeWidth="7"
        strokeLinecap="round"
      />
      {[250, 320, 400, 480, 550].map((x) => (
        <circle key={x} cx={x} cy={248 + (x % 3)} r="4" fill="#C6A45C" />
      ))}
      {/* Laternen */}
      {[240, 560].map((x) => (
        <g key={x}>
          <path d={`M${x} 226 V250`} stroke="#3a2414" strokeWidth="2" />
          <rect x={x - 9} y="250" width="18" height="24" rx="3" fill="#3a2414" />
          <rect x={x - 6} y="254" width="12" height="16" rx="2" fill="#FFD48A" />
        </g>
      ))}

      {/* Tafel und Bänke */}
      <rect x="236" y="318" width="328" height="12" rx="3" fill="#5a3820" />
      <rect x="252" y="330" width="8" height="40" fill="#4a2e19" />
      <rect x="540" y="330" width="8" height="40" fill="#4a2e19" />
      <rect x="214" y="346" width="372" height="9" rx="3" fill="#6b4426" />
      {/* Felle auf der Bank */}
      {[250, 330, 420, 500].map((x) => (
        <ellipse key={x} cx={x} cy="345" rx="26" ry="7" fill="#F3EBDC" opacity="0.9" />
      ))}
      {/* Decken in Orange */}
      <path d="M300 340 h44 l-6 18 h-34Z" fill="#E8892B" />
      <path d="M460 340 h44 l-6 18 h-34Z" fill="#C8651B" />
      {/* Kerzen und Becher auf dem Tisch */}
      {[290, 370, 430, 510].map((x, i) => (
        <g key={x}>
          {i % 2 === 0 ? (
            <>
              <rect x={x - 3} y="300" width="6" height="18" fill="#F8F3E8" />
              <path
                className="hut-flame"
                style={{ transformOrigin: `${x}px 300px`, animationDelay: `${i * 0.4}s` }}
                d={`M${x} 288 c3 5 3 8 0 12 c-3 -4 -3 -7 0 -12z`}
                fill="#FFC24D"
              />
            </>
          ) : (
            <>
              <rect x={x - 7} y="304" width="14" height="14" rx="2" fill="#A8221C" />
              <path d={`M${x + 7} 307 q6 4 0 8`} fill="none" stroke="#A8221C" strokeWidth="2" />
            </>
          )}
        </g>
      ))}

      {/* Dach */}
      <path d="M96 204 L400 52 L704 204 L668 214 L400 80 L132 214Z" fill="#3a2414" />
      <path d="M132 214 L400 80 L668 214Z" fill="#5a3820" />
      {/* Schnee auf dem Dach */}
      <path
        d="M96 204 L400 52 L704 204 L690 200 Q640 186 600 174 Q560 160 520 140 Q470 118 430 96 L400 80 L370 96 Q330 118 280 140 Q240 160 200 174 Q160 186 110 200Z"
        fill="#F8F3E8"
      />
      {/* Giebel-Schild */}
      <rect x="350" y="128" width="100" height="40" rx="6" fill="#24221E" />
      <rect
        x="354"
        y="132"
        width="92"
        height="32"
        rx="4"
        fill="none"
        stroke="#C6A45C"
        strokeWidth="1.5"
      />
      <text
        x="400"
        y="154"
        textAnchor="middle"
        fontFamily="Jost, sans-serif"
        fontSize="16"
        fontWeight="500"
        fill="#E8D6A8"
        letterSpacing="2"
      >
        LOUNGE
      </text>

      {/* LED-Kette an Dachkanten und Traufe */}
      <g>
        {[...roofLeft, ...roofRight, ...eave].map((b, i) => (
          <g key={i}>
            <circle cx={b.x} cy={b.y + 6} r="7" fill="#FFE2A8" opacity="0.18" />
            <circle
              className="hut-led"
              style={{ animationDelay: `${(i % 7) * 0.35}s` }}
              cx={b.x}
              cy={b.y + 6}
              r="3"
              fill={i % 3 === 0 ? '#FFB347' : '#FFF1C9'}
            />
          </g>
        ))}
      </g>

      {/* Schneefall */}
      <g className="hut-snow">
        {flakes.map((f, i) => (
          <circle
            key={i}
            cx={f.x}
            cy={f.y}
            r={f.r}
            fill="#F8F3E8"
            opacity="0.8"
            style={{ animationDuration: `${f.d}s`, animationDelay: `${f.delay}s` }}
          />
        ))}
      </g>
    </svg>
  );
}
