import { homedir } from "node:os";
import { join } from "node:path";
import { mkdirSync, readFileSync, writeFileSync, chmodSync, existsSync } from "node:fs";

/** Objet stocké dans localStorage.auth du web app + repris tel quel ici. */
export interface AuthData {
  access_token: string;
  refresh_token: string;
  refresh_token_expires_at?: string; // ISO
  token_type?: string;
  client_id?: string;
  session_id?: string;
  cloudFrontCookies?: Record<string, string>;
}

export interface Settings {
  /** Comptes à interroger AVEC période TVA (`periods=`). Les autres sont filtrés par valueDate. */
  fiscalAccounts: string[];
}

export interface Config {
  auth: AuthData | null;
  settings: Settings;
}

const DEFAULT_SETTINGS: Settings = {
  // Comptes interrogés par période TVA (le compte pro principal). Vide par défaut :
  // à renseigner via config.json (settings.fiscalAccounts) ou ACCOUNTABLE_FISCAL_ACCOUNTS.
  fiscalAccounts: [],
};

export function configDir(): string {
  const base = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
  return join(base, "accountable");
}

export function configPath(): string {
  return join(configDir(), "config.json");
}

export function loadConfig(): Config {
  // Priorité aux variables d'env (utile en CI / one-shot).
  const envToken = process.env.ACCOUNTABLE_TOKEN;
  const envRefresh = process.env.ACCOUNTABLE_REFRESH_TOKEN;

  let fromFile: Partial<Config> = {};
  const path = configPath();
  if (existsSync(path)) {
    try {
      fromFile = JSON.parse(readFileSync(path, "utf8"));
    } catch {
      process.stderr.write(`⚠️  config illisible à ${path}, ignorée\n`);
    }
  }

  let auth: AuthData | null = fromFile.auth ?? null;
  if (envToken) {
    auth = {
      access_token: envToken,
      refresh_token: envRefresh ?? auth?.refresh_token ?? "",
      refresh_token_expires_at: auth?.refresh_token_expires_at,
    };
  }

  const settings: Settings = { ...DEFAULT_SETTINGS, ...(fromFile.settings ?? {}) };
  // L'env a priorité (utile en CI / one-shot) : liste d'IBAN séparés par des virgules.
  const envFiscal = process.env.ACCOUNTABLE_FISCAL_ACCOUNTS;
  if (envFiscal) {
    settings.fiscalAccounts = envFiscal
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  return { auth, settings };
}

export function saveConfig(config: Config): void {
  const dir = configDir();
  mkdirSync(dir, { recursive: true });
  const path = configPath();
  writeFileSync(path, JSON.stringify(config, null, 2), "utf8");
  try {
    chmodSync(path, 0o600);
  } catch {
    /* best-effort */
  }
}

export function saveAuth(auth: AuthData): void {
  const cfg = loadConfig();
  cfg.auth = auth;
  saveConfig(cfg);
}
