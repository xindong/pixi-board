export const UNNAMED_NODE_NAME = "未命名节点";

export function displayNodeName(name: string | undefined): string {
  const trimmed = name?.trim();
  return trimmed ? trimmed : UNNAMED_NODE_NAME;
}
