use std::{fs, path::PathBuf, sync::Mutex};

use serde_json::Value;
use tauri::{AppHandle, Manager, State};

struct SaveLock(Mutex<()>);

fn slot_path(app: &AppHandle, slot_id: &str) -> Result<PathBuf, String> {
    if !matches!(slot_id, "slot-1" | "slot-2" | "slot-3") {
        return Err("Invalid save slot.".into());
    }
    let directory = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Application data directory is unavailable: {error}"))?
        .join("saves");
    fs::create_dir_all(&directory)
        .map_err(|error| format!("Could not create the save directory: {error}"))?;
    Ok(directory.join(format!("{slot_id}.json")))
}

fn read_value(path: &PathBuf) -> Result<Option<Value>, String> {
    if !path.exists() {
        return Ok(None);
    }
    let raw = fs::read_to_string(path).map_err(|error| format!("Could not read save: {error}"))?;
    serde_json::from_str(&raw)
        .map(Some)
        .map_err(|error| format!("Stored save record is invalid JSON: {error}"))
}

#[tauri::command]
fn read_save_record(
    app: AppHandle,
    lock: State<'_, SaveLock>,
    slot_id: String,
) -> Result<Option<Value>, String> {
    let _guard = lock.0.lock().map_err(|_| "Save lock is poisoned.")?;
    read_value(&slot_path(&app, &slot_id)?)
}

#[tauri::command]
fn compare_and_swap_save_record(
    app: AppHandle,
    lock: State<'_, SaveLock>,
    slot_id: String,
    expected: Option<Value>,
    replacement: Value,
) -> Result<bool, String> {
    let _guard = lock.0.lock().map_err(|_| "Save lock is poisoned.")?;
    let path = slot_path(&app, &slot_id)?;
    if read_value(&path)? != expected {
        return Ok(false);
    }
    let temporary = path.with_extension("json.tmp");
    let raw = serde_json::to_vec(&replacement)
        .map_err(|error| format!("Could not encode save record: {error}"))?;
    fs::write(&temporary, raw).map_err(|error| format!("Could not stage save: {error}"))?;
    fs::rename(&temporary, &path).map_err(|error| format!("Could not commit save: {error}"))?;
    Ok(true)
}

#[tauri::command]
fn delete_save_record(
    app: AppHandle,
    lock: State<'_, SaveLock>,
    slot_id: String,
) -> Result<(), String> {
    let _guard = lock.0.lock().map_err(|_| "Save lock is poisoned.")?;
    let path = slot_path(&app, &slot_id)?;
    if path.exists() {
        fs::remove_file(path).map_err(|error| format!("Could not delete save: {error}"))?;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(SaveLock(Mutex::new(())))
        .invoke_handler(tauri::generate_handler![
            read_save_record,
            compare_and_swap_save_record,
            delete_save_record
        ])
        .run(tauri::generate_context!())
        .expect("error while running Rivenbloom");
}

