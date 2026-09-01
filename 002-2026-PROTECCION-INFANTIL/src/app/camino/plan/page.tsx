/**
 * SPEC-339 (A-67 §2.5) — Paso 4 de 4: tu plan.
 *
 * Reusa el selector de planes de la página de suscripción con sus MISMAS
 * acciones de servidor (solicitar plan · activar prueba gratis · bono). La
 * prueba gratis ya re-sella la cookie de estado (SPEC-337) y con SPEC-339 ese
 * sellado incluye el paso del camino: los módulos abren al instante.
 *
 * Si el padre ya tiene CUALQUIER suscripción registrada —incluida una pendiente
 * de autorización (decisión CEO: el que eligió plan pagado hizo su parte)— el
 * paso está cumplido y va directo al cierre.
 */
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { verifyAuth } from "@/lib/auth";
import { derivarPasoPendiente } from "@/lib/dal/services/camino/estado";
import { PagosClienteRepository } from "@/lib/dal/repositories/pagos-cliente-repository";
import { solicitarPlan } from "@/lib/pagos/suscripcion-solicitud.service";
import { activarFreemiumConRateLimit } from "@/lib/pagos/freemium-activacion.service";
import { anioBogota } from "@/lib/pagos/renovacion-calculos";
import { obtenerTasaIva, ivaAplicaA } from "@/lib/pagos/parametros-pagos";
import { PlanesSelector } from "@/components/modules/pagos/PlanesSelector";
import { DESTINO_CIERRE, destinoDePaso } from "@/lib/camino/pasos";
import type { PlanSelectorDTO } from "@/lib/pagos/planes-selector.types";

async function actionSolicitarPlan(planId: string, codigoBono?: string) {
    "use server";
    const usuario = await verifyAuth("PARENT");
    await solicitarPlan({
        usuario: { id: usuario.id, rol: usuario.rol, colegioId: usuario.colegioId, email: usuario.email, nombre: usuario.nombre },
        planId,
        codigoBono,
        rolDueño: usuario.rol,
    });
    revalidatePath("/camino/plan");
}

async function actionActivarFreemium() {
    "use server";
    const headersList = await headers();
    const ipAddress = headersList.get("x-forwarded-for") ?? headersList.get("x-real-ip") ?? "unknown";
    const userAgent = headersList.get("user-agent") ?? undefined;
    const usuario = await verifyAuth("PARENT");
    await activarFreemiumConRateLimit({
        usuario: { id: usuario.id, rol: usuario.rol, colegioId: usuario.colegioId, email: usuario.email, nombre: usuario.nombre },
        aceptaTerminos: true,
        ipAddress,
        userAgent,
    });
    revalidatePath("/camino/plan");
}

export default async function CaminoPlanPage() {
    const usuario = await verifyAuth("PARENT");

    // Una sola fuente de verdad (Q-3: sin prisma directo fuera del DAL): la
    // misma derivación del guardián. null = camino terminado → al cierre; un
    // paso anterior = defensa por si llegó acá saltando (el guardián ya lo
    // habría devuelto, pero dos vallas son mejores que una con PII de menores).
    const paso = await derivarPasoPendiente(usuario.id);
    if (paso === null) redirect(DESTINO_CIERRE);
    if (paso !== "plan") redirect(destinoDePaso(paso));

    const [planes, tasaIva, aplicaIva] = await Promise.all([
        new PagosClienteRepository().listarPlanesActivosPorTitular("PADRE", anioBogota()),
        obtenerTasaIva(),
        ivaAplicaA("PADRE"),
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
            <h1 className="font-serif text-2xl text-body">Ya casi. Elige cómo empezar</h1>
            <p className="mb-5 mt-1 text-sm text-muted">
                Arranca gratis 30 días. Sin tarjeta, sin compromiso.
            </p>
            <PlanesSelector
                planes={dtos}
                usuario={{ id: usuario.id, rol: "PARENT", nombre: usuario.nombre, email: usuario.email }}
                color="cielo"
                onSeleccionar={actionSolicitarPlan}
                onFreemium={actionActivarFreemium}
                tasaIva={tasaIva}
                aplicaIva={aplicaIva}
            />
        </div>
    );
}
