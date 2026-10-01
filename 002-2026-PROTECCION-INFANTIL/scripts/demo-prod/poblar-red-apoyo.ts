#!/usr/bin/env tsx
 
/**
 * SPEC-676 · Poblador de la Red de Apoyo (PRODUCCIÓN demo).
 *
 * v5 dejó la Red de Apoyo vacía a propósito (orden del 03-09, levantada por
 * Jelkin el 11-09). Este script la puebla con MOVIMIENTO real: profesionales
 * visibles y reservables + citas repartidas en los DIEZ estados de
 * `SolicitudCita`, para que se puedan probar agenda, citas, vencimientos,
 * reembolsos y encuestas, y para que la analítica de BI signifique algo.
 *
 * Diseño LOCKED con Datos (volúmenes) y el CEO (reconciliaciones). Ver
 * `scripts/demo-prod/lib/red-apoyo-plan.ts` (lógica pura + candado).
 *
 * Invariantes respetados (medidos contra el producto):
 *  · VISIBILIDAD (SPEC-449): perfil ACTIVO + verificación APROBADO vigente + ≥1
 *    modalidad (I-398). Un profesional invisible sería peor que ninguno.
 *  · franja↔estado: la franja se toma al crear; SÓLO REPROGRAMADA y
 *    VENCIDA_SIN_RESPUESTA la liberan (los únicos `liberar()` del producto).
 *  · REPROGRAMADA es CADENA largo-1: fila nueva que hereda el pago
 *    (`pagoHeredadoDeId`), original → REPROGRAMADA + franja liberada. Largo-2 no
 *    lo produce el producto → no se siembra.
 *  · REUBICADA (SPEC-814, art. 19) es CADENA como REPROGRAMADA pero con OTRO
 *    profesional y franja OCUPADA (NO libera: el profesional dejó de estar
 *    disponible, la franja no vuelve al pool): original REUBICADA → hija CUMPLIDA
 *    que hereda el pago; la original prueba la continuidad (reubicadaEnId/En/PorId).
 *  · Reembolso (D-137): sólo de la población de silencio del profesional, NUNCA
 *    del no-asistió del padre. `montoTotal` ES el monto devuelto (reembolso total).
 *  · Montos del PARÁMETRO del admin (no constante): primera cita = precio estándar,
 *    resto = tarifa del profesional; servicio = comisión %.
 *  · Marcado en `demo_marcado` en la MISMA transacción (SPEC-412). `cuid()` real (I-292).
 *  · Cero correos: se siembra el estado final directo; no se dispara ningún flujo de aviso.
 *
 * Uso (dry-run por defecto):
 *   DEMO_PASSWORD=... node --env-file=.env --import tsx scripts/demo-prod/poblar-red-apoyo.ts [--confirm]
 *   --confirm escribe. NO hay --force (I-405): si la corrida ya existe, aborta. Purgar
 *   es un acto DELIBERADO y GLOBAL, aparte, con purgar-demo.ts — este poblador nunca
 *   lo invoca (candado de conducta del llamador).
 */
import type {
    Prisma,
    EstadoSolicitudCita,
    ModalidadCita,
    OperadorConvoco,
    InicioSesion,
    EnlaceFunciono,
    DuracionSesion,
    RazonNoSesion,
    PreguntaEncuesta,
} from "@prisma/client";
import { prisma } from "./lib/prisma";
// SPEC-753 · reloj legal del incidente (venceEn = reclamadoEn + 15 días hábiles).
// FUENTE canónica de días hábiles: sumarDiasHabilesColombia (SPEC-768, festivos-aware,
// Bogotá). Rama rebasada sobre main (trae 768) → dependencia DIRECTA del calculador
// correcto, sin pasar por el alias de apelaciones ni dejar deuda diferida.
import { sumarDiasHabilesColombia } from "@/lib/fechas/dias-habiles-colombia";
import { hashDemoPassword } from "./lib/password";
import { nombrePersona } from "./lib/datos";
import { obtenerPorcentajeServicio } from "@/lib/profesional/cita/comision";
import { leerPrecioEstandarPrimeraCita } from "@/lib/profesional/cita/precio-primera-cita";
import { verificacionDemo, REVISADO_HACE_DIAS } from "./lib/profesional-demo";
import { asegurarVerificadorDemoSinAcceso } from "./lib/verificador-demo-sin-acceso";
import {
    derivarPerfilCatalogoSeed,
    leerListasCatalogo,
    combosRedApoyo,
    clavesRedApoyoParaIndice,
    type ClavesPerfilCatalogo,
} from "../lib/perfil-catalogo-seed";
import {
    CORRIDA_RED,
    SCRIPT_RED,
    EMAIL_VERIFICADOR_DEMO_RED,
    NUM_PROFESIONALES,
    FRANJAS_LIBRES_MIN,
    FRANJAS_LIBRES_MAX,
    VENTANA_MESES,
    OBJETIVO_ESTADOS,
    ENCUESTA_PUNTAJES,
    construirPlanEstados,
    franjaTomadaPara,
    esEstadoVivo,
    HORAS_CITA_VIVA_MIN,
    HORAS_CITA_VIVA_MAX,
    HORAS_PAGO_APROBADO,
    HORAS_PLAZO_PADRE,
    modalidadesDeProfesional,
    bucketActividad,
} from "./lib/red-apoyo-plan";
// SPEC-773 · hora de franja EN ZONA DE BOGOTÁ (fuente única; ver el módulo). Reemplaza el
// `setHours` (que en el contenedor UTC caía 4–9am Bogotá) y el «conservá la hora de la corrida».
import { franjaBogota, HORA_FRANJA_MIN, HORA_FRANJA_MAX } from "./lib/franja-hora-bogota";

const CONFIRM = process.argv.includes("--confirm");

type Tx = Prisma.TransactionClient;

// ── RNG determinista, sembrado por la corrida (independiente de datos.ts) ────
function mulberry32(seed: number): () => number {
    return function () {
        let t = (seed += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
function hashString(str: string): number {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}
const rnd = mulberry32(hashString(CORRIDA_RED));
const entero = (min: number, max: number) => Math.floor(rnd() * (max - min + 1)) + min;
function elegirPeso<T extends { peso: number }>(ops: readonly T[]): T {
    const total = ops.reduce((s, o) => s + o.peso, 0);
    let p = rnd() * total;
    for (const o of ops) {
        p -= o.peso;
        if (p <= 0) return o;
    }
    return ops[ops.length - 1]!;
}

const MS_DIA = 24 * 60 * 60 * 1000;
/** Fecha histórica dentro de la ventana (pasado); nunca futura. */
function fechaEnVentana(): Date {
    const dias = entero(1, VENTANA_MESES * 30);
    return new Date(Date.now() - dias * MS_DIA);
}
/** Franja a futuro (para CONFIRMADA y libres agendables). `hora` es la hora de atención
 *  pretendida, EN BOGOTÁ (se encaja en la ventana 7am–7pm por el helper). */
function fechaFutura(diasAdelante: number, hora: number): { inicio: Date; fin: Date } {
    const base = new Date();
    base.setDate(base.getDate() + diasAdelante);
    return franjaBogota(base, 50, hora);
}
/** Cita VIVA: creada hace pocas horas (reloj corriendo), FUERA de la ventana del barrido. */
function fechaVivaReciente(): Date {
    return new Date(Date.now() - entero(HORAS_CITA_VIVA_MIN, HORAS_CITA_VIVA_MAX) * 60 * 60 * 1000);
}

// ── Marcado en la MISMA transacción (SPEC-412) ──────────────────────────────
async function marcar(tx: Tx, entidad: string, entidadId: string, notas?: string): Promise<void> {
    await tx.demoMarcado.create({
        data: { entidad, entidadId, metadata: { corrida: CORRIDA_RED, script: SCRIPT_RED, ...(notas ? { notas } : {}) } },
    });
}

async function verificarIdempotencia(): Promise<void> {
    const existente = await prisma.demoMarcado.findFirst({
        where: { entidad: "PerfilProfesional", metadata: { path: ["corrida"], equals: CORRIDA_RED } },
    });
    if (!existente) return;
    // I-405: NO hay re-siembra parcial ni purga desde acá, y NO hay --force. Este
    // poblador NUNCA invoca a purgar-demo.ts (candado de conducta del llamador):
    // ese purgador NO filtra por corrida — borra TODO lo sembrado de TODAS las
    // corridas (colegios, alumnos, reportes, alertas, cuentas demo…), no solo la
    // Red de Apoyo. Volver a sembrar es un acto deliberado en dos pasos: purgar a
    // mano (global) y re-correr. El mensaje dice la verdad sobre el alcance.
    throw new Error(
        `[poblar-red-apoyo] Ya existe la corrida ${CORRIDA_RED}: no hay re-siembra parcial ni --force. ` +
            "Para re-sembrar hay que purgar deliberadamente con purgar-demo.ts, que borra TODO lo demo " +
            "de TODAS las corridas (no solo esta).",
    );
}

async function cargarBase() {
    // Sanity: la base debe estar sembrada. El ADMIN ya NO firma las verificaciones (I-418): las
    // firma un VERIFICADOR demo sin acceso; el chequeo se conserva como guarda de «corrió el seed».
    const admin = await prisma.usuario.findFirst({ where: { rol: "ADMIN" }, select: { id: true } });
    if (!admin) throw new Error("No hay ADMIN; correr seed primero");
    const ciudades = await prisma.ciudad.findMany({ take: 8, orderBy: { nombre: "asc" } });
    if (ciudades.length === 0) throw new Error("No hay ciudades base");
    const porcentajeServicio = await obtenerPorcentajeServicio();
    const precioEstandar = await leerPrecioEstandarPrimeraCita();
    return { ciudades, porcentajeServicio, precioEstandar };
}

interface ProfSembrado {
    perfilId: string;
    modalidades: ModalidadCita[];
    tarifa: number;
    bucket: "alta" | "media" | "baja";
}

function montos(esPrimera: boolean, tarifa: number, precioEstandar: number, pct: number) {
    const montoConsulta = esPrimera ? precioEstandar : tarifa;
    const montoServicio = Math.round((montoConsulta * pct) / 100);
    return { montoConsulta, montoServicio, montoTotal: montoConsulta + montoServicio, porcentajeServicio: pct };
}

function pagoAprobadoPara(estado: EstadoSolicitudCita, creadoEn: Date): Date | null {
    // SIN_CONFIRMAR = el padre aún no pagó (o el profesional no respondió); el resto pagó.
    if (estado === "SIN_CONFIRMAR") return null;
    return new Date(creadoEn.getTime() + HORAS_PAGO_APROBADO * 60 * 60 * 1000);
}

async function sembrarProfesional(
    idx: number,
    verificadorId: string,
    ciudadId: string,
    passwordHash: string,
    combos: ClavesPerfilCatalogo[],
): Promise<ProfSembrado> {
    const modalidades = modalidadesDeProfesional(idx);
    const bucket = bucketActividad(idx);
    const { nombre, apellidos } = nombrePersona(97000 + idx);
    const tarifa = entero(8, 20) * 10000; // 80.000–200.000 COP
    const revisadoEn = new Date(Date.now() - (REVISADO_HACE_DIAS + idx) * MS_DIA);
    const autorizacionSubidaEn = new Date(revisadoEn.getTime() - MS_DIA);
    const verif = verificacionDemo(revisadoEn);
    // SPEC-685 (seguimiento): claves VARIADAS por índice (no clonar el directorio) + doble escritura.
    const catalogo = await derivarPerfilCatalogoSeed(clavesRedApoyoParaIndice(idx, combos));

    return prisma.$transaction(async (tx) => {
        const usuario = await tx.usuario.create({
            data: {
                email: `soporte+redapoyo${String(idx + 1).padStart(3, "0")}@innovadataco.com`,
                nombre: `${nombre} ${apellidos}`,
                passwordHash,
                rol: "PROFESIONAL",
                estado: "activo",
                debeCambiarPassword: false,
            },
        });
        await marcar(tx, "Usuario", usuario.id, "PROFESIONAL Red de Apoyo");

        const perfil = await tx.perfilProfesional.create({
            data: {
                usuarioId: usuario.id,
                nombreVisible: `Dra. ${nombre} ${apellidos}`,
                // SPEC-685: claves del catálogo + etiquetas legado derivadas con la MISMA
                // función que la API (doble escritura). Nunca "" ni [].
                profesion: catalogo.profesion,
                areasAtencion: catalogo.areasAtencion,
                rangoEtario: catalogo.rangoEtario,
                tituloProfesional: catalogo.tituloProfesional,
                especialidades: catalogo.especialidades,
                ciudadId,
                atiendeVirtual: modalidades.includes("VIRTUAL"),
                atiendePresencial: modalidades.includes("PRESENCIAL"),
                aniosExperiencia: entero(2, 20),
                presentacion:
                    "Perfil DEMO de la Red de Apoyo. Acompaño a niñas, niños y adolescentes en situaciones de acoso y ansiedad, con enfoque en protección.",
                tarifaConsultaCOP: tarifa,
                duracionMinutos: 50,
                emiteFactura: true,
                estado: "ACTIVO",
                autorizacionArchivoId: `demo-autorizacion-redapoyo-${idx + 1}`,
                autorizacionSubidaEn,
            },
        });
        await marcar(tx, "PerfilProfesional", perfil.id);

        const verificacion = await tx.verificacionProfesional.create({
            data: {
                perfilProfesionalId: perfil.id,
                revisadoPorId: verificadorId,
                revisadoEn: verif.revisadoEn,
                checklist: { antecedentes: true, tarjetaProfesional: true, autorizacionFirmada: true },
                resultado: verif.resultado,
                autorizacionArchivoId: `demo-autorizacion-redapoyo-${idx + 1}`,
                venceEn: verif.venceEn,
            },
        });
        await marcar(tx, "VerificacionProfesional", verificacion.id);

        // Franjas libres futuras (tomada=false), en las modalidades del profesional.
        const libres = entero(FRANJAS_LIBRES_MIN, FRANJAS_LIBRES_MAX);
        for (let f = 0; f < libres; f++) {
            const { inicio, fin } = fechaFutura(f + 1, 9 + (f % 8));
            const franja = await tx.franjaDisponible.create({
                data: { profesionalId: perfil.id, inicio, fin, modalidad: modalidades[f % modalidades.length]!, tomada: false },
            });
            await marcar(tx, "FranjaDisponible", franja.id, "libre futura");
        }
        return { perfilId: perfil.id, modalidades, tarifa, bucket };
    });
}

// ── SPEC-753 · Encuestas de servicio que CRUZAN + incidente de contradicción ──────
// Se siembran junto a la PRIMERA cita CUMPLIDA del padre (mismo disparador que
// EncuestaPrimeraCita), en la MISMA tx (atómicas con la cita). Marcadas en la familia
// demo-prod → `ORDEN_BORRADO`. Los enums hacen el texto libre imposible por TIPO; la
// coherencia razón↔seRealizo y venceEn>reclamadoEn las sostiene la BD (CHECK + candado).
const PLAZO_REVERSION_DIAS_HABILES = 15; // art. 51 · reloj NUESTRO de reversión

type Servicio = { operador: OperadorConvoco; inicio: InicioSesion; enlace: EnlaceFunciono; duracion: DuracionSesion | null };
type DatosEncuesta = Servicio & { seRealizo: boolean; razonNoRealizo: RazonNoSesion | null };

const SERVICIO_OK: Servicio = { operador: "SI", inicio: "A_TIEMPO", enlace: "SI", duracion: "ENTRE_30_45" };
// SPEC-753: sin sesión → duracion NULL. DuracionSesion no tiene un miembro «no hubo sesión»;
// forzar MENOS_15 afirmaba que algo que no ocurrió duró <15 min (la mentira que Dev-3 midió).
// El CHECK duracion-IFF (duración presente sii seRealizo) rechaza cualquier otra cosa.
const SERVICIO_NO_SESION: Servicio = { operador: "NO_HUBO_OPERADOR", inicio: "NO_COMENZO", enlace: "NO_FUNCIONO", duracion: null };

const ESCENARIOS_ENCUESTA = [
    { tipo: "acuerdo", peso: 55 },
    { tipo: "divergencia_servicio", peso: 30 },
    { tipo: "divergencia_serealizo", peso: 15 },
] as const;

// Divergencia de servicio: el padre queda en SERVICIO_OK; el profesional difiere en UNA
// pregunta. padreValor = el valor OK de esa pregunta (así el incidente refleja las filas reales).
const DIVERGENCIAS_SERVICIO: readonly {
    pregunta: PreguntaEncuesta;
    padreValor: string;
    profesionalValor: string;
    profesional: Servicio;
}[] = [
    { pregunta: "OPERADOR", padreValor: "SI", profesionalValor: "NO_HUBO_OPERADOR", profesional: { ...SERVICIO_OK, operador: "NO_HUBO_OPERADOR" } },
    { pregunta: "INICIO", padreValor: "A_TIEMPO", profesionalValor: "CON_RETRASO", profesional: { ...SERVICIO_OK, inicio: "CON_RETRASO" } },
    { pregunta: "ENLACE", padreValor: "SI", profesionalValor: "CON_PROBLEMAS", profesional: { ...SERVICIO_OK, enlace: "CON_PROBLEMAS" } },
    { pregunta: "DURACION", padreValor: "ENTRE_30_45", profesionalValor: "MAS_45", profesional: { ...SERVICIO_OK, duracion: "MAS_45" } },
];

// Los 4 estados EFECTIVOS del incidente (estadoEfectivoIncidente), rotados de forma
// determinista para cobertura pareja de las pantallas y del reloj legal.
const ESTADOS_INCIDENTE = ["ABIERTO", "RESUELTO", "RESUELTO_TARDE", "VENCIDO"] as const;
let incidenteSeq = 0;
// Snapshot del Verificador (NO FK, por diseño: sobrevive a la baja de la cuenta).
const RESUELTO_POR_DEMO = "demo-verificador-red-apoyo";

/** Reloj legal para que el incidente caiga en un estado efectivo dado. Fechas RELATIVAS
 *  a `ahora` (nunca un ancla en fin de semana): el patrón que 768 dejó para sus tests. */
function relojIncidente(
    estado: (typeof ESTADOS_INCIDENTE)[number],
    ahora: Date,
): { reclamadoEn: Date; venceEn: Date; resueltoEn: Date | null } {
    if (estado === "ABIERTO") {
        const reclamadoEn = new Date(ahora.getTime() - 3 * MS_DIA);
        return { reclamadoEn, venceEn: sumarDiasHabilesColombia(reclamadoEn, PLAZO_REVERSION_DIAS_HABILES), resueltoEn: null };
    }
    // Los otros tres nacen de un reclamo viejo: el plazo (venceEn) ya quedó en el pasado.
    const reclamadoEn = new Date(ahora.getTime() - 40 * MS_DIA);
    const venceEn = sumarDiasHabilesColombia(reclamadoEn, PLAZO_REVERSION_DIAS_HABILES);
    if (estado === "RESUELTO") return { reclamadoEn, venceEn, resueltoEn: new Date(venceEn.getTime() - 3 * MS_DIA) }; // ≤ vence
    if (estado === "RESUELTO_TARDE") return { reclamadoEn, venceEn, resueltoEn: new Date(venceEn.getTime() + 4 * MS_DIA) }; // > vence
    return { reclamadoEn, venceEn, resueltoEn: null }; // VENCIDO: sin resolver, plazo pasado
}

const conteoCruce = { encuestasCita: 0, incidentes: 0 };

/**
 * Siembra el par de encuestas de servicio (PADRE + PROFESIONAL) de una cita CUMPLIDA y,
 * cuando el par diverge, el incidente de contradicción con su reloj legal. Corre DENTRO
 * de la tx de sembrarCita. Marca cada fila (familia demo-prod).
 */
async function sembrarEncuestasCruce(tx: Tx, solicitudId: string, ahora: Date): Promise<void> {
    const escenario = elegirPeso(ESCENARIOS_ENCUESTA).tipo;

    let padre: DatosEncuesta = { seRealizo: true, razonNoRealizo: null, ...SERVICIO_OK };
    let profesional: DatosEncuesta = { seRealizo: true, razonNoRealizo: null, ...SERVICIO_OK };
    let incidente: { pregunta: PreguntaEncuesta; padreValor: string; profesionalValor: string } | null = null;

    if (escenario === "divergencia_servicio") {
        const d = DIVERGENCIAS_SERVICIO[entero(0, DIVERGENCIAS_SERVICIO.length - 1)]!;
        profesional = { seRealizo: true, razonNoRealizo: null, ...d.profesional };
        incidente = { pregunta: d.pregunta, padreValor: d.padreValor, profesionalValor: d.profesionalValor };
    } else if (escenario === "divergencia_serealizo") {
        // El padre dice que NO se dio (con razón); el profesional dice que SÍ.
        padre = { seRealizo: false, razonNoRealizo: "OTRA_PARTE_NO_CONECTO", ...SERVICIO_NO_SESION };
        incidente = { pregunta: "SE_REALIZO", padreValor: "false", profesionalValor: "true" };
    }

    const encPadre = await tx.encuestaCita.create({ data: { solicitudId, origen: "PADRE", ...padre } });
    await marcar(tx, "EncuestaCita", encPadre.id, "encuesta padre");
    const encProf = await tx.encuestaCita.create({ data: { solicitudId, origen: "PROFESIONAL", ...profesional } });
    await marcar(tx, "EncuestaCita", encProf.id, "encuesta profesional");
    conteoCruce.encuestasCita += 2;

    if (incidente) {
        const estado = ESTADOS_INCIDENTE[incidenteSeq++ % ESTADOS_INCIDENTE.length]!;
        const { reclamadoEn, venceEn, resueltoEn } = relojIncidente(estado, ahora);
        const inc = await tx.incidenteContradiccionEncuesta.create({
            data: {
                solicitudId,
                pregunta: incidente.pregunta,
                padreValor: incidente.padreValor,
                profesionalValor: incidente.profesionalValor,
                reclamadoEn,
                venceEn,
                resueltoEn,
                resueltoPor: resueltoEn ? RESUELTO_POR_DEMO : null,
            },
        });
        await marcar(tx, "IncidenteContradiccionEncuesta", inc.id, `incidente ${estado}`);
        conteoCruce.incidentes += 1;
    }
}

/** Crea una franja + su SolicitudCita (+ encuesta si aplica) en UNA transacción. */
async function sembrarCita(opts: {
    prof: ProfSembrado;
    padreUsuarioId: string;
    estado: EstadoSolicitudCita;
    esPrimeraDelPadre: boolean;
    precioEstandar: number;
    pct: number;
    conEncuesta: boolean;
}): Promise<string> {
    const { prof, padreUsuarioId, estado, esPrimeraDelPadre, precioEstandar, pct, conEncuesta } = opts;
    const modalidad = prof.modalidades[entero(0, prof.modalidades.length - 1)]!;
    // Los estados VIVOS (CONFIRMADA, PAGADA_PENDIENTE, SIN_CONFIRMAR) se siembran
    // con reloj RECIENTE y cita a futuro para NO caer en la ventana de los barridos
    // de vencimiento/plazo (esEstadoVivo · candado #4): PAGADA_PENDIENTE queda con
    // el pago < 48 h y SIN_CONFIRMAR con `venceEn` futuro. El resto es histórico
    // (desenlace terminal, inerte al worker).
    const viva = esEstadoVivo(estado);
    const creadoEn = viva ? fechaVivaReciente() : fechaEnVentana();
    // La HORA de la franja va en zona de Bogotá (helper), no la del contenedor (UTC). El DÍA
    // conserva la semántica: futuro para vivas, creadoEn+2días para históricas — la lógica de
    // vivo/barrido va por creadoEn/venceEn, nunca por la hora de la franja.
    const { inicio, fin } = viva
        ? fechaFutura(entero(1, 20), 9 + entero(0, 8))
        : franjaBogota(new Date(creadoEn.getTime() + 2 * MS_DIA), 50, entero(HORA_FRANJA_MIN, HORA_FRANJA_MAX));
    const m = montos(esPrimeraDelPadre, prof.tarifa, precioEstandar, pct);

    return prisma.$transaction(async (tx) => {
        const franja = await tx.franjaDisponible.create({
            data: { profesionalId: prof.perfilId, inicio, fin, modalidad, tomada: franjaTomadaPara(estado) },
        });
        await marcar(tx, "FranjaDisponible", franja.id, `cita ${estado}`);

        const solicitud = await tx.solicitudCita.create({
            data: {
                padreUsuarioId,
                profesionalId: prof.perfilId,
                franjaId: franja.id,
                presentacion: "Solicitud DEMO de la Red de Apoyo (poblador SPEC-676).",
                urgencia: rnd() < 0.5 ? "ESTA_SEMANA" : "SIN_APURO",
                estado,
                venceEn: new Date(creadoEn.getTime() + HORAS_PLAZO_PADRE * 60 * 60 * 1000),
                pagoAprobadoEn: pagoAprobadoPara(estado, creadoEn),
                ...m,
                creadoEn,
            },
        });
        await marcar(tx, "SolicitudCita", solicitud.id, estado);

        if (conEncuesta) {
            const { puntaje } = elegirPeso(ENCUESTA_PUNTAJES);
            const encuesta = await tx.encuestaPrimeraCita.create({
                data: {
                    solicitudId: solicitud.id,
                    seDioLaCita: true,
                    puntaje,
                    volveria: puntaje >= 3,
                    respondidaEn: new Date(inicio.getTime() + MS_DIA),
                },
            });
            await marcar(tx, "EncuestaPrimeraCita", encuesta.id);
            // SPEC-753 · las dos encuestas de servicio (padre + profesional) + el
            // incidente si el par diverge. Misma tx que la cita.
            await sembrarEncuestasCruce(tx, solicitud.id, new Date());
        }
        return solicitud.id;
    });
}

/** Reprograma largo-1: la hija hereda el pago del original; el original queda REPROGRAMADA. */
async function sembrarReprogramacion(opts: {
    prof: ProfSembrado;
    padreUsuarioId: string;
    esPrimeraDelPadre: boolean;
    precioEstandar: number;
    pct: number;
}): Promise<void> {
    const { prof, padreUsuarioId, esPrimeraDelPadre, precioEstandar, pct } = opts;
    const modalidad = prof.modalidades[entero(0, prof.modalidades.length - 1)]!;
    const creadoEn = fechaEnVentana();
    const m = montos(esPrimeraDelPadre, prof.tarifa, precioEstandar, pct);

    await prisma.$transaction(async (tx) => {
        // Original: franja LIBERADA (REPROGRAMADA la libera), estado REPROGRAMADA.
        // Día = creadoEn+2; hora en zona de Bogotá (7am–7pm), no la del contenedor.
        const horaOrig = franjaBogota(new Date(creadoEn.getTime() + 2 * MS_DIA), 50, entero(HORA_FRANJA_MIN, HORA_FRANJA_MAX));
        const franjaOrig = await tx.franjaDisponible.create({
            data: {
                profesionalId: prof.perfilId,
                inicio: horaOrig.inicio,
                fin: horaOrig.fin,
                modalidad,
                tomada: false,
            },
        });
        await marcar(tx, "FranjaDisponible", franjaOrig.id, "cita REPROGRAMADA (liberada)");
        const original = await tx.solicitudCita.create({
            data: {
                padreUsuarioId,
                profesionalId: prof.perfilId,
                franjaId: franjaOrig.id,
                presentacion: "Solicitud DEMO reprogramada (poblador SPEC-676).",
                urgencia: "SIN_APURO",
                estado: "REPROGRAMADA",
                venceEn: new Date(creadoEn.getTime() + 72 * 60 * 60 * 1000),
                pagoAprobadoEn: new Date(creadoEn.getTime() + 6 * 60 * 60 * 1000),
                ...m,
                creadoEn,
            },
        });
        await marcar(tx, "SolicitudCita", original.id, "REPROGRAMADA");

        // Hija: franja NUEVA tomada, hereda el pago del original (sin cobro nuevo), CUMPLIDA.
        const creadoHija = new Date(creadoEn.getTime() + 3 * MS_DIA);
        const horaHija = franjaBogota(new Date(creadoHija.getTime() + 2 * MS_DIA), 50, entero(HORA_FRANJA_MIN, HORA_FRANJA_MAX));
        const franjaHija = await tx.franjaDisponible.create({
            data: {
                profesionalId: prof.perfilId,
                inicio: horaHija.inicio,
                fin: horaHija.fin,
                modalidad,
                tomada: true,
            },
        });
        await marcar(tx, "FranjaDisponible", franjaHija.id, "cita hija de reprogramación");
        const hija = await tx.solicitudCita.create({
            data: {
                padreUsuarioId,
                profesionalId: prof.perfilId,
                franjaId: franjaHija.id,
                presentacion: "Solicitud DEMO (hija de reprogramación, hereda pago).",
                urgencia: "SIN_APURO",
                estado: "CUMPLIDA",
                venceEn: new Date(creadoHija.getTime() + 72 * 60 * 60 * 1000),
                pagoAprobadoEn: new Date(creadoHija.getTime() + 6 * 60 * 60 * 1000),
                pagoHeredadoDeId: original.id,
                solicitudPreviaId: original.id,
                ...m, // hereda los montos del original (no re-cobra)
                creadoEn: creadoHija,
            },
        });
        await marcar(tx, "SolicitudCita", hija.id, "hija reprogramación (CUMPLIDA)");
    });
}

/**
 * SPEC-814 · actor de la reubicación demo (`reubicadaPorId`). En prod lo pone el OPERADOR/ADMIN que
 * hace el escalamiento manual; el demo NO siembra operadores, así que usa un SENTINEL ESTABLE: el
 * rastro del art. 19 es DURABLE (String sin FK) y a propósito NO resuelve a una cuenta — igual que en
 * prod, donde la cuenta del actor puede haberse borrado y la cita no (schema SolicitudCita.reubicadaPorId,
 * «las cuentas se borran, las citas no»). Derivado de CORRIDA_RED y ESTABLE entre corridas (no rota):
 * cualquier consumidor (BI) lee siempre el mismo rastro.
 */
const REUBICADA_POR_DEMO = `demo:${CORRIDA_RED}:operador-reubicacion`;

/**
 * Reubicación largo-1 (SPEC-814 · [NORMA] Ley 1581 art. 19): el profesional ORIGINAL dejó de estar
 * disponible, su cita confirmada queda REUBICADA (terminal) y la atención CONTINÚA en una fila NUEVA
 * con OTRO profesional que HEREDA el pago (sin re-cobro). A diferencia de REPROGRAMADA: (a) la franja
 * original NO se libera (`franjaTomadaPara("REUBICADA")` = true — el profesional ya no está), y (b) la
 * hija es con un profesional DISTINTO. La original cierra la prueba de continuidad del art. 19:
 * `reubicadaEnId` → la hija, `reubicadaEn`, `reubicadaPorId` (actor durable).
 */
async function sembrarReubicacion(opts: {
    profOrigen: ProfSembrado;
    profDestino: ProfSembrado;
    padreUsuarioId: string;
    esPrimeraDelPadre: boolean;
    precioEstandar: number;
    pct: number;
}): Promise<void> {
    const { profOrigen, profDestino, padreUsuarioId, esPrimeraDelPadre, precioEstandar, pct } = opts;
    const modalidadOrig = profOrigen.modalidades[entero(0, profOrigen.modalidades.length - 1)]!;
    const modalidadDest = profDestino.modalidades[entero(0, profDestino.modalidades.length - 1)]!;
    const creadoEn = fechaEnVentana();
    const m = montos(esPrimeraDelPadre, profOrigen.tarifa, precioEstandar, pct);

    await prisma.$transaction(async (tx) => {
        // Original: franja OCUPADA (REUBICADA no libera), estado REUBICADA (terminal).
        const horaOrig = franjaBogota(new Date(creadoEn.getTime() + 2 * MS_DIA), 50, entero(HORA_FRANJA_MIN, HORA_FRANJA_MAX));
        const franjaOrig = await tx.franjaDisponible.create({
            data: {
                profesionalId: profOrigen.perfilId,
                inicio: horaOrig.inicio,
                fin: horaOrig.fin,
                modalidad: modalidadOrig,
                tomada: franjaTomadaPara("REUBICADA"),
            },
        });
        await marcar(tx, "FranjaDisponible", franjaOrig.id, "cita REUBICADA (ocupada)");
        const original = await tx.solicitudCita.create({
            data: {
                padreUsuarioId,
                profesionalId: profOrigen.perfilId,
                franjaId: franjaOrig.id,
                presentacion: "Solicitud DEMO reubicada (poblador SPEC-676/814).",
                urgencia: "SIN_APURO",
                estado: "REUBICADA",
                venceEn: new Date(creadoEn.getTime() + 72 * 60 * 60 * 1000),
                pagoAprobadoEn: new Date(creadoEn.getTime() + 6 * 60 * 60 * 1000),
                ...m,
                creadoEn,
            },
        });
        await marcar(tx, "SolicitudCita", original.id, "REUBICADA");

        // Hija: profesional DISTINTO, franja NUEVA tomada, HEREDA el pago del original (sin re-cobro), CUMPLIDA.
        const creadoHija = new Date(creadoEn.getTime() + 3 * MS_DIA);
        const horaHija = franjaBogota(new Date(creadoHija.getTime() + 2 * MS_DIA), 50, entero(HORA_FRANJA_MIN, HORA_FRANJA_MAX));
        const franjaHija = await tx.franjaDisponible.create({
            data: {
                profesionalId: profDestino.perfilId,
                inicio: horaHija.inicio,
                fin: horaHija.fin,
                modalidad: modalidadDest,
                tomada: true,
            },
        });
        await marcar(tx, "FranjaDisponible", franjaHija.id, "cita hija de reubicación (otro profesional)");
        const hija = await tx.solicitudCita.create({
            data: {
                padreUsuarioId,
                profesionalId: profDestino.perfilId,
                franjaId: franjaHija.id,
                presentacion: "Solicitud DEMO (hija de reubicación, otro profesional, hereda pago).",
                urgencia: "SIN_APURO",
                estado: "CUMPLIDA",
                venceEn: new Date(creadoHija.getTime() + 72 * 60 * 60 * 1000),
                pagoAprobadoEn: new Date(creadoHija.getTime() + 6 * 60 * 60 * 1000),
                pagoHeredadoDeId: original.id,
                solicitudPreviaId: original.id,
                ...m, // hereda los montos del original (no re-cobra)
                creadoEn: creadoHija,
            },
        });
        await marcar(tx, "SolicitudCita", hija.id, "hija reubicación (CUMPLIDA, otro profesional)");

        // Cierra la prueba de continuidad del art. 19: la original APUNTA a la hija + actor/momento durables.
        await tx.solicitudCita.update({
            where: { id: original.id },
            data: { reubicadaEnId: hija.id, reubicadaEn: creadoHija, reubicadaPorId: REUBICADA_POR_DEMO },
        });
    });
}

interface Resumen {
    profesionales: number;
    franjasLibres: number;
    porEstado: Record<string, number>;
    encuestas: number;
    encuestasCita: number; // SPEC-753 · filas EncuestaCita (padre + profesional)
    incidentes: number; // SPEC-753 · IncidenteContradiccionEncuesta
    padres: number;
}

async function main(): Promise<void> {
    await verificarIdempotencia();
    const { ciudades, porcentajeServicio, precioEstandar } = await cargarBase();

    if (!CONFIRM) {
        const plan = construirPlanEstados();
        const porEstado: Record<string, number> = {};
        for (const e of plan) porEstado[e] = (porEstado[e] ?? 0) + 1;
        console.log("[poblar-red-apoyo] DRY-RUN (sin --confirm). Se sembraría:");
        console.log(`  profesionales: ${NUM_PROFESIONALES}`);
        console.log(`  comisión %: ${porcentajeServicio} · precio 1ª cita: ${precioEstandar}`);
        console.log("  citas por estado:", porEstado);
        console.log("  Ejecute con --confirm para escribir.");
        return;
    }

    const passwordHash = await hashDemoPassword();
    // I-418: las verificaciones sembradas las firma un VERIFICADOR demo SIN ACCESO (no un admin
    // real). Se crea una vez, marcado en esta corrida (se purga con ella), y firma las 50.
    const verificadorDemoId = await prisma.$transaction((tx) =>
        asegurarVerificadorDemoSinAcceso(tx, { corrida: CORRIDA_RED, script: SCRIPT_RED, email: EMAIL_VERIFICADOR_DEMO_RED }),
    );
    // SPEC-685 (seguimiento): combinaciones VARIADAS del catálogo vivo, resueltas una vez; cada
    // perfil toma una por índice (determinista). La doble escritura se deriva por perfil.
    const listas = await leerListasCatalogo();
    const combos = combosRedApoyo(listas);
    const resumen: Resumen = { profesionales: 0, franjasLibres: 0, porEstado: {}, encuestas: 0, encuestasCita: 0, incidentes: 0, padres: 0 };

    // 1) Profesionales visibles + franjas libres futuras.
    const profs: ProfSembrado[] = [];
    for (let i = 0; i < NUM_PROFESIONALES; i++) {
        const ciudadId = ciudades[i % ciudades.length]!.id;
        const p = await sembrarProfesional(i, verificadorDemoId, ciudadId, passwordHash, combos);
        profs.push(p);
        resumen.profesionales++;
    }

    // 2) Reparto de citas a profesionales, sesgado por bucket (que el ranking tenga forma).
    const peso = (b: ProfSembrado["bucket"]) => (b === "alta" ? 8 : b === "media" ? 3 : 1);
    const bolsa: number[] = [];
    profs.forEach((p, i) => {
        for (let k = 0; k < peso(p.bucket); k++) bolsa.push(i);
    });
    const elegirProf = () => profs[bolsa[entero(0, bolsa.length - 1)]!]!;
    // Para REUBICACIÓN: la hija va con OTRO profesional (el original dejó de estar disponible).
    const elegirProfDistinto = (excluir: ProfSembrado): ProfSembrado => {
        for (let i = 0; i < 20; i++) {
            const c = elegirProf();
            if (c.perfilId !== excluir.perfilId) return c;
        }
        return profs.find((p) => p.perfilId !== excluir.perfilId) ?? excluir;
    };

    // 3) Padres demo (pool propio → purga independiente). ~1 padre cada 3 citas.
    const plan = construirPlanEstados();
    const numPadres = Math.max(20, Math.ceil(plan.length / 3));
    const padres: string[] = [];
    for (let i = 0; i < numPadres; i++) {
        const { nombre, apellidos } = nombrePersona(98000 + i);
        const padre = await prisma.$transaction(async (tx) => {
            const u = await tx.usuario.create({
                data: {
                    email: `soporte+redpadre${String(i + 1).padStart(4, "0")}@innovadataco.com`,
                    nombre: `${nombre} ${apellidos}`,
                    passwordHash,
                    rol: "PARENT",
                    estado: "activo",
                    debeCambiarPassword: false,
                },
            });
            await marcar(tx, "Usuario", u.id, "PARENT Red de Apoyo");
            return u.id;
        });
        padres.push(padre);
        resumen.padres++;
    }
    const padreConCita = new Set<string>();
    const elegirPadre = () => padres[entero(0, padres.length - 1)]!;

    // 4) Sembrar cada cita del plan.
    for (const estado of plan) {
        const prof = elegirProf();
        const padreUsuarioId = elegirPadre();
        const esPrimeraDelPadre = !padreConCita.has(padreUsuarioId);
        padreConCita.add(padreUsuarioId);

        if (estado === "REPROGRAMADA") {
            await sembrarReprogramacion({ prof, padreUsuarioId, esPrimeraDelPadre, precioEstandar, pct: porcentajeServicio });
            resumen.porEstado.REPROGRAMADA = (resumen.porEstado.REPROGRAMADA ?? 0) + 1;
            resumen.porEstado.CUMPLIDA = (resumen.porEstado.CUMPLIDA ?? 0) + 1; // la hija
            continue;
        }
        if (estado === "REUBICADA") {
            const profDestino = elegirProfDistinto(prof);
            await sembrarReubicacion({ profOrigen: prof, profDestino, padreUsuarioId, esPrimeraDelPadre, precioEstandar, pct: porcentajeServicio });
            resumen.porEstado.REUBICADA = (resumen.porEstado.REUBICADA ?? 0) + 1;
            resumen.porEstado.CUMPLIDA = (resumen.porEstado.CUMPLIDA ?? 0) + 1; // la hija (otro profesional)
            continue;
        }
        // Encuesta sólo en la PRIMERA cita CUMPLIDA del padre.
        const conEncuesta = estado === "CUMPLIDA" && esPrimeraDelPadre;
        await sembrarCita({ prof, padreUsuarioId, estado, esPrimeraDelPadre, precioEstandar, pct: porcentajeServicio, conEncuesta });
        resumen.porEstado[estado] = (resumen.porEstado[estado] ?? 0) + 1;
        if (conEncuesta) resumen.encuestas++;
    }

    resumen.encuestasCita = conteoCruce.encuestasCita;
    resumen.incidentes = conteoCruce.incidentes;
    console.log("[poblar-red-apoyo] LISTO. Resumen:", JSON.stringify(resumen, null, 2));
}

main()
    .catch((e) => {
        console.error("[poblar-red-apoyo] ERROR:", e);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());

export type { Resumen };
