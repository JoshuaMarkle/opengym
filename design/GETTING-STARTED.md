# Getting started with Claude Code

## 1. Set up the repo (once)

```bash
cd ~/projects/opengym
git init
cp design/CLAUDE.md ./CLAUDE.md      # Claude Code reads CLAUDE.md from the repo root
git add -A && git commit -m "Design package"
```

Install Claude Code if you haven't (`npm install -g @anthropic-ai/claude-code`), then run `claude` inside `~/projects/opengym`.

## 2. First session: plan, don't code

Paste this:

> Read CLAUDE.md, design/SPEC.md and design/storyboards/complete.html. Don't write code yet. Give me (1) any questions or contradictions you find, (2) the folder structure you'd use, and (3) a checklist for Phase 1 and Phase 2 from SPEC §7.

Answer its questions and agree on the structure. Plan mode (Shift+Tab) is good for this.

## 3. Then one phase per session

> Do Phase 1 from design/SPEC.md §7. When done, tell me how to run it and how to install it on my iPhone to test.

Test on your phone after each phase, commit, then:

> Phase 1 is committed. Do Phase 2. Write the Vitest tests SPEC asks for.

Keep going down the list. For screen work, name the IDs, e.g. *"Build screens 4.1–4.5 to match complete.html"*. Claude Code can open the HTML file and read the exact layout and copy.

## 4. Testing on your iPhone during development

- `npm run dev -- --host` serves the app on your network. Open `http://<your-computer-ip>:5173` in Safari on the phone.
- PWA install and service-worker behavior only work over HTTPS. For a real install test, deploy a build (Cloudflare Pages or GitHub Pages on your domain), or expose the dev server over HTTPS with `tailscale serve`.

## 5. Tips

- Start a fresh session for each phase. Long sessions drift.
- If something looks off, screenshot it on your phone and paste the image into Claude Code next to the storyboard screen ID.
- Make design changes in `design/SPEC.md` first, then ask Claude Code to apply them, so the spec stays the source of truth.
- Commit after every working phase so you can always roll back.
