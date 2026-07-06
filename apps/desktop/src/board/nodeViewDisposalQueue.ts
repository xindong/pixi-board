type NodeViewDisposalQueueOptions = {
  delayMs: number;
  dispose: (nodeId: string) => void;
};

export class NodeViewDisposalQueue {
  private readonly delayMs: number;
  private readonly dispose: NodeViewDisposalQueueOptions["dispose"];
  private readonly timers = new Map<string, number>();

  constructor(options: NodeViewDisposalQueueOptions) {
    this.delayMs = options.delayMs;
    this.dispose = options.dispose;
  }

  schedule(nodeId: string, canDispose: () => boolean): void {
    if (this.timers.has(nodeId)) return;

    const timer = window.setTimeout(() => {
      this.timers.delete(nodeId);
      if (canDispose()) {
        this.dispose(nodeId);
      }
    }, this.delayMs);

    this.timers.set(nodeId, timer);
  }

  cancel(nodeId: string): void {
    const timer = this.timers.get(nodeId);
    if (timer === undefined) return;
    window.clearTimeout(timer);
    this.timers.delete(nodeId);
  }

  clear(): void {
    for (const timer of this.timers.values()) {
      window.clearTimeout(timer);
    }
    this.timers.clear();
  }
}
