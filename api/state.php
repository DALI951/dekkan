<?php
/**
 * DEKKAN API — the owner's whole shop state (one JSON blob per user).
 *
 *   GET api/state.php   (Bearer token) → 200 the stored JSON, or 404 no_state
 *   PUT api/state.php   (Bearer token, body = the raw state JSON) → 200
 *
 * Since P0-5 (SAL-004/TEN-002/NFR-002) the server NO LONGER stores the blob
 * verbatim: a pushed state must pass dekkan_state_problems() (the exact port
 * of core's stateProblems) or the write is rejected with 409 and nothing is
 * persisted. The blob ownership check is dekkan_require_user() — a token can
 * only ever touch its own user's row.
 */
require __DIR__ . '/db.php';

$user = dekkan_require_user();
$db   = dekkan_db();


/**
 * Integrity checks on a decoded state blob — the PHP port of
 * core/core.ts stateProblems(). Keep the two in lockstep:
 *   - stock counter must equal the movement ledger, per product
 *   - sale entry amounts must match their bill net
 *   - unknown entry kinds / duplicate ids / malformed movements rejected
 *   - debts well-formed (paid <= total), pinHash stays a string
 *   - version must be current (4)
 * Returns an array of human-readable problems (empty = healthy).
 */
function dekkan_state_problems($s) {
    $out = [];
    if (!is_array($s)) return ['state is not an object'];
    if (!isset($s['version']) || $s['version'] !== 4) $out[] = 'state.version must be 4';
    if (!isset($s['shop']['name']) || !is_string($s['shop']['name'])) $out[] = 'shop.name missing';
    if (!isset($s['products']) || !is_array($s['products'])) $out[] = 'products must be an array';
    if (!isset($s['movements']) || !is_array($s['movements'])) $out[] = 'movements must be an array';
    if (!isset($s['employees']) || !is_array($s['employees'])) $out[] = 'employees must be an array';
    if (!isset($s['debts']) || !is_array($s['debts'])) $out[] = 'debts must be an array';

    if (isset($s['settings']['pinHash']) && !is_string($s['settings']['pinHash'])) $out[] = 'pinHash must be a string';

    $kinds = ['sale' => 1, 'refund' => 1, 'expense' => 1, 'income' => 1, 'check' => 1, 'buy' => 1, 'debt-pay' => 1];
    $seen = [];
    $entries = (isset($s['day']['entries']) && is_array($s['day']['entries'])) ? $s['day']['entries'] : [];
    foreach ($entries as $e) {
        if (!is_array($e)) { $out[] = 'day has a non-object entry'; continue; }
        $id = isset($e['id']) ? (string)$e['id'] : '';
        if ($id === '') { $out[] = 'entry without an id'; continue; }
        if (isset($seen[$id])) { $out[] = 'duplicate entry id: ' . $id; } else { $seen[$id] = 1; }
        if (!isset($kinds[$e['kind']])) $out[] = 'unknown entry kind: ' . (isset($e['kind']) ? (string)$e['kind'] : '?');
        if (!isset($e['amount']) || !is_numeric($e['amount'])) $out[] = 'entry amount not numeric: ' . $id;
        if (isset($e['bill']) && is_array($e['bill'])) {
            if (!isset($e['bill']['net']) || !is_numeric($e['bill']['net']) || $e['bill']['net'] < 0) $out[] = 'bill.net invalid: ' . $id;
            if (($e['kind'] ?? '') === 'sale' && abs((float)$e['bill']['net'] - abs((float)$e['amount'])) > 0.001) $out[] = 'sale amount != bill.net: ' . $id;
        }
    }

    foreach ($s['debts'] as $d) {
        if (!is_array($d)) { $out[] = 'debts holds a non-object'; continue; }
        if (isset($d['total'], $d['paid']) && is_numeric($d['total']) && is_numeric($d['paid'])
            && (float)$d['paid'] > (float)$d['total'] + 0.001) {
            $out[] = 'debt paid exceeds total: ' . (isset($d['name']) ? (string)$d['name'] : '?');
        }
    }

    $byId = [];
    foreach ($s['movements'] as $m) {
        if (!is_array($m) || !isset($m['productId']) || !isset($m['qty']) || !is_numeric($m['qty'])) {
            $out[] = 'malformed movement';
            continue;
        }
        $byId[$m['productId']] = ($byId[$m['productId']] ?? 0) + (float)$m['qty'];
    }
    foreach ($s['products'] as $p) {
        if (!is_array($p) || !isset($p['stock']) || !is_numeric($p['stock'])) { $out[] = 'product stock invalid'; continue; }
        if ((float)$p['stock'] < 0) $out[] = 'negative stock: ' . (isset($p['name']) ? (string)$p['name'] : '?');
        $ledger = $byId[$p['id']] ?? 0;
        if ((float)$p['stock'] != $ledger) $out[] = 'stock counter != movement ledger: ' . (isset($p['name']) ? (string)$p['name'] : '?');
    }
    return $out;
}


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
    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        dekkan_json(400, ['error' => 'invalid_json']);
    }

    // P0-5: validate BEFORE write — forged blobs get 409 and nothing is stored
    $problems = dekkan_state_problems($decoded);
    if (count($problems) > 0) {
        dekkan_json(409, ['error' => 'state_rejected', 'problems' => array_slice($problems, 0, 10)]);
    }

    $db->prepare(
        'INSERT INTO dekkan_state (user_id, data, version)
         VALUES (?, ?, 1)
         ON DUPLICATE KEY UPDATE data = VALUES(data), version = version + 1'
    )->execute([$user['id'], $raw]);

    dekkan_json(200, ['ok' => true]);
}

dekkan_json(405, ['error' => 'method_not_allowed']);