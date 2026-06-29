// CURATED IMAGE OVERRIDES — hand-pinned images for hero / recurring events the auto-pipeline gets wrong.
//
// Auto-selection (open-web search + vision) is good for the long tail but unreliable for the events that
// matter most: it gave Bruno Mars an anonymous concert-stock shot instead of Bruno. This is the reliable
// lever — a known event ALWAYS gets the right photo here, regardless of what the auto-pipeline picked.
//
// Applied LAST in the image pass (after all auto-selection, before the portrait wrap), so it always wins —
// and it even rescues an event the pipeline would otherwise drop for having no verified photo. Each image is
// a real, subject-correct, portrait-friendly photo, verified by eye. Stored RAW; the pipeline wsrv-wraps it
// to the tall card like every other image (server-side fetch, so any host works).
//
// To pin an event: add a line. `match` is tested (case-insensitive) against the pick title — keep it to the
// stable core of the name ("bruno mars", not the year/tour suffix) so it survives the event being re-listed.

export const CURATED_IMAGES: { match: RegExp; image: string; note: string }[] = [
  {
    match: /\bbruno mars\b/i,
    image: 'https://upload.wikimedia.org/wikipedia/commons/b/b0/BrunoMars24KMagicWorldTourLive_%28cropped%29.jpg',
    note: 'Wikipedia portrait — tall, face-on, crops to the card clean (auto-pipeline served anonymous concert stock)',
  },
  {
    match: /\bvunzige deuntjes\b/i,
    image: 'https://www.amsterdamnow.com/app/uploads/main_stage_vunzige_deuntjes.jpg',
    note: 'Main-stage pyro shot, 1700×1133 (auto-pipeline served a 200px blur)',
  },
  {
    match: /\bhomelanding\b/i,
    image: 'https://www.amsterdamnow.com/app/uploads/marineterrein-amsterdam3.jpg',
    note: 'Waterside Marineterrein (the festival’s site), 1700×1134 (auto served a generic restaurant terrace, then dropped it)',
  },
  {
    match: /\bwonderfeel\b/i,
    image: 'https://admin.wonderfeel.nl/app/uploads/program-image/1200x1200/9544-1.jpg',
    note: 'Official outdoor orchestra photo — locks the good auto-pick so a future refresh can’t regress it',
  },
]

/** The curated image URL for a pick title, or undefined. First match wins. */
export function curatedImage(title: string): string | undefined {
  return CURATED_IMAGES.find((c) => c.match.test(title))?.image
}
