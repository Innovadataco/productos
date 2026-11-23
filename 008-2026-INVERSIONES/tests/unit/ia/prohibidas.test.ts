/**
 * Claves prohibidas en un paquete de hechos y en su vista: datos de la persona y de sus cuentas, filas crudas, texto
 * libre de reglas y decisiones, acción y cantidad, y lo que nombra una especie. Ningún campo del contrato cae.
 */
import { describe, expect, it } from "vitest";
import { CAMPOS_HECHO_CIEGO } from "@/ia/contrato";
import { CLAVES_PROHIBIDAS, clavesProhibidasEn, esClaveProhibida, normalizarClave } from "@/ia/prohibidas";

/** Los nombres de campo del contrato (paquete, hecho y vista). */
const CAMPOS_DEL_CONTRATO = [
  "version", "tipo", "hoy", "versionesCalculo", "avisos", "hechos", "hash", "id", "clave", "sujeto", "valor", "unidad", "presentacion",
  "etiqueta", "fuente", "fecha", "calidad", "direccion", "cercania", "frescura", "obligatorio",
];

describe("claves prohibidas", () => {
  it("la lista está congelada y cubre cada concepto prohibido", () => {
    expect(Object.isFrozen(CLAVES_PROHIBIDAS)).toBe(true);
    const conceptos = {
      correo: ["correo", "email", "correoElectronico", "userEmail"],
      cuenta: ["cuenta", "cuentaId", "numeroCuenta", "account_id"],
      encargo: ["encargo", "numero_encargo"],
      usuario: ["usuario", "usuarioId", "idUsuario", "user_id", "userId"],
      filaCruda: ["filaCruda", "crudo", "crudoCifrado", "fila"],
      textoLibre: ["texto", "textoLibre", "nota", "comentario", "detalle", "descripcion", "justificacion", "razon", "decision", "regla"],
      accion: ["accion", "acción", "ACCION", "action"],
      cantidad: ["cantidad", "CANTIDAD", "quantity", "unidades"],
      especie: ["especie", "nemotecnico", "ticker", "simbolo", "instrumentoId", "nombre"],
      secretos: ["password", "contraseña", "token", "totp", "sesionId", "telegramChatId"],
    };
    for (const [concepto, variantes] of Object.entries(conceptos)) {
      for (const variante of variantes) expect(esClaveProhibida(variante), `${concepto}: ${variante}`).toBe(true);
    }
  });

  it("ningún campo del contrato es una clave prohibida", () => {
    for (const campo of CAMPOS_DEL_CONTRATO) expect(esClaveProhibida(campo), campo).toBe(false);
  });

  it("de la vista, solo «especie» cae en una raíz: la guarda la deja pasar solo como id en un hecho (vista-ciega.especie.test.ts)", () => {
    expect(CAMPOS_HECHO_CIEGO.filter(esClaveProhibida)).toEqual(["especie"]);
    expect(clavesProhibidasEn({ hechos: [{ id: "H02", especie: "H01" }] })).toEqual(["hechos[0].especie"]);
  });

  it("normaliza quitando tildes, mayúsculas y lo que no es letra", () => {
    expect(normalizarClave("Correo_Usuario-Ñ")).toBe("correousuarion");
    expect(normalizarClave("acción")).toBe("accion");
    expect(normalizarClave("H01")).toBe("h");
  });

  it("encuentra claves prohibidas a cualquier profundidad, en objetos y en arreglos, con su ruta", () => {
    const valor = { tipo: "DIARIO", hechos: [{ id: "H01" }, { id: "H02", extra: { correo: "x", lista: [{ cantidad: "7" }] } }], cuenta: null };
    expect(clavesProhibidasEn(valor)).toEqual(["hechos[1].extra.correo", "hechos[1].extra.lista[0].cantidad", "cuenta"]);
  });

  it("no encuentra nada en un valor limpio ni en primitivos", () => {
    expect(clavesProhibidasEn({ tipo: "DIARIO", hechos: [{ id: "H01", clave: "VALOR_ACCIONES" }] })).toEqual([]);
    for (const primitivo of [null, undefined, "correo", 7, true]) expect(clavesProhibidasEn(primitivo)).toEqual([]);
  });

  it("un valor con ciclos o demasiado profundo no es un paquete: TypeError", () => {
    const ciclico: Record<string, unknown> = { a: 1 };
    ciclico.yo = ciclico;
    expect(() => clavesProhibidasEn(ciclico)).toThrow(TypeError);
    let profundo: unknown = {};
    for (let i = 0; i < 70; i += 1) profundo = { a: profundo };
    expect(() => clavesProhibidasEn(profundo)).toThrow(TypeError);
  });

  it("una referencia compartida (sin ciclo) se recorre sin error", () => {
    const compartido = { id: "H01" };
    expect(clavesProhibidasEn({ a: compartido, b: [compartido] })).toEqual([]);
  });
});
