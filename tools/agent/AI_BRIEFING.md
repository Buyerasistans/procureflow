# AI BRIEFING (AUTO) - MODEL AGNOSTIC

## Session Meta
date: 2026-06-04
branch: feat/strategic-partner-governance-redesign
mode: task
task: Kaldm yerden devam
domain: payment-billing

## Read First
1. tools/agent/SESSION_CONTEXT.md
2. tools/agent/RUNBOOK.md
3. wiki/domains/payment-billing.md
4. wiki/changelog/2026-06-04.md
5. tools/agent/prompts/04_task_execution.md

## Git Snapshot
### status
 M api/main.py
 M api/models/refresh_token.py
 M api/models/user.py
 M api/requirements.in
 M api/routers/admin_deployment.py
 M api/routers/auth.py
 M api/routers/user_profile_router.py
 M api/schemas/campaign.py
 M api/schemas/user.py
 M api/scripts/apply_runtime_compat_columns.py
 M api/services/campaign_service.py
 M tools/agent/AI_BRIEFING.md
 M tools/agent/SESSION_CONTEXT.md
 M web/index.html
 M web/public/slider/Sunum_Slider.html
 M web/src/App.tsx
 M web/src/admin/workspace-panels.ts
 M web/src/auth/permissions.ts
 M web/src/components/HelpCenter.css
 M web/src/components/HelpCenter.tsx
 M web/src/components/NavBar.css
 M web/src/components/NavBar.tsx
 M web/src/components/ProjectsTab.tsx
 M web/src/components/PublicBrandLogo.css
 M web/src/components/PublicBrandLogo.tsx
 M web/src/components/admin/DeploymentPanel.css
 M web/src/components/admin/DeploymentPanel.tsx
 M web/src/components/admin/WorkspacePanelDesignerTab.tsx
 M web/src/config/navigation-policy.ts
 M web/src/context/AuthContext.tsx
 M web/src/context/ProfileProvider.tsx
 M web/src/context/auth-context.ts
 M web/src/context/profile-types.ts
 M web/src/index.css
 M web/src/pages/AdminPage.tsx
 M web/src/pages/CandidateRegisterPage.css
 M web/src/pages/CandidateRegisterPage.tsx
 M web/src/pages/ChannelLoginPage.css
 M web/src/pages/ChannelLoginPage.tsx
 M web/src/pages/ChannelPartnerRegisterPage.css
 M web/src/pages/ChannelPartnerRegisterPage.tsx
 M web/src/pages/EmployerRegisterPage.css
 M web/src/pages/EmployerRegisterPage.tsx
 M web/src/pages/IsverenGirisPage.css
 M web/src/pages/IsverenGirisPage.tsx
 M web/src/pages/JobsPage.css
 M web/src/pages/JobsPage.tsx
 M web/src/pages/LoginPage.css
 M web/src/pages/LoginPage.tsx
 M web/src/pages/PlatformLoginPage.css
 M web/src/pages/PlatformLoginPage.tsx
 M web/src/pages/ProjectDetailPage.css
 M web/src/pages/ProjectDetailPage.tsx
 M web/src/pages/PublicHomePage.css
 M web/src/pages/PublicHomePage.tsx
 M web/src/pages/StrategicPartnerLoginPage.css
 M web/src/pages/StrategicPartnerLoginPage.tsx
 M web/src/pages/SupplierPortalLoginPage.css
 M web/src/pages/SupplierPortalLoginPage.tsx
 M web/src/pages/TalentProfilePage.css
 M web/src/pages/TalentProfilePage.tsx
 M web/src/pages/admin/AdminShell.tsx
 M web/src/pages/admin/CompaniesTab.tsx
 M web/src/pages/admin/adminPageMeta.tsx
 M web/src/pages/admin/adminShell.css
 M web/src/services/admin.service.ts
 M web/src/services/auth.service.ts
 M web/src/services/auth.ts
 M web/src/services/profile.service.ts
 M web/src/styles/pages/AdminPage.css
?? .claude/
?? "Buyer Asistans Design System (3).zip"
?? Obsidian_Kasa/
?? api/alembic/versions/a1b2c3d4e5f6_add_linked_tenant_id_to_suppliers.py
?? api/alembic/versions/b2c3d4e5f6a7_add_dual_role_status_to_suppliers.py
?? api/alembic/versions/c3d4e5f6a7b8_add_2fa_login_notifications_sessions.py
?? api/routers/public_campaigns.py
?? api/routers/social_auth.py
?? api/utils/captcha.py
?? artifacts/
?? claude_code_handoff/
?? design_handoff_buyer_v3/
?? design_handoff_super_admin/00_CLAUDE_CODE_PROMPT.md
?? design_handoff_super_admin/README.md
?? design_handoff_super_admin/prototype/
?? localhost-aktarim/
?? package-lock.json
?? package.json
?? tools/agent/STATE.md
?? tools/agent/prompts/
?? tools/atomik3_employer_register_gate.mjs
?? tools/atomik3_jobs_cta_gate.mjs
?? tools/atomik4_candidate_register_gate.mjs
?? tools/atomik4_talent_profile_gate.mjs
?? tools/atomik5_activation_redirect_gate.mjs
?? tools/atomik5_nav_gate.mjs
?? tools/atomik6_public_nav_cta_gate.mjs
?? tools/gate-artifacts/atomik2-talent-profile-link/
?? tools/gate-artifacts/atomik3-employer-job-status/
?? tools/gate-artifacts/atomik3-employer-register/
?? tools/gate-artifacts/atomik4-candidate-register/
?? tools/gate-artifacts/atomik4-employer-pipeline/
?? tools/gate-artifacts/atomik5-activation-redirect/
?? tools/gate-artifacts/atomik6-candidate-application-history/
?? tools/gate-artifacts/atomik6-public-nav-cta/
?? tools/gate-artifacts/atomik7-candidate-withdrawal/
?? tools/gate-artifacts/atomik7-onboarding/
?? tools/gate-artifacts/atomik8-phase5-full/
?? tools/gate-artifacts/phase8-atomik1-job-create/
?? tools/public_nav_gate.mjs
?? tools/responsive_gate.mjs
?? web/public/brand/buyer-logo-dark.svg
?? web/src/admin/segment-colors.ts
?? web/src/components/DemoRequestForm.css
?? web/src/components/DemoRequestForm.tsx
?? web/src/components/SocialLoginButtons.css
?? web/src/components/SocialLoginButtons.tsx
?? web/src/components/SocialRegisterLayout.css
?? web/src/components/SocialRegisterLayout.tsx
?? web/src/components/TurnstileWidget.tsx
?? web/src/hooks/useCampaigns.ts
?? web/src/pages/CandidatePoolPage.css
?? web/src/pages/CandidatePoolPage.tsx
?? web/src/pages/CerezPolitikasiPage.tsx
?? web/src/pages/GizlilikPolitikasiPage.css
?? web/src/pages/GizlilikPolitikasiPage.tsx
?? web/src/pages/IadeVeOdemePolitikasiPage.tsx
?? web/src/pages/IsArayanGirisPage.css
?? web/src/pages/IsArayanGirisPage.tsx
?? web/src/pages/KampanyaDetailPage.css
?? web/src/pages/KampanyaDetailPage.tsx
?? web/src/pages/KullanimKosullariPage.tsx
?? web/src/pages/RoleLandingPage.css
?? web/src/pages/RoleLandingPage.tsx
?? web/src/pages/SocialAuthCallbackPage.css
?? web/src/pages/SocialAuthCallbackPage.tsx
?? web/src/pages/admin/AdminProfileTab.css
?? web/src/pages/admin/AdminProfileTab.tsx
?? web/src/pages/admin/PanelTopHeader.tsx
?? web/src/pages/roleLandingData.ts
?? web/src/services/public.service.ts
?? wiki/changelog/2026-06-01.md
?? "zip dosyalar\304\261/"


### last 5 commits
aac33a9 feat(ai-lab): RFQ onay akışı, AI Onaylı damgası, karar soruları
94bb00d fix(ai-lab): nav double-click, step animation, project grouping, RFQ panel
ae56668 fix(ai-lab): inline result view, 250MB limit, isolated localStorage key
25c2877 feat(ai-lab): inline analysis results — steps, model meta, BOM table, no redirect
9a8c3ef feat(ai-lab): rebuild AiLabAdminTab per spec — model seçimi + DWG/DXF upload + RFQ toggle


## Rules
- Tek kaynak local repo.
- Domain-aware al.
- Wiki/changelog etkisini zorunlu yaz.
- Çıktı sonunda soru sorma, "Next Action" ile devam et.

## Prompt Body
# TASK EXECUTION PROMPT (DOMAIN-AWARE, STRICT)

Görev: <TASK>
Domain: <DOMAIN>

Bu görevi domain-aware ve local-first şekilde uygula.
AI_BRIEFING tek source of truth'tur.

## Hard Rules
1. Önce plan, sonra değişiklik.
2. Değişiklikleri atomik tut (küçük commit mantığı).
3. Her kod değişikliğinin domain etkisini yaz.
4. Wiki/changelog güncellemesini zorunlu kontrol et.
5. Çıktının sonunda soru sorma.
6. Var olmayan dosya adı uydurma. Sadece repoda gerçekten bulunan path'leri kullan.
7. Genel/boş şablon cevap yasak. Her bölüm somut dosya ve somut aksiyon içermeli.
8. AI_BRIEFING dışındaki tarihsel mesajları referans alma. Doğrula, uygula, raporla.

## Mandatory Preflight (zorunlu)
Aşağıdakileri ilk adımda çıkar:
- git branch (HEAD)
- git status kısa özet
- var olan hedef dosyalar listesi (kod + wiki + changelog)
- domain dosyası path doğrulaması (`wiki/domains/<DOMAIN>.md`)

Eğer domain dosyası yoksa:
- `wiki/domains/<DOMAIN>.md` oluşturma planı yaz
- `payment-billing` fallback gerekçesini notla
- yine de icraya devam et (durma, soru sorma)

## Execution Workflow
1) Scope çıkar (ne var / ne yok)
2) Dosya bazlı değişiklik planı (yalnızca gerçek path)
3) Uygulama adımları
4) Test adımları
5) Wiki/changelog güncellemeleri
6) Risk ve rollback

## Required Output Format
1) **Technical Plan (max 10 madde)**  
2) **Files To Change (real repo paths only)**  
3) **Domain Mapping**  
4) **Implementation Notes**  
5) **Validation/Test Plan**  
6) **Wiki/Changelog Updates**  
7) **Commit Plan (atomic)**  
8) **Risks & Rollback**  
9) **Next Action** (soru sormadan, uygulanabilir tek sonraki adım)

## Output Quality Constraints (strict)
- `Files To Change` bölümünde her satır tam path içermeli.
- En az 1 kod dosyası + 1 wiki/changelog dosyası belirtmeden plan tamamlanmış sayılmaz.
- `domain_file.txt`, `changelog.txt`, `some_file` gibi placeholder isimler yasak.
- Her bölüm 2–6 madde arası, kısa ve operasyonel olmalı.

## Quality Gates
- Domain dosyası güncellendi mi?
- Changelog girdisi eklendi mi?
- Cross-domain etki varsa notlandı mı?

## Mandatory End-of-Session Verification (Evidence Mode) [ZORUNLU]

Oturum kapanmadan hemen önce aşağıdaki kanıt turu zorunludur:

1) Komut çıktıları:
- `git status --short`
- `git diff -- <değişen_kod_dosyası_1>`
- `git diff -- <değişen_kod_dosyası_2>`
- `git diff -- wiki/domains/<domain>.md`
- `git diff -- wiki/changelog/YYYY-MM-DD.md`

2) Teknik doğrulama (kod değiştiyse):
- Kritik guard/koşulun satır referansı (`grep -n` veya eşdeğeri)
- Log/event/side-effect satır referansı
- “nasıl çalışıyor” kısa akış (maks 8 satır)

3) Test/Validation:
- En az 1 pozitif + 1 negatif/duplicate senaryosu
- Otomatik test yoksa: önerilen test dosyası ve test isimleri

4) Zorunlu çıktı başlıkları:
- `Evidence`
- `Diff Summary`
- `Risk Check`
- `Next Action`

Kurallar:
- Soru sorma.
- Varsayım yapma; yalnızca repo çıktısı ve diff ile konuş.
- Diff çok büyükse dosya yolu + ilk 2KB preview + özet metrik ver.

