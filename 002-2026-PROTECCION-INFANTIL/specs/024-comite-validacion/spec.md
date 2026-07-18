# Spec 024 — Rol Comité de Validación + escalamiento

> Estado: **EN DISEÑO**.
> Plan: [`plan.md`](plan.md).

## Alcance

Agregar el rol `COMITE_VALIDACION` al sistema, con flujo de escalamiento desde OPERADOR hacia el comité. El comité es el último eslabón: no escala al admin, resuelve y cierra.

## Decisiones

- Extender `RolUsuario` con `COMITE_VALIDACION`.
- Reutilizar el patrón de `PerfilOperador` para crear `PerfilComite` (o extender `PerfilOperador` con flag `esComite`). Se evaluará en el plan cuál opción es menos invasiva.
- El operador escala al comité con un número de solicitud interno distinto al `RPT-` del usuario.
- El comité resuelve: clasifica o corrige, y el reporte pasa a `CLASIFICADO`/`CORREGIDO`.
- El comité está sujeto a las mismas reglas de privacidad que el operador (Spec 025): no ve quién reportó.
- Hoy `CASO_ESCALADO` va al admin; se redirige al pool del comité.

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

## Riesgos mitigados

- Sobrecarga del admin: el comité absorbe escalaciones.
- Conflicto de intereses: el operador no gestiona casos que él escaló.

## R7

No aplica: no toca el pipeline de clasificación; solo cambia quién resuelve casos escalados.
