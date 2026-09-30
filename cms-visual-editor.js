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
      <div style="background: #041C2C; border: 1px solid #FFD200; border-radius: 24px; width: 100%; max-width: 520px; padding: 30px; box-shadow: 0 25px 60px rgba(0,0,0,0.8); text-align: left; position: relative;">
        <h3 style="color: #FFD200; margin-top: 0; margin-bottom: 8px; font-size: 1.3rem; display: flex; align-items: center; gap: 10px;">
          <i class="fas fa-camera"></i> Cambiar Fotografía en Vivo
        </h3>
        <p style="color: #a0aec0; font-size: 0.88rem; margin-bottom: 25px;">Selecciona una imagen desde tu dispositivo o ingresa un enlace directo.</p>

        <!-- Preview Box -->
        <div style="background: rgba(2, 16, 26, 0.7); border: 1px solid rgba(255,210,0,0.25); border-radius: 16px; padding: 15px; text-align: center; margin-bottom: 20px;">
          <span style="font-size: 0.75rem; color: #a0aec0; display: block; margin-bottom: 8px; text-transform: uppercase;">Vista Previa de la Fotografía</span>
          <img id="cms-img-modal-preview" src="" alt="Vista Previa" style="max-height: 160px; width: auto; border-radius: 12px; object-fit: contain; display: inline-block;">
        </div>

        <!-- Option A: File Upload -->
        <div style="margin-bottom: 20px;">
          <label style="display: block; color: #ffffff; font-size: 0.85rem; font-weight: 600; margin-bottom: 8px;"><i class="fas fa-upload" style="color: #FFD200; margin-right: 6px;"></i> 1. Subir Foto desde Celular / Computadora</label>
          <input type="file" id="cms-img-modal-file" accept="image/*" style="width: 100%; background: rgba(7,42,66,0.5); border: 1px solid rgba(255,210,0,0.3); border-radius: 12px; padding: 10px; color: #ffffff; font-size: 0.85rem; cursor: pointer;">
        </div>

        <!-- Option B: URL Input -->
        <div style="margin-bottom: 28px;">
          <label style="display: block; color: #ffffff; font-size: 0.85rem; font-weight: 600; margin-bottom: 8px;"><i class="fas fa-link" style="color: #FFD200; margin-right: 6px;"></i> 2. O Enlace / Ruta de Imagen</label>
          <input type="text" id="cms-img-modal-url" placeholder="assets/img/foto.jpg o https://..." style="width: 100%; background: rgba(7,42,66,0.5); border: 1px solid rgba(255,210,0,0.3); border-radius: 12px; padding: 12px 14px; color: #ffffff; font-size: 0.9rem; outline: none; box-sizing: border-box;">
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 12px;">
          <button id="cms-img-modal-cancel" style="background: transparent; border: 1px solid rgba(255,255,255,0.25); color: #ffffff; padding: 12px 20px; border-radius: 12px; font-weight: 600; cursor: pointer;">Cancelar</button>
          <button id="cms-img-modal-apply" style="background: linear-gradient(135deg, #FFD200 0%, #FFA500 100%); border: none; color: #041C2C; padding: 12px 24px; border-radius: 12px; font-weight: 700; cursor: pointer; box-shadow: 0 4px 15px rgba(255,210,0,0.3);">Aplicar Nueva Foto</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Modal listeners
    const fileInput = document.getElementById('cms-img-modal-file');
    const urlInput = document.getElementById('cms-img-modal-url');
    const preview = document.getElementById('cms-img-modal-preview');

    fileInput.addEventListener('change', function (e) {
      if (e.target.files && e.target.files[0]) {
        const reader = new FileReader();
        reader.onload = function (ev) {
          preview.src = ev.target.result;
          urlInput.value = ev.target.result;
        };
        reader.readAsDataURL(e.target.files[0]);
      }
    });

    urlInput.addEventListener('input', function () {
      preview.src = urlInput.value.trim();
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

  function applyModalImage() {
    const urlInput = document.getElementById('cms-img-modal-url');
    if (targetImageForModal && urlInput && urlInput.value.trim()) {
      targetImageForModal.src = urlInput.value.trim();
      markUnsaved();
    }
    closeImageModal();
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

    // Target editable elements: headings, text, paragraphs, buttons, list items
    const selectors = [
      'h1', 'h2', 'h3', 'h4', 'h5', 'p', 'span.subtitle-gold', 'span.eyebrow-badge',
      'a.btn-solid-primary', 'a.btn-outline-gold', 'a.link-gold', 'li', 'button'
    ];

    selectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        // Skip header links and toolbar elements
        if (el.closest('#cms-live-toolbar') || el.closest('#header') || el.closest('#adminLayout')) return;

        el.setAttribute('contenteditable', 'true');
        el.addEventListener('input', markUnsaved);
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
  function saveVisualEdits() {
    let data = window.CMSData || {};

    // 1. Synchronize known siteTexts if present on this page
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

    // 2. Synchronize Bank info if on Diezmos
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

    let pageKey = window.location.pathname.split('/').pop() || 'inicio.html';
    if (!pageKey || pageKey === '/') pageKey = 'inicio.html';
    data.pageMainContent = data.pageMainContent || {};
    const mainEl = document.querySelector('main');
    if (mainEl) {
      const clone = mainEl.cloneNode(true);
      clone.querySelectorAll('[contenteditable]').forEach(el => el.removeAttribute('contenteditable'));
      clone.querySelectorAll('.cms-img-edit-btn').forEach(el => el.remove());
      clone.querySelectorAll('.cms-image-wrapper-editable').forEach(el => el.classList.remove('cms-image-wrapper-editable'));
      data.pageMainContent[pageKey] = clone.innerHTML;
    }

    // Persist via saveCMSData engine
    if (window.saveCMSData) {
      window.saveCMSData(data);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      window.CMSData = data;
    }
    hasUnsavedChanges = false;

    const status = document.getElementById('cms-save-status');
    if (status) {
      status.style.color = '#48bb78';
      status.innerHTML = '✅ ¡Todas las fotos y textos guardados con éxito en el CMS!';
      setTimeout(() => {
        status.style.color = '#a0aec0';
        status.innerHTML = 'Haz clic sobre cualquier texto o imagen para cambiarla en vivo.';
      }, 3000);
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
