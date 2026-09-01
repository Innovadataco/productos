/**
 * SPEC-350 (T011+T040) · el cargador de hechos del caso — blindaje PII y
 * agregados en hora Bogotá.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { cargarCasoConHechos } from "./hechos-caso";
import { armarPayload } from "../expediente/analisis/armar-payload";
import { resetDatabase } from "@/lib/test-utils";
import {
    crearColegioConAdmin,
    crearPlataforma,
    crearCurso,
    crearEstudiante,
    crearIdentificadorEstudiante,
} from "@/lib/reporte-test-utils";
import { prisma } from "@/lib/prisma";

const TEXTO_SENSIBLE = "texto sensible del denunciante que JAMAS debe viajar";
const EMAIL_DENUNCIANTE = "denunciante-secreto@example.com";

async function seedCaso() {
    const { colegio } = await crearColegioConAdmin();
    const plataforma = await crearPlataforma("roblox", "Roblox", "juego");
    const curso = await crearCurso(colegio.id, { nombre: "9°-A", grado: "9" });
    const estudiante = await crearEstudiante(curso.id, colegio.id, { nombre: "María Fernanda", apellidos: "Pérez" });
    const identificador = await crearIdentificadorEstudiante(estudiante.id, {
        tipo: "usuario",
        valor: `nick-blindaje-${Date.now()}`,
        plataformaId: plataforma.id,
    });

    const denunciante = await prisma.usuario.create({
        data: {
            email: EMAIL_DENUNCIANTE,
            nombre: "Denunciante Secreto",
            passwordHash: "x",
            rol: "PARENT",
            estado: "activo",
        },
    });

    // Reporte NOCTURNO Bogotá: 21:15 COT = 02:15 UTC del día siguiente.
    const reporte = await prisma.reporte.create({
        data: {
            identificador: identificador.valor,
            plataformaId: plataforma.id,
            texto: TEXTO_SENSIBLE,
            fechaIncidente: new Date("2026-08-31T02:15:00.000Z"),
            ciudad: "Bogotá",
            pais: "CO",
            estado: "CLASIFICADO",
            esAnonimo: false,
            usuarioId: denunciante.id,
        },
    });
    await prisma.clasificacionIA.create({
        data: { reporteId: reporte.id, categoria: "CIBERACOSO", confianza: 0.9, modeloUsado: "t", latenciaMs: 5 },
    });

    const alerta = await prisma.alertaColegio.create({
        data: {
            colegioId: colegio.id,
            reporteId: reporte.id,
            tipoSujeto: "ESTUDIANTE",
            identificadorEstudianteId: identificador.id,
            estado: "escalada",
            prioridad: "alta",
            vencimientoSla: new Date(Date.now() + 48 * 3600 * 1000),
        },
    });
    const caso = await prisma.seguimientoCaso.create({ data: { colegioId: colegio.id, alertaId: alerta.id } });
    return { caso, identificador };
}

describe("cargarCasoConHechos (SPEC-350)", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("hechos con fecha/lugar/clasificación — CERO texto, CERO identidad del denunciante", async () => {
        const { caso } = await seedCaso();
        const datos = await cargarCasoConHechos(caso.id);
        expect(datos).not.toBeNull();
        expect(datos!.hechos).toHaveLength(1);
        expect(datos!.hechos[0].categoria).toBe("CIBERACOSO");
        expect(datos!.hechos[0].plataforma).toBe("roblox");

        const s = JSON.stringify(datos);
        expect(s, "el texto del reporte no puede viajar").not.toContain(TEXTO_SENSIBLE);
        expect(s, "el email del denunciante no puede viajar").not.toContain(EMAIL_DENUNCIANTE);
        expect(s, "el nombre del denunciante no puede viajar").not.toContain("Denunciante Secreto");
    });

    it("los agregados usan HORA BOGOTÁ: 21:15 COT (02:15 UTC) cae en franja 18-24, no 0-6", async () => {
        const { caso } = await seedCaso();
        const datos = await cargarCasoConHechos(caso.id);
        expect(datos!.agregados).toHaveLength(1);
        expect(datos!.agregados[0].franjaHoraria, "el hecho es NOCTURNO en Bogotá").toBe("18-24");
        expect(datos!.agregados[0].curso).toBe("9°-A");
        expect(datos!.agregados[0].categoria).toBe("CIBERACOSO");
    });

    it("el payload BLINDADO al modelo desde los agregados del caso no filtra nada (SC-002)", async () => {
        const { caso, identificador } = await seedCaso();
        const datos = await cargarCasoConHechos(caso.id);
        const payload = armarPayload({ alcance: "COLEGIO_BLINDADO", agregados: datos!.agregados });
        const s = JSON.stringify(payload);
        expect(s).not.toContain(TEXTO_SENSIBLE);
        expect(s).not.toContain(EMAIL_DENUNCIANTE);
        expect(s).not.toContain(identificador.valor);
        expect(s).not.toContain("María Fernanda");
        expect(s).toContain("COLEGIO_BLINDADO");
    });

    it("caso inexistente → null", async () => {
        expect(await cargarCasoConHechos("no-existe")).toBeNull();
    });
});
