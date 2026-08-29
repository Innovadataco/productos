import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearColegioConAdmin, crearCurso, crearEstudiante, crearIdentificadorEstudiante } from "@/lib/reporte-test-utils";
import {
    verificarPropiedadCurso,
    verificarPropiedadEstudiante,
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

    it("verificarPropiedadEstudiante devuelve el alumno cuando pertenece al colegio del usuario", async () => {
        const { admin, colegio } = await crearColegioConAdmin();
        const curso = await crearCurso(colegio.id, { nombre: "6A" });
        const alumno = await crearEstudiante(curso.id, colegio.id, { nombre: "María" });

        const result = await verificarPropiedadEstudiante(admin.id, alumno.id);
        expect(result.id).toBe(alumno.id);
    });

    it("verificarPropiedadEstudiante falla para alumno de otro colegio", async () => {
        const { admin } = await crearColegioConAdmin();
        const { colegio: otroColegio } = await crearColegioConAdmin();
        const otroCurso = await crearCurso(otroColegio.id, { nombre: "Otro" });
        const otroEstudiante = await crearEstudiante(otroCurso.id, otroColegio.id, { nombre: "Ajeno" });

        await expect(verificarPropiedadEstudiante(admin.id, otroEstudiante.id)).rejects.toThrow("Alumno no encontrado");
    });

    it("verificarPropiedadIdentificador devuelve el identificador cuando pertenece al colegio del usuario", async () => {
        const { admin, colegio } = await crearColegioConAdmin();
        const curso = await crearCurso(colegio.id, { nombre: "6A" });
        const alumno = await crearEstudiante(curso.id, colegio.id, { nombre: "María" });
        const identificador = await crearIdentificadorEstudiante(alumno.id, { tipo: "telefono", valor: "+573001234567" });

        const result = await verificarPropiedadIdentificador(admin.id, identificador.id);
        expect(result.id).toBe(identificador.id);
    });

    it("verificarPropiedadIdentificador falla para identificador de otro colegio", async () => {
        const { admin } = await crearColegioConAdmin();
        const { colegio: otroColegio } = await crearColegioConAdmin();
        const otroCurso = await crearCurso(otroColegio.id, { nombre: "Otro" });
        const otroEstudiante = await crearEstudiante(otroCurso.id, otroColegio.id, { nombre: "Ajeno" });
        const otroIdentificador = await crearIdentificadorEstudiante(otroEstudiante.id, { tipo: "telefono", valor: "+573001234567" });

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
