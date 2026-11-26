// docker/migrador/privilegios.sql · inv_alertas (el servicio de las alertas): exactamente los permisos de la lista única
// (permisos-alertas.ts), todos por COLUMNA, solo si el rol existe y partiendo de cero en cada corrida. Lee lo que necesita
// leer-entrada.ts (sin el motivo ni el autor de los umbrales, sin la acción, la cantidad ni el detalle del plan, sin
// montos de las órdenes) y escribe solo en alerta, con INSERT y sin "detectadaEn". inv_app inserta umbrales y vistas, nunca
// alertas. Que muerdan en una PostgreSQL real lo prueban roles-base.test.ts (CI) y tests/integracion/alertas-leer.test.ts.
import { describe, expect, it } from "vitest";
import { filasPermisos, PERMISOS_ALERTAS, PERMISOS_APP_ALERTAS, PROHIBIDAS_ALERTAS, TABLAS_FUERA_ALERTAS, UMBRAL_VERSION_COLUMNAS, ALERTA_COLUMNAS, type Permiso } from "./permisos-alertas";
import { leer008 } from "./falsos";

const crudo = leer008("docker/migrador/privilegios.sql");
const sql = crudo.replace(/--.*$/gm, "");
const RE_GRANT = (rol: string) => new RegExp(`GRANT\\s+([A-Z]+)\\s*(?:\\(([^)]*)\\))?\\s+ON\\s+TABLE\\s+public\\.([a-z_]+)\\s+TO\\s+${rol}\\s*;`, "g");
const aRol = (rol: string): Permiso[] =>
  [...sql.matchAll(RE_GRANT(rol))].map((m) => ({
    tabla: m[3]!,
    privilegio: m[1]! as Permiso["privilegio"],
    columnas: m[2] ? m[2].split(",").map((c) => c.trim().replace(/^"|"$/g, "")) : [],
  }));
const aAlertas = aRol("inv_alertas");

const esquema = leer008("prisma/schema.prisma").replace(/\/\/.*$/gm, "");
const modelos = new Map([...esquema.matchAll(/model (\w+) \{([\s\S]*?)\n\}/g)].map((m) => [m[1]!, m[2]!]));
/** Columnas escalares de una tabla según prisma/schema.prisma (los campos de relación son de otro modelo). */
function columnasDe(tabla: string): string[] {
  const cuerpo = [...modelos.values()].find((c) => new RegExp(`@@map\\("${tabla}"\\)`).test(c)) ?? "";
  expect(cuerpo, tabla).not.toBe("");
  return cuerpo
    .split("\n")
    .map((l) => /^\s+(\w+)\s+(\w+)(\[\])?/.exec(l))
    .filter((m): m is RegExpExecArray => m !== null && !modelos.has(m[2]!) && (!m[3] || m[2] === "String"))
    .map((m) => m[1]!);
}

describe("privilegios de inv_alertas", () => {
  it("exactamente los permisos de la lista única, todos por columna (ninguno de tabla completa)", () => {
    expect(aAlertas.length).toBeGreaterThan(0);
    expect(filasPermisos(aAlertas)).toEqual(filasPermisos(PERMISOS_ALERTAS));
    expect([...sql.matchAll(/GRANT\s+[A-Z]+\s+ON\s+TABLE\s+public\.[a-z_]+\s+TO\s+inv_alertas/g)]).toEqual([]);
  });

  it("todo GRANT a inv_alertas tiene la forma de la lista (nada se escapa del análisis, ni por EXECUTE format)", () => {
    expect([...sql.matchAll(/GRANT[^;]*\bTO\s+inv_alertas\b/g)]).toHaveLength(aAlertas.length);
    expect(sql).not.toMatch(/EXECUTE\s+format\s*\(\s*'GRANT[^']*inv_alertas/);
    expect(sql).not.toMatch(/GRANT[^;]*(UPDATE|DELETE|TRUNCATE|REFERENCES|TRIGGER|ALL|CREATE)[^;]*\bTO\s+inv_alertas\b/);
  });

  it("solo SELECT e INSERT; INSERT solo en alerta, con todas sus columnas menos detectadaEn (la pone la base)", () => {
    expect([...new Set(PERMISOS_ALERTAS.map((p) => p.privilegio))].sort()).toEqual(["INSERT", "SELECT"]);
    const inserts = PERMISOS_ALERTAS.filter((p) => p.privilegio === "INSERT");
    expect(inserts.map((p) => p.tabla)).toEqual(["alerta"]);
    expect([...inserts[0]!.columnas].sort()).toEqual(ALERTA_COLUMNAS.filter((c) => c !== "detectadaEn").sort());
    expect([...ALERTA_COLUMNAS].sort()).toEqual(columnasDe("alerta").sort());
    expect([...UMBRAL_VERSION_COLUMNAS].sort()).toEqual(columnasDe("umbral_version").sort());
  });

  it("de umbral_version no lee el motivo ni el autor; del plan, no la acción, la cantidad, el plazo ni el detalle", () => {
    const umbral = PERMISOS_ALERTAS.find((p) => p.tabla === "umbral_version")!;
    for (const c of ["motivo", "autorId"]) expect(umbral.columnas).not.toContain(c);
    const reglas = PERMISOS_ALERTAS.find((p) => p.tabla === "regla_plan")!;
    for (const c of ["accion", "cantidad", "plazoHasta", "detalle"]) expect(reglas.columnas).not.toContain(c);
  });

  it("cada columna existe en su modelo, y ninguna es de las prohibidas (que también existen: control positivo)", () => {
    for (const p of PERMISOS_ALERTAS) for (const c of p.columnas) expect(columnasDe(p.tabla), `${p.tabla}.${c}`).toContain(c);
    for (const [tabla, prohibidas] of Object.entries(PROHIBIDAS_ALERTAS)) {
      for (const c of prohibidas) expect(columnasDe(tabla), `${tabla}.${c} existe`).toContain(c);
      for (const p of PERMISOS_ALERTAS.filter((x) => x.tabla === tabla)) for (const c of prohibidas) expect(p.columnas, `${tabla}.${c}`).not.toContain(c);
    }
  });

  it("nada de lo cifrado, crudo, personal ni de los montos del portafolio, y ninguna de las tablas de fuera", () => {
    const prohibidas = /^(crudo|encargo|email|claveHash|totpSecreto|presesionHash|tokenHash|codigoHash|ip|detalle|motivo|nota|nitFondo|sha256|nombreArchivo|costoTotal|costoBase|totalInvertido|totalEstimado|comision|montoNeto)$/;
    for (const p of PERMISOS_ALERTAS) for (const c of p.columnas) expect(c, `${p.tabla}.${c}`).not.toMatch(prohibidas);
    for (const tabla of TABLAS_FUERA_ALERTAS) expect(PERMISOS_ALERTAS.some((p) => p.tabla === tabla), tabla).toBe(false);
  });

  it("si el rol no existe se omite con un aviso: nunca RAISE EXCEPTION por inv_alertas (el despliegue de hoy no depende de él)", () => {
    expect(sql).toMatch(/IF EXISTS \(SELECT 1 FROM pg_roles WHERE rolname = 'inv_alertas'\) THEN/);
    expect(sql).toMatch(/RAISE NOTICE '[^']*inv_alertas[^']*'/);
    expect(sql).not.toMatch(/RAISE EXCEPTION '[^']*inv_alertas/);
  });

  it("parte de cero en cada corrida: REVOKE ALL de cada tabla y secuencia, dentro de la guarda y antes de dar nada", () => {
    const guarda = sql.indexOf("IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'inv_alertas') THEN");
    const tablas = sql.indexOf("EXECUTE format('REVOKE ALL ON TABLE public.%I FROM inv_alertas', t.relname);");
    const secuencias = sql.indexOf("EXECUTE format('REVOKE ALL ON SEQUENCE public.%I FROM inv_alertas', t.relname);");
    const primerGrant = sql.search(/GRANT[^;]*TO\s+inv_alertas/);
    expect(guarda).toBeGreaterThanOrEqual(0);
    expect(tablas).toBeGreaterThan(guarda);
    expect(secuencias).toBeGreaterThan(guarda);
    expect(primerGrant).toBeGreaterThan(Math.max(tablas, secuencias));
  });

  it("el comentario de cabecera documenta a inv_alertas y su riesgo residual", () => {
    expect(crudo).toMatch(/inv_alertas \(el servicio de las alertas/);
    expect(crudo).toMatch(/Riesgo residual de inv_alertas/);
  });
});

describe("inv_app y las alertas", () => {
  const aApp = aRol("inv_app");

  it("INSERT por columna en umbral_version (sin creadaEn) y alerta_vista (sin vistaEn), y nada más sobre ellas", () => {
    const nuevas = aApp.filter((p) => ["umbral_version", "alerta_vista"].includes(p.tabla));
    expect(filasPermisos(nuevas)).toEqual(filasPermisos(PERMISOS_APP_ALERTAS));
    expect(nuevas.every((p) => p.privilegio === "INSERT" && p.columnas.length > 0)).toBe(true);
    expect(sql).not.toMatch(/GRANT\s+[A-Z]+\s+ON\s+TABLE\s+public\.(umbral_version|alerta_vista|alerta)\s+TO\s+inv_app/);
  });

  it("inv_app nunca escribe en alerta: ningún GRANT a inv_app la nombra (el SELECT le llega por el bucle de todas las tablas)", () => {
    expect(sql).not.toMatch(/GRANT[^;]*\bpublic\.alerta\b[^;]*\bTO\s+inv_app\b/);
    expect(aApp.some((p) => p.tabla === "alerta")).toBe(false);
    expect(sql).toMatch(/EXECUTE format\('GRANT SELECT ON TABLE public\.%I TO inv_app', t\.relname\);/);
  });
});
