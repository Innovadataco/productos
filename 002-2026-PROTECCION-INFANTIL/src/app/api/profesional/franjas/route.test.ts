/**
 * SPEC-447 (I-311) · las franjas del profesional, contra la BD.
 *
 * Candados de CONDUCTA: cada uno pega en el endpoint que dispara la pantalla y
 * afirma **la fila en base**, no el texto del código. La ruta existía desde
 * SPEC-395 y nunca se había ejercitado de punta a punta porque no había
 * pantalla que la llamara — en producción `FranjaDisponible` tuvo 0 filas.
 *
 * Dos de las cuatro validaciones que se prueban acá **no existían** antes de
 * esta spec: el solape y la modalidad que el profesional no atiende.
 */
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearTokenUsuario } from "@/lib/reporte-test-utils";
import { instanteDesdeHoraBogota, sumarMinutos } from "@/lib/fechas/formato-bogota";
import type { EstadoReps, ModalidadReps } from "@prisma/client";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

import { POST, GET } from "./route";
import { DELETE } from "./[id]/route";

const DIA = "2027-03-10";

async function sembrarProfesional(
    opciones: { virtual?: boolean; presencial?: boolean; venceEn?: Date } = {},
) {
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
    const usuario = await crearUsuario("PROFESIONAL", `psi.${Date.now()}.${Math.random()}@ejemplo.local`);
    mockToken = await crearTokenUsuario(usuario.id, "PROFESIONAL");
    const perfil = await prisma.perfilProfesional.create({
        data: {
            usuarioId: usuario.id,
            nombreVisible: "Mariana Restrepo",
            tituloProfesional: "Psicología",
            especialidades: ["infantil"],
            ciudadId: ciudad.id,
            aniosExperiencia: 8,
            presentacion: "Presentación.",
            tarifaConsultaCOP: 180000,
            duracionMinutos: 45,
            atiendeVirtual: opciones.virtual ?? true,
            atiendePresencial: opciones.presencial ?? false,
            estado: "ACTIVO",
        },
    });
    // SPEC-449: un ACTIVO real SIEMPRE tiene una verificación APROBADA vigente
    // (la Ley 2375/2024 obliga a revalidar cada 4 meses y `decidir` es lo único
    // que pone ACTIVO). El fixture creaba un estado que en producción no existe.
    const revisor = await crearUsuario("ADMIN", `verif.${Date.now()}.${Math.random()}@ejemplo.local`);
    await prisma.verificacionProfesional.create({
        data: {
            perfilProfesionalId: perfil.id,
            revisadoPorId: revisor.id,
            revisadoEn: new Date(Date.now() - 24 * 60 * 60 * 1000),
            checklist: {},
            resultado: "APROBADO",
            autorizacionArchivoId: "archivo-de-prueba",
            venceEn: opciones.venceEn ?? new Date("2027-06-01T00:00:00.000Z"),
        },
    });
    return { usuario, perfil };
}

/** El mismo cuerpo que arma la pantalla: día y hora de Bogotá + duración del perfil. */
function cuerpo(hora: string, modalidad: "VIRTUAL" | "PRESENCIAL" = "VIRTUAL", minutos = 45) {
    const inicio = instanteDesdeHoraBogota(DIA, hora);
    return {
        inicio: inicio.toISOString(),
        fin: sumarMinutos(inicio, minutos).toISOString(),
        modalidad,
    };
}

function req(body: unknown) {
    return new Request("http://localhost:5005/api/profesional/franjas", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
    });
}

describe("POST /api/profesional/franjas · SPEC-447 (I-311)", () => {
    beforeEach(async () => {
        await resetDatabase();
        mockToken = undefined;
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    it("publica la franja y la fila QUEDA en base, libre y a la hora de Bogotá", async () => {
        const { perfil } = await sembrarProfesional();

        const res = await POST(req(cuerpo("10:00")));
        expect(res.status).toBe(200);

        const filas = await prisma.franjaDisponible.findMany({ where: { profesionalId: perfil.id } });
        expect(filas).toHaveLength(1);
        // 10:00 en Bogotá = 15:00 UTC. Si esto se rompe, la agenda se corre
        // cinco horas y el padre reserva a una hora que nadie prometió.
        expect(filas[0]!.inicio.toISOString()).toBe("2027-03-10T15:00:00.000Z");
        expect(filas[0]!.fin.toISOString()).toBe("2027-03-10T15:45:00.000Z");
        expect(filas[0]!.tomada).toBe(false);
    });

    it("y el GET se la devuelve al profesional", async () => {
        await sembrarProfesional();
        await POST(req(cuerpo("10:00")));

        const res = await GET();
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body.data).toHaveLength(1);
    });

    it("contraprueba · un rango invertido se rechaza y NO deja fila", async () => {
        const { perfil } = await sembrarProfesional();
        const inicio = instanteDesdeHoraBogota(DIA, "10:00");

        const res = await POST(
            req({
                inicio: inicio.toISOString(),
                fin: sumarMinutos(inicio, -45).toISOString(),
                modalidad: "VIRTUAL",
            }),
        );

        expect(res.status).toBe(400);
        expect(await prisma.franjaDisponible.count({ where: { profesionalId: perfil.id } })).toBe(0);
    });

    it("contraprueba · una franja que se PISA con otra se rechaza", async () => {
        const { perfil } = await sembrarProfesional();
        expect((await POST(req(cuerpo("10:00")))).status).toBe(200);

        // Empieza dentro de la anterior (10:00–10:45).
        const res = await POST(req(cuerpo("10:30")));

        expect(res.status).toBe(400);
        expect(await prisma.franjaDisponible.count({ where: { profesionalId: perfil.id } })).toBe(1);
    });

    it("pegada a la anterior SÍ se puede: 10:45 arranca donde la otra termina", async () => {
        const { perfil } = await sembrarProfesional();
        await POST(req(cuerpo("10:00")));

        const res = await POST(req(cuerpo("10:45")));

        expect(res.status).toBe(200);
        expect(await prisma.franjaDisponible.count({ where: { profesionalId: perfil.id } })).toBe(2);
    });

    it("el solape se mira POR PROFESIONAL: la franja de otro no estorba", async () => {
        await sembrarProfesional();
        await POST(req(cuerpo("10:00")));

        const { perfil: otro } = await sembrarProfesional();
        const res = await POST(req(cuerpo("10:00")));

        expect(res.status).toBe(200);
        expect(await prisma.franjaDisponible.count({ where: { profesionalId: otro.id } })).toBe(1);
    });

    it("contraprueba · una modalidad que NO atiende se rechaza", async () => {
        const { perfil } = await sembrarProfesional({ virtual: true, presencial: false });

        const res = await POST(req(cuerpo("10:00", "PRESENCIAL")));

        expect(res.status).toBe(400);
        expect(await prisma.franjaDisponible.count({ where: { profesionalId: perfil.id } })).toBe(0);
    });

    it("SPEC-449 · una franja que cae DESPUÉS del vencimiento se rechaza", async () => {
        // Verificación que vence el 01-03-2027; la franja del fixture es del 10-03.
        const { perfil } = await sembrarProfesional({ venceEn: new Date("2027-03-01T00:00:00.000Z") });

        const res = await POST(req(cuerpo("10:00")));

        expect(
            res.status,
            "La Ley 2375/2024 mide la obligación en el momento de la ATENCIÓN: agendar " +
                "para después del vencimiento es agendar para cuando los antecedentes no valen.",
        ).toBe(400);
        expect(await prisma.franjaDisponible.count({ where: { profesionalId: perfil.id } })).toBe(0);
    });

    it("CONTRAPRUEBA · la misma franja ANTES del vencimiento sí se publica", async () => {
        const { perfil } = await sembrarProfesional({ venceEn: new Date("2027-03-11T00:00:00.000Z") });

        const res = await POST(req(cuerpo("10:00")));

        expect(res.status).toBe(200);
        expect(await prisma.franjaDisponible.count({ where: { profesionalId: perfil.id } })).toBe(1);
    });

    it("sin ninguna verificación aprobada no se puede publicar disponibilidad", async () => {
        const { perfil } = await sembrarProfesional();
        await prisma.verificacionProfesional.deleteMany({ where: { perfilProfesionalId: perfil.id } });

        const res = await POST(req(cuerpo("10:00")));

        // SPEC-690 (I-414): sin verificación vigente el profesional NO está
        // habilitado. La compuerta de la ruta operativa lo corta con 403 ANTES
        // del tope de vencimiento de SPEC-447 (que sigue como defensa en
        // profundidad, ahora inalcanzable por esta vía). El invariante «sin
        // vigencia no se publica» se mantiene, ahora más fuerte.
        expect(
            res.status,
            "Sin vigencia no está habilitado: la compuerta corta con 403 antes de cualquier tope.",
        ).toBe(403);
    });

    it("sin sesión de PROFESIONAL no se publica nada", async () => {
        mockToken = undefined;
        const res = await POST(req(cuerpo("10:00")));
        expect([401, 403]).toContain(res.status);
    });
});

describe("POST /api/profesional/franjas · SPEC-714 · día bloqueado (regla 1)", () => {
    beforeEach(async () => {
        await resetDatabase();
        mockToken = undefined;
    });

    it("un día CERRADO rechaza la franja (400) y NO deja fila", async () => {
        const { perfil } = await sembrarProfesional();
        // El día del fixture (DIA = 2027-03-10) queda cerrado en la agenda.
        await prisma.diaBloqueado.create({ data: { profesionalId: perfil.id, fecha: DIA } });

        const res = await POST(req(cuerpo("10:00")));

        expect(res.status).toBe(400);
        expect(await prisma.franjaDisponible.count({ where: { profesionalId: perfil.id } })).toBe(0);
    });

    it("CONTRAPRUEBA · con OTRO día cerrado, la franja de DIA se publica normal", async () => {
        const { perfil } = await sembrarProfesional();
        await prisma.diaBloqueado.create({ data: { profesionalId: perfil.id, fecha: "2027-03-11" } });

        const res = await POST(req(cuerpo("10:00")));

        expect(res.status).toBe(200);
        expect(await prisma.franjaDisponible.count({ where: { profesionalId: perfil.id } })).toBe(1);
    });

    it("el bloqueo es POR PROFESIONAL: el día cerrado de OTRO no me estorba", async () => {
        const { perfil: ajeno } = await sembrarProfesional();
        await prisma.diaBloqueado.create({ data: { profesionalId: ajeno.id, fecha: DIA } });
        // Segundo profesional (reemplaza el token de sesión); su DIA está abierto.
        await sembrarProfesional();

        const res = await POST(req(cuerpo("10:00")));

        expect(res.status).toBe(200);
    });
});

describe("DELETE /api/profesional/franjas/[id] · SPEC-447", () => {
    beforeEach(async () => {
        await resetDatabase();
        mockToken = undefined;
    });

    it("retira una franja libre y la fila DESAPARECE", async () => {
        const { perfil } = await sembrarProfesional();
        await POST(req(cuerpo("10:00")));
        const franja = await prisma.franjaDisponible.findFirstOrThrow({
            where: { profesionalId: perfil.id },
        });

        const res = await DELETE(new Request("http://localhost:5005/x"), {
            params: Promise.resolve({ id: franja.id }),
        });

        expect(res.status).toBe(200);
        expect(await prisma.franjaDisponible.count({ where: { profesionalId: perfil.id } })).toBe(0);
    });

    it("contraprueba · una franja TOMADA no se puede retirar — hay una familia esperando", async () => {
        const { perfil } = await sembrarProfesional();
        await POST(req(cuerpo("10:00")));
        const franja = await prisma.franjaDisponible.findFirstOrThrow({
            where: { profesionalId: perfil.id },
        });
        await prisma.franjaDisponible.update({ where: { id: franja.id }, data: { tomada: true } });

        const res = await DELETE(new Request("http://localhost:5005/x"), {
            params: Promise.resolve({ id: franja.id }),
        });

        expect(res.status).toBe(400);
        // Lo que importa no es el código: es que la franja SIGA ahí.
        expect(await prisma.franjaDisponible.count({ where: { id: franja.id } })).toBe(1);
    });

    it("un profesional no puede retirar la franja de otro", async () => {
        const { perfil: ajeno } = await sembrarProfesional();
        await POST(req(cuerpo("10:00")));
        const franja = await prisma.franjaDisponible.findFirstOrThrow({
            where: { profesionalId: ajeno.id },
        });

        // Segundo profesional: `sembrarProfesional` reemplaza el token de sesión.
        await sembrarProfesional();
        const res = await DELETE(new Request("http://localhost:5005/x"), {
            params: Promise.resolve({ id: franja.id }),
        });

        expect(res.status).toBe(404);
        expect(await prisma.franjaDisponible.count({ where: { id: franja.id } })).toBe(1);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// SPEC-834 (VEREDICTO A) · la SEGUNDA puerta de creación de franja (la UNITARIA)
// acota al HUECO DE MODALIDAD puro: rechaza SOLO cuando la vigencia y nuestro
// re-chequeo están al día (`repsAlDia`) PERO el REPS no cubre ESTA modalidad. Las
// causas de vigencia —REPS vencido, o nuestro re-chequeo envejecido («estado 7»)— NO
// las bloquea 834 (son 813/836/828), para no impedirle trabajar a alguien con la
// inscripción perfecta por NUESTRA demora, y porque el vacío de 825 se cura solo al
// re-verificar. Candado de CONDUCTA: pega en el POST real y afirma la FILA en base, no
// el texto del código. FUENTE ÚNICA, sin reimplementar: `repsAlDia` +
// `esRepsElegibleParaModalidad` (SPEC-790) + mapeo `modalidadRepsRequerida`. Muere por
// MUTACIÓN en dos sentidos: si se QUITA el gate, «VIGENTE presencial-only publica
// VIRTUAL» vuelve a 200; si se AMPLÍA a `!esReps(modalidad)` (bloquear vigencia acá),
// los casos de ALCANCE A (vencida / estado 7 publican) caen.
//
// MENSAJE (copy de Diseño, FORMA-SPEC834 v1.0): el PIVOTE «publíquela en la otra
// modalidad» se ofrece SOLO por DATO —la otra modalidad es publicable (atendida Y su
// REPS la cubre)—; nunca a ciegas, porque sería una segunda promesa falsa dentro del
// mensaje que existe para no mentir. Se afirma la PRESENCIA/AUSENCIA del pivote, no la
// copy verbatim completa, para no atar el candado a cada palabra de la forma.
// ─────────────────────────────────────────────────────────────────────────────
const UN_DIA_MS = 24 * 60 * 60 * 1000;

async function sembrarReps(
    perfilId: string,
    resultado: EstadoReps,
    modalidades: ModalidadReps[],
    opts: { vigenteHasta?: Date | null } = {},
) {
    await prisma.verificacionReps.create({
        data: {
            profesionalId: perfilId,
            verificadoEn: new Date(Date.now() - 5 * UN_DIA_MS),
            fuente: "MANUAL_ADMIN",
            resultado,
            vigenteHasta:
                opts.vigenteHasta !== undefined ? opts.vigenteHasta : resultado === "VIGENTE" ? new Date(Date.now() + 90 * UN_DIA_MS) : null,
            modalidades,
        },
    });
}

async function mensajeDe(res: Response): Promise<string> {
    const body = (await res.json()) as { error?: { message?: string } };
    return body.error?.message ?? "";
}

describe("POST /api/profesional/franjas · SPEC-834 · gate REPS × modalidad (2ª puerta)", () => {
    beforeEach(async () => {
        await resetDatabase();
        mockToken = undefined;
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    it("VIGENTE presencial-only: publicar VIRTUAL se RECHAZA, NO deja fila, y OFRECE el pivote a presencial", async () => {
        const { perfil } = await sembrarProfesional({ virtual: true, presencial: true });
        await sembrarReps(perfil.id, "VIGENTE", ["PRESENCIAL"]);

        const res = await POST(req(cuerpo("10:00", "VIRTUAL")));

        expect(res.status).toBe(400);
        expect(await prisma.franjaDisponible.count({ where: { profesionalId: perfil.id } })).toBe(0);
        const msg = await mensajeDe(res);
        // Pivote OFRECIDO: la otra modalidad (presencial) es atendida y su REPS la cubre.
        expect(msg).toContain("no cubre la modalidad virtual");
        expect(msg).toContain("publíquela en presencial");
    });

    it("CONTROL POSITIVO · el MISMO profesional publica PRESENCIAL (modalidad que su REPS SÍ cubre) → 200", async () => {
        const { perfil } = await sembrarProfesional({ virtual: true, presencial: true });
        await sembrarReps(perfil.id, "VIGENTE", ["PRESENCIAL"]);

        const res = await POST(req(cuerpo("10:00", "PRESENCIAL")));

        expect(res.status).toBe(200);
        expect(await prisma.franjaDisponible.count({ where: { profesionalId: perfil.id } })).toBe(1);
    });

    it("CONTROL POSITIVO · un VIGENTE que cubre TELEMEDICINA publica VIRTUAL → 200", async () => {
        const { perfil } = await sembrarProfesional({ virtual: true, presencial: true });
        await sembrarReps(perfil.id, "VIGENTE", ["PRESENCIAL", "TELEMEDICINA"]);

        const res = await POST(req(cuerpo("10:00", "VIRTUAL")));

        expect(res.status).toBe(200);
        expect(await prisma.franjaDisponible.count({ where: { profesionalId: perfil.id } })).toBe(1);
    });

    it("ALCANCE A · una REPS VENCIDA NO cae en esta puerta (vigencia es 813/828) → publica", async () => {
        const { perfil } = await sembrarProfesional({ virtual: true, presencial: true });
        await sembrarReps(perfil.id, "VENCIDA", []);

        const res = await POST(req(cuerpo("10:00", "PRESENCIAL")));

        // 834 acota al HUECO DE MODALIDAD. Una REPS vencida (repsAlDia=false) NO la bloquea 834 — el
        // aviso de caducidad es 813, la cola del operador 836 y el backstop 828 al reservar. Publica.
        expect(res.status).toBe(200);
        expect(await prisma.franjaDisponible.count({ where: { profesionalId: perfil.id } })).toBe(1);
    });

    it("ALCANCE A · estado 7 (nuestro re-chequeo envejeció; la inscripción cubre la modalidad) → 834 NO bloquea → publica", async () => {
        const { perfil } = await sembrarProfesional({ virtual: true, presencial: true });
        // VIGENTE, cubre TELEMEDICINA (=virtual), vigencia futura — PERO verificadoEn > 365 d atrás:
        // nuestra ventana venció (estado 7). La inscripción del profesional está PERFECTA; el re-chequeo
        // es NUESTRO. 834 no debe impedirle trabajar por nuestra demora → repsAlDia=false → no cae acá.
        await prisma.verificacionReps.create({
            data: {
                profesionalId: perfil.id,
                verificadoEn: new Date(Date.now() - 400 * UN_DIA_MS),
                fuente: "MANUAL_ADMIN",
                resultado: "VIGENTE",
                vigenteHasta: new Date(Date.now() + 90 * UN_DIA_MS),
                modalidades: ["PRESENCIAL", "TELEMEDICINA"],
            },
        });

        const res = await POST(req(cuerpo("10:00", "VIRTUAL")));

        expect(res.status).toBe(200);
        expect(await prisma.franjaDisponible.count({ where: { profesionalId: perfil.id } })).toBe(1);
    });

    it("PIVOTE POR DATO · aunque el REPS cubra presencial, si NO atiende presencial el mensaje NO ofrece el pivote", async () => {
        // atiende SOLO virtual; REPS vigente cubre SOLO presencial. Publicar VIRTUAL se rechaza por REPS;
        // la otra modalidad (presencial) la cubre el REPS pero NO la atiende → publicar ahí también se
        // rechazaría (banderas) → el pivote sería una promesa falsa → forma (b), solo renovar.
        const { perfil } = await sembrarProfesional({ virtual: true, presencial: false });
        await sembrarReps(perfil.id, "VIGENTE", ["PRESENCIAL"]);

        const res = await POST(req(cuerpo("10:00", "VIRTUAL")));

        expect(res.status).toBe(400);
        expect(await prisma.franjaDisponible.count({ where: { profesionalId: perfil.id } })).toBe(0);
        const msg = await mensajeDe(res);
        expect(msg).toContain("para volver a publicar");
        expect(msg).not.toContain("publíquela en");
    });

    it("UNIVERSO DE HOY · SIN fila REPS (SIN_VERIFICAR) + cutover abierto → publica igual (no encierra a nadie)", async () => {
        const { perfil } = await sembrarProfesional({ virtual: true, presencial: true });
        // sin sembrarReps → SIN_VERIFICAR; el default del cutover (EXIGIR_REPS_VERIFICADO
        // ausente = false) lo deja PASAR: el gate no rompe a quien publica hoy.
        const res = await POST(req(cuerpo("10:00", "VIRTUAL")));

        expect(res.status).toBe(200);
        expect(await prisma.franjaDisponible.count({ where: { profesionalId: perfil.id } })).toBe(1);
    });
});
