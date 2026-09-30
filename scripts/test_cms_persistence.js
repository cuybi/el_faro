/**
 * Adversarial Verification Test Suite for El Faro CMS Persistence
 * Step 3 in Doubt-Driven Development
 */

const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000';
const DATA_FILE = path.join(__dirname, '..', 'cms-data.json');
const IMG_DIR = path.join(__dirname, '..', 'assets', 'img');

async function runTests() {
  console.log('=== [DOUBT-DRIVEN TEST] Iniciando Verificación Adversarial de Persistencia ===\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  // 1. Health Check
  try {
    const res = await fetch(`${BASE_URL}/api/server-status`);
    const json = await res.json();
    assert(res.status === 200 && json.status === 'online', 'Endpoint /api/server-status responde online');
  } catch (err) {
    assert(false, `/api/server-status falló: ${err.message}`);
  }

  // 2. Unauthenticated write rejection (Security invariant)
  try {
    const unauthRes = await fetch(`${BASE_URL}/api/cms-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ malicious: true })
    });
    assert(unauthRes.status === 401, 'POST /api/cms-data rechaza peticiones sin token (401 Unauthorized)');
  } catch (err) {
    assert(false, `Fallo en prueba no autenticada: ${err.message}`);
  }

  // 3. Admin Login
  let token = null;
  try {
    const loginRes = await fetch(`${BASE_URL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@elfarocvc.com',
        password: process.env.ADMIN_PASSWORD || 'ElFaro2026!'
      })
    });
    const loginJson = await loginRes.json();
    token = loginJson.token;
    assert(loginRes.status === 200 && !!token, 'Login exitoso y obtención de token HMAC');
  } catch (err) {
    assert(false, `Fallo en login de admin: ${err.message}`);
  }

  if (!token) {
    console.error('Abortando pruebas debido a falta de token.');
    process.exit(1);
  }

  // 4. Token verification endpoint
  try {
    const verifyRes = await fetch(`${BASE_URL}/api/admin/verify-token`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const verifyJson = await verifyRes.json();
    assert(verifyRes.status === 200 && verifyJson.status === 'valid', 'Verificación de token en /api/admin/verify-token es válida');
  } catch (err) {
    assert(false, `Fallo al verificar token: ${err.message}`);
  }

  // 5. Test Image Upload
  let uploadedImageUrl = null;
  let localUploadedFile = null;
  try {
    // 1x1 transparent PNG in base64
    const samplePngBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    
    const uploadRes = await fetch(`${BASE_URL}/api/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        fileName: 'test_foto_culto.png',
        fileData: samplePngBase64
      })
    });

    const uploadJson = await uploadRes.json();
    uploadedImageUrl = uploadJson.url;
    assert(uploadRes.status === 200 && !!uploadedImageUrl, `POST /api/upload retorna URL relativa: ${uploadedImageUrl}`);

    // Verify physical existence on disk
    if (uploadedImageUrl) {
      localUploadedFile = path.join(__dirname, '..', uploadedImageUrl);
      const existsOnDisk = fs.existsSync(localUploadedFile);
      const stats = existsOnDisk ? fs.statSync(localUploadedFile) : null;
      assert(existsOnDisk && stats.size > 0, `Archivo físico verificado en disco (${localUploadedFile}, tamaño: ${stats ? stats.size : 0} bytes)`);
    }
  } catch (err) {
    assert(false, `Fallo en subida de imagen: ${err.message}`);
  }

  // 6. Test CMS Data Modification & Physical Disk Persistence
  const testMarker = 'TestPersistence_' + Date.now();
  try {
    // Read current raw data directly from disk
    const currentData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

    // Inject test modifications
    currentData.siteTexts = currentData.siteTexts || {};
    currentData.siteTexts.heroTitle = `Hero Title Modificado ${testMarker}`;
    currentData.bankInfo = currentData.bankInfo || {};
    currentData.bankInfo.bankName = `Banco Test ${testMarker}`;

    if (uploadedImageUrl) {
      currentData.galleryImages = currentData.galleryImages || [];
      currentData.galleryImages.unshift({
        id: 'img-' + Date.now(),
        title: `Foto de Prueba ${testMarker}`,
        category: 'adoracion',
        imageUrl: uploadedImageUrl,
        date: new Date().toISOString().split('T')[0]
      });
    }

    // Send update via API
    const saveRes = await fetch(`${BASE_URL}/api/cms-data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(currentData)
    });

    const saveJson = await saveRes.json();
    assert(saveRes.status === 200 && saveJson.status === 'success', 'POST /api/cms-data respondió 200 OK con confirmación de éxito');

    // Read directly from disk file to verify persistence
    const reloadedData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    assert(
      reloadedData.siteTexts && reloadedData.siteTexts.heroTitle === `Hero Title Modificado ${testMarker}`,
      `Verificación en disco: siteTexts.heroTitle persistido en cms-data.json ("${reloadedData.siteTexts.heroTitle}")`
    );
    assert(
      reloadedData.bankInfo && reloadedData.bankInfo.bankName === `Banco Test ${testMarker}`,
      `Verificación en disco: bankInfo.bankName persistido en cms-data.json ("${reloadedData.bankInfo.bankName}")`
    );

    if (uploadedImageUrl) {
      const foundImg = (reloadedData.galleryImages || []).find(img => img.imageUrl === uploadedImageUrl);
      assert(!!foundImg, `Verificación en disco: nueva foto con URL ${uploadedImageUrl} persistida en galleryImages`);
    }
  } catch (err) {
    assert(false, `Fallo en prueba de guardado en disco: ${err.message}`);
  }

  // 7. Cleanup test artifacts (optional, keep data file intact)
  if (localUploadedFile && fs.existsSync(localUploadedFile)) {
    try {
      fs.unlinkSync(localUploadedFile);
      console.log(`[Cleanup] Imagen temporal de prueba eliminada: ${localUploadedFile}`);
    } catch (_) {}
  }

  console.log(`\n=== Resumen de Pruebas: ${passed} Pasadas, ${failed} Fallidas ===`);
  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('¡TODAS LAS PRUEBAS DE PERSISTENCIA Y SEGURIDAD HAN PASADO EXITOSAMENTE!');
  }
}

runTests();
