import { useState, useEffect, useMemo } from "react";
import { getRoles, createRole, updateRole, deleteRole, getPermissions } from "../services/admin.service";
import type { CatalogRequest, Role, Permission } from "../services/admin.service";
import { useAuth } from "../hooks/useAuth";
import { filterVisibleRoleHierarchy, isPlatformStaffUser } from "../auth/permissions";
import "./RolesTab.css";

interface RolesTabProps {
  catalogRequests?: CatalogRequest[];
  requestBusyId?: number | null;
  onCreateRoleRequest?: (payload: { name: string; description?: string }) => Promise<void>;
  onReviewRequest?: (requestId: number, decision: "approved" | "rejected") => Promise<void>;
}

export function RolesTab({
  catalogRequests = [],
  requestBusyId = null,
  onCreateRoleRequest,
  onReviewRequest,
}: RolesTabProps) {
  const { user } = useAuth();
  const readOnly = isPlatformStaffUser(user);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [showNewRoleForm, setShowNewRoleForm] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState<number | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<number[]>([]);
  const [roleForm, setRoleForm] = useState({
    name: "",
    description: "",
    parent_id: undefined as number | undefined,
    is_active: true,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestName, setRequestName] = useState("");
  const [requestDescription, setRequestDescription] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [rolesData, permissionsData] = await Promise.all([getRoles(), getPermissions()]);
      setRoles(rolesData);
      setPermissions(permissionsData);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  const resetRoleForm = () => {
    setRoleForm({ name: "", description: "", parent_id: undefined, is_active: true });
    setSelectedPermissions([]);
  };

  const handleAddRole = async () => {
    if (!roleForm.name.trim()) {
      alert("Rol adı gereklidir");
      return;
    }
    try {
      await createRole({
        name: roleForm.name,
        description: roleForm.description,
        parent_id: roleForm.parent_id,
        permission_ids: selectedPermissions,
      });
      await loadData();
      resetRoleForm();
      setShowNewRoleForm(false);
    } catch (err) {
      alert("Rol ekleme hatası: " + String(err));
    }
  };

  const handleRequestRole = async () => {
    if (!roleForm.name.trim()) {
      alert("Rol adı gereklidir");
      return;
    }
    if (!onCreateRoleRequest) {
      return;
    }
    try {
      await onCreateRoleRequest({
        name: roleForm.name,
        description: roleForm.description || undefined,
      });
      await loadData();
      resetRoleForm();
      setShowNewRoleForm(false);
    } catch (err) {
      alert("Rol talep hatası: " + String(err));
    }
  };

  const handleUpdateRole = async (roleId: number) => {
    try {
      await updateRole(roleId, {
        name: roleForm.name,
        description: roleForm.description,
        parent_id: roleForm.parent_id !== undefined && roleForm.parent_id !== null ? roleForm.parent_id : undefined,
        is_active: roleForm.is_active,
        permission_ids: selectedPermissions,
      });
      await loadData();
      setEditingRoleId(null);
      resetRoleForm();
    } catch (err) {
      alert("Rol güncelleme hatası: " + String(err));
    }
  };

  const handleDeleteRole = async (id: number) => {
    if (!confirm("Bu rolü silmek istediğinize emin misiniz?")) return;
    try {
      await deleteRole(id);
      await loadData();
    } catch (err) {
      alert("Silme hatası: " + String(err));
    }
  };

  const handleEditRole = (role: Role) => {
    setEditingRoleId(role.id);
    setRoleForm({
      name: role.name,
      description: role.description || "",
      parent_id: role.parent_id || undefined,
      is_active: role.is_active,
    });
    setSelectedPermissions(role.permissions.map((permission) => permission.id));
  };

  const handleCancelEdit = () => {
    setEditingRoleId(null);
    resetRoleForm();
  };

  const handlePermissionChange = (permissionId: number) => {
    setSelectedPermissions((prev) =>
      prev.includes(permissionId)
        ? prev.filter((id) => id !== permissionId)
        : [...prev, permissionId],
    );
  };

  const visibleRoles = useMemo(() => {
    return filterVisibleRoleHierarchy(roles, (user as { role?: string } | null)?.role);
  }, [roles, user]);

  const roleRequests = useMemo(
    () => catalogRequests.filter((item) => item.entity_type === "role"),
    [catalogRequests],
  );

  const pendingRoleRequests = roleRequests.filter((item) => item.review_status === "pending_review");

  const handleSubmitRoleRequest = async () => {
    if (!onCreateRoleRequest || !requestName.trim()) {
      return;
    }
    await onCreateRoleRequest({
      name: requestName.trim(),
      description: requestDescription.trim() || undefined,
    });
    setRequestName("");
    setRequestDescription("");
  };

  if (loading) {
    return <div className="roles-tab__loading">Yükleniyor...</div>;
  }

  return (
    <div className="roles-tab">
      {onCreateRoleRequest && !readOnly ? (
        <section className="roles-tab__panel">
          <div>
            <div className="roles-tab__eyebrow roles-tab__eyebrow--primary">Onaylı Katalog Akışı</div>
            <div className="roles-tab__headline">Yeni rol talebi aç</div>
            <div className="roles-tab__subtext">
              Özel rolleri önce talep kuyruğuna düşürüp sonra kataloğa onayla.
            </div>
          </div>
          <div className="roles-tab__input-grid">
            <input
              type="text"
              value={requestName}
              onChange={(event) => setRequestName(event.target.value)}
              placeholder="Or: Kategori Lideri"
              aria-label="Rol talebi adı"
              title="Rol talebi adı"
              className="roles-tab__input"
            />
            <textarea
              value={requestDescription}
              onChange={(event) => setRequestDescription(event.target.value)}
              placeholder="Bu rol hangi karar veya operasyon boşluğunu kapatacak?"
              rows={2}
              aria-label="Rol talebi açıklaması"
              title="Rol talebi açıklaması"
              className="roles-tab__textarea"
            />
            <button
              type="button"
              onClick={() => {
                void handleSubmitRoleRequest();
              }}
              disabled={!requestName.trim()}
              className="roles-tab__button roles-tab__button--primary"
            >
              Talep Aç
            </button>
          </div>
        </section>
      ) : null}

      {roleRequests.length > 0 ? (
        <section className="roles-tab__panel roles-tab__panel--queue">
          <div>
            <div className="roles-tab__eyebrow roles-tab__eyebrow--secondary">Rol Talep Kuyruğu</div>
            <div className="roles-tab__headline">{pendingRoleRequests.length} bekleyen rol talebi</div>
          </div>
          <div className="roles-tab__queue-list">
            {roleRequests.slice(0, 6).map((request) => (
              <div key={request.id} className="roles-tab__queue-item">
                <div className="roles-tab__queue-meta">
                  <div className="roles-tab__queue-title">{request.proposed_name}</div>
                  <div className="roles-tab__queue-description">
                    {request.proposed_description || "Açıklama girilmedi"}
                  </div>
                  <div className="roles-tab__queue-status">Durum: {request.review_status}</div>
                </div>
                {request.review_status === "pending_review" && onReviewRequest ? (
                  <div className="roles-tab__queue-actions">
                    <button
                      type="button"
                      disabled={requestBusyId === request.id}
                      onClick={() => {
                        void onReviewRequest(request.id, "approved");
                      }}
                      className="roles-tab__button roles-tab__button--approve"
                    >
                      Onayla
                    </button>
                    <button
                      type="button"
                      disabled={requestBusyId === request.id}
                      onClick={() => {
                        void onReviewRequest(request.id, "rejected");
                      }}
                      className="roles-tab__button roles-tab__button--reject"
                    >
                      Reddet
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {error ? <div className="roles-tab__error">{error}</div> : null}

      <div>
        {readOnly ? (
          <div className="roles-tab__panel roles-tab__panel--readonly">
            Platform personeli rol hiyerarsisini inceleyebilir; yeni rol ekleme, duzenleme ve silme aksiyonlari bu yüzeyde kapatildi.
          </div>
        ) : null}

        <div className="roles-tab__toolbar">
          <button
            type="button"
            onClick={() => {
              setShowNewRoleForm(!showNewRoleForm);
              setEditingRoleId(null);
              resetRoleForm();
            }}
            disabled={readOnly}
            className="roles-tab__button roles-tab__button--success"
          >
            {showNewRoleForm ? "❌ İptal" : "➕ Yeni Rol"}
          </button>
        </div>
      </div>

      {!readOnly && (showNewRoleForm || editingRoleId !== null) ? (
        <div className="roles-tab__form">
          <h3 className="roles-tab__section-title">{editingRoleId ? "Rolü Düzenle" : "Yeni Rol Ekle"}</h3>

          <div className="roles-tab__form-grid">
            <input
              type="text"
              placeholder="Rol Adı"
              value={roleForm.name}
              onChange={(event) => setRoleForm({ ...roleForm, name: event.target.value })}
              aria-label="Rol adı"
              title="Rol adı"
              className="roles-tab__input"
            />
            <input
              type="text"
              placeholder="Açıklama"
              value={roleForm.description}
              onChange={(event) => setRoleForm({ ...roleForm, description: event.target.value })}
              aria-label="Rol açıklaması"
              title="Rol açıklaması"
              className="roles-tab__input"
            />
          </div>

          <div>
            <label className="roles-tab__label">Parent Rol (Hiyerarşi):</label>
            <select
              value={roleForm.parent_id || ""}
              onChange={(event) =>
                setRoleForm({ ...roleForm, parent_id: event.target.value ? parseInt(event.target.value) : undefined })
              }
              aria-label="Parent rol seçimi"
              title="Parent rol seçimi"
              className="roles-tab__select"
            >
              <option value="">Yok (Root Role)</option>
              {visibleRoles
                .filter((role) => role.id !== editingRoleId)
                .map((role) => (
                  <option key={role.id} value={role.id}>
                    {"  ".repeat(role.hierarchy_level)} {role.name}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="roles-tab__label">İzinler:</label>
            <div className="roles-tab__permission-grid">
              {permissions.map((permission) => (
                <label
                  key={permission.id}
                  className="roles-tab__permission-item"
                  title={permission.tooltip || permission.description || ""}
                >
                  <input
                    type="checkbox"
                    checked={selectedPermissions.includes(permission.id)}
                    onChange={() => handlePermissionChange(permission.id)}
                    className="roles-tab__permission-checkbox"
                  />
                  <div className="roles-tab__permission-body">
                    <div className="roles-tab__permission-name">
                      {permission.description || permission.name}
                    </div>
                    {permission.tooltip ? (
                      <div className="roles-tab__permission-tooltip">{permission.tooltip}</div>
                    ) : null}
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="roles-tab__actions">
            {editingRoleId ? (
              <>
                <button
                  type="button"
                  onClick={() => handleUpdateRole(editingRoleId)}
                  className="roles-tab__button roles-tab__button--primary"
                >
                  Güncelle
                </button>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="roles-tab__button roles-tab__button--ghost"
                >
                  İptal
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleAddRole}
                  className="roles-tab__button roles-tab__button--success"
                >
                  Ekle
                </button>
                {onCreateRoleRequest ? (
                  <button
                    type="button"
                    onClick={handleRequestRole}
                    className="roles-tab__button roles-tab__button--info"
                  >
                    Onaya Gonder
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    setShowNewRoleForm(false);
                    resetRoleForm();
                  }}
                  className="roles-tab__button roles-tab__button--ghost"
                >
                  İptal
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}

      <div className="roles-tab__section">
        <h3 className="roles-tab__section-title">Rol Hiyerarşisi</h3>
        <div className="roles-tab__tree">
          {getRoleTree(null).map((role) => (
            <RoleTreeNode
              key={role.id}
              role={role}
              allRoles={visibleRoles}
              onEdit={handleEditRole}
              onDelete={handleDeleteRole}
              readOnly={readOnly}
            />
          ))}
        </div>
      </div>

      {visibleRoles.length === 0 ? (
        <div className="roles-tab__empty">Hiç rol yoktur. Yeni bir rol oluşturun.</div>
      ) : null}
    </div>
  );

  function getRoleTree(parentId: number | null = null): Role[] {
    return visibleRoles
      .filter((role) => role.parent_id === parentId)
      .sort((a, b) => a.hierarchy_level - b.hierarchy_level);
  }
}

interface RoleNodeProps {
  role: Role;
  allRoles: Role[];
  onEdit: (role: Role) => void;
  onDelete: (id: number) => void;
  readOnly?: boolean;
}

function RoleTreeNode({
  role,
  allRoles,
  onEdit,
  onDelete,
  readOnly = false,
}: RoleNodeProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const children = allRoles.filter((candidate) => candidate.parent_id === role.id);
  const hasChildren = children.length > 0;
  const parentRole = role.parent_id ? allRoles.find((candidate) => candidate.id === role.parent_id) : null;

  return (
    <div>
      <div
        className={[
          "roles-tab__tree-node",
          role.is_active ? "roles-tab__tree-node--active" : "roles-tab__tree-node--inactive",
          `roles-tab__tree-node--level-${Math.min(role.hierarchy_level, 6)}`,
        ].join(" ")}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="roles-tab__toggle"
            aria-label={isExpanded ? "Alt rolleri gizle" : "Alt rolleri göster"}
            title={isExpanded ? "Alt rolleri gizle" : "Alt rolleri göster"}
          >
            {isExpanded ? "▼" : "▶"}
          </button>
        ) : (
          <div className="roles-tab__spacer" />
        )}

        <div className="roles-tab__tree-content">
          <div className="roles-tab__tree-name">{role.name}</div>
          <div className="roles-tab__tree-description">
            {role.description} {role.permissions.length > 0 && `(${role.permissions.length} izin)`}
          </div>
          <div className="roles-tab__tree-meta">
            Üst Rol: {parentRole?.name || "Root"} | Alt Rol Sayısı: {children.length}
          </div>
        </div>

        <span
          className={[
            "roles-tab__status",
            role.is_active ? "roles-tab__status--active" : "roles-tab__status--inactive",
          ].join(" ")}
        >
          {role.is_active ? "Aktif" : "Pasif"}
        </span>

        {!readOnly ? (
          <div className="roles-tab__tree-actions">
            <button
              type="button"
              onClick={() => onEdit(role)}
              className="roles-tab__tree-button roles-tab__tree-button--edit"
            >
              Düzenle
            </button>

            <button
              type="button"
              onClick={() => onDelete(role.id)}
              className="roles-tab__tree-button roles-tab__tree-button--delete"
            >
              Sil
            </button>
          </div>
        ) : null}
      </div>

      {isExpanded
        ? children.map((child) => (
            <RoleTreeNode
              key={child.id}
              role={child}
              allRoles={allRoles}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))
        : null}
    </div>
  );
}
