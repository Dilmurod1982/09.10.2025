import * as React from "react";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import MenuIcon from "@mui/icons-material/Menu";
import { signOut } from "firebase/auth";
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
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import Collapse from "@mui/material/Collapse";
import UserModal from "./UserModal";

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
  const [userModalOpen, setUserModalOpen] = React.useState(false);

  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const isTablet = useMediaQuery(theme.breakpoints.down("lg"));

  // Формируем ФИО пользователя
  const getUserFullName = () => {
    if (!userData) return "";

    const { lastName, firstName, middleName } = userData;
    let fullName = "";

    if (lastName) fullName += lastName;
    if (firstName) fullName += ` ${firstName}`;
    if (middleName) fullName += ` ${middleName}`;

    return fullName.trim();
  };

  // Сокращаем ФИО для мобильных устройств
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

  // 🔹 Меню
  const menuItems = [
    { text: "Станции", icon: <LocalGasStationIcon />, path: "/stations" },
    { text: "Сотрудники", icon: <BadgeIcon />, path: "/employees" },
    { text: "Пользователи", icon: <PeopleIcon />, path: "/users" },
    { text: "ООО", icon: <CorporateFareIcon />, path: "/ltds" },
    { text: "Банк", icon: <AccountBalanceIcon />, path: "/banks" },
  ];

  const partnersItems = [
    {
      text: "Список партнеров",
      icon: <ListIcon />,
      path: "/partners",
    },
    {
      text: "Список договоров",
      icon: <AssignmentIcon />,
      path: "/partnerslist",
    },
    {
      text: "Оплаты",
      icon: <PaymentIcon />,
      path: "/payments",
    },
    {
      text: "Задолженности партнеров",
      icon: <MoneyOffIcon />,
      path: "/reportondebtspartners",
    },
  ];

  // 🔹 Ежедневные отчеты
  const dailyReportsItems = [
    {
      text: "Общий ежедневный отчет",
      icon: <SummarizeIcon />,
      path: "/generaldailyreport",
    },
    {
      text: "Контрольные суммы",
      icon: <AccountBalanceWalletIcon />,
      path: "/controlpayments",
    },
  ];

  const equipmentDetailsItems = [
    {
      text: "Сведения о компрессорах",
      icon: <CompressorIcon />,
      path: "/compressors",
    },
    {
      text: "Сведения о колонках",
      icon: <LocalGasStationIcon />,
      path: "/dispensers",
    },
    {
      text: "Сведения об осушках",
      icon: <DehumidifierIcon />,
      path: "/osushka",
    },
    { text: "Сведения о чиллерах", icon: <ChillerIcon />, path: "/chillers" },
  ];

  const equipmentTypesItems = [
    {
      text: "Типы компрессоров",
      icon: <CompressorIcon />,
      path: "/typeofcompressors",
    },
    {
      text: "Типы колонок",
      icon: <LocalGasStationIcon />,
      path: "/typeofdispensers",
    },
    { text: "Типы осушок", icon: <DehumidifierIcon />, path: "/typeofosushka" },
    { text: "Типы чиллеров", icon: <ChillerIcon />, path: "/typeofchillers" },
  ];

  const regionsItems = [
    { text: "Области", icon: <PublicIcon />, path: "/regions" },
    { text: "Города и районы", icon: <LocationCityIcon />, path: "/cities" },
  ];

  const docsTimedItems = [
    {
      text: "Документы по типам",
      icon: <DescriptionIcon />,
      path: "/docdeadline",
    },
    {
      text: "Документы по станциям",
      icon: <LocalGasStationIcon />,
      path: "/docbystation",
    },
  ];

  const docsPerpItems = [
    {
      text: "Документы по типам",
      icon: <DescriptionIcon />,
      path: "/docdeadlineinf",
    },
    {
      text: "Документы по станциям",
      icon: <LocalGasStationIcon />,
      path: "/docbystationinf",
    },
  ];

  // ⚙️ Фильтрация пунктов по роли
  const filteredMenuItems =
    role === "admin"
      ? menuItems
      : role === "buxgalter"
      ? menuItems.filter((item) => item.text === "Партнёры")
      : [];

  // Проверяем, является ли пользователь rahbar или booker
  const isRahbarOrBooker = role === "rahbar" || role === "buxgalter";

  // Бейдж роли с цветами
  const getRoleBadge = () => {
    const roleConfig = {
      admin: { color: "#ef4444", text: "Админ" },
      buxgalter: { color: "#10b981", text: "Бухгалтер" },
      operator: { color: "#3b82f6", text: "Оператор" },
      rahbar: { color: "#8b5cf6", text: "Рахбар" },
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
          {/* Показываем кнопку меню для admin, buxgalter и operator */}
          {role === "admin" ||
          role === "buxgalter" ||
          role === "operator" ||
          role === "rahbar" ? (
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
                📄 Документы со сроком
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
                ∞ Бессрочные документы
              </Button>
            </Box>
          )}

          {/* Кнопка пользователя */}
          {userData && (
            <Button
              onClick={handleUserButtonClick}
              color="inherit"
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                mr: 2,
                textTransform: "none",
                borderRadius: "25px",
                padding: { xs: "6px 12px", md: "8px 16px" },
                transition: "all 0.3s ease",
                background: "rgba(255,255,255,0.1)",
                backdropFilter: "blur(10px)",
                border: "1px solid rgba(255,255,255,0.2)",
                "&:hover": {
                  backgroundColor: "rgba(255, 255, 255, 0.2)",
                  transform: "translateY(-2px)",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                },
                minWidth: "auto",
              }}>
              <PersonIcon sx={{ fontSize: { xs: 18, md: 20 } }} />
              <Typography
                variant="body1"
                sx={{
                  fontWeight: "500",
                  fontSize: { xs: "0.8rem", md: "0.9rem" },
                  maxWidth: { xs: "80px", sm: "120px", md: "150px" },
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  display: { xs: "none", sm: "block" },
                }}>
                {isMobile ? getShortName() : getUserFullName()}
              </Typography>
              {/* Бейдж роли на мобильных */}
              {isMobile && getRoleBadge()}
            </Button>
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
            {isMobile ? "Выход" : "ЧИҚИШ"}
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

      {/* Боковое меню */}
      {(role === "admin" ||
        role === "buxgalter" ||
        role === "operator" ||
        role === "rahbar") && (
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
                🗂️ Меню навигации
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
                {/* 🔹 Основные пункты (только для admin и buxgalter) */}
                {(role === "admin" ||
                  role === "buxgalter" ||
                  role === "rahbar") && (
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

                {/* 🔹 Партнеры (только для admin и buxgalter) */}
                {(role === "admin" ||
                  role === "buxgalter" ||
                  role === "rahbar") && (
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
                          primary="🤝 Партнёры"
                          primaryTypographyProps={{ fontWeight: "500" }}
                        />
                        {partnersOpen ? <ExpandLess /> : <ExpandMore />}
                      </ListItemButton>
                    </ListItem>
                    <Collapse in={partnersOpen} timeout="auto" unmountOnExit>
                      <List component="div" disablePadding>
                        {partnersItems.map((item) => (
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

                {/* 🔹 Ежедневные отчеты (для admin, buxgalter и operator) */}
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
                          primary="📊 Ежедневные отчеты"
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
                        {dailyReportsItems.map((item) => (
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
                          primary="📑 Документы"
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
                              primary="Типы документов"
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
                              primary="Документы со сроком"
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
                              primary="Бессрочные документы"
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
                          primary="🗺️ Регионы"
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
                          primary="⚙️ Оборудования"
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
                              primary="Сведения об оборудованиях"
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
                              primary="Типы оборудования"
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
