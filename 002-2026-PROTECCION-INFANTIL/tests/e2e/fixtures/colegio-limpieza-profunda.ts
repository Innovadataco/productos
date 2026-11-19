/**
 * SPEC-926 (Calidad) · Limpieza PROFUNDA de un colegio onboardeado por los journeys.
 *
 * `limpiarColegioOnboarded` (SPEC-775) borra lo que el FIXTURE crea, y se traga cada error
 * (`.catch(() => undefined)`): si queda una fila hija con FK Restrict, el `colegio.deleteMany`
 * falla EN SILENCIO y el colegio queda vivo en la BD de la corrida. Los journeys de 926 le
 * agregan al colegio cosas que el fixture no conoce — materias del catálogo y asignaciones
 * (`CursoMateria`), acudientes, identificadores de los CUATRO sujetos, la cuenta del comité y
 * sus integrantes, alertas y sus avisos/notificaciones — y cada una ata al colegio por FK.
 *
 * Esta función las borra en orden FK-safe (hijas → padres), luego delega en
 * `limpiarColegioOnboarded`, y DEVUELVE si el colegio quedó efectivamente borrado. El journey
 * lo AFIRMA en su `afterAll`: una limpieza que deja el colegio vivo envenena a los journeys que
 * corren después en la misma BD (cuentan alertas, cursos, identificadores) — no puede ser muda.
 *
 * Solo para `tests/e2e/**` (la guardia SPEC-770 garantiza BD `*_test`).
 */
import { prisma } from "@/lib/prisma";
import { limpiarColegioOnboarded, type ColegioOnboarded } from "./colegio-onboarded";

export async function limpiarColegioProfundo(
    colegio: ColegioOnboarded,
    reporteIds: readonly string[] = [],
): Promise<{ colegioBorrado: boolean }> {
    const colegios = colegio._limpieza.colegios;
    if (colegios.length === 0) return { colegioBorrado: true };
    const porColegio = { colegioId: { in: colegios } };

    // (1) Alertas y lo que cuelga de ellas (avisos, notificaciones in-app, casos).
    const alertas = await prisma.alertaColegio.findMany({ where: porColegio, select: { id: true } });
    const alertaIds = alertas.map((a) => a.id);
    await prisma.notificacionInApp.deleteMany({ where: porColegio });
    await prisma.registroAvisoColegio.deleteMany({ where: porColegio });
    if (alertaIds.length > 0) {
        await prisma.solicitudComite.deleteMany({ where: { alertaColegioId: { in: alertaIds } } });
        await prisma.notaSeguimiento.deleteMany({ where: porColegio });
        await prisma.seguimientoCaso.deleteMany({ where: porColegio });
    }
    await prisma.alertaColegio.deleteMany({ where: porColegio });
    await prisma.notificacion.deleteMany({ where: { sujetoTipo: "Colegio", sujetoId: { in: colegios } } });

    // (2) Reportes del journey (sus hijas caen por Cascade). Después de las alertas (FK).
    if (reporteIds.length > 0) {
        await prisma.reporte.deleteMany({ where: { id: { in: [...reporteIds] } } });
    }

    // (3) Identificadores de los CUATRO sujetos, y los acudientes.
    await prisma.identificadorAcudiente.deleteMany({ where: porColegio });
    await prisma.identificadorEstudiante.deleteMany({ where: porColegio });
    await prisma.identificadorProfesor.deleteMany({ where: porColegio });
    await prisma.identificadorIntegranteComite.deleteMany({ where: porColegio });
    await prisma.acudienteEstudiante.deleteMany({ where: { estudiante: { colegioId: { in: colegios } } } });
    await prisma.estudianteObservacion.deleteMany({ where: { estudiante: { colegioId: { in: colegios } } } });

    // (4) Cuenta del comité (Usuario COMITE_CONVIVENCIA): sus integrantes caen por Cascade.
    const comites = await prisma.usuario.findMany({ where: { comiteColegioId: { in: colegios } }, select: { id: true } });
    const comiteIds = comites.map((u) => u.id);
    if (comiteIds.length > 0) {
        await prisma.auditLog.deleteMany({ where: { usuarioId: { in: comiteIds } } });
        await prisma.usuario.deleteMany({ where: { id: { in: comiteIds } } });
    }

    // (5) Asignaciones curso↔materia y el catálogo de materias del colegio.
    await prisma.cursoMateria.deleteMany({ where: porColegio });
    await prisma.materia.deleteMany({ where: porColegio });
    await prisma.onboardingColegio.deleteMany({ where: porColegio });
    await prisma.preferenciaAlertaColegio.deleteMany({ where: porColegio });

    // (6) Lo del fixture (estudiantes → profesores → cursos → suscripción → rector → colegio …).
    await limpiarColegioOnboarded(colegio);

    const vivos = await prisma.colegio.count({ where: { id: { in: colegios } } });
    return { colegioBorrado: vivos === 0 };
}
