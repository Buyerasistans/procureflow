-- Departman içi roller için enum ve ilişki tablosu (örnek PostgreSQL migration)

-- Enum tanımı (isteğe bağlı, eğer ORM destekliyorsa):
DO $$ BEGIN
    CREATE TYPE department_role_type AS ENUM ('yonetici', 'satin_alimci', 'onayci');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Departman içi rol tablosu:
CREATE TABLE IF NOT EXISTS department_role (
    id SERIAL PRIMARY KEY,
    department_id INTEGER REFERENCES department(id),
    user_id INTEGER REFERENCES "user"(id),
    role department_role_type NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Örnek veri:
-- INSERT INTO department_role (department_id, user_id, role) VALUES (1, 2, 'yonetici');
