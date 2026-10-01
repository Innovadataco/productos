/**
 * SPEC-751 T010 · CANDADO de la pantalla de audiencia + el gate APAGADO.
 *
 * Conducta exigida (radicado): con `audiencia_menor.gate_activo` = false (default), un padre con
 * audiencia pendiente NO es rebotado al muro; control positivo: con el gate ENCENDIDO sí lo sería, y
 * tras declarar POR EL ENDPOINT REAL deja de estarlo. El emitter compone exactamente
 * `audienciaPendiente = gateAudienciaActivo() && hayAudienciaPendiente()` (sesion-estado-emitter.ts);
 * este candado fija sus dos entradas y el camino real de declaración, sin tocar el emitter (firmado).
 */
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearTokenUsuario } from "@/lib/reporte-test-utils";
import { gateAudienciaActivo, hayAudienciaPendiente } from "@/lib/dal/services/audiencia-menor";

let mockToken: string | undefined;
vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) => (name === "token" && mockToken ? { name: "token", value: mockToken } : undefined),
    }),
}));

import { POST } from "@/app/api/audiencia-menor/declarar/route";

async function setParam(clave: string, valor: string) {
    await prisma.parametroSistema.upsert({
        where: { clave },
        update: { valor },
        create: { clave, valor, tipo: "STRING", categoria: "SYSTEM" },
    });
}

/** El flag que el emitter embebe en la cookie: el padre es rebotado ⟺ gate activo ∧ hay pendiente. */
async function seriaRebotado(usuarioId: string): Promise<boolean> {
    return (await gateAudienciaActivo()) && (await hayAudienciaPendiente(usuarioId));
}

describe("SPEC-751 T010 · pantalla de audiencia + gate apagado", { timeout: 30_000 }, () => {
    let padreId: string;

    beforeEach(async () => {
        await resetDatabase();
        await setParam("consentimiento.version_actual", "v1");
        const padre = await crearUsuario("PARENT");
        padreId = padre.id;
        mockToken = await crearTokenUsuario(padre.id, "PARENT");
        // Un hijo ACTIVO sin fila de AudienciaMenor para la versión vigente → audiencia pendiente.
        await prisma.hijo.create({ data: { usuarioId: padre.id, nombre: "Ana", estado: "activo" } });
    });
    afterAll(async () => prisma.$disconnect());

    it("GATE APAGADO (default): hay audiencia pendiente pero el padre NO sería rebotado", async () => {
        expect(await hayAudienciaPendiente(padreId)).toBe(true); // el estado real SIEMPRE se refleja
        expect(await gateAudienciaActivo()).toBe(false); // nace apagado
        expect(await seriaRebotado(padreId)).toBe(false); // el gate OFF corta el muro
    });

    it("CONTROL POSITIVO · gate ENCENDIDO + pendiente → sería rebotado; tras declarar por el ENDPOINT real → pasa", async () => {
        await setParam("audiencia_menor.gate_activo", "true");
        expect(await seriaRebotado(padreId)).toBe(true); // encendido + pendiente = muro

        const hijo = await prisma.hijo.findFirstOrThrow({ where: { usuarioId: padreId } });
        const req = new Request("http://localhost/api/audiencia-menor/declarar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ hijoId: hijo.id }),
        });
        const res = await POST(req);
        expect(res.status).toBe(200);

        // Persistió por el camino REAL → ya no hay pendiente → con el gate aún encendido, NO rebota.
        expect(await hayAudienciaPendiente(padreId)).toBe(false);
        expect(await seriaRebotado(padreId)).toBe(false);
    });
});
