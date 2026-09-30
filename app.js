/**
 * EL FARO - CENTRO DE VIDA CRISTIANA
 * Lógica principal del sitio web
 */

document.addEventListener('DOMContentLoaded', () => {
    
    // ==========================================
    // 1. INTRO LOADER & AUTO REDIRECT
    // ==========================================
    const loader = document.getElementById('intro-loader');
    if (loader) {
        setTimeout(() => {
            loader.classList.add('fade-out');
            setTimeout(() => {
                loader.style.display = 'none';
                if (window.location.pathname.endsWith('index.html') || window.location.pathname.endsWith('/')) {
                    window.location.href = 'inicio.html';
                }
            }, 300); 
        }, 600);
    }

    // ==========================================
    // 2. HEADER SCROLL EFFECT (Para inicio.html)
    // ==========================================
    const header = document.getElementById('header');
    if (header) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) {
                header.classList.add('scrolled');
            } else {
                header.classList.remove('scrolled');
            }
        });
    }

    // ==========================================
    // 2.5 ACTIVE NAV HIGHLIGHT
    // ==========================================
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const allNavLinks = document.querySelectorAll('.nav-menu ul > li > a');
    const allMobileLinks = document.querySelectorAll('.mobile-nav > ul > li > a');

    /**
     * Removes 'active' from all top-level nav links (desktop + mobile).
     */
    function clearActiveNav() {
        allNavLinks.forEach(a => a.classList.remove('active'));
        allMobileLinks.forEach(a => a.classList.remove('active'));
    }

    /**
     * Sets active on the nav link whose href matches `selector`.
     * Works for both hash anchors (#hero) and filenames (min-jovenes.html).
     */
    function setActiveNav(selector) {
        clearActiveNav();
        // Desktop nav
        allNavLinks.forEach(a => {
            const href = a.getAttribute('href');
            if (href === selector) {
                a.classList.add('active');
            }
        });
        // Mobile nav
        allMobileLinks.forEach(a => {
            const href = a.getAttribute('href');
            if (href === selector) {
                a.classList.add('active');
            }
        });
    }

    // --- A) SCROLL SPY for inicio.html ---
    const sectionIds = ['hero', 'crecimiento', 'ministerios', 'eventos', 'contacto'];
    const sections = sectionIds
        .map(id => document.getElementById(id))
        .filter(Boolean);

    if (currentPage === 'inicio.html' && sections.length > 0) {
        // Set initial active
        setActiveNav('#hero');

        const spyObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    setActiveNav('#' + entry.target.id);
                }
            });
        }, {
            threshold: 0.15,
            rootMargin: '-80px 0px -40% 0px'
        });

        sections.forEach(section => spyObserver.observe(section));
    }

    // --- B) FILENAME-BASED active state for subpages ---
    else if (currentPage !== 'inicio.html' && currentPage !== 'index.html') {
        clearActiveNav();

        // If we're on a ministerio page, highlight "Ministerios" dropdown toggle
        if (currentPage.startsWith('min-') || currentPage === 'grupos.html' ||
            currentPage === 'pastores.html' || currentPage === 'primera-vez.html') {
            document.querySelectorAll('.nav-menu .dropdown > a').forEach(a => {
                if (a.textContent.trim().startsWith('Ministerios')) {
                    a.classList.add('active');
                }
            });
            document.querySelectorAll('.mobile-nav .mobile-dropdown-toggle').forEach(a => {
                if (a.textContent.trim().startsWith('Ministerios')) {
                    a.classList.add('active');
                }
            });
        }
        // If we're on a galería/prédicas page, highlight "Prédicas" dropdown toggle
        else if (currentPage.startsWith('galeria-')) {
            document.querySelectorAll('.nav-menu .dropdown > a').forEach(a => {
                if (a.textContent.trim().startsWith('Prédicas')) {
                    a.classList.add('active');
                }
            });
            document.querySelectorAll('.mobile-nav .mobile-dropdown-toggle').forEach(a => {
                if (a.textContent.trim().startsWith('Prédicas')) {
                    a.classList.add('active');
                }
            });
        }
    }


    // ==========================================
    // 3. MOBILE MENU & ACCORDION DROPDOWNS
    // ==========================================
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const closeMenuBtn  = document.getElementById('closeMenu');
    const mobileNav     = document.getElementById('mobileNav');

    if (mobileMenuBtn && mobileNav) {
        // Open menu
        mobileMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            mobileNav.classList.add('open');
            document.body.style.overflow = 'hidden'; // prevent scroll behind menu
        });

        // Close via X button
        if (closeMenuBtn) {
            closeMenuBtn.addEventListener('click', () => {
                mobileNav.classList.remove('open');
                document.body.style.overflow = '';
            });
        }

        // Toggle mobile dropdown accordions
        mobileNav.querySelectorAll('.mobile-dropdown-toggle').forEach(toggle => {
            toggle.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const parent = toggle.closest('.mobile-dropdown');
                if (parent) {
                    parent.classList.toggle('active');
                }
            });
        });

        // Close menu when clicking a regular link inside (not a dropdown toggle)
        mobileNav.querySelectorAll('a:not(.mobile-dropdown-toggle)').forEach(link => {
            link.addEventListener('click', () => {
                mobileNav.classList.remove('open');
                document.body.style.overflow = '';
            });
        });

        // Close when tapping outside the menu panel
        document.addEventListener('click', (e) => {
            if (mobileNav.classList.contains('open') &&
                !mobileNav.contains(e.target) &&
                e.target !== mobileMenuBtn) {
                mobileNav.classList.remove('open');
                document.body.style.overflow = '';
            }
        });
    }

    // ==========================================
    // 4. SMOOTH SCROLL PARA ANCLAS
    // ==========================================
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const targetId = this.getAttribute('href');
            if(targetId === '#') return;
            
            const targetElement = document.querySelector(targetId);
            
            if(targetElement) {
                e.preventDefault();
                const headerHeight = document.querySelector('header') ? document.querySelector('header').offsetHeight : 0;
                const elementPosition = targetElement.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerHeight;
  
                window.scrollTo({
                    top: offsetPosition,
                    behavior: "smooth"
                });
            }
        });
    });

    // ==========================================
    // 5. FORMULARIO DE CONTACTO
    // ==========================================

    const contactForm = document.getElementById('contactForm');
    if (contactForm) {
        contactForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const btnSubmit = contactForm.querySelector('.btn-submit-contact');
            const originalContent = btnSubmit.innerHTML;
            
            btnSubmit.innerHTML = '<span>Enviando mensaje...</span> <i class="fas fa-spinner fa-spin"></i>';
            btnSubmit.disabled = true;

            setTimeout(() => {
                alert('¡Gracias por comunicarte con nosotros! Tu mensaje ha sido enviado exitosamente.');
                contactForm.reset();
                btnSubmit.innerHTML = originalContent;
                btnSubmit.disabled = false;
            }, 1500);
        });
    }

    // ==========================================
    // 6. CARRUSEL DE BIENVENIDA (index.html)
    // ==========================================
    const welcomeCarouselImages = document.querySelectorAll('.welcome-carousel .bg-image');
    if (welcomeCarouselImages.length > 0) {
        let currentImageIndex = 0;
        
        setInterval(() => {
            // Remover clase active de la imagen actual
            welcomeCarouselImages[currentImageIndex].classList.remove('active');
            
            // Incrementar índice
            currentImageIndex = (currentImageIndex + 1) % welcomeCarouselImages.length;
            
            // Añadir clase active a la nueva imagen
            welcomeCarouselImages[currentImageIndex].classList.add('active');
        }, 5000); // Cambiar cada 5 segundos
    }

    // ==========================================
    // 7. SCROLL REVEAL ANIMATIONS (IntersectionObserver)
    // ==========================================
    const revealElements = document.querySelectorAll(
        '.section-header, .elegant-card, .gallery-item, .split-content, .split-image, .split-video, .prayer-box, .event-info, .footer-col, .min-hero-content'
    );

    revealElements.forEach(el => {
        if (!el.classList.contains('reveal') && !el.classList.contains('reveal-left') && !el.classList.contains('reveal-right')) {
            el.classList.add('reveal');
        }
    });

    // Stagger grid items (retraso progresivo para cuadrículas)
    const gridContainers = document.querySelectorAll('.cards-grid-elegant, .masonry-grid, .gallery-grid');
    gridContainers.forEach(grid => {
        const children = grid.children;
        Array.from(children).forEach((child, idx) => {
            child.style.transitionDelay = `${(idx % 4) * 0.12}s`;
        });
    });

    if ('IntersectionObserver' in window) {
        const observerOptions = {
            threshold: 0.12,
            rootMargin: '0px 0px -30px 0px'
        };

        const observer = new IntersectionObserver((entries, obs) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('revealed');
                    obs.unobserve(entry.target);
                }
            });
        }, observerOptions);

        document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale').forEach(el => {
            observer.observe(el);
        });
    } else {
        // Fallback para navegadores antiguos
        document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale').forEach(el => {
            el.classList.add('revealed');
        });
    }

    // ==========================================
    // 8. PRAYER FORM SUBMISSION HANDLER
    // ==========================================
    const prayerForm = document.getElementById('prayerForm');
    const prayerSuccessMsg = document.getElementById('prayerSuccessMsg');
    if (prayerForm) {
        prayerForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const inputs = prayerForm.querySelectorAll('input, textarea');
            const name = inputs[0] ? inputs[0].value.trim() : 'Anónimo';
            const email = inputs[1] ? inputs[1].value.trim() : '';
            const request = inputs[2] ? inputs[2].value.trim() : '';

            // Save to CMSData inbox
            if (window.CMSData) {
                window.CMSData.prayers = window.CMSData.prayers || [];
                window.CMSData.prayers.unshift({
                    id: 'pray-' + Date.now(),
                    name: name,
                    contact: email,
                    request: request,
                    date: new Date().toISOString().split('T')[0]
                });
                if (window.saveCMSData) window.saveCMSData(window.CMSData);
            }

            prayerForm.style.display = 'none';
            if (prayerSuccessMsg) {
                prayerSuccessMsg.style.display = 'block';
            }
        });
    }

    // ==========================================
    // 9. LIVE COUNTDOWN TIMER FOR EVENTS
    // ==========================================
    const cdDays = document.getElementById('cd-days');
    const cdHours = document.getElementById('cd-hours');
    const cdMins = document.getElementById('cd-mins');
    const cdSecs = document.getElementById('cd-secs');

    if (cdDays && cdHours && cdMins && cdSecs) {
        const targetDate = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000 + 8 * 3600 * 1000);
        
        function updateCountdown() {
            const now = new Date().getTime();
            const distance = targetDate.getTime() - now;

            if (distance < 0) return;

            const days = Math.floor(distance / (1000 * 60 * 60 * 24));
            const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);

            cdDays.innerText = String(days).padStart(2, '0');
            cdHours.innerText = String(hours).padStart(2, '0');
            cdMins.innerText = String(minutes).padStart(2, '0');
            cdSecs.innerText = String(seconds).padStart(2, '0');
        }

        updateCountdown();
        setInterval(updateCountdown, 1000);
    }
});

