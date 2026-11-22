// La transacción del camino único de dividendo_decretado (fase C, C4a: guardarDecretos) contra una base de mentira que
// anota cada llamada: la guarda del cruce corre ANTES de cualquier escritura y con la misma conexión que escribe
// (CRUCE_PENDIENTE en una base que no es de pruebas), el retiro va antes de la inserción y, si no cuenta 1, la
// inserción no ocurre (CONFLICTO_CONCURRENTE); un P2002 al insertar el decreto (otro escritor se adelantó con esa
// vigente o esa versión) también es CONFLICTO_CONCURRENTE, pero uno en la fila cruda es un defecto propio y sube; la
// transacción fija su lock_timeout; sin cambios no se crea la carga; otro error sube tal cual. La integración (tests/integracion/decretos-importar.test.ts) lo repite
// contra PostgreSQL. Datos inventados.
import { randomBytes } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";
import type { Llavero } from "@/cifrado/llavero";
import { guardarDecretos, type DecretoResuelto, type EntradaGuardar } from "@/datos-oficiales/decretos/guardar";
import type { DecretoLeido } from "@/datos-oficiales/decretos/filas";

const LLAVERO: Llavero = { activa: "v1", claves: new Map([["v1", randomBytes(32)]]) };
const dia = (iso: string) => new Date(`${iso}T00:00:00Z`);
const DECRETO: DecretoLeido = {
  linea: 2, especie: "FICTA", tipo: "ORDINARIO", fechaAnuncio: dia("2021-03-17"), cuota: 1, valorPorAccion: "1873.204517",
  fechaEx: dia("2021-04-14"), fechaPago: dia("2021-04-21"), referencia: "sfc:FICT-4613", anulada: false, nota: null,
};
const RESUELTO: DecretoResuelto = { instrumentoId: "ins-a", fila: { decreto: DECRETO, crudo: { especie: "FICTA" } } };
const entrada = (resueltos: readonly DecretoResuelto[] = [RESUELTO]): EntradaGuardar => ({ usuarioId: "u-1", sha256: "e".repeat(64), resueltos, llavero: LLAVERO });

interface Opciones {
  readonly base?: string;
  readonly guardadas?: readonly Record<string, unknown>[];
  readonly retirados?: number;
  readonly fallaCrear?: unknown;
  readonly fallaFilaFuente?: unknown;
}

/** Una base de mentira: `$transaction` corre el cuerpo con un cliente que anota lo que se le pide, en orden. */
function baseFalsa(o: Opciones = {}) {
  const llamadas: string[] = [];
  const anotar = (nombre: string, valor: unknown = undefined) => async (..._args: unknown[]) => {
    llamadas.push(nombre);
    return valor;
  };
  const tx = {
    $queryRaw: anotar("nombreDeLaBase", [{ nombre: o.base ?? "inversiones_test" }]),
    $executeRaw: async (partes: TemplateStringsArray) => {
      llamadas.push(partes.join("?").includes("lock_timeout") ? "lockTimeout" : "candado");
      return 0;
    },
    dividendoDecretado: {
      findMany: anotar("leerVersiones", o.guardadas ?? []),
      updateMany: anotar("retirar", { count: o.retirados ?? 1 }),
      create: async () => {
        llamadas.push("crearDecreto");
        if (o.fallaCrear) throw o.fallaCrear;
        return { id: "dec-nuevo" };
      },
    },
    cargaArchivo: { create: anotar("crearCarga", { id: "carga-1" }) },
    filaFuente: {
      create: async () => {
        llamadas.push("crearFilaFuente");
        if (o.fallaFilaFuente) throw o.fallaFilaFuente;
        return { id: "fila-nueva" };
      },
    },
    filaDeCarga: { create: anotar("verFila", {}) },
  };
  const db = { $transaction: async (cuerpo: (t: typeof tx) => Promise<unknown>) => cuerpo(tx) } as unknown as PrismaClient;
  return { db, llamadas };
}

const vigente = (cambios: Record<string, unknown> = {}) => ({
  id: "dec-1", instrumentoId: "ins-a", tipo: "ORDINARIO", fechaAnuncio: DECRETO.fechaAnuncio, cuota: 1, version: 1, reemplazadoEn: null,
  valorPorAccion: new Prisma.Decimal("4.61"), fechaEx: DECRETO.fechaEx, fechaPago: DECRETO.fechaPago, referenciaOficial: DECRETO.referencia,
  nota: null, anulada: false, filaFuenteId: "fila-1", ...cambios,
});

describe("decretos · guardarDecretos (la transacción)", () => {
  it("en una base que no es de pruebas: CRUCE_PENDIENTE, y la guarda es lo primero (ni candado ni lecturas ni escrituras)", async () => {
    for (const base of ["inversiones", "inversiones_test_x", "otra"]) {
      const { db, llamadas } = baseFalsa({ base });
      expect(await guardarDecretos(db, entrada()), base).toEqual({ estado: "RECHAZADO", hallazgos: [{ linea: 0, columna: null, codigo: "CRUCE_PENDIENTE" }] });
      expect(llamadas, base).toEqual(["nombreDeLaBase"]);
    }
  });

  it("un decreto nuevo: guarda, candado (sin lock_timeout: otra carga puede tardar más), lock_timeout, relee, crea la carga, la fila cruda (y su visto) y la v1", async () => {
    const { db, llamadas } = baseFalsa();
    const r = await guardarDecretos(db, entrada());
    expect(r).toEqual({ estado: "APLICADO", cargaId: "carga-1", conteos: { filas: 1, nuevos: 1, versiones: 0, anulaciones: 0, sinCambios: 0 } });
    expect(llamadas).toEqual(["nombreDeLaBase", "candado", "lockTimeout", "leerVersiones", "crearCarga", "crearFilaFuente", "verFila", "crearDecreto"]);
  });

  it("un cambio: primero el retiro de la vigente y después la versión siguiente", async () => {
    const { db, llamadas } = baseFalsa({ guardadas: [vigente()] });
    expect(await guardarDecretos(db, entrada())).toMatchObject({ estado: "APLICADO", conteos: { versiones: 1 } });
    expect(llamadas.slice(4)).toEqual(["crearCarga", "retirar", "crearFilaFuente", "verFila", "crearDecreto"]);
  });

  it("si el retiro no cuenta 1 (otro lo retiró): CONFLICTO_CONCURRENTE con su línea, y la versión siguiente no se inserta", async () => {
    const { db, llamadas } = baseFalsa({ guardadas: [vigente()], retirados: 0 });
    expect(await guardarDecretos(db, entrada())).toEqual({ estado: "RECHAZADO", hallazgos: [{ linea: 2, columna: null, codigo: "CONFLICTO_CONCURRENTE" }] });
    expect(llamadas).not.toContain("crearDecreto");
    expect(llamadas).not.toContain("crearFilaFuente");
  });

  it("un P2002 al insertar el decreto (otro escritor se adelantó) es CONFLICTO_CONCURRENTE con su línea; otro error sube tal cual", async () => {
    const p2002 = new Prisma.PrismaClientKnownRequestError("único", { code: "P2002", clientVersion: "x" });
    expect(await guardarDecretos(baseFalsa({ fallaCrear: p2002 }).db, entrada())).toEqual({ estado: "RECHAZADO", hallazgos: [{ linea: 2, columna: null, codigo: "CONFLICTO_CONCURRENTE" }] });
    const otro = new Prisma.PrismaClientKnownRequestError("otro", { code: "P2034", clientVersion: "x" });
    await expect(guardarDecretos(baseFalsa({ fallaCrear: otro }).db, entrada())).rejects.toBe(otro);
  });

  it("un P2002 en la fila cruda (una clave natural que choca: defecto propio) no se disfraza de concurrencia: sube", async () => {
    const p2002 = new Prisma.PrismaClientKnownRequestError("único", { code: "P2002", clientVersion: "x" });
    await expect(guardarDecretos(baseFalsa({ fallaFilaFuente: p2002 }).db, entrada())).rejects.toBe(p2002);
  });

  it("sin cambios: no se crea la carga ni nada más", async () => {
    const { db, llamadas } = baseFalsa({ guardadas: [vigente({ valorPorAccion: new Prisma.Decimal("1873.204517") })] });
    expect(await guardarDecretos(db, entrada())).toEqual({ estado: "SIN_CAMBIOS", conteos: { filas: 1, nuevos: 0, versiones: 0, anulaciones: 0, sinCambios: 1 } });
    expect(llamadas).toEqual(["nombreDeLaBase", "candado", "lockTimeout", "leerVersiones"]);
  });

  it("la cadena rota que aparece al releer dentro de la transacción rechaza sin escribir", async () => {
    const { db, llamadas } = baseFalsa({ guardadas: [vigente({ version: 2 })] });
    expect(await guardarDecretos(db, entrada())).toEqual({ estado: "RECHAZADO", hallazgos: [{ linea: 2, columna: null, codigo: "CADENA_ROTA" }] });
    expect(llamadas).toEqual(["nombreDeLaBase", "candado", "lockTimeout", "leerVersiones"]);
  });
});
