import type { BoardPersistenceController } from "./boardPersistenceController";

export async function persistBoardWrite(
  persistence: BoardPersistenceController,
  options: { quiet?: boolean } = {},
): Promise<void> {
  persistence.clearPendingDocumentSave();
  await persistence.persistNow(options);
}
