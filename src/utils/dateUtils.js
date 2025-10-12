export const getStatusColor = (expiryDate) => {
  const today = new Date();
  const expiry = new Date(expiryDate);
  const diffTime = expiry - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return "red"; // Просрочен
  if (diffDays <= 5) return "yellow"; // Меньше 5 дней
  if (diffDays <= 15) return "orange"; // Меньше 15 дней
  if (diffDays <= 30) return "green"; // Меньше 30 дней
  return "default"; // Более 30 дней
};

export const getStatusText = (expiryDate) => {
  const today = new Date();
  const expiry = new Date(expiryDate);
  const diffTime = expiry - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return "Просрочен";
  if (diffDays <= 5) return "Меньше 5 дней";
  if (diffDays <= 15) return "Меньше 15 дней";
  if (diffDays <= 30) return "Меньше 30 дней";
  return "Действителен";
};
