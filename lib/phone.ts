// Primește un număr scris de om și îl transformă în format internațional românesc.
// Exemple acceptate:
// 0722123456       -> +40722123456
// 0722 123 456     -> +40722123456
// +40 722 123 456  -> +40722123456
// 0040 722 123 456 -> +40722123456

export type PhoneValidationResult = {
  isValid: boolean;
  normalizedPhone: string;
  error?: string;
};

export function normalizeRomanianPhone(rawPhone: string): PhoneValidationResult {
  const trimmedPhone = rawPhone.trim();

  // Telefonul frizerului poate fi lăsat gol pentru moment.
  // Îl permitem, dar nu îl considerăm număr valid propriu-zis.
  if (!trimmedPhone) {
    return {
      isValid: true,
      normalizedPhone: "",
    };
  }

  // Scoatem spații, paranteze și liniuțe, dar păstrăm + dacă există.
  let cleanedPhone = trimmedPhone.replace(/[\s()-]/g, "");

  // Transformăm 0040... în +40...
  if (cleanedPhone.startsWith("0040")) {
    cleanedPhone = `+40${cleanedPhone.slice(4)}`;
  }

  // Transformăm 07... în +407...
  if (cleanedPhone.startsWith("07")) {
    cleanedPhone = `+40${cleanedPhone.slice(1)}`;
  }

  // Transformăm 7... în +407...
  if (cleanedPhone.startsWith("7") && cleanedPhone.length === 9) {
    cleanedPhone = `+40${cleanedPhone}`;
  }

  const romanianMobileRegex = /^\+407\d{8}$/;

  if (!romanianMobileRegex.test(cleanedPhone)) {
    return {
      isValid: false,
      normalizedPhone: "",
      error: "Numărul trebuie să fie mobil românesc, ex: 0722 123 456.",
    };
  }

  return {
    isValid: true,
    normalizedPhone: cleanedPhone,
  };
}