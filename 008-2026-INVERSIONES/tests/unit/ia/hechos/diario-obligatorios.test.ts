/**
 * Obligatorios del DIARIO (frente ia-diario-especie): solo los de `OBLIGATORIOS_DIARIO`, como mucho `MAX_OBLIGATORIOS`,
 * y el armador no arrastra nombres de especie como obligatorios (en el DIARIO ningún dato de especie es obligatorio).
 * Se prueba sobre los quince casos DIARIO inventados de la evaluación.
 */
import { describe, expect, it } from "vitest";
import { casosInventados } from "@/ia/evaluacion/casos";
import { OBLIGATORIOS_DIARIO } from "@/ia/hechos/diario";
import { MAX_OBLIGATORIOS } from "@/ia/hechos/grupos";

const diarios = casosInventados().filter((c) => c.tipo === "DIARIO");

describe("obligatorios del DIARIO", () => {
  it("la lista está congelada, cabe en el tope y lleva los cuatro esenciales", () => {
    expect(Object.isFrozen(OBLIGATORIOS_DIARIO)).toBe(true);
    expect(OBLIGATORIOS_DIARIO.length).toBeLessThanOrEqual(MAX_OBLIGATORIOS);
    expect(OBLIGATORIOS_DIARIO).toEqual(expect.arrayContaining(["VALOR_ACCIONES", "VARIACION_DIA_VALOR", "GANANCIA_TOTAL", "CONCILIACION_NO_CUADRA"]));
  });

  it.each(diarios.map((c) => [c.id, c] as const))("%s: solo obligatorios de la lista, sin nombres de especie", (_id, caso) => {
    const obligatorios = caso.paquete.hechos.filter((h) => h.obligatorio);
    expect(obligatorios.length).toBeLessThanOrEqual(MAX_OBLIGATORIOS);
    for (const h of obligatorios) expect(OBLIGATORIOS_DIARIO as readonly string[]).toContain(h.clave);
    expect(obligatorios.some((h) => h.clave === "ESPECIE_NOMBRE" || h.sujeto !== undefined)).toBe(false);
  });

  it("control positivo: los quince casos cubren cada obligatorio de la lista al menos una vez", () => {
    const vistos = new Set(diarios.flatMap((c) => c.paquete.hechos.filter((h) => h.obligatorio).map((h) => h.clave)));
    expect(diarios).toHaveLength(15);
    for (const clave of OBLIGATORIOS_DIARIO) expect(vistos.has(clave), clave).toBe(true);
  });
});
