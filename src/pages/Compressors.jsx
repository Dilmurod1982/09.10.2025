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
} from "lucide-react";
import { useAppStore } from "../lib/zustand"; // Импортируем хранилище

const Compressors = () => {
  const userData = useAppStore((state) => state.userData);
  const [compressors, setCompressors] = useState([]);
  const [typeCompressors, setTypeCompressors] = useState([]);
  const [selectedCompressor, setSelectedCompressor] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [uploadingFile, setUploadingFile] = useState(false);

  // Проверка роли пользователя
  const isAdmin = userData?.role === "admin";

  // Данные для нового компрессора
  const [newCompressor, setNewCompressor] = useState({
    typeCompressorId: "",
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
        // Загружаем типы компрессоров
        const typeCompressorsSnapshot = await getDocs(
          collection(db, "typecompressors")
        );
        const typeCompressorsData = typeCompressorsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setTypeCompressors(typeCompressorsData);

        // Загружаем компрессоры
        const compressorsSnapshot = await getDocs(
          collection(db, "compressors")
        );
        const compressorsData = compressorsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setCompressors(compressorsData);
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
    const currentData = isCreating ? newCompressor : selectedCompressor;

    if (!currentData) return false;

    // Обязательные поля
    const requiredFields = [
      "typeCompressorId",
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

    return allFieldsFilled;
  };

  // Фильтрация компрессоров по поиску
  const filteredCompressors = compressors.filter(
    (compressor) =>
      compressor.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      compressor.model?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      compressor.serialNumber?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Обработчик изменения полей
  const handleInputChange = (field, value) => {
    if (isCreating) {
      setNewCompressor((prev) => ({ ...prev, [field]: value }));
    } else {
      setSelectedCompressor((prev) => ({ ...prev, [field]: value }));
    }
  };

  // Обработчик изменения документов покупки
  const handlePurchaseDocumentsChange = (field, value) => {
    if (isCreating) {
      setNewCompressor((prev) => ({
        ...prev,
        purchaseDocuments: {
          ...prev.purchaseDocuments,
          [field]: value,
        },
      }));
    } else {
      setSelectedCompressor((prev) => ({
        ...prev,
        purchaseDocuments: {
          ...prev.purchaseDocuments,
          [field]: value,
        },
      }));
    }
  };

  // Обработчик выбора типа компрессора
  const handleTypeCompressorChange = (typeId) => {
    const selectedType = typeCompressors.find((type) => type.id === typeId);
    if (selectedType) {
      if (isCreating) {
        setNewCompressor((prev) => ({
          ...prev,
          typeCompressorId: typeId,
          brand: selectedType.brand,
          model: selectedType.model,
        }));
      } else {
        setSelectedCompressor((prev) => ({
          ...prev,
          typeCompressorId: typeId,
          brand: selectedType.brand,
          model: selectedType.model,
        }));
      }
    } else {
      // Если тип не выбран, очищаем поля
      if (isCreating) {
        setNewCompressor((prev) => ({
          ...prev,
          typeCompressorId: "",
          brand: "",
          model: "",
        }));
      } else {
        setSelectedCompressor((prev) => ({
          ...prev,
          typeCompressorId: "",
          brand: "",
          model: "",
        }));
      }
    }
  };

  // Валидация года выпуска
  const isManufactureYearValid = () => {
    const currentData = isCreating ? newCompressor : selectedCompressor;
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

  // ИСПРАВЛЕННАЯ ЗАГРУЗКА ФАЙЛА - как в AddDocumentModal
  const handleFileUpload = async (file) => {
    if (!file) return;

    console.log(file.name, "Файла юкланиш бошланди:");

    if (file.type !== "application/pdf") {
      alert("Илтимос, фақат PDF файл юкланг");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("Файл хажми катта. Максимал: 5MB");
      return;
    }

    setUploadingFile(true);
    try {
      // Создаем уникальное имя файла как в AddDocumentModal
      const fileName = `purchase-document_${Date.now()}_${file.name}`;
      const fileRef = ref(storage, `purchase-documents/${fileName}`);

      console.log("Загрузка файла в:", `purchase-documents/${fileName}`);

      // Загружаем файл
      const snapshot = await uploadBytes(fileRef, file);
      console.log("Файл юкланди, snapshot:", snapshot);

      // Получаем URL для скачивания
      const downloadURL = await getDownloadURL(snapshot.ref);
      console.log("URL получен:", downloadURL);

      // Обновляем состояние
      if (isCreating) {
        setNewCompressor((prev) => ({
          ...prev,
          purchaseDocuments: {
            ...prev.purchaseDocuments,
            fileUrl: downloadURL,
            fileName: file.name,
          },
        }));
      } else {
        setSelectedCompressor((prev) => ({
          ...prev,
          purchaseDocuments: {
            ...prev.purchaseDocuments,
            fileUrl: downloadURL,
            fileName: file.name,
          },
        }));
      }

      console.log("Состояние обновлено");
    } catch (error) {
      console.error("Error uploading file:", error);
      console.error("Error details:", {
        code: error.code,
        message: error.message,
        stack: error.stack,
      });
      alert(`${error.message} файл юланишида хатолик `);
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
    // Очищаем значение input чтобы можно было выбрать тот же файл снова
    e.target.value = "";
  };

  // Открытие модального окна для просмотра компрессора
  const handleCompressorClick = (compressor) => {
    setSelectedCompressor({ ...compressor });
    setIsModalOpen(true);
    setIsEditMode(false);
  };

  // Открытие модального окна для создания компрессора
  const handleCreateCompressor = () => {
    if (!isAdmin) {
      alert("Сизда компрессор қўшиш учун рухсат йўқ");
      return;
    }
    setIsCreating(true);
    setIsModalOpen(true);
    setNewCompressor({
      typeCompressorId: "",
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
    setSelectedCompressor(null);
    setUploadingFile(false);
  };

  // Редактирование компрессора
  const handleEdit = () => {
    if (!isAdmin) {
      alert("Сизда компрессорни таҳрирлаш учун рухсат йўқ");
      return;
    }
    setIsEditMode(true);
  };

  // Сохранение изменений
  const handleSave = async () => {
    if (!isAdmin) {
      alert("Сизда сақлаш учун рухсат йўқ");
      return;
    }

    const isValid = checkFormValidity() && isManufactureYearValid();
    if (!isValid) return;

    try {
      if (isCreating) {
        await addDoc(collection(db, "compressors"), {
          ...newCompressor,
          manufactureYear: parseInt(newCompressor.manufactureYear),
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      } else {
        await updateDoc(doc(db, "compressors", selectedCompressor.id), {
          ...selectedCompressor,
          manufactureYear: parseInt(selectedCompressor.manufactureYear),
          updatedAt: new Date(),
        });
      }

      // Перезагрузка данных
      const compressorsSnapshot = await getDocs(collection(db, "compressors"));
      const compressorsData = compressorsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setCompressors(compressorsData);

      handleCloseModal();
    } catch (error) {
      console.error("Error saving compressor:", error);
    }
  };

  // Удаление компрессора
  const handleDelete = async (compressorId) => {
    if (!isAdmin) {
      alert("Сизда компрессорни ўчириш учун рухсат йўқ");
      return;
    }

    if (window.confirm("Сиз мазкур компрессорни ўчиришга аминмисиз?")) {
      try {
        await deleteDoc(doc(db, "compressors", compressorId));
        setCompressors(compressors.filter((comp) => comp.id !== compressorId));
      } catch (error) {
        console.error("Error deleting compressor:", error);
      }
    }
  };

  // Отмена редактирования
  const handleCancel = () => {
    if (isCreating) {
      handleCloseModal();
    } else {
      setIsEditMode(false);
      // Восстанавливаем исходные данные из базы
      const originalCompressor = compressors.find(
        (compressor) => compressor.id === selectedCompressor.id
      );
      setSelectedCompressor(
        originalCompressor ? { ...originalCompressor } : null
      );
    }
  };

  // Получение текущей станции компрессора
  const getCurrentStation = (compressor) => {
    if (
      !compressor.movementHistory ||
      compressor.movementHistory.length === 0
    ) {
      return "Белгиланмаган";
    }

    const sortedHistory = compressor.movementHistory
      .filter((move) => move.toStation)
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    return sortedHistory.length > 0
      ? sortedHistory[0].toStation
      : "Белгиланмаган";
  };

  // Проверяем валидность формы для отображения
  const isFormValid = checkFormValidity() && isManufactureYearValid();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-100 flex items-center justify-center">
        <motion.div
          className="w-12 h-12 border-4 border-cyan-200 border-t-cyan-600 rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-100 p-4 lg:p-8">
      {/* Заголовок и кнопка добавления */}
      <motion.div
        className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}>
        <div>
          <h1 className="text-3xl lg:text-4xl font-bold text-gray-800 mb-2">
            Компрессорлар
          </h1>
          <p className="text-gray-600">
            Компрессорларни бошқариш ва уларни харакат тарихи
          </p>
          {/* Информация о правах доступа */}
          {/* {!isAdmin && (
            <div className="mt-2 p-2 bg-blue-100 border border-blue-300 rounded-lg">
              <p className="text-blue-800 text-sm">
                <strong>Информация:</strong> Компрессор қўшиш, таҳрирлаш ва
                ўчириш фақат администраторлар учун рухсат этилган.
              </p>
            </div>
          )} */}
        </div>

        {/* Кнопка добавления - только для admin */}
        {isAdmin && (
          <motion.button
            className="bg-gradient-to-r from-blue-500 to-cyan-600 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2 w-full lg:w-auto justify-center"
            onClick={handleCreateCompressor}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}>
            <Plus size={20} />
            Компрессор қўшиш
          </motion.button>
        )}
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
              placeholder="Марка, модели ёки завод рақами билан қидириш..."
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

      {/* Таблица компрессоров */}
      <motion.div
        className="bg-white rounded-2xl shadow-sm overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.2 }}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-blue-500 to-cyan-600 text-white">
                <th className="px-4 py-4 text-left font-semibold">Маркаси</th>
                <th className="px-4 py-4 text-left font-semibold">Модели</th>
                <th className="px-4 py-4 text-left font-semibold hidden md:table-cell">
                  Завод рақами
                </th>
                <th className="px-4 py-4 text-left font-semibold hidden lg:table-cell">
                  И/ч йили
                </th>
                <th className="px-4 py-4 text-left font-semibold hidden xl:table-cell">
                  Жорий заправкада
                </th>
                <th className="px-4 py-4 text-left font-semibold">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredCompressors.map((compressor, index) => (
                <motion.tr
                  key={compressor.id}
                  className="hover:bg-blue-50 transition-colors duration-200 cursor-pointer group"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                  whileHover={{ scale: 1.01 }}>
                  <td
                    className="px-4 py-4"
                    onClick={() => handleCompressorClick(compressor)}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                        <Settings className="text-blue-600" size={20} />
                      </div>
                      <div className="font-semibold text-gray-800">
                        {compressor.brand}
                      </div>
                    </div>
                  </td>
                  <td
                    className="px-4 py-4"
                    onClick={() => handleCompressorClick(compressor)}>
                    <div className="flex items-center gap-2">
                      <Package className="text-blue-500" size={16} />
                      <span className="font-medium text-gray-700">
                        {compressor.model}
                      </span>
                    </div>
                  </td>
                  <td
                    className="px-4 py-4 text-gray-600 hidden md:table-cell"
                    onClick={() => handleCompressorClick(compressor)}>
                    <div className="flex items-center gap-2">
                      <Hash className="text-purple-500" size={16} />
                      <span className="font-medium">
                        {compressor.serialNumber || "Кўрсатилмаган"}
                      </span>
                    </div>
                  </td>
                  <td
                    className="px-4 py-4 text-gray-600 hidden lg:table-cell"
                    onClick={() => handleCompressorClick(compressor)}>
                    <div className="flex items-center gap-2">
                      <Clock className="text-green-500" size={16} />
                      <span className="font-medium">
                        {compressor.manufactureYear || "Кўрсатилмаган"}
                      </span>
                    </div>
                  </td>
                  <td
                    className="px-4 py-4 text-gray-600 hidden xl:table-cell"
                    onClick={() => handleCompressorClick(compressor)}>
                    <div className="flex items-center gap-2">
                      <Building className="text-orange-500" size={16} />
                      <span className="font-medium">
                        {getCurrentStation(compressor)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <motion.button
                        onClick={() => handleCompressorClick(compressor)}
                        className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        title="Кўриш">
                        <Edit size={16} />
                      </motion.button>
                      {/* Кнопка удаления - только для admin */}
                      {isAdmin && (
                        <motion.button
                          onClick={() => handleDelete(compressor.id)}
                          className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          title="Ўчириш">
                          <Trash2 size={16} />
                        </motion.button>
                      )}
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredCompressors.length === 0 && (
          <motion.div
            className="text-center py-12"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}>
            <Settings className="mx-auto text-gray-400 mb-4" size={48} />
            <h3 className="text-lg font-semibold text-gray-600 mb-2">
              {searchTerm
                ? "Компрессорлар топилмади"
                : "Компрессорлар қўшилмаган"}
            </h3>
            <p className="text-gray-500 mb-4">
              {searchTerm
                ? "Қидириш шартини ўзгартириб кўринг"
                : "Биринчи компрессорни қўшишдан бошланг"}
            </p>
            {!searchTerm && isAdmin && (
              <button
                onClick={handleCreateCompressor}
                className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors">
                Компрессор қўшиш
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
              <div className="bg-gradient-to-r from-blue-500 to-cyan-600 text-white p-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold">
                    {isCreating
                      ? "Компрессор яратиш"
                      : isEditMode
                      ? "Компрессорни таҳрирлаш"
                      : "Компрессор ҳақида маълумот"}
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
                      <Settings size={18} />
                      Асосий маълумот
                    </h3>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div>
                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                          <Package size={16} />
                          Компрессор тури *
                        </label>
                        <select
                          value={
                            isCreating
                              ? newCompressor.typeCompressorId
                              : selectedCompressor?.typeCompressorId || ""
                          }
                          onChange={(e) =>
                            handleTypeCompressorChange(e.target.value)
                          }
                          disabled={!isCreating && !isEditMode}
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500">
                          <option value="">Компрессора турини танланг</option>
                          {typeCompressors.map((type) => (
                            <option key={type.id} value={type.id}>
                              {type.brand} {type.model}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                          <Hash size={16} />
                          Завод рақами *
                        </label>
                        <input
                          type="text"
                          value={
                            isCreating
                              ? newCompressor.serialNumber
                              : selectedCompressor?.serialNumber || ""
                          }
                          onChange={(e) =>
                            handleInputChange("serialNumber", e.target.value)
                          }
                          disabled={!isCreating && !isEditMode}
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500"
                          placeholder="Завод рақамини киритинг"
                        />
                      </div>

                      <div>
                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                          <Settings size={16} />
                          Компрессор маркаси *
                        </label>
                        <input
                          type="text"
                          value={
                            isCreating
                              ? newCompressor.brand
                              : selectedCompressor?.brand || ""
                          }
                          readOnly
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-500 cursor-not-allowed"
                          placeholder="Компрессор турини танланг"
                        />
                      </div>

                      <div>
                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                          <Package size={16} />
                          Компрессор модели *
                        </label>
                        <input
                          type="text"
                          value={
                            isCreating
                              ? newCompressor.model
                              : selectedCompressor?.model || ""
                          }
                          readOnly
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-500 cursor-not-allowed"
                          placeholder="Компрессор турини танланг"
                        />
                      </div>

                      <div>
                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                          <Clock size={16} />
                          Ишлаб чиқарилган йили *
                        </label>
                        <input
                          type="text"
                          value={
                            isCreating
                              ? newCompressor.manufactureYear
                              : selectedCompressor?.manufactureYear || ""
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
                          placeholder="Мисол: 2023"
                          maxLength={4}
                        />
                        {!isManufactureYearValid() && (
                          <motion.div
                            className="flex items-center gap-2 text-red-600 text-sm mt-2"
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}>
                            <X size={16} />
                            Тўғри йилни киритинг (1900-
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
                      Сотиб олиш хужжатлари
                    </h3>

                    <div className="space-y-4">
                      <div>
                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                          Хужжатлар тавсифи
                        </label>
                        <textarea
                          value={
                            isCreating
                              ? newCompressor.purchaseDocuments?.description
                              : selectedCompressor?.purchaseDocuments
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
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500 resize-none"
                          placeholder="Сотиб олиш хужжатлар тавсифи (максимум 200 та белги)"
                        />
                        <div className="text-right text-sm text-gray-500 mt-1">
                          {isCreating
                            ? newCompressor.purchaseDocuments?.description
                                ?.length || 0
                            : selectedCompressor?.purchaseDocuments?.description
                                ?.length || 0}
                          /200
                        </div>
                      </div>

                      <div>
                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                          Хужжат файли (PDF)
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
                                Файл юкланмоқда...
                              </div>
                            )}
                            {/* Отладочная информация */}
                            {(isCreating
                              ? newCompressor.purchaseDocuments?.fileUrl
                              : selectedCompressor?.purchaseDocuments
                                  ?.fileUrl) && (
                              <div className="flex items-center gap-2 text-green-600 text-sm">
                                <FileText size={16} />
                                Файл мувафақиятли юкланди:{" "}
                                {isCreating
                                  ? newCompressor.purchaseDocuments.fileName
                                  : selectedCompressor.purchaseDocuments
                                      .fileName}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div>
                            {selectedCompressor?.purchaseDocuments?.fileUrl ? (
                              <div className="flex items-center gap-2">
                                <FileText
                                  className="text-green-500"
                                  size={20}
                                />
                                <span className="text-gray-700">
                                  {
                                    selectedCompressor.purchaseDocuments
                                      .fileName
                                  }
                                </span>
                                <a
                                  href={
                                    selectedCompressor.purchaseDocuments.fileUrl
                                  }
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="ml-2 p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                                  title="Юклаш">
                                  <Download size={16} />
                                </a>
                              </div>
                            ) : (
                              <span className="text-gray-500">
                                Файл юкланмади
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
                      Заправкалар бўйича харакат
                    </h3>

                    {!isCreating &&
                    selectedCompressor?.movementHistory?.length > 0 ? (
                      <div className="space-y-3">
                        {selectedCompressor.movementHistory
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
                        <p>Заправкалар бўйича харакати мавжуд эмас</p>
                        <p className="text-sm">
                          Харакати биронта заправкага бириктирилганидан сўнг
                          кўринишни бошлайди
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
                              Барча тўлдирилиши зарурий каторлар тўлдирилди
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
                              Барча тўлдирилиши зарурий каторлар тўлдиринг (*)
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
                      Таҳрирлаш
                    </motion.button>
                  )}

                  {(isCreating || isEditMode) && (
                    <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                      <motion.button
                        onClick={handleCancel}
                        className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-100 transition-colors"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}>
                        Бекор
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
                        Сақлаш
                      </motion.button>
                    </div>
                  )}

                  {!isCreating && !isEditMode && (
                    <motion.button
                      onClick={handleCloseModal}
                      className="w-full sm:w-auto px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-100 transition-colors"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}>
                      Ёпиш
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

export default Compressors;
