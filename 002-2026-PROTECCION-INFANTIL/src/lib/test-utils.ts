import { prisma } from "./prisma";

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
}
