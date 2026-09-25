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
import type { EstadoPerfilProfesional } from "@prisma/client";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import { PerfilProfesionalRepository } from "@/lib/dal/repositories/perfil-profesional";
import { DocumentoProfesionalRepository } from "@/lib/dal/repositories/documento-profesional";
import { leerRequisitosVerificacion, type ItemChecklist } from "@/lib/profesionales/verificador/requisitos";
import {
    guardarAutorizacion,
    leerAutorizacion,
    validarArchivoSubido,
    detectarFormato,
    type ExtensionAutorizacion,
} from "./autorizacion-storage";
import { topeDocumentosMb } from "./tope-subida";

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
    /**
     * SPEC-693 (I-416): el profesional subió una versión NUEVA de este requisito que
     * está esperando revisión (hay un documento EN_REVISION). La pantalla lo pinta como
     * «En revisión — envió un documento nuevo». Si además hay una versión vigente,
     * el profesional sigue atendiendo con ella mientras tanto.
     */
    enRevision: boolean;
    extension: string | null;
    subidoEn: string | null;
    /**
     * SPEC-707 · el documento fue APROBADO (CUMPLE) en la última revisión y el perfil
     * sigue en el ciclo (BORRADOR devuelto / EN_REVISION): el SERVIDOR bloquea su
     * reemplazo. La pantalla lo muestra bloqueado — solo el devuelto se vuelve a subir.
     * (Un ACTIVO/VENCIDO renueva su versión aprobada sin bloqueo — SPEC-693, no se toca.)
     */
    bloqueado: boolean;
    /**
     * SPEC-707 · si este requisito quedó NO_CUMPLE en la última devolución, el MOTIVO que
     * escribió el verificador — para mostrarlo JUNTO al documento devuelto. `null` si no
     * fue devuelto (o no hay devolución con observación).
     */
    observacion: string | null;
    /**
     * SPEC-707 · estado de revisión para la insignia de la pantalla (Diseño FORMA-SPEC707):
     * `aprobado` (✓ pino, bloqueado), `devuelto` (ámbar, con motivo, «Volver a subir»),
     * `en_revision` (solicitud en revisión, todo bloqueado), `null` (no aplica).
     */
    revision: RevisionDocumento;
}

/**
 * SPEC-707 · estado de revisión de UN documento del profesional, para la pantalla y el
 * bloqueo. `null` = no aplica (no muestra insignia de revisión ni bloquea).
 */
export type RevisionDocumento = "aprobado" | "devuelto" | "en_revision" | null;

/**
 * SPEC-707 · FUENTE ÚNICA: estado del perfil + resultado y checklist de la ÚLTIMA
 * verificación. Lo consumen el bloqueo (al subir) y la vista (`estadoDeDocumentos`), para
 * que «qué está bloqueado» y «qué se muestra bloqueado/con motivo» no puedan divergir.
 */
async function ultimaRevision(perfilProfesionalId: string): Promise<{
    estadoPerfil: EstadoPerfilProfesional;
    resultadoUltima: string | null;
    checklist: Record<string, ItemChecklist>;
}> {
    const p = await new PerfilProfesionalRepository().estadoYUltimaRevision(perfilProfesionalId);
    if (!p) throw new AppError("Perfil profesional no existe.", ERROR_CODES.NOT_FOUND, 404);
    const ultima = p.verificaciones[0];
    return {
        estadoPerfil: p.estado,
        resultadoUltima: ultima?.resultado ?? null,
        checklist: (ultima?.checklist ?? {}) as unknown as Record<string, ItemChecklist>,
    };
}

/**
 * SPEC-707 (Diseño FORMA-SPEC707) · el estado de revisión de un documento SEGÚN EL ESTADO
 * DE LA SOLICITUD, no solo del documento. Devuelve `revision` (la insignia/forma de la
 * pantalla) y `bloqueado` (lo que el SERVIDOR rechaza al subir):
 *  · EN_REVISION (esperando decisión): la pantalla es de solo lectura (`revision:"en_revision"`
 *    para todos); el servidor bloquea reemplazar los APROBADOS (radicado candado a). La primera
 *    carga real es en BORRADOR, así que el servidor no necesita bloquear los NO aprobados aquí —
 *    y la pantalla igual no ofrece botón. Coherente con SPEC-706 §4.
 *  · DEVUELTA (BORRADOR tras MAS_INFORMACION): solo el DEVUELTO (NO_CUMPLE) se vuelve a subir;
 *    los aprobados (y cualquier otro) quedan bloqueados en el servidor y en la pantalla.
 *  · Resto (borrador fresco, ACTIVO, VENCIDO…): no bloquea — la renovación del ACTIVO
 *    (SPEC-693) sigue permitida.
 */
function revisionDeDocumento(
    estadoPerfil: EstadoPerfilProfesional,
    resultadoUltima: string | null,
    item: ItemChecklist | undefined,
): { revision: RevisionDocumento; bloqueado: boolean; observacion: string | null } {
    const aprobado = item?.estado === "CUMPLE";
    // `bloqueado` es la regla del SERVIDOR (radicado candado a): NO reemplazar un documento
    // APROBADO mientras la solicitud está en el ciclo (en revisión o devuelta). La pantalla,
    // aparte, es de solo lectura durante EN_REVISION (via `revision`, Diseño FORMA-SPEC707) —
    // más estricta que el servidor, sin hueco: el servidor no bloquea subir un NO aprobado ahí
    // (la primera carga real ocurre en BORRADOR), pero la pantalla no ofrece el botón.
    if (estadoPerfil === "EN_REVISION") {
        return { revision: "en_revision", bloqueado: aprobado, observacion: null };
    }
    if (estadoPerfil === "BORRADOR" && resultadoUltima === "MAS_INFORMACION") {
        if (item?.estado === "NO_CUMPLE") {
            const observacion = item.observacion.trim() ? item.observacion.trim() : null;
            return { revision: "devuelto", bloqueado: false, observacion };
        }
        // Aprobado (o cualquier otro que no sea el devuelto): bloqueado — solo el devuelto se re-sube.
        return { revision: "aprobado", bloqueado: true, observacion: null };
    }
    return { revision: null, bloqueado: false, observacion: null };
}

/**
 * El estado de los documentos de un perfil, **derivado del parámetro**: si
 * mañana se agrega un quinto requisito, aparece acá sin tocar código.
 *
 * SPEC-693: un requisito puede tener a la vez una versión VIGENTE (la que respalda) y
 * una EN_REVISION (la nueva que espera revisión). Se muestra la más nueva que el
 * profesional ve (la pendiente si la hay; si no, la vigente) y se marca `enRevision`.
 */
export async function estadoDeDocumentos(perfilProfesionalId: string): Promise<EstadoDocumento[]> {
    const [requisitos, actuales, ctx] = await Promise.all([
        leerRequisitosVerificacion(),
        new DocumentoProfesionalRepository().listarPorPerfil(perfilProfesionalId),
        ultimaRevision(perfilProfesionalId),
    ]);
    type DocActual = (typeof actuales)[number];
    const porClave = new Map<string, { vigente?: DocActual; pendiente?: DocActual }>();
    for (const d of actuales) {
        const slot = porClave.get(d.requisitoClave) ?? {};
        if (d.estado === "VIGENTE") slot.vigente = d;
        else if (d.estado === "EN_REVISION") slot.pendiente = d;
        porClave.set(d.requisitoClave, slot);
    }
    return requisitos.map((r) => {
        const slot = porClave.get(r.clave);
        const mostrar = slot?.pendiente ?? slot?.vigente ?? null;
        // SPEC-707: el estado de revisión (aprobado/devuelto/en_revision + bloqueo + motivo)
        // según el estado de la SOLICITUD — la MISMA regla que aplica el bloqueo al subir.
        const { revision, bloqueado, observacion } = revisionDeDocumento(
            ctx.estadoPerfil,
            ctx.resultadoUltima,
            ctx.checklist[r.clave],
        );
        return {
            clave: r.clave,
            nombre: r.nombre,
            descripcion: r.descripcion,
            cargado: mostrar !== null,
            enRevision: slot?.pendiente !== undefined,
            extension: mostrar?.extension ?? null,
            subidoEn: mostrar ? mostrar.subidoEn.toISOString() : null,
            bloqueado,
            observacion,
            revision,
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
    const requisito = requisitos.find((r) => r.clave === requisitoClave);
    if (!requisito) {
        throw new AppError(
            "Ese requisito no existe en la lista configurada.",
            ERROR_CODES.VALIDATION_ERROR,
            400
        );
    }
    // SPEC-707 (radicado candado a): el SERVIDOR bloquea REEMPLAZAR UN APROBADO mientras la
    // solicitud está en el ciclo — EN_REVISION o DEVUELTA. Solo el devuelto (NO_CUMPLE) se
    // vuelve a subir. Va en el servidor (Jelkin lo probó: la pantalla no bastaba). El
    // ACTIVO/VENCIDO renueva su aprobado sin bloqueo (SPEC-693, no se toca). La pantalla, aparte,
    // es de solo lectura durante EN_REVISION (Diseño). MISMA regla que la vista
    // (`revisionDeDocumento`): «qué bloquea el servidor» y «qué muestra bloqueado» no divergen.
    const ctx = await ultimaRevision(perfilProfesionalId);
    const { revision, bloqueado } = revisionDeDocumento(ctx.estadoPerfil, ctx.resultadoUltima, ctx.checklist[requisitoClave]);
    if (bloqueado) {
        throw new AppError(
            revision === "en_revision"
                ? "Su solicitud está en revisión. No puede cambiar sus documentos hasta que el verificador decida."
                : "Este documento ya fue aprobado. Mientras revisamos su solicitud, solo puede volver a subir el que le devolvieron.",
            ERROR_CODES.VALIDATION_ERROR,
            409,
        );
    }
    // SPEC-726: el tope es el PARÁMETRO de documentos (no la constante), y el mensaje
    // nombra ESTE documento en usted — no «la autorización» (el defecto que vio Jelkin).
    const maxMb = await topeDocumentosMb();
    // Copy de Diseño: «Su {requisito} pesa más…». El requisito arranca con minúscula para
    // que fluya tras «Su» ("Su tarjeta profesional vigente…").
    const sujeto = `Su ${requisito.nombre.charAt(0).toLowerCase()}${requisito.nombre.slice(1)}`;
    const validacion = validarArchivoSubido(buffer, { maxBytes: maxMb * 1024 * 1024, maxMb, sujeto });
    if (!validacion.ok) {
        throw new AppError(validacion.motivo, ERROR_CODES.VALIDATION_ERROR, 400);
    }
    // Mismo storage que la autorización: cifrado, nombre opaco, magia de bytes.
    // No se reescribe criptografía.
    const guardado = await guardarAutorizacion(buffer, validacion.extension);
    return new DocumentoProfesionalRepository().guardar({
        perfilProfesionalId,
        requisitoClave,
        archivoId: guardado.archivoId,
        extension: guardado.extension,
        sha256: guardado.sha256,
    });
}

/**
 * SPEC-693 (I-416): qué VERSIÓN de un requisito servir. Sin especificar → la de por
 * defecto (`buscar`: vigente si hay, si no la pendiente) — el comportamiento de siempre.
 * La pantalla de comparar pide una versión concreta (vigente vs. nuevo) para poder
 * mostrarlas lado a lado.
 */
type VersionDocumento = "vigente" | "nuevo";

/** El `archivoId` de una clave: o la autorización del perfil, o un requisito. */
async function archivoIdDe(
    perfilProfesionalId: string,
    clave: string,
    version?: VersionDocumento,
): Promise<string> {
    if (clave === CLAVE_AUTORIZACION) {
        const perfil = await new PerfilProfesionalRepository().findPorId(perfilProfesionalId);
        if (!perfil?.autorizacionArchivoId) {
            throw new AppError("Sin autorización cargada.", ERROR_CODES.NOT_FOUND, 404);
        }
        return perfil.autorizacionArchivoId;
    }
    const repo = new DocumentoProfesionalRepository();
    const doc =
        version === "vigente"
            ? await repo.buscarVigente(perfilProfesionalId, clave)
            : version === "nuevo"
                ? await repo.buscarPendiente(perfilProfesionalId, clave)
                : await repo.buscar(perfilProfesionalId, clave);
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
    /** SPEC-693: versión concreta (vigente/nuevo); sin ella, la de por defecto. */
    version?: VersionDocumento;
}): Promise<DocumentoServido> {
    const archivoId = await archivoIdDe(params.perfilProfesionalId, params.clave, params.version);
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

    const deteccion = detectarFormato(buffer);
    const extension: ExtensionAutorizacion = deteccion.ok ? deteccion.extension : "pdf";
    return {
        buffer,
        contentType: CONTENT_TYPE[extension],
        nombreDescarga: `${params.clave}.${extension}`,
    };
}
