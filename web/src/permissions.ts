// Yetkisi olmayan işlemlerin arayüzde gizlenmesi için örnek React yardımcı fonksiyonu
export function hasPermission(
  userPermissions: string[],
  requiredPermission: string,
) {
  return userPermissions.includes(requiredPermission);
}

// Kullanım örneği:
// {hasPermission(currentUser.permissions, 'department:edit') && <button>Düzenle</button>}
