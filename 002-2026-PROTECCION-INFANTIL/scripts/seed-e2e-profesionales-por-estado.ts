/**
 * SPEC-690 — Semilla de UN profesional de prueba por CADA estado de la compuerta.
 *
 * POR QUÉ: la compuerta del profesional (SPEC-690) decide qué puede hacer un profesional
 * SEGÚN SU ESTADO. Para caminar esa matriz (regla de la casa: «listo» = recorrido caminado,
 * no test verde) Calidad necesita una cuenta en cada estado — y Calidad NO puede crear cuentas
 * (prohibido, con razón). Hoy solo existe UN profesional de prueba (`E2E_PROFESIONAL`, hoy en
 * EN_REVISION, fila-evidencia de I-398). Este sembrador repone los CINCO estados de la matriz,
 * por el CARRIL DEL POBLADOR, no a mano.
 *
 * LOS CINCO (enum `EstadoPerfilProfesional`; RECHAZADO no lo pidió el encargo):
 *   BORRADOR · EN_REVISION · ACTIVO (con vigencia) · VENCIDO · SUSPENDIDO.
 *
 * CONDICIONES DURAS (encargo del CEO, 13-09):
 *  1. Credenciales por el MISMO mecanismo de entorno que las cuentas E2E existentes: se
 *     REUSA `E2E_PROFESIONAL_EMAIL` / `E2E_PROFESIONAL_PASSWORD` (vía `leerCredencialesE2E`,
 *     que aborta ruidoso si falta). Los cinco correos se DERIVAN del correo base con sub-
 *     dirección `+<estado>` (RFC 5233): misma clave, cero variables nuevas, cero literal de
 *     credencial en código. La cuenta base `E2E_PROFESIONAL` NO se toca.
 *  2. Marcados en `demo_marcado` como toda siembra — y ADEMÁS es lo que activa la exclusión
 *     SPEC-655: el directorio excluye por marca de `PerfilProfesional` (ver punto 5).
 *  3. CERO notificaciones. Se SIEMBRA EN EL ESTADO TERMINAL con `create/update` directo — NO
 *     se transita por el servicio del verificador (que sí encola avisos). No hay middleware
 *     Prisma ni trigger de BD que dispare notificaciones en estos INSERT/UPDATE (verificado).
 *     `main()` cuenta la tabla `notificaciones` antes/después y grita si el delta ≠ 0.
 *  4. Idempotente y NO destructivo: correrlo N veces deja el MISMO estado. Usuario por email
 *     (re-hashea solo si la clave del entorno cambió), perfil por `usuarioId`, verificación
 *     por perfil — nunca duplica. El ACTIVO se REFRESCA a `venceEn = ahora + 4m` en cada
 *     corrida, para que jamás caiga en la ventana de aviso de 30 días del worker de
 *     vencimiento (SPEC-388) — sembrar fuera de la ventana del barrido.
 *  5. La exclusión SPEC-655 queda ARMADA por el marcado: el directorio hace
 *     `NOT id in <ids de PerfilProfesional marcados>` para un visor real/anónimo, y `{}` (sin
 *     exclusión) para un visor sembrado. Por eso se marca `PerfilProfesional` (no solo
 *     `Usuario`): sin esa marca el ACTIVO se FILTRARÍA a un padre real. El control positivo
 *     de las dos direcciones vive en el candado de integración.
 *
 * Datos gatea la semilla (su carril). La corre en PRODUCCIÓN el CEO — NO contra prod a mano.
 *
 * Uso (dev):
 *   node --env-file=.env --import tsx scripts/seed-e2e-profesionales-por-estado.ts
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { hashPassword, verifyPassword } from "../src/lib/auth";
import { calcularVenceEn } from "../src/lib/profesionales/vigencia";
import { EMAIL_INTOCABLE, leerCredencialesE2E, type CredencialCuenta } from "./lib/credenciales-e2e-calidad";
import { marcar } from "./demo/_marcado";

/** Corrida propia: identificable y purgable aparte por `purgar-demo --corrida`. */
export const CORRIDA_SPEC690 = "e2e-calidad-spec690";
const SCRIPT = "seed-e2e-profesionales-por-estado";
/** id OPACO de archivo en el storage PROTEGIDO (fixture; el gate lee el estado, no el archivo). */
const AUTORIZACION_FIXTURE = "e2e-calidad-spec690-autorizacion";
const CHECKLIST_FIXTURE = {
    e2e: { estado: "CUMPLE", observacion: "Fixture de Calidad SPEC-690 (compuerta por estado)." },
} satisfies Prisma.InputJsonValue;

export type EstadoGate = "BORRADOR" | "EN_REVISION" | "ACTIVO" | "VENCIDO" | "SUSPENDIDO";

/** Qué verificación acompaña a cada estado (la vigencia vive en `VerificacionProfesional.venceEn`). */
type PlanVerificacion = "ninguna" | "vigente" | "vencida";

interface PlanEstado {
    estado: EstadoGate;
    verificacion: PlanVerificacion;
}

/**
 * ACTIVO ⇒ verificación APROBADA vigente (`venceEn` futuro) — sin ella no aparece en el
 * directorio y el control positivo no probaría nada. VENCIDO ⇒ APROBADA vencida (`venceEn`
 * pasado), coherente con cómo nace VENCIDO. SUSPENDIDO ⇒ fue verificado y IDC lo suspendió;
 * su verificación es INERTE al worker (rama VENCIDO exige estado===ACTIVO). BORRADOR/EN_REVISION
 * ⇒ sin verificación (aún no hay decisión del verificador).
 */
export const PLAN: readonly PlanEstado[] = [
    { estado: "BORRADOR", verificacion: "ninguna" },
    { estado: "EN_REVISION", verificacion: "ninguna" },
    { estado: "ACTIVO", verificacion: "vigente" },
    { estado: "VENCIDO", verificacion: "vencida" },
    { estado: "SUSPENDIDO", verificacion: "vigente" },
];

export interface ResultadoProfesionalEstado {
    estado: EstadoGate;
    email: string;
    usuarioId: string;
    perfilId: string;
    verificacionId: string | null;
    creado: boolean;
}

/** Correo por estado: sub-dirección `+<estado>` sobre el correo base del entorno. */
export function emailPorEstado(emailBase: string, estado: EstadoGate): string {
    const at = emailBase.lastIndexOf("@");
    if (at <= 0) throw new Error("[seed-e2e-prof-estados] E2E_PROFESIONAL_EMAIL inválido: sin '@'.");
    const local = emailBase.slice(0, at);
    const dominio = emailBase.slice(at + 1);
    return `${local}+${estado.toLowerCase()}@${dominio}`.toLowerCase();
}

/**
 * Repone los 5 profesionales por Prisma directo, idempotente y en UNA transacción (la marca
 * `demo_marcado` va DENTRO: nunca una fila sembrada sin su marca). No transita estados por el
 * servicio del verificador → no encola avisos. Jamás toca la cuenta intocable ni la base
 * `E2E_PROFESIONAL`.
 */
export async function sembrarProfesionalesPorEstado(
    tx: Prisma.TransactionClient,
    profesional: CredencialCuenta,
    ciudadId: string,
    revisadorId: string,
    ahora: Date = new Date(),
): Promise<ResultadoProfesionalEstado[]> {
    const resultados: ResultadoProfesionalEstado[] = [];

    for (const plan of PLAN) {
        const email = emailPorEstado(profesional.email, plan.estado);
        if (email === EMAIL_INTOCABLE) {
            throw new Error(`[seed-e2e-prof-estados] correo derivado colisiona con la cuenta intocable ${EMAIL_INTOCABLE}.`);
        }
        if (email === profesional.email) {
            throw new Error("[seed-e2e-prof-estados] correo derivado colisiona con la cuenta base E2E_PROFESIONAL; no se pisa.");
        }
        const nombre = `Profesional Calidad (E2E · ${plan.estado})`;

        // ── Usuario (idempotente; re-hashea solo si la clave del entorno cambió) ──
        const existente = await tx.usuario.findUnique({ where: { email }, select: { id: true, passwordHash: true } });
        let usuarioId: string;
        let creado = false;
        if (!existente) {
            const creada = await tx.usuario.create({
                data: {
                    email,
                    nombre,
                    passwordHash: await hashPassword(profesional.secreto),
                    passwordCreadaEn: ahora,
                    rol: "PROFESIONAL",
                    estado: "activo",
                    estadoActivacion: "ACTIVO",
                    debeCambiarPassword: false,
                },
                select: { id: true },
            });
            usuarioId = creada.id;
            creado = true;
        } else {
            const mismaClave = await verifyPassword(profesional.secreto, existente.passwordHash);
            await tx.usuario.update({
                where: { id: existente.id },
                data: {
                    nombre,
                    rol: "PROFESIONAL",
                    estado: "activo",
                    estadoActivacion: "ACTIVO",
                    debeCambiarPassword: false,
                    ...(mismaClave ? {} : { passwordHash: await hashPassword(profesional.secreto), passwordCreadaEn: ahora }),
                },
            });
            usuarioId = existente.id;
        }

        // ── PerfilProfesional: converge los campos que DEFINEN el fixture (estado, modalidad,
        // autorización); los descriptivos son create-only para no churnnear en cada deploy.
        // CHECK SPEC-673: estado≠BORRADOR ⟹ atiendeVirtual OR atiendePresencial.
        const noBorrador = plan.estado !== "BORRADOR";
        const camposEstado = {
            estado: plan.estado,
            atiendeVirtual: noBorrador,
            atiendePresencial: false,
            autorizacionArchivoId: noBorrador ? AUTORIZACION_FIXTURE : null,
            autorizacionSubidaEn: noBorrador ? ahora : null,
        };
        const perfil = await tx.perfilProfesional.upsert({
            where: { usuarioId },
            create: {
                usuarioId,
                nombreVisible: nombre,
                tituloProfesional: "Psicólogo (E2E)",
                especialidades: ["Psicología infantil"],
                ciudadId,
                aniosExperiencia: 5,
                presentacion: `Cuenta de prueba de Calidad (E2E · compuerta SPEC-690, estado ${plan.estado}). No atender consultas reales.`,
                tarifaConsultaCOP: 100000,
                duracionMinutos: 50,
                ...camposEstado,
            },
            update: camposEstado,
            select: { id: true },
        });

        // ── Marca (DENTRO de la tx). `Usuario` gobierna el lado del VISOR (un padre demo ve
        // sembrados); `PerfilProfesional` es lo que el directorio EXCLUYE para un visor real.
        await marcar(tx, "Usuario", [usuarioId], { corrida: CORRIDA_SPEC690, script: SCRIPT, notas: `profesional ${plan.estado}` });
        await marcar(tx, "PerfilProfesional", [perfil.id], { corrida: CORRIDA_SPEC690, script: SCRIPT, notas: `compuerta ${plan.estado}` });

        // ── Verificación (solo estados que la llevan). Idempotente por perfil: si ya hay una,
        // se ACTUALIZA (refresca fechas → el ACTIVO nunca entra a la ventana de aviso); si no, se crea.
        let verificacionId: string | null = null;
        if (plan.verificacion !== "ninguna") {
            const revisadoEn = new Date(ahora.getTime());
            if (plan.verificacion === "vencida") {
                // 5 meses atrás ⇒ venceEn = revisadoEn + 4m = hace ~1 mes (pasado).
                revisadoEn.setUTCMonth(revisadoEn.getUTCMonth() - 5);
            }
            const venceEn = calcularVenceEn(revisadoEn);
            const previa = await tx.verificacionProfesional.findFirst({
                where: { perfilProfesionalId: perfil.id },
                orderBy: { revisadoEn: "desc" },
                select: { id: true },
            });
            if (previa) {
                await tx.verificacionProfesional.update({
                    where: { id: previa.id },
                    data: { revisadoPorId: revisadorId, revisadoEn, resultado: "APROBADO", venceEn },
                });
                verificacionId = previa.id;
            } else {
                const v = await tx.verificacionProfesional.create({
                    data: {
                        perfilProfesionalId: perfil.id,
                        revisadoPorId: revisadorId,
                        revisadoEn,
                        resultado: "APROBADO",
                        autorizacionArchivoId: AUTORIZACION_FIXTURE,
                        venceEn,
                        checklist: CHECKLIST_FIXTURE,
                    },
                    select: { id: true },
                });
                verificacionId = v.id;
                await marcar(tx, "VerificacionProfesional", [v.id], { corrida: CORRIDA_SPEC690, script: SCRIPT, notas: `vigencia ${plan.estado}` });
            }
        }

        resultados.push({ estado: plan.estado, email, usuarioId, perfilId: perfil.id, verificacionId, creado });
    }

    return resultados;
}

function nowCOT(): string {
    return new Intl.DateTimeFormat("es-CO", {
        timeZone: "America/Bogota",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    }).format(new Date());
}

async function main(): Promise<void> {
    if (!process.env.DATABASE_URL) throw new Error("[seed-e2e-prof-estados] DATABASE_URL requerida");
    if (process.env.NODE_ENV === "test") throw new Error("[seed-e2e-prof-estados] NODE_ENV=test bloqueado — este script no corre en tests");

    // Aborta por variable ausente ANTES de cualquier escritura (mismo mecanismo E2E existente).
    const profesional = leerCredencialesE2E().find((c) => c.clave === "PROFESIONAL");
    if (!profesional) throw new Error("[seed-e2e-prof-estados] falta la credencial PROFESIONAL en el entorno");

    const ciudad = await (prisma as PrismaClient).ciudad.findFirst({ where: { nombre: "Bogotá" }, select: { id: true } });
    if (!ciudad) throw new Error("[seed-e2e-prof-estados] Ciudad 'Bogotá' faltante — corre la semilla base antes");

    // Firmante de las verificaciones: un revisor real de IDC (nunca la cuenta intocable, nunca un sembrado).
    const revisador = await (prisma as PrismaClient).usuario.findFirst({
        where: { rol: { in: ["VERIFICADOR", "ADMIN"] }, email: { not: EMAIL_INTOCABLE }, estado: "activo" },
        select: { id: true, email: true, rol: true },
        orderBy: { creadoEn: "asc" },
    });
    if (!revisador) {
        throw new Error("[seed-e2e-prof-estados] No hay revisor (VERIFICADOR/ADMIN) para firmar las verificaciones. Aborto sin escribir.");
    }

    // Condición 3: medir `notificaciones` antes/después, ventana mínima alrededor de la escritura.
    const notifAntes = await prisma.notificacion.count();
    const resultados = await prisma.$transaction((tx) => sembrarProfesionalesPorEstado(tx, profesional, ciudad.id, revisador.id));
    const notifDespues = await prisma.notificacion.count();
    const delta = notifDespues - notifAntes;

    console.log("");
    console.log("✅ Semilla SPEC-690 (profesional por estado) COMPLETA (idempotente). Fixtures:");
    for (const r of resultados) {
        console.log(`  ${r.estado.padEnd(12)} ${r.email} ${r.creado ? "[creada]" : "[actualizada]"}${r.verificacionId ? " · verif" : ""}`);
    }
    console.log(`Firmante de verificaciones: ${revisador.rol} ${revisador.email}`);
    console.log(`Notificaciones: antes=${notifAntes} · después=${notifDespues} · delta=${delta}${delta === 0 ? " ✅" : " ⚠️  ¡el sembrado disparó notificaciones — investigar!"}`);
    console.log(`Ejecutado: ${nowCOT()}`);
}

if (process.argv[1]?.endsWith("seed-e2e-profesionales-por-estado.ts")) {
    main()
        .catch((err: unknown) => {
            console.error("[seed-e2e-prof-estados] Error:", err instanceof Error ? err.message : err);
            process.exitCode = 1;
        })
        .finally(() => prisma.$disconnect());
}
