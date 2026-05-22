export const COMPANY_CATEGORY_OPTIONS = [
  "Yazilim",
  "Donanim",
  "Hizmet",
  "Danismanlik",
  "Muhasebe",
  "Insan Kaynaklari",
  "Lojistik",
  "Insaat",
  "Enerji",
  "Saglik",
  "Uretim",
  "Pazarlama",
  "Finans",
  "Egitim",
  "Guvenlik",
  "Telekomunikasyon",
  "Bakim Onarim",
  "Diger",
] as const;

export type CompanyCategoryOption = (typeof COMPANY_CATEGORY_OPTIONS)[number];