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
    image: 'https://i.wfolio.com/x/uZ-vrbqj2EegGiEP2PkuXsznqV8gaoGg/cNtZ_MSjbOEP2eLU2__oPeAAQGn0NK35/yXhfxlFmzf7IvhdXN8iX4vDLlxP5xcQj/zZ_QPu5Xm6ghtzaTGdROz0Rerda5lFNq/vxJ3owfZMHQBHB-EggWsoA.jpg',
    note: 'Wikipedia portrait — tall, face-on, crops to the card clean (auto-pipeline served anonymous concert stock)',
  },
  {
    match: /\bvunzige deuntjes\b/i,
    image: 'https://www.amsterdamnow.com/app/uploads/main_stage_vunzige_deuntjes.jpg',
    note: 'Main-stage pyro shot, 1700×1133 (auto-pipeline served a 200px blur)',
  },
  // homelanding pin REMOVED (R2): Ness killed the event — it's in the corpus veto now.
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
  {
    match: /\bkwaku\b/i,
    image: 'https://www.iamsterdam.com/_next/image?url=https%3A%2F%2Fapp.thefeedfactory.nl%2Fapi%2Fassets%2F62b40a855d1a2c5d5eab528a%2FKwaku_01.webp&w=1920&q=75',
    note: 'R4 (issue #10): Ness supplied this exact URL on the board (img-url verdict) — the festival-crowd shot from I amsterdam’s own asset CDN; recurring multi-weekend event, pin pays off',
  },
  {
    match: /hannekes boom/i,
    image: 'https://hannekesboom.nl/wp-content/uploads/23_EmiroSmolders-HannekesBoom_DSC00763-1-e1769691113265.jpg',
    note: 'R6 (issue #12): Ness supplied this exact URL on the board (img-url verdict) — the venue’s own waterfront shot; beloved recurring terrace, pin pays off',
  },
  {
    match: /\bbret\b/i,
    image: 'https://app.thefeedfactory.nl/api/assets/63cfdda587ca114344bf775b/1xyhdofhh6g1-bret.webp',
    note: 'R5 (issue #11): third round of wrong BRET images — the venue og:image the pipeline kept landing on is a sunny garden-café shot, the wrong story for a club night. This is I amsterdam’s in-the-booth night shot (DJ, crowd, the hanging plants — 1800×1020), checked by eye; matches every weekly "BRET: <lineup>" title.',
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
  // bostheater + hortus-zomeravonden pins REMOVED (R2): both events killed on the board (vetoed).
  // NB the old bostheater pin also matched "amsterdamse bos" — that would have stamped the
  // amphitheatre photo onto the Amsterdamse Bos canon card. Gone with it.
  {
    match: /standout.*comedy|arabic comedy showcase/i,
    image: 'https://app.thefeedfactory.nl/api/assets/67dc4f0cc5d3406178d32b0b/gevel_richel_1800x1020.jpg',
    note: 'StandOut showcase at De Richel — the club’s own frontage (byte-verified against the eyeballed candidate)',
  },
  // ——— NESS'S PICKS (Curation Board round 1, 2026-07-02) — his eye, pinned. All URL-verified. ———
  { match: /cinema culinair/i, image: 'https://cinemaculinair.nl/wp-content/uploads/above-view-cinema-culinair-voorstellingen.webp', note: 'Ness pick — overhead dinner-cinema scene, official site' },
  { match: /jollof club/i, image: 'https://www.kookboekhandel.com/cdn/shop/files/Nicolas-1.jpg?v=1760095844&width=1445', note: 'Ness pick' },
  { match: /throwback/i, image: 'https://app.thefeedfactory.nl/api/assets/67d47399f653b54a9ab132f9/Het_Sieraad.webp', note: 'Ness pick — the actual Het Sieraad' },
  { match: /world press photo/i, image: 'https://www.nieuwekerk.nl/wp-content/uploads/2026/02/2026-04-23_De-Nieuwe-Kerk_World-Press-Photo-2026__Tomek-Dersu-Aaron_1967.jpg', note: 'Ness pick — the exhibition inside De Nieuwe Kerk' },
  { match: /festival trek|trek.*(street food|foodfestival|food festival)/i, image: 'https://littlewanderbook.com/wp-content/uploads/2015/07/Food-Truck-Festival-Trek6.jpg', note: 'Ness pick' },
  { match: /nicolas van poucke/i, image: 'https://denieuwemuze.nl/wp-content/uploads/2024/10/59F966E8-F1CC-46B7-9C77-5692C9FD8179.jpg', note: 'Ness pick — the pianist himself' },
  { match: /kwaku/i, image: 'https://mydailyfavorite.nl/storage/content/optimized/my_daily_favorite_kwakoe_zomer_festival_2024jpg-01153.jpg.webp', note: 'Ness pick — the festival crowd in the park' },
  { match: /kay slice/i, image: 'https://www.agogo-records.com/wp-content/uploads/2026/01/2.-CC-Roasted-Kweku-1330x1920.jpg', note: 'Ness pick — the artist, tall portrait (ends the wrong-image saga on this card)' },
  { match: /stoornis of my life/i, image: 'https://www.kunstmin.nl/assets/uploads/2025/12/MarkEngelen_StoornisOfMyLife_Groep_compleet_KimJoey-scaled-e1774620693437.jpg', note: 'Ness pick — cast photo' },
  { match: /little big things/i, image: 'https://d3s3zh7icgjwgd.cloudfront.net/AcuCustom/Sitename/DAM/345/Cast-of-The-Little-Big-Things.-Photo--Pamela-Raith-1_LargeLandscape.jpg', note: 'Ness pick — cast photo' },
  { match: /land art weekend/i, image: 'https://storage.pubble.nl/39aff116/content/2025/4/ee4bcf1f-8214-44a4-add3-afcf1d8b332a_thumb1920.jpg', note: 'Ness pick' },
  // ——— R3 (2026-07-04): BRET's RA flyers were the wrong image TWICE — pin the venue itself. ———
  // (a second /\bbret\b/i pin — the bret.bar og:image garden shot — was REMOVED 2026-07-12: that is
  // the exact image Ness rejected three rounds running; the in-the-booth night-shot pin above wins.)
]

/** The curated image URL for a pick title, or undefined. First match wins. */
export function curatedImage(title: string): string | undefined {
  return CURATED_IMAGES.find((c) => c.match.test(title))?.image
}