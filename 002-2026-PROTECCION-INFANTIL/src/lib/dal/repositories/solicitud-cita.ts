/**
 * SPEC-395 (L4) · Repositorio de SolicitudCita.
 * Q-3: acceso a Prisma vive acá; los routes y el service llaman al repo.
 */
import type {
    EstadoSolicitudCita,
    Prisma,
    SolicitudCita,
} from "@prisma/client";
import { prisma } from "../prisma";
import type { DbClient } from "../unit-of-work";
import { logger } from "@/lib/logger";

const INCLUDE_PADRE_PARA_PROFESIONAL = {
    padreUsuario: { select: { id: true, nombre: true, email: true } },
    franja: { select: { inicio: true, fin: true, modalidad: true } },
} as const;

const INCLUDE_PARA_PADRE = {
    profesional: {
        include: {
            ciudad: { select: { id: true, nombre: true } },
            usuario: { select: { email: true, telefono: true } },
        },
    },
    franja: { select: { inicio: true, fin: true, modalidad: true } },
} as const;

/**
 * SPEC-750 (FR-013) · PROYECCIÓN por defecto: las vistas de ADMIN de pagos (por-aprobar
 * y vencidas) NO exponen el enlace de la sesión ni su operador. Son estados SIN sesión
 * (SIN_CONFIRMAR / VENCIDA_SIN_RESPUESTA), así que hoy el enlace es null — pero se
 * proyecta A CONCIENCIA (no por descuido): esas consultas usan `include`, que devuelve
 * todos los escalares; sin este recorte el enlace viajaría a la vista admin el día que
 * un estado lo tenga. Si alguien lo necesita, que lo pida con la razón.
 */
function sinCamposEnlaceSesion<T>(cita: T): Omit<T, "enlaceReunion" | "enlaceOperadorId" | "enlacePublicadoEn"> {
    const copia = { ...(cita as Record<string, unknown>) };
    delete copia.enlaceReunion;
    delete copia.enlaceOperadorId;
    delete copia.enlacePublicadoEn;
    return copia as Omit<T, "enlaceReunion" | "enlaceOperadorId" | "enlacePublicadoEn">;
}

export class SolicitudCitaRepository {
    private readonly db: DbClient;
    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    crear(data: Prisma.SolicitudCitaCreateInput) {
        return this.db.solicitudCita.create({ data, include: INCLUDE_PARA_PADRE });
    }

    findById(id: string): Promise<SolicitudCita | null> {
        return this.db.solicitudCita.findUnique({ where: { id } });
    }

    /**
     * SPEC-832 · lo MÍNIMO para calcular a QUIÉN se reubica ESTA cita: la ventana y modalidad de su franja,
     * y del profesional que SALE (A) sus `especialidades` (el área del calce se deriva de A — la cita nunca
     * capturó el área que requería) y su `ciudadId` (pesa solo en PRESENCIAL). NO trae el relato
     * (`presentacion`) ni la PII de la familia: minimización (FORMA §3) — el matcher no los necesita.
     */
    findParaReubicacion(id: string) {
        return this.db.solicitudCita.findUnique({
            where: { id },
            select: {
                id: true,
                estado: true,
                profesionalId: true,
                franja: { select: { inicio: true, fin: true, modalidad: true } },
                profesional: { select: { especialidades: true, ciudadId: true } },
            },
        });
    }

    /**
     * SPEC-814 · Insumo de la COLA de reubicación: TODAS las citas CONFIRMADA con lo MÍNIMO para
     * decidir si quedaron huérfanas (el `usuarioId` del profesional, para preguntarle a la fuente
     * única si sigue habilitado) y para pintarlas (franja, nombre + especialidades de A —la base
     * del calce §1-bis—, y ciudad solo para las presenciales). El servicio filtra a las de un
     * profesional NO habilitado.
     *
     * Minimización por PROYECCIÓN (FORMA §3, como el DTO del operador): NO trae `presentacion`
     * (el relato) ni nada de `padreUsuario` (la PII de la familia) — no es un `omit` de render,
     * es que el dato no sale de la base.
     */
    listarConfirmadasParaReubicacion() {
        return this.db.solicitudCita.findMany({
            where: { estado: "CONFIRMADA" },
            orderBy: { franja: { inicio: "asc" } },
            select: {
                id: true,
                franja: { select: { inicio: true, fin: true, modalidad: true } },
                profesional: {
                    select: {
                        id: true, // SPEC-814: para el chequeo REPS por-modalidad (esRepsElegibleParaModalidad).
                        usuarioId: true,
                        nombreVisible: true,
                        especialidades: true,
                        ciudad: { select: { nombre: true } },
                    },
                },
            },
        });
    }

    findParaPadre(id: string, padreUsuarioId: string) {
        return this.db.solicitudCita.findFirst({
            where: { id, padreUsuarioId },
            include: INCLUDE_PARA_PADRE,
        });
    }

    findParaProfesional(id: string, profesionalId: string) {
        return this.db.solicitudCita.findFirst({
            where: { id, profesionalId },
            include: INCLUDE_PADRE_PARA_PROFESIONAL,
        });
    }

    listarPorPadre(padreUsuarioId: string) {
        return this.db.solicitudCita.findMany({
            where: { padreUsuarioId },
            include: INCLUDE_PARA_PADRE,
            orderBy: { creadoEn: "desc" },
            take: 100,
        });
    }

    listarPorProfesional(profesionalId: string, estados?: EstadoSolicitudCita[]) {
        return this.db.solicitudCita.findMany({
            where: { profesionalId, ...(estados ? { estado: { in: estados } } : {}) },
            include: INCLUDE_PADRE_PARA_PROFESIONAL,
            orderBy: { creadoEn: "desc" },
            take: 100,
        });
    }

    /**
     * SPEC-425 (L5): el marcador del panel se cuenta EN LA BASE, no sobre
     * `listarPorProfesional` — ese método tiene `take: 100` y a partir de la
     * solicitud 101 el contador empezaría a mentir sin avisar. Un número que
     * se ve bien y no lo está es peor que no mostrarlo.
     */
    contarPorProfesional(profesionalId: string, estados?: EstadoSolicitudCita[]): Promise<number> {
        return this.db.solicitudCita.count({
            where: { profesionalId, ...(estados ? { estado: { in: estados } } : {}) },
        });
    }

    /**
     * Familias DISTINTAS que el profesional atendió. Una familia que pidió tres
     * citas es una familia, no tres — el marcador cuenta personas, no filas.
     */
    async contarFamiliasAtendidas(
        profesionalId: string,
        estados: EstadoSolicitudCita[],
    ): Promise<number> {
        const filas = await this.db.solicitudCita.groupBy({
            by: ["padreUsuarioId"],
            where: { profesionalId, estado: { in: estados } },
        });
        return filas.length;
    }

    async listarPendientesAprobacionPago() {
        const rows = await this.db.solicitudCita.findMany({
            where: { estado: "SIN_CONFIRMAR", pagoAprobadoEn: null },
            include: {
                padreUsuario: { select: { id: true, nombre: true, email: true } },
                profesional: { select: { id: true, nombreVisible: true, tarifaConsultaCOP: true } },
                franja: { select: { inicio: true, fin: true, modalidad: true } },
            },
            orderBy: { creadoEn: "asc" },
            take: 200,
        });
        // SPEC-750 (FR-013): no exponer el enlace de la sesión a la vista admin.
        return rows.map(sinCamposEnlaceSesion);
    }

    /**
     * SPEC-658 (I-393) · vista de ADMIN: citas donde el padre PAGÓ y el profesional
     * dejó pasar las 48 h → `estado = VENCIDA_SIN_RESPUESTA ∧ pagoAprobadoEn presente`.
     * Hay dinero que alguien tiene que MIRAR (si se devuelve, cuánto y cuándo lo
     * decide Jelkin, aparte — I-393). Solo VISIBILIDAD: no decide ni mueve plata.
     *
     * Asimetría D-137, y es lo que sostiene el candado: NO incluye el no-asistió del
     * PADRE (`NO_ASISTIO_PADRE`) —solo el silencio del PROFESIONAL se reembolsa— ni
     * las impagas (`pagoAprobadoEn: null`). Si esta consulta se afloja, el producto
     * mostraría como «por devolver» lo que Jelkin decidió no devolver.
     */
    async listarVencidasConPagoParaAdmin() {
        // El tope NO pagina (la paginación va aparte: cursor por `actualizadoEn` +
        // índice parcial). Pero un tope CALLADO sobre dinero por devolver es una
        // trampa: al superar 200, las citas más VIEJAS dejan de verse —dinero que
        // nadie mira sobre una pantalla que se ve sana con 200 filas llenas—. Por eso
        // se compara el total real contra el tope y se DEJA UN AVISO: no arregla el
        // corte, lo vuelve visible (SPEC-658).
        const TOPE = 200;
        const where: Prisma.SolicitudCitaWhereInput = { estado: "VENCIDA_SIN_RESPUESTA", pagoAprobadoEn: { not: null } };
        const [total, items] = await Promise.all([
            this.db.solicitudCita.count({ where }),
            this.db.solicitudCita.findMany({
                where,
                include: {
                    padreUsuario: { select: { id: true, nombre: true, email: true } },
                    profesional: { select: { id: true, nombreVisible: true } },
                    franja: { select: { inicio: true, fin: true, modalidad: true } },
                },
                orderBy: { actualizadoEn: "desc" },
                take: TOPE,
            }),
        ]);
        if (total > TOPE) {
            logger.warn(
                `[citas-vencidas-admin] ${total} citas pagadas sin respuesta superan el tope ${TOPE}; ${total - TOPE} no se listan (paginación radicada aparte).`,
            );
        }
        return items;
    }

    listarVencidasSinAvisar48h(ahora: Date) {
        // Candidatas al aviso 48h: PAGADA_PENDIENTE con pagoAprobadoEn + 48h ya pasado.
        // El candado de repetición vive en el service (compara con audit).
        const hace48h = new Date(ahora.getTime() - 48 * 60 * 60 * 1000);
        return this.db.solicitudCita.findMany({
            where: {
                estado: "PAGADA_PENDIENTE",
                pagoAprobadoEn: { lte: hace48h },
            },
            include: INCLUDE_PARA_PADRE,
            take: 200,
        });
    }

    listarSinConfirmarConPlazoVencido(ahora: Date) {
        return this.db.solicitudCita.findMany({
            where: {
                estado: "SIN_CONFIRMAR",
                pagoAprobadoEn: null,
                venceEn: { lt: ahora },
            },
            take: 200,
        });
    }

    contarConsecutivasVencidasPorProfesional(profesionalId: string): Promise<number> {
        // «Consecutivas» = últimas N solicitudes cerradas del profesional donde
        // TODAS son VENCIDA_SIN_RESPUESTA (la primera confirmada corta la racha).
        // Se cuenta desde la más reciente hasta encontrar una que NO sea vencida.
        // (Implementación: se traen las últimas 50 y se cuenta el prefijo).
        return this.db.solicitudCita
            .findMany({
                where: {
                    profesionalId,
                    estado: { in: ["VENCIDA_SIN_RESPUESTA", "CONFIRMADA", "CUMPLIDA", "NO_ASISTIO_PADRE"] },
                },
                select: { estado: true },
                orderBy: { actualizadoEn: "desc" },
                take: 50,
            })
            .then((rows) => {
                let n = 0;
                for (const r of rows) {
                    if (r.estado === "VENCIDA_SIN_RESPUESTA") n += 1;
                    else break;
                }
                return n;
            });
    }

    async tasaVencimientos(profesionalId: string, desdeUltimosN = 30): Promise<{ total: number; vencidas: number; tasa: number }> {
        const rows = await this.db.solicitudCita.findMany({
            where: {
                profesionalId,
                estado: { in: ["VENCIDA_SIN_RESPUESTA", "CONFIRMADA", "CUMPLIDA", "NO_ASISTIO_PADRE", "REPROGRAMADA"] },
            },
            select: { estado: true },
            orderBy: { actualizadoEn: "desc" },
            take: desdeUltimosN,
        });
        const total = rows.length;
        const vencidas = rows.filter((r) => r.estado === "VENCIDA_SIN_RESPUESTA").length;
        const tasa = total === 0 ? 0 : vencidas / total;
        return { total, vencidas, tasa };
    }

    marcarPagoAprobado(id: string, pagoAprobadoEn: Date) {
        return this.db.solicitudCita.update({
            where: { id },
            data: {
                pagoAprobadoEn,
                estado: "PAGADA_PENDIENTE",
            },
        });
    }

    marcarConfirmada(id: string) {
        return this.db.solicitudCita.update({ where: { id }, data: { estado: "CONFIRMADA" } });
    }

    marcarVencida48h(id: string) {
        return this.db.solicitudCita.update({ where: { id }, data: { estado: "VENCIDA_SIN_RESPUESTA" } });
    }

    marcarReprogramadaOriginal(id: string) {
        return this.db.solicitudCita.update({ where: { id }, data: { estado: "REPROGRAMADA" } });
    }

    marcarNoAsistioProfesional(id: string) {
        return this.db.solicitudCita.update({ where: { id }, data: { estado: "NO_ASISTIO_PROFESIONAL" } });
    }

    /**
     * SPEC-780 · Datos mínimos para decidir la rectificación del relato: existencia + si la fila
     * tiene SUCESOR en la cadena de reprogramación (`reprogramaciones` = filas cuya
     * `solicitudPreviaId` es ésta). Una fila con sucesor es un pedido ANTERIOR (historial): su
     * relato es el registro de lo que se dijo entonces y NO se corrige.
     */
    findParaCorreccionRelato(id: string) {
        return this.db.solicitudCita.findUnique({
            where: { id },
            select: { id: true, estado: true, _count: { select: { reprogramaciones: true } } },
        });
    }

    /** SPEC-780 · Corrige el relato (`presentacion`) de UNA solicitud (la viva). Solo este campo. */
    corregirRelato(id: string, presentacion: string) {
        return this.db.solicitudCita.update({ where: { id }, data: { presentacion } });
    }

    // ── SPEC-750 · asignación con simultaneidad, calendario y enlace del operador ──────
    /** Cita mínima para decidir la asignación (estado + operador + ventana). */
    findParaAsignacion(id: string) {
        return this.db.solicitudCita.findUnique({
            where: { id },
            select: { id: true, estado: true, enlaceOperadorId: true, franja: { select: { inicio: true, fin: true } } },
        });
    }

    /** ¿El operador tiene alguna cita en `estados` que se solape con `[inicio, fin)`? */
    async operadorTieneSolape(operadorId: string, inicio: Date, fin: Date, estados: EstadoSolicitudCita[]): Promise<boolean> {
        const solapada = await this.db.solicitudCita.findFirst({
            where: { enlaceOperadorId: operadorId, estado: { in: estados }, franja: { inicio: { lt: fin }, fin: { gt: inicio } } },
            select: { id: true },
        });
        return solapada !== null;
    }

    /**
     * SPEC-779 · Sesiones VIGENTES del operador: las de `estados` cuya ventana aún NO terminó
     * (`franja.fin >= desde`). El corte por fecha es la mitad del arreglo: sin él, se contaban
     * TODAS las CONFIRMADA de siempre y la carga sólo crecía — para la segunda semana ninguna
     * cupo tenía sentido. Una sesión pasada no ocupa capacidad futura.
     */
    contarSesionesVigentesDeOperador(operadorId: string, estados: EstadoSolicitudCita[], desde: Date) {
        return this.db.solicitudCita.count({
            where: { enlaceOperadorId: operadorId, estado: { in: estados }, franja: { fin: { gte: desde } } },
        });
    }

    asignarOperador(id: string, operadorId: string) {
        return this.db.solicitudCita.update({ where: { id }, data: { enlaceOperadorId: operadorId } });
    }

    /** SPEC-750/T014 · Calendario del OPERADOR: sus citas CONFIRMADAS en la ventana, con
     *  `select` SIN `padreUsuario` — el operador no puede cargar PII del padre (imposibilidad
     *  estructural, no `omit` en render). Filtra por FECHA, no por hora: sin riel horario. */
    listarSesionesDeOperador(operadorId: string, desde: Date, hasta: Date) {
        return this.db.solicitudCita.findMany({
            where: { enlaceOperadorId: operadorId, estado: "CONFIRMADA", franja: { inicio: { gte: desde, lt: hasta } } },
            orderBy: { franja: { inicio: "asc" } },
            select: {
                id: true,
                enlaceReunion: true,
                enlacePublicadoEn: true,
                franja: { select: { inicio: true, fin: true, modalidad: true } },
                profesional: { select: { nombreVisible: true } },
            },
        });
    }

    /** SPEC-750/T014 · Capacidad al admin: citas CONFIRMADAS SIN operador asignado (el trigger
     *  no encontró operador libre). El admin las ve «antes del día». Sin PII de más: lo mínimo
     *  para que un humano las resuelva. */
    listarCitasSinOperador() {
        return this.db.solicitudCita.findMany({
            where: { estado: "CONFIRMADA", enlaceOperadorId: null },
            orderBy: { franja: { inicio: "asc" } },
            select: {
                id: true,
                franja: { select: { inicio: true, fin: true, modalidad: true } },
                profesional: { select: { nombreVisible: true } },
            },
        });
    }

    /** Cita mínima para publicar el enlace (guardia de dueño + estado). */
    findParaPublicarEnlace(id: string) {
        return this.db.solicitudCita.findUnique({
            where: { id },
            select: { id: true, estado: true, enlaceOperadorId: true },
        });
    }

    publicarEnlace(id: string, url: string, publicadoEn: Date) {
        return this.db.solicitudCita.update({
            where: { id },
            data: { enlaceReunion: url, enlacePublicadoEn: publicadoEn },
        });
    }
}
