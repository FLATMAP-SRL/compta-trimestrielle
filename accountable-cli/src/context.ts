import { AccountableClient } from "./client.js";
import { loadConfig, type Config } from "./config.js";
import { AuthError } from "./auth.js";

export function getConfig(): Config {
  return loadConfig();
}

/** Construit le client à partir de la config, ou lève une AuthError explicite si non connecté. */
export function getClient(): { client: AccountableClient; config: Config } {
  const config = loadConfig();
  if (!config.auth?.access_token) {
    throw new AuthError(
      "Pas de session. Lance d'abord `accountable login`.\n" +
        "  Dans la console du navigateur sur web.accountable.eu :  copy(localStorage.getItem('auth'))\n" +
        "  Puis :  accountable login   (et colle la valeur).",
    );
  }
  return { client: new AccountableClient(config.auth), config };
}
