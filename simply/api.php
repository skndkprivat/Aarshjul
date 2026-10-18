<?php
declare(strict_types=1);

/* ============================================================
   HCS Årshjul – API
   Offentlig læsning, admin-login til redigering. Data som JSON-filer.
   ============================================================ */

const MONTHS = ['jan','feb','mar','apr','maj','jun','jul','aug','sep','okt','nov','dec'];
const MAX_BODY = 1048576;        // 1 MB
const MAX_ACTIVITIES = 500;
const HISTORY_KEEP = 100;
const LOCK_AFTER_FAILS = 5;
const LOCK_SECONDS = 300;
const MIN_PASSWORD = 10;

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

/* ---------------- Hjælpefunktioner ---------------- */
function out(array $data, int $code = 200): never {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
function fail(string $msg, int $code = 400, array $extra = []): never {
    out(['error' => $msg] + $extra, $code);
}
function slen(string $s): int {
    return function_exists('mb_strlen') ? mb_strlen($s, 'UTF-8') : strlen($s);
}
function config(): array {
    static $cfg = null;
    if ($cfg === null) {
        $file = __DIR__ . '/config.php';
        if (!is_file($file)) fail('Serveren er ikke sat op (config.php mangler).', 500);
        $cfg = require $file;
    }
    return $cfg;
}
function data_dir(): string {
    return rtrim((string)config()['data_dir'], '/\\');
}
function read_json(string $path, $default = null) {
    if (!is_file($path)) return $default;
    $raw = file_get_contents($path);
    if ($raw === false) return $default;
    $v = json_decode($raw, true);
    return $v === null ? $default : $v;
}
function write_json(string $path, $data): void {
    $tmp = $path . '.' . bin2hex(random_bytes(4)) . '.tmp';
    $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    if ($json === false || file_put_contents($tmp, $json . "\n") === false) fail('Kunne ikke gemme data.', 500);
    if (!rename($tmp, $path)) { @unlink($tmp); fail('Kunne ikke gemme data.', 500); }
}
/** Kør $fn mens en eksklusiv lås holdes, så to rettelser ikke blandes. */
function with_lock(callable $fn) {
    $fh = fopen(data_dir() . '/.lock', 'c');
    if (!$fh) fail('Kunne ikke låse data.', 500);
    flock($fh, LOCK_EX);
    try { return $fn(); } finally { flock($fh, LOCK_UN); fclose($fh); }
}
function version_of(string $path): string {
    return is_file($path) ? sha1_file($path) : 'new';
}
function body(): array {
    $raw = file_get_contents('php://input', false, null, 0, MAX_BODY + 1);
    if ($raw === false || strlen($raw) > MAX_BODY) fail('Forespørgslen er for stor.', 413);
    $d = json_decode($raw, true);
    if (!is_array($d)) fail('Ugyldig forespørgsel.');
    return $d;
}
function str_field(array $d, string $k, int $max, bool $required = false): string {
    $v = $d[$k] ?? '';
    if (!is_string($v)) fail("Ugyldigt felt: $k");
    $v = trim($v);
    if ($required && $v === '') fail("Feltet \"$k\" er påkrævet.");
    if (slen($v) > $max) fail("Feltet \"$k\" er for langt.");
    return $v;
}

/* ---------------- Session og sikkerhed ---------------- */
function is_https(): bool {
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
}
function start_session(): void {
    $minutes = max(1, (int)(config()['session_minutes'] ?? 30));
    session_name('hcs_sess');
    session_set_cookie_params([
        'lifetime' => 0, 'path' => '/', 'secure' => is_https(),
        'httponly' => true, 'samesite' => 'Lax',
    ]);
    session_start();
    if (isset($_SESSION['last']) && time() - $_SESSION['last'] > $minutes * 60) {
        $_SESSION = [];
        session_regenerate_id(true);
    }
    if (!empty($_SESSION['user'])) $_SESSION['last'] = time();
}
function current_user(): ?array {
    return $_SESSION['user'] ?? null;
}
function require_login(): array {
    $u = current_user();
    if (!$u) fail('Du er ikke logget ind.', 401);
    $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (!is_string($token) || !hash_equals((string)($_SESSION['csrf'] ?? ''), $token)) fail('Ugyldig sikkerhedskode. Genindlæs siden.', 403);
    return $u;
}
function check_origin(): void {
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin === '') return;
    $host = parse_url($origin, PHP_URL_HOST);
    $mine = preg_replace('/:\d+$/', '', (string)($_SERVER['HTTP_HOST'] ?? ''));
    if ($host !== $mine) fail('Forbudt.', 403);
}

/* ---------------- Login-begrænsning ---------------- */
function attempt_key(string $username): string {
    return sha1(($_SERVER['REMOTE_ADDR'] ?? '') . '|' . strtolower($username));
}
function attempts_check(string $key): void {
    $all = read_json(data_dir() . '/attempts.json', []);
    $a = $all[$key] ?? null;
    if ($a && ($a['until'] ?? 0) > time()) {
        fail('For mange forsøg. Prøv igen om ' . ceil($a['until'] - time()) . ' sekunder.', 429);
    }
}
function attempts_record(string $key, bool $ok): void {
    with_lock(function () use ($key, $ok) {
        $path = data_dir() . '/attempts.json';
        $all = read_json($path, []);
        $now = time();
        foreach ($all as $k => $a) {            // ryd gamle poster
            if (($a['until'] ?? 0) < $now && ($a['last'] ?? 0) < $now - 3600) unset($all[$k]);
        }
        if ($ok) {
            unset($all[$key]);
        } else {
            $fails = (int)($all[$key]['fails'] ?? 0) + 1;
            $all[$key] = ['fails' => $fails, 'last' => $now, 'until' => $fails >= LOCK_AFTER_FAILS ? $now + LOCK_SECONDS : 0];
            if ($fails >= LOCK_AFTER_FAILS) $all[$key]['fails'] = 0;
        }
        write_json($path, $all);
    });
}

/* ---------------- Data ---------------- */
function customers(): array {
    $c = read_json(data_dir() . '/customers.json', ['customers' => []]);
    return is_array($c['customers'] ?? null) ? $c['customers'] : [];
}
function find_customer(string $id): array {
    foreach (customers() as $c) if (($c['id'] ?? '') === $id) return $c;
    fail('Ukendt kunde.', 404);
}
function year_param(array $customer, string $year): string {
    if (!preg_match('/^\d{4}$/', $year) || !in_array($year, array_map('strval', $customer['years'] ?? []), true)) fail('Ukendt år.', 404);
    return $year;
}
function year_path(string $customerId, string $year): string {
    if (!preg_match('/^[a-z0-9-]{1,30}$/', $customerId)) fail('Ugyldig kunde.');
    return data_dir() . "/$customerId-$year.json";
}
function blank_year(array $customer, string $year): array {
    return ['title' => ($customer['shortName'] ?? $customer['name'] ?? '') . " Årshjul $year", 'activities' => []];
}
function clean_year_data($d): array {
    if (!is_array($d)) fail('Ugyldige data.');
    $title = str_field($d, 'title', 100);
    $acts = $d['activities'] ?? null;
    if (!is_array($acts) || count($acts) > MAX_ACTIVITIES) fail('Ugyldige aktiviteter.');
    $clean = []; $seen = [];
    foreach ($acts as $a) {
        if (!is_array($a)) fail('Ugyldig aktivitet.');
        $id = str_field($a, 'id', 40, true);
        if (!preg_match('/^[A-Za-z0-9_-]+$/', $id) || isset($seen[$id])) fail('Ugyldigt aktivitets-id.');
        $seen[$id] = true;
        $month = str_field($a, 'month', 3, true);
        if (!in_array($month, MONTHS, true)) fail('Ugyldig måned.');
        $date = str_field($a, 'date', 5);
        if ($date !== '') {
            if (!preg_match('/^(\d{1,2})\/(\d{1,2})$/', $date, $m) || (int)$m[1] < 1 || (int)$m[1] > 31 || (int)$m[2] < 1 || (int)$m[2] > 12) fail('Ugyldig dato.');
        }
        $clean[] = [
            'id' => $id, 'month' => $month,
            'name' => str_field($a, 'name', 120, true),
            'date' => $date,
            'responsible' => str_field($a, 'responsible', 100),
            'notes' => str_field($a, 'notes', 2000),
        ];
    }
    return ['title' => $title, 'activities' => $clean];
}
function snapshot(string $customerId, string $year, string $path, string $username): void {
    if (!is_file($path)) return;
    $dir = data_dir() . "/history/$customerId-$year";
    if (!is_dir($dir) && !mkdir($dir, 0775, true) && !is_dir($dir)) return;
    $name = gmdate('Ymd-His') . '--' . preg_replace('/[^a-z0-9_-]/i', '_', $username) . '--' . bin2hex(random_bytes(2)) . '.json';
    copy($path, "$dir/$name");
    $files = glob("$dir/*.json") ?: [];
    sort($files);
    while (count($files) > HISTORY_KEEP) @unlink(array_shift($files));
}

/* ---------------- Brugere ---------------- */
function users(): array {
    $u = read_json(data_dir() . '/users.json', ['users' => []]);
    return is_array($u['users'] ?? null) ? $u['users'] : [];
}
function save_users(array $users): void {
    write_json(data_dir() . '/users.json', ['users' => array_values($users)]);
}
function valid_username(string $u): bool {
    return (bool)preg_match('/^[A-Za-z0-9._-]{3,30}$/', $u);
}
function check_password_strength(string $p): void {
    if (strlen($p) < MIN_PASSWORD) fail('Adgangskoden skal være mindst ' . MIN_PASSWORD . ' tegn.');
    if (strlen($p) > 200) fail('Adgangskoden er for lang.');
}

/* ---------------- Router ---------------- */
$action = (string)($_GET['action'] ?? '');
$method = $_SERVER['REQUEST_METHOD'];
if (!in_array($method, ['GET', 'POST'], true)) fail('Metoden er ikke tilladt.', 405);
if ($method === 'POST') check_origin();
start_session();

switch ($action) {

case 'customers':
    out(['customers' => customers()]);

case 'year': {
    $c = find_customer((string)($_GET['customer'] ?? ''));
    $year = year_param($c, (string)($_GET['year'] ?? ''));
    $path = year_path($c['id'], $year);
    out(['data' => read_json($path, blank_year($c, $year)), 'version' => version_of($path)]);
}

case 'me': {
    $u = current_user();
    if ($u && empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(16));
    out(['user' => $u, 'csrf' => $u ? $_SESSION['csrf'] : null]);
}

case 'login': {
    if ($method !== 'POST') fail('Brug POST.', 405);
    $d = body();
    $username = str_field($d, 'username', 30, true);
    $password = $d['password'] ?? '';
    if (!is_string($password) || $password === '' || strlen($password) > 200) fail('Forkert brugernavn eller adgangskode.', 401);
    $key = attempt_key($username);
    attempts_check($key);
    $found = null;
    foreach (users() as $u) {
        if (strcasecmp($u['username'], $username) === 0) { $found = $u; break; }
    }
    // Kør altid en verificering, så svartiden ikke afslører om brugeren findes
    $hash = $found['hash'] ?? password_hash('dummy-password', PASSWORD_DEFAULT);
    $ok = password_verify($password, $hash) && $found !== null;
    attempts_record($key, $ok);
    if (!$ok) fail('Forkert brugernavn eller adgangskode.', 401);
    session_regenerate_id(true);
    $_SESSION['user'] = ['username' => $found['username'], 'role' => $found['role'] ?? 'admin'];
    $_SESSION['csrf'] = bin2hex(random_bytes(16));
    $_SESSION['last'] = time();
    if (password_needs_rehash($found['hash'], PASSWORD_DEFAULT)) {
        with_lock(function () use ($found, $password) {
            $all = users();
            foreach ($all as &$u) if ($u['username'] === $found['username']) $u['hash'] = password_hash($password, PASSWORD_DEFAULT);
            save_users($all);
        });
    }
    out(['user' => $_SESSION['user'], 'csrf' => $_SESSION['csrf']]);
}

case 'logout': {
    if ($method !== 'POST') fail('Brug POST.', 405);
    $_SESSION = [];
    session_destroy();
    out(['ok' => true]);
}

case 'save': {
    if ($method !== 'POST') fail('Brug POST.', 405);
    $u = require_login();
    $d = body();
    $c = find_customer(str_field($d, 'customer', 30, true));
    $year = year_param($c, str_field($d, 'year', 4, true));
    $base = str_field($d, 'baseVersion', 64, true);
    $clean = clean_year_data($d['data'] ?? null);
    $path = year_path($c['id'], $year);
    $version = with_lock(function () use ($path, $c, $year, $base, $clean, $u) {
        $current = version_of($path);
        if ($current !== $base) {
            fail('Filen er ændret af en anden, siden du hentede den.', 409, ['data' => read_json($path, blank_year($c, $year)), 'version' => $current]);
        }
        snapshot($c['id'], $year, $path, $u['username']);
        write_json($path, $clean);
        return version_of($path);
    });
    out(['version' => $version]);
}

case 'addYear': {
    if ($method !== 'POST') fail('Brug POST.', 405);
    require_login();
    $d = body();
    $id = str_field($d, 'customer', 30, true);
    $year = str_field($d, 'year', 4, true);
    if (!preg_match('/^(19|20)\d{2}$/', $year)) fail('Ugyldigt årstal.');
    with_lock(function () use ($id, $year) {
        $path = data_dir() . '/customers.json';
        $all = read_json($path, ['customers' => []]);
        $found = false;
        foreach ($all['customers'] as &$c) {
            if (($c['id'] ?? '') !== $id) continue;
            $found = true;
            $years = array_map('strval', $c['years'] ?? []);
            if (in_array($year, $years, true)) fail('Året findes allerede.', 409);
            $years[] = $year;
            sort($years);
            $c['years'] = $years;
            $yp = year_path($id, $year);
            if (!is_file($yp)) write_json($yp, blank_year($c, $year));
        }
        if (!$found) fail('Ukendt kunde.', 404);
        write_json($path, $all);
    });
    out(['customers' => customers()]);
}

case 'history': {
    $u = require_login();
    $c = find_customer((string)($_GET['customer'] ?? ''));
    $year = year_param($c, (string)($_GET['year'] ?? ''));
    $files = glob(data_dir() . "/history/{$c['id']}-$year/*.json") ?: [];
    rsort($files);
    $items = [];
    foreach (array_slice($files, 0, 30) as $f) {
        $b = basename($f, '.json');
        $p = explode('--', $b);
        $d = read_json($f, ['activities' => []]);
        $items[] = ['id' => $b, 'time' => $p[0], 'user' => $p[1] ?? '', 'count' => count($d['activities'] ?? [])];
    }
    out(['items' => $items]);
}

case 'restore': {
    if ($method !== 'POST') fail('Brug POST.', 405);
    $u = require_login();
    $d = body();
    $c = find_customer(str_field($d, 'customer', 30, true));
    $year = year_param($c, str_field($d, 'year', 4, true));
    $id = str_field($d, 'id', 80, true);
    if (!preg_match('/^[A-Za-z0-9_-]+$/', $id)) fail('Ugyldigt id.');
    $src = data_dir() . "/history/{$c['id']}-$year/$id.json";
    if (!is_file($src)) fail('Versionen findes ikke.', 404);
    $path = year_path($c['id'], $year);
    $version = with_lock(function () use ($src, $path, $c, $year, $u) {
        $data = clean_year_data(read_json($src, null));
        snapshot($c['id'], $year, $path, $u['username']);
        write_json($path, $data);
        return version_of($path);
    });
    out(['data' => read_json($path), 'version' => $version]);
}

case 'users': {
    require_login();
    out(['users' => array_map(fn($u) => ['username' => $u['username'], 'role' => $u['role'] ?? 'admin'], users())]);
}

case 'createUser': {
    if ($method !== 'POST') fail('Brug POST.', 405);
    require_login();
    $d = body();
    $username = str_field($d, 'username', 30, true);
    $password = (string)($d['password'] ?? '');
    if (!valid_username($username)) fail('Brugernavnet skal være 3-30 tegn (bogstaver, tal, punktum, bindestreg, understreg).');
    check_password_strength($password);
    with_lock(function () use ($username, $password) {
        $all = users();
        foreach ($all as $u) if (strcasecmp($u['username'], $username) === 0) fail('Brugernavnet findes allerede.', 409);
        $all[] = ['username' => $username, 'hash' => password_hash($password, PASSWORD_DEFAULT), 'role' => 'admin', 'created' => gmdate('c')];
        save_users($all);
    });
    out(['ok' => true]);
}

case 'deleteUser': {
    if ($method !== 'POST') fail('Brug POST.', 405);
    $me = require_login();
    $d = body();
    $username = str_field($d, 'username', 30, true);
    if (strcasecmp($username, $me['username']) === 0) fail('Du kan ikke slette dig selv.');
    with_lock(function () use ($username) {
        $all = users();
        $left = array_values(array_filter($all, fn($u) => strcasecmp($u['username'], $username) !== 0));
        if (count($left) === count($all)) fail('Brugeren findes ikke.', 404);
        save_users($left);
    });
    out(['ok' => true]);
}

case 'changePassword': {
    if ($method !== 'POST') fail('Brug POST.', 405);
    $me = require_login();
    $d = body();
    $old = (string)($d['oldPassword'] ?? '');
    $new = (string)($d['newPassword'] ?? '');
    check_password_strength($new);
    $key = attempt_key($me['username']);
    attempts_check($key);
    $result = with_lock(function () use ($me, $old, $new) {
        $all = users();
        foreach ($all as &$u) {
            if ($u['username'] !== $me['username']) continue;
            if (!password_verify($old, $u['hash'])) return 'wrong';
            $u['hash'] = password_hash($new, PASSWORD_DEFAULT);
            save_users($all);
            return 'ok';
        }
        return 'missing';
    });
    if ($result === 'missing') fail('Brugeren findes ikke.', 404);
    attempts_record($key, $result === 'ok');
    if ($result === 'wrong') fail('Den nuværende adgangskode er forkert.', 401);
    out(['ok' => true]);
}

default:
    fail('Ukendt handling.', 404);
}
