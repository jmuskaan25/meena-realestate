// ============================================
// Meena Estate Agency - Send Requirement Page
// ============================================
// NOTE: This form does NOT require Google sign-in.
// Firestore security rules must allow unauthenticated writes
// to the 'requirements' collection for this to work.

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getFirestore, collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// ---- Firebase Init ----
let db = null;

try {
  const app = initializeApp(CONFIG.FIREBASE);
  db = getFirestore(app);
} catch (e) {
  console.warn('Firebase not configured yet.', e);
}

// ---- Property Type Category Mapping ----
const RESIDENTIAL_TYPES = ['Flat/Apartment', 'Residential House', 'Villa', 'Builder Floor Apartment', 'Penthouse', 'Studio Apartment'];

function isResidential(type) {
  return RESIDENTIAL_TYPES.includes(type);
}

// ---- DOM Refs ----
const toastContainer = document.getElementById('toastContainer');
const requirementForm = document.getElementById('requirementForm');
const formSection = document.getElementById('requirementFormSection');
const successSection = document.getElementById('successSection');
const submitBtn = document.getElementById('submitBtn');
const sendAnotherBtn = document.getElementById('sendAnotherBtn');
const whatsappSuccessBtn = document.getElementById('whatsappSuccessBtn');
const propertyTypeSelect = document.getElementById('reqPropertyType');
const bedroomsSection = document.getElementById('bedroomsSection');

// ---- Mobile Menu ----
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
function showToast(msg, type = 'info') {
  if (!toastContainer) return;
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  toastContainer.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

// ---- Show/Hide Bedrooms based on Property Type ----
if (propertyTypeSelect) {
  propertyTypeSelect.addEventListener('change', () => {
    const val = propertyTypeSelect.value;
    if (bedroomsSection) {
      bedroomsSection.style.display = (val === '' || isResidential(val)) ? 'block' : 'none';
    }
  });
  // Initial state: show bedrooms (default is "Any Type" which could be residential)
  if (bedroomsSection) {
    bedroomsSection.style.display = 'none';
  }
}

// ---- Form Submission ----
if (requirementForm) {
  requirementForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!db) {
      showToast('Firebase not configured. Please try later.', 'error');
      return;
    }

    // Validate phone
    const phone = document.getElementById('reqPhone').value.trim();
    if (!/^[0-9]{10}$/.test(phone)) {
      showToast('Please enter a valid 10-digit phone number.', 'error');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';

    try {
      const name = document.getElementById('reqName').value.trim();
      const email = document.getElementById('reqEmail').value.trim();
      const propertyType = document.getElementById('reqPropertyType').value;
      const lookingTo = document.getElementById('reqLookingTo').value;
      const city = document.getElementById('reqCity').value.trim();
      const locality = document.getElementById('reqLocality').value.trim();
      const minBudget = document.getElementById('reqMinBudget').value ? Number(document.getElementById('reqMinBudget').value) : null;
      const maxBudget = document.getElementById('reqMaxBudget').value ? Number(document.getElementById('reqMaxBudget').value) : null;
      const bedrooms = document.getElementById('reqBedrooms').value;
      const additional = document.getElementById('reqAdditional').value.trim();

      const data = {
        name,
        phone,
        email: email || null,
        propertyType: propertyType || null,
        lookingTo,
        city,
        locality: locality || null,
        minBudget,
        maxBudget,
        bedrooms: bedrooms || null,
        additionalRequirements: additional || null,
        status: 'new',
        submittedAt: serverTimestamp()
      };

      await addDoc(collection(db, 'requirements'), data);

      // Update WhatsApp success button
      const waText = encodeURIComponent(`Hi, I just submitted a property requirement on your website. My name is ${name}.`);
      whatsappSuccessBtn.href = `https://wa.me/919967788889?text=${waText}`;

      // Show success, hide form
      formSection.style.display = 'none';
      document.querySelector('.whatsapp-note').style.display = 'none';
      successSection.style.display = 'block';
      window.scrollTo({ top: 0, behavior: 'smooth' });

      showToast('Requirement submitted successfully!', 'success');
    } catch (err) {
      console.error('Error submitting requirement:', err);
      showToast('Failed to submit. Please try again.', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Send Requirement';
    }
  });
}

// ---- Send Another ----
if (sendAnotherBtn) {
  sendAnotherBtn.addEventListener('click', () => {
    successSection.style.display = 'none';
    formSection.style.display = 'block';
    document.querySelector('.whatsapp-note').style.display = 'block';
    requirementForm.reset();
    // Reset bedrooms visibility
    if (bedroomsSection) {
      bedroomsSection.style.display = 'none';
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}
