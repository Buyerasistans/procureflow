// FILE: web\src\pages\ReportsPage.tsx
import { useAuth } from "../hooks/useAuth";
import { getRoleIcon, getUserDisplayRoleLabel, normalizedBusinessRole } from "../auth/permissions";
import WorkspaceHeroCard from "../components/WorkspaceHeroCard";

export default function ReportsPage() {
  const { user } = useAuth();
  const roleLabel = user ? getUserDisplayRoleLabel(user) : "";
  const roleIcon = getRoleIcon(normalizedBusinessRole(user));

  return (
    <div style={{ fontFamily: "Arial" }}>
      <WorkspaceHeroCard
        title="Raporlar"
        subtitle={`${roleIcon} Platform Super Admin • ${roleLabel}`}
        userName={user?.full_name || user?.email || "-"}
        userEmail={user?.email || ""}
      />
      <h2>Raporlar</h2>
      <p>Bu alan rapor görüntüleme yetkisi olan roller içindir.</p>
    </div>
  );
}
