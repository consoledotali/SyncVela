import emailValidator from "deep-email-validator";

export const validateEnterpriseEmail = async (email: string) => {
  const { valid, reason, validators } = await emailValidator({
    email: email,
    validateRegex: true,
    validateMx: false,
    validateTypo: true,
    validateDisposable: true,
    validateSMTP: false,
  });

  if (!valid) {
    // Agar Disposable check fail hua
    if (validators.disposable?.valid === false) {
      throw new Error(
        "Disposable/Temp emails are strictly prohibited. Use a real email.",
      );
    }

    // Baqi general errors ke liye
    throw new Error(`Email validation failed: ${reason}`);
  }

  return true;
};
