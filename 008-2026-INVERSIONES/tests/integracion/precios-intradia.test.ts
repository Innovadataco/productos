// Precios intradía (barras de 1 minuto de Yahoo `.CL`) contra la base de PRUEBAS, con un Yahoo FALSO de respuestas fijas
// e inventadas (sin red): la tabla de solo inserción, el camino único de escritura (sin duplicar), las especies
// (con lote o con regla en el plan vigente), el ciclo (día hábil, 429, fallos por especie, símbolo registrado), la
// depuración (retención) y los lectores. Al final, un día completo con 12 especies ficticias para medir la carga.
// Fechas de 2027 (calendario_bvc las trae sembradas: el 25 de marzo de 2027 es festivo). Especies `FICTICIA`.
import { randomBytes } from "node:crypto";
import { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { correrCicloIntradia } from "@/precios/intradia/ciclo";
import { depurarIntradia } from "@/precios/intradia/depurar";
import { especiesIntradia } from "@/precios/intradia/especies";
import { guardarBarras } from "@/precios/intradia/guardar";
import { preciosDelDia, ultimoPrecioIntradia } from "@/precios/intradia/leer";
import type { BarraIntradia } from "@/precios/intradia/yahoo";
import type { Buscar } from "@/precios/yahoo";

const db = new PrismaClient();
const corrida = Date.now().toString(36).toUpperCase().slice(-5);
const cot = (texto: string): Date => new Date(`${texto.replace(" ", "T")}:00-05:00`);
const URL_YAHOO = "https://yahoo.ficticio.invalid";
const MIN = 60_000;
let n = 0;
let usuarioId = "";
let cargaId = "";

const barra = (hora: string, precio: string, dia = "2027-02-09"): BarraIntradia => ({ instante: cot(`${dia} ${hora}`), precio });
async function accion(sufijo: string, opciones: { activo?: boolean; conLote?: boolean } = {}): Promise<string> {
  const id = (await db.instrumento.create({ data: { tipo: "ACCION", nemotecnico: `FICTICIA${sufijo}${corrida}`, nombre: "Ficticia SA", activo: opciones.activo ?? true } })).id;
  if (opciones.conLote) {
    n += 1;
    const dia = new Date("2027-01-12T00:00:00Z");
    const fila = await db.filaFuente.create({ data: { tipoFuente: "TRII_ORDENES", claveNatural: `intradia-${corrida}-${n}`, ocurrencia: 1, primeraCargaId: cargaId, primeraFilaNo: n, crudo: { ficticio: true } } });
    const cero = new Prisma.Decimal(0);
    const orden = await db.orden.create({
      data: {
        filaFuenteId: fila.id, ejecutadaEn: dia, fechaOperacion: dia, fechaLiquidacion: new Date("2027-01-14T00:00:00Z"), instrumentoId: id, lado: "COMPRA", estado: "APROBADO",
        cantidadCompletada: 10n, precioUnitario: new Prisma.Decimal(100), totalInvertido: new Prisma.Decimal(1000), comision: cero, totalEstimado: new Prisma.Decimal(1000),
      },
    });
    await db.lote.create({
      data: { instrumentoId: id, origen: "COMPRA", ordenId: orden.id, fuenteCosto: "TRII_ORDEN", fechaCompra: dia, fechaLiquidacion: new Date("2027-01-14T00:00:00Z"), cantidad: 10n, costoUnitario: new Prisma.Decimal(100), costoTotal: new Prisma.Decimal(1000) },
    });
  }
  return id;
}
const filas = (instrumentoId: string) => db.precioIntradia.findMany({ where: { instrumentoId }, orderBy: { instante: "asc" } });

/** Yahoo falso: devuelve, por símbolo, las barras (instante en segundos Unix y cierre) o un estado HTTP. */
function yahooFalso(porSimbolo: Record<string, readonly { t: number; c: number }[] | number>) {
  const pedidos: string[] = [];
  const buscar: Buscar = async (url) => {
    pedidos.push(url);
    const simbolo = decodeURIComponent(/\/chart\/([^?]+)\?/.exec(url)?.[1] ?? "");
    const dato = porSimbolo[simbolo];
    if (typeof dato === "number") return new Response("{}", { status: dato });
    const barras = dato ?? [];
    return new Response(
      JSON.stringify({
        chart: {
          result: [{ meta: { currency: "COP", exchangeDataDelayedBy: 20 }, timestamp: barras.map((b) => b.t), indicators: { quote: [{ close: barras.map((b) => b.c), volume: barras.map(() => 10) }] } }],
        },
      }),
    );
  };
  return { buscar, pedidos };
}
const seg = (texto: string): number => cot(texto).getTime() / 1000;
const sinPausa = async (): Promise<void> => undefined;

beforeAll(async () => {
  const base = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!base.endsWith("_test")) throw new Error(`Se negó a correr sobre «${base}»`);
  usuarioId = (await db.usuario.create({ data: { email: `dueno-intradia-${corrida.toLowerCase()}@ejemplo.invalid`, rol: "DUENO" } })).id;
  cargaId = (await db.cargaArchivo.create({ data: { tipoFuente: "TRII_ORDENES", nombreArchivo: "ordenes.ficticio.csv", sha256: randomBytes(32).toString("hex"), estado: "CARGADO", cargadoPorId: usuarioId } })).id;
});

afterAll(async () => {
  await db.$disconnect();
});

// Va primero: con solo estas 12 especies con lote en la base, la medida es exacta y la prueba corre más rápido.
describe("un día completo con 12 especies ficticias: peticiones y filas", () => {
  it("415 ciclos (09:30 a 16:24) × 12 especies = 4 980 pedidos; se guardan 390 barras por especie = 4 680 filas, sin duplicar", async () => {
    const especies: string[] = [];
    for (let i = 1; i <= 12; i++) especies.push(await accion(`Z${String(i).padStart(2, "0")}`, { conLote: true }));
    const simbolos = new Set(especies.map((_, i) => `FICTICIAZ${String(i + 1).padStart(2, "0")}${corrida}.CL`));
    const DIA = "2027-02-10";
    const inicio = cot(`${DIA} 09:30`).getTime();
    // Yahoo falso con retraso de 20 min: en cada pedido devuelve las barras de 09:30 a 15:59 cuyo instante ya pasó hace ≥ 20 min.
    let pedidos = 0;
    let ahoraMs = inicio;
    const buscar: Buscar = async (url) => {
      const simbolo = decodeURIComponent(/\/chart\/([^?]+)\?/.exec(url)?.[1] ?? "");
      if (simbolos.has(simbolo)) pedidos += 1;
      const ts: number[] = [];
      for (let m = 0; m < 390; m++) {
        const t = inicio + m * MIN;
        if (t <= ahoraMs - 20 * MIN) ts.push(t / 1000);
      }
      return new Response(JSON.stringify({ chart: { result: [{ meta: { currency: "COP", exchangeDataDelayedBy: 20 }, timestamp: ts, indicators: { quote: [{ close: ts.map((_, i) => 1000 + i), volume: ts.map(() => 10) }] } }] } }));
    };
    let nuevas = 0;
    let ciclos = 0;
    let maximaPorCiclo = 0;
    for (ahoraMs = inicio; ahoraMs < cot(`${DIA} 16:25`).getTime(); ahoraMs += MIN) {
      // Solo las 12 especies de esta prueba: se mide con un buscador que responde vacío a las demás (otras pruebas dejan lotes).
      const r = await correrCicloIntradia(db, { buscar, ahora: new Date(ahoraMs + 5_000), urlYahoo: URL_YAHOO, pausaMs: 0, dormir: sinPausa });
      ciclos += 1;
      nuevas += r.barrasNuevas;
      maximaPorCiclo = Math.max(maximaPorCiclo, r.barrasNuevas);
    }
    const guardadasMias = await db.precioIntradia.count({ where: { instrumentoId: { in: especies } } });
    // Cada especie de la base responde con las mismas barras (el falso no distingue): la medida es por especie y por ciclo.
    expect(ciclos).toBe(415);
    expect(pedidos).toBe(415 * 12);
    expect(guardadasMias).toBe(390 * 12);
    expect(nuevas).toBeGreaterThanOrEqual(390 * 12);
    expect(maximaPorCiclo).toBeGreaterThan(0);
    // Sin duplicados: una fila por (especie, instante).
    const duplicadas = await db.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM (SELECT 1 FROM precio_intradia GROUP BY "instrumentoId", instante, fuente HAVING count(*) > 1) d`;
    expect(Number(duplicadas[0]!.n)).toBe(0);
  }, 240_000);
});

describe("precio_intradia · solo inserción y sin duplicados", () => {
  it("guarda las barras con la fuente yahoo, el retraso marcado y la hora de traída que pone la base", async () => {
    const id = await accion("G1");
    const nuevas = await guardarBarras(db, id, [barra("09:30", "1234.5"), barra("09:31", "1240")], true);
    expect(nuevas).toBe(2);
    const guardadas = await filas(id);
    expect(guardadas.map((f) => [f.instante.toISOString(), f.precio.toString(), f.fuente, f.conRetraso])).toEqual([
      [cot("2027-02-09 09:30").toISOString(), "1234.5", "yahoo", true],
      [cot("2027-02-09 09:31").toISOString(), "1240", "yahoo", true],
    ]);
    expect(Math.abs(guardadas[0]!.traidoEn.getTime() - Date.now())).toBeLessThan(60_000);
  });

  it("traer lo mismo otra vez no duplica ni cambia lo guardado (la primera barra gana); una barra nueva sí entra", async () => {
    const id = await accion("G2");
    await guardarBarras(db, id, [barra("09:30", "100")], true);
    expect(await guardarBarras(db, id, [barra("09:30", "999"), barra("09:31", "101")], true)).toBe(1);
    expect(await guardarBarras(db, id, [barra("09:30", "999"), barra("09:31", "101")], true)).toBe(0);
    expect((await filas(id)).map((f) => f.precio.toString())).toEqual(["100", "101"]);
  });

  it("sin barras no toca la base", async () => {
    expect(await guardarBarras(db, await accion("G3"), [], false)).toBe(0);
  });

  it("la misma barra de dos especies distintas entra para las dos", async () => {
    const a = await accion("G4");
    const b = await accion("G5");
    await guardarBarras(db, a, [barra("09:30", "10")], true);
    expect(await guardarBarras(db, b, [barra("09:30", "10")], true)).toBe(1);
  });

  it("la base no deja editar una fila ni borrar una reciente (solo inserción)", async () => {
    const id = await accion("S1");
    await guardarBarras(db, id, [barra("09:30", "10")], true);
    await expect(db.$executeRawUnsafe(`UPDATE precio_intradia SET precio = 11 WHERE "instrumentoId" = '${id}'`)).rejects.toThrow(/solo inserci/);
    await expect(db.$executeRawUnsafe(`DELETE FROM precio_intradia WHERE "instrumentoId" = '${id}'`)).rejects.toThrow(/solo inserci|retenci/);
    expect(await filas(id)).toHaveLength(1);
  });

  it("solo deja borrar lo de hace más de 60 días (la retención garantiza al menos 30 días hábiles)", async () => {
    const id = await accion("S2");
    const hace = (dias: number) => new Date(Date.now() - dias * 24 * 60 * MIN);
    await db.precioIntradia.createMany({
      data: [
        { instrumentoId: id, instante: hace(61), precio: new Prisma.Decimal(10), fuente: "yahoo", conRetraso: true },
        { instrumentoId: id, instante: hace(59), precio: new Prisma.Decimal(11), fuente: "yahoo", conRetraso: true },
      ],
    });
    await expect(db.$executeRawUnsafe(`DELETE FROM precio_intradia WHERE "instrumentoId" = '${id}' AND instante > now() - interval '60 days'`)).rejects.toThrow();
    await db.$executeRawUnsafe(`DELETE FROM precio_intradia WHERE "instrumentoId" = '${id}' AND instante < now() - interval '60 days'`);
    expect((await filas(id)).map((f) => f.precio.toString())).toEqual(["11"]);
  });

  it("CHECK: el precio es positivo y la fuente no está vacía", async () => {
    const id = await accion("C1");
    await expect(db.precioIntradia.create({ data: { instrumentoId: id, instante: cot("2027-02-09 09:30"), precio: new Prisma.Decimal(0), fuente: "yahoo", conRetraso: true } })).rejects.toThrow();
    await expect(db.precioIntradia.create({ data: { instrumentoId: id, instante: cot("2027-02-09 09:30"), precio: new Prisma.Decimal(1), fuente: "", conRetraso: true } })).rejects.toThrow();
  });
});

describe("especiesIntradia · con lote o con regla en el plan vigente", () => {
  it("incluye las acciones activas con lote o con regla en la versión VIGENTE del plan; excluye el resto", async () => {
    const conLote = await accion("E1", { conLote: true });
    const conRegla = await accion("E2");
    const reglaVieja = await accion("E3");
    const sinNada = await accion("E4");
    const inactiva = await accion("E5", { activo: false, conLote: true });
    const ultima = (await db.planVersion.findFirst({ orderBy: { version: "desc" }, select: { version: true } }))?.version ?? 0;
    const crear = (version: number, vigenteDesde: string) => db.planVersion.create({ data: { version, vigenteDesde: new Date(`${vigenteDesde}T00:00:00Z`), motivo: "ficticio", aprobadaPorId: usuarioId } });
    const vieja = await crear(ultima + 1, "2027-01-01");
    const vigente = await crear(ultima + 2, "2027-02-01");
    await crear(ultima + 3, "2027-12-01"); // futura: no es la vigente de febrero
    const regla = (planVersionId: string, instrumentoId: string | null) =>
      db.reglaPlan.create({ data: { planVersionId, instrumentoId, condicion: "CIERRE_BAJO", nivel: new Prisma.Decimal(100), accion: "NO_ACTUAR", detalle: "ficticio" } });
    await regla(vieja.id, reglaVieja);
    await regla(vigente.id, conRegla);
    await regla(vigente.id, null); // regla del portafolio: sin especie
    await regla(vigente.id, conLote); // con lote y con regla: una sola vez

    const especies = await especiesIntradia(db, new Date("2027-02-09T00:00:00Z"));
    const ids = especies.map((e) => e.id);
    expect(ids).toEqual(expect.arrayContaining([conLote, conRegla]));
    expect(ids).not.toContain(reglaVieja);
    expect(ids).not.toContain(sinNada);
    expect(ids).not.toContain(inactiva);
    expect(ids.filter((i) => i === conLote)).toHaveLength(1);
    expect(especies.find((e) => e.id === conRegla)?.nemotecnico).toBe(`FICTICIAE2${corrida}`);
  });
});

describe("correrCicloIntradia", () => {
  const AHORA = cot("2027-02-09 11:50");
  const ciclo = (buscar: Buscar, extra: { ahora?: Date; pausaMs?: number; dormir?: (ms: number) => Promise<void> } = {}) =>
    correrCicloIntradia(db, { buscar, ahora: extra.ahora ?? AHORA, urlYahoo: URL_YAHOO, pausaMs: extra.pausaMs ?? 0, dormir: extra.dormir ?? sinPausa });

  it("un día hábil: un pedido por especie, guarda las barras nuevas y a la segunda vuelta no hay duplicados", async () => {
    const a = await accion("L1", { conLote: true });
    const b = await accion("L2", { conLote: true });
    const nemoA = `FICTICIAL1${corrida}.CL`;
    const nemoB = `FICTICIAL2${corrida}.CL`;
    const yahoo = yahooFalso({
      [nemoA]: [{ t: seg("2027-02-09 09:30"), c: 100 }, { t: seg("2027-02-09 09:31"), c: 101 }],
      [nemoB]: [{ t: seg("2027-02-09 09:30"), c: 200 }],
    });
    const r1 = await ciclo(yahoo.buscar);
    expect(r1).toMatchObject({ codigo: 0, peticiones: yahoo.pedidos.length, fallidas: [] });
    expect(r1.barrasNuevas).toBeGreaterThanOrEqual(3);
    expect((await filas(a)).map((f) => f.precio.toString())).toEqual(["100", "101"]);
    expect((await filas(b)).map((f) => f.precio.toString())).toEqual(["200"]);
    const r2 = await ciclo(yahoo.buscar);
    expect(r2).toMatchObject({ codigo: 0, barrasNuevas: 0 });
    expect(await filas(a)).toHaveLength(2);
  });

  it("pide barras de 1 minuto de hoy a la URL configurada y usa el símbolo registrado de la especie", async () => {
    const id = await accion("L3", { conLote: true });
    await db.simboloPrecio.create({ data: { instrumentoId: id, proveedor: "yahoo", simbolo: `OTRO${corrida}.CL`, vigenteDesde: new Date("2027-01-01T00:00:00Z") } });
    const yahoo = yahooFalso({ [`OTRO${corrida}.CL`]: [{ t: seg("2027-02-09 09:30"), c: 7 }] });
    await ciclo(yahoo.buscar);
    const mio = yahoo.pedidos.find((u) => u.includes(`OTRO${corrida}.CL`));
    expect(mio).toBe(`${URL_YAHOO}/v8/finance/chart/OTRO${corrida}.CL?interval=1m&range=1d`);
    expect((await filas(id)).map((f) => f.precio.toString())).toEqual(["7"]);
  });

  it("un festivo del calendario BVC o un fin de semana: código 4, sin pedir nada a Yahoo", async () => {
    await accion("L4", { conLote: true });
    for (const dia of ["2027-03-25 11:00", "2027-02-13 11:00", "2027-02-14 11:00"]) {
      const yahoo = yahooFalso({});
      const r = await ciclo(yahoo.buscar, { ahora: cot(dia) });
      expect(r, dia).toMatchObject({ codigo: 4, peticiones: 0, barrasNuevas: 0 });
      expect(yahoo.pedidos, dia).toEqual([]);
    }
  });

  it("un año sin calendario sembrado: un día entre semana se trata como hábil y lo dice (sin inventar un festivo)", async () => {
    await accion("L5", { conLote: true });
    const yahoo = yahooFalso({});
    const r = await ciclo(yahoo.buscar, { ahora: cot("2031-02-11 11:00") });
    expect(r.codigo).not.toBe(4);
    expect(r.sinCalendario).toBe(true);
  });

  it("Yahoo responde 429: guarda lo ya traído, NO pide las demás especies y el código es 7", async () => {
    const especies = [await accion("M1", { conLote: true }), await accion("M2", { conLote: true }), await accion("M3", { conLote: true })];
    const simbolos = especies.map((_, i) => `FICTICIAM${i + 1}${corrida}.CL`);
    // Aísla: solo estas especies cuentan en este ciclo (las demás de la base no responden 429, pero tampoco importa el orden).
    const yahoo = yahooFalso({ [simbolos[0]!]: [{ t: seg("2027-02-09 09:30"), c: 5 }], [simbolos[1]!]: 429, [simbolos[2]!]: [{ t: seg("2027-02-09 09:30"), c: 6 }] });
    const r = await ciclo(yahoo.buscar);
    expect(r.codigo).toBe(7);
    const pedidosMios = yahoo.pedidos.filter((u) => simbolos.some((s) => u.includes(s)));
    // Se detuvo en el primer 429: no hay pedido a ninguna especie posterior a la que lo recibió.
    expect(yahoo.pedidos.at(-1)).toContain(simbolos[1]!);
    expect(pedidosMios.some((u) => u.includes(simbolos[2]!))).toBe(false);
  });

  it("una especie sin datos o con respuesta corrupta no frena a las demás: código 3 y la lista de fallidas (solo ids y códigos)", async () => {
    const buena = await accion("N1", { conLote: true });
    const mala = await accion("N2", { conLote: true });
    const yahoo = yahooFalso({ [`FICTICIAN1${corrida}.CL`]: [{ t: seg("2027-02-09 09:30"), c: 9 }], [`FICTICIAN2${corrida}.CL`]: 404 });
    const r = await ciclo(yahoo.buscar);
    expect(r.codigo).toBe(3);
    expect(r.fallidas).toContainEqual({ instrumentoId: mala, codigo: "YAHOO_HTTP_404" });
    expect((await filas(buena)).map((f) => f.precio.toString())).toEqual(["9"]);
    expect(JSON.stringify(r)).not.toContain("FICTICIA");
  });

  it("espacia los pedidos con la pausa configurada (n−1 pausas) y no duerme si hay una sola especie o pausa 0", async () => {
    const pausas: number[] = [];
    const yahoo = yahooFalso({});
    const r = await ciclo(yahoo.buscar, { pausaMs: 250, dormir: async (ms) => void pausas.push(ms) });
    expect(pausas).toHaveLength(Math.max(0, r.peticiones - 1));
    expect(new Set(pausas)).toEqual(r.peticiones > 1 ? new Set([250]) : new Set());
    const sin: number[] = [];
    await ciclo(yahoo.buscar, { pausaMs: 0, dormir: async (ms) => void sin.push(ms) });
    expect(sin).toEqual([]);
  });
});

describe("depurarIntradia · la retención", () => {
  it("borra lo de más de `retencionDias` días y conserva lo demás; repetir no borra nada más", async () => {
    const id = await accion("D1");
    const ahora = new Date();
    const hace = (dias: number) => new Date(ahora.getTime() - dias * 24 * 60 * MIN);
    await db.precioIntradia.createMany({
      data: [90, 70, 61, 59, 5].map((d) => ({ instrumentoId: id, instante: hace(d), precio: new Prisma.Decimal(d), fuente: "yahoo", conRetraso: true })),
    });
    expect(await depurarIntradia(db, ahora, 60)).toBeGreaterThanOrEqual(3);
    expect((await filas(id)).map((f) => f.precio.toString())).toEqual(["59", "5"]);
    expect(await depurarIntradia(db, ahora, 60)).toBe(0);
  });

  it("con una retención menor que 60 días se niega antes de tocar nada (la base tampoco lo dejaría)", async () => {
    await expect(depurarIntradia(db, new Date(), 59)).rejects.toThrow(RangeError);
    await expect(depurarIntradia(db, new Date(), Number.NaN)).rejects.toThrow(RangeError);
  });
});

describe("lectores: ultimoPrecioIntradia y preciosDelDia", () => {
  it("el último precio trae el instante, la fuente y el retraso; sin barras es null", async () => {
    const id = await accion("R1");
    expect(await ultimoPrecioIntradia(db, id)).toBeNull();
    await guardarBarras(db, id, [barra("09:30", "10"), barra("11:42", "12.5"), barra("10:00", "11")], true);
    const u = await ultimoPrecioIntradia(db, id);
    expect(u).not.toBeNull();
    expect([u!.instante.toISOString(), u!.precio.toString(), u!.fuente, u!.conRetraso]).toEqual([cot("2027-02-09 11:42").toISOString(), "12.5", "yahoo", true]);
  });

  it("los precios del día: solo las barras de ese día de Colombia, en orden de instante", async () => {
    const id = await accion("R2");
    await guardarBarras(db, id, [barra("15:59", "9", "2027-02-08"), barra("09:31", "11"), barra("09:30", "10"), barra("23:30", "8", "2027-02-09"), barra("09:30", "20", "2027-02-10")], false);
    const dia = await preciosDelDia(db, id, "2027-02-09");
    expect(dia.map((p) => [p.instante.toISOString(), p.precio.toString()])).toEqual([
      [cot("2027-02-09 09:30").toISOString(), "10"],
      [cot("2027-02-09 09:31").toISOString(), "11"],
      [cot("2027-02-09 23:30").toISOString(), "8"],
    ]);
    expect(dia[0]).toMatchObject({ fuente: "yahoo", conRetraso: false });
  });

  it("un día con formato inválido no consulta (lanza)", async () => {
    await expect(preciosDelDia(db, "x", "09/02/2027")).rejects.toThrow(RangeError);
  });
});
