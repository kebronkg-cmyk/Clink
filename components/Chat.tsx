"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Avatar } from "./Avatar";
import { Countdown } from "./Countdown";
import { ConfirmButton } from "./ConfirmButton";
import { CARD_GROUPS } from "@/lib/cards";
import { MESSAGE_MAX } from "@/lib/config";
import { extendChat, loadChat, sendChatMessage, unmatchAction } from "@/app/actions";
import type { ChatView } from "@/lib/service";
import styles from "./Chat.module.css";

const POLL_MS = 4000;

const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });

export function Chat({ initial, partnerId }: { initial: ChatView; partnerId: string }) {
  const [chat, setChat] = useState(initial);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [group, setGroup] = useState(CARD_GROUPS[0].id);
  const [cardsOpen, setCardsOpen] = useState(initial.nachrichten.length === 0);
  const [pending, start] = useTransition();
  const bottom = useRef<HTMLDivElement>(null);
  const started = chat.nachrichten.length > 0;

  const refresh = useCallback(async () => {
    const next = await loadChat(chat.eventId, partnerId);
    if (next) setChat(next);
  }, [chat.eventId, partnerId]);

  // Einfaches Nachladen statt Echtzeit: reicht für den Pilot und läuft überall.
  useEffect(() => {
    if (!chat.offen) return;
    const t = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, POLL_MS);
    return () => clearInterval(t);
  }, [chat.offen, refresh]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chat.nachrichten.length]);

  const send = (input: { karte: string } | { text: string }) =>
    start(async () => {
      setError(null);
      const res = await sendChatMessage(chat.eventId, partnerId, input);
      if (!res.ok) return setError(res.error);
      if ("text" in input) setText("");
      setCardsOpen(false);
      await refresh();
    });

  const extend = () =>
    start(async () => {
      const res = await extendChat(chat.eventId, partnerId);
      if (!res.ok) return setError(res.error);
      if (res.verlaengert) navigator.vibrate?.([50, 40, 50]);
      await refresh();
    });

  const p = chat.partner;
  const activeGroup = CARD_GROUPS.find((g) => g.id === group) ?? CARD_GROUPS[0];

  return (
    <div className={styles.chat}>
      <header className={styles.head}>
        <Link href="/app/matches" className={styles.back} aria-label="Zurück zu den Matches">
          ←
        </Link>
        <Avatar name={p.vorname} foto={p.foto} id={p.id} size={44} />
        <div className={styles.who}>
          <p className={styles.name}>
            {p.vorname} <span>{p.alter}</span>
          </p>
          <p className={styles.meta}>{chat.event}</p>
        </div>
        {p.instagram && (
          <a className={styles.ig} href={`https://instagram.com/${p.instagram}`} target="_blank" rel="noreferrer">
            @{p.instagram}
          </a>
        )}
      </header>

      {chat.offen ? (
        <div className={styles.timer}>
          <span>
            ⏳ Chat offen: <Countdown until={chat.chatUntil} />
          </span>
          {chat.ichVerlaengere ? (
            <span className={styles.waiting}>Du willst verlängern. Wartet auf {p.vorname} …</span>
          ) : (
            <button type="button" className={styles.extend} onClick={extend} disabled={pending}>
              {chat.partnerVerlaengert ? `${p.vorname} will verlängern: +72 h ✓` : "+72 h verlängern"}
            </button>
          )}
        </div>
      ) : (
        <div className={styles.timer}>
          <span>Der Chat ist abgelaufen. Euer Match bleibt{p.instagram ? ", Instagram oben" : ""}.</span>
        </div>
      )}

      <div className={styles.messages} aria-live="polite">
        {!started && chat.offen && (
          <div className={styles.intro}>
            <p className={styles.introTitle}>Ihr wolltet euch beide wiedersehen.</p>
            <p>Wähl eine Karte für den ersten Clink. Danach könnt ihr frei schreiben.</p>
          </div>
        )}
        {chat.nachrichten.map((m) => (
          <div key={m.id} className={`${styles.msg} ${m.vonMir ? styles.mine : styles.theirs} ${m.karte ? styles.card : ""}`}>
            {m.karte && <span className={styles.cardTag}>🥂 Antwortkarte</span>}
            <p>{m.text}</p>
            <time>{timeOf(m.zeit)}</time>
          </div>
        ))}
        <div ref={bottom} />
      </div>

      {chat.offen && (
        <div className={styles.composer}>
          {error && (
            <p className="alert" role="alert">
              {error}
            </p>
          )}
          {cardsOpen && (
            <div className={styles.cards}>
              <div className={styles.groups} role="tablist" aria-label="Kategorien">
                {CARD_GROUPS.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    role="tab"
                    aria-selected={g.id === group}
                    className={styles.group}
                    onClick={() => setGroup(g.id)}
                  >
                    {g.emoji} {g.label}
                  </button>
                ))}
              </div>
              <div className={styles.cardList}>
                {activeGroup.cards.map((c) => (
                  <button key={c.id} type="button" className={styles.cardBtn} disabled={pending} onClick={() => send({ karte: c.id })}>
                    {c.text}
                  </button>
                ))}
              </div>
            </div>
          )}
          <form
            className={styles.inputRow}
            onSubmit={(e) => {
              e.preventDefault();
              if (text.trim()) send({ text });
            }}
          >
            <button
              type="button"
              className={`${styles.cardToggle} ${cardsOpen ? styles.cardToggleOn : ""}`}
              onClick={() => setCardsOpen((o) => !o)}
              aria-label="Antwortkarten zeigen"
              aria-expanded={cardsOpen}
            >
              🥂
            </button>
            <input
              className={`input ${styles.text}`}
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={MESSAGE_MAX}
              placeholder={started ? "Nachricht …" : "Erst eine Karte wählen"}
              disabled={!started || pending}
              aria-label="Nachricht"
            />
            <button className={`btn btn-pink ${styles.sendBtn}`} disabled={!started || pending || !text.trim()} aria-label="Senden">
              ➤
            </button>
          </form>
        </div>
      )}

      <form action={unmatchAction.bind(null, chat.eventId, partnerId)} className={styles.unmatch}>
        <ConfirmButton
          className={styles.unmatchBtn}
          message={`Match mit ${p.vorname} auflösen? Der Chat wird für euch beide gelöscht.`}
        >
          Match auflösen
        </ConfirmButton>
      </form>
    </div>
  );
}
