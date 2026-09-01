# Research: Documentos legales públicos limpios (SPEC-343)

## R1 · Render de markdown seguro en el modal

**Decision**: `react-markdown` (v10) + `remark-gfm` (v4), sin `rehype-raw`.

**Rationale**: react-markdown NO interpreta HTML embebido por defecto — lo emite
como texto plano — así que el requisito FR-009 (sin HTML inyectable) se cumple por
construcción, sin sanitizador adicional. `remark-gfm` habilita tablas GFM (los dos
documentos legales dependen de tablas). Compatible con React 19 (v10 declara
soporte). Aprobado por CEO 01-09-2026 01:00. El textmate del documento viene del
servidor (archivo del repo), pero el escape por defecto protege además contra
cualquier documento futuro mal formado.

**Alternatives considered**:
- Parser manual (regex por línea): es lo que existe hoy de facto (split por `\n`);
  reproducir tablas/citas/listas a mano es frágil y ya demostró ser insuficiente.
- `marked` + `dangerouslySetInnerHTML` + DOMPurify: requiere sanitizador explícito
  y abre superficie de error; rechazada.
- `next-mdx-remote`: sobredimensionada (MDX ejecuta componentes; riesgo, no beneficio).

## R2 · Tablas legibles en móvil

**Decision**: override del componente `table` vía prop `components` de
react-markdown: envolver cada tabla en `<div className="overflow-x-auto">` con
estilos de celda compactos (`text-xs`/`text-sm`, `whitespace-normal`).

**Rationale**: FR-010 exige scroll propio de la tabla sin scroll horizontal de
página. El wrapper con `overflow-x-auto` es el patrón Tailwind estándar y no
interfiere con el IntersectionObserver del scroll-hasta-el-final (el sentinel
sigue al final del contenedor vertical).

**Alternatives considered**: `display:block` en la tabla (rompe semántica y
anchos); reformatear las tablas de los documentos a listas (altera el documento
legal; rechazada).

## R3 · Clases `prose` muertas (hallazgo 15v5)

**Decision**: instalar `@tailwindcss/typography` (devDependency) y registrarlo en
`tailwind.config.ts` (`plugins: [typography]`).

**Rationale**: el modal ya declara `prose prose-sm max-w-none dark:prose-invert`
desde SPEC-241, pero `tailwind.config.ts:80` tiene `plugins: []` — las clases no
generan CSS alguno (hallazgo verificado en fuente). Con el plugin, la jerarquía
tipográfica (h1–h3, blockquote, listas, tablas) sale correcta en claro y oscuro
sin escribir CSS a mano, y las clases existentes cobran vida. Alcance del plugin:
solo genera CSS donde se usan clases `prose` — hoy únicamente este modal.

**Alternatives considered**: estilar cada elemento vía `components` de
react-markdown con clases utilitarias (más código, mantiene la deuda de clases
muertas); CSS module (prohibido por convención de estilos del proyecto).

## R4 · Cirugía documental — método

**Decision**: crear los archivos públicos NUEVOS con el contenido limpio
(escritura completa, no sed sobre el original) y mover los originales con
`git mv` a `docs/legal/` sin tocarles un byte.

**Rationale**: el mapa de cortes está fijado línea a línea contra origin/main
(radicado I-232, verificado por Dev PI-2; los 11 `[ABOGADO` del convenio y los
bloques de la política calzaron al 100 %). Escribir el archivo nuevo completo hace
el resultado revisable como documento terminado; `git mv` preserva historia y
cumple "el original NO se borra". La inmutabilidad del original la verifica el
diff del PR (rename puro sin cambios).

**Mapa de cortes — política (v0.4 → v1.0 pública)**:
- QUITAR L2–35 (encabezado interno completo), L92–95, L120–122, L148–149 (bloques
  `[ABOGADO]`), L114 (confirmación de plazos), L165–175 (control del documento).
- REWORD L85 → `**Régimen de autorización:**` · L137 → `## 13. Retención y
  supresión` · L139 → columna `Período de retención`.
- LLENAR L153 → «1 de septiembre de 2026» · L163 → `https://pi.innovadataco.com/politica-datos`.

**Mapa de cortes — convenio (borrador → v1.0 público)** (enumeración 22v5 con
inicio–fin verificados):
- QUITAR L2–26 (encabezado interno: bloques L3–10 y L12–18, tabla L20–24,
  separador), L36–40, L137–140, L168–170, L197–199 (bloques `[ABOGADO]`),
  L185–190 (cláusula Responsabilidad completa) y L214–225 (control del documento).
- RESOLVER inline: L105 → «72 horas» · L164–165 → «30 días calendario» · L183 → «2 años».
- RENUMERAR: «## 14. Ley aplicable…» → 13 · «## 15. Firmas» → 14.
- CONSERVAR campos de plantilla del colegio (`[NOMBRE DEL COLEGIO]`, NIT, domicilio).

## R5 · Test-candado de documentos servidos (FR-011)

**Decision**: test Vitest `src/lib/legal/documentos-servidos.test.ts` que
(1) resuelve las rutas EXACTAS que siembra `prisma/seed.ts` (import de constantes
compartidas o lectura literal de los valores), (2) lee cada archivo del disco y
(3) afirma 0 ocurrencias de `"[ABOGADO"`, `"CERRADO internamente"` y `"BORRADOR"`,
además de que los archivos existen y no están vacíos.

**Rationale**: ata el candado a la fuente de verdad (lo que el seed siembra =
lo que el servicio sirve), no a nombres de archivo escritos dos veces. Corre en
`npm run test` y por tanto en CI: cualquier regresión futura (editar el público
con notas, o re-apuntar el parámetro a un borrador) pone el PR en rojo.

**Alternatives considered**: script shell en CI (no corre en `npm run test`
local); test E2E de la página (más lento y ya cubierto en render por US3).

## R6 · Coreografía seed ↔ BD de producción

**Decision**: el código solo cambia el seed (upsert idempotente ya existente,
patrón I-100). El PR documenta en su descripción:
`consentimiento.padre.documento_ruta`:
`public/legal/POLITICA-TRATAMIENTO-DATOS-v0.4.md` →
`public/legal/POLITICA-TRATAMIENTO-DATOS-v1.0-publica.md` ·
`consentimiento.colegio.documento_ruta`:
`public/legal/CONVENIO-TRATAMIENTO-DATOS-COLEGIOS.md` →
`public/legal/CONVENIO-TRATAMIENTO-DATOS-COLEGIOS-v1.0-publico.md`.

**Rationale**: la BD de producción no se re-siembra; el UPDATE lo ejecuta el CEO
pegado al deploy (ventana de segundos asumida por él, decisión 01-09-2026 01:00).
`consentimiento.version_actual` queda en `v0.4`: `versionEstaActual()` compara
solo la versión, así que nadie re-firma (FR-007, SC-004). El hash de aceptación se
calcula por lectura del documento vigente al aceptar, de modo que las aceptaciones
nuevas registran el documento nuevo sin cambio de código.
