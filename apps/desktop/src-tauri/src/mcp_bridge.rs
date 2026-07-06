use crate::error::{AppError, AppResult};
use crate::project_files::write_bytes;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::net::{TcpListener, TcpStream};
use std::path::Path;
use std::sync::mpsc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter};

const BRIDGE_FILE: &str = ".canvas-mcp-bridge.json";
const RESPONSE_TIMEOUT: Duration = Duration::from_secs(30);

#[derive(Clone)]
pub struct McpBridge {
    endpoint: BridgeEndpoint,
    pending: PendingMap,
    running: Arc<AtomicBool>,
}

type PendingMap = Arc<Mutex<HashMap<String, mpsc::Sender<BridgeResponse>>>>;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct BridgeEndpoint {
    version: u8,
    host: String,
    port: u16,
    token: String,
    updated_at: i64,
}

#[derive(Deserialize)]
struct BridgeEnvelope {
    token: String,
    request: Value,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct FrontendBridgeEvent {
    request_id: String,
    request: Value,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BridgeResponse {
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

impl McpBridge {
    pub fn start(app: AppHandle) -> AppResult<Self> {
        let listener = TcpListener::bind("127.0.0.1:0")?;
        let port = listener.local_addr()?.port();
        let endpoint = BridgeEndpoint {
            version: 1,
            host: "127.0.0.1".into(),
            port,
            token: uuid::Uuid::new_v4().to_string(),
            updated_at: now_millis(),
        };
        let bridge = Self {
            endpoint: endpoint.clone(),
            pending: Arc::new(Mutex::new(HashMap::new())),
            running: Arc::new(AtomicBool::new(true)),
        };
        let pending = bridge.pending.clone();
        let running = bridge.running.clone();
        listener.set_nonblocking(true)?;

        std::thread::spawn(move || {
            while running.load(Ordering::SeqCst) {
                match listener.accept() {
                    Ok((stream, _addr)) => {
                        let app = app.clone();
                        let pending = pending.clone();
                        let endpoint = endpoint.clone();
                        std::thread::spawn(move || {
                            if let Err(error) = handle_stream(stream, app, pending, endpoint) {
                                eprintln!("MCP bridge request failed: {error}");
                            }
                        });
                    }
                    Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                        std::thread::sleep(Duration::from_millis(100));
                    }
                    Err(error) => {
                        eprintln!("MCP bridge listener failed: {error}");
                        std::thread::sleep(Duration::from_millis(250));
                    }
                }
            }
        });

        Ok(bridge)
    }

    pub fn publish_for_project(&self, project_root: &Path) -> AppResult<()> {
        let mut endpoint = self.endpoint.clone();
        endpoint.updated_at = now_millis();
        let path = project_root.join(BRIDGE_FILE);
        let text = format!("{}\n", serde_json::to_string_pretty(&endpoint)?);
        write_bytes(&path, text.as_bytes())
    }

    pub fn complete(&self, request_id: String, response: BridgeResponse) -> AppResult<()> {
        let sender = self
            .pending
            .lock()
            .map_err(|_| AppError::Path("MCP bridge lock poisoned".into()))?
            .remove(&request_id)
            .ok_or_else(|| AppError::Path(format!("unknown MCP bridge request: {request_id}")))?;
        sender
            .send(response)
            .map_err(|_| AppError::Path("MCP bridge response receiver closed".into()))
    }

    pub fn stop(&self) {
        self.running.store(false, Ordering::SeqCst);
    }
}

fn handle_stream(
    mut stream: TcpStream,
    app: AppHandle,
    pending: PendingMap,
    endpoint: BridgeEndpoint,
) -> AppResult<()> {
    stream.set_read_timeout(Some(Duration::from_secs(5)))?;
    stream.set_write_timeout(Some(Duration::from_secs(5)))?;

    let mut line = String::new();
    BufReader::new(stream.try_clone()?).read_line(&mut line)?;
    let envelope: BridgeEnvelope = serde_json::from_str(&line)?;
    if envelope.token != endpoint.token {
        write_response(
            &mut stream,
            BridgeResponse {
                ok: false,
                data: None,
                error: Some("invalid MCP bridge token".into()),
            },
        )?;
        return Ok(());
    }

    let request_id = uuid::Uuid::new_v4().to_string();
    let (sender, receiver) = mpsc::channel();
    pending
        .lock()
        .map_err(|_| AppError::Path("MCP bridge lock poisoned".into()))?
        .insert(request_id.clone(), sender);

    let emit_result = app.emit(
        "mcp-write-command",
        FrontendBridgeEvent {
            request_id: request_id.clone(),
            request: envelope.request,
        },
    );
    if let Err(error) = emit_result {
        let _ = pending
            .lock()
            .map_err(|_| AppError::Path("MCP bridge lock poisoned".into()))?
            .remove(&request_id);
        return Err(AppError::Path(error.to_string()));
    }

    let response = match receiver.recv_timeout(RESPONSE_TIMEOUT) {
        Ok(response) => response,
        Err(_) => {
            let _ = pending
                .lock()
                .map_err(|_| AppError::Path("MCP bridge lock poisoned".into()))?
                .remove(&request_id);
            BridgeResponse {
                ok: false,
                data: None,
                error: Some("desktop app did not handle MCP write command before timeout".into()),
            }
        }
    };
    write_response(&mut stream, response)
}

fn write_response(stream: &mut TcpStream, response: BridgeResponse) -> AppResult<()> {
    let text = format!("{}\n", serde_json::to_string(&response)?);
    stream.write_all(text.as_bytes())?;
    stream.flush()?;
    Ok(())
}

fn now_millis() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_millis() as i64)
        .unwrap_or_default()
}
