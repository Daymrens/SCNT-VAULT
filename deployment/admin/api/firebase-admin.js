// Firebase Admin API — non-module script, attaches to window.FB
(function() {
  var firebaseConfig = {
    apiKey: "AIzaSyCTVEb364hJZveBr0iUu5a39TpgcBb63no",
    authDomain: "scnt-vault.firebaseapp.com",
    projectId: "scnt-vault",
    storageBucket: "scnt-vault.firebasestorage.app",
    messagingSenderId: "86926234856",
    appId: "1:86926234856:web:75d5119f0b4f54ff3fe55d"
  };

  var app  = firebase.initializeApp(firebaseConfig);
  var auth = firebase.auth();
  var db   = firebase.firestore();

  window.FB = { app: app, auth: auth, db: db };
})();
