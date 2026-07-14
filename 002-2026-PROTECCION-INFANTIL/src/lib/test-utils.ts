import { prisma } from "./prisma";

export async function resetDatabase() {
    // Respetar dependencias FK: hijos antes que padres.
    await prisma.datasetEntrenamiento.deleteMany();
    await prisma.correccionAdmin.deleteMany();
    await prisma.clasificacionIA.deleteMany();
    await prisma.embeddingReporte.deleteMany();
    await prisma.identificadorReportado.deleteMany();
    await prisma.reporte.deleteMany();
    await prisma.codigoVerificacion.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.parametroSistema.deleteMany();
    await prisma.usuario.deleteMany();
}
