// docker/migrador/privilegios.sql · inv_ia (el servicio de los resúmenes con IA, fase E): exactamente los permisos de la
// lista única (tests/unit/ia/registro/permisos-ia.ts), todos por COLUMNA, solo si el rol existe y partiendo de cero en
// cada corrida. Lee lo que necesitan los armadores (sin lo cifrado, lo crudo, lo personal ni el texto libre del plan) y
// escribe solo en resumen_ia, con INSERT y sin "generadoEn". inv_app solo LEE resumen_ia. Que muerdan en una
// PostgreSQL real lo prueban tests/integracion/ia/privilegios-ia.test.ts (Mac y CI) y roles-base.test.ts (CI, inv_ia real).
import { describe, expect, it } from "vitest";
import { filasPermisos, PERMISOS_IA, PROHIBIDAS_IA, RESUMEN_IA_COLUMNAS, TABLAS_FUERA_IA, type Permiso } from "../ia/registro/permisos-ia";
import { leer008 } from "./falsos";

const crudo = leer008("docker/migrador/privilegios.sql");
const sql = crudo.replace(/--.*$/gm, "");
const aIa: Permiso[] = [...sql.matchAll(/GRANT\s+([A-Z]+)\s*(?:\(([^)]*)\))?\s+ON\s+TABLE\s+public\.([a-z_]+)\s+TO\s+inv_ia\s*;/g)].map((m) => ({
  tabla: m[3]!,
  privilegio: m[1]! as Permiso["privilegio"],
  columnas: m[2] ? m[2].split(",").map((c) => c.trim().replace(/^"|"$/g, "")) : [],
}));

/** Columnas escalares de una tabla según prisma/schema.prisma (los campos de relación son de otro modelo). */
function columnasDe(tabla: string): string[] {
  const esquema = leer008("prisma/schema.prisma").replace(/\/\/.*$/gm, "");
  const modelos = new Map([...esquema.matchAll(/model (\w+) \{([\s\S]*?)\n\}/g)].map((m) => [m[1]!, m[2]!]));
  const cuerpo = [...modelos.values()].find((c) => new RegExp(`@@map\\("${tabla}"\\)`).test(c)) ?? "";
  expect(cuerpo, tabla).not.toBe("");
  return cuerpo
    .split("\n")
    .map((l) => /^\s+(\w+)\s+(\w+)(\[\])?/.exec(l))
    .filter((m): m is RegExpExecArray => m !== null && !modelos.has(m[2]!) && (!m[3] || m[2] === "String"))
    .map((m) => m[1]!);
}

describe("privilegios de inv_ia", () => {
  it("exactamente los permisos de la lista única, todos por columna (ninguno de tabla completa)", () => {
    expect(aIa.length).toBeGreaterThan(0);
    expect(filasPermisos(aIa)).toEqual(filasPermisos(PERMISOS_IA));
    expect([...sql.matchAll(/GRANT\s+[A-Z]+\s+ON\s+TABLE\s+public\.[a-z_]+\s+TO\s+inv_ia/g)]).toEqual([]);
  });

  it("todo GRANT a inv_ia tiene la forma de la lista (nada se escapa del análisis, ni por EXECUTE format)", () => {
    expect([...sql.matchAll(/GRANT[^;]*\bTO\s+inv_ia\b/g)]).toHaveLength(aIa.length);
    expect(sql).not.toMatch(/EXECUTE\s+format\s*\(\s*'GRANT[^']*inv_ia/);
    expect(sql).not.toMatch(/GRANT[^;]*(UPDATE|DELETE|TRUNCATE|REFERENCES|TRIGGER|ALL|CREATE)[^;]*\bTO\s+inv_ia\b/);
  });

  it("solo SELECT e INSERT; INSERT solo en resumen_ia, con todas sus columnas menos generadoEn (la pone la base)", () => {
    expect([...new Set(PERMISOS_IA.map((p) => p.privilegio))].sort()).toEqual(["INSERT", "SELECT"]);
    const inserts = PERMISOS_IA.filter((p) => p.privilegio === "INSERT");
    expect(inserts.map((p) => p.tabla)).toEqual(["resumen_ia"]);
    expect([...inserts[0]!.columnas].sort()).toEqual(RESUMEN_IA_COLUMNAS.filter((c) => c !== "generadoEn").sort());
    expect([...RESUMEN_IA_COLUMNAS].sort()).toEqual(columnasDe("resumen_ia").sort());
  });

  it("cada columna existe en su modelo, y ninguna es de las prohibidas", () => {
    for (const p of PERMISOS_IA) for (const c of p.columnas) expect(columnasDe(p.tabla), `${p.tabla}.${c}`).toContain(c);
    for (const [tabla, prohibidas] of Object.entries(PROHIBIDAS_IA)) {
      for (const c of prohibidas) expect(columnasDe(tabla), `${tabla}.${c} existe`).toContain(c);
      for (const p of PERMISOS_IA.filter((x) => x.tabla === tabla)) for (const c of prohibidas) expect(p.columnas, `${tabla}.${c}`).not.toContain(c);
    }
  });

  it("nada de lo cifrado, crudo o personal en ninguna tabla, y ninguna de las tablas de fuera", () => {
    const prohibidas = /^(crudo|encargo|email|claveHash|totpSecreto|presesionHash|tokenHash|codigoHash|ip|detalle|motivo|nota|nitFondo|sha256|nombreArchivo)$/;
    for (const p of PERMISOS_IA.filter((x) => x.tabla !== "resumen_ia")) for (const c of p.columnas) expect(c, `${p.tabla}.${c}`).not.toMatch(prohibidas);
    for (const tabla of TABLAS_FUERA_IA) expect(PERMISOS_IA.some((p) => p.tabla === tabla), tabla).toBe(false);
  });

  it("si el rol no existe se omite con un aviso: nunca RAISE EXCEPTION por inv_ia (el despliegue de hoy no depende de él)", () => {
    expect(sql).toMatch(/IF EXISTS \(SELECT 1 FROM pg_roles WHERE rolname = 'inv_ia'\) THEN/);
    expect(sql).toMatch(/RAISE NOTICE '[^']*inv_ia[^']*'/);
    expect(sql).not.toMatch(/RAISE EXCEPTION '[^']*inv_ia/);
  });

  it("parte de cero en cada corrida: REVOKE ALL de cada tabla y secuencia, dentro de la guarda y antes de dar nada", () => {
    const guarda = sql.indexOf("IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'inv_ia') THEN");
    const tablas = sql.indexOf("EXECUTE format('REVOKE ALL ON TABLE public.%I FROM inv_ia', t.relname);");
    const secuencias = sql.indexOf("EXECUTE format('REVOKE ALL ON SEQUENCE public.%I FROM inv_ia', t.relname);");
    const primerGrant = sql.search(/GRANT[^;]*TO\s+inv_ia/);
    expect(guarda).toBeGreaterThanOrEqual(0);
    expect(tablas).toBeGreaterThan(guarda);
    expect(secuencias).toBeGreaterThan(guarda);
    expect(primerGrant).toBeGreaterThan(Math.max(tablas, secuencias));
  });

  it("el comentario de cabecera documenta a inv_ia y su riesgo residual", () => {
    expect(crudo).toMatch(/inv_ia \(el servicio de los resúmenes con IA/);
    expect(crudo).toMatch(/Riesgo residual de inv_ia/);
  });
});

describe("inv_app y resumen_ia", () => {
  it("inv_app solo LEE resumen_ia: ningún GRANT a inv_app la nombra (el SELECT le llega por el bucle de todas las tablas)", () => {
    expect(sql).not.toMatch(/GRANT[^;]*\bpublic\.resumen_ia\b[^;]*\bTO\s+inv_app\b/);
    expect(sql).toMatch(/EXECUTE format\('GRANT SELECT ON TABLE public\.%I TO inv_app', t\.relname\);/);
  });
});
