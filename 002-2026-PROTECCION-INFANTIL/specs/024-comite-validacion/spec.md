# Spec 024 — Rol Comité de Validación + gestión de cuenta e integrantes

> **Status**: CERRADA.
> Plan: [`plan.md`](plan.md).
> Data model: [`data-model.md`](data-model.md).
> Cierre: [`cierre.md`](cierre.md).

## Alcance

Agregar el rol `COMITE_VALIDACION` al sistema, con flujo de escalamiento desde OPERADOR hacia el comité. El comité es el último eslabón: no escala al admin, resuelve y cierra.

Además, implementar la **gestión de la cuenta del comité** como un espejo de operadores: el comité es una sola cuenta de usuario con rol `COMITE_VALIDACION`, y sus integrantes reales se administran en una tabla separada (`IntegranteComite`) con datos personales cifrados. El sistema debe poder notificar al comité por email cuando haya casos pendientes de revisión.

## Decisiones

- Extender `RolUsuario` con `COMITE_VALIDACION`.
- Reutilizar `PerfilOperador` con flag `esComite`; `OPERADOR` y `COMITE_VALIDACION` son **excluyentes**.
- El comité es una **única cuenta** de usuario. La creación se hace desde el panel admin y se comporta como un operador especial, con sus propias acciones de AuditLog.
- Los **integrantes** del comité (nombres, identificación, email) se guardan en `IntegranteComite`. El número de identificación se cifra con `param-encryption` antes de persistirse y se descifra al consultarse por un admin.
- El operador escala al comité con un número de solicitud interno distinto al `RPT-` del usuario.
- El comité resuelve: clasifica o corrige, y el reporte pasa a `CLASIFICADO`/`CORREGIDO`.
- El comité está sujeto a las mismas reglas de privacidad que el operador (Spec 025): no ve quién reportó.
- Hoy `CASO_ESCALADO` va al admin; se redirige al pool del comité.
- Se garantiza la exclusividad a nivel de datos y asignación para evitar que alguien escale un caso a sí mismo.

## Requisitos

1. Extender `RolUsuario` con `COMITE_VALIDACION`.
2. Modelo de perfil del comité (decidir si nuevo o extender `PerfilOperador`).
3. Flujo de escalamiento:
   - Operador marca "escalar a comité".
   - Se genera número de solicitud interno.
   - El comité ve la solicitud en su bandeja.
   - El comité resuelve y cierra.
4. AuditLog: acciones `CASO_ESCALADO`, `CASO_RESUELTO_POR_COMITE` (nueva).
5. UI: bandeja del comité, detalle de solicitud, acciones de resolución.
6. **Gestión de cuenta comité**:
   - Crear la cuenta desde el panel admin (`POST /api/admin/operadores` con `rol: "COMITE_VALIDACION"`).
   - Activar, desactivar, regenerar contraseña y reenviar email de bienvenida.
   - Usar acciones de AuditLog propias: `COMITE_CREADO`, `COMITE_ACTIVADO`, `COMITE_DESACTIVADO`, `COMITE_PASSWORD_REGENERADA`, `COMITE_EMAIL_REENVIADO`.
   - Email de bienvenida con mensaje de "comité de validación".
7. **Integrantes del comité**:
   - Tabla `IntegranteComite` con nombres, tipo/número de identificación, email, fechas de vigencia y estado.
   - El número de identificación se cifra antes de guardar y se descifra al leer para un admin.
   - CRUD restringido a admin: crear, listar, actualizar e inactivar integrantes.
   - AuditLog: `COMITE_INTEGRANTE_CREADO`, `COMITE_INTEGRANTE_ACTUALIZADO`, `COMITE_INTEGRANTE_INACTIVADO`.
8. **Notificación por email al comité**:
   - Parámetros `comite.notificaciones.enabled` y `comite.notificaciones.frecuencia_horas`.
   - Al escalar un caso o crear una solicitud, si corresponde, enviar email al comité con la cantidad de casos pendientes.
   - Control de frecuencia: no más de un email por ventana, registrando el último envío en `PerfilOperador.ultimoEmailNotificacionEn`.
9. UI admin para gestionar la cuenta del comité, sus integrantes y sus acciones.
10. Tests unitarios y de integración para cuenta, integrantes, notificación, cifrado/descifrado y login del comité.

## Riesgos mitigados

- Sobrecarga del admin: el comité absorbe escalaciones.
- Conflicto de intereses: el operador no gestiona casos que él escaló.
- Privacidad de datos personales de integrantes: cifrado de identificación en reposo.
- Spam de notificaciones: control de frecuencia parametrizado.

## R7

No aplica: no toca el pipeline de clasificación; solo cambia quién resuelve casos escalados.
