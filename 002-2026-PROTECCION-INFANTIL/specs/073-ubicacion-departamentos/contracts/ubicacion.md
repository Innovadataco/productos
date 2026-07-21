# Contracts: Ubicación (País / Departamento / Ciudad)

**Status**: No endpoint changes in Spec 073. Existing contracts are maintained.

This file documents the current contracts for reference. No new endpoints are added, and no existing request/response shapes change in this phase.

---

## `GET /api/paises`

**Auth**: Public (no authentication required).

**Response 200**:
```json
{
  "paises": [
    { "id": "cuid-1", "codigo": "CO", "nombre": "Colombia" }
  ]
}
```

**Notes**: Unaffected by Spec 073. `Departamento` is not exposed in this phase.

---

## `GET /api/ciudades?paisId=...`

**Auth**: Public (no authentication required).

**Query parameters**:

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `paisId` | string | yes | ID del país |

**Response 200**:
```json
{
  "ciudades": [
    { "id": "cuid-1", "nombre": "Bogotá", "paisId": "cuid-pais" }
  ]
}
```

**Notes**: Unaffected by Spec 073. The response continues to include the virtual option `{ id: "otra", nombre: "Otra ciudad o municipio", paisId }`. `departamentoId` is not included in this phase.

---

## No changes for Spec 073

- No new endpoints.
- No changes to request/response shapes.
- `Departamento` is not exposed via API in this phase.

Future phases may add:
- `GET /api/departamentos?paisId=...`
- Department selector in report/colegio flows.
- City filtering by department.
