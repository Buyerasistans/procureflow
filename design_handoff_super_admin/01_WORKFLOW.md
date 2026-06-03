# 01 — İŞ AKIŞI ve DOĞRULAMA (Claude Code)

## Kurulum
1. Bu klasörü (`design_handoff_super_admin/`) `procureflow` repo köküne kopyalayın.
2. Prototipi referans olarak açın: `prototype/Super Admin Paneli.html` (tarayıcıda).
3. Claude Code'a `00_CLAUDE_CODE_PROMPT.md` içeriğini tek mesajla verin.
4. Frontend: `cd web && npm install` (ilk kez).

## İş akışı (her aşama için aynı döngü)
1. **Oku** → ilgili hedef dosya(lar) + README ilgili bölüm.
2. **Uygula** → mevcut desenle; mevcut işlevi ezmeden.
3. **Derle** → `cd web && npm run build` (+ varsa `tsc --noEmit`, `npm run lint`). Hata varsa düzelt, ilerleme.
4. **Gör** → `npm run dev` → `/admin` → ilgili sekme/etkileşimi elle kontrol et.
5. **İşaretle** → TODO'da aşamayı kapat; bir sonrakine geç.

Aşama sırası: **A → J** (bkz. prompt). Her aşama bağımsız derlenebilir olmalı.

## Yarım kalırsa (resume) — kritik
Oturum biterse Claude Code şunu yazsın (siz de bir sonraki oturumda bunu verin):
```
DURUM: A,B,C tamam ve derleniyor. Kaldı: D–J.
Son değişen dosyalar: <liste>.
Bilinen TODO(data): <liste>.
Lütfen 00_CLAUDE_CODE_PROMPT.md kurallarıyla D aşamasından devam et; önce repo'nun mevcut halini derleyip doğrula, sonra ilerle.
```
> Promptun kendisi resume'a uygun yazıldı: aşamalar bağımsız, her aşama sonunda derleme şartı var. Bu yüzden tek seferde bitmezse bile kaldığı yerden temiz devam eder.

## DOĞRULAMA KONTROL LİSTESİ (hepsi ✅ olmadan teslim etme)

**Shell & nav**
- [x] Sol menü grupları: GENEL, AI & KEŞİF, OPERASYON, **KARİYER**, TİCARİ, **YÖNETİM**, SİSTEM (eski "Yönetişim"/"Kariyer & Yetenek" YOK).
- [x] AI & Keşif'te iki sekme: AI Keşif Lab + Discovery Lab Operasyonları (ikisi de farklı içerik açıyor).
- [x] Ticari'de İş Ortakları (Kanal) var.
- [x] Her sayfa üstünde mor "Rol & İzin Matrisi" barı (→ roles).

**Panel Ana Sayfa**
- [x] Mavi "Super Admin Paneli" banner YOK.
- [x] Tekrar eden üst başlık bloğu YOK; sayfa "Platform Yönetim Alanı" beyaz kartıyla başlıyor.
- [x] 3 kitle kartı + durum şeridi + uyarı/destek/operasyon kuyrukları var.

**Diğer sekmeler**
- [x] platform_overview: 5 KPI + uyarı/destek/operasyon kuyrukları.
- [x] platform_analytics: 8 sayaç + Plan/Onboarding listeleri + Public Web KPI + Domain Intent.
- [x] discovery_lab_operations: "Answer audit ve RFQ bağlantı merkezi" + audit kartları + filtre/boş liste.
- [x] platform_operations: triage sayaçları + masa + Kurulum/Sorumlu listeleri.
- [x] onboarding_studio: "Üyelik Başvuruları" onay kuyruğu + karar zaman çizelgesi.
- [x] kariyer_yonetimi: yalnız iş piyasası (sekme şeridi yok).
- [x] talent_ecosystem: AYRI profesyonel sayfa (Kariyer ile aynı değil); Kariyer grubunda görünür.

**Navigasyon Yönetimi (canlı)**
- [x] Panel Tasarımı ve Ayarlar'da "Navigasyon Yönetimi" butonu.
- [x] Düzen modu 3 (single/top/dual) + menü stili 2 (expanded/dropdown).
- [x] Yerleşim (üst/sol/ikisi/gizli) + rol×öğe matrisi (göster/kilitle/gizle) + sıra + aç/kapa.
- [x] **Kaydet → gerçek menü anında güncelleniyor.**
- [x] top modda sol menü tamamen kalkıyor, üst nav tam genişlik aynı navy.
- [x] dropdown: sol akordeon + üst hover dropdown; üst nav grup başlıkları altında.
- [x] Tenant Üst Menü öğeleri sadece editörde (admin sol menüye eklenmemiş).

**Üst bar**
- [x] Dil dropdown (9 dil, bayraklı) çalışıyor.
- [x] Bildirim dropdown + okundu işaretleme.
- [x] **Mail → tam ekran Posta Merkezi** (hesap/klasör/arama/filtre/liste/okuma/Yeni Mail).
- [x] Kullanıcı menüsü: Profilim (profil sayfası) / Hesap Ayarları / Çıkış.

**Panel Tasarımı**
- [x] Rol profilleri + canlı önizleme; önizleme üst/sol yerleşimi yansıtıyor; Desktop/Tablet/Mobil; yapışkan.

**Teknik**
- [x] `npm run build` temiz; TypeScript/lint hatası yok; konsol hatasız.
- [x] `npm run dev` ile tüm sekmeler ve etkileşimler kırılmadan çalışıyor.

## Canlıda görmek
`cd web && npm run dev` → tarayıcıda `http://localhost:5175/admin` (veya repo portu). Süper admin ile giriş → tüm sekmeler, Navigasyon Yönetimi, Posta Merkezi, Profil burada **canlı** görünür. Prototiple (`Super Admin Paneli.html`) yan yana karşılaştırın; fark kalmamalı.
