import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Agent worktrees under .claude/ are full repo copies.
    exclude: [...configDefaults.exclude, ".claude/**"],
  },
});
