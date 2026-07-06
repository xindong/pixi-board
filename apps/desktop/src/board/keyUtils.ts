export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tagName = target.tagName.toLowerCase();
  return tagName === "input" || tagName === "textarea" || tagName === "select";
}

export function shouldHandleHotkey(
  event: KeyboardEvent,
  options: { requireMeta: boolean },
): boolean {
  if (event.altKey) return false;
  if (options.requireMeta && !event.metaKey && !event.ctrlKey) return false;
  return !isEditableTarget(event.target);
}
