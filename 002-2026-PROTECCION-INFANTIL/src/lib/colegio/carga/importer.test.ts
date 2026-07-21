import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearColegioConAdmin, crearCurso, crearPlataforma } from "@/lib/reporte-test-utils";
import { importarCargaMasiva } from "./importer";
import type { FilaCargaAlumno } from "./parser";

function fila(nombreCurso: string, nombreAlumno: string, tipo: string, valor: string, plataformaId: string | null = null): FilaCargaAlumno {
    return {
        fila: 2,
        curso: { nombre: nombreCurso, grado: "Sexto", anioLectivo: "2026" },
        alumno: { nombre: nombreAlumno },
        identificador: {
            tipo,
            valor,
            etiquetaRelacion: "ALUMNO",
            plataformaId,
        },
    };
}

describe("importarCargaMasiva", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("crea curso, alumno e identificador", async () => {
        const { colegio } = await crearColegioConAdmin();
        const resumen = await importarCargaMasiva([fila("6A", "María Gómez", "telefono", "+573001234567")], colegio.id);

        expect(resumen.cursosCreados).toBe(1);
        expect(resumen.alumnosCreados).toBe(1);
        expect(resumen.identificadoresCreados).toBe(1);

        const cursos = await prisma.curso.findMany({ where: { colegioId: colegio.id } });
        expect(cursos).toHaveLength(1);
        expect(cursos[0].nombre).toBe("6A");

        const alumnos = await prisma.alumno.findMany({ where: { colegioId: colegio.id } });
        expect(alumnos).toHaveLength(1);

        const identificadores = await prisma.identificadorAlumno.findMany({ where: { alumnoId: alumnos[0].id } });
        expect(identificadores).toHaveLength(1);
    });

    it("reutiliza curso existente", async () => {
        const { admin, colegio } = await crearColegioConAdmin();
        await crearCurso(colegio.id, { nombre: "6A", grado: "Sexto", anioLectivo: "2026" });
        const resumen = await importarCargaMasiva([fila("6A", "María Gómez", "telefono", "+573001234567")], colegio.id);

        expect(resumen.cursosReutilizados).toBe(1);
        expect(resumen.cursosCreados).toBe(0);
        expect(resumen.alumnosCreados).toBe(1);
    });

    it("reutiliza alumno existente y agrega identificador", async () => {
        const { admin, colegio } = await crearColegioConAdmin();
        const curso = await crearCurso(colegio.id, { nombre: "6A", grado: "Sexto", anioLectivo: "2026" });
        await prisma.alumno.create({
            data: { cursoId: curso.id, colegioId: colegio.id, nombre: "María Gómez", estado: "activo" },
        });

        const resumen = await importarCargaMasiva([fila("6A", "María Gómez", "email", "maria@example.com")], colegio.id);

        expect(resumen.cursosReutilizados).toBe(1);
        expect(resumen.alumnosReutilizados).toBe(1);
        expect(resumen.alumnosCreados).toBe(0);
        expect(resumen.identificadoresCreados).toBe(1);

        const alumnos = await prisma.alumno.findMany({ where: { colegioId: colegio.id } });
        expect(alumnos).toHaveLength(1);
        const identificadores = await prisma.identificadorAlumno.findMany({ where: { alumnoId: alumnos[0].id } });
        expect(identificadores).toHaveLength(1);
    });

    it("es idempotente: segunda carga no duplica", async () => {
        const { colegio } = await crearColegioConAdmin();
        const filas = [fila("6A", "María Gómez", "telefono", "+573001234567")];

        await importarCargaMasiva(filas, colegio.id);
        const resumen2 = await importarCargaMasiva(filas, colegio.id);

        expect(resumen2.cursosReutilizados).toBe(1);
        expect(resumen2.alumnosReutilizados).toBe(1);
        expect(resumen2.identificadoresReutilizados).toBe(1);
        expect(resumen2.cursosCreados).toBe(0);
        expect(resumen2.alumnosCreados).toBe(0);
        expect(resumen2.identificadoresCreados).toBe(0);

        const alumnos = await prisma.alumno.findMany({ where: { colegioId: colegio.id } });
        expect(alumnos).toHaveLength(1);
    });

    it("asigna plataforma resuelta al identificador", async () => {
        const { colegio } = await crearColegioConAdmin();
        const plataforma = await crearPlataforma("whatsapp", "WhatsApp");

        const resumen = await importarCargaMasiva(
            [fila("6A", "María Gómez", "telefono", "+573001234567", plataforma.id)],
            colegio.id
        );

        expect(resumen.identificadoresCreados).toBe(1);
        const identificadores = await prisma.identificadorAlumno.findMany({ include: { plataforma: true } });
        expect(identificadores[0].plataforma?.id).toBe(plataforma.id);
    });
});
