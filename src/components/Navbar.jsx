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
import { useAppStore } from "../lib/zustand/index";
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
import LocalGasStationIcon from "@mui/icons-material/LocalGasStation";
import PeopleIcon from "@mui/icons-material/People";
import CorporateFareIcon from "@mui/icons-material/CorporateFare";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import CloseIcon from "@mui/icons-material/Close";
import BuildIcon from "@mui/icons-material/Build";
import ExpandLess from "@mui/icons-material/ExpandLess";
import ExpandMore from "@mui/icons-material/ExpandMore";
import SettingsInputComponentIcon from "@mui/icons-material/SettingsInputComponent";
import CategoryIcon from "@mui/icons-material/Category";
import CompressorIcon from "@mui/icons-material/AcUnit";
import DispenserIcon from "@mui/icons-material/LocalGasStation";
import DehumidifierIcon from "@mui/icons-material/WaterDrop";
import ChillerIcon from "@mui/icons-material/DeviceThermostat";
import MapIcon from "@mui/icons-material/Map";
import LocationCityIcon from "@mui/icons-material/LocationCity";
import PublicIcon from "@mui/icons-material/Public";
import DescriptionIcon from "@mui/icons-material/Description";
import ScheduleIcon from "@mui/icons-material/Schedule";
import AllInclusiveIcon from "@mui/icons-material/AllInclusive";
import { useNavigate } from "react-router-dom";
import Collapse from "@mui/material/Collapse";
import BadgeIcon from "@mui/icons-material/Badge";

export default function Navbar() {
  const MotionPaper = motion.create(Paper);
  const setUser = useAppStore((state) => state.setUser);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [equipmentOpen, setEquipmentOpen] = React.useState(false);
  const [equipmentDetailsOpen, setEquipmentDetailsOpen] = React.useState(false);
  const [equipmentTypesOpen, setEquipmentTypesOpen] = React.useState(false);
  const [regionsOpen, setRegionsOpen] = React.useState(false);

  // Документы
  const [documentsOpen, setDocumentsOpen] = React.useState(false);
  const [docsTimedOpen, setDocsTimedOpen] = React.useState(false);
  const [docsPerpOpen, setDocsPerpOpen] = React.useState(false);

  const navigate = useNavigate();
  const theme = useTheme();

  const signOutProfile = async () => {
    await signOut(auth);
    setUser(null);
    toast.success("See you later");
  };

  const toggleDrawer = (open) => (event) => {
    if (
      event.type === "keydown" &&
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

  const menuItems = [
    { text: "Станции", icon: <LocalGasStationIcon />, path: "/stations" },
    { text: "Сотрудники", icon: <BadgeIcon />, path: "/employees" },
    { text: "Пользователи", icon: <PeopleIcon />, path: "/users" },
    { text: "ООО", icon: <CorporateFareIcon />, path: "/ltds" },
    { text: "Банк", icon: <AccountBalanceIcon />, path: "/banks" },
  ];

  const equipmentDetailsItems = [
    {
      text: "Сведения об компрессорах",
      icon: <CompressorIcon />,
      path: "/compressors",
    },
    {
      text: "Сведения об колонках",
      icon: <DispenserIcon />,
      path: "/dispensers",
    },
    {
      text: "Сведения об осушках",
      icon: <DehumidifierIcon />,
      path: "/osushka",
    },
    { text: "Сведения об чиллерах", icon: <ChillerIcon />, path: "/chillers" },
  ];

  const equipmentTypesItems = [
    {
      text: "Типы компрессоров",
      icon: <CompressorIcon />,
      path: "/typeofcompressors",
    },
    {
      text: "Типы колонок",
      icon: <DispenserIcon />,
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

  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static">
        <Toolbar>
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
              "&:hover": {
                transform: "rotate(90deg)",
              },
            }}
            onClick={toggleDrawer(true)}>
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Метан
          </Typography>
          <Button onClick={signOutProfile} color="inherit">
            Выход
          </Button>
        </Toolbar>
      </AppBar>

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
              flexShrink: 0,
            }}>
            <Typography variant="h6">Меню</Typography>
            <IconButton onClick={toggleDrawer(false)} sx={{ color: "white" }}>
              <CloseIcon />
            </IconButton>
          </Box>

          <Divider />

          <Box
            sx={{
              flex: 1,
              overflow: "auto",
              "&::-webkit-scrollbar": { width: "8px" },
              "&::-webkit-scrollbar-thumb": {
                background: theme.palette.grey[400],
                borderRadius: "4px",
              },
            }}>
            <List sx={{ padding: "8px" }}>
              {menuItems.map((item, index) => (
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

              {/* --- Регионы --- */}
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
                    <ListItem key={item.text} disablePadding sx={{ pl: 2 }}>
                      <ListItemButton
                        onClick={() => handleMenuClick(item.path)}>
                        <ListItemIcon>{item.icon}</ListItemIcon>
                        <ListItemText primary={item.text} />
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
              </Collapse>

              {/* --- Оборудования --- */}
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
                  {/* Сведения */}
                  <ListItem disablePadding sx={{ pl: 2 }}>
                    <ListItemButton onClick={handleEquipmentDetailsClick}>
                      <ListItemIcon>
                        <SettingsInputComponentIcon />
                      </ListItemIcon>
                      <ListItemText primary="Сведения об оборудованиях" />
                      {equipmentDetailsOpen ? <ExpandLess /> : <ExpandMore />}
                    </ListItemButton>
                  </ListItem>
                  <Collapse
                    in={equipmentDetailsOpen}
                    timeout="auto"
                    unmountOnExit>
                    <List component="div" disablePadding>
                      {equipmentDetailsItems.map((item) => (
                        <ListItem key={item.text} disablePadding sx={{ pl: 4 }}>
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
                      {equipmentTypesOpen ? <ExpandLess /> : <ExpandMore />}
                    </ListItemButton>
                  </ListItem>
                  <Collapse
                    in={equipmentTypesOpen}
                    timeout="auto"
                    unmountOnExit>
                    <List component="div" disablePadding>
                      {equipmentTypesItems.map((item) => (
                        <ListItem key={item.text} disablePadding sx={{ pl: 4 }}>
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

              {/* --- Документы --- */}
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
                  {/* ✅ Новый пункт */}
                  <ListItem disablePadding sx={{ mb: 0.5, pl: 2 }}>
                    <ListItemButton
                      onClick={() => handleMenuClick("/doctypepage")}
                      sx={{
                        borderRadius: "6px",
                        "&:hover": {
                          backgroundColor: theme.palette.action.hover,
                        },
                      }}>
                      <ListItemIcon sx={{ minWidth: "36px" }}>
                        <CategoryIcon />
                      </ListItemIcon>
                      <ListItemText
                        primary="Типы документов"
                        primaryTypographyProps={{
                          fontSize: "14px",
                          fontWeight: "500",
                        }}
                      />
                    </ListItemButton>
                  </ListItem>

                  <Divider sx={{ my: 1 }} />

                  {/* Документы со сроком */}
                  <ListItem disablePadding sx={{ pl: 2 }}>
                    <ListItemButton onClick={handleDocsTimedClick}>
                      <ListItemIcon>
                        <ScheduleIcon />
                      </ListItemIcon>
                      <ListItemText primary="Документы со сроком" />
                      {docsTimedOpen ? <ExpandLess /> : <ExpandMore />}
                    </ListItemButton>
                  </ListItem>
                  <Collapse in={docsTimedOpen} timeout="auto" unmountOnExit>
                    <List component="div" disablePadding>
                      {docsTimedItems.map((item) => (
                        <ListItem key={item.text} disablePadding sx={{ pl: 4 }}>
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

                  {/* Бессрочные документы */}
                  <ListItem disablePadding sx={{ pl: 2 }}>
                    <ListItemButton onClick={handleDocsPerpClick}>
                      <ListItemIcon>
                        <AllInclusiveIcon />
                      </ListItemIcon>
                      <ListItemText primary="Бессрочные документы" />
                      {docsPerpOpen ? <ExpandLess /> : <ExpandMore />}
                    </ListItemButton>
                  </ListItem>
                  <Collapse in={docsPerpOpen} timeout="auto" unmountOnExit>
                    <List component="div" disablePadding>
                      {docsPerpItems.map((item) => (
                        <ListItem key={item.text} disablePadding sx={{ pl: 4 }}>
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
            </List>
          </Box>
        </Paper>
      </Drawer>
    </Box>
  );
}
