'use client';
import styles from './ParticipantList.module.css';

interface Participant {
  id: string;
  name: string;
  role?: string;
  company?: string;
  linkedin?: string;
  looking_for?: string[];
  offering?: string[];
  joined_at: string;
  is_active?: boolean;
}

interface Props {
  participants: Participant[];
}

export default function ParticipantList({ participants }: Props) {
  if (participants.length === 0) {
    return (
      <div className={styles.empty}>
        <span className={styles.emptyIcon}>👥</span>
        <p>Waiting for participants to scan the QR code...</p>
      </div>
    );
  }

  const active = participants.filter((p) => p.is_active).length;

  return (
    <>
      <div className={styles.summary}>
        <span className={styles.summaryActive}>{active} active</span>
        <span className={styles.summarySep}>·</span>
        <span className={styles.summaryTotal}>{participants.length} total</span>
      </div>
      <div className={styles.list}>
        {participants.map((p) => (
          <div key={p.id} className={`${styles.item} ${!p.is_active ? styles.itemInactive : ''}`}>
            <div className={styles.avatarWrap}>
              <div className={styles.avatar}>{p.name.charAt(0).toUpperCase()}</div>
              <span className={styles.activeDot} data-active={p.is_active ? 'true' : 'false'} />
            </div>
            <div className={styles.info}>
              <div className={styles.name}>{p.name}</div>
              <div className={styles.meta}>
                {p.role && <span>{p.role}</span>}
                {p.company && <span>@ {p.company}</span>}
              </div>
              {(p.looking_for?.length || p.offering?.length) ? (
                <div className={styles.tags}>
                  {p.looking_for?.slice(0, 2).map((t) => (
                    <span key={t} className={`${styles.tag} ${styles.tagLooking}`}>Looking: {t}</span>
                  ))}
                  {p.offering?.slice(0, 2).map((t) => (
                    <span key={t} className={`${styles.tag} ${styles.tagOffering}`}>Offers: {t}</span>
                  ))}
                </div>
              ) : null}
            </div>
            <div className={styles.joined}>
              {new Date(p.joined_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
