/**
 * SPEC-134 (E-1): la verificación de propiedad del módulo colegio consulta los
 * repos del DAL (tenant obligatorio por construcción). Las firmas públicas y los
 * mensajes de error quedan intactos (los usan las rutas y este módulo se importa
 * desde layouts/páginas).
 */
import { AlumnoRepository } from "@/lib/dal/repositories/alumno";
import { CursoRepository } from "@/lib/dal/repositories/curso";
import { IdentificadorAlumnoRepository } from "@/lib/dal/repositories/identificador-alumno";
import { UsuarioRepository } from "@/lib/dal/repositories/usuario";
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
    const usuario = await new UsuarioRepository().findColegioId(usuarioId);
    if (!usuario?.colegioId) {
        throw new Error("Curso no encontrado");
    }

    const curso = await new CursoRepository().obtenerPorId(usuario.colegioId, cursoId);
    if (!curso) {
        throw new Error("Curso no encontrado");
    }

    return curso;
}

export async function verificarPropiedadAlumno(
    usuarioId: string,
    alumnoId: string
): Promise<AlumnoPropiedad> {
    const usuario = await new UsuarioRepository().findColegioId(usuarioId);
    if (!usuario?.colegioId) {
        throw new Error("Alumno no encontrado");
    }

    const alumno = await new AlumnoRepository().obtenerPorId(usuario.colegioId, alumnoId);
    if (!alumno) {
        throw new Error("Alumno no encontrado");
    }

    return alumno;
}

export async function verificarPropiedadIdentificador(
    usuarioId: string,
    identificadorId: string
): Promise<IdentificadorPropiedad> {
    const usuario = await new UsuarioRepository().findColegioId(usuarioId);
    if (!usuario?.colegioId) {
        throw new Error("Identificador no encontrado");
    }

    const identificador = await new IdentificadorAlumnoRepository().obtenerPorId(usuario.colegioId, identificadorId);
    if (!identificador) {
        throw new Error("Identificador no encontrado");
    }

    return identificador;
}
