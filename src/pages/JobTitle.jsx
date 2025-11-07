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
  Users,
  UserCheck,
  Briefcase,
  Crown,
  HardHat,
  CheckCircle,
  AlertCircle,
  Building,
  Star,
  Target,
  Award,
  FileText,
} from "lucide-react";

const JobTitle = () => {
  const [jobTitles, setJobTitles] = useState([]);
  const [selectedJobTitle, setSelectedJobTitle] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Данные для новой должности
  const [newJobTitle, setNewJobTitle] = useState({
    name: "",
    type: "",
    description: "",
    responsibilities: "",
    requirements: "",
    salaryRange: "",
  });

  // Типы должностей
  const jobTypes = [
    {
      value: "АУП",
      label: "Административно-управленческий персонал",
      icon: Crown,
    },
    { value: "Рабочий", label: "Рабочий персонал", icon: HardHat },
  ];

  // Загрузка данных
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const jobTitlesSnapshot = await getDocs(collection(db, "jobtitles"));
        const jobTitlesData = jobTitlesSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setJobTitles(jobTitlesData);
      } catch (error) {
        console.error("Error loading job titles:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Проверка заполнения формы
  const checkFormValidity = () => {
    const currentData = isCreating ? newJobTitle : selectedJobTitle;

    if (!currentData) return false;

    const requiredFields = ["name", "type"];

    return requiredFields.every(
      (field) =>
        currentData[field] && currentData[field].toString().trim() !== ""
    );
  };

  // Фильтрация должностей по поиску
  const filteredJobTitles = jobTitles.filter(
    (job) =>
      job.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Обработчик изменения полей
  const handleInputChange = (field, value) => {
    if (isCreating) {
      setNewJobTitle((prev) => ({ ...prev, [field]: value }));
    } else {
      setSelectedJobTitle((prev) => ({ ...prev, [field]: value }));
    }
  };

  // Открытие модального окна для просмотра должности
  const handleJobTitleClick = (job) => {
    setSelectedJobTitle({ ...job });
    setIsModalOpen(true);
    setIsEditMode(false);
  };

  // Открытие модального окна для создания должности
  const handleCreateJobTitle = () => {
    setIsCreating(true);
    setIsModalOpen(true);
    setNewJobTitle({
      name: "",
      type: "",
      description: "",
      responsibilities: "",
      requirements: "",
      salaryRange: "",
    });
  };

  // Закрытие модального окна
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setIsEditMode(false);
    setIsCreating(false);
    setSelectedJobTitle(null);
  };

  // Редактирование должности
  const handleEdit = () => {
    setIsEditMode(true);
  };

  // Сохранение изменений
  const handleSave = async () => {
    const isValid = checkFormValidity();
    if (!isValid) return;

    try {
      if (isCreating) {
        await addDoc(collection(db, "jobtitles"), {
          ...newJobTitle,
          createdAt: new Date(),
        });
      } else {
        await updateDoc(doc(db, "jobtitles", selectedJobTitle.id), {
          ...selectedJobTitle,
          updatedAt: new Date(),
        });
      }

      // Перезагрузка данных
      const jobTitlesSnapshot = await getDocs(collection(db, "jobtitles"));
      const jobTitlesData = jobTitlesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setJobTitles(jobTitlesData);

      handleCloseModal();
    } catch (error) {
      console.error("Error saving job title:", error);
    }
  };

  // Отмена редактирования
  const handleCancel = () => {
    if (isCreating) {
      handleCloseModal();
    } else {
      setIsEditMode(false);
      // Восстанавливаем исходные данные из базы
      const originalJobTitle = jobTitles.find(
        (job) => job.id === selectedJobTitle.id
      );
      setSelectedJobTitle(originalJobTitle ? { ...originalJobTitle } : null);
    }
  };

  // Получение иконки для типа должности
  const getJobTypeIcon = (type) => {
    const jobType = jobTypes.find((t) => t.value === type);
    return jobType ? jobType.icon : Users;
  };

  // Получение цвета для типа должности
  const getJobTypeColor = (type) => {
    return type === "АУП"
      ? "from-purple-500 to-pink-600"
      : "from-blue-500 to-cyan-600";
  };

  // Получение цвета текста для типа должности
  const getJobTypeTextColor = (type) => {
    return type === "АУП" ? "text-purple-600" : "text-blue-600";
  };

  // Получение цвета бейджа для типа должности
  const getJobTypeBadgeColor = (type) => {
    return type === "АУП"
      ? "bg-gradient-to-r from-purple-100 to-pink-100 text-purple-800 border-purple-200"
      : "bg-gradient-to-r from-blue-100 to-cyan-100 text-blue-800 border-blue-200";
  };

  // Проверяем валидность формы для отображения
  const isFormValid = checkFormValidity();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 flex items-center justify-center">
        <motion.div
          className="w-12 h-12 border-4 border-pink-200 border-t-pink-600 rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 p-4 lg:p-8">
      {/* Заголовок и кнопка добавления */}
      <motion.div
        className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}>
        <div>
          <h1 className="text-3xl lg:text-4xl font-bold text-gray-800 mb-2">
            Должности
          </h1>
          <p className="text-gray-600">
            Управление должностями и их характеристиками
          </p>
        </div>

        <motion.button
          className="bg-gradient-to-r from-red-500 to-pink-600 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2 w-full lg:w-auto justify-center"
          onClick={handleCreateJobTitle}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}>
          <Plus size={20} />
          Добавить должность
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
              placeholder="Поиск по названию, типу или описанию..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300"
            />
          </div>
          <button className="px-4 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors duration-300 flex items-center gap-2 justify-center">
            <Filter size={20} />
            <span className="hidden lg:inline">Фильтры</span>
          </button>
        </div>
      </motion.div>

      {/* Таблица должностей */}
      <motion.div
        className="bg-white rounded-2xl shadow-sm overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.2 }}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-purple-500 to-pink-600 text-white">
                <th className="px-4 py-4 text-left font-semibold">Должность</th>
                <th className="px-4 py-4 text-left font-semibold">Тип</th>
                <th className="px-4 py-4 text-left font-semibold hidden md:table-cell">
                  Описание
                </th>
                <th className="px-4 py-4 text-left font-semibold hidden lg:table-cell">
                  Зарплатный диапазон
                </th>
                <th className="px-4 py-4 text-left font-semibold hidden xl:table-cell">
                  Статус
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredJobTitles.map((job, index) => {
                const JobTypeIcon = getJobTypeIcon(job.type);
                return (
                  <motion.tr
                    key={job.id}
                    onClick={() => handleJobTitleClick(job)}
                    className="hover:bg-purple-50 transition-colors duration-200 cursor-pointer group"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: index * 0.1 }}
                    whileHover={{ scale: 1.01 }}>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform ${getJobTypeColor(
                            job.type
                          )}`}>
                          <JobTypeIcon className="text-white" size={20} />
                        </div>
                        <div>
                          <div className="font-semibold text-gray-800">
                            {job.name}
                          </div>
                          <div className="text-sm text-gray-500 hidden sm:block">
                            {job.description?.substring(0, 50)}
                            {job.description?.length > 50 ? "..." : ""}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium border ${getJobTypeBadgeColor(
                          job.type
                        )}`}>
                        <JobTypeIcon size={14} />
                        {job.type}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-gray-600 hidden md:table-cell">
                      {job.description ? (
                        <div className="flex items-center gap-2">
                          <FileText className="text-purple-500" size={16} />
                          <span className="max-w-xs truncate">
                            {job.description}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-400">Нет описания</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-gray-600 hidden lg:table-cell">
                      {job.salaryRange ? (
                        <div className="flex items-center gap-2">
                          <Award className="text-green-500" size={16} />
                          <span className="font-medium">{job.salaryRange}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400">Не указан</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-gray-600 hidden xl:table-cell">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-green-600 font-medium">
                          Активна
                        </span>
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredJobTitles.length === 0 && (
          <motion.div
            className="text-center py-12"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}>
            <Briefcase className="mx-auto text-gray-400 mb-4" size={48} />
            <h3 className="text-lg font-semibold text-gray-600 mb-2">
              {searchTerm ? "Должности не найдены" : "Должности не добавлены"}
            </h3>
            <p className="text-gray-500 mb-4">
              {searchTerm
                ? "Попробуйте изменить условия поиска"
                : "Начните с добавления первой должности"}
            </p>
            {!searchTerm && (
              <button
                onClick={handleCreateJobTitle}
                className="bg-gradient-to-r from-purple-500 to-pink-600 text-white px-6 py-2 rounded-lg hover:shadow-lg transition-all">
                Добавить должность
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
              <div
                className={`bg-gradient-to-r ${
                  selectedJobTitle
                    ? getJobTypeColor(selectedJobTitle.type)
                    : "from-purple-500 to-pink-600"
                } text-white p-6`}>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-white bg-opacity-20 rounded-xl flex items-center justify-center">
                      <Briefcase size={24} />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold">
                        {isCreating
                          ? "Создание должности"
                          : isEditMode
                          ? "Редактирование должности"
                          : "Информация о должности"}
                      </h2>
                      <p className="text-white text-opacity-90">
                        {isCreating
                          ? "Заполните информацию о новой должности"
                          : "Просмотр и редактирование данных должности"}
                      </p>
                    </div>
                  </div>
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
                        <Users size={16} />
                        Наименование должности *
                      </label>
                      <input
                        type="text"
                        value={
                          isCreating
                            ? newJobTitle.name
                            : selectedJobTitle?.name || ""
                        }
                        onChange={(e) =>
                          handleInputChange("name", e.target.value)
                        }
                        disabled={!isCreating && !isEditMode}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500"
                        placeholder="Введите название должности"
                      />
                    </div>

                    <div>
                      <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                        <Building size={16} />
                        Тип должности *
                      </label>
                      <select
                        value={
                          isCreating
                            ? newJobTitle.type
                            : selectedJobTitle?.type || ""
                        }
                        onChange={(e) =>
                          handleInputChange("type", e.target.value)
                        }
                        disabled={!isCreating && !isEditMode}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500">
                        <option value="">Выберите тип должности</option>
                        {jobTypes.map((type) => {
                          const IconComponent = type.icon;
                          return (
                            <option key={type.value} value={type.value}>
                              {type.label}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>

                  {/* Описание должности */}
                  <div>
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                      <Target size={16} />
                      Описание должности
                    </label>
                    <textarea
                      value={
                        isCreating
                          ? newJobTitle.description
                          : selectedJobTitle?.description || ""
                      }
                      onChange={(e) =>
                        handleInputChange("description", e.target.value)
                      }
                      disabled={!isCreating && !isEditMode}
                      rows="3"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500 resize-none"
                      placeholder="Опишите основные задачи и цели должности..."
                    />
                  </div>

                  {/* Обязанности */}
                  <div>
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                      <CheckCircle size={16} />
                      Основные обязанности
                    </label>
                    <textarea
                      value={
                        isCreating
                          ? newJobTitle.responsibilities
                          : selectedJobTitle?.responsibilities || ""
                      }
                      onChange={(e) =>
                        handleInputChange("responsibilities", e.target.value)
                      }
                      disabled={!isCreating && !isEditMode}
                      rows="4"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500 resize-none"
                      placeholder="Опишите основные обязанности и задачи..."
                    />
                  </div>

                  {/* Требования */}
                  <div>
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                      <UserCheck size={16} />
                      Требования к кандидату
                    </label>
                    <textarea
                      value={
                        isCreating
                          ? newJobTitle.requirements
                          : selectedJobTitle?.requirements || ""
                      }
                      onChange={(e) =>
                        handleInputChange("requirements", e.target.value)
                      }
                      disabled={!isCreating && !isEditMode}
                      rows="4"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500 resize-none"
                      placeholder="Опишите требования к образованию, опыту и навыкам..."
                    />
                  </div>

                  {/* Зарплатный диапазон */}
                  <div>
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                      <Award size={16} />
                      Зарплатный диапазон
                    </label>
                    <input
                      type="text"
                      value={
                        isCreating
                          ? newJobTitle.salaryRange
                          : selectedJobTitle?.salaryRange || ""
                      }
                      onChange={(e) =>
                        handleInputChange("salaryRange", e.target.value)
                      }
                      disabled={!isCreating && !isEditMode}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500"
                      placeholder="Например: 50,000 - 80,000 руб."
                    />
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
                      className="w-full sm:w-auto bg-gradient-to-r from-purple-500 to-pink-600 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg transition-all flex items-center gap-2 justify-center"
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
                        className={`px-6 py-3 rounded-xl font-semibold transition-all flex items-center gap-2 justify-center ${
                          isFormValid
                            ? "bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:shadow-lg cursor-pointer"
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

export default JobTitle;
