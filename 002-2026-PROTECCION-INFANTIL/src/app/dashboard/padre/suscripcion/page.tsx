import type { Metadata } from "next";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { verifyAuth } from "@/lib/auth";
import { PagosClienteRepository } from "@/lib/dal/repositories/pagos-cliente-repository";
import { obtenerVistaSuscripcion, obtenerSuscripcionTitular } from "@/lib/pagos/suscripcion-vista.service";
import { solicitarPlan } from "@/lib/pagos/suscripcion-solicitud.service";
import { activarFreemiumConRateLimit } from "@/lib/pagos/freemium-activacion.service";
import { anioBogota } from "@/lib/pagos/renovacion-calculos";
import { obtenerTasaIva, ivaAplicaA } from "@/lib/pagos/parametros-pagos";
import { SuscripcionVista } from "@/components/modules/cliente/suscripcion/SuscripcionVista";
import { PlanesSelector } from "@/components/modules/pagos/PlanesSelector";
import { EsperandoAutorizacion } from "@/components/modules/pagos/EsperandoAutorizacion";
import { obtenerCuponesRecompensaDelUsuario } from "@/lib/pagos/entregar-cupones-recompensa.service";
import type { PlanSelectorDTO } from "@/lib/pagos/planes-selector.types";

export const metadata: Metadata = {
    title: "Suscripción",
    description: "Gestiona tu suscripción de Protección Infantil.",
};

interface PageProps {
    searchParams: Promise<{ bienvenida?: string }>;
}

// SPEC-289 (002-PI-189 · Fase 1): idem colegio — el DTO conserva `precioBaseUSD`
// (candado §4 brief) pero lo cero-emitimos. La vista del cliente colombiano NO
// lee el precio USD.
function planToSelectorDTO(plan: {
    id: string;
    nombre: string;
    descripcion: string | null;
    duracion: string;
    precioBaseCOP: number | null;
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
        precioBaseUSD: 0,
        descuentoAnualPct: plan.descuentoAnualPct,
        esFreemium: plan.esFreemium,
        activo: plan.activo,
    };
}

async function actionSolicitarPlan(planId: string, codigoBono?: string) {
    "use server";

    const usuario = await verifyAuth("PARENT");
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

    revalidatePath("/dashboard/padre/suscripcion");
}

async function actionActivarFreemium() {
    "use server";

    const headersList = await headers();
    const ipAddress = headersList.get("x-forwarded-for") ?? headersList.get("x-real-ip") ?? "unknown";
    const userAgent = headersList.get("user-agent") ?? undefined;

    const usuario = await verifyAuth("PARENT");
    await activarFreemiumConRateLimit({
        usuario: {
            id: usuario.id,
            rol: usuario.rol,
            colegioId: usuario.colegioId,
            email: usuario.email,
            nombre: usuario.nombre,
        },
        aceptaTerminos: true,
        ipAddress,
        userAgent,
    });

    // SPEC-287 (I-141): la Server Action NO termina con redirect(<misma ruta>);
    // el POST-redirect-GET lo hace el navegador. revalidatePath re-renderiza
    // la página con el nuevo estado de vigencia (freemium ya ACTIVA).
    revalidatePath("/dashboard/padre/suscripcion");
}

export default async function PadreSuscripcionPage({ searchParams }: PageProps) {
    const params = await searchParams;
    const mostrarBienvenida = params.bienvenida === "1";
    const usuario = await verifyAuth("PARENT");
    const suscripcion = await obtenerSuscripcionTitular({
        id: usuario.id,
        rol: usuario.rol,
        colegioId: usuario.colegioId,
    });

    if (suscripcion && (suscripcion.estado === "ACTIVA" || suscripcion.estado === "EN_GRACIA")) {
        const [vista, cupones] = await Promise.all([
            obtenerVistaSuscripcion({
                id: usuario.id,
                rol: usuario.rol,
                colegioId: usuario.colegioId,
            }),
            obtenerCuponesRecompensaDelUsuario(usuario.id),
        ]);
        if (vista) {
            return (
                <main className="min-h-screen bg-page py-4">
                    <SuscripcionVista
                        vista={vista}
                        color="cielo"
                        mostrarContrato={false}
                        cupones={cupones}
                        mostrarBienvenida={mostrarBienvenida}
                    />
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
                    rol="PARENT"
                />
            </main>
        );
    }

    const [planes, tasaIva, aplicaIva] = await Promise.all([
        new PagosClienteRepository().listarPlanesActivosPorTitular("PADRE", anioBogota()),
        obtenerTasaIva(),
        ivaAplicaA("PADRE"),
    ]);

    return (
        <main className="min-h-screen bg-page py-4">
            <PlanesSelector
                planes={planes.map(planToSelectorDTO)}
                usuario={{
                    id: usuario.id,
                    rol: "PARENT",
                    nombre: usuario.nombre,
                    email: usuario.email,
                }}
                color="cielo"
                onSeleccionar={actionSolicitarPlan}
                onFreemium={actionActivarFreemium}
                tasaIva={tasaIva}
                aplicaIva={aplicaIva}
            />
        </main>
    );
}
