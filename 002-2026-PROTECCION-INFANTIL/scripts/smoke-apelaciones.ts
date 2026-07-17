/**
 * Smoke test E2E del flujo completo de apelaciones (Fase C).
 *
 * Escenario:
 *   1. Login de admin.
 *   2. Crear un identificador visible con reportes reales.
 *   3. Crear apelación NICK (sin verificación) → verificar pausa de visibilidad.
 *   4. Ver apelación en bandeja admin.
 *   5. Crear apelación SMS, recuperar OTP desde el hash y verificar.
 *   6. Resolver ACEPTADA → baja REPORTE_FALSO de los reportes seleccionados.
 *   7. Crear otra apelación, adelantar pausaHasta en BD y ejecutar job de vencimiento.
 *   8. Verificar restauración automática de visibilidad.
 *   9. Limpiar.
 *
 * Uso:
 *   npx tsx scripts/smoke-apelaciones.ts
 *
 * Requiere:
 *   - App corriendo (npm run dev / npm start) en NEXT_PUBLIC_APP_URL.
 *   - Base de datos de desarrollo accesible para lectura/limpieza.
 */
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5005";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@proteccion.local";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Admin123!Secure";

interface CookieJar {
    token?: string;
}

const jar: CookieJar = {};

function assert(condition: boolean, message: string): void {
    if (!condition) throw new Error(`ASSERT FAILED: ${message}`);
}

async function api(path: string, options: RequestInit = {}): Promise<Response> {
    const url = `${APP_URL}${path}`;
    const headers = new Headers(options.headers || {});
    if (jar.token) headers.set("Cookie", `token=${jar.token}`);
    headers.set("Content-Type", headers.get("Content-Type") || "application/json");
    return fetch(url, { ...options, headers });
}

async function login(): Promise<void> {
    const res = await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    });
    assert(res.ok, `Login falló: ${res.status}`);
    const setCookie = res.headers.get("set-cookie") || "";
    const match = setCookie.match(/token=([^;]+)/);
    assert(!!match, "No se recibió cookie de sesión");
    jar.token = match![1];
}

async function getPlataformaClave(): Promise<string> {
    const res = await api("/api/plataformas");
    assert(res.ok, `Plataformas falló: ${res.status}`);
    const data = (await res.json()) as { plataformas?: { clave: string }[] };
    const whatsapp = data.plataformas?.find((p) => p.clave === "whatsapp");
    assert(!!whatsapp, "No hay plataforma whatsapp");
    return whatsapp!.clave;
}

async function crearReporteApi(identificador: string, plataformaClave: string): Promise<string> {
    const res = await api("/api/reportes", {
        method: "POST",
        body: JSON.stringify({
            identificador,
            plataforma: plataformaClave,
            texto: `Reporte de prueba para apelaciones ${Date.now()}`,
            fechaIncidente: new Date().toISOString(),
            pais: "CO",
            ciudad: "Bogotá",
            esAnonimo: true,
        }),
    });
    if (!res.ok) {
        throw new Error(`Crear reporte falló: ${res.status} ${await res.text()}`);
    }
    const data = (await res.json()) as { reporte: { id: string } };
    return data.reporte.id;
}

async function crearReporteDb(identificador: string, plataformaId: string): Promise<string> {
    const reporte = await prisma.reporte.create({
        data: {
            identificador,
            plataformaId,
            texto: `Reporte de prueba DB ${Date.now()}`,
            esAnonimo: true,
            estado: "PENDIENTE",
            fechaIncidente: new Date(),
            pais: "CO",
            ciudad: "Bogotá",
            edadVictima: 14,
        },
    });
    return reporte.id;
}

async function crearIdentificadorVisible(identificador: string, plataformaId: string): Promise<string[]> {
    // Creamos 1 reporte vía API y 2 directamente en BD para evitar el rate-limit de duplicados.
    const plataforma = await prisma.plataforma.findUnique({ where: { id: plataformaId } });
    const clave = plataforma?.clave || "whatsapp";
    const reporteIds: string[] = [];
    reporteIds.push(await crearReporteApi(identificador, clave));
    reporteIds.push(await crearReporteDb(identificador, plataformaId));
    reporteIds.push(await crearReporteDb(identificador, plataformaId));

    // Forzamos visibilidad y ratio autenticado para cumplir reglas de visibilidad.
    await prisma.identificadorReportado.upsert({
        where: { identificador_plataformaId: { identificador, plataformaId } },
        update: { totalReportes: 3, reportesAutenticados: 3, reportesAnonimos: 0, esVisiblePublicamente: true },
        create: {
            identificador,
            plataformaId,
            totalReportes: 3,
            reportesAutenticados: 3,
            reportesAnonimos: 0,
            esVisiblePublicamente: true,
        },
    });
    return reporteIds;
}

async function crearApelacion(
    identificador: string,
    plataformaClave: string,
    tipoVerificacion: "NICK" | "SMS",
    contacto?: string
): Promise<{ token: string; id: string }> {
    const res = await api("/api/apeaciones/solicitar", {
        method: "POST",
        body: JSON.stringify({
            identificador,
            plataformaClave,
            motivoSolicitud: "Este reporte es falso, solicito apelación.",
            tipoVerificacion,
            contacto,
        }),
    });
    if (!res.ok) {
        throw new Error(`Crear apelación falló: ${res.status} ${await res.text()}`);
    }
    const data = (await res.json()) as { token: string };

    const apelacion = await prisma.apelacionIdentificador.findFirst({
        where: { identificador },
        orderBy: { creadoEn: "desc" },
    });
    assert(!!apelacion, "Apelación no encontrada en BD");
    return { token: data.token, id: apelacion!.id };
}

async function consultarEstado(token: string): Promise<{
    estado: string;
    tipoVerificacion: string;
    pausaHasta: string | null;
    visibilidadRestaurada: boolean;
}> {
    const res = await api(`/api/apeaciones/${token}`);
    assert(res.ok, `Consultar estado falló: ${res.status}`);
    return (await res.json()) as {
        estado: string;
        tipoVerificacion: string;
        pausaHasta: string | null;
        visibilidadRestaurada: boolean;
    };
}

async function obtenerOtpDesdeHash(hash: string): Promise<string> {
    for (let i = 100000; i <= 999999; i++) {
        const h = createHash("sha256").update(String(i)).digest("hex");
        if (h === hash) return String(i);
    }
    throw new Error("No se pudo recuperar OTP desde el hash");
}

async function verificarOtp(token: string, codigo: string): Promise<void> {
    const res = await api("/api/apeaciones/verificar", {
        method: "POST",
        body: JSON.stringify({ token, codigo }),
    });
    if (!res.ok) {
        throw new Error(`Verificar OTP falló: ${res.status} ${await res.text()}`);
    }
}

async function resolverApelacionAdmin(apelacionId: string, accion: "ACEPTAR" | "RECHAZAR", reportesSeleccionados?: string[]): Promise<void> {
    const res = await api(`/api/admin/apeaciones/${apelacionId}/resolver`, {
        method: "POST",
        body: JSON.stringify({
            accion,
            respuestaAdmin: `Resolución de prueba: ${accion.toLowerCase()}.`,
            reportesSeleccionados,
        }),
    });
    if (!res.ok) {
        throw new Error(`Resolver apelación falló: ${res.status} ${await res.text()}`);
    }
}

async function ejecutarVencimientoJob(): Promise<void> {
    const { vencerApelacionesPendientes } = await import("@/lib/apealaciones");
    const result = await vencerApelacionesPendientes();
    console.log(`   [JOB VENCIMIENTO] vencidas=${result.vencidas}`);
}

async function cleanup(reporteIds: string[], identificador: string, plataformaId: string): Promise<void> {
    await prisma.auditLog.deleteMany({ where: { tipoRecurso: { in: ["ApelacionIdentificador", "Reporte"] } } });
    await prisma.apelacionIdentificador.deleteMany({ where: { identificador } });
    for (const rid of reporteIds) {
        await prisma.clasificacionIA.deleteMany({ where: { reporteId: rid } });
        await prisma.embeddingReporte.deleteMany({ where: { reporteId: rid } });
    }
    await prisma.reporte.deleteMany({ where: { identificador } });
    await prisma.identificadorReportado.deleteMany({ where: { identificador, plataformaId } });
    await prisma.rateLimit.deleteMany({ where: { identifier: { contains: identificador.slice(-8) } } });
}

function printStep(n: number, msg: string): void {
    console.log(`[${n}/9] ${msg}`);
}

async function main(): Promise<void> {
    console.log(`=== Smoke test Apelaciones en ${APP_URL} ===\n`);

    const unique = Date.now();
    const identificador = `+57300SMOKE${unique.toString().slice(-6)}`;
    let plataformaId = "";
    let reporteIds: string[] = [];

    try {
        printStep(1, "Login de admin");
        await login();
        console.log("   ✅ Admin autenticado");

        printStep(2, "Crear identificador visible con reportes");
        const plataformaClave = await getPlataformaClave();
        const plataforma = await prisma.plataforma.findUnique({ where: { clave: plataformaClave } });
        assert(!!plataforma, "Plataforma no encontrada en BD");
        plataformaId = plataforma!.id;
        reporteIds = await crearIdentificadorVisible(identificador, plataformaId);
        console.log(`   ✅ Identificador visible con ${reporteIds.length} reportes`);

        printStep(3, "Crear apelación NICK y verificar pausa");
        const { token: tokenNick, id: idNick } = await crearApelacion(identificador, plataformaClave, "NICK");
        const estadoNick = await consultarEstado(tokenNick);
        assert(estadoNick.estado === "RECIBIDA", `Estado inesperado: ${estadoNick.estado}`);
        assert(!!estadoNick.pausaHasta, "No se generó pausaHasta");
        const identificadorAfterNick = await prisma.identificadorReportado.findUnique({
            where: { identificador_plataformaId: { identificador, plataformaId } },
        });
        assert(identificadorAfterNick?.esVisiblePublicamente === false, "Visibilidad no se pausó");
        console.log("   ✅ Apelación NICK creada y visibilidad pausada");

        printStep(4, "Ver apelación en bandeja admin");
        const resList = await api("/api/admin/apeaciones");
        assert(resList.ok, `Listar apelaciones falló: ${resList.status}`);
        const listData = (await resList.json()) as { items: { id: string; estado: string; identificador: string }[] };
        const enBandeja = listData.items.some((a) => a.id === idNick);
        assert(enBandeja, "Apelación no aparece en bandeja admin");
        console.log("   ✅ Apelación visible en bandeja admin");

        printStep(5, "Crear apelación SMS y verificar OTP");
        const identificadorSms = `+57300SMS${unique.toString().slice(-6)}`;
        const reporteIdsSms = await crearIdentificadorVisible(identificadorSms, plataformaId);
        const { token: tokenSms, id: idSms } = await crearApelacion(identificadorSms, plataformaClave, "SMS", "+573001234567");
        const apelacionSms = await prisma.apelacionIdentificador.findUnique({ where: { id: idSms } });
        assert(!!apelacionSms?.smsCodigoHash, "No se generó hash OTP");
        const otp = await obtenerOtpDesdeHash(apelacionSms!.smsCodigoHash!);
        await verificarOtp(tokenSms, otp);
        const estadoSms = await consultarEstado(tokenSms);
        assert(estadoSms.tipoVerificacion === "SMS", "Tipo de verificación incorrecto");
        console.log("   ✅ OTP SMS verificado correctamente");

        printStep(6, "Resolver ACEPTADA con baja REPORTE_FALSO");
        // Descartamos los reportes SMS del scope de la baja; la baja aplica a los reportes NICK.
        await cleanup(reporteIdsSms, identificadorSms, plataformaId);
        await resolverApelacionAdmin(idNick, "ACEPTAR", reporteIds);
        for (const rid of reporteIds) {
            const r = await prisma.reporte.findUnique({ where: { id: rid } });
            assert(r?.eliminado === true, `Reporte ${rid} no fue dado de baja`);
        }
        const auditBaja = await prisma.auditLog.findFirst({
            where: { accion: "APELACION_RESUELTA", recursoId: idNick },
        });
        assert(!!auditBaja, "No se registró auditoría de resolución");
        console.log("   ✅ Apelación aceptada y reportes dados de baja");

        printStep(7, "Crear otra apelación y simular vencimiento");
        const identificador2 = `+57300VENC${unique.toString().slice(-6)}`;
        const reporteIds2 = await crearIdentificadorVisible(identificador2, plataformaId);
        const { id: idVenc } = await crearApelacion(identificador2, plataformaClave, "NICK");
        // Adelantamos la pausa para forzar el vencimiento inmediato.
        await prisma.apelacionIdentificador.update({
            where: { id: idVenc },
            data: { pausaHasta: new Date(Date.now() - 1000) },
        });
        await ejecutarVencimientoJob();
        const apelacionVenc = await prisma.apelacionIdentificador.findUnique({ where: { id: idVenc } });
        assert(apelacionVenc?.estado === "VENCIDA", `Estado tras vencimiento: ${apelacionVenc?.estado}`);
        assert(apelacionVenc?.visibilidadRestaurada === true, "Visibilidad no restaurada tras vencimiento");
        const identificadorVenc = await prisma.identificadorReportado.findUnique({
            where: { identificador_plataformaId: { identificador: identificador2, plataformaId } },
        });
        assert(identificadorVenc?.esVisiblePublicamente === true, "Identificador no volvió a ser visible");
        console.log("   ✅ Vencimiento ejecutado y visibilidad restaurada");

        printStep(8, "Verificar auditoría");
        const auditVenc = await prisma.auditLog.findFirst({
            where: { accion: "APELACION_VENCIDA", recursoId: idVenc },
        });
        assert(!!auditVenc, "No se registró auditoría de vencimiento");
        console.log("   ✅ Auditoría de vencimiento registrada");

        printStep(9, "Limpiar datos de prueba");
        await cleanup(reporteIds, identificador, plataformaId);
        await cleanup(reporteIds2, identificador2, plataformaId);
        console.log("   ✅ Limpieza completada");

        console.log("\n🟢 SMOKE APELACIONES PASÓ");
        process.exitCode = 0;
    } catch (err) {
        console.error("\n🔴 SMOKE APELACIONES FALLÓ");
        console.error(err instanceof Error ? err.message : String(err));
        if (plataformaId) {
            console.log("\n⚠️  Intentando limpiar...");
            try {
                await cleanup(reporteIds, identificador, plataformaId);
                console.log("   ✅ Limpieza de emergencia completada");
            } catch (e) {
                console.error("   ❌ Limpieza de emergencia falló", e instanceof Error ? e.message : String(e));
            }
        }
        process.exitCode = 1;
    } finally {
        await prisma.$disconnect();
    }
}

main();
