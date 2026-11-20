import { APICallError } from "ai";
import { maskIds } from "../checklist";

export function aiErrorDetails(error: unknown): Record<string, unknown> {
  const seen = new Set<unknown>();
  function details(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || seen.has(value))
      return { message: maskIds(String(value)).text };
    seen.add(value);
    const e = value as {
      statusCode?: number;
      name?: string;
      message?: string;
      cause?: unknown;
      responseBody?: string;
      isRetryable?: boolean;
    };
    const cause = e.cause ? details(e.cause) : undefined;
    return {
      statusCode: e.statusCode ?? cause?.["statusCode"],
      name: e.name,
      message: maskIds(e.message ?? "Unknown AI error").text,
      ...(APICallError.isInstance(value)
        ? {
            isRetryable: value.isRetryable,
            responseBody: maskIds(value.responseBody ?? "").text,
          }
        : {}),
      ...(cause ? { cause } : {}),
    };
  }
  return details(error);
}
