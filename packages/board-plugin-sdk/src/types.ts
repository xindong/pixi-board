export type JSONSchema = Record<string, unknown>;

export type BoardToolKind = "builtin" | "plugin" | "workflow";

export type PluginPermission =
  | "project:read"
  | "board:read"
  | "board:write"
  | "assets:read"
  | "assets:write"
  | "selection:read"
  | "viewport:read"
  | "jobs:write"
  | "storage:read"
  | "storage:write";

export type BoardPluginDependencies = {
  tools?: string[];
  plugins?: string[];
};

export type BoardToolContext = PluginContext;

export type PluginContext = {
  project: ProjectCapability;
  board: BoardCapability;
  assets: AssetCapability;
  selection: SelectionCapability;
  viewport: ViewportCapability;
  jobs: JobCapability;
  storage: PluginStorageCapability;
  tools: ToolCapability;
  signal?: AbortSignal;
  env: PluginEnvironmentCapability;
};

export type ProjectCapability = {
  resolve(projectRoot: string): Promise<string>;
  listKnown(): Promise<unknown[]>;
  readInfo(projectRoot: string): Promise<Record<string, unknown>>;
  readSnapshot(projectRoot: string): Promise<Record<string, unknown>>;
  listNodes(projectRoot: string, filter?: unknown): Promise<unknown[]>;
  getNode(projectRoot: string, nodeId: string): Promise<unknown>;
};

export type BoardCapability = {
  createNodes(projectRoot: string, nodes: unknown[]): Promise<{ nodes: unknown[]; assets?: unknown[] }>;
  updateNodes(projectRoot: string, updates: unknown[]): Promise<{ nodes: unknown[]; assets?: unknown[] }>;
  updateAssets(projectRoot: string, assets: unknown[]): Promise<{ nodes: unknown[]; assets?: unknown[] }>;
  refreshNodePreview(projectRoot: string, nodeId: string): Promise<{ nodes: unknown[]; assets?: unknown[] }>;
  installGeneratingNode(projectRoot: string, nodeId: string, path: string): Promise<{ nodes: unknown[]; assets?: unknown[] }>;
};

export type AssetCapability = {
  get(projectRoot: string, assetId: string): Promise<unknown>;
  getOriginByNode(projectRoot: string, nodeId: string): Promise<{ node: unknown; asset: unknown }>;
  importLocalFile(projectRoot: string, path: string): Promise<unknown>;
  materializeArtifact(projectRoot: string, artifact: unknown): Promise<string>;
};

export type SelectionCapability = {
  get(): Promise<unknown[]>;
};

export type ViewportCapability = {
  get(projectRoot?: string): Promise<unknown>;
};

export type JobCapability = {
  create(input: { title: string; pluginName?: string; metadata?: Record<string, unknown> }): Promise<{ id: string }>;
  updateProgress(id: string, progress: number, message?: string): Promise<void>;
  fail(id: string, error: string): Promise<void>;
  complete(id: string, result?: unknown): Promise<void>;
};

export type PluginStorageCapability = {
  get<T = unknown>(key: string): Promise<T | undefined>;
  set<T = unknown>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
};

export type ToolCapability = {
  call<I = unknown, O = unknown>(name: string, input: I): Promise<O>;
};

export type PluginEnvironmentCapability = {
  get(name: string): string | undefined;
  require(name: string): string;
};

export type BoardTool<I = unknown, O = unknown> = {
  name: string;
  description: string;
  inputSchema: JSONSchema;
  outputSchema: JSONSchema;
  kind?: BoardToolKind;
  run(input: I, ctx: BoardToolContext): Promise<O>;
};

export type BoardToolManifest = {
  name: string;
  description: string;
  inputSchema: JSONSchema;
  outputSchema: JSONSchema;
  kind: BoardToolKind;
  pluginName: string;
  pluginVersion: string;
};

export type BoardPluginApi = {
  registerTool<I = unknown, O = unknown>(tool: BoardTool<I, O>): void;
};

export type BoardPlugin = {
  name: string;
  version: string;
  permissions?: PluginPermission[];
  environmentVariables?: BoardPluginEnvironmentVariable[];
  dependencies?: BoardPluginDependencies;
  setup?(ctx: PluginContext): void | Promise<void>;
  teardown?(ctx: PluginContext): void | Promise<void>;
  register(api: BoardPluginApi): void | Promise<void>;
};

export type DefinePluginInput = Omit<BoardPlugin, "register"> & {
  tools?: BoardTool[];
  register?: BoardPlugin["register"];
};

export type DefineToolInput<I = unknown, O = unknown> = Omit<BoardTool<I, O>, "inputSchema" | "outputSchema"> & {
  input?: JSONSchema;
  output?: JSONSchema;
  inputSchema?: JSONSchema;
  outputSchema?: JSONSchema;
};

export type BoardPluginEnvironmentVariable = {
  name: string;
  description?: string;
  required?: boolean;
  secret?: boolean;
};
