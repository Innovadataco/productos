# Contract: Consentimiento informado (SPEC-241)

**Base Path**: `/api/consentimiento`, `/consentimiento`

---

## GET /consentimiento (página)

Server Component que verifica sesión, comprueba si el usuario ya aceptó la versión vigente y, de ser necesario, renderiza `ModalConsentimiento` con el documento correspondiente al rol.

**Requiere**: cookie `token` o `__Host-token` válida.

**Comportamiento**:

- Sin token válido → redirige a `/login`.
- Token válido y `consentimientoVersion == parametro.consentimiento.version_actual` → redirige al dashboard del rol.
- Token válido y versión desactualizada/nula → renderiza modal con documento vigente.

**Documento por rol**:

| Rol | Tipo de documento | Archivo parametrizado |
|-----|-------------------|-----------------------|
| `PARENT` | `POLITICA_DATOS` | `consentimiento.padre.documento_ruta` |
| `ADMIN`, `OPERADOR`, `COMITE_VALIDACION` | `POLITICA_DATOS` | `consentimiento.padre.documento_ruta` |
| `SCHOOL_ADMIN`, `COMITE_CONVIVENCIA` | `CONVENIO_INSTITUCIONAL` | `consentimiento.colegio.documento_ruta` |

---

## POST /api/consentimiento/aceptar

Registra la aceptación del consentimiento informado con hash SHA256 del documento y traza inmutable.

**Requiere**: cookie `token` o `__Host-token` válida.

**Request Body**:

```json
{
  "documentoTipo": "POLITICA_DATOS | CONVENIO_INSTITUCIONAL",
  "esRepresentanteLegal": true
}
```

**Validación**:

- `documentoTipo` debe ser uno de los valores permitidos.
- `esRepresentanteLegal` debe ser booleano.
- Cualquier otro campo es rechazado (`.strict()`).
- El servidor ignora cualquier `version` enviada por el cliente.

**Proceso**:

1. Verifica sesión (`verifyAuth`).
2. Valida body con Zod.
3. Si el usuario ya aceptó la versión vigente → retorna `200` sin duplicar.
4. Lee el documento vigente desde la ruta parametrizada.
5. Calcula `SHA256(documento)`.
6. En transacción:
   - Crea fila en `AuditConsentimiento`.
   - Actualiza `Usuario.consentimientoAceptadoEn/Version/DocumentoHash/IP`.
7. Programa evento `consentimiento.aceptado` (EMAIL + IN_APP) de forma best-effort.
8. Escribe `AuditLog` con metadatos de la aceptación.

**Response 201**:

```json
{
  "ok": true,
  "version": "v0.4",
  "usuario": {
    "id": "string",
    "consentimientoVersion": "v0.4",
    "consentimientoAceptadoEn": "2026-08-25T05:40:00.000Z"
  }
}
```

**Response 200** (idempotencia):

```json
{
  "ok": true,
  "version": "v0.4"
}
```

**Response 400**: Body inválido (`documentoTipo` no permitido, campos extra, etc.).  
**Response 401**: Sin sesión.  
**Response 500**: Error interno (versión no configurada, documento no disponible, fallo de BD).

**Headers de auditoría**:

- `x-forwarded-for` → `AuditConsentimiento.ip` (primera IP de la lista).
- `user-agent` → `AuditConsentimiento.userAgent`.

---

## Guardia de consentimiento en layouts

Función `requiereConsentimientoActual(usuarioId)` (`src/lib/consentimiento/guard.ts`) compara `Usuario.consentimientoVersion` con `consentimiento.version_actual`.

**Aplicada en**:

- `src/app/dashboard/layout.tsx` (rol `PARENT`)
- `src/app/dashboard/padre/layout.tsx`
- `src/app/dashboard/colegio/layout.tsx`
- `src/app/dashboard/admin/layout.tsx`

**Comportamiento**:

- Si la versión no coincide → `redirect("/consentimiento")`.
- Si no hay versión configurada o falla la consulta → **fail-open**: no bloquea (log de error).

**Rutas excluidas implícitamente**:

- Endpoints bajo `/api` no pasan por layouts de dashboard.
- `/logout` y rutas públicas (`/registro`, `/consulta`, `/reportar`) no tienen guardia.
