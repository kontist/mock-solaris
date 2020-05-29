const generateRandomIban = () => {
  const first8digits = Math.floor(Math.random() * 100000000);
  const second8digits = Math.floor(Math.random() * 100000000);
  const last2digits = Math.floor(Math.random() * 100);
  return `DE89${first8digits}${second8digits}${last2digits}`;
};
export default generateRandomIban;
