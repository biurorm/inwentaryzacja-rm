# DO ZROBIENIA, kolejna wersja

## ZROBIONE 2026-05-15 (po testach na iPhonie)

- Strona tytułowa PDF: Załącznik nr 5, "Protokół zdawczo-odbiorczy, inwentaryzacja", lokalizacja lokalu, dane przekazującego (z dowodem DHZ599693), dane najemcy z PESEL
- Klauzula przed podpisem skrócona, bez wymieniania kluczy i liczników (są wcześniej w protokole)
- "Data czynności" → "Data przekazania" (UI + PDF)
- Mikrofon dyktowania dodany do każdej rubryki: PESEL, Telefon, Email, Numer/Odczyt liczników, Kod do domofonu, Nazwa nowej pozycji (w modalu)
- Speech Recognition: `continuous = true`, `interimResults = true`, lepszy feedback (toast "Słucham..."), obsługa błędu no-speech / not-allowed
- Stan techniczny: przycisk "📋 Zastosuj do wszystkich pomieszczeń" pod każdym elementem (Ściany / Podłoga / Okna / Sufit / Drzwi) kopiuje stan i uwagi do pozostałych pomieszczeń
- Cache bumped do v9 (style.css, app.js, data.js, sw.js)

---

## DALEJ DO ZROBIENIA

Funkcje zatwierdzone przez Rafała 2026-05-14:

## 1. Podpis palcem na ekranie

- Modal z canvasem na końcu formularza
- Dwa pola podpisu: Wynajmujący (Rafał) + Najemca
- Save jako base64 PNG, dołączane do PDF
- Biblioteka: signature_pad albo własna implementacja na <canvas>

## 2. Porównanie WPIS vs WYPIS

- Przy starcie WYPISU: sprawdź czy istnieje WPIS dla tego samego adresu (najnowszy)
- Jeśli tak, zaproponuj „Wczytać dane z WPISU?"
- Po wczytaniu: każda pozycja pokazuje 2 stany (wpis vs aktualnie wprowadzony)
- W PDF dodatkowa sekcja „RÓŻNICE", lista pozycji które się zmieniły
- Wskazanie: czy najemca odpowiada za różnicę (mebel/sprzęt zniszczony) czy nie (zużycie normalne)

## 3. Wysyłka PDF mailem jednym kliknięciem

- Po wygenerowaniu PDF, dodatkowy przycisk „Wyślij mailem"
- Otwiera `mailto:` z gotowym tematem, treścią, adresatem (jeśli podany email najemcy)
- PDF już ściągnięty lokalnie, użytkownik dodaje go ręcznie do maila (limit Web Share API na iOS)
- Alternatywa: Web Share API z file blob, działa natywnie na iOS Share Sheet

## 4. Backup do iCloud / Google Drive (NIE WYBRANE TERAZ, do rozważenia później)

- Eksport całej bazy IndexedDB do JSON
- Import z JSON na innym urządzeniu
- Auto-backup do Drive co X dni

---

**Priorytet:** 1, 3, 2 (najpierw podpis bo blokuje legalność, potem email bo przyspiesza, na końcu porównanie bo dodatkowa wartość).

**Timing:** następna sesja po testach Rafała na realnym mieszkaniu.
