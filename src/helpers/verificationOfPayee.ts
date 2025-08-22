// Date is set to 6th October for internal testing
// The real final start date is 9th October 2025
const vopStartDate = new Date("2025-10-06");

export const isVerificationOfPayeeRequired = (): boolean => {
  const currentDate = new Date();

  return currentDate >= vopStartDate;
};
