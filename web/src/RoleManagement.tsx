import React, { useEffect, useState } from "react";

type Role = {
  id: number;
  name: string;
  permissions: string[];
};

const API_URL = "/api/v1/roles";

const RoleManagement = () => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [name, setName] = useState("");
  const [permissions, setPermissions] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    setLoading(true);
    try {
      const res = await fetch(API_URL);
      if (res.ok) {
        const data = await res.json();
        setRoles(Array.isArray(data) ? data : [data]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const perms = permissions.split(",").map(p => p.trim()).filter(Boolean);
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, permissions: perms }),
    });
    if (res.ok) {
      setName("");
      setPermissions("");
      fetchRoles();
    }
  };

  return (
    <div>
      <h2>Rol ve Yetki Yönetimi</h2>
      <form onSubmit={handleAdd} style={{ marginBottom: 16 }}>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Rol Adı"
          required
        />
        <input
          value={permissions}
          onChange={e => setPermissions(e.target.value)}
          placeholder="Yetkiler (virgüllü)"
        />
        <button type="submit">Ekle</button>
      </form>
      {loading ? (
        <div>Yükleniyor...</div>
      ) : (
        <table border={1} cellPadding={8}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Ad</th>
              <th>Yetkiler</th>
            </tr>
          </thead>
          <tbody>
            {roles.map(role => (
              <tr key={role.id}>
                <td>{role.id}</td>
                <td>{role.name}</td>
                <td>{role.permissions.join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default RoleManagement;
