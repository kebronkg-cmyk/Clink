// Antwortkarten: Eisbrecher für die erste Nachricht nach einem Match.
// Die erste Nachricht im Chat ist immer eine Karte; danach geht es frei weiter,
// die Karten bleiben als schnelle Antworten verfügbar.

export type Card = { id: string; text: string };
export type CardGroup = { id: string; label: string; emoji: string; cards: Card[] };

export const CARD_GROUPS: CardGroup[] = [
  {
    id: "abend",
    label: "Der Abend",
    emoji: "🌙",
    cards: [
      { id: "abend-song", text: "Der Song, bei dem wir angestoßen haben, war eindeutig zu kurz." },
      { id: "abend-musik", text: "Ich wollte dich noch was fragen, aber dann war die Musik zu laut." },
      { id: "abend-gesucht", text: "Ich hab dich später noch gesucht, aber du warst weg." },
      { id: "abend-fuss", text: "Falls ich dir beim Tanzen auf den Fuß getreten bin: Sorry!" },
      { id: "abend-lang", text: "Wie lange bist du noch geblieben?" },
      { id: "abend-bzz", text: "Als die Bänder vibriert haben, musste ich echt lachen." },
    ],
  },
  {
    id: "tanzen",
    label: "Tanzen",
    emoji: "💃",
    cards: [
      { id: "tanz-seit", text: "Seit wann tanzt du schon?" },
      { id: "tanz-stil", text: "Salsa, Bachata oder ganz was anderes: Was ist deins?" },
      { id: "tanz-fuehren", text: "Führst du lieber oder lässt du dich lieber führen?" },
      { id: "tanz-kurs", text: "Lust, mal zusammen in einen Kurs oder Workshop zu gehen?" },
      { id: "tanz-socials", text: "Welche Socials in der Stadt kannst du empfehlen?" },
      { id: "tanz-neu", text: "Ehrlich gesagt war ich zum ersten Mal da. Und du?" },
    ],
  },
  {
    id: "wiedersehen",
    label: "Wiedersehen",
    emoji: "🥂",
    cards: [
      { id: "wieder-naechster", text: "Bist du beim nächsten CLINK-Abend wieder dabei?" },
      { id: "wieder-tanz", text: "Der nächste Tanz geht auf mich." },
      { id: "wieder-kaffee", text: "Lust auf einen Kaffee diese Woche?" },
      { id: "wieder-drink", text: "Gehen wir mal auf einen Drink, ganz ohne laute Musik?" },
      { id: "wieder-wochenende", text: "Was machst du am Wochenende?" },
    ],
  },
  {
    id: "kennenlernen",
    label: "Kennenlernen",
    emoji: "👋",
    cards: [
      { id: "kennen-hey", text: "Hey! Schön, dass es ein Match ist." },
      { id: "kennen-gehofft", text: "Ich hab gehofft, dass du auch nach rechts swipest." },
      { id: "kennen-sonst", text: "Was machst du, wenn du nicht gerade tanzt?" },
      { id: "kennen-stadt", text: "Wohnst du schon lange hier?" },
      { id: "kennen-heim", text: "Bist du gut nach Hause gekommen?" },
    ],
  },
  {
    id: "locker",
    label: "Mit Humor",
    emoji: "😄",
    cards: [
      { id: "humor-band", text: "Das Band hatte offenbar recht." },
      { id: "humor-wer", text: "Mal ehrlich: Wer hat eigentlich wen angestoßen?" },
      { id: "humor-sonntag", text: "Wie hart war dein Morgen danach, von 1 bis 10?" },
      { id: "humor-name", text: "Ich musste erst auf das Foto schauen, um mir deinen Namen zu merken. Jetzt sitzt er." },
    ],
  },
];

const BY_ID = new Map(CARD_GROUPS.flatMap((g) => g.cards.map((c) => [c.id, c] as const)));

export function getCard(id: string): Card | undefined {
  return BY_ID.get(id);
}
