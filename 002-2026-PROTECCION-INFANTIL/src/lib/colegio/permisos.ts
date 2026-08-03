/**
 * SPEC-134 (E-1): la verificación de propiedad del módulo colegio consulta los
 * repos del DAL (tenant obligatorio por construcción). Las firmas públicas y los
 * mensajes de error quedan intactos (los usan las rutas y este módulo se importa
 * desde layouts/páginas).
 */
import { EstudianteRepository } from "@/lib/dal/repositories/estudiante";
import { CursoRepository } from "@/lib/dal/repositories/curso";
import { IdentificadorEstudianteRepository } from "@/lib/dal/repositories/identificador-estudiante";
import { UsuarioRepository } from "@/lib/dal/repositories/usuario";
import type { EtiquetaRelacionEstudiante } from "@prisma/client";

export interface CursoPropiedad {
    id: string;
    colegioId: string;
    nombre: string;
    grado: string | null;
    anioLectivo: string | null;
    estado: string;
    profesorTitularId: string | null; // SPEC-145 (D1=A)
}

export interface EstudiantePropiedad {
    id: string;
    cursoId: string;
    colegioId: string;
    nombre: string;
    apellidos: string;
    estado: string;
}

export interface IdentificadorPropiedad {
    id: string;
    estudianteId: string;
    tipo: string;
    valor: string;
    plataformaId: string | null;
    etiquetaRelacion: EtiquetaRelacionEstudiante;
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

export async function verificarPropiedadEstudiante(
    usuarioId: string,
    estudianteId: string
): Promise<EstudiantePropiedad> {
    const usuario = await new UsuarioRepository().findColegioId(usuarioId);
    if (!usuario?.colegioId) {
        throw new Error("Alumno no encontrado");
    }

    const estudiante = await new EstudianteRepository().obtenerPorId(usuario.colegioId, estudianteId);
    if (!estudiante) {
        throw new Error("Alumno no encontrado");
    }

    return estudiante;
}

export async function verificarPropiedadIdentificador(
    usuarioId: string,
    identificadorId: string
): Promise<IdentificadorPropiedad> {
    const usuario = await new UsuarioRepository().findColegioId(usuarioId);
    if (!usuario?.colegioId) {
        throw new Error("Identificador no encontrado");
    }

    const identificador = await new IdentificadorEstudianteRepository().obtenerPorId(usuario.colegioId, identificadorId);
    if (!identificador) {
        throw new Error("Identificador no encontrado");
    }

    return identificador;
}
