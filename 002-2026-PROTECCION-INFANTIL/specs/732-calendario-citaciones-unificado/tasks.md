# Tasks · SPEC-732

## Pantalla / componente
- [x] `CalendarioProfesional`: quitar prop `modo`; título siempre «Calendario»; tira «Esperando su respuesta · N por responder» lidera cuando hay pendientes
- [x] `calendario/page.tsx`: monta sin `modo`; descripción publicar + responder

## Menú y ruta
- [x] `menu-por-estado.ts`: fuera la entrada «Citaciones» (+ const HREF)
- [x] `nav-items.ts`: fuera el ítem «Citaciones»
- [x] `citaciones/page.tsx`: stub de redirect puro → `/calendario`

## Módulo de permiso
- [x] `seed-modulos-grants.ts`: `profesional_citaciones` fuera del grant PROFESIONAL
- [x] `permisos-catalogo.ts`: `profesional_citaciones` fuera del catálogo
- [x] APIs `solicitudes` (route + confirmar + rechazar): `assertModulo` → `profesional_calendario`

## Candados
- [x] Nuevo `calendario-unificado.candado.test.ts` (mutación-verificado)
- [x] `menu-por-estado.candado` (labels sin Citaciones; OPERATIVAS 4→3)
- [x] `guardia-habilitado.candado` (lista operativa sin citaciones + exención de redirect puro)
- [x] `menu.candado` (catálogo profesional 5→4)

## Preflight
- [x] `tsc --noEmit` (0)
- [x] `eslint` (0 errores)
- [x] `arch:check` verde (a–i, sin regenerar artefactos)
- [ ] `specs-discipline` verde
- [ ] candados de forma/voz del profesional (dashboard-profesional-forma, voz-usted, calendario 714)
- [ ] CI por rollup completo (lo verifica el CEO antes de mergear)

## Verificación en vivo (post-deploy, tras merge del CEO)
- [ ] El menú del profesional muestra un solo «Calendario» (no «Citaciones»)
- [ ] En el calendario: publicar una franja Y responder una solicitud (Confirmar/No puedo) sin cambiar de pantalla
- [ ] `/dashboard/profesional/citaciones` redirige a `/calendario` (no 404)
