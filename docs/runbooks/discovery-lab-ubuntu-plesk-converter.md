# Discovery Lab Ubuntu/Plesk DWG Converter Runbook

Bu runbook, Discovery Lab DWG yükleme akışının Ubuntu + Plesk canlı ortamında da çalışması için gereken ODA File Converter kurulum ve doğrulama adımlarını tarif eder.

## Hedef

- DWG dosyaları sunucuda DXF'e dönüştürülebilsin.
- Uygulama converter yolunu Plesk ortam değişkeninden veya standart Linux kurulum yollarından bulabilsin.
- Kullanıcıya teknik exception gösterilmeden güvenli hata sözleşmesi korunsun.

## Önerilen Canlı Kurulum

ODA File Converter paketi Open Design Alliance tarafından dağıtılır. Lisans ve indirme politikası nedeniyle paketi sunucuya kurulum sırasında kontrollü biçimde taşıyın.

Root erişimi varsa önerilen hedef:

```bash
sudo mkdir -p /opt/oda-file-converter
sudo tar -xf ODAFileConverter_linux_x64.tar.gz -C /opt/oda-file-converter --strip-components=1
sudo chmod +x /opt/oda-file-converter/ODAFileConverter
```

Root erişimi yoksa Plesk domain kullanıcısına ait private dizin kullanılabilir:

```bash
mkdir -p /var/www/vhosts/buyerassistans.com.tr/private/oda-file-converter
tar -xf ODAFileConverter_linux_x64.tar.gz -C /var/www/vhosts/buyerassistans.com.tr/private/oda-file-converter --strip-components=1
chmod +x /var/www/vhosts/buyerassistans.com.tr/private/oda-file-converter/ODAFileConverter
```

## Plesk Ortam Değişkeni

En güvenilir yöntem Plesk Python uygulaması veya servis yöneticisi üzerinden converter yolunu açıkça tanımlamaktır:

```bash
DWG_TO_DXF_CONVERTER_PATH=/opt/oda-file-converter/ODAFileConverter
```

Root erişimi olmayan kurulumda:

```bash
DWG_TO_DXF_CONVERTER_PATH=/var/www/vhosts/buyerassistans.com.tr/private/oda-file-converter/ODAFileConverter
```

Geriye dönük uyumluluk için `ODA_CONVERTER_PATH` de desteklenir, ancak yeni kurulumlarda `DWG_TO_DXF_CONVERTER_PATH` tercih edilir.

## Uygulama Resolver Sırası

Backend converter'ı şu sırayla arar:

1. `DWG_TO_DXF_CONVERTER_PATH`
2. `ODA_CONVERTER_PATH`
3. `PATH` içindeki `ODAFileConverter` veya `TeighaFileConverter`
4. Windows standart ODA kurulum dizinleri
5. Ubuntu/Linux standart yolları:
   - `/usr/local/bin/ODAFileConverter`
   - `/usr/bin/ODAFileConverter`
   - `/opt/ODA/ODAFileConverter/ODAFileConverter`
   - `/opt/oda-file-converter/ODAFileConverter`
   - `/opt/ODA/*/ODAFileConverter`
   - `/opt/oda-file-converter/*/ODAFileConverter`

Plesk canlı ortamında absolute path döndüren health yanıtı verilmez; sadece kaynak tipi ve executable adı görünür.

## Restart

Ortam değişkeni veya binary kurulumu sonrası backend process yeniden başlatılmalıdır.

Plesk üzerinden:

1. Domain > Python uygulaması ekranına girin.
2. Environment variable değerini ekleyin veya güncelleyin.
3. Uygulamayı restart edin.

Systemd kullanılıyorsa:

```bash
sudo systemctl restart procureflow-api
```

## Doğrulama

Sunucuda backend virtualenv aktifken:

```bash
python -c "from api.services.cad_convert import get_dwg_converter_diagnostics; print(get_dwg_converter_diagnostics())"
```

Beklenen:

```text
{'converter_found': True, 'resolver_source': 'env:DWG_TO_DXF_CONVERTER_PATH', 'executable_name': 'ODAFileConverter', 'reason': None}
```

Admin health endpoint:

```http
GET /api/v1/ai-lab/health/converter
```

Beklenen güvenli yanıt:

```json
{
  "converter_found": true,
  "resolver_source": "env:DWG_TO_DXF_CONVERTER_PATH",
  "executable_name": "ODAFileConverter",
  "request_id": "..."
}
```

## Release Gate

Canlıya çıkmadan önce:

```bash
PYTEST_NO_DROP=1 python -m pytest -m nodrop tests/test_ai_lab_router.py
python -m py_compile api/services/cad_convert.py tests/test_ai_lab_router.py
git diff --check
```

Frontend gate için Windows runbook'taki Discovery Lab release gate komutları korunur. Linux CI/CD tarafında eşdeğer npm komutları çalıştırılmalıdır.

## Rollback

Kod rollback:

```bash
git revert <converter-linux-support-commit-sha>
```

Operasyonel rollback:

1. Plesk'ten `DWG_TO_DXF_CONVERTER_PATH` ortam değişkenini kaldırın veya eski değere döndürün.
2. Backend'i restart edin.
3. Health endpoint'te `converter_found` durumunu tekrar kontrol edin.

Binary kaldırma gerekiyorsa önce uygulamanın DXF-only fallback davranışını doğrulayın; canlıda yıkıcı silme işlemini bakım penceresi dışında yapmayın.
