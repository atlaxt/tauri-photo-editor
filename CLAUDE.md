# useSpace Studio — Ajan Kılavuzu

Tauri v2 + Vue 3 + NuxtUI v4 ile geliştirilmekte olan masaüstü fotoğraf editörü.
Bu dosya projede çalışan tüm ajanlar için tek referans noktasıdır.

---

## Stack

| Katman | Teknoloji |
|--------|-----------|
| Desktop runtime | Tauri v2 |
| Frontend framework | Vue 3 (Composition API + `<script setup>`) |
| UI kütüphanesi | NuxtUI v4 (`@nuxt/ui`) |
| Stil | Tailwind CSS v4 (NuxtUI içinde) |
| Routing | vue-router v5 |
| İkon seti | Phosphor Icons (`i-ph-*`) — vite.config'te tanımlı |
| Dil | TypeScript (frontend) + Rust (backend) |
| Paket yöneticisi | pnpm (workspace) |
| Bundler | Vite 6 |

### Tauri eklentileri (mevcut)
- `tauri-plugin-opener`

### Rust crate'leri (mevcut)
- `tauri`, `tauri-plugin-opener`, `serde`, `serde_json`

---

## Proje Yapısı

```
useSpace-Studio-Desktop-App/
├── src/                    # Vue frontend
│   ├── App.vue             # Kök bileşen (UApp > UMain > UPage sarmalı)
│   ├── main.ts             # Uygulama giriş noktası
│   └── assets/css/main.css
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── lib.rs          # Tauri komutları burada tanımlanır
│   │   └── main.rs         # Giriş noktası (lib::run() çağırır)
│   ├── Cargo.toml
│   └── tauri.conf.json
```

---

## Temel Kurallar

- Tüm Vue bileşenleri `<script setup lang="ts">` kullanır.
- UI için yalnızca NuxtUI (`U*`) bileşenleri kullanılır, ham HTML elementlerinden kaçınılır.
- Rust tarafındaki her public fonksiyon `#[tauri::command]` ile işaretlenir ve `lib.rs`'teki `invoke_handler`'a eklenir.
- Frontend'den Rust'a iletişim yalnızca `@tauri-apps/api/core`'dan `invoke` ile yapılır.
- Dosya sistemi işlemleri (okuma, yazma, klasör tarama) Tauri plugin'leri üzerinden Rust tarafında gerçekleştirilir; asla doğrudan JS/Node ile yapılmaz.

---

## Faz 1 — Temel Fotoğraf Editörü

### Hedef
Kullanıcının tek tek fotoğraf düzenleyebildiği, kaydedebildiği, şablon işlem zincirleri oluşturabildiği ve bu şablonları bir klasördeki tüm fotoğraflara toplu uygulayabildiği çalışan bir masaüstü uygulaması.

---

### Ekranlar / Görünümler

#### 1. Başlangıç Ekranı (`/`)
Editörde açık dosya yokken gösterilir. Kenar çubuğu yoktur.
- Üst: minimal başlık + renk modu butonu
- Orta: üç eylem kartı — *Yeni Oluştur*, *Resmi Aç*, *Şablon Kullan*
- Alt: *Taslak Projeler* listesi (son açılan/kaydedilmemiş dosyalar)

#### 2. Editör Görünümü (`/editor`)
Tam ekran, kenar çubuğu yoktur. Şablon ve toplu işlem bu ekrana entegre edilir (araç paneli veya üst menü aracılığıyla).
- Sol panel: araç seçenekleri (kırpma, döndürme, filtreler, ayarlar)
- Merkez: Canvas — düzenlenen görüntü önizlemesi
- Sağ panel: şablon kaydeder / yükler; geçmiş (history) listesi
- Alt çubuk: Kaydet, Farklı Kaydet, Geri Al

---

### Temel Düzenleme İşlemleri (Faz 1 kapsamı)

| İşlem | Parametre |
|-------|-----------|
| Kırpma (Crop) | x, y, genişlik, yükseklik |
| Döndürme (Rotate) | derece: -180..180 |
| Yatay/Dikey Çevirme | flip_horizontal, flip_vertical |
| Parlaklık (Brightness) | -100..100 |
| Kontrast (Contrast) | -100..100 |
| Doygunluk (Saturation) | -100..100 |
| Keskinlik (Sharpen) | miktar: 0..10 |
| Siyah-Beyaz | — |
| Yeniden Boyutlandırma (Resize) | genişlik, yükseklik, orantı_koru |
| Çıktı formatı | JPEG (kalite 1-100), PNG, WebP |

---

### Şablon Sistemi (Preset / Template)

Bir şablon, sıralı işlem adımlarından oluşan JSON yapısıdır.

```jsonc
// Örnek şablon
{
  "id": "uuid",
  "name": "Instagram Kare",
  "description": "1:1 kırpma + hafif sıcaklık filtresi",
  "steps": [
    { "op": "crop", "params": { "aspect": "1:1" } },
    { "op": "brightness", "params": { "value": 10 } },
    { "op": "saturation", "params": { "value": 15 } },
    { "op": "resize", "params": { "width": 1080, "height": 1080, "keep_aspect": true } },
    { "op": "output", "params": { "format": "jpeg", "quality": 90 } }
  ],
  "created_at": "ISO8601",
  "updated_at": "ISO8601"
}
```

Şablonlar `AppData/useSpace/presets/` klasöründe `.json` olarak saklanır.

---

### Toplu İşlem Akışı

1. Kullanıcı kaynak klasör seçer → Tauri `fs` plugin ile klasördeki resimler listelenir
2. Hedef klasör ve şablon seçilir
3. "Başlat" tıklanır → Rust tarafında her dosya için şablon adımları sırayla uygulanır
4. İlerleme `emit` ile frontend'e anlık iletilir (`tauri::Emitter`)
5. Hatalı dosyalar atlanır, log'a yazılır

---

### Mimari Kararlar

#### Görüntü işleme: Rust backend
Tüm piksel düzeyindeki işlemler (kırpma, filtreler, resize vb.) Rust tarafında `image` crate'i ile yapılır. Frontend'e ham piksel verisi gönderilmez; yalnızca işlenmiş dosya kaydedilir veya önizleme için temp dosyaya yazılıp URI döndürülür.

#### State yönetimi: Pinia
Uygulama genelinde editör durumu (açık dosya, işlem geçmişi, şablonlar) Pinia store ile yönetilir.

#### Canvas önizleme: HTML5 Canvas
Düzenleme parametreleri değiştikçe frontend Canvas üzerinde anlık önizleme yapılır (CSS filter + transform ile). Gerçek işleme her zaman Rust'ta gerçekleşir.

---

### Rust Tauri Komutları (Faz 1)

```rust
// Görüntü işleme
apply_operations(file_path: String, ops: Vec<Operation>) -> Result<String, String>
// → temp preview dosyası URI'si döner

save_image(source_path: String, dest_path: String, ops: Vec<Operation>) -> Result<(), String>

// Şablon yönetimi
list_presets() -> Result<Vec<Preset>, String>
save_preset(preset: Preset) -> Result<(), String>
delete_preset(id: String) -> Result<(), String>

// Toplu işlem
start_batch(source_dir: String, dest_dir: String, preset_id: String) -> Result<(), String>
// ilerleme: event "batch://progress" { current, total, file_name, error? }

// Yardımcı
list_images_in_dir(dir: String) -> Result<Vec<String>, String>
get_image_metadata(file_path: String) -> Result<ImageMeta, String>
```

---

### Rust Bağımlılıkları (eklenecek)

```toml
image = "0.25"
serde = { version = "1", features = [ "derive" ] }
serde_json = "1"
uuid = { version = "1", features = [ "v4" ] }
tauri-plugin-fs = "2"
tauri-plugin-dialog = "2"
```

---

### Frontend Bağımlılıkları (eklenecek)

```
pinia
@tauri-apps/plugin-fs
@tauri-apps/plugin-dialog
```

---

### Faz 1 Görev Listesi

- [ ] **Proje altyapısı**
  - [ ] vue-router route'ları kur (`/`, `/editor`, `/presets`, `/batch`)
  - [ ] Pinia store'ları oluştur (`useEditorStore`, `usePresetStore`, `useBatchStore`)
  - [ ] Tauri `fs` ve `dialog` plugin'lerini ekle

- [ ] **Rust backend**
  - [ ] `image` crate entegrasyonu
  - [ ] `Operation` ve `Preset` Rust struct'ları
  - [ ] Tüm Tauri komutlarını implement et
  - [ ] Toplu işlem için progress event'i

- [ ] **Ana Ekran**
  - [ ] Sürükle-bırak veya "Aç" ile fotoğraf yükleme
  - [ ] Son dosyalar listesi

- [ ] **Editör Görünümü**
  - [ ] Canvas önizleme bileşeni
  - [ ] Her düzenleme aracı için panel bileşeni
  - [ ] İşlem geçmişi (geri al / ileri al)
  - [ ] Kaydet / Farklı Kaydet

- [ ] **Şablon Yöneticisi**
  - [ ] Şablon listesi
  - [ ] Şablon oluştur / düzenle / sil
  - [ ] Mevcut editör durumundan şablon oluştur

- [ ] **Toplu İşlem**
  - [ ] Klasör seçimi
  - [ ] Şablon seçimi
  - [ ] İlerleme göstergesi
  - [ ] Hata log'u

---

## Tasarım İlkeleri

Uygulamanın her ekranı **modern ve native** hissettirmelidir. Referans: macOS/Apple HIG standartları.

### Genel kurallar
- **Minimal chrome**: gereksiz border, shadow, dekorasyon yok. Boşluk ve tipografi ile hiyerarşi kurulur.
- **Purposeful spacing**: elemanlar nefes alır; tight grid'den kaçınılır.
- **Subtle motion**: geçişler `transition-all duration-200` gibi kısa ve yumuşak. Abartılı animasyon yok.
- **Native renk**: sistem rengi (`neutral`) baz, vurgu için `primary` (blue) kısıtlı kullanılır.
- **Tipografi**: boyut hiyerarşisi nettir; etiket/açıklama çiftleri tutarlıdır.
- **Yoğunluk**: bir ekranda tek bir ana eylem öne çıkar, geri kalanlar ikincil kalır.
- **Durum geri bildirimi**: her tıklanabilir eleman hover/active durumu gösterir; işlemler loading state içerir.

### Navigasyon mimarisi
Kenar çubuğu navigasyonu **yoktur**. Uygulama iki modda çalışır:

1. **Başlangıç ekranı** (`/`): Editörde açık dosya yoksa gösterilir.
   - Üç büyük eylem kartı: *Yeni Oluştur*, *Resmi Aç*, *Şablon Kullan*
   - Altında: *Taslak Projeler* listesi (son açılan/kaydedilmemiş dosyalar)
2. **Editör modu** (`/editor`): Dosya açıldığında tam ekran editör. Şablon yöneticisi ve toplu işlem araçlara veya menüye gömülüdür.

---

## Henüz Planlanmayan (Faz 2+)

- Katmanlar (layers)
- RAW format desteği
- Bulut senkronizasyonu
- Eklenti sistemi
- AI destekli otomatik düzeltme
