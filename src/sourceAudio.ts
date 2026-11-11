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
  kind: "podcast" | "word-recording";
  start: number;
  end: number;
  accentBasis: "publisher-labelled-northern";
  accentEvidenceUrl?: string;
}
const episode = {
  url: "https://media.vietlingo.com/podcasts/northern/beginners/ep01-chao-hoi.mp3",
  pageUrl: "https://vietlingo.com/podcast/greetings-chao-hoi-northern",
  publisher: "Vietlingo · Greetings (Phương)",
  kind: "podcast" as const,
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
  {
    id: "farewell.tam-biet",
    text: "tạm biệt",
    url: "https://d1pra95f92lrn3.cloudfront.net/audio/174745.mp3",
    pageUrl:
      "https://www.vietnamesepod101.com/vietnamese-vocabulary-lists/most-common-ways-to-say-goodbye",
    publisher: "VietnamesePod101 · Tạm biệt!",
    kind: "word-recording",
    start: 0,
    end: 1.071,
    accentBasis: "publisher-labelled-northern",
    accentEvidenceUrl:
      "https://www.vietnamesepod101.com/forum/viewtopic.php?t=35",
  },
];
export function sourceAudioFor(id: string): SourceAudio | undefined {
  return references.find((reference) => reference.id === id);
}
