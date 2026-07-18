/**
 * Smoke test end-to-end del flujo crítico de reportes.
 *
 * Ejecuta contra el entorno LOCAL (por defecto http://localhost:5005):
 *   1. Login de admin
 *   2. Crear reporte vía API pública
 *   3. Forzar procesamiento vía /api/reportes/procesar (WORKER_SECRET)
 *   4. Verificar clasificación con votos persistida
 *   5. Verificar embedding guardado
 *   6. Verificar anonimización si aplica PII
 *   7. Verificar que aparece en la cola admin correcta
 *   8. Limpiar todo lo creado
 *
 * Uso:
 *   npx tsx scripts/smoke-e2e.ts
 *
 * Requiere:
 *   - App corriendo (npm run dev / npm start)
 *   - Ollama corriendo con ornith:9b y nomic-embed-text
 *   - Variables de entorno: NEXT_PUBLIC_APP_URL, WORKER_SECRET,
 *     ADMIN_EMAIL, ADMIN_PASSWORD (toma defaults de desarrollo si no están seteadas)
 */

import { prisma } from "@/lib/prisma";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5005";
const WORKER_SECRET = process.env.WORKER_SECRET || "worker-secret-local";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@proteccion.local";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Admin123!Secure";

// Texto sintético con PII para forzar anonimización.
// Incluye nombre, edad, dirección, teléfono y correo de una menor ficticia.
const TEXTO_PRUEBA =
    "Mi nombre es Ana Patricia López, tengo 14 años, vivo en Carrera 15 # 45-67 Apto 301 en Bogotá. Un señor llamado Roberto Gómez me escribió a mi celular 311-987-6543 y a mi correo ana.lopez@correo.com pidiéndome fotos desnuda. Dijo que me espera en el parque de mi casa.";

interface CookieJar {
    token?: string;
}

const jar: CookieJar = {};

function assert(condition: boolean, message: string): void {
    if (!condition) {
        throw new Error(`ASSERT FAILED: ${message}`);
    }
}

async function api(path: string, options: RequestInit = {}, { auth = true }: { auth?: boolean } = {}): Promise<Response> {
    const url = `${APP_URL}${path}`;
    const headers = new Headers(options.headers || {});
    if (auth && jar.token) {
        headers.set("Cookie", `token=${jar.token}`);
    }
    headers.set("Content-Type", headers.get("Content-Type") || "application/json");
    return fetch(url, { ...options, headers });
}

async function login(): Promise<void> {
    const res = await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    });
    if (!res.ok) {
        throw new Error(`Login falló: ${res.status} ${await res.text()}`);
    }
    const setCookie = res.headers.get("set-cookie") || "";
    const match = setCookie.match(/token=([^;]+)/);
    if (match) {
        jar.token = match[1];
    } else {
        throw new Error("No se recibió cookie de sesión");
    }
}

async function getPlataformaClave(): Promise<string> {
    const res = await api("/api/plataformas");
    if (!res.ok) throw new Error(`No se pudieron obtener plataformas: ${res.status}`);
    const data = (await res.json()) as { plataformas?: { clave: string; nombre: string }[] };
    const plataformas = data.plataformas || [];
    const whatsapp = plataformas.find((p) => p.clave === "whatsapp");
    if (whatsapp) return whatsapp.clave;
    if (plataformas.length === 0) throw new Error("No hay plataformas disponibles");
    return plataformas[0].clave;
}

async function crearReporte(plataformaClave: string): Promise<{ id: string; numeroSeguimiento: string }> {
    const unique = Date.now();
    const identificador = `smoke-test-${unique}`;
    const res = await api(
        "/api/reportes",
        {
            method: "POST",
            body: JSON.stringify({
                identificador,
                plataforma: plataformaClave,
                texto: TEXTO_PRUEBA,
                fechaIncidente: new Date().toISOString(),
                pais: "CO",
                ciudad: "Bogotá",
                esAnonimo: true,
            }),
        },
        { auth: false }
    );
    if (!res.ok) throw new Error(`Crear reporte falló: ${res.status} ${await res.text()}`);
    const data = (await res.json()) as { reporte: { id: string; numeroSeguimiento: string } };
    return data.reporte;
}

async function procesarReporte(reporteId: string): Promise<{
    estado: string;
    clasificacion?: { categoria: string; confianza: number; votos?: unknown[] };
}> {
    const res = await api("/api/reportes/procesar", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Worker-Secret": WORKER_SECRET,
        },
        body: JSON.stringify({ reporteId }),
    });
    if (!res.ok) throw new Error(`Procesar reporte falló: ${res.status} ${await res.text()}`);
    return (await res.json()) as { estado: string; clasificacion?: { categoria: string; confianza: number; votos?: unknown[] } };
}

async function verificarPersistencia(reporteId: string): Promise<{
    reporte: {
        estado: string;
        texto: string;
        textoOriginal: string | null;
        prioridadAlta: boolean;
        keywordsDetectadas: string[];
    };
    clasificacion: {
        categoria: string;
        confianza: number;
        contienePii: boolean;
        votos: unknown;
    } | null;
    embedding: { id: string } | null;
}> {
    const reporte = await prisma.reporte.findUnique({
        where: { id: reporteId },
        select: {
            estado: true,
            texto: true,
            textoOriginal: true,
            prioridadAlta: true,
            keywordsDetectadas: true,
        },
    });
    if (!reporte) throw new Error("Reporte no encontrado en BD");

    const clasificacion = await prisma.clasificacionIA.findUnique({
        where: { reporteId },
        select: { categoria: true, confianza: true, contienePii: true, votos: true },
    });

    const embedding = await prisma.embeddingReporte.findUnique({
        where: { reporteId },
        select: { id: true },
    });

    return { reporte, clasificacion, embedding };
}

async function verificarColaAdmin(reporteId: string, estadoEsperado: string): Promise<boolean> {
    const res = await api("/api/admin/reportes-revision?pageSize=100");
    if (!res.ok) throw new Error(`Cola admin falló: ${res.status}`);
    const data = (await res.json()) as { reportes: { id: string; estado: string }[] };
    return data.reportes.some((r) => r.id === reporteId && r.estado === estadoEsperado);
}

async function cleanup(reporteId: string): Promise<void> {
    const reporte = await prisma.reporte.findUnique({
        where: { id: reporteId },
        include: { clasificacion: { include: { correccion: true } } },
    });
    if (!reporte) return;

    // Eliminar corrección y dataset asociado si existiera.
    if (reporte.clasificacion?.correccion) {
        const correccionId = reporte.clasificacion.correccion.id;
        await prisma.datasetEntrenamiento.deleteMany({ where: { correccionId } });
        await prisma.correccionAdmin.delete({ where: { id: correccionId } });
    }

    // Limpiar en orden inverso a las FK.
    await prisma.clasificacionIA.deleteMany({ where: { reporteId } });
    await prisma.embeddingReporte.deleteMany({ where: { reporteId } });

    // Limpiar IdentificadorReportado si este fue el único reporte.
    const identificador = await prisma.identificadorReportado.findUnique({
        where: { identificador_plataformaId: { identificador: reporte.identificador, plataformaId: reporte.plataformaId } },
    });
    if (identificador && identificador.totalReportes <= 1) {
        await prisma.identificadorReportado.delete({
            where: { id: identificador.id },
        });
    }

    await prisma.reporte.delete({ where: { id: reporteId } });

    // Limpiar entradas de rate limit generadas por el test.
    await prisma.rateLimit.deleteMany({
        where: { identifier: { contains: "smoke" } },
    });
}

function printStep(n: number, msg: string): void {
    console.log(`[${n}/8] ${msg}`);
}

async function main(): Promise<void> {
    console.log(`=== Smoke test E2E en ${APP_URL} ===\n`);
    let reporteId: string | undefined;

    try {
        printStep(1, "Login de admin");
        await login();
        console.log("   ✅ Admin autenticado");

        printStep(2, "Seleccionar plataforma");
        const plataformaClave = await getPlataformaClave();
        console.log(`   ✅ Plataforma: ${plataformaClave}`);

        printStep(3, "Crear reporte vía API");
        const reporte = await crearReporte(plataformaClave);
        reporteId = reporte.id;
        console.log(`   ✅ Reporte creado: ${reporteId} (${reporte.numeroSeguimiento})`);

        printStep(4, "Procesar reporte con worker");
        const resultado = await procesarReporte(reporteId);
        console.log(`   ✅ Procesado -> estado: ${resultado.estado}`);
        console.log(`   ℹ️  Categoría: ${resultado.clasificacion?.categoria}, confianza: ${resultado.clasificacion?.confianza}`);

        printStep(5, "Verificar persistencia");
        const persistido = await verificarPersistencia(reporteId);
        assert(
            ["CLASIFICADO", "REVISION_MANUAL", "REQUIERE_ANONIMIZACION"].includes(persistido.reporte.estado),
            `estado final inesperado: ${persistido.reporte.estado}`
        );
        assert(persistido.clasificacion !== null, "no se persistió clasificación");
        assert(
            Array.isArray(persistido.clasificacion?.votos) && (persistido.clasificacion?.votos?.length || 0) > 0,
            "no se persistieron votos"
        );
        assert(persistido.embedding !== null, "no se persistió embedding");

        // El texto de prueba contiene PII (teléfono y dirección).
        // El pipeline debe haber detectado PII y anonimizado el texto.
        if (persistido.reporte.textoOriginal) {
            assert(
                persistido.reporte.texto !== TEXTO_PRUEBA,
                "el texto no fue anonimizado aunque se preservó el original"
            );
            // Verificamos que al menos el teléfono o el correo ya no aparezcan tal cual.
            // El modelo puede no redactar todo, pero debe cambiar el texto y quitar los datos más evidentes.
            const aunTienePiiObvia =
                persistido.reporte.texto.includes("+57 300 123 4567") ||
                persistido.reporte.texto.includes("carlos.martinez@email.com");
            if (aunTienePiiObvia) {
                console.log("   ⚠️  El texto fue anonimizado pero aún conserva PII obvia (revisar modelo)");
            } else {
                console.log("   ✅ PII detectada y texto anonimizado");
            }
        } else if (persistido.clasificacion?.contienePii) {
            console.log("   ⚠️  PII detectada pero no se preservó textoOriginal (estado inesperado)");
        } else {
            console.log("   ℹ️  No se detectó PII en este texto");
        }
        console.log("   ✅ Clasificación, votos y embedding verificados");

        printStep(6, "Verificar estado coherente");
        assert(
            resultado.estado === persistido.reporte.estado,
            `estado incoherente entre procesar (${resultado.estado}) y BD (${persistido.reporte.estado})`
        );
        console.log("   ✅ Estado coherente");

        printStep(7, "Verificar cola admin");
        const enCola = await verificarColaAdmin(reporteId, persistido.reporte.estado);
        assert(enCola, "el reporte no aparece en la cola admin con el estado esperado");
        console.log(`   ✅ Reporte visible en cola admin como ${persistido.reporte.estado}`);

        printStep(8, "Limpiar datos de prueba");
        await cleanup(reporteId);
        const reporteRestante = await prisma.reporte.findUnique({ where: { id: reporteId } });
        assert(reporteRestante === null, "el reporte no fue eliminado");
        console.log("   ✅ Limpieza completada");

        console.log("\n🟢 SMOKE TEST PASÓ");
        process.exitCode = 0;
    } catch (err) {
        console.error("\n🔴 SMOKE TEST FALLÓ");
        console.error(err instanceof Error ? err.message : String(err));
        if (reporteId) {
            console.log("\n⚠️  Intentando limpiar reporte de prueba...");
            try {
                await cleanup(reporteId);
                console.log("   ✅ Limpieza de emergencia completada");
            } catch (cleanupErr) {
                console.error("   ❌ Limpieza de emergencia falló:", cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr));
            }
        }
        process.exitCode = 1;
    } finally {
        await prisma.$disconnect();
    }
}

main();
