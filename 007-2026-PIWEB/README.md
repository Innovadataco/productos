# 007-2026-PIWEB · Sitio de marketing Protección Infantil

Sitio estático de una sola página (HTML + CSS + JS + assets), sin build ni backend.
Se sirve en `https://piweb.innovadataco.com` detrás del túnel Cloudflare del VPS.

## Estructura

```
007-2026-PIWEB/
├── index.html
├── operacion/            ← Tablero de Operación (SPEC-497)
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

## ⚠️ Excepción declarada a «sin datos sensibles» — `/operacion/`

La ruta **`/operacion/`** publica el **Tablero de Operación** del proyecto: quién trabaja en qué, el
estado de cada funcionalidad y qué recorridos necesitan a Jelkin. **Es información interna en una ruta
pública, por decisión explícita y temporal de Jelkin (05-09-2026).**

- **No se indexa** (`noindex, nofollow`) y **no tiene enlace** desde el menú ni el pie: solo por URL directa.
- Los **datos** (`operacion.json`) viven **fuera de git**, en `/opt/proteccion-infantil/piweb/`, y los
  mantiene el CEO por SSH sin redesplegar.
- **Que nadie «corrija» esto** creyendo que es un descuido: está decidido y anotado a propósito.
