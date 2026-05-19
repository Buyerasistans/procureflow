# BUYER ASISTANS Public Web Is Akisi

Bu dosya, BUYER ASISTANS public web katmani ve multi-domain yayin
kurgusu icin calisma referansidir.
Ana plan dosyasi: TENANT_SAAS_TRANSFORMATION_PLAN.md

## 1) Kural Seti (Kalici Not)

### Domain gorev dagilimi

- buyerasistans.com.tr: Ana kurumsal vitrin ve TR odakli ana SEO domaini
- buyerasistans.com: Global/EN acilis sayfasi ve uluslararasi lead toplama
- buyerasistans.online: Kampanya/landing ve A-B test odakli performans alani
- buyerasistans.info: Bilgi merkezi, rehber, sozluk, uzun kuyruk SEO icerik kutuphanesi

### SEO teknik kurallari

- Birincil canonical: kurumsal ana sayfalar icin buyerasistans.com.tr
- Domain bazli 301 ve canonical kurallari net tanimlanacak
- Dil varyantlarinda hreflang kullanilacak
- Ayni icerik birebir kopya yayinlanmayacak; domain niyetine gore icerik farklilastirilacak

### Altyapi kurali

- Tum domainler ayni hosting ve ayni veritabani uzerinde calisir
- Uygulama, tek release pipeline ve tek observability katmani ile yonetilir

## 2) Yapilanlar

- [x] Ana sayfa, hem Stratejik Ortak hem Tedarikci akisina hitap
    edecek sekilde guncellendi
- [x] Ana sayfaya "Stratejik Ortak Ol", "Tedarikci Ol" ve
    "Tedarikci Girisi" butonlari eklendi
- [x] Stratejik ortak ve tedarikci icin ayri bilgilendirme sayfalari eklendi
- [x] Demo sayfasi tek noktada iki modlu hale getirildi:
    stratejik ortak demosu / tedarikci demosu
- [x] Fiyatlandirma sayfasi iki bolumlu hale getirildi:
    stratejik ortak planlari + tedarikci planlari
- [x] Super admin tarafindan yonetilebilir public pricing backend endpointleri eklendi
- [x] Public pricing admin ekrani eklendi (/admin/public-pricing)
- [x] BUYER ASISTANS icin 3 adet logo taslak SVG secenegi eklendi
- [x] Ana sayfaya platform akis bolumu (kesif -> eslesme -> onay/performans) eklendi

## 3) Yapilacaklar

- [x] Nginx/Cloudflare canli aday kurallari: host bazli canonical ve
    yonlendirme artefaktlari repo icinde hazir
- [x] sitemap.xml ayrimi: .com.tr/.com/.online/.info niyetine gore sitemap segmentasyonu
- [x] robots politikasi: kampanya ve bilgi merkezi tarama stratejisi
- [x] hreflang haritasi: TR/EN sayfa eslemeleri
- [x] Public analytics dashboard: domain bazli trafik ve lead KPI panosu
- [x] Logo secimi (A/B/C) ve secilen logonun tum sayfalarda standardizasyonu

## 3A) Teknik Canli Checklist

### SEO ve Domain Konfigurasyonu

- [x] Nginx host kurallari staging adayi olarak repo artefaktina yazildi
- [x] Cloudflare redirect ve cache rule isimleri operasyon runbook'a yazildi
- [x] Canonical davranisi ana sayfa, pricing, demo ve partner
    sayfalarinda manuel kontrol edildi
- [x] TR/EN hreflang eslemeleri runtime kurallariyla cikarildi

### Sitemap ve Robots

- [x] Domain bazli sitemap dosya adlari ve route ownership listesi netlestirildi
- [x] robots politikasinda .online kampanya ve .info bilgi merkezi
    icin ayri tarama karari yazildi
- [x] Search Console / Bing submit adimlari operasyon sorumlusu ile eslendi

### Analitik ve KPI

- [x] Public analytics dashboard icin minimum KPI seti sabitlendi
- [x] KPI seti: domain bazli session, lead form submit, CTA click,
    demo talebi ve supplier signup
- [x] UTM naming policy marketing ekibiyle ayni sozlukte kilitlendi
- [x] Domain-intent header veya property mapping stratejisi gozlem katmaninda tanimlandi

Analitik durum notu:

- API tarafinda anonim public telemetry endpointi ile page_view,
    cta_click ve form_submit olaylari tutulur.
- Admin > Platform Analitikleri ekraninda public KPI kartlari ve
    domain-intent ozeti gorunur.
- Admin > Platform Analitikleri ekraninda host/event segment filtresi
    ve CSV export aktif.
- Harici BI sonraki fazdadir.

UTM policy notu:

- `utm_source`: trafik kaynagi. Ornek: `google`, `linkedin`,
    `newsletter`.
- `utm_medium`: kanal tipi. Ornek: `cpc`, `paid-social`, `email`,
    `organic`.
- `utm_campaign`: kampanya slug'i. Ornek:
    `q2-supplier-launch`.
- Telemetry katmani bu alanlari kucuk harf, bosluksuz ve slug
    formatinda normalize eder.
- Domain niyetine gore onerilen kullanim: `.online` performans
    kampanya, `.com` partner/kanal, `.com.tr` kurumsal lead,
    `.info` icerik dagitimi.

Robots durum notu:

- `.online` icin kampanya/demo/supplier CTA pathleri taramaya acik,
  bilgi merkezi pathleri kapali tutulur.
- `.info` icin bilgi merkezi pathleri taramaya acik, kampanya pathleri kapali tutulur.
- Kurumsal ve global domainlerde admin/api/supplier/app rotalari
    taramaya kapali tutulur.

### Marka ve Icerik Tutarliligi

- [x] Logo secimi A/B/C arasinda tek karara indirildi
- [x] Secilen logo ana sayfa, pricing, demo ve partner bilgi
    sayfalarinda ayni varyantla kullanildi
- [x] Ayni icerigin domainler arasinda birebir kopya olmadigi
    editor kontrol listesiyle dogrulandi

Marka durumu notu:

- Secilen varyant: `buyer-logo-custom.svg`.
- Public nav, login, supplier login ve onboarding ekranlari bu
    varyanta sabitlendi.
- [docs/release/public-content-similarity-audit-2026-04-19.md](docs/release/public-content-similarity-audit-2026-04-19.md)
    raporunda esik ustu birebir tekrar riski bulunmadi.

Search submit notu:

- [docs/release/public-search-console-bing-submit-checklist-2026-04-19.md](docs/release/public-search-console-bing-submit-checklist-2026-04-19.md)
    ile sahiplik, sitemap submit ve inspection adimlari operasyon
    seviyesinde kayda alindi.

### Canli Oncesi Kapı

- [ ] DNS, SSL, redirect ve canonical davranisi check-list videosu
    veya ekran goruntusu ile kanitlandi
- [ ] Analytics eventleri preview/staging ortaminda en az bir domain uzerinden goruldu
- [ ] Canli alma gunu icin rollback sahibi ve operasyon iletisim kanali belirlendi

## 4) Operasyon Notu

Bu konudaki yeni isler once bu dosyada detaylandirilir.
TENANT_SAAS_TRANSFORMATION_PLAN.md icinde sadece ust seviye takip
kaydi tutulur ve bu dosyaya referans verilir.

## 5) Nginx / Cloudflare Ornek Kurallar

### Nginx host bazli yonlendirme (ornek)

```nginx
server {
    listen 80;
    server_name buyerasistans.com.tr buyerasistans.com buyerasistans.online buyerasistans.info;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name buyerasistans.com;
    location / {
        proxy_pass http://app_upstream;
        add_header Link '<https://buyerasistans.com$uri>; rel="canonical"' always;
    }
}

server {
    listen 443 ssl;
    server_name buyerasistans.com.tr;
    location / {
        proxy_pass http://app_upstream;
        add_header Link '<https://buyerasistans.com.tr$uri>; rel="canonical"' always;
    }
}
```

Operasyon referansi:

- Nginx canli aday konfig: `infra/nginx/buyerasistans-multidomain.conf`
- Cloudflare redirect kurallari: `infra/cloudflare/redirect-rules.json`
- Cloudflare cache kurallari: `infra/cloudflare/cache-rules.json`
- Cutover notu: `docs/release/public-web-domain-cutover-2026-04-19.md`

### Cloudflare (ornek)

- Redirect Rule: `.online/blog/*` -> `.info/blog/$1` (301)
- Transform Rule: `X-Domain-Intent: campaign | knowledge | corporate`
- Cache Rule: kampanya sayfalarinda kisa TTL, bilgi sayfalarinda uzun TTL

### Sitemap stratejisi

- `https://buyerasistans.com.tr/sitemap-main.xml`
- `https://buyerasistans.com/sitemap-global.xml`
- `https://buyerasistans.online/sitemap-campaigns.xml`
- `https://buyerasistans.info/sitemap-knowledge.xml`
