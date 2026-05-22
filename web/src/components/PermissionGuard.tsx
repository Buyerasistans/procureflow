// FILE: web\src\components\PermissionGuard.tsx
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { normalizedBusinessRole } from "../auth/permissions";

type PermissionGuardProps = {
  allow: string[]; // örn: ["admin"] veya ["admin", "manager"]
  children: React.ReactNode;
};

export default function PermissionGuard({ allow, children }: PermissionGuardProps) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div style={{ padding: 24 }}>Yetki kontrol ediliyor...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  const role = normalizedBusinessRole(user);
  const allowed = allow.map((r) => r.toLowerCase()).includes(role);

  if (!allowed) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}
