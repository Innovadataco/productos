# Modelo de datos · SPEC-214 · Multi-moneda + API tasas

## Cambios sobre SPEC-210

Esta SPEC no modifica modelos existentes. Consume el modelo `TasaCambio` entregado por SPEC-210:

```prisma
model TasaCambio {
  id                  String     @id @default(cuid())
  monedaOrigen        String     // "USD"
  monedaDestino       String     // "COP" / "MXN" / "CLP" / "ARS"
  tasa                Float      // 1 USD = X monedaDestino
  fecha               DateTime   @db.Timestamptz(6)
  fuente              FuenteTasa // API | ADMIN_MANUAL
  apiUrl              String?
  ingresadoPorAdminId String?
  motivoManual        String?
  createdAt           DateTime   @default(now())

  @@index([monedaDestino, fecha DESC])
}
```

## Semántica de campos

| Campo | Uso en SPEC-214 |
|---|---|
| `monedaOrigen` | Siempre `"USD"` (moneda base de planes). |
| `monedaDestino` | Código ISO de moneda local del cliente. |
| `tasa` | Valor de conversión: `montoLocal = montoNetoUSD × tasa`. |
| `fecha` | Momento de vigencia de la tasa (timezone `America/Bogota`). |
| `fuente` | `API` cuando viene del worker; `ADMIN_MANUAL` cuando un admin la inyecta. |
| `apiUrl` | URL usada para la consulta (auditoría). |
| `ingresadoPorAdminId` | Solo cuando `fuente = ADMIN_MANUAL`. |
| `motivoManual` | Justificación de la inyección manual. |

## Índices

El índice `@@index([monedaDestino, fecha DESC])` de SPEC-210 permite obtener la tasa más reciente por moneda de forma eficiente.

## Parámetros

Se sembrará/actualizará `pagos.tasas.monedas_destino` (CSV) si no está presente. Valor sugerido: `COP,MXN,CLP,ARS`.

## No-DROP

No se agregan ni eliminan columnas. No se borran filas históricas.
