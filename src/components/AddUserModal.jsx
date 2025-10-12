import React, { useState, useEffect, useCallback } from "react";
import { collection, addDoc, getDocs, query, where } from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { db, auth } from "../firebase/config";
import StationsSelection from "./StationsSelection";

const AddUserModal = ({ onClose, onUserCreated }) => {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    displayName: "",
    firstName: "",
    lastName: "",
    middleName: "",
    birthday: "",
    pinfl: "",
    passportSeries: "",
    passportNumber: "",
    address: "",
    role: "operator",
    accessEndDate: "", // Новое поле: дата завершения доступа
  });
  const [showStations, setShowStations] = useState(false);
  const [selectedStations, setSelectedStations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uniqueErrors, setUniqueErrors] = useState({
    email: "",
    passportNumber: "",
    pinfl: "",
  });

  // Валидация пароля
  const validatePassword = useCallback((password) => {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    return (
      password.length >= minLength &&
      hasUpperCase &&
      hasLowerCase &&
      hasNumbers &&
      hasSpecialChar
    );
  }, []);

  // Проверка силы пароля
  const getPasswordStrength = useCallback((password) => {
    if (!password) return { strength: 0, message: "" };

    let strength = 0;
    let message = "";

    if (password.length >= 8) strength += 25;
    if (/[A-Z]/.test(password)) strength += 25;
    if (/[a-z]/.test(password)) strength += 25;
    if (/\d/.test(password)) strength += 12.5;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) strength += 12.5;

    if (strength < 50) message = "Слабый пароль";
    else if (strength < 75) message = "Средний пароль";
    else message = "Сильный пароль";

    return { strength, message };
  }, []);

  // Проверка уникальности полей
  const checkUniqueFields = useCallback(async (field, value) => {
    if (!value) return "";

    try {
      const usersCollection = collection(db, "users");
      const q = query(usersCollection, where(field, "==", value));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        return `Такой ${getFieldName(field)} уже существует в базе`;
      }
      return "";
    } catch (error) {
      console.error("Error checking unique field:", error);
      return "Ошибка проверки уникальности";
    }
  }, []);

  const getFieldName = useCallback((field) => {
    const fieldNames = {
      email: "email",
      passportNumber: "номер паспорта",
      pinfl: "ПИНФЛ",
    };
    return fieldNames[field] || field;
  }, []);

  // Проверка всех обязательных полей
  const isFormValid = useCallback(() => {
    const requiredFields = {
      email: formData.email.trim() !== "" && !uniqueErrors.email,
      password:
        formData.password.trim() !== "" && validatePassword(formData.password),
      displayName: formData.displayName.trim() !== "",
      firstName: formData.firstName.trim() !== "",
      lastName: formData.lastName.trim() !== "",
      birthday: formData.birthday.trim() !== "",
      pinfl:
        formData.pinfl.trim() !== "" &&
        formData.pinfl.length === 14 &&
        !uniqueErrors.pinfl,
      passportSeries:
        formData.passportSeries.trim() !== "" &&
        formData.passportSeries.length === 2,
      passportNumber:
        formData.passportNumber.trim() !== "" &&
        formData.passportNumber.length === 7 &&
        !uniqueErrors.passportNumber,
      role: formData.role.trim() !== "",
    };

    return (
      Object.values(requiredFields).every(Boolean) &&
      !Object.values(uniqueErrors).some((error) => error !== "")
    );
  }, [formData, uniqueErrors, validatePassword]);

  const handleInputChange = async (e) => {
    const { name, value } = e.target;

    let processedValue = value;

    // Ограничения по длине
    if (name === "passportNumber" && value.length > 7) return;
    if (name === "pinfl" && value.length > 14) return;
    if (name === "passportSeries" && value.length > 2) return;

    // Только цифры для паспорта и ПИНФЛ
    if (name === "passportNumber" || name === "pinfl") {
      processedValue = value.replace(/\D/g, "");
    }

    // Заглавные буквы для серии паспорта
    if (name === "passportSeries") {
      processedValue = value.toUpperCase().replace(/[^A-ZА-Я]/g, "");
    }

    setFormData((prev) => ({
      ...prev,
      [name]: processedValue,
    }));

    // Проверка уникальности для email, паспорта и ПИНФЛ
    if (name === "email" && processedValue) {
      const error = await checkUniqueFields("email", processedValue);
      setUniqueErrors((prev) => ({ ...prev, email: error }));
    }

    if (name === "passportNumber" && processedValue.length === 7) {
      const error = await checkUniqueFields("passportNumber", processedValue);
      setUniqueErrors((prev) => ({ ...prev, passportNumber: error }));
    }

    if (name === "pinfl" && processedValue.length === 14) {
      const error = await checkUniqueFields("pinfl", processedValue);
      setUniqueErrors((prev) => ({ ...prev, pinfl: error }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isFormValid()) {
      alert("Пожалуйста, заполните все обязательные поля корректно");
      return;
    }

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );

      const userData = {
        ...formData,
        uid: userCredential.user.uid,
        createdAt: new Date(),
        stations: selectedStations,
        isActive: true, // Пользователь активен по умолчанию
      };

      await addDoc(collection(db, "users"), userData);

      onUserCreated();
    } catch (error) {
      console.error("Error creating user:", error);
      alert("Ошибка при создании пользователя: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const passwordStrength = getPasswordStrength(formData.password);

  // Вспомогательные функции для проверки полей (только для отображения)
  const isFieldValid = (fieldName, value) => {
    switch (fieldName) {
      case "email":
        return value.trim() !== "" && !uniqueErrors.email;
      case "password":
        return value.trim() !== "" && validatePassword(value);
      case "displayName":
      case "firstName":
      case "lastName":
      case "birthday":
      case "role":
        return value.trim() !== "";
      case "pinfl":
        return (
          value.trim() !== "" && value.length === 14 && !uniqueErrors.pinfl
        );
      case "passportSeries":
        return value.trim() !== "" && value.length === 2;
      case "passportNumber":
        return (
          value.trim() !== "" &&
          value.length === 7 &&
          !uniqueErrors.passportNumber
        );
      default:
        return false;
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
          <div className="flex justify-between items-center p-6 border-b border-gray-200 bg-gray-50">
            <h2 className="text-xl font-semibold text-gray-900">
              Добавить нового пользователя
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl font-light w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 transition-colors">
              ×
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Email */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Email *
                    {isFieldValid("email", formData.email) && (
                      <span className="text-green-500 ml-1">✓</span>
                    )}
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      uniqueErrors.email ? "border-red-300" : "border-gray-300"
                    } ${
                      isFieldValid("email", formData.email)
                        ? "border-green-300"
                        : ""
                    }`}
                  />
                  {uniqueErrors.email && (
                    <div className="text-red-500 text-xs">
                      {uniqueErrors.email}
                    </div>
                  )}
                </div>

                {/* Пароль */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Пароль *
                    {isFieldValid("password", formData.password) && (
                      <span className="text-green-500 ml-1">✓</span>
                    )}
                  </label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    required
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      isFieldValid("password", formData.password)
                        ? "border-green-300"
                        : "border-gray-300"
                    }`}
                  />
                  {formData.password && (
                    <div className="space-y-1">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            passwordStrength.strength < 50
                              ? "bg-red-500"
                              : passwordStrength.strength < 75
                              ? "bg-yellow-500"
                              : "bg-green-500"
                          }`}
                          style={{
                            width: `${passwordStrength.strength}%`,
                          }}></div>
                      </div>
                      <div className="text-xs text-gray-500">
                        {passwordStrength.message} • Минимум 8 символов,
                        заглавные и строчные буквы, цифры, специальные символы
                      </div>
                    </div>
                  )}
                </div>

                {/* Display Name */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Display Name *
                    {isFieldValid("displayName", formData.displayName) && (
                      <span className="text-green-500 ml-1">✓</span>
                    )}
                  </label>
                  <input
                    type="text"
                    name="displayName"
                    value={formData.displayName}
                    onChange={handleInputChange}
                    required
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      isFieldValid("displayName", formData.displayName)
                        ? "border-green-300"
                        : "border-gray-300"
                    }`}
                  />
                </div>

                {/* Имя */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Имя *
                    {isFieldValid("firstName", formData.firstName) && (
                      <span className="text-green-500 ml-1">✓</span>
                    )}
                  </label>
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    required
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      isFieldValid("firstName", formData.firstName)
                        ? "border-green-300"
                        : "border-gray-300"
                    }`}
                  />
                </div>

                {/* Фамилия */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Фамилия *
                    {isFieldValid("lastName", formData.lastName) && (
                      <span className="text-green-500 ml-1">✓</span>
                    )}
                  </label>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    required
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      isFieldValid("lastName", formData.lastName)
                        ? "border-green-300"
                        : "border-gray-300"
                    }`}
                  />
                </div>

                {/* Отчество */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Отчество
                  </label>
                  <input
                    type="text"
                    name="middleName"
                    value={formData.middleName}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* День рождения */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    День рождения *
                    {isFieldValid("birthday", formData.birthday) && (
                      <span className="text-green-500 ml-1">✓</span>
                    )}
                  </label>
                  <input
                    type="date"
                    name="birthday"
                    value={formData.birthday}
                    onChange={handleInputChange}
                    required
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      isFieldValid("birthday", formData.birthday)
                        ? "border-green-300"
                        : "border-gray-300"
                    }`}
                  />
                </div>

                {/* Дата завершения доступа */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Дата завершения доступа
                  </label>
                  <input
                    type="date"
                    name="accessEndDate"
                    value={formData.accessEndDate}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <div className="text-xs text-gray-500">
                    Дата, когда доступ пользователя будет автоматически отключен
                  </div>
                </div>

                {/* ПИНФЛ */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    ПИНФЛ *
                    {isFieldValid("pinfl", formData.pinfl) && (
                      <span className="text-green-500 ml-1">✓</span>
                    )}
                  </label>
                  <input
                    type="text"
                    name="pinfl"
                    value={formData.pinfl}
                    onChange={handleInputChange}
                    maxLength={14}
                    placeholder="14 цифр"
                    required
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      uniqueErrors.pinfl ? "border-red-300" : "border-gray-300"
                    } ${
                      isFieldValid("pinfl", formData.pinfl)
                        ? "border-green-300"
                        : ""
                    }`}
                  />
                  {uniqueErrors.pinfl && (
                    <div className="text-red-500 text-xs">
                      {uniqueErrors.pinfl}
                    </div>
                  )}
                  {formData.pinfl && formData.pinfl.length !== 14 && (
                    <div className="text-yellow-500 text-xs">
                      Должно быть 14 цифр
                    </div>
                  )}
                </div>

                {/* Серия паспорта */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Серия паспорта *
                    {isFieldValid(
                      "passportSeries",
                      formData.passportSeries
                    ) && <span className="text-green-500 ml-1">✓</span>}
                  </label>
                  <input
                    type="text"
                    name="passportSeries"
                    value={formData.passportSeries}
                    onChange={handleInputChange}
                    maxLength={2}
                    required
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 uppercase ${
                      isFieldValid("passportSeries", formData.passportSeries)
                        ? "border-green-300"
                        : "border-gray-300"
                    }`}
                  />
                  {formData.passportSeries &&
                    formData.passportSeries.length !== 2 && (
                      <div className="text-yellow-500 text-xs">
                        Должно быть 2 буквы
                      </div>
                    )}
                </div>

                {/* Номер паспорта */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Номер паспорта *
                    {isFieldValid(
                      "passportNumber",
                      formData.passportNumber
                    ) && <span className="text-green-500 ml-1">✓</span>}
                  </label>
                  <input
                    type="text"
                    name="passportNumber"
                    value={formData.passportNumber}
                    onChange={handleInputChange}
                    maxLength={7}
                    placeholder="7 цифр"
                    required
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      uniqueErrors.passportNumber
                        ? "border-red-300"
                        : "border-gray-300"
                    } ${
                      isFieldValid("passportNumber", formData.passportNumber)
                        ? "border-green-300"
                        : ""
                    }`}
                  />
                  {uniqueErrors.passportNumber && (
                    <div className="text-red-500 text-xs">
                      {uniqueErrors.passportNumber}
                    </div>
                  )}
                  {formData.passportNumber &&
                    formData.passportNumber.length !== 7 && (
                      <div className="text-yellow-500 text-xs">
                        Должно быть 7 цифр
                      </div>
                    )}
                </div>

                {/* Адрес */}
                <div className="md:col-span-2 space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Адрес
                  </label>
                  <input
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    placeholder="Город, улица, дом"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Роль */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Роль *
                  </label>
                  <select
                    name="role"
                    value={formData.role}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                    <option value="admin">Admin</option>
                    <option value="nazorat">Nazorat</option>
                    <option value="rahbar">Rahbar</option>
                    <option value="operator">Operator</option>
                    <option value="boshmexanik">Bosh Mexanik</option>
                    <option value="mehanik">Mehanik</option>
                    <option value="buxgalter">Buxgalter</option>
                    <option value="yurist">Yurist</option>
                    <option value="partner">Partner</option>
                  </select>
                </div>

                {/* Прикрепленные станции */}
                <div className="md:col-span-2 space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Прикрепленные станции
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowStations(true)}
                    className="w-full px-3 py-2 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-600 hover:text-gray-700 transition-colors">
                    Выбрать станции ({selectedStations.length})
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50">
                Отмена
              </button>
              <button
                type="submit"
                disabled={!isFormValid() || loading}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed">
                {loading ? "Создание..." : "Создать пользователя"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {showStations && (
        <StationsSelection
          selectedStations={selectedStations}
          onStationsChange={setSelectedStations}
          onClose={() => setShowStations(false)}
        />
      )}
    </>
  );
};

export default AddUserModal;
