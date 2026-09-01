/**
 * SPEC-344 (A-69 · C1) — Paso 2 · Plan del colegio.
 *
 * Reusa `PlanesSelector` con las server actions equivalentes a las del padre.
 * Puente D2 (R6, matiz CEO 03:18): activar freemium o solicitar plan escribe
 * `Colegio.finServicio` con la ventana correspondiente — un colegio nuevo
 * deja de quedar "gratis para siempre" al cerrar el Paso 2.
 *
 * Voz: usted formal Colombia (brief §0).
 */
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { verifyAuth } from "@/lib/auth";
import { derivarPasoPendienteColegio } from "@/lib/dal/services/camino/estado-colegio";
import { PagosClienteRepository } from "@/lib/dal/repositories/pagos-cliente-repository";
import { solicitarPlan } from "@/lib/pagos/suscripcion-solicitud.service";
import {
    activarFreemiumColegio,
} from "@/lib/pagos/freemium-activacion.service";
import { actualizarFinServicioDesdePlan } from "@/lib/pagos/vigencia-colegio.service";
import { sellarCookieSesionEstadoEnAccion } from "@/lib/routing/sellar-sesion-estado";
import { PagosRepository } from "@/lib/dal/repositories/pagos-repository";
import { anioBogota } from "@/lib/pagos/renovacion-calculos";
import { obtenerTasaIva, ivaAplicaA } from "@/lib/pagos/parametros-pagos";
import { PlanesSelector } from "@/components/modules/pagos/PlanesSelector";
import {
    DESTINO_CIERRE_COLEGIO,
    destinoDePasoColegio,
} from "@/lib/camino/pasos-colegio";
import type { PlanSelectorDTO } from "@/lib/pagos/planes-selector.types";

async function actionSolicitarPlanColegio(planId: string, codigoBono?: string) {
    "use server";
    const usuario = await verifyAuth("SCHOOL_ADMIN");
    if (!usuario.colegioId) throw new Error("Rector sin colegio asociado");
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
    // Puente D2 · R6.
    const plan = await new PagosRepository().obtenerPlanPorId(planId);
    if (plan && !plan.esFreemium) {
        await actualizarFinServicioDesdePlan(usuario.colegioId, {
            tipo: "pagado",
            duracion: plan.duracion,
        });
    }
    await sellarCookieSesionEstadoEnAccion(usuario.id);
    revalidatePath("/camino/colegio/plan");
}

async function actionActivarFreemiumColegio() {
    "use server";
    const headersList = await headers();
    const ipAddress = headersList.get("x-forwarded-for") ?? headersList.get("x-real-ip") ?? "unknown";
    const userAgent = headersList.get("user-agent") ?? undefined;
    const usuario = await verifyAuth("SCHOOL_ADMIN");
    if (!usuario.colegioId) throw new Error("Rector sin colegio asociado");
    await activarFreemiumColegio({
        usuarioId: usuario.id,
        colegioId: usuario.colegioId,
        email: usuario.email,
        nombre: usuario.nombre,
        aceptaTerminos: true,
        ipAddress,
        userAgent,
    });
    // Puente D2 · R6.
    await actualizarFinServicioDesdePlan(usuario.colegioId, { tipo: "freemium" });
    // Sella la cookie: el Paso 2 cierra al instante y el rector pasa al Paso 3.
    await sellarCookieSesionEstadoEnAccion(usuario.id);
    revalidatePath("/camino/colegio/plan");
}

export const dynamic = "force-dynamic";

export default async function CaminoColegioPlanPage() {
    const usuario = await verifyAuth("SCHOOL_ADMIN");

    // Doble valla: derivación autoritativa además del guardián.
    const paso = await derivarPasoPendienteColegio(usuario.id);
    if (paso === null) redirect(DESTINO_CIERRE_COLEGIO);
    if (paso !== "plan") redirect(destinoDePasoColegio(paso));

    const [planes, tasaIva, aplicaIva] = await Promise.all([
        new PagosClienteRepository().listarPlanesActivosPorTitular("COLEGIO", anioBogota()),
        obtenerTasaIva(),
        ivaAplicaA("COLEGIO"),
    ]);

    const dtos: PlanSelectorDTO[] = planes.map((plan) => ({
        id: plan.id,
        nombre: plan.nombre,
        descripcion: plan.descripcion,
        duracion: plan.duracion,
        precioBaseCOP: plan.precioBaseCOP ?? 0,
        precioBaseUSD: 0,
        descuentoAnualPct: plan.descuentoAnualPct,
        esFreemium: plan.esFreemium,
        activo: plan.activo,
    }));

    return (
        <div className="animate-fadeIn">
            <h1 className="font-serif text-2xl text-body">Elija cómo empezar</h1>
            <p className="mb-5 mt-1 text-sm text-muted">
                Puede empezar sin costo y cambiar cuando quiera.
            </p>
            <PlanesSelector
                planes={dtos}
                usuario={{ id: usuario.id, rol: "SCHOOL_ADMIN", nombre: usuario.nombre, email: usuario.email }}
                color="pino"
                onSeleccionar={actionSolicitarPlanColegio}
                onFreemium={actionActivarFreemiumColegio}
                tasaIva={tasaIva}
                aplicaIva={aplicaIva}
            />
        </div>
    );
}
