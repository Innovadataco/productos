import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearColegioConAdmin, crearCurso, crearAlumno, crearIdentificadorAlumno } from "@/lib/reporte-test-utils";
import {
    verificarPropiedadCurso,
    verificarPropiedadAlumno,
    verificarPropiedadIdentificador,
} from "./permisos";

describe("src/lib/colegio/permisos", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("verificarPropiedadCurso devuelve el curso cuando pertenece al colegio del usuario", async () => {
        const { admin, colegio } = await crearColegioConAdmin();
        const curso = await crearCurso(colegio.id, { nombre: "6A" });

        const result = await verificarPropiedadCurso(admin.id, curso.id);
        expect(result.id).toBe(curso.id);
        expect(result.colegioId).toBe(colegio.id);
    });

    it("verificarPropiedadCurso falla para curso de otro colegio", async () => {
        const { admin } = await crearColegioConAdmin();
        const { colegio: otroColegio } = await crearColegioConAdmin();
        const otroCurso = await crearCurso(otroColegio.id, { nombre: "Otro" });

        await expect(verificarPropiedadCurso(admin.id, otroCurso.id)).rejects.toThrow("Curso no encontrado");
    });

    it("verificarPropiedadAlumno devuelve el alumno cuando pertenece al colegio del usuario", async () => {
        const { admin, colegio } = await crearColegioConAdmin();
        const curso = await crearCurso(colegio.id, { nombre: "6A" });
        const alumno = await crearAlumno(curso.id, colegio.id, { nombre: "María" });

        const result = await verificarPropiedadAlumno(admin.id, alumno.id);
        expect(result.id).toBe(alumno.id);
    });

    it("verificarPropiedadAlumno falla para alumno de otro colegio", async () => {
        const { admin } = await crearColegioConAdmin();
        const { colegio: otroColegio } = await crearColegioConAdmin();
        const otroCurso = await crearCurso(otroColegio.id, { nombre: "Otro" });
        const otroAlumno = await crearAlumno(otroCurso.id, otroColegio.id, { nombre: "Ajeno" });

        await expect(verificarPropiedadAlumno(admin.id, otroAlumno.id)).rejects.toThrow("Alumno no encontrado");
    });

    it("verificarPropiedadIdentificador devuelve el identificador cuando pertenece al colegio del usuario", async () => {
        const { admin, colegio } = await crearColegioConAdmin();
        const curso = await crearCurso(colegio.id, { nombre: "6A" });
        const alumno = await crearAlumno(curso.id, colegio.id, { nombre: "María" });
        const identificador = await crearIdentificadorAlumno(alumno.id, { tipo: "telefono", valor: "+573001234567" });

        const result = await verificarPropiedadIdentificador(admin.id, identificador.id);
        expect(result.id).toBe(identificador.id);
    });

    it("verificarPropiedadIdentificador falla para identificador de otro colegio", async () => {
        const { admin } = await crearColegioConAdmin();
        const { colegio: otroColegio } = await crearColegioConAdmin();
        const otroCurso = await crearCurso(otroColegio.id, { nombre: "Otro" });
        const otroAlumno = await crearAlumno(otroCurso.id, otroColegio.id, { nombre: "Ajeno" });
        const otroIdentificador = await crearIdentificadorAlumno(otroAlumno.id, { tipo: "telefono", valor: "+573001234567" });

        await expect(verificarPropiedadIdentificador(admin.id, otroIdentificador.id)).rejects.toThrow("Identificador no encontrado");
    });

    it("falla si el usuario no tiene colegio asignado", async () => {
        const adminSinColegio = await prisma.usuario.create({
            data: {
                email: `no-colegio-${Date.now()}@example.com`,
                nombre: "Sin Colegio",
                passwordHash: "hash",
                rol: "SCHOOL_ADMIN",
                estado: "activo",
            },
        });
        const { colegio } = await crearColegioConAdmin();
        const curso = await crearCurso(colegio.id, { nombre: "6A" });

        await expect(verificarPropiedadCurso(adminSinColegio.id, curso.id)).rejects.toThrow("Curso no encontrado");
    });
});
