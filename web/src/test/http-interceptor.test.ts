// FILE: web/src/test/http-interceptor.test.ts
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import MockAdapter from "axios-mock-adapter";
import { http } from "../lib/http";
import * as sessionLib from "../lib/session";

describe("http interceptor", () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(http);
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    mock.restore();
  });

  test("401 + auth dışı endpoint -> token temizlenir ve istek reject olur", async () => {
    const clearSpy = vi.spyOn(sessionLib, "clearToken").mockImplementation(() => {});
    mock.onGet("/quotes").reply(401);

    await expect(http.get("/quotes")).rejects.toBeTruthy();
    expect(clearSpy).toHaveBeenCalledTimes(1);
  });

  test("401 + /auth/login endpoint -> token temizlenir ve istek reject olur", async () => {
    const clearSpy = vi.spyOn(sessionLib, "clearToken").mockImplementation(() => {});
    mock.onPost("/auth/login").reply(401);

    await expect(http.post("/auth/login", { email: "a", password: "b" })).rejects.toBeTruthy();
    expect(clearSpy).toHaveBeenCalledTimes(1);
  });
});
