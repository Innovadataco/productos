import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getCorreo } from "./correo";

const KEY = "RESEND_API_KEY";
const REM = "CORREO_REMITENTE";

describe("factory de correo (D-048)", () => {
  const original = { key: process.env[KEY], rem: process.env[REM] };

  afterEach(() => {
    if (original.key === undefined) delete process.env[KEY];
    else process.env[KEY] = original.key;
    if (original.rem === undefined) delete process.env[REM];
    else process.env[REM] = original.rem;
    vi.restoreAllMocks();
  });

  it("SIN RESEND_API_KEY → adaptador stub (los flujos completan)", async () => {
    delete process.env[KEY];
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const r = await getCorreo().enviarCorreo({ para: "a@b.com", asunto: "Alta", texto: "Clave: Sic0v!" });
    expect(r).toMatchObject({ ok: true, modo: "stub" });
    // El stub NUNCA loguea el texto (que lleva la clave temporal).
    const logueado = spy.mock.calls.flat().join(" ");
    expect(logueado).not.toContain("Sic0v!");
    expect(logueado).toContain("asunto=Alta");
  });

  it("CON RESEND_API_KEY → adaptador Resend (modo resend)", async () => {
    process.env[KEY] = "re_test_123";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "email_abc" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const r = await getCorreo().enviarCorreo({ para: "a@b.com", asunto: "Alta", texto: "x" });
    expect(r).toMatchObject({ ok: true, modo: "resend", id: "email_abc" });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init as RequestInit).headers).toMatchObject({ Authorization: "Bearer re_test_123" });
  });
});

describe("adaptador Resend — errores (US3)", () => {
  beforeEach(() => {
    process.env[KEY] = "re_test_err";
  });
  afterEach(() => {
    delete process.env[KEY];
    vi.restoreAllMocks();
  });

  it("status no-ok → ok:false sin exponer la key ni la clave", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 422, json: async () => ({}) }));
    const r = await getCorreo().enviarCorreo({ para: "a@b.com", asunto: "x", texto: "Sic0v-secreta!" });
    expect(r.ok).toBe(false);
    expect(r.error).toContain("422");
    expect(r.error).not.toContain("re_test_err");
    expect(r.error).not.toContain("Sic0v-secreta!");
  });

  it("fetch lanza (red caída) → ok:false, no propaga la excepción", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));
    const r = await getCorreo().enviarCorreo({ para: "a@b.com", asunto: "x", texto: "y" });
    expect(r.ok).toBe(false);
    expect(r.modo).toBe("resend");
  });
});
