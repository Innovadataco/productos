# Plan · SPEC-721 · La plataforma pasa a obligatoria

## Estructura de entrega

Una sola PR off `origin/main` con **las dos mitades**: la del servidor (Datos, #663, cherry-pick que preserva su autoría) y la de la pantalla (Dev 1). Entran juntas — un servidor más estricto que la pantalla es un error que el padre no puede resolver. #663 queda absorbida por esta PR.

## Servidor (Datos, cherry-pick de #663)

- `src/lib/dal/services/hijos/identificador-schema.ts` — `camposIdentificadorEntrada`: `plataformaId` obligatorio (`min(1)`, mensaje «Elige la plataforma de la cuenta.»). Fuente única para las dos puertas.
- `src/app/api/padre/hijos/route.ts` y `.../identificadores/route.ts` — ambas usan el esquema compartido.
- `src/app/api/padre/hijos/plataforma-obligatoria.candado.test.ts` — candado de API con control positivo.

## Pantalla (Dev 1)

1. `FormularioAltaHijo.tsx`
   - `agregarBorrador`: no agrega sin `plataformaId`; botón «Agregar otro» `disabled` hasta valor **y** red.
   - `registrar`: la cuenta pendiente (escrita, no agregada) no entra sin red — se pide con el mensaje de Diseño; no se envía suelta.
   - Ayuda de una línea bajo el selector (porqué en voz del padre).
2. `HijoCard.tsx`
   - Botón «Agregar» `disabled` hasta valor **y** red; misma ayuda bajo el selector.
3. `MisHijos.tsx`
   - Placeholder «Elige la red o app»; `agregarIdentificador` envía siempre `plataformaId`; comentarios «suelto/opcional» actualizados (la conducta cambió).
4. Candado de pantalla `plataforma-obligatoria-pantalla.candado.test.tsx` (mutación-verificado).
5. Tests de conducta vieja reescritos: `MisHijos.test.tsx` (alta multi-cuenta con red por cuenta; agregar a hijo existente con red) y `mis-hijos-plataforma.candado.test.tsx` (nuevo placeholder).

## Preflight

`tsc` · `eslint` (0 errores) · suite padre (componentes + API/servicio) · `arch:check` · `specs-discipline`. Sin tocar `specs/README.md` (barrido post-merge).

## Coordinación

- Diseño: copy tomado verbatim de la forma publicada (voz padre = tú). Certificación pendiente de que la ayuda vaya en las **dos** puertas (alta + tarjeta) y del literal «ruby1».
- Datos: no se duplica su candado de API; la pantalla es su contraparte. `NOT NULL` de columna = decisión posterior del CEO.
- CEO mergea (yo nunca).
