# Gotland 511

En mobil-app for **Gotland 511** – et selvsupportert ~511 km langt løp/etappe-eventyr rundt Gotland. Appen er en **ankomst-planlegger**: sett starttid og tempo, så regner den ut når du passerer hvert av 220 punkter (POI-er) langs ruten, og viser live-posisjonen din snappet til den faktiske GPX-traseen.

Bygget med [Expo](https://expo.dev) / React Native.

## 📥 Last ned appen (Android)

Ferdige APK-er ligger under [**Releases**](../../releases). Last ned den nyeste `gotland-511.apk` på Android-telefonen din og åpne den for å installere.

> Første gang må du tillate **«Installer fra ukjente kilder»** for nettleseren/filbehandleren du bruker.
>
> APK-en er signert med en debug-nøkkel for enkel distribusjon. Ved oppdatering til en nyere versjon kan du måtte **avinstallere den gamle først**.

## ✨ Funksjoner

- **Ankomstkalkulator** – `ankomst = start + (tempo × distanse)` for alle 220 POI-er
- **POI-liste** med kategorier, åpningstider og avstander
- **Live-posisjon** via GPS, snappet til ruten (glidende vindu hindrer «teleportering» ved kryssinger)
- **Posisjonstest** – simuler en virtuell km-posisjon for å teste live-funksjonene
- **Offline-først** – all rutedata er bundlet i appen; ingen nettverk kreves

> **Merk om kartet:** APK-ene fra Releases er bygget uten en Google Maps API-nøkkel, så **kart-fanen vises grå**. Ankomstkalkulatoren og POI-listen (kjernefunksjonen) virker fullt ut. Kartet krever en egen Google Maps-nøkkel i en fremtidig versjon.

## 🏗️ Prosjektstruktur

- `frontend/` – Expo-appen (all app-logikk)
- `backend/` – valgfri FastAPI-tjeneste som serverer rutedata (appen kjører uavhengig av den)

Kjernelogikk i frontend:
- `src/calc.ts` – ankomstformelen og tid/tempo-formatering
- `src/snap.ts` – snap-til-rute-geometri
- `src/PositionContext.tsx` – all posisjonstilstand (GPS, simulering, snap)

## 🔧 Bygge selv

APK-en bygges automatisk i **GitHub Actions** (`.github/workflows/build-apk.yml`):

- **Automatisk release:** push en tag på formen `vX.Y.Z` → workflowen bygger APK-en og publiserer en Release.
- **Manuelt:** kjør workflowen «Build Android APK» fra Actions-fanen → APK-en havner som en artifact.

Lokal utvikling:

```bash
cd frontend
yarn install
npx expo start   # åpne i Expo Go, eller en simulator
```

## 📄 Lisens

[MIT](LICENSE)
