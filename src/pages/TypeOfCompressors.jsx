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
  Search,
  Filter,
  Settings,
  Package,
  Globe,
  Hash,
  Zap,
  Gauge,
  Minus,
  Maximize,
} from "lucide-react";

const TypeOfCompressors = () => {
  const [compressors, setCompressors] = useState([]);
  const [selectedCompressor, setSelectedCompressor] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Данные для нового компрессора
  const [newCompressor, setNewCompressor] = useState({
    brand: "",
    model: "",
    country: "",
    maxPower: "",
    minPressure: "",
    maxPressure: "",
  });

  // Загрузка данных
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const compressorsSnapshot = await getDocs(
          collection(db, "typeofcompressors")
        );
        const compressorsData = compressorsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setCompressors(compressorsData);
      } catch (error) {
        console.error("Error loading compressors:", error);
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

    const requiredFields = [
      "brand",
      "model",
      "country",
      "maxPower",
      "minPressure",
      "maxPressure",
    ];

    // Проверка заполнения обязательных полей
    const allFieldsFilled = requiredFields.every(
      (field) =>
        currentData[field] && currentData[field].toString().trim() !== ""
    );

    // Проверка что минимальное давление не больше максимального
    if (currentData.minPressure && currentData.maxPressure) {
      const minPressure = parseFloat(currentData.minPressure);
      const maxPressure = parseFloat(currentData.maxPressure);
      if (minPressure >= maxPressure) {
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
      compressor.country?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Обработчик изменения полей
  const handleInputChange = (field, value) => {
    // Валидация числовых полей
    if (
      (field === "maxPower" ||
        field === "minPressure" ||
        field === "maxPressure") &&
      value
    ) {
      // Разрешаем только числа и точку
      const numericValue = value.replace(/[^\d.]/g, "");
      // Убираем лишние точки
      const parts = numericValue.split(".");
      if (parts.length > 2) {
        value = parts[0] + "." + parts.slice(1).join("");
      } else {
        value = numericValue;
      }
    }

    if (isCreating) {
      setNewCompressor((prev) => ({ ...prev, [field]: value }));
    } else {
      setSelectedCompressor((prev) => ({ ...prev, [field]: value }));
    }
  };

  // Открытие модального окна для просмотра компрессора
  const handleCompressorClick = (compressor) => {
    setSelectedCompressor({ ...compressor });
    setIsModalOpen(true);
    setIsEditMode(false);
  };

  // Открытие модального окна для создания компрессора
  const handleCreateCompressor = () => {
    setIsCreating(true);
    setIsModalOpen(true);
    setNewCompressor({
      brand: "",
      model: "",
      country: "",
      maxPower: "",
      minPressure: "",
      maxPressure: "",
    });
  };

  // Закрытие модального окна
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setIsEditMode(false);
    setIsCreating(false);
    setSelectedCompressor(null);
  };

  // Редактирование компрессора
  const handleEdit = () => {
    setIsEditMode(true);
  };

  // Сохранение изменений
  const handleSave = async () => {
    const isValid = checkFormValidity();
    if (!isValid) return;

    try {
      if (isCreating) {
        await addDoc(collection(db, "typecompressors"), {
          ...newCompressor,
          maxPower: parseFloat(newCompressor.maxPower),
          minPressure: parseFloat(newCompressor.minPressure),
          maxPressure: parseFloat(newCompressor.maxPressure),
          createdAt: new Date(),
        });
      } else {
        await updateDoc(doc(db, "typecompressors", selectedCompressor.id), {
          ...selectedCompressor,
          maxPower: parseFloat(selectedCompressor.maxPower),
          minPressure: parseFloat(selectedCompressor.minPressure),
          maxPressure: parseFloat(selectedCompressor.maxPressure),
          updatedAt: new Date(),
        });
      }

      // Перезагрузка данных
      const compressorsSnapshot = await getDocs(
        collection(db, "typecompressors")
      );
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

  // Проверяем валидность формы для отображения
  const isFormValid = checkFormValidity();

  // Проверка диапазона давления
  const isPressureRangeValid = () => {
    const currentData = isCreating ? newCompressor : selectedCompressor;
    if (!currentData?.minPressure || !currentData?.maxPressure) return true;

    const minPressure = parseFloat(currentData.minPressure);
    const maxPressure = parseFloat(currentData.maxPressure);
    return minPressure < maxPressure;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 flex items-center justify-center">
        <motion.div
          className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 p-4 lg:p-8">
      {/* Заголовок и кнопка добавления */}
      <motion.div
        className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}>
        <div>
          <h1 className="text-3xl lg:text-4xl font-bold text-gray-800 mb-2">
            Модели Компрессоров
          </h1>
          <p className="text-gray-600">
            Управление типами и моделями компрессоров
          </p>
        </div>

        <motion.button
          className="bg-gradient-to-r from-red-500 to-pink-600 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2 w-full lg:w-auto justify-center"
          onClick={handleCreateCompressor}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}>
          <Plus size={20} />
          Добавить модель
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
              placeholder="Поиск по марке, модели или стране..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-300"
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
              <tr className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
                <th className="px-4 py-4 text-left font-semibold">Марка</th>
                <th className="px-4 py-4 text-left font-semibold">Модель</th>
                <th className="px-4 py-4 text-left font-semibold hidden md:table-cell">
                  Мощность
                </th>
                <th className="px-4 py-4 text-left font-semibold hidden lg:table-cell">
                  Давление
                </th>
                <th className="px-4 py-4 text-left font-semibold hidden xl:table-cell">
                  Страна
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredCompressors.map((compressor, index) => (
                <motion.tr
                  key={compressor.id}
                  onClick={() => handleCompressorClick(compressor)}
                  className="hover:bg-indigo-50 transition-colors duration-200 cursor-pointer group"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                  whileHover={{ scale: 1.01 }}>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center group-hover:bg-indigo-200 transition-colors">
                        <Settings className="text-indigo-600" size={20} />
                      </div>
                      <div className="font-semibold text-gray-800">
                        {compressor.brand}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <Package className="text-indigo-500" size={16} />
                      <span className="font-medium text-gray-700">
                        {compressor.model}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-gray-600 hidden md:table-cell">
                    <div className="flex items-center gap-2">
                      <Zap className="text-yellow-500" size={16} />
                      <span className="font-medium">
                        {compressor.maxPower} м³/час
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-gray-600 hidden lg:table-cell">
                    <div className="flex items-center gap-2">
                      <Gauge className="text-blue-500" size={16} />
                      <span className="font-medium">
                        {compressor.minPressure} - {compressor.maxPressure}{" "}
                        кгс/см²
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-gray-600 hidden xl:table-cell">
                    <div className="flex items-center gap-2">
                      <Globe className="text-indigo-500" size={16} />
                      <span>{compressor.country}</span>
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
                ? "Модели компрессоров не найдены"
                : "Модели компрессоров не добавлены"}
            </h3>
            <p className="text-gray-500 mb-4">
              {searchTerm
                ? "Попробуйте изменить условия поиска"
                : "Начните с добавления первой модели компрессора"}
            </p>
            {!searchTerm && (
              <button
                onClick={handleCreateCompressor}
                className="bg-indigo-500 text-white px-6 py-2 rounded-lg hover:bg-indigo-600 transition-colors">
                Добавить модель
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
              className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}>
              {/* Заголовок модального окна */}
              <div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white p-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold">
                    {isCreating
                      ? "Создание модели компрессора"
                      : isEditMode
                      ? "Редактирование модели компрессора"
                      : "Информация о модели компрессора"}
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
                        <Settings size={16} />
                        Марка компрессора *
                      </label>
                      <input
                        type="text"
                        value={
                          isCreating
                            ? newCompressor.brand
                            : selectedCompressor?.brand || ""
                        }
                        onChange={(e) =>
                          handleInputChange("brand", e.target.value)
                        }
                        disabled={!isCreating && !isEditMode}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500"
                        placeholder="Введите марку компрессора"
                      />
                    </div>

                    <div>
                      <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                        <Package size={16} />
                        Модель компрессора *
                      </label>
                      <input
                        type="text"
                        value={
                          isCreating
                            ? newCompressor.model
                            : selectedCompressor?.model || ""
                        }
                        onChange={(e) =>
                          handleInputChange("model", e.target.value)
                        }
                        disabled={!isCreating && !isEditMode}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500"
                        placeholder="Введите модель компрессора"
                      />
                    </div>
                  </div>

                  {/* Страна производитель */}
                  <div>
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                      <Globe size={16} />
                      Страна производитель *
                    </label>
                    <input
                      type="text"
                      value={
                        isCreating
                          ? newCompressor.country
                          : selectedCompressor?.country || ""
                      }
                      onChange={(e) =>
                        handleInputChange("country", e.target.value)
                      }
                      disabled={!isCreating && !isEditMode}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500"
                      placeholder="Введите страну производителя"
                    />
                  </div>

                  {/* Технические характеристики */}
                  <div className="border-t pt-6">
                    <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-800 mb-4">
                      <Zap size={18} />
                      Технические характеристики
                    </h3>

                    {/* Максимальная мощность */}
                    <div className="mb-4">
                      <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                        <Zap size={16} />
                        Максимальная мощность *
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={
                            isCreating
                              ? newCompressor.maxPower
                              : selectedCompressor?.maxPower || ""
                          }
                          onChange={(e) =>
                            handleInputChange("maxPower", e.target.value)
                          }
                          disabled={!isCreating && !isEditMode}
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500 pr-20"
                          placeholder="0.00"
                        />
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">
                          м³/час
                        </div>
                      </div>
                    </div>

                    {/* Диапазон давления */}
                    <div>
                      <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                        <Gauge size={16} />
                        Диапазон давления *
                      </label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="relative">
                          <input
                            type="text"
                            value={
                              isCreating
                                ? newCompressor.minPressure
                                : selectedCompressor?.minPressure || ""
                            }
                            onChange={(e) =>
                              handleInputChange("minPressure", e.target.value)
                            }
                            disabled={!isCreating && !isEditMode}
                            className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500 pr-20 ${
                              !isPressureRangeValid()
                                ? "border-red-300 focus:ring-red-500"
                                : "border-gray-200 focus:ring-indigo-500"
                            }`}
                            placeholder="0.00"
                          />
                          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm flex items-center gap-1">
                            <Minus size={14} />
                            кгс/см²
                          </div>
                        </div>
                        <div className="relative">
                          <input
                            type="text"
                            value={
                              isCreating
                                ? newCompressor.maxPressure
                                : selectedCompressor?.maxPressure || ""
                            }
                            onChange={(e) =>
                              handleInputChange("maxPressure", e.target.value)
                            }
                            disabled={!isCreating && !isEditMode}
                            className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500 pr-20 ${
                              !isPressureRangeValid()
                                ? "border-red-300 focus:ring-red-500"
                                : "border-gray-200 focus:ring-indigo-500"
                            }`}
                            placeholder="0.00"
                          />
                          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm flex items-center gap-1">
                            <Maximize size={14} />
                            кгс/см²
                          </div>
                        </div>
                      </div>
                      {!isPressureRangeValid() && (
                        <motion.div
                          className="flex items-center gap-2 text-red-600 text-sm mt-2"
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}>
                          <X size={16} />
                          Минимальное давление должно быть меньше максимального
                        </motion.div>
                      )}
                    </div>
                  </div>

                  {/* Индикатор заполнения формы */}
                  {(isCreating || isEditMode) && (
                    <motion.div
                      className="border-t pt-6"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}>
                      <div className="flex items-center gap-2 text-sm">
                        {isFormValid && isPressureRangeValid() ? (
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
                              <Hash className="text-white" size={10} />
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
                      className="w-full sm:w-auto bg-indigo-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-indigo-600 transition-colors flex items-center gap-2 justify-center"
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
                        disabled={!isFormValid || !isPressureRangeValid()}
                        className={`px-6 py-3 rounded-xl font-semibold transition-colors flex items-center gap-2 justify-center ${
                          isFormValid && isPressureRangeValid()
                            ? "bg-green-500 text-white hover:bg-green-600 cursor-pointer"
                            : "bg-gray-300 text-gray-500 cursor-not-allowed"
                        }`}
                        whileHover={
                          isFormValid && isPressureRangeValid()
                            ? { scale: 1.02 }
                            : {}
                        }
                        whileTap={
                          isFormValid && isPressureRangeValid()
                            ? { scale: 0.98 }
                            : {}
                        }>
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

export default TypeOfCompressors;
