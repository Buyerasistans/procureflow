// web/src/pages/SupplierPortalPage.tsx
import { useState, useEffect } from "react";
import { SupplierResponsePortal } from "../components/SupplierResponsePortal";
import { getSupplierAccessToken } from "../lib/session";
import "./SupplierPortalPage.css";

interface SupplierPortalPageProps {
  apiUrl?: string;
  authToken?: string;
  supplierUserId?: number;
}

export function SupplierPortalPage({
  apiUrl = "",
  authToken = getSupplierAccessToken() || "",
  supplierUserId = 1,
}: SupplierPortalPageProps) {
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    submitted: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadStats() {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${apiUrl}/api/v1/supplier-quotes/me`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (!response.ok) {
        throw new Error("İstatistikler yüklenemedi");
      }

      const quotes = await response.json();

      const pending = (quotes as Array<{status: string}>).filter((q) => q.status !== "yanıtlandı").length;
      const submitted = (quotes as Array<{status: string}>).filter((q) => q.status === "yanıtlandı").length;

      setStats({
        total: quotes.length,
        pending,
        submitted,
      });
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="spp-container">
      <div className="spp-card">
        <div className="spp-header">
          <h1>📬 Tedarikçi Portal</h1>
          <p>Gönderilen tekliflere yanıt verin ve fiyat teklifi sunun</p>
        </div>

        <div className="spp-content">
          {error && <div className="spp-error">❌ {error}</div>}

          {loading ? (
            <div className="spp-loading">
              <div className="spp-loading__icon">⏳</div>
              <div>Veriler yükleniyor...</div>
            </div>
          ) : (
            <>
              <div className="spp-stats">
                <div className="spp-stat-card">
                  <div className="spp-stat-card__number">{stats.total}</div>
                  <div className="spp-stat-card__label">Toplam Teklif</div>
                </div>
                <div className="spp-stat-card">
                  <div className="spp-stat-card__number">{stats.pending}</div>
                  <div className="spp-stat-card__label">Yanıt Bekleyen</div>
                </div>
                <div className="spp-stat-card">
                  <div className="spp-stat-card__number">{stats.submitted}</div>
                  <div className="spp-stat-card__label">Yanıt Verilen</div>
                </div>
              </div>

              <SupplierResponsePortal
                apiUrl={apiUrl}
                authToken={authToken}
                supplierUserId={supplierUserId}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
