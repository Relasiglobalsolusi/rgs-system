import type { AppLocale } from "@/lib/i18n/locale";
import type { ModuleKey } from "@/lib/permissions";
import { bilingual } from "@/lib/system-guide/copy";
import type { SystemGuidePersona } from "@/lib/system-guide/persona";
import type { SystemGuideModuleCopy } from "@/lib/system-guide/types";

/**
 * Reader-specific how-to copy. Same module key, different steps.
 * The handbook includes a chapter only when that module is granted
 * (see access.ts). Turn the module off and the chapter is removed.
 * Client / field / warehouse never fall back to Head Office copy
 * (see resolve.ts). Field crew can share Cleaning Staff chapters.
 * Keep WinAnsi-safe (no arrows, em dashes, or smart quotes).
 */
export const SYSTEM_GUIDE_PERSONA_COPY: Partial<
  Record<
    SystemGuidePersona,
    Partial<Record<ModuleKey, Record<AppLocale, SystemGuideModuleCopy>>>
  >
> = {
  client: {
    dashboard: bilingual(
      {
        purpose:
          "Dashboard is the first page after you sign in. It shows a snapshot of your sites only: attendance on your projects and recent reports from your locations. You cannot see other clients.",
        steps: [
          "Open Dashboard from the top of the sidebar.",
          "Read the cards for your sites. A card appears only if that module is on for this login.",
          "Use Progress Report in the attendance block to open reports from your sites.",
          "Scroll to Recent Activity for new Progress Reports on your projects.",
        ],
        remember: [
          "You only see your organization. A missing card means that module is off for this login, not that the page is broken.",
        ],
      },
      {
        purpose:
          "Dasbor adalah halaman pertama setelah masuk. Ini ringkasan lokasi Anda saja: kehadiran di proyek Anda dan laporan terbaru dari lokasi Anda. Anda tidak melihat klien lain.",
        steps: [
          "Buka Dasbor dari bagian atas sidebar.",
          "Baca kartu untuk lokasi Anda. Kartu muncul hanya jika modul itu aktif untuk login ini.",
          "Pakai Laporan Progress di blok kehadiran untuk membuka laporan dari lokasi Anda.",
          "Gulir ke Aktivitas Terbaru untuk Laporan Progress baru di proyek Anda.",
        ],
        remember: [
          "Anda hanya melihat organisasi Anda. Kartu yang hilang berarti modul itu mati untuk login ini, bukan halaman rusak.",
        ],
      }
    ),
    projects: bilingual(
      {
        purpose:
          "Projects is the list of your sites. You can open a job to read the address, dates, and status. You cannot add a project, assign staff, or change the contract price.",
        steps: [
          "Open Projects from the sidebar.",
          "Use the chips on the page to narrow the list (for example Cleaning or Security).",
          "Click a project to read the site address, dates, and status.",
          "From that project, open Progress Report to read daily write-ups, or Invoice and Billing to see invoices you owe.",
        ],
        remember: [
          "You only see jobs for your organization.",
          "Adding a project, assigning crew, and recording payment are Head Office actions.",
        ],
      },
      {
        purpose:
          "Proyek adalah daftar lokasi Anda. Anda dapat membuka pekerjaan untuk membaca alamat, tanggal, dan status. Anda tidak dapat menambah proyek, menugaskan staf, atau mengubah harga kontrak.",
        steps: [
          "Buka Proyek dari sidebar.",
          "Pakai chip di halaman untuk menyaring daftar (misalnya Cleaning atau Security).",
          "Klik sebuah proyek untuk membaca alamat lokasi, tanggal, dan status.",
          "Dari proyek itu, buka Laporan Progress untuk membaca catatan harian, atau Invoice dan Penagihan untuk melihat invoice yang masih Anda bayar.",
        ],
        remember: [
          "Anda hanya melihat pekerjaan organisasi Anda.",
          "Menambah proyek, menugaskan kru, dan mencatat pembayaran adalah tindakan Kantor Pusat.",
        ],
      }
    ),
    progress: bilingual(
      {
        purpose:
          "Progress Report is the daily write-up and photos from your sites. You read them. You cannot write or edit a report.",
        steps: [
          "Open Progress Report from the sidebar.",
          "You only see your own sites. Choose the project, then pick the day or month you want to read.",
          "Open a report to see the write-up and photos.",
          "On a finished day or a finished month, use Download Progress Report or Download Attendance. Today and the current month cannot be downloaded yet.",
        ],
        remember: [
          "There is no approval of each report. You only read what the crew already sent.",
          "You cannot Submit Progress Report or Edit a report.",
        ],
      },
      {
        purpose:
          "Laporan Progress adalah catatan harian dan foto dari lokasi Anda. Anda membacanya. Anda tidak dapat menulis atau mengubah laporan.",
        steps: [
          "Buka Laporan Progress dari sidebar.",
          "Anda hanya melihat lokasi Anda sendiri. Pilih proyek, lalu pilih hari atau bulan yang ingin dibaca.",
          "Buka laporan untuk melihat catatan dan foto.",
          "Pada hari atau bulan yang sudah selesai, pakai Unduh Laporan Progress atau Unduh Kehadiran. Hari ini dan bulan berjalan belum bisa diunduh.",
        ],
        remember: [
          "Tidak ada persetujuan tiap laporan. Anda hanya membaca apa yang sudah dikirim kru.",
          "Anda tidak dapat Kirim Laporan Progress atau Ubah laporan.",
        ],
      }
    ),
    invoicing: bilingual(
      {
        purpose:
          "Invoice and Billing shows invoices for your projects. Head Office prepares each period. You review it in Reconciliation, then you pay from here.",
        steps: [
          "Open Invoice and Billing. You only see your own projects.",
          "Choose a project, then open the period or invoice you want to read.",
          "After you Approve in Reconciliation, the invoice appears here.",
          "When you are ready to pay, click Submit Payment and upload proof.",
          "Wait until Head Office confirms. The status becomes Paid.",
        ],
        remember: [
          "You do not compile a period, click Reconcile, or Record Client Response. Those are Head Office actions.",
          "If a period is waiting for you, open Reconciliation first, then come back here to pay.",
        ],
      },
      {
        purpose:
          "Invoice dan Penagihan menampilkan invoice untuk proyek Anda. Kantor Pusat menyusun tiap periode. Anda meninjau di Rekonsiliasi, lalu membayar dari sini.",
        steps: [
          "Buka Invoice dan Penagihan. Anda hanya melihat proyek Anda sendiri.",
          "Pilih proyek, lalu buka periode atau invoice yang ingin dibaca.",
          "Setelah Anda Setujui di Rekonsiliasi, invoice muncul di sini.",
          "Saat siap membayar, klik Kirim Pembayaran dan unggah bukti.",
          "Tunggu sampai Kantor Pusat mengonfirmasi. Status menjadi Lunas.",
        ],
        remember: [
          "Anda tidak menyusun periode, klik Rekonsiliasi, atau Catat Respons Klien. Itu tindakan Kantor Pusat.",
          "Jika suatu periode menunggu Anda, buka Rekonsiliasi dulu, lalu kembali ke sini untuk membayar.",
        ],
      }
    ),
    reconciliation: bilingual(
      {
        purpose:
          "Reconciliation is where you review a billing period before the invoice is issued. You see only your own projects.",
        steps: [
          "Open Reconciliation from the sidebar.",
          "Open a period and click View Report.",
          "If the amount is correct, click Approve. That issues the invoice.",
          "If the amount is wrong, click Revise. Enter a Revision Request Reason and a different Adjusted Amount.",
        ],
        remember: [
          "This is not an approval of each Progress Report. You review the compiled period pack.",
          "You cannot Approve Revision or Record Client Response. Head Office does that after you send a revise request.",
        ],
      },
      {
        purpose:
          "Rekonsiliasi adalah tempat Anda meninjau periode tagihan sebelum invoice terbit. Anda hanya melihat proyek Anda sendiri.",
        steps: [
          "Buka Rekonsiliasi dari sidebar.",
          "Buka sebuah periode dan klik Lihat Laporan.",
          "Jika jumlahnya benar, klik Setujui. Itu menerbitkan invoice.",
          "Jika jumlahnya salah, klik Revisi. Isi Alasan Permintaan Revisi dan Jumlah Disesuaikan yang berbeda.",
        ],
        remember: [
          "Ini bukan persetujuan tiap Laporan Progress. Anda meninjau paket periode yang sudah disusun.",
          "Anda tidak dapat Setujui Revisi atau Catat Respons Klien. Kantor Pusat yang melakukan itu setelah Anda meminta revisi.",
        ],
      }
    ),
    vendorPayments: bilingual(
      {
        purpose:
          "Payment & Settlement shows which of your projects still have an unpaid invoice. This is the money you owe Relasi Global Solusi.",
        steps: [
          "Open Payment & Settlement from the sidebar.",
          "Each row is a project that still has an unpaid invoice.",
          "Click Open Invoice & Billing on that row.",
          "On Invoice and Billing, click Submit Payment and upload proof.",
        ],
        remember: [
          "You only see which of your projects still have an unpaid invoice.",
          "Supplier bills are not in the client portal.",
        ],
      },
      {
        purpose:
          "Pembayaran dan Pelunasan menampilkan proyek Anda yang invoice-nya belum lunas. Ini uang yang masih Anda bayar ke Relasi Global Solusi.",
        steps: [
          "Buka Pembayaran dan Pelunasan dari sidebar.",
          "Tiap baris adalah proyek yang invoice-nya belum lunas.",
          "Klik Buka Invoice dan Penagihan pada baris itu.",
          "Di Invoice dan Penagihan, klik Kirim Pembayaran dan unggah bukti.",
        ],
        remember: [
          "Anda hanya melihat proyek Anda yang invoice-nya belum lunas.",
          "Tagihan pemasok tidak ada di portal klien.",
        ],
      }
    ),
    teams: bilingual(
      {
        purpose:
          "Teams shows which crew group is assigned to your sites. You cannot add a team, add members, or assign equipment.",
        steps: [
          "Open Teams from the sidebar if this module is on for your login.",
          "Read the team name and whether they are Available or On Site.",
          "Open a team only to see who is listed for your site.",
        ],
        remember: [
          "Adding a team, changing members, and Assign Equipment are Head Office actions.",
        ],
      },
      {
        purpose:
          "Tim menampilkan kelompok kru yang ditugaskan ke lokasi Anda. Anda tidak dapat menambah tim, menambah anggota, atau menugaskan peralatan.",
        steps: [
          "Buka Tim dari sidebar jika modul ini aktif untuk login Anda.",
          "Baca nama tim dan apakah statusnya Tersedia atau Di Lokasi.",
          "Buka sebuah tim hanya untuk melihat siapa yang tercantum di lokasi Anda.",
        ],
        remember: [
          "Menambah tim, mengubah anggota, dan Tugaskan Peralatan adalah tindakan Kantor Pusat.",
        ],
      }
    ),
    cico: bilingual(
      {
        purpose:
          "CICO is how Relasi Global Solusi staff Check In and Check Out at your site. You do not clock in.",
        steps: [
          "If this module is on, open CICO to see who is checked in on your sites.",
          "You only see your own locations.",
          "Do not tap Check In or Check Out. Those buttons are for staff.",
        ],
        remember: [
          "You cannot take Check-In photos or change a staff clock time.",
        ],
      },
      {
        purpose:
          "CICO adalah cara staf Relasi Global Solusi Check In dan Check Out di lokasi Anda. Anda tidak mencatat jam.",
        steps: [
          "Jika modul ini aktif, buka CICO untuk melihat siapa yang sudah check-in di lokasi Anda.",
          "Anda hanya melihat lokasi Anda sendiri.",
          "Jangan ketuk Check In atau Check Out. Tombol itu untuk staf.",
        ],
        remember: [
          "Anda tidak dapat mengambil foto Check-In atau mengubah waktu staf.",
        ],
      }
    ),
    attendance: bilingual(
      {
        purpose:
          "Attendance is the check-in picture for your sites. Daily write-ups and attendance packs also live under Progress Report.",
        steps: [
          "Open Attendance if this module is on, or use Progress Report for the same sites.",
          "Choose your project, then the day you want to read.",
          "Use Download Attendance on a finished day. Today cannot be downloaded yet.",
        ],
        remember: [
          "You cannot edit a staff clock time. You only read your sites.",
        ],
      },
      {
        purpose:
          "Kehadiran adalah gambaran check-in di lokasi Anda. Catatan harian dan paket kehadiran juga ada di Laporan Progress.",
        steps: [
          "Buka Kehadiran jika modul ini aktif, atau pakai Laporan Progress untuk lokasi yang sama.",
          "Pilih proyek Anda, lalu hari yang ingin dibaca.",
          "Pakai Unduh Kehadiran pada hari yang sudah selesai. Hari ini belum bisa diunduh.",
        ],
        remember: [
          "Anda tidak dapat mengubah waktu staf. Anda hanya membaca lokasi Anda.",
        ],
      }
    ),
    shifts: bilingual(
      {
        purpose:
          "Shifts shows the planned hours on your sites. You cannot create, edit, or remove a shift.",
        steps: [
          "Open Shifts from the sidebar if this module is on.",
          "Choose your project, then read the hours for that day.",
        ],
        remember: [
          "Setting hours and Remove Shift are Head Office or operations actions.",
        ],
      },
      {
        purpose:
          "Shift menampilkan jam yang direncanakan di lokasi Anda. Anda tidak dapat membuat, mengubah, atau menghapus shift.",
        steps: [
          "Buka Shift dari sidebar jika modul ini aktif.",
          "Pilih proyek Anda, lalu baca jam untuk hari itu.",
        ],
        remember: [
          "Mengatur jam dan Hapus Shift adalah tindakan Kantor Pusat atau operasi.",
        ],
      }
    ),
    leaves: bilingual(
      {
        purpose:
          "Leave & Sick is company time-off for Relasi Global Solusi staff. You cannot request or approve leave.",
        steps: [
          "If this module is on, open Leave & Sick only to read a status that Head Office shared for your site.",
          "Do not submit a Permission or Sick Leave request.",
        ],
        remember: [
          "Approving leave is a manager action. It is not part of the client portal.",
        ],
      },
      {
        purpose:
          "Izin & Sakit adalah cuti staf Relasi Global Solusi. Anda tidak dapat meminta atau menyetujui cuti.",
        steps: [
          "Jika modul ini aktif, buka Izin & Sakit hanya untuk membaca status yang dibagikan Kantor Pusat untuk lokasi Anda.",
          "Jangan mengirim permintaan Izin atau Sakit.",
        ],
        remember: [
          "Menyetujui cuti adalah tindakan manajer. Itu bukan bagian dari portal klien.",
        ],
      }
    ),
    approvals: bilingual(
      {
        purpose:
          "Approvals is the manager inbox for leave, material requests, and item returns. Client logins do not decide these.",
        steps: [
          "If this module is on, open it only when Head Office asked you to read a row about your site.",
          "Do not click Approve or Reject.",
        ],
        remember: [
          "You review billing periods in Reconciliation, not in Approvals.",
        ],
      },
      {
        purpose:
          "Persetujuan adalah kotak masuk manajer untuk cuti, permintaan material, dan retur barang. Login klien tidak memutuskan ini.",
        steps: [
          "Jika modul ini aktif, buka hanya jika Kantor Pusat meminta Anda membaca baris tentang lokasi Anda.",
          "Jangan klik Setujui atau Tolak.",
        ],
        remember: [
          "Anda meninjau periode tagihan di Rekonsiliasi, bukan di Persetujuan.",
        ],
      }
    ),
    materialRequests: bilingual(
      {
        purpose:
          "Material Requests is how site staff ask the warehouse for goods. You cannot submit a request.",
        steps: [
          "If this module is on, open it to see requests that belong to your site.",
          "Read the status. Do not click Submit Request or Confirm Received.",
        ],
        remember: [
          "Warehouse and operations close these requests. You only see your site.",
        ],
      },
      {
        purpose:
          "Permintaan Material adalah cara staf lokasi meminta barang gudang. Anda tidak dapat mengirim permintaan.",
        steps: [
          "Jika modul ini aktif, buka untuk melihat permintaan yang milik lokasi Anda.",
          "Baca statusnya. Jangan klik Kirim Permintaan atau Konfirmasi Diterima.",
        ],
        remember: [
          "Gudang dan operasi yang menutup permintaan ini. Anda hanya melihat lokasi Anda.",
        ],
      }
    ),
    transferOrders: bilingual(
      {
        purpose:
          "Transfer Orders shows goods being sent to a site. You cannot create or send a transfer.",
        steps: [
          "If this module is on, open Transfer Orders to read status for your site.",
          "Do not mark an order Sent or complete an item return.",
        ],
        remember: [
          "Warehouse sends transfers. You only see rows for your organization.",
        ],
      },
      {
        purpose:
          "Transfer Barang menampilkan barang yang dikirim ke lokasi. Anda tidak dapat membuat atau mengirim transfer.",
        steps: [
          "Jika modul ini aktif, buka Transfer Barang untuk membaca status lokasi Anda.",
          "Jangan menandai pesanan Terkirim atau menyelesaikan retur item.",
        ],
        remember: [
          "Gudang yang mengirim transfer. Anda hanya melihat baris organisasi Anda.",
        ],
      }
    ),
    reports: bilingual(
      {
        purpose:
          "Reports is a pack view for your sites. Daily write-ups and attendance downloads also live in Progress Report.",
        steps: [
          "Open Reports if this module is on, or open Progress Report.",
          "Choose your project, then the finished day or month.",
          "Use the download buttons when a pack is ready. Today and the current month cannot be downloaded yet.",
        ],
        remember: [
          "You cannot write a report from this page. You only read and download your sites.",
        ],
      },
      {
        purpose:
          "Laporan adalah tampilan paket untuk lokasi Anda. Catatan harian dan unduhan kehadiran juga ada di Laporan Progress.",
        steps: [
          "Buka Laporan jika modul ini aktif, atau buka Laporan Progress.",
          "Pilih proyek Anda, lalu hari atau bulan yang sudah selesai.",
          "Pakai tombol unduh saat paket siap. Hari ini dan bulan berjalan belum bisa diunduh.",
        ],
        remember: [
          "Anda tidak dapat menulis laporan dari halaman ini. Anda hanya membaca dan mengunduh lokasi Anda.",
        ],
      }
    ),
    departments: bilingual(
      {
        purpose:
          "Departments is the company structure at Relasi Global Solusi. You cannot add or rename a department.",
        steps: [
          "If this module is on, open Departments to read the names only.",
        ],
        remember: [
          "Creating departments and employee numbers is a Head Office action.",
        ],
      },
      {
        purpose:
          "Departemen adalah struktur perusahaan Relasi Global Solusi. Anda tidak dapat menambah atau mengganti nama departemen.",
        steps: [
          "Jika modul ini aktif, buka Departemen hanya untuk membaca namanya.",
        ],
        remember: [
          "Membuat departemen dan nomor karyawan adalah tindakan Kantor Pusat.",
        ],
      }
    ),
  },

  cleaningStaff: {
    dashboard: bilingual(
      {
        purpose:
          "Dashboard is the first page after you sign in. It shows your attendance today and a shortcut to write today's Progress Report.",
        steps: [
          "Open Dashboard from the top of the sidebar.",
          "Read My Attendance Today. The label shows Checked In, Checked In And Out, or Not Checked In Yet.",
          "If you still need to write today's report, use Progress Report in the attendance block.",
        ],
        remember: [
          "You will not see Head Office count cards such as Pending Approvals or Active Employees.",
        ],
      },
      {
        purpose:
          "Dasbor adalah halaman pertama setelah masuk. Menampilkan kehadiran Anda hari ini dan pintasan untuk menulis Laporan Progress hari ini.",
        steps: [
          "Buka Dasbor dari bagian atas sidebar.",
          "Baca Kehadiran Saya Hari Ini. Label menunjukkan sudah Check-In, sudah Check-In dan Check-Out, atau belum Check-In.",
          "Jika laporan hari ini belum dikirim, pakai Laporan Progress di blok kehadiran.",
        ],
        remember: [
          "Anda tidak melihat kartu angka Kantor Pusat seperti Persetujuan Menunggu atau Karyawan Aktif.",
        ],
      }
    ),
    projects: bilingual(
      {
        purpose:
          "Projects lists the sites you can see. You open a job to read the address and status. You cannot add a project or assign staff.",
        steps: [
          "Open Projects from the sidebar.",
          "Use the chips to find your site.",
          "Click the project to read the address, dates, and status.",
          "Use CICO and Progress Report to work that site. Do not change the contract price or the bank account.",
        ],
        remember: [
          "Adding a project, assigning crew, and billing are Head Office or manager actions.",
        ],
      },
      {
        purpose:
          "Proyek menampilkan lokasi yang bisa Anda lihat. Anda membuka pekerjaan untuk membaca alamat dan status. Anda tidak dapat menambah proyek atau menugaskan staf.",
        steps: [
          "Buka Proyek dari sidebar.",
          "Pakai chip untuk menemukan lokasi Anda.",
          "Klik proyek untuk membaca alamat, tanggal, dan status.",
          "Pakai CICO dan Laporan Progress untuk bekerja di lokasi itu. Jangan mengubah harga kontrak atau rekening bank.",
        ],
        remember: [
          "Menambah proyek, menugaskan kru, dan menagih adalah tindakan Kantor Pusat atau manajer.",
        ],
      }
    ),
    progress: bilingual(
      {
        purpose:
          "Progress Report is your daily write-up and photos from the site. There is no approval step. The report appears on the project as soon as you send it.",
        steps: [
          "Check In first with CICO on that project.",
          "Open Progress Report, then open My Progress Reports.",
          "Click Submit Progress Report. Type the Service Area (for example Lobby), write what was done, and add at least one photo (JPG, PNG, WebP, or GIF, up to 10 MB each).",
          "You can send more than one report on the same day. The report date is locked to that check-in day.",
          "If you made a mistake, open Edit on your own report the same day (Jakarta time). You can change the Service Area, notes, or photos. After that day ends, the report is locked.",
        ],
        remember: [
          "If you are not marked Exempt From Progress Report, send at least one report before CICO Check Out.",
          "Only you can edit your own report, and only on the same day.",
          "Managers read your report. They cannot change it.",
        ],
      },
      {
        purpose:
          "Laporan Progress adalah catatan harian dan foto Anda dari lokasi. Tidak ada langkah persetujuan. Laporan tampil di proyek segera setelah Anda kirim.",
        steps: [
          "Check-in dulu lewat CICO di proyek itu.",
          "Buka Laporan Progress, lalu buka Laporan Progress Saya.",
          "Klik Kirim Laporan Progress. Isi Area Layanan (misalnya Lobi), tulis pekerjaan hari itu, dan tambahkan minimal satu foto (JPG, PNG, WebP, atau GIF, maksimal 10 MB per file).",
          "Anda boleh mengirim lebih dari satu laporan di hari yang sama. Tanggal laporan terkunci ke hari check-in itu.",
          "Jika ada kesalahan, buka Ubah pada laporan Anda sendiri di hari yang sama (waktu Jakarta). Anda bisa mengubah Area Layanan, catatan, atau foto. Setelah hari itu berakhir, laporan terkunci.",
        ],
        remember: [
          "Jika Anda tidak ditandai Bebas Laporan Progress, kirim minimal satu laporan sebelum Check Out CICO.",
          "Hanya Anda yang bisa mengubah laporan Anda, dan hanya di hari yang sama.",
          "Manajer membaca laporan Anda. Mereka tidak bisa mengubahnya.",
        ],
      }
    ),
    cico: bilingual(
      {
        purpose:
          "CICO is how you Check In and Check Out at the job site with GPS and photos.",
        steps: [
          "Open CICO. If more than one site is listed, use Select Project.",
          "Be at the site. Allow location. Take a Check-In Photo with Take / Upload Photo.",
          "Tap Check In. You must be inside the site radius.",
          "Work the shift. If you are not Exempt From Progress Report, submit at least one Progress Report before Check Out.",
          "Take a Check-Out Photo, then tap Check Out. If you leave before shift end, confirm Checking Out Before Shift End. There is no typed reason.",
          "Check Out of the current site before you Check In at another site.",
        ],
        remember: [
          "Off-site projects block Check In. The project must have a site location.",
          "Overnight shifts stay on the same shift day until Check Out.",
        ],
      },
      {
        purpose:
          "CICO adalah cara Anda Check In dan Check Out di lokasi dengan GPS dan foto.",
        steps: [
          "Buka CICO. Jika ada lebih dari satu lokasi, pakai Pilih Proyek.",
          "Berada di lokasi. Izinkan lokasi. Ambil Foto Check-In dengan Ambil / Unggah Foto.",
          "Ketuk Check In. Anda harus berada dalam radius lokasi.",
          "Jalankan shift. Jika Anda tidak Bebas Laporan Progress, kirim minimal satu Laporan Progress sebelum Check Out.",
          "Ambil Foto Check-Out, lalu ketuk Check Out. Jika pulang sebelum akhir shift, konfirmasi Check-Out Sebelum Akhir Shift. Tidak ada kolom alasan.",
          "Check Out dari lokasi saat ini sebelum Check In di lokasi lain.",
        ],
        remember: [
          "Proyek Off-site memblokir Check In. Proyek harus punya titik lokasi.",
          "Shift malam tetap di hari shift yang sama sampai Check Out.",
        ],
      }
    ),
    leaves: bilingual(
      {
        purpose:
          "Leave & Sick is where you ask for time off. After you send a request you cannot edit it. A manager decides in Approvals.",
        steps: [
          "Open Leave & Sick from the sidebar.",
          "Click the request type you need (Permission or Sick Leave).",
          "Fill the dates and the reason, then submit.",
          "Wait for the status to change to Approved or Rejected. You will see it on this page.",
        ],
        remember: [
          "You cannot approve your own leave.",
          "You cannot edit a request after it is sent. If something is wrong, ask your manager.",
        ],
      },
      {
        purpose:
          "Izin & Sakit adalah tempat Anda meminta cuti. Setelah dikirim, permintaan tidak bisa diubah. Manajer memutuskan di Persetujuan.",
        steps: [
          "Buka Izin & Sakit dari sidebar.",
          "Klik jenis permintaan yang Anda butuhkan (Izin atau Sakit).",
          "Isi tanggal dan alasan, lalu kirim.",
          "Tunggu status menjadi Disetujui atau Ditolak. Anda melihatnya di halaman ini.",
        ],
        remember: [
          "Anda tidak bisa menyetujui cuti sendiri.",
          "Anda tidak bisa mengubah permintaan setelah dikirim. Jika ada yang salah, tanya manajer Anda.",
        ],
      }
    ),
    materialRequests: bilingual(
      {
        purpose:
          "Material Requests is how you ask the warehouse for goods needed on your site.",
        steps: [
          "Open Material Requests from the sidebar.",
          "Click Submit Request. Choose the project and the items.",
          "Wait until warehouse sends the order. Status moves from Requested to Sent.",
          "When the goods arrive, click Confirm Received. You must be checked into that project unless you were the requester.",
        ],
        remember: [
          "Area Managers and above are auto-approved. Cleaning staff wait in Approvals.",
          "If the site clicks Did Not Receive, warehouse handles the return.",
        ],
      },
      {
        purpose:
          "Permintaan Material adalah cara Anda meminta barang gudang untuk lokasi Anda.",
        steps: [
          "Buka Permintaan Material dari sidebar.",
          "Klik Kirim Permintaan. Pilih proyek dan item.",
          "Tunggu gudang mengirim pesanan. Status bergerak dari Diminta ke Terkirim.",
          "Saat barang tiba, klik Konfirmasi Diterima. Anda harus check-in di proyek itu kecuali Anda pemohonnya.",
        ],
        remember: [
          "Area Manager ke atas disetujui otomatis. Staf cleaning menunggu di Persetujuan.",
          "Jika lokasi klik Tidak Diterima, gudang menangani retur.",
        ],
      }
    ),
    teams: bilingual(
      {
        purpose:
          "Teams shows which crew group is listed for your site. You cannot add a team, add members, or assign equipment.",
        steps: [
          "Open Teams from the sidebar if this module is on.",
          "Read the team name and whether they are Available or On Site.",
          "Open a team only to see who is listed. Do not change members.",
        ],
        remember: [
          "Adding a team, changing members, and Assign Equipment are manager or Head Office actions.",
        ],
      },
      {
        purpose:
          "Tim menampilkan kelompok kru yang tercantum di lokasi Anda. Anda tidak dapat menambah tim, menambah anggota, atau menugaskan peralatan.",
        steps: [
          "Buka Tim dari sidebar jika modul ini aktif.",
          "Baca nama tim dan apakah statusnya Tersedia atau Di Lokasi.",
          "Buka sebuah tim hanya untuk melihat siapa yang tercantum. Jangan mengubah anggota.",
        ],
        remember: [
          "Menambah tim, mengubah anggota, dan Tugaskan Peralatan adalah tindakan manajer atau Kantor Pusat.",
        ],
      }
    ),
    shifts: bilingual(
      {
        purpose:
          "Shifts shows the planned hours on your site. You cannot create, edit, or remove a shift.",
        steps: [
          "Open Shifts from the sidebar if this module is on.",
          "Choose your project, then read the hours for that day.",
        ],
        remember: [
          "Setting hours and Remove Shift are manager or Head Office actions.",
        ],
      },
      {
        purpose:
          "Shift menampilkan jam yang direncanakan di lokasi Anda. Anda tidak dapat membuat, mengubah, atau menghapus shift.",
        steps: [
          "Buka Shift dari sidebar jika modul ini aktif.",
          "Pilih proyek Anda, lalu baca jam untuk hari itu.",
        ],
        remember: [
          "Mengatur jam dan Hapus Shift adalah tindakan manajer atau Kantor Pusat.",
        ],
      }
    ),
    approvals: bilingual(
      {
        purpose:
          "Approvals is the manager inbox for leave, material requests, and item returns. This login does not decide these.",
        steps: [
          "If this module is on, open it only when a manager asked you to read a row.",
          "Do not click Approve or Reject.",
        ],
        remember: [
          "You request leave in Leave & Sick. A manager decides in Approvals.",
        ],
      },
      {
        purpose:
          "Persetujuan adalah kotak masuk manajer untuk cuti, permintaan material, dan retur barang. Login ini tidak memutuskan ini.",
        steps: [
          "Jika modul ini aktif, buka hanya jika manajer meminta Anda membaca sebuah baris.",
          "Jangan klik Setujui atau Tolak.",
        ],
        remember: [
          "Anda meminta cuti di Izin & Sakit. Manajer memutuskan di Persetujuan.",
        ],
      }
    ),
    invoicing: bilingual(
      {
        purpose:
          "Invoice and Billing is a finance page. This login does not compile invoices or collect payment.",
        steps: [
          "If this module is on, open Invoice and Billing only when a manager asked you to look at a project.",
          "Read the period status. Do not click Reconcile, Record Client Response, or Payment Received.",
        ],
        remember: [
          "Compiling a period and marking paid are Finance / Head Office actions.",
        ],
      },
      {
        purpose:
          "Invoice dan Penagihan adalah halaman keuangan. Login ini tidak menyusun invoice atau menagih.",
        steps: [
          "Jika modul ini aktif, buka Invoice dan Penagihan hanya jika manajer meminta Anda melihat sebuah proyek.",
          "Baca status periode. Jangan klik Rekonsiliasi, Catat Respons Klien, atau Pembayaran Diterima.",
        ],
        remember: [
          "Menyusun periode dan menandai lunas adalah tindakan Keuangan / Kantor Pusat.",
        ],
      }
    ),
    reconciliation: bilingual(
      {
        purpose:
          "Reconciliation is a finance review inbox. This login does not approve invoices.",
        steps: [
          "If this module is on, open a period only when a manager asked you to read the pack.",
          "Do not click Approve, Revise, Approve Revision, or Record Client Response.",
        ],
        remember: [
          "Clients approve in the portal. Finance handles Head Office actions.",
        ],
      },
      {
        purpose:
          "Rekonsiliasi adalah kotak tinjauan keuangan. Login ini tidak menyetujui invoice.",
        steps: [
          "Jika modul ini aktif, buka periode hanya jika manajer meminta Anda membaca paketnya.",
          "Jangan klik Setujui, Revisi, Setujui Revisi, atau Catat Respons Klien.",
        ],
        remember: [
          "Klien menyetujui di portal. Keuangan menangani tindakan Kantor Pusat.",
        ],
      }
    ),
    vendorPayments: bilingual(
      {
        purpose:
          "Payment & Settlement is a finance list of unpaid client invoices and supplier bills. This login does not mark bills paid.",
        steps: [
          "If this module is on, open it only when a manager asked you to look at a row.",
          "Do not click Mark Paid or Confirm Paid.",
        ],
        remember: [
          "Paying suppliers and collecting client invoices are Finance / Head Office actions.",
        ],
      },
      {
        purpose:
          "Pembayaran dan Pelunasan adalah daftar keuangan invoice klien belum lunas dan tagihan pemasok. Login ini tidak menandai tagihan lunas.",
        steps: [
          "Jika modul ini aktif, buka hanya jika manajer meminta Anda melihat sebuah baris.",
          "Jangan klik Tandai Dibayar atau Konfirmasi Lunas.",
        ],
        remember: [
          "Membayar pemasok dan menagih invoice klien adalah tindakan Keuangan / Kantor Pusat.",
        ],
      }
    ),
  },

  securityStaff: {
    dashboard: bilingual(
      {
        purpose:
          "Dashboard is the first page after you sign in. It shows your attendance today.",
        steps: [
          "Open Dashboard from the top of the sidebar.",
          "Read My Attendance Today. The label shows Checked In, Checked In And Out, or Not Checked In Yet.",
          "If Progress Report is on for this login, use it from the attendance block to send or read today's write-up.",
        ],
        remember: [
          "You will not see Head Office count cards such as Pending Approvals.",
        ],
      },
      {
        purpose:
          "Dasbor adalah halaman pertama setelah masuk. Menampilkan kehadiran Anda hari ini.",
        steps: [
          "Buka Dasbor dari bagian atas sidebar.",
          "Baca Kehadiran Saya Hari Ini. Label menunjukkan sudah Check-In, sudah Check-In dan Check-Out, atau belum Check-In.",
          "Jika Laporan Progress aktif untuk login ini, pakai pintasan di blok kehadiran untuk mengirim atau membaca catatan hari ini.",
        ],
        remember: [
          "Anda tidak melihat kartu angka Kantor Pusat seperti Persetujuan Menunggu.",
        ],
      }
    ),
    projects: bilingual(
      {
        purpose:
          "Projects lists the sites you can see. You open a job to read the address and status. You cannot add a project or assign staff.",
        steps: [
          "Open Projects from the sidebar.",
          "Use the chips to find your site.",
          "Click the project to read the address, dates, and status.",
          "Use CICO to clock that site. Do not change the contract price.",
        ],
        remember: [
          "Adding a project, assigning crew, and billing are Head Office or manager actions.",
        ],
      },
      {
        purpose:
          "Proyek menampilkan lokasi yang bisa Anda lihat. Anda membuka pekerjaan untuk membaca alamat dan status. Anda tidak dapat menambah proyek atau menugaskan staf.",
        steps: [
          "Buka Proyek dari sidebar.",
          "Pakai chip untuk menemukan lokasi Anda.",
          "Klik proyek untuk membaca alamat, tanggal, dan status.",
          "Pakai CICO untuk mencatat lokasi itu. Jangan mengubah harga kontrak.",
        ],
        remember: [
          "Menambah proyek, menugaskan kru, dan menagih adalah tindakan Kantor Pusat atau manajer.",
        ],
      }
    ),
    progress: bilingual(
      {
        purpose:
          "Progress Report is the daily write-up and photos from your site when this module is on for your login.",
        steps: [
          "Open Progress Report, then open My Progress Reports.",
          "Click Submit Progress Report. Type the Service Area, write what was done, and add at least one photo (JPG, PNG, WebP, or GIF, up to 10 MB each).",
          "Contract Security can submit without an open CICO. One Time Security still needs Check In first.",
          "If you made a mistake, open Edit on your own report the same day (Jakarta time). After that day ends, the report is locked.",
        ],
        remember: [
          "Only you can edit your own report, and only on the same day.",
          "You cannot approve or change another person's report.",
        ],
      },
      {
        purpose:
          "Laporan Progress adalah catatan harian dan foto dari lokasi Anda jika modul ini aktif untuk login Anda.",
        steps: [
          "Buka Laporan Progress, lalu buka Laporan Progress Saya.",
          "Klik Kirim Laporan Progress. Isi Area Layanan, tulis pekerjaan hari itu, dan tambahkan minimal satu foto (JPG, PNG, WebP, atau GIF, maksimal 10 MB per file).",
          "Security kontrak dapat mengirim tanpa CICO terbuka. Security sekali tetap perlu Check In dulu.",
          "Jika ada kesalahan, buka Ubah pada laporan Anda sendiri di hari yang sama (waktu Jakarta). Setelah hari itu berakhir, laporan terkunci.",
        ],
        remember: [
          "Hanya Anda yang bisa mengubah laporan Anda, dan hanya di hari yang sama.",
          "Anda tidak bisa menyetujui atau mengubah laporan orang lain.",
        ],
      }
    ),
    cico: bilingual(
      {
        purpose:
          "CICO is how you Check In and Check Out at the site with GPS and photos.",
        steps: [
          "Open CICO. If more than one site is listed, use Select Project.",
          "Be at the site. Allow location. Take a Check-In Photo with Take / Upload Photo.",
          "Tap Check In. You must be inside the site radius.",
          "Work the shift. Take a Check-Out Photo, then tap Check Out.",
          "If you leave before shift end, confirm Checking Out Before Shift End. There is no typed reason.",
          "Check Out of the current site before you Check In at another site.",
        ],
        remember: [
          "Off-site projects block Check In. The project must have a site location.",
          "Overnight shifts stay on the same shift day until Check Out.",
        ],
      },
      {
        purpose:
          "CICO adalah cara Anda Check In dan Check Out di lokasi dengan GPS dan foto.",
        steps: [
          "Buka CICO. Jika ada lebih dari satu lokasi, pakai Pilih Proyek.",
          "Berada di lokasi. Izinkan lokasi. Ambil Foto Check-In dengan Ambil / Unggah Foto.",
          "Ketuk Check In. Anda harus berada dalam radius lokasi.",
          "Jalankan shift. Ambil Foto Check-Out, lalu ketuk Check Out.",
          "Jika pulang sebelum akhir shift, konfirmasi Check-Out Sebelum Akhir Shift. Tidak ada kolom alasan.",
          "Check Out dari lokasi saat ini sebelum Check In di lokasi lain.",
        ],
        remember: [
          "Proyek Off-site memblokir Check In. Proyek harus punya titik lokasi.",
          "Shift malam tetap di hari shift yang sama sampai Check Out.",
        ],
      }
    ),
    leaves: bilingual(
      {
        purpose:
          "Leave & Sick is where you ask for time off. After you send a request you cannot edit it.",
        steps: [
          "Open Leave & Sick from the sidebar.",
          "Click the request type you need (Permission or Sick Leave).",
          "Fill the dates and the reason, then submit.",
          "Wait for Approved or Rejected on this page.",
        ],
        remember: [
          "You cannot approve your own leave.",
        ],
      },
      {
        purpose:
          "Izin & Sakit adalah tempat Anda meminta cuti. Setelah dikirim, permintaan tidak bisa diubah.",
        steps: [
          "Buka Izin & Sakit dari sidebar.",
          "Klik jenis permintaan yang Anda butuhkan (Izin atau Sakit).",
          "Isi tanggal dan alasan, lalu kirim.",
          "Tunggu Disetujui atau Ditolak di halaman ini.",
        ],
        remember: [
          "Anda tidak bisa menyetujui cuti sendiri.",
        ],
      }
    ),
  },

  technician: {
    dashboard: bilingual(
      {
        purpose:
          "Dashboard is the first page after you sign in. It shows your attendance today.",
        steps: [
          "Open Dashboard from the top of the sidebar.",
          "Read My Attendance Today. The label shows Checked In, Checked In And Out, or Not Checked In Yet.",
        ],
        remember: [
          "This login does not write Progress Reports. Use CICO to clock the site, and Leave & Sick to ask for time off.",
        ],
      },
      {
        purpose:
          "Dasbor adalah halaman pertama setelah masuk. Menampilkan kehadiran Anda hari ini.",
        steps: [
          "Buka Dasbor dari bagian atas sidebar.",
          "Baca Kehadiran Saya Hari Ini. Label menunjukkan sudah Check-In, sudah Check-In dan Check-Out, atau belum Check-In.",
        ],
        remember: [
          "Login ini tidak menulis Laporan Progress. Pakai CICO untuk mencatat lokasi, dan Izin & Sakit untuk meminta cuti.",
        ],
      }
    ),
    cico: bilingual(
      {
        purpose:
          "CICO is how you Check In and Check Out at the job site with GPS and photos.",
        steps: [
          "Open CICO. If more than one site is listed, use Select Project.",
          "Be at the site. Allow location. Take a Check-In Photo with Take / Upload Photo.",
          "Tap Check In. You must be inside the site radius.",
          "Work the shift. Take a Check-Out Photo, then tap Check Out.",
          "If you leave before shift end, confirm Checking Out Before Shift End. There is no typed reason.",
          "Check Out of the current site before you Check In at another site.",
        ],
        remember: [
          "You do not submit a Progress Report before Check Out.",
          "Off-site projects block Check In. The project must have a site location.",
        ],
      },
      {
        purpose:
          "CICO adalah cara Anda Check In dan Check Out di lokasi dengan GPS dan foto.",
        steps: [
          "Buka CICO. Jika ada lebih dari satu lokasi, pakai Pilih Proyek.",
          "Berada di lokasi. Izinkan lokasi. Ambil Foto Check-In dengan Ambil / Unggah Foto.",
          "Ketuk Check In. Anda harus berada dalam radius lokasi.",
          "Jalankan shift. Ambil Foto Check-Out, lalu ketuk Check Out.",
          "Jika pulang sebelum akhir shift, konfirmasi Check-Out Sebelum Akhir Shift. Tidak ada kolom alasan.",
          "Check Out dari lokasi saat ini sebelum Check In di lokasi lain.",
        ],
        remember: [
          "Anda tidak mengirim Laporan Progress sebelum Check Out.",
          "Proyek Off-site memblokir Check In. Proyek harus punya titik lokasi.",
        ],
      }
    ),
    leaves: bilingual(
      {
        purpose:
          "Leave & Sick is where you ask for time off. After you send a request you cannot edit it.",
        steps: [
          "Open Leave & Sick from the sidebar.",
          "Click the request type you need (Permission or Sick Leave).",
          "Fill the dates and the reason, then submit.",
          "Wait for Approved or Rejected on this page.",
        ],
        remember: [
          "You cannot approve your own leave.",
        ],
      },
      {
        purpose:
          "Izin & Sakit adalah tempat Anda meminta cuti. Setelah dikirim, permintaan tidak bisa diubah.",
        steps: [
          "Buka Izin & Sakit dari sidebar.",
          "Klik jenis permintaan yang Anda butuhkan (Izin atau Sakit).",
          "Isi tanggal dan alasan, lalu kirim.",
          "Tunggu Disetujui atau Ditolak di halaman ini.",
        ],
        remember: [
          "Anda tidak bisa menyetujui cuti sendiri.",
        ],
      }
    ),
  },

  opsManager: {
    dashboard: bilingual(
      {
        purpose:
          "Dashboard is the first page after you sign in. It shows today's field picture: who is on site and recent Progress Reports from the jobs you manage.",
        steps: [
          "Open Dashboard from the top of the sidebar.",
          "Read Today's Attendance. Labels show Checked In, Checked In And Out, or Not Checked In Yet.",
          "Use Progress Report in the attendance block to open live check-in monitoring.",
          "Scroll to Recent Activity for new Progress Reports and leave requests.",
        ],
        remember: [
          "You will not see Finance-only cards such as supplier Payables. A missing card means that module is off for this login.",
        ],
      },
      {
        purpose:
          "Dasbor adalah halaman pertama setelah masuk. Menampilkan gambaran lapangan hari ini: siapa di lokasi dan Laporan Progress terbaru dari pekerjaan yang Anda kelola.",
        steps: [
          "Buka Dasbor dari bagian atas sidebar.",
          "Baca Kehadiran Hari Ini. Label menunjukkan sudah Check-In, sudah Check-In dan Check-Out, atau belum Check-In.",
          "Pakai Laporan Progress di blok kehadiran untuk memantau check-in yang berjalan.",
          "Gulir ke Aktivitas Terbaru untuk Laporan Progress dan permintaan cuti baru.",
        ],
        remember: [
          "Anda tidak melihat kartu khusus Keuangan seperti Utang pemasok. Kartu yang hilang berarti modul itu mati untuk login ini.",
        ],
      }
    ),
    projects: bilingual(
      {
        purpose:
          "Projects is the job list you run in the field. You move a job from Planning to In Progress, assign crew or a team, and follow Progress Report from the project page.",
        steps: [
          "Open Projects. Pick a sidebar view, then use the chips to narrow the list.",
          "On a Planning job, click Move To In Progress and upload Signed Contract Proof before the crew starts.",
          "Open the project to Assign Staff or Assign Team, then manage equipment, visits, and Progress Report from that page.",
          "When a monthly period is due, finance uses Invoice and Billing to Reconcile. You can open the project to confirm the site is ready.",
        ],
        remember: [
          "A Completed job is locked. You cannot change the bank account or the price.",
          "Recording Payment Received is a Finance / Head Office action.",
        ],
      },
      {
        purpose:
          "Proyek adalah daftar pekerjaan yang Anda jalankan di lapangan. Anda memindahkan pekerjaan dari Perencanaan ke Berjalan, menugaskan kru atau tim, dan mengikuti Laporan Progress dari halaman proyek.",
        steps: [
          "Buka Proyek. Pilih tampilan sidebar, lalu pakai chip untuk menyaring.",
          "Pada pekerjaan Perencanaan, klik Pindah ke Berjalan dan unggah Bukti Kontrak Tertanda sebelum kru mulai.",
          "Buka proyek untuk Tugaskan Staf atau Tugaskan Tim, lalu kelola peralatan, kunjungan, dan Laporan Progress dari halaman itu.",
          "Saat periode bulanan jatuh tempo, keuangan memakai Invoice dan Penagihan untuk Rekonsiliasi. Anda dapat membuka proyek untuk memastikan lokasi siap.",
        ],
        remember: [
          "Pekerjaan Selesai terkunci. Rekening dan harga tidak bisa diubah.",
          "Mencatat Pembayaran Diterima adalah tindakan Keuangan / Kantor Pusat.",
        ],
      }
    ),
    progress: bilingual(
      {
        purpose:
          "Progress Report is where you read daily write-ups and photos from the sites you manage. You do not write staff reports. There is no approval step.",
        steps: [
          "Open Progress Report from the sidebar.",
          "Choose the client (or Internal), then choose the project.",
          "Open a day to read the reports and photos. You cannot edit a staff report.",
          "On a finished day or a finished month of a commercial job, use Download Progress Report or Download Attendance. Today and the current month cannot be downloaded yet.",
        ],
        remember: [
          "Staff write the report. You only read it.",
          "Progress Report does not appear in Approvals.",
        ],
      },
      {
        purpose:
          "Laporan Progress adalah tempat Anda membaca catatan harian dan foto dari lokasi yang Anda kelola. Anda tidak menulis laporan staf. Tidak ada langkah persetujuan.",
        steps: [
          "Buka Laporan Progress dari sidebar.",
          "Pilih klien (atau Internal), lalu pilih proyek.",
          "Buka satu hari untuk membaca laporan dan foto. Anda tidak bisa mengubah laporan staf.",
          "Pada hari atau bulan yang sudah selesai di pekerjaan komersial, pakai Unduh Laporan Progress atau Unduh Kehadiran. Hari ini dan bulan berjalan belum bisa diunduh.",
        ],
        remember: [
          "Staf yang menulis laporan. Anda hanya membacanya.",
          "Laporan Progress tidak muncul di Persetujuan.",
        ],
      }
    ),
    cico: bilingual(
      {
        purpose:
          "CICO is how field staff clock at the site. You can open it to see who is checked in. Desk logins without field CICO see Preview Mode.",
        steps: [
          "Open CICO. If more than one site is listed, use Select Project.",
          "Read who is checked in on that site.",
          "If your login can clock a site, be at the site, allow location, take a Check-In Photo, then tap Check In.",
          "Staff who are not Exempt From Progress Report must submit a Progress Report before Check Out.",
        ],
        remember: [
          "A report is sent to the operations manager when someone checks out before shift end.",
          "Off-site projects block Check In.",
        ],
      },
      {
        purpose:
          "CICO adalah cara staf lapangan mencatat jam di lokasi. Anda dapat membukanya untuk melihat siapa yang sudah check-in. Login meja tanpa CICO lapangan melihat Mode Pratinjau.",
        steps: [
          "Buka CICO. Jika ada lebih dari satu lokasi, pakai Pilih Proyek.",
          "Lihat siapa yang sudah check-in di lokasi itu.",
          "Jika login Anda dapat mencatat lokasi, berada di lokasi, izinkan lokasi, ambil Foto Check-In, lalu ketuk Check In.",
          "Staf yang tidak Bebas Laporan Progress wajib mengirim Laporan Progress sebelum Check Out.",
        ],
        remember: [
          "Laporan dikirim ke manajer operasi saat seseorang check-out sebelum akhir shift.",
          "Proyek Off-site memblokir Check In.",
        ],
      }
    ),
    approvals: bilingual(
      {
        purpose:
          "Approvals is your inbox. It has three sections on one page: Leave & Sick, Needs Attention (item returns from Transfer Orders), and Material Requests.",
        steps: [
          "Open Approvals from the sidebar.",
          "Open a Leave & Sick row you are allowed to decide, then Approve or Reject. For sick leave, Approve then asks No Deduction or Deduct.",
          "Open Needs Attention when a site marked Did Not Receive on a transfer.",
          "Open Material Requests to approve or reject a warehouse request from the crew.",
        ],
        remember: [
          "You cannot approve your own leave.",
          "Sick leave Deduct is a manual amount. The system does not calculate a fine.",
          "The leave chain in the next steps is the live company rule.",
        ],
      },
      {
        purpose:
          "Persetujuan adalah kotak masuk Anda. Ada tiga bagian di satu halaman: Izin & Sakit, Perlu Perhatian (retur barang dari Transfer Barang), dan Permintaan Material.",
        steps: [
          "Buka Persetujuan dari sidebar.",
          "Buka baris Izin & Sakit yang boleh Anda putuskan, lalu Setujui atau Tolak. Untuk cuti sakit, Setujui lalu menanyakan Tanpa Potong atau Potong.",
          "Buka Perlu Perhatian saat lokasi menandai Tidak Diterima pada transfer.",
          "Buka Permintaan Material untuk menyetujui atau menolak permintaan gudang dari kru.",
        ],
        remember: [
          "Anda tidak bisa menyetujui cuti sendiri.",
          "Potong pada cuti sakit adalah jumlah manual. Sistem tidak menghitung denda.",
          "Rantai cuti di langkah berikutnya adalah aturan perusahaan yang berlaku.",
        ],
      }
    ),
  },

  finance: {
    dashboard: bilingual(
      {
        purpose:
          "Dashboard is the first page after you sign in. For this login it is a finance snapshot: billing, collections, and counts for the modules that are on.",
        steps: [
          "Open Dashboard from the top of the sidebar.",
          "Read the count cards that belong to finance, such as pending invoices or collections, when those modules are on.",
          "Open Invoice and Billing or Payment & Settlement from the sidebar when a card needs action.",
        ],
        remember: [
          "You will not see field Check In cards the way cleaning staff do. A missing card means that module is off for this login.",
        ],
      },
      {
        purpose:
          "Dasbor adalah halaman pertama setelah masuk. Untuk login ini ini ringkasan keuangan: tagihan, penagihan, dan angka untuk modul yang aktif.",
        steps: [
          "Buka Dasbor dari bagian atas sidebar.",
          "Baca kartu angka keuangan, misalnya invoice menunggu atau penagihan, jika modul itu aktif.",
          "Buka Invoice dan Penagihan atau Pembayaran dan Pelunasan dari sidebar saat sebuah kartu perlu tindakan.",
        ],
        remember: [
          "Anda tidak melihat kartu Check-In lapangan seperti staf cleaning. Kartu yang hilang berarti modul itu mati untuk login ini.",
        ],
      }
    ),
    projects: bilingual(
      {
        purpose:
          "Projects is where you open a job to follow billing. You do not assign crew. You use a project as the way into Invoice and Billing and Reconciliation.",
        steps: [
          "Open Projects. Pick a sidebar view such as Payment Due or Completed Projects.",
          "Open the project that needs billing.",
          "When a monthly period is due, open Invoice and Billing and click Reconcile.",
          "For General Cleaning or Facade, use Send For Review, then follow Reconciliation.",
        ],
        remember: [
          "Assign Staff and Assign Team are operations actions.",
          "A Completed job is locked. You cannot change the bank account or the price.",
        ],
      },
      {
        purpose:
          "Proyek adalah tempat Anda membuka pekerjaan untuk mengikuti tagihan. Anda tidak menugaskan kru. Proyek adalah jalan masuk ke Invoice dan Penagihan serta Rekonsiliasi.",
        steps: [
          "Buka Proyek. Pilih tampilan sidebar seperti Jatuh Tempo atau Proyek Selesai.",
          "Buka proyek yang perlu ditagih.",
          "Saat periode bulanan jatuh tempo, buka Invoice dan Penagihan lalu klik Rekonsiliasi.",
          "Untuk General Cleaning atau Facade, pakai Kirim Untuk Ditinjau, lalu ikuti Rekonsiliasi.",
        ],
        remember: [
          "Tugaskan Staf dan Tugaskan Tim adalah tindakan operasi.",
          "Pekerjaan Selesai terkunci. Rekening dan harga tidak bisa diubah.",
        ],
      }
    ),
    progress: bilingual(
      {
        purpose:
          "Progress Report is where you read site write-ups that later sit on a billing period. You do not write reports.",
        steps: [
          "Open Progress Report from the sidebar.",
          "Choose the client, then the project, then the day or month.",
          "Read the write-ups and photos if you need them before you Reconcile or Send For Review.",
          "On a finished day or month, use the download buttons. Today and the current month cannot be downloaded yet.",
        ],
        remember: [
          "Compiling a period happens in Invoice and Billing, not by approving each report.",
          "You cannot edit a staff report.",
        ],
      },
      {
        purpose:
          "Laporan Progress adalah tempat Anda membaca catatan lokasi yang nanti masuk periode tagihan. Anda tidak menulis laporan.",
        steps: [
          "Buka Laporan Progress dari sidebar.",
          "Pilih klien, lalu proyek, lalu hari atau bulan.",
          "Baca catatan dan foto jika Anda memerlukannya sebelum Rekonsiliasi atau Kirim Untuk Ditinjau.",
          "Pada hari atau bulan yang sudah selesai, pakai tombol unduh. Hari ini dan bulan berjalan belum bisa diunduh.",
        ],
        remember: [
          "Menyusun periode dilakukan di Invoice dan Penagihan, bukan dengan menyetujui tiap laporan.",
          "Anda tidak bisa mengubah laporan staf.",
        ],
      }
    ),
    invoicing: bilingual(
      {
        purpose:
          "Invoice and Billing is customer billing. You compile the period, send it for review, issue the invoice, and collect payment.",
        steps: [
          "Open Invoice and Billing. Choose the client, then the project.",
          "For a monthly contract (Regular Cleaning, Regular Landscaping, Security), wait until the day after the period end. When the row shows Ready To Reconcile, click Reconcile. Keep Amount or Adjust Amount, then Reconcile & Send or Adjust & Send.",
          "For General Cleaning or Facade, use Send For Review (or Submit For Approval on the project). That compiles Progress Reports for the period. It is not an approval of each report.",
          "If this client has a portal: they Approve or Revise in Reconciliation. Approve issues the invoice.",
          "If this client has no portal: use Download And Send, then Record Client Response (Approved or Revised).",
          "When money arrives, click Payment Received. If the status is Verifying Payment, click Confirm And Mark Paid.",
          "If tax is required on that period, click Upload Tax Document. Finish or End Contract is blocked while required tax or unpaid invoices are still open.",
        ],
        remember: [
          "A live Regular contract stays In Progress after a paid month. Crew stay assigned until End Contract.",
          "On a final General or Facade part, Approve can mark the project completed at that point, not at payment.",
        ],
      },
      {
        purpose:
          "Invoice dan Penagihan adalah tagihan pelanggan. Anda menyusun periode, mengirim tinjauan, menerbitkan invoice, dan menagih.",
        steps: [
          "Buka Invoice dan Penagihan. Pilih klien, lalu proyek.",
          "Untuk kontrak bulanan (Regular Cleaning, Regular Landscaping, Security), tunggu hari setelah akhir periode. Saat baris menunjukkan Siap Rekonsiliasi, klik Rekonsiliasi. Pertahankan Jumlah atau Sesuaikan Jumlah, lalu Rekonsiliasi & Kirim atau Sesuaikan & Kirim.",
          "Untuk General Cleaning atau Facade, pakai Kirim Untuk Ditinjau (atau Ajukan Persetujuan di proyek). Itu menyusun Laporan Progress untuk periode itu. Bukan persetujuan tiap laporan.",
          "Jika klien ini punya portal: mereka Setujui atau Revisi di Rekonsiliasi. Setujui menerbitkan invoice.",
          "Jika klien ini tidak punya portal: pakai Unduh Dan Kirim, lalu Catat Respons Klien (Disetujui atau Direvisi).",
          "Saat uang masuk, klik Pembayaran Diterima. Jika status Memverifikasi Pembayaran, klik Konfirmasi Dan Tandai Lunas.",
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
          "Reconciliation is the review inbox before an invoice is issued. You handle Head Office actions: revised amounts and clients who have no portal.",
        steps: [
          "Open Reconciliation.",
          "When a client with a portal sent a revise request, open the Revised tab. Click Approve Revision and enter the Revised Invoice Amount, or Reject Revision and Send Rejection To Client.",
          "If the client has no portal, use Record Client Response after you send the report outside the ERP (Approved or Revised).",
          "Approve from a client portal issues the invoice automatically. You do not click Approve for them.",
        ],
        remember: [
          "This is not an approval of each Progress Report. The client reviews the compiled period pack.",
          "Reconcile on Invoice and Billing must be done first for a Regular CICO period. Send For Review is the start for General or Facade packs.",
        ],
      },
      {
        purpose:
          "Rekonsiliasi adalah kotak tinjauan sebelum invoice terbit. Anda menangani tindakan Kantor Pusat: jumlah yang direvisi dan klien tanpa portal.",
        steps: [
          "Buka Rekonsiliasi.",
          "Saat klien dengan portal mengirim permintaan revisi, buka tab Direvisi. Klik Setujui Revisi dan isi Jumlah Invoice Revisi, atau Tolak Revisi dan Kirim Penolakan Ke Klien.",
          "Jika klien tidak punya portal, pakai Catat Respons Klien setelah Anda mengirim laporan di luar ERP (Disetujui atau Direvisi).",
          "Setujui dari portal klien menerbitkan invoice otomatis. Anda tidak mengklik Setujui untuk mereka.",
        ],
        remember: [
          "Ini bukan persetujuan tiap Laporan Progress. Klien meninjau paket periode yang sudah disusun.",
          "Rekonsiliasi di Invoice dan Penagihan harus selesai dulu untuk periode CICO Regular. Kirim Untuk Ditinjau adalah awal untuk paket General atau Facade.",
        ],
      }
    ),
    vendorPayments: bilingual(
      {
        purpose:
          "Payment & Settlement has two lists: Collections (unpaid client invoices) and Payables (open supplier bills). This login sees both.",
        steps: [
          "Open Payment & Settlement.",
          "For supplier bills, open Payables. An overdue chip means the due date has passed. Click Mark Paid (or open the bill in Expenses), attach proof, then Confirm Paid.",
          "Import bills that still need a Bank Rate must have that rate before you can Confirm Paid.",
          "For customer invoices, open Collections, then Open Invoice & Billing on that project. Click Payment Received, then Confirm And Mark Paid if the payment is still being verified.",
        ],
        remember: [
          "Paid supplier bills leave the Payables list. Reverse only if the payment was posted by mistake.",
          "A client portal never sees Payables.",
        ],
      },
      {
        purpose:
          "Pembayaran dan Pelunasan punya dua daftar: Penagihan (invoice klien belum lunas) dan Utang (tagihan pemasok terbuka). Login ini melihat keduanya.",
        steps: [
          "Buka Pembayaran dan Pelunasan.",
          "Untuk tagihan pemasok, buka Utang. Chip terlambat berarti tanggal jatuh tempo sudah lewat. Klik Tandai Dibayar (atau buka tagihan di Pengeluaran), lampirkan bukti, lalu Konfirmasi Lunas.",
          "Tagihan impor yang masih butuh Kurs Bank harus diisi kursnya sebelum dapat Konfirmasi Lunas.",
          "Untuk invoice pelanggan, buka Penagihan, lalu Buka Invoice dan Penagihan pada proyek itu. Klik Pembayaran Diterima, lalu Konfirmasi Dan Tandai Lunas jika pembayaran masih diverifikasi.",
        ],
        remember: [
          "Tagihan pemasok yang lunas keluar dari daftar Utang. Batalkan hanya jika pembayaran tercatat karena kesalahan.",
          "Portal klien tidak pernah melihat Utang.",
        ],
      }
    ),
  },

  warehouse: {
    dashboard: bilingual(
      {
        purpose:
          "Dashboard is the first page after you sign in. For this login it shows warehouse activity and office attendance.",
        steps: [
          "Open Dashboard from the top of the sidebar.",
          "Read Today's Attendance for office CICO on the Internal site.",
          "Use Inventory or Transfer Orders from the sidebar when a card needs action.",
        ],
        remember: [
          "You will not see client billing cards. A missing card means that module is off for this login.",
        ],
      },
      {
        purpose:
          "Dasbor adalah halaman pertama setelah masuk. Untuk login ini menampilkan aktivitas gudang dan kehadiran kantor.",
        steps: [
          "Buka Dasbor dari bagian atas sidebar.",
          "Baca Kehadiran Hari Ini untuk CICO kantor di lokasi Internal.",
          "Pakai Inventaris atau Transfer Barang dari sidebar saat sebuah kartu perlu tindakan.",
        ],
        remember: [
          "Anda tidak melihat kartu tagihan klien. Kartu yang hilang berarti modul itu mati untuk login ini.",
        ],
      }
    ),
    cico: bilingual(
      {
        purpose:
          "CICO for this login is office Check In and Check Out on the Internal warehouse site, with GPS and photos.",
        steps: [
          "Open CICO. Choose the Internal warehouse site if more than one site is listed.",
          "Be at the warehouse. Allow location. Take a Check-In Photo with Take / Upload Photo.",
          "Tap Check In. You must be inside the site radius.",
          "At the end of the day, take a Check-Out Photo, then tap Check Out.",
        ],
        remember: [
          "This is office CICO, not a commercial client site.",
          "You do not submit a Progress Report before Check Out unless that module is on and required for this login.",
        ],
      },
      {
        purpose:
          "CICO untuk login ini adalah Check In dan Check Out kantor di lokasi Internal gudang, dengan GPS dan foto.",
        steps: [
          "Buka CICO. Pilih lokasi Internal gudang jika ada lebih dari satu lokasi.",
          "Berada di gudang. Izinkan lokasi. Ambil Foto Check-In dengan Ambil / Unggah Foto.",
          "Ketuk Check In. Anda harus berada dalam radius lokasi.",
          "Di akhir hari, ambil Foto Check-Out, lalu ketuk Check Out.",
        ],
        remember: [
          "Ini CICO kantor, bukan lokasi klien komersial.",
          "Anda tidak mengirim Laporan Progress sebelum Check Out kecuali modul itu aktif dan wajib untuk login ini.",
        ],
      }
    ),
    progress: bilingual(
      {
        purpose:
          "Progress Report is where you read site write-ups if this module is on. Warehouse logins do not write commercial site reports.",
        steps: [
          "Open Progress Report from the sidebar.",
          "Choose the client (or Internal), then the project.",
          "Open a day to read reports and photos. You cannot edit a staff report.",
        ],
        remember: [
          "Writing a commercial Progress Report is a field-staff action.",
        ],
      },
      {
        purpose:
          "Laporan Progress adalah tempat Anda membaca catatan lokasi jika modul ini aktif. Login gudang tidak menulis laporan lokasi komersial.",
        steps: [
          "Buka Laporan Progress dari sidebar.",
          "Pilih klien (atau Internal), lalu pilih proyek.",
          "Buka satu hari untuk membaca laporan dan foto. Anda tidak bisa mengubah laporan staf.",
        ],
        remember: [
          "Menulis Laporan Progress komersial adalah tindakan staf lapangan.",
        ],
      }
    ),
    inventory: bilingual(
      {
        purpose:
          "Inventory is the warehouse book: stock on hand, coded equipment, and vehicles. Purchases are recorded in Expenses. This page follows those bills.",
        steps: [
          "Open Inventory from the sidebar.",
          "Use the product list to see quantities. Open an equipment name to see coded units.",
          "Open Vehicles to see number plates. Click a vehicle to change the plate if it was re-registered, read the lease progress, and open the cost log.",
          "Issue stock to a project from this page when operations asks. Do not type a purchase again here.",
        ],
        remember: [
          "New catalog types are created in Goods Catalog, not on this page.",
          "Do not record the same purchase again. Inventory follows the Expenses bill.",
        ],
      },
      {
        purpose:
          "Inventaris adalah buku gudang: stok, peralatan berkode, dan kendaraan. Pembelian dicatat di Pengeluaran. Halaman ini mengikuti tagihan itu.",
        steps: [
          "Buka Inventaris dari sidebar.",
          "Pakai daftar produk untuk melihat jumlah. Buka nama peralatan untuk melihat unit berkode.",
          "Buka Kendaraan untuk melihat nomor plat. Klik kendaraan untuk mengubah plat jika diganti, membaca progres sewa, dan membuka log biaya.",
          "Keluarkan stok ke proyek dari halaman ini saat operasi meminta. Jangan mengetik pembelian lagi di sini.",
        ],
        remember: [
          "Jenis katalog baru dibuat di Katalog Barang, bukan di halaman ini.",
          "Jangan mencatat pembelian yang sama lagi. Inventaris mengikuti tagihan Pengeluaran.",
        ],
      }
    ),
    transferOrders: bilingual(
      {
        purpose:
          "Transfer Orders is how warehouse sends goods to a site after a Material Request is approved.",
        steps: [
          "Open Transfer Orders from the sidebar.",
          "Open a requested order. Pick the units or quantities to send, then mark it Sent.",
          "If the site clicks Did Not Receive, use Complete Item Return or send it to Needs Attention for a manager in Approvals.",
          "When the site clicks Confirm Received, the order is closed.",
        ],
        remember: [
          "Confirm Received needs the order to be Sent.",
          "Field staff raise Material Requests. You fulfill them here.",
        ],
      },
      {
        purpose:
          "Transfer Barang adalah cara gudang mengirim barang ke lokasi setelah Permintaan Material disetujui.",
        steps: [
          "Buka Transfer Barang dari sidebar.",
          "Buka pesanan yang diminta. Pilih unit atau jumlah yang dikirim, lalu tandai Terkirim.",
          "Jika lokasi klik Tidak Diterima, pakai Selesaikan Retur Item atau kirim ke Perlu Perhatian untuk manajer di Persetujuan.",
          "Saat lokasi klik Konfirmasi Diterima, pesanan tertutup.",
        ],
        remember: [
          "Konfirmasi Diterima membutuhkan status Terkirim.",
          "Staf lapangan membuat Permintaan Material. Anda memenuhinya di sini.",
        ],
      }
    ),
  },
};
