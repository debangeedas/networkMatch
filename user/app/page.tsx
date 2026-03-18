import Link from 'next/link';
import styles from './page.module.css';

export default function HomePage() {
  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.logo}>N</div>
        <h1 className={styles.title}>NetworkMatch</h1>
        <p className={styles.subtitle}>
          Scan the QR code at your event to get started and connect with people who matter.
        </p>
        <div className={styles.hint}>
          <span>📱</span>
          <span>Ask the event host for the QR code or join link</span>
        </div>
      </div>
    </div>
  );
}
