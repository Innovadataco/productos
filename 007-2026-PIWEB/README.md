# 007-2026-PIWEB · Sitio de marketing Protección Infantil

Sitio estático de una sola página (HTML + CSS + JS + assets), sin build ni backend.
Se sirve en `https://piweb.innovadataco.com` detrás del túnel Cloudflare del VPS.

## Estructura

```
007-2026-PIWEB/
├── index.html
├── operacion/            ← Tablero de Operación (SPEC-497/498)
│   └── index.html
├── modelo/               ← Modelo de datos (SPEC-503)
│   └── index.html
├── assets/
│   ├── site.css
│   ├── site.js
│   ├── favicon.svg
│   └── og.png
├── docker-compose.yml
└── README.md
```

## Levantar en local

```bash
docker compose up -d
# abrir http://127.0.0.1:5017
```

## Producción (VPS)

`docker compose up -d` en `/opt/proteccion-infantil/piweb/`.
Nginx-alpine monta la carpeta en `/usr/share/nginx/html:ro` y expone
`127.0.0.1:5017`; el túnel Cloudflare enruta `piweb.innovadataco.com` a ese puerto.

Sin variables de entorno. Sin dependencias del 002.

## ⚠️ Excepción declarada a «sin datos sensibles» — `/operacion/` y `/modelo/`

Las rutas **`/operacion/`** (Tablero de Operación) y **`/modelo/`** (Modelo de datos) publican información
interna del proyecto en rutas públicas, **por decisión explícita y temporal de Jelkin (05-09-2026).**

- `/operacion/`: quién trabaja en qué, estado de cada funcionalidad y pantallas vs diseño.
- `/modelo/`: el modelo de datos (111 tablas por dominios, mapa de relaciones y recomendaciones de auditoría).
- Ambas **no se indexan** (`noindex, nofollow`) y **no tienen enlace** desde el menú ni el pie: solo por URL
  directa. Entre ellas se navega por las pestañas **Operación / Modelo**.
- Los **datos** del tablero (`operacion.json`) viven **fuera de git**, en `/opt/proteccion-infantil/piweb/`, y los
  mantiene el CEO por SSH sin redesplegar. La pestaña `/modelo/` es **estática** (instantánea del esquema).
- **Que nadie «corrija» esto** creyendo que es un descuido: está decidido y anotado a propósito.

> **Despliegue de la pestaña `/modelo/`:** agrega un **mount nuevo** en `docker-compose.yml`. Un `docker restart piweb`
> **no** aplica volúmenes nuevos → la primera vez requiere **`docker compose up -d`**. Después, un cambio solo al
> contenido del archivo ya montado sí basta con `git pull` + `docker restart`.
