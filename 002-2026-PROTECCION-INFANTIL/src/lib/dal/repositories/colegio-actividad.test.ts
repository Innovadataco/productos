import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import {
    crearColegioConAdmin,
    crearCurso,
    crearEstudiante,
    crearIdentificadorEstudiante,
    crearProfesor,
    crearIdentificadorProfesor,
    crearPlataforma,
} from "@/lib/reporte-test-utils";
import { ColegioActividadRepository } from "./colegio-actividad";

async function crearReporte(
    plataformaId: string,
    data: {
        identificador?: string;
        tenantId?: string | null;
        estado?: "PENDIENTE" | "CLASIFICADO" | "REVISION_MANUAL" | "POSIBLE_SPAM" | "CORREGIDO";
        creadoEn?: Date;
    } = {}
) {
    return prisma.reporte.create({
        data: {
            identificador: data.identificador ?? `+57${Date.now()}${Math.floor(Math.random() * 1000)}`,
            plataformaId,
            texto: "reporte de prueba",
            fechaIncidente: new Date(),
            ciudad: "Bogotá",
            pais: "Colombia",
            estado: (data.estado as never) ?? "CLASIFICADO",
            esAnonimo: true,
            tenantId: data.tenantId ?? null,
            creadoEn: data.creadoEn ?? new Date(),
        },
    });
}

async function crearAlerta(
    colegioId: string,
    reporteId: string,
    estado: "nueva" | "vista" | "escalada" | "gestionada" | "cerrada" = "nueva"
) {
    return prisma.alertaColegio.create({
        data: {
            colegioId,
            reporteId,
            estado,
            prioridad: "media",
            vencimientoSla: new Date(Date.now() + 24 * 3600 * 1000),
        },
    });
}

function rangoUltimos(dias: number) {
    const hasta = new Date();
    const desde = new Date(hasta.getTime() - dias * 24 * 3600 * 1000);
    return { desde, hasta };
}

describe("ColegioActividadRepository.actividadDelColegio", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("US1 · reporta actividad real por 3 rutas dedupeando por Reporte.id", async () => {
        const { colegio, tenant } = await crearColegioConAdmin();
        const plataforma = await crearPlataforma("whatsapp");
        const curso = await crearCurso(colegio.id);
        const estudiante = await crearEstudiante(curso.id, colegio.id);
        const idEstudiante = await crearIdentificadorEstudiante(estudiante.id, {
            valor: "+573111111111",
            plataformaId: plataforma.id,
        });

        // Ruta A · reporte por tenantId (autor asociado)
        const rA = await crearReporte(plataforma.id, { tenantId: tenant.id });
        // Ruta B · reporte cuyo identificador coincide con el enrolado del estudiante
        const rB = await crearReporte(plataforma.id, { identificador: idEstudiante.valor });
        // Ruta C · reporte referenciado por AlertaColegio
        const rC = await crearReporte(plataforma.id);
        await crearAlerta(colegio.id, rC.id, "nueva");

        // Reporte doble ruta A+C (mismo reporte alcanzable por tenantId y alerta) → dedup a 1
        const rDoble = await crearReporte(plataforma.id, { tenantId: tenant.id });
        await crearAlerta(colegio.id, rDoble.id, "escalada");

        const repo = new ColegioActividadRepository();
        const actividad = await repo.actividadDelColegio(colegio.id, rangoUltimos(30));

        const ids = new Set(actividad.reportes.map((r) => r.id));
        expect(ids).toEqual(new Set([rA.id, rB.id, rC.id, rDoble.id]));
        expect(actividad.total).toBe(4);
        expect(actividad.casosAbiertos).toBe(2); // 2 alertas nueva/escalada
        expect(actividad.ultimaActividad).not.toBeNull();
    });

    it("US1 · colegio con SOLO ruta A (rector) suma sus reportes", async () => {
        const { colegio, tenant } = await crearColegioConAdmin();
        const plataforma = await crearPlataforma("whatsapp");
        const r = await crearReporte(plataforma.id, { tenantId: tenant.id });

        const actividad = await new ColegioActividadRepository().actividadDelColegio(
            colegio.id,
            rangoUltimos(30)
        );

        expect(actividad.total).toBe(1);
        expect(actividad.reportes[0]?.id).toBe(r.id);
        expect(actividad.casosAbiertos).toBe(0);
    });

    it("US1 · colegio aislado devuelve total=0 y ultimaActividad=null", async () => {
        const { colegio } = await crearColegioConAdmin();

        const actividad = await new ColegioActividadRepository().actividadDelColegio(
            colegio.id,
            rangoUltimos(30)
        );

        expect(actividad.total).toBe(0);
        expect(actividad.reportes).toEqual([]);
        expect(actividad.casosAbiertos).toBe(0);
        expect(actividad.ultimaActividad).toBeNull();
        expect(actividad.porEstado).toEqual({});
    });

    it("US1 · rango inválido (desde > hasta) lanza error", async () => {
        const { colegio } = await crearColegioConAdmin();
        const repo = new ColegioActividadRepository();
        await expect(
            repo.actividadDelColegio(colegio.id, {
                desde: new Date("2026-08-29"),
                hasta: new Date("2026-08-01"),
            })
        ).rejects.toThrow(/Rango inválido/);
    });

    it("US1 · colegio inexistente lanza error", async () => {
        const repo = new ColegioActividadRepository();
        await expect(
            repo.actividadDelColegio("colegio-que-no-existe", rangoUltimos(30))
        ).rejects.toThrow(/no encontrado/);
    });

    it("SC-010 · A/B multi-tenant: actividad de un colegio nunca aparece en la de otro", async () => {
        // Colegio A
        const { colegio: colegioA, tenant: tenantA } = await crearColegioConAdmin();
        const plataforma = await crearPlataforma("whatsapp");
        const rA = await crearReporte(plataforma.id, { tenantId: tenantA.id });
        await crearAlerta(colegioA.id, rA.id, "nueva");

        // Colegio B (aislado)
        const { colegio: colegioB, tenant: tenantB } = await crearColegioConAdmin();
        const rB = await crearReporte(plataforma.id, { tenantId: tenantB.id });
        const profB = await crearProfesor(colegioB.id);
        await crearIdentificadorProfesor(profB.id, colegioB.id, {
            valor: "+573222222222",
            plataformaId: plataforma.id,
        });
        const rB2 = await crearReporte(plataforma.id, { identificador: "+573222222222" });

        const repo = new ColegioActividadRepository();
        const actA = await repo.actividadDelColegio(colegioA.id, rangoUltimos(30));
        const actB = await repo.actividadDelColegio(colegioB.id, rangoUltimos(30));

        const idsA = new Set(actA.reportes.map((r) => r.id));
        const idsB = new Set(actB.reportes.map((r) => r.id));
        expect(idsA).toContain(rA.id);
        expect(idsA).not.toContain(rB.id);
        expect(idsA).not.toContain(rB2.id);
        expect(idsB).toContain(rB.id);
        expect(idsB).toContain(rB2.id);
        expect(idsB).not.toContain(rA.id);
    });

    it("US1 · porEstado agrupa correctamente", async () => {
        const { colegio, tenant } = await crearColegioConAdmin();
        const plataforma = await crearPlataforma("whatsapp");
        await crearReporte(plataforma.id, { tenantId: tenant.id, estado: "CLASIFICADO" });
        await crearReporte(plataforma.id, { tenantId: tenant.id, estado: "CLASIFICADO" });
        await crearReporte(plataforma.id, { tenantId: tenant.id, estado: "REVISION_MANUAL" });

        const actividad = await new ColegioActividadRepository().actividadDelColegio(
            colegio.id,
            rangoUltimos(30)
        );

        expect(actividad.total).toBe(3);
        expect(actividad.porEstado.CLASIFICADO).toBe(2);
        expect(actividad.porEstado.REVISION_MANUAL).toBe(1);
    });
});
