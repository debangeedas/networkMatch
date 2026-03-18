'use client';
import { useState } from 'react';
import styles from './QRDisplay.module.css';

interface Props {
  qr: string;
  joinUrl: string;
}

export default function QRDisplay({ qr, joinUrl }: Props) {
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    await navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadQR = () => {
    const a = document.createElement('a');
    a.href = qr;
    a.download = 'networkmatch-qr.png';
    a.click();
  };

  return (
    <div className={styles.container}>
      <img src={qr} alt="Event QR Code" className={styles.qrImage} />
      <p className={styles.hint}>Scan to join the event</p>
      <div className={styles.urlBox}>{joinUrl}</div>
      <div className={styles.actions}>
        <button className="btn-secondary" onClick={copyLink} style={{ flex: 1 }}>
          {copied ? '✓ Copied!' : 'Copy Link'}
        </button>
        <button className="btn-secondary" onClick={downloadQR} style={{ flex: 1 }}>
          Download QR
        </button>
      </div>
    </div>
  );
}
