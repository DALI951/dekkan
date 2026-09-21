<?php
/**
 * DEKKAN API — accounts (register / login / logout / me).
 *
 * POST api/auth.php?action=register   {email, password, shopName}
 * POST api/auth.php?action=login      {email, password}
 * POST api/auth.php?action=logout     {token}  (or Bearer header)
 * GET  api/auth.php?action=me         (Bearer header) → the signed-in user
 *
 * Errors are short codes on purpose: auth.js maps them to AR/EN strings.
 */
require __DIR__ . '/db.php';

$action = $_GET['action'] ?? '';

function dekkan_body(): array
{
    $raw = file_get_contents('php://input');
    $data = json_decode((string)$raw, true);
    return is_array($data) ? $data : [];
}

function dekkan_token_for(int $userId): string
{
    $db  = dekkan_db();
    $raw = bin2hex(random_bytes(32));          // 64 hex chars
    $hash = hash('sha256', $raw);
    $db->prepare(
        'INSERT INTO dekkan_tokens (token_hash, user_id) VALUES (?, ?)'
    )->execute([$hash, $userId]);
    return $raw;
}

function dekkan_user_json(array $u): array
{
    return ['id' => (int)$u['id'], 'email' => $u['email'], 'shopName' => $u['shop_name']];
}

if ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'me') {
    $u = dekkan_require_user();
    dekkan_json(200, ['ok' => true, 'user' => dekkan_user_json($u)]);
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    dekkan_json(405, ['error' => 'method_not_allowed']);
}
$body = dekkan_body();

switch ($action) {
    case 'register':
        $email    = strtolower(trim((string)($body['email'] ?? '')));
        $pass     = (string)($body['password'] ?? '');
        $shopName = trim((string)($body['shopName'] ?? ''));

        if (!filter_var($email, FILTER_VALIDATE_EMAIL) || mb_strlen($email) > 190) {
            dekkan_json(400, ['error' => 'invalid_email']);
        }
        if (strlen($pass) < 6 || strlen($pass) > 200) {
            dekkan_json(400, ['error' => 'short_pass']);
        }
        if (mb_strlen($shopName) < 2 || mb_strlen($shopName) > 120) {
            dekkan_json(400, ['error' => 'short_name']);
        }

        $db = dekkan_db();
        // unique email (belt and braces: the DB also enforces it)
        $st = $db->prepare('SELECT id FROM dekkan_users WHERE email = ?');
        $st->execute([$email]);
        if ($st->fetch()) {
            dekkan_json(409, ['error' => 'email_taken']);
        }

        $db->prepare(
            'INSERT INTO dekkan_users (email, pass_hash, shop_name) VALUES (?, ?, ?)'
        )->execute([$email, password_hash($pass, PASSWORD_DEFAULT), $shopName]);
        $userId = (int)$db->lastInsertId();

        dekkan_json(201, [
            'ok'    => true,
            'token' => dekkan_token_for($userId),
            'user'  => dekkan_user_json(['id' => $userId, 'email' => $email, 'shop_name' => $shopName]),
        ]);
        // no break — dekkan_json exits

    case 'login':
        $email = strtolower(trim((string)($body['email'] ?? '')));
        $pass  = (string)($body['password'] ?? '');

        $db = dekkan_db();
        $st = $db->prepare('SELECT id, email, shop_name, pass_hash FROM dekkan_users WHERE email = ?');
        $st->execute([$email]);
        $u = $st->fetch();
        if (!$u || !password_verify($pass, $u['pass_hash'])) {
            // one message for both cases — never reveal which failed
            dekkan_json(401, ['error' => 'bad_credentials']);
        }

        dekkan_json(200, [
            'ok'    => true,
            'token' => dekkan_token_for((int)$u['id']),
            'user'  => dekkan_user_json($u),
        ]);

    case 'logout':
        $raw = (string)($body['token'] ?? '');
        $hdr = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
        if ($raw === '' && preg_match('/^Bearer\s+([0-9a-f]{64})$/i', $hdr, $m)) {
            $raw = $m[1];
        }
        if (preg_match('/^[0-9a-f]{64}$/i', $raw)) {
            dekkan_db()->prepare('DELETE FROM dekkan_tokens WHERE token_hash = ?')
                ->execute([hash('sha256', $raw)]);
        }
        dekkan_json(200, ['ok' => true]);

    case 'me':
        $u = dekkan_require_user();
        dekkan_json(200, ['ok' => true, 'user' => dekkan_user_json($u)]);

    default:
        dekkan_json(404, ['error' => 'unknown_action']);
}