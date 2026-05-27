import { useState } from "react";
import "./SupplierProfileTab.css";

type DualRoleStatus = "none" | "pending" | "active" | "rejected";

type SupplierProfileTabProps = {
  tenantName: string | null;
  tenantId: number | null;
  linkedSupplierId: number | null;
  dualRoleStatus: DualRoleStatus;
  onRequestDualRole: (supplierId: number) => Promise<void>;
};

function StatusBadge({ status }: { status: DualRoleStatus }) {
  if (status === "active") return <span className="spt-badge spt-badge--active">Aktif</span>;
  if (status === "pending") return <span className="spt-badge spt-badge--pending">Onay Bekliyor</span>;
  if (status === "rejected") return <span className="spt-badge spt-badge--rejected">Reddedildi</span>;
  return <span className="spt-badge spt-badge--none">Bağlı Değil</span>;
}

export function SupplierProfileTab({
  tenantName,
  tenantId,
  linkedSupplierId,
  dualRoleStatus,
  onRequestDualRole,
}: SupplierProfileTabProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleRequest = async () => {
    if (!linkedSupplierId) return;
    setLoading(true);
    setError(null);
    try {
      await onRequestDualRole(linkedSupplierId);
      setSuccess(true);
    } catch {
      setError("Başvuru sırasında bir hata oluştu. Lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="spt">
      <div className="spt__header">
        <h2 className="spt__title">Tedarikçi Profilim</h2>
        <p className="spt__subtitle">
          Firmanız hem Stratejik Partner hem de Tedarikçi olarak platformda yer alabilir.
          Dual-role aktivasyonu ile teklif akışına katılabilir, RFQ'lara yanıt verebilirsiniz.
        </p>
      </div>

      <div className="spt__card">
        <div className="spt__card-row">
          <span className="spt__card-label">Stratejik Partner</span>
          <span className="spt__card-value">{tenantName ?? "—"}</span>
        </div>
        <div className="spt__card-row">
          <span className="spt__card-label">Tedarikçi Bağlantısı</span>
          <span className="spt__card-value">
            {linkedSupplierId ? `#${linkedSupplierId}` : "—"}
          </span>
        </div>
        <div className="spt__card-row">
          <span className="spt__card-label">Dual-Role Durumu</span>
          <StatusBadge status={dualRoleStatus} />
        </div>
      </div>

      {dualRoleStatus === "none" && (
        <div className="spt__action-section">
          <h3 className="spt__action-title">Tedarikçi Hesabı Bağla</h3>
          <p className="spt__action-desc">
            Platformdaki tedarikçi kaydınızı bu Stratejik Partner hesabınıza bağlamak için
            başvuru oluşturun. Platform ekibimiz inceledikten sonra aktifleştirilecektir.
          </p>
          {!linkedSupplierId ? (
            <p className="spt__info">
              Dual-role başvurusu için önce bir Tedarikçi kaydınız bulunmalıdır.
              Tedarikçi sekmesinden kayıt oluşturup geri dönebilirsiniz.
            </p>
          ) : (
            <button
              className="spt__btn spt__btn--primary"
              onClick={handleRequest}
              disabled={loading}
            >
              {loading ? "Başvuru gönderiliyor..." : "Dual-Role Başvurusu Yap"}
            </button>
          )}
        </div>
      )}

      {dualRoleStatus === "pending" && (
        <div className="spt__info-box spt__info-box--pending">
          <strong>Başvurunuz inceleniyor.</strong> Platform ekibimiz başvurunuzu değerlendiriyor.
          Aktivasyon tamamlandığında bildirim alacaksınız.
        </div>
      )}

      {dualRoleStatus === "active" && (
        <div className="spt__info-box spt__info-box--active">
          <strong>Dual-role aktif!</strong> Firmanız hem Stratejik Partner hem Tedarikçi olarak
          platformda yer almaktadır. RFQ davetlerine yanıt verebilir, teklif sunabilirsiniz.
        </div>
      )}

      {dualRoleStatus === "rejected" && (
        <div className="spt__info-box spt__info-box--rejected">
          <strong>Başvurunuz reddedildi.</strong> Detay için platform destek ekibiyle iletişime geçin.
        </div>
      )}

      {success && (
        <div className="spt__info-box spt__info-box--active">
          Başvurunuz başarıyla alındı. Platform ekibimiz en kısa sürede inceleyecektir.
        </div>
      )}

      {error && <p className="spt__error">{error}</p>}

      <div className="spt__explainer">
        <h3 className="spt__explainer-title">Dual-Role Nedir?</h3>
        <ul className="spt__explainer-list">
          <li>Firmanız hem satın alma yapabilir (Stratejik Partner), hem de teklif verebilir (Tedarikçi).</li>
          <li>Dual-role ek bir abonelik özelliği olarak sunulmaktadır.</li>
          <li>Aktivasyon platform ekibinin onayına tabidir.</li>
          <li>Aktifleştirildiğinde Tedarikçi Portalı ayrı bir erişim noktasından çalışır.</li>
        </ul>
      </div>
    </div>
  );
}
