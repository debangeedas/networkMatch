# NetworkMatch

A full-stack MVP for real-time networking event matching.

## Architecture

```
networkMatch/
├── backend/          # Node.js + Express + Socket.io + PostgreSQL
├── admin/            # Next.js admin dashboard (port 3001)
└── user/             # Next.js mobile-first user app (port 3000)
```

## Quick Start

### 1. Database Setup

```bash
# Create PostgreSQL database
createdb networkmatch

# Copy backend env
cp backend/.env.example backend/.env
# Edit backend/.env with your DATABASE_URL, JWT_SECRET, etc.

# Init schema
cd backend && npm install && npm run db:init
```

### 2. Backend

```bash
cd backend
npm run dev
# Runs on http://localhost:4000
```

### 3. Admin App

```bash
cd admin
npm install
npm run dev
# Runs on http://localhost:3001
```

### 4. User App

```bash
cd user
npm install
npm run dev
# Runs on http://localhost:3000
```

## Usage Flow

### Admin
1. Go to `http://localhost:3001`
2. Register with invite code (`admin123` by default, set in `.env`)
3. Create an event
4. Share the QR code / join link with participants
5. Use the **Start Round** button when everyone has joined
6. Use **End Round** to stop a round early (or timer auto-ends it)

### User
1. Scan QR code → lands on `http://localhost:3000/join/{eventId}`
2. Fill in profile (name, role, company, looking_for, offering, interests)
3. Enter lobby and wait for admin to start the round
4. Receive real-time match with reason + conversation starter + live timer
5. Save connections and copy LinkedIn follow-up messages after round ends

## Key Features

- **Real-time matching**: WebSockets push matches to all users instantly
- **Server-controlled timer**: Countdown synced across all clients
- **Smart matching algorithm**: Complementary skills → shared interests → role/company → random
- **No repeat matches**: Algorithm avoids previously matched pairs
- **Odd number handling**: Creates groups of 3 when needed
- **LinkedIn message generation**: Template-based follow-up message per match
- **QR code generation**: Each event gets a scannable join QR

## API Endpoints

### Admin Auth
- `POST /api/admin/register` — Register (requires invite code)
- `POST /api/admin/login` — Login
- `GET /api/admin/me` — Get profile

### Events (Admin protected)
- `POST /api/events` — Create event
- `GET /api/events` — List your events
- `GET /api/events/:id` — Event details + participants
- `GET /api/events/:id/qr` — QR code data URL

### Users
- `POST /api/users/join` — Join event (creates profile if new)
- `GET /api/users/me` — My profile
- `PUT /api/users/me` — Update profile
- `POST /api/users/linkedin-message` — Generate LinkedIn message

### Events (User)
- `GET /api/events/:id/public` — Public event info
- `GET /api/events/:id/my-match` — My current match
- `POST /api/events/:id/save-connection` — Save a connection
- `GET /api/events/:id/saved-connections` — My saved connections

## WebSocket Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `join_event` | Client → Server | Join an event room |
| `start_round` | Admin → Server | Start a round (triggers matching) |
| `end_round` | Admin → Server | End the current round |
| `round_started` | Server → All | Round began, with duration |
| `match_assigned` | Server → User | User's specific match data |
| `timer_tick` | Server → All | Every-second countdown update |
| `round_ended` | Server → All | Round ended notification |
| `participant_count` | Server → All | Updated participant count |
| `event_state` | Server → Client | Current state on join (for late joiners) |

## Environment Variables

### Backend (`backend/.env`)
```
PORT=4000
DATABASE_URL=postgresql://postgres:password@localhost:5432/networkmatch
JWT_SECRET=your-secret-key
ADMIN_INVITE_CODE=admin123
CLIENT_ADMIN_URL=http://localhost:3001
CLIENT_USER_URL=http://localhost:3000
```

### Admin + User apps (`.env.local`)
```
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_WS_URL=http://localhost:4000
```
