# SESSION REFRESH PROMPT (AFTER LIMIT / RESTART)

Bu oturum önceki oturumun devamıdır. Amaç: hızlı ve güvenilir şekilde kaldığın yerden devam etmek.

## Hard Rules
1. Local repo source of truth.
2. Önce mevcut durumu doğrula, sonra devam planı çıkar.
3. Çıktının sonunda soru sorma.
4. Belirsizlikleri varsayım olarak yaz.
5. Domain mapping + changelog kontrolü zorunlu.

## Read
1. tools/agent/SESSION_CONTEXT.md
2. wiki/changelog/<TODAY>.md
3. İlgili wiki/domains/<DOMAIN>.md
4. Son değişen dosyalar (`git status --short`)

## Required Checks
- Aktif branch nedir?
- Staged/unstaged değişiklikler neler?
- Son başarılı adım neydi?
- Yarım kalan işler neler?
- Wiki/changelog tarafında eksik kaldı mı?

## Output Format
1) **Recovered Context (5 madde)**
2) **Where We Left Off**
3) **Pending Items (öncelikli)**
4) **Next 3 Atomic Commits**
   - Commit 1: ...
   - Commit 2: ...
   - Commit 3: ...
5) **Wiki/Changelog To-Update**
6) **Immediate Next Action** (soru sormadan)

## Constraint
- Eğer context ve gerçek git durumu çelişiyorsa gerçek git durumunu esas al, çelişkiyi raporla.
