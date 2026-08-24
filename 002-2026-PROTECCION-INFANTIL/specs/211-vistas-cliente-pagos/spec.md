# SPEC-211 · Vistas cliente (Rector + Padre) (002-PI-111)

> Status: `PLANEADO`
> PI: 002-PI-111
> Responsable: ODIN
> Rama: `work/002-PI-pagos-planes-lote3`
> Base: `feature/001-scaffolding`

Impacto en arquitectura: añade las vistas de suscripción para clientes finales del Módulo Pagos — `/dashboard/colegio/suscripcion` (rector, color `pino`) y `/dashboard/padre/suscripcion` (padre, color `cielo`) — con 7 bloques estándar (resumen, acciones, historial, código referido, bono, contrato, cancelar) y formulario de renovación con upload de comprobante. Sin cambios de modelo (depende de SPEC-210).

## Contexto

Vistas de suscripción para los clientes finales del Módulo Pagos: Rector (`/dashboard/colegio/suscripcion`, color `pino`) y Padre (`/dashboard/padre/suscripcion`, color `cielo`). Ambas vistas muestran 7 bloques estándar (resumen, acciones, historial, código referido, bono, contrato, cancelar) y un formulario de renovación con upload de comprobante. Depende de SPEC-210 (modelos y DAL). **Nota de riesgo**: el layout/sidebar padre (`/dashboard/padre/*`) no existe en la rama base; depende de SPEC-231 / Fábrica 3.

## User Stories

| ID | User Story | Priority |
|---|---|---|
| US-001 | Como rector, quiero ver el estado de mi suscripción, para saber si estoy al día. | Must |
| US-002 | Como rector, quiero renovar mi suscripción subiendo un comprobante, para continuar el servicio. | Must |
| US-003 | Como rector, quiero ver mi código de referido, para compartirlo. | Must |
| US-004 | Como rector, quiero aplicar un bono promocional, para obtener descuento. | Must |
| US-005 | Como padre, quiero tener una vista equivalente a la del rector adaptada a mi rol. | Must |
| US-006 | Como cliente, quiero cancelar mi suscripción, para dar de baja el servicio. | Should |

## Acceptance Scenarios

### AS-001 · Resumen de suscripción
**Given** un cliente autenticado  
**When** abre `/dashboard/colegio/suscripcion` o `/dashboard/padre/suscripcion`  
**Then** ve card con estado, fechas, días restantes y total pagado histórico.

### AS-002 · Formulario de renovación
**Given** un cliente en estado `ACTIVA` o `EN_GRACIA`  
**When** hace clic en "Renovar"  
**Then** ve formulario con duración, precio local calculado, descuentos, método pago, upload comprobante y notas.

### AS-003 · Upload de comprobante
**Given** un cliente en el formulario de renovación  
**When** selecciona un archivo PNG/JPEG/PDF de menos del tamaño máximo  
**Then** el sistema calcula SHA256, valida tamaño/tipo y crea `Pago` en `PENDIENTE_AUTORIZACION`.

### AS-004 · Código de referido visible
**Given** un cliente con suscripción  
**When** abre la vista  
**Then** ve su código, botón copiar y contador de referidos exitosos.

### AS-005 · Aplicar bono
**Given** un cliente con un bono válido  
**When** ingresa el código  
**Then** el sistema valida y muestra descuento aplicado.

### AS-006 · Cancelar suscripción
**Given** un cliente autenticado  
**When** solicita cancelar con triple confirmación  
**Then** la suscripción pasa a `CANCELADA`, se preservan datos y se registra `AuditLog`.

### AS-007 · Timezone Bogotá
**Given** fechas de vigencia almacenadas en UTC  
**When** el cliente ve la vista  
**Then** todas las fechas se renderizan en `America/Bogota` y "días restantes" usa aritmética Bogotá.

## Functional Requirements

- **FR-001**: El sistema DEBE crear `/dashboard/colegio/suscripcion/page.tsx` usando `ColegioSideNav` existente (color `pino`).
- **FR-002**: El sistema DEBE crear `/dashboard/padre/suscripcion/page.tsx` consumiendo el layout/sidebar padre (color `cielo`) cuando SPEC-231 lo provea.
- **FR-003**: Cada vista DEBE incluir los 7 bloques del BRIEF §8.2/§8.3:
  1. Resumen ejecutivo.
  2. Acciones inmediatas.
  3. Historial de pagos.
  4. Código de referido.
  5. Aplicar bono.
  6. Contrato firmado (solo colegio; opcional padre según config).
  7. Cancelar suscripción.
- **FR-004**: El formulario de renovación DEBE permitir seleccionar duración (`MES_1` a `MES_12`), mostrar precio local calculado, descuentos aplicables, método de pago, upload comprobante y notas.
- **FR-005**: El upload de comprobante DEBE validar:
  - Tamaño máximo según `pagos.comprobante_tamaño_max_mb`.
  - Tipos permitidos según `pagos.comprobante_formatos_permitidos`.
  - Calcular hash SHA256.
- **FR-006**: Al enviar el formulario, el sistema DEBE crear un `Pago` en estado `PENDIENTE_AUTORIZACION` y notificar al admin (vía SPEC-213/eventos).
- **FR-007**: La vista DEBE consumir datos a través de endpoints que usan `PagosRepository` (frontera DAL).
- **FR-008**: El sistema DEBE renderizar fechas con `timeZone: "America/Bogota"` y calcular días restantes con `date-fns-tz`.
- **FR-009**: El sistema DEBE usar colores por rol: `pino` para rector, `cielo` para padre, `ambar` para elementos compartidos de pagos.
- **FR-010**: El sistema DEBE ser responsive (mobile/tablet/desktop).
- **FR-011**: El sistema DEBE registrar `AuditLog` en renovación y cancelación.
- **FR-012**: El sistema NO DEBE crear el sidebar padre aquí; documentar dependencia de SPEC-231.

## Non-Functional Requirements

- **NFR-001**: Gate local completo.
- **NFR-002**: Tests E2E o de componente de los 7 bloques.
- **NFR-003**: Contraste WCAG AA.
- **NFR-004**: Sin `Math.random()` en render.

## Success Criteria

- **SC-001**: Rutas `/dashboard/colegio/suscripcion` y `/dashboard/padre/suscripcion` responden 200 con sesión válida.
- **SC-002**: Card de estado muestra plan, fechaFin, días restantes (Bogotá) y badge de estado.
- **SC-003**: Formulario de renovación permite seleccionar duración + subir comprobante + aplicar código/bono.
- **SC-004**: Sistema visual con paleta correcta por rol.
- **SC-005**: Cero imports de `@/lib/prisma` en `src/app/**`.
- **SC-006**: CI 6/6 verde.

## Assumptions

- SPEC-210 dejó modelos y `PagosRepository`.
- SPEC-212 implementó la autorización de pagos por admin (aunque esta SPEC no la toca).
- `ColegioSideNav` existe y es reusable.
- SPEC-231 proveerá layout/sidebar padre.

## Decisiones propuestas / Deuda / Riesgos

1. **Sidebar padre**: no se crea en esta SPEC. Si SPEC-231 no está mergeado, la ruta `/dashboard/padre/suscripcion` queda como página huérfana hasta que exista el layout.
2. **Storage de comprobantes**: se decide en implementación (S3-compatible o disco local `/uploads/comprobantes/`). La URL se guarda en `Pago.comprobanteAdjuntoUrl`.
3. **Contrato padre**: omitido por default (`pagos.contrato_obligatorio_padres=false`).
4. **Riesgo identificado**: si no existe `/dashboard/colegio` con `ColegioSideNav`, la vista rector también requiere trabajo previo.
