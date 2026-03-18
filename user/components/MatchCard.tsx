'use client';
import { useState } from 'react';
import styles from './MatchCard.module.css';

interface MatchedUser {
  id: string;
  name: string;
  role?: string;
  company?: string;
  linkedin?: string;
  looking_for?: string[];
  offering?: string[];
  interests?: string[];
}

interface Props {
  matchedUser: MatchedUser;
  reason: string;
  conversationStarter: string;
  isSaved: boolean;
  onSave: () => void;
  onGetLinkedIn: () => Promise<string>;
}

export default function MatchCard({
  matchedUser,
  reason,
  conversationStarter,
  isSaved,
  onSave,
  onGetLinkedIn,
}: Props) {
  const [showLinkedIn, setShowLinkedIn] = useState(false);
  const [linkedInMsg, setLinkedInMsg] = useState('');
  const [loadingMsg, setLoadingMsg] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showStarter, setShowStarter] = useState(false);

  const handleGetLinkedIn = async () => {
    if (linkedInMsg) {
      setShowLinkedIn(true);
      return;
    }
    setLoadingMsg(true);
    const msg = await onGetLinkedIn();
    setLinkedInMsg(msg);
    setShowLinkedIn(true);
    setLoadingMsg(false);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(linkedInMsg);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const initial = matchedUser.name.charAt(0).toUpperCase();
  const color = getColorFromName(matchedUser.name);

  return (
    <div className={styles.card}>
      {/* Profile header */}
      <div className={styles.profileHeader}>
        <div className={styles.avatar} style={{ background: color }}>
          {initial}
        </div>
        <div className={styles.profileInfo}>
          <h3 className={styles.name}>{matchedUser.name}</h3>
          {(matchedUser.role || matchedUser.company) && (
            <p className={styles.role}>
              {matchedUser.role}
              {matchedUser.role && matchedUser.company ? ' @ ' : ''}
              {matchedUser.company}
            </p>
          )}
          {matchedUser.linkedin && (
            <a
              href={matchedUser.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.linkedinLink}
            >
              LinkedIn Profile ↗
            </a>
          )}
        </div>
      </div>

      {/* Tags */}
      {matchedUser.interests && matchedUser.interests.length > 0 && (
        <div className={styles.tags}>
          {matchedUser.interests.slice(0, 4).map((t) => (
            <span key={t} className={styles.interestTag}>{t}</span>
          ))}
        </div>
      )}

      {/* Match reason */}
      {reason && (
        <div className={styles.reason}>
          <div className={styles.reasonLabel}>Why you matched</div>
          <p className={styles.reasonText}>{reason}</p>
        </div>
      )}

      {/* Conversation starter */}
      <button
        className={styles.starterToggle}
        onClick={() => setShowStarter(!showStarter)}
        type="button"
      >
        💬 {showStarter ? 'Hide' : 'Show'} conversation starter
      </button>
      {showStarter && (
        <div className={styles.starter}>
          <p>{conversationStarter}</p>
        </div>
      )}

      {/* Actions */}
      <div className={styles.actions}>
        <button
          className={isSaved ? styles.savedBtn : styles.saveBtn}
          onClick={onSave}
          disabled={isSaved}
          type="button"
        >
          {isSaved ? '✓ Connected' : '+ Save Connection'}
        </button>
        <button
          className={styles.linkedinBtn}
          onClick={handleGetLinkedIn}
          disabled={loadingMsg}
          type="button"
        >
          {loadingMsg ? <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : '📝 LinkedIn Message'}
        </button>
      </div>

      {/* LinkedIn message panel */}
      {showLinkedIn && linkedInMsg && (
        <div className={styles.linkedinPanel}>
          <div className={styles.linkedinPanelHeader}>
            <span>LinkedIn Follow-up Message</span>
            <button type="button" onClick={() => setShowLinkedIn(false)} className={styles.closeBtn}>✕</button>
          </div>
          <textarea
            className={styles.msgTextarea}
            value={linkedInMsg}
            onChange={(e) => setLinkedInMsg(e.target.value)}
            rows={5}
          />
          <button className={styles.copyBtn} onClick={handleCopy} type="button">
            {copied ? '✓ Copied to clipboard!' : 'Copy Message'}
          </button>
        </div>
      )}
    </div>
  );
}

function getColorFromName(name: string): string {
  const colors = [
    '#6c63ff', '#ff6384', '#36a2eb', '#ff9f40',
    '#4bc0c0', '#9966ff', '#ff6b6b', '#52d48c',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}
