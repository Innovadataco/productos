/**
 * SPEC-690-B (I-414) · Candado de INTEGRACIÓN: el DIRECTORIO del padre muestra
 * EXACTAMENTE el conjunto de `estaHabilitado` — ni uno de más. El directorio y la
 * compuerta son la MISMA habilitación (SPEC-690); si la consulta del directorio
 * usa una vigencia más laxa que `verificacionVigente`, un profesional que la
 * compuerta bloquea seguiría LISTADO para que un padre le agende.
 *
 * CONTROL POSITIVO (la fila que separa las semánticas): un profesional ACTIVO con
 * DOS aprobaciones — una VIEJA cuyo `venceEn` sigue en el futuro y una NUEVA (más
 * reciente por `revisadoEn`) ya VENCIDA. La verificación autoritativa es la MÁS
 * RECIENTE (`ultimaAprobacion`): venció → NO habilitado. Pero el SQL viejo
 * («existe ALGUNA aprobada con venceEn > ahora») ve la vieja vigente y lo
 * incluiría. Con el filtro autoritativo NO aparece; con el SQL solo, SÍ → este
 * candado se pone rojo. (Hoy las formas coinciden porque venceEn = revisadoEn +
 * plazo fijo; se siembra el `venceEn` a mano para forzar la divergencia que la ley
 * traería si cambiara el plazo — y para que el candado la vigile desde ya.)
 *
 * Cubre las CUATRO lecturas del directorio (SPEC-656 · conteo ≡ lista): `listarActivos`,
 * `contarActivos`, `obtenerPublicoPorId` y —desde SPEC-790— `facetas`. `facetas` es el 4º
 * consumidor: hasta 790 escribía el `where` a mano sin vigencia y poblaba los filtros con la
 * ciudad/especialidad de un profesional cuya ÚLTIMA verificación venció (opción de filtro
 * muerta). Ahora pasa por el MISMO predicado y filtro autoritativo que la lista; este candado
 * lo vigila con el control positivo de la DIVERGENTE (faceta propia que NO debe aparecer).
 */
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearPaisCiudad } from "@/lib/reporte-test-utils";
import { PerfilProfesionalRepository } from "./perfil-profesional";
import { estaHabilitado, type VerificacionResumenInput } from "@/lib/profesionales/vigencia";
import type { EstadoPerfilProfesional } from "@prisma/client";

const DIA = 24 * 60 * 60 * 1000;
const AHORA = new Date();
const FUTURO = new Date(AHORA.getTime() + 90 * DIA); // vigente
const PASADO = new Date(AHORA.getTime() - 1 * DIA); // vencido
const REVISADO_VIEJO = new Date(AHORA.getTime() - 100 * DIA);
const REVISADO_NUEVO = new Date(AHORA.getTime() - 10 * DIA);

interface CasoSembrado {
    nombre: string;
    perfilId: string;
    estado: EstadoPerfilProfesional;
    verificaciones: VerificacionResumenInput[];
}

describe("SPEC-690-B · el directorio del padre === estaHabilitado (vigencia autoritativa)", () => {
    let ciudadId: string;

    beforeEach(async () => {
        await resetDatabase();
        const { ciudad } = await crearPaisCiudad();
        ciudadId = ciudad.id;
    });

    afterAll(async () => prisma.$disconnect());

    async function sembrar(
        nombre: string,
        estado: EstadoPerfilProfesional,
        aprobaciones: Array<{ revisadoEn: Date; venceEn: Date }>,
        overrides: { ciudadId?: string; especialidad?: string } = {},
    ): Promise<CasoSembrado> {
        const usuario = await crearUsuario("PROFESIONAL");
        const perfil = await prisma.perfilProfesional.create({
            data: {
                usuarioId: usuario.id,
                nombreVisible: nombre,
                tituloProfesional: "Psicología",
                especialidades: [overrides.especialidad ?? "infantil"],
                ciudadId: overrides.ciudadId ?? ciudadId,
                atiendeVirtual: true,
                aniosExperiencia: 5,
                presentacion: "Perfil de prueba SPEC-690-B.",
                tarifaConsultaCOP: 150000,
                duracionMinutos: 45,
                estado,
            },
        });
        for (const a of aprobaciones) {
            const revisor = await crearUsuario("ADMIN");
            await prisma.verificacionProfesional.create({
                data: {
                    perfilProfesionalId: perfil.id,
                    revisadoPorId: revisor.id,
                    revisadoEn: a.revisadoEn,
                    checklist: {},
                    resultado: "APROBADO",
                    autorizacionArchivoId: `archivo-${perfil.id}`,
                    venceEn: a.venceEn,
                },
            });
        }
        return {
            nombre,
            perfilId: perfil.id,
            estado,
            verificaciones: aprobaciones.map((a) => ({ resultado: "APROBADO", revisadoEn: a.revisadoEn, venceEn: a.venceEn })),
        };
    }

    /** Siembra el abanico de estados/vigencias y devuelve el conjunto esperado (estaHabilitado). */
    async function sembrarAbanico() {
        const casos: CasoSembrado[] = [
            // Habilitado: ACTIVO + última aprobación vigente.
            await sembrar("Habilitada", "ACTIVO", [{ revisadoEn: REVISADO_NUEVO, venceEn: FUTURO }]),
            // Re-verificada: la MÁS RECIENTE es la vigente (una vieja venció) → habilitada.
            await sembrar("ReVerificada", "ACTIVO", [
                { revisadoEn: REVISADO_VIEJO, venceEn: PASADO },
                { revisadoEn: REVISADO_NUEVO, venceEn: FUTURO },
            ]),
            // DIVERGENTE (control positivo): la MÁS RECIENTE venció; una vieja sigue
            // con venceEn futuro. Autoritativo: NO habilitada. SQL viejo: la incluiría.
            await sembrar("Divergente", "ACTIVO", [
                { revisadoEn: REVISADO_VIEJO, venceEn: FUTURO },
                { revisadoEn: REVISADO_NUEVO, venceEn: PASADO },
            ]),
            // Sin verificación aprobada → no habilitada.
            await sembrar("SinVerificacion", "ACTIVO", []),
            // EN_REVISION con aprobación vigente → no habilitada por el ESTADO.
            await sembrar("EnRevision", "EN_REVISION", [{ revisadoEn: REVISADO_NUEVO, venceEn: FUTURO }]),
            // VENCIDO con aprobación vigente por venceEn → no habilitada por el ESTADO.
            await sembrar("Vencida", "VENCIDO", [{ revisadoEn: REVISADO_NUEVO, venceEn: FUTURO }]),
        ];
        const esperadosHabilitados = new Set(
            casos.filter((c) => estaHabilitado({ estado: c.estado }, c.verificaciones, AHORA)).map((c) => c.perfilId),
        );
        return { casos, esperadosHabilitados };
    }

    it("listarActivos devuelve EXACTAMENTE el conjunto de estaHabilitado (incl. la divergente EXCLUIDA)", async () => {
        const { casos, esperadosHabilitados } = await sembrarAbanico();
        const repo = new PerfilProfesionalRepository();

        const listados = new Set((await repo.listarActivos({}, null, AHORA)).map((p) => p.id));

        // El control positivo: la divergente NO puede estar listada.
        const divergente = casos.find((c) => c.nombre === "Divergente")!;
        expect(
            listados.has(divergente.perfilId),
            "la profesional cuya ÚLTIMA aprobación venció NO puede aparecer en el directorio (aunque una vieja siga vigente)",
        ).toBe(false);

        expect(listados).toEqual(esperadosHabilitados);
    });

    it("contarActivos coincide con el tamaño del conjunto habilitado (SPEC-656 conteo ≡ lista)", async () => {
        const { esperadosHabilitados } = await sembrarAbanico();
        const repo = new PerfilProfesionalRepository();

        const total = await repo.contarActivos(null, AHORA);
        const listados = await repo.listarActivos({}, null, AHORA);

        expect(total).toBe(esperadosHabilitados.size);
        expect(total, "el conteo (sin filtros) y la lista deben usar el MISMO criterio de vigencia").toBe(listados.length);
    });

    it("obtenerPublicoPorId devuelve no-nulo SOLO para los habilitados", async () => {
        const { casos, esperadosHabilitados } = await sembrarAbanico();
        const repo = new PerfilProfesionalRepository();

        for (const caso of casos) {
            const encontrado = await repo.obtenerPublicoPorId(caso.perfilId, null, AHORA);
            expect(
                encontrado !== null,
                `obtenerPublicoPorId(${caso.nombre}) debe ${esperadosHabilitados.has(caso.perfilId) ? "encontrarlo" : "dar null"}`,
            ).toBe(esperadosHabilitados.has(caso.perfilId));
        }
    });

    it("facetas deriva SOLO de habilitados — la faceta de la divergente (última vencida) NO puebla los filtros", async () => {
        // SPEC-790: `facetas` es el 4º consumidor. Control positivo: una DIVERGENTE con faceta
        // PROPIA (ciudad+especialidad únicas) cuya ÚLTIMA verificación venció — el SQL grueso la
        // dejaría pasar, el filtro autoritativo no. Si `facetas` leyera a mano, su faceta saldría
        // en el dropdown y el padre elegiría un filtro muerto.
        const repo = new PerfilProfesionalRepository();
        const { paisId } = await prisma.ciudad.findUniqueOrThrow({ where: { id: ciudadId }, select: { paisId: true } });
        const suf = Math.random().toString(36).slice(2, 9);
        const ciudadHab = await prisma.ciudad.create({ data: { nombre: `HabCiudad-${suf}`, nombreNormalizado: `habciudad-${suf}`, paisId } });
        const ciudadDiv = await prisma.ciudad.create({ data: { nombre: `DivCiudad-${suf}`, nombreNormalizado: `divciudad-${suf}`, paisId } });

        await sembrar("HabFaceta", "ACTIVO", [{ revisadoEn: REVISADO_NUEVO, venceEn: FUTURO }], {
            ciudadId: ciudadHab.id,
            especialidad: "ESP_HABILITADA",
        });
        // DIVERGENTE: la MÁS RECIENTE venció; una vieja con venceEn futuro → autoritativo NO habilitada.
        await sembrar(
            "DivFaceta",
            "ACTIVO",
            [
                { revisadoEn: REVISADO_VIEJO, venceEn: FUTURO },
                { revisadoEn: REVISADO_NUEVO, venceEn: PASADO },
            ],
            { ciudadId: ciudadDiv.id, especialidad: "ESP_DIVERGENTE" },
        );

        const f = await repo.facetas(null, AHORA);
        expect(f.especialidades, "la especialidad de un habilitado SÍ puebla el filtro").toContain("ESP_HABILITADA");
        expect(
            f.especialidades,
            "la especialidad de la divergente (última verificación vencida) NO puede poblar el filtro",
        ).not.toContain("ESP_DIVERGENTE");
        const idsCiudad = f.ciudades.map((c) => c.id);
        expect(idsCiudad).toContain(ciudadHab.id);
        expect(idsCiudad, "la ciudad de la divergente NO puede poblar el filtro").not.toContain(ciudadDiv.id);
    });
});
