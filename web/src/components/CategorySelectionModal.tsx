import { useMemo, useState } from "react";
import "./CategorySelectionModal.css";

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
    <div className="category-selection-modal__backdrop" onClick={onClose}>
      <div className="category-selection-modal__panel" onClick={(event) => event.stopPropagation()}>
        <div className="category-selection-modal__header">
          <div>
            <div className="category-selection-modal__title">{title}</div>
            {subtitle ? <div className="category-selection-modal__subtitle">{subtitle}</div> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="category-selection-modal__close-button"
          >
            ×
          </button>
        </div>

        <div className="category-selection-modal__option-list">
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
                className={`category-selection-modal__option ${active ? "category-selection-modal__option--active" : ""}`}
              >
                {option}
              </button>
            );
          })}
        </div>

        <div className="category-selection-modal__custom-section">
          <div className="category-selection-modal__section-title">Listede yoksa ek kategori</div>
          <textarea
            value={customValue}
            onChange={(event) => setCustomValue(event.target.value)}
            placeholder="Kategori adlarını virgülle yazın"
            rows={4}
            className="category-selection-modal__custom-input"
          />
          <div className="category-selection-modal__summary">
            {typeof maxSelectionCount === "number"
              ? `${combinedSelection.length} / ${maxSelectionCount} kategori seçildi`
              : `${combinedSelection.length} kategori seçildi`}
          </div>
          {selectionLimitReached ? (
            <div className="category-selection-modal__warning">
              Maksimum kategori sınırına ulaşıldı.
            </div>
          ) : null}
        </div>

        <div className="category-selection-modal__chips">
          {combinedSelection.map((item) => (
            <span key={item} className="category-selection-modal__chip">
              {item}
            </span>
          ))}
          {combinedSelection.length === 0 ? (
            <span className="category-selection-modal__empty-chip">Henüz kategori seçilmedi</span>
          ) : null}
        </div>

        <div className="category-selection-modal__footer">
          <button
            type="button"
            onClick={onClose}
            className="category-selection-modal__button category-selection-modal__button--cancel"
          >
            İptal
          </button>
          <button
            type="button"
            onClick={() => onSave(combinedSelection)}
            className="category-selection-modal__button category-selection-modal__button--save"
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
