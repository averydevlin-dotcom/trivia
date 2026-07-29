-- Run this in your Supabase SQL editor if the rejected_questions table doesn't exist yet
-- Also add the exemplars table if using DB-backed exemplars

CREATE TABLE IF NOT EXISTS rejected_questions (
  id BIGSERIAL PRIMARY KEY,
  date TEXT,
  category TEXT,
  subcategory TEXT,
  question TEXT,
  answer TEXT,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS exemplars (
  id BIGSERIAL PRIMARY KEY,
  category TEXT,
  subcategory TEXT,
  difficulty TEXT,
  question TEXT,
  answer TEXT,
  context TEXT,
  grade TEXT DEFAULT 'GREEN',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add is_fun_day column to episodes if not already there
ALTER TABLE episodes ADD COLUMN IF NOT EXISTS is_fun_day BOOLEAN DEFAULT false;
ALTER TABLE episodes ADD COLUMN IF NOT EXISTS tomorrow_category TEXT;
