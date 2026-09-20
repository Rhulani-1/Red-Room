import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import useAdminGuard from '@/hooks/useAdminGuard';
import { Loader2 } from 'lucide-react';

export default function AdminRoute() {
  const { isAdmin, loading } = useAdminGuard();
  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!isAdmin) return <Navigate to="/" replace />;
  return <Outlet />;
}
