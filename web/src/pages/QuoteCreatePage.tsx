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
import "./QuoteCreatePage.css";

const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";

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
      <div className="qcp-root">
        <div className="qcp-header">
          <button type="button" onClick={() => navigate(-1)} className="qcp-back-btn">← Geri</button>
          <h2 className="qcp-page-title">Yeni RFQ / Teklif Talebi</h2>
        </div>
        <div className="qcp-card qcp-card--readonly">
          Platform personeli teklif alanında salt okunur erişime sahiptir. Yeni teklif oluşturma akışı bu hesaplar için kapatıldı.
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="qcp-root">
      <div className="qcp-header">
        <button type="button" onClick={() => navigate(-1)} className="qcp-back-btn">← Geri</button>
        <div>
          <h2 className="qcp-page-title">Yeni RFQ / Teklif Talebi</h2>
          <div className="qcp-subtitle">
            RFQ adapter gecisi aktif: bu ekran mevcut quote akisini korurken RFQ terminolojisini de gorunur kilir.
          </div>
        </div>
      </div>

      {error && (
        <div className="qcp-error-box">
          <div>{error}</div>
          {hasSubscriptionUpgradeGuidance(error) ? (
            <div className="qcp-cta-row">
              <a href={getSubscriptionUpgradeHref(error)} className="qcp-cta-link qcp-cta-link--upgrade">
                {SUBSCRIPTION_UPGRADE_CTA_LABEL}
              </a>
              <a href={getSubscriptionAddonHref(error)} className="qcp-cta-link qcp-cta-link--addon">
                {SUBSCRIPTION_ADDON_CTA_LABEL}
              </a>
            </div>
          ) : null}
        </div>
      )}

      {/* ① Temel Bilgiler */}
      <div className="qcp-card">
        <div className="qcp-section-title">① Temel Bilgiler</div>
        <div className="qcp-mb">
          <label className="qcp-label">Başlık *</label>
          <input aria-label="Başlık" className="qcp-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Teklif başlığı" required />
        </div>
        <div className="qcp-mb">
          <label className="qcp-label">Açıklama</label>
          <textarea aria-label="Açıklama" className="qcp-textarea" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="İsteğe bağlı açıklama" />
        </div>
        <div className="qcp-mb">
          <label className="qcp-label">Yayin Modeli *</label>
          <select
            aria-label="Yayin Modeli"
            className="qcp-select"
            value={listingScopePreference}
            onChange={(e) => setListingScopePreference(e.target.value as ListingScopePreference)}
          >
            {LISTING_SCOPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <div className="qcp-hint">
            {LISTING_SCOPE_OPTIONS.find((option) => option.value === listingScopePreference)?.hint}
          </div>
        </div>
        <div className="qcp-row-3">
          <div>
            <label className="qcp-label">Proje *</label>
            <select aria-label="Proje" className="qcp-select" value={projectId} onChange={(e) => setProjectId(Number(e.target.value) || "")} required>
              <option value="">-- Proje seçin --</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="qcp-label">Departman</label>
            <select
              aria-label="Departman"
              className="qcp-select"
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
            <label className="qcp-label">Sorumlu Kişi</label>
            <select
              aria-label="Sorumlu Kişi"
              className="qcp-select"
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
              <div className="qcp-hint">Proje personel atamaları yükleniyor...</div>
            ) : null}
            {!projectPersonnelAssignmentsLoading && !visiblePersonnel.length && effectiveDepartmentId ? (
              <div className="qcp-hint qcp-hint--warn">Seçili proje ve departman için uygun sorumlu bulunamadı.</div>
            ) : null}
          </div>
        </div>
      </div>

      {/* ② Kalemler */}
      <div className="qcp-card">
        <div className="qcp-items-header">
          <div className="qcp-section-title">② Teklif Kalemleri</div>
          <div className="qcp-tab-row">
            <button type="button" className={mode === "manual" ? "qcp-tab-btn qcp-tab-btn--active" : "qcp-tab-btn"} onClick={() => setMode("manual")}>Manuel Giriş</button>
            <button type="button" className={mode === "excel" ? "qcp-tab-btn qcp-tab-btn--active" : "qcp-tab-btn"} onClick={() => setMode("excel")}>Excel'den İçe Aktar</button>
          </div>
        </div>

        {mode === "excel" ? (
          <div>
            <label className="qcp-label">Excel Dosyası (.xlsx/.xlsm) *</label>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xlsm,.xls"
              aria-label="Excel Dosyası"
              onChange={(e) => setExcelFile(e.target.files?.[0] || null)}
              className="qcp-excel-input"
            />
            {excelFile && (
              <div className="qcp-excel-info">
                ✓ {excelFile.name} seçildi ({(excelFile.size / 1024).toFixed(0)} KB)
              </div>
            )}
            <p className="qcp-excel-hint">
              PİZZAMAX_TEKLİF_ formatında Excel dosyası yükleyiniz. Kalemler otomatik okunacaktır.
            </p>
          </div>
        ) : (
          <div>
            <div className="qcp-table-wrap">
              <table className="qcp-table">
                <thead>
                  <tr>
                    <th className="qcp-th">Sıra</th>
                    <th className="qcp-th">Açıklama *</th>
                    <th className="qcp-th">Birim</th>
                    <th className="qcp-th">Miktar</th>
                    <th className="qcp-th">Birim Fiyat</th>
                    <th className="qcp-th">Birim Toplam Fiyat</th>
                    <th className="qcp-th">KDV</th>
                    <th className="qcp-th">KDV Tutar</th>
                    <th className="qcp-th">KDV Dahil Toplam</th>
                    <th className="qcp-th" aria-label="İşlem"></th>
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
                        className={header ? "qcp-item-row qcp-item-row--header" : "qcp-item-row"}
                      >
                        <td className="qcp-td">
                          <span className="qcp-cell-input qcp-cell-input--static qcp-cell-input--w44">{item.line_number || "-"}</span>
                        </td>
                        <td className="qcp-td">
                          <div className="qcp-desc-cell">
                            {header && (
                              <button
                                type="button"
                                onClick={() => toggleGroup(key)}
                                className="qcp-toggle-btn"
                                title={collapsedGroups[key] ? "Alt kalemleri aç" : "Alt kalemleri kapat"}
                              >
                                {collapsedGroups[key] ? "▶" : "▼"}
                              </button>
                            )}
                            {header && (
                              <span className="qcp-group-badge">Grup</span>
                            )}
                            <div className="qcp-desc-input-wrap">
                              <input className="qcp-cell-input" value={item.description} onChange={(e) => updateItem(idx, "description", e.target.value)} placeholder="Kalem açıklaması" required={idx === 0} />
                            </div>
                          </div>
                        </td>
                        <td className="qcp-td">
                          {header ? "" : (
                            <select aria-label="Birim" className="qcp-cell-input qcp-cell-input--w58" value={item.unit} onChange={(e) => updateItem(idx, "unit", e.target.value)}>
                              {["adet", "m²", "m³", "m", "kg", "ton", "set", "mt", "lt"].map((u) => <option key={u}>{u}</option>)}
                            </select>
                          )}
                        </td>
                        <td className="qcp-td">
                          {header ? "" : (
                            <input type="number" min="0" step="0.01" aria-label="Miktar" className="qcp-cell-input qcp-cell-input--w64" value={item.quantity} onChange={(e) => updateItem(idx, "quantity", Number(e.target.value))} />
                          )}
                        </td>
                        <td className="qcp-td">
                          {header ? (
                            <span className="qcp-group-total-label">Grup Toplamı</span>
                          ) : (
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              className="qcp-cell-input qcp-cell-input--w92"
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
                        <td className="qcp-td qcp-td--total">
                          {total > 0 ? `₺${total.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}` : "-"}
                        </td>
                        <td className="qcp-td">
                          {header ? "" : (
                            <select
                              aria-label="KDV Oranı"
                              className="qcp-cell-input qcp-cell-input--w82"
                              value={item.vat_rate ?? 20}
                              onChange={(e) => updateItem(idx, "vat_rate", Number(e.target.value))}
                            >
                              {vatRates.map((rate) => (
                                <option key={rate} value={rate}>%{rate}</option>
                              ))}
                            </select>
                          )}
                        </td>
                        <td className="qcp-td qcp-td--total">
                          {header ? `₺${vatAmount.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}` : (vatAmount > 0 ? `₺${vatAmount.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}` : "-")}
                        </td>
                        <td className="qcp-td qcp-td--total">
                          {grossTotal > 0 ? `₺${grossTotal.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}` : "-"}
                        </td>
                        <td className="qcp-td">
                          <button type="button" onClick={() => removeItem(idx)} disabled={items.length === 1} className="qcp-remove-btn">✕</button>
                        </td>
                      </tr>,
                      !header ? (
                        <tr key={`${idx}-meta`} className="qcp-meta-row">
                          <td className="qcp-td"></td>
                          <td colSpan={8} className="qcp-td qcp-td--meta">
                            <div className="qcp-meta-grid">
                              <div>
                                <input
                                  type="file"
                                  accept="image/*"
                                  aria-label="Kalem görseli"
                                  className="qcp-cell-input qcp-cell-input--file"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      void handleItemImageSelect(idx, file);
                                    }
                                  }}
                                />
                                {meta.imageUrl && (
                                  <div className="qcp-img-preview">
                                    <img
                                      src={meta.imageUrl}
                                      alt="Kalem görseli"
                                      className="qcp-item-img"
                                    />
                                    <button
                                      type="button"
                                      className="qcp-remove-img-btn"
                                      onClick={() => updateItem(idx, "notes", composeItemMeta(meta.detail, ""))}
                                    >
                                      Görseli Kaldır
                                    </button>
                                  </div>
                                )}
                              </div>
                              <textarea
                                className="qcp-cell-input qcp-cell-textarea"
                                rows={3}
                                value={meta.detail}
                                onChange={(e) => {
                                  updateItem(idx, "notes", composeItemMeta(e.target.value, meta.imageUrl));
                                }}
                                placeholder="Ürün açıklaması (tedarikçide salt-okunur görünür)"
                              />
                            </div>
                          </td>
                          <td className="qcp-td"></td>
                        </tr>
                      ) : null,
                    ];
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={8} className="qcp-tfoot-label-net">Ara Toplam:</td>
                    <td className="qcp-tfoot-net">
                      ₺{overallNet.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
                    </td>
                    <td />
                  </tr>
                  <tr>
                    <td colSpan={8} className="qcp-tfoot-label">Toplam KDV:</td>
                    <td className="qcp-tfoot-vat">
                      ₺{overallVat.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
                    </td>
                    <td />
                  </tr>
                  <tr>
                    <td colSpan={8} className="qcp-tfoot-label">KDV Dahil Genel Toplam:</td>
                    <td className="qcp-tfoot-gross">
                      ₺{overallGross.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="qcp-add-row">
              <button type="button" onClick={addGroup} className="qcp-add-group-btn">+ Grup Ekle</button>
              <button type="button" onClick={addItem} className="qcp-add-item-btn">+ Ürün Ekle</button>
            </div>
          </div>
        )}
      </div>

      {/* Aksiyon butonu */}
      <div className="qcp-actions-row">
        <button type="button" onClick={() => navigate(-1)} className="qcp-btn qcp-btn--cancel">İptal</button>
        <button type="submit" disabled={loading} className={loading ? "qcp-btn qcp-btn--save qcp-btn--loading" : "qcp-btn qcp-btn--save"}>
          {loading ? "Kaydediliyor..." : "Teklif Talebini Kaydet"}
        </button>
      </div>
    </form>
  );
}
