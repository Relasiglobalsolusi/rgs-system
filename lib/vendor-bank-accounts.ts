export type VendorBankAccountLabel = {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  label?: string | null;
};

export function formatVendorBankAccountLabel(account: VendorBankAccountLabel) {
  const bank = account.bankName.trim();
  const accountName = account.accountHolder.trim() || account.label?.trim();
  const number = account.accountNumber.trim();
  return [bank, accountName, number].filter(Boolean).join(" · ");
}

export type VendorBankAccountDraft = {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  label: string;
};

export function formHasVendorBankFields(
  formData: FormData,
  namePrefix = ""
): boolean {
  const prefix = namePrefix ? `${namePrefix}vendorBank.` : "vendorBank.";
  for (const key of formData.keys()) {
    if (key.startsWith(prefix)) return true;
  }
  return false;
}

export function parseVendorBankAccountsFromForm(
  formData: FormData,
  namePrefix = ""
): VendorBankAccountDraft[] {
  const prefix = namePrefix ? `${namePrefix}vendorBank.` : "vendorBank.";
  const byIndex = new Map<number, Partial<VendorBankAccountDraft>>();

  for (const [key, value] of formData.entries()) {
    if (!key.startsWith(prefix)) continue;
    const rest = key.slice(prefix.length);
    const [indexRaw, field] = rest.split(".");
    const index = Number(indexRaw);
    if (!Number.isInteger(index) || index < 0) continue;
    const current = byIndex.get(index) ?? {};
    const text = String(value ?? "").trim();
    if (field === "bankName") current.bankName = text;
    if (field === "accountNumber") current.accountNumber = text;
    if (field === "accountHolder") current.accountHolder = text;
    if (field === "label") current.label = text;
    byIndex.set(index, current);
  }

  return [...byIndex.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, row]) => ({
      bankName: row.bankName?.trim() ?? "",
      accountNumber: row.accountNumber?.trim() ?? "",
      accountHolder: row.accountHolder?.trim() ?? "",
      label: row.label?.trim() ?? "",
    }))
    .filter(
      (row) => row.bankName && row.accountNumber && row.accountHolder
    );
}
