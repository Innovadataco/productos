# Data Model: Documentos legales públicos limpios (SPEC-343)

Sin cambios de schema Prisma. Sin migraciones. El "modelo de datos" de esta spec
son archivos versionados en el repo + dos valores de `ParametroSistema`.

## Entidades

### Documento legal público (archivo en repo, servido)

| Atributo | Valor |
|---|---|
| Política | `public/legal/POLITICA-TRATAMIENTO-DATOS-v1.0-publica.md` |
| Convenio | `public/legal/CONVENIO-TRATAMIENTO-DATOS-COLEGIOS-v1.0-publico.md` |
| Invariante | 0 ocurrencias de `"[ABOGADO"`, `"CERRADO internamente"`, `"BORRADOR"` (FR-011) |
| Invariante | La política declara fecha real (2026-09-01) y URL real; sin `[FECHA…]`/`[URL…]` |
| Invariante | El convenio numera cláusulas 1–14 continuas; plazos 72 h / 30 días / 2 años resueltos |
| Consumidores | `ConsentimientoService.obtenerDocumentoVigente()` (lectura de disco vía ruta parametrizada) · servido estático por Next en `/legal/*` |

### Borrador interno (archivo en repo, NO servido)

| Atributo | Valor |
|---|---|
| Política v0.4 | `docs/legal/POLITICA-TRATAMIENTO-DATOS-v0.4.md` (git mv, byte a byte igual) |
| Convenio | `docs/legal/CONVENIO-TRATAMIENTO-DATOS-COLEGIOS.md` (git mv, byte a byte igual) |
| Invariante | Fuera de `public/` → inaccesible por URL. Contenido inmutable (rename puro en el diff) |

### ParametroSistema (filas existentes, solo cambia `valor` sembrado)

| Clave | Valor viejo | Valor nuevo |
|---|---|---|
| `consentimiento.padre.documento_ruta` | `public/legal/POLITICA-TRATAMIENTO-DATOS-v0.4.md` | `public/legal/POLITICA-TRATAMIENTO-DATOS-v1.0-publica.md` |
| `consentimiento.colegio.documento_ruta` | `public/legal/CONVENIO-TRATAMIENTO-DATOS-COLEGIOS.md` | `public/legal/CONVENIO-TRATAMIENTO-DATOS-COLEGIOS-v1.0-publico.md` |
| `consentimiento.version_actual` | `v0.4` | **NO CAMBIA** (nadie re-firma) |

Producción: UPDATE manual del CEO pegado al deploy (fuera del código; el PR lo
documenta con la tabla anterior).

## Estados y transiciones

Sin estados nuevos. Flujo de aceptación intacto (SPEC-241):
`versionEstaActual()` compara `Usuario.consentimientoVersion` con
`consentimiento.version_actual` → como la versión no cambia, los aceptados siguen
al día. Aceptaciones NUEVAS: `aceptar()` lee el documento vigente (ruta nueva),
calcula SHA-256 del contenido nuevo y lo persiste en `AuditConsentimiento`
(inmutable). Las filas históricas con hash del borrador viejo permanecen intactas
como evidencia de lo que cada usuario leyó.

## Relación de render (UI)

`src/app/consentimiento/page.tsx` (server) → `obtenerDocumentoVigente(tipo)` →
string markdown → prop `documentoContenido` → `ModalConsentimiento` (client) →
react-markdown (+ remark-gfm, componentes con tabla envuelta en `overflow-x-auto`)
→ DOM. HTML embebido: escapado (nunca `rehype-raw`). Contrato de props del modal:
sin cambios.
