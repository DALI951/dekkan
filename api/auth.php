<?php
/**
 * DEKKAN API â€” accounts (register / login / logout / me).
 *
 * POST api/auth.php?action=register   {email, password, shopName}
 * POST api/auth.php?action=login      {email, password}
 * POST api/auth.php?action=google     {credential}   (the Google ID token â€” verified with Google)
 * POST api/auth.php?action=logout     {token}  (or Bearer header)
 * GET  api/auth.php?action=me         (Bearer header) â†’ the signed-in user
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
    return ['id' => (int)$u['id'], 'email' => $u['email'], 'shopName' => $u['shop_name'], 'role' => $u['role'] ?? 'owner'];
}

// A plain HTTP GET that works whether or not the host has php-curl enabled.
function dekkan_http_get(string $url): ?string
{
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10]);
        $res  = curl_exec($ch);
        $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        return ($code === 200 && is_string($res)) ? $res : null;
    }
    $ctx = stream_context_create(['http' => ['timeout' => 10, 'ignore_errors' => true]]);
    $res = @file_get_contents($url, false, $ctx);
    return is_string($res) ? $res : null;
}

/**
 * Verify a Google Identity Services ID token (JWT) and return its claims, or null.
 * We NEVER trust the token blindly: Google's tokeninfo endpoint does the
 * signature + expiry check, and we still confirm the token was minted for OUR
 * client id and carries a verified email.
 */
function dekkan_verify_google_idtoken(string $idToken, string $clientId): ?array
{
    $res = dekkan_http_get('https://oauth2.googleapis.com/tokeninfo?id_token=' . urlencode($idToken));
    if ($res === null) {
        return null;
    }
    $j = json_decode($res, true);
    if (!is_array($j) || isset($j['error'])) {
        return null;
    }
    if ((string)($j['aud'] ?? '') !== $clientId) {
        return null; // minted for a different app â€” reject
    }
    $iss = (string)($j['iss'] ?? '');
    if ($iss !== 'accounts.google.com' && $iss !== 'https://accounts.google.com') {
        return null;
    }
    $ev = $j['email_verified'] ?? false;
    if ($ev !== true && (string)$ev !== 'true') {
        return null;
    }
    $email = strtolower(trim((string)($j['email'] ?? '')));
    if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        return null;
    }
    return ['email' => $email, 'name' => (string)($j['name'] ?? '')];
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
        // RBAC light (SEC-001): the ROLE is server-owned, never taken from the
        // state blob. First user of a shop is the owner by default; a cashier
        // account cannot touch the owner's lock (enforced on every PUT).
        $role = ($body['role'] ?? 'owner') === 'cashier' ? 'cashier' : 'owner';

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
            'INSERT INTO dekkan_users (email, pass_hash, shop_name, role) VALUES (?, ?, ?, ?)'
        )->execute([$email, password_hash($pass, PASSWORD_DEFAULT), $shopName, $role]);
        $userId = (int)$db->lastInsertId();

        dekkan_json(201, [
            'ok'    => true,
            'token' => dekkan_token_for($userId),
            'user'  => dekkan_user_json(['id' => $userId, 'email' => $email, 'shop_name' => $shopName, 'role' => $role]),
        ]);
        // no break â€” dekkan_json exits

    case 'login':
        $email = strtolower(trim((string)($body['email'] ?? '')));
        $pass  = (string)($body['password'] ?? '');

        $db = dekkan_db();
        $st = $db->prepare('SELECT id, email, shop_name, role, pass_hash FROM dekkan_users WHERE email = ?');
        $st->execute([$email]);
        $u = $st->fetch();
        if (!$u || !password_verify($pass, $u['pass_hash'])) {
            // one message for both cases â€” never reveal which failed
            dekkan_json(401, ['error' => 'bad_credentials']);
        }

        dekkan_json(200, [
            'ok'    => true,
            'token' => dekkan_token_for((int)$u['id']),
            'user'  => dekkan_user_json($u),
        ]);

    case 'google':
        // Sign in with Google. The browser sends the signed ID token Google
        // Identity Services handed it; we ask Google to verify it, then mint our
        // own session token exactly like a normal login.
        $cred = (string)($body['credential'] ?? '');
        if ($cred === '') {
            dekkan_json(400, ['error' => 'invalid_google']);
        }
        $clientId = (string)(dekkan_cfg()['googleClientId'] ?? '');
        if ($clientId === '') {
            dekkan_json(500, ['error' => 'google_not_configured']);
        }
        $claims = dekkan_verify_google_idtoken($cred, $clientId);
        if (!$claims) {
            dekkan_json(401, ['error' => 'invalid_google']);
        }
        $gEmail = $claims['email'];
        $gName  = trim($claims['name']) !== '' ? trim($claims['name']) : explode('@', $gEmail)[0];

        $db = dekkan_db();
        $st = $db->prepare('SELECT id, email, shop_name, role FROM dekkan_users WHERE email = ?');
        $st->execute([$gEmail]);
        $u = $st->fetch();
        if (!$u) {
            // A Google account has no password we know: store an unguessable
            // random hash so a password login for this email can never succeed.
            $db->prepare('INSERT INTO dekkan_users (email, pass_hash, shop_name) VALUES (?, ?, ?)')
                ->execute([$gEmail, password_hash(bin2hex(random_bytes(24)), PASSWORD_DEFAULT), mb_substr($gName, 0, 120)]);
            $uid = (int)$db->lastInsertId();
            $u = ['id' => $uid, 'email' => $gEmail, 'shop_name' => mb_substr($gName, 0, 120)];
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
