import React, { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  query,
  where,
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
  User,
  Phone,
  MapPin,
  Calendar,
  Building,
  Briefcase,
  FileText,
  AlertCircle,
  CheckCircle,
  Trash2,
  Clock,
  UserCheck,
  UserX,
  AlertTriangle,
} from "lucide-react";

const Employees = () => {
  const [employees, setEmployees] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [stations, setStations] = useState([]);
  const [positions, setPositions] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isWorkModalOpen, setIsWorkModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredStations, setFilteredStations] = useState([]);

  // Состояния для проверки дубликатов
  const [pinflError, setPinflError] = useState("");
  const [passportError, setPassportError] = useState("");

  // Данные для нового сотрудника
  const [newEmployee, setNewEmployee] = useState({
    pinfl: "",
    passportSeries: "",
    passportNumber: "",
    fullName: "",
    birthDate: "",
    address: "",
    phone: "",
    workHistory: [],
  });

  // Данные для нового места работы
  const [newWork, setNewWork] = useState({
    organizationId: "",
    organizationName: "",
    stationId: "",
    stationName: "",
    startDate: "",
    positionId: "",
    positionName: "",
    isUndesirable: false,
    endDate: "",
  });

  // Загрузка всех данных
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [
          employeesSnapshot,
          organizationsSnapshot,
          stationsSnapshot,
          positionsSnapshot,
        ] = await Promise.all([
          getDocs(collection(db, "employees")),
          getDocs(collection(db, "organizations")),
          getDocs(collection(db, "stations")),
          getDocs(collection(db, "positions")),
        ]);

        setEmployees(
          employeesSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
        );
        setOrganizations(
          organizationsSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))
        );
        setStations(
          stationsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
        );
        setPositions(
          positionsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
        );
      } catch (error) {
        console.error("Error loading data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Проверка дубликатов ПИНФЛ
  const checkPinflDuplicate = (pinfl) => {
    if (!pinfl || pinfl.length < 14) return false;

    const existingEmployee = employees.find((emp) => emp.pinfl === pinfl);

    if (existingEmployee) {
      setPinflError(
        `Сотрудник с таким ПИНФЛ уже существует: ${existingEmployee.fullName}`
      );
      return true;
    } else {
      setPinflError("");
      return false;
    }
  };

  // Проверка дубликатов паспорта
  const checkPassportDuplicate = (series, number) => {
    if (!series || !number) return false;

    const passportString = `${series}${number}`;
    const existingEmployee = employees.find(
      (emp) => `${emp.passportSeries}${emp.passportNumber}` === passportString
    );

    if (existingEmployee) {
      setPassportError(
        `Сотрудник с таким паспортом уже существует: ${existingEmployee.fullName}`
      );
      return true;
    } else {
      setPassportError("");
      return false;
    }
  };

  // Фильтрация сотрудников по поиску
  const filteredEmployees = employees.filter(
    (employee) =>
      employee.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.pinfl?.includes(searchTerm) ||
      employee.phone?.includes(searchTerm)
  );

  // Обработчики изменения полей сотрудника
  const handleEmployeeInputChange = (field, value) => {
    if (isCreating) {
      setNewEmployee((prev) => ({ ...prev, [field]: value }));
    } else {
      setSelectedEmployee((prev) => ({ ...prev, [field]: value }));
    }
  };

  // Обработчики для паспортных данных
  const handlePassportSeriesChange = (value) => {
    const upperValue = value.toUpperCase().replace(/[^A-ZА-Я]/g, "");
    handleEmployeeInputChange("passportSeries", upperValue);

    // Проверка дубликата паспорта при создании
    if (isCreating) {
      const currentData = isCreating ? newEmployee : selectedEmployee;
      checkPassportDuplicate(upperValue, currentData.passportNumber);
    }
  };

  const handlePassportNumberChange = (value) => {
    const numericValue = value.replace(/\D/g, "");
    handleEmployeeInputChange("passportNumber", numericValue);

    // Проверка дубликата паспорта при создании
    if (isCreating) {
      const currentData = isCreating ? newEmployee : selectedEmployee;
      checkPassportDuplicate(currentData.passportSeries, numericValue);
    }
  };

  const handlePinflChange = (value) => {
    const numericValue = value.replace(/\D/g, "").slice(0, 14);
    handleEmployeeInputChange("pinfl", numericValue);

    // Проверка дубликата ПИНФЛ при создании
    if (isCreating) {
      checkPinflDuplicate(numericValue);
    }
  };

  // Обработчики для места работы
  const handleWorkInputChange = (field, value) => {
    setNewWork((prev) => ({ ...prev, [field]: value }));
  };

  // Фильтрация станций при выборе организации
  const handleOrganizationChange = (orgId) => {
    const org = organizations.find((o) => o.id === orgId);
    if (org) {
      handleWorkInputChange("organizationId", orgId);
      handleWorkInputChange("organizationName", org.name);

      // Фильтруем станции по выбранной организации
      const filtered = stations.filter(
        (station) => station.organizationName === org.name
      );
      setFilteredStations(filtered);

      // Сбрасываем выбранную станцию
      handleWorkInputChange("stationId", "");
      handleWorkInputChange("stationName", "");
    }
  };

  const handleStationChange = (stationId) => {
    const station = filteredStations.find((s) => s.id === stationId);
    if (station) {
      handleWorkInputChange("stationId", stationId);
      handleWorkInputChange("stationName", station.stationName);
    }
  };

  const handlePositionChange = (positionId) => {
    const position = positions.find((p) => p.id === positionId);
    if (position) {
      handleWorkInputChange("positionId", positionId);
      handleWorkInputChange("positionName", position.name);
    }
  };

  // Добавление места работы
  const addWorkPlace = () => {
    const currentData = isCreating ? newEmployee : selectedEmployee;
    const updatedWorkHistory = [...(currentData.workHistory || []), newWork];

    if (isCreating) {
      setNewEmployee((prev) => ({ ...prev, workHistory: updatedWorkHistory }));
    } else {
      setSelectedEmployee((prev) => ({
        ...prev,
        workHistory: updatedWorkHistory,
      }));
    }

    setNewWork({
      organizationId: "",
      organizationName: "",
      stationId: "",
      stationName: "",
      startDate: "",
      positionId: "",
      positionName: "",
      isUndesirable: false,
      endDate: "",
    });
    setIsWorkModalOpen(false);
  };

  // Удаление места работы
  const removeWorkPlace = (index) => {
    const currentData = isCreating ? newEmployee : selectedEmployee;
    const updatedWorkHistory = currentData.workHistory.filter(
      (_, i) => i !== index
    );

    if (isCreating) {
      setNewEmployee((prev) => ({ ...prev, workHistory: updatedWorkHistory }));
    } else {
      setSelectedEmployee((prev) => ({
        ...prev,
        workHistory: updatedWorkHistory,
      }));
    }
  };

  // Открытие модальных окон
  const handleEmployeeClick = (employee) => {
    setSelectedEmployee({ ...employee });
    setIsModalOpen(true);
    setIsEditMode(false);
  };

  const handleCreateEmployee = () => {
    setIsCreating(true);
    setIsModalOpen(true);
    setNewEmployee({
      pinfl: "",
      passportSeries: "",
      passportNumber: "",
      fullName: "",
      birthDate: "",
      address: "",
      phone: "",
      workHistory: [],
    });
    // Сбрасываем ошибки при создании нового сотрудника
    setPinflError("");
    setPassportError("");
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setIsEditMode(false);
    setIsCreating(false);
    setSelectedEmployee(null);
    // Сбрасываем ошибки при закрытии модального окна
    setPinflError("");
    setPassportError("");
  };

  const handleOpenWorkModal = () => {
    setIsWorkModalOpen(true);
  };

  const handleCloseWorkModal = () => {
    setIsWorkModalOpen(false);
    setNewWork({
      organizationId: "",
      organizationName: "",
      stationId: "",
      stationName: "",
      startDate: "",
      positionId: "",
      positionName: "",
      isUndesirable: false,
      endDate: "",
    });
    setFilteredStations([]);
  };

  const handleEdit = () => setIsEditMode(true);

  // Сохранение сотрудника
  const handleSave = async () => {
    try {
      const dataToSave = isCreating ? newEmployee : selectedEmployee;

      // Проверка дубликатов перед сохранением
      const hasPinflDuplicate = checkPinflDuplicate(dataToSave.pinfl);
      const hasPassportDuplicate = checkPassportDuplicate(
        dataToSave.passportSeries,
        dataToSave.passportNumber
      );

      if (hasPinflDuplicate || hasPassportDuplicate) {
        return; // Не сохраняем если есть дубликаты
      }

      if (isCreating) {
        await addDoc(collection(db, "employees"), {
          ...dataToSave,
          createdAt: new Date(),
        });
      } else {
        await updateDoc(doc(db, "employees", selectedEmployee.id), {
          ...dataToSave,
          updatedAt: new Date(),
        });
      }

      // Перезагрузка данных
      const employeesSnapshot = await getDocs(collection(db, "employees"));
      setEmployees(
        employeesSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
      );

      handleCloseModal();
    } catch (error) {
      console.error("Error saving employee:", error);
    }
  };

  const handleCancel = () => {
    if (isCreating) {
      handleCloseModal();
    } else {
      setIsEditMode(false);
      const originalEmployee = employees.find(
        (e) => e.id === selectedEmployee.id
      );
      setSelectedEmployee(originalEmployee ? { ...originalEmployee } : null);
    }
  };

  // Проверка заполнения формы (теперь учитывает дубликаты)
  const isEmployeeFormValid = () => {
    const currentData = isCreating ? newEmployee : selectedEmployee;
    if (!currentData) return false;

    const requiredFields = [
      "pinfl",
      "passportSeries",
      "passportNumber",
      "fullName",
      "birthDate",
      "address",
      "phone",
    ];

    const isFormFilled = requiredFields.every(
      (field) =>
        currentData[field] && currentData[field].toString().trim() !== ""
    );

    // При создании также проверяем отсутствие дубликатов
    if (isCreating) {
      return isFormFilled && !pinflError && !passportError;
    }

    return isFormFilled;
  };

  const isWorkFormValid = () => {
    return (
      newWork.organizationId &&
      newWork.stationId &&
      newWork.startDate &&
      newWork.positionId
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <motion.div
          className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full"
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
            Сотрудники
          </h1>
          <p className="text-gray-600">
            Управление данными сотрудников и их трудовой историей
          </p>
        </div>

        <motion.button
          className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2 w-full lg:w-auto justify-center"
          onClick={handleCreateEmployee}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}>
          <Plus size={20} />
          Добавить сотрудника
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
              placeholder="Поиск по ФИО, ПИНФЛ или номеру телефона..."
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

      {/* Таблица сотрудников */}
      <motion.div
        className="bg-white rounded-2xl shadow-sm overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.2 }}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white">
                <th className="px-4 py-4 text-left font-semibold">ФИО</th>
                <th className="px-4 py-4 text-left font-semibold">ПИНФЛ</th>
                <th className="px-4 py-4 text-left font-semibold">Паспорт</th>
                <th className="px-4 py-4 text-left font-semibold hidden lg:table-cell">
                  Телефон
                </th>
                <th className="px-4 py-4 text-left font-semibold hidden xl:table-cell">
                  Текущее место работы
                </th>
                <th className="px-4 py-4 text-left font-semibold hidden xl:table-cell">
                  Должность
                </th>
                <th className="px-4 py-4 text-left font-semibold hidden lg:table-cell">
                  Статус
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredEmployees.map((employee, index) => {
                const currentWork =
                  employee.workHistory?.[employee.workHistory.length - 1];
                const isUndesirable = currentWork?.isUndesirable;

                return (
                  <motion.tr
                    key={employee.id}
                    onClick={() => handleEmployeeClick(employee)}
                    className="hover:bg-blue-50 transition-colors duration-200 cursor-pointer group"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: index * 0.1 }}
                    whileHover={{ scale: 1.01 }}>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                          <User className="text-blue-600" size={20} />
                        </div>
                        <div>
                          <div className="font-semibold text-gray-800">
                            {employee.fullName}
                          </div>
                          <div className="text-sm text-gray-500">
                            {employee.birthDate}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 font-mono text-gray-600">
                      {employee.pinfl}
                    </td>
                    <td className="px-4 py-4 text-gray-600">
                      {employee.passportSeries} {employee.passportNumber}
                    </td>
                    <td className="px-4 py-4 text-gray-600 hidden lg:table-cell">
                      <div className="flex items-center gap-2">
                        <Phone size={16} />
                        <span>{employee.phone}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-gray-600 hidden xl:table-cell">
                      <div className="flex items-center gap-2">
                        <Building size={16} />
                        <span>{currentWork?.stationName || "Не указано"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-gray-600 hidden xl:table-cell">
                      <div className="flex items-center gap-2">
                        <Briefcase size={16} />
                        <span>{currentWork?.positionName || "Не указана"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 hidden lg:table-cell">
                      <div
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                          isUndesirable
                            ? "bg-red-100 text-red-800"
                            : "bg-green-100 text-green-800"
                        }`}>
                        {isUndesirable ? (
                          <UserX size={12} />
                        ) : (
                          <UserCheck size={12} />
                        )}
                        {isUndesirable ? "Нежелательный" : "Активный"}
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredEmployees.length === 0 && (
          <motion.div
            className="text-center py-12"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}>
            <User className="mx-auto text-gray-400 mb-4" size={48} />
            <h3 className="text-lg font-semibold text-gray-600 mb-2">
              {searchTerm ? "Сотрудники не найдены" : "Сотрудники не добавлены"}
            </h3>
            <p className="text-gray-500 mb-4">
              {searchTerm
                ? "Попробуйте изменить условия поиска"
                : "Начните с добавления первого сотрудника"}
            </p>
            {!searchTerm && (
              <button
                onClick={handleCreateEmployee}
                className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors">
                Добавить сотрудника
              </button>
            )}
          </motion.div>
        )}
      </motion.div>

      {/* Модальное окно сотрудника */}
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
                      ? "Добавление сотрудника"
                      : isEditMode
                      ? "Редактирование сотрудника"
                      : "Информация о сотруднике"}
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

              {/* Форма сотрудника */}
              <div className="p-6 max-h-[70vh] overflow-y-auto">
                <div className="space-y-6">
                  {/* Основная информация */}
                  <div>
                    <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-800 mb-4">
                      <User size={18} />
                      Основная информация
                    </h3>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          ПИНФЛ *
                        </label>
                        <input
                          type="text"
                          value={
                            isCreating
                              ? newEmployee.pinfl
                              : selectedEmployee?.pinfl || ""
                          }
                          onChange={(e) => handlePinflChange(e.target.value)}
                          disabled={!isCreating && !isEditMode}
                          className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500 ${
                            pinflError ? "border-red-300" : "border-gray-200"
                          }`}
                          placeholder="14 цифр"
                          maxLength={14}
                        />
                        {pinflError && (
                          <div className="flex items-center gap-1 mt-1 text-red-600 text-sm">
                            <AlertTriangle size={14} />
                            <span>{pinflError}</span>
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Паспортные данные *
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={
                              isCreating
                                ? newEmployee.passportSeries
                                : selectedEmployee?.passportSeries || ""
                            }
                            onChange={(e) =>
                              handlePassportSeriesChange(e.target.value)
                            }
                            disabled={!isCreating && !isEditMode}
                            className={`w-20 px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500 ${
                              passportError
                                ? "border-red-300"
                                : "border-gray-200"
                            }`}
                            placeholder="AA"
                            maxLength={2}
                          />
                          <input
                            type="text"
                            value={
                              isCreating
                                ? newEmployee.passportNumber
                                : selectedEmployee?.passportNumber || ""
                            }
                            onChange={(e) =>
                              handlePassportNumberChange(e.target.value)
                            }
                            disabled={!isCreating && !isEditMode}
                            className={`flex-1 px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500 ${
                              passportError
                                ? "border-red-300"
                                : "border-gray-200"
                            }`}
                            placeholder="1234567"
                            maxLength={7}
                          />
                        </div>
                        {passportError && (
                          <div className="flex items-center gap-1 mt-1 text-red-600 text-sm">
                            <AlertTriangle size={14} />
                            <span>{passportError}</span>
                          </div>
                        )}
                      </div>

                      <div className="lg:col-span-2">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          ФИО *
                        </label>
                        <input
                          type="text"
                          value={
                            isCreating
                              ? newEmployee.fullName
                              : selectedEmployee?.fullName || ""
                          }
                          onChange={(e) =>
                            handleEmployeeInputChange(
                              "fullName",
                              e.target.value
                            )
                          }
                          disabled={!isCreating && !isEditMode}
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500"
                          placeholder="Введите полное имя"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Дата рождения *
                        </label>
                        <input
                          type="date"
                          value={
                            isCreating
                              ? newEmployee.birthDate
                              : selectedEmployee?.birthDate || ""
                          }
                          onChange={(e) =>
                            handleEmployeeInputChange(
                              "birthDate",
                              e.target.value
                            )
                          }
                          disabled={!isCreating && !isEditMode}
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Телефон *
                        </label>
                        <input
                          type="tel"
                          value={
                            isCreating
                              ? newEmployee.phone
                              : selectedEmployee?.phone || ""
                          }
                          onChange={(e) =>
                            handleEmployeeInputChange("phone", e.target.value)
                          }
                          disabled={!isCreating && !isEditMode}
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500"
                          placeholder="+998 XX XXX-XX-XX"
                        />
                      </div>

                      <div className="lg:col-span-2">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Адрес проживания *
                        </label>
                        <input
                          type="text"
                          value={
                            isCreating
                              ? newEmployee.address
                              : selectedEmployee?.address || ""
                          }
                          onChange={(e) =>
                            handleEmployeeInputChange("address", e.target.value)
                          }
                          disabled={!isCreating && !isEditMode}
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500"
                          placeholder="Введите полный адрес"
                        />
                      </div>
                    </div>
                  </div>

                  {/* История работы */}
                  <div className="border-t pt-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-800">
                        <Briefcase size={18} />
                        История работы
                      </h3>
                      {(isCreating || isEditMode) && (
                        <motion.button
                          onClick={handleOpenWorkModal}
                          className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}>
                          <Plus size={16} />
                          Добавить место работы
                        </motion.button>
                      )}
                    </div>

                    {(isCreating
                      ? newEmployee.workHistory
                      : selectedEmployee?.workHistory || []
                    ).map((work, index) => (
                      <motion.div
                        key={index}
                        className="border border-gray-200 rounded-xl p-4 mb-4 bg-gray-50"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}>
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h4 className="font-semibold text-gray-800">
                              {work.organizationName} - {work.stationName}
                            </h4>
                            <p className="text-gray-600">{work.positionName}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {work.isUndesirable && (
                              <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs font-medium">
                                Нежелательный
                              </span>
                            )}
                            {(isCreating || isEditMode) && (
                              <button
                                onClick={() => removeWorkPlace(index)}
                                className="p-1 text-red-500 hover:bg-red-100 rounded transition-colors">
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600">
                          <div className="flex items-center gap-2">
                            <Calendar size={14} />
                            <span>Начало: {work.startDate}</span>
                          </div>
                          {work.endDate && (
                            <div className="flex items-center gap-2">
                              <Clock size={14} />
                              <span>Окончание: {work.endDate}</span>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))}

                    {(isCreating
                      ? newEmployee.workHistory
                      : selectedEmployee?.workHistory || []
                    ).length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        <Briefcase className="mx-auto mb-2" size={32} />
                        <p>Места работы не добавлены</p>
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
                        {isEmployeeFormValid() ? (
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
                              {isCreating && (pinflError || passportError)
                                ? "Исправьте ошибки в полях выше"
                                : "Заполните все обязательные поля (*)"}
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
                        disabled={!isEmployeeFormValid()}
                        className={`px-6 py-3 rounded-xl font-semibold transition-colors flex items-center gap-2 justify-center ${
                          isEmployeeFormValid()
                            ? "bg-green-500 text-white hover:bg-green-600 cursor-pointer"
                            : "bg-gray-300 text-gray-500 cursor-not-allowed"
                        }`}
                        whileHover={
                          isEmployeeFormValid() ? { scale: 1.02 } : {}
                        }
                        whileTap={isEmployeeFormValid() ? { scale: 0.98 } : {}}>
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

      {/* Модальное окно добавления места работы - FIXED Z-INDEX */}
      <AnimatePresence>
        {isWorkModalOpen && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[100]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}>
            <motion.div
              className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}>
              {/* Заголовок модального окна */}
              <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white p-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold">
                    Добавление места работы
                  </h2>
                  <motion.button
                    onClick={handleCloseWorkModal}
                    className="w-8 h-8 rounded-full bg-white bg-opacity-20 flex items-center justify-center hover:bg-opacity-30 transition-all"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}>
                    <X size={18} />
                  </motion.button>
                </div>
              </div>

              {/* Форма места работы */}
              <div className="p-6 max-h-[70vh] overflow-y-auto">
                <div className="space-y-6">
                  <div className="grid grid-cols-1 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Организация *
                      </label>
                      <select
                        value={newWork.organizationId}
                        onChange={(e) =>
                          handleOrganizationChange(e.target.value)
                        }
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all">
                        <option value="">Выберите организацию</option>
                        {organizations.map((org) => (
                          <option key={org.id} value={org.id}>
                            {org.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Станция *
                      </label>
                      <select
                        value={newWork.stationId}
                        onChange={(e) => handleStationChange(e.target.value)}
                        disabled={!newWork.organizationId}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500">
                        <option value="">Выберите станцию</option>
                        {filteredStations.map((station) => (
                          <option key={station.id} value={station.id}>
                            {station.stationName}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Должность *
                      </label>
                      <select
                        value={newWork.positionId}
                        onChange={(e) => handlePositionChange(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all">
                        <option value="">Выберите должность</option>
                        {positions.map((position) => (
                          <option key={position.id} value={position.id}>
                            {position.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Дата начала работы *
                      </label>
                      <input
                        type="date"
                        value={newWork.startDate}
                        onChange={(e) =>
                          handleWorkInputChange("startDate", e.target.value)
                        }
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Дата окончания работы
                      </label>
                      <input
                        type="date"
                        value={newWork.endDate}
                        onChange={(e) =>
                          handleWorkInputChange("endDate", e.target.value)
                        }
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                      />
                    </div>

                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="isUndesirable"
                        checked={newWork.isUndesirable}
                        onChange={(e) =>
                          handleWorkInputChange(
                            "isUndesirable",
                            e.target.checked
                          )
                        }
                        className="w-4 h-4 text-red-500 border-gray-300 rounded focus:ring-red-500"
                      />
                      <label
                        htmlFor="isUndesirable"
                        className="text-sm font-medium text-gray-700">
                        Нежелательный сотрудник
                      </label>
                    </div>
                  </div>

                  {/* Индикатор заполнения формы */}
                  <div className="flex items-center gap-2 text-sm">
                    {isWorkFormValid() ? (
                      <>
                        <CheckCircle className="text-green-500" size={16} />
                        <span className="text-green-600">
                          Все обязательные поля заполнены
                        </span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="text-orange-500" size={16} />
                        <span className="text-orange-600">
                          Заполните все обязательные поля (*)
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Кнопки */}
              <div className="border-t px-6 py-4 bg-gray-50">
                <div className="flex flex-col sm:flex-row gap-3 justify-end">
                  <motion.button
                    onClick={handleCloseWorkModal}
                    className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-100 transition-colors"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}>
                    Отмена
                  </motion.button>
                  <motion.button
                    onClick={addWorkPlace}
                    disabled={!isWorkFormValid()}
                    className={`px-6 py-3 rounded-xl font-semibold transition-colors flex items-center gap-2 justify-center ${
                      isWorkFormValid()
                        ? "bg-green-500 text-white hover:bg-green-600 cursor-pointer"
                        : "bg-gray-300 text-gray-500 cursor-not-allowed"
                    }`}
                    whileHover={isWorkFormValid() ? { scale: 1.02 } : {}}
                    whileTap={isWorkFormValid() ? { scale: 0.98 } : {}}>
                    <Plus size={16} />
                    Добавить
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Employees;
