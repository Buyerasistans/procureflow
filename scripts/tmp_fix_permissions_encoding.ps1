$path = "web/src/auth/permissions.ts"
$text = Get-Content -Path $path -Raw -Encoding UTF8

$roleLabelsPattern = 'const roleLabels: Record<string, string> = \{[\s\S]*?\};'
$roleLabelsBlock = @'
const roleLabels: Record<string, string> = {
  super_admin: "Süper Admin",
  admin: "Admin",
  tenant_owner: "Tenant Sahibi",
  tenant_admin: "Tenant Admin",
  tenant_member: "Tenant Üyesi",
  platform_support: "Platform Destek",
  platform_operator: "Platform Operasyon",
  satinalma_direktoru: "Satın Alma Direktörü",
  satinalma_yoneticisi: "Satın Alma Yöneticisi",
  satinalma_uzmani: "Satın Alma Uzmanı",
  satinalmaci: "Satın Almacı",
  manager: "Yönetici",
  buyer: "Satın Alma",
  employee: "Çalışan",
  department_manager: "Departman Yöneticisi",
  company_manager: "Şirket Yöneticisi",
  supplier: "Tedarikçi",
  supplier_admin: "Tedarikçi Yöneticisi",
  supplier_user: "Tedarikçi Kullanıcısı",
  channel_owner: "Kanal Hesap Sahibi",
  channel_agent: "Kanal Temsilcisi",
  user: "Kullanıcı",
};
'@
$text = [regex]::Replace($text, $roleLabelsPattern, $roleLabelsBlock)

$roleIconsPattern = 'const roleIcons: Record<string, string> = \{[\s\S]*?\};'
$roleIconsBlock = @'
const roleIcons: Record<string, string> = {
  super_admin: "🛡️",
  admin: "🛡️",
  satinalma_direktoru: "🧭",
  satinalma_yoneticisi: "📌",
  satinalma_uzmani: "📊",
  satinalmaci: "🧾",
  user: "👤",
};
'@
$text = [regex]::Replace($text, $roleIconsPattern, $roleIconsBlock)

$normalizePattern = 'export function normalizeRoleKey\(value\?: string \| null\): string \{[\s\S]*?\n\}'
$normalizeBlock = @'
export function normalizeRoleKey(value?: string | null): string {
  if (!value) return "";
  return value
    .toLowerCase()
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/\./g, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}
'@
$text = [regex]::Replace($text, $normalizePattern, $normalizeBlock)

$text = [regex]::Replace(
  $text,
  'return roleIcons\[normalized\] \|\| .*?;',
  'return roleIcons[normalized] || "👤";'
)
$text = [regex]::Replace(
  $text,
  'return getRoleLabel\(normalizedRole\(user\)\) \|\| .*?;',
  'return getRoleLabel(normalizedRole(user)) || "Kullanıcı";'
)

Set-Content -Path $path -Value $text -Encoding UTF8
Write-Host "permissions.ts encoding blocks fixed."
$ErrorActionPreference = "Stop"
[Console]::InputEncoding = [Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$PSDefaultParameterValues['Out-File:Encoding'] = 'utf8'
