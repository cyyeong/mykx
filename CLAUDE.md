@AGENTS.md

## Claude Code notes

- Project skills are in `.agents/skills/`; `.claude/skills` is a symlink to that folder so Claude and Muse share one copy. Edit skills there, never in a copy.
- Claude Code has no image tool. Generate art with `node .agents/skills/muse-image-assets/scripts/gen-image.mjs` (needs `MODEL_API_KEY`), or hand an art round to Muse Code (`muse exec --prompt-file …`).
- Check UI work in the browser and critique a screenshot before calling it done.
