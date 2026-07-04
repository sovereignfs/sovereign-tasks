import styles from './ProgressRing.module.css';

interface Props {
  done: number;
  total: number;
}

const R = 7;
const CIRC = 2 * Math.PI * R;

/** Small monochrome donut showing subtask completion, with an n/m label. */
export default function ProgressRing({ done, total }: Props) {
  const frac = total > 0 ? Math.min(done / total, 1) : 0;
  const filled = CIRC * frac;

  return (
    <span className={styles.root} aria-label={`${done} of ${total} subtasks done`}>
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
        <circle cx="9" cy="9" r={R} fill="none" stroke="var(--sv-color-border)" strokeWidth="2.5" />
        <circle
          cx="9"
          cy="9"
          r={R}
          fill="none"
          stroke="var(--sv-color-accent)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${CIRC - filled}`}
          transform="rotate(-90 9 9)"
        />
      </svg>
      <span className={styles.label}>
        {done}/{total}
      </span>
    </span>
  );
}
