/**
 * CANDADO · SPEC-655/681 (I-387) · la ruta de franjas —el paso de AGENDAR del
 * `SolicitarCitaPanel`— respeta el visor: un profesional SEMBRADO solo es agendable
 * por un padre SEMBRADO.
 *
 * El bloqueo que este candado cierra (medido por el CEO/Datos): la ruta llamaba a
 * `obtenerPublicoPorId(id)` SIN visor → un pro sembrado daba `null` → 404 → el panel
 * pinta «no tiene franjas libres» → sin `franjaId` no hay cita. El padre demo veía al
 * profesional en el directorio pero NO podía agendar (caída silenciosa, paso 9).
 *
 * EJERCITA LA RUTA (no el repositorio por debajo): sin esto, el resto de los candados
 * de 655 pasan CON el defecto adentro, porque ninguno toca esta ruta. El visor sale
 * de la COOKIE de sesión (fail-closed): anónimo o padre real → 404; padre demo → 200.
 * Muere si la ruta vuelve a pasar `null` (o lee el visor de un param/header).
 * Integración (BD de test, truncada).
 */
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearTokenUsuario } from "@/lib/reporte-test-utils";
import { GET } from "./route";

let mockToken: string | undefined;
vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) => (name === "token" && mockToken ? { name: "token", value: mockToken } : undefined),
    }),
}));

/** Profesional SEMBRADO (ACTIVO + APROBADO vigente + demo_marcado) con una franja libre futura. */
async function seedDemoProConFranja(): Promise<string> {
    const pais = await prisma.pais.upsert({ where: { codigo: "CO" }, update: {}, create: { codigo: "CO", nombre: "Colombia" } });
    const ciudad = await prisma.ciudad.create({
        data: { nombre: `Ciudad681-${Math.random().toString(36).slice(2, 9)}`, nombreNormalizado: "c681", paisId: pais.id },
    });
    const usuario = await crearUsuario("PROFESIONAL", `pro.681.${Date.now()}.${Math.random()}@ejemplo.local`);
    const perfil = await prisma.perfilProfesional.create({
        data: {
            usuarioId: usuario.id,
            nombreVisible: "Dra. Demo 681",
            tituloProfesional: "Psicología",
            especialidades: ["x"],
            ciudadId: ciudad.id,
            atiendeVirtual: true,
            aniosExperiencia: 5,
            presentacion: "p",
            tarifaConsultaCOP: 120000,
            duracionMinutos: 50,
            estado: "ACTIVO",
        },
    });
    const revisor = await crearUsuario("ADMIN", `admin.681.${Date.now()}.${Math.random()}@ejemplo.local`);
    await prisma.verificacionProfesional.create({
        data: {
            perfilProfesionalId: perfil.id,
            revisadoPorId: revisor.id,
            revisadoEn: new Date(Date.now() - 24 * 60 * 60 * 1000),
            checklist: {},
            resultado: "APROBADO",
            autorizacionArchivoId: "archivo-de-prueba",
            venceEn: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        },
    });
    await prisma.demoMarcado.create({
        data: { entidad: "PerfilProfesional", entidadId: perfil.id, metadata: { corrida: "candado-681", script: "test" } },
    });
    const inicio = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    await prisma.franjaDisponible.create({
        data: { profesionalId: perfil.id, inicio, fin: new Date(inicio.getTime() + 50 * 60 * 1000), modalidad: "VIRTUAL", tomada: false },
    });
    return perfil.id;
}

/** Token de sesión de un padre; `demo=true` lo marca en demo_marcado (entidad "Usuario"). */
async function padreConToken(demo: boolean): Promise<string> {
    const u = await crearUsuario("PARENT", `padre.681.${Date.now()}.${Math.random()}@ejemplo.local`);
    if (demo) {
        await prisma.demoMarcado.create({
            data: { entidad: "Usuario", entidadId: u.id, metadata: { corrida: "candado-681", script: "test" } },
        });
    }
    return crearTokenUsuario(u.id, "PARENT");
}

const req = () => new Request("http://localhost/api/publico/profesionales/x/franjas");
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

describe("SPEC-655/681 · franjas: un profesional sembrado solo es agendable por un padre sembrado", () => {
    let demoProId: string;
    beforeEach(async () => {
        await resetDatabase();
        mockToken = undefined;
        demoProId = await seedDemoProConFranja();
    });
    afterAll(async () => {
        await prisma.$disconnect();
    });

    it("visor DEMO → 200 con franjas (el padre sembrado SÍ puede agendar)", async () => {
        mockToken = await padreConToken(true);
        const res = await GET(req(), ctx(demoProId));
        expect(res.status, "un padre demo debe ver las franjas del pro demo").toBe(200);
        const body = (await res.json()) as { data: unknown[] };
        expect(body.data.length, "hay al menos una franja libre").toBeGreaterThan(0);
    });

    it("visor REAL → 404 (un padre real no ve las franjas de un fantasma)", async () => {
        mockToken = await padreConToken(false);
        const res = await GET(req(), ctx(demoProId));
        expect(res.status).toBe(404);
    });

    it("anónimo (sin sesión) → 404 (fail-closed: el anónimo cuenta como real)", async () => {
        mockToken = undefined;
        const res = await GET(req(), ctx(demoProId));
        expect(res.status).toBe(404);
    });
});
