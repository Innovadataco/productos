/**
 * SPEC-114 · T010 — PRUEBA LENTA con el motor REAL (Ollama local). Opt-in:
 * NO corre en el gate rápido ni en CI; se ejecuta a demanda con:
 *   E2E_LENTA=true npx vitest run src/lib/e2e/lenta/motor-real.test.ts
 * Un reporte real viaja por el pipeline completo (POST /api/reportes/procesar,
 * la misma ruta del worker) y se verifica el cierre en BD (§9): estado final
 * coherente, clasificación persistida y texto original intacto y cifrado.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import "../mock-headers";
import { limpiarJar } from "../mock-headers";
import { prisma } from "@/lib/prisma";
import { sembrarBase } from "../seed-ciclo";
import { verificarTextoIntacto } from "../helpers";

const LENTA = process.env.E2E_LENTA === "true";
const TIMEOUT_MOTOR = 5 * 60 * 1000; // el motor real tarda ~52 s por reporte; margen amplio

describe.skipIf(!LENTA)("SPEC-114 · prueba lenta con motor real (opt-in, E2E_LENTA=true)", () => {
    beforeEach(async () => {
        await sembrarBase();
        limpiarJar();
    });

    afterEach(async () => {
        // Deja ia.rubrica.enabled como estaba: la prueba no cambia el motor por defecto
        await prisma.parametroSistema
            .update({ where: { clave: "ia.rubrica.enabled" }, data: { valor: "true" } })
            .catch(() => undefined);
    });

    it(
        "un reporte real viaja por el pipeline completo y cierra correcto en BD",
        async () => {
            const texto =
                "Un hombre adulto le escribe a mi hija de 14 años todos los días ofreciéndole dinero por fotos íntimas. Le dice que no le cuente a nadie.";
            // Ingesta por el camino REAL (POST /api/reportes): ahí el texto se cifra
            // con AES-256-GCM antes de persistir — crearlo por Prisma directo saltaría el cifrado
            const { POST: reportesPOST } = await import("@/app/api/reportes/route");
            const resIngesta = await reportesPOST(
                new Request("http://localhost:5005/api/reportes", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        identificador: `+57320999${Date.now() % 1000}`,
                        plataforma: "whatsapp",
                        texto,
                        fechaIncidente: "2026-07-20T10:00:00Z",
                        ciudad: "Bogotá",
                        pais: "Colombia",
                    }),
                })
            );
            expect(resIngesta.status, "la ingesta real debe aceptar el reporte").toBe(201);
            const { reporte } = (await resIngesta.json()) as { reporte: { id: string } };

            const { POST: procesarPOST } = await import("@/app/api/reportes/procesar/route");
            const inicio = Date.now();
            const res = await procesarPOST(
                new Request("http://localhost:5005/api/reportes/procesar", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "X-Worker-Secret": process.env.WORKER_SECRET ?? "" },
                    body: JSON.stringify({ reporteId: reporte.id }),
                })
            );
            const latenciaMs = Date.now() - inicio;
            expect(res.status, "el pipeline debe procesar el reporte").toBe(200);
            console.log(`[E2E-LENTA] motor real: ${(latenciaMs / 1000).toFixed(1)} s`);

            // §9: estado final coherente, clasificación persistida, texto intacto y cifrado
            const final = await prisma.reporte.findUnique({ where: { id: reporte.id }, include: { clasificacion: true } });
            expect(
                ["CLASIFICADO", "REVISION_MANUAL", "CORREGIDO", "POSIBLE_SPAM", "DUPLICADO", "REQUIERE_ANONIMIZACION"],
                "el estado final debe ser uno de los estados terminales del pipeline"
            ).toContain(final!.estado);
            expect(final!.clasificacion, "la clasificación del motor real debe persistirse").toBeTruthy();
            await verificarTextoIntacto(reporte.id, texto);
        },
        TIMEOUT_MOTOR
    );
});
