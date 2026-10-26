/**
 * SPEC-265 (002-PI-168) — reset total de data de prueba del piloto.
 *
 * Uso:
 *   node --env-file=.env --import tsx scripts/limpieza/reset-piloto.ts \
 *     --motivo="reset piloto agosto 2026" --confirm --backup=/tmp/backup.sql
 *
 * REQUIERE --confirm y --backup obligatorios. Sin cualquiera de los dos → error.
 *
 * Orquesta borrar-colegio + borrar-padre + borrar-reporte + borrar-simulacion.
 *
 * SPEC-412 (BRIEF A-76 §3.3) — modo quirúrgico:
 *   ... --solo-sembrado
 * Con esa bandera NO borra todo: borra **solo lo registrado en `demo_marcado`**
 * y conserva intacto lo real, contándolo antes y después. Sin la bandera, el
 * comportamiento es exactamente el de siempre.
 *
 * PRESERVA SIEMPRE:
 *  - usuario `soporte@innovadataco.com`
 *  - reportes RPT-1RR278, RPT-2JFULR, RPT-FA1C23 (D-001 §5 evidencia viva)
 *  - seed permanente (ParametroSistema, Plan, notificacion_*, geo, ModuloPermisible,
 *    GuiaAccionCategoria, FuenteReporte, DatasetEntrenamiento, EmbeddingDataset, AuditLog)
 */
import { execSync } from "node:child_process";
import { statSync } from "node:fs";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "../../src/lib/prisma";
import {
    parseArgs,
    requerirMotivo,
    registrarAuditoria,
    log,
    PRESERVADOS,
} from "./_common";
import { borrarColegio } from "./borrar-colegio";
import { borrarPadre } from "./borrar-padre";
import { borrarProfesional } from "./borrar-profesional";
import { borrarReporte } from "./borrar-reporte";
import { borrarSimulacion } from "./borrar-simulacion";
import { planDeBorrado, ejecutarBorrado } from "../demo/_borrado-marcado";

/**
 * SPEC-905 · tablas de AGREGADO/MARCADOR que `--purga-total` debe dejar en 0 (además de las
 * entidades-raíz). El reset recalcula `IdentificadorReportado` a 0 al borrar cada reporte
 * (SPEC-870) pero la FILA queda; acá se borra la fila. El candado estructural exige esta lista.
 * Orden FK-safe: EventoMatch (→ IdentificadorReportado, Reporte) antes que IdentificadorReportado;
 * DemoMarcado es marcador polimórfico sin FK.
 */
export const TABLAS_AGREGADO_PURGA = ["EventoMatch", "IdentificadorReportado", "DemoMarcado"] as const;

/**
 * SPEC-905 · FK de tablas SEED (en PRESERVADOS.tablas · NUNCA se borran) hacia el admin creador,
 * RESTRICT y NOT NULL. Si purga-total borra al admin que creó el seed, la FK trabaría el wipe y no
 * se puede nulear (NOT NULL) ni borrar el seed. Antes del wipe se RE-APUNTAN a soporte@ (único
 * usuario que queda). Conciliado con el CEO/Jelkin («desde cero»): preserva el seed, deja 0 usuarios
 * salvo soporte@. El candado exige que esta lista sea EXACTAMENTE las FK RESTRICT seed→Usuario.
 */
export const SEED_FK_REAPUNTAR = [
    { tabla: "Plan", campo: "creadoPorAdminId" },
    { tabla: "GuiaAccionCategoria", campo: "creadaPorAdminId" },
    { tabla: "reglas_recomendacion", campo: "creadaPorAdminId" },
] as const;

interface ResumenReset {
    backupSize: number;
    colegios: string[];
    padres: string[];
    reportesHuerfanos: string[];
    simulaciones: string[];
}

function ejecutarBackup(rutaBackup: string): number {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("[reset-piloto] DATABASE_URL no está definido");
    log("reset-piloto", `Ejecutando pg_dump → ${rutaBackup}`);
    execSync(`pg_dump "${url}" > "${rutaBackup}"`, { stdio: "inherit" });
    const size = statSync(rutaBackup).size;
    if (size < 1024) throw new Error(`[reset-piloto] Backup sospechosamente pequeño: ${size}B`);
    log("reset-piloto", `Backup OK — ${size} bytes`);
    return size;
}

/**
 * SPEC-412 · el reset quirúrgico. Se apoya en `demo_marcado`, no en nombres ni
 * en prefijos de id: un colegio real llamado "Colegio Demo" no corre peligro.
 * Si algo NO marcado cuelga de algo marcado, la transacción falla entera y lo
 * dice — no se borra a ciegas para destrabar.
 */
async function resetSoloSembrado(motivo: string, backupSize: number): Promise<void> {
    const antes = await planDeBorrado(prisma);
    log("reset-piloto", `MODO --solo-sembrado — ${antes.totalMarcado} filas marcadas en demo_marcado.`);
    for (const m of antes.marcadas) log("reset-piloto", `  · ${m.entidad}: ${m.cantidad}`);
    log("reset-piloto", "NO se toca:");
    for (const r of antes.reales) log("reset-piloto", `  · ${r.entidad} real: ${r.cantidad}`);

    if (antes.totalMarcado === 0) {
        log("reset-piloto", "Nada marcado: no hay nada que borrar. Corre antes scripts/demo/marcar-retroactivo.ts.");
        return;
    }

    const res = await ejecutarBorrado(prisma, motivo);
    const total = Object.values(res.borradas).reduce((a, b) => a + b, 0);

    const despues = await planDeBorrado(prisma);
    for (const a of antes.reales) {
        const d = despues.reales.find((x) => x.entidad === a.entidad);
        log("reset-piloto", `  ${d?.cantidad === a.cantidad ? "OK" : "REVISAR"} ${a.entidad} real: ${a.cantidad} → ${d?.cantidad ?? "?"}`);
    }

    await prisma.$transaction(async (tx) => {
        await registrarAuditoria(tx, "reset_piloto", `${motivo} [solo-sembrado]`, total, Object.keys(res.borradas));
    });

    log("reset-piloto", `REALIZADO --solo-sembrado backup=${backupSize}B filas=${total} marcas=${res.marcadasLimpiadas}`);
}

/**
 * Reportes que borra el reset. Normal: solo huérfanos (tenant/usuario null) y SIN los de
 * `PRESERVADOS.reportesExcluidos`. `--purga-total` (ventana S-D, D-113): TODOS — los 3 de
 * «evidencia viva» ya son dato de prueba (D-113, 05-09) y la migración S-D exige la tabla vacía.
 */
export async function seleccionarReportesABorrar(
    purgaTotal: boolean
): Promise<{ id: string; numeroSeguimiento: string | null }[]> {
    if (purgaTotal) {
        return prisma.reporte.findMany({ select: { id: true, numeroSeguimiento: true } });
    }
    return prisma.reporte.findMany({
        where: {
            tenantId: null,
            usuarioId: null,
            numeroSeguimiento: { notIn: [...PRESERVADOS.reportesExcluidos] },
        },
        select: { id: true, numeroSeguimiento: true },
    });
}

/**
 * Garantía de `--purga-total`: la migración S-D exige las tablas de denuncia VACÍAS (agrega
 * `contenidoId` NOT NULL). SPEC-905 suma los AGREGADOS/MARCADORES (IdentificadorReportado /
 * EventoMatch / DemoMarcado) — el reset los recalcula a 0 pero la FILA queda, y la consulta pública
 * los cuenta — y el barrido de usuarios (solo soporte@ debe sobrevivir). Si algo quedó, ABORTA
 * ruidoso ANTES de la ventana en vez de dejar texto cifrado de denuncias o agregados vivos.
 */
export async function afirmarPurgaTotalCompleta(client: PrismaClient = prisma): Promise<void> {
    const [reportes, eventos, contenidos, llaves, identificadores, matches, demo, usuariosNoSoporte] =
        await Promise.all([
            client.reporte.count(),
            client.eventoExpediente.count(),
            client.contenidoReporte.count(),
            client.llaveReporte.count(),
            client.identificadorReportado.count(),
            client.eventoMatch.count(),
            client.demoMarcado.count(),
            client.usuario.count({ where: { email: { notIn: [...PRESERVADOS.usuarios] } } }),
        ]);
    const problemas: string[] = [];
    if (reportes) problemas.push(`Reporte=${reportes}`);
    if (eventos) problemas.push(`EventoExpediente=${eventos}`);
    if (contenidos) problemas.push(`ContenidoReporte=${contenidos}`);
    if (llaves) problemas.push(`LlaveReporte=${llaves}`);
    if (identificadores) problemas.push(`IdentificadorReportado=${identificadores}`);
    if (matches) problemas.push(`EventoMatch=${matches}`);
    if (demo) problemas.push(`DemoMarcado=${demo}`);
    if (usuariosNoSoporte) problemas.push(`Usuario(≠soporte@)=${usuariosNoSoporte}`);
    if (problemas.length > 0) {
        throw new Error(
            `[reset-piloto] --purga-total NO dejó todo en 0: ${problemas.join(" ")}. ` +
                "La migración S-D exige vacías las de denuncia; los agregados deben irse (la consulta " +
                "pública los cuenta) y solo soporte@ debe sobrevivir. Revisá qué quedó antes de la ventana.",
        );
    }
}

/**
 * SPEC-905 · DECISIÓN 1 (LEGAL, conciliada con el CEO/Jelkin). ⚠️ `--purga-total` DESTRUYE la
 * evidencia de consentimiento (audit_consentimientos, Ley 1581). NO hay copia inmutable hasta la
 * migración P1-A (ConstanciaConsentimiento) → esto es SOLO para pre-lanzamiento / disaster / reset
 * «desde cero», JAMÁS contra prod con familias reales. El borrado se DOCUMENTA (AuditLog con el
 * conteo + motivo) y, al hacerse acá PRIMERO, el guard `bloquearSiHayConsentimiento` de borrar-padre/
 * profesional/colegio ve 0 y pasa — el guard queda INTACTO para los borrados quirúrgicos (allí la
 * evidencia se preserva siempre). Cuando exista P1-A la constancia inmutable sobrevive y esto deja
 * de destruir evidencia.
 */
export async function destruirConsentimientosPurgaTotal(
    client: PrismaClient,
    soporteId: string,
    motivo: string,
): Promise<number> {
    const n = await client.auditConsentimiento.count({ where: { usuarioId: { not: soporteId } } });
    await client.$transaction(async (tx) => {
        // AuditLog se preserva (seed) → la constancia de QUÉ se destruyó sobrevive a la purga.
        await registrarAuditoria(
            tx,
            "reset_piloto",
            `${motivo} [PURGA-TOTAL destruye ${n} AuditConsentimiento — evidencia Ley 1581, sin copia inmutable hasta P1-A]`,
            n,
            ["audit_consentimientos"],
        );
        await tx.auditConsentimiento.deleteMany({ where: { usuarioId: { not: soporteId } } });
    });
    log("reset-piloto", `⚠️ PURGA-TOTAL: destruidas ${n} constancia(s) de consentimiento (documentado en AuditLog).`);
    return n;
}

/**
 * SPEC-905 · barrido FINAL de `--purga-total`, tras los loops (colegios/padres/profesionales/
 * reportes/simulaciones). Borra, en orden FK-safe, lo que NO cuelga de una entidad looped:
 * autoría de STAFF (operadores/comité/admin), recomendaciones, facturación suelta, y los AGREGADOS.
 * Luego RE-APUNTA el autor del seed a soporte@ y borra TODOS los usuarios salvo soporte@. Deja la
 * base en «cero + soporte@ + seed».
 */
export async function barridoPurgaTotal(client: PrismaClient, soporteId: string, motivo: string): Promise<void> {
    await client.$transaction(async (tx) => {
        // ── recomendaciones (hijas → reglas_recomendacion[seed]; ejecuciones → recomendaciones) ──
        await tx.ejecucionAccion.deleteMany({});
        await tx.recomendacion.deleteMany({});
        await tx.reglaRecomendacionHistorial.deleteMany({}); // → reglas_recomendacion(seed) + Usuario
        // ── facturación suelta (staff con suscripción personal) · orden: hijas → Suscripcion ──
        await tx.bonoAplicado.deleteMany({});
        await tx.codigoReferidoUso.deleteMany({});
        await tx.pago.deleteMany({});
        await tx.suscripcion.deleteMany({});
        await tx.bonoPromocional.deleteMany({}); // → Usuario (creadoPorAdminId)
        // ── apelaciones sueltas (cascade: DocumentoApelacion → AccesoDocumentoApelacion) ──
        await tx.apelacion.deleteMany({});
        await tx.alertaSuscripcion.deleteMany({});
        await tx.codigoAccesoContenido.deleteMany({});
        // ── notificaciones / digests / block-list / contactos / códigos de staff ──
        await tx.notificacionInApp.deleteMany({});
        await tx.digestSemanal.deleteMany({});
        await tx.blockList.deleteMany({});
        await tx.contactoEmergencia.deleteMany({});
        await tx.contactoConfianza.deleteMany({});
        await tx.codigoVerificacion.deleteMany({});
        await tx.tokenRecuperacion.deleteMany({});
        // ── perfiles de staff (operador / integrante de comité suelto) ──
        await tx.perfilOperador.deleteMany({});
        await tx.integranteComite.deleteMany({});
        // ── simulaciones por autor staff (el loop borró por run; esto es el cinturón) ──
        await tx.simulacionAbusoRun.deleteMany({});
        await tx.simulacionRun.deleteMany({});
        // ── subárbol profesional · cinturón del loop borrarProfesional (cubre perfiles huérfanos por
        //    drift de rol). Orden FK-safe: SolicitudCita → FranjaDisponible → VerificacionProfesional →
        //    AceptacionAutorizacion → PerfilProfesional (cascade: DocumentoProfesional/RevisionRenovacion/DiaBloqueado). ──
        await tx.solicitudCita.deleteMany({});
        await tx.franjaDisponible.deleteMany({});
        await tx.verificacionProfesional.deleteMany({});
        await tx.aceptacionAutorizacionProfesional.deleteMany({});
        await tx.perfilProfesional.deleteMany({});
        // ── AGREGADOS/MARCADORES (SPEC-905 · I-446 a escala de reset) · EventoMatch antes de Identificador ──
        await tx.eventoMatch.deleteMany({});
        await tx.identificadorReportado.deleteMany({});
        await tx.demoMarcado.deleteMany({});
        // ── RE-APUNTE del autor del seed a soporte@ (NOT NULL · no se puede nulear) ANTES del wipe ──
        // Herramienta destructiva que RE-ATRIBUYE datos seed → el AuditLog registra el EFECTO runtime
        // (qué/cuántas filas) además del comentario de diseño, para que el rastro del purga-total sea
        // auditable (CEO · decisión 4).
        const planR = await tx.plan.updateMany({ data: { creadoPorAdminId: soporteId } });
        const guiaR = await tx.guiaAccionCategoria.updateMany({ data: { creadaPorAdminId: soporteId } });
        const reglaR = await tx.reglaRecomendacion.updateMany({ data: { creadaPorAdminId: soporteId } });
        const reapuntadas = planR.count + guiaR.count + reglaR.count;
        // ── wipe final de usuarios · solo soporte@ sobrevive ──
        const u = await tx.usuario.deleteMany({ where: { email: { notIn: [...PRESERVADOS.usuarios] } } });
        await registrarAuditoria(
            tx,
            "reset_piloto",
            `${motivo} [barrido-final purga-total · re-apuntadas ${reapuntadas} filas de seed a soporte@ ` +
                `(Plan=${planR.count}/GuiaAccionCategoria=${guiaR.count}/reglas_recomendacion=${reglaR.count}) · ${u.count} usuarios borrados]`,
            u.count + reapuntadas,
            ["usuarios", "seed:reapuntado-a-soporte"],
        );
        log("reset-piloto", `Barrido final: ${u.count} usuario(s) borrados, ${reapuntadas} fila(s) de seed re-apuntadas a soporte@ (solo soporte@ sobrevive).`);
    });
}

/**
 * Núcleo del reset (post-backup), parametrizado por `client` para que el ensayo de integración
 * (SPEC-905) corra el MISMO camino contra la BD de test. `main` hace el pg_dump y delega acá.
 * `--purga-total` agrega: destrucción documentada de consentimiento (ANTES de los loops, para que
 * sus guards vean 0), loop de profesionales (borrarProfesional), barrido final (staff + agregados +
 * re-apunte de seed + wipe de usuarios) y la aserción extendida.
 */
export async function ejecutarResetPiloto(
    client: PrismaClient,
    opts: { motivo: string; purgaTotal: boolean; backupSize?: number },
): Promise<ResumenReset> {
    const { motivo, purgaTotal } = opts;
    const backupSize = opts.backupSize ?? 0;

    // soporte@ debe existir: es el único usuario que sobrevive y el nuevo autor del seed.
    const soporte = await client.usuario.findUnique({
        where: { email: PRESERVADOS.usuarios[0] },
        select: { id: true },
    });
    if (purgaTotal && !soporte) {
        throw new Error(`[reset-piloto] --purga-total requiere el usuario ${PRESERVADOS.usuarios[0]} (autor del seed / único sobreviviente).`);
    }

    // SPEC-905 · DECISIÓN 1: en purga-total, destruir (documentado) la evidencia de consentimiento
    // PRIMERO, para que el guard SPEC-508 de los helpers vea 0 y pase (queda intacto para quirúrgico).
    if (purgaTotal && soporte) {
        await destruirConsentimientosPurgaTotal(client, soporte.id, motivo);
    }

    // A-66 (b): pre-borrado global del subárbol identificadores+alertas en orden FK-safe ANTES del
    // loop por colegio. AlertaColegio cruza tenants: una alerta del colegio Y puede referenciar un
    // identificador del colegio X, así que borrar X sin eliminar esa alerta de Y causa FK.
    log("reset-piloto", "Pre-borrado global: SolicitudComite, AlertaColegio, identificadores, observaciones...");
    await client.$transaction(async (tx) => {
        await tx.solicitudComite.deleteMany({});
        await tx.notaSeguimiento.deleteMany({});
        // SPEC-351: InformeCaso sin Cascade — explícito antes del caso.
        await tx.informeCaso.deleteMany({});
        await tx.seguimientoCaso.deleteMany({});
        await tx.alertaColegio.deleteMany({});
        await tx.identificadorProfesor.deleteMany({});
        await tx.identificadorEstudiante.deleteMany({});
        await tx.identificadorAcudiente.deleteMany({});
        // SPEC-905: faltaba — IdentificadorIntegranteComite (→ Colegio RESTRICT) cascadea de
        // IntegranteComite SOLO si el colegio tiene comité; sin comité quedaba vivo y trababa el
        // borrado del Colegio. Se barre acá explícito, como los otros identificadores.
        await tx.identificadorIntegranteComite.deleteMany({});
        await tx.estudianteObservacion.deleteMany({});
        await tx.acudienteEstudiante.deleteMany({});
    });
    log("reset-piloto", "Pre-borrado global completado.");

    const colegios = await client.colegio.findMany({ select: { id: true, nombre: true } });
    log("reset-piloto", `Colegios a borrar: ${colegios.length}`);
    for (const c of colegios) {
        await borrarColegio(c.id, motivo, { confirm: true, client });
    }

    const padres = await client.usuario.findMany({
        where: { rol: "PARENT", email: { notIn: [...PRESERVADOS.usuarios] } },
        select: { id: true, email: true },
    });
    log("reset-piloto", `Padres a borrar: ${padres.length}`);
    for (const p of padres) {
        await borrarPadre(p.email, motivo, { confirm: true, client });
    }

    // SPEC-905 · profesionales (A-75): el reset NO los borraba. borrarProfesional baja el subárbol
    // de agenda/verificación + el usuario. Solo en purga-total (el reset normal preserva staff).
    let profesionales: { email: string }[] = [];
    if (purgaTotal) {
        profesionales = await client.usuario.findMany({
            where: { rol: "PROFESIONAL", email: { notIn: [...PRESERVADOS.usuarios] } },
            select: { email: true },
        });
        log("reset-piloto", `Profesionales a borrar: ${profesionales.length}`);
        for (const p of profesionales) {
            await borrarProfesional(p.email, motivo, { confirm: true, client });
        }
    }

    const reportesABorrar = await seleccionarReportesABorrar(purgaTotal);
    log("reset-piloto", `Reportes a borrar (${purgaTotal ? "purga-total" : "normal"}): ${reportesABorrar.length}`);
    for (const r of reportesABorrar) {
        await borrarReporte(r.id, motivo, { confirm: true, client });
    }

    const simulaciones = await client.simulacionRun.findMany({ select: { id: true } });
    log("reset-piloto", `Simulaciones a borrar: ${simulaciones.length}`);
    for (const s of simulaciones) {
        await borrarSimulacion(s.id, motivo, { confirm: true, client });
    }

    // S-D (CEO 06-09 · RISK 1) · barrido de contenido cifrado HUÉRFANO (cinturón: contenido sin
    // dueño vivo, su DEK cae por Cascade en LlaveReporte). No toca el de reportes preservados vivos.
    const contenidoHuerfano = await client.$executeRawUnsafe(`
        DELETE FROM "ContenidoReporte" c
         WHERE NOT EXISTS (SELECT 1 FROM "Reporte" r          WHERE r."contenidoId" = c.id)
           AND NOT EXISTS (SELECT 1 FROM "EventoExpediente" e WHERE e."contenidoId" = c.id)
    `);
    log("reset-piloto", `Contenido cifrado huérfano barrido: ${contenidoHuerfano} filas (LlaveReporte cae por Cascade).`);

    // SPEC-905 · barrido final de purga-total: staff + agregados + re-apunte de seed + wipe de usuarios.
    if (purgaTotal && soporte) {
        await barridoPurgaTotal(client, soporte.id, motivo);
        await afirmarPurgaTotalCompleta(client);
        log("reset-piloto", "--purga-total verificado: denuncia + agregados en 0, solo soporte@ sobrevive.");
    }

    const resumen: ResumenReset = {
        backupSize,
        colegios: colegios.map((c) => c.id),
        padres: padres.map((p) => p.email),
        reportesHuerfanos: reportesABorrar.map((r) => r.numeroSeguimiento ?? r.id),
        simulaciones: simulaciones.map((s) => s.id),
    };
    const totalIds =
        resumen.colegios.length + resumen.padres.length + profesionales.length +
        resumen.reportesHuerfanos.length + resumen.simulaciones.length;

    await client.$transaction(async (tx) => {
        await registrarAuditoria(tx, "reset_piloto", motivo, totalIds, [
            ...resumen.colegios,
            ...resumen.padres,
            ...resumen.reportesHuerfanos,
            ...resumen.simulaciones,
        ]);
    });

    log("reset-piloto", `REALIZADO backup=${backupSize}B colegios=${resumen.colegios.length} padres=${resumen.padres.length} profesionales=${profesionales.length} reportes=${resumen.reportesHuerfanos.length} simulaciones=${resumen.simulaciones.length}`);
    return resumen;
}

async function main(): Promise<void> {
    const args = parseArgs(process.argv, ["motivo", "backup", "confirm", "solo-sembrado", "purga-total"]);
    const motivo = requerirMotivo(typeof args.motivo === "string" ? args.motivo : undefined);
    const backup = typeof args.backup === "string" ? args.backup : "";
    if (!backup) throw new Error("[reset-piloto] Falta --backup=<ruta.sql>");
    if (args.confirm !== true) throw new Error("[reset-piloto] Falta --confirm");
    // D-113 / ventana S-D: --purga-total IGNORA los reportes «preservados» (ya son dato de
    // prueba), destruye agregados/consentimiento y deja solo soporte@ + seed.
    const purgaTotal = args["purga-total"] === true;

    const backupSize = ejecutarBackup(backup);

    // SPEC-412: modo quirúrgico. Cae SOLO lo que está en `demo_marcado`; lo real se conserva.
    if (args["solo-sembrado"] === true) {
        await resetSoloSembrado(motivo, backupSize);
        return;
    }

    await ejecutarResetPiloto(prisma, { motivo, purgaTotal, backupSize });
}

if (process.argv[1]?.endsWith("reset-piloto.ts")) {
    main()
        .catch((err: unknown) => {
            console.error("[reset-piloto] Error:", err instanceof Error ? err.message : err);
            process.exitCode = 1;
        })
        .finally(() => prisma.$disconnect());
}
