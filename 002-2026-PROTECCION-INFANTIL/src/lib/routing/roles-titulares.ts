/**
 * SPEC-416 (I-118) · Fuente única de dos reglas de rol que el middleware +
 * el emisor de la cookie evalúan.
 *
 * Existen dos conjuntos DISTINTOS que hoy contienen los MISMOS roles por
 * accidente histórico — no por diseño. Se los nombra por su significado, no
 * por su composición. Cuando alguno cambie (nuevo rol titular, nuevo rol con
 * camino), se toca UNA sola constante y todos los sitios importadores se
 * enteran a la vez.
 *
 * NO fusionar las dos constantes aunque hoy sean iguales: son criterios
 * distintos y pueden divergir. La lección I-211 nos enseñó que "lo que se
 * mantiene en varios lados se desincroniza en silencio".
 */
import type { RolUsuario } from "@prisma/client";

/**
 * Roles que son **titulares del dato personal** y por eso deben consentir.
 *
 * Motivo legal (Ley 1581/2012 · Ley 1918/2018 · Ley 2375/2024): el consentimiento
 * lo firma quien APORTA el dato. `audit_consentimientos` existe para demostrar
 * que ese titular consintió — meterle firmas de empleados internos
 * (ADMIN/OPERADOR/COMITE/VERIFICADOR) o del prestador de servicio (PROFESIONAL)
 * degrada el valor probatorio del audit y contamina la evidencia frente a un
 * eventual reclamo.
 *
 * PARENT aporta datos de sus menores; SCHOOL_ADMIN aporta datos del colegio y
 * su comunidad educativa. El resto pasa exento del guard.
 *
 * Cuando aparezca un nuevo rol titular: se agrega ACÁ y se actualiza este
 * comentario. El middleware y el emisor de la cookie ya lo importan.
 */
export const ROLES_TITULARES_DEL_DATO = ["PARENT", "SCHOOL_ADMIN"] as const;

export function esTitularDelDato(rol: string | null | undefined): boolean {
    return rol === "PARENT" || rol === "SCHOOL_ADMIN";
}

/**
 * Roles que atraviesan el **camino guiado** paso-a-paso al onboarding.
 *
 * PARENT: SPEC-339 (A-67) — hijos, círculo, plan.
 * SCHOOL_ADMIN: SPEC-344 (A-69 · C1) — profesores, cursos, comité.
 *
 * HOY coincide con `ROLES_TITULARES_DEL_DATO` porque ambos roles son
 * los únicos con onboarding guiado en producción. NO son el mismo concepto:
 * un rol podría ser titular del dato SIN tener camino guiado (o al revés).
 * Cuando eso pase, se toca ESTA constante — no la de titulares.
 */
export const ROLES_CON_CAMINO_GUIADO = ["PARENT", "SCHOOL_ADMIN"] as const;

export function tieneCaminoGuiado(rol: string | null | undefined): rol is "PARENT" | "SCHOOL_ADMIN" {
    return rol === "PARENT" || rol === "SCHOOL_ADMIN";
}

// Tipo derivado — asegura que las constantes son subconjunto del enum canónico.
type _TitularEsRolUsuario = (typeof ROLES_TITULARES_DEL_DATO)[number] extends RolUsuario ? true : never;
type _CaminoEsRolUsuario = (typeof ROLES_CON_CAMINO_GUIADO)[number] extends RolUsuario ? true : never;
const _typeCheck1: _TitularEsRolUsuario = true;
const _typeCheck2: _CaminoEsRolUsuario = true;
void _typeCheck1;
void _typeCheck2;
