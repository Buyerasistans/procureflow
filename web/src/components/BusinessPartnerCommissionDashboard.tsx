import { useState, useEffect } from "react";
import { http } from "../lib/http";

interface CommissionLedgerEntry {
  id: number;
  referral_date: string;
  supplier_name: string;
  commission_rate: number;
  transaction_amount: number;
  commission_earned: number;
  status: "pending" | "paid" | "processing";
}

interface CommissionReport {
  month: string;
  total_referrals: number;
  total_transactions: number;
  total_transaction_amount: number;
  base_commission: number;
  campaign_bonus?: number;
  total_earned: number;
  bonus_rate?: number;
}

interface BusinessPartnerDashboardProps {
  businessPartnerId?: number;
}

export function BusinessPartnerCommissionDashboard({
  businessPartnerId,
}: BusinessPartnerDashboardProps) {
  const [ledger, setLedger] = useState<CommissionLedgerEntry[]>([]);
  const [reports, setReports] = useState<CommissionReport[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>(
    new Date().toISOString().slice(0, 7)
  );
  const [selectedReport, setSelectedReport] = useState<CommissionReport | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"ledger" | "monthly-report">(
    "ledger"
  );

  useEffect(() => {
    loadData();
  }, [businessPartnerId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load commission ledger
      const ledgerResponse = await http.get(
        "/api/v1/onboarding/business-partner/commissions"
      );
      setLedger(ledgerResponse.data || []);

      // Load monthly reports
      const reportsResponse = await http.get(
        `/api/v1/onboarding/business-partner/commission-report/${selectedMonth}`
      );
      const reportData = reportsResponse.data;
      setReports(reportData ? [reportData] : []);
      setSelectedReport(reportData || null);
    } catch (err) {
      console.error("Commission data yüklenemedi:", err);
      setError("Komisyon verileri yüklenemedi");
    } finally {
      setLoading(false);
    }
  };

  const handleMonthChange = (month: string) => {
    setSelectedMonth(month);
  };

  if (loading) {
    return (
      <div
        style={{
          padding: "16px",
          borderRadius: "8px",
          backgroundColor: "#f3f4f6",
          color: "#6b7280",
          textAlign: "center",
        }}
      >
        Yükleniyor...
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          padding: "16px",
          borderRadius: "8px",
          backgroundColor: "#fee2e2",
          color: "#991b1b",
          fontSize: "14px",
        }}
      >
        {error}
      </div>
    );
  }

  // Calculate summary stats
  const totalEarned = ledger.reduce((sum, entry) => sum + entry.commission_earned, 0);
  const pendingEarnings = ledger
    .filter((entry) => entry.status === "pending")
    .reduce((sum, entry) => sum + entry.commission_earned, 0);
  const paidEarnings = ledger
    .filter((entry) => entry.status === "paid")
    .reduce((sum, entry) => sum + entry.commission_earned, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Header */}
      <div>
        <h1
          style={{
            margin: "0 0 8px 0",
            color: "#1f2937",
            fontSize: "24px",
            fontWeight: "700",
          }}
        >
          💰 Business Partner Komisyon Payi
        </h1>
        <p
          style={{
            margin: 0,
            color: "#6b7280",
            fontSize: "14px",
          }}
        >
          Tedarikci davetleri ve islem komisyonlarini izleyin.
        </p>
      </div>

      {/* Summary Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "16px",
        }}
      >
        <div
          style={{
            padding: "16px",
            backgroundColor: "#dbeafe",
            borderRadius: "8px",
            border: "1px solid #7dd3fc",
          }}
        >
          <p
            style={{
              margin: "0 0 8px 0",
              color: "#0c4a6e",
              fontSize: "12px",
              fontWeight: "600",
              textTransform: "uppercase",
            }}
          >
            Toplam Kazanç
          </p>
          <p
            style={{
              margin: 0,
              color: "#075985",
              fontSize: "22px",
              fontWeight: "700",
            }}
          >
            ${totalEarned.toFixed(2)}
          </p>
        </div>

        <div
          style={{
            padding: "16px",
            backgroundColor: "#fef3c7",
            borderRadius: "8px",
            border: "1px solid #fde68a",
          }}
        >
          <p
            style={{
              margin: "0 0 8px 0",
              color: "#92400e",
              fontSize: "12px",
              fontWeight: "600",
              textTransform: "uppercase",
            }}
          >
            Beklemede
          </p>
          <p
            style={{
              margin: 0,
              color: "#b45309",
              fontSize: "22px",
              fontWeight: "700",
            }}
          >
            ${pendingEarnings.toFixed(2)}
          </p>
        </div>

        <div
          style={{
            padding: "16px",
            backgroundColor: "#f0fdf4",
            borderRadius: "8px",
            border: "1px solid #bbf7d0",
          }}
        >
          <p
            style={{
              margin: "0 0 8px 0",
              color: "#15803d",
              fontSize: "12px",
              fontWeight: "600",
              textTransform: "uppercase",
            }}
          >
            Ödenen
          </p>
          <p
            style={{
              margin: 0,
              color: "#16a34a",
              fontSize: "22px",
              fontWeight: "700",
            }}
          >
            ${paidEarnings.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{ display: "flex", gap: "0", borderBottom: "1px solid #e5e7eb" }}>
        <button
          onClick={() => setActiveTab("ledger")}
          style={{
            flex: 1,
            padding: "12px 16px",
            backgroundColor: activeTab === "ledger" ? "#ffffff" : "#f3f4f6",
            color: activeTab === "ledger" ? "#4f46e5" : "#6b7280",
            border: "none",
            borderBottom:
              activeTab === "ledger"
                ? "3px solid #4f46e5"
                : "3px solid transparent",
            fontWeight: activeTab === "ledger" ? "600" : "500",
            fontSize: "14px",
            cursor: "pointer",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            if (activeTab !== "ledger") {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                "#e5e7eb";
            }
          }}
          onMouseLeave={(e) => {
            if (activeTab !== "ledger") {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                "#f3f4f6";
            }
          }}
        >
          📋 Komisyon Ledgeri
        </button>
        <button
          onClick={() => setActiveTab("monthly-report")}
          style={{
            flex: 1,
            padding: "12px 16px",
            backgroundColor:
              activeTab === "monthly-report" ? "#ffffff" : "#f3f4f6",
            color:
              activeTab === "monthly-report" ? "#4f46e5" : "#6b7280",
            border: "none",
            borderBottom:
              activeTab === "monthly-report"
                ? "3px solid #4f46e5"
                : "3px solid transparent",
            fontWeight: activeTab === "monthly-report" ? "600" : "500",
            fontSize: "14px",
            cursor: "pointer",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            if (activeTab !== "monthly-report") {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                "#e5e7eb";
            }
          }}
          onMouseLeave={(e) => {
            if (activeTab !== "monthly-report") {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                "#f3f4f6";
            }
          }}
        >
          📊 Aylik Rapor
        </button>
      </div>

      {/* Ledger Tab */}
      {activeTab === "ledger" && (
        <div>
          <h2
            style={{
              margin: "0 0 12px 0",
              color: "#1f2937",
              fontSize: "16px",
              fontWeight: "600",
            }}
          >
            Komisyon Ledgeri
          </h2>
          {ledger.length > 0 ? (
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "13px",
                }}
              >
                <thead>
                  <tr
                    style={{
                      backgroundColor: "#f3f4f6",
                      borderBottom: "1px solid #e5e7eb",
                    }}
                  >
                    <th
                      style={{
                        padding: "12px",
                        textAlign: "left",
                        fontWeight: "600",
                        color: "#374151",
                      }}
                    >
                      Davet Tarihi
                    </th>
                    <th
                      style={{
                        padding: "12px",
                        textAlign: "left",
                        fontWeight: "600",
                        color: "#374151",
                      }}
                    >
                      Tedarikçi Adı
                    </th>
                    <th
                      style={{
                        padding: "12px",
                        textAlign: "right",
                        fontWeight: "600",
                        color: "#374151",
                      }}
                    >
                      Oranı
                    </th>
                    <th
                      style={{
                        padding: "12px",
                        textAlign: "right",
                        fontWeight: "600",
                        color: "#374151",
                      }}
                    >
                      İşlem Tutarı
                    </th>
                    <th
                      style={{
                        padding: "12px",
                        textAlign: "right",
                        fontWeight: "600",
                        color: "#374151",
                      }}
                    >
                      Kazanç
                    </th>
                    <th
                      style={{
                        padding: "12px",
                        textAlign: "center",
                        fontWeight: "600",
                        color: "#374151",
                      }}
                    >
                      Durum
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((entry) => (
                    <tr
                      key={entry.id}
                      style={{
                        borderBottom: "1px solid #e5e7eb",
                        backgroundColor: "#ffffff",
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.backgroundColor =
                          "#f9fafb";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.backgroundColor =
                          "#ffffff";
                      }}
                    >
                      <td
                        style={{
                          padding: "12px",
                          color: "#6b7280",
                        }}
                      >
                        {entry.referral_date}
                      </td>
                      <td
                        style={{
                          padding: "12px",
                          color: "#1f2937",
                          fontWeight: "500",
                        }}
                      >
                        {entry.supplier_name}
                      </td>
                      <td
                        style={{
                          padding: "12px",
                          textAlign: "right",
                          color: "#1f2937",
                          fontWeight: "600",
                        }}
                      >
                        {entry.commission_rate}%
                      </td>
                      <td
                        style={{
                          padding: "12px",
                          textAlign: "right",
                          color: "#1f2937",
                        }}
                      >
                        ${entry.transaction_amount.toFixed(2)}
                      </td>
                      <td
                        style={{
                          padding: "12px",
                          textAlign: "right",
                          color: "#16a34a",
                          fontWeight: "600",
                        }}
                      >
                        ${entry.commission_earned.toFixed(2)}
                      </td>
                      <td
                        style={{
                          padding: "12px",
                          textAlign: "center",
                        }}
                      >
                        <span
                          style={{
                            display: "inline-block",
                            padding: "4px 8px",
                            backgroundColor:
                              entry.status === "paid"
                                ? "#ecfdf5"
                                : entry.status === "pending"
                                  ? "#fef3c7"
                                  : "#f0f9ff",
                            color:
                              entry.status === "paid"
                                ? "#15803d"
                                : entry.status === "pending"
                                  ? "#92400e"
                                  : "#075985",
                            borderRadius: "4px",
                            fontSize: "12px",
                            fontWeight: "600",
                          }}
                        >
                          {entry.status === "paid"
                            ? "✓ Ödendi"
                            : entry.status === "pending"
                              ? "⏳ Beklemede"
                              : "🔄 İşlemde"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div
              style={{
                padding: "32px",
                textAlign: "center",
                backgroundColor: "#f3f4f6",
                borderRadius: "8px",
                color: "#6b7280",
              }}
            >
              Henüz komisyon kaydı yok.
            </div>
          )}
        </div>
      )}

      {/* Monthly Report Tab */}
      {activeTab === "monthly-report" && (
        <div>
          <div
            style={{
              display: "flex",
              gap: "12px",
              alignItems: "center",
              marginBottom: "16px",
            }}
          >
            <label
              style={{
                color: "#374151",
                fontWeight: "500",
                fontSize: "14px",
              }}
            >
              Ay Seçin:
            </label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => handleMonthChange(e.target.value)}
              style={{
                padding: "8px 12px",
                border: "1px solid #d1d5db",
                borderRadius: "6px",
                fontSize: "14px",
              }}
            />
          </div>

          {selectedReport ? (
            <div
              style={{
                padding: "16px",
                backgroundColor: "#f9fafb",
                borderRadius: "8px",
                border: "1px solid #e5e7eb",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: "16px",
                  marginBottom: "16px",
                }}
              >
                <div
                  style={{
                    padding: "12px",
                    backgroundColor: "#ffffff",
                    borderRadius: "6px",
                    border: "1px solid #e5e7eb",
                  }}
                >
                  <p
                    style={{
                      margin: "0 0 4px 0",
                      color: "#6b7280",
                      fontSize: "12px",
                      textTransform: "uppercase",
                      fontWeight: "600",
                    }}
                  >
                    Toplam Davet
                  </p>
                  <p
                    style={{
                      margin: 0,
                      color: "#1f2937",
                      fontSize: "20px",
                      fontWeight: "700",
                    }}
                  >
                    {selectedReport.total_referrals}
                  </p>
                </div>

                <div
                  style={{
                    padding: "12px",
                    backgroundColor: "#ffffff",
                    borderRadius: "6px",
                    border: "1px solid #e5e7eb",
                  }}
                >
                  <p
                    style={{
                      margin: "0 0 4px 0",
                      color: "#6b7280",
                      fontSize: "12px",
                      textTransform: "uppercase",
                      fontWeight: "600",
                    }}
                  >
                    İşlem Tutarı
                  </p>
                  <p
                    style={{
                      margin: 0,
                      color: "#1f2937",
                      fontSize: "20px",
                      fontWeight: "700",
                    }}
                  >
                    ${selectedReport.total_transaction_amount.toFixed(2)}
                  </p>
                </div>

                <div
                  style={{
                    padding: "12px",
                    backgroundColor: "#f0fdf4",
                    borderRadius: "6px",
                    border: "1px solid #bbf7d0",
                  }}
                >
                  <p
                    style={{
                      margin: "0 0 4px 0",
                      color: "#15803d",
                      fontSize: "12px",
                      textTransform: "uppercase",
                      fontWeight: "600",
                    }}
                  >
                    Toplam Kazanç
                  </p>
                  <p
                    style={{
                      margin: 0,
                      color: "#16a34a",
                      fontSize: "20px",
                      fontWeight: "700",
                    }}
                  >
                    ${selectedReport.total_earned.toFixed(2)}
                  </p>
                </div>
              </div>

              <div
                style={{
                  paddingTop: "16px",
                  borderTop: "1px solid #e5e7eb",
                }}
              >
                <h3
                  style={{
                    margin: "0 0 12px 0",
                    color: "#1f2937",
                    fontSize: "14px",
                    fontWeight: "600",
                    textTransform: "uppercase",
                  }}
                >
                  Komisyon Hesaplaması
                </h3>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    fontSize: "13px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <span style={{ color: "#6b7280" }}>Taban Komisyon:</span>
                    <span style={{ color: "#1f2937", fontWeight: "500" }}>
                      ${selectedReport.base_commission.toFixed(2)}
                    </span>
                  </div>
                  {selectedReport.campaign_bonus && (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <span style={{ color: "#6b7280" }}>Kampanya Bonusu (+{selectedReport.bonus_rate}%):</span>
                      <span
                        style={{
                          color: "#16a34a",
                          fontWeight: "600",
                        }}
                      >
                        ${selectedReport.campaign_bonus.toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      paddingTop: "8px",
                      borderTop: "1px solid #e5e7eb",
                      fontWeight: "600",
                    }}
                  >
                    <span style={{ color: "#1f2937" }}>Toplam Kazanç:</span>
                    <span style={{ color: "#16a34a" }}>
                      ${selectedReport.total_earned.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div
              style={{
                padding: "32px",
                textAlign: "center",
                backgroundColor: "#f3f4f6",
                borderRadius: "8px",
                color: "#6b7280",
              }}
            >
              Bu ay için rapor mevcut değil.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
