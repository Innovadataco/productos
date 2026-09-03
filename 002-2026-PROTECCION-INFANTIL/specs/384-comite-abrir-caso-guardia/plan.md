# Plan · SPEC-384 · el comité no puede abrir ningún caso

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-03 · **Dev**: Guardianes (PI-1)

## Decisiones

**OR, no sustitución.** La primera lectura fue reemplazar `bandeja_reportes` por `comite_bandeja` según el rol. El CEO corrigió el alcance a mitad del arreglo: mejor aceptar cualquiera de los dos, sin que la ruta sepa el mapeo rol→módulo. Un rol futuro con ambos módulos entrará por cualquiera; un rol que pierde uno solo pierde ese, no toda la ruta. Y no obliga a activarle al comité el módulo del operador para funcionar — I-274 se mantiene.

**Helper compartido, no lógica inline.** Poner el chequeo OR inline en los dos routes subía la complejidad ciclomática por encima del ratchet (23 > 20). `assertAnyModulo` en `permisos-modulos.ts` deja los routes cortos y comparte el patrón para futuros endpoints multi-rol. Un solo lugar donde cambia si algún día se agrega un tercer módulo.

**No tocar los endpoints de acción.** `clasificar`, `confirmar` y `reasignar` no aparecen en el fetch del comité (`ComiteSolicitudDetalle.tsx:83` solo llama al detalle). Además el propio código los limita a `esAdminRol(user.rol) || user.rol === "OPERADOR"`. Abrirlos rompería I-274 sin ganar nada.

**Test extra de candado 26.** El CEO pidió tests explícitos de que el comité no puede clasificar/confirmar/reasignar. Antes de tocar un guardia hay que probar que otro guardia sigue. Archivo dedicado — `comite-candado26.spec-384.test.ts` — con los tres 403 en un lugar identificable.

**Reproducir el estado de prod en los tests.** `otorgarTodosLosPermisos` en el helper de tests activa todos los módulos para todos los roles. Sin bajar `bandeja_reportes` para `COMITE_VALIDACION`, el test pasaría igual con o sin el fix. Cada test I-278 empieza con `desactivarBandejaReportesParaComite()` para reproducir el estado real.

**En I-279, dos estados de error, no uno con banderas.** Alternativa: un estado `error` con un discriminador `{tipo: "lista"|"accion", mensaje}`. Peor: obligaba a leer y setear el discriminador en varios lugares. Dos primitivas separadas leen mejor y permiten limpiar cada una en el momento correcto (`errorAccion` se limpia al abrir un caso nuevo, `errorLista` al reintentar la carga).

**Al abrir un caso nuevo se limpia `errorAccion`.** Si el segundo intento funciona, el banner se va. Con un solo `error` compartido esto pasaba también, pero por accidente; con dos estados es explícito.

## Archivos

- `src/lib/permisos-modulos.ts` — helper `assertAnyModulo` nuevo.
- `src/app/api/admin/reportes-revision/route.ts` — LISTA: `assertAnyModulo(["bandeja_reportes","comite_bandeja"])`.
- `src/app/api/admin/reportes-revision/route.test.ts` — 1 test nuevo I-278 (lista + comité vencido).
- `src/app/api/admin/reportes-revision/[id]/route.ts` — DETALLE: idem.
- `src/app/api/admin/reportes-revision/[id]/route.test.ts` — 2 tests nuevos I-278 (asignado→200, no-asignado→403 con mensaje de autorización fina).
- `src/app/api/admin/reportes-revision/comite-candado26.spec-384.test.ts` — 3 tests nuevos candado 26.
- `src/components/modules/ComiteBandeja.tsx` — split de `error` en `errorLista`/`errorAccion` + segundo banner con el mensaje real.
- `src/components/modules/ComiteBandeja.test.tsx` — 1 test nuevo I-279 (mensaje real llega a pantalla).
