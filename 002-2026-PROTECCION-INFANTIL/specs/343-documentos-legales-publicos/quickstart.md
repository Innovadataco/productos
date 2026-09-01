# Quickstart: Documentos legales públicos limpios (SPEC-343)

Guía de validación de punta a punta. Prerrequisitos: `.env` configurado, BD
Docker arriba (`docker compose up -d db`), `npm install` hecho (trae
react-markdown, remark-gfm y @tailwindcss/typography).

## 1. Gate de calidad

```bash
npx tsc --noEmit && npm run lint && npm run test && npm run build
```

Esperado: todo verde. Incluye el test-candado
(`src/lib/legal/documentos-servidos.test.ts`), el render nuevo del modal y los
tests de servicio/route con las rutas nuevas.

## 2. Candado de contenido (manual, 10 segundos)

```bash
grep -c "\[ABOGADO\|CERRADO internamente\|BORRADOR" public/legal/*.md ; ls public/legal/ docs/legal/
```

Esperado: `grep` termina sin coincidencias (exit 1, conteo 0 en ambos archivos);
`public/legal/` tiene SOLO los dos `*-v1.0-*.md`; `docs/legal/` tiene los dos
originales intactos.

## 3. Seed y datos

```bash
npm run db:seed
docker exec 002-2026-proteccion-infantil-db-1 psql -U proteccion -d proteccion_infantil -c "SELECT clave, valor FROM \"ParametroSistema\" WHERE clave LIKE 'consentimiento.%';"
```

Esperado: `padre.documento_ruta` → `...v1.0-publica.md` · `colegio.documento_ruta`
→ `...v1.0-publico.md` · `version_actual` → `v0.4` (SIN cambio).

## 4. Recorrido real en navegador

```bash
./scripts/dev-restart.sh
```

1. Usuario PARENT sin consentimiento → `http://localhost:5005/consentimiento`:
   - Documento con títulos/negritas/citas/tablas renderizados (cero `#`, `**`, `|`, `>` crudos).
   - Cero "[ABOGADO", "CERRADO internamente", "BORRADOR".
   - Vigencia: «1 de septiembre de 2026» y URL `https://pi.innovadataco.com/politica-datos`.
   - El botón «Acepto» se habilita SOLO al llegar al final; aceptar redirige y
     registra la aceptación.
2. Usuario SCHOOL_ADMIN sin consentimiento → mismo recorrido con el convenio:
   cláusulas 1–14 continuas, plazos «72 horas» / «30 días calendario» / «2 años».
3. Móvil (DevTools 375 px): tablas se desplazan dentro de su contenedor; sin
   scroll horizontal de página; scroll-final sigue funcionando.
4. Usuario que YA había aceptado antes del cambio → navega normal, NO ve el modal.
5. Fuga cerrada: `http://localhost:5005/legal/POLITICA-TRATAMIENTO-DATOS-v0.4.md`
   → 404. Los públicos nuevos sí responden en `/legal/*-v1.0-*.md`.

## 5. Verificación de arquitectura

```bash
npm run arch:check
```

Esperado: VERDE (sin cambios de schema/proxy/navegación/stack).

## Post-deploy (lo ejecuta el CEO, referencia)

UPDATE de `consentimiento.padre.documento_ruta` y
`consentimiento.colegio.documento_ruta` en BD prod a los valores nuevos
(tabla exacta en [data-model.md](data-model.md)), pegado al deploy.
`consentimiento.version_actual` NO se toca.
