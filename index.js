const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

exports.createMatchOnLike = functions.firestore
  .document("likes/{likeId}")
  .onCreate(async (snap, context) => {
    const { from, to } = snap.data();

    if (!from || !to) return null;

    const reverseLikeId = `${to}_${from}`;
    const reverseLikeRef = db.collection("likes").doc(reverseLikeId);
    const reverseLikeSnap = await reverseLikeRef.get();

    if (!reverseLikeSnap.exists) {
      // Other user hasn't liked yet
      return null;
    }

    const matchId = [from, to].sort().join("_");
    const matchRef = db.collection("matches").doc(matchId);

    const matchSnap = await matchRef.get();
    if (matchSnap.exists) {
      // Match already created
      return null;
    }

    await matchRef.set({
      users: [from, to],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return null;
  });
