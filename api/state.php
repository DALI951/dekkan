<?php
/**
 * DEKKAN API — the owner's whole shop state (one JSON blob per user).
 *
 *   GET api/state.php   (Bearer token) → 200 the stored JSON, or 404 no_state
 *   PUT api/state.php   (Bearer token, body = the raw state JSON) → 200
 *
 * The state is stored VERBATIM as MEDIUMTEXT — the app is the single owner
 * of its schema; the server just keeps the blob safe per user.
 */
require __DIR__ . '/db.php';

$user = dekkan_require_user();
$db   = dekkan_db();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $st = $db->prepare('SELECT data FROM dekkan_state WHERE user_id = ?');
    $st->execute([$user['id']]);
    $row = $st->fetch();
    if (!$row) {
        dekkan_json(404, ['error' => 'no_state']);
    }
    http_response_code(200);
    header('Content-Type: application/json; charset=utf-8');
    echo $row['data']; // already JSON — send it raw
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        dekkan_json(400, ['error' => 'empty_state']);
    }
    $cfg = dekkan_cfg();
    if (strlen($raw) > (int)$cfg['stateMaxBytes']) {
        dekkan_json(413, ['error' => 'state_too_large']);
    }
    if (json_decode($raw) === null) {
        dekkan_json(400, ['error' => 'invalid_json']);
    }

    $db->prepare(
        'INSERT INTO dekkan_state (user_id, data, version)
         VALUES (?, ?, 1)
         ON DUPLICATE KEY UPDATE data = VALUES(data), version = version + 1'
    )->execute([$user['id'], $raw]);

    dekkan_json(200, ['ok' => true]);
}

dekkan_json(405, ['error' => 'method_not_allowed']);