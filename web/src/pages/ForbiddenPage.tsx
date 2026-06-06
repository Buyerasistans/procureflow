import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { getDefaultRouteForUser } from "../auth/routing";
import "./ForbiddenPage.css";

export default function ForbiddenPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const deniedFrom =
    (location.state as { deniedFrom?: string } | null)?.deniedFrom ?? "bu sayfa";
  const fallbackToState =
    (location.state as { fallbackTo?: string } | null)?.fallbackTo;
  const fallbackTo = user ? fallbackToState ?? getDefaultRouteForUser(user) : "/dashboard";

  return (
    <div className="fb-root">
      <h1>403 - Yetkisiz Erişim</h1>
      <p>
        <b>{deniedFrom}</b> için gerekli yetkiye sahip değilsiniz.
      </p>

      <div className="fb-actions">
        <button className="fb-btn" onClick={() => navigate(-1)}>
          Geri Dön
        </button>
        <Link to={fallbackTo} className="fb-btn">
          Uygun Sayfaya Git
        </Link>
      </div>
    </div>
  );
}
