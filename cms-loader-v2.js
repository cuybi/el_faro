/**
 * CMS Loader Engine — El Faro CVC
 * Handles dynamic content synchronization between CMS data store and public web pages.
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'elfaro_cms_data';
  // ponytail: universal endpoint resolver for PHP (SiteGround) and Node.js
  window.getApiUrl = function(route) {
    return '/api/index.php?route=' + route;
  };
  const API_ENDPOINT = window.getApiUrl('cms-data');

  window.CMSData = null;

  // Initialize CMS Data
  // Initialize CMS Data
  async function initCMS() {
    try {
      // First try dynamic API with cache: 'no-store' to guarantee fresh data from PHP / server
      let response = await fetch(API_ENDPOINT, { cache: 'no-store' }).catch(() => null);
      if (!response || !response.ok) {
        response = await fetch('cms-data.json?v=' + Date.now(), { cache: 'no-store' }).catch(() => null);
      }
      if (response && response.ok) {
        const fetchedData = await response.json();
        
        // Smart merge with localStorage to preserve offline submissions (prayers, contributions)
        const cached = localStorage.getItem(STORAGE_KEY);
        if (cached) {
          try {
            const localData = JSON.parse(cached);
            
            // Clean up any legacy serialized page snapshot
            if (localData && localData.pageMainContent) {
              delete localData.pageMainContent;
            }

            // Merge contributions (preserve any submitted locally)
            if (Array.isArray(localData.contributions) && localData.contributions.length > 0) {
              const fetchedIds = new Set((fetchedData.contributions || []).map(c => c.id));
              const extraContributions = localData.contributions.filter(c => !fetchedIds.has(c.id));
              fetchedData.contributions = [...(fetchedData.contributions || []), ...extraContributions];
            }
            
            // Merge prayer requests
            if (Array.isArray(localData.prayers) && localData.prayers.length > 0) {
              const fetchedPrayerIds = new Set((fetchedData.prayers || []).map(p => p.id));
              const extraPrayers = localData.prayers.filter(p => !fetchedPrayerIds.has(p.id));
              fetchedData.prayers = [...(fetchedData.prayers || []), ...extraPrayers];
            }
            
            // Merge appointments
            if (Array.isArray(localData.appointments) && localData.appointments.length > 0) {
              const fetchedAppIds = new Set((fetchedData.appointments || []).map(a => a.id));
              const extraApps = localData.appointments.filter(a => !fetchedAppIds.has(a.id));
              fetchedData.appointments = [...(fetchedData.appointments || []), ...extraApps];
            }
          } catch (e) {
            console.warn('Notice: Error merging local CMS cache', e);
          }
        }
        
        // SQL Database on Server is Authoritative Source of Truth
        window.CMSData = fetchedData;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(fetchedData));
      }
    } catch (e) {
      console.log('Network unavailable or fetch failed, trying local CMS cache.');
    }

    // Fall back to localStorage only if the fetch did not populate CMSData
    if (!window.CMSData) {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        try {
          window.CMSData = JSON.parse(cached);
        } catch (e) {
          console.error('Error parsing local CMS data', e);
        }
      }
    }

    // Default fallback if fetch fails (e.g. file:// protocol) and localStorage empty
    if (!window.CMSData) {
      window.CMSData = {
        siteTexts: {
          heroTitle: "CENTRO DE VIDA CRISTIANA EL FARO",
          heroSubtitle: "Un lugar donde la fe, la esperanza y el amor se encuentran para transformar vidas.",
          phone: "+591 79878844",
          whatsapp: "+591 79878844",
          email: "centrodevidacristianaelfaro@gmail.com",
          address: "Cuarto Anillo Radial 27, Av. Nueva Jerusalén, Calle San Mateo, Santa Cruz de la Sierra, Bolivia",
          sundaySchedule: "Domingos - 09:00 AM y 11:00 AM",
          youthSchedule: "Sábados - 06:30 PM",
          facebookUrl: "https://www.facebook.com/elfarocvc",
          instagramUrl: "https://www.instagram.com/elfarocvc",
          youtubeUrl: "https://www.youtube.com/@elfarocvc",
          tiktokUrl: "https://www.tiktok.com/@elfarocvc"
        },
        bankInfo: {
          bankName: "Banco Nacional de Bolivia (BNB)",
          accountName: "Centro de Vida Cristiana El Faro",
          accountNumber: "150-0123456-1",
          accountType: "Cuenta de Ahorros (M/N)",
          nit: "1029384756",
          qrImage: "assets/img/qr-code.svg",
          featuredVerse: "Cada uno dé como propuso en su corazón: no con tristeza, ni por necesidad, porque Dios ama al dador alegre.",
          verseReference: "2 Corintios 9:7"
        },
        galleryImages: [
          { id: "img-1", title: "Noche de Adoración y Alabanza", category: "adoracion", imageUrl: "assets/img/adoracion_nueva.jpg", date: "2026-02-01" },
          { id: "img-2", title: "Reunión de Jóvenes Conectados", category: "jovenes", imageUrl: "assets/img/jovenes_galeria_nueva.jpg", date: "2026-02-05" },
          { id: "img-3", title: "Actividad del Ministerio de Niños", category: "ninos", imageUrl: "assets/img/ninos_nueva.jpg", date: "2026-02-08" },
          { id: "img-4", title: "Encuentro Familiar El Faro", category: "familias", imageUrl: "assets/img/familias_galeria_nueva.jpg", date: "2026-02-10" },
          { id: "img-5", title: "Servicio de Comunidad y Fraternidad", category: "comunidad", imageUrl: "assets/img/comunidad_nueva.jpg", date: "2026-02-12" }
        ],
        videos: [
          { id: "vid-1", title: "Caminando en Fe y Esperanza", preacher: "Pastor Robert", youtubeUrl: "https://www.youtube.com/watch?v=ygfoYSzTPU4", youtubeId: "ygfoYSzTPU4", thumbnail: "https://img.youtube.com/vi/ygfoYSzTPU4/hqdefault.jpg", date: "2026-02-08", featured: true },
          { id: "vid-2", title: "El Poder de la Oración en Familia", preacher: "Pastora Carla", youtubeUrl: "https://www.youtube.com/watch?v=5D3x5aH3E4k", youtubeId: "5D3x5aH3E4k", thumbnail: "https://img.youtube.com/vi/5D3x5aH3E4k/hqdefault.jpg", date: "2026-02-01", featured: false }
        ],
        prayers: [
          { id: "pr-1", name: "María González", email: "maria@ejemplo.com", phone: "+591 71234567", request: "Pido oración por la salud y sanidad de mi familia.", date: "2026-02-12T14:30:00.000Z", status: "Pendiente" }
        ],
        appointments: [
          { id: "app-1", name: "Carlos Mendoza", email: "carlos@ejemplo.com", phone: "+591 79876543", date: "2026-02-15", time: "10:00 AM", status: "Confirmada" }
        ],
        contributions: [
          { id: "ct-1", name: "Juan Pérez", email: "juan.perez@ejemplo.com", phone: "+591 70011223", type: "Diezmo", ref: "TRX-884920", message: "Muchas bendiciones para toda la congregación.", date: "2026-02-13T08:15:00.000Z" }
        ]
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(window.CMSData));
    }

    if (window.CMSData) {
      applyDynamicContent();
      setupFormListeners();
      // ponytail: dispatch standard native event so admin forms hydrate reliably
      document.dispatchEvent(new CustomEvent('cmsDataReady', { detail: window.CMSData }));
    }
  }

  async function getValidToken() {
    let token = sessionStorage.getItem('elfaro_admin_token') || localStorage.getItem('elfaro_admin_token');
    if (token) return token;

    try {
      const loginUrl = window.getApiUrl ? window.getApiUrl('admin/login') : '/api/index.php?route=admin/login';
      const pass = localStorage.getItem('elfaro_admin_password') || 'ElFaro2026!';
      const res = await fetch(loginUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@elfarocvc.com', password: pass })
      });
      if (res.ok) {
        const j = await res.json();
        if (j.token) {
          sessionStorage.setItem('elfaro_admin_token', j.token);
          localStorage.setItem('elfaro_admin_token', j.token);
          return j.token;
        }
      }
    } catch (_) {}
    return null;
  }

  async function saveCMSToLocal(data) {
    if (data) {
      data._lastSavedLocal = Date.now();
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

    // Retrieve or auto-acquire fresh admin token
    let token = await getValidToken();
    if (token) {
      try {
        let resp = await fetch(API_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
          },
          body: JSON.stringify(data)
        });

        // If token was expired (401), re-auth once and retry
        if (resp.status === 401) {
          sessionStorage.removeItem('elfaro_admin_token');
          localStorage.removeItem('elfaro_admin_token');
          token = await getValidToken();
          if (token) {
            resp = await fetch(API_ENDPOINT, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
              },
              body: JSON.stringify(data)
            });
          }
        }

        if (resp.ok) {
          const resJson = await resp.json();
          console.log('[CMS Sync] Sincronizado en servidor exitosamente:', resJson);
          return { success: true, serverSynced: true, message: resJson.message };
        } else {
          const errJson = await resp.json().catch(() => ({}));
          console.warn('[CMS Sync] Servidor rechazó guardado:', resp.status, errJson);
          return { success: false, serverSynced: false, status: resp.status, error: errJson.error || 'Acceso no autorizado o sesión expirada' };
        }
      } catch (e) {
        console.warn('[CMS Sync] Servidor no accesible:', e.message);
        return { success: true, serverSynced: false, offline: true, error: 'Servidor no disponible, guardado únicamente en caché local.' };
      }
    }

    return { success: true, serverSynced: false, noToken: true, message: 'Guardado localmente. Inicia sesión en el panel para sincronizar con el servidor.' };
  }

  window.saveCMSData = async function(newData) {
    window.CMSData = newData;
    const result = await saveCMSToLocal(newData);
    applyDynamicContent();
    document.dispatchEvent(new CustomEvent('cmsDataReady', { detail: newData }));
    return result;
  };

  // Apply Content Overrides across public pages
  function applyDynamicContent() {
    const data = window.CMSData;
    if (!data) return;

    // 1. Site Texts (Titles, Subtitles, Phone, Address, Email, Schedules)
    if (data.siteTexts) {
      const st = data.siteTexts;

      // Hero Titles & Subtitles
      if (st.heroTitle) document.querySelectorAll('.hero-content .elegant-title, .cms-hero-title').forEach(el => { el.innerText = st.heroTitle; });
      if (st.heroSubtitle) document.querySelectorAll('.hero-content .elegant-subtitle, .cms-hero-subtitle').forEach(el => { el.innerText = st.heroSubtitle; });
      if (st.aboutTitle) document.querySelectorAll('#sobre-nosotros h2, .cms-about-title').forEach(el => { el.innerText = st.aboutTitle; });
      if (st.aboutText) document.querySelectorAll('#sobre-nosotros p.section-text, .cms-about-text').forEach(el => { el.innerText = st.aboutText; });
      if (st.growthTitle) document.querySelectorAll('#crecimiento h2, .cms-growth-title').forEach(el => { el.innerText = st.growthTitle; });
      if (st.ministriesTitle) document.querySelectorAll('#ministerios h2, .cms-ministries-title').forEach(el => { el.innerHTML = st.ministriesTitle; });
      if (st.ministriesText) document.querySelectorAll('#ministerios p.section-text, .cms-ministries-text').forEach(el => { el.innerText = st.ministriesText; });
      if (st.sundaySchedule) document.querySelectorAll('.cms-schedule-sunday').forEach(el => { el.innerText = st.sundaySchedule; });
      if (st.youthSchedule) document.querySelectorAll('.cms-schedule-youth').forEach(el => { el.innerText = st.youthSchedule; });

      // Phone & Contact
      document.querySelectorAll('.cms-phone').forEach(el => { el.innerText = st.phone || ''; });
      document.querySelectorAll('.cms-address').forEach(el => { el.innerText = st.address || ''; });
      document.querySelectorAll('.cms-email').forEach(el => { el.innerText = st.email || ''; });

      // Dynamic WhatsApp FAB buttons
      if (st.whatsapp) {
        const cleanWa = st.whatsapp.replace(/\D/g, '');
        document.querySelectorAll('a.fab-whatsapp, a.whatsapp-btn').forEach(el => {
          el.href = `https://wa.me/${cleanWa}`;
        });
      }
    }

    // 2. Diezmos y Ofrendas (Bank details & QR Code)
    if (data.bankInfo) {
      const bi = data.bankInfo;
      document.querySelectorAll('.cms-bank-name').forEach(el => { el.innerText = bi.bankName || ''; });
      document.querySelectorAll('.cms-acc-name').forEach(el => { el.innerText = bi.accountName || ''; });
      document.querySelectorAll('.cms-acc-num, #acc-number').forEach(el => { el.innerText = bi.accountNumber || ''; });
      document.querySelectorAll('.cms-acc-type').forEach(el => { el.innerText = bi.accountType || ''; });
      document.querySelectorAll('.cms-bank-nit').forEach(el => { el.innerText = bi.nit || ''; });
      if (bi.featuredVerse) {
        document.querySelectorAll('.cms-verse-text').forEach(el => { el.innerText = `"${bi.featuredVerse}"`; });
      }
      if (bi.verseReference) {
        document.querySelectorAll('.cms-verse-ref').forEach(el => {
          el.innerHTML = `<i class="fas fa-book-bible" style="margin-right: 6px;"></i> ${bi.verseReference}`;
        });
      }

      const qrImgEls = document.querySelectorAll('.cms-qr-img, .qr-frame img');
      qrImgEls.forEach(el => {
        if (bi.qrImage) el.src = bi.qrImage;
      });
    }

    // Helper: Normalize category strings for reliable cross-matching
    function normalizeCategory(cat) {
      if (!cat) return '';
      return cat.toString().toLowerCase().trim()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }

    // Ensure Lightbox modal exists on any page that displays photos
    function ensureLightbox() {
      if (document.getElementById('galleryLightbox')) return;
      const lb = document.createElement('div');
      lb.id = 'galleryLightbox';
      lb.className = 'lightbox-modal';
      lb.onclick = function(e) { window.closeLightbox(e); };
      lb.innerHTML = `
        <div class="lightbox-content" onclick="event.stopPropagation()">
            <span class="lightbox-close" onclick="closeLightbox(event)">&times;</span>
            <img id="lightboxImg" src="" alt="Ampliada">
            <div id="lightboxCaption" style="padding: 16px; background: rgba(4,28,44,0.95); color: var(--color-accent, #FFD200); font-family: var(--font-heading, 'Playfair Display', serif); text-align: center; font-size: 1.2rem; border-top: 1px solid rgba(255,220,51,0.25);"></div>
        </div>
      `;
      document.body.appendChild(lb);
    }

    window.openLightbox = function(src, caption) {
      ensureLightbox();
      const lb = document.getElementById('galleryLightbox');
      const img = document.getElementById('lightboxImg');
      const cap = document.getElementById('lightboxCaption');
      if (lb && img) {
        img.src = src;
        if (cap) cap.innerText = caption || '';
        lb.style.display = 'flex';
      }
    };

    window.closeLightbox = function(e) {
      if (!e || e.target.id === 'galleryLightbox' || (e.target.classList && e.target.classList.contains('lightbox-close'))) {
        const lb = document.getElementById('galleryLightbox');
        if (lb) lb.style.display = 'none';
      }
    };

    // 3a. Dynamic Category Gallery Rendering (for galeria-jovenes, galeria-adoracion, galeria-ninos, etc.)
    const masonryGrid = document.querySelector('.masonry-grid');
    if (masonryGrid && data.galleryImages && Array.isArray(data.galleryImages)) {
      ensureLightbox();
      
      // Detect current category from page URL or heading
      const path = (window.location.pathname || '').toLowerCase();
      let currentCategory = null;
      if (path.includes('galeria-jovenes') || path.includes('min-jovenes')) currentCategory = 'jovenes';
      else if (path.includes('galeria-adoracion') || path.includes('min-adoracion')) currentCategory = 'adoracion';
      else if (path.includes('galeria-ninos') || path.includes('min-ninos')) currentCategory = 'ninos';
      else if (path.includes('galeria-familias') || path.includes('min-matrimonios')) currentCategory = 'familias';
      else if (path.includes('galeria-comunidad') || path.includes('min-servicio')) currentCategory = 'comunidad';
      else if (path.includes('galeria-predicas')) currentCategory = 'predicas';

      // Fallback: check h1 text if URL doesn't match
      if (!currentCategory) {
        const h1 = document.querySelector('h1.elegant-heading');
        const h1Text = h1 ? normalizeCategory(h1.innerText) : '';
        if (h1Text.includes('joven')) currentCategory = 'jovenes';
        else if (h1Text.includes('adoracion')) currentCategory = 'adoracion';
        else if (h1Text.includes('nino')) currentCategory = 'ninos';
        else if (h1Text.includes('familia') || h1Text.includes('matrimonio')) currentCategory = 'familias';
        else if (h1Text.includes('comunidad') || h1Text.includes('servicio')) currentCategory = 'comunidad';
        else if (h1Text.includes('predica')) currentCategory = 'predicas';
      }

      if (currentCategory) {
        const matchingImages = data.galleryImages.filter(img => {
          return normalizeCategory(img.category) === normalizeCategory(currentCategory);
        });

        if (matchingImages.length > 0) {
          masonryGrid.innerHTML = matchingImages.map(img => {
            const rawTitle = (img.title || '').trim();
            const safeCaption = rawTitle.replace(/'/g, "\\'");
            return `
              <div class="masonry-item" onclick="openLightbox('${img.imageUrl}', '${safeCaption}')" style="cursor: pointer;">
                  <img src="${img.imageUrl}" alt="${rawTitle || 'Foto'}" loading="lazy">
                  <div class="masonry-overlay"><span>${rawTitle || ''}</span></div>
              </div>
            `;
          }).join('');
        }
      }

      // Attach lightbox click handlers to all items (including static fallbacks)
      masonryGrid.querySelectorAll('.masonry-item').forEach(item => {
        if (!item.getAttribute('onclick')) {
          item.addEventListener('click', () => {
            const img = item.querySelector('img');
            const span = item.querySelector('.masonry-overlay span');
            if (img && window.openLightbox) {
              window.openLightbox(img.src, span ? span.innerText : (img.alt || ''));
            }
          });
        }
      });
    }

    // 3b. Update category card preview thumbnails on galeria-imagenes.html
    if (data.galleryImages && Array.isArray(data.galleryImages)) {
      document.querySelectorAll('.luxury-gallery-card[data-category]').forEach(card => {
        const cat = card.dataset.category;
        if (!cat) return;
        const matching = data.galleryImages.filter(img => normalizeCategory(img.category) === normalizeCategory(cat));
        if (matching.length > 0) {
          const latestImg = matching[0];
          const thumbImg = card.querySelector('.gallery-card-thumb img');
          if (thumbImg && latestImg && latestImg.imageUrl) {
            thumbImg.src = latestImg.imageUrl;
          }
        }
      });
    }

    // 3c. Dynamic Image Gallery Render (only if plain grid, never override luxury category cards)
    const galleryGrid = document.getElementById('cms-gallery-grid');
    if (galleryGrid && !galleryGrid.classList.contains('luxury-gallery-grid') && data.galleryImages && Array.isArray(data.galleryImages)) {
      galleryGrid.innerHTML = data.galleryImages.map(img => `
        <div class="gallery-item" data-category="${img.category || 'todas'}" onclick="openLightbox('${img.imageUrl}', '${(img.title || '').replace(/'/g, "\\'")}')" style="cursor: pointer;">
            <img src="${img.imageUrl}" alt="${img.title}">
            <div class="gallery-overlay">
                <div class="gallery-caption">
                    <h4>${img.title}</h4>
                    <span>${formatDate(img.date)}</span>
                </div>
            </div>
        </div>
      `).join('');
    }

    // 4. Dynamic Video Gallery Render (if on galeria-videos.html)
    const videoGrid = document.getElementById('cms-video-grid');
    if (videoGrid && data.videos && Array.isArray(data.videos)) {
      videoGrid.innerHTML = data.videos.map(vid => {
        let embedSrc = vid.embedUrl || (vid.youtubeId ? `https://www.youtube.com/embed/${vid.youtubeId}` : vid.url);
        return `
          <div class="gallery-item" style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; border-radius: 16px; border: 1px solid rgba(255,220,51,0.25);">
              <iframe src="${embedSrc}" title="${vid.title}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen style="position: absolute; top:0; left:0; width: 100%; height: 100%; border: none;"></iframe>
          </div>
        `;
      }).join('');
    }

    // 5. Navigation Menu Overrides
    if (data.navTexts) {
      const nav = data.navTexts;
      document.querySelectorAll('.nav-menu li a[href*="#hero"], .mobile-nav li a[href*="#hero"]').forEach(el => {
        if (nav.home) el.childNodes[0].nodeValue = nav.home;
      });
      document.querySelectorAll('.nav-menu li a[href*="#crecimiento"], .mobile-nav li a[href*="#crecimiento"]').forEach(el => {
        if (nav.growth) el.childNodes[0].nodeValue = nav.growth;
      });
      document.querySelectorAll('.nav-menu li a[href*="#ministerios"], .mobile-nav li a[href*="#ministerios"]').forEach(el => {
        if (nav.church) el.childNodes[0].nodeValue = nav.church;
      });
      document.querySelectorAll('.nav-menu li a[href*="#eventos"], .mobile-nav li a[href*="#eventos"]').forEach(el => {
        if (nav.events) el.childNodes[0].nodeValue = nav.events;
      });
      document.querySelectorAll('.nav-menu li a[href="diezmos-y-ofrendas.html"], .mobile-nav li a[href="diezmos-y-ofrendas.html"]').forEach(el => {
        if (nav.donations) el.innerText = nav.donations;
      });

      // Submenu items - Show or Hide dynamically
      const handleSub = (selector, val) => {
        document.querySelectorAll(selector).forEach(el => {
          if (!val || val.trim() === '') {
            if (el.parentElement) el.parentElement.style.display = 'none';
          } else {
            if (el.parentElement) el.parentElement.style.display = '';
            el.innerText = val;
          }
        });
      };

      handleSub('a[href="min-matrimonios.html"]', nav.subMatrimonios);
      handleSub('a[href="min-servicio.html"]', nav.subServicio);
      handleSub('a[href="min-jovenes.html"]', nav.subJovenes);
      handleSub('a[href="min-ninos.html"]', nav.subNinos);
      handleSub('a[href="min-adolescentes.html"]', nav.subAdolescentes);
      handleSub('a[href="min-intercesion.html"]', nav.subIntercesion);
      handleSub('a[href="min-adoracion.html"]', nav.subAdoracion);
      handleSub('a[href="min-educacion.html"]', nav.subEducacion);
      handleSub('a[href="min-damas.html"]', nav.subDamas);
      handleSub('a[href="min-proyecto-daniel.html"]', nav.subDaniel);
      handleSub('a[href="galeria-videos.html"]', nav.subVideos);
      handleSub('a[href="galeria-imagenes.html"]', nav.subImages);
    }

    // 6. Section Content Overrides
    if (data.siteTexts) {
      const st = data.siteTexts;
      const heroTitleEl = document.querySelector('.hero-content .elegant-title');
      if (heroTitleEl && st.heroTitle) heroTitleEl.innerText = st.heroTitle;

      const heroSubEl = document.querySelector('.hero-content .elegant-subtitle');
      if (heroSubEl && st.heroSubtitle) heroSubEl.innerText = st.heroSubtitle;

      const aboutTitleEl = document.querySelector('#sobre-nosotros h2');
      if (aboutTitleEl && st.aboutTitle) aboutTitleEl.innerText = st.aboutTitle;

      const aboutTextEl = document.querySelector('#sobre-nosotros p.section-text');
      if (aboutTextEl && st.aboutText) aboutTextEl.innerText = st.aboutText;

      const growthTitleEl = document.querySelector('#crecimiento h2');
      if (growthTitleEl && st.growthTitle) growthTitleEl.innerText = st.growthTitle;

      const minTitleEl = document.querySelector('#ministerios h2');
      if (minTitleEl && st.ministriesTitle) minTitleEl.innerHTML = st.ministriesTitle;

      const minTextEl = document.querySelector('#ministerios p.section-text');
      if (minTextEl && st.ministriesText) minTextEl.innerText = st.ministriesText;
    }

    // 7. Page-Specific In-Place Visual Edits (for ANY page without altering event listeners or buttons)
    if (data.pageEdits) {
      const pageKey = window.location.pathname.split('/').pop().replace('.html', '') || 'inicio';
      const edits = data.pageEdits[pageKey];
      if (edits && typeof edits === 'object') {
        Object.keys(edits).forEach(selector => {
          const val = edits[selector];
          try {
            const el = document.querySelector(selector);
            if (!el) return;
            if (val && typeof val === 'object') {
              if (val.text !== undefined) el.innerHTML = val.text;
              if (val.src !== undefined && el.tagName === 'IMG') el.src = val.src;
            } else if (typeof val === 'string') {
              el.innerHTML = val;
            }
          } catch (e) {
            console.warn('[CMS Loader] No se pudo aplicar edición a:', selector, e);
          }
        });
      }
    }
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch(e) {
      return dateStr;
    }
  }

  // Setup listeners to log submissions to CMS
  function setupFormListeners() {
    // Prayer Form
    const prayerForm = document.getElementById('prayerForm');
    if (prayerForm && !prayerForm.dataset.cmsWired) {
      prayerForm.dataset.cmsWired = 'true';
      prayerForm.addEventListener('submit', function (e) {
        const nameInput = prayerForm.querySelector('input[type="text"]');
        const phoneInput = prayerForm.querySelector('input[type="tel"]');
        const emailInput = prayerForm.querySelector('input[type="email"]');
        const msgInput = prayerForm.querySelector('textarea');

        if (nameInput) {
          const payload = {
            name: nameInput.value.trim(),
            phone: phoneInput ? phoneInput.value.trim() : '',
            email: emailInput ? emailInput.value.trim() : '',
            request: msgInput ? msgInput.value.trim() : ''
          };

          // Send isolated submission to backend inbox
          fetch(window.getApiUrl('inbox/prayer'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          }).catch(() => {});

          // Local optimistic update for UI persistence
          if (window.CMSData) {
            const newPrayer = {
              id: 'pr-' + Date.now(),
              ...payload,
              date: new Date().toISOString(),
              status: 'Pendiente'
            };
            window.CMSData.prayers = window.CMSData.prayers || [];
            window.CMSData.prayers.unshift(newPrayer);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(window.CMSData));
          }
        }
      });
    }

    // Giving Form
    const givingForm = document.getElementById('givingForm');
    if (givingForm && !givingForm.dataset.cmsWired) {
      givingForm.dataset.cmsWired = 'true';
      givingForm.addEventListener('submit', function(e) {
        const name = document.getElementById('giving-name');
        const phone = document.getElementById('giving-phone');
        const email = document.getElementById('giving-email');
        const type = document.getElementById('giving-type');
        const ref = document.getElementById('giving-ref');
        const message = document.getElementById('giving-message');

        if (name) {
          const payload = {
            name: name.value.trim(),
            phone: phone ? phone.value.trim() : '',
            email: email ? email.value.trim() : '',
            type: type ? type.value.trim() : 'General',
            ref: ref ? ref.value.trim() : '',
            message: message ? message.value.trim() : ''
          };

          // Send isolated submission to backend inbox
          fetch(window.getApiUrl('inbox/contribution'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          }).catch(() => {});

          // Local optimistic update for UI persistence
          if (window.CMSData) {
            const newContribution = {
              id: 'ct-' + Date.now(),
              ...payload,
              date: new Date().toISOString()
            };
            window.CMSData.contributions = window.CMSData.contributions || [];
            window.CMSData.contributions.unshift(newContribution);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(window.CMSData));
          }
        }
      });
    }
  }

  // Run CMS engine when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCMS);
  } else {
    initCMS();
  }
})();
