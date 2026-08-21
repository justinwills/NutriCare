-- Collapse case-only duplicate emails, then normalize remaining emails.

DELETE FROM users a
USING users b
WHERE lower(a.email) = lower(b.email)
  AND a.id <> b.id
  AND a.created_at < b.created_at;

UPDATE users SET email = lower(email) WHERE email <> lower(email);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users (lower(email));
