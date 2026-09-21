<?php
/**
 * DEKKAN API — PDO bootstrap.
 */
function dekkan_db(): PDO
{
    static $pdo = null;
    if ($pdo) {
        return $pdo;
    }
    $c = require __DIR__ . '/config.php';
    $pdo = new PDO(
        'mysql:host=' . $c['db']['host'] . ';dbname=' . $c['db']['name'] . ';charset=utf8mb4',
        $c['db']['user'],
        $c['db']['pass'],
        [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]
    );
    return $pdo;
}

function dekkan_cfg(): array
{
    return require __DIR__ . '/config.php';
}

function dekkan_json(int $status, array $payload): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload);
    exit;
}

/**
 * Resolve the Bearer token (or ?token=) to a user row, or die 401.
 *
 * @return array{id:int,email:string,shop_name:string}
 */
function dekkan_require_user(): array
{
    $raw = null;
    $hdr = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (preg_match('/^Bearer\s+([0-9a-f]{64})$/i', $hdr, $m)) {
        $raw = $m[1];
    } elseif (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        // Apache sometimes strips the header into this one
        if (preg_match('/^Bearer\s+([0-9a-f]{64})$/i', $_SERVER['REDIRECT_HTTP_AUTHORIZATION'], $m)) {
            $raw = $m[1];
        }
    }
    if (!$raw && isset($_GET['token'])) {
        $raw = preg_match('/^[0-9a-f]{64}$/i', $_GET['token']) ? $_GET['token'] : null;
    }
    if (!$raw) {
        dekkan_json(401, ['error' => 'invalid_token']);
    }
    $hash = hash('sha256', $raw);
    $db = dekkan_db();
    $st = $db->prepare(
        'SELECT u.id, u.email, u.shop_name FROM dekkan_tokens t
         JOIN dekkan_users u ON u.id = t.user_id
         WHERE t.token_hash = ?'
    );
    $st->execute([$hash]);
    $user = $st->fetch();
    if (!$user) {
        dekkan_json(401, ['error' => 'invalid_token']);
    }
    $db->prepare('UPDATE dekkan_tokens SET last_used = NOW() WHERE token_hash = ?')->execute([$hash]);
    return $user;
}