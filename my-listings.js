// ============================================
// Meena Estate Agency - My Listings Page
// ============================================

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getFirestore, collection, getDocs, doc, updateDoc, deleteDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// ---- Firebase Init ----
let db = null;

try {
  const app = initializeApp(CONFIG.FIREBASE);
  db = getFirestore(app);
} catch (e) {
  console.warn('Firebase not configured yet.', e);
}

// ---- DOM Refs ----
const toastContainer = document.getElementById('toastContainer');
const myListingsContent = document.getElementById('myListingsContent');
const emailLookupInput = document.getElementById('emailLookupInput');
const emailLookupBtn = document.getElementById('emailLookupBtn');

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

// ---- Email Lookup ----
emailLookupBtn.addEventListener('click', () => {
  const email = emailLookupInput.value.trim().toLowerCase();
  if (!email) {
    showToast('Please enter your email address.', 'error');
    return;
  }
  loadMyListings(email);
});

emailLookupInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    emailLookupBtn.click();
  }
});

// ---- Load My Listings ----
async function loadMyListings(email) {
  if (!db) {
    myListingsContent.innerHTML = '<p style="text-align:center;color:#8993a4;padding:48px;">Firebase not configured. Please update config.js.</p>';
    return;
  }

  myListingsContent.innerHTML = '<div class="listing-loading"><div class="scan-spinner"></div><p>Loading your listings...</p></div>';

  try {
    const snapshot = await getDocs(collection(db, 'properties'));
    const docs = [];
    snapshot.forEach(d => {
      const data = d.data();
      if ((data.postedByEmail || '').toLowerCase() === email) {
        docs.push({ id: d.id, ...data });
      }
    });

    docs.sort((a, b) => {
      const ta = a.postedAt?.toDate?.() || new Date(0);
      const tb = b.postedAt?.toDate?.() || new Date(0);
      return tb - ta;
    });

    if (docs.length === 0) {
      myListingsContent.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">🏘️</span>
          <p>No properties found for this email.</p>
          <a href="post.html" class="btn-primary" style="display:inline-flex;width:auto;margin-top:16px;">Post Your First Property</a>
        </div>`;
      return;
    }

    myListingsContent.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'my-listings-grid';

    docs.forEach(d => {
      const card = document.createElement('div');
      card.className = 'my-listing-card';

      const imgSrc = (d.images && d.images.length > 0) ? d.images[0] : 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" fill="%23e5e7eb"><rect width="400" height="300"/><text x="200" y="160" text-anchor="middle" fill="%239ca3af" font-size="48">🏠</text></svg>';
      const postedAt = d.postedAt?.toDate
        ? d.postedAt.toDate().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
        : '--';

      const statusBadgeClass = d.status === 'active' ? 'badge-active' : d.status === 'sold' ? 'badge-sold' : 'badge-inactive';

      card.innerHTML = `
        <div class="my-listing-image">
          <img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(d.title)}" loading="lazy">
          <span class="status-badge ${statusBadgeClass}">${escapeHtml(d.status || 'active')}</span>
        </div>
        <div class="my-listing-info">
          <h3><a href="listing.html?id=${escapeHtml(d.id)}">${escapeHtml(d.title)}</a></h3>
          <p class="my-listing-price">${formatPriceINR(d.price)}</p>
          <p class="my-listing-location">${escapeHtml(d.locality || '')}${d.locality && d.city ? ', ' : ''}${escapeHtml(d.city || '')}</p>
          <div class="my-listing-meta">
            <span>Posted: ${escapeHtml(postedAt)}</span>
            <span>Views: ${d.views || 0}</span>
          </div>
          <div class="my-listing-actions">
            ${d.status === 'active' ? `<button class="btn-small btn-deactivate" data-id="${escapeHtml(d.id)}">Mark Inactive</button>` : ''}
            ${d.status === 'inactive' ? `<button class="btn-small btn-activate" data-id="${escapeHtml(d.id)}">Mark Active</button>` : ''}
            <button class="btn-small btn-delete" data-id="${escapeHtml(d.id)}">Delete</button>
          </div>
        </div>
      `;

      grid.appendChild(card);
    });

    myListingsContent.appendChild(grid);

    // Attach action listeners
    grid.querySelectorAll('.btn-deactivate').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        btn.disabled = true;
        btn.textContent = 'Updating...';
        try {
          await updateDoc(doc(db, 'properties', id), { status: 'inactive' });
          showToast('Property marked as inactive.', 'success');
          loadMyListings(email);
        } catch (err) {
          showToast(`Failed: ${err.message}`, 'error');
          btn.disabled = false;
          btn.textContent = 'Mark Inactive';
        }
      });
    });

    grid.querySelectorAll('.btn-activate').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        btn.disabled = true;
        btn.textContent = 'Updating...';
        try {
          await updateDoc(doc(db, 'properties', id), { status: 'active' });
          showToast('Property marked as active.', 'success');
          loadMyListings(email);
        } catch (err) {
          showToast(`Failed: ${err.message}`, 'error');
          btn.disabled = false;
          btn.textContent = 'Mark Active';
        }
      });
    });

    grid.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Are you sure you want to delete this listing? This cannot be undone.')) return;
        const id = btn.dataset.id;
        btn.disabled = true;
        btn.textContent = 'Deleting...';
        try {
          await deleteDoc(doc(db, 'properties', id));
          showToast('Property deleted.', 'success');
          loadMyListings(email);
        } catch (err) {
          showToast(`Failed: ${err.message}`, 'error');
          btn.disabled = false;
          btn.textContent = 'Delete';
        }
      });
    });

  } catch (err) {
    console.error('Error loading listings:', err);
    myListingsContent.innerHTML = '<p style="text-align:center;color:#ef4444;padding:48px;">Failed to load. Please refresh.</p>';
  }
}

// ---- Utility ----
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
