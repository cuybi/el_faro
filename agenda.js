document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const btnAgenda = document.getElementById('btn-agenda-modal');
    const modalAgenda = document.getElementById('agenda-modal');
    const btnCloseAgenda = document.getElementById('close-agenda');
    
    const monthYearText = document.getElementById('current-month-year');
    const daysContainer = document.getElementById('calendar-days');
    const btnPrevMonth = document.getElementById('prev-month');
    const btnNextMonth = document.getElementById('next-month');
    
    const agendaDetails = document.getElementById('agenda-details');
    const selectedDateText = document.getElementById('selected-date-text');
    const timeSlotsContainer = document.getElementById('time-slots');
    
    const agendaForm = document.getElementById('agenda-form');
    const agendaSuccess = document.getElementById('agenda-success');
    
    const agendaCalendar = document.querySelector('.agenda-calendar');

    // State
    let currentDate = new Date();
    let selectedDate = null;
    let selectedTime = null;

    const availableTimes = ['09:00 AM', '10:00 AM', '11:00 AM', '02:00 PM', '03:30 PM', '05:00 PM'];
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    // Modal Logic - ponytail: delegated listener survives any dynamic DOM hydration of <main>
    document.addEventListener('click', (e) => {
        const trigger = e.target.closest('#btn-agenda-modal, .btn-agenda-trigger');
        if (trigger && modalAgenda) {
            e.preventDefault();
            modalAgenda.classList.add('active');
            renderCalendar();
            resetBookingState();
        }
    });

    if (btnCloseAgenda) {
        btnCloseAgenda.addEventListener('click', () => {
            modalAgenda.classList.remove('active');
        });
    }

    // Close on outside click
    window.addEventListener('click', (e) => {
        if (e.target === modalAgenda) {
            modalAgenda.classList.remove('active');
        }
    });

    // Calendar Logic
    function renderCalendar() {
        daysContainer.innerHTML = '';
        
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        
        monthYearText.textContent = `${months[month]} ${year}`;
        
        // First day of the month (0 = Sunday, 1 = Monday...)
        const firstDay = new Date(year, month, 1).getDay();
        
        // Days in the current month
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        // Today's date for comparison
        const today = new Date();
        today.setHours(0,0,0,0);
        
        // Render empty slots for days before the 1st
        for (let i = 0; i < firstDay; i++) {
            const emptyDiv = document.createElement('div');
            emptyDiv.classList.add('calendar-day', 'empty');
            daysContainer.appendChild(emptyDiv);
        }
        
        // Render days
        for (let i = 1; i <= daysInMonth; i++) {
            const dayDiv = document.createElement('div');
            dayDiv.classList.add('calendar-day');
            dayDiv.textContent = i;
            
            const dateOfThisDay = new Date(year, month, i);
            
            // Check if day is past
            if (dateOfThisDay < today) {
                dayDiv.classList.add('disabled');
            } else {
                // Check if it's today
                if (dateOfThisDay.getTime() === today.getTime()) {
                    dayDiv.classList.add('today');
                }
                
                // Add click event for valid days
                dayDiv.addEventListener('click', () => {
                    // Remove selected class from all
                    document.querySelectorAll('.calendar-day').forEach(d => d.classList.remove('selected'));
                    dayDiv.classList.add('selected');
                    
                    selectedDate = dateOfThisDay;
                    showTimeSlots();
                });
            }
            
            daysContainer.appendChild(dayDiv);
        }
    }

    if (btnPrevMonth) {
        btnPrevMonth.addEventListener('click', () => {
            currentDate.setMonth(currentDate.getMonth() - 1);
            renderCalendar();
            resetBookingState();
        });
    }

    if (btnNextMonth) {
        btnNextMonth.addEventListener('click', () => {
            currentDate.setMonth(currentDate.getMonth() + 1);
            renderCalendar();
            resetBookingState();
        });
    }

    // Time Slots Logic
    function showTimeSlots() {
        agendaDetails.style.display = 'block';
        agendaForm.style.display = 'none';
        selectedTime = null;
        
        // Format date: dd de mes, YYYY
        const day = selectedDate.getDate();
        const month = months[selectedDate.getMonth()];
        const year = selectedDate.getFullYear();
        selectedDateText.textContent = `${day} de ${month.toLowerCase()}, ${year}`;
        
        timeSlotsContainer.innerHTML = '';
        
        availableTimes.forEach(time => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.classList.add('time-slot-btn');
            btn.textContent = time;
            
            btn.addEventListener('click', () => {
                document.querySelectorAll('.time-slot-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                selectedTime = time;
                agendaForm.style.display = 'block';
            });
            
            timeSlotsContainer.appendChild(btn);
        });
        
        // Scroll to details gently
        agendaDetails.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // Form Submit Logic
    if (agendaForm) {
        agendaForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            if (selectedDate && selectedTime) {
                const nameInput = document.getElementById('agenda-name');
                const emailInput = document.getElementById('agenda-email');
                const phoneInput = document.getElementById('agenda-phone');

                const payload = {
                    name: nameInput ? nameInput.value.trim() : 'Miembro El Faro',
                    email: emailInput ? emailInput.value.trim() : '',
                    phone: phoneInput ? phoneInput.value.trim() : '',
                    date: selectedDate ? selectedDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                    time: selectedTime
                };

                // Send isolated appointment to backend inbox
                const appInboxUrl = window.getApiUrl ? window.getApiUrl('inbox/appointment') : '/api/index.php?route=inbox/appointment';
                fetch(appInboxUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                }).catch(() => {});

                // Local optimistic cache update
                const newApp = {
                    id: 'app-' + Date.now(),
                    ...payload,
                    status: 'Pendiente'
                };

                if (window.CMSData) {
                    window.CMSData.appointments = window.CMSData.appointments || [];
                    window.CMSData.appointments.unshift(newApp);
                    localStorage.setItem('elfaro_cms_data', JSON.stringify(window.CMSData));
                } else {
                    try {
                        let cached = JSON.parse(localStorage.getItem('elfaro_cms_data') || '{}');
                        cached.appointments = cached.appointments || [];
                        cached.appointments.unshift(newApp);
                        localStorage.setItem('elfaro_cms_data', JSON.stringify(cached));
                    } catch(err) {}
                }

                agendaCalendar.style.display = 'none';
                agendaDetails.style.display = 'none';
                agendaSuccess.style.display = 'block';
            }
        });
    }

    function resetBookingState() {
        agendaDetails.style.display = 'none';
        agendaForm.style.display = 'none';
        agendaSuccess.style.display = 'none';
        agendaCalendar.style.display = 'block';
        selectedDate = null;
        selectedTime = null;
        if (agendaForm) agendaForm.reset();
    }
});
