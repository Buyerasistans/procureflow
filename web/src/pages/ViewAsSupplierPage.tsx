import { useEffect } from "react";

// Opened by PersonnelTab "Paneli Aç" for supplier users.
// Reads supplier token from URL hash, stores as supplier_access_token,
// then hard-redirects to /supplier/dashboard.
export default function ViewAsSupplierPage() {
  useEffect(() => {
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.slice(1));
    const token = params.get("t");

    if (!token) {
      window.location.replace("/login");
      return;
    }

    sessionStorage.setItem("supplier_access_token", token);
    window.location.replace("/supplier/dashboard");
  }, []);

  return (
    <div style={{ padding: 20, textAlign: "center", color: "#64748b", fontSize: 14 }}>
      Tedarikçi paneli yükleniyor...
    </div>
  );
}
