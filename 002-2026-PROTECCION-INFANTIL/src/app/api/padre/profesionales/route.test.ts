/**
 * SPEC-392 (L3) · candado H-2 · Ley 2375/2024 · veredicto CEO 07:10.
 *
 * **Este test es el más importante del PR.** Barre el JSON de los TRES
 * endpoints del directorio y falla si aparece cualquier cosa que huela a
 * contacto o a campo interno. Que el teléfono del profesional viaje en el JSON
 * del directorio significa que cualquiera abre DevTools, lo copia, llama por
 * fuera y **PI no se entera de nada** — se cae la plata, la métrica y la razón
 * de ser del frente.
 *
 * Los datos sembrados están hechos para el barrido: valores DISTINTIVOS ("NADIE
 * DEBE VER ESTE ...") en cada campo prohibido. Si un cambio futuro mete uno de
 * esos valores en la respuesta, aparece literal en el JSON y este test lo caza.
 */
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { GET as GET_LISTA } from "./route";
import { GET as GET_FACETAS } from "./facetas/route";
import { GET as GET_DETALLE } from "./[id]/route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearTokenUsuario, crearPaisCiudad } from "@/lib/reporte-test-utils";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

// Valores centinelas que NUNCA deben aparecer en ninguno de los JSON públicos.
// Uno por campo prohibido — así los mensajes de fallo dicen exactamente qué se
// filtró. Todos son cadenas literales, para poder barrer con `includes`.
const CENTINELAS = {
    email: "NADIE-DEBE-VER-EL-EMAIL@profesional.test",
    telefono: "+57NADIE_DEBE_VER_EL_TELEFONO",
    documentoNumero: "NADIE-DEBE-VER-EL-DOCUMENTO-42",
    apellidos: "NadieDebeVerLosApellidos",
    nombreUsuario: "NadieDebeVerElNombreUsuarioBase",
    numeroTarjeta: "TP-NADIE-DEBE-VER-LA-TARJETA-123",
    datosFacturacionRazonSocial: "NADIE-DEBE-VER-RAZON-SOCIAL",
    datosFacturacionNit: "NIT-NADIE-DEBE-VER",
} as const;

const CAMPOS_PROHIBIDOS = [
    ...Object.values(CENTINELAS),
    // Nombres de propiedades que jamás deben aparecer como claves del JSON.
    "numeroTarjetaProfesional",
    "datosFacturacion",
    "email",
    "telefono",
    "documentoTipo",
    "documentoNumero",
    "fechaNacimiento",
    "apellidos",
    // Campos internos de VerificacionProfesional (por si algún select cruzado
    // los tocara).
    "resultado",
    "checklist",
    "autorizacionArchivoId",
    "notaInterna",
    "avisoVencimientoEnviadoEn",
] as const;

/** Barrido — si `payload` contiene cualquiera de los campos prohibidos, falla. */
function afirmarPayloadSinContactoNiInternos(payload: unknown, ctx: string) {
    const raw = JSON.stringify(payload);
    for (const prohibido of CAMPOS_PROHIBIDOS) {
        expect(
            raw.includes(prohibido),
            `[${ctx}] el JSON del directorio no debe contener "${prohibido}". Payload: ${raw.slice(0, 300)}…`
        ).toBe(false);
    }
}

async function crearProfesionalActivo(ciudadId: string, extra?: { especialidades?: string[] }) {
    const usuario = await crearUsuario("PARENT"); // rol PARENT sirve — el candado del schema no restringe rol; L1b lo cambia a PROFESIONAL. Lo que importa es el Usuario base con los centinelas.
    // Machaco el Usuario base con centinelas para que el barrido detecte fugas
    // desde CUALQUIER join hacia `Usuario`. Sufijo único por id para no chocar
    // en los índices unique (email / documentoNumero).
    const suffix = usuario.id.slice(-8);
    await prisma.usuario.update({
        where: { id: usuario.id },
        data: {
            email: `${CENTINELAS.email}.${suffix}`,
            telefono: `${CENTINELAS.telefono}${suffix}`,
            documentoNumero: `${CENTINELAS.documentoNumero}-${suffix}`,
            apellidos: CENTINELAS.apellidos,
            nombre: CENTINELAS.nombreUsuario,
        },
    });
    return prisma.perfilProfesional.create({
        data: {
            usuarioId: usuario.id,
            nombreVisible: `Dra. Pública ${usuario.id.slice(0, 5)}`,
            tituloProfesional: "Psicóloga clínica",
            especialidades: extra?.especialidades ?? ["Ansiedad", "Adolescencia"],
            ciudadId,
            atiendeVirtual: true,
            atiendePresencial: false,
            aniosExperiencia: 8,
            presentacion: "Hola, soy visible sin problemas.",
            tarifaConsultaCOP: 120000,
            duracionMinutos: 50,
            emiteFactura: true,
            estado: "ACTIVO",
            // ¡Centinelas en los INTERNOS! Si un select los deja pasar, saltan.
            numeroTarjetaProfesional: CENTINELAS.numeroTarjeta,
            datosFacturacion: {
                razonSocial: CENTINELAS.datosFacturacionRazonSocial,
                nit: CENTINELAS.datosFacturacionNit,
            },
        },
    });
}

async function requestLista(query = "") {
    return new Request(`http://localhost:5005/api/padre/profesionales${query}`, { method: "GET" });
}

describe("SPEC-392 · GET /api/padre/profesionales · candado H-2", () => {
    beforeEach(async () => {
        await resetDatabase();
        mockToken = undefined;
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    it("401 sin token", async () => {
        const res = await GET_LISTA(await requestLista("?seed=abcdefgh1234"));
        expect(res.status).toBe(401);
    });

    it("403 con rol distinto de PARENT", async () => {
        const admin = await crearUsuario("ADMIN");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        const res = await GET_LISTA(await requestLista("?seed=abcdefgh1234"));
        expect(res.status).toBe(403);
    });

    it("400 si falta `seed`", async () => {
        const padre = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(padre.id, "PARENT");
        const res = await GET_LISTA(await requestLista(""));
        expect(res.status).toBe(400);
    });

    it("200: lista solo ACTIVO y NO filtra ningún campo prohibido (barrido)", async () => {
        const { ciudad } = await crearPaisCiudad();
        await crearProfesionalActivo(ciudad.id);
        await crearProfesionalActivo(ciudad.id);
        // Un profesional NO ACTIVO no debe aparecer.
        const usrBorrador = await crearUsuario("PARENT");
        await prisma.perfilProfesional.create({
            data: {
                usuarioId: usrBorrador.id,
                nombreVisible: "PROFESIONAL_QUE_NO_DEBE_VERSE",
                tituloProfesional: "En revisión",
                especialidades: [],
                ciudadId: ciudad.id,
                atiendeVirtual: true,
                atiendePresencial: false,
                aniosExperiencia: 1,
                presentacion: "no visible",
                tarifaConsultaCOP: 100000,
                duracionMinutos: 45,
                emiteFactura: false,
                estado: "BORRADOR",
            },
        });

        const padre = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(padre.id, "PARENT");
        const res = await GET_LISTA(await requestLista("?seed=abcdefgh1234"));
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.items.length).toBe(2);
        expect(JSON.stringify(json)).not.toContain("PROFESIONAL_QUE_NO_DEBE_VERSE");
        afirmarPayloadSinContactoNiInternos(json, "lista");
    });

    it("mismo `seed` = mismo orden (candado H-4 · sesión estable)", async () => {
        const { ciudad } = await crearPaisCiudad();
        // Varios profesionales — el orden en BD es indeterminado; la baraja lo fija.
        for (let i = 0; i < 6; i++) await crearProfesionalActivo(ciudad.id);
        const padre = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(padre.id, "PARENT");
        const seed = "sesion-fija-11111111";
        const r1 = await (await GET_LISTA(await requestLista(`?seed=${seed}`))).json();
        const r2 = await (await GET_LISTA(await requestLista(`?seed=${seed}`))).json();
        expect(r1.items.map((x: { id: string }) => x.id)).toEqual(
            r2.items.map((x: { id: string }) => x.id)
        );
    });

    it("distinto `seed` = puede cambiar el orden (baraja de verdad)", async () => {
        const { ciudad } = await crearPaisCiudad();
        for (let i = 0; i < 12; i++) await crearProfesionalActivo(ciudad.id);
        const padre = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(padre.id, "PARENT");
        const r1 = await (await GET_LISTA(await requestLista("?seed=semilla-A-11111111"))).json();
        const r2 = await (await GET_LISTA(await requestLista("?seed=semilla-B-22222222"))).json();
        // Mismos ids, orden distinto (con 12 elementos y 2 semillas distintas la colisión total es
        // 1/12! ≈ 2e-9 — despreciable).
        expect(new Set(r1.items.map((x: { id: string }) => x.id))).toEqual(
            new Set(r2.items.map((x: { id: string }) => x.id))
        );
        expect(r1.items.map((x: { id: string }) => x.id)).not.toEqual(
            r2.items.map((x: { id: string }) => x.id)
        );
    });

    it("filtro por ciudad y especialidad estrecha la base", async () => {
        const { ciudad } = await crearPaisCiudad();
        await crearProfesionalActivo(ciudad.id, { especialidades: ["Ansiedad"] });
        await crearProfesionalActivo(ciudad.id, { especialidades: ["Duelo"] });
        const padre = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(padre.id, "PARENT");
        const q = "?seed=filtro-11111111&especialidad=Ansiedad";
        const res = await (await GET_LISTA(await requestLista(q))).json();
        expect(res.items.length).toBe(1);
    });
});

describe("SPEC-392 · GET /api/padre/profesionales/facetas · candado H-2", () => {
    beforeEach(async () => {
        await resetDatabase();
        mockToken = undefined;
    });

    it("200: ciudades y especialidades derivadas de ACTIVO, sin datos del profesional", async () => {
        const { ciudad } = await crearPaisCiudad();
        await crearProfesionalActivo(ciudad.id, { especialidades: ["Ansiedad", "Duelo"] });
        const padre = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(padre.id, "PARENT");
        const res = await GET_FACETAS();
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.ciudades.length).toBe(1);
        expect(json.especialidades).toEqual(["Ansiedad", "Duelo"]);
        afirmarPayloadSinContactoNiInternos(json, "facetas");
    });
});

describe("SPEC-392 · GET /api/padre/profesionales/[id] · candado H-2", () => {
    beforeEach(async () => {
        await resetDatabase();
        mockToken = undefined;
    });

    it("200 con perfil ACTIVO — barrido completo", async () => {
        const { ciudad } = await crearPaisCiudad();
        const perfil = await crearProfesionalActivo(ciudad.id);
        const padre = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(padre.id, "PARENT");
        const res = await GET_DETALLE(new Request(`http://localhost:5005/api/padre/profesionales/${perfil.id}`), {
            params: Promise.resolve({ id: perfil.id }),
        });
        expect(res.status).toBe(200);
        const json = await res.json();
        afirmarPayloadSinContactoNiInternos(json, "detalle");
    });

    it("404 con perfil NO ACTIVO (BORRADOR / EN_REVISION no se asoman)", async () => {
        const { ciudad } = await crearPaisCiudad();
        const usrBorrador = await crearUsuario("PARENT");
        const perfil = await prisma.perfilProfesional.create({
            data: {
                usuarioId: usrBorrador.id,
                nombreVisible: "En revisión",
                tituloProfesional: "En revisión",
                especialidades: [],
                ciudadId: ciudad.id,
                atiendeVirtual: false,
                atiendePresencial: true,
                aniosExperiencia: 1,
                presentacion: "en revisión",
                tarifaConsultaCOP: 100000,
                duracionMinutos: 45,
                emiteFactura: false,
                estado: "EN_REVISION",
            },
        });
        const padre = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(padre.id, "PARENT");
        const res = await GET_DETALLE(new Request(`http://localhost:5005/api/padre/profesionales/${perfil.id}`), {
            params: Promise.resolve({ id: perfil.id }),
        });
        expect(res.status).toBe(404);
    });
});
