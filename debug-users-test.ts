// Script de depuración para entender el problema con los IDs
import { describe, it, expect } from "bun:test";
import { createFreshApp, createTestUser } from "./tests/test-helpers";

async function debugUserCreation() {
  console.log("=== DEBUG: Iniciando prueba de creación de usuario ===");
  
  try {
    const app = await createFreshApp();
    console.log("App creada exitosamente");
    
    const testUser = await createTestUser(app);
    console.log("Usuario de test creado:", JSON.stringify(testUser, null, 2));
    
    // Intentar crear un usuario via API REST
    const uniqueId = Date.now();
    const response = await app.request("/rest/v1/users", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${testUser.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: `newuser-${uniqueId}@example.com`,
        password: "hashedpassword",
        username: `newuser-${uniqueId}`,
        first_name: "New",
        last_name: "User",
        is_active: true,
      }),
    });
    
    console.log("Response status:", response.status);
    const responseData = await response.json();
    console.log("Response data:", JSON.stringify(responseData, null, 2));
    
  } catch (error) {
    console.error("Error en depuración:", error);
  }
}

// Ejecutar la depuración
debugUserCreation().catch(console.error);