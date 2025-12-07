# 🚀 Roadmap de Migración Supabase - openBauth-panel

**Estado:** En progreso
**Fecha Inicio:** 2025-12-06
**Progreso:** 0/24 tasks completados

---

## 📊 Resumen de Progreso

| Fase | Total Tasks | Completadas | Progreso |
|------|-------------|-------------|----------|
| Fase 1: Rutas | 10 | 10 | 100% |
| Fase 2: Queries | 8 | 0 | 0% |
| Fase 3: Cliente | 6 | 6 | 100% |
| **TOTAL** | **24** | **16** | **67%** |

---

## 🎯 FASE 1: Reestructuración de Rutas (Días 1-3)

### 1.1. Migración de Rutas de Autenticación
- [x] **Task 1.1.1:** Modificar `src/routers/auth.ts` - endpoint `/auth/v1/signup` (reemplaza `/auth/register`)
- [x] **Task 1.1.2:** Modificar `src/routers/auth.ts` - endpoint `/auth/v1/token` (reemplaza `/auth/login` y `/auth/refresh`)
- [x] **Task 1.1.3:** Modificar `src/routers/auth.ts` - endpoint `/auth/v1/user` (reemplaza `/auth/me`)
- [x] **Task 1.1.4:** Modificar `src/routers/auth.ts` - endpoint `/auth/v1/logout`
- [x] **Task 1.1.5:** Actualizar `src/index.ts` - montar router en `/auth/v1`

### 1.2. Migración de Rutas de API CRUD
- [x] **Task 1.2.1:** Renombrar `src/routers/generic-api.ts` a `src/routers/rest-api.ts`
- [x] **Task 1.2.2:** Modificar `src/routers/rest-api.ts` - endpoint `/rest/v1/:table`
- [x] **Task 1.2.3:** Actualizar `src/index.ts` - montar router en `/rest/v1`
- [x] **Task 1.2.4:** Eliminar rutas legacy `/api/*` y `/dashboard/*`

### 1.3. Migración de Rutas de Usuarios
- [x] **Task 1.3.1:** Modificar `src/routers/users.ts` - integrar en `/rest/v1/users`
- [x] **Task 1.3.2:** Eliminar archivo `src/routers/users.ts` (funcionalidad cubierta por rest-api)
- [x] **Task 1.3.3:** Actualizar `src/index.ts` - eliminar montaje de usersRouter

---

## 🎯 FASE 2: Sistema de Queries Avanzado (Días 4-6)

### 2.1. Implementación del Parser
- [ ] **Task 2.1.1:** Crear `src/utils/query-parser.ts` - clase PostgrestQueryParser
- [ ] **Task 2.1.2:** Implementar método `parseFilters()` - operadores eq, neq, gt, gte, lt, lte
- [ ] **Task 2.1.3:** Implementar método `parseSelect()` - parsing de columnas
- [ ] **Task 2.1.4:** Implementar método `parseOrder()` - parsing de ordenamiento
- [ ] **Task 2.1.5:** Implementar método `parseRange()` - limit y offset

### 2.2. Integración con BaseController
- [ ] **Task 2.2.1:** Modificar `src/database/base-controller.ts` - integrar parser en `findAll()`
- [ ] **Task 2.2.2:** Modificar `src/database/base-controller.ts` - integrar parser en `findById()`
- [ ] **Task 2.2.3:** Agregar soporte para `select` con múltiples columnas

---

## 🎯 FASE 3: Actualización del Cliente (Días 7-8)

### 3.1. Refactorización del Cliente Principal
- [x] **Task 3.1.1:** Modificar `client/api/OpenBauthPanelClient.ts` - agregar propiedad `auth`
- [x] **Task 3.1.2:** Modificar `client/api/OpenBauthPanelClient.ts` - agregar método `from()`
- [x] **Task 3.1.3:** Eliminar métodos legacy (register, login, getUsers, etc.)

### 3.2. Nuevas Clases de Cliente
- [x] **Task 3.2.1:** Crear `client/api/PostgrestQueryBuilder.ts`
- [x] **Task 3.2.2:** Implementar métodos `select()`, `eq()`, `neq()`, `gt()`, etc.
- [x] **Task 3.2.3:** Implementar métodos `insert()`, `update()`, `delete()`

---

## 🎯 FASE 4: Testing y Refactorización (Días 9-12)

### 4.1. Actualización de Tests de Auth
- [ ] **Task 4.1.1:** Modificar `tests/auth.test.ts` - actualizar endpoints a `/auth/v1/*`
- [ ] **Task 4.1.2:** Modificar `tests/auth_ssr.test.ts` - actualizar endpoints a `/auth/v1/*`
- [ ] **Task 4.1.3:** Modificar `tests/auth_fixed.test.ts` - actualizar endpoints a `/auth/v1/*`

### 4.2. Actualización de Tests de API
- [ ] **Task 4.2.1:** Modificar `tests/api/generic-crud.test.ts` - actualizar a `/rest/v1/*`
- [ ] **Task 4.2.2:** Modificar `tests/api/integration/table-management.test.ts` - actualizar endpoints
- [ ] **Task 4.2.3:** Modificar `tests/users.test.ts` - actualizar a `/rest/v1/users`

### 4.3. Tests de Queries Avanzadas
- [ ] **Task 4.3.1:** Crear `tests/api/unit/query-parser.test.ts` - tests unitarios
- [ ] **Task 4.3.2:** Crear `tests/api/integration/advanced-queries.test.ts` - tests de integración
- [ ] **Task 4.3.3:** Verificar todos los tests pasan: `bun test`

### 4.4. Tests del Cliente
- [ ] **Task 4.4.1:** Modificar `tests/client_integration.test.ts` - actualizar a nuevo cliente
- [ ] **Task 4.4.2:** Crear tests para `PostgrestQueryBuilder`

---

## 📦 Dependencias

**No se requieren dependencias nuevas** - usar solo lo existente.

---

## 📝 Notas de Implementación

- **Prioridad 1:** Todos los tests deben pasar después de cada cambio
- **Prioridad 2:** Eliminar código legacy sin miedo (no hay usuarios en producción)
- **Prioridad 3:** Mantener la simplicidad - no añadir features nuevos
- **Prioridad 4:** Documentar breaking changes en `docs/migration-breaking-changes.md`

---

## 🎯 Próximos Pasos

1. **Iniciar Task 1.1.1** - Modificar endpoints de auth
2. **Ejecutar tests después de cada task** - `bun test`
3. **Actualizar este markdown** - marcar tasks completadas con `[x]`

---

**Última actualización:** 2025-12-07
**Responsable:** @development-team
**Estado:** ✅ Fase 1 Validada | ✅ Fase 3 Completada

## ✅ Verificación de Fase 1

Los tests de verificación han sido ejecutados exitosamente:

```bash
bun test tests/verify-phase1-simple.test.ts
```

**Resultados:**
- ✅ 10/10 tests pasaron
- ✅ Todos los endpoints nuevos funcionan correctamente
- ✅ Todos los endpoints legacy devuelven 404
- ✅ No hay errores en la implementación

**Endpoints validados:**
- `/auth/v1/signup` - Registro de usuarios
- `/auth/v1/token` - Login y refresh token
- `/rest/v1/users` - CRUD de usuarios
- `/rest/v1/tables` - Listado de tablas
- `/rest/v1/schemas` - Schemas de tablas
- Legacy endpoints devuelven 404 correctamente

La Fase 1 está completa y validada. ✅