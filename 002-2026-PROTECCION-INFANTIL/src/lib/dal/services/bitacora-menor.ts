/**
 * A-70 · F10 — la bitácora del menor: la línea de tiempo de la protección.
 *
 * Valor declarado por Jelkin: responde "desde cuándo se está monitoreando".
 * Se arma de lo que YA existe —`AuditLog` (el histórico real, con fecha y
 * hora de cada cambio) más los `creadoEn` de las filas— sin modelo nuevo:
 * inventar una tabla de bitácora habría duplicado un registro que el sistema
 * ya lleva, y habría nacido vacía para los menores existentes.
 *
 * Esto es el LADO LECTURA. Qué enciende con el estado ACTUAL de la escritura
 * (verificado en fuente contra las rutas reales que usa la UI):
 *   · alta del menor y de cada cuenta ........ SÍ (de `creadoEn`).
 *   · cuenta activada / inactivada ........... SÍ (`cambiarEstadoIdentificador`
 *     audita `{activo}`; la ruta la llama directo).
 *   · menor pausado / reactivado ............. AÚN NO. La UI cambia el estado
 *     del hijo por `PATCH /api/padre/hijos/[id]` → `actualizarHijo`, que audita
 *     `{campos:["estado"]}` SIN el valor. El hito aparecerá cuando el lado
 *     escritura grabe el estado (SPEC-363, a cargo de PI-2). El lector ya lo
 *     espera: lee `estado` y, si no viene, no inventa el hito.
 *   · cuenta quitada ......................... AÚN NO. `desvincularIdentificador`
 *     BORRA la fila y hoy no deja en la auditoría de qué menor era. Necesita que
 *     el lado escritura grabe `{hijoId}` (sin dueño en SPEC-363; escalado al
 *     CEO). El lector ya lo espera por `{hijoId}` y omite lo inatribuible.
 */
import { prisma } from "../../prisma";
import { AppError, ERROR_CODES } from "../../errors";

export type TipoHitoBitacora =
    | "menor_registrado"
    | "menor_activado"
    | "menor_inactivado"
    | "identificador_asignado"
    | "identificador_activado"
    | "identificador_inactivado";

export interface HitoBitacora {
    tipo: TipoHitoBitacora;
    fecha: Date;
    /** Texto ya resuelto para el padre — la UI no arma frases. */
    descripcion: string;
    /** El identificador involucrado, cuando el hito es de uno. */
    identificador?: string;
}

export interface BitacoraMenor {
    hijoId: string;
    nombre: string;
    /** El hito más antiguo: "desde cuándo se está monitoreando". */
    monitoreadoDesde: Date | null;
    hitos: HitoBitacora[];
}

/** Forma laxa de los metadatos del AuditLog — nunca confiamos en su shape. */
function leerCampo(valor: unknown, campo: string): string | null {
    if (!valor || typeof valor !== "object") return null;
    const v = (valor as Record<string, unknown>)[campo];
    return typeof v === "string" ? v : null;
}

function leerBooleano(valor: unknown, campo: string): boolean | null {
    if (!valor || typeof valor !== "object") return null;
    const v = (valor as Record<string, unknown>)[campo];
    return typeof v === "boolean" ? v : null;
}

/**
 * Bitácora del menor. Boundary: la ficha es del padre dueño — 404 para otro
 * (la ficha de un menor no se comparte entre padres, SPEC-339).
 */
export async function bitacoraDelMenor(hijoId: string, usuarioId: string): Promise<BitacoraMenor> {
    const hijo = await prisma.hijo.findFirst({
        where: { id: hijoId, usuarioId },
        select: {
            id: true,
            nombre: true,
            estado: true,
            creadoEn: true,
            identificadores: {
                select: { id: true, valor: true, creadoEn: true },
                orderBy: { creadoEn: "asc" },
            },
        },
    });
    if (!hijo) {
        throw new AppError("Menor no encontrado", ERROR_CODES.NOT_FOUND, 404);
    }

    const hitos: HitoBitacora[] = [];

    // 1. El alta de la ficha — el punto de partida del monitoreo.
    hitos.push({
        tipo: "menor_registrado",
        fecha: hijo.creadoEn,
        descripcion: `Registraste a ${hijo.nombre} para cuidarlo`,
    });

    // 2. Alta de cada identificador (su `creadoEn` es el momento exacto).
    for (const ident of hijo.identificadores) {
        hitos.push({
            tipo: "identificador_asignado",
            fecha: ident.creadoEn,
            descripcion: `Agregaste la cuenta ${ident.valor} a su protección`,
            identificador: ident.valor,
        });
    }

    // 3. Cambios de estado desde la auditoría — lo que el `creadoEn` no cuenta.
    //
    //    OJO con las claves (verificado en `hijos/hijos.ts`): los eventos de la
    //    FICHA se auditan con `recursoId = hijoId`, pero los del IDENTIFICADOR
    //    con `recursoId = identificadorId`. Filtrar solo por hijoId dejaba fuera
    //    todo lo de las cuentas. Y `valorAnterior` no se escribe nunca en este
    //    módulo: el estado nuevo es todo lo que hay.
    const porIdentificador = new Map(hijo.identificadores.map((i) => [i.id, i.valor]));
    const auditoria = await prisma.auditLog.findMany({
        where: {
            usuarioId,
            accion: { in: ["HIJO_UPDATE", "HIJO_IDENTIFICADOR_DESVINCULADO"] },
            OR: [
                { tipoRecurso: "Hijo", recursoId: hijoId },
                { tipoRecurso: "IdentificadorHijo", recursoId: { in: [...porIdentificador.keys()] } },
                // El desvinculado BORRA su fila: ya no está en el map de arriba y
                // su única atadura al menor es el hijoId del metadato.
                { tipoRecurso: "IdentificadorHijo", accion: "HIJO_IDENTIFICADOR_DESVINCULADO" },
            ],
        },
        orderBy: { creadoEn: "asc" },
        select: { accion: true, tipoRecurso: true, recursoId: true, creadoEn: true, valorNuevo: true },
    });

    for (const registro of auditoria) {
        let nuevo: unknown = null;
        try {
            nuevo = registro.valorNuevo ? JSON.parse(registro.valorNuevo) : null;
        } catch {
            // Metadato sin JSON válido: el hito se omite antes que mostrar basura.
            continue;
        }

        if (registro.accion === "HIJO_IDENTIFICADOR_DESVINCULADO") {
            // Los registros viejos (anteriores a F10) no llevan hijoId: no se
            // pueden atribuir a NINGÚN menor, y ponerlos en la bitácora de este
            // sería mentir con la cuenta de otro hijo. Se omiten.
            if (leerCampo(nuevo, "hijoId") !== hijoId) continue;
            hitos.push({
                tipo: "identificador_inactivado",
                fecha: registro.creadoEn,
                // El valor no viaja en la auditoría (es PII) y la fila ya no
                // existe: se nombra el hecho, no la cuenta.
                descripcion: "Quitaste una cuenta de su protección",
            });
            continue;
        }

        if (registro.tipoRecurso === "IdentificadorHijo") {
            const valor = registro.recursoId ? porIdentificador.get(registro.recursoId) : undefined;
            if (!valor) continue;
            const activo = leerBooleano(nuevo, "activo");
            // El alta ya entró por `creadoEn` (`{hijoId, agregado:true}` no trae
            // `activo`): sin este descarte saldría el mismo hito dos veces.
            if (activo === null) continue;
            hitos.push({
                tipo: activo ? "identificador_activado" : "identificador_inactivado",
                fecha: registro.creadoEn,
                descripcion: activo
                    ? `Volviste a vigilar la cuenta ${valor}`
                    : `Dejaste de vigilar la cuenta ${valor}`,
                identificador: valor,
            });
            continue;
        }

        // HIJO_UPDATE de la ficha entra solo si cambió el ESTADO; las
        // correcciones de datos (`{campos:[...]}`) no son parte de la
        // línea de la protección.
        const estadoNuevo = leerCampo(nuevo, "estado");
        if (!estadoNuevo) continue;

        hitos.push({
            tipo: estadoNuevo === "activo" ? "menor_activado" : "menor_inactivado",
            fecha: registro.creadoEn,
            descripcion:
                estadoNuevo === "activo"
                    ? `Reactivaste la protección de ${hijo.nombre}`
                    : `Pausaste la protección de ${hijo.nombre}`,
        });
    }

    hitos.sort((a, b) => a.fecha.getTime() - b.fecha.getTime());

    return {
        hijoId: hijo.id,
        nombre: hijo.nombre,
        monitoreadoDesde: hitos[0]?.fecha ?? null,
        hitos,
    };
}
