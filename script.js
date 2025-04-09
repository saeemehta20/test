// Replace with your Google Books API key
const API_KEY = 'AIzaSyBUc0rg5TgLT4r5LIp0BDzlwJEbCKD0y_A';
const API_URL = 'https://www.googleapis.com/books/v1/volumes';

// DOM Elements
const searchInput = document.getElementById('searchInput');
const searchButton = document.getElementById('searchButton');
const resultsContainer = document.getElementById('results');
const menuToggle = document.querySelector('.menu-toggle');
const navLinks = document.querySelector('.nav-links');

// Initialize Google Books API
function initialize() {
    console.log('Initializing Google Books API...');
    google.books.load();
    console.log('Google Books API loaded');
}

// Call initialize when the API is ready
google.books.setOnLoadCallback(initialize);

// Mobile Menu Toggle
if (menuToggle && navLinks) {
    menuToggle.addEventListener('click', () => {
        navLinks.classList.toggle('active');
    });
}

// Event Listeners
if (searchButton) {
    searchButton.addEventListener('click', searchBooks);
}

if (searchInput) {
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            searchBooks();
        }
    });
}

// Search Books Function
async function searchBooks() {
    if (!searchInput || !resultsContainer) return;

    const query = searchInput.value.trim();
    if (!query) return;

    try {
        // Show loading state
        resultsContainer.innerHTML = '<div class="loading">Searching for books...</div>';

        const response = await fetch(`${API_URL}?q=${encodeURIComponent(query)}&key=${API_KEY}`);
        const data = await response.json();
        
        if (!data.items || data.items.length === 0) {
            resultsContainer.innerHTML = '<p class="no-results">No books found. Try a different search term.</p>';
            return;
        }

        displayResults(data.items);
    } catch (error) {
        console.error('Error fetching books:', error);
        resultsContainer.innerHTML = '<p class="error">Error fetching books. Please try again.</p>';
    }
}

// Display Results Function
function displayResults(books) {
    if (!resultsContainer) return;

    resultsContainer.innerHTML = books.map(book => {
        const volumeInfo = book.volumeInfo;
        const thumbnail = volumeInfo.imageLinks?.thumbnail || 'https://via.placeholder.com/150x200?text=No+Cover';
        const authors = volumeInfo.authors?.join(', ') || 'Unknown Author';
        const description = volumeInfo.description || 'No description available';
        const isbn = volumeInfo.industryIdentifiers?.[0]?.identifier || '';
        const publishedDate = volumeInfo.publishedDate || 'Unknown';
        const pageCount = volumeInfo.pageCount || 'Unknown';

        return `
            <div class="book-card">
                <img src="${thumbnail}" alt="${volumeInfo.title}" class="book-cover">
                <h2 class="book-title">${volumeInfo.title}</h2>
                <p class="book-authors">${authors}</p>
                <p class="book-meta">Published: ${publishedDate} | Pages: ${pageCount}</p>
                <p class="book-description">${description}</p>
                <button class="read-more" onclick="navigateToPreview('${isbn}')">
                    <i class="fas fa-book-open"></i> Read Preview
                </button>
            </div>
        `;
    }).join('');
}

// Navigate to Preview Page
function navigateToPreview(isbn) {
    if (!isbn) {
        alert('No preview available for this book.');
        return;
    }
    
    // Store the ISBN in localStorage
    localStorage.setItem('previewISBN', isbn);
    
    // Navigate to the preview page
    window.location.href = 'preview.html';
}

// Add loading and error styles
const style = document.createElement('style');
style.textContent = `
    .loading {
        text-align: center;
        padding: 2rem;
        font-size: 1.2rem;
        color: var(--primary-color);
    }
    
    .no-results, .error {
        text-align: center;
        padding: 2rem;
        font-size: 1.2rem;
        color: var(--accent-color);
    }
    
    .book-meta {
        color: #666;
        font-size: 0.8rem;
        margin-bottom: 1rem;
    }
`;
document.head.appendChild(style); 