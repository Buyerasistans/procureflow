import React, { useEffect, useState } from "react";

type User = {
  id: number;
  name: string;
  email: string;
  department_ids: number[];
  job_ids: number[];
};

const API_URL = "/api/v1/users";

const UserList = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [departmentIds, setDepartmentIds] = useState("");
  const [jobIds, setJobIds] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch(API_URL);
      if (res.ok) {
        const data = await res.json();
        setUsers(Array.isArray(data) ? data : [data]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const depIds = departmentIds.split(",").map(Number).filter(Boolean);
    const jIds = jobIds.split(",").map(Number).filter(Boolean);
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, department_ids: depIds, job_ids: jIds }),
    });
    if (res.ok) {
      setName("");
      setEmail("");
      setDepartmentIds("");
      setJobIds("");
      fetchUsers();
    }
  };

  return (
    <div>
      <h2>Personel Listesi</h2>
      <form onSubmit={handleAdd} style={{ marginBottom: 16 }}>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Ad Soyad"
          required
        />
        <input
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="E-posta"
          required
        />
        <input
          value={departmentIds}
          onChange={e => setDepartmentIds(e.target.value)}
          placeholder="Departman ID'leri (virgüllü)"
        />
        <input
          value={jobIds}
          onChange={e => setJobIds(e.target.value)}
          placeholder="İş/Görev ID'leri (virgüllü)"
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
              <th>E-posta</th>
              <th>Departmanlar</th>
              <th>İşler</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id}>
                <td>{user.id}</td>
                <td>{user.name}</td>
                <td>{user.email}</td>
                <td>{user.department_ids.join(", ")}</td>
                <td>{user.job_ids.join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default UserList;
