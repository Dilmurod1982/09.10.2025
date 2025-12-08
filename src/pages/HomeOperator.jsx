import React, { useState, useEffect } from "react";
import { useAppStore } from "../lib/zustand";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "../firebase/config";
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Alert,
  Divider,
} from "@mui/material";
import {
  LocalGasStation,
  AttachMoney,
  CreditCard,
  AccountBalance,
  TrendingUp,
  People,
  AvTimer,
} from "@mui/icons-material";

function HomeOperator() {
  const userData = useAppStore((state) => state.userData);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchReports = async () => {
      if (
        !userData ||
        userData.role !== "operator" ||
        !userData.stations ||
        userData.stations.length === 0
      ) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");

        // Получаем последние 7 отчетов для станции оператора
        const q = query(
          collection(db, "unifiedDailyReports"),
          where("stationId", "in", userData.stations),
          orderBy("reportDate", "desc"),
          limit(7)
        );

        const querySnapshot = await getDocs(q);
        const reportsData = [];

        querySnapshot.forEach((doc) => {
          reportsData.push({
            id: doc.id,
            ...doc.data(),
          });
        });

        setReports(reportsData);
      } catch (err) {
        console.error("Error fetching reports:", err);
        setError("Ошибка при загрузке отчетов");
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
  }, [userData]);

  // Функция для форматирования даты
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("ru-RU");
  };

  // Функция для форматирования чисел с разделителями
  const formatNumber = (number) => {
    return new Intl.NumberFormat("ru-RU").format(number);
  };

  // Функция для форматирования денежных сумм
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: "UZS",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={3}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  if (!userData || userData.role !== "operator") {
    return (
      <Box p={3}>
        <Alert severity="warning">
          Доступ запрещен. Эта страница предназначена только для операторов.
        </Alert>
      </Box>
    );
  }

  if (reports.length === 0) {
    return (
      <Box p={3}>
        <Alert severity="info">Нет данных по отчетам для вашей станции.</Alert>
      </Box>
    );
  }

  const latestReport = reports[0];

  return (
    <Box p={3}>
      {/* Заголовок */}
      <Typography variant="h4" gutterBottom fontWeight="bold">
        Заправка статистикаси
      </Typography>
      <Typography variant="h6" color="textSecondary" gutterBottom>
        {latestReport.stationName} - Охирги ҳисобот:{" "}
        {formatDate(latestReport.reportDate)}
      </Typography>

      {/* Основная статистика */}
      <Grid container spacing={3} mb={4}>
        {/* Общая сумма наличными */}
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={3}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <AvTimer color="primary" sx={{ fontSize: 40, mr: 2 }} />
                <Box>
                  <Typography color="textSecondary" variant="body2">
                    Автопилот
                  </Typography>
                  <Typography variant="h5" fontWeight="bold">
                    {formatCurrency(
                      latestReport.generalData?.autopilotReading || 0
                    )}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={3}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <AttachMoney color="primary" sx={{ fontSize: 40, mr: 2 }} />
                <Box>
                  <Typography color="textSecondary" variant="body2">
                    Нақд
                  </Typography>
                  <Typography variant="h5" fontWeight="bold">
                    {formatCurrency(latestReport.generalData?.cashAmount || 0)}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Терминалы */}
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={3}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <CreditCard color="secondary" sx={{ fontSize: 40, mr: 2 }} />
                <Box>
                  <Typography color="textSecondary" variant="body2">
                    Терминаллар
                  </Typography>
                  <Typography variant="h6" fontWeight="bold">
                    Uzcard:{" "}
                    {formatCurrency(
                      latestReport.generalData?.uzcardTerminal || 0
                    )}
                  </Typography>
                  <Typography variant="h6" fontWeight="bold">
                    Humo:{" "}
                    {formatCurrency(
                      latestReport.generalData?.humoTerminal || 0
                    )}
                  </Typography>
                  <Typography variant="h6" fontWeight="bold">
                    ЭТ:{" "}
                    {formatCurrency(
                      latestReport.generalData?.electronicPaymentSystem || 0
                    )}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Общая сумма по шлангам */}
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={3}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <LocalGasStation color="success" sx={{ fontSize: 40, mr: 2 }} />
                <Box>
                  <Typography color="textSecondary" variant="body2">
                    Шланглар бўйича сотув
                  </Typography>
                  <Typography variant="h5" fontWeight="bold">
                    {/* {formatCurrency(latestReport.hoseTotalSum || 0)} */}
                    {formatNumber(latestReport.hoseTotalGas || 0)} м³
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    {/* {formatNumber(latestReport.hoseTotalGas || 0)} м³ */}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Партнеры */}
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={3}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <People color="info" sx={{ fontSize: 40, mr: 2 }} />
                <Box>
                  <Typography color="textSecondary" variant="body2">
                    Хамкорлар
                  </Typography>
                  <Typography variant="h5" fontWeight="bold">
                    {formatCurrency(latestReport.partnerTotalAmount || 0)}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    {formatNumber(latestReport.partnerTotalM3 || 0)} м³
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Таблица шлангов */}
        <Grid item xs={12} md={6}>
          <Paper elevation={3} sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom fontWeight="bold">
              Шланглар бўйича сотув
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Шланг</TableCell>
                    <TableCell align="right">Жорий</TableCell>
                    <TableCell align="right">Олдинги</TableCell>
                    <TableCell align="right">Фарқи</TableCell>
                    <TableCell align="right">Сумма</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {latestReport.hoseData?.map((hose, index) => (
                    <TableRow key={index}>
                      <TableCell>{hose.hose}</TableCell>
                      <TableCell align="right">
                        {formatNumber(hose.current)}
                      </TableCell>
                      <TableCell align="right">
                        {formatNumber(hose.prev)}
                      </TableCell>
                      <TableCell align="right">
                        <Chip
                          label={formatNumber(hose.diff)}
                          size="small"
                          color={hose.diff > 0 ? "success" : "default"}
                        />
                      </TableCell>
                      <TableCell align="right">
                        {formatCurrency(hose.sum)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>

        {/* Таблица партнеров */}
        <Grid item xs={12} md={6}>
          <Paper elevation={3} sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom fontWeight="bold">
              Хамкорлар бўйича сотув
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Хамкор</TableCell>
                    <TableCell>Шартнома</TableCell>
                    <TableCell align="right">м³</TableCell>
                    <TableCell align="right">Нархи</TableCell>
                    <TableCell align="right">Сумма</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {latestReport.partnerData?.map((partner, index) => (
                    <TableRow key={index}>
                      <TableCell>{partner.partnerName}</TableCell>
                      <TableCell>{partner.contractNumber}</TableCell>
                      <TableCell align="right">
                        {formatNumber(partner.soldM3)}
                      </TableCell>
                      <TableCell align="right">
                        {formatCurrency(partner.pricePerM3)}
                      </TableCell>
                      <TableCell align="right">
                        {formatCurrency(partner.totalAmount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>

        {/* История отчетов */}
        <Grid item xs={12}>
          <Paper elevation={3} sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom fontWeight="bold">
              Ҳисоботлар тарихи (Охирги 7 кун)
            </Typography>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Сана</TableCell>
                    <TableCell align="right">Нақд</TableCell>
                    <TableCell align="right">Терминаллар</TableCell>
                    <TableCell align="right">Шлангар бўйича</TableCell>
                    <TableCell align="right">Хамкорлар</TableCell>
                    <TableCell align="center">Холати</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {reports.map((report) => (
                    <TableRow key={report.id}>
                      <TableCell>{formatDate(report.reportDate)}</TableCell>
                      <TableCell align="right">
                        {formatCurrency(report.generalData?.cashAmount || 0)}
                      </TableCell>
                      <TableCell align="right">
                        {formatCurrency(
                          (report.generalData?.uzcardTerminal || 0) +
                            (report.generalData?.humoTerminal || 0)
                        )}
                      </TableCell>
                      <TableCell align="right">
                        {formatCurrency(report.hoseTotalSum || 0)}
                      </TableCell>
                      <TableCell align="right">
                        {formatCurrency(report.partnerTotalAmount || 0)}
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={
                            report.status === "completed"
                              ? "Тугаган"
                              : "Процессда"
                          }
                          color={
                            report.status === "completed"
                              ? "success"
                              : "warning"
                          }
                          size="small"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

export default HomeOperator;
