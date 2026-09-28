// Facebook Reviews Integration
// This script fetches reviews from your Facebook page and displays them

const FACEBOOK_CONFIG = {
    pageId: '103899272631309',  // Replace with your Facebook Page ID
    accessToken: '',  // Inject through a server-side integration; never commit access tokens.
    reviewsLimit: 10  // Number of reviews to fetch
};

// Function to fetch Facebook reviews
async function fetchFacebookReviews() {
    try {
        // Try the ratings endpoint first
        let url = `https://graph.facebook.com/v18.0/${FACEBOOK_CONFIG.pageId}/ratings?access_token=${FACEBOOK_CONFIG.accessToken}&fields=reviewer{name,picture},created_time,rating,review_text,recommendation_type&limit=${FACEBOOK_CONFIG.reviewsLimit}`;
        
        let response = await fetch(url);
        let data = await response.json();
        
        // If ratings endpoint fails, try recommendations endpoint
        if (data.error && data.error.code === 283) {
            console.log('Trying alternative endpoint: recommendations');
            url = `https://graph.facebook.com/v18.0/${FACEBOOK_CONFIG.pageId}/recommendations?access_token=${FACEBOOK_CONFIG.accessToken}&fields=reviewer{name,picture},created_time,rating,review_text,recommendation_type&limit=${FACEBOOK_CONFIG.reviewsLimit}`;
            response = await fetch(url);
            data = await response.json();
        }
        
        // If still failing, try feed with reviews
        if (data.error && data.error.code === 283) {
            console.log('Trying alternative endpoint: feed');
            url = `https://graph.facebook.com/v18.0/${FACEBOOK_CONFIG.pageId}/feed?access_token=${FACEBOOK_CONFIG.accessToken}&fields=message,from,created_time&limit=${FACEBOOK_CONFIG.reviewsLimit}`;
            response = await fetch(url);
            data = await response.json();
            
            // Convert feed posts to review format
            if (data.data) {
                data.data = data.data.map(post => ({
                    reviewer: post.from,
                    created_time: post.created_time,
                    rating: 5, // Default rating for feed posts
                    review_text: post.message
                }));
            }
        }
        
        if (data.error) {
            console.error('Facebook API Error:', data.error);
            console.log('Available permissions may be insufficient. Consider using manual reviews or requesting additional permissions.');
            return null;
        }
        
        return data.data;
    } catch (error) {
        console.error('Error fetching Facebook reviews:', error);
        return null;
    }
}

// Function to display Facebook reviews
function displayFacebookReviews(reviews) {
    if (!reviews || reviews.length === 0) {
        console.log('No Facebook reviews found');
        return;
    }
    
    const reviewGrid = document.querySelector('.review-grid');
    if (!reviewGrid) return;
    
    // Clear existing static reviews (optional)
    // reviewGrid.innerHTML = '';
    
    reviews.forEach(review => {
        const reviewCard = createReviewCard(review);
        reviewGrid.appendChild(reviewCard);
    });
    
    // Update review stats
    updateReviewStats(reviews);
}

// Function to create a review card from Facebook data
function createReviewCard(review) {
    const card = document.createElement('div');
    card.className = 'review-card facebook-review';
    
    const reviewerName = review.reviewer?.name || 'Anonymous';
    const reviewerPicture = review.reviewer?.picture?.data?.url || 'images/scnt_default.png';
    const rating = review.rating || 5;
    const reviewText = review.review_text || 'Great experience!';
    const createdTime = formatDate(review.created_time);
    
    const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating);
    
    card.innerHTML = `
        <div class="review-header">
            <img src="${reviewerPicture}" alt="${reviewerName}" class="review-avatar" onerror="this.src='images/scnt_default.png'">
            <div>
                <div class="stars">${stars}</div>
                <p class="reviewer">${reviewerName}</p>
                <p class="review-date">${createdTime}</p>
            </div>
        </div>
        <p class="review-text">"${reviewText}"</p>
        <div class="review-source">
            <span class="facebook-badge">📘 Facebook Review</span>
        </div>
    `;
    
    return card;
}

// Function to format date
function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
}

// Function to update review statistics
function updateReviewStats(reviews) {
    const ratingsSummary = document.querySelector('.rating-summary');
    if (!ratingsSummary) return;
    
    // Calculate average rating
    const totalRating = reviews.reduce((sum, review) => sum + (review.rating || 5), 0);
    const averageRating = (totalRating / reviews.length).toFixed(1);
    
    // Update the display
    const averageRatingElement = ratingsSummary.querySelector('.average-rating');
    const reviewCountElement = ratingsSummary.querySelector('p');
    
    if (averageRatingElement) {
        averageRatingElement.textContent = averageRating;
    }
    
    if (reviewCountElement) {
        reviewCountElement.textContent = `Based on ${reviews.length} Facebook reviews`;
    }
}

// Function to initialize Facebook reviews
async function initializeFacebookReviews() {
    // Check if configuration is set
    if (FACEBOOK_CONFIG.pageId === 'YOUR_FACEBOOK_PAGE_ID' || !FACEBOOK_CONFIG.accessToken) {
        console.warn('Facebook Reviews: Configuration required');
        console.log('To enable Facebook reviews integration:');
        console.log('1. Get your Facebook Page ID from your page settings');
        console.log('2. Generate an Access Token from Facebook Developer Console');
        console.log('3. Update FACEBOOK_CONFIG in facebook-reviews-integration.js');
        return;
    }
    
    // Show loading indicator
    const reviewGrid = document.querySelector('.review-grid');
    if (reviewGrid) {
        const loader = document.createElement('div');
        loader.className = 'reviews-loader';
        loader.innerHTML = '<p>Loading Facebook reviews...</p>';
        reviewGrid.appendChild(loader);
    }
    
    // Fetch and display reviews
    const reviews = await fetchFacebookReviews();
    
    // Remove loader
    const loader = document.querySelector('.reviews-loader');
    if (loader) loader.remove();
    
    if (reviews) {
        displayFacebookReviews(reviews);
    }
}

// Auto-refresh reviews every 5 minutes
function startAutoRefresh() {
    setInterval(async () => {
        const reviews = await fetchFacebookReviews();
        if (reviews) {
            // Clear Facebook reviews only
            const facebookReviews = document.querySelectorAll('.facebook-review');
            facebookReviews.forEach(review => review.remove());
            
            // Display updated reviews
            displayFacebookReviews(reviews);
        }
    }, 5 * 60 * 1000); // 5 minutes
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initializeFacebookReviews();
        startAutoRefresh();
    });
} else {
    initializeFacebookReviews();
    startAutoRefresh();
}

// Export functions for manual use
window.FacebookReviews = {
    fetch: fetchFacebookReviews,
    display: displayFacebookReviews,
    refresh: initializeFacebookReviews
};
