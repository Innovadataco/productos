# Plan · SPEC-815

## Enfoque

1. **Fuente única de enmascarado** (`src/lib/mask-email.ts`) — el motivo por el que los 2 sitios «se
   escaparon» es que `maskEmail` vivía inline. Se extrae y se usa en los sitios con correo.
2. **Enmascarar correos** en los 5 sitios de emisión de servidor con correo (2 del mapa + 3 que el candado
   destapó). `identificador` → `reporte.id` en los 2 (3) sitios latentes.
3. **Logger serializa errores** (`safeErrorMessage`): args Error (incl. anidados) + las ~21 interpolaciones
   de error crudo (`${err.message}`/`${String(err)}`) → `safeErrorMessage(err)`, uniforme.
4. **Candado** (A runtime @ `LOG_LEVEL=debug` + B lexer estático), RED-first con violación multi-línea.

## Verificación

- `LOG_LEVEL=debug` en el runtime del candado (no el de prod) — no certificar la coincidencia.
- Lexer que respeta strings/templates (multi-línea + `)` dentro de template).
- `${safeErrorMessage(err)}` VERDE; `${err.message}`/`${String(err)}` ROJOS (no es «prohibir interpolar»).
- El candado es el DETECTOR: se corrió, listó todos los sitios, se arreglaron, hasta VERDE.

## Merge

815 es rama off `main` (no apilada sobre otra PR). Con main movido por merges `--squash`, se ramifica
limpio de `origin/main` y se cherry-pickea el commit de 815 (evita conflictos fantasma del squash).

## Gate antes de cerrar

`tsc` 0 · `lint` (0 errores) · candado @ debug VERDE + RED-first · `arch:check` VERDE · `test:unit`.
