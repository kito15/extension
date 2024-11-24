class LinkedInKeywordCounter {
    constructor() {
        this.relevantKeywords = [
            'JavaScript', 'React', 'TypeScript', 'CSS', 'HTML', 'Python', 'Django',
            'Node.js', 'Angular', 'Vue.js', 'SQL', 'AWS', 'Docker', 'Kubernetes',
            'CI/CD', 'REST API', 'GraphQL', 'Git', 'Agile', 'Scrum'
        ];
        this.keywordMatches = new Map(); // Store keyword matches
        this.init();
    }

    init() {
        this.setupMutationObserver();
        this.processCurrentPage();
    }

    setupMutationObserver() {
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'childList' && 
                    document.querySelector('#job-details')) {
                    this.processCurrentPage();
                    break;
                }
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    processCurrentPage() {
        const applyButton = this.findApplyButton();
        if (!applyButton) return;

        const jobDescription = this.getJobDescription();
        if (!jobDescription) return;

        const keywordCount = this.countKeywords(jobDescription);
        this.updateOrCreateIndicator(applyButton, keywordCount);
    }

    findApplyButton() {
        return document.querySelector(
            'button[data-control-name="jobdetails_topcard_inapply"],' +
            'button.jobs-apply-button'
        );
    }

    getJobDescription() {
        const descriptionElement = document.querySelector(
            '#job-details .jobs-description-content__text,' +
            '#job-details .mt4'
        );
        return descriptionElement ? descriptionElement.innerText : '';
    }

    countKeywords(text) {
        this.keywordMatches.clear();
        let count = 0;
        const processedText = text.toLowerCase();

        this.relevantKeywords.forEach(keyword => {
            const regex = new RegExp(`\\b${keyword.toLowerCase()}\\b`, 'g');
            const matches = processedText.match(regex);
            if (matches) {
                this.keywordMatches.set(keyword, matches.length);
                count += matches.length;
            }
        });

        return count;
    }

    createModal() {
        const modal = document.createElement('div');
        modal.className = 'keyword-modal';
        modal.innerHTML = `
            <div class="keyword-modal-header">
                <div class="keyword-modal-title">Matched Keywords</div>
                <div class="keyword-modal-close">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                    </svg>
                </div>
            </div>
            <div class="keyword-grid"></div>
        `;

        const overlay = document.createElement('div');
        overlay.className = 'keyword-overlay';

        document.body.appendChild(overlay);
        document.body.appendChild(modal);

        return { modal, overlay };
    }

    showKeywordModal() {
        let { modal, overlay } = document.querySelector('.keyword-modal') ? 
            { 
                modal: document.querySelector('.keyword-modal'),
                overlay: document.querySelector('.keyword-overlay')
            } : 
            this.createModal();

        const keywordGrid = modal.querySelector('.keyword-grid');
        keywordGrid.innerHTML = '';

        // Sort keywords by count (descending)
        const sortedKeywords = Array.from(this.keywordMatches.entries())
            .sort((a, b) => b[1] - a[1]);

        // Add only keywords that were found in the text
        sortedKeywords.forEach(([keyword, count]) => {
            if (count > 0) {
                const keywordItem = document.createElement('div');
                keywordItem.className = 'keyword-item';
                keywordItem.innerHTML = `
                    <span>${keyword}</span>
                    <span class="keyword-count">${count}</span>
                `;
                keywordGrid.appendChild(keywordItem);
            }
        });

        // Show modal and overlay
        modal.classList.add('active');
        overlay.classList.add('active');

        // Add event listeners for closing
        const closeModal = () => {
            modal.classList.remove('active');
            overlay.classList.remove('active');
        };

        modal.querySelector('.keyword-modal-close').onclick = closeModal;
        overlay.onclick = closeModal;
    }

    updateOrCreateIndicator(applyButton, keywordCount) {
        let wrapper = document.querySelector('.keyword-indicator-wrapper');
        
        if (!wrapper) {
            wrapper = document.createElement('div');
            wrapper.className = 'keyword-indicator-wrapper';
            
            const content = document.createElement('div');
            content.className = 'keyword-indicator-content';
            
            const left = document.createElement('div');
            left.className = 'keyword-indicator-left';
            
            const label = document.createElement('span');
            label.className = 'keyword-indicator-label';
            label.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 0a8 8 0 100 16A8 8 0 008 0zm1 11.5v1.5H7v-1.5H6V10h1V8.5H5V7h2V3h2v4h2v1.5H9V10h1v1.5H8z"/>
                </svg>
                Keywords Found
            `;
            
            const indicator = document.createElement('div');
            indicator.className = 'keyword-progress-indicator';
            
            const countSpan = document.createElement('span');
            indicator.appendChild(countSpan);
            
            const matches = document.createElement('span');
            matches.className = 'keyword-matches';
            matches.textContent = 'keyword matches';
            
            left.appendChild(label);
            left.appendChild(indicator);
            left.appendChild(matches);
            content.appendChild(left);
            wrapper.appendChild(content);
            
            // Find the parent container that holds both apply and save buttons
            const buttonsContainer = applyButton.closest('.mt4');
            if (buttonsContainer) {
                buttonsContainer.appendChild(wrapper);
            }
        }

        // Add click handler to the indicator
        const indicator = wrapper.querySelector('.keyword-progress-indicator');
        indicator.style.cursor = 'pointer';
        indicator.onclick = () => this.showKeywordModal();

        // Update counts
        const countSpan = wrapper.querySelector('.keyword-progress-indicator span');
        countSpan.textContent = keywordCount;
        
        const matchesText = wrapper.querySelector('.keyword-matches');
        matchesText.textContent = `${keywordCount} keyword ${keywordCount === 1 ? 'match' : 'matches'}`;
    }
}

// Initialize the counter
new LinkedInKeywordCounter();
