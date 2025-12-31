CREATE TABLE IF NOT EXISTS dashboard_users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer',
  invited_by INTEGER REFERENCES dashboard_users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS invites (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer',
  invited_by INTEGER REFERENCES dashboard_users(id) NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dashboard_users_email ON dashboard_users(email);

CREATE INDEX IF NOT EXISTS idx_invites_email ON invites(email);

CREATE INDEX IF NOT EXISTS idx_invites_used ON invites(used);

INSERT INTO dashboard_users (email, role)
VALUES ('agusmontoya@gmail.com', 'admin')
ON CONFLICT (email) DO UPDATE SET role = 'admin';
