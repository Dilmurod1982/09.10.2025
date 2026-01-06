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

  // Функция для получения названий электронных платежей
  const getPaymentMethodName = (dbFieldName, paymentMethods = []) => {
    const method = paymentMethods.find((m) => m.dbFieldName === dbFieldName);
    return method ? method.name : dbFieldName;
  };

  // Функция для расчета суммы всех электронных платежей (все кроме zhisobot)
  const calculateElectronicPayments = (report) => {
    if (!report.paymentData) return 0;

    // Исключаем zhisobot (наличные) из электронных платежей
    const { zhisobot, ...electronicPayments } = report.paymentData;
    return Object.values(electronicPayments).reduce(
      (sum, amount) => sum + (amount || 0),
      0
    );
  };

  // Функция для получения списка электронных платежей с названиями
  const getElectronicPaymentsList = (report) => {
    if (!report.paymentData || !report.paymentMethods) return [];

    const { zhisobot, ...electronicPayments } = report.paymentData;
    const result = [];

    Object.entries(electronicPayments).forEach(([key, amount]) => {
      if (amount && amount > 0) {
        const name = getPaymentMethodName(key, report.paymentMethods);
        result.push({ key, name, amount });
      }
    });

    return result;
  };

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

        // Определяем текущую дату для поиска актуальных коллекций
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;

        // Определяем текущий квартал
        let currentQuarter;
        if (currentMonth >= 1 && currentMonth <= 3) currentQuarter = "I";
        else if (currentMonth >= 4 && currentMonth <= 6) currentQuarter = "II";
        else if (currentMonth >= 7 && currentMonth <= 9) currentQuarter = "III";
        else currentQuarter = "IV";

        // Пробуем получить данные из текущего и предыдущих кварталов
        const allReports = [];
        const quartersToTry = [
          { quarter: currentQuarter, year: currentYear },
          {
            quarter:
              currentQuarter === "I"
                ? "IV"
                : String(parseInt(currentQuarter) - 1),
            year: currentQuarter === "I" ? currentYear - 1 : currentYear,
          },
          {
            quarter:
              currentQuarter === "I"
                ? "III"
                : currentQuarter === "II"
                ? "I"
                : "II",
            year:
              currentQuarter === "I" || currentQuarter === "II"
                ? currentYear - 1
                : currentYear,
          },
        ];

        for (const { quarter, year } of quartersToTry) {
          const collectionName = `unifiedDailyReports_${quarter}_${year}`;

          try {
            // Пробуем получить данные без сложного запроса сначала
            const reportsRef = collection(db, collectionName);
            const snapshot = await getDocs(reportsRef);

            // Фильтруем локально
            const filteredReports = [];
            snapshot.forEach((doc) => {
              const data = doc.data();
              if (userData.stations.includes(data.stationId)) {
                filteredReports.push({
                  id: doc.id,
                  collection: collectionName,
                  ...data,
                });
              }
            });

            // Сортируем по дате и добавляем в общий массив
            filteredReports.sort(
              (a, b) => new Date(b.reportDate) - new Date(a.reportDate)
            );
            allReports.push(...filteredReports);

            // Если уже набрали достаточно отчетов, выходим из цикла
            if (allReports.length >= 7) {
              break;
            }
          } catch (err) {
            console.warn(
              `Ошибка при загрузке коллекции ${collectionName}:`,
              err.message
            );
            continue;
          }
        }

        // Сортируем все отчеты по дате и берем последние 7
        allReports.sort(
          (a, b) => new Date(b.reportDate) - new Date(a.reportDate)
        );
        const recentReports = allReports.slice(0, 7);

        setReports(recentReports);

        if (recentReports.length === 0) {
          // Если нет отчетов, но пользователь оператор, показываем информационное сообщение
          setError("");
        }
      } catch (err) {
        console.error("Error fetching reports:", err);
        setError("Ошибка при загрузке отчетов. Проверьте консоль для деталей.");
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
        minHeight="400px"
      >
        <CircularProgress />
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
        <Alert severity="info">
          Нет данных по отчетам для вашей станции. Возможно, отчеты еще не
          созданы.
        </Alert>
      </Box>
    );
  }

  const latestReport = reports[0];
  const electronicPayments = getElectronicPaymentsList(latestReport);
  const totalElectronic = calculateElectronicPayments(latestReport);
  const cashAmount = latestReport.paymentData?.zhisobot || 0;
  const totalAllPayments = cashAmount + totalElectronic;

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

      {error && (
        <Box mb={3}>
          <Alert severity="error">{error}</Alert>
        </Box>
      )}

      {/* Основная статистика */}
      <Grid container spacing={3} mb={4}>
        {/* Автопилот */}
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

        {/* Шланги */}
        <Grid item xs={12} sm={6} md={4}>
          <Card elevation={3}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <LocalGasStation color="warning" sx={{ fontSize: 40, mr: 2 }} />
                <Box>
                  <Typography color="textSecondary" variant="body2">
                    Шланглар бўйича сотув
                  </Typography>
                  <Typography variant="h5" fontWeight="bold">
                    {formatNumber(latestReport.hoseTotalGas || 0)} м³
                  </Typography>
                  {/* <Typography variant="body2" color="textSecondary">
                    {formatCurrency(latestReport.hoseTotalSum || 0)}
                  </Typography> */}
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Партнеры */}
        <Grid item xs={12} sm={6} md={4}>
          <Card elevation={3}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <People color="info" sx={{ fontSize: 40, mr: 2 }} />
                <Box>
                  <Typography color="textSecondary" variant="body2">
                    Хамкорлар (Шартнома)
                  </Typography>
                  <Typography variant="h5" fontWeight="bold">
                    {formatNumber(latestReport.partnerTotalM3 || 0)} м³
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    {formatCurrency(latestReport.partnerTotalAmount || 0)}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Общая сумма всех платежей */}
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={3}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <AccountBalance color="info" sx={{ fontSize: 40, mr: 2 }} />
                <Box>
                  <Typography color="textSecondary" variant="body2">
                    Жами маблағ
                  </Typography>
                  <Typography variant="h5" fontWeight="bold">
                    {formatCurrency(totalAllPayments)}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Барча тўлов турлари
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Наличные */}
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={3}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <AttachMoney color="success" sx={{ fontSize: 40, mr: 2 }} />
                <Box>
                  <Typography color="textSecondary" variant="body2">
                    Нақд пул
                  </Typography>
                  <Typography variant="h5" fontWeight="bold">
                    {formatCurrency(cashAmount)}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Z-ҳисобот
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Электронные платежи - сумма */}
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={3}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <CreditCard color="secondary" sx={{ fontSize: 40, mr: 2 }} />
                <Box>
                  <Typography color="textSecondary" variant="body2">
                    Жами электрон
                  </Typography>
                  <Typography variant="h5" fontWeight="bold">
                    {formatCurrency(totalElectronic)}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    {electronicPayments.length} турда
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Детали электронных платежей */}
        <Grid item xs={12} sm={6} md={4}>
          <Card elevation={3}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <TrendingUp color="primary" sx={{ fontSize: 40, mr: 2 }} />
                <Box>
                  <Typography
                    color="textSecondary"
                    variant="body2"
                    gutterBottom
                  >
                    Электрон тўловлар батафсил
                  </Typography>
                  {electronicPayments.length > 0 ? (
                    electronicPayments.map((payment, index) => (
                      <Typography key={index} variant="body2">
                        {payment.name}: {formatCurrency(payment.amount)}
                      </Typography>
                    ))
                  ) : (
                    <Typography variant="body2" color="textSecondary">
                      Электрон тўловлар йўқ
                    </Typography>
                  )}
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
                  {latestReport.partnerData
                    ?.filter((partner) => (partner.soldM3 || 0) > 0) // Показываем только с продажами
                    .map((partner, index) => (
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
                    <TableCell align="right">Нақд (Z)</TableCell>
                    <TableCell align="right">Электрон</TableCell>
                    <TableCell align="right">Жами</TableCell>
                    <TableCell align="right">Шланглар</TableCell>
                    <TableCell align="right">Хамкорлар</TableCell>
                    <TableCell align="center">Холати</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {reports.map((report) => {
                    const reportCash = report.paymentData?.zhisobot || 0;
                    const reportElectronic =
                      calculateElectronicPayments(report);
                    const reportTotal = reportCash + reportElectronic;

                    return (
                      <TableRow key={report.id}>
                        <TableCell>{formatDate(report.reportDate)}</TableCell>
                        <TableCell align="right">
                          {formatCurrency(reportCash)}
                        </TableCell>
                        <TableCell align="right">
                          {formatCurrency(reportElectronic)}
                        </TableCell>
                        <TableCell align="right">
                          {formatCurrency(reportTotal)}
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
                                : report.status === "pending"
                                ? "Кутилмокда"
                                : "Процессда"
                            }
                            color={
                              report.status === "completed"
                                ? "success"
                                : report.status === "pending"
                                ? "warning"
                                : "error"
                            }
                            size="small"
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
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
