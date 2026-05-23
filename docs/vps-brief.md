# Brief implementacyjny: Strona oferty VPS (model: agregator + porównywarka)

**Adresat:** Agent AI budujący stronę internetową.
**Cel:** Zaimplementować stronę agregatora/porównywarki VPS-ów od 6 dostawców infrastruktury, z polskim supportem jako wartością dodaną.
**Model biznesowy:** Reseller / agregator — odsprzedajemy VPS-y od OVH, Hetzner, Hostinger, Contabo i innych, dodajemy własną marżę, support w języku polskim, jedną fakturę, jednolity panel.

---

## 1. Model produktu — co właściwie sprzedajemy

**To NIE jest własna infrastruktura.** To agregator z trzema warstwami wartości:

```
WARSTWA 3: NASZ BRAND I USŁUGI
   ├── Polski support techniczny (24/7 lub w godzinach pracy)
   ├── Jedna faktura VAT z polskim NIP-em
   ├── Jednolity panel klienta (po polsku)
   ├── Doradztwo: który dostawca pasuje do projektu klienta
   └── Porównywarka cen i specyfikacji
        │
WARSTWA 2: NASZA MARŻA + DODATKI
   ├── Marża ~25-35% nad ceną kosztową dostawcy
   ├── Dodatek A (backup) — opcjonalny lub wliczony
   └── Dodatek X (rozszerzenie sieci) — opcjonalny
        │
WARSTWA 1: INFRASTRUKTURA (kupowana u dostawców)
   ├── Hetzner, OVH, Hostinger, Contabo, ...
   └── Wszystkie w UE (Niemcy, Francja, Polska, Litwa, Holandia)
```

**Komunikacja: WARIANT HYBRYDOWY**
- Strona główna: nasz brand, nazwy marketingowe linii (nie nazwy dostawców)
- Karta produktu: ujawnia dostawcę w sekcji "Specyfikacja techniczna"
- FAQ / regulamin / DPA: pełna transparentność czyja infrastruktura

Klient świadomy (B2B) docenia transparentność. Klient mniej techniczny widzi spójny brand i polski support.

---

## 2. Linie produktowe (kolory = dostawcy)

Sześć linii odpowiada sześciu dostawcom infrastruktury. Każda linia ma własną nazwę marketingową — kolory to **wewnętrzne kody SKU**, nie pokazuj ich klientowi w głównym UI.

### Mapping kolor → dostawca → pozycjonowanie

| Kod SKU | Dostawca infrastruktury | Nazwa marketingowa (propozycja) | Cena bazy €/mies | Backup (A) | Dla kogo |
|---|---|---|---:|:-:|---|
| **Gold** | Hetzner (CX line) | "Cloud Lite" | €15 | ❌ | Najtaniej, dev/test, projekty osobiste, EU-only |
| **Orange** | Contabo Cloud VPS | "Cloud Standard" | €18 | ❌ | Tanie aplikacje z dużym dyskiem, blogi WordPress |
| **Czarny** | Hetzner (CPX line) | "Cloud Business" | €20 | ✅ | Małe firmy, sklepy startujące, niemiecki DC |
| **Biały** | Hostinger KVM | "Cloud Performance" | €20 | ✅ wliczony od L | Aplikacje produkcyjne, panel po polsku, weekly backup |
| **Czerwony** | OVHcloud (Value/Essential) | "Cloud Pro" | €23 | ✅ | Agencje, freelancerzy, dużo lokalizacji EU |
| **Niebieski** | OVHcloud Comfort + dedykowane | "Cloud Enterprise" | €36 | ✅ wliczony od L | Enterprise, SLA 99.99%, francuski DC, RGPD |

### Dlaczego takie mapowanie

**Gold = Hetzner CX (Cost-Optimized).** Najtańszy realny VPS w UE. Hetzner ma datacentry w Niemczech i Finlandii, transfer 20 TB w cenie (najwięcej w branży). Brak backupu pasuje do segmentu "dev/test" — klient zrzuca dane sam.

**Orange = Contabo.** Niemiecki provider znany z "dużo zasobów za mało pieniędzy" — sporo dysku, do 96 GB RAM w wyższych planach. Wolniejsza sieć niż Hetzner, ale to nie problem dla blogów i aplikacji niskoruchowych. 11 lokalizacji globalnie, w tym europejskie.

**Czarny = Hetzner CPX (Regular Performance).** Ta sama firma co Gold, ale wyższa półka — lepsze CPU AMD, dostępny backup. Klient z Czarnego to ktoś, kto **już chciał Hetznera** ale chce backup i polski support.

**Biały = Hostinger.** Litewski provider, **bardzo popularny w Polsce** (silna obecność marketingowa). Weekly backup w cenie, panel po polsku, polskie wsparcie ze strony Hostingera. Pasuje do klientów, którzy znają markę.

**Czerwony = OVH Value/Essential.** Francuski gigant z polskim datacentrum w Warszawie. AMD EPYC, NVMe, anti-DDoS w cenie. Dla agencji bo OVH ma dużo lokalizacji (PL/FR/DE/UK).

**Niebieski = OVHcloud Comfort/Performance.** Wyższa półka OVH, dedykowane zasoby, SLA 99.99%, certyfikaty (ISO 27001, RGPD, HDS dla medycyny). Dla klientów wymagających DPA na piśmie.

### Co fizycznie różni linie

| Cecha | Gold | Orange | Czarny | Biały | Czerwony | Niebieski |
|---|---|---|---|---|---|---|
| **Procesor** | AMD shared | AMD shared | AMD shared (lepszy) | AMD/Intel KVM | AMD EPYC | AMD EPYC dedykowane |
| **Dysk** | NVMe SSD | SSD (większy) | NVMe SSD | NVMe SSD | NVMe SSD | NVMe enterprise |
| **Lokalizacja DC** | DE, FI | DE, EU | DE, FI | DE, NL, LT | PL, FR, DE, UK | PL, FR, DE, UK |
| **SLA dostawcy** | 99.9% | 99.9% | 99.9% | 99.9% | 99.95% | 99.99% |
| **Backup (A)** | ❌ niedostępny | ❌ niedostępny | ✅ płatny | ✅ wliczony od L | ✅ płatny | ✅ wliczony od L |
| **Anti-DDoS** | basic | basic | basic | basic | advanced (VAC) | enterprise (VAC) |
| **Transfer bazowy** | 20 TB | 32 TB | 20 TB | 4-8 TB | unlimited fair use | unlimited fair use |

---

## 3. Konfiguracje sprzętowe (litery L, S, D)

Litery to **modyfikatory rozmiaru** VPS-a. Można je łączyć w dozwolone kombinacje. Klientowi pokazujemy nazwy, nie litery.

### Mapowanie liter

| Litera | Co modyfikuje | Wartość |
|---|---|---|
| **(brak)** | Konfiguracja bazowa | 2 vCPU / 4 GB RAM / 80 GB NVMe / 4 TB transfer (różni się per dostawca, patrz niżej) |
| **S** | RAM upgrade | Podwaja RAM (skaluje się z platformą) |
| **D** | Dysk upgrade | Podwaja pojemność dysku |
| **L** | CPU + platforma | Podwaja vCPU i odblokowuje wyższy zakres RAM |

**Skalowanie S:** dodatek S "podwaja RAM" w obrębie platformy. Na bazie: 4→8 GB. Na L: 8→16 GB.

### Pełna siatka specyfikacji sprzętowych

**Uwaga:** specyfikacje różnią się per dostawca (kolor) — agent pobiera je z bazy per kombinacja. Poniżej generyczny szablon dla "środka oferty" (kolor Czarny / Hetzner CPX):

| Kombinacja | vCPU | RAM | Dysk NVMe | Transfer | Nazwa marketingowa |
|---|---:|---:|---:|---:|---|
| (baza) | 2 | 4 GB | 80 GB | 20 TB | Starter |
| **S** | 2 | 8 GB | 80 GB | 20 TB | Starter RAM+ |
| **D** | 2 | 4 GB | 160 GB | 20 TB | Starter Disk+ |
| **S+D** | 2 | 8 GB | 160 GB | 20 TB | Starter Plus |
| **L** | 4 | 8 GB | 80 GB | 20 TB | Performance |
| **L+S** | 4 | 16 GB | 80 GB | 20 TB | Performance RAM+ |
| **L+D** | 4 | 8 GB | 160 GB | 20 TB | Performance Disk+ |
| **L+S+D** | 4 | 16 GB | 160 GB | 20 TB | Pro |

Dla innych dostawców te liczby się zmieniają (np. Niebieski/OVH Comfort ma 4 vCPU dedykowane od bazy, Hostinger ma 4 TB transferu bazowego). Każda kombinacja **musi mieć rekord w bazie** z konkretnymi liczbami per kolor.

### Dodatek X (rozszerzenie sieci)

X modyfikuje transfer/IP/port. **Wartości zależą od dostawcy:**

| Linia | X dodaje |
|---|---|
| Gold (Hetzner) | +1 IPv4 (do 2), port pozostaje 1 Gbps |
| Orange (Contabo) | +1 IPv4, +200 Mbps port |
| Czarny (Hetzner) | +1 IPv4, dodatkowy snapshot slot |
| Biały (Hostinger) | +1 IPv4, transfer 4→8 TB |
| Czerwony (OVH) | +1 IPv4, port 250 Mbps → 1 Gbps |
| Niebieski (OVH) | +2 IPv4, port 1 Gbps → 2 Gbps |

### Dodatek A (backup / archiwizacja)

A daje automatyczny backup dzienny + snapshoty manualne + self-service restore z panelu.

**Zasady:**
- **Gold i Orange** — A niedostępne. UI ukrywa checkbox A. Tooltip: *"Backup niedostępny w tej linii — wybierz Cloud Business lub wyższą."*
- **Czarny, Czerwony** — A płatny.
- **Biały, Niebieski** — A wliczone w plany L i wyższe (Performance/Pro). W bazie/S/D — płatny.

### Dozwolone kombinacje sprzętowe

```
(baza), S, D, S+D, L, L+S, L+D, L+S+D
```

Patrz tabele cen (sekcje 7-8) — pole puste = niedostępne.

---

## 4. Porównywarka — kluczowy element UX

**To jest nasz wyróżnik na rynku.** Klient odwiedza stronę głównie po to, żeby porównać dostawców i wybrać optymalnego. Porównywarka **musi być fundamentem strony głównej**, nie ukrytą funkcją.

### Wymagania funkcjonalne porównywarki

**1. Widoczność od pierwszego scrolla** — porównywarka jest sekcją hero strony głównej lub bezpośrednio pod nią.

**2. Filtry:**
- Wymagana liczba vCPU (slider 1-8)
- Wymagany RAM (slider 1-32 GB)
- Wymagany dysk (slider 40-500 GB)
- Lokalizacja DC (checkboxy: PL, DE, FR, UK, NL, LT, FI)
- Backup wymagany? (toggle)
- Budżet maks. €/mies (slider)

**3. Wynik:** lista 3-6 propozycji z różnych linii, każda z:
- Nazwą marketingową ("Cloud Business")
- Nazwą dostawcy ("Powered by Hetzner")
- Specyfikacją (vCPU/RAM/dysk/transfer)
- Ceną miesięczną i roczną z zaznaczonymi oszczędnościami
- Lokalizacją DC
- Listą plusów (np. "Najlepszy stosunek cena/wydajność")
- Przyciskiem "Zamów" → konfigurator tej linii

**4. Tabela porównawcza** (rozwijana) — wszystkie 6 linii obok siebie, z możliwością odznaczenia tych nieinteresujących, tryb "head-to-head 2 vs 2".

**5. Inteligentne sugestie:**
- "Dla aplikacji WordPress polecamy Cloud Performance (Hostinger) — preinstalowany stack"
- "Dla wymagających RGPD HDS — Cloud Enterprise (OVH) z certyfikacją"
- "Najtaniej dla projektów dev/test — Cloud Lite (Hetzner)"

### Struktura danych dla porównywarki

```json
{
  "comparison_filters": {
    "min_vcpu": 2,
    "min_ram_gb": 4,
    "min_disk_gb": 80,
    "locations": ["DE", "PL"],
    "backup_required": true,
    "max_price_eur": 30
  },
  "matched_configurations": [
    {
      "line_sku": "czarny",
      "line_marketing_name": "Cloud Business",
      "provider": "Hetzner",
      "provider_url_hint": "Powered by Hetzner Cloud (CPX series)",
      "configuration": "L",
      "specs": { ... },
      "price_monthly_eur": 26,
      "price_yearly_eur": 158.27,
      "yearly_savings_eur": 153.73,
      "yearly_savings_percent": 49,
      "pros": ["Niemiecki DC", "Anti-DDoS w cenie", "Backup dostępny", "Polski support 24/7"],
      "highlights": ["best_value"]
    }
  ]
}
```

---

## 5. Polski support jako wartość dodana

**To drugi filar oferty.** Komunikuj go wszędzie — na stronie głównej, w karcie każdej linii, w FAQ.

### Co konkretnie obiecujemy klientowi

- **Support 100% po polsku** — email, chat, telefon (jeśli oferujesz)
- **Znajomość technologii każdego z 6 dostawców** — agent supportu rozumie różnice między Hetznerem a OVH, wie jak migrować
- **Jedna faktura VAT z polskim NIP-em** zamiast 6 zagranicznych
- **Pomoc w migracji** z poprzedniego hostingu
- **Doradztwo przed zakupem** — klient może zapytać "co dla mnie pasuje" przed kliknięciem
- **DPA/regulamin po polsku** zgodne z RODO

### Sekcja na stronie

Pod porównywarką, przed konfiguratorem — sekcja "Czemu my a nie bezpośrednio u dostawcy?" z 4-6 argumentami:

1. 🇵🇱 **Polski support 24/7** (lub w godzinach pracy — uzupełnij)
2. 📄 **Jedna faktura VAT** zamiast walki z zagraniczną biurokracją
3. 🔄 **Migracja w cenie** z poprzedniego hostingu
4. 🛡️ **Backup w cenie** w wybranych planach
5. ⚖️ **DPA po polsku** zgodne z RODO
6. 🎯 **Wybór dostawcy bez ryzyka** — jedna umowa, możliwa zmiana między liniami

---

## 6. Okresy rozliczeniowe i strategia cen

Dwie opcje:
- **Miesięcznie** — cena z tabeli (sekcja 7)
- **Rocznie** — cena z tabeli (sekcja 8), rabat 40-58% vs 12× miesięcznie

### Świadoma agresywność rabatu rocznego

Rabaty 40-58% są **celowym zabiegiem marketingowym**. Komunikat na stronie:

> 💰 **Rocznie €125.92** zamiast €216 (€18 × 12) — **oszczędzasz €90 (42%)**
> Płać raz w roku, oszczędzaj jak na promocji Black Friday

### ⚠️ Ostrzeżenie strategiczne (do uwzględnienia w regulaminie)

**Dostawcy infrastruktury podnoszą ceny w 2026.** OVH i Hetzner ogłosili podwyżki od 1 kwietnia 2026 (OVH VPS-4 z $26 na $43.50, Hetzner CPX22 z €5.99 na €7.99). To bezpośrednio wpływa na Twoją marżę.

**Wymagania dla agenta budującego stronę:**

1. W regulaminie i karcie produktu dodaj klauzulę: *"Ceny mogą ulec zmianie z 30-dniowym wyprzedzeniem. Kontrakty roczne mają cenę zamrożoną na 12 miesięcy."*
2. W konfiguratorze pokaż **agresywnie** opcję roczną przy każdym wyborze — klient płaci dziś, my rezerwujemy cenę u dostawcy.
3. W bazie produktów trzymaj pole `cost_price_eur` (cena u dostawcy) i `markup_percent` — wtedy zmiana ceny dostawcy → automatyczne przeliczenie naszej.

---

## 7. Cennik miesięczny (€/miesiąc)

Wiersze = konfiguracja, kolumny = linia (kolor). Pusta komórka = niedostępne, **nie pokazuj w konfiguratorze tej linii**.

| Konfig | Orange (Contabo) | Biały (Hostinger) | Czarny (Hetzner CPX) | Niebieski (OVH Comfort) | Gold (Hetzner CX) | Czerwony (OVH Value) |
|---|---:|---:|---:|---:|---:|---:|
| (baza) | €18 | €20 | €20 | €36 | €15 | €23 |
| A | — | €20 | €20 | €23 | — | €23 |
| D | €24 | €26 | €22 | €31 | €20 | €31 |
| S | €23 | €26 | €22 | €30 | €18 | €30 |
| S+X | €25 | €28 | €23 | €32 | €20 | €32 |
| S+D | €29 | €26 | €28 | €38 | €24 | €32 |
| L | €25 | €30 | €26 | €35 | €26 | €32 |
| X | €19 | €22 | €18 | €26 | €16 | €25 |
| L+A | — | €30 | €26 | €35 | — | €32 |
| L+X | €27 | €33 | €28 | €36 | €28 | €34 |
| L+X+A | — | €33 | €28 | €36 | — | €34 |
| L+S | €31 | €36 | €32 | €40 | €29 | €34 |
| L+D | €32 | €36 | €32 | €42 | €32 | €35 |
| L+D+X | €33 | €39 | €35 | €44 | €35 | €36 |
| L+S+D | €37 | €43 | €39 | €48 | €36 | €47 |
| L+S+D+X | €38 | €46 | €41 | €51 | €39 | €48 |

---

## 8. Cennik roczny (€/12 miesięcy, płatne z góry)

| Konfig | Orange (Contabo) | Biały (Hostinger) | Czarny (Hetzner CPX) | Niebieski (OVH Comfort) | Gold (Hetzner CX) | Czerwony (OVH Value) |
|---|---:|---:|---:|---:|---:|---:|
| (baza) | €125.92 | €142 | €132.70 | €183 | €110 | €135 |
| D | €169.64 | €189 | €154.30 | €230 | €145 | €187 |
| S | €160.31 | €160 | €135.72 | €221 | €140 | €178 |
| S+D | €201.79 | €178 | €166.66 | €260 | €176 | €196 |
| L | €178.97 | €226 | €158.27 | €270 | €177 | €196 |
| L+S | €210.84 | €235 | €180.03 | €294 | €197 | €204 |
| L+D | €219.88 | €276 | €178.86 | €314 | €211 | €213 |
| L+S+D | €248.30 | €275 | €209.83 | €351 | €221 | €290 |
| L+S+D+X | €257.03 | €266 | €212.03 | €368 | €225 | €298 |

**Cennik roczny zawiera tylko konfiguracje główne** (bez dodatków A i samodzielnego X). Jeśli klient chce backup lub same X przy rocznym → komunikat: *"Konfiguracja niedostępna w cenniku rocznym — wybierz wyższy plan lub zamów miesięcznie."*

---

## 9. Wymagania UI/UX dla strony

### Strona główna — hierarchia sekcji

1. **Hero z porównywarką** — najważniejszy element above the fold. Hasło typu *"Najlepsze VPS-y od europejskich dostawców. Jeden support. Po polsku."*
2. **6 kart linii produktowych** — Gold/Orange/Czarny/Biały/Czerwony/Niebieski z marketingowymi nazwami, "od €X/mies", krótkim pozycjonowaniem, nazwą dostawcy małą czcionką ("Powered by Hetzner")
3. **"Czemu my a nie bezpośrednio u dostawcy?"** — 6 argumentów wartości dodanej (sekcja 5)
4. **Sekcja "Jak działa porównywarka"** — 3-4 kroki: filtruj → porównaj → wybierz → zamów
5. **Społeczny dowód** — opinie klientów, logo firm które korzystają, certyfikaty
6. **FAQ** — z jasnym ujawnieniem modelu agregatora

### Karta produktu (po wybraniu linii z porównywarki lub strony głównej)

Sekcje w kolejności:

1. **Nagłówek**: Marketingowa nazwa + "Powered by [Dostawca]" + krótkie pozycjonowanie
2. **Konfigurator**:
   - Rozmiar VPS (radio: Starter / Starter+RAM / Starter+Disk / Starter Plus / Performance / Performance+RAM / Performance+Disk / Pro)
   - Dodatki (checkboxy): Rozszerzona sieć (X), Backup (A) — A ukryte w Gold/Orange
   - Okres rozliczeniowy (toggle Miesięcznie/Rocznie z wyraźnym pokazem oszczędności)
3. **Podsumowanie** z ceną i przyciskiem "Zamów"
4. **Specyfikacja techniczna** (rozwijana) — tu ujawniamy szczegóły dostawcy: model CPU, dokładna lokalizacja DC, link do statusu dostawcy
5. **Co dostajesz w cenie** — lista usług naszych (support PL, faktura VAT, panel, migracja)
6. **Linki do alternatyw** — "Porównaj z innymi liniami"

### Logika cenowa w konfiguratorze

**Cena nie wynika z prostego sumowania.** Konfigurator **musi odczytywać cenę z tabeli** (sekcje 7-8) per kombinacja. Powód: rabaty pakietowe i nieliniowości.

```pseudokod
cena = lookup(linia, konfiguracja_sprzętowa + dodatki, okres)
```

Jeśli kombinacja nie istnieje → disabled w UI z tooltipem.

---

## 10. Zasady komunikacji w UI

- **Nie używaj oznaczeń wewnętrznych** (L/S/D/X/A, nazwy kolorów) w widoku klienta. To są kody SKU.
- **Nazwy upgradów po ludzku:** "Większy RAM", "Szybszy dysk", "Więcej CPU", "Rozszerzona sieć", "Automatyczny backup".
- **Nazwa dostawcy małym tekstem** ("Powered by Hetzner") — widoczna, ale nie dominująca.
- **Polski support eksponuj** — każda karta produktu powinna mieć badge "🇵🇱 Polski support".
- **Lokalizacja DC widoczna** — flaga kraju + nazwa miasta ("🇩🇪 Falkenstein, Niemcy").
- **Rabat roczny wyraźnie** — to nasz główny argument sprzedażowy.
- **Brak backupu w Gold/Orange** komunikuj jako świadomy wybór ("Linia bez backupu — taniej").

---

## 11. Struktura danych dla backendu

```json
{
  "lines": [
    {
      "sku_code": "czarny",
      "marketing_name": "Cloud Business",
      "provider": "Hetzner",
      "provider_line": "CPX",
      "provider_disclosure_visible": true,
      "positioning": "Małe firmy, sklepy startujące, niemiecki DC",
      "backup_available": true,
      "backup_included_from": "L",
      "locations": ["DE-FSN", "DE-NBG", "FI-HEL"],
      "sla_percent": 99.9,
      "polish_support": true,
      "anti_ddos": "basic",
      "configurations": [
        {
          "sku": "czarny-base",
          "hardware": "base",
          "addons": [],
          "specs": {
            "vcpu": 2,
            "ram_gb": 4,
            "disk_gb": 80,
            "transfer_tb": 20,
            "ipv4_count": 1,
            "port_mbps": 1000
          },
          "price_monthly_eur": 20,
          "price_yearly_eur": 132.70,
          "cost_price_monthly_eur": 7.99,
          "markup_percent": 150
        },
        {
          "sku": "czarny-L-S-D-X-A",
          "hardware": "L+S+D",
          "addons": ["X", "A"],
          "specs": {
            "vcpu": 4,
            "ram_gb": 16,
            "disk_gb": 160,
            "transfer_tb": 20,
            "ipv4_count": 2,
            "port_mbps": 1000,
            "backup_daily": true,
            "backup_retention_days": 7
          },
          "price_monthly_eur": 41,
          "price_yearly_eur": null,
          "available_yearly": false
        }
      ]
    }
  ],
  "value_props": [
    {
      "icon": "🇵🇱",
      "title": "Polski support 24/7",
      "description": "Pomoc techniczna po polsku przez 6 dostawców infrastruktury"
    },
    {
      "icon": "📄",
      "title": "Jedna faktura VAT",
      "description": "Polski NIP, polskie księgowanie, bez walki z zagraniczną biurokracją"
    }
  ]
}
```

---

## 12. Co wymaga decyzji właściciela przed publikacją

1. **Potwierdzenie mapowania dostawców** — czy proponowane Hetzner CX/Orange Contabo / Hetzner CPX / Hostinger / OVH Value / OVH Comfort są faktycznie zakontraktowane? Bez podpisanych umów reseller nie ma produktu.
2. **Marża i ceny kosztowe** — sprawdź czy obecne ceny z marżą 25-35% nad cennikami dostawców działają. Po podwyżkach 2026 może być za ciasno.
3. **Nazwy marketingowe linii** — czy "Cloud Lite/Standard/Business/Performance/Pro/Enterprise" pasują, czy własne propozycje?
4. **SLA naszej firmy** — dostawcy mają swoje SLA. Co my dajemy klientowi na piśmie? Czy nakładamy nasze SLA (np. czas odpowiedzi supportu), czy tylko refakturujemy SLA dostawcy?
5. **Zakres polskiego supportu** — 24/7 czy w godzinach? Email/chat/telefon? To wpływa na komunikację na stronie i strukturę kosztową.
6. **Migracje w cenie** — czy faktycznie oferujemy migrację za darmo, czy płatną? To kluczowy argument vs bezpośrednio u dostawcy.
7. **Anomalie cenowe** — w linii Biały dodanie X do L+S+D obniża cenę o €9 rocznie. Do naprawy.
8. **Cennik roczny bez A i X** — świadomie czy do uzupełnienia?
9. **Strategia waloryzacji cen** — jak komunikować klientom przyszłe podwyżki dostawców?

Te punkty właściciel rozstrzyga osobno. Agent może zaimplementować strukturę i UI na podstawie istniejących danych, oznaczając pola "do potwierdzenia" jako placeholder.
