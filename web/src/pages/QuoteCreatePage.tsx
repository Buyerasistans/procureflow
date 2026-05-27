// QuoteCreatePage — Profesyonel Teklif Talebi Oluşturma
import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createRfq, updateRfqItems } from "../services/quote.service";
import { SUBSCRIPTION_ADDON_CTA_LABEL, SUBSCRIPTION_UPGRADE_CTA_LABEL, getSubscriptionAddonHref, getSubscriptionLimitGuidanceMessage, getSubscriptionUpgradeHref, hasSubscriptionUpgradeGuidance } from "../utils/subscriptionLimitErrors";
import type { RfqItemPayload } from "../services/quote.service";
import {
  getDepartments,
  getTenantUsers,
  getProjects,
  getUserCompanyAssignments,
  type Department,
  type TenantUser,
  type Project,
} from "../services/admin.service";
import { getAccessToken } from "../lib/token";
import { useAuth } from "../hooks/useAuth";
import { getSettings } from "../services/settings.service";
import { canManageQuoteWorkspace, isPlatformStaffUser, isScopedTenantUser } from "../auth/permissions";
import { filterUsersByAssignmentScope, getUserDepartmentIds } from "../utils/tenantUserAssignments";

const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";

const S = {
  page: { maxWidth: "960px", margin: "0 auto", padding: "24px 16px" } as React.CSSProperties,
  card: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    padding: "20px",
    marginBottom: "16px",
  } as React.CSSProperties,
  sectionTitle: {
    fontSize: "15px",
    fontWeight: 700,
    color: "#111827",
    marginBottom: "16px",
    paddingBottom: "8px",
    borderBottom: "2px solid #3b82f6",
    display: "inline-block",
  } as React.CSSProperties,
  row: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" } as React.CSSProperties,
  row3: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" } as React.CSSProperties,
  label: { display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px", color: "#374151" } as React.CSSProperties,
  input: {
    width: "100%",
    padding: "8px 10px",
    borderRadius: "6px",
    border: "1px solid #d1d5db",
    fontSize: "14px",
    boxSizing: "border-box" as const,
  },
  textarea: {
    width: "100%",
    padding: "8px 10px",
    borderRadius: "6px",
    border: "1px solid #d1d5db",
    fontSize: "14px",
    boxSizing: "border-box" as const,
    resize: "vertical" as const,
  },
  select: {
    width: "100%",
    padding: "8px 10px",
    borderRadius: "6px",
    border: "1px solid #d1d5db",
    fontSize: "14px",
    background: "#fff",
  },
  btn: (bg: string) => ({
    padding: "9px 20px",
    background: bg,
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: "14px",
  }) as React.CSSProperties,
  tabBtn: (active: boolean) => ({
    padding: "8px 20px",
    border: "none",
    borderRadius: "6px 6px 0 0",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: "13px",
    background: active ? "#3b82f6" : "#e5e7eb",
    color: active ? "#fff" : "#374151",
  }) as React.CSSProperties,
  th: { padding: "10px 8px", textAlign: "left" as const, fontSize: "12px", fontWeight: 700, color: "#6b7280", background: "#f3f4f6" },
  td: { padding: "6px 4px" },
  itemInput: {
    width: "100%",
    padding: "5px 6px",
    border: "1px solid #d1d5db",
    borderRadius: "4px",
    fontSize: "13px",
    boxSizing: "border-box" as const,
  },
};

const EMPTY_ITEM = (): RfqItemPayload => ({
  line_number: "",
  category_code: "",
  category_name: "",
  description: "",
  unit: "adet",
  quantity: 1,
  unit_price: undefined,
  vat_rate: 20,
  notes: "",
});

type ItemMeta = { detail: string; imageUrl: string };
type ListingScopePreference = "private_suppliers_only" | "platform_network_only" | "private_and_platform_network" | "premium_featured_listing";

const LISTING_SCOPE_OPTIONS: Array<{ value: ListingScopePreference; label: string; hint: string }> = [
  {
    value: "private_suppliers_only",
    label: "Sadece kendi tedarikçileri",
    hint: "RFQ sadece private supplier havuzundan gorunur.",
  },
  {
    value: "platform_network_only",
    label: "Platform agina acik",
    hint: "Platform network tedarikçileri hedeflenir (paket/premium kuralları geçerlidir).",
  },
  {
    value: "private_and_platform_network",
    label: "Karma havuz",
    hint: "Private + platform network supplier havuzlari birlikte kullanilir.",
  },
  {
    value: "premium_featured_listing",
    label: "Premium / özel listeleme",
    hint: "Premium entitlement aktifse RFQ özel vitrin sinyalini taşır.",
  },
];

const parseItemMeta = (notes?: string): ItemMeta => {
  if (!notes) return { detail: "", imageUrl: "" };
  try {
    const parsed = JSON.parse(notes) as { detail?: string; image_url?: string };
    return {
      detail: parsed.detail || "",
      imageUrl: parsed.image_url || "",
    };
  } catch {
    return { detail: notes, imageUrl: "" };
  }
};

const composeItemMeta = (detail: string, imageUrl: string): string | undefined => {
  const d = detail.trim();
  const i = imageUrl.trim();
  if (!d && !i) return undefined;
  return JSON.stringify({ detail: d, image_url: i });
};

const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Dosya okunamadı"));
    reader.readAsDataURL(file);
  });

const renumberItems = (rows: RfqItemPayload[]): RfqItemPayload[] => {
  let groupNo = 0;
  let currentGroup = "";
  let plainNo = 0;
  const childCounters: Record<string, number> = {};

  return rows.map((row) => {
    const header = isGroupHeaderRow(row);

    if (header) {
      groupNo += 1;
      currentGroup = String(groupNo);
      childCounters[currentGroup] = 0;
      return {
        ...row,
        is_group_header: true,
        group_key: currentGroup,
        line_number: currentGroup,
      };
    }

    const effectiveGroup = row.group_key || currentGroup;
    if (!effectiveGroup) {
      plainNo += 1;
      return {
        ...row,
        is_group_header: false,
        group_key: undefined,
        line_number: String(plainNo),
      };
    }
    if (!childCounters[effectiveGroup]) {
      childCounters[effectiveGroup] = 0;
    }
    childCounters[effectiveGroup] += 1;

    return {
      ...row,
      is_group_header: false,
      group_key: effectiveGroup,
      line_number: `${effectiveGroup}.${childCounters[effectiveGroup]}`,
    };
  });
};

const isGroupHeaderRow = (item: RfqItemPayload): boolean => {
  if (item.is_group_header) return true;
  const line = String(item.line_number || "").trim();
  return line.length > 0 && !line.includes(".");
};

const resolveGroupKey = (item: RfqItemPayload): string => {
  if (item.group_key) return String(item.group_key);
  const line = String(item.line_number || "").trim();
  if (!line) return "";
  return line.includes(".") ? line.split(".")[0] : line;
};

type GroupTotals = { net: number; vat: number; gross: number };

const buildGroupTotals = (rows: RfqItemPayload[]): Record<string, GroupTotals> => {
  const totals: Record<string, GroupTotals> = {};
  rows.forEach((row) => {
    if (isGroupHeaderRow(row)) return;
    const key = resolveGroupKey(row);
    if (!key) return;
    const net = Number(row.quantity || 0) * Number(row.unit_price || 0);
    const vatRate = Number(row.vat_rate ?? 20);
    const vat = net * (vatRate / 100);
    if (!totals[key]) {
      totals[key] = { net: 0, vat: 0, gross: 0 };
    }
    totals[key].net += net;
    totals[key].vat += vat;
    totals[key].gross += net + vat;
  });
  return totals;
};

export default function QuoteCreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fileRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const readOnly = isPlatformStaffUser(user);
  const canManageQuotes = canManageQuoteWorkspace(user);

  const [projects, setProjects] = useState<Project[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [personnel, setPersonnel] = useState<TenantUser[]>([]);
  const [projectPersonnelAssignments, setProjectPersonnelAssignments] = useState<Record<number, TenantUser["company_assignments"]>>({});
  const [projectPersonnelAssignmentsLoading, setProjectPersonnelAssignmentsLoading] = useState(false);

  const [projectId, setProjectId] = useState<number | "">("");
  const [departmentId, setDepartmentId] = useState<number | "">("");
  const [assignedToId, setAssignedToId] = useState<number | "">("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [listingScopePreference, setListingScopePreference] = useState<ListingScopePreference>("private_suppliers_only");

  const [mode, setMode] = useState<"manual" | "excel">("manual");
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [items, setItems] = useState<RfqItemPayload[]>(renumberItems([EMPTY_ITEM()]));
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [vatRates, setVatRates] = useState<number[]>([1, 10, 20]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isScopedUser = isScopedTenantUser(user);

  useEffect(() => {
    if (!isScopedUser || !user) return;

    const currentPersonnel = personnel.find((p) => p.id === user.id);
    const fallbackDeptId = currentPersonnel ? getUserDepartmentIds(currentPersonnel)[0] : undefined;
    const userDeptId = user.department_id ?? fallbackDeptId;

    setAssignedToId(user.id);
    if (userDeptId) {
      setDepartmentId(userDeptId);
    }
  }, [isScopedUser, user, personnel]);

  const effectiveDepartmentId = isScopedUser ? (departmentId || "") : departmentId;
  const effectiveAssignedToId = isScopedUser ? (assignedToId || "") : assignedToId;

  // Veri yükleme
  useEffect(() => {
    Promise.all([getProjects(), getDepartments(), getTenantUsers()]).then(
      ([p, d, u]) => { setProjects(p); setDepartments(d); setPersonnel(u); }
    );

    getSettings()
      .then((s) => {
        if (Array.isArray(s.vat_rates) && s.vat_rates.length > 0) {
          setVatRates(s.vat_rates);
        }
      })
      .catch(() => {
        setVatRates([1, 10, 20]);
      });
  }, []);

  useEffect(() => {
    const projectFromQuery = Number(searchParams.get("projectId") || "");
    if (projectFromQuery > 0) {
      setProjectId(projectFromQuery);
    }
  }, [searchParams]);

  const selectedProject = projects.find((project) => project.id === Number(projectId));
  const projectMemberIds = useMemo(() => (
    selectedProject
      ? Array.from(
        new Set([
          ...(selectedProject.personnel?.map((member) => member.id).filter(Boolean) || []),
          ...(selectedProject.created_by_id ? [selectedProject.created_by_id] : []),
        ]),
      )
      : []
  ), [selectedProject]);

  useEffect(() => {
    if (projectMemberIds.length === 0) {
      setProjectPersonnelAssignments({});
      return;
    }

    let cancelled = false;
    setProjectPersonnelAssignmentsLoading(true);
    Promise.all(
      projectMemberIds.map(async (userId) => ({
        userId,
        assignments: await getUserCompanyAssignments(userId).catch(() => []),
      })),
    )
      .then((rows) => {
        if (cancelled) return;
        const nextAssignments: Record<number, TenantUser["company_assignments"]> = {};
        rows.forEach((row) => {
          nextAssignments[row.userId] = row.assignments;
        });
        setProjectPersonnelAssignments(nextAssignments);
      })
      .finally(() => {
        if (!cancelled) {
          setProjectPersonnelAssignmentsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [projectMemberIds]);

  const projectScopedPersonnel = projectMemberIds.length
    ? personnel
      .filter((person) => projectMemberIds.includes(person.id))
      .map((person) => ({
        ...person,
        company_assignments: projectPersonnelAssignments[person.id] || person.company_assignments || [],
      }))
    : personnel;

  const filteredPersonnel = filterUsersByAssignmentScope(projectScopedPersonnel, {
    departmentId: effectiveDepartmentId ? Number(effectiveDepartmentId) : undefined,
  });

  const visiblePersonnel = isScopedUser && user
    ? filteredPersonnel.filter((p) => p.id === user.id)
    : filteredPersonnel;

  useEffect(() => {
    if (isScopedUser || !effectiveDepartmentId) {
      return;
    }
    const numericAssignedUserId = effectiveAssignedToId ? Number(effectiveAssignedToId) : null;
    if (numericAssignedUserId && visiblePersonnel.some((person) => person.id === numericAssignedUserId)) {
      return;
    }
    setAssignedToId(visiblePersonnel[0]?.id || "");
  }, [effectiveAssignedToId, effectiveDepartmentId, isScopedUser, visiblePersonnel]);

  const groupedTotals = buildGroupTotals(items);
  const overallNet = items
    .filter((it) => !isGroupHeaderRow(it))
    .reduce((s, it) => s + Number(it.quantity || 0) * Number(it.unit_price || 0), 0);
  const overallVat = items
    .filter((it) => !isGroupHeaderRow(it))
    .reduce((s, it) => {
      const net = Number(it.quantity || 0) * Number(it.unit_price || 0);
      const rate = Number(it.vat_rate ?? 20);
      return s + net * (rate / 100);
    }, 0);
  const overallGross = overallNet + overallVat;

  // --- Items helpers ---
  const updateItem = (idx: number, field: keyof RfqItemPayload, val: string | number | undefined) => {
    setItems((prev) => {
      const next = [...prev];
      const item = { ...next[idx], [field]: val };
      if ((field === "quantity" || field === "unit_price") && item.unit_price) {
        // recalculate total in-place (visual only)
      }
      next[idx] = item;
      return renumberItems(next);
    });
  };

  const handleItemImageSelect = async (idx: number, file: File) => {
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const current = parseItemMeta(items[idx]?.notes);
      updateItem(idx, "notes", composeItemMeta(current.detail, dataUrl));
    } catch {
      setError("Görsel dosyası okunamadı");
    }
  };

  const addItem = () => {
    setItems((prev) => {
      const lastGroup = [...prev]
        .reverse()
        .find((it) => isGroupHeaderRow(it) && resolveGroupKey(it));
      const groupKey = lastGroup ? resolveGroupKey(lastGroup) : undefined;
      return renumberItems([
        ...prev,
        {
          ...EMPTY_ITEM(),
          group_key: groupKey,
          is_group_header: false,
        },
      ]);
    });
  };

  const addGroup = () => {
    setItems((prev) =>
      renumberItems([
        ...prev,
        {
          ...EMPTY_ITEM(),
          description: "Yeni Grup",
          unit: "",
          quantity: 0,
          unit_price: undefined,
          vat_rate: 20,
          is_group_header: true,
        },
      ])
    );
  };

  const removeItem = (idx: number) => setItems((p) => renumberItems(p.filter((_, i) => i !== idx)));
  const toggleGroup = (groupKey: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [groupKey]: !prev[groupKey] }));
  };

  // --- Submit ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageQuotes) {
      setError("Bu hesap teklif oluşturma yetkisine sahip değil");
      return;
    }
    if (!projectId) { setError("Lütfen proje seçiniz"); return; }
    if (!title.trim()) { setError("Teklif başlığı zorunludur"); return; }
    if (!effectiveDepartmentId) { setError("Departman bilgisi bulunamadı. Yöneticinize başvurun."); return; }
    if (!effectiveAssignedToId) { setError("Sorumlu kişi bilgisi bulunamadı."); return; }

    setLoading(true);
    setError(null);

    try {
      if (mode === "excel") {
        if (!excelFile) { setError("Lütfen Excel dosyası seçiniz"); setLoading(false); return; }

        const fd = new FormData();
        fd.append("file", excelFile);
        fd.append("company_name", "Proje Tedarikçi Havuzu");
        fd.append("company_contact_name", user?.full_name || "Sistem Kullanıcısı");
        fd.append("company_contact_phone", "-");
        fd.append("company_contact_email", user?.email || "system@procureflow.local");
        if (title) fd.append("title", title);
        fd.append("listing_scope_preference", listingScopePreference);

        const token = getAccessToken();
        const res = await fetch(
          `${apiUrl}/api/v1/quotes/import/excel/${projectId}`,
          { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd }
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || "Excel yükleme hatası");
        }
        const result = await res.json();
        navigate(`/quotes/${result.quote_id}`);
      } else {
        // Manuel oluştur
        const validItems = items
          .filter((it) => it.description.trim() || it.line_number.trim())
          .map((it) => {
            const header = isGroupHeaderRow(it);
            const key = resolveGroupKey(it);
            return {
              ...it,
              group_key: key || undefined,
              is_group_header: header,
              unit: header ? "" : it.unit,
              quantity: header ? 0 : Number(it.quantity || 0),
              unit_price: header
                ? undefined
                : (it.unit_price === undefined || it.unit_price === null || it.unit_price === 0
                  ? undefined
                  : Number(it.unit_price)),
              vat_rate: Number(it.vat_rate ?? 20),
            };
          });
        const rfq = await createRfq({
          project_id: Number(projectId),
          title: title.trim(),
          description: description.trim() || undefined,
          company_name: "Proje Tedarikçi Havuzu",
          company_contact_name: user?.full_name || "Sistem Kullanıcısı",
          company_contact_phone: "-",
          company_contact_email: user?.email || "system@procureflow.local",
          department_id: Number(effectiveDepartmentId),
          assigned_to_id: Number(effectiveAssignedToId),
          listing_scope_preference: listingScopePreference,
        });
        if (validItems.length > 0) {
          await updateRfqItems(rfq.id, validItems);
        }
        navigate(`/quotes/${rfq.id}`);
      }
    } catch (err) {
      setError(getSubscriptionLimitGuidanceMessage(err, "Teklif oluşturulamadı"));
    } finally {
      setLoading(false);
    }
  };

  if (readOnly) {
    return (
      <div style={S.page}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
          <button
            type="button"
            onClick={() => navigate(-1)}
            style={{ padding: "6px 12px", background: "#f3f4f6", border: "1px solid #ddd", borderRadius: "6px", cursor: "pointer" }}
          >
            ← Geri
          </button>
          <h2 style={{ margin: 0, fontSize: "20px" }}>Yeni RFQ / Teklif Talebi</h2>
        </div>
        <div style={{ ...S.card, background: "#eff6ff", borderColor: "#bfdbfe", color: "#1e3a8a" }}>
          Platform personeli teklif alanında salt okunur erişime sahiptir. Yeni teklif oluşturma akışı bu hesaplar için kapatıldı.
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={S.page}>
      {/* Başlık */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
        <button
          type="button"
          onClick={() => navigate(-1)}
          style={{ padding: "6px 12px", background: "#f3f4f6", border: "1px solid #ddd", borderRadius: "6px", cursor: "pointer" }}
        >
          ← Geri
        </button>
        <div>
          <h2 style={{ margin: 0, fontSize: "20px" }}>Yeni RFQ / Teklif Talebi</h2>
          <div style={{ marginTop: "4px", color: "#6b7280", fontSize: "13px" }}>
            RFQ adapter gecisi aktif: bu ekran mevcut quote akisini korurken RFQ terminolojisini de gorunur kilir.
          </div>
        </div>
      </div>

      {error && (
        <div style={{ background: "#fee2e2", color: "#991b1b", padding: "12px 16px", borderRadius: "6px", marginBottom: "16px", display: "grid", gap: 10 }}>
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
      )}

      {/* ① Temel Bilgiler */}
      <div style={S.card}>
        <div style={S.sectionTitle}>① Temel Bilgiler</div>
        <div style={{ marginBottom: "12px" }}>
          <label style={S.label}>Başlık *</label>
          <input aria-label="Başlık" style={S.input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Teklif başlığı" required />
        </div>
        <div style={{ marginBottom: "12px" }}>
          <label style={S.label}>Açıklama</label>
          <textarea aria-label="Açıklama" style={S.textarea} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="İsteğe bağlı açıklama" />
        </div>
        <div style={{ marginBottom: "12px" }}>
          <label style={S.label}>Yayin Modeli *</label>
          <select
            aria-label="Yayin Modeli"
            style={S.select}
            value={listingScopePreference}
            onChange={(e) => setListingScopePreference(e.target.value as ListingScopePreference)}
          >
            {LISTING_SCOPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <div style={{ marginTop: 6, fontSize: 12, color: "#475569", lineHeight: 1.6 }}>
            {LISTING_SCOPE_OPTIONS.find((option) => option.value === listingScopePreference)?.hint}
          </div>
        </div>
        <div style={S.row3}>
          <div>
            <label style={S.label}>Proje *</label>
            <select aria-label="Proje" style={S.select} value={projectId} onChange={(e) => setProjectId(Number(e.target.value) || "")} required>
              <option value="">-- Proje seçin --</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
              ))}
            </select>
          </div>
          <div>
            <label style={S.label}>Departman</label>
            <select
              aria-label="Departman"
              style={S.select}
              value={effectiveDepartmentId}
              onChange={(e) => { setDepartmentId(Number(e.target.value) || ""); setAssignedToId(""); }}
              disabled={isScopedUser}
            >
              <option value="">-- Departman seçin --</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={S.label}>Sorumlu Kişi</label>
            <select
              aria-label="Sorumlu Kişi"
              style={S.select}
              value={effectiveAssignedToId}
              onChange={(e) => setAssignedToId(Number(e.target.value) || "")}
              disabled={isScopedUser}
            >
              <option value="">-- Kişi seçin --</option>
              {visiblePersonnel.map((p) => (
                <option key={p.id} value={p.id}>{p.full_name} ({p.role})</option>
              ))}
            </select>
            {projectPersonnelAssignmentsLoading && selectedProject?.personnel?.length ? (
              <div style={{ marginTop: 6, fontSize: 12, color: "#475569" }}>
                Proje personel atamaları yükleniyor...
              </div>
            ) : null}
            {!projectPersonnelAssignmentsLoading && !visiblePersonnel.length && effectiveDepartmentId ? (
              <div style={{ marginTop: 6, fontSize: 12, color: "#92400e" }}>
                Seçili proje ve departman için uygun sorumlu bulunamadı.
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* ② Kalemler */}
      <div style={S.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "16px" }}>
          <div style={S.sectionTitle}>② Teklif Kalemleri</div>
          <div style={{ display: "flex", gap: "4px" }}>
            <button type="button" style={S.tabBtn(mode === "manual")} onClick={() => setMode("manual")}>Manuel Giriş</button>
            <button type="button" style={S.tabBtn(mode === "excel")} onClick={() => setMode("excel")}>Excel'den İçe Aktar</button>
          </div>
        </div>

        {mode === "excel" ? (
          <div>
            <label style={S.label}>Excel Dosyası (.xlsx/.xlsm) *</label>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xlsm,.xls"
              onChange={(e) => setExcelFile(e.target.files?.[0] || null)}
              style={{ marginBottom: "8px" }}
            />
            {excelFile && (
              <div style={{ fontSize: "13px", color: "#059669", marginTop: "4px" }}>
                ✓ {excelFile.name} seçildi ({(excelFile.size / 1024).toFixed(0)} KB)
              </div>
            )}
            <p style={{ fontSize: "12px", color: "#6b7280", marginTop: "8px" }}>
              PİZZAMAX_TEKLİF_ formatında Excel dosyası yükleyiniz. Kalemler otomatik okunacaktır.
            </p>
          </div>
        ) : (
          <div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr>
                    <th style={{ ...S.th, width: "50px" }}>Sıra</th>
                    <th style={{ ...S.th, minWidth: "180px" }}>Açıklama *</th>
                    <th style={{ ...S.th, width: "60px" }}>Birim</th>
                    <th style={{ ...S.th, width: "70px" }}>Miktar</th>
                    <th style={{ ...S.th, width: "100px" }}>Birim Fiyat</th>
                    <th style={{ ...S.th, width: "120px" }}>Birim Toplam Fiyat</th>
                    <th style={{ ...S.th, width: "86px" }}>KDV</th>
                    <th style={{ ...S.th, width: "110px" }}>KDV Tutar</th>
                    <th style={{ ...S.th, width: "130px" }}>KDV Dahil Toplam</th>
                    <th style={{ ...S.th, width: "36px" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => {
                    const header = isGroupHeaderRow(item);
                    const key = resolveGroupKey(item);
                    const meta = parseItemMeta(item.notes);
                    const hiddenChild = !header && !!collapsedGroups[key];
                    if (hiddenChild) {
                      return null;
                    }
                    const totals = groupedTotals[key] || { net: 0, vat: 0, gross: 0 };
                    const total = header ? totals.net : (Number(item.quantity || 0) * Number(item.unit_price || 0));
                    const vatRate = Number(item.vat_rate ?? 20);
                    const vatAmount = header ? totals.vat : total * (vatRate / 100);
                    const grossTotal = header ? totals.gross : total + vatAmount;
                    return [
                      <tr
                        key={`${idx}-row`}
                        style={{
                          borderBottom: header ? "2px solid #eab308" : "1px solid #f3f4f6",
                          background: header ? "#fef3c7" : "transparent",
                          fontWeight: header ? 700 : 400,
                        }}
                      >
                        <td style={S.td}>
                          <span style={{ ...S.itemInput, display: "inline-block", width: "44px", background: "#f9fafb", textAlign: "center" }}>{item.line_number || "-"}</span>
                        </td>
                        <td style={S.td}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            {header && (
                              <button
                                type="button"
                                onClick={() => toggleGroup(key)}
                                style={{ border: "none", background: "transparent", cursor: "pointer", fontWeight: 700, color: "#92400e" }}
                                title={collapsedGroups[key] ? "Alt kalemleri aç" : "Alt kalemleri kapat"}
                              >
                                {collapsedGroups[key] ? "▶" : "▼"}
                              </button>
                            )}
                            {header && (
                              <span style={{ fontSize: "11px", background: "#f59e0b", color: "#fff", borderRadius: "999px", padding: "2px 7px", fontWeight: 700 }}>
                                Grup
                              </span>
                            )}
                            <div style={{ width: "100%" }}>
                              <input style={S.itemInput} value={item.description} onChange={(e) => updateItem(idx, "description", e.target.value)} placeholder="Kalem açıklaması" required={idx === 0} />
                            </div>
                          </div>
                        </td>
                        <td style={S.td}>
                          {header ? "" : (
                            <select style={{ ...S.itemInput, width: "58px" }} value={item.unit} onChange={(e) => updateItem(idx, "unit", e.target.value)}>
                              {["adet", "m²", "m³", "m", "kg", "ton", "set", "mt", "lt"].map((u) => <option key={u}>{u}</option>)}
                            </select>
                          )}
                        </td>
                        <td style={S.td}>
                          {header ? "" : (
                            <input type="number" min="0" step="0.01" style={{ ...S.itemInput, width: "64px" }} value={item.quantity} onChange={(e) => updateItem(idx, "quantity", Number(e.target.value))} />
                          )}
                        </td>
                        <td style={S.td}>
                          {header ? (
                            <span style={{ fontSize: "11px", color: "#92400e", fontWeight: 700 }}>Grup Toplamı</span>
                          ) : (
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              style={{ ...S.itemInput, width: "92px" }}
                              value={item.unit_price ?? ""}
                              onFocus={() => {
                                if ((item.unit_price ?? 0) === 0) {
                                  updateItem(idx, "unit_price", undefined);
                                }
                              }}
                              onChange={(e) => updateItem(idx, "unit_price", e.target.value === "" ? undefined : Number(e.target.value))}
                              placeholder="0.00"
                            />
                          )}
                        </td>
                        <td style={S.td}>
                          {header ? (
                            <span style={{ ...S.td, fontWeight: 600, fontSize: "13px", whiteSpace: "nowrap" }}>
                              {total > 0 ? `₺${total.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}` : "-"}
                            </span>
                          ) : (
                            <span style={{ ...S.td, fontWeight: 600, fontSize: "13px", whiteSpace: "nowrap" }}>
                              {total > 0 ? `₺${total.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}` : "-"}
                            </span>
                          )}
                        </td>
                        <td style={S.td}>
                          {header ? "" : (
                            <select
                              style={{ ...S.itemInput, width: "82px" }}
                              value={item.vat_rate ?? 20}
                              onChange={(e) => updateItem(idx, "vat_rate", Number(e.target.value))}
                            >
                              {vatRates.map((rate) => (
                                <option key={rate} value={rate}>%{rate}</option>
                              ))}
                            </select>
                          )}
                        </td>
                        <td style={{ ...S.td, fontWeight: 600, whiteSpace: "nowrap" }}>
                          {header ? `₺${vatAmount.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}` : (vatAmount > 0 ? `₺${vatAmount.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}` : "-")}
                        </td>
                        <td style={{ ...S.td, fontWeight: 600, whiteSpace: "nowrap" }}>
                          {grossTotal > 0 ? `₺${grossTotal.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}` : "-"}
                        </td>
                        <td style={S.td}>
                          <button type="button" onClick={() => removeItem(idx)} disabled={items.length === 1} style={{ padding: "4px 7px", background: "#fee2e2", color: "#dc2626", border: "none", borderRadius: "4px", cursor: "pointer" }}>✕</button>
                        </td>
                      </tr>,
                      !header ? (
                        <tr key={`${idx}-meta`} style={{ borderBottom: "1px solid #f3f4f6" }}>
                          <td style={S.td}></td>
                          <td colSpan={8} style={{ ...S.td, paddingTop: "0px" }}>
                            <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: "10px", alignItems: "start" }}>
                              <div>
                                <input
                                  type="file"
                                  accept="image/*"
                                  style={{ ...S.itemInput, padding: "4px" }}
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      void handleItemImageSelect(idx, file);
                                    }
                                  }}
                                />
                                {meta.imageUrl && (
                                  <div style={{ marginTop: "6px" }}>
                                    <img
                                      src={meta.imageUrl}
                                      alt="Kalem görseli"
                                      style={{ width: "100%", maxHeight: "100px", objectFit: "cover", borderRadius: "6px", border: "1px solid #e5e7eb" }}
                                    />
                                    <button
                                      type="button"
                                      style={{ marginTop: "4px", ...S.itemInput, cursor: "pointer", background: "#fff7ed", borderColor: "#fdba74", color: "#9a3412" }}
                                      onClick={() => updateItem(idx, "notes", composeItemMeta(meta.detail, ""))}
                                    >
                                      Görseli Kaldır
                                    </button>
                                  </div>
                                )}
                              </div>
                              <textarea
                                style={{ ...S.itemInput, resize: "vertical" }}
                                rows={3}
                                value={meta.detail}
                                onChange={(e) => {
                                  updateItem(idx, "notes", composeItemMeta(e.target.value, meta.imageUrl));
                                }}
                                placeholder="Ürün açıklaması (tedarikçide salt-okunur görünür)"
                              />
                            </div>
                          </td>
                          <td style={S.td}></td>
                        </tr>
                      ) : null,
                    ];
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={8} style={{ padding: "10px 8px", textAlign: "right", fontSize: "13px", fontWeight: 700 }}>Ara Toplam:</td>
                    <td style={{ padding: "10px 4px", fontWeight: 700, fontSize: "14px", color: "#1d4ed8" }}>
                      ₺{overallNet.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
                    </td>
                    <td />
                  </tr>
                  <tr>
                    <td colSpan={8} style={{ padding: "6px 8px", textAlign: "right", fontSize: "13px", fontWeight: 700 }}>Toplam KDV:</td>
                    <td style={{ padding: "6px 4px", fontWeight: 700, fontSize: "14px", color: "#b45309" }}>
                      ₺{overallVat.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
                    </td>
                    <td />
                  </tr>
                  <tr>
                    <td colSpan={8} style={{ padding: "6px 8px", textAlign: "right", fontSize: "13px", fontWeight: 700 }}>KDV Dahil Genel Toplam:</td>
                    <td style={{ padding: "6px 4px", fontWeight: 700, fontSize: "14px", color: "#15803d" }}>
                      ₺{overallGross.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
            <div style={{ marginTop: "10px", display: "flex", gap: "8px" }}>
              <button type="button" onClick={addGroup} style={{ padding: "7px 14px", background: "#fef3c7", color: "#92400e", border: "1px dashed #f59e0b", borderRadius: "6px", cursor: "pointer", fontSize: "13px", fontWeight: 700 }}>
                + Grup Ekle
              </button>
              <button type="button" onClick={addItem} style={{ padding: "7px 14px", background: "#eff6ff", color: "#2563eb", border: "1px dashed #93c5fd", borderRadius: "6px", cursor: "pointer", fontSize: "13px", fontWeight: 600 }}>
                + Ürün Ekle
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Aksiyon butonu */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
        <button type="button" onClick={() => navigate(-1)} style={S.btn("#6b7280")}>İptal</button>
        <button type="submit" disabled={loading} style={S.btn(loading ? "#9ca3af" : "#10b981")}>
          {loading ? "Kaydediliyor..." : "Teklif Talebini Kaydet"}
        </button>
      </div>
    </form>
  );
}
