// export const getStatusColor = (expiryDate) => {
//   const today = new Date();
//   const expiry = new Date(expiryDate);
//   const diffTime = expiry - today;
//   const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

//   if (diffDays < 0) return "border-l-4 border-red-500 bg-red-500"; // Просрочен - красный
//   if (diffDays <= 5) return "border-l-4 border-yellow-500 bg-yellow-500"; // Меньше 5 дней - желтый
//   if (diffDays <= 15) return "border-l-4 border-orange-500 bg-orange-500"; // Меньше 15 дней - оранжевый
//   if (diffDays <= 30) return "border-l-4 border-green-500 bg-green-500"; // Меньше 30 дней - зеленый
//   return "border-l-4 border-gray-300"; // Более 30 дней
// };
// Альтернативный вариант getStatusColor для фонового цвета:
export const getStatusColor = (expiryDate) => {
  const today = new Date();
  const expiry = new Date(expiryDate);
  const diffTime = expiry - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return "bg-red-100 border-red-500"; // Просрочен
  if (diffDays <= 5) return "bg-yellow-100 border-yellow-500"; // Меньше 5 дней
  if (diffDays <= 15) return "bg-orange-100 border-orange-500"; // Меньше 15 дней
  if (diffDays <= 30) return "bg-green-100 border-green-500"; // Меньше 30 дней
  return "bg-white border-gray-200"; // Более 30 дней
};

export const getStatusText = (expiryDate) => {
  const today = new Date();
  const expiry = new Date(expiryDate);
  const diffTime = expiry - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return `Просрочен на ${Math.abs(diffDays)} дн.`;
  if (diffDays <= 5) return `Осталось ${diffDays} дн. (менее 5)`;
  if (diffDays <= 15) return `Осталось ${diffDays} дн. (менее 15)`;
  if (diffDays <= 30) return `Осталось ${diffDays} дн. (менее 30)`;
  return `Осталось ${diffDays} дн.`;
};
