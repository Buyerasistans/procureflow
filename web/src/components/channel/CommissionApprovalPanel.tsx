import React, { useState } from "react";
import type { AdminLedgerItem } from "../../services/profile.service";
import { approveLedgerEntry, bulkApproveLedger } from "../../services/profile.service";

interface CommissionApprovalPanelProps {
  items: AdminLedgerItem[];
  loading: boolean;
  onRefresh: () => void;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending:   { label: "Bekliyor",   color: "#f59e0b" },
  approved:  { label: "Onaylandi",  color: "#22c55e" },
  paid:      { label: "Odendi",     color: "#3b82f6" },
  cancelled: { label: "Iptal",      color: "#ef4444" },
};

export function CommissionApprovalPanel({
  items,
  loading,
  onRefresh,
}: CommissionApprovalPanelProps) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("pending");

  const filtered = items.filter(
    (it) => !statusFilter || it.status === statusFilter
  );

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
      setSelected(new Set(filtered.map((i) => i.id)));
    }
  }

  async function handleSingle(id: number, newStatus: "approved" | "paid" | "cancelled") {
    setBusy(true);
    try {
      await approveLedgerEntry(id, newStatus);
      onRefresh();
      setSelected((prev) => { const next = new Set(prev); next.delete(id); return next; });
    } finally {
      setBusy(false);
    }
  }

  async function handleBulk(newStatus: "approved" | "paid" | "cancelled") {
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
    <div
      style={{
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        padding: 20,
        marginBottom: 14,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 14,
        }}
      >
        <span style={{ fontWeight: 700, fontSize: 15, color: "#1e293b" }}>
          Komisyon Onay Akisi
        </span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setSelected(new Set()); }}
            style={{
              fontSize: 12,
              padding: "4px 8px",
              borderRadius: 6,
              border: "1px solid #e2e8f0",
            }}
          >
            <option value="">Tum durumlar</option>
            <option value="pending">Bekliyor</option>
            <option value="approved">Onaylandi</option>
            <option value="paid">Odendi</option>
            <option value="cancelled">Iptal</option>
          </select>
          <button
            onClick={onRefresh}
            disabled={busy || loading}
            style={{
              fontSize: 12,
              padding: "4px 10px",
              borderRadius: 6,
              border: "1px solid #e2e8f0",
              background: "#f8fafc",
              cursor: "pointer",
            }}
          >
            Yenile
          </button>
        </div>
      </div>

      {/* Toplu islem bar */}
      {selected.size > 0 && (
        <div
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 12,
            padding: "8px 12px",
            background: "#eff6ff",
            borderRadius: 8,
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: 12, color: "#1e40af", flex: 1 }}>
            {selected.size} kayit secildi
          </span>
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
      )}

      {loading ? (
        <div style={{ color: "#94a3b8", fontSize: 13 }}>Yukleniyor...</div>
      ) : filtered.length === 0 ? (
        <div style={{ color: "#94a3b8", fontSize: 13 }}>Kayit bulunamadi.</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                <th style={{ padding: "8px 6px", textAlign: "left", width: 32 }}>
                  <input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={toggleAll} />
                </th>
                <th style={{ padding: "8px 6px", textAlign: "left" }}>ID</th>
                <th style={{ padding: "8px 6px", textAlign: "left" }}>Kanal Org</th>
                <th style={{ padding: "8px 6px", textAlign: "left" }}>Olay Tipi</th>
                <th style={{ padding: "8px 6px", textAlign: "right" }}>Tutar</th>
                <th style={{ padding: "8px 6px", textAlign: "center" }}>Durum</th>
                <th style={{ padding: "8px 6px", textAlign: "left" }}>Tarih</th>
                <th style={{ padding: "8px 6px", textAlign: "center" }}>Islemler</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const st = STATUS_LABELS[item.status] ?? { label: item.status, color: "#64748b" };
                return (
                  <tr
                    key={item.id}
                    style={{
                      borderBottom: "1px solid #f1f5f9",
                      background: selected.has(item.id) ? "#eff6ff" : undefined,
                    }}
                  >
                    <td style={{ padding: "7px 6px" }}>
                      <input
                        type="checkbox"
                        checked={selected.has(item.id)}
                        onChange={() => toggleSelect(item.id)}
                      />
                    </td>
                    <td style={{ padding: "7px 6px", color: "#64748b" }}>#{item.id}</td>
                    <td style={{ padding: "7px 6px" }}>{item.org_name ?? `Org #${item.channel_org_id}`}</td>
                    <td style={{ padding: "7px 6px" }}>{item.event_type}</td>
                    <td style={{ padding: "7px 6px", textAlign: "right", fontWeight: 600 }}>
                      {item.amount.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} {item.currency}
                    </td>
                    <td style={{ padding: "7px 6px", textAlign: "center" }}>
                      <span
                        style={{
                          fontSize: 11,
                          padding: "2px 8px",
                          borderRadius: 10,
                          background: st.color + "22",
                          color: st.color,
                          fontWeight: 600,
                        }}
                      >
                        {st.label}
                      </span>
                    </td>
                    <td style={{ padding: "7px 6px", color: "#64748b", fontSize: 11 }}>
                      {item.created_at.slice(0, 10)}
                    </td>
                    <td style={{ padding: "7px 6px", textAlign: "center" }}>
                      <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                        {item.status === "pending" && (
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
                        )}
                        {item.status === "approved" && (
                          <ActionButton
                            label="Odendi"
                            color="#3b82f6"
                            onClick={() => handleSingle(item.id, "paid")}
                            disabled={busy}
                            small
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
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
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        fontSize: small ? 11 : 12,
        padding: small ? "2px 8px" : "4px 12px",
        borderRadius: 6,
        border: `1px solid ${color}`,
        background: disabled ? "#f1f5f9" : color + "18",
        color: disabled ? "#94a3b8" : color,
        cursor: disabled ? "not-allowed" : "pointer",
        fontWeight: 600,
        transition: "background 0.15s",
      }}
    >
      {label}
    </button>
  );
}
