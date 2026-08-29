const PATRONES_DESTRUCTIVOS_EN = /\b(drop|delete|update|truncate|alter|grant|revoke|insert|create|rename)\b/i;
const PATRONES_DESTRUCTIVOS_ES = /\b(borra|borrar|elimina|eliminar|vacia|vacía|vaciar|destruye|destruir|resetea|resetear|modifica|modificar|inserta|insertar|actualiza|actualizar)\b/i;

export interface ResultadoPreGuard {
    permitido: boolean;
    razon?: string;
    patronDetectado?: string;
}

export function evaluarPreGuard(preguntaNL: string): ResultadoPreGuard {
    if (typeof preguntaNL !== "string" || preguntaNL.trim().length === 0) {
        return { permitido: false, razon: "pregunta_vacia" };
    }
    const matchEn = preguntaNL.match(PATRONES_DESTRUCTIVOS_EN);
    if (matchEn) {
        return {
            permitido: false,
            razon: "intencion_destructiva",
            patronDetectado: matchEn[0].toLowerCase(),
        };
    }
    const matchEs = preguntaNL.match(PATRONES_DESTRUCTIVOS_ES);
    if (matchEs) {
        return {
            permitido: false,
            razon: "intencion_destructiva",
            patronDetectado: matchEs[0].toLowerCase(),
        };
    }
    return { permitido: true };
}
