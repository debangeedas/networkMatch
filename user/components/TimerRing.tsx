'use client';
import styles from './TimerRing.module.css';

interface Props {
  remaining: number;
  total: number;
}

export default function TimerRing({ remaining, total }: Props) {
  const percent = total > 0 ? remaining / total : 1;
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - percent);

  const isUrgent = remaining <= 30;
  const isWarning = remaining <= 60 && remaining > 30;

  const m = Math.floor(remaining / 60).toString().padStart(2, '0');
  const s = (remaining % 60).toString().padStart(2, '0');

  return (
    <div className={styles.container} data-urgent={isUrgent ? 'true' : 'false'}>
      <svg width="56" height="56" viewBox="0 0 56 56">
        <circle
          cx="28" cy="28" r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth="3"
        />
        <circle
          cx="28" cy="28" r={radius}
          fill="none"
          stroke={isUrgent ? 'var(--danger)' : isWarning ? 'var(--warning)' : 'var(--accent)'}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform="rotate(-90 28 28)"
          style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}
        />
      </svg>
      <div className={styles.time} data-urgent={isUrgent ? 'true' : 'false'}>
        {m}:{s}
      </div>
    </div>
  );
}
