# Quickstart / Validación §6: El comité de convivencia, operativo (SPEC-319)

Guía de validación end-to-end. La evidencia §6 se ejerce **en producción con la cuenta del comité** y se publica en el PR (candado 25 · no se acepta "compila").

## Prerrequisitos
- Cuenta del comité de un colegio de prueba (se siembra en el flujo §2.2).
- Acceso a la app desplegada (`pi.innovadataco.com`) con el rol correspondiente.

## Fase 1 — §2.1 (MVP desbloqueo) + §2.6
1. **Login directo del comité** → aterriza en `/dashboard/colegio/comite` (no `/mis-reportes`).
2. **Cambio de clave del comité** (cuenta que debe cambiarla) → tras definirla, aterriza en `/dashboard/colegio/comite`.
3. **`/mis-reportes` a mano** con la cuenta del comité → **rebota** a su panel, sin `ErrorState`.
4. **OPERADOR**: login y post-cambio-de-clave aterrizan en el **mismo** destino (`/dashboard/admin`).
5. **PARENT**: login sigue aterrizando en `/mis-reportes` (cero regresión · Decisión B).
6. **Header del comité** (§2.6): no ofrece "Mi panel"/"Círculo de Confianza"/"Mis reportes".
- Tests: `homeParaRol` unit (todos los roles + default), y los tests de los 3 consumidores que tocás (candado 24 v2).

## Fase 2 — §2.2 (acceso por email)
1. Rector crea la cuenta del comité con email → la UI **no muestra ninguna contraseña**; confirma envío de invitación.
2. El comité abre `/activar?token=…` → define su propia contraseña → puede loguear y aterriza en su panel.
3. Token vencido/usado → mensaje claro, sin exponer datos.

## Fase 3 — §2.3 (directorio de integrantes)
1. Contador visible "N integrantes · M activos".
2. Estado ACTIVO/INACTIVO por fila (texto/etiqueta).
3. "Reenviar invitación" reenvía el link al correo del comité (sin pintar secreto).
4. Editar integrante desde la UI guarda los cambios.
5. Fecha con hora `DD-MM-AAAA HH:MM` COT.
6. Activar/inactivar sigue funcionando igual (sin regresión).

## Fase 4 — §2.4 (firma del cierre)
1. Cerrar/resolver un caso → aparece el selector de integrante firmante (solo activos).
2. Sin seleccionar firmante → no se puede cerrar.
3. Tras cerrar → la firma queda en el caso (`integranteFirmanteId`) y en `AuditLog`.
4. Colegio sin integrantes activos → el sistema lo informa; no permite firmar en el vacío.
- Test integration: `resolver()` con firmante válido/ inválido/ inactivo.

## Fase 5 — §2.5 (inicio como bandeja)
1. Con casos vencidos/por vencer 24 h → aparecen primero como lista accionable.
2. Cabecera humana (saludo por franja + fecha larga español).
3. Métricas con contexto (`sub`).
4. Acciones en verbo.
5. Sin casos → empty state propio (no tablero de ceros).
6. `/comite/casos` con **un solo nombre** en lateral y header.
7. Se ve bien en teléfono.

## Evidencia §6 a publicar en el PR
Capturas del flujo real con la cuenta del comité (cada fase que cierre). Un hueco que no se pueda ejercer (p. ej. sin casos para cerrar) se **declara** (candado 18).
