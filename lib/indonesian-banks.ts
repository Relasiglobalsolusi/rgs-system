/**
 * Licensed Indonesian banks for payroll / vendor transfers.
 * SWIFT/BIC is the 8-character head-office code (country ID).
 * `biCode` is the 3-digit domestic bank code used for SKN / BI-FAST.
 *
 * Sources: Bank Indonesia / OJK licensed-bank lists, SWIFT directory
 * head-office BICs, and published kode bank tables (2024–2026).
 * Digital-only brands without their own BIC are omitted; pick the licensed bank.
 */
export type IndonesianBank = {
  id: string;
  name: string;
  biCode: string;
  swift: string;
  /** Maybank Indonesia overbooking. BCA Dom in-house is `id === "bca"`. */
  maybankInternal?: boolean;
  aliases: string[];
};

export const MAYBANK_INDONESIA_SWIFT = "IBBKIDJA";

/** Other-bank constants from Template Bulk Transfer MBB - BCA Dom 5.0. */
export const BCA_BULK_LAYANAN_IN_HOUSE = "BCA";
export const BCA_BULK_LAYANAN_OTHER = "LLG";
/** Kewarganegaraan on other-bank rows (WNI). */
export const BCA_BULK_CITIZENSHIP = "C";
/** Tujuan Transaksi on other-bank rows. */
export const BCA_BULK_PURPOSE = "Lainnya";
export const BCA_BULK_RESIDENCE = "1";

/** External (other-bank) Kategori Penerima: 1 individual, 2 company, 3 government. */
export const MAYBANK_BENEFICIARY_TYPE = {
  INDIVIDUAL: "1",
  COMPANY: "2",
  GOVERNMENT: "3",
} as const;

export const INDONESIAN_BANKS: readonly IndonesianBank[] = [
  { id: "mandiri", name: "Bank Mandiri", biCode: "008", swift: "BMRIIDJA", aliases: ["mandiri", "bank mandiri"] },
  { id: "bri", name: "Bank Rakyat Indonesia (BRI)", biCode: "002", swift: "BRINIDJA", aliases: ["bri", "bank rakyat indonesia"] },
  { id: "bca", name: "Bank Central Asia (BCA)", biCode: "014", swift: "CENAIDJA", aliases: ["bca", "bank central asia"] },
  { id: "bni", name: "Bank Negara Indonesia (BNI)", biCode: "009", swift: "BNINIDJA", aliases: ["bni", "bank negara indonesia"] },
  { id: "btn", name: "Bank Tabungan Negara (BTN)", biCode: "200", swift: "BTANIDJA", aliases: ["btn", "bank tabungan negara"] },
  { id: "bsi", name: "Bank Syariah Indonesia (BSI)", biCode: "451", swift: "BSMDIDJA", aliases: ["bsi", "bank syariah indonesia", "mandiri syariah", "bri syariah", "bni syariah"] },
  { id: "cimb", name: "Bank CIMB Niaga", biCode: "022", swift: "BNIAIDJA", aliases: ["cimb", "cimb niaga", "niaga"] },
  { id: "ocbc", name: "Bank OCBC Indonesia", biCode: "028", swift: "NISPIDJA", aliases: ["ocbc", "ocbc nisp", "nisp"] },
  { id: "permata", name: "Permata Bank", biCode: "013", swift: "BBBAIDJA", aliases: ["permata", "permata bank"] },
  { id: "danamon", name: "Bank Danamon", biCode: "011", swift: "BDINIDJA", aliases: ["danamon"] },
  { id: "maybank", name: "Bank Maybank Indonesia", biCode: "016", swift: MAYBANK_INDONESIA_SWIFT, maybankInternal: true, aliases: ["maybank", "bii", "bank internasional indonesia"] },
  { id: "panin", name: "Panin Bank", biCode: "019", swift: "PINBIDJA", aliases: ["panin", "pan indonesia"] },
  { id: "uob", name: "Bank UOB Indonesia", biCode: "023", swift: "UOBBIDJA", aliases: ["uob"] },
  { id: "smbc", name: "Bank SMBC Indonesia", biCode: "213", swift: "SUNIIDJA", aliases: ["smbc", "btpn", "bank tabungan pens"] },
  { id: "mega", name: "Bank Mega", biCode: "426", swift: "MEGAIDJA", aliases: ["mega", "bank mega"] },
  { id: "kb-bukopin", name: "KB Bank (Bukopin)", biCode: "441", swift: "BBUKIDJA", aliases: ["bukopin", "kb bank", "kb bukopin"] },
  { id: "muamalat", name: "Bank Muamalat Indonesia", biCode: "147", swift: "MUABIDJA", aliases: ["muamalat"] },
  { id: "mega-syariah", name: "Bank Mega Syariah", biCode: "506", swift: "MEGAIDJA", aliases: ["mega syariah"] },
  { id: "bca-syariah", name: "Bank BCA Syariah", biCode: "536", swift: "SYCAIDJ1", aliases: ["bca syariah"] },
  { id: "btpn-syariah", name: "Bank BTPN Syariah", biCode: "547", swift: "SUNIIDJA", aliases: ["btpn syariah"] },
  { id: "panin-dubai", name: "Panin Dubai Syariah Bank", biCode: "517", swift: "ATOSIDJ1", aliases: ["panin dubai", "panin syariah"] },
  { id: "aladin", name: "Bank Aladin Syariah", biCode: "947", swift: "NETBIDJA", aliases: ["aladin"] },
  { id: "hsbc", name: "Bank HSBC Indonesia", biCode: "087", swift: "HSBCIDJA", aliases: ["hsbc"] },
  { id: "citi", name: "Citibank Indonesia", biCode: "031", swift: "CITIIDJA", aliases: ["citi", "citibank"] },
  { id: "dbs", name: "Bank DBS Indonesia", biCode: "046", swift: "DBSBIDJA", aliases: ["dbs"] },
  { id: "sc", name: "Standard Chartered Indonesia", biCode: "050", swift: "SCBLIDJA", aliases: ["standard chartered", "stanchart"] },
  { id: "mufg", name: "MUFG Bank", biCode: "042", swift: "BOTKIDJX", aliases: ["mufg", "tokyo mitsubishi", "btm"] },
  { id: "mizuho", name: "Bank Mizuho Indonesia", biCode: "048", swift: "MHCCIDJA", aliases: ["mizuho"] },
  { id: "boc", name: "Bank of China", biCode: "069", swift: "BKCHIDJA", aliases: ["bank of china", "boc"] },
  { id: "bofa", name: "Bank of America", biCode: "033", swift: "BOFAID2X", aliases: ["bank of america", "bofa"] },
  { id: "jpm", name: "JPMorgan Chase Bank", biCode: "032", swift: "CHASIDJX", aliases: ["jpmorgan", "jp morgan", "chase"] },
  { id: "deutsche", name: "Deutsche Bank AG", biCode: "067", swift: "DEUTIDJA", aliases: ["deutsche"] },
  { id: "anz", name: "Bank ANZ Indonesia", biCode: "061", swift: "ANZBIDJX", aliases: ["anz"] },
  { id: "bnp", name: "Bank BNP Paribas Indonesia", biCode: "057", swift: "BNPAIDJA", aliases: ["bnp", "bnp paribas"] },
  { id: "ccb", name: "China Construction Bank Indonesia", biCode: "095", swift: "PCWIDJA", aliases: ["ccb", "china construction"] },
  { id: "icbc", name: "Bank ICBC Indonesia", biCode: "164", swift: "ICBKIDJA", aliases: ["icbc"] },
  { id: "ctbc", name: "Bank CTBC Indonesia", biCode: "949", swift: "CTCBIDJA", aliases: ["ctbc", "chinatrust"] },
  { id: "hana", name: "Bank Hana Indonesia", biCode: "484", swift: "HNBNIDJA", aliases: ["hana", "keb hana"] },
  { id: "shinhan", name: "Bank Shinhan Indonesia", biCode: "152", swift: "SHBKIDJA", aliases: ["shinhan"] },
  { id: "woori", name: "Bank Woori Saudara", biCode: "212", swift: "HVBKIDJA", aliases: ["woori", "saudara"] },
  { id: "ibk", name: "Bank IBK Indonesia", biCode: "945", swift: "IBKOIDJA", aliases: ["ibk", "mnc bank"] },
  { id: "qnb", name: "Bank QNB Indonesia", biCode: "167", swift: "QNBIDJA", aliases: ["qnb"] },
  { id: "sbi", name: "Bank SBI Indonesia", biCode: "498", swift: "SBINDJA", aliases: ["sbi", "state bank of india"] },
  { id: "boi", name: "Bank of India Indonesia", biCode: "146", swift: "BKIDIDJA", aliases: ["bank of india"] },
  { id: "resona", name: "Bank Resona Perdania", biCode: "047", swift: "BPIAIDJA", aliases: ["resona", "perdania"] },
  { id: "sinarmas", name: "Bank Sinarmas", biCode: "153", swift: "SBJKIDJA", aliases: ["sinarmas", "sinar mas"] },
  { id: "jago", name: "Bank Jago", biCode: "542", swift: "ATOSIDJ1", aliases: ["jago", "artos"] },
  { id: "jtrust", name: "J Trust Bank", biCode: "095", swift: "JTICIDJA", aliases: ["j trust", "jtrust"] },
  { id: "maspion", name: "Bank Maspion", biCode: "157", swift: "MASBIDJA", aliases: ["maspion"] },
  { id: "mayapada", name: "Bank Mayapada Internasional", biCode: "097", swift: "MAYAIDJA", aliases: ["mayapada"] },
  { id: "mestika", name: "Bank Mestika Dharma", biCode: "151", swift: "MHESIDJA", aliases: ["mestika"] },
  { id: "nobu", name: "Nobu Bank", biCode: "503", swift: "LFIBIDJ1", aliases: ["nobu", "nationalnobu"] },
  { id: "victoria", name: "Bank Victoria Internasional", biCode: "566", swift: "VICTIDJ1", aliases: ["victoria"] },
  { id: "artha", name: "Bank Artha Graha Internasional", biCode: "037", swift: "ARTGIDJA", aliases: ["artha graha"] },
  { id: "bumi-arta", name: "Bank Bumi Arta", biCode: "076", swift: "BBAIIDJA", aliases: ["bumi arta"] },
  { id: "capital", name: "Bank Capital Indonesia", biCode: "054", swift: "BCIAIDJA", aliases: ["capital"] },
  { id: "ganesha", name: "Bank Ganesha", biCode: "161", swift: "GNESIDJA", aliases: ["ganesha"] },
  { id: "ina", name: "Bank Ina Perdana", biCode: "513", swift: "INAPIDJ1", aliases: ["ina perdana"] },
  { id: "index", name: "Bank Index Selindo", biCode: "555", swift: "RDSIIDJ1", aliases: ["index selindo"] },
  { id: "multiarta", name: "Bank Multiarta Sentosa", biCode: "548", swift: "MASOIDJ1", aliases: ["multiarta"] },
  { id: "sampoerna", name: "Bank Sahabat Sampoerna", biCode: "523", swift: "BDIPIDJ1", aliases: ["sampoerna"] },
  { id: "seabank", name: "Seabank Indonesia", biCode: "535", swift: "KSEBIDJ1", aliases: ["seabank", "sea bank"] },
  { id: "allo", name: "Allo Bank", biCode: "567", swift: "HBBIIDJA", aliases: ["allo"] },
  { id: "amar", name: "Amar Bank", biCode: "531", swift: "LOMAIDJ1", aliases: ["amar"] },
  { id: "neo", name: "Bank Neo Commerce", biCode: "490", swift: "YUDPIDJ1", aliases: ["neo commerce", "bnc"] },
  { id: "oke", name: "Bank Oke Indonesia", biCode: "526", swift: "DKRIIDJ1", aliases: ["oke"] },
  { id: "krom", name: "Krom Bank", biCode: "110", swift: "KSOPIDJ1", aliases: ["krom", "kredivo"] },
  { id: "superbank", name: "Superbank", biCode: "847", swift: "SUPEIDJ1", aliases: ["superbank"] },
  { id: "saqu", name: "Bank Saqu", biCode: "564", swift: "WELAIDJ1", aliases: ["saqu", "welab"] },
  { id: "bjb", name: "Bank BJB", biCode: "110", swift: "PDJBIDJA", aliases: ["bjb", "jabar", "banten bjb"] },
  { id: "bjb-syariah", name: "Bank BJB Syariah", biCode: "425", swift: "SYJBIDJ1", aliases: ["bjb syariah"] },
  { id: "jakarta", name: "Bank Jakarta (Bank DKI)", biCode: "111", swift: "BDKIIDJA", aliases: ["dki", "bank jakarta", "bank dki"] },
  { id: "diy", name: "Bank BPD DIY", biCode: "112", swift: "PDYKIDJA", aliases: ["bpd diy", "bank yogya"] },
  { id: "jateng", name: "Bank Jateng", biCode: "113", swift: "PDJTIDJA", aliases: ["jateng"] },
  { id: "jatim", name: "Bank Jatim", biCode: "114", swift: "BJTMIDJA", aliases: ["jatim"] },
  { id: "jambi", name: "Bank Jambi", biCode: "115", swift: "PDJMIDJA", aliases: ["jambi"] },
  { id: "sumut", name: "Bank Sumut", biCode: "117", swift: "PDSUIDJA", aliases: ["sumut"] },
  { id: "sumsel", name: "Bank Sumsel Babel", biCode: "120", swift: "BSSPIDJA", aliases: ["sumsel", "babel", "sumsel babel"] },
  { id: "lampung", name: "Bank Lampung", biCode: "121", swift: "PDLPIDJ1", aliases: ["lampung"] },
  { id: "kalsel", name: "Bank Kalsel", biCode: "122", swift: "PDKSIDJ1", aliases: ["kalsel"] },
  { id: "kalbar", name: "Bank Kalbar", biCode: "123", swift: "PDKBIDJA", aliases: ["kalbar"] },
  { id: "kaltimtara", name: "Bankaltimtara", biCode: "124", swift: "PDKTIDJA", aliases: ["kaltim", "kaltara", "bankaltimtara"] },
  { id: "kalteng", name: "Bank Kalteng", biCode: "125", swift: "PDKGIDJ1", aliases: ["kalteng"] },
  { id: "sulselbar", name: "Bank Sulselbar", biCode: "126", swift: "PDWSIDJA", aliases: ["sulsel", "sulbar", "sulselbar"] },
  { id: "sulutgo", name: "Bank SulutGo", biCode: "127", swift: "PDNUIDJA", aliases: ["sulut", "sulutgo", "bsg"] },
  { id: "ntb-syariah", name: "Bank NTB Syariah", biCode: "128", swift: "PDNBIDJ1", aliases: ["ntb", "ntb syariah"] },
  { id: "ntt", name: "Bank NTT", biCode: "130", swift: "PDNTIDJ1", aliases: ["ntt"] },
  { id: "maluku", name: "Bank Maluku Malut", biCode: "131", swift: "PDMLIDJ1", aliases: ["maluku", "malut"] },
  { id: "papua", name: "Bank Papua", biCode: "132", swift: "PDPAIDJ1", aliases: ["papua"] },
  { id: "bengkulu", name: "Bank Bengkulu", biCode: "133", swift: "PDBKIDJ1", aliases: ["bengkulu"] },
  { id: "sulteng", name: "Bank Sulteng", biCode: "134", swift: "PDSTIDJ1", aliases: ["sulteng"] },
  { id: "sultra", name: "Bank Sultra", biCode: "135", swift: "PDSRIDJ1", aliases: ["sultra"] },
  { id: "nagari", name: "Bank Nagari", biCode: "129", swift: "PDSBIDJA", aliases: ["nagari", "sumbar"] },
  { id: "aceh", name: "Bank Aceh Syariah", biCode: "116", swift: "PDACIDJ1", aliases: ["aceh"] },
  { id: "bali", name: "Bank BPD Bali", biCode: "129", swift: "ABALIDJA", aliases: ["bali", "bpd bali"] },
  { id: "brk", name: "Bank BRK Syariah", biCode: "119", swift: "PDRIIDJA", aliases: ["brk", "riau", "kepri"] },
  { id: "mandiri-taspen", name: "Bank Mandiri Taspen", biCode: "564", swift: "SIAPIDJ1", aliases: ["taspen", "mantap"] },
  { id: "raya", name: "Bank Raya Indonesia", biCode: "494", swift: "AGTBIDJA", aliases: ["raya", "agribusiness"] },
  { id: "hibank", name: "Hibank", biCode: "484", swift: "HNBNIDJA", aliases: ["hibank"] },
];

function normalizeBankKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\bbank\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function findIndonesianBank(
  value: string | null | undefined
): IndonesianBank | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const exact = INDONESIAN_BANKS.find((bank) => bank.id === raw);
  if (exact) return exact;
  const key = normalizeBankKey(raw);
  if (!key) return null;
  return (
    INDONESIAN_BANKS.find((bank) => {
      if (normalizeBankKey(bank.name) === key) return true;
      return bank.aliases.some((alias) => normalizeBankKey(alias) === key);
    }) ??
    INDONESIAN_BANKS.find((bank) => {
      if (key.includes(normalizeBankKey(bank.name))) return true;
      return bank.aliases.some(
        (alias) => key.includes(normalizeBankKey(alias)) && normalizeBankKey(alias).length >= 3
      );
    }) ??
    null
  );
}

export function indonesianBankSelectOptions() {
  return [...INDONESIAN_BANKS]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((bank) => ({
      value: bank.id,
      label: bank.name,
      swift: bank.swift,
      biCode: bank.biCode,
    }));
}
