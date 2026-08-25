import type { Metadata } from "next";
import { revalidatePath } from "next/cache";
import { verifyAuth } from "@/lib/auth";
import { PagosClienteRepository } from "@/lib/dal/repositories/pagos-cliente-repository";
import { obtenerVistaSuscripcion, obtenerSuscripcionTitular } from "@/lib/pagos/suscripcion-vista.service";
import { solicitarPlan } from "@/lib/pagos/suscripcion-solicitud.service";
import { anioBogota } from "@/lib/pagos/renovacion-calculos";
import { obtenerTasaIva, ivaAplicaA } from "@/lib/pagos/parametros-pagos";
import { SuscripcionVista } from "@/components/modules/cliente/suscripcion/SuscripcionVista";
import { PlanesSelector } from "@/components/modules/pagos/PlanesSelector";
import { EsperandoAutorizacion } from "@/components/modules/pagos/EsperandoAutorizacion";
import type { PlanSelectorDTO } from "@/lib/pagos/planes-selector.types";

export const metadata: Metadata = {
    title: "Suscripción",
    description: "Gestiona la suscripción institucional de Protección Infantil.",
};

function planToSelectorDTO(plan: {
    id: string;
    nombre: string;
    descripcion: string | null;
    duracion: string;
    precioBaseCOP: number | null;
    precioBaseUSD: number;
    descuentoAnualPct: number | null;
    esFreemium: boolean;
    activo: boolean;
}): PlanSelectorDTO {
    return {
        id: plan.id,
        nombre: plan.nombre,
        descripcion: plan.descripcion,
        duracion: plan.duracion,
        precioBaseCOP: plan.precioBaseCOP ?? 0,
        precioBaseUSD: plan.precioBaseUSD,
        descuentoAnualPct: plan.descuentoAnualPct,
        esFreemium: plan.esFreemium,
        activo: plan.activo,
    };
}

async function actionSolicitarPlan(planId: string, codigoBono?: string) {
    "use server";

    const usuario = await verifyAuth("SCHOOL_ADMIN");
    if (!usuario.colegioId) {
        throw new Error("El usuario no está asociado a un colegio");
    }

    await solicitarPlan({
        usuario: {
            id: usuario.id,
            rol: usuario.rol,
            colegioId: usuario.colegioId,
            email: usuario.email,
            nombre: usuario.nombre,
        },
        planId,
        codigoBono,
        rolDueño: usuario.rol,
    });

    revalidatePath("/dashboard/colegio/suscripcion");
}

export default async function ColegioSuscripcionPage() {
    const usuario = await verifyAuth("SCHOOL_ADMIN");
    const suscripcion = await obtenerSuscripcionTitular({
        id: usuario.id,
        rol: usuario.rol,
        colegioId: usuario.colegioId,
    });

    if (suscripcion && (suscripcion.estado === "ACTIVA" || suscripcion.estado === "EN_GRACIA")) {
        const vista = await obtenerVistaSuscripcion({
            id: usuario.id,
            rol: usuario.rol,
            colegioId: usuario.colegioId,
        });
        if (vista) {
            return (
                <main className="min-h-screen bg-page py-4">
                    <SuscripcionVista vista={vista} color="pino" mostrarContrato={true} />
                </main>
            );
        }
    }

    if (suscripcion && suscripcion.estado === "PENDIENTE_AUTORIZACION") {
        return (
            <main className="min-h-screen bg-page py-4">
                <EsperandoAutorizacion
                    suscripcion={{
                        id: suscripcion.id,
                        estado: suscripcion.estado,
                        fechaInicio: suscripcion.fechaInicio.toISOString(),
                        fechaFin: suscripcion.fechaFin.toISOString(),
                        plan: { nombre: suscripcion.planActual.nombre },
                    }}
                />
            </main>
        );
    }

    const [planes, tasaIva, aplicaIva] = await Promise.all([
        new PagosClienteRepository().listarPlanesActivosPorTitular("COLEGIO", anioBogota()),
        obtenerTasaIva(),
        ivaAplicaA("COLEGIO"),
    ]);

    return (
        <main className="min-h-screen bg-page py-4">
            <PlanesSelector
                planes={planes.map(planToSelectorDTO)}
                usuario={{
                    id: usuario.id,
                    rol: "SCHOOL_ADMIN",
                    nombre: usuario.nombre,
                    email: usuario.email,
                }}
                color="pino"
                onSeleccionar={actionSolicitarPlan}
                tasaIva={tasaIva}
                aplicaIva={aplicaIva}
            />
        </main>
    );
}
