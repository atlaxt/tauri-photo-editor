use crate::types::Operation;
use image::{DynamicImage, ImageFormat};
use std::io::Cursor;

/// Sıralı işlem listesini bir görüntüye uygular.
pub fn apply_ops(mut img: DynamicImage, ops: &[Operation]) -> Result<DynamicImage, String> {
    for op in ops {
        img = apply_single(img, op)?;
    }
    Ok(img)
}

fn apply_single(img: DynamicImage, op: &Operation) -> Result<DynamicImage, String> {
    match op.op.as_str() {
        "brightness" => {
            let value = get_f32(&op.params, "value").unwrap_or(0.0) as i32;
            Ok(img.brighten(value))
        }
        "contrast" => {
            let value = get_f32(&op.params, "value").unwrap_or(0.0);
            Ok(img.adjust_contrast(value))
        }
        "saturation" => {
            // image crate'te doğrudan saturation yok; huerotate ile yaklaşık simülasyon
            // Gerçek saturation için hsl dönüşümü yapıyoruz
            let value = get_f32(&op.params, "value").unwrap_or(0.0);
            Ok(adjust_saturation(img, value))
        }
        "sharpen" => {
            let value = get_f32(&op.params, "value").unwrap_or(0.0);
            Ok(img.unsharpen(value, (value * 5.0) as i32))
        }
        "rotate" => {
            let degrees = get_f32(&op.params, "value").unwrap_or(0.0);
            // image crate yalnızca 90/180/270 destekler; diğerleri için en yakın tama yuvarla
            let img = match ((degrees % 360.0 + 360.0) % 360.0) as u32 {
                d if d < 45 || d >= 315 => img,
                d if d < 135 => img.rotate90(),
                d if d < 225 => img.rotate180(),
                _ => img.rotate270(),
            };
            Ok(img)
        }
        "flip_horizontal" => Ok(img.fliph()),
        "flip_vertical" => Ok(img.flipv()),
        "grayscale" => Ok(img.grayscale()),
        "resize" => {
            let width = get_u32(&op.params, "width");
            let height = get_u32(&op.params, "height");
            let keep_aspect = op.params.get("keepAspect")
                .and_then(|v| v.as_bool())
                .unwrap_or(true);

            let (orig_w, orig_h) = (img.width(), img.height());

            let (nw, nh) = match (width, height) {
                (Some(w), Some(h)) if !keep_aspect => (w, h),
                (Some(w), Some(h)) if keep_aspect => {
                    let scale = (w as f64 / orig_w as f64).min(h as f64 / orig_h as f64);
                    ((orig_w as f64 * scale) as u32, (orig_h as f64 * scale) as u32)
                }
                (Some(w), None) => {
                    let scale = w as f64 / orig_w as f64;
                    (w, (orig_h as f64 * scale) as u32)
                }
                (None, Some(h)) => {
                    let scale = h as f64 / orig_h as f64;
                    ((orig_w as f64 * scale) as u32, h)
                }
                _ => return Ok(img),
            };

            Ok(img.resize_exact(nw, nh, image::imageops::FilterType::Lanczos3))
        }
        "crop" => {
            let x = get_u32(&op.params, "x").unwrap_or(0);
            let y = get_u32(&op.params, "y").unwrap_or(0);
            let w = get_u32(&op.params, "width");
            let h = get_u32(&op.params, "height");
            if let (Some(w), Some(h)) = (w, h) {
                let mut img = img;
                Ok(img.crop(x, y, w, h))
            } else {
                Ok(img)
            }
        }
        // "output" is handled at save time, not here
        _ => Ok(img),
    }
}

/// Ham piksel saturation ayarı (HSL alanında).
fn adjust_saturation(img: DynamicImage, amount: f32) -> DynamicImage {
    let factor = 1.0 + amount / 100.0;
    let rgba = img.to_rgba8();
    let (w, h) = rgba.dimensions();
    let mut out = image::RgbaImage::new(w, h);

    for (x, y, px) in rgba.enumerate_pixels() {
        let [r, g, b, a] = px.0;
        let rf = r as f32 / 255.0;
        let gf = g as f32 / 255.0;
        let bf = b as f32 / 255.0;

        // Luminance (grayscale weight)
        let lum = 0.2126 * rf + 0.7152 * gf + 0.0722 * bf;

        let nr = (lum + (rf - lum) * factor).clamp(0.0, 1.0);
        let ng = (lum + (gf - lum) * factor).clamp(0.0, 1.0);
        let nb = (lum + (bf - lum) * factor).clamp(0.0, 1.0);

        out.put_pixel(x, y, image::Rgba([(nr * 255.0) as u8, (ng * 255.0) as u8, (nb * 255.0) as u8, a]));
    }

    DynamicImage::ImageRgba8(out)
}

// --- Yardımcı fonksiyonlar ---

fn get_f32(params: &std::collections::HashMap<String, serde_json::Value>, key: &str) -> Option<f32> {
    params.get(key)?.as_f64().map(|v| v as f32)
}

fn get_u32(params: &std::collections::HashMap<String, serde_json::Value>, key: &str) -> Option<u32> {
    params.get(key)?.as_f64().map(|v| v as u32)
}

/// Görüntüyü verilen formatta bayt dizisine encode eder.
pub fn encode_image(img: &DynamicImage, format: ImageFormat, quality: u8) -> Result<Vec<u8>, String> {
    let mut buf = Cursor::new(Vec::new());
    match format {
        ImageFormat::Jpeg => {
            let mut encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut buf, quality);
            encoder.encode_image(img).map_err(|e| e.to_string())?;
        }
        _ => {
            img.write_to(&mut buf, format).map_err(|e| e.to_string())?;
        }
    }
    Ok(buf.into_inner())
}
