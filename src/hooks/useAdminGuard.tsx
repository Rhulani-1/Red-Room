import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export default function useAdminGuard() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function check() {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          if (mounted) {
            setIsAdmin(false);
            setLoading(false);
          }
          return;
        }
        const userId = session.user.id;
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .eq('role', 'admin')
          .maybeSingle();
        if (mounted) setIsAdmin(!!data);
      } catch (e) {
        if (mounted) setIsAdmin(false);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    check();
    return () => { mounted = false; };
  }, []);

  return { isAdmin: !!isAdmin, loading };
}
