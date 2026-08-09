import { prisma } from "./prisma";
import { CATALOGO_MODULOS } from "./permisos-catalogo";
import { RolUsuario } from "@prisma/client";

/**
 * Tras el reset, otorga a TODOS los roles del enum acceso a todo el catálogo:
 * reproduce el comportamiento implícito que los tests existentes asumen (los
 * guards de módulo son una capa adicional, no un reemplazo). Los tests de
 * permisos crean sus propios módulos/permisos y no se ven afectados.
 */
export async function otorgarTodosLosPermisos() {
    const moduloIds = new Map<string, string>();
    for (const m of CATALOGO_MODULOS.filter((x) => !x.padre)) {
        const row = await prisma.moduloPermisible.create({
            data: { clave: m.clave, nombre: m.nombre, categoria: m.categoria, esCritico: m.esCritico ?? false, orden: m.orden },
        });
        moduloIds.set(m.clave, row.id);
    }
    for (const m of CATALOGO_MODULOS.filter((x) => x.padre)) {
        const row = await prisma.moduloPermisible.create({
            data: {
                clave: m.clave,
                nombre: m.nombre,
                categoria: m.categoria,
                esCritico: m.esCritico ?? false,
                orden: m.orden,
                padreId: moduloIds.get(m.padre!)!,
            },
        });
        moduloIds.set(m.clave, row.id);
    }
    for (const rol of Object.values(RolUsuario)) {
        for (const moduloId of moduloIds.values()) {
            await prisma.permisoModulo.create({ data: { rol, moduloId, activo: true } });
        }
    }
}

export async function resetDatabase() {
    // Respetar dependencias FK: hijos antes que padres.
    await prisma.accesoDocumentoApelacion.deleteMany();
    await prisma.documentoApelacion.deleteMany();
    await prisma.apelacion.deleteMany();
    // SPEC-133: suscripciones de alerta y tokens de recuperación (FK a usuario/identificador).
    await prisma.alertaSuscripcion.deleteMany();
    await prisma.tokenRecuperacion.deleteMany();
    await prisma.simulacionReporte.deleteMany();
    await prisma.simulacionRun.deleteMany();
    await prisma.rateLimit.deleteMany();
    await prisma.casoEval.deleteMany();
    await prisma.evalRun.deleteMany();
    await prisma.reintentoReporte.deleteMany();
    await prisma.transicionReporte.deleteMany();
    await prisma.datasetEntrenamiento.deleteMany();
    await prisma.correccionAdmin.deleteMany();
    await prisma.clasificacionIA.deleteMany();
    await prisma.embeddingReporte.deleteMany();
    await prisma.eventoMatch.deleteMany();
    await prisma.identificadorReportado.deleteMany();
    // SPEC-159: bitácora del caso (notas antes que el seguimiento, FK RESTRICT;
    // el seguimiento antes que la alerta).
    await prisma.notaSeguimiento.deleteMany();
    await prisma.seguimientoCaso.deleteMany();
    await prisma.alertaColegio.deleteMany();
    await prisma.patronInstitucional.deleteMany();
    // SPEC-149: avisos del colegio (hijos de Colegio, FK RESTRICT).
    await prisma.registroAvisoColegio.deleteMany();
    await prisma.preferenciaAlertaColegio.deleteMany();
    await prisma.reporte.deleteMany();
    await prisma.codigoVerificacion.deleteMany();
    await prisma.integranteComite.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.identificadorEstudiante.deleteMany();
    // SPEC-144 (D1): hijos antes que el estudiante (FK RESTRICT).
    await prisma.acudienteEstudiante.deleteMany();
    await prisma.estudiante.deleteMany();
    // SPEC-145: profesores antes que el colegio (FK RESTRICT); el titular del curso es SET NULL.
    await prisma.profesor.deleteMany();
    await prisma.curso.deleteMany();
    await prisma.parametroSistema.deleteMany();
    await prisma.perfilOperador.deleteMany();
    await prisma.usuario.deleteMany();
    await prisma.colegio.deleteMany();
    await prisma.tenant.deleteMany();
    await prisma.permisoModulo.deleteMany();
    await prisma.moduloPermisible.deleteMany();
    // SPEC-132: sesiones de carga masiva (roster server-side).
    await prisma.cargaRosterSesion.deleteMany();

    await otorgarTodosLosPermisos();
}
