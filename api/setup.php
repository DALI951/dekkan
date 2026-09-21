<?php
/**
 * DEKKAN API — one-shot schema creation.
 *
 * Usage:  https://.../dekkan/api/setup.php?key=SETUP_KEY
 * Run it once after deploying to the server, then DELETE this file
 * (or at least rotate setupKey in config.php). Tables are idempotent
 * (IF NOT EXISTS) so re-running is harmless.
 */
require __DIR__ . '/db.php';

$key = $_GET['key'] ?? '';
$cfg = dekkan_cfg();
if (!hash_equals((string)$cfg['setupKey'], (string)$key)) {
    dekkan_json(403, ['error' => 'bad_setup_key']);
}

$sql = <<<'SQL'
CREATE TABLE IF NOT EXISTS dekkan_users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  email VARCHAR(190) NOT NULL,
  pass_hash VARCHAR(255) NOT NULL,
  shop_name VARCHAR(120) NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS dekkan_tokens (
  token_hash CHAR(64) NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (token_hash),
  KEY idx_tokens_user (user_id),
  CONSTRAINT fk_tokens_user FOREIGN KEY (user_id)
    REFERENCES dekkan_users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS dekkan_state (
  user_id INT UNSIGNED NOT NULL,
  data MEDIUMTEXT NOT NULL,
  version INT UNSIGNED NOT NULL DEFAULT 1,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  CONSTRAINT fk_state_user FOREIGN KEY (user_id)
    REFERENCES dekkan_users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
SQL;

try {
    $db = dekkan_db();
    $db->exec($sql);
    dekkan_json(200, ['ok' => true, 'tables' => ['dekkan_users', 'dekkan_tokens', 'dekkan_state']]);
} catch (Throwable $e) {
    dekkan_json(500, ['error' => 'setup_failed', 'detail' => $e->getMessage()]);
}