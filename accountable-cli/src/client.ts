import type { AuthData } from "./config.js";
import { saveAuth } from "./config.js";
import { AuthError, isAccessExpired, isRefreshExpired, refreshAccessToken } from "./auth.js";
import {
  ConnectorSchema,
  ExpenseSchema,
  TransactionSchema,
  parseArray,
  type Connector,
  type Expense,
  type Transaction,
} from "./schemas.js";

const BASE_URL = process.env.ACCOUNTABLE_BASE_URL || "https://app.accountable.eu/api";
const WEB_ORIGIN = "https://web.accountable.eu";

export class AccountableClient {
  private auth: AuthData;
  private persist: boolean;

  constructor(auth: AuthData, persist = true) {
    this.auth = auth;
    this.persist = persist;
  }

  /** Garantit un access token frais (refresh transparent si expiré). */
  private async ensureFresh(): Promise<void> {
    if (!isAccessExpired(this.auth)) return;
    if (isRefreshExpired(this.auth)) {
      throw new AuthError(
        "Session expirée. Relance `accountable login` (recolle localStorage.auth du navigateur).",
      );
    }
    this.auth = await refreshAccessToken(this.auth);
    if (this.persist) saveAuth(this.auth);
  }

  private headers(): Record<string, string> {
    return {
      authorization: `Bearer ${this.auth.access_token}`,
      accept: "application/json",
      "x-client": "accountable-web",
      origin: WEB_ORIGIN,
      referer: `${WEB_ORIGIN}/`,
    };
  }

  /** GET JSON avec 1 retry après refresh en cas de 401. */
  private async getJson(path: string, params?: Record<string, string | number>): Promise<any> {
    await this.ensureFresh();
    const url = new URL(BASE_URL + path);
    for (const [k, v] of Object.entries(params ?? {})) url.searchParams.set(k, String(v));

    let res = await fetch(url, { headers: this.headers() });
    if (res.status === 401 && !isRefreshExpired(this.auth)) {
      this.auth = await refreshAccessToken(this.auth);
      if (this.persist) saveAuth(this.auth);
      res = await fetch(url, { headers: this.headers() });
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`API ${res.status} ${path}\n${body.slice(0, 300)}`);
    }
    return res.json();
  }

  /** Pagine tant que data.length === perPage. */
  private async paginate(
    path: string,
    params: Record<string, string | number>,
    perPage = 100,
  ): Promise<unknown[]> {
    const all: unknown[] = [];
    let page = 1;
    // garde-fou anti-boucle
    while (page <= 200) {
      const json = await this.getJson(path, { ...params, page, perPage });
      const data: unknown[] = Array.isArray(json) ? json : (json?.data ?? []);
      all.push(...data);
      if (data.length < perPage) break;
      page++;
    }
    return all;
  }

  async getUser(): Promise<{ email?: string; firstName?: string; lastName?: string; _id?: string }> {
    const json = await this.getJson("/v2/users");
    return json?.data ?? json;
  }

  async getConnectors(): Promise<Connector[]> {
    const json = await this.getJson("/v1/connectors");
    const data: unknown[] = json?.data ?? json ?? [];
    return parseArray(ConnectorSchema, data, "connector(s)");
  }

  /**
   * Transactions d'un compte. `periods` = "start/end" (période TVA) pour les comptes fiscaux ;
   * pour les autres, ne pas passer `periods` (filtrage par valueDate côté appelant).
   */
  async getTransactions(opts: {
    accountNumbers: string;
    periods?: string;
    text?: string;
  }): Promise<Transaction[]> {
    const params: Record<string, string | number> = {
      accountNumbers: opts.accountNumbers,
      currency: "EUR",
      expand: "matchedItems",
      expense_version: 3,
      lang: "fr",
      sort: "valueDate_desc",
    };
    if (opts.periods) params.periods = opts.periods;
    if (opts.text) params.text = opts.text;
    const data = await this.paginate("/v1/transactions", params);
    return parseArray(TransactionSchema, data, "transaction(s)");
  }

  async getExpenses(): Promise<Expense[]> {
    const data = await this.paginate("/v2/expenses", {});
    return parseArray(ExpenseSchema, data, "dépense(s)");
  }
}
