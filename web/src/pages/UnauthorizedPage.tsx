import { Link } from "react-router-dom";
import "./UnauthorizedPage.css";

export default function UnauthorizedPage() {
  return (
    <div className="unauth-root">
      <div className="unauth-card">
        <h1>403 - Yetkisiz Erişim</h1>
        <p>
          Bu sayfayı görüntülemek için gerekli izniniz yok.
          Hesap rolünüz bu alan için yeterli değil.
        </p>

        <div className="unauth-actions">
          <Link to="/dashboard" className="unauth-btn--primary">
            Dashboard'a Dön
          </Link>
          <Link to="/login" className="unauth-btn--ghost">
            Farklı Hesapla Giriş
          </Link>
        </div>
      </div>
    </div>
  );
}
