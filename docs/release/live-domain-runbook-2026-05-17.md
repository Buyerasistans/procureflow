# Canli Domain Runbook (2026-05-17)

Bu dokuman, canli domainlerin rol dagilimini, dil davranisini ve operasyon kurallarini tek kaynaga sabitler.

## 1) Domain Rol Matrisi

| Domain | Ana Rol | Varsayilan Niyet | Varsayilan Dil |
|---|---|---|---|
| `buyerasistans.com.tr` | Ana kurumsal domain | `corporate` | `tr` |
| `buyerasistans.com` | Global/universal domain | `global` | `en` |
| `buyerasistans.info` | Bilgi merkezi | `knowledge` | tarayici dili (fallback `tr`) |
| `buyerasistans.online` | Kampanya/landing | `campaign` | tarayici dili (fallback `tr`) |

## 2) Dil Calisma Kurali

Sira:
1. Kullanici manuel dil secimi (`TR/EN`) varsa o korunur (localStorage).
2. Manuel secim yoksa backend `GET /api/v1/public/locale-hint` endpoint'i cagrilir.
3. Locale-hint bos donerse tarayici dili kullanilir (`navigator.language`).
4. Tarayici dilinden karar verilemezse domain varsayilani kullanilir.

Desteklenen diller (v1 global liste):
- `tr` Turkce
- `en` Ingilizce
- `de` Almanca
- `fr` Fransizca
- `es` Ispanyolca
- `it` Italyanca
- `pt` Portekizce
- `nl` Hollandaca
- `pl` Lehce
- `ja` Japonca
- `ko` Korece
- `zh` Cince
- `ar` Arapca
- `ru` Rusca

Not:
- Bu yapi ayni DB uzerinde calisir; dil secimi yalnizca sunum katmanini etkiler.
- Kullanici panel/public tarafinda bayrakli dil degistirici ile anlik gecis yapabilir.
- Arapca secildiginde `dir=rtl` uygulanir.
- `.com.tr` domaininde dil `tr` kilitlidir (manuel degisim devre disi).
- TR disi secimlerde TR baz metinler otomatik sayfa-cevirisi katmani ile hedef dile donusturulur (yardim merkezi ve panel metinleri dahil).
- `locale-hint` endpoint'i su header'lari sirayla degerlendirir:
  - `cf-ipcountry`
  - `x-vercel-ip-country`
  - `x-country-code`
  - `x-geo-country`
  - fallback: `accept-language`
- UI metin cache endpoint'i:
  - `GET /api/v1/public/translations/{namespace}?locale={locale}`
  - Ilk namespace: `public_core` (navbar/giris metinleri)

## 3) Kök Yönlendirme Kurali

- `.com.tr` -> `/` (kurumsal acilis)
- `.com` -> `/` (global acilis; Turkce path'e zorlanmaz)
- `.info` -> `/blog`
- `.online` -> `/demo`

## 4) Public Alias Rotalar (EN)

Asagidaki EN path'ler canliya alinmistir:

- `/offers`
- `/suppliers`
- `/strategic-partner`
- `/become-supplier`
- `/partner-program`
- `/partner-apply`

TR path'ler korunur; iki set ayni uygulama akisina baglidir.

## 5) Operasyon Notu

- DNS, SSL, canonical ve redirect kurallari domain niyet matrisine gore korunur.
- Public build dagitimi 4 domainde ayni release artefaktiyla yapilir.
- Dil/niyet degisiklikleri sonrasi telemetry ve SEO smoke tekrar kosulur.

## 6) Deployment Panel Hedefleri

Deployment panelinde hedef secimi su profillerle yapilir:
- `.com.tr` -> `/var/www/vhosts/buyerasistans.com.tr/httpdocs`
- `.com` -> `/var/www/vhosts/buyerasistans.com/httpdocs`
- `.info` -> `/var/www/vhosts/buyerasistans.info/httpdocs`
- `.online` -> `/var/www/vhosts/buyerasistans.online/httpdocs`

Secim domain ve remote path alanlarini otomatik doldurur.

## 7) GeoIP Header Gecis Kurali (Plesk/Nginx)

Amac:
- `GET /api/v1/public/locale-hint` endpoint'ine ulke kodu header'larinin ulasmasi.

### 7.1 Nginx Additional directives (domain-level)

Plesk ilgili domain icin `Apache & Nginx Settings > Additional nginx directives` alanina:

```nginx
location /api/ {
  proxy_set_header X-Forwarded-Host $host;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

  # Cloudflare / CDN ulke kodu
  proxy_set_header CF-IPCountry $http_cf_ipcountry;

  # Alternatif ulke header gecisleri
  proxy_set_header X-Country-Code $http_x_country_code;
  proxy_set_header X-Geo-Country $http_x_geo_country;
  proxy_set_header X-Vercel-IP-Country $http_x_vercel_ip_country;
}
```

Not:
- Cloudflare kullaniliyorsa `CF-IPCountry` otomatik gelir.
- CDN yoksa `accept-language` fallback devrede kalir.

### 7.2 Dogrulama

Canli sunucuda:

```bash
curl -s https://buyerasistans.com/api/v1/public/locale-hint
```

Beklenen:
- `locale` dolu gelir (`en/de/fr/...`)
- `source` alani:
  - `country` (header yakalandiysa)
  - `accept-language` (fallback)
  - `default` (son fallback)

Header simulasyonu:

```bash
curl -s -H "CF-IPCountry: DE" https://buyerasistans.com/api/v1/public/locale-hint
```

Beklenen:
- `country_code=DE`
- `locale=de`
- `source=country`

### 7.3 Reconfigure adimi

Plesk degisikligi sonrasi:

```bash
plesk sbin httpdmng --reconfigure-domain buyerasistans.com
nginx -t && systemctl reload nginx
```
