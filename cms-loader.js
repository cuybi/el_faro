/**
 * CMS Loader Engine — El Faro CVC
 * Handles dynamic content synchronization between CMS data store and public web pages.
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'elfaro_cms_data';
  const API_ENDPOINT = '/api/cms-data';

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
        // and admin edits that occurred while offline or without server running
        const cached = localStorage.getItem(STORAGE_KEY);
        if (cached) {
          try {
            const localData = JSON.parse(cached);
            
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
            
            // If local data was saved more recently by admin, preserve bankInfo, siteTexts, navTexts, pageMainContent
            if (localData._lastSavedLocal && (!fetchedData._lastSavedLocal || localData._lastSavedLocal > fetchedData._lastSavedLocal)) {
              if (localData.bankInfo) fetchedData.bankInfo = Object.assign({}, fetchedData.bankInfo, localData.bankInfo);
              if (localData.siteTexts) fetchedData.siteTexts = Object.assign({}, fetchedData.siteTexts, localData.siteTexts);
              if (localData.navTexts) fetchedData.navTexts = Object.assign({}, fetchedData.navTexts, localData.navTexts);
              if (localData.pageMainContent) fetchedData.pageMainContent = Object.assign({}, fetchedData.pageMainContent, localData.pageMainContent);
              if (localData.galleryImages) fetchedData.galleryImages = localData.galleryImages;
            }
          } catch (e) {
            console.warn('Notice: Error merging local CMS cache', e);
          }
        }
        
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

  async function saveCMSToLocal(data) {
    if (data) {
      data._lastSavedLocal = Date.now();
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

    // Retrieve admin token from either sessionStorage or localStorage
    const token = sessionStorage.getItem('elfaro_admin_token') || localStorage.getItem('elfaro_admin_token');
    if (token) {
      try {
        const resp = await fetch(API_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
          },
          body: JSON.stringify(data)
        });

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

    // ponytail: hydrate saved page-level visual edits once before field selectors run
    let pageKey = window.location.pathname.split('/').pop() || 'inicio.html';
    if (!pageKey || pageKey === '/') pageKey = 'inicio.html';
    if (data.pageMainContent && data.pageMainContent[pageKey]) {
      const mainEl = document.querySelector('main');
      if (mainEl && !mainEl.dataset.cmsHydrated) {
        mainEl.innerHTML = data.pageMainContent[pageKey];
        mainEl.dataset.cmsHydrated = 'true';
      }
    }

    // 1. Site Texts (Phone, Address, Email, Schedules)
    if (data.siteTexts) {
      const st = data.siteTexts;

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

    // 3. Dynamic Image Gallery Render (only if plain grid, never override luxury category cards)
    const galleryGrid = document.getElementById('cms-gallery-grid');
    if (galleryGrid && !galleryGrid.classList.contains('luxury-gallery-grid') && data.galleryImages && Array.isArray(data.galleryImages)) {
      galleryGrid.innerHTML = data.galleryImages.map(img => `
        <div class="gallery-item" data-category="${img.category || 'todas'}">
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
          fetch('/api/inbox/prayer', {
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
          fetch('/api/inbox/contribution', {
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
