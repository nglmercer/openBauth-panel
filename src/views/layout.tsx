import { html } from 'hono/html'

export const Layout = (props: { children: any; title: string }) => {
    return html`
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${props.title}</title>
        <script src="https://unpkg.com/htmx.org@1.9.10"></script>
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body class="bg-gray-900 text-white min-h-screen flex items-center justify-center">
        ${props.children}
      </body>
    </html>
  `
}
