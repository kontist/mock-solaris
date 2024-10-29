const getRandomPositiveInteger = (max = 365) =>
  Math.floor(Math.random() * max) + 1;

const getIsoCalendarDate = (date: Date) => date.toISOString().split("T")[0];

const generateDate = () => {
  const today = new Date();
  const randomDays = getRandomPositiveInteger();
  const validUntilDate = new Date(today);
  validUntilDate.setDate(today.getDate() + randomDays);

  return getIsoCalendarDate(validUntilDate);
};

export default generateDate;
