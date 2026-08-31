# SPEC-334 · La marca "El Guardián" en el header + favicon

**Status**: IMPLEMENTADO
**Radicado**: marca aprobada por Jelkin 30-08-2026 ([MARCA-EL-GUARDIAN.md] en gestión) · colegio/padre/comité/admin (header común)
**Impacto en arquitectura:** ninguno — nuevo componente de símbolo `Guardian` (SVG + animación por CSS con tokens del sistema), reemplaza el `ShieldIcon` del header y agrega `app/icon.svg` como favicon. Sin cambio de esquema ni de datos.

## Problema

El logo del header era un escudo genérico de Heroicons con un visto, sobre un cuadrado con degradado — "el mismo ícono que usan un antivirus, un banco y una app de contraseñas". Jelkin aprobó **El Guardián**: un escudo con la figura del niño recortada dentro, ocho nodos y un barrido de vigilancia.

## Requisitos funcionales

- **FR-001** Componente `Guardian` que rinde el símbolo (MARCA §8): escudo `--pino`, niño recortado (máscara), 8 nodos `--cielo`, barrido `--cielo`. Colores del sistema → se adapta claro/oscuro por los tokens `--pino-rgb`/`--cielo-rgb`/`--ambar-rgb`.
- **FR-002** Tres tallas (§4): `viva` (8 nodos + barrido), `reducida` (4 nodos), `minima` (solo escudo + niño). El hueco del niño NUNCA se quita (§7).
- **FR-003** Estados (§3): `calma` (default) y `alerta` (un nodo en ámbar, el resto atenuado, ritmo 1,3 s). Sin rojo, nunca (§7).
- **FR-004** La animación respeta `prefers-reduced-motion` (§7): sin movimiento, el símbolo queda quieto y legible.
- **FR-005** El header (`NavHeader`) muestra `Guardian` (talla viva) en claro y oscuro. El **clic del logo sigue vivo** para los 4 roles (padre/colegio/comité/admin) — `logoHref`/`destinoLogo` intactos (regresión I-38 preservada).
- **FR-006** `app/icon.svg` (favicon) = talla mínima, una tinta (escudo + niño).

## Escenarios (User Story)

- **US1 (P1) — Se ve el guardián.** En el header, en claro y oscuro, aparece El Guardián; el clic lleva al inicio correcto de cada rol.

## Success Criteria

- **SC-001** Tests: `Guardian` (hueco siempre, tallas 8/4/0, ámbar sin rojo, ids únicos); `nav-logo`/`NavHeader` verdes (I-38 intacto).
- **SC-002** `verificaciones` + `specs-discipline` + `test:unit` verdes.
- **SC-003** Evidencia en navegador (claro/oscuro + clic por rol) — la captura el CEO/Calidad post-deploy (regla fija de evidencia).

## Fuera de alcance

- Rasterizar los PNG de PWA (`public/icons/*.png`) desde el SVG nuevo — requiere herramienta de imagen; queda como follow-up (el favicon SVG ya cubre la pestaña).
- El logo de la landing pública (`LandingHero`) y los íconos decorativos — no son "el header".
- El §9 del brief (área de respiro, tamaño mínimo impresión, sobre fotografía) — pendiente de diseño.
