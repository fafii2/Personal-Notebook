// AI Assistant Module - Google Gemini API Integration
export class AIAssistant {
    constructor(tasksManager) {
        this.tasksManager = tasksManager;
        this.apiKey = this.loadApiKey();
        this.conversationHistory = [];

        this.aiPanel = document.getElementById('aiPanel');
        this.aiToggleBtn = document.getElementById('aiToggleBtn');
        this.aiCloseBtn = document.getElementById('aiCloseBtn');
        this.aiInput = document.getElementById('aiInput');
        this.aiSendBtn = document.getElementById('aiSendBtn');
        this.aiMessages = document.getElementById('aiMessages');
        this.apiKeyModal = document.getElementById('apiKeyModal');
        this.saveApiKeyBtn = document.getElementById('saveApiKeyBtn');
        this.apiKeyInput = document.getElementById('apiKeyInput');

        this.init();
    }

    init() {
        this.aiToggleBtn.addEventListener('click', () => this.togglePanel());
        this.aiCloseBtn.addEventListener('click', () => this.closePanel());
        this.aiSendBtn.addEventListener('click', () => this.sendMessage());
        this.aiInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });
        this.saveApiKeyBtn.addEventListener('click', () => this.saveApiKey());

        if (!this.apiKey) {
            this.showApiKeySetup();
        } else {
            this.addSystemMessage('AI Assistant ready! Ask me to help manage your tasks.');
        }
    }

    togglePanel() {
        if (!this.apiKey) {
            this.showApiKeySetup();
            return;
        }
        this.aiPanel.classList.toggle('active');
    }

    closePanel() {
        this.aiPanel.classList.remove('active');
    }

    showApiKeySetup() {
        this.apiKeyModal.classList.add('active');
    }

    saveApiKey() {
        const key = this.apiKeyInput.value.trim();
        if (!key) {
            alert('Please enter an API key');
            return;
        }

        this.apiKey = key;
        localStorage.setItem('gemini-api-key', key);
        this.apiKeyModal.classList.remove('active');
        this.addSystemMessage('API key saved! AI Assistant is ready.');
        this.aiPanel.classList.add('active');
    }

    loadApiKey() {
        return localStorage.getItem('gemini-api-key');
    }

    async sendMessage() {
        const message = this.aiInput.value.trim();
        if (!message) return;

        this.aiInput.value = '';
        this.addUserMessage(message);
        this.showLoading();

        try {
            const response = await this.callGeminiAPI(message);
            this.hideLoading();
            this.addAssistantMessage(response);

            // Check if AI suggests creating a task
            this.processAIResponse(response, message);
        } catch (error) {
            this.hideLoading();
            this.addSystemMessage(`Error: ${error.message}`);
        }
    }

    async callGeminiAPI(userMessage) {
        const tasks = this.tasksManager.getAllTasks();
        const tasksSummary = tasks.map(t =>
            `- ${t.completed ? '✓' : '○'} ${t.title}${t.deadline ? ` (due: ${new Date(t.deadline).toLocaleDateString()})` : ''}`
        ).join('\n');

        const systemPrompt = `You are a helpful task management assistant. The user has the following tasks:\n${tasksSummary || 'No tasks yet.'}\n\nHelp the user manage their tasks, suggest prioritization, and create new tasks when needed. Keep responses concise and friendly.`;

        const requestBody = {
            contents: [{
                parts: [{
                    text: `${systemPrompt}\n\nUser: ${userMessage}`
                }]
            }]
        };

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${this.apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'API request failed');
        }

        const data = await response.json();
        return data.candidates[0].content.parts[0].text;
    }

    processAIResponse(response, userMessage) {
        // Simple natural language processing to detect task creation intent
        const lowerMessage = userMessage.toLowerCase();
        const taskTriggers = ['remind me', 'add task', 'create task', 'don\'t forget', 'remember to'];

        if (taskTriggers.some(trigger => lowerMessage.includes(trigger))) {
            // Extract task from message (simple implementation)
            const taskTitle = userMessage.replace(/remind me to|add task|create task|don't forget to|remember to/gi, '').trim();
            if (taskTitle) {
                this.addSystemMessage(`Creating task: "${taskTitle}"`);
                // Would call tasksManager.addTaskFromEvent() here
            }
        }
    }

    addUserMessage(text) {
        const messageEl = document.createElement('div');
        messageEl.className = 'ai-message user';
        messageEl.textContent = text;
        this.aiMessages.appendChild(messageEl);
        this.scrollToBottom();
    }

    addAssistantMessage(text) {
        const messageEl = document.createElement('div');
        messageEl.className = 'ai-message assistant';
        messageEl.textContent = text;
        this.aiMessages.appendChild(messageEl);
        this.scrollToBottom();
    }

    addSystemMessage(text) {
        const messageEl = document.createElement('div');
        messageEl.className = 'ai-message system';
        messageEl.textContent = text;
        this.aiMessages.appendChild(messageEl);
        this.scrollToBottom();
    }

    showLoading() {
        const loadingEl = document.createElement('div');
        loadingEl.className = 'ai-message assistant loading-message';
        loadingEl.innerHTML = `
      <div class="loading">
        <div class="loading-dot"></div>
        <div class="loading-dot"></div>
        <div class="loading-dot"></div>
      </div>
    `;
        this.aiMessages.appendChild(loadingEl);
        this.scrollToBottom();
    }

    hideLoading() {
        const loadingEl = this.aiMessages.querySelector('.loading-message');
        if (loadingEl) loadingEl.remove();
    }

    scrollToBottom() {
        this.aiMessages.scrollTop = this.aiMessages.scrollHeight;
    }
}
