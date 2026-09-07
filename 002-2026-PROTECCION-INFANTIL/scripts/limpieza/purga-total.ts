/**
 * SPEC-578 (D-113, 2026-09-07) — purga TOTAL de datos de prueba.
 *
 * Borra TODO lo que la decisión del dueño del producto clasifica como dato de
 * prueba y preserva SIEMPRE la configuración del producto (ver
 * scripts/limpieza/CLASIFICACION-PURGA.md, contrato de la purga). D-113 revoca
 * la preservación de los 3 reportes «evidencia viva»: también caen.
 *
 * Regla: PRESERVAR = configuración/seed del producto · BORRAR = dato de prueba.
 *
 * Uso directo (normalmente se invoca vía reset-piloto --purga-total):
 *   node --env-file=.env --import tsx -e "..."
 *
 * Compuerta final: si Reporte ≠ 0, si queda algún usuario que no sea el
 * preservado, o si se movió el conteo de cualquier modelo preservado → throw.
 *
 * Los modelos se recorren con acceso dinámico sobre la lista cerrada
 * ENTIDADES_BORRADO_PURGA_TOTAL: el candado purga-total.candado.test.ts cruza
 * esa lista contra CLASIFICACION-PURGA.md y contra el schema.
 */
import type { PrismaClient, Prisma } from "@prisma/client";
import { log, registrarAuditoria, PRESERVA_SIEMPRE } from "./_common";

/** Diez minutos: la purga total de un piloto poblado no cabe en 5 s por defecto. */
const TIMEOUT_TX_MS = 10 * 60 * 1000;

/**
 * Orden FK-safe de las entidades BORRAR (hojas primero, padres después).
 * Mantener sincronizado con CLASIFICACION-PURGA.md — el candado lo verifica.
 */
export const ENTIDADES_BORRADO_PURGA_TOTAL: readonly string[] = [
    // Fase 2 — subárbol del reporte
    "SolicitudComite",
    "CorreccionAdmin",
    "ClasificacionIA",
    "EventoMatch",
    "FuenteReporte",
    "TransicionReporte",
    "ReintentoReporte",
    "PasoProcesamiento",
    "SimulacionReporte",
    "ClasificacionRubricaVoto",
    "EmbeddingReporte",
    "AlertaColegio",
    "Reporte",
    // Fase 3 — expedientes y casos
    "InformeCaso",
    "NotaSeguimiento",
    "AnalisisExpediente",
    "SeguimientoCaso",
    "AclaracionExpediente",
    "InformePadre",
    "InformeConsolidado",
    "PatronExpediente",
    "SenalComunitariaCache",
    "EventoExpediente",
    "Expediente",
    // Fase 4 — colegio/aula
    "IntegranteComite",
    "IdentificadorIntegranteComite",
    "CursoMateria",
    "Materia",
    "IdentificadorProfesor",
    "IdentificadorEstudiante",
    "IdentificadorAcudiente",
    "EstudianteObservacion",
    "AcudienteEstudiante",
    "Estudiante",
    "Profesor",
    "Curso",
    "PatronInstitucional",
    "CargaRosterSesion",
    "NotificacionInApp",
    "PreferenciaAlertaColegio",
    "RegistroAvisoColegio",
    "OnboardingColegio",
    "Colegio",
    "Tenant",
    // Fase 5 — familia, anti-abuso y agregados globales
    "IdentificadorContacto",
    "ContactoConfianza",
    "HijoPadre",
    "IdentificadorHijoDesvinculado",
    "IdentificadorHijo",
    "Hijo",
    "ContactoEmergencia",
    "AlertaSuscripcion",
    "AccesoDocumentoApelacion",
    "DocumentoApelacion",
    "Apelacion",
    "IdentificadorReportado",
    // Fase 6 — comercial
    "BonoAplicado",
    "CodigoReferidoUso",
    "ScoreCliente",
    "Pago",
    "Suscripcion",
    "BonoPromocional",
    "Subscription",
    "BillingCycle",
    "TasaCambio",
    // Fase 7 — notificaciones
    "Notificacion",
    "NotificacionPreferencia",
    "NotificacionContactoBloqueado",
    "DigestSemanal",
    // Fase 8 — análisis
    "EjecucionAccion",
    "Recomendacion",
    "ReglaRecomendacionHistorial",
    "Anomalia",
    // Fase 9 — red de profesionales
    "EncuestaPrimeraCita",
    "SolicitudCita",
    "FranjaDisponible",
    "VerificacionProfesional",
    "DocumentoProfesional",
    "PerfilProfesional",
    // Fase 10 — operadores
    "PerfilOperador",
    // Fase 11 — tokens, logs y simuladores
    "CodigoVerificacion",
    "TokenRecuperacion",
    "TokenRegistro",
    "SesionLog",
    "AuditConsentimiento",
    "RateLimit",
    "BlockList",
    "SimulacionAbusoRun",
    "SimulacionRun",
    "HealthProbe",
    "IncidenteInfra",
    "WorkerLog",
    "DerivaMotorSnapshot",
    // Fase 13 — marcas demo (lo último: vacía el marcador)
    "DemoMarcado",
] as const;

interface DelegadoBorrado {
    count(args?: unknown): Promise<number>;
    deleteMany(args?: unknown): Promise<{ count: number }>;
    updateMany(args: unknown): Promise<{ count: number }>;
}

/** Acceso dinámico deliberado: `entidad` viene de la lista cerrada de arriba. */
function delegado(client: PrismaClient | Prisma.TransactionClient, entidad: string): DelegadoBorrado {
    const nombre = entidad.charAt(0).toLowerCase() + entidad.slice(1);
    // @ts-expect-error — acceso dinámico verificado: el candado cruza la lista
    // cerrada ENTIDADES_BORRADO_PURGA_TOTAL contra el schema Prisma.
    const d = client[nombre] as DelegadoBorrado | undefined;
    if (!d || typeof d.deleteMany !== "function") {
        throw new Error(`[purga-total] No existe el modelo Prisma "${nombre}" para la entidad "${entidad}".`);
    }
    return d;
}

export interface ResumenPurgaTotal {
    dryRun: boolean;
    filasBorradas: number;
    detalle: Record<string, number>;
    preservadosAntes: Record<string, number>;
    preservadosDespues: Record<string, number>;
}

/**
 * Ejecuta la purga total. Con `confirm: false` solo imprime el plan (conteos)
 * sin borrar nada.
 *
 * Config con FK requerida a `Usuario` (Plan, GuiaAccionCategoria,
 * ReglaRecomendacion): sus filas se preservan pero la FK obliga a un dueño
 * válido, así que se reasignan a `soporte@innovadataco.com` antes de borrar
 * usuarios. `AuditLog` queda intacto (append-only): sus FKs nullable hacen
 * SetNull y las entradas de prueba quedan como histórico.
 */
export async function purgarTodo(
    client: PrismaClient,
    opts: { motivo: string; confirm: boolean; emailsPreservados?: readonly string[] },
): Promise<ResumenPurgaTotal> {
    const emails = opts.emailsPreservados ?? PRESERVA_SIEMPRE.usuarios;
    const modeloPreservados = [...PRESERVA_SIEMPRE.modelos];

    const soporte = await client.usuario.findFirst({
        where: { email: { in: [...emails] } },
        select: { id: true, email: true },
    });
    if (!soporte) {
        throw new Error(`[purga-total] No existe el usuario preservado (${emails.join(", ")}): no se puede reasignar la config ni cerrar la compuerta.`);
    }

    // ── Plan visible: conteo de cada entidad ANTES de tocar nada ─────────────
    const detalle: Record<string, number> = {};
    log("purga-total", `PLAN DE BORRADO (${ENTIDADES_BORRADO_PURGA_TOTAL.length} entidades) — modo ${opts.confirm ? "REAL" : "DRY-RUN"} — motivo: ${opts.motivo}`);
    for (const entidad of ENTIDADES_BORRADO_PURGA_TOTAL) {
        const n = await delegado(client, entidad).count();
        detalle[entidad] = n;
        if (n > 0) log("purga-total", `  · ${entidad}: ${n}`);
    }
    log("purga-total", "PRESERVA SIEMPRE (conteo base para la compuerta):");
    const preservadosAntes: Record<string, number> = {};
    for (const entidad of modeloPreservados) {
        const n = await delegado(client, entidad).count();
        preservadosAntes[entidad] = n;
        log("purga-total", `  · ${entidad}: ${n}`);
    }

    if (!opts.confirm) {
        log("purga-total", "DRY-RUN: no se borró nada.");
        return { dryRun: true, filasBorradas: 0, detalle, preservadosAntes, preservadosDespues: preservadosAntes };
    }

    // ── Borrado en una sola transacción (FK-safe por construcción del orden) ──
    const borradas = await client.$transaction(async (tx) => {
        const borradasTx: Record<string, number> = {};

        // Fase 1 — reasignar la config preservada al usuario preservado (FK
        // requerida a Usuario: la config sobrevive, el dueño pasa a soporte@).
        const reasignaciones = [
            { entidad: "Plan", campo: "creadoPorAdminId" },
            { entidad: "GuiaAccionCategoria", campo: "creadaPorAdminId" },
            { entidad: "ReglaRecomendacion", campo: "creadaPorAdminId" },
        ] as const;
        for (const r of reasignaciones) {
            const res = await delegado(tx, r.entidad).updateMany({
                where: { [r.campo]: { not: soporte.id } },
                data: { [r.campo]: soporte.id },
            });
            if (res.count > 0) log("purga-total", `  · ${r.entidad}: ${res.count} filas reasignadas a ${soporte.email}`);
        }

        // Fases 2–4 y 5–11: desvinculaciones explícitas de self-relations y
        // deletes dinámicos en el orden FK-safe de ENTIDADES_BORRADO_PURGA_TOTAL.
        await delegado(tx, "Reporte").updateMany({ data: { reportePrincipalId: null } });
        await delegado(tx, "Expediente").updateMany({ data: { expedienteRelacionadoAnteriorId: null } });
        await delegado(tx, "SolicitudCita").updateMany({ data: { solicitudPreviaId: null, pagoHeredadoDeId: null } });

        for (const entidad of ENTIDADES_BORRADO_PURGA_TOTAL) {
            const res = await delegado(tx, entidad).deleteMany({});
            borradasTx[entidad] = res.count;
        }

        // Fase 12 — usuarios: soltar vínculos a colegio/tenant y borrar todos
        // menos los preservados.
        await tx.usuario.updateMany({ data: { colegioId: null, comiteColegioId: null, tenantId: null } });
        const usuariosBorrados = await tx.usuario.deleteMany({ where: { email: { notIn: [...emails] } } });
        borradasTx["Usuario"] = usuariosBorrados.count;

        const total = Object.values(borradasTx).reduce((a, b) => a + b, 0);
        await registrarAuditoria(tx, "purga_total", opts.motivo, total, ["*"], soporte.id);
        return borradasTx;
    }, { timeout: TIMEOUT_TX_MS, maxWait: 30_000 });

    const filasBorradas = Object.values(borradas).reduce((a, b) => a + b, 0);
    log("purga-total", `Borrado completado: ${filasBorradas} filas.`);

    // ── Compuerta: lo preservado intacto + reportes y usuarios en cero ───────
    const reportes = await client.reporte.count();
    const usuariosRestantes = await client.usuario.findMany({ select: { email: true } });
    const preservadosDespues: Record<string, number> = {};
    for (const entidad of modeloPreservados) {
        preservadosDespues[entidad] = await delegado(client, entidad).count();
    }

    const fallos: string[] = [];
    if (reportes !== 0) fallos.push(`Reporte=${reportes} (esperado 0)`);
    const noPreservados = usuariosRestantes.map((u) => u.email).filter((e) => !emails.includes(e));
    if (noPreservados.length > 0) fallos.push(`usuarios no preservados: ${noPreservados.join(", ")}`);
    for (const entidad of modeloPreservados) {
        if (preservadosDespues[entidad] !== preservadosAntes[entidad]) {
            fallos.push(`${entidad}: ${preservadosAntes[entidad]} → ${preservadosDespues[entidad]} (conteo preservado movido)`);
        }
    }
    if (fallos.length > 0) {
        throw new Error(`[purga-total] COMPUERTA FALLIDA — ${fallos.join(" · ")}`);
    }

    log("purga-total", `REALIZADO purga-total filas=${filasBorradas} usuariosRestantes=${usuariosRestantes.length} compuerta=OK`);
    return { dryRun: false, filasBorradas, detalle: borradas, preservadosAntes, preservadosDespues };
}
