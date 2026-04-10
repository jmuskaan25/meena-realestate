// ============================================
// Meena Real Estate - Homepage Logic
// ============================================

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getFirestore, collection, getDocs } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getAuth, signInWithPopup, signOut, onAuthStateChanged, GoogleAuthProvider } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

// ---- Firebase Init ----
let db = null;
let auth = null;
let currentUser = null;

try {
  const app = initializeApp(CONFIG.FIREBASE);
  db = getFirestore(app);
  auth = getAuth(app);
} catch (e) {
  console.warn('Firebase not configured yet.', e);
}

// ---- DOM Refs ----
const propertyGrid = document.getElementById('propertyGrid');
const emptyState = document.getElementById('emptyState');
const resultsCount = document.getElementById('resultsCount');
const loadMoreWrapper = document.getElementById('loadMoreWrapper');
const loadMoreBtn = document.getElementById('loadMoreBtn');
const toastContainer = document.getElementById('toastContainer');

// Auth refs
const signedInView = document.getElementById('signedInView');
const signedOutView = document.getElementById('signedOutView');
const userAvatar = document.getElementById('userAvatar');
const userName = document.getElementById('userName');
const userEmail = document.getElementById('userEmail');
const signOutLink = document.getElementById('signOutLink');
const headerSignInBtn = document.getElementById('headerSignInBtn');

// Filter refs
const filterCity = document.getElementById('filterCity');
const filterType = document.getElementById('filterType');
const filterListingType = document.getElementById('filterListingType');
const filterMinPrice = document.getElementById('filterMinPrice');
const filterMaxPrice = document.getElementById('filterMaxPrice');
const filterBedrooms = document.getElementById('filterBedrooms');
const searchBtn = document.getElementById('searchBtn');
const clearBtn = document.getElementById('clearBtn');
const sortBy = document.getElementById('sortBy');

// ---- State ----
let allProperties = [];
let filteredProperties = [];
let displayedCount = 0;
const PAGE_SIZE = 12;

// ---- Auth ----
if (sessionStorage.getItem('via_authed') === '1') {
  // Already authed - show signed-in state
}
if (sessionStorage.getItem('via_admin') === '1') {
  const adminLink = document.getElementById('adminLink');
  const adminLinkMobile = document.getElementById('adminLinkMobile');
  if (adminLink) adminLink.style.display = 'inline-flex';
  if (adminLinkMobile) adminLinkMobile.style.display = 'block';
}

if (auth) {
  onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (user) {
      sessionStorage.setItem('via_authed', '1');
      signedOutView.style.display = 'none';
      signedInView.style.display = 'flex';
      userAvatar.src = user.photoURL || '';
      const userAvatarLarge = document.getElementById('userAvatarLarge');
      if (userAvatarLarge) userAvatarLarge.src = user.photoURL || '';
      userName.textContent = user.displayName || 'User';
      if (userEmail) userEmail.textContent = user.email || '';
      if (sessionStorage.getItem('via_admin') === '1') {
        const adminLink = document.getElementById('adminLink');
        const adminLinkMobile = document.getElementById('adminLinkMobile');
        if (adminLink) adminLink.style.display = 'inline-flex';
        if (adminLinkMobile) adminLinkMobile.style.display = 'block';
      }
    } else {
      sessionStorage.removeItem('via_authed');
      signedOutView.style.display = 'block';
      signedInView.style.display = 'none';
    }
  });
}

// Header sign-in button
if (headerSignInBtn) {
  headerSignInBtn.addEventListener('click', async () => {
    if (!auth) { showToast('Firebase not initialized.', 'error'); return; }
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') {
        showToast(`Sign-in failed: ${err.message}`, 'error');
      }
    }
  });
}

// Sign out
if (signOutLink) {
  signOutLink.addEventListener('click', async () => {
    if (!auth) return;
    try {
      sessionStorage.removeItem('via_admin');
      await signOut(auth);
      showToast('Signed out.', 'info');
    } catch (err) {
      console.error('Sign-out error:', err);
    }
  });
}

// Profile dropdown
const profileDropdown = document.getElementById('profileDropdown');
if (userAvatar) {
  userAvatar.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!profileDropdown) return;
    const isOpen = profileDropdown.style.display === 'block';
    profileDropdown.style.display = isOpen ? 'none' : 'block';
  });
}
if (profileDropdown) {
  document.addEventListener('click', () => { profileDropdown.style.display = 'none'; });
  profileDropdown.addEventListener('click', (e) => e.stopPropagation());
}

// Mobile menu
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const mobileNav = document.getElementById('mobileNav');
if (mobileMenuBtn && mobileNav) {
  mobileMenuBtn.addEventListener('click', () => {
    const isOpen = mobileNav.style.display !== 'none';
    mobileNav.style.display = isOpen ? 'none' : 'flex';
    mobileMenuBtn.classList.toggle('open', !isOpen);
  });
}

// ---- Toast ----
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ---- Price Formatting ----
function formatPriceINR(num) {
  if (num == null) return '--';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(num);
}

function formatPriceShort(num) {
  if (num == null) return '';
  if (num >= 10000000) {
    return `${(num / 10000000).toFixed(2).replace(/\.?0+$/, '')} Cr`;
  } else if (num >= 100000) {
    return `${(num / 100000).toFixed(2).replace(/\.?0+$/, '')} Lac`;
  }
  return formatPriceINR(num);
}

// ---- Load Properties ----
async function loadProperties() {
  if (!db) {
    propertyGrid.innerHTML = '<p style="text-align:center;color:#9ca3af;padding:48px;">Firebase not configured. Please update config.js.</p>';
    return;
  }

  try {
    const snapshot = await getDocs(collection(db, 'properties'));
    allProperties = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.status === 'active') {
        allProperties.push({ id: doc.id, ...data });
      }
    });

    applyFiltersAndSort();
  } catch (err) {
    console.error('Error loading properties:', err);
    propertyGrid.innerHTML = '<p style="text-align:center;color:#ef4444;padding:48px;">Failed to load properties. Please refresh.</p>';
  }
}

// ---- Filter & Sort ----
function applyFiltersAndSort() {
  const city = filterCity.value.trim().toLowerCase();
  const type = filterType.value;
  const listingType = filterListingType.value;
  const minPrice = filterMinPrice.value ? Number(filterMinPrice.value) : 0;
  const maxPrice = filterMaxPrice.value ? Number(filterMaxPrice.value) : Infinity;
  const bedrooms = filterBedrooms.value;

  filteredProperties = allProperties.filter(p => {
    if (city && !(p.city || '').toLowerCase().includes(city)) return false;
    if (type && p.type !== type) return false;
    if (listingType && p.listingType !== listingType) return false;
    if (p.price < minPrice) return false;
    if (p.price > maxPrice) return false;
    if (bedrooms) {
      const bedroomVal = Number(bedrooms);
      if (bedroomVal === 4) {
        if ((p.bedrooms || 0) < 4) return false;
      } else {
        if ((p.bedrooms || 0) !== bedroomVal) return false;
      }
    }
    return true;
  });

  // Sort
  const sort = sortBy.value;
  if (sort === 'newest') {
    filteredProperties.sort((a, b) => {
      const ta = a.postedAt?.toDate?.() || new Date(0);
      const tb = b.postedAt?.toDate?.() || new Date(0);
      return tb - ta;
    });
  } else if (sort === 'price-low') {
    filteredProperties.sort((a, b) => (a.price || 0) - (b.price || 0));
  } else if (sort === 'price-high') {
    filteredProperties.sort((a, b) => (b.price || 0) - (a.price || 0));
  }

  displayedCount = 0;
  propertyGrid.innerHTML = '';
  renderMore();
}

// ---- Render Properties ----
function renderMore() {
  const batch = filteredProperties.slice(displayedCount, displayedCount + PAGE_SIZE);

  if (filteredProperties.length === 0) {
    emptyState.style.display = 'block';
    loadMoreWrapper.style.display = 'none';
    resultsCount.textContent = 'No properties found';
    return;
  }

  emptyState.style.display = 'none';

  batch.forEach(p => {
    const card = document.createElement('a');
    card.href = `listing.html?id=${p.id}`;
    card.className = 'property-card';

    const imgSrc = (p.images && p.images.length > 0) ? p.images[0] : 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" fill="%23e5e7eb"><rect width="400" height="300"/><text x="200" y="160" text-anchor="middle" fill="%239ca3af" font-size="48">🏠</text></svg>';
    const listingBadgeClass = p.listingType === 'Rent' ? 'badge-rent' : 'badge-sale';

    card.innerHTML = `
      <div class="card-image">
        <img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(p.title)}" loading="lazy">
        <span class="card-badge ${listingBadgeClass}">${escapeHtml(p.listingType || 'Sale')}</span>
        ${p.featured ? '<span class="card-featured">Featured</span>' : ''}
      </div>
      <div class="card-content">
        <div class="card-price">${formatPriceINR(p.price)} <span class="card-price-short">${formatPriceShort(p.price)}</span></div>
        <h3 class="card-title">${escapeHtml(p.title)}</h3>
        <p class="card-location">${escapeHtml(p.locality || '')}${p.locality && p.city ? ', ' : ''}${escapeHtml(p.city || '')}</p>
        <div class="card-stats">
          ${p.area ? `<span>${p.area} sq.ft.</span>` : ''}
          ${p.bedrooms ? `<span>${p.bedrooms} BHK</span>` : ''}
          ${p.bathrooms ? `<span>${p.bathrooms} Bath</span>` : ''}
        </div>
      </div>
    `;

    propertyGrid.appendChild(card);
  });

  displayedCount += batch.length;
  resultsCount.textContent = `${filteredProperties.length} propert${filteredProperties.length === 1 ? 'y' : 'ies'} found`;

  if (displayedCount < filteredProperties.length) {
    loadMoreWrapper.style.display = 'flex';
  } else {
    loadMoreWrapper.style.display = 'none';
  }
}

// ---- Event Listeners ----
searchBtn.addEventListener('click', applyFiltersAndSort);
sortBy.addEventListener('change', applyFiltersAndSort);
loadMoreBtn.addEventListener('click', renderMore);

clearBtn.addEventListener('click', () => {
  filterCity.value = '';
  filterType.value = '';
  filterListingType.value = '';
  filterMinPrice.value = '';
  filterMaxPrice.value = '';
  filterBedrooms.value = '';
  sortBy.value = 'newest';
  applyFiltersAndSort();
});

// Allow pressing Enter in city field to search
filterCity.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') applyFiltersAndSort();
});

// ---- Utility ----
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---- Init ----
loadProperties();
