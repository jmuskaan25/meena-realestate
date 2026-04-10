// ============================================
// Meena Real Estate - Post Property Page
// ============================================

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getFirestore, collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';
import { getAuth, signInWithPopup, signOut, onAuthStateChanged, GoogleAuthProvider } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

// ---- Firebase Init ----
let db = null;
let storage = null;
let auth = null;
let currentUser = null;

try {
  const app = initializeApp(CONFIG.FIREBASE);
  db = getFirestore(app);
  storage = getStorage(app);
  auth = getAuth(app);
} catch (e) {
  console.warn('Firebase not configured yet.', e);
}

// ---- DOM Refs ----
const toastContainer = document.getElementById('toastContainer');
const signInWall = document.getElementById('signInWall');
const wallSignInBtn = document.getElementById('wallSignInBtn');
const postForm = document.getElementById('postForm');
const postFormSection = document.getElementById('postFormSection');
const successSection = document.getElementById('successSection');
const submitBtn = document.getElementById('submitBtn');
const submitLoading = document.getElementById('submitLoading');
const imageInput = document.getElementById('imageInput');
const imageUploadArea = document.getElementById('imageUploadArea');
const uploadPlaceholder = document.getElementById('uploadPlaceholder');
const imagePreviews = document.getElementById('imagePreviews');

// Auth refs
const signedInView = document.getElementById('signedInView');
const signedOutView = document.getElementById('signedOutView');
const userAvatar = document.getElementById('userAvatar');
const userName = document.getElementById('userName');
const userEmail = document.getElementById('userEmail');
const signOutLink = document.getElementById('signOutLink');

// ---- State ----
let selectedFiles = [];
const MAX_IMAGES = 5;

// ---- Auth ----
if (sessionStorage.getItem('via_authed') === '1' && signInWall) {
  signInWall.style.display = 'none';
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
      if (signInWall) signInWall.style.display = 'none';
      if (signedOutView) signedOutView.style.display = 'none';
      signedInView.style.display = 'flex';
      userAvatar.src = user.photoURL || '';
      const userAvatarLarge = document.getElementById('userAvatarLarge');
      if (userAvatarLarge) userAvatarLarge.src = user.photoURL || '';
      userName.textContent = user.displayName || 'User';
      if (userEmail) userEmail.textContent = user.email || '';
    } else {
      sessionStorage.removeItem('via_authed');
      if (signInWall) signInWall.style.display = 'flex';
      if (signedOutView) signedOutView.style.display = 'block';
      signedInView.style.display = 'none';
    }
  });
}

// Wall sign-in
wallSignInBtn.addEventListener('click', async () => {
  if (!auth) { showToast('Firebase not initialized.', 'error'); return; }
  wallSignInBtn.disabled = true;
  wallSignInBtn.textContent = 'Signing in...';
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const result = await signInWithPopup(auth, provider);
    if (result.user) {
      sessionStorage.setItem('via_authed', '1');
      if (signInWall) signInWall.style.display = 'none';
    }
  } catch (err) {
    wallSignInBtn.disabled = false;
    wallSignInBtn.innerHTML = '<img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="20" alt="Google"> Continue with Google';
    if (err.code !== 'auth/popup-closed-by-user') {
      showToast(`Sign-in failed: ${err.message}`, 'error');
    }
  }
});

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
    profileDropdown.style.display = profileDropdown.style.display === 'block' ? 'none' : 'block';
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

// ---- Form Submit ----
postForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (!db || !storage) {
    showToast('Firebase not configured. Please update config.js.', 'error');
    return;
  }

  if (!currentUser) {
    showToast('Please sign in first.', 'error');
    return;
  }

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
      postedBy: currentUser.displayName || 'Anonymous',
      postedByEmail: currentUser.email || '',
      postedByPhone: phone,
      postedByPhotoURL: currentUser.photoURL || '',
      postedAt: serverTimestamp(),
      status: 'active',
      featured: false,
      brokeragePercent: 2,
      views: 0
    };

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
  renderImagePreviews();
});
