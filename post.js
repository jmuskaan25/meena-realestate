// ============================================
// Meena Estate Agency - Post Property Page
// ============================================
// NOTE: This form does NOT require Google sign-in.
// Firestore security rules must allow unauthenticated writes
// to the 'properties' collection for this to work.
// Firebase Storage rules must also allow unauthenticated uploads
// to the 'properties/' and 'brochures/' paths.

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getFirestore, collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';

// ---- Firebase Init ----
let db = null;
let storage = null;

try {
  const app = initializeApp(CONFIG.FIREBASE);
  db = getFirestore(app);
  storage = getStorage(app);
} catch (e) {
  console.warn('Firebase not configured yet.', e);
}

// ---- DOM Refs ----
const toastContainer = document.getElementById('toastContainer');
const postForm = document.getElementById('postForm');
const postFormSection = document.getElementById('postFormSection');
const successSection = document.getElementById('successSection');
const submitBtn = document.getElementById('submitBtn');
const submitLoading = document.getElementById('submitLoading');
const imageInput = document.getElementById('imageInput');
const imageUploadArea = document.getElementById('imageUploadArea');
const uploadPlaceholder = document.getElementById('uploadPlaceholder');
const imagePreviews = document.getElementById('imagePreviews');

// Brochure refs
const brochureUpload = document.getElementById('brochureUpload');
const brochurePreview = document.getElementById('brochurePreview');
const brochureName = document.getElementById('brochureName');
const brochureRemove = document.getElementById('brochureRemove');

// ---- State ----
let selectedFiles = [];
let selectedBrochure = null;
const MAX_IMAGES = 5;

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

// ---- Image Upload ----
uploadPlaceholder.addEventListener('click', () => imageInput.click());
imageUploadArea.addEventListener('dragover', (e) => {
  e.preventDefault();
  imageUploadArea.classList.add('drag-over');
});
imageUploadArea.addEventListener('dragleave', () => imageUploadArea.classList.remove('drag-over'));
imageUploadArea.addEventListener('drop', (e) => {
  e.preventDefault();
  imageUploadArea.classList.remove('drag-over');
  handleImageFiles(e.dataTransfer.files);
});

imageInput.addEventListener('change', (e) => {
  handleImageFiles(e.target.files);
  imageInput.value = '';
});

function handleImageFiles(fileList) {
  const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
  const files = Array.from(fileList).filter(f => validTypes.includes(f.type));

  if (files.length === 0) {
    showToast('Please select JPG, PNG, or WebP images.', 'error');
    return;
  }

  if (selectedFiles.length + files.length > MAX_IMAGES) {
    showToast(`Maximum ${MAX_IMAGES} images allowed.`, 'error');
    return;
  }

  files.forEach(file => {
    if (file.size > 10 * 1024 * 1024) {
      showToast(`${file.name} is too large (max 10MB).`, 'error');
      return;
    }
    selectedFiles.push(file);
  });

  renderImagePreviews();
}

function renderImagePreviews() {
  imagePreviews.innerHTML = '';

  if (selectedFiles.length > 0) {
    uploadPlaceholder.style.display = 'none';
  } else {
    uploadPlaceholder.style.display = 'flex';
    return;
  }

  selectedFiles.forEach((file, index) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'image-preview-item';

    const img = document.createElement('img');
    img.src = URL.createObjectURL(file);
    img.alt = file.name;

    const removeBtn = document.createElement('button');
    removeBtn.className = 'image-remove-btn';
    removeBtn.textContent = 'x';
    removeBtn.type = 'button';
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      selectedFiles.splice(index, 1);
      renderImagePreviews();
    });

    if (index === 0) {
      const coverLabel = document.createElement('span');
      coverLabel.className = 'cover-label';
      coverLabel.textContent = 'Cover';
      wrapper.appendChild(coverLabel);
    }

    wrapper.appendChild(img);
    wrapper.appendChild(removeBtn);
    imagePreviews.appendChild(wrapper);
  });

  // Add more button if under limit
  if (selectedFiles.length < MAX_IMAGES) {
    const addMore = document.createElement('button');
    addMore.className = 'image-add-more';
    addMore.type = 'button';
    addMore.innerHTML = '<span>+</span><span>Add More</span>';
    addMore.addEventListener('click', () => imageInput.click());
    imagePreviews.appendChild(addMore);
  }
}

// ---- Brochure Upload ----
brochureUpload.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (file.type !== 'application/pdf') {
    showToast('Only PDF files are allowed for brochure.', 'error');
    brochureUpload.value = '';
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    showToast('Brochure file is too large (max 10MB).', 'error');
    brochureUpload.value = '';
    return;
  }
  selectedBrochure = file;
  brochureName.textContent = file.name;
  brochurePreview.style.display = 'flex';
});

brochureRemove.addEventListener('click', () => {
  selectedBrochure = null;
  brochureUpload.value = '';
  brochurePreview.style.display = 'none';
  brochureName.textContent = '';
});

// ---- Form Submit ----
postForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (!db || !storage) {
    showToast('Firebase not configured. Please update config.js.', 'error');
    return;
  }

  const posterName = document.getElementById('posterName').value.trim();
  const posterPhone = document.getElementById('posterPhone').value.trim();
  const posterEmail = document.getElementById('posterEmail').value.trim();
  const title = document.getElementById('propTitle').value.trim();
  const type = document.getElementById('propType').value;
  const listingType = document.getElementById('propListingType').value;
  const price = parseFloat(document.getElementById('propPrice').value);
  const area = parseFloat(document.getElementById('propArea').value);
  const bedrooms = parseInt(document.getElementById('propBedrooms').value) || 0;
  const bathrooms = parseInt(document.getElementById('propBathrooms').value) || 0;
  const city = document.getElementById('propCity').value.trim();
  const locality = document.getElementById('propLocality').value.trim();
  const state = document.getElementById('propState').value.trim();
  const address = document.getElementById('propAddress').value.trim();
  const description = document.getElementById('propDescription').value.trim();
  const phone = document.getElementById('propPhone').value.trim();

  // Validation
  if (!posterName || !posterPhone || !posterEmail) {
    showToast('Please fill in your name, phone, and email.', 'error');
    return;
  }

  if (!title || !type || !listingType || !price || !area || !city || !locality || !state || !address || !description || !phone) {
    showToast('Please fill in all required fields.', 'error');
    return;
  }

  if (!/^[0-9]{10}$/.test(phone)) {
    showToast('Please enter a valid 10-digit phone number.', 'error');
    return;
  }

  // Collect amenities
  const amenities = [];
  document.querySelectorAll('#amenitiesGrid input[type="checkbox"]:checked').forEach(cb => {
    amenities.push(cb.value);
  });

  submitBtn.disabled = true;
  submitLoading.style.display = 'flex';

  try {
    // Upload images
    const imageUrls = [];
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      const timestamp = Date.now();
      const storageRef = ref(storage, `properties/${timestamp}_${i}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      imageUrls.push(url);
    }

    // Upload brochure if selected
    let brochureUrl = null;
    if (selectedBrochure) {
      const timestamp = Date.now();
      const brochureRef = ref(storage, `brochures/${timestamp}_${selectedBrochure.name}`);
      await uploadBytes(brochureRef, selectedBrochure);
      brochureUrl = await getDownloadURL(brochureRef);
    }

    // Save to Firestore
    const docData = {
      title,
      type,
      listingType,
      price,
      area,
      bedrooms,
      bathrooms,
      city,
      locality,
      state,
      address,
      description,
      amenities,
      images: imageUrls,
      postedBy: posterName,
      postedByPhone: posterPhone,
      postedByEmail: posterEmail,
      postedAt: serverTimestamp(),
      status: 'active',
      featured: false,
      brokeragePercent: 1,
      views: 0
    };

    if (brochureUrl) {
      docData.brochureUrl = brochureUrl;
    }

    await addDoc(collection(db, 'properties'), docData);

    // Show success
    postFormSection.style.display = 'none';
    successSection.style.display = 'block';
    showToast('Property posted successfully!', 'success');

  } catch (err) {
    console.error('Submit error:', err);
    showToast(`Failed to post property: ${err.message}`, 'error');
  } finally {
    submitBtn.disabled = false;
    submitLoading.style.display = 'none';
  }
});

// ---- Post Another ----
document.getElementById('postAnotherBtn').addEventListener('click', () => {
  successSection.style.display = 'none';
  postFormSection.style.display = 'block';
  postForm.reset();
  selectedFiles = [];
  selectedBrochure = null;
  brochurePreview.style.display = 'none';
  brochureName.textContent = '';
  renderImagePreviews();
});
