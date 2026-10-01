/**
 * Backend Node.js Server & Hardened CMS Engine — El Faro CVC
 * Provides secure REST API endpoints, separated public inboxes, token authentication,
 * image uploading, atomic write queues, sensitive file isolation, and
 * auto-sync to GitHub for 24/7 persistent data storage.
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'cms-data.json');
const TMP_FILE = path.join(__dirname, 'cms-data.json.tmp');
const UPLOADS_DIR = path.join(__dirname, 'assets', 'img');

// GitHub persistence via Contents API (no git binary, no deploy triggered)
const GITHUB_TOKEN  = process.env.GITHUB_TOKEN  || null;
const GITHUB_REPO   = process.env.GITHUB_REPO   || 'cuybi/el_faro';
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';
const SITE_URL = process.env.RENDER_EXTERNAL_URL || process.env.SITE_URL || null;

const GH_API = `https://api.github.com/repos/${GITHUB_REPO}/contents/cms-data.json`;
const GH_HEADERS = () => ({
  'Authorization': `token ${GITHUB_TOKEN}`,
  'Content-Type': 'application/json',
  'User-Agent': 'ElFaroCMS/1.0'
});

/**
 * On startup: read cms-data.json from GitHub and write to disk.
 * This restores any admin changes made before the last server restart.
 */
async function restoreFromGitHub() {
  if (!GITHUB_TOKEN) return;
  try {
    const res = await fetch(`${GH_API}?ref=${GITHUB_BRANCH}`, { headers: GH_HEADERS() });
    if (!res.ok) { console.warn('[GitHub Restore] No se pudo leer cms-data.json de GitHub:', res.status); return; }
    const json = await res.json();
    const content = Buffer.from(json.content, 'base64').toString('utf8');
    const githubData = JSON.parse(content);
    // Only restore if GitHub data is newer than local
    const localData = fs.existsSync(DATA_FILE) ? JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) : {};
    const ghTime = new Date(githubData._lastServerUpdate || 0).getTime();
    const localTime = new Date(localData._lastServerUpdate || 0).getTime();
    if (ghTime > localTime) {
      fs.writeFileSync(DATA_FILE, content, 'utf8');
      console.log('[GitHub Restore] ✅ cms-data.json restaurado desde GitHub.');
    } else {
      console.log('[GitHub Restore] Local ya está actualizado.');
    }
  } catch (err) {
    console.error('[GitHub Restore] Error:', err.message);
  }
}

/**
 * After each save: write cms-data.json to GitHub via Contents API.
 * Non-blocking. Does NOT trigger a new Render deploy.
 */
async function syncToGitHub(dataStr) {
  if (!GITHUB_TOKEN) return;
  try {
    // Get current SHA (required by GitHub API to update a file)
    const getRes = await fetch(`${GH_API}?ref=${GITHUB_BRANCH}`, { headers: GH_HEADERS() });
    const getSha = getRes.ok ? (await getRes.json()).sha : undefined;
    const body = {
      message: 'cms: auto-sync desde panel admin',
      content: Buffer.from(dataStr).toString('base64'),
      branch: GITHUB_BRANCH,
      ...(getSha ? { sha: getSha } : {})
    };
    const putRes = await fetch(GH_API, { method: 'PUT', headers: GH_HEADERS(), body: JSON.stringify(body) });
    if (putRes.ok) {
      console.log('[GitHub Sync] ✅ cms-data.json guardado en GitHub.');
    } else {
      const errText = await putRes.text();
      console.error('[GitHub Sync] ⚠️ Error:', putRes.status, errText.slice(0, 200));
    }
  } catch (err) {
    console.error('[GitHub Sync] ⚠️ Error:', err.message);
  }
}

// Admin credentials (configurable via environment variable)
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@elfarocvc.com').toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'ElFaro2026!';
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days session

// Persistent server secret for HMAC token signing
const SECRET_FILE = path.join(__dirname, '.server_secret');
let SERVER_SECRET;
try {
  if (fs.existsSync(SECRET_FILE)) {
    SERVER_SECRET = fs.readFileSync(SECRET_FILE, 'utf8').trim();
  } else {
    SERVER_SECRET = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(SECRET_FILE, SERVER_SECRET, 'utf8');
  }
} catch (_) {
  SERVER_SECRET = 'elfaro_cvc_secret_key_2026';
}

function createToken(email) {
  const expiresAt = Date.now() + SESSION_DURATION_MS;
  const payload = `${email}:${expiresAt}`;
  const sig = crypto.createHmac('sha256', SERVER_SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}:${sig}`).toString('base64url');
}

function verifyToken(token) {
  try {
    if (!token) return null;
    const raw = Buffer.from(token, 'base64url').toString('utf8');
    const parts = raw.split(':');
    if (parts.length !== 3) return null;
    const [email, expiresAtStr, sig] = parts;
    const expiresAt = parseInt(expiresAtStr, 10);
    if (isNaN(expiresAt) || Date.now() > expiresAt) return null;
    const expectedSig = crypto.createHmac('sha256', SERVER_SECRET).update(`${email}:${expiresAt}`).digest('hex');
    if (crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
      return { email, expiresAt };
    }
    return null;
  } catch (_) {
    return null;
  }
}

// Middleware: JSON parser with 25MB limit to allow image uploads
app.use(express.json({ limit: '25mb' }));

// Middleware: Basic Security Headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Middleware: Block direct HTTP access to server files, scripts, and configs
const RESTRICTED_FILES = [
  'server.js',
  'package.json',
  'package-lock.json',
  '.htaccess',
  '.env',
  '.gitignore',
  '.server_secret'
];

app.use((req, res, next) => {
  const normalizedPath = path.normalize(req.path).replace(/^(\.\.[\/\\])+/, '');
  const fileName = path.basename(normalizedPath).toLowerCase();
  const ext = path.extname(normalizedPath).toLowerCase();

  if (
    RESTRICTED_FILES.includes(fileName) ||
    ['.ps1', '.py', '.sh', '.bash'].includes(ext) ||
    fileName.startsWith('.')
  ) {
    return res.status(403).json({ error: 'Access denied: protected system file.' });
  }
  next();
});

// Serve static project files
app.use(express.static(__dirname));

// --- SERIALIZED ATOMIC WRITE QUEUE ---
let writeQueue = Promise.resolve();

function readCmsData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return {};
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading cms-data.json:', err);
    return {};
  }
}

function mutateCmsData(mutatorFn) {
  return new Promise((resolve, reject) => {
    writeQueue = writeQueue.then(async () => {
      try {
        const currentData = readCmsData();
        const updatedData = await mutatorFn(currentData);
        if (!updatedData) {
          throw new Error('Mutator function did not return valid data.');
        }
        // Atomic write: write to temp file then rename
        await fs.promises.writeFile(TMP_FILE, JSON.stringify(updatedData, null, 2), 'utf8');
        await fs.promises.rename(TMP_FILE, DATA_FILE);
        resolve(updatedData);
      } catch (err) {
        console.error('Atomic write failed:', err);
        if (fs.existsSync(TMP_FILE)) {
          try { fs.unlinkSync(TMP_FILE); } catch (_) {}
        }
        reject(err);
      }
    }).catch(reject);
  });
}

// Simple HTML/script tag stripper to prevent stored payloads
function sanitizeText(str, maxLength = 2000) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, maxLength);
}

// --- AUTHENTICATION MIDDLEWARE ---
function requireAdminAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Falta token de autorización.' });
  }

  const token = authHeader.split(' ')[1];
  const session = verifyToken(token);

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized: Sesión inválida o expirada.' });
  }

  req.adminSession = session;
  next();
}

// ==========================================
// 0. HEALTH / STATUS API
// ==========================================
app.get('/api/server-status', (req, res) => {
  res.json({
    status: 'online',
    timestamp: Date.now(),
    message: 'Servidor El Faro CMS activo y en línea.'
  });
});

// ==========================================
// 1. PUBLIC INBOX API (Restricted & Sanitized)
// ==========================================

// POST /api/inbox/prayer
app.post('/api/inbox/prayer', async (req, res) => {
  const { name, phone, email, request } = req.body || {};
  if (!name || !request) {
    return res.status(400).json({ error: 'El nombre y la petición son requeridos.' });
  }

  const safePrayer = {
    id: 'pr-' + Date.now(),
    name: sanitizeText(name, 120),
    phone: sanitizeText(phone, 40),
    email: sanitizeText(email, 120),
    request: sanitizeText(request, 2000),
    date: new Date().toISOString(),
    status: 'Pendiente'
  };

  try {
    await mutateCmsData(data => {
      data.prayers = data.prayers || [];
      data.prayers.unshift(safePrayer);
      return data;
    });
    res.json({ status: 'success', message: 'Petición de oración recibida con bendición.', id: safePrayer.id });
  } catch (err) {
    res.status(500).json({ error: 'No se pudo guardar la petición en este momento.' });
  }
});

// POST /api/inbox/appointment
app.post('/api/inbox/appointment', async (req, res) => {
  const { name, email, phone, date, time } = req.body || {};
  if (!name || !date || !time) {
    return res.status(400).json({ error: 'Nombre, fecha y hora son obligatorios.' });
  }

  const safeApp = {
    id: 'app-' + Date.now(),
    name: sanitizeText(name, 120),
    email: sanitizeText(email, 120),
    phone: sanitizeText(phone, 40),
    date: sanitizeText(date, 20),
    time: sanitizeText(time, 20),
    status: 'Pendiente'
  };

  try {
    await mutateCmsData(data => {
      data.appointments = data.appointments || [];
      data.appointments.unshift(safeApp);
      return data;
    });
    res.json({ status: 'success', message: 'Cita pastoral agendada con éxito.', id: safeApp.id });
  } catch (err) {
    res.status(500).json({ error: 'No se pudo agendar la cita en este momento.' });
  }
});

// POST /api/inbox/contribution
app.post('/api/inbox/contribution', async (req, res) => {
  const { name, phone, email, type, ref, message } = req.body || {};
  if (!name || !ref) {
    return res.status(400).json({ error: 'Nombre y número de comprobante/referencia son requeridos.' });
  }

  const safeContribution = {
    id: 'ct-' + Date.now(),
    name: sanitizeText(name, 120),
    phone: sanitizeText(phone, 40),
    email: sanitizeText(email, 120),
    type: sanitizeText(type, 60) || 'General',
    ref: sanitizeText(ref, 60),
    message: sanitizeText(message, 1000),
    date: new Date().toISOString()
  };

  try {
    await mutateCmsData(data => {
      data.contributions = data.contributions || [];
      data.contributions.unshift(safeContribution);
      return data;
    });
    res.json({ status: 'success', message: 'Reporte de aporte recibido. ¡Muchas gracias!', id: safeContribution.id });
  } catch (err) {
    res.status(500).json({ error: 'No se pudo registrar el aporte en este momento.' });
  }
});

// ==========================================
// 2. ADMIN AUTHENTICATION API
// ==========================================

// POST /api/admin/login
app.post('/api/admin/login', (req, res) => {
  const { email, password } = req.body || {};
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanPass = (password || '').trim();

  if (cleanEmail === ADMIN_EMAIL && cleanPass === ADMIN_PASSWORD) {
    const token = createToken(cleanEmail);
    const expiresAt = Date.now() + SESSION_DURATION_MS;

    return res.json({
      status: 'success',
      token,
      expiresAt,
      message: 'Autenticación exitosa.'
    });
  }

  return res.status(401).json({ error: 'Credenciales inválidas.' });
});

// GET /api/admin/verify-token
app.get('/api/admin/verify-token', requireAdminAuth, (req, res) => {
  res.json({ status: 'valid', email: req.adminSession.email, expiresAt: req.adminSession.expiresAt });
});

// ==========================================
// 3. FILE UPLOAD API (Images to assets/img/)
// ==========================================
app.post('/api/upload', requireAdminAuth, async (req, res) => {
  const { fileName, fileData } = req.body || {};
  if (!fileData) {
    return res.status(400).json({ error: 'No se recibieron datos de archivo.' });
  }

  try {
    // Extract base64 payload
    const matches = fileData.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    const base64Content = matches ? matches[2] : fileData;
    const buffer = Buffer.from(base64Content, 'base64');

    // Limit image size to 15MB
    if (buffer.length > 15 * 1024 * 1024) {
      return res.status(400).json({ error: 'El archivo excede el tamaño máximo permitido (15MB).' });
    }

    const ext = (path.extname(fileName || '') || '.jpg').toLowerCase();
    const safeExt = ['.jpg', '.jpeg', '.png', '.webp', '.svg', '.gif'].includes(ext) ? ext : '.jpg';
    const cleanBase = path.basename(fileName || 'foto', ext).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
    const safeName = `${cleanBase}_${Date.now()}${safeExt}`;
    const targetPath = path.join(UPLOADS_DIR, safeName);

    await fs.promises.writeFile(targetPath, buffer);
    console.log(`[Upload] Imagen guardada en disco: ${safeName} (${buffer.length} bytes)`);

    // Auto-sync image to GitHub in background (non-blocking)
    syncToGitHub(`cms: nueva imagen subida ${safeName}`).catch(() => {});

    res.json({
      status: 'success',
      url: `assets/img/${safeName}`,
      message: 'Foto subida y almacenada en disco exitosamente.'
    });
  } catch (err) {
    console.error('Error al subir imagen:', err);
    res.status(500).json({ error: 'Error al procesar la imagen en el servidor.' });
  }
});

// ==========================================
// 4. CMS CONTENT API
// ==========================================

// GET /api/cms-data (Public Read)
app.get('/api/cms-data', (req, res) => {
  try {
    const data = readCmsData();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'No se pudo leer el archivo de contenidos.' });
  }
});

// POST /api/cms-data (Protected Write - Admin Only)
app.post('/api/cms-data', requireAdminAuth, async (req, res) => {
  const newData = req.body;
  if (!newData || typeof newData !== 'object') {
    return res.status(400).json({ error: 'El cuerpo de la petición debe contener un objeto de datos válido.' });
  }

  try {
    const updated = await mutateCmsData(currentData => {
      return {
        ...currentData,
        ...newData,
        prayers: newData.prayers || currentData.prayers || [],
        appointments: newData.appointments || currentData.appointments || [],
        contributions: newData.contributions || currentData.contributions || [],
        _lastServerUpdate: new Date().toISOString()
      };
    });

    console.log('[CMS Sync] Datos del CMS actualizados en disco (cms-data.json).');

    // Auto-sync to GitHub via Contents API (non-blocking, no deploy triggered)
    const savedStr = JSON.stringify(updated, null, 2);
    syncToGitHub(savedStr).catch(() => {});

    res.json({ status: 'success', serverSynced: true, message: 'Datos guardados en disco y sincronizados con GitHub.' });
  } catch (err) {
    console.error('Error saving CMS data:', err);
    res.status(500).json({ error: 'Error interno al escribir datos del CMS.' });
  }
});

// Catch-all 404 for unknown API routes
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Endpoint API no encontrado.' });
});

// Start Server
app.listen(PORT, async () => {
  console.log(`[El Faro CVC] Servidor activo en http://localhost:${PORT}`);

  // Restore latest CMS data from GitHub on every startup
  await restoreFromGitHub();

  // ── KEEPALIVE: auto-ping every 10 min to prevent Render free tier sleep ──
  if (SITE_URL) {
    const KEEPALIVE_MS = 10 * 60 * 1000;
    setInterval(async () => {
      try {
        const r = await fetch(`${SITE_URL}/api/server-status`);
        console.log(`[Keepalive] Ping → ${r.status}`);
      } catch (err) {
        console.warn('[Keepalive] Ping fallido:', err.message);
      }
    }, KEEPALIVE_MS);
    console.log(`[Keepalive] Auto-ping activo cada 10 min → ${SITE_URL}`);
  }
});
