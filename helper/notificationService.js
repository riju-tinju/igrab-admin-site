const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');
const User = require('../model/userSchema');
const DeviceToken = require('../model/deviceTokenSchema');

let isInitialized = false;

const initializeFirebase = () => {
    if (isInitialized) return true;

    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    
    if (!serviceAccountPath) {
        console.warn('FIREBASE_SERVICE_ACCOUNT_PATH not found in environment variables. Push notifications will be disabled.');
        return false;
    }

    const absolutePath = path.isAbsolute(serviceAccountPath) 
        ? serviceAccountPath 
        : path.join(__dirname, '..', serviceAccountPath);

    if (!fs.existsSync(absolutePath)) {
        console.error(`Firebase service account file not found at: ${absolutePath}`);
        return false;
    }

    try {
        const serviceAccount = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        isInitialized = true;
        console.log('Firebase Admin initialized successfully.');
        return true;
    } catch (error) {
        console.error('Error initializing Firebase Admin:', error);
        return false;
    }
};

const sendPushToUser = async (userId, title, body, data = {}) => {
    if (!initializeFirebase()) return;

    try {
        const user = await User.findById(userId).select('fcmTokens language');
        if (!user || !user.fcmTokens || user.fcmTokens.length === 0) {
            return;
        }

        const tokens = user.fcmTokens.map(t => t.token);
        console.log(`[FCM] Sending push to user ${userId} (${tokens.length} tokens). Title: "${title}"`);
        
        const message = {
            notification: {
                title,
                body
            },
            data: {
                ...data,
                click_action: 'FLUTTER_NOTIFICATION_CLICK', // Common for mobile apps
            },
            tokens: tokens
        };

        const response = await admin.messaging().sendEachForMulticast(message);
        console.log(`[FCM] Multicast sent. Success: ${response.successCount}, Failure: ${response.failureCount}`);
        
        // Cleanup invalid tokens
        if (response.failureCount > 0) {
            const failedTokens = [];
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    const error = resp.error.code;
                    console.error(`[FCM] Token ${idx} failed with error: ${error}`);
                    if (error === 'messaging/registration-token-not-registered' || 
                        error === 'messaging/invalid-registration-token') {
                        failedTokens.push(tokens[idx]);
                    }
                }
            });

            if (failedTokens.length > 0) {
                console.log(`[FCM] Removing ${failedTokens.length} invalid tokens for user ${userId}`);
                await User.updateOne(
                    { _id: userId },
                    { $pull: { fcmTokens: { token: { $in: failedTokens } } } }
                );
            }
        }

        console.log(`Successfully sent ${response.successCount} messages to user ${userId}`);
    } catch (error) {
        console.error('Error sending push notification:', error);
    }
};

const sendOrderStatusNotification = async (order) => {
    const statusMessages = {
        en: {
            'Placed': `Your order ${order.orderId} has been placed successfully.`,
            'Confirmed': `Your order ${order.orderId} has been confirmed.`,
            'Processing': `We are processing your order ${order.orderId}.`,
            'Delivered': `Success! Your order ${order.orderId} has been delivered.`,
            'Cancelled': `Your order ${order.orderId} has been cancelled.`,
            'Refunded': `Your order ${order.orderId} has been cancelled and a full refund has been processed to your bank.`
        },
        ar: {
            'Placed': `تم تقديم طلبك ${order.orderId} بنجاح.`,
            'Confirmed': `تم تأكيد طلبك ${order.orderId}.`,
            'Processing': `نحن نقوم بمعالجة طلبك ${order.orderId}.`,
            'Delivered': `تم توصيل طلبك ${order.orderId} بنجاح.`,
            'Cancelled': `تم إلغاء طلبك ${order.orderId}.`,
            'Refunded': `تم إلغاء طلبك ${order.orderId} وتمت معالجة استرداد المبلغ بالكامل إلى البنك الخاص بك.`
        }
    };

    try {
        const user = await User.findById(order.userId).select('language');
        const lang = user?.language === 'ar' ? 'ar' : 'en';
        
        const title = lang === 'ar' ? 'تحديث الطلب' : 'Order Update';
        
        // Custom logic: if it's status Cancelled AND paymentStatus is Refunded, use the Refunded message
        let statusKey = order.status;
        if (order.status === 'Cancelled' && order.paymentStatus === 'Refunded') {
            statusKey = 'Refunded';
        }

        const body = statusMessages[lang][statusKey] || `Order ${order.orderId} status: ${order.status}`;

        // Send asynchronously
        sendPushToUser(order.userId, title, body, {
            orderId: order._id.toString(),
            displayOrderId: order.orderId,
            status: order.status,
            type: 'ORDER_STATUS_UPDATE'
        });
    } catch (error) {
        console.error('Error in sendOrderStatusNotification:', error);
    }
};

const sendBroadcastNotification = async (title, body, imageUrl = null, data = {}) => {
    if (!initializeFirebase()) return;

    try {
        const deviceTokens = await DeviceToken.find().select('token');
        if (!deviceTokens || deviceTokens.length === 0) {
            console.log('[FCM] No tokens found for broadcast.');
            return { success: false, message: 'No devices registered' };
        }

        const tokens = deviceTokens.map(t => t.token);
        console.log(`[FCM] Sending broadcast push to ${tokens.length} devices. Title: "${title}"`);

        const message = {
            notification: {
                title,
                body,
                ...(imageUrl && { image: imageUrl })
            },
            android: {
                notification: {
                    ...(imageUrl && { image: imageUrl }),
                    clickAction: 'TOP_STORY_NOTIFICATION_CLICK'
                }
            },
            data: {
                ...data,
                title,
                body,
                type: 'BROADCAST',
                ...(imageUrl && { 
                    image: imageUrl,
                    picture: imageUrl,
                    large_icon: imageUrl
                })
            },
            tokens: tokens
        };

        const response = await admin.messaging().sendEachForMulticast(message);
        console.log(`[FCM] Broadcast sent. Success: ${response.successCount}, Failure: ${response.failureCount}`);

        // Cleanup invalid tokens
        if (response.failureCount > 0) {
            const failedTokens = [];
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    const error = resp.error.code;
                    if (error === 'messaging/registration-token-not-registered' || 
                        error === 'messaging/invalid-registration-token') {
                        failedTokens.push(tokens[idx]);
                    }
                }
            });

            if (failedTokens.length > 0) {
                console.log(`[FCM] Removing ${failedTokens.length} invalid tokens from broadcast list`);
                await DeviceToken.deleteMany({ token: { $in: failedTokens } });
            }
        }
        return { success: true, successCount: response.successCount, failureCount: response.failureCount };
    } catch (error) {
        console.error('Error sending broadcast push notification:', error);
        return { success: false, error: error.message };
    }
};

module.exports = {
    sendPushToUser,
    sendOrderStatusNotification,
    sendBroadcastNotification
};
