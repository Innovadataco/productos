# Tasks · SPEC-367 · A-73 círculo de confianza (rediseño G12)

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-02 · **Dev**: PI-1

## Fase 1 · Fuente y diseño (candado 15v5)

- [x] T001 Leer el brief A-73 y el mockup aprobado enteros (3 estados + notas del modelo)
- [x] T002 Leer la pantalla actual y sus endpoints; mapear la superficie de API a reusar
- [x] T003 Confirmar que la lista YA devuelve nombre/parentesco/creadoEn (el tipo viejo estaba desactualizado)
- [x] T004 Confirmar que el PATCH de identificadores es de LISTA COMPLETA

## Fase 2 · Rediseño

- [x] T005 `tipos.ts` con el modelo real + helpers (tono, nombre visible, estado sin jerga)
- [x] T006 `IlustracionCirculo` (tú y tus hijos al centro; lugares libres invitan)
- [x] T007 `EstadoVacio` = primer paso (3 pasos + ideas + promesa)
- [x] T008 `TarjetaPersona` (verde/ámbar/gris, acciones claras)
- [x] T009 `BloqueAtencion` arriba, solo cuando hay algo
- [x] T010 `PanelAgregar` con las 3 preguntas y parentesco por chips
- [x] T011 `DetallePersona` con las estadísticas DENTRO (decisión 3) y manejo por dato
- [x] T012 `QueRecibes` con el ejemplo del aviso y la preferencia real
- [x] T013 Orquestador `CirculoConfianzaClient` + página con el MISMO guard de acceso

## Fase 3 · Backend mínimo

- [x] T014 `listarContactos` devuelve `tope` para el cupo real (aditivo)

## Fase 4 · Pruebas y puertas

- [x] T015 [P] Tests de los 3 estados + las 3 decisiones + nunca rojo + sin jerga (7)
- [x] T016 Tests existentes del círculo verdes tras el agregado (39)
- [x] T017 `tsc` / `arch` / `tokens` (baja a 1064) / `locks` / `ratchets` / `lint` sin errores
- [x] T018 `test:unit` verde (1956)
- [x] T019 La ruta compila y responde 200 en el navegador (dev)
- [ ] T020 Recorrido visual con sesión de padre → **Calidad** (entrar pide contraseña; esta sesión no maneja credenciales)
