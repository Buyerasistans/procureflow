-- Departmanlar arası işbirliği ve onay zinciri için örnek migration (PostgreSQL)

CREATE TABLE IF NOT EXISTS department_collaboration (
    id SERIAL PRIMARY KEY,
    department_id INTEGER REFERENCES department(id),
    collaborator_department_id INTEGER REFERENCES department(id),
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Onay zinciri için örnek tablo
CREATE TABLE IF NOT EXISTS approval_chain (
    id SERIAL PRIMARY KEY,
    department_id INTEGER REFERENCES department(id),
    step_order INTEGER NOT NULL,
    approver_department_id INTEGER REFERENCES department(id),
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Örnek veri:
-- INSERT INTO department_collaboration (department_id, collaborator_department_id, description) VALUES (1, 2, 'Teknik ve Endirek ortak süreç');
-- INSERT INTO approval_chain (department_id, step_order, approver_department_id, description) VALUES (1, 1, 2, 'İlk onay Endirek Satın Alma');
