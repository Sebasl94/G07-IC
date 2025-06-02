importScripts(
    "https://www.gstatic.com/firebasejs/9.7.0/firebase-app-compat.js",
  );
  importScripts(
    "https://www.gstatic.com/firebasejs/9.7.0/firebase-messaging-compat.js",
  );
  
  firebase.initializeApp({
    apiKey: "AIzaSyAFYHDYfNkGaPdNXR3GlYU7JrnUpFDDkgs",
    authDomain: "medicationreminder-ae767.firebaseapp.com",
    projectId: "medicationreminder-ae767",
    storageBucket: "medicationreminder-ae767.firebasestorage.app",
    messagingSenderId: "477202689178",
    appId: "G-2XGY15Z308",
  });
  const messaging = firebase.messaging();