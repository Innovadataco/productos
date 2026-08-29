# Quickstart — SPEC-106: validación del cierre de sesión real

## 1. Test de regresión (cabecera Set-Cookie)

```bash
export PATH="$HOME/.local/bin:$PATH"
npx vitest run src/app/api/auth/logout/route.test.ts
# Esperado: verde — el borrado de __Host-token incluye Secure, Path=/ y Expires pasado;
# el de token incluye Path=/ y Expires pasado (sin exigir Secure).
```

## 2. En vivo (dev o prod tras el deploy)

```bash
# Login y luego logout inspeccionando la cabecera:
curl -s -X POST https://pi.innovadataco.com/api/auth/login -H "Content-Type: application/json" \
  -d '{"email":"<usuario>","password":"<clave>"}' -c /tmp/ck.txt -o /dev/null
curl -s -X POST https://pi.innovadataco.com/api/auth/logout -b /tmp/ck.txt -D - -o /dev/null | grep -i "set-cookie"
# Esperado: __Host-token=; ... Secure; Path=/; Expires=<fecha 1970>
# Y en el navegador: tras logout, /dashboard/* redirige a /login (la sesión murió de verdad).
```

## 3. Logo en público vs panel

- Con sesión ADMIN en `/`: el logo apunta a `/` (home público) y "Reportar anónimo" llega a
  `/reportar` sin desviar al panel.
- Con sesión ADMIN en `/dashboard/admin`: el logo apunta al panel del rol (igual que antes).
- Con sesión de colegio en `/dashboard/colegio`: "Cerrar sesión" presente y funcional
  (I-25 intacto), y al salir, la sesión muere de verdad (punto 2).

## 4. No-regresión del login

```bash
npx vitest run src/lib/auth 2>/dev/null; npx vitest run src/app/api/auth
# Esperado: suite de auth verde (creación de cookie intacta).
```

## 5. Gate

```bash
npx tsc --noEmit && npm run lint && npm run test && npm run build
```
