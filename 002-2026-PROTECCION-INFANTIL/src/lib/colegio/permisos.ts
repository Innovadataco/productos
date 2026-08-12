/**
 * SPEC-134 (E-1): la verificación de propiedad del módulo colegio consulta los
 * repos del DAL (tenant obligatorio por construcción). Las firmas públicas y los
 * mensajes de error quedan intactos (los usan las rutas y este módulo se importa
 * desde layouts/páginas).
 */
import { EstudianteRepository } from "@/lib/dal/repositories/estudiante";
import { CursoRepository } from "@/lib/dal/repositories/curso";
import { IdentificadorEstudianteRepository } from "@/lib/dal/repositories/identificador-estudiante";
import { AcudienteEstudianteRepository } from "@/lib/dal/repositories/acudiente-estudiante";
import { ProfesorRepository } from "@/lib/dal/repositories/profesor";
import { IdentificadorProfesorRepository } from "@/lib/dal/repositories/identificador-profesor";
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

export interface AcudientePropiedad {
    id: string;
    estudianteId: string;
    colegioId: string;
    nombre: string;
    relacion: string;
    telefono: string | null;
    email: string | null;
    estado: string;
}

export interface ProfesorPropiedad {
    id: string;
    colegioId: string;
    nombre: string;
    apellidos: string;
    estado: string;
}

export interface IdentificadorProfesorPropiedad {
    id: string;
    profesorId: string;
    colegioId: string;
    tipo: string;
    valor: string;
    plataformaId: string | null;
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

export async function verificarPropiedadAcudiente(
    usuarioId: string,
    acudienteId: string,
    estudianteId?: string
): Promise<AcudientePropiedad> {
    const usuario = await new UsuarioRepository().findColegioId(usuarioId);
    if (!usuario?.colegioId) {
        throw new Error("Acudiente no encontrado");
    }

    const acudiente = await new AcudienteEstudianteRepository().obtenerPorId(usuario.colegioId, acudienteId);
    if (!acudiente) {
        throw new Error("Acudiente no encontrado");
    }

    if (estudianteId !== undefined && acudiente.estudianteId !== estudianteId) {
        throw new Error("Acudiente no encontrado");
    }

    return {
        id: acudiente.id,
        estudianteId: acudiente.estudianteId,
        colegioId: usuario.colegioId,
        nombre: acudiente.nombre,
        relacion: acudiente.relacion,
        telefono: acudiente.telefono,
        email: acudiente.email,
        estado: acudiente.estado,
    };
}

export async function verificarPropiedadProfesor(
    usuarioId: string,
    profesorId: string
): Promise<ProfesorPropiedad> {
    const usuario = await new UsuarioRepository().findColegioId(usuarioId);
    if (!usuario?.colegioId) {
        throw new Error("Profesor no encontrado");
    }

    const profesor = await new ProfesorRepository().obtenerPorId(usuario.colegioId, profesorId);
    if (!profesor) {
        throw new Error("Profesor no encontrado");
    }

    return {
        id: profesor.id,
        colegioId: usuario.colegioId,
        nombre: profesor.nombre,
        apellidos: profesor.apellidos,
        estado: profesor.estado,
    };
}

export async function verificarPropiedadIdentificadorProfesor(
    usuarioId: string,
    identificadorId: string,
    profesorId?: string
): Promise<IdentificadorProfesorPropiedad> {
    const usuario = await new UsuarioRepository().findColegioId(usuarioId);
    if (!usuario?.colegioId) {
        throw new Error("Identificador no encontrado");
    }

    const identificador = await new IdentificadorProfesorRepository().obtenerPorId(usuario.colegioId, identificadorId);
    if (!identificador) {
        throw new Error("Identificador no encontrado");
    }

    if (profesorId !== undefined && identificador.profesorId !== profesorId) {
        throw new Error("Identificador no encontrado");
    }

    return {
        id: identificador.id,
        profesorId: identificador.profesorId,
        colegioId: usuario.colegioId,
        tipo: identificador.tipo,
        valor: identificador.valor,
        plataformaId: identificador.plataformaId,
        estado: identificador.estado,
    };
}
