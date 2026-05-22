import React, { useEffect, useState } from "react";
import axios from "axios";

interface EmailAccount {
  id?: number;
  email: string;
  password: string;
  smtp_host: string;
  smtp_port: number;
  use_tls: boolean;
  use_ssl: boolean;
  enable_email_notifications: boolean;
  display_name: string;
  description?: string;
}

const DEFAULT_SMTP = "buyerasistans.com.tr";
const DEFAULT_PORT = 465;

const DEFAULT_EMAILS: { email: string; description: string }[] = [
  { email: "notifications@buyerasistans.com.tr", description: "Sistem bildirimleri (örn: kullanıcı kayıt, şifre sıfırlama, genel bilgilendirme)" },
  { email: "teklif@buyerasistans.com.tr", description: "Teklif gönderimleri ve yanıtları" },
  { email: "aksiyon@buyerasistans.com.tr", description: "Aksiyon/görev bildirimleri" },
  { email: "destek@buyerasistans.com.tr", description: "Destek talepleri ve müşteri hizmetleri" },
  { email: "guvenlik@buyerasistans.com.tr", description: "Güvenlik uyarıları (örn: şüpheli giriş, parola sıfırlama)" },
  { email: "sozlesme@buyerasistans.com.tr", description: "Sözleşme gönderimleri ve onayları" },
  { email: "odeme@buyerasistans.com.tr", description: "Ödeme bildirimleri ve fatura iletimi" },
];

const defaultForm: EmailAccount = {
  email: "",
  password: "",
  smtp_host: DEFAULT_SMTP,
  smtp_port: DEFAULT_PORT,
  use_tls: true,
  use_ssl: true,
  enable_email_notifications: true,
  display_name: "ProcureFlow",
  description: ""
};

export const EmailAccountsTab: React.FC = () => {
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [form, setForm] = useState<EmailAccount>(defaultForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [message, setMessage] = useState<string>("");

  const API_PREFIX = "/api/advanced-settings/emails";

  const fetchAccounts = async () => {
    const res = await axios.get<EmailAccount[]>(API_PREFIX);
    setAccounts(res.data);
  };

  // İlk yüklemede default emailleri backend'e ekle
  useEffect(() => {
    const syncDefaults = async () => {
      const res = await axios.get(API_PREFIX);
      const data = res.data as EmailAccount[];
      for (const def of DEFAULT_EMAILS) {
        if (!data.find((a: EmailAccount) => a.email === def.email)) {
          await axios.post(API_PREFIX, {
            email: def.email,
            password: "96578097Run!!",
            smtp_host: DEFAULT_SMTP,
            smtp_port: DEFAULT_PORT,
            use_tls: true,
            use_ssl: true,
            enable_email_notifications: true,
            display_name: "ProcureFlow",
            description: def.description,
          });
        }
      }
      // Yeniden çek
      const final = await axios.get(API_PREFIX);
      setAccounts(final.data);
    };
    syncDefaults();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSave = async () => {
    try {
      if (editingId) {
        await axios.put(`/api/advanced-settings/emails/${editingId}`, form);
        setMessage("Email hesabı güncellendi.");
      } else {
        await axios.post("/api/advanced-settings/emails", form);
        setMessage("Email hesabı eklendi.");
      }
      setForm(defaultForm);
      setEditingId(null);
      fetchAccounts();
    } catch {
      setMessage("Hata oluştu!");
    }
  };

  const handleEdit = (acc: EmailAccount) => {
    setForm(acc);
    setEditingId(acc.id!);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Silmek istediğinize emin misiniz?")) return;
    await axios.delete(`/api/advanced-settings/emails/${id}`);
    setMessage("Email hesabı silindi.");
    fetchAccounts();
  };

  return (
    <div>
      <h2>Email Hesapları</h2>
      {message && <div style={{ color: "green", marginBottom: 8 }}>{message}</div>}
      <table style={{ width: "100%", marginBottom: 20, borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#f1f5f9" }}>
            <th>Email</th>
            <th>Açıklama</th>
            <th>Şifre</th>
            <th>İşlem</th>
          </tr>
        </thead>
        <tbody>
          {accounts.map((acc, idx) => (
            <tr key={acc.email} style={{ borderBottom: "1px solid #e5e7eb" }}>
              <td style={{ fontWeight: "bold" }}>{acc.email}</td>
              <td style={{ color: "#64748b", fontSize: 13 }}>{acc.description}</td>
              <td>
                <input
                  type="password"
                  value={acc.password || ""}
                  style={{ width: 140 }}
                  onChange={e => {
                    const newAccounts = [...accounts];
                    newAccounts[idx].password = e.target.value;
                    setAccounts(newAccounts);
                  }}
                />
              </td>
              <td>
                <button onClick={() => handleEdit(acc)}>Düzenle</button>
                <button onClick={() => handleDelete(acc.id!)} style={{ marginLeft: 8 }}>Sil</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: 24, background: "#f9fafb", padding: 16, borderRadius: 8, border: "1px solid #e5e7eb" }}>
        <h3 style={{ marginBottom: 12 }}>{editingId ? "Email Hesabı Düzenle" : "Yeni Email Hesabı Ekle"}</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input name="email" value={form.email} onChange={handleChange} placeholder="Email" style={{ width: 220 }} />
          <input name="password" value={form.password} onChange={handleChange} placeholder="Şifre" type="password" style={{ width: 140 }} />
          <input name="description" value={form.description} onChange={handleChange} placeholder="Açıklama (örn: Bildirim, Teklif, Destek...)" style={{ width: 220 }} />
          <button onClick={handleSave}>{editingId ? "Güncelle" : "Ekle"}</button>
          {editingId && <button onClick={() => { setForm(defaultForm); setEditingId(null); }}>Vazgeç</button>}
        </div>
        <div style={{ fontSize: 12, color: "#64748b", marginTop: 8 }}>
          Eklenen email adresinin ne için kullanılacağını açıklama kısmına yazınız. Şifreyi değiştirmek için kutucuğu güncelleyip "Güncelle"ye basabilirsiniz.
        </div>
      </div>
    </div>
  );
};
