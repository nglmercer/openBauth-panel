# Auth SSR API

La API SSR de autenticación proporciona endpoints renderizados del lado del servidor para facilitar la integración con frameworks frontend como SvelteKit, Next.js, etc. Estos endpoints devuelven HTML en lugar de JSON y están diseñados para ser utilizados con HTMX para una experiencia dinámica sin recargas completas de página.

## Base URL

```
http://localhost:3000/auth/ssr
```

## Características

- Renderizado de formularios de login y registro del lado del servidor
- Gestión de autenticación con cookies HTTP-only
- Integración con HTMX para actualizaciones dinámicas
- Redirecciones automáticas después de autenticación exitosa

## Endpoints

### 1. GET /auth/ssr/login

Renderiza la página de login.

**Response (200 OK):**
```html
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login - openBauth Panel</title>
    <!-- Scripts y estilos -->
</head>
<body>
    <div class="container">
        <h1>Iniciar Sesión</h1>
        <form hx-post="/auth/ssr/login" hx-target="body">
            <div class="form-group">
                <label for="email">Email</label>
                <input type="email" id="email" name="email" required>
            </div>
            <div class="form-group">
                <label for="password">Contraseña</label>
                <input type="password" id="password" name="password" required>
            </div>
            <button type="submit">Iniciar Sesión</button>
        </form>
        <p>¿No tienes cuenta? <a href="/auth/ssr/register">Regístrate</a></p>
    </div>
</body>
</html>
```

### 2. POST /auth/ssr/login

Procesa el formulario de login.

**Request Body (form data):**
```
email=user@example.com
password=StrongPassword123
```

**Response (200 OK) - Login exitoso:**
```
(Headers)
HX-Redirect: /dashboard
Set-Cookie: access_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...; Max-Age=900; HttpOnly; Secure; SameSite=Strict; Path=/
Set-Cookie: refresh_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...; Max-Age=604800; HttpOnly; Secure; SameSite=Strict; Path=/
```

**Response (200 OK) - Login fallido:**
```html
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login - openBauth Panel</title>
</head>
<body>
    <div class="container">
        <h1>Iniciar Sesión</h1>
        <div class="error">Credenciales inválidas</div>
        <form hx-post="/auth/ssr/login" hx-target="body">
            <div class="form-group">
                <label for="email">Email</label>
                <input type="email" id="email" name="email" value="user@example.com" required>
            </div>
            <div class="form-group">
                <label for="password">Contraseña</label>
                <input type="password" id="password" name="password" required>
            </div>
            <button type="submit">Iniciar Sesión</button>
        </form>
        <p>¿No tienes cuenta? <a href="/auth/ssr/register">Regístrate</a></p>
    </div>
</body>
</html>
```

### 3. GET /auth/ssr/register

Renderiza la página de registro.

**Response (200 OK):**
```html
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Registro - openBauth Panel</title>
    <!-- Scripts y estilos -->
</head>
<body>
    <div class="container">
        <h1>Crear Cuenta</h1>
        <form hx-post="/auth/ssr/register" hx-target="body">
            <div class="form-group">
                <label for="email">Email</label>
                <input type="email" id="email" name="email" required>
            </div>
            <div class="form-group">
                <label for="username">Nombre de Usuario</label>
                <input type="text" id="username" name="username" required>
            </div>
            <div class="form-group">
                <label for="first_name">Nombre</label>
                <input type="text" id="first_name" name="first_name" required>
            </div>
            <div class="form-group">
                <label for="last_name">Apellido</label>
                <input type="text" id="last_name" name="last_name" required>
            </div>
            <div class="form-group">
                <label for="password">Contraseña</label>
                <input type="password" id="password" name="password" required>
            </div>
            <div class="form-group">
                <label for="confirm_password">Confirmar Contraseña</label>
                <input type="password" id="confirm_password" name="confirm_password" required>
            </div>
            <button type="submit">Crear Cuenta</button>
        </form>
        <p>¿Ya tienes cuenta? <a href="/auth/ssr/login">Inicia Sesión</a></p>
    </div>
</body>
</html>
```

### 4. POST /auth/ssr/register

Procesa el formulario de registro.

**Request Body (form data):**
```
email=newuser@example.com
username=newuser
first_name=New
last_name=User
password=StrongPassword123
confirm_password=StrongPassword123
```

**Response (200 OK) - Registro exitoso:**
```
(Headers)
HX-Redirect: /dashboard
Set-Cookie: access_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...; Max-Age=900; HttpOnly; Secure; SameSite=Strict; Path=/
Set-Cookie: refresh_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...; Max-Age=604800; HttpOnly; Secure; SameSite=Strict; Path=/
```

**Response (200 OK) - Registro fallido:**
```html
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Registro - openBauth Panel</title>
</head>
<body>
    <div class="container">
        <h1>Crear Cuenta</h1>
        <div class="error">Error en el registro</div>
        <form hx-post="/auth/ssr/register" hx-target="body">
            <div class="form-group">
                <label for="email">Email</label>
                <input type="email" id="email" name="email" value="newuser@example.com" required>
            </div>
            <div class="form-group">
                <label for="username">Nombre de Usuario</label>
                <input type="text" id="username" name="username" value="newuser" required>
            </div>
            <div class="form-group">
                <label for="first_name">Nombre</label>
                <input type="text" id="first_name" name="first_name" value="New" required>
            </div>
            <div class="form-group">
                <label for="last_name">Apellido</label>
                <input type="text" id="last_name" name="last_name" value="User" required>
            </div>
            <div class="form-group">
                <label for="password">Contraseña</label>
                <input type="password" id="password" name="password" required>
            </div>
            <div class="form-group">
                <label for="confirm_password">Confirmar Contraseña</label>
                <input type="password" id="confirm_password" name="confirm_password" required>
            </div>
            <button type="submit">Crear Cuenta</button>
        </form>
        <p>¿Ya tienes cuenta? <a href="/auth/ssr/login">Inicia Sesión</a></p>
    </div>
</body>
</html>
```

### 5. POST /auth/ssr/logout

Cierra la sesión del usuario actual.

**Response (200 OK):**
```
(Headers)
HX-Redirect: /auth/ssr/login
Set-Cookie: access_token=; Max-Age=0; HttpOnly; Secure; SameSite=Strict; Path=/
Set-Cookie: refresh_token=; Max-Age=0; HttpOnly; Secure; SameSite=Strict; Path=/
```

## Integración con HTMX

La API SSR está diseñada para funcionar con HTMX, que permite actualizar partes de una página sin recargarla completamente. Los formularios utilizan atributos HTMX como:

- `hx-post`: Especifica la URL a la que se enviará el formulario
- `hx-target`: Especifica el elemento que se actualizará con la respuesta
- `hx-redirect`: Header especial para redirigir después de una acción exitosa

## Flujos de usuario

### Flujo de registro
1. Usuario visita `/auth/ssr/register`
2. Se muestra el formulario de registro
3. Usuario completa el formulario y lo envía
4. Si el registro es exitoso, se redirige a `/dashboard`
5. Si hay errores, se muestra el formulario nuevamente con mensajes de error

### Flujo de login
1. Usuario visita `/auth/ssr/login`
2. Se muestra el formulario de login
3. Usuario completa el formulario y lo envía
4. Si el login es exitoso, se redirige a `/dashboard`
5. Si hay errores, se muestra el formulario nuevamente con mensajes de error

### Flujo de logout
1. Usuario autenticado envía POST a `/auth/ssr/logout`
2. Se eliminan las cookies de autenticación
3. Se redirige a `/auth/ssr/login`

## Seguridad

- Uso de cookies HTTP-only para tokens
- Protección CSRF con SameSite: Strict
- Validación de entrada en el servidor
- Redirección segura después de autenticación
- Tokens con tiempo de expiración configurables

## Personalización

Los templates HTML se pueden personalizar modificando los archivos en `src/views/auth/`. Los estilos y scripts se pueden ajustar según las necesidades del frontend específico.