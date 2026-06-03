// web/src/components/ReviseSubmitModal.tsx
import { useState, useEffect } from "react";
import type { CSSProperties } from "react";
import "./ReviseSubmitModal.css";

interface RevisionItem {
  quote_item_id: number;
  original_unit_price: number;
  original_total_price: number;
  item_description: string;
}

interface ReviseSubmitModalProps {
  visible: boolean;
  supplierQuoteName: string;
  items: RevisionItem[];
  onClose: () => void;
  onSubmit: (revisedPrices: Array<{quote_item_id: number; unit_price: number; total_price: number}>) => Promise<void>;
  loading?: boolean;
}

export function ReviseSubmitModal({
  visible,
  supplierQuoteName,
  items,
  onClose,
  onSubmit,
  loading = false,
}: ReviseSubmitModalProps) {
  const [revisedPrices, setRevisedPrices] = useState<Record<number, {unit_price: number; total_price: number}>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (visible && Object.keys(revisedPrices).length === 0) {
      // İlk yüklemede orijinal fiyatları kopyala
      const initial: typeof revisedPrices = {};
      items.forEach((item) => {
        initial[item.quote_item_id] = {
          unit_price: item.original_unit_price,
          total_price: item.original_total_price,
        };
      });
      setRevisedPrices(initial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!visible) return null;

  const handleUnitPriceChange = (itemId: number, unitPrice: number) => {
    const item = items.find((i) => i.quote_item_id === itemId);
    if (!item) return;

    const quantity = item.original_total_price / item.original_unit_price;
    const totalPrice = unitPrice * quantity;

    setRevisedPrices((prev) => ({
      ...prev,
      [itemId]: { unit_price: unitPrice, total_price: totalPrice },
    }));
  };

  const handleTotalPriceChange = (itemId: number, totalPrice: number) => {
    const item = items.find((i) => i.quote_item_id === itemId);
    if (!item) return;

    const quantity = item.original_total_price / item.original_unit_price;
    const unitPrice = quantity > 0 ? totalPrice / quantity : 0;

    setRevisedPrices((prev) => ({
      ...prev,
      [itemId]: { unit_price: unitPrice, total_price: totalPrice },
    }));
  };

  const calculateTotalProfitability = () => {
    let totalSavings = 0;
    items.forEach((item) => {
      const revised = revisedPrices[item.quote_item_id];
      if (revised) {
        totalSavings += item.original_total_price - revised.total_price;
      }
    });
    return totalSavings;
  };

  const handleSubmit = async () => {
    const payload = items.map((item) => ({
      quote_item_id: item.quote_item_id,
      unit_price: revisedPrices[item.quote_item_id]?.unit_price || 0,
      total_price: revisedPrices[item.quote_item_id]?.total_price || 0,
    }));

    setIsSubmitting(true);
    try {
      await onSubmit(payload);
      setRevisedPrices({});
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalProfitability = calculateTotalProfitability();

  const isBusy = isSubmitting || loading;

  return (
    <div className="rsm-overlay">
      <div className="rsm-modal">
        <h2 className="rsm-title">Revize Teklif Gönder</h2>

        <div className="rsm-supplier-box">
          <p>
            <strong>Tedarikçi:</strong> {supplierQuoteName}
          </p>
        </div>

        <div className="rsm-table-wrap">
          <table className="rsm-table">
            <thead>
              <tr>
                <th>Kalem</th>
                <th>İlk Birim Fiyat</th>
                <th>Revize Birim Fiyat</th>
                <th>İlk Toplam</th>
                <th>Revize Toplam</th>
                <th>Tasarruf</th>
              </tr>
            </thead>
            <tbody>
              {items?.map((item) => {
                if (!item) return null;
                const revised = revisedPrices[item.quote_item_id];
                const savings = (item.original_total_price || 0) - (revised?.total_price || 0);
                const savingsColor = savings > 0 ? "#10b981" : savings < 0 ? "#ef4444" : "#666";

                return (
                  <tr key={item.quote_item_id}>
                    <td>{item.item_description}</td>
                    <td className="rsm-td--right">
                      ₺{item.original_unit_price.toLocaleString("tr-TR", { maximumFractionDigits: 2 })}
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        value={revised?.unit_price || 0}
                        onChange={(e) => handleUnitPriceChange(item.quote_item_id, parseFloat(e.target.value) || 0)}
                        className="rsm-price-input"
                      />
                    </td>
                    <td className="rsm-td--right">
                      ₺{item.original_total_price.toLocaleString("tr-TR", { maximumFractionDigits: 2 })}
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        value={revised?.total_price || 0}
                        onChange={(e) => handleTotalPriceChange(item.quote_item_id, parseFloat(e.target.value) || 0)}
                        className="rsm-price-input"
                      />
                    </td>
                    <td
                      className="rsm-savings-cell"
                      style={{ "--rsm-savings-color": savingsColor } as CSSProperties}
                    >
                      {savings > 0 ? "+" : ""}₺{savings.toLocaleString("tr-TR", { maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className={`rsm-total-box${totalProfitability > 0 ? " rsm-total-box--positive" : ""}`}>
          <span className={`rsm-total-amount${totalProfitability > 0 ? " rsm-total-amount--positive" : ""}`}>
            Toplam Tasarruf: {totalProfitability > 0 ? "+" : ""}₺
            {Math.abs(totalProfitability).toLocaleString("tr-TR", { maximumFractionDigits: 2 })}
          </span>
        </div>

        <div className="rsm-footer">
          <button onClick={onClose} disabled={isBusy} className="rsm-cancel-btn">
            İptal
          </button>
          <button
            onClick={handleSubmit}
            disabled={isBusy}
            className={`rsm-submit-btn${isBusy ? " rsm-submit-btn--busy" : ""}`}
          >
            {isBusy ? "Gönderiliyor..." : "Revize Teklif Gönder"}
          </button>
        </div>
      </div>
    </div>
  );
}
