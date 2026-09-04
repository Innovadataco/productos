/**
 * SPEC-418 (I-295) · el aviso de la decisión del Verificador NO se pierde.
 *
 * Lo cazó Calidad en producción: `service.ts` disparaba el correo **fuera de
 * transacción y con el error tragado**. Con el proveedor caído, el profesional
 * nunca se enteraba de que le habían devuelto la solicitud y no quedaba rastro
 * en ningún lado. El ciclo de admisión se detenía en silencio: el profesional
 * esperaba una respuesta que nunca iba a llegar.
 *
 * Estos tests corren contra la BD de verdad y afirman lo único que importa:
 * **después de decidir, existe una fila en `notificaciones`.** Un envío directo
 * no deja fila; el motor sí. Por eso el candado mira la tabla y no un espía.
 */
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearTokenUsuario } from "@/lib/reporte-test-utils";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

// pg-boss no corre en la suite: el despacho al worker es un adelanto, no una
// condición. Si falla, el polling del worker recoge la fila igual — que es
// justamente la propiedad que hace que el aviso no se pueda perder.
vi.mock("@/lib/queue", () => ({
    sendNotificacionEnvio: vi.fn(async () => undefined),
}));

const REQUISITOS = [
    { clave: "tarjeta", nombre: "Tarjeta profesional", descripcion: "" },
    { clave: "autorizacion", nombre: "Autorización firmada", descripcion: "" },
];

async function sembrarCatalogoMotor() {
    for (const evento of ["profesional.verificacion.aprobada", "profesional.verificacion.devuelta"]) {
        const clave = `${evento}.email`;
        await prisma.notificacionPlantilla.create({
            data: {
                clave,
                canal: "EMAIL",
                asunto: "Resultado de tu verificación",
                cuerpoMarkdown: "Hola {{nombreProfesional}}.\n{{detalleObservaciones}}",
                activa: true,
            },
        });
        await prisma.notificacionRegla.create({
            data: {
                evento,
                rol: "PROFESIONAL",
                canal: "EMAIL",
                plantillaClave: clave,
                offset: "+0m",
                obligatoria: true,
                activa: true,
            },
        });
    }
}

async function sembrarPerfilEnRevision() {
    // La geografía sobrevive al reset (tablas de catálogo): se reusa si ya está.
    const pais = await prisma.pais.upsert({
        where: { codigo: "CO" },
        update: {},
        create: { codigo: "CO", nombre: "Colombia" },
    });
    const ciudad =
        (await prisma.ciudad.findFirst({ where: { paisId: pais.id } })) ??
        (await prisma.ciudad.create({
            data: { nombre: "Bogotá", nombreNormalizado: "bogota", paisId: pais.id },
        }));
    const profesional = await crearUsuario("PROFESIONAL", `profe.${Date.now()}@ejemplo.local`);
    const perfil = await prisma.perfilProfesional.create({
        data: {
            usuarioId: profesional.id,
            nombreVisible: "Profesional de Prueba",
            tituloProfesional: "Psicología",
            especialidades: ["infantil"],
            ciudadId: ciudad.id,
            aniosExperiencia: 5,
            presentacion: "Presentación de prueba.",
            tarifaConsultaCOP: 100000,
            duracionMinutos: 45,
            estado: "EN_REVISION",
            autorizacionArchivoId: "/archivos/autorizacion-prueba.pdf",
            autorizacionSubidaEn: new Date(),
        },
    });
    // SPEC-436 (I-304): desde esta spec NO se puede marcar CUMPLE un requisito
    // sin documento cargado. Estos tests son de SPEC-418 (que el aviso quede
    // encolado), así que se les carga el documento de cada requisito para que
    // sigan probando LO SUYO en vez de chocar con la guardia nueva.
    for (const r of REQUISITOS) {
        await prisma.documentoProfesional.create({
            data: {
                perfilProfesionalId: perfil.id,
                requisitoClave: r.clave,
                archivoId: `archivo-${r.clave}`,
                extension: "pdf",
                sha256: "sha-de-prueba",
            },
        });
    }
    return { perfil, profesional };
}

async function autenticarVerificador() {
    const admin = await crearUsuario("ADMIN", `verificador.${Date.now()}@ejemplo.local`);
    mockToken = await crearTokenUsuario(admin.id, "ADMIN");
    return admin;
}

function pedir(id: string, checklist: Record<string, { estado: string; observacion?: string }>) {
    return POST(
        new Request(`http://localhost:5005/api/admin/verificacion-profesionales/${id}/decidir`, {
            method: "POST",
            headers: { "Content-Type": "application/json", cookie: `token=${mockToken}` },
            body: JSON.stringify({ checklist }),
        }),
        { params: Promise.resolve({ id }) },
    );
}

describe("POST /decidir · SPEC-418 (I-295) — el aviso queda encolado, no se envía a ciegas", () => {
    beforeEach(async () => {
        await resetDatabase();
        mockToken = undefined;
        await prisma.parametroSistema.create({
            data: {
                clave: "verificacion.requisitos",
                valor: JSON.stringify(REQUISITOS),
                tipo: "JSON",
                categoria: "SYSTEM",
                esPublico: false,
                descripcion: "Requisitos que revisa el Verificador (test)",
            },
        });
        await sembrarCatalogoMotor();
    });

    afterAll(async () => prisma.$disconnect());

    it("DEVOLUCIÓN: deja fila en `notificaciones` con el detalle de lo que hay que corregir", async () => {
        await autenticarVerificador();
        const { perfil, profesional } = await sembrarPerfilEnRevision();

        const res = await pedir(perfil.id, {
            tarjeta: { estado: "CUMPLE" },
            autorizacion: { estado: "NO_CUMPLE", observacion: "La firma no coincide con el documento." },
        });
        expect(res.status).toBe(200);
        expect((await res.json()).data.resultado).toBe("MAS_INFORMACION");

        const notificaciones = await prisma.notificacion.findMany({
            where: { evento: "profesional.verificacion.devuelta" },
        });
        expect(notificaciones, "sin fila, el aviso se perdió — eso es I-295").toHaveLength(1);
        const aviso = notificaciones[0];
        expect(aviso.destinatarioEmail).toBe(profesional.email);
        expect(aviso.destinatarioUsuarioId).toBe(profesional.id);
        expect(aviso.sujetoId).toBe(perfil.id);
        expect(aviso.estado).toBe("ENCOLADA");
        // El profesional tiene que poder saber QUÉ corregir.
        expect(JSON.stringify(aviso.variables)).toContain("La firma no coincide");
    });

    it("APROBACIÓN: también deja su fila, en su propio evento", async () => {
        await autenticarVerificador();
        const { perfil } = await sembrarPerfilEnRevision();

        const res = await pedir(perfil.id, {
            tarjeta: { estado: "CUMPLE" },
            autorizacion: { estado: "CUMPLE" },
        });
        expect(res.status).toBe(200);
        expect((await res.json()).data.resultado).toBe("APROBADO");

        const aprobadas = await prisma.notificacion.count({
            where: { evento: "profesional.verificacion.aprobada" },
        });
        expect(aprobadas).toBe(1);
    });

    it("el aviso y la decisión viajan JUNTOS: sin regla activa no se guarda ninguno de los dos", async () => {
        // Es la propiedad que da la transacción. Antes, la decisión se
        // committeaba y el aviso se evaporaba: el profesional quedaba devuelto
        // sin enterarse. Ahora, o pasan los dos o no pasa ninguno.
        await prisma.notificacionRegla.updateMany({
            where: { evento: "profesional.verificacion.devuelta" },
            data: { activa: false },
        });
        await autenticarVerificador();
        const { perfil } = await sembrarPerfilEnRevision();

        const res = await pedir(perfil.id, {
            tarjeta: { estado: "CUMPLE" },
            autorizacion: { estado: "NO_CUMPLE", observacion: "Falta la firma." },
        });
        expect(res.status).toBe(500);

        // La decisión NO quedó: ni verificación, ni cambio de estado del perfil.
        expect(await prisma.verificacionProfesional.count()).toBe(0);
        const despues = await prisma.perfilProfesional.findUniqueOrThrow({ where: { id: perfil.id } });
        expect(despues.estado, "el perfil sigue en revisión, no devuelto a ciegas").toBe("EN_REVISION");
        expect(await prisma.notificacion.count()).toBe(0);
    });

    it("una verificación aprobada deja el perfil ACTIVO y su fila de historial", async () => {
        await autenticarVerificador();
        const { perfil } = await sembrarPerfilEnRevision();
        await pedir(perfil.id, { tarjeta: { estado: "CUMPLE" }, autorizacion: { estado: "CUMPLE" } });

        const despues = await prisma.perfilProfesional.findUniqueOrThrow({ where: { id: perfil.id } });
        expect(despues.estado).toBe("ACTIVO");
        expect(await prisma.verificacionProfesional.count()).toBe(1);
    });
});
