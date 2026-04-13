// ============================================
// Meena Estate Agency - Listing Detail Page
// ============================================

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getFirestore, doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js';

// ---- Firebase Init ----
let db = null;
let functions = null;

try {
  const app = initializeApp(CONFIG.FIREBASE);
  db = getFirestore(app);
  functions = getFunctions(app);
} catch (e) {
  console.warn('Firebase not configured yet.', e);
}

// ---- Category detection ----
const RESIDENTIAL_TYPES = ['Flat/Apartment', 'Residential House', 'Villa', 'Builder Floor Apartment', 'Penthouse', 'Studio Apartment'];
const COMMERCIAL_TYPES = ['Commercial Office Space', 'Office in IT Park/SEZ', 'Commercial Shop', 'Commercial Showroom', 'Warehouse/Godown'];
const PLOT_TYPES = ['Residential Land/Plot', 'Commercial Land', 'Industrial Land', 'Agricultural Land', 'Farm House'];
const PG_TYPES = ['PG', 'Hostel'];

function getCategory(type) {
  if (!type) return '';
  if (RESIDENTIAL_TYPES.includes(type)) return 'residential';
  if (COMMERCIAL_TYPES.includes(type)) return 'commercial';
  if (PLOT_TYPES.includes(type)) return 'plot';
  if (PG_TYPES.includes(type)) return 'pg';
  // Legacy fallback
  if (type === 'Apartment' || type === 'House/Villa') return 'residential';
  if (type === 'Plot') return 'plot';
  if (type === 'Commercial') return 'commercial';
  if (type === 'PG/Hostel') return 'pg';
  return '';
}

// ---- DOM Refs ----
const listingLoading = document.getElementById('listingLoading');
const listingNotFound = document.getElementById('listingNotFound');
const listingDetail = document.getElementById('listingDetail');
const toastContainer = document.getElementById('toastContainer');

// ---- State ----
let propertyData = null;
let currentImageIndex = 0;

// ---- Get Property ID ----
const params = new URLSearchParams(window.location.search);
const propertyId = params.get('id');

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
  return '';
}

// ---- Load Property ----
async function loadProperty() {
  if (!db || !propertyId) {
    listingLoading.style.display = 'none';
    listingNotFound.style.display = 'block';
    return;
  }

  try {
    const docSnap = await getDoc(doc(db, 'properties', propertyId));

    if (!docSnap.exists()) {
      listingLoading.style.display = 'none';
      listingNotFound.style.display = 'block';
      return;
    }

    propertyData = { id: docSnap.id, ...docSnap.data() };
    renderProperty();
  } catch (err) {
    console.error('Error loading property:', err);
    listingLoading.style.display = 'none';
    listingNotFound.style.display = 'block';
    return;
  }

  // Increment view count (separate try-catch so it doesn't break the page)
  if (functions) {
    try {
      const incrementViewsFn = httpsCallable(functions, 'incrementViews');
      await incrementViewsFn({ propertyId });
    } catch (err) {
      console.warn('Could not increment views:', err);
    }
  }
}

// ---- Render Property ----
function renderProperty() {
  const p = propertyData;
  const category = p.category || getCategory(p.type);
  listingLoading.style.display = 'none';
  listingDetail.style.display = 'block';

  // Title
  document.title = `${p.title} - Meena Estate Agency`;
  document.getElementById('listingTitle').textContent = p.title || 'Untitled Property';

  // Badges
  const listingTypeBadge = document.getElementById('listingTypeBadge');
  listingTypeBadge.textContent = p.listingType || 'Sale';
  listingTypeBadge.className = `badge-listing-type ${p.listingType === 'Rent' ? 'badge-rent' : 'badge-sale'}`;
  document.getElementById('propertyTypeBadge').textContent = p.type || '';

  // Location
  document.getElementById('listingLocation').textContent = [p.locality, p.city, p.state].filter(Boolean).join(', ');

  // Price
  document.getElementById('listingPrice').textContent = formatPriceINR(p.price);
  const shortPrice = formatPriceShort(p.price);
  const priceShortEl = document.getElementById('listingPriceShort');
  if (shortPrice) {
    priceShortEl.textContent = shortPrice;
    priceShortEl.style.display = 'inline';
  } else {
    priceShortEl.style.display = 'none';
  }

  // Stats - dynamic based on category
  const statsContainer = document.getElementById('listingStats');
  statsContainer.innerHTML = '';

  function addStat(value, label) {
    if (!value && value !== 0) return;
    const div = document.createElement('div');
    div.className = 'stat-item';
    div.innerHTML = `<span class="stat-value">${escapeHtml(String(value))}</span><span class="stat-label">${escapeHtml(label)}</span>`;
    statsContainer.appendChild(div);
  }

  if (category === 'residential') {
    if (p.area) addStat(Number(p.area).toLocaleString('en-IN'), 'Sq. Ft.');
    if (p.bedrooms) addStat(p.bedrooms, 'Bedrooms');
    if (p.bathrooms) addStat(p.bathrooms, 'Bathrooms');
  } else if (category === 'commercial') {
    if (p.area) addStat(Number(p.area).toLocaleString('en-IN'), 'Sq. Ft.');
    if (p.washrooms) addStat(p.washrooms, 'Washrooms');
  } else if (category === 'plot') {
    const plotAreaVal = p.plotArea || p.area;
    if (plotAreaVal) addStat(Number(plotAreaVal).toLocaleString('en-IN'), 'Plot Area (Sq. Ft.)');
  } else if (category === 'pg') {
    if (p.sharing) addStat(p.sharing, 'Sharing');
  } else {
    // Legacy fallback
    if (p.area) addStat(Number(p.area).toLocaleString('en-IN'), 'Sq. Ft.');
    if (p.bedrooms) addStat(p.bedrooms, 'Bedrooms');
    if (p.bathrooms) addStat(p.bathrooms, 'Bathrooms');
  }
  addStat((p.views || 0) + 1, 'Views');

  // Description
  document.getElementById('listingDescription').textContent = p.description || 'No description provided.';

  // Details grid - dynamic based on category
  const detailsGrid = document.getElementById('detailsGrid');
  detailsGrid.innerHTML = '';

  function addDetail(label, value) {
    if (!value && value !== 0) return;
    const row = document.createElement('div');
    row.className = 'detail-row';
    row.innerHTML = `<span class="detail-label">${escapeHtml(label)}</span><span class="detail-value">${escapeHtml(String(value))}</span>`;
    detailsGrid.appendChild(row);
  }

  // Common location details
  addDetail('Address', p.address);
  addDetail('Locality', p.locality);
  addDetail('City', p.city);
  addDetail('State', p.state);

  // Category-specific details
  if (category === 'residential') {
    addDetail('Bedrooms', p.bedrooms);
    addDetail('Bathrooms', p.bathrooms);
    addDetail('Balconies', p.balconies);
    addDetail('Furnished Status', p.furnishedStatus);
    addDetail('Floor No', p.floorNo);
    addDetail('Total Floors', p.totalFloors);
    addDetail('Area', p.area ? `${Number(p.area).toLocaleString('en-IN')} sq ft` : '');
    addDetail('Construction Status', p.constructionStatus);
    addDetail('Available From', p.availableFrom);
  } else if (category === 'commercial') {
    addDetail('Washrooms', p.washrooms);
    addDetail('Pantry/Cafeteria', p.pantry);
    addDetail('Furnished Status', p.furnishedStatus);
    addDetail('Currently Leased Out', p.currentlyLeased);
    addDetail('Floor No', p.floorNo);
    addDetail('Total Floors', p.totalFloors);
    addDetail('Area', p.area ? `${Number(p.area).toLocaleString('en-IN')} sq ft` : '');
    addDetail('Construction Status', p.constructionStatus);
    addDetail('Available From', p.availableFrom);
  } else if (category === 'plot') {
    const plotAreaVal = p.plotArea || p.area;
    addDetail('Plot Area', plotAreaVal ? `${Number(plotAreaVal).toLocaleString('en-IN')} sq ft` : '');
    addDetail('Plot Length', p.plotLength ? `${p.plotLength} ft` : '');
    addDetail('Plot Breadth', p.plotBreadth ? `${p.plotBreadth} ft` : '');
    addDetail('Corner Plot', p.cornerPlot);
    addDetail('Open Sides', p.openSides);
    addDetail('Boundary Wall', p.boundaryWall);
    addDetail('Road Width', p.roadWidth ? `${p.roadWidth} meters` : '');
    addDetail('Available From', p.availableFrom);
  } else if (category === 'pg') {
    addDetail('Sharing', p.sharing);
    addDetail('Gender', p.gender);
    addDetail('Meals Included', p.mealsIncluded);
    addDetail('AC/Non-AC', p.acType);
    addDetail('Furnished Status', p.furnishedStatus);
    addDetail('Available From', p.availableFrom);
  } else {
    // Legacy fallback
    if (p.constructionStatus) addDetail('Construction Status', p.constructionStatus);
    if (p.area) addDetail('Area', `${Number(p.area).toLocaleString('en-IN')} sq ft`);
  }

  // Posted on
  const postedAtStr = p.postedAt?.toDate
    ? p.postedAt.toDate().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';
  addDetail('Posted On', postedAtStr);

  // Amenities
  if (p.amenities && p.amenities.length > 0) {
    document.getElementById('amenitiesSection').style.display = 'block';
    const list = document.getElementById('amenitiesList');
    list.innerHTML = p.amenities.map(a => `<span class="amenity-tag">${escapeHtml(a)}</span>`).join('');
  }

  // Brochure
  if (p.brochureUrl) {
    document.getElementById('brochureSection').style.display = 'block';
    document.getElementById('brochureLink').href = p.brochureUrl;
  }

  // Brokerage - zero for under construction
  const brokerageEl = document.getElementById('brokerageNotice');
  if (brokerageEl) {
    if (p.constructionStatus === 'Under Construction') {
      brokerageEl.innerHTML = '<strong>Zero Brokerage</strong> — No brokerage on under-construction properties.';
      brokerageEl.classList.add('brokerage-zero');
    } else {
      const pct = p.brokeragePercent != null ? p.brokeragePercent : 1;
      brokerageEl.innerHTML = `Brokerage: <strong>${pct}%</strong> on successful sale via Meena Estate Agency.`;
    }
  }

  // Sold banner
  if (p.status === 'sold') {
    document.getElementById('soldBanner').style.display = 'flex';
  }

  // Enquiry popup
  const enquiryTitle = document.getElementById('enquiryPropertyTitle');
  if (enquiryTitle) enquiryTitle.textContent = p.title || '';
  const enquiryWA = document.getElementById('enquiryWhatsApp');
  if (enquiryWA) enquiryWA.href = `https://wa.me/919967788889?text=${encodeURIComponent(`Hi, I'm interested in the property: ${p.title || ''}. Please share more details.`)}`;

  const enquireBtn = document.getElementById('enquireNowBtn');
  const enquiryPopup = document.getElementById('enquiryPopup');
  const enquiryClose = document.getElementById('enquiryPopupClose');
  if (enquireBtn && enquiryPopup) {
    enquireBtn.addEventListener('click', () => { enquiryPopup.style.display = 'flex'; });
    enquiryClose.addEventListener('click', () => { enquiryPopup.style.display = 'none'; });
    enquiryPopup.addEventListener('click', (e) => { if (e.target === enquiryPopup) enquiryPopup.style.display = 'none'; });
  }
  const sellerPhoto = document.getElementById('sellerPhoto');
  if (p.postedByPhotoURL) {
    sellerPhoto.src = p.postedByPhotoURL;
    sellerPhoto.style.display = 'block';
  } else {
    sellerPhoto.style.display = 'none';
  }

  // Gallery
  setupGallery(p.images || []);
}

// ---- Image Gallery ----
function setupGallery(images) {
  const mainImg = document.getElementById('galleryMainImg');
  const thumbs = document.getElementById('galleryThumbs');
  const prevBtn = document.getElementById('galleryPrev');
  const nextBtn = document.getElementById('galleryNext');

  if (images.length === 0) {
    mainImg.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" fill="%23e5e7eb"><rect width="800" height="500"/><text x="400" y="260" text-anchor="middle" fill="%239ca3af" font-size="64">No Images</text></svg>';
    prevBtn.style.display = 'none';
    nextBtn.style.display = 'none';
    return;
  }

  mainImg.src = images[0];
  currentImageIndex = 0;

  if (images.length <= 1) {
    prevBtn.style.display = 'none';
    nextBtn.style.display = 'none';
  }

  // Thumbnails
  thumbs.innerHTML = '';
  images.forEach((src, i) => {
    const thumb = document.createElement('img');
    thumb.src = src;
    thumb.alt = `Image ${i + 1}`;
    thumb.className = i === 0 ? 'thumb active' : 'thumb';
    thumb.addEventListener('click', () => {
      currentImageIndex = i;
      mainImg.src = images[i];
      thumbs.querySelectorAll('.thumb').forEach((t, j) => t.classList.toggle('active', j === i));
    });
    thumbs.appendChild(thumb);
  });

  prevBtn.addEventListener('click', () => {
    currentImageIndex = (currentImageIndex - 1 + images.length) % images.length;
    mainImg.src = images[currentImageIndex];
    thumbs.querySelectorAll('.thumb').forEach((t, j) => t.classList.toggle('active', j === currentImageIndex));
  });

  nextBtn.addEventListener('click', () => {
    currentImageIndex = (currentImageIndex + 1) % images.length;
    mainImg.src = images[currentImageIndex];
    thumbs.querySelectorAll('.thumb').forEach((t, j) => t.classList.toggle('active', j === currentImageIndex));
  });
}

// ---- Utility ----
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---- Init ----
loadProperty();
