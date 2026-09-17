/**
 * SPEC-685 (PR2-bis · FORMA-MI-PERFIL-PROFESIONAL-HABILITADO) · «Mi perfil».
 *
 * La única entrada del menú donde el profesional HABILITADO reúne lo que antes
 * vivía en tres sitios: sus datos (la ficha), su tarifa, sus documentos y el
 * estado de su verificación (al final de los documentos, como pidió Jelkin).
 *
 * Solo el HABILITADO ve esta pantalla: `exigirProfesionalHabilitado` manda al
 * portero (SPEC-691) a cualquier no habilitado — misma compuerta de servidor, no
 * una nueva. Por eso la tarifa vive acá y en ningún camino la ve quien no está
 * habilitado.
 *
 * El aviso de la tarifa (FORMA §2-bis) muestra los valores VIGENTES leídos en vivo
 * (precio estándar de la 1ª cita + % de servicio). Si un parámetro falta, se pasa
 * `null` y el cliente pinta la frase SIN número — nunca una cifra inventada.
 */
import { redirect } from "next/navigation";
import { exigirProfesionalHabilitado } from "@/lib/profesionales/guardia-habilitado";
import { PerfilProfesionalRepository } from "@/lib/dal/repositories/perfil-profesional";
import { toPerfilProfesionalPropio } from "@/lib/profesional/dto";
import { leerCatalogosFicha } from "@/lib/profesional/catalogos-lectura";
import { leerPrecioEstandarPrimeraCita } from "@/lib/profesional/cita/precio-primera-cita";
import { obtenerPorcentajeServicio } from "@/lib/profesional/cita/comision";
import { verificacionParaProfesional } from "@/lib/profesionales/verificador/vista-profesional";
import { MiPerfilProfesionalClient } from "@/components/modules/profesional/MiPerfilProfesionalClient";

export const dynamic = "force-dynamic";

export default async function MiPerfilProfesionalPage() {
    // Compuerta de SERVIDOR: no habilitado → portero (SPEC-691). No es una nueva.
    const { user } = await exigirProfesionalHabilitado();

    const perfil = await new PerfilProfesionalRepository().findConCiudadPorUsuarioId(user.id);
    // Defensivo: un habilitado siempre tiene perfil; si no, a completarlo.
    if (!perfil) redirect("/perfil-profesional/completar");

    const [catalogos, vista, precioEstandar, pct] = await Promise.all([
        leerCatalogosFicha(),
        verificacionParaProfesional(user.id),
        // Los readers TIRAN si el parámetro falta; acá NO tumbamos la pantalla:
        // se pasa null y el aviso va sin número (nunca una cifra inventada).
        leerPrecioEstandarPrimeraCita().catch(() => null),
        obtenerPorcentajeServicio().catch(() => null),
    ]);

    return (
        <MiPerfilProfesionalClient
            perfil={toPerfilProfesionalPropio(perfil)}
            rangoCatalogo={catalogos.rangoEtario}
            aviso={{ precioEstandar, pct }}
            vista={vista}
        />
    );
}
