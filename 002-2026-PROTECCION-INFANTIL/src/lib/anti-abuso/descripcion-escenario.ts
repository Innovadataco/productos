/**
 * SPEC-185: descripciones humanas de los escenarios del simulador de abusos.
 * El lenguaje es descriptivo/estadístico; nunca veredicto.
 */
export function descripcionEscenario(escenario: string): string {
    switch (escenario) {
        case "robot_inundando":
            return "Una sola IP envía muchos reportes con identificadores rotativos. Sirve para probar rate-limit por identificador y detección de ráfagas.";
        case "ataque_coordinado":
            return "Múltiples IPs distintas apuntan al mismo identificador. Sirve para probar rate-limit por IP y agregación de reportes.";
        case "bot_ips_rotativas":
            return "IPs rotativas combinan con identificadores rotativos. Sirve para probar detección de patrones de botnet y fingerprints.";
        case "denunciante_spam":
            return "Un usuario PARENT autenticado envía reportes masivos contra distintos identificadores. Sirve para probar la señal de spam desde fuente autenticada.";
        case "personalizado":
            return "Escenario configurable por el operador para pruebas específicas.";
        default:
            return "Escenario desconocido.";
    }
}
