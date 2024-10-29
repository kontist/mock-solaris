const generateDate = () => {
  const today = new Date();
  const randomDays = Math.floor(Math.random() * 365) + 1; // Random number between 1 and 365
  const validUntilDate = new Date(today);
  validUntilDate.setDate(today.getDate() + randomDays);

  return validUntilDate.toISOString().split("T")[0]; // Format as "YYYY-MM-DD"
};

export default generateDate;
