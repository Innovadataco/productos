/**
 * SPEC-134 (E-1): tests del listado paginado del AuditLogRepository (auditoría del
 * colegio): filtra por el where del llamador (que lleva el tenant), incluye el actor
 * y pagina con total.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearColegioConAdmin, crearUsuario } from "@/lib/reporte-test-utils";
import { AuditLogRepository } from "./audit-log";

describe("AuditLogRepository · findPaginadosConUsuario", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("devuelve [items, total] con el actor, filtrado por el where del llamador", async () => {
        const { colegio } = await crearColegioConAdmin();
        const { colegio: otro } = await crearColegioConAdmin();
        const actor = await crearUsuario("SCHOOL_ADMIN", "actor-audit@test.local");
        await prisma.auditLog.create({
            data: { accion: "COLEGIO_CURSO_CREADO", tipoRecurso: "Curso", recursoId: "c1", usuarioId: actor.id, colegioId: colegio.id, ipAddress: "t", userAgent: "t" },
        });
        await prisma.auditLog.create({
            data: { accion: "COLEGIO_ALUMNO_CREADO", tipoRecurso: "Alumno", recursoId: "a1", colegioId: colegio.id, ipAddress: "t", userAgent: "t" },
        });
        await prisma.auditLog.create({
            data: { accion: "COLEGIO_CURSO_CREADO", tipoRecurso: "Curso", recursoId: "c2", colegioId: otro.id, ipAddress: "t", userAgent: "t" },
        });
        const repo = new AuditLogRepository();

        const [items, total] = await repo.findPaginadosConUsuario(
            { colegioId: colegio.id, accion: { in: ["COLEGIO_CURSO_CREADO", "COLEGIO_ALUMNO_CREADO"] } },
            { skip: 0, take: 25 }
        );

        expect(total).toBe(2);
        expect(items).toHaveLength(2);
        expect(items.every((i) => i.colegioId === colegio.id), "solo filas del tenant del where").toBe(true);
        const conActor = items.find((i) => i.usuarioId === actor.id);
        expect(conActor!.usuario?.nombre, "incluye el nombre del actor").toBe(actor.nombre);
        expect(conActor!.usuario?.email).toBe(actor.email);

        // Paginación: take 1 devuelve 1 pero el total se conserva
        const [pagina, totalPaginado] = await repo.findPaginadosConUsuario({ colegioId: colegio.id }, { skip: 0, take: 1 });
        expect(pagina).toHaveLength(1);
        expect(totalPaginado).toBe(2);
    });
});
