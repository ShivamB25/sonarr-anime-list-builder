import type {
  AnimePage,
  List,
  ListDetail,
  ListItem,
  User,
} from "../shared/types";

const BASE = "/api";

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function errorMessage(body: unknown, status: number): string {
  if (
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof body.error === "string"
  ) {
    return body.error;
  }
  return `HTTP ${status}`;
}

async function readErrorBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${BASE}${path}`, {
    ...options,
    credentials: "include",
    headers,
  });

  if (!response.ok) {
    const body = await readErrorBody(response);
    throw new ApiError(response.status, errorMessage(body, response.status));
  }

  if (response.status === 204) return undefined as T;
  const body: unknown = await response.json();
  return body as T;
}

export const api = {
  auth: {
    session: (signal?: AbortSignal) =>
      request<User>("/auth/session", { signal }),
    register: (username: string, password: string) =>
      request<User>("/auth/register", { method: "POST", body: JSON.stringify({ username, password }) }),
    login: (username: string, password: string) =>
      request<User>("/auth/login", { method: "POST", body: JSON.stringify({ username, password }) }),
    logout: () => request<void>("/auth/logout", { method: "POST" }),
  },
  anime: {
    seasonal: (season: string, year: number, page = 1, signal?: AbortSignal) =>
      request<AnimePage>(`/anime/seasonal?season=${season}&year=${year}&page=${page}`, { signal }),
    search: (q: string, page = 1, signal?: AbortSignal) =>
      request<AnimePage>(`/anime/search?q=${encodeURIComponent(q)}&page=${page}`, { signal }),
  },
  lists: {
    getAll: (signal?: AbortSignal) => request<List[]>("/lists", { signal }),
    create: (name: string, season?: string, year?: number) =>
      request<List>("/lists", { method: "POST", body: JSON.stringify({ name, season, year }) }),
    get: (id: string, signal?: AbortSignal) =>
      request<ListDetail>(`/lists/${id}`, { signal }),
    delete: (id: string) => request<void>(`/lists/${id}`, { method: "DELETE" }),
    addItem: (listId: string, item: Omit<ListItem, "id" | "listId">) =>
      request<ListItem>(`/lists/${listId}/items`, { method: "POST", body: JSON.stringify(item) }),
    removeItem: (listId: string, itemId: string) =>
      request<void>(`/lists/${listId}/items/${itemId}`, { method: "DELETE" }),
  },
};
