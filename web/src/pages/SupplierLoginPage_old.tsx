import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import { http } from "../lib/http";

const Container = styled.div`
  display: flex;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
`;

const LeftSection = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  color: white;
  padding: 40px;
  text-align: center;

  h1 {
    font-size: 48px;
    margin-bottom: 20px;
    font-weight: 700;
  }

  p {
    font-size: 18px;
    opacity: 0.9;
    max-width: 400px;
    line-height: 1.6;
  }
`;

const RightSection = styled.div`
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 40px;
`;

const FormContainer = styled.div`
  background: white;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  padding: 40px;
  width: 100%;
  max-width: 400px;

  h2 {
    font-size: 28px;
    margin-bottom: 10px;
    color: #1f2937;
    font-weight: 600;
  }

  p {
    color: #6b7280;
    margin-bottom: 30px;
    font-size: 14px;
  }
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const Label = styled.label`
  font-size: 14px;
  font-weight: 500;
  color: #374151;
`;

const Input = styled.input`
  padding: 12px 16px;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  font-size: 14px;
  transition: border-color 0.3s;

  &:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }

  &:disabled {
    background-color: #f3f4f6;
    cursor: not-allowed;
  }
`;

const SubmitButton = styled.button`
  padding: 12px 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;

  &:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
  }

  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
`;

const ErrorMessage = styled.div`
  padding: 12px;
  background-color: #fee2e2;
  color: #991b1b;
  border-radius: 8px;
  font-size: 14px;
  border-left: 4px solid #dc2626;
  margin-bottom: 10px;
`;

const SuccessMessage = styled.div`
  padding: 12px;
  background-color: #dcfce7;
  color: #166534;
  border-radius: 8px;
  font-size: 14px;
  border-left: 4px solid #22c55e;
  margin-bottom: 10px;
`;

const BackLink = styled.a`
  color: #667eea;
  text-decoration: none;
  font-size: 14px;
  cursor: pointer;
  margin-top: 20px;
  text-align: center;
  transition: color 0.3s;

  &:hover {
    color: #764ba2;
    text-decoration: underline;
  }
`;

interface LoginError {
  field?: string;
  message: string;
}

export default function SupplierLoginPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<LoginError | null>(null);
  const [success, setSuccess] = useState("");

  // Eğer zaten supplier login'se dashboard'a yönlendir
  useEffect(() => {
    const supplierToken = localStorage.getItem("supplier_access_token");
    if (supplierToken) {
      navigate("/supplier/dashboard", { replace: true });
    }
  }, [navigate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess("");

    // Validation
    if (!formData.email) {
      setError({ field: "email", message: "E-posta gerekli" });
      return;
    }

    if (!formData.password) {
      setError({ field: "password", message: "Şifre gerekli" });
      return;
    }

    setLoading(true);

    try {
      // Try to login with the supplied credentials
      const response = await http.post("/supplier/login", {
        email: formData.email,
        password: formData.password,
      });

      const { access_token, supplier_user: userData } = response.data;

      // Supplier user token'ını localStorage'a kaydet
      localStorage.setItem("supplier_access_token", access_token);
      localStorage.setItem("supplier_user", JSON.stringify(userData));
      localStorage.setItem("user_type", "supplier");

      setSuccess("Giriş başarılı! Yönlendiriliyorsunuz...");

      // Yönlendir
      setTimeout(() => {
        navigate("/supplier/dashboard");
      }, 1000);
    } catch (err: unknown) {
      console.error("Login error:", err);
      const errorMessage =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "Giriş başarısız. Lütfen e-posta ve şifrenizi kontrol ediniz.";
      setError({ message: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container>
      <LeftSection>
        <div>
          <h1>Tedarikçi Portalı</h1>
          <p>
            Tekliflerinizi yönetin, proje detaylarını görün ve sözleşmelerinizi
            takip edin.
          </p>
        </div>
      </LeftSection>

      <RightSection>
        <FormContainer>
          <h2>Giriş Yapın</h2>
          <p>Tedarikçi hesabınızla giriş yaparak panele erişin</p>

          <Form onSubmit={handleSubmit}>
            {error && <ErrorMessage>{error.message}</ErrorMessage>}
            {success && <SuccessMessage>{success}</SuccessMessage>}

            <FormGroup>
              <Label htmlFor="email">E-posta Adresi</Label>
              <Input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="ornek@tedarikci.com"
                disabled={loading}
                required
              />
            </FormGroup>

            <FormGroup>
              <Label htmlFor="password">Şifre</Label>
              <Input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••"
                disabled={loading}
                required
              />
            </FormGroup>

            <SubmitButton type="submit" disabled={loading}>
              {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
            </SubmitButton>
          </Form>

          <BackLink onClick={() => navigate("/login")}>
            Ana sayfaya dön
          </BackLink>
        </FormContainer>
      </RightSection>
    </Container>
  );
}
