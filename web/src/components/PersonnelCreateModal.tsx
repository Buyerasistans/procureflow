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
import "./PersonnelCreateModal.css";


import type { TenantUser } from "../services/admin.service";

const ALL_DEPARTMENTS_MARKER = "__ALL_DEPARTMENTS__";
const ALL_DEPARTMENTS_OPTION = "__ALL__";

const toSafeTelHref = (rawPhone: string): string | undefined => {
  const trimmed = rawPhone.trim();
  if (!trimmed) return undefined;
  const hasLeadingPlus = trimmed.startsWith("+");
  const digitsOnly = trimmed.replace(/\D/g, "");
  if (!digitsOnly) return undefined;
  return `tel:${hasLeadingPlus ? "+" : ""}${digitsOnly}`;
};

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
    <div className="personnel-create-modal__backdrop">
      <div className="personnel-create-modal__container">
        <div className="personnel-create-modal__header">
          <div>
            <h2 className="personnel-create-modal__title">{editData ? "Ekip Uyesini Duzenle" : "Yeni Ekip Uyesi Ekle"}</h2>
            <div className="personnel-create-modal__subtitle">Kimlik, iletisim ve firma atamalarini tek ekrandan yonetin.</div>
          </div>
          <button type="button" onClick={onClose} className="personnel-create-modal__close-button" aria-label="Kapat">X</button>
        </div>
        <form onSubmit={handleSubmit} className="personnel-create-modal__form">
          <div className="personnel-create-modal__layout">
            <div className="personnel-create-modal__profile-panel">
              <label htmlFor="personnel-photo" className="personnel-create-modal__photo-label">
                {photoPreview ? <img src={photoPreview} alt="Vesikalik" className="personnel-create-modal__photo-preview" /> : <div className="personnel-create-modal__photo-placeholder" aria-hidden="true">+</div>}
                <input id="personnel-photo" type="file" accept="image/*" className="personnel-create-modal__file-input" onChange={handlePhotoChange} aria-label="Vesikalik fotograf y?kle" />
              </label>
              <div className="personnel-create-modal__photo-help">Vesikalik fotograf y?kle</div>
              <div className="personnel-create-modal__side-options">
                <div className="personnel-create-modal__side-card"><div className="personnel-create-modal__side-card-title">Harita</div><label className="personnel-create-modal__checkbox-row"><input type="checkbox" checked={!hideLocation} onChange={(e) => setHideLocation(!e.target.checked)} /><span>Detay ekraninda harita gosterilsin</span></label></div>
                <div className="personnel-create-modal__side-card"><div className="personnel-create-modal__side-card-title">WhatsApp</div><label className="personnel-create-modal__checkbox-row"><input type="checkbox" checked={shareOnWhatsApp} onChange={(e) => setShareOnWhatsApp(e.target.checked)} /><span>WhatsApp paylasimi acik olsun</span></label></div>
                {editData && <div className="personnel-create-modal__side-card"><label className="personnel-create-modal__checkbox-row"><input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} /><span className={isActive ? "personnel-create-modal__status-text personnel-create-modal__status-text--active" : "personnel-create-modal__status-text personnel-create-modal__status-text--passive"}>{isActive ? 'Aktif' : 'Pasif'}</span></label></div>}
              </div>
            </div>
            <div className="personnel-create-modal__content">
              {editData && <div className="personnel-create-modal__status-row"><label htmlFor="personnel-active-status" className="personnel-create-modal__label">Durum:</label><input id="personnel-active-status" type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} /><span className={isActive ? "personnel-create-modal__status-text personnel-create-modal__status-text--compact personnel-create-modal__status-text--active" : "personnel-create-modal__status-text personnel-create-modal__status-text--compact personnel-create-modal__status-text--passive"}>{isActive ? 'Aktif' : 'Pasif'}</span></div>}
              {error ? <div className="personnel-create-modal__error"><div>{error}</div>{hasSubscriptionUpgradeGuidance(error) ? <div className="personnel-create-modal__error-actions"><a href={getSubscriptionUpgradeHref(error)} className="personnel-create-modal__error-link personnel-create-modal__error-link--upgrade">{SUBSCRIPTION_UPGRADE_CTA_LABEL}</a><a href={getSubscriptionAddonHref(error)} className="personnel-create-modal__error-link personnel-create-modal__error-link--addon">{SUBSCRIPTION_ADDON_CTA_LABEL}</a></div> : null}</div> : null}
              <div className="personnel-create-modal__field-grid">
                <div><label htmlFor="personnel-full-name" className="personnel-create-modal__label">Ad Soyad *</label><input id="personnel-full-name" type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Ad Soyad" className="personnel-create-modal__input" /></div>
                <div><label htmlFor="personnel-email" className="personnel-create-modal__label">Email *</label><input id="personnel-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" className="personnel-create-modal__input" /></div>
                <div><label htmlFor="personnel-work-email" className="personnel-create-modal__label">Is Maili</label><input id="personnel-work-email" type="email" value={workEmail} onChange={e => setWorkEmail(e.target.value)} placeholder="Kurumsal mail eslestirmesi" className="personnel-create-modal__input" /></div>
                {contextScope === "partner" ? <div><label htmlFor="personnel-tenant" className="personnel-create-modal__label">Stratejik Partner (Tenant) {requireTenantSelection && !editData ? "*" : ""}</label><select id="personnel-tenant" value={selectedTenantId ?? ""} onChange={(e) => setSelectedTenantId(e.target.value ? Number(e.target.value) : null)} disabled={Boolean(editData)} className="personnel-create-modal__input"><option value="">Tenant Seciniz...</option>{tenantOptions.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.brand_name || tenant.legal_name || ('Tenant #' + tenant.id)}</option>)}</select><div className="personnel-create-modal__hint">Rol listesi secilen tenant kataloguna gore otomatik filtrelenir.</div></div> : null}
                <div><label htmlFor="personnel-role" className="personnel-create-modal__label">Operasyonel Rol *</label>{isLockedAdminProfile ? <input id="personnel-role" type="text" value={getRoleLabel(role || editData?.role || "admin")} disabled className="personnel-create-modal__input personnel-create-modal__input--locked" /> : <select id="personnel-role" value={role} onChange={e => setRole(e.target.value)} className="personnel-create-modal__input"><option value="">Rol Seciniz...</option>{operationalRoleOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select>}<div className="personnel-create-modal__hint">{isLockedAdminProfile ? 'Admin profillerinde operasyonel rol sabittir; bu ekrandan degistirilemez.' : 'Satin alma sureclerindeki gorev ve onay yetkisini belirler.'}</div></div>
                {canAssignPrivilegedBusinessRole(authUser) && isPrivilegedBusinessRole(role) ? <div><label htmlFor="personnel-system-role" className="personnel-create-modal__label">Sistem Rolu</label><select id="personnel-system-role" value={systemRole} onChange={e => setSystemRole(e.target.value as typeof systemRole)} className="personnel-create-modal__input">{isSuperAdminBusinessRole(role) ? <option value="super_admin">Super Admin</option> : ADMIN_SYSTEM_ROLE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select><div className="personnel-create-modal__hint">Platform erisim kapsamini belirler (yonetim paneli yetkisi).</div></div> : null}
                <div className="personnel-create-modal__permission-panel"><div className="personnel-create-modal__panel-head"><div className="personnel-create-modal__panel-copy"><div className="personnel-create-modal__permission-title">Canli Yetki Onizlemesi</div><div className="personnel-create-modal__permission-description">Rol seciminize gore menulerin acik/kapali durumu anlik guncellenir.</div></div><button type="button" onClick={() => setShowPermissionPreview((prev) => !prev)} className="personnel-create-modal__permission-toggle">{showPermissionPreview ? 'Onizlemeyi Gizle' : 'Onizlemeyi Ac'}</button></div>{showPermissionPreview ? <>{permissionOverridesLoading && editData ? <div className="personnel-create-modal__permission-loading">Kayitli kisiye ozel izinler yukleniyor...</div> : null}<div className="personnel-create-modal__permission-grid">{menuAccessPreview.map((item) => <div key={item.key} className={item.enabled ? "personnel-create-modal__permission-card personnel-create-modal__permission-card--enabled" : "personnel-create-modal__permission-card personnel-create-modal__permission-card--disabled"}><div className="personnel-create-modal__permission-card-head"><div className="personnel-create-modal__permission-card-title">{item.label}</div><button type="button" onClick={() => setPermissionOverrides((prev) => ({ ...prev, [item.key]: !item.enabled }))} className={item.enabled ? "personnel-create-modal__permission-badge personnel-create-modal__permission-badge--enabled" : "personnel-create-modal__permission-badge personnel-create-modal__permission-badge--disabled"}>{item.enabled ? 'Acik' : 'Kapali'}</button></div><div className="personnel-create-modal__permission-card-description">{item.description}</div>{item.children && item.children.length > 0 ? <div className="personnel-create-modal__permission-children">{item.children.map((child) => <div key={child.key} className="personnel-create-modal__permission-child"><div><div className="personnel-create-modal__permission-child-title">{child.label}</div><div className="personnel-create-modal__permission-child-description">{child.description}</div></div><button type="button" onClick={() => setPermissionOverrides((prev) => ({ ...prev, [child.key]: !child.enabled }))} className={child.enabled ? "personnel-create-modal__permission-badge personnel-create-modal__permission-badge--nowrap personnel-create-modal__permission-badge--enabled" : "personnel-create-modal__permission-badge personnel-create-modal__permission-badge--nowrap personnel-create-modal__permission-badge--disabled"}>{child.enabled ? 'Acik' : 'Kapali'}</button></div>)}</div> : null}</div>)}</div></> : null}</div>
                <div className="personnel-create-modal__assignment-panel"><div className="personnel-create-modal__assignment-head"><div><div className="personnel-create-modal__assignment-title">Firma / Departman / Alt Acilim Atamalari</div><div className="personnel-create-modal__assignment-description">Birden fazla firma ekleyebilir, her firma icin departman ve alt acilim secebilirsiniz.</div></div><button type="button" onClick={() => openAssignmentModal()} className="personnel-create-modal__primary-action">Firmalar</button></div>{pendingAssignments.length === 0 ? <div className="personnel-create-modal__empty-state">Henuz firma atamasi eklenmedi.</div> : <div className="personnel-create-modal__assignment-list">{pendingAssignments.map((assignment, index) => <div key={String(assignment.company_id) + '-' + String(assignment.department_id) + '-' + String(index)} className="personnel-create-modal__assignment-card"><div className="personnel-create-modal__assignment-card-head"><div><div className="personnel-create-modal__assignment-company">{assignment.company_name}</div><div className="personnel-create-modal__assignment-department">{assignment.department_name || 'Departman secilmedi'}</div></div><div className="personnel-create-modal__assignment-role">{assignment.role_name}</div></div>{assignment.sub_items.length > 0 && <div className="personnel-create-modal__chip-list">{assignment.sub_items.map((item) => <span key={item} className="personnel-create-modal__chip">{item}</span>)}</div>}<div className="personnel-create-modal__assignment-actions"><button type="button" onClick={() => openAssignmentModal(assignment)} className="personnel-create-modal__soft-button personnel-create-modal__soft-button--blue">Duzenle</button><button type="button" onClick={() => setPendingAssignments((prev) => prev.filter((item) => item !== assignment))} className="personnel-create-modal__soft-button personnel-create-modal__soft-button--red">Kaldir</button></div></div>)}</div>}</div>
                <div className="personnel-create-modal__field personnel-create-modal__field--full"><label htmlFor="personnel-address" className="personnel-create-modal__label">Adres</label><div className="personnel-create-modal__address-row"><select value={selectedCity} onChange={e => { setSelectedCity(e.target.value); setSelectedDistrict(""); }} className="personnel-create-modal__input personnel-create-modal__input--address-select" aria-label="Il seciniz"><option value="">Il seciniz</option>{cityOptions.map((city) => <option key={city} value={city}>{city}</option>)}</select><select value={selectedDistrict} onChange={e => setSelectedDistrict(e.target.value)} className="personnel-create-modal__input personnel-create-modal__input--address-select" disabled={!selectedCity} aria-label="Ilce seciniz"><option value="">Ilce seciniz</option>{districtOptions.map((d) => <option key={d} value={d}>{d}</option>)}</select></div><input id="personnel-address" type="text" value={address} onChange={e => setAddress(e.target.value)} placeholder="Detayli adres" className="personnel-create-modal__input" />{(selectedCity && selectedDistrict && address) && <div className="personnel-create-modal__map-panel"><button type="button" onClick={() => setShowMap((v: boolean) => !v)} className="personnel-create-modal__map-toggle">{showMap ? 'Haritayi Gizle' : 'Haritada Goster'}</button>{showMap && <iframe title="Personel adres haritasi" width="100%" height="220" className="personnel-create-modal__map-frame" loading="lazy" allowFullScreen src={'https://www.google.com/maps?q=' + encodeURIComponent(address + ', ' + selectedDistrict + ', ' + selectedCity + ', Turkiye') + '&output=embed'}></iframe>}</div>}</div>
                <div><label htmlFor="personnel-personal-phone" className="personnel-create-modal__label">Sahsi Telefon</label><div className="personnel-create-modal__phone-row"><input id="personnel-personal-phone" type="text" value={personalPhone} onChange={e => setPersonalPhone(e.target.value)} placeholder="05xx..." className="personnel-create-modal__input" /><a href={personalPhone ? 'https://wa.me/' + personalPhone.replace(/\D/g, '') : undefined} target="_blank" rel="noopener noreferrer" title="WhatsApp" className={personalPhone ? "personnel-create-modal__phone-action personnel-create-modal__phone-action--whatsapp" : "personnel-create-modal__phone-action personnel-create-modal__phone-action--disabled"}>WA</a><a href={toSafeTelHref(personalPhone)} title="Ara" className={personalPhone ? "personnel-create-modal__phone-action personnel-create-modal__phone-action--call" : "personnel-create-modal__phone-action personnel-create-modal__phone-action--disabled"}>Tel</a></div></div>
                <div><label htmlFor="personnel-company-phone" className="personnel-create-modal__label">Firma Telefon</label><div className="personnel-create-modal__phone-row"><input id="personnel-company-phone" type="text" value={companyPhone} onChange={e => setCompanyPhone(e.target.value)} placeholder="0xxx..." className="personnel-create-modal__input" /><input type="text" value={companyPhoneShort} onChange={e => setCompanyPhoneShort(e.target.value)} placeholder="Kisa Kod" className="personnel-create-modal__input personnel-create-modal__input--short-code" aria-label="Firma telefon kisa kodu" /><a href={companyPhone ? 'https://wa.me/' + companyPhone.replace(/\D/g, '') : undefined} target="_blank" rel="noopener noreferrer" title="WhatsApp" className={companyPhone ? "personnel-create-modal__phone-action personnel-create-modal__phone-action--whatsapp" : "personnel-create-modal__phone-action personnel-create-modal__phone-action--disabled"}>WA</a><a href={toSafeTelHref(companyPhone)} title="Ara" className={companyPhone ? "personnel-create-modal__phone-action personnel-create-modal__phone-action--call" : "personnel-create-modal__phone-action personnel-create-modal__phone-action--disabled"}>Tel</a></div></div>
              </div>
            </div>
          </div>
          <div className="personnel-create-modal__footer"><button type="submit" disabled={loading} className={loading ? "personnel-create-modal__submit-button personnel-create-modal__submit-button--disabled" : "personnel-create-modal__submit-button"}>{loading ? "Kaydediliyor..." : editData ? "Ekip Uyesini Guncelle" : "Ekip Uyesi Olustur"}</button><button type="button" onClick={onClose} className="personnel-create-modal__secondary-button">Iptal</button></div>
        </form>
        {showAssignmentModal && <div className="personnel-create-modal__assignment-backdrop"><div className="personnel-create-modal__assignment-dialog"><div className="personnel-create-modal__assignment-dialog-head"><div><div className="personnel-create-modal__dialog-eyebrow">Atama Penceresi</div><div className="personnel-create-modal__dialog-title">Firma secimi</div></div><button type="button" onClick={() => setShowAssignmentModal(false)} className="personnel-create-modal__dialog-close" aria-label="Atama penceresini kapat">x</button></div><div className="personnel-create-modal__dialog-fields"><div><label htmlFor="personnel-assignment-company" className="personnel-create-modal__label">Firma</label><select id="personnel-assignment-company" value={assignmentDraft.company_id ?? ''} onChange={(e) => setAssignmentDraft({ company_id: Number(e.target.value) || null, department_id: null, role_id: assignmentDraft.role_id, sub_items: [] })} className="personnel-create-modal__input"><option value="">Firma secin</option>{companies.filter((company) => company.is_active).map((company) => <option key={company.id} value={company.id}>{company.name}{company.is_platform_primary ? ' - Platform Ana Firmasi' : ''}</option>)}</select></div><div><label htmlFor="personnel-assignment-role" className="personnel-create-modal__label">Firma Atamasindaki Rol</label><input id="personnel-assignment-role" value={resolvedAssignmentRole?.name || (ROLE_LABELS[role] || 'Once ana rolu secin')} readOnly className="personnel-create-modal__input personnel-create-modal__input--readonly" /></div><div><label htmlFor="personnel-assignment-department" className="personnel-create-modal__label">Departman</label><select id="personnel-assignment-department" value={assignmentCoversAllDepartments({ department_id: assignmentDraft.department_id, sub_items: assignmentDraft.sub_items }) ? ALL_DEPARTMENTS_OPTION : (assignmentDraft.department_id ?? '')} onChange={(e) => { const value = e.target.value; if (value === ALL_DEPARTMENTS_OPTION) { setAssignmentDraft((prev) => ({ ...prev, department_id: null, sub_items: [ALL_DEPARTMENTS_MARKER] })); return; } setAssignmentDraft((prev) => ({ ...prev, department_id: Number(value) || null, sub_items: [] })); }} className="personnel-create-modal__input"><option value="">Departman secin</option><option value={ALL_DEPARTMENTS_OPTION}>Tum Departmanlar</option>{getCompanyDepartments(assignmentDraft.company_id).filter((department) => department.is_active).map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></div>{assignmentDraft.department_id && <div><div className="personnel-create-modal__label">Alt Acilimlar</div><div className="personnel-create-modal__sub-item-list">{(departments.find((department) => department.id === assignmentDraft.department_id)?.sub_items || []).map((subItem) => { const selected = assignmentDraft.sub_items.includes(subItem.name); return <button key={subItem.id} type="button" onClick={() => setAssignmentDraft((prev) => ({ ...prev, sub_items: selected ? prev.sub_items.filter((item) => item !== subItem.name) : [...prev.sub_items, subItem.name] }))} className={selected ? "personnel-create-modal__sub-item-button personnel-create-modal__sub-item-button--selected" : "personnel-create-modal__sub-item-button"}>{subItem.name}</button>; })}{(departments.find((department) => department.id === assignmentDraft.department_id)?.sub_items || []).length === 0 && <div className="personnel-create-modal__empty-sub-items">Bu departman icin kayitli alt acilim bulunamadi.</div>}</div></div>}</div><div className="personnel-create-modal__dialog-footer"><button type="button" onClick={() => setShowAssignmentModal(false)} className="personnel-create-modal__secondary-button">Vazgec</button><button type="button" onClick={saveAssignmentDraft} className="personnel-create-modal__submit-button">Atamayi Kaydet</button></div></div></div>}
      </div>
    </div>
  );
}
