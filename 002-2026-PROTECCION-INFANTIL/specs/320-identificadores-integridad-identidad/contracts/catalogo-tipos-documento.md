# Contratos — SPEC-320

## A · Catálogo de tipos de documento (admin · §2.3)

Patrón de endpoints admin ya existente en el proyecto. Rol: `ADMIN`.

### `GET /api/admin/tipos-documento`
Lista el catálogo. Respuesta:
```json
{ "items": [ { "id": "...", "clave": "CC", "nombre": "Cédula de ciudadanía", "categoria": "persona", "esActiva": true } ] }
```

### `POST /api/admin/tipos-documento`
Crea un tipo. Body: `{ "clave": string, "nombre": string, "categoria"?: string }`.
- 201 con el registro creado.
- 409 si la clave ya existe.
- 400 si falta clave o nombre.

### `PATCH /api/admin/tipos-documento/[id]`
Edita nombre/categoría o activa/desactiva. Body parcial: `{ "nombre"?, "categoria"?, "esActiva"? }`.
- 200 con el registro.
- 404 si no existe.

**Lectura para formularios** (los tres sujetos): endpoint/consulta que devuelve solo `esActiva = true`, para poblar los selects de estudiante, profesor y comité desde la misma fuente.

## B · Alta/edición de identificador — warn de unicidad cross-sujeto (§2.1)

Aplica a los 8 callsites de identificador (estudiante/profesor/acudiente · alta/edición · carga masiva/unificada).

### Comportamiento
1. Se calcula `valorNormalizado` (helper existente `normalizarIdentificador`).
2. **Protección dura de BD**: si la tupla exacta ya existe en el mismo sujeto dentro del colegio → 409 (`Identificador duplicado`). Conservado.
3. **Cruce cross-sujeto (warn)**: si `valorNormalizado` está en **otra persona** del mismo colegio (cualquiera de los tres sujetos) y el cliente **no** envió confirmación de override → respuesta de aviso, **no** error:
```json
{
  "aviso": {
    "code": "IDENTIFICADOR_EN_USO_EN_COLEGIO",
    "message": "Este identificador ya está registrado para otra persona del colegio.",
    "pertenece": [ { "nombre": "Juan Pérez", "rol": "Estudiante" } ]
  }
}
```
   - HTTP 200 con `aviso` (o 409 con un flag distinguible; **decisión de implement**: recomendación = 200 + `aviso` para que el front lo trate como confirmación, no como error duro).
4. **Override**: el cliente reintenta con `{ ..., confirmarCompartido: true }`. El sistema crea/edita el identificador y registra en `AuditLog` la decisión de override con a quién pertenecía (FR-018).

### Notas
- Entre colegios distintos: sin aviso (aislamiento por tenant). La consulta cross-sujeto SIEMPRE lleva `colegioId`.
- La búsqueda cross-**tenant** de `alertas.ts` (`buscarActivosPorValor`) es un flujo distinto y NO se toca.
- El servicio central `identificador-unicidad.ts` es el único lugar que hace la consulta cross-sujeto; los 8 callsites lo invocan (candado 22 v5: un solo lugar).

## C · Alta de profesor con identidad (§2.2)

### `POST /api/colegio/profesores`
Body ahora obligatorio: `{ nombre, apellidos, tipoDocumento, numeroDocumento, anioNacimiento, sexo, telefono, email }`.
- 400 si falta cualquier campo de identidad (mensaje humano del primer campo faltante, patrón `withValidation.body` existente).
- 409 si `(colegioId, tipoDocumento, numeroDocumento)` ya existe → "Ya existe un profesor con ese documento en el colegio".
- 409 (conservado) si nombre+apellidos duplicado activo — ahora con comparación normalizada (insensible a mayúsculas/acentos).
- 201 con el profesor creado + `AuditLog`.
