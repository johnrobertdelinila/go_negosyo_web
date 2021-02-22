importScripts('https://www.gstatic.com/firebasejs/5.5.9/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/5.5.9/firebase-messaging.js');

// Initialize the Firebase app in the service worker by passing in the
// messagingSenderId.

firebase.initializeApp({messagingSenderId: "127403329753"});
var messaging = firebase.messaging();

// Retrieve an instance of Firebase Messaging so that it can handle background
// messages.

messaging.setBackgroundMessageHandler(payload => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  // Customize notification here
  const notificationTitle = 'Background Message Title';
  const notificationOptions = {
    body: 'Background Message body.',
    icon: '/images/dti.png'
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});