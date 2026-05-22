# Public Search Console ve Bing Submit Checklist - 2026-04-19

Kapsam: BUYER ASISTANS multi-domain public web yayininda Search Console
ve Bing Webmaster submit adimlarini operasyon sorumlusuyla netlestirmek.

## 1) Domain Sahipligi

- `buyerasistans.com.tr`
- `buyerasistans.com`
- `buyerasistans.online`
- `buyerasistans.info`

Her domain icin asagidaki sahiplik yontemlerinden biri secilir:

- DNS TXT kaydi
- HTML dosyasi
- HTML meta etiketi

Not: DNS TXT kaydi birincil tercih olarak kullanilir.

## 2) Submit Sirasi

1. `https://buyerasistans.com.tr/sitemap-main.xml`
2. `https://buyerasistans.com/sitemap-global.xml`
3. `https://buyerasistans.online/sitemap-campaigns.xml`
4. `https://buyerasistans.info/sitemap-knowledge.xml`

## 3) Search Console Kontrol Noktalari

- URL Inspection ile ana sayfa, `/fiyatlandirma`, `/demo` kontrol edilir.
- Coverage ekraninda robots engeli olmayan public pathler dogrulanir.
- Canonical secimi `.com.tr`, `.com`, `.online`, `.info` niyetine gore
  beklenen host ile uyumlu mu kontrol edilir.
- Hreflang alternates gorunurlugu ana sayfa ve partner/demoda kontrol edilir.

## 4) Bing Webmaster Kontrol Noktalari

- Site Explorer ile sitemap import dogrulanir.
- URL inspection ile `/blog/...` ve `/kampanya/...` pathleri test edilir.
- Crawl control ve robots gorunumu alaninda `.info` ve `.online`
  farkli tarama politikasi teyit edilir.

## 5) Operasyon Cikti Kaydi

- Sahiplik tarihi:
- Sorumlu kisi:
- Search Console ekran goruntusu linki:
- Bing Webmaster ekran goruntusu linki:
- Notlar:

## 6) Tamamlanma Kriteri

- Dort domain de verified durumda.
- Dort sitemap de submit edildi.
- En az bir Search Console ve bir Bing inspection kaniti kaydedildi.
- Kanitlar release penceresi notlarina veya operasyon klasorune eklendi.
