const vopStartDate = new Date("2025-10-09");

export const isVerificationOfPayeeRequired = (): boolean => {
  const currentDate = new Date();

  return currentDate >= vopStartDate;
};
