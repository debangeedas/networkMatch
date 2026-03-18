'use client';
import styles from './Compass.module.css';

interface CompassProps {
  bearing: number | null;       // geographic direction from user → match (0–360, 0=north)
  deviceHeading: number | null; // direction device is facing (0–360, 0=north)
  distance: number | null;      // metres to match
  matchName: string;
  matchRole?: string;
  matchCompany?: string;
  found: boolean;
  locationDenied: boolean;
  onSkip: () => void;
}

function getHeatColor(distance: number | null): string {
  if (distance === null) return '#6B7280';
  if (distance <  8)  return '#22C55E';  // green  — found
  if (distance < 15)  return '#EA580C';  // deep orange — very hot
  if (distance < 30)  return '#F97316';  // orange      — hot
  if (distance < 60)  return '#FBBF24';  // amber       — warm
  if (distance < 100) return '#93C5FD';  // light blue  — cool
  return '#3B82F6';                      // blue        — cold
}

function getHeatLabel(distance: number | null): string {
  if (distance === null) return 'Searching…';
  if (distance <  8)  return 'Found!';
  if (distance < 15)  return 'Very Hot 🔥';
  if (distance < 30)  return 'Hot ♨️';
  if (distance < 60)  return 'Warm 🌡️';
  if (distance < 100) return 'Cool 💧';
  return 'Cold 🧊';
}

function formatDistance(distance: number | null): string {
  if (distance === null) return '—';
  if (distance < 1000) return `${Math.round(distance)}m`;
  return `${(distance / 1000).toFixed(1)}km`;
}

export default function Compass({
  bearing,
  deviceHeading,
  distance,
  matchName,
  matchRole,
  matchCompany,
  found,
  locationDenied,
  onSkip,
}: CompassProps) {
  const heatColor = getHeatColor(distance);
  const heatLabel = getHeatLabel(distance);
  const distanceText = formatDistance(distance);
  const isFound = found || (distance !== null && distance < 8);

  // Needle angle on screen: bearing relative to device facing direction.
  // If deviceHeading unavailable, fall back to north-up (static bearing).
  // If neither available, spin the needle to indicate "searching".
  let needleAngle = 0;
  let spin = false;

  if (bearing !== null && deviceHeading !== null) {
    needleAngle = (bearing - deviceHeading + 360) % 360;
  } else if (bearing !== null) {
    needleAngle = bearing;
  } else {
    spin = true;
  }

  const needleStyle: React.CSSProperties = spin
    ? {}
    : {
        transform: `rotate(${needleAngle}deg)`,
        transformOrigin: '100px 100px',
        transition: 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
      };

  return (
    <div className={styles.overlay}>

      {/* Who you're looking for */}
      <div className={styles.lookingFor}>
        <span className={styles.lookingLabel}>Looking for</span>
        <span className={styles.lookingName}>{matchName}</span>
        {(matchRole || matchCompany) && (
          <span className={styles.lookingRole}>
            {matchRole}{matchCompany ? ` @ ${matchCompany}` : ''}
          </span>
        )}
      </div>

      {/* Compass dial */}
      <div className={styles.compassWrap}>
        <div
          className={styles.glow}
          style={{ background: `radial-gradient(circle, ${heatColor}30 0%, transparent 70%)` }}
        />

        <svg viewBox="0 0 200 200" className={styles.compassSvg} aria-label="Compass">
          {/* Outer ring */}
          <circle cx="100" cy="100" r="94" fill="none" stroke={heatColor} strokeWidth="5" opacity="0.9" />

          {/* Tick marks every 30° */}
          {Array.from({ length: 12 }, (_, i) => {
            const rad = (i * 30) * Math.PI / 180;
            const inner = i % 3 === 0 ? 79 : 84;
            return (
              <line
                key={i}
                x1={100 + Math.sin(rad) * inner}
                y1={100 - Math.cos(rad) * inner}
                x2={100 + Math.sin(rad) * 90}
                y2={100 - Math.cos(rad) * 90}
                stroke="#374151"
                strokeWidth={i % 3 === 0 ? 2 : 1}
              />
            );
          })}

          {/* Face */}
          <circle cx="100" cy="100" r="76" fill="#0F172A" />

          {/* Cardinal letters */}
          <text x="100" y="27" textAnchor="middle" fill="#9CA3AF" fontSize="13" fontWeight="700">N</text>
          <text x="173" y="105" textAnchor="middle" fill="#4B5563" fontSize="11" fontWeight="600">E</text>
          <text x="100" y="180" textAnchor="middle" fill="#4B5563" fontSize="11" fontWeight="600">S</text>
          <text x="27"  y="105" textAnchor="middle" fill="#4B5563" fontSize="11" fontWeight="600">W</text>

          {/* Needle */}
          <g style={needleStyle} className={spin ? styles.spinNeedle : undefined}>
            {/* Tip — points toward match */}
            <polygon points="100,32 93,102 107,102" fill={heatColor} opacity="0.95" />
            {/* Tail — opposite */}
            <polygon points="100,168 93,102 107,102" fill="#374151" opacity="0.75" />
          </g>

          {/* Centre dot */}
          <circle cx="100" cy="100" r="9"  fill="#0F172A" stroke={heatColor} strokeWidth="2.5" />
          <circle cx="100" cy="100" r="4.5" fill={heatColor} />
        </svg>
      </div>

      {/* Distance + heat label */}
      <div className={styles.readout}>
        <span className={styles.distanceNum} style={{ color: heatColor }}>
          {distanceText}
        </span>
        <span className={styles.heatLabel} style={{ color: heatColor }}>
          {heatLabel}
        </span>
      </div>

      {/* Hints */}
      {!deviceHeading && !spin && (
        <p className={styles.hint}>Compass direction unavailable — hot/cold distance still works</p>
      )}
      {locationDenied && (
        <p className={styles.hint}>Location access denied — allow it to activate the compass</p>
      )}

      {/* Found overlay */}
      {isFound && (
        <div className={styles.foundOverlay}>
          <div className={styles.foundEmoji}>🎯</div>
          <div className={styles.foundText}>You found them!</div>
          <button className={styles.foundBtn} onClick={onSkip}>
            See Match Details →
          </button>
        </div>
      )}

      {/* Skip */}
      {!isFound && (
        <button className={styles.skipBtn} onClick={onSkip}>
          Skip — show match details
        </button>
      )}
    </div>
  );
}
