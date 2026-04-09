mod commands;
mod imaging;
mod types;

use commands::*;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            apply_operations,
            save_image,
            list_presets,
            save_preset,
            delete_preset,
            list_images_in_dir,
            get_image_metadata,
            start_batch,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
