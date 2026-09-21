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
    // hard cap so one huge paste cannot fill the disk
    'stateMaxBytes' => 16777216, // 16 MB (MEDIUMTEXT)
];