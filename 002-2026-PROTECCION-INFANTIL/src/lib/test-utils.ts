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
    await prisma.apelacionIdentificador.deleteMany();
    await prisma.identificadorReportado.deleteMany();
    await prisma.alertaColegio.deleteMany();
    await prisma.reporte.deleteMany();
    await prisma.codigoVerificacion.deleteMany();
    await prisma.integranteComite.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.identificadorAlumno.deleteMany();
    await prisma.alumno.deleteMany();
    await prisma.curso.deleteMany();
    await prisma.parametroSistema.deleteMany();
    await prisma.perfilOperador.deleteMany();
    await prisma.usuario.deleteMany();
    await prisma.colegio.deleteMany();
    await prisma.tenant.deleteMany();
    await prisma.permisoModulo.deleteMany();
    await prisma.moduloPermisible.deleteMany();

    await otorgarTodosLosPermisos();
}
