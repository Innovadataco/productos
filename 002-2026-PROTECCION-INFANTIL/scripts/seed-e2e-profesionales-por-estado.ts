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
 *     que aborta ruidoso si falta). Los correos se DERIVAN del correo base con sub-dirección
 *     `+<etiqueta>` (RFC 5233): misma clave, cero variables nuevas, cero literal de credencial
 *     en código. La cuenta base `E2E_PROFESIONAL` NO se toca.
 *  2. Marcados en `demo_marcado` como toda siembra — y ADEMÁS es lo que activa la exclusión
 *     SPEC-655: el directorio excluye por marca de `PerfilProfesional` (ver punto 5).
 *  3. CERO notificaciones. Se SIEMBRA EN EL ESTADO TERMINAL con `create/update` directo — NO
 *     se transita por el servicio del verificador (que sí encola avisos). No hay middleware
 *     Prisma ni trigger de BD que dispare notificaciones en estos INSERT/UPDATE. El conteo de
 *     `notificaciones` se toma DENTRO de la misma transacción (antes y después de escribir): si
 *     el delta ≠ 0 se LANZA y la transacción se DESHACE — un correo encolado no se des-envía,
 *     así que se aborta ANTES de confirmar, no después (mejora pedida por el CEO).
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
 * FIRMANTE DE LAS VERIFICACIONES (autoría): las verificaciones sembradas las firma un
 * VERIFICADOR **DEMO SIN ACCESO** que este script crea y marca (no un revisor real). El poblador
 * de la Red de Apoyo firma sus ~50 aprobaciones con un ADMIN REAL (`poblar-red-apoyo.ts:140/220`):
 * eso deja verificaciones demo con AUTORÍA de una persona que no las revisó. Acá se evita — la
 * autoría también es demo, marcada y purgable. (Que la Red de Apoyo tenga esa autoría real es un
 * hallazgo aparte, para radicar; no se toca en este PR.)
 *
 * PERO un VERIFICADOR es la LLAVE del mecanismo de confianza: aprueba profesionales. Una marca en
 * `demo_marcado` cambia lo que se VE, no lo que se puede HACER, y la capacidad viene del ROL
 * (`permisos-modulos.ts` resuelve por rol; el rol VERIFICADOR ya trae `admin_verificacion_profesionales`).
 * Así que este firmante NO puede iniciar sesión: (1) clave ALEATORIA irrecuperable —jamás la del
 * entorno—, y (2) `estado="inactivo"`, que el login rechaza (`tipo:"inactiva"`) y `verifyAuth`/
 * `getUserFromToken` rechazan en cada petición (auth.ts:129/160/189). Defensa en profundidad: dos
 * cerrojos independientes para una cuenta que solo necesita existir como autor.
 *
 * NO CUBIERTO (medido, para radicar aparte): la exclusión SPEC-655 cubre el DIRECTORIO del padre,
 * NO la cola del verificador (`verificador-repository.ts:48-49` lista `estado=EN_REVISION` sin
 * exclusión de sembrados). El fixture EN_REVISION APARECE en la cola: un verificador podría
 * aprobarlo y consumirlo. Este sembrador lo RESTAURA cada vez que SE CORRE —lo corre el CEO a
 * mano, NO está cableado al despliegue; si un verificador lo consume un martes, sigue consumido
 * hasta que alguien lo vuelva a correr—; el arreglo de fondo (excluir sembrados de la cola) es otra SPEC.
 *
 * Datos gatea la semilla (su carril). La corre en PRODUCCIÓN el CEO — NO contra prod a mano.
 *
 * Uso (dev):
 *   node --env-file=.env --import tsx scripts/seed-e2e-profesionales-por-estado.ts
 */
import { randomBytes } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { hashPassword, verifyPassword } from "../src/lib/auth";
import { calcularVenceEn } from "../src/lib/profesionales/vigencia";
import { derivarPerfilCatalogoSeed, CLAVES_SEED_E2E_ESTADO } from "./lib/perfil-catalogo-seed";
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

export interface ResultadoSiembra {
    fixtures: ResultadoProfesionalEstado[];
    revisor: { id: string; email: string; creado: boolean };
    notifAntes: number;
    notifDespues: number;
}

/** Correo derivado: sub-dirección `+<etiqueta>` sobre el correo base del entorno. */
export function emailConEtiqueta(emailBase: string, etiqueta: string): string {
    const at = emailBase.lastIndexOf("@");
    if (at <= 0) throw new Error("[seed-e2e-prof-estados] E2E_PROFESIONAL_EMAIL inválido: sin '@'.");
    const local = emailBase.slice(0, at);
    const dominio = emailBase.slice(at + 1);
    return `${local}+${etiqueta}@${dominio}`.toLowerCase();
}

export function emailPorEstado(emailBase: string, estado: EstadoGate): string {
    return emailConEtiqueta(emailBase, estado.toLowerCase());
}

/** Correo del VERIFICADOR demo (firmante). */
export function emailRevisorDemo(emailBase: string): string {
    return emailConEtiqueta(emailBase, "verificador");
}

/**
 * Acceso de una cuenta demo:
 *  - `login`: entra con la clave del entorno (los 5 profesionales, que Calidad camina).
 *  - `sin-acceso`: existe SOLO como autor (el firmante VERIFICADOR). Clave aleatoria
 *    irrecuperable (nunca del entorno) + `estado="inactivo"`: no puede iniciar sesión.
 */
type AccesoDemo =
    | { tipo: "login"; secreto: string }
    | { tipo: "sin-acceso"; secretoAEvitar: string };

/** Clave aleatoria que nadie conoce (se descarta): hash bcrypt VÁLIDO pero no usable con ninguna clave. */
function hashInutilizable(): Promise<string> {
    return hashPassword(randomBytes(32).toString("hex"));
}

/** Usuario demo idempotente. Devuelve id + si se creó. */
async function upsertUsuarioDemo(
    tx: Prisma.TransactionClient,
    email: string,
    nombre: string,
    rol: "PROFESIONAL" | "VERIFICADOR",
    ahora: Date,
    opciones: { estado: "activo" | "inactivo"; estadoActivacion: "ACTIVO" | "REGISTRADO"; acceso: AccesoDemo },
): Promise<{ id: string; creado: boolean }> {
    if (email === EMAIL_INTOCABLE) {
        throw new Error(`[seed-e2e-prof-estados] correo derivado colisiona con la cuenta intocable ${EMAIL_INTOCABLE}.`);
    }
    const { estado, estadoActivacion, acceso } = opciones;
    const base = { nombre, rol, estado, estadoActivacion, debeCambiarPassword: false };

    const existente = await tx.usuario.findUnique({ where: { email }, select: { id: true, passwordHash: true } });
    if (!existente) {
        const passwordHash = acceso.tipo === "login" ? await hashPassword(acceso.secreto) : await hashInutilizable();
        const creada = await tx.usuario.create({
            data: { email, ...base, passwordHash, passwordCreadaEn: ahora },
            select: { id: true },
        });
        return { id: creada.id, creado: true };
    }

    // Idempotencia del hash según el acceso:
    //  - login: re-hashea SOLO si la clave del entorno cambió.
    //  - sin-acceso: si el hash actual FUERA usable con la clave del entorno (estado de un
    //    corrida previa, buggy), lo re-hashea a algo inutilizable (auto-sanación); si ya es
    //    inutilizable, lo deja (idempotente, no re-hashea en cada corrida).
    const usableConEntorno = await verifyPassword(
        acceso.tipo === "login" ? acceso.secreto : acceso.secretoAEvitar,
        existente.passwordHash,
    );
    let cambioClave: { passwordHash: string; passwordCreadaEn: Date } | Record<string, never> = {};
    if (acceso.tipo === "login" && !usableConEntorno) {
        cambioClave = { passwordHash: await hashPassword(acceso.secreto), passwordCreadaEn: ahora };
    } else if (acceso.tipo === "sin-acceso" && usableConEntorno) {
        cambioClave = { passwordHash: await hashInutilizable(), passwordCreadaEn: ahora };
    }
    await tx.usuario.update({ where: { id: existente.id }, data: { ...base, ...cambioClave } });
    return { id: existente.id, creado: false };
}

/**
 * Repone los 5 profesionales + su VERIFICADOR demo por Prisma directo, idempotente y en UNA
 * transacción (la marca `demo_marcado` va DENTRO: nunca una fila sembrada sin su marca). No
 * transita estados por el servicio del verificador → no encola avisos. El conteo de
 * `notificaciones` se toma dentro de la tx y si el delta ≠ 0 se LANZA (deshace todo, no confirma).
 * Jamás toca la cuenta intocable ni la base `E2E_PROFESIONAL`.
 */
export async function sembrarProfesionalesPorEstado(
    tx: Prisma.TransactionClient,
    profesional: CredencialCuenta,
    ciudadId: string,
    ahora: Date = new Date(),
): Promise<ResultadoSiembra> {
    // Condición 3 (transaccional): la foto ANTES vive dentro de la tx; si al final creció, se lanza.
    const notifAntes = await tx.notificacion.count();

    // Firmante DEMO de las verificaciones: autoría también demo (no un revisor real).
    const revisorEmail = emailRevisorDemo(profesional.email);
    const revisor = await upsertUsuarioDemo(tx, revisorEmail, "Verificador Calidad (E2E · demo, sin acceso)", "VERIFICADOR", ahora, {
        estado: "inactivo",
        estadoActivacion: "REGISTRADO",
        acceso: { tipo: "sin-acceso", secretoAEvitar: profesional.secreto },
    });
    await marcar(tx, "Usuario", [revisor.id], { corrida: CORRIDA_SPEC690, script: SCRIPT, notas: "verificador demo (firmante, sin acceso)" });

    // SPEC-685: claves del catálogo + etiquetas legado (misma derivación que la API). Se resuelve
    // una vez y CONVERGE en cada perfil (create y update) — así una re-corrida rellena los perfiles
    // ya sembrados que quedaron con las columnas nuevas vacías. Valores estables → sin churn.
    const catalogo = await derivarPerfilCatalogoSeed(CLAVES_SEED_E2E_ESTADO);

    const fixtures: ResultadoProfesionalEstado[] = [];

    for (const plan of PLAN) {
        const email = emailPorEstado(profesional.email, plan.estado);
        if (email === profesional.email) {
            throw new Error("[seed-e2e-prof-estados] correo derivado colisiona con la cuenta base E2E_PROFESIONAL; no se pisa.");
        }
        const nombre = `Profesional Calidad (E2E · ${plan.estado})`;

        const usuario = await upsertUsuarioDemo(tx, email, nombre, "PROFESIONAL", ahora, {
            estado: "activo",
            estadoActivacion: "ACTIVO",
            acceso: { tipo: "login", secreto: profesional.secreto },
        });

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
            where: { usuarioId: usuario.id },
            create: {
                usuarioId: usuario.id,
                nombreVisible: nombre,
                ...catalogo,
                ciudadId,
                aniosExperiencia: 5,
                presentacion: `Cuenta de prueba de Calidad (E2E · compuerta SPEC-690, estado ${plan.estado}). No atender consultas reales.`,
                tarifaConsultaCOP: 100000,
                duracionMinutos: 50,
                ...camposEstado,
            },
            update: { ...camposEstado, ...catalogo },
            select: { id: true },
        });

        // ── Marca (DENTRO de la tx). `Usuario` gobierna el lado del VISOR (un padre demo ve
        // sembrados); `PerfilProfesional` es lo que el directorio EXCLUYE para un visor real.
        await marcar(tx, "Usuario", [usuario.id], { corrida: CORRIDA_SPEC690, script: SCRIPT, notas: `profesional ${plan.estado}` });
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
                    data: { revisadoPorId: revisor.id, revisadoEn, resultado: "APROBADO", venceEn },
                });
                verificacionId = previa.id;
            } else {
                const v = await tx.verificacionProfesional.create({
                    data: {
                        perfilProfesionalId: perfil.id,
                        revisadoPorId: revisor.id,
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

        fixtures.push({ estado: plan.estado, email, usuarioId: usuario.id, perfilId: perfil.id, verificacionId, creado: usuario.creado });
    }

    // Condición 3 (transaccional): si la siembra encoló notificaciones, DESHACER antes de confirmar.
    const notifDespues = await tx.notificacion.count();
    if (notifDespues !== notifAntes) {
        throw new Error(
            `[seed-e2e-prof-estados] la siembra disparó ${notifDespues - notifAntes} notificación(es) — se ABORTA la transacción (nada se confirma).`,
        );
    }

    return { fixtures, revisor: { id: revisor.id, email: revisorEmail, creado: revisor.creado }, notifAntes, notifDespues };
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

    const { fixtures, revisor, notifAntes, notifDespues } = await prisma.$transaction((tx) =>
        sembrarProfesionalesPorEstado(tx, profesional, ciudad.id),
    );

    console.log("");
    console.log("✅ Semilla SPEC-690 (profesional por estado) COMPLETA (idempotente). Fixtures:");
    for (const r of fixtures) {
        console.log(`  ${r.estado.padEnd(12)} ${r.email} ${r.creado ? "[creada]" : "[actualizada]"}${r.verificacionId ? " · verif" : ""}`);
    }
    console.log(`Firmante (VERIFICADOR demo): ${revisor.email} ${revisor.creado ? "[creado]" : "[actualizado]"}`);
    console.log(`Notificaciones (dentro de la tx): antes=${notifAntes} · después=${notifDespues} · delta=${notifDespues - notifAntes} ✅ (si no fuera 0, la tx se habría deshecho)`);
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
