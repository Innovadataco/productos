import { PrismaClient } from "@prisma/client";
import { preguntar } from "@/lib/bi/motor";
import type { EntradaMotor, RespuestaMotor, Rol } from "@/lib/bi/tipos";

let prismaSingleton: PrismaClient | null = null;

export function prismaTest(): PrismaClient {
    if (!prismaSingleton) {
        prismaSingleton = new PrismaClient();
    }
    return prismaSingleton;
}

export async function preguntarTest(
    preguntaNL: string,
    rol: Rol = "ADMIN",
    usuarioId = "test-e2e",
): Promise<RespuestaMotor> {
    const input: EntradaMotor = { preguntaNL, usuario: { id: usuarioId, rol } };
    return preguntar(input, { prisma: prismaTest() });
}
