> # Quickstart — Rol Comité de Validación + escalamiento

## Escenario A: Admin crea un usuario de comité

**Prerrequisitos**: Admin autenticado.

1. Llamar `POST /api/admin/operadores` con:
```json
{
  "email": "comite@proteccion.local",
  "nombre": "Miembro Comité",
  "rol": "COMITE_VALIDACION",
  "notasInternas": "Especialista en contenido"
}
```

**Validación**: Usuario creado con rol `COMITE_VALIDACION` y `PerfilOperador.esComite = true`.

**Esperado**: `201`; exclusividad respetada.

---

## Escenario B: Intento inválido de crear operador con esComite=true

**Prerrequisitos**: Admin autenticado.

1. Llamar `POST /api/admin/operadores` con `rol = OPERADOR` y forzar `esComite = true`.

**Validación**: Respuesta `400` con mensaje "OPERADOR y COMITE_VALIDACION son excluyentes".

**Esperado**: La base de datos no permite la combinación.

---

## Escenario C: Operador escala un caso al comité

**Prerrequisitos**: Reporte en `REVISION_MANUAL` asignado a un OPERADOR.

1. Operador abre detalle del caso.
2. Operador selecciona "Escalar a comité" y escribe motivo.
3. Sistema crea `SolicitudComite` en estado `PENDIENTE` con número interno `SOL-XXXXXX`.
4. Reporte pasa a `REVISION_MANUAL` con `operadorId = null` y `comiteId = null` (pool del comité).

**Validación**: `POST /api/admin/reportes/[id]/escalar` retorna `201` con `numeroSolicitud`.

**Esperado**: La solicitud aparece en la bandeja del comité.

---

## Escenario D: Comité ve solicitudes pendientes

**Prerrequisitos**: Miembro del comité logueado; existe solicitud `PENDIENTE`.

1. Llamar `GET /api/admin/comite/pendientes`.

**Validación**: Lista de solicitudes `PENDIENTE` sin `comiteId` asignado.

**Esperado**: `200`; solo ven solicitudes no asignadas.

---

## Escenario E: Comité se auto-asigna una solicitud

**Prerrequisitos**: Miembro del comité logueado; solicitud `PENDIENTE`.

1. Llamar `POST /api/admin/comite/[id]/asignar`.

**Validación**:
- `estado` pasa a `ASIGNADA`.
- `comiteId` = id del miembro que se asignó.
- `Reporte.comiteId` se actualiza con el mismo valor.

**Esperado**: `200`; el caso queda trabado con ese miembro.

---

## Escenario F: Comité resuelve clasificando un caso

**Prerrequisitos**: Solicitud `ASIGNADA` a un miembro del comité.

1. Miembro del comité abre el detalle.
2. Selecciona categoría final y resuelve.
3. Llamar `POST /api/admin/comite/[id]/resolver` con:
```json
{
  "accion": "CLASIFICAR",
  "categoria": "SOLICITUD_ENCUENTRO",
  "resolucion": "El contenido describe solicitud de encuentro explícita"
}
```

**Validación**:
- Reporte pasa a `CLASIFICADO`.
- `SolicitudComite.estado` = `RESUELTA`.
- Se registra transición en `TransicionReporte` con `responsableTipo: COMITE`.

**Esperado**: `200`; caso cerrado.

---

## Escenario G: Comité resuelve corrigiendo categoría

**Prerrequisitos**: Solicitud `ASIGNADA`; reporte tenía clasificación previa.

1. Llamar `POST /api/admin/comite/[id]/resolver` con `accion = CORREGIR`.

**Validación**:
- Reporte pasa a `CORREGIDO`.
- Se crea registro en `CorreccionAdmin` (o tabla equivalente) con el comité como responsable.

**Esperado**: `200`.

---

## Escenario H: Admin reasigna solicitud a otro miembro del comité

**Prerrequisitos**: Solicitud `ASIGNADA` a un comité; el comité original no atiende.

1. Admin llama `POST /api/admin/comite/[id]/reasignar` con `nuevoComiteId`.

**Validación**:
- `comiteId` cambia al nuevo miembro.
- Se registra en `AuditLog` acción `CASO_REASIGNADO`.

**Esperado**: `200`.

---

## Escenario I: No hay comité activo

**Prerrequisitos**: Sin miembros del comité dados de alta o todos inactivos.

1. Operador intenta escalar un caso.

**Validación**: El sistema permite crear la solicitud `PENDIENTE` pero muestra advertencia: "No hay miembros del comité activos para atender esta solicitud".

**Esperado**: `201` con advertencia; el caso queda en pool pendiente.
