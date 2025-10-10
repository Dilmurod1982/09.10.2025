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
  Building,
  MapPin,
  User,
  Phone,
  Settings,
  Droplets,
  Wind,
  Snowflake,
  Zap,
  Users,
  FileText,
  Home,
  Trash2,
  AlertCircle,
  CheckCircle,
} from "lucide-react";

const Stations = () => {
  const [stations, setStations] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [cities, setCities] = useState([]);
  const [compressors, setCompressors] = useState([]);
  const [dispensers, setDispensers] = useState([]);
  const [gasDryers, setGasDryers] = useState([]);
  const [gasChillers, setGasChillers] = useState([]);
  const [selectedStation, setSelectedStation] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Данные для новой станции
  const [newStation, setNewStation] = useState({
    stationNumber: "",
    stationName: "",
    organizationId: "",
    organizationName: "",
    address: {
      cityId: "",
      cityName: "",
      regionName: "",
      street: "",
      house: "",
      msc: "",
      phone: "",
    },
    director: {
      fullName: "",
      passportSeries: "",
      passportNumber: "",
      pinfl: "",
      phone: "",
    },
    seniorMechanic: {
      fullName: "",
      passportSeries: "",
      passportNumber: "",
      pinfl: "",
      phone: "",
    },
    seniorOperator: {
      fullName: "",
      passportSeries: "",
      passportNumber: "",
      pinfl: "",
      phone: "",
    },
    compressors: [],
    dispensers: [],
    dryers: [],
    chillers: [],
    gasSupplier: {
      cityId: "",
      cityName: "",
      organization: "газ",
    },
    electricitySuppliers: [],
    waterSupplier: {
      cityId: "",
      cityName: "",
    },
  });

  // Загрузка всех данных
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [
          stationsSnapshot,
          organizationsSnapshot,
          citiesSnapshot,
          compressorsSnapshot,
          dispensersSnapshot,
          dryersSnapshot,
          chillersSnapshot,
        ] = await Promise.all([
          getDocs(collection(db, "stations")),
          getDocs(collection(db, "organizations")),
          getDocs(collection(db, "cities")),
          getDocs(collection(db, "compressors")),
          getDocs(collection(db, "dispensers")),
          getDocs(collection(db, "gasDryers")),
          getDocs(collection(db, "gasChillers")),
        ]);

        setStations(
          stationsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
        );
        setOrganizations(
          organizationsSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))
        );
        setCities(
          citiesSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
        );
        setCompressors(
          compressorsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
        );
        setDispensers(
          dispensersSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
        );
        setGasDryers(
          dryersSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
        );
        setGasChillers(
          chillersSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
        );
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
    const currentData = isCreating ? newStation : selectedStation;
    if (!currentData) return false;

    const requiredFields = [
      "stationNumber",
      "stationName",
      "organizationId",
      "address.cityId",
      "address.street",
      "address.house",
      "director.fullName",
      "director.phone",
      "seniorMechanic.fullName",
      "seniorOperator.fullName",
      "gasSupplier.cityId",
    ];

    return requiredFields.every((field) => {
      const value = getNestedValue(currentData, field);
      return value && value.toString().trim() !== "";
    });
  };

  // Вспомогательная функция для получения вложенных значений
  const getNestedValue = (obj, path) => {
    return path.split(".").reduce((acc, part) => acc && acc[part], obj);
  };

  // Фильтрация станций по поиску
  const filteredStations = stations.filter(
    (station) =>
      station.stationName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      station.organizationName
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      station.address?.cityName
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      station.address?.street
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      station.director?.fullName
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase())
  );

  // Обработчики изменения полей
  const handleInputChange = (path, value) => {
    const updateData = (data) => {
      const keys = path.split(".");
      const lastKey = keys.pop();
      const target = keys.reduce(
        (acc, key) => (acc[key] = acc[key] || {}),
        data
      );
      target[lastKey] = value;
      return { ...data };
    };

    if (isCreating) {
      setNewStation((prev) => updateData(prev));
    } else {
      setSelectedStation((prev) => updateData(prev));
    }
  };

  // Обработчик выбора организации
  const handleOrganizationChange = (orgId) => {
    const org = organizations.find((o) => o.id === orgId);
    if (org) {
      handleInputChange("organizationId", orgId);
      handleInputChange("organizationName", org.name);
      // Автозаполнение названия станции
      const stationName = `АГНКС ${org.name}`;
      handleInputChange("stationName", stationName);
    }
  };

  // Обработчик выбора города для адреса
  const handleCityChange = (cityId, fieldPath = "address") => {
    const city = cities.find((c) => c.id === cityId);
    if (city) {
      handleInputChange(`${fieldPath}.cityId`, cityId);
      handleInputChange(`${fieldPath}.cityName`, city.name);
      handleInputChange(`${fieldPath}.regionName`, city.regionName);
    }
  };

  const handlePassportSeriesChange = (path, value) => {
    const upperValue = value.toUpperCase().replace(/[^A-ZА-Я]/g, "");
    handleInputChange(path, upperValue);
  };

  const handlePassportNumberChange = (path, value) => {
    const numericValue = value.replace(/\D/g, "");
    handleInputChange(path, numericValue);
  };

  const handlePinflChange = (path, value) => {
    const numericValue = value.replace(/\D/g, "").slice(0, 14);
    handleInputChange(path, numericValue);
  };

  // Обработчики для оборудования
  const addEquipment = (type) => {
    const emptyItem = {
      modelId: "",
      modelName: "",
      brand: "",
      serialNumber: "", // Добавлено поле заводской номер
    };
    const currentData = isCreating ? newStation : selectedStation;
    const updatedList = [...(currentData[type] || []), emptyItem];
    handleInputChange(type, updatedList);
  };

  const removeEquipment = (type, index) => {
    const currentData = isCreating ? newStation : selectedStation;
    const updatedList = currentData[type].filter((_, i) => i !== index);
    handleInputChange(type, updatedList);
  };

  const updateEquipment = (type, index, field, value) => {
    if (isCreating) {
      setNewStation((prev) => {
        const updatedList = prev[type].map((item, i) =>
          i === index ? { ...item, [field]: value } : item
        );
        return { ...prev, [type]: updatedList };
      });
    } else {
      setSelectedStation((prev) => {
        const updatedList = prev[type].map((item, i) =>
          i === index ? { ...item, [field]: value } : item
        );
        return { ...prev, [type]: updatedList };
      });
    }
  };

  const handleEquipmentSelect = (type, index, selectedId, equipmentList) => {
    const selected = equipmentList.find((item) => item.id === selectedId);
    if (selected) {
      if (isCreating) {
        setNewStation((prev) => {
          const updatedList = prev[type].map((item, i) =>
            i === index
              ? {
                  ...item,
                  modelId: selectedId,
                  modelName: selected.model,
                  brand: selected.brand,
                }
              : item
          );
          return { ...prev, [type]: updatedList };
        });
      } else {
        setSelectedStation((prev) => {
          const updatedList = prev[type].map((item, i) =>
            i === index
              ? {
                  ...item,
                  modelId: selectedId,
                  modelName: selected.model,
                  brand: selected.brand,
                }
              : item
          );
          return { ...prev, [type]: updatedList };
        });
      }
    }
  };

  // Обработчики для энергоснабжающих организаций
  const addElectricitySupplier = () => {
    const currentData = isCreating ? newStation : selectedStation;
    const updatedList = [
      ...(currentData.electricitySuppliers || []),
      {
        cityId: "",
        cityName: "",
        organization: "",
      },
    ];
    handleInputChange("electricitySuppliers", updatedList);
  };

  const removeElectricitySupplier = (index) => {
    const currentData = isCreating ? newStation : selectedStation;
    const updatedList = currentData.electricitySuppliers.filter(
      (_, i) => i !== index
    );
    handleInputChange("electricitySuppliers", updatedList);
  };

  // Открытие модального окна
  const handleStationClick = (station) => {
    setSelectedStation({ ...station });
    setIsModalOpen(true);
    setIsEditMode(false);
  };

  const handleCreateStation = () => {
    setIsCreating(true);
    setIsModalOpen(true);
    setNewStation({
      stationNumber: "",
      stationName: "",
      organizationId: "",
      organizationName: "",
      address: {
        cityId: "",
        cityName: "",
        regionName: "",
        street: "",
        house: "",
        msc: "",
        phone: "",
      },
      director: { fullName: "", passport: "", phone: "" },
      seniorMechanic: { fullName: "", passport: "", phone: "" },
      seniorOperator: { fullName: "", passport: "", phone: "" },
      compressors: [],
      dispensers: [],
      dryers: [],
      chillers: [],
      gasSupplier: { cityId: "", cityName: "", organization: "газ" },
      waterSupplier: {
        cityId: "",
        cityName: "",
        organization: "",
      },
    });
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setIsEditMode(false);
    setIsCreating(false);
    setSelectedStation(null);
  };

  const handleEdit = () => setIsEditMode(true);

  const handleSave = async () => {
    if (!checkFormValidity()) return;

    try {
      const dataToSave = isCreating ? newStation : selectedStation;

      if (isCreating) {
        await addDoc(collection(db, "stations"), {
          ...dataToSave,
          createdAt: new Date(),
        });
      } else {
        await updateDoc(doc(db, "stations", selectedStation.id), {
          ...dataToSave,
          updatedAt: new Date(),
        });
      }

      // Перезагрузка данных
      const stationsSnapshot = await getDocs(collection(db, "stations"));
      setStations(
        stationsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
      );

      handleCloseModal();
    } catch (error) {
      console.error("Error saving station:", error);
    }
  };

  const handleCancel = () => {
    if (isCreating) {
      handleCloseModal();
    } else {
      setIsEditMode(false);
      const originalStation = stations.find((s) => s.id === selectedStation.id);
      setSelectedStation(originalStation ? { ...originalStation } : null);
    }
  };

  const isFormValid = checkFormValidity();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-100 flex items-center justify-center">
        <motion.div
          className="w-12 h-12 border-4 border-red-200 border-t-red-600 rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-100 p-4 lg:p-8">
      {/* Заголовок и кнопка добавления */}
      <motion.div
        className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}>
        <div>
          <h1 className="text-3xl lg:text-4xl font-bold text-gray-800 mb-2">
            АГНКС Станции
          </h1>
          <p className="text-gray-600">
            Управление автомобильными газонаполнительными компрессорными
            станциями
          </p>
        </div>

        <motion.button
          className="bg-gradient-to-r from-red-500 to-pink-600 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2 w-full lg:w-auto justify-center"
          onClick={handleCreateStation}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}>
          <Plus size={20} />
          Добавить АГНКС
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
              placeholder="Поиск по названию станции, организации, адресу или руководителю..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-300"
            />
          </div>
          <button className="px-4 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors duration-300 flex items-center gap-2 justify-center">
            <Filter size={20} />
            <span className="hidden lg:inline">Фильтры</span>
          </button>
        </div>
      </motion.div>

      {/* Таблица станций */}
      <motion.div
        className="bg-white rounded-2xl shadow-sm overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.2 }}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-red-500 to-orange-600 text-white">
                <th className="px-4 py-4 text-left font-semibold">
                  Номер станции
                </th>
                <th className="px-4 py-4 text-left font-semibold">
                  Название станции
                </th>
                <th className="px-4 py-4 text-left font-semibold">
                  Организация
                </th>
                <th className="px-4 py-4 text-left font-semibold">Адрес</th>
                <th className="px-4 py-4 text-left font-semibold hidden lg:table-cell">
                  Руководитель
                </th>
                <th className="px-4 py-4 text-left font-semibold hidden xl:table-cell">
                  Компрессоры
                </th>
                <th className="px-4 py-4 text-left font-semibold hidden xl:table-cell">
                  Колонки
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredStations.map((station, index) => (
                <motion.tr
                  key={station.id}
                  onClick={() => handleStationClick(station)}
                  className="hover:bg-orange-50 transition-colors duration-200 cursor-pointer group"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                  whileHover={{ scale: 1.01 }}>
                  <td className="px-4 py-4">
                    <div className="font-semibold text-gray-800">
                      {station.stationNumber}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="font-semibold text-gray-800">
                      {station.stationName}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center group-hover:bg-orange-200 transition-colors">
                        <Building className="text-orange-600" size={20} />
                      </div>
                      <div>
                        <div className="font-semibold text-gray-800">
                          {station.organizationName}
                        </div>
                        <div className="text-sm text-gray-500">
                          {station.address?.cityName}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <MapPin className="text-red-500" size={16} />
                      <span className="text-sm">
                        {station.address?.street}, {station.address?.house}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-gray-600 hidden lg:table-cell">
                    <div className="flex items-center gap-2">
                      <User className="text-blue-500" size={16} />
                      <span>{station.director?.fullName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-gray-600 hidden xl:table-cell">
                    <div className="flex items-center gap-2">
                      <Settings className="text-gray-500" size={16} />
                      <span>{station.compressors?.length || 0} шт.</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-gray-600 hidden xl:table-cell">
                    <div className="flex items-center gap-2">
                      <Droplets className="text-cyan-500" size={16} />
                      <span>{station.dispensers?.length || 0} шт.</span>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredStations.length === 0 && (
          <motion.div
            className="text-center py-12"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}>
            <Building className="mx-auto text-gray-400 mb-4" size={48} />
            <h3 className="text-lg font-semibold text-gray-600 mb-2">
              {searchTerm ? "Станции не найдены" : "Станции не добавлены"}
            </h3>
            <p className="text-gray-500 mb-4">
              {searchTerm
                ? "Попробуйте изменить условия поиска"
                : "Начните с добавления первой станции"}
            </p>
            {!searchTerm && (
              <button
                onClick={handleCreateStation}
                className="bg-red-500 text-white px-6 py-2 rounded-lg hover:bg-red-600 transition-colors">
                Добавить станцию
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
              className="bg-white rounded-2xl shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}>
              {/* Заголовок модального окна */}
              <div className="bg-gradient-to-r from-red-500 to-orange-600 text-white p-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold">
                    {isCreating
                      ? "Создание АГНКС"
                      : isEditMode
                      ? "Редактирование АГНКС"
                      : "Информация об АГНКС"}
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
              <div className="p-6 max-h-[70vh] overflow-y-auto">
                <div className="space-y-8">
                  {/* Основная информация */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div>
                      <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                        <Building size={16} />
                        Организация *
                      </label>
                      <select
                        value={getNestedValue(
                          isCreating ? newStation : selectedStation,
                          "organizationId"
                        )}
                        onChange={(e) =>
                          handleOrganizationChange(e.target.value)
                        }
                        disabled={!isCreating && !isEditMode}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500">
                        <option value="">Выберите организацию</option>
                        {organizations.map((org) => (
                          <option key={org.id} value={org.id}>
                            {org.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                        Номер станции *
                      </label>
                      <input
                        type="text"
                        value={getNestedValue(
                          isCreating ? newStation : selectedStation,
                          "stationNumber"
                        )}
                        onChange={(e) =>
                          handleInputChange("stationNumber", e.target.value)
                        }
                        disabled={!isCreating && !isEditMode}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500"
                        placeholder="Введите номер станции"
                      />
                    </div>

                    <div>
                      <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                        Наименование станции *
                      </label>
                      <input
                        type="text"
                        value={getNestedValue(
                          isCreating ? newStation : selectedStation,
                          "stationName"
                        )}
                        onChange={(e) =>
                          handleInputChange("stationName", e.target.value)
                        }
                        disabled={!isCreating && !isEditMode}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500"
                        placeholder="Название станции"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div>
                      <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                        <Phone size={16} />
                        Телефон станции *
                      </label>
                      <input
                        type="tel"
                        value={getNestedValue(
                          isCreating ? newStation : selectedStation,
                          "address.phone"
                        )}
                        onChange={(e) =>
                          handleInputChange("address.phone", e.target.value)
                        }
                        disabled={!isCreating && !isEditMode}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500"
                        placeholder="+998 XX XXX-XX-XX"
                      />
                    </div>
                  </div>

                  {/* Адрес */}
                  <div className="border-t pt-6">
                    <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-800 mb-4">
                      <MapPin size={18} />
                      Адрес станции
                    </h3>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div>
                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                          Город/Район *
                        </label>
                        <select
                          value={getNestedValue(
                            isCreating ? newStation : selectedStation,
                            "address.cityId"
                          )}
                          onChange={(e) =>
                            handleCityChange(e.target.value, "address")
                          }
                          disabled={!isCreating && !isEditMode}
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500">
                          <option value="">Выберите город/район</option>
                          {cities.map((city) => (
                            <option key={city.id} value={city.id}>
                              {city.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                          Область
                        </label>
                        <input
                          type="text"
                          value={getNestedValue(
                            isCreating ? newStation : selectedStation,
                            "address.regionName"
                          )}
                          readOnly
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-4">
                      <div>
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                          <Home size={16} />
                          Улица *
                        </label>
                        <input
                          type="text"
                          value={getNestedValue(
                            isCreating ? newStation : selectedStation,
                            "address.street"
                          )}
                          onChange={(e) =>
                            handleInputChange("address.street", e.target.value)
                          }
                          disabled={!isCreating && !isEditMode}
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500"
                          placeholder="Название улицы"
                        />
                      </div>

                      <div>
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                          <Home size={16} />
                          Дом *
                        </label>
                        <input
                          type="text"
                          value={getNestedValue(
                            isCreating ? newStation : selectedStation,
                            "address.house"
                          )}
                          onChange={(e) =>
                            handleInputChange("address.house", e.target.value)
                          }
                          disabled={!isCreating && !isEditMode}
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500"
                          placeholder="Номер дома"
                        />
                      </div>

                      <div>
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                          <Users size={16} />
                          МСГ
                        </label>
                        <input
                          type="text"
                          value={getNestedValue(
                            isCreating ? newStation : selectedStation,
                            "address.msc"
                          )}
                          onChange={(e) =>
                            handleInputChange("address.msc", e.target.value)
                          }
                          disabled={!isCreating && !isEditMode}
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500"
                          placeholder="Махаллинский сход граждан"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Персонал */}
                  <div className="border-t pt-6">
                    <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-800 mb-4">
                      <Users size={18} />
                      Руководство и персонал
                    </h3>

                    {/* Руководитель */}
                    <div className="mb-6">
                      <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                        <User size={16} />
                        Руководитель станции
                      </h4>
                      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            ФИО *
                          </label>
                          <input
                            type="text"
                            value={getNestedValue(
                              isCreating ? newStation : selectedStation,
                              "director.fullName"
                            )}
                            onChange={(e) =>
                              handleInputChange(
                                "director.fullName",
                                e.target.value
                              )
                            }
                            disabled={!isCreating && !isEditMode}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Серия паспорта
                          </label>
                          <input
                            type="text"
                            value={getNestedValue(
                              isCreating ? newStation : selectedStation,
                              "director.passportSeries"
                            )}
                            onChange={(e) =>
                              handlePassportSeriesChange(
                                "director.passportSeries",
                                e.target.value
                              )
                            }
                            disabled={!isCreating && !isEditMode}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500"
                            placeholder="AA"
                            maxLength={2}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Номер паспорта
                          </label>
                          <input
                            type="text"
                            value={getNestedValue(
                              isCreating ? newStation : selectedStation,
                              "director.passportNumber"
                            )}
                            onChange={(e) =>
                              handlePassportNumberChange(
                                "director.passportNumber",
                                e.target.value
                              )
                            }
                            disabled={!isCreating && !isEditMode}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500"
                            placeholder="1234567"
                            maxLength={7}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            ПИНФЛ
                          </label>
                          <input
                            type="text"
                            value={getNestedValue(
                              isCreating ? newStation : selectedStation,
                              "director.pinfl"
                            )}
                            onChange={(e) =>
                              handlePinflChange(
                                "director.pinfl",
                                e.target.value
                              )
                            }
                            disabled={!isCreating && !isEditMode}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500"
                            placeholder="14 цифр"
                            maxLength={14}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 lg:grid-cols-1 gap-4 mt-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Телефон *
                          </label>
                          <input
                            type="tel"
                            value={getNestedValue(
                              isCreating ? newStation : selectedStation,
                              "director.phone"
                            )}
                            onChange={(e) =>
                              handleInputChange(
                                "director.phone",
                                e.target.value
                              )
                            }
                            disabled={!isCreating && !isEditMode}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Старший механик */}
                    <div className="mb-6">
                      <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                        <Settings size={16} />
                        Старший механик
                      </h4>
                      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            ФИО *
                          </label>
                          <input
                            type="text"
                            value={getNestedValue(
                              isCreating ? newStation : selectedStation,
                              "seniorMechanic.fullName"
                            )}
                            onChange={(e) =>
                              handleInputChange(
                                "seniorMechanic.fullName",
                                e.target.value
                              )
                            }
                            disabled={!isCreating && !isEditMode}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Серия паспорта
                          </label>
                          <input
                            type="text"
                            value={getNestedValue(
                              isCreating ? newStation : selectedStation,
                              "seniorMechanic.passportSeries"
                            )}
                            onChange={(e) =>
                              handlePassportSeriesChange(
                                "seniorMechanic.passportSeries",
                                e.target.value
                              )
                            }
                            disabled={!isCreating && !isEditMode}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500"
                            placeholder="AA"
                            maxLength={2}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Номер паспорта
                          </label>
                          <input
                            type="text"
                            value={getNestedValue(
                              isCreating ? newStation : selectedStation,
                              "seniorMechanic.passportNumber"
                            )}
                            onChange={(e) =>
                              handlePassportNumberChange(
                                "seniorMechanic.passportNumber",
                                e.target.value
                              )
                            }
                            disabled={!isCreating && !isEditMode}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500"
                            placeholder="1234567"
                            maxLength={7}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            ПИНФЛ
                          </label>
                          <input
                            type="text"
                            value={getNestedValue(
                              isCreating ? newStation : selectedStation,
                              "seniorMechanic.pinfl"
                            )}
                            onChange={(e) =>
                              handlePinflChange(
                                "seniorMechanic.pinfl",
                                e.target.value
                              )
                            }
                            disabled={!isCreating && !isEditMode}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500"
                            placeholder="14 цифр"
                            maxLength={14}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 lg:grid-cols-1 gap-4 mt-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Телефон
                          </label>
                          <input
                            type="tel"
                            value={getNestedValue(
                              isCreating ? newStation : selectedStation,
                              "seniorMechanic.phone"
                            )}
                            onChange={(e) =>
                              handleInputChange(
                                "seniorMechanic.phone",
                                e.target.value
                              )
                            }
                            disabled={!isCreating && !isEditMode}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Старший оператор */}

                    <div>
                      <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                        <User size={16} />
                        Старший оператор
                      </h4>
                      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            ФИО *
                          </label>
                          <input
                            type="text"
                            value={getNestedValue(
                              isCreating ? newStation : selectedStation,
                              "seniorOperator.fullName"
                            )}
                            onChange={(e) =>
                              handleInputChange(
                                "seniorOperator.fullName",
                                e.target.value
                              )
                            }
                            disabled={!isCreating && !isEditMode}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Серия паспорта
                          </label>
                          <input
                            type="text"
                            value={getNestedValue(
                              isCreating ? newStation : selectedStation,
                              "seniorOperator.passportSeries"
                            )}
                            onChange={(e) =>
                              handlePassportSeriesChange(
                                "seniorOperator.passportSeries",
                                e.target.value
                              )
                            }
                            disabled={!isCreating && !isEditMode}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500"
                            placeholder="AA"
                            maxLength={2}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Номер паспорта
                          </label>
                          <input
                            type="text"
                            value={getNestedValue(
                              isCreating ? newStation : selectedStation,
                              "seniorOperator.passportNumber"
                            )}
                            onChange={(e) =>
                              handlePassportNumberChange(
                                "seniorOperator.passportNumber",
                                e.target.value
                              )
                            }
                            disabled={!isCreating && !isEditMode}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500"
                            placeholder="1234567"
                            maxLength={7}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            ПИНФЛ
                          </label>
                          <input
                            type="text"
                            value={getNestedValue(
                              isCreating ? newStation : selectedStation,
                              "seniorOperator.pinfl"
                            )}
                            onChange={(e) =>
                              handlePinflChange(
                                "seniorOperator.pinfl",
                                e.target.value
                              )
                            }
                            disabled={!isCreating && !isEditMode}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500"
                            placeholder="14 цифр"
                            maxLength={14}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 lg:grid-cols-1 gap-4 mt-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Телефон
                          </label>
                          <input
                            type="tel"
                            value={getNestedValue(
                              isCreating ? newStation : selectedStation,
                              "seniorOperator.phone"
                            )}
                            onChange={(e) =>
                              handleInputChange(
                                "seniorOperator.phone",
                                e.target.value
                              )
                            }
                            disabled={!isCreating && !isEditMode}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Оборудование - будет добавлено в следующем сообщении из-за ограничения длины */}
                  <div className="border-t pt-6">
                    <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-800 mb-4">
                      <Settings size={18} />
                      Оборудование станции
                    </h3>

                    {/* Компрессоры */}
                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-gray-700 flex items-center gap-2">
                          <Settings size={16} />
                          Компрессоры
                        </h4>
                        {(isCreating || isEditMode) && (
                          <button
                            type="button"
                            onClick={() => addEquipment("compressors")}
                            className="flex items-center gap-2 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
                            <Plus size={16} />
                            Добавить компрессор
                          </button>
                        )}
                      </div>

                      {(
                        getNestedValue(
                          isCreating ? newStation : selectedStation,
                          "compressors"
                        ) || []
                      ).map((compressor, index) => (
                        <div
                          key={index}
                          className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4 p-4 border border-gray-200 rounded-xl">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Модель компрессора
                            </label>
                            <select
                              value={compressor.modelId || ""}
                              onChange={(e) =>
                                handleEquipmentSelect(
                                  "compressors",
                                  index,
                                  e.target.value,
                                  compressors
                                )
                              }
                              disabled={!isCreating && !isEditMode}
                              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500">
                              <option value="">Выберите компрессор</option>
                              {compressors.map((comp) => (
                                <option key={comp.id} value={comp.id}>
                                  {comp.brand} {comp.model}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Заводской номер
                            </label>
                            <input
                              type="text"
                              value={compressor.serialNumber || ""}
                              onChange={(e) =>
                                updateEquipment(
                                  "compressors",
                                  index,
                                  "serialNumber",
                                  e.target.value
                                )
                              }
                              disabled={!isCreating && !isEditMode}
                              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500"
                              placeholder="Введите заводской номер"
                            />
                          </div>

                          {(isCreating || isEditMode) && (
                            <div className="flex items-end">
                              <button
                                type="button"
                                onClick={() =>
                                  removeEquipment("compressors", index)
                                }
                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors h-fit">
                                <Trash2 size={20} />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Колонки */}
                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-gray-700 flex items-center gap-2">
                          <Droplets size={16} />
                          Колонки
                        </h4>
                        {(isCreating || isEditMode) && (
                          <button
                            type="button"
                            onClick={() => addEquipment("dispensers")}
                            className="flex items-center gap-2 px-3 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors">
                            <Plus size={16} />
                            Добавить колонку
                          </button>
                        )}
                      </div>

                      {(
                        getNestedValue(
                          isCreating ? newStation : selectedStation,
                          "dispensers"
                        ) || []
                      ).map((dispenser, index) => (
                        <div
                          key={index}
                          className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4 p-4 border border-gray-200 rounded-xl">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Модель колонки
                            </label>
                            <select
                              value={dispenser.modelId || ""}
                              onChange={(e) =>
                                handleEquipmentSelect(
                                  "dispensers",
                                  index,
                                  e.target.value,
                                  dispensers
                                )
                              }
                              disabled={!isCreating && !isEditMode}
                              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500">
                              <option value="">Выберите колонку</option>
                              {dispensers.map((disp) => (
                                <option key={disp.id} value={disp.id}>
                                  {disp.brand} {disp.model}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Заводской номер
                            </label>
                            <input
                              type="text"
                              value={dispenser.serialNumber || ""}
                              onChange={(e) =>
                                updateEquipment(
                                  "dispensers",
                                  index,
                                  "serialNumber",
                                  e.target.value
                                )
                              }
                              disabled={!isCreating && !isEditMode}
                              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500"
                              placeholder="Введите заводской номер"
                            />
                          </div>

                          {(isCreating || isEditMode) && (
                            <div className="flex items-end">
                              <button
                                type="button"
                                onClick={() =>
                                  removeEquipment("dispensers", index)
                                }
                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors h-fit">
                                <Trash2 size={20} />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Осушки */}
                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-gray-700 flex items-center gap-2">
                          <Wind size={16} />
                          Осушки
                        </h4>
                        {(isCreating || isEditMode) && (
                          <button
                            type="button"
                            onClick={() => addEquipment("dryers")}
                            className="flex items-center gap-2 px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors">
                            <Plus size={16} />
                            Добавить осушку
                          </button>
                        )}
                      </div>

                      {(
                        getNestedValue(
                          isCreating ? newStation : selectedStation,
                          "dryers"
                        ) || []
                      ).map((dryer, index) => (
                        <div
                          key={index}
                          className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4 p-4 border border-gray-200 rounded-xl">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Модель осушки
                            </label>
                            <select
                              value={dryer.modelId || ""}
                              onChange={(e) =>
                                handleEquipmentSelect(
                                  "dryers",
                                  index,
                                  e.target.value,
                                  gasDryers
                                )
                              }
                              disabled={!isCreating && !isEditMode}
                              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500">
                              <option value="">Выберите осушку</option>
                              {gasDryers.map((dry) => (
                                <option key={dry.id} value={dry.id}>
                                  {dry.brand} {dry.model}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Заводской номер
                            </label>
                            <input
                              type="text"
                              value={dryer.serialNumber || ""}
                              onChange={(e) =>
                                updateEquipment(
                                  "dryers",
                                  index,
                                  "serialNumber",
                                  e.target.value
                                )
                              }
                              disabled={!isCreating && !isEditMode}
                              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500"
                              placeholder="Введите заводской номер"
                            />
                          </div>

                          {(isCreating || isEditMode) && (
                            <div className="flex items-end">
                              <button
                                type="button"
                                onClick={() => removeEquipment("dryers", index)}
                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors h-fit">
                                <Trash2 size={20} />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Чиллеры */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-gray-700 flex items-center gap-2">
                          <Snowflake size={16} />
                          Чиллеры
                        </h4>
                        {(isCreating || isEditMode) && (
                          <button
                            type="button"
                            onClick={() => addEquipment("chillers")}
                            className="flex items-center gap-2 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
                            <Plus size={16} />
                            Добавить чиллер
                          </button>
                        )}
                      </div>

                      {(
                        getNestedValue(
                          isCreating ? newStation : selectedStation,
                          "chillers"
                        ) || []
                      ).map((chiller, index) => (
                        <div
                          key={index}
                          className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4 p-4 border border-gray-200 rounded-xl">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Модель чиллера
                            </label>
                            <select
                              value={chiller.modelId || ""}
                              onChange={(e) =>
                                handleEquipmentSelect(
                                  "chillers",
                                  index,
                                  e.target.value,
                                  gasChillers
                                )
                              }
                              disabled={!isCreating && !isEditMode}
                              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500">
                              <option value="">Выберите чиллер</option>
                              {gasChillers.map((chill) => (
                                <option key={chill.id} value={chill.id}>
                                  {chill.brand} {chill.model}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Заводской номер
                            </label>
                            <input
                              type="text"
                              value={chiller.serialNumber || ""}
                              onChange={(e) =>
                                updateEquipment(
                                  "chillers",
                                  index,
                                  "serialNumber",
                                  e.target.value
                                )
                              }
                              disabled={!isCreating && !isEditMode}
                              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500"
                              placeholder="Введите заводской номер"
                            />
                          </div>

                          {(isCreating || isEditMode) && (
                            <div className="flex items-end">
                              <button
                                type="button"
                                onClick={() =>
                                  removeEquipment("chillers", index)
                                }
                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors h-fit">
                                <Trash2 size={20} />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Снабжающие организации */}
                  <div className="border-t pt-6">
                    <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-800 mb-4">
                      <Zap size={18} />
                      Снабжающие организации
                    </h3>

                    {/* Газоснабжение */}
                    <div className="mb-6">
                      <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                        <Droplets size={16} />
                        Газоснабжающая организация *
                      </h4>
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <select
                            value={getNestedValue(
                              isCreating ? newStation : selectedStation,
                              "gasSupplier.cityId"
                            )}
                            onChange={(e) => {
                              const cityId = e.target.value;
                              const city = cities.find((c) => c.id === cityId);
                              if (city) {
                                handleInputChange("gasSupplier.cityId", cityId);
                                handleInputChange(
                                  "gasSupplier.cityName",
                                  city.name
                                );
                                handleInputChange(
                                  "gasSupplier.organization",
                                  `${city.name} газ`
                                );
                              }
                            }}
                            disabled={!isCreating && !isEditMode}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500">
                            <option value="">Выберите город</option>
                            {cities.map((city) => (
                              <option key={city.id} value={city.id}>
                                {city.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="text-gray-500 text-sm">
                          {getNestedValue(
                            isCreating ? newStation : selectedStation,
                            "gasSupplier.organization"
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Электроснабжение */}
                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-gray-700 flex items-center gap-2">
                          <Zap size={16} />
                          Электроснабжающие организации
                        </h4>
                        {(isCreating || isEditMode) && (
                          <button
                            type="button"
                            onClick={addElectricitySupplier}
                            className="flex items-center gap-2 px-3 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors">
                            <Plus size={16} />
                            Добавить организацию
                          </button>
                        )}
                      </div>

                      {(
                        getNestedValue(
                          isCreating ? newStation : selectedStation,
                          "electricitySuppliers"
                        ) || []
                      ).map((supplier, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-4 mb-3">
                          <div className="flex-1">
                            <select
                              value={supplier.cityId || ""}
                              onChange={(e) => {
                                const cityId = e.target.value;
                                const city = cities.find(
                                  (c) => c.id === cityId
                                );
                                if (city) {
                                  const currentData = isCreating
                                    ? newStation
                                    : selectedStation;
                                  const updatedList =
                                    currentData.electricitySuppliers.map(
                                      (item, i) =>
                                        i === index
                                          ? {
                                              ...item,
                                              cityId: cityId,
                                              cityName: city.name,
                                              organization: `${city.name} электросети`,
                                            }
                                          : item
                                    );
                                  handleInputChange(
                                    "electricitySuppliers",
                                    updatedList
                                  );
                                }
                              }}
                              disabled={!isCreating && !isEditMode}
                              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500">
                              <option value="">Выберите город</option>
                              {cities.map((city) => (
                                <option key={city.id} value={city.id}>
                                  {city.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          {(isCreating || isEditMode) && (
                            <button
                              type="button"
                              onClick={() => removeElectricitySupplier(index)}
                              className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                              <Trash2 size={20} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Водоснабжение */}
                    <div>
                      <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                        <Droplets size={16} />
                        Водоснабжающая организация
                      </h4>
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <select
                            value={getNestedValue(
                              isCreating ? newStation : selectedStation,
                              "waterSupplier.cityId"
                            )}
                            onChange={(e) => {
                              const cityId = e.target.value;
                              const city = cities.find((c) => c.id === cityId);
                              if (city) {
                                handleInputChange(
                                  "waterSupplier.cityId",
                                  cityId
                                );
                                handleInputChange(
                                  "waterSupplier.cityName",
                                  city.name
                                );
                                handleInputChange(
                                  "waterSupplier.organization",
                                  `${city.name} водоканал`
                                );
                              }
                            }}
                            disabled={!isCreating && !isEditMode}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500">
                            <option value="">Выберите город</option>
                            {cities.map((city) => (
                              <option key={city.id} value={city.id}>
                                {city.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="text-gray-500 text-sm">
                          {getNestedValue(
                            isCreating ? newStation : selectedStation,
                            "waterSupplier.organization"
                          )}
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
                      className="w-full sm:w-auto bg-red-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-red-600 transition-colors flex items-center gap-2 justify-center"
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

export default Stations;
