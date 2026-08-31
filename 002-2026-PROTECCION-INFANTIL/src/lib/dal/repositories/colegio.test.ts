/**
 * SPEC-134 (E-1): tests del ColegioRepository — el tenant es el propio id.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearColegioConAdmin, crearPaisCiudad } from "@/lib/reporte-test-utils";
import { ColegioRepository } from "./colegio";

describe("ColegioRepository", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("obtenerVigencia devuelve la ventana del propio colegio", async () => {
        const { colegio } = await crearColegioConAdmin();
        const repo = new ColegioRepository();

        const vigencia = await repo.obtenerVigencia(colegio.id);
        expect(vigencia).not.toBeNull();
        expect(vigencia!.id).toBe(colegio.id);
        expect(vigencia!.estado).toBe("activo");
        expect(vigencia!.inicioServicio).toBeInstanceOf(Date);
    });

    it("obtenerResumen devuelve id y nombre del colegio pedido (no de otro)", async () => {
        const { colegio: a } = await crearColegioConAdmin();
        const { colegio: b } = await crearColegioConAdmin();
        await prisma.colegio.update({ where: { id: a.id }, data: { nombre: "Colegio Alfa" } });
        await prisma.colegio.update({ where: { id: b.id }, data: { nombre: "Colegio Beta" } });
        const repo = new ColegioRepository();

        expect((await repo.obtenerResumen(a.id))!.nombre).toBe("Colegio Alfa");
        expect((await repo.obtenerResumen(b.id))!.nombre).toBe("Colegio Beta");
    });

    it("obtenerConUbicacion incluye pais/departamento/ciudad", async () => {
        const { colegio } = await crearColegioConAdmin();
        const repo = new ColegioRepository();

        const conUbicacion = await repo.obtenerConUbicacion(colegio.id);
        expect(conUbicacion).not.toBeNull();
        expect(conUbicacion!.pais.nombre).toBeTruthy();
        expect(conUbicacion!.ciudad.nombre).toBeTruthy();
    });

    it("devuelve null para un id inexistente", async () => {
        const repo = new ColegioRepository();
        expect(await repo.obtenerVigencia("no-existe")).toBeNull();
        expect(await repo.obtenerResumen("no-existe")).toBeNull();
        expect(await repo.obtenerConUbicacion("no-existe")).toBeNull();
    });
});

/**
 * E-8 (LOTE 3): funciones ADMIN globales del ColegioRepository (gestión de
 * colegios de la plataforma: cruzan tenants por diseño, lo usa el rol ADMIN).
 */
describe("ColegioRepository (E-8 LOTE 3: admin global)", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("listarAdminGlobal excluye eliminados e incluye ubicación, admin y tenant", async () => {
        const { colegio, admin } = await crearColegioConAdmin();
        const { colegio: eliminado } = await crearColegioConAdmin();
        await prisma.colegio.update({ where: { id: eliminado.id }, data: { estado: "eliminado" } });

        const lista = await new ColegioRepository().listarAdminGlobal();
        expect(lista.map((c) => c.id)).toEqual([colegio.id]);
        expect(lista[0].admin).toMatchObject({ id: admin.id, email: admin.email, estado: "activo" });
        expect(lista[0].pais.nombre).toBeTruthy();
        expect(lista[0].ciudad.nombre).toBeTruthy();
        expect(lista[0].tenant).toMatchObject({ id: colegio.tenantId });
    });

    it("findParaActualizar/findParaEliminar/findParaRegenerarPassword/findParaReenviarEmail: selects exactos", async () => {
        const { colegio, admin } = await crearColegioConAdmin();
        const repo = new ColegioRepository();

        const paraActualizar = await repo.findParaActualizar(colegio.id);
        expect(paraActualizar!.admin).toMatchObject({ id: admin.id, email: admin.email });
        expect(paraActualizar!.estado).toBe("activo");

        const paraEliminar = await repo.findParaEliminar(colegio.id);
        expect(paraEliminar!.admin).toEqual({ id: admin.id });

        const paraRegenerar = await repo.findParaRegenerarPassword(colegio.id);
        expect(paraRegenerar!.admin).toMatchObject({
            id: admin.id,
            email: admin.email,
            estado: "activo",
            debeCambiarPassword: false,
        });

        const paraReenviar = await repo.findParaReenviarEmail(colegio.id);
        expect(paraReenviar!.admin).toEqual({ id: admin.id, email: admin.email, nombre: admin.nombre });

        expect(await repo.findParaActualizar("no-existe")).toBeNull();
    });

    it("crearTenantParaColegio + crear + actualizar: alta y edición del colegio", async () => {
        const { pais, ciudad } = await crearPaisCiudad();
        const repo = new ColegioRepository();

        const tenant = await repo.crearTenantParaColegio("Colegio Nuevo");
        expect(tenant).toMatchObject({ nombre: "Colegio: Colegio Nuevo", estado: "activo" });

        const creado = await repo.crear({
            nombre: "Colegio Nuevo",
            nit: "NIT-COLEGIO-NUEVO",
            paisId: pais.id,
            ciudadId: ciudad.id,
            representanteLegalNombre: "Rep",
            representanteLegalIdentificacion: "999",
            representanteLegalEmail: "rep@nuevo.com",
            inicioServicio: new Date("2026-01-01T00:00:00Z"),
            finServicio: new Date("2026-12-31T00:00:00Z"),
            tipoPeriodo: "ANUAL",
            estado: "activo",
            tenantId: tenant.id,
        });
        expect(creado.estado).toBe("activo");

        const actualizado = await repo.actualizar(creado.id, { estado: "inactivo", nombre: "Colegio Renombrado" });
        expect(actualizado).toMatchObject({ estado: "inactivo", nombre: "Colegio Renombrado" });
    });
});
