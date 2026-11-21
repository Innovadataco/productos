// Página de inicio (INV-SPEC-15) con la base caída: solo los errores de Prisma se muestran como
// «No se pudo leer la base», y se registra solo el código (el mensaje puede traer la URL).
// Cualquier otro error se propaga para que lo atienda src/app/error.tsx.
import { Prisma } from "@prisma/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const obtenerResumen = vi.hoisted(() => vi.fn());
vi.mock("@/tablero/datos", () => ({ obtenerResumen }));
vi.mock("@/lib/db", () => ({ db: {} }));

import Inicio from "@/app/page";

const VERSION = "5.22.0";
const DETALLE = "postgresql://usuario:clave-secreta@host-privado:5438";

afterEach(() => {
  vi.restoreAllMocks();
  obtenerResumen.mockReset();
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

    expect(html).toContain("No se pudo leer la base de 008");
    expect(html).not.toContain("clave-secreta");
    expect(registro).toHaveBeenCalledWith(`[tablero] no se pudo leer la base (código: ${codigo})`);
    expect(JSON.stringify(registro.mock.calls)).not.toContain("clave-secreta");
  });

  it("un error que no es de la base se propaga (lo atiende error.tsx)", async () => {
    obtenerResumen.mockRejectedValueOnce(new Error("fallo de cálculo"));
    await expect(Inicio()).rejects.toThrow("fallo de cálculo");
  });
});
