/**
 * CANDADO · SPEC-686 (I-420) · La AUTORIZACIÓN queda SIEMPRE antes de la revisión.
 *
 * Ley 1918/2018 · Decreto 753/2019: la autorización debe ser PREVIA a la consulta de
 * antecedentes. Dos niveles, ambos contra BD real:
 *   A) el primitivo `aceptacionAntesDe` devuelve la última aceptación con fecha <= T, y
 *      NUNCA una posterior (control positivo por una aceptación fechada DESPUÉS).
 *   B) `decidir` no deja revisar sin autorización previa (409), y cuando la hay, la fija en
 *      la verificación con `aceptadoEn <= revisadoEn`. Control positivo: sin aceptación ni
 *      archivo, NO se puede decidir.
 *
 * Muere por mutación: si `decidir` deja de exigir/registrar la autorización previa, cae.
 */
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import { AutorizacionProfesionalService } from "@/lib/dal/services/autorizacion-profesional";
import { decidir } from "./service";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

vi.mock("@/lib/queue", () => ({ sendNotificacionEnvio: vi.fn(async () => undefined) }));

const REQUISITOS = [{ clave: "tarjeta", nombre: "Tarjeta profesional", descripcion: "" }];
const MIN = 60_000;

async function ciudadId() {
    const pais = await prisma.pais.upsert({ where: { codigo: "CO" }, update: {}, create: { codigo: "CO", nombre: "Colombia" } });
    const c = (await prisma.ciudad.findFirst({ where: { paisId: pais.id } })) ??
        (await prisma.ciudad.create({ data: { nombre: "Bogotá", nombreNormalizado: "bogota", paisId: pais.id } }));
    return c.id;
}

async function sembrarCatalogoMotor() {
    for (const evento of ["profesional.verificacion.aprobada", "profesional.verificacion.devuelta"]) {
        const clave = `${evento}.email`;
        await prisma.notificacionPlantilla.create({
            data: { clave, canal: "EMAIL", asunto: "x", cuerpoMarkdown: "Hola {{nombreProfesional}}.", activa: true },
        });
        await prisma.notificacionRegla.create({
            data: { evento, rol: "PROFESIONAL", canal: "EMAIL", plantillaClave: clave, offset: "+0m", obligatoria: true, activa: true },
        });
    }
}

async function sembrarPerfilEnRevision(opts: { conArchivo: boolean }) {
    const cid = await ciudadId();
    const prof = await crearUsuario("PROFESIONAL", `prof.${Date.now()}.${Math.random()}@e.local`);
    const perfil = await prisma.perfilProfesional.create({
        data: {
            usuarioId: prof.id, nombreVisible: "P", tituloProfesional: "Psicología", especialidades: ["infantil"],
            ciudadId: cid, aniosExperiencia: 5, presentacion: "x", tarifaConsultaCOP: 100000, duracionMinutos: 45,
            atiendeVirtual: true, estado: "EN_REVISION",
            autorizacionArchivoId: opts.conArchivo ? "/archivos/a.pdf" : null,
            autorizacionSubidaEn: opts.conArchivo ? new Date() : null,
        },
    });
    await prisma.documentoProfesional.create({
        data: { perfilProfesionalId: perfil.id, requisitoClave: "tarjeta", archivoId: "a", extension: "pdf", sha256: "s" },
    });
    return { perfil, prof };
}

async function seedParam() {
    await prisma.parametroSistema.create({
        data: { clave: "verificacion.requisitos", valor: JSON.stringify(REQUISITOS), tipo: "JSON", categoria: "SYSTEM", esPublico: false, descripcion: "t" },
    });
}

const CHECKLIST_OK = { checklist: { tarjeta: { estado: "CUMPLE" as const, observacion: "" } } };

describe("SPEC-686 · A · aceptacionAntesDe devuelve solo la previa (anterioridad)", () => {
    beforeEach(async () => resetDatabase());
    afterAll(async () => prisma.$disconnect());

    it("con una aceptación antes y otra después de T, devuelve la de antes; nunca la posterior", async () => {
        const u = await crearUsuario("PROFESIONAL", `a.${Date.now()}@e.local`);
        const T = new Date();
        const previa = await prisma.aceptacionAutorizacionProfesional.create({
            data: { usuarioId: u.id, version: "v0.1", documentoHash: "h1", ip: "1.1.1.1", aceptadoEn: new Date(T.getTime() - 10 * MIN) },
        });
        const posterior = await prisma.aceptacionAutorizacionProfesional.create({
            data: { usuarioId: u.id, version: "v0.1", documentoHash: "h2", ip: "1.1.1.1", aceptadoEn: new Date(T.getTime() + 10 * MIN) },
        });
        const r = await new AutorizacionProfesionalService().aceptacionAntesDe(u.id, T);
        expect(r?.id, "devuelve la aceptación previa a T").toBe(previa.id);
        expect(r?.id, "NUNCA la posterior").not.toBe(posterior.id);
    });
});

describe("SPEC-686 · B · decidir exige y registra la autorización previa", () => {
    beforeEach(async () => {
        await resetDatabase();
        await seedParam();
        await sembrarCatalogoMotor();
    });
    afterAll(async () => prisma.$disconnect());

    it("sin autorización (ni aceptación ni archivo) → 409, no se crea verificación", async () => {
        const admin = await crearUsuario("ADMIN", `ad.${Date.now()}@e.local`);
        const { perfil } = await sembrarPerfilEnRevision({ conArchivo: false });
        await expect(
            decidir(perfil.id, { id: admin.id, email: admin.email }, CHECKLIST_OK),
        ).rejects.toMatchObject({ statusCode: 409 });
        expect(await prisma.verificacionProfesional.count()).toBe(0);
    });

    it("con aceptación PREVIA → aprueba y la fija en la verificación con aceptadoEn <= revisadoEn", async () => {
        const admin = await crearUsuario("ADMIN", `ad.${Date.now()}@e.local`);
        const { perfil, prof } = await sembrarPerfilEnRevision({ conArchivo: false });
        const aceptacion = await prisma.aceptacionAutorizacionProfesional.create({
            data: { usuarioId: prof.id, version: "v0.1", documentoHash: "h", ip: "1.1.1.1", aceptadoEn: new Date(Date.now() - 5 * MIN) },
        });
        const r = await decidir(perfil.id, { id: admin.id, email: admin.email }, CHECKLIST_OK);
        expect(r.resultado).toBe("APROBADO");
        const v = await prisma.verificacionProfesional.findUniqueOrThrow({ where: { id: r.verificacion.id } });
        expect(v.aceptacionAutorizacionId, "registra la aceptación que respaldó").toBe(aceptacion.id);
        expect(aceptacion.aceptadoEn.getTime(), "la aceptación es previa a la revisión").toBeLessThanOrEqual(
            v.revisadoEn.getTime(),
        );
    });
});

describe("SPEC-686 · C · aceptar guarda QUÉ texto exacto se aceptó (versión + SHA-256), no «aceptó»", () => {
    beforeEach(async () => {
        await resetDatabase();
        // Parámetros que apuntan al texto legal versionado real de public/legal/.
        await prisma.parametroSistema.createMany({
            data: [
                { clave: "autorizacion_profesional.version_actual", valor: "v0.1", tipo: "STRING", categoria: "LEGAL", esPublico: false, descripcion: "t" },
                { clave: "autorizacion_profesional.documento_ruta", valor: "public/legal/AUTORIZACION-PROFESIONAL-v0.1.md", tipo: "STRING", categoria: "LEGAL", esPublico: false, descripcion: "t" },
            ],
        });
    });
    afterAll(async () => prisma.$disconnect());

    it("registra versión, IP y el hash del TEXTO exacto (no en audit_consentimientos)", async () => {
        const u = await crearUsuario("PROFESIONAL", `c.${Date.now()}@e.local`);
        const { aceptacion, version } = await new AutorizacionProfesionalService().aceptar({
            usuarioId: u.id, ip: "9.9.9.9", userAgent: "test-agent",
        });
        const esperado = createHash("sha256")
            .update(await readFile("public/legal/AUTORIZACION-PROFESIONAL-v0.1.md", "utf-8"), "utf-8")
            .digest("hex");
        expect(version).toBe("v0.1");
        expect(aceptacion.documentoHash, "el hash es del texto exacto que se mostró").toBe(esperado);
        expect(aceptacion.ip).toBe("9.9.9.9");
        // Va en su propia tabla, NO en audit_consentimientos (el profesional no es titular).
        expect(await prisma.auditConsentimiento.count({ where: { usuarioId: u.id } })).toBe(0);
        expect(await prisma.aceptacionAutorizacionProfesional.count({ where: { usuarioId: u.id } })).toBe(1);
    });
});

describe("SPEC-686 · D · CHECK XOR: toda verificación con EXACTAMENTE una prueba de autorización", () => {
    beforeEach(async () => resetDatabase());
    afterAll(async () => prisma.$disconnect());

    async function base() {
        const cid = await ciudadId();
        const prof = await crearUsuario("PROFESIONAL", `d.${Date.now()}.${Math.random()}@e.local`);
        const admin = await crearUsuario("ADMIN", `da.${Date.now()}.${Math.random()}@e.local`);
        const perfil = await prisma.perfilProfesional.create({
            data: {
                usuarioId: prof.id, nombreVisible: "P", tituloProfesional: "T", especialidades: ["infantil"],
                ciudadId: cid, aniosExperiencia: 1, presentacion: "x", tarifaConsultaCOP: 1, duracionMinutos: 45,
                atiendeVirtual: true, estado: "ACTIVO",
            },
        });
        const aceptacion = await prisma.aceptacionAutorizacionProfesional.create({
            data: { usuarioId: prof.id, version: "v0.1", documentoHash: "h", ip: "1.1.1.1" },
        });
        return { perfil, admin, aceptacion };
    }
    const verif = (extra: Record<string, unknown>) => ({
        perfilProfesionalId: "", revisadoPorId: "", checklist: {}, resultado: "APROBADO" as const,
        venceEn: new Date(Date.now() + 86_400_000), ...extra,
    });

    it("ninguna vía (ambas null) → rechazado por el CHECK", async () => {
        const { perfil, admin } = await base();
        await expect(
            prisma.verificacionProfesional.create({
                data: verif({ perfilProfesionalId: perfil.id, revisadoPorId: admin.id, autorizacionArchivoId: null, aceptacionAutorizacionId: null }),
            }),
        ).rejects.toThrow();
    });

    it("las dos vías a la vez → rechazado por el CHECK", async () => {
        const { perfil, admin, aceptacion } = await base();
        await expect(
            prisma.verificacionProfesional.create({
                data: verif({ perfilProfesionalId: perfil.id, revisadoPorId: admin.id, autorizacionArchivoId: "/x.pdf", aceptacionAutorizacionId: aceptacion.id }),
            }),
        ).rejects.toThrow();
    });

    it("exactamente una (solo aceptación, o solo archivo) → permitido", async () => {
        const { perfil, admin, aceptacion } = await base();
        await expect(
            prisma.verificacionProfesional.create({
                data: verif({ perfilProfesionalId: perfil.id, revisadoPorId: admin.id, aceptacionAutorizacionId: aceptacion.id }),
            }),
        ).resolves.toBeTruthy();
        await expect(
            prisma.verificacionProfesional.create({
                data: verif({ perfilProfesionalId: perfil.id, revisadoPorId: admin.id, autorizacionArchivoId: "/x.pdf" }),
            }),
        ).resolves.toBeTruthy();
    });
});
