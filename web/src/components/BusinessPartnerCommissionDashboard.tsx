import { useCallback, useEffect, useState } from "react";

import { http } from "../lib/http";
import "./BusinessPartnerCommissionDashboard.css";

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

export function BusinessPartnerCommissionDashboard() {
  const [ledger, setLedger] = useState<CommissionLedgerEntry[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>(
    new Date().toISOString().slice(0, 7),
  );
  const [selectedReport, setSelectedReport] = useState<CommissionReport | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"ledger" | "monthly-report">(
    "ledger",
  );

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const ledgerResponse = await http.get(
        "/api/v1/onboarding/business-partner/commissions",
      );
      setLedger(ledgerResponse.data || []);

      const reportsResponse = await http.get(
        `/api/v1/onboarding/business-partner/commission-report/${selectedMonth}`,
      );
      const reportData = reportsResponse.data as CommissionReport | null;
      setSelectedReport(reportData || null);
    } catch (err) {
      console.error("Commission data yüklenemedi:", err);
      setError("Komisyon verileri yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleMonthChange = (month: string) => {
    setSelectedMonth(month);
  };

  if (loading) {
    return (
      <div className="business-partner-commission-dashboard__loading">
        Yükleniyor...
      </div>
    );
  }

  if (error) {
    return (
      <div className="business-partner-commission-dashboard__error">{error}</div>
    );
  }

  const totalEarned = ledger.reduce(
    (sum, entry) => sum + entry.commission_earned,
    0,
  );
  const pendingEarnings = ledger
    .filter((entry) => entry.status === "pending")
    .reduce((sum, entry) => sum + entry.commission_earned, 0);
  const paidEarnings = ledger
    .filter((entry) => entry.status === "paid")
    .reduce((sum, entry) => sum + entry.commission_earned, 0);

  return (
    <div className="business-partner-commission-dashboard">
      <div>
        <h1 className="business-partner-commission-dashboard__header-title">
          💰 Business Partner Komisyon Payi
        </h1>
        <p className="business-partner-commission-dashboard__header-description">
          Tedarikci davetleri ve islem komisyonlarini izleyin.
        </p>
      </div>

      <div className="business-partner-commission-dashboard__summary-grid">
        <div className="business-partner-commission-dashboard__summary-card business-partner-commission-dashboard__summary-card--blue">
          <p className="business-partner-commission-dashboard__summary-label business-partner-commission-dashboard__summary-label--blue">
            Toplam Kazanç
          </p>
          <p className="business-partner-commission-dashboard__summary-value business-partner-commission-dashboard__summary-value--blue">
            ${totalEarned.toFixed(2)}
          </p>
        </div>

        <div className="business-partner-commission-dashboard__summary-card business-partner-commission-dashboard__summary-card--amber">
          <p className="business-partner-commission-dashboard__summary-label business-partner-commission-dashboard__summary-label--amber">
            Beklemede
          </p>
          <p className="business-partner-commission-dashboard__summary-value business-partner-commission-dashboard__summary-value--amber">
            ${pendingEarnings.toFixed(2)}
          </p>
        </div>

        <div className="business-partner-commission-dashboard__summary-card business-partner-commission-dashboard__summary-card--green">
          <p className="business-partner-commission-dashboard__summary-label business-partner-commission-dashboard__summary-label--green">
            Ödenen
          </p>
          <p className="business-partner-commission-dashboard__summary-value business-partner-commission-dashboard__summary-value--green">
            ${paidEarnings.toFixed(2)}
          </p>
        </div>
      </div>

      <div className="business-partner-commission-dashboard__tabs">
        <button
          type="button"
          onClick={() => setActiveTab("ledger")}
          className={`business-partner-commission-dashboard__tab ${
            activeTab === "ledger"
              ? "business-partner-commission-dashboard__tab--active"
              : "business-partner-commission-dashboard__tab--inactive"
          }`}
        >
          📋 Komisyon Ledgeri
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("monthly-report")}
          className={`business-partner-commission-dashboard__tab ${
            activeTab === "monthly-report"
              ? "business-partner-commission-dashboard__tab--active"
              : "business-partner-commission-dashboard__tab--inactive"
          }`}
        >
          📊 Aylik Rapor
        </button>
      </div>

      {activeTab === "ledger" && (
        <div>
          <h2 className="business-partner-commission-dashboard__section-title">
            Komisyon Ledgeri
          </h2>
          {ledger.length > 0 ? (
            <div className="business-partner-commission-dashboard__table-wrap">
              <table className="business-partner-commission-dashboard__table">
                <thead className="business-partner-commission-dashboard__thead">
                  <tr>
                    <th className="business-partner-commission-dashboard__th">
                      Davet Tarihi
                    </th>
                    <th className="business-partner-commission-dashboard__th">
                      Tedarikçi Adı
                    </th>
                    <th className="business-partner-commission-dashboard__th business-partner-commission-dashboard__th--right">
                      Oranı
                    </th>
                    <th className="business-partner-commission-dashboard__th business-partner-commission-dashboard__th--right">
                      İşlem Tutarı
                    </th>
                    <th className="business-partner-commission-dashboard__th business-partner-commission-dashboard__th--right">
                      Kazanç
                    </th>
                    <th className="business-partner-commission-dashboard__th business-partner-commission-dashboard__th--center">
                      Durum
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((entry) => (
                    <tr
                      key={entry.id}
                      className="business-partner-commission-dashboard__row"
                    >
                      <td className="business-partner-commission-dashboard__td business-partner-commission-dashboard__date">
                        {entry.referral_date}
                      </td>
                      <td className="business-partner-commission-dashboard__td business-partner-commission-dashboard__supplier">
                        {entry.supplier_name}
                      </td>
                      <td className="business-partner-commission-dashboard__td business-partner-commission-dashboard__td--right business-partner-commission-dashboard__rate">
                        {entry.commission_rate}%
                      </td>
                      <td className="business-partner-commission-dashboard__td business-partner-commission-dashboard__td--right business-partner-commission-dashboard__amount">
                        ${entry.transaction_amount.toFixed(2)}
                      </td>
                      <td className="business-partner-commission-dashboard__td business-partner-commission-dashboard__td--right business-partner-commission-dashboard__earned">
                        ${entry.commission_earned.toFixed(2)}
                      </td>
                      <td className="business-partner-commission-dashboard__td business-partner-commission-dashboard__td--center">
                        <span
                          className={`business-partner-commission-dashboard__status ${
                            entry.status === "paid"
                              ? "business-partner-commission-dashboard__status--paid"
                              : entry.status === "pending"
                                ? "business-partner-commission-dashboard__status--pending"
                                : "business-partner-commission-dashboard__status--processing"
                          }`}
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
            <div className="business-partner-commission-dashboard__empty">
              Henüz komisyon kaydı yok.
            </div>
          )}
        </div>
      )}

      {activeTab === "monthly-report" && (
        <div>
          <div className="business-partner-commission-dashboard__month-filter">
            <label
              htmlFor="business-partner-commission-dashboard-month"
              className="business-partner-commission-dashboard__month-label"
            >
              Ay Seçin:
            </label>
            <input
              id="business-partner-commission-dashboard-month"
              type="text"
              value={selectedMonth}
              onChange={(e) => handleMonthChange(e.target.value)}
              aria-label="Komisyon raporu ay seçimi"
              title="Komisyon raporu ay seçimi"
              placeholder="YYYY-AA"
              inputMode="numeric"
              pattern="[0-9]{4}-[0-9]{2}"
              className="business-partner-commission-dashboard__month-input"
            />
          </div>

          {selectedReport ? (
            <div className="business-partner-commission-dashboard__report">
              <div className="business-partner-commission-dashboard__report-grid">
                <div className="business-partner-commission-dashboard__report-card">
                  <p className="business-partner-commission-dashboard__report-label">
                    Toplam Davet
                  </p>
                  <p className="business-partner-commission-dashboard__report-value">
                    {selectedReport.total_referrals}
                  </p>
                </div>

                <div className="business-partner-commission-dashboard__report-card">
                  <p className="business-partner-commission-dashboard__report-label">
                    İşlem Tutarı
                  </p>
                  <p className="business-partner-commission-dashboard__report-value">
                    ${selectedReport.total_transaction_amount.toFixed(2)}
                  </p>
                </div>

                <div className="business-partner-commission-dashboard__report-card business-partner-commission-dashboard__report-card--green">
                  <p className="business-partner-commission-dashboard__report-label business-partner-commission-dashboard__report-label--green">
                    Toplam Kazanç
                  </p>
                  <p className="business-partner-commission-dashboard__report-value business-partner-commission-dashboard__report-value--green">
                    ${selectedReport.total_earned.toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="business-partner-commission-dashboard__report-breakdown">
                <h3 className="business-partner-commission-dashboard__report-breakdown-title">
                  Komisyon Hesaplaması
                </h3>
                <div className="business-partner-commission-dashboard__report-breakdown-list">
                  <div className="business-partner-commission-dashboard__report-breakdown-row">
                    <span className="business-partner-commission-dashboard__report-breakdown-label">
                      Taban Komisyon:
                    </span>
                    <span className="business-partner-commission-dashboard__report-breakdown-value">
                      ${selectedReport.base_commission.toFixed(2)}
                    </span>
                  </div>
                  {selectedReport.campaign_bonus ? (
                    <div className="business-partner-commission-dashboard__report-breakdown-row">
                      <span className="business-partner-commission-dashboard__report-breakdown-label">
                        Kampanya Bonusu (+{selectedReport.bonus_rate}%):
                      </span>
                      <span className="business-partner-commission-dashboard__report-breakdown-value business-partner-commission-dashboard__report-breakdown-value--green">
                        ${selectedReport.campaign_bonus.toFixed(2)}
                      </span>
                    </div>
                  ) : null}
                  <div className="business-partner-commission-dashboard__report-breakdown-row business-partner-commission-dashboard__report-breakdown-row--total">
                    <span className="business-partner-commission-dashboard__report-breakdown-label business-partner-commission-dashboard__report-breakdown-label--total">
                      Toplam Kazanç:
                    </span>
                    <span className="business-partner-commission-dashboard__report-breakdown-value business-partner-commission-dashboard__report-breakdown-value--total">
                      ${selectedReport.total_earned.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="business-partner-commission-dashboard__empty">
              Bu ay için rapor mevcut değil.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
