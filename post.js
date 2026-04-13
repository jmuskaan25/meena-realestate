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

// ---- Property Type Category Mapping ----
const RESIDENTIAL_TYPES = ['Flat/Apartment', 'Residential House', 'Villa', 'Builder Floor Apartment', 'Penthouse', 'Studio Apartment'];
const COMMERCIAL_TYPES = ['Commercial Office Space', 'Office in IT Park/SEZ', 'Commercial Shop', 'Commercial Showroom', 'Warehouse/Godown'];
const PLOT_TYPES = ['Residential Land/Plot', 'Commercial Land', 'Industrial Land', 'Agricultural Land', 'Farm House'];
const PG_TYPES = ['PG', 'Hostel'];

function getCategory(type) {
  if (RESIDENTIAL_TYPES.includes(type)) return 'residential';
  if (COMMERCIAL_TYPES.includes(type)) return 'commercial';
  if (PLOT_TYPES.includes(type)) return 'plot';
  if (PG_TYPES.includes(type)) return 'pg';
  return '';
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
const propTypeSelect = document.getElementById('propType');

// Feature sections
const featuresResidential = document.getElementById('featuresResidential');
const featuresCommercial = document.getElementById('featuresCommercial');
const featuresPlot = document.getElementById('featuresPlot');
const featuresPG = document.getElementById('featuresPG');
const allFeatureSections = [featuresResidential, featuresCommercial, featuresPlot, featuresPG];

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

// ---- Property Type Change Handler ----
propTypeSelect.addEventListener('change', () => {
  const category = getCategory(propTypeSelect.value);

  // Hide all feature sections and disable their required fields
  allFeatureSections.forEach(section => {
    section.style.display = 'none';
    section.querySelectorAll('[required]').forEach(el => el.disabled = true);
  });

  // Show the relevant section and enable its required fields
  let activeSection = null;
  if (category === 'residential') activeSection = featuresResidential;
  else if (category === 'commercial') activeSection = featuresCommercial;
  else if (category === 'plot') activeSection = featuresPlot;
  else if (category === 'pg') activeSection = featuresPG;

  if (activeSection) {
    activeSection.style.display = 'block';
    activeSection.querySelectorAll('[required]').forEach(el => el.disabled = false);
  }
});

// Initialize: disable all hidden section required fields
allFeatureSections.forEach(section => {
  section.querySelectorAll('[required]').forEach(el => el.disabled = true);
});

// ---- "Other" option handler for dropdowns ----
function getSelectValue(selectId) {
  const select = document.getElementById(selectId);
  if (!select) return '';
  if (select.value === 'Other') {
    const otherInput = document.getElementById(selectId + 'Other');
    return otherInput ? otherInput.value.trim() : '';
  }
  return select.value;
}

document.querySelectorAll('select').forEach(select => {
  const otherId = select.id + 'Other';
  const otherInput = document.getElementById(otherId);
  if (!otherInput) return;
  select.addEventListener('change', () => {
    if (select.value === 'Other') {
      otherInput.style.display = 'block';
      otherInput.focus();
    } else {
      otherInput.style.display = 'none';
      otherInput.value = '';
    }
  });
});

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
    if (file.size > 20 * 1024 * 1024) {
      showToast(`${file.name} is too large (max 20MB).`, 'error');
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
  if (file.size > 20 * 1024 * 1024) {
    showToast('Brochure file is too large (max 20MB).', 'error');
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

// ---- Helper: build availableFrom string ----
function buildAvailableFrom(monthId, yearId) {
  const month = document.getElementById(monthId).value;
  const year = document.getElementById(yearId).value;
  if (month === 'Immediately') return 'Immediately';
  if (month && year) return `${month} ${year}`;
  if (month) return month;
  return '';
}

// ---- Helper: collect checked amenities from a grid ----
function collectAmenities(gridId) {
  const amenities = [];
  document.querySelectorAll(`#${gridId} input[type="checkbox"]:checked`).forEach(cb => {
    amenities.push(cb.value);
  });
  return amenities;
}

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

  if (!title || !type || !listingType || !price || !city || !locality || !state || !address || !description || !phone) {
    showToast('Please fill in all required fields.', 'error');
    return;
  }

  if (!/^[0-9]{10}$/.test(phone)) {
    showToast('Please enter a valid 10-digit phone number.', 'error');
    return;
  }

  const category = getCategory(type);

  // Build docData based on category
  const docData = {
    title,
    type,
    category,
    listingType,
    price,
    city,
    locality,
    state,
    address,
    description,
    contactPhone: phone,
    postedBy: posterName,
    postedByPhone: posterPhone,
    postedByEmail: posterEmail,
    postedAt: serverTimestamp(),
    status: 'active',
    featured: false,
    brokeragePercent: 1,
    views: 0
  };

  // Category-specific fields
  if (category === 'residential') {
    docData.bedrooms = getSelectValue('resBedrooms');
    docData.bathrooms = getSelectValue('resBathrooms');
    docData.balconies = getSelectValue('resBalconies');
    docData.furnishedStatus = document.getElementById('resFurnished').value;
    docData.floorNo = document.getElementById('resFloorNo').value || '';
    docData.totalFloors = document.getElementById('resTotalFloors').value || '';
    docData.area = parseFloat(document.getElementById('resArea').value) || 0;
    docData.constructionStatus = document.getElementById('resConstructionStatus').value;
    docData.availableFrom = buildAvailableFrom('resAvailMonth', 'resAvailYear');
    docData.amenities = collectAmenities('amenitiesResidential');
  } else if (category === 'commercial') {
    docData.washrooms = getSelectValue('comWashrooms');
    docData.pantry = document.getElementById('comPantry').value;
    docData.furnishedStatus = document.getElementById('comFurnished').value;
    docData.currentlyLeased = document.getElementById('comCurrentlyLeased').value;
    docData.floorNo = document.getElementById('comFloorNo').value || '';
    docData.totalFloors = document.getElementById('comTotalFloors').value || '';
    docData.area = parseFloat(document.getElementById('comArea').value) || 0;
    docData.constructionStatus = document.getElementById('comConstructionStatus').value;
    docData.availableFrom = buildAvailableFrom('comAvailMonth', 'comAvailYear');
    docData.amenities = collectAmenities('amenitiesCommercial');
  } else if (category === 'plot') {
    docData.plotArea = parseFloat(document.getElementById('plotArea').value) || 0;
    docData.area = docData.plotArea; // also store as area for card display
    docData.plotLength = document.getElementById('plotLength').value || '';
    docData.plotBreadth = document.getElementById('plotBreadth').value || '';
    docData.cornerPlot = document.getElementById('plotCorner').value;
    docData.openSides = document.getElementById('plotOpenSides').value;
    docData.boundaryWall = document.getElementById('plotBoundaryWall').value;
    docData.roadWidth = document.getElementById('plotRoadWidth').value || '';
    docData.availableFrom = buildAvailableFrom('plotAvailMonth', 'plotAvailYear');
    docData.amenities = collectAmenities('amenitiesPlot');
  } else if (category === 'pg') {
    docData.sharing = document.getElementById('pgSharing').value;
    docData.gender = document.getElementById('pgGender').value;
    docData.mealsIncluded = document.getElementById('pgMeals').value;
    docData.acType = document.getElementById('pgAC').value;
    docData.furnishedStatus = document.getElementById('pgFurnished').value;
    docData.availableFrom = buildAvailableFrom('pgAvailMonth', 'pgAvailYear');
    docData.amenities = collectAmenities('amenitiesPG');
  }

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

    docData.images = imageUrls;

    // Upload brochure if selected
    if (selectedBrochure) {
      const timestamp = Date.now();
      const brochureRef = ref(storage, `brochures/${timestamp}_${selectedBrochure.name}`);
      await uploadBytes(brochureRef, selectedBrochure);
      docData.brochureUrl = await getDownloadURL(brochureRef);
    }

    // Save to Firestore
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
  // Hide all feature sections
  allFeatureSections.forEach(section => {
    section.style.display = 'none';
    section.querySelectorAll('[required]').forEach(el => el.disabled = true);
  });
});
