#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use tauri_plugin_dialog::DialogExt;

// A caller cannot supply a destination path. Every write requires an OS Save dialog.
#[tauri::command]
async fn save_attachment(app: tauri::AppHandle, filename: String, data: Vec<u8>) -> Result<Option<String>, String> {
    if data.len() > 128 * 1024 * 1024 { return Err("Attachment exceeds desktop save limit (128 MiB)".into()); }
    let name = filename.replace(['/', '\\'], "_");
    if name.is_empty() || name.len() > 255 || name.chars().any(char::is_control) {
        return Err("Invalid attachment filename".into());
    }
    tauri::async_runtime::spawn_blocking(move || {
        let selected = app.dialog().file().set_file_name(&name).blocking_save_file();
        match selected {
            None => Ok(None),
            Some(file) => {
                let path = file.into_path().map_err(|e| e.to_string())?;
                std::fs::write(&path, data).map_err(|e| e.to_string())?;
                Ok(Some(path.to_string_lossy().into_owned()))
            }
        }
    }).await.map_err(|e| e.to_string())?
}
fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![save_attachment])
        .run(tauri::generate_context!())
        .expect("Locat desktop runtime failed");
}
