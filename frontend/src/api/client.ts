export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}

export async function request<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
    const e = body?.error ?? { code: 'UNKNOWN', message: res.statusText };

    throw new ApiError(res.status, e.code, e.message, e.details);
  }

  return res.json() as Promise<T>;
}
