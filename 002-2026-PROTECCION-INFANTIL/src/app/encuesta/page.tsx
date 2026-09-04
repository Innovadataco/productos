/**
 * SPEC-429 (A-75 · brief §9-bis) · Pantalla de encuesta post-cita.
 * La activa la guardia `encuestaPendiente` del middleware. Muestra la
 * próxima pendiente del usuario (padre o profesional) — cuando la responde,
 * si le queda otra queda en la misma URL con la siguiente; cuando no queda
 * ninguna, la guardia se baja y navega a su home.
 */
import { verifyAuth } from "@/lib/auth";
import { EncuestaFormulario } from "@/components/modules/encuesta/EncuestaFormulario";
import {
    proximaEncuestaPendiente,
} from "@/lib/profesional/cita/encuestas.service";
import {
    PREGUNTAS_PADRE,
    PREGUNTAS_PROFESIONAL,
} from "@/lib/profesional/cita/encuestas-preguntas";
import { redirect } from "next/navigation";

export default async function EncuestaPage() {
    const user = await verifyAuth();
    const pendiente = await proximaEncuestaPendiente(user.id);
    if (!pendiente) {
        // No debería llegar acá (la guardia sólo redirige si `encuestaPendiente`
        // en la cookie es true), pero si por reajuste queda desfasada, mandamos
        // al home y el próximo re-sello baja el flag.
        redirect("/");
    }
    const preguntas = pendiente.origen === "PADRE" ? PREGUNTAS_PADRE : PREGUNTAS_PROFESIONAL;
    return (
        <EncuestaFormulario
            solicitudId={pendiente.solicitudId}
            origen={pendiente.origen}
            preguntas={preguntas}
            titulo="Contanos cómo fue la cita"
            explicacion="Cinco preguntas de opción — sin estrellas ni texto libre. Tus respuestas se cruzan con las del otro lado para detectar contradicciones."
        />
    );
}
