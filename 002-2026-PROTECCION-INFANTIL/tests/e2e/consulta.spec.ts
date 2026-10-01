import { test, expect } from "@playwright/test";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { crearReporteFixture } from "@/lib/dal/testing/crear-reporte-fixture";
import { normalizarIdentificador } from "@/lib/dal/identificadores/normalizar";

async function seedConsultaData(identificador: string) {
    // SPEC-377: en producción la ESCRITURA normaliza el identificador (reporte-creation →
    // normalizarIdentificador: trim + lowercase) y la LECTURA de la consulta también. El factory
    // de bajo nivel `crearReporteConTexto` que usa este fixture NO normaliza, así que un valor con
    // mayúsculas (p. ej. «+57300E2E…») se guardaba crudo y la consulta —que normaliza— no lo
    // encontraba: falso «Sin reportes registrados». Se normaliza acá para reflejar lo que producción
    // guarda; el test puede seguir TECLEANDO el valor crudo (la lectura lo normaliza, cubre SPEC-377).
    const identificadorNormalizado = normalizarIdentificador(identificador);
    const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
    if (!plataforma) throw new Error("Plataforma whatsapp no encontrada");

    const usuario = await prisma.usuario.create({
        data: {
            email: `e2e-consulta-${crypto.randomUUID()}@example.com`,
            nombre: "Usuario E2E Consulta",
            passwordHash: await hashPassword("TestPass123"),
            rol: "PARENT",
            estado: "activo",
        },
    });

    const base = {
        identificador: identificadorNormalizado,
        plataformaId: plataforma.id,
        texto: "Texto de prueba E2E para consulta pública.",
        fechaIncidente: new Date("2026-07-10T10:00:00Z"),
        ciudad: "Bogotá",
        pais: "Colombia",
        estado: "CLASIFICADO" as const,
    };

    for (let i = 0; i < 3; i++) {
        const numeroSeguimiento = `RPT-${crypto.randomUUID().replace(/-/g, "").toUpperCase().slice(0, 6)}`;
        const reporte = await crearReporteFixture(prisma, {
            data: {
                ...base,
                numeroSeguimiento,
                esAnonimo: i === 0,
                usuarioId: i === 0 ? null : usuario.id,
                creadoEn: new Date(Date.now() - i * 86400000),
            },
        });
        await prisma.clasificacionIA.create({
            data: {
                reporteId: reporte.id,
                categoria: "OFRECIMIENTO_REGALOS",
                confianza: 0.85,
                contienePii: false,
                piiDetectada: [],
                modeloUsado: "ornith:9b",
                latenciaMs: 1000,
            },
        });
    }

    return { usuario, plataforma };
}

test.describe("Consulta pública de identificador", () => {
    test("usuario anónimo ve información agregada básica", async ({ page }) => {
        const identificador = `+57300E2E${Date.now()}`;
        await seedConsultaData(identificador);

        await page.goto("/");
        await page.getByPlaceholder("Ej: +573001234567").fill(identificador);
        await page.getByRole("button", { name: "Buscar" }).click();

        // La home YA no usa testids (retirados) ni las frases viejas («En los últimos», «Inicia
        // sesión para conocer»): se afirma el DATO que llega al usuario, tolerante al copy de Diseño
        // (decisión CEO: el dato es un contrato más fuerte que un testid). El anónimo ve rollup por
        // PAÍS (la ciudad es solo autenticado): por eso «Colombia», no una celda «Bogotá».
        const idNorm = normalizarIdentificador(identificador);
        await expect(page.getByText(idNorm)).toBeVisible();
        await expect(page.getByText("3 reportes", { exact: true })).toBeVisible();
        await expect(page.getByText(/Autenticados:\s*2/)).toBeVisible();
        await expect(page.getByText(/Anónimos:\s*1/)).toBeVisible();
        await expect(page.getByText("Colombia").first()).toBeVisible();
        await expect(page.getByText("Ofrecimiento de regalos")).toBeVisible();
    });

    // CANDADO DE CONSTITUCIÓN (invierte el contrato viejo «ve score y nivel de riesgo»): la IA
    // clasifica CONDUCTAS, no personas — la consulta NUNCA muestra un score ni un veredicto de nivel
    // de riesgo (presunción de inocencia; constitution.md / AGENTS). El test viejo AFIRMABA una
    // conducta PROHIBIDA; no se borra, se da vuelta (mismo patrón que dashboard-publico): si alguien
    // reintroduce un score, esto se pone rojo. La mitad POSITIVA (el autenticado SÍ obtiene el
    // resultado agregado) evita que el candado sea solo una negación. NOTA medida: la distinción
    // ciudad (autenticado) vs país (anónimo) NO es observable en la HOME —LandingHero pinta siempre
    // el país; la ciudad vive en la vista enriquecida del dashboard del padre (otra superficie).
    test("usuario autenticado: la consulta NO muestra score ni nivel de riesgo (candado constitución)", async ({ page }) => {
        const identificador = `+57300E2EAUTH${Date.now()}`;
        const { usuario } = await seedConsultaData(identificador);
        const idNorm = normalizarIdentificador(identificador);

        // Login directo vía API (la cookie queda en el contexto del navegador).
        await page.request.post("/api/auth/login", {
            data: { email: usuario.email, password: "TestPass123" },
        });

        await page.goto("/");
        await page.getByPlaceholder("Ej: +573001234567").fill(identificador);
        await page.getByRole("button", { name: "Buscar" }).click();

        // POSITIVO: el autenticado SÍ ve el resultado agregado.
        await expect(page.getByText(idNorm)).toBeVisible();
        await expect(page.getByText("3 reportes", { exact: true })).toBeVisible();

        // NEGATIVO (el candado): ni score ni veredicto de nivel de riesgo.
        await expect(page.getByText(/score/i)).toHaveCount(0);
        await expect(page.getByText(/Riesgo (BAJO|MEDIO|ALTO|CR[ÍI]TICO)/i)).toHaveCount(0);
    });
});
