// docker/migrador/privilegios.sql: inv_app solo lee, más las escrituras exactas del login y del TOTP
// (contratos de esos frentes), por COLUMNA: UPDATE de "claveHash", "sesionVersion" y "bloqueadoHasta" en
// usuario, UPDATE de "usadoEn" en token_acceso, INSERT en intento_ingreso y, del TOTP, UPDATE de
// "totpSecreto", "totpActivadoEn", "totpUltimoPaso" y "presesionHash" en usuario, más INSERT y UPDATE de
// "usadoEn" y "anuladoEn" en codigo_recuperacion. Y, del área de edición del plan (fase B, PR-B), INSERT y nada más en las
// cuatro tablas del plan y del diario (plan_version, regla_plan, decision, enlace_decision_orden), que son de solo
// inserción por sus disparadores, sin sus instantes (los pone la base). Nunca DELETE, TRUNCATE, REFERENCES, TRIGGER ni DDL.
// inv_dueno es el dueño (crear-acceso-inicial.ts y --reiniciar-totp, en el migrador).
//
// Sin condiciones: si faltan las tablas o las columnas del login (20261121050319_login) o del TOTP
// (20261121060000_totp), el GRANT falla y el despliegue se detiene (falla cerrada).
import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { leer008, ruta008 } from "./falsos";
import { filasPermisos, PERMISOS_PRECIOS, PRECIO_CIERRE_COLUMNAS, type Permiso } from "./permisos-precios";

const sql = leer008("docker/migrador/privilegios.sql").replace(/--.*$/gm, "");
const grants = [...sql.matchAll(/GRANT\s+([A-Z]+(?:\s*\([^)]*\))?(?:\s*,\s*[A-Z]+(?:\s*\([^)]*\))?)*)\s+ON\s+(?:TABLE|SEQUENCE)\s+public\.(%I|[a-z_]+)\s+TO\s+inv_app/g)].map(
  (m) => `${m[1]!.replace(/\s+/g, " ").trim()} ${m[2]}`,
);

describe("privilegios de inv_app", () => {
  it("lectura en cada tabla, uso de secuencias, las escrituras del login y del TOTP por columna, y el INSERT del plan", () => {
    expect(grants.sort()).toEqual(
      [
        "SELECT %I",
        "USAGE %I",
        'UPDATE ("claveHash", "sesionVersion", "bloqueadoHasta") usuario',
        'UPDATE ("usadoEn") token_acceso',
        "INSERT intento_ingreso",
        "INSERT codigo_recuperacion",
        'UPDATE ("usadoEn", "anuladoEn") codigo_recuperacion',
        'UPDATE ("totpSecreto", "totpActivadoEn", "totpUltimoPaso", "presesionHash") usuario',
        ...Object.entries(INSERT_DEL_PLAN).map(([t, cs]) => `INSERT (${cs.map((c) => (/[A-Z]/.test(c) ? `"${c}"` : c)).join(", ")}) ${t}`),
        // E8: la configuración de la IA, por columna y sin "creadaEn" (bloque «config_ia» de abajo).
        'INSERT (id, version, modo, "ollamaHost", "ollamaPuerto", "modeloLocal", "modeloNube", "topeMensualUsd", "horaResumen", "resumenDiario", "resumenReglas", "resumenEscenarios", "limiteSegundos", "esfuerzoNube", motivo, "autorId") config_ia',
      ].sort(),
    );
  });

  it("las escrituras del login y del TOTP van sin condición (falla cerrada si faltan tablas o columnas)", () => {
    expect(sql).not.toMatch(/to_regclass/);
  });

  it("las columnas existen en la migración del login", () => {
    const login = leer008("prisma/migrations/20261121050319_login/migration.sql");
    for (const columna of ['"claveHash"', '"sesionVersion"', '"bloqueadoHasta"', '"usadoEn"']) expect(login).toContain(columna);
  });

  it("nunca DELETE, TRUNCATE, REFERENCES, TRIGGER, ALL ni DDL, y nunca UPDATE de tabla completa", () => {
    expect(sql).not.toMatch(/GRANT[^;]*(DELETE|TRUNCATE|REFERENCES|TRIGGER|ALL|CREATE)/);
    expect(sql).not.toMatch(/GRANT\s+UPDATE\s+ON/);
  });

  it("cada migración que citan sus comentarios existe con ese nombre (antes citaba un login que no existía)", () => {
    const existentes = new Set(readdirSync(ruta008("prisma/migrations"), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name));
    const citadas = [...leer008("docker/migrador/privilegios.sql").matchAll(/\b\d{14}_[a-z0-9_]+/g)].map((m) => m[0]);
    expect(citadas.length).toBeGreaterThan(0);
    for (const citada of citadas) expect(existentes.has(citada), citada).toBe(true);
  });

  it("parte de cero en cada corrida y deja _prisma_migrations sin acceso", () => {
    expect(sql).toMatch(/REVOKE ALL ON TABLE public\.%I FROM inv_app/);
    expect(sql).toMatch(/IF t\.relname <> '_prisma_migrations' THEN/);
  });
});

// Área de edición del plan (fase B, PR-B): el dueño crea versiones y registra decisiones desde la web, que corre como
// inv_app. Solo INSERT, solo en las cuatro tablas del plan y del diario, y POR COLUMNA con todas las columnas de cada
// una (una columna nueva no le llega hasta que se agregue: falla cerrada) MENOS los instantes (`creadaEn`,
// `registradaEn`, `creadoEn`): los pone la base (migración *_instantes_base: DEFAULT clock_timestamp() y un disparador
// para todo rol que no sea el dueño), y Prisma ya no los manda (`dbgenerated` en el esquema). Así inv_app no puede
// antedatar una decisión: nombrar un instante da 42501 (lo prueban tests/integracion/plan-edicion.test.ts con los
// privilegios de este archivo y roles-base.test.ts con inv_app real). Nada se edita ni se borra: los disparadores de
// solo inserción de la migración del plan siguen mandando, y sin UPDATE ni DELETE inv_app ni los intenta.
const TABLAS_DEL_PLAN = ["decision", "enlace_decision_orden", "plan_version", "regla_plan"];
/** Los instantes que pone la base: nunca en un INSERT de inv_app. */
const INSTANTES = ["creadaEn", "registradaEn", "creadoEn"];

/** Columnas escalares de una tabla según prisma/schema.prisma (los campos de relación son de otro modelo). */
function columnasDe(tabla: string): string[] {
  const esquema = leer008("prisma/schema.prisma").replace(/\/\/.*$/gm, "");
  const modelos = new Map([...esquema.matchAll(/model (\w+) \{([\s\S]*?)\n\}/g)].map((m) => [m[1]!, m[2]!]));
  const cuerpo = [...modelos.values()].find((c) => new RegExp(`@@map\\("${tabla}"\\)`).test(c)) ?? "";
  return cuerpo
    .split("\n")
    .map((l) => /^\s+(\w+)\s+(\w+)(\[\])?/.exec(l))
    .filter((m): m is RegExpExecArray => m !== null && !modelos.has(m[2]!) && !m[3])
    .map((m) => m[1]!);
}

/** Las columnas de cada INSERT del plan que privilegios.sql le da a inv_app. */
const INSERT_DEL_PLAN: Readonly<Record<string, readonly string[]>> = Object.fromEntries(
  [...sql.matchAll(/GRANT\s+INSERT\s*\(([^)]*)\)\s+ON\s+TABLE\s+public\.([a-z_]+)\s+TO\s+inv_app\s*;/g)]
    .filter((m) => TABLAS_DEL_PLAN.includes(m[2]!))
    .map((m) => [m[2]!, m[1]!.split(",").map((c) => c.trim().replace(/^"|"$/g, ""))]),
);

describe("privilegios del plan y del diario (área de edición)", () => {
  it("INSERT por columna en las cuatro, y ningún otro privilegio sobre ellas (ni INSERT de tabla completa)", () => {
    expect(Object.keys(INSERT_DEL_PLAN).sort()).toEqual(TABLAS_DEL_PLAN);
    for (const t of TABLAS_DEL_PLAN) {
      expect(sql, t).not.toMatch(new RegExp(`GRANT\\s+(?!INSERT\\s*\\()[^;]*\\bpublic\\.${t}\\b[^;]*TO\\s+inv_app`));
      expect(sql, t).not.toMatch(new RegExp(`GRANT\\s+INSERT\\s+ON\\s+TABLE\\s+public\\.${t}\\b`));
    }
  });

  it("cada INSERT trae exactamente las columnas de su tabla según el esquema, menos los instantes (los pone la base)", () => {
    for (const t of TABLAS_DEL_PLAN) {
      const delEsquema = columnasDe(t);
      expect(delEsquema.length, t).toBeGreaterThan(5);
      const esperadas = delEsquema.filter((c) => !INSTANTES.includes(c));
      expect([...INSERT_DEL_PLAN[t]!].sort(), t).toEqual([...esperadas].sort());
    }
    // Control positivo: cada instante es de verdad una columna de alguna de las cuatro tablas.
    for (const instante of INSTANTES) expect(TABLAS_DEL_PLAN.some((t) => columnasDe(t).includes(instante)), instante).toBe(true);
  });

  it("ningún GRANT a inv_app en las tablas del plan nombra un instante (ni de INSERT ni de nada)", () => {
    const delPlan = [...sql.matchAll(/GRANT[^;]*\bON\s+TABLE\s+public\.([a-z_]+)\s+TO\s+inv_app\b/g)].filter((m) => TABLAS_DEL_PLAN.includes(m[1]!));
    expect(delPlan.length).toBe(TABLAS_DEL_PLAN.length);
    for (const m of delPlan) for (const instante of INSTANTES) expect(m[0], instante).not.toContain(`"${instante}"`);
  });

  it("ningún otro INSERT de inv_app fuera del login, del TOTP y del plan", () => {
    const inserts = grants.filter((g) => g.startsWith("INSERT ")).map((g) => g.split(" ").at(-1)!).sort();
    expect(inserts).toEqual(["codigo_recuperacion", "config_ia", "intento_ingreso", ...TABLAS_DEL_PLAN].sort());
  });

  it("las cuatro tablas son de solo inserción en su migración (el disparador manda aunque alguien diera UPDATE)", () => {
    const plan = leer008("prisma/migrations/20261121024044_plan_decisiones/migration.sql");
    for (const t of TABLAS_DEL_PLAN) {
      expect(plan, t).toMatch(new RegExp(`CREATE TRIGGER "${t}_solo_insercion"\\s+BEFORE UPDATE OR DELETE ON "${t}"`));
    }
  });

  it("los INSERT del plan van después del REVOKE ALL de cada corrida (parten de cero)", () => {
    const revoke = sql.indexOf("EXECUTE format('REVOKE ALL ON TABLE public.%I FROM inv_app', t.relname);");
    for (const t of TABLAS_DEL_PLAN) expect(sql.search(new RegExp(`GRANT INSERT \\([^)]*\\) ON TABLE public\\.${t} TO inv_app;`)), t).toBeGreaterThan(revoke);
  });
});

describe("privilegios del TOTP: activos desde su migración", () => {
  it("las columnas y la tabla existen en la migración del TOTP", () => {
    const totp = leer008("prisma/migrations/20261121060000_totp/migration.sql");
    expect(totp).toContain('CREATE TABLE "codigo_recuperacion"');
    for (const columna of ['"totpSecreto"', '"totpActivadoEn"', '"totpUltimoPaso"', '"presesionHash"', '"usadoEn"', '"anuladoEn"']) expect(totp).toContain(columna);
  });

  it("no hay ningún GRANT comentado: lo preparado quedó activo", () => {
    const crudo = leer008("docker/migrador/privilegios.sql");
    expect(crudo).not.toMatch(/^\s*--\s*GRANT/m);
  });

  it("los códigos de recuperación no se borran: ni DELETE ni UPDATE de su hash", () => {
    expect(sql).not.toMatch(/GRANT[^;]*DELETE[^;]*codigo_recuperacion/);
    expect(sql).not.toMatch(/GRANT UPDATE \([^)]*"codigoHash"/);
  });
});

// inv_precios (servicio de precios, PR 3): los permisos de la lista única (permisos-precios.ts), todos por columna,
// solo si el rol existe (el despliegue de hoy no depende de él) y partiendo de cero en cada corrida.
describe("privilegios de inv_precios", () => {
  const esquema = leer008("prisma/schema.prisma").replace(/\/\/.*$/gm, "");
  const modelos = new Map([...esquema.matchAll(/model (\w+) \{([\s\S]*?)\n\}/g)].map((m) => [m[1]!, m[2]!]));
  const mapa = new Map([...modelos].map(([nombre, cuerpo]) => [/@@map\("([a-z_]+)"\)/.exec(cuerpo)?.[1] ?? nombre, nombre]));
  /** Columnas escalares de la tabla (los campos de relación son de otro modelo; ninguno de estos lleva @map de campo). */
  const columnas = (tabla: string): string[] => {
    const cuerpo = modelos.get(mapa.get(tabla) ?? "") ?? "";
    expect(cuerpo, tabla).not.toBe("");
    return cuerpo
      .split("\n")
      .map((l) => /^\s+(\w+)\s+(\w+)(\[\])?/.exec(l))
      .filter((m): m is RegExpExecArray => m !== null && !modelos.has(m[2]!) && !m[3])
      .map((m) => m[1]!);
  };

  const aPrecios: Permiso[] = [...sql.matchAll(/GRANT\s+([A-Z]+)\s*(?:\(([^)]*)\))?\s+ON\s+TABLE\s+public\.([a-z_]+)\s+TO\s+inv_precios\s*;/g)].map((m) => ({
    tabla: m[3]!,
    privilegio: m[1]! as Permiso["privilegio"],
    columnas: m[2] ? m[2].split(",").map((c) => c.trim().replace(/^"|"$/g, "")) : [],
  }));
  const sinColumnas = [...sql.matchAll(/GRANT\s+[A-Z]+\s+ON\s+TABLE\s+public\.[a-z_]+\s+TO\s+inv_precios/g)];

  it("exactamente los permisos de la lista única, todos por columna (ninguno de tabla completa)", () => {
    expect(filasPermisos(aPrecios)).toEqual(filasPermisos(PERMISOS_PRECIOS));
    expect(sinColumnas).toEqual([]);
  });

  it("todo GRANT a inv_precios tiene la forma de la lista (nada se escapa del análisis)", () => {
    expect([...sql.matchAll(/GRANT[^;]*\bTO\s+inv_precios\b/g)]).toHaveLength(aPrecios.length);
    expect(sql).not.toMatch(/EXECUTE\s+format\s*\(\s*'GRANT[^']*inv_precios/);
  });

  it("solo esas 8 tablas; INSERT y UPDATE solo en precio_cierre y valor_unidad_fondo; UPDATE solo de \"reemplazadoEn\"", () => {
    expect([...new Set(PERMISOS_PRECIOS.map((p) => p.tabla))].sort()).toEqual(
      ["calendario_bvc", "certificacion", "certificacion_posicion", "instrumento", "lote", "precio_cierre", "simbolo_precio", "valor_unidad_fondo"],
    );
    for (const p of PERMISOS_PRECIOS.filter((x) => x.privilegio !== "SELECT")) expect(["precio_cierre", "valor_unidad_fondo"], p.tabla).toContain(p.tabla);
    for (const p of PERMISOS_PRECIOS.filter((x) => x.privilegio === "UPDATE")) expect(p.columnas).toEqual(["reemplazadoEn"]);
  });

  it("lo que inserta nace vigente: el INSERT no incluye \"reemplazadoEn\"", () => {
    for (const p of PERMISOS_PRECIOS.filter((x) => x.privilegio === "INSERT")) expect(p.columnas, p.tabla).not.toContain("reemplazadoEn");
  });

  it("nada de cantidades, costos, montos, filas crudas, correos ni nombres; de lote, solo \"instrumentoId\"", () => {
    const prohibidas = /^(cantidad.*|costo.*|comision|valorMercado|saldo.*|encargo|crudo|unidades|nombre|nitFondo|email|claveHash|totpSecreto|notaCosto)$/;
    for (const p of PERMISOS_PRECIOS) for (const c of p.columnas) expect(c, `${p.tabla}.${c}`).not.toMatch(prohibidas);
    expect(PERMISOS_PRECIOS.filter((p) => p.tabla === "lote")).toEqual([{ tabla: "lote", privilegio: "SELECT", columnas: ["instrumentoId"] }]);
  });

  it("cada columna existe en su modelo; el SELECT de precio_cierre es la tabla entera (create() hace RETURNING de todas)", () => {
    for (const p of PERMISOS_PRECIOS) for (const c of p.columnas) expect(columnas(p.tabla), `${p.tabla}.${c}`).toContain(c);
    expect([...PRECIO_CIERRE_COLUMNAS].sort()).toEqual(columnas("precio_cierre").sort());
  });

  it("si el rol no existe se omite con un aviso: nunca RAISE EXCEPTION por inv_precios", () => {
    expect(sql).toMatch(/IF EXISTS \(SELECT 1 FROM pg_roles WHERE rolname = 'inv_precios'\) THEN/);
    expect(sql).toMatch(/RAISE NOTICE '[^']*inv_precios[^']*'/);
    expect(sql).not.toMatch(/RAISE EXCEPTION '[^']*inv_precios/);
  });

  it("parte de cero en cada corrida: REVOKE ALL de cada tabla y secuencia, dentro de la guarda y antes de dar nada", () => {
    const guarda = sql.indexOf("IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'inv_precios') THEN");
    const tablas = sql.indexOf("EXECUTE format('REVOKE ALL ON TABLE public.%I FROM inv_precios', t.relname);");
    const secuencias = sql.indexOf("EXECUTE format('REVOKE ALL ON SEQUENCE public.%I FROM inv_precios', t.relname);");
    const primerGrant = sql.search(/GRANT[^;]*TO\s+inv_precios/);
    expect(guarda).toBeGreaterThanOrEqual(0);
    expect(tablas).toBeGreaterThan(guarda);
    expect(secuencias).toBeGreaterThan(guarda);
    expect(primerGrant).toBeGreaterThan(Math.max(tablas, secuencias));
  });

  // El disparador precio_cierre_insercion es SECURITY INVOKER: lee la certificación con los privilegios de quien
  // inserta. Si se le quitaran a inv_precios, cada cierre fallaría (falla cerrada), pero el servicio dejaría de guardar.
  it("le da las columnas que lee el disparador de integridad (precio de valoración del día de corte)", () => {
    const migracion = readdirSync(ruta008("prisma/migrations")).find((c) => c.endsWith("_precios_integridad"));
    expect(migracion).toBeDefined();
    const disparador = leer008(`prisma/migrations/${migracion}/migration.sql`);
    expect(disparador).toContain('SELECT p."precioValoracion" INTO ref');
    expect(disparador).toContain('FROM public."certificacion_posicion" p JOIN public."certificacion" c ON c."id" = p."certificacionId"');
    expect(disparador).toContain('WHERE p."instrumentoId" = NEW."instrumentoId" AND c."fechaCorte" = NEW."fecha";');
    const filas = filasPermisos(PERMISOS_PRECIOS);
    for (const f of ["certificacion.id", "certificacion.fechaCorte", "certificacion_posicion.certificacionId", "certificacion_posicion.instrumentoId", "certificacion_posicion.precioValoracion"]) {
      expect(filas).toContain(`${f} SELECT`);
    }
  });
});

// Fase E (E8): la configuración de la IA. El dueño la escribe desde /edicion/ia, que corre como inv_app: solo INSERT,
// POR COLUMNA con todas las de config_ia MENOS "creadaEn" (la pone la base, como en el plan), y nada más. Es de solo
// inserción por su disparador: un cambio es una versión nueva.
describe("privilegios de la configuración de la IA (config_ia)", () => {
  const grantsConfig = [...sql.matchAll(/GRANT\s+([A-Z]+)\s*(?:\(([^)]*)\))?\s+ON\s+TABLE\s+public\.config_ia\s+TO\s+inv_app\s*;/g)];

  it("un solo GRANT a inv_app: INSERT por columna, con todas las columnas del esquema menos creadaEn", () => {
    expect(grantsConfig).toHaveLength(1);
    expect(grantsConfig[0]![1]).toBe("INSERT");
    const columnas = grantsConfig[0]![2]!.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    const delEsquema = columnasDe("config_ia");
    expect(delEsquema).toContain("creadaEn");
    expect([...columnas].sort()).toEqual(delEsquema.filter((c) => c !== "creadaEn").sort());
    expect(sql).not.toMatch(/GRANT\s+(?!INSERT\s*\()[^;]*\bpublic\.config_ia\b[^;]*TO\s+inv_app/);
  });

  it("va después del REVOKE ALL de cada corrida", () => {
    const revoke = sql.indexOf("EXECUTE format('REVOKE ALL ON TABLE public.%I FROM inv_app', t.relname);");
    expect(sql.search(/GRANT INSERT \([^)]*\) ON TABLE public\.config_ia TO inv_app;/)).toBeGreaterThan(revoke);
  });

  it("su migración la hace de solo inserción", () => {
    const sqls = migracionesTexto();
    expect(sqls).toMatch(/CREATE TRIGGER "config_ia_solo_insercion" BEFORE UPDATE OR DELETE ON "config_ia"/);
  });
});

/** El texto de todas las migraciones, juntas. */
function migracionesTexto(): string {
  const dir = ruta008("prisma/migrations");
  return readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => leer008(`prisma/migrations/${d.name}/migration.sql`)).join("\n");
}
