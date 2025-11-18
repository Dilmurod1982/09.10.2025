import * as React from "react";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import MenuIcon from "@mui/icons-material/Menu";
import { signOut, updatePassword } from "firebase/auth";
import { auth } from "../firebase/config";
import { toast } from "react-toastify";
import { useAppStore } from "../lib/zustand";
import { motion } from "framer-motion";
import { Paper, useMediaQuery } from "@mui/material";
import Drawer from "@mui/material/Drawer";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Divider from "@mui/material/Divider";
import { useTheme } from "@mui/material/styles";
import {
  LocalGasStation as LocalGasStationIcon,
  People as PeopleIcon,
  CorporateFare as CorporateFareIcon,
  AccountBalance as AccountBalanceIcon,
  Close as CloseIcon,
  Build as BuildIcon,
  ExpandLess,
  ExpandMore,
  SettingsInputComponent as SettingsInputComponentIcon,
  Category as CategoryIcon,
  AcUnit as CompressorIcon,
  WaterDrop as DehumidifierIcon,
  DeviceThermostat as ChillerIcon,
  Map as MapIcon,
  LocationCity as LocationCityIcon,
  Public as PublicIcon,
  Description as DescriptionIcon,
  Schedule as ScheduleIcon,
  AllInclusive as AllInclusiveIcon,
  Badge as BadgeIcon,
  Handshake as HandshakeIcon,
  List as ListIcon,
  Assignment as AssignmentIcon,
  Summarize as SummarizeIcon,
  Person as PersonIcon,
  Payment as PaymentIcon,
  MoneyOff as MoneyOffIcon,
  AccountBalanceWallet as AccountBalanceWalletIcon,
  Logout as LogoutIcon,
  Dashboard as DashboardIcon,
  Visibility,
  VisibilityOff,
  Bolt as BoltIcon, // Иконка для электроэнергии
  Whatshot as GasIcon, // Иконка для газа
  Calculate as CalculateIcon, // Иконка для расчетов
  Work as WorkIcon,
  Speed as MeterIcon,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import Collapse from "@mui/material/Collapse";
import UserModal from "./UserModal";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  InputAdornment,
  Alert,
} from "@mui/material";
import {
  doc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  addDoc,
} from "firebase/firestore";
import { db } from "../firebase/config";

export default function Navbar() {
  const MotionPaper = motion.create(Paper);
  const setUser = useAppStore((state) => state.setUser);
  const user = useAppStore((state) => state.user);
  const userData = useAppStore((state) => state.userData);
  const role = userData?.role;
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [equipmentOpen, setEquipmentOpen] = React.useState(false);
  const [equipmentDetailsOpen, setEquipmentDetailsOpen] = React.useState(false);
  const [equipmentTypesOpen, setEquipmentTypesOpen] = React.useState(false);
  const [regionsOpen, setRegionsOpen] = React.useState(false);
  const [documentsOpen, setDocumentsOpen] = React.useState(false);
  const [docsTimedOpen, setDocsTimedOpen] = React.useState(false);
  const [docsPerpOpen, setDocsPerpOpen] = React.useState(false);
  const [partnersOpen, setPartnersOpen] = React.useState(false);
  const [dailyReportsOpen, setDailyReportsOpen] = React.useState(false);
  const [energySettlementsOpen, setEnergySettlementsOpen] =
    React.useState(false);
  const [userModalOpen, setUserModalOpen] = React.useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = React.useState(false);
  const [passwordData, setPasswordData] = React.useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showPasswords, setShowPasswords] = React.useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [passwordError, setPasswordError] = React.useState("");
  const [passwordLoading, setPasswordLoading] = React.useState(false);

  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const isTablet = useMediaQuery(theme.breakpoints.down("lg"));
  const [userMenuOpen, setUserMenuOpen] = React.useState(false);

  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuOpen) {
        setUserMenuOpen(false);
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [userMenuOpen]);

  const getUserFullName = () => {
    if (!userData) return "";

    const { lastName, firstName, middleName } = userData;
    let fullName = "";

    if (lastName) fullName += lastName;
    if (firstName) fullName += ` ${firstName}`;
    if (middleName) fullName += ` ${middleName}`;

    return fullName.trim();
  };

  const getShortName = () => {
    if (!userData) return "";

    const { lastName, firstName } = userData;
    if (lastName && firstName) {
      return `${lastName} ${firstName.charAt(0)}.`;
    }
    return getUserFullName();
  };

  const signOutProfile = async () => {
    await signOut(auth);
    setUser(null);
    toast.success("До свидания!");
  };

  const toggleDrawer = (open) => (event) => {
    if (
      event?.type === "keydown" &&
      (event.key === "Tab" || event.key === "Shift")
    )
      return;
    setDrawerOpen(open);
    if (!open) {
      setEquipmentOpen(false);
      setEquipmentDetailsOpen(false);
      setEquipmentTypesOpen(false);
      setRegionsOpen(false);
      setDocumentsOpen(false);
      setDocsTimedOpen(false);
      setDocsPerpOpen(false);
      setPartnersOpen(false);
      setDailyReportsOpen(false);
      setEnergySettlementsOpen(false);
    }
  };

  const handleMenuClick = (path) => {
    setDrawerOpen(false);
    navigate(path);
  };

  const handleUserButtonClick = () => {
    setUserModalOpen(true);
  };

  const handleUserModalClose = () => {
    setUserModalOpen(false);
  };

  const handleUserUpdated = () => {
    toast.success("Данные пользователя обновлены");
  };

  const handleEquipmentClick = () => setEquipmentOpen(!equipmentOpen);
  const handleEquipmentDetailsClick = () =>
    setEquipmentDetailsOpen(!equipmentDetailsOpen);
  const handleEquipmentTypesClick = () =>
    setEquipmentTypesOpen(!equipmentTypesOpen);
  const handleRegionsClick = () => setRegionsOpen(!regionsOpen);
  const handleDocumentsClick = () => setDocumentsOpen(!documentsOpen);
  const handleDocsTimedClick = () => setDocsTimedOpen(!docsTimedOpen);
  const handleDocsPerpClick = () => setDocsPerpOpen(!docsPerpOpen);
  const handlePartnersClick = () => setPartnersOpen(!partnersOpen);
  const handleDailyReportsClick = () => setDailyReportsOpen(!dailyReportsOpen);
  const handleEnergySettlementsClick = () =>
    setEnergySettlementsOpen(!energySettlementsOpen);

  // Функции для управления паролем
  const handlePasswordChange = () => {
    setPasswordModalOpen(true);
    setPasswordData({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
    setPasswordError("");
  };

  const handlePasswordClose = () => {
    setPasswordModalOpen(false);
    setPasswordData({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
    setPasswordError("");
    setShowPasswords({
      current: false,
      new: false,
      confirm: false,
    });
  };

  const handlePasswordInputChange = (field) => (event) => {
    setPasswordData((prev) => ({
      ...prev,
      [field]: event.target.value,
    }));
    if (passwordError) {
      setPasswordError("");
    }
  };

  const togglePasswordVisibility = (field) => {
    setShowPasswords((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  const validatePassword = (password) => {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    return (
      password.length >= minLength &&
      hasUpperCase &&
      hasLowerCase &&
      hasNumbers &&
      hasSpecialChar
    );
  };

  const handleUpdatePassword = async () => {
    if (
      !passwordData.currentPassword ||
      !passwordData.newPassword ||
      !passwordData.confirmPassword
    ) {
      setPasswordError("Барча майдонлар тўлдирилиши шарт!");
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError("Янги парол ва тасдиқлаш мос келмади");
      return;
    }

    if (!validatePassword(passwordData.newPassword)) {
      setPasswordError(
        "Парол камида 8 та белгидан иборат бўлиши керак, жумладан, катта ва кичик харфлар, рақамлар ва махсус белгилар"
      );
      return;
    }

    setPasswordLoading(true);
    setPasswordError("");

    try {
      const currentUser = auth.currentUser;

      if (!currentUser) {
        setPasswordError("Фойдаланувчи тасдиқланмаган");
        return;
      }

      await updatePassword(currentUser, passwordData.newPassword);

      try {
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("email", "==", userData.email));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          const userDoc = querySnapshot.docs[0];
          const userDocRef = doc(db, "users", userDoc.id);

          await updateDoc(userDocRef, {
            password: passwordData.newPassword,
            lastPasswordChange: new Date(),
            passwordChanged: true,
            updatedAt: new Date(),
          });
        } else {
          await addDoc(collection(db, "users"), {
            uid: currentUser.uid,
            email: currentUser.email,
            password: passwordData.newPassword,
            displayName: userData.displayName || "",
            firstName: userData.firstName || "",
            lastName: userData.lastName || "",
            role: userData.role || "operator",
            lastPasswordChange: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
      } catch (firestoreError) {
        throw new Error(
          "Паролни маълумотлар базасига сақлашда хатолик юз берди"
        );
      }

      toast.success("Пароль мувафақиятли ўзгартирилди");
      handlePasswordClose();
    } catch (error) {
      let errorMessage = "Паролни ўзгартиришда хатолик юз берди";
      switch (error.code) {
        case "auth/requires-recent-login":
          errorMessage =
            "Паролингизни ўзгартириш қайта аутентификацияни талаб қилади. Илтимос, тизимдан чиқинг ва қайта киринг.";
          break;
        case "auth/weak-password":
          errorMessage = "Парол жуда заиф. Мураккаброқ паролдан фойдаланинг.";
          break;
        case "auth/network-request-failed":
          errorMessage = "Тармоқ хатоси. Интернет алоқангизни текширинг.";
          break;
        default:
          errorMessage = error.message || "Ноъмалум хатолик";
      }

      setPasswordError(errorMessage);
    } finally {
      setPasswordLoading(false);
    }
  };

  // 🔹 Меню
  const menuItems = [
    { text: "Заправкалар", icon: <LocalGasStationIcon />, path: "/stations" },
    { text: "Ходимлар", icon: <BadgeIcon />, path: "/employees" },
    { text: "Фойдаланувчилар", icon: <PeopleIcon />, path: "/users" },
    { text: "МЧЖлар", icon: <CorporateFareIcon />, path: "/ltds" },
    { text: "Банк", icon: <AccountBalanceIcon />, path: "/banks" },
    { text: "Лавозимлар", icon: <WorkIcon />, path: "/jobtitle" },
    {
      text: "Колонка кўрсаткичларини ўзгартириш",
      icon: <MeterIcon />,
      path: "/meterreadings",
    },
  ];

  const partnersItems = [
    {
      text: "Ҳамкорлар рўйхати",
      icon: <ListIcon />,
      path: "/partners",
    },
    {
      text: "Шартномалар рўйхати",
      icon: <AssignmentIcon />,
      path: "/partnerslist",
    },
    {
      text: "Тўловлар",
      icon: <PaymentIcon />,
      path: "/payments",
    },
    {
      text: "Ҳамкорлар қарздорлиги",
      icon: <MoneyOffIcon />,
      path: "/reportondebtspartners",
    },
  ];

  // 🔹 Ежедневные отчеты
  const dailyReportsItems = [
    {
      text: "Кундалик ҳисобот",
      icon: <SummarizeIcon />,
      path: "/generaldailyreport",
    },
    {
      text: "Назорат суммалар",
      icon: <AccountBalanceWalletIcon />,
      path: "/controlpayments",
    },
  ];

  // 🔹 Расчеты по энергоносителям
  const energySettlementsItems = [
    {
      text: "Газ бўйича ҳисоб-китоб",
      icon: <GasIcon />,
      path: "/gassettlements",
    },
    {
      text: "Электроэнергия бўйича ҳисоб-китоб",
      icon: <BoltIcon />,
      path: "/elektrsettlements",
    },
  ];

  const equipmentDetailsItems = [
    {
      text: "Компрессорлар бўйича маълумот",
      icon: <CompressorIcon />,
      path: "/compressors",
    },
    {
      text: "Колонкалар бўйича маълумот",
      icon: <LocalGasStationIcon />,
      path: "/dispensers",
    },
    {
      text: "Осушка бўйича маълумот",
      icon: <DehumidifierIcon />,
      path: "/osushka",
    },
    {
      text: "Чиллерлар бўйича маълумот",
      icon: <ChillerIcon />,
      path: "/chillers",
    },
  ];

  const equipmentTypesItems = [
    {
      text: "Компрессор турлари",
      icon: <CompressorIcon />,
      path: "/typeofcompressors",
    },
    {
      text: "Колонкалар турлари",
      icon: <LocalGasStationIcon />,
      path: "/typeofdispensers",
    },
    {
      text: "Осушка турлари",
      icon: <DehumidifierIcon />,
      path: "/typeofosushka",
    },
    {
      text: "Чиллерлар турлари",
      icon: <ChillerIcon />,
      path: "/typeofchillers",
    },
  ];

  const regionsItems = [
    { text: "Вилоятлар", icon: <PublicIcon />, path: "/regions" },
    { text: "Шаҳар и туманлар", icon: <LocationCityIcon />, path: "/cities" },
  ];

  const docsTimedItems = [
    {
      text: "Хужжатларни турлари бўйича",
      icon: <DescriptionIcon />,
      path: "/docdeadline",
    },
    {
      text: "Заправкалар бўйича хужжатлар",
      icon: <LocalGasStationIcon />,
      path: "/docbystation",
    },
  ];

  const docsPerpItems = [
    {
      text: "Хужжатларни турлари бўйича",
      icon: <DescriptionIcon />,
      path: "/docdeadlineinf",
    },
    {
      text: "Заправкалар бўйича хужжатлар",
      icon: <LocalGasStationIcon />,
      path: "/docbystationinf",
    },
  ];

  // ⚙️ Фильтрация пунктов по роли
  const filteredMenuItems =
    role === "admin"
      ? menuItems
      : role === "electrengineer"
      ? menuItems.filter(
          (item) => item.text === "Колонка кўрсаткичларини ўзгартириш"
        )
      : role === "buxgalter"
      ? menuItems.filter((item) => item.text === "Ҳамкорлар")
      : role === "rahbar"
      ? menuItems.filter(
          (item) =>
            item.text !== "Фойдаланувчилар" &&
            item.text !== "Колонка кўрсаткичларини ўзгартириш"
        )
      : role === "operator"
      ? menuItems.filter(
          (item) =>
            item.text !== "Фойдаланувчилар" &&
            item.text !== "Колонка кўрсаткичларини ўзгартириш"
        )
      : [];

  const isRahbarOrBooker = role === "rahbar" || role === "buxgalter";

  const getRoleBadge = () => {
    const roleConfig = {
      admin: { color: "#ef4444", text: "Админ" },
      buxgalter: { color: "#10b981", text: "Бухгалтер" },
      operator: { color: "#3b82f6", text: "Оператор" },
      rahbar: { color: "#8b5cf6", text: "Рахбар" },
      electrengineer: { color: "#f59e0b", text: "Электр инженер" },
    };

    const config = roleConfig[role] || { color: "#6b7280", text: role };

    return (
      <Box
        sx={{
          display: "inline-flex",
          alignItems: "center",
          px: 1.5,
          py: 0.5,
          borderRadius: "12px",
          backgroundColor: `${config.color}15`,
          border: `1px solid ${config.color}30`,
          color: config.color,
          fontSize: "0.75rem",
          fontWeight: "600",
          ml: 1,
        }}>
        {config.text}
      </Box>
    );
  };

  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar
        position="static"
        sx={{
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
        }}>
        <Toolbar sx={{ minHeight: { xs: "64px", md: "70px" } }}>
          {/* Показываем кнопку меню для admin, buxgalter, operator, rahbar и electrengineer */}
          {role === "admin" ||
          role === "buxgalter" ||
          role === "operator" ||
          role === "rahbar" ||
          role === "electrengineer" ? (
            <IconButton
              size="large"
              edge="start"
              color="inherit"
              aria-label="menu"
              sx={{
                mr: 2,
                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                "&:hover": {
                  transform: "rotate(90deg)",
                  backgroundColor: "rgba(255,255,255,0.1)",
                },
              }}
              onClick={toggleDrawer(true)}>
              <MenuIcon />
            </IconButton>
          ) : null}
          <Box sx={{ display: "flex", alignItems: "center", flexGrow: 1 }}>
            <Typography
              variant="h6"
              component="div"
              onClick={() => navigate("/")}
              sx={{
                cursor: "pointer",
                fontWeight: "700",
                background: "linear-gradient(45deg, #ffffff, #e0e7ff)",
                backgroundClip: "text",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                transition: "all 0.3s ease",
                "&:hover": {
                  transform: "translateY(-1px)",
                  filter: "brightness(1.1)",
                },
                fontSize: { xs: "1.1rem", md: "1.25rem" },
                display: "flex",
                alignItems: "center",
                gap: 1,
              }}>
              <DashboardIcon
                sx={{ fontSize: { xs: "1.2rem", md: "1.5rem" } }}
              />
              Метан Система
            </Typography>

            {/* Бейдж роли на десктопе */}
            {!isMobile && getRoleBadge()}
          </Box>
          {/* Кнопки для rahbar и booker */}
          {isRahbarOrBooker && !isMobile && (
            <Box sx={{ display: "flex", gap: 1, mr: 3 }}>
              <Button
                color="inherit"
                onClick={() => navigate("/employeesdocdeadline")}
                sx={{
                  textTransform: "none",
                  borderRadius: "25px",
                  padding: "8px 20px",
                  transition: "all 0.3s ease",
                  background: "rgba(255,255,255,0.1)",
                  backdropFilter: "blur(10px)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  "&:hover": {
                    backgroundColor: "rgba(255, 255, 255, 0.2)",
                    transform: "translateY(-2px)",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                  },
                  fontSize: "0.9rem",
                  fontWeight: "500",
                }}>
                📄 Муддалар бўйича хужжатлар
              </Button>
              <Button
                color="inherit"
                onClick={() => navigate("/employeesdocdeadlineinf")}
                sx={{
                  textTransform: "none",
                  borderRadius: "25px",
                  padding: "8px 20px",
                  transition: "all 0.3s ease",
                  background: "rgba(255,255,255,0.1)",
                  backdropFilter: "blur(10px)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  "&:hover": {
                    backgroundColor: "rgba(255, 255, 255, 0.2)",
                    transform: "translateY(-2px)",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                  },
                  fontSize: "0.9rem",
                  fontWeight: "500",
                }}>
                ∞ Муддатсиз хужжатлар
              </Button>
            </Box>
          )}
          {/* Кнопка пользователя с меню */}

          {userData && (
            <div className="relative inline-block">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setUserMenuOpen(!userMenuOpen);
                }}
                className="flex items-center gap-2 mr-4 text-white rounded-full px-3 py-2 md:px-4 md:py-2 transition-all duration-300 hover:bg-white/20 hover:translate-y-[-2px] hover:shadow-lg backdrop-blur-sm border border-white/20 min-w-0"
                style={{
                  background: "rgba(255,255,255,0.1)",
                }}>
                <PersonIcon className="w-4 h-4 md:w-5 md:h-5" />
                <span
                  className={`font-medium text-sm md:text-base ${
                    isMobile ? "hidden sm:block" : "block"
                  } truncate max-w-[80px] sm:max-w-[120px] md:max-w-[150px]`}>
                  {isMobile ? getShortName() : getUserFullName()}
                </span>
                {/* Бейдж роли на мобильных */}
                {isMobile && getRoleBadge()}
              </button>

              {/* Выпадающее меню пользователя */}
              {userMenuOpen && (
                <div className="absolute top-full right-0 mt-2 w-56 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden z-50 animate-in fade-in-0 zoom-in-95">
                  <div className="p-0">
                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        handleUserButtonClick();
                      }}
                      className="flex items-center w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors duration-200 border-b border-gray-100">
                      <PersonIcon className="w-5 h-5 text-blue-600 mr-3" />
                      <span className="text-sm font-medium text-gray-900">
                        Профиль
                      </span>
                    </button>

                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        handlePasswordChange();
                      }}
                      className="flex items-center w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors duration-200">
                      <Visibility className="w-5 h-5 text-blue-600 mr-3" />
                      <span className="text-sm font-medium text-gray-900">
                        Паролни ўзгартириш
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          {/* Кнопка выхода */}
          <Button
            onClick={signOutProfile}
            color="inherit"
            sx={{
              borderRadius: "25px",
              padding: { xs: "6px 12px", md: "8px 20px" },
              transition: "all 0.3s ease",
              background: "rgba(255,255,255,0.1)",
              backdropFilter: "blur(10px)",
              border: "1px solid rgba(255,255,255,0.2)",
              "&:hover": {
                backgroundColor: "rgba(255, 59, 59, 0.3)",
                transform: "translateY(-2px)",
                boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
              },
              fontWeight: "600",
              fontSize: { xs: "0.8rem", md: "0.9rem" },
              display: "flex",
              alignItems: "center",
              gap: 1,
            }}>
            {!isMobile && <LogoutIcon sx={{ fontSize: 18 }} />}
            {isMobile ? "Чиқиш" : "ЧИҚИШ"}
          </Button>
        </Toolbar>
      </AppBar>

      {/* Модальное окно пользователя */}
      {userModalOpen && userData && (
        <UserModal
          user={{
            id: userData.uid || user?.uid,
            email: userData.email,
            displayName: userData.displayName,
            firstName: userData.firstName,
            lastName: userData.lastName,
            middleName: userData.middleName,
            birthday: userData.birthday,
            pinfl: userData.pinfl,
            passportSeries: userData.passportSeries,
            passportNumber: userData.passportNumber,
            address: userData.address,
            role: userData.role,
            accessEndDate: userData.accessEndDate,
            stations: userData.stations || [],
          }}
          onClose={handleUserModalClose}
          onUserUpdated={handleUserUpdated}
          readOnly={true}
        />
      )}

      {/* Модальное окно смены пароля */}
      {passwordModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden">
            {/* Заголовок */}
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-6">
              <h2 className="text-xl font-semibold">🔐 Паролни ўзгартириш</h2>
            </div>

            {/* Содержимое */}
            <div className="p-6">
              {passwordError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
                  {passwordError}
                </div>
              )}

              <div className="space-y-4">
                {/* Текущий пароль */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Жорий пароль
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswords.current ? "text" : "password"}
                      value={passwordData.currentPassword}
                      onChange={handlePasswordInputChange("currentPassword")}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                      placeholder="Введите текущий пароль"
                    />
                    <button
                      type="button"
                      onClick={() => togglePasswordVisibility("current")}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showPasswords.current ? (
                        <VisibilityOff className="w-5 h-5" />
                      ) : (
                        <Visibility className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Новый пароль */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Янги пароль
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswords.new ? "text" : "password"}
                      value={passwordData.newPassword}
                      onChange={handlePasswordInputChange("newPassword")}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                      placeholder="Янги паролни киритинг"
                    />
                    <button
                      type="button"
                      onClick={() => togglePasswordVisibility("new")}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showPasswords.new ? (
                        <VisibilityOff className="w-5 h-5" />
                      ) : (
                        <Visibility className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Камида 8 та белги, бош ва кичик ҳарфлар, рақамлар, махсус
                    белгилар
                  </p>
                </div>

                {/* Подтверждение пароля */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Янги паролни тасдиқлаш
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswords.confirm ? "text" : "password"}
                      value={passwordData.confirmPassword}
                      onChange={handlePasswordInputChange("confirmPassword")}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                      placeholder="Повторите новый пароль"
                    />
                    <button
                      type="button"
                      onClick={() => togglePasswordVisibility("confirm")}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showPasswords.confirm ? (
                        <VisibilityOff className="w-5 h-5" />
                      ) : (
                        <Visibility className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Кнопки */}
            <div className="flex gap-3 p-6 border-t border-gray-200 bg-gray-50">
              <button
                onClick={handlePasswordClose}
                disabled={passwordLoading}
                className="flex-1 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50 font-medium">
                Отмена
              </button>
              <button
                onClick={handleUpdatePassword}
                disabled={passwordLoading}
                className="flex-1 px-4 py-2 text-white bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-lg hover:shadow-xl">
                {passwordLoading ? "Ўзгартирилмоқда..." : "Паролни ўзгартириш"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Боковое меню */}
      {(role === "admin" ||
        role === "buxgalter" ||
        role === "operator" ||
        role === "rahbar" ||
        role === "electrengineer") && (
        <Drawer
          anchor="left"
          open={drawerOpen}
          onClose={toggleDrawer(false)}
          sx={{
            "& .MuiDrawer-paper": {
              width: { xs: "280px", sm: "320px" },
              boxSizing: "border-box",
              overflow: "hidden",
              background: "linear-gradient(180deg, #2d3748 0%, #4a5568 100%)",
              color: "white",
            },
          }}>
          <Paper
            sx={{
              width: "100%",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              background: "transparent",
            }}>
            {/* Заголовок меню */}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "20px 16px",
                background:
                  "linear-gradient(135deg, rgba(102, 126, 234, 0.9) 0%, rgba(118, 75, 162, 0.9) 100%)",
                color: "white",
                backdropFilter: "blur(10px)",
              }}>
              <Typography
                variant="h6"
                sx={{ fontWeight: "700", fontSize: "1.1rem" }}>
                🗂️ Навигация менюси
              </Typography>
              <IconButton
                onClick={toggleDrawer(false)}
                sx={{
                  color: "white",
                  transition: "all 0.3s ease",
                  "&:hover": {
                    backgroundColor: "rgba(255,255,255,0.1)",
                    transform: "rotate(90deg)",
                  },
                }}>
                <CloseIcon />
              </IconButton>
            </Box>

            <Divider sx={{ borderColor: "rgba(255,255,255,0.1)" }} />

            {/* Содержимое меню */}
            <Box sx={{ flex: 1, overflow: "auto", py: 1 }}>
              <List sx={{ padding: "8px" }}>
                {/* 🔹 Основные пункты (для admin, buxgalter, rahbar и electrengineer) */}
                {(role === "admin" ||
                  role === "buxgalter" ||
                  role === "rahbar" ||
                  role === "electrengineer") && (
                  <>
                    {filteredMenuItems.map((item, index) => (
                      <motion.div
                        key={item.text}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}>
                        <ListItem disablePadding sx={{ mb: 1 }}>
                          <ListItemButton
                            onClick={() => handleMenuClick(item.path)}
                            sx={{
                              borderRadius: "12px",
                              py: 1.5,
                              transition: "all 0.3s ease",
                              "&:hover": {
                                backgroundColor: "rgba(255,255,255,0.1)",
                                transform: "translateX(5px)",
                              },
                            }}>
                            <ListItemIcon
                              sx={{ minWidth: "45px", color: "white" }}>
                              {item.icon}
                            </ListItemIcon>
                            <ListItemText
                              primary={item.text}
                              primaryTypographyProps={{
                                fontSize: "15px",
                                fontWeight: "500",
                                color: "white",
                              }}
                            />
                          </ListItemButton>
                        </ListItem>
                      </motion.div>
                    ))}
                  </>
                )}

                {/* 🔹 Расчеты по энергоносителям (для admin, buxgalter, rahbar) */}
                {(role === "admin" ||
                  role === "buxgalter" ||
                  role === "rahbar") && (
                  <>
                    <ListItem disablePadding sx={{ mb: 1 }}>
                      <ListItemButton
                        onClick={handleEnergySettlementsClick}
                        sx={{
                          borderRadius: "12px",
                          py: 1.5,
                          transition: "all 0.3s ease",
                          "&:hover": {
                            backgroundColor: "rgba(255,255,255,0.1)",
                          },
                        }}>
                        <ListItemIcon sx={{ color: "white" }}>
                          <CalculateIcon />
                        </ListItemIcon>
                        <ListItemText
                          primary="⚡ Энергия ҳисоб-китоблари"
                          primaryTypographyProps={{ fontWeight: "500" }}
                        />
                        {energySettlementsOpen ? (
                          <ExpandLess />
                        ) : (
                          <ExpandMore />
                        )}
                      </ListItemButton>
                    </ListItem>
                    <Collapse
                      in={energySettlementsOpen}
                      timeout="auto"
                      unmountOnExit>
                      <List component="div" disablePadding>
                        {energySettlementsItems.map((item) => (
                          <ListItem
                            key={item.text}
                            disablePadding
                            sx={{ pl: 2 }}>
                            <ListItemButton
                              onClick={() => handleMenuClick(item.path)}
                              sx={{
                                borderRadius: "8px",
                                py: 1.2,
                                transition: "all 0.3s ease",
                                "&:hover": {
                                  backgroundColor: "rgba(255,255,255,0.08)",
                                  transform: "translateX(5px)",
                                },
                              }}>
                              <ListItemIcon
                                sx={{ color: "rgba(255,255,255,0.8)" }}>
                                {item.icon}
                              </ListItemIcon>
                              <ListItemText
                                primary={item.text}
                                primaryTypographyProps={{
                                  fontSize: "14px",
                                  color: "rgba(255,255,255,0.9)",
                                }}
                              />
                            </ListItemButton>
                          </ListItem>
                        ))}
                      </List>
                    </Collapse>
                  </>
                )}

                {/* 🔹 Партнеры (для admin, buxgalter, rahbar, operator) */}
                {(role === "admin" ||
                  role === "buxgalter" ||
                  role === "rahbar" ||
                  role === "operator") && (
                  <>
                    <ListItem disablePadding sx={{ mb: 1 }}>
                      <ListItemButton
                        onClick={handlePartnersClick}
                        sx={{
                          borderRadius: "12px",
                          py: 1.5,
                          transition: "all 0.3s ease",
                          "&:hover": {
                            backgroundColor: "rgba(255,255,255,0.1)",
                          },
                        }}>
                        <ListItemIcon sx={{ color: "white" }}>
                          <HandshakeIcon />
                        </ListItemIcon>
                        <ListItemText
                          primary="🤝 Ҳамкорлар"
                          primaryTypographyProps={{ fontWeight: "500" }}
                        />
                        {partnersOpen ? <ExpandLess /> : <ExpandMore />}
                      </ListItemButton>
                    </ListItem>
                    <Collapse in={partnersOpen} timeout="auto" unmountOnExit>
                      <List component="div" disablePadding>
                        {partnersItems
                          .filter((item) => {
                            if (role === "operator" || role === "rahbar") {
                              return item.text === "Ҳамкорлар қарздорлиги";
                            }
                            return true;
                          })
                          .map((item) => (
                            <ListItem
                              key={item.text}
                              disablePadding
                              sx={{ pl: 2 }}>
                              <ListItemButton
                                onClick={() => handleMenuClick(item.path)}
                                sx={{
                                  borderRadius: "8px",
                                  py: 1.2,
                                  transition: "all 0.3s ease",
                                  "&:hover": {
                                    backgroundColor: "rgba(255,255,255,0.08)",
                                    transform: "translateX(5px)",
                                  },
                                }}>
                                <ListItemIcon
                                  sx={{
                                    minWidth: "40px",
                                    color: "rgba(255,255,255,0.8)",
                                  }}>
                                  {item.icon}
                                </ListItemIcon>
                                <ListItemText
                                  primary={item.text}
                                  primaryTypographyProps={{
                                    fontSize: "14px",
                                    color: "rgba(255,255,255,0.9)",
                                  }}
                                />
                              </ListItemButton>
                            </ListItem>
                          ))}
                      </List>
                    </Collapse>
                  </>
                )}

                {/* 🔹 Ежедневные отчеты (для admin, buxgalter, operator, rahbar) */}
                {(role === "admin" ||
                  role === "buxgalter" ||
                  role === "operator" ||
                  role === "rahbar") && (
                  <>
                    <ListItem disablePadding sx={{ mb: 1 }}>
                      <ListItemButton
                        onClick={handleDailyReportsClick}
                        sx={{
                          borderRadius: "12px",
                          py: 1.5,
                          transition: "all 0.3s ease",
                          "&:hover": {
                            backgroundColor: "rgba(255,255,255,0.1)",
                          },
                        }}>
                        <ListItemIcon sx={{ color: "white" }}>
                          <SummarizeIcon />
                        </ListItemIcon>
                        <ListItemText
                          primary="📊 Кундалик ҳисоботлар"
                          primaryTypographyProps={{ fontWeight: "500" }}
                        />
                        {dailyReportsOpen ? <ExpandLess /> : <ExpandMore />}
                      </ListItemButton>
                    </ListItem>
                    <Collapse
                      in={dailyReportsOpen}
                      timeout="auto"
                      unmountOnExit>
                      <List component="div" disablePadding>
                        {dailyReportsItems
                          .filter((item) => {
                            if (role === "operator") {
                              return item.text !== "Назорат суммалар";
                            }
                            return true;
                          })
                          .map((item) => (
                            <ListItem
                              key={item.text}
                              disablePadding
                              sx={{ pl: 2 }}>
                              <ListItemButton
                                onClick={() => handleMenuClick(item.path)}
                                sx={{
                                  borderRadius: "8px",
                                  py: 1.2,
                                  transition: "all 0.3s ease",
                                  "&:hover": {
                                    backgroundColor: "rgba(255,255,255,0.08)",
                                    transform: "translateX(5px)",
                                  },
                                }}>
                                <ListItemIcon
                                  sx={{
                                    minWidth: "40px",
                                    color: "rgba(255,255,255,0.8)",
                                  }}>
                                  {item.icon}
                                </ListItemIcon>
                                <ListItemText
                                  primary={item.text}
                                  primaryTypographyProps={{
                                    fontSize: "14px",
                                    color: "rgba(255,255,255,0.9)",
                                  }}
                                />
                              </ListItemButton>
                            </ListItem>
                          ))}
                      </List>
                    </Collapse>
                  </>
                )}

                {/* 🔹 Документы (для admin и buxgalter) */}
                {role === "admin" && (
                  <>
                    <ListItem disablePadding sx={{ mb: 1 }}>
                      <ListItemButton
                        onClick={handleDocumentsClick}
                        sx={{
                          borderRadius: "12px",
                          py: 1.5,
                          transition: "all 0.3s ease",
                          "&:hover": {
                            backgroundColor: "rgba(255,255,255,0.1)",
                          },
                        }}>
                        <ListItemIcon sx={{ color: "white" }}>
                          <DescriptionIcon />
                        </ListItemIcon>
                        <ListItemText
                          primary="📑 Хужжатлар"
                          primaryTypographyProps={{ fontWeight: "500" }}
                        />
                        {documentsOpen ? <ExpandLess /> : <ExpandMore />}
                      </ListItemButton>
                    </ListItem>
                    <Collapse in={documentsOpen} timeout="auto" unmountOnExit>
                      <List component="div" disablePadding>
                        <ListItem disablePadding sx={{ pl: 2 }}>
                          <ListItemButton
                            onClick={() => handleMenuClick("/doctypepage")}
                            sx={{
                              borderRadius: "8px",
                              py: 1.2,
                              transition: "all 0.3s ease",
                              "&:hover": {
                                backgroundColor: "rgba(255,255,255,0.08)",
                                transform: "translateX(5px)",
                              },
                            }}>
                            <ListItemIcon
                              sx={{ color: "rgba(255,255,255,0.8)" }}>
                              <CategoryIcon />
                            </ListItemIcon>
                            <ListItemText
                              primary="Хужжатлар турлари"
                              primaryTypographyProps={{
                                fontSize: "14px",
                                color: "rgba(255,255,255,0.9)",
                              }}
                            />
                          </ListItemButton>
                        </ListItem>

                        <Divider
                          sx={{ my: 1, borderColor: "rgba(255,255,255,0.1)" }}
                        />

                        <ListItem disablePadding sx={{ pl: 2 }}>
                          <ListItemButton
                            onClick={handleDocsTimedClick}
                            sx={{
                              borderRadius: "8px",
                              py: 1.2,
                              transition: "all 0.3s ease",
                              "&:hover": {
                                backgroundColor: "rgba(255,255,255,0.08)",
                              },
                            }}>
                            <ListItemIcon
                              sx={{ color: "rgba(255,255,255,0.8)" }}>
                              <ScheduleIcon />
                            </ListItemIcon>
                            <ListItemText
                              primary="Муддатли хужжатлар"
                              primaryTypographyProps={{
                                fontSize: "14px",
                                color: "rgba(255,255,255,0.9)",
                              }}
                            />
                            {docsTimedOpen ? <ExpandLess /> : <ExpandMore />}
                          </ListItemButton>
                        </ListItem>
                        <Collapse
                          in={docsTimedOpen}
                          timeout="auto"
                          unmountOnExit>
                          <List component="div" disablePadding>
                            {docsTimedItems.map((item) => (
                              <ListItem
                                key={item.text}
                                disablePadding
                                sx={{ pl: 4 }}>
                                <ListItemButton
                                  onClick={() => handleMenuClick(item.path)}
                                  sx={{
                                    borderRadius: "6px",
                                    py: 1,
                                    transition: "all 0.3s ease",
                                    "&:hover": {
                                      backgroundColor: "rgba(255,255,255,0.06)",
                                      transform: "translateX(5px)",
                                    },
                                  }}>
                                  <ListItemIcon
                                    sx={{ color: "rgba(255,255,255,0.7)" }}>
                                    {item.icon}
                                  </ListItemIcon>
                                  <ListItemText
                                    primary={item.text}
                                    primaryTypographyProps={{
                                      fontSize: "13px",
                                      color: "rgba(255,255,255,0.8)",
                                    }}
                                  />
                                </ListItemButton>
                              </ListItem>
                            ))}
                          </List>
                        </Collapse>

                        <Divider
                          sx={{ my: 1, borderColor: "rgba(255,255,255,0.1)" }}
                        />

                        <ListItem disablePadding sx={{ pl: 2 }}>
                          <ListItemButton
                            onClick={handleDocsPerpClick}
                            sx={{
                              borderRadius: "8px",
                              py: 1.2,
                              transition: "all 0.3s ease",
                              "&:hover": {
                                backgroundColor: "rgba(255,255,255,0.08)",
                              },
                            }}>
                            <ListItemIcon
                              sx={{ color: "rgba(255,255,255,0.8)" }}>
                              <AllInclusiveIcon />
                            </ListItemIcon>
                            <ListItemText
                              primary="Муддатсиз хужжатлар"
                              primaryTypographyProps={{
                                fontSize: "14px",
                                color: "rgba(255,255,255,0.9)",
                              }}
                            />
                            {docsPerpOpen ? <ExpandLess /> : <ExpandMore />}
                          </ListItemButton>
                        </ListItem>
                        <Collapse
                          in={docsPerpOpen}
                          timeout="auto"
                          unmountOnExit>
                          <List component="div" disablePadding>
                            {docsPerpItems.map((item) => (
                              <ListItem
                                key={item.text}
                                disablePadding
                                sx={{ pl: 4 }}>
                                <ListItemButton
                                  onClick={() => handleMenuClick(item.path)}
                                  sx={{
                                    borderRadius: "6px",
                                    py: 1,
                                    transition: "all 0.3s ease",
                                    "&:hover": {
                                      backgroundColor: "rgba(255,255,255,0.06)",
                                      transform: "translateX(5px)",
                                    },
                                  }}>
                                  <ListItemIcon
                                    sx={{ color: "rgba(255,255,255,0.7)" }}>
                                    {item.icon}
                                  </ListItemIcon>
                                  <ListItemText
                                    primary={item.text}
                                    primaryTypographyProps={{
                                      fontSize: "13px",
                                      color: "rgba(255,255,255,0.8)",
                                    }}
                                  />
                                </ListItemButton>
                              </ListItem>
                            ))}
                          </List>
                        </Collapse>
                      </List>
                    </Collapse>
                  </>
                )}

                {/* 🔹 Остальные меню только для admin */}
                {role === "admin" && (
                  <>
                    {/* Регионы */}
                    <ListItem disablePadding sx={{ mb: 1 }}>
                      <ListItemButton
                        onClick={handleRegionsClick}
                        sx={{
                          borderRadius: "12px",
                          py: 1.5,
                          transition: "all 0.3s ease",
                          "&:hover": {
                            backgroundColor: "rgba(255,255,255,0.1)",
                          },
                        }}>
                        <ListItemIcon sx={{ color: "white" }}>
                          <MapIcon />
                        </ListItemIcon>
                        <ListItemText
                          primary="🗺️ Худудлар"
                          primaryTypographyProps={{ fontWeight: "500" }}
                        />
                        {regionsOpen ? <ExpandLess /> : <ExpandMore />}
                      </ListItemButton>
                    </ListItem>
                    <Collapse in={regionsOpen} timeout="auto" unmountOnExit>
                      <List component="div" disablePadding>
                        {regionsItems.map((item) => (
                          <ListItem
                            key={item.text}
                            disablePadding
                            sx={{ pl: 2 }}>
                            <ListItemButton
                              onClick={() => handleMenuClick(item.path)}
                              sx={{
                                borderRadius: "8px",
                                py: 1.2,
                                transition: "all 0.3s ease",
                                "&:hover": {
                                  backgroundColor: "rgba(255,255,255,0.08)",
                                  transform: "translateX(5px)",
                                },
                              }}>
                              <ListItemIcon
                                sx={{ color: "rgba(255,255,255,0.8)" }}>
                                {item.icon}
                              </ListItemIcon>
                              <ListItemText
                                primary={item.text}
                                primaryTypographyProps={{
                                  fontSize: "14px",
                                  color: "rgba(255,255,255,0.9)",
                                }}
                              />
                            </ListItemButton>
                          </ListItem>
                        ))}
                      </List>
                    </Collapse>

                    {/* Оборудование */}
                    <ListItem disablePadding sx={{ mb: 1 }}>
                      <ListItemButton
                        onClick={handleEquipmentClick}
                        sx={{
                          borderRadius: "12px",
                          py: 1.5,
                          transition: "all 0.3s ease",
                          "&:hover": {
                            backgroundColor: "rgba(255,255,255,0.1)",
                          },
                        }}>
                        <ListItemIcon sx={{ color: "white" }}>
                          <BuildIcon />
                        </ListItemIcon>
                        <ListItemText
                          primary="⚙️ Ускуналар"
                          primaryTypographyProps={{ fontWeight: "500" }}
                        />
                        {equipmentOpen ? <ExpandLess /> : <ExpandMore />}
                      </ListItemButton>
                    </ListItem>
                    <Collapse in={equipmentOpen} timeout="auto" unmountOnExit>
                      <List component="div" disablePadding>
                        <ListItem disablePadding sx={{ pl: 2 }}>
                          <ListItemButton
                            onClick={handleEquipmentDetailsClick}
                            sx={{
                              borderRadius: "8px",
                              py: 1.2,
                              transition: "all 0.3s ease",
                              "&:hover": {
                                backgroundColor: "rgba(255,255,255,0.08)",
                              },
                            }}>
                            <ListItemIcon
                              sx={{ color: "rgba(255,255,255,0.8)" }}>
                              <SettingsInputComponentIcon />
                            </ListItemIcon>
                            <ListItemText
                              primary="Ускуналар ҳақида маълумотлар"
                              primaryTypographyProps={{
                                fontSize: "14px",
                                color: "rgba(255,255,255,0.9)",
                              }}
                            />
                            {equipmentDetailsOpen ? (
                              <ExpandLess />
                            ) : (
                              <ExpandMore />
                            )}
                          </ListItemButton>
                        </ListItem>
                        <Collapse
                          in={equipmentDetailsOpen}
                          timeout="auto"
                          unmountOnExit>
                          <List component="div" disablePadding>
                            {equipmentDetailsItems.map((item) => (
                              <ListItem
                                key={item.text}
                                disablePadding
                                sx={{ pl: 4 }}>
                                <ListItemButton
                                  onClick={() => handleMenuClick(item.path)}
                                  sx={{
                                    borderRadius: "6px",
                                    py: 1,
                                    transition: "all 0.3s ease",
                                    "&:hover": {
                                      backgroundColor: "rgba(255,255,255,0.06)",
                                      transform: "translateX(5px)",
                                    },
                                  }}>
                                  <ListItemIcon
                                    sx={{ color: "rgba(255,255,255,0.7)" }}>
                                    {item.icon}
                                  </ListItemIcon>
                                  <ListItemText
                                    primary={item.text}
                                    primaryTypographyProps={{
                                      fontSize: "13px",
                                      color: "rgba(255,255,255,0.8)",
                                    }}
                                  />
                                </ListItemButton>
                              </ListItem>
                            ))}
                          </List>
                        </Collapse>

                        {/* Типы оборудования */}
                        <ListItem disablePadding sx={{ pl: 2 }}>
                          <ListItemButton
                            onClick={handleEquipmentTypesClick}
                            sx={{
                              borderRadius: "8px",
                              py: 1.2,
                              transition: "all 0.3s ease",
                              "&:hover": {
                                backgroundColor: "rgba(255,255,255,0.08)",
                              },
                            }}>
                            <ListItemIcon
                              sx={{ color: "rgba(255,255,255,0.8)" }}>
                              <CategoryIcon />
                            </ListItemIcon>
                            <ListItemText
                              primary="Ускуналар турлари"
                              primaryTypographyProps={{
                                fontSize: "14px",
                                color: "rgba(255,255,255,0.9)",
                              }}
                            />
                            {equipmentTypesOpen ? (
                              <ExpandLess />
                            ) : (
                              <ExpandMore />
                            )}
                          </ListItemButton>
                        </ListItem>
                        <Collapse
                          in={equipmentTypesOpen}
                          timeout="auto"
                          unmountOnExit>
                          <List component="div" disablePadding>
                            {equipmentTypesItems.map((item) => (
                              <ListItem
                                key={item.text}
                                disablePadding
                                sx={{ pl: 4 }}>
                                <ListItemButton
                                  onClick={() => handleMenuClick(item.path)}
                                  sx={{
                                    borderRadius: "6px",
                                    py: 1,
                                    transition: "all 0.3s ease",
                                    "&:hover": {
                                      backgroundColor: "rgba(255,255,255,0.06)",
                                      transform: "translateX(5px)",
                                    },
                                  }}>
                                  <ListItemIcon
                                    sx={{ color: "rgba(255,255,255,0.7)" }}>
                                    {item.icon}
                                  </ListItemIcon>
                                  <ListItemText
                                    primary={item.text}
                                    primaryTypographyProps={{
                                      fontSize: "13px",
                                      color: "rgba(255,255,255,0.8)",
                                    }}
                                  />
                                </ListItemButton>
                              </ListItem>
                            ))}
                          </List>
                        </Collapse>
                      </List>
                    </Collapse>
                  </>
                )}
              </List>
            </Box>
          </Paper>
        </Drawer>
      )}
    </Box>
  );
}
