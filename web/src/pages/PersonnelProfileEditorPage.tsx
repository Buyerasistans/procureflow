import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { PersonnelCreateModal } from "../components/PersonnelCreateModal";
import { useAuth } from "../hooks/useAuth";
import {
  getTenantUsers,
  getUserCompanyAssignments,
  type TenantUser,
} from "../services/admin.service";

export default function PersonnelProfileEditorPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editUser, setEditUser] = useState<TenantUser | null>(null);

  const targetUserId = useMemo(() => {
    if (id) {
      const parsed = Number(id);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return user?.id ?? null;
  }, [id, user?.id]);

  useEffect(() => {
    if (!targetUserId) {
      setError("Profil kaydi bulunamadi.");
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      getTenantUsers(),
      getUserCompanyAssignments(targetUserId).catch(() => []),
    ])
      .then(([users, assignments]) => {
        if (cancelled) return;
        const person = users.find((item) => item.id === targetUserId);
        if (!person) {
          setError("Profil kaydi bulunamadi.");
          setEditUser(null);
          return;
        }
        setEditUser({
          ...person,
          company_assignments: assignments,
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Profil yuklenemedi.");
        setEditUser(null);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [targetUserId]);

  const handleClose = () => {
    if (id) {
      navigate("/admin?tab=personnel", { replace: true });
      return;
    }
    navigate("/dashboard", { replace: true });
  };

  if (loading) {
    return <div style={{ padding: 24, color: "#475569" }}>Profil editoru yukleniyor...</div>;
  }

  if (!editUser) {
    return (
      <div style={{ padding: 24, color: "#b91c1c" }}>
        {error || "Profil kaydi bulunamadi."}
      </div>
    );
  }

  return (
    <PersonnelCreateModal
      isOpen
      editData={editUser}
      allowPermissionOverrideSave={false}
      onClose={handleClose}
      onSuccess={() => {
        handleClose();
      }}
    />
  );
}