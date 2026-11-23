// Candados de texto del servicio inv-008-ia en el despliegue (E6): entra con los permanentes, se verifica (salud, redes,
// entorno por nombres, sin puertos), y hay un control de su salida a internet. La imagen lleva el bundle. Los ensayos
// con Docker los hace la Fábrica en inv-008-prueba.
import { describe, expect, it } from "vitest";
import { leer008 } from "./falsos";

const desplegar = leer008("scripts/desplegar-prod.sh");
const dockerfile = leer008("Dockerfile");
const funcion = (nombre: string): string => {
  const inicio = desplegar.indexOf(`\n${nombre}() {`);
  expect(inicio, `falta la función ${nombre}`).toBeGreaterThan(-1);
  return desplegar.slice(inicio, desplegar.indexOf("\n}\n", inicio));
};

describe("desplegar-prod.sh · inv-008-ia", () => {
  it("es un permanente: sube con el up --wait de los demás", () => {
    expect(desplegar).toMatch(/^PERMANENTES=\(inv-008-app inv-008-entrada inv-008-vigia inv-008-respaldo inv-008-ia\)$/m);
    expect(desplegar).toMatch(/^PUENTE_IA="br-inv008-ia"$/m);
    expect(desplegar).toMatch(/^PROPIAS_IA=\(DATABASE_URL INV_IA_SERVICIO_TOKEN INV_IA_DIR_COMPARTIDA TZ\)$/m);
  });

  it("verificar_ia: corriendo, healthy, sin puertos, solo en la interna y la suya (con su puente y nadie más) y con su entorno", () => {
    const f = funcion("verificar_ia");
    expect(f).toContain("verificar_corriendo");
    expect(f).toContain("= healthy ]");
    expect(f).toContain("docker port");
    expect(f).toContain('"false|$PUENTE_IA|1"');
    expect(f).toContain("verificar_entorno_ia");
    expect(funcion("verificar_servicio")).toContain("verificar_ia");
  });

  it("verificar_entorno_ia: por NOMBRES con lista blanca, la credencial solo de inv_ia, y nunca imprime valores", () => {
    const f = funcion("verificar_entorno_ia");
    expect(f).toContain("PROPIAS_IA");
    expect(f).toContain('"inv_ia@inv-008-db"');
    expect(f).toContain("queda en espera");
    expect(f).not.toMatch(/informar[^\n]*\$\(entorno_de/);
  });

  it("verificar_salida_ia: el servicio de IA no debe llegar a la IP pública de la sonda; si llega, avisa (o aborta con INV_IA_EXIGIR_SIN_SALIDA=1)", () => {
    const f = funcion("verificar_salida_ia");
    expect(f).toContain("control_positivo");
    expect(f).toContain("nc -z");
    expect(f).toContain("INV_IA_EXIGIR_SIN_SALIDA");
    expect(f).toContain("morir");
    expect(f).toContain("⚠️");
    // Después del control de la app, que sigue igual.
    expect(desplegar.indexOf("\n  verificar_sin_salida\n")).toBeGreaterThan(-1);
    expect(desplegar.indexOf("\n  verificar_salida_ia\n")).toBeGreaterThan(desplegar.indexOf("\n  verificar_sin_salida\n"));
  });

  it("el control de la app no cambió: sin ruta y sin DNS externo, o el despliegue se cae", () => {
    const f = funcion("verificar_sin_salida");
    expect(f).toContain("LA APP TIENE SALIDA A INTERNET");
    expect(f).toContain("falla_sin_ruta");
  });

  it("ni IP ni puertos de la tailnet o del Mac en los scripts", () => {
    for (const texto of [desplegar, leer008("scripts/produccion-comun.sh")]) {
      expect(texto).not.toMatch(/\b100\.(6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])\.\d+\.\d+\b/);
      expect(texto).not.toMatch(/1143[45]/);
    }
  });
});

describe("Dockerfile · el bundle de IA", () => {
  it("se arma con esbuild después de next build, con la condición react-server (server-only) y @prisma/client externo", () => {
    expect(dockerfile).toMatch(/esbuild src\/servicio-ia\/entrada\.ts --bundle --platform=node --format=esm --target=node22 --conditions=react-server --external:@prisma\/client --outfile=\.next\/ia\/servicio-ia\.mjs/);
  });

  it("va en /app/ia, de root y de solo lectura (0444), y la imagen no se construye si no carga", () => {
    expect(dockerfile).toContain("COPY --from=builder --chmod=0444 /app/.next/ia/servicio-ia.mjs ./ia/servicio-ia.mjs");
    expect(dockerfile).toContain("RUN node ia/servicio-ia.mjs --ayuda >/dev/null");
    expect(dockerfile).toMatch(/stat -c '%u:%g %a' ia\/servicio-ia\.mjs\)" = "0:0 444"/);
  });
});

describe("documentación del despliegue", () => {
  const doc = leer008("docs/despliegue/produccion.md");
  const ejemplo = leer008("docs/despliegue/env-inversiones-production.example");

  it("el ejemplo del archivo de producción trae las variables nuevas, sin valores", () => {
    expect(ejemplo).toMatch(/^#? ?INV_IA_DATABASE_URL=/m);
    expect(ejemplo).toMatch(/^#? ?INV_IA_SERVICIO_TOKEN=/m);
    expect(ejemplo).toMatch(/^#? ?INV_IA_DIR_COMPARTIDA=/m);
  });

  it("produccion.md explica el servicio y que el destino de Ollama va en config_ia, nunca en el repo", () => {
    expect(doc).toContain("inv-008-ia");
    expect(doc).toContain("INV_IA_SERVICIO_TOKEN");
    expect(doc).toMatch(/destino de Ollama[^\n]*config_ia/);
    expect(doc).toContain("br-inv008-ia");
  });
});
