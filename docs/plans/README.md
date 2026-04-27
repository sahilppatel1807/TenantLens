# Feature plans (repo-local)

Plans in this folder are the **canonical** copy: they travel with the git repo and stay readable in any editor or AI tool, not only in Cursor.

## File naming

- One markdown file per initiative: `kebab-case-topic.md` (e.g. `standalone-pdf-module.md`).
- Prefer a short, unique slug over dates in the filename unless you maintain many versions side by side.

## Recommended structure (copy this outline for new plans)

1. **Title** — H1 with the initiative name.
2. **Goal** — One short paragraph: what ships and what is explicitly out of scope.
3. **Path / repo conventions** — Where code lives (`src/…`), tsconfig/path aliases, naming.
4. **Phases** — Numbered or named phases; **Phase 1** = what you implement now; later phases = integration only (bullet list is fine).
5. **Implementation detail** — Tables for new files, function signatures, dependencies.
6. **Constraints** — Runtime (server vs client), security, bundler/Next.js notes, strictness.
7. **Diagrams (optional)** — Mermaid for data flow or architecture; keep node IDs simple (no spaces).
8. **Verification** — Commands or manual checks after implementation.
9. **Non-goals** — Bullets for what must not change.

## Markdown style

- Use `---` horizontal rules between major sections.
- Link repo files with **relative** paths from repo root, e.g. [`src/lib/foo.ts`](src/lib/foo.ts).
- Prefer tables for “file → responsibility” matrices.
- Use fenced `mermaid` blocks only when a diagram clarifies multi-step flow.

## Relationship to root README

- Root [`README.md`](../../README.md) should stay a **short** onboarding index.
- Deep specs and phased roadmaps live here under `docs/plans/`; the root README may link to a plan file in one line.
