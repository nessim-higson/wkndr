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
  {
    match: /\bcheeky monday\b/i,
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/Melkweg_en_Rabozaal.jpg/1280px-Melkweg_en_Rabozaal.jpg',
    note: 'Recurring Melkweg jungle/dnb night — organiser uploads its panther LOGO (slips the vision screen as a "flyer"); pin the lit Melkweg instead',
  },
  // ——— Ness's 2026-07-02 review: five long-running shows pinned to venue-verified images (each found via
  //     the venue-aware query — "title + venue" — and chosen by eye; runs of weeks/months, so pins pay off) ———
  {
    match: /martine gutierrez/i,
    image: 'https://huismarseille.nl/app/uploads/2026/02/Still_Life_Moms_Refrigerator.jpg',
    note: 'Wunderkind at Huis Marseille (until Oct) — an actual work from the show, from the museum’s own site',
  },
  {
    match: /nederland\s*[–—-]\s*japan/i,
    image: 'https://cms.koninklijkeverzamelingen.nl/api/images/rendition/100027/fill-3840x5120/',
    note: 'Royal Palace NL–Japan show (until Sep) — the Citizens’ Hall, from the Royal Collections CMS (auto had the Scheepvaartmuseum!)',
  },
  {
    match: /bostheater|amsterdamse bos(?:\b|$)/i,
    image: 'https://bostheater.nl/wp-content/uploads/2023/04/5R4A0839-1536x1024.jpg',
    note: 'Bostheater summer season — the actual forest amphitheatre mid-show, official site photo (auto had the Concertgebouw!)',
  },
  {
    match: /hortus.*(zomeravond|summer)/i,
    image: 'https://www.amsterdamnow.com/app/uploads/hortus-by-night-amsterdam_6.jpg',
    note: 'Hortus Summer Evenings (recurring Sundays) — the real greenhouses lit at night',
  },
  {
    match: /standout.*comedy|arabic comedy showcase/i,
    image: 'https://app.thefeedfactory.nl/api/assets/67dc4f0cc5d3406178d32b0b/gevel_richel_1800x1020.jpg',
    note: 'StandOut showcase at De Richel — the club’s own frontage (byte-verified against the eyeballed candidate)',
  },
]

/** The curated image URL for a pick title, or undefined. First match wins. */
export function curatedImage(title: string): string | undefined {
  return CURATED_IMAGES.find((c) => c.match.test(title))?.image
}
