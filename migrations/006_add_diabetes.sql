ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS diabetes boolean NOT NULL DEFAULT false;
