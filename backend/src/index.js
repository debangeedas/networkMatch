require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const adminRoutes = require('./routes/admin');
const eventRoutes = require('./routes/events');
const userRoutes = require('./routes/users');
const { setupSocket } = require('./socket');

const app = express();
const server = http.createServer(app);

const allowedOrigins = [
  process.env.CLIENT_ADMIN_URL || 'http://localhost:3001',
  process.env.CLIENT_USER_URL || 'http://localhost:3000',
  process.env.CLIENT_USER_URL_PREVIEW,
].filter(Boolean);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());

// Routes
app.use('/api/admin', adminRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/users', userRoutes);

app.get('/', (req, res) => res.json({ name: 'NetworkMatch API', status: 'ok', docs: '/health' }));
app.get('/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// WebSocket setup
setupSocket(io);

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`NetworkMatch backend running on http://localhost:${PORT}`);
  console.log(`Allowed origins: ${allowedOrigins.join(', ')}`);
});
