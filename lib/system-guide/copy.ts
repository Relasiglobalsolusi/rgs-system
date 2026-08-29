import type { AppLocale } from "@/lib/i18n/locale";
import type { ModuleKey } from "@/lib/permissions";
import type { SystemGuideModuleCopy } from "@/lib/system-guide/types";

function bilingual(
  en: SystemGuideModuleCopy,
  id: SystemGuideModuleCopy
): Record<AppLocale, SystemGuideModuleCopy> {
  return { en, id };
}

/**
 * How-to copy for every current module. New MODULES keys get a generic
 * fallback in resolve.ts until a pair is added here.
 * Keep this text WinAnsi-safe (no arrows, em dashes, or smart quotes).
 * Button and chip names must match the live UI in en.ts / id.ts.
 */
export const SYSTEM_GUIDE_COPY: Partial<
  Record<ModuleKey, Record<AppLocale, SystemGuideModuleCopy>>
> = {
  dashboard: bilingual(
    {
      purpose:
        "Dashboard is the first page after you sign in. It is a snapshot of today for your role: attendance, counts, recent activity, and projects you can see. Nothing is submitted here.",
      steps: [
        "Open Dashboard from the top of the sidebar.",
        "Read Today's Attendance or My Attendance Today. Labels show Checked in, Checked in and out, or Not checked in yet.",
        "If you are Head Office, read the count cards such as Staff Present Today, Pending Approvals, Active Projects, and Active Employees. A card appears only if that module is on for this login.",
        "Use Progress Report in the attendance block to open live check-in monitoring.",
        "Scroll to Recent Activity for new Progress Reports and leave requests when those modules are on.",
      ],
      remember: [
        "Field staff, Head Office, and client logins see different cards. A missing card means that module is off for this login, not that the page is broken.",
      ],
    },
    {
      purpose:
        "Dasbor adalah halaman pertama setelah masuk. Ini ringkasan hari ini sesuai peran Anda: kehadiran, angka, aktivitas terbaru, dan proyek yang bisa dilihat. Tidak ada yang dikirim dari sini.",
      steps: [
        "Buka Dasbor dari bagian atas sidebar.",
        "Baca Kehadiran Hari Ini atau Kehadiran Saya Hari Ini. Label menunjukkan sudah check-in, sudah check-in dan check-out, atau belum check-in.",
        "Jika Anda Kantor Pusat, baca kartu angka seperti Staf Hadir Hari Ini, Persetujuan Menunggu, Proyek Aktif, dan Karyawan Aktif. Kartu muncul hanya jika modul itu aktif untuk login ini.",
        "Pakai Laporan Progress di blok kehadiran untuk memantau check-in yang berjalan.",
        "Gulir ke Aktivitas Terbaru untuk Laporan Progress dan permintaan cuti baru jika modul itu aktif.",
      ],
      remember: [
        "Staf lapangan, Kantor Pusat, dan login klien melihat kartu yang berbeda. Kartu yang hilang berarti modul itu mati untuk login ini, bukan halaman rusak.",
      ],
    }
  ),

  projects: bilingual(
    {
      purpose:
        "Projects is the job list. Sidebar views are All Projects, Planning, In Progress, Pending Approval, Payment Due, and Completed Projects. Regular Cleaning, Regular Landscaping, and Security stay as one contract and bill by period. One-time jobs (General Cleaning, Facade, and similar) bill by milestone or on completion.",
      steps: [
        "Open Projects. Pick a sidebar view, then use the chips on the page (All, Cleaning, Security, Landscaping, One Time, Internal, and similar) to narrow the list.",
        "Click Add Project. Fill the client, service type, site address with GPS, dates, Contract Price, and Bank Account when the company has bank accounts.",
        "On a Planning job, click Move to In Progress and upload Signed Contract Proof before the crew starts.",
        "Open the project to Assign Staff or Assign Team, then manage equipment, visits, Progress Report, and billing from that page.",
        "When a monthly period is due, open Invoice and Billing and click Reconcile. For General Cleaning or Facade, use Submit for Approval or Send For Review.",
        "After the client approves, the invoice is issued. When money arrives, click Payment Received and confirm with proof. A live Regular contract stays In Progress after a paid month.",
      ],
      remember: [
        "A Completed job is locked. You cannot change the bank account or the price.",
        "On a live Regular job, a new rate or bank account applies only to the next unpaid cycle.",
        "Pending Approval and Payment Due often list billing periods. The live contract can still be In Progress.",
      ],
    },
    {
      purpose:
        "Proyek adalah daftar pekerjaan. Tampilan sidebar: Semua Proyek, Perencanaan, Berjalan, Menunggu Persetujuan, Jatuh Tempo, dan Proyek Selesai. Regular Cleaning, Regular Landscaping, dan Security tetap satu kontrak dan ditagih per periode. Pekerjaan sekali (General Cleaning, Facade, dan sejenisnya) ditagih per tahap atau saat selesai.",
      steps: [
        "Buka Proyek. Pilih tampilan sidebar, lalu pakai chip di halaman (Semua, Cleaning, Security, Landscaping, Sekali, Internal, dan sejenisnya) untuk menyaring.",
        "Klik Tambah Proyek. Isi klien, jenis layanan, alamat lokasi dengan GPS, tanggal, Harga Kontrak, dan Rekening Bank jika perusahaan punya rekening.",
        "Pada pekerjaan Perencanaan, klik Pindah ke Berjalan dan unggah Bukti Kontrak Tertanda sebelum kru mulai.",
        "Buka proyek untuk Tugaskan Staf atau Tugaskan Tim, lalu kelola peralatan, kunjungan, Laporan Progress, dan tagihan dari halaman itu.",
        "Saat periode bulanan jatuh tempo, buka Invoice dan Penagihan lalu klik Rekonsiliasi. Untuk General Cleaning atau Facade, pakai Ajukan Persetujuan atau Kirim Untuk Ditinjau.",
        "Setelah klien setuju, invoice terbit. Saat uang masuk, klik Pembayaran Diterima dan konfirmasi dengan bukti. Kontrak Regular yang masih berjalan tetap Berjalan setelah bulan dilunasi.",
      ],
      remember: [
        "Pekerjaan Selesai terkunci. Rekening dan harga tidak bisa diubah.",
        "Pada Regular yang masih berjalan, tarif atau rekening baru hanya berlaku untuk siklus berikutnya yang belum dibayar.",
        "Menunggu Persetujuan dan Jatuh Tempo sering menampilkan periode tagihan. Kontrak yang masih hidup bisa tetap Berjalan.",
      ],
    }
  ),

  teams: bilingual(
    {
      purpose:
        "Teams are full-time crew groups by service area: General Cleaning, Facade Cleaning, or Landscaping. You put people and equipment on a team, then assign that team to matching jobs.",
      steps: [
        "Open Teams. The first page is Assignment: each team, who is on it, and whether the status is Available or On Site.",
        "Click Add Team. Enter Team Name and Team Type.",
        "Click Members to add or remove people. Only Active Full Time staff who are not already on another operations team can join.",
        "Click Assign Equipment to give warehouse assets that travel with the team to every job.",
        "Open Team Availability to see, month by month, which teams are on a site and which are free.",
        "When starting or filling a project, use Assign Team and pick the team whose Team Type matches the job.",
      ],
      remember: [
        "One person can belong to only one operations team.",
        "You cannot delete a team while it is On Site.",
      ],
    },
    {
      purpose:
        "Tim adalah kelompok kru penuh waktu menurut area layanan: General Cleaning, Facade Cleaning, atau Landscaping. Anda memasukkan orang dan peralatan ke tim, lalu menugaskan tim itu ke pekerjaan yang cocok.",
      steps: [
        "Buka Tim. Halaman pertama adalah Penugasan: tiap tim, anggotanya, dan status Tersedia atau Di Lokasi.",
        "Klik Tambah Tim. Isi Nama Tim dan Jenis Tim.",
        "Klik Anggota untuk menambah atau melepas orang. Hanya staf Aktif Full Time yang belum masuk tim operasi lain yang bisa bergabung.",
        "Klik Tugaskan Peralatan untuk memberi aset gudang yang ikut tim ke setiap pekerjaan.",
        "Buka Ketersediaan Tim untuk melihat, bulan demi bulan, tim mana yang di lokasi dan mana yang bebas.",
        "Saat memulai atau mengisi proyek, pakai Tugaskan Tim dan pilih tim yang Jenis Tim-nya cocok dengan pekerjaan itu.",
      ],
      remember: [
        "Satu orang hanya bisa masuk satu tim operasi.",
        "Tim yang sedang Di Lokasi tidak bisa dihapus.",
      ],
    }
  ),

  progress: bilingual(
    {
      purpose:
        "Progress Report is the daily write-up and photos from the site. There is no approval step. A report is on the project as soon as it is submitted. Managers and the client can only read it.",
      steps: [
        "Open Progress Report. Field staff use My Progress Reports. Managers choose the client (or Internal), then the project.",
        "Cleaning staff: check in with CICO on that project first. The report date is locked to that check-in day.",
        "Click Submit Progress Report. Type the Service Area (for example Lobby), write what was done, and add at least one photo (JPG, PNG, WebP, or GIF, up to 10 MB each). You can send more than one report on the same day.",
        "After you submit, the report shows on that project right away. Progress Report does not appear in Approvals.",
        "To fix a mistake, open Edit on your own report the same day (Jakarta time). You can change the Service Area, notes, or photos. After that day ends, the report is locked.",
        "Managers can Download Progress Report or Download Attendance for a finished day or a finished month on commercial jobs. The current day and the current month cannot be downloaded yet.",
        "On a commercial monthly job, the report is attached to the current billing period. Later Head Office compiles that period. That is billing review, not an approval of each report.",
      ],
      remember: [
        "Cleaning staff who are not marked Exempt From Progress Report must submit at least one report before CICO Check Out.",
        "Only the person who wrote the report can edit it. Managers and clients are view-only.",
        "Contract Security staff can submit without an open CICO. One Time Security still needs check-in. Desk staff at Head Office cannot submit on commercial sites.",
      ],
    },
    {
      purpose:
        "Laporan Progress adalah catatan harian dan foto dari lokasi. Tidak ada langkah persetujuan. Laporan tampil di proyek segera setelah dikirim. Manajer dan klien hanya bisa membacanya.",
      steps: [
        "Buka Laporan Progress. Staf lapangan memakai Laporan Progress Saya. Manajer memilih klien (atau Internal), lalu proyek.",
        "Staf cleaning: check-in dulu lewat CICO di proyek itu. Tanggal laporan terkunci ke hari check-in itu.",
        "Klik Kirim Laporan Progress. Isi Area Layanan (misalnya Lobi), tulis pekerjaan hari itu, dan tambahkan minimal satu foto (JPG, PNG, WebP, atau GIF, maksimal 10 MB per file). Anda boleh mengirim lebih dari satu laporan di hari yang sama.",
        "Setelah dikirim, laporan langsung tampil di proyek itu. Laporan Progress tidak muncul di Persetujuan.",
        "Untuk memperbaiki kesalahan, buka Ubah Laporan Progress pada laporan Anda sendiri di hari yang sama (waktu Jakarta). Anda bisa mengubah Area Layanan, catatan, atau foto. Setelah hari itu berakhir, laporan terkunci.",
        "Manajer dapat Unduh Laporan Progress atau Unduh Kehadiran untuk hari atau bulan yang sudah selesai pada pekerjaan komersial. Hari ini dan bulan berjalan belum bisa diunduh.",
        "Pada pekerjaan bulanan komersial, laporan menempel pada periode tagihan yang sedang berjalan. Nanti Kantor Pusat menyusun periode itu. Itu tinjauan tagihan, bukan persetujuan tiap laporan.",
      ],
      remember: [
        "Staf cleaning yang tidak ditandai Bebas Laporan Progress wajib mengirim minimal satu laporan sebelum Check Out CICO.",
        "Hanya penulis laporan yang bisa mengubahnya. Manajer dan klien hanya bisa melihat.",
        "Staf Security kontrak dapat mengirim tanpa CICO terbuka. Security sekali tetap perlu check-in. Staf meja Kantor Pusat tidak bisa mengirim di lokasi komersial.",
      ],
    }
  ),

  cico: bilingual(
    {
      purpose:
        "CICO is Check In and Check Out. Field staff clock at the job site with GPS and photos. Head Office and Warehouse desk roles use office CICO on the Internal site.",
      steps: [
        "Open CICO. If more than one site is listed, use Select Project.",
        "Be at the site (or at the office for office CICO). Allow location. Take a Check-In Photo with Take / Upload Photo.",
        "Tap Check In. The app records the time and the location. You must be inside the site radius.",
        "Work the shift. Cleaning staff who are not Exempt From Progress Report must submit at least one Progress Report before Check Out.",
        "Take a Check-Out Photo, then tap Check Out. If you leave before shift end, confirm Checking Out Before Shift End. There is no typed reason. A report is sent to the operations manager.",
        "Check Out of the current site before you Check In at another site. Overnight shifts stay on the same shift day until Check Out.",
      ],
      remember: [
        "CICO is only for employee accounts. Client logins cannot use it.",
        "Off-site projects block Check In. A project must have a site location set.",
        "Head Office desk users without field CICO see Preview Mode and cannot clock a site unless they use the admin field preview.",
      ],
    },
    {
      purpose:
        "CICO adalah Check In dan Check Out. Staf lapangan mencatat jam di lokasi dengan GPS dan foto. Peran meja Kantor Pusat dan Gudang memakai CICO kantor di lokasi Internal.",
      steps: [
        "Buka CICO. Jika ada lebih dari satu lokasi, pakai Pilih Proyek.",
        "Berada di lokasi (atau di kantor untuk CICO kantor). Izinkan lokasi. Ambil Foto Check-In dengan Ambil / Unggah Foto.",
        "Ketuk Check In. Aplikasi mencatat waktu dan posisi. Anda harus berada dalam radius lokasi.",
        "Jalankan shift. Staf cleaning yang tidak Bebas Laporan Progress wajib mengirim minimal satu Laporan Progress sebelum Check Out.",
        "Ambil Foto Check-Out, lalu ketuk Check Out. Jika pulang sebelum akhir shift, konfirmasi Check-Out Sebelum Akhir Shift. Tidak ada kolom alasan. Laporan dikirim ke manajer operasi.",
        "Check Out dari lokasi saat ini sebelum Check In di lokasi lain. Shift malam tetap di hari shift yang sama sampai Check Out.",
      ],
      remember: [
        "CICO hanya untuk akun karyawan. Login klien tidak bisa memakainya.",
        "Proyek Off-site memblokir Check In. Proyek harus punya titik lokasi.",
        "Pengguna meja Kantor Pusat tanpa CICO lapangan melihat Mode Pratinjau dan tidak bisa mencatat lokasi kecuali memakai pratinjau lapangan admin.",
      ],
    }
  ),

  pettyCash: bilingual(
    {
      purpose:
        "Advance Cash is the Head Office float. Petty Cash is cash given to a named employee. Prepaid Cards are vehicle fuel, toll, and parking. A position can grant one or both. This is not a supplier invoice list.",
      steps: [
        "Open Advance Cash. Petty Cash lists employees and how much each holds. Open a name to see that employee's balance and history.",
        "To put money in, open Expenses, choose Petty Cash, then immediately choose which employee receives the top-up. That employee's balance goes up.",
        "To spend, open the employee and click Record Spend. Upload the bill, enter the amount, and Charge To a client or project. The spend comes out of that employee's Petty Cash.",
        "A director (or anyone with enough balance) can Transfer Petty Cash to another employee. That reduces the sender and tops up the receiver. It is not a new company expense.",
        "When a part-time backup checks out, their wage floats on Petty Cash as unpaid. Click Pay. The person who claims it has that amount taken from their Petty Cash.",
        "Use the Prepaid Cards tab for vehicle cards. Adding or editing a card is owner-only.",
      ],
      remember: [
        "A spend larger than the float is not blocked. If the balance is below zero, a warning is shown.",
        "Client and vendor logins cannot open Advance Cash.",
        "In Employees → Manage Positions, Advance Cash has Petty Cash and Prepaid Cards underneath. Tick only what that position should open.",
      ],
    },
    {
      purpose:
        "Kas Uang Muka adalah kas bon Kantor Pusat. Kas Kecil adalah uang yang diberikan ke karyawan tertentu. Kartu Prabayar untuk BBM, tol, dan parkir kendaraan. Satu jabatan bisa mendapat salah satu atau keduanya. Ini bukan daftar faktur pemasok.",
      steps: [
        "Buka Kas Uang Muka. Kas Kecil menampilkan daftar karyawan dan saldo masing-masing. Buka nama untuk melihat saldo dan riwayat karyawan itu.",
        "Untuk mengisi, buka Pengeluaran, pilih Kas Kecil, lalu langsung pilih karyawan yang menerima isi ulang. Saldo karyawan itu bertambah.",
        "Untuk belanja, buka karyawan lalu klik Catat Belanja. Unggah nota, isi jumlah, dan Dibebankan Ke klien atau proyek. Belanja diambil dari Kas Kecil karyawan itu.",
        "Direktur (atau siapa pun yang saldonya cukup) bisa Transfer Kas Kecil ke karyawan lain. Saldo pengirim berkurang dan penerima bertambah. Ini bukan pengeluaran perusahaan baru.",
        "Saat cadangan paruh waktu check-out, upahnya mengambang di Kas Kecil sebagai belum dibayar. Klik Bayar. Orang yang mengklaim dipotong Kas Kecil-nya sebesar itu.",
        "Pakai tab Kartu Prabayar untuk kartu kendaraan. Menambah atau mengubah kartu hanya untuk pemilik sistem.",
      ],
      remember: [
        "Belanja lebih besar dari saldo tidak diblokir. Jika saldo di bawah nol, peringatan ditampilkan.",
        "Login klien dan pemasok tidak bisa membuka Kas Uang Muka.",
        "Di Karyawan → Kelola Jabatan, Kas Uang Muka punya Kas Kecil dan Kartu Prabayar di bawahnya. Centang hanya yang jabatan itu boleh buka.",
      ],
    }
  ),

  shifts: bilingual(
    {
      purpose:
        "Shifts is the site roster under Human Resources. Named Shift 1 to Shift 4 (9-hour windows) are used on Regular Cleaning, Regular Landscaping, Security, Parking, and Payroll Management. One-time General or Facade jobs use Assign Staff, Backup Covers, and Double Shift instead of those named windows.",
      steps: [
        "Open Shifts. Choose a client (or Internal), then an In Progress project.",
        "On a named-shift job, click Add Shift. Set Shift Start and Shift End. Up to four shifts. Overlaps are blocked.",
        "Click Assign Staff and put each person on Shift 1, Shift 2, Shift 3, or Shift 4.",
        "For absences, use Backup Covers. For a person covering two windows, use Double Shift.",
        "Save the hours. Field staff then Check In and Check Out in CICO against that day.",
      ],
      remember: [
        "Only In Progress and Pending Approval sites appear. Completed and closed jobs are not listed.",
        "Remove Shift is blocked until staff, backups, and double shifts are cleared from that window.",
      ],
    },
    {
      purpose:
        "Shift adalah roster lokasi di Sumber Daya Manusia. Shift bernama 1 sampai 4 (jendela 9 jam) dipakai pada Regular Cleaning, Regular Landscaping, Security, Parking, dan Payroll Management. Pekerjaan sekali General atau Facade memakai Tugaskan Staf, Cadangan, dan Shift Ganda, bukan jendela bernama itu.",
      steps: [
        "Buka Shift. Pilih klien (atau Internal), lalu proyek yang sedang Berjalan.",
        "Pada pekerjaan dengan shift bernama, klik Tambah Shift. Isi Jam Mulai dan Jam Selesai. Maksimal empat shift. Tumpang tindih diblokir.",
        "Klik Tugaskan Staf dan masukkan tiap orang ke Shift 1, Shift 2, Shift 3, atau Shift 4.",
        "Untuk ketidakhadiran, pakai Cadangan. Jika satu orang menutupi dua jendela, pakai Shift Ganda.",
        "Simpan jam. Staf lapangan lalu Check In dan Check Out di CICO sesuai hari itu.",
      ],
      remember: [
        "Hanya lokasi Berjalan dan Menunggu Persetujuan yang tampil. Pekerjaan selesai atau ditutup tidak terdaftar.",
        "Hapus Shift diblokir sampai staf, cadangan, dan shift ganda dilepas dari jendela itu.",
      ],
    }
  ),

  leaves: bilingual(
    {
      purpose:
        "Leave & Sick is where you ask for time off: Permission or Sick Leave. A manager then decides in Approvals. You cannot edit a request after it is sent.",
      steps: [
        "Open Leave & Sick under Human Resources.",
        "Click New Request. Choose Permission or Sick Leave.",
        "Set Start Date and End Date. Write the Reason. Proof Document is optional for both types (image or PDF).",
        "Click Submit Request. The status becomes Pending.",
        "Watch the Status chip: Pending, Approved, or Rejected. Approved leave can set your employment to On Leave and pause CICO and Progress Report.",
      ],
      remember: [
        "You need an employee profile and an Active status to submit. You cannot submit while you are already On Leave.",
      ],
    },
    {
      purpose:
        "Izin & Sakit adalah tempat mengajukan waktu tidak masuk: Izin atau Sakit. Manajer lalu memutuskan di Persetujuan. Permintaan tidak bisa diubah setelah dikirim.",
      steps: [
        "Buka Izin & Sakit di Sumber Daya Manusia.",
        "Klik Permintaan Baru. Pilih Izin atau Sakit.",
        "Isi Tanggal Mulai dan Tanggal Selesai. Tulis Alasan. Dokumen Bukti bersifat opsional untuk kedua jenis (gambar atau PDF).",
        "Klik Kirim Permintaan. Status menjadi Menunggu.",
        "Pantau chip Status: Menunggu, Disetujui, atau Ditolak. Cuti yang disetujui dapat mengubah status ke Sedang Cuti dan menjeda CICO serta Laporan Progress.",
      ],
      remember: [
        "Anda perlu profil karyawan dan status Aktif untuk mengirim. Anda tidak bisa mengirim saat sudah Sedang Cuti.",
      ],
    }
  ),

  approvals: bilingual(
    {
      purpose:
        "Approvals is the manager inbox. It has three sections on one page: Leave & Sick, Needs Attention (item returns from Transfer Orders), and Material Requests.",
      steps: [
        "Open Approvals.",
        "Under Leave & Sick, open a row you are allowed to decide. Read the dates, reason, and proof. Click Approve or Reject. There is no reject-reason box for leave.",
        "Under Material Requests, read the items and stock. You may add a review note. Approve creates a Transfer Order. Reject sends it back to the requester.",
        "Under Needs Attention, resolve a stuck item return with Write Off Stock, Assign To Project, or Assign To Stock.",
      ],
      remember: [
        "Approving a material request does not issue stock by itself. Warehouse still has to Mark Sent on Transfer Orders.",
      ],
    },
    {
      purpose:
        "Persetujuan adalah kotak masuk manajer. Ada tiga bagian di satu halaman: Izin & Sakit, Perlu Perhatian (retur barang dari Transfer Barang), dan Permintaan Material.",
      steps: [
        "Buka Persetujuan.",
        "Di Izin & Sakit, buka baris yang boleh Anda putuskan. Baca tanggal, alasan, dan bukti. Klik Setujui atau Tolak. Tidak ada kotak alasan penolakan untuk cuti.",
        "Di Permintaan Material, baca item dan stok. Anda boleh menambah catatan tinjauan. Setujui membuat Transfer Barang. Tolak mengembalikannya ke pemohon.",
        "Di Perlu Perhatian, selesaikan retur yang macet dengan Hapus Stok, Tetapkan Ke Proyek, atau Tetapkan Ke Stok.",
      ],
      remember: [
        "Menyetujui permintaan material tidak mengeluarkan stok sendiri. Gudang masih harus Tandai Terkirim di Transfer Barang.",
      ],
    }
  ),

  materialRequests: bilingual(
    {
      purpose:
        "Material Requests is how a site asks the warehouse for catalog goods. This is not a purchase from a supplier. The project is the site you are checked into.",
      steps: [
        "Check In with CICO on the project that needs the goods.",
        "Open Material Requests. Confirm the checked-in project banner.",
        "Click Add Line. Pick the item type, then an in-stock catalog item and a quantity. Add more lines if needed. Notes are optional.",
        "Click Submit Request. Status becomes Requested. An Area Manager or above is auto-approved. Other staff wait in Approvals.",
        "When Approvals accepts it, a Transfer Order is created. Warehouse clicks Mark Sent. On this page, when the transfer is Sent, click Confirm Received (or Did Not Receive).",
      ],
      remember: [
        "You cannot pick another project. You must be checked in.",
        "To buy from a vendor, use Expenses, not this screen.",
        "Cancel is only available while the request is still Requested.",
      ],
    },
    {
      purpose:
        "Permintaan Material adalah cara lokasi meminta barang katalog ke gudang. Ini bukan pembelian ke pemasok. Proyeknya adalah lokasi tempat Anda check-in.",
      steps: [
        "Check In lewat CICO di proyek yang membutuhkan barang.",
        "Buka Permintaan Material. Pastikan banner proyek check-in sudah benar.",
        "Klik Tambah Baris. Pilih jenis item, lalu item katalog yang ada stoknya dan jumlah. Tambah baris lain jika perlu. Catatan bersifat opsional.",
        "Klik Kirim Permintaan. Status menjadi Diminta. Manajer Area ke atas disetujui otomatis. Staf lain menunggu di Persetujuan.",
        "Saat Persetujuan menerima, Transfer Barang dibuat. Gudang klik Tandai Terkirim. Di halaman ini, saat transfer Terkirim, klik Konfirmasi Diterima (atau Tidak Diterima).",
      ],
      remember: [
        "Anda tidak bisa memilih proyek lain. Anda harus sudah check-in.",
        "Untuk membeli ke pemasok, pakai Pengeluaran, bukan layar ini.",
        "Batal hanya tersedia selama permintaan masih Diminta.",
      ],
    }
  ),

  transferOrders: bilingual(
    {
      purpose:
        "Transfer Orders is the warehouse queue for approved Material Requests. You do not create an order by hand. Approve creates it. Mark Sent puts stock in transit. Confirm Received books it to the project.",
      steps: [
        "Open Transfer Orders. Review Pending Send and In Transit, or browse Clients and Internal.",
        "Open the project Warehouse Queue.",
        "Check stock on the card, then click Mark Sent. Status becomes Sent.",
        "The site (or a Transfer Orders user) clicks Confirm Received. The project is charged and the issue appears under Inventory.",
        "If the site clicks Did Not Receive, warehouse can Complete Item Return or send it to Needs Attention for a manager in Approvals.",
      ],
      remember: [
        "This covers every request line type (consumables, chemicals, equipment, vehicles), not only coded equipment.",
        "Confirm Received needs the order to be Sent. If you are not the requester, you must be checked into the destination project.",
      ],
    },
    {
      purpose:
        "Transfer Barang adalah antrean gudang untuk Permintaan Material yang sudah disetujui. Anda tidak membuat pesanan secara manual. Persetujuan yang membuatnya. Tandai Terkirim menaruh stok dalam perjalanan. Konfirmasi Diterima mencatatnya ke proyek.",
      steps: [
        "Buka Transfer Barang. Tinjau Menunggu Kirim dan Dalam Perjalanan, atau telusuri Klien dan Internal.",
        "Buka Antrian Gudang proyek itu.",
        "Cek stok di kartu, lalu klik Tandai Terkirim. Status menjadi Terkirim.",
        "Lokasi (atau pengguna Transfer Barang) klik Konfirmasi Diterima. Proyek dibebankan dan pengeluaran muncul di Inventaris.",
        "Jika lokasi klik Tidak Diterima, gudang dapat Selesaikan Retur Item atau kirim ke Perlu Perhatian untuk manajer di Persetujuan.",
      ],
      remember: [
        "Ini mencakup semua jenis baris permintaan (habis pakai, kimia, peralatan, kendaraan), bukan hanya peralatan berkode.",
        "Konfirmasi Diterima membutuhkan status Terkirim. Jika Anda bukan pemohon, Anda harus check-in di proyek tujuan.",
      ],
    }
  ),

  inventory: bilingual(
    {
      purpose:
        "Inventory is the warehouse view: Stock, Asset List, Vehicles, Project Issues, Stock Receipts, Write-Offs, and Return To Vendor. You do not add catalog items here, and you do not issue stock to a project from this page.",
      steps: [
        "Open Inventory. Use the tabs to pick a view.",
        "New stock comes from Expenses when the expense type is Product (stock). Receipts then show under Stock Receipts.",
        "Project Issues is a read-only ledger. Issues are created when a Transfer Order is Confirm Received.",
        "To sell stock, open Sales and click Generate Sales Invoice (or start Sold Off from the inventory product flow).",
        "On Write-Offs, Area Manager or above can Write Off Stock with a reason. Return To Vendor is Director or owner only.",
      ],
      remember: [
        "Goods Catalog is where item types are created. Inventory follows those catalog lines.",
        "Do not record the same purchase again here. Inventory follows the Expenses bill.",
      ],
    },
    {
      purpose:
        "Inventaris adalah tampilan gudang: Stok, Daftar Aset, Kendaraan, Pengeluaran Proyek, Penerimaan Stok, Penghapusan, dan Retur ke Pemasok. Anda tidak menambah item katalog di sini, dan tidak mengeluarkan stok ke proyek dari halaman ini.",
      steps: [
        "Buka Inventaris. Pakai tab untuk memilih tampilan.",
        "Stok baru masuk dari Pengeluaran saat jenis pengeluaran adalah Produk (stok). Penerimaan lalu tampil di Penerimaan Stok.",
        "Pengeluaran Proyek adalah buku besar hanya-baca. Pengeluaran dibuat saat Transfer Barang dikonfirmasi diterima.",
        "Untuk menjual stok, buka Penjualan dan klik Buat Faktur Penjualan (atau mulai Terjual dari alur produk inventaris).",
        "Di Penghapusan, Manajer Area ke atas dapat Hapus Stok dengan alasan. Retur ke Pemasok hanya Direktur atau pemilik.",
      ],
      remember: [
        "Katalog Barang adalah tempat jenis item dibuat. Inventaris mengikuti baris katalog itu.",
        "Jangan mencatat pembelian yang sama lagi di sini. Inventaris mengikuti tagihan Pengeluaran.",
      ],
    }
  ),

  itemCatalog: bilingual(
    {
      purpose:
        "Goods Catalog is the master list of item types under Administration. The SKU is assigned from the item type. This is not stock. Stock is added when you buy the item in Expenses.",
      steps: [
        "Open Goods Catalog under Administration.",
        "Click Add Item (or Add Bulk / Import Excel). Enter Item Type, Item Name, Unit, and Min Stock if it applies. Save Item. The SKU is assigned automatically.",
        "Item Type cannot be changed later, because the SKU prefix depends on it.",
        "You can later Edit the name, unit, or minimum stock. Deactivate unused items. Delete is blocked or becomes a soft delete when the item has history.",
        "After the catalog line exists, buy stock in Expenses with a Product (stock) expense.",
      ],
      remember: [
        "Inventory has no Add Item button. Create the type here first.",
      ],
    },
    {
      purpose:
        "Katalog Barang adalah daftar induk jenis item di Administrasi. SKU diisi dari jenis item. Ini bukan stok. Stok bertambah saat Anda membeli item di Pengeluaran.",
      steps: [
        "Buka Katalog Barang di Administrasi.",
        "Klik Tambah Item (atau Tambah Massal / Impor Excel). Isi Jenis Item, Nama Item, Satuan, dan Stok Minimum jika perlu. Simpan Item. SKU diisi otomatis.",
        "Jenis Item tidak bisa diubah kemudian, karena awalan SKU bergantung padanya.",
        "Nanti Anda dapat Ubah nama, satuan, atau stok minimum. Nonaktifkan item yang tidak dipakai. Hapus diblokir atau menjadi hapus sementara jika item punya riwayat.",
        "Setelah baris katalog ada, beli stok di Pengeluaran dengan jenis Produk (stok).",
      ],
      remember: [
        "Inventaris tidak punya tombol Tambah Item. Buat jenisnya di sini dulu.",
      ],
    }
  ),

  invoicing: bilingual(
    {
      purpose:
        "Invoice and Billing is customer billing. Open a client, then a project, to compile the period, send it for review, issue the invoice, and collect payment.",
      steps: [
        "Open Invoice and Billing. Choose the client, then the project.",
        "For a monthly contract (Regular Cleaning, Regular Landscaping, Security), wait until the day after the period end. When the row shows Ready to Reconcile, click Reconcile. Keep Amount or Adjust Amount, then Reconcile & Send or Adjust & Send.",
        "For General Cleaning or Facade, use Send For Review (or Submit for Approval on the project). That compiles Progress Reports for the period. It is not an approval of each report.",
        "If the client has a portal, they Approve or Revise in Reconciliation. Approve issues the invoice. If the client has no portal, use Download And Send, then Record Client Response (Approved or Revised).",
        "When the client pays, they click Submit payment, or Head Office clicks Payment Received. If the status is Verifying Payment, Head Office clicks Confirm And Mark Paid.",
        "If tax is required on that period, click Upload Tax Document. Finish or End Contract is blocked while required tax or unpaid invoices are still open.",
      ],
      remember: [
        "A live Regular contract stays In Progress after a paid month. Crew stay assigned until End Contract.",
        "On a final General or Facade part, Approve can mark the project completed at that point, not at payment.",
      ],
    },
    {
      purpose:
        "Invoice dan Penagihan adalah tagihan pelanggan. Buka klien, lalu proyek, untuk menyusun periode, mengirim tinjauan, menerbitkan invoice, dan menagih.",
      steps: [
        "Buka Invoice dan Penagihan. Pilih klien, lalu proyek.",
        "Untuk kontrak bulanan (Regular Cleaning, Regular Landscaping, Security), tunggu hari setelah akhir periode. Saat baris menunjukkan Siap Rekonsiliasi, klik Rekonsiliasi. Pertahankan Jumlah atau Sesuaikan Jumlah, lalu Rekonsiliasi & Kirim atau Sesuaikan & Kirim.",
        "Untuk General Cleaning atau Facade, pakai Kirim Untuk Ditinjau (atau Ajukan Persetujuan di proyek). Itu menyusun Laporan Progress untuk periode itu. Bukan persetujuan tiap laporan.",
        "Jika klien punya portal, mereka Setujui atau Revisi di Rekonsiliasi. Setujui menerbitkan invoice. Jika klien tidak punya portal, pakai Unduh Dan Kirim, lalu Catat Respons Klien (Disetujui atau Direvisi).",
        "Saat klien bayar, mereka klik Kirim pembayaran, atau Kantor Pusat klik Pembayaran Diterima. Jika status Memverifikasi Pembayaran, Kantor Pusat klik Konfirmasi Dan Tandai Lunas.",
        "Jika pajak wajib pada periode itu, klik Unggah Dokumen Pajak. Selesai atau Akhiri Kontrak diblokir selama pajak wajib atau invoice belum lunas masih terbuka.",
      ],
      remember: [
        "Kontrak Regular yang masih berjalan tetap Berjalan setelah bulan dilunasi. Kru tetap ditugaskan sampai Akhiri Kontrak.",
        "Pada bagian akhir General atau Facade, Setujui dapat menandai proyek selesai pada saat itu, bukan saat pembayaran.",
      ],
    }
  ),

  reconciliation: bilingual(
    {
      purpose:
        "Reconciliation is the client and Head Office review inbox before an invoice is issued. It covers Regular CICO reconcile reports, General or Facade Progress Report packages, and Payroll Management wage sheets.",
      steps: [
        "Open Reconciliation.",
        "A client with a portal opens a period, clicks View report, then Approve or Revise. Revise needs a Revision Request Reason and a different Adjusted Amount.",
        "Approve generates the invoice automatically.",
        "Head Office uses the Revised tab when the client asked for a change. Click Approve revision and enter the Revised invoice amount, or Reject revision and Send rejection to client.",
        "If the client has no portal, Head Office uses Record Client Response after sending the report outside the ERP.",
      ],
      remember: [
        "This is not an approval of each Progress Report. The client reviews the compiled period pack.",
        "Reconcile on Invoice and Billing must be done first for a Regular CICO period. Send For Review is the start for General or Facade packs.",
      ],
    },
    {
      purpose:
        "Rekonsiliasi adalah kotak tinjauan klien dan Kantor Pusat sebelum invoice terbit. Mencakup laporan rekonsiliasi CICO Regular, paket Laporan Progress General atau Facade, dan lembar upah Payroll Management.",
      steps: [
        "Buka Rekonsiliasi.",
        "Klien dengan portal membuka periode, klik Lihat laporan, lalu Setujui atau Revisi. Revisi membutuhkan Alasan Permintaan Revisi dan Jumlah Disesuaikan yang berbeda.",
        "Setujui membuat invoice secara otomatis.",
        "Kantor Pusat memakai tab Direvisi saat klien meminta perubahan. Klik Setujui revisi dan isi jumlah invoice revisi, atau Tolak revisi dan Kirim penolakan ke klien.",
        "Jika klien tidak punya portal, Kantor Pusat memakai Catat Respons Klien setelah mengirim laporan di luar ERP.",
      ],
      remember: [
        "Ini bukan persetujuan tiap Laporan Progress. Klien meninjau paket periode yang sudah disusun.",
        "Rekonsiliasi di Invoice dan Penagihan harus selesai dulu untuk periode CICO Regular. Kirim Untuk Ditinjau adalah awal untuk paket General atau Facade.",
      ],
    }
  ),

  purchaseInvoices: bilingual(
    {
      purpose:
        "Expenses is the Head Office book for money going out: supplier bills, stock purchases, Petty Cash top-ups, loan payments, government (BPJS) remittances, and employee payments.",
      steps: [
        "Open Expenses. Click Add Expense.",
        "Choose the Vendor, Invoice Date, Expense Type, line items, tax, Payment Terms, and the paid-from / paid-to accounts.",
        "For stock, use a Product expense and pick catalog items and quantities. The warehouse updates when you save.",
        "Attach the invoice file and tax documents. Missing tax stays visible on the bill.",
        "When you pay the vendor, click Mark Paid, then Confirm Paid. Import bills need the Bank Rate first. Open bills also appear under Payment & Settlement, Payables.",
      ],
      remember: [
        "Do not record the same purchase again inside Inventory. Inventory follows this bill.",
        "Client and vendor logins cannot open Expenses.",
      ],
    },
    {
      purpose:
        "Pengeluaran adalah buku Kantor Pusat untuk uang keluar: tagihan pemasok, pembelian stok, isi ulang Kas Kecil, pembayaran pinjaman, setoran pemerintah (BPJS), dan pembayaran karyawan.",
      steps: [
        "Buka Pengeluaran. Klik Tambah Pengeluaran.",
        "Pilih Pemasok, Tanggal Faktur, Jenis Pengeluaran, baris, pajak, Syarat Pembayaran, dan rekening dari / ke.",
        "Untuk stok, pakai pengeluaran Produk dan pilih item katalog serta jumlah. Gudang terbarui saat Anda menyimpan.",
        "Lampirkan berkas faktur dan dokumen pajak. Pajak yang belum lengkap tetap terlihat di tagihan.",
        "Saat membayar pemasok, klik Tandai Dibayar, lalu Konfirmasi Lunas. Tagihan impor perlu Kurs Bank dulu. Tagihan terbuka juga muncul di Pembayaran dan Pelunasan, Utang.",
      ],
      remember: [
        "Jangan mencatat pembelian yang sama lagi di Inventaris. Inventaris mengikuti tagihan ini.",
        "Login klien dan pemasok tidak bisa membuka Pengeluaran.",
      ],
    }
  ),

  loans: bilingual(
    {
      purpose:
        "Loan is the register of bank and shareholder facilities: the limit, draws, interest, and principal returns. Draws are funding, not revenue.",
      steps: [
        "Open Loan. Click Register Loan. Enter the limit, rate, and dates. Save Loan.",
        "Click Record Draw when money is received. Save Draw.",
        "Pay interest or fees in Expenses. Choose Expense Type Loan, pick the Registered Loan, and choose what the payment is for.",
        "Use Return Principal on the loan when you repay principal. That return is not an expense.",
        "Read outstanding principal and unused limit on the facility before you draw again.",
      ],
      remember: [
        "Register the facility before you link a loan expense to it.",
        "Loan draws do not count as profit on Financial Report.",
      ],
    },
    {
      purpose:
        "Pinjaman adalah daftar fasilitas bank dan pemegang saham: plafon, penarikan, bunga, dan pengembalian pokok. Penarikan adalah pendanaan, bukan pendapatan.",
      steps: [
        "Buka Pinjaman. Klik Daftarkan Pinjaman. Isi plafon, suku bunga, dan tanggal. Simpan Pinjaman.",
        "Klik Catat Penarikan saat uang diterima. Simpan Penarikan.",
        "Bayar bunga atau biaya di Pengeluaran. Pilih Jenis Pengeluaran Pinjaman, pilih Pinjaman Terdaftar, dan pilih tujuan pembayaran.",
        "Pakai Kembalikan Pokok pada pinjaman saat Anda membayar pokok. Pengembalian itu bukan pengeluaran.",
        "Baca pokok tertunggak dan sisa plafon pada fasilitas sebelum menarik lagi.",
      ],
      remember: [
        "Daftarkan fasilitas sebelum menautkan pengeluaran pinjaman ke sana.",
        "Penarikan pinjaman tidak dihitung sebagai laba di Laporan Keuangan.",
      ],
    }
  ),

  bpjs: bilingual(
    {
      purpose:
        "BPJS shows the employer remittance picture for staff who are enrolled: Kesehatan and Ketenagakerjaan (company share and employee share). Payment is recorded in Expenses, not on this page.",
      steps: [
        "Enroll staff on the employee record (BPJS Kesehatan, BPJS Ketenagakerjaan). Part-time staff are not enrolled.",
        "Open BPJS. Review the employee list and Company Share.",
        "To pay, open Expenses, click Add Expense, choose Government, fill the BPJS fields, then Mark Paid.",
        "Return to BPJS to confirm the programme row shows Paid, or open the linked expense.",
        "Employee share is deducted on Internal Payroll. This page tracks the company payable.",
      ],
      remember: [
        "If a line looks wrong, fix the employee flags and pay first, then come back here.",
      ],
    },
    {
      purpose:
        "BPJS menampilkan gambaran setoran pemberi kerja untuk staf yang terdaftar: Kesehatan dan Ketenagakerjaan (bagian perusahaan dan bagian karyawan). Pembayaran dicatat di Pengeluaran, bukan di halaman ini.",
      steps: [
        "Daftarkan staf di catatan karyawan (BPJS Kesehatan, BPJS Ketenagakerjaan). Staf paruh waktu tidak didaftarkan.",
        "Buka BPJS. Tinjau daftar karyawan dan Bagian Perusahaan.",
        "Untuk membayar, buka Pengeluaran, klik Tambah Pengeluaran, pilih Pemerintah, isi kolom BPJS, lalu Tandai Dibayar.",
        "Kembali ke BPJS untuk memastikan baris program menunjukkan Lunas, atau buka pengeluaran tertaut.",
        "Bagian karyawan dipotong di Payroll Internal. Halaman ini menampilkan utang perusahaan.",
      ],
      remember: [
        "Jika baris terlihat salah, perbaiki tanda dan gaji karyawan dulu, lalu kembali ke sini.",
      ],
    }
  ),

  sales: bilingual(
    {
      purpose:
        "Sales is the invoice list for goods you sold from inventory. Each sale creates a sales invoice PDF. Payment proof and tax follow the same document rules as other bills.",
      steps: [
        "Open Sales. Each row is a sold-off event.",
        "To create a sale, click Generate Sales Invoice, or start Sold Off from Inventory. Pick the goods, the buyer, and the amounts.",
        "Open a sale to see the buyer, amounts, tax, and documents. Attach missing files with Save Documents.",
        "When the buyer pays, upload payment proof. Status chips show open versus paid.",
        "Click Download Sales Report when Finance needs a month or year pack.",
      ],
      remember: [
        "A company bank account must exist in Company Details before an invoice can be generated.",
        "Selling reduces warehouse stock.",
      ],
    },
    {
      purpose:
        "Penjualan adalah daftar invoice barang yang Anda jual dari inventaris. Setiap penjualan membuat PDF faktur penjualan. Bukti bayar dan pajak mengikuti aturan dokumen tagihan lain.",
      steps: [
        "Buka Penjualan. Setiap baris adalah peristiwa terjual.",
        "Untuk membuat penjualan, klik Buat Faktur Penjualan, atau mulai Terjual dari Inventaris. Pilih barang, pembeli, dan jumlah.",
        "Buka penjualan untuk melihat pembeli, jumlah, pajak, dan dokumen. Lampirkan berkas yang kurang dengan Simpan Dokumen.",
        "Saat pembeli membayar, unggah bukti bayar. Chip status menunjukkan terbuka atau lunas.",
        "Klik Unduh Laporan Penjualan jika Keuangan membutuhkan paket bulan atau tahun.",
      ],
      remember: [
        "Rekening bank perusahaan harus ada di Detail Perusahaan sebelum faktur dapat dibuat.",
        "Penjualan mengurangi stok gudang.",
      ],
    }
  ),

  taxInvoices: bilingual(
    {
      purpose:
        "Tax is the tax document workspace: Output VAT (customer), Input VAT (purchases), Income Tax, and Other Tax. It stores serial numbers and files so periods can close.",
      steps: [
        "Open Tax. Pick the month and year. Use the tabs Output VAT, Input VAT, Income Tax, and Other Tax.",
        "Open a period or a purchase that still needs a serial number or a file.",
        "Enter the official tax invoice serial and attach the PDF or image.",
        "You can also Upload Tax Document from Invoice and Billing on that period.",
        "Download the tax report from the toolbar when you need a pack.",
      ],
      remember: [
        "End Contract or Finish is blocked while required tax on issued or paid periods is still missing.",
      ],
    },
    {
      purpose:
        "Pajak adalah ruang kerja dokumen pajak: PPN Keluaran (pelanggan), PPN Masukan (pembelian), Pajak Penghasilan, dan Pajak Lain. Menyimpan nomor seri dan berkas agar periode dapat ditutup.",
      steps: [
        "Buka Pajak. Pilih bulan dan tahun. Pakai tab PPN Keluaran, PPN Masukan, Pajak Penghasilan, dan Pajak Lain.",
        "Buka periode atau pembelian yang masih membutuhkan nomor seri atau berkas.",
        "Isi nomor seri faktur pajak resmi dan lampirkan PDF atau gambar.",
        "Anda juga dapat Unggah Dokumen Pajak dari Invoice dan Penagihan pada periode itu.",
        "Unduh laporan pajak dari bilah alat jika Anda membutuhkan paketnya.",
      ],
      remember: [
        "Akhiri Kontrak atau Selesai diblokir selama pajak wajib pada periode terbit atau lunas masih kosong.",
      ],
    }
  ),

  vendorPayments: bilingual(
    {
      purpose:
        "Payment & Settlement has two lists: Collections (unpaid client invoices) and Payables (open supplier bills). Head Office sees both. A client portal sees Collections only.",
      steps: [
        "Open Payment & Settlement.",
        "For supplier bills, open Payables. An overdue chip means the due date has passed. Click Mark Paid (or open the bill in Expenses), attach proof, then Confirm Paid.",
        "Import bills that still need a Bank Rate must have that rate before you can Confirm Paid.",
        "For customer invoices, open Collections, then Open Invoice & Billing on that project. The client clicks Submit payment, or Head Office clicks Payment Received, then Confirm And Mark Paid if the payment is still being verified.",
      ],
      remember: [
        "Paid supplier bills leave the Payables list. Reverse only if the payment was posted by mistake.",
      ],
    },
    {
      purpose:
        "Pembayaran dan Pelunasan punya dua daftar: Penagihan (invoice klien belum lunas) dan Utang (tagihan pemasok terbuka). Kantor Pusat melihat keduanya. Portal klien hanya melihat Penagihan.",
      steps: [
        "Buka Pembayaran dan Pelunasan.",
        "Untuk tagihan pemasok, buka Utang. Chip terlambat berarti tanggal jatuh tempo sudah lewat. Klik Tandai Dibayar (atau buka tagihan di Pengeluaran), lampirkan bukti, lalu Konfirmasi Lunas.",
        "Tagihan impor yang masih butuh Kurs Bank harus diisi kursnya sebelum dapat Konfirmasi Lunas.",
        "Untuk invoice pelanggan, buka Penagihan, lalu Buka Invoice dan Penagihan pada proyek itu. Klien klik Kirim pembayaran, atau Kantor Pusat klik Pembayaran Diterima, lalu Konfirmasi dan Tandai Lunas jika pembayaran masih diverifikasi.",
      ],
      remember: [
        "Tagihan pemasok yang lunas keluar dari daftar Utang. Batalkan hanya jika pembayaran tercatat karena kesalahan.",
      ],
    }
  ),

  thr: bilingual(
    {
      purpose:
        "THR is the religious holiday allowance for eligible staff. Amounts come from base pay and tenure. Generate it in the official window before Idul Fitri.",
      steps: [
        "Set Base Pay and hire dates on the employee record first.",
        "Open THR. Inside the generate window (15 days before Idul Fitri) the list can generate when you open the page, or click Generate THR For the year.",
        "Review tenure and THR Amount. If a line is wrong, fix the hire date or pay, then come back.",
        "After the bank transfer, click Mark Paid on the row. You can also pay THR from Expenses under Employee Payments.",
        "Click Download THR Report when payroll needs a pack.",
      ],
      remember: [
        "Manual generate is blocked outside the official window.",
        "Staff become eligible after one full month of service.",
      ],
    },
    {
      purpose:
        "THR adalah tunjangan hari raya untuk staf yang berhak. Jumlahnya dari gaji pokok dan masa kerja. Generate di jendela resmi sebelum Idul Fitri.",
      steps: [
        "Atur Gaji Pokok dan tanggal masuk di catatan karyawan terlebih dahulu.",
        "Buka THR. Di dalam jendela generate (15 hari sebelum Idul Fitri) daftar dapat dibuat saat Anda membuka halaman, atau klik Buat THR Untuk tahun itu.",
        "Tinjau masa kerja dan Jumlah THR. Jika baris salah, perbaiki tanggal masuk atau gaji, lalu kembali.",
        "Setelah transfer bank, klik Tandai Dibayar pada baris. Anda juga dapat membayar THR dari Pengeluaran di Pembayaran Karyawan.",
        "Klik Unduh Laporan THR jika payroll membutuhkan paketnya.",
      ],
      remember: [
        "Generate manual diblokir di luar jendela resmi.",
        "Staf berhak setelah satu bulan penuh bekerja.",
      ],
    }
  ),

  payroll: bilingual(
    {
      purpose:
        "Internal Payroll is Relasi Global Solusi staff pay. Complete CICO days are filled automatically (daily rate is base pay divided by 26 for a 9-hour day). Payslips is a separate sidebar page in the same module.",
      steps: [
        "Open Internal Payroll. Select the Payroll Period (the 16th to the 15th window).",
        "Review Days In This Period. For a short day, choose Full Pay or Custom Amount, then Save Custom Amount.",
        "Click Add Deduction if Head Office or the client sent a cut, then Save Deduction. Employee BPJS share is applied from the employee record.",
        "After the 16th, the period shows Reconciled on the 16th. Before that it is Preview.",
        "Click Generate PDF to lock the period and issue the official payslip. Staff open Payslips to download their slip.",
      ],
      remember: [
        "This is not client Payroll Management billing. That lives under Invoice and Billing for Payroll Management projects.",
        "A locked period cannot be edited until Head Office uses Unlock Period with a reason.",
      ],
    },
    {
      purpose:
        "Payroll Internal adalah gaji staf Relasi Global Solusi. Hari CICO lengkap diisi otomatis (tarif harian adalah gaji pokok dibagi 26 untuk hari 9 jam). Slip Gaji adalah halaman sidebar terpisah di modul yang sama.",
      steps: [
        "Buka Payroll Internal. Pilih Periode Payroll (jendela tanggal 16 sampai 15).",
        "Tinjau Hari Dalam Periode Ini. Untuk hari pendek, pilih Bayar Penuh atau Jumlah Khusus, lalu Simpan Jumlah Khusus.",
        "Klik Tambah Potongan jika Kantor Pusat atau klien mengirim potongan, lalu Simpan Potongan. Bagian BPJS karyawan diambil dari catatan karyawan.",
        "Setelah tanggal 16, periode menampilkan Direkonsiliasi pada tanggal 16. Sebelum itu statusnya Pratinjau.",
        "Klik Buat PDF untuk mengunci periode dan menerbitkan slip resmi. Staf membuka Slip Gaji untuk mengunduh slip mereka.",
      ],
      remember: [
        "Ini bukan tagihan Payroll Management klien. Itu ada di Invoice dan Penagihan untuk proyek Payroll Management.",
        "Periode terkunci tidak bisa diubah sampai Kantor Pusat memakai Buka Periode dengan alasan.",
      ],
    }
  ),

  financialReport: bilingual(
    {
      purpose:
        "Financial Report is computed profit for the company, a client, or a project: money in minus money out, for the month or year you pick. You cannot type a balancing figure here.",
      steps: [
        "Open Financial Report. Set Year, Period (one month or Whole Year), and Report (General or a client).",
        "Read Period Profit and the other cards (revenue, expenses, receivables, payables, inventory, wages, THR, BPJS, loan interest).",
        "Open a client, then a project, for the job-level detail.",
        "Click Download Financial Report when management needs a pack. Transfer Report is a separate download on the same page.",
        "If a number looks wrong, fix the source invoice, expense, or payroll period, then reopen this page.",
      ],
      remember: [
        "Loan draws are funding, not revenue.",
        "Wages follow the 16th to 15th payroll window. Income on this report follows the calendar period you picked.",
      ],
    },
    {
      purpose:
        "Laporan Keuangan adalah laba yang dihitung untuk perusahaan, klien, atau proyek: uang masuk dikurangi uang keluar, untuk bulan atau tahun yang Anda pilih. Anda tidak bisa mengetik angka penyeimbang di sini.",
      steps: [
        "Buka Laporan Keuangan. Atur Tahun, Periode (satu bulan atau Satu Tahun), dan Laporan (Umum atau sebuah klien).",
        "Baca Laba Periode dan kartu lain (pendapatan, pengeluaran, piutang, utang, inventaris, gaji, THR, BPJS, bunga pinjaman).",
        "Buka klien, lalu proyek, untuk rincian tingkat pekerjaan.",
        "Klik Unduh Laporan Keuangan jika manajemen membutuhkan paketnya. Laporan Transfer adalah unduhan terpisah di halaman yang sama.",
        "Jika angka terasa salah, perbaiki invoice, pengeluaran, atau periode payroll sumber, lalu buka lagi halaman ini.",
      ],
      remember: [
        "Penarikan pinjaman adalah pendanaan, bukan pendapatan.",
        "Gaji mengikuti jendela payroll tanggal 16 sampai 15. Pendapatan di laporan ini mengikuti periode kalender yang Anda pilih.",
      ],
    }
  ),

  clients: bilingual(
    {
      purpose:
        "Clients is the customer list: legal name, contacts, tax IDs, portal intent, and which jobs belong to them.",
      steps: [
        "Open Clients under Administration. Switch Active or Deleted. Use Search clients.",
        "Click Add Client (or Add Bulk). Fill the legal name, Client ID, contacts, tax IDs, and Will This Client Have A Portal Login (Yes or No).",
        "Click a row to open Edit Client. Use Multi-Project Access when one login should see several sites.",
        "On an active row, click Delete to move the client to Deleted. Restore from Deleted if that was a mistake. Permanently Delete only if there are no linked projects.",
        "A project picks its client when you create the job. Fix the client here. Do not create a second customer for the same company.",
      ],
      remember: [
        "Delete is blocked while open projects, unsettled billing, or pending tax invoices exist.",
        "After restore, the linked login stays off until Users, Revoked Access, Restore Access.",
      ],
    },
    {
      purpose:
        "Klien adalah daftar pelanggan: nama legal, kontak, NPWP, rencana portal, dan pekerjaan yang menjadi milik mereka.",
      steps: [
        "Buka Klien di Administrasi. Ganti Aktif atau Dihapus. Pakai Cari klien.",
        "Klik Tambah Klien (atau Tambah Massal). Isi nama legal, ID Klien, kontak, NPWP, dan Apakah Klien Ini Akan Memiliki Login Portal (Ya atau Tidak).",
        "Klik baris untuk membuka Ubah Klien. Pakai Akses Multi-Proyek jika satu login harus melihat beberapa lokasi.",
        "Pada baris aktif, klik Hapus untuk memindahkan klien ke Dihapus. Pulihkan dari Dihapus jika itu kesalahan. Hapus Permanen hanya jika tidak ada proyek tertaut.",
        "Proyek memilih klien saat pekerjaan dibuat. Perbaiki klien di sini. Jangan membuat pelanggan kedua untuk perusahaan yang sama.",
      ],
      remember: [
        "Hapus diblokir selama masih ada proyek terbuka, tagihan belum selesai, atau faktur pajak menunggu.",
        "Setelah pulihkan, login tertaut tetap mati sampai Pengguna, Akses Dicabut, Pulihkan Akses.",
      ],
    }
  ),

  vendors: bilingual(
    {
      purpose:
        "Vendors is the Head Office supplier list and their bank accounts, used on Expenses. There is no vendor portal.",
      steps: [
        "Open Vendors under Administration. Switch Active or Deleted.",
        "Click Add Vendor. Choose Vendor Type: Company, Individual, or Overseas.",
        "Fill tax IDs when the vendor is Indonesian. Overseas suppliers do not use a local NPWP.",
        "Under Bank Accounts, click Add Bank Account. At least one account is required when you create the vendor.",
        "Click Delete to move a vendor you no longer use to Deleted. History on old bills stays. Permanently Delete follows the same empty-history rules as other directories.",
      ],
      remember: [
        "Delete is blocked while outstanding payables or pending tax invoices exist.",
        "On Expenses, match the vendor type to the purchase origin: local uses Company or Individual, import uses Overseas.",
      ],
    },
    {
      purpose:
        "Pemasok adalah daftar pemasok Kantor Pusat dan rekening bank mereka, dipakai di Pengeluaran. Tidak ada portal pemasok.",
      steps: [
        "Buka Pemasok di Administrasi. Ganti Aktif atau Dihapus.",
        "Klik Tambah Pemasok. Pilih Jenis Pemasok: Perusahaan, Perorangan, atau Luar Negeri.",
        "Isi NPWP jika pemasok Indonesia. Pemasok luar negeri tidak memakai NPWP lokal.",
        "Di Rekening Bank, klik Tambah Rekening Bank. Minimal satu rekening wajib saat Anda membuat pemasok.",
        "Klik Hapus untuk memindahkan pemasok yang tidak dipakai ke Dihapus. Riwayat tagihan lama tetap ada. Hapus Permanen mengikuti aturan riwayat kosong seperti direktori lain.",
      ],
      remember: [
        "Hapus diblokir selama masih ada utang terbuka atau faktur pajak menunggu.",
        "Di Pengeluaran, cocokkan jenis pemasok dengan asal pembelian: lokal memakai Perusahaan atau Perorangan, impor memakai Luar Negeri.",
      ],
    }
  ),

  users: bilingual(
    {
      purpose:
        "Users is portal logins: who can sign in, which modules they have, and whether access is revoked. Vendor logins are not listed here.",
      steps: [
        "Open Users under Administration. Pick Active, No Portal Login, Revoked Access, Deleted Client, or Deleted Employee. You can also filter All, Admin, Client, or Employee.",
        "Click Permissions on a row to turn modules on or off for that one person. Click Save Permissions. Reset To Defaults clears custom overrides and uses the position or account baseline again.",
        "Click Revoke Access when someone must not log in, but the employee or client record should stay.",
        "From Revoked Access, click Restore Access when they should be allowed in again.",
        "If they do not have a login yet, open No Portal Login and click Generate Portal Login.",
      ],
      remember: [
        "Position defaults apply to new logins. Changing a position later does not rewrite every existing user. Use Permissions for one person.",
        "You cannot revoke or delete your own account.",
      ],
    },
    {
      purpose:
        "Pengguna adalah login portal: siapa yang dapat masuk, modul yang mereka punya, dan apakah akses dicabut. Login pemasok tidak tercantum di sini.",
      steps: [
        "Buka Pengguna di Administrasi. Pilih Aktif, Tanpa Login Portal, Akses Dicabut, Klien Dihapus, atau Karyawan Dihapus. Anda juga dapat saring Semua, Admin, Klien, atau Karyawan.",
        "Klik Izin Akses pada baris untuk mengaktifkan atau mematikan modul bagi satu orang. Klik Simpan Izin. Kembali Ke Bawaan menghapus pengganti khusus dan memakai baseline jabatan atau akun lagi.",
        "Klik Cabut Akses jika seseorang tidak boleh login, tetapi catatan karyawan atau klien tetap ada.",
        "Dari Akses Dicabut, klik Pulihkan Akses jika mereka boleh masuk lagi.",
        "Jika mereka belum punya login, buka Tanpa Login Portal dan klik Buat Login Portal.",
      ],
      remember: [
        "Bawaan jabatan berlaku untuk login baru. Mengubah jabatan kemudian tidak menulis ulang semua pengguna. Pakai Izin Akses untuk satu orang.",
        "Anda tidak bisa mencabut atau menghapus akun sendiri.",
      ],
    }
  ),

  employees: bilingual(
    {
      purpose:
        "Employees is the people list: hire details, department, position, pay, BPJS flags, and whether they have a portal login. Default modules for a new login come from the position.",
      steps: [
        "Open Employees under Administration. Use All Employees, Full Time, Part Time, Unassigned, or Deleted. Filter by department and by All, On Leave, or Applying for Leave.",
        "Click Add Employee. Fill identity, department, position, and pay. Portal login is optional. After create, manage the login in Users.",
        "Click Manage Positions to set Default Module Access, then Download System Guide for that job.",
        "Click a row to Edit Employee: bank, BPJS Kesehatan, BPJS Ketenagakerjaan, Exempt From CICO, and Exempt From Progress Report.",
        "Resign is Head Office only. Delete moves the person to Deleted and is blocked while they are still assigned to a project. Restore or Permanently Delete from Deleted.",
      ],
      remember: [
        "Changing a position does not rewrite an existing login. Use Users, Permissions for one person.",
        "Placement (Available, On Project, Head Office) is set by Assign and Release, not as a free field on create.",
      ],
    },
    {
      purpose:
        "Karyawan adalah daftar orang: data masuk kerja, departemen, jabatan, gaji, tanda BPJS, dan apakah mereka punya login portal. Modul bawaan untuk login baru berasal dari jabatan.",
      steps: [
        "Buka Karyawan di Administrasi. Pakai Semua Karyawan, Full Time, Paruh Waktu, Belum Ditugaskan, atau Dihapus. Saring menurut departemen dan Semua, Sedang Cuti, atau Mengajukan Cuti.",
        "Klik Tambah Karyawan. Isi identitas, departemen, jabatan, dan gaji. Login portal bersifat opsional. Setelah dibuat, kelola login di Pengguna.",
        "Klik Kelola Jabatan untuk mengatur Akses Modul Bawaan, lalu Unduh Panduan Sistem untuk jabatan itu.",
        "Klik baris untuk Ubah Karyawan: rekening, BPJS Kesehatan, BPJS Ketenagakerjaan, Bebas CICO, dan Bebas Laporan Progress.",
        "Resign hanya Kantor Pusat. Hapus memindahkan orang ke Dihapus dan diblokir selama mereka masih ditugaskan ke proyek. Pulihkan atau Hapus Permanen dari Dihapus.",
      ],
      remember: [
        "Mengubah jabatan tidak menulis ulang login yang sudah ada. Pakai Pengguna, Izin Akses untuk satu orang.",
        "Penempatan (Tersedia, Di Proyek, Kantor Pusat) diatur lewat Tugaskan dan Lepaskan, bukan kolom bebas saat membuat.",
      ],
    }
  ),
};

export function fallbackSystemGuideCopy(
  moduleName: string,
  locale: AppLocale
): SystemGuideModuleCopy {
  if (locale === "id") {
    return {
      purpose: `${moduleName} ada di sidebar untuk jabatan yang modulnya diaktifkan.`,
      steps: [
        `Buka ${moduleName} dari sidebar.`,
        "Pakai pencarian dan filter untuk menemukan catatan.",
        "Pakai Tambah untuk membuat catatan baru.",
        "Buka sebuah baris untuk melihat atau mengubahnya.",
        "Ikuti chip status di layar untuk langkah berikutnya.",
      ],
      remember: [
        "Langkah khusus untuk modul ini belum ditulis. Ikuti label di layar. Kantor Pusat dapat memperbarui panduan ini.",
      ],
    };
  }
  return {
    purpose: `${moduleName} is in the sidebar for positions that have this module on.`,
    steps: [
      `Open ${moduleName} from the sidebar.`,
      "Use search and filters to find records.",
      "Use Add to create a new record.",
      "Open a row to view or edit it.",
      "Follow the status chips on screen for the next action.",
    ],
    remember: [
      "Detailed steps for this module have not been written yet. Follow the labels on screen. Head Office can update this guide.",
    ],
  };
}
