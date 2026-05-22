import { useState } from "react";
import { approveLedgerEntry, bulkApproveLedger, type AdminLedgerItem } from "../../services/profile.service";
import "./CommissionApprovalPanel.css";

interface CommissionApprovalPanelProps {
  items: AdminLedgerItem[];
  loading: boolean;
  onRefresh: () => void;
}

const STATUS_LABELS: Record<string, { label: string; color: string; className: string }> = {
  pending: {
    label: "Bekliyor",
    color: "#f59e0b",
    className: "commission-approval-panel__status-pill--pending",
  },
  approved: {
    label: "Onaylandi",
    color: "#22c55e",
    className: "commission-approval-panel__status-pill--approved",
  },
  paid: {
    label: "Odendi",
    color: "#3b82f6",
    className: "commission-approval-panel__status-pill--paid",
  },
  cancelled: {
    label: "Iptal",
    color: "#ef4444",
    className: "commission-approval-panel__status-pill--cancelled",
  },
};

type ActionStatus = "approved" | "paid" | "cancelled";

export function CommissionApprovalPanel({ items, loading, onRefresh }: CommissionApprovalPanelProps) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("pending");

  const filtered = items.filter((item) => !statusFilter || item.status === statusFilter);

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((item) => item.id)));
    }
  }

  async function handleSingle(id: number, newStatus: ActionStatus) {
    setBusy(true);
    try {
      await approveLedgerEntry(id, newStatus);
      onRefresh();
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleBulk(newStatus: ActionStatus) {
    if (selected.size === 0) return;
    setBusy(true);
    try {
      await bulkApproveLedger(Array.from(selected), newStatus);
      onRefresh();
      setSelected(new Set());
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="commission-approval-panel">
      <div className="commission-approval-panel__header">
        <span className="commission-approval-panel__title">Komisyon Onay Akisi</span>

        <div className="commission-approval-panel__toolbar">
          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setSelected(new Set());
            }}
            className="commission-approval-panel__select"
            aria-label="Durum filtresi"
            title="Durum filtresi"
          >
            <option value="">Tum durumlar</option>
            <option value="pending">Bekliyor</option>
            <option value="approved">Onaylandi</option>
            <option value="paid">Odendi</option>
            <option value="cancelled">Iptal</option>
          </select>

          <button
            type="button"
            onClick={onRefresh}
            disabled={busy || loading}
            className="commission-approval-panel__button"
          >
            Yenile
          </button>
        </div>
      </div>

      {selected.size > 0 ? (
        <div className="commission-approval-panel__bulk-bar">
          <span className="commission-approval-panel__bulk-count">{selected.size} kayit secildi</span>
          <ActionButton
            label="Toplu Onayla"
            color="#22c55e"
            onClick={() => handleBulk("approved")}
            disabled={busy}
          />
          <ActionButton
            label="Toplu Odendi"
            color="#3b82f6"
            onClick={() => handleBulk("paid")}
            disabled={busy}
          />
          <ActionButton
            label="Toplu Iptal"
            color="#ef4444"
            onClick={() => handleBulk("cancelled")}
            disabled={busy}
          />
        </div>
      ) : null}

      {loading ? (
        <div className="commission-approval-panel__empty-state">Yukleniyor...</div>
      ) : filtered.length === 0 ? (
        <div className="commission-approval-panel__empty-state">Kayit bulunamadi.</div>
      ) : (
        <div className="commission-approval-panel__table-wrap">
          <table className="commission-approval-panel__table">
            <thead>
              <tr>
                <th className="commission-approval-panel__th commission-approval-panel__th--checkbox">
                  <input
                    type="checkbox"
                    checked={selected.size === filtered.length && filtered.length > 0}
                    onChange={toggleAll}
                    aria-label="Tum kayitlari sec"
                    title="Tum kayitlari sec"
                  />
                </th>
                <th className="commission-approval-panel__th">ID</th>
                <th className="commission-approval-panel__th">Kanal Org</th>
                <th className="commission-approval-panel__th">Olay Tipi</th>
                <th className="commission-approval-panel__th commission-approval-panel__th--right">Tutar</th>
                <th className="commission-approval-panel__th commission-approval-panel__th--center">Durum</th>
                <th className="commission-approval-panel__th">Tarih</th>
                <th className="commission-approval-panel__th commission-approval-panel__th--center">Islemler</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const statusInfo = STATUS_LABELS[item.status] ?? {
                  label: item.status,
                  color: "#64748b",
                  className: "commission-approval-panel__status-pill--default",
                };
                const rowClassName = [
                  "commission-approval-panel__row",
                  selected.has(item.id) ? "commission-approval-panel__row--selected" : "",
                ]
                  .filter(Boolean)
                  .join(" ");
                const actionStatusClassName = [
                  "commission-approval-panel__status-pill",
                  statusInfo.className,
                ].join(" ");

                return (
                  <tr key={item.id} className={rowClassName}>
                    <td className="commission-approval-panel__cell commission-approval-panel__cell--center">
                      <input
                        type="checkbox"
                        checked={selected.has(item.id)}
                        onChange={() => toggleSelect(item.id)}
                        aria-label={`Kayit #${item.id} sec`}
                        title={`Kayit #${item.id} sec`}
                      />
                    </td>
                    <td className="commission-approval-panel__cell commission-approval-panel__cell--muted">
                      #{item.id}
                    </td>
                    <td className="commission-approval-panel__cell">
                      {item.org_name ?? `Org #${item.channel_org_id}`}
                    </td>
                    <td className="commission-approval-panel__cell">{item.event_type}</td>
                    <td className="commission-approval-panel__cell commission-approval-panel__cell--right commission-approval-panel__amount">
                      {item.amount.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} {item.currency}
                    </td>
                    <td className="commission-approval-panel__cell commission-approval-panel__cell--center">
                      <span className={actionStatusClassName}>{statusInfo.label}</span>
                    </td>
                    <td className="commission-approval-panel__cell commission-approval-panel__cell--muted">
                      {item.created_at.slice(0, 10)}
                    </td>
                    <td className="commission-approval-panel__cell commission-approval-panel__cell--center">
                      <div className="commission-approval-panel__actions">
                        {item.status === "pending" ? (
                          <>
                            <ActionButton
                              label="Onayla"
                              color="#22c55e"
                              onClick={() => handleSingle(item.id, "approved")}
                              disabled={busy}
                              small
                            />
                            <ActionButton
                              label="Iptal"
                              color="#ef4444"
                              onClick={() => handleSingle(item.id, "cancelled")}
                              disabled={busy}
                              small
                            />
                          </>
                        ) : null}

                        {item.status === "approved" ? (
                          <ActionButton
                            label="Odendi"
                            color="#3b82f6"
                            onClick={() => handleSingle(item.id, "paid")}
                            disabled={busy}
                            small
                          />
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ActionButton({
  label,
  color,
  onClick,
  disabled,
  small,
}: {
  label: string;
  color: string;
  onClick: () => void;
  disabled?: boolean;
  small?: boolean;
}) {
  const statusClassName = [
    "commission-approval-panel__action-button",
    small
      ? "commission-approval-panel__action-button--small"
      : "commission-approval-panel__action-button--default",
    color === "#22c55e"
      ? "commission-approval-panel__action-button--green"
      : color === "#3b82f6"
        ? "commission-approval-panel__action-button--blue"
        : "commission-approval-panel__action-button--red",
  ].join(" ");

  return (
    <button type="button" onClick={onClick} disabled={disabled} className={statusClassName}>
      {label}
    </button>
  );
}
