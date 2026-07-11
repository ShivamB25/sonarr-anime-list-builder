import { afterEach, describe, expect, test } from "bun:test";
import { api, ApiError } from "../src/client/api";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function installFetch(
  response: Response,
  inspect?: (
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1]
  ) => void
) {
  const fetchStub = async (
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1]
  ) => {
    inspect?.(input, init);
    return response;
  };
  globalThis.fetch = fetchStub as typeof fetch;
}

describe("client API request policy", () => {
  test("includes browser credentials on API requests", async () => {
    let credentials: string | undefined;
    installFetch(Response.json([]), (_input, init) => {
      credentials = init?.credentials;
    });

    await api.lists.getAll();

    expect(credentials).toBe("include");
  });

  test("adds a JSON content type when the request has a body", async () => {
    let contentType: string | null | undefined;
    installFetch(Response.json({ id: "list-1" }, { status: 201 }), (_input, init) => {
      contentType = new Headers(init?.headers).get("content-type");
    });

    await api.lists.create("Favorites");

    expect(contentType).toBe("application/json");
  });

  test("does not add a content type when the request has no body", async () => {
    let contentType: string | null = "unexpected";
    installFetch(Response.json([]), (_input, init) => {
      contentType = new Headers(init?.headers).get("content-type");
    });

    await api.lists.getAll();

    expect(contentType).toBeNull();
  });
});

describe("ApiError response handling", () => {
  test("uses the server error message from a JSON error response", async () => {
    installFetch(Response.json({ error: "List not found" }, { status: 404 }));

    const operation = api.lists.get("missing");

    await expect(operation).rejects.toEqual(
      expect.objectContaining({
        name: "ApiError",
        status: 404,
        message: "List not found",
      })
    );
  });

  test("falls back to the HTTP status when the JSON error body is null", async () => {
    installFetch(Response.json(null, { status: 502 }));

    const operation = api.lists.getAll();

    await expect(operation).rejects.toEqual(
      expect.objectContaining({ status: 502, message: "HTTP 502" })
    );
  });

  test("falls back to the HTTP status when the error body is not JSON", async () => {
    installFetch(new Response("upstream unavailable", { status: 503 }));

    const operation = api.lists.getAll();

    await expect(operation).rejects.toEqual(
      expect.objectContaining({ status: 503, message: "HTTP 503" })
    );
  });

  test("throws errors that are instances of ApiError", async () => {
    installFetch(Response.json({ error: "Unauthorized" }, { status: 401 }));

    try {
      await api.lists.getAll();
      throw new Error("Expected request to reject");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
    }
  });
});
