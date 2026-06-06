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
import "./RoleDepartmentGovernanceTab.css";

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
  supplier: "Tedarikci Rolleri",
  channel: "Is Ortagi Rolleri",
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
      return ["partner", "supplier", "channel", "platform", "career"];
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
      <section className="rdg-merge-section">
        <div className="rdg-merge-section__head">
          <div>
            <div className="rdg-merge-section__title">{title}</div>
            <div className="rdg-merge-section__sub">{groups.length} grup bulundu</div>
          </div>
          {lastMergeResult[entity]?.rollback_token ? (
            <button
              type="button"
              onClick={() => { void handleRollback(entity); }}
              disabled={Boolean(busy)}
              className="rdg-btn rdg-btn--warn"
            >
              Son Birlesmeyi Geri Al
            </button>
          ) : null}
        </div>

        {groups.length === 0 ? (
          <div className="rdg-merge-empty">
            Bu bölümde birleştirme gerektiren duplicate kayıt yok.
          </div>
        ) : (
          <div className="rdg-merge-groups">
            {groups.map((group) => {
              const mergeKey = `${entity}:${group.normalized_name}`;
              const selectedTarget = mergeTargetByGroup[mergeKey] || group.items[0]?.id;
              return (
                <div key={mergeKey} className="rdg-merge-group">
                  <div className="rdg-merge-group__head">
                    <div className="rdg-merge-group__name">{group.normalized_name}</div>
                    <div className="rdg-merge-group__info">Atama etkisi: {group.impacted_assignment_count}</div>
                  </div>

                  <div className="rdg-merge-group__row">
                    <select
                      aria-label="Birleştirme hedefini seç"
                      value={selectedTarget || ""}
                      onChange={(event) => {
                        const next = Number(event.target.value);
                        setMergeTargetByGroup((prev) => ({ ...prev, [mergeKey]: next }));
                      }}
                      className="rdg-select"
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
                      className="rdg-btn rdg-btn--dark"
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

  return (
    <div className="rdg-tab">
      <PageHeader
        eyebrow="Yönetişim"
        title="Roller & Yetkiler"
        sub="Scope ayrışmalı rol ve departman kataloğu — platform, partner, tedarikçi, kanal"
      />
      <div className="kpi-grid kpi-grid--2">
        <StatCard label="Toplam Rol" value={roles.length} accent="blue" sub="Katalogdaki rol tanımları" />
        <StatCard label="Toplam Departman" value={departments.length} accent="teal" sub="Katalogdaki departman tanımları" />
      </div>

      <section className={`rdg-scope-section rdg-scope-section--${activeScope}`}>
        <div className="rdg-scope-tabs">
          {visibleScopes.map((scope) => (
            <button
              key={scope}
              type="button"
              onClick={() => setActiveScope(scope)}
              className={`rdg-scope-btn${activeScope === scope ? ` rdg-scope-btn--active rdg-scope-btn--active-${scope}` : ""}`}
            >
              {SCOPE_TITLES[scope]}
            </button>
          ))}
        </div>

        {!canViewAllScopes ? (
          <div className="rdg-scope-info">
            Bu kullanıcı yalnızca kendi kapsamındaki organizasyon, rol, departman ve alt açılımları görebilir.
          </div>
        ) : null}

        {canManage ? (
          <div className="rdg-catalog-bar">
            <div className="rdg-catalog-bar__text">
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
              className="rdg-catalog-btn"
            >
              {seedingCatalog ? "Yükleniyor…" : "Kataloğu Sıfırla ve Yükle"}
            </button>
          </div>
        ) : null}
      </section>

      {error ? (
        <div className="rdg-error">{error}</div>
      ) : null}

      <section className="rdg-cols">

        <div className="rdg-panel">
          <div className="rdg-panel__title">Roller</div>
          <div className="rdg-panel__head">
            <div className="rdg-panel__sub">
              {activeScope === "platform"
                ? "Platform rol yapısı"
                : `${SCOPE_TITLES[activeScope]} kataloğu`}
            </div>
            <button
              type="button"
              onClick={openCreateRoleModal}
              disabled={!canManage || Boolean(busy) || loading}
              className="rdg-btn rdg-btn--add"
            >
              Yeni Rol Ekle
            </button>
          </div>

          <div className="rdg-list">
            {roleTree.map((row) => {
              const parentRole = roles.find((candidate) => candidate.id === row.parent_id);
              return (
                <div
                  key={row.id}
                  className={`rdg-row${row.childCount > 0 ? " rdg-row--has-children" : ""} rdg-indent-${Math.min(Math.max(row.hierarchy_level - 1, 0), 4)}`}
                >
                  <div className="rdg-row__left">
                    <div className="rdg-row__head">
                      <div className="rdg-row__name">{row.name}</div>
                      <span className={`rdg-level-badge rdg-level-badge--${activeScope}`}>
                        L{row.hierarchy_level}
                      </span>
                    </div>
                    <div className="rdg-row__meta">
                      id: {row.id} • ust rol: {parentRole?.name || "Kok"} • alt rol: {row.childCount}
                    </div>
                  </div>
                  {canManage ? (
                    <div className="rdg-row__actions">
                      <button type="button" onClick={() => { void handleEditRole(row); }} disabled={Boolean(busy)} className="rdg-btn rdg-btn--edit">Düzenle</button>
                      <button type="button" onClick={() => { void handleDeleteRole(row); }} disabled={Boolean(busy)} className="rdg-btn rdg-btn--del">Sil</button>
                    </div>
                  ) : null}
                </div>
              );
            })}
            {roles.length === 0 ? <div className="rdg-empty-text">Rol kaydı yok.</div> : null}
          </div>

          {isSuperAdmin ? renderMergeSection("role", roleMergePreview) : null}
        </div>

        <div className="rdg-panel">
          <div className="rdg-panel__title">Departmanlar</div>
          <div className="rdg-input-row">
            <input
              value={departmentNameInput}
              onChange={(event) => setDepartmentNameInput(event.target.value)}
              placeholder="Yeni departman adı"
              disabled={!canManage || loading}
              className="rdg-input"
            />
            <button
              type="button"
              onClick={() => { void handleCreateDepartment(); }}
              disabled={!canManage || !departmentNameInput.trim() || Boolean(busy)}
              className="rdg-btn rdg-btn--save"
            >
              Ekle
            </button>
          </div>

          <div className="rdg-list">
            {departmentsWithSubItems.map((row) => (
              <div key={row.id} className="rdg-row">
                <div className="rdg-row__left">
                  <div className="rdg-row__name">{row.name}</div>
                  <div className="rdg-row__meta">id: {row.id} • alt açılım: {row.sub_items?.length || 0}</div>
                  <div className="rdg-row__tags">
                    {(row.sub_items || []).map((item) => (
                      <span key={item.id} className="rdg-tag rdg-tag--blue">
                        {item.name}
                      </span>
                    ))}
                    {!(row.sub_items || []).length ? <span className="rdg-empty-inline">Alt açılım tanımlı değil</span> : null}
                  </div>
                </div>
                {canManage ? (
                  <div className="rdg-row__actions">
                    <button type="button" onClick={() => { void handleEditDepartment(row); }} disabled={Boolean(busy)} className="rdg-btn rdg-btn--edit">Düzenle</button>
                    <button type="button" onClick={() => { void handleDeleteDepartment(row); }} disabled={Boolean(busy)} className="rdg-btn rdg-btn--del">Sil</button>
                  </div>
                ) : null}
              </div>
            ))}
            {departments.length === 0 ? <div className="rdg-empty-text">Departman kaydı yok.</div> : null}
          </div>

          {isSuperAdmin ? renderMergeSection("department", departmentMergePreview) : null}
        </div>
      </section>

      <section className="rdg-assign-section">
        <div className="rdg-assign-section__head">
          <div className="rdg-assign-section__title">Firma Atama Görünümü</div>
          <div className="rdg-assign-section__hint">— firma seçerek o firmadaki personel-rol dağılımını görüntüleyin</div>
        </div>
        <div className="rdg-assign-row">
          <div className="rdg-assign-label">Firma</div>
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
            className="rdg-select"
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
            className="rdg-btn rdg-btn--outline"
          >
            Firma Özeti
          </button>
        </div>
      </section>

      {summaryModalOpen ? (
        <div className="rdg-overlay">
          <div className="rdg-modal">
            <div className="rdg-modal__header rdg-modal__header--sticky">
              <div className="rdg-modal__header-text">
                <div className="rdg-modal__eyebrow">Firma Özeti</div>
                <div className="rdg-modal__title">{selectedCompany?.name || "Seçili Firma"}</div>
                <div className="rdg-modal__sub">Rol hiyerarşisi, bağlı personel ve departman dağılımı. Atamayı düzenle veya sil.</div>
              </div>
              <button
                type="button"
                onClick={() => { setSummaryModalOpen(false); setEditingPersonKey(null); setEditingNewRoleId(null); }}
                className="rdg-btn--close"
              >
                ✕ Kapat
              </button>
            </div>

            <div className="rdg-modal__body">
              {companySummaryRows.map((row) => (
                <div
                  key={row.role.id}
                  className={`rdg-summary-group rdg-summary-indent-${Math.min(Math.max(row.role.hierarchy_level - 1, 0), 4)}`}
                >
                  <div className="rdg-summary-group__head">
                    <div className="rdg-summary-group__role">{row.role.name}</div>
                    <span className="rdg-level-badge rdg-level-badge--blue">L{row.role.hierarchy_level}</span>
                    <span className="rdg-summary-group__count">{row.people.length} personel</span>
                  </div>
                  <div className="rdg-person-list">
                    {row.people.map((person) => {
                      const personKey = `${person.userId}-${row.role.id}`;
                      const isEditing = editingPersonKey === personKey;
                      const firstAssignmentId = person.assignmentIds[0];
                      const hasRealAssignment = typeof firstAssignmentId === "number";
                      return (
                        <div key={personKey} className={`rdg-person-card${isEditing ? " rdg-person-card--editing" : ""}`}>
                          <div className="rdg-person-card__head">
                            <div className="rdg-person-info">
                              <div className="rdg-person-info__name">{person.fullName}</div>
                              <div className="rdg-person-info__email">{person.email}</div>
                            </div>
                            {canManage && hasRealAssignment ? (
                              <div className="rdg-person-card__actions">
                                {!isEditing ? (
                                  <>
                                    <button
                                      type="button"
                                      disabled={Boolean(busy)}
                                      onClick={() => { setEditingPersonKey(personKey); setEditingNewRoleId(row.role.id); }}
                                      className="rdg-btn rdg-btn--edit rdg-btn--sm"
                                    >
                                      Düzenle
                                    </button>
                                    <button
                                      type="button"
                                      disabled={Boolean(busy)}
                                      onClick={() => { void handleRemoveAssignment(person.userId, firstAssignmentId); }}
                                      className="rdg-btn rdg-btn--del rdg-btn--sm"
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
                                      className="rdg-btn rdg-btn--save-primary rdg-btn--sm"
                                    >
                                      Kaydet
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => { setEditingPersonKey(null); setEditingNewRoleId(null); }}
                                      className="rdg-btn rdg-btn--cancel rdg-btn--sm"
                                    >
                                      İptal
                                    </button>
                                  </>
                                )}
                              </div>
                            ) : null}
                          </div>
                          {isEditing ? (
                            <div className="rdg-reassign">
                              <div className="rdg-reassign__label">Yeni rol seç:</div>
                              <select
                                aria-label="Yeni rol seç"
                                value={editingNewRoleId ?? ""}
                                onChange={(e) => setEditingNewRoleId(Number(e.target.value))}
                                className="rdg-select"
                              >
                                {roles.map((r) => (
                                  <option key={r.id} value={r.id}>{r.name} (L{r.hierarchy_level})</option>
                                ))}
                              </select>
                            </div>
                          ) : null}
                          <div className="rdg-person-card__tags">
                            {person.departments.map((departmentName) => (
                              <span key={`${person.userId}-${departmentName}`} className="rdg-tag rdg-tag--teal">
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
                <div className="rdg-modal-empty">
                  Seçili firmada rol-personel eşleşmesi bulunamadı.
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {roleModalOpen ? (
        <div className="rdg-overlay rdg-overlay--top">
          <div className="rdg-modal rdg-modal--role">
            <div className="rdg-modal__header">
              <div className="rdg-modal__header-text">
                <div className="rdg-modal__eyebrow">Rol Editoru</div>
                <div className="rdg-modal__title rdg-modal__title--lg">{editingRoleId ? "Rol Düzenle" : "Yeni Rol Ekle"}</div>
                <div className="rdg-modal__sub">Rol adı, hiyerarşi konumu ve yetki setini tek pencerede düzenleyin.</div>
              </div>
              <button type="button" onClick={closeRoleModal} className="rdg-btn--close">
                Kapat
              </button>
            </div>

            <div className="rdg-modal__cols">
              <div className="rdg-modal__form-col">
                <div className="rdg-field">
                  <label htmlFor="governance-role-name" className="rdg-label">Rol Adi</label>
                  <input
                    id="governance-role-name"
                    value={roleEditor.name}
                    onChange={(event) => setRoleEditor((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder="Or: Satin Alma Grup Lideri"
                    className="rdg-input"
                  />
                </div>

                <div className="rdg-field">
                  <label htmlFor="governance-role-description" className="rdg-label">Rol Açıklaması</label>
                  <textarea
                    id="governance-role-description"
                    value={roleEditor.description}
                    onChange={(event) => setRoleEditor((prev) => ({ ...prev, description: event.target.value }))}
                    placeholder="Bu rol hangi operasyonu yönetir?"
                    rows={3}
                    className="rdg-textarea"
                  />
                </div>

                <div className="rdg-field">
                  <label htmlFor="governance-role-parent" className="rdg-label">Hiyerarsi Konumu</label>
                  <select
                    id="governance-role-parent"
                    value={roleEditor.parent_id || ""}
                    onChange={(event) => setRoleEditor((prev) => ({
                      ...prev,
                      parent_id: event.target.value ? Number(event.target.value) : undefined,
                    }))}
                    className="rdg-select"
                  >
                    <option value="">Kök rol</option>
                    {roleParentOptions.map((role) => (
                      <option key={role.id} value={role.id}>
                        {`L${role.hierarchy_level} - ${role.name}`}
                      </option>
                    ))}
                  </select>
                  <div className="rdg-hierarchy-info">
                    Bu seçimle rol seviyesi: L{computedHierarchyLevel}
                  </div>
                </div>
              </div>

              <div className="rdg-modal__perm-col">
                <div className="rdg-modal__perm-head">
                  <div className="rdg-modal__perm-title">Yetkiler</div>
                  <div className="rdg-modal__perm-sub">Role atanacak izinleri seçin.</div>
                </div>
                <div className="rdg-perm-list">
                  {permissions.map((permission) => {
                    const checked = selectedPermissionIds.includes(permission.id);
                    return (
                      <label key={permission.id} className={`rdg-perm-item${checked ? " rdg-perm-item--checked" : ""}`}>
                        <input type="checkbox" checked={checked} onChange={() => handlePermissionToggle(permission.id)} />
                        <div className="rdg-perm-item__body">
                          <div className="rdg-perm-item__title">{permission.description || permission.name}</div>
                          {permission.tooltip || permission.name ? <div className="rdg-perm-item__sub">{permission.tooltip || permission.name}</div> : null}
                        </div>
                      </label>
                    );
                  })}
                  {permissions.length === 0 ? <div className="rdg-perm-empty">Yetki listesi yükleniyor veya bulunamadı.</div> : null}
                </div>
              </div>
            </div>

            <div className="rdg-modal__footer">
              <button type="button" onClick={closeRoleModal} className="rdg-btn rdg-btn--cancel">
                İptal
              </button>
              <button
                type="button"
                onClick={() => { void handleSaveRole(); }}
                disabled={!roleEditor.name.trim() || Boolean(busy)}
                className="rdg-btn rdg-btn--save-primary"
              >
                {editingRoleId ? "Rolu Guncelle" : "Rolu Kaydet"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
