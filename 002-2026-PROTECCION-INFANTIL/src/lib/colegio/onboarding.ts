/**
 * SPEC-169 (Fase G): servicio de onboarding "Activa tu protección".
 * Calcula el progreso de los 5 pasos a partir de los datos reales del colegio.
 */
import { OnboardingColegioRepository } from "@/lib/dal/repositories/onboarding-colegio";
import { OnboardingRequisitosRepository } from "@/lib/dal/repositories/onboarding-requisitos";
import { CoberturaRepository } from "@/lib/dal/repositories/cobertura";

export type EstadoPaso = "pendiente" | "completado";

export interface PasoOnboarding {
    id: number;
    nombre: string;
    descripcion: string;
    estado: EstadoPaso;
    ctaHref: string;
    ctaTexto: string;
}

export interface OnboardingCalculado {
    estado: string;
    pasoActual: number;
    completadoEn: string | null;
    pasos: PasoOnboarding[];
}

const PASOS: Omit<PasoOnboarding, "estado">[] = [
    {
        id: 1,
        nombre: "Cursos",
        descripcion: "Crea al menos un curso para organizar a tus estudiantes.",
        ctaHref: "/dashboard/colegio/cursos/unificado",
        ctaTexto: "Crear curso",
    },
    {
        id: 2,
        nombre: "Estudiantes",
        descripcion: "Registra los estudiantes de tu colegio.",
        ctaHref: "/dashboard/colegio/cursos/unificado",
        ctaTexto: "Subir lista",
    },
    {
        id: 3,
        nombre: "Profesores",
        descripcion: "Registra al menos un profesor del directorio.",
        ctaHref: "/dashboard/colegio/profesores",
        ctaTexto: "Agregar profesor",
    },
    {
        id: 4,
        nombre: "Acudientes",
        descripcion: "Asocia acudientes a los estudiantes.",
        ctaHref: "/dashboard/colegio/cursos",
        ctaTexto: "Ver cursos",
    },
    {
        id: 5,
        nombre: "Identificadores",
        descripcion: "Registra al menos un identificador activo para activar la protección.",
        ctaHref: "/dashboard/colegio/cursos",
        ctaTexto: "Completar identificadores",
    },
];

function primerPendiente(pasos: PasoOnboarding[]): number {
    const pendiente = pasos.find((p) => p.estado === "pendiente");
    return pendiente ? pendiente.id : PASOS.length + 1;
}

/**
 * Calcula el onboarding del colegio. Si todos los pasos están completados,
 * actualiza la fila a estado `completado` (idempotente).
 */
export async function calcularOnboarding(colegioId: string): Promise<OnboardingCalculado> {
    const repo = new OnboardingColegioRepository();
    const onboarding = await repo.obtenerPorColegio(colegioId);
    if (!onboarding) {
        throw new Error("Onboarding no configurado");
    }

    const [requisitos, cobertura] = await Promise.all([
        new OnboardingRequisitosRepository().contar(colegioId),
        new CoberturaRepository().calcular(colegioId),
    ]);

    const condiciones = {
        1: requisitos.cursos > 0,
        2: requisitos.estudiantes > 0,
        3: requisitos.profesores > 0,
        4: requisitos.acudientes > 0,
        5: cobertura.tieneCoberturaGlobal,
    };

    const pasos: PasoOnboarding[] = PASOS.map((paso) => ({
        ...paso,
        estado: condiciones[paso.id as keyof typeof condiciones] ? "completado" : "pendiente",
    }));

    const todosCompletados = pasos.every((p) => p.estado === "completado");
    const pasoActual = primerPendiente(pasos);

    if (todosCompletados && onboarding.estado === "activo") {
        await repo.actualizarEstado(colegioId, "completado", {
            pasoActual,
            completadoEn: onboarding.completadoEn ?? new Date(),
        });
    }

    const actualizado = await repo.obtenerPorColegio(colegioId);

    return {
        estado: actualizado?.estado ?? onboarding.estado,
        pasoActual,
        completadoEn: actualizado?.completadoEn?.toISOString() ?? null,
        pasos,
    };
}
