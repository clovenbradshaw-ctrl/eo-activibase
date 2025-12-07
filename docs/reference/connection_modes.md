# Connection modes dictionary

The connection mode dictionary lives at `data/connection_modes.json`. It now contains:

- **`hints`** – a quick lookup used by the connection form for suggested phrases.
- **`primitive_modes`** – single-mode definitions with codes, aliases, directionality, examples, and optional metadata fields.
- **`compound_metamodes`** – combinations of primitive codes that connect to each other to describe richer bridges.
- **`usage_notes`** – human-readable guidance on how to treat compounds and when to add new ones.

## How the app uses it

- `loadConnectionModes` fetches the JSON, normalizes it (including legacy flat maps), and stores the full dictionary on `state.connectionModeDictionary` while keeping the `hints` map on `state.connectionModes` for the existing UI hint text.
- The connection form (`#connectionModeHint`) reads `state.connectionModes[code]` to surface suggested phrasing as a comma-separated list.

## Updating the dictionary safely

1. **Add or edit primitive modes** by appending objects with `code`, `name`, `description`, and at least one of `aliases` or `examples` inside `primitive_modes`.
2. **Add compound metamodes** by combining existing `code` values in `combines`, supplying `aliases` so hints remain descriptive.
3. **Preserve the `hints` map** or omit it entirely—`normalizeConnectionModes` will rebuild hints from aliases/examples if it is empty.
4. Keep the file valid JSON (`jq . data/connection_modes.json`) and maintain the top-level shape so the loader can normalize it.

Following this structure keeps the UI hinting compatible while allowing richer documentation of connection behavior and compound metamodes.
