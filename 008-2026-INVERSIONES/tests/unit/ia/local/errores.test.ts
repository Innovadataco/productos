/**
 * Las listas cerradas de la puerta local: los códigos de configuración (que lanzan) y los detalles de cada motivo de
 * fallo (que vuelven en el resultado). Todo detalle cumple el patrón del contrato: sin dígitos ni datos.
 */
import { describe, expect, it } from "vitest";
import { MAX_LARGO_DETALLE, MOTIVOS_FALLO_GENERADOR, PATRON_DETALLE } from "@/ia/generador";
import { CODIGOS_ERROR_LOCAL, DETALLES_LOCAL, ErrorLocal, falloLocal } from "@/ia/local/errores";

describe("códigos de error de la configuración", () => {
  it("son una lista exacta y congelada", () => {
    expect([...CODIGOS_ERROR_LOCAL]).toEqual([
      "DESTINO_AUSENTE", "DESTINO_INVALIDO", "DESTINO_FUERA_DE_RANGO", "RUTA_NO_PERMITIDA", "MODELO_NO_APROBADO", "CONFIGURACION_INVALIDA", "LIMITE_INVALIDO",
    ]);
    expect(Object.isFrozen(CODIGOS_ERROR_LOCAL)).toBe(true);
  });

  it("ErrorLocal lleva el código y un mensaje sin datos", () => {
    const error = new ErrorLocal("MODELO_NO_APROBADO");
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("ErrorLocal");
    expect(error.codigo).toBe("MODELO_NO_APROBADO");
    expect(error.message).toBe("Puerta local: MODELO_NO_APROBADO.");
  });
});

describe("detalles de fallo por motivo", () => {
  it("son listas exactas y congeladas, solo de motivos del contrato", () => {
    expect(DETALLES_LOCAL).toEqual({
      MODELO_NO_DISPONIBLE: ["DIGEST_POR_VERIFICAR", "MODELO_NO_ENCONTRADO", "MODELO_AMBIGUO", "DIGEST_NO_COINCIDE", "CONEXION_RECHAZADA", "FALLO_DE_RED", "CONEXION_CORTADA"],
      TIEMPO_AGOTADO: ["LIMITE_DEL_CLIENTE", "LIMITE_EN_ESPERA", "SENAL_ABORTADA"],
      ERROR_PROVEEDOR: [
        "HTTP_REDIRECCION", "HTTP_PROHIBIDO", "HTTP_NO_ENCONTRADO", "HTTP_ERROR_CLIENTE", "HTTP_ERROR_SERVIDOR", "HTTP_ESTADO_INVALIDO",
        "CUERPO_DEMASIADO_GRANDE", "CUERPO_INVALIDO", "MODELO_DISTINTO", "GENERACION_INCOMPLETA", "SALIDA_CORTADA", "RESPUESTA_VACIA",
        "SALIDA_DEMASIADO_LARGA", "PEDIDO_INVALIDO", "PEDIDO_NO_CIEGO", "EXCEPCION_INTERNA",
      ],
    });
    expect(Object.isFrozen(DETALLES_LOCAL)).toBe(true);
    for (const [motivo, detalles] of Object.entries(DETALLES_LOCAL)) {
      expect(MOTIVOS_FALLO_GENERADOR as readonly string[]).toContain(motivo);
      expect(Object.isFrozen(detalles)).toBe(true);
    }
  });

  it("cada detalle cumple PATRON_DETALLE y su tope, y ninguno se repite entre motivos", () => {
    const todos = Object.values(DETALLES_LOCAL).flat();
    for (const detalle of todos) {
      expect(detalle).toMatch(PATRON_DETALLE);
      expect(detalle.length).toBeLessThanOrEqual(MAX_LARGO_DETALLE);
    }
    expect(new Set(todos).size).toBe(todos.length);
  });

  it("falloLocal arma un fallo de la puerta local, congelado", () => {
    const fallo = falloLocal("TIEMPO_AGOTADO", "SENAL_ABORTADA");
    expect(fallo).toEqual({ ok: false, puerta: "local", motivo: "TIEMPO_AGOTADO", detalle: "SENAL_ABORTADA" });
    expect(Object.isFrozen(fallo)).toBe(true);
  });

  it("un detalle de otro motivo no compila", () => {
    // @ts-expect-error: SENAL_ABORTADA no es un detalle de ERROR_PROVEEDOR.
    expect(falloLocal("ERROR_PROVEEDOR", "SENAL_ABORTADA").detalle).toBe("SENAL_ABORTADA");
  });
});
