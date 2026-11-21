/**
 * Agregación por especie (la PK de certificacion_posicion es por especie; el PDF trae una fila por lote),
 * clave natural de cada fila y validación de la fecha de corte. Datos inventados.
 */
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { agregarPosiciones } from "@/importacion/av/agregar";
import { asignarClavesAv, registrosDe } from "@/importacion/av/clave";
import { aniosSembrados, MAX_DIAS_ANTES_DEL_PDF, validarFechaCorte } from "@/importacion/av/fecha-corte";
import { interpretarFilas, type CertificacionLeida, type LoteCertificado } from "@/importacion/av/filas";
import { extraerLineas } from "@/importacion/av/pdf/lector";
import { leerTablaCertificacion } from "@/importacion/av/tabla";
import { CERTIFICACION_FICTICIA, generarCertificacionPdf } from "../../../fixtures/av/certificacion.ficticio";

function leida(pdf = generarCertificacionPdf()): CertificacionLeida {
  const r = interpretarFilas(leerTablaCertificacion(extraerLineas(pdf)));
  if (!r.ok) throw new Error("el ficticio no leyó");
  return r.valor;
}

const lote = (nemo: string, cantidad: bigint, precio: string, valor: string, pagina: number, numero: number): LoteCertificado => ({ nemo, cantidad, precio, valor, pagina, numero, crudo: {} });

describe("agregarPosiciones", () => {
  it("suma los lotes de cada especie y deja la referencia a todas sus filas del PDF", () => {
    const r = agregarPosiciones(leida().lotes);
    expect(r).toEqual({
      ok: true,
      valor: [
        { nemo: "FICT1", cantidad: 150n, precioValoracion: "1000", valorMercado: "150000.01", referenciaPdf: "p1:f2,p1:f3" },
        { nemo: "FICT2", cantidad: 2000n, precioValoracion: "20", valorMercado: "40000", referenciaPdf: "p1:f4" },
        { nemo: "FICT3", cantidad: 10n, precioValoracion: "32500", valorMercado: "325000", referenciaPdf: "p1:f5" },
      ],
    });
  });

  it("une lotes de la misma especie en páginas distintas", () => {
    const r = agregarPosiciones([lote("FICT1", 1n, "10", "10", 1, 7), lote("FICT1", 2n, "10", "20", 2, 1)]);
    expect(r).toMatchObject({ ok: true, valor: [{ cantidad: 3n, valorMercado: "30", referenciaPdf: "p1:f7,p2:f1" }] });
  });

  it("rechaza dos precios de valoración distintos para la misma especie", () => {
    expect(agregarPosiciones([lote("FICT1", 1n, "10", "10", 1, 2), lote("FICT1", 1n, "11", "11", 1, 3)])).toEqual({
      ok: false,
      errores: [{ pagina: 1, fila: 3, columna: "PRECIO VALORACIÓN", codigo: "PRECIO_INCONSISTENTE" }],
    });
  });
});

describe("clave natural de las filas de la certificación", () => {
  const claves = (fecha: string, cert = leida()) => asignarClavesAv(fecha, registrosDe(cert));

  it("es el sha256 de (AV_CERTIFICACION, fecha de corte, tipo, campos canónicos) y sigue el orden del documento", () => {
    const r = claves("2024-01-04");
    expect(r.map((x) => [x.tipo, x.numero, x.ocurrencia])).toEqual([["FONDO", 1, 1], ["LOTE", 2, 1], ["LOTE", 3, 1], ["LOTE", 4, 1], ["LOTE", 5, 1], ["EFECTIVO", 6, 1]]);
    const esperado = createHash("sha256").update(JSON.stringify(["AV_CERTIFICACION", "2024-01-04", "EFECTIVO", [["saldo", "1000"]]])).digest("hex");
    expect(r[5]!.clave).toBe(esperado);
  });

  it("no lleva el encargo, la cuenta, el titular ni la descripción del fondo (el hash va en claro)", () => {
    const base = leida();
    const otro: CertificacionLeida = { ...base, fondos: [{ ...base.fondos[0]!, encargo: "999999999", descripcion: "OTRO FONDO FICTICIO" }] };
    expect(claves("2024-01-04", otro)[0]!.clave).toBe(claves("2024-01-04", base)[0]!.clave);
    for (const r of registrosDe(base)) expect(Object.keys(r.canonico).sort()).not.toEqual(expect.arrayContaining(["encargo"]));
  });

  it("cambia con la fecha de corte y con cualquier cifra", () => {
    expect(claves("2024-01-05")[1]!.clave).not.toBe(claves("2024-01-04")[1]!.clave);
    const base = leida();
    const otra: CertificacionLeida = { ...base, lotes: [{ ...base.lotes[0]!, valor: "100001" }, ...base.lotes.slice(1)] };
    expect(claves("2024-01-04", otra)[1]!.clave).not.toBe(claves("2024-01-04", base)[1]!.clave);
  });

  it("dos lotes idénticos no se fusionan: ocurrencia 1 y 2", () => {
    const base = leida();
    const doble: CertificacionLeida = { ...base, lotes: [base.lotes[0]!, { ...base.lotes[0]!, numero: 9 }] };
    const r = asignarClavesAv("2024-01-04", registrosDe(doble)).filter((x) => x.tipo === "LOTE");
    expect(r.map((x) => [x.numero, x.ocurrencia])).toEqual([[2, 1], [9, 2]]);
    expect(r[0]!.clave).toBe(r[1]!.clave);
  });
});

describe("validarFechaCorte", () => {
  const dia = (s: string) => new Date(`${s}T00:00:00Z`);
  const ctx = { noHabiles: new Set(["2024-01-08"]), aniosSembrados: new Set([2024]), hoy: new Date("2024-01-10T15:00:00Z"), creadoEn: new Date("2024-01-05T15:15:00Z") };

  it("acepta un día hábil sembrado, no futuro y hasta 7 días antes de la generación del PDF", () => {
    expect(validarFechaCorte(dia("2024-01-04"), ctx)).toBeNull();
    expect(validarFechaCorte(dia("2024-01-05"), ctx)).toBeNull();
    expect(validarFechaCorte(dia("2023-12-29"), { ...ctx, aniosSembrados: new Set([2023, 2024]) })).toBeNull();
    expect(MAX_DIAS_ANTES_DEL_PDF).toBe(7);
  });

  it("rechaza fines de semana y festivos de la BVC", () => {
    expect(validarFechaCorte(dia("2024-01-06"), { ...ctx, creadoEn: null })).toBe("FECHA_CORTE_NO_HABIL");
    expect(validarFechaCorte(dia("2024-01-08"), { ...ctx, creadoEn: null })).toBe("FECHA_CORTE_NO_HABIL");
  });

  it("rechaza un año sin calendario sembrado, una fecha futura, posterior al PDF o lejana", () => {
    expect(validarFechaCorte(dia("2025-01-02"), { ...ctx, creadoEn: null, hoy: new Date("2025-01-03T12:00:00Z") })).toBe("CALENDARIO_BVC_INCOMPLETO");
    expect(validarFechaCorte(dia("2024-01-11"), { ...ctx, creadoEn: null })).toBe("FECHA_CORTE_FUTURA");
    expect(validarFechaCorte(dia("2024-01-09"), ctx)).toBe("FECHA_CORTE_POSTERIOR_AL_PDF");
    expect(validarFechaCorte(dia("2023-12-28"), { ...ctx, aniosSembrados: new Set([2023, 2024]) })).toBe("FECHA_CORTE_LEJANA");
  });

  it("la fecha de generación se toma en hora de Colombia (un PDF de las 9 p. m. del 5 es del 5)", () => {
    expect(validarFechaCorte(dia("2024-01-05"), { ...ctx, creadoEn: new Date("2024-01-06T02:00:00Z") })).toBeNull();
    expect(validarFechaCorte(dia("2024-01-09"), { ...ctx, creadoEn: new Date("2024-01-06T02:00:00Z") })).toBe("FECHA_CORTE_POSTERIOR_AL_PDF");
  });

  it("un año cuenta como sembrado solo si trae festivos de enero y de diciembre (code-reviewer MEDIO: no a medias)", () => {
    const dias = ["2025-01-01", "2025-12-25", "2026-01-01", "2026-06-29", "2027-12-25"].map((d) => new Date(`${d}T00:00:00Z`));
    expect([...aniosSembrados(dias)].sort()).toEqual([2025]);
  });

  it("el ficticio trae su CreationDate", () => {
    expect(CERTIFICACION_FICTICIA.creadoEn).toMatch(/^D:20240105/);
  });
});
