// Content script to extract page metadata
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getPageData') {
        try {
            const pageData = extractPageData();
            sendResponse(pageData);
        } catch (error) {
            console.error('Error extracting page data:', error);
            sendResponse({
                title: document.title || '',
                description: '',
                tags: []
            });
        }
    }
    return true; // Keep the message channel open for async responses
});

function extractPageData() {
    const data = {
        title: '',
        description: '',
        tags: []
    };

    // Extract title
    data.title = document.title || '';

    // Extract description from meta tags
    const descriptionMeta = document.querySelector('meta[name="description"]') || 
                           document.querySelector('meta[property="og:description"]');
    if (descriptionMeta) {
        data.description = descriptionMeta.getAttribute('content') || '';
    }

    // Extract tags/keywords
    const keywordsMeta = document.querySelector('meta[name="keywords"]');
    if (keywordsMeta) {
        const keywords = keywordsMeta.getAttribute('content');
        if (keywords) {
            data.tags = keywords.split(',').map(k => k.trim()).filter(k => k.length > 0);
        }
    }

    // Try to extract tags from article tags or categories
    if (data.tags.length === 0) {
        // Look for common tag/category selectors
        const tagSelectors = [
            '.tags a',
            '.tag',
            '.category',
            '.categories a',
            '[rel="tag"]',
            '.article-tags a',
            '.post-tags a'
        ];

        for (const selector of tagSelectors) {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
                data.tags = Array.from(elements).map(el => el.textContent.trim()).filter(tag => tag.length > 0);
                break;
            }
        }
    }

    // Try to extract description from article content if meta description is empty
    if (!data.description) {
        const articleSelectors = [
            'article p',
            '.post-content p',
            '.article-content p',
            '.entry-content p',
            'main p'
        ];

        for (const selector of articleSelectors) {
            const paragraphs = document.querySelectorAll(selector);
            if (paragraphs.length > 0) {
                // Get the first paragraph that's not too short
                for (const p of paragraphs) {
                    const text = p.textContent.trim();
                    if (text.length > 50 && text.length < 300) {
                        data.description = text;
                        break;
                    }
                }
                if (data.description) break;
            }
        }
    }

    // Estimate word count from visible text for reading-time display
    const bodyText = document.body ? document.body.innerText || '' : '';
    data.wordCount = bodyText.trim().split(/\s+/).filter(w => w.length > 0).length;

    return data;
} 