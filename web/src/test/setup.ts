// FILE: web/src/test/setup.ts
import "@testing-library/jest-dom/vitest";
import { configure } from "@testing-library/react";

configure({ asyncUtilTimeout: 10000 });

const originalError = console.error;

console.error = (...args: unknown[]) => {
  const first = args[0];
  if (
    typeof first === "string" &&
    first.includes("Not implemented: navigation to another Document")
  ) {
    return;
  }
  originalError(...args);
};
