// Candado de la migración *_precios_integridad (disparadores de integridad frente a inv_precios): la regla del
// candado de A&V vive en dos lugares (src/precios/guardar.ts y el SQL del disparador) y tiene que ser la MISMA.
// Si alguien cambia una constante del código sin una migración nueva (o al revés), esto se pone rojo antes de que
// el servicio de precios empiece a fallar con GUARDADO_ERROR (o a dejar pasar lo que no debe).
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FUENTE_SFC, VALOR_FONDO_MAXIMO_COP, VALOR_UNIDAD_MAXIMO_COP } from "@/fondo/sfc";
import { DESVIACION_PCT_MAXIMA, FUENTE, TOLERANCIA_VERIFICACION } from "@/precios/guardar";
import { fechaEnBogota } from "@/precios/horario";
import { PRECIO_MAXIMO_COP } from "@/precios/yahoo";

const raiz = fileURLToPath(new URL("../../../", import.meta.url));
const dirMigraciones = path.join(raiz, "prisma/migrations");
const carpetas = readdirSync(dirMigraciones, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
const propias = carpetas.filter((c) => c.endsWith("_precios_integridad"));
const sql = propias.length === 1 ? readFileSync(path.join(dirMigraciones, propias[0]!, "migration.sql"), "utf8") : "";
const codigo = sql.replace(/--.*$/gm, "");
const funciones = [...codigo.matchAll(/CREATE FUNCTION "([^"]+)"\(\)([\s\S]*?)\$\$;/g)].map((m) => ({ nombre: m[1]!, cuerpo: m[2]! }));

describe("migración *_precios_integridad", () => {
  it("existe una sola, posterior a la certificación (la última de main cuando se creó)", () => {
    expect(propias).toHaveLength(1);
    expect(propias[0]! > "20261121170000_certificacion_trazabilidad").toBe(true);
  });

  it("es aditiva: solo funciones y disparadores; no toca ni revisa filas", () => {
    expect(codigo).toMatch(/^\s*SET LOCAL lock_timeout = '5s';/);
    for (const prohibido of [/\bDROP\b/i, /\bRENAME\b/i, /\bTRUNCATE\b/i, /\bALTER\s+(TABLE|COLUMN|TYPE)\b/i, /^\s*(UPDATE|DELETE|INSERT)\b/im, /\bVALIDATE\b/i]) {
      expect(codigo).not.toMatch(prohibido);
    }
    expect(funciones.map((f) => f.nombre).sort()).toEqual(["inv_precio_cierre_insercion", "inv_retiro_vigente", "inv_valor_unidad_fondo_insercion"]);
    expect([...codigo.matchAll(/CREATE TRIGGER "([^"]+)"/g)].map((m) => m[1]).sort()).toEqual([
      "precio_cierre_insercion", "precio_cierre_retiro", "valor_unidad_fondo_insercion", "valor_unidad_fondo_retiro",
    ]);
  });

  it("cada función: SECURITY INVOKER (nunca DEFINER), search_path fijo, sin salida por GUC y exime solo al dueño", () => {
    expect(codigo).not.toMatch(/SECURITY\s+DEFINER/i);
    for (const f of funciones) {
      expect(f.cuerpo, f.nombre).toMatch(/LANGUAGE plpgsql\s+SET search_path = pg_catalog, public, pg_temp AS \$\$/);
      expect(f.cuerpo, f.nombre).not.toMatch(/current_setting|set_config|session_user|current_user\s*=/i);
      expect(f.cuerpo, f.nombre).toMatch(/IF pg_has_role\(\(SELECT c\.relowner FROM pg_catalog\.pg_class c WHERE c\.oid = TG_RELID\), 'USAGE'\) THEN/);
    }
  });

  it("dice el riesgo residual completo (lo mismo que privilegios.sql)", () => {
    const privilegios = readFileSync(path.join(raiz, "docker/migrador/privilegios.sql"), "utf8").replace(/\s*--\s*/g, " ");
    const cabecera = sql.replace(/\s*--\s*/g, " ");
    for (const texto of [cabecera, privilegios]) {
      expect(texto).toMatch(/un precio falso dentro del ±1 % de la valoración de A&V entra como VERIFICADO/);
      expect(texto).toMatch(/precios falsos NO_VERIFICADO, también en días con certificación/);
      expect(texto).toMatch(/retirar vigentes de cualquier fuente, también en masa y sin sucesor/);
      expect(texto).toMatch(/de cualquier instrumento/);
    }
  });

  it("las tablas que leen van calificadas con public (nada se resuelve por el search_path del que llama)", () => {
    expect(codigo).toMatch(/FROM public\."certificacion_posicion" p JOIN public\."certificacion" c/);
    expect(codigo).not.toMatch(/FROM\s+"/);
  });
});

describe("la regla del disparador es la misma de src/precios y src/fondo", () => {
  it("fuente de los cierres: FUENTE de guardar.ts", () => {
    expect(FUENTE).toBe("yahoo");
    expect(codigo).toContain(`IF NEW."fuente" IS DISTINCT FROM '${FUENTE}' THEN`);
  });

  it("fuente de los valores del fondo: FUENTE_SFC de sfc.ts", () => {
    expect(codigo).toContain(`IF NEW."fuente" IS DISTINCT FROM '${FUENTE_SFC}' THEN`);
  });

  it("tolerancia de la verificación (1 %), sin dividir: TOLERANCIA_VERIFICACION", () => {
    expect(codigo).toContain(`ELSIF abs(NEW."precio" - ref) <= ${TOLERANCIA_VERIFICACION.toString()} * ref THEN`);
  });

  it("lo más que cabe en desviacionPct: DESVIACION_PCT_MAXIMA", () => {
    expect(codigo).toContain(`IF desviacion > ${DESVIACION_PCT_MAXIMA.toString()} THEN`);
  });

  it("el tope de cordura del precio: PRECIO_MAXIMO_COP (yahoo.ts y csv-cierres.ts)", () => {
    expect(codigo).toContain(`IF NEW."precio" > ${PRECIO_MAXIMO_COP} THEN`);
  });

  it("el rango del valor de unidad y del valor del fondo: el de leerDecimalSfc (> 0 y ≤ VALOR_*_MAXIMO_COP; frena NaN)", () => {
    expect(codigo).toContain(`IF NOT (NEW."valorUnidad" > 0 AND NEW."valorUnidad" <= ${VALOR_UNIDAD_MAXIMO_COP.toFixed()})`);
    expect(codigo).toContain(`OR (NEW."valorFondo" IS NOT NULL AND NOT (NEW."valorFondo" > 0 AND NEW."valorFondo" <= ${VALOR_FONDO_MAXIMO_COP.toFixed()})) THEN`);
  });

  it("la referencia se escribe como en guardar.ts: certificacion:AAAA-MM-DD", () => {
    const guardar = readFileSync(path.join(raiz, "src/precios/guardar.ts"), "utf8");
    expect(guardar).toContain("fuenteReferencia: `certificacion:${ref.certificacion.fechaCorte.toISOString().slice(0, 10)}`");
    expect(codigo).toContain(`fuente_ref := 'certificacion:' || to_char(NEW."fecha", 'YYYY-MM-DD');`);
  });

  it("«hoy» es Colombia a UTC−5 fijo, como fechaEnBogota (sin depender de la zona de la sesión)", () => {
    expect(fechaEnBogota(new Date("2027-03-09T04:59:59Z")).toISOString().slice(0, 10)).toBe("2027-03-08");
    expect(fechaEnBogota(new Date("2027-03-09T05:00:00Z")).toISOString().slice(0, 10)).toBe("2027-03-09");
    expect(codigo.match(/hoy date := \(\(now\(\) AT TIME ZONE 'UTC'\) - interval '5 hours'\)::date;/g)).toHaveLength(2);
    expect(codigo).not.toMatch(/current_date|localtimestamp/i);
  });
});
