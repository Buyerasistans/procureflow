export type SegmentKey = "platform" | "strategic" | "supplier" | "channel" | "employer" | "seeker";

export const SEGMENT_META: Record<SegmentKey, { label: string; color: string; bg: string }> = {
  platform:  { label: "Platform",          color: "#3A4F86", bg: "#eef1f8" },
  strategic: { label: "Stratejik Partner", color: "#134E37", bg: "#ecfdf5" },
  supplier:  { label: "Tedarikçi",         color: "#0E7490", bg: "#ecfeff" },
  channel:   { label: "İş Ortağı",         color: "#7C2D12", bg: "#fff7ed" },
  employer:  { label: "Personel Arayan",   color: "#5B21B6", bg: "#fdf4ff" },
  seeker:    { label: "İş Arayan",         color: "#9F1239", bg: "#fff1f3" },
};
