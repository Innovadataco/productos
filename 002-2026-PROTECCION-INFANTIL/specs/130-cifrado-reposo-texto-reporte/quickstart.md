# Quickstart: SPEC-130 — Cifrado en reposo del texto del reporte

Verificación guiada tras implementar (dev; prod como paso manual documentado).

## 1 — Cifrado en reposo

```bash
# Crear un reporte (anónimo) y verificar en BD que texto y textoOriginal son GCM:
node --env-file=.env --import tsx -e "
import { prisma } from './src/lib/prisma';
import { isEncryptedValue } from './src/lib/param-encryption';
const r = await prisma.reporte.findFirst({ orderBy: { creadoEn: 'desc' } });
console.log('texto cifrado:', isEncryptedValue(r.texto));
console.log('textoOriginal cifrado:', isEncryptedValue(r.textoOriginal ?? ''));
await prisma.\$disconnect();
"
# Esperado: true, true
```

## 2 — Pipeline transparente (clasificación intacta)

- Procesar un reporte: el worker lo clasifica como antes (el resultado NO cambia).
- Revisión del operador y expediente admin muestran el texto legible (descifrado).

## 3 — Política por estado terminal

- DUPLICADO: al cerrar el pipeline, `texto` queda purgado a marcador (evidencia íntegra
  en `textoOriginal` cifrado).
- REVISION_MANUAL / POSIBLE_SPAM: antes de resolver el operador lee el texto; al
  resolver (confirmar/corregir/baja), se aplica la regla de la política.

## 4 — Migración (dev primero)

```bash
node --env-file=.env --import tsx scripts/migrar-cifrado-texto-reportes.ts
# Esperado: conteos cifrados / ya_cifrados / original_poblado / total_plano_restante = 0
# Re-correr: 0 cambios (idempotente)
```

## 5 — Gates

```bash
npx tsc --noEmit && npm run lint && npm run test && npm run build && npm run arch:check
```

Todo verde; tests nuevos de cifrado en reposo, lectura transparente y política por estado.

## 6 — Producción (paso manual, patrón 048)

Tras el deploy con el código: `docker compose --env-file .env.production -f docker-compose.prod.yml exec -T app node --import tsx scripts/migrar-cifrado-texto-reportes.ts`
y verificación `total_plano_restante = 0`. La clave la respalda el CEO (BL-2).
