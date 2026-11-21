// Integración de la fase B, corte 2: importar la ficha de ODIN (inventada: `ficha.ficticio.md`) al plan,
// contra la base de PRUEBAS. El plan es uno solo y sus versiones no retroceden ni se borran, así que
// los casos van en orden, después de la última versión que haya en la base (otra prueba pudo crearla).
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ErrorPlan } from "@/plan/errores";
import { tomarCandado } from "@/plan/importar/candado";
import { importarFicha, importarLeida } from "@/plan/importar/importar";
import { leerFicha } from "@/plan/importar/interpretar";
import { prepararImportacion } from "@/plan/importar/mapear";
import { sumarDias } from "@/plan/fechas";
import { crearVersionPlan } from "@/plan/versiones";

const db = new PrismaClient();
const URL_BASE = process.env.DATABASE_URL ?? "";
const FIXTURE = readFileSync(new URL("../fixtures/ficha.ficticio.md", import.meta.url), "utf8");
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const PRIMERA = new Date("2025-03-15T00:00:00.000Z"); // la fecha de «Posición única» del fixture
const corrida = Date.now().toString(36).toUpperCase().slice(-6);
const duenoEmail = `dueno-importar-${corrida}@ejemplo.invalid`;
const familiaEmail = `familia-importar-${corrida}@ejemplo.invalid`;
let duenoId = "";
let fechaA = PRIMERA;
const especies = new Map<string, string>();

const iso = (f: Date) => f.toISOString().slice(0, 10);
const hoyPara = (fecha: Date) => sumarDias(fecha, 9);

/** El fixture con su plan movido a `fecha` (y el pie 8 días después, para que el año se infiera bien). */
function variante(fecha: Date, cambio: (t: string) => string = (t) => t): string {
  const diaMes = `${fecha.getUTCDate()}-${MESES[fecha.getUTCMonth()]}`;
  return cambio(FIXTURE.replace("Posición única (15-mar)", `Posición única (${diaMes})`).replaceAll("2025-03-23", iso(sumarDias(fecha, 8))));
}

async function conteos(): Promise<number[]> {
  return [await db.planVersion.count(), await db.reglaPlan.count(), await db.decision.count()];
}

/** `db` cuya transacción número `n` revienta con `error` (la 1.ª crea la versión; las siguientes, las decisiones). */
function conFallaEn(n: number, error: () => Error): PrismaClient {
  let transacciones = 0;
  return new Proxy(db, {
    get(objetivo, propiedad) {
      if (propiedad === "$transaction") {
        return (...args: Parameters<PrismaClient["$transaction"]>) => {
          transacciones += 1;
          if (transacciones === n) throw error();
          return (objetivo.$transaction as (...a: unknown[]) => unknown)(...args);
        };
      }
      const valor: unknown = Reflect.get(objetivo, propiedad, objetivo);
      return typeof valor === "function" ? valor.bind(objetivo) : valor;
    },
  });
}

class FallaRara extends Error {
  override name = "FallaRara";
}

async function importar(contenido: string, fecha: Date, o: { aplicar?: boolean; email?: string } = {}) {
  return importarFicha(db, { contenido, email: o.email ?? duenoEmail, aplicar: o.aplicar ?? false }, { url: URL_BASE, hoy: hoyPara(fecha) });
}

beforeAll(async () => {
  const nombre = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!nombre.endsWith("_test")) throw new Error(`Se negó a correr sobre «${nombre}»: solo bases *_test`);
  duenoId = (await db.usuario.create({ data: { email: duenoEmail, rol: "DUENO" } })).id;
  await db.usuario.create({ data: { email: familiaEmail, rol: "FAMILIA" } });
  for (const nemotecnico of ["FICTA", "FICTB"]) {
    const inst = await db.instrumento.upsert({ where: { nemotecnico }, create: { tipo: "ACCION", nemotecnico, nombre: `Acción ficticia ${nemotecnico}` }, update: {} });
    especies.set(nemotecnico, inst.id);
  }
  const ultima = await db.planVersion.findFirst({ orderBy: { version: "desc" } });
  if (ultima && ultima.vigenteDesde >= PRIMERA) fechaA = sumarDias(ultima.vigenteDesde, 1);
});

afterAll(async () => {
  await db.$disconnect();
});

describe("ensayo y candado (no escriben)", () => {
  it("el ensayo lee la base, cuenta lo que crearía y no escribe nada", async () => {
    const antes = await conteos();
    const r = await importar(variante(fechaA), fechaA);
    expect([r.modo, r.estado, r.versiones, r.reglas, r.decisiones, r.bloqueos]).toEqual([
      "ENSAYO",
      "LISTO",
      { leidas: 1, nuevas: 1, existentes: 0 },
      { leidas: 9, nuevas: 9, existentes: 0 },
      { leidas: 2, nuevas: 2, existentes: 0 },
      [],
    ]);
    expect(await conteos()).toEqual(antes);
  });

  it("--aplicar sin URL de la base no arranca", async () => {
    await expect(importarFicha(db, { contenido: variante(fechaA), email: duenoEmail, aplicar: true }, { hoy: hoyPara(fechaA) })).rejects.toThrow("SIN_URL_DE_BASE");
  });

  it("con el candado tomado por otra importación, --aplicar no escribe y dice CANDADO_OCUPADO", async () => {
    const otro = await tomarCandado(URL_BASE);
    expect(otro).not.toBeNull();
    try {
      const antes = await conteos();
      const r = await importar(variante(fechaA), fechaA, { aplicar: true });
      expect(r.estado).toBe("CANDADO_OCUPADO");
      expect(await conteos()).toEqual(antes);
    } finally {
      await otro!.soltar();
    }
  });
});

describe("aplicar", () => {
  it("crea la versión, sus reglas y las decisiones encadenadas a su regla, y suelta el candado", async () => {
    const antes = await conteos();
    const r = await importar(variante(fechaA), fechaA, { aplicar: true });
    expect([r.modo, r.estado, r.versiones, r.reglas, r.decisiones]).toEqual([
      "APLICAR",
      "APLICADO",
      { leidas: 1, nuevas: 1, existentes: 0 },
      { leidas: 9, nuevas: 9, existentes: 0 },
      { leidas: 2, nuevas: 2, existentes: 0 },
    ]);
    expect(await conteos()).toEqual([antes[0]! + 1, antes[1]! + 9, antes[2]! + 2]);

    const v = await db.planVersion.findFirstOrThrow({ where: { vigenteDesde: fechaA }, orderBy: { version: "desc" }, include: { reglas: true, decisiones: { include: { regla: true } } } });
    expect([v.aprobadaPorId, v.motivo.startsWith("Posición única (")]).toEqual([duenoId, true]);
    expect(v.reglas.map((x) => x.condicion).sort()).toEqual(["CIERRE_BAJO", "LIBRE", "LIBRE", "LIBRE", "LIBRE", "LIBRE", "MONTO_ORDEN_BAJO", "NINGUNA", "NINGUNA"]);
    const decisiones = v.decisiones.map((d) => [d.instrumentoId, d.accion, d.cantidad, d.regla?.condicion, d.regla?.accion, d.regla?.instrumentoId, d.decididaPorId, d.fechaDecision, d.excepcion]);
    expect(decisiones.sort((a, b) => String(a[1]).localeCompare(String(b[1])))).toEqual([
      [especies.get("FICTB"), "NO_ACTUAR", 250n, "NINGUNA", "NO_ACTUAR", especies.get("FICTB"), duenoId, fechaA, false],
      [especies.get("FICTA"), "VENDER", 120n, "NINGUNA", "VENDER", especies.get("FICTA"), duenoId, fechaA, false],
    ]);
    for (const d of v.decisiones) expect(d.motivo.startsWith(v.motivo)).toBe(true);

    const libre = await tomarCandado(URL_BASE);
    expect(libre).not.toBeNull();
    await libre!.soltar();
  });

  it("reimportar la misma ficha no duplica nada (ensayo y aplicar dicen SIN_CAMBIOS)", async () => {
    const antes = await conteos();
    for (const aplicar of [false, true]) {
      const r = await importar(variante(fechaA), fechaA, { aplicar });
      expect([r.estado, r.versiones, r.reglas, r.decisiones]).toEqual([
        "SIN_CAMBIOS",
        { leidas: 1, nuevas: 0, existentes: 1 },
        { leidas: 9, nuevas: 0, existentes: 9 },
        { leidas: 2, nuevas: 0, existentes: 2 },
      ]);
    }
    expect(await conteos()).toEqual(antes);
  });

  it.each([
    ["mismo motivo y reglas distintas", (t: string) => t.replace("< $1.111", "< $3.333")],
    ["otro motivo", (t: string) => t.replace("Texto inventado del encabezado.", "Otro texto inventado del encabezado.")],
  ])("misma fecha con %s: VERSION_EN_CONFLICTO y no crea nada", async (_caso, cambio) => {
    const antes = await conteos();
    const r = await importar(variante(fechaA, cambio), fechaA, { aplicar: true });
    expect([r.estado, r.bloqueos.map((b) => [b.linea, b.codigo])]).toEqual(["BLOQUEADO", [[20, "VERSION_EN_CONFLICTO"]]]);
    expect(await conteos()).toEqual(antes);
  });
});

describe("bloqueos de la base (no escriben)", () => {
  const fechaB = () => sumarDias(fechaA, 2);

  it("una especie sin instrumento en la base bloquea con su línea", async () => {
    const antes = await conteos();
    const r = await importar(
      variante(fechaB(), (t) => t.replace("| FICTB | Mantener", "| FICTZ | Mantener")),
      fechaB(),
      { aplicar: true },
    );
    expect([r.estado, r.bloqueos.map((b) => [b.linea, b.codigo])]).toEqual(["BLOQUEADO", [[24, "ESPECIE_SIN_INSTRUMENTO"]]]);
    expect(await conteos()).toEqual(antes);
  });

  it.each([
    ["un usuario de la familia", () => familiaEmail],
    ["un correo que no existe", () => `nadie-${corrida}@ejemplo.invalid`],
  ])("%s no puede importar: DUENO_NO_AUTORIZADO", async (_caso, email) => {
    const antes = await conteos();
    const r = await importar(variante(fechaB()), fechaB(), { aplicar: true, email: email() });
    expect([r.estado, r.bloqueos.map((b) => b.codigo)]).toEqual(["BLOQUEADO", ["DUENO_NO_AUTORIZADO"]]);
    expect(await conteos()).toEqual(antes);
  });
});

describe("reanudar y vigencia", () => {
  const fechaB = () => sumarDias(fechaA, 2);

  it("una corrida cortada (versión creada, decisiones no) se completa al repetir el comando", async () => {
    const texto = variante(fechaB());
    const p = prepararImportacion(leerFicha(texto).plan!, especies, hoyPara(fechaB()));
    expect(p.bloqueos).toEqual([]);
    await crearVersionPlan(db, { ...p.version, autorId: duenoId }, { hoy: hoyPara(fechaB()) });
    const antes = await conteos();
    const r = await importar(texto, fechaB(), { aplicar: true });
    expect([r.estado, r.versiones, r.reglas, r.decisiones]).toEqual([
      "APLICADO",
      { leidas: 1, nuevas: 0, existentes: 1 },
      { leidas: 9, nuevas: 0, existentes: 9 },
      { leidas: 2, nuevas: 2, existentes: 0 },
    ]);
    expect(await conteos()).toEqual([antes[0], antes[1], antes[2]! + 2]);
  });

  it("una ficha con fecha anterior a la última versión: VIGENCIA_RETROCEDE y no crea nada", async () => {
    const antes = await conteos();
    const r = await importar(variante(sumarDias(fechaA, 1)), sumarDias(fechaA, 1), { aplicar: true });
    expect([r.estado, r.bloqueos.map((b) => [b.linea, b.codigo])]).toEqual(["BLOQUEADO", [[20, "VIGENCIA_RETROCEDE"]]]);
    expect(await conteos()).toEqual(antes);
  });

  it("si otra versión posterior ya manda en la fecha de las decisiones: PLAN_POSTERIOR y no crea nada", async () => {
    const fechaC = sumarDias(fechaA, 3);
    const texto = variante(fechaC);
    const p = prepararImportacion(leerFicha(texto).plan!, especies, hoyPara(fechaC));
    await crearVersionPlan(db, { ...p.version, autorId: duenoId }, { hoy: hoyPara(fechaC) });
    await crearVersionPlan(
      db,
      { vigenteDesde: fechaC, motivo: "Otra versión del mismo día", autorId: duenoId, reglas: [{ ...p.version.reglas[0]!, detalle: "Regla ficticia" }] },
      { hoy: hoyPara(fechaC) },
    );
    const antes = await conteos();
    const r = await importar(texto, fechaC, { aplicar: true });
    expect([r.estado, r.bloqueos.map((b) => [b.linea, b.codigo])]).toEqual([
      "BLOQUEADO",
      [
        [23, "PLAN_POSTERIOR"],
        [24, "PLAN_POSTERIOR"],
      ],
    ]);
    expect(await conteos()).toEqual(antes);
  });

  it("si una decisión falla a mitad: FALLO_PARCIAL con su línea, y repetir el comando completa lo que falta", async () => {
    const fechaD = sumarDias(fechaA, 4);
    const texto = variante(fechaD);
    // La 3.ª transacción es la 2.ª decisión (la 1.ª crea la versión y sus reglas).
    const conFalla = conFallaEn(3, () => new ErrorPlan("FALLA_DE_PRUEBA"));
    const antes = await conteos();
    const cortada = await importarFicha(conFalla, { contenido: texto, email: duenoEmail, aplicar: true }, { url: URL_BASE, hoy: hoyPara(fechaD) });
    expect([cortada.estado, cortada.error, cortada.versiones.nuevas, cortada.reglas.nuevas, cortada.decisiones.nuevas]).toEqual(["FALLO_PARCIAL", { linea: 24, item: null, codigo: "FALLA_DE_PRUEBA" }, 1, 9, 1]);
    expect(await conteos()).toEqual([antes[0]! + 1, antes[1]! + 9, antes[2]! + 1]);
    const completa = await importar(texto, fechaD, { aplicar: true });
    expect([completa.estado, completa.versiones.existentes, completa.decisiones]).toEqual(["APLICADO", 1, { leidas: 2, nuevas: 1, existentes: 1 }]);
    expect(await conteos()).toEqual([antes[0]! + 1, antes[1]! + 9, antes[2]! + 2]);
  });

  it("un error que no es del dominio después de crear la versión: FALLO_PARCIAL con su clase, sin su mensaje, y repetir completa", async () => {
    const fechaE = sumarDias(fechaA, 5);
    const texto = variante(fechaE);
    const antes = await conteos();
    const cortada = await importarFicha(conFallaEn(3, () => new FallaRara("mensaje interno que no debe salir")), { contenido: texto, email: duenoEmail, aplicar: true }, { url: URL_BASE, hoy: hoyPara(fechaE) });
    expect([cortada.estado, cortada.error, cortada.versiones.nuevas, cortada.decisiones.nuevas]).toEqual(["FALLO_PARCIAL", { linea: 24, item: null, codigo: "ERROR_INTERNO", nombre: "FallaRara" }, 1, 1]);
    expect(JSON.stringify(cortada)).not.toContain("mensaje interno");
    const completa = await importar(texto, fechaE, { aplicar: true });
    expect([completa.estado, completa.decisiones]).toEqual(["APLICADO", { leidas: 2, nuevas: 1, existentes: 1 }]);
    expect(await conteos()).toEqual([antes[0]! + 1, antes[1]! + 9, antes[2]! + 2]);
  });

  it("dos filas idénticas: las dos decisiones cuentan (multiconjunto) y una corrida cortada no pierde ninguna", async () => {
    const fechaF = sumarDias(fechaA, 6);
    const fila = "| FICTB | Mantener hasta el dividendo de junio | Si cierra < $1.111, vender una parte |";
    const texto = variante(fechaF, (t) => t.replace(fila, `${fila}\n${fila}`));
    const antes = await conteos();
    // Transacciones: 1 versión, 2 FICTA, 3 la primera FICTB, 4 la segunda FICTB (falla).
    const cortada = await importarFicha(conFallaEn(4, () => new ErrorPlan("FALLA_DE_PRUEBA")), { contenido: texto, email: duenoEmail, aplicar: true }, { url: URL_BASE, hoy: hoyPara(fechaF) });
    expect([cortada.estado, cortada.reglas.nuevas, cortada.decisiones]).toEqual(["FALLO_PARCIAL", 11, { leidas: 3, nuevas: 2, existentes: 0 }]);
    const completa = await importar(texto, fechaF, { aplicar: true });
    expect([completa.estado, completa.decisiones]).toEqual(["APLICADO", { leidas: 3, nuevas: 1, existentes: 2 }]);
    const otra = await importar(texto, fechaF, { aplicar: true });
    expect([otra.estado, otra.decisiones]).toEqual(["SIN_CAMBIOS", { leidas: 3, nuevas: 0, existentes: 3 }]);
    expect(await conteos()).toEqual([antes[0]! + 1, antes[1]! + 11, antes[2]! + 3]);
  });

  it("una decisión anterior a la vigencia bloquea también si la versión es NUEVA: no deja una versión huérfana", async () => {
    const fechaG = sumarDias(fechaA, 10);
    const ficha = leerFicha(variante(fechaG));
    const plan = ficha.plan!;
    const torcida = { ...ficha, plan: { ...plan, decisiones: plan.decisiones.map((d, i) => (i === 0 ? { ...d, fechaDecision: sumarDias(fechaG, -1) } : d)) } };
    const antes = await conteos();
    const r = await importarLeida(db, torcida, { email: duenoEmail, aplicar: true }, { url: URL_BASE, hoy: hoyPara(fechaG) });
    expect([r.estado, r.bloqueos.map((b) => [b.linea, b.codigo])]).toEqual(["BLOQUEADO", [[23, "DECISION_ANTES_DE_VIGENCIA"]]]);
    expect(await conteos()).toEqual(antes);
  });

  it("soltar dice si el candado estaba tomado: sí la primera vez, no la segunda", async () => {
    const c = await tomarCandado(URL_BASE);
    expect(await c!.soltar()).toBe(true);
    expect(await c!.soltar()).toBe(false);
  });

  it("si algo revienta dentro de --aplicar, el candado se suelta igual", async () => {
    const roto = { usuario: { findUnique: () => Promise.reject(new Error("falla de prueba")) } } as unknown as PrismaClient;
    await expect(importarFicha(roto, { contenido: variante(fechaA), email: duenoEmail, aplicar: true }, { url: URL_BASE, hoy: hoyPara(fechaA) })).rejects.toThrow("falla de prueba");
    const libre = await tomarCandado(URL_BASE);
    expect(libre).not.toBeNull();
    await libre!.soltar();
  });
});

describe("CLI scripts/importar-plan.ts", () => {
  const tsx = join("node_modules", ".bin", "tsx");
  const correr = (args: readonly string[]) => spawnSync(tsx, ["scripts/importar-plan.ts", ...args], { env: { ...process.env, DATABASE_URL: URL_BASE }, encoding: "utf8", timeout: 60_000 });
  let ruta = "";

  beforeAll(() => {
    ruta = join(mkdtempSync(join(tmpdir(), "inv008-ficha-")), "ficha.ficticio.md");
    writeFileSync(ruta, variante(fechaA));
  });

  it("el ensayo imprime conteos y líneas, sin especies ni cifras, y sale con 0", () => {
    const r = correr(["--ficha", ruta, "--email", duenoEmail]);
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toContain("ENSAYO (no escribe nada)");
    expect(r.stdout).toContain("Resultado: ya estaba importada; no hay nada nuevo");
    for (const p of ["FICT", "1.111", "120", "250", "$", duenoEmail]) expect(r.stdout + r.stderr, p).not.toContain(p);
  });

  it("--aplicar con otra importación en curso sale con 3", async () => {
    const otro = await tomarCandado(URL_BASE);
    try {
      const r = correr(["--ficha", ruta, "--email", duenoEmail, "--aplicar"]);
      expect(r.status).toBe(3);
      expect(r.stdout).toContain("otra importación en curso");
    } finally {
      await otro!.soltar();
    }
  });

  it("argumentos inválidos, ficha que no existe o enlace simbólico: sale con 2 y no toca la base", () => {
    const enlace = `${ruta}.enlace.md`;
    symlinkSync(ruta, enlace);
    expect(correr(["--ficha", ruta]).status).toBe(2);
    expect(correr(["--ficha", `${ruta}.no-existe`, "--email", duenoEmail]).status).toBe(2);
    const r = correr(["--ficha", enlace, "--email", duenoEmail]);
    expect([r.status, r.stderr.includes("enlace simbólico")]).toEqual([2, true]);
  });
});
