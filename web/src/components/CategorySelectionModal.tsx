import { useMemo, useState } from "react";

type Props = {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  availableOptions: readonly string[];
  value: string[];
  maxSelectionCount?: number;
  onClose: () => void;
  onSave: (value: string[]) => void;
};

function normalizeCategoryTags(values: string[]): string[] {
  const normalized: string[] = [];
  const seen = new Set<string>();
  values.forEach((item) => {
    const text = String(item || "").trim();
    if (!text) return;
    const key = text.toLocaleLowerCase("tr-TR");
    if (seen.has(key)) return;
    seen.add(key);
    normalized.push(text);
  });
  return normalized;
}

type ModalBodyProps = {
  title: string;
  subtitle?: string;
  availableOptions: readonly string[];
  maxSelectionCount?: number;
  onClose: () => void;
  onSave: (value: string[]) => void;
  initialSelectedOptions: string[];
  initialCustomValue: string;
  selectionKey: string;
};

function CategorySelectionModalBody({
  title,
  subtitle,
  availableOptions,
  maxSelectionCount,
  onClose,
  onSave,
  initialSelectedOptions,
  initialCustomValue,
}: ModalBodyProps) {
  const [selectedOptions, setSelectedOptions] = useState<string[]>(initialSelectedOptions);
  const [customValue, setCustomValue] = useState(initialCustomValue);

  const normalizedCustomTags = useMemo(
    () => normalizeCategoryTags(customValue.split(",")),
    [customValue],
  );

  const combinedSelection = useMemo(
    () => normalizeCategoryTags([...selectedOptions, ...normalizedCustomTags]),
    [normalizedCustomTags, selectedOptions],
  );

  const selectionLimitReached =
    typeof maxSelectionCount === "number" && combinedSelection.length >= maxSelectionCount;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1600,
        padding: 16,
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "min(760px, 100%)",
          background: "#fff",
          borderRadius: 20,
          border: "1px solid #dbe3ee",
          boxShadow: "0 24px 70px rgba(15,23,42,0.24)",
          padding: 20,
          display: "grid",
          gap: 16,
          maxHeight: "85vh",
          overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#0f172a" }}>{title}</div>
            {subtitle ? <div style={{ marginTop: 6, color: "#64748b", fontSize: 13 }}>{subtitle}</div> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ border: "none", background: "#f8fafc", borderRadius: 999, width: 36, height: 36, cursor: "pointer", fontSize: 20 }}
          >
            ×
          </button>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {availableOptions.map((option) => {
            const active = selectedOptions.includes(option);
            return (
              <button
                key={option}
                type="button"
                onClick={() => {
                  if (active) {
                    setSelectedOptions((prev) => prev.filter((item) => item !== option));
                    return;
                  }
                  if (typeof maxSelectionCount === "number" && combinedSelection.length >= maxSelectionCount) {
                    return;
                  }
                  setSelectedOptions((prev) => [...prev, option]);
                }}
                style={{
                  border: active ? "1px solid #2563eb" : "1px solid #cbd5e1",
                  background: active ? "#eff6ff" : "#fff",
                  color: active ? "#1d4ed8" : "#334155",
                  borderRadius: 999,
                  padding: "8px 12px",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                {option}
              </button>
            );
          })}
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", color: "#475569" }}>Listede yoksa ek kategori</div>
          <textarea
            value={customValue}
            onChange={(event) => setCustomValue(event.target.value)}
            placeholder="Kategori adlarını virgülle yazın"
            rows={4}
            style={{
              border: "1px solid #cbd5e1",
              borderRadius: 14,
              padding: 12,
              fontSize: 14,
              resize: "vertical",
              minHeight: 110,
            }}
          />
          <div style={{ color: "#64748b", fontSize: 12 }}>
            {typeof maxSelectionCount === "number"
              ? `${combinedSelection.length} / ${maxSelectionCount} kategori seçildi`
              : `${combinedSelection.length} kategori seçildi`}
          </div>
          {selectionLimitReached ? (
            <div style={{ color: "#b45309", fontSize: 12, fontWeight: 700 }}>
              Maksimum kategori sınırına ulaşıldı.
            </div>
          ) : null}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {combinedSelection.map((item) => (
            <span
              key={item}
              style={{
                display: "inline-flex",
                padding: "6px 10px",
                borderRadius: 999,
                background: "#ecfeff",
                color: "#0f766e",
                fontWeight: 700,
                fontSize: 12,
              }}
            >
              {item}
            </span>
          ))}
          {combinedSelection.length === 0 ? <span style={{ color: "#94a3b8", fontSize: 12 }}>Henüz kategori seçilmedi</span> : null}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button
            type="button"
            onClick={onClose}
            style={{ border: "1px solid #cbd5e1", background: "#fff", borderRadius: 12, padding: "10px 14px", fontWeight: 700, cursor: "pointer" }}
          >
            İptal
          </button>
          <button
            type="button"
            onClick={() => onSave(combinedSelection)}
            style={{ border: "none", background: "#2563eb", color: "#fff", borderRadius: 12, padding: "10px 16px", fontWeight: 800, cursor: "pointer" }}
          >
            Kategorileri Kaydet
          </button>
        </div>
      </div>
    </div>
  );
}

export function CategorySelectionModal({
  isOpen,
  title,
  subtitle,
  availableOptions,
  value,
  maxSelectionCount,
  onClose,
  onSave,
}: Props) {
  const standardOptionSet = useMemo(() => new Set(availableOptions), [availableOptions]);

  const normalizedValue = useMemo(() => normalizeCategoryTags(value), [value]);
  const initialSelectedOptions = useMemo(
    () => normalizedValue.filter((item) => standardOptionSet.has(item)),
    [normalizedValue, standardOptionSet],
  );
  const initialCustomValue = useMemo(
    () => normalizedValue.filter((item) => !standardOptionSet.has(item)).join(", "),
    [normalizedValue, standardOptionSet],
  );

  if (!isOpen) return null;

  const selectionKey = [initialSelectedOptions.join("|"), initialCustomValue].join("::");

  return (
    <CategorySelectionModalBody
      key={selectionKey}
      title={title}
      subtitle={subtitle}
      availableOptions={availableOptions}
      maxSelectionCount={maxSelectionCount}
      onClose={onClose}
      onSave={onSave}
      initialSelectedOptions={initialSelectedOptions}
      initialCustomValue={initialCustomValue}
      selectionKey={selectionKey}
    />
  );
}
