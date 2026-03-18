/**
 * NetworkMatch - Matching Algorithm
 *
 * Priority order:
 * 1. Complementary: A's looking_for matches B's offering (and vice versa)
 * 2. Shared interests
 * 3. Similar role/company
 * 4. Random fallback
 *
 * Constraints:
 * - No repeat matches across rounds (within the same event)
 * - Everyone must be matched each round
 * - Prefer pairs; if odd number → one group of 3
 */

function intersection(a, b) {
  const setB = new Set(b.map((x) => x.toLowerCase()));
  return a.filter((x) => setB.has(x.toLowerCase()));
}

function computeScore(userA, userB) {
  let score = 0;
  const reasons = [];

  // 1. Complementary match: A's looking_for ∩ B's offering
  const aLooksForBOffers = intersection(userA.looking_for || [], userB.offering || []);
  const bLooksForAOffers = intersection(userB.looking_for || [], userA.offering || []);

  if (aLooksForBOffers.length > 0) {
    score += 10 * aLooksForBOffers.length;
    reasons.push(`${userA.name} is looking for ${aLooksForBOffers.join(', ')} — which ${userB.name} offers`);
  }
  if (bLooksForAOffers.length > 0) {
    score += 10 * bLooksForAOffers.length;
    reasons.push(`${userB.name} is looking for ${bLooksForAOffers.join(', ')} — which ${userA.name} offers`);
  }

  // 2. Shared interests
  const sharedInterests = intersection(userA.interests || [], userB.interests || []);
  if (sharedInterests.length > 0) {
    score += 5 * sharedInterests.length;
    reasons.push(`Shared interests: ${sharedInterests.join(', ')}`);
  }

  // 3. Similar role
  if (userA.role && userB.role && userA.role.toLowerCase() === userB.role.toLowerCase()) {
    score += 2;
    reasons.push(`Both are ${userA.role}s`);
  }

  // 4. Similar company (might want to meet)
  if (userA.company && userB.company && userA.company.toLowerCase() === userB.company.toLowerCase()) {
    score += 1;
    reasons.push(`Both from ${userA.company}`);
  }

  return { score, reasons };
}

function buildReasonString(reasons, score) {
  if (reasons.length === 0) return 'Serendipitous match — sometimes the best connections are unexpected!';
  return reasons.join('. ') + '.';
}

function generateConversationStarter(userA, userB) {
  const sharedInterests = intersection(userA.interests || [], userB.interests || []);
  const aLooksForBOffers = intersection(userA.looking_for || [], userB.offering || []);
  const bLooksForAOffers = intersection(userB.looking_for || [], userA.offering || []);

  if (aLooksForBOffers.length > 0) {
    return `${userA.name}, ask ${userB.name}: "How do you approach ${aLooksForBOffers[0]}? I've been exploring this area and would love your perspective."`;
  }
  if (bLooksForAOffers.length > 0) {
    return `${userB.name}, ask ${userA.name}: "What's your experience with ${bLooksForAOffers[0]}? I'm actively looking to learn more about it."`;
  }
  if (sharedInterests.length > 0) {
    return `You both share an interest in ${sharedInterests[0]}. Ask each other: "What's the most interesting thing you've discovered about ${sharedInterests[0]} recently?"`;
  }
  return `Start with: "What's the most exciting project you're working on right now?" — it's a great way to find unexpected connections.`;
}

/**
 * Main matching function
 * @param {Array} participants - Array of user objects
 * @param {Array} previousMatches - Array of {user1_id, user2_id} from previous rounds
 * @returns {Array} Array of match objects
 */
function runMatchingAlgorithm(participants, previousMatches = []) {
  if (participants.length === 0) return [];
  if (participants.length === 1) {
    return [{
      user1_id: participants[0].id,
      user2_id: null,
      user3_id: null,
      reason: 'Waiting for more participants to join.',
      conversation_starter: 'Network with the group!',
    }];
  }

  // Build set of already-matched pairs (within this event)
  const matchedPairs = new Set();
  for (const m of previousMatches) {
    const key1 = `${m.user1_id}|${m.user2_id}`;
    const key2 = `${m.user2_id}|${m.user1_id}`;
    matchedPairs.add(key1);
    matchedPairs.add(key2);
    if (m.user3_id) {
      matchedPairs.add(`${m.user1_id}|${m.user3_id}`);
      matchedPairs.add(`${m.user3_id}|${m.user1_id}`);
      matchedPairs.add(`${m.user2_id}|${m.user3_id}`);
      matchedPairs.add(`${m.user3_id}|${m.user2_id}`);
    }
  }

  function alreadyMatched(a, b) {
    return matchedPairs.has(`${a}|${b}`) || matchedPairs.has(`${b}|${a}`);
  }

  // Build scored candidate pairs
  const n = participants.length;
  const scoredPairs = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const { score, reasons } = computeScore(participants[i], participants[j]);
      scoredPairs.push({
        i,
        j,
        score: alreadyMatched(participants[i].id, participants[j].id) ? score - 1000 : score,
        reasons,
      });
    }
  }
  // Sort by score descending
  scoredPairs.sort((a, b) => b.score - a.score);

  const matched = new Array(n).fill(false);
  const resultMatches = [];

  for (const pair of scoredPairs) {
    if (!matched[pair.i] && !matched[pair.j]) {
      matched[pair.i] = true;
      matched[pair.j] = true;

      const userA = participants[pair.i];
      const userB = participants[pair.j];
      const reason = buildReasonString(pair.reasons, pair.score);
      const conversationStarter = generateConversationStarter(userA, userB);

      resultMatches.push({
        user1_id: userA.id,
        user2_id: userB.id,
        user3_id: null,
        reason,
        conversation_starter: conversationStarter,
      });
    }
  }

  // Handle odd person out — add to an existing match as group of 3
  const unmatchedIndices = matched
    .map((m, i) => (m ? null : i))
    .filter((i) => i !== null);

  for (const idx of unmatchedIndices) {
    const loner = participants[idx];
    // Find the best existing match to absorb the loner
    let bestMatchIdx = 0;
    let bestScore = -Infinity;
    for (let k = 0; k < resultMatches.length; k++) {
      if (resultMatches[k].user3_id !== null) continue; // already a group of 3
      const u1 = participants.find((p) => p.id === resultMatches[k].user1_id);
      const u2 = participants.find((p) => p.id === resultMatches[k].user2_id);
      const { score: s1 } = computeScore(loner, u1);
      const { score: s2 } = computeScore(loner, u2);
      const combined = s1 + s2;
      if (combined > bestScore) {
        bestScore = combined;
        bestMatchIdx = k;
      }
    }
    const target = resultMatches[bestMatchIdx];
    target.user3_id = loner.id;
    const u1 = participants.find((p) => p.id === target.user1_id);
    const u2 = participants.find((p) => p.id === target.user2_id);
    target.reason += ` ${loner.name} joins this group to form a trio.`;
    target.conversation_starter = `As a group, discuss: "What's one skill or resource you wish you had more of right now?"`;
  }

  return resultMatches;
}

module.exports = { runMatchingAlgorithm };
