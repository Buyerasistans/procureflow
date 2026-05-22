import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { shouldUseSupplierSession } from "../lib/session";

export default function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div>Yükleniyor...</div>;

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}

export function SupplierRoute() {
  const location = useLocation();

  if (!shouldUseSupplierSession(location.pathname)) {
    return <Navigate to="/supplier/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
