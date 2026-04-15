# Udonarium Lily Format Research Note

- Type: `reference`
- Based on: local sample files in `.claude/research/`
- Not the source of truth for product behavior

## Reliable Findings
- Udonarium Lily export is packaged as one ZIP.
- Useful files include:
  - `chat.xml`
  - `data.xml`
  - `imagetag.xml`
  - image assets
- `chat.xml` includes strong metadata such as:
  - speaker name
  - timestamp
  - direct sender linkage
  - message color
  - expression index
- `data.xml` contains character data and many `numberResource` values that can serve as status candidates.

## Important Caveats
- XML structure varies by game system, especially under `detail`.
- Treat sample-derived code carefully; implementation snippets in research notes are illustrative, not drop-in source code.
- Product rules for expression import and status handling belong in schema/spec docs, not here.

## ReplayRiter Implications
- Udonarium is the strongest candidate for automatic per-message face selection
- direct character linkage should be preferred over name-only matching when available
- status candidates should be collected broadly, then filtered by the user
