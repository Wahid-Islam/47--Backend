-- Allow Simplified Chinese (zh) as a stored profile locale.
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_locale_valid;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_locale_valid CHECK (locale IN ('en', 'bm', 'zh'));
