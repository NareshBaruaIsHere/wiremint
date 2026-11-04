import { describe, expect, it } from "vitest";
import { createWiremint } from "../../src/index.js";
import { createWiremintTestClient } from "../../src/testing/index.js";
import { wiremintMatchers } from "../../src/testing/vitest/index.js";

// Register custom Vitest matchers
expect.extend(wiremintMatchers);

describe("Wiremint Vitest Integration", () => {
  const app = createWiremint();

  app.get("/api/user", () => ({
    status: 200,
    headers: { "x-service": "wiremint-mock" },
    body: { id: "u-100", name: "Naresh", role: "admin" },
  }));

  app.post("/api/user", ({ body }) => ({
    status: 201,
    headers: { "x-created-by": "wiremint" },
    body: { created: true, data: body },
  }));

  app.get("/api/protected", () => ({
    status: 401,
    body: { error: "Unauthorized access" },
  }));

  const client = createWiremintTestClient(app);

  it("verifies HTTP responses using custom Vitest matchers", async () => {
    // 1. Successful GET
    const res = await client.get("/api/user");
    expect(res).toHaveStatus(200);
    expect(res).toBeSuccessful();
    expect(res).toHaveHeader("x-service", "wiremint-mock");
    expect(res).toMatchJson({ id: "u-100", name: "Naresh" });

    // 2. Resource creation POST
    const createdRes = await client.post("/api/user", {
      body: { name: "Rahim" },
    });
    expect(createdRes).toHaveStatus(201);
    expect(createdRes).toBeSuccessful();
    expect(createdRes).toHaveHeader("x-created-by");
    expect(createdRes).toMatchJson({ created: true });

    // 3. Client error
    const errRes = await client.get("/api/protected");
    expect(errRes).toHaveStatus(401);
    expect(errRes).toBeClientError();
  });
});

