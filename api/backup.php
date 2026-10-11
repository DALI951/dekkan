<?php
/**
 * DEKKAN API — AUTOMATED ENCRYPTED MYSQL DUMP (P0-10 leftover, NFR-012 / CFG-015).
 *
 * Dumps dekkan_* tables, gzips them, encrypts with AES-256-CBC, writes a
 * timestamped file under api/backups/ and prunes old ones (keep N).
 *
 * WHY encrypted: the dump contains every shop's state blob (sales, debts,
 * customer names) + user auth rows. The backup folder lives inside the
 * web-accessible tree on a shared host, so the file is useless to anyone
 * without the key (openssl is standard on every PHP host; mysqldump often
 * is not).
 *
 * HOW TO RUN (both paths produce the same file):
 *   cron / CLI:   php api/backup.php
 *   web cron (e.g. cron-job.org):  https://host/dekkan/api/backup.php?run=BACKUP_RUN_KEY
 *
 * Config (api/config.php):
 *   'backupKey'   => 64 hex chars  (32 bytes) — the AES key. UNIQUE, never shared.
 *   'backupRunKey'=> a long random string — the URL secret for the web-cron path.
 *   'backupKeep'  => number of dumps to keep (default 14 = two weeks daily).
 *
 * Restore: see docs/restore-drill.md (server section).
 */

require __DIR__ . '/db.php';

// --- only CLI or someone holding the run key may dump ---
$cfg = dekkan_cfg();
$isCli = PHP_SAPI === 'cli';
$ok = $isCli || (isset($_GET['run']) && is_string($_GET['run']) && !empty($cfg['backupRunKey'])
    && hash_equals($cfg['backupRunKey'], $_GET['run']));
if (!$ok) {
    http_response_code(403);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'backup_forbidden']);
    exit(1);
}

function dekkan_backup_fail(string $msg): void
{
    file_put_contents(__DIR__ . '/backups/backup.log', 'FAIL ' . date('c') . ' ' . $msg . "\n", FILE_APPEND);
    fwrite(STDERR ?? fopen('php://stderr', 'w'), 'backup FAILED: ' . $msg . "\n");
    exit(1);
}

$keyHex = $cfg['backupKey'] ?? '';
if (!is_string($keyHex) || !preg_match('/^[0-9a-f]{64}$/', $keyHex)) {
    dekkan_backup_fail('config.php needs a backupKey (64 hex chars)');
}
$keep = (int)($cfg['backupKeep'] ?? 14);
if ($keep < 1) {
    $keep = 14;
}

$dir = __DIR__ . '/backups';
if (!is_dir($dir) && !@mkdir($dir, 0700, true)) {
    dekkan_backup_fail('cannot create backups/ (' . $dir . ')');
}
if (substr(sprintf('%o', fileperms($dir)), -3) !== '700') {
    @chmod($dir, 0700);
}

// --- dump the three dekkan_ tables into one SQL stream ----------------------
$db = dekkan_db();
$tables = ['dekkan_users', 'dekkan_tokens', 'dekkan_state'];
$sql = "-- dekkan encrypted dump " . date('c') . "\n"
     . "SET NAMES utf8mb4;\n"
     . "SET FOREIGN_KEY_CHECKS=0;\n";
foreach ($tables as $t) {
    $rows = $db->query('SELECT * FROM `' . $t . '`')->fetchAll(PDO::FETCH_ASSOC);
    foreach ($rows as $row) {
        $cols = [];
        $vals = [];
        foreach ($row as $k => $v) {
            $cols[] = '`' . str_replace('`', '``', $k) . '`';
            $vals[] = $v === null ? 'NULL' : $db->quote((string)$v);
        }
        $sql .= 'INSERT INTO `' . $t . '` (' . implode(',', $cols) . ') VALUES ('
              . implode(',', $vals) . ");\n";
    }
}
$sql .= "SET FOREIGN_KEY_CHECKS=1;\n";

// --- gzip, then AES-256-CBC; the IV rides in the first 16 bytes ------------
$plain = gzencode($sql, 6);
if ($plain === false) {
    dekkan_backup_fail('gzencode failed');
}
$iv = random_bytes(16);
$cipher = openssl_encrypt($plain, 'aes-256-cbc', hex2bin($keyHex), OPENSSL_RAW_DATA, $iv);
if ($cipher === false) {
    dekkan_backup_fail('openssl_encrypt failed');
}
$file = $dir . '/dekkan-' . date('Ymd-His') . '.sql.gz.enc';
if (@file_put_contents($file, $iv . $cipher) === false) {
    dekkan_backup_fail('cannot write ' . $file);
}
@chmod($file, 0600);

// --- retention: keep the newest $keep, delete the rest ----------------------
$dumps = glob($dir . '/dekkan-*.sql.gz.enc');
usort($dumps, 'strcmp'); // timestamped names sort lexically = chronologically
while (count($dumps) > $keep) {
    $old = array_shift($dumps);
    @unlink($old);
}

file_put_contents($dir . '/backup.log', 'OK ' . date('c') . ' ' . basename($file)
    . ' (' . filesize($file) . ' bytes)' . "\n", FILE_APPEND);
echo "backup OK: " . basename($file) . "\n";