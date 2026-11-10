# CLINK – Firmware für das Armband (KKM W59)

Firmware v0.1 für das KKM W59 mit **nRF52832** und Bewegungssensor **LIS3DH**. Grundlage sind die KKM-Unterlagen
`pca10040_W59u.h` und der Schaltplan `K59_52832 V1.3`.

## Was das Band macht

| Situation | Verhalten |
| --- | --- |
| **Anstoßen** | Der Sensor meldet einen Stoß (Schwelle einstellbar, Standard 2,5 g). Das Band sendet sofort per Bluetooth „Stoß vor x ms“ und hört 0,4 s lang zu. Haben **beide** Bänder innerhalb des Zeitfensters (Standard 100 ms) einen Stoß gespürt **und** sind sie sehr nah (Standard ≥ −45 dBm), speichern **beide** die Begegnung und vibrieren zweimal. |
| **Paartanz** | Ist ein anderes Band in 25 von 60 Sekunden sehr nah (≥ −55 dBm), zählt das auch als Begegnung (laut Spec gewollt, abschaltbar). |
| **Gleiches Paar nochmal** | Wird nicht erneut gespeichert und vibriert nicht. |
| **Touch-Taste** | Grün blinken = alles ok · rot blinken = Akku unter 15 % · rot/grün im Wechsel = Band noch nicht eingerichtet. |
| **An den Ladekontakten** | Keine Begegnungen, das Band wartet aufs Auslesen. |
| **Auslesen** | Admin → **Auslesen** (Chrome/Edge auf Laptop oder Android): verbinden, Begegnungen übertragen, Band leeren, neue Firmware-Werte übernehmen. Neue Bänder werden dabei mit der Geräte-ID vom Aufkleber eingerichtet. |

Gespeichert werden bis zu 1024 Begegnungen pro Abend, im internen Flash. Sie überstehen also auch einen leeren Akku.

## Hardware (aus den KKM-Unterlagen)

| Teil | Pin | Hinweis |
| --- | --- | --- |
| LED rot / grün | P0.22 / P0.23 | aktiv high |
| Vibrationsmotor | P0.27 | über MOSFET AO3400 |
| Touch-Taste (TTP233D) | P0.08 | aktiv low |
| LIS3DH (I2C) | SCL P0.11, SDA P0.12, INT1 P0.16, INT2 P0.15 | CS (P0.14) und SDO/SA0 (P0.13) hängen laut Schaltplan am nRF. Die Firmware setzt beide fest auf high: I²C-Modus, Adresse **0x19** (kein Scan nötig). Stöße kommen über INT2. |
| Akkuspannung | P0.05 / AIN3 | Teiler 1:2, 3,3–4,1 V |
| USB/Ladekontakte erkannt | P0.29 | |
| Debug-UART (Testpunkte) | TX P0.31, RX P0.30 | in v0.1 aus, Debug über SWD/RTT |
| SWD (Header P1) | SWDCLK, SWDIO, VCC, GND | zum Programmieren |
| Summer | P0.06 (PWM) | laut Schaltplan nicht bestückt (R15/Q2/R16 „NC“); auf den Mustern prüfen. Die Firmware nutzt ihn nicht, das Band vibriert nur. |
| **Nicht bestückt** | SPI-Flash FM25W04 | laut Release-Note „NC“, P0.17–P0.20 frei |

Die Board-Definition liegt in `boards/clink/clink_w59/`.

## ⚠️ Vor dem ersten Flashen: Original sichern

Neue Firmware zu flashen **überschreibt die KKM-Firmware**. Deshalb vorher:

1. **KKM fragen**, ob sie die Original-Firmware als `.hex` schicken können. Dann lässt sich jedes Band jederzeit zurücksetzen.
2. Mit angeschlossenem Programmiergerät versuchen, das Original auszulesen:
   ```bash
   nrfjprog --readcode w59_original.hex --readuicr
   ```
   - Klappt das, die Datei gut aufheben.
   - Kommt **„Access protection is enabled“**, ist der Chip gesperrt. Dann geht es nur mit `nrfjprog --recover`, und das **löscht alles** auf dem Chip, auch das Original. Das ist unproblematisch, wenn KKM das Original liefern kann oder ihr das Band ohnehin nur mit CLINK nutzt.
3. Mit **einem** der vier Muster anfangen.

## Was du brauchst

- **Programmiergerät:** **nRF52840 DK** (hat einen J-Link eingebaut) oder ein Segger J-Link.
- **Verbindung zu den 4 SWD-Kontakten** auf der Platine (Header P1): Pogo-Pins, eine Klemme oder dünne angelötete Drähte.
- **Software:** [nRF Connect for Desktop](https://www.nordicsemi.com/Products/Development-tools/nRF-Connect-for-Desktop) mit **Programmer**-App (einfachster Weg) oder `nrfutil` auf der Kommandozeile.

### Anschluss an das nRF52840 DK (Stiftleiste P20 „Debug out“)

| Band, Header P1 | Signal | nRF52840 DK, P20 |
| --- | --- | --- |
| 1 (meist der **eckige** Kontakt) | VCC_nRF | **VTG** (nur Spannungserkennung) |
| 2 | GND | **GND** |
| 3 | SWDCLK | **SWDCLK** |
| 4 | SWDIO | **SWDIO** |

- **Vorher prüfen:** Pin 2 hat mit dem Multimeter Durchgang zum Akku-Minus.
- **Band vorher laden.** Das DK liefert keinen Strom ans Band, das Band läuft aus seinem eigenen Akku.
- Sobald an VTG Spannung anliegt, programmiert der J-Link des DK automatisch das **Band** statt des eigenen Chips auf dem DK.
- Das DK per USB an den Rechner anschließen und einschalten.

## Flashen (ohne selbst zu bauen)

Fertig gebaute Dateien liegen in `dist/`:

| Datei | Wofür |
| --- | --- |
| `clink_w59_v0.1.0.hex` | Normalbetrieb, stromsparend |
| `clink_w59_v0.1.0_debug.hex` | Zum Testen: gibt über SWD aus, was das Band erkennt (mit J-Link RTT Viewer) |

**Mit der Programmer-App:** Gerät wählen → *Erase all* → `.hex` hinzufügen → *Write*.

**Mit der Kommandozeile:**
```bash
nrfutil device program --firmware dist/clink_w59_v0.1.0.hex --options chip_erase_mode=ERASE_ALL,verify=VERIFY_READ
nrfutil device reset
# älteres Werkzeug, gleiche Wirkung:
nrfjprog -f NRF52 --program dist/clink_w59_v0.1.0.hex --chiperase --verify --reset
```

Danach blinkt das Band kurz rot/grün im Wechsel, weil es noch nicht eingerichtet ist.

## Erster Test (Checkliste)

1. **Start:** Rot/grün im Wechsel = Firmware läuft, Band noch nicht eingerichtet.
2. **Einrichten:** Admin → **Auslesen** → „Band verbinden“ → `CLINK-NEU` wählen → Geräte-ID vom Aufkleber eingeben. Das Band vibriert dreimal.
3. **Touch-Taste:** jetzt grün blinken.
4. **Zweites Band** genauso einrichten.
5. **Anstoßen:** Handgelenke kurz und deutlich aneinanderstoßen. Beide vibrieren zweimal.
6. **Nochmal anstoßen:** kein Vibrieren mehr (pro Paar nur einmal).
7. **Auslesen:** beide Bänder nacheinander über „Band verbinden“. Im Protokoll steht „1 Begegnungen (1 Clink …)“, die Begegnung landet im gewählten Event.

**Wenn das Anstoßen nicht erkannt wird:** Mit der Debug-Firmware und dem J-Link RTT Viewer sieht man, ob der Stoß ankommt. Dann im Admin unter **Firmware** die Schwellen anpassen und die Bänder einmal auslesen, denn dabei übernehmen sie die neuen Werte:
- Stoß wird nicht erkannt → **Stoß-Schwelle senken** (z. B. 1,8 g).
- Stoß erkannt, aber keine Begegnung → **RSSI-Schwelle lockern** (z. B. −55 dBm) oder **Zeitfenster vergrößern** (z. B. 150 ms).
- Normales Tanzen löst aus → Stoß-Schwelle erhöhen.

## Selbst bauen

Mit dem **nRF Connect SDK** (VS Code Extension) oder reinem **Zephyr 4.2**:
```bash
west build -b clink_w59 firmware                                     # Normalbetrieb
west build -b clink_w59 firmware -- -DEXTRA_CONF_FILE=debug.conf     # mit Debug-Ausgaben
west flash
```
Die Board-Definition wird über `CMakeLists.txt` automatisch gefunden. Getestet mit Zephyr v4.2.2 und GCC 13.2: 147 KB Flash (28 %), 36 KB RAM (55 %).

**Logik-Tests auf dem PC** (ohne Hardware):
```bash
cd firmware/test
cc -std=c11 -Wall -Wextra -I../src ../src/clink_logic.c test_logic.c -o test_logic && ./test_logic
```

## Aufbau

| Datei | Inhalt |
| --- | --- |
| `src/clink_logic.c` | Erkennung: Anstoßen, Paartanz, pro Paar nur einmal (hardwareunabhängig, getestet) |
| `src/accel.c` | LIS3DH-Stoßerkennung im Sensor (Click-Interrupt, 400 Hz, Hochpassfilter) |
| `src/radio.c` | Bluetooth senden und zuhören |
| `src/gatt.c` | Auslesen per Web Bluetooth, Anmeldung per HMAC-SHA256 |
| `src/store.c` | Einstellungen und Begegnungs-Speicher im Flash |
| `src/hw.c` | LEDs, Motor, Touch, Akku, Ladekontakte |
| `src/proto.h` | gemeinsame Formate, siehe `PROTOCOL.md` |

## Noch offen

- **Updates per Bluetooth (MCUboot):** Bis dahin wird per SWD geflasht. Die Speicheraufteilung ist schon dafür vorbereitet.
- **Kalibrierung an echten Bändern:** Stoß-Schwelle, RSSI und Paartanz-Werte sind Startwerte und müssen auf der Tanzfläche eingestellt werden.
- **Akkulaufzeit messen:** geschätzt ca. 1,2 mA, also gut 3 Tage. Bitte einmal eine ganze Nacht testen.
- **Uhrzeit:** Das Band hat keine Uhr. Die Uhrzeit einer Begegnung wird beim Auslesen aus der Laufzeit berechnet. Startet das Band zwischendurch neu (Akku leer), bekommen ältere Einträge die Auslesezeit.
