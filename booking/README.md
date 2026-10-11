# Google Calendar booking (Apps Script)

Backend pentru rezervările de pe site: citește zilele/orele libere dintr-un Google Calendar și (opțional) creează evenimente.

## Config + build

Setările se editează în [`../config.json`](../config.json), apoi din rădăcina proiectului:

```bash
npm run build
```

Build-ul:
- sincronizează `src/` (HTML, site-config) din `config.json`
- actualizează `CONFIG` din `Code.gs`
- generează `dist/` (minificat, gata de deploy)

## Setup rapid Apps Script

1. Editează `config.json` (`calendar`, `bookingApi.url`, servicii).
2. Rulează `node build.mjs`.
3. Deschide [script.google.com](https://script.google.com) → **New project**.
4. Lipește tot `Code.gs` (deja cu CONFIG generat).
5. **Deploy** → **New deployment** → tip **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
6. Copiază URL-ul `/exec` în `config.json` → `bookingApi.url`, apoi `node build.mjs` din nou.
7. Reîncarcă site-ul.

## API

| Action | Method | Parametri |
|--------|--------|-----------|
| `config` | GET | `?action=config&key=` |
| `slots` | GET | `?action=slots&date=YYYY-MM-DD&service=bano-basico&key=` |
| `book` | POST | JSON body: `{ action, key, date, time, service, serviceLabel, nombre, telefono, perro, tamano, notas }` |

Body-ul POST se trimite ca `text/plain` (JSON string) ca să evite probleme CORS.

## Mod A vs B

- **A** (`CREATE_EVENTS: false`): site-ul arată doar orele libere; confirmarea rămâne pe WhatsApp.
- **B** (`CREATE_EVENTS: true`): la confirmare, site-ul apelează `book` și creează evenimentul în calendar, apoi deschide WhatsApp.

## Note

- Evenimentele deja din calendar = intervale ocupate.
- După modificări în `Code.gs`, fă **Deploy → Manage deployments → Edit → New version**.
- Fără `bookingApiUrl` setat, site-ul folosește sloturi locale de fallback (fără Google Calendar).
