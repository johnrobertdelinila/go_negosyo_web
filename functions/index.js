const functions = require('firebase-functions');
const admin = require('firebase-admin');
const path = require('path');

const serviceAccount = './serviceAccountKey.json';
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://go-negosyo.firebaseio.com"
});

// Callable Functions
exports.listAllUsers = functions.https.onCall((data, context) => {
	return admin.auth().listUsers()
		.then(listUsersResult => {
			return {
				users: listUsersResult.users
			};
		})
		.catch(err => {
			throw new functions.https.HttpsError('unknown', err.message, err);
		});
});
exports.listAllMSME = functions.https.onCall((data, context) => {
	return admin.auth().listUsers()
		.then(listUsersResult => {
			var users = [];
			listUsersResult.users.forEach(userRecord => {
				if (userRecord.email !== "lancejasper.casas@lorma.edu") {
					users.push(userRecord);
				}
			});
			console.log("Results: " + users.length);
			return users;
		})
		.catch(err => {
			throw new functions.https.HttpsError('unknown', err.message, err);
		});
});
exports.listAllVerifiedMSME = functions.https.onCall((data, context) => {
	return admin.auth().listUsers()
		.then(listUsersResult => {
			var users = [];
			listUsersResult.users.forEach(userRecord => {
				if (userRecord.customClaims !== undefined && userRecord.customClaims !== null && userRecord.customClaims.isVerified !== null 
					&& userRecord.customClaims.isVerified === true && userRecord.emailVerified === true && 
					userRecord.customClaims.admin === null || userRecord.customClaims.admin === undefined) {
					users.push(userRecord);
				}
			});
			console.log("Results: " + users.length);
			return users;
		})
		.catch(err => {
			throw new functions.https.HttpsError('unknown', err.message, err);
		});
});
exports.createUser = functions.https.onCall((data, context) => {
	return admin.auth().createUser({
		email: data.email,
		displayName: data.name,
		password: "123456",
		disabled: false,
		emailVerified: false,
		phoneNumber: data.phoneNumber
	})
		.then(userRecord => {
			return userRecord.uid;
		})
		.catch(err => {
			throw new functions.https.HttpsError('unknown', err.message, err);
		});
});
exports.verifyMSME = functions.https.onCall((data, context) => {
	const uid = data.uid;
	return admin.auth().getUser(uid)
		.then(userRecord => {
			if (userRecord.emailVerified === true) {
				return admin.auth().setCustomUserClaims(uid, {isVerified: true})
					.then(() => {
						console.log('successfully verified the user!');
						return true;
					})
					.catch(err => {
						throw new functions.https.HttpsError('unknown', err.message, err);
					});
			}else {
				return 'MSME must verify first the email address.';
			}
		});
});

// Triggered Functions
exports.newlyRegisteredBusiness = functions.auth.user().onCreate(user => {
	const uid = user.uid;
	return setCustomClaimsUnverified(uid);
});
exports.sendAdminNotification = functions.database.ref('/msme/{uid}')
	.onCreate((snapshot, context) => {
		const msme = snapshot.val();
		const displayName = msme.full_name || null;
		const message = displayName + " has registered and waiting to be verified.";
		return setAdminNotification(message);
	});
exports.saveDownloadUrlImage = functions.region('asia-northeast1').storage.object().onFinalize(object => {
	const contentType = object.contentType;
	if (!contentType.startsWith('image/')) {
		console.log('The uploaded file was not an image.');
		return null;
	}

	const filePath = object.name;
	const fileDir = path.dirname(filePath);

	const fileBucket = object.bucket;
	const fileName = path.basename(filePath);

	const bucket = admin.storage().bucket(fileBucket);

	const SIGNED_BUCKET_URL_CONFIG = {
	    action: 'read',
	    expires: '03-01-2500'
	};

	if (fileDir !== null && fileDir === "credentials") {
		console.log("Image is from credential image.");
		const arr = fileName.split("==");
		const id = arr[0];
		const key = arr[1];

		return bucket.file(filePath).getSignedUrl(SIGNED_BUCKET_URL_CONFIG, (err, url) => {                                  
			if (err) {
	            console.error(err);
	            return null;
	        }else {
        		return admin.database().ref().child('msme').child(id).child('images').child(key)
        			.set(url)
	        			.then(() => console.log("Successfully updated: " + key))
	        			.catch(error => console.log(error));
	        }                                         
		});

	}else {
		console.log("The image was not credential image.");
		return null;
	}
});

// Functions

function setCustomClaimsUnverified(uid) {
	admin.auth().setCustomUserClaims(uid, {isVerified: false})
		.then(() => {
			return console.log("Business set claims successfully");
		})
		.catch(err => {
			throw new functions.https.HttpsError('unknown', err.message, err);
		})
}
function propagateUser() {
	// DTI Admin Account
	// Setting custom claims using the Admin SDK
	var adminUid = "wT7zVvZX3IMDNgjp7m4h4ihsNgk1";
	admin.auth().setCustomUserClaims(adminUid, {admin: true})
		.then(() => console.log('successfully claims as admin!'))
		.catch(err => console.log(err.message));
}
function setAdminNotification(text) {
	const payload = {
	  notification: {
	    title: 'Newly Registered',
	    body: text ? (text.length <= 100 ? text : text.substring(0, 97) + '...') : '',
	    icon: '/images/firebase_logo.png',
	    click_action: `https://go-negosyo.firebaseapp.com`,
	  }
	};

	var fcmAdminToken = admin.database().ref().child('adminToken');
	fcmAdminToken.once('value', snapshot => {
		fcmToken = snapshot.val();
		if (fcmToken !== null) {
			console.log(fcmToken);
			return admin.messaging().sendToDevice(fcmToken, payload)
				.then(response => console.log("Successfully sent a push notification to admin"))
				.catch(error => console.log(error));
		}else {
			console.log("Fcm token for admin is missing");
			return null;
		}
	});
}

propagateUser();