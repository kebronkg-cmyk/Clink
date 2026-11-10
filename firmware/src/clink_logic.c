#include "clink_logic.h"

#include <string.h>

static int64_t abs64(int64_t v)
{
	return v < 0 ? -v : v;
}

void cl_init(struct cl_state *s, uint32_t self_id, const struct clink_params *p, cl_encounter_cb cb,
	     void *user)
{
	memset(s, 0, sizeof(*s));
	s->self_id = self_id;
	s->p = *p;
	s->cb = cb;
	s->user = user;
}

void cl_set_params(struct cl_state *s, const struct clink_params *p)
{
	s->p = *p;
	if (s->p.dance_window_s > 64) {
		s->p.dance_window_s = 64;
	}
}

bool cl_has_met(const struct cl_state *s, uint32_t peer_id)
{
	for (uint16_t i = 0; i < s->met_count; i++) {
		if (s->met[i] == peer_id) {
			return true;
		}
	}
	return false;
}

void cl_mark_met(struct cl_state *s, uint32_t peer_id)
{
	if (cl_has_met(s, peer_id) || s->met_count >= CL_MAX_MET) {
		return;
	}
	s->met[s->met_count++] = peer_id;
}

void cl_forget_all(struct cl_state *s)
{
	s->met_count = 0;
	for (int i = 0; i < CL_MAX_PEERS; i++) {
		s->peers[i].dance_mask = 0;
	}
}

static void report(struct cl_state *s, uint32_t peer_id, uint8_t kind, int8_t rssi)
{
	/* Pro Paar nur einmal speichern und nur beim ersten Mal vibrieren. */
	if (cl_has_met(s, peer_id) || s->met_count >= CL_MAX_MET) {
		return;
	}
	cl_mark_met(s, peer_id);
	if (s->cb) {
		s->cb(peer_id, kind, rssi, s->user);
	}
}

/* Gibt den Eintrag für peer_id zurück oder ersetzt den am längsten nicht gesehenen. */
static struct cl_peer *peer_slot(struct cl_state *s, uint32_t peer_id)
{
	struct cl_peer *oldest = &s->peers[0];

	for (int i = 0; i < CL_MAX_PEERS; i++) {
		struct cl_peer *p = &s->peers[i];

		if (p->id == peer_id) {
			return p;
		}
		if (p->last_seen_ms < oldest->last_seen_ms) {
			oldest = p;
		}
	}
	memset(oldest, 0, sizeof(*oldest));
	oldest->id = peer_id;
	return oldest;
}

static bool shocks_match(const struct cl_state *s, int64_t own_ms, const struct cl_peer *p)
{
	if (own_ms == 0 || p->shock_ms == 0) {
		return false;
	}
	if (abs64(p->shock_ms - own_ms) > (int64_t)s->p.window_ms + CL_ADV_JITTER_MS) {
		return false;
	}
	return p->shock_rssi >= s->p.clink_rssi;
}

void cl_on_own_shock(struct cl_state *s, int64_t now_ms)
{
	s->own_shock_ms = now_ms;

	/* Das andere Band kann seinen Stoß schon vor unserem gemeldet haben. */
	for (int i = 0; i < CL_MAX_PEERS; i++) {
		struct cl_peer *p = &s->peers[i];

		if (p->id != 0 && now_ms - p->shock_ms <= CL_SHOCK_MEMORY_MS && shocks_match(s, now_ms, p)) {
			report(s, p->id, CLINK_KIND_CLINK, p->shock_rssi);
		}
	}
}

static void on_dance_sample(struct cl_state *s, struct cl_peer *p, int64_t now_ms, int8_t rssi)
{
	if (!s->p.dance_enabled || s->p.dance_samples == 0 || s->p.dance_window_s == 0) {
		return;
	}

	int64_t sec = now_ms / 1000;
	int64_t shift = sec - p->dance_sec;

	if (shift >= 64 || shift < 0) {
		p->dance_mask = 0;
	} else if (shift > 0) {
		p->dance_mask <<= shift;
	}
	p->dance_sec = sec;

	if (rssi < s->p.dance_rssi) {
		return;
	}
	p->dance_mask |= 1;

	uint64_t window = s->p.dance_window_s >= 64 ? UINT64_MAX : ((1ULL << s->p.dance_window_s) - 1);

	if (__builtin_popcountll(p->dance_mask & window) >= s->p.dance_samples) {
		report(s, p->id, CLINK_KIND_DANCE, rssi);
	}
}

void cl_on_adv(struct cl_state *s, int64_t now_ms, const struct clink_adv *adv, int8_t rssi)
{
	if (adv->magic[0] != CLINK_MAGIC0 || adv->magic[1] != CLINK_MAGIC1 ||
	    adv->version != CLINK_PROTO_VERSION || adv->band_id == 0 || adv->band_id == s->self_id) {
		return;
	}
	/* Bänder an der Ladestation zählen nicht. */
	if (adv->flags & CLINK_ADV_FLAG_CHARGING) {
		return;
	}

	struct cl_peer *p = peer_slot(s, adv->band_id);

	p->last_seen_ms = now_ms;

	if ((adv->flags & CLINK_ADV_FLAG_SHOCK) && adv->shock_age_ms != CLINK_NO_SHOCK) {
		int64_t shock_ms = now_ms - adv->shock_age_ms;

		/* Neuer Stoß (neue Nummer oder alter Stoß längst vorbei): Höchstwert neu messen. */
		if (adv->shock_seq != p->shock_seq || p->shock_ms == 0 ||
		    abs64(shock_ms - p->shock_ms) > CL_SHOCK_MEMORY_MS) {
			p->shock_seq = adv->shock_seq;
			p->shock_ms = shock_ms;
			p->shock_rssi = rssi;
		} else if (rssi > p->shock_rssi) {
			p->shock_rssi = rssi;
		}

		if (shocks_match(s, s->own_shock_ms, p)) {
			report(s, p->id, CLINK_KIND_CLINK, p->shock_rssi);
		}
	}

	on_dance_sample(s, p, now_ms, rssi);
}
