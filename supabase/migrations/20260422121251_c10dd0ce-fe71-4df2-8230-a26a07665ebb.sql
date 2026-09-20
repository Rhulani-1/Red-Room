UPDATE auth.users SET email_confirmed_at = COALESCE(email_confirmed_at, now())
WHERE id = '51af8cdf-79a5-48ad-b90a-48ea449db840';