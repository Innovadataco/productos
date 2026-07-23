import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import bcrypt from "bcryptjs";

// FR-002 (spec 002): la suite no abre conexión a PostgreSQL.
vi.mock("@/lib/prisma", async () => {
  const { createPrismaMock } = await import("@/test/prismaMock");
  return { prisma: createPrismaMock() };
});

import { prisma } from "@/lib/prisma";
import { POST } from "./route";

const CREDENCIALES = { username: "testuser", password: "testpass123" };

let usuarioFixture: {
  id: string;
  username: string;
  password: string;
  role: string;
};

function peticionLogin(body: unknown) {
  return new Request("http://localhost:5001/api/auth/login", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  }) as never;
}

describe("POST /api/auth/login", () => {
  beforeAll(async () => {
    usuarioFixture = {
      id: "usr_test_1",
      username: CREDENCIALES.username,
      password: await bcrypt.hash(CREDENCIALES.password, 10),
      role: "admin",
    };
  });

  beforeEach(() => {
    vi.mocked(prisma.user.findUnique).mockReset();
  });

  it("debe retornar 401 cuando el usuario no existe", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const res = await POST(peticionLogin({ username: "invalid", password: "invalid" }));

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Credenciales inválidas" });
  });

  it("debe retornar 401 cuando la contraseña no coincide", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(usuarioFixture as never);

    const res = await POST(
      peticionLogin({ username: CREDENCIALES.username, password: "contraseña-incorrecta" }),
    );

    expect(res.status).toBe(401);
  });

  it("debe retornar 200 con cookie token para credenciales válidas", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(usuarioFixture as never);

    const res = await POST(peticionLogin(CREDENCIALES));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });

    const cookie = res.cookies.get("token");
    expect(cookie?.value).toBeTruthy();
    expect(cookie?.httpOnly).toBe(true);
  });
});
