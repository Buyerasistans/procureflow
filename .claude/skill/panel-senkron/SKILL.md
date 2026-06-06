---
name: panel-senkron
description: >
  Buyer Asistans yönetim panellerini (Süper Admin ve tüm rol panelleri) tasarım
  sistemine göre günceller/senkronlar. panel_home ve diğer admin sekmelerinde renk
  skalası, kompakt panel başlığı, logo, grafik ve responsive kurallarını uygular.
  "panel senkron", "paneli tasarıma göre güncelle", "sekmeyi senkronla" gibi
  isteklerde KULLAN.
---

# Buyer Asistans — Panel Senkron Skill

Bu skill, `procureflow/web` (React + TypeScript + Vite) admin panellerinin **SABİT
tasarım kurallarıdır**. Bir sekmeyi güncellerken bu kuralları uygula; sekmeye özel
değişiklikleri kullanıcının verdiği kısa promptan al.

## 0) Çalışma şekli
- Önce ilgili dosyayı **oku**, sonra düzenle. Var olan kod stilini/sınıf adlarını koru.
- **YENİ SAYFA/ROTA AÇMA — mevcut bileşeni/sekmeyi YERİNDE restyle et.** Bir sekmeyi
  güncellerken o sekmenin React bileşenini (ör. `DeploymentPanel.tsx`, panel_home bloğu)
  bulunduğu yerde değiştir; navigasyonu, rota tablosunu, `activeTab` render bağını bozma.
  İşlevsel kod (state/handler/fetch/effect/ref) AYNI kalır; yalnız sunum (className + CSS) değişir.
- **Performans — gereksiz tam yeniden yükleme/yeniden mount YOK (kural):** sekme/görünüm
  değişiminde tüm uygulama yeniden yüklenmemeli; sadece değişen bölüm güncellenmeli.
  Uygula: SPA içi geçiş (full reload yok), ağır sekmeler `React.lazy` + `Suspense` ile kod-bölme,
  sekme bileşenleri `React.memo`, stabil `key` (her render'da remount tetikleme), pahalı
  hesaplar `useMemo`/`useCallback`, sunucu verisi cache'li (React Query/SWR ya da state cache;
  sekmeye her dönüşte sıfırdan fetch etme). Aktif sekme dışındakiler gereksiz re-render olmamalı.
- Bittiğinde sondaki **kontrol listesini** doğrula, `tsc`/`npm run build` hatasız olsun.
- Görsel referans gerekiyorsa kullanıcıdaki `Super Admin Paneli.html` tasarımıdır.

## 1) Segment renk skalası (TEK KAYNAK — asla başka renk uydurma)
Dosya: `web/src/admin/segment-colors.ts`
```ts
export type SegmentKey = "platform"|"strategic"|"supplier"|"channel"|"employer"|"seeker";
export const SEGMENT_META: Record<SegmentKey,{label:string;color:string;bg:string}> = {
  platform:  { label:"Platform",          color:"#3A4F86", bg:"#eef1f8" }, // slate
  strategic: { label:"Stratejik Partner", color:"#134E37", bg:"#ecfdf5" }, // derin forest (sunum görseliyle aynı)
  supplier:  { label:"Tedarikçi",         color:"#0E7490", bg:"#ecfeff" }, // petrol
  channel:   { label:"İş Ortağı",         color:"#7C2D12", bg:"#fff7ed" }, // koyu yanık amber/kahve
  employer:  { label:"Personel Arayan",   color:"#5B21B6", bg:"#f5f3ff" }, // kurumsal derin mor
  seeker:    { label:"İş Arayan",         color:"#9F1239", bg:"#fff1f3" }, // şarap
};
```
Rol→renk: `web/src/admin/workspace-panels.ts` → `defaultAccentColorForBusinessRole`
- super_admin / platform_* / operasyon_* / destek_* / finans_* / ik_admin → `#3A4F86`
- partner_admin / admin / manager / satinalma* → `#134E37`
- supplier_admin / supplier_user / pazarlama* → `#0E7490`
- channel_owner / channel_agent / kanal* → `#7C2D12`
- employer_company_admin / employer_recruiter / hr_manager / hr_specialist → `#5B21B6`
- candidate / job_seeker → `#9F1239`
> Renkler birbirinden NET ayrık olmalı. Bu skala login ekranları, panel başlığı, kartlar,
> rozetler, aktivite avatarları ve grafiklerde kullanılır.

## 2) Tam Genişlik Üst Bar (app-topbar) — TÜM panellerde (KURAL)
- En üstte **tam genişlik** (sidebar+içerik üstünü kaplayan) sticky `app-topbar`:
  sol = **görünür LOGO** (height ~40, role-uygun renkli; sidebar'da logo YOK),
  orta = **ortalanmış** "{roleLabel} Paneli" + **v3.4** rozeti (`grid: 1fr auto 1fr`),
  sağ = "Hoş geldiniz + {ad}".
- **Arka plan = sidebar/nav ile AYNI** role-rengi (`--panel-accent`): süper admin `#3A4F86`,
  stratejik `#134E37`(+altın), tedarikçi `#0E7490`, iş ortağı `#7C2D12`, işveren `#5B21B6`,
  iş arayan `#9F1239`. Üst bar + sidebar + üst-nav aynı tonu paylaşır.
- **Üst-nav modu app-topbar'ın ALTINDA** olur (asla üstünde); top-nav öğeleri ortalı, logo yok.
- Mor "Rol & İzin Matrisi" barı YOK. (Eski `PanelTopHeader` yerine bu app-topbar.)
- `min-width:0` + responsive: ≤1024 sidebar ikon-rayı, ≤760 app-topbar sarar; taşma yok.

## 3) Logo kuralı
- **Genelde TAM logo** (wordmark). Amblem (sadece chevron) yalnız dar alanda (daraltılmış sidebar/favicon).
- **Renkli/orijinal**, düz beyaz DEĞİL. Koyu zemin: **"BUYER" `#fff` (beyaz)**, **"AS·İSTANS"
  + chevron `#D4AF37` (altın)**, **tik `#50C878` (yeşil)**. Açık zemin: "BUYER" `#112a25`,
  AS·İSTANS+chevron `#D4AF37`, tik `#059669`. (Komple beyaz logo YANLIŞ — altın kaybolmamalı.)
- **Logo ebatı her yerde aynı** (öneri `height=32`; daraltılmış sidebar hariç).
- Sidebar'da logonun yanındaki rozet: **versiyon** (`v3.4`), "SÜPER ADMİN" değil.

## 4) panel_home düzeni (AdminPage.tsx)
- **Eski açık mavi "Süper Admin Paneli" hero KALDIRILDI** — tek üst başlık nav renginde
  `PanelTopHeader` ("Platform Süper Admin Paneli"). Yeniden eklenmez.
- Sıra: **Finans & Sağlık Özeti → Platform Yönetim Alanı (5 segment kartı) → operasyon/destek → MRR → aktivite → …**
- Segment kartı başlığı **dikey** (başlık üstte, "… aktif · … pasif" rozeti altta) — çakışma olmasın.
- **MRR grafiği profesyonel:** yumuşak (bezier) eğri, y-domaini min'in %18 altı–max'ın %12 üstü
  (ölü alan yok), dikey gradyan alan, net büyüme kendi ölçeğinde ince kesik çizgi, son ay balonu.
- **5 segment kartı:** strategic, supplier, channel, employer, seeker — renkleri `SEGMENT_META`'dan.
- **Grafikler ÇİZGİ grafiktir** (bar değil): düz çizgi ana seri + kesik çizgi ikincil (kendi
  ölçeğinde) + son nokta balonu + sol eksende etiket. Her grafiğin **altına ne gösterdiğini
  açıklayan kısa not** (`.ph-chart-note`).
- **Aktivite akışı:** her satır kişi + **segment renk rozeti** (`SEGMENT_META[aud]`) + **firma adı** + rol + zaman. Avatar zemini segment rengi.

## 5) Responsive + TAŞMA (sağ tarafa taşma yasak)
- **Taşmanın kök nedeni:** `grid-template-columns: repeat(N, 1fr)` içerik daralmadığı için
  sağa taşar. **Her zaman `minmax(0, 1fr)`** kullan: `.ph-aud-grid`→`repeat(5,minmax(0,1fr))`,
  `.ph-approval-strip`/`.ph-ops-grid`→`repeat(4,minmax(0,1fr))`, `.ph-split-2-1`→
  `minmax(0,2fr) minmax(0,1fr)`, `.ph-split-1-1`→`repeat(2,minmax(0,1fr))`.
- **EN SIK KÖK NEDEN — içerik kolonu:** sekme içeriğini saran ana kolon (`.as-page` /
  AdminPage tab wrapper) bir flex/grid child'dır ve `min-width:auto` varsayılanı yüzünden
  içeriğin altına inemez → `minmax(0,1fr)` gridler bile daralmaz, sağa taşar. **Bu kolona
  HER ZAMAN `min-width:0; max-width:100%`** ver (gerekirse `overflow-x:clip`). Tek başına
  taşmaların çoğunu çözer; tüm sekmeler için geçerli.
- İçerik tutan grid/flex çocuklarına `min-width:0`; ana içerik sütununa (`.as-page` /
  panel_home wrapper) `min-width:0; max-width:100%`. Gerekirse `.as-page{overflow-x:clip}`.
- **İç içe 2 kolonlu sekme düzenleri** (deployment sol modül + sağ config gibi) sol menü ~500px
  yer kapladığı için **≤1280px viewport'ta tek kolona** insin (içerik kolonu dar).
- Kırılımlar: 5'li grid → 1280px'te 3, 820px'te 2, 520px'te 1; 4'lü kartlar → 1280px'te 2,
  520px'te 1; `ph-split-*` → 1280px altı tek sütun.

## 6) Login ekranları + giriş akışı (TÜM girişler aynı şablon)
- Tüm portal girişleri **aynı düzeni** kullanır: üst nav + ortada kart (solda renkli panel:
  logo + başlık + açıklama, sağda beyaz form: eyebrow "… GİRİŞİ" + "Hesabınla devam et").
  Sol panel zemini + giriş butonu = segment rengi.
- **Sidebar + tüm girişlerde logo aynı** (BUYER beyaz + AS·İSTANS altın + tik yeşil, koyu
  zemin) ve **tek ebat**. Açık zeminde doğru varyant (BUYER koyu + altın/yeşil), biraz büyük.
- **Panel başlığı (navy) EN ÜSTTE** — beyaz topbar (arama/mail/kullanıcı) onun altında.
- **"Sisteme Giriş" açılır menüsü** butona yapışık açılır (`position:absolute; top:100%; right:0`),
  `max-width` ile sağa taşmaz, tıklama-dışı kapanır.
- **Giriş seçim butonları** (menü + `/login` hub) segment renginde: Stratejik `#134E37`,
  Tedarikçi `#0E7490`, İş Ortağı `#7C2D12`, İşveren `#5B21B6`, İş Arıyorum `#9F1239`.
  Her buton **doğrudan** ilgili login ekranına gider (ara seçim sayfası yok).
- `/login` hub'ında tek "Üye Ol" yerine **İşveren** ve **İş Arıyorum** butonlarının ALTINA
  ayrı "Üye Ol" → soru sormadan doğru kayıt sayfasını açar.
- **Stratejik Partner** girişi/panel **2 renk**: koyu forest `#134E37` + **altın `#D4AF37`**
  sağ-alttan ışık parıltısı. Login **dış arka planı** = segment renginin çok açık tonu
  (işveren → lavanta `#f5f3ff`, yeşil DEĞİL).

## 6) Dokunulan dosyalar (referans)
- `web/src/admin/workspace-panels.ts` — rol→renk
- `web/src/admin/segment-colors.ts` — SEGMENT_META (yoksa oluştur)
- `web/src/pages/admin/AdminShell.tsx` + `adminShell.css` — sidebar rengi, rozet, logo, PanelTopHeader
- `web/src/pages/admin/PanelTopHeader.tsx` — başlık bileşeni
- `web/src/pages/AdminPage.tsx` + `adminPage.css` — sekme içerikleri

## 7) Public sayfalar, kampanya & responsive (TÜM platform)
- **Responsive ZORUNLU — tüm sayfalar** (panel + ana sayfa + landing + liste + login):
  PC/tablet/telefonda kayma, üst üste binme, sağa taşma OLMAZ. Gridlerde `minmax(0,1fr)`,
  esnek kırılımlar (≤1024 / ≤768 / ≤560), nav mobilde sarar/menüye iner. Bu kural panelde
  olduğu gibi ana sayfa ve yardımcı sayfalarda da uygulanır.
- **Kampanyalar süper admin → "Kampanyalar & Landing" (`campaigns`) sekmesinden yönetilir;**
  ana sayfa ve landing sayfalarındaki kampanyalar bu modülden **veri-güdümlü** gelir (statik değil).
  Kampanya plan/indirim/komisyona bağlanır; **kullanım bazlı fatura** (yararlanan kadar öder,
  çift/yanlış tahsilat yok). Her audience için kampanya olabilir; **Kariyer & İK** dahil.
- **Resmi domainler** ana sayfada belirtilir (buyerasistans.com.tr / .com / .online / .info),
  resmi e-posta `@buyerasistans.com.tr` — dolandırıcılık önleme.
- Her landing/liste sayfasında **Üye Ol + Giriş** (doğru rota) + gerekiyorsa **Demo Talebi**.
- **Güvenlik (KURAL):** tüm login + üye ol formlarında **captcha** (Turnstile/reCAPTCHA) +
  rate-limit + e-posta doğrulama; doğrulanmadan submit yok. Sosyal giriş eklenirse B2B için
  **Google + LinkedIn** önceli (Facebook/Instagram/X ikincil), hepsi aynı güvenlik kuralına tabi.
- **Slider:** esnek yükseklik + `clamp()` başlık; butonlar tam sayfa/yeni sekme açar (slider
  içinde değil). Login kartları **≤900px tek kolon** (renkli panel üstte kompakt, form altta).

## Bitince kontrol
- [ ] Sidebar + panel başlığı aynı segment renginde; logo renkli; rozet `v3.4`.
- [ ] Rol & İzin barı yok; başlık "{rol} Paneli" + Hoş geldiniz/{ad}.
- [ ] Segment renkleri net ayrık; grafikler çizgi + açıklama notlu; aktivitede rozet+firma.
- [ ] PC/tablet/telefon taşma yok; build hatasız.
