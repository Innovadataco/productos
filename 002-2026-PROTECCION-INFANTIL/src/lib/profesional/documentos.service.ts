/**
 * SPEC-436 (I-303 · I-304) · los documentos del profesional: guardarlos y —lo
 * que nunca existió— PODER LEERLOS.
 *
 * Hasta esta spec el archivo se cifraba y quedaba enterrado: `leerAutorizacion`
 * no tenía un solo llamador y el botón «Descargar autorización firmada» apuntaba
 * al id del archivo, que el navegador resolvía como una ruta de la aplicación y
 * terminaba en 404. Acá está el único camino que descifra y sirve.
 *
 * ## Reserva legal (Ley 1918/2018 · 2375/2024 §5)
 * El certificado de antecedentes es **reservado**. Por eso:
 *  · Nunca se sirve el archivo cifrado crudo ni se expone la ruta en disco.
 *  · Solo el **dueño** y el **VERIFICADOR/ADMIN de esa ficha**.
 *  · **Cada apertura deja fila de auditoría** — quién, cuándo, cuál documento.
 *    Se audita ANTES de devolver el contenido: una lectura sin rastro es, para
 *    la ley, una lectura que no se puede demostrar.
 *
 * No agrega valores de enum: reusa `PROFESIONAL_AUTORIZACION_ACCESO`, que
 * existía desde SPEC-391 sin emisor. (Un `ADD VALUE` obliga a coordinar con la
 * réplica de BI antes de desplegar.)
 */
import { AppError, ERROR_CODES } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import { PerfilProfesionalRepository } from "@/lib/dal/repositories/perfil-profesional";
import { DocumentoProfesionalRepository } from "@/lib/dal/repositories/documento-profesional";
import { leerRequisitosVerificacion } from "@/lib/profesionales/verificador/requisitos";
import {
    guardarAutorizacion,
    leerAutorizacion,
    validarAutorizacion,
    type ExtensionAutorizacion,
} from "./autorizacion-storage";

/**
 * La clave `autorizacion` no es un requisito del parámetro: es el documento
 * legal que ya vivía en el perfil. Se sirve por el mismo camino para que exista
 * UN solo lugar que descifra y audita.
 */
export const CLAVE_AUTORIZACION = "autorizacion";

const CONTENT_TYPE: Record<ExtensionAutorizacion, string> = {
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
};

export interface DocumentoServido {
    buffer: Buffer;
    contentType: string;
    /** Nombre sugerido; nunca el original que subió el profesional. */
    nombreDescarga: string;
}

/** Qué documentos tiene cargados un perfil, contra la lista del parámetro. */
export interface EstadoDocumento {
    clave: string;
    nombre: string;
    descripcion: string;
    cargado: boolean;
    extension: string | null;
    subidoEn: string | null;
}

/**
 * El estado de los documentos de un perfil, **derivado del parámetro**: si
 * mañana se agrega un quinto requisito, aparece acá sin tocar código.
 */
export async function estadoDeDocumentos(perfilProfesionalId: string): Promise<EstadoDocumento[]> {
    const [requisitos, cargados] = await Promise.all([
        leerRequisitosVerificacion(),
        new DocumentoProfesionalRepository().listarPorPerfil(perfilProfesionalId),
    ]);
    const porClave = new Map(cargados.map((d) => [d.requisitoClave, d]));
    return requisitos.map((r) => {
        const doc = porClave.get(r.clave);
        return {
            clave: r.clave,
            nombre: r.nombre,
            descripcion: r.descripcion,
            cargado: doc !== undefined,
            extension: doc?.extension ?? null,
            subidoEn: doc ? doc.subidoEn.toISOString() : null,
        };
    });
}

/** Sube o reemplaza el documento de un requisito. La clave se valida contra el parámetro. */
export async function guardarDocumentoDeRequisito(
    perfilProfesionalId: string,
    requisitoClave: string,
    buffer: Buffer
) {
    const requisitos = await leerRequisitosVerificacion();
    if (!requisitos.some((r) => r.clave === requisitoClave)) {
        throw new AppError(
            "Ese requisito no existe en la lista configurada.",
            ERROR_CODES.VALIDATION_ERROR,
            400
        );
    }
    const validacion = validarAutorizacion(buffer);
    if (!validacion.ok) {
        throw new AppError(validacion.motivo, ERROR_CODES.VALIDATION_ERROR, 400);
    }
    // Mismo storage que la autorización: cifrado, nombre opaco, 5 MB, magia de
    // bytes. No se reescribe criptografía.
    const guardado = await guardarAutorizacion(buffer, validacion.extension);
    return new DocumentoProfesionalRepository().guardar({
        perfilProfesionalId,
        requisitoClave,
        archivoId: guardado.archivoId,
        extension: guardado.extension,
        sha256: guardado.sha256,
    });
}

/** El `archivoId` de una clave: o la autorización del perfil, o un requisito. */
async function archivoIdDe(perfilProfesionalId: string, clave: string): Promise<string> {
    if (clave === CLAVE_AUTORIZACION) {
        const perfil = await new PerfilProfesionalRepository().findPorId(perfilProfesionalId);
        if (!perfil?.autorizacionArchivoId) {
            throw new AppError("Sin autorización cargada.", ERROR_CODES.NOT_FOUND, 404);
        }
        return perfil.autorizacionArchivoId;
    }
    const doc = await new DocumentoProfesionalRepository().buscar(perfilProfesionalId, clave);
    if (!doc) throw new AppError("Sin documento cargado para ese requisito.", ERROR_CODES.NOT_FOUND, 404);
    return doc.archivoId;
}

/**
 * Descifra y devuelve el documento, dejando la fila de auditoría.
 *
 * `quienUsuarioId` es quien mira (dueño, verificador o admin) — la autorización
 * ya la resolvió el llamador; acá se registra y se sirve. El `Content-Type` sale
 * del CONTENIDO descifrado, no de una columna: un dato guardado puede mentir.
 */
export async function servirDocumento(params: {
    perfilProfesionalId: string;
    clave: string;
    quienUsuarioId: string;
    comoRol: string;
}): Promise<DocumentoServido> {
    const archivoId = await archivoIdDe(params.perfilProfesionalId, params.clave);
    const buffer = await leerAutorizacion(archivoId);

    // H-2 · la fila va ANTES de devolver el contenido. Si esto falla, no se
    // sirve: un documento reservado que se abre sin rastro no se puede defender.
    await logAudit({
        accion: "PROFESIONAL_AUTORIZACION_ACCESO",
        tipoRecurso: "PerfilProfesional",
        recursoId: params.perfilProfesionalId,
        usuarioId: params.quienUsuarioId,
        metadatos: { documento: params.clave, rol: params.comoRol },
        ipAddress: "app",
        userAgent: "profesional/documentos",
    });

    const deteccion = validarAutorizacion(buffer);
    const extension: ExtensionAutorizacion = deteccion.ok ? deteccion.extension : "pdf";
    return {
        buffer,
        contentType: CONTENT_TYPE[extension],
        nombreDescarga: `${params.clave}.${extension}`,
    };
}
