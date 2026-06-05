# SESSION CLOSEOUT PROMPT

Bu oturumu kapatmadan önce operasyonel kapanış raporu üret.

## Hard Rules
1. Kısa ama eksiksiz ol.
2. Domain coverage ve wiki/changelog durumunu net belirt.
3. Eksik varsa açıkça FAIL olarak işaretle.
4. Çıktının sonunda soru sorma.

## Required Output
1) **Summary of Changes**
- Ne yapıldı? (dosya + kısa etki)

2) **Domain Coverage**
- Etkilenen domainler
- Güncellenen wiki/domain dosyaları
- Coverage durumu (OK/FAIL)

3) **Changelog Status**
- Bugün için changelog güncellendi mi? (OK/FAIL)
- Eklenen başlıklar

4) **Open Risks / Tech Debt**
- Kalan 3 risk

5) **Rollback Notes**
- Gerekirse nasıl geri alınır?

6) **Next Session First 3 Steps**
- Bir sonraki oturum açılınca yapılacak ilk 3 net adım

## Final Line
- Tek satır operasyon özeti ver:
`Session close readiness: OK` veya `Session close readiness: FAIL (reason)`
