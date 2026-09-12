#!/usr/bin/env tsx
 
/**
 * SPEC-676 · Poblador de la Red de Apoyo (PRODUCCIÓN demo).
 *
 * v5 dejó la Red de Apoyo vacía a propósito (orden del 03-09, levantada por
 * Jelkin el 11-09). Este script la puebla con MOVIMIENTO real: profesionales
 * visibles y reservables + citas repartidas en los NUEVE estados de
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
import type { Prisma, EstadoSolicitudCita, ModalidadCita } from "@prisma/client";
import { prisma } from "./lib/prisma";
import { hashDemoPassword } from "./lib/password";
import { nombrePersona } from "./lib/datos";
import { obtenerPorcentajeServicio } from "@/lib/profesional/cita/comision";
import { leerPrecioEstandarPrimeraCita } from "@/lib/profesional/cita/precio-primera-cita";
import { verificacionDemo, REVISADO_HACE_DIAS } from "./lib/profesional-demo";
import {
    CORRIDA_RED,
    SCRIPT_RED,
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
/** Franja a futuro (para CONFIRMADA y libres agendables). */
function fechaFutura(diasAdelante: number, hora: number): { inicio: Date; fin: Date } {
    const inicio = new Date();
    inicio.setDate(inicio.getDate() + diasAdelante);
    inicio.setHours(hora, 0, 0, 0);
    return { inicio, fin: new Date(inicio.getTime() + 50 * 60 * 1000) };
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
    const admin = await prisma.usuario.findFirst({ where: { rol: "ADMIN" } });
    if (!admin) throw new Error("No hay ADMIN; correr seed primero");
    const ciudades = await prisma.ciudad.findMany({ take: 8, orderBy: { nombre: "asc" } });
    if (ciudades.length === 0) throw new Error("No hay ciudades base");
    const porcentajeServicio = await obtenerPorcentajeServicio();
    const precioEstandar = await leerPrecioEstandarPrimeraCita();
    return { admin, ciudades, porcentajeServicio, precioEstandar };
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
    adminId: string,
    ciudadId: string,
    passwordHash: string,
): Promise<ProfSembrado> {
    const modalidades = modalidadesDeProfesional(idx);
    const bucket = bucketActividad(idx);
    const { nombre, apellidos } = nombrePersona(97000 + idx);
    const tarifa = entero(8, 20) * 10000; // 80.000–200.000 COP
    const revisadoEn = new Date(Date.now() - (REVISADO_HACE_DIAS + idx) * MS_DIA);
    const autorizacionSubidaEn = new Date(revisadoEn.getTime() - MS_DIA);
    const verif = verificacionDemo(revisadoEn);

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
                tituloProfesional: "Psicóloga clínica",
                especialidades: ["Ansiedad infantil", "Acoso escolar"],
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
                revisadoPorId: adminId,
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
    const inicio = viva ? fechaFutura(entero(1, 20), 9 + entero(0, 8)).inicio : new Date(creadoEn.getTime() + 2 * MS_DIA);
    const fin = new Date(inicio.getTime() + 50 * 60 * 1000);
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
        const franjaOrig = await tx.franjaDisponible.create({
            data: {
                profesionalId: prof.perfilId,
                inicio: new Date(creadoEn.getTime() + 2 * MS_DIA),
                fin: new Date(creadoEn.getTime() + 2 * MS_DIA + 50 * 60 * 1000),
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
        const franjaHija = await tx.franjaDisponible.create({
            data: {
                profesionalId: prof.perfilId,
                inicio: new Date(creadoHija.getTime() + 2 * MS_DIA),
                fin: new Date(creadoHija.getTime() + 2 * MS_DIA + 50 * 60 * 1000),
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

interface Resumen {
    profesionales: number;
    franjasLibres: number;
    porEstado: Record<string, number>;
    encuestas: number;
    padres: number;
}

async function main(): Promise<void> {
    await verificarIdempotencia();
    const { admin, ciudades, porcentajeServicio, precioEstandar } = await cargarBase();

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
    const resumen: Resumen = { profesionales: 0, franjasLibres: 0, porEstado: {}, encuestas: 0, padres: 0 };

    // 1) Profesionales visibles + franjas libres futuras.
    const profs: ProfSembrado[] = [];
    for (let i = 0; i < NUM_PROFESIONALES; i++) {
        const ciudadId = ciudades[i % ciudades.length]!.id;
        const p = await sembrarProfesional(i, admin.id, ciudadId, passwordHash);
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
        // Encuesta sólo en la PRIMERA cita CUMPLIDA del padre.
        const conEncuesta = estado === "CUMPLIDA" && esPrimeraDelPadre;
        await sembrarCita({ prof, padreUsuarioId, estado, esPrimeraDelPadre, precioEstandar, pct: porcentajeServicio, conEncuesta });
        resumen.porEstado[estado] = (resumen.porEstado[estado] ?? 0) + 1;
        if (conEncuesta) resumen.encuestas++;
    }

    console.log("[poblar-red-apoyo] LISTO. Resumen:", JSON.stringify(resumen, null, 2));
}

main()
    .catch((e) => {
        console.error("[poblar-red-apoyo] ERROR:", e);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());

export type { Resumen };
