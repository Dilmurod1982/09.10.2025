import React, { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  getDoc,
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
  Calendar,
  UserCheck,
  UserX,
  Briefcase,
} from "lucide-react";

const Stations = () => {
  const [stations, setStations] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [cities, setCities] = useState([]);
  const [compressors, setCompressors] = useState([]);
  const [dispensers, setDispensers] = useState([]);
  const [gasDryers, setGasDryers] = useState([]);
  const [gasChillers, setGasChillers] = useState([]);
  const [positions, setPositions] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [jobTitles, setJobTitles] = useState([]); // Новая коллекция для должностей
  const [selectedStation, setSelectedStation] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [newEmployee, setNewEmployee] = useState({
    fullName: "",
    passportSeries: "",
    passportNumber: "",
    pinfl: "",
    birthDate: "",
    phone: "",
    address: "",
  });
  const [currentEmployeeIndex, setCurrentEmployeeIndex] = useState(null);
  const [pinflError, setPinflError] = useState("");
  const [currentUser, setCurrentUser] = useState({
    id: "user123",
    name: "Администратор",
  });

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
      (station.staff &&
        station.staff.some((emp) =>
          emp.employeeName?.toLowerCase().includes(searchTerm.toLowerCase())
        ))
  );

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
    staff: [],
    positions: [], // Новое поле для штатов/должностей
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
      organization: "",
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
          positionsSnapshot,
          employeesSnapshot,
          jobTitlesSnapshot, // Новая загрузка должностей
        ] = await Promise.all([
          getDocs(collection(db, "stations")),
          getDocs(collection(db, "organizations")),
          getDocs(collection(db, "cities")),
          getDocs(collection(db, "compressors")),
          getDocs(collection(db, "dispensers")),
          getDocs(collection(db, "gasDryers")),
          getDocs(collection(db, "gasChillers")),
          getDocs(collection(db, "positions")),
          getDocs(collection(db, "employees")),
          getDocs(collection(db, "jobtitles")), // Загружаем должности
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
        setPositions(
          positionsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
        );
        setEmployees(
          employeesSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
        );
        setJobTitles(
          jobTitlesSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
        );
      } catch (error) {
        console.error("Error loading data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Вспомогательная функция для получения вложенных значений
  const getNestedValue = (obj, path) => {
    return path.split(".").reduce((acc, part) => acc && acc[part], obj);
  };

  // Функция для получения доступного оборудования (не прикрепленного к другим станциям)
  const getAvailableEquipment = (
    equipmentList,
    equipmentType,
    currentStationEquipment = []
  ) => {
    return equipmentList.filter((equipment) => {
      // Если оборудование уже выбрано в текущей станции, показываем его
      const isCurrentlySelected = currentStationEquipment.some(
        (currentEq) => currentEq.equipmentId === equipment.id
      );

      if (isCurrentlySelected) {
        return true;
      }

      // Если нет истории движения, оборудование доступно
      if (
        !equipment.movementHistory ||
        equipment.movementHistory.length === 0
      ) {
        return true;
      }

      // Получаем последнюю запись в истории движения
      const sortedHistory = equipment.movementHistory
        .filter((move) => move.toStationId || move.stationId) // Фильтруем записи о прикреплении
        .sort((a, b) => {
          const dateA = new Date(a.attachmentDate || a.date);
          const dateB = new Date(b.attachmentDate || b.date);
          return dateB - dateA;
        });

      if (sortedHistory.length === 0) {
        return true;
      }

      const lastMovement = sortedHistory[0];

      // Оборудование доступно если:
      // 1. Есть дата открепления И эта дата уже прошла
      // 2. Или нет активного прикрепления (последняя запись имеет detachmentDate)
      if (lastMovement.detachmentDate) {
        const detachmentDate = new Date(lastMovement.detachmentDate);
        const today = new Date();
        return detachmentDate <= today; // Доступно если дата открепления прошла
      }

      // Если нет даты открепления - оборудование прикреплено к другой станции
      return false;
    });
  };

  // Получаем доступное оборудование для каждого типа с учетом уже выбранного
  const getCurrentEquipment = (type) => {
    return (
      getNestedValue(isCreating ? newStation : selectedStation, type) || []
    );
  };

  const availableCompressors = getAvailableEquipment(
    compressors,
    "compressors",
    getCurrentEquipment("compressors")
  );

  const availableDispensers = getAvailableEquipment(
    dispensers,
    "dispensers",
    getCurrentEquipment("dispensers")
  );

  const availableGasDryers = getAvailableEquipment(
    gasDryers,
    "gasDryers",
    getCurrentEquipment("dryers")
  );

  const availableGasChillers = getAvailableEquipment(
    gasChillers,
    "gasChillers",
    getCurrentEquipment("chillers")
  );

  // Находим должность руководителя
  const directorPosition = positions.find(
    (p) =>
      p.name &&
      (p.name.toLowerCase().includes("руководитель") ||
        p.name.toLowerCase().includes("директор"))
  );

  // Автоматическое добавление строки руководителя при создании новой станции
  useEffect(() => {
    if (isCreating && isModalOpen && directorPosition) {
      if (!newStation.staff || newStation.staff.length === 0) {
        setNewStation((prev) => ({
          ...prev,
          staff: [
            {
              positionId: directorPosition.id,
              positionName: directorPosition.name,
              employeeId: "",
              employeeName: "",
              pinfl: "",
              passportSeries: "",
              passportNumber: "",
              birthDate: "",
              phone: "",
            },
          ],
        }));
      }
    }
  }, [isCreating, isModalOpen, directorPosition]);

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
      "gasSupplier.cityId",
    ];

    // Проверяем, что все обязательные поля заполнены
    const basicFieldsValid = requiredFields.every((field) => {
      const value = getNestedValue(currentData, field);
      return value && value.toString().trim() !== "";
    });

    // Проверяем, что руководитель выбран
    const staffValid =
      currentData.staff &&
      currentData.staff.length > 0 &&
      currentData.staff[0].positionId &&
      currentData.staff[0].employeeId &&
      currentData.staff[0].employeeId.trim() !== "";

    // Проверяем, что для всего оборудования заполнены даты прикрепления
    const equipmentValid = [
      ...(currentData.compressors || []),
      ...(currentData.dispensers || []),
      ...(currentData.dryers || []),
      ...(currentData.chillers || []),
    ].every(
      (equipment) =>
        equipment.attachmentDate && equipment.attachmentDate.trim() !== ""
    );

    return basicFieldsValid && staffValid && equipmentValid;
  };

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

  // Обработчик выбора сотрудника
  const handleEmployeeChange = (index, employeeId) => {
    if (employeeId === "new") {
      // Открываем модальное окно для нового сотрудника
      setNewEmployee({
        fullName: "",
        passportSeries: "",
        passportNumber: "",
        pinfl: "",
        birthDate: "",
        phone: "",
        address: "",
      });
      setCurrentEmployeeIndex(index);
      setIsEmployeeModalOpen(true);
      return;
    }

    const employee = employees.find((emp) => emp.id === employeeId);
    if (employee) {
      const currentData = isCreating ? newStation : selectedStation;
      const updatedStaff = currentData.staff.map((emp, i) =>
        i === index
          ? {
              ...emp,
              employeeId: employeeId,
              employeeName: employee.fullName,
              pinfl: employee.pinfl || "",
              passportSeries: employee.passportSeries || "",
              passportNumber: employee.passportNumber || "",
              birthDate: employee.birthDate || "",
              phone: employee.phone || "",
            }
          : emp
      );
      handleInputChange("staff", updatedStaff);
    }
  };

  // Функция для проверки существования ПИНФЛ
  const checkPinflExists = async (pinfl) => {
    if (!pinfl || pinfl.length !== 14) return false;

    try {
      const q = query(collection(db, "employees"), where("pinfl", "==", pinfl));
      const querySnapshot = await getDocs(q);
      return !querySnapshot.empty;
    } catch (error) {
      console.error("Error checking PINFL:", error);
      return false;
    }
  };

  // Обработчик изменения ПИНФЛ в модальном окне сотрудника
  const handlePinflChange = async (value) => {
    const cleanPinfl = value.replace(/\D/g, "").slice(0, 14);
    setNewEmployee({
      ...newEmployee,
      pinfl: cleanPinfl,
    });

    // Проверяем существование ПИНФЛ только если введено 14 цифр
    if (cleanPinfl.length === 14) {
      const exists = await checkPinflExists(cleanPinfl);
      if (exists) {
        setPinflError("Сотрудник с таким ПИНФЛ уже существует");
      } else {
        setPinflError("");
      }
    } else {
      setPinflError("");
    }
  };

  // Создание нового сотрудника
  const handleCreateEmployee = async () => {
    if (pinflError) {
      return; // Не создаем сотрудника если есть ошибка ПИНФЛ
    }

    try {
      // Добавляем сотрудника в Firestore
      const docRef = await addDoc(collection(db, "employees"), {
        ...newEmployee,
        workHistory: [],
        createdAt: new Date(),
      });

      // Обновляем локальный state
      const newEmployeeWithId = {
        id: docRef.id,
        ...newEmployee,
        workHistory: [],
        createdAt: new Date(),
      };
      setEmployees((prev) => [...prev, newEmployeeWithId]);

      // Обновляем staff в станции
      const currentData = isCreating ? newStation : selectedStation;
      const updatedStaff = currentData.staff.map((emp, i) =>
        i === currentEmployeeIndex
          ? {
              ...emp,
              employeeId: docRef.id,
              employeeName: newEmployee.fullName,
              pinfl: newEmployee.pinfl || "",
              passportSeries: newEmployee.passportSeries || "",
              passportNumber: newEmployee.passportNumber || "",
              birthDate: newEmployee.birthDate || "",
              phone: newEmployee.phone || "",
            }
          : emp
      );
      handleInputChange("staff", updatedStaff);

      // Закрываем модальное окно
      setIsEmployeeModalOpen(false);
      setNewEmployee({
        fullName: "",
        passportSeries: "",
        passportNumber: "",
        pinfl: "",
        birthDate: "",
        phone: "",
        address: "",
      });
      setPinflError(""); // Сбрасываем ошибку
    } catch (error) {
      console.error("Error creating employee:", error);
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

  // Обработчики для оборудования
  const addEquipment = (type) => {
    const emptyItem = {
      equipmentId: "",
      modelId: "",
      modelName: "",
      brand: "",
      serialNumber: "",
      attachmentDate: "",
      detachmentDate: "",
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
                  equipmentId: selectedId,
                  modelId: selected.id,
                  modelName: selected.model,
                  brand: selected.brand,
                  serialNumber: selected.serialNumber || "",
                  attachmentDate: new Date().toISOString().split("T")[0], // Автозаполнение текущей датой
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
                  equipmentId: selectedId,
                  modelId: selected.id,
                  modelName: selected.model,
                  brand: selected.brand,
                  serialNumber: selected.serialNumber || "",
                  attachmentDate: new Date().toISOString().split("T")[0], // Автозаполнение текущей датой
                }
              : item
          );
          return { ...prev, [type]: updatedList };
        });
      }
    } else {
      // Если выбрана пустая опция, очищаем поля
      if (isCreating) {
        setNewStation((prev) => {
          const updatedList = prev[type].map((item, i) =>
            i === index
              ? {
                  equipmentId: "",
                  modelId: "",
                  modelName: "",
                  brand: "",
                  serialNumber: "",
                  attachmentDate: "",
                  detachmentDate: "",
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
                  equipmentId: "",
                  modelId: "",
                  modelName: "",
                  brand: "",
                  serialNumber: "",
                  attachmentDate: "",
                  detachmentDate: "",
                }
              : item
          );
          return { ...prev, [type]: updatedList };
        });
      }
    }
  };

  // Функция для сброса оборудования
  const handleEquipmentReset = (type, index) => {
    if (isCreating) {
      setNewStation((prev) => {
        const updatedList = prev[type].map((item, i) =>
          i === index
            ? {
                equipmentId: "",
                modelId: "",
                modelName: "",
                brand: "",
                serialNumber: "",
                attachmentDate: "",
                detachmentDate: "",
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
                equipmentId: "",
                modelId: "",
                modelName: "",
                brand: "",
                serialNumber: "",
                attachmentDate: "",
                detachmentDate: "",
              }
            : item
        );
        return { ...prev, [type]: updatedList };
      });
    }
  };

  // Функция для обновления истории движения оборудования
  const updateEquipmentMovementHistory = async (
    equipmentId,
    equipmentType,
    stationData,
    attachmentDate,
    detachmentDate = null
  ) => {
    try {
      const equipmentDoc = doc(db, equipmentType, equipmentId);
      const equipmentSnapshot = await getDoc(equipmentDoc);

      if (equipmentSnapshot.exists()) {
        const equipmentData = equipmentSnapshot.data();
        const movementHistory = equipmentData.movementHistory || [];

        if (detachmentDate) {
          // Если это открепление, находим активную запись и обновляем ее
          const activeMovementIndex = movementHistory.findIndex(
            (move) =>
              (move.stationId === stationData.id ||
                move.toStationId === stationData.id) &&
              !move.detachmentDate
          );

          if (activeMovementIndex !== -1) {
            movementHistory[activeMovementIndex] = {
              ...movementHistory[activeMovementIndex],
              detachmentDate: detachmentDate,
              detachedBy: currentUser.name,
              detachedById: currentUser.id,
            };
          }
        } else {
          // Если это прикрепление, добавляем новую запись
          const movementRecord = {
            stationId: stationData.id,
            stationName: stationData.stationName,
            attachmentDate: attachmentDate,
            attachedBy: currentUser.name,
            attachedById: currentUser.id,
            detachmentDate: null,
            detachedBy: null,
            detachedById: null,
          };
          movementHistory.push(movementRecord);
        }

        await updateDoc(equipmentDoc, {
          movementHistory: movementHistory,
          updatedAt: new Date(),
        });
      }
    } catch (error) {
      console.error(
        `Error updating movement history for ${equipmentType}:`,
        error
      );
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

  // Обработчики для штатов/должностей
  const addPosition = () => {
    const currentData = isCreating ? newStation : selectedStation;
    const updatedList = [
      ...(currentData.positions || []),
      {
        jobTitleId: "",
        jobTitleName: "",
        description: "",
        requirements: "",
        responsibilities: "",
        salaryRange: "",
        type: "",
      },
    ];
    handleInputChange("positions", updatedList);
  };

  const removePosition = (index) => {
    const currentData = isCreating ? newStation : selectedStation;
    const updatedList = currentData.positions.filter((_, i) => i !== index);
    handleInputChange("positions", updatedList);
  };

  const handlePositionChange = (index, jobTitleId) => {
    const selectedJobTitle = jobTitles.find((job) => job.id === jobTitleId);
    if (selectedJobTitle) {
      const currentData = isCreating ? newStation : selectedStation;
      const updatedPositions = currentData.positions.map((pos, i) =>
        i === index
          ? {
              jobTitleId: jobTitleId,
              jobTitleName: selectedJobTitle.name,
              description: selectedJobTitle.description || "",
              requirements: selectedJobTitle.requirements || "",
              responsibilities: selectedJobTitle.responsibilities || "",
              salaryRange: selectedJobTitle.salaryRange || "",
              type: selectedJobTitle.type || "",
            }
          : pos
      );
      handleInputChange("positions", updatedPositions);
    }
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
      staff: [],
      positions: [], // Инициализируем пустой массив должностей
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
    if (!checkFormValidity()) {
      console.log("Form is not valid, cannot save");
      return;
    }

    try {
      const dataToSave = isCreating ? newStation : selectedStation;

      let stationId;
      if (isCreating) {
        // Сначала создаем станцию
        const docRef = await addDoc(collection(db, "stations"), {
          ...dataToSave,
          createdAt: new Date(),
        });
        stationId = docRef.id;

        // Обновляем workHistory для руководителя
        if (dataToSave.staff && dataToSave.staff.length > 0) {
          const director = dataToSave.staff[0];
          if (director.employeeId) {
            const employeeDoc = await getDoc(
              doc(db, "employees", director.employeeId)
            );

            if (employeeDoc.exists()) {
              const employeeData = employeeDoc.data();

              const workHistoryEntry = {
                stationId: stationId,
                stationName: dataToSave.stationName,
                organizationId: dataToSave.organizationId,
                organizationName: dataToSave.organizationName,
                positionId: director.positionId,
                positionName: director.positionName,
                startDate: new Date().toISOString().split("T")[0],
                endDate: null,
                isUndesirable: false,
              };

              const updatedWorkHistory = [
                ...(employeeData.workHistory || []),
                workHistoryEntry,
              ];

              await updateDoc(doc(db, "employees", director.employeeId), {
                workHistory: updatedWorkHistory,
                updatedAt: new Date(),
              });
            }
          }
        }

        // Обновляем историю движения для оборудования
        const equipmentUpdates = [];

        // Компрессоры
        if (dataToSave.compressors) {
          dataToSave.compressors.forEach((compressor) => {
            if (compressor.equipmentId && compressor.attachmentDate) {
              equipmentUpdates.push(
                updateEquipmentMovementHistory(
                  compressor.equipmentId,
                  "compressors",
                  { id: stationId, stationName: dataToSave.stationName },
                  compressor.attachmentDate
                )
              );
            }
          });
        }

        // Колонки
        if (dataToSave.dispensers) {
          dataToSave.dispensers.forEach((dispenser) => {
            if (dispenser.equipmentId && dispenser.attachmentDate) {
              equipmentUpdates.push(
                updateEquipmentMovementHistory(
                  dispenser.equipmentId,
                  "dispensers",
                  { id: stationId, stationName: dataToSave.stationName },
                  dispenser.attachmentDate
                )
              );
            }
          });
        }

        // Осушки
        if (dataToSave.dryers) {
          dataToSave.dryers.forEach((dryer) => {
            if (dryer.equipmentId && dryer.attachmentDate) {
              equipmentUpdates.push(
                updateEquipmentMovementHistory(
                  dryer.equipmentId,
                  "gasDryers",
                  { id: stationId, stationName: dataToSave.stationName },
                  dryer.attachmentDate
                )
              );
            }
          });
        }

        // Чиллеры
        if (dataToSave.chillers) {
          dataToSave.chillers.forEach((chiller) => {
            if (chiller.equipmentId && chiller.attachmentDate) {
              equipmentUpdates.push(
                updateEquipmentMovementHistory(
                  chiller.equipmentId,
                  "gasChillers",
                  { id: stationId, stationName: dataToSave.stationName },
                  chiller.attachmentDate
                )
              );
            }
          });
        }

        // Ждем завершения всех обновлений оборудования
        await Promise.all(equipmentUpdates);
      } else {
        stationId = selectedStation.id;

        // Для редактирования обновляем историю движения при изменении дат
        const equipmentUpdates = [];

        // Компрессоры
        if (dataToSave.compressors) {
          dataToSave.compressors.forEach((compressor) => {
            if (compressor.equipmentId && compressor.detachmentDate) {
              equipmentUpdates.push(
                updateEquipmentMovementHistory(
                  compressor.equipmentId,
                  "compressors",
                  { id: stationId, stationName: dataToSave.stationName },
                  compressor.attachmentDate,
                  compressor.detachmentDate
                )
              );
            } else if (compressor.equipmentId && compressor.attachmentDate) {
              // Обновляем дату прикрепления если нужно
              equipmentUpdates.push(
                updateEquipmentMovementHistory(
                  compressor.equipmentId,
                  "compressors",
                  { id: stationId, stationName: dataToSave.stationName },
                  compressor.attachmentDate
                )
              );
            }
          });
        }

        // Колонки
        if (dataToSave.dispensers) {
          dataToSave.dispensers.forEach((dispenser) => {
            if (dispenser.equipmentId && dispenser.detachmentDate) {
              equipmentUpdates.push(
                updateEquipmentMovementHistory(
                  dispenser.equipmentId,
                  "dispensers",
                  { id: stationId, stationName: dataToSave.stationName },
                  dispenser.attachmentDate,
                  dispenser.detachmentDate
                )
              );
            } else if (dispenser.equipmentId && dispenser.attachmentDate) {
              equipmentUpdates.push(
                updateEquipmentMovementHistory(
                  dispenser.equipmentId,
                  "dispensers",
                  { id: stationId, stationName: dataToSave.stationName },
                  dispenser.attachmentDate
                )
              );
            }
          });
        }

        // Осушки
        if (dataToSave.dryers) {
          dataToSave.dryers.forEach((dryer) => {
            if (dryer.equipmentId && dryer.detachmentDate) {
              equipmentUpdates.push(
                updateEquipmentMovementHistory(
                  dryer.equipmentId,
                  "gasDryers",
                  { id: stationId, stationName: dataToSave.stationName },
                  dryer.attachmentDate,
                  dryer.detachmentDate
                )
              );
            } else if (dryer.equipmentId && dryer.attachmentDate) {
              equipmentUpdates.push(
                updateEquipmentMovementHistory(
                  dryer.equipmentId,
                  "gasDryers",
                  { id: stationId, stationName: dataToSave.stationName },
                  dryer.attachmentDate
                )
              );
            }
          });
        }

        // Чиллеры
        if (dataToSave.chillers) {
          dataToSave.chillers.forEach((chiller) => {
            if (chiller.equipmentId && chiller.detachmentDate) {
              equipmentUpdates.push(
                updateEquipmentMovementHistory(
                  chiller.equipmentId,
                  "gasChillers",
                  { id: stationId, stationName: dataToSave.stationName },
                  chiller.attachmentDate,
                  chiller.detachmentDate
                )
              );
            } else if (chiller.equipmentId && chiller.attachmentDate) {
              equipmentUpdates.push(
                updateEquipmentMovementHistory(
                  chiller.equipmentId,
                  "gasChillers",
                  { id: stationId, stationName: dataToSave.stationName },
                  chiller.attachmentDate
                )
              );
            }
          });
        }

        await updateDoc(doc(db, "stations", stationId), {
          ...dataToSave,
          updatedAt: new Date(),
        });

        await Promise.all(equipmentUpdates);
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
        transition={{ duration: 0 }}>
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
              placeholder="Поиск по названию станции, организации, адресу или сотрудникам..."
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
                  Организация
                </th>
                <th className="px-4 py-4 text-left font-semibold">
                  Номер станции
                </th>
                <th className="px-4 py-4 text-left font-semibold">
                  Название станции
                </th>

                <th className="px-4 py-4 text-left font-semibold">Адрес</th>
                <th className="px-4 py-4 text-left font-semibold hidden lg:table-cell">
                  Штаты
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
                    <div className="flex items-center gap-2">
                      <MapPin className="text-red-500" size={16} />
                      <span className="text-sm">
                        {station.address?.street}, {station.address?.house}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-gray-600 hidden lg:table-cell">
                    <div className="flex items-center gap-2">
                      <Briefcase className="text-blue-500" size={16} />
                      <span>{station.positions?.length || 0} шт.</span>
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

      {/* Модальное окно станции */}
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

                  {/* Штаты/Должности */}
                  <div className="border-t pt-6">
                    <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-800 mb-4">
                      <Briefcase size={18} />
                      Штаты станции
                    </h3>

                    {(isCreating || isEditMode) && (
                      <div className="mb-4">
                        <button
                          type="button"
                          onClick={addPosition}
                          className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors">
                          <Plus size={16} />
                          Добавить должность
                        </button>
                      </div>
                    )}

                    {(
                      getNestedValue(
                        isCreating ? newStation : selectedStation,
                        "positions"
                      ) || []
                    ).length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse border border-gray-200 rounded-lg">
                          <thead>
                            <tr className="bg-gray-50">
                              <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-gray-700">
                                Должность
                              </th>
                              <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-gray-700">
                                Описание
                              </th>
                              <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-gray-700">
                                Требования
                              </th>
                              <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-gray-700">
                                Обязанности
                              </th>
                              <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-gray-700">
                                Зарплата
                              </th>
                              <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-gray-700">
                                Тип
                              </th>
                              {(isCreating || isEditMode) && (
                                <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-gray-700">
                                  Действия
                                </th>
                              )}
                            </tr>
                          </thead>
                          <tbody>
                            {(
                              getNestedValue(
                                isCreating ? newStation : selectedStation,
                                "positions"
                              ) || []
                            ).map((position, index) => (
                              <tr key={index} className="hover:bg-gray-50">
                                <td className="border border-gray-200 px-4 py-3">
                                  {isCreating || isEditMode ? (
                                    <select
                                      value={position.jobTitleId || ""}
                                      onChange={(e) =>
                                        handlePositionChange(
                                          index,
                                          e.target.value
                                        )
                                      }
                                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent">
                                      <option value="">
                                        Выберите должность
                                      </option>
                                      {jobTitles.map((job) => (
                                        <option key={job.id} value={job.id}>
                                          {job.name}
                                        </option>
                                      ))}
                                    </select>
                                  ) : (
                                    <span className="font-medium">
                                      {position.jobTitleName}
                                    </span>
                                  )}
                                </td>
                                <td className="border border-gray-200 px-4 py-3">
                                  <div className="max-w-xs">
                                    {position.description || "-"}
                                  </div>
                                </td>
                                <td className="border border-gray-200 px-4 py-3">
                                  <div className="max-w-xs">
                                    {position.requirements || "-"}
                                  </div>
                                </td>
                                <td className="border border-gray-200 px-4 py-3">
                                  <div className="max-w-xs">
                                    {position.responsibilities || "-"}
                                  </div>
                                </td>
                                <td className="border border-gray-200 px-4 py-3">
                                  {position.salaryRange || "-"}
                                </td>
                                <td className="border border-gray-200 px-4 py-3">
                                  {position.type || "-"}
                                </td>
                                {(isCreating || isEditMode) && (
                                  <td className="border border-gray-200 px-4 py-3">
                                    <button
                                      type="button"
                                      onClick={() => removePosition(index)}
                                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                      <Trash2 size={16} />
                                    </button>
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <Briefcase
                          className="mx-auto mb-2 text-gray-400"
                          size={32}
                        />
                        <p>Должности не добавлены</p>
                      </div>
                    )}
                  </div>

                  {/* Персонал - только руководитель */}
                  <div className="border-t pt-6">
                    <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-800 mb-4">
                      <Users size={18} />
                      Руководитель станции
                    </h3>

                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse border border-gray-200 rounded-lg">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-gray-700">
                              Должность *
                            </th>
                            <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-gray-700">
                              Сотрудник *
                            </th>
                            <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-gray-700">
                              ПИНФЛ
                            </th>
                            <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-gray-700">
                              Паспорт
                            </th>
                            <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-gray-700">
                              Дата рождения
                            </th>
                            <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-gray-700">
                              Телефон
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {(
                            getNestedValue(
                              isCreating ? newStation : selectedStation,
                              "staff"
                            ) || []
                          ).map((staff, index) => (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="border border-gray-200 px-4 py-3">
                                <input
                                  type="text"
                                  value={
                                    directorPosition?.name || "Руководитель"
                                  }
                                  readOnly
                                  className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700 font-medium"
                                />
                                <input
                                  type="hidden"
                                  value={
                                    staff.positionId || directorPosition?.id
                                  }
                                  onChange={(e) => {}}
                                />
                              </td>
                              <td className="border border-gray-200 px-4 py-3">
                                <select
                                  value={staff.employeeId || ""}
                                  onChange={(e) =>
                                    handleEmployeeChange(index, e.target.value)
                                  }
                                  disabled={!isCreating && !isEditMode}
                                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50">
                                  <option value="">Выберите сотрудника</option>
                                  <option
                                    value="new"
                                    className="text-green-600 font-semibold bg-green-50">
                                    + Добавить нового сотрудника
                                  </option>
                                  {employees.map((employee) => (
                                    <option
                                      key={employee.id}
                                      value={employee.id}>
                                      {employee.fullName}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="border border-gray-200 px-4 py-3">
                                <input
                                  type="text"
                                  value={staff.pinfl || ""}
                                  readOnly
                                  className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500"
                                />
                              </td>
                              <td className="border border-gray-200 px-4 py-3">
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    value={staff.passportSeries || ""}
                                    readOnly
                                    className="w-16 px-2 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 text-center"
                                    placeholder="AA"
                                  />
                                  <input
                                    type="text"
                                    value={staff.passportNumber || ""}
                                    readOnly
                                    className="flex-1 px-2 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500"
                                    placeholder="1234567"
                                  />
                                </div>
                              </td>
                              <td className="border border-gray-200 px-4 py-3">
                                <input
                                  type="text"
                                  value={staff.birthDate || ""}
                                  readOnly
                                  className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500"
                                />
                              </td>
                              <td className="border border-gray-200 px-4 py-3">
                                <input
                                  type="text"
                                  value={staff.phone || ""}
                                  readOnly
                                  className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Оборудование станции */}
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
                          className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-4 p-4 border border-gray-200 rounded-xl">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Модель компрессора *
                            </label>
                            <select
                              value={compressor.equipmentId || ""}
                              onChange={(e) => {
                                if (e.target.value === "") {
                                  handleEquipmentReset("compressors", index);
                                } else {
                                  handleEquipmentSelect(
                                    "compressors",
                                    index,
                                    e.target.value,
                                    availableCompressors
                                  );
                                }
                              }}
                              disabled={!isCreating && !isEditMode}
                              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500">
                              <option value="">Выберите компрессор</option>
                              {availableCompressors.map((comp) => (
                                <option key={comp.id} value={comp.id}>
                                  {comp.brand} {comp.model} -{" "}
                                  {comp.serialNumber || "Без номера"}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Марка
                            </label>
                            <input
                              type="text"
                              value={compressor.brand || ""}
                              readOnly
                              className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-500"
                              placeholder="Автоматически заполнится"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Модель
                            </label>
                            <input
                              type="text"
                              value={compressor.modelName || ""}
                              readOnly
                              className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-500"
                              placeholder="Автоматически заполнится"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              <UserCheck className="inline w-4 h-4 mr-1 text-green-600" />
                              Дата прикрепления *
                            </label>
                            <input
                              type="date"
                              value={compressor.attachmentDate || ""}
                              onChange={(e) =>
                                updateEquipment(
                                  "compressors",
                                  index,
                                  "attachmentDate",
                                  e.target.value
                                )
                              }
                              disabled={!isCreating && !isEditMode}
                              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              <UserX className="inline w-4 h-4 mr-1 text-red-600" />
                              Дата открепления
                            </label>
                            <input
                              type="date"
                              value={compressor.detachmentDate || ""}
                              onChange={(e) =>
                                updateEquipment(
                                  "compressors",
                                  index,
                                  "detachmentDate",
                                  e.target.value
                                )
                              }
                              disabled={!isCreating && !isEditMode}
                              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500"
                            />
                          </div>

                          {(isCreating || isEditMode) && (
                            <div className="flex items-end lg:col-span-5">
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
                          className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-4 p-4 border border-gray-200 rounded-xl">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Модель колонки *
                            </label>
                            <select
                              value={dispenser.equipmentId || ""}
                              onChange={(e) => {
                                if (e.target.value === "") {
                                  handleEquipmentReset("dispensers", index);
                                } else {
                                  handleEquipmentSelect(
                                    "dispensers",
                                    index,
                                    e.target.value,
                                    availableDispensers
                                  );
                                }
                              }}
                              disabled={!isCreating && !isEditMode}
                              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500">
                              <option value="">Выберите колонку</option>
                              {availableDispensers.map((disp) => (
                                <option key={disp.id} value={disp.id}>
                                  {disp.brand} {disp.model} -{" "}
                                  {disp.serialNumber || "Без номера"}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Марка
                            </label>
                            <input
                              type="text"
                              value={dispenser.brand || ""}
                              readOnly
                              className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-500"
                              placeholder="Автоматически заполнится"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Модель
                            </label>
                            <input
                              type="text"
                              value={dispenser.modelName || ""}
                              readOnly
                              className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-500"
                              placeholder="Автоматически заполнится"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              <UserCheck className="inline w-4 h-4 mr-1 text-green-600" />
                              Дата прикрепления *
                            </label>
                            <input
                              type="date"
                              value={dispenser.attachmentDate || ""}
                              onChange={(e) =>
                                updateEquipment(
                                  "dispensers",
                                  index,
                                  "attachmentDate",
                                  e.target.value
                                )
                              }
                              disabled={!isCreating && !isEditMode}
                              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              <UserX className="inline w-4 h-4 mr-1 text-red-600" />
                              Дата открепления
                            </label>
                            <input
                              type="date"
                              value={dispenser.detachmentDate || ""}
                              onChange={(e) =>
                                updateEquipment(
                                  "dispensers",
                                  index,
                                  "detachmentDate",
                                  e.target.value
                                )
                              }
                              disabled={!isCreating && !isEditMode}
                              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500"
                            />
                          </div>

                          {(isCreating || isEditMode) && (
                            <div className="flex items-end lg:col-span-5">
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
                          className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-4 p-4 border border-gray-200 rounded-xl">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Модель осушки *
                            </label>
                            <select
                              value={dryer.equipmentId || ""}
                              onChange={(e) => {
                                if (e.target.value === "") {
                                  handleEquipmentReset("dryers", index);
                                } else {
                                  handleEquipmentSelect(
                                    "dryers",
                                    index,
                                    e.target.value,
                                    availableGasDryers
                                  );
                                }
                              }}
                              disabled={!isCreating && !isEditMode}
                              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500">
                              <option value="">Выберите осушку</option>
                              {availableGasDryers.map((dry) => (
                                <option key={dry.id} value={dry.id}>
                                  {dry.brand} {dry.model} -{" "}
                                  {dry.serialNumber || "Без номера"}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Марка
                            </label>
                            <input
                              type="text"
                              value={dryer.brand || ""}
                              readOnly
                              className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-500"
                              placeholder="Автоматически заполнится"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Модель
                            </label>
                            <input
                              type="text"
                              value={dryer.modelName || ""}
                              readOnly
                              className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-500"
                              placeholder="Автоматически заполнится"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              <UserCheck className="inline w-4 h-4 mr-1 text-green-600" />
                              Дата прикрепления *
                            </label>
                            <input
                              type="date"
                              value={dryer.attachmentDate || ""}
                              onChange={(e) =>
                                updateEquipment(
                                  "dryers",
                                  index,
                                  "attachmentDate",
                                  e.target.value
                                )
                              }
                              disabled={!isCreating && !isEditMode}
                              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              <UserX className="inline w-4 h-4 mr-1 text-red-600" />
                              Дата открепления
                            </label>
                            <input
                              type="date"
                              value={dryer.detachmentDate || ""}
                              onChange={(e) =>
                                updateEquipment(
                                  "dryers",
                                  index,
                                  "detachmentDate",
                                  e.target.value
                                )
                              }
                              disabled={!isCreating && !isEditMode}
                              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500"
                            />
                          </div>

                          {(isCreating || isEditMode) && (
                            <div className="flex items-end lg:col-span-5">
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
                          className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-4 p-4 border border-gray-200 rounded-xl">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Модель чиллера *
                            </label>
                            <select
                              value={chiller.equipmentId || ""}
                              onChange={(e) => {
                                if (e.target.value === "") {
                                  handleEquipmentReset("chillers", index);
                                } else {
                                  handleEquipmentSelect(
                                    "chillers",
                                    index,
                                    e.target.value,
                                    availableGasChillers
                                  );
                                }
                              }}
                              disabled={!isCreating && !isEditMode}
                              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500">
                              <option value="">Выберите чиллер</option>
                              {availableGasChillers.map((chill) => (
                                <option key={chill.id} value={chill.id}>
                                  {chill.brand} {chill.model} -{" "}
                                  {chill.serialNumber || "Без номера"}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Марка
                            </label>
                            <input
                              type="text"
                              value={chiller.brand || ""}
                              readOnly
                              className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-500"
                              placeholder="Автоматически заполнится"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Модель
                            </label>
                            <input
                              type="text"
                              value={chiller.modelName || ""}
                              readOnly
                              className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-500"
                              placeholder="Автоматически заполнится"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              <UserCheck className="inline w-4 h-4 mr-1 text-green-600" />
                              Дата прикрепления *
                            </label>
                            <input
                              type="date"
                              value={chiller.attachmentDate || ""}
                              onChange={(e) =>
                                updateEquipment(
                                  "chillers",
                                  index,
                                  "attachmentDate",
                                  e.target.value
                                )
                              }
                              disabled={!isCreating && !isEditMode}
                              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              <UserX className="inline w-4 h-4 mr-1 text-red-600" />
                              Дата открепления
                            </label>
                            <input
                              type="date"
                              value={chiller.detachmentDate || ""}
                              onChange={(e) =>
                                updateEquipment(
                                  "chillers",
                                  index,
                                  "detachmentDate",
                                  e.target.value
                                )
                              }
                              disabled={!isCreating && !isEditMode}
                              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500"
                            />
                          </div>

                          {(isCreating || isEditMode) && (
                            <div className="flex items-end lg:col-span-5">
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

      {/* Модальное окно добавления сотрудника */}
      <AnimatePresence>
        {isEmployeeModalOpen && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center p-4 z-[100] overflow-y-auto py-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}>
            <motion.div
              className="bg-white rounded-2xl shadow-xl w-full max-w-md my-auto"
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}>
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6 rounded-t-2xl sticky top-0 z-10">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-bold">Добавление сотрудника</h2>
                  <motion.button
                    onClick={() => setIsEmployeeModalOpen(false)}
                    className="w-8 h-8 rounded-full bg-white bg-opacity-20 flex items-center justify-center hover:bg-opacity-30 transition-all"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}>
                    <X size={18} />
                  </motion.button>
                </div>
              </div>

              <div className="max-h-[calc(100vh-200px)] overflow-y-auto">
                <div className="p-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        ФИО *
                      </label>
                      <input
                        type="text"
                        value={newEmployee.fullName}
                        onChange={(e) =>
                          setNewEmployee({
                            ...newEmployee,
                            fullName: e.target.value,
                          })
                        }
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Введите ФИО сотрудника"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Адрес
                      </label>
                      <input
                        type="text"
                        value={newEmployee.address}
                        onChange={(e) =>
                          setNewEmployee({
                            ...newEmployee,
                            address: e.target.value,
                          })
                        }
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Введите адрес сотрудника"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Серия паспорта
                        </label>
                        <input
                          type="text"
                          value={newEmployee.passportSeries}
                          onChange={(e) =>
                            setNewEmployee({
                              ...newEmployee,
                              passportSeries: e.target.value
                                .toUpperCase()
                                .replace(/[^A-ZА-Я]/g, ""),
                            })
                          }
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="AA"
                          maxLength={2}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Номер паспорта
                        </label>
                        <input
                          type="text"
                          value={newEmployee.passportNumber}
                          onChange={(e) =>
                            setNewEmployee({
                              ...newEmployee,
                              passportNumber: e.target.value.replace(/\D/g, ""),
                            })
                          }
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="1234567"
                          maxLength={7}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        ПИНФЛ
                      </label>
                      <input
                        type="text"
                        value={newEmployee.pinfl}
                        onChange={(e) => handlePinflChange(e.target.value)}
                        className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                          pinflError
                            ? "border-red-500 bg-red-50"
                            : "border-gray-200"
                        }`}
                        placeholder="14 цифр"
                        maxLength={14}
                      />
                      {pinflError && (
                        <p className="text-red-500 text-sm mt-1">
                          {pinflError}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Дата рождения
                      </label>
                      <input
                        type="date"
                        value={newEmployee.birthDate}
                        onChange={(e) =>
                          setNewEmployee({
                            ...newEmployee,
                            birthDate: e.target.value,
                          })
                        }
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Телефон
                      </label>
                      <input
                        type="tel"
                        value={newEmployee.phone}
                        onChange={(e) =>
                          setNewEmployee({
                            ...newEmployee,
                            phone: e.target.value,
                          })
                        }
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="+998 XX XXX-XX-XX"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 mt-6 pt-4 border-t border-gray-200">
                    <button
                      onClick={() => {
                        setIsEmployeeModalOpen(false);
                        setPinflError(""); // Сбрасываем ошибку при отмене
                      }}
                      className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-100 transition-colors">
                      Отмена
                    </button>
                    <button
                      onClick={handleCreateEmployee}
                      disabled={!newEmployee.fullName.trim() || pinflError}
                      className={`flex-1 px-4 py-3 rounded-xl font-semibold text-white transition-colors ${
                        newEmployee.fullName.trim() && !pinflError
                          ? "bg-blue-500 hover:bg-blue-600"
                          : "bg-gray-300 cursor-not-allowed"
                      }`}>
                      Добавить
                    </button>
                  </div>
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
