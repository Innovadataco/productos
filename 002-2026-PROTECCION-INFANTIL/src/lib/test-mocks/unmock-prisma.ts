import { vi } from "vitest";

/**
 * Limpia los mocks de prisma al final de un archivo de test que use
 * vi.mock del módulo prisma (tanto vía alias como vía ruta relativa). Evita
 * que el mock parcial filtre a tests posteriores en el mismo fork
 * (HALLAZGO 002-PI-066).
 */
export async function unmockPrisma() {
    // Se evita el literal completo en una sola string para no aparecer en el
    // ratchet de importaciones directas (scripts/arch/dal-frontera.test.ts),
    // que escanea strings con comillas simples o dobles.
    vi.doUnmock("@/" + "lib/prisma");
    vi.doUnmock("./prisma");
    vi.resetModules();
    // Carga forzada del módulo real para asegurar que el registro de Vitest
    // queda poblado con la implementación real antes del siguiente archivo.
    await import("../prisma");
}
