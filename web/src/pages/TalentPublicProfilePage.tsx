import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import NavBar from "../components/NavBar";
import "./TalentPublicProfilePage.css";

type PublicProfile = {
  id: number;
  availability: string;
  experience_years: number | null;
  bio: string | null;
  skills: string[];
  category_expertise: string[];
  reputation_score: number;
  is_active: boolean;
  created_at: string;
};

const AVAILABILITY_LABELS: Record<string, string> = {
  full_time: "Tam Zamanlı Müsait",
  part_time: "Yarı Zamanlı Müsait",
  freelance: "Freelance / Proje Bazlı",
  not_available: "Şu an Müsait Değil",
};

function fetchPublicProfile(id: string): Promise<PublicProfile> {
  const apiBase = (import.meta.env.VITE_API_URL as string) || "http://localhost:8000";
  return fetch(`${apiBase}/api/v1/talent/public/${id}`)
    .then((res) => {
      if (res.status === 404) throw new Error("NOT_FOUND");
      if (!res.ok) throw new Error("FETCH_ERROR");
      return res.json() as Promise<PublicProfile>;
    });
}

export default function TalentPublicProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetchPublicProfile(id)
      .then(setProfile)
      .catch((err) => {
        if (err.message === "NOT_FOUND") setNotFound(true);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="tpp">
        <NavBar variant="neutral" />
        <div className="tpp__loading">Profil yükleniyor...</div>
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="tpp">
        <NavBar variant="neutral" />
        <div className="tpp__not-found">
          <div className="tpp__not-found-icon">🔍</div>
          <h1 className="tpp__not-found-title">Profil Bulunamadı</h1>
          <p className="tpp__not-found-desc">
            Bu profil gizli veya henüz onaylanmamış. Yalnızca herkese açık ve onaylı profiller görüntülenebilir.
          </p>
          <Link to="/is-ilanlari" className="tpp__back-link">
            ← Profesyonel İlanlarına Dön
          </Link>
        </div>
      </div>
    );
  }

  const availLabel = AVAILABILITY_LABELS[profile.availability] ?? profile.availability;
  const isAvailable = profile.availability !== "not_available";

  return (
    <div className="tpp">
      <NavBar variant="neutral" />
      <main className="tpp__main">
        <div className="tpp__card">
          {/* Avatar placeholder */}
          <div className="tpp__avatar" aria-hidden="true">
            {String(profile.id).padStart(2, "0")}
          </div>

          <div className="tpp__info">
            <div className="tpp__header-row">
              <h1 className="tpp__name">Satın Alma Profesyoneli #{profile.id}</h1>
              <span
                className={`tpp__availability tpp__availability--${isAvailable ? "open" : "closed"}`}
              >
                {availLabel}
              </span>
            </div>

            {profile.experience_years != null && (
              <p className="tpp__experience">{profile.experience_years} yıl deneyim</p>
            )}

            {profile.bio && <p className="tpp__bio">{profile.bio}</p>}
          </div>
        </div>

        {profile.skills.length > 0 && (
          <section className="tpp__section">
            <h2 className="tpp__section-title">Uzmanlık Alanları</h2>
            <div className="tpp__tags">
              {profile.skills.map((skill) => (
                <span key={skill} className="tpp__tag tpp__tag--skill">
                  {skill}
                </span>
              ))}
            </div>
          </section>
        )}

        {profile.category_expertise.length > 0 && (
          <section className="tpp__section">
            <h2 className="tpp__section-title">Kategori Uzmanlıkları</h2>
            <div className="tpp__tags">
              {profile.category_expertise.map((cat) => (
                <span key={cat} className="tpp__tag tpp__tag--category">
                  {cat}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* CTA */}
        <div className="tpp__cta">
          {user ? (
            <div className="tpp__cta-authenticated">
              <p className="tpp__cta-text">Bu profesyonelle iletişime geçmek için İK panelinizi kullanın.</p>
              <Link to="/admin" className="tpp__cta-btn tpp__cta-btn--primary">
                İK Paneline Git
              </Link>
            </div>
          ) : (
            <div className="tpp__cta-guest">
              <p className="tpp__cta-text">
                Bu profesyonelin tam profili, iletişim bilgileri ve başvuru seçenekleri için giriş yapın.
              </p>
              <button
                className="tpp__cta-btn tpp__cta-btn--primary"
                onClick={() =>
                  navigate("/login", { state: { from: { pathname: `/talent/${id}` } } })
                }
              >
                Giriş Yaparak Görüntüle
              </button>
              <a href="/employer/register" className="tpp__cta-btn tpp__cta-btn--secondary">
                Hesap Oluştur
              </a>
            </div>
          )}
        </div>

        <div className="tpp__footer-note">
          Satın alma ve tedarik zinciri profesyonelleri için kariyer platformu —{" "}
          <a href="/satin-alma-kariyerim">Satın Alma Kariyerim</a>
        </div>
      </main>
    </div>
  );
}
