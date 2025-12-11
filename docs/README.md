# OpenBauth Panel - Documentación

Bienvenido a la documentación de OpenBauth Panel, un sistema de autenticación y autorización completo construido con Bun y Hono.

## 📚 Índice de Artículos

### 🚀 Guías de Inicio
- [Instalación y Configuración](articles/setup/installation.md)
- [Configuración de Variables de Entorno](articles/setup/environment.md)
- [Estructura del Proyecto](articles/project-structure.md)

### 🔐 Autenticación y Autorización
- [API de Autenticación](articles/auth/authentication-api.md)
- [Protocolo OAuth 2.0 / OIDC](articles/auth/oauth-oidc.md)
- [Gestión de Usuarios](articles/auth/user-management.md)
- [Administración y RBAC](articles/auth/admin-rbac.md)

### 📊 API Genérica (Headless CMS)
- [API Dinámica](articles/api/generic-api.md)
- [Operaciones CRUD](articles/api/crud-operations.md)

### 💾 Almacenamiento
- [Gestión de Archivos](articles/storage/file-management.md)

### 🔧 Desarrollo
- [Scripts de Base de Datos](articles/development/database-scripts.md)
- [Testing](articles/development/testing.md)
- [Despliegue](articles/development/deployment.md)

## 🎯 Características Principales

- **Autenticación Completa**: Registro, login, sesiones anónimas, refresh tokens
- **OAuth 2.0 / OIDC**: Integración con proveedores externos
- **RBAC**: Control de acceso basado en roles
- **API Genérica**: CRUD dinámico para cualquier tabla
- **Almacenamiento**: Gestión de archivos con servicios cloud
- **Rate Limiting**: Protección contra abuso
- **Auditoría**: Registro de actividades
- **Notificaciones**: Sistema de email integrado

## 🛠️ Tecnologías

- **Runtime**: [Bun](https://bun.com)
- **Framework**: [Hono](https://hono.dev)
- **Base de Datos**: SQLite con migraciones
- **Validación**: [Zod](https://zod.dev)
- **Seguridad**: bcrypt, JWT, rate limiting
- **Testing**: Bun test runner

## 📖 Cómo Usar Esta Documentación

1. **Primeros Pasos**: Comienza con [Instalación y Configuración](articles/setup/installation.md)
2. **Configuración**: Revisa [Variables de Entorno](articles/setup/environment.md)
3. **API**: Explora los endpoints en [API de Autenticación](articles/auth/authentication-api.md)
4. **Desarrollo**: Consulta [Testing](articles/development/testing.md) para contribuir

## 🔗 Recursos Adicionales

- [Repositorio GitHub](https://github.com/tu-usuario/openbauth-panel)
- [Reportar Issues](https://github.com/tu-usuario/openbauth-panel/issues)
- [Contribuir](CONTRIBUTING.md)

---

¿Necesitas ayuda? Consulta nuestra [FAQ](articles/faq.md) o abre un issue en GitHub.