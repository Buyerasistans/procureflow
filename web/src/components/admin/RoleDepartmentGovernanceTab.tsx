import { useEffect, useMemo, useState } from "react";
import type { AuthUser } from "../../context/auth-types";
import { getUserScopeType, isPlatformStaffUser, isSuperAdminUser } from "../../auth/permissions";
import { PageHeader, StatCard } from "../../pages/admin/AdminTabContent";
import {
  applyCatalogMerge,
  createDepartment,
  createRole,
  deleteDepartment,
  deleteRole,
  getCatalogMergePreview,
  getCompanies,
  getDepartments,
  getPermissions,
  getRoles,
  getTenantUsers,
  removeUserCompanyAssignment,
  rollbackCatalogMerge,
  resetRoleCatalogs,
  updateDepartment,
  updateRole,
  updateUserCompanyAssignment,
  type AdminSupplierListItem,
  type CatalogMergeApplyResult,
  type CatalogMergePreview,
  type Company,
  type Department,
  type Permission,
  type Role,
  type TenantUser,
  type Tenant,
} from "../../services/admin.service";
import { buildTenantScopeMap, resolveCompanyScope, type EntityScope } from "../../utils/scopeResolver";

type GovernanceScope = "platform" | "partner" | "supplier" | "channel" | "career";
type MergeEntity = "role" | "department";
type RoleEditorState = {
  name: string;
  description: string;
  parent_id?: number;
};

interface RoleDepartmentGovernanceTabProps {
  tenants: Tenant[];
  canManage: boolean;
  isSuperAdmin: boolean;
  currentUser?: AuthUser | null;
  suppliers?: AdminSupplierListItem[];
}

const SCOPE_TITLES: Record<GovernanceScope, string> = {
  platform: "Portal Ana Firmalar",
  partner: "Stratejik Partner Rolleri",
  supplier: "Tedarikçi Rolleri",
  channel: "İş Ortağı Rolleri",
  career: "Kariyer Rolleri",
};

function normalizeText(value: string): string {
  return String(value || "")
    .toLowerCase()
    .replace(/[ıİ]/g, "i")
    .replace(/[şŞ]/g, "s")
    .replace(/[ğĞ]/g, "g")
    .replace(/[üÜ]/g, "u")
    .replace(/[öÖ]/g, "o")
    .replace(/[çÇ]/g, "c")
    .trim();
}

function normalizeStableText(value: string): string {
  return String(value || "")
    .replaceAll("İ", "I")
    .replaceAll("ı", "i")
    .replaceAll("Ş", "S")
    .replaceAll("ş", "s")
    .replaceAll("Ğ", "G")
    .replaceAll("ğ", "g")
    .replaceAll("Ü", "U")
    .replaceAll("ü", "u")
    .replaceAll("Ö", "O")
    .replaceAll("ö", "o")
    .replaceAll("Ç", "C")
    .replaceAll("ç", "c")
    .toLowerCase()
    .trim();
}

function governanceToEntityScope(scope: GovernanceScope): EntityScope {
  if (scope === "platform") return "portal";
  if (scope === "partner") return "partner";
  if (scope === "supplier") return "supplier";
  if (scope === "channel") return "channel";
  return "career";
}

function toRoleKey(value: string | null | undefined): string {
  return normalizeText(String(value || "").replace(/_/g, " "));
}

function scopeColor(scope: GovernanceScope): string {
  if (scope === "platform") return "#0f172a";
  if (scope === "partner") return "#0369a1";
  if (scope === "supplier") return "#0f766e";
  return "#92400e";
}

function matchTenantByName(tenants: Tenant[], rawName: string | null | undefined): Tenant | null {
  const target = normalizeText(rawName || "");
  if (!target) return null;
  return tenants.find((tenant) => {
    const candidates = [tenant.legal_name, tenant.brand_name, tenant.slug]
      .map((value) => normalizeText(value || ""))
      .filter(Boolean);
    return candidates.some((candidate) => candidate === target || candidate.includes(target) || target.includes(candidate));
  }) || null;
}

function buildRoleTree(rows: Role[]): Array<Role & { childCount: number }> {
  const sorted = [...rows].sort((left, right) => {
    if (left.hierarchy_level !== right.hierarchy_level) {
      return left.hierarchy_level - right.hierarchy_level;
    }
    return left.name.localeCompare(right.name, "tr");
  });

  const byParent = new Map<number | null, Role[]>();
  for (const row of sorted) {
    const key = row.parent_id ?? null;
    const bucket = byParent.get(key) || [];
    bucket.push(row);
    byParent.set(key, bucket);
  }

  const result: Array<Role & { childCount: number }> = [];
  const visit = (items: Role[]) => {
    for (const item of items) {
      const children = byParent.get(item.id) || [];
      result.push({ ...item, childCount: children.length });
      if (children.length > 0) {
        visit(children);
      }
    }
  };

  const roots = sorted.filter((row) => row.parent_id == null || !sorted.some((candidate) => candidate.id === row.parent_id));
  visit(roots);

  const seen = new Set(result.map((row) => row.id));
  for (const row of sorted) {
    if (!seen.has(row.id)) {
      result.push({ ...row, childCount: (byParent.get(row.id) || []).length });
    }
  }

  return result;
}

export function RoleDepartmentGovernanceTab({
  tenants,
  canManage,
  isSuperAdmin,
  currentUser,
  suppliers = [],
}: RoleDepartmentGovernanceTabProps) {
  const userScope = getUserScopeType(currentUser);
  const canViewAllScopes = isSuperAdminUser(currentUser) || isPlatformStaffUser(currentUser) || userScope === "platform";
  const visibleScopes = useMemo<GovernanceScope[]>(() => {
    if (canViewAllScopes) {
      return ["platform", "partner", "supplier", "channel", "career"];
    }

    const allowedScopes: GovernanceScope[] = ["platform", "partner", "supplier", "channel", "career"];
    return allowedScopes.includes(userScope as GovernanceScope)
      ? [userScope as GovernanceScope]
      : ["platform"];
  }, [canViewAllScopes, userScope]);

  const [activeScope, setActiveScope] = useState<GovernanceScope>(visibleScopes[0] || "platform");
  const [tenantSelection, setTenantSelection] = useState<Partial<Record<GovernanceScope, number>>>({});
  const [companySelection, setCompanySelection] = useState<Partial<Record<GovernanceScope, number>>>({});
  const [companies, setCompanies] = useState<Company[]>([]);
  const [tenantUsers, setTenantUsers] = useState<TenantUser[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [roleMergePreview, setRoleMergePreview] = useState<CatalogMergePreview | null>(null);
  const [departmentMergePreview, setDepartmentMergePreview] = useState<CatalogMergePreview | null>(null);
  const [mergeTargetByGroup, setMergeTargetByGroup] = useState<Record<string, number>>({});
  const [lastMergeResult, setLastMergeResult] = useState<Partial<Record<MergeEntity, CatalogMergeApplyResult>>>({});
  const [departmentNameInput, setDepartmentNameInput] = useState("");
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState<number | null>(null);
  const [roleEditor, setRoleEditor] = useState<RoleEditorState>({ name: "", description: "", parent_id: undefined });
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<number[]>([]);
  const [summaryModalOpen, setSummaryModalOpen] = useState(false);
  const [editingPersonKey, setEditingPersonKey] = useState<string | null>(null);
  const [editingNewRoleId, setEditingNewRoleId] = useState<number | null>(null);
  const [loading, setloading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [seedingCatalog, setSeedingCatalog] = useState(false);

  const currentUserEmail = normalizeText(currentUser?.email || "");

  const currentTenantFromIdentity = useMemo(() => {
    return matchTenantByName(
      tenants,
      currentUser?.organization_name || currentUser?.workspace_label || null,
    );
  }, [currentUser?.organization_name, currentUser?.workspace_label, tenants]);

  const currentTenantFromUsers = useMemo(() => {
    if (!currentUserEmail) return null;
    const me = tenantUsers.find((user) => {
      const userEmail = normalizeText(user.email || "");
      const userWorkEmail = normalizeText(user.work_email || "");
      return userEmail === currentUserEmail || userWorkEmail === currentUserEmail;
    });
    if (!me || typeof me.tenant_id !== "number") return null;
    return tenants.find((tenant) => tenant.id === me.tenant_id) || null;
  }, [currentUserEmail, tenantUsers, tenants]);

  const currentTenant = useMemo(() => {
    return currentTenantFromIdentity || currentTenantFromUsers;
  }, [currentTenantFromIdentity, currentTenantFromUsers]);

  const tenantScopeMap = useMemo(
    () => buildTenantScopeMap(tenants, tenantUsers, [], companies),
    [tenants, tenantUsers, companies],
  );

  const tenantOptionsByScope = useMemo(() => {
    return {
      partner: tenants.filter((item) => tenantScopeMap.get(item.id) === "partner"),
      supplier: tenants.filter((item) => tenantScopeMap.get(item.id) === "supplier"),
      channel: tenants.filter((item) => tenantScopeMap.get(item.id) === "channel"),
      career: tenants.filter((item) => tenantScopeMap.get(item.id) === "career"),
    };
  }, [tenants, tenantScopeMap]);

  const activeTenantOptions = useMemo(() => {
    if (!canViewAllScopes) {
      const targetScope = governanceToEntityScope(activeScope);
      if (currentTenant && tenantScopeMap.get(currentTenant.id) === targetScope) {
        return [currentTenant];
      }
      if (currentTenant) {
        return [currentTenant];
      }
      if (activeScope === "partner" && tenantOptionsByScope.partner.length === 1) {
        return tenantOptionsByScope.partner;
      }
      if (activeScope === "supplier" && tenantOptionsByScope.supplier.length === 1) {
        return tenantOptionsByScope.supplier;
      }
      if (activeScope === "channel" && tenantOptionsByScope.channel.length === 1) {
        return tenantOptionsByScope.channel;
      }
      if (activeScope === "career" && tenantOptionsByScope.career.length === 1) {
        return tenantOptionsByScope.career;
      }
      return [];
    }
    if (activeScope === "partner") {
      return tenantOptionsByScope.partner;
    }
    if (activeScope === "supplier") {
      return tenantOptionsByScope.supplier;
    }
    if (activeScope === "channel") {
      return tenantOptionsByScope.channel;
    }
    if (activeScope === "career") {
      return tenantOptionsByScope.career;
    }
    return [] as Tenant[];
  }, [activeScope, canViewAllScopes, currentTenant, tenantOptionsByScope, tenantScopeMap]);

  useEffect(() => {
    if (visibleScopes.includes(activeScope)) return;
    setActiveScope(visibleScopes[0] || "platform");
  }, [activeScope, visibleScopes]);

  const activeTenantId = useMemo(() => {
    if (activeScope === "platform") return null;
    const selected = tenantSelection[activeScope];
    if (typeof selected === "number") return selected;
    return activeTenantOptions[0]?.id ?? null;
  }, [activeScope, tenantSelection, activeTenantOptions]);

  useEffect(() => {
    if (activeScope === "platform") return;
    if (!canViewAllScopes && typeof currentTenant?.id === "number") {
      if (tenantSelection[activeScope] === currentTenant.id) return;
      setTenantSelection((prev) => ({ ...prev, [activeScope]: currentTenant.id }));
      return;
    }
    if (typeof tenantSelection[activeScope] === "number") return;
    const fallback = activeTenantOptions[0]?.id;
    if (typeof fallback !== "number") return;
    setTenantSelection((prev) => ({ ...prev, [activeScope]: fallback }));
  }, [activeScope, tenantSelection, activeTenantOptions, canViewAllScopes, currentTenant]);

  const activeCompanyOptions = useMemo(() => {
    const sortedAll = [...companies].sort((left, right) => left.name.localeCompare(right.name, "tr"));
    const targetScope = governanceToEntityScope(activeScope);
    const scopeFiltered = sortedAll.filter((company) => resolveCompanyScope(company, tenantScopeMap) === targetScope);
    if (scopeFiltered.length > 0) {
      if (activeScope === "platform") return scopeFiltered;
      if (activeTenantOptions.length > 0) {
        const tenantIds = new Set(activeTenantOptions.map((tenant) => tenant.id));
        const tenantScoped = scopeFiltered.filter((company) => typeof company.tenant_id === "number" && tenantIds.has(company.tenant_id));
        return tenantScoped.length > 0 ? tenantScoped : scopeFiltered;
      }
      return scopeFiltered;
    }

    if (canViewAllScopes) {
      return [] as Company[];
    }

    const fallbackOrgName = normalizeText(currentUser?.organization_name || currentUser?.workspace_label || "");
    if (!fallbackOrgName) return [] as Company[];
    return sortedAll.filter((company) => {
      const companyName = normalizeText(company.name || "");
      const shortName = normalizeText(company.short_name || "");
      return companyName.includes(fallbackOrgName) || fallbackOrgName.includes(companyName) || shortName === fallbackOrgName;
    });
  }, [activeScope, activeTenantOptions, companies, currentUser?.organization_name, currentUser?.workspace_label, canViewAllScopes, tenantScopeMap]);

  const activeCompanyId = useMemo(() => {
    const selected = companySelection[activeScope];
    if (typeof selected === "number") return selected;
    return activeCompanyOptions[0]?.id ?? null;
  }, [activeScope, companySelection, activeCompanyOptions]);

  useEffect(() => {
    if (typeof companySelection[activeScope] === "number") return;
    const fallback = activeCompanyOptions[0]?.id;
    if (typeof fallback !== "number") return;
    setCompanySelection((prev) => ({ ...prev, [activeScope]: fallback }));
  }, [activeScope, companySelection, activeCompanyOptions]);

  useEffect(() => {
    const selectedCompany = activeCompanyOptions.find((company) => company.id === activeCompanyId);
    const tenantId = selectedCompany?.tenant_id;
    if (typeof tenantId !== "number") return;
    if (tenantSelection[activeScope] === tenantId) return;
    setTenantSelection((prev) => ({ ...prev, [activeScope]: tenantId }));
  }, [activeScope, activeCompanyId, activeCompanyOptions, tenantSelection]);

  const scopeCompanies = useMemo(() => {
    if (activeScope === "platform") return activeCompanyOptions;

    const base: Company[] =
      activeCompanyOptions.length > 0
        ? activeCompanyOptions
        : activeTenantOptions.map((tenant) => ({
            id: -tenant.id,
            tenant_id: tenant.id,
            name: tenant.legal_name || tenant.brand_name || tenant.slug,
            short_name: tenant.brand_name || null,
            color: "#0f172a",
            is_active: true,
            created_at: tenant.created_at,
            updated_at: tenant.updated_at,
          } as Company));

    if (activeScope === "supplier" && suppliers.length > 0) {
      const existingNames = new Set(base.map((c) => normalizeText(c.name)));
      const demoTenantId = activeTenantOptions[0]?.id ?? null;
      const externals = suppliers
        .filter((s) => !existingNames.has(normalizeText(s.company_name)))
        .map((s) => ({
          id: -(s.id + 50000),
          tenant_id: demoTenantId,
          name: s.company_name,
          short_name: s.company_name,
          color: "#64748b",
          is_active: s.is_active ?? true,
          created_at: "",
          updated_at: "",
        } as Company));
      return [...base, ...externals];
    }

    return base;
  }, [activeCompanyOptions, activeScope, activeTenantOptions, suppliers]);

  const roleTree = useMemo(() => buildRoleTree(roles), [roles]);

  const departmentsWithSubItems = useMemo(() => {
    return [...departments].sort((left, right) => left.name.localeCompare(right.name, "tr"));
  }, [departments]);

  const roleParentOptions = useMemo(() => {
    return [...roles]
      .filter((role) => role.id !== editingRoleId)
      .sort((left, right) => left.hierarchy_level - right.hierarchy_level || left.name.localeCompare(right.name, "tr"));
  }, [roles, editingRoleId]);

  const selectedParentRole = useMemo(() => {
    if (typeof roleEditor.parent_id !== "number") return null;
    return roles.find((role) => role.id === roleEditor.parent_id) || null;
  }, [roleEditor.parent_id, roles]);

  const computedHierarchyLevel = useMemo(() => {
    return selectedParentRole ? selectedParentRole.hierarchy_level + 1 : 0;
  }, [selectedParentRole]);

  const selectedCompany = useMemo(() => {
    return scopeCompanies.find((company) => company.id === activeCompanyId) || null;
  }, [activeCompanyId, scopeCompanies]);

  type SummaryPerson = { userId: number; fullName: string; email: string; departments: string[]; assignmentIds: number[] };
  type SummaryRow = { role: Role; people: SummaryPerson[] };

  const companySummaryRows = useMemo(() => {
    if (!selectedCompany) return [] as SummaryRow[];

    const roleMap = new Map(roles.map((role) => [role.id, role] as const));
    const grouped = new Map<number, {
      roleName: string;
      hierarchyLevel: number;
      parentId: number | null;
      people: Map<number, { userId: number; fullName: string; email: string; departments: Set<string>; assignmentIds: number[] }>;
    }>();

    for (const user of tenantUsers) {
      const assignments = user.company_assignments || [];
      for (const assignment of assignments) {
        if (assignment.company_id !== selectedCompany.id) continue;
        const roleId = assignment.role_id;
        const roleFromCatalog = roleMap.get(roleId);
        const roleName = assignment.role?.name || roleFromCatalog?.name || `Rol #${roleId}`;
        const roleLevel = assignment.role?.hierarchy_level ?? roleFromCatalog?.hierarchy_level ?? 0;
        const roleParentId = roleFromCatalog?.parent_id ?? null;
        if (!grouped.has(roleId)) {
          grouped.set(roleId, {
            roleName,
            hierarchyLevel: roleLevel,
            parentId: roleParentId,
            people: new Map(),
          });
        }
        const roleUsers = grouped.get(roleId)!;
        const existing = roleUsers.people.get(user.id) || {
          userId: user.id,
          fullName: user.full_name || user.email,
          email: user.email,
          departments: new Set<string>(),
          assignmentIds: [] as number[],
        };
        const departmentName = assignment.department?.name || (assignment.department_id ? `Departman #${assignment.department_id}` : "Departman bağımsız");
        existing.departments.add(departmentName);
        existing.assignmentIds.push(assignment.id);
        roleUsers.people.set(user.id, existing);
      }
    }

    if (grouped.size === 0 && typeof selectedCompany.tenant_id === "number") {
      const syntheticRoleMap = new Map<string, {
        roleId: number;
        roleName: string;
        hierarchyLevel: number;
        parentId: number | null;
        people: Map<number, { userId: number; fullName: string; email: string; departments: Set<string>; assignmentIds: number[] }>;
      }>();
      let nextSyntheticId = -1;

      for (const user of tenantUsers) {
        if (user.tenant_id !== selectedCompany.tenant_id) continue;
        const roleLabel = String(user.business_role || user.role || "").trim() || "tenant_user";
        const roleKey = toRoleKey(roleLabel);
        const matchedRole = roles.find((role) => toRoleKey(role.name) === roleKey || toRoleKey(role.name).includes(roleKey) || roleKey.includes(toRoleKey(role.name)));

        if (!syntheticRoleMap.has(roleKey)) {
          syntheticRoleMap.set(roleKey, {
            roleId: matchedRole?.id ?? nextSyntheticId--,
            roleName: matchedRole?.name || roleLabel,
            hierarchyLevel: matchedRole?.hierarchy_level ?? 0,
            parentId: matchedRole?.parent_id ?? null,
            people: new Map(),
          });
        }

        const roleUsers = syntheticRoleMap.get(roleKey)!;
        const existing = roleUsers.people.get(user.id) || {
          userId: user.id,
          fullName: user.full_name || user.email,
          email: user.email,
          departments: new Set<string>(),
          assignmentIds: [] as number[],
        };
        const departmentName = user.department_id
          ? (departments.find((department) => department.id === user.department_id)?.name || `Departman #${user.department_id}`)
          : "Departman bağımsız";
        existing.departments.add(departmentName);
        roleUsers.people.set(user.id, existing);
      }

      for (const roleUsers of syntheticRoleMap.values()) {
        grouped.set(roleUsers.roleId, {
          roleName: roleUsers.roleName,
          hierarchyLevel: roleUsers.hierarchyLevel,
          parentId: roleUsers.parentId,
          people: roleUsers.people,
        });
      }
    }

    const summaryRoles: Role[] = Array.from(grouped.entries()).map(([roleId, meta]) => ({
      id: roleId,
      name: meta.roleName,
      hierarchy_level: meta.hierarchyLevel,
      parent_id: meta.parentId,
      is_active: true,
      tenant_id: selectedCompany.tenant_id,
      permissions: [],
    }));

    return buildRoleTree(summaryRoles)
      .map((role) => {
        const roleUsers = grouped.get(role.id);
        return {
          role,
          people: Array.from(roleUsers?.people.values() || []).map((person) => ({
            userId: person.userId,
            fullName: person.fullName,
            email: person.email,
            departments: Array.from(person.departments).sort((left, right) => left.localeCompare(right, "tr")),
            assignmentIds: person.assignmentIds,
          })),
        };
      })
      .filter((item) => item.people.length > 0);
  }, [departments, roles, selectedCompany, tenantUsers]);

  async function loadScopeData() {
    setloading(true);
    setError(null);
    try {
      const targetTenantId = activeTenantId ?? undefined;
      const isChannelWorkspaceOnly = !canViewAllScopes && userScope === "channel";

      const [companyRes, userRes, roleRes, departmentRes, roleDupRes, departmentDupRes] = await Promise.allSettled([
        isChannelWorkspaceOnly ? Promise.resolve([] as Company[]) : getCompanies(),
        getTenantUsers(),
        getRoles({ tenantId: targetTenantId, includeDuplicates: isSuperAdmin }),
        getDepartments({ tenantId: targetTenantId, includeDuplicates: isSuperAdmin }),
        isSuperAdmin
          ? getCatalogMergePreview({ entityType: "role", tenantId: activeTenantId })
          : Promise.resolve(null),
        isSuperAdmin
          ? getCatalogMergePreview({ entityType: "department", tenantId: activeTenantId })
          : Promise.resolve(null),
      ]);

      const companyRows = companyRes.status === "fulfilled" ? companyRes.value : [];
      const userRows = userRes.status === "fulfilled" ? userRes.value : [];
      const roleRows = roleRes.status === "fulfilled" ? roleRes.value : [];
      const departmentRows = departmentRes.status === "fulfilled" ? departmentRes.value : [];
      const roleDup = roleDupRes.status === "fulfilled" ? roleDupRes.value : null;
      const departmentDup = departmentDupRes.status === "fulfilled" ? departmentDupRes.value : null;

      setCompanies(companyRows);
      setTenantUsers(userRows);

      if (targetTenantId != null) {
        // Specific tenant selected — API already filtered, use as-is
        setRoles(roleRows);
        setDepartments(departmentRows);
      } else if (activeScope === "platform") {
        // Platform scope, no company selected — show only platform-level roles
        setRoles(roleRows.filter((row) => row.tenant_id == null));
        setDepartments(departmentRows.filter((row) => row.tenant_id == null));
      } else {
        // No specific tenant selected; filter client-side by scope to avoid cross-scope contamination
        const scopeKey = activeScope as keyof typeof tenantOptionsByScope;
        const scopeTenantIds = new Set((tenantOptionsByScope[scopeKey] ?? []).map((t) => t.id));
        setRoles(roleRows.filter((row) => row.tenant_id != null && scopeTenantIds.has(row.tenant_id)));
        setDepartments(departmentRows.filter((row) => row.tenant_id != null && scopeTenantIds.has(row.tenant_id)));
      }
      setRoleMergePreview(roleDup);
      setDepartmentMergePreview(departmentDup);

      const rejected = [companyRes, userRes, roleRes, departmentRes, roleDupRes, departmentDupRes]
        .filter((result) => result.status === "rejected") as Array<PromiseRejectedResult>;
      if (rejected.length > 0) {
        const hasForbidden = rejected.some((result) => String(result.reason).includes("403"));
        if (!(isChannelWorkspaceOnly && hasForbidden)) {
          throw rejected[0].reason;
        }
      }

      setMergeTargetByGroup((prev) => {
        const next = { ...prev };
        for (const group of roleDup?.groups || []) {
          if (typeof next[`role:${group.normalized_name}`] !== "number") {
            next[`role:${group.normalized_name}`] = group.items[0]?.id || 0;
          }
        }
        for (const group of departmentDup?.groups || []) {
          if (typeof next[`department:${group.normalized_name}`] !== "number") {
            next[`department:${group.normalized_name}`] = group.items[0]?.id || 0;
          }
        }
        return next;
      });
    } catch (err) {
      setError(String(err));
    } finally {
      setloading(false);
    }
  }

  useEffect(() => {
    void loadScopeData();
  }, [activeScope, activeTenantId, isSuperAdmin]);

  async function handleSeedCatalogs() {
    setSeedingCatalog(true);
    setError(null);
    try {
      await resetRoleCatalogs();
      await loadScopeData();
    } catch (err) {
      setError(String(err));
    } finally {
      setSeedingCatalog(false);
    }
  }

  async function handleRemoveAssignment(userId: number, assignmentId: number) {
    if (!window.confirm("Bu personelin rol atamasını silmek istediğinizden emin misiniz?")) return;
    setBusy(`del-assign-${assignmentId}`);
    setError(null);
    try {
      await removeUserCompanyAssignment(userId, assignmentId);
      await loadScopeData();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(null);
    }
  }

  async function handleReassignPerson(userId: number, assignmentId: number, newRoleId: number) {
    setBusy(`reassign-${assignmentId}`);
    setError(null);
    try {
      await updateUserCompanyAssignment(userId, assignmentId, { role_id: newRoleId });
      setEditingPersonKey(null);
      setEditingNewRoleId(null);
      await loadScopeData();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(null);
    }
  }

  async function handleCreateRole() {
    const name = roleEditor.name.trim();
    if (!name) return;
    setBusy("create-role");
    try {
      await createRole({
        name,
        description: roleEditor.description.trim() || undefined,
        parent_id: roleEditor.parent_id,
        permission_ids: selectedPermissionIds,
        tenant_id: activeTenantId ?? undefined,
      });
      closeRoleModal();
      await loadScopeData();
    } catch (err) {
      alert(`Rol oluşturulamadı: ${String(err)}`);
    } finally {
      setBusy(null);
    }
  }

  async function ensureRoleEditorDependencies() {
    if (permissions.length > 0) return;
    try {
      const permissionRows = await getPermissions();
      setPermissions(permissionRows);
    } catch (err) {
      alert(`Yetki listesi yüklenemedi: ${String(err)}`);
    }
  }

  function openCreateRoleModal() {
    setEditingRoleId(null);
    setRoleEditor({ name: "", description: "", parent_id: undefined });
    setSelectedPermissionIds([]);
    setRoleModalOpen(true);
    void ensureRoleEditorDependencies();
  }

  function openEditRoleModal(row: Role) {
    setEditingRoleId(row.id);
    setRoleEditor({
      name: row.name,
      description: row.description || "",
      parent_id: row.parent_id || undefined,
    });
    setSelectedPermissionIds((row.permissions || []).map((permission) => permission.id));
    setRoleModalOpen(true);
    void ensureRoleEditorDependencies();
  }

  function closeRoleModal() {
    setRoleModalOpen(false);
    setEditingRoleId(null);
    setRoleEditor({ name: "", description: "", parent_id: undefined });
    setSelectedPermissionIds([]);
  }

  async function handleSaveRole() {
    if (editingRoleId != null) {
      setBusy(`edit-role-${editingRoleId}`);
      try {
        await updateRole(editingRoleId, {
          name: roleEditor.name.trim(),
          description: roleEditor.description.trim() || undefined,
          parent_id: roleEditor.parent_id !== undefined ? roleEditor.parent_id : null,
          permission_ids: selectedPermissionIds,
        });
        closeRoleModal();
        await loadScopeData();
      } catch (err) {
        alert(`Rol güncellenemedi: ${String(err)}`);
      } finally {
        setBusy(null);
      }
      return;
    }

    await handleCreateRole();
  }

  function handlePermissionToggle(permissionId: number) {
    setSelectedPermissionIds((prev) => (
      prev.includes(permissionId)
        ? prev.filter((id) => id !== permissionId)
        : [...prev, permissionId]
    ));
  }

  async function handleCreateDepartment() {
    const name = departmentNameInput.trim();
    if (!name) return;
    setBusy("create-department");
    try {
      await createDepartment({
        name,
        tenant_id: activeTenantId ?? undefined,
      });
      setDepartmentNameInput("");
      await loadScopeData();
    } catch (err) {
      alert(`Departman oluşturulamadı: ${String(err)}`);
    } finally {
      setBusy(null);
    }
  }

  async function handleEditRole(row: Role) {
    openEditRoleModal(row);
  }

  async function handleEditDepartment(row: Department) {
    const nextName = prompt("Yeni departman adı", row.name);
    if (!nextName || nextName.trim() === row.name) return;
    setBusy(`edit-department-${row.id}`);
    try {
      await updateDepartment(row.id, { name: nextName.trim() });
      await loadScopeData();
    } catch (err) {
      alert(`Departman güncellenemedi: ${String(err)}`);
    } finally {
      setBusy(null);
    }
  }

  async function handleDeleteRole(row: Role) {
    if (!confirm(`Rol silinsin mi?\n${row.name}`)) return;
    setBusy(`delete-role-${row.id}`);
    try {
      await deleteRole(row.id);
      await loadScopeData();
    } catch (err) {
      alert(`Rol silinemedi: ${String(err)}`);
    } finally {
      setBusy(null);
    }
  }

  async function handleDeleteDepartment(row: Department) {
    if (!confirm(`Departman silinsin mi?\n${row.name}`)) return;
    setBusy(`delete-department-${row.id}`);
    try {
      await deleteDepartment(row.id);
      await loadScopeData();
    } catch (err) {
      alert(`Departman silinemedi: ${String(err)}`);
    } finally {
      setBusy(null);
    }
  }

  async function handleMergeGroup(entity: MergeEntity, normalizedName: string, allItemIds: number[]) {
    const mergeKey = `${entity}:${normalizedName}`;
    const targetId = mergeTargetByGroup[mergeKey];
    if (!targetId) return;
    const sourceIds = allItemIds.filter((id) => id !== targetId);
    if (sourceIds.length === 0) {
      alert("Birleştirme için en az bir kaynak seçilmelidir");
      return;
    }
    if (!confirm(`Birleştirme onayi\nHedef ID: ${targetId}\nKaynak ID: ${sourceIds.join(", ")}`)) {
      return;
    }

    setBusy(`merge-${mergeKey}`);
    try {
      const result = await applyCatalogMerge({
        entity_type: entity,
        target_id: targetId,
        source_ids: sourceIds,
      });
      setLastMergeResult((prev) => ({ ...prev, [entity]: result }));
      await loadScopeData();
    } catch (err) {
      alert(`Merge başarısız: ${String(err)}`);
    } finally {
      setBusy(null);
    }
  }

  async function handleRollback(entity: MergeEntity) {
    const mergeResult = lastMergeResult[entity];
    if (!mergeResult?.rollback_token) return;
    if (!confirm("Son birleştirme geri alınsın mi?")) return;
    setBusy(`rollback-${entity}`);
    try {
      await rollbackCatalogMerge(mergeResult.rollback_token);
      setLastMergeResult((prev) => ({ ...prev, [entity]: undefined }));
      await loadScopeData();
    } catch (err) {
      alert(`Rollback başarısız: ${String(err)}`);
    } finally {
      setBusy(null);
    }
  }

  function renderMergeSection(entity: MergeEntity, preview: CatalogMergePreview | null) {
    const title = entity === "role" ? "Duplicate Rol Grupları" : "Duplicate Departman Grupları";
    const groups = preview?.groups || [];

    return (
      <section style={{ border: "1px solid #e2e8f0", borderRadius: 14, background: "#ffffff", padding: 14, display: "grid", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 900, color: "#0f172a" }}>{title}</div>
            <div style={{ color: "#64748b", fontSize: 12 }}>{groups.length} grup bulundu</div>
          </div>
          {lastMergeResult[entity]?.rollback_token ? (
            <button
              type="button"
              onClick={() => { void handleRollback(entity); }}
              disabled={Boolean(busy)}
              style={{ borderRadius: 8, border: "1px solid #f59e0b", background: "#fffbeb", color: "#92400e", padding: "8px 12px", fontWeight: 800, cursor: "pointer" }}
            >
              Son Birlesmeyi Geri Al
            </button>
          ) : null}
        </div>

        {groups.length === 0 ? (
          <div style={{ borderRadius: 10, background: "#f8fafc", border: "1px dashed #cbd5e1", padding: 10, color: "#64748b", fontSize: 13 }}>
            Bu bölümde birleştirme gerektiren duplicate kayıt yok.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {groups.map((group) => {
              const mergeKey = `${entity}:${group.normalized_name}`;
              const selectedTarget = mergeTargetByGroup[mergeKey] || group.items[0]?.id;
              return (
                <div key={mergeKey} style={{ borderRadius: 10, border: "1px solid #e2e8f0", padding: 10, display: "grid", gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 800, color: "#1e293b" }}>{group.normalized_name}</div>
                    <div style={{ color: "#64748b", fontSize: 12 }}>Atama etkisi: {group.impacted_assignment_count}</div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 1fr) auto", gap: 8 }}>
                    <select
                      value={selectedTarget || ""}
                      onChange={(event) => {
                        const next = Number(event.target.value);
                        setMergeTargetByGroup((prev) => ({ ...prev, [mergeKey]: next }));
                      }}
                      style={{ borderRadius: 8, border: "1px solid #cbd5e1", padding: 8 }}
                    >
                      {group.items.map((item) => (
                        <option key={item.id} value={item.id}>{item.name} (id: {item.id})</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={Boolean(busy)}
                      onClick={() => {
                        void handleMergeGroup(entity, group.normalized_name, group.items.map((item) => item.id));
                      }}
                      style={{ borderRadius: 8, border: "none", background: "#0f172a", color: "white", padding: "8px 12px", fontWeight: 800, cursor: "pointer" }}
                    >
                      Grupları Birleştir
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    );
  }

  const sectionColor = scopeColor(activeScope);

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <PageHeader
        eyebrow="Yönetişim"
        title="Roller & Yetkiler"
        sub="Scope ayrışmalı rol ve departman kataloğu — platform, partner, tedarikçi, kanal"
      />
      <div className="kpi-grid kpi-grid--2">
        <StatCard label="Toplam Rol" value={roles.length} accent="blue" sub="Katalogdaki rol tanımları" />
        <StatCard label="Toplam Departman" value={departments.length} accent="teal" sub="Katalogdaki departman tanımları" />
      </div>
      <section style={{ borderRadius: 16, border: `1px solid ${sectionColor}33`, background: "#f8fafc", padding: 14, display: "grid", gap: 10 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {visibleScopes.map((scope) => (
            <button
              key={scope}
              type="button"
              onClick={() => setActiveScope(scope)}
              style={{
                borderRadius: 999,
                border: activeScope === scope ? `2px solid ${scopeColor(scope)}` : "1px solid #d1d5db",
                background: activeScope === scope ? "#ffffff" : "#f8fafc",
                color: activeScope === scope ? scopeColor(scope) : "#475569",
                padding: "8px 12px",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              {SCOPE_TITLES[scope]}
            </button>
          ))}
        </div>

        {!canViewAllScopes ? (
          <div style={{ borderRadius: 12, background: "#ffffff", border: "1px solid #dbeafe", padding: 12, color: "#334155", fontSize: 13 }}>
            Bu kullanıcı yalnızca kendi kapsamındaki organizasyon, rol, departman ve alt açılımları görebilir.
          </div>
        ) : null}

        {canManage ? (
          <div style={{ borderRadius: 12, background: "#f0fdfa", border: "1px solid #99f6e4", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <div style={{ color: "#0f766e", fontSize: 13 }}>
              {activeScope === "supplier"
                ? "v3 tedarikçi rol kataloğu: İK Yöneticisi, İK Uzmanı dahil 12 rol. (Eski roller silinir.)"
                : activeScope === "platform"
                  ? "v3 platform rol kataloğu: Platform İK Admin dahil 15 platform rolü. (Eski roller silinir.)"
                  : activeScope === "partner"
                    ? "v3 partner rol kataloğu: İK Yöneticisi, İK Uzmanı dahil 14 rol. (Eski roller silinir.)"
                    : activeScope === "career"
                      ? "v3 kariyer rol kataloğu: İşveren Admin, İşveren Recruiter, Aday, Satın Alma Yeteneği — 4 rol. (Eski roller silinir.)"
                      : "v3 kanal rol kataloğu: İK Yöneticisi dahil 6 kanal rolü. (Eski roller silinir.)"}
            </div>
            <button
              type="button"
              onClick={() => { void handleSeedCatalogs(); }}
              disabled={seedingCatalog}
              style={{ borderRadius: 8, border: "none", background: "#0f766e", color: "#ffffff", padding: "8px 14px", fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap", opacity: seedingCatalog ? 0.6 : 1 }}
            >
              {seedingCatalog ? "Yükleniyor…" : "Kataloğu Sıfırla ve Yükle"}
            </button>
          </div>
        ) : null}
      </section>

      {error ? (
        <div style={{ borderRadius: 12, background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", padding: 12 }}>
          {error}
        </div>
      ) : null}

      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>

        <div style={{ borderRadius: 14, border: "1px solid #e2e8f0", background: "#ffffff", padding: 14, display: "grid", gap: 10 }}>
          <div style={{ fontWeight: 900, color: "#0f172a" }}>Roller</div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ color: "#64748b", fontSize: 12 }}>
              {activeScope === "platform"
                ? "Platform rol yapısı"
                : `${SCOPE_TITLES[activeScope]} kataloğu`}
            </div>
            <button
              type="button"
              onClick={openCreateRoleModal}
              disabled={!canManage || Boolean(busy) || loading}
              style={{ borderRadius: 8, border: "none", background: "#2563eb", color: "white", padding: "8px 12px", fontWeight: 800, cursor: "pointer" }}
            >
              Yeni Rol Ekle
            </button>
          </div>

          <div style={{ display: "grid", gap: 8, maxHeight: 320, overflowY: "auto" }}>
            {roleTree.map((row) => {
              const parentRole = roles.find((candidate) => candidate.id === row.parent_id);
              return (
              <div key={row.id} style={{ borderRadius: 10, border: "1px solid #e2e8f0", padding: 10, display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginLeft: `${Math.min(Math.max(row.hierarchy_level - 1, 0) * 14, 56)}px`, background: row.childCount > 0 ? "#f8fafc" : "#ffffff" }}>
                <div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 800, color: "#0f172a" }}>{row.name}</div>
                    <span style={{ borderRadius: 999, background: `${sectionColor}14`, color: sectionColor, padding: "3px 8px", fontSize: 11, fontWeight: 800 }}>
                      L{row.hierarchy_level}
                    </span>
                  </div>
                  <div style={{ color: "#64748b", fontSize: 12 }}>
                    id: {row.id} • üst rol: {parentRole?.name || "Kök"} • alt rol: {row.childCount}
                  </div>
                </div>
                {canManage ? (
                  <div style={{ display: "flex", gap: 6 }}>
                    <button type="button" onClick={() => { void handleEditRole(row); }} disabled={Boolean(busy)} style={{ borderRadius: 8, border: "1px solid #93c5fd", background: "#eff6ff", color: "#1d4ed8", padding: "6px 10px", fontWeight: 700, cursor: "pointer" }}>Düzenle</button>
                    <button type="button" onClick={() => { void handleDeleteRole(row); }} disabled={Boolean(busy)} style={{ borderRadius: 8, border: "1px solid #fca5a5", background: "#fef2f2", color: "#b91c1c", padding: "6px 10px", fontWeight: 700, cursor: "pointer" }}>Sil</button>
                  </div>
                ) : null}
              </div>
            );})}
            {roles.length === 0 ? <div style={{ color: "#64748b", fontSize: 13 }}>Rol kaydı yok.</div> : null}
          </div>

          {isSuperAdmin ? renderMergeSection("role", roleMergePreview) : null}
        </div>

        <div style={{ borderRadius: 14, border: "1px solid #e2e8f0", background: "#ffffff", padding: 14, display: "grid", gap: 10 }}>
          <div style={{ fontWeight: 900, color: "#0f172a" }}>Departmanlar</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
            <input
              value={departmentNameInput}
              onChange={(event) => setDepartmentNameInput(event.target.value)}
              placeholder="Yeni departman adı"
              disabled={!canManage || loading}
              style={{ borderRadius: 8, border: "1px solid #cbd5e1", padding: 8 }}
            />
            <button
              type="button"
              onClick={() => { void handleCreateDepartment(); }}
              disabled={!canManage || !departmentNameInput.trim() || Boolean(busy)}
              style={{ borderRadius: 8, border: "none", background: "#059669", color: "white", padding: "8px 12px", fontWeight: 800, cursor: "pointer" }}
            >
              Ekle
            </button>
          </div>

          <div style={{ display: "grid", gap: 8, maxHeight: 320, overflowY: "auto" }}>
            {departmentsWithSubItems.map((row) => (
              <div key={row.id} style={{ borderRadius: 10, border: "1px solid #e2e8f0", padding: 10, display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 800, color: "#0f172a" }}>{row.name}</div>
                  <div style={{ color: "#64748b", fontSize: 12 }}>id: {row.id} • alt açılım: {row.sub_items?.length || 0}</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                    {(row.sub_items || []).map((item) => (
                      <span key={item.id} style={{ borderRadius: 999, background: "#eff6ff", color: "#1d4ed8", padding: "4px 8px", fontSize: 11, fontWeight: 700 }}>
                        {item.name}
                      </span>
                    ))}
                    {!(row.sub_items || []).length ? <span style={{ color: "#94a3b8", fontSize: 12 }}>Alt açılım tanımlı değil</span> : null}
                  </div>
                </div>
                {canManage ? (
                  <div style={{ display: "flex", gap: 6 }}>
                    <button type="button" onClick={() => { void handleEditDepartment(row); }} disabled={Boolean(busy)} style={{ borderRadius: 8, border: "1px solid #93c5fd", background: "#eff6ff", color: "#1d4ed8", padding: "6px 10px", fontWeight: 700, cursor: "pointer" }}>Düzenle</button>
                    <button type="button" onClick={() => { void handleDeleteDepartment(row); }} disabled={Boolean(busy)} style={{ borderRadius: 8, border: "1px solid #fca5a5", background: "#fef2f2", color: "#b91c1c", padding: "6px 10px", fontWeight: 700, cursor: "pointer" }}>Sil</button>
                  </div>
                ) : null}
              </div>
            ))}
            {departments.length === 0 ? <div style={{ color: "#64748b", fontSize: 13 }}>Departman kaydı yok.</div> : null}
          </div>

          {isSuperAdmin ? renderMergeSection("department", departmentMergePreview) : null}
        </div>
      </section>

      <section style={{ borderRadius: 16, border: "1px solid #e2e8f0", background: "#f8fafc", padding: 14, display: "grid", gap: 10 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ fontWeight: 700, color: "#334155", fontSize: 14 }}>Firma Atama Görünümü</div>
          <div style={{ color: "#94a3b8", fontSize: 12 }}>— firma seçerek o firmadaki personel-rol dağılımını görüntüleyin</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "120px 1fr auto", gap: 10, alignItems: "center" }}>
          <div style={{ color: "#334155", fontWeight: 700 }}>Firma</div>
          <select
            aria-label="Firma seç"
            value={activeCompanyId ?? ""}
            onChange={(event) => {
              const nextCompanyId = Number(event.target.value);
              const selected = scopeCompanies.find((company) => company.id === nextCompanyId);
              if (!selected) return;
              setCompanySelection((prev) => ({ ...prev, [activeScope]: nextCompanyId }));
              if (typeof selected.tenant_id === "number") {
                setTenantSelection((prev) => ({ ...prev, [activeScope]: selected.tenant_id as number }));
              }
            }}
            style={{ borderRadius: 10, border: "1px solid #cbd5e1", background: "#ffffff", padding: "10px 12px" }}
          >
            {scopeCompanies.length === 0 ? <option value="">— seçilebilir firma yok —</option> : null}
            {scopeCompanies.map((company) => (
              <option key={company.id} value={company.id}>{company.name}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setSummaryModalOpen(true)}
            disabled={!selectedCompany}
            style={{ borderRadius: 10, border: "1px solid #2563eb", background: "#eff6ff", color: "#1d4ed8", padding: "10px 12px", fontWeight: 800, cursor: "pointer", opacity: selectedCompany ? 1 : 0.6 }}
          >
            Firma Özeti
          </button>
        </div>
      </section>

      {summaryModalOpen ? (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.45)", display: "grid", placeItems: "center", padding: 20, zIndex: 990 }}>
          <div style={{ width: "min(980px, 100%)", maxHeight: "90vh", overflowY: "auto", overflowX: "hidden", borderRadius: 20, background: "#ffffff", border: "1px solid #dbeafe", boxShadow: "0 24px 60px rgba(15, 23, 42, 0.18)", display: "grid", gridTemplateRows: "auto 1fr", gap: 0 }}>
            {/* sticky header — always visible even when scrolled */}
            <div style={{ position: "sticky", top: 0, zIndex: 2, background: "#ffffff", borderRadius: "20px 20px 0 0", borderBottom: "1px solid #e2e8f0", padding: "16px 20px", display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
              <div style={{ minWidth: 0, overflow: "hidden", flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", color: "#2563eb" }}>Firma Özeti</div>
                <div style={{ marginTop: 4, fontSize: 22, fontWeight: 900, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selectedCompany?.name || "Seçili Firma"}</div>
                <div style={{ marginTop: 4, color: "#475569", fontSize: 13 }}>Rol hiyerarşisi, bağlı personel ve departman dağılımı. Atamayı düzenle veya sil.</div>
              </div>
              <button
                type="button"
                onClick={() => { setSummaryModalOpen(false); setEditingPersonKey(null); setEditingNewRoleId(null); }}
                style={{ flexShrink: 0, borderRadius: 999, border: "1px solid #cbd5e1", background: "#f1f5f9", color: "#334155", padding: "8px 16px", fontWeight: 700, cursor: "pointer", fontSize: 14 }}
              >
                ✕ Kapat
              </button>
            </div>

            <div style={{ padding: "16px 20px 20px", display: "grid", gap: 10 }}>
              {companySummaryRows.map((row) => (
                <div key={row.role.id} style={{ borderRadius: 14, border: "1px solid #e2e8f0", background: "#f8fafc", padding: 12, marginLeft: `${Math.min(Math.max(row.role.hierarchy_level - 1, 0) * 12, 48)}px`, display: "grid", gap: 8 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 900, color: "#0f172a" }}>{row.role.name}</div>
                    <span style={{ borderRadius: 999, background: "#eff6ff", color: "#1d4ed8", padding: "3px 8px", fontSize: 11, fontWeight: 800 }}>L{row.role.hierarchy_level}</span>
                    <span style={{ color: "#64748b", fontSize: 12 }}>{row.people.length} personel</span>
                  </div>
                  <div style={{ display: "grid", gap: 6 }}>
                    {row.people.map((person) => {
                      const personKey = `${person.userId}-${row.role.id}`;
                      const isEditing = editingPersonKey === personKey;
                      const firstAssignmentId = person.assignmentIds[0];
                      const hasRealAssignment = typeof firstAssignmentId === "number";
                      return (
                        <div key={personKey} style={{ borderRadius: 10, border: `1px solid ${isEditing ? "#93c5fd" : "#dbeafe"}`, background: isEditing ? "#eff6ff" : "#ffffff", padding: 10, display: "grid", gap: 6 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "start", flexWrap: "wrap" }}>
                            <div style={{ minWidth: 0, overflow: "hidden", flex: 1 }}>
                              <div style={{ fontWeight: 700, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{person.fullName}</div>
                              <div style={{ color: "#64748b", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{person.email}</div>
                            </div>
                            {canManage && hasRealAssignment ? (
                              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                                {!isEditing ? (
                                  <>
                                    <button
                                      type="button"
                                      disabled={Boolean(busy)}
                                      onClick={() => { setEditingPersonKey(personKey); setEditingNewRoleId(row.role.id); }}
                                      style={{ borderRadius: 8, border: "1px solid #93c5fd", background: "#eff6ff", color: "#1d4ed8", padding: "5px 10px", fontWeight: 700, fontSize: 12, cursor: "pointer" }}
                                    >
                                      Düzenle
                                    </button>
                                    <button
                                      type="button"
                                      disabled={Boolean(busy)}
                                      onClick={() => { void handleRemoveAssignment(person.userId, firstAssignmentId); }}
                                      style={{ borderRadius: 8, border: "1px solid #fca5a5", background: "#fef2f2", color: "#b91c1c", padding: "5px 10px", fontWeight: 700, fontSize: 12, cursor: "pointer" }}
                                    >
                                      Sil
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      disabled={Boolean(busy) || editingNewRoleId === row.role.id}
                                      onClick={() => { if (editingNewRoleId !== null) void handleReassignPerson(person.userId, firstAssignmentId, editingNewRoleId); }}
                                      style={{ borderRadius: 8, border: "none", background: "#2563eb", color: "#fff", padding: "5px 10px", fontWeight: 700, fontSize: 12, cursor: "pointer", opacity: editingNewRoleId === row.role.id ? 0.5 : 1 }}
                                    >
                                      Kaydet
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => { setEditingPersonKey(null); setEditingNewRoleId(null); }}
                                      style={{ borderRadius: 8, border: "1px solid #cbd5e1", background: "#f8fafc", color: "#334155", padding: "5px 10px", fontWeight: 700, fontSize: 12, cursor: "pointer" }}
                                    >
                                      İptal
                                    </button>
                                  </>
                                )}
                              </div>
                            ) : null}
                          </div>
                          {isEditing ? (
                            <div style={{ display: "grid", gap: 6 }}>
                              <div style={{ fontSize: 12, color: "#334155", fontWeight: 600 }}>Yeni rol seç:</div>
                              <select
                                aria-label="Yeni rol seç"
                                value={editingNewRoleId ?? ""}
                                onChange={(e) => setEditingNewRoleId(Number(e.target.value))}
                                style={{ borderRadius: 8, border: "1px solid #93c5fd", padding: "8px 10px", fontSize: 13 }}
                              >
                                {roles.map((r) => (
                                  <option key={r.id} value={r.id}>{r.name} (L{r.hierarchy_level})</option>
                                ))}
                              </select>
                            </div>
                          ) : null}
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {person.departments.map((departmentName) => (
                              <span key={`${person.userId}-${departmentName}`} style={{ borderRadius: 999, background: "#ecfeff", color: "#0f766e", padding: "3px 8px", fontSize: 11, fontWeight: 700 }}>
                                {departmentName}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              {companySummaryRows.length === 0 ? (
                <div style={{ borderRadius: 12, border: "1px dashed #cbd5e1", background: "#f8fafc", color: "#64748b", fontSize: 13, padding: 12 }}>
                  Seçili firmada rol-personel eşleşmesi bulunamadı.
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {roleModalOpen ? (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.45)", display: "grid", placeItems: "center", padding: 20, zIndex: 1000 }}>
          <div style={{ width: "min(960px, 100%)", maxHeight: "90vh", overflowY: "auto", borderRadius: 20, background: "#ffffff", border: "1px solid #dbeafe", boxShadow: "0 24px 60px rgba(15, 23, 42, 0.18)", padding: 20, display: "grid", gap: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", color: "#2563eb" }}>Rol Editoru</div>
                <div style={{ marginTop: 4, fontSize: 24, fontWeight: 900, color: "#0f172a" }}>{editingRoleId ? "Rol Düzenle" : "Yeni Rol Ekle"}</div>
                <div style={{ marginTop: 6, color: "#475569", fontSize: 13 }}>Rol adı, hiyerarşi konumu ve yetki setini tek pencerede düzenleyin.</div>
              </div>
              <button type="button" onClick={closeRoleModal} style={{ borderRadius: 999, border: "1px solid #cbd5e1", background: "#ffffff", color: "#334155", padding: "8px 12px", fontWeight: 700, cursor: "pointer" }}>
                Kapat
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 16 }}>
              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ display: "grid", gap: 6 }}>
                  <label htmlFor="governance-role-name" style={{ color: "#334155", fontWeight: 700 }}>Rol Adi</label>
                  <input
                    id="governance-role-name"
                    value={roleEditor.name}
                    onChange={(event) => setRoleEditor((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder="Or: Satin Alma Grup Lideri"
                    style={{ borderRadius: 10, border: "1px solid #cbd5e1", padding: "10px 12px" }}
                  />
                </div>

                <div style={{ display: "grid", gap: 6 }}>
                  <label htmlFor="governance-role-description" style={{ color: "#334155", fontWeight: 700 }}>Rol Açıklaması</label>
                  <textarea
                    id="governance-role-description"
                    value={roleEditor.description}
                    onChange={(event) => setRoleEditor((prev) => ({ ...prev, description: event.target.value }))}
                    placeholder="Bu rol hangi operasyonu yönetir?"
                    rows={3}
                    style={{ borderRadius: 10, border: "1px solid #cbd5e1", padding: "10px 12px", resize: "vertical" }}
                  />
                </div>

                <div style={{ display: "grid", gap: 6 }}>
                  <label htmlFor="governance-role-parent" style={{ color: "#334155", fontWeight: 700 }}>Hiyerarsi Konumu</label>
                  <select
                    id="governance-role-parent"
                    value={roleEditor.parent_id || ""}
                    onChange={(event) => setRoleEditor((prev) => ({
                      ...prev,
                      parent_id: event.target.value ? Number(event.target.value) : undefined,
                    }))}
                    style={{ borderRadius: 10, border: "1px solid #cbd5e1", padding: "10px 12px" }}
                  >
                    <option value="">Kök rol</option>
                    {roleParentOptions.map((role) => (
                      <option key={role.id} value={role.id}>
                        {`L${role.hierarchy_level} - ${role.name}`}
                      </option>
                    ))}
                  </select>
                  <div style={{ borderRadius: 12, border: "1px solid #dbeafe", background: "#f8fbff", padding: "10px 12px", color: "#1e3a8a", fontSize: 13, fontWeight: 700 }}>
                    Bu seçimle rol seviyesi: L{computedHierarchyLevel}
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                <div>
                  <div style={{ color: "#334155", fontWeight: 700 }}>Yetkiler</div>
                  <div style={{ color: "#64748b", fontSize: 12 }}>Role atanacak izinleri seçin.</div>
                </div>
                <div style={{ display: "grid", gap: 8, maxHeight: 380, overflowY: "auto", borderRadius: 14, border: "1px solid #e2e8f0", background: "#f8fafc", padding: 10 }}>
                  {permissions.map((permission) => {
                    const checked = selectedPermissionIds.includes(permission.id);
                    return (
                      <label key={permission.id} style={{ display: "flex", gap: 10, alignItems: "start", borderRadius: 10, border: checked ? "1px solid #93c5fd" : "1px solid #e2e8f0", background: checked ? "#eff6ff" : "#ffffff", padding: 10, cursor: "pointer" }}>
                        <input type="checkbox" checked={checked} onChange={() => handlePermissionToggle(permission.id)} style={{ marginTop: 2 }} />
                        <div style={{ display: "grid", gap: 2 }}>
                          <div style={{ fontWeight: 700, color: "#0f172a", fontSize: 13 }}>{permission.description || permission.name}</div>
                          {permission.tooltip || permission.name ? <div style={{ color: "#64748b", fontSize: 11 }}>{permission.tooltip || permission.name}</div> : null}
                        </div>
                      </label>
                    );
                  })}
                  {permissions.length === 0 ? <div style={{ color: "#64748b", fontSize: 13 }}>Yetki listesi yükleniyor veya bulunamadı.</div> : null}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button type="button" onClick={closeRoleModal} style={{ borderRadius: 10, border: "1px solid #cbd5e1", background: "#ffffff", color: "#334155", padding: "10px 14px", fontWeight: 700, cursor: "pointer" }}>
                İptal
              </button>
              <button type="button" onClick={() => { void handleSaveRole(); }} disabled={!roleEditor.name.trim() || Boolean(busy)} style={{ borderRadius: 10, border: "none", background: "#2563eb", color: "#ffffff", padding: "10px 14px", fontWeight: 800, cursor: "pointer", opacity: !roleEditor.name.trim() || Boolean(busy) ? 0.6 : 1 }}>
                {editingRoleId ? "Rolü Güncelle" : "Rolü Kaydet"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}


