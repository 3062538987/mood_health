CREATE TABLE knowledge_folders (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(80) NOT NULL,
  name VARCHAR(120) NOT NULL,
  description VARCHAR(500) NULL,
  is_builtin TINYINT(1) NOT NULL DEFAULT 0,
  owner_user_id INT UNSIGNED NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  UNIQUE KEY uk_knowledge_folders_slug (slug),
  KEY idx_knowledge_folders_owner (owner_user_id),
  CONSTRAINT fk_knowledge_folders_owner FOREIGN KEY (owner_user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT chk_knowledge_folders_builtin_owner CHECK (
    (is_builtin = 1 AND owner_user_id IS NULL) OR (is_builtin = 0 AND owner_user_id IS NOT NULL)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE knowledge_resources (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  folder_id BIGINT UNSIGNED NOT NULL,
  owner_user_id INT UNSIGNED NULL,
  slug VARCHAR(120) NULL,
  title VARCHAR(200) NOT NULL,
  summary TEXT NOT NULL,
  resource_type VARCHAR(24) NOT NULL,
  source_url VARCHAR(1000) NULL,
  storage_key VARCHAR(500) NULL,
  license_code VARCHAR(80) NOT NULL,
  content_hash CHAR(64) NULL,
  ingestion_status VARCHAR(24) NOT NULL DEFAULT 'pending',
  ingestion_error_code VARCHAR(80) NULL,
  reviewed_at DATE NULL,
  is_builtin TINYINT(1) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  UNIQUE KEY uk_knowledge_resources_slug (slug),
  KEY idx_knowledge_resources_folder_active (folder_id, is_active, created_at),
  KEY idx_knowledge_resources_owner (owner_user_id),
  KEY idx_knowledge_resources_ingestion (ingestion_status),
  CONSTRAINT fk_knowledge_resources_folder FOREIGN KEY (folder_id) REFERENCES knowledge_folders (id) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT fk_knowledge_resources_owner FOREIGN KEY (owner_user_id) REFERENCES users (id) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT chk_knowledge_resources_type CHECK (resource_type IN ('article', 'document', 'link', 'video')),
  CONSTRAINT chk_knowledge_resources_ingestion CHECK (ingestion_status IN ('pending', 'processing', 'ready', 'failed'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE knowledge_resource_versions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  resource_id BIGINT UNSIGNED NOT NULL,
  version_number INT UNSIGNED NOT NULL,
  content_text MEDIUMTEXT NULL,
  storage_key VARCHAR(500) NULL,
  content_hash CHAR(64) NOT NULL,
  created_by_user_id INT UNSIGNED NULL,
  created_at DATETIME(3) NOT NULL,
  UNIQUE KEY uk_knowledge_resource_versions_number (resource_id, version_number),
  CONSTRAINT fk_knowledge_resource_versions_resource FOREIGN KEY (resource_id) REFERENCES knowledge_resources (id) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT fk_knowledge_resource_versions_creator FOREIGN KEY (created_by_user_id) REFERENCES users (id) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE knowledge_favorites (
  user_id INT UNSIGNED NOT NULL,
  resource_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (user_id, resource_id),
  KEY idx_knowledge_favorites_resource (resource_id),
  CONSTRAINT fk_knowledge_favorites_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT fk_knowledge_favorites_resource FOREIGN KEY (resource_id) REFERENCES knowledge_resources (id) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE knowledge_ingestion_jobs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  resource_id BIGINT UNSIGNED NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'pending',
  attempt_count SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  error_code VARCHAR(80) NULL,
  started_at DATETIME(3) NULL,
  finished_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  KEY idx_knowledge_ingestion_jobs_status (status, created_at),
  KEY idx_knowledge_ingestion_jobs_resource (resource_id, created_at),
  CONSTRAINT fk_knowledge_ingestion_jobs_resource FOREIGN KEY (resource_id) REFERENCES knowledge_resources (id) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT chk_knowledge_ingestion_jobs_status CHECK (status IN ('pending', 'processing', 'succeeded', 'failed'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
