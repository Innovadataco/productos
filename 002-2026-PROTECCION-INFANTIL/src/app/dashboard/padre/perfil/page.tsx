import type { Metadata } from "next";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { verifyAuth } from "@/lib/auth";
import { PagosClienteRepository } from "@/lib/dal/repositories/pagos-cliente-repository";
import { obtenerVistaSuscripcion, obtenerSuscripcionTitular } from "@/lib/pagos/suscripcion-vista.service";
import { solicitarPlan } from "@/lib/pagos/suscripcion-solicitud.service";
import { activarFreemiumConRateLimit } from "@/lib/pagos/freemium-activacion.service";
import { sellarCookieSesionEstadoEnAccion } from "@/lib/routing/sellar-sesion-estado";
import { anioBogota } from "@/lib/pagos/renovacion-calculos";
import { obtenerTasaIva, ivaAplicaA } from "@/lib/pagos/parametros-pagos";
import { obtenerCuponesRecompensaDelUsuario } from "@/lib/pagos/entregar-cupones-recompensa.service";
import { SuscripcionVista } from "@/components/modules/cliente/suscripcion/SuscripcionVista";
import { PlanesSelector } from "@/components/modules/pagos/PlanesSelector";
import { EsperandoAutorizacion } from "@/components/modules/pagos/EsperandoAutorizacion";
import { PerfilPadreForm } from "@/components/modules/padre/PerfilPadreForm";
import { HistorialCambiosPerfil } from "@/components/modules/padre/HistorialCambiosPerfil";
import { PreferenciasNotificaciones } from "@/components/modules/perfil/PreferenciasNotificaciones";
import { MisHijos } from "@/components/modules/padre/MisHijos";
import { getParametroSistemaValor } from "@/lib/parametros";
import type { PlanSelectorDTO } from "@/lib/pagos/planes-selector.types";

export const metadata: Metadata = {
    title: "Mi perfil",
    description: "Tus datos de contacto, tus notificaciones y tu suscripción.",
};

interface PageProps {
    searchParams: Promise<{ bienvenida?: string }>;
}

// SPEC-289 (002-PI-189 · Fase 1): idem colegio — el DTO conserva `precioBaseUSD`
// (candado §4 brief) pero lo cero-emitimos. La vista del cliente colombiano NO
// lee el precio USD. (Movido intacto desde /dashboard/padre/suscripcion, SPEC-607.)
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
    // SPEC-342: cualquier suscripción registrada cumple el Paso 4 (decisión CEO)
    // — el plan pagado también debe abrir al instante.
    await sellarCookieSesionEstadoEnAccion(usuario.id);

    revalidatePath("/dashboard/padre/perfil");
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
    // SPEC-342 (I-227): la activación cambia la vigencia Y cierra el Paso 4 del
    // camino — re-sellar AQUÍ, en la acción, que es el flujo real del botón.
    await sellarCookieSesionEstadoEnAccion(usuario.id);

    // SPEC-287 (I-141): la Server Action NO termina con redirect(<misma ruta>);
    // el POST-redirect-GET lo hace el navegador. revalidatePath re-renderiza
    // la página con el nuevo estado de vigencia (freemium ya ACTIVA).
    revalidatePath("/dashboard/padre/perfil");
}

/**
 * SPEC-607 (diseño final · design/expediente-final-mockup.html): acordeón nativo
 * `<details>`/`<summary>` — funciona sin JavaScript y la URL con ancla
 * (`/dashboard/padre/perfil#suscripcion`) lo abre sola en el navegador, que es
 * como las rutas viejas aterrizan en su sección.
 */
function Acordeon({
    id,
    abierto,
    titulo,
    subtitulo,
    children,
}: {
    id: string;
    abierto: boolean;
    titulo: string;
    subtitulo: string;
    children: React.ReactNode;
}) {
    return (
        <details id={id} data-testid={`acordeon-${id}`} className="group glass overflow-hidden rounded-2xl shadow-sm" open={abierto}>
            <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 px-4 py-3 text-base font-semibold text-body transition-colors hover:bg-tinta/5 [&::-webkit-details-marker]:hidden">
                <span className="min-w-0 flex-1">
                    {titulo}
                    <span className="block text-sm font-normal text-subtle">{subtitulo}</span>
                </span>
                <span aria-hidden="true" className="inline-block text-subtle transition-transform group-open:rotate-90">
                    ▶
                </span>
            </summary>
            <div className="border-t border-tinta/10 px-4 py-4 sm:px-6">{children}</div>
        </details>
    );
}

/**
 * SPEC-607 · «Mi perfil» unificado: UNA página con tres acordeones —
 * Información general, Notificaciones y Suscripción. El contenido de
 * Notificaciones y Suscripción es el que vivía en sus rutas propias, que ahora
 * redirigen acá con ancla (`#notificaciones`, `#suscripcion`).
 *
 * Sin cobertura (sin plan o vencido) el acordeón de Suscripción nace ABIERTO:
 * esta página es el destino del guardián de vigencia (vía el redirect de
 * /dashboard/padre/suscripcion) y lo que el padre tiene que resolver es el plan.
 */
export default async function PadrePerfilPage({ searchParams }: PageProps) {
    const params = await searchParams;
    const mostrarBienvenida = params.bienvenida === "1";
    const usuario = await verifyAuth("PARENT");
    // SPEC-660 (Fase C): «Configurar» (registrar/editar menores) se muda a Mi
    // perfil como sección desplegable. El cupo sale del parámetro, igual que en
    // /dashboard/padre/hijos (que sigue vivo — expandir, después Dev 1 contrae).
    const maximoHijos = parseInt((await getParametroSistemaValor("padre.hijos.maximo")) ?? "5", 10);
    const suscripcion = await obtenerSuscripcionTitular({
        id: usuario.id,
        rol: usuario.rol,
        colegioId: usuario.colegioId,
    });

    const conCobertura =
        suscripcion !== null && (suscripcion.estado === "ACTIVA" || suscripcion.estado === "EN_GRACIA");

    // SPEC-628 #4 · «quieto, NO borrado» (Jelkin): la suscripción y el referido
    // quedan FUNCIONALMENTE APAGADOS por ahora. El flag deja el código intacto y
    // reversible: en `true` NO se computa (cero fetches) ni se renderiza ningún
    // control vivo — solo la nota. Reactivar = ponerlo en `false`.
    const SUSCRIPCION_EN_PAUSA = true;

    let contenidoSuscripcion: React.ReactNode = null;
    if (!SUSCRIPCION_EN_PAUSA && conCobertura) {
        const [vista, cupones] = await Promise.all([
            obtenerVistaSuscripcion({
                id: usuario.id,
                rol: usuario.rol,
                colegioId: usuario.colegioId,
            }),
            obtenerCuponesRecompensaDelUsuario(usuario.id),
        ]);
        if (vista) {
            contenidoSuscripcion = (
                <SuscripcionVista
                    vista={vista}
                    color="cielo"
                    mostrarContrato={false}
                    cupones={cupones}
                    mostrarBienvenida={mostrarBienvenida}
                />
            );
        }
    }
    if (!SUSCRIPCION_EN_PAUSA && !contenidoSuscripcion && suscripcion && suscripcion.estado === "PENDIENTE_AUTORIZACION") {
        contenidoSuscripcion = (
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
        );
    }
    if (!SUSCRIPCION_EN_PAUSA && !contenidoSuscripcion) {
        const [planes, tasaIva, aplicaIva] = await Promise.all([
            new PagosClienteRepository().listarPlanesActivosPorTitular("PADRE", anioBogota()),
            obtenerTasaIva(),
            ivaAplicaA("PADRE"),
        ]);
        contenidoSuscripcion = (
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
        );
    }

    // SPEC-647 (D-136): Google salió del producto → toda cuenta entra con correo y contraseña. El
    // perfil ya no ofrece «Crear contraseña» (eso era para cuentas OAuth, que ya no existen).
    const comoEntras = "Con correo y contraseña";

    return (
        <main className="min-h-screen bg-page px-4 py-8 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl space-y-4">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-body">Mi perfil</h1>
                    <p className="mt-1 text-sm text-muted">Tus datos, tus avisos y tu plan en una sola ventana.</p>
                </div>

                <Acordeon id="general" abierto={conCobertura} titulo="Información general" subtitulo="Tus datos de contacto y acceso">
                    <PerfilPadreForm />
                    <div className="mt-4" data-testid="como-entras">
                        <span className="text-xs font-medium text-muted">Cómo entras</span>
                        <p className="mt-1 text-sm text-body">{comoEntras}</p>
                    </div>
                    <div className="mt-6">
                        {/* SPEC-590 (decisión CEO 06-09): historial de cambios del perfil. */}
                        <HistorialCambiosPerfil />
                    </div>
                </Acordeon>

                <Acordeon id="menores" abierto={false} titulo="Menores de edad" subtitulo="Los menores que proteges y sus cuentas">
                    <MisHijos maximoActivos={maximoHijos} />
                </Acordeon>

                <Acordeon id="notificaciones" abierto={false} titulo="Notificaciones" subtitulo="Qué avisos quieres recibir">
                    <PreferenciasNotificaciones rol={usuario.rol} correo={usuario.email} />
                </Acordeon>

                <Acordeon id="suscripcion" abierto={false} titulo="Suscripción" subtitulo="Plan, prueba y facturación">
                    {/* SPEC-628 #4 (Jelkin: «ese tema de suscripción le podemos dar por
                        ahora quieto mientras estabilizamos el software»). «Quieto» =
                        FUNCIONALMENTE APAGADO (decisión CEO/Diseño): una NOTA sola, SIN
                        controles vivos —nada de renovar, cancelar o aplicar bono bajo un
                        texto que dice «no disponible»; un control vivo ahí se contradice
                        solo—. Copy aprobado por Diseño (no promete plazo ni confiesa
                        inestabilidad). Tono neutro: es informativo, no atención pendiente. */}
                    <div
                        data-testid="suscripcion-en-pausa"
                        role="note"
                        className="rounded-xl border border-tinta/15 bg-superficie-1 px-4 py-3 text-sm text-muted dark:border-tinta/12"
                    >
                        La suscripción y el código de referido no están disponibles por ahora.
                    </div>
                </Acordeon>
            </div>
        </main>
    );
}
