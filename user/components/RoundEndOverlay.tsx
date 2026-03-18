'use client';
import { useState } from 'react';
import styles from './RoundEndOverlay.module.css';

interface Props {
  message: string;
  match: any;
  savedConnections: Set<string>;
  onSave: (userId: string) => void;
  onGetLinkedIn: (user: any) => Promise<string>;
  onDismiss: () => void;
  onGoToLobby: () => void;
}

export default function RoundEndOverlay({
  message,
  match,
  savedConnections,
  onSave,
  onGetLinkedIn,
  onDismiss,
  onGoToLobby,
}: Props) {
  const [linkedInMsgs, setLinkedInMsgs] = useState<Record<string, string>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleLinkedIn = async (user: any) => {
    if (linkedInMsgs[user.id]) return;
    setLoadingId(user.id);
    const msg = await onGetLinkedIn(user);
    setLinkedInMsgs((prev) => ({ ...prev, [user.id]: msg }));
    setLoadingId(null);
  };

  const handleCopy = async (userId: string) => {
    await navigator.clipboard.writeText(linkedInMsgs[userId]);
    setCopiedId(userId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.panel}>
        <button className={styles.dismissBtn} onClick={onDismiss} type="button" aria-label="Dismiss">
          ✕
        </button>
        <div className={styles.celebration}>🎉</div>
        <h2 className={styles.title}>Round Complete!</h2>
        <p className={styles.message}>{message}</p>

        {match?.matched_users?.length > 0 && (
          <div className={styles.connections}>
            <h3 className={styles.connectionsTitle}>Connect with your match{match.matched_users.length > 1 ? 'es' : ''}</h3>
            {match.matched_users.map((user: any) => (
              <div key={user.id} className={styles.connectionRow}>
                <div className={styles.connInfo}>
                  <div className={styles.connAvatar}>{user.name.charAt(0)}</div>
                  <div>
                    <div className={styles.connName}>{user.name}</div>
                    {user.role && <div className={styles.connRole}>{user.role}</div>}
                  </div>
                </div>
                <div className={styles.connActions}>
                  <button
                    className={savedConnections.has(user.id) ? styles.savedBtn : styles.saveBtn}
                    onClick={() => onSave(user.id)}
                    disabled={savedConnections.has(user.id)}
                    type="button"
                  >
                    {savedConnections.has(user.id) ? '✓ Saved' : 'Save'}
                  </button>
                  <button
                    className={styles.linkedinBtn}
                    onClick={() => handleLinkedIn(user)}
                    disabled={loadingId === user.id}
                    type="button"
                  >
                    {loadingId === user.id ? '...' : '📝'}
                  </button>
                </div>
                {linkedInMsgs[user.id] && (
                  <div className={styles.msgBox}>
                    <p className={styles.msgText}>{linkedInMsgs[user.id]}</p>
                    <button className={styles.copyBtn} onClick={() => handleCopy(user.id)} type="button">
                      {copiedId === user.id ? '✓ Copied!' : 'Copy Message'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <button className="btn-primary" onClick={onGoToLobby} style={{ marginTop: 8 }} type="button">
          Back to Lobby
        </button>
      </div>
    </div>
  );
}
