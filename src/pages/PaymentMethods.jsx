import React, { useState, useEffect } from "react";
import {
  Container,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  IconButton,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Alert,
  Snackbar,
  Chip,
  Tooltip,
  CircularProgress,
  Fade,
  Slide,
  Grow,
  Zoom,
  Switch,
  FormControlLabel,
  Divider,
  InputAdornment,
} from "@mui/material";
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  AccountBalanceWallet as WalletIcon,
  Payment as PaymentIcon,
  MonetizationOn as MoneyIcon,
  CreditCard as CreditCardIcon,
  Close as CloseIcon,
  Save as SaveIcon,
  CalendarToday as CalendarIcon,
  Description as DescriptionIcon,
  Visibility as VisibilityIcon,
  Storage as StorageIcon,
  Info as InfoIcon,
} from "@mui/icons-material";
import { motion, AnimatePresence } from "framer-motion";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "../firebase/config";

// Анимации
const pageVariants = {
  initial: { opacity: 0, y: 20 },
  in: { opacity: 1, y: 0 },
  out: { opacity: 0, y: -20 },
};

const cardVariants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: { opacity: 1, scale: 1 },
};

const tableRowVariants = {
  hidden: { opacity: 0, x: -50 },
  visible: (custom) => ({
    opacity: 1,
    x: 0,
    transition: { delay: custom * 0.1 },
  }),
};

const modalVariants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.8 },
};

// Массив названий месяцев на русском
const monthNames = [
  "январ",
  "феврал",
  "март",
  "апрел",
  "май",
  "июн",
  "июл",
  "август",
  "сентябр",
  "октябр",
  "ноябр",
  "декабр",
];

export default function PaymentMethods() {
  const [paymentTypes, setPaymentTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openCreateModal, setOpenCreateModal] = useState(false);
  const [openViewModal, setOpenViewModal] = useState(false);
  const [openEditModal, setOpenEditModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });
  const [formData, setFormData] = useState({
    name: "",
    dbFieldName: "",
    description: "",
    isActive: 1,
  });
  const [editFormData, setEditFormData] = useState({
    name: "",
    dbFieldName: "",
    description: "",
    isActive: 1,
  });
  const [searchQuery, setSearchQuery] = useState("");

  // Цвета для чипов
  const chipColors = [
    { bg: "#4f46e5", text: "#ffffff" },
    { bg: "#0ea5e9", text: "#ffffff" },
    { bg: "#10b981", text: "#ffffff" },
    { bg: "#f59e0b", text: "#ffffff" },
    { bg: "#ef4444", text: "#ffffff" },
    { bg: "#8b5cf6", text: "#ffffff" },
  ];

  // Загрузка данных
  useEffect(() => {
    fetchPaymentTypes();
  }, []);

  const fetchPaymentTypes = async () => {
    try {
      setLoading(true);
      const q = query(
        collection(db, "paymentMethods"),
        orderBy("createdAt", "desc")
      );
      const querySnapshot = await getDocs(q);
      const types = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || null,
      }));
      setPaymentTypes(types);
    } catch (error) {
      console.error("Error fetching payment types:", error);
      showSnackbar("Маълумотлар юкланишида хатолик", "error");
    } finally {
      setLoading(false);
    }
  };

  // Функция форматирования даты без date-fns
  const formatDate = (date) => {
    if (!date || !(date instanceof Date)) {
      return "—";
    }

    const day = date.getDate().toString().padStart(2, "0");
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");

    return `${day} ${month} ${year}, ${hours}:${minutes}`;
  };

  // Открытие модального окна создания
  const handleOpenCreateModal = () => {
    setFormData({
      name: "",
      dbFieldName: "",
      description: "",
      isActive: 1,
    });
    setOpenCreateModal(true);
  };

  // Закрытие модального окна создания
  const handleCloseCreateModal = () => {
    setOpenCreateModal(false);
  };

  // Открытие модального окна просмотра
  const handleOpenViewModal = (payment) => {
    setSelectedPayment(payment);
    setOpenViewModal(true);
  };

  // Закрытие модального окна просмотра
  const handleCloseViewModal = () => {
    setOpenViewModal(false);
    setSelectedPayment(null);
  };

  // Открытие модального окна редактирования
  const handleOpenEditModal = (payment) => {
    setSelectedPayment(payment);
    setEditFormData({
      name: payment.name,
      dbFieldName: payment.dbFieldName || "",
      description: payment.description || "",
      isActive: payment.isActive || 1,
    });
    setOpenViewModal(false);
    setOpenEditModal(true);
  };

  // Закрытие модального окна редактирования
  const handleCloseEditModal = () => {
    setOpenEditModal(false);
    setSelectedPayment(null);
  };

  // Обработка формы создания
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? (checked ? 1 : 0) : value,
    }));
  };

  // Обработка формы редактирования
  const handleEditInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEditFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? (checked ? 1 : 0) : value,
    }));
  };

  // Генерация названия поля в базе из имени
  const generateDbFieldName = (name) => {
    if (!name) return "";
    return name
      .toLowerCase()
      .replace(/[^a-zа-яё0-9\s]/g, "") // Удаляем спецсимволы, оставляем буквы, цифры и пробелы
      .replace(/\s+/g, "_") // Заменяем пробелы на подчеркивания
      .replace(/[а-яё]/g, (char) => {
        // Транслитерация кириллицы в латиницу
        const ru = "абвгдеёжзийклмнопрстуфхцчшщъыьэюя";
        const en = "abvgdeejzijklmnoprstufhzcss_y_eua";
        const index = ru.indexOf(char);
        return index >= 0 ? en[index] : char;
      })
      .slice(0, 50); // Ограничиваем длину
  };

  // Сохранение нового типа платежа
  const handleCreateSubmit = async () => {
    if (!formData.name.trim()) {
      showSnackbar("Номи мажбурий", "error");
      return;
    }

    if (!formData.dbFieldName.trim()) {
      showSnackbar("Названия документа в базе мажбурий", "error");
      return;
    }

    try {
      const paymentData = {
        ...formData,
        name: formData.name.trim(),
        dbFieldName: formData.dbFieldName.trim().toLowerCase(),
        description: formData.description.trim(),
        isActive: formData.isActive,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await addDoc(collection(db, "paymentMethods"), paymentData);
      showSnackbar("Тулов тури мувафакиятли яратилди", "success");
      handleCloseCreateModal();
      fetchPaymentTypes();
    } catch (error) {
      console.error("Error creating payment type:", error);
      showSnackbar("Яратилишида хатолик", "error");
    }
  };

  // Сохранение изменений типа платежа
  const handleEditSubmit = async () => {
    if (!editFormData.name.trim()) {
      showSnackbar("Номи мажбурий", "error");
      return;
    }

    if (!editFormData.dbFieldName.trim()) {
      showSnackbar("Названия документа в базе мажбурий", "error");
      return;
    }

    try {
      const paymentData = {
        ...editFormData,
        name: editFormData.name.trim(),
        dbFieldName: editFormData.dbFieldName.trim().toLowerCase(),
        description: editFormData.description.trim(),
        updatedAt: new Date(),
      };

      await updateDoc(
        doc(db, "paymentMethods", selectedPayment.id),
        paymentData
      );
      showSnackbar("Тулов тури мувафакиятли янгиланди", "success");
      handleCloseEditModal();
      fetchPaymentTypes();
    } catch (error) {
      console.error("Error updating payment type:", error);
      showSnackbar("Янгиланишида хатолик", "error");
    }
  };

  // Удаление типа платежа
  const handleDelete = async (id, event) => {
    event.stopPropagation();

    if (!window.confirm("Ушбу тулов турини учиришга аминмисиз?")) {
      return;
    }

    try {
      await deleteDoc(doc(db, "paymentMethods", id));
      showSnackbar("Тулов тури учирилди", "success");
      fetchPaymentTypes();
    } catch (error) {
      console.error("Error deleting payment type:", error);
      showSnackbar("Учиришда хатолик", "error");
    }
  };

  // Вспомогательные функции
  const showSnackbar = (message, severity) => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  const filteredPaymentTypes = paymentTypes.filter(
    (payment) =>
      payment.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (payment.description &&
        payment.description
          .toLowerCase()
          .includes(searchQuery.toLowerCase())) ||
      (payment.dbFieldName &&
        payment.dbFieldName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Получение иконки для типа платежа
  const getPaymentIcon = (name) => {
    const lowerName = name.toLowerCase();
    if (lowerName.includes("карт")) return <CreditCardIcon />;
    if (lowerName.includes("нал")) return <MoneyIcon />;
    if (lowerName.includes("электр") || lowerName.includes("online"))
      return <PaymentIcon />;
    return <WalletIcon />;
  };

  // Получение цвета для чипа
  const getChipColor = (index) => {
    return chipColors[index % chipColors.length];
  };

  return (
    <motion.div
      initial="initial"
      animate="in"
      exit="out"
      variants={pageVariants}
      transition={{ duration: 0.5 }}
    >
      <Container maxWidth="xl" sx={{ py: 4 }}>
        {/* Заголовок */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Box
            sx={{
              mb: 4,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Box>
              <Typography
                variant="h4"
                sx={{
                  fontWeight: 700,
                  background:
                    "linear-gradient(45deg, #4f46e5 30%, #7c3aed 90%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  mb: 1,
                }}
              >
                ТУЛОВ ТУРЛАРИ
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Тизимда тулов турларини бошкариш
              </Typography>
            </Box>

            {/* Кнопка добавления */}
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleOpenCreateModal}
                sx={{
                  background:
                    "linear-gradient(45deg, #ef4444 30%, #f97316 90%)",
                  color: "white",
                  borderRadius: "12px",
                  px: 3,
                  py: 1.5,
                  fontWeight: 600,
                  textTransform: "none",
                  fontSize: "16px",
                  boxShadow: "0 8px 25px rgba(239, 68, 68, 0.3)",
                  "&:hover": {
                    background:
                      "linear-gradient(45deg, #dc2626 30%, #ea580c 90%)",
                    boxShadow: "0 12px 30px rgba(239, 68, 68, 0.4)",
                  },
                }}
              >
                Янги тулов турини кушиш
              </Button>
            </motion.div>
          </Box>
        </motion.div>

        {/* Карточка с поиском */}
        <motion.div
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          transition={{ delay: 0.3 }}
        >
          <Paper
            elevation={0}
            sx={{
              p: 3,
              mb: 4,
              borderRadius: "16px",
              background: "linear-gradient(145deg, #f8fafc 0%, #f1f5f9 100%)",
              border: "1px solid #e2e8f0",
              boxShadow: "0 4px 20px rgba(0,0,0,0.05)",
            }}
          >
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                mb: 2,
              }}
            >
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Барча тулов турлари ({paymentTypes.length})
              </Typography>

              <TextField
                placeholder="Номи, тавсифи ёки база номи буйича кидириш..."
                variant="outlined"
                size="small"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                sx={{
                  width: 300,
                  "& .MuiOutlinedInput-root": {
                    borderRadius: "10px",
                    "&:hover .MuiOutlinedInput-notchedOutline": {
                      borderColor: "#4f46e5",
                    },
                  },
                }}
              />
            </Box>
          </Paper>
        </motion.div>

        {/* Таблица */}
        <AnimatePresence>
          {loading ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                minHeight: "400px",
              }}
            >
              <CircularProgress size={60} sx={{ color: "#4f46e5" }} />
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              <TableContainer
                component={Paper}
                elevation={0}
                sx={{
                  borderRadius: "16px",
                  overflow: "hidden",
                  border: "1px solid #e2e8f0",
                  background: "white",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.05)",
                }}
              >
                <Table>
                  <TableHead>
                    <TableRow
                      sx={{
                        background:
                          "linear-gradient(90deg, #f8fafc 0%, #f1f5f9 100%)",
                      }}
                    >
                      <TableCell
                        sx={{ fontWeight: 700, color: "#475569", py: 2 }}
                      >
                        Иконка
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700, color: "#475569" }}>
                        Номи
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700, color: "#475569" }}>
                        Базадаги номи
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700, color: "#475569" }}>
                        Тавсифи
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700, color: "#475569" }}>
                        Холати
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700, color: "#475569" }}>
                        Яратилган санаси
                      </TableCell>
                      <TableCell
                        sx={{
                          fontWeight: 700,
                          color: "#475569",
                          textAlign: "center",
                        }}
                      >
                        Харакат
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <AnimatePresence>
                      {filteredPaymentTypes.map((payment, index) => (
                        <motion.tr
                          key={payment.id}
                          custom={index}
                          variants={tableRowVariants}
                          initial="hidden"
                          animate="visible"
                          exit={{ opacity: 0, x: 50 }}
                          whileHover={{
                            backgroundColor: "#f8fafc",
                            transition: { duration: 0.2 },
                            cursor: "pointer",
                          }}
                          onClick={() => handleOpenViewModal(payment)}
                        >
                          <TableCell sx={{ py: 2 }}>
                            <Zoom
                              in={true}
                              style={{ transitionDelay: `${index * 50}ms` }}
                            >
                              <Box
                                sx={{
                                  width: 40,
                                  height: 40,
                                  borderRadius: "10px",
                                  background: `linear-gradient(135deg, ${
                                    getChipColor(index).bg
                                  }20, ${getChipColor(index).bg}40)`,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  color: getChipColor(index).bg,
                                }}
                              >
                                {getPaymentIcon(payment.name)}
                              </Box>
                            </Zoom>
                          </TableCell>
                          <TableCell>
                            <Typography
                              variant="body1"
                              sx={{ fontWeight: 600 }}
                            >
                              {payment.name}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Tooltip title="Базадаги номи">
                              <Chip
                                icon={<StorageIcon fontSize="small" />}
                                label={payment.dbFieldName || "—"}
                                size="small"
                                sx={{
                                  background:
                                    "linear-gradient(45deg, #6b728020, #6b728040)",
                                  color: "#6b7280",
                                  fontWeight: 600,
                                  maxWidth: 150,
                                  "& .MuiChip-label": {
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                  },
                                }}
                              />
                            </Tooltip>
                          </TableCell>
                          <TableCell>
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{ maxWidth: 300 }}
                            >
                              {payment.description || "—"}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              icon={
                                payment.isActive === 1 ? (
                                  <CheckCircleIcon />
                                ) : (
                                  <ErrorIcon />
                                )
                              }
                              label={
                                payment.isActive === 1 ? "Фаол" : "Фаол эмас"
                              }
                              sx={{
                                background:
                                  payment.isActive === 1
                                    ? "linear-gradient(45deg, #10b98120, #10b98140)"
                                    : "linear-gradient(45deg, #ef444420, #ef444440)",
                                color:
                                  payment.isActive === 1
                                    ? "#10b981"
                                    : "#ef4444",
                                fontWeight: 600,
                                border: `1px solid ${
                                  payment.isActive === 1 ? "#10b981" : "#ef4444"
                                }20`,
                              }}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" color="text.secondary">
                              {formatDate(payment.createdAt)}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Box
                              sx={{
                                display: "flex",
                                gap: 1,
                                justifyContent: "center",
                              }}
                            >
                              <Tooltip title="Тахрирлаш">
                                <motion.div
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                >
                                  <IconButton
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenEditModal(payment);
                                    }}
                                    sx={{
                                      background:
                                        "linear-gradient(45deg, #3b82f620, #3b82f640)",
                                      color: "#3b82f6",
                                      "&:hover": { background: "#3b82f630" },
                                    }}
                                  >
                                    <EditIcon fontSize="small" />
                                  </IconButton>
                                </motion.div>
                              </Tooltip>

                              {/* <Tooltip title="Удалить">
                                <motion.div
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                >
                                  <IconButton
                                    onClick={(e) => handleDelete(payment.id, e)}
                                    sx={{
                                      background:
                                        "linear-gradient(45deg, #ef444420, #ef444440)",
                                      color: "#ef4444",
                                      "&:hover": { background: "#ef444430" },
                                    }}
                                  >
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                </motion.div>
                              </Tooltip> */}
                            </Box>
                          </TableCell>
                        </motion.tr>
                      ))}
                    </AnimatePresence>

                    {filteredPaymentTypes.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          sx={{ py: 6, textAlign: "center" }}
                        >
                          <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.5 }}
                          >
                            <WalletIcon
                              sx={{ fontSize: 80, color: "#cbd5e1", mb: 2 }}
                            />
                            <Typography
                              variant="h6"
                              color="text.secondary"
                              sx={{ mb: 1 }}
                            >
                              Тулов турлари топилмади
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {searchQuery
                                ? "Бошка кидириб куринг"
                                : "Янги тулов турини кушинг"}
                            </Typography>
                          </motion.div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Модальное окно создания */}
        <Dialog
          open={openCreateModal}
          onClose={handleCloseCreateModal}
          maxWidth="sm"
          fullWidth
          TransitionComponent={Fade}
          PaperProps={{
            sx: {
              borderRadius: "16px",
              overflow: "hidden",
              background: "linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)",
            },
          }}
        >
          <motion.div
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <DialogTitle
              sx={{
                background: "linear-gradient(90deg, #4f46e5 0%, #7c3aed 100%)",
                color: "white",
                py: 3,
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <WalletIcon />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Янги тулов турини кушиш
                </Typography>
              </Box>
            </DialogTitle>

            <DialogContent
              sx={{
                py: 4,
                maxHeight: "70vh",
                overflowY: "auto",
                "&::-webkit-scrollbar": {
                  width: "8px",
                },
                "&::-webkit-scrollbar-track": {
                  background: "#f1f1f1",
                  borderRadius: "4px",
                },
                "&::-webkit-scrollbar-thumb": {
                  background: "#888",
                  borderRadius: "4px",
                },
                "&::-webkit-scrollbar-thumb:hover": {
                  background: "#555",
                },
              }}
            >
              <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {/* Название */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <TextField
                    fullWidth
                    label="Тулов тури номи"
                    name="name"
                    value={formData.name}
                    onChange={(e) => {
                      handleInputChange(e);
                      // Автогенерация названия поля в базе
                      if (!formData.dbFieldName) {
                        const generatedName = generateDbFieldName(
                          e.target.value
                        );
                        setFormData((prev) => ({
                          ...prev,
                          dbFieldName: generatedName,
                        }));
                      }
                    }}
                    required
                    variant="outlined"
                    sx={{
                      "& .MuiOutlinedInput-root": {
                        borderRadius: "10px",
                        "&:hover .MuiOutlinedInput-notchedOutline": {
                          borderColor: "#4f46e5",
                        },
                      },
                    }}
                    InputProps={{
                      startAdornment: (
                        <PaymentIcon sx={{ mr: 1, color: "#4f46e5" }} />
                      ),
                    }}
                  />
                </motion.div>

                {/* Название в базе данных */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 }}
                >
                  <TextField
                    fullWidth
                    label="Названия документа в базе"
                    name="dbFieldName"
                    value={formData.dbFieldName}
                    onChange={handleInputChange}
                    required
                    variant="outlined"
                    helperText="Базада сакланадиган калит сўз (фақат кичик ҳарфлар, рақамлар ва '_')"
                    sx={{
                      "& .MuiOutlinedInput-root": {
                        borderRadius: "10px",
                        "&:hover .MuiOutlinedInput-notchedOutline": {
                          borderColor: "#4f46e5",
                        },
                      },
                    }}
                    InputProps={{
                      startAdornment: (
                        <StorageIcon sx={{ mr: 1, color: "#4f46e5" }} />
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <Tooltip title="Автогенерация">
                            <IconButton
                              size="small"
                              onClick={() => {
                                const generatedName = generateDbFieldName(
                                  formData.name
                                );
                                setFormData((prev) => ({
                                  ...prev,
                                  dbFieldName: generatedName,
                                }));
                              }}
                              sx={{ color: "#4f46e5" }}
                            >
                              <AddIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </InputAdornment>
                      ),
                    }}
                  />
                </motion.div>

                {/* Описание */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <TextField
                    fullWidth
                    label="Тавсифи (зарур эмас)"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    multiline
                    rows={3}
                    variant="outlined"
                    sx={{
                      "& .MuiOutlinedInput-root": {
                        borderRadius: "10px",
                        "&:hover .MuiOutlinedInput-notchedOutline": {
                          borderColor: "#4f46e5",
                        },
                      },
                    }}
                  />
                </motion.div>

                {/* Ползунок активен/неактивен */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2,
                      borderRadius: "12px",
                      background:
                        "linear-gradient(145deg, #f8fafc 0%, #f1f5f9 100%)",
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <Box
                        sx={{ display: "flex", alignItems: "center", gap: 2 }}
                      >
                        {formData.isActive === 1 ? (
                          <CheckCircleIcon sx={{ color: "#10b981" }} />
                        ) : (
                          <ErrorIcon sx={{ color: "#ef4444" }} />
                        )}
                        <Box>
                          <Typography variant="body1" sx={{ fontWeight: 600 }}>
                            Статус
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {formData.isActive === 1
                              ? "Фаол тулов тури"
                              : "Тулов тури фаол эмас"}
                          </Typography>
                        </Box>
                      </Box>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={formData.isActive === 1}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                isActive: e.target.checked ? 1 : 0,
                              }))
                            }
                            color="primary"
                            sx={{
                              "& .MuiSwitch-switchBase.Mui-checked": {
                                color: "#10b981",
                              },
                              "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track":
                                {
                                  backgroundColor: "#10b981",
                                },
                            }}
                          />
                        }
                        label={formData.isActive === 1 ? "Фаол" : "Фаол эмас"}
                        labelPlacement="start"
                      />
                    </Box>
                  </Paper>
                </motion.div>
              </Box>
            </DialogContent>

            <DialogActions
              sx={{ px: 3, py: 3, borderTop: "1px solid #e2e8f0" }}
            >
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Button
                  onClick={handleCloseCreateModal}
                  variant="outlined"
                  sx={{
                    borderRadius: "10px",
                    px: 3,
                    py: 1,
                    borderColor: "#cbd5e1",
                    color: "#64748b",
                    "&:hover": {
                      borderColor: "#94a3b8",
                      backgroundColor: "#f1f5f9",
                    },
                  }}
                >
                  Отмена
                </Button>
              </motion.div>

              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Button
                  onClick={handleCreateSubmit}
                  variant="contained"
                  startIcon={<AddIcon />}
                  sx={{
                    borderRadius: "10px",
                    px: 4,
                    py: 1,
                    background:
                      "linear-gradient(45deg, #4f46e5 30%, #7c3aed 90%)",
                    color: "white",
                    fontWeight: 600,
                    "&:hover": {
                      background:
                        "linear-gradient(45deg, #4338ca 30%, #6d28d9 90%)",
                      boxShadow: "0 8px 20px rgba(79, 70, 229, 0.3)",
                    },
                  }}
                >
                  Янги тулов турини кушиш
                </Button>
              </motion.div>
            </DialogActions>
          </motion.div>
        </Dialog>

        {/* Модальное окно просмотра */}
        <Dialog
          open={openViewModal}
          onClose={handleCloseViewModal}
          maxWidth="sm"
          fullWidth
          TransitionComponent={Fade}
          PaperProps={{
            sx: {
              borderRadius: "16px",
              overflow: "hidden",
              background: "linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)",
              maxHeight: "85vh",
              display: "flex",
              flexDirection: "column",
            },
          }}
        >
          {selectedPayment && (
            <motion.div
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              style={{
                display: "flex",
                flexDirection: "column",
                height: "100%",
              }}
            >
              <DialogTitle
                sx={{
                  background:
                    "linear-gradient(90deg, #4f46e5 0%, #7c3aed 100%)",
                  color: "white",
                  py: 3,
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <WalletIcon />
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      Тулов тури маълумотлари
                    </Typography>
                  </Box>
                  <IconButton
                    onClick={handleCloseViewModal}
                    sx={{ color: "white" }}
                  >
                    <CloseIcon />
                  </IconButton>
                </Box>
              </DialogTitle>

              <DialogContent
                sx={{
                  py: 4,
                  flex: 1,
                  overflowY: "auto",
                  maxHeight: "70vh",
                  "&::-webkit-scrollbar": {
                    width: "8px",
                  },
                  "&::-webkit-scrollbar-track": {
                    background: "#f1f1f1",
                    borderRadius: "4px",
                  },
                  "&::-webkit-scrollbar-thumb": {
                    background: "#888",
                    borderRadius: "4px",
                  },
                  "&::-webkit-scrollbar-thumb:hover": {
                    background: "#555",
                  },
                }}
              >
                <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  {/* Иконка и статус */}
                  <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        mb: 2,
                      }}
                    >
                      <Box
                        sx={{
                          width: 60,
                          height: 60,
                          borderRadius: "12px",
                          background: `linear-gradient(135deg, ${
                            getChipColor(0).bg
                          }20, ${getChipColor(0).bg}40)`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: getChipColor(0).bg,
                        }}
                      >
                        {getPaymentIcon(selectedPayment.name)}
                      </Box>
                      <Chip
                        icon={
                          selectedPayment.isActive === 1 ? (
                            <CheckCircleIcon />
                          ) : (
                            <ErrorIcon />
                          )
                        }
                        label={
                          selectedPayment.isActive === 1 ? "Фаол" : "Фаол эмас"
                        }
                        sx={{
                          background:
                            selectedPayment.isActive === 1
                              ? "linear-gradient(45deg, #10b98120, #10b98140)"
                              : "linear-gradient(45deg, #ef444420, #ef444440)",
                          color:
                            selectedPayment.isActive === 1
                              ? "#10b981"
                              : "#ef4444",
                          fontWeight: 600,
                          border: `1px solid ${
                            selectedPayment.isActive === 1
                              ? "#10b981"
                              : "#ef4444"
                          }20`,
                          px: 2,
                          py: 1,
                        }}
                      />
                    </Box>
                  </motion.div>

                  <Divider />

                  {/* Название */}
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <Box>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mb: 1 }}
                      >
                        Номи
                      </Typography>
                      <Paper
                        elevation={0}
                        sx={{
                          p: 2,
                          borderRadius: "10px",
                          background: "#f8fafc",
                          border: "1px solid #e2e8f0",
                        }}
                      >
                        <Typography variant="body1" sx={{ fontWeight: 600 }}>
                          {selectedPayment.name}
                        </Typography>
                      </Paper>
                    </Box>
                  </motion.div>

                  {/* Название в базе данных */}
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.25 }}
                  >
                    <Box>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mb: 1 }}
                      >
                        <StorageIcon
                          sx={{
                            fontSize: 16,
                            mr: 1,
                            verticalAlign: "middle",
                          }}
                        />
                        Названия документа в базе
                      </Typography>
                      <Paper
                        elevation={0}
                        sx={{
                          p: 2,
                          borderRadius: "10px",
                          background: "#f8fafc",
                          border: "1px solid #e2e8f0",
                        }}
                      >
                        <Typography
                          variant="body1"
                          sx={{
                            fontWeight: 600,
                            fontFamily: "monospace",
                            color: "#6b7280",
                          }}
                        >
                          {selectedPayment.dbFieldName || "—"}
                        </Typography>
                      </Paper>
                    </Box>
                  </motion.div>

                  {/* Описание */}
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 }}
                  >
                    <Box>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mb: 1 }}
                      >
                        Тавсифи
                      </Typography>
                      <Paper
                        elevation={0}
                        sx={{
                          p: 2,
                          borderRadius: "10px",
                          background: "#f8fafc",
                          border: "1px solid #e2e8f0",
                          minHeight: 80,
                        }}
                      >
                        <Typography variant="body1">
                          {selectedPayment.description || "—"}
                        </Typography>
                      </Paper>
                    </Box>
                  </motion.div>

                  <Divider />

                  {/* Даты */}
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 }}
                  >
                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 2,
                      }}
                    >
                      <Box>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ mb: 1 }}
                        >
                          <CalendarIcon
                            sx={{
                              fontSize: 16,
                              mr: 1,
                              verticalAlign: "middle",
                            }}
                          />
                          Яратилган санаси
                        </Typography>
                        <Paper
                          elevation={0}
                          sx={{
                            p: 1.5,
                            borderRadius: "8px",
                            background: "#f8fafc",
                            border: "1px solid #e2e8f0",
                          }}
                        >
                          <Typography variant="body2">
                            {formatDate(selectedPayment.createdAt)}
                          </Typography>
                        </Paper>
                      </Box>

                      <Box>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ mb: 1 }}
                        >
                          <CalendarIcon
                            sx={{
                              fontSize: 16,
                              mr: 1,
                              verticalAlign: "middle",
                            }}
                          />
                          Сунги таҳрирланган санаси
                        </Typography>
                        <Paper
                          elevation={0}
                          sx={{
                            p: 1.5,
                            borderRadius: "8px",
                            background: "#f8fafc",
                            border: "1px solid #e2e8f0",
                          }}
                        >
                          <Typography variant="body2">
                            {selectedPayment.updatedAt
                              ? formatDate(selectedPayment.updatedAt)
                              : "—"}
                          </Typography>
                        </Paper>
                      </Box>
                    </Box>
                  </motion.div>
                </Box>
              </DialogContent>

              <DialogActions
                sx={{ px: 3, py: 3, borderTop: "1px solid #e2e8f0" }}
              >
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Button
                    onClick={handleCloseViewModal}
                    variant="outlined"
                    sx={{
                      borderRadius: "10px",
                      px: 3,
                      py: 1,
                      borderColor: "#cbd5e1",
                      color: "#64748b",
                      "&:hover": {
                        borderColor: "#94a3b8",
                        backgroundColor: "#f1f5f9",
                      },
                    }}
                  >
                    Ёпиш
                  </Button>
                </motion.div>

                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Button
                    onClick={() => handleOpenEditModal(selectedPayment)}
                    variant="contained"
                    startIcon={<EditIcon />}
                    sx={{
                      borderRadius: "10px",
                      px: 4,
                      py: 1,
                      background:
                        "linear-gradient(45deg, #3b82f6 30%, #0ea5e9 90%)",
                      color: "white",
                      fontWeight: 600,
                      "&:hover": {
                        background:
                          "linear-gradient(45deg, #2563eb 30%, #0284c7 90%)",
                        boxShadow: "0 8px 20px rgba(59, 130, 246, 0.3)",
                      },
                    }}
                  >
                    Тахрирлаш
                  </Button>
                </motion.div>
              </DialogActions>
            </motion.div>
          )}
        </Dialog>

        {/* Модальное окно редактирования */}
        <Dialog
          open={openEditModal}
          onClose={handleCloseEditModal}
          maxWidth="sm"
          fullWidth
          TransitionComponent={Fade}
          PaperProps={{
            sx: {
              borderRadius: "16px",
              overflow: "hidden",
              background: "linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)",
            },
          }}
        >
          {selectedPayment && (
            <motion.div
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <DialogTitle
                sx={{
                  background:
                    "linear-gradient(90deg, #3b82f6 0%, #0ea5e9 100%)",
                  color: "white",
                  py: 3,
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <EditIcon />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Тулов турини тахрирлаш
                  </Typography>
                </Box>
              </DialogTitle>

              <DialogContent
                sx={{
                  py: 4,
                  maxHeight: "70vh",
                  overflowY: "auto",
                  "&::-webkit-scrollbar": {
                    width: "8px",
                  },
                  "&::-webkit-scrollbar-track": {
                    background: "#f1f1f1",
                    borderRadius: "4px",
                  },
                  "&::-webkit-scrollbar-thumb": {
                    background: "#888",
                    borderRadius: "4px",
                  },
                  "&::-webkit-scrollbar-thumb:hover": {
                    background: "#555",
                  },
                }}
              >
                <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  {/* Название */}
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 }}
                  >
                    <TextField
                      fullWidth
                      label="Тулов тури номи"
                      name="name"
                      value={editFormData.name}
                      onChange={handleEditInputChange}
                      required
                      variant="outlined"
                      disabled
                      sx={{
                        "& .MuiOutlinedInput-root": {
                          borderRadius: "10px",
                          "&:hover .MuiOutlinedInput-notchedOutline": {
                            borderColor: "#3b82f6",
                          },
                        },
                      }}
                      InputProps={{
                        startAdornment: (
                          <PaymentIcon sx={{ mr: 1, color: "#3b82f6" }} />
                        ),
                      }}
                    />
                  </motion.div>

                  {/* Название в базе данных */}
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.15 }}
                  >
                    <TextField
                      fullWidth
                      label="Названия документа в базе"
                      name="dbFieldName"
                      value={editFormData.dbFieldName}
                      onChange={handleEditInputChange}
                      required
                      variant="outlined"
                      helperText="Базада сакланадиган калит сўз (фақат кичик ҳарфлар, рақамлар ва '_')"
                      sx={{
                        "& .MuiOutlinedInput-root": {
                          borderRadius: "10px",
                          "&:hover .MuiOutlinedInput-notchedOutline": {
                            borderColor: "#3b82f6",
                          },
                        },
                      }}
                      InputProps={{
                        startAdornment: (
                          <StorageIcon sx={{ mr: 1, color: "#3b82f6" }} />
                        ),
                      }}
                    />
                  </motion.div>

                  {/* Описание */}
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <TextField
                      fullWidth
                      label="Тавсифи (зарур эмас)"
                      name="description"
                      value={editFormData.description}
                      onChange={handleEditInputChange}
                      multiline
                      rows={3}
                      variant="outlined"
                      sx={{
                        "& .MuiOutlinedInput-root": {
                          borderRadius: "10px",
                          "&:hover .MuiOutlinedInput-notchedOutline": {
                            borderColor: "#3b82f6",
                          },
                        },
                      }}
                    />
                  </motion.div>

                  {/* Ползунок активен/неактивен */}
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 }}
                  >
                    <Paper
                      elevation={0}
                      sx={{
                        p: 2,
                        borderRadius: "12px",
                        background:
                          "linear-gradient(145deg, #f8fafc 0%, #f1f5f9 100%)",
                        border: "1px solid #e2e8f0",
                      }}
                    >
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <Box
                          sx={{ display: "flex", alignItems: "center", gap: 2 }}
                        >
                          {editFormData.isActive === 1 ? (
                            <CheckCircleIcon sx={{ color: "#10b981" }} />
                          ) : (
                            <ErrorIcon sx={{ color: "#ef4444" }} />
                          )}
                          <Box>
                            <Typography
                              variant="body1"
                              sx={{ fontWeight: 600 }}
                            >
                              Статус
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {editFormData.isActive === 1
                                ? "Фаол тулов тури"
                                : "Тулов тури фаол эмас"}
                            </Typography>
                          </Box>
                        </Box>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={editFormData.isActive === 1}
                              onChange={(e) =>
                                setEditFormData((prev) => ({
                                  ...prev,
                                  isActive: e.target.checked ? 1 : 0,
                                }))
                              }
                              color="primary"
                              sx={{
                                "& .MuiSwitch-switchBase.Mui-checked": {
                                  color: "#10b981",
                                },
                                "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track":
                                  {
                                    backgroundColor: "#10b981",
                                  },
                              }}
                            />
                          }
                          label={
                            editFormData.isActive === 1 ? "Фаол" : "Фаол эмас"
                          }
                          labelPlacement="start"
                        />
                      </Box>
                    </Paper>
                  </motion.div>
                </Box>
              </DialogContent>

              <DialogActions
                sx={{ px: 3, py: 3, borderTop: "1px solid #e2e8f0" }}
              >
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Button
                    onClick={handleCloseEditModal}
                    variant="outlined"
                    sx={{
                      borderRadius: "10px",
                      px: 3,
                      py: 1,
                      borderColor: "#cbd5e1",
                      color: "#64748b",
                      "&:hover": {
                        borderColor: "#94a3b8",
                        backgroundColor: "#f1f5f9",
                      },
                    }}
                  >
                    Бекор қилиш
                  </Button>
                </motion.div>

                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Button
                    onClick={handleEditSubmit}
                    variant="contained"
                    startIcon={<SaveIcon />}
                    sx={{
                      borderRadius: "10px",
                      px: 4,
                      py: 1,
                      background:
                        "linear-gradient(45deg, #10b981 30%, #34d399 90%)",
                      color: "white",
                      fontWeight: 600,
                      "&:hover": {
                        background:
                          "linear-gradient(45deg, #059669 30%, #10b981 90%)",
                        boxShadow: "0 8px 20px rgba(16, 185, 129, 0.3)",
                      },
                    }}
                  >
                    Узгаришни саклаш
                  </Button>
                </motion.div>
              </DialogActions>
            </motion.div>
          )}
        </Dialog>

        {/* Уведомления */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={4000}
          onClose={handleCloseSnackbar}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          TransitionComponent={Slide}
        >
          <Alert
            onClose={handleCloseSnackbar}
            severity={snackbar.severity}
            sx={{
              borderRadius: "10px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
              width: "100%",
            }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Container>
    </motion.div>
  );
}
