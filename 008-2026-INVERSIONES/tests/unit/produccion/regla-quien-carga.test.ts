// Candado de quién corre la carga de los datos del dueño en producción (decisión del CEO, 2026-11-21): la cabecera
// de armar-sobre.sh y de cargar-prod.sh dice «lo corre Jelk o quien él designe, con su autorización directa», y esa
// autorización la da Jelk en persona, no otra sesión. La regla vieja («nunca la Fábrica sola» / «nunca la Fábrica,
// que no lee los archivos privados») no vuelve. Fija el comentario, no la conducta: los scripts no saben quién los
// corre. AGENTS.md y el runbook (produccion.md §11) los alinea el frente de documentación.
import { describe, expect, it } from "vitest";
import { leer008 } from "./falsos";

const SCRIPTS = ["scripts/armar-sobre.sh", "scripts/cargar-prod.sh"] as const;

/** La cabecera del script: los comentarios del principio, hasta la primera línea que no lo es, en una sola línea. */
function cabecera(relativa: string): string {
  const lineas = leer008(relativa).split("\n");
  const fin = lineas.findIndex((l) => !l.startsWith("#"));
  return lineas
    .slice(0, fin === -1 ? lineas.length : fin)
    .map((l) => l.replace(/^#!?\s?/, ""))
    .join(" ")
    .replace(/\s+/g, " ");
}

describe("regla de quién corre la carga en producción", () => {
  for (const script of SCRIPTS) {
    it(`${script}: lo corre Jelk o quien él designe, con su autorización directa (la da Jelk en persona)`, () => {
      const t = cabecera(script);
      expect(t).toMatch(/[Ll]o corre Jelk o quien él designe, con su autorización directa/);
      expect(t).toContain("la da Jelk en persona, no otra sesión");
    });

    it(`${script}: no vuelve la regla vieja`, () => {
      const t = cabecera(script);
      expect(t).not.toContain("nunca la Fábrica sola");
      expect(t).not.toContain("nunca la Fábrica, que no lee");
      expect(t).not.toContain("con la Fábrica guiando");
    });
  }

  it("control positivo: la cabecera se lee (trae el uso con armar-sobre.sh … | ssh … cargar-prod.sh)", () => {
    for (const script of SCRIPTS) expect(cabecera(script), script).toMatch(/armar-sobre\.sh .*\| ssh <vps> .*cargar-prod\.sh <comando>/);
  });
});
