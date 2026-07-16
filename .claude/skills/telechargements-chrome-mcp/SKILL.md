---
name: telechargements-chrome-mcp
description: Use when downloading files (invoice PDFs, documents) through the chrome-devtools MCP browser — téléchargement qui n'apparaît jamais dans Downloads, erreur "browser is already running" au démarrage, Chrome qui bloque les téléchargements multiples, fetch cross-origin qui échoue, ou fichiers à identifier dans Downloads.
---

# Téléchargements fiables via Chrome MCP

Le profil du MCP et le dossier de téléchargement sont configurables (`<CHROME_PROFILE_DIR>`, `<DOWNLOADS_DIR>` dans `.env`).

## Démarrage
- Erreur « The browser is already running for …/chrome-devtools-mcp/chrome-profile » = instance orpheline tenue par une **autre** session Claude. Identifier le processus racine (`ps aux | grep "MacOS/Google Chrome --user-data-dir=.*chrome-devtools-mcp"`), remonter au parent pour savoir quelle session le tient, demander avant de `kill` le PID racine (les cookies du profil survivent sur disque).
- Les téléchargements atterrissent dans `<DOWNLOADS_DIR>` (pas dans le profil MCP).

## Récupérer un fichier — ordre de préférence
1. **Clic UI natif** (bouton Download du site). Attendre le fichier par **nom exact** : `for i in $(seq 1 15); do [ -f <DOWNLOADS_DIR>/<nom>.pdf ] && break; sleep 2; done`.
2. **Ancre synthétique même origine** (`evaluate_script`) : `const a=document.createElement('a'); a.href=url; a.download='x.pdf'; a.click()`. ⚠️ Sans l'attribut `download`, Chrome ouvre le PDF dans le viewer au lieu de le télécharger.
3. **fetch → base64** (contourne tout blocage de téléchargement) : fetch dans `evaluate_script`, retourner `{size, b64}` ; le résultat dépasse la limite de tokens → il est sauvé dans un fichier `tool-results/…` → décoder en local : `python3` + `re.search(r'"b64":\s*"([^"]+)"')` + `base64.b64decode`, vérifier l'en-tête `%PDF`.
4. **URL pré-signée (S3, etc.)** : télécharger hors navigateur. ⚠️ `curl` peut être absent du shell sandboxé → utiliser `python3 urllib.request`. Un échec « Failed to fetch » cross-origin dans la page (CORS) est le signal de passer par cette méthode.

## Pièges
| Piège | Parade |
|---|---|
| 2e téléchargement silencieusement bloqué (protection « multiple downloads ») | Demander à l'utilisateur d'autoriser via la bulle à droite de la barre d'adresse, re-tenter (nouveau geste), ou méthode 3 |
| Un glob attrape un vieux fichier de Downloads (ex. `invoice*.pdf` → un `invoice-10.pdf` d'un mois précédent) | **Jamais de glob générique** : nom exact, ou `find <DOWNLOADS_DIR> -newermt '-1 minute' -type f` ; vérifier la date du fichier AVANT de le déplacer |
| « PDF » téléchargé = page HTML d'erreur | Vérifier l'en-tête `%PDF` puis lire la 1re page (Read) pour confirmer fournisseur/montant |
| Iframe cross-origin (ex. payments.google.com) inaccessible à `evaluate_script` (`contentDocument` null) | Piloter via `take_snapshot`/`click` — l'arbre a11y traverse les iframes |
| Élément non interactif au clic (uid timeout) | Cliquer un uid parent/enfant, ou re-snapshot (les uid périment à chaque navigation) |
