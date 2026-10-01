<?php
/**
 * Backend PHP & SQL Database CMS Engine — El Faro CVC
 * SiteGround 24/7 Persistent Storage with Real SQL Database (PDO SQLite / MySQL)
 * 
 * Provides secure REST API endpoints for:
 * - Server Health / Status & Database Diagnostics
 * - Admin Authentication & Token Verification (HMAC SHA-256)
 * - Relational SQL Database Storage & Transactions
 * - Secure Image Uploading (assets/img/)
 * - Public Inboxes (Prayers, Appointments, Contributions)
 */

// Error reporting for production
error_reporting(E_ALL & ~E_NOTICE & ~E_DEPRECATED);
ini_set('display_errors', '0');

// Strict Security & Anti-Cache Headers (forces fresh data from database every request)
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
define('DB_FILE', __DIR__ . '/elfaro_cms.db');
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
// DATABASE ENGINE (PDO SQLITE / MYSQL)
// ==========================================

function getDb() {
    static $pdo = null;
    if ($pdo !== null) return $pdo;

    $dbHost = getenv('DB_HOST');
    $dbName = getenv('DB_NAME');
    $dbUser = getenv('DB_USER');
    $dbPass = getenv('DB_PASS');

    if (!empty($dbHost) && !empty($dbName)) {
        // Connect to remote or cPanel MySQL
        $dsn = "mysql:host={$dbHost};dbname={$dbName};charset=utf8mb4";
        $pdo = new PDO($dsn, $dbUser, $dbPass, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
        ]);
    } else {
        // High-performance embedded SQLite database on SiteGround SSD
        $pdo = new PDO("sqlite:" . DB_FILE, null, null, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
        ]);
        $pdo->exec('PRAGMA journal_mode = WAL;');
        $pdo->exec('PRAGMA synchronous = NORMAL;');
    }

    initDatabaseSchema($pdo);
    return $pdo;
}

function initDatabaseSchema($pdo) {
    // 1. Settings / Config Table
    $pdo->exec("CREATE TABLE IF NOT EXISTS cms_settings (
        setting_key VARCHAR(100) PRIMARY KEY,
        setting_value TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )");

    // 2. Gallery Images Table
    $pdo->exec("CREATE TABLE IF NOT EXISTS gallery_images (
        id VARCHAR(100) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        image_url VARCHAR(500) NOT NULL,
        date_val VARCHAR(50),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )");

    // 3. Prayers Table
    $pdo->exec("CREATE TABLE IF NOT EXISTS prayers (
        id VARCHAR(100) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        email VARCHAR(255),
        request TEXT NOT NULL,
        date_iso VARCHAR(50),
        status VARCHAR(50) DEFAULT 'Pendiente',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )");

    // 4. Appointments Table
    $pdo->exec("CREATE TABLE IF NOT EXISTS appointments (
        id VARCHAR(100) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        phone VARCHAR(50),
        date_val VARCHAR(50),
        time_val VARCHAR(50),
        status VARCHAR(50) DEFAULT 'Pendiente',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )");

    // 5. Contributions Table
    $pdo->exec("CREATE TABLE IF NOT EXISTS contributions (
        id VARCHAR(100) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        email VARCHAR(255),
        type VARCHAR(100),
        ref VARCHAR(100),
        message TEXT,
        date_iso VARCHAR(50),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )");

    // Auto-seed existing JSON data on first run
    try {
        $check = $pdo->query("SELECT COUNT(*) as count FROM cms_settings")->fetch();
        if (empty($check['count'])) {
            seedFromExistingJson($pdo);
        }
    } catch (Exception $e) {
        // Table might be initializing
    }
}

function seedFromExistingJson($pdo) {
    if (!file_exists(DATA_FILE)) return;
    $raw = @file_get_contents(DATA_FILE);
    if (!$raw) return;
    $data = json_decode($raw, true);
    if (!is_array($data)) return;

    $relationalKeys = ['galleryImages', 'prayers', 'appointments', 'contributions'];

    // Seed all general settings dynamically (siteTexts, bankInfo, videos, navTexts, pageEdits, etc.)
    foreach ($data as $key => $val) {
        if (in_array($key, $relationalKeys)) continue;
        if ($key === '_lastServerUpdate' || $key === 'auditTimestamp' || $key === '_lastSavedLocal') continue;
        $stmt = $pdo->prepare("INSERT OR REPLACE INTO cms_settings (setting_key, setting_value) VALUES (:k, :v)");
        $stmt->execute([
            ':k' => $key,
            ':v' => is_scalar($val) ? (string)$val : json_encode($val, JSON_UNESCAPED_UNICODE)
        ]);
    }

    // Seed gallery
    if (!empty($data['galleryImages']) && is_array($data['galleryImages'])) {
        $stmt = $pdo->prepare("INSERT OR REPLACE INTO gallery_images (id, title, category, image_url, date_val) VALUES (:id, :title, :category, :img, :d)");
        foreach ($data['galleryImages'] as $img) {
            $stmt->execute([
                ':id' => $img['id'] ?? ('img-' . uniqid()),
                ':title' => $img['title'] ?? '',
                ':category' => $img['category'] ?? 'adoracion',
                ':img' => $img['imageUrl'] ?? ($img['image_url'] ?? ''),
                ':d' => $img['date'] ?? gmdate('Y-m-d')
            ]);
        }
    }

    // Seed prayers
    if (!empty($data['prayers']) && is_array($data['prayers'])) {
        $stmt = $pdo->prepare("INSERT OR REPLACE INTO prayers (id, name, phone, email, request, date_iso, status) VALUES (:id, :name, :phone, :email, :req, :d, :status)");
        foreach ($data['prayers'] as $pr) {
            $stmt->execute([
                ':id' => $pr['id'] ?? ('pr-' . uniqid()),
                ':name' => $pr['name'] ?? '',
                ':phone' => $pr['phone'] ?? '',
                ':email' => $pr['email'] ?? '',
                ':req' => $pr['request'] ?? '',
                ':d' => $pr['date'] ?? gmdate('c'),
                ':status' => $pr['status'] ?? 'Pendiente'
            ]);
        }
    }

    // Seed appointments
    if (!empty($data['appointments']) && is_array($data['appointments'])) {
        $stmt = $pdo->prepare("INSERT OR REPLACE INTO appointments (id, name, email, phone, date_val, time_val, status) VALUES (:id, :name, :email, :phone, :d, :t, :status)");
        foreach ($data['appointments'] as $ap) {
            $stmt->execute([
                ':id' => $ap['id'] ?? ('app-' . uniqid()),
                ':name' => $ap['name'] ?? '',
                ':email' => $ap['email'] ?? '',
                ':phone' => $ap['phone'] ?? '',
                ':d' => $ap['date'] ?? '',
                ':t' => $ap['time'] ?? '',
                ':status' => $ap['status'] ?? 'Pendiente'
            ]);
        }
    }

    // Seed contributions
    if (!empty($data['contributions']) && is_array($data['contributions'])) {
        $stmt = $pdo->prepare("INSERT OR REPLACE INTO contributions (id, name, phone, email, type, ref, message, date_iso) VALUES (:id, :name, :phone, :email, :type, :ref, :msg, :d)");
        foreach ($data['contributions'] as $ct) {
            $stmt->execute([
                ':id' => $ct['id'] ?? ('ct-' . uniqid()),
                ':name' => $ct['name'] ?? '',
                ':phone' => $ct['phone'] ?? '',
                ':email' => $ct['email'] ?? '',
                ':type' => $ct['type'] ?? 'General',
                ':ref' => $ct['ref'] ?? '',
                ':msg' => $ct['message'] ?? '',
                ':d' => $ct['date'] ?? gmdate('c')
            ]);
        }
    }
}

// Read full CMS Data from SQL Database
function readCmsData() {
    try {
        $db = getDb();
        $result = [];

        // 1. Settings (siteTexts, bankInfo, videos, navTexts, pageEdits, etc.)
        $stmt = $db->query("SELECT setting_key, setting_value FROM cms_settings");
        while ($row = $stmt->fetch()) {
            $val = json_decode($row['setting_value'], true);
            $result[$row['setting_key']] = ($val !== null) ? $val : $row['setting_value'];
        }

        // 2. Gallery Images (ordered by insertion)
        $galleryStmt = $db->query("SELECT id, title, category, image_url as imageUrl, date_val as date FROM gallery_images ORDER BY rowid ASC");
        $result['galleryImages'] = $galleryStmt->fetchAll();

        // 3. Prayers
        $prayerStmt = $db->query("SELECT id, name, phone, email, request, date_iso as date, status FROM prayers ORDER BY created_at DESC");
        $result['prayers'] = $prayerStmt->fetchAll();

        // 4. Appointments
        $appStmt = $db->query("SELECT id, name, email, phone, date_val as date, time_val as time, status FROM appointments ORDER BY created_at DESC");
        $result['appointments'] = $appStmt->fetchAll();

        // 5. Contributions
        $ctStmt = $db->query("SELECT id, name, phone, email, type, ref, message, date_iso as date FROM contributions ORDER BY created_at DESC");
        $result['contributions'] = $ctStmt->fetchAll();

        $result['_lastServerUpdate'] = $result['_lastServerUpdate'] ?? gmdate('c');

        return $result;
    } catch (Exception $e) {
        error_log('Database read error: ' . $e->getMessage());
        return readJsonFallback();
    }
}

function readJsonFallback() {
    if (!file_exists(DATA_FILE)) return [];
    $raw = @file_get_contents(DATA_FILE);
    $d = json_decode($raw, true);
    return is_array($d) ? $d : [];
}

// Save CMS Data to SQL Database with Transaction
function saveCmsData($newData) {
    if (!is_array($newData)) return false;

    try {
        $db = getDb();
        $db->beginTransaction();

        $relationalKeys = ['galleryImages', 'prayers', 'appointments', 'contributions'];

        // Save all settings keys dynamically to cms_settings (siteTexts, bankInfo, videos, navTexts, pageEdits, etc.)
        foreach ($newData as $key => $val) {
            if (in_array($key, $relationalKeys)) continue;
            if ($key === '_lastServerUpdate' || $key === 'auditTimestamp' || $key === '_lastSavedLocal') continue;
            $stmt = $db->prepare("INSERT OR REPLACE INTO cms_settings (setting_key, setting_value, updated_at) VALUES (:k, :v, CURRENT_TIMESTAMP)");
            $stmt->execute([
                ':k' => $key,
                ':v' => is_scalar($val) ? (string)$val : json_encode($val, JSON_UNESCAPED_UNICODE)
            ]);
        }

        // Update galleryImages
        if (isset($newData['galleryImages']) && is_array($newData['galleryImages'])) {
            $db->exec("DELETE FROM gallery_images");
            $imgStmt = $db->prepare("INSERT INTO gallery_images (id, title, category, image_url, date_val) VALUES (:id, :title, :category, :img, :d)");
            foreach ($newData['galleryImages'] as $img) {
                $imgStmt->execute([
                    ':id' => $img['id'] ?? ('img-' . uniqid()),
                    ':title' => $img['title'] ?? '',
                    ':category' => $img['category'] ?? 'adoracion',
                    ':img' => $img['imageUrl'] ?? ($img['image_url'] ?? ''),
                    ':d' => $img['date'] ?? gmdate('Y-m-d')
                ]);
            }
        }

        // Update prayers if provided
        if (isset($newData['prayers']) && is_array($newData['prayers'])) {
            $db->exec("DELETE FROM prayers");
            $prStmt = $db->prepare("INSERT INTO prayers (id, name, phone, email, request, date_iso, status) VALUES (:id, :name, :phone, :email, :req, :d, :status)");
            foreach ($newData['prayers'] as $pr) {
                $prStmt->execute([
                    ':id' => $pr['id'] ?? ('pr-' . uniqid()),
                    ':name' => $pr['name'] ?? '',
                    ':phone' => $pr['phone'] ?? '',
                    ':email' => $pr['email'] ?? '',
                    ':req' => $pr['request'] ?? '',
                    ':d' => $pr['date'] ?? gmdate('c'),
                    ':status' => $pr['status'] ?? 'Pendiente'
                ]);
            }
        }

        // Update appointments if provided
        if (isset($newData['appointments']) && is_array($newData['appointments'])) {
            $db->exec("DELETE FROM appointments");
            $apStmt = $db->prepare("INSERT INTO appointments (id, name, email, phone, date_val, time_val, status) VALUES (:id, :name, :email, :phone, :d, :t, :status)");
            foreach ($newData['appointments'] as $ap) {
                $apStmt->execute([
                    ':id' => $ap['id'] ?? ('app-' . uniqid()),
                    ':name' => $ap['name'] ?? '',
                    ':email' => $ap['email'] ?? '',
                    ':phone' => $ap['phone'] ?? '',
                    ':d' => $ap['date'] ?? '',
                    ':t' => $ap['time'] ?? '',
                    ':status' => $ap['status'] ?? 'Pendiente'
                ]);
            }
        }

        // Update contributions if provided
        if (isset($newData['contributions']) && is_array($newData['contributions'])) {
            $db->exec("DELETE FROM contributions");
            $ctStmt = $db->prepare("INSERT INTO contributions (id, name, phone, email, type, ref, message, date_iso) VALUES (:id, :name, :phone, :email, :type, :ref, :msg, :d)");
            foreach ($newData['contributions'] as $ct) {
                $ctStmt->execute([
                    ':id' => $ct['id'] ?? ('ct-' . uniqid()),
                    ':name' => $ct['name'] ?? '',
                    ':phone' => $ct['phone'] ?? '',
                    ':email' => $ct['email'] ?? '',
                    ':type' => $ct['type'] ?? 'General',
                    ':ref' => $ct['ref'] ?? '',
                    ':msg' => $ct['message'] ?? '',
                    ':d' => $ct['date'] ?? gmdate('c')
                ]);
            }
        }

        // Update timestamp
        $time = gmdate('c');
        $timeStmt = $db->prepare("INSERT OR REPLACE INTO cms_settings (setting_key, setting_value, updated_at) VALUES ('_lastServerUpdate', :v, CURRENT_TIMESTAMP)");
        $timeStmt->execute([':v' => json_encode($time)]);

        $db->commit();

        // Write secondary JSON backup file
        @file_put_contents(DATA_FILE, json_encode(readCmsData(), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));

        return true;
    } catch (Exception $e) {
        if (isset($db) && $db->inTransaction()) {
            $db->rollBack();
        }
        error_log('Database write error: ' . $e->getMessage());
        return false;
    }
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
$route = preg_replace('#^index\.php/?#', '', $route);
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

// 0. HEALTH & DATABASE STATUS: GET /api/server-status
if ($route === 'server-status' && $method === 'GET') {
    try {
        $db = getDb();
        $driver = $db->getAttribute(PDO::ATTR_DRIVER_NAME);
        $imgCount = $db->query("SELECT COUNT(*) FROM gallery_images")->fetchColumn();
        $prCount = $db->query("SELECT COUNT(*) FROM prayers")->fetchColumn();
        $apCount = $db->query("SELECT COUNT(*) FROM appointments")->fetchColumn();
        $ctCount = $db->query("SELECT COUNT(*) FROM contributions")->fetchColumn();

        echo json_encode([
            'status' => 'online',
            'timestamp' => round(microtime(true) * 1000),
            'message' => 'Servidor El Faro CMS activo y en línea con Base de Datos SQL.',
            'engine' => 'PHP ' . PHP_VERSION,
            'database' => strtoupper($driver) . ' (SQL Relacional)',
            'storage' => 'Base de Datos SQL Persistente 24/7 en SiteGround',
            'stats' => [
                'galleryImages' => (int)$imgCount,
                'prayers' => (int)$prCount,
                'appointments' => (int)$apCount,
                'contributions' => (int)$ctCount
            ]
        ]);
    } catch (Exception $e) {
        echo json_encode([
            'status' => 'online',
            'timestamp' => round(microtime(true) * 1000),
            'engine' => 'PHP ' . PHP_VERSION,
            'databaseError' => $e->getMessage()
        ]);
    }
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
            'database' => 'SQL',
            'message' => 'Datos guardados en la Base de Datos SQL permanentemente en SiteGround.'
        ]);
    } else {
        http_response_code(500);
        echo json_encode(['error' => 'Error interno al escribir datos en la base de datos SQL.']);
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

    $id = 'pr-' . round(microtime(true) * 1000);
    $dateIso = gmdate('c');

    try {
        $db = getDb();
        $stmt = $db->prepare("INSERT INTO prayers (id, name, phone, email, request, date_iso, status) VALUES (:id, :name, :phone, :email, :req, :d, 'Pendiente')");
        $stmt->execute([
            ':id' => $id,
            ':name' => $name,
            ':phone' => $phone,
            ':email' => $email,
            ':req' => $request,
            ':d' => $dateIso
        ]);

        echo json_encode([
            'status' => 'success',
            'message' => 'Petición de oración guardada en la base de datos con bendición.',
            'id' => $id
        ]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Error al registrar la petición en la base de datos.']);
    }
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

    $id = 'app-' . round(microtime(true) * 1000);

    try {
        $db = getDb();
        $stmt = $db->prepare("INSERT INTO appointments (id, name, email, phone, date_val, time_val, status) VALUES (:id, :name, :email, :phone, :d, :t, 'Pendiente')");
        $stmt->execute([
            ':id' => $id,
            ':name' => $name,
            ':email' => $email,
            ':phone' => $phone,
            ':d' => $date,
            ':t' => $time
        ]);

        echo json_encode([
            'status' => 'success',
            'message' => 'Cita pastoral agendada en la base de datos con éxito.',
            'id' => $id
        ]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Error al agendar la cita en la base de datos.']);
    }
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

    $id = 'ct-' . round(microtime(true) * 1000);
    $dateIso = gmdate('c');

    try {
        $db = getDb();
        $stmt = $db->prepare("INSERT INTO contributions (id, name, phone, email, type, ref, message, date_iso) VALUES (:id, :name, :phone, :email, :type, :ref, :msg, :d)");
        $stmt->execute([
            ':id' => $id,
            ':name' => $name,
            ':phone' => $phone,
            ':email' => $email,
            ':type' => $type ?: 'General',
            ':ref' => $ref,
            ':msg' => $message,
            ':d' => $dateIso
        ]);

        echo json_encode([
            'status' => 'success',
            'message' => 'Reporte de aporte guardado en la base de datos. ¡Muchas gracias!',
            'id' => $id
        ]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Error al registrar el aporte en la base de datos.']);
    }
    exit;
}

// Fallback: 404 Not Found
http_response_code(404);
echo json_encode([
    'error' => 'Endpoint API no encontrado.',
    'requested_route' => $route,
    'method' => $method
]);
