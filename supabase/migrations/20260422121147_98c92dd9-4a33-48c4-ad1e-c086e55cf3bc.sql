UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, now())
WHERE id IN ('b894d6e7-3965-453c-ad4b-01dcb4cf5241', '00e2a776-2b22-4cee-87b8-e64ae484633f');

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = 'b894d6e7-3965-453c-ad4b-01dcb4cf5241') THEN
    INSERT INTO public.meetups (id, host_id, guest_id, status, location, notes, scheduled_at)
    VALUES (
      '11111111-2222-3333-4444-555555555555',
      'b894d6e7-3965-453c-ad4b-01dcb4cf5241',
      '00e2a776-2b22-4cee-87b8-e64ae484633f',
      'completed',
      'Test Cafe',
      'E2E rating test',
      now() - interval '1 hour'
    )
    ON CONFLICT (id) DO UPDATE SET status = 'completed';
  END IF;
END $$;