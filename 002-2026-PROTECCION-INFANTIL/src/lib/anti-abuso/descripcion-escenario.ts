/**
 * SPEC-185: descripciones humanas de los escenarios del simulador de abusos.
 * El lenguaje es descriptivo/estadístico; nunca veredicto.
 */
export function descripcionEscenario(escenario: string): string {
    switch (escenario) {
        case "robot_inundando":
            return "Simuló un robot enviando N reportes desde una sola IP en poco tiempo. Prueba el rate-limit por IP (5/hora).";
        case "ataque_coordinado":
            return "Simuló N personas distintas atacando al mismo teléfono/@. Prueba el rate-limit por identificador (10/hora).";
        case "bot_ips_rotativas":
            return "Simuló IPs distintas atacando objetivos distintos. Prueba que el sistema no bloquea IPs legítimas sin señal de abuso.";
        case "denunciante_spam":
            return "Simuló usuario autenticado enviando contra víctimas distintas. Prueba el rate-limit por usuario.";
        case "personalizado":
            return "Escenario configurable por el operador para pruebas específicas.";
        default:
            return "Escenario desconocido.";
    }
}
