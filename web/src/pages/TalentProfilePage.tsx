import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import {
  extractTalentError,
  getMyEarnings,
  getMyTalentProfile,
  getTalentErrorCode,
  registerTalentProfile,
  updateMyTalentProfile,
  type EarningsEntry,
  type PaginatedEarningsOut,
  type TalentProfile,
  type TalentProfileUpdatePayload,
} from "../services/talent.service";
import "./TalentProfilePage.css";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const AVAILABILITY_LABELS: Record<string, string> = {
  full_time: "Tam Zamanlı",
  part_time: "Yarı Zamanlı",
  freelance: "Freelance",
  not_available: "Müsait Değil",
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  referral_reward: "Referral Ödülü",
  job_placement: "İş Yerleştirme",
  bonus: "Bonus",
  payout: "Ödeme",
  payout_fee: "Ödeme Ücreti",
  adjustment: "Düzeltme",
};

function formatAmount(amount: string, currency: string): string {
  const num = parseFloat(amount);
  return `${num >= 0 ? "+" : ""}${num.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ${currency}`;
}

// ---------------------------------------------------------------------------
// RegisterForm — shown when no profile exists
// ---------------------------------------------------------------------------

interface RegisterFormProps {
  onSuccess: (profile: TalentProfile) => void;
}

function RegisterForm({ onSuccess }: RegisterFormProps) {
  const [availability, setAvailability] = useState("not_available");
  const [experienceYears, setExperienceYears] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [bio, setBio] = useState("");
  const [skillsRaw, setSkillsRaw] = useState("");
  const [categoryRaw, setCategoryRaw] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const profile = await registerTalentProfile({
        availability,
        experience_years: experienceYears ? parseInt(experienceYears, 10) : undefined,
        linkedin_url: linkedinUrl.trim() || undefined,
        bio: bio.trim() || undefined,
        skills: skillsRaw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        category_expertise: categoryRaw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        is_public: isPublic,
      });
      onSuccess(profile);
    } catch (err) {
      const code = getTalentErrorCode(err);
      if (code === "TALENT_ALREADY_REGISTERED") {
        setError("Zaten bir talent profiliniz mevcut. Sayfayı yenileyiniz.");
      } else {
        setError(extractTalentError(err));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="talent-form" onSubmit={handleSubmit}>
      <p className="talent-form__title">Talent Profilinizi Oluşturun</p>
      {error && <div className="talent-page__error">{error}</div>}
      <div className="talent-form__grid">
        <div className="talent-form__field">
          <label className="talent-form__label">Müsaitlik</label>
          <select
            className="talent-form__select"
            value={availability}
            onChange={(e) => setAvailability(e.target.value)}
          >
            <option value="not_available">Müsait Değil</option>
            <option value="freelance">Freelance</option>
            <option value="part_time">Yarı Zamanlı</option>
            <option value="full_time">Tam Zamanlı</option>
          </select>
        </div>
        <div className="talent-form__field">
          <label className="talent-form__label">Deneyim (yıl)</label>
          <input
            className="talent-form__input"
            type="number"
            min="0"
            max="60"
            value={experienceYears}
            onChange={(e) => setExperienceYears(e.target.value)}
            placeholder="ör. 8"
          />
        </div>
        <div className="talent-form__field talent-form__field--full">
          <label className="talent-form__label">LinkedIn URL</label>
          <input
            className="talent-form__input"
            type="url"
            value={linkedinUrl}
            onChange={(e) => setLinkedinUrl(e.target.value)}
            placeholder="https://linkedin.com/in/kullanici-adi"
          />
        </div>
        <div className="talent-form__field talent-form__field--full">
          <label className="talent-form__label">Hakkında</label>
          <textarea
            className="talent-form__textarea"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Kendinizi kısaca tanıtın..."
          />
        </div>
        <div className="talent-form__field talent-form__field--full">
          <label className="talent-form__label">Beceriler</label>
          <input
            className="talent-form__input"
            value={skillsRaw}
            onChange={(e) => setSkillsRaw(e.target.value)}
            placeholder="Satın alma, tedarik, kategori yönetimi (virgülle ayırın)"
          />
          <span className="talent-form__hint">Virgülle ayırarak birden fazla beceri girebilirsiniz.</span>
        </div>
        <div className="talent-form__field talent-form__field--full">
          <label className="talent-form__label">Kategori Uzmanlığı</label>
          <input
            className="talent-form__input"
            value={categoryRaw}
            onChange={(e) => setCategoryRaw(e.target.value)}
            placeholder="Hammadde, ambalaj, lojistik (virgülle ayırın)"
          />
        </div>
        <div className="talent-form__field">
          <label className="talent-form__label">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
            />
            Profili herkese açık göster
          </label>
        </div>
      </div>
      <div className="talent-form__actions">
        <button
          type="submit"
          className="talent-form__btn talent-form__btn--primary"
          disabled={submitting}
        >
          {submitting ? "Kaydediliyor..." : "Profili Oluştur"}
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// EditForm — inline patch form
// ---------------------------------------------------------------------------

interface EditFormProps {
  profile: TalentProfile;
  onSuccess: (updated: TalentProfile) => void;
  onCancel: () => void;
}

function EditForm({ profile, onSuccess, onCancel }: EditFormProps) {
  const [availability, setAvailability] = useState(profile.availability);
  const [experienceYears, setExperienceYears] = useState(
    profile.experience_years !== null ? String(profile.experience_years) : "",
  );
  const [linkedinUrl, setLinkedinUrl] = useState(profile.linkedin_url ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [skillsRaw, setSkillsRaw] = useState(profile.skills.join(", "));
  const [categoryRaw, setCategoryRaw] = useState(profile.category_expertise.join(", "));
  const [isPublic, setIsPublic] = useState(profile.is_public);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const payload: TalentProfileUpdatePayload = {
        availability,
        experience_years: experienceYears ? parseInt(experienceYears, 10) : null,
        linkedin_url: linkedinUrl.trim() || null,
        bio: bio.trim() || null,
        skills: skillsRaw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        category_expertise: categoryRaw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        is_public: isPublic,
      };
      const updated = await updateMyTalentProfile(payload);
      onSuccess(updated);
    } catch (err) {
      setError(extractTalentError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="talent-form" onSubmit={handleSubmit}>
      <p className="talent-form__title">Profili Düzenle</p>
      {error && <div className="talent-page__error">{error}</div>}
      <div className="talent-form__grid">
        <div className="talent-form__field">
          <label className="talent-form__label">Müsaitlik</label>
          <select
            className="talent-form__select"
            value={availability}
            onChange={(e) => setAvailability(e.target.value)}
          >
            <option value="not_available">Müsait Değil</option>
            <option value="freelance">Freelance</option>
            <option value="part_time">Yarı Zamanlı</option>
            <option value="full_time">Tam Zamanlı</option>
          </select>
        </div>
        <div className="talent-form__field">
          <label className="talent-form__label">Deneyim (yıl)</label>
          <input
            className="talent-form__input"
            type="number"
            min="0"
            max="60"
            value={experienceYears}
            onChange={(e) => setExperienceYears(e.target.value)}
          />
        </div>
        <div className="talent-form__field talent-form__field--full">
          <label className="talent-form__label">LinkedIn URL</label>
          <input
            className="talent-form__input"
            type="url"
            value={linkedinUrl}
            onChange={(e) => setLinkedinUrl(e.target.value)}
          />
        </div>
        <div className="talent-form__field talent-form__field--full">
          <label className="talent-form__label">Hakkında</label>
          <textarea
            className="talent-form__textarea"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />
        </div>
        <div className="talent-form__field talent-form__field--full">
          <label className="talent-form__label">Beceriler (virgülle ayırın)</label>
          <input
            className="talent-form__input"
            value={skillsRaw}
            onChange={(e) => setSkillsRaw(e.target.value)}
          />
        </div>
        <div className="talent-form__field talent-form__field--full">
          <label className="talent-form__label">Kategori Uzmanlığı (virgülle ayırın)</label>
          <input
            className="talent-form__input"
            value={categoryRaw}
            onChange={(e) => setCategoryRaw(e.target.value)}
          />
        </div>
        <div className="talent-form__field">
          <label className="talent-form__label">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
            />
            Profili herkese açık göster
          </label>
        </div>
      </div>
      <div className="talent-form__actions">
        <button
          type="submit"
          className="talent-form__btn talent-form__btn--primary"
          disabled={submitting}
        >
          {submitting ? "Kaydediliyor..." : "Kaydet"}
        </button>
        <button
          type="button"
          className="talent-form__btn talent-form__btn--secondary"
          onClick={onCancel}
        >
          İptal
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// EarningsSection
// ---------------------------------------------------------------------------

interface EarningsSectionProps {
  profileId: number;
}

function EarningsSection({ profileId: _profileId }: EarningsSectionProps) {
  const [data, setData] = useState<PaginatedEarningsOut | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getMyEarnings(page, 10);
      setData(result);
    } catch {
      // Silent — earnings is supplementary info
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = data ? Math.ceil(data.total / 10) : 0;

  return (
    <div className="earnings-section">
      <p className="earnings-section__title">Kazanç Geçmişi</p>
      {loading ? (
        <p className="earnings-empty">Yükleniyor...</p>
      ) : !data || data.items.length === 0 ? (
        <p className="earnings-empty">Henüz kazanç kaydı yok.</p>
      ) : (
        <>
          {data.items.map((entry: EarningsEntry) => {
            const num = parseFloat(entry.amount);
            const isPositive = num >= 0;
            return (
              <div key={entry.id} className="earnings-row">
                <div>
                  <div className="earnings-row__type">
                    {EVENT_TYPE_LABELS[entry.event_type] ?? entry.event_type}
                  </div>
                  <div className="earnings-row__meta">
                    {entry.notes && <span>{entry.notes} · </span>}
                    {new Date(entry.created_at).toLocaleDateString("tr-TR")}
                  </div>
                </div>
                <div
                  className={`earnings-row__amount ${
                    isPositive ? "earnings-row__amount--positive" : "earnings-row__amount--negative"
                  }`}
                >
                  {formatAmount(entry.amount, entry.currency)}
                </div>
              </div>
            );
          })}
          {totalPages > 1 && (
            <div className="earnings-pagination">
              <button
                className="earnings-pagination__btn"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                ‹
              </button>
              <span>
                {page} / {totalPages}
              </span>
              <button
                className="earnings-pagination__btn"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                ›
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ProfileView — read-only card with edit toggle
// ---------------------------------------------------------------------------

interface ProfileViewProps {
  profile: TalentProfile;
  onProfileUpdate: (updated: TalentProfile) => void;
}

function ProfileView({ profile, onProfileUpdate }: ProfileViewProps) {
  const { user } = useAuth();
  const [editing, setEditing] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  function handleEditSuccess(updated: TalentProfile) {
    onProfileUpdate(updated);
    setEditing(false);
    setSuccessMsg("Profiliniz güncellendi.");
    setTimeout(() => setSuccessMsg(null), 4000);
  }

  const kycClass =
    profile.kyc_status === "approved"
      ? "talent-card__kyc--approved"
      : profile.kyc_status === "rejected"
        ? "talent-card__kyc--rejected"
        : "talent-card__kyc--pending";

  return (
    <>
      {successMsg && <div className="talent-page__success">{successMsg}</div>}

      {editing ? (
        <EditForm
          profile={profile}
          onSuccess={handleEditSuccess}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <div className="talent-card">
          <div className="talent-card__header">
            <div>
              <p className="talent-card__name">{user?.full_name || user?.email}</p>
              <span className={`talent-card__kyc ${kycClass}`}>
                KYC: {profile.kyc_status}
              </span>
            </div>
            <button
              className="talent-form__btn talent-form__btn--secondary talent-form__btn--compact"
              onClick={() => setEditing(true)}
            >
              Düzenle
            </button>
          </div>

          <div className="talent-card__meta">
            <span className="talent-card__badge">
              {AVAILABILITY_LABELS[profile.availability] ?? profile.availability}
            </span>
            {profile.experience_years !== null && (
              <span className="talent-card__badge">{profile.experience_years} yıl deneyim</span>
            )}
            {profile.is_public && <span className="talent-card__badge">Herkese Açık</span>}
            {profile.linkedin_url && (
              <a href={profile.linkedin_url} target="_blank" rel="noopener noreferrer">
                LinkedIn ↗
              </a>
            )}
          </div>

          {profile.bio && <p className="talent-card__bio">{profile.bio}</p>}

          {profile.skills.length > 0 && (
            <>
              <p className="talent-card__section-title">Beceriler</p>
              <div className="talent-card__tags">
                {profile.skills.map((s) => (
                  <span key={s} className="talent-card__tag">{s}</span>
                ))}
              </div>
            </>
          )}

          {profile.category_expertise.length > 0 && (
            <>
              <p className="talent-card__section-title">Kategori Uzmanlığı</p>
              <div className="talent-card__tags">
                {profile.category_expertise.map((c) => (
                  <span key={c} className="talent-card__tag">{c}</span>
                ))}
              </div>
            </>
          )}

          <div className="talent-card__stats">
            <div className="talent-card__stat">
              <div className="talent-card__stat-value">{profile.reputation_score}</div>
              <div className="talent-card__stat-label">İtibar Puanı</div>
            </div>
            <div className="talent-card__stat">
              <div className="talent-card__stat-value">
                {parseFloat(profile.total_earned).toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
              </div>
              <div className="talent-card__stat-label">Toplam Kazanç (₺)</div>
            </div>
            <div className="talent-card__stat">
              <div className="talent-card__stat-value">
                {parseFloat(profile.total_paid_out).toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
              </div>
              <div className="talent-card__stat-label">Ödenen (₺)</div>
            </div>
          </div>
        </div>
      )}

      <EarningsSection profileId={profile.id} />
    </>
  );
}

// ---------------------------------------------------------------------------
// TalentProfilePage — main export
// ---------------------------------------------------------------------------

export default function TalentProfilePage() {
  const [profile, setProfile] = useState<TalentProfile | null>(null);
  // null = loading, false = no profile, TalentProfile = loaded
  const [loadState, setLoadState] = useState<"loading" | "no_profile" | "loaded">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    getMyTalentProfile()
      .then((p) => {
        if (mounted) {
          setProfile(p);
          setLoadState("loaded");
        }
      })
      .catch((err) => {
        if (!mounted) return;
        const code = getTalentErrorCode(err);
        const httpStatus = (err as { response?: { status?: number } })?.response?.status;
        if (httpStatus === 404 || code === "TALENT_PROFILE_NOT_FOUND") {
          // No profile yet — show register form
          setLoadState("no_profile");
        } else if (httpStatus === 403) {
          setError("Bu sayfaya erişim yetkiniz yok.");
          setLoadState("loaded");
        } else {
          setError(extractTalentError(err));
          setLoadState("loaded");
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  function handleRegisterSuccess(newProfile: TalentProfile) {
    setProfile(newProfile);
    setLoadState("loaded");
  }

  if (loadState === "loading") {
    return (
      <div className="talent-page">
        <div className="talent-page__loading">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="talent-page">
      <h1 className="talent-page__title">Talent Profilim</h1>
      {error && <div className="talent-page__error">{error}</div>}

      {/* no_profile → register form (key test: loadState === "no_profile") */}
      {loadState === "no_profile" && (
        <RegisterForm onSuccess={handleRegisterSuccess} />
      )}

      {/* loaded + profile → view/edit */}
      {loadState === "loaded" && profile && (
        <ProfileView profile={profile} onProfileUpdate={setProfile} />
      )}
    </div>
  );
}
