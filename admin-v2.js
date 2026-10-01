/**
 * Admin Controller Engine — El Faro CMS
 * Handles Login Authentication, Tab Switching, CRUD operations and Data Sync.
 */

(function() {
  'use strict';

  const AUTH_KEY = 'elfaro_admin_logged';
  const PASS_KEY = 'elfaro_admin_password';
  // ponytail: universal endpoint resolver for PHP (SiteGround) and Node.js
  const apiRoute = (r) => (window.getApiUrl ? window.getApiUrl(r) : '/api/index.php?route=' + r);

  // HTML Entity escaper to prevent Stored XSS
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Default credentials (fallback for offline mode)
  let adminPass = localStorage.getItem(PASS_KEY) || 'ElFaro2026!';

  function bootAdmin() {
    checkServerConnection();
    setInterval(checkServerConnection, 10000);
    checkAuthStatus();
    setupLoginHandler();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootAdmin);
  } else {
    bootAdmin();
  }

  // Monitor real-time connection with Node.js backend
  window.checkServerConnection = async function() {
    const badge = document.getElementById('serverStatusBadge');
    const text = document.getElementById('serverStatusText');
    if (!badge || !text) return false;

    try {
      const res = await fetch(apiRoute('server-status'), { cache: 'no-store' });
      if (res.ok) {
        const sJson = await res.json().catch(() => ({}));
        badge.style.background = 'rgba(39, 201, 63, 0.15)';
        badge.style.borderColor = 'rgba(39, 201, 63, 0.4)';
        badge.style.color = '#27c93f';
        const dbInfo = sJson.database ? `(${sJson.database} Activa)` : '(Base de Datos Activa)';
        text.innerHTML = `<i class="fas fa-database" style="margin-right: 4px;"></i> Servidor Conectado ${dbInfo}`;
        return true;
      }
    } catch (_) {}

    badge.style.background = 'rgba(255, 95, 86, 0.15)';
    badge.style.borderColor = 'rgba(255, 95, 86, 0.4)';
    badge.style.color = '#ff5f56';
    text.innerHTML = '<i class="fas fa-exclamation-triangle" style="margin-right: 4px;"></i> Servidor Desconectado (Solo Local)';
    return false;
  };

  // ponytail: listen to cmsDataReady custom event from cms-loader.js to avoid initial race conditions
  document.addEventListener('cmsDataReady', () => {
    const token = sessionStorage.getItem('elfaro_admin_token') || localStorage.getItem('elfaro_admin_token');
    if (token || sessionStorage.getItem(AUTH_KEY) === 'true') {
      try { initDashboard(); } catch(e) { console.warn(e); }
    }
  });

  async function checkAuthStatus() {
    const token = sessionStorage.getItem('elfaro_admin_token') || localStorage.getItem('elfaro_admin_token');
    const hasLoggedFlag = sessionStorage.getItem(AUTH_KEY) === 'true' || localStorage.getItem(AUTH_KEY) === 'true';
    const overlay = document.getElementById('loginOverlay');
    const dashboard = document.getElementById('adminDashboard');

    // If a token is stored, verify its signature with the server
    if (token) {
      try {
        const verifyRes = await fetch(apiRoute('admin/verify-token'), {
          headers: { 'Authorization': 'Bearer ' + token },
          cache: 'no-store'
        });
        if (verifyRes.ok) {
          sessionStorage.setItem('elfaro_admin_token', token);
          localStorage.setItem('elfaro_admin_token', token);
          sessionStorage.setItem(AUTH_KEY, 'true');
          localStorage.setItem(AUTH_KEY, 'true');
        } else {
          // Token expired or invalid: attempt automatic re-auth
          try {
            const reauthResp = await fetch(apiRoute('admin/login'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: 'admin@elfarocvc.com', password: adminPass })
            });
            if (reauthResp.ok) {
              const reauthJson = await reauthResp.json();
              if (reauthJson.token) {
                token = reauthJson.token;
                sessionStorage.setItem('elfaro_admin_token', token);
                localStorage.setItem('elfaro_admin_token', token);
                sessionStorage.setItem(AUTH_KEY, 'true');
                localStorage.setItem(AUTH_KEY, 'true');
              }
            }
          } catch (_) {}

          if (!sessionStorage.getItem('elfaro_admin_token')) {
            sessionStorage.removeItem('elfaro_admin_token');
            sessionStorage.removeItem(AUTH_KEY);
            localStorage.removeItem('elfaro_admin_token');
            localStorage.removeItem(AUTH_KEY);
            if (overlay) overlay.style.display = 'flex';
            if (dashboard) dashboard.style.display = 'none';
            return;
          }
        }
      } catch (err) {
        // Server offline: allow offline session if flag exists
        console.warn('Servidor offline al verificar token:', err.message);
      }
    }

    const isLogged = hasLoggedFlag && (token || !window.location.protocol.startsWith('http'));
    if (isLogged) {
      if (overlay) overlay.style.display = 'none';
      if (dashboard) dashboard.style.display = 'flex';
      try { initDashboard(); } catch (err) { console.warn('Dashboard init:', err); }
    } else {
      if (overlay) overlay.style.display = 'flex';
      if (dashboard) dashboard.style.display = 'none';
    }
  }

  window.handleLoginSubmit = async function(e) {
    if (e) {
      if (e.preventDefault) e.preventDefault();
      if (e.stopPropagation) e.stopPropagation();
    }
    const emailEl = document.getElementById('loginEmail');
    const passEl = document.getElementById('loginPassword');
    const email = (emailEl ? emailEl.value : '').trim();
    const pass = (passEl ? passEl.value : '').trim();
    const errorEl = document.getElementById('loginError');

    // 1. Try secure backend authentication
    try {
      const resp = await fetch(apiRoute('admin/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass })
      });

      if (resp.ok) {
        const result = await resp.json();
        if (result.token) {
          sessionStorage.setItem('elfaro_admin_token', result.token);
          localStorage.setItem('elfaro_admin_token', result.token);
          sessionStorage.setItem(AUTH_KEY, 'true');
          localStorage.setItem(AUTH_KEY, 'true');
          if (errorEl) errorEl.style.display = 'none';
          checkAuthStatus();
          checkServerConnection();
          showToast('¡Bienvenido al Panel de Administración!');
          return false;
        }
      } else {
        if (errorEl) {
          errorEl.textContent = 'Credenciales inválidas o acceso no autorizado.';
          errorEl.style.display = 'block';
        }
        return false;
      }
    } catch (networkErr) {
      // 2. Offline / local testing fallback if Node server is not active
      console.warn('Servidor backend no disponible, evaluando sesión local:', networkErr);
      const validPass = localStorage.getItem(PASS_KEY) || 'ElFaro2026!';
      if (email.toLowerCase() === 'admin@elfarocvc.com' && (pass === validPass || pass === 'ElFaro2026!')) {
        sessionStorage.setItem(AUTH_KEY, 'true');
        localStorage.setItem(AUTH_KEY, 'true');
        if (errorEl) errorEl.style.display = 'none';
        checkAuthStatus();
        showToast('Modo sin conexión: sesión local iniciada.', 'warning');
        return false;
      } else {
        if (errorEl) {
          errorEl.textContent = 'Credenciales inválidas.';
          errorEl.style.display = 'block';
        }
        return false;
      }
    }
  };

  function setupLoginHandler() {
    const loginForm = document.getElementById('loginForm');
    if (!loginForm) return;
    loginForm.onsubmit = window.handleLoginSubmit;
  }

  window.logout = function() {
    sessionStorage.removeItem('elfaro_admin_token');
    localStorage.removeItem('elfaro_admin_token');
    sessionStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(AUTH_KEY);
    checkAuthStatus();
    showToast('Sesión cerrada correctamente.');
  };

  // Tab Navigation Controller
  window.switchTab = function(tabName) {
    document.querySelectorAll('.sidebar-menu a').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(el => el.classList.remove('active'));

    const activeLink = document.querySelector(`.sidebar-menu a[href="#${tabName}"]`);
    if (activeLink) activeLink.classList.add('active');

    const targetTab = document.getElementById(`tab-${tabName}`);
    if (targetTab) targetTab.classList.add('active');

    const titles = {
      overview: 'Resumen General',
      images: 'Galería de Fotos',
      videos: 'Prédicas y Videos',
      diezmos: 'Datos Bancarios y Código QR',
      texts: 'Textos del Sitio',
      inbox: 'Bandeja de Entrada',
      security: 'Seguridad'
    };
    document.getElementById('tabTitle').innerText = titles[tabName] || 'Administración';
  };

  function applyHashNavigation() {
    const hash = (window.location.hash || '').replace('#', '').trim();
    if (hash && ['overview', 'images', 'videos', 'diezmos', 'texts', 'inbox', 'security'].includes(hash)) {
      window.switchTab(hash);
    }
  }
  window.addEventListener('hashchange', applyHashNavigation);

  // Init Dashboard Data & Tables
  function initDashboard() {
    window.CMSData = window.CMSData || {};
    const data = window.CMSData;

    // 1. Update Metrics
    document.getElementById('metricImages').innerText = (data.galleryImages || []).length;
    document.getElementById('metricVideos').innerText = (data.videos || []).length;
    document.getElementById('metricPrayers').innerText = (data.prayers || []).length;
    document.getElementById('metricContributions').innerText = (data.contributions || []).length;
    if (document.getElementById('metricAppointments')) {
      document.getElementById('metricAppointments').innerText = (data.appointments || []).length;
    }

    // 2. Populate Images Table
    renderImagesTable();

    // 3. Populate Videos Table
    renderVideosTable();

    // 4. Populate Bank & Text Forms
    populateForms();

    // 5. Populate Inbox Tables
    renderInboxTables();

    // 6. Deep Linking URL Hash Navigation
    applyHashNavigation();
  }

  // --- IMAGES CRUD ---
  function renderImagesTable() {
    const tbody = document.getElementById('imagesTableBody');
    if (!tbody) return;
    const images = (window.CMSData && window.CMSData.galleryImages) || [];

    if (images.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="padding: 50px 20px; text-align: center;">
            <div style="max-width: 440px; margin: 0 auto; padding: 35px 25px; background: rgba(4, 28, 44, 0.6); border: 1px dashed rgba(255, 220, 51, 0.35); border-radius: 20px; box-shadow: 0 15px 40px rgba(0,0,0,0.4);">
              <div style="width: 64px; height: 64px; border-radius: 50%; background: rgba(255, 220, 51, 0.12); border: 1px solid rgba(255, 220, 51, 0.4); color: var(--color-accent); font-size: 1.8rem; display: flex; align-items: center; justify-content: center; margin: 0 auto 18px; box-shadow: 0 0 25px rgba(255, 220, 51, 0.18);">
                <i class="fas fa-images"></i>
              </div>
              <h4 style="color: #ffffff; font-family: var(--font-heading); font-size: 1.3rem; margin: 0 0 8px 0;">Sin Fotografías Registradas</h4>
              <p style="color: var(--text-muted); font-size: 0.9rem; line-height: 1.5; margin: 0 0 22px 0;">Sube fotos de tus cultos, eventos de jóvenes o actividades para publicarlas al instante en el sitio web.</p>
              <button class="btn-solid-primary" onclick="openAddImageModal()" style="padding: 12px 24px; border-radius: 12px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 8px;">
                <i class="fas fa-cloud-upload-alt"></i> Subir Primera Foto
              </button>
            </div>
          </td>
        </tr>`;
      return;
    }

    tbody.innerHTML = images.map((img, index) => `
      <tr>
        <td><img src="${escapeHtml(img.imageUrl)}" alt="${escapeHtml(img.title)}" onerror="this.onerror=null;this.src='assets/img/worship.jpg';" style="width: 54px; height: 54px; object-fit: cover; border-radius: 12px; border: 1px solid rgba(255,220,51,0.25);"></td>
        <td><strong style="color: #fff;">${escapeHtml(img.title)}</strong></td>
        <td><span style="background: rgba(255,220,51,0.15); border: 1px solid rgba(255,220,51,0.3); color: var(--color-accent); padding: 5px 12px; border-radius: 20px; font-size: 0.78rem; font-weight: 600; text-transform: uppercase;">${escapeHtml(img.category || 'General')}</span></td>
        <td>${escapeHtml(img.date || 'N/A')}</td>
        <td>
          <button class="action-btn danger" onclick="deleteImage('${escapeHtml(img.id)}')"><i class="fas fa-trash"></i> Eliminar</button>
        </td>
      </tr>
    `).join('');
  }

  let pendingImageUpload = null;

  window.handleImageFileSelect = function(e) {
    const file = e.target.files && e.target.files[0];
    const previewBox = document.getElementById('newImgPreviewBox');
    const previewImg = document.getElementById('newImgPreviewImg');
    const urlInput = document.getElementById('newImgUrl');

    if (!file) {
      pendingImageUpload = null;
      if (previewBox) previewBox.style.display = 'none';
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      alert('La imagen seleccionada supera el límite máximo permitido de 15MB.');
      e.target.value = '';
      pendingImageUpload = null;
      if (previewBox) previewBox.style.display = 'none';
      return;
    }

    const reader = new FileReader();
    reader.onload = function(evt) {
      pendingImageUpload = {
        name: file.name,
        data: evt.target.result
      };
      if (previewImg) previewImg.src = evt.target.result;
      if (previewBox) previewBox.style.display = 'block';
      if (urlInput) urlInput.value = '';
    };
    reader.readAsDataURL(file);
  };

  window.handleImageUrlInput = function(val) {
    const previewBox = document.getElementById('newImgPreviewBox');
    const previewImg = document.getElementById('newImgPreviewImg');
    const fileInput = document.getElementById('newImgFile');

    const cleanVal = (val || '').trim();
    if (cleanVal) {
      pendingImageUpload = null;
      if (fileInput) fileInput.value = '';
      if (previewImg) previewImg.src = cleanVal;
      if (previewBox) previewBox.style.display = 'block';
    } else {
      if (!pendingImageUpload && previewBox) {
        previewBox.style.display = 'none';
      }
    }
  };

  window.openAddImageModal = function() {
    const modal = document.getElementById('modalAddImage');
    if (modal) {
      const form = modal.querySelector('form');
      if (form) form.reset();
      pendingImageUpload = null;
      const previewBox = document.getElementById('newImgPreviewBox');
      const previewImg = document.getElementById('newImgPreviewImg');
      if (previewBox) previewBox.style.display = 'none';
      if (previewImg) previewImg.src = '';
      const btn = document.getElementById('btnPublishImage');
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> PUBLICAR FOTO EN GALERÍA';
      }
      modal.style.display = 'flex';
    }
  };

  window.closeModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
  };

  // Close modals on outside backdrop click or Escape key
  document.addEventListener('click', (e) => {
    if (e.target && e.target.classList && e.target.classList.contains('admin-modal-overlay')) {
      e.target.style.display = 'none';
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.admin-modal-overlay').forEach(el => {
        el.style.display = 'none';
      });
    }
  });

  window.saveNewImage = async function(e) {
    if (e) {
      if (e.preventDefault) e.preventDefault();
      if (e.stopPropagation) e.stopPropagation();
    }

    const titleEl = document.getElementById('newImgTitle');
    const catEl = document.getElementById('newImgCategory');
    const urlEl = document.getElementById('newImgUrl');
    const publishBtn = document.getElementById('btnPublishImage');

    const title = (titleEl ? titleEl.value : '').trim();
    const category = catEl ? catEl.value : 'adoracion';
    let imageUrl = (urlEl ? urlEl.value : '').trim();

    if (!title) {
      showToast('Por favor ingresa un título para la foto.', 'warning');
      return;
    }

    if (!pendingImageUpload && !imageUrl) {
      showToast('Debes seleccionar una foto de tu equipo o ingresar una URL.', 'warning');
      return;
    }

    if (publishBtn) {
      publishBtn.disabled = true;
      publishBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Subiendo imagen al servidor...';
    }

    try {
      // 1. Si seleccionó un archivo local, subirlo a assets/img/ en el servidor
      if (pendingImageUpload) {
        const token = sessionStorage.getItem('elfaro_admin_token') || localStorage.getItem('elfaro_admin_token');
        const uploadResp = await fetch(apiRoute('upload'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + (token || '')
          },
          body: JSON.stringify({
            fileName: pendingImageUpload.name,
            fileData: pendingImageUpload.data
          })
        });

        if (!uploadResp.ok) {
          const errData = await uploadResp.json().catch(() => ({}));
          throw new Error(errData.error || `Error al subir imagen (${uploadResp.status})`);
        }

        const uploadResult = await uploadResp.json();
        imageUrl = uploadResult.url;
      }

      // 2. Insertar imagen en CMSData
      const newImg = {
        id: 'img-' + Date.now(),
        title: title,
        category: category,
        imageUrl: imageUrl,
        date: new Date().toISOString().split('T')[0]
      };

      window.CMSData = window.CMSData || {};
      window.CMSData.galleryImages = window.CMSData.galleryImages || [];
      window.CMSData.galleryImages.unshift(newImg);

      // 3. Guardar y sincronizar con servidor
      const syncResult = await window.saveCMSData(window.CMSData);

      // 4. Reset & Limpieza
      pendingImageUpload = null;
      if (e.target && e.target.reset) e.target.reset();
      closeModal('modalAddImage');
      initDashboard();

      if (syncResult && syncResult.serverSynced) {
        showToast('¡Foto subida y guardada en disco permanentemente!', 'success');
      } else {
        showToast('Foto guardada en caché local (servidor desconectado).', 'warning');
      }
    } catch (err) {
      console.error('[CMS Image Upload Error]:', err);
      showToast('Error al publicar foto: ' + err.message, 'error');
    } finally {
      if (publishBtn) {
        publishBtn.disabled = false;
        publishBtn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> PUBLICAR FOTO EN GALERÍA';
      }
    }
  };

  window.deleteImage = async function(id) {
    if (!confirm('¿Estás seguro de eliminar esta foto?')) return;
    window.CMSData = window.CMSData || {};
    window.CMSData.galleryImages = (window.CMSData.galleryImages || []).filter(img => img.id !== id);
    const syncResult = await window.saveCMSData(window.CMSData);
    initDashboard();
    if (syncResult && syncResult.serverSynced) {
      showToast('Foto eliminada permanentemente del servidor.', 'success');
    } else {
      showToast('Foto eliminada en caché local.', 'warning');
    }
  };

  // --- VIDEOS CRUD ---
  function renderVideosTable() {
    const tbody = document.getElementById('videosTableBody');
    if (!tbody) return;
    const videos = (window.CMSData && window.CMSData.videos) || [];

    if (videos.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="padding: 50px 20px; text-align: center;">
            <div style="max-width: 440px; margin: 0 auto; padding: 35px 25px; background: rgba(4, 28, 44, 0.6); border: 1px dashed rgba(255, 220, 51, 0.35); border-radius: 20px; box-shadow: 0 15px 40px rgba(0,0,0,0.4);">
              <div style="width: 64px; height: 64px; border-radius: 50%; background: rgba(255, 220, 51, 0.12); border: 1px solid rgba(255, 220, 51, 0.4); color: var(--color-accent); font-size: 1.8rem; display: flex; align-items: center; justify-content: center; margin: 0 auto 18px; box-shadow: 0 0 25px rgba(255, 220, 51, 0.18);">
                <i class="fas fa-video"></i>
              </div>
              <h4 style="color: #ffffff; font-family: var(--font-heading); font-size: 1.3rem; margin: 0 0 8px 0;">Sin Prédicas ni Videos</h4>
              <p style="color: var(--text-muted); font-size: 0.9rem; line-height: 1.5; margin: 0 0 22px 0;">Añade enlaces de YouTube, TikTok o Vimeo para transmitirlos automáticamente en el reproductor.</p>
              <button class="btn-solid-primary" onclick="openAddVideoModal()" style="padding: 12px 24px; border-radius: 12px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 8px;">
                <i class="fas fa-plus-circle"></i> Agregar Primer Video
              </button>
            </div>
          </td>
        </tr>`;
      return;
    }

    tbody.innerHTML = videos.map(vid => `
      <tr>
        <td><img src="${escapeHtml(vid.thumbnail || 'https://img.youtube.com/vi/' + vid.youtubeId + '/hqdefault.jpg')}" alt="${escapeHtml(vid.title)}" onerror="this.onerror=null;this.src='assets/img/worship.jpg';" style="width: 80px; height: 48px; object-fit: cover; border-radius: 8px; border: 1px solid rgba(255,220,51,0.25);"></td>
        <td><strong style="color: #fff;">${escapeHtml(vid.title)}</strong></td>
        <td><span style="color: var(--color-accent); font-weight: 500;">${escapeHtml(vid.preacher || 'El Faro')}</span></td>
        <td>${escapeHtml(vid.date || 'N/A')}</td>
        <td>
          <button class="action-btn danger" onclick="deleteVideo('${escapeHtml(vid.id)}')"><i class="fas fa-trash"></i> Eliminar</button>
        </td>
      </tr>
    `).join('');
  }

  window.openAddVideoModal = function() {
    const modal = document.getElementById('modalAddVideo');
    if (modal) {
      const form = modal.querySelector('form');
      if (form) form.reset();
      modal.style.display = 'flex';
    }
  };

  window.saveNewVideo = async function(e) {
    if (e) {
      if (e.preventDefault) e.preventDefault();
      if (e.stopPropagation) e.stopPropagation();
    }
    const title = document.getElementById('newVidTitle').value.trim();
    const platform = document.getElementById('newVidPlatform').value;
    const preacher = document.getElementById('newVidPreacher').value.trim();
    const videoUrl = document.getElementById('newVidUrl').value.trim();

    let embedUrl = videoUrl;
    let youtubeId = '';

    if (platform === 'youtube') {
      youtubeId = extractYouTubeId(videoUrl);
      embedUrl = `https://www.youtube.com/embed/${youtubeId}`;
    } else if (platform === 'tiktok') {
      const match = videoUrl.match(/\/video\/(\d+)/);
      const tiktokId = match ? match[1] : videoUrl;
      embedUrl = `https://www.tiktok.com/embed/v2/${tiktokId}`;
    } else if (platform === 'vimeo') {
      const match = videoUrl.match(/vimeo\.com\/(\d+)/);
      const vimeoId = match ? match[1] : videoUrl;
      embedUrl = `https://player.vimeo.com/video/${vimeoId}`;
    }

    const newVid = {
      id: 'vid-' + Date.now(),
      title: title,
      platform: platform,
      preacher: preacher,
      url: videoUrl,
      embedUrl: embedUrl,
      youtubeId: youtubeId,
      thumbnail: youtubeId ? `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg` : 'assets/img/worship.jpg',
      date: new Date().toISOString().split('T')[0],
      featured: false
    };

    window.CMSData = window.CMSData || {};
    window.CMSData.videos = window.CMSData.videos || [];
    window.CMSData.videos.unshift(newVid);
    
    const syncResult = await window.saveCMSData(window.CMSData);

    if (e.target && e.target.reset) e.target.reset();
    closeModal('modalAddVideo');
    initDashboard();

    if (syncResult && syncResult.serverSynced) {
      showToast(`Video de ${platform.toUpperCase()} guardado en disco con éxito.`, 'success');
    } else {
      showToast(`Video guardado en caché local (servidor desconectado).`, 'warning');
    }
  };

  function extractYouTubeId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : url;
  }

  window.deleteVideo = async function(id) {
    if (!confirm('¿Estás seguro de eliminar este video?')) return;
    window.CMSData.videos = (window.CMSData.videos || []).filter(vid => vid.id !== id);
    const syncResult = await window.saveCMSData(window.CMSData);
    initDashboard();
    if (syncResult && syncResult.serverSynced) {
      showToast('Video eliminado permanentemente del servidor.', 'success');
    } else {
      showToast('Video eliminado en caché local.', 'warning');
    }
  };

  // --- FORMS POPULATION & SAVE ---
  window.updateLiveBankCardPreview = function() {
    const bankName = document.getElementById('bankName').value.trim();
    const accountName = document.getElementById('accountName').value.trim();
    const accountNumber = document.getElementById('accountNumber').value.trim();
    const accountType = (document.getElementById('accountType') ? document.getElementById('accountType').value.trim() : '') || 'Cuenta de Ahorros (M/N)';
    const bankNit = document.getElementById('bankNit').value.trim();

    const pBank = document.getElementById('previewBankName');
    const pAccName = document.getElementById('previewAccountName');
    const pAccNum = document.getElementById('previewAccountNumber');
    const pAccType = document.getElementById('previewAccountType');
    const pNit = document.getElementById('previewBankNit');

    if (pBank) pBank.textContent = bankName || 'Banco Nacional de Bolivia (BNB)';
    if (pAccName) pAccName.textContent = accountName || 'Centro de Vida Cristiana El Faro';
    if (pAccNum) pAccNum.textContent = accountNumber || '150-0123456-1';
    if (pAccType) pAccType.textContent = accountType;
    if (pNit) pNit.textContent = bankNit || '1029384756';
  };

  window.updateLiveQrPreview = function() {
    const qrUrl = document.getElementById('qrImage').value.trim();
    const pQr = document.getElementById('previewQrImage');
    if (pQr && qrUrl) {
      pQr.src = qrUrl;
    }
  };

  function populateForms() {
    const data = window.CMSData || {};

    // Bank
    if (data.bankInfo) {
      if (document.getElementById('bankName')) document.getElementById('bankName').value = data.bankInfo.bankName || '';
      if (document.getElementById('accountName')) document.getElementById('accountName').value = data.bankInfo.accountName || '';
      if (document.getElementById('accountNumber')) document.getElementById('accountNumber').value = data.bankInfo.accountNumber || '';
      if (document.getElementById('accountType')) document.getElementById('accountType').value = data.bankInfo.accountType || 'Cuenta de Ahorros (M/N)';
      if (document.getElementById('bankNit')) document.getElementById('bankNit').value = data.bankInfo.nit || '';
      if (document.getElementById('qrImage')) document.getElementById('qrImage').value = data.bankInfo.qrImage || '';
      if (document.getElementById('bankFeaturedVerse')) document.getElementById('bankFeaturedVerse').value = data.bankInfo.featuredVerse || '';
      if (document.getElementById('bankVerseRef')) document.getElementById('bankVerseRef').value = data.bankInfo.verseReference || '';
    }
    window.updateLiveBankCardPreview();
    window.updateLiveQrPreview();

    // Navigation Menu Texts
    const nav = data.navTexts || {};
    document.getElementById('navTextHome').value = nav.home || 'Inicio';
    document.getElementById('navTextGrowth').value = nav.growth || 'Crecimiento';
    document.getElementById('navTextChurch').value = nav.church || 'Nuestra Iglesia';
    document.getElementById('navTextEvents').value = nav.events || 'Eventos';
    document.getElementById('navTextMinistries').value = nav.ministries || 'Ministerios';
    document.getElementById('navSubMatrimonios').value = nav.subMatrimonios || 'Ministerio de Matrimonios';
    document.getElementById('navSubServicio').value = nav.subServicio || 'Ministerio de Servicio';
    document.getElementById('navSubJovenes').value = nav.subJovenes || 'Ministerio de Jóvenes';
    document.getElementById('navSubNinos').value = nav.subNinos || 'Ministerio de Niños';
    document.getElementById('navSubAdolescentes').value = nav.subAdolescentes || 'Ministerio de Adolescentes';
    document.getElementById('navSubIntercesion').value = nav.subIntercesion || 'Ministerio de Intercesión';
    document.getElementById('navSubAdoracion').value = nav.subAdoracion || 'Ministerio de Adoración';
    document.getElementById('navSubEducacion').value = nav.subEducacion || 'Depto. Educación Cristiana';
    document.getElementById('navSubDamas').value = nav.subDamas || 'Ministerio de Damas';
    document.getElementById('navSubDaniel').value = nav.subDaniel || 'Ministerio Proyecto Daniel';
    document.getElementById('navTextSermons').value = nav.sermons || 'Prédicas';
    document.getElementById('navSubVideos').value = nav.subVideos || 'Videos';
    document.getElementById('navSubImages').value = nav.subImages || 'Imágenes';
    document.getElementById('navTextContact').value = nav.contact || 'Contacto';
    document.getElementById('navTextDonations').value = nav.donations || 'Diezmos y Ofrendas';

    // Section Content Texts
    if (data.siteTexts) {
      document.getElementById('stHeroTitle').value = data.siteTexts.heroTitle || '¿Buscas amigos, familia y aprender más de Dios?';
      document.getElementById('stHeroSubtitle').value = data.siteTexts.heroSubtitle || 'Inscríbete y sé parte de nuestra comunidad. Iniciamos una nueva temporada de crecimiento espiritual.';
      document.getElementById('stAboutTitle').value = data.siteTexts.aboutTitle || 'Disfrutamos Lo Que Hacemos';
      document.getElementById('stAboutText').value = data.siteTexts.aboutText || 'Somos una iglesia cristiana comprometida con formar valores, acompañar procesos de vida y acercar a cada persona a una relación genuina con Dios.';
      document.getElementById('stGrowthTitle').value = data.siteTexts.growthTitle || 'Grupos de Crecimiento';
      document.getElementById('stMinistriesTitle').value = data.siteTexts.ministriesTitle || 'Ministerios para toda la familia';
      document.getElementById('stMinistriesText').value = data.siteTexts.ministriesText || 'Creemos en empoderar a cada miembro de la familia. Desde los más pequeños hasta los adultos mayores...';
      document.getElementById('stPhone').value = data.siteTexts.phone || data.siteTexts.whatsapp || '+591 79878844';
      document.getElementById('stEmail').value = data.siteTexts.email || 'contacto@elfarocvc.com';
      document.getElementById('stAddress').value = data.siteTexts.address || 'Santa Cruz, Bolivia';
      document.getElementById('stServiceHours').value = data.siteTexts.serviceHours || 'Domingos 09:30 AM & 18:30 PM';
    }
  }

  window.saveBankData = async function(e) {
    if (e) {
      if (e.preventDefault) e.preventDefault();
      if (e.stopPropagation) e.stopPropagation();
    }
    const submitBtn = e.target ? e.target.querySelector('button[type="submit"]') : null;
    const oldBtnHtml = submitBtn ? submitBtn.innerHTML : '';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
    }

    try {
      window.CMSData = window.CMSData || {};
      window.CMSData.bankInfo = window.CMSData.bankInfo || {};
      window.CMSData.bankInfo.bankName = document.getElementById('bankName').value.trim();
      window.CMSData.bankInfo.accountName = document.getElementById('accountName').value.trim();
      window.CMSData.bankInfo.accountNumber = document.getElementById('accountNumber').value.trim();
      if (document.getElementById('accountType')) {
        window.CMSData.bankInfo.accountType = document.getElementById('accountType').value.trim();
      }
      window.CMSData.bankInfo.nit = document.getElementById('bankNit').value.trim();
      window.CMSData.bankInfo.qrImage = document.getElementById('qrImage').value.trim();
      if (document.getElementById('bankFeaturedVerse')) {
        window.CMSData.bankInfo.featuredVerse = document.getElementById('bankFeaturedVerse').value.trim();
      }
      if (document.getElementById('bankVerseRef')) {
        window.CMSData.bankInfo.verseReference = document.getElementById('bankVerseRef').value.trim();
      }

      const syncResult = await window.saveCMSData(window.CMSData);
      if (syncResult && syncResult.serverSynced) {
        showToast('Datos bancarios y QR guardados en disco permanentemente.', 'success');
      } else {
        showToast('Datos bancarios guardados en local (servidor desconectado).', 'warning');
      }
    } catch (err) {
      console.error('[Bank Save Error]:', err);
      showToast('Error al guardar datos bancarios: ' + err.message, 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = oldBtnHtml;
      }
    }
  };

  window.saveTextsData = async function(e) {
    if (e) {
      if (e.preventDefault) e.preventDefault();
      if (e.stopPropagation) e.stopPropagation();
    }
    const submitBtn = e.target ? e.target.querySelector('button[type="submit"]') : null;
    const oldBtnHtml = submitBtn ? submitBtn.innerHTML : '';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
    }

    try {
      window.CMSData = window.CMSData || {};

      // Save Navigation Texts
      window.CMSData.navTexts = {
        home: document.getElementById('navTextHome').value.trim(),
        growth: document.getElementById('navTextGrowth').value.trim(),
        church: document.getElementById('navTextChurch').value.trim(),
        events: document.getElementById('navTextEvents').value.trim(),
        ministries: document.getElementById('navTextMinistries').value.trim(),
        subMatrimonios: document.getElementById('navSubMatrimonios').value.trim(),
        subServicio: document.getElementById('navSubServicio').value.trim(),
        subJovenes: document.getElementById('navSubJovenes').value.trim(),
        subNinos: document.getElementById('navSubNinos').value.trim(),
        subAdolescentes: document.getElementById('navSubAdolescentes').value.trim(),
        subIntercesion: document.getElementById('navSubIntercesion').value.trim(),
        subAdoracion: document.getElementById('navSubAdoracion').value.trim(),
        subEducacion: document.getElementById('navSubEducacion').value.trim(),
        subDamas: document.getElementById('navSubDamas').value.trim(),
        subDaniel: document.getElementById('navSubDaniel').value.trim(),
        sermons: document.getElementById('navTextSermons').value.trim(),
        subVideos: document.getElementById('navSubVideos').value.trim(),
        subImages: document.getElementById('navSubImages').value.trim(),
        contact: document.getElementById('navTextContact').value.trim(),
        donations: document.getElementById('navTextDonations').value.trim()
      };

      // Save Site Section Texts
      window.CMSData.siteTexts = window.CMSData.siteTexts || {};
      window.CMSData.heroTitle = document.getElementById('stHeroTitle').value.trim();
      window.CMSData.siteTexts.heroTitle = document.getElementById('stHeroTitle').value.trim();
      window.CMSData.siteTexts.heroSubtitle = document.getElementById('stHeroSubtitle').value.trim();
      window.CMSData.siteTexts.aboutTitle = document.getElementById('stAboutTitle').value.trim();
      window.CMSData.siteTexts.aboutText = document.getElementById('stAboutText').value.trim();
      window.CMSData.siteTexts.growthTitle = document.getElementById('stGrowthTitle').value.trim();
      window.CMSData.siteTexts.ministriesTitle = document.getElementById('stMinistriesTitle').value.trim();
      window.CMSData.siteTexts.ministriesText = document.getElementById('stMinistriesText').value.trim();
      window.CMSData.siteTexts.phone = document.getElementById('stPhone').value.trim();
      window.CMSData.siteTexts.whatsapp = document.getElementById('stPhone').value.trim();
      window.CMSData.siteTexts.email = document.getElementById('stEmail').value.trim();
      window.CMSData.siteTexts.address = document.getElementById('stAddress').value.trim();
      window.CMSData.siteTexts.serviceHours = document.getElementById('stServiceHours').value.trim();

      const syncResult = await window.saveCMSData(window.CMSData);
      if (syncResult && syncResult.serverSynced) {
        showToast('¡Textos y menús actualizados y guardados en disco!', 'success');
      } else {
        showToast('Textos guardados en local (servidor desconectado).', 'warning');
      }
    } catch (err) {
      console.error('[Texts Save Error]:', err);
      showToast('Error al guardar textos: ' + err.message, 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = oldBtnHtml;
      }
    }
  };

  window.clearField = function(fieldId) {
    const el = document.getElementById(fieldId);
    if (el) {
      el.value = '';
      showToast('Ítem desactivado/vaciado. Haz clic en "Guardar" para actualizar el sitio.');
    }
  };

  // --- INBOX TABLES ---
  function renderInboxTables() {
    const prayers = (window.CMSData && window.CMSData.prayers) || [];
    const contributions = (window.CMSData && window.CMSData.contributions) || [];
    const appointments = (window.CMSData && window.CMSData.appointments) || [];

    // Update Top Stat Counters
    const prayerStatEl = document.getElementById('statPrayerCount');
    if (prayerStatEl) prayerStatEl.textContent = prayers.length;

    const offeringStatEl = document.getElementById('statOfferingCount');
    if (offeringStatEl) offeringStatEl.textContent = contributions.length;

    const appStatEl = document.getElementById('statAppointmentCount');
    if (appStatEl) appStatEl.textContent = appointments.length;

    if (document.getElementById('metricAppointments')) {
      document.getElementById('metricAppointments').innerText = appointments.length;
    }

    // 1. Prayers Table Render
    const prTbody = document.getElementById('prayersTableBody');
    if (prTbody) {
      if (prayers.length === 0) {
        prTbody.innerHTML = `
          <tr>
            <td colspan="5" style="padding: 45px 20px; text-align: center;">
              <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px;">
                <div style="width: 64px; height: 64px; background: rgba(255,220,51,0.1); border: 1px solid rgba(255,220,51,0.3); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.8rem; color: var(--color-accent); box-shadow: 0 0 25px rgba(255,220,51,0.15);">
                  <i class="fas fa-praying-hands"></i>
                </div>
                <h4 style="color: #ffffff; margin: 0; font-size: 1.1rem; font-family: var(--font-heading);">No hay peticiones de oración recibidas aún</h4>
                <p style="color: var(--text-muted); margin: 0; font-size: 0.85rem; max-width: 420px;">Las peticiones enviadas por los miembros desde la web aparecerán automáticamente aquí en tiempo real.</p>
                <button onclick="addSamplePrayer()" class="btn-outline-gold" style="margin-top: 8px; padding: 8px 18px; border-radius: 12px; font-size: 0.82rem; cursor: pointer;">
                  <i class="fas fa-plus-circle"></i> Generar Petición de Prueba
                </button>
              </div>
            </td>
          </tr>
        `;
      } else {
        prTbody.innerHTML = prayers.map(pr => {
          const initial = pr.name ? pr.name.charAt(0).toUpperCase() : 'M';
          const formattedDate = pr.date ? new Date(pr.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Reciente';
          return `
            <tr>
              <td>
                <div style="display: flex; align-items: center; gap: 12px;">
                  <div style="width: 38px; height: 38px; background: linear-gradient(135deg, #FFD200 0%, #FFA500 100%); color: #041C2C; border-radius: 50%; font-weight: 800; font-size: 0.9rem; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(255,210,0,0.3);">
                    ${escapeHtml(initial)}
                  </div>
                  <div>
                    <strong style="color: #ffffff; display: block; font-size: 0.92rem;">${escapeHtml(pr.name)}</strong>
                    <span style="font-size: 0.75rem; color: var(--text-muted);">Miembro General</span>
                  </div>
                </div>
              </td>
              <td>
                <div style="font-size: 0.88rem; color: #ffffff;">${escapeHtml(pr.phone || 'N/A')}</div>
                <div style="font-size: 0.78rem; color: var(--color-accent);">${escapeHtml(pr.email || '')}</div>
              </td>
              <td style="max-width: 280px;">
                <div style="background: rgba(4, 28, 44, 0.7); border: 1px solid rgba(255,220,51,0.15); border-radius: 10px; padding: 10px 14px; font-size: 0.85rem; color: #e2e8f0; line-height: 1.4;">
                  "${escapeHtml(pr.request || 'Sin detalle de petición')}"
                </div>
              </td>
              <td style="font-size: 0.82rem; color: var(--text-muted);">${escapeHtml(formattedDate)}</td>
              <td style="text-align: right;">
                <button class="action-btn danger" onclick="deletePrayer('${escapeHtml(pr.id)}')" title="Eliminar petición">
                  <i class="fas fa-trash-alt"></i> Borrar
                </button>
              </td>
            </tr>
          `;
        }).join('');
      }
    }

    // 2. Contributions Table Render
    const ctTbody = document.getElementById('contributionsTableBody');
    if (ctTbody) {
      if (contributions.length === 0) {
        ctTbody.innerHTML = `
          <tr>
            <td colspan="6" style="padding: 45px 20px; text-align: center;">
              <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px;">
                <div style="width: 64px; height: 64px; background: rgba(39,201,63,0.1); border: 1px solid rgba(39,201,63,0.3); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.8rem; color: #27c93f; box-shadow: 0 0 25px rgba(39,201,63,0.15);">
                  <i class="fas fa-hand-holding-usd"></i>
                </div>
                <h4 style="color: #ffffff; margin: 0; font-size: 1.1rem; font-family: var(--font-heading);">No hay registros de diezmos ni ofrendas</h4>
                <p style="color: var(--text-muted); margin: 0; font-size: 0.85rem; max-width: 420px;">Los comprobantes reportados por los miembros aparecerán estructurados en esta tabla.</p>
                <button onclick="addSampleContribution()" class="btn-outline-gold" style="margin-top: 8px; padding: 8px 18px; border-radius: 12px; font-size: 0.82rem; cursor: pointer;">
                  <i class="fas fa-plus-circle"></i> Generar Registro de Diezmo de Prueba
                </button>
              </div>
            </td>
          </tr>
        `;
      } else {
        ctTbody.innerHTML = contributions.map(ct => {
          const initial = ct.name ? ct.name.charAt(0).toUpperCase() : 'D';
          const formattedDate = ct.date ? new Date(ct.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Hoy';
          return `
            <tr>
              <td>
                <div style="display: flex; align-items: center; gap: 12px;">
                  <div style="width: 38px; height: 38px; background: linear-gradient(135deg, #27c93f 0%, #10b981 100%); color: #ffffff; border-radius: 50%; font-weight: 800; font-size: 0.9rem; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(39,201,63,0.3);">
                    ${escapeHtml(initial)}
                  </div>
                  <div>
                    <strong style="color: #ffffff; display: block; font-size: 0.92rem;">${escapeHtml(ct.name)}</strong>
                    <span style="font-size: 0.75rem; color: #27c93f;">Diezmo Confirmado</span>
                  </div>
                </div>
              </td>
              <td>
                <div style="font-size: 0.88rem; color: #ffffff;">${escapeHtml(ct.phone || 'N/A')}</div>
                <div style="font-size: 0.78rem; color: var(--text-muted);">${escapeHtml(ct.email || '')}</div>
              </td>
              <td>
                <span style="background: rgba(255,220,51,0.15); border: 1px solid var(--color-accent); color: var(--color-accent); padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: 700;">
                  <i class="fas fa-tag"></i> ${escapeHtml(ct.type || 'Diezmo / Ofrenda')}
                </span>
              </td>
              <td>
                <strong style="color: #ffffff; font-family: monospace; letter-spacing: 1px; background: rgba(7,42,66,0.8); padding: 4px 10px; border-radius: 6px; border: 1px solid rgba(255,220,51,0.2);">
                  ${escapeHtml(ct.ref || 'REF-100234')}
                </strong>
              </td>
              <td style="font-size: 0.82rem; color: var(--text-muted);">${escapeHtml(formattedDate)}</td>
              <td style="text-align: right;">
                <button class="action-btn danger" onclick="deleteContribution('${escapeHtml(ct.id)}')" title="Eliminar registro">
                  <i class="fas fa-trash-alt"></i>
                </button>
              </td>
            </tr>
          `;
        }).join('');
      }
    }

    // 3. Appointments Table Render
    const appTbody = document.getElementById('appointmentsTableBody');
    if (appTbody) {
      if (appointments.length === 0) {
        appTbody.innerHTML = `
          <tr>
            <td colspan="6" style="padding: 45px 20px; text-align: center;">
              <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px;">
                <div style="width: 64px; height: 64px; background: rgba(255,210,0,0.1); border: 1px solid rgba(255,210,0,0.3); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.8rem; color: var(--color-accent); box-shadow: 0 0 25px rgba(255,210,0,0.15);">
                  <i class="fas fa-calendar-check"></i>
                </div>
                <h4 style="color: #ffffff; margin: 0; font-size: 1.1rem; font-family: var(--font-heading);">No hay citas pastorales agendadas</h4>
                <p style="color: var(--text-muted); margin: 0; font-size: 0.85rem; max-width: 420px;">Las solicitudes de citas agendadas desde la web aparecerán automáticamente aquí en tiempo real.</p>
                <button onclick="addSampleAppointment()" class="btn-outline-gold" style="margin-top: 8px; padding: 8px 18px; border-radius: 12px; font-size: 0.82rem; cursor: pointer;">
                  <i class="fas fa-plus-circle"></i> Generar Cita de Prueba
                </button>
              </div>
            </td>
          </tr>
        `;
      } else {
        appTbody.innerHTML = appointments.map(app => {
          const initial = app.name ? app.name.charAt(0).toUpperCase() : 'C';
          const cleanPhone = (app.phone || '').replace(/\D/g, '');
          const isConfirmed = app.status === 'Confirmada';
          const statusBadge = isConfirmed 
            ? '<span style="background: rgba(39,201,63,0.15); border: 1px solid #27c93f; color: #27c93f; padding: 4px 10px; border-radius: 12px; font-size: 0.78rem; font-weight: 700;"><i class="fas fa-check-circle"></i> Confirmada</span>'
            : '<span style="background: rgba(255,210,0,0.15); border: 1px solid #ffd200; color: #ffd200; padding: 4px 10px; border-radius: 12px; font-size: 0.78rem; font-weight: 700;"><i class="fas fa-clock"></i> Pendiente</span>';
          return `
            <tr>
              <td>
                <div style="display: flex; align-items: center; gap: 12px;">
                  <div style="width: 38px; height: 38px; background: linear-gradient(135deg, #072a42 0%, #041c2c 100%); border: 1px solid rgba(255,220,51,0.4); color: var(--color-accent); border-radius: 50%; font-weight: 800; font-size: 0.9rem; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.4);">
                    ${escapeHtml(initial)}
                  </div>
                  <div>
                    <strong style="color: #ffffff; display: block; font-size: 0.92rem;">${escapeHtml(app.name)}</strong>
                    <span style="font-size: 0.75rem; color: var(--text-muted);">Cita Pastoral / Grupos</span>
                  </div>
                </div>
              </td>
              <td>
                <div style="font-size: 0.88rem; color: #ffffff;">${escapeHtml(app.phone || 'N/A')}</div>
                <div style="font-size: 0.78rem; color: var(--color-accent);">${escapeHtml(app.email || '')}</div>
              </td>
              <td>
                <strong style="color: #ffffff; font-size: 0.88rem;"><i class="fas fa-calendar-day" style="color: var(--color-accent); margin-right: 6px;"></i>${escapeHtml(app.date || 'Pendiente')}</strong>
              </td>
              <td>
                <span style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: #ffffff; padding: 4px 10px; border-radius: 10px; font-size: 0.8rem; font-weight: 600;"><i class="fas fa-clock" style="margin-right: 4px;"></i>${escapeHtml(app.time || '10:00 AM')}</span>
              </td>
              <td>${statusBadge}</td>
              <td style="text-align: right; white-space: nowrap;">
                ${cleanPhone ? `<a href="https://wa.me/${cleanPhone}?text=Hola%20${encodeURIComponent(app.name)},%20te%20escribimos%20de%20la%20Iglesia%20El%20Faro%20CVC%20para%20confirmar%20tu%20cita%20pastoral%20del%20${encodeURIComponent(app.date)}%20a%20las%20${encodeURIComponent(app.time)}." target="_blank" class="action-btn" style="background: rgba(39,201,63,0.15); color: #27c93f; border-color: rgba(39,201,63,0.4); text-decoration: none;" title="Contactar por WhatsApp"><i class="fab fa-whatsapp"></i> WhatsApp</a>` : ''}
                <button class="action-btn" onclick="toggleAppointmentStatus('${escapeHtml(app.id)}')" title="Cambiar Estado">${isConfirmed ? '<i class="fas fa-undo"></i>' : '<i class="fas fa-check"></i>'}</button>
                <button class="action-btn danger" onclick="deleteAppointment('${escapeHtml(app.id)}')" title="Eliminar cita"><i class="fas fa-trash-alt"></i></button>
              </td>
            </tr>
          `;
        }).join('');
      }
    }
  }

  // --- SAMPLE DATA GENERATORS FOR INBOX ---
  window.addSampleAppointment = function() {
    window.CMSData = window.CMSData || {};
    window.CMSData.appointments = window.CMSData.appointments || [];
    const samples = [
      { name: 'Daniela Torrico', phone: '+591 78899001', email: 'daniela.t@gmail.com', date: new Date(Date.now() + 86400000).toISOString().split('T')[0], time: '10:00 AM', status: 'Pendiente' },
      { name: 'Gabriel Rojas', phone: '+591 76655443', email: 'gabriel.rojas@hotmail.com', date: new Date(Date.now() + 172800000).toISOString().split('T')[0], time: '03:30 PM', status: 'Pendiente' },
      { name: 'Lucía Fernández', phone: '+591 75544332', email: 'lucia.f@gmail.com', date: new Date(Date.now() + 259200000).toISOString().split('T')[0], time: '11:00 AM', status: 'Confirmada' }
    ];
    const picked = samples[Math.floor(Math.random() * samples.length)];
    picked.id = 'app-' + Date.now();

    window.CMSData.appointments.unshift(picked);
    window.saveCMSData(window.CMSData);
    renderInboxTables();
    showToast('¡Nueva cita de prueba agregada a la bandeja!');
  };

  window.toggleAppointmentStatus = async function(id) {
    window.CMSData = window.CMSData || {};
    window.CMSData.appointments = window.CMSData.appointments || [];
    const app = window.CMSData.appointments.find(a => a.id === id);
    if (app) {
      app.status = app.status === 'Confirmada' ? 'Pendiente' : 'Confirmada';
      const syncResult = await window.saveCMSData(window.CMSData);
      renderInboxTables();
      if (syncResult && syncResult.serverSynced) {
        showToast(`Cita marcada como ${app.status} (guardado en servidor).`, 'success');
      } else {
        showToast(`Cita marcada como ${app.status} (guardado local).`, 'warning');
      }
    }
  };

  window.deleteAppointment = async function(id) {
    if (!confirm('¿Estás seguro de eliminar esta cita?')) return;
    window.CMSData = window.CMSData || {};
    window.CMSData.appointments = (window.CMSData.appointments || []).filter(a => a.id !== id);
    const syncResult = await window.saveCMSData(window.CMSData);
    renderInboxTables();
    if (syncResult && syncResult.serverSynced) {
      showToast('Cita eliminada permanentemente del servidor.', 'success');
    } else {
      showToast('Cita eliminada en caché local.', 'warning');
    }
  };

  // --- SAMPLE DATA GENERATORS FOR INBOX ---
  window.addSamplePrayer = async function() {
    window.CMSData = window.CMSData || {};
    window.CMSData.prayers = window.CMSData.prayers || [];
    const samples = [
      { name: 'Familia Ramírez', phone: '+591 71234567', email: 'fam.ramirez@gmail.com', request: 'Petición de oración por salud y fortaleza de nuestros abuelos.' },
      { name: 'Carlos Mendoza', phone: '+591 78901234', email: 'carlos.m@hotmail.com', request: 'Agradecimiento por nuevo trabajo y bendición laboral.' },
      { name: 'María Elena Suárez', phone: '+591 76543210', email: 'maria.suarez@outlook.com', request: 'Oración por sabiduría y restauración en nuestro matrimonio.' }
    ];
    const picked = samples[Math.floor(Math.random() * samples.length)];
    picked.id = 'pr-' + Date.now();
    picked.date = new Date().toISOString();

    window.CMSData.prayers.unshift(picked);
    const syncResult = await window.saveCMSData(window.CMSData);
    renderInboxTables();
    if (syncResult && syncResult.serverSynced) {
      showToast('¡Nueva petición de prueba guardada en servidor!', 'success');
    } else {
      showToast('Petición de prueba guardada localmente.', 'warning');
    }
  };

  window.addSampleContribution = async function() {
    window.CMSData = window.CMSData || {};
    window.CMSData.contributions = window.CMSData.contributions || [];
    const samples = [
      { name: 'Roberto Justiniano', phone: '+591 72233445', email: 'roberto.j@gmail.com', type: 'Diezmo Mensual', ref: 'BNB-9982341' },
      { name: 'Andrea Mercado', phone: '+591 73344556', email: 'andrea.m@yahoo.es', type: 'Ofrenda Pro-Templo', ref: 'GNB-5541299' },
      { name: 'Juan Pablo Camacho', phone: '+591 74455667', email: 'jpcamacho@gmail.com', type: 'Semilla Misionera', ref: 'MSC-1029384' }
    ];
    const picked = samples[Math.floor(Math.random() * samples.length)];
    picked.id = 'ct-' + Date.now();
    picked.date = new Date().toISOString();

    window.CMSData.contributions.unshift(picked);
    const syncResult = await window.saveCMSData(window.CMSData);
    renderInboxTables();
    if (syncResult && syncResult.serverSynced) {
      showToast('¡Nuevo registro de diezmo guardado en servidor!', 'success');
    } else {
      showToast('Registro de diezmo guardado localmente.', 'warning');
    }
  };

  window.deletePrayer = async function(id) {
    if (!confirm('¿Estás seguro de eliminar esta petición de oración?')) return;
    window.CMSData = window.CMSData || {};
    window.CMSData.prayers = (window.CMSData.prayers || []).filter(pr => pr.id !== id);
    const syncResult = await window.saveCMSData(window.CMSData);
    renderInboxTables();
    if (syncResult && syncResult.serverSynced) {
      showToast('Petición eliminada permanentemente del servidor.', 'success');
    } else {
      showToast('Petición eliminada en caché local.', 'warning');
    }
  };

  window.deleteContribution = async function(id) {
    if (!confirm('¿Estás seguro de eliminar este registro de diezmo/ofrenda?')) return;
    window.CMSData = window.CMSData || {};
    window.CMSData.contributions = (window.CMSData.contributions || []).filter(ct => ct.id !== id);
    const syncResult = await window.saveCMSData(window.CMSData);
    renderInboxTables();
    if (syncResult && syncResult.serverSynced) {
      showToast('Registro de diezmo eliminado permanentemente del servidor.', 'success');
    } else {
      showToast('Registro de diezmo eliminado en caché local.', 'warning');
    }
  };

  // --- SECURITY CHANGE PASS ---
  window.checkPasswordStrength = function() {
    const val = document.getElementById('newPassword').value;
    const bar = document.getElementById('passStrengthBar');
    const label = document.getElementById('passStrengthLabel');
    if (!bar || !label) return;

    if (val.length === 0) {
      bar.style.width = '0%';
      bar.style.background = '#e53e3e';
      label.textContent = 'Débil';
      label.style.color = '#e53e3e';
    } else if (val.length < 6) {
      bar.style.width = '35%';
      bar.style.background = '#e53e3e';
      label.textContent = 'Corta';
      label.style.color = '#e53e3e';
    } else if (val.length < 10) {
      bar.style.width = '65%';
      bar.style.background = '#ffd200';
      label.textContent = 'Media';
      label.style.color = '#ffd200';
    } else {
      bar.style.width = '100%';
      bar.style.background = '#27c93f';
      label.textContent = 'Robusta';
      label.style.color = '#27c93f';
    }
  };

  window.changePassword = function(e) {
    e.preventDefault();
    const cur = document.getElementById('curPassword').value;
    const newP = document.getElementById('newPassword').value;

    if (cur !== adminPass) {
      alert('La contraseña actual es incorrecta.');
      return;
    }

    adminPass = newP;
    localStorage.setItem(PASS_KEY, newP);
    document.getElementById('passForm').reset();
    showToast('Contraseña de administrador actualizada con éxito.');
  };

  // --- TOGGLE PASSWORD VISIBILITY ---
  window.togglePasswordVisibility = function() {
    const passInput = document.getElementById('loginPassword');
    const icon = document.getElementById('togglePasswordIcon');
    if (!passInput || !icon) return;

    if (passInput.type === 'password') {
      passInput.type = 'text';
      icon.className = 'fas fa-eye-slash';
    } else {
      passInput.type = 'password';
      icon.className = 'fas fa-eye';
    }
  };

  // --- TOAST ALERTS ---
  function showToast(msg, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast-msg';

    let icon = '<i class="fas fa-check-circle" style="color: #27c93f;"></i>';
    if (type === 'warning') {
      toast.style.borderColor = 'rgba(255, 189, 46, 0.7)';
      toast.style.background = 'rgba(7, 42, 66, 0.95)';
      icon = '<i class="fas fa-exclamation-triangle" style="color: #ffbd2e;"></i>';
    } else if (type === 'error') {
      toast.style.borderColor = 'rgba(255, 95, 86, 0.7)';
      toast.style.background = 'rgba(7, 42, 66, 0.95)';
      icon = '<i class="fas fa-times-circle" style="color: #ff5f56;"></i>';
    } else {
      toast.style.borderColor = 'rgba(39, 201, 63, 0.6)';
    }

    toast.innerHTML = `${icon} <span>${msg}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // --- DATA EXPORT / IMPORT (cms-data.json) ---
  window.exportCMSData = function() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(window.CMSData || {}, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "cms-data.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast('¡Archivo cms-data.json descargado con éxito!');
  };

  window.copyCMSJson = function() {
    const jsonStr = JSON.stringify(window.CMSData || {}, null, 2);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(jsonStr).then(() => {
        showToast('¡JSON copiado al portapapeles!');
      }).catch(() => {
        showToast('Error al copiar al portapapeles.', 'error');
      });
    } else {
      showToast('Portapapeles no soportado en este navegador.', 'warning');
    }
  };

  window.importCMSData = function(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async function(e) {
      try {
        const parsed = JSON.parse(e.target.result);
        window.CMSData = parsed;
        const syncResult = await window.saveCMSData(parsed);
        initDashboard();
        if (syncResult && syncResult.serverSynced) {
          showToast('¡Datos del CMS importados y guardados en disco exitosamente!', 'success');
        } else {
          showToast('Datos del CMS importados en caché local.', 'warning');
        }
      } catch (err) {
        alert('Error al leer el archivo JSON: formato inválido.');
      }
    };
    reader.readAsText(file);
    event.target.value = ''; // Reset input
  };

})();
