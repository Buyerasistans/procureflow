DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM information_schema.tables
		WHERE table_schema = 'public' AND table_name = 'discovery_lab_sessions'
	) THEN
		ALTER TABLE discovery_lab_sessions
		ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER;

		ALTER TABLE discovery_lab_sessions
		ADD COLUMN IF NOT EXISTS created_by_email VARCHAR(255);

		ALTER TABLE discovery_lab_sessions
		ADD COLUMN IF NOT EXISTS selected_project_id INTEGER;

		ALTER TABLE discovery_lab_sessions
		ADD COLUMN IF NOT EXISTS selected_project_name VARCHAR(255);

		CREATE INDEX IF NOT EXISTS ix_discovery_lab_sessions_created_by_user_id
		ON discovery_lab_sessions (created_by_user_id);

		CREATE INDEX IF NOT EXISTS ix_discovery_lab_sessions_selected_project_id
		ON discovery_lab_sessions (selected_project_id);
	END IF;
END $$;