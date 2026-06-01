import { useEffect } from "react";
import "./ViewAsPage.css";

// Opened by PersonnelTab "Paneli Aç" — impersonation tab.
// Reads token + user from URL hash, stores in this tab's sessionStorage,
// then hard-redirects to /admin. Hard redirect (not React navigate) is required so
// AuthProvider boots fresh and finds the token already in sessionStorage.
export default function ViewAsPage() {
  useEffect(() => {
    const hash = window.location.hash; // #t=TOKEN&u=BASE64_USER&n=DISPLAY_NAME
    const params = new URLSearchParams(hash.slice(1));
    const token = params.get("t");
    const userRaw = params.get("u");
    const displayName = params.get("n");

    if (!token) {
      window.location.replace("/login");
      return;
    }

    sessionStorage.setItem("pf_access_token", token);
    sessionStorage.setItem("pf_is_impersonation", "1");

    if (displayName) {
      sessionStorage.setItem("pf_impersonated_name", decodeURIComponent(displayName));
    }

    if (userRaw) {
      try {
        const user = JSON.parse(decodeURIComponent(atob(userRaw)));
        sessionStorage.setItem("pf_user", JSON.stringify(user));
      } catch {
        // AuthProvider will fetch /me with the token — still works
      }
    }

    window.location.replace("/admin");
  }, []);

  return (
    <div className="view-as-loading">
      Panel yükleniyor...
    </div>
  );
}
