/**
 * CMS Visual Live In-Place Editor — El Faro CVC
 * Allows direct on-page editing of all texts, titles, paragraphs, images, buttons, and sections in real-time.
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'elfaro_cms_data';
  let isEditingMode = false;
  let hasUnsavedChanges = false;
  let targetImageForModal = null;

  // Check if admin session is active
  function isAdminLoggedIn() {
    return sessionStorage.getItem('elfaro_admin_logged') === 'true' || localStorage.getItem('elfaro_admin_logged') === 'true';
  }

  // Initialize Visual Editor
  function initVisualEditor() {
    if (!isAdminLoggedIn()) return;

    createFloatingToolbar();
    createImageModal();
    enableVisualEditing();
  }

  // Create Floating Top Luxury Toolbar
  function createFloatingToolbar() {
    if (document.getElementById('cms-live-toolbar')) return;

    const toolbar = document.createElement('div');
    toolbar.id = 'cms-live-toolbar';
    toolbar.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 56px;
      background: rgba(4, 28, 44, 0.95);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border-bottom: 2px solid #FFD200;
      z-index: 999999;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 25px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.6);
      font-family: 'Inter', system-ui, sans-serif;
      box-sizing: border-box;
    `;

    toolbar.innerHTML = `
      <div style="display: flex; align-items: center; gap: 14px;">
        <span style="background: rgba(255, 210, 0, 0.15); border: 1px solid #FFD200; color: #FFD200; padding: 4px 14px; border-radius: 20px; font-size: 0.8rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
          <i class="fas fa-edit" style="margin-right: 6px;"></i> Modo Edición Visual Activo
        </span>
        <span id="cms-save-status" style="color: #a0aec0; font-size: 0.85rem;">Haz clic sobre cualquier texto o imagen para cambiarla en vivo.</span>
      </div>

      <div style="display: flex; align-items: center; gap: 12px;">
        <button id="btn-cms-toggle-mode" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.25); color: #ffffff; padding: 8px 16px; border-radius: 10px; font-size: 0.85rem; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: all 0.2s ease;">
          <i class="fas fa-eye"></i> Vista Previa
        </button>
        
        <button id="btn-cms-save-now" style="background: linear-gradient(135deg, #FFD200 0%, #FFA500 100%); border: none; color: #041C2C; padding: 9px 20px; border-radius: 10px; font-size: 0.88rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 6px; box-shadow: 0 4px 15px rgba(255,210,0,0.3); transition: all 0.2s ease;">
          <i class="fas fa-save"></i> Guardar Cambios
        </button>

        <a href="admin.html" style="background: rgba(255,210,0,0.1); border: 1px solid #FFD200; color: #FFD200; padding: 8px 14px; border-radius: 10px; font-size: 0.85rem; font-weight: 600; text-decoration: none; display: flex; align-items: center; gap: 6px;">
          <i class="fas fa-tachometer-alt"></i> Panel Admin
        </a>
      </div>
    `;

    document.body.appendChild(toolbar);
    document.body.style.paddingTop = '56px';

    // Toolbar Event Listeners
    document.getElementById('btn-cms-save-now').addEventListener('click', saveVisualEdits);
    document.getElementById('btn-cms-toggle-mode').addEventListener('click', togglePreviewMode);
  }

  // Create Image Picker Modal
  function createImageModal() {
    if (document.getElementById('cms-img-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'cms-img-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(4, 28, 44, 0.85);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      z-index: 9999999;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 20px;
      box-sizing: border-box;
      font-family: 'Inter', system-ui, sans-serif;
    `;

    modal.innerHTML = `
      <div style="background: linear-gradient(160deg, #041C2C 0%, #021016 100%); border: 1px solid rgba(255,220,51,0.35); border-radius: 24px; width: 100%; max-width: 520px; padding: 32px; box-shadow: 0 30px 80px rgba(0,0,0,0.85), 0 0 40px rgba(255,220,51,0.08); text-align: left; position: relative; box-sizing: border-box;">
        <h3 style="color: #FFD200; margin-top: 0; margin-bottom: 6px; font-size: 1.3rem; display: flex; align-items: center; gap: 10px; font-family: 'Playfair Display', serif;">
          <i class="fas fa-camera"></i> Cambiar Fotografía en Vivo
        </h3>
        <p style="color: #a0aec0; font-size: 0.88rem; margin-bottom: 24px;">Selecciona una imagen desde tu dispositivo o ingresa un enlace directo.</p>

        <!-- Option A: Luxury Dropzone -->
        <div style="margin-bottom: 20px;">
          <label style="display: block; color: #FFD200; font-size: 0.88rem; font-weight: 700; margin-bottom: 10px;">
            <i class="fas fa-cloud-upload-alt"></i> 1. Subir Foto desde tu Dispositivo (Recomendado)
          </label>
          <div id="ve-dropzone" style="background: linear-gradient(145deg, rgba(2,16,26,0.8) 0%, rgba(4,28,44,0.7) 100%); border: 2px dashed rgba(255,220,51,0.35); border-radius: 16px; padding: 20px 22px; cursor: pointer; transition: all 0.3s ease; box-sizing: border-box; width: 100%;">
            <input type="file" id="cms-img-modal-file" accept="image/*" style="display: none;">
            <div style="display: flex; align-items: center; gap: 16px;">
              <div id="ve-dropzone-icon" style="width: 48px; height: 48px; border-radius: 14px; background: rgba(255,220,51,0.12); border: 1px solid rgba(255,220,51,0.3); color: #FFD200; display: flex; align-items: center; justify-content: center; font-size: 1.35rem; flex-shrink: 0;">
                <i class="fas fa-image"></i>
              </div>
              <div style="flex-grow: 1; overflow: hidden;">
                <div id="ve-dropzone-main" style="color: #ffffff; font-weight: 700; font-size: 0.95rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Haz clic para seleccionar o arrastra una foto</div>
                <div id="ve-dropzone-sub" style="color: #a0aec0; font-size: 0.8rem; margin-top: 3px;">Admite archivos JPG, PNG, WEBP (Hasta 15 MB)</div>
              </div>
              <button type="button" style="background: linear-gradient(135deg, #FFDC33 0%, #E6B800 100%); color: #041C2C; border: none; padding: 9px 18px; border-radius: 10px; font-size: 0.85rem; font-weight: 700; display: flex; align-items: center; gap: 6px; pointer-events: none; flex-shrink: 0; box-shadow: 0 4px 12px rgba(255,220,51,0.25); cursor: pointer;">
                <i class="fas fa-folder-open"></i> Explorar
              </button>
            </div>
          </div>

          <!-- Preview Card -->
          <div id="ve-preview-card" style="display: none; margin-top: 12px;">
            <div style="background: rgba(2,16,26,0.85); padding: 14px 16px; border-radius: 16px; border: 1px solid rgba(255,220,51,0.35); display: flex; align-items: center; gap: 16px; box-shadow: 0 8px 24px rgba(0,0,0,0.5);">
              <img id="cms-img-modal-preview" src="" alt="Vista previa" style="width: 65px; height: 65px; border-radius: 12px; object-fit: cover; border: 1px solid #FFD200; flex-shrink: 0;">
              <div style="flex-grow: 1; overflow: hidden;">
                <div id="ve-preview-name" style="color: #ffffff; font-weight: 700; font-size: 0.9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">imagen.jpg</div>
                <div id="ve-preview-size" style="color: #a0aec0; font-size: 0.8rem; margin-top: 2px;"></div>
                <div style="color: #48bb78; font-size: 0.78rem; font-weight: 600; margin-top: 3px;"><i class="fas fa-check-circle"></i> Lista para aplicar</div>
              </div>
              <button type="button" id="ve-clear-btn" style="background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.4); color: #f87171; width: 34px; height: 34px; border-radius: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center;" title="Quitar imagen">
                <i class="fas fa-times"></i>
              </button>
            </div>
          </div>
        </div>

        <!-- Option B: URL Input -->
        <div style="margin-bottom: 28px;">
          <label style="display: block; color: #FFD200; font-size: 0.85rem; font-weight: 700; margin-bottom: 8px;">
            <i class="fas fa-link"></i> 2. O ingresa Ruta / URL de la Imagen
          </label>
          <div style="position: relative; display: flex; align-items: center;">
            <i class="fas fa-link" style="position: absolute; left: 16px; color: rgba(255,220,51,0.85); font-size: 0.95rem; pointer-events: none;"></i>
            <input type="text" id="cms-img-modal-url" placeholder="Ej. assets/img/foto.jpg o https://..." style="width: 100%; background: rgba(2,16,26,0.75); border: 1px solid rgba(255,220,51,0.3); border-radius: 12px; padding: 14px 16px 14px 48px; color: #ffffff; font-size: 0.9rem; outline: none; box-sizing: border-box; transition: border-color 0.25s ease;">
          </div>
        </div>

        <div style="display: flex; gap: 12px;">
          <button id="cms-img-modal-cancel" style="flex: 1; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.2); color: #ffffff; padding: 14px; border-radius: 14px; font-weight: 600; font-size: 0.95rem; cursor: pointer; transition: all 0.2s ease;">Cancelar</button>
          <button id="cms-img-modal-apply" style="flex: 2; background: linear-gradient(135deg, #FFD200 0%, #E6A800 100%); border: none; color: #041C2C; padding: 14px; border-radius: 14px; font-weight: 700; font-size: 0.95rem; cursor: pointer; box-shadow: 0 8px 20px rgba(255,210,0,0.35); display: flex; align-items: center; justify-content: center; gap: 8px;"><i class="fas fa-check"></i> Aplicar Nueva Foto</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Wire dropzone
    const fileInput = document.getElementById('cms-img-modal-file');
    const urlInput = document.getElementById('cms-img-modal-url');
    const preview = document.getElementById('cms-img-modal-preview');
    const previewCard = document.getElementById('ve-preview-card');
    const dropzone = document.getElementById('ve-dropzone');
    const mainText = document.getElementById('ve-dropzone-main');
    const subText = document.getElementById('ve-dropzone-sub');
    const previewName = document.getElementById('ve-preview-name');
    const previewSize = document.getElementById('ve-preview-size');
    const clearBtn = document.getElementById('ve-clear-btn');

    function clearFileSelection() {
      fileInput.value = '';
      if (previewCard) previewCard.style.display = 'none';
      if (mainText) mainText.textContent = 'Haz clic para seleccionar o arrastra una foto';
      if (subText) subText.textContent = 'Admite archivos JPG, PNG, WEBP (Hasta 15 MB)';
      if (dropzone) { dropzone.style.borderColor = 'rgba(255,220,51,0.35)'; dropzone.style.borderStyle = 'dashed'; }
    }

    dropzone.addEventListener('click', () => fileInput.click());

    ['dragenter','dragover'].forEach(ev => {
      dropzone.addEventListener(ev, e => { e.preventDefault(); dropzone.style.borderColor = '#FFD200'; dropzone.style.boxShadow = '0 0 20px rgba(255,220,51,0.2)'; });
    });
    ['dragleave','drop'].forEach(ev => {
      dropzone.addEventListener(ev, e => { e.preventDefault(); dropzone.style.borderColor = 'rgba(255,220,51,0.35)'; dropzone.style.boxShadow = ''; });
    });
    dropzone.addEventListener('drop', e => {
      const files = e.dataTransfer && e.dataTransfer.files;
      if (files && files.length > 0) { fileInput.files = files; fileInput.dispatchEvent(new Event('change')); }
    });

    fileInput.addEventListener('change', function(e) {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function(ev) {
        if (preview) preview.src = ev.target.result;
        if (urlInput) urlInput.value = ev.target.result;
        if (previewCard) previewCard.style.display = 'block';
        if (previewName) previewName.textContent = file.name;
        if (previewSize) previewSize.textContent = (file.size / (1024*1024)).toFixed(2) + ' MB';
        if (mainText) mainText.textContent = file.name;
        if (subText) subText.textContent = 'Haz clic o arrastra para cambiar';
        if (dropzone) { dropzone.style.borderColor = '#48bb78'; dropzone.style.borderStyle = 'solid'; }
      };
      reader.readAsDataURL(file);
    });

    clearBtn.addEventListener('click', clearFileSelection);

    urlInput.addEventListener('input', function() {
      const val = urlInput.value.trim();
      if (val && !val.startsWith('data:')) {
        if (preview) preview.src = val;
        if (previewCard) previewCard.style.display = 'block';
        if (previewName) previewName.textContent = val.split('/').pop() || 'URL externa';
        if (previewSize) previewSize.textContent = 'Enlace remoto / Ruta';
      }
    });

    document.getElementById('cms-img-modal-cancel').addEventListener('click', closeImageModal);
    document.getElementById('cms-img-modal-apply').addEventListener('click', applyModalImage);
  }

  function openImageModal(imgElement) {
    targetImageForModal = imgElement;
    const modal = document.getElementById('cms-img-modal');
    const preview = document.getElementById('cms-img-modal-preview');
    const urlInput = document.getElementById('cms-img-modal-url');
    const fileInput = document.getElementById('cms-img-modal-file');

    if (preview && imgElement) preview.src = imgElement.src;
    if (urlInput && imgElement) urlInput.value = imgElement.src;
    if (fileInput) fileInput.value = '';

    if (modal) modal.style.display = 'flex';
  }

  function closeImageModal() {
    const modal = document.getElementById('cms-img-modal');
    if (modal) modal.style.display = 'none';
    targetImageForModal = null;
  }

  async function applyModalImage() {
    const urlInput = document.getElementById('cms-img-modal-url');
    if (targetImageForModal && urlInput && urlInput.value.trim()) {
      let finalUrl = urlInput.value.trim();

      // If image is a base64 data URL, upload to server so it's a persistent file in assets/img/
      if (finalUrl.startsWith('data:image')) {
        try {
          const token = sessionStorage.getItem('elfaro_admin_token') || localStorage.getItem('elfaro_admin_token');
          const uploadUrl = window.getApiUrl ? window.getApiUrl('upload') : '/api/index.php?route=upload';
          const uploadRes = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + (token || '')
            },
            body: JSON.stringify({
              fileName: 'visual_' + Date.now() + '.jpg',
              fileData: finalUrl
            })
          });
          if (uploadRes.ok) {
            const upJson = await uploadRes.json();
            if (upJson.url) finalUrl = upJson.url;
          }
        } catch (e) {
          console.warn('[CMS Image Upload] Error al subir, guardando URL directa:', e);
        }
      }

      targetImageForModal.src = finalUrl;
      targetImageForModal.dataset.cmsEdited = 'true';
      markUnsaved();
    }
    closeImageModal();
  }

  // Calculate unique stable selector for any element on the page
  function getElementSelector(el) {
    if (el.dataset.cmsKey) return `[data-cms-key="${el.dataset.cmsKey}"]`;
    if (el.id) return `#${el.id}`;

    const path = [];
    let curr = el;
    while (curr && curr !== document.body && curr !== document.documentElement) {
      if (curr.id) {
        path.unshift(`#${curr.id}`);
        break;
      }
      let index = 1;
      let sib = curr.previousElementSibling;
      while (sib) {
        if (sib.tagName === curr.tagName) index++;
        sib = sib.previousElementSibling;
      }
      const tag = curr.tagName.toLowerCase();
      path.unshift(`${tag}:nth-of-type(${index})`);
      if (curr.tagName === 'MAIN') break;
      curr = curr.parentElement;
    }
    return path.join(' > ');
  }

  // Enable Visual Editable Elements on Page
  function enableVisualEditing() {
    isEditingMode = true;

    // Inject CSS for Hover outlines and editable indicators
    if (!document.getElementById('cms-editable-styles')) {
      const style = document.createElement('style');
      style.id = 'cms-editable-styles';
      style.innerHTML = `
        [contenteditable="true"] {
          outline: 2px dashed rgba(255, 210, 0, 0.7) !important;
          outline-offset: 3px;
          cursor: text !important;
          transition: outline 0.2s ease, background 0.2s ease;
        }
        [contenteditable="true"]:hover {
          outline: 2px solid #FFD200 !important;
          background: rgba(255, 210, 0, 0.08) !important;
        }
        [contenteditable="true"]:focus {
          outline: 2px solid #FFD200 !important;
          background: rgba(4, 28, 44, 0.9) !important;
          color: #ffffff !important;
          box-shadow: 0 0 20px rgba(255, 210, 0, 0.25);
        }
        .cms-image-wrapper-editable {
          position: relative !important;
          cursor: pointer !important;
        }
        .cms-image-wrapper-editable img {
          transition: filter 0.3s ease, transform 0.3s ease;
        }
        .cms-image-wrapper-editable:hover img {
          filter: brightness(0.85);
          outline: 2px solid #FFD200 !important;
        }
        .cms-img-edit-btn {
          position: absolute;
          top: 10px;
          right: 10px;
          background: rgba(4, 28, 44, 0.95);
          border: 1px solid #FFD200;
          color: #FFD200;
          padding: 8px 14px;
          border-radius: 10px;
          font-size: 0.8rem;
          font-weight: 700;
          cursor: pointer;
          z-index: 100;
          box-shadow: 0 4px 15px rgba(0,0,0,0.6);
          display: none;
        }
        .cms-image-wrapper-editable:hover .cms-img-edit-btn {
          display: flex;
          align-items: center;
          gap: 6px;
        }
      `;
      document.head.appendChild(style);
    }

    // Target editable text elements only — NEVER hijack buttons, navigation, or interactive controls
    const selectors = [
      'h1', 'h2', 'h3', 'h4', 'h5', 'p', '.section-text', '.elegant-title', '.elegant-subtitle', 'span.subtitle-gold', 'span.eyebrow-badge'
    ];

    selectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        // Skip buttons, forms, nav links and toolbar elements
        if (el.closest('#cms-live-toolbar') || el.closest('#header') || el.closest('#adminLayout') || el.closest('button') || el.closest('a') || el.closest('form')) return;

        el.setAttribute('contenteditable', 'true');
        if (!el.dataset.cmsWired) {
          el.dataset.cmsWired = 'true';
          el.addEventListener('input', () => {
            el.dataset.cmsEdited = 'true';
            markUnsaved();
          });
        }
      });
    });

    // Image Editing Trigger
    document.querySelectorAll('img').forEach(img => {
      if (img.closest('#cms-live-toolbar') || img.closest('#header') || img.closest('.logo')) return;

      const parent = img.parentElement;
      if (parent) {
        parent.classList.add('cms-image-wrapper-editable');
        
        // Directly click on image to open picker
        img.style.cursor = 'pointer';
        img.onclick = (e) => {
          if (!isEditingMode) return;
          e.preventDefault();
          e.stopPropagation();
          openImageModal(img);
        };

        if (!parent.querySelector('.cms-img-edit-btn')) {
          const btn = document.createElement('button');
          btn.className = 'cms-img-edit-btn';
          btn.innerHTML = '<i class="fas fa-camera"></i> Cambiar Foto';
          btn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            openImageModal(img);
          };
          parent.appendChild(btn);
        }
      }
    });
  }

  // Mark unsaved state
  function markUnsaved() {
    hasUnsavedChanges = true;
    const status = document.getElementById('cms-save-status');
    if (status) {
      status.style.color = '#FFD200';
      status.innerHTML = '⚠️ Hay cambios sin guardar. Haz clic en "Guardar Cambios" para aplicarlos.';
    }
  }

  // Save Edits to LocalStorage and CMSData
  async function saveVisualEdits() {
    let data = window.CMSData || {};

    const pageKey = window.location.pathname.split('/').pop().replace('.html', '') || 'inicio';
    data.pageEdits = data.pageEdits || {};
    data.pageEdits[pageKey] = data.pageEdits[pageKey] || {};

    // 1. Capture all in-place edited text elements on this page
    document.querySelectorAll('[contenteditable="true"]').forEach(el => {
      const sel = getElementSelector(el);
      data.pageEdits[pageKey][sel] = { text: el.innerHTML };
    });

    // 2. Capture all in-place edited images on this page
    document.querySelectorAll('img[data-cms-edited="true"]').forEach(img => {
      const sel = getElementSelector(img);
      data.pageEdits[pageKey][sel] = { src: img.getAttribute('src') };
    });

    // 3. Synchronize known siteTexts if present on this page
    data.siteTexts = data.siteTexts || {};
    const heroTitleEl = document.querySelector('.hero-content .elegant-title');
    if (heroTitleEl) data.siteTexts.heroTitle = heroTitleEl.innerText.trim();

    const heroSubEl = document.querySelector('.hero-content .elegant-subtitle');
    if (heroSubEl) data.siteTexts.heroSubtitle = heroSubEl.innerText.trim();

    const aboutTitleEl = document.querySelector('#sobre-nosotros h2');
    if (aboutTitleEl) data.siteTexts.aboutTitle = aboutTitleEl.innerText.trim();

    const aboutTextEl = document.querySelector('#sobre-nosotros p.section-text');
    if (aboutTextEl) data.siteTexts.aboutText = aboutTextEl.innerText.trim();

    const growthTitleEl = document.querySelector('#crecimiento h2');
    if (growthTitleEl) data.siteTexts.growthTitle = growthTitleEl.innerText.trim();

    const minTitleEl = document.querySelector('#ministerios h2');
    if (minTitleEl) data.siteTexts.ministriesTitle = minTitleEl.innerHTML.trim();

    const minTextEl = document.querySelector('#ministerios p.section-text');
    if (minTextEl) data.siteTexts.ministriesText = minTextEl.innerText.trim();

    // 4. Synchronize Bank info if on Diezmos
    data.bankInfo = data.bankInfo || {};
    const bankNameEl = document.querySelector('.cms-bank-name');
    if (bankNameEl) data.bankInfo.bankName = bankNameEl.innerText.trim();

    const accNameEl = document.querySelector('.cms-acc-name');
    if (accNameEl) data.bankInfo.accountName = accNameEl.innerText.trim();

    const accNumEl = document.querySelector('#acc-number, .cms-acc-num');
    if (accNumEl) data.bankInfo.accountNumber = accNumEl.innerText.trim();

    const accTypeEl = document.querySelector('.cms-acc-type');
    if (accTypeEl) data.bankInfo.accountType = accTypeEl.innerText.trim();

    const nitEl = document.querySelector('.cms-bank-nit');
    if (nitEl) data.bankInfo.nit = nitEl.innerText.trim();

    const status = document.getElementById('cms-save-status');
    if (status) {
      status.style.color = '#FFD200';
      status.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando cambios en el servidor...';
    }

    // Persist via saveCMSData engine
    let syncResult = null;
    if (window.saveCMSData) {
      syncResult = await window.saveCMSData(data);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      window.CMSData = data;
    }
    hasUnsavedChanges = false;

    if (status) {
      if (syncResult && syncResult.serverSynced) {
        status.style.color = '#48bb78';
        status.innerHTML = '✅ ¡Cambios guardados en la Base de Datos permanentemente!';
      } else {
        status.style.color = '#ecc94b';
        status.innerHTML = '⚠️ Guardado en caché local (servidor no sincronizado).';
      }
      setTimeout(() => {
        status.style.color = '#a0aec0';
        status.innerHTML = 'Haz clic sobre cualquier texto o imagen para cambiarla en vivo.';
      }, 4000);
    }
  }

  // Toggle Preview Mode
  function togglePreviewMode() {
    const btn = document.getElementById('btn-cms-toggle-mode');
    if (isEditingMode) {
      isEditingMode = false;
      document.querySelectorAll('[contenteditable="true"]').forEach(el => {
        el.setAttribute('contenteditable', 'false');
      });
      if (btn) btn.innerHTML = '<i class="fas fa-pencil-alt"></i> Activar Edición';
    } else {
      enableVisualEditing();
      if (btn) btn.innerHTML = '<i class="fas fa-eye"></i> Vista Previa';
    }
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCMSVisualEditor);
  } else {
    initCMSVisualEditor();
  }

  function initCMSVisualEditor() {
    setTimeout(initVisualEditor, 400);
  }

})();
