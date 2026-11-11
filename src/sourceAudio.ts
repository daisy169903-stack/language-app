/** Seek cues into the publisher's freely playable original recording.
 * No podcast audio bytes or approval records are bundled or auto-imported.
 * Times were located by local ASR; they are not a native-speaker review.
 */
export interface SourceAudio {
  id: string;
  text: string;
  url: string;
  pageUrl: string;
  publisher: string;
  start: number;
  end: number;
  accentBasis: "publisher-labelled-northern";
}
const episode = {
  url: "https://media.vietlingo.com/podcasts/northern/beginners/ep01-chao-hoi.mp3",
  pageUrl: "https://vietlingo.com/podcast/greetings-chao-hoi-northern",
  publisher: "Vietlingo · Greetings (Phương)",
  accentBasis: "publisher-labelled-northern" as const,
};
const references: SourceAudio[] = [
  { ...episode, id: "greeting.chao", text: "chào", start: 461.33, end: 462.08 },
  {
    ...episode,
    id: "politeness.cam-on",
    text: "cảm ơn",
    start: 246.64,
    end: 247.4,
  },
];
export function sourceAudioFor(id: string): SourceAudio | undefined {
  return references.find((reference) => reference.id === id);
}
