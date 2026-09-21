#!/usr/bin/env python3
"""Deploy the dekkan prototype to the shared host.

Uploads the whole webapp (index.html, css/, js/, core/, icon/, manifest,
sw.js) to modali.powerpme.com:/public_html/dekkan/ over SFTP.

Credentials come from the environment:
  DEKKAN_SFTP_PASS   (preferred)
  DUOSCORE_SFTP_PASS (fallback — same host/user as duoscore)
  SFTP_USER          (default: modali)
  SFTP_HOST          (default: modali.powerpme.com)

Usage:
  $env:DEKKAN_SFTP_PASS='...' ; python3 scripts/deploy.py --dry-run
  $env:DEKKAN_SFTP_PASS='...' ; python3 scripts/deploy.py
"""
import argparse
import os
import posixpath
import sys

import paramiko

HOST = os.environ.get('SFTP_HOST', 'modali.powerpme.com')
USER = os.environ.get('SFTP_USER', 'modali')
REMOTE_ROOT = '/public_html/dekkan'
LOCAL_ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')

FILES = [
    'index.html', 'manifest.webmanifest', 'sw.js',
    'css/style.css',
    'js/app.js', 'js/fmt.js', 'js/pages.js', 'js/actions.js', 'js/lang.js', 'js/themes.js', 'js/auth.js',
    'core/dekkan-core.js',
    'core/core.js', 'core/products.js', 'core/debts.js', 'core/sales.js',
    'core/refunds.js', 'core/employees.js', 'core/cashbox.js', 'core/report.js', 'core/shop.js',
    'core/pin.js',
    'icon/icon.svg', 'icon/icon-192.png', 'icon/icon-512.png',
    'icon/maskable-512.png',
    # the account API (config.php is created on the server, never shipped)
    'api/.htaccess', 'api/config.example.php', 'api/db.php',
    'api/setup.php', 'api/auth.php', 'api/state.php',
]


def fetch_pass():
    p = os.environ.get('DEKKAN_SFTP_PASS')
    if p:
        return p, 'DEKKAN_SFTP_PASS'
    p = os.environ.get('DUOSCORE_SFTP_PASS')
    if p:
        return p, 'DUOSCORE_SFTP_PASS'
    return None, None


def upload(sftp, local, remote):
    sftp.mkdir(posixpath.dirname(remote)) if not _isdir(sftp, posixpath.dirname(remote)) else None
    sftp.put(local, remote)
    print('  ok', remote)


def _isdir(sftp, path):
    try:
        return sftp.stat(path).st_mode & 0o40000 != 0
    except FileNotFoundError:
        return False


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dry-run', action='store_true', help='show what would be uploaded')
    args = ap.parse_args()

    pw, source = fetch_pass()
    if not pw:
        print('no credentials: set DEKKAN_SFTP_PASS (or DUOSCORE_SFTP_PASS) first')
        sys.exit(1)

    print('->', USER + '@' + HOST + ':' + REMOTE_ROOT, '(pass from', source + ')')
    pairs = [(os.path.join(LOCAL_ROOT, f), posixpath.join(REMOTE_ROOT, f)) for f in FILES]
    for _, remote in pairs:
        print('  would upload', remote) if args.dry_run else None
    if args.dry_run:
        print('dry run — nothing sent')
        return

    t = paramiko.Transport((HOST, 22))
    t.connect(username=USER, password=pw)
    sftp = paramiko.SFTPClient.from_transport(t)
    try:
        sftp.mkdir(REMOTE_ROOT)
    except OSError:
        pass  # already exists
    for local, remote in pairs:
        upload(sftp, local, remote)
    sftp.close()
    t.close()
    print('deployed — https://modali.powerpme.com/dekkan/')


if __name__ == '__main__':
    main()