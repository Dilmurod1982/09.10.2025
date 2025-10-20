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
  Wind,
  Package,
  Globe,
  CheckCircle,
  AlertCircle,
  Gauge,
  Droplets,
  Zap,
  Thermometer,
  Settings,
} from "lucide-react";

const TypeOfOsushka = () => {
  const [dryers, setDryers] = useState([]);
  const [selectedDryer, setSelectedDryer] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Данные для новой осушки
  const [newDryer, setNewDryer] = useState({
    brand: "",
    model: "",
    country: "",
    technology: "",
    maxFlowRate: "",
    workingPressure: "",
    dewPoint: "",
    powerConsumption: "",
    regenerationType: "",
  });

  // Загрузка данных
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const dryersSnapshot = await getDocs(collection(db, "typeofgasDryers"));
        const dryersData = dryersSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setDryers(dryersData);
      } catch (error) {
        console.error("Error loading dryers:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Проверка заполнения формы
  const checkFormValidity = () => {
    const currentData = isCreating ? newDryer : selectedDryer;

    if (!currentData) return false;

    const requiredFields = ["brand", "model", "country"];

    // Проверка заполнения обязательных полей
    const allFieldsFilled = requiredFields.every(
      (field) =>
        currentData[field] && currentData[field].toString().trim() !== ""
    );

    return allFieldsFilled;
  };

  // Фильтрация осушек по поиску
  const filteredDryers = dryers.filter(
    (dryer) =>
      dryer.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      dryer.model?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      dryer.country?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      dryer.technology?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Обработчик изменения полей
  const handleInputChange = (field, value) => {
    if (isCreating) {
      setNewDryer((prev) => ({ ...prev, [field]: value }));
    } else {
      setSelectedDryer((prev) => ({ ...prev, [field]: value }));
    }
  };

  // Открытие модального окна для просмотра осушки
  const handleDryerClick = (dryer) => {
    setSelectedDryer({ ...dryer });
    setIsModalOpen(true);
    setIsEditMode(false);
  };

  // Открытие модального окна для создания осушки
  const handleCreateDryer = () => {
    setIsCreating(true);
    setIsModalOpen(true);
    setNewDryer({
      brand: "",
      model: "",
      country: "",
      technology: "",
      maxFlowRate: "",
      workingPressure: "",
      dewPoint: "",
      powerConsumption: "",
      regenerationType: "",
    });
  };

  // Закрытие модального окна
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setIsEditMode(false);
    setIsCreating(false);
    setSelectedDryer(null);
  };

  // Редактирование осушки
  const handleEdit = () => {
    setIsEditMode(true);
  };

  // Сохранение изменений
  const handleSave = async () => {
    const isValid = checkFormValidity();
    if (!isValid) return;

    try {
      if (isCreating) {
        await addDoc(collection(db, "typeofgasDryers"), {
          ...newDryer,
          createdAt: new Date(),
        });
      } else {
        await updateDoc(doc(db, "typeofgasDryers", selectedDryer.id), {
          ...selectedDryer,
          updatedAt: new Date(),
        });
      }

      // Перезагрузка данных
      const dryersSnapshot = await getDocs(collection(db, "typeofgasDryers"));
      const dryersData = dryersSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setDryers(dryersData);

      handleCloseModal();
    } catch (error) {
      console.error("Error saving dryer:", error);
    }
  };

  // Отмена редактирования
  const handleCancel = () => {
    if (isCreating) {
      handleCloseModal();
    } else {
      setIsEditMode(false);
      // Восстанавливаем исходные данные из базы
      const originalDryer = dryers.find(
        (dryer) => dryer.id === selectedDryer.id
      );
      setSelectedDryer(originalDryer ? { ...originalDryer } : null);
    }
  };

  // Проверяем валидность формы для отображения
  const isFormValid = checkFormValidity();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 to-emerald-100 flex items-center justify-center">
        <motion.div
          className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-emerald-100 p-4 lg:p-8">
      {/* Заголовок и кнопка добавления */}
      <motion.div
        className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}>
        <div>
          <h1 className="text-3xl lg:text-4xl font-bold text-gray-800 mb-2">
            Системы Очистки и Осушки Газа
          </h1>
          <p className="text-gray-600">
            Управление типами и моделями оборудования для осушки природного газа
          </p>
        </div>

        <motion.button
          className="bg-gradient-to-r from-red-500 to-pink-600 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2 w-full lg:w-auto justify-center"
          onClick={handleCreateDryer}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}>
          <Plus size={20} />
          Добавить систему
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
              placeholder="Поиск по марке, модели, стране или технологии..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-300"
            />
          </div>
          <button className="px-4 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors duration-300 flex items-center gap-2 justify-center">
            <Filter size={20} />
            <span className="hidden lg:inline">Фильтры</span>
          </button>
        </div>
      </motion.div>

      {/* Таблица осушек */}
      <motion.div
        className="bg-white rounded-2xl shadow-sm overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.2 }}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white">
                <th className="px-4 py-4 text-left font-semibold">Марка</th>
                <th className="px-4 py-4 text-left font-semibold">Модель</th>
                <th className="px-4 py-4 text-left font-semibold hidden md:table-cell">
                  Технология
                </th>
                <th className="px-4 py-4 text-left font-semibold hidden lg:table-cell">
                  Производительность
                </th>
                <th className="px-4 py-4 text-left font-semibold hidden xl:table-cell">
                  Точка росы
                </th>
                <th className="px-4 py-4 text-left font-semibold hidden 2xl:table-cell">
                  Страна
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredDryers.map((dryer, index) => (
                <motion.tr
                  key={dryer.id}
                  onClick={() => handleDryerClick(dryer)}
                  className="hover:bg-emerald-50 transition-colors duration-200 cursor-pointer group"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                  whileHover={{ scale: 1.01 }}>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center group-hover:bg-emerald-200 transition-colors">
                        <Wind className="text-emerald-600" size={20} />
                      </div>
                      <div className="font-semibold text-gray-800">
                        {dryer.brand}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <Package className="text-emerald-500" size={16} />
                      <span className="font-medium text-gray-700">
                        {dryer.model}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-gray-600 hidden md:table-cell">
                    <div className="flex items-center gap-2">
                      <Settings className="text-emerald-500" size={16} />
                      <span className="text-sm">
                        {dryer.technology || "Не указано"}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-gray-600 hidden lg:table-cell">
                    {dryer.maxFlowRate ? (
                      <div className="flex items-center gap-2">
                        <Gauge className="text-blue-500" size={16} />
                        <span className="font-medium">
                          {dryer.maxFlowRate} м³/ч
                        </span>
                      </div>
                    ) : (
                      <span className="text-gray-400">Не указано</span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-gray-600 hidden xl:table-cell">
                    {dryer.dewPoint ? (
                      <div className="flex items-center gap-2">
                        <Thermometer className="text-purple-500" size={16} />
                        <span className="font-medium">{dryer.dewPoint} °C</span>
                      </div>
                    ) : (
                      <span className="text-gray-400">Не указано</span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-gray-600 hidden 2xl:table-cell">
                    <div className="flex items-center gap-2">
                      <Globe className="text-emerald-500" size={16} />
                      <span>{dryer.country}</span>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredDryers.length === 0 && (
          <motion.div
            className="text-center py-12"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}>
            <Wind className="mx-auto text-gray-400 mb-4" size={48} />
            <h3 className="text-lg font-semibold text-gray-600 mb-2">
              {searchTerm
                ? "Системы осушки не найдены"
                : "Системы осушки не добавлены"}
            </h3>
            <p className="text-gray-500 mb-4">
              {searchTerm
                ? "Попробуйте изменить условия поиска"
                : "Начните с добавления первой системы осушки"}
            </p>
            {!searchTerm && (
              <button
                onClick={handleCreateDryer}
                className="bg-emerald-500 text-white px-6 py-2 rounded-lg hover:bg-emerald-600 transition-colors">
                Добавить систему
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
              <div className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white p-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold">
                    {isCreating
                      ? "Создание системы осушки"
                      : isEditMode
                      ? "Редактирование системы осушки"
                      : "Информация о системе осушки"}
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
                        <Wind size={16} />
                        Марка системы *
                      </label>
                      <input
                        type="text"
                        value={
                          isCreating
                            ? newDryer.brand
                            : selectedDryer?.brand || ""
                        }
                        onChange={(e) =>
                          handleInputChange("brand", e.target.value)
                        }
                        disabled={!isCreating && !isEditMode}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500"
                        placeholder="Введите марку системы"
                      />
                    </div>

                    <div>
                      <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                        <Package size={16} />
                        Модель системы *
                      </label>
                      <input
                        type="text"
                        value={
                          isCreating
                            ? newDryer.model
                            : selectedDryer?.model || ""
                        }
                        onChange={(e) =>
                          handleInputChange("model", e.target.value)
                        }
                        disabled={!isCreating && !isEditMode}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500"
                        placeholder="Введите модель системы"
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
                          ? newDryer.country
                          : selectedDryer?.country || ""
                      }
                      onChange={(e) =>
                        handleInputChange("country", e.target.value)
                      }
                      disabled={!isCreating && !isEditMode}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500"
                      placeholder="Введите страну производителя"
                    />
                  </div>

                  {/* Технические характеристики */}
                  <div className="border-t pt-6">
                    <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-800 mb-4">
                      <Settings size={18} />
                      Технические характеристики
                    </h3>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Технология осушки */}
                      <div>
                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                          <Settings size={16} />
                          Технология осушки
                        </label>
                        <select
                          value={
                            isCreating
                              ? newDryer.technology
                              : selectedDryer?.technology || ""
                          }
                          onChange={(e) =>
                            handleInputChange("technology", e.target.value)
                          }
                          disabled={!isCreating && !isEditMode}
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500">
                          <option value="">Выберите технологию</option>
                          <option value="Адсорбционная">Адсорбционная</option>
                          <option value="Абсорбционная">Абсорбционная</option>
                          <option value="Мембранная">Мембранная</option>
                          <option value="Рефрижераторная">
                            Рефрижераторная
                          </option>
                          <option value="Делительная">Делительная</option>
                        </select>
                      </div>

                      {/* Максимальная производительность */}
                      <div>
                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                          <Gauge size={16} />
                          Макс. производительность
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={
                              isCreating
                                ? newDryer.maxFlowRate
                                : selectedDryer?.maxFlowRate || ""
                            }
                            onChange={(e) =>
                              handleInputChange("maxFlowRate", e.target.value)
                            }
                            disabled={!isCreating && !isEditMode}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500 pr-16"
                            placeholder="0"
                          />
                          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">
                            м³/ч
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
                      {/* Рабочее давление */}
                      <div>
                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                          <Gauge size={16} />
                          Рабочее давление
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={
                              isCreating
                                ? newDryer.workingPressure
                                : selectedDryer?.workingPressure || ""
                            }
                            onChange={(e) =>
                              handleInputChange(
                                "workingPressure",
                                e.target.value
                              )
                            }
                            disabled={!isCreating && !isEditMode}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500 pr-20"
                            placeholder="0"
                          />
                          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">
                            бар
                          </div>
                        </div>
                      </div>

                      {/* Точка росы */}
                      <div>
                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                          <Thermometer size={16} />
                          Точка росы
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={
                              isCreating
                                ? newDryer.dewPoint
                                : selectedDryer?.dewPoint || ""
                            }
                            onChange={(e) =>
                              handleInputChange("dewPoint", e.target.value)
                            }
                            disabled={!isCreating && !isEditMode}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500 pr-16"
                            placeholder="0"
                          />
                          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">
                            °C
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
                      {/* Потребляемая мощность */}
                      <div>
                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                          <Zap size={16} />
                          Потребляемая мощность
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={
                              isCreating
                                ? newDryer.powerConsumption
                                : selectedDryer?.powerConsumption || ""
                            }
                            onChange={(e) =>
                              handleInputChange(
                                "powerConsumption",
                                e.target.value
                              )
                            }
                            disabled={!isCreating && !isEditMode}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500 pr-16"
                            placeholder="0"
                          />
                          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">
                            кВт
                          </div>
                        </div>
                      </div>

                      {/* Тип регенерации */}
                      <div>
                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                          <Droplets size={16} />
                          Тип регенерации
                        </label>
                        <select
                          value={
                            isCreating
                              ? newDryer.regenerationType
                              : selectedDryer?.regenerationType || ""
                          }
                          onChange={(e) =>
                            handleInputChange(
                              "regenerationType",
                              e.target.value
                            )
                          }
                          disabled={!isCreating && !isEditMode}
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500">
                          <option value="">Выберите тип</option>
                          <option value="Холодная">Холодная</option>
                          <option value="Горячая">Горячая</option>
                          <option value="Электрическая">Электрическая</option>
                          <option value="Без регенерации">
                            Без регенерации
                          </option>
                        </select>
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
                              Все обязательные поля заполнены
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
                      className="w-full sm:w-auto bg-emerald-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-emerald-600 transition-colors flex items-center gap-2 justify-center"
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

export default TypeOfOsushka;
