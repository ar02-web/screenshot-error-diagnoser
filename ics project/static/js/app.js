// Front-end application controller for Screenshot Error Diagnoser

document.addEventListener('DOMContentLoaded', () => {
    // State management
    const state = {
        currentTab: 'dashboard',
        selectedFile: null,
        activeModel: 'openai/gpt-4o',
        settings: {
            apiKey: '',
            model: 'openai/gpt-4o',
            apiUrl: 'https://openrouter.ai/api/v1'
        },
        history: [],
        kbEntries: []
    };

    // Cache DOM Elements
    const elements = {
        // Tab links and panes
        menuButtons: document.querySelectorAll('.menu-btn'),
        tabPanes: document.querySelectorAll('.tab-pane'),
        pageTitle: document.getElementById('page-title'),
        pageSubtitle: document.getElementById('page-subtitle'),
        activeModelName: document.getElementById('active-model-name'),

        // Dashboard/Upload
        dropzone: document.getElementById('dropzone'),
        fileInput: document.getElementById('file-input'),
        imagePreview: document.getElementById('image-preview'),
        previewContainer: document.querySelector('.preview-container'),
        dropzonePrompt: document.querySelector('.dropzone-prompt'),
        removeImgBtn: document.getElementById('remove-img-btn'),
        diagnoseBtn: document.getElementById('diagnose-btn'),
        scannerLine: document.getElementById('scanner-line'),
        demoCards: document.querySelectorAll('.demo-card'),

        // Results/Pipeline
        pipelineCard: document.getElementById('pipeline-card'),
        resultCard: document.getElementById('result-card'),
        idleCard: document.getElementById('idle-card'),
        extractedErrorText: document.getElementById('extracted-error-text'),
        solutionContainer: document.getElementById('solution-container'),
        ragBadge: document.getElementById('rag-badge'),
        copyBtn: document.getElementById('copy-btn'),
        downloadBtn: document.getElementById('download-btn'),

        // Pipeline Steps
        stepUpload: document.getElementById('step-upload'),
        stepOcr: document.getElementById('step-ocr'),
        stepRag: document.getElementById('step-rag'),
        stepLlm: document.getElementById('step-llm'),

        // KB Manager
        kbEntriesBody: document.getElementById('kb-entries-body'),
        kbSearch: document.getElementById('kb-search'),
        openAddKbBtn: document.getElementById('open-add-kb-btn'),
        kbModal: document.getElementById('kb-modal'),
        closeKbModal: document.getElementById('close-kb-modal'),
        cancelKbModal: document.getElementById('cancel-kb-modal'),
        saveKbEntry: document.getElementById('save-kb-entry'),
        modalErrorPattern: document.getElementById('modal-error-pattern'),
        modalErrorFix: document.getElementById('modal-error-fix'),

        // History
        historyContainer: document.getElementById('history-container'),
        clearHistoryBtn: document.getElementById('clear-history-btn'),

        // Settings
        settingsApiKey: document.getElementById('settings-api-key'),
        settingsModel: document.getElementById('settings-model'),
        settingsApiUrl: document.getElementById('settings-api-url'),
        toggleKeyVisibility: document.getElementById('toggle-key-visibility'),
        saveSettingsBtn: document.getElementById('save-settings-btn'),

        // Toast
        toast: document.getElementById('toast'),
    };

    // Helper: Toast Notifications
    function showToast(message, type = 'info') {
        const toast = elements.toast;
        toast.className = `toast show ${type}`;
        
        // Update icon based on type
        const iconName = type === 'success' ? 'check-circle-2' : type === 'danger' ? 'alert-triangle' : 'info';
        toast.querySelector('.toast-icon').setAttribute('data-lucide', iconName);
        toast.querySelector('.toast-message').innerText = message;
        
        lucide.createIcons();

        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    // Load Settings & History from LocalStorage
    function loadSavedConfig() {
        const savedSettings = localStorage.getItem('error_scanner_settings');
        if (savedSettings) {
            try {
                state.settings = JSON.parse(savedSettings);
                if (state.settings.model === 'anthropic/claude-3.5-sonnet') {
                    state.settings.model = 'openai/gpt-4o';
                }
                elements.settingsApiKey.value = state.settings.apiKey || '';
                elements.settingsModel.value = state.settings.model || 'openai/gpt-4o';
                elements.settingsApiUrl.value = state.settings.apiUrl || 'https://openrouter.ai/api/v1';
                state.activeModel = state.settings.model;
            } catch (e) {
                console.error("Error parsing saved settings", e);
            }
        }
        
        // Show model name in header pill
        const modelLabel = elements.settingsModel.options[elements.settingsModel.selectedIndex]?.text || state.activeModel;
        elements.activeModelName.innerText = modelLabel;

        const savedHistory = localStorage.getItem('error_scanner_history');
        if (savedHistory) {
            try {
                state.history = JSON.parse(savedHistory);
            } catch (e) {
                console.error("Error parsing history", e);
            }
        }
        renderHistory();
    }

    // Save Settings
    elements.saveSettingsBtn.addEventListener('click', () => {
        state.settings.apiKey = elements.settingsApiKey.value.trim();
        state.settings.model = elements.settingsModel.value;
        state.settings.apiUrl = elements.settingsApiUrl.value.trim();
        state.activeModel = state.settings.model;

        localStorage.setItem('error_scanner_settings', JSON.stringify(state.settings));
        
        const modelLabel = elements.settingsModel.options[elements.settingsModel.selectedIndex].text;
        elements.activeModelName.innerText = modelLabel;
        
        showToast('Configuration saved successfully!', 'success');
    });

    // Toggle API Key Visibility
    elements.toggleKeyVisibility.addEventListener('click', () => {
        const type = elements.settingsApiKey.type === 'password' ? 'text' : 'password';
        elements.settingsApiKey.type = type;
        const iconName = type === 'password' ? 'eye' : 'eye-off';
        elements.toggleKeyVisibility.querySelector('i').setAttribute('data-lucide', iconName);
        lucide.createIcons();
    });

    // Tab Navigation Switcher
    elements.menuButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            switchTab(tabId);
        });
    });

    function switchTab(tabId) {
        state.currentTab = tabId;
        
        // Update menu buttons active state
        elements.menuButtons.forEach(btn => {
            if (btn.getAttribute('data-tab') === tabId) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Update tab panes visibility
        elements.tabPanes.forEach(pane => {
            if (pane.id === `tab-${tabId}`) {
                pane.classList.add('active');
            } else {
                pane.classList.remove('active');
            }
        });

        // Update Header Titles
        const headerInfo = {
            'dashboard': { title: 'Diagnose Error', subtitle: 'Upload a screenshot of any terminal error, crash, or code exception to diagnose.' },
            'knowledge-base': { title: 'Knowledge Base Catalog', subtitle: 'Manage keyword patterns and matched steps used in custom RAG lookups.' },
            'history': { title: 'Diagnostic History', subtitle: 'Review and reload previous screenshot analysis and solutions.' },
            'settings': { title: 'Application Settings', subtitle: 'Configure OpenRouter API parameters, model parameters, and preferences.' }
        };

        if (headerInfo[tabId]) {
            elements.pageTitle.innerText = headerInfo[tabId].title;
            elements.pageSubtitle.innerText = headerInfo[tabId].subtitle;
        }

        // Fetch KB if moving to KB tab
        if (tabId === 'knowledge-base') {
            fetchKnowledgeBase();
        }
    }

    // Image Upload / Preview Management
    elements.dropzone.addEventListener('click', () => {
        if (!state.selectedFile) {
            elements.fileInput.click();
        }
    });

    elements.fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) handleFileSelect(file);
    });

    // Clipboard Paste Listener
    document.addEventListener('paste', (e) => {
        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
        for (const item of items) {
            if (item.type.indexOf('image') !== -1) {
                const blob = item.getAsFile();
                // Create a file object with correct name & type
                const file = new File([blob], `clipboard-${Date.now()}.png`, { type: blob.type });
                handleFileSelect(file);
                showToast('Image pasted from clipboard!', 'success');
                break;
            }
        }
    });

    // Drag & Drop Listeners
    elements.dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        elements.dropzone.classList.add('dragover');
    });

    elements.dropzone.addEventListener('dragleave', () => {
        elements.dropzone.classList.remove('dragover');
    });

    elements.dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        elements.dropzone.classList.remove('dragover');
        
        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].type.startsWith('image/')) {
            handleFileSelect(files[0]);
        } else {
            showToast('Please drop an image file.', 'danger');
        }
    });

    function handleFileSelect(file) {
        state.selectedFile = file;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            elements.imagePreview.src = e.target.result;
            elements.dropzonePrompt.style.display = 'none';
            elements.previewContainer.style.display = 'flex';
            elements.diagnoseBtn.removeAttribute('disabled');
        };
        reader.readAsDataURL(file);
    }

    elements.removeImgBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        clearInputImage();
    });

    function clearInputImage() {
        state.selectedFile = null;
        elements.fileInput.value = '';
        elements.imagePreview.src = '';
        elements.previewContainer.style.display = 'none';
        elements.dropzonePrompt.style.display = 'flex';
        elements.diagnoseBtn.setAttribute('disabled', 'true');
    }

    // Demo Presets Generator
    elements.demoCards.forEach(card => {
        card.addEventListener('click', () => {
            const errorType = card.getAttribute('data-error-type');
            generateDemoImage(errorType);
        });
    });

    function generateDemoImage(type) {
        const canvas = document.createElement('canvas');
        canvas.width = 600;
        canvas.height = 200;
        const ctx = canvas.getContext('2d');

        // Draw terminal background
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Header bar
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, 0, canvas.width, 30);
        ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(15, 15, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#f59e0b'; ctx.beginPath(); ctx.arc(30, 15, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#10b981'; ctx.beginPath(); ctx.arc(45, 15, 5, 0, Math.PI * 2); ctx.fill();

        // Terminal text styling
        ctx.font = '14px Consolas, "Fira Code", monospace';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText('$ npm run dev', 15, 55);

        if (type === 'econnrefused') {
            ctx.fillStyle = '#ef4444';
            ctx.fillText('Error: connect ECONNREFUSED 127.0.0.1:27017', 15, 85);
            ctx.fillStyle = '#64748b';
            ctx.fillText('    at TCPConnectWrap.afterConnect [as oncomplete] (node:net:1157:16)', 15, 110);
            ctx.fillText('    at TCPConnectWrap.callbackTrampoline (node:internal/async_hooks:130:17)', 15, 135);
        } else if (type === 'modulenotfound') {
            ctx.fillStyle = '#ef4444';
            ctx.fillText('ModuleNotFoundError: No module named \'requests\'', 15, 85);
            ctx.fillStyle = '#64748b';
            ctx.fillText('    File "src/app.py", line 6, in <module>', 15, 110);
            ctx.fillText('      import requests', 15, 135);
        } else if (type === 'cors') {
            ctx.fillStyle = '#ef4444';
            ctx.fillText('Access to fetch at \'http://api.local/data\' from origin \'http://localhost:3000\'', 15, 85);
            ctx.fillText('has been blocked by CORS policy: No \'Access-Control-Allow-Origin\' header is present', 15, 110);
            ctx.fillText('on the requested resource.', 15, 135);
        }

        canvas.toBlob((blob) => {
            const file = new File([blob], `demo-${type}.png`, { type: 'image/png' });
            handleFileSelect(file);
            showToast(`Loaded ${type.toUpperCase()} demo screenshot. Ready to Diagnose!`, 'info');
        });
    }

    // Diagnostic Pipeline & Run
    elements.diagnoseBtn.addEventListener('click', runDiagnostics);

    async function runDiagnostics() {
        if (!state.selectedFile) return;

        // Reset display
        elements.idleCard.style.display = 'none';
        elements.resultCard.style.display = 'none';
        elements.pipelineCard.style.display = 'block';
        elements.scannerLine.style.display = 'block';
        
        // Reset pipeline steps
        resetPipelineSteps();

        // Start step-by-step pipeline animation
        updateStep('upload', 'completed');
        updateStep('ocr', 'active');

        // Form data prep
        const formData = new FormData();
        formData.append('image', state.selectedFile);
        
        // Append client side settings if provided
        formData.append('api_key', state.settings.apiKey);
        formData.append('model', state.settings.model);
        formData.append('api_url', state.settings.apiUrl);

        try {
            // Simulated delay for UI step transitions (helps user follow the logic)
            const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
            
            const fetchPromise = fetch('/diagnose', {
                method: 'POST',
                body: formData
            });

            // OCR Extraction Stage
            await wait(1000);
            updateStep('ocr', 'completed');
            updateStep('rag', 'active');

            // RAG Search Stage
            await wait(1000);
            updateStep('rag', 'completed');
            updateStep('llm', 'active');

            // Wait for network response to complete
            const response = await fetchPromise;
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Server error occurred');
            }

            const data = await response.json();
            
            // Final step complete
            updateStep('llm', 'completed');
            await wait(500);

            // Display Results
            elements.scannerLine.style.display = 'none';
            elements.pipelineCard.style.display = 'none';
            elements.resultCard.style.display = 'flex';
            
            elements.extractedErrorText.innerText = data.error_text;
            elements.ragBadge.innerText = `RAG Matches: ${data.kb_matches || 0}`;
            
            // Format & render Markdown fix steps
            elements.solutionContainer.innerHTML = formatMarkdown(data.fix_steps);

            // Add to session history
            const historyItem = {
                id: Date.now(),
                error_text: data.error_text,
                fix_steps: data.fix_steps,
                kb_matches: data.kb_matches,
                time: new Date().toLocaleTimeString()
            };
            state.history.unshift(historyItem);
            localStorage.setItem('error_scanner_history', JSON.stringify(state.history));
            renderHistory();

            showToast('Diagnosis completed successfully!', 'success');

        } catch (error) {
            elements.scannerLine.style.display = 'none';
            elements.pipelineCard.style.display = 'none';
            elements.idleCard.style.display = 'flex';
            
            console.error("Diagnostic error:", error);
            showToast(`Error: ${error.message}`, 'danger');
        }
    }

    function resetPipelineSteps() {
        const steps = ['upload', 'ocr', 'rag', 'llm'];
        steps.forEach(s => {
            const el = document.getElementById(`step-${s}`);
            el.className = 'pipeline-step';
            el.querySelector('.step-bullet').innerHTML = s === 'upload' ? '<i data-lucide="check"></i>' : `<span>${getStepNumber(s)}</span>`;
        });
        lucide.createIcons();
    }

    function getStepNumber(step) {
        return step === 'ocr' ? '2' : step === 'rag' ? '3' : '4';
    }

    function updateStep(stepId, stateClass) {
        const stepEl = document.getElementById(`step-${stepId}`);
        stepEl.className = `pipeline-step ${stateClass}`;
        
        if (stateClass === 'completed') {
            stepEl.querySelector('.step-bullet').innerHTML = '<i data-lucide="check"></i>';
        } else if (stateClass === 'active') {
            // Keep number but styled differently by CSS
        }
        lucide.createIcons();
    }

    // Markdown Parser Helper (Simple)
    function formatMarkdown(text) {
        if (!text) return '';
        
        let html = text;
        
        // Escape HTML tags to prevent XSS except the ones we build
        html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

        // Block code: ```code```
        html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');

        // Inline code: `code`
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

        // Line breaks
        html = html.replace(/\n/g, '<br>');

        // Strong tags
        html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

        return html;
    }

    // Copy steps
    elements.copyBtn.addEventListener('click', () => {
        const steps = state.history[0]?.fix_steps || '';
        if (steps) {
            navigator.clipboard.writeText(steps).then(() => {
                showToast('Fix steps copied to clipboard!', 'success');
            }).catch(err => {
                showToast('Failed to copy to clipboard', 'danger');
            });
        }
    });

    // Download Markdown report
    elements.downloadBtn.addEventListener('click', () => {
        const item = state.history[0];
        if (!item) return;

        const report = `# Error Diagnosis Report\nGenerated on: ${new Date().toLocaleString()}\n\n## Extracted Error\n\`\`\`\n${item.error_text}\n\`\`\`\n\n## Solution\n${item.fix_steps}\n\n---\n*Created by ErrorScanner*`;
        const blob = new Blob([report], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `error-diagnosis-${Date.now()}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('Report downloaded successfully!', 'success');
    });

    // Render History
    function renderHistory() {
        const container = elements.historyContainer;
        if (state.history.length === 0) {
            container.innerHTML = `
                <div class="history-empty">
                    <i data-lucide="clock-alert"></i>
                    <p>No historical diagnoses in this session.</p>
                </div>`;
            lucide.createIcons();
            return;
        }

        container.innerHTML = '';
        state.history.forEach(item => {
            const div = document.createElement('div');
            div.className = 'history-item';
            div.innerHTML = `
                <div class="history-item-header">
                    <span class="history-item-error">${item.error_text.substring(0, 50)}${item.error_text.length > 50 ? '...' : ''}</span>
                    <span class="history-item-time">${item.time}</span>
                </div>
                <div class="history-item-body">${item.fix_steps.replace(/<[^>]*>/g, '').substring(0, 120)}...</div>
            `;
            
            // Reload historical result in dashboard
            div.addEventListener('click', () => {
                elements.extractedErrorText.innerText = item.error_text;
                elements.ragBadge.innerText = `RAG Matches: ${item.kb_matches || 0}`;
                elements.solutionContainer.innerHTML = formatMarkdown(item.fix_steps);
                
                elements.idleCard.style.display = 'none';
                elements.pipelineCard.style.display = 'none';
                elements.resultCard.style.display = 'flex';
                
                switchTab('dashboard');
                showToast('Loaded diagnosis from history', 'info');
            });
            container.appendChild(div);
        });
    }

    // Clear History
    elements.clearHistoryBtn.addEventListener('click', () => {
        state.history = [];
        localStorage.removeItem('error_scanner_history');
        renderHistory();
        showToast('Diagnostic history cleared', 'info');
    });

    // Knowledge Base APIs CRUD
    async function fetchKnowledgeBase() {
        try {
            const r = await fetch('/api/kb');
            state.kbEntries = await r.json();
            renderKnowledgeBase();
        } catch (e) {
            console.error("Error fetching knowledge base", e);
            showToast('Failed to fetch Knowledge Base entries.', 'danger');
        }
    }

    function renderKnowledgeBase() {
        const filter = elements.kbSearch.value.toLowerCase();
        const tbody = elements.kbEntriesBody;
        tbody.innerHTML = '';

        const filtered = state.kbEntries.filter(entry => 
            entry.error.toLowerCase().includes(filter) || 
            entry.fix.toLowerCase().includes(filter)
        );

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: var(--text-muted);">No matching entries found.</td></tr>`;
            return;
        }

        filtered.forEach((entry, idx) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong style="color: var(--danger); font-family: var(--font-mono);">${entry.error}</strong></td>
                <td><code style="white-space: pre-wrap;">${entry.fix}</code></td>
                <td class="text-right">
                    <div class="kb-action-btns">
                        <button class="btn btn-secondary btn-icon delete-kb-btn text-danger" data-index="${idx}" title="Delete entry">
                            <i data-lucide="trash"></i>
                        </button>
                    </div>
                </td>
            `;

            tr.querySelector('.delete-kb-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                deleteKbEntry(idx);
            });

            tbody.appendChild(tr);
        });

        lucide.createIcons();
    }

    elements.kbSearch.addEventListener('input', renderKnowledgeBase);

    // Modal Add KB Actions
    elements.openAddKbBtn.addEventListener('click', () => {
        elements.modalErrorPattern.value = '';
        elements.modalErrorFix.value = '';
        elements.kbModal.style.display = 'flex';
    });

    function closeKbModal() {
        elements.kbModal.style.display = 'none';
    }

    elements.closeKbModal.addEventListener('click', closeKbModal);
    elements.cancelKbModal.addEventListener('click', closeKbModal);

    elements.saveKbEntry.addEventListener('click', async () => {
        const error = elements.modalErrorPattern.value.trim();
        const fix = elements.modalErrorFix.value.trim();

        if (!error || !fix) {
            showToast('Please fill out both fields.', 'danger');
            return;
        }

        try {
            const r = await fetch('/api/kb', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error, fix })
            });

            if (r.ok) {
                showToast('Knowledge base entry added!', 'success');
                closeKbModal();
                fetchKnowledgeBase();
            } else {
                showToast('Failed to save entry', 'danger');
            }
        } catch (e) {
            console.error("Save KB error", e);
            showToast('Save KB error occurred.', 'danger');
        }
    });

    async function deleteKbEntry(index) {
        if (!confirm('Are you sure you want to delete this entry?')) return;
        
        try {
            const r = await fetch(`/api/kb/${index}`, {
                method: 'DELETE'
            });

            if (r.ok) {
                showToast('Entry deleted successfully.', 'success');
                fetchKnowledgeBase();
            } else {
                showToast('Failed to delete entry.', 'danger');
            }
        } catch (e) {
            console.error("Delete KB error", e);
            showToast('Delete KB error occurred.', 'danger');
        }
    }

    // Initialize config
    loadSavedConfig();
});
