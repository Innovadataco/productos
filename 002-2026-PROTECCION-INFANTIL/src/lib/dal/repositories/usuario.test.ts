/**
 * E-8 (LOTE 2): tests de findOperadorActivoConCupo (reasignación de casos).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearColegioConAdmin } from "@/lib/reporte-test-utils";
import { prisma } from "@/lib/prisma";
import { UsuarioRepository } from "./usuario";

describe("UsuarioRepository (E-8 LOTE 2)", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("devuelve el operador activo con el cupo de su perfil", async () => {
        const admin = await crearUsuario("ADMIN");
        const operador = await crearUsuario("OPERADOR");
        await prisma.perfilOperador.create({
            data: { usuarioId: operador.id, creadoPorId: admin.id, cupoMaximo: 7 },
        });

        const row = await new UsuarioRepository().findOperadorActivoConCupo(operador.id);
        expect(row).not.toBeNull();
        expect(row!.id).toBe(operador.id);
        expect(row!.perfilOperador).toMatchObject({ cupoMaximo: 7 });
    });

    it("no devuelve operadores inactivos ni usuarios de otro rol", async () => {
        const admin = await crearUsuario("ADMIN");
        const operador = await crearUsuario("OPERADOR");
        await prisma.perfilOperador.create({
            data: { usuarioId: operador.id, creadoPorId: admin.id },
        });
        await prisma.usuario.update({ where: { id: operador.id }, data: { estado: "inactivo" } });

        const repo = new UsuarioRepository();
        expect(await repo.findOperadorActivoConCupo(operador.id)).toBeNull();
        expect(await repo.findOperadorActivoConCupo(admin.id)).toBeNull();
        expect(await repo.findOperadorActivoConCupo("no-existe")).toBeNull();
    });
});

describe("UsuarioRepository (E-8 LOTE 3: padres y sesiones)", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("findPadresPaginados: solo PARENT, orden reciente, paginación y total", async () => {
        const repo = new UsuarioRepository();
        const padre = await crearUsuario("PARENT");
        await crearUsuario("OPERADOR");

        const [rows, total] = await repo.findPadresPaginados({ rol: "PARENT" }, { skip: 0, take: 25 });
        expect(total).toBe(1);
        expect(rows.map((r) => r.id)).toEqual([padre.id]);
        expect(rows[0]).toMatchObject({ estado: "activo", debeCambiarPassword: false });
        expect("rol" in rows[0]).toBe(false);
        expect("inicioServicio" in rows[0]).toBe(true);
        expect("ultimaSesion" in rows[0]).toBe(true);
        expect("passwordHash" in rows[0]).toBe(false);

        const [vacia, totalVacia] = await repo.findPadresPaginados({ rol: "PARENT" }, { skip: 5, take: 25 });
        expect(totalVacia).toBe(1);
        expect(vacia).toHaveLength(0);
    });

    it("findPadreById solo encuentra cuentas PARENT", async () => {
        const repo = new UsuarioRepository();
        const padre = await crearUsuario("PARENT");
        const operador = await crearUsuario("OPERADOR");

        const row = await repo.findPadreById(padre.id);
        expect(row).toMatchObject({ id: padre.id, estado: "activo", debeCambiarPassword: false });
        expect(await repo.findPadreById(operador.id)).toBeNull();
    });

    it("findPadreVigencia y actualizarVigenciaServicio: lee, fija y limpia la ventana", async () => {
        const repo = new UsuarioRepository();
        const padre = await crearUsuario("PARENT");

        const antes = await repo.findPadreVigencia(padre.id);
        expect(antes).toMatchObject({ id: padre.id, inicioServicio: null, finServicio: null });
        expect("estado" in antes!).toBe(false);

        const inicio = new Date("2026-01-01T00:00:00Z");
        const fin = new Date("2026-12-31T00:00:00Z");
        const fijada = await repo.actualizarVigenciaServicio(padre.id, { inicioServicio: inicio, finServicio: fin });
        expect(fijada.inicioServicio).toEqual(inicio);
        expect(fijada.finServicio).toEqual(fin);

        const limpia = await repo.actualizarVigenciaServicio(padre.id, { inicioServicio: null, finServicio: null });
        expect(limpia.inicioServicio).toBeNull();
        expect(limpia.finServicio).toBeNull();
    });

    it("findDebeCambiarPassword y findSesionColegio exponen solo los flags de sesión", async () => {
        const repo = new UsuarioRepository();
        const { admin } = await crearColegioConAdmin();

        const flag = await repo.findDebeCambiarPassword(admin.id);
        expect(flag).toEqual({ debeCambiarPassword: false });

        const sesion = await repo.findSesionColegio(admin.id);
        expect(sesion).toMatchObject({ id: admin.id, rol: "SCHOOL_ADMIN", estado: "activo" });
        expect(sesion!.colegioId).toBeTruthy();
        expect("passwordHash" in sesion!).toBe(false);
    });

    it("findConColegioYUbicacion incluye el colegio con pais/departamento/ciudad", async () => {
        const repo = new UsuarioRepository();
        const { admin, colegio } = await crearColegioConAdmin();

        const row = await repo.findConColegioYUbicacion(admin.id);
        expect(row!.colegio!.id).toBe(colegio.id);
        expect(row!.colegio!.pais.nombre).toBeTruthy();
        expect(row!.colegio!.ciudad.nombre).toBeTruthy();

        const sinColegio = await crearUsuario("PARENT");
        expect((await repo.findConColegioYUbicacion(sinColegio.id))!.colegio).toBeNull();
    });
});
