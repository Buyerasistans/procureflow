type PublicBrandLogoProps = {
  height?: number;
  maxWidth?: number;
  invert?: boolean;
  marginBottom?: number;
};

export const PUBLIC_BRAND_LOGO_SRC = "/brand/buyer-logo-custom.svg?v=20260505";
export const PUBLIC_BRAND_LOGO_VARIANT = "buyer-logo-custom.svg";

export default function PublicBrandLogo({
  height = 36,
  maxWidth = 160,
  invert = false,
  marginBottom,
}: PublicBrandLogoProps) {
  return (
    <img
      src={PUBLIC_BRAND_LOGO_SRC}
      alt="BUYER ASISTANS"
      style={{
        height,
        maxWidth,
        marginBottom,
        filter: invert ? "brightness(0) invert(1)" : undefined,
      }}
    />
  );
}
