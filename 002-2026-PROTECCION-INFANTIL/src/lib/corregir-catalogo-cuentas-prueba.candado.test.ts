/**
 * SPEC-685 (seguimiento) · CANDADO DE INTEGRACIÓN — corrector puntual de catálogo por CORREO.
 *   - DRY-RUN deja la base IDÉNTICA (no escribe).
 *   - --confirm rellena SOLO los perfiles de los aliases del allowlist, con combinaciones
 *     válidas y DISTINTAS; un tercer perfil (fuera del allowlist) queda INTACTO (control positivo
 *     de la guarda «no toca ningún otro perfil»).
 *   - Idempotente.
 *   - ABORTA si un alias no resuelve a exactamente 1 perfil (no adivina, no toca a nadie).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { corregirCatalogoCuentasPrueba } from "../../scripts/corregir-catalogo-cuentas-prueba";
import { firmaCombo } from "../../scripts/lib/perfil-catalogo-seed";

const ALIAS_A = "zz.corrector.aaa";
const ALIAS_B = "zz.corrector.bbb";
const ALIASES = [ALIAS_A, ALIAS_B] as const;

async function ciudadDePrueba(): Promise<string> {
    const existente = await prisma.ciudad.findFirst({ select: { id: true } });
    if (existente) return existente.id;
    const pais = await prisma.pais.create({ data: { codigo: "ZZ", nombre: "País E2E" } });
    return (await prisma.ciudad.create({ data: { nombre: "Ciudad E2E", paisId: pais.id } })).id;
}

async function crearPerfilVacio(ciudadId: string, emailLocal: string): Promise<string> {
    const u = await prisma.usuario.create({
        data: {
            email: `${emailLocal}@ejemplo.local`,
            nombre: "Prueba",
            passwordHash: "fixture-no-login",
            rol: "PROFESIONAL",
            estado: "activo",
            estadoActivacion: "ACTIVO",
            debeCambiarPassword: false,
        },
        select: { id: true },
    });
    const p = await prisma.perfilProfesional.create({
        data: {
            usuarioId: u.id,
            nombreVisible: "Prueba",
            tituloProfesional: "Título viejo",
            especialidades: [],
            profesion: null,
            areasAtencion: [],
            rangoEtario: [],
            ciudadId,
            aniosExperiencia: 3,
            presentacion: "x",
            tarifaConsultaCOP: 100000,
            duracionMinutos: 45,
            estado: "ACTIVO",
            atiendeVirtual: true,
        },
        select: { id: true },
    });
    return p.id;
}

const cols = { select: { profesion: true, areasAtencion: true, rangoEtario: true, tituloProfesional: true, especialidades: true } } as const;
const leer = (id: string) => prisma.perfilProfesional.findUniqueOrThrow({ where: { id }, ...cols });
// SPEC-717 (I-428): el corrector aplica FILA POR FILA (sin `$transaction` envolvente); recibe el
// cliente directo para que una fila que reviente no arrastre a las demás.
const correr = (dryRun: boolean) => corregirCatalogoCuentasPrueba(prisma, { dryRun, aliases: ALIASES });

const CHECK_MODALIDAD = "PerfilProfesional_modalidad_estado_check";
/**
 * SPEC-717 (I-428): crea una fila que el CHECK NOT VALID «indultó» (como la cuenta E2E en prod):
 * un perfil no-BORRADOR SIN modalidad. Se hace bajando el CHECK, insertando, y re-agregándolo
 * TAL CUAL estaba (con su `pg_get_constraintdef`, NOT VALID incluido) — así la fila ilegal
 * sobrevive igual que en producción. Si el CHECK no existe en la BD de test, inserta directo.
 */
async function crearPerfilIndultado(ciudadId: string, emailLocal: string): Promise<string> {
    const u = await prisma.usuario.create({
        data: {
            email: `${emailLocal}@ejemplo.local`,
            nombre: "Indultado",
            passwordHash: "fixture-no-login",
            rol: "PROFESIONAL",
            estado: "activo",
            estadoActivacion: "ACTIVO",
            debeCambiarPassword: false,
        },
        select: { id: true },
    });
    const filas = await prisma.$queryRawUnsafe<{ def: string }[]>(
        `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = '${CHECK_MODALIDAD}'`,
    );
    const def = filas[0]?.def;
    if (def) await prisma.$executeRawUnsafe(`ALTER TABLE "PerfilProfesional" DROP CONSTRAINT "${CHECK_MODALIDAD}"`);
    try {
        const p = await prisma.perfilProfesional.create({
            data: {
                usuarioId: u.id,
                nombreVisible: "Indultado",
                tituloProfesional: "Título viejo",
                especialidades: [],
                profesion: null,
                areasAtencion: [],
                rangoEtario: [],
                ciudadId,
                aniosExperiencia: 3,
                presentacion: "x",
                tarifaConsultaCOP: 100000,
                duracionMinutos: 45,
                estado: "EN_REVISION",
                atiendeVirtual: false,
                atiendePresencial: false,
            },
            select: { id: true },
        });
        return p.id;
    } finally {
        if (def) await prisma.$executeRawUnsafe(`ALTER TABLE "PerfilProfesional" ADD CONSTRAINT "${CHECK_MODALIDAD}" ${def}`);
    }
}

describe("SPEC-685 · corregirCatalogoCuentasPrueba (por correo)", () => {
    beforeEach(async () => resetDatabase());

    it("DRY-RUN deja la base IDÉNTICA", async () => {
        const c = await ciudadDePrueba();
        const a = await crearPerfilVacio(c, ALIAS_A);
        const b = await crearPerfilVacio(c, ALIAS_B);
        const antesA = await leer(a);
        const r = await correr(true);
        expect(r.escrito).toBe(false);
        expect(r.resueltos).toBe(2);
        expect(await leer(a)).toEqual(antesA); // intacto
    });

    it("--confirm rellena SOLO los 2 del allowlist, con combos distintos; el tercero queda intacto", async () => {
        const c = await ciudadDePrueba();
        const a = await crearPerfilVacio(c, ALIAS_A);
        const b = await crearPerfilVacio(c, ALIAS_B);
        const otro = await crearPerfilVacio(c, "zz.corrector.otro"); // NO está en el allowlist
        const otroAntes = await leer(otro);

        const r = await correr(false);
        expect(r.escrito).toBe(true);

        const pa = await leer(a);
        const pb = await leer(b);
        expect(pa.profesion).toBeTruthy();
        expect(pa.areasAtencion.length).toBeGreaterThanOrEqual(1);
        expect(pb.profesion).toBeTruthy();
        // distintos entre sí (no clonados):
        expect(firmaCombo({ profesion: pa.profesion ?? "", areasAtencion: pa.areasAtencion, rangoEtario: pa.rangoEtario })).not.toBe(
            firmaCombo({ profesion: pb.profesion ?? "", areasAtencion: pb.areasAtencion, rangoEtario: pb.rangoEtario }),
        );
        // CONTROL POSITIVO · el perfil fuera del allowlist NO se tocó:
        expect(await leer(otro)).toEqual(otroAntes);
    });

    it("idempotente: la 2ª corrida no cambia la base", async () => {
        const c = await ciudadDePrueba();
        const a = await crearPerfilVacio(c, ALIAS_A);
        await crearPerfilVacio(c, ALIAS_B);
        await correr(false);
        const trasPrimera = await leer(a);
        await correr(false);
        expect(await leer(a)).toEqual(trasPrimera);
    });

    it("ABORTA si un alias no resuelve a exactamente 1 perfil (no toca a nadie)", async () => {
        const c = await ciudadDePrueba();
        await crearPerfilVacio(c, ALIAS_A); // solo A; B no existe → debe abortar
        await expect(correr(false)).rejects.toThrow(/resolvió 0 perfiles|se esperaba 1/);
    });

    it("SPEC-717 (I-428): una fila que revienta NO aborta a las demás — se aplica el resto y se reporta la que falló", async () => {
        const c = await ciudadDePrueba();
        const a = await crearPerfilVacio(c, ALIAS_A); // sano (ACTIVO con modalidad) → se aplica
        const b = await crearPerfilIndultado(c, ALIAS_B); // EN_REVISION sin modalidad → 23514 al actualizar
        const bAntes = await leer(b);

        // No debe LANZAR (antes: un solo $transaction → la fila B abortaba todo, incluida A).
        const r = await correr(false);

        // A quedó corregida a pesar de que B reventó.
        expect((await leer(a)).profesion, "la fila sana se aplicó pese al fallo de la otra").toBeTruthy();
        // B no cambió y quedó registrada como fallida, con el motivo (el CHECK de modalidad).
        expect(await leer(b), "la fila indultada quedó intacta").toEqual(bAntes);
        expect(r.escrito).toBe(true);
        expect(r.fallidas).toHaveLength(1);
        expect(r.fallidas[0]!.perfilId).toBe(b);
        expect(r.fallidas[0]!.error, "el motivo reportado es el CHECK de modalidad").toMatch(
            /23514|PerfilProfesional_modalidad_estado_check/,
        );
    });
});
