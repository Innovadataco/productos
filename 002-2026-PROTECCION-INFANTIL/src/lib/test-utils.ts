import { prisma } from "./prisma";

export async function resetDatabase() {
    // Respetar dependencias FK: hijos antes que padres.
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
    await prisma.reporte.deleteMany();
    await prisma.codigoVerificacion.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.parametroSistema.deleteMany();
    await prisma.perfilOperador.deleteMany();
    await prisma.usuario.deleteMany();
}
