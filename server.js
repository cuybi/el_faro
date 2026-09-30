/**
 * Backend Node.js Server & Hardened CMS Engine — El Faro CVC
 * Provides secure REST API endpoints, separated public inboxes, token authentication,
 * atomic write queues, and sensitive file isolation.
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'cms-data.json');
const TMP_FILE = path.join(__dirname, 'cms-data.json.tmp');

// Admin credentials (configurable via environment variable)
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@elfarocvc.com').toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'ElFaro2026!';

// In-memory active session tokens: Map<token, { createdAt: number, expiresAt: number }>
const activeSessions = new Map();
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

// Middleware: JSON parser with payload limits
app.use(express.json({ limit: '5mb' }));

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
  '.gitignore'
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
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token.' });
  }

  const token = authHeader.split(' ')[1];
  const session = activeSessions.get(token);

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized: Session expired or invalid.' });
  }

  if (Date.now() > session.expiresAt) {
    activeSessions.delete(token);
    return res.status(401).json({ error: 'Unauthorized: Session token expired.' });
  }

  req.adminSession = session;
  next();
}

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
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + SESSION_DURATION_MS;

    activeSessions.set(token, {
      email: cleanEmail,
      createdAt: Date.now(),
      expiresAt
    });

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
// 3. CMS CONTENT API
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
    await mutateCmsData(currentData => {
      // Preserve critical arrays if not explicitly provided
      return {
        ...currentData,
        ...newData,
        prayers: newData.prayers || currentData.prayers || [],
        appointments: newData.appointments || currentData.appointments || [],
        contributions: newData.contributions || currentData.contributions || [],
        _lastServerUpdate: new Date().toISOString()
      };
    });

    res.json({ status: 'success', message: 'Datos del CMS actualizados y sincronizados con éxito.' });
  } catch (err) {
    res.status(500).json({ error: 'Error interno al escribir datos del CMS.' });
  }
});

// Catch-all 404 for unknown API routes
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Endpoint API no encontrado.' });
});

// Start Server
app.listen(PORT, () => {
  console.log(`[El Faro CVC] Servidor Seguro y CMS activo en http://localhost:${PORT}`);
});
