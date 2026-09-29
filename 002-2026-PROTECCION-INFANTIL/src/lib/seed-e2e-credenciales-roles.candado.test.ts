/**
 * CANDADO del restablecimiento de credenciales e2e (colegio/operador/comité) — el arreglo del 401.
 *
 * Prueba, contra la BD, lo que corre el CEO en prod: las 3 cuentas quedan CON LOGIN POSIBLE
 * (existe + rol correcto + estado activo + `verifyPassword(clave_entorno, hash)` = true → no 401),
 * en la corrida PERSISTENTE, idempotente (2ª corrida no duplica ni re-hashea), y con las guardas de
 * entorno (falta variable / cuenta intocable) que abortan sin escribir.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { DuracionPlan, TipoTitular } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { verifyPassword } from "@/lib/auth";
import { crearUsuario } from "@/lib/reporte-test-utils";
import { ConsentimientoService } from "@/lib/dal/services/consentimiento";
import { crearParametrosConsentimiento } from "@/lib/consentimiento-test-utils";
import { anioBogota } from "@/lib/pagos/renovacion-calculos";
import { derivarPasoPendienteColegio } from "@/lib/dal/services/camino/estado-colegio";
import { buildSesionEstadoValue } from "@/lib/routing/sesion-estado-emitter";
import { leerSesionEstado } from "@/lib/routing/vigencia-cookie";
import { EMAIL_INTOCABLE } from "../../scripts/lib/credenciales-e2e-calidad";
import {
    sembrarCredencialesRoles,
    completarSuscripcionColegio,
    leerCredencialesRoles,
    CORRIDA_CUENTAS_CALIDAD,
    type CredencialRol,
} from "../../scripts/seed-e2e-credenciales-roles";

const CREDS: CredencialRol[] = [
    { clave: "COLEGIO", rol: "SCHOOL_ADMIN", nombre: "Colegio Calidad (E2E · login)", requiereColegio: true, email: "calidad+e2ecolegio@innovadataco.com", secreto: "ClaveColegio2026!" },
    { clave: "OPERADOR", rol: "OPERADOR", nombre: "Operador Calidad (E2E)", requiereColegio: false, email: "calidad+e2eoperador@innovadataco.com", secreto: "ClaveOperador2026!" },
    { clave: "COMITE_VALIDACION", rol: "COMITE_VALIDACION", nombre: "Comité-Validación Calidad (E2E)", requiereColegio: false, email: "calidad+e2ecomite@innovadataco.com", secreto: "ClaveComite2026!" },
];

async function sembrarBase(): Promise<{ paisId: string; ciudadId: string }> {
    const pais = await prisma.pais.upsert({ where: { codigo: "CO" }, update: {}, create: { codigo: "CO", nombre: "Colombia" } });
    let bogota = await prisma.ciudad.findFirst({ where: { nombre: "Bogotá", paisId: pais.id }, select: { id: true } });
    bogota ??= await prisma.ciudad.create({ data: { nombre: "Bogotá", nombreNormalizado: "bogota", paisId: pais.id }, select: { id: true } });
    return { paisId: pais.id, ciudadId: bogota.id };
}

/** Plan básico MES_1 del colegio: crearSuscripcionCliente lo exige (planActualId). */
async function crearPlanBasicoColegio(): Promise<void> {
    const admin = await crearUsuario("ADMIN", `admin-plan-${Date.now()}@test.local`);
    await prisma.plan.upsert({
        where: { tipoTitular_duracion_anio: { tipoTitular: TipoTitular.COLEGIO, duracion: DuracionPlan.MES_1, anio: anioBogota() } },
        update: { activo: true },
        create: {
            nombre: `Plan Colegio E2E ${Date.now()}`,
            tipoTitular: TipoTitular.COLEGIO,
            duracion: DuracionPlan.MES_1,
            anio: anioBogota(),
            precioBaseUSD: 10,
            precio: 0,
            activo: true,
            creadoPorAdminId: admin.id,
        },
    });
}

/**
 * Corre el sembrado COMPLETO como en producción: la tx (login + consentimiento +
 * campos del rector + entidades del camino 3/4/5) y DESPUÉS la suscripción (paso 2,
 * fuera de la tx porque el servicio no es tx-aware).
 */
async function correr(base: { paisId: string; ciudadId: string }) {
    const r = await prisma.$transaction((tx) => sembrarCredencialesRoles(tx, CREDS, base));
    for (const x of r.resultados) if (x.colegioId) await completarSuscripcionColegio(x.colegioId);
    return r;
}

describe("credenciales e2e de roles (colegio/operador/comité) · arreglo del 401", () => {
    let base: { paisId: string; ciudadId: string };
    beforeEach(async () => {
        await resetDatabase();
        base = await sembrarBase();
        // SPEC-757: la siembra ahora asienta el consentimiento del titular, que lee
        // versión + ruta del documento de ParametroSistema (existen en prod).
        await crearParametrosConsentimiento();
        // SPEC-761: el paso 2 (suscripción) usa crearSuscripcionCliente, que exige
        // el plan básico MES_1 del colegio (existe en prod).
        await crearPlanBasicoColegio();
    });

    it("las 3 cuentas quedan con LOGIN POSIBLE (rol + activo + clave del entorno verifica)", async () => {
        await correr(base);
        for (const cred of CREDS) {
            const u = await prisma.usuario.findUniqueOrThrow({
                where: { email: cred.email },
                select: { rol: true, estado: true, estadoActivacion: true, passwordHash: true, tenantId: true, colegioId: true },
            });
            expect(u.rol).toBe(cred.rol);
            expect(u.estado, "estado inactivo → login 401").toBe("activo");
            expect(u.estadoActivacion).toBe("ACTIVO");
            expect(await verifyPassword(cred.secreto, u.passwordHash), "la clave del entorno DEBE verificar (si no, 401)").toBe(true);
            if (cred.requiereColegio) {
                expect(u.tenantId, "SCHOOL_ADMIN necesita tenant").not.toBeNull();
                expect(u.colegioId, "SCHOOL_ADMIN necesita colegio").not.toBeNull();
            }
        }
    });

    it("IDEMPOTENTE: la 2ª corrida no duplica cuenta/colegio y no re-hashea (clave ya OK)", async () => {
        await correr(base);
        const { resultados } = await correr(base);
        for (const r of resultados) {
            expect(r.creado, `${r.rol} no se re-crea`).toBe(false);
            expect(r.rehashClave, `${r.rol} no re-hashea la clave en la 2ª corrida`).toBe(false);
        }
        for (const cred of CREDS) {
            expect(await prisma.usuario.count({ where: { email: cred.email } })).toBe(1);
        }
        expect(await prisma.colegio.count({ where: { tenant: { nombre: "e2e-calidad-colegio-login" } } }), "el colegio de login no se duplica").toBe(1);
    });

    it("cuentas marcadas en la corrida PERSISTENTE (no la purgable)", async () => {
        const { resultados } = await correr(base);
        for (const r of resultados) {
            const marca = await prisma.demoMarcado.findFirst({ where: { entidad: "Usuario", entidadId: r.usuarioId } });
            expect((marca?.metadata as { corrida?: string } | null)?.corrida).toBe(CORRIDA_CUENTAS_CALIDAD);
        }
    });

    it("GUARDAS de entorno: falta variable → aborta; cuenta intocable → aborta (sin escribir)", () => {
        expect(() => leerCredencialesRoles({}), "falta variable").toThrow(/Faltan variables/);
        const envIntocable = {
            E2E_COLEGIO_EMAIL: EMAIL_INTOCABLE,
            E2E_COLEGIO_PASSWORD: "x",
            E2E_OPERADOR_EMAIL: "a@ejemplo.local",
            E2E_OPERADOR_PASSWORD: "x",
            E2E_COMITE_VALIDACION_EMAIL: "c@ejemplo.local",
            E2E_COMITE_VALIDACION_PASSWORD: "x",
        };
        expect(() => leerCredencialesRoles(envIntocable), "cuenta intocable").toThrow(/intocable/i);
    });

    // SPEC-757 · el fixture asienta el consentimiento del TITULAR de prueba para
    // que cruce la puerta (SPEC-756) como una cuenta real, sin fabricar firmas
    // internas (SPEC-755). Control positivo en las dos direcciones.
    const COLEGIO = CREDS[0].email; // SCHOOL_ADMIN (titular)
    const OPERADOR = CREDS[1].email;
    const COMITE = CREDS[2].email;

    it("SPEC-757: el SCHOOL_ADMIN (titular) queda con firma CONVENIO_INSTITUCIONAL DERIVADA y cruza la puerta", async () => {
        await correr(base);
        const svc = new ConsentimientoService();
        const version = await svc.versionVigente();
        const sa = await prisma.usuario.findUniqueOrThrow({ where: { email: COLEGIO }, select: { id: true, consentimientoVersion: true } });

        const audits = await prisma.auditConsentimiento.findMany({ where: { usuarioId: sa.id } });
        expect(audits).toHaveLength(1);
        // documentoTipo DERIVADO del rol (no quemado): igual a lo que dice el servicio.
        expect(audits[0].documentoTipo).toBe("CONVENIO_INSTITUCIONAL");
        expect(audits[0].documentoTipo).toBe(svc.documentoPorRol("SCHOOL_ADMIN"));
        expect(audits[0].version).toBe(version);
        expect(audits[0].esRepresentanteLegal).toBe(true);
        // el campo que la compuerta LEE + la propia compuerta.
        expect(sa.consentimientoVersion).toBe(version);
        expect(await svc.versionEstaActual(sa.id)).toBe(true);
    });

    it("SPEC-757: OPERADOR y COMITE_VALIDACION (no titulares) NO reciben firma", async () => {
        await correr(base);
        for (const email of [OPERADOR, COMITE]) {
            const u = await prisma.usuario.findUniqueOrThrow({ where: { email }, select: { id: true, consentimientoVersion: true } });
            expect(await prisma.auditConsentimiento.count({ where: { usuarioId: u.id } }), `${email} no debe tener firma`).toBe(0);
            expect(u.consentimientoVersion, `${email} no debe quedar con versión de consentimiento`).toBeNull();
        }
    });

    it("SPEC-757: IDEMPOTENTE — la 2ª corrida no duplica la firma del titular ni siembra nuevas", async () => {
        await correr(base);
        const segunda = await correr(base);
        const sa = await prisma.usuario.findUniqueOrThrow({ where: { email: COLEGIO }, select: { id: true } });
        expect(await prisma.auditConsentimiento.count({ where: { usuarioId: sa.id } })).toBe(1);
        expect(segunda.consentimientosSembrados, "la 2ª corrida no siembra firmas nuevas").toEqual([]);
    });

    it("SPEC-757: la 1ª corrida reporta el SCHOOL_ADMIN como firma sembrada y NO dispara notificaciones", async () => {
        const { notifAntes, notifDespues, consentimientosSembrados } = await correr(base);
        expect(consentimientosSembrados).toEqual(["SCHOOL_ADMIN"]);
        expect(notifDespues, "sembrar el consentimiento NO encola avisos").toBe(notifAntes);
        expect(await prisma.notificacion.count()).toBe(0);
    });

    // SPEC-761 · el fixture completa el CAMINO del colegio para que el SCHOOL_ADMIN
    // ALCANCE /dashboard/colegio (no solo "tenga los campos"). Control positivo en
    // dos capas: el hecho (derivarPasoPendienteColegio) y el valor que consume el
    // guardián (la cookie que emite buildSesionEstadoValue).
    it("SPEC-761: tras sembrar, el camino del colegio está COMPLETO (los 5 pasos)", async () => {
        await correr(base);
        const sa = await prisma.usuario.findUniqueOrThrow({
            where: { email: COLEGIO },
            select: { id: true, colegioId: true, nombre: true, apellidos: true, documentoTipo: true, documentoNumero: true, telefono: true },
        });
        const colegioId = sa.colegioId!;
        // Paso 1 · campos del rector EN Usuario (no en Colegio.representanteLegal*).
        for (const campo of ["nombre", "apellidos", "documentoTipo", "documentoNumero", "telefono"] as const) {
            expect(sa[campo], `rector.${campo} vacío`).toBeTruthy();
        }
        // Pasos 2..5 · filas requeridas.
        expect(await prisma.suscripcion.count({ where: { colegioId } }), "paso 2 · suscripción").toBeGreaterThan(0);
        expect(await prisma.profesor.count({ where: { colegioId, estado: "activo" } }), "paso 3 · profesor activo").toBeGreaterThan(0);
        expect(await prisma.curso.count({ where: { colegioId, estado: "activo" } }), "paso 4 · curso activo").toBeGreaterThan(0);
        expect(await prisma.estudiante.count({ where: { colegioId, estado: "activo" } }), "paso 5 · estudiante activo").toBeGreaterThan(0);
    });

    it("SPEC-761: el estudiante sembrado tiene acudiente (alta con acudiente)", async () => {
        await correr(base);
        const est = await prisma.estudiante.findFirstOrThrow({ where: { documentoNumero: "E2E-EST-000" }, select: { id: true } });
        expect(await prisma.acudienteEstudiante.count({ where: { estudianteId: est.id } })).toBeGreaterThan(0);
    });

    it("SPEC-761: la cuenta ALCANZA /dashboard/colegio — derivarPaso null Y el guardián deja pasar (cookie)", async () => {
        await correr(base);
        const sa = await prisma.usuario.findUniqueOrThrow({ where: { email: COLEGIO }, select: { id: true } });
        // Capa 1 · el hecho que deriva el estado.
        expect(await derivarPasoPendienteColegio(sa.id), "camino completo").toBeNull();
        // Capa 2 · el valor que el guardián LEE en la cookie de estado.
        const payload = await leerSesionEstado(await buildSesionEstadoValue(sa.id), process.env.JWT_SECRET!);
        expect(payload, "cookie válida").not.toBeNull();
        expect(payload!.pasoCamino, "sin paso pendiente del camino").toBeNull();
        expect(payload!.requiereConsentimiento, "consentimiento vigente").toBe(false);
        // La vigencia también deja pasar (no hay 4ª puerta): colegio activo, sin finServicio vencido.
        expect(payload!.vigencia, "vigencia activa").toBe("ACTIVA");
    });

    it("SPEC-761: IDEMPOTENTE — la 2ª corrida no duplica profesor/estudiante/suscripción/cursos", async () => {
        await correr(base);
        await correr(base);
        const sa = await prisma.usuario.findUniqueOrThrow({ where: { email: COLEGIO }, select: { colegioId: true } });
        const colegioId = sa.colegioId!;
        expect(await prisma.profesor.count({ where: { colegioId } }), "profesor no se duplica").toBe(1);
        expect(await prisma.estudiante.count({ where: { colegioId } }), "estudiante no se duplica").toBe(1);
        expect(await prisma.suscripcion.count({ where: { colegioId } }), "suscripción no se duplica").toBe(1);
        expect(await prisma.curso.count({ where: { colegioId } }), "cursos no se duplican (11 grados)").toBe(11);
    });

    it("SPEC-761: OPERADOR y COMITE (sin colegio) no reciben nada del camino", async () => {
        await correr(base);
        for (const email of [OPERADOR, COMITE]) {
            const u = await prisma.usuario.findUniqueOrThrow({ where: { email }, select: { colegioId: true } });
            expect(u.colegioId, `${email} no tiene colegio`).toBeNull();
        }
        // ningún estudiante/profesor fuera del colegio de login.
        const sa = await prisma.usuario.findUniqueOrThrow({ where: { email: COLEGIO }, select: { colegioId: true } });
        expect(await prisma.estudiante.count({ where: { colegioId: { not: sa.colegioId! } } })).toBe(0);
    });
});
