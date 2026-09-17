/**
 * SPEC-685 · CANDADO DE INTEGRACIÓN — converger las 5 columnas de catálogo/legado de los perfiles
 * MARCADOS de la corrida red-apoyo-676, sin purgar (los ids y vínculos se conservan):
 *   - DRY-RUN deja la base IDÉNTICA (defecto-1 del CEO: un dry-run que escribe es una trampa).
 *   - --confirm escribe SOLO las 5 columnas y SOLO en los marcados (control positivo: un perfil
 *     sin marca queda intacto).
 *   - Idempotente: una 2ª corrida converge 0.
 *
 * Vive en `src/**` a propósito (integración con base). Ejercita la función del script.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { convergerCatalogoRedApoyo } from "../../scripts/demo-prod/converger-catalogo-red-apoyo";
import { CORRIDA_RED, SCRIPT_RED } from "../../scripts/demo-prod/lib/red-apoyo-plan";
import { derivarPerfilCatalogoSeed, CLAVES_SEED_RED_APOYO } from "../../scripts/lib/perfil-catalogo-seed";

async function ciudadDePrueba(): Promise<string> {
    const existente = await prisma.ciudad.findFirst({ select: { id: true } });
    if (existente) return existente.id;
    const pais = await prisma.pais.create({ data: { codigo: "ZZ", nombre: "País E2E" } });
    const ciudad = await prisma.ciudad.create({ data: { nombre: "Ciudad E2E", paisId: pais.id } });
    return ciudad.id;
}

/** Perfil con las columnas de catálogo VACÍAS y las legado con texto viejo (estado pre-convergencia). */
async function crearPerfilCatalogoVacio(ciudadId: string, marcado: boolean): Promise<string> {
    const prof = await prisma.usuario.create({
        data: {
            email: `prof.s685.${marcado ? "m" : "u"}.${Date.now()}.${Math.random()}@example.com`,
            nombre: "Prof S685",
            passwordHash: "fixture-no-login",
            rol: "PROFESIONAL",
            estado: "activo",
            estadoActivacion: "ACTIVO",
            debeCambiarPassword: false,
        },
        select: { id: true },
    });
    const perfil = await prisma.perfilProfesional.create({
        data: {
            usuarioId: prof.id,
            nombreVisible: "Prof S685",
            tituloProfesional: "Psicóloga clínica (viejo)",
            especialidades: ["Ansiedad infantil (viejo)"],
            profesion: null,
            areasAtencion: [],
            rangoEtario: [],
            ciudadId,
            aniosExperiencia: 5,
            presentacion: "x",
            tarifaConsultaCOP: 100000,
            duracionMinutos: 50,
            estado: "ACTIVO",
            atiendeVirtual: true,
        },
        select: { id: true },
    });
    if (marcado) {
        await prisma.demoMarcado.create({
            data: { entidad: "PerfilProfesional", entidadId: perfil.id, metadata: { corrida: CORRIDA_RED, script: SCRIPT_RED } },
        });
    }
    return perfil.id;
}

const cols = { select: { profesion: true, areasAtencion: true, rangoEtario: true, tituloProfesional: true, especialidades: true } } as const;
const leer = (id: string) => prisma.perfilProfesional.findUniqueOrThrow({ where: { id }, ...cols });
const converger = (dryRun: boolean) => prisma.$transaction((tx) => convergerCatalogoRedApoyo(tx, { dryRun }));

describe("SPEC-685 · convergerCatalogoRedApoyo", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("DRY-RUN deja la base IDÉNTICA (no escribe; defecto-1 del CEO)", async () => {
        const ciudadId = await ciudadDePrueba();
        const id = await crearPerfilCatalogoVacio(ciudadId, true);
        const antes = await leer(id);

        const r = await converger(true);

        expect(r.escrito).toBe(false);
        expect(r.porConverger).toBe(1); // habría 1 por converger, pero NO se escribió
        expect(await leer(id)).toEqual(antes); // profesion null, areas [], titulo "…(viejo)": intacto
    });

    it("--confirm converge las 5 columnas al catálogo (misma derivación que la API)", async () => {
        const ciudadId = await ciudadDePrueba();
        const id = await crearPerfilCatalogoVacio(ciudadId, true);
        const esperado = await derivarPerfilCatalogoSeed(CLAVES_SEED_RED_APOYO);

        const r = await converger(false);
        expect(r.escrito).toBe(true);
        expect(r.porConverger).toBe(1);

        const p = await leer(id);
        expect(p.profesion).toBe(esperado.profesion);
        expect(p.areasAtencion).toEqual(esperado.areasAtencion);
        expect(p.rangoEtario).toEqual(esperado.rangoEtario);
        expect(p.tituloProfesional).toBe(esperado.tituloProfesional); // etiqueta del catálogo, no el texto viejo
        expect(p.especialidades).toEqual(esperado.especialidades);
    });

    it("CONTROL POSITIVO · solo toca los MARCADOS; un perfil sin marca queda intacto", async () => {
        const ciudadId = await ciudadDePrueba();
        const marcado = await crearPerfilCatalogoVacio(ciudadId, true);
        const sinMarca = await crearPerfilCatalogoVacio(ciudadId, false);
        const sinMarcaAntes = await leer(sinMarca);

        const r = await converger(false);
        expect(r.marcados).toBe(1); // solo el marcado

        expect((await leer(marcado)).profesion).not.toBeNull(); // convergido
        expect(await leer(sinMarca)).toEqual(sinMarcaAntes); // intacto
    });

    it("idempotente: la 2ª corrida converge 0 y no cambia la base", async () => {
        const ciudadId = await ciudadDePrueba();
        const id = await crearPerfilCatalogoVacio(ciudadId, true);

        await converger(false);
        const trasPrimera = await leer(id);
        const r2 = await converger(false);

        expect(r2.porConverger).toBe(0);
        expect(await leer(id)).toEqual(trasPrimera);
    });

    it("sin perfiles marcados de la corrida → no-op (marcados 0)", async () => {
        const ciudadId = await ciudadDePrueba();
        await crearPerfilCatalogoVacio(ciudadId, false); // sin marca
        const r = await converger(false);
        expect(r).toMatchObject({ marcados: 0, porConverger: 0, escrito: false });
    });
});
