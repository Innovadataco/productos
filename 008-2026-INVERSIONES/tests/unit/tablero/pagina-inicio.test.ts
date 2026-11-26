// Página de inicio (INV-SPEC-15) con la base caída: solo los errores de Prisma se muestran como
// «No se pudo leer la base», y se registra solo el código (el mensaje puede traer la URL).
// Cualquier otro error se propaga para que lo atienda src/app/error.tsx.
import { Prisma } from "@prisma/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { vistaResumenFicticia } from "../resumen-ia/vista.ficticio";

const obtenerResumen = vi.hoisted(() => vi.fn());
const exigirSesion = vi.hoisted(() => vi.fn());
const ultimaConciliacion = vi.hoisted(() => vi.fn());
const obtenerEvolucion = vi.hoisted(() => vi.fn());
vi.mock("@/tablero/datos", () => ({ obtenerResumen }));
// La evolución diaria y la TWR (frente graficas-tablero): se leen aparte, con el resumen ya leído.
vi.mock("@/tablero/datos-evolucion", () => ({ obtenerEvolucion }));
// La línea de la conciliación (PR-C): el resultado guardado de la última, sin recalcular.
vi.mock("@/conciliacion/leer", () => ({ ultimaConciliacion }));
vi.mock("@/lib/db", () => ({ db: {} }));
const resumenDelDia = vi.hoisted(() => vi.fn());
vi.mock("@/app/_comun/resumen-ia/leer", () => ({ resumenDelDia }));
// La sesión (D-014) se revalida contra la base en cada visita; aquí, una sesión válida falsa.
vi.mock("@/auth/sesion", () => ({ exigirSesion }));

import Inicio from "@/app/page";
import { D, dia, especie, resumenDe } from "./ficticio";

const VERSION = "5.22.0";
const SIN_EVOLUCION = { metodo: "twr-acciones-v1", puntos: [], rangos: [], omitidos: 0, sinCierre: [] };
const DETALLE = "postgresql://usuario:clave-secreta@host-privado:5438";

beforeEach(() => {
  resumenDelDia.mockImplementation(async (_db: unknown, tipo: "DIARIO" | "REGLAS" | "ESCENARIOS") => vistaResumenFicticia(tipo));
  exigirSesion.mockResolvedValue({ id: "u1", email: "dueno@ejemplo.invalid", rol: "DUENO" });
  ultimaConciliacion.mockResolvedValue(null);
  obtenerEvolucion.mockResolvedValue(SIN_EVOLUCION);
});

afterEach(() => {
  vi.restoreAllMocks();
  obtenerResumen.mockReset();
  exigirSesion.mockReset();
  ultimaConciliacion.mockReset();
  obtenerEvolucion.mockReset();
});

describe("src/app/page.tsx", () => {
  it.each([
    ["no se pudo conectar", new Prisma.PrismaClientInitializationError(`Can't reach ${DETALLE}`, VERSION, "P1001"), "P1001"],
    ["error conocido de consulta", new Prisma.PrismaClientKnownRequestError(`falló en ${DETALLE}`, { code: "P2021", clientVersion: VERSION }), "P2021"],
    ["error desconocido de consulta", new Prisma.PrismaClientUnknownRequestError(`falló en ${DETALLE}`, { clientVersion: VERSION }), "PrismaClientUnknownRequestError"],
  ])("con la base caída (%s) muestra «No se pudo leer la base» y registra solo el código", async (_caso, error, codigo) => {
    obtenerResumen.mockRejectedValueOnce(error);
    const registro = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const html = renderToStaticMarkup(await Inicio());

    expect(html).toContain("No se pudo leer la base de Inversiones");
    expect(html).not.toContain("clave-secreta");
    expect(registro).toHaveBeenCalledWith(`[tablero] no se pudo leer la base (código: ${codigo})`);
    expect(JSON.stringify(registro.mock.calls)).not.toContain("clave-secreta");
  });

  it("sin sesión no lee la base: la redirección de exigirSesion se propaga", async () => {
    const redireccion = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/ingresar;307;" });
    exigirSesion.mockRejectedValueOnce(redireccion);
    await expect(Inicio()).rejects.toBe(redireccion);
    expect(obtenerResumen).not.toHaveBeenCalled();
    expect(ultimaConciliacion).not.toHaveBeenCalled();
  });

  it("pasa al tablero la última conciliación guardada: la línea enlaza a /conciliacion; se lee después del resumen", async () => {
    obtenerResumen.mockResolvedValueOnce(resumenDe([especie({ nemotecnico: "FICT1", cantidad: 10n, costoVivo: D(1000) })]));
    ultimaConciliacion.mockResolvedValueOnce({ fechaCorte: dia("2024-11-22"), resultado: "NO_CUADRA" });
    const html = renderToStaticMarkup(await Inicio());
    expect(html).toContain('<a href="/conciliacion">Conciliación con A&amp;V al 22-nov-2024: no cuadra</a>');
    expect(ultimaConciliacion).toHaveBeenCalledTimes(1);
    expect(obtenerResumen.mock.invocationCallOrder[0]!).toBeLessThan(ultimaConciliacion.mock.invocationCallOrder[0]!);
  });

  it("si la base falla al leer la línea, también muestra «No se pudo leer la base» con solo el código", async () => {
    obtenerResumen.mockResolvedValueOnce(resumenDe([]));
    ultimaConciliacion.mockRejectedValueOnce(new Prisma.PrismaClientInitializationError(`Can't reach ${DETALLE}`, VERSION, "P1001"));
    const registro = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const html = renderToStaticMarkup(await Inicio());
    expect(html).toContain("No se pudo leer la base de Inversiones");
    expect(registro).toHaveBeenCalledWith("[tablero] no se pudo leer la base (código: P1001)");
  });

  it("lee la evolución con el resumen ya leído y la pasa al tablero («Cómo ha ido»)", async () => {
    const resumen = resumenDe([especie({ nemotecnico: "FICT1", cantidad: 10n, costoVivo: D(1000) })]);
    obtenerResumen.mockResolvedValueOnce(resumen);
    const html = renderToStaticMarkup(await Inicio());
    expect(obtenerEvolucion).toHaveBeenCalledWith({}, resumen);
    expect(obtenerResumen.mock.invocationCallOrder[0]!).toBeLessThan(obtenerEvolucion.mock.invocationCallOrder[0]!);
    expect(html).toContain("Cómo ha ido");
    expect(html).toContain("Todavía no hay un día con cierre de todas las especies que tiene");
  });

  it("si la base falla al leer la evolución, muestra «No se pudo leer la base» con solo el código", async () => {
    obtenerResumen.mockResolvedValueOnce(resumenDe([]));
    obtenerEvolucion.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError(`falló en ${DETALLE}`, { code: "P2024", clientVersion: VERSION }));
    const registro = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const html = renderToStaticMarkup(await Inicio());
    expect(html).toContain("No se pudo leer la base de Inversiones");
    expect(registro).toHaveBeenCalledWith("[tablero] no se pudo leer la base (código: P2024)");
  });

  it("si el cálculo de la evolución falla (no es la base), el tablero se pinta igual con un aviso y se registra solo el nombre", async () => {
    obtenerResumen.mockResolvedValueOnce(resumenDe([especie({ nemotecnico: "FICT1", cantidad: 10n, costoVivo: D(1000) })]));
    obtenerEvolucion.mockRejectedValueOnce(new Error("Evolución: una venta asignada a un lote que no existe a esa fecha."));
    const registro = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const html = renderToStaticMarkup(await Inicio());
    expect(html).toContain("¿Gano?");
    expect(html).toContain("No se pudo calcular la evolución");
    expect(registro).toHaveBeenCalledWith("[tablero] no se pudo calcular la evolución (Error)");
    expect(JSON.stringify(registro.mock.calls)).not.toContain("venta asignada");
  });

  it("un error que no es de la base se propaga (lo atiende error.tsx)", async () => {
    obtenerResumen.mockRejectedValueOnce(new Error("fallo de cálculo"));
    await expect(Inicio()).rejects.toThrow("fallo de cálculo");
  });
});
