/**
 * SPEC-748a · Clasificación PURA de firmas de AuditConsentimiento en legítimas
 * (de un titular del dato) vs sospechosas (de un rol interno / prestador).
 *
 * DERIVA de la fuente única `esTitularDelDato` (roles-titulares.ts). NUNCA una
 * lista de roles a mano: esa lista es la que driftó. La versión vieja del
 * auditor (`depurar-consentimientos-internos.ts`) llevaba
 *   ["ADMIN","OPERADOR","COMITE_VALIDACION","COMITE_CONVIVENCIA","SCHOOL_ADMIN"]
 * y driftó en LAS DOS direcciones: INCLUÍA a SCHOOL_ADMIN —titular del dato
 * desde SPEC-416 (I-118), firma CONVENIO_INSTITUCIONAL legítima— y OMITÍA a
 * PROFESIONAL y VERIFICADOR, roles internos que la propia roles-titulares.ts
 * nombra. Con la lista vieja, 50 firmas legítimas de colegios se reportaban
 * como «internas» (medido en prod 2026-09-29: 69 PARENT · 50 SCHOOL_ADMIN · 0
 * de cualquier otro rol) — 50 falsos positivos vivos dentro de una herramienta
 * de EVIDENCIA. Al derivar, la partición es TOTAL: cada firma cae en titular o
 * en no-titular, ninguna se pierde del recuento.
 */
import { esTitularDelDato } from "../../src/lib/routing/roles-titulares";

export interface ConteoPorRol {
    rol: string;
    firmas: number;
}

export interface ResultadoDepuracion {
    /** Firmas de titulares del dato (PARENT, SCHOOL_ADMIN) — legítimas. */
    deTitulares: number;
    /** Firmas de roles NO titulares (empleados internos / prestador) — sospechosas. */
    deRolesInternos: number;
    /** Desglose por rol de las sospechosas. */
    detallesPorRol: ConteoPorRol[];
    marcadasComoInvalidas: number;
}

/**
 * Una firma es SOSPECHOSA si la firmó un rol que NO es titular del dato. Único
 * discriminador; deriva de `esTitularDelDato`, jamás de una lista a mano.
 */
export function esFirmaSospechosa(rol: string | null | undefined): boolean {
    return !esTitularDelDato(rol);
}

/**
 * Parte las firmas en titulares (legítimas) vs roles internos (sospechosas).
 * Partición TOTAL: `deTitulares + deRolesInternos === firmas.length`.
 * `detallesPorRol` desglosa solo las sospechosas, ordenadas por rol.
 */
export function clasificarFirmas(
    firmas: ReadonlyArray<{ usuario: { rol: string } }>,
): ResultadoDepuracion {
    let deTitulares = 0;
    let deRolesInternos = 0;
    const conteoMap = new Map<string, number>();
    for (const f of firmas) {
        if (esFirmaSospechosa(f.usuario.rol)) {
            deRolesInternos += 1;
            conteoMap.set(f.usuario.rol, (conteoMap.get(f.usuario.rol) ?? 0) + 1);
        } else {
            deTitulares += 1;
        }
    }
    const detallesPorRol: ConteoPorRol[] = Array.from(conteoMap.entries())
        .map(([rol, firmas]) => ({ rol, firmas }))
        .sort((a, b) => a.rol.localeCompare(b.rol));
    // AuditConsentimiento no tiene campo de metadata mutable: no se marca nada.
    return { deTitulares, deRolesInternos, detallesPorRol, marcadasComoInvalidas: 0 };
}
