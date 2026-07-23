import { describe, it, expect } from "vitest";
import { POST } from "./route";

describe("POST /api/auth/logout", () => {
  it("responde 200 y limpia la cookie de sesión", async () => {
    const res = await POST();

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });

    const cookie = res.cookies.get("token");
    // La cookie se invalida: valor vacío y/o maxAge 0.
    expect(cookie?.value === "" || cookie?.maxAge === 0).toBe(true);
  });
});
