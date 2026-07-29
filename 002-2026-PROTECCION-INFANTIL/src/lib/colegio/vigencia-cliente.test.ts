import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearColegioConAdmin } from "@/lib/reporte-test-utils";
import {
    verificarVigenciaCliente,
    verificarVigenciaColegio,
    assertVigenciaCliente,
    normalizarFechaServicio,
} from "./vigencia";

function diasDesdeHoy(dias: number): Date {
    const d = new Date();
    d.setDate(d.getDate() + dias);
    return normalizarFechaServicio(d);
}

describe("verificarVigenciaCliente — padre (SPEC-119)", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("padre sin vigencia definida entra (no se corta por omisión del dato)", async () => {
        const padre = await crearUsuario("PARENT");
        const result = await verificarVigenciaCliente(padre.id);
        expect(result.vigente).toBe(true);
        expect(result.estado).toBe("vigente");
    });

    it("padre con ventana que incluye hoy está vigente", async () => {
        const padre = await crearUsuario("PARENT");
        await prisma.usuario.update({
            where: { id: padre.id },
            data: { inicioServicio: diasDesdeHoy(-10), finServicio: diasDesdeHoy(10) },
        });
        const result = await verificarVigenciaCliente(padre.id);
        expect(result.vigente).toBe(true);
        expect(result.estado).toBe("vigente");
    });

    it("padre con fin hoy está vigente (comparación normalizada a medianoche)", async () => {
        const padre = await crearUsuario("PARENT");
        await prisma.usuario.update({
            where: { id: padre.id },
            data: { finServicio: diasDesdeHoy(0) },
        });
        const result = await verificarVigenciaCliente(padre.id);
        expect(result.vigente).toBe(true);
    });

    it("padre con fin ayer está vencido y el mensaje dice qué pasó y a quién acudir", async () => {
        const padre = await crearUsuario("PARENT");
        await prisma.usuario.update({
            where: { id: padre.id },
            data: { finServicio: diasDesdeHoy(-1) },
        });
        const result = await verificarVigenciaCliente(padre.id);
        expect(result.vigente).toBe(false);
        expect(result.estado).toBe("vencido");
        expect(result.mensaje).toMatch(/vencido/i);
        expect(result.mensaje).toMatch(/soporte/i);
    });

    it("padre con inicio futuro está no_iniciado", async () => {
        const padre = await crearUsuario("PARENT");
        await prisma.usuario.update({
            where: { id: padre.id },
            data: { inicioServicio: diasDesdeHoy(1) },
        });
        const result = await verificarVigenciaCliente(padre.id);
        expect(result.vigente).toBe(false);
        expect(result.estado).toBe("no_iniciado");
        expect(result.mensaje).toMatch(/soporte/i);
    });

    it("padre con solo finServicio (sin inicio) aplica solo el límite de fin", async () => {
        const vigente = await crearUsuario("PARENT", "vigente@example.com");
        await prisma.usuario.update({
            where: { id: vigente.id },
            data: { finServicio: diasDesdeHoy(5) },
        });
        expect((await verificarVigenciaCliente(vigente.id)).vigente).toBe(true);

        const vencido = await crearUsuario("PARENT", "vencido@example.com");
        await prisma.usuario.update({
            where: { id: vencido.id },
            data: { finServicio: diasDesdeHoy(-5) },
        });
        expect((await verificarVigenciaCliente(vencido.id)).estado).toBe("vencido");
    });

    it("roles internos no tienen vigencia: siempre vigentes", async () => {
        const admin = await crearUsuario("ADMIN", "admin@example.com");
        const operador = await crearUsuario("OPERADOR", "op@example.com");
        expect((await verificarVigenciaCliente(admin.id)).vigente).toBe(true);
        expect((await verificarVigenciaCliente(operador.id)).vigente).toBe(true);
    });
});

describe("verificarVigenciaCliente — colegio (mismo mecanismo, SPEC-119)", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("colegio vencido se detecta por la MISMA función generalizada", async () => {
        const { admin } = await crearColegioConAdmin();
        await prisma.colegio.update({
            where: { id: admin.colegioId! },
            data: { finServicio: diasDesdeHoy(-1) },
        });
        const result = await verificarVigenciaCliente(admin.id);
        expect(result.vigente).toBe(false);
        expect(result.estado).toBe("vencido");
    });

    it("verificarVigenciaColegio queda como alias delegado con el mismo resultado", async () => {
        const { admin } = await crearColegioConAdmin();
        await prisma.colegio.update({
            where: { id: admin.colegioId! },
            data: { finServicio: diasDesdeHoy(-1) },
        });
        const viaAlias = await verificarVigenciaColegio(admin.id);
        const viaCliente = await verificarVigenciaCliente(admin.id);
        expect(viaAlias).toEqual(viaCliente);
    });
});

describe("assertVigenciaCliente (helper para APIs)", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("no lanza para padre vigente", async () => {
        const padre = await crearUsuario("PARENT");
        await expect(assertVigenciaCliente(padre.id)).resolves.toBeUndefined();
    });

    it("lanza AppError 403 con el mensaje para padre vencido", async () => {
        const padre = await crearUsuario("PARENT");
        await prisma.usuario.update({
            where: { id: padre.id },
            data: { finServicio: diasDesdeHoy(-1) },
        });
        await expect(assertVigenciaCliente(padre.id)).rejects.toMatchObject({
            statusCode: 403,
            message: expect.stringMatching(/vencido/i),
        });
    });
});
