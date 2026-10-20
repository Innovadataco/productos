/**
 * CANDADO · SPEC-874 (I-415 · FORMA §3) · el DISCRIMINANTE «reintentar ↔ no reintentar» es el ENDPOINT.
 *
 * `GET /api/plataformas` NO tiene rama de precondición (ni auth propia ni un «complete un paso primero»
 * que devolver): lista el catálogo activo y responde 200, o falla por infraestructura (500/red). Por eso su
 * única falla es TRANSITORIA y «Reintentar» en la pantalla ES correcto; y un catálogo vacío es un 200 (no un
 * error) → la UI lo trata como estado NEUTRO, sin reintento. Este candado fija ese contrato del endpoint:
 *   · catálogo vacío → 200 con lista vacía (NUNCA 4xx).
 *   · con catálogo → 200 con las activas.
 * Si alguien le agregara una precondición 4xx, estos 200 dejarían de cumplirse y habría que re-evaluar si
 * «reintentar» sigue siendo la acción correcta (FORMA §3: el candado se ata al endpoint, no a la pantalla).
 *
 * Integración (BD de test). NO toca prod.
 */
import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { GET } from "./route";

async function llamar() {
    const res = await GET();
    const body = (await res.json()) as { plataformas: Array<{ id: string; clave: string; nombre: string; categoria: string }> };
    return { status: res.status, claves: body.plataformas.map((p) => p.clave) };
}

describe("SPEC-874 (I-415) · GET /api/plataformas sin precondición: 200 siempre", { timeout: 30_000 }, () => {
    beforeEach(async () => resetDatabase());
    // SPEC-881 (I-447) · HIGIENE. Este candado MUTA la tabla Plataforma, que `resetDatabase` PRESERVA
    // (está en EXCLUDED_TABLES) y `asegurarPlataformas` re-siembra con `upsert({ update: {} })` —o sea, NO
    // sana el `esActiva` que apaga el test 1 (`updateMany`) NI borra las filas `-874` que crea el test 2—.
    // Sin restaurar, esos cambios SOBREVIVEN al reset (y a toda la corrida: la BD de test es por-worktree y
    // persistente) y poluyen a quien lea el catálogo en el MISMO proceso sin shards —p. ej.
    // `dal/repositories/plataforma.test.ts`, cuyo `findActivas` espera WhatsApp/Instagram ACTIVAS—; CI
    // shardea y lo esconde (verde falso). Restauramos el catálogo al baseline (8 activas, sin `-874`) tras
    // cada test: borrar las `-874` y reactivar todo.
    afterEach(async () => {
        await prisma.plataforma.deleteMany({ where: { clave: { endsWith: "-874" } } });
        await prisma.plataforma.updateMany({ data: { esActiva: true } });
    });
    // CANDADO que muere con el defecto (NO circular: observa el resultado del `afterEach`, no limpia acá). Si
    // se quita la restauración de arriba, estas cuentas quedan > 0 al terminar el archivo y el candado rojo.
    afterAll(async () => {
        try {
            const residuo874 = await prisma.plataforma.count({ where: { clave: { endsWith: "-874" } } });
            const inactivas = await prisma.plataforma.count({ where: { esActiva: false } });
            expect(residuo874, "no deja filas -874 que poluyan otros tests en el mismo proceso").toBe(0);
            expect(inactivas, "no deja plataformas del catálogo inactivas (rompería findActivas)").toBe(0);
        } finally {
            await prisma.$disconnect();
        }
    });

    it("catálogo SIN ACTIVAS → 200 con lista vacía (es un 200, no un error): la UI lo trata como estado neutro, sin reintento", async () => {
        // `resetDatabase()` PRESERVA la tabla Plataforma (catálogo estático) y `asegurarPlataformas()` la
        // re-siembra con 8 activas tras cada reset — así que «vacío» para este endpoint = sin plataformas
        // ACTIVAS (filtra `esActiva:true`). Lo forzamos poniendo todas inactivas; sin esto el 200 trae las 8.
        await prisma.plataforma.updateMany({ data: { esActiva: false } });
        const { status, claves } = await llamar();
        expect(status, "nunca 4xx: no hay precondición que resolver").toBe(200);
        expect(claves).toEqual([]);
    });

    it("con catálogo → 200 con las ACTIVAS (y nunca una rama 4xx)", async () => {
        await prisma.plataforma.create({ data: { clave: "whatsapp-874", nombre: "WhatsApp", categoria: "mensajeria", esActiva: true } });
        await prisma.plataforma.create({ data: { clave: "inactiva-874", nombre: "Inactiva", categoria: "otro", esActiva: false } });
        const { status, claves } = await llamar();
        expect(status).toBe(200);
        expect(claves, "la activa está").toContain("whatsapp-874");
        expect(claves, "la inactiva NO está").not.toContain("inactiva-874");
    });
});
