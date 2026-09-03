import fs from "fs";
import path from "path";
import JSZip from "jszip";

import {
  BCA_BULK_CITIZENSHIP,
  BCA_BULK_LAYANAN_IN_HOUSE,
  BCA_BULK_LAYANAN_OTHER,
  BCA_BULK_PURPOSE,
  BCA_BULK_RESIDENCE,
  MAYBANK_BENEFICIARY_TYPE,
  findIndonesianBank,
} from "@/lib/indonesian-banks";
import { jakartaTodayAsUtcDateOnly } from "@/lib/leave-employment-status";
import { payrollPeriodInclusiveDates } from "@/lib/internal-payroll-period";

export const BCA_DOM_TEMPLATE_PATH = path.join(
  process.cwd(),
  "templates",
  "bca-dom-bulk-transfer.xlsm"
);

const CONVERTER_SHEET = "xl/worksheets/sheet1.xml";
const SHARED_STRINGS = "xl/sharedStrings.xml";
const DATA_START_ROW = 21;
/** Last sample row in the shipped template — always clear through here. */
const TEMPLATE_SAMPLE_LAST_ROW = 67;

export type MaybankBulkTransferRow = {
  beneficiaryName: string;
  accountNumber: string;
  bankName: string | null;
  amount: number;
  /** Berita 1 — project the employee is assigned to. */
  projectName?: string | null;
  /** Berita 2 — payroll window, e.g. 16 July 2026 - 15 August 2026. */
  periodLabel?: string | null;
  remark?: string | null;
  /** 1 individual, 2 company, 3 government. Payroll uses 1. */
  beneficiaryType?: "1" | "2" | "3";
};

export type MaybankBulkTransferResult = {
  buffer: Buffer;
  fileName: string;
  otherBankCount: number;
  inHouseCount: number;
  unmatchedBanks: string[];
};

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export function formatPayrollPeriodBerita(year: number, month: number): string {
  const { start, end } = payrollPeriodInclusiveDates(year, month);
  const label = (date: Date) =>
    date.toLocaleString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
  return `${label(start)} - ${label(end)}`;
}

function beritaCell(column: string, row: number, index: number | null): string {
  if (index == null) return `<c r="${column}${row}" s="23"/>`;
  return `<c r="${column}${row}" s="23" t="s"><v>${index}</v></c>`;
}

function jakartaYmd(date: Date = jakartaTodayAsUtcDateOnly()) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return {
    yyyymmdd: `${year}${month}${day}`,
    ddmmyyyy: `${day}${month}${year}`,
  };
}

function isBcaInHouse(bankId: string | undefined) {
  return bankId === "bca";
}

function receiverName(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLocaleUpperCase("id-ID");
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function unescapeXml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function parseSharedStrings(sstXml: string): string[] {
  const out: string[] = [];
  const siRe = /<si>([\s\S]*?)<\/si>/g;
  let match: RegExpExecArray | null;
  while ((match = siRe.exec(sstXml))) {
    const texts = [...match[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)];
    out.push(texts.map((part) => unescapeXml(part[1])).join(""));
  }
  return out;
}

function internString(
  existing: string[],
  extras: string[],
  value: string
): number {
  const found = existing.indexOf(value);
  if (found >= 0) return found;
  const extraFound = extras.indexOf(value);
  if (extraFound >= 0) return existing.length + extraFound;
  extras.push(value);
  return existing.length + extras.length - 1;
}

function appendSharedStrings(sstXml: string, extras: string[]): string {
  if (extras.length === 0) return sstXml;
  const uniqueMatch = sstXml.match(/uniqueCount="(\d+)"/);
  const countMatch = sstXml.match(/count="(\d+)"/);
  const unique = Number(uniqueMatch?.[1] ?? 0) + extras.length;
  const count = Number(countMatch?.[1] ?? 0) + extras.length;
  let next = sstXml.replace(/uniqueCount="\d+"/, `uniqueCount="${unique}"`);
  next = next.replace(/ count="\d+"/, ` count="${count}"`);
  const close = next.lastIndexOf("</sst>");
  const payload = extras.map((text) => `<si><t>${escapeXml(text)}</t></si>`).join("");
  return next.slice(0, close) + payload + next.slice(close);
}

function rowStart(xml: string, row: number): number {
  const index = xml.indexOf(`<row r="${row}"`);
  if (index < 0) {
    throw new Error(`The BCA Dom template is missing Converter row ${row}.`);
  }
  return index;
}

function emptyRowXml(row: number): string {
  return `<row r="${row}" spans="1:22" s="22" customFormat="1" x14ac:dyDescent="0.3"><c r="B${row}" s="23"/><c r="D${row}" s="23"/><c r="G${row}" s="23"/><c r="H${row}" s="23"/><c r="I${row}" s="60"/><c r="J${row}" s="23"/><c r="K${row}" s="38"/><c r="L${row}" s="23"/><c r="M${row}" s="24"/><c r="N${row}" s="23"/><c r="O${row}" s="23"/><c r="P${row}" s="23"/><c r="Q${row}" s="23"/><c r="R${row}" s="23"/><c r="S${row}" s="60"/><c r="T${row}" s="60"/><c r="U${row}" s="23"/><c r="V${row}" s="23"/></row>`;
}

function internBerita(
  intern: (value: string) => number,
  value: string | null | undefined
): number | null {
  const text = value?.replace(/\s+/g, " ").trim() ?? "";
  if (!text) return null;
  return intern(text);
}

function llgRow(opts: {
  row: number;
  no: number;
  transactionId: number;
  layanan: number;
  account: number;
  name: number;
  amount: number;
  berita1: number | null;
  berita2: number | null;
  swift: number;
  kategori: string;
  citizenship: number;
  purpose: number;
}): string {
  const r = opts.row;
  return `<row r="${r}" spans="1:22" s="22" customFormat="1" x14ac:dyDescent="0.3"><c r="A${r}" s="22"><v>${opts.no}</v></c><c r="B${r}" s="23" t="s"><v>${opts.transactionId}</v></c><c r="C${r}" s="22" t="s"><v>${opts.layanan}</v></c><c r="D${r}" s="23"/><c r="G${r}" s="23"/><c r="H${r}" s="23"/><c r="I${r}" s="23"/><c r="J${r}" s="23"/><c r="K${r}" s="37" t="s"><v>${opts.account}</v></c><c r="L${r}" s="23" t="s"><v>${opts.name}</v></c><c r="M${r}" s="24"><v>${opts.amount}</v></c>${beritaCell("N", r, opts.berita1)}${beritaCell("O", r, opts.berita2)}<c r="P${r}" s="23"/><c r="Q${r}" s="23"/><c r="R${r}" s="23" t="s"><v>${opts.swift}</v></c><c r="S${r}" s="60"><v>${opts.kategori}</v></c><c r="T${r}" s="60"><v>${BCA_BULK_RESIDENCE}</v></c><c r="U${r}" s="23" t="s"><v>${opts.citizenship}</v></c><c r="V${r}" s="23" t="s"><v>${opts.purpose}</v></c></row>`;
}

function bcaRow(opts: {
  row: number;
  no: number;
  transactionId: number;
  layanan: number;
  account: number;
  name: number;
  amount: number;
  berita1: number | null;
  berita2: number | null;
}): string {
  const r = opts.row;
  return `<row r="${r}" spans="1:22" s="22" customFormat="1" x14ac:dyDescent="0.3"><c r="A${r}" s="22"><v>${opts.no}</v></c><c r="B${r}" s="23" t="s"><v>${opts.transactionId}</v></c><c r="C${r}" s="22" t="s"><v>${opts.layanan}</v></c><c r="D${r}" s="23"/><c r="G${r}" s="23"/><c r="H${r}" s="23"/><c r="I${r}" s="60"/><c r="J${r}" s="23"/><c r="K${r}" s="38" t="s"><v>${opts.account}</v></c><c r="L${r}" s="23" t="s"><v>${opts.name}</v></c><c r="M${r}" s="24"><v>${opts.amount}</v></c>${beritaCell("N", r, opts.berita1)}${beritaCell("O", r, opts.berita2)}<c r="P${r}" s="23"/><c r="Q${r}" s="23"/><c r="R${r}" s="23"/><c r="S${r}" s="60"/><c r="T${r}" s="60"/><c r="U${r}" s="23"/><c r="V${r}" s="23"/></row>`;
}

/**
 * Fill the real MBB BCA Dom 5.0 Converter workbook the same way the sample
 * file was filled: other-bank LLG rows first with SWIFT + 1 / 1 / C / Lainnya,
 * then in-house BCA rows. Receiver names are stored in all caps.
 */
export async function buildMaybankBcaDomWorkbook(
  rows: MaybankBulkTransferRow[],
  opts: {
    periodLabel: string;
    fileName?: string;
    sourceAccountNumber?: string | null;
    chargeAccountNumber?: string | null;
    corporateId?: string | null;
    effectiveDate?: Date;
  }
): Promise<MaybankBulkTransferResult> {
  if (!fs.existsSync(BCA_DOM_TEMPLATE_PATH)) {
    throw new Error(
      "BCA Dom bulk-transfer template is missing. Put Template Bulk Transfer MBB - BCA Dom 5.0.xlsm in templates/bca-dom-bulk-transfer.xlsm."
    );
  }

  const { yyyymmdd, ddmmyyyy } = jakartaYmd(opts.effectiveDate);
  const template = fs.readFileSync(BCA_DOM_TEMPLATE_PATH);
  const zip = await JSZip.loadAsync(template);
  const sheetFile = zip.file(CONVERTER_SHEET);
  const sstFile = zip.file(SHARED_STRINGS);
  if (!sheetFile || !sstFile) {
    throw new Error("The BCA Dom template is missing Converter or shared strings.");
  }

  let sheetXml = await sheetFile.async("string");
  let sstXml = await sstFile.async("string");
  const existing = parseSharedStrings(sstXml);
  const extras: string[] = [];
  const intern = (value: string) => internString(existing, extras, value);

  const layananLlg = intern(BCA_BULK_LAYANAN_OTHER);
  const layananBca = intern(BCA_BULK_LAYANAN_IN_HOUSE);
  const citizenship = intern(BCA_BULK_CITIZENSHIP);
  const purpose = intern(BCA_BULK_PURPOSE);
  const dateIndex = intern(yyyymmdd);

  sheetXml = sheetXml.replace(
    /<c r="C8" s="14" t="s"><v>\d+<\/v><\/c>/,
    `<c r="C8" s="14" t="s"><v>${dateIndex}</v></c>`
  );

  const unmatchedBanks: string[] = [];
  const otherRows: MaybankBulkTransferRow[] = [];
  const inHouseRows: MaybankBulkTransferRow[] = [];
  for (const row of rows) {
    const bank = findIndonesianBank(row.bankName);
    if (!bank && row.bankName?.trim()) unmatchedBanks.push(row.bankName.trim());
    if (isBcaInHouse(bank?.id)) inHouseRows.push(row);
    else otherRows.push(row);
  }
  const ordered = [...otherRows, ...inHouseRows];

  const built: string[] = [];
  ordered.forEach((row, index) => {
    const excelRow = DATA_START_ROW + index;
    const bank = findIndonesianBank(row.bankName);
    const inHouse = isBcaInHouse(bank?.id);
    const transactionId = intern(
      `${ddmmyyyy}-${String(index + 1).padStart(3, "0")}`
    );
    const account = intern(digitsOnly(row.accountNumber));
    const name = intern(receiverName(row.beneficiaryName));
    const amount = Math.round(row.amount);
    const berita1 = internBerita(intern, row.projectName);
    const berita2 = internBerita(intern, row.periodLabel);
    if (inHouse) {
      built.push(
        bcaRow({
          row: excelRow,
          no: index + 1,
          transactionId,
          layanan: layananBca,
          account,
          name,
          amount,
          berita1,
          berita2,
        })
      );
      return;
    }
    built.push(
      llgRow({
        row: excelRow,
        no: index + 1,
        transactionId,
        layanan: layananLlg,
        account,
        name,
        amount,
        berita1,
        berita2,
        swift: intern((bank?.swift ?? "").trim()),
        kategori: row.beneficiaryType ?? MAYBANK_BENEFICIARY_TYPE.INDIVIDUAL,
        citizenship,
        purpose,
      })
    );
  });

  const clearTo = Math.max(
    DATA_START_ROW + ordered.length - 1,
    TEMPLATE_SAMPLE_LAST_ROW
  );
  for (let row = DATA_START_ROW + ordered.length; row <= clearTo; row += 1) {
    built.push(emptyRowXml(row));
  }

  const from = rowStart(sheetXml, DATA_START_ROW);
  const until = rowStart(sheetXml, clearTo + 1);
  sheetXml = sheetXml.slice(0, from) + built.join("") + sheetXml.slice(until);

  sstXml = appendSharedStrings(sstXml, extras);
  zip.file(CONVERTER_SHEET, sheetXml);
  zip.file(SHARED_STRINGS, sstXml);

  const buffer = Buffer.from(
    await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    })
  );
  const fileName =
    opts.fileName?.trim() ||
    `Internal Payroll (${opts.periodLabel.replace(/[^\w.-]+/g, "-")}).xlsm`;
  return {
    buffer,
    fileName,
    otherBankCount: otherRows.length,
    inHouseCount: inHouseRows.length,
    unmatchedBanks: [...new Set(unmatchedBanks)],
  };
}
