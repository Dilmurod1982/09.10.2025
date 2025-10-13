export const getStatusColor = (expiryDate) => {
  const today = new Date();
  const expiry = new Date(expiryDate);
  const diffTime = expiry - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return "bg-red-200"; // Просрочен
  if (diffDays <= 5) return "bg-yellow-200"; // Меньше 5 дней
  if (diffDays <= 15) return "bg-orange-200"; // Меньше 15 дней
  if (diffDays <= 30) return "bg-green-200"; // Меньше 30 дней
  return "bg-white"; // Более 30 дней
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
