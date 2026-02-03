import React, { useState } from "react";
import {
  Container,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Box,
  IconButton,
} from "@mui/material";
import { Edit, Delete } from "@mui/icons-material";
import { useGasSettlements } from "../../hooks/useGasSettlements";
import AddNewPriceGas from "./AddNewPriceGas";

const PriceOfGas = () => {
  const { priceOfGas, loading } = useGasSettlements();
  const [openModal, setOpenModal] = useState(false);
  const [editingPrice, setEditingPrice] = useState(null);

  const formatDate = (dateString) => {
    if (!dateString) return "Настоящее время";
    const date = new Date(dateString);
    return date.toLocaleDateString("ru-RU", {
      month: "long",
      year: "numeric",
    });
  };

  const handleEdit = (price) => {
    setEditingPrice(price);
    setOpenModal(true);
  };

  const handleDelete = async (priceId) => {
    // Реализация удаления
    console.log("Delete price:", priceId);
  };

  if (loading) return <div>Загрузка...</div>;

  return (
    <Container maxWidth="lg">
      <Box sx={{ my: 4 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 3 }}>
          <Typography variant="h4">Цены на газ</Typography>
          <Button
            variant="contained"
            color="primary"
            onClick={() => {
              setEditingPrice(null);
              setOpenModal(true);
            }}
          >
            Добавить новую цену
          </Button>
        </Box>

        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Цена за 1 м³ газа (сум)</TableCell>
                <TableCell>Действует с</TableCell>
                <TableCell>Действует по</TableCell>
                <TableCell align="center">Действия</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {priceOfGas.length > 0 ? (
                priceOfGas.map((price, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      {new Intl.NumberFormat("ru-RU").format(price.price)} сум
                    </TableCell>
                    <TableCell>{formatDate(price.startDate)}</TableCell>
                    <TableCell>{formatDate(price.endDate)}</TableCell>
                    <TableCell align="center">
                      <IconButton
                        size="small"
                        onClick={() => handleEdit(price)}
                        color="primary"
                      >
                        <Edit />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDelete(index)}
                        color="error"
                      >
                        <Delete />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} align="center">
                    <Typography color="textSecondary">
                      Нет данных о ценах
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <AddNewPriceGas
          open={openModal}
          onClose={() => {
            setOpenModal(false);
            setEditingPrice(null);
          }}
          editingPrice={editingPrice}
        />
      </Box>
    </Container>
  );
};

export default PriceOfGas;
