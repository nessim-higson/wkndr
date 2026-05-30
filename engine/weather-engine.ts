// ============================================================
// WKNDR — Weather Mode Engine
// The Thursday-night logic that classifies the weekend
// and re-ranks candidates accordingly.
// ============================================================

// ----- TYPES -----

type Forecast = {
  date: string;            // ISO date
  tempHigh: number;        // °C
  tempLow: number;         // °C
  precipChance: number;    // 0-100
  precipMm: number;        // total mm forecast
  windKmh: number;
  cloudCover: number;      // 0-100
  daylightHours: number;
};

type WeatherMode =
  | "HOT"          // First-summer-day energy
  | "WARM"         // Pleasant, flexible
  | "COOL"         // Crisp, cultural
  | "COLD_WET"    // Indoor mode
  | "VOLATILE";    // Hedge mode, plan A/B

type WeatherSignal = {
  mode: WeatherMode;
  emoji: string;
  headline: string;        // The lede the brief leads with
  rationale: string;       // Why this classification (for debugging + transparency)
  cityContext?: string;    // City-specific framing
  pivotRisk: boolean;      // Should we warn the user about possible mid-weekend changes?
};

type Venue = {
  id: string;
  name: string;
  category: string;
  tags: string[];          // ["terrace", "indoor", "kids", "music", etc.]
  weatherFit: Partial<Record<WeatherMode, number>>;  // -2 to +3
};

type RankedPick = Venue & { score: number; reason: string };


// ============================================================
// 1. WEATHER MODE CLASSIFIER
// ============================================================

export function classifyWeekend(
  saturday: Forecast,
  sunday: Forecast,
  city: string,
  yearContext: { isFirstWarmDay?: boolean; isLastWarmDay?: boolean } = {}
): WeatherSignal {

  const avgHigh = (saturday.tempHigh + sunday.tempHigh) / 2;
  const maxPrecip = Math.max(saturday.precipChance, sunday.precipChance);
  const totalRain = saturday.precipMm + sunday.precipMm;
  const tempSwing = Math.abs(saturday.tempHigh - sunday.tempHigh);
  const dayDiffSignificant = tempSwing >= 6 || Math.abs(saturday.precipChance - sunday.precipChance) >= 40;

  // VOLATILE: significant day-to-day difference or borderline rain
  if (dayDiffSignificant || (maxPrecip >= 40 && maxPrecip <= 65)) {
    return {
      mode: "VOLATILE",
      emoji: "🌤️",
      headline: "Hedge your bets — the weekend wants Plan A and Plan B.",
      rationale: `Sat ${saturday.tempHigh}°/${saturday.precipChance}% rain · Sun ${sunday.tempHigh}°/${sunday.precipChance}% rain. Mixed signals.`,
      pivotRisk: true,
    };
  }

  // COLD_WET: indoor mode
  if (avgHigh < 10 || totalRain > 8 || maxPrecip > 65) {
    return {
      mode: "COLD_WET",
      emoji: "🌧️",
      headline: "Indoor weekend. The city's hidden corners are waiting.",
      rationale: `Avg high ${avgHigh.toFixed(0)}°, ${totalRain.toFixed(0)}mm rain forecast across the weekend.`,
      pivotRisk: false,
    };
  }

  // HOT: terrace + water mode
  if (avgHigh >= 24 && maxPrecip < 30) {
    const firstSummerHook = yearContext.isFirstWarmDay
      ? "The year's first true summer day hits, and the city is already outside."
      : `${avgHigh.toFixed(0)}° and clear — this is a terrace-and-water weekend.`;
    return {
      mode: "HOT",
      emoji: "☀️",
      headline: firstSummerHook,
      rationale: `Avg high ${avgHigh.toFixed(0)}°, <30% rain. Sunny weekend.`,
      cityContext: cityHotContext(city),
      pivotRisk: false,
    };
  }

  // WARM: flexible mode
  if (avgHigh >= 16 && maxPrecip < 40) {
    return {
      mode: "WARM",
      emoji: "🌤️",
      headline: "Pleasant weekend — the kind that lets you choose your own adventure.",
      rationale: `Avg high ${avgHigh.toFixed(0)}°, low rain. Flexible.`,
      pivotRisk: false,
    };
  }

  // COOL: cultural mode (default fallback)
  return {
    mode: "COOL",
    emoji: "🍂",
    headline: "Crisp weekend. Long lunches, gallery rooms, intimate venues.",
    rationale: `Avg high ${avgHigh.toFixed(0)}°. Cool but dry — cultural pace.`,
    pivotRisk: false,
  };
}

// City-specific HOT context (the cultural moat)
function cityHotContext(city: string): string {
  const lookup: Record<string, string> = {
    "Amsterdam":   "First sunny Saturdays in Amsterdam mean terraces are full by noon and Marineterrein swim opens. Plan accordingly.",
    "New Orleans": "When the heat index climbs past 90°F, NOLA slows down before noon and starts up again after 6. Book interior dining for the middle of the day.",
    "Berlin":      "Hot Berlin weekends move to the lakes and Tempelhof. Spätis are out of cold drinks by 4pm — plan ahead.",
    "London":      "Brits treat any sunny weekend like the last one. Get to the parks early; pubs with gardens will be at capacity by 2pm.",
    "Tokyo":       "Heat above 30° in Tokyo means daytime indoor culture, then night markets and rooftops after sunset.",
  };
  return lookup[city] || "";
}


// ============================================================
// 2. WEATHER-AWARE RANKING
// ============================================================

// Each venue carries weatherFit scores per mode.
// Higher = better fit for that weather. Negative = actively bad fit.
//
// Example venue:
//   Hortus Botanicus: { HOT: +3, WARM: +2, COOL: +1, COLD_WET: -1, VOLATILE: +1 }
//   Stedelijk Museum: { HOT: -2, WARM: 0, COOL: +2, COLD_WET: +3, VOLATILE: +2 }
//   Marineterrein swim: { HOT: +3, WARM: +1, COOL: -3, COLD_WET: -3, VOLATILE: -1 }
//   Eye Filmmuseum: { HOT: -1, WARM: +1, COOL: +2, COLD_WET: +3, VOLATILE: +2 }

export function rankByWeather(
  candidates: Venue[],
  signal: WeatherSignal,
  userProfile: { interests: string[]; hasKids: boolean }
): RankedPick[] {

  return candidates
    .map(v => {
      const weatherScore = (v.weatherFit[signal.mode] ?? 0) * 10;

      // Interest alignment (Spotify tags, behavioral history, etc.)
      const interestScore = v.tags.filter(t => userProfile.interests.includes(t)).length * 3;

      // Kid filter
      const kidPenalty = userProfile.hasKids && v.tags.includes("21plus") ? -20 : 0;
      const kidBonus = userProfile.hasKids && v.tags.includes("kids") ? 5 : 0;

      // VOLATILE mode: bonus for venues with indoor/outdoor flexibility
      const flexBonus = signal.mode === "VOLATILE" && v.tags.includes("flexible") ? 8 : 0;

      const score = weatherScore + interestScore + kidPenalty + kidBonus + flexBonus;

      return { ...v, score, reason: buildReason(v, signal, weatherScore, interestScore) };
    })
    .sort((a, b) => b.score - a.score);
}

function buildReason(v: Venue, signal: WeatherSignal, weatherScore: number, interestScore: number): string {
  const parts: string[] = [];
  if (weatherScore >= 20) parts.push(`Perfect for ${signal.mode.toLowerCase().replace('_', ' ')} weather`);
  else if (weatherScore >= 10) parts.push(`Works well in ${signal.mode.toLowerCase().replace('_', ' ')}`);
  else if (weatherScore < 0) parts.push(`Despite weather mismatch — strong on taste`);
  if (interestScore >= 6) parts.push("matches your taste signals");
  return parts.join(", ");
}


// ============================================================
// 3. THE NARRATIVE GENERATOR (LLM prompt assembly)
// ============================================================
// This is what gets passed to Claude/GPT-4 to write the brief.

export function buildBriefPrompt(
  signal: WeatherSignal,
  topPicks: RankedPick[],
  userProfile: any,
  weekend: { sat: Forecast; sun: Forecast }
): string {
  return `
You are writing the Friday WKNDR brief for ${userProfile.name} in ${userProfile.city}.

WEATHER SIGNAL: ${signal.mode} ${signal.emoji}
  Headline: ${signal.headline}
  Sat: ${weekend.sat.tempHigh}°C, ${weekend.sat.precipChance}% rain
  Sun: ${weekend.sun.tempHigh}°C, ${weekend.sun.precipChance}% rain
  ${signal.cityContext ? `City context: ${signal.cityContext}` : ''}

USER PROFILE:
  Household: ${userProfile.household.join(', ')}
  Taste signals: ${userProfile.interests.slice(0, 5).join(', ')}
  Recent saves: ${userProfile.recentSaves.join(', ')}

TOP 3 PICKS (already weather-ranked, do not reorder):
${topPicks.slice(0, 3).map((p, i) => `
  ${i + 1}. ${p.name}
     Score: ${p.score} — ${p.reason}
     Tags: ${p.tags.join(', ')}
`).join('\n')}

TASK:
1. Open with the weather headline, in a single sentence.
2. Write a 2-sentence lede that names the SHAPE of the weekend
   (terrace, indoor, cultural, hedge — based on mode).
3. For each of the 3 picks, write 2-3 sentences of narrated recommendation
   in Ness's editorial voice (direct, specific, opinionated, no fluff).
4. End with a one-line "if none of this hits" pointer to the deeper list.

VOICE: Like a knowledgeable friend who reads the city's writers for you.
Never bland. Never generic. Specific times, specific corners, specific
reasons. If a place has a terrace, name which direction it faces. If a
venue is small, say how small. Trust the reader.

DO NOT republish copyrighted text. Use facts and your own framing.
  `.trim();
}


// ============================================================
// 4. EXAMPLE: a real Thursday night run
// ============================================================

// This is what a real run would look like.
// Given a forecast, classify, rank, generate prompt.

const thisWeekend: { sat: Forecast; sun: Forecast } = {
  sat: { date: "2026-05-30", tempHigh: 20, tempLow: 12, precipChance: 30, precipMm: 1, windKmh: 15, cloudCover: 50, daylightHours: 16 },
  sun: { date: "2026-05-31", tempHigh: 19, tempLow: 11, precipChance: 35, precipMm: 2, windKmh: 18, cloudCover: 60, daylightHours: 16 },
};

const signal = classifyWeekend(thisWeekend.sat, thisWeekend.sun, "Amsterdam");
// → { mode: "WARM", headline: "Pleasant weekend — the kind that lets you choose your own adventure." }

// Then: rank candidates against signal
// Then: pass top 3 to LLM with the prompt above
// Then: email the result Friday morning.

// That's the whole engine. ~250 lines.

export { signal };
