// docker/migrador/privilegios.sql: inv_app solo lee, más las escrituras exactas del login y del TOTP
// (contratos de esos frentes), por COLUMNA: UPDATE de "claveHash", "sesionVersion" y "bloqueadoHasta" en
// usuario, UPDATE de "usadoEn" en token_acceso, INSERT en intento_ingreso y, del TOTP, UPDATE de
// "totpSecreto", "totpActivadoEn", "totpUltimoPaso" y "presesionHash" en usuario, más INSERT y UPDATE de
// "usadoEn" y "anuladoEn" en codigo_recuperacion. Nunca DELETE, TRUNCATE, REFERENCES, TRIGGER ni DDL.
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
  it("lectura en cada tabla, uso de secuencias y solo las escrituras del login y del TOTP, por columna", () => {
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
