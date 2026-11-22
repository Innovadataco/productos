/**
 * Modelos aprobados de la puerta local: lista cerrada de nombre y digest. Antes de cada generación, `/api/tags` debe
 * mostrar el modelo con ESE digest (si alguien cambia los pesos con el mismo nombre, la puerta cierra).
 *
 * El único aprobado es `ornith:9b`, el modelo que PI ya tiene en el Mac (condición 3 de PI: nada de 32B). Su digest
 * NO está verificado en ningún documento y no se pide a la red desde aquí: queda en null, y con null la puerta local
 * responde MODELO_NO_DISPONIBLE «DIGEST_POR_VERIFICAR» sin tocar la red. Se pone (64 hex en minúsculas, sin el prefijo
 * «sha256:») cuando se mida en el Mac, en la evaluación (E7), con su prueba en `tests/unit/ia/local/modelos.test.ts`.
 *
 * No hay punto de inyección: ningún módulo recibe otra lista (lo cuida `tests/unit/ia/local/candados.test.ts`).
 */
export interface ModeloAprobado {
  readonly nombre: string;
  /** sha256 en hexadecimal (64, minúsculas), o null mientras no se haya medido en el Mac. */
  readonly digest: string | null;
}

export const PATRON_DIGEST = /^[0-9a-f]{64}$/;

export const MODELOS_APROBADOS: readonly ModeloAprobado[] = Object.freeze([
  Object.freeze({ nombre: "ornith:9b", digest: null }),
]);

/** La entrada aprobada con ese nombre exacto, o null. */
export function modeloAprobado(nombre: unknown): ModeloAprobado | null {
  return MODELOS_APROBADOS.find((modelo) => modelo.nombre === nombre) ?? null;
}
