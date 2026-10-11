<?php
/**
 * DEKKAN API — configuration.
 *
 * Copy this file to config.php and fill in REAL values.
 * config.php is blocked from download by .htaccess and must NEVER be committed.
 *
 * The API lives under the webapp at /dekkan/api/ on the shared host
 * (modali.powerpme.com) and talks to the same MySQL server the other
 * projects use — one DB, table names prefixed `dekkan_`.
 */
return [
    'db' => [
        'host' => 'localhost',
        'name' => 'YOUR_DB_NAME',
        'user' => 'YOUR_DB_USER',
        'pass' => 'YOUR_DB_PASS',
    ],
    // used by setup.php only: create the tables with ?key=SETUP_KEY once,
    // then DELETE setup.php from the server.
    'setupKey' => 'CHANGE_ME_TO_A_LONG_RANDOM_STRING',
    // Google OAuth client id for "Sign in with Google" (public, not a secret).
    // Must equal the id in js/config.js. Empty = Google sign-in disabled
    // (the API then answers google_not_configured).
    'googleClientId' => '',
    // automated encrypted dump (api/backup.php): the AES key must be 64 hex
    // chars (32 bytes). Generate one with:  php -r "echo bin2hex(random_bytes(32));"
    'backupKey' => '',
    // web-cron secret: https://host/dekkan/api/backup.php?run=THIS_VALUE
    'backupRunKey' => '',
    // how many dumps to keep (default 14 = two weeks of daily dumps)
    'backupKeep' => 14,
    // hard cap so one huge paste cannot fill the disk
    'stateMaxBytes' => 16777216, // 16 MB (MEDIUMTEXT)
];