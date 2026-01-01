-- Migration: Add wishlist table for email subscriptions
-- Created: 2025-12-31

-- Wishlist table for storing email subscriptions
CREATE TABLE IF NOT EXISTS wishlist (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX idx_wishlist_email ON wishlist(email);
CREATE INDEX idx_wishlist_created_at ON wishlist(created_at);

-- Comment on table
COMMENT ON TABLE wishlist IS 'Email wishlist/subscription signups from landing page';
