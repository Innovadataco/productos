// Candado del runbook de los rendimientos del fondo (frente fondo-rendimientos): docs/despliegue/produccion.md §11
// trae el paso de `registrar-rendimientos-fondo` por el sobre (cabecera, CSV, ensayo y después --aplicar, que la
// retención no mueve la caja y que lo registrado no se corrige), la conciliación v3 al desplegar y la nota de la reversa
// (database-reviewer MEDIO): una imagen anterior no conoce los valores de enum nuevos, así que después de cargar
// rendimientos la reversa `--sin-migrar` a esa imagen no es segura. Fija el texto del runbook, no la conducta.
import { describe, expect, it } from "vitest";
import { leer008 } from "./falsos";

const runbook = leer008("docs/despliegue/produccion.md");
const seccion11 = runbook.slice(runbook.indexOf("## 11 ·"), runbook.indexOf("## 12 ·"));

describe("runbook · rendimientos del fondo (§11)", () => {
  it("control positivo: la sección 11 se lee", () => {
    expect(seccion11).toMatch(/^## 11 · Carga de los datos del dueño/);
  });

  it("la tabla del orden trae el paso con su comando, su cabecera y su archivo", () => {
    expect(seccion11).toMatch(/^\| 12 ter \| .*\| `registrar-rendimientos-fondo` \| `--email` y el correo, `--fondo` y su código de la SFC; `--aplicar` solo la segunda vez \| el CSV de rendimientos del dueño \|$/m);
  });

  it("el paso dice el formato, el ensayo, que la retención no mueve la caja y que no se corrige", () => {
    for (const texto of ["fecha,tipo,valor", "registrar-rendimientos-fondo", "no mueve la caja", "Primero sin `--aplicar` (ensayo)", "`VALOR_DISTINTO`", "`FILA_REPETIDA`", "`FONDO_SIN_CONSTITUCION`", "`rendimientos_fic_sin_registrar`"]) {
      expect(seccion11, texto).toContain(texto);
    }
  });

  it("al desplegar: conciliacion-v3 y la reversa con rendimientos cargados", () => {
    expect(seccion11).toContain("`conciliacion-v3`");
    expect(seccion11).toMatch(/--sin-migrar[^\n]*RENDIMIENTO_FIC|RENDIMIENTO_FIC[^\n]*--sin-migrar/);
  });
});
