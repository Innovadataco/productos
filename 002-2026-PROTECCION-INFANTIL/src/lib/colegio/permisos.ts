import { prisma } from "@/lib/prisma";
import type { EtiquetaRelacionAlumno } from "@prisma/client";

export interface CursoPropiedad {
    id: string;
    colegioId: string;
    nombre: string;
    grado: string | null;
    anioLectivo: string | null;
    estado: string;
}

export interface AlumnoPropiedad {
    id: string;
    cursoId: string;
    colegioId: string;
    nombre: string;
    estado: string;
}

export interface IdentificadorPropiedad {
    id: string;
    alumnoId: string;
    tipo: string;
    valor: string;
    plataformaId: string | null;
    etiquetaRelacion: EtiquetaRelacionAlumno;
    estado: string;
}

export async function verificarPropiedadCurso(
    usuarioId: string,
    cursoId: string
): Promise<CursoPropiedad> {
    const usuario = await prisma.usuario.findUnique({
        where: { id: usuarioId },
        select: { colegioId: true },
    });
    if (!usuario?.colegioId) {
        throw new Error("Curso no encontrado");
    }

    const curso = await prisma.curso.findFirst({
        where: { id: cursoId, colegioId: usuario.colegioId },
    });
    if (!curso) {
        throw new Error("Curso no encontrado");
    }

    return curso;
}

export async function verificarPropiedadAlumno(
    usuarioId: string,
    alumnoId: string
): Promise<AlumnoPropiedad> {
    const usuario = await prisma.usuario.findUnique({
        where: { id: usuarioId },
        select: { colegioId: true },
    });
    if (!usuario?.colegioId) {
        throw new Error("Alumno no encontrado");
    }

    const alumno = await prisma.alumno.findFirst({
        where: { id: alumnoId, colegioId: usuario.colegioId },
    });
    if (!alumno) {
        throw new Error("Alumno no encontrado");
    }

    return alumno;
}

export async function verificarPropiedadIdentificador(
    usuarioId: string,
    identificadorId: string
): Promise<IdentificadorPropiedad> {
    const usuario = await prisma.usuario.findUnique({
        where: { id: usuarioId },
        select: { colegioId: true },
    });
    if (!usuario?.colegioId) {
        throw new Error("Identificador no encontrado");
    }

    const identificador = await prisma.identificadorAlumno.findFirst({
        where: {
            id: identificadorId,
            alumno: { colegioId: usuario.colegioId },
        },
    });
    if (!identificador) {
        throw new Error("Identificador no encontrado");
    }

    return identificador;
}
