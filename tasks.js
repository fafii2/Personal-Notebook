// Tasks Management Module
export class TasksManager {
    constructor() {
        this.tasks = this.loadTasks();
        this.tasksList = document.getElementById('tasksList');
        this.addTaskBtn = document.getElementById('addTaskBtn');
        this.taskModal = document.getElementById('taskModal');
        this.saveTaskBtn = document.getElementById('saveTaskBtn');
        this.currentEditId = null;

        this.init();
    }

    init() {
        this.addTaskBtn.addEventListener('click', () => this.openTaskModal());
        this.saveTaskBtn.addEventListener('click', () => this.saveTask());
        this.render();
    }

    openTaskModal(task = null) {
        this.currentEditId = task ? task.id : null;
        document.getElementById('taskTitleInput').value = task ? task.title : '';
        document.getElementById('taskDeadlineInput').value = task ? task.deadline : '';
        document.getElementById('taskDescInput').value = task ? task.description || '' : '';
        this.taskModal.classList.add('active');
    }

    saveTask() {
        const title = document.getElementById('taskTitleInput').value.trim();
        const deadline = document.getElementById('taskDeadlineInput').value;
        const description = document.getElementById('taskDescInput').value.trim();

        if (!title) {
            alert('Please enter a task title');
            return;
        }

        if (this.currentEditId) {
            const task = this.tasks.find(t => t.id === this.currentEditId);
            task.title = title;
            task.deadline = deadline;
            task.description = description;
        } else {
            const newTask = {
                id: Date.now().toString(),
                title,
                deadline,
                description,
                completed: false,
                createdAt: new Date().toISOString()
            };
            this.tasks.push(newTask);
        }

        this.saveTasks();
        this.render();
        window.closeTaskModal();
    }

    toggleTask(id) {
        const task = this.tasks.find(t => t.id === id);
        if (task) {
            task.completed = !task.completed;
            this.saveTasks();
            this.render();
        }
    }

    deleteTask(id) {
        if (confirm('Are you sure you want to delete this task?')) {
            this.tasks = this.tasks.filter(t => t.id !== id);
            this.saveTasks();
            this.render();
        }
    }

    addTaskFromEvent(eventData) {
        const newTask = {
            id: Date.now().toString() + Math.random(),
            title: eventData.title,
            deadline: eventData.date,
            description: `Auto-created from calendar event: ${eventData.title}`,
            completed: false,
            createdAt: new Date().toISOString(),
            fromCalendar: true
        };
        this.tasks.push(newTask);
        this.saveTasks();
        this.render();
    }

    render() {
        if (this.tasks.length === 0) {
            this.tasksList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📝</div>
          <p>No tasks yet. Click "Add Task" to create one!</p>
        </div>
      `;
            return;
        }

        const activeTasks = this.tasks.filter(t => !t.completed);
        const completedTasks = this.tasks.filter(t => t.completed);
        const allTasks = [...activeTasks, ...completedTasks];

        this.tasksList.innerHTML = allTasks.map(task => this.createTaskHTML(task)).join('');

        // Add event listeners
        this.tasksList.querySelectorAll('.task-checkbox').forEach(cb => {
            cb.addEventListener('change', (e) => {
                this.toggleTask(e.target.dataset.id);
            });
        });

        this.tasksList.querySelectorAll('.delete-task-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.deleteTask(e.target.dataset.id);
            });
        });
    }

    createTaskHTML(task) {
        const deadlineText = task.deadline ? this.formatDeadline(task.deadline) : '';
        const isSoon = task.deadline && this.isDeadlineSoon(task.deadline);

        return `
      <div class="task-item ${task.completed ? 'completed' : ''}">
        <input 
          type="checkbox" 
          class="checkbox task-checkbox" 
          ${task.completed ? 'checked' : ''}
          data-id="${task.id}"
        />
        <div class="task-content">
          <h3>${task.title}</h3>
          ${task.description ? `<p>${task.description}</p>` : ''}
          ${deadlineText ? `<div class="task-deadline ${isSoon ? 'soon' : ''}">
            <span>📅</span>
            <span>${deadlineText}</span>
          </div>` : ''}
        </div>
        <div class="task-actions">
          <button class="btn btn-icon delete-task-btn" data-id="${task.id}">
            🗑️
          </button>
        </div>
      </div>
    `;
    }

    formatDeadline(deadline) {
        const date = new Date(deadline);
        const now = new Date();
        const diffTime = date - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 0) return `Overdue (${date.toLocaleDateString()})`;
        if (diffDays === 0) return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        if (diffDays === 1) return `Tomorrow at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        return date.toLocaleString();
    }

    isDeadlineSoon(deadline) {
        const date = new Date(deadline);
        const now = new Date();
        const diffTime = date - now;
        const diffDays = diffTime / (1000 * 60 * 60 * 24);
        return diffDays >= 0 && diffDays <= 3;
    }

    loadTasks() {
        const stored = localStorage.getItem('tasks');
        return stored ? JSON.parse(stored) : [];
    }

    saveTasks() {
        localStorage.setItem('tasks', JSON.stringify(this.tasks));
    }

    getAllTasks() {
        return this.tasks;
    }
}
