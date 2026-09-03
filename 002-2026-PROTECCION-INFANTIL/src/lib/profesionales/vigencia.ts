/**
 * SPEC-389 (Red de Profesionales · L2) — vigencia y venta de sellos.
 *
 * Helpers puros (sin BD, sin red) que codifican tres reglas del brief:
 *
 * 1. **Ley 2375/2024**: la verificación de antecedentes se repite cada
 *    CUATRO meses, no anual. `calcularVenceEn` sella el intervalo en un
 *    solo lugar; si mañana la ley cambia a otra frecuencia, se toca acá y
 *    el test de la regla queda rojo hasta reconciliar.
 *
 * 2. **Reserva legal del resultado**: la API pública devuelve un sello
 *    (`APROBADO` vigente, `VENCIDO`, o `AUSENTE`) más la fecha de la última
 *    verificación aprobada y su vencimiento — nunca el resultado real, el
 *    checklist, la autorización firmada ni las notas internas. `sellos` es el
 *    único borde a través del cual una capa pública puede leer sobre el
 *    profesional; cualquier ruta que devuelva `PerfilProfesional` o
 *    `VerificacionProfesional` completos al público es un defecto por
 *    construcción y el candado del test lo dice.
 *
 * 3. **Directorio abierto**: L3 lista profesionales solo si
 *    `estado = ACTIVO` Y la última verificación aprobada NO venció. El helper
 *    `puedeAparecerEnDirectorio` es el filtro; que L3 lo respete queda del
 *    lado de L3, pero el candado del sello vive acá porque acá vive la regla.
 */

// Tipos mínimos del subset del modelo que este archivo necesita. Se
// desacoplan del cliente Prisma a propósito: los helpers son puros y sirven
// como contrato para L2 (admin), L3 (público) y el worker cron. Cuando el
// modelo se estabilice se puede refinar el import — no cambia el borde.

export type SelloProfesional = "APROBADO" | "VENCIDO" | "AUSENTE";

export interface PerfilPublicoInput {
    // No exigimos el `PerfilProfesional` entero: solo el estado (para poder
    // decir "el perfil no aparece" cuando está BORRADOR/RECHAZADO/etc.).
    estado: "BORRADOR" | "EN_REVISION" | "ACTIVO" | "RECHAZADO" | "VENCIDO" | "SUSPENDIDO";
}

export interface VerificacionResumenInput {
    resultado: "APROBADO" | "RECHAZADO" | "MAS_INFORMACION";
    revisadoEn: Date;
    venceEn: Date;
}

export interface SelloPublico {
    sello: SelloProfesional;
    fechaVerificacion?: string; // ISO — sin hora exacta; el brief dice fecha, no minuto
    venceEn?: string; // ISO
}

const MESES_LEY_2375 = 4;

/**
 * Regla dura Ley 2375/2024 · cambio de la 1918/2018 tras la sentencia
 * C-407/2020 que tumbó parte del texto original. La frecuencia es
 * **cuatro meses**, exacta.
 *
 * Trabaja en UTC (getUTC/setUTC) para que el resultado sea determinístico
 * y no dependa del `TZ` del proceso — el mismo Date debe producir el mismo
 * `venceEn` en el runner local, en CI y en el VPS. Si el día original no
 * existe en el mes destino (ej. 31-oct + 4m ⇒ febrero, sin 31), JS ajusta
 * al día equivalente por overflow (2-mar en años normales, 1/2-mar en
 * bisiestos). Ese ajuste es el comportamiento correcto para vencimientos
 * calendáricos: la ley cuenta meses, no días exactos.
 */
export function calcularVenceEn(revisadoEn: Date): Date {
    const fecha = new Date(revisadoEn.getTime());
    fecha.setUTCMonth(fecha.getUTCMonth() + MESES_LEY_2375);
    return fecha;
}

/**
 * Última verificación relevante para el sello público: la MÁS RECIENTE con
 * resultado APROBADO. Rechazos y solicitudes de "más información" no se
 * exponen al padre — solo el operador y el propio profesional los ven.
 */
export function ultimaAprobacion(
    verificaciones: readonly VerificacionResumenInput[],
): VerificacionResumenInput | null {
    const aprobadas = verificaciones.filter((v) => v.resultado === "APROBADO");
    if (aprobadas.length === 0) return null;
    return aprobadas.reduce((mas, v) => (v.revisadoEn > mas.revisadoEn ? v : mas));
}

/**
 * Sello público del profesional. Este es el ÚNICO helper que puede devolver
 * cualquier información del historial de verificaciones al padre. Retorna
 * exclusivamente `sello`, `fechaVerificacion` y `venceEn` — la lista de
 * claves está fijada en un candado (`vigencia.reserva-legal.test.ts`) que
 * falla si alguien agrega `resultado`, `checklist`, `notaInterna` u otra
 * ventana a los antecedentes reservados.
 *
 * `AUSENTE` = el perfil no está publicable (BORRADOR / EN_REVISION /
 * RECHAZADO / SUSPENDIDO), o nunca tuvo una verificación aprobada.
 * `VENCIDO` = tenía sello aprobado pero se pasó de 4 meses.
 */
export function sellos(
    perfil: PerfilPublicoInput,
    verificaciones: readonly VerificacionResumenInput[],
    ahora: Date,
): SelloPublico {
    if (perfil.estado !== "ACTIVO" && perfil.estado !== "VENCIDO") {
        return { sello: "AUSENTE" };
    }
    const ultima = ultimaAprobacion(verificaciones);
    if (!ultima) return { sello: "AUSENTE" };

    const vigente = ultima.venceEn.getTime() > ahora.getTime();
    return {
        sello: vigente ? "APROBADO" : "VENCIDO",
        fechaVerificacion: ultima.revisadoEn.toISOString(),
        venceEn: ultima.venceEn.toISOString(),
    };
}

/**
 * Filtro del directorio abierto (L3). El profesional aparece solo si su
 * perfil está `ACTIVO` (no borrador, no rechazado, no suspendido) Y su
 * sello está vigente (APROBADO). Un perfil `VENCIDO` no aparece: el brief
 * dice "al vencer, el perfil deja de mostrarse hasta nueva revisión".
 *
 * El estado `VENCIDO` en el perfil lo pone el worker cuando pasa la fecha;
 * este helper permite además que L3 se defienda por sí mismo antes de que
 * el worker corra (defensa en profundidad — vive hasta un ciclo del cron sin
 * mostrar un vencido).
 */
export function puedeAparecerEnDirectorio(
    perfil: PerfilPublicoInput,
    verificaciones: readonly VerificacionResumenInput[],
    ahora: Date,
): boolean {
    if (perfil.estado !== "ACTIVO") return false;
    const ultima = ultimaAprobacion(verificaciones);
    return ultima !== null && ultima.venceEn.getTime() > ahora.getTime();
}
