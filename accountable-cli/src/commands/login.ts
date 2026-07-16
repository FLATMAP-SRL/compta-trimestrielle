import { createInterface } from "node:readline/promises";
import { Command } from "commander";
import pc from "picocolors";
import { loadConfig, saveConfig, configPath, type AuthData } from "../config.js";
import { AccountableClient } from "../client.js";
import { tokenSummary } from "../auth.js";

async function readStdin(): Promise<string> {
  // stdin piped (non-TTY) → lire tout ; sinon prompt interactif une ligne.
  if (!process.stdin.isTTY) {
    const chunks: Buffer[] = [];
    for await (const c of process.stdin) chunks.push(c as Buffer);
    return Buffer.concat(chunks).toString("utf8").trim();
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(
    pc.dim("Colle la valeur de localStorage.auth (JSON), puis Entrée :\n"),
  );
  rl.close();
  return answer.trim();
}

function parseAuthInput(raw: string): AuthData {
  const obj = JSON.parse(raw);
  if (!obj.access_token || !obj.refresh_token) {
    throw new Error("JSON invalide : il faut au moins access_token et refresh_token.");
  }
  return {
    access_token: obj.access_token,
    refresh_token: obj.refresh_token,
    refresh_token_expires_at: obj.refresh_token_expires_at,
    token_type: obj.token_type,
    client_id: obj.client_id,
    session_id: obj.session_id,
    cloudFrontCookies: obj.cloudFrontCookies,
  };
}

export function register(program: Command): void {
  program
    .command("login")
    .description("Enregistre la session (colle la valeur de localStorage.auth du navigateur)")
    .option("-t, --token <jwt>", "access token seul (déconseillé : pas de refresh)")
    .option("-r, --refresh-token <rt>", "refresh token (avec --token)")
    .action(async (opts: { token?: string; refreshToken?: string }) => {
      let auth: AuthData;
      if (opts.token) {
        auth = { access_token: opts.token, refresh_token: opts.refreshToken ?? "" };
      } else {
        const raw = await readStdin();
        if (!raw) {
          process.stderr.write(
            pc.yellow(
              "Rien reçu. Récupère le token ainsi :\n" +
                "  1. Ouvre web.accountable.eu (connecté)\n" +
                "  2. Console (F12) :  copy(localStorage.getItem('auth'))\n" +
                "  3. Relance `accountable login` et colle.\n",
            ),
          );
          process.exitCode = 1;
          return;
        }
        auth = parseAuthInput(raw);
      }
      const cfg = loadConfig();
      cfg.auth = auth;
      saveConfig(cfg);
      const s = tokenSummary(auth);
      process.stdout.write(
        pc.green(`✓ Connecté.`) +
          ` Access token jusqu'à ${s.accessExpiresAt?.toLocaleString("fr-BE") ?? "?"},` +
          ` refresh jusqu'à ${s.refreshExpiresAt?.toLocaleString("fr-BE") ?? "?"}.\n` +
          pc.dim(`  Config: ${configPath()}\n`),
      );
    });

  program
    .command("whoami")
    .description("Affiche l'utilisateur et la validité de la session")
    .action(async () => {
      const cfg = loadConfig();
      if (!cfg.auth?.access_token) {
        process.stderr.write(pc.yellow("Non connecté. Lance `accountable login`.\n"));
        process.exitCode = 1;
        return;
      }
      const s = tokenSummary(cfg.auth);
      const client = new AccountableClient(cfg.auth);
      const user = await client.getUser().catch(() => null);
      process.stdout.write(
        `${pc.bold("Utilisateur")} : ${user?.email ?? user?._id ?? s.sub ?? "?"}\n` +
          `Access token  : ${s.accessExpiresAt ? `expire ${s.accessExpiresAt.toLocaleString("fr-BE")}` : "?"}\n` +
          `Refresh token : ${s.refreshExpiresAt ? `expire ${s.refreshExpiresAt.toLocaleString("fr-BE")}` : "?"}\n`,
      );
    });

  program
    .command("logout")
    .description("Efface la session stockée")
    .action(() => {
      const cfg = loadConfig();
      cfg.auth = null;
      saveConfig(cfg);
      process.stdout.write(pc.green("✓ Session effacée.\n"));
    });
}
