const vopStartDate = new Date("2025-10-09");

export const isVerificationOfPayeeEnabled = (): boolean => {
  const currentDate = new Date();

  return currentDate >= vopStartDate;
};
