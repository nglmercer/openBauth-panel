# Configuración de Variables de Entorno

Guía completa para configurar las variables de entorno de OpenBauth Panel.

## 📋 Variables de Entorno Disponibles

### 🔗 Base de Datos

```bash
DATABASE_URL=auth.db
```

- **Descripción**: Ruta al archivo de base de datos SQLite
- **Valor por defecto**: `auth.db`
- **Notas**: Puede ser una ruta relativa o absoluta

### 🔐 JWT (JSON Web Tokens)

```bash
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
```

| Variable | Descripción | Valor por defecto | Ejemplos |
|----------|-------------|-------------------|----------|
| `JWT_SECRET` | Clave secreta para firmar tokens | Requerido | `mi-super-secreto-256-bits` |
| `JWT_EXPIRES_IN` | Tiempo de expiración del token de acceso | `15m` | `15m`, `1h`, `2d` |
| `JWT_REFRESH_EXPIRES_IN` | Tiempo de expiración del refresh token | `7d` | `7d`, `30d`, `90d` |

### 📧 SMTP (Correo Electrónico)

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@yourapp.com
```

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `SMTP_HOST` | Servidor SMTP | `smtp.gmail.com`, `smtp.outlook.com` |
| `SMTP_PORT` | Puerto del servidor | `587` (TLS), `465` (SSL) |
| `SMTP_USER` | Usuario del correo | `tu-email@gmail.com` |
| `SMTP_PASS` | Contraseña de aplicación | `abcd-efgh-ijkl-mnop` |
| `SMTP_FROM` | Remitente del correo | `noreply@tuapp.com` |

### 🌐 Frontend

```bash
FRONTEND_URL=http://localhost:3000
```

- **Descripción**: URL del frontend para CORS y redirecciones
- **Valor por defecto**: `http://localhost:3000`
- **Notas**: Usar la URL completa incluyendo el protocolo

### 🛡️ Rate Limiting

```bash
RATE_LIMIT_WINDOW=60
RATE_LIMIT_MAX_REQUESTS=10
```

| Variable | Descripción | Valor por defecto |
|----------|-------------|-------------------|
| `RATE_LIMIT_WINDOW` | Ventana de tiempo en segundos | `60` |
| `RATE_LIMIT_MAX_REQUESTS` | Máximo de peticiones por ventana | `10` |

### 🌐 Puerto del Servidor

```bash
PORT=3000
```

- **Descripción**: Puerto donde escuchará el servidor
- **Valor por defecto**: `3000`
- **Notas**: Asegúrate de que el puerto esté disponible

### 📝 Modo Debug

```bash
DEBUG=false
```

- **Descripción**: Activa logs detallados de debug
- **Valores**: `true` o `false`
- **Valor por defecto**: `false`

## 🎯 Configuraciones Recomendadas por Entorno

### 🏠 Desarrollo Local

```bash
# .env.local
DATABASE_URL=./dev.db
JWT_SECRET=dev-secret-key-no-usar-en-produccion
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=30d
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu-email@gmail.com
SMTP_PASS=tu-app-password
SMTP_FROM=noreply@localhost
FRONTEND_URL=http://localhost:3000
RATE_LIMIT_WINDOW=60
RATE_LIMIT_MAX_REQUESTS=100
PORT=3000
DEBUG=true
```

### 🧪 Testing

```bash
# .env.test
DATABASE_URL=./test.db
JWT_SECRET=test-secret-key
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=1d
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=test
SMTP_PASS=test
SMTP_FROM=test@localhost
FRONTEND_URL=http://localhost:3001
RATE_LIMIT_WINDOW=60
RATE_LIMIT_MAX_REQUESTS=1000
PORT=3001
DEBUG=true
```

### 🚀 Producción

```bash
# .env.production
DATABASE_URL=/secure/path/auth.db
JWT_SECRET=use-una-clave-super-segura-de-al-menos-256-bits
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu-email@empresa.com
SMTP_PASS=tu-app-password-segura
SMTP_FROM=noreply@tuempresa.com
FRONTEND_URL=https://tuapp.com
RATE_LIMIT_WINDOW=60
RATE_LIMIT_MAX_REQUESTS=10
PORT=3000
DEBUG=false
```

## 🔐 Seguridad en Producción

### Generar JWT Secret Seguro

```bash
# Linux/Mac
openssl rand -base64 32

# Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Configuración de Gmail SMTP

1. Activa la verificación en dos pasos en tu cuenta de Google
2. Genera una contraseña de aplicación:
   - Ve a [Configuración de Google](https://myaccount.google.com/)
   - Seguridad → Verificación en dos pasos → Contraseñas de aplicación
   - Genera una nueva contraseña para "Correo"

### Variables Sensibles

```bash
# No commitear estos valores
echo ".env" >> .gitignore
echo ".env.local" >> .gitignore
echo ".env.production" >> .gitignore
```

## 🧪 Verificación de Configuración

### Script de Verificación

```bash
#!/bin/bash
# verify-env.sh

echo "Verificando variables de entorno..."

# Verificar JWT_SECRET
if [ -z "$JWT_SECRET" ]; then
    echo "❌ JWT_SECRET no está configurado"
    exit 1
fi

# Verificar longitud mínima
if [ ${#JWT_SECRET} -lt 32 ]; then
    echo "⚠️  JWT_SECRET es muy corto (mínimo 32 caracteres recomendados)"
fi

# Verificar SMTP
if [ -z "$SMTP_HOST" ] || [ -z "$SMTP_USER" ] || [ -z "$SMTP_PASS" ]; then
    echo "⚠️  Configuración SMTP incompleta (los emails no funcionarán)"
fi

echo "✅ Verificación básica completada"
```

### Comandos de Prueba

```bash
# Testear conexión SMTP
bun run test:smtp

# Verificar JWT
bun run test:jwt

# Testear base de datos
bun run test:db
```

## 🚨 Errores Comunes

### "JWT malformed"

- **Causa**: JWT_SECRET muy corto o con caracteres especiales
- **Solución**: Usa una clave de al menos 32 caracteres alfanuméricos

### "Connection refused" en SMTP

- **Causa**: Credenciales incorrectas o puerto bloqueado
- **Solución**: Verifica credenciales y firewall

### "Database is locked"

- **Causa**: Múltiples procesos accediendo a SQLite
- **Solución**: Usa WAL mode o una BD como PostgreSQL

## 📚 Recursos Adicionales

- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [Gmail SMTP Settings](https://support.google.com/mail/answer/7126229)
- [Environment Variables in Bun](https://bun.sh/docs/runtime/env)

¿Tienes problemas con la configuración? Consulta nuestra [FAQ](../faq.md) o [abre un issue](https://github.com/tu-usuario/openbauth-panel/issues).