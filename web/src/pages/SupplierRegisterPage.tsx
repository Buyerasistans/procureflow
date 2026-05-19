import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import styled from "styled-components";
import axios from "axios";
import { http } from "../lib/http";
import { isSupplierLoggedIn, setSupplierAccessToken } from "../lib/session";

const Container = styled.div`
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
`;

const Card = styled.div`
  background: white;
  padding: 40px;
  border-radius: 10px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  max-width: 500px;
  width: 100%;

  h1 {
    margin: 0 0 10px 0;
    font-size: 28px;
    color: #333;
  }

  .subtitle {
    color: #666;
    margin-bottom: 30px;
    font-size: 14px;
  }
`;

const FormGroup = styled.div`
  margin-bottom: 20px;

  label {
    display: block;
    margin-bottom: 8px;
    font-weight: 600;
    color: #333;
    font-size: 14px;
  }
`;

const Input = styled.input`
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  box-sizing: border-box;

  &:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }
`;

const Button = styled.button`
  width: 100%;
  padding: 12px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 4px;
  font-weight: bold;
  font-size: 16px;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;

  &:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const ErrorBox = styled.div`
  background-color: #fee2e2;
  color: #991b1b;
  padding: 12px;
  border-radius: 4px;
  margin-bottom: 20px;
  font-size: 14px;
`;

const SuccessBox = styled.div`
  background-color: #d1fae5;
  color: #065f46;
  padding: 12px;
  border-radius: 4px;
  margin-bottom: 20px;
  font-size: 14px;
`;

const LoadingBox = styled.div`
  text-align: center;
  padding: 20px;
  color: #666;
`;

const InviteSummary = styled.div`
  margin-bottom: 24px;
  padding: 16px;
  border-radius: 12px;
  background: linear-gradient(180deg, #eff6ff 0%, #f8fafc 100%);
  border: 1px solid #bfdbfe;
  color: #334155;
  font-size: 13px;

  strong {
    color: #0f172a;
  }

  ul {
    margin: 14px 0 0 18px;
    padding: 0;
    color: #475569;
    line-height: 1.6;
  }
`;

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

  // Token'ı verify et ve firma bilgisi al
  useEffect(() => {
    // Eğer zaten supplier login'se dashboard'a yönlendir
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

    // Verify endpoint'i çağır - public endpoint olduğu için doğrudan axios kullan
    const verifyToken = async () => {
      try {
        console.log("[REGISTER] Calling validate endpoint with token:", token);
        const api = import.meta.env.VITE_API_BASE_URL || "";
        const baseURL = api ? api : window.location.origin;
        const url = api ? `${api}/api/v1/supplier/register/validate` : `${baseURL}/api/v1/supplier/register/validate`;
        
        // Public endpoint - interceptor bypass et
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

      // Token'ı localStorage'a kaydet
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
      <Container>
        <Card>
          <LoadingBox>⏳ Veriler yükleniyor...</LoadingBox>
        </Card>
      </Container>
    );
  }

  return (
    <Container>
      <Card>
        <h1>Daveti Tamamlayın</h1>
        <div className="subtitle">Stratejik partneriniz sizi ProcureFlow tedarikçi portalına hızlı davet ile ekledi.</div>

        {error && <ErrorBox>❌ {error}</ErrorBox>}
        {success && <SuccessBox>✅ {success}</SuccessBox>}

        {!success && (
          <>
            <InviteSummary>
              <div><strong>Firma:</strong> {companyInfo.company_name}</div>
              <div style={{ marginTop: "6px" }}><strong>Davet edilen yetkili:</strong> {companyInfo.user_name || "İlk firma yetkilisi"}</div>
              <div style={{ marginTop: "6px" }}><strong>E-posta:</strong> {companyInfo.email}</div>
              <ul>
                <li>Bu adımda hesabınızı aktive eder ve giriş şifrenizi belirlersiniz.</li>
                <li>Vergi, adres, finans ve belge bilgilerini giriş yaptıktan sonra profil ekranınızdan siz tamamlarsınız.</li>
                <li>Kayıt tamamlanınca doğrudan supplier paneline yönlendirilirsiniz.</li>
              </ul>
            </InviteSummary>

            <div style={{ marginBottom: "20px", fontSize: "13px", color: "#666" }}>
              <p style={{ margin: "0 0 8px 0" }}>
                <strong>📦 Firma:</strong> {companyInfo.company_name}
              </p>
              <p style={{ margin: "0 0 8px 0" }}>
                <strong>👤 Yetkili:</strong> {companyInfo.user_name}
              </p>
              <p style={{ margin: "0" }}>
                <strong>📧 E-mail:</strong> {companyInfo.email}
              </p>
            </div>

            <form onSubmit={handleRegister}>
              <FormGroup>
                <label htmlFor="password">Şifre *</label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  placeholder="Portal girişiniz için en az 8 karakter"
                  required
                  disabled={registering}
                />
              </FormGroup>

              <FormGroup>
                <label htmlFor="password_confirm">Şifre Tekrarı *</label>
                <Input
                  id="password_confirm"
                  type="password"
                  value={formData.password_confirm}
                  onChange={(e) =>
                    setFormData({ ...formData, password_confirm: e.target.value })
                  }
                  placeholder="Aynı şifreyi tekrar girin"
                  required
                  disabled={registering}
                />
              </FormGroup>

              <Button type="submit" disabled={registering}>
                {registering ? "⏳ Davet tamamlanıyor..." : "✅ Davetimi Tamamla"}
              </Button>
            </form>
          </>
        )}
      </Card>
    </Container>
  );
}
