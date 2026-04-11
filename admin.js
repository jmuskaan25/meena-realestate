// ============================================
// Meena Estate Agency - Admin Panel
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
const adminBody = document.getElementById('adminBody');
const toastContainer = document.getElementById('toastContainer');
const signInWall = document.getElementById('signInWall');
const adminPasswordInput = document.getElementById('adminPasswordInput');
const adminLoginBtn = document.getElementById('adminLoginBtn');

// ---- Admin Password Gate ----
// Hide wall if already authed as admin in this session
if (sessionStorage.getItem('via_admin') === '1' && signInWall) {
  signInWall.style.display = 'none';
  loadAllListings();
}

adminLoginBtn.addEventListener('click', () => {
  if (!adminPasswordInput || adminPasswordInput.value !== 'admin') {
    showToast('Incorrect admin password.', 'error');
    return;
  }
  sessionStorage.setItem('via_admin', '1');
  if (signInWall) signInWall.style.display = 'none';
  loadAllListings();
});

adminPasswordInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    adminLoginBtn.click();
  }
});

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
function formatPriceShort(num) {
  if (num == null) return '--';
  if (num >= 10000000) {
    return `${(num / 10000000).toFixed(2).replace(/\.?0+$/, '')} Cr`;
  } else if (num >= 100000) {
    return `${(num / 100000).toFixed(2).replace(/\.?0+$/, '')} Lac`;
  }
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(num);
}

// ---- Load All Listings ----
async function loadAllListings() {
  if (!db) return;

  adminBody.innerHTML = '<tr><td colspan="11" style="text-align:center;padding:32px;color:#9ca3af;">Loading...</td></tr>';

  try {
    const snapshot = await getDocs(collection(db, 'properties'));

    if (snapshot.empty) {
      adminBody.innerHTML = '<tr><td colspan="11"><div class="empty-state"><span class="empty-icon">📭</span><p>No listings yet.</p></div></td></tr>';
      return;
    }

    const docs = [];
    snapshot.forEach(d => docs.push({ id: d.id, ...d.data() }));
    docs.sort((a, b) => {
      const ta = a.postedAt?.toDate?.() || new Date(0);
      const tb = b.postedAt?.toDate?.() || new Date(0);
      return tb - ta;
    });

    // Update stats
    const total = docs.length;
    const active = docs.filter(d => d.status === 'active').length;
    const sold = docs.filter(d => d.status === 'sold').length;
    const inactive = docs.filter(d => d.status === 'inactive').length;
    document.getElementById('statTotal').textContent = total;
    document.getElementById('statActive').textContent = active;
    document.getElementById('statSold').textContent = sold;
    document.getElementById('statInactive').textContent = inactive;

    adminBody.innerHTML = '';
    docs.forEach(d => {
      const tr = document.createElement('tr');

      const postedAt = d.postedAt?.toDate
        ? d.postedAt.toDate().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
        : '--';

      const status = d.status || 'active';

      tr.innerHTML = `
        <td style="white-space:nowrap;">${escapeHtml(postedAt)}</td>
        <td><a href="listing.html?id=${escapeHtml(d.id)}" style="color:#1a365d;font-weight:500;">${escapeHtml(d.title || '--')}</a></td>
        <td>${escapeHtml(d.type || '--')}</td>
        <td><strong>${escapeHtml(formatPriceShort(d.price))}</strong></td>
        <td>${escapeHtml(d.city || '--')}</td>
        <td>${escapeHtml(d.postedBy || '--')}</td>
        <td>${d.views || 0}</td>
        <td>
          <select class="status-select status-${escapeHtml(status)}" data-doc-id="${escapeHtml(d.id)}" data-current="${escapeHtml(status)}">
            <option value="active" ${status === 'active' ? 'selected' : ''}>Active</option>
            <option value="sold" ${status === 'sold' ? 'selected' : ''}>Sold</option>
            <option value="inactive" ${status === 'inactive' ? 'selected' : ''}>Inactive</option>
          </select>
        </td>
        <td>
          <label class="toggle-switch">
            <input type="checkbox" class="featured-toggle" data-doc-id="${escapeHtml(d.id)}" ${d.featured ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </td>
        <td>
          <input type="number" class="brokerage-input" data-doc-id="${escapeHtml(d.id)}" value="${d.brokeragePercent != null ? d.brokeragePercent : 1}" min="0" max="100" step="0.5">
        </td>
        <td>
          <button class="btn-small btn-delete-admin" data-doc-id="${escapeHtml(d.id)}">Delete</button>
        </td>
      `;

      adminBody.appendChild(tr);
    });

    // Status change listeners
    adminBody.querySelectorAll('.status-select').forEach(select => {
      select.addEventListener('change', async (e) => {
        const docId = e.target.dataset.docId;
        const newStatus = e.target.value;
        const oldStatus = e.target.dataset.current;
        if (newStatus === oldStatus) return;

        e.target.disabled = true;
        try {
          await updateDoc(doc(db, 'properties', docId), { status: newStatus });
          e.target.dataset.current = newStatus;
          e.target.className = `status-select status-${newStatus}`;
          showToast(`Status updated to ${newStatus}`, 'success');
          // Update stats
          loadAllListings();
        } catch (err) {
          e.target.value = oldStatus;
          showToast(`Failed: ${err.message}`, 'error');
        } finally {
          e.target.disabled = false;
        }
      });
    });

    // Featured toggle listeners
    adminBody.querySelectorAll('.featured-toggle').forEach(toggle => {
      toggle.addEventListener('change', async (e) => {
        const docId = e.target.dataset.docId;
        const featured = e.target.checked;
        e.target.disabled = true;
        try {
          await updateDoc(doc(db, 'properties', docId), { featured });
          showToast(featured ? 'Marked as featured' : 'Removed from featured', 'success');
        } catch (err) {
          e.target.checked = !featured;
          showToast(`Failed: ${err.message}`, 'error');
        } finally {
          e.target.disabled = false;
        }
      });
    });

    // Brokerage change listeners
    adminBody.querySelectorAll('.brokerage-input').forEach(input => {
      input.addEventListener('change', async (e) => {
        const docId = e.target.dataset.docId;
        const val = parseFloat(e.target.value);
        if (isNaN(val) || val < 0 || val > 100) {
          showToast('Invalid brokerage value.', 'error');
          return;
        }
        e.target.disabled = true;
        try {
          await updateDoc(doc(db, 'properties', docId), { brokeragePercent: val });
          showToast(`Brokerage updated to ${val}%`, 'success');
        } catch (err) {
          showToast(`Failed: ${err.message}`, 'error');
        } finally {
          e.target.disabled = false;
        }
      });
    });

    // Delete listeners
    adminBody.querySelectorAll('.btn-delete-admin').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Are you sure you want to delete this listing?')) return;
        const docId = btn.dataset.docId;
        btn.disabled = true;
        btn.textContent = '...';
        try {
          await deleteDoc(doc(db, 'properties', docId));
          showToast('Listing deleted.', 'success');
          loadAllListings();
        } catch (err) {
          showToast(`Failed: ${err.message}`, 'error');
          btn.disabled = false;
          btn.textContent = 'Delete';
        }
      });
    });

  } catch (err) {
    console.error('Error loading listings:', err);
    adminBody.innerHTML = '<tr><td colspan="11" style="text-align:center;padding:32px;color:#ef4444;">Failed to load. Please refresh.</td></tr>';
  }
}

// ---- Utility ----
function escapeHtml(str) {
  if (str == null) return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}
