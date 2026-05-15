# Inwentaryzacja, aplikacja RM Nieruchomości

Lekka aplikacja webowa (PWA) do inwentaryzacji mieszkań na wynajem.
Działa na telefonie i komputerze, offline, generuje gotowy protokół PDF z brandingiem RM.

## CO POTRAFI

- Tryb **WPIS** (przekazanie najemcy) i **WYPIS** (odbiór od najemcy)
- Domyślne pomieszczenia: Korytarz, Łazienka, Garderoba, Salon, Kuchnia
- Możliwość dodania: Sypialnia, Pokój, Balkon, Pralnia, Piwnica, Parking, dowolne własne
- Trzy typy pozycji per pomieszczenie:
  - **Stan**, BDB / Dobry / Średni / Zły / Brak
  - **Ilość**, liczba sztuk (talerze, kubki, wieszaki)
  - **Tekst**, opis lub model
- Każda pozycja: pole na markę (dla AGD), uwagi, zdjęcia
- Liczniki: gaz, prąd, woda 1, woda 2, CEPLA, z numerem, odczytem i zdjęciem
- Klucze, piloty, pastylki, z licznikami sztuk
- **Generowanie PDF** z brandingiem, podpisami, załącznikiem zdjęć
- **Auto,save** w pamięci telefonu (IndexedDB)
- **Archiwum** wszystkich inwentaryzacji, lista po dacie
- Działa **offline**, bez internetu

## SZYBKI START (testowanie lokalne)

### Wariant A, otwórz w przeglądarce na komputerze

1. Otwórz dwukrotnym kliknięciem plik `index.html`
2. Działa od razu, możesz przetestować całą logikę
3. Uwaga: dane zapisują się w IndexedDB tej przeglądarki, dla każdej przeglądarki osobno

### Wariant B, lokalny serwer (zalecane do testów PWA i kamery)

W terminalu:
```powershell
cd "C:\Users\Ania Lenart\asystent\projekty\inwentaryzacja-app"
python -m http.server 8080
```
Otwórz w przeglądarce: <http://localhost:8080>

To uruchamia aplikację z lokalnego serwera, dzięki czemu:
- Działa service worker (offline cache)
- Działa upload zdjęć z kamery

## INSTALACJA NA TELEFONIE (sposób na produkcję)

PWA wymaga adresu HTTPS. Najszybsza darmowa opcja: **GitHub Pages**.

### Krok 1, stwórz repozytorium GitHub

1. Wejdź na <https://github.com/new>
2. Nazwa: `inwentaryzacja-rm` (albo dowolna)
3. Visibility: **Private** (zalecane, dane biurowe)
4. Kliknij „Create repository"

### Krok 2, wgraj pliki

Najprościej przez interfejs GitHub:
1. Na stronie nowego repo kliknij „uploading an existing file"
2. Przeciągnij wszystkie pliki z folderu `inwentaryzacja-app/` (razem z folderem `icons/`)
3. Zatwierdź commit

Albo z linii poleceń (jeśli używasz Git):
```powershell
cd "C:\Users\Ania Lenart\asystent\projekty\inwentaryzacja-app"
git init
git add .
git commit -m "first version"
git branch -M main
git remote add origin https://github.com/TWOJ_LOGIN/inwentaryzacja-rm.git
git push -u origin main
```

### Krok 3, włącz GitHub Pages

1. Wejdź w repo na GitHub
2. Settings → Pages (lewa kolumna)
3. Source: **Deploy from a branch**, Branch: **main**, folder: `/ (root)`
4. Zapisz
5. Po około 2 minutach na górze pojawi się link, np. `https://twojlogin.github.io/inwentaryzacja-rm/`

### Krok 4, zainstaluj na telefonie

1. Otwórz link z kroku 3 w Chrome na telefonie (Android) lub Safari (iPhone)
2. **Android, Chrome:** menu (3 kropki) → „Zainstaluj aplikację" lub „Dodaj do ekranu głównego"
3. **iPhone, Safari:** ikona udostępniania (kwadrat ze strzałką) → „Do ekranu początkowego"
4. Aplikacja pojawi się jako osobna ikona, działa offline

## STRUKTURA FOLDERU

```
inwentaryzacja-app/
├── index.html              ← główny plik aplikacji
├── app.js                  ← logika (data, render, PDF)
├── data.js                 ← domyślne pomieszczenia i pozycje
├── style.css               ← style
├── manifest.json           ← konfiguracja PWA
├── sw.js                   ← service worker (offline)
├── generate-icons.py       ← skrypt generujący ikony
├── icons/                  ← ikony PWA (192, 512, 180 px)
└── README.md               ← ten plik
```

## JAK MODYFIKOWAĆ

### Dodać nową pozycję do domyślnego pomieszczenia
1. Otwórz `data.js`
2. Znajdź odpowiednie pomieszczenie (np. `Kuchnia`)
3. Dodaj nowy obiekt do tablicy `pozycje`:
   ```js
   { nazwa: 'Toster', typ: 'stan', marka: true }
   ```
4. Zapisz plik, odśwież aplikację

### Dodać nowe domyślne pomieszczenie do listy „Dodaj pomieszczenie"
1. Otwórz `data.js`
2. Znajdź `POMIESZCZENIA_DODATKOWE`
3. Dodaj nowy obiekt z `nazwa`, `ikona`, `pozycje`

### Zmienić kolor brandowy
1. Otwórz `style.css`
2. Na górze zmień `--brand` (obecnie ciemna zieleń RM)
3. W `manifest.json` zmień `theme_color`

### Zmienić podpis w PDF
1. Otwórz `app.js`
2. Znajdź funkcję `generatePDF`
3. Zmień stringi (np. dane wynajmującego, numer telefonu)

## TROUBLESHOOTING

**Po otwarciu pliku przez file:// nie działają zdjęcia**
- To ograniczenie przeglądarek
- Uruchom lokalny serwer (`python -m http.server`) lub wgraj na GitHub Pages

**Aplikacja nie chce się zainstalować na telefonie**
- Musi być na HTTPS (np. GitHub Pages, nie file://)
- Sprawdź czy manifest.json się ładuje (Inspector → Application → Manifest)

**PDF generuje się długo z dużą ilością zdjęć**
- To normalne, zdjęcia są kompresowane przy dodawaniu, ale 50+ zdjęć trwa kilka sekund
- Możesz pobrać PDF bez wszystkich zdjęć i dosłać je osobno

**Zapomniałem aktualizować adres na nowym mieszkaniu, dane wymieszane**
- Każda inwentaryzacja ma osobne ID i jest osobnym wpisem
- Otwórz starszy wpis z listy „Zapisane inwentaryzacje" żeby edytować
- Auto-save nie miesza wpisów

## REGENERACJA IKON

Jeśli zmienisz design ikony, edytuj `generate-icons.py` i uruchom:
```powershell
python generate-icons.py
```

## DANE I PRYWATNOŚĆ

- **Wszystkie dane zostają w Twoim telefonie** (IndexedDB)
- Nic nie wysyła się do żadnego serwera
- PDF generuje się lokalnie w przeglądarce
- Możesz usunąć wszystko czyszcząc dane przeglądarki

## CO MOŻNA DODAĆ W PRZYSZŁOŚCI

- Eksport/import JSON (backup, transfer między telefonami)
- Porównywanie WPIS vs WYPIS dla tego samego adresu, lista różnic
- Synchronizacja przez Google Drive lub email
- Wstępne wczytywanie poprzedniego protokołu po adresie
- Podpis cyfrowy (rysowanie palcem na ekranie)
- Slack / WhatsApp share po wygenerowaniu PDF

---

**Rafał Lenart**, 668 169 986, biuro@rmnieruchomosci.pl
**RM Nieruchomości**, Elbląg, Malbork
