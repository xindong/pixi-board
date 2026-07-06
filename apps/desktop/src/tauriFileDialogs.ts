import { getCurrentWebview } from "@tauri-apps/api/webview";
import { open } from "@tauri-apps/plugin-dialog";
import type { ProjectInfo } from "@pixi-board/board-domain";
import { isTauriRuntime } from "./runtime/runtimeEnvironment";
import { createOrOpenProject } from "./tauriProjects";

const MEDIA_FILTERS = [
  {
    name: "Media and Text",
    extensions: [
      "png",
      "jpg",
      "jpeg",
      "webp",
      "gif",
      "mp4",
      "webm",
      "mov",
      "mp3",
      "wav",
      "m4a",
      "glb",
      "gltf",
      "obj",
      "fbx",
      "stl",
      "ply",
      "dae",
      "3mf",
      "3ds",
      "vrml",
      "wrl",
      "zip",
      "txt",
      "md",
      "markdown",
      "html",
      "htm",
    ],
  },
];

export async function createCanvasProject(): Promise<ProjectInfo | null> {
  const selected = await open({
    multiple: false,
    directory: true,
  });
  if (!selected) return null;
  const projectPath = Array.isArray(selected) ? selected[0] : selected;
  if (!projectPath) return null;
  return createOrOpenProject(projectPath);
}

export async function openMediaDialog(): Promise<string[]> {
  const selected = await open({
    multiple: true,
    directory: false,
    filters: MEDIA_FILTERS,
  });

  if (!selected) return [];
  return Array.isArray(selected) ? selected : [selected];
}

export async function listenForDroppedFiles(
  onDrop: (paths: string[]) => void,
): Promise<() => void> {
  if (!isTauriRuntime()) return () => {};

  const webview = getCurrentWebview();
  const unlisten = await webview.onDragDropEvent((event) => {
    const payload = event.payload as { type: string; paths?: string[] };
    if (payload.type === "drop" && payload.paths && payload.paths.length > 0) {
      onDrop(payload.paths);
    }
  });

  return unlisten;
}
