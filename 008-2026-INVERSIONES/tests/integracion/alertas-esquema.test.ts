// Las tablas de las alertas (umbral_version, alerta, alerta_vista; migración *_alertas) contra la base de PRUEBAS: cada CHECK
// muerde (con su control positivo), la deduplicación por clave y por decreto, la solo inserción, la hora que pone la base y
// el disparador de la inserción. Datos inventados (especies FICTICIA-*, fechas de 2027 solo donde no importa el reloj).
import { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cifrarCrudo } from "@/cifrado/campos";
import { limpiarPlan } from "./apoyo/limpiar-plan";

const db = new PrismaClient();
const corrida = Date.now().toString(36).slice(-6);
let autorId = "";
let familiaId = "";
let especieId = "";
let reglaId = "";
let planId = "";
let decretoId = "";
let versionUmbral = 0;
let contador = 0;

const hoyColombia = (): string => new Date(Date.now() - 5 * 3_600_000).toISOString().slice(0, 10);
const dia = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);
const dec = (v: string) => new Prisma.Decimal(v);

const UMBRALES_OK = {
  alertaCercaPct: dec("3"), alertaCercaActiva: true, alertaNivelCruzadoActiva: true, alertaMovimientoPct: dec("3"), alertaMovimientoActiva: true,
  alertaCaidaPct: dec("2"), alertaCaidaActiva: true, alertaDatoViejoMin: 30, alertaDatoViejoActiva: true, alertaExDiasHabiles: 3, alertaExActiva: true,
};
const umbral = async (cambios: Record<string, unknown> = {}) => {
  // La base de pruebas es compartida: se parte de la última versión que haya, no de cero.
  versionUmbral = Math.max(versionUmbral, (await db.umbralVersion.findFirst({ orderBy: { version: "desc" }, select: { version: true } }))?.version ?? 0) + 1;
  return db.umbralVersion.create({ data: { ...UMBRALES_OK, motivo: "Versión ficticia de la prueba", autorId, version: versionUmbral, ...cambios } as Prisma.UmbralVersionUncheckedCreateInput });
};

type DatosAlerta = Partial<Prisma.AlertaUncheckedCreateInput>;
const nivel = (): DatosAlerta => ({ tipo: "NIVEL_CRUZADO", instrumentoId: especieId, reglaId, sentido: "BAJO", base: "CIERRE", precio: dec("1000.5"), referencia: dec("1100") });
const alerta = async (cambios: DatosAlerta = {}, dias = 0) => {
  contador += 1;
  // Cada llamada usa un día distinto (de la clave de deduplicación), salvo que la prueba fije el suyo.
  const d = cambios.dia ?? dia(new Date(Date.UTC(2025, 0, 1) + (contador + dias) * 86_400_000).toISOString().slice(0, 10));
  return db.alerta.create({ data: { dia: d, motorVersion: "alertas-v1", ...nivel(), ...cambios } as Prisma.AlertaUncheckedCreateInput });
};

beforeAll(async () => {
  const base = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!base.endsWith("_test")) throw new Error(`Se negó a correr sobre «${base}»: solo bases *_test`);
  autorId = (await db.usuario.create({ data: { email: `dueno-alertas-${corrida}@ejemplo.invalid`, rol: "DUENO" } })).id;
  familiaId = (await db.usuario.create({ data: { email: `familia-alertas-${corrida}@ejemplo.invalid`, rol: "FAMILIA" } })).id;
  especieId = (await db.instrumento.create({ data: { tipo: "ACCION", nemotecnico: `FICTICIA-${corrida}`, nombre: "Especie ficticia de alertas" } })).id;
  const plan = await db.planVersion.create({ data: { version: 900000 + (Date.now() % 90000), vigenteDesde: dia("2027-01-04"), motivo: "ficticio", aprobadaPorId: autorId } });
  planId = plan.id;
  reglaId = (await db.reglaPlan.create({ data: { planVersionId: plan.id, instrumentoId: especieId, condicion: "CIERRE_BAJO", nivel: dec("1100"), accion: "NO_ACTUAR", detalle: "ficticio" } })).id;
});

afterAll(async () => {
  // La base de pruebas es compartida: el plan sembrado (con su vigencia de 2027) no puede quedar para los archivos que siguen.
  await limpiarPlan(db, [planId]);
  await db.$disconnect();
});

describe("umbral_version", () => {
  it("control positivo: entra con los valores de omisión y con los bordes de cada rango", async () => {
    await expect(umbral()).resolves.toMatchObject({ alertaCercaActiva: true });
    await expect(umbral({ alertaCercaPct: dec("0.5"), alertaMovimientoPct: dec("0.5"), alertaCaidaPct: dec("0.5"), alertaDatoViejoMin: 10, alertaExDiasHabiles: 1 })).resolves.toBeDefined();
    await expect(umbral({ alertaCercaPct: dec("10"), alertaMovimientoPct: dec("20"), alertaCaidaPct: dec("20"), alertaDatoViejoMin: 240, alertaExDiasHabiles: 10 })).resolves.toBeDefined();
  });

  it.each([
    ["cerca bajo el mínimo", { alertaCercaPct: dec("0.49") }],
    ["cerca sobre el máximo", { alertaCercaPct: dec("10.01") }],
    ["movimiento bajo el mínimo", { alertaMovimientoPct: dec("0.49") }],
    ["movimiento sobre el máximo", { alertaMovimientoPct: dec("20.01") }],
    ["caída bajo el mínimo", { alertaCaidaPct: dec("0.49") }],
    ["caída sobre el máximo", { alertaCaidaPct: dec("20.01") }],
    ["dato viejo bajo el mínimo", { alertaDatoViejoMin: 9 }],
    ["dato viejo sobre el máximo", { alertaDatoViejoMin: 241 }],
    ["días hábiles del ex en cero", { alertaExDiasHabiles: 0 }],
    ["días hábiles del ex sobre el máximo", { alertaExDiasHabiles: 11 }],
  ])("rechaza %s", async (_n, cambios) => {
    await expect(umbral(cambios)).rejects.toThrow(/check|violates/i);
  });

  it("la versión es única y mayor que cero; el motivo no puede estar vacío ni pasar de 2000", async () => {
    const v = await umbral();
    await expect(db.umbralVersion.create({ data: { ...UMBRALES_OK, motivo: "x", autorId, version: v.version } })).rejects.toThrow(/Unique|unique/);
    await expect(db.umbralVersion.create({ data: { ...UMBRALES_OK, motivo: "x", autorId, version: 0 } })).rejects.toThrow(/umbral_version_version_chk|check/i);
    await expect(umbral({ motivo: "   " })).rejects.toThrow(/umbral_version_motivo_chk|check/i);
    await expect(umbral({ motivo: "a".repeat(2001) })).rejects.toThrow(/umbral_version_motivo_chk|check/i);
  });

  it("el autor debe ser el dueño: un usuario de la familia no firma una versión (disparador)", async () => {
    await expect(umbral({ autorId: familiaId })).rejects.toThrow(/dueño/);
    await expect(umbral({ autorId })).resolves.toBeDefined();
  });

  it("el autor debe existir; la hora la pone la base; nada se edita ni se borra", async () => {
    await expect(umbral({ autorId: "no-existe" })).rejects.toThrow(/dueño|foreign key|Foreign/i);
    const v = await umbral();
    expect(Math.abs(Date.now() - v.creadaEn.getTime())).toBeLessThan(60_000);
    await expect(db.$executeRaw`UPDATE umbral_version SET motivo = 'otro' WHERE id = ${v.id}`).rejects.toThrow(/solo inserción/);
    await expect(db.$executeRaw`DELETE FROM umbral_version WHERE id = ${v.id}`).rejects.toThrow(/solo inserción/);
  });
});

describe("alerta · control positivo y coherencia por tipo", () => {
  it("entra una de cada tipo con sus ids", async () => {
    await expect(alerta()).resolves.toMatchObject({ tipo: "NIVEL_CRUZADO" });
    await expect(alerta({ tipo: "NIVEL_CERCA", sentido: "SOBRE" })).resolves.toBeDefined();
    await expect(alerta({ tipo: "MOVIMIENTO_DIA", reglaId: null, sentido: "SOBRE", variacionPct: dec("3.5"), umbral: dec("3") })).resolves.toBeDefined();
    await expect(alerta({ tipo: "CAIDA_PORTAFOLIO", instrumentoId: null, reglaId: null, sentido: "BAJO", variacionPct: dec("-2.1") })).resolves.toBeDefined();
    await expect(alerta({ tipo: "DATO_VIEJO", reglaId: null, sentido: "RUEDA", base: "INTRADIA", instanteDato: new Date(Date.now() - 3_600_000), minutosDeEdad: 80, umbral: dec("30"), conRetraso: true })).resolves.toBeDefined();
  });

  it.each([
    ["un tipo que no es de la lista", { tipo: "OTRA" }],
    ["un sentido que no es de la lista", { sentido: "ARRIBA" }],
    ["una base que no es de la lista", { base: "AYER" }],
    ["un nivel sin regla", { reglaId: null }],
    ["un nivel sin especie", { instrumentoId: null }],
    ["un nivel sin sentido", { sentido: null }],
    ["un nivel sin base", { base: null }],
    ["un movimiento con regla", { tipo: "MOVIMIENTO_DIA" }],
    ["una caída con especie", { tipo: "CAIDA_PORTAFOLIO", reglaId: null, sentido: "BAJO" }],
    ["una caída con sentido SOBRE", { tipo: "CAIDA_PORTAFOLIO", instrumentoId: null, reglaId: null, sentido: "SOBRE" }],
    ["un dato viejo con el sentido de un precio (BAJO)", { tipo: "DATO_VIEJO", reglaId: null }],
    ["un dato viejo sin sentido", { tipo: "DATO_VIEJO", reglaId: null, sentido: null }],
    ["un dato viejo con un sentido que no es suyo", { tipo: "DATO_VIEJO", reglaId: null, sentido: "SOBRE" }],
    ["RUEDA en un movimiento", { tipo: "MOVIMIENTO_DIA", reglaId: null, sentido: "RUEDA" }],
    ["CIERRE_FALTANTE en un nivel", { sentido: "CIERRE_FALTANTE" }],
    ["una fecha ex sin decreto", { tipo: "FECHA_EX", reglaId: null, sentido: null, base: null }],
    ["una fecha ex con regla", { tipo: "FECHA_EX", sentido: null, base: null }],
    ["un precio en cero", { precio: dec("0") }],
    ["un precio sobre el tope", { precio: dec("10000001") }],
    ["una versión de motor mal escrita", { motorVersion: "otro" }],
    ["una referencia en cero", { referencia: dec("0") }],
    ["una referencia negativa", { referencia: dec("-1") }],
    ["esFechaEx en un nivel (solo la fecha ex y el movimiento lo llevan)", { esFechaEx: true }],
    ["un dato posterior a su hora de traída", { instanteDato: new Date("2026-03-02T16:30:00Z"), traidoEn: new Date("2026-03-02T16:00:00Z") }],
  ])("rechaza %s", async (_n, cambios) => {
    await expect(alerta(cambios as DatosAlerta)).rejects.toThrow(/check|violates|Invalid|invalid/i);
  });

  it("las llaves: especie, regla y versión de umbrales deben existir", async () => {
    await expect(alerta({ instrumentoId: "no-existe" })).rejects.toThrow(/foreign key|Foreign/i);
    await expect(alerta({ reglaId: "no-existe" })).rejects.toThrow(/foreign key|Foreign/i);
    await expect(alerta({ umbralVersionId: "no-existe" })).rejects.toThrow(/foreign key|Foreign/i);
    const u = await umbral();
    await expect(alerta({ umbralVersionId: u.id })).resolves.toMatchObject({ umbralVersionId: u.id });
  });
});

describe("alerta · deduplicación", () => {
  it("una por (día, tipo, especie, regla, sentido): la segunda es rechazada, y distinto sentido o distinto día entra", async () => {
    const d = dia("2026-03-02");
    await alerta({ dia: d });
    await expect(alerta({ dia: d })).rejects.toThrow(/Unique|unique/);
    await expect(alerta({ dia: d, sentido: "SOBRE" })).resolves.toBeDefined();
    await expect(alerta({ dia: dia("2026-03-03") })).resolves.toBeDefined();
  });

  it("la base no entra en la clave: el cruce en el intradía y en el cierre del mismo día cuenta una vez", async () => {
    const d = dia("2026-03-04");
    await alerta({ dia: d, base: "INTRADIA" });
    await expect(alerta({ dia: d, base: "CIERRE" })).rejects.toThrow(/Unique|unique/);
  });

  it("las de portafolio (sin especie ni regla) también se deduplican (NULL no escapa de la clave)", async () => {
    const d = dia("2026-03-05");
    const caida = { dia: d, tipo: "CAIDA_PORTAFOLIO", instrumentoId: null, reglaId: null, sentido: "BAJO", base: "CIERRE" } as const;
    await alerta(caida);
    await expect(alerta(caida)).rejects.toThrow(/Unique|unique/);
  });

  it("dato viejo en la rueda y falta del cierre, el mismo día y la misma especie: se guardan las dos (no comparten clave)", async () => {
    const d = dia("2026-03-07");
    const comun = { dia: d, tipo: "DATO_VIEJO", reglaId: null } as const;
    await alerta({ ...comun, sentido: "RUEDA", base: "INTRADIA" });
    await alerta({ ...comun, sentido: "CIERRE_FALTANTE", base: "CIERRE" });
    await expect(alerta({ ...comun, sentido: "RUEDA", base: "INTRADIA" })).rejects.toThrow(/Unique|unique/);
    await expect(alerta({ ...comun, sentido: "CIERRE_FALTANTE", base: "CIERRE" })).rejects.toThrow(/Unique|unique/);
  });

  it("createMany con skipDuplicates inserta 0 la segunda vez", async () => {
    const d = dia("2026-03-06");
    const fila = { dia: d, motorVersion: "alertas-v1", ...nivel() } as Prisma.AlertaCreateManyInput;
    expect((await db.alerta.createMany({ data: [fila], skipDuplicates: true })).count).toBe(1);
    expect((await db.alerta.createMany({ data: [fila], skipDuplicates: true })).count).toBe(0);
  });

  it("fecha ex: el decreto es único (aunque cambie el día); los demás tipos no usan ese índice", async () => {
    decretoId = await crearDecreto();
    const ex = { tipo: "FECHA_EX", reglaId: null, sentido: null, base: null, decretoId } as const;
    await alerta({ ...ex, dia: dia("2026-03-09") });
    await expect(alerta({ ...ex, dia: dia("2026-03-10") })).rejects.toThrow(/Unique|unique/);
  });
});

async function crearDecreto(): Promise<string> {
  const carga = await db.cargaArchivo.create({ data: { tipoFuente: "REGISTRO_DECRETOS", nombreArchivo: "decretos.ficticio.csv", sha256: "d".repeat(64), estado: "CARGADO", cargadoPorId: autorId } });
  const llave = { tipoFuente: "REGISTRO_DECRETOS" as const, claveNatural: `al${corrida}decreto`.padStart(64, "0"), ocurrencia: 1 };
  const fila = await db.filaFuente.create({ data: { ...llave, primeraCargaId: carga.id, primeraFilaNo: 1, crudo: cifrarCrudo({ especie: "FICTICIA", valor: "10" }, llave) } });
  const d = await db.dividendoDecretado.create({
    data: {
      filaFuenteId: fila.id, instrumentoId: especieId, tipo: "ORDINARIO", valorPorAccion: dec("10"), fechaAnuncio: dia("2027-01-04"), cuota: 1, fechaEx: dia("2027-02-01"),
      fechaPago: dia("2027-02-15"), referenciaOficial: "https://www.superfinanciera.gov.co/ficticio/decreto",
    },
  });
  return d.id;
}

describe("alerta · disparador de la inserción y solo inserción", () => {
  it("la hora de detección la pone la base", async () => {
    const a = await alerta();
    expect(Math.abs(Date.now() - a.detectadaEn.getTime())).toBeLessThan(60_000);
  });

  it("nada se edita ni se borra", async () => {
    const a = await alerta();
    await expect(db.$executeRaw`UPDATE alerta SET precio = 1 WHERE id = ${a.id}`).rejects.toThrow(/solo inserción/);
    await expect(db.$executeRaw`DELETE FROM alerta WHERE id = ${a.id}`).rejects.toThrow(/solo inserción/);
  });
});

describe("alerta_vista", () => {
  it("el dueño la marca; una sola vez por alerta; la hora la pone la base", async () => {
    const a = await alerta();
    const v = await db.alertaVista.create({ data: { alertaId: a.id, usuarioId: autorId } });
    expect(Math.abs(Date.now() - v.vistaEn.getTime())).toBeLessThan(60_000);
    await expect(db.alertaVista.create({ data: { alertaId: a.id, usuarioId: autorId } })).rejects.toThrow(/Unique|unique/);
    expect((await db.alertaVista.createMany({ data: [{ alertaId: a.id, usuarioId: autorId }], skipDuplicates: true })).count).toBe(0);
  });

  it("la familia no puede marcar: el disparador exige que el usuario sea el dueño", async () => {
    const a = await alerta();
    await expect(db.alertaVista.create({ data: { alertaId: a.id, usuarioId: familiaId } })).rejects.toThrow(/dueño/);
    await expect(db.alertaVista.create({ data: { alertaId: a.id, usuarioId: "no-existe" } })).rejects.toThrow(/dueño|foreign key/i);
  });

  it("la alerta y el usuario deben existir; nada se edita ni se borra", async () => {
    await expect(db.alertaVista.create({ data: { alertaId: "no-existe", usuarioId: autorId } })).rejects.toThrow(/foreign key|Foreign/i);
    const a = await alerta();
    const v = await db.alertaVista.create({ data: { alertaId: a.id, usuarioId: autorId } });
    await expect(db.$executeRaw`UPDATE alerta_vista SET "usuarioId" = ${familiaId} WHERE id = ${v.id}`).rejects.toThrow(/solo inserción/);
    await expect(db.$executeRaw`DELETE FROM alerta_vista WHERE id = ${v.id}`).rejects.toThrow(/solo inserción/);
  });
});
