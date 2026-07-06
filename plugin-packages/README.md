# Plugin package artifacts

Official board plugin source packages live under `packages/board-plugin-*`.

This directory is reserved for generated plugin zip artifacts when they are needed for manual local installation. Do not keep plugin source code here; rebuild artifacts from the corresponding package source instead.

After building a plugin package, generate its local-install zip with the package script:

```sh
pnpm --filter pixi-board-plugin-canvas pack:zip
```
