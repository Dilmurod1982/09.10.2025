import React, { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  deleteDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase/config";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  X,
  Edit,
  Save,
  Search,
  Filter,
  Settings,
  Package,
  FileText,
  Download,
  Trash2,
  MapPin,
  Calendar,
  Truck,
  Building,
  Hash,
  Clock,
  Snowflake,
  Thermometer,
} from "lucide-react";

const Chillers = () => {
  const [chillers, setChillers] = useState([]);
  const [typeChillers, setTypeChillers] = useState([]);
  const [selectedChiller, setSelectedChiller] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [uploadingFile, setUploadingFile] = useState(false);

  // Данные для нового чиллера
  const [newChiller, setNewChiller] = useState({
    typeChillerId: "",
    brand: "",
    model: "",
    serialNumber: "",
    manufactureYear: "",
    purchaseDocuments: {
      description: "",
      fileUrl: "",
      fileName: "",
    },
    movementHistory: [],
  });

  // Загрузка данных
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // Загружаем типы чиллеров
        const typeChillersSnapshot = await getDocs(
          collection(db, "typeofgasChillers")
        );
        const typeChillersData = typeChillersSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setTypeChillers(typeChillersData);

        // Загружаем чиллеры
        const chillersSnapshot = await getDocs(collection(db, "gasChillers"));
        const chillersData = chillersSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setChillers(chillersData);
      } catch (error) {
        console.error("Error loading data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Проверка заполнения формы
  const checkFormValidity = () => {
    const currentData = isCreating ? newChiller : selectedChiller;

    if (!currentData) return false;

    // Обязательные поля
    const requiredFields = [
      "typeChillerId",
      "brand",
      "model",
      "serialNumber",
      "manufactureYear",
    ];
    const allFieldsFilled = requiredFields.every(
      (field) =>
        currentData[field] && currentData[field].toString().trim() !== ""
    );

    // Проверка года выпуска
    if (currentData.manufactureYear) {
      const year = parseInt(currentData.manufactureYear);
      const currentYear = new Date().getFullYear();
      if (year < 1900 || year > currentYear + 1) {
        return false;
      }
    }

    // Проверка описания документов (хотя бы один символ)
    const descriptionValid =
      currentData.purchaseDocuments?.description &&
      currentData.purchaseDocuments.description.trim().length > 0;

    return allFieldsFilled && descriptionValid;
  };

  // Фильтрация чиллеров по поиску
  const filteredChillers = chillers.filter(
    (chiller) =>
      chiller.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      chiller.model?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      chiller.serialNumber?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Обработчик изменения полей
  const handleInputChange = (field, value) => {
    if (isCreating) {
      setNewChiller((prev) => ({ ...prev, [field]: value }));
    } else {
      setSelectedChiller((prev) => ({ ...prev, [field]: value }));
    }
  };

  // Обработчик изменения документов покупки
  const handlePurchaseDocumentsChange = (field, value) => {
    if (isCreating) {
      setNewChiller((prev) => ({
        ...prev,
        purchaseDocuments: {
          ...prev.purchaseDocuments,
          [field]: value,
        },
      }));
    } else {
      setSelectedChiller((prev) => ({
        ...prev,
        purchaseDocuments: {
          ...prev.purchaseDocuments,
          [field]: value,
        },
      }));
    }
  };

  // Обработчик выбора типа чиллера
  const handleTypeChillerChange = (typeId) => {
    const selectedType = typeChillers.find((type) => type.id === typeId);
    if (selectedType) {
      if (isCreating) {
        setNewChiller((prev) => ({
          ...prev,
          typeChillerId: typeId,
          brand: selectedType.brand,
          model: selectedType.model,
        }));
      } else {
        setSelectedChiller((prev) => ({
          ...prev,
          typeChillerId: typeId,
          brand: selectedType.brand,
          model: selectedType.model,
        }));
      }
    } else {
      // Если тип не выбран, очищаем поля
      if (isCreating) {
        setNewChiller((prev) => ({
          ...prev,
          typeChillerId: "",
          brand: "",
          model: "",
        }));
      } else {
        setSelectedChiller((prev) => ({
          ...prev,
          typeChillerId: "",
          brand: "",
          model: "",
        }));
      }
    }
  };

  // Валидация года выпуска
  const isManufactureYearValid = () => {
    const currentData = isCreating ? newChiller : selectedChiller;
    if (!currentData?.manufactureYear) return true;

    const year = parseInt(currentData.manufactureYear);
    const currentYear = new Date().getFullYear();
    return year >= 1900 && year <= currentYear + 1;
  };

  // Обработчик изменения года выпуска
  const handleManufactureYearChange = (value) => {
    // Разрешаем только цифры
    const numericValue = value.replace(/[^\d]/g, "");

    // Ограничиваем длину 4 символами
    if (numericValue.length <= 4) {
      handleInputChange("manufactureYear", numericValue);
    }
  };

  // Загрузка файла
  const handleFileUpload = async (file) => {
    if (!file) return;

    if (file.type !== "application/pdf") {
      alert("Пожалуйста, загружайте только PDF файлы");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("Файл слишком большой. Максимальный размер: 5MB");
      return;
    }

    setUploadingFile(true);
    try {
      const fileName = `purchase-document_${Date.now()}_${file.name}`;
      const fileRef = ref(storage, `purchase-documents/${fileName}`);

      const snapshot = await uploadBytes(fileRef, file);

      const downloadURL = await getDownloadURL(snapshot.ref);

      if (isCreating) {
        setNewChiller((prev) => ({
          ...prev,
          purchaseDocuments: {
            ...prev.purchaseDocuments,
            fileUrl: downloadURL,
            fileName: file.name,
          },
        }));
      } else {
        setSelectedChiller((prev) => ({
          ...prev,
          purchaseDocuments: {
            ...prev.purchaseDocuments,
            fileUrl: downloadURL,
            fileName: file.name,
          },
        }));
      }
    } catch (error) {
      alert(`Ошибка при загрузке файла: ${error.message}`);
    } finally {
      setUploadingFile(false);
    }
  };

  // Обработчик изменения файла в input
  const handleFileInputChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      handleFileUpload(file);
    }
    e.target.value = "";
  };

  // Открытие модального окна для просмотра чиллера
  const handleChillerClick = (chiller) => {
    setSelectedChiller({ ...chiller });
    setIsModalOpen(true);
    setIsEditMode(false);
  };

  // Открытие модального окна для создания чиллера
  const handleCreateChiller = () => {
    setIsCreating(true);
    setIsModalOpen(true);
    setNewChiller({
      typeChillerId: "",
      brand: "",
      model: "",
      serialNumber: "",
      manufactureYear: "",
      purchaseDocuments: {
        description: "",
        fileUrl: "",
        fileName: "",
      },
      movementHistory: [],
    });
  };

  // Закрытие модального окна
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setIsEditMode(false);
    setIsCreating(false);
    setSelectedChiller(null);
    setUploadingFile(false);
  };

  // Редактирование чиллера
  const handleEdit = () => {
    setIsEditMode(true);
  };

  // Сохранение изменений
  const handleSave = async () => {
    const isValid = checkFormValidity() && isManufactureYearValid();
    if (!isValid) return;

    try {
      if (isCreating) {
        await addDoc(collection(db, "gasChillers"), {
          ...newChiller,
          manufactureYear: parseInt(newChiller.manufactureYear),
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      } else {
        await updateDoc(doc(db, "gasChillers", selectedChiller.id), {
          ...selectedChiller,
          manufactureYear: parseInt(selectedChiller.manufactureYear),
          updatedAt: new Date(),
        });
      }

      // Перезагрузка данных
      const chillersSnapshot = await getDocs(collection(db, "gasChillers"));
      const chillersData = chillersSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setChillers(chillersData);

      handleCloseModal();
    } catch (error) {
      console.error("Error saving chiller:", error);
    }
  };

  // Удаление чиллера
  const handleDelete = async (chillerId) => {
    if (window.confirm("Вы уверены, что хотите удалить этот чиллер?")) {
      try {
        await deleteDoc(doc(db, "gasChillers", chillerId));
        setChillers(chillers.filter((chill) => chill.id !== chillerId));
      } catch (error) {
        console.error("Error deleting chiller:", error);
      }
    }
  };

  // Отмена редактирования
  const handleCancel = () => {
    if (isCreating) {
      handleCloseModal();
    } else {
      setIsEditMode(false);
      const originalChiller = chillers.find(
        (chiller) => chiller.id === selectedChiller.id
      );
      setSelectedChiller(originalChiller ? { ...originalChiller } : null);
    }
  };

  // Получение текущей станции чиллера
  const getCurrentStation = (chiller) => {
    if (!chiller.movementHistory || chiller.movementHistory.length === 0) {
      return "Не назначена";
    }

    const sortedHistory = chiller.movementHistory
      .filter((move) => move.toStation)
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    return sortedHistory.length > 0
      ? sortedHistory[0].toStation
      : "Не назначена";
  };

  // Проверяем валидность формы для отображения
  const isFormValid = checkFormValidity() && isManufactureYearValid();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <motion.div
          className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 lg:p-8">
      {/* Заголовок и кнопка добавления */}
      <motion.div
        className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}>
        <div>
          <h1 className="text-3xl lg:text-4xl font-bold text-gray-800 mb-2">
            Чиллеры
          </h1>
          <p className="text-gray-600">
            Управление чиллерами для охлаждения газа и их движением по станциям
          </p>
        </div>

        <motion.button
          className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2 w-full lg:w-auto justify-center"
          onClick={handleCreateChiller}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}>
          <Plus size={20} />
          Добавить чиллер
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
              placeholder="Поиск по марке, модели или заводскому номеру..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
            />
          </div>
          <button className="px-4 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors duration-300 flex items-center gap-2 justify-center">
            <Filter size={20} />
            <span className="hidden lg:inline">Фильтры</span>
          </button>
        </div>
      </motion.div>

      {/* Таблица чиллеров */}
      <motion.div
        className="bg-white rounded-2xl shadow-sm overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.2 }}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white">
                <th className="px-4 py-4 text-left font-semibold">Марка</th>
                <th className="px-4 py-4 text-left font-semibold">Модель</th>
                <th className="px-4 py-4 text-left font-semibold hidden md:table-cell">
                  Заводской номер
                </th>
                <th className="px-4 py-4 text-left font-semibold hidden lg:table-cell">
                  Год выпуска
                </th>
                <th className="px-4 py-4 text-left font-semibold hidden xl:table-cell">
                  Текущая станция
                </th>
                <th className="px-4 py-4 text-left font-semibold">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredChillers.map((chiller, index) => (
                <motion.tr
                  key={chiller.id}
                  className="hover:bg-blue-50 transition-colors duration-200 cursor-pointer group"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                  whileHover={{ scale: 1.01 }}>
                  <td
                    className="px-4 py-4"
                    onClick={() => handleChillerClick(chiller)}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                        <Snowflake className="text-blue-600" size={20} />
                      </div>
                      <div className="font-semibold text-gray-800">
                        {chiller.brand}
                      </div>
                    </div>
                  </td>
                  <td
                    className="px-4 py-4"
                    onClick={() => handleChillerClick(chiller)}>
                    <div className="flex items-center gap-2">
                      <Package className="text-blue-500" size={16} />
                      <span className="font-medium text-gray-700">
                        {chiller.model}
                      </span>
                    </div>
                  </td>
                  <td
                    className="px-4 py-4 text-gray-600 hidden md:table-cell"
                    onClick={() => handleChillerClick(chiller)}>
                    <div className="flex items-center gap-2">
                      <Hash className="text-purple-500" size={16} />
                      <span className="font-medium">
                        {chiller.serialNumber || "Не указан"}
                      </span>
                    </div>
                  </td>
                  <td
                    className="px-4 py-4 text-gray-600 hidden lg:table-cell"
                    onClick={() => handleChillerClick(chiller)}>
                    <div className="flex items-center gap-2">
                      <Clock className="text-indigo-500" size={16} />
                      <span className="font-medium">
                        {chiller.manufactureYear || "Не указан"}
                      </span>
                    </div>
                  </td>
                  <td
                    className="px-4 py-4 text-gray-600 hidden xl:table-cell"
                    onClick={() => handleChillerClick(chiller)}>
                    <div className="flex items-center gap-2">
                      <Building className="text-orange-500" size={16} />
                      <span className="font-medium">
                        {getCurrentStation(chiller)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <motion.button
                        onClick={() => handleChillerClick(chiller)}
                        className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        title="Просмотреть">
                        <Edit size={16} />
                      </motion.button>
                      <motion.button
                        onClick={() => handleDelete(chiller.id)}
                        className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        title="Удалить">
                        <Trash2 size={16} />
                      </motion.button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredChillers.length === 0 && (
          <motion.div
            className="text-center py-12"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}>
            <Snowflake className="mx-auto text-gray-400 mb-4" size={48} />
            <h3 className="text-lg font-semibold text-gray-600 mb-2">
              {searchTerm ? "Чиллеры не найдены" : "Чиллеры не добавлены"}
            </h3>
            <p className="text-gray-500 mb-4">
              {searchTerm
                ? "Попробуйте изменить условия поиска"
                : "Начните с добавления первого чиллера"}
            </p>
            {!searchTerm && (
              <button
                onClick={handleCreateChiller}
                className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors">
                Добавить чиллер
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
              <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white p-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold">
                    {isCreating
                      ? "Создание чиллера"
                      : isEditMode
                      ? "Редактирование чиллера"
                      : "Информация о чиллере"}
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
                  <div className="border-b pb-6">
                    <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-800 mb-4">
                      <Thermometer size={18} />
                      Основная информация
                    </h3>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div>
                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                          <Package size={16} />
                          Тип чиллера *
                        </label>
                        <select
                          value={
                            isCreating
                              ? newChiller.typeChillerId
                              : selectedChiller?.typeChillerId || ""
                          }
                          onChange={(e) =>
                            handleTypeChillerChange(e.target.value)
                          }
                          disabled={!isCreating && !isEditMode}
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500">
                          <option value="">Выберите тип чиллера</option>
                          {typeChillers.map((type) => (
                            <option key={type.id} value={type.id}>
                              {type.brand} {type.model}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                          <Hash size={16} />
                          Заводской номер *
                        </label>
                        <input
                          type="text"
                          value={
                            isCreating
                              ? newChiller.serialNumber
                              : selectedChiller?.serialNumber || ""
                          }
                          onChange={(e) =>
                            handleInputChange("serialNumber", e.target.value)
                          }
                          disabled={!isCreating && !isEditMode}
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500"
                          placeholder="Введите заводской номер"
                        />
                      </div>

                      <div>
                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                          <Thermometer size={16} />
                          Марка чиллера *
                        </label>
                        <input
                          type="text"
                          value={
                            isCreating
                              ? newChiller.brand
                              : selectedChiller?.brand || ""
                          }
                          readOnly
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-500 cursor-not-allowed"
                          placeholder="Выберите тип чиллера"
                        />
                      </div>

                      <div>
                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                          <Package size={16} />
                          Модель чиллера *
                        </label>
                        <input
                          type="text"
                          value={
                            isCreating
                              ? newChiller.model
                              : selectedChiller?.model || ""
                          }
                          readOnly
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-500 cursor-not-allowed"
                          placeholder="Выберите тип чиллера"
                        />
                      </div>

                      <div>
                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                          <Clock size={16} />
                          Год выпуска *
                        </label>
                        <input
                          type="text"
                          value={
                            isCreating
                              ? newChiller.manufactureYear
                              : selectedChiller?.manufactureYear || ""
                          }
                          onChange={(e) =>
                            handleManufactureYearChange(e.target.value)
                          }
                          disabled={!isCreating && !isEditMode}
                          className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500 ${
                            !isManufactureYearValid()
                              ? "border-red-300 focus:ring-red-500"
                              : "border-gray-200 focus:ring-blue-500"
                          }`}
                          placeholder="Например: 2023"
                          maxLength={4}
                        />
                        {!isManufactureYearValid() && (
                          <motion.div
                            className="flex items-center gap-2 text-red-600 text-sm mt-2"
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}>
                            <X size={16} />
                            Введите корректный год выпуска (1900-
                            {new Date().getFullYear() + 1})
                          </motion.div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Документы покупки */}
                  <div className="border-b pb-6">
                    <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-800 mb-4">
                      <FileText size={18} />
                      Документы покупки
                    </h3>

                    <div className="space-y-4">
                      <div>
                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                          Описание документов *
                        </label>
                        <textarea
                          value={
                            isCreating
                              ? newChiller.purchaseDocuments?.description
                              : selectedChiller?.purchaseDocuments
                                  ?.description || ""
                          }
                          onChange={(e) =>
                            handlePurchaseDocumentsChange(
                              "description",
                              e.target.value
                            )
                          }
                          disabled={!isCreating && !isEditMode}
                          maxLength={200}
                          rows={3}
                          className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500 resize-none ${
                            (!isCreating
                              ? newChiller.purchaseDocuments?.description
                              : selectedChiller?.purchaseDocuments
                                  ?.description) &&
                            (isCreating
                              ? newChiller.purchaseDocuments?.description
                              : selectedChiller?.purchaseDocuments?.description
                            ).trim().length === 0
                              ? "border-red-300 focus:ring-red-500"
                              : "border-gray-200 focus:ring-blue-500"
                          }`}
                          placeholder="Описание документов покупки (максимум 200 символов)"
                        />
                        <div className="flex justify-between items-center mt-1">
                          <div className="text-sm text-gray-500">
                            {isCreating
                              ? newChiller.purchaseDocuments?.description
                                  ?.length || 0
                              : selectedChiller?.purchaseDocuments?.description
                                  ?.length || 0}
                            /200
                          </div>
                          {(!isCreating
                            ? newChiller.purchaseDocuments?.description
                            : selectedChiller?.purchaseDocuments
                                ?.description) &&
                            (isCreating
                              ? newChiller.purchaseDocuments?.description
                              : selectedChiller?.purchaseDocuments?.description
                            ).trim().length === 0 && (
                              <div className="text-red-600 text-sm flex items-center gap-1">
                                <X size={14} />
                                Обязательное поле
                              </div>
                            )}
                        </div>
                      </div>

                      <div>
                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                          Файл документа (PDF)
                        </label>
                        {isCreating || isEditMode ? (
                          <div className="space-y-2">
                            <input
                              type="file"
                              accept=".pdf"
                              onChange={handleFileInputChange}
                              disabled={uploadingFile}
                              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:bg-gray-50"
                            />
                            {uploadingFile && (
                              <div className="flex items-center gap-2 text-blue-600 text-sm">
                                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                Загрузка файла...
                              </div>
                            )}
                            {(isCreating
                              ? newChiller.purchaseDocuments?.fileUrl
                              : selectedChiller?.purchaseDocuments
                                  ?.fileUrl) && (
                              <div className="flex items-center gap-2 text-green-600 text-sm">
                                <FileText size={16} />
                                Файл успешно загружен:{" "}
                                {isCreating
                                  ? newChiller.purchaseDocuments.fileName
                                  : selectedChiller.purchaseDocuments.fileName}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div>
                            {selectedChiller?.purchaseDocuments?.fileUrl ? (
                              <div className="flex items-center gap-2">
                                <FileText
                                  className="text-green-500"
                                  size={20}
                                />
                                <span className="text-gray-700">
                                  {selectedChiller.purchaseDocuments.fileName}
                                </span>
                                <a
                                  href={
                                    selectedChiller.purchaseDocuments.fileUrl
                                  }
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="ml-2 p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                                  title="Скачать">
                                  <Download size={16} />
                                </a>
                              </div>
                            ) : (
                              <span className="text-gray-500">
                                Файл не загружен
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* История движения */}
                  <div>
                    <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-800 mb-4">
                      <Truck size={18} />
                      История движения по станциям
                    </h3>

                    {!isCreating &&
                    selectedChiller?.movementHistory?.length > 0 ? (
                      <div className="space-y-3">
                        {selectedChiller.movementHistory
                          .sort((a, b) => new Date(b.date) - new Date(a.date))
                          .map((move, index) => (
                            <motion.div
                              key={index}
                              className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg"
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: index * 0.1 }}>
                              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                <MapPin className="text-blue-600" size={16} />
                              </div>
                              <div className="flex-1">
                                <div className="font-medium text-gray-800">
                                  {move.toStation}
                                </div>
                                <div className="flex items-center gap-2 text-sm text-gray-500">
                                  <Calendar size={14} />
                                  {new Date(move.date).toLocaleDateString(
                                    "ru-RU"
                                  )}
                                </div>
                              </div>
                            </motion.div>
                          ))}
                      </div>
                    ) : (
                      <div className="text-center py-6 text-gray-500">
                        <Truck
                          className="mx-auto mb-2 text-gray-400"
                          size={32}
                        />
                        <p>История движения пока отсутствует</p>
                        <p className="text-sm">
                          Движение будет отображаться после прикрепления к
                          станциям
                        </p>
                      </div>
                    )}
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
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ delay: 0.2 }}
                                className="w-2 h-2 bg-white rounded-full"
                              />
                            </motion.div>
                            <span className="text-green-600">
                              Все обязательные поля заполнены корректно
                            </span>
                          </>
                        ) : (
                          <>
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="w-4 h-4 bg-orange-500 rounded-full flex items-center justify-center">
                              <span className="text-white text-xs">!</span>
                            </motion.div>
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
                      className="w-full sm:w-auto bg-blue-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-600 transition-colors flex items-center gap-2 justify-center"
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

export default Chillers;
