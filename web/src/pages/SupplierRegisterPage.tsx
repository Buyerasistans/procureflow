import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { http } from "../lib/http";
import { isSupplierLoggedIn, setSupplierAccessToken } from "../lib/session";
import "./SupplierRegisterPage.css";

export default function SupplierRegisterPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [companyInfo, setCompanyInfo] = useState({
    company_name: "",
    user_name: "",
    email: "",
  });
  const [formData, setFormData] = useState({
    password: "",
    password_confirm: "",
  });

  useEffect(() => {
    if (isSupplierLoggedIn()) {
      console.log("[REGISTER] Already have supplier token, redirecting to dashboard");
      navigate("/supplier/dashboard", { replace: true });
      return;
    }

    if (!token) {
      setError("Geçersiz kayıt bağlantısı");
      setLoading(false);
      return;
    }

    const verifyToken = async () => {
      try {
        console.log("[REGISTER] Calling validate endpoint with token:", token);
        const api = import.meta.env.VITE_API_BASE_URL || "";
        const baseURL = api ? api : window.location.origin;
        const url = api ? `${api}/api/v1/supplier/register/validate` : `${baseURL}/api/v1/supplier/register/validate`;

        const response = await axios.get(url, {
          params: { token }
        });
        console.log("[REGISTER] Validate response:", response.data);

        if (!response.data?.valid) {
          console.log("[REGISTER] Valid = false, showing error");
          setError(response.data?.message || "Geçersiz veya süresi dolmuş bağlantı");
          setLoading(false);
          return;
        }

        console.log("[REGISTER] Valid = true, showing form");
        setCompanyInfo({
          company_name: response.data.supplier_name || "",
          user_name: response.data.supplier_user_name || "",
          email: response.data.email || "",
        });
        setLoading(false);
      } catch (error) {
        console.error("[REGISTER] Validate error:", error);
        setError("Geçersiz veya süresi dolmuş bağlantı");
        setLoading(false);
      }
    };

    verifyToken();
  }, [token, navigate]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.password) {
      setError("Şifre boş olamaz");
      return;
    }

    if (formData.password !== formData.password_confirm) {
      setError("Şifreler eşleşmiyor");
      return;
    }

    if (formData.password.length < 8) {
      setError("Şifre en az 8 karakter olmalıdır");
      return;
    }

    try {
      setRegistering(true);
      setError(null);

      console.log("[REGISTER] Posting to /supplier/register with token:", token?.substring(0, 20) + "...");
      const response = await http.post("/supplier/register", {
        token,
        password: formData.password,
      });

      console.log("[REGISTER] Response received:", response.status, response.data);

      if (response.data?.access_token) {
        console.log("[REGISTER] access_token found, saving to session");
        setSupplierAccessToken(response.data.access_token);
      } else {
        console.error("[REGISTER] ERROR: access_token NOT in response!", response.data);
        setError("Kayıt başarılı, ancak token alınamadı");
        return;
      }

      setSuccess("Kayıt başarılı! Panele yönlendiriliyorsunuz...");
      setTimeout(() => {
        console.log("[REGISTER] Navigating to /supplier/dashboard");
        navigate("/supplier/dashboard", { replace: true });
      }, 1000);
    } catch (err: unknown) {
      console.error("[REGISTER] Catch error:", err);
      setError("Kayıt sırasında hata oluştu: " + String(err));
    } finally {
      setRegistering(false);
    }
  };

  if (loading) {
    return (
      <div className="sreg-container">
        <div className="sreg-card">
          <div className="sreg-loading">⏳ Veriler yükleniyor...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="sreg-container">
      <div className="sreg-card">
        <h1>Daveti Tamamlayın</h1>
        <div className="sreg-card__subtitle">Stratejik partneriniz sizi ProcureFlow tedarikçi portalına hızlı davet ile ekledi.</div>

        {error && <div className="sreg-msg sreg-msg--error">❌ {error}</div>}
        {success && <div className="sreg-msg sreg-msg--success">✅ {success}</div>}

        {!success && (
          <>
            <div className="sreg-invite-summary">
              <div><strong>Firma:</strong> {companyInfo.company_name}</div>
              <div className="sreg-invite-summary__row"><strong>Davet edilen yetkili:</strong> {companyInfo.user_name || "İlk firma yetkilisi"}</div>
              <div className="sreg-invite-summary__row"><strong>E-posta:</strong> {companyInfo.email}</div>
              <ul>
                <li>Bu adımda hesabınızı aktive eder ve giriş şifrenizi belirlersiniz.</li>
                <li>Vergi, adres, finans ve belge bilgilerini giriş yaptıktan sonra profil ekranınızdan siz tamamlarsınız.</li>
                <li>Kayıt tamamlanınca doğrudan supplier paneline yönlendirilirsiniz.</li>
              </ul>
            </div>

            <div className="sreg-info-block">
              <p><strong>📦 Firma:</strong> {companyInfo.company_name}</p>
              <p><strong>👤 Yetkili:</strong> {companyInfo.user_name}</p>
              <p className="sreg-info-block__last"><strong>📧 E-mail:</strong> {companyInfo.email}</p>
            </div>

            <form onSubmit={handleRegister}>
              <div className="sreg-form-group">
                <label htmlFor="password">Şifre *</label>
                <input
                  id="password"
                  type="password"
                  className="sreg-input"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Portal girişiniz için en az 8 karakter"
                  required
                  disabled={registering}
                />
              </div>

              <div className="sreg-form-group">
                <label htmlFor="password_confirm">Şifre Tekrarı *</label>
                <input
                  id="password_confirm"
                  type="password"
                  className="sreg-input"
                  value={formData.password_confirm}
                  onChange={(e) => setFormData({ ...formData, password_confirm: e.target.value })}
                  placeholder="Aynı şifreyi tekrar girin"
                  required
                  disabled={registering}
                />
              </div>

              <button type="submit" className="sreg-btn" disabled={registering}>
                {registering ? "⏳ Davet tamamlanıyor..." : "✅ Davetimi Tamamla"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
