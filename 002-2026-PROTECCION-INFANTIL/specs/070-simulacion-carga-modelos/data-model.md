# Data Model: Simulación de carga y comparación de modelos (Spec 070)

## Nuevas entidades (Prisma)

```prisma
model SimulacionRun {
  id            String    @id @default(cuid())
  modelo        String
  totalCasos    Int       @default(0)
  progreso      Int       @default(0)
  estado        String    @default("PENDIENTE") // PENDIENTE | EN_PROGRESO | COMPLETADA | FALLIDA | CANCELADA
  fechaInicio   DateTime  @default(now())
  fechaFin      DateTime?
  metricasJson  Json?
  creadoPorId   String
  creadoPor     Usuario   @relation(fields: [creadoPorId], references: [id])
  casos         SimulacionReporte[]
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@index([estado])
  @@index([creadoPorId])
  @@map("simulacion_runs")
}

model SimulacionReporte {
  id              String        @id @default(cuid())
  simulacionRunId String
  simulacionRun   SimulacionRun @relation(fields: [simulacionRunId], references: [id], onDelete: Cascade)
  reporteId       String        @unique
  reporte         Reporte       @relation(fields: [reporteId], references: [id])
  indice          Int
  categoriaEsperada String?
  createdAt       DateTime      @default(now())

  @@index([simulacionRunId])
  @@index([indice])
  @@map("simulacion_reportes")
}
```

### Notas de diseño

- `SimulacionRun` almacena el modelo, el progreso, el estado, las fechas y las métricas agregadas (`metricasJson`).
- `SimulacionReporte` es la tabla puente entre una corrida y los reportes anónimos creados, guardando el índice del caso en el set para comparar por posición entre corridas.
- `categoriaEsperada` se guarda en `SimulacionReporte` para facilitar el cálculo de aciertos sin reparsear el archivo original.
- `onDelete: Cascade` en `SimulacionReporte` permite borrar la relación si se elimina la corrida; el `Reporte` asociado permanece como dato histórico descartable.
- Se añade relación `Usuario.simulaciones` si no existe; en caso de que el modelo `Usuario` ya tenga relaciones con nombre conflictivo, usar un alias.

## Cambios mínimos en el modelo existente

### `Usuario`

```prisma
model Usuario {
  // ... campos existentes ...
  simulaciones SimulacionRun[]
}
```

### `Reporte`

No se modifica. La relación con `SimulacionReporte` es opcional (1:1) y se consulta cuando se necesita.

### `FuenteReporte`

Si el schema ya tiene `FuenteReporte` con campo `origen` (String), se puede usar `"SIMULACION"` para distinguir reportes de simulación. Si no existe, el prefijo `SIM-` en el identificador y la tabla `SimulacionReporte` son suficientes.

## Datos de simulación

- Cada caso se convierte en un reporte anónimo con `identificador` = `SIM-{runIdShort}-{indice}`.
- El `texto` y otros campos se toman del archivo cargado.
- `plataforma` debe existir en `prisma.plataforma`.
- `categoriaEsperada` es opcional y se usa solo para métricas de acierto.

## Índices propuestos

- `SimulacionRun(estado)`: para listar corridas activas/finalizadas rápidamente.
- `SimulacionRun(creadoPorId)`: para listar corridas por admin.
- `SimulacionReporte(simulacionRunId)`: para cargar todos los casos de una corrida.
- `SimulacionReporte(indice)`: para comparar por índice entre corridas.
- `SimulacionReporte(reporteId)`: relación 1:1 con Reporte.

## Sin datos sensibles

- `SimulacionRun` no contiene PII; solo modelo, conteos, métricas y relación con el admin.
- `SimulacionReporte` no contiene texto; la relación con `Reporte` apunta al reporte anónimo creado.
- Los textos de casos de prueba son proporcionados por el admin y se tratan como datos de prueba descartables.

