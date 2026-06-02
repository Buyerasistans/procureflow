// QuoteDetail Page
import { Fragment, useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate, useSearchParams, useLocation } from "react-router-dom";
import {
  getRfq,
  updateRfq,
  updateRfqItems,
  deleteRfq,
  submitRfq,
  approveRfqWorkflow,
  rejectRfqWorkflow,
  getRfqPendingApprovals,
  getQuoteHistory,
  getQuoteAuditTrail,
  getSupplierQuotesGrouped,
  getSupplierQuoteById,
  requestQuoteRevision,
  submitRevisionedQuote,
  approveSupplierQuote,
  downloadQuoteComparisonXlsx,
  type QuoteAuditTrail,
  type Rfq as Quote,
  type RfqItemPayload as QuoteItemPayload,
  type RfqPendingApproval as QuotePendingApproval,
  type SupplierQuotesGrouped,
  type SupplierQuoteDetail,
  type SupplierQuoteRevision,
} from "../services/quote.service";
import type { StatusLog } from "../services/quote.service";
import { useAuth } from "../hooks/useAuth";
import { canAccessAdminSurface, canManageQuoteWorkspace, isPlatformStaffUser, isProcurementUser, normalizedBusinessRole, resolveApprovalBusinessRole, resolveApprovalRoleLabel } from "../auth/permissions";
import { QuoteStatusLabel, normalizeQuoteStatus, type QuoteStatus } from "../types/quote.types";
import { getSettings } from "../services/settings.service";
import { SupplierQuotesGroupedView } from "../components/SupplierQuotesGroupedView";
import { ReviseRequestModal } from "../components/ReviseRequestModal";
import { ReviseSubmitModal } from "../components/ReviseSubmitModal";
import "./QuoteDetailPage.css";

const EMPTY_ITEM = (): QuoteItemPayload => ({
  line_number: "", category_code: "", category_name: "",
  description: "", unit: "adet", quantity: 1, unit_price: undefined, vat_rate: 20,
});

type ItemMeta = { detail: string; imageUrl: string };

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

const normalizeCurrency = (value?: string | null): "TRY" | "USD" | "EUR" => {
  const raw = String(value || "TRY").toUpperCase();
  if (raw === "TL" || raw === "TRL") return "TRY";
  if (raw === "USDT") return "USD";
  if (raw === "USD" || raw === "EUR") return raw;
  return "TRY";
};

const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Dosya okunamadı"));
    reader.readAsDataURL(file);
  });

type QuoteItemLike = QuoteItemPayload | NonNullable<Quote["items"]>[number];

const isGroupHeaderRow = (item: QuoteItemLike): boolean => {
  const explicit = (item as { is_group_header?: boolean }).is_group_header;
  if (explicit) return true;
  const line = String(item.line_number || "").trim();
  return line.length > 0 && !line.includes(".");
};

const resolveGroupKey = (item: QuoteItemLike): string => {
  const explicitKey = (item as { group_key?: string }).group_key;
  if (explicitKey) return String(explicitKey);
  const line = String(item.line_number || "").trim();
  if (!line) return "";
  return line.includes(".") ? line.split(".")[0] : line;
};

type GroupTotals = { net: number; vat: number; gross: number };

const buildGroupTotals = (items: QuoteItemLike[]): Record<string, GroupTotals> => {
  const totals: Record<string, GroupTotals> = {};
  items.forEach((item) => {
    if (isGroupHeaderRow(item)) return;
    const key = resolveGroupKey(item);
    if (!key) return;
    const net = Number((item as { total_price?: number }).total_price ?? 0) || (Number(item.quantity || 0) * Number(item.unit_price || 0));
    const vatRate = Number(item.vat_rate ?? 20);
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

const renumberItems = (rows: QuoteItemPayload[]): QuoteItemPayload[] => {
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
    if (!childCounters[effectiveGroup]) childCounters[effectiveGroup] = 0;
    childCounters[effectiveGroup] += 1;
    return {
      ...row,
      is_group_header: false,
      group_key: effectiveGroup,
      line_number: `${effectiveGroup}.${childCounters[effectiveGroup]}`,
    };
  });
};

function quoteStatusBadgeClass(status: QuoteStatus, isReviewBack: boolean): string {
  if (isReviewBack) return "qdp-status-badge qdp-status-badge--review-back";
  return `qdp-status-badge qdp-status-badge--${status}`;
}

export default function QuoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const { user } = useAuth();
  const readOnly = isPlatformStaffUser(user);

  const [quote, setQuote] = useState<Quote | null>(null);
  const [history, setHistory] = useState<StatusLog[]>([]);
  const [auditTrail, setAuditTrail] = useState<QuoteAuditTrail | null>(null);
  const [pendingApprovals, setPendingApprovals] = useState<QuotePendingApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    title: "", description: "",
  });
  const [editItems, setEditItems] = useState<QuoteItemPayload[]>([]);
  const [vatRates, setVatRates] = useState<number[]>([1, 10, 20]);
  const [actionReason, setActionReason] = useState("");
  const [collapsedEditGroups, setCollapsedEditGroups] = useState<Record<string, boolean>>({});
  const [collapsedViewGroups, setCollapsedViewGroups] = useState<Record<string, boolean>>({});

  const [supplierQuotes, setSupplierQuotes] = useState<SupplierQuotesGrouped[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [supplierActionLoading, setSupplierActionLoading] = useState(false);
  const [selectedSupplierQuote, setSelectedSupplierQuote] = useState<SupplierQuoteRevision | null>(null);
  const [selectedSupplierQuoteDetail, setSelectedSupplierQuoteDetail] = useState<SupplierQuoteDetail | null>(null);
  const [reviseRequestModal, setReviseRequestModal] = useState<{
    visible: boolean;
    supplierQuoteId: number;
    supplierName: string;
    supplierId: number;
  }>({
    visible: false,
    supplierQuoteId: 0,
    supplierName: "",
    supplierId: 0,
  });
  const [reviseSubmitModal, setReviseSubmitModal] = useState<{ visible: boolean; supplierQuoteId: number; supplierName: string }>({
    visible: false,
    supplierQuoteId: 0,
    supplierName: "",
  });
  const detailsCardRef = useRef<HTMLDivElement | null>(null);
  const historySectionRef = useRef<HTMLDivElement | null>(null);
  const auditTrailSectionRef = useRef<HTMLDivElement | null>(null);
  const autoRevisionOpenedRef = useRef(false);
  const focusedInsight = searchParams.get("insight");
  const adminReturnTab = searchParams.get("adminTab");
  const adminReturnTenantFocusId = searchParams.get("tenantFocusId");
  const adminReturnTenantFocusName = searchParams.get("tenantFocusName");
  const adminReturnProjectFocusName = searchParams.get("projectFocusName");
  const adminReturnQuoteFocusId = searchParams.get("quoteFocusId");

  const buildAdminReturnHref = useCallback(() => {
    if (!adminReturnTab) return null;
    const params = new URLSearchParams({ tab: adminReturnTab });
    if (adminReturnTenantFocusId) params.set("tenantFocusId", adminReturnTenantFocusId);
    if (adminReturnTenantFocusName) params.set("tenantFocusName", adminReturnTenantFocusName);
    if (adminReturnProjectFocusName) params.set("projectFocusName", adminReturnProjectFocusName);
    if (adminReturnQuoteFocusId) params.set("quoteFocusId", adminReturnQuoteFocusId);
    return `/admin?${params.toString()}`;
  }, [adminReturnProjectFocusName, adminReturnQuoteFocusId, adminReturnTab, adminReturnTenantFocusId, adminReturnTenantFocusName]);

  const clearRevisionActionParams = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete("action");
    next.delete("supplierQuoteId");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const q = await getRfq(Number(id));
      setQuote(q);
      setEditData({
        title: q.title,
        description: q.description || "",
      });
      setEditItems(
        renumberItems(
          (q.items || []).map((it) => ({
            line_number: it.line_number,
            category_code: it.category_code,
            category_name: it.category_name,
            group_key: it.group_key,
            is_group_header: it.is_group_header,
            description: it.description,
            unit: it.unit,
            quantity: Number(it.quantity),
            unit_price: it.unit_price != null ? Number(it.unit_price) : undefined,
            vat_rate: it.vat_rate != null ? Number(it.vat_rate) : 20,
            notes: it.notes,
          }))
        )
      );
      const hist = await getQuoteHistory(Number(id));
      setHistory(hist);
      const audit = await getQuoteAuditTrail(Number(id));
      setAuditTrail(audit);
      const approvals = await getRfqPendingApprovals(Number(id));
      setPendingApprovals(Array.isArray(approvals) ? approvals : []);

      try {
        setLoadingSuppliers(true);
        const suppliers = await getSupplierQuotesGrouped(Number(id));
        setSupplierQuotes(suppliers);
      } catch (err) {
        console.warn("Supplier quotes yüklenemedi:", err);
        setSupplierQuotes([]);
      } finally {
        setLoadingSuppliers(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Veri yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) fetchData();
  }, [id, fetchData]);

  useEffect(() => {
    if (loading) return;
    if (focusedInsight === "status-history" && history.length > 0) {
      historySectionRef.current?.scrollIntoView?.({ block: "start" });
    }
    if (focusedInsight === "full-audit-trail" && auditTrail?.timeline.length) {
      auditTrailSectionRef.current?.scrollIntoView?.({ block: "start" });
    }
  }, [auditTrail, focusedInsight, history, loading, location.pathname]);

  useEffect(() => {
    getSettings()
      .then((s) => {
        if (Array.isArray(s.vat_rates) && s.vat_rates.length > 0) {
          setVatRates(s.vat_rates);
        }
      })
      .catch(() => setVatRates([1, 10, 20]));
  }, []);

  useEffect(() => {
    const action = searchParams.get("action");
    const supplierQuoteId = Number(searchParams.get("supplierQuoteId") || 0);
    if (action !== "revize") {
      autoRevisionOpenedRef.current = false;
      return;
    }
    if (!supplierQuoteId || supplierQuotes.length === 0 || autoRevisionOpenedRef.current) return;

    const findQuote = (quotes: SupplierQuoteRevision[]): SupplierQuoteRevision | null => {
      for (const q of quotes) {
        if (q.id === supplierQuoteId) return q;
        if (q.revisions && q.revisions.length > 0) {
          const found = findQuote(q.revisions);
          if (found) return found;
        }
      }
      return null;
    };

    for (const supplier of supplierQuotes) {
      const found = findQuote(supplier.quotes);
      if (!found) continue;
      autoRevisionOpenedRef.current = true;
      setReviseRequestModal({
        visible: true,
        supplierQuoteId: found.id,
        supplierName: supplier.supplier_name,
        supplierId: supplier.supplier_id,
      });
      break;
    }
  }, [searchParams, supplierQuotes]);

  useEffect(() => {
    const supplierQuoteId = Number(searchParams.get("supplierQuoteId") || 0);
    if (!supplierQuoteId) {
      setSelectedSupplierQuoteDetail(null);
      return;
    }

    const loadSelectedSupplierQuote = async () => {
      try {
        const detail = await getSupplierQuoteById(supplierQuoteId);
        setSelectedSupplierQuoteDetail(detail);
      } catch {
        setSelectedSupplierQuoteDetail(null);
      }
    };

    void loadSelectedSupplierQuote();
  }, [searchParams]);

  const updateEditItem = (idx: number, field: keyof QuoteItemPayload, val: string | number | undefined) => {
    setEditItems((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: val };
      return renumberItems(next);
    });
  };

  const addEditItem = () => {
    setEditItems((prev) => {
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

  const addEditGroup = () => {
    setEditItems((prev) =>
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

  const toggleEditGroup = (groupKey: string) => {
    setCollapsedEditGroups((prev) => ({ ...prev, [groupKey]: !prev[groupKey] }));
  };

  const toggleViewGroup = (groupKey: string) => {
    setCollapsedViewGroups((prev) => ({ ...prev, [groupKey]: !prev[groupKey] }));
  };

  const handleEditItemImageSelect = async (idx: number, file: File) => {
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const current = parseItemMeta(editItems[idx]?.notes);
      updateEditItem(idx, "notes", composeItemMeta(current.detail, dataUrl));
    } catch {
      setError("Görsel dosyası okunamadı");
    }
  };

  const handleUpdate = async () => {
    if (!quote || !editData.title) return;
    try {
      const updated = await updateRfq(quote.id, {
        title: editData.title,
        description: editData.description || undefined,
      });
      const validItems = editItems
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
      if (validItems.length > 0 || (quote.items || []).length > 0) {
        const withItems = await updateRfqItems(quote.id, validItems);
        setQuote(withItems);
      } else {
        setQuote(updated);
      }
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Güncelleme başarısız");
    }
  };

  const handleDelete = async () => {
    if (!quote || !window.confirm("Teklifi silmek istediğinizden emin misiniz?")) return;
    try {
      await deleteRfq(quote.id);
      navigate("/quotes");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Silme başarısız");
    }
  };

  const handleSubmit = async () => {
    if (!quote) return;
    try {
      const updated = await submitRfq(quote.id, actionReason ? { reason: actionReason } : undefined);
      setQuote(updated);
      setActionReason("");
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gönderme başarısız");
    }
  };

  const handleApprove = async () => {
    if (!quote) return;
    if (!actionReason.trim()) {
      setError("Tedarikçiye gönderme onayı için not yazmanız gerekir");
      return;
    }
    try {
      await approveRfqWorkflow(quote.id, actionReason.trim());
      setActionReason("");
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Onay başarısız");
    }
  };

  const handleReject = async () => {
    if (!quote || !window.confirm("Teklifi gözden geçirme için iade etmek istediğinize emin misiniz?")) return;
    if (!actionReason.trim()) {
      setError("Teklifi tekrar gözden geçirme notu yazmanız gerekir");
      return;
    }
    try {
      await rejectRfqWorkflow(quote.id, actionReason.trim());
      setActionReason("");
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reddetme başarısız");
    }
  };

  useEffect(() => {
    if (!quote) return;
    const status = normalizeQuoteStatus(quote.status);
    const owner = user?.id === quote.created_by_id;
    const admin = canAccessAdminSurface(user) && !readOnly;
    const editable = Boolean(user && (owner || admin || isProcurementUser(user)))
      && (status === "draft" || status === "submitted");
    const editRequested = searchParams.get("edit") === "1" || location.pathname.endsWith("/edit");
    if (editable && editRequested) {
      setIsEditing(true);
    }
  }, [quote, user, searchParams, location.pathname, readOnly]);

  if (loading) return <div className="qdp-centered">Yükleniyor...</div>;
  if (!quote) return <div className="qdp-centered">Teklif bulunamadı</div>;

  const quoteStatus = normalizeQuoteStatus(quote.status);
  const isReviewBackDraft = quoteStatus === "draft" && String(quote.transition_reason || "").toLowerCase().startsWith("hata ve eksikler var");
  const displayStatusLabel = isReviewBackDraft ? "İade Edildi (Gözden Geçirme)" : QuoteStatusLabel[quoteStatus];
  const approvalsCompleted = String(quote.transition_reason || "").toLowerCase().includes("gönderim onayları tamamlandı");
  const sentToSuppliers = Boolean(quote.sent_at);
  const isOwner = user?.id === quote.created_by_id;
  const isAdmin = canAccessAdminSurface(user) && !readOnly;
  const canEditByRole = Boolean(user && (isOwner || isAdmin || isProcurementUser(user)));
  const canEdit = canEditByRole
    && (quoteStatus === "draft" || quoteStatus === "submitted")
    && !approvalsCompleted
    && !sentToSuppliers;
  const canSubmit = canEditByRole && quoteStatus === "draft";
  const actorRole = normalizedBusinessRole(user);
  const canActPendingApproval = pendingApprovals.some((approval) =>
    approval.status === "beklemede"
    && (
      resolveApprovalBusinessRole(approval) === "*"
      || resolveApprovalBusinessRole(approval) === actorRole
      || isAdmin
    )
  );
  const canApprove = quoteStatus === "submitted" && canActPendingApproval;
  const canReject = quoteStatus === "submitted" && canActPendingApproval;
  const canManageSupplierComparison = canManageQuoteWorkspace(user);
  const rfqId = quote.rfq_id ?? quote.id;
  const viewCurrency = normalizeCurrency(selectedSupplierQuoteDetail?.currency || quote.currency || "TRY");
  const formatViewMoney = (value: number) =>
    Number(value || 0).toLocaleString("tr-TR", {
      style: "currency",
      currency: viewCurrency,
      minimumFractionDigits: 2,
    });

  const quoteItems = selectedSupplierQuoteDetail
    ? (selectedSupplierQuoteDetail.items || []).map((item) => ({
        id: Number(item.quote_item_id),
        quote_id: Number(selectedSupplierQuoteDetail.quote_id),
        line_number: String(item.line_number || ""),
        category_code: "",
        category_name: "",
        description: String(item.description || ""),
        group_key: undefined,
        is_group_header: Boolean(item.is_group_header),
        unit: String(item.unit || ""),
        quantity: Number(item.quantity || 0),
        unit_price: Number(item.supplier_unit_price || 0),
        vat_rate: Number(item.vat_rate || 20),
        total_price: Number(item.supplier_total_price || 0),
        notes: composeItemMeta(String(item.item_detail || ""), String(item.item_image_url || "")),
      }))
    : (quote.items || []);
  const quoteGroupTotals = buildGroupTotals(quoteItems);
  const editGroupTotals = buildGroupTotals(editItems);
  const netTotal = quoteItems.filter((it) => !isGroupHeaderRow(it)).reduce((s, it) => s + Number(it.total_price || 0), 0);
  const vatTotal = quoteItems.filter((it) => !isGroupHeaderRow(it)).reduce((s, it) => {
    const net = Number(it.total_price || 0);
    const rate = Number(it.vat_rate || 20);
    return s + (net * rate) / 100;
  }, 0);
  const grossTotal = netTotal + vatTotal;
  const editNetTotal = editItems
    .filter((it) => !isGroupHeaderRow(it))
    .reduce((s, it) => s + (Number(it.quantity || 0) * Number(it.unit_price || 0)), 0);
  const editVatTotal = editItems
    .filter((it) => !isGroupHeaderRow(it))
    .reduce((s, it) => {
      const net = Number(it.quantity || 0) * Number(it.unit_price || 0);
      const rate = Number(it.vat_rate ?? 20);
      return s + net * (rate / 100);
    }, 0);
  const editGrossTotal = editNetTotal + editVatTotal;
  const approvedSupplier = supplierQuotes
    .flatMap((supplier) => {
      const revisions = supplier.quotes.flatMap((q) => q.revisions || []);
      return [...supplier.quotes, ...revisions].map((q) => ({
        supplierName: supplier.supplier_name,
        quoteId: q.id,
        status: q.status,
        total: q.total_amount,
      }));
    })
    .find((q) => q.status === "onaylandı");

  const toDetailText = (value: unknown): string => {
    if (value === null || value === undefined) return "-";
    if (typeof value === "number") return value.toLocaleString("tr-TR");
    return String(value);
  };

  const renderTimelineDetails = (event: NonNullable<QuoteAuditTrail["timeline"]>[number]) => {
    const details = (event.details || {}) as Record<string, unknown>;
    const lines: string[] = [];

    switch (event.type) {
      case "APPROVAL_REQUESTED":
        lines.push(`Seviye: ${toDetailText(details.level)}`);
        lines.push(`Rol: ${toDetailText(details.role_label || details.role)}`);
        lines.push(`Durum: ${toDetailText(details.status)}`);
        break;
      case "APPROVAL_GRANTED":
        lines.push(`Seviye: ${toDetailText(details.level)}`);
        lines.push(`Rol: ${toDetailText(details.role_label || details.role)}`);
        if (details.comment) lines.push(`Not: ${toDetailText(details.comment)}`);
        break;
      case "APPROVAL_REJECTED":
        lines.push(`Seviye: ${toDetailText(details.level)}`);
        lines.push(`Rol: ${toDetailText(details.role_label || details.role)}`);
        lines.push(`Açıklama: ${toDetailText(details.comment || details.reason)}`);
        break;
      case "SUPPLIER_REQUEST_SENT":
        lines.push(`Tedarikçi: ${toDetailText(details.supplier)}`);
        lines.push(`Revize No: ${toDetailText(details.revision)}`);
        break;
      case "SUPPLIER_SUBMITTED":
        lines.push(`Tedarikçi: ${toDetailText(details.supplier)}`);
        lines.push(`Tutar: ${toDetailText(details.price)}`);
        lines.push(`Ödeme Şartı: ${toDetailText(details.terms)}`);
        break;
      case "REVISION_REQUESTED":
        lines.push(`Tedarikçi: ${toDetailText(details.supplier)}`);
        lines.push(`Revize Nedeni: ${toDetailText(details.reason)}`);
        break;
      case "APPROVAL_SUMMARY":
        lines.push(`Toplam Onay Seviyesi: ${toDetailText(details.levels)}`);
        lines.push(`Sonraki Adım: ${toDetailText(details.next)}`);
        break;
      case "CONTRACT_STAGE":
        lines.push("Teklif sözleşme sürecine alınmıştır.");
        break;
      default:
        if (details.from || details.to) {
          lines.push(`Geçiş: ${toDetailText(details.from)} -> ${toDetailText(details.to)}`);
        }
        break;
    }

    if (lines.length === 0) return null;
    return (
      <ul className="qdp-timeline-ul">
        {lines.map((line, i) => (
          <li key={`${event.type}-${i}`} className="qdp-timeline-li">{line}</li>
        ))}
      </ul>
    );
  };

  // ============================================================================
  // Revize Sistemi Handlers
  // ============================================================================

  const handleRequestRevision = async (reason: string) => {
    if (!quote) return;
    try {
      const supplierGroup = supplierQuotes.find(
        (s) => s.supplier_id === reviseRequestModal.supplierId
      );
      const targetQuoteInSupplier = supplierGroup?.quotes.find(
        (q) => q.id === reviseRequestModal.supplierQuoteId
      );
      const fallbackQuoteInSupplier =
        supplierGroup?.quotes.find((q) => q.revision_number === 0) ||
        supplierGroup?.quotes[0];

      const targetSupplierQuoteId =
        targetQuoteInSupplier?.id || fallbackQuoteInSupplier?.id;

      if (!targetSupplierQuoteId) {
        throw new Error("Revize gönderilecek tedarikçi teklifi bulunamadı");
      }

      await requestQuoteRevision(quote.id, targetSupplierQuoteId, reason);
      alert("Revize talebi gönderildi");
      setReviseRequestModal({
        visible: false,
        supplierQuoteId: 0,
        supplierName: "",
        supplierId: 0,
      });
      clearRevisionActionParams();
      autoRevisionOpenedRef.current = false;
      fetchData();
    } catch (err) {
      alert("Revize talebi gönderilemedi: " + (err instanceof Error ? err.message : "Bilinmeyen hata"));
    }
  };

  const handleSubmitRevision = async (revisedPrices: Array<{quote_item_id: number; unit_price: number; total_price: number}>) => {
    if (!quote) return;
    try {
      const result = await submitRevisionedQuote(quote.id, reviseSubmitModal.supplierQuoteId, revisedPrices);
      alert(`Revize teklif gönderildi. Tasarruf: ₺${(result.profitability.amount || 0).toLocaleString("tr-TR", {maximumFractionDigits: 2})}`);
      setReviseSubmitModal({ visible: false, supplierQuoteId: 0, supplierName: "" });
      fetchData();
    } catch (err) {
      alert("Revize teklif gönderilemedi: " + (err instanceof Error ? err.message : "Bilinmeyen hata"));
    }
  };

  const handleApproveSupplierQuote = async (supplierQuoteId: number, supplierName: string) => {
    if (!quote) return;
    if (!window.confirm(`${supplierName} teklifini onaylamak istediğinize emin misiniz?`)) return;
    try {
      setSupplierActionLoading(true);
      const result = await approveSupplierQuote(quote.id, supplierQuoteId);
      alert(`Onaylandı: ${result.supplier_name} (₺${result.approved_amount.toLocaleString("tr-TR", { maximumFractionDigits: 2 })})`);
      await fetchData();
    } catch (err) {
      alert("Tedarikçi onayı başarısız: " + (err instanceof Error ? err.message : "Bilinmeyen hata"));
    } finally {
      setSupplierActionLoading(false);
    }
  };

  const handleDownloadComparisonReport = async () => {
    if (!quote) return;
    try {
      setSupplierActionLoading(true);
      const blob = await downloadQuoteComparisonXlsx(quote.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rfq_${rfqId}_karsilastirma_raporu.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert("Excel raporu indirilemedi: " + (err instanceof Error ? err.message : "Bilinmeyen hata"));
    } finally {
      setSupplierActionLoading(false);
    }
  };

  const handleViewSupplierQuote = (supplierQuoteId: number) => {
    const findQuote = (quotes: SupplierQuoteRevision[]): SupplierQuoteRevision | null => {
      for (const q of quotes) {
        if (q.id === supplierQuoteId) return q;
        if (q.revisions && q.revisions.length > 0) {
          const found = findQuote(q.revisions);
          if (found) return found;
        }
      }
      return null;
    };

    let found: SupplierQuoteRevision | null = null;
    for (const supplier of supplierQuotes) {
      found = findQuote(supplier.quotes);
      if (found) break;
    }

    if (found) {
      setSelectedSupplierQuote(found);
      const next = new URLSearchParams(searchParams);
      next.set("supplierQuoteId", String(supplierQuoteId));
      setSearchParams(next, { replace: true });

      void (async () => {
        try {
          const detail = await getSupplierQuoteById(supplierQuoteId);
          setSelectedSupplierQuoteDetail(detail);
          detailsCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        } catch (err) {
          setError(err instanceof Error ? err.message : "Tedarikçi teklif detayı alınamadı");
        }
      })();
    }
  };

  void selectedSupplierQuote;

  return (
    <div className="qdp-page">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="qdp-back-btn"
      >
        ← Geri
      </button>

      {error && (
        <div className="qdp-error">{error}</div>
      )}

      {readOnly && (
        <div className="qdp-readonly-banner">
          Platform personeli bu teklifi inceleyebilir; düzenleme, onaya gönderme, onay, revize ve tedarikçi seçimi aksiyonları salt okunur modda kapatıldı.
        </div>
      )}

      {/* Header */}
      <div className="qdp-header-card">
        <div className="qdp-header-row">
          <div>
            <h2>{quote.title}</h2>
            <p className="qdp-subtitle">
              RFQ #{rfqId} • Teklif ID: {quote.id} • V{quote.version}
            </p>
            {buildAdminReturnHref() ? (
              <a href={buildAdminReturnHref() || "#"} className="qdp-admin-link">
                Admin odagina don
              </a>
            ) : null}
          </div>
          <span className={quoteStatusBadgeClass(quoteStatus, isReviewBackDraft)}>
            {displayStatusLabel}
          </span>
        </div>
        {isReviewBackDraft && (
          <p className="qdp-review-back-note">{quote.transition_reason}</p>
        )}
      </div>

      {/* Details */}
      <div ref={detailsCardRef} className="qdp-card">
        <h3>Teklif Detayları</h3>

        {selectedSupplierQuoteDetail && (
          <div className="qdp-supplier-banner">
            <div>
              Gösterilen detay: <strong>{selectedSupplierQuoteDetail.supplier_name || "Tedarikçi"}</strong>
              {" "}teklifi (#{selectedSupplierQuoteDetail.id}) - Durum: {selectedSupplierQuoteDetail.status}
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedSupplierQuoteDetail(null);
                const next = new URLSearchParams(searchParams);
                next.delete("supplierQuoteId");
                setSearchParams(next, { replace: true });
              }}
              className="qdp-btn-outline"
            >
              Ana Teklife Dön
            </button>
          </div>
        )}

        {isEditing ? (
          <div>
            {/* Başlık / Açıklama */}
            <div className="qdp-edit-header-grid">
              <div>
                <label className="qdp-label">Başlık *</label>
                <input className="qdp-inp" aria-label="Başlık" value={editData.title} onChange={(e) => setEditData({ ...editData, title: e.target.value })} />
              </div>
              <div>
                <label className="qdp-label">Açıklama</label>
                <input className="qdp-inp" value={editData.description} onChange={(e) => setEditData({ ...editData, description: e.target.value })} placeholder="İsteğe bağlı" />
              </div>
            </div>

            {/* Kalem Tablosu */}
            <div className="qdp-table-scroll">
              <table className="qdp-edit-table">
                <thead>
                  <tr>
                    <th>Sıra</th>
                    <th>Açıklama</th>
                    <th>Birim</th>
                    <th>Miktar</th>
                    <th>Birim Fiyat</th>
                    <th>KDV %</th>
                    <th>Toplam (KDVsiz)</th>
                    <th aria-label="İşlem"></th>
                  </tr>
                </thead>
                <tbody>
                  {editItems.map((item, idx) => {
                    const header = isGroupHeaderRow(item);
                    const key = resolveGroupKey(item);
                    const hiddenChild = !header && !!collapsedEditGroups[key];
                    if (hiddenChild) return null;
                    const rowNet = header
                      ? (editGroupTotals[key]?.net ?? 0)
                      : Number(item.quantity || 0) * Number(item.unit_price || 0);

                    return (
                      <Fragment key={idx}>
                        <tr className={header ? "qdp-edit-row qdp-edit-row--header" : "qdp-edit-row"}>
                          <td className="qdp-edit-td">
                            {header ? (
                              <div className="qdp-group-toggle-wrap">
                                <button
                                  type="button"
                                  onClick={() => toggleEditGroup(key)}
                                  className="qdp-group-toggle"
                                >
                                  {collapsedEditGroups[key] ? "▶" : "▼"}
                                </button>
                                <span className="qdp-group-badge">G</span>
                              </div>
                            ) : (
                              <span className="qdp-line-num">{item.line_number}</span>
                            )}
                          </td>
                          <td className="qdp-edit-td">
                            <input
                              className={`qdp-cell-inp${header ? " qdp-cell-inp--header" : ""}`}
                              value={item.description}
                              onChange={(e) => updateEditItem(idx, "description", e.target.value)}
                              placeholder={header ? "Grup adı" : "Kalem açıklaması"}
                            />
                            {!header && (
                              <div className="qdp-item-meta-row">
                                <label className="qdp-img-label">
                                  Görsel:
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="qdp-file-input-hidden"
                                    onChange={(e) => {
                                      const f = e.target.files?.[0];
                                      if (f) handleEditItemImageSelect(idx, f);
                                    }}
                                  />
                                  <span className="qdp-img-select-link">Seç</span>
                                </label>
                                {parseItemMeta(item.notes).imageUrl && (
                                  <img src={parseItemMeta(item.notes).imageUrl} alt="" className="qdp-thumb" />
                                )}
                                <input
                                  className="qdp-cell-inp qdp-cell-inp--flex1"
                                  value={parseItemMeta(item.notes).detail}
                                  onChange={(e) => updateEditItem(idx, "notes", composeItemMeta(e.target.value, parseItemMeta(item.notes).imageUrl))}
                                  placeholder="Detay notu (opsiyonel)"
                                />
                              </div>
                            )}
                          </td>
                          <td className="qdp-edit-td">
                            {!header && (
                              <input
                                className="qdp-cell-inp"
                                value={item.unit}
                                onChange={(e) => updateEditItem(idx, "unit", e.target.value)}
                                placeholder="adet"
                              />
                            )}
                          </td>
                          <td className="qdp-edit-td">
                            {!header && (
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                aria-label="Miktar"
                                className="qdp-cell-inp qdp-cell-inp--right"
                                value={item.quantity ?? ""}
                                onChange={(e) => updateEditItem(idx, "quantity", parseFloat(e.target.value) || 0)}
                              />
                            )}
                          </td>
                          <td className="qdp-edit-td">
                            {!header && (
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                className="qdp-cell-inp qdp-cell-inp--right"
                                value={item.unit_price ?? ""}
                                onChange={(e) => updateEditItem(idx, "unit_price", parseFloat(e.target.value) || undefined)}
                                placeholder="0.00"
                              />
                            )}
                          </td>
                          <td className="qdp-edit-td">
                            {!header && (
                              <select
                                className="qdp-cell-inp qdp-cell-inp--right"
                                aria-label="KDV Oranı"
                                value={item.vat_rate ?? 20}
                                onChange={(e) => updateEditItem(idx, "vat_rate", Number(e.target.value))}
                              >
                                {[...vatRates].sort((a, b) => a - b).map((r) => (
                                  <option key={r} value={r}>{r}%</option>
                                ))}
                              </select>
                            )}
                          </td>
                          <td className={header ? "qdp-edit-td qdp-edit-td--amount-header" : "qdp-edit-td qdp-edit-td--amount"}>
                            {header
                              ? `₺${rowNet.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}`
                              : rowNet > 0
                                ? `₺${rowNet.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}`
                                : ""}
                          </td>
                          <td className="qdp-edit-td qdp-edit-td--center">
                            <button
                              type="button"
                              onClick={() => setEditItems((prev) => renumberItems(prev.filter((_, i) => i !== idx)))}
                              className="qdp-del-btn"
                              title="Satırı sil"
                            >
                              ×
                            </button>
                          </td>
                        </tr>
                      </Fragment>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={6} className="qdp-tfoot-label">Toplam (KDVsiz):</td>
                    <td className="qdp-tfoot-value">₺{editNetTotal.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}</td>
                    <td></td>
                  </tr>
                  <tr>
                    <td colSpan={6} className="qdp-tfoot-label">KDV:</td>
                    <td className="qdp-tfoot-value">₺{(editNetTotal + editVatTotal - editNetTotal).toLocaleString("tr-TR", { minimumFractionDigits: 2 })}</td>
                    <td></td>
                  </tr>
                  <tr>
                    <td colSpan={6} className="qdp-tfoot-label qdp-tfoot-label--green">Genel Toplam (KDV Dahil):</td>
                    <td className="qdp-tfoot-value qdp-tfoot-value--green">₺{editGrossTotal.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Yeni satır / grup ekleme */}
            <div className="qdp-edit-actions-row">
              <button
                type="button"
                onClick={addEditItem}
                className="qdp-btn-add-item"
              >
                + Kalem Ekle
              </button>
              <button
                type="button"
                onClick={addEditGroup}
                className="qdp-btn-add-group"
              >
                + Grup Ekle
              </button>
            </div>

            {/* Kaydet / Vazgeç */}
            <div className="qdp-edit-save-row">
              <button
                type="button"
                onClick={handleUpdate}
                className="qdp-btn-save"
              >
                Kaydet
              </button>
              <button
                type="button"
                onClick={() => { setIsEditing(false); void fetchData(); }}
                className="qdp-btn-cancel"
              >
                Vazgeç
              </button>
            </div>
          </div>
        ) : (
          <div className="qdp-table-scroll">
            <table className="qdp-view-table">
              <thead>
                <tr>
                  <th>Sıra</th>
                  <th>Açıklama</th>
                  <th>Birim</th>
                  <th>Miktar</th>
                  <th>Birim Fiyat</th>
                  <th>Birim Toplam Fiyat</th>
                  <th>KDV</th>
                  <th>KDV Tutar</th>
                  <th>KDV Dahil Toplam</th>
                </tr>
              </thead>
              <tbody>
                {(quote.items || []).map((item, idx) => {
                  const header = isGroupHeaderRow(item);
                  const key = resolveGroupKey(item);
                  const meta = parseItemMeta(item.notes);
                  const hiddenChild = !header && !!collapsedViewGroups[key];
                  if (hiddenChild) {
                    return null;
                  }
                  const group = quoteGroupTotals[key] || { net: 0, vat: 0, gross: 0 };
                  const net = header ? group.net : Number(item.total_price || 0);
                  const vatRate = Number(item.vat_rate || 20);
                  const vat = header ? group.vat : net * (vatRate / 100);
                  const gross = header ? group.gross : net + vat;

                  return (
                    <Fragment key={item.id}>
                      <tr className={header ? "qdp-view-row qdp-view-row--header" : "qdp-view-row"}>
                        <td className="qdp-view-td">{item.line_number || idx + 1}</td>
                        <td className="qdp-view-td">
                          <div className="qdp-desc-flex">
                            {header && (
                              <button
                                type="button"
                                onClick={() => toggleViewGroup(key)}
                                className="qdp-group-toggle"
                                title={collapsedViewGroups[key] ? "Alt kalemleri aç" : "Alt kalemleri kapat"}
                              >
                                {collapsedViewGroups[key] ? "▶" : "▼"}
                              </button>
                            )}
                            {header && (
                              <span className="qdp-group-badge-lg">Grup</span>
                            )}
                            <div className="qdp-desc-text">{item.description}</div>
                          </div>
                        </td>
                        <td className="qdp-view-td qdp-view-td--center">{header ? "" : item.unit}</td>
                        <td className="qdp-view-td qdp-view-td--right">{header ? "" : item.quantity}</td>
                        <td className="qdp-view-td qdp-view-td--right">
                          {header ? (
                            <span className="qdp-group-total-label">Grup Toplamı</span>
                          ) : (
                            <span>{net > 0 ? formatViewMoney(Number(item.unit_price || 0)) : ""}</span>
                          )}
                        </td>
                        <td className="qdp-view-td qdp-view-td--right qdp-view-td--bold">
                          <span>{formatViewMoney(net)}</span>
                        </td>
                        <td className="qdp-view-td qdp-view-td--right">{header ? "" : `%${vatRate}`}</td>
                        <td className="qdp-view-td qdp-view-td--right">{formatViewMoney(vat)}</td>
                        <td className="qdp-view-td qdp-view-td--right">{formatViewMoney(gross)}</td>
                      </tr>
                      {!header ? (
                        <tr className="qdp-detail-sub-row">
                          <td className="qdp-detail-spacer-td"></td>
                          <td colSpan={8} className="qdp-detail-content-td">
                            <div className={`qdp-item-detail-grid${meta.imageUrl ? " qdp-item-detail-grid--with-img" : ""}`}>
                              {meta.imageUrl && (
                                <div>
                                  <a href={meta.imageUrl} target="_blank" rel="noopener noreferrer" title="Görseli yeni sekmede aç">
                                    <img
                                      src={meta.imageUrl}
                                      alt="Kalem görseli"
                                      className="qdp-detail-img"
                                    />
                                  </a>
                                </div>
                              )}
                              <div className="qdp-detail-text">
                                {meta.detail || (meta.imageUrl ? "-" : "")}
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={8} className="qdp-view-tfoot-label">Teklif Toplamı:</td>
                  <td className="qdp-view-tfoot-value">{formatViewMoney(netTotal)}</td>
                </tr>
                <tr>
                  <td colSpan={8} className="qdp-view-tfoot-label">KDV Toplamı:</td>
                  <td className="qdp-view-tfoot-value">{formatViewMoney(vatTotal)}</td>
                </tr>
                <tr>
                  <td colSpan={8} className="qdp-view-tfoot-label">Genel Toplam (KDV Dahil):</td>
                  <td className="qdp-view-tfoot-value qdp-view-tfoot-value--green">{formatViewMoney(grossTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Actions */}
      {(canEdit || canSubmit || canApprove || canReject) && (
        <div className="qdp-card">
          <h3>İşlemler</h3>

          {canEdit && (
            <button
              type="button"
              onClick={() => {
                setIsEditing(true);
                detailsCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="qdp-action-btn"
            >
              Düzenle
            </button>
          )}

          {canSubmit && (
            <div className="qdp-action-section">
              <textarea
                placeholder="Onaya gönderme notu (opsiyonel)"
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                className="qdp-textarea"
              />
              <button
                type="button"
                onClick={handleSubmit}
                className="qdp-btn-submit"
              >
                Onaya Gönder
              </button>
            </div>
          )}

          {canApprove && (
            <div className="qdp-action-section">
              <textarea
                placeholder="Onay veya tekrar gözden geçirme notu (zorunlu)"
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                className="qdp-textarea"
              />
              <button
                type="button"
                onClick={handleApprove}
                className="qdp-btn-approve"
              >
                Tedarikçiye Gönder Onayı Ver
              </button>
              {canReject && (
                <button
                  type="button"
                  onClick={handleReject}
                  className="qdp-btn-reject"
                >
                  Teklifi Tekrar Gözden Geçirin
                </button>
              )}
              <div className="qdp-action-hint">
                Hata ve eksikler var ise açıklama yazarak teklifi düzenleme döngüsüne geri alın.
              </div>
            </div>
          )}

          {canEdit && (
            <button
              type="button"
              onClick={handleDelete}
              className="qdp-btn-delete"
            >
              Sil
            </button>
          )}
        </div>
      )}

      {/* Supplier Quotes / Responses */}
      {supplierQuotes.length > 0 && (
        <div className="qdp-card">
          <div className="qdp-section-header-row">
            <h3>Tedarikçi Teklifleri</h3>
            {canManageSupplierComparison && (
              <div className="qdp-compare-btns">
                <button
                  type="button"
                  onClick={() => navigate(`/quotes/${quote.id}/comparison`)}
                  disabled={supplierActionLoading}
                  className={`qdp-btn-compare${supplierActionLoading ? " qdp-btn--loading" : ""}`}
                >
                  Karşılaştırma Sayfası
                </button>
                <button
                  type="button"
                  onClick={handleDownloadComparisonReport}
                  disabled={supplierActionLoading}
                  className={`qdp-btn-excel${supplierActionLoading ? " qdp-btn--loading" : ""}`}
                >
                  Karşılaştırma Excel Raporu
                </button>
              </div>
            )}
          </div>

          {approvedSupplier && (
            <div className="qdp-approved-banner">
              Onaylanan Tedarikçi: {approvedSupplier.supplierName} (Teklif #{approvedSupplier.quoteId} - ₺{approvedSupplier.total.toLocaleString("tr-TR", { maximumFractionDigits: 2 })})
            </div>
          )}

          <SupplierQuotesGroupedView
            suppliers={supplierQuotes}
            onRequestRevision={async (sqId, sqName, supplierId) => {
              clearRevisionActionParams();
              autoRevisionOpenedRef.current = true;
              setReviseRequestModal({
                visible: true,
                supplierQuoteId: sqId,
                supplierName: sqName,
                supplierId,
              });
            }}
            onViewDetails={handleViewSupplierQuote}
            onApproveSupplierQuote={handleApproveSupplierQuote}
            loading={loadingSuppliers || supplierActionLoading}
            canManage={canManageSupplierComparison}
          />
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div ref={historySectionRef} className={`qdp-card${focusedInsight === "status-history" ? " qdp-card--focused" : ""}`}>
          <h3>Durum Geçişi Geçmişi</h3>
          {focusedInsight === "status-history" ? <div className="qdp-focus-hint">Deep-link odagi: Durum Gecisi Gecmisi</div> : null}
          <div className="qdp-history-content">
            {history.map((log, idx) => (
              <div
                key={idx}
                className={`qdp-history-log${idx < history.length - 1 ? " qdp-history-log--bordered" : ""}`}
              >
                <strong>{log.from_status}</strong> → <strong>{log.to_status}</strong>
                <br />
                <small className="qdp-history-date">
                  {log.changed_by_name ? `${log.changed_by_name} • ` : ""}
                  {new Date(log.created_at || log.changed_at || "").toLocaleString("tr-TR")}
                </small>
                {Array.isArray(log.approval_details) && log.approval_details.length > 0 && (
                  <div className="qdp-approval-grid">
                    {log.approval_details.map((approval) => (
                      <div
                        key={`${log.id}-${approval.level}`}
                        className="qdp-approval-detail"
                      >
                        <div className="qdp-approval-title">
                          Seviye {approval.level}: {resolveApprovalRoleLabel(approval)}
                        </div>
                        <div className="qdp-approval-info">Durum: {approval.status}</div>
                        {approval.requested_at && (
                          <div className="qdp-approval-info">
                            Talep: {new Date(approval.requested_at).toLocaleString("tr-TR")}
                          </div>
                        )}
                        {approval.completed_at && (
                          <div className="qdp-approval-info">
                            Tamamlandı: {new Date(approval.completed_at).toLocaleString("tr-TR")}
                          </div>
                        )}
                        {approval.approved_by_name && (
                          <div className="qdp-approval-info">
                            İşlem Yapan: {approval.approved_by_name}
                          </div>
                        )}
                        {approval.comment && (
                          <div className="qdp-approval-info">Not: {approval.comment}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {auditTrail && auditTrail.timeline.length > 0 && (
        <div ref={auditTrailSectionRef} className={`qdp-card qdp-card--mt${focusedInsight === "full-audit-trail" ? " qdp-card--focused" : ""}`}>
          <h3>Tam İşlem Zaman Çizgisi</h3>
          {focusedInsight === "full-audit-trail" ? <div className="qdp-focus-hint">Deep-link odagi: Tam Audit Trail</div> : null}
          <div className="qdp-audit-grid">
            {auditTrail.timeline.map((event, idx) => (
              <div
                key={`${event.type}-${event.timestamp || idx}-${idx}`}
                className="qdp-audit-event"
              >
                <div className="qdp-audit-event-header">
                  <strong>{event.icon ? `${event.icon} ${event.title}` : event.title}</strong>
                  <small className="qdp-audit-date">
                    {event.timestamp ? new Date(event.timestamp).toLocaleString("tr-TR") : "-"}
                  </small>
                </div>
                {event.actor && (
                  <div className="qdp-audit-actor">
                    İşlem Yapan: {String(event.actor)}
                  </div>
                )}
                {renderTimelineDetails(event)}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Revise Request Modal */}
      <ReviseRequestModal
        visible={reviseRequestModal.visible}
        supplierQuoteName={reviseRequestModal.supplierName}
        onClose={() => {
          setReviseRequestModal({
            visible: false,
            supplierQuoteId: 0,
            supplierName: "",
            supplierId: 0,
          });
          clearRevisionActionParams();
          autoRevisionOpenedRef.current = false;
        }}
        onSubmit={handleRequestRevision}
        loading={loadingSuppliers}
      />

      {/* Revise Submit Modal */}
      <ReviseSubmitModal
        visible={reviseSubmitModal.visible}
        supplierQuoteName={reviseSubmitModal.supplierName}
        items={
          selectedSupplierQuote?.items?.map((item: NonNullable<SupplierQuoteRevision["items"]>[number]) => {
            const origItem = quote?.items?.find((qi) => qi.id.toString() === item.quote_item_id.toString());
            return {
              quote_item_id: item.quote_item_id,
              original_unit_price: item.original_unit_price || origItem?.unit_price || 0,
              original_total_price: item.original_total_price || origItem?.total_price || 0,
              item_description: origItem?.description || "Bilinmeyen kalem",
            };
          }) || []
        }
        onClose={() => setReviseSubmitModal({ visible: false, supplierQuoteId: 0, supplierName: "" })}
        onSubmit={handleSubmitRevision}
        loading={loadingSuppliers}
      />
    </div>
  );
}
