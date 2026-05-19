import { useState, useEffect, useMemo } from "react";
import { getCityNames, getDistricts } from "../data/turkey-cities";
import {
  getDepartments,
  getCompanies,
  getRoles,
  addUserCompanyAssignment,
  updateUserCompanyAssignment,
  removeUserCompanyAssignment,
  getUserPermissionOverrides,
  replaceUserPermissionOverrides,
  type Department,
  type Company,
  type Role,
  type UserPermissionOverrideItem,
  type Tenant,
} from "../services/admin.service";
import { modalStyles } from "../styles/modalStyles";
import { useAuth } from "../hooks/useAuth";
import {
  canAssignPrivilegedBusinessRole,
  getRoleLabel,
  getRoleMenuAccessPreview,
  isPrivilegedBusinessRole,
  isSuperAdminBusinessRole,
  isTenantAdminUser,
  type PersonnelSystemRole,
  resolveDefaultPersonnelSystemRole,
  type PermissionOverrideMap,
} from "../auth/permissions";
import { SUBSCRIPTION_ADDON_CTA_LABEL, SUBSCRIPTION_UPGRADE_CTA_LABEL, getSubscriptionAddonHref, getSubscriptionLimitGuidanceMessage, getSubscriptionUpgradeHref, hasSubscriptionUpgradeGuidance } from "../utils/subscriptionLimitErrors";


import type { TenantUser } from "../services/admin.service";

const ALL_DEPARTMENTS_MARKER = "__ALL_DEPARTMENTS__";
const ALL_DEPARTMENTS_OPTION = "__ALL__";

interface PersonnelCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (result?: { invitationEmailSent?: boolean; email?: string; isEdit?: boolean }) => void;
  editData?: TenantUser | null;
  allowPermissionOverrideSave?: boolean;
  contextScope?: "portal" | "partner" | "supplier" | "channel";
  tenantOptions?: Tenant[];
  initialTenantId?: number | null;
  requireTenantSelection?: boolean;
}

interface PendingAssignment {
  id?: number;
  company_id: number;
  role_id: number;
  department_id?: number | null;
  sub_items: string[];
  company_name: string;
  role_name: string;
  department_name?: string;
}

const BUSINESS_ROLE_OPTIONS = [
  { value: "satinalmaci", label: "Satın Almacı", hierarchy_level: 5 },
  { value: "satinalma_uzmani", label: "Satın Alma Uzmanı", hierarchy_level: 4 },
  { value: "satinalma_yoneticisi", label: "Satın Alma Yöneticisi", hierarchy_level: 3 },
  { value: "admin", label: "Satın Alma Admin", hierarchy_level: 1 },
  { value: "satinalma_direktoru", label: "Satın Alma Direktörü", hierarchy_level: 2 },
  { value: "super_admin", label: "Süper Admin", hierarchy_level: 0 },
] as const;

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Süper Admin",
  admin: "Satın Alma Admin",
  satinalmaci: "Satın Almacı",
  satinalma_uzmani: "Satın Alma Uzmanı",
  satinalma_yoneticisi: "Satın Alma Yöneticisi",
  satinalma_direktoru: "Satın Alma Direktörü",
};

const ADMIN_SYSTEM_ROLE_OPTIONS = [
  { value: "tenant_admin", label: "Tenant Admin" },
  { value: "platform_support", label: "Platform Destek" },
  { value: "platform_operator", label: "Platform Operasyon" },
] as const;

const STRATEGIC_PARTNER_ROLE_ORDER = [
  "Partner Ana Yonetici",
  "Partner Yoneticisi",
  "Satin Alma Muduru",
  "Teknik Uzman ve Mimar",
  "Denetci ve Finansal Izleyici",
  "Ozel Partner Rolu",
] as const;

function filterAssignableBusinessRoleOptions(currentRole: string | null | undefined) {
  const normalizedCurrentRole = String(currentRole || "").toLowerCase();
  if (!normalizedCurrentRole || normalizedCurrentRole === "super_admin") {
    return BUSINESS_ROLE_OPTIONS;
  }

  const currentOption = BUSINESS_ROLE_OPTIONS.find((option) => option.value === normalizedCurrentRole);
  if (!currentOption) {
    return BUSINESS_ROLE_OPTIONS.filter((option) => option.value !== "super_admin");
  }

  return BUSINESS_ROLE_OPTIONS.filter((option) => option.hierarchy_level >= currentOption.hierarchy_level);
}

export function PersonnelCreateModal({
  isOpen,
  onClose,
  onSuccess,
  editData = null,
  allowPermissionOverrideSave = true,
  contextScope = "portal",
  tenantOptions = [],
  initialTenantId = null,
  requireTenantSelection = false,
}: PersonnelCreateModalProps) {
  const { user: authUser } = useAuth();
  const authTenantId = typeof (authUser as { tenant_id?: number } | null)?.tenant_id === "number"
    ? (authUser as { tenant_id?: number } | null)?.tenant_id
    : undefined;
  const isLockedAdminProfile = Boolean(
    editData && (
      String(editData.role || "").toLowerCase() === "admin"
      || ["tenant_admin", "tenant_owner", "super_admin"].includes(String(editData.system_role || "").toLowerCase())
    ),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);


  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [workEmail, setWorkEmail] = useState("");
  const [role, setRole] = useState<string>("");
  const [selectedTenantId, setSelectedTenantId] = useState<number | null>(initialTenantId);
  const [systemRole, setSystemRole] = useState<PersonnelSystemRole>("");
  const [departmentId, setDepartmentId] = useState<number[]>([]);
  const [showMap, setShowMap] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [address, setAddress] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [personalPhone, setPersonalPhone] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [companyPhoneShort, setCompanyPhoneShort] = useState("");
  const [approvalLimit, setApprovalLimit] = useState(100000);
  const [personnelId, setPersonnelId] = useState<number | null>(null);
  const [pendingAssignments, setPendingAssignments] = useState<PendingAssignment[]>([]);
  const [hideLocation, setHideLocation] = useState(false);
  const [shareOnWhatsApp, setShareOnWhatsApp] = useState(true);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [assignmentDraft, setAssignmentDraft] = useState<{ editId?: number; company_id: number | null; department_id: number | null; role_id: number | null; sub_items: string[] }>({ company_id: null, department_id: null, role_id: null, sub_items: [] });

  function normalizeText(value: string) {
    return value
      .toLocaleLowerCase('tr-TR')
      .replace(/[_.-]+/g, ' ')
      .replace(/ı/g, 'i')
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ş/g, 's')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c')
      .replace(/\s+/g, ' ')
      .trim();
  }

  const resolvedAssignmentRole = useMemo(() => {
    const selectedRoleLabel = ROLE_LABELS[role] || role;
    const normalizedRole = normalizeText(selectedRoleLabel);
    return roles.find((item) => normalizeText(item.name) === normalizedRole);
  }, [role, roles]);

  const strategicRoleOptions = useMemo(() => {
    const byName = new Map<string, Role>();
    for (const row of roles) {
      byName.set(normalizeText(row.name), row);
    }

    const ordered = STRATEGIC_PARTNER_ROLE_ORDER
      .map((name) => byName.get(normalizeText(name)))
      .filter((item): item is Role => Boolean(item))
      .map((item) => ({ value: item.name, label: item.name }));

    const remaining = roles
      .filter((row) => !STRATEGIC_PARTNER_ROLE_ORDER.some((name) => normalizeText(name) === normalizeText(row.name)))
      .sort((a, b) => a.hierarchy_level - b.hierarchy_level || a.name.localeCompare(b.name, "tr"))
      .map((row) => ({ value: row.name, label: row.name }));

    return [...ordered, ...remaining];
  }, [roles]);

  const availableSystemRoleOptions = useMemo(() => {
    const visibleOptions = filterAssignableBusinessRoleOptions(authUser?.business_role || authUser?.role);

    if (!canAssignPrivilegedBusinessRole(authUser) && isTenantAdminUser(authUser)) {
      return visibleOptions.filter(
        (option) => option.value !== "admin" && option.value !== "super_admin",
      );
    }

    return visibleOptions;
  }, [authUser]);

  const operationalRoleOptions = useMemo(() => {
    if (contextScope === "partner" || contextScope === "channel") {
      return strategicRoleOptions;
    }
    return availableSystemRoleOptions.map((item) => ({ value: item.value, label: item.label }));
  }, [availableSystemRoleOptions, contextScope, strategicRoleOptions]);

  const [permissionOverrides, setPermissionOverrides] = useState<PermissionOverrideMap>({});
  const [permissionOverridesLoading, setPermissionOverridesLoading] = useState(false);
  const [showPermissionPreview, setShowPermissionPreview] = useState(false);

  const menuAccessPreview = useMemo(() => {
    return getRoleMenuAccessPreview(role, systemRole, permissionOverrides);
  }, [role, systemRole, permissionOverrides]);

  const cityOptions = useMemo(() => getCityNames(), []);
  const districtOptions = useMemo(
    () => (selectedCity ? getDistricts(selectedCity) : []),
    [selectedCity],
  );


  useEffect(() => {
    if (isOpen) {
      void loadLookups();
      if (editData) {
        setPersonnelId(editData.id);
        setFullName(editData.full_name || "");
        setEmail(editData.email || "");
        setWorkEmail(editData.work_email || "");
        setRole(editData.role || "");
        setSelectedTenantId(typeof editData.tenant_id === "number" ? editData.tenant_id : null);
        setSystemRole((editData.system_role as typeof systemRole) || "");
        setDepartmentId(editData.department_id ? [editData.department_id] : []);
        setIsActive(editData.is_active);
        setApprovalLimit(editData.approval_limit ?? 100000);
        setPhotoPreview(editData.photo || null);
        setPersonalPhone(editData.personal_phone || "");
        setCompanyPhone(editData.company_phone || "");
        setCompanyPhoneShort(editData.company_phone_short || "");
        setHideLocation(Boolean(editData.hide_location));
        setShareOnWhatsApp(editData.share_on_whatsapp !== false);
        if (typeof editData.address === 'string') {
          const addressParts = editData.address.split(",").map((s) => s.trim());
          setSelectedCity(addressParts[0] || "");
          setSelectedDistrict(addressParts[1] || "");
          setAddress(addressParts.slice(2).join(", ") || "");
        } else {
          setSelectedCity("");
          setSelectedDistrict("");
          setAddress("");
        }
        if (Array.isArray(editData.company_assignments)) {
          setPendingAssignments(editData.company_assignments.map((assignment) => ({
            id: assignment.id,
            company_id: assignment.company_id,
            role_id: assignment.role_id,
            department_id: assignment.department_id ?? null,
            sub_items: assignment.sub_items || [],
            company_name: assignment.company?.name || "Firma",
            role_name: assignment.role?.name || "Rol",
            department_name: assignment.department?.name,
          })));
        } else {
          setPendingAssignments([]);
        }
        void loadUserPermissionOverrideState(editData.id);
      } else {
        setSelectedTenantId(initialTenantId ?? null);
        setPermissionOverrides({});
        resetForm();
      }
    }

  // loadLookups is intentionally a hoisted local helper for modal open flow.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, editData, initialTenantId]);

  useEffect(() => {
    if (!isOpen || editData) return;
    void loadLookups();
  // loadLookups is intentionally a hoisted local helper for modal open flow.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTenantId, contextScope, isOpen, editData]);

  useEffect(() => {
    const resolvedRole = resolvedAssignmentRole;
    if (!resolvedRole) return;

    setPendingAssignments((prev) => prev.map((assignment) => ({
      ...assignment,
      role_id: resolvedRole.id,
      role_name: resolvedRole.name,
    })));
  }, [resolvedAssignmentRole]);

  useEffect(() => {
    setSystemRole((prev) => resolveDefaultPersonnelSystemRole(role, prev));
  }, [role]);

  async function loadLookups() {
    try {
      const scopedTenantId = (() => {
        if (typeof editData?.tenant_id === "number") return editData.tenant_id;
        if ((contextScope === "partner" || contextScope === "channel") && typeof selectedTenantId === "number") return selectedTenantId;
        if (contextScope === "channel" && typeof authTenantId === "number") return authTenantId;
        return undefined;
      })();

      const [deptsResult, compsResult, rolesResult] = await Promise.allSettled([
        getDepartments(),
        getCompanies(),
        getRoles({ tenantId: scopedTenantId, excludeReserved: true }),
      ]);

      setDepartments(deptsResult.status === "fulfilled" ? deptsResult.value : []);
      setCompanies(compsResult.status === "fulfilled" ? compsResult.value : []);
      setRoles(rolesResult.status === "fulfilled" ? rolesResult.value : []);
    } catch (err) {
      console.error("Veri yüklenemedi:", err);
    }
  }

  async function loadUserPermissionOverrideState(userId: number) {
    setPermissionOverridesLoading(true);
    try {
      const overrides = await getUserPermissionOverrides(userId);
      const map: PermissionOverrideMap = {};
      overrides.forEach((item) => {
        map[item.permission_key] = item.allowed;
      });
      setPermissionOverrides(map);
    } catch (err) {
      console.error("Kisiye ozel izinler yuklenemedi:", err);
      setPermissionOverrides({});
    } finally {
      setPermissionOverridesLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (!email.trim()) throw new Error("E-posta gerekli");
      if (!fullName.trim()) throw new Error("Ad soyad gerekli");
      if (!editData && requireTenantSelection && contextScope === "partner" && selectedTenantId == null) {
        throw new Error("Stratejik partner ekip uyesi olusturmak icin tenant secimi zorunludur.");
      }
      const isEditingExistingPrivilegedUser = Boolean(
        editData && isPrivilegedBusinessRole(editData.role) && role === editData.role,
      );
      if (
        !canAssignPrivilegedBusinessRole(authUser)
        && isTenantAdminUser(authUser)
        && isPrivilegedBusinessRole(role)
        && !isEditingExistingPrivilegedUser
      ) {
        throw new Error("Tenant admin ekip uyesi ekranindan admin veya super admin olusturamaz.");
      }
      if (pendingAssignments.length > 0 && !resolvedAssignmentRole) {
        throw new Error("Ekip uyesi rolu ile firma rolu eslenemedi. Once ana rolu kontrol edin.");
      }

      const photo = photoPreview || null;
      const fullAddress = [selectedCity, selectedDistrict, address].filter(Boolean).join(", ");

      let user;
      if (editData && personnelId) {
        const { updateTenantUser } = await import("../services/admin.service");
        user = await updateTenantUser(personnelId, {
          email,
          work_email: workEmail || undefined,
          full_name: fullName,
          role: role || undefined,
          system_role: systemRole || undefined,
          tenant_id: selectedTenantId ?? undefined,
          department_id: departmentId[0] ?? undefined,
          approval_limit: approvalLimit,
          photo,
          personal_phone: personalPhone,
          company_phone: companyPhone,
          company_phone_short: companyPhoneShort,
          address: fullAddress,
          hide_location: hideLocation,
          share_on_whatsapp: shareOnWhatsApp,
          is_active: isActive,
        });
        const existingIds = new Set((editData.company_assignments || []).map((assignment) => assignment.id));
        const currentIds = new Set<number>();

        for (const assignment of pendingAssignments) {
          if (assignment.id) {
            currentIds.add(assignment.id);
            await updateUserCompanyAssignment(user.id, assignment.id, {
              role_id: resolvedAssignmentRole?.id ?? assignment.role_id,
              department_id: assignment.department_id ?? null,
              sub_items: assignment.sub_items,
            });
            continue;
          }

          await addUserCompanyAssignment(user.id, {
            company_id: assignment.company_id,
            role_id: resolvedAssignmentRole?.id ?? assignment.role_id,
            department_id: assignment.department_id ?? null,
            sub_items: assignment.sub_items,
          });
        }

        for (const assignment of editData.company_assignments || []) {
          if (!currentIds.has(assignment.id) && existingIds.has(assignment.id)) {
            await removeUserCompanyAssignment(user.id, assignment.id);
          }
        }
      } else {
        const { createTenantUser } = await import("../services/admin.service");
        user = await createTenantUser({
          email,
          work_email: workEmail || undefined,
          full_name: fullName,
          role: role || "satinalmaci",
          system_role: systemRole || undefined,
          tenant_id: selectedTenantId ?? undefined,
          department_id: departmentId[0] ?? undefined,
          approval_limit: approvalLimit,
          photo,
          personal_phone: personalPhone,
          company_phone: companyPhone,
          company_phone_short: companyPhoneShort,
          address: fullAddress,
          hide_location: hideLocation,
          share_on_whatsapp: shareOnWhatsApp,
        });
        for (const pa of pendingAssignments) {
          await addUserCompanyAssignment(user.id, {
            company_id: pa.company_id,
            role_id: resolvedAssignmentRole?.id ?? pa.role_id,
            department_id: pa.department_id,
            sub_items: pa.sub_items,
          });
        }
      }

      if (allowPermissionOverrideSave) {
        const overridePayload: UserPermissionOverrideItem[] = Object.entries(permissionOverrides).map(
          ([permission_key, allowed]) => ({ permission_key, allowed }),
        );
        await replaceUserPermissionOverrides(user.id, overridePayload);
      }

      onSuccess({
        invitationEmailSent: !editData ? user?.invitation_email_sent : undefined,
        email,
        isEdit: Boolean(editData),
      });
      onClose();
      resetForm();
    } catch (err: unknown) {
      // Backend'den gelen hata mesajını Türkçeleştir
      let errorMsg = "Ekip uyesi kaydedilemedi. Lutfen bilgileri kontrol edin.";
      const errorMap: { [key: string]: string } = {
        "email already exists": "Bu e-posta adresi ile daha önce kayıt yapılmış. Lütfen farklı bir e-posta girin.",
        "Bu email zaten kayıtlı": "Bu e-posta adresi ile daha önce kayıt yapılmış. Lütfen farklı bir e-posta girin.",
        "Request failed with status code 400": "Eksik veya hatalı bilgi girdiniz. Lütfen tüm alanları kontrol edin.",
        "Network Error": "Sunucuya ulaşılamıyor. Lütfen internet bağlantınızı ve sunucu durumunu kontrol edin.",
        "timeout": "İşlem zaman aşımına uğradı. Lütfen tekrar deneyin.",
      };
      function isAxiosError(e: unknown): e is { response: { status: number; data: { errorMessage: string } } } {
        if (
          typeof e === "object" &&
          e !== null &&
          Object.prototype.hasOwnProperty.call(e, "response")
        ) {
          const resp = (e as { response?: unknown }).response;
          if (
            typeof resp === "object" &&
            resp !== null &&
            Object.prototype.hasOwnProperty.call(resp, "status") &&
            Object.prototype.hasOwnProperty.call(resp, "data")
          ) {
            const data = (resp as { data?: unknown }).data;
            if (
              typeof data === "object" &&
              data !== null &&
              Object.prototype.hasOwnProperty.call(data, "errorMessage") &&
              typeof (data as { errorMessage?: unknown }).errorMessage === "string"
            ) {
              return true;
            }
          }
        }
        return false;
      }
      if (isAxiosError(err) && err.response.status === 400) {
        const errorMessage = err.response.data.errorMessage;
        // Bilinen hata mesajları için özel Türkçe karşılık
        for (const key in errorMap) {
          if (errorMessage.toLowerCase().includes(key.toLowerCase())) {
            errorMsg = errorMap[key];
            break;
          }
        }
        // Bilinmeyen hata mesajı ise, teknik detayları gizle
        if (errorMsg === "Ekip uyesi kaydedilemedi. Lutfen bilgileri kontrol edin.") {
          errorMsg = "Bir hata oluştu: " + (errorMessage.length < 100 ? errorMessage : "Lütfen bilgileri kontrol edin.");
        }
      } else if (err instanceof Error) {
        // Bilinen hata mesajları için özel Türkçe karşılık
        for (const key in errorMap) {
          if (err.message.toLowerCase().includes(key.toLowerCase())) {
            errorMsg = errorMap[key];
            break;
          }
        }
        if (errorMsg === "Ekip uyesi kaydedilemedi. Lutfen bilgileri kontrol edin.") {
          errorMsg = "Bir hata oluştu: " + (err.message.length < 100 ? err.message : "Lütfen bilgileri kontrol edin.");
        }
      } else if (typeof err === "string") {
        for (const key in errorMap) {
          if (err.toLowerCase().includes(key.toLowerCase())) {
            errorMsg = errorMap[key];
            break;
          }
        }
        if (errorMsg === "Ekip uyesi kaydedilemedi. Lutfen bilgileri kontrol edin.") {
          errorMsg = "Bir hata oluştu: " + (err.length < 100 ? err : "Lütfen bilgileri kontrol edin.");
        }
      }
        setError(getSubscriptionLimitGuidanceMessage(errorMsg, "Ekip uyesi kaydedilemedi. Lutfen bilgileri kontrol edin."));
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setEmail("");
    setWorkEmail("");
    setFullName("");

    setRole("");
    setSystemRole("");
    setSelectedTenantId(initialTenantId ?? null);
    setDepartmentId([]);
    setApprovalLimit(100000);
    setPendingAssignments([]);
    setIsActive(true);
    setPersonnelId(null);
    setPersonalPhone("");
    setCompanyPhone("");
    setCompanyPhoneShort("");
    setAddress("");
    setSelectedCity("");
    setSelectedDistrict("");
    setPhotoPreview(null);
    setHideLocation(false);
    setShareOnWhatsApp(true);
    setShowMap(false);
    setShowPermissionPreview(false);
    setPermissionOverrides({});
    setError("");
  }

  // Vesikalık/resim yükleme
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null;
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setPhotoPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setPhotoPreview(null);
    }
  }

  function getCompanyDepartments(companyId: number | null) {
    if (!companyId) return departments;
    const company = companies.find((item) => item.id === companyId);
    if (company?.departments?.length) return company.departments;
    return departments;
  }

  function assignmentCoversAllDepartments(assignment: Pick<PendingAssignment, 'department_id' | 'sub_items'>) {
    return assignment.department_id == null && assignment.sub_items.includes(ALL_DEPARTMENTS_MARKER);
  }

  function openAssignmentModal(editAssignment?: PendingAssignment) {
    const resolvedRole = resolvedAssignmentRole;
    setAssignmentDraft(editAssignment ? {
      editId: editAssignment.id,
      company_id: editAssignment.company_id,
      department_id: editAssignment.department_id ?? null,
      role_id: resolvedRole?.id ?? editAssignment.role_id,
      sub_items: editAssignment.sub_items,
    } : {
      company_id: null,
      department_id: null,
      role_id: resolvedRole?.id ?? null,
      sub_items: [],
    });
    setShowAssignmentModal(true);
  }

  function saveAssignmentDraft() {
    const resolvedRole = resolvedAssignmentRole;
    if (!assignmentDraft.company_id) {
      setError("Firma seçimi zorunludur.");
      return;
    }

    if (!resolvedRole) {
      setError("Ekip uyesinin ana rolu firma rolu ile eslenemedi.");
      return;
    }

    const company = companies.find((item) => item.id === assignmentDraft.company_id);
    const department = departments.find((item) => item.id === assignmentDraft.department_id);
    const coversAllDepartments = assignmentDraft.department_id == null && assignmentDraft.sub_items.includes(ALL_DEPARTMENTS_MARKER);
    const nextAssignment: PendingAssignment = {
      id: assignmentDraft.editId,
      company_id: assignmentDraft.company_id,
      role_id: resolvedRole.id,
      department_id: assignmentDraft.department_id,
      sub_items: assignmentDraft.sub_items,
      company_name: company?.name || "Firma",
      role_name: resolvedRole.name,
      department_name: coversAllDepartments ? 'Tum Departmanlar' : department?.name,
    };

    setPendingAssignments((prev) => {
      if (assignmentDraft.editId) {
        return prev.map((item) => item.id === assignmentDraft.editId ? nextAssignment : item);
      }
      const existingIndex = prev.findIndex((item) => item.company_id === nextAssignment.company_id);
      if (existingIndex >= 0) {
        return prev.map((item, index) => index === existingIndex ? { ...item, ...nextAssignment, id: item.id } : item);
      }
      return [...prev, nextAssignment];
    });
    setShowAssignmentModal(false);
    setError("");
  }

  if (!isOpen) return null;

  return (
    <div style={modalStyles.backdrop}>
      <div style={{ ...modalStyles.container, maxWidth: 980, maxHeight: "92vh", overflowY: "auto", padding: 0, borderRadius: 24 }}>
        <div style={{ ...modalStyles.header, padding: 24, borderBottom: "1px solid #e5e7eb", background: "linear-gradient(135deg, #fff7ed 0%, #eff6ff 100%)" }}>
          <div>
            <h2 style={{ ...modalStyles.title, marginBottom: 6 }}>{editData ? "Ekip Uyesini Duzenle" : "Yeni Ekip Uyesi Ekle"}</h2>
            <div style={{ color: '#64748b', fontSize: 14 }}>Kimlik, iletişim ve firma atamalarını tek ekrandan yönetin.</div>
          </div>
          <button onClick={onClose} style={modalStyles.closeButton}>X</button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: 24, display: 'grid', gap: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 24 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 20, padding: 24, borderRadius: 24, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <label htmlFor="personnel-photo" style={{ cursor: "pointer" }}>
              {photoPreview ? (
                <img src={photoPreview} alt="Vesikalık" style={{ width: 112, height: 112, borderRadius: "50%", objectFit: "cover", border: "4px solid #fff", boxShadow: '0 12px 24px rgba(37, 99, 235, 0.16)' }} />
              ) : (
                <div style={{ width: 112, height: 112, borderRadius: "50%", background: "linear-gradient(135deg, #e2e8f0 0%, #f8fafc 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, color: "#94a3b8", border: "2px dashed #cbd5e1" }}>
                  +
                </div>
              )}
              <input id="personnel-photo" type="file" accept="image/*" style={{ display: "none" }} onChange={handlePhotoChange} />
            </label>
            <div style={{ fontSize: 12, color: "#888", marginTop: 6 }}>Vesikalık fotoğraf yükle</div>
            <div style={{ width: '100%', marginTop: 24, display: 'grid', gap: 12 }}>
              <div style={{ padding: 14, borderRadius: 16, background: '#fff', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Harita</div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                  <input type="checkbox" checked={!hideLocation} onChange={(e) => setHideLocation(!e.target.checked)} />
                  <span>Detay ekranında harita gösterilsin</span>
                </label>
              </div>
              <div style={{ padding: 14, borderRadius: 16, background: '#fff', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>WhatsApp</div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                  <input type="checkbox" checked={shareOnWhatsApp} onChange={(e) => setShareOnWhatsApp(e.target.checked)} />
                  <span>WhatsApp paylaşımı açık olsun</span>
                </label>
              </div>
              {editData && (
                <div style={{ padding: 14, borderRadius: 16, background: '#fff', border: '1px solid #e2e8f0' }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
                    <span style={{ color: isActive ? '#10b981' : '#ef4444', fontWeight: 700 }}>{isActive ? 'Aktif' : 'Pasif'}</span>
                  </label>
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gap: 18 }}>
          {editData && (
            <div style={{ marginBottom: 0, display: "flex", alignItems: "center", gap: 8 }}>
              <label style={modalStyles.label}>Durum:</label>
              <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
              <span style={{ color: isActive ? '#10b981' : '#ef4444', fontWeight: 600 }}>{isActive ? 'Aktif' : 'Pasif'}</span>
            </div>
          )}
          {error ? (
            <div style={{ ...modalStyles.errorMessage, display: "grid", gap: 10 }}>
              <div>{error}</div>
              {hasSubscriptionUpgradeGuidance(error) ? (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <a href={getSubscriptionUpgradeHref(error)} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "fit-content", padding: "8px 12px", borderRadius: 10, background: "#991b1b", color: "#fff", textDecoration: "none", fontWeight: 700 }}>
                    {SUBSCRIPTION_UPGRADE_CTA_LABEL}
                  </a>
                  <a href={getSubscriptionAddonHref(error)} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "fit-content", padding: "8px 12px", borderRadius: 10, background: "#7c2d12", color: "#fff", textDecoration: "none", fontWeight: 700 }}>
                    {SUBSCRIPTION_ADDON_CTA_LABEL}
                  </a>
                </div>
              ) : null}
            </div>
          ) : null}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div>
              <label style={modalStyles.label}>Ad Soyad *</label>
              <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Ad Soyad" style={modalStyles.input} />
            </div>
            <div>
              <label style={modalStyles.label}>Email *</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" style={modalStyles.input} />
            </div>
            <div>
              <label style={modalStyles.label}>İş Maili</label>
              <input type="email" value={workEmail} onChange={e => setWorkEmail(e.target.value)} placeholder="Kurumsal mail eşleştirmesi" style={modalStyles.input} />
            </div>
            {contextScope === "partner" ? (
              <div>
                <label style={modalStyles.label}>Stratejik Partner (Tenant) {requireTenantSelection && !editData ? "*" : ""}</label>
                <select
                  value={selectedTenantId ?? ""}
                  onChange={(e) => setSelectedTenantId(e.target.value ? Number(e.target.value) : null)}
                  disabled={Boolean(editData)}
                  style={modalStyles.input}
                >
                  <option value="">Tenant Seçiniz...</option>
                  {tenantOptions.map((tenant) => (
                    <option key={tenant.id} value={tenant.id}>
                      {tenant.brand_name || tenant.legal_name || `Tenant #${tenant.id}`}
                    </option>
                  ))}
                </select>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                  Rol listesi secilen tenant kataloguna gore otomatik filtrelenir.
                </div>
              </div>
            ) : null}
            <div>
              <label style={modalStyles.label}>Operasyonel Rol *</label>
              {isLockedAdminProfile ? (
                <input
                  type="text"
                  value={getRoleLabel(role || editData?.role || "admin")}
                  disabled
                  style={{ ...modalStyles.input, background: '#f8fafc', color: '#334155', fontWeight: 700, cursor: 'not-allowed' }}
                />
              ) : (
                <select value={role} onChange={e => setRole(e.target.value)} style={modalStyles.input}>
                  <option value="">Rol Seçiniz...</option>
                  {operationalRoleOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              )}
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                {isLockedAdminProfile
                  ? 'Admin profillerinde operasyonel rol sabittir; bu ekrandan degistirilemez.'
                  : 'Satın alma süreçlerindeki görev ve onay yetkisini belirler.'}
              </div>
            </div>
            {canAssignPrivilegedBusinessRole(authUser) && isPrivilegedBusinessRole(role) ? (
              <div>
                <label style={modalStyles.label}>Sistem Rolü</label>
                <select value={systemRole} onChange={e => setSystemRole(e.target.value as typeof systemRole)} style={modalStyles.input}>
                  {isSuperAdminBusinessRole(role) ? (
                    <option value="super_admin">Süper Admin</option>
                  ) : (
                    ADMIN_SYSTEM_ROLE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))
                  )}
                </select>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>Platform erişim kapsamını belirler (yönetim paneli yetkisi).</div>
              </div>
            ) : null}
            <div style={{ gridColumn: '1 / 3', padding: 20, borderRadius: 20, background: '#fff7ed', border: '1px solid #fed7aa' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'grid', gap: 6 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#9a3412' }}>Canli Yetki Onizlemesi</div>
                  <div style={{ fontSize: 13, color: '#7c2d12' }}>Rol seciminize gore menulerin acik/kapali durumu anlik guncellenir.</div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPermissionPreview((prev) => !prev)}
                  style={{ padding: '8px 12px', borderRadius: 999, border: '1px solid #fdba74', background: '#fff7ed', color: '#9a3412', fontWeight: 800, cursor: 'pointer' }}
                >
                  {showPermissionPreview ? 'Onizlemeyi Gizle' : 'Onizlemeyi Ac'}
                </button>
              </div>
              {showPermissionPreview ? (
                <>
                  {permissionOverridesLoading && editData ? (
                    <div style={{ padding: 12, borderRadius: 12, border: '1px solid #fcd34d', background: '#fffbeb', color: '#92400e', marginTop: 12, marginBottom: 10 }}>
                      Kayitli kisiye ozel izinler yukleniyor...
                    </div>
                  ) : null}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10, marginTop: 12 }}>
                    {menuAccessPreview.map((item) => (
                      <div key={item.key} style={{
                        border: `1px solid ${item.enabled ? '#86efac' : '#fecaca'}`,
                        background: item.enabled ? '#f0fdf4' : '#fef2f2',
                        borderRadius: 14,
                        padding: 12,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 13 }}>{item.label}</div>
                          <button
                            type="button"
                            onClick={() => setPermissionOverrides((prev) => ({ ...prev, [item.key]: !item.enabled }))}
                            style={{
                              border: 'none',
                              cursor: 'pointer',
                              fontSize: 11,
                              fontWeight: 800,
                              color: item.enabled ? '#166534' : '#991b1b',
                              background: item.enabled ? '#dcfce7' : '#fee2e2',
                              borderRadius: 999,
                              padding: '3px 9px',
                            }}
                          >
                            {item.enabled ? 'Acik' : 'Kapali'}
                          </button>
                        </div>
                        <div style={{ marginTop: 6, color: '#64748b', fontSize: 12 }}>{item.description}</div>
                        {item.children && item.children.length > 0 ? (
                          <div style={{ marginTop: 10, display: 'grid', gap: 6 }}>
                            {item.children.map((child) => (
                              <div key={child.key} style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 8,
                                borderRadius: 10,
                                border: '1px solid #e2e8f0',
                                background: '#ffffffcc',
                                padding: '8px 10px',
                              }}>
                                <div>
                                  <div style={{ fontWeight: 700, color: '#334155', fontSize: 12 }}>{child.label}</div>
                                  <div style={{ color: '#64748b', fontSize: 11 }}>{child.description}</div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setPermissionOverrides((prev) => ({ ...prev, [child.key]: !child.enabled }))}
                                  style={{
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontSize: 11,
                                    fontWeight: 800,
                                    color: child.enabled ? '#166534' : '#991b1b',
                                    background: child.enabled ? '#dcfce7' : '#fee2e2',
                                    borderRadius: 999,
                                    padding: '3px 9px',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {child.enabled ? 'Acik' : 'Kapali'}
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </>
              ) : null}
            </div>
            <div style={{ gridColumn: '1 / 3', padding: 20, borderRadius: 20, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>Firma / Departman / Alt Açılım Atamaları</div>
                  <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Birden fazla firma ekleyebilir, her firma için departman ve alt açılım seçebilirsiniz.</div>
                </div>
                <button type="button" onClick={() => openAssignmentModal()} style={{ padding: '10px 14px', borderRadius: 12, border: 'none', background: '#2563eb', color: '#fff', fontWeight: 800, cursor: 'pointer' }}>Firmalar</button>
              </div>
              {pendingAssignments.length === 0 ? (
                <div style={{ padding: 16, borderRadius: 16, background: '#fff', border: '1px dashed #cbd5e1', color: '#64748b' }}>Henüz firma ataması eklenmedi.</div>
              ) : (
                <div style={{ display: 'grid', gap: 12 }}>
                  {pendingAssignments.map((assignment, index) => (
                    <div key={`${assignment.company_id}-${assignment.department_id}-${index}`} style={{ padding: 16, borderRadius: 16, background: '#fff', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                        <div>
                          <div style={{ fontWeight: 800, color: '#111827' }}>{assignment.company_name}</div>
                          <div style={{ marginTop: 4, color: '#475569' }}>{assignment.department_name || 'Departman seçilmedi'}</div>
                        </div>
                        <div style={{ color: '#2563eb', fontWeight: 700 }}>{assignment.role_name}</div>
                      </div>
                      {assignment.sub_items.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                          {assignment.sub_items.map((item) => (
                            <span key={item} style={{ padding: '6px 10px', borderRadius: 999, background: '#dbeafe', color: '#1d4ed8', fontWeight: 700, fontSize: 12 }}>{item}</span>
                          ))}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                        <button type="button" onClick={() => openAssignmentModal(assignment)} style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8', fontWeight: 700, cursor: 'pointer' }}>Düzenle</button>
                        <button type="button" onClick={() => setPendingAssignments((prev) => prev.filter((item) => item !== assignment))} style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid #fecaca', background: '#fef2f2', color: '#b91c1c', fontWeight: 700, cursor: 'pointer' }}>Kaldır</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ gridColumn: "1/3" }}>
              <label style={modalStyles.label}>Adres</label>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <select value={selectedCity} onChange={e => { setSelectedCity(e.target.value); setSelectedDistrict(""); }} style={{ ...modalStyles.input, width: '40%' }}>
                  <option value="">İl seçiniz</option>
                  {cityOptions.map((city) => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
                <select value={selectedDistrict} onChange={e => setSelectedDistrict(e.target.value)} style={{ ...modalStyles.input, width: '40%' }} disabled={!selectedCity}>
                  <option value="">İlçe seçiniz</option>
                  {districtOptions.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <input type="text" value={address} onChange={e => setAddress(e.target.value)} placeholder="Detaylı adres" style={modalStyles.input} />
              {(selectedCity && selectedDistrict && address) && (
                <div style={{ marginTop: 6 }}>
                  <button type="button" onClick={() => setShowMap((v: boolean) => !v)} style={{ padding: '4px 12px', borderRadius: 4, border: '1px solid #ddd', background: '#f3f4f6', cursor: 'pointer', marginBottom: 4 }}>
                    {showMap ? 'Haritayı Gizle' : 'Haritada Göster'}
                  </button>
                  {showMap && (
                    <iframe
                      width="100%"
                      height="220"
                      style={{ border: 0, borderRadius: 8, marginTop: 4 }}
                      loading="lazy"
                      allowFullScreen
                      src={`https://www.google.com/maps?q=${encodeURIComponent(address + ', ' + selectedDistrict + ', ' + selectedCity + ', Türkiye')}&output=embed`}
                    ></iframe>
                  )}
                </div>
              )}
            </div>
            <div>
              <label style={modalStyles.label}>Şahsi Telefon</label>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input type="text" value={personalPhone} onChange={e => setPersonalPhone(e.target.value)} placeholder="05xx..." style={modalStyles.input} />
                <a
                  href={personalPhone ? `https://wa.me/${personalPhone.replace(/\D/g, '')}` : undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="WhatsApp"
                  style={{ background: "none", border: "none", cursor: personalPhone ? "pointer" : "not-allowed", color: personalPhone ? '#25D366' : '#bbb', fontSize: 18, textDecoration: 'none' }}
                >🟢</a>
                <a
                  href={personalPhone ? `tel:${personalPhone.replace(/\s+/g, '')}` : undefined}
                  title="Ara"
                  style={{ background: "none", border: "none", cursor: personalPhone ? "pointer" : "not-allowed", color: personalPhone ? '#10b981' : '#bbb', fontSize: 18, textDecoration: 'none' }}
                >📞</a>
              </div>
            </div>
            <div>
              <label style={modalStyles.label}>Firma Telefon</label>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input type="text" value={companyPhone} onChange={e => setCompanyPhone(e.target.value)} placeholder="0xxx..." style={modalStyles.input} />
                <input type="text" value={companyPhoneShort} onChange={e => setCompanyPhoneShort(e.target.value)} placeholder="Kısa Kod" style={{ ...modalStyles.input, width: 60 }} />
                <a
                  href={companyPhone ? `https://wa.me/${companyPhone.replace(/\D/g, '')}` : undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="WhatsApp"
                  style={{ background: "none", border: "none", cursor: companyPhone ? "pointer" : "not-allowed", color: companyPhone ? '#25D366' : '#bbb', fontSize: 18, textDecoration: 'none' }}
                >🟢</a>
                <a
                  href={companyPhone ? `tel:${companyPhone.replace(/\s+/g, '')}` : undefined}
                  title="Ara"
                  style={{ background: "none", border: "none", cursor: companyPhone ? "pointer" : "not-allowed", color: companyPhone ? '#10b981' : '#bbb', fontSize: 18, textDecoration: 'none' }}
                >📞</a>
              </div>
            </div>
          </div>
          </div>
          </div>
          <div style={{ ...modalStyles.footer, paddingTop: 8 }}>
            <button type="submit" disabled={loading} style={loading ? modalStyles.primaryButtonDisabled : modalStyles.primaryButton}>
              {loading ? "Kaydediliyor..." : editData ? "Ekip Uyesini Guncelle" : "Ekip Uyesi Olustur"}
            </button>
            <button type="button" onClick={onClose} style={modalStyles.secondaryButton}>İptal</button>
          </div>
        </form>

        {showAssignmentModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}>
            <div style={{ width: 'min(560px, calc(100vw - 32px))', borderRadius: 24, background: '#fff', padding: 24, boxShadow: '0 24px 80px rgba(15,23,42,0.28)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: '#0f766e' }}>Atama Penceresi</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: '#111827', marginTop: 6 }}>Firma seçimi</div>
                </div>
                <button type="button" onClick={() => setShowAssignmentModal(false)} style={{ border: 'none', background: '#f1f5f9', width: 38, height: 38, borderRadius: 999, cursor: 'pointer' }}>×</button>
              </div>

              <div style={{ display: 'grid', gap: 14 }}>
                <div>
                  <label style={modalStyles.label}>Firma</label>
                  <select value={assignmentDraft.company_id ?? ''} onChange={(e) => setAssignmentDraft({ company_id: Number(e.target.value) || null, department_id: null, role_id: assignmentDraft.role_id, sub_items: [] })} style={modalStyles.input}>
                    <option value="">Firma seçin</option>
                    {companies.filter((company) => company.is_active).map((company) => (
                      <option key={company.id} value={company.id}>{company.name}{company.is_platform_primary ? ' • Platform Ana Firmasi' : ''}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={modalStyles.label}>Firma Atamasındaki Rol</label>
                  <input value={resolvedAssignmentRole?.name || (ROLE_LABELS[role] || 'Önce ana rolü seçin')} readOnly style={{ ...modalStyles.input, background: '#f8fafc', color: '#475569' }} />
                </div>
                <div>
                  <label style={modalStyles.label}>Departman</label>
                  <select
                    value={assignmentCoversAllDepartments({ department_id: assignmentDraft.department_id, sub_items: assignmentDraft.sub_items }) ? ALL_DEPARTMENTS_OPTION : (assignmentDraft.department_id ?? '')}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === ALL_DEPARTMENTS_OPTION) {
                        setAssignmentDraft((prev) => ({ ...prev, department_id: null, sub_items: [ALL_DEPARTMENTS_MARKER] }));
                        return;
                      }
                      setAssignmentDraft((prev) => ({ ...prev, department_id: Number(value) || null, sub_items: [] }));
                    }}
                    style={modalStyles.input}
                  >
                    <option value="">Departman seçin</option>
                    <option value={ALL_DEPARTMENTS_OPTION}>Tum Departmanlar</option>
                    {getCompanyDepartments(assignmentDraft.company_id).filter((department) => department.is_active).map((department) => (
                      <option key={department.id} value={department.id}>{department.name}</option>
                    ))}
                  </select>
                </div>
                {assignmentDraft.department_id && (
                  <div>
                    <label style={modalStyles.label}>Alt Açılımlar</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: 14, borderRadius: 14, border: '1px solid #dbeafe', background: '#f8fbff' }}>
                      {(departments.find((department) => department.id === assignmentDraft.department_id)?.sub_items || []).map((subItem) => {
                        const selected = assignmentDraft.sub_items.includes(subItem.name);
                        return (
                          <button
                            key={subItem.id}
                            type="button"
                            onClick={() => setAssignmentDraft((prev) => ({
                              ...prev,
                              sub_items: selected ? prev.sub_items.filter((item) => item !== subItem.name) : [...prev.sub_items, subItem.name],
                            }))}
                            style={{
                              padding: '8px 10px',
                              borderRadius: 999,
                              border: selected ? '1px solid #2563eb' : '1px solid #cbd5e1',
                              background: selected ? '#dbeafe' : '#fff',
                              color: selected ? '#1d4ed8' : '#334155',
                              cursor: 'pointer',
                              fontWeight: 700,
                            }}
                          >
                            {subItem.name}
                          </button>
                        );
                      })}
                      {(departments.find((department) => department.id === assignmentDraft.department_id)?.sub_items || []).length === 0 && (
                        <div style={{ color: '#64748b' }}>Bu departman için kayıtlı alt açılım bulunamadı.</div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
                <button type="button" onClick={() => setShowAssignmentModal(false)} style={modalStyles.secondaryButton}>Vazgeç</button>
                <button type="button" onClick={saveAssignmentDraft} style={modalStyles.primaryButton}>Atamayı Kaydet</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

