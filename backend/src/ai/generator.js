/**
 * Lightweight AI-style generators for NetworkMatch
 * Uses template-based generation — no external API required.
 */

function generateLinkedInMessage(fromUser, toUser, matchReason) {
  const intro = `Hi ${toUser.name}`;
  const context = `We were matched at a recent networking event`;
  const hook = matchReason && matchReason.length < 200 ? matchReason : `we had great synergy based on our backgrounds`;
  const cta = `I'd love to stay connected and continue the conversation.`;

  return `${intro}, ${context} — ${hook}. ${cta}\n\nBest,\n${fromUser.name}`;
}

function generateMatchExplanation(userA, userB, rawReason) {
  if (rawReason && rawReason !== 'Serendipitous match — sometimes the best connections are unexpected!') {
    return rawReason;
  }

  const parts = [];

  if (userA.role && userB.role) {
    if (userA.role === userB.role) {
      parts.push(`Both of you are ${userA.role}s — you'll likely speak the same professional language.`);
    } else {
      parts.push(`${userA.name} is a ${userA.role} and ${userB.name} is a ${userB.role} — a cross-functional connection opportunity.`);
    }
  }

  if (userA.company && userB.company && userA.company !== userB.company) {
    parts.push(`Coming from ${userA.company} and ${userB.company} gives you diverse organizational perspectives.`);
  }

  parts.push(`This is a serendipitous match — sometimes the most valuable connections are the unexpected ones!`);

  return parts.join(' ');
}

module.exports = { generateLinkedInMessage, generateMatchExplanation };
