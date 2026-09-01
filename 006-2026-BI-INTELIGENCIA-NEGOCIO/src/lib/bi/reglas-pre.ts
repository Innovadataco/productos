// src/lib/bi/reglas-pre.ts · Reglas determinísticas PRE-LLM (candado 6)
// Producto 006 · BI v2 · Motor NL→SQL
// Filtro de intención destructiva o de escritura ANTES de llamar al modelo:
// BI es SOLO LECTURA y cualquier intención de modificar datos se bloquea
// aquí, sin gastar la llamada al LLM. Las guardas NUNCA reclasifican:
// bloquean con un mensaje determinista o dejan pasar la pregunta.
//
// CRITERIO (documentado): se bloquean formas verbales de MANDATO o INTENCIÓN
// (imperativo, presente de subjuntivo e infinitivo usado como orden:
// "elimina", "borra", "quiero eliminar"). NO se bloquean preguntas SOBRE el
// dato histórico en pasado o voz pasiva: "¿cuántos reportes se eliminaron
// como categoría?" es una consulta de lectura legítima sobre un estado del
// dato, y la réplica sigue protegida por las guardas post-LLM
// (validador-sql.ts) y por el constructor (candado 3).

export interface ResultadoIntencion {
    permitida: boolean;
    motivo?: string;
}

/** Mensaje determinista y amable ante intención de escritura (candado 6: las guardas no reclasifican). */
const MOTIVO_BLOQUEO =
    "Esta herramienta solo responde consultas de lectura sobre la operación (conteos, promedios, tendencias, listados). " +
    "La pregunta parece pedir una acción de escritura o eliminación de datos, que no está permitida. " +
    "Reformula la pregunta como una consulta, por ejemplo: «¿cuántos reportes hubo este mes?».";

/** Verbos de escritura/DDL en inglés (palabra completa, case-insensitive). */
const RE_ESCRITURA_EN = /\b(drop|delete|update|truncate|alter|insert|grant|revoke)\b/i;

/**
 * Verbos de escritura en español: imperativo, presente de subjuntivo e
 * infinitivo. Las formas de pasado/participio ("eliminaron", "borrados",
 * "actualizaciones") NO hacen match por los límites de palabra: son dato,
 * no mandato (criterio del encabezado).
 */
const RE_ESCRITURA_ES =
    /\b(borra|borre|borrar|elimina|elimine|eliminar|modifica|modifique|modificar|actualiza|actualice|actualizar|cambia|cambie|cambiar|trunca|trunque|truncar)\b/i;

/** "crea tabla" / "crear una tabla" / "cree la tabla": DDL solo se pide con objeto explícito. */
const RE_CREAR_TABLA = /\b(?:crea|crear|cree)\s+(?:una\s+|la\s+)?tabla\b/i;

/** Rango Unicode de marcas combinantes (tildes) para normalizar antes de matchear. */
const RE_MARCAS_COMBINANTES = /[̀-ͯ]/g;

/**
 * Revisa la pregunta del usuario antes de llamar al LLM. Cualquier match de
 * escritura/DDL → { permitida: false, motivo } con texto determinista.
 * Deny-by-default solo sobre intención de escritura; el resto pasa al motor.
 */
export function revisarIntencion(pregunta: string): ResultadoIntencion {
    // NFD sin marcas combinantes: "eliminá" ≡ "elimina". Los \b son ASCII,
    // así que normalizar no introduce falsos positivos en palabras con tilde.
    const texto = (pregunta ?? "").normalize("NFD").replace(RE_MARCAS_COMBINANTES, "");
    if (RE_ESCRITURA_EN.test(texto) || RE_ESCRITURA_ES.test(texto) || RE_CREAR_TABLA.test(texto)) {
        return { permitida: false, motivo: MOTIVO_BLOQUEO };
    }
    return { permitida: true };
}
