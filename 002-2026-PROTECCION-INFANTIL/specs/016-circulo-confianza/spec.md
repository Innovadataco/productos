# Spec 016 — Círculo de Confianza

## Estado

**EN DISEÑO** — fecha de inicio: 2026-07-18.

## Concepto

Un usuario autenticado registra identificadores (números de teléfono o nicks) de personas cercanas a su hijo y ve el estado de reportes de cada una. Caso de uso real: un padre detecta si un adulto de su círculo (hermano, tío, amigo de la familia) aparece reportado.

**Principio rector:** la IA ya resuelve la clasificación; si duda, el reporte va a revisión humana (flujo actual de votos/umbral). El Círculo de Confianza **no agrega capa de confirmación nueva ni reglas de visibilidad nuevas**: muestra el estado que el sistema ya determinó, usando la misma información que la consulta pública expone hoy, organizada por contacto.

## Alcance

### Incluido

1. **Gestión de contactos** (sección en el panel del usuario autenticado):
   - Agregar contacto: identificador + plataforma + etiqueta libre.
   - Editar etiqueta.
   - Inhabilitar/habilitar contacto (soft-disable, no borrado destructivo).
   - Listar contactos del usuario autenticado.

2. **Estado por contacto** (semáforo):
   - Sin reportes.
   - Con reportes en revisión (`REVISION_MANUAL`, `POSIBLE_SPAM`, `REQUIERE_ANONIMIZACION`).
   - Con reportes clasificados (`CLASIFICADO`, `CORREGIDO`).
   - Detalle al abrir el contacto: MISMAS reglas de visibilidad que `/api/consulta` para usuarios autenticados (score, nivel de riesgo, categorías, ubicaciones agregadas, timeline).

3. **Vista agregada de Mi Círculo**:
   - Mapa de ubicaciones (país/departamento) de reportes de MIS contactos únicamente.
   - Conteos por país y por departamento — solo mis contactos.
   - Fechas / línea de tiempo de reportes de mis contactos.
   - Botón "Actualizar" para refrescar el estado.
   - Enlace separado al dashboard público general para panorama nacional.

4. **Resumen arriba**: conteo por estado ("3 sin reportes, 1 en revisión").

5. **Notificación**:
   - In-app: estado visible al entrar.
   - Email general y ciego al cambiar algún estado del círculo. Sin nombre, identificador, etiqueta, categoría, fecha ni ciudad. Apagable en preferencias del usuario.

### Excluido

- Crear un nuevo módulo de configuración: el tope `circulo.max_contactos` se configura en `ParametroSistema` y en la UI de configuración admin existente.
- Nuevos componentes de gráficos/mapas: se reutilizan `MetricCard`, `MiniList`, `RiskBadge`, `ChartCard`, `BarChart`, `DonutChart` del dashboard público.
- Nuevas reglas de visibilidad: se usa la misma lógica de `/api/consulta`.
- Nuevos modelos de clasificación o confirmación por el círculo.

## Requisitos funcionales

1. Solo usuarios autenticados pueden acceder al Círculo de Confianza.
2. Un contacto pertenece a un único usuario y se identifica por `(identificador, plataformaId)`.
3. El usuario puede tener hasta `circulo.max_contactos` contactos activos (default 20).
4. Al agregar/editar/inhabilitar un contacto se registra en `AuditLog`.
5. El estado por contacto se calcula a partir de los reportes no eliminados del identificador.
6. El detalle de un contacto no expone más que `/api/consulta` con usuario autenticado.
7. La vista agregada solo incluye reportes de los contactos activos del usuario.
8. El email de notificación es ciego: solo indica "Hay novedades en tu Círculo de Confianza".
9. El email es apagable por el usuario (campo `preferenciasEmail` o tabla equivalente).
10. Existe rate limit en el alta de contactos para prevenir scraping.

## Requisitos no funcionales

- **R1 — Inmutabilidad:** no se modifica el pipeline de clasificación.
- **R2 — Privacidad:** el email es ciego; la vista agregada no expone PII; el detalle respeta las mismas reglas que la consulta pública.
- **R3 — Determinismo:** el estado se deriva de datos existentes, no de nuevas reglas.
- **R4 — Migraciones:** con `prisma migrate dev`.
- **R5 — No tocar embeddings/dedup:** el Círculo no altera `EmbeddingReporte` ni `EmbeddingDataset`.
- **R6 — Calidad:** lint, tsc, build y tests verdes.
- **R7 — No regresión:** no se modifica el pipeline de clasificación ni la consulta pública.

## Reutilización de componentes y sistemas existentes

| Necesidad | Reutilización |
|-----------|---------------|
| Gráficos y tarjetas | `MetricCard`, `MiniList`, `RiskBadge`, `ChartCard`, `BarChart`, `DonutChart` de `src/components/modules/` |
| Configuración de tope | `ParametroSistema` + UI admin de configuración existente (`/dashboard/admin/configuracion`) |
| Notificaciones email | `src/lib/email.ts` + patrón de alertas existente |
| Auditoría | `src/lib/audit.ts` (`logAudit`) |
| Rate limit | `src/lib/rate-limit.ts` (nuevo scope `circulo_contacto`) |
| Visibilidad de identificador | Misma lógica y datos que `/api/consulta` para usuario autenticado |
| Autenticación | `verifyAuth` / `getUserFromToken` existente |

## Modelo de datos propuesto

```prisma
model ContactoConfianza {
  id            String    @id @default(cuid())
  usuarioId     String
  identificador String
  plataformaId  String
  etiqueta      String?   @db.VarChar(100)
  activo        Boolean   @default(true)
  creadoEn      DateTime  @default(now())
  actualizadoEn DateTime  @updatedAt

  usuario    Usuario    @relation(fields: [usuarioId], references: [id], onDelete: Cascade)
  plataforma Plataforma @relation(fields: [plataformaId], references: [id])

  @@unique([usuarioId, identificador, plataformaId])
  @@index([usuarioId, activo])
  @@index([identificador, plataformaId])
}

// Extensión de Usuario (campo nuevo)
model Usuario {
  // ... campos existentes ...
  notificacionesCirculo Boolean @default(true)
}
```

> **Nota:** `notificacionesCirculo` podría evolucionar a un campo JSON de preferencias si se agregan más canales. Para esta spec se usa un booleano simple.

## API propuesta

| Método | Ruta | Propósito |
|--------|------|-----------|
| GET | `/api/circulo-confianza` | Lista contactos con estado resumido. |
| POST | `/api/circulo-confianza` | Agregar contacto. |
| PATCH | `/api/circulo-confianza/[id]` | Editar etiqueta / activar / inhabilitar. |
| GET | `/api/circulo-confianza/[id]` | Detalle del contacto (mismos datos que consulta pública autenticada). |
| GET | `/api/circulo-confianza/agregado` | Vista agregada de reportes de mis contactos. |
| PATCH | `/api/circulo-confianza/preferencias` | Activar/desactivar notificaciones email. |

## Notificaciones

- **Disparador:** cambio de estado de algún contacto del círculo (aparición de primer reporte, cambio a "en revisión", cambio a "clasificado").
- **Cooldown:** no re-notificar por cada reporte nuevo; solo cuando cambia el estado agregado del círculo.
- **Contenido:** `"Hay novedades en tu Círculo de Confianza. Ingresá para revisar."` + link a `/dashboard/circulo-confianza`.
- **Datos en email:** ningún identificador, etiqueta, categoría, fecha ni ubicación.

## Parámetros de sistema

| Clave | Tipo | Default | Descripción |
|---|---|---|---|
| `circulo.max_contactos` | INTEGER | 20 | Tope de contactos activos por cuenta. |
| `circulo.notificaciones.enabled` | BOOLEAN | true | Maestro global de notificaciones de círculo. |
| `ratelimit.circulo_contacto.window_seconds` | INTEGER | 3600 | Ventana rate limit alta de contactos. |
| `ratelimit.circulo_contacto.max_requests` | INTEGER | 20 | Máximo altas de contactos por ventana. |

## Métricas de éxito

- Usuario puede gestionar contactos dentro del tope.
- Estado por contacto refleja correctamente los reportes existentes.
- Vista agregada solo incluye contactos del usuario.
- Email ciego no filtra datos sensibles.
- Suite completa verde (lint, tsc, build, tests, smoke-e2e).

## Pendientes de diseño

Ver [`diseno.md`](diseno.md) para análisis de amenaza, verificación de no-filtración e interacción con reportes dados de baja y anonimización.
