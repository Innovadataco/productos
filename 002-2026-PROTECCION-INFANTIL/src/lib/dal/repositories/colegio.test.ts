/**
 * SPEC-134 (E-1): tests del ColegioRepository — el tenant es el propio id.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearColegioConAdmin } from "@/lib/reporte-test-utils";
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
