import React, { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  X,
  Edit,
  Save,
  Building,
  MapPin,
  User,
  Phone,
  Search,
  Filter,
  CreditCard,
  FileText,
  Users,
  AlertCircle,
  CheckCircle,
} from "lucide-react";

const Ltds = () => {
  const [organizations, setOrganizations] = useState([]);
  const [banks, setBanks] = useState([]);
  const [selectedOrganization, setSelectedOrganization] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [innError, setInnError] = useState("");
  const [accountNumberError, setAccountNumberError] = useState("");

  // Данные для новой организации
  const [newOrganization, setNewOrganization] = useState({
    name: "",
    inn: "",
    city: "",
    street: "",
    building: "",
    bankId: "",
    bankName: "",
    mfo: "",
    accountNumber: "",
    directorName: "",
    directorPhone: "",
    accountantName: "",
    accountantPhone: "",
  });

  // Загрузка данных
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // Загрузка организаций
        const orgsSnapshot = await getDocs(collection(db, "organizations"));
        const orgsData = orgsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setOrganizations(orgsData);

        // Загрузка банков
        const banksSnapshot = await getDocs(collection(db, "banks"));
        const banksData = banksSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setBanks(banksData);
      } catch (error) {
        console.error("Error loading data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Функция валидации ИНН (9 цифр)
  const validateInn = (inn, currentOrgId = null) => {
    if (!inn) {
      return { isValid: true, error: "" };
    }

    // Проверка формата ИНН - 9 цифр
    const innRegex = /^\d{9}$/;
    if (!innRegex.test(inn)) {
      return { isValid: false, error: "ИНН должен содержать 9 цифр" };
    }

    // Проверка на существующий ИНН
    const existingOrg = organizations.find(
      (org) => org.inn === inn && org.id !== currentOrgId
    );

    if (existingOrg) {
      return {
        isValid: false,
        error: `Организация с ИНН ${inn} уже существует: "${existingOrg.name}"`,
      };
    }

    return { isValid: true, error: "" };
  };

  // Функция валидации расчетного счета (20 цифр)
  const validateAccountNumber = (accountNumber) => {
    if (!accountNumber) {
      return { isValid: true, error: "" };
    }

    // Проверка формата расчетного счета - 20 цифр
    const accountRegex = /^\d{20}$/;
    if (!accountRegex.test(accountNumber)) {
      return {
        isValid: false,
        error: "Расчетный счет должен содержать 20 цифр",
      };
    }

    return { isValid: true, error: "" };
  };

  // Функция форматирования телефона
  const formatPhone = (phone) => {
    if (!phone) return phone;

    // Удаляем все нецифровые символы
    const cleaned = phone.replace(/\D/g, "");

    // Форматируем в формат +7 (XXX) XXX-XX-XX
    if (cleaned.length === 11 && cleaned.startsWith("998")) {
      return `+998 (${cleaned.substring(1, 4)}) ${cleaned.substring(
        4,
        7
      )}-${cleaned.substring(5, 7)}-${cleaned.substring(5, 9)}`;
    } else if (cleaned.length === 10) {
      return `+998 (${cleaned.substring(0, 3)}) ${cleaned.substring(
        3,
        6
      )}-${cleaned.substring(6, 8)}-${cleaned.substring(8, 10)}`;
    }

    return phone;
  };

  // Проверка заполнения формы
  const checkFormValidity = () => {
    const currentData = isCreating ? newOrganization : selectedOrganization;

    if (!currentData) return false;

    const requiredFields = [
      "name",
      "inn",
      "city",
      "street",
      "building",
      "bankId",
      "accountNumber",
      "directorName",
      "directorPhone",
    ];

    // Проверка заполнения обязательных полей
    const allFieldsFilled = requiredFields.every(
      (field) =>
        currentData[field] && currentData[field].toString().trim() !== ""
    );

    if (!allFieldsFilled) return false;

    // Валидация ИНН
    const innValidation = validateInn(
      currentData.inn,
      isCreating ? null : selectedOrganization?.id
    );

    // Валидация расчетного счета
    const accountValidation = validateAccountNumber(currentData.accountNumber);

    return innValidation.isValid && accountValidation.isValid;
  };

  // Фильтрация организаций по поиску
  const filteredOrganizations = organizations.filter(
    (org) =>
      org.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      org.inn?.includes(searchTerm) ||
      org.directorName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      org.accountantName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Обработчик выбора банка
  const handleBankChange = (bankId) => {
    const selectedBank = banks.find((bank) => bank.id === bankId);
    if (selectedBank) {
      if (isCreating) {
        setNewOrganization((prev) => ({
          ...prev,
          bankId: selectedBank.id,
          bankName: selectedBank.name,
          mfo: selectedBank.mfo,
        }));
      } else {
        setSelectedOrganization((prev) => ({
          ...prev,
          bankId: selectedBank.id,
          bankName: selectedBank.name,
          mfo: selectedBank.mfo,
        }));
      }
    }
  };

  // Обработчик изменения полей
  const handleInputChange = (field, value) => {
    let processedValue = value;

    // Форматирование телефона
    if ((field === "directorPhone" || field === "accountantPhone") && value) {
      processedValue = formatPhone(value);
    }

    if (isCreating) {
      setNewOrganization((prev) => ({ ...prev, [field]: processedValue }));
    } else {
      setSelectedOrganization((prev) => ({ ...prev, [field]: processedValue }));
    }

    // Валидация ИНН при изменении
    if (field === "inn") {
      const innValidation = validateInn(
        processedValue,
        isCreating ? null : selectedOrganization?.id
      );
      setInnError(innValidation.error);
    }

    // Валидация расчетного счета при изменении
    if (field === "accountNumber") {
      const accountValidation = validateAccountNumber(processedValue);
      setAccountNumberError(accountValidation.error);
    }
  };

  // Открытие модального окна для просмотра организации
  const handleOrganizationClick = (org) => {
    setSelectedOrganization({ ...org });
    setIsModalOpen(true);
    setIsEditMode(false);
    setInnError("");
    setAccountNumberError("");
  };

  // Открытие модального окна для создания организации
  const handleCreateOrganization = () => {
    setIsCreating(true);
    setIsModalOpen(true);
    setNewOrganization({
      name: "",
      inn: "",
      city: "",
      street: "",
      building: "",
      bankId: "",
      bankName: "",
      mfo: "",
      accountNumber: "",
      directorName: "",
      directorPhone: "",
      accountantName: "",
      accountantPhone: "",
    });
    setInnError("");
    setAccountNumberError("");
  };

  // Закрытие модального окна
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setIsEditMode(false);
    setIsCreating(false);
    setSelectedOrganization(null);
    setInnError("");
    setAccountNumberError("");
  };

  // Редактирование организации
  const handleEdit = () => {
    setIsEditMode(true);
  };

  // Сохранение изменений
  const handleSave = async () => {
    const isValid = checkFormValidity();
    if (!isValid) return;

    try {
      if (isCreating) {
        await addDoc(collection(db, "organizations"), {
          ...newOrganization,
          createdAt: new Date(),
        });
      } else {
        await updateDoc(doc(db, "organizations", selectedOrganization.id), {
          ...selectedOrganization,
          updatedAt: new Date(),
        });
      }

      // Перезагрузка данных
      const orgsSnapshot = await getDocs(collection(db, "organizations"));
      const orgsData = orgsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setOrganizations(orgsData);

      handleCloseModal();
    } catch (error) {
      console.error("Error saving organization:", error);
    }
  };

  // Отмена редактирования
  const handleCancel = () => {
    if (isCreating) {
      handleCloseModal();
    } else {
      setIsEditMode(false);
      // Восстанавливаем исходные данные из базы
      const originalOrg = organizations.find(
        (org) => org.id === selectedOrganization.id
      );
      setSelectedOrganization(originalOrg ? { ...originalOrg } : null);
    }
    setInnError("");
    setAccountNumberError("");
  };

  // Проверяем валидность формы для отображения
  const isFormValid = checkFormValidity();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100 flex items-center justify-center">
        <motion.div
          className="w-12 h-12 border-4 border-teal-200 border-t-teal-600 rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100 p-4 lg:p-8">
      {/* Заголовок и кнопка добавления */}
      <motion.div
        className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}>
        <div>
          <h1 className="text-3xl lg:text-4xl font-bold text-gray-800 mb-2">
            Организации
          </h1>
          <p className="text-gray-600">
            Управление юридическими лицами и организациями
          </p>
        </div>

        <motion.button
          className="bg-gradient-to-r from-red-500 to-pink-600 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2 w-full lg:w-auto justify-center"
          onClick={handleCreateOrganization}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}>
          <Plus size={20} />
          Добавить организацию
        </motion.button>
      </motion.div>

      {/* Поиск и фильтры */}
      <motion.div
        className="bg-white rounded-2xl shadow-sm p-4 mb-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}>
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
              size={20}
            />
            <input
              type="text"
              placeholder="Поиск по названию, ИНН, директору или бухгалтеру..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all duration-300"
            />
          </div>
          <button className="px-4 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors duration-300 flex items-center gap-2 justify-center">
            <Filter size={20} />
            <span className="hidden lg:inline">Фильтры</span>
          </button>
        </div>
      </motion.div>

      {/* Таблица организаций */}
      <motion.div
        className="bg-white rounded-2xl shadow-sm overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.2 }}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-teal-500 to-emerald-600 text-white">
                <th className="px-4 py-4 text-left font-semibold">
                  Организация
                </th>
                <th className="px-4 py-4 text-left font-semibold hidden md:table-cell">
                  ИНН
                </th>
                <th className="px-4 py-4 text-left font-semibold hidden lg:table-cell">
                  Банк
                </th>
                <th className="px-4 py-4 text-left font-semibold">Директор</th>
                <th className="px-4 py-4 text-left font-semibold hidden xl:table-cell">
                  Бухгалтер
                </th>
                <th className="px-4 py-4 text-left font-semibold hidden sm:table-cell">
                  Телефон
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredOrganizations.map((org, index) => (
                <motion.tr
                  key={org.id}
                  onClick={() => handleOrganizationClick(org)}
                  className="hover:bg-teal-50 transition-colors duration-200 cursor-pointer group"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                  whileHover={{ scale: 1.01 }}>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center group-hover:bg-teal-200 transition-colors">
                        <Building className="text-teal-600" size={20} />
                      </div>
                      <div>
                        <div className="font-semibold text-gray-800">
                          {org.name}
                        </div>
                        <div className="text-sm text-gray-500 md:hidden">
                          ИНН: {org.inn}
                        </div>
                        <div className="text-sm text-gray-500 lg:hidden">
                          Банк: {org.bankName}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-gray-600 hidden md:table-cell">
                    {org.inn}
                  </td>
                  <td className="px-4 py-4 text-gray-600 hidden lg:table-cell">
                    <div className="flex items-center gap-2">
                      <CreditCard className="text-teal-500" size={16} />
                      <span>{org.bankName}</span>
                    </div>
                    <div className="text-sm text-gray-500">МФО: {org.mfo}</div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="font-medium text-gray-800">
                      {org.directorName}
                    </div>
                    <div className="text-sm text-gray-500 sm:hidden">
                      {org.directorPhone}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-gray-600 hidden xl:table-cell">
                    <div className="font-medium">{org.accountantName}</div>
                    <div className="text-sm text-gray-500">
                      {org.accountantPhone}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-gray-600 hidden sm:table-cell">
                    {org.directorPhone}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredOrganizations.length === 0 && (
          <motion.div
            className="text-center py-12"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}>
            <Building className="mx-auto text-gray-400 mb-4" size={48} />
            <h3 className="text-lg font-semibold text-gray-600 mb-2">
              {searchTerm
                ? "Организации не найдены"
                : "Организации не добавлены"}
            </h3>
            <p className="text-gray-500 mb-4">
              {searchTerm
                ? "Попробуйте изменить условия поиска"
                : "Начните с добавления первой организации"}
            </p>
            {!searchTerm && (
              <button
                onClick={handleCreateOrganization}
                className="bg-teal-500 text-white px-6 py-2 rounded-lg hover:bg-teal-600 transition-colors">
                Добавить организацию
              </button>
            )}
          </motion.div>
        )}
      </motion.div>

      {/* Модальное окно */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleCloseModal}>
            <motion.div
              className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}>
              {/* Заголовок модального окна */}
              <div className="bg-gradient-to-r from-teal-500 to-emerald-600 text-white p-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold">
                    {isCreating
                      ? "Создание организации"
                      : isEditMode
                      ? "Редактирование организации"
                      : "Информация об организации"}
                  </h2>
                  <motion.button
                    onClick={handleCloseModal}
                    className="w-8 h-8 rounded-full bg-white bg-opacity-20 flex items-center justify-center hover:bg-opacity-30 transition-all"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}>
                    <X size={18} />
                  </motion.button>
                </div>
              </div>

              {/* Форма */}
              <div className="p-6 max-h-[60vh] overflow-y-auto">
                <div className="space-y-6">
                  {/* Основная информация */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div>
                      <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                        <Building size={16} />
                        Наименование организации *
                      </label>
                      <input
                        type="text"
                        value={
                          isCreating
                            ? newOrganization.name
                            : selectedOrganization?.name || ""
                        }
                        onChange={(e) =>
                          handleInputChange("name", e.target.value)
                        }
                        disabled={!isCreating && !isEditMode}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500"
                        placeholder="Введите название организации"
                      />
                    </div>

                    <div>
                      <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                        <FileText size={16} />
                        ИНН организации *
                      </label>
                      <input
                        type="text"
                        value={
                          isCreating
                            ? newOrganization.inn
                            : selectedOrganization?.inn || ""
                        }
                        onChange={(e) =>
                          handleInputChange("inn", e.target.value)
                        }
                        disabled={!isCreating && !isEditMode}
                        className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500 ${
                          innError
                            ? "border-red-300 focus:ring-red-500"
                            : "border-gray-200 focus:ring-teal-500"
                        }`}
                        placeholder="9 цифр"
                        maxLength={9}
                      />
                      {innError && (
                        <motion.div
                          className="flex items-center gap-2 text-red-600 text-sm mt-2"
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}>
                          <AlertCircle size={16} />
                          {innError}
                        </motion.div>
                      )}
                    </div>
                  </div>

                  {/* Адрес организации */}
                  <div className="border-t pt-6">
                    <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-800 mb-4">
                      <MapPin size={18} />
                      Адрес организации *
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Город *
                        </label>
                        <input
                          type="text"
                          value={
                            isCreating
                              ? newOrganization.city
                              : selectedOrganization?.city || ""
                          }
                          onChange={(e) =>
                            handleInputChange("city", e.target.value)
                          }
                          disabled={!isCreating && !isEditMode}
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500"
                          placeholder="Город"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Улица *
                        </label>
                        <input
                          type="text"
                          value={
                            isCreating
                              ? newOrganization.street
                              : selectedOrganization?.street || ""
                          }
                          onChange={(e) =>
                            handleInputChange("street", e.target.value)
                          }
                          disabled={!isCreating && !isEditMode}
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500"
                          placeholder="Улица"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Дом *
                        </label>
                        <input
                          type="text"
                          value={
                            isCreating
                              ? newOrganization.building
                              : selectedOrganization?.building || ""
                          }
                          onChange={(e) =>
                            handleInputChange("building", e.target.value)
                          }
                          disabled={!isCreating && !isEditMode}
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500"
                          placeholder="Дом"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Банковские реквизиты */}
                  <div className="border-t pt-6">
                    <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-800 mb-4">
                      <CreditCard size={18} />
                      Банковские реквизиты *
                    </h3>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Банк *
                        </label>
                        <select
                          value={
                            isCreating
                              ? newOrganization.bankId
                              : selectedOrganization?.bankId || ""
                          }
                          onChange={(e) => handleBankChange(e.target.value)}
                          disabled={!isCreating && !isEditMode}
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500">
                          <option value="">Выберите банк</option>
                          {banks.map((bank) => (
                            <option key={bank.id} value={bank.id}>
                              {bank.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          МФО
                        </label>
                        <input
                          type="text"
                          value={
                            isCreating
                              ? newOrganization.mfo
                              : selectedOrganization?.mfo || ""
                          }
                          readOnly
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Расчетный счет *
                        </label>
                        <input
                          type="text"
                          value={
                            isCreating
                              ? newOrganization.accountNumber
                              : selectedOrganization?.accountNumber || ""
                          }
                          onChange={(e) =>
                            handleInputChange("accountNumber", e.target.value)
                          }
                          disabled={!isCreating && !isEditMode}
                          className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500 ${
                            accountNumberError
                              ? "border-red-300 focus:ring-red-500"
                              : "border-gray-200 focus:ring-teal-500"
                          }`}
                          placeholder="20 цифр"
                          maxLength={20}
                        />
                        {accountNumberError && (
                          <motion.div
                            className="flex items-center gap-2 text-red-600 text-sm mt-2"
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}>
                            <AlertCircle size={16} />
                            {accountNumberError}
                          </motion.div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Руководство */}
                  <div className="border-t pt-6">
                    <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-800 mb-4">
                      <Users size={18} />
                      Руководство *
                    </h3>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Директор */}
                      <div className="space-y-4">
                        <h4 className="font-semibold text-gray-700 flex items-center gap-2">
                          <User size={16} />
                          Директор
                        </h4>
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              ФИО директора *
                            </label>
                            <input
                              type="text"
                              value={
                                isCreating
                                  ? newOrganization.directorName
                                  : selectedOrganization?.directorName || ""
                              }
                              onChange={(e) =>
                                handleInputChange(
                                  "directorName",
                                  e.target.value
                                )
                              }
                              disabled={!isCreating && !isEditMode}
                              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500"
                              placeholder="ФИО директора"
                            />
                          </div>
                          <div>
                            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                              <Phone size={16} />
                              Тел. директора *
                            </label>
                            <input
                              type="tel"
                              value={
                                isCreating
                                  ? newOrganization.directorPhone
                                  : selectedOrganization?.directorPhone || ""
                              }
                              onChange={(e) =>
                                handleInputChange(
                                  "directorPhone",
                                  e.target.value
                                )
                              }
                              disabled={!isCreating && !isEditMode}
                              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500"
                              placeholder="+998-XX-XXX-XX-XX"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Бухгалтер */}
                      <div className="space-y-4">
                        <h4 className="font-semibold text-gray-700 flex items-center gap-2">
                          <User size={16} />
                          Бухгалтер
                        </h4>
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              ФИО бухгалтера
                            </label>
                            <input
                              type="text"
                              value={
                                isCreating
                                  ? newOrganization.accountantName
                                  : selectedOrganization?.accountantName || ""
                              }
                              onChange={(e) =>
                                handleInputChange(
                                  "accountantName",
                                  e.target.value
                                )
                              }
                              disabled={!isCreating && !isEditMode}
                              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500"
                              placeholder="ФИО бухгалтера"
                            />
                          </div>
                          <div>
                            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                              <Phone size={16} />
                              Тел. бухгалтера
                            </label>
                            <input
                              type="tel"
                              value={
                                isCreating
                                  ? newOrganization.accountantPhone
                                  : selectedOrganization?.accountantPhone || ""
                              }
                              onChange={(e) =>
                                handleInputChange(
                                  "accountantPhone",
                                  e.target.value
                                )
                              }
                              disabled={!isCreating && !isEditMode}
                              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500"
                              placeholder="+998-XX-XXX-XX-XX"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Индикатор заполнения формы */}
                  {(isCreating || isEditMode) && (
                    <motion.div
                      className="border-t pt-6"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}>
                      <div className="flex items-center gap-2 text-sm">
                        {isFormValid ? (
                          <>
                            <CheckCircle className="text-green-500" size={16} />
                            <span className="text-green-600">
                              Все обязательные поля заполнены корректно
                            </span>
                          </>
                        ) : (
                          <>
                            <AlertCircle
                              className="text-orange-500"
                              size={16}
                            />
                            <span className="text-orange-600">
                              Заполните все обязательные поля (*)
                            </span>
                          </>
                        )}
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>

              {/* Кнопки */}
              <div className="border-t px-6 py-4 bg-gray-50">
                <div className="flex flex-col sm:flex-row gap-3 justify-between items-center">
                  {!isCreating && !isEditMode && (
                    <motion.button
                      onClick={handleEdit}
                      className="w-full sm:w-auto bg-teal-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-teal-600 transition-colors flex items-center gap-2 justify-center"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}>
                      <Edit size={16} />
                      Редактировать
                    </motion.button>
                  )}

                  {(isCreating || isEditMode) && (
                    <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                      <motion.button
                        onClick={handleCancel}
                        className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-100 transition-colors"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}>
                        Отмена
                      </motion.button>
                      <motion.button
                        onClick={handleSave}
                        disabled={!isFormValid}
                        className={`px-6 py-3 rounded-xl font-semibold transition-colors flex items-center gap-2 justify-center ${
                          isFormValid
                            ? "bg-green-500 text-white hover:bg-green-600 cursor-pointer"
                            : "bg-gray-300 text-gray-500 cursor-not-allowed"
                        }`}
                        whileHover={isFormValid ? { scale: 1.02 } : {}}
                        whileTap={isFormValid ? { scale: 0.98 } : {}}>
                        <Save size={16} />
                        Сохранить
                      </motion.button>
                    </div>
                  )}

                  {!isCreating && !isEditMode && (
                    <motion.button
                      onClick={handleCloseModal}
                      className="w-full sm:w-auto px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-100 transition-colors"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}>
                      Закрыть
                    </motion.button>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Ltds;
