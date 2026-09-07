/**
 * SPEC-499 · datos del PROFESIONAL demo, en forma pura (sin BD).
 *
 * El sembrador crea el usuario/perfil/verificación/franjas con estos valores;
 * el candado (`profesional-demo.candado.test.ts`) los alimenta a
 * `puedeAparecerEnDirectorio` para probar que el profesional demo REALMENTE
 * aflora en el directorio del padre y es reservable. Por eso viven acá y no
 * incrustados en `sembrar-demo.ts`: la regla y su prueba comparten fuente.
 *
 * La regla dura (SPEC-449, verificado contra `src/app/api/padre/profesionales`):
 * un perfil `ACTIVO` **sin** una verificación `APROBADO` vigente NO aparece.
 * Por eso el demo trae ambas cosas.
 */
import type { EstadoPerfilProfesional, ResultadoVerificacion } from "@prisma/client";
import { calcularVenceEn } from "@/lib/profesionales/vigencia";

export const ESTADO_PERFIL_DEMO: EstadoPerfilProfesional = "ACTIVO";
export const RESULTADO_VERIFICACION_DEMO: ResultadoVerificacion = "APROBADO";

/** La verificación demo se firma en el pasado reciente para que su vencimiento
 *  (revisadoEn + 4 meses, Ley 2375) quede holgadamente vigente. */
export const REVISADO_HACE_DIAS = 7;

/** Franjas libres futuras que se publican para poder agendar la primera cita. */
export const NUM_FRANJAS_DEMO = 8;

export interface VerificacionDemo {
    resultado: ResultadoVerificacion;
    revisadoEn: Date;
    venceEn: Date;
}

/** La verificación aprobada y vigente que hace reservable al profesional demo.
 *  `venceEn` sale de la MISMA regla legal que usa producción (`calcularVenceEn`). */
export function verificacionDemo(revisadoEn: Date): VerificacionDemo {
    return {
        resultado: RESULTADO_VERIFICACION_DEMO,
        revisadoEn,
        venceEn: calcularVenceEn(revisadoEn),
    };
}
