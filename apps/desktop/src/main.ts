import "./styles.css";
import { mountWhiteboardShell } from "./mainShell";
import { isTauriRuntime } from "./runtime/runtimeEnvironment";
import { WhiteboardAppController } from "./whiteboardAppController";

const appElement = document.querySelector<HTMLDivElement>("#app");

if (!appElement) {
  throw new Error("Missing #app root");
}

const app = new WhiteboardAppController({
  tauriRuntime: isTauriRuntime(),
  shell: mountWhiteboardShell(appElement),
});

app.bootstrap().catch((error) => {
  app.failBootstrap(error);
});
