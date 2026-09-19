import { z } from "zod";

/**
 * SPEC-721 · Campos de entrada de un identificador (cuenta) de un menor.
 *
 * La PLATAFORMA es OBLIGATORIA. Sin la red no se puede afirmar «esta cuenta» en el cruce con los
 * reportes (I-429) → una cuenta sin plataforma no se puede vigilar (no enciende ámbar, no cuenta en
 * el detalle, no dispara aviso). Cerrar la puerta acá —en el ESQUEMA DE ENTRADA de la API— es lo que
 * impide que esa fila NAZCA, incluso por una llamada directa que no pase por el formulario.
 *
 * Fuente ÚNICA para las DOS puertas (alta de hijo con cuentas · agregar una cuenta a un hijo
 * existente): comparten esta forma, así no pueden divergir. El `NOT NULL` de la columna es decisión
 * aparte del CEO (con respaldo, nunca NOT VALID).
 */
export const camposIdentificadorEntrada = {
    valor: z.string().min(1).max(100),
    tipo: z.string().max(50).optional(),
    plataformaId: z
        .string({ error: "Elige la plataforma de la cuenta." })
        .min(1, "Elige la plataforma de la cuenta.")
        .max(100),
} as const;
