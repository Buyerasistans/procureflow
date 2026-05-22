import React, { useEffect, useState } from "react";

type Department = {
  id: number;
  name: string;
  description: string;
  is_active: boolean;
  settings: Record<string, unknown>;
};

const API_URL = "/api/v1/departments";

const DepartmentList = () => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    setLoading(true);
    try {
      const res = await fetch(API_URL);
      if (res.ok) {
        const data = await res.json();
        setDepartments(Array.isArray(data) ? data : [data]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description, is_active: true, settings: {} }),
    });
    if (res.ok) {
      setName("");
      setDescription("");
      fetchDepartments();
    }
  };

  return (
    <div>
      <h2>Departman Listesi</h2>
      <form onSubmit={handleAdd} style={{ marginBottom: 16 }}>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Departman Adı"
          required
        />
        <input
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Açıklama"
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
              <th>Açıklama</th>
              <th>Aktif mi?</th>
            </tr>
          </thead>
          <tbody>
            {departments.map(dep => (
              <tr key={dep.id}>
                <td>{dep.id}</td>
                <td>{dep.name}</td>
                <td>{dep.description}</td>
                <td>{dep.is_active ? "Evet" : "Hayır"}</td>
                <td>
                  {dep.is_active && (
                    <button onClick={async () => {
                      await fetch(`/api/v1/departments/${dep.id}/archive`, { method: "POST" });
                      fetchDepartments();
                    }}>
                      Arşivle
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default DepartmentList;
