import "./PublicBrandLogo.css";

type PublicBrandLogoProps = {
  height?: number;
  maxWidth?: number;
  invert?: boolean;
  marginBottom?: number;
};

export const PUBLIC_BRAND_LOGO_SRC      = "/brand/buyer-logo-custom.svg?v=20260505";
export const PUBLIC_BRAND_LOGO_DARK_SRC = "/brand/buyer-logo-dark.svg?v=20260603";
export const PUBLIC_BRAND_LOGO_VARIANT  = "buyer-logo-custom.svg";

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
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <img
      src={invert ? PUBLIC_BRAND_LOGO_DARK_SRC : PUBLIC_BRAND_LOGO_SRC}
      alt="BUYER ASISTANS"
      className={className}
      style={{
        height: height != null ? `${height}px` : undefined,
        maxWidth: maxWidth != null ? `${maxWidth}px` : undefined,
      }}
    />
  );
}
