const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { userAuth } = require('../middleware/auth');
const { generateLinkedInMessage } = require('../ai/generator');
const { sendOTP } = require('../lib/email');

const router = express.Router();

// POST /api/users/lookup — Check if email exists
router.post('/lookup', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'email required' });
  try {
    const result = await db.query(
      'SELECT name, role, company FROM users WHERE email = $1',
      [email.toLowerCase()]
    );
    if (result.rows.length === 0) return res.json({ exists: false });
    const { name, role, company } = result.rows[0];
    return res.json({ exists: true, name, role, company });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/users/login — Email + password login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  try {
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
    const user = result.rows[0];
    if (!user.password_hash) return res.status(401).json({ error: 'Invalid credentials' });
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id, role: 'user' }, process.env.JWT_SECRET, { expiresIn: '30d' });
    const { password_hash, otp_code, otp_expires_at, ...safeUser } = user;
    return res.json({ token, user: safeUser });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/users/otp/send — Send OTP to email
router.post('/otp/send', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'email required' });
  try {
    const result = await db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (result.rows.length === 0) return res.status(400).json({ error: 'No account found with that email' });
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 10 * 60 * 1000);
    await db.query(
      'UPDATE users SET otp_code = $1, otp_expires_at = $2 WHERE email = $3',
      [otp, expires, email.toLowerCase()]
    );
    await sendOTP(email, otp);
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/users/otp/verify — Verify OTP and issue token
router.post('/otp/verify', async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ error: 'email and otp required' });
  try {
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid or expired code' });
    const user = result.rows[0];
    if (
      !user.otp_code ||
      user.otp_code !== otp ||
      !user.otp_expires_at ||
      new Date(user.otp_expires_at) < new Date()
    ) {
      return res.status(401).json({ error: 'Invalid or expired code' });
    }
    // Clear OTP fields
    await db.query(
      'UPDATE users SET otp_code = NULL, otp_expires_at = NULL WHERE id = $1',
      [user.id]
    );
    const token = jwt.sign({ id: user.id, role: 'user' }, process.env.JWT_SECRET, { expiresIn: '30d' });
    const { password_hash, otp_code, otp_expires_at, ...safeUser } = user;
    return res.json({ token, user: safeUser });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/users/join — Join event and create/update profile
router.post('/join', async (req, res) => {
  const { event_id, name, linkedin, role, company, looking_for, offering, interests, user_id, email, password } = req.body;

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
      const passwordHash = password ? await bcrypt.hash(password, 10) : null;
      const createResult = await db.query(
        `INSERT INTO users (name, linkedin, role, company, looking_for, offering, interests, email, password_hash)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [
          name,
          linkedin || null,
          role || null,
          company || null,
          looking_for || [],
          offering || [],
          interests || [],
          email ? email.toLowerCase() : null,
          passwordHash,
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
    const token = jwt.sign({ id: userId, role: 'user' }, process.env.JWT_SECRET, { expiresIn: '30d' });

    const userResult = await db.query(
      'SELECT id, name, linkedin, role, company, looking_for, offering, interests, email, created_at FROM users WHERE id = $1',
      [userId]
    );
    const user = userResult.rows[0];

    return res.json({ token, user });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/users/me/connections — All saved connections grouped by event (user)
router.get('/me/connections', userAuth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT
         e.id          AS event_id,
         e.name        AS event_name,
         e.created_at  AS event_date,
         json_agg(
           json_build_object(
             'id',       u.id,
             'name',     u.name,
             'role',     u.role,
             'company',  u.company,
             'linkedin', u.linkedin,
             'saved_at', sc.saved_at
           ) ORDER BY sc.saved_at ASC
         ) AS connections
       FROM saved_connections sc
       JOIN events e ON e.id = sc.event_id
       JOIN users  u ON u.id = sc.connected_user_id
       WHERE sc.user_id = $1
       GROUP BY e.id, e.name, e.created_at
       ORDER BY e.created_at DESC`,
      [req.user.id]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/users/me — Get own profile (user)
router.get('/me', userAuth, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, name, linkedin, role, company, looking_for, offering, interests, email, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
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
       WHERE id = $8 RETURNING id, name, linkedin, role, company, looking_for, offering, interests, email, created_at`,
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
