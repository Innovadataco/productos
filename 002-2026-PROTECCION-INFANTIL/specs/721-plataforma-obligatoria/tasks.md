# Tasks · SPEC-721

## Servidor (Datos · cherry-pick #663)
- [x] `camposIdentificadorEntrada` con `plataformaId` obligatorio (fuente única)
- [x] Dos rutas de la API usan el esquema compartido
- [x] Candado de API con control positivo (`plataforma-obligatoria.candado.test.ts`)

## Pantalla (Dev 1)
- [x] `FormularioAltaHijo`: botón «Agregar otro» exige valor + red; `agregarBorrador` guardado
- [x] `FormularioAltaHijo`: la cuenta pendiente sin red no se envía al registrar (se pide, mensaje de Diseño)
- [x] `FormularioAltaHijo`: ayuda de una línea bajo el selector (porqué en voz del padre)
- [x] `HijoCard`: botón «Agregar» exige valor + red; misma ayuda bajo el selector
- [x] `MisHijos`: placeholder «Elige la red o app»; `agregarIdentificador` envía siempre `plataformaId`; comentarios stale actualizados
- [x] Candado de pantalla `plataforma-obligatoria-pantalla.candado.test.tsx` (mutación-verificado)
- [x] Reescritos los tests de conducta vieja (`MisHijos.test.tsx`, `mis-hijos-plataforma.candado.test.tsx`)

## Preflight
- [x] `tsc --noEmit` (exit 0)
- [x] `eslint` de los archivos tocados (0 errores; 1 warning pre-existente)
- [x] Suite padre: componentes (25) + API/servicio (49) en verde
- [x] `arch:check` verde (a–i)
- [x] `specs-discipline` verde
- [ ] CI por rollup completo en verde (lo verifica el CEO antes de mergear)

## Verificación en vivo (post-deploy, tras merge del CEO)
- [ ] Alta de hijo: no deja agregar cuenta sin elegir la red; el porqué se ve
- [ ] Agregar cuenta a hijo existente: mismo gate
- [ ] Retro Datos: 0 identificadores activos sin plataforma al desplegar
