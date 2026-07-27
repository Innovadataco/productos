# Feature Specification: Despliegue híbrido a producción (VPS + cerebro en la Mac)

**Feature Branch**: `feature/001-scaffolding` | **Date**: 2026-07-26 | **Status**: DESARROLLO

## Contexto

Arquitectura definida en ACTA_ARQ_02 §2.4 y D-25 (repo de gestión): la app vive en un VPS
Hostinger (Ubuntu 24.04, 2 CPU / 8 GB / 100 GB, IP 2.25.77.158) y el cerebro de IA (Ollama)
queda en la Mac Studio, alcanzable SOLO por la tailnet. El VPS YA corre otro proyecto
(gesmovilapp: Node 3000/5050, Postgres 0.0.0.0:5432, Apache :80, hermes 8642/9119) que
**no se toca**. Tailscale y Cloudflare Tunnel ya están instalados en el VPS; no hay Docker.

**Líneas rojas**: no tocar Gesmovil ni su Postgres(5432)/Apache/Node; Ollama solo por
Tailscale, nunca expuesto a internet; acceso restringido hasta resolver lo legal (R08/#149);
delegar SOLO el subdominio pi.innovadataco.com (no tocar MX de Google Workspace).

## User Stories

### US1 — Preparar el VPS sin tocar el proyecto existente (P1)

Como operador, quiero swap de 2–4 GB y firewall básico (ufw) que no cierre nada de lo que
Gesmovil usa (22, 80, y sus puertos), verificando tras cada paso que gesmovilapp, Node,
Postgres y Apache siguen vivos.

### US2 — Docker en el VPS (P1)

Como operador, quiero Docker Engine + compose plugin instalados sin afectar lo que ya corre.

### US3 — Contenerizar PI (P1) — Decisión 2 / D-26

Como operador, quiero Dockerfile de la app (Next.js build) + worker y un
docker-compose de producción con app, worker y Postgres+pgvector de PI en su propio
contenedor y puerto propio (NUNCA 5432; 5434 o solo red interna), con `restart: always`.

### US4 — Secretos de producción (P1) — D-26

Como responsable de seguridad, quiero un `.env` de producción FUERA de git con valores
fuertes (nada `_dev`), ENCRYPTION_KEY y PARAM_ENCRYPTION_KEY nuevos, ENTREGADOS AL CEO para
respaldo fuera del VPS. La base de prod arranca LIMPIA (seed), sin datos de prueba de la Mac.

### US5 — Cerebro híbrido (P1) — D-25

Como operador, quiero que `OLLAMA_BASE_URL` del VPS apunte a la Mac Studio por su IP de
Tailscale, de modo que el VPS alcance Ollama SOLO por la tailnet.

### US6 — Exposición restringida (P1)

Como responsable, quiero pi.innovadataco.com publicado por el Cloudflare Tunnel YA
instalado (ruta nueva a la app de PI), con ACCESO RESTRINGIDO (Cloudflare Access o login) —
NO público (R08/#149). Solo el subdominio; MX intactos.

### US7 — Deploy simple desde GitHub (P2)

Como operador, quiero un comando/script documentado (`git pull` + `docker compose up -d`).
CI/CD automático queda fuera de alcance.

### US8 — Rollback simple (P2)

Como operador, quiero imágenes etiquetadas, migraciones aditivas y una página
"cómo revertir" documentada.

## Functional Requirements

- **FR-001**: El sistema DEBE agregar swap (2–4 GB) persistente en `/etc/fstab` sin reiniciar servicios ajenos.
- **FR-002**: El sistema DEBE dejar ufw activo permitiendo 22, 80 y los puertos que Gesmovil ya expone; NINGÚN puerto de PI se abre a internet (la app solo escucha en localhost para el tunnel).
- **FR-003**: Tras CADA cambio en el VPS se DEBE verificar que apache2, postgres 16-main, los node de pm2 y hermes siguen activos.
- **FR-004**: Docker Engine + plugin compose DEBEN quedar instalados vía repo oficial de Docker.
- **FR-005**: La app de PI DEBE construirse como imagen Docker (Next.js standalone) con servicio worker separado.
- **FR-006**: El Postgres de PI DEBE correr en contenedor pgvector/pgvector:pg16 en puerto 5434 (o solo red interna), volumen propio, `restart: always` en todos los servicios.
- **FR-007**: El `.env` de producción DEBE vivir fuera de git (solo en el VPS), con secretos fuertes generados aleatoriamente; ENCRYPTION_KEY y PARAM_ENCRYPTION_KEY se entregan al CEO para respaldo externo.
- **FR-008**: La BD de producción DEBE inicializarse con migraciones + seed limpio (sin datos de la Mac).
- **FR-009**: `OLLAMA_BASE_URL` DEBE apuntar a `http://100.91.87.86:11434` (IP Tailscale de la Mac); Ollama se expone SOLO a la tailnet (`tailscale serve`/relay en la IP de Tailscale, nunca 0.0.0.0 público).
- **FR-010**: pi.innovadataco.com DEBE resolverse por el tunnel existente hacia la app de PI; el acceso DEBE quedar restringido (Cloudflare Access o, mínimo, login de la app sin registro abierto).
- **FR-011**: DEBE existir `scripts/deploy-prod.sh` documentado (pull + build + up).
- **FR-012**: Las imágenes DEBEN etiquetarse por commit (rollback = `docker compose up -d` con tag anterior, documentado en docs/despliegue).

## Success Criteria

- **SC-001**: Gesmovil sigue vivo tras cada paso (apache, postgres, pm2 backend, hermes, puertos 80/3000/5050/5432/8642/9119).
- **SC-002**: pi.innovadataco.com responde HTTPS con candado y NO es accesible sin autenticación.
- **SC-003**: Un reporte de prueba creado en prod viaja VPS → Tailscale → Ollama en la Mac → vuelve clasificado al VPS.
- **SC-004**: Gate verde (lint + test + tsc + build) y cierre.md con evidencias.

## Assumptions

- El CEO ya habilitó SSH por llave (alias `pi-vps` en la Mac, verificado 2026-07-26).
- La Mac Studio (`mac-studio-de-idc`, 100.91.87.86) permanece encendida con Ollama corriendo; es un riesgo aceptado de la arquitectura híbrida (D-25).
- Cloudflare Access puede requerir acción del CEO en el dashboard Zero Trust (no automatizable desde CLI sin API token); si bloquea, queda registrado y la app queda detrás de login.
