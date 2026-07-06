export type PluginSortPlacement = "before" | "after";

export type PluginSortControllerOptions = {
  list: HTMLElement;
  onMove: (movingId: string, targetId: string, placement: PluginSortPlacement) => void;
};

export class PluginSortController {
  private readonly list: HTMLElement;
  private readonly onMove: PluginSortControllerOptions["onMove"];
  private draggedPluginId: string | null = null;

  constructor(options: PluginSortControllerOptions) {
    this.list = options.list;
    this.onMove = options.onMove;
  }

  begin(event: PointerEvent, pluginId: string): void {
    event.preventDefault();
    this.draggedPluginId = pluginId;
    const startCard = this.list.querySelector<HTMLElement>(`[data-plugin-id="${CSS.escape(pluginId)}"]`);
    startCard?.classList.add("is-dragging");

    const onPointerMove = (moveEvent: PointerEvent) => {
      const target = document
        .elementFromPoint(moveEvent.clientX, moveEvent.clientY)
        ?.closest<HTMLElement>("[data-plugin-id]");
      const targetId = target?.dataset.pluginId;
      if (!targetId || targetId === this.draggedPluginId || !this.draggedPluginId) return;
      const rect = target.getBoundingClientRect();
      this.onMove(
        this.draggedPluginId,
        targetId,
        moveEvent.clientY > rect.top + rect.height / 2 ? "after" : "before",
      );
    };

    const onPointerUp = () => {
      this.draggedPluginId = null;
      this.list.querySelectorAll(".is-dragging").forEach((element) => element.classList.remove("is-dragging"));
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp, { once: true });
  }
}
