import app from "./src/index";

async function debugTokenIssue() {
  console.log("=== Debug Token Issue ===");
  
  // 1. Registrar usuario
  console.log("\n1. Registrando usuario...");
  const signupResponse = await app.request("/auth/v1/signup", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: "debug@test.com",
      password: "password123",
      username: "debuguser",
      first_name: "Debug",
      last_name: "User",
    }),
  });
  
  console.log("Signup status:", signupResponse.status);
  const signupData = await signupResponse.json();
  console.log("Signup data:", JSON.stringify(signupData, null, 2));
  
  // 2. Hacer login
  console.log("\n2. Haciendo login...");
  const loginResponse = await app.request("/auth/v1/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      grant_type: "password",
      email: "debug@test.com",
      password: "password123",
    }),
  });
  
  console.log("Login status:", loginResponse.status);
  const loginData = await loginResponse.json();
  console.log("Login data:", JSON.stringify(loginData, null, 2));
  
  // 3. Intentar acceder a /auth/v1/user
  console.log("\n3. Accediendo a /auth/v1/user...");
  const userResponse = await app.request("/auth/v1/user", {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${loginData.access_token}`,
    },
  });
  
  console.log("User endpoint status:", userResponse.status);
  const userData = await userResponse.json();
  console.log("User data:", JSON.stringify(userData, null, 2));
  
  // 4. Verificar formato del token
  console.log("\n4. Analizando token...");
  console.log("Access token:", loginData.access_token);
  console.log("Token length:", loginData.access_token?.length);
  console.log("Token starts with:", loginData.access_token?.substring(0, 20) + "...");
  
  // 5. Intentar con refresh token
  console.log("\n5. Intentando con refresh token...");
  const userResponse2 = await app.request("/auth/v1/user", {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${loginData.refresh_token}`,
    },
  });
  
  console.log("User endpoint status (con refresh token):", userResponse2.status);
  const userData2 = await userResponse2.json();
  console.log("User data (con refresh token):", JSON.stringify(userData2, null, 2));
}

debugTokenIssue().catch(console.error);