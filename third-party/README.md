# Third-party plugins

This folder manages plugin code and artifacts that are not part of the main board project.

Official board plugins, such as `pixi-board-plugin-canvas`, live in the main project packages and official plugin artifacts. External plugins should keep their source, build output, and zip package under this folder.

Runtime loading does not scan `third-party/` directly. To load a plugin, place its zip artifact in `~/.pixi-board/plugins`.
