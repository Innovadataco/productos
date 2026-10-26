/**
 * SPEC-905 · ENSAYO de --purga-total contra la BD REAL (grafo FK actual del reset).
 *
 * El reset-piloto/borrar-* quedó STALE: no cubría facturación (Pago→Suscripcion), citas,
 * profesionales ni los agregados (IdentificadorReportado/EventoMatch/DemoMarcado), y el wipe de
 * usuarios chocaba con FK RESTRICT + con el seed (Plan/Guia/reglas apuntan al admin creador, NOT
 * NULL). Un test con MOCKS no ve un orden de FK (lección I-374): éste SIEMBRA un grafo representativo
 * de CADA categoría nueva y corre el camino REAL (`ejecutarResetPiloto(..., purgaTotal:true)`). Si el
 * orden está mal, la constraint REAL lo tumba ACÁ (rojo), nombrando la FK — no en la próxima ventana.
 *
 * Afirma lo que el CEO pidió: la base queda en «cero + soporte@ + seed», los AGREGADOS en 0 (la
 * consulta pública los cuenta), el autor del seed RE-APUNTADO a soporte@, y la evidencia de
 * consentimiento DESTRUIDA (decisión 1, documentada). Integración: usa la BD (FKs reales).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { randomBytes, randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearPaisCiudad, crearPlataforma, crearParametrosReportes } from "@/lib/reporte-test-utils";
import { hashPassword } from "@/lib/auth";
import { crearReporteConTexto } from "@/lib/dal/services/crear-reporte-con-texto";
import { ejecutarResetPiloto, afirmarPurgaTotalCompleta } from "../../scripts/limpieza/reset-piloto";
import { borrarProfesional } from "../../scripts/limpieza/borrar-profesional";

const SOPORTE = "soporte@innovadataco.com";
const MOTIVO = "ensayo SPEC-905 reset grafo fk actual";

async function crearSoporte() {
    return crearUsuario("ADMIN", SOPORTE);
}

/** Siembra un profesional ACTIVO con su subárbol de agenda/verificación. Devuelve ids. */
async function sembrarProfesional(ciudadId: string, revisorId: string) {
    const uEmail = `prof-${randomUUID()}@example.com`;
    const usuario = await prisma.usuario.create({
        data: { email: uEmail, nombre: "Profe", passwordHash: await hashPassword("TestPass123"), rol: "PROFESIONAL", estado: "activo" },
    });
    const perfil = await prisma.perfilProfesional.create({
        data: {
            usuarioId: usuario.id, nombreVisible: "Profe Test", tituloProfesional: "Psicología",
            especialidades: ["infantil"], ciudadId, aniosExperiencia: 5, presentacion: "Presentación.",
            tarifaConsultaCOP: 150000, duracionMinutos: 45, atiendeVirtual: true, estado: "ACTIVO",
        },
    });
    const aceptacion = await prisma.aceptacionAutorizacionProfesional.create({
        data: { usuarioId: usuario.id, version: "v1", documentoHash: `h-${randomUUID()}`, ip: "127.0.0.1" },
    });
    await prisma.verificacionProfesional.create({
        data: {
            perfilProfesionalId: perfil.id, revisadoPorId: revisorId, checklist: {}, resultado: "APROBADO",
            venceEn: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000), aceptacionAutorizacionId: aceptacion.id,
        },
    });
    const franja = await prisma.franjaDisponible.create({
        data: { profesionalId: perfil.id, inicio: new Date(Date.now() + 86400000), fin: new Date(Date.now() + 90000000), modalidad: "VIRTUAL" },
    });
    return { usuario, perfil, franja };
}

describe("SPEC-905 · borrarProfesional contra BD real (subárbol de agenda/verificación)", () => {
    beforeEach(async () => {
        await resetDatabase();
        process.env.REPORTE_TEXTO_KEY_V1 = randomBytes(32).toString("base64");
        process.env.REPORTE_TEXTO_KEY_ACTIVA = "1";
    });

    it("borra el subárbol profesional + el usuario sin violar FK", async () => {
        const { ciudad } = await crearPaisCiudad();
        const revisor = await crearUsuario("VERIFICADOR");
        const { usuario, perfil } = await sembrarProfesional(ciudad.id, revisor.id);

        // PRE: el subárbol existe.
        expect(await prisma.perfilProfesional.count({ where: { id: perfil.id } })).toBe(1);
        expect(await prisma.verificacionProfesional.count({ where: { perfilProfesionalId: perfil.id } })).toBe(1);
        expect(await prisma.franjaDisponible.count({ where: { profesionalId: perfil.id } })).toBe(1);

        await expect(borrarProfesional(usuario.email, MOTIVO, { confirm: true })).resolves.toMatchObject({ dryRun: false });

        // POST: subárbol + usuario en 0. Si el orden estuviera mal, la FK habría tumbado el borrado arriba.
        expect(await prisma.verificacionProfesional.count({ where: { perfilProfesionalId: perfil.id } })).toBe(0);
        expect(await prisma.franjaDisponible.count({ where: { profesionalId: perfil.id } })).toBe(0);
        expect(await prisma.aceptacionAutorizacionProfesional.count({ where: { usuarioId: usuario.id } })).toBe(0);
        expect(await prisma.perfilProfesional.count({ where: { id: perfil.id } })).toBe(0);
        expect(await prisma.usuario.count({ where: { id: usuario.id } })).toBe(0);
        // El revisor (otro usuario) NO se toca en el borrado quirúrgico.
        expect(await prisma.usuario.count({ where: { id: revisor.id } })).toBe(1);
    });
});

describe("SPEC-905 · ejecutarResetPiloto --purga-total end-to-end (una sola corrida)", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearParametrosReportes();
        process.env.REPORTE_TEXTO_KEY_V1 = randomBytes(32).toString("base64");
        process.env.REPORTE_TEXTO_KEY_ACTIVA = "1";
    });

    it("deja «cero + soporte@ + seed»: agregados en 0, seed re-apuntado, consentimiento destruido", async () => {
        const soporte = await crearSoporte();
        const admin = await crearUsuario("ADMIN");
        const { ciudad } = await crearPaisCiudad();
        const plataforma = await crearPlataforma();

        // ── SEED autoría del admin (lo que RE-APUNTA a soporte@) ──
        const plan = await prisma.plan.create({
            data: { tipoTitular: "PADRE", duracion: "MES_12", anio: 2026, nombre: `Plan ${randomUUID()}`, precioBaseUSD: 100, precio: 0, creadoPorAdminId: admin.id },
        });
        const guia = await prisma.guiaAccionCategoria.create({
            data: { categoria: `cat-${randomUUID()}`, versionSecuencial: 1, tituloEmocional: "T", categoriaBadgeTexto: "B", pasosJson: {}, botonesAccionJson: {}, estado: "ACTIVA", creadaPorAdminId: admin.id },
        });
        const regla = await prisma.reglaRecomendacion.create({
            data: { clave: `k-${randomUUID()}`, nombre: "R", descripcion: "D", categoria: "churn", sqlQuery: "SELECT 1", plantillaRecomendacion: "{{x}}", creadaPorAdminId: admin.id },
        });
        await prisma.reglaRecomendacionHistorial.create({
            data: { reglaId: regla.id, version: 1, snapshot: {}, motivo: "m", cambiadoPorAdminId: admin.id },
        });

        // ── un PADRE con facturación + apelación + alerta + consentimiento + reporte ──
        const padre = await crearUsuario("PARENT");
        const suscripcion = await prisma.suscripcion.create({
            data: {
                tipoTitular: "PADRE", usuarioId: padre.id, planActualId: plan.id, estado: "ACTIVA",
                fechaInicio: new Date(), fechaFin: new Date(Date.now() + 30 * 86400000),
                codigoReferidoPropio: `ref-${randomUUID()}`, monedaLocal: "COP", paisCliente: "CO",
            },
        });
        const bono = await prisma.bonoPromocional.create({
            data: { nombre: `bono-${randomUUID()}`, tipo: "DESCUENTO_FIJO_USD", valor: 10, vigenciaInicio: new Date(), vigenciaFin: new Date(Date.now() + 86400000), creadoPorAdminId: admin.id },
        });
        const pago = await prisma.pago.create({
            data: {
                suscripcionId: suscripcion.id, duracionCubierta: "MES_12", montoBaseUSD: 100, montoNetoUSD: 90,
                tasaCambioAplicada: 4000, montoLocalPagado: 360000, monedaLocal: "COP", metodoDeclarado: "NEQUI",
                comprobanteAdjuntoUrl: "http://x", comprobanteMimeType: "image/png", comprobanteHashSha256: "abc",
                fechaReporte: new Date(), estado: "AUTORIZADO",
            },
        });
        await prisma.bonoAplicado.create({ data: { bonoId: bono.id, suscripcionId: suscripcion.id, pagoId: pago.id, descuentoUSD: 10 } });
        await prisma.codigoReferidoUso.create({ data: { codigoReferidoUsuarioId: suscripcion.id, suscripcionReferidaId: suscripcion.id, anio: 2026 } });
        await prisma.apelacion.create({
            data: { numero: `AP-${randomUUID()}`, usuarioId: padre.id, identificador: "+57300X", plataformaId: plataforma.id, motivo: "m", plazoRespuestaEn: new Date(Date.now() + 86400000) },
        });
        await prisma.alertaSuscripcion.create({
            data: { usuarioId: padre.id, plataformaId: plataforma.id, identificador: "+57300X" },
        });
        await prisma.auditConsentimiento.create({
            data: { usuarioId: padre.id, version: "v0.4", documentoTipo: "TERMINOS", documentoHash: `h-${randomUUID()}`, ip: "127.0.0.1" },
        });

        // Vía autorizada (arch:check g · S-D · D-116): el factory sella el texto y crea el Reporte.
        const reporte = await prisma.$transaction((tx) =>
            crearReporteConTexto(tx, {
                texto: "reporte de prueba",
                reporte: {
                    identificador: "+57300CASO", plataformaId: plataforma.id, fechaIncidente: new Date(),
                    ciudad: "Bogotá", pais: "Colombia", usuarioId: padre.id,
                },
            }),
        );

        // ── AGREGADOS (I-446 a escala de reset) ──
        const ident = await prisma.identificadorReportado.create({ data: { identificador: "+57300CASO", plataformaId: plataforma.id } });
        await prisma.eventoMatch.create({
            data: { identificadorId: ident.id, reporteNuevoId: reporte.id, conteoAcumulado: 1, ciudades: ["Bogotá"], conductasCoincidentes: ["OFRECIMIENTO_REGALOS"], interCiudad: false },
        });
        await prisma.demoMarcado.create({ data: { id: randomUUID(), entidad: "Reporte", entidadId: reporte.id } });

        // ── un PROFESIONAL con subárbol + una cita de ESE padre ──
        const { perfil, franja } = await sembrarProfesional(ciudad.id, admin.id);
        await prisma.solicitudCita.create({
            data: {
                padreUsuarioId: padre.id, profesionalId: perfil.id, franjaId: franja.id, presentacion: "p",
                urgencia: "SIN_APURO", venceEn: new Date(Date.now() + 86400000),
                montoConsulta: 150000, montoServicio: 15000, montoTotal: 165000, porcentajeServicio: 10,
            },
        });

        // ── un OPERADOR (staff suelto) ──
        const operador = await crearUsuario("OPERADOR");
        await prisma.perfilOperador.create({ data: { usuarioId: operador.id, creadoPorId: admin.id } });

        // ── CORRIDA REAL ──
        await expect(ejecutarResetPiloto(prisma, { motivo: MOTIVO, purgaTotal: true })).resolves.toBeDefined();

        // ── AFIRMACIONES ──
        // 1) la aserción interna del reset ya pasó (ejecutar la invoca); re-afirmamos por claridad.
        await expect(afirmarPurgaTotalCompleta(prisma)).resolves.toBeUndefined();

        // 2) agregados en 0 (la consulta pública los cuenta — CEO).
        expect(await prisma.identificadorReportado.count()).toBe(0);
        expect(await prisma.eventoMatch.count()).toBe(0);
        expect(await prisma.demoMarcado.count()).toBe(0);
        expect(await prisma.reporte.count()).toBe(0);

        // 3) denuncia + facturación + citas + profesionales en 0.
        expect(await prisma.suscripcion.count()).toBe(0);
        expect(await prisma.pago.count()).toBe(0);
        expect(await prisma.perfilProfesional.count()).toBe(0);
        expect(await prisma.solicitudCita.count()).toBe(0);
        expect(await prisma.apelacion.count()).toBe(0);

        // 4) SOLO soporte@ sobrevive (padre, admin, profesional, operador, verificador, revisor → fuera).
        const usuarios = await prisma.usuario.findMany({ select: { email: true } });
        expect(usuarios.map((u) => u.email)).toEqual([SOPORTE]);

        // 5) el SEED sobrevive y su autor quedó RE-APUNTADO a soporte@ (no al admin borrado).
        expect(await prisma.plan.findUniqueOrThrow({ where: { id: plan.id }, select: { creadoPorAdminId: true } })).toEqual({ creadoPorAdminId: soporte.id });
        expect(await prisma.guiaAccionCategoria.findUniqueOrThrow({ where: { id: guia.id }, select: { creadaPorAdminId: true } })).toEqual({ creadaPorAdminId: soporte.id });
        expect(await prisma.reglaRecomendacion.findUniqueOrThrow({ where: { id: regla.id }, select: { creadaPorAdminId: true } })).toEqual({ creadaPorAdminId: soporte.id });

        // 6) evidencia de consentimiento DESTRUIDA (decisión 1) y DOCUMENTADA en AuditLog (seed, sobrevive).
        expect(await prisma.auditConsentimiento.count()).toBe(0);
        const logDestruccion = await prisma.auditLog.count({
            where: { accion: "LOGS_MANTENIMIENTO_PURGA", metadatos: { path: ["idsAfectados"], array_contains: ["audit_consentimientos"] } },
        });
        expect(logDestruccion).toBeGreaterThanOrEqual(1);
    });
});
