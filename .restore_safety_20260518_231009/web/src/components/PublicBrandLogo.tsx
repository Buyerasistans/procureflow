type PublicBrandLogoProps = {
  height?: number;
  maxWidth?: number;
  invert?: boolean;
};

export default function PublicBrandLogo({ height = 32, maxWidth = 180, invert = false }: PublicBrandLogoProps) {
  return (
    <div
      style={{
        height,
        maxWidth,
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        color: invert ? "#ffffff" : "#0f172a",
        fontWeight: 900,
        letterSpacing: 0,
        whiteSpace: "nowrap",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: Math.max(24, Math.round(height * 0.78)),
          height: Math.max(24, Math.round(height * 0.78)),
          borderRadius: 8,
          background: invert ? "#ffffff" : "#0284c7",
          color: invert ? "#0284c7" : "#ffffff",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: Math.max(12, Math.round(height * 0.34)),
          fontWeight: 900,
        }}
      >
        PF
      </span>
      <span style={{ fontSize: Math.max(14, Math.round(height * 0.47)), overflow: "hidden", textOverflow: "ellipsis" }}>
        ProcureFlow
      </span>
    </div>
  );
}
