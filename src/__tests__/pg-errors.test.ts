import { describe, it, expect } from "vitest";
import { isUniqueViolation } from "@/lib/pg-errors";

describe("isUniqueViolation", () => {
  it("reconnaît une violation UNIQUE (SQLSTATE 23505)", () => {
    expect(isUniqueViolation({ code: "23505" })).toBe(true);
  });

  it("rejette un autre code Postgres (ex. clé étrangère 23503)", () => {
    expect(isUniqueViolation({ code: "23503" })).toBe(false);
  });

  it("rejette ce qui n'a pas de code (null, undefined, string, objet nu)", () => {
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation(undefined)).toBe(false);
    expect(isUniqueViolation("23505")).toBe(false);
    expect(isUniqueViolation({})).toBe(false);
    expect(isUniqueViolation(new Error("boom"))).toBe(false);
  });
});
