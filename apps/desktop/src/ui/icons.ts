import {
  Camera,
  ChevronDown,
  Copy,
  Download,
  FolderOpen,
  Frame,
  LoaderCircle,
  Pause,
  PencilLine,
  Play,
  Plus,
  RefreshCw,
  Save,
  Store,
  Type,
  Upload,
  X,
  createElement as createLucideElement,
  type IconNode,
} from "lucide";

const APP_ICONS = {
  camera: Camera,
  chevronDown: ChevronDown,
  copy: Copy,
  download: Download,
  folderOpen: FolderOpen,
  frame: Frame,
  loading: LoaderCircle,
  pause: Pause,
  pencil: PencilLine,
  play: Play,
  plus: Plus,
  refresh: RefreshCw,
  save: Save,
  store: Store,
  text: Type,
  upload: Upload,
  x: X,
} satisfies Record<string, IconNode>;

export type AppIconName = keyof typeof APP_ICONS;

type CreateIconOptions = {
  className?: string;
  size?: number;
  strokeWidth?: number;
};

export function createIcon(
  name: AppIconName,
  { className, size = 16, strokeWidth = 2 }: CreateIconOptions = {},
): SVGElement {
  return createLucideElement(APP_ICONS[name], {
    "aria-hidden": "true",
    class: className ? `ui-icon ${className}` : "ui-icon",
    focusable: "false",
    height: size,
    width: size,
    "stroke-width": strokeWidth,
  });
}
