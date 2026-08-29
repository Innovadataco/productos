# SPEC-196 — Parche UI Anti-abuso (002-PI-090)

> Status: `IMPLEMENTADO`  
> PI: 002-PI-090  
> Responsable: ODIN  
> Rama: `work/002-pi-090`  
> Base: `feature/001-scaffolding @79bc4206`

## Contexto

Cuatro fixes UI/UX cazados por el CEO en pruebas post-SPEC-192 y post-SPEC-184:

- **I-83**: la nota del simulador no se limpia al cambiar de escenario, obligando al admin a borrarla manualmente.
- **I-84**: el historial de simulaciones no muestra el ID de la corrida, dificultando la trazabilidad en soporte.
- **I-85**: regresión parcial de I-75 — el array de identificadores no se prioriza sobre el campo único en el envío.
- **I-86**: el formulario de bloqueo pide el hash SHA-256 en vez de la IP en claro, y el desbloqueo no exige ni registra motivo.

Todos son parches localizados en componentes React y endpoints API. Cero cambios en motor, rate-limit, ráfagas o duplicados.

## User Stories

| ID | User Story | Priority |
|---|---|---|
| US-001 | Como admin, quiero que el campo Nota se vacíe al cambiar de escenario para escribir una nota nueva sin borrar la anterior. | Must |
| US-002 | Como admin, quiero ver el ID truncado de cada corrida en el historial para poder referenciarla en soporte. | Must |
| US-003 | Como admin, quiero que el simulador priorice el array de identificadores sobre el campo único cuando ambos tengan contenido. | Must |
| US-004 | Como admin, quiero ingresar la IP en claro en el formulario de bloqueo y que el sistema calcule el hash. | Must |
| US-005 | Como admin, quiero que el desbloqueo de IP exija un motivo y quede auditado. | Must |

## Acceptance Scenarios

### AS-001 · Nota limpia al cambiar escenario
**Given** el admin está en la pestaña "Nueva corrida"  
**When** cambia el `<Select>` de escenario  
**Then** el campo "Nota (interna)" queda vacío (`setNota('')`).

### AS-002 · Columna ID en historial
**Given** existe al menos una corrida en el historial  
**When** el admin abre la pestaña "Historial"  
**Then** la tabla muestra una columna al inicio con `run.id.slice(0, 8)` en fuente monoespaciada y un botón para copiar el ID completo.

### AS-003 · Array de identificadores priorizado
**Given** el admin llena "Identificadores (array)" con 5 valores y también "Identificador objetivo"  
**When** presiona "Iniciar"  
**Then** el backend recibe `identificadores` y `identificador` queda omitido; en BD `configJson->'identificadores'` no está vacío.

### AS-004 · Bloquear IP en claro
**Given** el admin ingresa `192.0.2.50` en el campo "IP a bloquear"  
**When** envía el formulario  
**Then** el backend valida que sea IPv4/IPv6, calcula SHA-256 lowercase y persiste el hash; la IP en claro nunca se almacena.

### AS-005 · Desbloquear con motivo auditado
**Given** el admin hace clic en "Desbloquear"  
**When** confirma mediante modal con un motivo de ≥20 caracteres  
**Then** la IP se desbloquea y se registra `AuditLog` con `accion = IP_DESBLOQUEADA_MANUAL` y metadatos incluyendo el motivo.

## Functional Requirements

- **FR-001**: Al cambiar de escenario en `AdminAntiAbusoSimulador.tsx` se debe ejecutar `setNota('')`.
- **FR-002**: `AdminAntiAbusoSimuladorHistorial.tsx` debe mostrar columna ID truncada (`run.id.slice(0, 8)`) y permitir copiar el ID completo.
- **FR-003**: En `AdminAntiAbusoSimulador.tsx:iniciar()`, si `identificadores.trim()` tiene contenido se envía `identificadores` como array; solo si está vacío se envía `identificador`.
- **FR-004**: El endpoint `POST /api/admin/anti-abuso/bloquear` debe aceptar `ip: string` (IPv4/IPv6 válida), calcular `crypto.createHash('sha256').update(ip.trim().toLowerCase()).digest('hex')` y guardar el hash.
- **FR-005**: El schema `bloquearIpBodySchema` debe validar `ip` como string no vacía y, preferentemente, como IPv4/IPv6.
- **FR-006**: El schema `desbloquearIpBodySchema` debe requerir `motivo: z.string().min(20).max(500)`.
- **FR-007**: El componente `BotonDesbloquear` debe abrir modal con `<Textarea>` para motivo, validar longitud y enviarla al backend.
- **FR-008**: `desbloquearIp` en `src/lib/anti-abuso/block-list.ts` debe registrar `AuditLog` con `accion = IP_DESBLOQUEADA_MANUAL` y metadatos `{ ipHash, motivo, admin_id, bloqueo_id, duracion_original }`.
- **FR-009**: Se debe añadir el valor `IP_DESBLOQUEADA_MANUAL` al enum `AccionAudit` de Prisma mediante migración aditiva `ALTER TYPE ... ADD VALUE`.

## Non-Functional Requirements

- **NFR-001**: No tocar `src/lib/ai/**` ni lógica de rate-limit/ráfagas/duplicados.
- **NFR-002**: Cero migraciones destructivas; solo extensión aditiva de enum.
- **NFR-003**: Backend es la única fuente del cálculo de hash.
- **NFR-004**: Toda acción de desbloqueo deja rastro en `AuditLog`.

## Success Criteria

- [x] AS-001 a AS-005 pasan en local y en CI.
- [x] Gate local completo: typecheck, lint, test, arch:check, build.
- [ ] CI 6/6 verde en el PR.

## Assumptions

- El componente `Textarea` existe en `@/components/ui/Textarea` (usado en otras partes del proyecto).
- Existe utilidad de validación de IP o se puede usar una regex/validator simple sin agregar dependencias.
- `logAudit` acepta metadatos JSON sin PII.

## Implementation Notes

- El hash de IP se calcula en el endpoint para evitar discrepancias entre cliente y servidor.
- El enum `AccionAudit` ya contiene `IP_BLOQUEADA` e `IP_DESBLOQUEADA`; se añade `IP_DESBLOQUEADA_MANUAL` para distinguir la acción humana con motivo.
- La tabla de bloqueos vigentes sigue mostrando el hash truncado; no se expone IP en claro.

## Impacto en arquitectura:

- Ninguno estructural. Los cambios son localizados en componentes React (`AdminAntiAbusoSimulador`, `AdminAntiAbusoSimuladorHistorial`, `AdminAntiAbusoOperativo`), schemas de validación (`src/lib/schemas/index.ts`), endpoints API (`/api/admin/anti-abuso/bloquear`, `/api/admin/anti-abuso/desbloquear`) y servicio `src/lib/anti-abuso/block-list.ts`. Se añade un valor aditivo al enum `AccionAudit` de Prisma. No se modifica el motor de IA, el rate-limit ni la lógica de ráfagas/duplicados.

## Deuda Técnica

- Ninguna identificada.
