# SETUP.md — getting WKNDR running + the Figma loop

## 1. Get it running locally

```bash
cd wkndr
python3 -m http.server 8000
# open http://localhost:8000  → the index navigates everything
```

Or with Node, if you prefer live-reload:

```bash
npx serve .
# or
npm install && npm run dev
```

## 2. Put it on GitHub (so Figma can reach it)

```bash
git init
git add .
git commit -m "WKNDR design exploration — 19 experiments + engine"
# create the repo on github first (private is fine for Pages on paid; public for free Pages)
git remote add origin https://github.com/nessim-higson/wkndr.git
git branch -M main
git push -u origin main
```

Then enable **GitHub Pages**: repo → Settings → Pages → Source: `main` / root → Save.
After a minute your designs are live at:

```
https://nessim-higson.github.io/wkndr/
https://nessim-higson.github.io/wkndr/experiments/02-v5-family/05-v5-kids.html
```

(Prefer private? Use Netlify Drop — drag the folder onto https://app.netlify.com/drop —
or `vercel deploy`. Both give a URL in ~2 min.)

## 3. The Figma handoff (code → Figma)

This is a **one-way handoff**, done once per design when you stop exploring it. Not a sync.

1. In Figma, install the **html.to.design** plugin (free trial, then ~$30/mo).
2. Run it, paste a design's public URL (from step 2).
3. It builds **native, editable Figma frames** — real text, fills, type, ~80% fidelity.
4. Clean up the 20% by hand (auto-layout, a few absolute-positioned bits). ~10 min.
5. **From now on, Figma owns that design.** Refine, comment, build components there.

## 4. Coming back to code (Figma → code), when building for real

- Connect Claude Code to Figma's **Dev Mode MCP server** (Figma → Preferences → enable
  Dev Mode MCP; then add it as an MCP server in Claude Code).
- Point Claude Code at the refined frame; it **reads** the design and **generates fresh
  code** to match (React, or whatever WKNDR ships as).
- This is a regeneration, not a restore of the old HTML. That's expected and fine.

## The mental model (important)

```
EXPLORE            HANDOFF              REFINE           HANDOFF            BUILD
(Claude Code)  ──▶  code → Figma   ──▶  (Figma)     ──▶  Figma → code  ──▶  (Claude Code)
 code owns           once, ~80%          Figma owns       once, fresh        code owns
 the truth           fidelity            the truth        generation         the truth
```

Don't edit the design in both places at once expecting them to stay identical.
Each phase has ONE source of truth. The crossings are deliberate, phase-gated, one-way.

## Working in Warp + Claude Code together

- Warp is your terminal; run `claude` inside a Warp tab. No "importing" — both tools
  operate on the same files on disk.
- Two projects at once: Warp tab 1 = `~/projects/wkndr` (claude session), tab 2 =
  `~/projects/iaah-site` (separate claude session). Independent contexts. (Watch token
  budget when running two heavy sessions.)
- Use Warp for the plumbing (deploy, screenshot, git), Claude Code for the building.
