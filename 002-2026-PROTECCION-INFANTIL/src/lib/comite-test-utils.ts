import { prisma } from "./prisma";
import { hashPassword } from "./auth";
import { AlertaColegioRepository } from "./dal/repositories/alerta-colegio";
import { crearColegioConAdmin, crearPlataforma, crearCurso, crearEstudiante, crearIdentificadorEstudiante } from "./reporte-test-utils";

export { crearColegioConAdmin };

export async function crearComiteCuenta(colegioId: string, email?: string, password = "TestPass123") {
    const uniqueEmail = email || `comite-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
    return prisma.usuario.create({
        data: {
            email: uniqueEmail,
            nombre: "Comité de Convivencia",
            passwordHash: await hashPassword(password),
            rol: "COMITE_CONVIVENCIA",
            estado: "activo",
            comiteColegioId: colegioId,
        },
    });
}

export async function crearAlertaEstudiante(colegioId: string) {
    const plataforma = await crearPlataforma();
    const curso = await crearCurso(colegioId, { nombre: "10A", grado: "10" });
    const estudiante = await crearEstudiante(curso.id, colegioId, { nombre: "Estudiante", apellidos: "Test" });
    const identificador = await crearIdentificadorEstudiante(estudiante.id, {
        tipo: "telefono",
        valor: `+57${Date.now()}`,
        plataformaId: plataforma.id,
    });

    const reporte = await prisma.reporte.create({
        data: {
            identificador: identificador.valor,
            plataformaId: plataforma.id,
            texto: "Reporte de prueba para el comité de convivencia",
            fechaIncidente: new Date(),
            ciudad: "Bogotá",
            pais: "Colombia",
            estado: "CLASIFICADO",
        },
    });

    const alerta = await new AlertaColegioRepository().crear({
        colegioId,
        reporteId: reporte.id,
        tipoSujeto: "ESTUDIANTE",
        identificadorEstudianteId: identificador.id,
    });

    return { alerta, reporte, identificador, estudiante, curso, plataforma };
}
