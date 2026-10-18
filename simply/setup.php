<?php
declare(strict_types=1);

/* Engangsopsætning: opretter datamappen, lægger startdata ind og laver den første admin.
   Slet denne fil fra serveren, når du er færdig. */

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');
header('X-Frame-Options: DENY');

function h(string $s): string { return htmlspecialchars($s, ENT_QUOTES, 'UTF-8'); }
function page(string $body): never {
    echo '<!DOCTYPE html><html lang="da"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
       . '<title>Opsætning</title><style>body{font-family:Segoe UI,Arial,sans-serif;max-width:520px;margin:40px auto;padding:0 16px;color:#333}'
       . 'input,button{width:100%;padding:10px;margin:6px 0 14px;font-size:15px;box-sizing:border-box}button{background:#667eea;color:#fff;border:0;border-radius:6px;cursor:pointer}'
       . '.err{background:#f8d7da;padding:10px;border-radius:6px}.ok{background:#d4edda;padding:10px;border-radius:6px}code{background:#eee;padding:1px 4px}</style></head><body>'
       . $body . '</body></html>';
    exit;
}

$cfgFile = __DIR__ . '/config.php';
if (!is_file($cfgFile)) page('<h1>Opsætning</h1><p class="err">config.php mangler. Kopiér config.sample.php til config.php, ret værdierne, og prøv igen.</p>');
$cfg = require $cfgFile;
$token = (string)($cfg['setup_token'] ?? '');
if ($token === '' || $token === 'SKIFT-MIG' || strlen($token) < 16) {
    page('<h1>Opsætning</h1><p class="err">Sæt <code>setup_token</code> i config.php til en lang, tilfældig tekst (mindst 16 tegn).</p>');
}

$dir = rtrim((string)$cfg['data_dir'], '/\\');
if (is_file($dir . '/users.json')) {
    http_response_code(403);
    page('<h1>Opsætning</h1><p class="err">Der er allerede oprettet en admin. Slet setup.php fra serveren.</p>');
}

$error = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $given = (string)($_POST['token'] ?? '');
    $username = trim((string)($_POST['username'] ?? ''));
    $password = (string)($_POST['password'] ?? '');
    if (!hash_equals($token, $given)) {
        usleep(500000);
        $error = 'Forkert opsætningskode.';
    } elseif (!preg_match('/^[A-Za-z0-9._-]{3,30}$/', $username)) {
        $error = 'Brugernavnet skal være 3-30 tegn (bogstaver, tal, punktum, bindestreg, understreg).';
    } elseif (strlen($password) < 10) {
        $error = 'Adgangskoden skal være mindst 10 tegn.';
    } else {
        if (!is_dir($dir) && !mkdir($dir, 0775, true) && !is_dir($dir)) page('<p class="err">Kunne ikke oprette datamappen. Tjek skriverettigheder.</p>');
        file_put_contents($dir . '/.htaccess', "Require all denied\n<IfModule !mod_authz_core.c>\nDeny from all\n</IfModule>\n");
        $copied = [];
        foreach (glob(__DIR__ . '/seed/*.json') ?: [] as $src) {
            $dst = $dir . '/' . basename($src);
            if (!is_file($dst)) { copy($src, $dst); $copied[] = basename($src); }
        }
        $users = ['users' => [['username' => $username, 'hash' => password_hash($password, PASSWORD_DEFAULT), 'role' => 'admin', 'created' => gmdate('c')]]];
        if (file_put_contents($dir . '/users.json', json_encode($users, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "\n") === false) {
            page('<p class="err">Kunne ikke gemme brugeren. Tjek skriverettigheder.</p>');
        }
        page('<h1>Færdig</h1><p class="ok">Admin <b>' . h($username) . '</b> er oprettet. Startdata: ' . h($copied ? implode(', ', $copied) : 'allerede til stede') . '.</p>'
           . '<p><b>Slet nu <code>setup.php</code> fra serveren.</b> Tjek derefter, at <code>/data/users.json</code> giver "Forbudt" (403), hvis datamappen ligger i webmappen.</p>'
           . '<p><a href="./">Gå til årshjulet</a></p>');
    }
}

page('<h1>Opsætning af årshjul</h1>'
   . ($error ? '<p class="err">' . h($error) . '</p>' : '')
   . '<form method="post" autocomplete="off"><label>Opsætningskode (fra config.php)</label><input type="password" name="token" required>'
   . '<label>Admin-brugernavn</label><input name="username" required minlength="3" maxlength="30">'
   . '<label>Admin-adgangskode (mindst 10 tegn)</label><input type="password" name="password" required minlength="10">'
   . '<button type="submit">Opret admin</button></form>');
