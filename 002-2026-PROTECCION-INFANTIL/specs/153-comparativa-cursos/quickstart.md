# Quickstart: SPEC-153 — Comparativa entre cursos

## Prerrequisitos

- Entorno levantado: Docker db, `npm install`, migraciones aplicadas.
- Usuario SCHOOL_ADMIN vinculado a un colegio con al menos un curso.

## Probar localmente

1. Login como SCHOOL_ADMIN.
2. Navegar a `/dashboard/colegio/analisis/comparativa`.
3. Ver tabla con grupos por grado (default).
4. Cambiar selector a "Año lectivo" y ver grupos distintos.
5. Hacer clic en "Exportar Excel" y abrir el archivo.

## Verificar endpoints

```bash
curl -s -b "token=$TOKEN" "http://localhost:5005/api/colegio/analisis/comparativa?agruparPor=grado" | jq .
curl -s -b "token=$TOKEN" "http://localhost:5005/api/colegio/analisis/comparativa/excel?agruparPor=grado" \
  -o /tmp/comparativa.xlsx
file /tmp/comparativa.xlsx
```

## Gate de calidad

```bash
npx tsc --noEmit
npm run lint
npm run tokens:check
npm run test -- src/app/api/colegio/analisis/comparativa
npm run arch:check
npm run build
```
