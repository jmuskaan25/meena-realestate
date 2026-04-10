const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { initializeApp } = require('firebase-admin/app');

initializeApp();
const db = getFirestore();

// Increment view count for a property
exports.incrementViews = onCall(
  {
    invoker: 'public',
  },
  async (request) => {
    const { propertyId } = request.data;

    if (!propertyId) {
      throw new HttpsError('invalid-argument', 'propertyId is required');
    }

    const docRef = db.collection('properties').doc(propertyId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      throw new HttpsError('not-found', 'Property not found');
    }

    await docRef.update({
      views: FieldValue.increment(1)
    });

    return { success: true, views: (docSnap.data().views || 0) + 1 };
  }
);

// Mark a property as sold (admin-only via session flag)
exports.markAsSold = onCall(
  {
    invoker: 'public',
  },
  async (request) => {
    const { propertyId } = request.data;

    if (!propertyId) {
      throw new HttpsError('invalid-argument', 'propertyId is required');
    }

    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be signed in');
    }

    const docRef = db.collection('properties').doc(propertyId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      throw new HttpsError('not-found', 'Property not found');
    }

    await docRef.update({
      status: 'sold'
    });

    return { success: true };
  }
);
