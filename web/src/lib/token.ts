// FILE: web\src\lib\token.ts
const ACCESS_TOKEN_KEY = "pf_access_token";
const REFRESH_TOKEN_KEY = "refresh_token";

function readWithLegacyFallback(key: string): string | null {
  const sessionValue = sessionStorage.getItem(key);
  if (sessionValue) return sessionValue;

  const legacyValue = localStorage.getItem(key);
  if (!legacyValue) return null;

  // Legacy localStorage'dan sessionStorage'a tek seferlik taşıma.
  sessionStorage.setItem(key, legacyValue);
  localStorage.removeItem(key);
  return legacyValue;
}

export function getAccessToken(): string | null {
  return readWithLegacyFallback(ACCESS_TOKEN_KEY);
}

export function setAccessToken(token: string) {
  sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function getRefreshToken(): string | null {
  return readWithLegacyFallback(REFRESH_TOKEN_KEY);
}

export function setRefreshToken(token: string) {
  sessionStorage.setItem(REFRESH_TOKEN_KEY, token);
}

export function clearRefreshToken() {
  sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function clearAccessToken() {
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  clearRefreshToken();
}
