/*
 * Test der Erkennungslogik auf dem PC:
 *   cc -std=c11 -Wall -Wextra -I../src ../src/clink_logic.c test_logic.c -o test_logic && ./test_logic
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "clink_logic.h"

static int failures;
static int events;
static uint32_t last_peer;
static uint8_t last_kind;

#define CHECK(cond, msg)                                                                           \
	do {                                                                                       \
		if (cond) {                                                                        \
			printf("ok:     %s\n", msg);                                               \
		} else {                                                                           \
			printf("FEHLER: %s\n", msg);                                               \
			failures++;                                                                \
		}                                                                                  \
	} while (0)

static void on_encounter(uint32_t peer, uint8_t kind, int8_t rssi, void *user)
{
	(void)rssi;
	(void)user;
	events++;
	last_peer = peer;
	last_kind = kind;
}

static struct clink_adv adv(uint32_t id, bool shock, uint16_t age, uint8_t seq)
{
	struct clink_adv a = {
		.company = CLINK_COMPANY_ID,
		.magic = {CLINK_MAGIC0, CLINK_MAGIC1},
		.version = CLINK_PROTO_VERSION,
		.flags = shock ? CLINK_ADV_FLAG_SHOCK : 0,
		.band_id = id,
		.shock_age_ms = shock ? age : CLINK_NO_SHOCK,
		.shock_seq = seq,
	};
	return a;
}

static void reset(struct cl_state *s)
{
	struct clink_params p = CLINK_PARAMS_DEFAULT;

	cl_init(s, 778775, &p, on_encounter, NULL);
	events = 0;
	last_peer = 0;
	last_kind = 0;
}

int main(void)
{
	static struct cl_state s;
	struct clink_adv a;

	/* 1. Anstoßen: eigener Stoß, dann Paket des anderen Bandes, nah und gleichzeitig */
	reset(&s);
	cl_on_own_shock(&s, 10000);
	a = adv(778776, true, 15, 1);
	cl_on_adv(&s, 10030, &a, -38);
	CHECK(events == 1 && last_peer == 778776 && last_kind == CLINK_KIND_CLINK, "Anstoßen wird erkannt");

	/* 2. Gleiches Paar nochmal: keine zweite Meldung */
	cl_on_own_shock(&s, 20000);
	a = adv(778776, true, 10, 2);
	cl_on_adv(&s, 20010, &a, -35);
	CHECK(events == 1, "Pro Paar nur einmal");

	/* 3. Umgekehrte Reihenfolge: Paket kommt vor dem eigenen Stoß an */
	reset(&s);
	a = adv(778777, true, 5, 1);
	cl_on_adv(&s, 5000, &a, -40);
	CHECK(events == 0, "Ohne eigenen Stoß keine Begegnung");
	cl_on_own_shock(&s, 5040);
	CHECK(events == 1 && last_peer == 778777, "Eigener Stoß danach löst Begegnung aus");

	/* 4. Zu weit weg (schwaches Signal) */
	reset(&s);
	cl_on_own_shock(&s, 1000);
	a = adv(778778, true, 10, 1);
	cl_on_adv(&s, 1010, &a, -70);
	CHECK(events == 0, "Zu weit weg zählt nicht");

	/* 5. Später doch näher gemessen (gleicher Stoß, stärkeres Paket) */
	a = adv(778778, true, 30, 1);
	cl_on_adv(&s, 1030, &a, -42);
	CHECK(events == 1, "Stärkstes Paket desselben Stoßes zählt");

	/* 6. Stöße zeitlich zu weit auseinander */
	reset(&s);
	cl_on_own_shock(&s, 1000);
	a = adv(778779, true, 10, 1);
	cl_on_adv(&s, 1300, &a, -35); /* Stoß bei 1290 ms */
	CHECK(events == 0, "300 ms Abstand zählt nicht");

	/* 7. Altes Paket (großes Alter) zählt nicht */
	reset(&s);
	cl_on_own_shock(&s, 3000);
	a = adv(778780, true, 400, 1); /* Stoß bei 2600 */
	cl_on_adv(&s, 3000, &a, -35);
	CHECK(events == 0, "Stoß von vor 400 ms zählt nicht");

	/* 8. Eigene ID und Bänder an der Ladestation werden ignoriert */
	reset(&s);
	cl_on_own_shock(&s, 1000);
	a = adv(778775, true, 5, 1);
	cl_on_adv(&s, 1005, &a, -30);
	a = adv(778781, true, 5, 1);
	a.flags |= CLINK_ADV_FLAG_CHARGING;
	cl_on_adv(&s, 1005, &a, -30);
	CHECK(events == 0, "Eigene ID und ladende Bänder ignoriert");

	/* 9. Paartanz: 25 von 60 Sekunden sehr nah */
	reset(&s);
	for (int sec = 0; sec < 40; sec++) {
		a = adv(778782, false, 0, 0);
		cl_on_adv(&s, 100000 + sec * 1000, &a, (sec % 3 == 0) ? -70 : -50);
	}
	CHECK(events == 1 && last_kind == CLINK_KIND_DANCE, "Paartanz wird nach genug Nähe erkannt");

	/* 10. Nur kurz nah (10 s) reicht nicht */
	reset(&s);
	for (int sec = 0; sec < 10; sec++) {
		a = adv(778783, false, 0, 0);
		cl_on_adv(&s, 200000 + sec * 1000, &a, -45);
	}
	for (int sec = 10; sec < 60; sec++) {
		a = adv(778783, false, 0, 0);
		cl_on_adv(&s, 200000 + sec * 1000, &a, -75);
	}
	CHECK(events == 0, "Kurz nebeneinander stehen zählt nicht als Paartanz");

	/* 11. Paartanz abgeschaltet */
	reset(&s);
	s.p.dance_enabled = 0;
	for (int sec = 0; sec < 60; sec++) {
		a = adv(778784, false, 0, 0);
		cl_on_adv(&s, 300000 + sec * 1000, &a, -40);
	}
	CHECK(events == 0, "Paartanz lässt sich abschalten");

	/* 12. Mehrere Pakete pro Sekunde zählen als eine Sekunde */
	reset(&s);
	for (int i = 0; i < 80; i++) {
		a = adv(778785, false, 0, 0);
		cl_on_adv(&s, 400000 + i * 250, &a, -40); /* 20 Sekunden, 4 Pakete/s */
	}
	CHECK(events == 0, "Viele Pakete in 20 s ergeben keinen Paartanz");

	/* 13. Vergessen nach dem Auslesen: gleiches Paar am nächsten Abend wieder möglich */
	reset(&s);
	cl_on_own_shock(&s, 1000);
	a = adv(778786, true, 5, 1);
	cl_on_adv(&s, 1005, &a, -35);
	cl_forget_all(&s);
	cl_on_own_shock(&s, 900000);
	a = adv(778786, true, 5, 2);
	cl_on_adv(&s, 900005, &a, -35);
	CHECK(events == 2, "Nach dem Auslesen ist das Paar wieder neu");

	/* 14. Viele Bänder gleichzeitig (mehr als Tabellenplätze) */
	reset(&s);
	for (uint32_t id = 1; id <= 100; id++) {
		a = adv(800000 + id, false, 0, 0);
		cl_on_adv(&s, 500000 + id, &a, -80);
	}
	cl_on_own_shock(&s, 600000);
	a = adv(900001, true, 10, 1);
	cl_on_adv(&s, 600010, &a, -40);
	CHECK(events == 1 && last_peer == 900001, "Volle Tabelle: neue Bänder verdrängen alte");

	printf("\n%s (%d Fehler)\n", failures ? "TESTS FEHLGESCHLAGEN" : "Alle Tests bestanden", failures);
	return failures ? EXIT_FAILURE : EXIT_SUCCESS;
}
