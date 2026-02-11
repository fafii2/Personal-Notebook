// Calendar Module
export class CalendarManager {
    constructor(tasksManager) {
        this.tasksManager = tasksManager;
        this.currentDate = new Date();
        this.events = this.loadEvents();
        this.calendarGrid = document.getElementById('calendarGrid');
        this.calendarMonth = document.getElementById('calendarMonth');
        this.prevMonthBtn = document.getElementById('prevMonthBtn');
        this.nextMonthBtn = document.getElementById('nextMonthBtn');

        this.init();
    }

    init() {
        this.prevMonthBtn.addEventListener('click', () => this.changeMonth(-1));
        this.nextMonthBtn.addEventListener('click', () => this.changeMonth(1));
        this.render();
    }

    changeMonth(delta) {
        this.currentDate.setMonth(this.currentDate.getMonth() + delta);
        this.render();
    }

    refreshEvents() {
        // Reload events from localStorage to pick up new imports
        this.events = this.loadEvents();
    }

    render() {
        // Always refresh events before rendering to catch imports
        this.refreshEvents();

        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();

        this.calendarMonth.textContent = new Date(year, month).toLocaleDateString('en-US', {
            month: 'long',
            year: 'numeric'
        });

        this.calendarGrid.innerHTML = this.createCalendarHTML(year, month);
    }

    createCalendarHTML(year, month) {
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const prevLastDay = new Date(year, month, 0);
        const firstDayOfWeek = firstDay.getDay();
        const daysInMonth = lastDay.getDate();
        const daysInPrevMonth = prevLastDay.getDate();

        let html = `
      <div class="calendar-weekdays">
        <div class="calendar-weekday">Sun</div>
        <div class="calendar-weekday">Mon</div>
        <div class="calendar-weekday">Tue</div>
        <div class="calendar-weekday">Wed</div>
        <div class="calendar-weekday">Thu</div>
        <div class="calendar-weekday">Fri</div>
        <div class="calendar-weekday">Sat</div>
      </div>
      <div class="calendar-days">
    `;

        // Previous month days
        for (let i = firstDayOfWeek - 1; i >= 0; i--) {
            const day = daysInPrevMonth - i;
            html += `<div class="calendar-day other-month"><span class="day-number">${day}</span></div>`;
        }

        // Current month days
        const today = new Date();
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            const isToday = date.toDateString() === today.toDateString();
            const dateStr = date.toISOString().split('T')[0];
            const hasEvents = this.events.some(e => e.date.startsWith(dateStr));

            html += `
        <div class="calendar-day ${isToday ? 'today' : ''} ${hasEvents ? 'has-events' : ''}" 
             data-date="${dateStr}">
          <span class="day-number">${day}</span>
        </div>
      `;
        }

        // Next month days
        const remainingDays = 42 - (firstDayOfWeek + daysInMonth);
        for (let day = 1; day <= remainingDays; day++) {
            html += `<div class="calendar-day other-month"><span class="day-number">${day}</span></div>`;
        }

        html += `</div>`;
        return html;
    }

    addEvent(eventData) {
        this.events.push(eventData);
        this.saveEvents();
        this.render();
    }

    loadEvents() {
        const stored = localStorage.getItem('calendar-events');
        return stored ? JSON.parse(stored) : [];
    }

    saveEvents() {
        localStorage.setItem('calendar-events', JSON.stringify(this.events));
    }

    getEventsForDate(dateStr) {
        return this.events.filter(e => e.date.startsWith(dateStr));
    }
}
