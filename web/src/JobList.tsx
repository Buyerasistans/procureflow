import React, { useEffect, useState } from "react";

type Job = {
  id: number;
  department_id: number;
  name: string;
  description: string;
  is_active: boolean;
};

const API_URL = "/api/v1/jobs";

const JobList = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [departmentId, setDepartmentId] = useState(1); // Örnek: 1. departman
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const res = await fetch(API_URL);
      if (res.ok) {
        const data = await res.json();
        setJobs(Array.isArray(data) ? data : [data]);
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
      body: JSON.stringify({ department_id: departmentId, name, description, is_active: true }),
    });
    if (res.ok) {
      setName("");
      setDescription("");
      fetchJobs();
    }
  };

  return (
    <div>
      <h2>İş/Görev Listesi</h2>
      <form onSubmit={handleAdd} style={{ marginBottom: 16 }}>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="İş/Görev Adı"
          required
        />
        <input
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Açıklama"
        />
        <input
          type="number"
          value={departmentId}
          onChange={e => setDepartmentId(Number(e.target.value))}
          placeholder="Departman ID"
          min={1}
          required
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
              <th>Departman ID</th>
              <th>Ad</th>
              <th>Açıklama</th>
              <th>Aktif mi?</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map(job => (
              <tr key={job.id}>
                <td>{job.id}</td>
                <td>{job.department_id}</td>
                <td>{job.name}</td>
                <td>{job.description}</td>
                <td>{job.is_active ? "Evet" : "Hayır"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default JobList;
