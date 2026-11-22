// Respuestas de las rutas de escritura del área de edición (fase B, PR-B): Origin de la lista (CSRF) antes que todo,
// cuerpo JSON acotado, y cada error del dominio con su estado HTTP y su código, con un mensaje genérico y nunca un
// valor. Al registro, solo el nombre del error y el código de Prisma. Puro (sin base). Datos inventados.
import { Prisma } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ORIGENES_DESARROLLO } from "@/auth/origen";
import { MENSAJE_SOLO_LECTURA } from "@/auth/respuestas";
import {
  ESTADO_POR_CODIGO,
  MENSAJE_CONFLICTO,
  MENSAJE_FALLO,
  MENSAJE_INVALIDO,
  MENSAJE_SOLICITUD,
  leerCuerpoJson,
  origenRechazado,
  respuestaCreada,
  respuestaDeError,
  respuestaInvalida,
} from "@/plan/edicion/http";
import { ErrorPlan } from "@/plan/errores";

const ORIGEN = ORIGENES_DESARROLLO[0]!;
const pedido = (cuerpo: string, cabeceras: Record<string, string> = {}) =>
  new Request(`${ORIGEN}/api/decisiones`, { method: "POST", headers: { "content-type": "application/json", origin: ORIGEN, ...cabeceras }, body: cuerpo });

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("origenRechazado", () => {
  it("el origen de la lista pasa; otro, ninguno o un Sec-Fetch-Site ajeno dan 403 sin caché", async () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(origenRechazado(pedido("{}"))).toBeNull();
    for (const cabeceras of [{ origin: "https://otro.ejemplo.invalid" }, { origin: "null" }, { "sec-fetch-site": "cross-site" }]) {
      const r = origenRechazado(pedido("{}", cabeceras));
      expect(r?.status).toBe(403);
      expect(r?.headers.get("cache-control")).toBe("no-store");
    }
    const sin = new Request(`${ORIGEN}/api/decisiones`, { method: "POST", body: "{}" });
    expect(origenRechazado(sin)?.status).toBe(403);
  });

  it("en producción sin APP_ORIGEN válida no pasa nada: 503 (falla cerrada)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_ORIGEN", "");
    const r = origenRechazado(pedido("{}"));
    expect(r?.status).toBe(503);
  });
});

describe("leerCuerpoJson", () => {
  it("solo JSON y hasta el tope: lo demás es inválido sin leerlo entero", async () => {
    expect(await leerCuerpoJson(pedido('{"a":1}'), 64)).toEqual({ ok: true, valor: { a: 1 } });
    expect(await leerCuerpoJson(pedido('{"a":1}', { "content-type": "text/plain" }), 64)).toEqual({ ok: false });
    expect(await leerCuerpoJson(pedido(`{"a":"${"x".repeat(80)}"}`), 64)).toEqual({ ok: false });
    expect(await leerCuerpoJson(pedido("{no es json"), 64)).toEqual({ ok: false });
  });
});

describe("respuestas", () => {
  it("201 con el cuerpo y sin caché", async () => {
    const r = respuestaCreada({ id: "decision-ficticia" });
    expect(r.status).toBe(201);
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(await r.json()).toEqual({ id: "decision-ficticia" });
  });

  it("400 con los campos y sus códigos, nunca un valor", async () => {
    const r = respuestaInvalida([{ campo: "reglas[2].nivel", codigo: "NIVEL_NO_RECONOCIDO" }]);
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ error: MENSAJE_INVALIDO, codigo: "DATOS_INVALIDOS", campos: [{ campo: "reglas[2].nivel", codigo: "NIVEL_NO_RECONOCIDO" }] });
  });

  it("un ErrorPlan sale con su estado y su código; sus campos, si los trae", async () => {
    const casos: readonly (readonly [ErrorPlan, number, string])[] = [
      [new ErrorPlan("DATOS_INVALIDOS", [{ campo: "motivo", codigo: "VACIO" }]), 400, MENSAJE_INVALIDO],
      [new ErrorPlan("REGLA_DE_OTRA_ESPECIE", [{ campo: "reglaId", codigo: "REGLA_DE_OTRA_ESPECIE" }]), 400, MENSAJE_INVALIDO],
      [new ErrorPlan("PLAN_CAMBIO"), 409, MENSAJE_CONFLICTO],
      [new ErrorPlan("VIGENCIA_RETROCEDE"), 409, MENSAJE_CONFLICTO],
      [new ErrorPlan("ORDEN_YA_ENLAZADA"), 409, MENSAJE_CONFLICTO],
      [new ErrorPlan("DECISION_YA_REEMPLAZADA"), 409, MENSAJE_CONFLICTO],
      [new ErrorPlan("AUTOR_NO_AUTORIZADO"), 403, MENSAJE_SOLO_LECTURA],
    ];
    for (const [error, estado, mensaje] of casos) {
      const r = respuestaDeError(error, "prueba");
      expect(r.status, error.codigo).toBe(estado);
      expect(r.headers.get("cache-control")).toBe("no-store");
      expect(await r.json()).toEqual({ error: mensaje, codigo: error.codigo, campos: error.errores });
    }
  });

  it("un código del dominio sin estado propio es un 400 (no un 500): lo pidió mal el formulario", async () => {
    expect(ESTADO_POR_CODIGO["CODIGO_QUE_NO_EXISTE"]).toBeUndefined();
    const r = respuestaDeError(new ErrorPlan("CODIGO_QUE_NO_EXISTE"), "prueba");
    expect(r.status).toBe(400);
  });

  it("cualquier otro error: 500 genérico; al registro, solo su nombre y el código de Prisma (nunca el mensaje ni el meta)", async () => {
    const registro = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const prisma = new Prisma.PrismaClientKnownRequestError("Unique constraint failed on valor-real-4613", { code: "P2002", clientVersion: "5.22.0", meta: { target: ["valor-real-4613"] } });
    for (const error of [prisma, new TypeError("valor-real-4613"), "texto suelto"]) {
      const r = respuestaDeError(error, "decisiones");
      expect(r.status).toBe(500);
      expect(await r.json()).toEqual({ error: MENSAJE_FALLO });
    }
    const escrito = registro.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(escrito).toContain("[edicion:decisiones]");
    expect(escrito).toContain("PrismaClientKnownRequestError");
    expect(escrito).toContain("P2002");
    expect(escrito).toContain("TypeError");
    expect(escrito).not.toContain("valor-real-4613");
  });

  it("el mensaje de una solicitud ilegible es genérico", () => {
    expect(MENSAJE_SOLICITUD).toMatch(/^[A-ZÁÉÍÓÚ]/);
  });
});
