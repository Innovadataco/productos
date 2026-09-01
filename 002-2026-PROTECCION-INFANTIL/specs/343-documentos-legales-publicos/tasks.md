# Tasks: Documentos legales públicos limpios (SPEC-343)

**Input**: Design documents from `specs/343-documentos-legales-publicos/`
**Prerequisites**: plan.md, research.md (mapa de cortes R4), data-model.md, quickstart.md

**Tests**: la spec los exige (FR-011, FR-012) — incluidos.

**Organization**: tareas agrupadas por user story; cada historia es un incremento
verificable por sí solo. Rutas relativas a `002-2026-PROTECCION-INFANTIL/`.

## Phase 1: Setup

- [x] T001 Instalar dependencias aprobadas: `npm install react-markdown remark-gfm` y `npm install -D @tailwindcss/typography` (actualiza package.json y package-lock.json; verificar que react-markdown quede en v10.x con soporte React 19)
- [x] T002 Registrar el plugin de tipografía en tailwind.config.ts (`plugins: [require("@tailwindcss/typography")]` o import equivalente tipado) — revive las clases `prose` muertas del modal (research R3)

**Checkpoint**: `npm run build` sigue verde con las dependencias nuevas.

## Phase 2: Foundational

*(Sin foundational bloqueante más allá del setup: no hay schema, endpoints ni
servicios nuevos. Las historias arrancan directo.)*

## Phase 3: User Story 1 — Política pública limpia (P1) 🎯 MVP

**Goal**: existe `public/legal/POLITICA-TRATAMIENTO-DATOS-v1.0-publica.md` limpia,
con fecha y URL reales.

**Independent Test**: grep de marcadores internos sobre el archivo nuevo = 0;
diff estructural contra v0.4 = solo los cortes/rewords/llenados del mapa R4.

- [x] T003 [US1] Crear public/legal/POLITICA-TRATAMIENTO-DATOS-v1.0-publica.md desde el v0.4 aplicando el mapa R4 EXACTO: quitar L2–35, L92–95, L114, L120–122, L148–149, L165–175; reword L85 → `**Régimen de autorización:**`, L137 → `## 13. Retención y supresión`, L139 → columna `Período de retención`; llenar L153 → «1 de septiembre de 2026», L163 → `https://pi.innovadataco.com/politica-datos`
- [x] T004 [US1] Verificar la política pública contra FR-001/FR-002/FR-003: 0 marcadores internos (`grep -c "\[ABOGADO\|CERRADO internamente\|BORRADOR"` = 0), secciones sustantivas 1–14 + Aviso de Privacidad íntegras, sin `[FECHA…]`/`[URL…]` (documentar el resultado del grep en el commit)

**Checkpoint**: la política pública es un documento terminado y auditable.

## Phase 4: User Story 2 — Convenio público limpio (P1)

**Goal**: existe `public/legal/CONVENIO-TRATAMIENTO-DATOS-COLEGIOS-v1.0-publico.md`
limpio, con plazos resueltos y cláusulas 1–14 continuas.

**Independent Test**: grep de marcadores internos = 0; numeración continua;
plazos «72 horas» / «30 días calendario» / «2 años» presentes sin corchetes.

- [x] T005 [P] [US2] Crear public/legal/CONVENIO-TRATAMIENTO-DATOS-COLEGIOS-v1.0-publico.md desde el borrador aplicando el mapa R4 EXACTO: quitar L2–26, L36–40, L137–140, L168–170, L197–199, L185–190 (cláusula Responsabilidad completa) y L214–225; resolver inline L105 → «72 horas», L164–165 → «30 días calendario», L183 → «2 años»; renumerar Ley aplicable 14→13 y Firmas 15→14; conservar campos de plantilla del colegio (`[NOMBRE DEL COLEGIO]`, NIT, domicilio)
- [x] T006 [US2] Verificar el convenio público contra FR-004/FR-005: 0 marcadores internos, cláusulas numeradas 1–14 sin saltos, 3 plazos concretos, campos de plantilla intactos (documentar el grep en el commit)

**Checkpoint**: ambos documentos públicos listos — se puede demostrar el contenido
aunque el render siga crudo.

## Phase 5: User Story 3 — Render markdown real y seguro (P2)

**Goal**: el modal renderiza títulos, negritas, citas, listas y tablas; HTML
escapado; tablas con scroll propio en móvil; scroll-final intacto.

**Independent Test**: `npm run test -- ModalConsentimiento` en verde con los casos
nuevos (formato, escape de HTML, tabla envuelta, sentinel del scroll-final).

- [x] T007 [US3] Reemplazar en src/components/modules/ModalConsentimiento.tsx el render por líneas (L131–135) por `<ReactMarkdown remarkPlugins={[remarkGfm]} components={...}>`: sin rehype-raw (HTML escapado por defecto, FR-009); override `table` envuelta en `<div className="overflow-x-auto">` con celdas compactas (FR-010, research R2); mantener contenedor `prose prose-sm max-w-none dark:prose-invert`, el div sentinel `finalRef` al final del scroll y el contrato de props sin cambios
- [x] T008 [US3] Actualizar src/components/modules/ModalConsentimiento.test.tsx: casos nuevos — `## Título` renderiza `<h2>` (no texto con `#`), `**negrita**` renderiza `<strong>`, tabla GFM renderiza `<table>` dentro de contenedor con overflow, `<script>alert(1)</script>` aparece como texto y no como nodo script, tabla malformada renderiza degradada como texto sin lanzar error, y el botón «Acepto» sigue deshabilitado hasta intersecar el sentinel (FR-012); conservar los casos existentes de SPEC-241

**Checkpoint**: modal legible y seguro con cualquier documento markdown.

## Phase 6: User Story 4 — Borradores internos fuera de la web (P2)

**Goal**: originales intactos en `docs/legal/`; `public/legal/` solo con los
públicos limpios.

**Independent Test**: `ls public/legal/` = 2 archivos v1.0; `git diff --stat` del
PR muestra renames puros (100% similarity) para los dos originales.

- [x] T009 [US4] Mover los originales con historia y sin modificarlos: `git mv public/legal/POLITICA-TRATAMIENTO-DATOS-v0.4.md docs/legal/POLITICA-TRATAMIENTO-DATOS-v0.4.md` y `git mv public/legal/CONVENIO-TRATAMIENTO-DATOS-COLEGIOS.md docs/legal/CONVENIO-TRATAMIENTO-DATOS-COLEGIOS.md` (crear docs/legal/); verificar rename puro en `git status`/diff (FR-006)

**Checkpoint**: fuga por URL directa cerrada en el árbol del repo.

## Phase 7: User Story 5 — Parámetros, servicio y test-candado (P3)

**Goal**: el sistema sirve los documentos nuevos; nadie re-firma; candado de CI
contra regresiones de contenido.

**Independent Test**: `npm run test` verde incluyendo el test-candado y los tests
de servicio/route con rutas nuevas; `npm run db:seed` deja los parámetros nuevos y
`consentimiento.version_actual` = `v0.4`.

- [x] T010 [P] [US5] Actualizar prisma/seed.ts: `consentimiento.padre.documento_ruta` → `public/legal/POLITICA-TRATAMIENTO-DATOS-v1.0-publica.md` (L173–175) y `consentimiento.colegio.documento_ruta` → `public/legal/CONVENIO-TRATAMIENTO-DATOS-COLEGIOS-v1.0-publico.md` (L180–182); `consentimiento.version_actual` NO se toca (FR-007)
- [x] T011 [P] [US5] Actualizar src/lib/consentimiento-test-utils.ts (L23–27, L36–40) a las dos rutas públicas nuevas
- [x] T012 [US5] Actualizar src/app/api/consentimiento/aceptar/route.test.ts:80 — hash esperado calculado sobre public/legal/POLITICA-TRATAMIENTO-DATOS-v1.0-publica.md; correr la suite de consentimiento completa (route + servicio + guard + page) y dejarla verde (candado 24v2: tests de todo lo que toca lo editado)
- [x] T013 [US5] Crear src/lib/legal/documentos-servidos.test.ts (test-candado FR-011, research R5): resuelve las MISMAS rutas que siembra prisma/seed.ts, afirma que ambos archivos existen, no están vacíos y contienen 0 ocurrencias de `"[ABOGADO"`, `"CERRADO internamente"` y `"BORRADOR"`; caso adicional: los valores sembrados apuntan bajo `public/legal/`

**Checkpoint**: flujo completo consistente de seed a render; CI protege el candado.

## Phase 8: Polish & Cierre

- [x] T014 Gate de calidad completo: `npx tsc --noEmit` + `npm run lint` + `npm run test` + `npm run build` + `npm run arch:check` (regla de oro: verde obligatorio)
- [x] T015 Deploy limpio local `./scripts/dev-restart.sh` + recorrido real del quickstart.md §4 (PARENT, SCHOOL_ADMIN, móvil 375 px, usuario ya aceptado, 404 del borrador viejo) — evidencia para el cierre
- [x] T016 [P] Disciplina de specs: fila de SPEC-343 en specs/README.md, sección «Impacto en arquitectura:» en spec.md (ninguno: sin schema/proxy/navegación/stack) y Status del encabezado a IMPLEMENTADO
- [x] T017 Documentar cierre en specs/343-documentos-legales-publicos/cierre.md: evidencia del gate, del recorrido, deuda técnica (cláusula Responsabilidad pendiente de ronda jurídica — se restituye cuando el abogado la redacte) y la tabla ruta vieja → ruta nueva de los DOS parámetros para el UPDATE del CEO en prod (research R6); commits: uno por user story + uno de docs

## Dependencies & Execution Order

- Setup (T001–T002) → todo lo demás.
- US1 (T003–T004) y US2 (T005–T006): independientes entre sí ([P] posible), solo
  requieren Setup. **MVP = US1**.
- US3 (T007–T008): independiente de US1/US2 (solo Setup). Puede ir en paralelo.
- US4 (T009): requiere US1+US2 terminadas (los públicos deben existir antes de
  vaciar los internos de public/, para no dejar la carpeta sin documentos).
- US5 (T010–T013): requiere US1+US2 (rutas nuevas deben existir); T010/T011 en
  paralelo; T012 tras T011; T013 tras T010.
- Polish (T014–T017): al final; T016 en paralelo con T017.

**Parallel example**: tras T002, un solo dev alterna: T003+T005 (documentos),
luego T007 mientras corre la suite, T009, T010/T011 juntos. Agentes de
verificación cruzada pueden auditar T004/T006 contra el mapa R4 en paralelo.

## Implementation Strategy

MVP primero (US1: la política es lo que ve el padre — la audiencia masiva), luego
US2 (colegios), US3 (render), US4 (mudanza), US5 (cableado + candado), cierre.
Un commit por user story + uno de docs (regla de cierre 2). El orden de commits
mantiene el árbol siempre consistente: los documentos públicos entran antes de
que el seed los apunte y antes de mover los originales.
