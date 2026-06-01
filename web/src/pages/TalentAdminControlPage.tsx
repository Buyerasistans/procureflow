import { useCallback, useEffect, useId, useState } from "react";
import {
  extractTalentAdminError,
  fetchAdminTalentProfiles,
  fetchPayoutSummary,
  updateTalentKycStatus,
  type AdminTalentProfile,
  type PaginatedAdminTalentProfiles,
  type PayoutSummary,
} from "../services/talent-admin.service";
import { PageHeader } from "./admin/AdminTabContent";
import "./TalentAdminControlPage.css";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const KYC_LABELS: Record<string, string> = {
  pending: "Bekliyor",
  approved: "Onaylı",
  rejected: "Reddedildi",
};

const KYC_CLASS: Record<string, string> = {
  pending: "kyc-badge--pending",
  approved: "kyc-badge--approved",
  rejected: "kyc-badge--rejected",
};

const KYC_FILTER_OPTIONS = [
  { value: "", label: "Tüm KYC" },
  { value: "pending", label: "Bekliyor" },
  { value: "approved", label: "Onaylı" },
  { value: "rejected", label: "Reddedildi" },
];

const PAYOUT_STATUS_META = [
  { key: "pending" as const, label: "Bekliyor", cls: "payout-box--pending" },
  { key: "approved" as const, label: "Onaylandı", cls: "payout-box--approved" },
  { key: "processing" as const, label: "İşlemde", cls: "payout-box--processing" },
  { key: "paid" as const, label: "Ödendi", cls: "payout-box--paid" },
  { key: "rejected" as const, label: "Reddedildi", cls: "payout-box--rejected" },
];

function friendlyKycError(err: unknown): string {
  return extractTalentAdminError(err);
}

// ---------------------------------------------------------------------------
// PayoutOverviewSection
// ---------------------------------------------------------------------------

function PayoutOverviewSection() {
  const [summary, setSummary] = useState<PayoutSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchPayoutSummary()
      .then(setSummary)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="talent-admin__loading" role="status" aria-live="polite">
        Yükleniyor…
      </div>
    );
  }
  if (!summary) return null;

  return (
    <div className="payout-overview" aria-label="Ödeme talepleri özeti">
      {PAYOUT_STATUS_META.map(({ key, label, cls }) => (
        <div key={key} className={`payout-box ${cls}`}>
          <div className="payout-box__count">{summary[key]}</div>
          <div className="payout-box__label">{label}</div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TalentProfileRow
// ---------------------------------------------------------------------------

interface TalentProfileRowProps {
  profile: AdminTalentProfile;
  busy: boolean;
  onKyc: (id: number, status: "approved" | "rejected") => void;
}

function TalentProfileRow({ profile, busy, onKyc }: TalentProfileRowProps) {
  const currentKyc = profile.kyc_status;
  return (
    <tr>
      <td>#{profile.id}</td>
      <td>user#{profile.user_id}</td>
      <td>
        <span className={`kyc-badge ${KYC_CLASS[currentKyc] ?? ""}`}>
          {KYC_LABELS[currentKyc] ?? currentKyc}
        </span>
      </td>
      <td>{profile.reputation_score}</td>
      <td>{profile.is_active ? "Aktif" : "Pasif"}</td>
      <td>
        <div className="kyc-actions">
          <button
            className="kyc-btn kyc-btn--approve"
            disabled={busy || currentKyc === "approved"}
            onClick={() => onKyc(profile.id, "approved")}
            aria-label={`Talent profili #${profile.id} KYC onayla`}
            title="KYC Onayla"
          >
            Onayla
          </button>
          <button
            className="kyc-btn kyc-btn--reject"
            disabled={busy || currentKyc === "rejected"}
            onClick={() => onKyc(profile.id, "rejected")}
            aria-label={`Talent profili #${profile.id} KYC reddet`}
            title="KYC Reddet"
          >
            Reddet
          </button>
        </div>
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// TalentProfilesSection
// ---------------------------------------------------------------------------

function TalentProfilesSection() {
  const [data, setData] = useState<PaginatedAdminTalentProfiles | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [kycFilter, setKycFilter] = useState("");
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<number | null>(null);
  const kycFilterId = useId();
  const PAGE_SIZE = 20;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetchAdminTalentProfiles(page, PAGE_SIZE, kycFilter || undefined);
      setData(res);
    } catch (err) {
      setError(friendlyKycError(err));
    } finally {
      setLoading(false);
    }
  }, [page, kycFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const handleKyc = useCallback(
    async (profileId: number, kycStatus: "approved" | "rejected") => {
      setBusyId(profileId);
      setError("");
      try {
        await updateTalentKycStatus(profileId, { kyc_status: kycStatus });
        await load();
      } catch (err) {
        setError(friendlyKycError(err));
      } finally {
        setBusyId(null);
      }
    },
    [load],
  );

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 1;

  return (
    <>
      <div className="talent-admin__filters">
        <label className="talent-admin__filter-label" htmlFor={kycFilterId}>
          KYC Durumu:
        </label>
        <select
          id={kycFilterId}
          className="talent-admin__filter-select"
          value={kycFilter}
          onChange={(e) => {
            setPage(1);
            setKycFilter(e.target.value);
          }}
        >
          {KYC_FILTER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="talent-admin__error" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <div className="talent-admin__loading" role="status" aria-live="polite">
          Yükleniyor…
        </div>
      ) : !data || data.items.length === 0 ? (
        <div className="talent-admin__empty">Talent profili bulunamadı.</div>
      ) : (
        <>
          <table className="talent-table">
            <caption className="talent-admin__sr-only">Talent profilleri listesi</caption>
            <thead>
              <tr>
                <th scope="col">Profil ID</th>
                <th scope="col">Kullanıcı</th>
                <th scope="col">KYC</th>
                <th scope="col">İtibar</th>
                <th scope="col">Durum</th>
                <th scope="col">KYC İşlem</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((p) => (
                <TalentProfileRow
                  key={p.id}
                  profile={p}
                  busy={busyId === p.id}
                  onKyc={handleKyc}
                />
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="talent-admin__pagination">
              <button
                className="talent-admin__pagination-btn"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                aria-label="Önceki talent profilleri sayfası"
              >
                ← Önceki
              </button>
              <span>
                {page} / {totalPages} (toplam {data.total})
              </span>
              <button
                className="talent-admin__pagination-btn"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                aria-label="Sonraki talent profilleri sayfası"
              >
                Sonraki →
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// TalentAdminControlPage
// ---------------------------------------------------------------------------

export default function TalentAdminControlPage() {
  return (
    <div className="talent-admin">
      <PageHeader
        eyebrow="Kariyer & Yetenek"
        title="Kariyer ve İş Piyasası"
        sub="Talent profilleri, ödeme talepleri ve işveren hesaplarını merkezi olarak yönetin"
      />

      <section className="talent-admin__section" aria-labelledby="talent-profiles-title">
        <h2 id="talent-profiles-title" className="talent-admin__section-title">
          Talent Profilleri
        </h2>
        <TalentProfilesSection />
      </section>

      <section className="talent-admin__section" aria-labelledby="payout-summary-title">
        <h2 id="payout-summary-title" className="talent-admin__section-title">
          Ödeme Talepleri Özeti
        </h2>
        <PayoutOverviewSection />
      </section>
    </div>
  );
}
