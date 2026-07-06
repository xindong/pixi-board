import { computePosition, flip, offset, shift } from "@floating-ui/dom";
import { createIcon, type AppIconName } from "./icons";

export type ContextMenuItem = {
  id: string;
  label: string;
  icon: AppIconName;
  disabled?: boolean;
  hidden?: boolean;
  onSelect: () => void | Promise<void>;
};

export class ContextMenu {
  private readonly root: HTMLDivElement;
  private readonly list: HTMLDivElement;
  private isOpen = false;

  constructor(host: HTMLElement) {
    this.root = document.createElement("div");
    this.root.className = "context-menu";
    this.root.hidden = true;
    this.root.setAttribute("role", "menu");
    this.root.addEventListener("pointerdown", (event) => event.stopPropagation());
    this.root.addEventListener("click", (event) => event.stopPropagation());
    this.root.addEventListener("contextmenu", (event) => event.preventDefault());

    this.list = document.createElement("div");
    this.list.className = "context-menu-list";
    this.root.append(this.list);
    host.appendChild(this.root);

    document.addEventListener("pointerdown", this.handleDocumentPointerDown);
    window.addEventListener("keydown", this.handleWindowKeyDown);
    window.addEventListener("resize", this.hide);
    window.addEventListener("wheel", this.hide, { passive: true });
  }

  show(point: { x: number; y: number }, items: ContextMenuItem[]): void {
    const visibleItems = items.filter((item) => !item.hidden);
    if (visibleItems.length === 0) {
      this.hide();
      return;
    }

    this.list.replaceChildren(...visibleItems.map((item) => this.createItemButton(item)));
    this.root.hidden = false;
    this.isOpen = true;

    const reference = {
      getBoundingClientRect: () =>
        ({
          x: point.x,
          y: point.y,
          left: point.x,
          top: point.y,
          right: point.x,
          bottom: point.y,
          width: 0,
          height: 0,
        }) as DOMRect,
    };

    void computePosition(reference, this.root, {
      placement: "right-start",
      strategy: "fixed",
      middleware: [offset(6), flip(), shift({ padding: 8 })],
    }).then(({ x, y }) => {
      this.root.style.left = `${x}px`;
      this.root.style.top = `${y}px`;
    });
  }

  hide = (): void => {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.root.hidden = true;
    this.list.replaceChildren();
  };

  destroy(): void {
    document.removeEventListener("pointerdown", this.handleDocumentPointerDown);
    window.removeEventListener("keydown", this.handleWindowKeyDown);
    window.removeEventListener("resize", this.hide);
    window.removeEventListener("wheel", this.hide);
    this.root.remove();
  }

  private createItemButton(item: ContextMenuItem): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "context-menu-item";
    button.disabled = Boolean(item.disabled);
    button.setAttribute("role", "menuitem");
    button.append(createIcon(item.icon, { size: 15 }));

    const label = document.createElement("span");
    label.className = "context-menu-label";
    label.textContent = item.label;
    button.append(label);

    button.addEventListener("click", () => {
      if (item.disabled) return;
      this.hide();
      void Promise.resolve(item.onSelect()).catch(console.error);
    });

    return button;
  }

  private readonly handleDocumentPointerDown = (event: PointerEvent): void => {
    if (!this.isOpen) return;
    if (event.target instanceof Node && this.root.contains(event.target)) return;
    this.hide();
  };

  private readonly handleWindowKeyDown = (event: KeyboardEvent): void => {
    if (!this.isOpen || event.key !== "Escape") return;
    event.preventDefault();
    this.hide();
  };
}
