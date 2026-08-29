/**
 * SPEC-114 — mock compartido de next/headers para los journeys (patrón de
 * circulo-confianza/route.test.ts): cookies() con get/set/delete sobre un jar en memoria.
 * Uso: importar "./mock-headers" al inicio del archivo del journey.
 */
import { vi } from "vitest";

interface JarEntry {
    name: string;
    value: string;
    options?: Record<string, unknown> | undefined;
}

export const jar: Map<string, JarEntry> = new Map();

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) => jar.get(name),
        set: (name: string, value: string, options?: Record<string, unknown>) => {
            jar.set(name, { name, value, options });
        },
        delete: (name: string) => {
            jar.delete(name);
        },
    }),
}));

export function limpiarJar() {
    jar.clear();
}
