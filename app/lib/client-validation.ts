/**
 * Client-side validation and debugging utilities
 * Mirrors server-side validation for real-time user feedback
 */

// Debug mode - enable via localStorage: localStorage.setItem('DEBUG_MODE', 'true')
export function isDebugMode(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("DEBUG_MODE") === "true";
}

export function setDebugMode(enabled: boolean): void {
  if (typeof window === "undefined") return;
  if (enabled) {
    localStorage.setItem("DEBUG_MODE", "true");
    console.log("✅ DEBUG MODE ENABLED");
  } else {
    localStorage.removeItem("DEBUG_MODE");
    console.log("❌ DEBUG MODE DISABLED");
  }
}

/**
 * Log error to browser console (only in debug mode)
 */
export function debugLog(type: string, message: string, data?: unknown): void {
  if (!isDebugMode()) return;

  const style = {
    error: "color: #ef4444; font-weight: bold;",
    warning: "color: #f97316; font-weight: bold;",
    info: "color: #3b82f6; font-weight: bold;",
    success: "color: #22c55e; font-weight: bold;",
  };

  const typeStyle = style[type as keyof typeof style] || style.info;
  console.log(`%c[${type.toUpperCase()}] ${message}`, typeStyle, data);
}

/**
 * Validation error type
 */
export interface ValidationError {
  field: string;
  message: string;
}

/**
 * Validate tax ID (Steuernummer): 10 digits
 */
export function validateTaxId(val: string | null | undefined): ValidationError | null {
  if (!val || val === "") return null;
  if (!/^\d{10}$/.test(val)) {
    return { field: "taxId", message: "Steuernummer muss 10 Ziffern haben" };
  }
  return null;
}

/**
 * Validate VAT ID (USt-IdNr): DE + 9 digits
 */
export function validateVatId(val: string | null | undefined): ValidationError | null {
  if (!val || val === "") return null;
  if (!/^DE\d{9}$/.test(val)) {
    return { field: "vatId", message: "USt-IdNr. muss im Format DE + 9 Ziffern sein" };
  }
  return null;
}

/**
 * Validate IBAN
 */
export function validateIban(val: string | null | undefined): ValidationError | null {
  if (!val || val === "") return null;
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{1,30}$/.test(val)) {
    return { field: "bankIban", message: "Ungültige IBAN" };
  }
  return null;
}

/**
 * Validate BIC
 */
export function validateBic(val: string | null | undefined): ValidationError | null {
  if (!val || val === "") return null;
  if (!/^[A-Z0-9]{8,11}$/.test(val)) {
    return { field: "bankBic", message: "Ungültiger BIC" };
  }
  return null;
}

/**
 * Validate website URL
 */
export function validateWebsite(val: string | null | undefined): ValidationError | null {
  if (!val || val === "") return null;
  if (!/^https?:\/\//.test(val)) {
    return { field: "website", message: "Website muss mit http:// oder https:// beginnen" };
  }
  if (val.length > 255) {
    return { field: "website", message: "Website darf maximal 255 Zeichen sein" };
  }
  return null;
}

/**
 * Validate company form data
 */
export interface CompanyFormData {
  name: string;
  address: string;
  zip: string;
  city: string;
  taxId?: string;
  vatId?: string;
  website?: string;
  bankIban?: string;
  bankBic?: string;
  email?: string;
  phone?: string;
  legalForm?: string;
  country?: string;
  bankName?: string;
}

export function validateCompanyForm(
  data: CompanyFormData
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Required fields
  if (!data.name || data.name.trim() === "") {
    errors.push({ field: "name", message: "Firmenname erforderlich" });
  } else if (data.name.length > 255) {
    errors.push({ field: "name", message: "Firmenname darf maximal 255 Zeichen sein" });
  }

  if (!data.address || data.address.trim() === "") {
    errors.push({ field: "address", message: "Adresse erforderlich" });
  } else if (data.address.length > 500) {
    errors.push({ field: "address", message: "Adresse darf maximal 500 Zeichen sein" });
  }

  if (!data.zip || data.zip.trim() === "") {
    errors.push({ field: "zip", message: "PLZ erforderlich" });
  } else if (!/^[\d\s-]*$/.test(data.zip)) {
    errors.push({ field: "zip", message: "PLZ darf nur Zahlen, Bindestriche und Leerzeichen enthalten" });
  } else if (data.zip.length > 20) {
    errors.push({ field: "zip", message: "PLZ darf maximal 20 Zeichen sein" });
  }

  if (!data.city || data.city.trim() === "") {
    errors.push({ field: "city", message: "Stadt erforderlich" });
  } else if (data.city.length > 100) {
    errors.push({ field: "city", message: "Stadt darf maximal 100 Zeichen sein" });
  }

  // Optional fields with validation
  if (data.taxId) {
    const taxError = validateTaxId(data.taxId);
    if (taxError) errors.push(taxError);
  }

  if (data.vatId) {
    const vatError = validateVatId(data.vatId);
    if (vatError) errors.push(vatError);
  }

  if (data.website) {
    const webError = validateWebsite(data.website);
    if (webError) errors.push(webError);
  }

  if (data.bankIban) {
    const ibanError = validateIban(data.bankIban);
    if (ibanError) errors.push(ibanError);
  }

  if (data.bankBic) {
    const bicError = validateBic(data.bankBic);
    if (bicError) errors.push(bicError);
  }

  if (data.email && data.email.trim()) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      errors.push({ field: "email", message: "Ungültige E-Mail-Adresse" });
    }
  }

  if (data.phone && data.phone.length > 20) {
    errors.push({ field: "phone", message: "Telefonnummer darf maximal 20 Zeichen sein" });
  }

  if (data.legalForm && data.legalForm.length > 100) {
    errors.push({ field: "legalForm", message: "Rechtsform darf maximal 100 Zeichen sein" });
  }

  if (data.country && data.country.length > 2) {
    errors.push({ field: "country", message: "Ländercode darf maximal 2 Zeichen sein" });
  }

  if (data.bankName && data.bankName.length > 255) {
    errors.push({ field: "bankName", message: "Bankname darf maximal 255 Zeichen sein" });
  }

  // Debug logging
  if (errors.length > 0) {
    debugLog("warning", `Validation failed: ${errors.length} error(s)`, errors);
  } else {
    debugLog("success", "Validation passed", data);
  }

  return errors;
}

/**
 * Validate API response errors
 */
export function handleApiError(error: unknown, endpoint: string): void {
  debugLog("error", `API Error from ${endpoint}`, error);

  if (error instanceof Response) {
    debugLog("error", `HTTP ${error.status}: ${error.statusText}`, error);
  } else if (error instanceof Error) {
    debugLog("error", error.message, error.stack);
  } else {
    debugLog("error", "Unknown error", error);
  }
}

/**
 * Get error message for a specific field
 */
export function getFieldError(field: string, errors: ValidationError[]): string | null {
  const error = errors.find((e) => e.field === field);
  return error?.message || null;
}

/**
 * Check if field has error
 */
export function hasFieldError(field: string, errors: ValidationError[]): boolean {
  return errors.some((e) => e.field === field);
}
