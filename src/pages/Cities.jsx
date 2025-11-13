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
  MapPin,
  Building,
  CheckCircle,
  AlertCircle,
  Users,
  Navigation,
} from "lucide-react";

const Cities = () => {
  const [cities, setCities] = useState([]);
  const [regions, setRegions] = useState([]);
  const [selectedCity, setSelectedCity] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Данные для нового города/района
  const [newCity, setNewCity] = useState({
    name: "",
    regionId: "",
    regionName: "",
    type: "Город",
    population: "",
    area: "",
  });

  // Загрузка данных
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // Загрузка городов
        const citiesSnapshot = await getDocs(collection(db, "cities"));
        const citiesData = citiesSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setCities(citiesData);

        // Загрузка областей
        const regionsSnapshot = await getDocs(collection(db, "regions"));
        const regionsData = regionsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setRegions(regionsData);
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
    const currentData = isCreating ? newCity : selectedCity;

    if (!currentData) return false;

    const requiredFields = ["name", "regionId"];

    // Проверка заполнения обязательных полей
    const allFieldsFilled = requiredFields.every(
      (field) =>
        currentData[field] && currentData[field].toString().trim() !== ""
    );

    return allFieldsFilled;
  };

  // Обработчик выбора области
  const handleRegionChange = (regionId) => {
    const selectedRegion = regions.find((region) => region.id === regionId);
    if (selectedRegion) {
      if (isCreating) {
        setNewCity((prev) => ({
          ...prev,
          regionId: selectedRegion.id,
          regionName: selectedRegion.name,
        }));
      } else {
        setSelectedCity((prev) => ({
          ...prev,
          regionId: selectedRegion.id,
          regionName: selectedRegion.name,
        }));
      }
    }
  };

  // Фильтрация городов по поиску
  const filteredCities = cities.filter(
    (city) =>
      city.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      city.regionName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      city.type?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Обработчик изменения полей
  const handleInputChange = (field, value) => {
    if (isCreating) {
      setNewCity((prev) => ({ ...prev, [field]: value }));
    } else {
      setSelectedCity((prev) => ({ ...prev, [field]: value }));
    }
  };

  // Открытие модального окна для просмотра города
  const handleCityClick = (city) => {
    setSelectedCity({ ...city });
    setIsModalOpen(true);
    setIsEditMode(false);
  };

  // Открытие модального окна для создания города
  const handleCreateCity = () => {
    setIsCreating(true);
    setIsModalOpen(true);
    setNewCity({
      name: "",
      regionId: "",
      regionName: "",
      type: "Город",
      population: "",
      area: "",
    });
  };

  // Закрытие модального окна
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setIsEditMode(false);
    setIsCreating(false);
    setSelectedCity(null);
  };

  // Редактирование города
  const handleEdit = () => {
    setIsEditMode(true);
  };

  // Сохранение изменений
  const handleSave = async () => {
    const isValid = checkFormValidity();
    if (!isValid) return;

    try {
      if (isCreating) {
        await addDoc(collection(db, "cities"), {
          ...newCity,
          createdAt: new Date(),
        });
      } else {
        await updateDoc(doc(db, "cities", selectedCity.id), {
          ...selectedCity,
          updatedAt: new Date(),
        });
      }

      // Перезагрузка данных
      const citiesSnapshot = await getDocs(collection(db, "cities"));
      const citiesData = citiesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setCities(citiesData);

      handleCloseModal();
    } catch (error) {
      console.error("Error saving city:", error);
    }
  };

  // Отмена редактирования
  const handleCancel = () => {
    if (isCreating) {
      handleCloseModal();
    } else {
      setIsEditMode(false);
      // Восстанавливаем исходные данные из базы
      const originalCity = cities.find((city) => city.id === selectedCity.id);
      setSelectedCity(originalCity ? { ...originalCity } : null);
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
            Ўзбекистон шаҳар ва туманлари
          </h1>
          <p className="text-gray-600">Шаҳар ва туман номларини бошқариш</p>
        </div>

        <motion.button
          className="bg-gradient-to-r from-red-500 to-pink-600 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2 w-full lg:w-auto justify-center"
          onClick={handleCreateCity}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}>
          <Plus size={20} />
          Шаҳар/туман қўшиш
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
              placeholder="Номи билан қидириш..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-300"
            />
          </div>
          <button className="px-4 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors duration-300 flex items-center gap-2 justify-center">
            <Filter size={20} />
            <span className="hidden lg:inline">Фильтрлар</span>
          </button>
        </div>
      </motion.div>

      {/* Таблица городов */}
      <motion.div
        className="bg-white rounded-2xl shadow-sm overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.2 }}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white">
                <th className="px-4 py-4 text-left font-semibold">
                  Шаҳар/туман
                </th>
                <th className="px-4 py-4 text-left font-semibold">Тип</th>
                <th className="px-4 py-4 text-left font-semibold hidden md:table-cell">
                  Вилоят
                </th>
                <th className="px-4 py-4 text-left font-semibold hidden lg:table-cell">
                  Аҳоли
                </th>
                <th className="px-4 py-4 text-left font-semibold hidden xl:table-cell">
                  Майдони
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredCities.map((city, index) => (
                <motion.tr
                  key={city.id}
                  onClick={() => handleCityClick(city)}
                  className="hover:bg-cyan-50 transition-colors duration-200 cursor-pointer group"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                  whileHover={{ scale: 1.01 }}>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-cyan-100 rounded-lg flex items-center justify-center group-hover:bg-cyan-200 transition-colors">
                        <Building className="text-cyan-600" size={20} />
                      </div>
                      <div className="font-semibold text-gray-800">
                        {city.name}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div
                      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                        city.type === "Город"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-green-100 text-green-800"
                      }`}>
                      {city.type}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-gray-600 hidden md:table-cell">
                    <div className="flex items-center gap-2">
                      <MapPin className="text-cyan-500" size={16} />
                      <span>{city.regionName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-gray-600 hidden lg:table-cell">
                    {city.population ? (
                      <div className="flex items-center gap-2">
                        <Users className="text-green-500" size={16} />
                        <span className="font-medium">{city.population}</span>
                      </div>
                    ) : (
                      <span className="text-gray-400">Не указано</span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-gray-600 hidden xl:table-cell">
                    {city.area ? (
                      <div className="flex items-center gap-2">
                        <Navigation className="text-orange-500" size={16} />
                        <span className="font-medium">{city.area} км²</span>
                      </div>
                    ) : (
                      <span className="text-gray-400">Не указано</span>
                    )}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredCities.length === 0 && (
          <motion.div
            className="text-center py-12"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}>
            <Building className="mx-auto text-gray-400 mb-4" size={48} />
            <h3 className="text-lg font-semibold text-gray-600 mb-2">
              {searchTerm
                ? "Шаҳар/туманлар топилмади"
                : "Шаҳар/туманлар қўшилмаган"}
            </h3>
            <p className="text-gray-500 mb-4">
              {searchTerm
                ? "Қидириш шартини ўзгартириб қўринг"
                : "Шаҳар/туман қўшиш билан бошланг"}
            </p>
            {!searchTerm && (
              <button
                onClick={handleCreateCity}
                className="bg-cyan-500 text-white px-6 py-2 rounded-lg hover:bg-cyan-600 transition-colors">
                Шаҳар/туман қўшиш
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
                      ? "Шаҳар/туман яратиш"
                      : isEditMode
                      ? "Шаҳар/туман таҳрирлаш"
                      : "Шаҳар/туман ҳақида маълумот"}
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
                        Номи *
                      </label>
                      <input
                        type="text"
                        value={
                          isCreating ? newCity.name : selectedCity?.name || ""
                        }
                        onChange={(e) =>
                          handleInputChange("name", e.target.value)
                        }
                        disabled={!isCreating && !isEditMode}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500"
                        placeholder="Номини киритинг"
                      />
                    </div>

                    <div>
                      <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                        <MapPin size={16} />
                        Тури
                      </label>
                      <select
                        value={
                          isCreating ? newCity.type : selectedCity?.type || ""
                        }
                        onChange={(e) =>
                          handleInputChange("type", e.target.value)
                        }
                        disabled={!isCreating && !isEditMode}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500">
                        <option value="Город">Шаҳар</option>
                        <option value="Район">Туман</option>
                        <option value="Посёлок">Қишлоқ</option>
                      </select>
                    </div>
                  </div>

                  {/* Область */}
                  <div>
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                      <MapPin size={16} />
                      Вилоят *
                    </label>
                    <select
                      value={
                        isCreating
                          ? newCity.regionId
                          : selectedCity?.regionId || ""
                      }
                      onChange={(e) => handleRegionChange(e.target.value)}
                      disabled={!isCreating && !isEditMode}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500">
                      <option value="">Вилоятни танланг</option>
                      {regions.map((region) => (
                        <option key={region.id} value={region.id}>
                          {region.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Дополнительная информация */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div>
                      <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                        <Users size={16} />
                        Аҳоли сони
                      </label>
                      <input
                        type="text"
                        value={
                          isCreating
                            ? newCity.population
                            : selectedCity?.population || ""
                        }
                        onChange={(e) =>
                          handleInputChange("population", e.target.value)
                        }
                        disabled={!isCreating && !isEditMode}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500"
                        placeholder="Мисол: 500,000"
                      />
                    </div>

                    <div>
                      <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                        <Navigation size={16} />
                        Майдони
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={
                            isCreating ? newCity.area : selectedCity?.area || ""
                          }
                          onChange={(e) =>
                            handleInputChange("area", e.target.value)
                          }
                          disabled={!isCreating && !isEditMode}
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500 pr-16"
                          placeholder="0"
                        />
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">
                          км²
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
                              Барча мажбурий қаторлар тўлдирилди
                            </span>
                          </>
                        ) : (
                          <>
                            <AlertCircle
                              className="text-orange-500"
                              size={16}
                            />
                            <span className="text-orange-600">
                              Барча мажбурий қаторлар тўлдиринг (*)
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

export default Cities;
