// Integración del #11 contra la base de PRUEBAS: la migración que cifra lo existente
// (src/cifrado/migracion.ts, la usa scripts/cifrar-existentes.ts). Todos los datos son inventados.
// La base es compartida con los demás archivos de integración: se afirma sobre las filas propias (por id)
// y los conteos globales solo con «al menos».
import { Prisma, PrismaClient, type TipoFuente } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cifrarCrudo, cifrarEncargo, descifrarCrudo, descifrarEncargo, type LlaveFilaFuente } from "@/cifrado/campos";
import { ErrorCifrado } from "@/cifrado/errores";
import { obtenerLlavero } from "@/cifrado/llavero";
import { cifrarExistentes, ErrorMigracion, type OpcionesMigracion } from "@/cifrado/migracion";
import { esSobre } from "@/cifrado/sobre";
import { importarArchivoTrii } from "@/importacion/trii/importar";

const db = new PrismaClient();
let BASE = "";
let duenoId = "";
let cargaId = "";
let n = 0;
const corrida = Date.now().toString(16);
const DIA_MS = 24 * 60 * 60 * 1000;
const siguiente = () => (n += 1);
const claveNatural = () => `${corrida}c${siguiente()}`.padStart(64, "0");
const llaveDe = (f: { tipoFuente: string; claveNatural: string; ocurrencia: number }): LlaveFilaFuente => ({
  tipoFuente: f.tipoFuente, claveNatural: f.claveNatural, ocurrencia: f.ocurrencia,
});
const crudoFicticio = () => ({ "Fecha y hora": `${siguiente()} mar 2026, 9:00 a. m.`, "Tipo de movimiento": "Depósito", Estado: "Aprobado", "Valor total": `${n}00.25` });

/** Una fila como las de antes del #11: el crudo en claro. */
async function filaEnClaro(crudo: Prisma.InputJsonValue = crudoFicticio(), tipoFuente: TipoFuente = "TRII_CAJA") {
  return db.filaFuente.create({ data: { tipoFuente, claveNatural: claveNatural(), ocurrencia: 1, primeraCargaId: cargaId, primeraFilaNo: n, crudo } });
}

async function filaCifrada(llavero = obtenerLlavero()) {
  const llave: LlaveFilaFuente = { tipoFuente: "TRII_CAJA", claveNatural: claveNatural(), ocurrencia: 1 };
  const crudo = crudoFicticio();
  const fila = await db.filaFuente.create({
    data: { tipoFuente: "TRII_CAJA", claveNatural: llave.claveNatural, ocurrencia: 1, primeraCargaId: cargaId, primeraFilaNo: n, crudo: cifrarCrudo(crudo, llave, llavero) },
  });
  return { fila, crudo };
}

/** Un fondo de una certificación (ficticia) con el encargo que devuelva `encargo` para su llave. */
async function certFondo(encargo: (llave: { certificacionId: string; instrumentoId: string }) => string) {
  const k = siguiente();
  const carga = await db.cargaArchivo.create({
    data: { tipoFuente: "AV_CERTIFICACION", nombreArchivo: `cert-${k}.ficticio.pdf`, sha256: "c".repeat(64), estado: "CARGADO", cargadoPorId: duenoId },
  });
  const certificacion = await db.certificacion.create({
    data: { cargaId: carga.id, fechaCorte: new Date(k * DIA_MS), saldoEfectivo: new Prisma.Decimal("0") },
  });
  const instrumento = await db.instrumento.create({ data: { tipo: "FIC", nombre: `Fondo ficticio ${corrida}-${k}`, codigoFic: `F${corrida}${k}` } });
  const llave = { certificacionId: certificacion.id, instrumentoId: instrumento.id };
  return db.certificacionFondo.create({ data: { ...llave, encargo: encargo(llave), saldo: new Prisma.Decimal("7.5") } });
}

const leerFila = (id: string) => db.filaFuente.findUniqueOrThrow({ where: { id } });
const leerCert = (f: { certificacionId: string; instrumentoId: string }) =>
  db.certificacionFondo.findUniqueOrThrow({ where: { certificacionId_instrumentoId: { certificacionId: f.certificacionId, instrumentoId: f.instrumentoId } } });
const aplicar = (extra: Partial<OpcionesMigracion> = {}) => cifrarExistentes(db, { aplicar: true, reCifrar: false, base: BASE, ...extra });

/**
 * Huella (conteo + md5) de cada tabla de la base. De fila_fuente se excluye `crudo` y de
 * certificacion_fondo, `encargo`: son las dos únicas columnas que la migración puede cambiar.
 */
async function huellas(): Promise<Record<string, { n: number; h: string }>> {
  const columnas = await db.$queryRaw<{ tabla: string; columna: string }[]>`
    SELECT table_name AS tabla, column_name AS columna FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name <> '_prisma_migrations' ORDER BY table_name, ordinal_position`;
  const excluidas = new Set(["fila_fuente.crudo", "certificacion_fondo.encargo"]);
  const porTabla = new Map<string, string[]>();
  for (const { tabla, columna } of columnas) {
    if (!excluidas.has(`${tabla}.${columna}`)) porTabla.set(tabla, [...(porTabla.get(tabla) ?? []), columna]);
  }
  const q = (id: string) => `"${id.replace(/"/g, '""')}"`; // nombres del catálogo, citados
  const resultado: Record<string, { n: number; h: string }> = {};
  for (const [tabla, cols] of porTabla) {
    const [fila] = await db.$queryRawUnsafe<{ n: number; h: string }[]>(
      `SELECT count(*)::int AS n, md5(coalesce(string_agg(f, '|' ORDER BY f), '')) AS h FROM (SELECT ROW(${cols.map(q).join(", ")})::text AS f FROM ${q(tabla)}) s`,
    );
    resultado[tabla] = fila!;
  }
  return resultado;
}

beforeAll(async () => {
  BASE = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!BASE.endsWith("_test")) throw new Error(`Se negó a correr sobre «${BASE}»: solo bases *_test`);
  duenoId = (await db.usuario.create({ data: { email: `dueno-cif-${corrida}@ejemplo.invalid`, rol: "DUENO" } })).id;
  cargaId = (
    await db.cargaArchivo.create({
      data: { tipoFuente: "TRII_CAJA", nombreArchivo: "legado.ficticio.csv", sha256: "b".repeat(64), estado: "CARGADO", cargadoPorId: duenoId },
    })
  ).id;
});

afterEach(() => vi.unstubAllEnvs());
afterAll(async () => {
  await db.$disconnect();
});

describe("llavero de las pruebas", () => {
  it("solo trae la v1 aleatoria: CIFRADO_CLAVE_V2…V9 están fijadas vacías (una clave real del entorno o de la .env no entra)", () => {
    for (let v = 2; v <= 9; v += 1) expect(process.env[`CIFRADO_CLAVE_V${v}`]).toBe("");
    expect([...obtenerLlavero().claves.keys()]).toEqual(["v1"]);
  });
});

describe("ensayo (por defecto)", () => {
  it("cuenta lo que hay y no escribe nada", async () => {
    const fila = await filaEnClaro();
    const cert = await certFondo(() => "ENC-FICT-ENSAYO");
    const antes = await huellas();
    const r = await cifrarExistentes(db, { aplicar: false, reCifrar: false });
    expect(r).toMatchObject({ base: BASE, activa: "v1", escribe: false });
    expect(r.filaFuente.enClaro).toBeGreaterThanOrEqual(1);
    expect(r.certificacionFondo.enClaro).toBeGreaterThanOrEqual(1);
    expect([r.filaFuente.cifradasAhora, r.certificacionFondo.cifradasAhora, r.filaFuente.reCifradasAhora]).toEqual([0, 0, 0]);
    expect((await leerFila(fila.id)).crudo).toEqual(fila.crudo);
    expect((await leerCert(cert)).encargo).toBe("ENC-FICT-ENSAYO");
    expect(await huellas()).toEqual(antes);
  });
});

describe("candados antes de escribir", () => {
  it.each([["sin --base", undefined], ["con otra base", "otra_base_test"]])("--aplicar %s: BASE_NO_COINCIDE y nada cambia", async (_caso, base) => {
    const fila = await filaEnClaro();
    const intento = cifrarExistentes(db, { aplicar: true, reCifrar: false, base });
    await expect(intento).rejects.toBeInstanceOf(ErrorMigracion);
    await expect(intento).rejects.toMatchObject({ codigo: "BASE_NO_COINCIDE" });
    expect((await leerFila(fila.id)).crudo).toEqual(fila.crudo);
  });

  it.each([
    ["sin la activa", { CIFRADO_CLAVE_ACTIVA: "" }, "CLAVE_ACTIVA_AUSENTE"],
    ["la activa sin su clave", { CIFRADO_CLAVE_ACTIVA: "v8" }, "CLAVE_AUSENTE"],
  ])("%s: falla cerrado (ErrorCifrado) antes de escribir, también en el ensayo", async (_caso, entorno, codigo) => {
    const fila = await filaEnClaro();
    for (const [k, v] of Object.entries(entorno)) vi.stubEnv(k, v);
    await expect(aplicar()).rejects.toMatchObject({ name: "ErrorCifrado", codigo });
    await expect(cifrarExistentes(db, { aplicar: false, reCifrar: false })).rejects.toBeInstanceOf(ErrorCifrado);
    expect((await leerFila(fila.id)).crudo).toEqual(fila.crudo);
  });
});

describe("--aplicar", () => {
  it("cifra lo que está en claro en las dos tablas, por lotes, y descifrar devuelve el original", async () => {
    const originales = [crudoFicticio(), crudoFicticio(), crudoFicticio()];
    const filas = await Promise.all(originales.map((c) => filaEnClaro(c)));
    const cert = await certFondo(() => "ENC-FICT-SIETE");
    const r = await aplicar({ lote: 2 });
    expect(r.escribe).toBe(true);
    expect(r.filaFuente.cifradasAhora).toBeGreaterThanOrEqual(3);
    expect(r.certificacionFondo.cifradasAhora).toBeGreaterThanOrEqual(1);
    for (const [i, f] of filas.entries()) {
      const ahora = await leerFila(f.id);
      expect(esSobre(ahora.crudo)).toBe(true);
      expect((ahora.crudo as { kid: string }).kid).toBe("v1");
      expect(descifrarCrudo(ahora.crudo, llaveDe(ahora))).toEqual(originales[i]);
    }
    const encargo = (await leerCert(cert)).encargo;
    expect(encargo).not.toContain("SIETE");
    expect(descifrarEncargo(encargo, cert)).toBe("ENC-FICT-SIETE");
  });

  it("es idempotente: la segunda corrida no cifra nada y deja los mismos sobres", async () => {
    const fila = await filaEnClaro();
    const cert = await certFondo(() => "ENC-FICT-IDEM");
    await aplicar();
    const [f1, c1] = [await leerFila(fila.id), await leerCert(cert)];
    const r2 = await aplicar({ lote: 3 });
    expect([r2.filaFuente.enClaro, r2.filaFuente.cifradasAhora, r2.certificacionFondo.enClaro, r2.certificacionFondo.cifradasAhora]).toEqual([0, 0, 0, 0]);
    expect((await leerFila(fila.id)).crudo).toEqual(f1.crudo);
    expect((await leerCert(cert)).encargo).toBe(c1.encargo);
  });

  it("no toca lo anómalo ni lo ya cifrado: los cuenta", async () => {
    const anomala = await filaEnClaro({ v: 1, ct: "roto" });
    const { fila: cifrada } = await filaCifrada();
    const certAnomalo = await certFondo(() => '{"v":1}');
    const certCifrado = await certFondo((llave) => cifrarEncargo("ENC-FICT-YA", llave));
    const r = await aplicar();
    expect(r.filaFuente.anomalas).toBeGreaterThanOrEqual(1);
    expect(r.certificacionFondo.anomalas).toBeGreaterThanOrEqual(1);
    expect(r.filaFuente.porVersion.v1).toBeGreaterThanOrEqual(1);
    expect((await leerFila(anomala.id)).crudo).toEqual({ v: 1, ct: "roto" });
    expect((await leerFila(cifrada.id)).crudo).toEqual(cifrada.crudo);
    expect((await leerCert(certAnomalo)).encargo).toBe('{"v":1}');
    expect((await leerCert(certCifrado)).encargo).toBe(certCifrado.encargo);
  });

  it("un sobre de una versión sin clave cargada se cuenta (sinClave) y no se toca", async () => {
    const ajena = obtenerLlavero({ CIFRADO_CLAVE_ACTIVA: "v7", CIFRADO_CLAVE_V7: randomBytes(32).toString("base64") });
    const { fila } = await filaCifrada(ajena);
    const r = await aplicar({ reCifrar: true });
    expect(r.filaFuente.sinClave).toBeGreaterThanOrEqual(1);
    expect((await leerFila(fila.id)).crudo).toEqual(fila.crudo);
  });

  it("un sobre que no abre con la clave cargada de su versión (otra clave con el mismo nombre) se cuenta (noAbren), no se toca y no detiene la corrida", async () => {
    vi.stubEnv("CIFRADO_CLAVE_V3", randomBytes(32).toString("base64"));
    const impostora = obtenerLlavero({ CIFRADO_CLAVE_ACTIVA: "v3", CIFRADO_CLAVE_V3: randomBytes(32).toString("base64") });
    const { fila } = await filaCifrada(impostora);
    const cert = await certFondo((llave) => cifrarEncargo("ENC-FICT-NOABRE", llave, impostora));
    const ensayo = await cifrarExistentes(db, { aplicar: false, reCifrar: false });
    expect(ensayo.filaFuente.noAbren).toBeGreaterThanOrEqual(1);
    expect(ensayo.certificacionFondo.noAbren).toBeGreaterThanOrEqual(1);
    const r = await aplicar({ reCifrar: true });
    expect(r.filaFuente.noAbren).toBeGreaterThanOrEqual(1);
    expect((await leerFila(fila.id)).crudo).toEqual(fila.crudo);
    expect((await leerCert(cert)).encargo).toBe(cert.encargo);
  });

  it("comparar y reemplazar: si otro cambió el valor entre la lectura y la escritura, no se pisa y se cuenta en concurrentes", async () => {
    const fila = await filaEnClaro();
    const cert = await certFondo(() => "ENC-FICT-CAS");
    const otra = new PrismaClient();
    const concurrente = { "Valor total": "cambiado por otro" };
    try {
      // Justo antes de cada escritura de la migración, otra conexión cambia ese mismo valor.
      const conCarrera = db.$extends({
        query: {
          filaFuente: {
            async updateMany({ args, query }) {
              if ((args.where as { id?: string } | undefined)?.id === fila.id) {
                await otra.$transaction(async (tx) => {
                  await tx.$executeRaw`SET LOCAL inv.reversion = 'on'`;
                  await tx.filaFuente.update({ where: { id: fila.id }, data: { crudo: concurrente } });
                });
              }
              return query(args);
            },
          },
          certificacionFondo: {
            async updateMany({ args, query }) {
              if ((args.where as { certificacionId?: string } | undefined)?.certificacionId === cert.certificacionId) {
                await otra.certificacionFondo.update({
                  where: { certificacionId_instrumentoId: { certificacionId: cert.certificacionId, instrumentoId: cert.instrumentoId } },
                  data: { encargo: "ENC-FICT-OTRO" },
                });
              }
              return query(args);
            },
          },
        },
      }) as unknown as PrismaClient;
      const r = await cifrarExistentes(conCarrera, { aplicar: true, reCifrar: false, base: BASE });
      expect(r.filaFuente.concurrentes).toBeGreaterThanOrEqual(1);
      expect(r.certificacionFondo.concurrentes).toBeGreaterThanOrEqual(1);
      expect((await leerFila(fila.id)).crudo).toEqual(concurrente);
      expect((await leerCert(cert)).encargo).toBe("ENC-FICT-OTRO");
    } finally {
      await otra.$disconnect();
    }
  });

  it("solo cambia fila_fuente.crudo y certificacion_fondo.encargo: el resto de la base queda idéntico", async () => {
    const fila = await filaEnClaro();
    const cert = await certFondo(() => "ENC-FICT-HUELLA");
    const antes = await huellas();
    await aplicar({ reCifrar: true, lote: 2 });
    expect(await huellas()).toEqual(antes);
    expect(esSobre((await leerFila(fila.id)).crudo)).toBe(true);
    expect((await leerCert(cert)).encargo).not.toBe("ENC-FICT-HUELLA");
  });

  it("después de migrar, el disparador de solo inserción sigue bloqueando (el bypass no se queda abierto)", async () => {
    const fila = await filaEnClaro();
    await aplicar();
    await expect(db.filaFuente.update({ where: { id: fila.id }, data: { crudo: {} } })).rejects.toThrow(/solo inserción/);
    await expect(db.$transaction((tx) => tx.filaFuente.update({ where: { id: fila.id }, data: { crudo: {} } }))).rejects.toThrow(/solo inserción/);
  });

  it("reimportar después de migrar no duplica (la clave natural no depende del crudo)", async () => {
    const n = `MIG${corrida}`.toUpperCase().slice(0, 20);
    const archivo = new TextEncoder().encode(`Fecha y hora,Ticker,Estado,Valor total\n2026-01-21,${n},,100.0\n2026-04-15,${n},,110.0\n`);
    const primera = await importarArchivoTrii(db, { nombreArchivo: "mig-1.ficticio.csv", contenido: archivo, usuarioId: duenoId });
    expect(primera).toMatchObject({ estado: "CARGADO", filasNuevas: 2 });
    const filas = await db.filaFuente.findMany({ where: { primeraCargaId: primera.cargaId } });
    const enClaro = new Map(filas.map((f) => [f.id, descifrarCrudo(f.crudo, llaveDe(f))]));
    // Como antes del #11: el crudo vuelve a quedar en claro (solo la prueba usa el bypass para esto).
    await db.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL inv.reversion = 'on'`;
      for (const [id, crudo] of enClaro) await tx.filaFuente.update({ where: { id }, data: { crudo } });
    });
    await aplicar();
    const segunda = await importarArchivoTrii(db, { nombreArchivo: "mig-2.ficticio.csv", contenido: archivo, usuarioId: duenoId });
    expect(segunda).toMatchObject({ estado: "CARGADO", filasNuevas: 0, filasRepetidas: 2 });
    expect(await db.dividendo.count({ where: { instrumento: { nemotecnico: n } } })).toBe(2);
    for (const f of await db.filaFuente.findMany({ where: { id: { in: [...enClaro.keys()] } } })) {
      expect(descifrarCrudo(f.crudo, llaveDe(f))).toEqual(enClaro.get(f.id));
    }
  });
});

describe("--re-cifrar (rotación de la clave)", () => {
  it("pasa los sobres de otra versión a la activa, es idempotente, y lo nuevo abre sin la clave vieja", async () => {
    const V1 = process.env.CIFRADO_CLAVE_V1!;
    const V2 = randomBytes(32).toString("base64");
    const { fila, crudo } = await filaCifrada(); // v1, la activa de la configuración
    const cert = await certFondo((llave) => cifrarEncargo("ENC-FICT-ROTA", llave));

    vi.stubEnv("CIFRADO_CLAVE_V2", V2);
    vi.stubEnv("CIFRADO_CLAVE_ACTIVA", "v2");
    const ensayo = await cifrarExistentes(db, { aplicar: false, reCifrar: false });
    expect(ensayo.activa).toBe("v2");
    expect(ensayo.filaFuente.porVersion.v1).toBeGreaterThanOrEqual(1);
    expect((await leerFila(fila.id)).crudo).toEqual(fila.crudo);

    const r = await cifrarExistentes(db, { aplicar: false, reCifrar: true, base: BASE, lote: 2 });
    expect(r.filaFuente.reCifradasAhora).toBeGreaterThanOrEqual(1);
    expect(r.certificacionFondo.reCifradasAhora).toBeGreaterThanOrEqual(1);
    const soloV2 = obtenerLlavero({ CIFRADO_CLAVE_ACTIVA: "v2", CIFRADO_CLAVE_V2: V2 });
    const rotada = await leerFila(fila.id);
    expect((rotada.crudo as { kid: string }).kid).toBe("v2");
    expect(descifrarCrudo(rotada.crudo, llaveDe(rotada), soloV2)).toEqual(crudo);
    expect(descifrarEncargo((await leerCert(cert)).encargo, cert, soloV2)).toBe("ENC-FICT-ROTA");

    const otraVez = await cifrarExistentes(db, { aplicar: false, reCifrar: true, base: BASE });
    expect([otraVez.filaFuente.reCifradasAhora, otraVez.certificacionFondo.reCifradasAhora]).toEqual([0, 0]);
    expect((await leerFila(fila.id)).crudo).toEqual(rotada.crudo);

    // Lo importado con la v2 activa sale con kid v2.
    const ticker = `ROT${corrida}`.toUpperCase().slice(0, 20);
    const imp = await importarArchivoTrii(db, {
      nombreArchivo: "rota.ficticio.csv", usuarioId: duenoId,
      contenido: new TextEncoder().encode(`Fecha y hora,Ticker,Estado,Valor total\n2026-02-09,${ticker},,5.0\n`),
    });
    expect(imp.estado).toBe("CARGADO");
    const nueva = await db.filaFuente.findFirstOrThrow({ where: { primeraCargaId: imp.cargaId } });
    expect((nueva.crudo as { kid: string }).kid).toBe("v2");

    // De vuelta a la v1 (la de los demás archivos de integración), con el mismo camino.
    vi.stubEnv("CIFRADO_CLAVE_ACTIVA", "v1");
    expect(process.env.CIFRADO_CLAVE_V1).toBe(V1);
    await cifrarExistentes(db, { aplicar: false, reCifrar: true, base: BASE });
    expect(((await leerFila(fila.id)).crudo as { kid: string }).kid).toBe("v1");
    expect(((await leerFila(nueva.id)).crudo as { kid: string }).kid).toBe("v1");
  });
});
