# 007-2026-PIWEB · Sitio de marketing Protección Infantil

Sitio estático de una sola página (HTML + CSS + JS + assets), sin build ni backend.
Se sirve en `https://piweb.innovadataco.com` detrás del túnel Cloudflare del VPS.

## Estructura

```
007-2026-PIWEB/
├── index.html
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

Sin variables de entorno. Sin datos sensibles. Sin dependencias del 002.
