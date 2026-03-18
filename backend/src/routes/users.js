const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { userAuth } = require('../middleware/auth');
const { generateLinkedInMessage } = require('../ai/generator');

const router = express.Router();

// POST /api/users/join — Join event and create/update profile
router.post('/join', async (req, res) => {
  const { event_id, name, linkedin, role, company, looking_for, offering, interests, user_id } = req.body;

  if (!event_id) return res.status(400).json({ error: 'event_id required' });
  if (!name && !user_id) return res.status(400).json({ error: 'name required for new users' });

  try {
    // Verify event exists
    const eventResult = await db.query('SELECT id, status FROM events WHERE id = $1', [event_id]);
    if (eventResult.rows.length === 0) return res.status(404).json({ error: 'Event not found' });

    let userId = user_id;

    if (userId) {
      // Returning user — optionally update profile
      const updateResult = await db.query(
        `UPDATE users SET
          name = COALESCE($1, name),
          linkedin = COALESCE($2, linkedin),
          role = COALESCE($3, role),
          company = COALESCE($4, company),
          looking_for = COALESCE($5, looking_for),
          offering = COALESCE($6, offering),
          interests = COALESCE($7, interests)
         WHERE id = $8 RETURNING *`,
        [name, linkedin, role, company, looking_for, offering, interests, userId]
      );
      if (updateResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    } else {
      // New user — create profile
      const createResult = await db.query(
        `INSERT INTO users (name, linkedin, role, company, looking_for, offering, interests)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [
          name,
          linkedin || null,
          role || null,
          company || null,
          looking_for || [],
          offering || [],
          interests || [],
        ]
      );
      userId = createResult.rows[0].id;
    }

    // Add to event participants (ignore if already joined)
    await db.query(
      'INSERT INTO event_participants (user_id, event_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [userId, event_id]
    );

    // Issue user token
    const token = jwt.sign({ id: userId, role: 'user' }, process.env.JWT_SECRET, { expiresIn: '24h' });

    const userResult = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
    const user = userResult.rows[0];

    return res.json({ token, user });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/users/me — Get own profile (user)
router.get('/me', userAuth, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    return res.json(result.rows[0]);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/users/me — Update own profile (user)
router.put('/me', userAuth, async (req, res) => {
  const { name, linkedin, role, company, looking_for, offering, interests } = req.body;
  try {
    const result = await db.query(
      `UPDATE users SET
        name = COALESCE($1, name),
        linkedin = COALESCE($2, linkedin),
        role = COALESCE($3, role),
        company = COALESCE($4, company),
        looking_for = COALESCE($5, looking_for),
        offering = COALESCE($6, offering),
        interests = COALESCE($7, interests)
       WHERE id = $8 RETURNING *`,
      [name, linkedin, role, company, looking_for, offering, interests, req.user.id]
    );
    return res.json(result.rows[0]);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/users/linkedin-message — Generate LinkedIn follow-up (user)
router.post('/linkedin-message', userAuth, async (req, res) => {
  const { to_user_id, match_reason } = req.body;
  try {
    const fromResult = await db.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    const toResult = await db.query('SELECT * FROM users WHERE id = $1', [to_user_id]);

    if (fromResult.rows.length === 0 || toResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const message = generateLinkedInMessage(fromResult.rows[0], toResult.rows[0], match_reason);
    return res.json({ message });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
