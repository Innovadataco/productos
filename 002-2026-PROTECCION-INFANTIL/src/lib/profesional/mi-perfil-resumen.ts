/**
 * SPEC-741 (Diseño · doc 333da98 · mockup 51e2b94) · Resumen de estado del encabezado de
 * cada sección plegable de «Mi perfil» del habilitado — para verlo sin desplegar.
 *
 * Vive fuera del componente para mantener su complejidad y su tamaño acotados, y para
 * poder probar el criterio sin montar la pantalla. El `tono` colorea el subtítulo:
 * `atencion` = ÁMBAR (la sección necesita atención), `ok` = resuelto, `neutral` = dato.
 */
import type { PerfilProfesionalPropioDto } from "@/lib/profesional/dto";
import type { VistaProfesionalVerificacion } from "@/lib/profesionales/verificador/vista-profesional";
import { conPuntosDeMiles } from "@/lib/profesional/formato-tarifa";

/** Idéntico al `TonoSeccion` de `SeccionColapsable` (unión de strings; no se acoplan). */
export type TonoResumen = "ok" | "atencion" | "neutral";
export interface ResumenSeccion {
    estado: string;
    tono: TonoResumen;
}
export type ClaveSeccionMiPerfil = "datos" | "tarifa" | "documentos" | "autorizacion";

/**
 * «Sus datos» está COMPLETO cuando los campos que la propia pantalla exige para guardar
 * (guardas de edición por bloque de SPEC-709) están puestos. Si Diseño fija otro criterio,
 * se cambia acá.
 */
export function datosEstanCompletos(p: PerfilProfesionalPropioDto): boolean {
    return (
        !!p.nombreVisible?.trim() &&
        !!p.profesion &&
        p.areasAtencion.length > 0 &&
        p.rangoEtario.length > 0 &&
        !!p.ciudad &&
        (p.atiendeVirtual || p.atiendePresencial) &&
        (p.presentacion?.trim().length ?? 0) >= 20
    );
}

export function resumenSeccionesMiPerfil(args: {
    perfil: PerfilProfesionalPropioDto;
    vista: VistaProfesionalVerificacion;
    autorizacion?: { hayActualizacionMenor: boolean } | null | undefined;
}): Record<ClaveSeccionMiPerfil, ResumenSeccion> {
    const { perfil, vista, autorizacion } = args;
    const tarifa = perfil.tarifaConsultaCOP ?? 0;
    const tarifaSinFijar = tarifa <= 0;
    // `docsPorCorregir` = ítems de verificación DEVUELTOS (misma fuente que el bloque de estado).
    const docsPorCorregir = vista.observaciones.length;
    return {
        datos: datosEstanCompletos(perfil)
            ? { estado: "Completos", tono: "ok" }
            : { estado: "Faltan datos", tono: "atencion" },
        tarifa: tarifaSinFijar
            ? { estado: "Sin fijar", tono: "atencion" }
            : { estado: `${conPuntosDeMiles(tarifa)} COP por consulta`, tono: "neutral" },
        documentos: docsPorCorregir > 0
            ? { estado: `${docsPorCorregir} por corregir`, tono: "atencion" }
            : { estado: "Al día", tono: "ok" },
        autorizacion: autorizacion?.hayActualizacionMenor
            ? { estado: "Nueva versión sin leer", tono: "atencion" }
            : { estado: "Aceptada", tono: "ok" },
    };
}
