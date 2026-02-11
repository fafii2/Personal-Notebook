// ============================================
// Main Application - Calendar Task Manager
// ============================================
import ICAL from 'ical.js';

// ============================================
// App State
// ============================================
const state = {
    currentMonth: new Date(),
    events: [],
    tasks: [],
    sources: [], // Stores synced calendar sources
    ignoredEvents: [], // Stores IDs of deleted calendar events
    filter: 'all',
};

let cloudManager; // Global reference for auto-sync

// ============================================
// Storage Utilities
// ============================================
function saveToStorage() {
    localStorage.setItem('calendarEvents', JSON.stringify(state.events));
    localStorage.setItem('tasks', JSON.stringify(state.tasks));
    localStorage.setItem('calendarSources', JSON.stringify(state.sources));
    localStorage.setItem('ignoredEvents', JSON.stringify(state.ignoredEvents || []));

    // Auto-sync to cloud on every change (debounced)
    // For Firebase, we can call save() directly or debounced. 
    // BUT we must check if the change CAME from firebase (handled by isLocalChange flag in manager)
    if (cloudManager && !cloudManager.isLocalChange) {
        cloudManager.save();
    }
}

function loadFromStorage() {
    const events = localStorage.getItem('calendarEvents');
    const tasks = localStorage.getItem('tasks');
    const sources = localStorage.getItem('calendarSources');
    const ignored = localStorage.getItem('ignoredEvents');

    if (events) state.events = JSON.parse(events);
    if (tasks) state.tasks = JSON.parse(tasks);
    if (sources) state.sources = JSON.parse(sources);
    if (ignored) state.ignoredEvents = JSON.parse(ignored);
}

// ============================================
// Calendar Manager
// ============================================
class CalendarManager {
    constructor() {
        this.grid = document.getElementById('calendarGrid');
        this.monthTitle = document.getElementById('currentMonth');
        this.prevBtn = document.getElementById('prevMonth');
        this.nextBtn = document.getElementById('nextMonth');

        this.init();
    }

    init() {
        this.prevBtn.addEventListener('click', () => this.changeMonth(-1));
        this.nextBtn.addEventListener('click', () => this.changeMonth(1));
        this.render();
    }

    changeMonth(delta) {
        state.currentMonth.setMonth(state.currentMonth.getMonth() + delta);
        this.render();
    }

    render() {
        const year = state.currentMonth.getFullYear();
        const month = state.currentMonth.getMonth();

        // Update title
        this.monthTitle.textContent = state.currentMonth.toLocaleDateString('en-US', {
            month: 'long',
            year: 'numeric'
        });

        // Calculate calendar grid
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startingDayOfWeek = firstDay.getDay();
        const daysInMonth = lastDay.getDate();

        // Clear grid
        this.grid.innerHTML = '';

        // Add day headers
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        dayNames.forEach(day => {
            const header = document.createElement('div');
            header.className = 'calendar-day-header';
            header.textContent = day;
            this.grid.appendChild(header);
        });

        // Add empty cells for days before month starts
        for (let i = 0; i < startingDayOfWeek; i++) {
            const emptyDay = document.createElement('div');
            emptyDay.className = 'calendar-day other-month';
            this.grid.appendChild(emptyDay);
        }

        // Add days of the month
        for (let day = 1; day <= daysInMonth; day++) {
            const dayCell = this.createDayCell(year, month, day);
            this.grid.appendChild(dayCell);
        }
    }

    createDayCell(year, month, day) {
        const cell = document.createElement('div');
        cell.className = 'calendar-day';

        const date = new Date(year, month, day);
        const today = new Date();

        // Check if today
        if (
            date.getDate() === today.getDate() &&
            date.getMonth() === today.getMonth() &&
            date.getFullYear() === today.getFullYear()
        ) {
            cell.classList.add('today');
        }

        // Day number
        const dayNumber = document.createElement('div');
        dayNumber.className = 'calendar-day-number';
        dayNumber.textContent = day;
        cell.appendChild(dayNumber);

        // Check for events and tasks on this day
        // Use local date string comparison YYYY-MM-DD
        const m = String(month + 1).padStart(2, '0');
        const d = String(day).padStart(2, '0');
        const dateStr = `${year}-${m}-${d}`;

        const dayEvents = state.events.filter(e => {
            const eDate = new Date(e.date); // This parses local ISO string as local date
            const em = String(eDate.getMonth() + 1).padStart(2, '0');
            const ed = String(eDate.getDate()).padStart(2, '0');
            const eDateStr = `${eDate.getFullYear()}-${em}-${ed}`;
            return eDateStr === dateStr;
        });

        const dayTasks = state.tasks.filter(t => {
            if (!t.dueDate) return false;
            const tDate = new Date(t.dueDate);
            const tm = String(tDate.getMonth() + 1).padStart(2, '0');
            const td = String(tDate.getDate()).padStart(2, '0');
            const tDateStr = `${tDate.getFullYear()}-${tm}-${td}`;
            return tDateStr === dateStr;
        });

        // Add indicators
        if (dayEvents.length > 0 || dayTasks.length > 0) {
            const indicators = document.createElement('div');
            indicators.className = 'calendar-events';

            if (dayEvents.length > 0) {
                const eventDot = document.createElement('div');
                eventDot.className = 'event-indicator';
                eventDot.title = `${dayEvents.length} event(s)`;
                indicators.appendChild(eventDot);
            }

            if (dayTasks.length > 0) {
                const taskDot = document.createElement('div');
                taskDot.className = 'task-indicator';
                taskDot.title = `${dayTasks.length} task(s)`;
                indicators.appendChild(taskDot);
            }

            cell.appendChild(indicators);
        }

        return cell;
    }
}

// ============================================
// Task Manager
// ============================================
class TaskManager {
    constructor() {
        this.list = document.getElementById('tasksList');
        this.addBtn = document.getElementById('addTaskBtn');
        this.modal = document.getElementById('taskModal');
        this.saveBtn = document.getElementById('saveTaskBtn');
        this.filterBtns = document.querySelectorAll('.filter-btn');
        this.deleteAllBtn = document.getElementById('deleteAllCompletedBtn');

        this.currentEditId = null;
        this.init();
    }

    init() {
        this.addBtn.addEventListener('click', () => this.openModal());
        this.saveBtn.addEventListener('click', () => this.saveTask());
        this.deleteAllBtn.addEventListener('click', () => this.deleteAllCompleted());

        this.filterBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.filterBtns.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                state.filter = e.target.dataset.filter;
                this.render();
            });
        });

        this.render();
    }

    openModal(task = null) {
        this.currentEditId = task?.id || null;
        document.getElementById('taskTitle').value = task?.title || '';
        document.getElementById('taskDueDate').value = task?.dueDate || '';
        document.getElementById('taskDescription').value = task?.description || '';
        this.modal.classList.add('active');
    }

    saveTask() {
        const title = document.getElementById('taskTitle').value.trim();
        const dueDate = document.getElementById('taskDueDate').value;
        const description = document.getElementById('taskDescription').value.trim();

        if (!title) {
            alert('Please enter a task title');
            return;
        }

        if (this.currentEditId) {
            const task = state.tasks.find(t => t.id === this.currentEditId);
            task.title = title;
            task.dueDate = dueDate;
            task.description = description;
        } else {
            const newTask = {
                id: Date.now().toString(),
                title,
                dueDate,
                description,
                completed: false,
                fromCalendar: false,
                createdAt: new Date().toISOString(),
            };
            state.tasks.push(newTask);
        }

        saveToStorage();
        this.render();
        calendar.render(); // Update calendar indicators
        this.modal.classList.remove('active');
    }

    toggleTask(id) {
        const task = state.tasks.find(t => t.id === id);
        if (task) {
            task.completed = !task.completed;
            saveToStorage();
            this.render();
        }
    }

    deleteTask(id) {
        const task = state.tasks.find(t => t.id === id);
        if (!task) return;

        let message = 'Delete this task?';
        if (task.fromCalendar) {
            message = 'This will remove the task from this app, but it will remain on your Google Calendar source.\n\nIt will be added to your local "Ignored List" so it doesn\'t reappear on the next sync.\n\nContinue?';
        }

        if (confirm(message)) {
            // If it's a calendar event, add to ignored list
            if (task.fromCalendar) {
                // Extract original event ID if possible (assuming task id is task-eventID)
                const eventId = task.id.replace('task-', '');
                if (!state.ignoredEvents) state.ignoredEvents = [];
                state.ignoredEvents.push(eventId);

                // Also remove the event from state.events to clean up calendar view
                state.events = state.events.filter(e => e.id !== eventId);
            }

            state.tasks = state.tasks.filter(t => t.id !== id);
            saveToStorage();
            this.render();
            calendar.render();
        }
    }

    deleteAllCompleted() {
        if (confirm('Are you sure you want to permanently delete ALL completed tasks?')) {
            state.tasks = state.tasks.filter(t => !t.completed);

            // Auto-save triggers sync
            saveToStorage();
            this.render();
            calendar.render();
        }
    }

    render() {
        let filteredTasks = state.tasks;
        const now = new Date();

        // Apply filter
        if (state.filter === 'active') {
            filteredTasks = state.tasks.filter(t => !t.completed);
        } else if (state.filter === 'completed') {
            filteredTasks = state.tasks.filter(t => t.completed);
        } else if (state.filter === 'auto') {
            filteredTasks = state.tasks.filter(t => t.fromCalendar);
        } else if (state.filter === 'overdue') {
            filteredTasks = state.tasks.filter(t => {
                if (t.completed || !t.dueDate) return false;
                const dueDate = new Date(t.dueDate);
                return dueDate < now;
            });
        } else if (state.filter === 'upcoming') {
            filteredTasks = state.tasks.filter(t => {
                if (t.completed || !t.dueDate) return false;
                const dueDate = new Date(t.dueDate);
                return dueDate >= now;
            });
        }

        // Show/Hide Delete All Button
        if (state.filter === 'completed' && filteredTasks.length > 0) {
            this.deleteAllBtn.style.display = 'block';
        } else {
            this.deleteAllBtn.style.display = 'none';
        }

        // Sort: active first, then by due date
        filteredTasks.sort((a, b) => {
            if (a.completed !== b.completed) return a.completed ? 1 : -1;
            if (a.dueDate && b.dueDate) return new Date(a.dueDate) - new Date(b.dueDate);
            if (a.dueDate) return -1;
            if (b.dueDate) return 1;
            return 0;
        });

        if (filteredTasks.length === 0) {
            const emptyMessages = {
                'overdue': '🎉 No overdue tasks! Great job!',
                'upcoming': 'Nothing due soon! Time to relax? 🏖️',
                'completed': 'No completed tasks yet. Get to work! 💪',
                'all': 'No tasks yet. Add one or import a calendar!',
                'default': 'No tasks found'
            };

            const msg = emptyMessages[state.filter] || emptyMessages['default'];

            this.list.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">${state.filter === 'overdue' ? '😎' : '📝'}</div>
          <p>${msg}</p>
        </div>
      `;
            return;
        }

        this.list.innerHTML = filteredTasks.map(task => this.createTaskHTML(task)).join('');

        // Add event listeners
        this.list.querySelectorAll('.task-checkbox').forEach(cb => {
            cb.addEventListener('change', (e) => this.toggleTask(e.target.dataset.id));
        });

        this.list.querySelectorAll('.delete-task-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.deleteTask(e.target.dataset.id));
        });
    }

    createTaskHTML(task) {
        const dueDate = task.dueDate ? new Date(task.dueDate) : null;
        const now = new Date();
        const isUrgent = dueDate && (dueDate - now) < 86400000 * 3; // 3 days

        let dueDateHTML = '';
        if (dueDate) {
            const formatted = this.formatDueDate(dueDate, task.isAllDay);
            dueDateHTML = `<span class="task-due ${isUrgent ? 'urgent' : ''}">📅 ${formatted}</span>`;
        }

        let badgeHTML = '';
        if (task.fromCalendar) {
            badgeHTML = '<span class="task-badge">📚 From Calendar</span>';
        }

        return `
      <div class="task-item ${task.completed ? 'completed' : ''}">
        <input 
          type="checkbox" 
          class="task-checkbox" 
          ${task.completed ? 'checked' : ''}
          data-id="${task.id}"
        />
        <div class="task-content">
          <h3>${this.escapeHtml(task.title)}</h3>
          ${task.description ? `<p>${this.escapeHtml(task.description)}</p>` : ''}
          <div class="task-meta">
            ${dueDateHTML}
            ${badgeHTML}
          </div>
        </div>
        <div class="task-actions">
          <button class="btn btn-icon delete-task-btn" data-id="${task.id}">🗑️</button>
        </div>
      </div>
    `;
    }

    formatDueDate(date, isAllDay = false) {
        const now = new Date();
        const diffTime = date - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (isAllDay) {
            if (diffDays < 0) return `Overdue (${date.toLocaleDateString()})`;
            if (diffDays === 0) return `Today`;
            if (diffDays === 1) return `Tomorrow`;
            if (diffDays < 7) return `${diffDays} days (${date.toLocaleDateString()})`;
            return date.toLocaleDateString();
        }

        if (diffDays < 0) return `Overdue (${date.toLocaleDateString()})`;
        if (diffDays === 0) return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        if (diffDays === 1) return `Tomorrow at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        if (diffDays < 7) return `${diffDays} days (${date.toLocaleDateString()})`;
        return date.toLocaleString();
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// ============================================
// Import Manager - ICS Parsing & Sync
// ============================================
class ImportManager {
    constructor() {
        this.modal = document.getElementById('importModal');
        this.importBtn = document.getElementById('importBtn');
        this.googleBtn = document.getElementById('importGoogleBtn');
        this.urlBtn = document.getElementById('importUrlBtn');
        this.fileBtn = document.getElementById('importFileBtn');

        this.googleInput = document.getElementById('googleIcalUrl');
        this.urlInput = document.getElementById('icalUrl');
        this.fileInput = document.getElementById('icsFile');

        // Keywords for detecting assessments
        this.assessmentKeywords = [
            'assignment', 'exam', 'test', 'quiz', 'project', 'due',
            'homework', 'assessment', 'submission', 'midterm', 'final',
            'essay', 'paper', 'presentation', 'report'
        ];

        this.init();
    }

    init() {
        this.importBtn.addEventListener('click', () => this.modal.classList.add('active'));
        this.googleBtn.addEventListener('click', () => this.importFromUrl(this.googleInput.value, 'Google Calendar'));
        this.urlBtn.addEventListener('click', () => this.importFromUrl(this.urlInput.value, 'iCal Feed'));
        this.fileBtn.addEventListener('click', () => this.importFromFile());
    }

    async importFromUrl(url, sourceName) {
        if (!url.trim()) {
            alert('Please enter a URL');
            return;
        }

        const tryFetch = async (proxyUrl) => {
            const response = await fetch(proxyUrl);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.text();
        };

        try {
            let icsData;
            try {
                // Primary Proxy: allorigins
                console.log('Trying primary proxy...');
                icsData = await tryFetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`);
            } catch (e) {
                console.warn('Primary proxy failed, trying fallback...');
                // Fallback Proxy: corn-proxy (demo) or just try direct if CORS allows (rare)
                // Using a different service or strategy would be better, but for client-side only app options are limited.
                // Let's try corsproxy.io
                icsData = await tryFetch(`https://corsproxy.io/?${encodeURIComponent(url)}`);
            }

            this.parseAndImport(icsData, { url, name: sourceName, type: 'url' });
            alert('✅ Calendar imported successfully!\n\nCheck the calendar and tasks views.');
            this.modal.classList.remove('active');
        } catch (error) {
            console.error('Import error:', error);
            alert(`❌ Failed to import calendar.\n\n${error.message}\n\nTip: Try downloading the .ics file and uploading it instead.`);
        }
    }

    importFromFile() {
        const file = this.fileInput.files[0];
        if (!file) {
            alert('Please select a file');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const icsData = e.target.result;
                this.parseAndImport(icsData, { name: file.name, type: 'file' });
                alert('✅ Calendar imported successfully!');
                this.modal.classList.remove('active');
            } catch (error) {
                console.error('Parse error:', error);
                alert(`❌ Failed to parse calendar file:\\n${error.message}`);
            }
        };
        reader.readAsText(file);
    }

    parseAndImport(icsData, source) {
        console.log('📅 Input data length:', icsData.length);
        console.log('📅 First 100 chars:', icsData.substring(0, 100));

        try {
            const jcalData = ICAL.parse(icsData);

            // Validate JCal structure
            if (!Array.isArray(jcalData) || jcalData.length === 0 || jcalData[0] !== 'vcalendar') {
                console.error('Invalid JCal data:', jcalData);
                throw new Error('Parsed data is not a valid iCalendar (vcalendar) object.');
            }

            const comp = new ICAL.Component(jcalData);
            const vevents = comp.getAllSubcomponents('vevent');

            console.log(`Found ${vevents.length} events`);

            let importedEvents = 0;
            let createdTasks = 0;

            vevents.forEach(vevent => {
                const event = new ICAL.Event(vevent);
                const title = event.summary;
                const startDate = event.startDate;
                const description = event.description || '';

                // OPTIMIZATION: Skip events before 2026
                // User requested to only accept datas from 2026 onwards
                const eventDate = startDate.toJSDate();
                if (eventDate < new Date('2026-01-01')) {
                    return; // Skip this event
                }

                // CHECK IGNORED EVENTS: Skip if user deleted it
                if (state.ignoredEvents && state.ignoredEvents.includes(event.uid)) {
                    // console.log(`Skipping ignored event: ${title}`);
                    return;
                }

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

                // Add to calendar events
                const eventData = {
                    id: event.uid || `event-${Date.now()}-${Math.random()}`,
                    title,
                    date: dateStr,
                    description,
                    source: source.name,
                };

                // Check if event already exists (by id)
                const existingIndex = state.events.findIndex(e => e.id === eventData.id);
                if (existingIndex >= 0) {
                    state.events[existingIndex] = eventData; // Update
                } else {
                    state.events.push(eventData);
                }
                importedEvents++;

                // Check if it's an assessment and create task
                if (this.isAssessment(title, description)) {
                    const taskData = {
                        id: `task-${eventData.id}`,
                        title: `📚 ${title}`,
                        dueDate: dateStr,
                        description: `Auto-imported from ${source.name}\n\n${description}`,
                        completed: false,
                        fromCalendar: true,
                        isAllDay: startDate.isDate,
                        createdAt: new Date().toISOString(),
                    };

                    // Check if task already exists
                    const existingTaskIndex = state.tasks.findIndex(t => t.id === taskData.id);
                    if (existingTaskIndex >= 0) {
                        state.tasks[existingTaskIndex] = taskData; // Update
                    } else {
                        state.tasks.push(taskData);
                        createdTasks++;
                    }
                }
            });

            // Save source for future syncs
            if (source.url) {
                const existingSource = state.sources.find(s => s.url === source.url);
                if (!existingSource) {
                    state.sources.push({
                        id: Date.now().toString(),
                        name: source.name,
                        url: source.url,
                        lastSync: new Date().toISOString(),
                    });
                } else {
                    existingSource.lastSync = new Date().toISOString();
                }
            }

            saveToStorage();
            calendar.render();
            taskManager.render();
            sourcesManager.render();

            console.log(`✅ Import complete: ${importedEvents} events, ${createdTasks} new tasks created`);

        } catch (error) {
            console.error('Parse Error Details:', error);
            throw new Error(`Parser failed: ${error.message}. Check console for raw data.`);
        }
    }

    isAssessment(title, description) {
        const text = (title + ' ' + description).toLowerCase();
        return this.assessmentKeywords.some(keyword => text.includes(keyword));
    }
}

// ============================================
// Sources Manager - Track Synced Calendars
// ============================================
class SourcesManager {
    constructor() {
        this.panel = document.getElementById('sourcesPanel');
        this.list = document.getElementById('sourcesList');
        this.toggleBtn = document.getElementById('toggleSources');

        this.init();
    }

    init() {
        this.toggleBtn.addEventListener('click', () => {
            this.panel.classList.toggle('collapsed');
            this.toggleBtn.textContent = this.panel.classList.contains('collapsed') ? '▼' : '▲';
        });

        this.render();
    }

    render() {
        if (state.sources.length === 0) {
            this.list.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: var(--spacing-md);">No calendar sources yet</p>';
            return;
        }

        this.list.innerHTML = state.sources.map(source => `
      <div class="source-item">
        <div class="source-info">
          <div class="source-name">${this.escapeHtml(source.name)}</div>
          <div class="source-url">${this.escapeHtml(source.url || 'File upload')}</div>
          <div class="source-url">Last synced: ${new Date(source.lastSync).toLocaleString()}</div>
        </div>
        <div class="source-actions">
          <button class="btn btn-icon sync-source-btn" data-id="${source.id}" title="Re-sync">🔄</button>
          <button class="btn btn-icon delete-source-btn" data-id="${source.id}" title="Remove">🗑️</button>
        </div>
      </div>
    `).join('');

        // Add event listeners
        this.list.querySelectorAll('.sync-source-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.syncSource(e.target.dataset.id));
        });

        this.list.querySelectorAll('.delete-source-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.deleteSource(e.target.dataset.id));
        });
    }

    async syncSource(id) {
        const source = state.sources.find(s => s.id === id);
        if (!source || !source.url) return;

        try {
            const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(source.url)}`;
            const response = await fetch(proxyUrl);
            if (!response.ok) throw new Error('Failed to fetch');

            const icsData = await response.text();
            importManager.parseAndImport(icsData, source);

            alert('✅ Calendar synced successfully!');
        } catch (error) {
            console.error('Sync error:', error);
            alert(`❌ Failed to sync:\\n${error.message}`);
        }
    }

    deleteSource(id) {
        if (confirm('Remove this calendar source?')) {
            state.sources = state.sources.filter(s => s.id !== id);
            saveToStorage();
            this.render();
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// ============================================
// Sync Manager - Auto-refresh all sources
// ============================================
class SyncManager {
    constructor() {
        this.syncBtn = document.getElementById('syncBtn');
        this.init();
    }

    init() {
        this.syncBtn.addEventListener('click', () => this.syncAll());
    }

    async syncAll() {
        if (state.sources.length === 0) {
            alert('No calendar sources to sync. Import a calendar first!');
            return;
        }

        this.syncBtn.disabled = true;
        this.syncBtn.innerHTML = '<span class="sync-icon">⏳</span> Syncing...';

        let successCount = 0;
        let errorCount = 0;

        for (const source of state.sources) {
            if (source.url) {
                try {
                    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(source.url)}`;
                    const response = await fetch(proxyUrl);
                    if (!response.ok) throw new Error('Failed to fetch');

                    const icsData = await response.text();
                    importManager.parseAndImport(icsData, source);
                    successCount++;
                } catch (error) {
                    console.error(`Sync error for ${source.name}:`, error);
                    errorCount++;
                }
            }
        }

        this.syncBtn.disabled = false;
        this.syncBtn.innerHTML = '<span class="sync-icon">🔄</span> Sync';

        alert(`Sync complete!\\n✅ ${successCount} succeeded\\n❌ ${errorCount} failed`);
    }
}

// ============================================
// Modal Management
// ============================================
function setupModals() {
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.modal-overlay').forEach(modal => {
                modal.classList.remove('active');
            });
        });
    });

    // Close on overlay click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.classList.remove('active');
            }
        });
    });
}

// ============================================
// Firebase Manager - Real-time Database
// ============================================
import { DATA_REF, onSnapshot, setDoc } from './firebase.js';

class FirebaseManager {
    constructor() {
        this.statusMsg = document.getElementById('cloudStatus');
        this.unsubscribe = null;
        this.isLocalChange = false; // Flag to prevent loops

        this.init();
    }

    init() {
        console.log('🔥 Initializing Firebase Real-time Sync...');
        this.updateStatus('Connecting...', 'pending');

        // Listen for Real-time Updates
        this.unsubscribe = onSnapshot(DATA_REF, (doc) => {
            if (this.isLocalChange) {
                this.isLocalChange = false;
                return;
            }

            if (doc.exists()) {
                const data = doc.data();
                console.log('🔥 Received update from Firebase');

                // Update Local State
                state.events = data.events || [];
                state.tasks = data.tasks || [];
                state.sources = data.sources || [];
                state.ignoredEvents = data.ignoredEvents || [];

                // DATA CLEANUP: Remove old data (< 2026) to reduce lag
                this.cleanupOldData();

                // Do NOT call saveToStorage here (loop risk), just save silently
                localStorage.setItem('calendarEvents', JSON.stringify(state.events));
                localStorage.setItem('tasks', JSON.stringify(state.tasks));
                localStorage.setItem('calendarSources', JSON.stringify(state.sources));
                localStorage.setItem('ignoredEvents', JSON.stringify(state.ignoredEvents || []));

                // Re-render UI
                calendar.render();
                taskManager.render();
                sourcesManager.render();

                this.updateStatus('Synced (Real-time)', 'success');
            } else {
                console.log('🔥 No data in Firebase yet. Creating initial...');
                this.save(); // Create document if missing
            }
        }, (error) => {
            console.error('Firebase Error:', error);
            this.updateStatus('Error: ' + error.message, 'error');
        });
    }

    cleanupOldData() {
        const cutoff = new Date('2026-01-01');
        const initialEventCount = state.events.length;
        const initialTaskCount = state.tasks.length;

        state.events = state.events.filter(e => new Date(e.date) >= cutoff);
        state.tasks = state.tasks.filter(t => {
            if (!t.dueDate) return true; // Keep tasks without due date
            return new Date(t.dueDate) >= cutoff;
        });

        if (state.events.length < initialEventCount || state.tasks.length < initialTaskCount) {
            console.log(`🧹 Cleaned up old data: Removed ${initialEventCount - state.events.length} events and ${initialTaskCount - state.tasks.length} tasks.`);
            // We configured strict one-way sync from DB in listener, but if we clean locally, 
            // ideally we should update DB cleanly. 
            // However, to avoid instant write-loop, we'll let the user's next action sync it,
            // OR trigger a save explicitly if we found garbage.
            this.save();
        }
    }

    // Save to Firebase (triggered by local changes)
    async save() {
        this.isLocalChange = true;
        this.updateStatus('Saving...', 'pending');

        try {
            const payload = {
                events: state.events,
                tasks: state.tasks,
                sources: state.sources,
                ignoredEvents: state.ignoredEvents,
                lastUpdated: new Date().toISOString()
            };

            await setDoc(DATA_REF, payload, { merge: true });
            this.updateStatus('Saved to DB', 'success');
        } catch (error) {
            console.error('Save failed:', error);
            this.updateStatus('Save Failed', 'error');
            this.isLocalChange = false;
        }
    }

    updateStatus(msg, type) {
        if (!this.statusMsg) return;
        this.statusMsg.textContent = `Status: ${msg}`;
        if (type === 'success') this.statusMsg.style.color = 'var(--accent-success)';
        else if (type === 'error') this.statusMsg.style.color = 'var(--accent-danger)';
        else this.statusMsg.style.color = 'var(--text-muted)';
    }
}

// ============================================
// Help Manager
// ============================================
class HelpManager {
    constructor() {
        this.modal = document.getElementById('helpModal');
        this.btn = document.getElementById('helpBtn');

        this.init();
    }

    init() {
        this.btn.addEventListener('click', () => this.open());

        // Backup & Restore
        const backupBtn = document.getElementById('backupBtn');
        const restoreBtn = document.getElementById('restoreBtn');
        const restoreFile = document.getElementById('restoreFile');

        if (backupBtn) backupBtn.addEventListener('click', () => this.backupData());
        if (restoreBtn) restoreBtn.addEventListener('click', () => restoreFile.click());
        if (restoreFile) restoreFile.addEventListener('change', (e) => this.restoreData(e));

        // Show on first visit
        if (!localStorage.getItem('hasSeenOnboarding')) {
            // Small delay for better UX
            setTimeout(() => this.open(), 1000);
            localStorage.setItem('hasSeenOnboarding', 'true');
        }
    }

    backupData() {
        const data = {
            events: state.events,
            tasks: state.tasks,
            sources: state.sources,
            ignoredEvents: state.ignoredEvents,
            version: 1.0,
            exportedAt: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `calendar-backup-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    restoreData(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);

                if (confirm(`Restore data from ${new Date(data.exportedAt).toLocaleString()}?\n\nThis will overwrite your CURRENT data and refresh the page.`)) {
                    state.events = data.events || [];
                    state.tasks = data.tasks || [];
                    state.sources = data.sources || [];
                    state.ignoredEvents = data.ignoredEvents || [];

                    saveToStorage();
                    location.reload(); // Reload to ensure clean state
                }
            } catch (err) {
                console.error('Restore error:', err);
                alert('❌ Failed to restore data. Invalid JSON file.');
            }
        };
        reader.readAsText(file);
        e.target.value = ''; // Reset input
    }

    open() {
        this.modal.classList.add('active');
    }
}

// ============================================
// Initialize App
// ============================================
loadFromStorage();

const calendar = new CalendarManager();
const taskManager = new TaskManager();
const importManager = new ImportManager();
const sourcesManager = new SourcesManager();
const syncManager = new SyncManager();
const helpManager = new HelpManager();
cloudManager = new FirebaseManager();

setupModals();

console.log('📅 Calendar Task Manager loaded!');
console.log('💡 Tip: Import your Google Calendar using the secret iCal URL for automatic updates');
