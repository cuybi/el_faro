<?php
/**
 * Backend PHP & CMS Engine — El Faro CVC
 * SiteGround 24/7 Persistent Storage
 * 
 * Provides secure REST API endpoints for:
 * - Server Health / Status
 * - Admin Authentication & Token Verification (HMAC SHA-256)
 * - Atomic CMS Data Persistence (cms-data.json on SSD)
 * - Secure Image Uploading (assets/img/)
 * - Public Inboxes (Prayers, Appointments, Contributions)
 */

// Error reporting for production (logs errors, suppresses output)
error_reporting(E_ALL & ~E_NOTICE & ~E_DEPRECATED);
ini_set('display_errors', '0');

// Required Security & Cache Headers
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: SAMEORIGIN');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Configuration
define('ROOT_DIR', dirname(__DIR__));
define('DATA_FILE', ROOT_DIR . '/cms-data.json');
define('UPLOADS_DIR', ROOT_DIR . '/assets/img');
define('SECRET_FILE', ROOT_DIR . '/.server_secret');

$adminEmail = strtolower(getenv('ADMIN_EMAIL') ?: 'admin@elfarocvc.com');
$adminPassword = getenv('ADMIN_PASSWORD') ?: 'ElFaro2026!';
$sessionDurationMs = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

// ==========================================
// SECURITY & TOKEN FUNCTIONS
// ==========================================

function getServerSecret() {
    static $secret = null;
    if ($secret !== null) return $secret;
    if (file_exists(SECRET_FILE)) {
        $secret = trim(@file_get_contents(SECRET_FILE));
    }
    if (empty($secret)) {
        $secret = bin2hex(random_bytes(32));
        @file_put_contents(SECRET_FILE, $secret);
    }
    return $secret;
}

function base64url_encode($data) {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function base64url_decode($data) {
    $remainder = strlen($data) % 4;
    if ($remainder) {
        $padlen = 4 - $remainder;
        $data .= str_repeat('=', $padlen);
    }
    return base64_decode(strtr($data, '-_', '+/'));
}

function createToken($email) {
    global $sessionDurationMs;
    $secret = getServerSecret();
    $expiresAt = round(microtime(true) * 1000) + $sessionDurationMs;
    $payload = "$email:$expiresAt";
    $sig = hash_hmac('sha256', $payload, $secret);
    return base64url_encode("$payload:$sig");
}

function verifyToken($token) {
    if (empty($token)) return null;
    $raw = base64url_decode($token);
    if ($raw === false) return null;
    $parts = explode(':', $raw);
    if (count($parts) !== 3) return null;
    list($email, $expiresAtStr, $sig) = $parts;
    $expiresAt = (float)$expiresAtStr;
    $nowMs = round(microtime(true) * 1000);
    if ($nowMs > $expiresAt) return null;
    $secret = getServerSecret();
    $expectedSig = hash_hmac('sha256', "$email:$expiresAtStr", $secret);
    if (hash_equals($expectedSig, $sig)) {
        return ['email' => $email, 'expiresAt' => $expiresAt];
    }
    return null;
}

function getBearerToken() {
    $header = null;
    if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
        $header = trim($_SERVER['HTTP_AUTHORIZATION']);
    } elseif (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        $header = trim($_SERVER['REDIRECT_HTTP_AUTHORIZATION']);
    } elseif (function_exists('apache_request_headers')) {
        $requestHeaders = apache_request_headers();
        $requestHeaders = array_combine(array_map('ucwords', array_map('strtolower', array_keys($requestHeaders))), array_values($requestHeaders));
        if (isset($requestHeaders['Authorization'])) {
            $header = trim($requestHeaders['Authorization']);
        }
    }
    if (!empty($header) && preg_match('/Bearer\s(\S+)/i', $header, $matches)) {
        return $matches[1];
    }
    return null;
}

function requireAdminAuth() {
    $token = getBearerToken();
    if (!$token) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized: Falta token de autorización.']);
        exit;
    }
    $session = verifyToken($token);
    if (!$session) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized: Sesión inválida o expirada.']);
        exit;
    }
    return $session;
}

function sanitizeText($str, $maxLength = 2000) {
    if (!is_string($str)) return '';
    $clean = strip_tags($str);
    $clean = preg_replace('/[<>]/', '', $clean);
    return mb_substr(trim($clean), 0, $maxLength, 'UTF-8');
}

// ==========================================
// DATA PERSISTENCE (ATOMIC FILE LOCK)
// ==========================================

function readCmsData() {
    if (!file_exists(DATA_FILE)) {
        return [];
    }
    $raw = @file_get_contents(DATA_FILE);
    if ($raw === false) return [];
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function saveCmsData($newData) {
    if (!is_array($newData)) {
        return false;
    }
    $current = readCmsData();

    // Preserve inbox arrays if not provided
    $merged = array_merge($current, $newData);
    if (isset($newData['prayers'])) $merged['prayers'] = $newData['prayers'];
    if (isset($newData['appointments'])) $merged['appointments'] = $newData['appointments'];
    if (isset($newData['contributions'])) $merged['contributions'] = $newData['contributions'];
    $merged['_lastServerUpdate'] = gmdate('c');

    $json = json_encode($merged, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false) return false;

    // Atomic write via temporary file + rename with exclusive flock
    $tmpFile = DATA_FILE . '.' . uniqid('tmp_', true);
    $fp = @fopen($tmpFile, 'w');
    if (!$fp) return false;

    if (flock($fp, LOCK_EX)) {
        fwrite($fp, $json);
        fflush($fp);
        flock($fp, LOCK_UN);
        fclose($fp);
        return @rename($tmpFile, DATA_FILE);
    }

    fclose($fp);
    @unlink($tmpFile);
    return false;
}

// ==========================================
// ROUTE RESOLUTION
// ==========================================

$route = '';
if (!empty($_GET['route'])) {
    $route = trim($_GET['route'], '/');
} else {
    $uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
    $scriptDir = dirname($_SERVER['SCRIPT_NAME']);
    if ($scriptDir !== '/' && $scriptDir !== '\\' && strpos($uri, $scriptDir) === 0) {
        $uri = substr($uri, strlen($scriptDir));
    }
    $uri = trim($uri, '/');
    if (strpos($uri, 'api/') === 0) {
        $route = substr($uri, 4);
    } elseif ($uri === 'api') {
        $route = '';
    } else {
        $route = $uri;
    }
}
$route = trim($route, '/');
$method = $_SERVER['REQUEST_METHOD'];

// Helper to get JSON input
function getJsonInput() {
    $raw = file_get_contents('php://input');
    if (empty($raw)) return [];
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

// ==========================================
// API ENDPOINTS ROUTING
// ==========================================

// 0. HEALTH / STATUS: GET /api/server-status
if ($route === 'server-status' && $method === 'GET') {
    echo json_encode([
        'status' => 'online',
        'timestamp' => round(microtime(true) * 1000),
        'message' => 'Servidor El Faro CMS activo y en línea (PHP/SiteGround).',
        'engine' => 'PHP ' . PHP_VERSION,
        'storage' => 'SSD Persistente SiteGround 24/7'
    ]);
    exit;
}

// 1. ADMIN LOGIN: POST /api/admin/login
if ($route === 'admin/login' && $method === 'POST') {
    $input = getJsonInput();
    $email = strtolower(trim($input['email'] ?? ''));
    $pass = trim($input['password'] ?? '');

    if ($email === $adminEmail && $pass === $adminPassword) {
        $token = createToken($email);
        $expiresAt = round(microtime(true) * 1000) + $sessionDurationMs;
        echo json_encode([
            'status' => 'success',
            'token' => $token,
            'expiresAt' => $expiresAt,
            'message' => 'Autenticación exitosa.'
        ]);
        exit;
    }

    http_response_code(401);
    echo json_encode(['error' => 'Credenciales inválidas.']);
    exit;
}

// 2. ADMIN VERIFY TOKEN: GET /api/admin/verify-token
if ($route === 'admin/verify-token' && $method === 'GET') {
    $session = requireAdminAuth();
    echo json_encode([
        'status' => 'valid',
        'email' => $session['email'],
        'expiresAt' => $session['expiresAt']
    ]);
    exit;
}

// 3. CMS DATA: GET /api/cms-data
if ($route === 'cms-data' && $method === 'GET') {
    $data = readCmsData();
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

// 4. CMS DATA: POST /api/cms-data (Protected - Admin Only)
if ($route === 'cms-data' && $method === 'POST') {
    requireAdminAuth();
    $input = getJsonInput();
    if (empty($input) || !is_array($input)) {
        http_response_code(400);
        echo json_encode(['error' => 'El cuerpo de la petición debe contener un objeto de datos válido.']);
        exit;
    }

    $ok = saveCmsData($input);
    if ($ok) {
        echo json_encode([
            'status' => 'success',
            'serverSynced' => true,
            'message' => 'Datos guardados en disco permanentemente en SiteGround.'
        ]);
    } else {
        http_response_code(500);
        echo json_encode(['error' => 'Error interno al escribir datos del CMS en el servidor.']);
    }
    exit;
}

// 5. IMAGE UPLOAD: POST /api/upload (Protected - Admin Only)
if ($route === 'upload' && $method === 'POST') {
    requireAdminAuth();
    $input = getJsonInput();
    $fileData = $input['fileData'] ?? '';
    $fileName = $input['fileName'] ?? 'foto.jpg';

    if (empty($fileData)) {
        http_response_code(400);
        echo json_encode(['error' => 'No se recibieron datos de archivo.']);
        exit;
    }

    // Strip data URI scheme if present
    if (preg_match('/^data:([A-Za-z-+\/]+);base64,(.+)$/', $fileData, $matches)) {
        $fileData = $matches[2];
    }
    $binary = base64_decode($fileData);
    if ($binary === false) {
        http_response_code(400);
        echo json_encode(['error' => 'Formato de imagen base64 inválido.']);
        exit;
    }

    // Max 15MB
    if (strlen($binary) > 15 * 1024 * 1024) {
        http_response_code(400);
        echo json_encode(['error' => 'El archivo excede el tamaño máximo permitido (15MB).']);
        exit;
    }

    $ext = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));
    $allowed = ['jpg', 'jpeg', 'png', 'webp', 'svg', 'gif'];
    if (!in_array($ext, $allowed)) {
        $ext = 'jpg';
    }

    $cleanBase = preg_replace('/[^a-zA-Z0-9_-]/', '_', pathinfo($fileName, PATHINFO_FILENAME));
    $cleanBase = substr($cleanBase, 0, 30) ?: 'foto';
    $safeName = $cleanBase . '_' . round(microtime(true) * 1000) . '.' . $ext;

    if (!is_dir(UPLOADS_DIR)) {
        @mkdir(UPLOADS_DIR, 0755, true);
    }

    $targetPath = UPLOADS_DIR . '/' . $safeName;
    if (@file_put_contents($targetPath, $binary) === false) {
        http_response_code(500);
        echo json_encode(['error' => 'No se pudo guardar la imagen en el directorio assets/img.']);
        exit;
    }

    echo json_encode([
        'status' => 'success',
        'url' => 'assets/img/' . $safeName,
        'message' => 'Foto subida y almacenada en disco exitosamente.'
    ]);
    exit;
}

// 6. PUBLIC INBOX: POST /api/inbox/prayer
if ($route === 'inbox/prayer' && $method === 'POST') {
    $input = getJsonInput();
    $name = sanitizeText($input['name'] ?? '', 120);
    $phone = sanitizeText($input['phone'] ?? '', 40);
    $email = sanitizeText($input['email'] ?? '', 120);
    $request = sanitizeText($input['request'] ?? '', 2000);

    if (empty($name) || empty($request)) {
        http_response_code(400);
        echo json_encode(['error' => 'El nombre y la petición son requeridos.']);
        exit;
    }

    $safePrayer = [
        'id' => 'pr-' . round(microtime(true) * 1000),
        'name' => $name,
        'phone' => $phone,
        'email' => $email,
        'request' => $request,
        'date' => gmdate('c'),
        'status' => 'Pendiente'
    ];

    $current = readCmsData();
    $current['prayers'] = $current['prayers'] ?? [];
    array_unshift($current['prayers'], $safePrayer);
    saveCmsData($current);

    echo json_encode([
        'status' => 'success',
        'message' => 'Petición de oración recibida con bendición.',
        'id' => $safePrayer['id']
    ]);
    exit;
}

// 7. PUBLIC INBOX: POST /api/inbox/appointment
if ($route === 'inbox/appointment' && $method === 'POST') {
    $input = getJsonInput();
    $name = sanitizeText($input['name'] ?? '', 120);
    $email = sanitizeText($input['email'] ?? '', 120);
    $phone = sanitizeText($input['phone'] ?? '', 40);
    $date = sanitizeText($input['date'] ?? '', 20);
    $time = sanitizeText($input['time'] ?? '', 20);

    if (empty($name) || empty($date) || empty($time)) {
        http_response_code(400);
        echo json_encode(['error' => 'Nombre, fecha y hora son obligatorios.']);
        exit;
    }

    $safeApp = [
        'id' => 'app-' . round(microtime(true) * 1000),
        'name' => $name,
        'email' => $email,
        'phone' => $phone,
        'date' => $date,
        'time' => $time,
        'status' => 'Pendiente'
    ];

    $current = readCmsData();
    $current['appointments'] = $current['appointments'] ?? [];
    array_unshift($current['appointments'], $safeApp);
    saveCmsData($current);

    echo json_encode([
        'status' => 'success',
        'message' => 'Cita pastoral agendada con éxito.',
        'id' => $safeApp['id']
    ]);
    exit;
}

// 8. PUBLIC INBOX: POST /api/inbox/contribution
if ($route === 'inbox/contribution' && $method === 'POST') {
    $input = getJsonInput();
    $name = sanitizeText($input['name'] ?? '', 120);
    $phone = sanitizeText($input['phone'] ?? '', 40);
    $email = sanitizeText($input['email'] ?? '', 120);
    $type = sanitizeText($input['type'] ?? 'General', 60);
    $ref = sanitizeText($input['ref'] ?? '', 60);
    $message = sanitizeText($input['message'] ?? '', 1000);

    if (empty($name) || empty($ref)) {
        http_response_code(400);
        echo json_encode(['error' => 'Nombre y número de comprobante/referencia son requeridos.']);
        exit;
    }

    $safeContribution = [
        'id' => 'ct-' . round(microtime(true) * 1000),
        'name' => $name,
        'phone' => $phone,
        'email' => $email,
        'type' => $type ?: 'General',
        'ref' => $ref,
        'message' => $message,
        'date' => gmdate('c')
    ];

    $current = readCmsData();
    $current['contributions'] = $current['contributions'] ?? [];
    array_unshift($current['contributions'], $safeContribution);
    saveCmsData($current);

    echo json_encode([
        'status' => 'success',
        'message' => 'Reporte de aporte recibido. ¡Muchas gracias!',
        'id' => $safeContribution['id']
    ]);
    exit;
}

// Fallback: 404 Not Found
http_response_code(404);
echo json_encode([
    'error' => 'Endpoint API no encontrado.',
    'requested_route' => $route,
    'method' => $method
]);
