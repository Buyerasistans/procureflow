import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { PersonnelCreateModal } from "../components/PersonnelCreateModal";
import { useAuth } from "../hooks/useAuth";
import {
  getTenantUsers,
  getUserCompanyAssignments,
  type TenantUser,
} from "../services/admin.service";
import "./PersonnelProfileEditorPage.css";

export default function PersonnelProfileEditorPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [editUser, setEditUser] = useState<TenantUser | null>(null);

  const targetUserId = useMemo(() => {
    if (id) {
      const parsed = Number(id);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return user?.id ?? null;
  }, [id, user?.id]);

  const isLoading = targetUserId !== null && editUser?.id !== targetUserId && error === null;

  useEffect(() => {
    if (targetUserId === null) {
      return;
    }

    let cancelled = false;

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
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Profil yuklenemedi.");
        setEditUser(null);
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

  if (targetUserId === null) {
    return (
      <div className="personnel-profile-editor-page">
        <div className="personnel-profile-editor-page__message personnel-profile-editor-page__message--error">
          Profil kaydi bulunamadi.
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="personnel-profile-editor-page">
        <div className="personnel-profile-editor-page__message personnel-profile-editor-page__message--loading">
          Profil editoru yukleniyor...
        </div>
      </div>
    );
  }

  if (!editUser) {
    return (
      <div className="personnel-profile-editor-page">
        <div className="personnel-profile-editor-page__message personnel-profile-editor-page__message--error">
          {error || "Profil kaydi bulunamadi."}
        </div>
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
