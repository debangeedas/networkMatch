-- NetworkMatch Database Schema

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Admins
CREATE TABLE IF NOT EXISTS admins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users (participants)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  linkedin VARCHAR(500),
  role VARCHAR(255),
  company VARCHAR(255),
  looking_for TEXT[] DEFAULT '{}',
  offering TEXT[] DEFAULT '{}',
  interests TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Events
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description VARCHAR(500),
  duration_per_round INTEGER NOT NULL DEFAULT 300,
  status VARCHAR(50) DEFAULT 'pending',
  current_round INTEGER DEFAULT 0,
  admin_id UUID REFERENCES admins(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migration: add description to existing databases
ALTER TABLE events ADD COLUMN IF NOT EXISTS description VARCHAR(500);

-- Event Participants
CREATE TABLE IF NOT EXISTS event_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT false,
  UNIQUE(user_id, event_id)
);

-- Migration: add is_active to existing databases
ALTER TABLE event_participants ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT false;

-- Matches
CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  user1_id UUID REFERENCES users(id) ON DELETE CASCADE,
  user2_id UUID REFERENCES users(id) ON DELETE CASCADE,
  user3_id UUID REFERENCES users(id) ON DELETE SET NULL,
  reason TEXT,
  conversation_starter TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Saved Connections
CREATE TABLE IF NOT EXISTS saved_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  connected_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
  saved_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, connected_user_id, event_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_event_participants_event ON event_participants(event_id);
CREATE INDEX IF NOT EXISTS idx_event_participants_user ON event_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_matches_event ON matches(event_id);
CREATE INDEX IF NOT EXISTS idx_matches_round ON matches(event_id, round_number);
