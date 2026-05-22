from __future__ import annotations

import json
import os
from importlib import import_module
from typing import Any


def _build_fallback_ai_report(metadata_json: dict[str, Any]) -> dict[str, Any]:
    katmanlar = metadata_json.get("katmanlar") or []
    bloklar = metadata_json.get("bloklar") or []

    has_islak_duvar = any(
        "ISLAK" in str(item.get("layer_name", "")).upper() for item in katmanlar
    )
    has_zemin_seramik = any(
        "ZEMIN_SERAMIK" in str(item.get("layer_name", "")).upper() for item in katmanlar
    )
    has_pizza_firini = any(
        "FIRIN" in str(item.get("block_name", "")).upper() for item in bloklar
    )
    has_tesisat = any(
        token in str(item.get("layer_name", "")).upper()
        for item in katmanlar
        for token in ("TESISAT", "ELEKTRIK", "GAZ")
    )

    kritik_uyarilar: list[dict[str, str]] = []
    karar_destek_sorulari: list[dict[str, Any]] = []
    recete_onerileri: list[dict[str, str]] = []

    if has_islak_duvar and not has_zemin_seramik:
        kritik_uyarilar.append(
            {
                "baslik": "Islak hacim zemin tamamlama eksigi",
                "mesaj": "PF_DUVAR_ISLAK tespit edildi ancak tamamlayici zemin seramik veya su yalitimi katmani bulunmadi.",
            }
        )
        karar_destek_sorulari.append(
            {
                "id": 1,
                "soru": "Islak hacim icin zemin seramik veya su yalitimi katmani ekleyelim mi?",
                "neden": "Mutfak ve islak hacimlerde teknik butunluk icin tamamlayici zemin katmani gerekir.",
            }
        )
        recete_onerileri.append(
            {
                "kalem": "Cimento esasli su yalitimi",
                "miktar_etkisi": "Duvar/zemin detayina gore eklenecek",
            }
        )

    if has_pizza_firini and not has_tesisat:
        kritik_uyarilar.append(
            {
                "baslik": "Firin icin tesisat kontrolu gerekli",
                "mesaj": "Firin blogu bulundu ancak gaz veya elektrik tesisati katmani algilanmadi.",
            }
        )
        karar_destek_sorulari.append(
            {
                "id": len(karar_destek_sorulari) + 1,
                "soru": "Pizza firini icin gaz veya elektrik tesisati katmanlarini ekleyelim mi?",
                "neden": "Restoran standartlarinda firin ekipmani altyapi olmadan satin alma asamasina gecmemeli.",
            }
        )

    if any("DUVAR" in str(item.get("layer_name", "")).upper() for item in katmanlar):
        recete_onerileri.append(
            {
                "kalem": "Astar ve boya tamamlama kalemleri",
                "miktar_etkisi": "Duvar metrajina gore hesaplanacak",
            }
        )

    return {
        "teknik_analiz": (
            f"{len(katmanlar)} PF katmani ve {len(bloklar)} PF blok grubu analiz edildi. "
            "Harici AI yaniti alinmazsa kural bazli teknik denetim raporu kullanilir."
        ),
        "kritik_uyarilar": kritik_uyarilar,
        "karar_destek_sorulari": karar_destek_sorulari,
        "recete_onerileri": recete_onerileri,
    }


class AIKesifAsistani:
    def __init__(self, api_key: str | None = None, model: str = "gpt-4o-mini"):
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        self.model = model
        self.master_prompt = (
            "Sen ProcureFlow platformunun kidemli teknik denetcisisin. "
            "Gelen CAD metadata ozetini analiz eder, teknik tutarsizliklari bulur, "
            "gereken karar destek sorularini ve recete onerilerini JSON olarak donersin."
        )

    def _try_openai_chat_completion(
        self, metadata_json: dict[str, Any]
    ) -> dict[str, Any] | None:
        if not self.api_key:
            return None

        try:
            openai = import_module("openai")
        except ImportError:
            return None

        payload = json.dumps(metadata_json, ensure_ascii=False)

        try:
            if hasattr(openai, "OpenAI"):
                client = openai.OpenAI(api_key=self.api_key)
                response = client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": self.master_prompt},
                        {
                            "role": "user",
                            "content": f"Su verileri denetle ve yalnizca JSON don: {payload}",
                        },
                    ],
                    response_format={"type": "json_object"},
                )
                content = response.choices[0].message.content
            else:
                openai.api_key = self.api_key
                response = openai.ChatCompletion.create(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": self.master_prompt},
                        {
                            "role": "user",
                            "content": f"Su verileri denetle ve yalnizca JSON don: {payload}",
                        },
                    ],
                    response_format={"type": "json_object"},
                )
                content = response.choices[0].message.content
        except Exception:
            return None

        if not content:
            return None

        try:
            return json.loads(content)
        except json.JSONDecodeError:
            return None

    async def analiz_et(self, metadata_json: dict[str, Any]) -> dict[str, Any]:
        llm_result = self._try_openai_chat_completion(metadata_json)
        if llm_result:
            return llm_result
        return _build_fallback_ai_report(metadata_json)


AIKeşifAsistani = AIKesifAsistani
