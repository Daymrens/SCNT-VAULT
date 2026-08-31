// Firebase services - loaded separately, optional
// These will be available if firebase-service.js loads successfully
let createOrder, saveContactMessage, subscribeNewsletter, trackPageView, trackProductView;

// Pagination variables
let currentPage = 1;
const itemsPerPage = 12; // Show 12 perfumes per page
let filteredPerfumes = [];
let currentSearchTerm = '';
let currentCategory = 'all';
let currentSort = 'name-az'; // Default sort: alphabetically A to Z
let cart = JSON.parse(localStorage.getItem('cart')) || [];
let currentPerfumeInModal = null;

// Load and display perfumes
function displayPerfumes(perfumes, page = 1) {const perfumeGrid = document.getElementById('perfumeGrid');
    
    if (!perfumeGrid) {return;
    }perfumeGrid.innerHTML = '';
    
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const perfumesToShow = perfumes.slice(startIndex, endIndex);perfumesToShow.forEach(perfume => {
        const card = document.createElement('div');
        card.className = 'perfume-card';
        card.setAttribute('data-name', perfume.Name);
        card.setAttribute('data-scent', `${perfume.Category} ${perfume.Brand}`);
        card.setAttribute('data-gender', perfume.Gender);
        
        // Use specific image if available, otherwise use default
        const imagePath = perfume.ImagePath || 'images/scnt_default.png';
        const imageHtml = `<div class="perfume-image lazy-load" data-src="${imagePath}" style="background-size: cover; background-position: center;"></div>`;
        
        card.innerHTML = `
            ${imageHtml}
            <div class="product-badges" id="badges-${perfume.Name.replace(/\s/g, '-')}"></div>
            <h3>${perfume.Name}</h3>
            <p class="brand">${perfume.Brand}</p>
            <p class="category">${perfume.Category}</p>
            <p class="gender">${perfume.Gender} • ${perfume.Size}</p>
            <p class="price">₱${perfume.SellingPrice}</p>
        `;
        
        // Add click event to open modal
        card.addEventListener('click', () => {
            openModal(perfume, imagePath);
        });
        
        perfumeGrid.appendChild(card);
        
        // Add badges after card is added to DOM
        addProductBadges(perfume);
        
        // Lazy load the image
        const imgEl = card.querySelector('.perfume-image.lazy-load');
        if (imgEl && window.imageObserver) {
            window.imageObserver.observe(imgEl);
        } else if (imgEl) {
            // Fallback: load immediately
            imgEl.style.backgroundImage = `url('${imagePath}')`;
            imgEl.classList.add('loaded');
        }
    });
    
    updatePagination(perfumes.length, page);
}

// Product Badges System
function addProductBadges(perfume) {
    const badgeContainer = document.getElementById(`badges-${perfume.Name.replace(/\s/g, '-')}`);
    if (!badgeContainer) return;
    
    const badges = [];
    
    // Bestseller badge (you can customize the logic)
    const bestsellers = ['Midnight Essence', 'Ocean Breeze', 'Rose Garden', 'Vanilla Dreams'];
    if (bestsellers.includes(perfume.Name)) {
        badges.push('<span class="product-badge bestseller">🔥 Bestseller</span>');
    }
    
    // New Arrival badge (perfumes added in last 30 days - you can add a date field)
    const newArrivals = ['Crystal Musk', 'Amber Nights', 'Citrus Burst'];
    if (newArrivals.includes(perfume.Name)) {
        badges.push('<span class="product-badge new-arrival">✨ New</span>');
    }
    
    // Limited Edition badge
    const limitedEdition = ['Golden Hour', 'Midnight Essence'];
    if (limitedEdition.includes(perfume.Name)) {
        badges.push('<span class="product-badge limited">💎 Limited</span>');
    }
    
    // Trending badge
    const trending = ['Ocean Breeze', 'Lavender Fields'];
    if (trending.includes(perfume.Name)) {
        badges.push('<span class="product-badge trending">📈 Trending</span>');
    }
    
    badgeContainer.innerHTML = badges.join('');
}

// Modal functions
function openModal(perfume, imagePath) {
    const modal = document.getElementById('perfumeModal');
    const modalImage = document.getElementById('modalImage');
    const modalName = document.getElementById('modalName');
    const modalBrand = document.getElementById('modalBrand');
    const modalCategory = document.getElementById('modalCategory');
    const modalGender = document.getElementById('modalGender');
    const modalSize = document.getElementById('modalSize');
    const modalPrice = document.getElementById('modalPrice');
    
    currentPerfumeInModal = { ...perfume, imagePath };
    
    modalImage.style.backgroundImage = `url('${imagePath}')`;
    modalName.textContent = perfume.Name;
    modalBrand.textContent = perfume.Brand;
    modalCategory.textContent = perfume.Category;
    modalGender.textContent = `Gender: ${perfume.Gender}`;
    modalSize.textContent = `Available Sizes: ${perfume.Size}`;
    modalPrice.textContent = `₱${perfume.SellingPrice}`;
    
    modal.style.display = 'block';
}

function closeModal() {
    const modal = document.getElementById('perfumeModal');
    modal.style.display = 'none';
}

function updatePagination(totalItems, currentPage) {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const pageInfo = document.getElementById('pageInfo');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    
    pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    
    prevBtn.disabled = currentPage === 1;
    nextBtn.disabled = currentPage === totalPages;
}

function applyFilters() {
    const perfumesData = window.perfumesData || [];
    filteredPerfumes = perfumesData.filter(perfume => {
        // Category filter
        const categoryMatch = currentCategory === 'all' || perfume.Gender === currentCategory;
        
        // Search filter
        let searchMatch = true;
        if (currentSearchTerm) {
            const name = perfume.Name.toLowerCase();
            const brand = perfume.Brand.toLowerCase();
            const category = perfume.Category.toLowerCase();
            const gender = perfume.Gender.toLowerCase();
            const term = currentSearchTerm.toLowerCase();
            
            searchMatch = name.includes(term) || brand.includes(term) || 
                         category.includes(term) || gender.includes(term);
        }
        
        return categoryMatch && searchMatch;
    });
    
    // Apply sorting
    applySorting();
    
    // Update results count
    updateResultsCount();
    
    currentPage = 1;
    displayPerfumes(filteredPerfumes, currentPage);
}

function applySorting() {
    switch(currentSort) {
        case 'price-low':
            filteredPerfumes.sort((a, b) => parseFloat(a.SellingPrice) - parseFloat(b.SellingPrice));
            break;
        case 'price-high':
            filteredPerfumes.sort((a, b) => parseFloat(b.SellingPrice) - parseFloat(a.SellingPrice));
            break;
        case 'name-az':
            filteredPerfumes.sort((a, b) => a.Name.localeCompare(b.Name));
            break;
        case 'name-za':
            filteredPerfumes.sort((a, b) => b.Name.localeCompare(a.Name));
            break;
    }
}

function updateResultsCount() {
    const resultsCount = document.getElementById('resultsCount');
    const clearBtn = document.getElementById('clearFilters');
    
    if (currentSearchTerm || currentCategory !== 'all' || currentSort !== 'name-az') {
        resultsCount.textContent = `Showing ${filteredPerfumes.length} perfume${filteredPerfumes.length !== 1 ? 's' : ''}`;
        clearBtn.style.display = 'inline-block';
    } else {
        resultsCount.textContent = 'Showing all perfumes (A-Z)';
        clearBtn.style.display = 'none';
    }
}

// Smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');
        
        // Skip if href is just "#" or empty
        if (!href || href === '#' || href.length <= 1) {
            return;
        }
        
        e.preventDefault();
        const target = document.querySelector(href);
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Perfume search functionality
const searchBar = document.getElementById('perfumeSearch');
const categoryFilter = document.getElementById('categoryFilter');

searchBar.addEventListener('input', function(e) {
    currentSearchTerm = e.target.value;
    applyFilters();
});

categoryFilter.addEventListener('change', function(e) {
    currentCategory = e.target.value;
    applyFilters();
});

// Pagination button handlers
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');

if (prevBtn) {
    prevBtn.addEventListener('click', function() {
        if (currentPage > 1) {
            currentPage--;
            displayPerfumes(filteredPerfumes, currentPage);
        }
    });
}

if (nextBtn) {
    nextBtn.addEventListener('click', function() {
        const totalPages = Math.ceil(filteredPerfumes.length / itemsPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            displayPerfumes(filteredPerfumes, currentPage);
        }
    });
}

// Load perfumes when page loads
window.addEventListener('DOMContentLoaded', function() {// Access perfumesData from global scope (window)
    const perfumesData = window.perfumesData;if (typeof perfumesData === '') {const grid = document.getElementById('perfumeGrid');
        if (grid) {
            grid.innerHTML = '<p style="text-align: center; color: red; padding: 40px;">Error: Perfumes data not loaded. Please refresh the page.</p>';
        }
        return;
    }
    
    // Make perfumesData available globally for other functions
    window.perfumesData = perfumesData;
    
    // Sort alphabetically by name (A to Z) by default
    filteredPerfumes = [...perfumesData].sort((a, b) => a.Name.localeCompare(b.Name));displayPerfumes(filteredPerfumes, currentPage);
    updatePagination(filteredPerfumes.length, currentPage);});

// Modal event listeners
document.querySelectorAll('.close-modal').forEach(closeBtn => {
    closeBtn.addEventListener('click', function() {
        // Close the parent modal
        const modal = this.closest('.modal');
        if (modal) {
            modal.style.display = 'none';
        }
    });
});

window.addEventListener('click', function(event) {
    const modal = document.getElementById('perfumeModal');
    if (event.target === modal) {
        closeModal();
    }
});

// EmailJS Configuration
// IMPORTANT: Replace these with your actual EmailJS credentials
const EMAILJS_CONFIG = {
    serviceID: 'service_5p7sewc',      // Get from emailjs.com
    templateID: 'template_uucumwi',    // Get from emailjs.com
    publicKey: 'e_ygbDh_MjDekmrly'       // Get from emailjs.com
};

// Initialize EmailJS
(function() {
    if (typeof emailjs !== '' && EMAILJS_CONFIG.publicKey !== 'YOUR_PUBLIC_KEY') {
        emailjs.init(EMAILJS_CONFIG.publicKey);
    }
})();

// Contact form submission
const contactForm = document.getElementById('contactForm');

if (contactForm) {
    contactForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const form = this;
        const submitBtn = form.querySelector('button[type="submit"]');
        
        if (!submitBtn) return;
        
        const originalBtnText = submitBtn.textContent;
        
        // Check if EmailJS is configured
        if (EMAILJS_CONFIG.publicKey === 'YOUR_PUBLIC_KEY') {
            // Fallback: Show alert if EmailJS not configured
            alert('Thank you for your message! We will get back to you soon.');
            form.reset();
            return;
        }
        
        // Disable button and show loading
        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending...';
        showLoadingSpinner();
        
        // Prepare email parameters
        const templateParams = {
            from_name: form.querySelector('input[type="text"]').value,
            from_email: form.querySelector('input[type="email"]').value,
            subject: form.querySelector('input[placeholder="Subject"]').value || 'Contact Form Submission',
            message: form.querySelector('textarea').value,
            to_email: 'scnt.vaultsup@gmail.com' // Your email
        };
        
        // Save to Firebase first
        const contactData = {
            name: templateParams.from_name,
            email: templateParams.from_email,
            subject: templateParams.subject,
            message: templateParams.message
        };
        
        // Save to Firebase if available
        const saveContact = window.saveContactMessage || (async () => {return 'local-' + Date.now();
        });
        
        saveContact(contactData)
            .then((contactId) => {// Then send email using EmailJS
                return emailjs.send(EMAILJS_CONFIG.serviceID, EMAILJS_CONFIG.templateID, templateParams);
            })
            .then(function(response) {
                hideLoadingSpinner();
                submitBtn.disabled = false;
                submitBtn.textContent = originalBtnText;
                
                showNotification('✅ Message sent successfully! We\'ll get back to you soon.');
                form.reset();})
            .catch(function(error) {
                hideLoadingSpinner();
                submitBtn.disabled = false;
                submitBtn.textContent = originalBtnText;
                
                showNotification('❌ Failed to send message. Please try again or email us directly.');});
    });
}

// Consolidated scroll handler with throttle
let lastScrollTime = 0;
window.addEventListener('scroll', function() {
    const now = Date.now();
    if (now - lastScrollTime < 16) return; // ~60fps throttle
    lastScrollTime = now;
    
    const scrollY = window.scrollY;
    
    // Navbar scroll effect
    const navbar = document.querySelector('.navbar');
    if (scrollY > 50) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
    
    // Quick actions menu visibility
    const quickActionsMenu = document.getElementById('quickActionsMenu');
    if (quickActionsMenu) {
        if (scrollY > 500) {
            quickActionsMenu.classList.add('active');
        } else {
            quickActionsMenu.classList.remove('active');
        }
    }
    
    // Floating quiz button visibility
    const floatingQuizBtn = document.getElementById('floatingQuizBtn');
    if (floatingQuizBtn) {
        if (scrollY > 300) {
            floatingQuizBtn.style.opacity = '1';
            floatingQuizBtn.style.pointerEvents = 'auto';
        } else {
            floatingQuizBtn.style.opacity = '0';
            floatingQuizBtn.style.pointerEvents = 'none';
        }
    }
}, { passive: true });

function showNotification(message) {
    // Remove any existing notifications first
    const existingNotifications = document.querySelectorAll('.toast-notification');
    existingNotifications.forEach(n => n.remove());
    
    // Auto-detect type from emoji prefix
    let type = 'info';
    let cleanMessage = message;
    if (message.startsWith('✅')) {
        type = 'success';
        cleanMessage = message.replace(/^✅\s*/, '');
    } else if (message.startsWith('❌')) {
        type = 'error';
        cleanMessage = message.replace(/^❌\s*/, '');
    }
    
    // Icons by type
    const icons = {
        success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
        error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
        info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
    };
    
    const notification = document.createElement('div');
    notification.className = `toast-notification toast-${type}`;
    notification.innerHTML = `
        <div class="toast-icon">${icons[type]}</div>
        <span class="toast-message">${cleanMessage}</span>
        <button class="toast-close" aria-label="Close">&times;</button>
        <div class="toast-progress"><div class="toast-progress-bar"></div></div>
    `;
    
    // Stack offset: count existing notifications that haven't been removed yet
    const existing = document.querySelectorAll('.toast-notification');
    const stackOffset = existing.length * 80;
    notification.style.top = `${24 + stackOffset}px`;
    
    document.body.appendChild(notification);
    
    // Close button
    const closeBtn = notification.querySelector('.toast-close');
    closeBtn.addEventListener('click', function() {
        dismissToast(notification);
    });
    
    // Start progress bar animation
    const progressBar = notification.querySelector('.toast-progress-bar');
    progressBar.style.animationDuration = '4s';
    
    // Auto-dismiss after 4s
    setTimeout(() => {
        if (notification.parentElement) {
            dismissToast(notification);
        }
    }, 4000);
}

function dismissToast(notification) {
    notification.classList.add('toast-exit');
    setTimeout(() => notification.remove(), 300);
}

// Share function
function sharePerfume() {
    if (currentPerfumeInModal) {
        const shareText = `Check out ${currentPerfumeInModal.Name} by ${currentPerfumeInModal.Brand} at SCNT Vault!`;
        
        if (navigator.share) {
            navigator.share({
                title: currentPerfumeInModal.Name,
                text: shareText,
                url: window.location.href
            }).catch(() => {});
        } else {
            // Fallback: copy to clipboard
            navigator.clipboard.writeText(shareText + ' ' + window.location.href);
            showNotification('Link copied to clipboard!');
        }
    }
}

// Sort filter handler
const sortFilter = document.getElementById('sortFilter');
sortFilter.addEventListener('change', function(e) {
    currentSort = e.target.value;
    applyFilters();
});

// Clear filters button
const clearFiltersBtn = document.getElementById('clearFilters');

if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener('click', function() {
        currentSearchTerm = '';
        currentCategory = 'all';
        currentSort = 'name-az'; // Reset to alphabetical sort
        
        const searchInput = document.getElementById('perfumeSearch');
        const categoryFilter = document.getElementById('categoryFilter');
        const sortFilter = document.getElementById('sortFilter');
        
        if (searchInput) searchInput.value = '';
        if (categoryFilter) categoryFilter.value = 'all';
        if (sortFilter) sortFilter.value = 'name-az';
        
        applyFilters();
    });
}

// Share and scroll button handlers
const shareBtn = document.getElementById('shareBtn');

if (shareBtn) {
    shareBtn.addEventListener('click', sharePerfume);
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(400px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(400px); opacity: 0; }
    }
`;
document.head.appendChild(style);

// View toggle functionality
let currentView = 'grid';
const viewButtons = document.querySelectorAll('.view-btn');

viewButtons.forEach(btn => {
    btn.addEventListener('click', function() {
        viewButtons.forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        currentView = this.dataset.view;
        
        const perfumeGrid = document.getElementById('perfumeGrid');
        if (currentView === 'list') {
            perfumeGrid.classList.add('list-view');
        } else {
            perfumeGrid.classList.remove('list-view');
        }
        
        displayPerfumes(filteredPerfumes, currentPage);
    });
});

// Mobile menu toggle
const mobileMenuToggle = document.getElementById('mobileMenuToggle');
const navLinks = document.getElementById('navLinks');
const mobileMenuBackdrop = document.getElementById('mobileMenuBackdrop');

function closeMobileMenu() {
    navLinks.classList.remove('active');
    mobileMenuToggle.classList.remove('active');
    if (mobileMenuBackdrop) mobileMenuBackdrop.classList.remove('active');
}

if (mobileMenuToggle && navLinks) {
    mobileMenuToggle.addEventListener('click', function() {
        const isOpening = !navLinks.classList.contains('active');
        navLinks.classList.toggle('active');
        mobileMenuToggle.classList.toggle('active');
        if (mobileMenuBackdrop) mobileMenuBackdrop.classList.toggle('active');
        
        // Prevent body scroll when menu is open
        if (isOpening) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
    });
}

// Close mobile menu on backdrop click
if (mobileMenuBackdrop) {
    mobileMenuBackdrop.addEventListener('click', closeMobileMenu);
}

// Close mobile menu when clicking a link
document.querySelectorAll('.nav-links a').forEach(link => {
    link.addEventListener('click', function() {
        closeMobileMenu();
    });
});

// Review modal functionality
const writeReviewBtn = document.getElementById('writeReviewBtn');
const reviewModal = document.getElementById('reviewModal');
const closeReview = document.querySelector('.close-review');
const reviewForm = document.getElementById('reviewForm');
const stars = document.querySelectorAll('.star');
const ratingValue = document.getElementById('ratingValue');

let selectedRating = 0;

// Only initialize if elements exist
if (writeReviewBtn && reviewModal && closeReview && reviewForm) {
    writeReviewBtn.addEventListener('click', function() {
        reviewModal.style.display = 'block';
    });

    closeReview.addEventListener('click', function() {
        reviewModal.style.display = 'none';
        resetReviewForm();
    });

    stars.forEach(star => {
    star.addEventListener('click', function() {
        selectedRating = parseInt(this.dataset.rating);
        ratingValue.value = selectedRating;
        updateStars();
    });
    
    star.addEventListener('mouseenter', function() {
        const rating = parseInt(this.dataset.rating);
        highlightStars(rating);
    });
});

document.querySelector('.star-rating').addEventListener('mouseleave', function() {
    updateStars();
});

function highlightStars(rating) {
    stars.forEach((star, index) => {
        if (index < rating) {
            star.textContent = '★';
            star.style.color = '#000';
        } else {
            star.textContent = '☆';
            star.style.color = '#ddd';
        }
    });
}

function updateStars() {
    highlightStars(selectedRating);
}

function resetReviewForm() {
    selectedRating = 0;
    ratingValue.value = '';
    reviewForm.reset();
    stars.forEach(star => {
        star.textContent = '☆';
        star.style.color = '#ddd';
    });
}

reviewForm.addEventListener('submit', function(e) {
    e.preventDefault();
    
    if (selectedRating === 0) {
        showNotification('Please select a rating');
        return;
    }
    
    const reviewerName = document.getElementById('reviewerName').value;
    const reviewText = document.getElementById('reviewText').value;
    
    // Create new review card
    const reviewGrid = document.querySelector('.review-grid');
    const newReview = document.createElement('div');
    newReview.className = 'review-card';
    newReview.style.animation = 'slideIn 0.5s ease';
    
    const starDisplay = '★'.repeat(selectedRating) + '☆'.repeat(5 - selectedRating);
    
    newReview.innerHTML = `
        <div class="stars">${starDisplay}</div>
        <p class="review-text">"${reviewText}"</p>
        <p class="reviewer">- ${reviewerName}</p>
        <p class="review-date">Just now</p>
    `;
    
    reviewGrid.insertBefore(newReview, reviewGrid.firstChild);
    
    showNotification('Thank you for your review!');
    reviewModal.style.display = 'none';
    resetReviewForm();
});
} // End of review modal check

// Newsletter subscription
const newsletterForm = document.getElementById('newsletterForm');

if (newsletterForm) {
    newsletterForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const emailInput = this.querySelector('input[type="email"]');
        
        if (!emailInput || !emailInput.value) return;
        
        const email = emailInput.value;
        showLoadingSpinner();
    
        // Subscribe to newsletter if Firebase available
        const subscribe = window.subscribeNewsletter || (async () => {return 'local-' + Date.now();
        });
        
        subscribe(email)
            .then((subscriptionId) => {
                hideLoadingSpinner();
                showNotification('✅ Successfully subscribed to newsletter!');this.reset();
            })
            .catch((error) => {
                hideLoadingSpinner();
                showNotification('❌ Failed to subscribe. Please try again.');});
    });
}

// Loading spinner functions
function showLoadingSpinner() {
    const spinner = document.getElementById('loadingSpinner');
    if (spinner) {
        spinner.classList.add('active');
    }
}

function hideLoadingSpinner() {
    const spinner = document.getElementById('loadingSpinner');
    if (spinner) {
        spinner.classList.remove('active');
    }
}

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
    // Escape key closes modals
    if (e.key === 'Escape') {
        closeModal();
        reviewModal.style.display = 'none';
        const wishlistPanel = document.getElementById('wishlistPanel');
        wishlistPanel.classList.remove('active');
    }
    
    // Ctrl/Cmd + K for search focus
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        document.getElementById('perfumeSearch').focus();
    }
});

// Lazy loading for images
if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                const src = img.dataset.src;
                if (src) {
                    img.style.backgroundImage = `url('${src}')`;
                    img.classList.add('loaded');
                }
                observer.unobserve(img);
            }
        });
    }, { rootMargin: '200px' }); // Start loading 200px before visible
    
    // This will be applied when images are created
    window.imageObserver = imageObserver;
}

// Auto-save search preferences
let searchPreferences = JSON.parse(localStorage.getItem('searchPreferences')) || {};

function saveSearchPreferences() {
    searchPreferences = {
        lastSearch: currentSearchTerm,
        lastCategory: currentCategory,
        lastSort: currentSort,
        lastView: currentView
    };
    localStorage.setItem('searchPreferences', JSON.stringify(searchPreferences));
}

// Restore preferences on load
window.addEventListener('DOMContentLoaded', function() {
    if (searchPreferences.lastView) {
        currentView = searchPreferences.lastView;
        document.querySelector(`[data-view="${currentView}"]`)?.click();
    }
    
    // Add view count tracking
    let viewCount = parseInt(localStorage.getItem('siteViews') || '0');
    viewCount++;
    localStorage.setItem('siteViews', viewCount);});

// Save preferences when they change
document.getElementById('perfumeSearch').addEventListener('input', saveSearchPreferences);
document.getElementById('categoryFilter').addEventListener('change', saveSearchPreferences);
document.getElementById('sortFilter').addEventListener('change', saveSearchPreferences);// Advanced Filters
// Voice Search
const voiceSearchBtn = document.getElementById('voiceSearchBtn');

if (voiceSearchBtn) {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        
        recognition.continuous = false;
        recognition.interimResults = false;
        
        voiceSearchBtn.addEventListener('click', function() {
            recognition.start();
            this.classList.add('listening');
            showNotification('Listening...');
        });
        
        recognition.onresult = function(event) {
            const transcript = event.results[0][0].transcript;
            const searchInput = document.getElementById('perfumeSearch');
            if (searchInput) {
                searchInput.value = transcript;
                currentSearchTerm = transcript;
                applyFilters();
            }
            voiceSearchBtn.classList.remove('listening');
            showNotification(`Searching for: ${transcript}`);
        };
        
        recognition.onerror = function() {
            voiceSearchBtn.classList.remove('listening');
            showNotification('Voice search failed. Please try again.');
        };
        
        recognition.onend = function() {
            voiceSearchBtn.classList.remove('listening');
        };
    } else {
        voiceSearchBtn.style.display = 'none';
    }
}

// Chat Bot
const chatBotBtn = document.getElementById('chatBotBtn');
const chatWidget = document.getElementById('chatWidget');
const closeChat = document.getElementById('closeChat');
const chatInput = document.getElementById('chatInput');
const sendChatBtn = document.getElementById('sendChatBtn');
const chatMessages = document.getElementById('chatMessages');

if (chatBotBtn && chatWidget) {
    chatBotBtn.addEventListener('click', function() {
        chatWidget.classList.toggle('active');
    });
}

if (closeChat && chatWidget) {
    closeChat.addEventListener('click', function() {
        chatWidget.classList.remove('active');
    });
}

function addChatMessage(message, isUser = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = isUser ? 'user-message' : 'bot-message';
    messageDiv.innerHTML = `<p>${message}</p>`;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function getBotResponse(userMessage) {
    const msg = userMessage.toLowerCase();
    
    if (msg.includes('popular') || msg.includes('trending')) {
        return "Our most popular perfumes right now are in the 'Trending This Week' section! Check out Midnight Essence and Ocean Breeze - they're customer favorites! 🌟";
    } else if (msg.includes('sale') || msg.includes('discount')) {
        return "All our perfumes are priced at just ₱220! Great quality at an affordable price. Check out our collection! 🎉";
    } else if (msg.includes('help') || msg.includes('choose')) {
        return "I'd love to help! What type of scent do you prefer? Fresh & Clean, Floral, Woody, or something else? Also, is this for yourself or a gift? 🎁";
    } else if (msg.includes('shipping') || msg.includes('delivery')) {
        return "We offer FREE shipping on orders over ₱500! Standard delivery takes 3-5 business days. 🚚";
    } else if (msg.includes('women') || msg.includes('female')) {
        return "For women, I recommend checking our Women's collection! Rose Garden and Midnight Essence are particularly popular. Would you like me to show you these? 💐";
    } else if (msg.includes('men') || msg.includes('male')) {
        return "For men, Ocean Breeze and our woody scents are excellent choices! They're fresh, masculine, and long-lasting. 🌊";
    } else if (msg.includes('price') || msg.includes('cost')) {
        return "All our perfumes are priced at ₱220! Great quality at an affordable price. 💰";
    } else if (msg.includes('authentic') || msg.includes('genuine')) {
        return "All our products are 100% authentic and genuine! We guarantee quality and offer secure payment options. ✨";
    } else {
        return "I'm here to help! You can ask me about popular perfumes, sales, shipping, or help choosing the perfect scent. What would you like to know? 😊";
    }
}

if (sendChatBtn && chatInput) {
    sendChatBtn.addEventListener('click', function() {
        const message = chatInput.value.trim();
        if (message) {
            addChatMessage(message, true);
            chatInput.value = '';
            
            setTimeout(() => {
                const response = getBotResponse(message);
                addChatMessage(response);
            }, 500);
        }
    });

    chatInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendChatBtn.click();
        }
    });
}

// Quick reply buttons
document.querySelectorAll('.quick-reply').forEach(btn => {
    btn.addEventListener('click', function() {
        const message = this.dataset.message;
        addChatMessage(message, true);
        
        setTimeout(() => {
            const response = getBotResponse(message);
            addChatMessage(response);
        }, 500);
    });
});

// Quick Actions Menu
const quickActionsMenu = document.getElementById('quickActionsMenu');

const quickChat = document.getElementById('quickChat');

if (quickChat && chatWidget) {
    quickChat.addEventListener('click', function() {
        chatWidget.classList.add('active');
    });
}

// Analytics tracking (simple version)
function trackEvent(eventName, eventData) {// In production, send to analytics service
}

// Performance monitoring
window.addEventListener('load', function() {
    const loadTime = performance.now();});// ===== SCENT QUIZ FEATURE =====
const quizQuestions = [
    {
        question: "What's your name or nickname?",
        type: "text",
        placeholder: "Enter your name...",
        field: "userName"
    },
    {
        question: "Which generation do you belong to?",
        type: "choice",
        field: "generation",
        options: [
            { text: "Gen Alpha (2013-present)", value: "genalpha", categories: ["Vibrant", "Playful", "Modern"] },
            { text: "Gen Z (1997-2012)", value: "genz", categories: ["Fresh", "Trendy", "Bold"] },
            { text: "Millennial (1981-1996)", value: "millennial", categories: ["Versatile", "Modern", "Sophisticated"] },
            { text: "Gen X (1965-1980)", value: "genx", categories: ["Classic", "Elegant", "Timeless"] },
            { text: "Baby Boomer (1946-1964)", value: "boomer", categories: ["Traditional", "Refined", "Luxurious"] },
            { text: "Prefer not to say", value: "any", categories: ["Versatile"] }
        ]
    },
    {
        question: "What's your preferred scent intensity?",
        type: "choice",
        options: [
            { text: "Light & Subtle", value: "light", categories: ["Fresh", "Citrus"] },
            { text: "Moderate", value: "moderate", categories: ["Floral", "Fruity"] },
            { text: "Strong & Bold", value: "strong", categories: ["Woody", "Oriental"] }
        ]
    },
    {
        question: "Which scent family appeals to you most?",
        type: "choice",
        options: [
            { text: "Fresh & Clean", value: "fresh", categories: ["Fresh", "Citrus", "Aquatic"] },
            { text: "Floral & Romantic", value: "floral", categories: ["Floral", "Rose", "Jasmine"] },
            { text: "Warm & Spicy", value: "warm", categories: ["Oriental", "Spicy", "Amber"] },
            { text: "Woody & Earthy", value: "woody", categories: ["Woody", "Musk", "Sandalwood"] }
        ]
    },
    {
        question: "When will you wear this perfume?",
        type: "choice",
        options: [
            { text: "Daytime / Office", value: "day", categories: ["Fresh", "Citrus", "Light Floral"] },
            { text: "Evening / Night Out", value: "night", categories: ["Oriental", "Woody", "Intense"] },
            { text: "Special Occasions", value: "special", categories: ["Floral", "Luxury", "Sophisticated"] },
            { text: "Everyday Wear", value: "everyday", categories: ["Versatile", "Fresh", "Balanced"] }
        ]
    },
    {
        question: "What season do you prefer?",
        type: "choice",
        options: [
            { text: "Spring / Summer", value: "warm", categories: ["Fresh", "Citrus", "Aquatic", "Fruity"] },
            { text: "Fall / Winter", value: "cold", categories: ["Woody", "Oriental", "Spicy", "Warm"] },
            { text: "All Year Round", value: "all", categories: ["Versatile", "Balanced"] }
        ]
    },
    {
        question: "How would you describe your personality?",
        type: "choice",
        options: [
            { text: "Energetic & Outgoing", value: "energetic", categories: ["Citrus", "Fruity", "Fresh"] },
            { text: "Elegant & Sophisticated", value: "elegant", categories: ["Floral", "Luxury", "Classic"] },
            { text: "Mysterious & Confident", value: "mysterious", categories: ["Oriental", "Woody", "Intense"] },
            { text: "Calm & Relaxed", value: "calm", categories: ["Fresh", "Aquatic", "Soft"] }
        ]
    }
];

let currentQuizQuestion = 0;
let quizAnswers = [];
let quizUserData = { userName: '', generation: '' };

const heroQuizBtn = document.getElementById('heroQuizBtn');
const floatingQuizBtn = document.getElementById('floatingQuizBtn');
const quizModal = document.getElementById('quizModal');
const closeQuiz = document.querySelector('.close-quiz');
const quizContainer = document.getElementById('quizContainer');
const quizResults = document.getElementById('quizResults');
const retakeQuizBtn = document.getElementById('retakeQuizBtn');

if (heroQuizBtn) {
    heroQuizBtn.addEventListener('click', startQuiz);
}
if (floatingQuizBtn) {
    floatingQuizBtn.addEventListener('click', startQuiz);
}
if (closeQuiz) {
    closeQuiz.addEventListener('click', () => quizModal.style.display = 'none');
}
if (retakeQuizBtn) {
    retakeQuizBtn.addEventListener('click', startQuiz);
}

function startQuiz() {
    currentQuizQuestion = 0;
    quizAnswers = [];
    quizUserData = { userName: '', generation: '' };
    quizContainer.style.display = 'block';
    quizResults.style.display = 'none';
    quizModal.style.display = 'block';
    showQuizQuestion();
}

function showQuizQuestion() {
    const question = quizQuestions[currentQuizQuestion];
    const progress = ((currentQuizQuestion + 1) / quizQuestions.length) * 100;
    
    document.getElementById('quizProgressBar').style.width = progress + '%';
    document.getElementById('quizQuestion').textContent = question.question;
    
    let optionsHtml = '';
    
    // Handle text input questions
    if (question.type === 'text') {
        optionsHtml = `
            <input type="text" 
                   id="quizTextInput" 
                   class="quiz-text-input" 
                   placeholder="${question.placeholder}"
                   value="${quizUserData[question.field] || ''}"
                   autocomplete="off">
        `;
        document.getElementById('quizOptions').innerHTML = optionsHtml;
        
        // Auto-focus the input
        setTimeout(() => {
            const input = document.getElementById('quizTextInput');
            input.focus();
            
            // Show next button when user types
            input.addEventListener('input', function() {
                if (this.value.trim().length > 0) {
                    document.getElementById('quizNextBtn').style.display = 'block';
                    quizUserData[question.field] = this.value.trim();
                } else {
                    document.getElementById('quizNextBtn').style.display = 'none';
                }
            });
            
            // Allow Enter key to proceed
            input.addEventListener('keypress', function(e) {
                if (e.key === 'Enter' && this.value.trim().length > 0) {
                    document.getElementById('quizNextBtn').click();
                }
            });
        }, 100);
        
    } else {
        // Handle choice questions
        optionsHtml = question.options.map((option, index) => 
            `<button class="quiz-option" data-index="${index}">${option.text}</button>`
        ).join('');
        
        document.getElementById('quizOptions').innerHTML = optionsHtml;
        
        // Add click handlers for choice buttons
        document.querySelectorAll('.quiz-option').forEach(btn => {
            btn.addEventListener('click', function() {
                document.querySelectorAll('.quiz-option').forEach(b => b.classList.remove('selected'));
                this.classList.add('selected');
                
                const optionIndex = parseInt(this.dataset.index);
                const selectedOption = question.options[optionIndex];
                
                // Store generation data separately
                if (question.field === 'generation') {
                    quizUserData.generation = selectedOption.value;
                }
                
                quizAnswers[currentQuizQuestion] = selectedOption;
                
                document.getElementById('quizNextBtn').style.display = 'block';
            });
        });
    }
    
    // Navigation buttons
    document.getElementById('quizPrevBtn').style.display = currentQuizQuestion > 0 ? 'block' : 'none';
    document.getElementById('quizNextBtn').style.display = 'none';
    
    document.getElementById('quizNextBtn').onclick = () => {
        if (currentQuizQuestion < quizQuestions.length - 1) {
            currentQuizQuestion++;
            showQuizQuestion();
        } else {
            showQuizResults();
        }
    };
    
    document.getElementById('quizPrevBtn').onclick = () => {
        if (currentQuizQuestion > 0) {
            currentQuizQuestion--;
            showQuizQuestion();
        }
    };
}

function showQuizResults() {
    // Analyze answers (skip text input questions)
    const categoryScores = {};
    quizAnswers.forEach(answer => {
        if (answer && answer.categories) {
            answer.categories.forEach(cat => {
                categoryScores[cat] = (categoryScores[cat] || 0) + 1;
            });
        }
    });
    
    // Get top categories
    const topCategories = Object.entries(categoryScores)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(entry => entry[0]);
    
    // Find matching perfumes
    const perfumesData = window.perfumesData || [];
    const recommendations = perfumesData.filter(perfume => {
        return topCategories.some(cat => 
            perfume.Category.toLowerCase().includes(cat.toLowerCase()) ||
            perfume.Name.toLowerCase().includes(cat.toLowerCase())
        );
    }).slice(0, 3);
    
    // If no matches, show random popular ones
    if (recommendations.length === 0) {
        recommendations.push(...perfumesData.slice(0, 3));
    }
    
    // Display results with personalization
    quizContainer.style.display = 'none';
    quizResults.style.display = 'block';
    
    // Personalized greeting
    const userName = quizUserData.userName || 'there';
    const generationText = quizUserData.generation ? ` As a ${getGenerationName(quizUserData.generation)},` : '';
    
    document.getElementById('quizResultText').innerHTML = 
        `<strong>Hey ${userName}!</strong> 🎉<br>${generationText} we think these ${topCategories.join(', ')} fragrances are perfect for you!`;
    
    const recommendationsHtml = recommendations.map(perfume => {
        const imagePath = perfume.ImagePath || 'images/scnt_default.png';
        return `
            <div class="quiz-recommendation-card">
                <div class="perfume-image" style="background-image: url('${imagePath}'); background-size: cover; background-position: center; height: 150px; border: 2px solid #000;"></div>
                <h3>${perfume.Name}</h3>
                <p>${perfume.Brand}</p>
                <p class="price">₱${perfume.SellingPrice}</p>
                <button class="btn" onclick="viewPerfumeFromQuiz('${perfume.Name}')">View Details</button>
            </div>
        `;
    }).join('');
    
    document.getElementById('quizRecommendations').innerHTML = recommendationsHtml;
    
    // Save quiz results to localStorage for future personalization
    localStorage.setItem('quizResults', JSON.stringify({
        userName: quizUserData.userName,
        generation: quizUserData.generation,
        categories: topCategories,
        date: new Date().toISOString()
    }));
}

function getGenerationName(value) {
    const names = {
        'genalpha': 'Gen Alpha',
        'genz': 'Gen Z',
        'millennial': 'Millennial',
        'genx': 'Gen X',
        'boomer': 'Baby Boomer',
        'any': 'valued customer'
    };
    return names[value] || 'valued customer';
}

function viewPerfumeFromQuiz(perfumeName) {
    const perfumesData = window.perfumesData || [];
    const perfume = perfumesData.find(p => p.Name === perfumeName);
    if (perfume) {
        quizModal.style.display = 'none';
        const imagePath = perfume.ImagePath || 'images/scnt_default.png';
        openModal(perfume, imagePath);
    }
}

// ===== SCENT NOTES & SIMILAR PRODUCTS =====
const scentNotesDatabase = {
    // You can customize these for each perfume
    default: {
        top: "Citrus, Bergamot, Fresh Notes",
        middle: "Jasmine, Rose, Floral Bouquet",
        base: "Musk, Vanilla, Sandalwood"
    },
    floral: {
        top: "Rose, Peony, Lily",
        middle: "Jasmine, Violet, Iris",
        base: "White Musk, Amber, Cedarwood"
    },
    fresh: {
        top: "Lemon, Mint, Green Apple",
        middle: "Sea Breeze, Lavender, Cucumber",
        base: "Aquatic Notes, Light Musk"
    },
    woody: {
        top: "Bergamot, Cardamom",
        middle: "Cedarwood, Vetiver, Patchouli",
        base: "Sandalwood, Amber, Leather"
    },
    oriental: {
        top: "Mandarin, Cinnamon, Saffron",
        middle: "Jasmine, Orange Blossom, Spices",
        base: "Vanilla, Amber, Oud, Musk"
    }
};

function getScentNotes(perfume) {
    const category = perfume.Category.toLowerCase();
    
    if (category.includes('floral') || category.includes('rose')) {
        return scentNotesDatabase.floral;
    } else if (category.includes('fresh') || category.includes('citrus')) {
        return scentNotesDatabase.fresh;
    } else if (category.includes('woody') || category.includes('wood')) {
        return scentNotesDatabase.woody;
    } else if (category.includes('oriental') || category.includes('spicy')) {
        return scentNotesDatabase.oriental;
    }
    
    return scentNotesDatabase.default;
}

function findSimilarProducts(currentPerfume) {
    const perfumesData = window.perfumesData || [];
    return perfumesData
        .filter(p => p.Name !== currentPerfume.Name)
        .filter(p => 
            p.Category === currentPerfume.Category || 
            p.Gender === currentPerfume.Gender ||
            p.Brand === currentPerfume.Brand
        )
        .slice(0, 4);
}

// Update modal to show scent notes and similar products
openModal = function(perfume, imagePath) {
    // Track view
    trackEvent('perfume_view', { name: perfume.Name, brand: perfume.Brand });
    
    // Call original function
    const modal = document.getElementById('perfumeModal');
    const modalImage = document.getElementById('modalImage');
    const modalName = document.getElementById('modalName');
    const modalBrand = document.getElementById('modalBrand');
    const modalCategory = document.getElementById('modalCategory');
    const modalGender = document.getElementById('modalGender');
    const modalSize = document.getElementById('modalSize');
    const modalPrice = document.getElementById('modalPrice');
    
    currentPerfumeInModal = { ...perfume, imagePath };
    
    modalImage.style.backgroundImage = `url('${imagePath}')`;
    modalName.textContent = perfume.Name;
    modalBrand.textContent = perfume.Brand;
    modalCategory.textContent = perfume.Category;
    modalGender.textContent = `Gender: ${perfume.Gender}`;
    modalSize.textContent = `Available Sizes: ${perfume.Size}`;
    modalPrice.textContent = `₱${perfume.SellingPrice}`;
    
    // Add scent notes
    const notes = getScentNotes(perfume);
    document.getElementById('topNotes').textContent = notes.top;
    document.getElementById('middleNotes').textContent = notes.middle;
    document.getElementById('baseNotes').textContent = notes.base;
    
    // Add similar products
    const similarProducts = findSimilarProducts(perfume);
    const similarHtml = similarProducts.map(p => {
        const img = p.ImagePath || 'images/scnt_default.png';
        return `
            <div class="similar-product-card" onclick="viewSimilarProduct('${p.Name}')">
                <div class="similar-product-image" style="background-image: url('${img}')"></div>
                <h4>${p.Name}</h4>
                <p>${p.Brand}</p>
                <p class="price">₱${p.SellingPrice}</p>
            </div>
        `;
    }).join('');
    document.getElementById('similarProductsGrid').innerHTML = similarHtml;
    
    // Add to recently viewed
    addToRecentlyViewed(perfume);
    
    modal.style.display = 'block';
};

function viewSimilarProduct(perfumeName) {
    const perfumesData = window.perfumesData || [];
    const perfume = perfumesData.find(p => p.Name === perfumeName);
    if (perfume) {
        const imagePath = perfume.ImagePath || 'images/scnt_default.png';
        openModal(perfume, imagePath);
    }
}

// ===== RECENTLY VIEWED FEATURE =====
let recentlyViewed = JSON.parse(localStorage.getItem('recentlyViewed')) || [];

function addToRecentlyViewed(perfume) {
    // Remove if already exists
    recentlyViewed = recentlyViewed.filter(p => p.Name !== perfume.Name);
    
    // Add to beginning
    recentlyViewed.unshift({
        ...perfume,
        imagePath: perfume.ImagePath || 'images/scnt_default.png'
    });
    
    // Keep only last 6
    recentlyViewed = recentlyViewed.slice(0, 6);
    
    // Save to localStorage
    localStorage.setItem('recentlyViewed', JSON.stringify(recentlyViewed));
    
    // Update display
    updateRecentlyViewedDisplay();
}

function updateRecentlyViewedDisplay() {
    const section = document.getElementById('recentlyViewedSection');
    const grid = document.getElementById('recentlyViewedGrid');
    
    if (!section || !grid) {return;
    }
    
    if (recentlyViewed.length === 0) {
        section.style.display = 'none';
        return;
    }
    
    section.style.display = 'block';
    
    const html = recentlyViewed.map(perfume => `
        <div class="perfume-card" onclick="viewRecentlyViewedProduct('${perfume.Name}')">
            <div class="perfume-image" style="background-image: url('${perfume.imagePath}'); background-size: cover; background-position: center;"></div>
            <h3>${perfume.Name}</h3>
            <p class="brand">${perfume.Brand}</p>
            <p class="category">${perfume.Category}</p>
            <p class="price">₱${perfume.SellingPrice}</p>
        </div>
    `).join('');
    
    grid.innerHTML = html;
    
    // Initialize carousel controls
    initRecentlyViewedCarousel();
}

// Recently Viewed Carousel Controls
function initRecentlyViewedCarousel() {
    const grid = document.getElementById('recentlyViewedGrid');
    const prevBtn = document.getElementById('recentlyViewedPrev');
    const nextBtn = document.getElementById('recentlyViewedNext');
    
    if (!grid || !prevBtn || !nextBtn) return;
    
    const scrollAmount = 300;
    
    prevBtn.addEventListener('click', () => {
        grid.scrollBy({
            left: -scrollAmount,
            behavior: 'smooth'
        });
    });
    
    nextBtn.addEventListener('click', () => {
        grid.scrollBy({
            left: scrollAmount,
            behavior: 'smooth'
        });
    });
    
    // Update button states on scroll
    function updateButtonStates() {
        const isAtStart = grid.scrollLeft <= 0;
        const isAtEnd = grid.scrollLeft >= grid.scrollWidth - grid.clientWidth - 10;
        
        prevBtn.disabled = isAtStart;
        nextBtn.disabled = isAtEnd;
    }
    
    grid.addEventListener('scroll', updateButtonStates);
    updateButtonStates();
}

function viewRecentlyViewedProduct(perfumeName) {
    const perfumesData = window.perfumesData || [];
    const perfume = perfumesData.find(p => p.Name === perfumeName);
    if (perfume) {
        const imagePath = perfume.ImagePath || 'images/scnt_default.png';
        openModal(perfume, imagePath);
    }
}

// ===== FAQ ACCORDION =====
function initializeFAQ() {
    document.querySelectorAll('.faq-question').forEach(button => {
        button.addEventListener('click', function() {
            const faqItem = this.parentElement;
            const isActive = faqItem.classList.contains('active');
            
            // Close all
            document.querySelectorAll('.faq-item').forEach(item => {
                item.classList.remove('active');
            });
            
            // Open clicked one if it wasn't active
            if (!isActive) {
                faqItem.classList.add('active');
            }
        });
    });}

// Initialize cart and features on page load
window.addEventListener('DOMContentLoaded', function() {
    updateRecentlyViewedDisplay();
    initializeFAQ();updateCartUI();
    initializeCartButtons();
    initializeCheckoutHandlers();
});// ===== SHOPPING CART FEATURE =====

// Cart Functions
function addToCart(perfume, quantity = 1) {
    const existingItem = cart.find(item => item.Name === perfume.Name);
    
    if (existingItem) {
        existingItem.quantity += quantity;
    } else {
        cart.push({
            ...perfume,
            quantity: quantity
        });
    }
    
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartUI();
    showNotification(`${perfume.Name} added to cart!`);
}

function removeFromCart(perfumeName) {
    cart = cart.filter(item => item.Name !== perfumeName);
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartUI();
    showNotification('Item removed from cart');
}

function updateCartQuantity(perfumeName, newQuantity) {
    const item = cart.find(item => item.Name === perfumeName);
    if (item) {
        if (newQuantity <= 0) {
            removeFromCart(perfumeName);
        } else {
            item.quantity = newQuantity;
            localStorage.setItem('cart', JSON.stringify(cart));
            updateCartUI();
        }
    }
}

function calculateCartTotals() {
    const subtotal = cart.reduce((sum, item) => sum + (parseFloat(item.SellingPrice) * item.quantity), 0);
    return { subtotal, total: subtotal };
}

function updateCartUI() {
    const cartCount = document.getElementById('cartCount');
    const navCartCount = document.getElementById('navCartCount');
    const cartItems = document.getElementById('cartItems');
    const cartSummary = document.getElementById('cartSummary');
    
    if (!cartItems || !cartSummary) {return;
    }
    
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    
    if (cartCount) cartCount.textContent = totalItems;
    if (navCartCount) navCartCount.textContent = totalItems;
    
    if (cart.length === 0) {
        cartItems.innerHTML = '<p class="empty-cart">Your cart is empty</p>';
        cartSummary.style.display = 'none';
    } else {
        cartItems.innerHTML = cart.map(item => {
            const imagePath = item.ImagePath || item.imagePath || 'images/scnt_default.png';
            return `
                <div class="cart-item">
                    <div class="cart-item-image" style="background-image: url('${imagePath}')"></div>
                    <div class="cart-item-info">
                        <h4>${item.Name}</h4>
                        <p>${item.Brand}</p>
                        <p class="cart-item-price">₱${item.SellingPrice}</p>
                        <div class="cart-item-quantity">
                            <button class="qty-btn" onclick="updateCartQuantity('${item.Name}', ${item.quantity - 1})">-</button>
                            <span>${item.quantity}</span>
                            <button class="qty-btn" onclick="updateCartQuantity('${item.Name}', ${item.quantity + 1})">+</button>
                        </div>
                    </div>
                    <button class="remove-cart" onclick="removeFromCart('${item.Name}')">×</button>
                </div>
            `;
        }).join('');
        
        const totals = calculateCartTotals();
        const subtotalEl = document.getElementById('cartSubtotal');
        const totalEl = document.getElementById('cartTotal');
        
        if (subtotalEl) subtotalEl.textContent = `₱${totals.subtotal.toFixed(2)}`;
        if (totalEl) totalEl.textContent = `₱${totals.total.toFixed(2)}`;
        
        cartSummary.style.display = 'block';
    }
}

function toggleCartPanel() {
    const panel = document.getElementById('cartPanel');
    if (!panel) return;
    
    const isOpening = !panel.classList.contains('active');
    panel.classList.toggle('active');
    
    // Prevent body scroll on mobile when cart is open
    if (isMobileDevice()) {
        if (isOpening) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
    }
}

// Cart Button Handlers - Initialize after DOM is ready
function initializeCartButtons() {
    const cartBtn = document.getElementById('cartBtn');
    const navCartBtn = document.getElementById('navCartBtn');
    const closeCart = document.querySelector('.close-cart');
    const addToCartModal = document.getElementById('addToCartModal');
    const checkoutBtn = document.getElementById('checkoutBtn');
    
    if (cartBtn) {
        cartBtn.addEventListener('click', toggleCartPanel);} else {}
    
    if (navCartBtn) {
        navCartBtn.addEventListener('click', function(e) {
            e.preventDefault();
            toggleCartPanel();
        });}
    
    if (closeCart) {
        closeCart.addEventListener('click', toggleCartPanel);}
    
    if (addToCartModal) {
        addToCartModal.addEventListener('click', function() {
            if (currentPerfumeInModal) {
                addToCart(currentPerfumeInModal);
            }
        });}
    
    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            if (cart.length === 0) {
                showNotification('Your cart is empty!');
                return;
            }
            
            const totals = calculateCartTotals();
            
            // Close cart panel
            toggleCartPanel();
            
            // Build order summary text
            const itemList = cart.map(item => `${item.Name} × ${item.quantity}`).join(', ');
            const totalText = `₱${totals.total.toFixed(2)}`;
            
            // Show pending invoice popup, then open checkout form
            const popup = document.createElement('div');
            popup.className = 'invoice-popup-overlay';
            popup.innerHTML = `
                <div class="invoice-popup">
                    <div class="invoice-popup-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="48" height="48">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                            <polyline points="14 2 14 8 20 8"/>
                            <line x1="16" y1="13" x2="8" y2="13"/>
                            <line x1="16" y1="17" x2="8" y2="17"/>
                            <polyline points="10 9 9 9 8 9"/>
                        </svg>
                    </div>
                    <h3>Order Pending</h3>
                    <p class="invoice-popup-total">Total: <strong>${totalText}</strong></p>
                    <p class="invoice-popup-message">Thank you for your order! The seller will send you an official invoice receipt via <strong>Email</strong> or <a href="https://m.me/scnt.vaultcebu" target="_blank" rel="noopener noreferrer"><strong>Messenger</strong></a>.</p>
                    <p class="invoice-popup-sub">Please wait while we prepare your invoice. You will receive it shortly.</p>
                    <p class="invoice-popup-delivery">Delivery fee varies depending on your location — this will be included in your invoice.</p>
                    <div class="invoice-popup-items">${itemList}</div>
                    <button class="invoice-popup-close">Got it</button>
                </div>
            `;
            document.body.appendChild(popup);
            
            // On "Got it", close popup and open checkout form
            popup.querySelector('.invoice-popup-close').addEventListener('click', function() {
                popup.remove();
                openCheckoutForm();
            });
        });} else {}
}

// Helper to open the checkout form modal
function openCheckoutForm() {
    const checkoutModal = document.getElementById('checkoutModal');
    const checkoutItems = document.getElementById('checkoutItems');
    
    if (!checkoutModal || !checkoutItems) return;
    
    checkoutItems.innerHTML = cart.map(item => `
        <div class="checkout-item">
            <span>${item.Name} × ${item.quantity}</span>
            <span>₱${(parseFloat(item.SellingPrice) * item.quantity).toFixed(2)}</span>
        </div>
    `).join('');
    
    const totals = calculateCartTotals();
    const subtotalEl = document.getElementById('checkoutSubtotal');
    const totalEl = document.getElementById('checkoutTotal');
    
    if (subtotalEl) subtotalEl.textContent = `₱${totals.subtotal.toFixed(2)}`;
    if (totalEl) totalEl.textContent = `₱${totals.total.toFixed(2)}`;
    
    checkoutModal.style.display = 'block';
}

// Checkout Functions - moved inside initialization
function initializeCheckoutHandlers() {
    const closeCheckout = document.querySelector('.close-checkout');
    const checkoutForm = document.getElementById('checkoutForm');
    
    if (closeCheckout) {
        closeCheckout.addEventListener('click', function() {
            document.getElementById('checkoutModal').style.display = 'none';
        });
    }
    
    if (checkoutForm) {
        checkoutForm.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const form = this;
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.textContent;
    
    // Check if EmailJS is configured
    if (EMAILJS_CONFIG.publicKey === 'YOUR_PUBLIC_KEY') {
        alert('Thank you for your order! We will contact you shortly.');        // Clear cart and close modal
        cart = [];
        localStorage.setItem('cart', JSON.stringify(cart));
        updateCartUI();
        form.reset();
        document.getElementById('checkoutModal').style.display = 'none';
        showNotification('✅ Order request sent! We\'ll contact you to confirm availability and details. (Demo mode)');
        return;
    }
    
    // Disable button and show loading
    submitBtn.disabled = true;
    submitBtn.textContent = 'Processing Order...';
    showLoadingSpinner();
    
    // Prepare order details
    const formData = new FormData(form);
    const totals = calculateCartTotals();
    
    const orderItems = cart.map(item => 
        `${item.Name} (${item.Brand}) - Qty: ${item.quantity} - ₱${(parseFloat(item.SellingPrice) * item.quantity).toFixed(2)}`
    ).join('\n');
    
    // Prepare order data for Firebase
    const orderData = {
        customerName: formData.get('fullName'),
        email: formData.get('email'),
        phone: formData.get('phone'),
        address: formData.get('address'),
        city: formData.get('city'),
        province: formData.get('province'),
        zipCode: formData.get('zipCode'),
        items: cart.map(item => ({
            name: item.Name,
            brand: item.Brand,
            quantity: item.quantity,
            price: parseFloat(item.SellingPrice)
        })),
        subtotal: totals.subtotal,
        total: totals.total,
        notes: formData.get('notes') || ''
    };
    
    const templateParams = {
        customer_name: formData.get('fullName'),
        customer_email: formData.get('email'),
        customer_phone: formData.get('phone'),
        shipping_address: `${formData.get('address')}, ${formData.get('city')}, ${formData.get('province')} ${formData.get('zipCode')}`,
        order_items: orderItems,
        subtotal: `₱${totals.subtotal.toFixed(2)}`,
        total: `₱${totals.total.toFixed(2)}`,
        notes: formData.get('notes') || 'None',
        order_date: new Date().toLocaleString(),
        to_email: 'scnt.vaultsup@gmail.com'
    };
    
    // Save order to Firebase first (if available)
    const saveOrder = window.createOrder || (async () => {return 'local-' + Date.now();
    });
    
    let savedOrderId = null;
    
    saveOrder(orderData)
        .then((orderId) => {// Then send email using EmailJS
            savedOrderId = orderId;
            templateParams.order_number = orderId;
            return emailjs.send(EMAILJS_CONFIG.serviceID, 'template_6g4lf87', templateParams);
        })
        .then(function(response) {
            hideLoadingSpinner();
            submitBtn.disabled = false;
            submitBtn.textContent = originalBtnText;
            
            showNotification('✅ Order request sent! We\'ll contact you soon to confirm availability and finalize your order.');
            
            // Clear cart
            cart = [];
            localStorage.setItem('cart', JSON.stringify(cart));
            updateCartUI();
            
            form.reset();
            document.getElementById('checkoutModal').style.display = 'none';})
        .catch(function(error) {
            hideLoadingSpinner();
            submitBtn.disabled = false;
            submitBtn.textContent = originalBtnText;
            
            if (savedOrderId) {
                console.error('❌ Invoice email failed:', error && (error.text || error.message || error));
                
                showNotification('✅ Order request sent! We\'ll contact you soon to confirm availability and finalize your order.');
                
                // Clear cart
                cart = [];
                localStorage.setItem('cart', JSON.stringify(cart));
                updateCartUI();
                
                form.reset();
                document.getElementById('checkoutModal').style.display = 'none';
            } else {
                showNotification('❌ Failed to place order. Please try again or contact us directly.');
            }});
    });
    }}// ===== MOBILE OPTIMIZATIONS =====

// Detect mobile device
function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// Prevent body scroll when cart/checkout is open
function preventBodyScroll(prevent) {
    if (prevent) {
        document.body.style.overflow = 'hidden';
        document.body.style.position = 'fixed';
        document.body.style.width = '100%';
    } else {
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.width = '';
    }
}

// Update checkout modal for mobile
// (checkout button handlers are managed by initializeCartButtons)

// Close modals on outside click (desktop only)
if (!isMobileDevice()) {
    window.addEventListener('click', function(event) {
        const checkoutModal = document.getElementById('checkoutModal');
        if (event.target === checkoutModal) {
            checkoutModal.style.display = 'none';
            preventBodyScroll(false);
        }
    });
}

// Swipe to close cart panel on mobile
if (isMobileDevice()) {
    let touchStartX = 0;
    let touchEndX = 0;
    
    const cartPanel = document.getElementById('cartPanel');
    
    cartPanel.addEventListener('touchstart', function(e) {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });
    
    cartPanel.addEventListener('touchend', function(e) {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    }, { passive: true });
    
    function handleSwipe() {
        const swipeDistance = touchEndX - touchStartX;
        // Swipe right to close (at least 100px)
        if (swipeDistance > 100) {
            toggleCartPanel();
        }
    }
}

// Optimize cart button position on mobile
if (isMobileDevice()) {
    const cartBtn = document.getElementById('cartBtn');
    const wishlistBtn = document.getElementById('wishlistBtn');
    
    // Adjust positions to avoid overlap
    if (cartBtn && wishlistBtn) {
        cartBtn.style.bottom = '90px';
        wishlistBtn.style.bottom = '20px';
    }
}

// Handle orientation change
window.addEventListener('orientationchange', function() {
    // Close modals on orientation change for better UX
    const checkoutModal = document.getElementById('checkoutModal');
    const cartPanel = document.getElementById('cartPanel');
    
    if (checkoutModal.style.display === 'block') {
        // Keep checkout open but scroll to top
        setTimeout(() => {
            checkoutModal.scrollTop = 0;
        }, 100);
    }
});

// Improve touch feedback
if (isMobileDevice()) {
    // Add active class on touch for better feedback
    document.querySelectorAll('.qty-btn, .remove-cart, .checkout-btn, .place-order-btn').forEach(btn => {
        btn.addEventListener('touchstart', function() {
            this.style.opacity = '0.7';
        }, { passive: true });
        
        btn.addEventListener('touchend', function() {
            this.style.opacity = '1';
        }, { passive: true });
    });
}

// Prevent double-tap zoom on buttons
if (isMobileDevice()) {
    document.querySelectorAll('.cart-btn, .qty-btn, .checkout-btn, .place-order-btn').forEach(btn => {
        btn.addEventListener('touchend', function(e) {
            e.preventDefault();
            this.click();
        });
    });
}

// Auto-scroll to error fields on mobile
if (isMobileDevice()) {
    const checkoutForm = document.getElementById('checkoutForm');
    checkoutForm.addEventListener('invalid', function(e) {
        e.preventDefault();
        const firstInvalid = checkoutForm.querySelector(':invalid');
        if (firstInvalid) {
            firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => {
                firstInvalid.focus();
            }, 300);
        }
    }, true);
}

// Optimize cart animations for mobile
if (isMobileDevice()) {
    const style = document.createElement('style');
    style.textContent = `
        @media (max-width: 768px) {
            .cart-panel {
                transition: right 0.25s ease-out;
            }
            
            .modal {
                animation: modalFadeIn 0.2s ease;
            }
            
            .modal-content {
                animation: modalSlideIn 0.25s ease-out;
            }
        }
    `;
    document.head.appendChild(style);
}

// Handle iOS safe area
if (isMobileDevice() && /iPhone|iPad|iPod/.test(navigator.userAgent)) {
    const style = document.createElement('style');
    style.textContent = `
        @supports (padding: env(safe-area-inset-bottom)) {
            .cart-btn {
                bottom: calc(20px + env(safe-area-inset-bottom)) !important;
            }
            
            .wishlist-btn {
                bottom: calc(20px + env(safe-area-inset-bottom)) !important;
            }
            
            .cart-summary {
                padding-bottom: calc(20px + env(safe-area-inset-bottom)) !important;
            }
        }
    `;
    document.head.appendChild(style);
}// ============================================
// SCROLL-TRIGGERED REVEAL ANIMATIONS
// ============================================

(function initScrollReveals() {
    if (!('IntersectionObserver' in window)) return;

    const revealElements = document.querySelectorAll('[data-reveal]');
    if (!revealElements.length) return;

    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const el = entry.target;
                const revealType = el.getAttribute('data-reveal') || 'up';
                const delay = el.getAttribute('data-reveal-delay');

                let cssClass = 'reveal';
                if (revealType === 'left') cssClass = 'reveal-left';
                else if (revealType === 'right') cssClass = 'reveal-right';
                else if (revealType === 'scale') cssClass = 'reveal-scale';
                else if (revealType === 'fade') cssClass = 'reveal-fade';

                el.classList.add(cssClass);

                if (delay) el.classList.add('delay-' + delay);

                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        el.classList.add('revealed');
                    });
                });

                revealObserver.unobserve(el);
            }
        });
    }, {
        threshold: 0.12,
        rootMargin: '0px 0px -60px 0px'
    });

    revealElements.forEach(el => revealObserver.observe(el));
})();
