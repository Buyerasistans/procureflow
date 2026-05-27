import type { ApprovalRoleInfo } from "../types/approval";

// FILE: web\src\auth\permissions.ts
import type { PermissionCatalogNode, RolePermissionMatrixRow as ApiRolePermissionMatrixRow } from "../services/admin.service";
export type Role =
  | "admin"
  | "super_admin"
  | "user"
  | "manager"
  | "buyer"
  | "employee"
  | "department_manager"
  | "company_manager"
  | "supplier"
  | "satinalma_direktoru"
  | "satinalma_yoneticisi"
  | "satinalma_uzmani"
  | "satinalmaci"
  | "channel_owner"
  | "channel_agent"
  | "supplier_admin"
  | "supplier_user";

export type Permission =
  | "view:dashboard"
  | "view:admin"
  | "view:workspace-panel"
  | "view:reports"
  | "manage:users";

type PermissionContext = {
  role?: Role | string | null;
  business_role?: string | null;
  system_role?: string | null;
};

export type PersonnelSystemRole = "tenant_admin" | "platform_support" | "platform_operator" | "super_admin" | "";

const rolePermissions: Record<Role, Permission[]> = {
  super_admin: ["view:dashboard", "view:admin", "view:reports", "manage:users"],
  admin: ["view:dashboard", "view:admin", "view:reports", "manage:users"],
  manager: ["view:dashboard", "view:reports"],
  buyer: ["view:dashboard"],
  department_manager: ["view:dashboard", "view:reports"],
  company_manager: ["view:dashboard", "view:reports"],
  satinalma_direktoru: ["view:dashboard", "view:reports"],
  satinalma_yoneticisi: ["view:dashboard", "view:reports"],
  satinalma_uzmani: ["view:dashboard"],
  satinalmaci: ["view:dashboard"],
  supplier: ["view:dashboard"],
  employee: ["view:dashboard"],
  user: ["view:dashboard"],
  channel_owner: ["view:dashboard"],
  channel_agent: ["view:dashboard"],
  supplier_admin: ["view:dashboard"],
  supplier_user: ["view:dashboard"],
};
const roleLabels: Record<string, string> = {
  super_admin: "Süper Admin",
  admin: "Admin",
  tenant_owner: "Tenant Sahibi",
  tenant_admin: "Tenant Admin",
  tenant_member: "Tenant Üyesi",
  platform_support: "Platform Destek",
  platform_operator: "Platform Operasyon",
  // Stratejik Partner v2
  partner_admin: "Partner Admin",
  satinalma_direktoru: "Satın Alma Direktörü",
  satinalma_muduru: "Satın Alma Müdürü",
  satinalma_mudur_yrd: "Satın Alma Müdür Yardımcısı",
  satinalma_yoneticisi: "Satın Alma Yöneticisi",
  satinalma_kidemli_uzmani: "Satın Alma Kıdemli Uzmanı",
  satinalma_uzman_yrd: "Satın Alma Uzman Yardımcısı",
  satinalma_uzmani: "Satın Alma Uzmanı",
  proje_mimari: "Proje Mimarı",
  teknik_uzman: "Teknik Uzman",
  ozel_partner_rolu: "Özel Stratejik Partner Rolü",
  finans_izleyici: "Finans İzleyici",
  // Kanal v2
  kanal_hesap_sahibi: "Kanal Hesap Sahibi",
  kanal_ekip_lideri: "Kanal Ekip Lideri",
  kanal_temsilcisi: "Kanal Temsilcisi",
  kanal_finans: "Kanal Finans",
  ozel_kanal_rolu: "Özel Kanal Rolü",
  // Eski / genel
  satinalmaci: "Satın Almacı",
  manager: "Yönetici",
  buyer: "Satın Alma",
  employee: "Çalışan",
  department_manager: "Departman Yöneticisi",
  company_manager: "Şirket Yöneticisi",
  supplier: "Tedarikçi",
  supplier_admin: "Tedarikçi Yöneticisi",
  supplier_user: "Tedarikçi Kullanıcısı",
  channel_owner: "Kanal Hesap Sahibi",
  channel_agent: "Kanal Temsilcisi",
  user: "Kullanıcı",
};

const roleIcons: Record<string, string> = {
  super_admin: "SA",
  admin: "AD",
  satinalma_direktoru: "SD",
  satinalma_yoneticisi: "SY",
  satinalma_uzmani: "SU",
  satinalmaci: "SM",
  user: "U",
};

const roleHierarchyPriority: Record<string, number> = {
  super_admin: 0,
  admin: 1,
  satinalma_direktoru: 2,
  satin_alma_direktoru: 2,
  satinalma_yoneticisi: 3,
  satin_alma_yoneticisi: 3,
  satinalma_uzmani: 4,
  satin_alma_uzmani: 4,
  satinalmaci: 5,
  satin_alma: 5,
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return rolePermissions[role]?.includes(permission) ?? false;
}

export function normalizedSystemRole(user: PermissionContext | null | undefined): string {
  return (user?.system_role || "").toLowerCase();
}

export function normalizedRole(user: PermissionContext | null | undefined): string {
  return (user?.role || "").toLowerCase();
}

export function normalizeRoleKey(value?: string | null): string {
  if (!value) return "";
  return value
    .toLowerCase()
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/\./g, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

export function normalizedBusinessRole(user: PermissionContext | null | undefined): string {
  return ((user?.business_role as string | undefined | null) || user?.role || "").toLowerCase();
}

export function getRoleLabel(role: string | null | undefined): string {
  const normalized = String(role || "").toLowerCase();
  return roleLabels[normalized] || String(role || "");
}

export function getRoleIcon(role: string | null | undefined): string {
  const normalized = String(role || "").toLowerCase();
  return roleIcons[normalized] || "U";
}

type RoleHierarchyItem = {
  name: string;
  hierarchy_level: number;
};

export function filterVisibleRoleHierarchy<T extends RoleHierarchyItem>(
  roles: T[],
  currentRole: string | null | undefined,
): T[] {
  const currentRoleKey = normalizeRoleKey(currentRole);
  if (!currentRoleKey || currentRoleKey === "super_admin") return roles;

  const matchedRole = roles.find((role) => normalizeRoleKey(role.name) === currentRoleKey);
  if (matchedRole) {
    return roles.filter((role) => role.hierarchy_level >= matchedRole.hierarchy_level);
  }

  const currentPriority = roleHierarchyPriority[currentRoleKey];
  if (currentPriority === undefined) return roles;

  return roles.filter((role) => {
    const priority = roleHierarchyPriority[normalizeRoleKey(role.name)];
    if (priority === undefined) return true;
    return priority >= currentPriority;
  });
}

export function getUserDisplayRoleLabel(user: PermissionContext | null | undefined): string {
  const businessRole = normalizedBusinessRole(user);
  if (businessRole) {
    return getRoleLabel(businessRole);
  }

  const systemRole = normalizedSystemRole(user);
  if (systemRole) {
    return getRoleLabel(systemRole);
  }

  return getRoleLabel(normalizedRole(user)) || "Kullanıcı";
}

export function isSuperAdminBusinessRole(role: string | null | undefined): boolean {
  return String(role || "").toLowerCase() === "super_admin";
}

export function isAdminBusinessRole(role: string | null | undefined): boolean {
  return String(role || "").toLowerCase() === "admin";
}

export function isPrivilegedBusinessRole(role: string | null | undefined): boolean {
  return isAdminBusinessRole(role) || isSuperAdminBusinessRole(role);
}

export function canAssignPrivilegedBusinessRole(user: PermissionContext | null | undefined): boolean {
  return isSuperAdminUser(user);
}

export function resolveDefaultPersonnelSystemRole(
  businessRole: string | null | undefined,
  currentSystemRole: PersonnelSystemRole | null | undefined,
): PersonnelSystemRole {
  if (isSuperAdminBusinessRole(businessRole)) {
    return "super_admin";
  }

  if (isAdminBusinessRole(businessRole)) {
    return currentSystemRole && currentSystemRole !== "super_admin" ? currentSystemRole : "tenant_admin";
  }

  return "";
}

export function isSuperAdminUser(user: PermissionContext | null | undefined): boolean {
  return normalizedSystemRole(user) === "super_admin" || normalizedRole(user) === "super_admin";
}

export function isTenantAdminUser(user: PermissionContext | null | undefined): boolean {
  const systemRole = normalizedSystemRole(user);
  return systemRole === "tenant_admin" || systemRole === "tenant_owner" || (!systemRole && normalizedRole(user) === "admin");
}

export function isTenantOwnerUser(user: PermissionContext | null | undefined): boolean {
  return normalizedSystemRole(user) === "tenant_owner";
}

export function isPlatformStaffUser(user: PermissionContext | null | undefined): boolean {
  const systemRole = normalizedSystemRole(user);
  return (
    systemRole === "platform_support" ||
    systemRole === "platform_operator" ||
    systemRole === "finance_officer"
  );
}

export function canManageTenantIdentitySettings(user: PermissionContext | null | undefined): boolean {
  return isSuperAdminUser(user) || isTenantOwnerUser(user);
}

export function canManageTenantGovernance(user: PermissionContext | null | undefined): boolean {
  return isSuperAdminUser(user);
}

export function canManageSharedEmailProfiles(user: PermissionContext | null | undefined): boolean {
  return isSuperAdminUser(user);
}

const ROLE_MANAGEMENT_BUSINESS_ROLES = new Set([
  "admin",
  "super_admin",
  "satinalma_direktoru",
  "satinalma_yoneticisi",
  "department_manager",
  "company_manager",
  "manager",
]);

export function canManageRoleCatalog(user: PermissionContext | null | undefined): boolean {
  return (
    isSuperAdminUser(user)
    || isTenantAdminUser(user)
    || ROLE_MANAGEMENT_BUSINESS_ROLES.has(normalizedBusinessRole(user))
  );
}

export function canAccessAdminSurface(user: PermissionContext | null | undefined): boolean {
  const systemRole = normalizedSystemRole(user);
  return isSuperAdminUser(user)
    || systemRole === "tenant_admin"
    || systemRole === "tenant_owner"
    || systemRole === "platform_support"
    || systemRole === "platform_operator"
    || (!systemRole && normalizedRole(user) === "admin");
}

export function hasAdminWorkspaceHome(user: PermissionContext | null | undefined): boolean {
  const systemRole = normalizedSystemRole(user);
  const businessRole = normalizedBusinessRole(user);
  return isSuperAdminUser(user)
    || isPlatformStaffUser(user)
    || systemRole === "tenant_owner"
    || systemRole === "tenant_admin"
    || (!systemRole && normalizedRole(user) === "admin")
    || businessRole === "channel_owner"
    || businessRole === "channel_agent";
}

export function getWorkspaceLabelFallback(user: PermissionContext | null | undefined): string {
  if (isSuperAdminUser(user)) {
    return "Ana Yönetim";
  }

  if (isPlatformStaffUser(user)) {
    return "Platform Operasyon Alanı";
  }

  if (isTenantOwnerUser(user)) {
    return "Owner Yönetim Alanı";
  }

  if (isTenantAdminUser(user)) {
    return "Yönetim Alanı";
  }

  if (user) {
    return "Personel Girişi";
  }

  return "Çalışma Alanı";
}

export function isProcurementUser(user: PermissionContext | null | undefined): boolean {
  return [
    "satinalmaci",
    "satinalma_uzmani",
    "satinalma_yoneticisi",
    "satinalma_direktoru",
  ].includes(normalizedBusinessRole(user));
}

export function canManageQuoteWorkspace(user: PermissionContext | null | undefined): boolean {
  const role = normalizedBusinessRole(user);
  return (canAccessAdminSurface(user) && !isPlatformStaffUser(user))
    || isProcurementUser(user)
    || role === "manager"
    || role === "buyer";
}

export function canReviewApprovals(user: PermissionContext | null | undefined): boolean {
  const role = normalizedBusinessRole(user);
  return canAccessAdminSurface(user)
    || role === "satinalma_yoneticisi"
    || role === "satinalma_direktoru";
}

export function isScopedTenantUser(user: PermissionContext | null | undefined): boolean {
  return Boolean(user) && !canAccessAdminSurface(user);
}

export function hasPermissionForUser(user: PermissionContext, permission: Permission): boolean {
  const systemRole = normalizedSystemRole(user);

  if ((permission as string) === "view:workspace-panel") {
    return canAccessWorkspacePanel(user);
  }

  if (permission === "view:admin") {
    return canAccessAdminSurface(user);
  }

  if (permission === "manage:users") {
    return isSuperAdminUser(user) || systemRole === "tenant_admin" || systemRole === "tenant_owner";
  }

  return hasPermission(normalizedBusinessRole(user) as Role, permission);
}

export type MenuAccessPreviewItem = {
  key: string;
  label: string;
  enabled: boolean;
  description: string;
  children?: MenuAccessPreviewItem[];
};

export type PermissionOverrideMap = Record<string, boolean>;

export type RolePermissionMatrixRow = {
  businessRole: string;
  businessRoleLabel: string;
  systemRole: string;
  systemRoleLabel: string;
  group: string;
  adminSurface: boolean;
  manageUsers: boolean;
  quoteWorkspace: boolean;
  reviewApprovals: boolean;
  tenantGovernanceRead: boolean;
  tenantGovernanceWrite: boolean;
  supportWorkflow: boolean;
  tenantIdentitySettings: boolean;
  sharedEmailProfiles: boolean;
};

function resolvePreviewSystemRole(businessRole: string, systemRole: string): string {
  if (businessRole === "super_admin") {
    return "super_admin";
  }

  if (businessRole === "admin") {
    return systemRole || "tenant_admin";
  }

  return systemRole;
}

function applyOverride(
  key: string,
  baseEnabled: boolean,
  overrides?: PermissionOverrideMap,
): boolean {
  if (!overrides || !(key in overrides)) {
    return baseEnabled;
  }
  return Boolean(overrides[key]);
}

function withChildren(
  item: MenuAccessPreviewItem,
  children: MenuAccessPreviewItem[],
): MenuAccessPreviewItem {
  return {
    ...item,
    children,
  };
}

export function getRoleMenuAccessPreview(
  businessRole: string | null | undefined,
  selectedSystemRole: string | null | undefined,
  overrides?: PermissionOverrideMap,
): MenuAccessPreviewItem[] {
  const normalizedBusiness = String(businessRole || "").toLowerCase();
  const normalizedSystem = resolvePreviewSystemRole(
    normalizedBusiness,
    String(selectedSystemRole || "").toLowerCase(),
  );
  const previewUser: PermissionContext = {
    role: normalizedBusiness || undefined,
    business_role: normalizedBusiness || undefined,
    system_role: normalizedSystem || undefined,
  };

  const canReadTenantGovernance = isSuperAdminUser(previewUser) || isPlatformStaffUser(previewUser);

  const workspaceHome = applyOverride("workspace_home", hasAdminWorkspaceHome(previewUser), overrides);
  const adminSurface = applyOverride("admin_surface", canAccessAdminSurface(previewUser), overrides);
  const manageUsers = applyOverride("manage_users", hasPermissionForUser(previewUser, "manage:users"), overrides);
  const quoteWorkspace = applyOverride("quote_workspace", canManageQuoteWorkspace(previewUser), overrides);
  const approvalReview = applyOverride("approval_review", canReviewApprovals(previewUser), overrides);
  const governanceRead = applyOverride("tenant_governance_read", canReadTenantGovernance, overrides);
  const governanceWrite = applyOverride("tenant_governance_write", canManageTenantGovernance(previewUser), overrides);
  const supportWorkflow = applyOverride("support_workflow", canReadTenantGovernance, overrides);
  const tenantIdentity = applyOverride("tenant_identity", canManageTenantIdentitySettings(previewUser), overrides);
  const sharedEmail = applyOverride("shared_email", canManageSharedEmailProfiles(previewUser), overrides);

  return [
    withChildren(
      {
        key: "workspace_home",
        label: "Yönetim Ana Sayfası",
        enabled: workspaceHome,
        description: "Admin iş alanı açılış kartları ve yönetim özetleri.",
      },
      [
        {
          key: "workspace_home.kpi_cards",
          label: "KPI Kartlari",
          enabled: applyOverride("workspace_home.kpi_cards", workspaceHome, overrides),
          description: "Ana KPI kartlarini goruntuleme.",
        },
        {
          key: "workspace_home.operation_feed",
          label: "Operasyon Akisi",
          enabled: applyOverride("workspace_home.operation_feed", workspaceHome, overrides),
          description: "Son operasyon hareketlerini goruntuleme.",
        },
      ],
    ),
    withChildren(
      {
        key: "admin_surface",
        label: "Yönetim Alanı",
        enabled: adminSurface,
        description: "Personel, firma, departman ve benzeri yönetim ekranları.",
      },
      [
        {
          key: "admin_surface.user_view",
          label: "Personel Listeleme",
          enabled: applyOverride("admin_surface.user_view", adminSurface, overrides),
          description: "Personel listesi ve detaylarini goruntuleme.",
        },
        {
          key: "admin_surface.user_create",
          label: "Personel Oluşturma",
          enabled: applyOverride("admin_surface.user_create", adminSurface, overrides),
          description: "Yeni personel kaydı açma.",
        },
        {
          key: "admin_surface.user_edit",
          label: "Personel Düzenleme",
          enabled: applyOverride("admin_surface.user_edit", adminSurface, overrides),
          description: "Var olan personel kayıtlarını güncelleme.",
        },
        {
          key: "admin_surface.user_disable",
          label: "Personel Pasife Alma",
          enabled: applyOverride("admin_surface.user_disable", adminSurface, overrides),
          description: "Personel kaydını pasif duruma çekme.",
        },
        {
          key: "admin_surface.user_delete",
          label: "Personel Silme",
          enabled: applyOverride("admin_surface.user_delete", adminSurface, overrides),
          description: "Pasif personel kaydını kaldırma.",
        },
      ],
    ),
    {
      key: "manage_users",
      label: "Kullanıcı Yönetimi",
      enabled: manageUsers,
      description: "Kullanıcı oluşturma, rol atama ve düzenleme akışlarına erişim.",
    },
    withChildren(
      {
        key: "quote_workspace",
        label: "Teklif Çalışma Alanı",
        enabled: quoteWorkspace,
        description: "Teklif oluşturma, listeleme ve ilgili satın alma operasyonu.",
      },
      [
        {
          key: "quote_workspace.list",
          label: "Teklif Listeleme",
          enabled: applyOverride("quote_workspace.list", quoteWorkspace, overrides),
          description: "Teklif listesi ve durumlarini goruntuleme.",
        },
        {
          key: "quote_workspace.create",
          label: "Teklif Oluşturma",
          enabled: applyOverride("quote_workspace.create", quoteWorkspace, overrides),
          description: "Yeni teklif oluşturma.",
        },
        {
          key: "quote_workspace.edit",
          label: "Teklif Düzenleme",
          enabled: applyOverride("quote_workspace.edit", quoteWorkspace, overrides),
          description: "Mevcut teklif kaydını düzenleme.",
        },
        {
          key: "quote_workspace.submit_approval",
          label: "Onaya Gönderme",
          enabled: applyOverride("quote_workspace.submit_approval", quoteWorkspace, overrides),
          description: "Teklifi onay sürecine gönderme.",
        },
        {
          key: "quote_workspace.comparison",
          label: "Teklif Karsilastirma",
          enabled: applyOverride("quote_workspace.comparison", quoteWorkspace, overrides),
          description: "Teklifleri karsilastirma ekranina erisim.",
        },
      ],
    ),
    {
      key: "approval_review",
      label: "Onay Inceleme",
      enabled: approvalReview,
      description: "Onay gerektiren kayıtları görüntüleme/değerlendirme.",
    },
    withChildren(
      {
        key: "tenant_governance_read",
        label: "Stratejik Partner Yönetimi (Okuma)",
        enabled: governanceRead,
        description: "Stratejik partner yönetim kayıtlarını görüntüleme.",
      },
      [
        {
          key: "tenant_governance_read.list",
          label: "Liste",
          enabled: applyOverride("tenant_governance_read.list", governanceRead, overrides),
          description: "Stratejik partner listesi ve ozetini goruntuleme.",
        },
        {
          key: "tenant_governance_read.detail",
          label: "Detay",
          enabled: applyOverride("tenant_governance_read.detail", governanceRead, overrides),
          description: "Stratejik partner detaylarini goruntuleme.",
        },
      ],
    ),
    withChildren(
      {
        key: "tenant_governance_write",
        label: "Stratejik Partner Yönetimi (Yazma)",
        enabled: governanceWrite,
        description: "Stratejik partner yönetim alanında değişiklik yapma.",
      },
      [
        {
          key: "tenant_governance_write.detail_edit",
          label: "Detay Düzenleme",
          enabled: applyOverride("tenant_governance_write.detail_edit", governanceWrite, overrides),
          description: "Stratejik partner alanlarını düzenleme.",
        },
      ],
    ),
    {
      key: "support_workflow",
      label: "Destek Akisi Guncelleme",
      enabled: supportWorkflow,
      description: "Support workflow alanlarını güncelleme yetkisi.",
    },
    {
      key: "tenant_identity",
      label: "Stratejik Partner Kimlik Ayarlari",
      enabled: tenantIdentity,
      description: "Stratejik partner marka ve kimlik ayarlari.",
    },
    {
      key: "shared_email",
      label: "Ortak E-Posta Profilleri",
      enabled: sharedEmail,
      description: "Platform genel SMTP/profil yönetimi.",
    },
  ];
}

export function getPersonnelRolePermissionMatrix(): RolePermissionMatrixRow[] {
  type Combo = { businessRole: string; systemRole: string; group: string };

  const combinations: Combo[] = [
    // --- PLATFORM GRUBU ---
    { businessRole: "super_admin",        systemRole: "super_admin",        group: "platform" },
    { businessRole: "platform_support",   systemRole: "platform_support",   group: "platform" },
    { businessRole: "platform_operator",  systemRole: "platform_operator",  group: "platform" },

    // --- PORTAL / SATIN ALMA GRUBU ---
    { businessRole: "admin",              systemRole: "tenant_owner",       group: "portal" },
    { businessRole: "admin",              systemRole: "tenant_admin",       group: "portal" },
    { businessRole: "satinalma_direktoru",  systemRole: "tenant_member",    group: "portal" },
    { businessRole: "satinalma_yoneticisi", systemRole: "tenant_member",    group: "portal" },
    { businessRole: "satinalma_uzmani",     systemRole: "tenant_member",    group: "portal" },
    { businessRole: "satinalmaci",          systemRole: "tenant_member",    group: "portal" },
    { businessRole: "user",                 systemRole: "tenant_member",    group: "portal" },

    // --- KANAL / IS ORTAGI GRUBU ---
    { businessRole: "channel_owner",      systemRole: "tenant_member",      group: "channel" },
    { businessRole: "channel_agent",      systemRole: "tenant_member",      group: "channel" },

    // --- TEDARIKCI GRUBU ---
    { businessRole: "supplier_admin",     systemRole: "supplier_user",      group: "supplier" },
    { businessRole: "supplier_user",      systemRole: "supplier_user",      group: "supplier" },
  ];

  return combinations.map(({ businessRole, systemRole, group }) => {
    const previewUser: PermissionContext = {
      role: businessRole,
      business_role: businessRole,
      system_role: systemRole,
    };
    const canReadTenantGovernance = isSuperAdminUser(previewUser) || isPlatformStaffUser(previewUser);

    // Overrides for channel / supplier personas
    const isChannel  = group === "channel";
    const isSupplier = group === "supplier";

    return {
      businessRole,
      businessRoleLabel: getRoleLabel(businessRole),
      systemRole,
      systemRoleLabel: getRoleLabel(systemRole),
      group,
      adminSurface:          isChannel || isSupplier ? false : canAccessAdminSurface(previewUser),
      manageUsers:           isChannel || isSupplier ? false : hasPermissionForUser(previewUser, "manage:users"),
      quoteWorkspace:        isSupplier ? true  : isChannel ? false : canManageQuoteWorkspace(previewUser),
      reviewApprovals:       isChannel || isSupplier ? false : canReviewApprovals(previewUser),
      tenantGovernanceRead:  canReadTenantGovernance,
      tenantGovernanceWrite: canManageTenantGovernance(previewUser),
      supportWorkflow:       canReadTenantGovernance,
      tenantIdentitySettings: canManageTenantIdentitySettings(previewUser),
      sharedEmailProfiles:   canManageSharedEmailProfiles(previewUser),
    };
  });
}

function resolveApprovalLegacyRole(approval: ApprovalRoleInfo): string {
  return String(approval.required_role_mirror || approval.required_role || "").toLowerCase();
}

export function resolveApprovalBusinessRole(approval: ApprovalRoleInfo): string {
  return String(approval.required_business_role || resolveApprovalLegacyRole(approval)).toLowerCase();
}

export function resolveApprovalRoleLabel(approval: ApprovalRoleInfo): string {
  return String(
    approval.required_business_role_label
    || approval.required_role_label
    || approval.required_business_role
    || approval.required_role_mirror
    || approval.required_role
    || ""
  );
}

// ---------------------------------------------------------------------------
// TEK KAYNAK: Matris tabanlı önizleme yardımcıları
// Backend /admin/role-permission-matrix endpointinden gelen veriyle çalışır.
// ---------------------------------------------------------------------------

/**
 * Backend matris verisinden profil anahtari olusturur.
 * Önce kesin eşleşme, sonra system_role='' fallback, sonra default=[].
 */
export function resolveMatrixProfileKey(
  businessRole: string,
  systemRole: string,
  matrix: ApiRolePermissionMatrixRow[],
): ApiRolePermissionMatrixRow | undefined {
  const br = businessRole.toLowerCase();
  const sr = systemRole.toLowerCase();
  return (
    matrix.find((r) => r.business_role === br && r.system_role === sr) ||
    matrix.find((r) => r.business_role === br && r.system_role === "")
  );
}

/**
 * Backend matris + katalog ağacı verisinden MenuAccessPreviewItem[] üretir.
 * (Matris verisi yoksa boş liste döner.)
 */
export function buildMenuPreviewFromMatrix(
  businessRole: string | null | undefined,
  systemRole: string | null | undefined,
  matrix: ApiRolePermissionMatrixRow[],
  catalog: PermissionCatalogNode[],
  overrides?: PermissionOverrideMap,
): MenuAccessPreviewItem[] {
  if (!matrix.length || !catalog.length) return [];

  const br = String(businessRole || "").toLowerCase();
  const sr = String(systemRole || "").toLowerCase();
  const resolved = resolveMatrixProfileKey(br, sr, matrix);
  const enabledSet = new Set<string>(resolved?.enabled_keys ?? []);

  return catalog.map((node) => {
    const topEnabled = overrides && node.key in overrides
      ? Boolean(overrides[node.key])
      : enabledSet.has(node.key);

    const children: MenuAccessPreviewItem[] = (node.children ?? []).map((child) => {
      const childEnabled = overrides && child.key in overrides
        ? Boolean(overrides[child.key])
        : enabledSet.has(child.key);
      return {
        key: child.key,
        label: child.label,
        description: child.description ?? "",
        enabled: childEnabled,
      };
    });

    return {
      key: node.key,
      label: node.label,
      description: node.description ?? "",
      enabled: topEnabled,
      children,
    };
  });
}

// ---------------------------------------------------------------------------
// Eksik yardimci fonksiyonlar (import'larla uyumlu)
// ---------------------------------------------------------------------------

export function getUserScopeType(user: PermissionContext | null | undefined): string {
  if (!user) return "none";
  if (isSuperAdminUser(user)) return "platform";
  if (isPlatformStaffUser(user)) return "platform";
  const role = normalizedBusinessRole(user);
  if (role === "channel_owner" || role === "channel_agent" || role === "is_ortagi") return "channel";
  const sr = normalizedSystemRole(user);
  if (sr === "supplier_user") return "supplier";
  // Respect explicit scope_type when present
  const explicitScope = (user as { scope_type?: string }).scope_type;
  if (explicitScope && ["platform", "partner", "supplier", "channel"].includes(explicitScope)) return explicitScope;
  if (sr === "tenant_admin" || sr === "tenant_owner" || sr === "tenant_member") return "tenant";
  return "tenant";
}

export function getScopeLabel(scopeType: string): string {
  const labels: Record<string, string> = {
    platform: "Platform",
    tenant: "Kiracı",
    supplier: "Tedarikçi",
    channel: "Kanal",
    none: "Yok",
  };
  return labels[scopeType] ?? "Bilinmiyor";
}

export function canAccessWorkspacePanel(user: PermissionContext | null | undefined): boolean {
  if (!user) return false;
  if (isSuperAdminUser(user) || isPlatformStaffUser(user) || isTenantAdminUser(user)) return true;
  const role = normalizedBusinessRole(user);
  const sr = normalizedSystemRole(user);
  return (
    role === "manager" ||
    role === "buyer" ||
    role === "satinalmaci" ||
    role === "satinalma_uzmani" ||
    role === "satinalma_yoneticisi" ||
    role === "satinalma_direktoru" ||
    role === "channel_owner" ||
    role === "channel_agent" ||
    role === "is_ortagi" ||
    sr === "supplier_user"
  );
}

export function canAccessProcurementSettings(user: PermissionContext | null | undefined): boolean {
  if (!user) return false;
  const role = normalizedBusinessRole(user);
  const sr = normalizedSystemRole(user);
  return (
    isTenantAdminUser(user) ||
    isSuperAdminUser(user) ||
    role === "satinalma_yoneticisi" ||
    role === "satinalma_direktoru" ||
    sr === "tenant_owner"
  );
}

export function getWorkspacePanelNavLabel(user: PermissionContext | null | undefined): string {
  if (!user) return "Çalışma Alanı";
  if (isSuperAdminUser(user)) return "Super Admin";
  const sr = normalizedSystemRole(user);
  if (sr === "tenant_owner") return "Ortak Admin";
  if (sr === "tenant_admin") return "Yönetim Alanı";
  const role = normalizedBusinessRole(user);
  if (role === "manager") return "Yönetici Paneli";
  if (role === "channel_owner") return "Kanal Sahibi Paneli";
  if (role === "channel_agent" || role === "is_ortagi") return "Kanal Temsilcisi";
  if (sr === "supplier_user") return "Tedarikçi Paneli";
  return "Çalışma Alanı";
}


