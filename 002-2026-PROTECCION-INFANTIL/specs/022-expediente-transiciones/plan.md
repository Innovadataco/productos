# Plan — Spec 022: Expediente interno de transiciones

## Modelos y campos de BD (schema.prisma)

**Nuevo modelo:**

```prisma
enum ResponsableTransicion {
  IA
  WORKER
  SISTEMA
  OPERADOR
  COMITE
  ADMIN
}

model TransicionReporte {
  id               String                @id @default(cuid())
  reporteId        String
  estadoAnterior   EstadoReporte
  estadoNuevo      EstadoReporte
  responsableTipo  ResponsableTransicion
  responsableId    String?               // id de Usuario cuando tipo es OPERADOR, COMITE o ADMIN
  motivo           String?               @db.Text
  metadatos        Json?
  creadoEn         DateTime              @default(now())

  reporte        Reporte @relation(fields: [reporteId], references: [id], onDelete: Cascade)
  responsableUsuario Usuario? @relation(fields: [responsableId], references: [id])

  @@index([reporteId])
  @@index([responsableTipo])
  @@index([responsableId])
  @@index([creadoEn])
}
```

**Modelo existente modificado:** `Reporte` (agregar relación `transiciones TransicionReporte[]`).

**Migración:** `2026xxxxxx_add_transicion_reporte`.

## Herramientas

- **Reutilizar**: Prisma, `EstadoReporte` enum existente.
- **Nueva**: ninguna. La tabla es propia del dominio.

## Dependencias

- Ninguna entrada. Esta spec es base para 023-026.

## Fases

1. Schema + migración.
2. Helper `src/lib/reporte-transiciones.ts` con `registrarTransicion()`.
3. Endpoint `/api/admin/reportes/[id]/transiciones` + test.
4. Componente `TimelineTransiciones` en detalle de caso.
5. Cierre con README.

## Consumidores futuros

- Spec 023: transiciones PENDIENTE↔En proceso, CLASIFICADO/CORREGIDO↔Procesado.
- Spec 024: transiciones por escalamiento a comité.
- Spec 025: transiciones por anonimización.
- Spec 026: transiciones por reintentos, spam y prioridad.
