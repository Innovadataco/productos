# Contract: Gestión de miembros del comité

**Feature**: specs/024-comite-validacion
**Base Path**: `/api/admin/operadores`

---

## POST /api/admin/operadores

Crear un empleado interno. Cuando `rol = COMITE_VALIDACION`, se crea `PerfilOperador.esComite = true`.

### Request

```json
{
  "email": "comite@proteccion.local",
  "nombre": "Miembro Comité",
  "rol": "COMITE_VALIDACION",
  "notasInternas": "Especialista en grooming",
  "cupoMaximo": null
}
```

### Response 201

```json
{
  "id": "cmr...",
  "email": "comite@proteccion.local",
  "nombre": "Miembro Comité",
  "rol": "COMITE_VALIDACION",
  "perfil": {
    "esComite": true,
    "esRevisorDeApelaciones": false
  }
}
```

### Response 400 — Exclusividad violada

```json
{
  "error": {
    "message": "OPERADOR y COMITE_VALIDACION son excluyentes",
    "code": "EXCLUSIVIDAD_ROL"
  }
}
```

---

## PATCH /api/admin/operadores/[id]

Editar un empleado. No permite cambiar de `OPERADOR` a `COMITE_VALIDACION` (ni viceversa) sin regenerar el perfil.

### Request

```json
{
  "nombre": "Nuevo nombre",
  "notasInternas": "Actualizado"
}
```

### Response 200

```json
{
  "id": "cmr...",
  "nombre": "Nuevo nombre",
  "perfil": { "esComite": true }
}
```
