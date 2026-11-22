/** Prompt y esquema INVENTADOS para las pruebas de los pedidos y las puertas (no son los del validador). */
export const PROMPT_FICTICIO = Object.freeze({ texto: "Redacte un resumen de usted, citando los hechos por su id.", version: "resumen-ficticio-v1" });
export const ESQUEMA_FICTICIO = Object.freeze({ type: "object", properties: { frases: { type: "array", maxItems: 6 } }, required: ["frases"] });
export const LIMITE_FICTICIO_MS = 4613;
