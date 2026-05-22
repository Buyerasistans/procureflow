// FILE: web\src\main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./styles/tokens.css";
import "./index.css";
import App from "./App";
import { AuthProvider } from "./context/AuthProvider";
import { SettingsProvider } from "./context/SettingsProvider";
import { ProfileProvider } from "./context/ProfileProvider";
import { LocaleProvider } from "./context/LocaleContext";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <LocaleProvider>
        <AuthProvider>
          <SettingsProvider>
            <ProfileProvider>
              <App />
            </ProfileProvider>
          </SettingsProvider>
        </AuthProvider>
      </LocaleProvider>
    </BrowserRouter>
  </React.StrictMode>
);
