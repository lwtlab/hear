# AI Hear public delivery

This repository owns the AI Hear website, public CI and product artifacts. Reader and Hear
application development takes place in private `lwtlab/lwt-core`; this public checkout contains no
private application source. New Hear workflows accept one immutable `source_ref` for `apps/hear`
and its native core. Historical `app_ref` / `core_ref` inputs remain available for legacy builds.
Public workflows, site deployment and product releases retain their independent identities.



## Desktop CI

Pinned-source macOS checks and unsigned candidates: [operation guide](docs/desktop-ci.zh.md). Infrastructure tests: `node --test ci/*.test.mjs`. Website deployment and release feeds are unchanged.

Three-platform feasibility checks and diagnostic runtimes: [probe guide](docs/cross-platform-probe.zh.md).
