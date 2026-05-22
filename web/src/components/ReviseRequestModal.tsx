// web/src/components/ReviseRequestModal.tsx
import { useState } from "react";
import "./ReviseRequestModal.css";

interface ReviseRequestModalProps {
  visible: boolean;
  supplierQuoteName: string;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
  loading?: boolean;
}

export function ReviseRequestModal({
  visible,
  supplierQuoteName,
  onClose,
  onSubmit,
  loading = false,
}: ReviseRequestModalProps) {
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!visible) return null;

  const handleSubmit = async () => {
    if (!reason.trim()) {
      alert("Lütfen revize nedenini giriniz");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(reason);
      setReason("");
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="revise-request-modal__overlay">
      <div className="revise-request-modal__dialog">
        <h2 className="revise-request-modal__title">Revize İste</h2>

        <div className="revise-request-modal__supplier">
          <p className="revise-request-modal__supplier-text">
            <strong>Tedarikçi:</strong> {supplierQuoteName}
          </p>
        </div>

        <div className="revise-request-modal__field">
          <label className="revise-request-modal__label">Revize Nedeni</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Örn: Fiyatlar çok yüksek, lütfen indirim yapınız"
            className="revise-request-modal__textarea"
          />
        </div>

        <div className="revise-request-modal__actions">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting || loading}
            className="revise-request-modal__button revise-request-modal__button--cancel"
          >
            İptal
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || loading}
            className="revise-request-modal__button revise-request-modal__button--submit"
          >
            {isSubmitting || loading ? "Gönderiliyor..." : "Revize İste"}
          </button>
        </div>
      </div>
    </div>
  );
}
