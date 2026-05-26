import { useCallback, useEffect, useState } from "react";
import {
  extractPayoutError,
  fetchAdminPayoutRequests,
  getPayoutErrorCode,
  updatePayoutStatus,
  type PayoutRequest,
  type PaginatedPayoutRequestsOut,
} from "../services/payout.service";
import "./PayoutAdminPage.css";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_LABELS: Record<string, string> = {
  pending: "Bekliyor",
  approved: "Onaylandı",
  processing: "İşlemde",
  paid: "Ödendi",
  rejected: "Reddedildi",
};

const STATUS_CLASS: Record<string, string> = {
  pending: "payout-status--pending",
  approved: "payout-status--approved",
  processing: "payout-status--processing",
  paid: "payout-status--paid",
  rejected: "payout-status--rejected",
};

const STATUS_FILTER_OPTIONS = [
  { value: "", label: "Tümü" },
  { value: "pending", label: "Bekliyor" },
  { value: "approved", label: "Onaylandı" },
  { value: "processing", label: "İşlemde" },
  { value: "paid", label: "Ödendi" },
  { value: "rejected", label: "Reddedildi" },
];

function friendlyError(err: unknown): string {
  const code = getPayoutErrorCode(err);
  if (code === "INVALID_PAYOUT_TRANSITION")
    return "Bu durum geçişi geçersiz. Lütfen sayfayı yenileyip tekrar deneyin.";
  if (code === "PAYOUT_NOT_FOUND") return "Ödeme talebi bulunamadı.";
  if (code === "PAYOUT_REVIEW_FORBIDDEN") return "Bu işlem için yetkiniz bulunmuyor.";
  return extractPayoutError(err);
}

function fmt(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// Transition-driven action config
// pending    -> approve | reject
// approved   -> processing
// processing -> paid
// paid       -> (none)
// rejected   -> (none)
// ---------------------------------------------------------------------------

interface ActionButton {
  label: string;
  targetStatus: string;
  className: string;
  needsReason?: boolean;
}

function getActions(status: string): ActionButton[] {
  switch (status) {
    case "pending":
      return [
        { label: "Onayla", targetStatus: "approved", className: "payout-btn--approve" },
        { label: "Reddet", targetStatus: "rejected", className: "payout-btn--reject", needsReason: true },
      ];
    case "approved":
      return [
        { label: "İşleme Al", targetStatus: "processing", className: "payout-btn--processing" },
      ];
    case "processing":
      return [
        { label: "Ödendi", targetStatus: "paid", className: "payout-btn--paid" },
      ];
    default:
      return [];
  }
}

// ---------------------------------------------------------------------------
// RejectInlineForm — shown inline when "Reddet" is clicked
// ---------------------------------------------------------------------------

interface RejectFormProps {
  payoutId: number;
  onConfirm: (id: number, reason: string) => void;
  onCancel: () => void;
  busy: boolean;
}

function RejectInlineForm({ payoutId, onConfirm, onCancel, busy }: RejectFormProps) {
  const [reason, setReason] = useState("");
  return (
    <div className="payout-reject-form">
      <input
        className="payout-reject-form__input"
        placeholder="Red gerekçesi (isteğe bağlı)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        disabled={busy}
      />
      <button
        className="payout-reject-form__submit"
        onClick={() => onConfirm(payoutId, reason)}
        disabled={busy}
      >
        Reddet
      </button>
      <button className="payout-reject-form__cancel" onClick={onCancel} disabled={busy}>
        Vazgeç
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PayoutRow
// ---------------------------------------------------------------------------

interface PayoutRowProps {
  payout: PayoutRequest;
  actionBusy: number | null;
  rejectTarget: number | null;
  onAction: (id: number, targetStatus: string, rejectionReason?: string) => void;
  onStartReject: (id: number) => void;
  onCancelReject: () => void;
}

function PayoutRow({
  payout,
  actionBusy,
  rejectTarget,
  onAction,
  onStartReject,
  onCancelReject,
}: PayoutRowProps) {
  const actions = getActions(payout.status);
  const busy = actionBusy === payout.id;

  return (
    <tr>
      <td>#{payout.id}</td>
      <td>
        <strong>
          {parseFloat(payout.amount).toLocaleString("tr-TR", { minimumFractionDigits: 2 })}{" "}
          {payout.currency}
        </strong>
      </td>
      <td>{payout.payment_method}</td>
      <td>
        <span className={`payout-status ${STATUS_CLASS[payout.status] ?? ""}`}>
          {STATUS_LABELS[payout.status] ?? payout.status}
        </span>
      </td>
      <td>{fmt(payout.created_at)}</td>
      <td>{payout.paid_at ? fmt(payout.paid_at) : "—"}</td>
      <td>
        {actions.length > 0 ? (
          <div>
            <div className="payout-actions">
              {actions.map((act) =>
                act.needsReason ? (
                  <button
                    key={act.targetStatus}
                    className={`payout-btn ${act.className}`}
                    disabled={busy || rejectTarget === payout.id}
                    onClick={() => onStartReject(payout.id)}
                  >
                    {act.label}
                  </button>
                ) : (
                  <button
                    key={act.targetStatus}
                    className={`payout-btn ${act.className}`}
                    disabled={busy}
                    onClick={() => onAction(payout.id, act.targetStatus)}
                  >
                    {busy ? "…" : act.label}
                  </button>
                ),
              )}
            </div>
            {rejectTarget === payout.id && (
              <RejectInlineForm
                payoutId={payout.id}
                busy={busy}
                onConfirm={(id, reason) => onAction(id, "rejected", reason)}
                onCancel={onCancelReject}
              />
            )}
          </div>
        ) : (
          <span style={{ color: "#94a3b8", fontSize: 12 }}>—</span>
        )}
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// PayoutAdminPage
// ---------------------------------------------------------------------------

export default function PayoutAdminPage() {
  const [data, setData] = useState<PaginatedPayoutRequestsOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [actionBusy, setActionBusy] = useState<number | null>(null);
  const [rejectTarget, setRejectTarget] = useState<number | null>(null);

  const PAGE_SIZE = 20;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetchAdminPayoutRequests(page, PAGE_SIZE, statusFilter || undefined);
      setData(res);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAction = useCallback(
    async (id: number, targetStatus: string, rejectionReason?: string) => {
      setActionError("");
      setActionBusy(id);
      try {
        await updatePayoutStatus(id, {
          status: targetStatus,
          rejection_reason: rejectionReason || null,
        });
        setRejectTarget(null);
        await load();
      } catch (err) {
        setActionError(friendlyError(err));
      } finally {
        setActionBusy(null);
      }
    },
    [load],
  );

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 1;

  return (
    <div className="payout-admin">
      <h1 className="payout-admin__title">Ödeme Talepleri</h1>

      <div className="payout-admin__filters">
        <span className="payout-admin__filter-label">Durum:</span>
        <select
          className="payout-admin__filter-select"
          value={statusFilter}
          onChange={(e) => {
            setPage(1);
            setStatusFilter(e.target.value);
          }}
        >
          {STATUS_FILTER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {error && <div className="payout-admin__error">{error}</div>}
      {actionError && <div className="payout-admin__error">{actionError}</div>}

      {loading ? (
        <div className="payout-admin__loading">Yükleniyor…</div>
      ) : !data || data.items.length === 0 ? (
        <div className="payout-admin__empty">Ödeme talebi bulunamadı.</div>
      ) : (
        <>
          <table className="payout-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Tutar</th>
                <th>Yöntem</th>
                <th>Durum</th>
                <th>Oluşturuldu</th>
                <th>Ödeme Tarihi</th>
                <th>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((p) => (
                <PayoutRow
                  key={p.id}
                  payout={p}
                  actionBusy={actionBusy}
                  rejectTarget={rejectTarget}
                  onAction={handleAction}
                  onStartReject={(id) => setRejectTarget(id)}
                  onCancelReject={() => setRejectTarget(null)}
                />
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="payout-pagination">
              <button
                className="payout-pagination__btn"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                ← Önceki
              </button>
              <span>
                {page} / {totalPages} (toplam {data.total})
              </span>
              <button
                className="payout-pagination__btn"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Sonraki →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
