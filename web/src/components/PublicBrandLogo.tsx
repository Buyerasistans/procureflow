import "./PublicBrandLogo.css";

type PublicBrandLogoProps = {
  height?: number;
  maxWidth?: number;
  invert?: boolean;
  marginBottom?: number;
};

export const PUBLIC_BRAND_LOGO_SRC = "/brand/buyer-logo-custom.svg?v=20260505";
export const PUBLIC_BRAND_LOGO_VARIANT = "buyer-logo-custom.svg";

function getPublicBrandLogoSizeClass(prefix: "h" | "mw" | "mb", value: number | undefined): string {
  if (value == null) return "";
  return `public-brand-logo--${prefix}${value}`;
}

export default function PublicBrandLogo({
  height = 36,
  maxWidth = 160,
  invert = false,
  marginBottom,
}: PublicBrandLogoProps) {
  const className = [
    "public-brand-logo",
    getPublicBrandLogoSizeClass("h", height),
    getPublicBrandLogoSizeClass("mw", maxWidth),
    getPublicBrandLogoSizeClass("mb", marginBottom),
    invert ? "public-brand-logo--invert" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return <img src={PUBLIC_BRAND_LOGO_SRC} alt="BUYER ASISTANS" className={className} />;
}
