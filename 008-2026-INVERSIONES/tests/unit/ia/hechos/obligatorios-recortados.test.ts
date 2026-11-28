/**
 * El aviso OBLIGATORIOS_RECORTADOS (T3): si el tope de obligatorios (`MAX_OBLIGATORIOS`, con los nombres que arrastran)
 * le quita la obligación a algún dato, el paquete lo avisa; si no, no. Sin esto el recorte era silencioso. Datos inventados.
 */
import { describe, expect, it } from "vitest";
import type { ClaveReglas } from "@/ia/catalogo";
import { borrador, cerrarPaquete, marcasDeHoy } from "@/ia/hechos/comun";
import { CODIGOS_AVISO_ARMADO } from "@/ia/hechos/constantes";
import { MAX_OBLIGATORIOS, numerarGrupos, type BorradorHecho, type Grupo } from "@/ia/hechos/grupos";
import { HOY } from "./apoyo.ficticio";

const FUENTE = "fuente-ficticia";

/** Una especie con una regla cuyo nivel es obligatorio: dos obligatorios con el nombre que arrastra. */
function especieObligatoria(nombre: string): Grupo<ClaveReglas> {
  const marcas = marcasDeHoy(HOY, "PLAN");
  const especie = borrador("ESPECIE_NOMBRE", nombre, FUENTE, marcasDeHoy(HOY, "REGISTRO"));
  const regla = borrador("REGLA_DEL_PLAN", "2027-02-03", FUENTE, marcas, { sujeto: especie });
  const nivel: BorradorHecho<"REGLA_NIVEL"> = borrador("REGLA_NIVEL", "4591.37", FUENTE, marcas, { sujeto: regla, obligatorio: true });
  return { prioridad: 1, hechos: [especie, regla, nivel] };
}

const especies = (n: number): readonly Grupo<ClaveReglas>[] => Array.from({ length: n }, (_, i) => especieObligatoria(`FICTICIA-${String.fromCharCode(65 + i)}`));
const parte = (grupos: readonly Grupo<ClaveReglas>[]) => [{ grupos, avisos: [] }];
const cabenEn = Math.floor(MAX_OBLIGATORIOS / 2);

describe("OBLIGATORIOS_RECORTADOS", () => {
  it("está en la lista cerrada de avisos de los armadores, después de HECHOS_RECORTADOS", () => {
    const lista = [...CODIGOS_AVISO_ARMADO];
    expect(lista).toContain("OBLIGATORIOS_RECORTADOS");
    expect(lista.indexOf("OBLIGATORIOS_RECORTADOS")).toBe(lista.indexOf("HECHOS_RECORTADOS") + 1);
  });

  it("numerarGrupos cuenta los datos a los que el tope les quitó la obligación", () => {
    const r = numerarGrupos("REGLAS", especies(cabenEn + 2));
    expect(r.obligatoriosRecortados).toBe(2);
    expect(r.hechos.filter((h) => h.obligatorio)).toHaveLength(MAX_OBLIGATORIOS);
  });

  it("dentro del tope no cuenta ninguno", () => {
    expect(numerarGrupos("REGLAS", especies(cabenEn)).obligatoriosRecortados).toBe(0);
    expect(numerarGrupos("REGLAS", []).obligatoriosRecortados).toBe(0);
  });

  it("cerrarPaquete pone el aviso cuando el tope recortó, y no lo pone cuando no", () => {
    expect(cerrarPaquete("REGLAS", HOY, parte(especies(cabenEn + 1))).avisos).toContain("OBLIGATORIOS_RECORTADOS");
    expect(cerrarPaquete("REGLAS", HOY, parte(especies(cabenEn))).avisos).not.toContain("OBLIGATORIOS_RECORTADOS");
  });

  it("el aviso va después de HECHOS_RECORTADOS y sin repetirse", () => {
    const grupos = [...especies(cabenEn + 1), ...Array.from({ length: 60 }, (_, i) => ({ prioridad: 2, hechos: [borrador("ESPECIE_NOMBRE", `FICTICIA-X${i}`, FUENTE, marcasDeHoy(HOY, "REGISTRO")), borrador("REGLA_DEL_PLAN", "2027-02-03", FUENTE, marcasDeHoy(HOY, "PLAN"))] }))];
    const avisos = cerrarPaquete("REGLAS", HOY, parte(grupos as never)).avisos;
    expect(avisos).toEqual(["HECHOS_RECORTADOS", "OBLIGATORIOS_RECORTADOS"]);
  });
});
