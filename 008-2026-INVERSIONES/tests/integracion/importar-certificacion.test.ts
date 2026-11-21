// Importador de la certificación de A&V (PR-B) contra la base de PRUEBAS, con PDF ficticios generados en la
// prueba (datos inventados). Reimportar no duplica; misma fecha con otras cifras se rechaza; una fila inválida
// rechaza el archivo entero; el encargo y las filas crudas se guardan cifrados; cada cifra apunta a su fila.
import { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { descifrarCrudo, descifrarEncargo, esCrudo } from "@/cifrado/campos";
import { esSobre } from "@/cifrado/sobre";
import { importarCertificacion, type ArchivoCertificacion } from "@/importacion/av/importar";
import { CERTIFICACION_FICTICIA, generarCertificacionPdf, type EspecCertificacion } from "../fixtures/av/certificacion.ficticio";

const db = new PrismaClient();
const corrida = Date.now().toString(36).toUpperCase().slice(-5);
let k = 0;
let duenoId = "";

/** Un miércoles distinto de 2027 por caso (año sembrado, sin festivos en miércoles en este rango). */
function caso() {
  k += 1;
  const fecha = new Date(Date.UTC(2027, 2, 3) + (k - 1) * 7 * 86_400_000);
  const dia = fecha.toISOString().slice(0, 10).replace(/-/g, "");
  const siguiente = new Date(fecha.getTime() + 86_400_000).toISOString().slice(0, 10).replace(/-/g, "");
  const nemos = ["A", "B", "C"].map((l) => `I${corrida}${k}${l}`);
  const nit = `99900${String(k).padStart(4, "0")}-0`;
  const codigoFic = `7${String(k).padStart(3, "0")}${corrida.replace(/\D/g, "").padEnd(3, "0").slice(0, 3)}`;
  const espec: EspecCertificacion = {
    ...CERTIFICACION_FICTICIA,
    fondos: [{ ...CERTIFICACION_FICTICIA.fondos[0]!, nit }],
    // El ficticio trae 2 lotes de la primera especie y uno de cada una de las otras dos.
    rentaVariable: CERTIFICACION_FICTICIA.rentaVariable.map((f, i) => ({ ...f, nemo: nemos[[0, 0, 1, 2][i]!]! })),
    creadoEn: `D:${siguiente}101500-05'00'`,
  };
  return { fecha, dia, nemos, nit, codigoFic, espec, hoy: new Date(fecha.getTime() + 2 * 86_400_000) };
}

type Caso = ReturnType<typeof caso>;
const archivo = (c: Caso, extra: Partial<ArchivoCertificacion> = {}, espec: EspecCertificacion = c.espec): ArchivoCertificacion => ({
  contenido: generarCertificacionPdf(espec), usuarioId: duenoId, fechaCorte: c.fecha, fondoCodigo: c.codigoFic, hoy: c.hoy, ...extra,
});
const registrarFondo = (c: Caso) => db.instrumento.create({ data: { tipo: "FIC", codigoFic: c.codigoFic, nombre: "Fondo ficticio" } });

beforeAll(async () => {
  const base = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!base.endsWith("_test")) throw new Error(`Se negó a correr sobre «${base}»`);
  duenoId = (await db.usuario.create({ data: { email: `dueno-cert-${corrida.toLowerCase()}@ejemplo.invalid`, rol: "DUENO" } })).id;
});

afterAll(async () => {
  await db.$disconnect();
});

describe("importarCertificacion: carga y trazabilidad", () => {
  it("importa el PDF: certificación, posiciones por especie, fondo y efectivo, cada cifra con su fila", async () => {
    const c = caso();
    const fic = await registrarFondo(c);
    const r = await importarCertificacion(db, archivo(c));
    expect(r).toMatchObject({ estado: "CARGADO", repetida: false, filasTotal: 6, filasNuevas: 6, filasRepetidas: 0, instrumentosCreados: 3, fondoVinculado: true, errores: [] });
    const cert = await db.certificacion.findUniqueOrThrow({ where: { fechaCorte: c.fecha }, include: { posiciones: { include: { instrumento: true } }, fondos: true, carga: true } });
    expect([cert.saldoEfectivo.toString(), cert.referenciaEfectivo, cert.carga.nombreArchivo, cert.carga.estado]).toEqual(["1000", "p2:f6", `certificacion-av-${c.fecha.toISOString().slice(0, 10)}.pdf`, "CARGADO"]);
    const posiciones = cert.posiciones.map((p) => [p.instrumento.nemotecnico, p.cantidad, p.precioValoracion.toString(), p.valorMercado.toString(), p.referenciaPdf]).sort();
    expect(posiciones).toEqual([
      [c.nemos[0], 150n, "1000", "150000", "p1:f2,p1:f3"],
      [c.nemos[1], 2000n, "20", "40000", "p1:f4"],
      [c.nemos[2], 10n, "30000", "300000", "p1:f5"],
    ]);
    expect(cert.fondos.map((f) => [f.instrumentoId, f.saldo.toString(), f.referenciaPdf])).toEqual([[fic.id, "5000000", "p1:f1"]]);
    expect((await db.instrumento.findUniqueOrThrow({ where: { id: fic.id } })).nitFondo).toBe(c.nit);
  });

  it("guarda el encargo cifrado, atado a su certificación y su fondo, y las filas crudas cifradas y sin datos de cuenta", async () => {
    const c = caso();
    await registrarFondo(c);
    const r = await importarCertificacion(db, archivo(c));
    const cert = await db.certificacion.findUniqueOrThrow({ where: { fechaCorte: c.fecha }, include: { fondos: true } });
    const f = cert.fondos[0]!;
    expect(f.encargo).not.toContain("000000001");
    expect(esSobre(JSON.parse(f.encargo))).toBe(true);
    expect(descifrarEncargo(f.encargo, { certificacionId: f.certificacionId, instrumentoId: f.instrumentoId })).toBe("000000001");
    const filas = await db.filaFuente.findMany({ where: { primeraCargaId: r.cargaId }, orderBy: { primeraFilaNo: "asc" } });
    expect(filas.map((x) => [x.tipoFuente, x.primeraFilaNo])).toEqual([1, 2, 3, 4, 5, 6].map((n) => ["AV_CERTIFICACION", n]));
    for (const x of filas) expect(esCrudo(x.crudo)).toBe(false);
    const claros = filas.map((x) => descifrarCrudo(x.crudo, x));
    expect(claros[5]).toEqual({ seccion: "SALDO EN EFECTIVO", pagina: "2", SALDO: "COP 1.000,00" });
    expect(JSON.stringify(claros)).not.toMatch(/Titular|"00000"/);
    expect(await db.filaDeCarga.count({ where: { cargaId: r.cargaId } })).toBe(6);
  });
});

describe("importarCertificacion: reimportar no duplica y lo importado no se edita", () => {
  it("el mismo PDF otra vez: CARGADO como repetida, 0 filas nuevas, una sola certificación", async () => {
    const c = caso();
    await registrarFondo(c);
    const primera = await importarCertificacion(db, archivo(c));
    const segunda = await importarCertificacion(db, archivo(c));
    expect(segunda).toMatchObject({ estado: "CARGADO", repetida: true, filasNuevas: 0, filasRepetidas: 6, certificacionId: primera.certificacionId });
    expect(await db.certificacion.count({ where: { fechaCorte: c.fecha } })).toBe(1);
    expect(await db.filaDeCarga.count({ where: { cargaId: segunda.cargaId } })).toBe(6);
  });

  it("la misma fecha con otras cifras se rechaza (CONFLICTO_CERTIFICACION) y no toca lo guardado", async () => {
    const c = caso();
    await registrarFondo(c);
    await importarCertificacion(db, archivo(c));
    const otra = { ...c.espec, efectivo: [{ ...c.espec.efectivo[0]!, saldo: "COP 2.000,00" }] };
    const r = await importarCertificacion(db, archivo(c, {}, otra));
    expect(r).toMatchObject({ estado: "RECHAZADO", certificacionId: null, errores: [{ pagina: 0, fila: 0, columna: null, codigo: "CONFLICTO_CERTIFICACION" }] });
    expect((await db.certificacion.findUniqueOrThrow({ where: { fechaCorte: c.fecha } })).saldoEfectivo.toString()).toBe("1000");
    expect(await db.filaFuente.count({ where: { primeraCargaId: r.cargaId } })).toBe(0);
  });

  it("una fila de menos con la misma fecha también es conflicto (se compara en los dos sentidos)", async () => {
    const c = caso();
    await registrarFondo(c);
    await importarCertificacion(db, archivo(c));
    const menos = { ...c.espec, rentaVariable: c.espec.rentaVariable.slice(0, 3) };
    expect((await importarCertificacion(db, archivo(c, {}, menos))).errores.map((e) => e.codigo)).toEqual(["CONFLICTO_CERTIFICACION"]);
  });

  it("el mismo archivo con otra fecha de corte se rechaza (ARCHIVO_YA_CARGADO)", async () => {
    const c = caso();
    await registrarFondo(c);
    await importarCertificacion(db, archivo(c));
    const r = await importarCertificacion(db, archivo(c, { fechaCorte: new Date(c.fecha.getTime() - 86_400_000) }));
    expect(r.errores.map((e) => e.codigo)).toEqual(["ARCHIVO_YA_CARGADO"]);
  });
});

describe("importarCertificacion: una fila inválida rechaza el archivo entero", () => {
  const sinNada = async (cargaId: string, fecha: Date) => {
    expect(await db.filaFuente.count({ where: { primeraCargaId: cargaId } })).toBe(0);
    expect(await db.certificacion.count({ where: { fechaCorte: fecha } })).toBe(0);
    const carga = await db.cargaArchivo.findUniqueOrThrow({ where: { id: cargaId } });
    expect([carga.estado, carga.tipoFuente]).toEqual(["RECHAZADO", "AV_CERTIFICACION"]);
    return carga;
  };

  it("cantidad × precio que no da el valor: RECHAZADO con página, fila y columna, sin valores", async () => {
    const c = caso();
    await registrarFondo(c);
    const mala = { ...c.espec, rentaVariable: [{ ...c.espec.rentaVariable[0]!, valor: "COP 100.700,00" }, ...c.espec.rentaVariable.slice(1)] };
    const r = await importarCertificacion(db, archivo(c, {}, mala));
    expect(r).toMatchObject({ estado: "RECHAZADO", errores: [{ pagina: 1, fila: 2, columna: "VALOR DE MERCADO", codigo: "VALOR_INCOHERENTE" }] });
    const carga = await sinNada(r.cargaId, c.fecha);
    expect(JSON.stringify(carga.errores)).not.toMatch(/100\.700|I[A-Z0-9]{5}/);
    expect(await db.instrumento.count({ where: { nemotecnico: { in: c.nemos } } })).toBe(0);
  });

  it("un PDF roto o que no es de A&V: RECHAZADO con el código del lector", async () => {
    const c = caso();
    const roto = await importarCertificacion(db, { ...archivo(c), contenido: new TextEncoder().encode("no soy un PDF") });
    expect(roto.errores.map((e) => e.codigo)).toEqual(["PDF_INVALIDO"]);
    await sinNada(roto.cargaId, c.fecha);
  });

  it("una fecha de corte que no es día hábil, o posterior al PDF: RECHAZADO", async () => {
    const c = caso();
    await registrarFondo(c);
    const sabado = new Date(c.fecha.getTime() + 3 * 86_400_000);
    expect((await importarCertificacion(db, archivo(c, { fechaCorte: sabado, hoy: new Date(sabado.getTime() + 86_400_000) }))).errores.map((e) => e.codigo)).toEqual(["FECHA_CORTE_NO_HABIL"]);
    const despues = new Date(c.fecha.getTime() + 6 * 86_400_000);
    expect((await importarCertificacion(db, archivo(c, { fechaCorte: despues, hoy: new Date(despues.getTime() + 86_400_000) }))).errores.map((e) => e.codigo)).toEqual(["FECHA_CORTE_POSTERIOR_AL_PDF"]);
  });
});

describe("importarCertificacion: el fondo se reconoce por su NIT", () => {
  it("sin --fondo y con un NIT desconocido: RECHAZADO FONDO_NIT_DESCONOCIDO, con la fila del fondo", async () => {
    const c = caso();
    await registrarFondo(c);
    const r = await importarCertificacion(db, archivo(c, { fondoCodigo: null }));
    expect(r.errores).toEqual([{ pagina: 1, fila: 1, columna: "NIT DEL FONDO", codigo: "FONDO_NIT_DESCONOCIDO" }]);
  });

  it("con --fondo de un código que no está registrado como FIC: RECHAZADO FONDO_NO_REGISTRADO", async () => {
    const c = caso();
    expect((await importarCertificacion(db, archivo(c))).errores.map((e) => e.codigo)).toEqual(["FONDO_NO_REGISTRADO"]);
  });

  it("vinculado una vez, la siguiente certificación lo reconoce sin --fondo", async () => {
    const c = caso();
    const fic = await registrarFondo(c);
    await importarCertificacion(db, archivo(c));
    const d = caso();
    const espec = { ...d.espec, fondos: c.espec.fondos };
    const r = await importarCertificacion(db, archivo(d, { fondoCodigo: null }, espec));
    expect(r).toMatchObject({ estado: "CARGADO", fondoVinculado: false });
    const fondos = await db.certificacionFondo.findMany({ where: { certificacion: { fechaCorte: d.fecha } } });
    expect(fondos.map((f) => f.instrumentoId)).toEqual([fic.id]);
  });

  it("con --fondo de un FIC ya vinculado a otro NIT: RECHAZADO FONDO_NO_COINCIDE", async () => {
    const c = caso();
    await db.instrumento.create({ data: { tipo: "FIC", codigoFic: c.codigoFic, nombre: "Fondo ficticio", nitFondo: "99988877-1" } });
    expect((await importarCertificacion(db, archivo(c))).errores.map((e) => e.codigo)).toEqual(["FONDO_NO_COINCIDE"]);
  });
});

describe("importarCertificacion: quién carga y con qué llaves", () => {
  it("un usuario que no es DUENO activo no importa (lanza, sin carga)", async () => {
    const c = caso();
    const familia = await db.usuario.create({ data: { email: `familia-cert-${corrida.toLowerCase()}@ejemplo.invalid`, rol: "FAMILIA" } });
    const antes = await db.cargaArchivo.count();
    await expect(importarCertificacion(db, archivo(c, { usuarioId: familia.id }))).rejects.toMatchObject({ codigo: "USUARIO_NO_AUTORIZADO" });
    expect(await db.cargaArchivo.count()).toBe(antes);
  });

  it("sin llavero de cifrado falla cerrado antes de escribir nada", async () => {
    const c = caso();
    const activa = process.env.CIFRADO_CLAVE_ACTIVA;
    const antes = await db.cargaArchivo.count();
    process.env.CIFRADO_CLAVE_ACTIVA = "";
    try {
      await expect(importarCertificacion(db, archivo(c))).rejects.toMatchObject({ name: "ErrorCifrado" });
    } finally {
      process.env.CIFRADO_CLAVE_ACTIVA = activa;
    }
    expect(await db.cargaArchivo.count()).toBe(antes);
  });

  it("los montos siguen en claro en sus columnas (solo el encargo y el crudo van cifrados, decisión #11)", async () => {
    const c = caso();
    await registrarFondo(c);
    await importarCertificacion(db, archivo(c));
    const [fila] = await db.$queryRaw<{ saldo: Prisma.Decimal }[]>`SELECT f.saldo FROM certificacion_fondo f JOIN certificacion c ON c.id = f."certificacionId" WHERE c."fechaCorte" = ${c.fecha}`;
    expect(fila!.saldo.toString()).toBe("5000000");
  });
});
