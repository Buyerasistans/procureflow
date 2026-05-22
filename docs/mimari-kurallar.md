# ProcureFlow Mimari Kurallari

## 1. Katman Sinirlari

- Router katmani sadece HTTP, auth kontrolu, request/response serilestirme yapar.
- Is kurallari service veya domain katmaninda olur.
- Model katmani sadece ORM tablolari ve iliskileri icerir.
- Router icinden dogrudan ham SQL veya kompleks is kurali yazilmaz.

## 2. Domain Kurallari

- Teklif durum gecisleri tek yerden yonetilir: app/domain/quote/policy.py.
- Durum enum tanimlari app/domain/quote/enums.py disinda dagitilmaz.
- Yeni durum eklenirse domain policy + API + test birlikte guncellenir.

## 3. API Tasarim Kurallari

- Tum endpointler api/v1 altinda versiyonlu olmali.
- Router dosyalari kaynak bazli ayrilir: quotes, auth, supplier, admin gibi.
- Input/Output modelleri schemas altinda tutulur; ham dict donulmez.

## 4. Veritabani Kurallari

- Veri semasi degisikligi sadece Alembic migration ile yapilir.
- SQLAlchemy model degisirse migration ayni branchte eklenir.
- Uretimde SQLite degil PostgreSQL esas alinir.

## 5. Konfigurasyon ve Guvenlik

- Gizli bilgiler sadece .env dosyalarinda tutulur.
- Kod icine sabit secret, token, sifre yazilmaz.
- JWT/refresh token mantigi core/security.py ve auth servisi disina dagitilmaz.

## 6. Dosya ve Medya Kurallari

- Runtime yuklemeleri sadece uploads ve api/uploads altina yazilir.
- Upload veya backup verisi repoya commit edilmez.
- Test fixture disi csv/xlsx dosyalari kaynak kodla birlikte tasinmaz.

## 7. Frontend Mimari Kurallari

- Sayfa seviyesi bilesenler pages altinda, tekrar kullanilanlar
  components altinda tutulur.
- API cagri kodu services katmaninda toplanir; component icinde daginik fetch yazilmaz.
- Ortak kimlik ve oturum akisi context + hooks katmaninda yonetilir.

## 8. Test Kurallari

- Backend testleri tests altinda pytest ile, frontend testleri
  web/src/test altinda tutulur.
- Her kritik is kuralinda en az bir basari ve bir hata senaryosu test edilir.
- Concurrency, auth refresh, quote state gecisleri regresyon test kapsaminda tutulur.

## 9. Temizlik ve Surdurulebilirlik

- Gecici debug scriptleri kalici klasorlerde tutulmaz.
- scripts altina sadece operasyonel ve tekrar kullanilabilir scriptler konur.
- Dokuman, kod davranisiyla celisiyorsa once kodu dogrula, sonra dokumani guncelle.
