import type { AppStatus } from "../status";

type RefreshNodePreviewActionOptions = {
  nodeId: string;
  onStatus: (status: AppStatus) => void;
  refreshNodePreview: (nodeId: string) => void | Promise<void>;
};

export function refreshNodePreviewAction(options: RefreshNodePreviewActionOptions): void {
  void Promise.resolve(options.refreshNodePreview(options.nodeId)).catch((error) => {
    console.error(error);
    options.onStatus("saveFailed");
  });
}
