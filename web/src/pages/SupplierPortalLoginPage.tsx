import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import { supplierLoginRequest } from "../services/auth.service";
import { isSupplierLoggedIn } from "../lib/session";
import NavBar from "../components/NavBar";
import PublicBrandLogo from "../components/PublicBrandLogo";

const Container = styled.div`
  min-height: calc(100vh - 60px);
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(320px, 0.9fr);
  background: radial-gradient(circle at top left, rgba(14, 165, 233, 0.2), transparent 26%), linear-gradient(135deg, #eef7ff 0%, #dbeafe 56%, #e0f2fe 100%);

  @media (max-width: 980px) {
    grid-template-columns: 1fr;
  }
`;

const LeftSection = styled.section`
  padding: 56px;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle at top right, rgba(56, 189, 248, 0.3), transparent 24%), radial-gradient(circle at bottom left, rgba(14, 165, 233, 0.2), transparent 26%), linear-gradient(135deg, #1a3a5c 0%, #1e4f78 55%, #0f70a8 100%);

  h1 {
    font-size: 46px;
    line-height: 1.04;
    margin: 18px 0 10px;
    font-weight: 900;
  }

  p {
    margin: 0;
    max-width: 520px;
    line-height: 1.7;
    color: #dbeafe;
    font-size: 15px;
  }
`;

const RightSection = styled.section`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
`;

const FormContainer = styled.div`
  width: 100%;
  max-width: 430px;
  background: white;
  border-radius: 22px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 20px 55px rgba(30, 41, 59, 0.16);
  padding: 36px 32px;

  h2 {
    margin: 0;
    font-size: 32px;
    line-height: 1.08;
    color: #0f172a;
    font-weight: 900;
  }

  p {
    margin: 10px 0 24px;
    color: #64748b;
    font-size: 14px;
    line-height: 1.6;
  }
`;

const Form = styled.form`
  display: grid;
  gap: 14px;
`;

const FormGroup = styled.label`
  display: grid;
  gap: 6px;
  font-size: 13px;
  font-weight: 700;
  color: #334155;
`;

const Input = styled.input`
  width: 100%;
  padding: 13px 14px;
  border-radius: 12px;
  border: 1px solid #dbe3ef;
  background: #f8fafc;
  font-size: 14px;

  &:focus {
    outline: none;
    border-color: #0ea5e9;
    box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.15);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.7;
  }
`;

const SubmitButton = styled.button`
  width: 100%;
  padding: 13px 16px;
  border-radius: 12px;
  border: none;
  background: #0ea5e9;
  color: #fff;
  font-size: 14px;
  font-weight: 800;
  cursor: pointer;

  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
`;

const ErrorMessage = styled.div`
  border-radius: 12px;
  border: 1px solid #fecaca;
  background: #fff1f2;
  color: #be123c;
  padding: 10px 12px;
  font-size: 13px;
`;

const SuccessMessage = styled.div`
  border-radius: 12px;
  border: 1px solid #86efac;
  background: #dcfce7;
  color: #166534;
  padding: 10px 12px;
  font-size: 13px;
`;

interface LoginError {
  field?: string;
  message: string;
}

export default function SupplierPortalLoginPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<LoginError | null>(null);
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (isSupplierLoggedIn()) {
      navigate("/supplier/dashboard", { replace: true });
    }
  }, [navigate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess("");

    if (!formData.email) {
      setError({ field: "email", message: "E-posta gerekli" });
      return;
    }

    if (!formData.password) {
      setError({ field: "password", message: "Sifre gerekli" });
      return;
    }

    setLoading(true);

    try {
      await supplierLoginRequest(formData.email, formData.password);
      setSuccess("Giris basarili! Yonlendiriliyorsunuz...");
      navigate("/supplier/dashboard", { replace: true });
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Giris basarisiz. Lutfen e-posta ve sifrenizi kontrol ediniz.";
      setError({ message: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh" }}>
      <NavBar variant="supplier" activePath="/supplier/login" />
      <Container>
        <LeftSection>
          <div>
            <PublicBrandLogo height={44} maxWidth={220} marginBottom={24} invert />
            <h1>Tedarikci Portali</h1>
            <p>Tekliflerinizi yonetin, proje detaylarini gorun ve sozlesme sureclerini tek bir panelden takip edin.</p>
          </div>
        </LeftSection>

        <RightSection>
          <FormContainer>
            <h2>Tedarikci Girisi</h2>
            <p>Tedarikci hesabinizla giris yaparak kendi tedarikci panelinize erisin.</p>

            <Form onSubmit={handleSubmit}>
              {error && <ErrorMessage>{error.message}</ErrorMessage>}
              {success && <SuccessMessage>{success}</SuccessMessage>}

              <FormGroup htmlFor="email">
                E-posta Adresi
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

              <FormGroup htmlFor="password">
                Sifre
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
                {loading ? "Giris yapiliyor..." : "Giris Yap"}
              </SubmitButton>
            </Form>
          </FormContainer>
        </RightSection>
      </Container>
    </div>
  );
}
