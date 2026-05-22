# Public Web Domain Cutover Paketi - 2026-04-19

Kapsam: BUYER ASISTANS multi-domain yayini icin ilk uygulanabilir altyapi paketi.

## 1) Referans Konfigurasyon Dosyalari

- Nginx: `infra/nginx/buyerasistans-multidomain.conf`
- Cloudflare redirect rules: `infra/cloudflare/redirect-rules.json`
- Cloudflare cache rules: `infra/cloudflare/cache-rules.json`

## 2) Bu Paketle Somutlasan Konular

- Apex + `www` canonical davranisi
- `.info` bilgi merkezi path yonlendirmeleri
- `.online` kampanya path yonlendirmeleri
- `/sitemap.xml` istegini domain-intent bazli sitemap dosyalarina dagitma
- `/robots.txt` istegini domain-intent bazli tarama politikasina dagitma
- API cache bypass ve statik asset cache policy ornegi

## 3) Operasyon Uygulama Sirasi

1. Nginx upstream hedeflerini production web/api endpointleri ile degistir.
2. SSL certificate path'lerini canli ortam yolu ile guncelle.
3. Cloudflare Redirect Rules ekranina
   `infra/cloudflare/redirect-rules.json` icindeki kurallari tas.
4. Cloudflare Cache Rules ekranina
   `infra/cloudflare/cache-rules.json` kurallarini tas.
5. Staging uzerinde asagidaki pathleri manuel dogrula:
   - `/`
   - `/fiyatlandirma`
   - `/demo`
   - `/blog/...`
   - `/kampanya/...`
   - `/sitemap.xml`
   - `/robots.txt`

## 4) Dogrulama Matrisi

- `buyerasistans.com.tr/` -> canonical TR ana alan
- `buyerasistans.com/blog/...` -> `buyerasistans.info/blog/...` 301
- `buyerasistans.com.tr/kampanya/...` -> `buyerasistans.online/kampanya/...` 301
- `buyerasistans.info/sitemap.xml` -> `sitemap-knowledge.xml`
- `buyerasistans.online/sitemap.xml` -> `sitemap-campaigns.xml`
- `buyerasistans.info/robots.txt` -> bilgi merkezi allow, kampanya disallow
- `buyerasistans.online/robots.txt` -> kampanya allow, bilgi merkezi disallow

## 5) Bu Paket Bilerek Neyi Cozmez

- Gercek DNS/SSL provisioning
- Search Console submit akisi
- Public analytics tarafinda harici BI/export katmani

Not: runtime canonical ve hreflang yonetimi web tarafinda aktif hale getirildi.
Not: domain bazli sitemap/robots servisleme ve ilk public KPI
gorunurlugu API/admin ekraninda aktif.

Bu maddeler sonraki operasyon/uygulama turuna aittir.
