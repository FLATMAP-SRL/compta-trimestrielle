import type { AuthData } from "./config.js";

const BASE_URL = process.env.ACCOUNTABLE_BASE_URL || "https://app.accountable.eu/api";
const REFRESH_ENDPOINT = `${BASE_URL}/v2/users/refresh-access-token`;

export class AuthError extends Error {}

interface JwtPayload {
  exp?: number;
  iat?: number;
  sub?: string;
  [k: string]: unknown;
}

export function decodeJwt(token: string): JwtPayload {
  const seg = token.split(".")[1];
  if (!seg) throw new AuthError("Token JWT invalide");
  const json = Buffer.from(seg, "base64url").toString("utf8");
  return JSON.parse(json) as JwtPayload;
}

/** true si l'access token est expiré (marge de 60 s). */
export function isAccessExpired(auth: AuthData): boolean {
  try {
    const { exp } = decodeJwt(auth.access_token);
    if (!exp) return true;
    return Date.now() >= exp * 1000 - 60_000;
  } catch {
    return true;
  }
}

/** true si le refresh token est expiré (impossible de rafraîchir sans re-login). */
export function isRefreshExpired(auth: AuthData): boolean {
  if (!auth.refresh_token) return true;
  if (!auth.refresh_token_expires_at) return false; // inconnu → on tente
  return Date.now() >= Date.parse(auth.refresh_token_expires_at);
}

/**
 * Rafraîchit l'access token via l'endpoint du web app.
 * Le refresh_token NE tourne PAS : on conserve refresh_token & refresh_token_expires_at,
 * on met à jour access_token et cloudFrontCookies.
 */
export async function refreshAccessToken(auth: AuthData): Promise<AuthData> {
  if (isRefreshExpired(auth)) {
    throw new AuthError(
      "Le refresh token a expiré (~12 h). Relance `accountable login` en recollant localStorage.auth.",
    );
  }
  const res = await fetch(REFRESH_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: auth.refresh_token }),
  });
  if (!res.ok) {
    throw new AuthError(
      `Échec du refresh (HTTP ${res.status}). Relance \`accountable login\`.`,
    );
  }
  const data = (await res.json()) as {
    access_token?: string;
    token_type?: string;
    cloudFrontCookies?: Record<string, string>;
  };
  if (!data.access_token) throw new AuthError("Réponse de refresh sans access_token");
  return {
    ...auth,
    access_token: data.access_token,
    token_type: data.token_type ?? auth.token_type,
    cloudFrontCookies: data.cloudFrontCookies ?? auth.cloudFrontCookies,
  };
}

export function tokenSummary(auth: AuthData): {
  accessExpiresAt: Date | null;
  refreshExpiresAt: Date | null;
  sub?: string;
} {
  let accessExpiresAt: Date | null = null;
  let sub: string | undefined;
  try {
    const p = decodeJwt(auth.access_token);
    if (p.exp) accessExpiresAt = new Date(p.exp * 1000);
    sub = p.sub;
  } catch {
    /* ignore */
  }
  return {
    accessExpiresAt,
    refreshExpiresAt: auth.refresh_token_expires_at ? new Date(auth.refresh_token_expires_at) : null,
    sub,
  };
}
