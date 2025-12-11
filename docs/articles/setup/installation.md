# Instalación y Configuración

Guía paso a paso para instalar y configurar OpenBauth Panel en tu entorno local.

## 📋 Requisitos Previos

Antes de comenzar, asegúrate de tener instalado:

- [Bun](https://bun.sh) (versión 1.3.3 o superior)
- Node.js (opcional, pero recomendado para algunas herramientas)
- Git

## 🚀 Instalación Rápida

### 1. Clonar el Repositorio

```bash
git clone https://github.com/tu-usuario/openbauth-panel.git
cd openbauth-panel
```

### 2. Instalar Dependencias

```bash
bun install
```

### 3. Configurar Variables de Entorno

Copia el archivo de ejemplo:

```bash
cp .env.example .env
```

Edita el archivo `.env` con tu configuración. Consulta [Variables de Entorno](environment.md) para más detalles.

### 4. Inicializar la Base de Datos

```bash
# Ejecutar migraciones
bun run db:migrate

# (Opcional) Cargar datos de prueba
bun run db:seed
```

### 5. Iniciar el Servidor

```bash
# Modo desarrollo con hot reload
bun run dev

# O modo producción
bun run start
```

El servidor estará disponible en `http://localhost:3000`

## 🔧 Verificación de la Instalación

### Verificar Endpoints

Puedes probar los endpoints básicos:

```bash
# Health check
curl http://localhost:3000/health

# Verificar versión
curl http://localhost:3000/api/version
```

### Verificar Base de Datos

```bash
# Listar tablas (si usas SQLite)
sqlite3 auth.db ".tables"
```

## 🐳 Instalación con Docker (Opcional)

Si prefieres usar Docker:

```dockerfile
# Dockerfile
FROM oven/bun:1.3.3

WORKDIR /app

COPY package.json bun.lockb ./
RUN bun install

COPY . .

EXPOSE 3000

CMD ["bun", "run", "start"]
```

```bash
# Construir imagen
docker build -t openbauth-panel .

# Ejecutar contenedor
docker run -p 3000:3000 --env-file .env openbauth-panel
```

## 🚨 Solución de Problemas

### Error: "bun: command not found"

Instala Bun siguiendo las instrucciones oficiales:

```bash
curl -fsSL https://bun.sh/install | bash
```

### Error: "Cannot find module"

Asegúrate de ejecutar `bun install` en el directorio del proyecto.

### Error de Permisos en Base de Datos

En sistemas Unix/Linux:

```bash
chmod 666 auth.db
# o
chmod 777 .
```

### Puerto 3000 en Uso

Cambia el puerto en el archivo `.env`:

```bash
PORT=3001
```

## 📚 Próximos Pasos

- [Configurar Variables de Entorno](environment.md)
- [Explorar la API de Autenticación](../auth/authentication-api.md)
- [Configurar OAuth](../auth/oauth-oidc.md)

## 🤝 Contribuir

¿Encontraste un problema en la instalación? [Abre un issue](https://github.com/tu-usuario/openbauth-panel/issues) o [contribuye](CONTRIBUTING.md) con una mejora.