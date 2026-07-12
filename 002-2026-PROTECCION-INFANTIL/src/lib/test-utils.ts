import { prisma } from "./prisma";

export async function resetDatabase() {
    await prisma.auditLog.deleteMany();
    await prisma.parametroSistema.deleteMany();
    await prisma.usuario.deleteMany();
}