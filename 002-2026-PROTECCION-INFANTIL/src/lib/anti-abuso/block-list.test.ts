import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import { bloquearIp, desbloquearIp, estaIpBloqueada, listarBloqueosVigentes } from "./block-list";
import { calcularIpHash } from "./fuente-reporte";

describe("BlockList service (SPEC-184)", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("bloquea y consulta una IP vigente", async () => {
        const admin = await crearUsuario("ADMIN");
        const ipHash = calcularIpHash("192.0.2.10");

        await bloquearIp({ ipHash, motivo: "Robot inundando", duracion: "24h", creadoPorId: admin.id });

        expect(await estaIpBloqueada(ipHash)).toBe(true);
    });

    it("el bloqueo expirado no aplica", async () => {
        const admin = await crearUsuario("ADMIN");
        const ipHash = calcularIpHash("192.0.2.11");

        const bloqueo = await bloquearIp({ ipHash, motivo: "Spam", duracion: "24h", creadoPorId: admin.id });
        // Forzar expiración
        await prisma.blockList.update({ where: { id: bloqueo.id }, data: { expiraEn: new Date(Date.now() - 1000) } });

        expect(await estaIpBloqueada(ipHash)).toBe(false);
    });

    it("el bloqueo permanente no expira", async () => {
        const admin = await crearUsuario("ADMIN");
        const ipHash = calcularIpHash("192.0.2.12");

        await bloquearIp({ ipHash, motivo: "Permanente", duracion: "permanente", creadoPorId: admin.id });

        expect(await estaIpBloqueada(ipHash)).toBe(true);
        const [vigentes] = await listarBloqueosVigentes({ skip: 0, take: 10 });
        expect(vigentes).toHaveLength(1);
        expect(vigentes[0].expiraEn).toBeNull();
    });

    it("desbloquear elimina el bloqueo vigente", async () => {
        const admin = await crearUsuario("ADMIN");
        const ipHash = calcularIpHash("192.0.2.13");

        const bloqueo = await bloquearIp({ ipHash, motivo: "Test", duracion: "24h", creadoPorId: admin.id });
        expect(await estaIpBloqueada(ipHash)).toBe(true);

        const eliminado = await desbloquearIp({ id: bloqueo.id, creadoPorId: admin.id });
        expect(eliminado).not.toBeNull();
        expect(await estaIpBloqueada(ipHash)).toBe(false);
    });

    it("bloquear de nuevo reemplaza el bloqueo previo", async () => {
        const admin = await crearUsuario("ADMIN");
        const ipHash = calcularIpHash("192.0.2.14");

        const primero = await bloquearIp({ ipHash, motivo: "Primero", duracion: "24h", creadoPorId: admin.id });
        const segundo = await bloquearIp({ ipHash, motivo: "Segundo", duracion: "7d", creadoPorId: admin.id });

        expect(segundo.id).not.toBe(primero.id);
        const count = await prisma.blockList.count({ where: { ipHash } });
        expect(count).toBe(1);
    });

    it("registra AuditLog al bloquear y desbloquear", async () => {
        const admin = await crearUsuario("ADMIN");
        const ipHash = calcularIpHash("192.0.2.15");

        const bloqueo = await bloquearIp({ ipHash, motivo: "Auditable", duracion: "24h", creadoPorId: admin.id });
        let audits = await prisma.auditLog.count({ where: { accion: "IP_BLOQUEADA", recursoId: bloqueo.id } });
        expect(audits).toBe(1);

        await desbloquearIp({ id: bloqueo.id, creadoPorId: admin.id });
        audits = await prisma.auditLog.count({ where: { tipoRecurso: "BlockList", recursoId: bloqueo.id } });
        expect(audits).toBe(2);
    });
});
