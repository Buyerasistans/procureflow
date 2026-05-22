// FILE: web\src\lib\session.ts
const ACCESS_KEY = "pf_access_token";
const LEGACY_ACCESS_KEY = "access_token";
const REFRESH_KEY = "refresh_token";
const SUPPLIER_ACCESS_KEY = "supplier_access_token";

function readWithLegacyFallback(key: string): string | null {
  const sessionValue = sessionStorage.getItem(key);
  if (sessionValue) return sessionValue;

  const legacyValue = localStorage.getItem(key);
  if (!legacyValue) return null;

  sessionStorage.setItem(key, legacyValue);
  localStorage.removeItem(key);
  return legacyValue;
}

export function setTokens(accessToken: string, refreshToken: string) {
  sessionStorage.setItem(ACCESS_KEY, accessToken);
  sessionStorage.setItem(REFRESH_KEY, refreshToken);
}

export function getToken() {
  // Tedarikçi token'ı varsa onu döndür
  const supplierToken = readWithLegacyFallback(SUPPLIER_ACCESS_KEY);
  if (supplierToken) return supplierToken;

  // Yoksa admin token'ı döndür
  return readWithLegacyFallback(ACCESS_KEY) || readWithLegacyFallback(LEGACY_ACCESS_KEY);
}

export function getRefreshToken() {
  return readWithLegacyFallback(REFRESH_KEY);
}

export function setAccessToken(accessToken: string) {
  sessionStorage.setItem(ACCESS_KEY, accessToken);
}

export function setSupplierAccessToken(accessToken: string) {
  sessionStorage.setItem(SUPPLIER_ACCESS_KEY, accessToken);
}

export function getSupplierAccessToken() {
  return readWithLegacyFallback(SUPPLIER_ACCESS_KEY);
}

export function isSupplierLoggedIn() {
  return !!readWithLegacyFallback(SUPPLIER_ACCESS_KEY);
}

export function isSupplierRoute(pathname: string | null | undefined) {
  return String(pathname || "").includes("/supplier/");
}

export function shouldUseSupplierSession(pathname: string | null | undefined) {
  const normalizedPath = String(pathname || "");
  return isSupplierRoute(normalizedPath) || (normalizedPath === "/" && isSupplierLoggedIn());
}

export function clearToken() {
  sessionStorage.removeItem(ACCESS_KEY);
  sessionStorage.removeItem(LEGACY_ACCESS_KEY);
  sessionStorage.removeItem(REFRESH_KEY);
  sessionStorage.removeItem(SUPPLIER_ACCESS_KEY);
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(LEGACY_ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(SUPPLIER_ACCESS_KEY);
}

export function clearSupplierToken() {
  sessionStorage.removeItem(SUPPLIER_ACCESS_KEY);
  localStorage.removeItem(SUPPLIER_ACCESS_KEY);
}
