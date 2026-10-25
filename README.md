# CLINK

**Anstoßen. Verbinden. Wiedersehen.** Web-Plattform für die CLINK-Armbänder: Landing-Page, Gast-Bereich (Check-in, Swipen, Matches) und Admin. Ein Projekt by WeDance.

Branding (Farben, Syne + DM Sans, Bildmarke) aus dem Pitch Deck, Ablauf und Technik aus der Spezifikation.

## Starten

```bash
npm install
npm run dev        # http://localhost:3000
```

Ohne Supabase-Zugangsdaten läuft die Seite im **Demo-Modus**: Beispieldaten im Arbeitsspeicher, ein aktives Demo-Event, Demo-Bänder und unter `/app` → „Demo ausprobieren“ ein Beispiel-Gast mit sechs Clinks (drei davon swipen zurück). Admin-Passwort im Demo-Modus: `clink`.

## Seiten

| Pfad | Inhalt |
| --- | --- |
| `/` | Landing: Geste als Animation (antippen = Vibration am Handy), Ablauf, Swipe-Demo, FAQ, „CLINK für deinen Club“ mit Kontaktformular |
| `/checkin?band=778775` | Check-in (Ziel des QR-Codes am Band): Band-ID, Foto, Vorname, Alter, Instagram optional, Einwilligungen |
| `/checkin/fertig` | Bestätigung + persönlicher Link für den nächsten Tag |
| `/l/<token>` | Persönlicher Link, meldet den Gast auf dem Gerät an |
| `/app` | Begegnungen des letzten Abends swipen, Countdown bis zum Verfall, Profil löschen |
| `/app/matches` | Gegenseitige Matches mit freigegebenem Instagram |
| `/admin` | Events, Check-ins, Bänder, CSV-Import, Firmware-Werte, Statistik, Anfragen |
| `/admin/qr` | Druckbogen mit einem QR-Code pro Band |
| `/impressum`, `/datenschutz` | Entwürfe mit markierten Platzhaltern |

## Produktion

1. Supabase-Projekt mit Region EU anlegen, `supabase/schema.sql` im SQL-Editor ausführen.
2. Umgebungsvariablen nach `.env.example` setzen (`SESSION_SECRET`, `ADMIN_PASSWORD`, `GATEWAY_TOKEN`, `NEXT_PUBLIC_SITE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`). Ohne `SESSION_SECRET` startet die Produktion bewusst nicht.
3. Auf Vercel oder Netlify deployen, Domain `clink.wedance.vip`.

## Cloudflare (Workers)

Läuft über den OpenNext-Adapter (`@opennextjs/cloudflare`), Konfiguration in `wrangler.jsonc` und `open-next.config.ts`.

```bash
npm run preview   # lokal in der Cloudflare-Laufzeit testen (Variablen in .dev.vars)
npm run deploy    # direkt deployen (wrangler login nötig)
```

Mit Git-Anbindung im Cloudflare-Dashboard: Build-Befehl `npx opennextjs-cloudflare build`, Deploy-Befehl `npx opennextjs-cloudflare deploy`. `SESSION_SECRET`, `ADMIN_PASSWORD`, `GATEWAY_TOKEN` (und später die Supabase-Werte) als Variablen/Secrets des Workers setzen, `NEXT_PUBLIC_SITE_URL` als Build-Variable.

## Gateway-API (Ladeschrank)

Alle Aufrufe mit `Authorization: Bearer $GATEWAY_TOKEN`.

```bash
# Begegnungen hochladen (CSV oder JSON {"encounters":[...]}); Event: ?event_id=… oder automatisch
curl -X POST "$URL/api/gateway/encounters" -H "Authorization: Bearer $T" --data-binary @begegnungen.csv

# Bandstatus melden
curl -X POST "$URL/api/gateway/bands" -H "Authorization: Bearer $T" -H "Content-Type: application/json" \
  -d '[{"id":"778775","mac":"BC57292696C9","akku":82}]'

# Firmware-Werte abholen
curl "$URL/api/gateway/settings" -H "Authorization: Bearer $T"
```

CSV-Format: `band_a,band_b,timestamp` (Kopfzeile optional). Jedes Paar wird pro Abend nur einmal gespeichert, egal ob beide Bänder es melden.

## Regeln im Code

- Match nur bei gegenseitigem Rechts-Swipe; geswipet werden kann nur, wer wirklich geclinkt hat.
- Instagram nur nach Match und nur bei Freigabe; Telefonnummern werden nicht erfasst.
- Swipe-Frist: Ende des Abends (06:00) + 72 h (`lib/config.ts`). Danach werden Begegnungen und Swipes gelöscht, Matches bleiben.
- Ein Band gehört pro Event genau einem Gast; Bänder werden über Events hinweg wiederverwendet.
- Check-in ab 18.

## Noch nicht drin (laut Spezifikation „kann warten“ bzw. offen)

- Versand des Links per Mail/SMS (Feld für E-Mail ist da, Versand fehlt)
- Eigener Chat, WeDance-Login, Live-Regler per Web Bluetooth
