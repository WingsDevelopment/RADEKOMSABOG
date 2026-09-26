CREATE TABLE challengers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  steam_nick TEXT NOT NULL,
  steam_link TEXT NOT NULL,
  mmr INTEGER NOT NULL CHECK (mmr BETWEEN 0 AND 20000),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_challengers_created_at ON challengers(created_at);

-- Expiring, salted identifiers only; never store raw IP addresses.
CREATE TABLE signup_limits (
  key TEXT PRIMARY KEY,
  hits INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX idx_signup_limits_expiry ON signup_limits(expires_at);
