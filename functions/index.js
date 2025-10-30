/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const { setGlobalOptions } = require("firebase-functions");
const { onRequest } = require("firebase-functions/https");
const logger = require("firebase-functions/logger");

// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit. You can override the limit for each function using the
// `maxInstances` option in the function's options, e.g.
// `onRequest({ maxInstances: 5 }, (req, res) => { ... })`.
// NOTE: setGlobalOptions does not apply to functions using the v1 API. V1
// functions should each use functions.runWith({ maxInstances: 10 }) instead.
// In the v1 API, each function can only serve one request per container, so
// this will be the maximum concurrent request count.
setGlobalOptions({ maxInstances: 10 });

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

// exports.helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

const functions = require("firebase-functions");
const admin = require("firebase-admin");

// Инициализация Firebase Admin
admin.initializeApp();

/**
 * Cloud Function для обновления пароля пользователя
 * Доступно только для пользователей с ролью 'admin'
 */
exports.updateUserPassword = functions.https.onCall(async (data, context) => {
  // Проверяем аутентификацию
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Требуется аутентификация"
    );
  }

  const { targetUserId, newPassword } = data;

  // Валидация входных данных
  if (!targetUserId || !newPassword) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Необходимо указать targetUserId и newPassword"
    );
  }

  if (newPassword.length < 8) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Пароль должен содержать минимум 8 символов"
    );
  }

  try {
    // Получаем данные текущего пользователя (кто вызывает функцию)
    const currentUserDoc = await admin
      .firestore()
      .collection("users")
      .doc(context.auth.uid)
      .get();

    if (!currentUserDoc.exists) {
      throw new functions.https.HttpsError(
        "not-found",
        "Пользователь не найден"
      );
    }

    const currentUserData = currentUserDoc.data();

    // Проверяем права доступа - только администраторы могут менять пароли
    if (currentUserData.role !== "admin") {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Требуются права администратора для изменения паролей"
      );
    }

    // Проверяем существование целевого пользователя
    const targetUserDoc = await admin
      .firestore()
      .collection("users")
      .doc(targetUserId)
      .get();

    if (!targetUserDoc.exists) {
      throw new functions.https.HttpsError(
        "not-found",
        "Целевой пользователь не найден"
      );
    }

    // Обновляем пароль в Firebase Authentication
    await admin.auth().updateUser(targetUserId, {
      password: newPassword,
    });

    // Логируем действие
    await admin.firestore().collection("auditLog").add({
      action: "PASSWORD_UPDATE",
      performedBy: context.auth.uid,
      performedByEmail: currentUserData.email,
      targetUserId: targetUserId,
      targetUserEmail: targetUserDoc.data().email,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      ipAddress: context.rawRequest.ip,
    });

    console.log(`Пароль обновлен для пользователя: ${targetUserId}`);

    return {
      success: true,
      message: "Пароль успешно обновлен",
    };
  } catch (error) {
    console.error("Ошибка обновления пароля:", error);

    // Обрабатываем специфические ошибки Firebase Auth
    if (error.code === "auth/user-not-found") {
      throw new functions.https.HttpsError(
        "not-found",
        "Пользователь не найден в системе аутентификации"
      );
    }

    if (error.code === "auth/insufficient-permission") {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Недостаточно прав для выполнения операции"
      );
    }

    throw new functions.https.HttpsError(
      "internal",
      "Ошибка обновления пароля: " + error.message
    );
  }
});

const functions = require("firebase-functions");
const admin = require("firebase-admin");

// Инициализация Firebase Admin
admin.initializeApp();

/**
 * Cloud Function для обновления пароля пользователя
 * Доступно только для пользователей с ролью 'admin'
 */
exports.updateUserPassword = functions.https.onCall(async (data, context) => {
  // Проверяем аутентификацию
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Требуется аутентификация"
    );
  }

  const { targetUserId, newPassword } = data;

  // Валидация входных данных
  if (!targetUserId || !newPassword) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Необходимо указать targetUserId и newPassword"
    );
  }

  if (newPassword.length < 8) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Пароль должен содержать минимум 8 символов"
    );
  }

  try {
    // Получаем данные текущего пользователя (кто вызывает функцию)
    const currentUserDoc = await admin
      .firestore()
      .collection("users")
      .doc(context.auth.uid)
      .get();

    if (!currentUserDoc.exists) {
      throw new functions.https.HttpsError(
        "not-found",
        "Пользователь не найден"
      );
    }

    const currentUserData = currentUserDoc.data();

    // Проверяем права доступа - только администраторы могут менять пароли
    if (currentUserData.role !== "admin") {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Требуются права администратора для изменения паролей"
      );
    }

    // Проверяем существование целевого пользователя в Firestore
    const targetUserDoc = await admin
      .firestore()
      .collection("users")
      .doc(targetUserId)
      .get();

    if (!targetUserDoc.exists) {
      throw new functions.https.HttpsError(
        "not-found",
        "Целевой пользователь не найден"
      );
    }

    // Обновляем пароль в Firebase Authentication
    await admin.auth().updateUser(targetUserId, {
      password: newPassword,
    });

    // Логируем действие
    await admin
      .firestore()
      .collection("auditLog")
      .add({
        action: "PASSWORD_UPDATE",
        performedBy: context.auth.uid,
        performedByEmail: currentUserData.email,
        targetUserId: targetUserId,
        targetUserEmail: targetUserDoc.data().email,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        ipAddress: context.rawRequest.ip || "unknown",
      });

    console.log(`Пароль обновлен для пользователя: ${targetUserId}`);

    return {
      success: true,
      message: "Пароль успешно обновлен",
    };
  } catch (error) {
    console.error("Ошибка обновления пароля:", error);

    // Обрабатываем специфические ошибки Firebase Auth
    if (error.code === "auth/user-not-found") {
      throw new functions.https.HttpsError(
        "not-found",
        "Пользователь не найден в системе аутентификации"
      );
    }

    if (error.code === "auth/insufficient-permission") {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Недостаточно прав для выполнения операции"
      );
    }

    throw new functions.https.HttpsError(
      "internal",
      "Ошибка обновления пароля: " + error.message
    );
  }
});
