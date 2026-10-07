# Dependency security

Run audits from a clean install so stale or shared `node_modules` trees do not distort the result:

```bash
npm ci
npm audit --omit=dev
npm audit
```

## 2026-10-07 review

- Production/runtime dependencies: **0 advisories** (`npm audit --omit=dev`). The deployed Node server does not install or execute Vite, Tailwind, ESLint or Drizzle Kit at request time.
- Full development tree after compatible updates: **11 advisories** (5 high, 6 moderate, 0 critical), reduced from 23. Vite, PostCSS, Rollup, Babel, Nano ID, source-map, YAML, minimatch and related compatible fixes were resolved through the lockfile. The direct esbuild build dependency moved to 0.28.x and passed the complete build/test suite.
- Remaining Tailwind 3 advisories are in build-time glob/file-watcher parsing (`braces`, `chokidar`, `fast-glob`, `micromatch`, `postcss-nested`, and `postcss-selector-parser`). Locat does not accept user-controlled build patterns or run the Tailwind watcher in production. The registry currently proposes Tailwind 4, which is a breaking CSS/build migration and must be handled as a separately tested upgrade.
- Remaining Drizzle Kit advisories are in its deprecated `@esbuild-kit` loader. Drizzle Kit is used by developers to generate migrations, not by the running server. npm's proposed remediation is a downgrade to Drizzle Kit 0.18.1; that risks schema-generation incompatibility and is intentionally rejected. Runtime `drizzle-orm` is not identified by the audit.

Do not use `npm audit fix --force`. Recheck after Tailwind or Drizzle publishes a compatible remediation, and perform those migrations on the development branch with schema snapshot, fresh-install, upgrade and recovery testing.
