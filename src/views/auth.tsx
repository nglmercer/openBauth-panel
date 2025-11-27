import { html } from 'hono/html'
import { Layout } from './layout'

export const LoginForm = (props: { error?: string, email?: string }) => {
    return (
        <form hx-post="/auth/ssr/login" hx-swap="outerHTML" class="space-y-4">
            <div>
                <label class="block text-sm font-medium text-gray-400">Email</label>
                <input
                    type="email"
                    name="email"
                    value={props.email || ''}
                    required
                    class="w-full px-4 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-400">Contraseña</label>
                <input
                    type="password"
                    name="password"
                    required
                    class="w-full px-4 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
            </div>
            <button
                type="submit"
                class="w-full px-4 py-2 font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
                Entrar
            </button>
            {props.error && (
                <div id="error-message" class="text-red-500 text-sm text-center">
                    {props.error}
                </div>
            )}
        </form>
    )
}

export const LoginPage = () => {
    return (
        <Layout title="Iniciar Sesión">
            <div class="w-full max-w-md p-8 space-y-6 bg-gray-800 rounded-xl shadow-lg">
                <h2 class="text-2xl font-bold text-center text-white">Iniciar Sesión</h2>
                <LoginForm />
                <p class="text-sm text-center text-gray-400">
                    ¿No tienes cuenta? <a href="/auth/ssr/register" class="text-blue-400 hover:underline">Regístrate</a>
                </p>
            </div>
        </Layout>
    )
}

export const RegisterForm = (props: { error?: string, values?: any }) => {
    return (
        <form hx-post="/auth/ssr/register" hx-swap="outerHTML" class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="block text-sm font-medium text-gray-400">Nombre</label>
                    <input type="text" name="first_name" value={props.values?.first_name || ''} required class="w-full px-4 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-400">Apellido</label>
                    <input type="text" name="last_name" value={props.values?.last_name || ''} required class="w-full px-4 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                </div>
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-400">Usuario</label>
                <input type="text" name="username" value={props.values?.username || ''} required class="w-full px-4 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none" />
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-400">Email</label>
                <input type="email" name="email" value={props.values?.email || ''} required class="w-full px-4 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none" />
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-400">Contraseña</label>
                <input type="password" name="password" required class="w-full px-4 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none" />
            </div>
            <button
                type="submit"
                class="w-full px-4 py-2 font-bold text-white bg-green-600 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
                Registrarse
            </button>
            {props.error && (
                <div id="error-message" class="text-red-500 text-sm text-center">
                    {props.error}
                </div>
            )}
        </form>
    )
}

export const RegisterPage = () => {
    return (
        <Layout title="Registro">
            <div class="w-full max-w-md p-8 space-y-6 bg-gray-800 rounded-xl shadow-lg">
                <h2 class="text-2xl font-bold text-center text-white">Crear Cuenta</h2>
                <RegisterForm />
                <p class="text-sm text-center text-gray-400">
                    ¿Ya tienes cuenta? <a href="/auth/ssr/login" class="text-blue-400 hover:underline">Inicia Sesión</a>
                </p>
            </div>
        </Layout>
    )
}
