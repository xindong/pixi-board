import { invoke } from "@tauri-apps/api/core";
import type {
  BoardNode,
  BoardSnapshot,
  BoardViewportSnapshot,
  ProjectInfo,
} from "@pixi-board/board-domain";

export async function createOrOpenProject(path: string): Promise<ProjectInfo> {
  return invoke<ProjectInfo>("create_or_open_project", { path });
}

export async function openInitialProject(): Promise<ProjectInfo | null> {
  return invoke<ProjectInfo | null>("open_initial_project");
}

export async function listCanvasProjects(): Promise<ProjectInfo[]> {
  return invoke<ProjectInfo[]>("list_canvas_projects");
}

export async function renameCurrentProject(name: string): Promise<ProjectInfo> {
  return invoke<ProjectInfo>("rename_current_project", { name });
}

export async function loadBoardSnapshot(projectRoot: string): Promise<BoardSnapshot> {
  return invoke<BoardSnapshot>("load_board_snapshot", { projectRoot });
}

export async function saveBoardState(
  projectRoot: string,
  nodes: readonly BoardNode[],
  viewport: BoardViewportSnapshot,
): Promise<void> {
  await invoke("save_board_state", { projectRoot, nodes, viewport });
}

export async function revealProjectInFinder(projectRoot: string): Promise<void> {
  await invoke("reveal_project_in_finder", { projectRoot });
}

export async function saveBoardScreenshot(projectRoot: string, dataUrl: string): Promise<string> {
  return invoke<string>("save_board_screenshot", { projectRoot, dataUrl });
}
