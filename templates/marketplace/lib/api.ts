import { backend } from "@/lib/backend";

// Calling this app's own routes AS the signed-in member.
//
// The token is what proves who is asking. Sending a user id in the body instead
// would let anyone read anyone's feed by typing a different one, so the routes
// only ever trust this header.

export type Called<T> = {
  data: T | null;
  error: string | null;
  needsMembership: boolean;
  signedOut: boolean;
};

export async function callApi<T>(
  path: string,
  init?: RequestInit,
): Promise<Called<T>> {
  // getHttpClient() is the SDK's documented escape hatch for exactly this: a
  // request of your own that still needs the session's token, refreshed if it
  // was about to expire.
  const token = await backend
    .getHttpClient()
    .getValidAccessToken()
    .catch(() => null);

  if (!token) {
    return { data: null, error: null, needsMembership: false, signedOut: true };
  }

  const response = await fetch(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
  const body = (await response.json().catch(() => null)) as
    | (T & { error?: string; needsMembership?: boolean })
    | null;

  if (response.ok) {
    return {
      data: (body as T) ?? null,
      error: null,
      needsMembership: false,
      signedOut: false,
    };
  }
  return {
    data: null,
    error: body?.error ?? "Something went wrong.",
    needsMembership: Boolean(body?.needsMembership),
    signedOut: response.status === 401,
  };
}
