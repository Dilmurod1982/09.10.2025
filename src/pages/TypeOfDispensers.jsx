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
  Droplets,
  Package,
  Globe,
  Hash,
  CheckCircle,
  AlertCircle,
  Zap,
  Gauge,
  Flame,
  RotateCcw,
} from "lucide-react";

const TypeOfDispensers = () => {
  const [dispensers, setDispensers] = useState([]);
  const [selectedDispenser, setSelectedDispenser] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Данные для новой колонки
  const [newDispenser, setNewDispenser] = useState({
    brand: "",
    model: "",
    country: "",
    maxFlowRate: "",
    powerConsumption: "",
    nozzleCount: "",
    hoseLength: "",
    resetCounterEnabled: false, // Флаг автообнуления
  });

  // Загрузка данных
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const dispensersSnapshot = await getDocs(
          collection(db, "typeofdispensers")
        );
        const dispensersData = dispensersSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setDispensers(dispensersData);
      } catch (error) {
        console.error("Error loading dispensers:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Проверка заполнения формы
  const checkFormValidity = () => {
    const currentData = isCreating ? newDispenser : selectedDispenser;

    if (!currentData) return false;

    const requiredFields = ["brand", "model", "country"];

    // Проверка заполнения обязательных полей
    return requiredFields.every(
      (field) =>
        currentData[field] && currentData[field].toString().trim() !== ""
    );
  };

  // Фильтрация колонок по поиску
  const filteredDispensers = dispensers.filter(
    (dispenser) =>
      dispenser.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      dispenser.model?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      dispenser.country?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Обработчик изменения полей
  const handleInputChange = (field, value) => {
    if (isCreating) {
      setNewDispenser((prev) => ({ ...prev, [field]: value }));
    } else {
      setSelectedDispenser((prev) => ({ ...prev, [field]: value }));
    }
  };

  // Обработчик изменения галочки автообнуления
  const handleResetToggle = (checked) => {
    if (isCreating) {
      setNewDispenser((prev) => ({
        ...prev,
        resetCounterEnabled: checked,
      }));
    } else {
      setSelectedDispenser((prev) => ({
        ...prev,
        resetCounterEnabled: checked,
      }));
    }
  };

  // Открытие модального окна для просмотра колонки
  const handleDispenserClick = (dispenser) => {
    setSelectedDispenser({
      ...dispenser,
      resetCounterEnabled: dispenser.resetCounterEnabled || false,
    });
    setIsModalOpen(true);
    setIsEditMode(false);
  };

  // Открытие модального окна для создания колонки
  const handleCreateDispenser = () => {
    setIsCreating(true);
    setIsModalOpen(true);
    setNewDispenser({
      brand: "",
      model: "",
      country: "",
      maxFlowRate: "",
      powerConsumption: "",
      nozzleCount: "",
      hoseLength: "",
      resetCounterEnabled: false,
    });
  };

  // Закрытие модального окна
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setIsEditMode(false);
    setIsCreating(false);
    setSelectedDispenser(null);
  };

  // Редактирование колонки
  const handleEdit = () => {
    setIsEditMode(true);
  };

  // Сохранение изменений
  const handleSave = async () => {
    const isValid = checkFormValidity();
    if (!isValid) return;

    try {
      if (isCreating) {
        await addDoc(collection(db, "typeofdispensers"), {
          ...newDispenser,
          fuelType: "Природный газ",
          createdAt: new Date(),
        });
      } else {
        await updateDoc(doc(db, "typeofdispensers", selectedDispenser.id), {
          ...selectedDispenser,
          fuelType: "Природный газ",
          updatedAt: new Date(),
        });
      }

      // Перезагрузка данных
      const dispensersSnapshot = await getDocs(
        collection(db, "typeofdispensers")
      );
      const dispensersData = dispensersSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setDispensers(dispensersData);

      handleCloseModal();
    } catch (error) {
      console.error("Error saving dispenser:", error);
    }
  };

  // Отмена редактирования
  const handleCancel = () => {
    if (isCreating) {
      handleCloseModal();
    } else {
      setIsEditMode(false);
      // Восстанавливаем исходные данные из базы
      const originalDispenser = dispensers.find(
        (dispenser) => dispenser.id === selectedDispenser.id
      );
      setSelectedDispenser(originalDispenser ? { ...originalDispenser } : null);
    }
  };

  // Проверяем валидность формы для отображения
  const isFormValid = checkFormValidity();

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
            Газозаправочные Колонки
          </h1>
          <p className="text-gray-600">
            Управление типами и моделями колонок для природного газа
          </p>
        </div>

        <motion.button
          className="bg-gradient-to-r from-red-500 to-pink-600 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2 w-full lg:w-auto justify-center"
          onClick={handleCreateDispenser}
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
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-300"
            />
          </div>
          <button className="px-4 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors duration-300 flex items-center gap-2 justify-center">
            <Filter size={20} />
            <span className="hidden lg:inline">Фильтры</span>
          </button>
        </div>
      </motion.div>

      {/* Таблица колонок */}
      <motion.div
        className="bg-white rounded-2xl shadow-sm overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.2 }}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white">
                <th className="px-4 py-4 text-left font-semibold">Марка</th>
                <th className="px-4 py-4 text-left font-semibold">Модель</th>
                <th className="px-4 py-4 text-left font-semibold hidden md:table-cell">
                  Производительность
                </th>
                <th className="px-4 py-4 text-left font-semibold hidden lg:table-cell">
                  Пистолеты
                </th>
                <th className="px-4 py-4 text-left font-semibold hidden xl:table-cell">
                  Автообнуление
                </th>
                <th className="px-4 py-4 text-left font-semibold hidden xl:table-cell">
                  Страна
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredDispensers.map((dispenser, index) => (
                <motion.tr
                  key={dispenser.id}
                  onClick={() => handleDispenserClick(dispenser)}
                  className="hover:bg-cyan-50 transition-colors duration-200 cursor-pointer group"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                  whileHover={{ scale: 1.01 }}>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-cyan-100 rounded-lg flex items-center justify-center group-hover:bg-cyan-200 transition-colors">
                        <Flame className="text-cyan-600" size={20} />
                      </div>
                      <div className="font-semibold text-gray-800">
                        {dispenser.brand}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <Package className="text-cyan-500" size={16} />
                      <span className="font-medium text-gray-700">
                        {dispenser.model}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-gray-600 hidden md:table-cell">
                    {dispenser.maxFlowRate ? (
                      <div className="flex items-center gap-2">
                        <Gauge className="text-green-500" size={16} />
                        <span className="font-medium">
                          {dispenser.maxFlowRate} м³/мин
                        </span>
                      </div>
                    ) : (
                      <span className="text-gray-400">Не указано</span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-gray-600 hidden lg:table-cell">
                    {dispenser.nozzleCount ? (
                      <div className="flex items-center gap-2">
                        <Droplets className="text-blue-500" size={16} />
                        <span className="font-medium">
                          {dispenser.nozzleCount} шт.
                        </span>
                      </div>
                    ) : (
                      <span className="text-gray-400">Не указано</span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-gray-600 hidden xl:table-cell">
                    <div className="flex items-center gap-2">
                      <RotateCcw
                        className={
                          dispenser.resetCounterEnabled
                            ? "text-green-500"
                            : "text-gray-400"
                        }
                        size={16}
                      />
                      <span
                        className={
                          dispenser.resetCounterEnabled
                            ? "text-green-600 font-medium"
                            : "text-gray-500"
                        }>
                        {dispenser.resetCounterEnabled
                          ? "Автообнуление"
                          : "Без автообнуления"}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-gray-600 hidden xl:table-cell">
                    <div className="flex items-center gap-2">
                      <Globe className="text-cyan-500" size={16} />
                      <span>{dispenser.country}</span>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredDispensers.length === 0 && (
          <motion.div
            className="text-center py-12"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}>
            <Flame className="mx-auto text-gray-400 mb-4" size={48} />
            <h3 className="text-lg font-semibold text-gray-600 mb-2">
              {searchTerm
                ? "Модели колонок не найдены"
                : "Модели колонок не добавлены"}
            </h3>
            <p className="text-gray-500 mb-4">
              {searchTerm
                ? "Попробуйте изменить условия поиска"
                : "Начните с добавления первой модели колонки"}
            </p>
            {!searchTerm && (
              <button
                onClick={handleCreateDispenser}
                className="bg-cyan-500 text-white px-6 py-2 rounded-lg hover:bg-cyan-600 transition-colors">
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
              <div className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white p-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold">
                    {isCreating
                      ? "Создание газозаправочной колонки"
                      : isEditMode
                      ? "Редактирование газозаправочной колонки"
                      : "Информация о газозаправочной колонке"}
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
                        <Flame size={16} />
                        Марка колонки *
                      </label>
                      <input
                        type="text"
                        value={
                          isCreating
                            ? newDispenser.brand
                            : selectedDispenser?.brand || ""
                        }
                        onChange={(e) =>
                          handleInputChange("brand", e.target.value)
                        }
                        disabled={!isCreating && !isEditMode}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500"
                        placeholder="Введите марку колонки"
                      />
                    </div>

                    <div>
                      <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                        <Package size={16} />
                        Модель колонки *
                      </label>
                      <input
                        type="text"
                        value={
                          isCreating
                            ? newDispenser.model
                            : selectedDispenser?.model || ""
                        }
                        onChange={(e) =>
                          handleInputChange("model", e.target.value)
                        }
                        disabled={!isCreating && !isEditMode}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500"
                        placeholder="Введите модель колонки"
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
                          ? newDispenser.country
                          : selectedDispenser?.country || ""
                      }
                      onChange={(e) =>
                        handleInputChange("country", e.target.value)
                      }
                      disabled={!isCreating && !isEditMode}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500"
                      placeholder="Введите страну производителя"
                    />
                  </div>

                  {/* Настройки счетчика */}
                  <div className="border-t pt-6">
                    <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-800 mb-4">
                      <RotateCcw size={18} />
                      Настройки счетчика
                    </h3>

                    <div className="space-y-4">
                      {/* Галочка для включения автообнуления */}
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <input
                            type="checkbox"
                            id="resetCounterEnabled"
                            checked={
                              isCreating
                                ? newDispenser.resetCounterEnabled
                                : selectedDispenser?.resetCounterEnabled ||
                                  false
                            }
                            onChange={(e) =>
                              handleResetToggle(e.target.checked)
                            }
                            disabled={!isCreating && !isEditMode}
                            className="w-5 h-5 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500 disabled:bg-gray-100"
                          />
                        </div>
                        <label
                          htmlFor="resetCounterEnabled"
                          className="text-sm font-semibold text-gray-700 cursor-pointer select-none">
                          Счетчик с автообнулением
                        </label>
                      </div>

                      {/* Описание функции автообнуления */}
                      {(isCreating
                        ? newDispenser.resetCounterEnabled
                        : selectedDispenser?.resetCounterEnabled) && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          transition={{ duration: 0.3 }}
                          className="ml-8 bg-green-50 border border-green-200 rounded-lg p-3">
                          <p className="text-sm text-green-700">
                            <CheckCircle className="inline mr-2" size={14} />
                            Данная модель поддерживает функцию автоматического
                            обнуления счетчика. Счетчик может быть сброшен в
                            любой момент по необходимости.
                          </p>
                        </motion.div>
                      )}
                    </div>
                  </div>

                  {/* Технические характеристики */}
                  <div className="border-t pt-6">
                    <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-800 mb-4">
                      <Gauge size={18} />
                      Технические характеристики
                    </h3>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                                ? newDispenser.maxFlowRate
                                : selectedDispenser?.maxFlowRate || ""
                            }
                            onChange={(e) =>
                              handleInputChange("maxFlowRate", e.target.value)
                            }
                            disabled={!isCreating && !isEditMode}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500 pr-20"
                            placeholder="0"
                          />
                          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">
                            м³/мин
                          </div>
                        </div>
                      </div>

                      {/* Количество пистолетов */}
                      <div>
                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                          <Droplets size={16} />
                          Количество пистолетов
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={
                              isCreating
                                ? newDispenser.nozzleCount
                                : selectedDispenser?.nozzleCount || ""
                            }
                            onChange={(e) =>
                              handleInputChange("nozzleCount", e.target.value)
                            }
                            disabled={!isCreating && !isEditMode}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500 pr-16"
                            placeholder="0"
                          />
                          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">
                            шт.
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
                      {/* Длина шланга */}
                      <div>
                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                          <Droplets size={16} />
                          Длина шланга
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={
                              isCreating
                                ? newDispenser.hoseLength
                                : selectedDispenser?.hoseLength || ""
                            }
                            onChange={(e) =>
                              handleInputChange("hoseLength", e.target.value)
                            }
                            disabled={!isCreating && !isEditMode}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500 pr-16"
                            placeholder="0"
                          />
                          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">
                            м
                          </div>
                        </div>
                      </div>

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
                                ? newDispenser.powerConsumption
                                : selectedDispenser?.powerConsumption || ""
                            }
                            onChange={(e) =>
                              handleInputChange(
                                "powerConsumption",
                                e.target.value
                              )
                            }
                            disabled={!isCreating && !isEditMode}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500 pr-16"
                            placeholder="0"
                          />
                          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">
                            кВт
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Индикатор типа топлива */}
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                      <Flame className="text-blue-500" size={20} />
                      <div>
                        <h4 className="font-semibold text-blue-800">
                          Тип топлива
                        </h4>
                        <p className="text-blue-600 text-sm">
                          Природный газ (CNG/LNG)
                        </p>
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
                      className="w-full sm:w-auto bg-cyan-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-cyan-600 transition-colors flex items-center gap-2 justify-center"
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

export default TypeOfDispensers;
