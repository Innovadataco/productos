# Quickstart — SPEC-109: verificación de la eliminación del módulo de apelación

## 1. Rutas muertas

```bash
# Con la app levantada (dev tras dev-restart, o prod tras el lote):
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5005/apelar
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:5005/api/apelaciones/solicitar
# Esperado: 404 en ambas (ya no existen).
```

## 2. Menú admin sin "Apelaciones"

- Entrar a `/dashboard/admin` con un admin: la navegación lateral NO muestra "Apelaciones"
  ni su ícono.

## 3. Sin referencias operativas

```bash
git grep -i "apelac" -- src/ scripts/ | grep -v "\.md" | grep -v specs/ || echo "sin referencias"
# Esperado: sin referencias operativas (solo specs/docs históricos si se busca en todo el repo).
```

## 4. Schema migrado

```bash
npx prisma migrate deploy   # aplica el DROP en dev/prod (tabla vacía verificada)
# En prod, ANTES de aplicar: re-verificar SELECT COUNT(*) FROM "ApelacionIdentificador" = 0
# (si > 0, PARAR y reportar a ZEUS).
```

## 5. Gate

```bash
npx tsc --noEmit && npm run lint && npm run test && npm run build
# Esperado: verde completo; CI de GitHub success en el push.
```

## 6. Visibilidad sigue funcionando

- `actualizarVisibilidadPublica` intacto (diff cero): la consulta pública de
  identificadores por umbral sigue igual que antes de la eliminación.
