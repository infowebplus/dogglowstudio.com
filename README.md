# Dog Glow Studio

Structură tip app (sursă → build → dist):

```
dogglowstudio.com/
  config.json      # setări (WhatsApp, calendar, servicii)
  build.mjs
  package.json
  src/             # sursă (editezi aici)
    index.html
    assets/
  dist/            # output producție (deploy)
  booking/         # Google Apps Script
```

## Comenzi

```bash
npm install
npm run build    # sync config + dist/
npm run dev      # preview sursă (src/) pe :4174
npm start        # build + serve dist/ pe :4173
```

Deploy: uploadează conținutul din `dist/`.
