// DOMYŚLNE LICZNIKI, AKCESORIA I POMIESZCZENIA
// Możesz edytować swobodnie. Aplikacja korzysta z tego pliku przy starcie nowej inwentaryzacji.
// Każda zapisana inwentaryzacja ma własną kopię, zmiany tutaj nie wpływają na archiwum.

// DANE PRZEKAZUJĄCEGO (wynajmującego), edytowalne w UI w formularzu, zapisane w localStorage.
// Wrażliwe dane (dowód, adres) wpisujesz sam w aplikacji - nie są w publicznym repo.
const DEFAULT_PRZEKAZUJACY = {
  imie: 'Rafał Lenart',
  stanowisko: 'pośrednik w obrocie nieruchomościami',
  dowod: '',
  dataWaznosci: '',
  adres: '',
  telefon: '668 169 986',
  email: 'biuro@rmnieruchomosci.pl'
};

const STAN_OPCJE = [
  { id: 'bdb',    label: 'BDB',     color: '#15803d' },
  { id: 'db',     label: 'Dobry',   color: '#65a30d' },
  { id: 'sredni', label: 'Średni',  color: '#ca8a04' },
  { id: 'zly',    label: 'Zły',     color: '#dc2626' },
  { id: 'brak',   label: 'Brak',    color: '#64748b' }
];

// LICZNIKI, pogrupowane po pomieszczeniach (zimna + ciepła razem przy danym pomieszczeniu)
// pole "grupa" tworzy wizualny nagłówek nad licznikami z tej samej grupy
// pole "krotkaNazwa" pokazywane jest w UI w obrębie grupy (np. "Zimna woda")
// pole "nazwa" to pełny opis (używany w PDF i archiwum)
const DEFAULT_LICZNIKI = [
  { nazwa: 'Gazowy' },
  { nazwa: 'Energia elektryczna' },
  { nazwa: 'Zimna woda, kuchnia',    krotkaNazwa: 'Zimna woda',  grupa: 'Kuchnia'  },
  { nazwa: 'Ciepła woda, kuchnia',   krotkaNazwa: 'Ciepła woda', grupa: 'Kuchnia'  },
  { nazwa: 'Zimna woda, łazienka',   krotkaNazwa: 'Zimna woda',  grupa: 'Łazienka' },
  { nazwa: 'Ciepła woda, łazienka',  krotkaNazwa: 'Ciepła woda', grupa: 'Łazienka' },
  { nazwa: 'Węzeł cieplowniczy' }
];

// AKCESORIA, typ: 'ilosc' lub 'tekst' (np. kod do domofonu)
const DEFAULT_AKCESORIA = [
  { nazwa: 'Komplet kluczy do mieszkania', typ: 'ilosc', wartosc: 1 },
  { nazwa: 'Pilot do szlabanu',            typ: 'ilosc', wartosc: 0 },
  { nazwa: 'Klucze do piwnicy',            typ: 'ilosc', wartosc: 0 },
  { nazwa: 'Klucze do klatki',             typ: 'ilosc', wartosc: 0 },
  { nazwa: 'Pastylka do domofonu',         typ: 'ilosc', wartosc: 0 },
  { nazwa: 'Kod do domofonu',              typ: 'tekst', wartosc: '' },
  { nazwa: 'Klucz do skrzynki pocztowej',  typ: 'ilosc', wartosc: 0 }
];

// POMIESZCZENIA, wszystkie do wyboru przy starcie nowej inwentaryzacji.
// Po wyborze tylko zaznaczone wchodzą do formularza.
// "domyslnie" = zaznaczone na start (możesz odznaczyć).
const POMIESZCZENIA_DOSTEPNE = [
  {
    nazwa: 'Przedpokój',
    ikona: '🚪',
    domyslnie: true,
    pozycje: [
      { nazwa: 'Drzwi wejściowe',              typ: 'stan' },
      { nazwa: 'Drzwi do garderoby przesuwne', typ: 'stan' },
      { nazwa: 'Lustro',                       typ: 'stan' },
      { nazwa: 'Domofon',                      typ: 'stan' },
      { nazwa: 'Lampa ścienna',                typ: 'stan' },
      { nazwa: 'Szafka stojąca',               typ: 'stan' },
      { nazwa: 'Listwy przypodłogowe',         typ: 'stan' }
    ]
  },
  {
    nazwa: 'Łazienka z WC',
    ikona: '🛁',
    domyslnie: false,
    pozycje: [
      { nazwa: 'Drzwi wewnętrzne',             typ: 'stan' },
      { nazwa: 'Wanna z baterią prysznicową',  typ: 'stan' },
      { nazwa: 'Toaleta',                      typ: 'stan' },
      { nazwa: 'Lustro',                       typ: 'stan' },
      { nazwa: 'Pralka',                       typ: 'stan', marka: true },
      { nazwa: 'Szafka stojąca',               typ: 'stan' },
      { nazwa: 'Umywalka z szafką',            typ: 'stan' },
      { nazwa: 'Bateria umywalkowa',           typ: 'stan' },
      { nazwa: 'Lampa ścienna',                typ: 'stan' },
      { nazwa: 'Szafka wisząca nad toaletą',   typ: 'stan' },
      { nazwa: 'Lampka nad lustrem',           typ: 'stan' },
      { nazwa: 'Grzejnik',                     typ: 'stan' },
      { nazwa: 'Półka szklana',                typ: 'stan' },
      { nazwa: 'Uchwyt na papier',             typ: 'stan' },
      { nazwa: 'Uchwyt na ręczniki',           typ: 'stan' }
    ]
  },
  {
    nazwa: 'Łazienka',
    ikona: '🚿',
    domyslnie: false,
    pozycje: [
      { nazwa: 'Drzwi wewnętrzne',             typ: 'stan' },
      { nazwa: 'Wanna / kabina prysznicowa',   typ: 'stan' },
      { nazwa: 'Bateria prysznicowa',          typ: 'stan' },
      { nazwa: 'Lustro',                       typ: 'stan' },
      { nazwa: 'Pralka',                       typ: 'stan', marka: true },
      { nazwa: 'Umywalka z szafką',            typ: 'stan' },
      { nazwa: 'Bateria umywalkowa',           typ: 'stan' },
      { nazwa: 'Lampa',                        typ: 'stan' },
      { nazwa: 'Grzejnik',                     typ: 'stan' },
      { nazwa: 'Półka szklana',                typ: 'stan' },
      { nazwa: 'Uchwyt na ręczniki',           typ: 'stan' }
    ]
  },
  {
    nazwa: 'WC',
    ikona: '🚽',
    domyslnie: false,
    pozycje: [
      { nazwa: 'Drzwi wewnętrzne',             typ: 'stan' },
      { nazwa: 'Toaleta',                      typ: 'stan' },
      { nazwa: 'Umywalka',                     typ: 'stan' },
      { nazwa: 'Bateria umywalkowa',           typ: 'stan' },
      { nazwa: 'Lampa',                        typ: 'stan' },
      { nazwa: 'Lustro',                       typ: 'stan' },
      { nazwa: 'Uchwyt na papier',             typ: 'stan' }
    ]
  },
  {
    nazwa: 'Garderoba',
    ikona: '👔',
    domyslnie: false,
    pozycje: [
      { nazwa: 'Wieszaki na ubrania',          typ: 'ilosc' },
      { nazwa: 'Halogeny / oświetlenie',       typ: 'ilosc' },
      { nazwa: 'Zabudowa',                     typ: 'stan' },
      { nazwa: 'Drabinka',                     typ: 'stan' },
      { nazwa: 'Półki',                        typ: 'ilosc' }
    ]
  },
  {
    nazwa: 'Salon',
    ikona: '🛋️',
    domyslnie: true,
    pozycje: [
      { nazwa: 'Kanapa / narożnik',            typ: 'stan' },
      { nazwa: 'Poduszki',                     typ: 'ilosc' },
      { nazwa: 'Fotel',                        typ: 'stan' },
      { nazwa: 'Stolik / ława',                typ: 'stan' },
      { nazwa: 'Stolik pod telewizor',         typ: 'stan' },
      { nazwa: 'Telewizor',                    typ: 'stan', marka: true },
      { nazwa: 'Zasłony / firany',             typ: 'stan' },
      { nazwa: 'Karnisz',                      typ: 'stan' },
      { nazwa: 'Komoda',                       typ: 'stan' },
      { nazwa: 'Lampa sufitowa',               typ: 'stan' },
      { nazwa: 'Lampka podłogowa',             typ: 'stan' },
      { nazwa: 'Obraz',                        typ: 'ilosc' },
      { nazwa: 'Listwy przypodłogowe',         typ: 'stan' }
    ]
  },
  {
    nazwa: 'Salon z aneksem kuchennym',
    ikona: '🛋️',
    domyslnie: false,
    pozycje: [
      { nazwa: 'Kanapa / narożnik',            typ: 'stan' },
      { nazwa: 'Stolik',                       typ: 'stan' },
      { nazwa: 'Telewizor',                    typ: 'stan', marka: true },
      { nazwa: 'Stół jadalny',                 typ: 'stan' },
      { nazwa: 'Krzesła',                      typ: 'ilosc' },
      { nazwa: 'Szafki wiszące',               typ: 'ilosc' },
      { nazwa: 'Szafki stojące',               typ: 'ilosc' },
      { nazwa: 'Blat roboczy',                 typ: 'stan' },
      { nazwa: 'Zlew',                         typ: 'stan' },
      { nazwa: 'Bateria kuchenna',             typ: 'stan' },
      { nazwa: 'Płyta indukcyjna',             typ: 'stan', marka: true },
      { nazwa: 'Piekarnik',                    typ: 'stan', marka: true },
      { nazwa: 'Lodówka',                      typ: 'stan', marka: true },
      { nazwa: 'Okap',                         typ: 'stan' },
      { nazwa: 'Mikrofalówka',                 typ: 'stan', marka: true },
      { nazwa: 'Czajnik',                      typ: 'stan', marka: true },
      { nazwa: 'Zasłony / firany',             typ: 'stan' },
      { nazwa: 'Listwy przypodłogowe',         typ: 'stan' }
    ]
  },
  {
    nazwa: 'Kuchnia',
    ikona: '🍳',
    domyslnie: true,
    pozycje: [
      { nazwa: 'Szafki wiszące',               typ: 'ilosc' },
      { nazwa: 'Szafki stojące',               typ: 'ilosc' },
      { nazwa: 'Blat roboczy',                 typ: 'stan' },
      { nazwa: 'Zlew',                         typ: 'stan' },
      { nazwa: 'Bateria kuchenna',             typ: 'stan' },
      { nazwa: 'Płyta indukcyjna',             typ: 'stan', marka: true },
      { nazwa: 'Piekarnik',                    typ: 'stan', marka: true },
      { nazwa: 'Lodówka',                      typ: 'stan', marka: true },
      { nazwa: 'Okap',                         typ: 'stan' },
      { nazwa: 'Mikrofalówka',                 typ: 'stan', marka: true },
      { nazwa: 'Czajnik',                      typ: 'stan', marka: true },
      { nazwa: 'Stół',                         typ: 'stan' },
      { nazwa: 'Krzesła',                      typ: 'ilosc' },
      { nazwa: 'Lampa sufitowa',               typ: 'stan' },
      { nazwa: 'Talerze',                      typ: 'ilosc' },
      { nazwa: 'Kubki',                        typ: 'ilosc' },
      { nazwa: 'Szklanki',                     typ: 'ilosc' },
      { nazwa: 'Sztućce, łyżki',               typ: 'ilosc' },
      { nazwa: 'Sztućce, widelce',             typ: 'ilosc' },
      { nazwa: 'Sztućce, noże',                typ: 'ilosc' },
      { nazwa: 'Garnki',                       typ: 'ilosc' },
      { nazwa: 'Patelnie',                     typ: 'ilosc' }
    ]
  },
  {
    nazwa: 'Pokój 1',
    ikona: '🛏️',
    domyslnie: false,
    pozycje: [
      { nazwa: 'Łóżko / kanapa',               typ: 'stan' },
      { nazwa: 'Materac',                      typ: 'stan' },
      { nazwa: 'Szafa',                        typ: 'stan' },
      { nazwa: 'Komoda',                       typ: 'stan' },
      { nazwa: 'Biurko',                       typ: 'stan' },
      { nazwa: 'Krzesło',                      typ: 'stan' },
      { nazwa: 'Lampka',                       typ: 'ilosc' },
      { nazwa: 'Lampa sufitowa',               typ: 'stan' },
      { nazwa: 'Zasłony / firany',             typ: 'stan' },
      { nazwa: 'Listwy przypodłogowe',         typ: 'stan' }
    ]
  },
  {
    nazwa: 'Pokój 2',
    ikona: '🛏️',
    domyslnie: false,
    pozycje: [
      { nazwa: 'Łóżko / kanapa',               typ: 'stan' },
      { nazwa: 'Materac',                      typ: 'stan' },
      { nazwa: 'Szafa',                        typ: 'stan' },
      { nazwa: 'Komoda',                       typ: 'stan' },
      { nazwa: 'Biurko',                       typ: 'stan' },
      { nazwa: 'Krzesło',                      typ: 'stan' },
      { nazwa: 'Lampka',                       typ: 'ilosc' },
      { nazwa: 'Lampa sufitowa',               typ: 'stan' },
      { nazwa: 'Zasłony / firany',             typ: 'stan' },
      { nazwa: 'Listwy przypodłogowe',         typ: 'stan' }
    ]
  },
  {
    nazwa: 'Pokój 3',
    ikona: '🛏️',
    domyslnie: false,
    pozycje: [
      { nazwa: 'Łóżko / kanapa',               typ: 'stan' },
      { nazwa: 'Materac',                      typ: 'stan' },
      { nazwa: 'Szafa',                        typ: 'stan' },
      { nazwa: 'Biurko',                       typ: 'stan' },
      { nazwa: 'Krzesło',                      typ: 'stan' },
      { nazwa: 'Lampa sufitowa',               typ: 'stan' },
      { nazwa: 'Zasłony / firany',             typ: 'stan' }
    ]
  },
  {
    nazwa: 'Pokój 4',
    ikona: '🛏️',
    domyslnie: false,
    pozycje: [
      { nazwa: 'Łóżko / kanapa',               typ: 'stan' },
      { nazwa: 'Materac',                      typ: 'stan' },
      { nazwa: 'Szafa',                        typ: 'stan' },
      { nazwa: 'Biurko',                       typ: 'stan' },
      { nazwa: 'Krzesło',                      typ: 'stan' },
      { nazwa: 'Lampa sufitowa',               typ: 'stan' },
      { nazwa: 'Zasłony / firany',             typ: 'stan' }
    ]
  },
  {
    nazwa: 'Balkon',
    ikona: '🌿',
    domyslnie: false,
    pozycje: [
      { nazwa: 'Drzwi balkonowe',              typ: 'stan' },
      { nazwa: 'Posadzka',                     typ: 'stan' },
      { nazwa: 'Balustrada',                   typ: 'stan' },
      { nazwa: 'Stolik balkonowy',             typ: 'stan' },
      { nazwa: 'Krzesła balkonowe',            typ: 'ilosc' },
      { nazwa: 'Suszarka',                     typ: 'stan' },
      { nazwa: 'Donice',                       typ: 'ilosc' }
    ]
  }
];

// Pusty szablon na własne pomieszczenie
const PUSTE_POMIESZCZENIE = {
  nazwa: 'Własne pomieszczenie',
  ikona: '🚪',
  pozycje: []
};
