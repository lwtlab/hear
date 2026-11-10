# AI Hear public delivery

This repository owns the AI Hear website, public CI and product artifacts. Reader and Hear
application development takes place in private `lwtlab/lwt-core`; this public checkout contains no
private application source. New Hear workflows accept one immutable `source_ref` for `apps/hear`
and its native core. Historical `app_ref` / `core_ref` inputs remain available for legacy builds.
Public workflows, site deployment and product releases retain their independent identities.



Use Node 24.22.0 (`.nvmrc`); website installation keeps pnpm 9.15.9 as pinned by the Pages workflow.
Application CI uses pnpm 11.5.2. When this repository is nested under the private Hear workspace,
install the independent site with `corepack pnpm@9.15.9 install --ignore-workspace --frozen-lockfile`.

## Desktop CI

Pinned-source macOS checks and unsigned candidates: [operation guide](docs/desktop-ci.zh.md). Infrastructure tests: `node --test ci/*.test.mjs`. Website deployment and release feeds are unchanged.

Three-platform feasibility checks and diagnostic runtimes: [probe guide](docs/cross-platform-probe.zh.md).
