/**
 * CANDADO · SPEC-818 (una definición, una fuente) · el chip del directorio (`tieneHorariosDisponibles` del
 * DTO) es TRUE ⟺ la consulta del padre (`listarLibresDeProfesional`) devuelve ≥1. El chip NO reimplementa el
 * criterio de «ofrecible»: pregunta lo mismo (comparten `whereFranjaOfrecible`). Si divergieran, el chip
 * diría «tiene horarios» mientras la pantalla de reserva muestra NADA — el defecto de 818 por otra puerta.
 * Control: apagar la modalidad mueve AMBOS a la vez; un profesional SIN horarios SIGUE en el directorio.
 * Integración (BD).
 *
 * SPEC-852 (eliminación de REPS) · «ofrecible» vuelve a ser SOLO las banderas (`whereFranjaOfrecible`) + la
 * vigencia interna al nivel del perfil; se retiró el eje REPS-por-modalidad que SPEC-825 había agregado. Las
 * invariantes de 818 —flag-off OCULTA · la fila PERSISTE · re-encender DEVUELVE · chip ⟺ consulta— quedan
 * intactas.
 */
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearPaisCiudad } from "@/lib/reporte-test-utils";
import { PerfilProfesionalRepository } from "@/lib/dal/repositories/perfil-profesional";
import { FranjaDisponibleRepository } from "@/lib/dal/repositories/franja-disponible";

let n = 0;
async function profesionalOfrecible(ciudadId: string): Promise<string> {
    const sufijo = `${Date.now()}.${n++}`;
    const u = await crearUsuario("PROFESIONAL", `pro.818chip.${sufijo}@ejemplo.local`);
    const perfil = await prisma.perfilProfesional.create({
        data: {
            usuarioId: u.id, nombreVisible: "Dra. Chip", tituloProfesional: "Psicología", especialidades: ["Ansiedad"],
            ciudadId, atiendeVirtual: true, atiendePresencial: true, aniosExperiencia: 5, presentacion: "x",
            tarifaConsultaCOP: 120000, duracionMinutos: 45, estado: "ACTIVO",
        },
    });
    const revisor = await crearUsuario("ADMIN", `adm.818chip.${sufijo}@ejemplo.local`);
    await prisma.verificacionProfesional.create({
        data: {
            perfilProfesionalId: perfil.id, revisadoPorId: revisor.id, revisadoEn: new Date(Date.now() - 86_400_000),
            checklist: {}, resultado: "APROBADO", autorizacionArchivoId: "x", venceEn: new Date(Date.now() + 90 * 86_400_000),
        },
    });
    return perfil.id;
}
async function crearFranja(profesionalId: string, modalidad: "VIRTUAL" | "PRESENCIAL") {
    const inicio = new Date(Date.now() + 7 * 86_400_000);
    await prisma.franjaDisponible.create({
        data: { profesionalId, inicio, fin: new Date(inicio.getTime() + 45 * 60_000), modalidad, tomada: false },
    });
}
describe("SPEC-818 · el chip de disponibilidad sale de la MISMA fuente que la consulta del padre", () => {
    beforeEach(async () => resetDatabase());
    afterAll(async () => prisma.$disconnect());

    it("chip ⟺ consulta: apagar la modalidad mueve AMBOS a la vez; re-encender los devuelve", async () => {
        const { ciudad } = await crearPaisCiudad();
        const profesionalId = await profesionalOfrecible(ciudad.id);
        await crearFranja(profesionalId, "VIRTUAL");
        const perfilRepo = new PerfilProfesionalRepository();
        const franjaRepo = new FranjaDisponibleRepository();
        const ahora = new Date();

        // Encendido: chip TRUE y consulta ≥1.
        expect((await perfilRepo.obtenerPublicoPorId(profesionalId, null))!.tieneHorariosDisponibles).toBe(true);
        expect((await franjaRepo.listarLibresDeProfesional(profesionalId, ahora)).length).toBeGreaterThan(0);

        // Apagado: chip FALSE y consulta 0 — JUNTOS (una fuente, no dos criterios).
        await prisma.perfilProfesional.update({ where: { id: profesionalId }, data: { atiendeVirtual: false } });
        expect((await perfilRepo.obtenerPublicoPorId(profesionalId, null))!.tieneHorariosDisponibles).toBe(false);
        expect((await franjaRepo.listarLibresDeProfesional(profesionalId, ahora)).length).toBe(0);

        // Re-encendido: ambos vuelven a true.
        await prisma.perfilProfesional.update({ where: { id: profesionalId }, data: { atiendeVirtual: true } });
        expect((await perfilRepo.obtenerPublicoPorId(profesionalId, null))!.tieneHorariosDisponibles).toBe(true);
    });

    it("sin franja ofrecible, el chip es FALSE pero el profesional SIGUE en el directorio (no se esconde)", async () => {
        const { ciudad } = await crearPaisCiudad();
        const conFranja = await profesionalOfrecible(ciudad.id);
        await crearFranja(conFranja, "VIRTUAL");
        const sinFranja = await profesionalOfrecible(ciudad.id); // ofrecible, pero sin publicar franjas

        const lista = await new PerfilProfesionalRepository().listarActivos({}, null);
        const porId = new Map(lista.map((p) => [p.id, p]));
        // AMBOS están en el directorio (el que no tiene horarios NO se esconde)...
        expect(porId.has(conFranja), "el que tiene horarios está").toBe(true);
        expect(porId.has(sinFranja), "el que NO tiene horarios TAMBIÉN está (no se esconde)").toBe(true);
        // ...y el chip distingue, por lote (idsConHorariosDisponibles), con la misma definición.
        expect(porId.get(conFranja)!.tieneHorariosDisponibles).toBe(true);
        expect(porId.get(sinFranja)!.tieneHorariosDisponibles).toBe(false);
    });
});
