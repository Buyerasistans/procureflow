
---

### `docs/llm-memory-workflow.md`

```md
# LLM Memory Workflow (Team Playbook)

Bu doküman ekip içi standart kullanım akışını tanımlar.

## 1) Ne zaman kullanılır?

- Yeni feature başlamadan önce
- Refactor planı çıkarmadan önce
- Incident sonrası kök neden analizi yaparken
- Onboarding sırasında alan keşfi için

## 2) Standart Akış

### A) Pre-Plan (Query)
1. `wiki/index/domain-map.md` oku
2. İlgili `wiki/domains/*.md` sayfalarını oku
3. Planı çıkar (henüz kod yazma)
4. Planı kaynak dosyalarla doğrula

### B) Implement
1. Kod değişikliklerini yap
2. Testleri çalıştır
3. Etkilenen domain/flow wiki sayfalarını güncelle

### C) Post-Update (Ingest + Changelog)
1. `last_verified_at` tarihlerini güncelle
2. `source_files` listesine yeni dosyaları ekle
3. `wiki/changelog/YYYY-MM-DD.md` dosyasına kayıt düş

### D) Weekly Lint
1. stale sayfaları bul
2. kırık linkleri düzelt
3. silinmiş source path’leri onar

## 3) PR Kontrol Listesi

- [ ] Kod değişikliği ile ilgili wiki sayfası güncellendi
- [ ] `last_verified_at` güncel
- [ ] `source_files` doğru
- [ ] Changelog kaydı eklendi
- [ ] Assumption alanları ya doğrulandı ya da işaretlendi

## 4) Anti-Pattern’ler (Yapılmayacaklar)

- Sadece wiki’ye bakıp kod doğrulaması yapmadan patch üretmek
- `source_files` boş bırakmak
- 1 aydan eski sayfayı “kesin doğru” kabul etmek
- Domain akışını UI veya API tarafında tek taraflı belgelemek

## 5) Başarı Ölçütleri

- PR başına wiki güncelleme oranı
- Wiki stale sayfa oranı
- AI önerilerinde dosya referansı oranı
- Yanlış dosyaya müdahale kaynaklı hata sayısı
