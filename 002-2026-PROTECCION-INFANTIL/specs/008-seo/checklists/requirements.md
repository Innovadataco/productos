# Checklist: SEO y Metadatos

**Purpose**: Verificar que todas las páginas públicas tengan SEO completo y accesible.
**Feature**: [spec.md](../spec.md)

## Metadata

- [ ] CHK001 `layout.tsx` exporta `viewport` con `themeColor`.
- [ ] CHK002 Cada página pública tiene `title` único.
- [ ] CHK003 Cada página pública tiene `description` único.
- [ ] CHK004 OpenGraph básico está configurado en el layout.

## robots.txt y sitemap

- [ ] CHK005 `/robots.txt` es accesible.
- [ ] CHK006 `/robots.txt` bloquea `/dashboard/**` y `/api/**`.
- [ ] CHK007 `/sitemap.xml` es accesible y lista URLs públicas.

## Canonical y datos estructurados

- [ ] CHK008 Cada página pública incluye canonical URL.
- [ ] CHK009 La landing incluye JSON-LD de `WebSite` / `Organization`.

## Calidad

- [ ] CHK010 No hay warnings de Next.js sobre metadata.
- [ ] CHK011 Gate completo pasa: lint, test, build, e2e, tsc.
