---
title: ADR-0001 Hybrid Memory Model
owned_by: platform
last_verified_at: 2026-05-21
confidence: 0.93
stale_after_days: 30
source_files:
  - docs/wiki_schema.md
  - docs/llm-memory-workflow.md
  - docs/mimari-kurallar.md
---

# ADR-0001: Hybrid Memory Model (Canonical Docs + LLM Wiki + Evidence + MemoryOps)

## Status
Accepted

## Context
Büyük kod tabanında LLM araçları seans bazlı bağlam kaybı yaşıyor. Her seferinde tüm kodu okutmak maliyetli ve riskli.

## Decision
Aşağıdaki hibrit model uygulanacak:
1. Canonical Docs (`docs/*`)
2. LLM Wiki (`wiki/*`)
3. Code Evidence (source dosya doğrulama)
4. MemoryOps (ingest/lint/changelog)

## Consequences
### Pozitif
- Daha hızlı planlama
- Düşük token maliyeti
- Artan şeffaflık

### Negatif
- Ek bakım yükü
- Wiki stale kalırsa yanlış güven

## Guardrails
- source_files zorunlu
- stale kontrolü zorunlu
- kod değiştiyse wiki güncellemesi zorunlu
