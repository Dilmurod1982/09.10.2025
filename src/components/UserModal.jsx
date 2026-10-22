import React, { useState, useEffect, useMemo } from "react";
import { doc, updateDoc, collection, getDocs } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { db } from "../firebase/config";
import StationsSelection from "./StationsSelection";

const UserModal = ({ user, onClose, onUserUpdated, readOnly = false }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    email: user.email || "",
    password: "",
    displayName: user.displayName || "",
    firstName: user.firstName || "",
    lastName: user.lastName || "",
    middleName: user.middleName || "",
    birthday: user.birthday || "",
    pinfl: user.pinfl || "",
    passportSeries: user.passportSeries || "",
    passportNumber: user.passportNumber || "",
    address: user.address || "",
    role: user.role || "operator",
    accessEndDate: user.accessEndDate || "",
  });
  const [showStations, setShowStations] = useState(false);
  const [selectedStations, setSelectedStations] = useState(user.stations || []);
  const [loading, setLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState({
    strength: 0,
    message: "",
  });

  // 🤝 Партнёры
  const [partners, setPartners] = useState([]);
  const [partnersLoading, setPartnersLoading] = useState(false);
  const [selectedPartnerId, setSelectedPartnerId] = useState(
    user.partnerId || ""
  );
  const [searchPartner, setSearchPartner] = useState("");

  // readOnly
  useEffect(() => {
    if (readOnly) setIsEditing(false);
  }, [readOnly]);

  // Загружаем станции пользователя
  useEffect(() => {
    if (user.stations) setSelectedStations(user.stations);
  }, [user.stations]);

  // Синхронизируем partnerId при изменении user
  useEffect(() => {
    setSelectedPartnerId(user.partnerId || "");
  }, [user.partnerId]);

  // Загрузка партнёров, если роль — partner
  useEffect(() => {
    if (formData.role !== "partner") return;

    const fetchPartners = async () => {
      try {
        setPartnersLoading(true);
        const snap = await getDocs(collection(db, "partners"));
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        list.sort((a, b) =>
          String(a.name || "").localeCompare(String(b.name || ""))
        );
        setPartners(list);
      } catch (e) {
        console.error("Ошибка загрузки партнёров:", e);
      } finally {
        setPartnersLoading(false);
      }
    };
    fetchPartners();
  }, [formData.role]);

  const maskPinfl = (pinfl) => {
    if (!pinfl || pinfl.length < 3) return pinfl;
    return pinfl[0] + "*".repeat(pinfl.length - 2) + pinfl[pinfl.length - 1];
  };

  const maskPassportNumber = (number) => {
    if (!number || number.length < 3) return number;
    return (
      number[0] + "*".repeat(number.length - 2) + number[number.length - 1]
    );
  };

  const handleInputChange = (e) => {
    if (readOnly && e.target.name !== "password") return;

    const { name, value } = e.target;

    let processedValue = value;

    if (name === "passportNumber" && value.length > 7) return;
    if (name === "pinfl" && value.length > 14) return;
    if (name === "passportSeries" && value.length > 2) return;

    if (name === "passportNumber" || name === "pinfl") {
      processedValue = value.replace(/\D/g, "");
    }

    if (name === "passportSeries") {
      processedValue = value.toUpperCase().replace(/[^A-ZА-Я]/g, "");
    }

    setFormData((prev) => ({
      ...prev,
      [name]: processedValue,
    }));

    // 🤝 Если роль ушла с partner — сбрасываем partnerId
    if (name === "role" && processedValue !== "partner") {
      setSelectedPartnerId("");
      setSearchPartner("");
    }

    if (name === "password") {
      setPasswordStrength(getPasswordStrength(processedValue));
    }
  };

  const validatePassword = (password) => {
    if (!password) return true;

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
  };

  const getPasswordStrength = (password) => {
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
  };

  const handleSave = async () => {
    if (formData.password && !validatePassword(formData.password)) {
      alert(
        "Пароль должен содержать минимум 8 символов, включая заглавные и строчные буквы, цифры и специальные символы"
      );
      return;
    }

    // 🤝 Валидация партнёра
    if (formData.role === "partner" && !selectedPartnerId) {
      alert("Выберите партнёра из списка");
      return;
    }

    setLoading(true);
    try {
      const userDoc = doc(db, "users", user.id);
      const updateData = {
        displayName: formData.displayName,
        firstName: formData.firstName,
        lastName: formData.lastName,
        middleName: formData.middleName,
        birthday: formData.birthday,
        pinfl: formData.pinfl,
        passportSeries: formData.passportSeries,
        passportNumber: formData.passportNumber,
        address: formData.address,
        role: formData.role,
        accessEndDate: formData.accessEndDate,
        stations: selectedStations,
        // 🤝 партнёр
        partnerId: formData.role === "partner" ? selectedPartnerId : null,
      };

      const passwordToUpdate = formData.password;

      await updateDoc(userDoc, updateData);

      if (passwordToUpdate) {
        try {
          const functions = getFunctions();
          const updatePasswordFunction = httpsCallable(
            functions,
            "updateUserPassword"
          );
          await updatePasswordFunction({
            targetUserId: user.id,
            newPassword: passwordToUpdate,
          });
        } catch (passwordError) {
          console.error("Ошибка обновления пароля:", passwordError);
          let errorMessage = "Неизвестная ошибка";
          if (passwordError.code === "permission-denied") {
            errorMessage =
              "У вас нет прав для изменения паролей. Требуется роль администратора.";
          } else if (passwordError.code === "not-found") {
            errorMessage = "Пользователь не найден в системе аутентификации.";
          } else if (passwordError.message) {
            errorMessage = passwordError.message;
          }
          alert(
            "Данные пользователя обновлены, но произошла ошибка при смене пароля: " +
              errorMessage
          );
        }
      }

      setFormData((prev) => ({ ...prev, password: "" }));
      setPasswordStrength({ strength: 0, message: "" });

      onUserUpdated();
      setIsEditing(false);
      alert("Данные пользователя успешно обновлены");
    } catch (error) {
      console.error("Error updating user:", error);
      alert("Ошибка при обновлении пользователя: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      email: user.email || "",
      password: "",
      displayName: user.displayName || "",
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      middleName: user.middleName || "",
      birthday: user.birthday || "",
      pinfl: user.pinfl || "",
      passportSeries: user.passportSeries || "",
      passportNumber: user.passportNumber || "",
      address: user.address || "",
      role: user.role || "operator",
      accessEndDate: user.accessEndDate || "",
    });
    setSelectedStations(user.stations || []);
    setSelectedPartnerId(user.partnerId || "");
    setSearchPartner("");
    setIsEditing(false);
    setPasswordStrength({ strength: 0, message: "" });
  };

  const getAccessStatus = () => {
    if (!formData.accessEndDate)
      return { status: "active", text: "Активен", color: "text-green-600" };

    const endDate = new Date(formData.accessEndDate);
    const today = new Date();

    if (endDate < today) {
      return { status: "expired", text: "Доступ истек", color: "text-red-600" };
    } else {
      const daysLeft = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
      return {
        status: "active",
        text: `Активен (осталось ${daysLeft} дней)`,
        color: daysLeft <= 7 ? "text-yellow-600" : "text-green-600",
      };
    }
  };

  const accessStatus = getAccessStatus();

  const isFieldEditable = (fieldName) => {
    if (readOnly) return fieldName === "password";
    return isEditing;
  };

  // 🤝 фильтр партнёров
  const filteredPartners = useMemo(() => {
    const s = searchPartner.trim().toLowerCase();
    if (!s) return partners;
    return partners.filter(
      (p) =>
        String(p.name || "")
          .toLowerCase()
          .includes(s) || String(p.inn || "").includes(s)
    );
  }, [partners, searchPartner]);

  const currentPartner = partners.find((p) => p.id === selectedPartnerId);

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
          <div className="flex justify-between items-center p-6 border-b border-gray-200 bg-gray-50">
            <h2 className="text-xl font-semibold text-gray-900">
              {readOnly
                ? "Информация о пользователе"
                : "Редактирование пользователя"}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl font-light w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 transition-colors"
            >
              ×
            </button>
          </div>

          <div className="p-6 overflow-y-auto max-h-[60vh]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Статус доступа */}
              <div className="md:col-span-2 space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Статус доступа
                </label>
                <div
                  className={`px-3 py-2 rounded-lg border ${
                    accessStatus.status === "expired"
                      ? "bg-red-50 border-red-200"
                      : "bg-green-50 border-green-200"
                  }`}
                >
                  <span className={`font-medium ${accessStatus.color}`}>
                    {accessStatus.text}
                  </span>
                </div>
              </div>

              {/* Email */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Логин
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  disabled={!isFieldEditable("email")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                />
              </div>

              {/* Имя */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Имя
                </label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  disabled={!isFieldEditable("firstName")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                />
              </div>

              {/* Фамилия */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Фамилия
                </label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  disabled={!isFieldEditable("lastName")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
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
                  disabled={!isFieldEditable("middleName")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                />
              </div>

              {/* День рождения */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  День рождения
                </label>
                <input
                  type="date"
                  name="birthday"
                  value={formData.birthday}
                  onChange={handleInputChange}
                  disabled={!isFieldEditable("birthday")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                />
              </div>

              {/* ПИНФЛ */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  ПИНФЛ
                </label>
                {isFieldEditable("pinfl") ? (
                  <input
                    type="text"
                    name="pinfl"
                    value={formData.pinfl}
                    onChange={handleInputChange}
                    maxLength={14}
                    placeholder="14 цифр"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                ) : (
                  <div className="px-3 py-2 bg-gray-100 rounded-lg text-gray-700">
                    {maskPinfl(user.pinfl)}
                  </div>
                )}
              </div>

              {/* Серия паспорта */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Серия паспорта
                </label>
                <input
                  type="text"
                  name="passportSeries"
                  value={formData.passportSeries}
                  onChange={handleInputChange}
                  disabled={!isFieldEditable("passportSeries")}
                  maxLength={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500 uppercase"
                />
              </div>

              {/* Номер паспорта */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Номер паспорта
                </label>
                {isFieldEditable("passportNumber") ? (
                  <input
                    type="text"
                    name="passportNumber"
                    value={formData.passportNumber}
                    onChange={handleInputChange}
                    maxLength={7}
                    placeholder="7 цифр"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                ) : (
                  <div className="px-3 py-2 bg-gray-100 rounded-lg text-gray-700">
                    {maskPassportNumber(user.passportNumber)}
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
                  disabled={!isFieldEditable("address")}
                  placeholder="Город, улица, дом"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                />
              </div>

              {/* Роль */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Роль
                </label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleInputChange}
                  disabled={!isFieldEditable("role")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                >
                  <option value="admin">Admin</option>
                  <option value="tasischi">Таъсисчи</option>
                  <option value="nazorat">Nazorat</option>
                  <option value="nazoratbux">Назорат Бухгалтер</option>
                  <option value="rahbar">Rahbar</option>
                  <option value="operator">Operator</option>
                  <option value="boshmexanik">Bosh Mexanik</option>
                  <option value="mehanik">Mehanik</option>
                  <option value="buxgalter">Buxgalter</option>
                  <option value="yurist">Yurist</option>
                  <option value="partner">Partner</option>
                  <option value="electrengineer">Электронщик</option>
                  <option value="metrolog-hududgaz">Худудгаз</option>
                </select>
              </div>

              {/* 🤝 Блок выбора партнёра */}
              {formData.role === "partner" && (
                <div className="md:col-span-2 space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Ҳамкор{" "}
                    {!isFieldEditable("partnerId") &&
                      selectedPartnerId &&
                      currentPartner && (
                        <span className="text-green-500 ml-1">✓</span>
                      )}
                  </label>

                  {!isFieldEditable("partnerId") ? (
                    <div className="px-3 py-2 bg-gray-100 rounded-lg text-gray-700">
                      {currentPartner
                        ? `${currentPartner.name}${
                            currentPartner.inn
                              ? ` (ИНН: ${currentPartner.inn})`
                              : ""
                          }`
                        : user.partnerId
                        ? `ID: ${user.partnerId}`
                        : "Ҳамкор бириктирилмаган"}
                    </div>
                  ) : partnersLoading ? (
                    <div className="text-sm text-gray-500">
                      Ҳамкорлар юкланмоқда...
                    </div>
                  ) : partners.length === 0 ? (
                    <div className="text-sm text-red-500">
                      Базада ҳамкорлар йўқ. Аввал «Ҳамкорлар» бўлимида қўшинг.
                    </div>
                  ) : (
                    <>
                      <input
                        type="text"
                        placeholder="Қидириш: номи ёки ИНН..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        value={searchPartner}
                        onChange={(e) => setSearchPartner(e.target.value)}
                      />

                      <div className="max-h-56 overflow-y-auto border border-gray-300 rounded-lg bg-white">
                        {filteredPartners.length === 0 ? (
                          <div className="p-3 text-sm text-gray-500">
                            Ҳамкор топилмади
                          </div>
                        ) : (
                          filteredPartners.map((p) => (
                            <label
                              key={p.id}
                              className={`flex items-center gap-3 px-3 py-2 cursor-pointer border-b last:border-b-0 transition-colors ${
                                selectedPartnerId === p.id
                                  ? "bg-blue-50"
                                  : "hover:bg-gray-50"
                              }`}
                            >
                              <input
                                type="radio"
                                name="partnerSelectEdit"
                                value={p.id}
                                checked={selectedPartnerId === p.id}
                                onChange={() => setSelectedPartnerId(p.id)}
                                className="w-4 h-4"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-gray-800 truncate">
                                  {p.name}
                                </div>
                                <div className="text-xs text-gray-500 truncate">
                                  ИНН: {p.inn || "—"} • Раҳбар:{" "}
                                  {p.director || "—"}
                                </div>
                              </div>
                              {selectedPartnerId === p.id && (
                                <span className="text-green-500 text-lg">
                                  ✓
                                </span>
                              )}
                            </label>
                          ))
                        )}
                      </div>

                      {selectedPartnerId && (
                        <div className="text-xs text-green-600">
                          ✓ Танланди: {currentPartner?.name || "—"}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Прикрепленные станции */}
              <div className="md:col-span-2 space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Прикрепленные станции
                  {!isFieldEditable("stations") &&
                    selectedStations.length > 0 && (
                      <span className="text-green-500 ml-1">
                        ({selectedStations.length})
                      </span>
                    )}
                </label>
                {isFieldEditable("stations") ? (
                  <button
                    type="button"
                    onClick={() => setShowStations(true)}
                    className="w-full px-3 py-2 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-600 hover:text-gray-700 transition-colors"
                  >
                    Управление станциями ({selectedStations.length})
                  </button>
                ) : (
                  <div className="px-3 py-2 bg-gray-100 rounded-lg text-gray-700">
                    {selectedStations.length > 0
                      ? `Прикреплено станций: ${selectedStations.length}`
                      : "Станции не прикреплены"}
                  </div>
                )}
                {isFieldEditable("stations") && (
                  <div className="text-xs text-gray-500">
                    Нажмите для управления списком прикрепленных станций
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
            {!isEditing ? (
              <>
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Закрыть
                </button>
                {!readOnly && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    Редактировать
                  </button>
                )}
              </>
            ) : (
              <>
                <button
                  onClick={handleCancel}
                  disabled={loading}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  Отмена
                </button>
                <button
                  onClick={handleSave}
                  disabled={loading}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {loading ? "Сохранение..." : "Сохранить"}
                </button>
              </>
            )}
          </div>
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

export default UserModal;
