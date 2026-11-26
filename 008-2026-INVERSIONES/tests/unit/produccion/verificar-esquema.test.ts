// Guardián del esquema (scripts/verificar-esquema.sql): Prisma no ve lo escrito a mano en las migraciones
// (índices parciales, CHECK, EXCLUDE, disparadores, funciones y extensiones) y nadie vigilaba lo que Prisma sí
// crea pero de lo que depende la integridad (índices únicos, llaves primarias y foráneas con su ON DELETE).
// La lista del guardián debe ser EXACTAMENTE la que sale de prisma/migrations: si alguien agrega uno y no lo
// suma, esto se pone rojo. Las definiciones exactas las comprueban contra PostgreSQL real
// tests/integracion/guardian-esquema.test.ts (en el Mac y en el CI) y roles-base.test.ts (solo CI).
// Límites del lector de migraciones (por regex): exige nombres entre comillas (lo hace cumplir una prueba de
// abajo), no modela DROP TABLE ni DROP COLUMN (hoy ninguna migración los usa) ni RENAME (un RENAME COLUMN, como el
// de dividendo_decretado en *_datos_oficiales, no cambia ningún objeto de la lista; uno de índice, restricción o
// disparador lo frena una prueba de abajo) y quita los `--` de comentario sin mirar si caen dentro de un literal.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { leer008, ruta008 } from "./falsos";

interface Objetos {
  readonly indices: Set<string>;
  readonly restricciones: Set<string>;
  readonly sinValidar: Set<string>;
  readonly llaves: Set<string>;
  readonly llavesSinValidar: Set<string>;
  readonly disparadores: Set<string>;
  readonly funciones: Set<string>;
  readonly extensiones: Set<string>;
}

const migraciones = (): string[] => {
  const dir = ruta008("prisma/migrations");
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
    .map((c) => readFileSync(path.join(dir, c, "migration.sql"), "utf8").replace(/--.*$/gm, ""));
};

type Evento = { readonly pos: number; readonly aplicar: (o: Objetos) => void };

/** Los cambios de una migración, en el orden en que aparecen (un DROP seguido de un ADD del mismo nombre deja el objeto). */
function eventos(sql: string): Evento[] {
  const de = (re: RegExp, aplicar: (o: Objetos, m: RegExpMatchArray) => void): Evento[] =>
    [...sql.matchAll(re)].map((m) => ({ pos: m.index ?? 0, aplicar: (o: Objetos) => aplicar(o, m) }));
  return [
    // Índices únicos (de Prisma o a mano) y parciales (a mano).
    ...de(/CREATE\s+UNIQUE\s+INDEX\s+"([^"]+)"/gi, (o, m) => o.indices.add(m[1]!)),
    ...de(/CREATE\s+INDEX\s+"([^"]+)"[^;]*?\bWHERE\b/gi, (o, m) => o.indices.add(m[1]!)),
    // CHECK y EXCLUDE con nombre (también dentro de CREATE TABLE); los NOT VALID quedan aparte hasta su VALIDATE.
    ...de(/CONSTRAINT\s+"([^"]+)"\s+(?:CHECK|EXCLUDE)\b([^;]*)/gi, (o, m) => {
      o.restricciones.add(m[1]!);
      if (/\bNOT\s+VALID\b/i.test(m[2]!)) o.sinValidar.add(m[1]!);
    }),
    // Llaves primarias y foráneas (Prisma las crea; su ON DELETE y ON UPDATE van en la definición).
    ...de(/CONSTRAINT\s+"([^"]+)"\s+(?:PRIMARY\s+KEY|FOREIGN\s+KEY)\b([^;]*)/gi, (o, m) => {
      o.llaves.add(m[1]!);
      if (/\bNOT\s+VALID\b/i.test(m[2]!)) o.llavesSinValidar.add(m[1]!);
    }),
    ...de(/VALIDATE\s+CONSTRAINT\s+"([^"]+)"/gi, (o, m) => {
      o.sinValidar.delete(m[1]!);
      o.llavesSinValidar.delete(m[1]!);
    }),
    ...de(/CREATE\s+TRIGGER\s+"([^"]+)"/gi, (o, m) => o.disparadores.add(m[1]!)),
    ...de(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+"([^"]+)"/gi, (o, m) => o.funciones.add(m[1]!)),
    ...de(/CREATE\s+EXTENSION\s+(?:IF\s+NOT\s+EXISTS\s+)?"([^"]+)"/gi, (o, m) => o.extensiones.add(m[1]!)),
    ...de(/DROP\s+INDEX\s+(?:IF\s+EXISTS\s+)?"([^"]+)"/gi, (o, m) => o.indices.delete(m[1]!)),
    ...de(/DROP\s+CONSTRAINT\s+(?:IF\s+EXISTS\s+)?"([^"]+)"/gi, (o, m) => {
      for (const s of [o.restricciones, o.sinValidar, o.llaves, o.llavesSinValidar]) s.delete(m[1]!);
    }),
    ...de(/DROP\s+TRIGGER\s+(?:IF\s+EXISTS\s+)?"([^"]+)"/gi, (o, m) => o.disparadores.delete(m[1]!)),
    ...de(/DROP\s+FUNCTION\s+(?:IF\s+EXISTS\s+)?"([^"]+)"/gi, (o, m) => o.funciones.delete(m[1]!)),
  ].sort((a, b) => a.pos - b.pos);
}

/** Recorre las migraciones en orden y devuelve lo que sigue vivo al final. */
function desdeMigraciones(): Objetos {
  const o: Objetos = {
    indices: new Set(), restricciones: new Set(), sinValidar: new Set(), llaves: new Set(), llavesSinValidar: new Set(),
    disparadores: new Set(), funciones: new Set(), extensiones: new Set(),
  };
  for (const sql of migraciones()) for (const e of eventos(sql)) e.aplicar(o);
  return o;
}

const guardian = leer008("scripts/verificar-esquema.sql");
const bloque = (nombre: string): string => {
  const m = new RegExp(`\\b${nombre}\\s+text\\[\\]\\s*:=\\s*ARRAY\\[([\\s\\S]*?)\\];`).exec(guardian);
  if (!m) throw new Error(`falta la lista ${nombre} en verificar-esquema.sql`);
  return m[1]!;
};
/** Nombres de una lista de filas ['tabla', 'nombre', …] (columna 2) o ['nombre', …] (columna 1). */
const nombres = (lista: string, columna: 1 | 2): string[] =>
  [...bloque(lista).matchAll(/\[\s*'((?:[^']|'')*)'\s*,\s*'((?:[^']|'')*)'/g)].map((m) => m[columna]!);
/** Elementos de una lista plana de textos: ARRAY['a', 'b']. */
const planos = (lista: string): string[] => [...bloque(lista).matchAll(/'((?:[^']|'')*)'/g)].map((m) => m[1]!);

describe("verificar-esquema.sql coincide con las migraciones", () => {
  const esperado = desdeMigraciones();
  const casos: Array<[string, Set<string>, 1 | 2]> = [
    ["indices", esperado.indices, 2],
    ["restricciones", esperado.restricciones, 2],
    ["llaves", esperado.llaves, 2],
    ["disparadores", esperado.disparadores, 2],
    ["funciones", esperado.funciones, 1],
  ];
  for (const [lista, conjunto, columna] of casos) {
    it(`${lista}: misma lista, sin repetidos`, () => {
      const enGuardian = nombres(lista, columna);
      expect(conjunto.size).toBeGreaterThan(0);
      expect(new Set(enGuardian).size).toBe(enGuardian.length);
      expect([...enGuardian].sort()).toEqual([...conjunto].sort());
    });
  }

  it("indices: trae cada índice único de Prisma del que depende la idempotencia, y los del TOTP", () => {
    expect(nombres("indices", 2)).toEqual(
      expect.arrayContaining([
        "fila_fuente_tipoFuente_claveNatural_ocurrencia_key",
        "orden_filaFuenteId_key",
        "dividendo_filaFuenteId_key",
        "movimiento_caja_filaFuenteId_key",
        "certificacion_fechaCorte_key",
        "lote_ordenId_key",
        "evento_corporativo_tipo_origenId_destinoId_fecha_key",
        "codigo_recuperacion_codigoHash_key",
        "token_acceso_tokenHash_key",
      ]),
    );
  });

  it("sin_validar: justo los CHECK que nacen NOT VALID y ninguna migración valida todavía", () => {
    const enGuardian = planos("sin_validar");
    expect(new Set(enGuardian).size).toBe(enGuardian.length);
    expect([...enGuardian].sort()).toEqual([...esperado.sinValidar].sort());
    for (const nombre of enGuardian) expect(esperado.restricciones.has(nombre), nombre).toBe(true);
  });

  it("ninguna FK queda NOT VALID al final de las migraciones (el guardián las exige validadas)", () => {
    expect([...esperado.llavesSinValidar]).toEqual([]);
  });

  it("las migraciones nombran entre comillas cada índice, disparador, función, extensión y restricción (si no, esta prueba no los vería)", () => {
    const sinComillas = migraciones().flatMap((sql) => [
      ...sql.matchAll(/\bCREATE\s+(?:UNIQUE\s+)?INDEX\s+(?!(?:CONCURRENTLY\s+)?(?:IF\s+NOT\s+EXISTS\s+)?")\S+/gi),
      ...sql.matchAll(/\bCREATE\s+(?:CONSTRAINT\s+)?TRIGGER\s+(?!")\S+/gi),
      ...sql.matchAll(/\bCREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?!")\S+/gi),
      ...sql.matchAll(/\bCREATE\s+EXTENSION\s+(?!(?:IF\s+NOT\s+EXISTS\s+)?")\S+/gi),
      ...sql.matchAll(/\bCONSTRAINT\s+(?!")\S+\s+(?:CHECK|EXCLUDE|PRIMARY|FOREIGN|UNIQUE)\b/gi),
    ]).map((m) => m[0]);
    expect(sinComillas).toEqual([]);
  });

  it("extensiones: las mismas que crean las migraciones (btree_gist y citext)", () => {
    const enGuardian = planos("extensiones");
    expect(enGuardian.sort()).toEqual([...esperado.extensiones].sort());
    expect(enGuardian).toEqual(expect.arrayContaining(["btree_gist", "citext"]));
  });

  it("ninguna migración renombra un índice, una restricción ni un disparador (el lector no los seguiría)", () => {
    const renombres = migraciones().flatMap((sql) => [
      ...sql.matchAll(/\bALTER\s+INDEX\b[^;]*\bRENAME\b/gi),
      ...sql.matchAll(/\bRENAME\s+CONSTRAINT\b/gi),
      ...sql.matchAll(/\bALTER\s+TRIGGER\b[^;]*\bRENAME\b/gi),
    ]).map((m) => m[0]);
    expect(renombres).toEqual([]);
  });

  it("las migraciones no traen CHECK ni EXCLUDE sin nombre (el guardián no podría seguirlos)", () => {
    for (const sql of migraciones()) {
      for (const sentencia of sql.split(";")) {
        for (const m of sentencia.matchAll(/\b(?:CHECK\s*\(|EXCLUDE\s+USING\b)/gi)) {
          const antes = sentencia.slice(0, m.index).trimEnd();
          expect(antes, sentencia.slice(0, 120)).toMatch(/CONSTRAINT\s+"[^"]+"$/i);
        }
      }
    }
  });

  it("compara definiciones exactas, validación, índices vivos, disparadores exactos y sin sobrantes, y el md5 de las funciones", () => {
    for (const patron of [
      /pg_get_indexdef/, /indisunique/, /indisvalid/, /indisready/, /indislive/,
      /pg_get_constraintdef/, /convalidated/, /contype IN \('c', 'x'\)/, /contype IN \('p', 'f'\)/,
      /pg_get_triggerdef/, /tgisinternal/, /tgenabled/, /habilitado NOT IN \('O', 'A'\)/,
      /md5\(p\.prosrc\)/, /pg_extension/, /RAISE EXCEPTION/,
    ]) {
      expect(guardian).toMatch(patron);
    }
  });

  // Una función SECURITY DEFINER o con otro search_path no cambia su md5 (prosrc), pero en una función de los
  // disparadores de integridad de precios eximiría a todos: dentro de una DEFINER, current_user es el dueño.
  it("de cada función exige una sola con ese nombre, que no sea SECURITY DEFINER y su SET exacto (proconfig)", () => {
    for (const patron of [/count\(\*\)/, /p\.prosecdef/, /p\.proconfig/, /n_funciones > 1/]) expect(guardian).toMatch(patron);
    const filas = [...bloque("funciones").matchAll(/\[\s*'([^']*)'\s*,\s*'([0-9a-f]{32})'\s*,\s*'([^']*)'\s*\]/g)];
    expect(filas.length).toBe(nombres("funciones", 1).length);
    const config = new Map(filas.map((m) => [m[1]!, m[3]!]));
    // Alertas: las dos de la inserción (SECURITY INVOKER) llevan el mismo search_path fijo; la del instante de umbral_version, ninguno.
    for (const nombre of ["inv_precio_cierre_insercion", "inv_retiro_vigente", "inv_valor_unidad_fondo_insercion", "inv_alerta_insercion", "inv_alerta_vista_insercion", "inv_umbral_version_autor", "inv_umbral_version_instante"]) {
      expect(config.get(nombre), nombre).toBe("search_path=pg_catalog, public, pg_temp");
    }
    // inv_solo_retiro (datos oficiales) no lee tablas: solo pg_catalog, con pg_temp al final.
    expect(config.get("inv_solo_retiro")).toBe("search_path=pg_catalog, pg_temp");
    const conSet = new Set(["inv_retiro_vigente", "inv_solo_retiro"]);
    for (const [nombre, valor] of config) if (!nombre.startsWith("inv_precio_") && !nombre.startsWith("inv_valor_") && !nombre.startsWith("inv_alerta_") && !nombre.startsWith("inv_umbral_version_") && !conSet.has(nombre)) expect(valor, nombre).toBe("");
  });

  // La exención de los disparadores de integridad es «tener los privilegios del dueño»: si inv_precios o inv_app
  // fueran miembros del dueño de esas tablas (GRANT inv_dueno TO …), quedarían eximidos (o con SET ROLE, dueños).
  it("exige que inv_app e inv_precios no sean miembros del dueño de precio_cierre ni de valor_unidad_fondo", () => {
    expect(guardian).toMatch(/WHERE r\.rolname IN \('inv_app', 'inv_precios'\)/);
    expect(guardian).toMatch(/pg_has_role\(r\.oid, c\.relowner, 'MEMBER'\)/);
    expect(guardian).toMatch(/to_regclass\('public\.precio_cierre'\), to_regclass\('public\.valor_unidad_fondo'\)/);
  });

  it("ninguna migración crea una función SECURITY DEFINER", () => {
    for (const sql of migraciones()) expect(sql).not.toMatch(/SECURITY\s+DEFINER/i);
  });

  it("el migrador lo corre después de migrate deploy y antes de los privilegios", () => {
    const migrar = leer008("docker/migrar.sh");
    const a = migrar.indexOf("node_modules/.bin/prisma migrate deploy");
    const b = migrar.indexOf("--file scripts/verificar-esquema.sql");
    const c = migrar.indexOf("--file docker/migrador/privilegios.sql");
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
  });
});

// Fase E (E3): inv_ia (el servicio de los resúmenes con IA) y resumen_ia. El disparador del instante de resumen_ia exime
// a quien tenga los privilegios del dueño: si inv_ia, inv_app o inv_precios fueran miembros de él, con SET ROLE fijarían
// la hora del registro; e inv_ia no puede ser miembro del dueño de ninguna de las tablas con disparadores que eximen al
// dueño. Va en un bloque propio (el de inv_app e inv_precios queda como estaba).
describe("guardián del esquema: inv_ia y resumen_ia", () => {
  const guardian = leer008("scripts/verificar-esquema.sql");

  it("revisa que inv_ia, inv_app e inv_precios no sean miembros del dueño de resumen_ia ni inv_ia del de las demás", () => {
    const m = /WHERE r\.rolname IN \('inv_ia', 'inv_app', 'inv_precios'\)\s+AND c\.oid IN \(([^)]*(?:\)[^)]*)*?)\)\s+AND \(r\.rolname = 'inv_ia' OR c\.oid = to_regclass\('public\.resumen_ia'\)\)\s+AND pg_has_role\(r\.oid, c\.relowner, 'MEMBER'\)/.exec(guardian);
    expect(m, "bloque de membresía de inv_ia").not.toBeNull();
    const tablas = [...m![1]!.matchAll(/to_regclass\('public\.([a-z_]+)'\)/g)].map((x) => x[1]);
    expect(tablas.sort()).toEqual(["decision", "enlace_decision_orden", "plan_version", "precio_cierre", "resumen_ia", "valor_unidad_fondo"]);
  });

  it("exige el índice único parcial de los PUBLICADO, los dos disparadores y la función del instante de resumen_ia", () => {
    expect(guardian).toMatch(/\['resumen_ia', 'resumen_ia_publicado_key', 'CREATE UNIQUE INDEX resumen_ia_publicado_key ON public\.resumen_ia USING btree \(tipo, "fechaNegocio", "hechosHash", "promptHash", "modeloDigest"\) WHERE \(estado = ''PUBLICADO''::"EstadoResumenIa"\)'\]/);
    expect(guardian).toMatch(/\['resumen_ia', 'resumen_ia_solo_insercion', 'CREATE TRIGGER resumen_ia_solo_insercion BEFORE DELETE OR UPDATE ON public\.resumen_ia FOR EACH ROW EXECUTE FUNCTION inv_solo_insercion\(\)'\]/);
    expect(guardian).toMatch(/\['resumen_ia', 'resumen_ia_instante', 'CREATE TRIGGER resumen_ia_instante BEFORE INSERT ON public\.resumen_ia FOR EACH ROW EXECUTE FUNCTION inv_resumen_ia_instante\(\)'\]/);
    expect(guardian).toMatch(/\['inv_resumen_ia_instante', '[0-9a-f]{32}', ''\]/);
  });
});

// Fase E (E8): config_ia. El disparador de su instante exime al dueño, como los demás: ni inv_app (la pantalla que la
// escribe), ni inv_ia (el servicio que la lee), ni inv_precios pueden ser miembros del dueño de config_ia. Bloque propio.
describe("guardián del esquema: config_ia", () => {
  const guardian = leer008("scripts/verificar-esquema.sql");

  it("revisa que inv_app, inv_ia e inv_precios no sean miembros del dueño de config_ia", () => {
    expect(guardian).toMatch(/WHERE r\.rolname IN \('inv_app', 'inv_ia', 'inv_precios'\)\s+AND c\.oid = to_regclass\('public\.config_ia'\)\s+AND pg_has_role\(r\.oid, c\.relowner, 'MEMBER'\)/);
  });

  it("exige la solo inserción, el instante, su función y la unicidad de la versión de config_ia", () => {
    expect(guardian).toMatch(/\['config_ia', 'config_ia_solo_insercion', 'CREATE TRIGGER config_ia_solo_insercion BEFORE DELETE OR UPDATE ON public\.config_ia FOR EACH ROW EXECUTE FUNCTION inv_solo_insercion\(\)'\]/);
    expect(guardian).toMatch(/\['config_ia', 'config_ia_instante', 'CREATE TRIGGER config_ia_instante BEFORE INSERT ON public\.config_ia FOR EACH ROW EXECUTE FUNCTION inv_config_ia_instante\(\)'\]/);
    expect(guardian).toMatch(/\['config_ia', 'config_ia_version_key', 'CREATE UNIQUE INDEX config_ia_version_key ON public\.config_ia USING btree \(version\)'\]/);
    // El mismo código que la del plan (fija "creadaEn"): el mismo md5.
    const md5 = (f: string) => new RegExp(`\\['${f}', '([0-9a-f]{32})', ''\\]`).exec(guardian)?.[1];
    expect(md5("inv_config_ia_instante")).toBeDefined();
    expect(md5("inv_config_ia_instante")).toBe(md5("inv_plan_version_instante"));
  });
});

// Fase E (O5): tarifa_comision. El disparador de su instante exime al dueño, como los demás: ni inv_app (la pantalla que
// la escribe), ni inv_ia, ni inv_precios pueden ser miembros del dueño de tarifa_comision. Bloque propio.
describe("guardián del esquema: tarifa_comision", () => {
  const guardian = leer008("scripts/verificar-esquema.sql");

  it("revisa que inv_app, inv_ia e inv_precios no sean miembros del dueño de tarifa_comision", () => {
    expect(guardian).toMatch(/WHERE r\.rolname IN \('inv_app', 'inv_ia', 'inv_precios'\)\s+AND c\.oid = to_regclass\('public\.tarifa_comision'\)\s+AND pg_has_role\(r\.oid, c\.relowner, 'MEMBER'\)/);
  });

  it("exige la solo inserción, el instante, su función, la unicidad de la versión y las CHECK de tarifa_comision", () => {
    expect(guardian).toMatch(/\['tarifa_comision', 'tarifa_comision_solo_insercion', 'CREATE TRIGGER tarifa_comision_solo_insercion BEFORE DELETE OR UPDATE ON public\.tarifa_comision FOR EACH ROW EXECUTE FUNCTION inv_solo_insercion\(\)'\]/);
    expect(guardian).toMatch(/\['tarifa_comision', 'tarifa_comision_instante', 'CREATE TRIGGER tarifa_comision_instante BEFORE INSERT ON public\.tarifa_comision FOR EACH ROW EXECUTE FUNCTION inv_tarifa_comision_instante\(\)'\]/);
    expect(guardian).toMatch(/\['tarifa_comision', 'tarifa_comision_version_key', 'CREATE UNIQUE INDEX tarifa_comision_version_key ON public\.tarifa_comision USING btree \(version\)'\]/);
    for (const c of ["cargos", "comisionista", "iva", "montos", "motivo", "porcentaje", "version"]) expect(guardian).toContain(`['tarifa_comision', 'tarifa_comision_${c}_chk', 'CHECK `);
    // El mismo código que la del plan (fija "creadaEn"): el mismo md5.
    const md5 = (f: string) => new RegExp(`\\['${f}', '([0-9a-f]{32})', ''\\]`).exec(guardian)?.[1];
    expect(md5("inv_tarifa_comision_instante")).toBeDefined();
    expect(md5("inv_tarifa_comision_instante")).toBe(md5("inv_plan_version_instante"));
  });
});

// Precios cada minuto: precio_intradia. Solo inserción de hecho (UPDATE nunca; DELETE solo de lo de más de 60 días), la
// hora de traída y los topes los pone la base para todo rol que no sea el dueño. Ni inv_app, ni inv_ia, ni inv_precios
// pueden ser miembros del dueño (los disparadores eximen al dueño). Bloque propio.
describe("guardián del esquema: precio_intradia", () => {
  const guardian = leer008("scripts/verificar-esquema.sql");

  it("revisa que inv_app, inv_ia e inv_precios no sean miembros del dueño de precio_intradia", () => {
    expect(guardian).toMatch(/WHERE r\.rolname IN \('inv_app', 'inv_ia', 'inv_precios'\)\s+AND c\.oid = to_regclass\('public\.precio_intradia'\)\s+AND pg_has_role\(r\.oid, c\.relowner, 'MEMBER'\)/);
  });

  it("exige los dos disparadores, sus dos funciones (sin SECURITY DEFINER y con su search_path), la unicidad y las CHECK", () => {
    expect(guardian).toMatch(/\['precio_intradia', 'precio_intradia_insercion', 'CREATE TRIGGER precio_intradia_insercion BEFORE INSERT ON public\.precio_intradia FOR EACH ROW EXECUTE FUNCTION inv_precio_intradia_insercion\(\)'\]/);
    expect(guardian).toMatch(/\['precio_intradia', 'precio_intradia_retiro', 'CREATE TRIGGER precio_intradia_retiro BEFORE DELETE OR UPDATE ON public\.precio_intradia FOR EACH ROW EXECUTE FUNCTION inv_precio_intradia_retiro\(\)'\]/);
    expect(guardian).toMatch(/\['precio_intradia', 'precio_intradia_instrumentoId_instante_fuente_key', 'CREATE UNIQUE INDEX "precio_intradia_instrumentoId_instante_fuente_key" ON public\.precio_intradia USING btree \("instrumentoId", instante, fuente\)'\]/);
    expect(guardian).toContain("['precio_intradia', 'precio_intradia_precio_chk', 'CHECK ");
    expect(guardian).toContain("['precio_intradia', 'precio_intradia_fuente_chk', 'CHECK ");
    expect(guardian).toContain("['precio_intradia', 'precio_intradia_pkey', 'PRIMARY KEY (id)']");
    expect(guardian).toContain("['precio_intradia', 'precio_intradia_instrumentoId_fkey', 'FOREIGN KEY");
    for (const f of ["inv_precio_intradia_insercion", "inv_precio_intradia_retiro"]) {
      expect(guardian).toMatch(new RegExp(`\\['${f}', '[0-9a-f]{32}', 'search_path=pg_catalog, public, pg_temp'\\]`));
    }
  });
});
