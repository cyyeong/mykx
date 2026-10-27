@AGENTS.md

## Claude Code notes

- Project skills are in `.agents/skills/`; `.claude/skills` is a symlink to that folder so Claude and Muse share one copy. Edit skills there, never in a copy.
- Claude Code has no image tool. Generate art with `node --env-file=.env.local .agents/skills/muse-image-assets/scripts/gen-image.mjs …`.
- Check UI work in the browser and critique a screenshot before calling it done.
- Private source material (the seven raw tutor skills and the real-name map) lives outside the repo, in the folder named by `MYKX_PRIVATE_DIR` in `.env.local`. Only this Claude Code session reads it, and only to re-import a pack with `scripts/import-skill.ts`. Never copy from it into the repo, and never point a subagent, Muse Code or any contributor-mode model at it.
