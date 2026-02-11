// Calendar Sync Module - iCal and Google Calendar Integration
import ICAL from 'ical.js';

export class CalendarSync {
    constructor(tasksManager, calendarManager) {
        this.tasksManager = tasksManager;
        this.calendarManager = calendarManager;
        this.assessmentKeywords = ['assignment', 'exam', 'test', 'quiz', 'project', 'due', 'homework', 'assessment', 'submission', 'midterm', 'final'];

        this.googleCalendarBtn = document.getElementById('googleCalendarBtn');
        this.importIcalBtn = document.getElementById('importIcalBtn');
        this.icalUrlInput = document.getElementById('icalUrlInput');
        this.importFileBtn = document.getElementById('importFileBtn');
        this.icalFileInput = document.getElementById('icalFileInput');

        this.init();
    }

    init() {
        this.googleCalendarBtn.addEventListener('click', () => this.connectGoogleCalendar());
        this.importIcalBtn.addEventListener('click', () => this.importIcalUrl());
        this.importFileBtn.addEventListener('click', () => this.importIcalFile());
    }

    async connectGoogleCalendar() {
        alert('Google Calendar OAuth integration requires a backend server for security.\n\nFor the MVP, please use the iCal/Webcal URL option instead.\n\nTo get your Google Calendar iCal URL:\n1. Open Google Calendar\n2. Click Settings > your calendar > Integrate calendar\n3. Copy the "Secret address in iCal format" URL\n4. Paste it in the field below');
    }

    async importIcalUrl() {
        const url = this.icalUrlInput.value.trim();
        if (!url) {
            alert('Please enter an iCal URL');
            return;
        }

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('Failed to fetch calendar');

            const icalData = await response.text();
            this.parseAndImportIcal(icalData);

            alert('Calendar imported successfully! Assessments have been added to your tasks.');
            window.closeCalendarSyncModal();
        } catch (error) {
            console.error('Import error:', error);
            alert(`Failed to import calendar: ${error.message}\n\nNote: Due to CORS restrictions, some calendar URLs may not work directly from the browser. Try downloading the .ics file and hosting it on a CORS-enabled server, or use a CORS proxy.`);
        }
    }

    async importIcalFile() {
        const file = this.icalFileInput.files[0];
        if (!file) {
            alert('Please select a .ics file');
            return;
        }

        try {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const icalData = e.target.result;
                    console.log('📄 File read successfully, parsing...');
                    this.parseAndImportIcal(icalData);
                    alert('✅ Calendar imported successfully!\n\nCheck the Calendar tab to see your imported events.\nCheck the Tasks tab to see auto-created assessment tasks.\n\nOpen browser console (F12) for detailed import log.');
                    window.closeCalendarSyncModal();
                } catch (error) {
                    console.error('Parse error:', error);
                    alert(`Failed to parse calendar file: ${error.message}`);
                }
            };
            reader.onerror = () => {
                alert('Failed to read file');
            };
            reader.readAsText(file);
        } catch (error) {
            console.error('File import error:', error);
            alert(`Failed to import file: ${error.message}`);
        }
    }

    parseAndImportIcal(icalData) {
        try {
            console.log('📅 Starting iCal import...');
            const jcalData = ICAL.parse(icalData);
            const comp = new ICAL.Component(jcalData);
            const vevents = comp.getAllSubcomponents('vevent');

            console.log(`Found ${vevents.length} events in calendar`);

            let importedCount = 0;
            let assessmentCount = 0;

            vevents.forEach(vevent => {
                const event = new ICAL.Event(vevent);
                const title = event.summary;
                const startDate = event.startDate;
                const description = event.description || '';

                // Helper to get local ISO string (YYYY-MM-DDTHH:mm)
                const getLocalISOString = (date) => {
                    const offset = date.getTimezoneOffset() * 60000;
                    const localDate = new Date(date.getTime() - offset);
                    return localDate.toISOString().slice(0, 16);
                };

                let dateStr;
                if (startDate.isDate) {
                    // All-day event: Use YYYY-MM-DD locally (midnight)
                    const m = String(startDate.month).padStart(2, '0');
                    const d = String(startDate.day).padStart(2, '0');
                    dateStr = `${startDate.year}-${m}-${d}T00:00`;
                } else {
                    // Timed event: Convert to local time string
                    dateStr = getLocalISOString(startDate.toJSDate());
                }

                // Add to calendar
                const eventData = {
                    id: event.uid || Date.now().toString() + Math.random(),
                    title,
                    date: dateStr,
                    description
                };
                this.calendarManager.addEvent(eventData);
                importedCount++;
                console.log(`✅ Imported: ${title} on ${dateStr}`);

                // Check if it's an assessment and create task
                if (this.isAssessment(title, description)) {
                    const taskData = {
                        title: `📚 ${title}`,
                        date: dateStr,
                        description: description || 'Imported from calendar'
                    };
                    this.tasksManager.addTaskFromEvent(taskData);
                    assessmentCount++;
                    console.log(`📚 Created task from assessment: ${title}`);
                }
            });

            console.log(`🎉 Import complete! ${importedCount} events imported, ${assessmentCount} tasks created from assessments`);

            // Force calendar to refresh
            this.calendarManager.render();
        } catch (error) {
            console.error('Parse error:', error);
            throw new Error('Failed to parse calendar data');
        }
    }

    isAssessment(title, description) {
        const text = (title + ' ' + description).toLowerCase();
        return this.assessmentKeywords.some(keyword => text.includes(keyword));
    }
}
