import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { initializeApp, app } from "../../src/index";
import { testUtils, TEST_TIMEOUTS } from "../setup";

describe("User API - Comprehensive Tests", () => {
    let baseUrl: string;
    let server: any;

    beforeEach(async () => {
        await initializeApp();
        server = Bun.serve({
            port: 0,
            fetch: app.fetch
        });
        baseUrl = `http://localhost:${server.port}/api/v1`;
    });

    afterEach(() => {
        if (server) server.stop();
    });

    async function createAuthenticatedUser() {
        const userData = testUtils.generateTestUser();
        const signupResponse = await fetch(`${baseUrl}/auth/signup`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(userData)
        });
        const signupResult = await signupResponse.json() as any;
        return {
            user: signupResult.user,
            token: signupResult.token,
            userData
        };
    }

    describe("GET /user/me", () => {
        test("should retrieve user profile with authentication", async () => {
            const { token, userData } = await createAuthenticatedUser();

            const profileResponse = await fetch(`${baseUrl}/user/me`, {
                method: "GET",
                headers: { "Authorization": `Bearer ${token}` }
            });

            expect(profileResponse.status).toBe(200);
            const profileResult = await profileResponse.json() as any;
            expect(profileResult.success).toBe(true);
            expect(profileResult.user.email).toBe(userData.email);
            expect(profileResult.user.username).toBe(userData.username);
            expect(profileResult.user.devices).toBeDefined();
            expect(profileResult.user.mfaEnabled).toBeDefined();
            expect(profileResult.user.mfaMethods).toBeDefined();
        }, TEST_TIMEOUTS.MEDIUM);

        test("should reject request without authentication", async () => {
            const profileResponse = await fetch(`${baseUrl}/user/me`, {
                method: "GET"
            });

            expect(profileResponse.status).toBe(401);
        }, TEST_TIMEOUTS.MEDIUM);

        test("should reject request with invalid token", async () => {
            const profileResponse = await fetch(`${baseUrl}/user/me`, {
                method: "GET",
                headers: { "Authorization": `Bearer invalid-token` }
            });

            expect(profileResponse.status).toBe(401);
        }, TEST_TIMEOUTS.MEDIUM);
    });

    describe("PATCH /user/me", () => {
        test("should update user profile", async () => {
            const { token } = await createAuthenticatedUser();

            const updateResponse = await fetch(`${baseUrl}/user/me`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    first_name: "Updated",
                    last_name: "User",
                    bio: "This is my bio",
                    timezone: "America/New_York"
                })
            });

            expect(updateResponse.status).toBe(200);
            const updateResult = await updateResponse.json() as any;
            expect(updateResult.success).toBe(true);
            expect(updateResult.user.first_name).toBe("Updated");
            expect(updateResult.user.last_name).toBe("User");
            expect(updateResult.user.bio).toBe("This is my bio");
            expect(updateResult.user.timezone).toBe("America/New_York");
        }, TEST_TIMEOUTS.MEDIUM);

        test("should reject update with invalid data", async () => {
            const { token } = await createAuthenticatedUser();

            const updateResponse = await fetch(`${baseUrl}/user/me`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    first_name: "A", // Too short
                })
            });

            expect(updateResponse.status).toBe(400);
            const updateResult = await updateResponse.json() as any;
            expect(updateResult.success).toBe(false);
            expect(updateResult.error).toBe("Validation error");
        }, TEST_TIMEOUTS.MEDIUM);

        test("should reject update with duplicate email", async () => {
            // Create two users
            const { token: token1 } = await createAuthenticatedUser();
            const { userData: userData2 } = await createAuthenticatedUser();

            // Try to update user1 with user2's email
            const updateResponse = await fetch(`${baseUrl}/user/me`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token1}`
                },
                body: JSON.stringify({
                    email: userData2.email
                })
            });

            expect(updateResponse.status).toBe(400);
            const updateResult = await updateResponse.json() as any;
            expect(updateResult.success).toBe(false);
            expect(updateResult.error).toContain("already in use");
        }, TEST_TIMEOUTS.MEDIUM);

        test("should reject update without authentication", async () => {
            const updateResponse = await fetch(`${baseUrl}/user/me`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ first_name: "Updated" })
            });

            expect(updateResponse.status).toBe(401);
        }, TEST_TIMEOUTS.MEDIUM);
    });

    describe("POST /user/password", () => {
        test("should update password with correct current password", async () => {
            const { token, userData } = await createAuthenticatedUser();

            const updatePasswordResponse = await fetch(`${baseUrl}/user/password`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    currentPassword: userData.password,
                    newPassword: "newsecurepassword123",
                    confirmPassword: "newsecurepassword123"
                })
            });

            expect(updatePasswordResponse.status).toBe(200);
            const result = await updatePasswordResponse.json() as any;
            expect(result.success).toBe(true);
            expect(result.message).toContain("successfully");

            // Verify can login with new password
            const loginResponse = await fetch(`${baseUrl}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: userData.email,
                    password: "newsecurepassword123"
                })
            });

            expect(loginResponse.status).toBe(200);
        }, TEST_TIMEOUTS.MEDIUM);

        test("should reject password update with incorrect current password", async () => {
            const { token } = await createAuthenticatedUser();

            const updatePasswordResponse = await fetch(`${baseUrl}/user/password`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    currentPassword: "wrongpassword",
                    newPassword: "newsecurepassword123",
                    confirmPassword: "newsecurepassword123"
                })
            });

            expect(updatePasswordResponse.status).toBe(400);
            const result = await updatePasswordResponse.json() as any;
            expect(result.success).toBe(false);
            expect(result.error).toContain("incorrect");
        }, TEST_TIMEOUTS.MEDIUM);

        test("should reject password update with mismatched passwords", async () => {
            const { token, userData } = await createAuthenticatedUser();

            const updatePasswordResponse = await fetch(`${baseUrl}/user/password`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    currentPassword: userData.password,
                    newPassword: "newsecurepassword123",
                    confirmPassword: "differentpassword123"
                })
            });

            expect(updatePasswordResponse.status).toBe(400);
            const result = await updatePasswordResponse.json() as any;
            expect(result.success).toBe(false);
            expect(result.error).toBe("Validation error");
        }, TEST_TIMEOUTS.MEDIUM);

        test("should reject password update with short password", async () => {
            const { token, userData } = await createAuthenticatedUser();

            const updatePasswordResponse = await fetch(`${baseUrl}/user/password`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    currentPassword: userData.password,
                    newPassword: "short",
                    confirmPassword: "short"
                })
            });

            expect(updatePasswordResponse.status).toBe(400);
            const result = await updatePasswordResponse.json() as any;
            expect(result.success).toBe(false);
            expect(result.error).toBe("Validation error");
        }, TEST_TIMEOUTS.MEDIUM);
    });

    describe("Device Management", () => {
        describe("GET /user/devices", () => {
            test("should retrieve user devices", async () => {
                const { token } = await createAuthenticatedUser();

                const devicesResponse = await fetch(`${baseUrl}/user/devices`, {
                    headers: { "Authorization": `Bearer ${token}` }
                });

                expect(devicesResponse.status).toBe(200);
                const result = await devicesResponse.json() as any;
                expect(result.success).toBe(true);
                expect(Array.isArray(result.devices)).toBe(true);
            }, TEST_TIMEOUTS.MEDIUM);

            test("should reject request without authentication", async () => {
                const devicesResponse = await fetch(`${baseUrl}/user/devices`);

                expect(devicesResponse.status).toBe(401);
            }, TEST_TIMEOUTS.MEDIUM);
        });

        describe("POST /user/devices", () => {
            test("should register new device", async () => {
                const { token } = await createAuthenticatedUser();

                const deviceData = {
                    deviceId: crypto.randomUUID(),
                    deviceName: "Test Device",
                    deviceType: "mobile",
                    platform: "iOS",
                    userAgent: "Test User Agent"
                };

                const registerResponse = await fetch(`${baseUrl}/user/devices`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify(deviceData)
                });

                expect(registerResponse.status).toBe(200);
                const result = await registerResponse.json() as any;
                expect(result.success).toBe(true);
                expect(result.device).toBeDefined();
                expect(result.device.device_id).toBe(deviceData.deviceId);
                expect(result.device.device_name).toBe(deviceData.deviceName);
            }, TEST_TIMEOUTS.MEDIUM);

            test("should reject device registration with invalid device type", async () => {
                const { token } = await createAuthenticatedUser();

                const deviceData = {
                    deviceId: crypto.randomUUID(),
                    deviceName: "Test Device",
                    deviceType: "invalid-type" // Invalid
                };

                const registerResponse = await fetch(`${baseUrl}/user/devices`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify(deviceData)
                });

                expect(registerResponse.status).toBe(400);
                const result = await registerResponse.json() as any;
                expect(result.success).toBe(false);
                expect(result.error).toBe("Validation error");
            }, TEST_TIMEOUTS.MEDIUM);

            test("should reject device registration with missing required fields", async () => {
                const { token } = await createAuthenticatedUser();

                const registerResponse = await fetch(`${baseUrl}/user/devices`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify({ deviceId: crypto.randomUUID() })
                });

                expect(registerResponse.status).toBe(400);
            }, TEST_TIMEOUTS.MEDIUM);
        });
    });

    describe("MFA Management", () => {
        describe("POST /user/mfa/setup", () => {
            test("should setup TOTP MFA", async () => {
                const { token } = await createAuthenticatedUser();

                const setupResponse = await fetch(`${baseUrl}/user/mfa/setup`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify({ mfaType: "totp" })
                });

                expect(setupResponse.status).toBe(200);
                const result = await setupResponse.json() as any;
                expect(result.success).toBe(true);
                expect(result.mfaType).toBe("totp");
                expect(result.message).toContain("initiated");
            }, TEST_TIMEOUTS.MEDIUM);

            test("should setup SMS MFA with phone number", async () => {
                const { token } = await createAuthenticatedUser();

                const setupResponse = await fetch(`${baseUrl}/user/mfa/setup`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        mfaType: "sms",
                        phoneNumber: "+1234567890"
                    })
                });

                expect(setupResponse.status).toBe(200);
                const result = await setupResponse.json() as any;
                expect(result.success).toBe(true);
                expect(result.mfaType).toBe("sms");
            }, TEST_TIMEOUTS.MEDIUM);

            test("should setup email MFA", async () => {
                const { token } = await createAuthenticatedUser();

                const setupResponse = await fetch(`${baseUrl}/user/mfa/setup`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        mfaType: "email",
                        email: "test@example.com"
                    })
                });

                expect(setupResponse.status).toBe(200);
                const result = await setupResponse.json() as any;
                expect(result.success).toBe(true);
                expect(result.mfaType).toBe("email");
            }, TEST_TIMEOUTS.MEDIUM);

            test("should reject SMS MFA setup without phone number", async () => {
                const { token } = await createAuthenticatedUser();

                const setupResponse = await fetch(`${baseUrl}/user/mfa/setup`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify({ mfaType: "sms" })
                });

                expect(setupResponse.status).toBe(400);
                const result = await setupResponse.json() as any;
                expect(result.success).toBe(false);
                expect(result.error).toContain("Phone number is required");
            }, TEST_TIMEOUTS.MEDIUM);

            test("should reject MFA setup with invalid MFA type", async () => {
                const { token } = await createAuthenticatedUser();

                const setupResponse = await fetch(`${baseUrl}/user/mfa/setup`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify({ mfaType: "invalid-type" })
                });

                expect(setupResponse.status).toBe(400);
                const result = await setupResponse.json() as any;
                expect(result.success).toBe(false);
                expect(result.error).toBe("Validation error");
            }, TEST_TIMEOUTS.MEDIUM);
        });

        describe("POST /user/mfa/verify", () => {
            test("should reject verification without MFA setup", async () => {
                const { token } = await createAuthenticatedUser();

                const verifyResponse = await fetch(`${baseUrl}/user/mfa/verify`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        code: "123456",
                        mfaType: "totp"
                    })
                });

                // Should fail because MFA is not set up
                expect(verifyResponse.status).toBe(400);
            }, TEST_TIMEOUTS.MEDIUM);

            test("should reject MFA verification with invalid code format", async () => {
                const { token } = await createAuthenticatedUser();

                const verifyResponse = await fetch(`${baseUrl}/user/mfa/verify`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        code: "123", // Too short
                        mfaType: "totp"
                    })
                });

                expect(verifyResponse.status).toBe(400);
                const result = await verifyResponse.json() as any;
                expect(result.success).toBe(false);
                expect(result.error).toBe("Validation error");
            }, TEST_TIMEOUTS.MEDIUM);
        });
    });

    describe("Biometric Management", () => {
        describe("POST /user/biometric", () => {
            test("should register biometric credential", async () => {
                const { token } = await createAuthenticatedUser();

                const biometricData = {
                    biometricType: "fingerprint",
                    encryptedData: "encrypted_biometric_data_here",
                    deviceId: crypto.randomUUID()
                };

                const registerResponse = await fetch(`${baseUrl}/user/biometric`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify(biometricData)
                });

                expect(registerResponse.status).toBe(200);
                const result = await registerResponse.json() as any;
                expect(result.success).toBe(true);
                expect(result.credential).toBeDefined();
            }, TEST_TIMEOUTS.MEDIUM);

            test("should reject biometric registration with invalid type", async () => {
                const { token } = await createAuthenticatedUser();

                const biometricData = {
                    biometricType: "invalid-type",
                    encryptedData: "encrypted_biometric_data_here",
                    deviceId: crypto.randomUUID()
                };

                const registerResponse = await fetch(`${baseUrl}/user/biometric`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify(biometricData)
                });

                expect(registerResponse.status).toBe(400);
                const result = await registerResponse.json() as any;
                expect(result.success).toBe(false);
                expect(result.error).toBe("Validation error");
            }, TEST_TIMEOUTS.MEDIUM);

            test("should reject biometric registration with missing fields", async () => {
                const { token } = await createAuthenticatedUser();

                const registerResponse = await fetch(`${baseUrl}/user/biometric`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        biometricType: "fingerprint"
                        // Missing encryptedData and deviceId
                    })
                });

                expect(registerResponse.status).toBe(400);
            }, TEST_TIMEOUTS.MEDIUM);
        });
    });
});
