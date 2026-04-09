use std::path::PathBuf;
use std::fs;

use image::ImageFormat;
use tauri::{AppHandle, Emitter};
use uuid::Uuid;
use chrono::Utc;

use crate::imaging::{apply_ops, encode_image};
use crate::types::{BatchProgress, ImageMeta, Operation, Preset};

// ─── Görüntü işleme ────────────────────────────────────────────────────────

/// Operasyonları uygular, geçici bir dosyaya kaydeder ve asset:// URI döner.
#[tauri::command]
pub async fn apply_operations(
    file_path: String,
    ops: Vec<Operation>,
) -> Result<String, String> {
    let img = image::open(&file_path).map_err(|e| e.to_string())?;
    let processed = apply_ops(img, &ops)?;

    // Temp dizinine yaz
    let tmp_dir = std::env::temp_dir();
    let tmp_path = tmp_dir.join(format!("usespace_preview_{}.jpg", Uuid::new_v4()));

    let bytes = encode_image(&processed, ImageFormat::Jpeg, 85)?;
    fs::write(&tmp_path, bytes).map_err(|e| e.to_string())?;

    // Tauri asset protokolü için path döndür
    let path_str = tmp_path.to_string_lossy().to_string();
    Ok(path_str)
}

/// Görüntüyü kalıcı olarak kaydeder. `ops` içinde `output` adımı varsa format/kalite oradan alınır.
#[tauri::command]
pub async fn save_image(
    source_path: String,
    dest_path: String,
    ops: Vec<Operation>,
) -> Result<(), String> {
    let img = image::open(&source_path).map_err(|e| e.to_string())?;

    // output adımını ayır
    let (image_ops, format, quality) = extract_output_params(&ops);
    let processed = apply_ops(img, &image_ops)?;

    let bytes = encode_image(&processed, format, quality)?;
    fs::write(&dest_path, bytes).map_err(|e| e.to_string())?;
    Ok(())
}

fn extract_output_params(ops: &[Operation]) -> (Vec<Operation>, ImageFormat, u8) {
    let mut image_ops: Vec<Operation> = Vec::new();
    let mut format = ImageFormat::Jpeg;
    let mut quality: u8 = 90;

    for op in ops {
        if op.op == "output" {
            if let Some(fmt) = op.params.get("format").and_then(|v| v.as_str()) {
                format = match fmt {
                    "png" => ImageFormat::Png,
                    "webp" => ImageFormat::WebP,
                    _ => ImageFormat::Jpeg,
                };
            }
            if let Some(q) = op.params.get("quality").and_then(|v| v.as_f64()) {
                quality = q as u8;
            }
        } else {
            image_ops.push(op.clone());
        }
    }

    (image_ops, format, quality)
}

// ─── Şablon yönetimi ───────────────────────────────────────────────────────

fn presets_dir() -> Result<PathBuf, String> {
    let base = dirs::data_dir().ok_or("AppData dizini bulunamadı")?;
    let dir = base.join("useSpace").join("presets");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

#[tauri::command]
pub async fn list_presets() -> Result<Vec<Preset>, String> {
    let dir = presets_dir()?;
    let mut presets = Vec::new();

    let entries = fs::read_dir(&dir).map_err(|e| e.to_string())?;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) == Some("json") {
            if let Ok(content) = fs::read_to_string(&path) {
                if let Ok(preset) = serde_json::from_str::<Preset>(&content) {
                    presets.push(preset);
                }
            }
        }
    }

    // Oluşturulma tarihine göre sırala (en yeni önce)
    presets.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Ok(presets)
}

#[tauri::command]
pub async fn save_preset(mut preset: Preset) -> Result<Preset, String> {
    let dir = presets_dir()?;
    let now = Utc::now().to_rfc3339();

    if preset.id.is_empty() {
        preset.id = Uuid::new_v4().to_string();
        preset.created_at = now.clone();
    }
    preset.updated_at = now;

    let path = dir.join(format!("{}.json", preset.id));
    let content = serde_json::to_string_pretty(&preset).map_err(|e| e.to_string())?;
    fs::write(&path, content).map_err(|e| e.to_string())?;

    Ok(preset)
}

#[tauri::command]
pub async fn delete_preset(id: String) -> Result<(), String> {
    let dir = presets_dir()?;
    let path = dir.join(format!("{}.json", id));
    if path.exists() {
        fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

// ─── Yardımcı komutlar ─────────────────────────────────────────────────────

static IMAGE_EXTENSIONS: &[&str] = &["jpg", "jpeg", "png", "webp", "gif", "bmp", "tiff", "tif"];

#[tauri::command]
pub async fn list_images_in_dir(dir: String) -> Result<Vec<String>, String> {
    let entries = fs::read_dir(&dir).map_err(|e| e.to_string())?;
    let mut paths = Vec::new();

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_file() {
            if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                if IMAGE_EXTENSIONS.contains(&ext.to_lowercase().as_str()) {
                    paths.push(path.to_string_lossy().to_string());
                }
            }
        }
    }

    paths.sort();
    Ok(paths)
}

#[tauri::command]
pub async fn get_image_metadata(file_path: String) -> Result<ImageMeta, String> {
    let meta = fs::metadata(&file_path).map_err(|e| e.to_string())?;
    let img = image::open(&file_path).map_err(|e| e.to_string())?;

    let format = image::ImageFormat::from_path(&file_path)
        .map(|f| format!("{:?}", f).to_lowercase())
        .unwrap_or_else(|_| "unknown".to_string());

    Ok(ImageMeta {
        width: img.width(),
        height: img.height(),
        format,
        file_size: meta.len(),
    })
}

// ─── Toplu işlem ───────────────────────────────────────────────────────────

#[tauri::command]
pub async fn start_batch(
    app: AppHandle,
    source_dir: String,
    dest_dir: String,
    ops: Vec<Operation>,
) -> Result<(), String> {
    let images = list_images_in_dir(source_dir).await?;
    let total = images.len() as u32;

    fs::create_dir_all(&dest_dir).map_err(|e| e.to_string())?;

    let (image_ops, format, quality) = extract_output_params(&ops);
    let ext = match format {
        ImageFormat::Png => "png",
        ImageFormat::WebP => "webp",
        _ => "jpg",
    };

    for (i, src_path) in images.iter().enumerate() {
        let file_name = PathBuf::from(src_path)
            .file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_else(|| format!("image_{}", i));

        let dest_path = PathBuf::from(&dest_dir)
            .join(format!("{}.{}", file_name, ext))
            .to_string_lossy()
            .to_string();

        let progress = BatchProgress {
            current: i as u32 + 1,
            total,
            file_name: file_name.clone(),
            error: None,
        };

        // Her dosyayı işle; hata olursa atla ve bildir
        match process_single_image(src_path, &dest_path, &image_ops, format, quality) {
            Ok(()) => {
                let _ = app.emit("batch://progress", &progress);
            }
            Err(e) => {
                let _ = app.emit("batch://progress", &BatchProgress {
                    error: Some(e),
                    ..progress
                });
            }
        }
    }

    Ok(())
}

fn process_single_image(
    src: &str,
    dest: &str,
    ops: &[Operation],
    format: ImageFormat,
    quality: u8,
) -> Result<(), String> {
    let img = image::open(src).map_err(|e| e.to_string())?;
    let processed = apply_ops(img, ops)?;
    let bytes = encode_image(&processed, format, quality)?;
    fs::write(dest, bytes).map_err(|e| e.to_string())?;
    Ok(())
}
