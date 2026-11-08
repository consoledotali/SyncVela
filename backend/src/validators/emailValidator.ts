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
    if (validators.disposable?.valid === false) {
      throw new Error(
        "Disposable/Temp emails are strictly prohibited. Use a real email.",
      );
    }

    throw new Error(`Email validation failed: ${reason}`);
  }

  return true;
};
