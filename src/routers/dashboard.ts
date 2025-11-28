// src/routers/dashboard.ts
import { Hono } from "hono";
import { html } from "hono/html";
import { BaseController } from "open-bauth"; // Ajusta imports
import { getSchemas, getDefaultSchemas } from "../database/base-controller";
import { dbInitializer, db } from "../db"; // Tu instancia de DB
import { ZodSchemaGenerator } from "../validator/schema-generator";

const dashboard = new Hono();

// Layout Base
const layout = (content: any, title: string = "Dashboard") => html`
  <!DOCTYPE html>
  <html>
    <head>
      <title>${title}</title>
      <script src="https://unpkg.com/htmx.org@1.9.10"></script>
      <script src="https://cdn.tailwindcss.com"></script>
      <link
        href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css"
        rel="stylesheet"
      />
    </head>
    <body class="bg-gray-900 text-gray-100 min-h-screen flex">
      <aside class="w-64 bg-gray-800 border-r border-gray-700 p-4">
        <h1 class="text-2xl font-bold mb-6 text-blue-400">Admin Panel</h1>
        <nav class="space-y-2" hx-boost="true">
          <a href="/dashboard" class="block p-2 hover:bg-gray-700 rounded"
            >Inicio</a
          >
          <div class="pt-4 pb-2 text-xs text-gray-500 uppercase">Tablas</div>
          ${html`${getDefaultSchemas().map(
            (s) => html`
              <a
                href="/dashboard/table/${s.tableName}"
                class="block p-2 hover:bg-gray-700 rounded flex justify-between"
              >
                <span>${s.tableName}</span>
                <i class="fas fa-table text-gray-500"></i>
              </a>
            `,
          )}`}
        </nav>
      </aside>

      <main class="flex-1 p-8 overflow-y-auto" id="main-content">
        ${content}
      </main>
    </body>
  </html>
`;

// 1. Home del Dashboard
dashboard.get("/", (c) => {
  return c.html(
    layout(html`
      <h2 class="text-3xl font-bold mb-4">Bienvenido</h2>
      <p>Selecciona una tabla del menú lateral para administrar los datos.</p>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
        ${html`${getDefaultSchemas().map(
          (s) => html`
            <div
              class="bg-gray-800 p-6 rounded-lg shadow border border-gray-700"
            >
              <h3 class="text-xl font-bold mb-2">${s.tableName}</h3>
              <p class="text-gray-400 text-sm mb-4">
                ${s.columns.length} columnas
              </p>
              <a
                href="/dashboard/table/${s.tableName}"
                class="text-blue-400 hover:underline"
                >Administrar &rarr;</a
              >
            </div>
          `,
        )}`}
      </div>
    `),
  );
});

// 2. Vista de Tabla (Lista de registros)
dashboard.get("/table/:tableName", async (c) => {
  const tableName = c.req.param("tableName");
  const schemas = getDefaultSchemas();
  const schema = schemas.find((s) => s.tableName === tableName);

  if (!schema) return c.html(layout(html`<h1>Tabla no encontrada</h1>`));

  // Inicializar controlador genérico
  const controller = new BaseController(tableName, {
    database: db,
    isSQLite: true,
  }); // Asumiendo SQLite por tu código
  const result = await controller.findAll({ limit: 50 });

  const columns = schema.columns.map((col) => col.name);

  return c.html(
    layout(
      html`
        <div class="flex justify-between items-center mb-6">
          <h2 class="text-3xl font-bold capitalize">${tableName}</h2>
          <a
            href="/dashboard/table/${tableName}/create"
            class="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded text-white shadow"
          >
            <i class="fas fa-plus mr-2"></i> Crear Nuevo
          </a>
        </div>

        <div
          class="bg-gray-800 rounded-lg shadow overflow-x-auto border border-gray-700"
        >
          <table class="w-full text-left border-collapse">
            <thead class="bg-gray-700 text-gray-300">
              <tr>
                ${html`${columns.map(
                  (col) =>
                    html`<th class="p-3 border-b border-gray-600">${col}</th>`,
                )}`}
                <th class="p-3 border-b border-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${html`${result.data?.map(
                (row: any) => html`
                  <tr class="hover:bg-gray-750 border-b border-gray-700">
                    ${html`${columns.map(
                      (col) =>
                        html`<td class="p-3 truncate max-w-xs">
                          ${row[col]}
                        </td>`,
                    )}`}
                    <td class="p-3">
                      <button
                        hx-delete="/dashboard/table/${tableName}/${row.id}"
                        hx-confirm="¿Seguro que deseas eliminar?"
                        hx-target="closest tr"
                        class="text-red-400 hover:text-red-300"
                      >
                        <i class="fas fa-trash"></i>
                      </button>
                    </td>
                  </tr>
                `,
              )}`}
            </tbody>
          </table>
          ${!result.data?.length
            ? html`<p class="p-4 text-center text-gray-500">
                No hay datos aún.
              </p>`
            : ""}
        </div>
      `,
      `Admin - ${tableName}`,
    ),
  );
});

// 3. Formulario de Creación
dashboard.get("/table/:tableName/create", (c) => {
  const tableName = c.req.param("tableName");
  const schemas = getDefaultSchemas();
  const schema = schemas.find((s) => s.tableName === tableName);
  if (!schema) return c.redirect("/dashboard");

  return c.html(
    layout(html`
      <div class="max-w-2xl mx-auto">
        <h2 class="text-2xl font-bold mb-6">Crear en ${tableName}</h2>
        <form
          action="/dashboard/table/${tableName}"
          method="POST"
          class="space-y-4"
        >
          ${html`${schema.columns.map((col) => {
            if (col.primaryKey && col.autoIncrement) return ""; // No mostrar ID
            if (col.defaultValue === "CURRENT_TIMESTAMP") return "";

            let inputType = "text";
            if (col.type.includes("INT") || col.type.includes("REAL"))
              inputType = "number";
            if (col.type.includes("DATE")) inputType = "datetime-local";
            if (col.type.includes("BOOLEAN")) inputType = "checkbox";
            if (col.name.includes("password")) inputType = "password";

            return html`
              <div>
                <label class="block text-sm font-medium text-gray-400 mb-1"
                  >${col.name}</label
                >
                ${inputType === "checkbox"
                  ? html`<input
                      type="checkbox"
                      name=${col.name}
                      value="true"
                      class="rounded bg-gray-700 border-gray-600 text-blue-500 focus:ring-blue-500 h-5 w-5"
                    />`
                  : html`<input
                      type=${inputType}
                      name=${col.name}
                      class="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                      ${col.notNull && !col.defaultValue ? "required" : ""}
                    />`}
              </div>
            `;
          })}`}

          <div class="pt-4 flex gap-4">
            <button
              type="submit"
              class="bg-blue-600 hover:bg-blue-500 px-6 py-2 rounded text-white"
            >
              Guardar
            </button>
            <a
              href="/dashboard/table/${tableName}"
              class="bg-gray-700 hover:bg-gray-600 px-6 py-2 rounded text-white"
              >Cancelar</a
            >
          </div>
        </form>
      </div>
    `),
  );
});

// 4. Procesar Creación (POST)
dashboard.post("/table/:tableName", async (c) => {
  const tableName = c.req.param("tableName");
  const body = await c.req.parseBody(); // Hono parsea el form data

  const schemas = getDefaultSchemas();
  const schemaDef = schemas.find((s) => s.tableName === tableName);
  if (!schemaDef) return c.text("Schema not found", 400);

  // Generar validadores dinámicamente
  const validators = ZodSchemaGenerator.generate(schemaDef);

  try {
    // Validar y limpiar datos (el ZodGenerator maneja la conversion string -> number)
    const cleanData = validators.create.parse(body);

    const controller = new BaseController(tableName, {
      database: db,
      isSQLite: true,
    });
    const result = await controller.create(cleanData);

    if (!result.success) throw new Error(result.error);

    return c.redirect(`/dashboard/table/${tableName}`);
  } catch (e: any) {
    return c.html(
      layout(html`
        <div class="bg-red-900/50 p-4 rounded border border-red-500 mb-4">
          <h3 class="font-bold text-red-200">Error de Validación</h3>
          <pre class="mt-2 text-sm text-red-300 overflow-auto">
${e.message}</pre
          >
          <a
            href="javascript:history.back()"
            class="mt-4 inline-block text-white underline"
            >Volver</a
          >
        </div>
      `),
    );
  }
});

// 5. Eliminar (DELETE via HTMX)
dashboard.delete("/table/:tableName/:id", async (c) => {
  const tableName = c.req.param("tableName");
  const id = c.req.param("id");

  const controller = new BaseController(tableName, {
    database: db,
    isSQLite: true,
  });
  await controller.delete(id);

  return c.text(""); // HTMX eliminará el elemento del DOM
});

export { dashboard };
