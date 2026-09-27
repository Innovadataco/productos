/**
 * SPEC-741 (fixture de Calidad) · UN profesional de prueba HABILITADO **con la aceptación de la
 * autorización vigente presente**, para caminar «Mi perfil profesional» (el acordeón) sin rebotar
 * al muro de autorización.
 *
 * POR QUÉ: `exigirProfesionalHabilitado` (guardia-habilitado.ts) manda al muro
 * `/perfil-profesional/autorizacion` si `necesitaAceptar(usuario)` — y (tipo FONDO) eso es «su
 * última aceptación ≠ versión vigente». Los profesionales de prueba tenían 0 aceptaciones →
 * rebotaban. Esta cuenta trae la fila `AceptacionAutorizacionProfesional` con la versión vigente,
 * así el muro la deja pasar (verificado contra el gate real, no supuesto).
 *
 * CORRIDA PERSISTENTE (`e2e-calidad-cuentas`), NO la purgable de SPEC-690 (lección SPEC-722: la
 * cuenta fija no debe morir con una purga de estado). La ACEPTACIÓN es dato de CONSERVACIÓN
 * (≥ cuenta activa + 10 años; nunca purgada antes que lo que ampara): **NO se marca demo** — cuelga
 * del Usuario (onDelete Cascade), así que solo se va si se borra la cuenta (reset total de la
 * corrida de cuentas), jamás por una purga de estado.
 *
 * Idempotente (upsert por email/perfil; aceptación find-or-create por usuario+versión), atómico
 * (una transacción), CERO notificaciones (delta en la tx; si crece se DESHACE), parametrizable
 * (credenciales por entorno: reusa `E2E_PROFESIONAL`, misma clave, sub-dirección `+habilitado`).
 * Datos gatea la semilla; la corre en PRODUCCIÓN el CEO — NO contra prod a mano.
 *
 * Uso (dev):
 *   node --env-file=.env --import tsx scripts/seed-e2e-profesional-habilitado.ts
 */
import { EstadoPerfilProfesional, type Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { calcularVenceEn } from "../src/lib/profesionales/vigencia";
import { AutorizacionProfesionalService } from "../src/lib/dal/services/autorizacion-profesional";
import { derivarPerfilCatalogoSeed, CLAVES_SEED_E2E_ESTADO } from "./lib/perfil-catalogo-seed";
import { leerCredencialesE2E, type CredencialCuenta } from "./lib/credenciales-e2e-calidad";
import { marcar } from "./demo/_marcado";
import { emailConEtiqueta, upsertUsuarioDemo } from "./seed-e2e-profesionales-por-estado";

/** Corrida PERSISTENTE de cuentas fijas de Calidad (NO la purgable `e2e-calidad-spec690`). */
export const CORRIDA_CUENTAS_CALIDAD = "e2e-calidad-cuentas";
const SCRIPT = "seed-e2e-profesional-habilitado";
const ETIQUETA = "habilitado";
/** id OPACO de archivo en el storage protegido (fixture; el gate lee el estado, no el archivo). */
const AUTORIZACION_FIXTURE = "e2e-calidad-habilitado-autorizacion";
const CHECKLIST_FIXTURE = {
    e2e: { estado: "CUMPLE", observacion: "Fixture de Calidad SPEC-741 (profesional habilitado con aceptación)." },
} satisfies Prisma.InputJsonValue;

export interface ResultadoHabilitado {
    email: string;
    usuarioId: string;
    perfilId: string;
    verificacionId: string;
    aceptacionId: string;
    version: string;
    creado: boolean;
}

export interface ResultadoSiembraHabilitado {
    resultado: ResultadoHabilitado;
    notifAntes: number;
    notifDespues: number;
}

/**
 * Siembra (idempotente, en UNA transacción) el profesional HABILITADO con su aceptación vigente.
 * La marca `demo_marcado` de las cuentas va en la corrida PERSISTENTE; la aceptación NO se marca.
 */
export async function sembrarProfesionalHabilitado(
    tx: Prisma.TransactionClient,
    profesional: CredencialCuenta,
    ciudadId: string,
    ahora: Date = new Date(),
): Promise<ResultadoSiembraHabilitado> {
    const notifAntes = await tx.notificacion.count();

    // Versión + hash del documento VIGENTE. El muro (`necesitaAceptar`) exige versión == vigente;
    // el hash es fidelidad del registro (el gate no lo verifica, pero se guarda el real).
    const svc = new AutorizacionProfesionalService();
    const version = await svc.versionVigente();
    const documentoHash = svc.calcularHash(await svc.obtenerDocumentoVigente());

    // Firmante VERIFICADOR demo (autoría demo, SIN acceso) — en la corrida persistente, propio de
    // este fixture (no se reusa el de SPEC-690, que vive en la corrida purgable).
    const revisorEmail = emailConEtiqueta(profesional.email, "verificador-cuentas");
    const revisor = await upsertUsuarioDemo(tx, revisorEmail, "Verificador Calidad (E2E cuentas · demo, sin acceso)", "VERIFICADOR", ahora, {
        estado: "inactivo",
        estadoActivacion: "REGISTRADO",
        acceso: { tipo: "sin-acceso", secretoAEvitar: profesional.secreto },
    });
    await marcar(tx, "Usuario", [revisor.id], { corrida: CORRIDA_CUENTAS_CALIDAD, script: SCRIPT, notas: "verificador demo (firmante, sin acceso)" });

    // Profesional HABILITADO (login con la clave del entorno; misma que las demás cuentas E2E).
    const email = emailConEtiqueta(profesional.email, ETIQUETA);
    const nombre = "Profesional Calidad (E2E · HABILITADO)";
    const usuario = await upsertUsuarioDemo(tx, email, nombre, "PROFESIONAL", ahora, {
        estado: "activo",
        estadoActivacion: "ACTIVO",
        acceso: { tipo: "login", secreto: profesional.secreto },
    });
    await marcar(tx, "Usuario", [usuario.id], { corrida: CORRIDA_CUENTAS_CALIDAD, script: SCRIPT, notas: "profesional habilitado (fixture «Mi perfil» SPEC-741)" });

    // Perfil ACTIVO (CHECK SPEC-673: ≠BORRADOR ⟹ atiendeVirtual OR atiendePresencial).
    const catalogo = await derivarPerfilCatalogoSeed(CLAVES_SEED_E2E_ESTADO);
    const camposEstado = {
        estado: EstadoPerfilProfesional.ACTIVO,
        atiendeVirtual: true,
        atiendePresencial: false,
        autorizacionArchivoId: AUTORIZACION_FIXTURE,
        autorizacionSubidaEn: ahora,
    };
    const perfil = await tx.perfilProfesional.upsert({
        where: { usuarioId: usuario.id },
        create: {
            usuarioId: usuario.id,
            nombreVisible: nombre,
            ...catalogo,
            ciudadId,
            aniosExperiencia: 5,
            presentacion: "Cuenta de prueba de Calidad (E2E · SPEC-741, profesional HABILITADO). No atender consultas reales.",
            tarifaConsultaCOP: 100000,
            duracionMinutos: 50,
            ...camposEstado,
        },
        update: { ...camposEstado, ...catalogo },
        select: { id: true },
    });
    await marcar(tx, "PerfilProfesional", [perfil.id], { corrida: CORRIDA_CUENTAS_CALIDAD, script: SCRIPT, notas: "perfil habilitado" });

    // Aceptación de la autorización vigente (SPEC-686). NO se marca demo (conservación; cuelga del
    // Usuario por Cascade). Idempotente: find-or-create por (usuario, versión). `aceptadoEn` ANTES
    // de `revisadoEn` (anterioridad Ley 1918/2018). ip/userAgent = marcadores de siembra.
    const aceptadoEn = new Date(ahora.getTime() - 60_000);
    const existente = await tx.aceptacionAutorizacionProfesional.findFirst({
        where: { usuarioId: usuario.id, version },
        orderBy: { aceptadoEn: "desc" },
        select: { id: true },
    });
    const aceptacionId =
        existente?.id ??
        (
            await tx.aceptacionAutorizacionProfesional.create({
                data: { usuarioId: usuario.id, version, documentoHash, aceptadoEn, ip: "seed", userAgent: SCRIPT },
                select: { id: true },
            })
        ).id;

    // Verificación APROBADA vigente, respaldada en la aceptación (`aceptacionAutorizacionId`).
    const revisadoEn = new Date(ahora.getTime());
    const venceEn = calcularVenceEn(revisadoEn);
    const previa = await tx.verificacionProfesional.findFirst({
        where: { perfilProfesionalId: perfil.id },
        orderBy: { revisadoEn: "desc" },
        select: { id: true },
    });
    // CHECK `VerificacionProfesional_una_autorizacion_check` (SPEC-686, XOR crudo invisible a
    // Prisma): EXACTAMENTE una prueba de autorización. Esta vía es la ACEPTACIÓN en pantalla
    // (`aceptacionAutorizacionId`), así que `autorizacionArchivoId` va NULL (no la legacy).
    let verificacionId: string;
    if (previa) {
        await tx.verificacionProfesional.update({
            where: { id: previa.id },
            data: {
                revisadoPorId: revisor.id,
                revisadoEn,
                resultado: "APROBADO",
                venceEn,
                aceptacionAutorizacionId: aceptacionId,
                autorizacionArchivoId: null,
            },
        });
        verificacionId = previa.id;
    } else {
        const v = await tx.verificacionProfesional.create({
            data: {
                perfilProfesionalId: perfil.id,
                revisadoPorId: revisor.id,
                revisadoEn,
                resultado: "APROBADO",
                venceEn,
                checklist: CHECKLIST_FIXTURE,
                aceptacionAutorizacionId: aceptacionId,
            },
            select: { id: true },
        });
        verificacionId = v.id;
        await marcar(tx, "VerificacionProfesional", [v.id], { corrida: CORRIDA_CUENTAS_CALIDAD, script: SCRIPT, notas: "verificación aprobada vigente" });
    }

    const notifDespues = await tx.notificacion.count();
    if (notifDespues !== notifAntes) {
        throw new Error(
            `[seed-e2e-prof-habilitado] la siembra disparó ${notifDespues - notifAntes} notificación(es) — se ABORTA la transacción (nada se confirma).`,
        );
    }

    return {
        resultado: { email, usuarioId: usuario.id, perfilId: perfil.id, verificacionId, aceptacionId, version, creado: usuario.creado },
        notifAntes,
        notifDespues,
    };
}

async function main(): Promise<void> {
    if (!process.env.DATABASE_URL) throw new Error("[seed-e2e-prof-habilitado] DATABASE_URL requerida");
    if (process.env.NODE_ENV === "test") throw new Error("[seed-e2e-prof-habilitado] NODE_ENV=test bloqueado — este script no corre en tests");

    const profesional = leerCredencialesE2E().find((c) => c.clave === "PROFESIONAL");
    if (!profesional) throw new Error("[seed-e2e-prof-habilitado] falta la credencial PROFESIONAL en el entorno");

    const ciudad = await (prisma as PrismaClient).ciudad.findFirst({ where: { nombre: "Bogotá" }, select: { id: true } });
    if (!ciudad) throw new Error("[seed-e2e-prof-habilitado] Ciudad 'Bogotá' faltante — corre la semilla base antes");

    const { resultado, notifAntes, notifDespues } = await prisma.$transaction((tx) =>
        sembrarProfesionalHabilitado(tx, profesional, ciudad.id),
    );

    console.log("");
    console.log("✅ Fixture SPEC-741 (profesional HABILITADO con aceptación) COMPLETA (idempotente):");
    console.log(`  cuenta:  ${resultado.email} ${resultado.creado ? "[creada]" : "[actualizada]"}`);
    console.log(`  estado:  perfil ACTIVO + verificación APROBADA vigente + aceptación autorización v=${resultado.version}`);
    console.log(`  corrida PERSISTENTE: ${CORRIDA_CUENTAS_CALIDAD} (una purga de estado NO la borra)`);
    console.log(`  notificaciones (en la tx): antes=${notifAntes} después=${notifDespues} delta=${notifDespues - notifAntes} ✅`);
    console.log("  → Calidad entra con E2E_PROFESIONAL_PASSWORD y camina «Mi perfil» sin muro de autorización.");
}

if (process.argv[1]?.endsWith("seed-e2e-profesional-habilitado.ts")) {
    main()
        .catch((err: unknown) => {
            console.error("[seed-e2e-prof-habilitado] Error:", err instanceof Error ? err.message : err);
            process.exitCode = 1;
        })
        .finally(() => prisma.$disconnect());
}
