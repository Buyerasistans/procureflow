// FILE: web\src\services\api.ts
import axios from "axios";
import type { InternalAxiosRequestConfig } from "axios";
import { clearToken, getToken, isSupplierLoggedIn } from "../lib/session";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
    // Request'te token tipini debug için ekle
    config.headers["X-Token-Type"] = isSupplierLoggedIn() ? "supplier" : "admin";
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      const wasSupplier = isSupplierLoggedIn();
      clearToken();

      // Tedarikçi ise /supplier/login'e, admin ise /login'e yönlendir
      if (wasSupplier) {
        if (window.location.pathname !== "/supplier/login") {
          window.location.href = "/supplier/login";
        }
      } else {
        if (window.location.pathname !== "/login") {
          window.location.href = "/login";
        }
      }
    }

    return Promise.reject(error);
  }
);

export default api;
