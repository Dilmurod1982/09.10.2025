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
import { Paper } from "@mui/material";
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
  Summarize as SummarizeIcon, // Иконка для отчетов
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import Collapse from "@mui/material/Collapse";

export default function Navbar() {
  const MotionPaper = motion.create(Paper);
  const setUser = useAppStore((state) => state.setUser);
  const user = useAppStore((state) => state.user);
  const userData = useAppStore((state) => state.userData);
  const role = userData?.role; // ✅ Роль пользователя
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [equipmentOpen, setEquipmentOpen] = React.useState(false);
  const [equipmentDetailsOpen, setEquipmentDetailsOpen] = React.useState(false);
  const [equipmentTypesOpen, setEquipmentTypesOpen] = React.useState(false);
  const [regionsOpen, setRegionsOpen] = React.useState(false);
  const [documentsOpen, setDocumentsOpen] = React.useState(false);
  const [docsTimedOpen, setDocsTimedOpen] = React.useState(false);
  const [docsPerpOpen, setDocsPerpOpen] = React.useState(false);
  const [partnersOpen, setPartnersOpen] = React.useState(false);
  const [dailyReportsOpen, setDailyReportsOpen] = React.useState(false); // Новое состояние для ежедневных отчетов

  const navigate = useNavigate();
  const theme = useTheme();

  const signOutProfile = async () => {
    await signOut(auth);
    setUser(null);
    toast.success("See you later");
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
      setDailyReportsOpen(false); // Сбрасываем состояние ежедневных отчетов
    }
  };

  const handleMenuClick = (path) => {
    setDrawerOpen(false);
    navigate(path);
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
  const handleDailyReportsClick = () => setDailyReportsOpen(!dailyReportsOpen); // Обработчик для ежедневных отчетов

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
  ];

  // 🔹 Ежедневные отчеты
  const dailyReportsItems = [
    {
      text: "Общий ежедневный отчет",
      icon: <SummarizeIcon />,
      path: "/generaldailyreport",
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

  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static">
        <Toolbar>
          {/* Показываем кнопку меню для admin, buxgalter и operator */}
          {role === "admin" || role === "buxgalter" || role === "operator" ? (
            <IconButton
              size="large"
              edge="start"
              color="inherit"
              aria-label="menu"
              sx={{
                mr: 2,
                transition: theme.transitions.create(["transform", "color"], {
                  duration: theme.transitions.duration.short,
                }),
                "&:hover": { transform: "rotate(90deg)" },
              }}
              onClick={toggleDrawer(true)}>
              <MenuIcon />
            </IconButton>
          ) : null}

          <Typography
            variant="h6"
            component="div"
            onClick={() => navigate("/")}
            sx={{
              flexGrow: 1,
              cursor: "pointer",
              fontWeight: "600",
              transition: "color 0.2s",
              "&:hover": { color: "#b3e5fc" },
            }}>
            Метан
          </Typography>

          <Button onClick={signOutProfile} color="inherit">
            Выход
          </Button>
        </Toolbar>
      </AppBar>

      {/* Drawer отображается для admin, buxgalter и operator */}
      {(role === "admin" || role === "buxgalter" || role === "operator") && (
        <Drawer
          anchor="left"
          open={drawerOpen}
          onClose={toggleDrawer(false)}
          sx={{
            "& .MuiDrawer-paper": {
              width: 320,
              boxSizing: "border-box",
              overflow: "hidden",
            },
          }}>
          <Paper
            sx={{
              width: "100%",
              height: "100%",
              display: "flex",
              flexDirection: "column",
            }}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px",
                backgroundColor: theme.palette.primary.main,
                color: "white",
              }}>
              <Typography variant="h6">Меню</Typography>
              <IconButton onClick={toggleDrawer(false)} sx={{ color: "white" }}>
                <CloseIcon />
              </IconButton>
            </Box>

            <Divider />

            <Box sx={{ flex: 1, overflow: "auto" }}>
              <List sx={{ padding: "8px" }}>
                {/* 🔹 Основные пункты (только для admin и buxgalter) */}
                {(role === "admin" || role === "buxgalter") && (
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
                              borderRadius: "8px",
                              "&:hover": {
                                backgroundColor: theme.palette.action.hover,
                              },
                            }}>
                            <ListItemIcon sx={{ minWidth: "40px" }}>
                              {item.icon}
                            </ListItemIcon>
                            <ListItemText
                              primary={item.text}
                              primaryTypographyProps={{
                                fontSize: "15px",
                                fontWeight: "500",
                              }}
                            />
                          </ListItemButton>
                        </ListItem>
                      </motion.div>
                    ))}
                  </>
                )}

                {/* 🔹 Партнеры (только для admin и buxgalter) */}
                {(role === "admin" || role === "buxgalter") && (
                  <>
                    <ListItem disablePadding sx={{ mb: 1 }}>
                      <ListItemButton onClick={handlePartnersClick}>
                        <ListItemIcon>
                          <HandshakeIcon />
                        </ListItemIcon>
                        <ListItemText primary="Партнёры" />
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
                                "&:hover": {
                                  backgroundColor: theme.palette.action.hover,
                                },
                              }}>
                              <ListItemIcon sx={{ minWidth: "40px" }}>
                                {item.icon}
                              </ListItemIcon>
                              <ListItemText
                                primary={item.text}
                                primaryTypographyProps={{
                                  fontSize: "14px",
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
                  role === "operator") && (
                  <>
                    <ListItem disablePadding sx={{ mb: 1 }}>
                      <ListItemButton onClick={handleDailyReportsClick}>
                        <ListItemIcon>
                          <SummarizeIcon />
                        </ListItemIcon>
                        <ListItemText primary="Ежедневные отчеты" />
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
                                "&:hover": {
                                  backgroundColor: theme.palette.action.hover,
                                },
                              }}>
                              <ListItemIcon sx={{ minWidth: "40px" }}>
                                {item.icon}
                              </ListItemIcon>
                              <ListItemText
                                primary={item.text}
                                primaryTypographyProps={{
                                  fontSize: "14px",
                                }}
                              />
                            </ListItemButton>
                          </ListItem>
                        ))}
                      </List>
                    </Collapse>
                  </>
                )}

                {/* 🔹 Остальные меню только для admin */}
                {role === "admin" && (
                  <>
                    {/* регионы */}
                    <ListItem disablePadding sx={{ mb: 1 }}>
                      <ListItemButton onClick={handleRegionsClick}>
                        <ListItemIcon>
                          <MapIcon />
                        </ListItemIcon>
                        <ListItemText primary="Регионы" />
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
                              onClick={() => handleMenuClick(item.path)}>
                              <ListItemIcon>{item.icon}</ListItemIcon>
                              <ListItemText primary={item.text} />
                            </ListItemButton>
                          </ListItem>
                        ))}
                      </List>
                    </Collapse>

                    {/* Оборудование */}
                    <ListItem disablePadding sx={{ mb: 1 }}>
                      <ListItemButton onClick={handleEquipmentClick}>
                        <ListItemIcon>
                          <BuildIcon />
                        </ListItemIcon>
                        <ListItemText primary="Оборудования" />
                        {equipmentOpen ? <ExpandLess /> : <ExpandMore />}
                      </ListItemButton>
                    </ListItem>
                    <Collapse in={equipmentOpen} timeout="auto" unmountOnExit>
                      <List component="div" disablePadding>
                        <ListItem disablePadding sx={{ pl: 2 }}>
                          <ListItemButton onClick={handleEquipmentDetailsClick}>
                            <ListItemIcon>
                              <SettingsInputComponentIcon />
                            </ListItemIcon>
                            <ListItemText primary="Сведения об оборудованиях" />
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
                                  onClick={() => handleMenuClick(item.path)}>
                                  <ListItemIcon>{item.icon}</ListItemIcon>
                                  <ListItemText primary={item.text} />
                                </ListItemButton>
                              </ListItem>
                            ))}
                          </List>
                        </Collapse>

                        {/* Типы оборудования */}
                        <ListItem disablePadding sx={{ pl: 2 }}>
                          <ListItemButton onClick={handleEquipmentTypesClick}>
                            <ListItemIcon>
                              <CategoryIcon />
                            </ListItemIcon>
                            <ListItemText primary="Типы оборудования" />
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
                                  onClick={() => handleMenuClick(item.path)}>
                                  <ListItemIcon>{item.icon}</ListItemIcon>
                                  <ListItemText primary={item.text} />
                                </ListItemButton>
                              </ListItem>
                            ))}
                          </List>
                        </Collapse>
                      </List>
                    </Collapse>

                    {/* Документы */}
                    <ListItem disablePadding sx={{ mb: 1 }}>
                      <ListItemButton onClick={handleDocumentsClick}>
                        <ListItemIcon>
                          <DescriptionIcon />
                        </ListItemIcon>
                        <ListItemText primary="Документы" />
                        {documentsOpen ? <ExpandLess /> : <ExpandMore />}
                      </ListItemButton>
                    </ListItem>
                    <Collapse in={documentsOpen} timeout="auto" unmountOnExit>
                      <List component="div" disablePadding>
                        <ListItem disablePadding sx={{ pl: 2 }}>
                          <ListItemButton
                            onClick={() => handleMenuClick("/doctypepage")}>
                            <ListItemIcon>
                              <CategoryIcon />
                            </ListItemIcon>
                            <ListItemText primary="Типы документов" />
                          </ListItemButton>
                        </ListItem>

                        <Divider sx={{ my: 1 }} />

                        <ListItem disablePadding sx={{ pl: 2 }}>
                          <ListItemButton onClick={handleDocsTimedClick}>
                            <ListItemIcon>
                              <ScheduleIcon />
                            </ListItemIcon>
                            <ListItemText primary="Документы со сроком" />
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
                                  onClick={() => handleMenuClick(item.path)}>
                                  <ListItemIcon>{item.icon}</ListItemIcon>
                                  <ListItemText primary={item.text} />
                                </ListItemButton>
                              </ListItem>
                            ))}
                          </List>
                        </Collapse>

                        <Divider sx={{ my: 1 }} />

                        <ListItem disablePadding sx={{ pl: 2 }}>
                          <ListItemButton onClick={handleDocsPerpClick}>
                            <ListItemIcon>
                              <AllInclusiveIcon />
                            </ListItemIcon>
                            <ListItemText primary="Бессрочные документы" />
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
                                  onClick={() => handleMenuClick(item.path)}>
                                  <ListItemIcon>{item.icon}</ListItemIcon>
                                  <ListItemText primary={item.text} />
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
