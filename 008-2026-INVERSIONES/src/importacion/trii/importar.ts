/**
 * Importa un CSV de Trii de forma atómica (INV-SPEC-8).
 * - Una fila inválida, un conflicto o un fallo de la base → el archivo entero queda RECHAZADO
 *   (se registra la carga con códigos y filas, nunca con valores) y no se guarda ningún hecho.
 * - Reimportar no duplica: cada fila se identifica por (tipo, clave natural, ocurrencia).
 * - El crudo de cada fila se guarda cifrado (#11). Sin un llavero válido la importación falla cerrado
 *   (ErrorCifrado) antes de tocar la base: no queda ni la carga RECHAZADA.
 */
import { Prisma, type PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";
import { ErrorCifrado } from "../../cifrado/errores";
import { obtenerLlavero } from "../../cifrado/llavero";
import { asignarClaves, type RegistroConClave } from "./clave";
import { ErrorCsv, leerCsv, type RegistroCsv } from "./csv";
import { interpretarFila, type ErrorFila } from "./filas";
import { detectarTipo, type TipoTrii } from "./formatos";
import { guardarRegistro, ErrorImportacion, prepararContexto } from "./guardar";

export const MAX_ERRORES_REGISTRADOS = 100;
/** Topes para cualquier llamador (CLI, API o web futura): un extracto real está muy por debajo. */
export const MAX_BYTES = 5 * 1024 * 1024;
export const MAX_FILAS = 50_000;

export interface ArchivoTrii {
  readonly nombreArchivo: string;
  readonly contenido: Uint8Array;
  readonly usuarioId: string;
}

export interface ResultadoImportacion {
  readonly cargaId: string;
  readonly estado: "CARGADO" | "RECHAZADO";
  readonly tipo: TipoTrii | null;
  readonly filasTotal: number;
  readonly filasNuevas: number;
  readonly filasRepetidas: number;
  readonly instrumentosCreados: number;
  readonly errores: readonly ErrorFila[];
}

type Analisis =
  | { ok: true; tipo: TipoTrii; registros: RegistroConClave[] }
  | { ok: false; tipo: TipoTrii | null; filasTotal: number; errores: ErrorFila[] };

function analizar(contenido: Uint8Array): Analisis {
  if (contenido.byteLength > MAX_BYTES) {
    return { ok: false, tipo: null, filasTotal: 0, errores: [{ fila: 0, columna: null, codigo: "ARCHIVO_DEMASIADO_GRANDE" }] };
  }
  let texto: string;
  try {
    texto = new TextDecoder("utf-8", { fatal: true }).decode(contenido);
  } catch {
    return { ok: false, tipo: null, filasTotal: 0, errores: [{ fila: 0, columna: null, codigo: "CODIFICACION_NO_UTF8" }] };
  }
  let registros: RegistroCsv[];
  try {
    registros = leerCsv(texto);
  } catch (e) {
    const codigo = e instanceof ErrorCsv ? e.codigo : "CSV_ILEGIBLE";
    return { ok: false, tipo: null, filasTotal: 0, errores: [{ fila: 0, columna: null, codigo }] };
  }
  // Las líneas vacías ya no están (O4); cada registro trae su número en el archivo, que es el que se guarda y
  // el que llevan los errores. El encabezado es el primer registro.
  const [encabezado, ...datos] = registros;
  const tipo = encabezado ? detectarTipo(encabezado.celdas) : null;
  if (!encabezado || !tipo) return { ok: false, tipo: null, filasTotal: datos.length, errores: [{ fila: encabezado?.numero ?? 1, columna: null, codigo: "ENCABEZADO_DESCONOCIDO" }] };
  if (datos.length === 0) return { ok: false, tipo, filasTotal: 0, errores: [{ fila: 0, columna: null, codigo: "ARCHIVO_SIN_FILAS" }] };
  if (datos.length > MAX_FILAS) return { ok: false, tipo, filasTotal: datos.length, errores: [{ fila: 0, columna: null, codigo: "DEMASIADAS_FILAS" }] };

  const columnas = encabezado.celdas.map((col) => col.trim());
  const errores: ErrorFila[] = [];
  const validos = datos.flatMap(({ numero, celdas }) => {
    const r = interpretarFila(tipo, celdas, numero);
    if (r.ok) return [{ registro: r.registro, fila: numero, crudo: Object.fromEntries(columnas.map((col, j) => [col, celdas[j] ?? ""])) }];
    errores.push(...r.errores);
    return [];
  });
  if (errores.length > 0) return { ok: false, tipo, filasTotal: datos.length, errores };
  return { ok: true, tipo, registros: asignarClaves(validos) };
}

/** Código del fallo de la base, sin el mensaje (puede traer valores). P2028 = transacción vencida. */
function codigoDeBase(e: unknown): string {
  if (e instanceof Prisma.PrismaClientKnownRequestError) return e.code === "P2028" ? "TIEMPO_AGOTADO" : `BASE_${e.code}`;
  return "BASE_ERROR";
}

async function registrarRechazo(
  db: PrismaClient, archivo: ArchivoTrii, sha256: string, tipo: TipoTrii | null, filasTotal: number, errores: readonly ErrorFila[],
): Promise<ResultadoImportacion> {
  const registrados = errores.slice(0, MAX_ERRORES_REGISTRADOS);
  const carga = await db.cargaArchivo.create({
    data: {
      tipoFuente: tipo ?? "TRII_CAJA", // sin tipo reconocible se registra como caja; el código lo explica
      nombreArchivo: archivo.nombreArchivo, sha256, estado: "RECHAZADO", filasTotal,
      errores: { total: errores.length, errores: registrados } as unknown as Prisma.InputJsonValue,
      cargadoPorId: archivo.usuarioId,
    },
  });
  return { cargaId: carga.id, estado: "RECHAZADO", tipo, filasTotal, filasNuevas: 0, filasRepetidas: 0, instrumentosCreados: 0, errores: registrados };
}

export async function importarArchivoTrii(db: PrismaClient, archivo: ArchivoTrii): Promise<ResultadoImportacion> {
  const llavero = obtenerLlavero(); // primero: sin claves no se escribe nada, ni el rechazo
  const usuario = await db.usuario.findUnique({ where: { id: archivo.usuarioId } });
  if (!usuario || !usuario.activo || usuario.rol !== "DUENO") throw new ErrorImportacion("USUARIO_NO_AUTORIZADO");

  const sha256 = createHash("sha256").update(archivo.contenido).digest("hex");
  const analisis = analizar(archivo.contenido);
  if (!analisis.ok) return registrarRechazo(db, archivo, sha256, analisis.tipo, analisis.filasTotal, analisis.errores);

  const { tipo, registros } = analisis;
  try {
    return await db.$transaction(
      async (tx) => {
        // Una sola importación del mismo tipo a la vez (evita choques de clave única en paralelo).
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`inv008-importar-${tipo}`}))`;
        const carga = await tx.cargaArchivo.create({
          data: { tipoFuente: tipo, nombreArchivo: archivo.nombreArchivo, sha256, estado: "VALIDANDO", cargadoPorId: archivo.usuarioId },
        });
        const ctx = await prepararContexto(tx, registros);
        let nuevas = 0;
        for (const r of registros) {
          if (await guardarRegistro(tx, ctx, carga.id, r, llavero)) nuevas += 1;
        }
        await tx.cargaArchivo.update({
          where: { id: carga.id },
          data: { estado: "CARGADO", filasTotal: registros.length, filasNuevas: nuevas, filasRepetidas: registros.length - nuevas },
        });
        return {
          cargaId: carga.id, estado: "CARGADO" as const, tipo, filasTotal: registros.length, filasNuevas: nuevas,
          filasRepetidas: registros.length - nuevas, instrumentosCreados: ctx.instrumentosCreados(), errores: [],
        };
      },
      { timeout: 60_000, maxWait: 10_000 },
    );
  } catch (e) {
    // El mensaje de Prisma puede traer valores reales: solo se registra un código.
    // Un ErrorCifrado lleva su propio código (fijo, sin valores): el problema no es de la base.
    const error: ErrorFila =
      e instanceof ErrorImportacion
        ? { fila: e.fila ?? 0, columna: null, codigo: e.codigo }
        : e instanceof ErrorCifrado
          ? { fila: 0, columna: null, codigo: e.codigo }
          : { fila: 0, columna: null, codigo: codigoDeBase(e) };
    return registrarRechazo(db, archivo, sha256, tipo, registros.length, [error]);
  }
}
