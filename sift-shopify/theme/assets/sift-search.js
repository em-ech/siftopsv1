/**
 * Sift Search - Shopify Theme Integration
 *
 * This script handles search functionality via the Sift App Proxy.
 * The App Proxy must be configured in your Shopify app settings:
 * - Subpath prefix: apps
 * - Subpath: sift
 * - Proxy URL: https://your-sift-api.com/proxy
 */

(function () {
  'use strict';

  // Configuration
  const CONFIG = {
    proxyPath: '/apps/sift/search',
    debounceMs: 300,
    minQueryLength: 2,
  };

  // DOM Elements
  const elements = {
    form: document.getElementById('sift-search-form'),
    input: document.getElementById('sift-search-input'),
    loading: document.getElementById('sift-search-loading'),
    results: document.getElementById('sift-search-results'),
    noResults: document.getElementById('sift-search-no-results'),
    queryDisplay: document.getElementById('sift-search-query'),
  };

  // State
  let debounceTimer = null;
  let currentQuery = '';
  let sessionId = getSessionId();

  /**
   * Get or create a session ID for analytics
   */
  function getSessionId() {
    let id = sessionStorage.getItem('sift_session_id');
    if (!id) {
      id = 'sess_' + Math.random().toString(36).substring(2, 15);
      sessionStorage.setItem('sift_session_id', id);
    }
    return id;
  }

  /**
   * Format currency
   */
  function formatMoney(amount, currency = 'USD') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(parseFloat(amount));
  }

  /**
   * Show loading state
   */
  function showLoading() {
    elements.loading.style.display = 'flex';
    elements.results.innerHTML = '';
    elements.noResults.style.display = 'none';
  }

  /**
   * Hide loading state
   */
  function hideLoading() {
    elements.loading.style.display = 'none';
  }

  /**
   * Show no results message
   */
  function showNoResults(query) {
    elements.noResults.style.display = 'block';
    elements.queryDisplay.textContent = query;
  }

  /**
   * Render search results
   */
  function renderResults(data) {
    hideLoading();

    if (!data.results || data.results.length === 0) {
      showNoResults(data.query);
      return;
    }

    elements.noResults.style.display = 'none';

    const html = data.results
      .map((product) => {
        const productUrl = `/products/${product.handle}`;
        const imageUrl = product.imageUrl || '';
        const availability = product.available
          ? '<span class="sift-search__product-availability sift-search__product-availability--in-stock">In Stock</span>'
          : '<span class="sift-search__product-availability sift-search__product-availability--out-of-stock">Out of Stock</span>';

        const comparePrice = product.compareAtPrice
          ? `<span class="sift-search__product-compare-price">${formatMoney(product.compareAtPrice, product.currency)}</span>`
          : '';

        return `
          <div class="sift-search__product" data-variant-id="${product.variantId}">
            <a href="${productUrl}" class="sift-search__product-link">
              ${
                imageUrl
                  ? `<img src="${imageUrl}" alt="${product.title}" class="sift-search__product-image" loading="lazy" />`
                  : `<div class="sift-search__product-image"></div>`
              }
              <div class="sift-search__product-info">
                <h3 class="sift-search__product-title">${product.title}</h3>
                ${product.variantTitle ? `<p class="sift-search__product-variant">${product.variantTitle}</p>` : ''}
                <p class="sift-search__product-price">
                  ${formatMoney(product.price, product.currency)}
                  ${comparePrice}
                </p>
                ${availability}
              </div>
            </a>
          </div>
        `;
      })
      .join('');

    elements.results.innerHTML = html;

    // Add click tracking
    const productCards = elements.results.querySelectorAll('.sift-search__product');
    productCards.forEach((card) => {
      card.addEventListener('click', function () {
        const variantId = this.dataset.variantId;
        trackClick(variantId);
      });
    });
  }

  /**
   * Track click event (optional - if you want to send to your own analytics)
   */
  function trackClick(variantId) {
    // You can implement click tracking here
    // For example, send to your analytics endpoint
    console.log('Sift: Click tracked for variant', variantId);
  }

  /**
   * Perform search
   */
  async function performSearch(query) {
    if (query.length < CONFIG.minQueryLength) {
      elements.results.innerHTML = '';
      elements.noResults.style.display = 'none';
      return;
    }

    currentQuery = query;
    showLoading();

    try {
      const params = new URLSearchParams({
        q: query,
        session_id: sessionId,
      });

      const response = await fetch(`${CONFIG.proxyPath}?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }

      const data = await response.json();

      // Only render if query hasn't changed
      if (query === currentQuery) {
        renderResults(data);
      }
    } catch (error) {
      console.error('Sift search error:', error);
      hideLoading();

      // Show error message
      elements.results.innerHTML = `
        <div class="sift-search__error">
          <p>Sorry, search is temporarily unavailable.</p>
          <p>Please try again later.</p>
        </div>
      `;
    }
  }

  /**
   * Debounced search handler
   */
  function handleInput(event) {
    const query = event.target.value.trim();

    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(() => {
      performSearch(query);
    }, CONFIG.debounceMs);
  }

  /**
   * Form submit handler
   */
  function handleSubmit(event) {
    event.preventDefault();
    const query = elements.input.value.trim();
    if (query) {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      performSearch(query);
    }
  }

  /**
   * Initialize
   */
  function init() {
    if (!elements.form || !elements.input) {
      console.error('Sift: Required elements not found');
      return;
    }

    elements.input.addEventListener('input', handleInput);
    elements.form.addEventListener('submit', handleSubmit);

    // Focus input on load if desired
    // elements.input.focus();

    console.log('Sift search initialized');
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
