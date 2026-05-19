# Approval required_role Drop Preflight - 2026-04-19

Kapsam: `quote_approvals.required_role` kolonunun fiziksel drop
fazina gecmeden once
kalmasi gereken son call-site ve kapilarin envanteri.

## 1) Mevcut Durum

- DB seviyesinde compatibility mirror temizligi uygulanmis durumda.
- `approval-required-role-cleanup-applied.json` artefaktina gore
  mirror cleanup tamamlandi.
- Fiziksel drop komutu uygulanarak `quote_approvals.required_role` kolonu dusuruldu.
- Post-drop audit komutu
  `APPROVAL_REQUIRED_ROLE_ALREADY_DROPPED` durumuna gecmis durumda.

Bu durum, approval runtime kontratinin ve veri katmaninin canonical-only hale
geldigini gosterir. Kalan is artik operasyon notlarini ve eski call-site
envanterini arşiv niteliginde tutmaktir.

## 2) Drop Fazinda Kapanan Runtime Noktalari

### Backend

- `api/services/quote_approval_service.py`
  - `resolve_required_business_role()` icindeki
    `approval.required_role` fallback'i kaldirildi
  - `pending_approval_matches_business_role()` icindeki ikinci OR kolu kaldirildi
  - compatibility response alanlari kaldirildi
- `api/schemas/quote.py`
  - response modellerindeki `required_role` compatibility alani kaldirildi
- `api/models/quote_approval.py`
  - `required_role` ORM kolonu kaldirildi
- `api/scripts/audit_role_system_role_consistency.py`
  - approval fix/audit akisi optional kolon farkindaligina cekildi
- `api/scripts/audit_quote_approval_required_role_cleanup.py`
  - cleanup scripti post-drop sonrasinda `ALREADY_DROPPED` aware hale getirildi

### Frontend

- `web/src/types/approval.ts`
  - `required_role`, `required_role_mirror`, `required_role_label` kaldirildi
- `web/src/auth/permissions.ts`
  - `resolveApprovalLegacyRole()` kaldirildi
  - canonical resolver'lardaki son fallback zinciri kaldirildi

### Test ve Fixture Katmani

- `web/src/test/admin-page-tenant-governance.test.tsx`
  - approval fixture'larindaki legacy alanlar temizlendi
- `web/src/test/permissions.test.ts`
  - legacy approval fallback assertion'lari canonical-only hale getirildi
- backend approval test fixture'lari
  - compatibility response key beklentileri canonical kontrata cekildi

## 3) Post-Cut Dogrulama

- Tum aktif istemciler `required_business_role` ve
  `required_business_role_label` kullaniyor olmali.
- Cleanup audit komutu `APPROVAL_REQUIRED_ROLE_ALREADY_DROPPED` sonucunu vermeli.
- Hedefli approval backend test paketi yesil kalmali.
- Frontend approval permission/governance fixture'lari parse ve assertion
  seviyesinde yesil kalmali.

## 4) Uygulanan Siralama

1. Frontend canonical-only branch'i hazirlandi ve testleri yesile cekildi.
2. Backend schema/serializer katmanindan compatibility key'leri kaldirildi.
3. `quote_approval_service` icindeki legacy OR/fallback mantigi kaldirildi.
4. Hedefli approval backend test paketi dogrulandi.
5. Ardindan `drop_quote_approval_required_role_column.py --apply`
  ile fiziksel drop uygulandi.

## 5) Not

- Bu dokuman artik preflight'tan post-cut kanit dokumanina donusmustur.
- Release zincirinde referans olarak saklanir; ayni kolon icin ikinci
  bir drop penceresi gerekmez.
