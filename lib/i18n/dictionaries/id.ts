import type { EnMessages } from "@/lib/i18n/dictionaries/en";

/** Nested dictionary with string leaves (locales may differ in wording). */
type DeepStringLeaves<T> = {
  [K in keyof T]: T[K] extends string
    ? string
    : T[K] extends Record<string, unknown>
      ? DeepStringLeaves<T[K]>
      : T[K];
};

/** Bahasa Indonesia UI messages — mirrors English key structure. */
export const id = {
  header: {
    today: "Hari ini",
    language: "Bahasa",
    english: "English",
    bahasaIndonesia: "Bahasa Indonesia",
    theme: "Tema",
    light: "Terang",
    dark: "Gelap",
    goodMorning: "Selamat Pagi",
    goodAfternoon: "Selamat Siang",
    goodEvening: "Selamat Malam",
    guest: "Tamu",
    user: "Pengguna",
    signOut: "Keluar",
    signOutConfirm: "Yakin ingin keluar?",
    dashboardAria: "RGS ONE — Dasbor"
  },

  ui: {
    clearSearch: "Hapus pencarian",
    countryCode: "Kode negara",
    phoneExcludeCountryCode: "Jangan sertakan kode negara",
    moreActions: "Tindakan lainnya",
    dragToReorder: "Seret untuk mengurutkan ulang",
    reorder: "Urutkan ulang",
    previousPhoto: "Foto Sebelumnya",
    nextPhoto: "Foto Berikutnya",
    noRecordsFound: "Tidak ada data.",
    proofPreview: {
      description:
        "Lihat bukti terlampir. Tekan Escape atau klik di luar untuk menutup."
    },
    rejectionNotice: {
      title: "Tindakan tidak dapat diselesaikan",
      description:
        "Tinjau masalah di bawah, perbaiki sesuai petunjuk, lalu coba lagi.",
      acknowledge: "OK",
      importTitle: "Baris impor perlu perhatian",
      importDescription:
        "Baris berikut tidak diterima. Perbaiki di file Excel, lalu unggah ulang.",
      validationTitle: "Harap perbaiki lalu coba lagi",
      validationDescription:
        "Ada yang perlu diperbaiki sebelum tindakan ini dapat dilanjutkan.",
      serverUnreachable:
        "Tidak dapat menghubungi server. Pastikan aplikasi sedang berjalan, lalu coba lagi."
    }
  },

  common: {
    actions: {
      add: "Tambah",
      edit: "Ubah",
      delete: "Hapus",
      save: "Simpan",
      cancel: "Batal",
      close: "Tutup",
      confirm: "Konfirmasi",
      clear: "Hapus pilihan",
      back: "Kembali",
      submit: "Kirim",
      approve: "Setujui",
      reject: "Tolak",
      restore: "Pulihkan",
      download: "Unduh",
      upload: "Unggah",
      view: "Lihat",
      addBulk: "Tambah Massal",
      saveChanges: "Simpan Perubahan",
      deleteSelected: "Hapus terpilih",
      restoreSelected: "Pulihkan",
      permanentlyDelete: "Hapus permanen",
      permanentlyDelete1: "Hapus",
      permanentlyDelete2: "Permanen",
      processing: "Memproses...",
      saving: "Menyimpan...",
      deleting: "Menghapus...",
      submitting: "Mengirim...",
      moving: "Memindahkan…",
      adding: "Menambahkan...",
      loading: "Memuat...",
      yes: "Ya",
      no: "Tidak",
      all: "Semua",
      select: "Pilih",
      done: "Selesai",
      remove: "Hapus",
      update: "Perbarui",
      copy: "Salin"
    },
    paymentTerms: {
      cashShort: "Tunai",
      netShort: "Net {days}",
      cash: "Tunai — jatuh tempo saat invoice dikirim",
      net: "Net {days} — jatuh tempo dalam {days} hari",
      netMonths: "Net {days} ({months} bulan)"
    },
    labels: {
      status: "Status",
      type: "Jenis",
      date: "Tanggal",
      dates: "Tanggal",
      time: "Waktu",
      month: "Bulan",
      year: "Tahun",
      wholeMonth: "Satu Bulan",
      wholeYear: "Satu Tahun",
      description: "Deskripsi",
      actions: "Aksi",
      client: "Klien",
      employee: "Karyawan",
      employees: "Karyawan",
      department: "Departemen",
      prefix: "Awalan",
      period: "Periode",
      active: "Aktif",
      inactive: "Nonaktif",
      searchProjects: "Cari Proyek...",
      searchBankAccounts: "Cari Rekening Bank...",
      noMatchingProjects: "Tidak ada proyek yang cocok dengan pencarian ini.",
      noMatchingBankAccounts: "Tidak ada rekening bank yang cocok dengan pencarian ini.",
      noResults: "Tidak ada hasil",
      unknown: "Tidak diketahui",
      na: "—",
      dropFileOrBrowse: "Jatuhkan file di sini atau telusuri",
      dropFilesOrBrowse: "Jatuhkan file di sini atau telusuri",
      fileMustBeImageOrPdf: "Gunakan foto atau PDF.",
      fileMustBeImage: "Gunakan foto.",
      selectedCount: "{count} dipilih",
      showingCount: "Menampilkan {count}",
      ofTotal: "dari {total}"
    },
    empty: {
      description: "Tidak ada data untuk ditampilkan pada tampilan ini."
    },
    errors: {
      generic: "Terjadi kesalahan. Silakan coba lagi.",
      tryAgain: "Silakan coba lagi.",
      bulkFailed: "Aksi massal gagal. Silakan coba lagi."
    },
    confirm: {
      cannotUndo: "Tindakan ini tidak dapat dibatalkan.",
      unsavedTitle: "Perubahan belum disimpan",
      unsavedDescription:
        "Anda memiliki perubahan yang belum disimpan. Yakin ingin keluar?",
      exitWithoutSaving: "Keluar tanpa menyimpan",
      keepEditing: "Lanjutkan mengedit"
    },
    roles: {
      admin: "Admin",
      client: "Klien",
      employee: "Karyawan",
      vendor: "Pemasok"
    }
  },

  nav: {
    sections: {
      Dashboard: "Dasbor",
      Administration: "Administrasi",
      Operations: "Operasional",
      "Human Resources": "Sumber Daya Manusia",
      Finance: "Keuangan"
    },
    items: {
      Dashboard: "Dasbor",
      Clients: "Klien",
      Vendors: "Pemasok",
      Employees: "Karyawan",
      Users: "Pengguna",
      "Website CMS": "CMS Situs Web",
      Projects: "Proyek",
      "All Projects": "Semua Proyek",
      Planning: "Perencanaan",
      "In Progress": "Berjalan",
      "Pending Approval": "Menunggu Persetujuan",
      "Payment Due": "Menunggu Pembayaran",
      "Completed Projects": "Proyek Selesai",
      Finance: "Keuangan",
      "Invoice and Billing": "Invoice & Penagihan",
      "All Billing": "Semua Penagihan",
      Reconciliation: "Rekonsiliasi",
      "Tax Invoice": "Faktur Pajak",
      Tax: "Pajak",
      Purchases: "Pengeluaran",
      Expenses: "Pengeluaran",
      Loans: "Pinjaman",
      Loan: "Pinjaman",
      BPJS: "BPJS",
      Sales: "Penjualan",
      "Petty Cash": "Kas Kecil",
      "Upload History": "Riwayat Unggah",
      "Payment & Settlement": "Pembayaran & Pelunasan",
      THR: "THR",
      Payroll: "Penggajian Internal",
      "Internal Payroll": "Penggajian Internal",
      "Financial Report": "Laporan Keuangan",
      VAT: "PPN",
      "Progress Reports": "Laporan Progress",
      "Progress Report": "Laporan Progress",
      CICO: "CICO",
      "Attendance Report": "Laporan Kehadiran",
      Shifts: "Shift",
      "Leave & Sick": "Izin & Sakit",
      Approvals: "Persetujuan",
      "Material Requests": "Permintaan Material",
      "Transfer Orders": "Transfer Barang",
      "Monthly Reports": "Laporan Klien",
      "Client Reports": "Laporan Klien",
      Inventory: "Inventaris",
      "Item Catalog": "Katalog Barang",
      "Goods Catalog": "Katalog Barang",
      "Company Details": "Detail Perusahaan",
      Teams: "Tim",
      Assignment: "Penugasan",
      "Team Availability": "Ketersediaan Tim"
    },
    collapse: "Ciutkan {label}",
    expand: "Perluas {label}",
    openMenu: "Buka Navigasi",
    closeMenu: "Tutup Navigasi",
    menuTitle: "Navigasi",
    menuDescription:
      "Jelajahi bagian dan modul sidebar seperti Administrasi, Operasi, SDM, dan Keuangan.",
    rearrange: "Susun Ulang Sidebar",
    rearrangeTitle: "Susun Ulang Sidebar",
    rearrangeDescription:
      "Susun ulang kategori, modul, dan item bersarang dengan ↑ / ↓ atau seret, lalu Simpan. Hanya modul yang dapat Anda akses yang ditampilkan.",
    rearrangeShort: "Susun Ulang",
    saveOrder: "Simpan Urutan",
    resetOrder: "Kembali Ke Bawaan",
    orderSaved: "Urutan sidebar disimpan",
    orderSaveFailed: "Gagal menyimpan urutan sidebar",
    dragToReorder: "Seret Untuk Menyusun Ulang",
    dragItem: "Seret {label}",
    dragCategory: "Seret kategori {label}",
    moveUp: "Pindahkan {label} ke atas",
    moveDown: "Pindahkan {label} ke bawah",
    hideSubItems: "Sembunyikan {count} Sub-Item",
    showSubItems: "Tampilkan {count} Sub-Item",
    underItem: "Di Bawah {label}",
    loadingMenu: "Memuat menu Anda…",
    noModules: "Tidak ada modul tersedia."
  },

  status: {
    project: {
      PLANNED: "Perencanaan",
      IN_PROGRESS: "Berjalan",
      WAITING_FOR_APPROVAL: "Menunggu Persetujuan",
      OFF_SITE: "Di luar lokasi",
      ON_HOLD: "Ditunda",
      COMPLETED: "Selesai",
      CANCELLED: "Dibatalkan"
    },
    workflow: {
      Planning: "Perencanaan",
      "In Progress": "Berjalan",
      "Pending Approval": "Menunggu Persetujuan",
      "Waiting for Approval": "Menunggu Persetujuan",
      "Off-site": "Di luar lokasi",
      "Payment Due": "Menunggu Pembayaran",
      "Awaiting payment": "Menunggu pembayaran",
      Completed: "Selesai",
      Cancelled: "Dibatalkan"
    },
    workflowChip: {
      inProgress1: "Sedang",
      inProgress2: "Berjalan",
      paymentDue1: "Menunggu",
      paymentDue2: "Pembayaran",
      waitingForApproval1: "Menunggu",
      waitingForApproval2: "Persetujuan",
      pendingApproval1: "Menunggu",
      pendingApproval2: "Persetujuan",
      awaitingPayment1: "Menunggu",
      awaitingPayment2: "pembayaran"
    },
    billing: {
      ONGOING: "Berjalan",
      COMPILING: "Disusun",
      AWAITING_CLIENT_REVIEW: "Menunggu Review Klien",
      AWAITING_PAYMENT: "Menunggu Pembayaran",
      PENDING_VERIFICATION: "Verifikasi Pembayaran",
      PAID: "Lunas",
      OVERDUE: "Terlambat",
      LATE: "Terlambat"
    },
    billingChip: {
      awaitingPayment1: "Menunggu",
      awaitingPayment2: "Pembayaran",
      awaitingInvoice1: "Menunggu",
      awaitingInvoice2: "Invoice",
      verifyingPayment1: "Verifikasi",
      verifyingPayment2: "Pembayaran",
      readyToReconcile1: "Siap",
      readyToReconcile2: "Rekonsiliasi",
      readyToInvoice1: "Siap",
      readyToInvoice2: "Invoice",
      awaitingClientReview1: "Menunggu",
      awaitingClientReview2: "Persetujuan",
      taxInvoiceDue1: "Pajak",
      taxInvoiceDue2: "Menunggu",
      taxInvoiceDone1: "Faktur Pajak",
      taxInvoiceDone2: "Terkirim",
      latePayment1: "Bayar",
      latePayment2: "Terlambat",
      paymentDue1: "Menunggu",
      paymentDue2: "Pembayaran",
      invoiceDue1: "Invoice",
      invoiceDue2: "Jatuh Tempo"
    },
    leave: {
      PENDING: "Menunggu",
      APPROVED: "Disetujui",
      REJECTED: "Ditolak",
      CANCELLED: "Dibatalkan"
    },
    clientReview: {
      NONE: "—",
      AWAITING_CLIENT: "Menunggu Klien",
      CLIENT_APPROVED: "Disetujui Klien",
      CLIENT_REVISED: "Direvisi Klien",
      HO_APPROVED_REVISION: "Revisi Disetujui",
      HO_REJECTED_REVISION: "Revisi Ditolak"
    },
    clientReviewChip: {
      AWAITING_CLIENT1: "Menunggu",
      AWAITING_CLIENT2: "Klien",
      CLIENT_APPROVED1: "Disetujui",
      CLIENT_APPROVED2: "Klien",
      CLIENT_REVISED1: "Direvisi",
      CLIENT_REVISED2: "Klien",
      HO_APPROVED_REVISION1: "Revisi",
      HO_APPROVED_REVISION2: "Disetujui",
      HO_REJECTED_REVISION1: "Revisi",
      HO_REJECTED_REVISION2: "Ditolak"
    },
    reviewKind: {
      PROGRESS: "Progress",
      RECONCILIATION: "Rekonsiliasi",
      PAYROLL_MANAGEMENT: "Manajemen Payroll"
    },

    subcategory: {
      REGULAR_CLEANING: "Pembersihan Rutin",
      GENERAL_CLEANING: "Pembersihan General",
      FACADE_CLEANING: "Pembersihan Fasad",
      CONTRACT_GENERAL_CLEANING: "Pembersihan General",
      CONTRACT_FACADE_CLEANING: "Pembersihan Fasad",
      REGULAR_LANDSCAPING: "Lanskap Rutin",
      ONE_TIME_LANDSCAPING: "Lanskap Satu Kali",
      INTERNAL: "Proyek Internal",
      SECURITY: "Security",
      ONE_TIME_SECURITY: "Security Satu Kali",
      PARKING: "Parking",
      PAYROLL_MANAGEMENT: "Manajemen Payroll",
      short: {
        REGULAR_CLEANING: "Rutin",
        GENERAL_CLEANING: "General",
        FACADE_CLEANING: "Fasad",
        CONTRACT_GENERAL_CLEANING: "General",
        CONTRACT_FACADE_CLEANING: "Fasad",
        REGULAR_LANDSCAPING: "Rutin",
        ONE_TIME_LANDSCAPING: "Satu Kali",
        INTERNAL: "Internal",
        SECURITY: "Security",
        ONE_TIME_SECURITY: "Satu Kali",
        PARKING: "Parking",
        PAYROLL_MANAGEMENT: "Payroll"
      },
      cleaningSuffix: "Pembersihan",
      landscapingSuffix: "Lanskap",
      projectSuffix: "Proyek",
      serviceSuffix: "Layanan"
    },
    billingMode: {
      MONTHLY: "Bulanan",
      ON_COMPLETION: "Saat selesai",
      MILESTONE: "Bertahap",
      MULTI_VISIT: "Kunjungan berulang"
    },
    billingPeriodBasis: {
      CALENDAR_MONTH: "Bulan Kalender",
      CONTRACT_CYCLE: "Periode Kustom"
    },
    department: {
      corporate: "Korporat",
      headOffice: "Kantor Pusat",
      warehouse: "Gudang",
      operations: "Operasi",
      finance: "Keuangan",
      cleaningStaff: "Staf Kebersihan",
      generalCleaning: "Kebersihan Umum",
      gondola: "Gondola",
      unassigned: "Belum Ditugaskan"
    },
    jobTitle: {
      ceo: "Direktur Utama",
      directorOfOperations: "Direktur Operasi",
      operationsManager: "Manajer Operasi",
      areaManager: "Manajer Area",
      cleaningStaff: "Staf Kebersihan",
      generalCleaningStaff: "Staf Kebersihan Umum",
      gondolaStaff: "Staf Gondola",
      technician: "Teknisi",
      owner: "Pemilik",
      technicianSales: "Teknisi / Penjualan",
      salesManager: "Manajer Penjualan",
      accountExecutive: "Eksekutif Akun",
      salesCoordinator: "Koordinator Penjualan",
      keyAccount: "Akun Utama",
      salesSupervisor: "Supervisor Penjualan",
      procurementManager: "Manajer Pengadaan",
      facilityManager: "Manajer Fasilitas",
      operationsLead: "Pimpinan Operasi",
      homeowner: "Pemilik Rumah",
      buildingManager: "Manajer Gedung",
      exportManager: "Manajer Ekspor",
    }
  },

  pages: {
    dashboard: {
      title: "Dasbor",
      yourBilling: "Penagihan Anda",
      yourBillingDesc:
        "Metrik hanya untuk akun pemasok Anda — tanpa data seluruh perusahaan.",
      vendorInvoices: "Invoice Anda",
      vendorInvoicesDesc: "Faktur pembelian yang tertaut ke akun Anda",
      vendorAwaitingTax: "Perlu Faktur Pajak",
      vendorAwaitingTaxDesc: "PPN masukan yang masih perlu diunggah",
      vendorTaxUploaded: "Faktur pajak terunggah",
      vendorTaxUploadedDesc: "Faktur pajak sudah tersimpan",
      vendorPayments: "Terlambat / terbuka",
      vendorPaymentsDesc: "Tagihan lewat jatuh tempo vs masih terbuka (hanya lihat)",
      vendorOpenInvoices: "Buka invoice",
      vendorOpenTax: "Unggah faktur pajak",
      vendorOpenPayments: "Pembayaran & pelunasan",
      todaysOperations: "Operasional Hari Ini",
      todaysOperationsDesc: "Metrik tenaga kerja dan proyek secara langsung",
      workforcePresence: "Kehadiran tenaga kerja dan persetujuan",
      systemOverview: "Ringkasan Sistem",
      systemOverviewDesc: "Total direktori dan akun",
      yourProjects: "Proyek Anda",
      yourProjectsDesc: "Metrik hanya untuk lokasi organisasi Anda",
      staffPresentToday: "Staf Hadir Hari Ini",
      notCheckedIn: "{count} belum check-in",
      notCheckedInOnSites: "{count} belum check-in di lokasi Anda",
      pendingApprovals: "Menunggu Persetujuan",
      activeProjects: "Proyek Aktif",
      viewAll: "Lihat semua →",
      progressReportCountOne: "{count} laporan progress",
      progressReportCountOther: "{count} laporan progress",
      noActiveProjects: "Tidak ada proyek aktif",
      noActiveProjectsDesc:
        "Proyek yang sedang berjalan dan direncanakan akan muncul di sini.",
      totalInSystem: "{count} total di sistem",
      totalForOrg: "{count} total untuk organisasi Anda",
      activeEmployees: "Karyawan Aktif",
      currentlyOnPayroll: "Sedang dalam daftar gaji",
      siteStaffAssigned: "Staf Lokasi Ditugaskan",
      fieldStaffOnSites: "Staf lapangan di lokasi aktif Anda",
      recentActivity: "Aktivitas Terbaru",
      noRecentActivity: "Belum ada aktivitas terbaru.",
      noRecentActivityTitle: "Belum ada aktivitas terbaru",
      noRecentActivityDesc:
        "Laporan progress dan permintaan izin akan muncul di sini.",
      progressReport: "Laporan progress · {project}",
      photoOne: "{count} foto",
      photoOther: "{count} foto",
      serviceArea: "Area Layanan",
      checkedIn: "Sudah check-in",
      leaveRequest: "Permintaan izin",
      requiresReview: "Perlu tinjauan Anda",
      allCaughtUp: "Semua sudah selesai",
      systemUsers: "Pengguna sistem",
      loginAccounts: "Akun login",
      activeClients: "Klien aktif",
      availableForProjects: "Tersedia untuk proyek",
      departments: "Departemen",
      employeeCategories: "Kategori karyawan",
      totalProjects: "Total proyek",
      inProgressCount: "{count} sedang berjalan",
      guestName: "Pengguna",
      awaitingManagerReview: "Menunggu tinjauan manajer",
      noPendingRequests: "Tidak ada permintaan menunggu",
      todaysAttendance: "Kehadiran Hari Ini",
      myAttendanceToday: "Kehadiran Saya Hari Ini",
      todaysAttendanceStats:
        "{present} hadir · {absent} tidak hadir · {rate}% sudah check-in",
      notCheckedInYet: "Belum check-in",
      checkedInAndOut: "Sudah check-in dan check-out",
      personalCheckInHint:
        "Check-in Anda hari ini akan muncul di sini setelah Anda clock-in.",
      teamCheckInHint:
        "Catatan muncul di sini saat karyawan check-in hari ini.",
      showingLatestCheckIns: "Menampilkan {count} check-in terbaru",
      attendanceReport: "Laporan Progress",
      attendanceIn: "Masuk",
      attendanceOut: "Keluar"
    },
    projects: {
      title: "Proyek",
      allTitle: "Semua Proyek",
      planningTitle: "Perencanaan",
      inProgressTitle: "Berjalan",
      pendingApprovalTitle: "Menunggu Persetujuan",
      paymentDueTitle: "Menunggu Pembayaran",
      openBilling: "Buka Penagihan",
      completedTitle: "Proyek Selesai",
      addProject: "Tambah Proyek",
      bankAccount: "Rekening Bank",
      bankAccountHint:
        "Dicetak pada invoice proyek ini. Bisa diubah nanti di halaman proyek.",
      bankAccountChangeHint:
        "Mengubah ini tidak menulis ulang invoice yang sudah diterbitkan.",
      bankAccountEmpty: "Tambah rekening bank di Detail Perusahaan terlebih dahulu.",
      bankAccountRequired: "Pilih rekening bank yang dibayar klien.",
      bankAccountPlaceholder: "Pilih Rekening Bank",
      bankAccountSaved: "Rekening Bank disimpan.",
      newProject: "Proyek Baru",
      createProject: "Buat Proyek",
      creating: "Membuat...",
      bulkCreateTitle: "Tambah proyek secara massal",
      bulkCreateDesc:
        "Tambah lebih dari satu proyek sekaligus. Setiap baris sama seperti Tambah Proyek — isi semua untuk proyek itu.",
      bulkCreateLines: "Proyek",
      bulkCreateLinesHint:
        "Setiap baris adalah catatan proyek lengkap. Tidak ada ketentuan bersama.",
      editProject: "Ubah Proyek",
      createDescription:
        "Siapkan proyek dengan klien, lokasi di peta, dan staf yang ditugaskan.",
      createDescriptionContract:
        "Siapkan kontrak Regular Cleaning berkelanjutan dengan lokasi dan staf standby.",
      createDescriptionMilestone:
        "Siapkan pekerjaan General atau Facade dengan jadwal pembayaran bertahap.",
      createDescriptionLandscapingContract:
        "Siapkan kontrak Lanskap Rutin berkelanjutan dengan lokasi dan staf standby.",
      createDescriptionLandscapingOneTime:
        "Siapkan Lanskap Satu Kali dengan rencana pembayaran yang dapat ditagih nanti.",
      projectName: "Nama proyek",
      selectClient: "Pilih klien",
      startingStage: "Tahap Awal",
      serviceArea: "Area Layanan",
      serviceAreaCleaning: "Cleaning",
      serviceAreaLandscaping: "Landscaping",
      serviceAreaParking: "Parking",
      serviceAreaSecurity: "Security",
      serviceAreaPayroll: "Manajemen Payroll",
      serviceAreaHeadOffice: "Head Office",
      subcategory: "Subkategori",
      oneTime: "Satu Kali",
      oneTimeType: "Jenis Satu Kali",
      formRegular: "Rutin",
      addServiceArea: "Tambah Area Layanan",
      addSubcategory: "Tambah Subkategori",
      catalogAreaTitle: "Tambah Area Layanan",
      catalogAreaDescription:
        "Buat area layanan yang dapat dipilih di Tambah Proyek. Pilih apakah area ini dapat memiliki proyek Satu Kali.",
      catalogSubTitle: "Tambah Subkategori",
      catalogSubDescription:
        "Tambah subkategori di bawah area layanan yang dipilih.",
      catalogName: "Nama",
      catalogNameId: "Nama (Indonesia)",
      catalogNamePlaceholder: "mis. Manajemen Limbah",
      catalogBillingKind: "Penagihan",
      catalogBillingContract: "Kontrak",
      catalogBillingOneTime: "Satu Kali",
      catalogCreating: "Menambah...",
      catalogCreateArea: "Tambah Area Layanan",
      catalogCreateSub: "Tambah Subkategori",
      manageServiceAreas: "Kelola Area Layanan",
      manageServiceAreasTitle: "Area Layanan",
      manageServiceAreasDescription:
        "Tambah, ubah, atau hapus area layanan. Klik area layanan untuk mengelola subkategorinya.",
      manageSubcategoriesDescription:
        "Tambah, ubah nama, atau hapus subkategori untuk area layanan ini. Ubah dipakai untuk area layanan ini, termasuk Satu Kali.",
      serviceAreaCount: "{count} area layanan",
      serviceAreaCountOne: "{count} area layanan",
      subcategoryManageCount: "{count} subkategori",
      subcategoryManageCountOne: "{count} subkategori",
      emptyServiceAreas:
        "Belum ada area layanan. Tambah satu untuk dipakai di Tambah Proyek.",
      emptyCatalogSubcategories: "Tidak ada subkategori di area layanan ini.",
      backToServiceAreas: "Kembali Ke Area Layanan",
      catalogEnableOneTime: "Aktifkan Satu Kali",
      catalogEnableOneTimeHint:
        "Ya memungkinkan proyek sekali jalan untuk area layanan ini.",
      catalogProjects: "Proyek",
      catalogEditAreaTitle: "Ubah Area Layanan",
      catalogEditAreaDescription:
        "Perbarui nama area layanan dan apakah area ini dapat memiliki proyek Satu Kali.",
      catalogEditSubTitle: "Ubah Subkategori",
      catalogEditSubDescription:
        "Perbarui nama subkategori dan apakah subkategori ini Satu Kali.",
      catalogSubOneTimeHint:
        "Ya menjadikan subkategori ini Satu Kali di Tambah Proyek.",
      catalogOneTimeLockedAreaHint:
        "Parking dan Manajemen Payroll tetap kontrak saja.",
      catalogOneTimeLockedSubHint:
        "Subkategori ini tidak dapat dijadikan Satu Kali.",
      catalogDeleteAreaTitle: "Hapus Area Layanan?",
      catalogDeleteAreaConfirm: "Hapus Area Layanan",
      catalogDeleteAreaDescEmpty:
        "Area layanan ini akan dihapus secara permanen.",
      catalogDeleteAreaDescInUse:
        "Area layanan ini tidak dapat dihapus selama masih ada proyek yang berjalan.",
      catalogDeleteSubTitle: "Hapus Subkategori?",
      catalogDeleteSubConfirm: "Hapus Subkategori",
      catalogDeleteSubDescEmpty:
        "Subkategori ini akan dihapus secara permanen.",
      catalogDeleteSubDescInUse:
        "Subkategori ini tidak dapat dihapus selama masih ada proyek yang berjalan.",
      catalogAreaInUseOne:
        "{count} proyek berjalan masih memakai area layanan ini.",
      catalogAreaInUseOther:
        "{count} proyek berjalan masih memakai area layanan ini.",
      catalogSubInUseOne:
        "{count} proyek berjalan masih memakai subkategori ini.",
      catalogSubInUseOther:
        "{count} proyek berjalan masih memakai subkategori ini.",
      catalogUpdateAreaFailed: "Tidak dapat memperbarui area layanan.",
      catalogUpdateSubFailed: "Tidak dapat memperbarui subkategori.",
      catalogDeleteAreaFailed: "Tidak dapat menghapus area layanan.",
      catalogDeleteSubFailed: "Tidak dapat menghapus subkategori.",
      directoryChipAll: "Semua",
      directoryChipInternal: "Internal",
      directoryChipOneTime: "Satu Kali",
      directoryChipCleaning: "Cleaning",
      directoryChipSecurity: "Security",
      directoryChipParking: "Parking",
      directoryChipPayroll: "Payroll",
      directoryChipLandscaping: "Landscaping",
      directorySubRegular: "Rutin",
      directorySubGeneral: "General",
      directorySubFacade: "Fasad",
      directorySubLandscaping: "Landscaping",
      directorySubSecurity: "Security",
      directorySubCleaning: "Cleaning",
      billingPeriodBasis: "Periode Penagihan",
      billingPeriodBasisCalendarMonth: "Bulan Kalender",
      billingPeriodBasisContractCycle: "Periode Kustom",
      billingCycleFromDay: "Dari Hari",
      billingCycleToDay: "Sampai Hari",
      billingPeriodBasisHelp:
        "Bulan Kalender menagih tiap bulan kalender. Periode Kustom berulang setiap bulan dari hari yang Anda pilih sampai hari lainnya. Jika Sampai Hari sama atau sebelum Dari Hari, periode berakhir di bulan berikutnya.",
      createDescriptionService:
        "Siapkan Security, Parking, atau Manajemen Payroll dengan syarat komersial untuk klien ini.",
      serviceCommercial: {
        monthlyFee: "Biaya Bulanan",
        monthlyFeeHint: "Biaya layanan security bulanan yang dibayar klien ke RGS (IDR).",
        setupCost: "Biaya Setup Awal",
        setupCostHint: "Biaya setup parking sekali bayar (IDR).",
        profitSharePercent: "% Bagian Laba Klien",
        profitSharePercentHint:
          "Persentase laba yang dibagi ke klien. 0 berarti tidak ada bagi hasil — setelah biaya setup / biaya bulanan yang kami bayar ke klien, semuanya untuk RGS.",
        monthlyClientFee: "Biaya Bulanan ke Klien",
        memberParkingUnitFee: "Biaya Member Parkir Per Mobil",
        memberParkingUnitFeeHint:
          "Biaya bulanan tetap per mobil member. Jumlah ini tidak dikenai pajak.",
        memberParkingUnitCount: "Jumlah Mobil Member",
        memberParkingUnitCountHint:
          "Berapa mobil member yang terdaftar. Biaya member × jumlah mobil tidak kena pajak. Pendapatan parkir lain kena pajak.",
        parkingTaxPercent: "% Pajak Parkir Kasual",
        parkingTaxPercentHint:
          "Pajak hanya pada parkir kasual (lalu lintas biasa). Default 10. Parkir member tidak dikenai pajak.",
        serviceFeePercent: "% Biaya Manajemen",
        serviceFeePercentHint:
          "Ketik persentase biaya manajemen untuk pekerjaan ini. Tidak ada nilai bawaan.",
        paymentTermsDays: "Syarat Pembayaran",
        paymentTermsDaysHint:
          "Berapa hari setelah invoice proyek ini sampai klien membayar. Klien yang sama, proyek berbeda, syarat bisa berbeda.",
        payrollCutoffEndDay: "Hari Cutoff",
        payrollCutoffHint:
          "Hari berakhirnya setiap periode gaji. Tanggal akhir kontrak disesuaikan ke hari cutoff ini. Jika kontrak mulai di tengah periode, periode pertama hanya sisa hari sampai cutoff ini.",
        payrollTaxPercent: "% Pajak Pada Biaya",
        payrollTaxPercentHint:
          "Pajak hanya pada biaya manajemen, bukan pada gaji. Default 11. Bisa diubah nanti di halaman proyek.",
        payrollTimelineHint:
          "Tanggal mulai plus durasi. Hari terakhir disesuaikan ke cutoff klien. Staf check-in; Head Office mengisi gaji dari check-in dan dapat memotong sebelum Buat PDF.",
        payrollEconomicsHint:
          "Ekonomi: gaji yang ditalangi = biaya; % biaya manajemen = laba Relasi Global Solusi; pajak hanya pada biaya; tagihan klien = gaji + biaya + pajak."
      },
      billingLabel: "Penagihan",
      companyNpwp: "NPWP / NIK",
      companyNpwpHint:
        "Nomor pajak klien yang dipakai pada faktur pajak. Ubah di Direktori Klien.",
      withoutTaxNote:
        "Klien ini belum punya NPWP atau NIK. Tambahkan di data klien — faktur pajak membutuhkan salah satunya.",
      chargedTaxKind: "Pajak Apa Yang Kita Kenakan Pada Proyek Ini",
      chargedTaxKindHint:
        "Pilih pajak yang kita kenakan pada klien ini. Pajak Pertambahan Nilai berarti kita menerbitkan faktur pajak. Pajak penghasilan dipotong atau final. Pajak Lainnya meminta nama dan persen.",
      chargedTaxKindPlaceholder: "Pilih Pajak",
      chargedTaxKindRequired: "Pilih pajak yang kita kenakan pada proyek ini.",
      pphRatePercent: "Tarif Pajak Penghasilan",
      pphRatePercentHint:
        "Potongan Pasal 23 biasanya 2%. Ubah jika proyek ini memakai tarif lain.",
      pphRatePercentPlaceholder: "mis. 2",
      pphRatePercentRequired: "Masukkan tarif pajak penghasilan untuk proyek ini.",
      withoutTax: "Tanpa Pajak",
      deleteProject: "Hapus proyek?",
      deleteProjectConfirm: "Hapus proyek",
      deleteProjectDescription:
        "Proyek ini akan dihapus permanen dari proyek aktif. Tindakan ini tidak dapat dibatalkan.",
      deleteProjectPaymentDueDescription:
        "Proyek ini dan periode invoice yang belum dibayar akan dihapus permanen dari Menunggu Pembayaran. Tindakan ini tidak dapat dibatalkan.",
      deleteFromCompleted: "Hapus dari Proyek Selesai?",
      deleteFromCompletedConfirm: "Hapus dari Proyek Selesai",
      deleteFromCompletedDescription:
        "Proyek selesai ini dan catatan penagihannya akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.",
      editDescription:
        "Perbarui detail proyek, linimasa, staf, dan opsi penagihan.",
      deletedSuccess: "“{name}” dihapus.",
      deletedFromCompletedSuccess: "“{name}” dihapus dari Proyek Selesai.",
      emptyAll: "Belum ada proyek",
      emptyAllDesc: "Buat proyek untuk memulai.",
      emptyPlanning: "Tidak ada proyek di Perencanaan",
      emptyPlanningDesc:
        "Proyek baru dimulai di sini hingga surat perintah kerja diterima.",
      emptyInProgress: "Tidak ada proyek yang sedang berjalan",
      emptyInProgressDesc:
        "Proyek muncul di sini setelah dipindahkan ke Berjalan dari Perencanaan.",
      emptyPendingApproval: "Tidak ada periode yang menunggu persetujuan",
      emptyPendingApprovalDesc:
        "Setiap periode penagihan yang menunggu persetujuan bersama muncul sebagai baris sendiri setelah Ajukan Persetujuan atau rekonsiliasi. Proyek yang sama bisa muncul lebih dari sekali. Periode pindah ke Menunggu Pembayaran setelah klien dan HO sepakat.",
      emptyPaymentDue: "Tidak ada yang menunggu pembayaran",
      emptyPaymentDueDesc:
        "Setiap periode invoice yang sudah terbit muncul di sini hingga pembayaran diverifikasi. Proyek yang sama bisa muncul lebih dari sekali. Proyek Regular Cleaning tetap Berjalan selama siklus masih jatuh tempo.",
      emptyCompleted: "Belum ada proyek selesai",
      emptyCompletedDesc: "Proyek yang selesai dan lunas muncul di sini.",
      moveToInProgress: "Pindah ke Berjalan",
      contractProof: "Bukti Kontrak Tertanda",
      contractProofHint:
        "Unggah kontrak yang sudah ditandatangani (PDF atau gambar). Wajib untuk memulai Berjalan, termasuk saat proyek dibuat langsung sebagai Berjalan.",
      extendContract: "Perpanjang Kontrak",
      extendContract1: "Perpanjang",
      extendContract2: "Kontrak",
      extendTo: "Perpanjang Sampai",
      extendToRequired: "Tanggal Perpanjang Sampai wajib diisi.",
      extendProof: "Bukti Perpanjangan",
      extendProofRequired: "Bukti perpanjangan wajib diunggah.",
      extendProofHint: "Unggah bukti perpanjangan yang ditandatangani (PDF atau gambar).",
      extendContractFailed: "Gagal memperpanjang kontrak.",
      renewContract: "Kontrak Diperbarui",
      renewContract1: "Kontrak",
      renewContract2: "Diperbarui",
      renewContractHint:
        "Klien dan lokasi yang sama. Isi tanggal mulai dan akhir baru, lalu unggah perjanjian baru yang sudah ditandatangani. Invoice lama tetap. Tugaskan kru lagi setelah diperbarui.",
      renewStart: "Tanggal Mulai Baru",
      renewEnd: "Tanggal Akhir Baru",
      renewAgreement: "Perjanjian Baru yang Ditandatangani",
      renewStartRequired: "Tanggal mulai baru wajib diisi.",
      renewEndRequired: "Tanggal akhir baru wajib diisi.",
      renewAgreementRequired: "Unggah perjanjian baru yang sudah ditandatangani.",
      renewContractFailed: "Gagal memperbarui kontrak.",
      redoJob: "Kerjakan Ulang",
      redoJob1: "Kerjakan",
      redoJob2: "Ulang",
      redoJobHint:
        "Klien, lokasi, dan syarat yang sama. Isi tanggal mulai baru, unggah surat baru yang ditandatangani, dan tugaskan kru lagi. Kru sebelumnya mungkin sudah sibuk.",
      redoStart: "Tanggal Mulai Baru",
      redoDuration: "Durasi (hari)",
      redoAgreement: "Surat Baru yang Ditandatangani",
      redoStartRequired: "Tanggal mulai baru wajib diisi.",
      redoAgreementRequired: "Unggah surat baru yang sudah ditandatangani.",
      redoJobFailed: "Gagal mengerjakan ulang pekerjaan ini.",
      assignTeam: "Tugaskan Tim",
      assignTeamHint:
        "Menugaskan tim menempatkan semua anggota ke pekerjaan ini. Orang yang sudah di tim hanya bisa ditugaskan melalui tim. Staf tambahan di sini adalah cadangan untuk pekerjaan ini saja.",
      visitPlan: "Jadwal Kunjungan",
      visitPlanHint:
        "Kunjungan berulang menyelesaikan pekerjaan setiap trip lalu menagih kunjungan itu. Ini bukan pembayaran bertahap pada satu pekerjaan berkelanjutan.",
      visitN: "Kunjungan {n}",
      visitStart: "Mulai kunjungan",
      visitEnd: "Akhir kunjungan",
      addVisit: "Tambah kunjungan",
      removeVisit: "Hapus kunjungan",
      visitCrew: "Kru Kunjungan",
      visitCrewHint:
        "Tugaskan satu tim atau satu karyawan untuk setiap kunjungan. Orang atau tim yang sama tidak boleh dipakai pada tanggal yang tumpang tindih.",
      visitCrewUnassigned: "Belum Ditugaskan",
      visitCrewAssign: "Tugaskan Kru",
      visitCrewChange: "Ubah Kru",
      visitCrewClear: "Hapus Penugasan",
      visitCrewModeTeam: "Tim",
      visitCrewModeEmployee: "Karyawan",
      visitCrewChooseMode: "Tugaskan Tim Atau Karyawan",
      visitCrewSave: "Simpan Penugasan",
      visitCrewFailed: "Gagal menyimpan kru kunjungan.",
      visitCrewClearFailed: "Gagal menghapus kru kunjungan.",
      visitCrewBusyOn: "Sudah dipakai di {projectName} ({dates}).",
      visitCrewNeedChoice: "Pilih tim atau karyawan.",
      visitCrewXor: "Tugaskan tim atau karyawan, bukan keduanya.",
      visitCrewCurrent: "Di Lokasi Kunjungan Ini",
      visitCrewNoTeams: "Tidak ada tim yang cocok dengan jenis pekerjaan ini.",
      visitCrewEmpty: "Tidak ada kunjungan pada proyek ini.",
      visitCrewNotFound: "Kunjungan tidak ditemukan.",
      visitCrewTeamMissing: "Tim itu tidak ditemukan.",
      visitCrewTeamWrongType:
        "Tim itu tidak dapat ditugaskan ke jenis pekerjaan ini.",
      visitCrewEmployeeMissing: "Karyawan itu tidak ditemukan.",
      visitCrewEmployeeOnTeam:
        "Orang yang sudah di tim hanya dapat ditugaskan melalui tim.",
      moveDialogVisitCrewHelp:
        "Kru ditugaskan per kunjungan di halaman proyek, bukan di dialog ini.",
      extendHistory: "Riwayat Perpanjangan Kontrak",
      extendHistoryEmpty: "Belum ada perpanjangan kontrak.",
      extendHistoryExtendedOn: "Diperpanjang Pada",
      extendHistoryPreviousEnd: "Akhir Sebelumnya",
      extendHistoryNewEnd: "Akhir Baru",
      extendHistoryProof: "Bukti",
      extendHistoryNotes: "Catatan",
      moveToInProgressChip1: "Pindah ke",
      moveToInProgressChip2: "Berjalan",
      backToPlanning: "Kembali ke Perencanaan",
      backToPlanningChip1: "Kembali ke",
      backToPlanningChip2: "Perencanaan",
      verifyPayment: "Verifikasi pembayaran",
      verifying: "Memverifikasi…",
      verifyPaymentFailed: "Gagal memverifikasi pembayaran.",
      manageBilling: "Kelola Tagihan",
      manageBillingChip1: "Kelola",
      manageBillingChip2: "Tagihan",
      permissionDenied: "Anda tidak memiliki izin untuk mengelola proyek ini.",
      notFound: "Proyek tidak ditemukan.",
      submitForApproval: {
        button: "Ajukan Persetujuan",
        chip1: "Ajukan",
        chip2: "Persetujuan",
        confirmTitle: "Ajukan Persetujuan",
        confirmDesc:
          "Semua laporan progress akan dikompilasi menjadi PDF dan membuka review klien dan HO. Status proyek akan berubah menjadi Menunggu Persetujuan.",
        confirm: "Ajukan",
        regularNotAllowed:
          "Pembersihan Rutin dan Lanskap Rutin memakai rekonsiliasi. Rekonsiliasi periode penagihan jatuh tempo untuk memulai persetujuan.",
        internalNotAllowed:
          "Proyek Internal tidak memakai Ajukan untuk Persetujuan.",
        notAllowed:
          "Ajukan untuk Persetujuan hanya untuk Pembersihan General, Pembersihan Fasad, dan Lanskap Satu Kali.",
        inProgressOnly:
          "Hanya proyek In Progress yang dapat diajukan untuk persetujuan.",
        noOngoingMilestone:
          "Tidak ada periode milestone yang sedang berjalan. Periksa jadwal penagihan.",
        failed: "Gagal mengajukan proyek untuk persetujuan."
      },
      assignStaff: "Tugaskan Staf",
      assignStaffLater: "Tugaskan staf nanti",
      shiftCount: "Berapa Shift",
      shiftCountHint:
        "Pilih berapa shift situs ini, lalu atur jam setiap shift di sini. Sumber Daya Manusia → Shift hanya menugaskan orang ke Shift 1, Shift 2, Shift 3, atau Shift 4.",
      shiftCountOption: "{count} Shift",
      shiftCountOptionOne: "1 Shift",
      shiftWindowLabel: "Jam Shift {number}",
      shiftWindowStart: "Mulai Shift {number}",
      shiftWindowEnd: "Selesai Shift {number}",
      assignDoubleShift: "Tugaskan Shift Ganda",
      assignDoubleShiftDesc:
        "Pilih siapa yang mengisi shift tambahan di situs ini, lalu shift mana yang diambil alih. Cover itu hanya berlaku pada tanggal yang Anda tetapkan. Keesokan harinya mereka kembali ke shift sendiri. Mereka dibayar dua tarif harian untuk tanggal itu pada Penggajian Internal.",
      assignDoubleShiftConfirm: "Tugaskan Shift Ganda",
      assignDoubleShiftSaving: "Menugaskan…",
      assignDoubleShiftFailed: "Tidak dapat menugaskan shift ganda.",
      doubleShiftEmployee: "Karyawan Shift Ganda",
      doubleShiftEmployeePlaceholder: "Pilih siapa yang bekerja shift ganda",
      doubleShiftEmployeeEmpty:
        "Tidak ada staf tetap di situs ini. Tugaskan staf tetap terlebih dahulu, atau gunakan Tugaskan Cadangan untuk cadangan paruh waktu.",
      doubleShiftEmployeeHint:
        "Hanya karyawan tetap yang sudah ditugaskan di sini. Setelah itu, pilih shift mana yang diambil alih.",
      doubleShiftDate: "Tanggal",
      doubleShiftCover: "Shift Yang Diambil Alih",
      doubleShiftCoverPlaceholder: "Pilih shift yang akan diambil alih",
      doubleShiftCoverEmpty:
        "Proyek ini perlu paling sedikit dua shift, dan karyawan lain yang ditugaskan ke shift yang ditutupi. Tugaskan staf ke shift itu di Sumber Daya Manusia → Shift.",
      doubleShiftCoverHint:
        "Ini shift orang yang tidak hadir. Karyawan sudah punya shift sendiri; ini adalah shift tambahan untuk tanggal itu saja.",
      removeDoubleShift: "Hapus Shift Ganda",
      removeDoubleShiftConfirm:
        "Hapus shift ganda ini? Tanggal itu kembali ke satu tarif harian jika mereka menyelesaikan check-in dan check-out.",
      removeDoubleShiftSaving: "Menghapus…",
      assignBackup: "Tugaskan Cadangan",
      assignBackupDesc:
        "Tugaskan karyawan paruh waktu untuk menutupi shift bernama jika tidak ada karyawan tetap yang dapat mengambil shift ganda. Mereka check-in dan check-out dari tanggal mulai sampai tanggal selesai. Setelah tanggal selesai, cadangan berakhir dan shift itu kembali ke karyawan tetap. Kas Kecil didebit saat mereka check-out — manajer operasional membayar harian.",
      assignBackupConfirm: "Tugaskan Cadangan",
      assignBackupSaving: "Menugaskan…",
      assignBackupFailed: "Tidak dapat menugaskan cadangan.",
      backupEmployee: "Karyawan Paruh Waktu",
      backupEmployeePlaceholder: "Pilih karyawan paruh waktu",
      backupEmployeeEmpty: "Tidak ada karyawan paruh waktu yang tersedia.",
      backupEmployeeHint:
        "Cadangan paruh waktu mendapat login agar dapat check-in, check-out, dan mengirim laporan progres selama tanggal yang Anda tetapkan. Setelah tanggal selesai mereka tidak lagi di situs ini.",
      backupCover: "Shift Yang Ditutupi",
      backupCoverPlaceholder: "Pilih shift siapa yang ditutupi cadangan",
      backupCoverEmpty:
        "Tugaskan staf tetap ke shift bernama terlebih dahulu, lalu tugaskan cadangan untuk menutupi orang itu.",
      backupCoverHint:
        "Pilih karyawan tetap dan shift bernama yang ditutupi. Tanggal adalah hari cadangan ini dipesan. Kas Kecil didebit setelah mereka check-in dan check-out.",
      backupStart: "Tanggal Mulai",
      backupEnd: "Tanggal Selesai",
      backupDailyRate: "Tarif Harian",
      backupDailyRatePlaceholder: "mis. 100000",
      backupDailyRateHint:
        "Kas Kecil didebit sebesar ini saat mereka check-out hari itu. Hari yang tidak mereka kerjakan tidak diambil.",
      removeBackup: "Lepas Cadangan",
      removeBackupConfirm:
        "Lepas cadangan ini dari proyek? Hari yang belum dibayar tidak akan diambil dari Kas Kecil.",
      removeBackupSaving: "Melepas…",
      clearHistory: "Hapus semua yang selesai",
      timeline: "Linimasa",
      cleaningType: "Jenis Pembersihan",
      due: "Jatuh tempo",
      paid: "Lunas",
      /** Internal HO/Warehouse sites with no commercial start/end dates. */
      internalOngoing: "Berlangsung",
      noLocation: "Tidak ada lokasi",
      assigned: "ditugaskan",
      reportOne: "laporan",
      reportOther: "laporan",
      late: "Terlambat",
      awaitingInvoice: "Menunggu invoice",
      awaitingPayment: "Menunggu pembayaran",
      verifyingPayment: "Verifikasi Pembayaran",
      dueOn: "Jatuh tempo {date}",
      emptyShow: "Tidak ada proyek untuk ditampilkan.",
      reorderFailed: "Gagal menyusun ulang proyek.",
      moveBlockedNote:
        "Selesaikan invoice yang belum dibayar untuk kembali ke Perencanaan.",
      realContractStart: "Tanggal mulai kontrak nyata",
      realJobStart: "Tanggal mulai pekerjaan nyata",
      realContractStartRequired: "Tanggal mulai kontrak nyata wajib diisi.",
      realJobStartRequired: "Tanggal mulai pekerjaan nyata wajib diisi.",
      moveToInProgressFailed: "Gagal memindahkan proyek ke Berjalan.",
      moveDialogStaffHelp:
        "Tugaskan staf sekarang, atau biarkan kosong dan tugaskan nanti. Staf wajib saat check-in (CICO), bukan untuk memindahkan ke Berjalan.",
      timelineFields: {
        planningOngoingContract: "Perencanaan — kontrak berkelanjutan",
        ongoingContract: "Kontrak berkelanjutan",
        planningContractHelp:
          "Masukkan estimasi tanggal mulai kontrak. Tanggal mulai nyata ditetapkan saat Anda memindahkan ke Berjalan.",
        contractHelp:
          "Regular Cleaning diperlakukan sebagai kontrak situs. Tanggal akhir dihitung dari tanggal mulai dan durasi.",
        contractStart: "Tanggal mulai kontrak",
        contractEnd: "Tanggal akhir kontrak",
        durationMonths: "Durasi",
        durationDays: "Durasi",
        daysUnit: "hari",
        planningStageFieldNote:
          "(perkiraan untuk proyek tahap perencanaan)",
        monthsShort: "{count} bln",
        yearOne: "1 tahun",
        yearsCount: "{count} tahun",
        estimatedProjectStart: "Estimasi tanggal mulai proyek",
        projectStart: "Tanggal mulai proyek",
        estimatedProjectCompletion: "Estimasi tanggal selesai proyek",
        planningJobHelp:
          "Masukkan estimasi tanggal mulai proyek dan durasi. Tanggal mulai nyata ditetapkan saat Anda memindahkan ke Berjalan."
      },
      paymentPlan: {
        title: "Rencana pembayaran",
        help:
          "Satu proyek dengan beberapa periode invoice. Staf menagih setiap bertahap saat siap — struktur ditetapkan saat pembuatan.",
        numberOfPayments: "Jumlah pembayaran",
        splitEvenly: "Bagi rata",
        defaultHint:
          "Default {count} × 25% → label 25 / 50 / 75 / 100",
        eachPaymentPercent: "Setiap pembayaran (% dari kontrak)",
        paymentPercentAria: "Persentase pembayaran {n}",
        totalReadyToSave: "Total {sum}% — siap disimpan",
        totalMustEqual100: "Total {sum}% — harus sama dengan 100%",
        schedulePreview: "Pratinjau jadwal",
        milestoneLabel: "Tahap {percent}%",
        percentOfContract: "{percent}% dari kontrak",
        amountFromBilling: " · jumlah dari harga kontrak di Penagihan",
        fixPercentagesToPreview:
          "Perbaiki persentase agar berjumlah 100% untuk melihat pratinjau jadwal.",
        scheduleLockedNote:
          "Jadwal pembayaran bertahap ditetapkan saat proyek dibuat dan tidak diubah di sini. Periode invoice dari Invoice dan Penagihan."
      },
      planningEstimate: "Estimasi perencanaan:",
      moveDialogContract:
        "Surat perintah kerja diterima untuk “{name}”. Masukkan tanggal mulai kontrak nyata. Staf dapat ditugaskan sekarang atau nanti.",
      moveDialogJob:
        "Surat perintah kerja diterima untuk “{name}”. Masukkan tanggal pekerjaan nyata. Staf dapat ditugaskan sekarang atau nanti.",
      backToPlanningConfirm:
        "Kembali ke Perencanaan untuk “{name}”? Operasi lapangan ditunda hingga surat perintah kerja diterima lagi. Tanggal estimasi dan nyata tetap disimpan.",
      backToPlanningFailed: "Gagal mengirim proyek kembali ke Perencanaan.",
      subCategoryProjects: "Proyek {type}",
      projectOne: "{count} proyek",
      projectOther: "{count} proyek",
      itemOne: "{count} item",
      itemOther: "{count} item",
      forClient: "untuk",
      companyNotFound: "Perusahaan tidak ditemukan.",
      settleBeforePlanning:
        "Selesaikan semua invoice yang belum dibayar sebelum memindahkan proyek kembali ke Perencanaan.",
      cyclesReadyTitle:
        "{count} siklus rutin perlu direkonsiliasi sebelum penagihan",
      cyclesReadyDesc: "",
      columns: {
        project: "Proyek",
        status: "Status"
      },
      detail: {
        staff: "Staf ditugaskan",
        billing: "Penagihan",
        projectType: "Jenis Proyek",
        projectControls: "Kontrol proyek",
        client: "Klien",
        bankAccount: "Rekening Bank",
        chargedTax: "Pajak Yang Kita Kenakan",
        location: "Lokasi",
        estimatedStart: "Estimasi mulai",
        contractPeriod: "Periode kontrak",
        planningEstimate: "Estimasi perencanaan",
        contractStarted: "Mulai kontrak",
        contractPrice: "Harga kontrak",
        anniversaryInvoiceDay:
          "Invoice anniversary hari ke-{day} (sehari setelah setiap siklus berakhir)",
        serviceBillingNote:
          "Syarat komersial disimpan di proyek. Parking dan Manajemen Payroll tidak memakai periode invoice bulanan di sini.",
        contractPriceAndInvoices: "Harga kontrak dan invoice",
        estStart: "Est. mulai {date}",
        estimateTbd: "Estimasi belum ditentukan",
        fullBilling: "Penagihan lengkap",
        noInvoicePeriods: "Belum ada periode invoice.",
        invoice: "Invoice",
        downloadPdf: "Unduh PDF",
        shiftRange: "Shift {start} – {end}",
        noShiftSet: "Belum ada shift",
        backupChip: "Cadangan {start} – {end} · {rate} / hari",
        backupCoverChip:
          "Menutupi {shift} untuk {name} · {start} – {end} · {rate} / hari",
        doubleShiftChip: "Shift Ganda {date}",
        doubleShiftCoverChip:
          "Menggantikan {shift} pada {date} ({name} Tidak Hadir)",
        noStaff: "Belum ada staf yang ditugaskan.",
        availableAfterInProgress: " · Tersedia setelah Pindah ke Berjalan",
        siteLocation: "Lokasi Situs",
        cicoSiteLocation: "Lokasi Situs CICO",
        cicoSiteLocationHint:
          "Pin GPS dan radius situs yang dipakai untuk CICO kantor Head Office dan Warehouse.",
        cicoCoordinates: "Koordinat CICO",
        cicoGeofenceRadius: "Radius Situs",
        cicoGeofenceRadiusValue: "{meters} m",
        cicoGpsNotSet: "Belum Diatur",
        cicoGpsEmptyManage:
          "Pin GPS belum diatur. Gunakan Edit untuk menempel tautan Maps atau menempatkan pin — wajib untuk CICO Warehouse dan Head Office.",
        cicoGpsEmptyView:
          "Pin GPS belum diatur. Minta Head Office mengatur lokasi situs CICO pada proyek ini.",
        invoicesPayments: "Invoice & Pembayaran",
        downPaymentReceived: "Uang Muka Diterima",
        downPaymentReceivedYes: "Ya · {amount} · {date}",
        downPaymentReceivedNo: "Belum Diterima",
        downPaymentTaxInvoiceNote:
          "Faktur Pajak wajib setiap kali uang masuk.",
        paymentsReceivedCount: "Pembayaran diterima: {paid} dari {total}",
        viewProgressReports: "Lihat Laporan Progress",
        viewProgressReportsChip1: "Lihat Progress",
        viewProgressReportsChip2: "Laporan",
        period: "Periode",
        amount: "Jumlah",
        status: "Status",
        paid: "Lunas",
        actualDurationDays: "Durasi aktual",
        estimatedDurationDays: "Durasi estimasi awal",
        durationDaysValue: "{count} hari",
        inventoryCost: "Biaya Inventaris",
        inventoryIssues: "Pengeluaran Inventaris",
        inventoryIssueFromInventoryOnly:
          "Stok dan peralatan dikeluarkan dari Inventaris (Permintaan Material → Transfer Order). Daftar ini menampilkan yang sudah ada di proyek.",
        noInventoryIssues: "Belum ada inventaris yang dikeluarkan ke proyek ini.",
        viewInventory: "Buka Inventaris",
        voidIssue: "Batalkan Pengeluaran",
        voidIssueTitle: "Batalkan Pengeluaran Inventaris",
        voidIssueDesc:
          "Ini mengembalikan kuantitas ke inventaris dan menghapus biaya dari proyek ini.",
        voidIssueConfirm: "Batalkan Pengeluaran",
        voidIssueSuccess: "Pengeluaran inventaris dibatalkan. Stok dipulihkan.",
        voidReason: "Alasan Pembatalan",
        voidReasonPlaceholder: "Mengapa pengeluaran ini dibatalkan?"
      },
      periodPage: {
        openHint: "Buka rincian periode",
        backToProject: "Kembali Ke Proyek",
        whatThisIsTitle: "Apa Periode Ini",
        whatThisIsMonthly:
          "Ini satu siklus tagihan bulanan untuk {project}. Ini bukan seluruh kontrak. Baris daftar {start} – {end} hanya siklus ini: laporan, jumlah, dan status milik tanggal tersebut.",
        whatThisIsMilestone:
          "Ini satu tahap tagihan progres untuk {project} ({percent}% dari pekerjaan). Baris daftar hanya tahap ini, bukan seluruh pekerjaan.",
        whatThisIsCompletion:
          "Ini tagihan penyelesaian untuk {project}. Mencakup {start} sampai {end}.",
        whatThisIsGeneric:
          "Ini satu periode tagihan untuk {project}. Mencakup {start} sampai {end}. Baris daftar hanya periode ini, bukan seluruh kontrak.",
        whyTitle: "Mengapa Daftar Terlihat Seperti Ini",
        emptyInvoiceDates:
          "Invoice Dikirim dan Jatuh Tempo kosong karena invoice penjualan belum diterbitkan. Itu terjadi setelah periode ini disetujui.",
        pendingApprovalWhy:
          "Menunggu Persetujuan berarti paket progres siklus ini sudah dikirim untuk ditinjau. Klien harus Setujui atau Revisi. Jika mereka merevisi, Head Office meninjau perubahannya. Invoice penjualan diterbitkan hanya setelah kedua belah pihak setuju.",
        pendingApprovalClientRevised:
          "Klien meminta revisi. Head Office masih perlu menerima atau menolak perubahan itu sebelum periode ini dapat ditagih.",
        pendingApprovalHoRejected:
          "Head Office menolak revisi terakhir. Klien perlu meninjau paket ini lagi.",
        taxPendingWhy:
          "Pajak Tertunda berarti klien ini membutuhkan faktur pajak untuk periode ini, dan faktur itu belum dicatat.",
        taxDoneWhy: "Faktur pajak untuk periode ini sudah dicatat.",
        awaitingPaymentWhy:
          "Invoice penjualan sudah diterbitkan. Pembayaran jatuh tempo pada {date}.",
        overdueWhy:
          "Invoice penjualan sudah lewat jatuh tempo. Pembayaran seharusnya pada {date}.",
        verifyingWhy:
          "Bukti pembayaran sudah diunggah. Head Office masih perlu mengonfirmasinya.",
        paidWhy:
          "Periode ini sudah lunas. Pembayaran dicatat pada {date}.",
        ongoingWhy:
          "Siklus ini masih terbuka. Belum dikirim untuk persetujuan atau ditagih.",
        compilingWhy: "Invoice untuk periode ini sedang disusun.",
        reconcileWhy:
          "Siklus ini sudah berakhir dan siap direkonsiliasi sebelum dikirim ke klien.",
        factsTitle: "Rincian Periode",
        project: "Proyek",
        client: "Klien",
        type: "Jenis",
        billingMode: "Mode Penagihan",
        amount: "Jumlah",
        fromContractPrice:
          "Diambil dari harga kontrak proyek sampai jumlah periode ditetapkan.",
        invoiceSent: "Invoice Dikirim",
        dueDate: "Jatuh Tempo",
        paidOn: "Dibayar Pada",
        notYet: "Belum",
        reportsTitle: "Laporan Progress Di Periode Ini",
        reportsHint:
          "Daftar menampilkan “{count} laporan” karena laporan lapangan ini masuk siklus tersebut.",
        reportsEmpty: "Belum ada laporan progress pada tanggal ini.",
        photoCountOne: "{count} foto",
        photoCountOther: "{count} foto",
        noNotes: "Tidak ada catatan",
        serviceArea: "Area Layanan",
        openAllReports: "Buka Semua Laporan Progress",
        documentsTitle: "Dokumen",
        viewReviewReport: "Lihat Laporan",
        noDocuments: "Belum ada dokumen yang dibuat untuk periode ini.",
        openBilling: "Buka Penagihan",
        clientRevisionNote: "Catatan Revisi Klien",
        hoReviewNote: "Catatan Tinjauan Head Office",
        compileNote: "Catatan Penyusunan"
      },
      filterAllProjects: "Semua Proyek",
      equipmentPicker: {
        sectionTitle: "Peralatan Ditugaskan",
        noAssignedAssets: "Belum ada peralatan yang ditugaskan.",
        noAssignedAssetsHint:
          "Terbitkan peralatan dari Inventaris → Penerbitan Proyek. Unit yang ditugaskan dilacak per unit dan dikembalikan ke pool saat dilepas atau saat kru proyek dilepas.",
        assigned: "ditugaskan",
        removeFromAssignment: "Hapus dari penugasan",
        releaseFailed: "Gagal melepas unit peralatan.",
        assetRequired: "Aset wajib diisi.",
        assetNotOnProject: "Unit ini tidak ditugaskan ke proyek ini.",
        releaseTitle: "Lepas Peralatan",
        releaseDesc:
          "Ini mengembalikan unit ke pool gudang tersedia. Peralatan hanya lokasi/penitipan — tidak ada biaya proyek yang dibukukan.",
        releaseConfirm: "Lepas Unit",
        releaseSuccess: "Unit peralatan dilepas."
      },
      staffPicker: {
        removeFromAssignment: "Hapus dari penugasan",
        noActiveStaff: "Tidak ada staf aktif.",
        department: "Departemen",
        selectDepartment: "Pilih departemen",
        searchDepartment: "Cari departemen...",
        selectStaffPrompt: "Pilih staf untuk ditugaskan",
        noStaffSearch: "Tidak ada staf yang cocok dengan pencarian ini.",
        noStaffDepartment: "Tidak ada staf di departemen ini.",
        alreadyOnOtherProject:
          "Karyawan ini sudah ditugaskan ke proyek lain.",
        alreadyOnOtherProjectNamed:
          "Karyawan ini sudah ditugaskan ke {projectName}.",
        assignedToOtherProject: "Sudah ditugaskan ke {projectName}."
      },
      locationPicker: {
        addressSearchFailed: "Tidak dapat mencari alamat tersebut.",
        addressNotFound: "Alamat tidak ditemukan untuk pencarian itu.",
        address: "Alamat",
        addressPlaceholder: "Diisi dari koordinat, atau cari alamat",
        searchAddress: "Cari",
        latitude: "Lintang",
        longitude: "Bujur",
        radius: "Radius Situs (m)",
        radiusPlaceholder: "Radius (m)",
        internalCicoHint:
          "Atur pin peta dan radius situs untuk CICO kantor di situs Internal ini (Head Office atau Warehouse).",
        pasteLabel: "Tempel koordinat / tautan Google Maps",
        pastePlaceholder:
          "-6.200000, 106.816666 atau URL Google Maps / share.google",
        parseError:
          "Tidak dapat diparse. Tempel koordinat desimal (mis. -6.2, 106.8) atau tautan Google Maps.",
        shortLinkError:
          "Tidak dapat membuka tautan pendek Maps. Di Google Maps, klik kanan pin → salin koordinat desimal lalu tempel di sini.",
        coordsAppliedFilled: "Koordinat diterapkan dan alamat diisi.",
        coordsLookingUp: "Koordinat diterapkan — mencari alamat…",
        retryingLookup: "Mencoba ulang pencarian alamat…",
        addressFilled: "Alamat diisi.",
        resolvingShortLink: "Membuka tautan pendek Maps…",
        shortLinkLookingUp: "Tautan pendek berhasil dibuka — mencari alamat…",
        pinMovedLookingUp: "Pin dipindah — mencari alamat…",
        pinSetLookingUp: "Pin dipasang — mencari alamat…",
        urlNotAddress:
          "Itu tampak seperti URL, bukan alamat jalan. Tempel tautan Maps di kolom di atas, atau ketik alamat yang benar.",
        addressFoundUpdated: "Alamat ditemukan dan pin diperbarui.",
        lookupFailedKept:
          "Koordinat diterapkan; pencarian alamat gagal — alamat lokasi yang ada tetap dipakai.",
        lookupFailedPlaceholder:
          "Koordinat diterapkan; pencarian alamat gagal — memakai koordinat sebagai placeholder.",
        retrying: " Mencoba ulang…",
        retryLookup: "Coba lagi pencarian alamat",
        pinHelp:
          "Pin diperbarui dari tempelan. Seret atau klik peta untuk menyesuaikan."
      },
      finish: {
        confirmInvoice:
          "Ajukan invoice untuk siklus kontrak saat ini sebelum menyelesaikan?",
        invoiceRequested: "Invoice diajukan",
        noPeriodDue: "Tidak ada periode yang jatuh tempo untuk ditagih saat ini.",
        confirmFinish: "Tandai proyek ini sebagai selesai?",
        completedStatus: "Proyek ditandai selesai.",
        requestInvoice: "Kirim invoice",
        reconcile: "Rekonsiliasi",
        reconciling: "Sedang merekonsiliasi…",
        submittingInvoice: "Mengirim…",
        finishProject: "Selesaikan proyek",
        finishProject1: "Selesai",
        finishProject2: "Proyek",
        endContract: "Akhiri Kontrak",
        endContract1: "Akhiri",
        endContract2: "Kontrak",
        finishing: "Menyelesaikan...",
        confirmReconcileCycle:
          "Rekonsiliasi siklus jatuh tempo untuk “{name}” dan kirim laporan CICO untuk review klien dan HO?",
        nothingToReconcile:
          "Tidak ada yang perlu direkonsiliasi. Tidak ada siklus jatuh tempo yang menunggu rekonsiliasi, atau siklus berikutnya belum jatuh tempo.",
        reconcilePeriodFailed: "Gagal merekonsiliasi periode ini.",
        confirmInvoiceCycle:
          "Penerbitan invoice menunggu persetujuan bersama atas laporan rekonsiliasi (Keuangan → Rekonsiliasi).",
        nothingNewToInvoice:
          "Tidak ada yang baru untuk ditagih. Rekonsiliasi siklus jatuh tempo agar klien dan HO dapat menyetujui, atau “{label}” sudah diterbitkan/lunas.",
        invoicePeriodFailed: "Gagal menagih periode ini.",
        lastDay: "Hari terakhir di lokasi",
        lastDayRequired: "Isi hari terakhir yang sebenarnya di lokasi.",
        lastMonth: "Bulan Terakhir",
        lastMonthRequired: "Pilih bulan terakhir kontrak parking.",
        lastMonthHint:
          "Pilih bulan kalender terakhir di lokasi. Hari terakhir adalah hari terakhir bulan itu. Tagihan parking bulan itu di ruang kerja Parking. Rekonsiliasi pada tanggal 1 bulan berikutnya.",
        lastDayHint:
          "Pilih hari kerja terakhir (hari ini atau lebih awal). Jika memilih hari ini, rekonsiliasi besok agar hari itu tertutup penuh. Setelah itu paket dikirim ke klien untuk Disetujui.",
        confirmEndContract:
          "Yakin ingin mengakhiri kontrak “{name}”? Setelah ya, pilih hari kerja terakhir. Tagihan terakhir direkonsiliasi sehari setelah tanggal itu, lalu dikirim ke klien. Pekerjaan selesai hanya setelah klien menyetujui, membayar, dan faktur pajak diunggah.",
        confirmFinishNamed:
          "Selesaikan “{name}”? Invoice akan dibuat di akun klien. Proyek pindah ke Menunggu Pembayaran hingga pembayaran diterima. Invoice belum lunas harus diselesaikan terlebih dahulu.",
        settleUnpaidBeforeClose:
          "Selesaikan semua invoice belum lunas sebelum mengakhiri kontrak atau menyelesaikan proyek.",
        reconcileDueBeforeClose:
          "Rekonsiliasi semua periode penagihan yang jatuh tempo sebelum mengakhiri kontrak atau menyelesaikan proyek.",
        clientReviewBeforeClose:
          "Tunggu klien dan HO menyelesaikan review persetujuan yang masih terbuka sebelum mengakhiri kontrak atau menyelesaikan proyek.",
        contractEnded: "Kontrak diakhiri",
        endContractFailed: "Gagal mengakhiri kontrak.",
        finishProjectFailed: "Gagal menyelesaikan proyek.",
        invoiceErrorOpenBilling:
          "{finishedLabel}, tetapi invoice tidak dapat diterbitkan:\n{error}{billingHint}\n\nBuka penagihan sekarang?",
        openBillingNow: "Buka penagihan sekarang?",
        billingHintWithPath:
          "\n\nBuka Invoice & Penagihan untuk mengompilasi secara manual:\n{path}",
        billingHintGeneric:
          "\n\nBuka Invoice & Penagihan untuk mengompilasi invoice secara manual.",
        createFailed: "Gagal membuat proyek.",
        updateFailed: "Gagal memperbarui proyek."
      },
      historyClear: {
        noProjects: "Tidak ada proyek untuk dibersihkan.",
        cleared: "Riwayat proyek dibersihkan.",
        clearedCount:
          "{count} proyek selesai dibersihkan.",
        completedCount: "{count} proyek selesai",
        clearFailed: "Gagal membersihkan proyek selesai.",
        warningNote:
          "Periode invoice, PDF, laporan progres, foto, dan penugasan dihapus. Catatan kehadiran disimpan tetapi dilepas tautannya. Menunggu Pembayaran dan proyek aktif tidak terpengaruh.",
        title: "Hapus semua riwayat proyek?",
        description:
          "Ini menghapus permanen riwayat proyek selesai dan dibatalkan dari tampilan ini. Proyek aktif tidak terpengaruh.",
        confirm: "Hapus riwayat",
        clearing: "Membersihkan..."
      }
    },
    clients: {
      title: "Klien",
      descriptionAdmin: "Tambah organisasi klien.",
      directoryTitle: "Direktori Klien",
      directoryDesc: "Data organisasi, penugasan proyek, dan kontak.",
      companyNotFound: "Perusahaan tidak ditemukan.",
      addClient: "Tambah Klien",
      bulkCreateTitle: "Tambah klien secara massal",
      bulkCreateDesc:
        "Tambah lebih dari satu klien sekaligus. Setiap baris sama seperti Tambah Klien — isi semua untuk klien itu.",
      bulkCreateLines: "Klien",
      bulkCreateLinesHint:
        "Setiap baris adalah catatan klien lengkap. Tidak ada ketentuan bersama.",
      editClient: "Ubah Klien",
      searchPlaceholder: "Cari klien...",
      deleted: "Dihapus",
      active: "Aktif",
      activeSubtitle: "Organisasi klien yang sedang aktif",
      deletedSubtitle: "Klien yang dihapus sementara hingga dipulihkan",
      emptyTrash:
        "Klien yang dihapus muncul di sini hingga dipulihkan atau dihapus permanen.",
      emptyActive: "Belum ada klien",
      emptyActiveList: "Tidak ada klien aktif",
      emptyActiveListDesc: "Tidak ada organisasi klien untuk ditampilkan.",
      emptyDeletedList: "Tidak ada klien yang dihapus",
      emptySearch: 'Tidak ada hasil untuk "{query}"',
      emptySearchDesc:
        "Coba nama perusahaan, alamat, kontak, atau narahubung lain.",
      deleteTitle: "Hapus klien?",
      deleteConfirm: "Hapus klien",
      deleteDescription:
        "Ini memindahkan organisasi klien ke Klien Dihapus. Data disimpan dan dapat dipulihkan nanti.",
      deleteSoftNote:
        "Login portal terkait dinonaktifkan (tidak dihapus permanen) dan dipindah ke Klien Dihapus. Kredensial disimpan. Setelah memulihkan klien ini, gunakan Pengguna → Akses Dicabut → Pulihkan Akses untuk mengaktifkan lagi login portal. Proyek tetap terikat ke klien ini.",
      deleteForeverTitle: "Hapus Klien Selamanya?",
      deleteForeverConfirm: "Hapus Selamanya",
      deleteForeverDescription:
        "Organisasi klien ini akan dihapus permanen. Login portal terkait dihapus permanen. Klien dengan proyek terkait tidak dapat dihapus permanen.",
      deleteForeverNote:
        "Hanya klien yang sudah dihapus dan tidak punya proyek terkait yang dapat dihapus permanen. Login portal terkait dihapus permanen dan tidak dapat dipulihkan. Tindakan ini tidak dapat dibatalkan.",
      deleteForeverProjectsNote:
        "Klien ini masih punya proyek terkait ({count}). Pindahkan atau hapus permanen proyek tersebut sebelum menghapus klien selamanya.",
      deleteForeverUsersNote:
        "Login portal ({count}) akan dihapus permanen dan tidak dapat dipulihkan.",
      restoreTitle: "Pulihkan klien?",
      restoreConfirm: "Pulihkan klien",
      restoreDescription:
        "Ini memulihkan organisasi klien dari Klien Dihapus. Login portal tetap nonaktif — gunakan Pengguna → Akses Dicabut → Pulihkan Akses sebelum mereka dapat masuk lagi.",
      restoreSoftNote:
        "Nama pengguna dan kredensial tetap disimpan. Setelah dipulihkan, login terkait muncul di Akses Dicabut hingga Anda memulihkan akses. Klien akan muncul lagi di direktori aktif. Klien yang dihapus selamanya tidak dapat dipulihkan.",
      editDescription:
        "Perbarui detail kontak organisasi. Hapus sementara hanya lewat Hapus. Kelola login portal di Pengguna.",
      savedToast: "Klien disimpan.",
      createFailed: "Gagal membuat klien.",
      updateFailed: "Gagal memperbarui klien.",
      deleteFailed: "Gagal menghapus klien.",
      restoreFailed: "Gagal memulihkan klien.",
      reorderFailed: "Gagal mengubah urutan klien.",
      reorderInvalid: "Satu atau lebih klien tidak valid untuk diurutkan ulang.",
      notFound: "Klien tidak ditemukan.",
      alreadyDeleted: "Klien sudah dihapus.",
      alreadyActive: "Klien sudah aktif.",
      permissionDenied: "Anda tidak punya izin untuk mengelola klien.",
      firstNameRequired: "Nama depan wajib diisi.",
      clientNameRequired: "Nama klien wajib diisi.",
      contactFirstNameRequired: "Nama depan narahubung wajib diisi.",
      nameAlreadyExists: 'Klien bernama "{name}" sudah ada.',
      nameExistsInDeleted:
        'Klien bernama "{name}" sudah ada di Klien Dihapus. Pulihkan atau hapus permanen dulu sebelum memakai nama itu lagi.',
      permanentDeleteRequiresDeleted:
        "Hanya klien yang sudah dihapus yang dapat dihapus permanen. Hapus klien terlebih dahulu.",
      permanentDeleteBlockedByProjects:
        "Klien ini masih punya proyek terkait. Pindahkan atau hapus permanen proyek tersebut sebelum menghapus klien selamanya.",
      portalLoginDeletedClient:
        "{name}: login portal tidak dapat dibuat untuk klien yang dihapus. Pulihkan klien terlebih dahulu.",
      portalLoginContactRequired:
        "{name}: nama depan narahubung wajib diisi.",
      generatePortalFailed: "Gagal membuat login portal.",
      selectAll: "Pilih Semua Klien",
      selectRow: "Pilih {name}",
      projectCount: "{count} proyek",
      portalUserCount: "{count} pengguna portal",
      checkingSoftDelete: "Memeriksa apakah klien ini dapat dihapus…",
      softDeleteBlockedTitle: "Klien ini belum dapat dihapus",
      softDeleteBlocked:
        "Tidak dapat menghapus klien ini selama pekerjaan atau keuangan masih terbuka: {blockers}.",
      softDeleteCheckFailed:
        "Tidak dapat memeriksa apakah klien ini dapat dihapus. Tutup dan coba lagi.",
      softDeleteBlockers: {
        openProjects:
          "{count} proyek terbuka (belum Selesai dan lunas)",
        unsettledBilling: "penagihan belum selesai pada {count} proyek",
        pendingTaxInvoices: "{count} faktur pajak belum selesai"
      },
      bulkDeleteTitle: "Hapus {count} klien?",
      bulkDeleteForeverTitle: "Hapus {count} klien selamanya?",
      bulkDeleteConfirm: "Hapus {count} klien",
      bulkDeleteForeverConfirm: "Hapus {count} selamanya",
      bulkRestoreTitle: "Pulihkan {count} klien?",
      bulkRestoreConfirm: "Pulihkan {count} klien",
      bulkSelected: "{count} klien dipilih",
      bulkActionApplies:
        "Tindakan ini berlaku untuk semua baris terpilih di tampilan saat ini.",
      bulkDeleteForeverNote:
        "Hanya klien terhapus tanpa proyek terkait yang dapat dihapus permanen. Login portal terkait dihapus permanen dan tidak dapat dipulihkan. Klien dengan proyek terkait diblokir. Tindakan ini tidak dapat dibatalkan.",
      bulkRestoreNote:
        "Nama pengguna dan kredensial tetap disimpan. Klien yang dipulihkan muncul di direktori aktif; login terkait pindah ke Akses Dicabut.",
      bulkDeactivateSuccess: "{count} klien dipindah ke Klien Dihapus.",
      bulkDeactivateAllFailed:
        "Tidak dapat menghapus klien terpilih. {detail}",
      bulkDeactivatePartial:
        "{success} klien dipindah ke Klien Dihapus. {failed} gagal.",
      bulkDeleteForeverSuccess: "{count} klien dihapus permanen.",
      bulkDeleteForeverAllFailed:
        "Tidak dapat menghapus permanen klien terpilih. {detail}",
      bulkDeleteForeverPartial:
        "{success} klien dihapus permanen. {failed} gagal.",
      bulkRestoreSuccess:
        "{count} klien dipulihkan. Login terkait tetap nonaktif hingga Pulihkan Akses.",
      bulkRestoreAllFailed: "Tidak dapat memulihkan klien terpilih. {detail}",
      bulkRestorePartial:
        "{success} klien dipulihkan. Login terkait tetap nonaktif hingga Pulihkan Akses. {failed} gagal.",
      portalStatus: {
        yes: "Ya",
        revoked: "Dicabut",
        no: "Tidak"
      },
      columns: {
        client: "Klien",
        shortCode: "ID Klien",
        contact: "Kontak",
        clientSince: "Klien Sejak",
        projects: "Proyek",
        portalLogin: "Login Portal",
        actions: "Tindakan"
      },
      form: {
        organization: "Organisasi",
        organizationDesc:
          "Detail perusahaan klien untuk proyek dan catatan kontak.",
        organizationIndividual: "Klien",
        organizationIndividualDesc:
          "Detail pribadi untuk proyek dan catatan kontak.",
        clientName: "Nama Klien",
        firstName: "Nama Depan",
        lastName: "Nama Belakang",
        shortCode: "ID Klien",
        shortCodeHint:
          "ID otomatis untuk nama file faktur pajak dan bukti pembayaran (mis. C001).",
        shortCodePreviewHint:
          "Pratinjau ID Klien berikutnya. ID final ditetapkan saat Anda menyimpan.",
        shortCodeLoading: "Memuat…",
        companyEmail: "Email Perusahaan",
        companyPhone: "Telepon Perusahaan",
        email: "Email",
        phone: "Telepon",
        address: "Alamat",
        companyNpwp: "NPWP",
        companyNpwpHint:
          "Wajib. Masukkan tepat 15 atau 16 digit (titik/strip OK).",
        clientNpwpOrNik: "NPWP / NIK",
        clientNpwpOrNikHint:
          "Wajib. Masukkan tepat 15 atau 16 digit (titik/strip OK).",
        taxIdDocumentCompany: "Dokumen NPWP",
        taxIdDocumentIndividual: "Dokumen NPWP / NIK",
        taxIdDocumentUploadCompany: "Unggah Dokumen NPWP (Foto Atau Scan)",
        taxIdDocumentUploadIndividual:
          "Unggah Dokumen NPWP Atau NIK (Foto Atau Scan)",
        taxIdDocumentReplace: "Ganti Dokumen Identitas Pajak (Foto Atau Scan)",
        taxIdDocumentCurrent: "Dokumen Identitas Pajak Saat Ini:",
        taxIdDocumentView: "Lihat File",
        taxIdDocumentHintCompany:
          "Wajib. Unggah foto atau PDF NPWP perusahaan yang jelas.",
        taxIdDocumentHintIndividual:
          "Wajib. Unggah foto atau PDF NPWP atau NIK yang jelas.",
        taxIdDocumentHintEdit:
          "Pertahankan file saat ini, atau unggah foto atau PDF pengganti.",
        clientSince: "Klien Sejak",
        clientSinceHint: "Kapan organisasi ini menjadi klien RGS.",
        clientSinceHintIndividual: "Kapan orang ini menjadi klien RGS.",
        contactPerson: "Narahubung",
        contactPersonDescCreate: "Narahubung utama di organisasi klien.",
        contactPersonDescEdit: "Narahubung utama di organisasi klien.",
        contactFirstName: "Nama Depan Narahubung",
        contactLastName: "Nama Belakang Narahubung",
        contactPosition: "Jabatan Narahubung",
        contactEmail: "Email Narahubung",
        contactPhone: "Telepon Narahubung",
        portalAccess: "Akses Portal",
        portalAccessDesc:
          "Login ID portal selalu dibuat dari nama perusahaan. Cabut akses nanti di Pengguna jika diperlukan.",
        portalAccessDescIndividual:
          "Login ID portal selalu dibuat dari nama mereka. Cabut akses nanti di Pengguna jika diperlukan.",
        clientType: "Tipe Klien",
        clientTypeCompany: "Perusahaan",
        clientTypeIndividual: "Perorangan",
        loginId: "Login ID",
        loginIdHint:
          "Delapan huruf dari nama perusahaan. Pilih saran atau edit, lalu generate ulang jika perlu.",
        loginIdHintIndividual:
          "Delapan huruf dari nama mereka. Pilih saran atau edit, lalu generate ulang jika perlu.",
        loginIdInvalid: "Login ID harus tepat 8 huruf (a–z).",
        regenerateLoginId: "Generate Ulang",
        multiProjectAccess: "Akses Multi-Proyek",
        multiProjectAccessHint:
          "Default mati untuk perorangan. Jika aktif dengan dua proyek atau lebih, Admin dapat mengelompokkan proyek dan mengatur Kode Keamanan."
      },
      multiProject: {
        title: "Akses Multi-Proyek",
        description:
          "Kelompokkan proyek dan atur Kode Keamanan. Akses aktif bila ada dua proyek atau lebih dan fitur ini menyala.",
        loading: "Memuat Akses Multi-Proyek…",
        loadFailed: "Tidak dapat memuat Akses Multi-Proyek.",
        retry: "Coba Lagi",
        enabled: "Akses Multi-Proyek",
        securityMode: "Mode Keamanan",
        modeGroupOnly: "Hanya Grup",
        modeMasterAndGroup: "Master Dan Grup",
        readyTitle: "Akses Multi-Proyek Siap",
        readyBody:
          "Klien ini sekarang punya dua proyek atau lebih dan Akses Multi-Proyek menyala. Kelompokkan proyek dan atur Kode Keamanan, atau matikan Akses Multi-Proyek jika mereka boleh membuka semua proyek tanpa kode.",
        groups: "Grup Proyek",
        groupName: "Nama Grup",
        addGroup: "Tambah Grup",
        addGroupHint:
          "Beri nama grup saja. Lalu centang proyek yang masuk grup itu dan gunakan Tugaskan Ke Grup. Proyek yang tidak dipilih tetap belum dikelompokkan.",
        ungrouped: "Proyek Belum Dikelompokkan",
        ungroupedWarning:
          "Proyek yang belum dikelompokkan tetap tidak bisa diakses di portal klien selama Akses Multi-Proyek aktif.",
        masterCode: "Kode Keamanan Master",
        groupCode: "Kode Keamanan Grup",
        generateCode: "Generate Kode Keamanan",
        regenerateCode: "Generate Ulang Kode Keamanan",
        regenerateCodeConfirm:
          "Generate ulang Kode Keamanan ini? Kode yang sekarang akan berhenti berlaku.",
        codeHint: "Petunjuk (2 terakhir): {hint}",
        codeMissingFull:
          "Kode Keamanan lengkap belum tersimpan. Generate ulang untuk membuat kode baru yang bisa disalin.",
        noCodeYet: "Belum ada kode aktif",
        assign: "Tugaskan Ke Grup",
        assignTo: "Tugaskan Ke",
        groupRequiredToAssign: "Pilih grup terlebih dahulu.",
        projectsRequiredToAssign: "Pilih setidaknya satu proyek untuk ditugaskan.",
        countable: "{count} proyek terhitung",
        activeBadge: "Aktif",
        armedBadge: "Siap",
        saveSettings: "Simpan Pengaturan Multi-Proyek",
        saveFailed: "Gagal menyimpan pengaturan Multi-Proyek.",
        generateCodeFailed: "Gagal membuat Kode Keamanan.",
        addGroupFailed: "Gagal menambah grup.",
        deleteGroupFailed: "Gagal menghapus grup.",
        assignFailed: "Gagal menugaskan proyek.",
        codeCopied: "Kode Keamanan disalin.",
        copyFailed: "Tidak dapat menyalin. Pilih dan salin secara manual.",
        groupNameRequired: "Nama grup wajib diisi.",
        groupNotFound: "Grup tidak ditemukan.",
        groupRequiredForCode: "Grup wajib untuk kode Grup.",
        masterCodeNoGroup:
          "Kode Keamanan Master tidak dapat diikat ke grup.",
        masterCodeGroupOnlyMode:
          "Kode Keamanan Master tidak dipakai di mode Hanya Grup. Ganti ke Master Dan Grup terlebih dahulu.",
        notAuthorized: "Tidak diizinkan mengelola klien."
      }
    },
    multiProjectUnlock: {
      title: "Masukkan Kode Keamanan",
      description: "Buka akses proyek untuk {client}.",
      picName: "Nama PIC",
      picNameHint: "Masukkan nama narahubung yang tercatat untuk klien ini.",
      securityCode: "Kode Keamanan",
      unlock: "Buka Akses",
      unlocking: "Membuka...",
      changeCode: "Ganti Kode Keamanan"
    },
    vendors: {
      title: "Pemasok",
      descriptionAdmin: "Kelola organisasi vendor dan pemasok.",
      directoryTitle: "Direktori Pemasok",
      directoryDesc:
        "Data organisasi pemasok, kontak, dan syarat pembayaran. Pemasok dikelola Head Office saja — tidak ada portal vendor.",
      companyNotFound: "Perusahaan tidak ditemukan.",
      addVendor: "Tambah Pemasok",
      bulkCreateTitle: "Tambah pemasok secara massal",
      bulkCreateDesc:
        "Tambah lebih dari satu pemasok sekaligus. Setiap baris sama seperti Tambah Pemasok — isi semua untuk pemasok itu.",
      bulkCreateLines: "Pemasok",
      bulkCreateLinesHint:
        "Setiap baris adalah catatan pemasok lengkap. Tidak ada ketentuan bersama.",
      editVendor: "Ubah Pemasok",
      searchPlaceholder: "Cari pemasok...",
      deleted: "Dihapus",
      active: "Aktif",
      activeSubtitle: "Organisasi pemasok yang sedang aktif",
      deletedSubtitle: "Pemasok yang dihapus sementara hingga dipulihkan",
      emptyTrash:
        "Pemasok yang dihapus muncul di sini hingga dipulihkan atau dihapus permanen.",
      emptyActive: "Belum ada pemasok",
      emptyActiveList: "Tidak ada pemasok aktif",
      emptyActiveListDesc: "Tidak ada organisasi pemasok untuk ditampilkan.",
      emptyDeletedList: "Tidak ada pemasok yang dihapus",
      emptySearch: 'Tidak ada hasil untuk "{query}"',
      emptySearchDesc:
        "Coba nama perusahaan, alamat, kontak, atau narahubung lain.",
      deleteTitle: "Hapus pemasok?",
      deleteConfirm: "Hapus pemasok",
      deleteDescription:
        "Ini memindahkan organisasi pemasok ke Pemasok Dihapus. Data disimpan dan dapat dipulihkan nanti.",
      deleteSoftNote:
        "Login portal terkait dinonaktifkan (tidak dihapus permanen) dan dipindah ke Pengguna Dihapus. Kredensial tetap disimpan. Setelah memulihkan pemasok ini, gunakan Pengguna → Akses Dicabut → Pulihkan Akses untuk mengaktifkan kembali login portal.",
      checkingSoftDelete: "Memeriksa apakah pemasok ini dapat dihapus…",
      softDeleteBlockedTitle: "Pemasok ini belum dapat dihapus",
      softDeleteBlocked:
        "Tidak dapat menghapus pemasok ini selama masih ada utang atau dokumen pajak belum selesai: {blockers}.",
      softDeleteBlockers: {
        outstandingPayables: "{count} utang pembelian belum lunas",
        pendingTaxInvoices: "{count} faktur pajak belum selesai"
      },
      deleteForeverTitle: "Hapus pemasok selamanya?",
      deleteForeverConfirm: "Hapus selamanya",
      deleteForeverDescription:
        "Organisasi pemasok ini akan dihapus permanen. Login portal terkait dihapus permanen. Tindakan ini tidak dapat dibatalkan.",
      deleteForeverNote:
        "Hanya pemasok yang sudah dihapus yang dapat dihapus permanen. Login portal terkait dihapus permanen dan tidak dapat dipulihkan. Tindakan ini tidak dapat dibatalkan.",
      restoreTitle: "Pulihkan pemasok?",
      restoreConfirm: "Pulihkan pemasok",
      restoreDescription:
        "Ini memulihkan organisasi pemasok dari Pemasok Dihapus. Login portal terkait tetap nonaktif — gunakan Pengguna → Akses Dicabut → Pulihkan Akses sebelum mereka dapat masuk lagi.",
      restoreSoftNote:
        "Nama pengguna dan kredensial tetap disimpan. Setelah dipulihkan, login terkait muncul di Akses Dicabut hingga Anda memulihkan akses. Pemasok akan muncul lagi di direktori aktif. Pemasok yang dihapus selamanya tidak dapat dipulihkan.",
      editDescription:
        "Perbarui detail kontak organisasi. Soft-delete hanya melalui Hapus. Kelola login portal di Pengguna.",
      savedToast: "Pemasok disimpan.",
      createFailed: "Gagal membuat pemasok.",
      updateFailed: "Gagal memperbarui pemasok.",
      deleteFailed: "Gagal menghapus pemasok.",
      restoreFailed: "Gagal memulihkan pemasok.",
      notFound: "Pemasok tidak ditemukan.",
      alreadyDeleted: "Pemasok sudah dihapus.",
      alreadyActive: "Pemasok sudah aktif.",
      permissionDenied: "Anda tidak memiliki izin untuk mengelola pemasok.",
      vendorNameRequired: "Nama pemasok wajib diisi.",
      firstNameRequired: "Nama depan wajib diisi.",
      contactFirstNameRequired: "Nama depan narahubung wajib diisi.",
      permanentDeleteRequiresDeleted:
        "Hanya pemasok yang sudah dihapus yang dapat dihapus permanen. Hapus pemasok terlebih dahulu.",
      selectAll: "Pilih Semua Pemasok",
      selectRow: "Pilih {name}",
      bulkDeleteTitle: "Hapus {count} pemasok?",
      bulkDeleteForeverTitle: "Hapus {count} pemasok selamanya?",
      bulkDeleteConfirm: "Hapus {count} pemasok",
      bulkDeleteForeverConfirm: "Hapus {count} selamanya",
      bulkRestoreTitle: "Pulihkan {count} pemasok?",
      bulkRestoreConfirm: "Pulihkan {count} pemasok",
      bulkSelected: "{count} pemasok dipilih",
      bulkActionApplies:
        "Tindakan ini berlaku untuk semua baris terpilih di tampilan saat ini.",
      bulkDeleteForeverNote:
        "Login portal terkait dihapus permanen dan tidak dapat dipulihkan. Tindakan ini tidak dapat dibatalkan.",
      bulkRestoreNote:
        "Nama pengguna dan kredensial tetap disimpan. Pemasok yang dipulihkan muncul di direktori aktif; login terkait pindah ke Akses Dicabut.",
      bulkDeactivateSuccess: "{count} pemasok dipindahkan ke Pemasok Dihapus.",
      bulkDeactivateAllFailed:
        "Tidak dapat menghapus pemasok terpilih. {detail}",
      bulkDeactivatePartial:
        "{success} pemasok dipindahkan ke Pemasok Dihapus. {failed} gagal.",
      bulkDeleteForeverSuccess: "{count} pemasok dihapus permanen.",
      bulkDeleteForeverAllFailed:
        "Tidak dapat menghapus permanen pemasok terpilih. {detail}",
      bulkDeleteForeverPartial:
        "{success} pemasok dihapus permanen. {failed} gagal.",
      bulkRestoreSuccess:
        "{count} pemasok dipulihkan. Login terkait tetap nonaktif hingga Pulihkan Akses.",
      bulkRestoreAllFailed: "Tidak dapat memulihkan pemasok terpilih. {detail}",
      bulkRestorePartial:
        "{success} pemasok dipulihkan. Login terkait tetap nonaktif hingga Pulihkan Akses. {failed} gagal.",
      columns: {
        vendor: "Pemasok",
        shortCode: "ID Pemasok",
        contact: "Kontak",
        vendorSince: "Pemasok Sejak",
        actions: "Tindakan"
      },
      form: {
        organization: "Organisasi",
        organizationDesc:
          "Detail perusahaan pemasok untuk pembelian dan catatan kontak.",
        organizationIndividual: "Pemasok",
        organizationIndividualDesc:
          "Detail pribadi untuk pembelian dan catatan kontak.",
        organizationOverseas: "Pemasok Luar Negeri",
        organizationOverseasDesc:
          "Pemasok di luar Indonesia. NPWP tidak diperlukan.",
        vendorName: "Nama Pemasok",
        firstName: "Nama Depan",
        lastName: "Nama Belakang",
        shortCode: "ID Pemasok",
        shortCodeHint:
          "ID otomatis untuk referensi pemasok (mis. V001).",
        shortCodePreviewHint:
          "Pratinjau ID Pemasok berikutnya. ID final ditetapkan saat Anda menyimpan.",
        shortCodeLoading: "Memuat…",
        companyEmail: "Email Perusahaan",
        companyPhone: "Telepon Perusahaan",
        companyAddress: "Alamat Perusahaan",
        email: "Email",
        phone: "Telepon",
        address: "Alamat",
        companyNpwp: "NPWP",
        companyNpwpHint:
          "Wajib. Masukkan tepat 15 atau 16 digit (titik/strip OK).",
        vendorNpwpOrNik: "NPWP / NIK",
        vendorNpwpOrNikHint:
          "Wajib. Masukkan tepat 15 atau 16 digit (titik/strip OK).",
        taxIdDocumentCompany: "Dokumen NPWP",
        taxIdDocumentIndividual: "Dokumen NPWP / NIK",
        taxIdDocumentUploadCompany: "Unggah Dokumen NPWP (Foto Atau Pindai)",
        taxIdDocumentUploadIndividual:
          "Unggah Dokumen NPWP Atau NIK (Foto Atau Pindai)",
        taxIdDocumentReplace: "Ganti Dokumen NPWP (Foto Atau Pindai)",
        taxIdDocumentCurrent: "Dokumen NPWP Saat Ini:",
        taxIdDocumentView: "Lihat File",
        taxIdDocumentHintCompany:
          "Wajib. Unggah foto atau PDF yang jelas dari NPWP perusahaan.",
        taxIdDocumentHintIndividual:
          "Wajib. Unggah foto atau PDF yang jelas dari NPWP atau NIK.",
        taxIdDocumentHintEdit:
          "Pertahankan file saat ini, atau unggah foto atau PDF pengganti.",
        vendorSince: "Pemasok Sejak",
        vendorSinceHint: "Kapan organisasi ini menjadi pemasok RGS.",
        vendorSinceHintIndividual: "Kapan orang ini menjadi pemasok RGS.",
        contactPerson: "Narahubung",
        contactPersonDescCreate: "Narahubung utama di organisasi pemasok.",
        contactPersonDescEdit: "Narahubung utama di organisasi pemasok.",
        contactFirstName: "Nama Depan Narahubung",
        contactLastName: "Nama Belakang Narahubung",
        contactPosition: "Jabatan Narahubung",
        contactEmail: "Email Narahubung",
        contactPhone: "Telepon Narahubung",
        vendorType: "Tipe Pemasok",
        vendorTypeCompany: "Perusahaan",
        vendorTypeIndividual: "Perorangan",
        vendorTypeOverseas: "Luar Negeri"
      }
    },
    employees: {
      title: "Karyawan",
      descriptionAdmin: "Kelola data staf kantor pusat dan lapangan.",
      directoryTitle: "Direktori Karyawan",
      directoryDesc:
        "Data staf, penugasan departemen, dan penempatan lokasi. Akses login portal opsional saat membuat dan dikelola di Pengguna.",
      companyNotFound: "Perusahaan tidak ditemukan.",
      addEmployee: "Tambah Karyawan",
      addBulk: "Tambah Massal",
      addBulkFullTime: "Tambah Massal Penuh Waktu",
      addBulkPartTime: "Tambah Massal Paruh Waktu",
      bulkCreateFullTimeTitle: "Tambah karyawan Penuh Waktu",
      bulkCreatePartTimeTitle: "Tambah karyawan Paruh Waktu",
      bulkCreateDesc:
        "Tambah lebih dari satu karyawan sekaligus. Setiap baris sama seperti Tambah Karyawan — isi semua untuk orang itu.",
      bulkCreatePeople: "Orang",
      bulkCreatePeopleHint:
        "Setiap baris adalah catatan karyawan lengkap. Tidak ada ketentuan bersama.",
      editEmployee: "Ubah Karyawan",
      searchPlaceholder: "Cari Karyawan...",
      deleted: "Dihapus",
      active: "Aktif",
      onLeave: "Sedang Cuti",
      onLeaveChipLine1: "Sedang",
      onLeaveChipLine2: "Cuti",
      leavePending: "Mengajukan Cuti",
      leavePendingChipLine1: "Mengajukan",
      leavePendingChipLine2: "Cuti",
      leavePendingFilter: "Mengajukan Cuti",
      statusFilterAll: "Semua",
      emptyOnLeave: "Tidak Ada Karyawan Sedang Cuti",
      emptyOnLeaveDesc:
        "Karyawan yang ditandai Sedang Cuti di tampilan ini muncul di sini.",
      emptyLeavePending: "Tidak Ada Karyawan Mengajukan Cuti",
      emptyLeavePendingDesc:
        "Karyawan dengan permohonan cuti yang menunggu persetujuan muncul di sini sementara status tetap Aktif.",
      allEmployees: "Semua Karyawan",
      allEmployeesSubtitle: "Semua staf aktif di daftar",
      fullTime: "Penuh Waktu",
      fullTimeSubtitle:
        "Staf Penuh Waktu yang ditugaskan (Kantor Pusat atau Di Proyek)",
      partTime: "Paruh Waktu",
      partTimeSubtitle:
        "Staf Paruh Waktu yang ditugaskan (Di Proyek atau Kantor Pusat)",
      managePositions: "Kelola Jabatan",
      employeePositionsDescription:
        "Tentukan jabatan dalam setiap departemen.",
      positionCount: "{count} jabatan",
      positionCountOne: "{count} jabatan",
      addPosition: "Tambah Jabatan",
      emptyPositions: "Belum ada jabatan yang dikonfigurasi.",
      emptyPositionsDepartment: "Tidak ada jabatan di departemen ini.",
      deletedSubtitle: "Karyawan yang dihapus sementara hingga dipulihkan",
      unassigned: "Belum Ditugaskan",
      unassignedSubtitle:
        "Staf aktif yang menunggu Kantor Pusat atau proyek",
      filterDepartment: "Filter Berdasarkan Departemen",
      selectAll: "Pilih Semua Karyawan",
      selectRow: "Pilih {name}",
      emptyTrash:
        "Karyawan yang dihapus muncul di sini hingga dipulihkan atau dihapus permanen dari direktori.",
      emptyFullTime: "Tidak Ada Karyawan Penuh Waktu Yang Ditugaskan",
      emptyFullTimeDesc:
        "Staf Penuh Waktu yang ditugaskan ke Kantor Pusat atau proyek muncul di sini.",
      emptyPartTime: "Tidak Ada Karyawan Paruh Waktu Yang Ditugaskan",
      emptyPartTimeDesc:
        "Staf Paruh Waktu yang ditugaskan ke proyek atau Kantor Pusat muncul di sini.",
      emptyActive: "Belum Ada Karyawan",
      emptyActiveList: "Tidak Ada Karyawan Aktif",
      emptyActiveListDesc: "Tidak ada karyawan untuk ditampilkan.",
      emptyDeletedList: "Tidak Ada Karyawan Yang Dihapus",
      emptyUnassigned: "Tidak Ada Karyawan Yang Belum Ditugaskan",
      emptyUnassignedFt: "Tidak Ada Karyawan Penuh Waktu Yang Belum Ditugaskan",
      emptyUnassignedFtDesc:
        "Staf Penuh Waktu yang menunggu Kantor Pusat atau proyek muncul di sini.",
      emptyUnassignedPt: "Tidak Ada Karyawan Paruh Waktu Yang Belum Ditugaskan",
      emptyUnassignedPtDesc:
        "Staf Paruh Waktu yang menunggu proyek atau Kantor Pusat muncul di sini.",
      emptySearch: 'Tidak Ada Hasil Untuk "{query}"',
      emptySearchDesc:
        "Coba nama, nomor karyawan, jabatan, departemen, email, atau telepon lain.",
      emptyDepartment: "Tidak Ada Karyawan {name} ({prefix})",
      emptyDepartmentDesc:
        "Tidak ada karyawan di departemen ini pada tampilan saat ini.",
      deleteTitle: "Hapus karyawan?",
      deleteConfirm: "Hapus karyawan",
      deleteDescription:
        "Ini memindahkan karyawan ke Karyawan Dihapus. Data disimpan untuk riwayat tetapi tidak lagi muncul sebagai staf aktif.",
      deleteForeverTitle: "Hapus karyawan selamanya?",
      deleteForeverConfirm: "Hapus selamanya",
      deleteForeverDescription:
        "Karyawan ini akan disembunyikan permanen dari direktori. Login pengguna terkait dan nomor karyawan dilepas permanen. Data database dan riwayat disimpan untuk audit.",
      restoreTitle: "Pulihkan Karyawan?",
      restoreConfirm: "Pulihkan Karyawan",
      restoreDescription:
        "Ini memulihkan karyawan dari Karyawan Dihapus. Login terkait tetap nonaktif — gunakan Pengguna → Akses Dicabut → Pulihkan Akses sebelum mereka dapat masuk lagi.",
      restoreNote:
        "Nama pengguna dan kredensial tetap disimpan. Setelah dipulihkan, login terkait muncul di Akses Dicabut hingga Anda memulihkan akses. Catatan historis (kehadiran, cuti, progres) tetap utuh. Karyawan yang dihapus selamanya tidak dapat dipulihkan.",
      editDescription:
        "Perbarui detail karyawan, departemen, dan penugasan lokasi.",
      bulkDeleteTitle: "Hapus {count} karyawan?",
      bulkDeleteForeverTitle: "Hapus {count} karyawan selamanya?",
      bulkDeleteConfirm: "Hapus {count} karyawan",
      bulkDeleteForeverConfirm: "Hapus {count} selamanya",
      bulkRestoreTitle: "Pulihkan {count} karyawan?",
      bulkRestoreConfirm: "Pulihkan {count} karyawan",
      bulkSelected: "{count} karyawan dipilih",
      bulkActionApplies:
        "Tindakan ini berlaku untuk semua baris terpilih di tampilan saat ini.",
      bulkDeactivateNote:
        "Login pengguna terkait dinonaktifkan (tidak dihapus permanen) dan dipindah ke Pengguna Dihapus. Kredensial disimpan. Setelah memulihkan karyawan, gunakan Pengguna → Akses Dicabut → Pulihkan Akses untuk mengaktifkan lagi login portal. Catatan historis (kehadiran, cuti, progres) tidak dihapus.",
      bulkDeleteForeverNote:
        "Login pengguna terkait dihapus permanen dan tidak dapat dipulihkan. Nomor karyawan tersedia lagi untuk perekrutan berikutnya di departemen tersebut. Kehadiran, cuti, progres, dan catatan historis lainnya tetap di sistem. Tindakan ini tidak dapat dibatalkan dari UI direktori.",
      bulkRestoreNote:
        "Nama pengguna dan kredensial tetap disimpan. Karyawan yang dipulihkan muncul di direktori aktif; login terkait pindah ke Akses Dicabut. Karyawan yang dihapus selamanya tidak dapat dipulihkan.",
      bulkRestoreSuccess:
        "{count} karyawan dipulihkan. Login terkait tetap nonaktif hingga Pulihkan Akses.",
      bulkRestoreAllFailed:
        "Tidak dapat memulihkan karyawan terpilih. {detail}",
      bulkRestorePartial:
        "{success} karyawan dipulihkan. Login terkait tetap nonaktif hingga Pulihkan Akses. {failed} gagal.",
      bulkDeactivateSuccess:
        "{count} karyawan dipindah ke Karyawan Dihapus.",
      bulkDeactivateAllFailed:
        "Tidak dapat menghapus karyawan terpilih. {detail}",
      bulkDeactivatePartial:
        "{success} karyawan dipindah ke Karyawan Dihapus. {failed} gagal.",
      bulkDeleteForeverSuccess:
        "{count} karyawan dihapus permanen dari direktori.",
      bulkDeleteForeverAllFailed:
        "Tidak dapat menghapus permanen karyawan terpilih. {detail}",
      bulkDeleteForeverPartial:
        "{success} karyawan dihapus permanen dari direktori. {failed} gagal.",
      deleteFailed: "Gagal menghapus karyawan.",
      portalLoginRevoked:
        "{name}: sudah memiliki login portal. Gunakan Pengguna → Akses Dicabut → Pulihkan Akses jika dicabut.",
      errors: {
        deleteBlockedAssigned:
          "Tidak dapat menghapus karyawan yang masih ditugaskan ke proyek. Lepaskan atau batalkan penugasan terlebih dahulu.",
        activeBlockedByApprovedLeave:
          "Tidak dapat mengubah status menjadi Aktif saat cuti yang disetujui mencakup hari ini.",
        resignHoOnly: "Hanya Kantor Pusat yang dapat mengundurkan karyawan.",
        resignFailed: "Tidak dapat mengundurkan karyawan ini.",
        lastWorkingDayRequired: "Masukkan hari kerja terakhir.",
        procedureRequired:
          "Pilih According to procedure atau Not according to procedure.",
        alreadyResigned:
          "Karyawan ini sudah mengundurkan diri atau sudah ada catatan resign."
      },
      resign: "Resign",
      resignTitle: "Resign Karyawan",
      resignDescription:
        "Catat pengunduran diri untuk {name}. Pilihan ini menentukan apakah security deposit dikembalikan atau kept by the company.",
      resignConfirm: "Resign Karyawan",
      resigning: "Memproses…",
      lastWorkingDay: "Hari Kerja Terakhir",
      resignProcedure: "Prosedur",
      accordingToProcedure: "According To Procedure",
      accordingToProcedureHint:
        "Status menjadi Resigned setelah hari kerja terakhir. Security deposit yang dipegang dikembalikan di Penggajian Internal sebagai Return of security deposit.",
      notAccordingToProcedure: "Not According To Procedure",
      notAccordingToProcedureHint:
        "Status menjadi Resigned setelah hari kerja terakhir. Security deposit yang dipegang kept by the company. Upah bulan terakhir tetap dihitung kecuali Anda memilih untuk tidak membayar sisa upah.",
      forfeitRemainingWages: "Jangan Bayar Sisa Upah",
      forfeitRemainingWagesHint:
        "Mereka tidak menerima Penggajian Internal untuk hari yang belum dibayar. Jumlah itu menjadi pendapatan di proyek terakhir. Gunakan ini jika mereka mencuri, menghilang, atau keluar tanpa mengikuti prosedur.",
      resignNote: "Catatan (Opsional)",
      depositHeldNote: "Security deposit dipegang: {amount}.",
      depositStatusHeld: "Ditahan",
      depositStatusReturned: "Dikembalikan",
      depositStatusKept: "Ditahan Perusahaan",
      depositStatusNotHeld: "Belum Ditahan",
      depositStatusNotRequired: "Tidak Wajib",
      restoreFailed: "Gagal memulihkan karyawan.",
      deleteForeverFailed:
        "Gagal menghapus permanen karyawan dari direktori.",
      reorderFailed: "Gagal menyusun ulang karyawan.",
      portalStatus: {
        yes: "Ya",
        revoked: "Dicabut",
        no: "Tidak"
      },
      projectAssignDialog: {
        title: "Tugaskan Ke Kantor Pusat",
        description:
          "Tugaskan karyawan ini ke Kantor Pusat. Kru lapangan ditugaskan melalui Proyek.",
        headOffice: "Kantor Pusat",
        siteCrewNote:
          "Untuk menugaskan staf ke lokasi kebersihan, gunakan Proyek → tugaskan kru di proyek.",
        assign: "Tugaskan Ke Kantor Pusat",
        assigning: "Menugaskan…",
        assignFailed: "Gagal menugaskan karyawan."
      },
      columns: {
        employee: "Karyawan",
        status: "Status",
        employeeNo: "ID",
        department: "Departemen",
        position: "Jabatan",
        team: "Tim",
        employmentType: "Jenis Kepegawaian",
        placement: "Penempatan",
        portalLogin: "Login Portal",
        securityDeposit: "Security Deposit",
        actions: "Tindakan"
      },
      manageDepartments: "Kelola Departemen",
      employeeDepartmentsTitle: "Departemen Karyawan",
      employeeDepartmentsDescription:
        "Tentukan departemen seperti Corporate atau Operasi. Departemen mengatur organisasi dan penomoran karyawan. Penempatan (Tersedia / Di Proyek / Kantor Pusat / Lapangan) diatur sistem melalui Tugaskan / Lepaskan. Peran keuangan menjadi jabatan di bawah Corporate.",
      departmentCount: "{count} departemen",
      departmentCountOne: "{count} departemen",
      addDepartment: "Tambah Departemen",
      emptyDepartments:
        "Belum ada departemen. Tambahkan satu untuk mengelompokkan karyawan.",
      positionDialog: {
        createTitle: "Tambah Jabatan",
        createDescription:
          "Tambahkan jabatan untuk sebuah departemen dan atur akses modul bawaan untuk login baru.",
        moduleAccess: "Akses Modul Bawaan",
        moduleAccessHint:
          "Login portal baru untuk jabatan ini mulai dengan modul ini. Untuk memberi satu orang akses lebih, gunakan Pengguna → Izin.",
        createButton: "Tambah Jabatan",
        creating: "Menambahkan…",
        editTitle: "Ubah Jabatan",
        positionName: "Nama Jabatan",
        selectDepartment: "Pilih Departemen",
        availableForNew: "Tersedia Untuk Karyawan Baru",
        employeeCountOne: "{count} karyawan memakai jabatan ini.",
        employeeCountOther: "{count} karyawan memakai jabatan ini.",
        createFailed: "Gagal membuat jabatan.",
        updateFailed: "Gagal memperbarui jabatan.",
        deleteFailed: "Gagal menghapus jabatan.",
        reorderFailed: "Gagal mengurutkan ulang jabatan.",
        deleteTitle: "Hapus Jabatan",
        deleteConfirm: "Hapus Jabatan",
        deleteDescWithEmployees:
          "Tugaskan ulang karyawan sebelum menghapus jabatan ini.",
        deleteDescEmpty: "Jabatan ini tidak memiliki karyawan.",
        employeesReassignedOne: "{count} karyawan akan ditugaskan ulang.",
        employeesReassignedOther: "{count} karyawan akan ditugaskan ulang.",
        selectReplacement: "Pilih Jabatan Pengganti"
      },
      deptDialog: {
        createTitle: "Buat Departemen",
        createDescription:
          "Tambahkan departemen untuk mengelompokkan dan menomori karyawan.",
        createButton: "Buat Departemen",
        creating: "Membuat...",
        editTitle: "Ubah Departemen",
        editDescription: "Perbarui nama departemen atau ketersediaan.",
        departmentName: "Nama Departemen",
        namePlaceholder: "mis. Staf Kebersihan",
        numberPrefix: "Prefix Nomor",
        prefixPlaceholder: "mis. CS",
        prefixHint: "Nomor karyawan akan memakai prefix ini, mis. CS-001",
        prefixHintEdit: "Digunakan untuk nomor karyawan, mis. {prefix}-001",
        activeAvailable: "Aktif (tersedia untuk penugasan baru)",
        employeeCountOne: "{count} karyawan ditugaskan",
        employeeCountOther: "{count} karyawan ditugaskan",
        createFailed: "Gagal membuat departemen.",
        updateFailed: "Gagal memperbarui departemen.",
        deleteFailed: "Gagal menghapus departemen.",
        reorderFailed: "Gagal menyusun ulang departemen.",
        deleteTitle: "Hapus departemen?",
        deleteConfirm: "Hapus departemen",
        deleteDescWithEmployees:
          "Pilih ke mana karyawan yang ditugaskan dipindahkan sebelum menghapus departemen ini.",
        deleteDescEmpty: "Departemen ini akan dihapus secara permanen.",
        employeesAssignedOne:
          "Ada {count} karyawan yang ditugaskan ke departemen ini.",
        employeesAssignedOther:
          "Ada {count} karyawan yang ditugaskan ke departemen ini.",
        moveEmployeesTo: "Pindahkan karyawan ke",
        selectDestination: "Pilih tujuan",
        reassignHint:
          "Karyawan yang dipindah ke departemen lain mendapat nomor karyawan baru untuk departemen tersebut. Karyawan yang dipindah ke Lepas Tugas tetap memakai nomor UNA; login portal dijeda hingga ditugaskan ulang.",
        noEmployeesAssigned:
          "Tidak ada karyawan yang ditugaskan. Tindakan ini tidak dapat dibatalkan."
      },

      form: {
        department: "Departemen",
        departmentControlsHint:
          "Departemen mengatur organisasi dan penomoran karyawan.",
        placement: "Penempatan",
        placementHint:
          "Departemen untuk organisasi dan penomoran; penempatan menunjukkan tempat kerja.",
        placementManaged:
          "{label} — dikelola melalui Tugaskan / Lepaskan.",
        employmentType: "Jenis Kepegawaian",
        selectEmploymentType: "Pilih Jenis Kepegawaian",
        inHouseCleaningAssignHint:
          "In-House Cleaning Staff: tugaskan ke proyek Internal Head Office atau Warehouse untuk CICO (departemen menentukan lokasinya).",
        warehouseStaffPortalHint:
          "Warehouse Staff mulai tanpa login portal. Warehouse Supervisor yang menjalankan Transfer Order. Login dapat dibuat nanti di Users jika diperlukan.",
        status: "Status",
        statusActiveHint:
          "Sedang Cuti diatur ketika periode cuti yang disetujui mencakup hari ini. Staf Aktif dapat menggunakan CICO dan Progress.",
        statusOnLeaveHint:
          "Sedang Cuti dari permohonan cuti yang disetujui. CICO dan Progress dijeda hingga periode cuti berakhir.",
        statusLeavePendingHint:
          "Permohonan cuti menunggu persetujuan. Status kepegawaian tetap Aktif; CICO dan Progress berjalan seperti biasa.",
        selectDepartment: "Pilih departemen",
        selectPosition: "Pilih jabatan",
        employeeNumber: "Nomor Karyawan",
        employeeNoPreview:
          "Pratinjau nomor berikutnya untuk departemen yang dipilih.",
        employeeNoBulkPreview:
          "Pratinjau nomor pertama. Setiap baris tambahan mengambil nomor berikutnya saat disimpan.",
        employmentTypeBulkLocked:
          "Tambah massal ini dikunci ke {type}.",
        employeeNoReassign:
          "Departemen diubah — karyawan akan mendapat nomor berikutnya yang tersedia.",
        employeeNoLocked: "Nomor yang ditetapkan tidak dapat diubah.",
        selectDeptFirst: "Pilih departemen terlebih dahulu",
        firstName: "Nama Depan",
        lastName: "Nama Belakang",
        position: "Jabatan",
        positionHint:
          "Pilih jabatan yang tersedia untuk departemen terpilih.",
        approvalAreas: "Area Persetujuan",
        approvalAreasHint:
          "Pilih minimal satu area yang boleh disetujui Operations Manager ini — Cleaning, Landscaping, Security, Parking untuk kru lapangan, dan Head Office untuk izin staf kantor pusat.",
        manageAllProjects: "Akses ke Semua Proyek",
        manageAllProjectsHintOm:
          "Nyala: Operations Manager ini mengelola semua proyek di Area Persetujuan yang dicentang. Mati: pilih proyek satu per satu.",
        manageAllProjectsHintAm:
          "Nyala: Area Manager ini mengelola semua proyek. Mati: pilih proyek satu per satu.",
        areaProjects: "Proyek yang Dikelola",
        areaProjectsHint:
          "Centang proyek yang boleh dikelola orang ini. Matikan Akses ke Semua Proyek untuk memakai daftar ini.",
        areaProjectsEmpty:
          "Belum ada proyek klien. Tambahkan proyek terlebih dahulu.",
        areaProjectsSearch: "Cari proyek, klien, atau lokasi",
        areaProjectsSelected: "{count} dipilih",
        areaProjectsNoneMatch: "Tidak ada proyek yang cocok dengan “{query}”.",
        startDate: "Tanggal Mulai",
        startDateHint: "Tanggal masuk atau mulai untuk pelacakan masa kerja.",
        contactEmail: "Email Kontak",
        portalLogin: "Login Portal",
        finances: "Keuangan",
        financesHint:
          "Gaji pokok dan pengaturan BPJS. Iuran dihitung ulang saat opsi diubah.",
        financesHintPartTime:
          "Staf Paruh Waktu dibayar per hari. Security Deposit tidak dipungut. BPJS Ketenagakerjaan dan BPJS Kesehatan tidak didaftarkan.",
        partTimeExemptNote:
          "Dibayar per hari, jadi Security Deposit tidak dipungut. Dibebaskan dari BPJS Ketenagakerjaan dan BPJS Kesehatan.",
        securityDepositRequired: "Security Deposit",
        securityDepositRequiredHint:
          "Jika aktif, Penggajian Internal dapat memotong security deposit untuk orang ini. Kantor Pusat dapat mengaktifkan atau menonaktifkan ini untuk jabatan apa pun.",
        cicoExempt: "Bebas CICO",
        cicoExemptHint:
          "Jika aktif, orang ini tidak check-in atau check-out. Penggajian Internal membayar gaji bulanan penuh secara otomatis.",
        progressExempt: "Bebas Laporan Progress",
        progressExemptHint:
          "Jika aktif, orang ini tetap check-in dan check-out, tetapi tidak mengirim Laporan Progress. Check-out tidak ditahan menunggu laporan.",
        bankName: "Nama Bank",
        bankAccountNumber: "Nomor Rekening",
        bankAccountName: "Nama Pemilik Rekening",
        bankHint:
          "Tercetak pada PDF Penggajian Internal untuk transfer gaji. Nama pemilik rekening harus sama dengan buku tabungan.",
        basePay: "Gaji Pokok",
        basePayHint: "Upah bulanan dalam IDR untuk perhitungan BPJS dan THR.",
        basePayHintPartTime:
          "Upah harian dalam IDR. Staf Paruh Waktu dibayar per hari.",
        bpjsKesehatan: "BPJS Kesehatan",
        bpjsKesehatanHelp:
          "Total 5% dari upah bulanan (maks. Rp 12.000.000): 4% perusahaan, 1% karyawan.",
        bpjsKetenagakerjaan: "BPJS Ketenagakerjaan",
        bpjsTkComponents: "Komponen Ketenagakerjaan",
        bpjsTkHelpJht:
          "Jaminan Hari Tua — 3,7% perusahaan / 2% karyawan.",
        bpjsTkHelpJp:
          "Jaminan Pensiun — 2% perusahaan / 1% karyawan (batas upah Rp 10.547.400).",
        bpjsTkHelpJkk:
          "Jaminan Kecelakaan Kerja — hanya perusahaan sesuai persen yang Anda masukkan.",
        bpjsTkHelpJkm:
          "Jaminan Kematian — 0,3% hanya perusahaan.",
        jht: "Jaminan Hari Tua",
        jp: "Jaminan Pensiun",
        jkk: "Jaminan Kecelakaan Kerja",
        jkm: "Jaminan Kematian",
        jkkPercent: "Persen Jaminan Kecelakaan Kerja",
        jkkPercentHint: "Tarif perusahaan dari {min}% sampai {max}%.",
        employeeDeduction: "Potongan Karyawan",
        companyContribution: "Iuran Perusahaan",
        takeHomeFromBase: "Take-Home Dari Gaji Pokok",
        totalEmployerCost: "Total Biaya Perusahaan",
        onLeaveNotAssignable:
          "Karyawan Sedang Cuti tidak dapat ditugaskan. Ubah status ke Aktif terlebih dahulu.",
        idDocumentCurrent: "Dokumen identitas saat ini:",
        idDocumentView: "Lihat berkas",
        idDocumentUpload: "Unggah dokumen identitas (foto atau pindaian)",
        idDocumentReplace: "Ganti dokumen identitas (foto atau pindaian)",
        createFailed: "Gagal membuat karyawan.",
        updateFailed: "Gagal memperbarui karyawan.",
        releaseFailed: "Gagal melepas karyawan dari proyek.",
        assignToHeadOffice: "Tugaskan Ke Kantor Pusat",
        releaseFromAssignment: "Lepas Penugasan"
      }
    },
    users: {
      title: "Pengguna",
      description:
        "Kelola akun login ERP, pulihkan akses, dan buat login portal untuk klien serta karyawan yang membutuhkannya.",
      directoryTitle: "Akun Pengguna",
      directoryDesc:
        "Kelola akun login ERP. Buat login dari karyawan yang sudah ada, atau dari klien untuk akses portal.",
      showingForClient: "Menampilkan pengguna portal untuk {name}.",
      editUser: "Ubah Akun Pengguna",
      searchPlaceholder: "Cari pengguna...",
      deleted: "Dihapus",
      deletedClient: "Klien Dihapus",
      deletedEmployee: "Karyawan Dihapus",
      withoutPortal: "Tanpa login portal",
      noPortalLogin: "Tanpa Login Portal",
      noPortalLoginSubtitle:
        "Tidak ada User terkait — termasuk yang dihapus sementara hingga dihapus permanen",
      revokedAccess: "Akses Dicabut",
      revokedAccessSubtitle:
        "Login dinonaktifkan; kredensial disimpan — pulihkan untuk mengaktifkan kembali",
      active: "Aktif",
      activeSubtitle: "Akun login yang sedang aktif",
      deletedClientSubtitle: "Login portal klien yang dihapus sementara",
      deletedEmployeeSubtitle: "Login karyawan yang dihapus sementara",
      restoreSelected: "Pulihkan terpilih",
      permanentlyRemoveLogin1: "Hapus",
      permanentlyRemoveLogin2: "Login Permanen",
      revoke1: "Cabut",
      revoke2: "Akses",
      restore1: "Pulihkan",
      restore2: "Akses",
      moduleAccess: "{enabled}/{total} akses modul",
      accountOne: "akun",
      accountOther: "akun",
      sections: {
        admin: "Admin",
        clients: "Klien",
        employees: "Karyawan"
      },
      emptyTrash:
        "Akun yang dihapus muncul di sini hingga dipulihkan atau dihapus permanen.",
      emptyActive: "Belum ada akun pengguna",
      emptyActiveList: "Tidak ada akun aktif",
      emptyActiveListDesc: "Akun login yang aktif muncul di sini.",
      emptyRevoked: "Tidak ada akun dengan akses dicabut",
      emptyRevokedDesc:
        "Login yang dinonaktifkan sementara karyawan atau klien terkait masih aktif muncul di sini.",
      emptyDeletedClient: "Tidak ada akun klien yang dihapus",
      emptyDeletedClientDesc:
        "Login portal klien yang dihapus sementara muncul di sini hingga dipulihkan atau dihapus permanen.",
      emptyDeletedEmployee: "Tidak ada akun karyawan yang dihapus",
      emptyDeletedEmployeeDesc:
        "Login karyawan yang dihapus sementara muncul di sini hingga dipulihkan atau dihapus permanen.",
      emptyDeletedList: "Tidak ada pengguna yang dihapus",
      emptySearch: 'Tidak ada hasil untuk "{query}"',
      emptySearchDesc:
        "Coba nama, nama pengguna, email, karyawan, atau klien lain.",
      emptyType: "Tidak ada akun {type}",
      emptyTypeDesc: "Coba filter jenis akun atau kartu status lain.",
      deleteTitle: "Hapus akun pengguna?",
      deleteConfirm: "Hapus Akun",
      deleteDescription:
        "Ini menghapus sementara login. Karyawan atau klien terkait juga dihapus sementara agar akun muncul di Pengguna Dihapus hingga dipulihkan.",
      deleteForeverTitle: "Hapus Akun Selamanya?",
      deleteForeverConfirm: "Hapus Selamanya",
      deleteForeverDescription:
        "Akun pengguna ini akan dihapus permanen dari sistem. Tindakan ini tidak dapat dibatalkan.",
      restoreTitle: "Pulihkan Akun Pengguna?",
      restoreConfirm: "Pulihkan Akun",
      restoreDescription:
        "Ini memulihkan karyawan atau klien terkait yang dihapus sementara ke daftar aktif. Login terkait tetap nonaktif dan pindah ke Akses Dicabut hingga akses dipulihkan. Akun admin tanpa tautan diaktifkan kembali.",
      restoreAccessTitle: "Pulihkan akses login?",
      restoreAccessDescription:
        "Ini mengaktifkan kembali login yang dicabut. Karyawan atau klien terkait tetap Aktif; kredensial tidak berubah.",
      revokeAccess: "Cabut Akses",
      restoreAccess: "Pulihkan Akses",
      permissions: "Izin Akses",
      permissionsTitle: "Izin Modul",
      savePermissions: "Simpan Izin",
      resetPermissions: "Kembali Ke Bawaan",
      generatePortalLogin: "Buat Login Portal",
      revokeAccessTitle: "Cabut Akses?",
      revokeAccessDescription:
        "Ini menonaktifkan login. Kredensial disimpan agar akses dapat dipulihkan nanti.",
      revokeAccessConfirm: "Cabut Akses",
      revoking: "Mencabut...",
      accessRevokedFor: "Akses dicabut untuk {name}.",
      revokeFailed: "Gagal mencabut akses.",
      bulkRevokeTitle: "Cabut Akses untuk {count} Akun?",
      bulkRevokeDescription:
        "Ini menonaktifkan login terpilih. Kredensial disimpan agar akses dapat dipulihkan nanti.",
      bulkRevokeConfirm: "Cabut Akses untuk {count}",
      noEligibleRevoke: "Tidak ada akun yang memenuhi syarat untuk dicabut.",
      permanentlyRemoveTitle: "Hapus Permanen Akses Login Portal?",
      permanentlyRemoveDescription:
        "Ini menghapus permanen login portal. Data karyawan atau klien terkait tetap ada, tetapi mereka tidak dapat masuk lagi kecuali login baru dibuat.",
      permanentlyRemoveConfirm: "Hapus Login Permanen",
      permanentlyRemoving: "Menghapus...",
      permanentlyRemoveFailed: "Gagal menghapus permanen login portal.",
      bulkPermanentlyRemoveTitle:
        "Hapus Permanen Login Portal untuk {count} Akun?",
      bulkPermanentlyRemoveDescription:
        "Ini menghapus permanen login portal terpilih. Data karyawan atau klien terkait tetap ada.",
      bulkPermanentlyRemoveConfirm: "Hapus Permanen {count}",
      noEligiblePermanentlyRemove:
        "Tidak ada akun yang memenuhi syarat untuk dihapus permanen.",
      generatePortalTitle: "Buat Login Portal",
      generatePortalConfirmClients:
        "Buat login portal untuk {count} klien terpilih?",
      generatePortalConfirmEmployees:
        "Buat login portal untuk {count} karyawan terpilih?",
      generatePortalConfirmMixed:
        "Buat login portal untuk {count} akun terpilih?",
      generatePortalButton: "Buat {count} Login",
      generatePortalButtonOne: "Buat {count} Login",
      generating: "Membuat...",
      generateEmployeeTitle: "Buat Login Portal?",
      generateEmployeeDescription:
        "Buat login portal Pengguna terkait untuk karyawan ini. Nama pengguna berdasarkan nama depan.",
      generateClientTitle: "Buat Login Portal?",
      generateClientDescription:
        "Buat login portal Pengguna terkait untuk klien ini. Login ID adalah 8 huruf dari nama klien.",
      generateFailed: "Gagal membuat login portal.",
      withoutPortalSearch: "Cari klien atau karyawan...",
      withoutPortalEmpty: "Semua sudah punya login portal",
      withoutPortalEmptyDesc:
        "Klien dan karyawan tanpa login Pengguna terkait muncul di sini.",
      withoutPortalClients: "Klien",
      withoutPortalEmployees: "Karyawan",
      withoutPortalEmptyClients: "Tidak ada klien tanpa login portal.",
      withoutPortalEmptyEmployees: "Tidak ada karyawan tanpa login portal.",
      withoutPortalRestoreHint:
        "Data yang dihapus sementara tetap terdaftar hingga dihapus permanen. Pulihkan dulu klien atau karyawan, lalu buat login portal.",
      withoutPortalSectionCount: "{count} tanpa login portal",
      selectAllClients: "Pilih Semua Klien",
      selectAllEmployees: "Pilih Semua Karyawan",
      selectAllUsers: "Pilih Semua Pengguna",
      selectClientRow: "Pilih {name}",
      selectEmployeeRow: "Pilih {name}",
      selectUserRow: "Pilih {name}",
      noUsersToShow: "Tidak ada pengguna untuk ditampilkan.",
      bulkDeleteTitle: "Hapus {count} Akun Pengguna?",
      bulkDeleteConfirm: "Hapus {count} Akun",
      bulkDeleteForeverTitle: "Hapus {count} Akun Selamanya?",
      bulkDeleteForeverConfirm: "Hapus {count} Selamanya",
      bulkRestoreTitle: "Pulihkan {count} Akun Pengguna?",
      bulkRestoreConfirm: "Pulihkan {count} Akun",
      bulkRestoreAccessTitle: "Pulihkan Akses untuk {count} Akun?",
      bulkRestoreAccessConfirm: "Pulihkan Akses untuk {count}",
      bulkSelected: "{count} akun dipilih",
      bulkRestoreAccessHint:
        "Kredensial dan izin modul tidak diubah.",
      bulkRestoreDeletedHint:
        "Login terkait tetap di Akses Dicabut hingga akses dipulihkan.",
      bulkDeactivateOwnSkipped:
        "Akun Anda sendiri tidak dapat dihapus dan akan dilewati.",
      bulkDeactivateTrashHint:
        "Pengguna yang dihapus tetap ada di sistem dan dapat dipulihkan dari tab Pengguna Dihapus.",
      bulkDeleteForeverHint:
        "Akun yang terhubung ke karyawan aktif dilewati. Tautan portal klien dicabut. Data karyawan tetap ada tetapi dilepas dari login yang dihapus.",
      bulkDeactivateSuccess:
        "{count} akun pengguna dipindahkan ke Pengguna Dihapus.",
      bulkDeactivateNone:
        "Tidak dapat menghapus pengguna terpilih. {error}",
      bulkDeactivatePartial:
        "{success} akun pengguna dipindahkan ke Pengguna Dihapus. {failed} gagal.",
      bulkDeleteForeverSuccess:
        "{count} akun pengguna dihapus permanen.",
      bulkDeleteForeverNone:
        "Tidak dapat menghapus pengguna terpilih. {error}",
      bulkDeleteForeverPartial:
        "{success} akun pengguna dihapus permanen. {failed} gagal.",
      bulkRestoreAccessSuccess: "{count} akses login dipulihkan.",
      bulkRestoreAccessSuccessOther: "{count} akses login dipulihkan.",
      bulkRestoreDeletedSuccess: "{count} akun pengguna dipulihkan.",
      bulkRestoreDeletedSuccessOther: "{count} akun pengguna dipulihkan.",
      bulkRestoreNone: "Tidak dapat memulihkan pengguna terpilih. {error}",
      bulkRestorePartial: "{success} dipulihkan. {failed} gagal.",
      companyNotFound: "Perusahaan tidak ditemukan.",
      tryAgain: "Silakan coba lagi.",
      columns: {
        user: "Pengguna",
        type: "Jenis",
        linked: "Terkait",
        modules: "Modul",
        password: "Kata Sandi",
        actions: "Tindakan"
      },
      usernameDisplay: "Nama pengguna: {username}",
      passwordNotSet: "Kata sandi belum diatur",
      passwordHiddenCompact: "Kata sandi diatur",
      noPasswordOnFile:
        "Kata sandi belum diatur (menunggu first-login).",
      passwordHiddenOnFile:
        "Kata sandi sudah diatur (tidak ditampilkan). Tidak ada salinan yang dapat dipulihkan. Pengguna harus masuk lagi untuk memperbaruinya, atau gunakan Reset Akun untuk mengembalikan akun ke first-login tertunda.",
      passwordDecryptFailedCompact: "Salinan tidak dapat didekripsi",
      passwordDecryptFailedOnFile:
        "Salinan yang dapat dipulihkan ada di file tetapi tidak dapat didekripsi. Gunakan Reset Akun untuk mengembalikan akun ke first-login tertunda agar pengguna dapat menetapkan kata sandi baru.",
      firstLoginComplete: "First-Login Selesai",
      firstLoginPending: "First-Login Tertunda",
      linkedEmployee: "Karyawan Terkait: {label}",
      linkedClient: "Klien Terkait: {name}",
      linkedVendor: "Pemasok Terkait: {name}",
      linkedAccount: "Akun Terkait",
      cannotRevokeOwn: "Anda tidak dapat mencabut akses untuk akun sendiri",
      cannotDeleteOwn: "Anda tidak dapat menghapus akun sendiri",
      cannotRemovePortalOwn:
        "Anda tidak dapat menghapus permanen akses login portal untuk akun sendiri",
      cannotRevokeOrRemoveOwn:
        "Anda tidak dapat mencabut akses atau menghapus permanen login portal untuk akun sendiri",
      softDeleteCredentialsHint:
        "Kredensial tetap disimpan hingga dihapus selamanya dari sampah. Untuk menonaktifkan login saja sambil menjaga karyawan atau klien tetap Aktif, gunakan Cabut Akses. Untuk menghancurkan login selamanya dan menempatkannya di Tanpa Login Portal, gunakan Hapus Permanen Akses Login Portal.",
      restoreAccessBody:
        "Nama pengguna dan kata sandi tetap sama. Izin modul tidak diubah.",
      restoreDeletedBody:
        "Nama pengguna dan kata sandi tetap disimpan. Login terkait tetap di Akses Dicabut hingga akses dipulihkan sebelum pengguna dapat masuk lagi.",
      deleteForeverBody:
        "Token reset kata sandi dan override modul dihapus. Akses portal klien terkait dicabut. Data karyawan tetap ada tetapi dilepas dari login ini.",
      deleteForeverActiveEmployee:
        "Karyawan terkait {label} masih aktif. Hapus sementara karyawan atau pulihkan akses dulu — penghapusan permanen diblokir.",
      deleteForeverInactiveEmployee:
        "Karyawan terkait {label} ({status}). Data karyawan akan tetap ada tetapi dilepas dari login ini.",
      permanentlyDeletedToast: 'Akun "{name}" dihapus permanen.',
      permissionsDescIntro:
        "Kontrol modul mana yang dapat diakses {name} ({username}).",
      permissionsDescFooter:
        "Akun yang ada menyimpan override hingga Anda menyimpan. Perubahan tersimpan berlaku pada permintaan berikutnya.",
      permissionsDescClient:
        "Default portal klien aktif: Dasbor, Proyek, Laporan Progress, dan Invoice & Penagihan.",
      permissionsDescVendor:
        "Akses portal pemasok dinonaktifkan — login yang tertaut ke pemasok tidak dapat masuk ke modul apa pun. Sakelar di bawah tidak berpengaruh sampai akses portal diaktifkan kembali.",
      permissionsDescEmployee:
        "Default karyawan: Dasbor, Laporan Progress, CICO (staf lapangan), Izin & Sakit; staf HO juga mendapat Proyek.",
      permissionsDescAdmin:
        "Akun admin mulai dengan akses penuh ke setiap modul/halaman agar dapat mendelegasikan akses per pengguna.",
      permissionsDefaultOn: "Bawaan: Aktif",
      permissionsDefaultOff: "Bawaan: Nonaktif",
      permissionsOverridden: "· Diganti",
      permissionsAccountType: "Jenis Akun:",
      permissionsModulesEnabled:
        "{enabled} dari {total} modul diaktifkan",
      permissionsOverridesOne: "· {count} override kustom",
      permissionsOverridesOther: "· {count} override kustom",
      permissionsModuleAccessAria: "Akses {module}",
      form: {
        displayName: "Nama Tampilan",
        displayNamePlaceholder: "Nama tampilan akun",
        username: "Nama Pengguna",
        usernamePlaceholder: "mis. jsmith",
        usernameHint:
          "Login ID / nama pengguna hanya dapat diubah oleh pengelola Pengguna.",
        usernameReadOnlyHint:
          "Hanya pengelola Pengguna yang dapat mengubah Login ID / nama pengguna.",
        recoveryEmail: "Email Pemulihan",
        recoveryEmailPlaceholder: "password-reset@company.co.id",
        currentPassword: "Kata Sandi Saat Ini",
        currentPasswordHint:
          "Salinan yang dapat dipulihkan admin ditampilkan di sini setelah pengguna menyelesaikan first-login. Diperbarui ketika pengguna atau admin menetapkan kata sandi baru. Tidak ada salinan selama first-login tertunda. Reset Akun mengembalikan akun ke first-login tertunda tanpa menerbitkan kata sandi.",
        accountLink: "Tautan Akun",
        unlinkedAdmin:
          "Akun admin tanpa tautan (tidak terhubung ke karyawan atau klien).",
        accountLinkHint:
          "Tautan ditetapkan saat akun dibuat dari direktori Karyawan atau Klien dan tidak dapat diubah di sini.",
        resetAccount: "Reset Akun",
        resetAccountHint:
          "Paksa pengaturan first-login lagi. Menghapus email pemulihan dan mewajibkan pengguna memilih kata sandi baru melalui /first-login. Tautan karyawan/klien tidak diubah.",
        resetAccountConfirm:
          'Reset akun untuk "{username}"?\n\nIni menghapus email pemulihan dan mengembalikan akun ke first-login tertunda. Pengguna harus menyelesaikan pengaturan first-login lagi (atur kata sandi + email pemulihan). Tautan karyawan/klien tetap ada.',
        you: "(Anda)"
      },
      errors: {
        saveFailed: "Gagal menyimpan akun pengguna.",
        resetFailed: "Gagal mereset akun pengguna.",
        deleteFailed: "Gagal menghapus akun pengguna.",
        restoreAccessFailed: "Gagal memulihkan akses login.",
        restoreFailed: "Gagal memulihkan akun pengguna.",
        permissionsSaveFailed: "Gagal menyimpan.",
        reorderFailed: "Gagal mengurutkan ulang pengguna.",
        displayNameRequired: "Nama tampilan wajib diisi.",
        usernameRequired: "Nama pengguna wajib diisi.",
        usernameInvalid:
          "Nama pengguna harus 3–32 karakter dan hanya memakai huruf, angka, titik, tanda hubung, atau garis bawah.",
        usernameTaken: "Nama pengguna sudah digunakan.",
        recoveryEmailRequired: "Email pemulihan wajib diisi.",
        recoveryEmailTaken: "Email pemulihan sudah digunakan.",
        userNotFound: "Pengguna tidak ditemukan.",
        companyNotFound: "Perusahaan tidak ditemukan.",
        reorderInvalid: "Satu atau lebih pengguna tidak valid untuk diurutkan ulang.",
        cannotRevokeOwn: "Anda tidak dapat mencabut akses untuk akun sendiri.",
        cannotRemovePortalOwn:
          "Anda tidak dapat menghapus permanen akses login portal untuk akun sendiri.",
        cannotDeleteOwn: "Anda tidak dapat menghapus akun sendiri.",
        cannotDeleteOwnEmployee:
          "Anda tidak dapat menghapus data karyawan sendiri saat sedang masuk.",
        revokeLinkedOnly:
          "Hanya akun yang terhubung ke klien, pemasok, atau karyawan yang dapat dicabut aksesnya.",
        permanentlyRemoveLinkedOnly:
          "Hanya akun yang terhubung ke klien, pemasok, atau karyawan yang dapat dihapus permanen akses login portalnya.",
        permanentlyRemoveActiveOnly:
          "Hanya login terkait yang aktif yang dapat dihapus permanen. Pulihkan akses dulu, atau gunakan Hapus sementara untuk akun yang dinonaktifkan.",
        permanentlyRemoveFailed:
          "Gagal menghapus permanen akses login portal.",
        employeeArchivedCannotRestore:
          "Karyawan terkait telah dihapus permanen dan tidak dapat dipulihkan.",
        restoreEmployeeFirst:
          "Pulihkan karyawan terkait dulu, lalu gunakan Pulihkan Akses.",
        restoreClientFirst:
          "Pulihkan klien terkait dulu, lalu gunakan Pulihkan Akses.",
        restoreVendorFirst:
          "Pulihkan pemasok terkait dulu, lalu gunakan Pulihkan Akses.",
        partTimeRestoreOnProjectOnly:
          "Akses portal Paruh Waktu hanya tersedia saat ditugaskan ke proyek.",
        onlyDeactivatedPermanentDelete:
          "Hanya akun yang dinonaktifkan yang dapat dihapus permanen.",
        cannotDeleteActiveEmployee:
          "Tidak dapat menghapus: karyawan terkait {employeeNo} ({name}) masih aktif. Hapus sementara karyawan atau pulihkan akses dulu.",
        cannotDeleteActiveClient:
          "Tidak dapat menghapus: klien terkait {name} masih aktif. Hapus sementara klien atau pulihkan akses dulu.",
        deleteUserFailed: "Gagal menghapus pengguna.",
        restoreUserFailed: "Gagal memulihkan pengguna.",
        revokeAccessFailed: "Gagal mencabut akses."
      }
    },
    billing: {
      title: "Invoice & Penagihan",
      taxInvoice: "Pajak",
      ppnKeluaran: "PPN Pengeluaran",
      purchase: "Pengeluaran",
      purchaseDescription:
        "Catat setiap pengeluaran perusahaan di sini: tagihan pemasok, jasa, dan isi ulang Kas Kecil.",
      purchaseTaxTitle: "Faktur Pajak (PPN Masukan)",
      purchaseTaxDesc:
        "Faktur pembelian yang menyertakan PPN masukan atau sudah punya file faktur pajak.",
      hoPaymentsDesc:
        "Jatuh tempo dan status terbuka/terlambat untuk tagihan pemasok (dari syarat pembayaran).",
      vendorPaymentsTitle: "Pembayaran & Pelunasan",
      settlementsTitle: "Pembayaran & Pelunasan",
      settlementsCollections: "Penagihan (AR)",
      settlementsCollectionsDesc:
        "Invoice klien yang menunggu pembayaran atau verifikasi.",
      settlementsPayables: "Utang (AP)",
      settlementsPayablesDesc:
        "Faktur pembelian pemasok dengan jatuh tempo dari syarat pembayaran.",
      settlementsArCount: "{count} invoice klien belum lunas",
      settlementsApCount: "{count} tagihan pemasok dengan jatuh tempo",
      settlementsCardAr: "Piutang Usaha",
      settlementsCardArOverdue: "Piutang Jatuh Tempo",
      settlementsCardArOverdueHint: "Faktur klien melewati jatuh tempo",
      settlementsCardAp: "Utang Usaha",
      settlementsCardApOverdue: "Utang Jatuh Tempo",
      settlementsCardApOverdueHint: "Tagihan pemasok melewati jatuh tempo",
      settlementsArEmpty: "Tidak ada penagihan terbuka",
      settlementsArEmptyDesc:
        "Invoice klien yang menunggu pembayaran akan muncul di sini.",
      settlementsApEmpty: "Tidak ada utang dengan jatuh tempo",
      settlementsApEmptyDesc:
        "Hubungkan pembelian ke pemasok dengan syarat pembayaran untuk melacak jatuh tempo AP.",
      settlementsOpenBilling: "Buka Invoice & Penagihan",
      settlementsOpenPurchases: "Buka Pembelian",
      vendorStatusTaxMissing: "Perlu Faktur Pajak",
      vendorStatusOpen: "Terbuka",
      vendorStatusOverdue: "Terlambat",
      vendorStatusPaid: "Lunas",
      purchaseCount: "{count} faktur pembelian",
      purchasePeriod: "Periode",
      expenseReportDownload: "Unduh Laporan Pengeluaran",
      expenseReportTitle: "Laporan Pengeluaran",
      expenseReportHint: "Pengeluaran menurut tanggal faktur untuk periode yang dipilih.",
      expenseReportDate: "Tanggal Pengeluaran",
      expenseReportReference: "Faktur",
      expenseReportStatus: "Status",
      expenseReportAmount: "Jumlah",
      expenseReportTotal: "Total",
      expenseReportEmpty: "Tidak ada pengeluaran dengan tanggal faktur pada periode ini.",
      expenseReportPeriodMonth: "{month} {year}",
      expenseReportPeriodDay: "{day} {month} {year}",
      expenseReportPeriodYear: "{year}",
      purchaseCardTotal: "Total Beban",
      purchaseCardUnpaid: "Belum Dibayar",
      purchaseCardUnpaidHint: "Masih di Utang Usaha",
      purchaseCardOverdue: "Tagihan Jatuh Tempo",
      purchaseCardOverdueHint: "Faktur pemasok melewati jatuh tempo",
      purchaseCardIncompleteImport: "Impor Belum Lengkap",
      purchaseCardIncompleteImportHint: "Pengiriman, bea, atau bayar pemasok masih kurang",
      purchaseEmptyPeriod: "Tidak Ada Pengeluaran Bulan Ini",
      purchaseEmptyPeriodDesc:
        "Tidak ada pengeluaran dengan tanggal pada bulan yang dipilih. Coba periode lain atau tambah pengeluaran.",
      purchaseUpload: "Tambah Pengeluaran",
      purchaseUploadTitle: "Tambah Pengeluaran",
      purchaseUploadDesc:
        "Catat tagihan pemasok, jasa, atau isi ulang Kas Kecil. Lampirkan tagihan bila ini faktur pemasok.",
      purchaseSupplier: "Pemasok",
      purchaseVendorSelect: "Pilih Pemasok",
      purchaseVendorRequired: "Pilih pemasok yang sudah terdaftar.",
      purchaseVendorMustBeRegistered:
        "Pemasok harus didaftarkan di Pemasok sebelum menambah pembelian.",
      purchaseVendorRegisterOverseasFirst:
        "Daftarkan pemasok Luar Negeri di Pemasok sebelum menambah impor.",
      purchaseVendorRegisterLocalFirst:
        "Daftarkan pemasok Perusahaan atau Perorangan di Pemasok sebelum menambah pembelian lokal.",
      purchaseVendorMustBeOverseas:
        "Impor Dari Luar Negeri hanya memakai pemasok Luar Negeri.",
      purchaseVendorOverseasRequired: "Pilih pemasok Luar Negeri.",
      purchaseInvoiceRef: "Nomor Faktur / Ref",
      purchaseInvoiceRefShort: "No. {ref}",
      purchaseInvoiceRefNone: "Tanpa Invoice",
      purchaseInvoiceRefPlaceholder: "mis. INV-1042",
      purchaseInvoiceDate: "Tanggal Faktur",
      purchaseDate: "Tanggal",
      purchasePaymentTerms: "Syarat Pembayaran",
      paymentDue: "Jatuh tempo",
      purchasePaymentTermsHint:
        "Pembelian ini: {terms}. Jatuh tempo {dueDate}.",
      purchasePaymentTermsCashHint:
        "Tunai — faktur pemasok dibayar sekarang ({dueDate}).",
      purchasePaymentTermsImportNetHint:
        "Net {days} — faktur pabrik menjadi utang usaha sampai Invoice Paid. Bea impor dicatat setelah barang tiba di Jakarta.",
      purchaseImportFactoryNowTitle: "Faktur Pabrik",
      purchaseImportFactoryNowHint:
        "Catat faktur pabrik sekarang: kapan Anda akan bayar, jumlah dan mata uang faktur, plus freight dan asuransi jika sudah ada. Pengiriman ke Jakarta biasanya sudah diatur, jadi ketiga biaya itu sudah diketahui. CIF dihitung dari situ dan tetap dalam mata uang itu.",
      purchaseImportCifNowHint:
        "Nilai Pabean (CIF) adalah faktur pabrik + freight + asuransi. Angka ini tidak berubah saat Anda bayar. Bea Cukai nanti memakai CIF yang sama, dengan kurs mereka sendiri.",
      purchaseImportPayLaterTitle: "Pembayaran Vendor",
      purchaseImportPayLaterHint:
        "Kurs Bank dan biaya bank dicatat saat Anda benar-benar transfer. Itu jumlah Rupiah yang Anda bayar untuk barang. Kurs Bank bukan Kurs Pajak. Membayar tidak mengubah CIF di atas.",
      purchaseImportCashPayNowHint:
        "Tunai — vendor sudah dibayar. Isi Kurs Bank dan biaya bank untuk transfer ini. Itu jumlah Rupiah yang Anda bayar. Ini bukan Kurs Pajak dan tidak mengubah CIF.",
      purchaseImportBookingRate: "Kurs Pencatatan",
      purchaseImportBookingRateHint:
        "Kurs harian pada hari Anda mencatat faktur ini. Rupiah pabrik di gudang dikunci pada kurs ini.",
      purchaseImportBookingRateRequired: "Masukkan Kurs Pencatatan.",
      purchaseImportNetBookingHint:
        "Isi Kurs Pencatatan — kurs harian pada hari Anda mencatat faktur ini. Rupiah pabrik di gudang dikunci di sini. CIF tetap dalam mata uang asli. Bea Cukai memakai kurs mereka sendiri saat barang tiba. Jika Kurs Bank berbeda saat Anda membayar vendor, Head Office mencatat selisih kurs itu sebagai pendapatan atau beban.",
      purchaseImportNetRemittanceLaterHint:
        "Kurs Bank pada transfer diisi saat vendor benar-benar dibayar. Biaya gudang tetap memakai Kurs Pencatatan.",
      purchaseImportRateDifference:
        "Selisih Kurs Untuk Biaya Gudang Impor",
      purchaseImportRateDifferenceExpenseHint:
        "Kurs Bank lebih tinggi dari Kurs Pencatatan. Tambahan biaya ini masuk overhead Head Office — bukan biaya gudang atau proyek.",
      purchaseImportRateDifferenceIncomeHint:
        "Kurs Bank lebih rendah dari Kurs Pencatatan. Penghematan ini masuk pendapatan Head Office — bukan laba gudang atau proyek.",
      purchaseImportDutiesLaterHint:
        "Rincian bea impor diisi saat barang tiba di Jakarta.",
      purchaseImportDutiesSectionTitle: "Bea Impor",
      purchaseImportDutiesSectionHint:
        "Bea Cukai memakai CIF pabrik dan Kurs Pajak mereka sendiri. Centang pungutan impor yang berlaku. Total Bea Impor dihitung dari CIF itu — bukan dari Kurs Bank.",
      purchaseImportBankRateWhenPaid:
        "Kurs Bank diisi saat Anda membayar vendor. Tidak dipakai untuk CIF atau bea impor.",
      purchaseImportDutiesOptionalHint:
        "Opsional sampai barang tiba di Jakarta. Billing ID dan biaya terkait bisa ditambah nanti.",
      purchaseStatusRecordNotCompleted: "Catatan Belum Selesai",
      purchaseStatusAwaitingImportDuties: "Menunggu Bea Impor",
      purchaseStatusAwaitingVendorPayment: "Menunggu Pembayaran Vendor",
      purchaseStatusAwaitingHandling: "Menunggu Faktur Handling",
      purchaseStatusAwaitingShipping: "Menunggu Pengiriman",
      purchaseStatusComplete: "Selesai",
      purchaseCompleteImportArrival: "Catat Kedatangan Impor",
      purchaseCompleteImportArrivalHint:
        "Bea Cukai memakai CIF yang sudah dicatat dan Kurs Pajak mereka sendiri. Isi kurs itu, pungutan yang berlaku, Billing ID, dan faktur bea.",
      purchaseVehicleLease: "Sewa Guna Usaha Kendaraan",
      purchaseVehicleLeaseHint:
        "Finance lease Indonesia: uang muka sekarang, lalu cicilan bulanan. Biaya bank biasanya dibayar di awal.",
      purchaseVehicleLeaseToggle: "Kendaraan ini dibiayai leasing",
      purchaseVehicleIdentity: "Identitas Kendaraan",
      purchaseVehicleIdentityHint:
        "Masukkan nomor plat dan tahun. Plat adalah identitas kendaraan ini. Satu kendaraan per pengeluaran.",
      purchaseVehiclePlate: "Nomor Plat",
      purchaseVehiclePlatePlaceholder: "mis. B 1234 ABC",
      purchaseVehiclePlateHint:
        "Nomor plat adalah identitas kendaraan ini. Satu kendaraan per pengeluaran.",
      purchaseVehiclePlateRequired: "Masukkan nomor plat kendaraan.",
      purchaseVehicleYear: "Tahun Kendaraan",
      purchaseVehicleYearPlaceholder: "mis. 2024",
      purchaseVehicleYearHint: "Tahun model kendaraan ini.",
      purchaseVehicleYearRequired: "Masukkan tahun kendaraan.",
      purchaseLeaseOtr: "Harga On The Road",
      purchaseLeaseDownPayment: "Uang Muka",
      purchaseLeaseTenor: "Tenor (Bulan)",
      purchaseLeaseInterest: "Bunga Per Tahun Persen",
      purchaseLeaseAdminFee: "Biaya Administrasi",
      purchaseLeaseInsurance: "Asuransi",
      purchaseLeaseFiduciary: "Biaya Fidusia",
      purchaseLeaseProvision: "Biaya Provisi",
      purchaseLeaseOtherFee: "Biaya Bank Lain",
      purchaseLeaseMonthly: "Cicilan Bulanan",
      purchaseLeasePrincipal: "Jumlah Dibiayai",
      purchaseLeaseUpfront: "Dibayar Di Awal",
      purchaseLeaseTotal: "Total Biaya Leasing",
      purchasePaymentTermsHintField:
        "Tunai membayar faktur pemasok sekarang. Net menjadi utang usaha sampai Invoice Paid.",
      purchaseAmount: "Jumlah",
      purchaseAmountPlaceholder: "mis. 1500000",
      purchaseItemsBought: "Item Dibeli",
      purchaseAddItem: "Tambah Item",
      purchaseRemoveItem: "Hapus Item",
      purchaseSelectItem: "Pilih Item",
      purchaseQty: "Qty",
      purchaseUnitCost: "Harga Satuan",
      purchaseUnit: "Satuan",
      purchaseServiceFor: "Untuk Jasa Apa",
      purchaseServiceForHint:
        "Ketik pekerjaan dan jumlah faktur. Jangan pecah tagihan jadi kuantitas dan harga satuan — misalnya Tiga Kunjungan Servis AC dan total di faktur.",
      purchaseServiceDescription: "Uraian Jasa",
      purchaseServiceDescriptionPlaceholder:
        "mis. Tiga Kunjungan Servis AC Kantor",
      purchaseServiceAmountRequired: "Masukkan jumlah untuk jasa {n}.",
      purchaseAddService: "Tambah Baris Jasa",
      purchaseServiceLineRequired: "Uraikan jasa untuk baris {n}.",
      purchaseServiceLinesRequired: "Tambahkan setidaknya satu baris jasa.",
      purchaseLineLabel: "Item {n}",
      purchaseServiceLineLabel: "Jasa {n}",
      purchaseLineUnitHint: "Satuan: {unit}",
      purchaseLineTotal: "Baris {amount}",
      purchaseAmountTotal: "Total {amount}",
      purchaseLinesRequired: "Tambahkan setidaknya satu item yang dibeli.",
      purchaseLineItemRequired: "Pilih item untuk baris {n}.",
      purchaseLineQtyRequired: "Masukkan jumlah yang valid untuk baris {n}.",
      purchaseLineCostRequired: "Masukkan harga satuan yang valid untuk baris {n}.",
      purchaseCatalogEmpty:
        "Tambah item di Katalog Barang terlebih dahulu, lalu pilih di sini.",
      purchaseNotes: "Catatan",
      purchaseNotesPlaceholder: "Catatan opsional",
      purchasePurpose: "Tujuan Pembelian",
      purchasePurposeStock: "Stok",
      purchasePurposeProject: "Proyek",
      purchasePurposeInternal: "Internal",
      purchasePurposeHint:
        "Tandai jasa ini ke proyek, atau ke overhead Kantor Pusat. Produk selalu menjadi stok gudang — keluarkan ke proyek dari Inventaris.",
      purchaseProject: "Proyek",
      purchaseProjectPlaceholder: "Pilih proyek",
      purchaseProjectRequired: "Pilih proyek untuk pembelian ini.",
      purchasePaymentForChip: "Pembayaran Untuk",
      purchaseCategory: "Jenis Pengeluaran",
      purchaseCategoryProduct: "Produk",
      purchaseCategoryVehicle: "Kendaraan",
      purchaseCategoryService: "Jasa",
      purchaseCategoryPettyCash: "Kas Kecil",
      purchaseCategoryGovernment: "Pemerintah",
      purchaseCategoryBankLoan: "Pinjaman",
      purchaseCategoryHint:
        "Produk menjadi stok gudang. Kendaraan dibeli di dalam negeri dan dicatat di Inventaris → Kendaraan. Jasa, Kas Kecil, Pemerintah, dan Pinjaman bukan stok.",
      loanSource: "Sumber Pinjaman",
      loanSourceBank: "Pinjaman Bank",
      loanSourceShareholder: "Pinjaman Pemegang Saham",
      loanSourceHint:
        "Pilih dulu siapa yang meminjamkan. Untuk pinjaman bank, pilih untuk apa pembayaran ini. Lalu pilih pinjaman terdaftar.",
      loanSourceRequired: "Pilih Pinjaman Bank atau Pinjaman Pemegang Saham.",
      loanPaymentFor: "Untuk Pembayaran",
      loanPaymentForInterest: "Bunga",
      loanPaymentForInstallment: "Angsuran",
      loanPaymentForProvision: "Provisi Bank",
      loanPaymentForAdminFee: "Biaya Admin Bank",
      loanPaymentForHint:
        "Bunga dan angsuran adalah pembayaran rutin. Provisi Bank dan Biaya Admin Bank menempel pada pinjaman terdaftar yang Anda pilih — muncul di halaman pinjaman itu. Laporan Keuangan mencatatnya sebagai biaya bank, bukan bunga, dan tidak memisah Standby versus Term.",
      loanPaymentForRequired: "Pilih untuk apa pembayaran ini.",
      loanExpenseProvisionHint:
        "Isi provisi yang ditagih bank. Ini beban, dan pokok yang masih terutang tidak berubah.",
      loanExpenseAdminFeeHint:
        "Isi biaya admin yang ditagih bank. Ini beban, dan pokok yang masih terutang tidak berubah.",
      loanPaymentThisMonthShouldBe: "Pembayaran Bulan Ini Seharusnya",
      loanProvisionPaid: "Provisi Bank",
      loanAdminFeePaid: "Biaya Admin Bank",
      loanFacility: "Pinjaman Terdaftar",
      loanFacilityPlaceholder: "Pilih pinjaman terdaftar",
      loanFacilityRequired: "Pilih pinjaman terdaftar untuk pembayaran ini.",
      loanFacilityEmpty:
        "Daftarkan pinjaman di Keuangan → Pinjaman terlebih dahulu, lalu kembali ke sini untuk mencatat pengembalian.",
      loanExpenseStandbyHint:
        "Isi bunga yang ditagih bank atau pemegang saham. Pokok yang masih terutang tidak berubah.",
      loanExpenseTermHint:
        "Isi jumlah yang dibayar kali ini. Boleh lebih atau kurang dari angsuran biasa.",
      loanOutstanding: "Pokok Yang Masih Terutang",
      loanChargesInterest: "Apakah Pemegang Saham Membebankan Bunga?",
      loanChargesInterestHint:
        "Jika ya, pilih Bunga Bulanan atau Bunga Tahunan, lalu isi suku bunga. Saldo harian ditagih setiap bulan sebagai beban belum dibayar.",
      loanInterestBasis: "Bunga Dikutip Sebagai",
      loanInterestBasisMonthly: "Bunga Bulanan",
      loanInterestBasisAnnual: "Bunga Tahunan",
      loanInterestBasisRequired: "Pilih Bunga Bulanan atau Bunga Tahunan.",
      loanInterestBasisHint:
        "Pilih cara suku bunga ditulis. Lalu isi persennya. Bank menghitung bunga harian dari uang yang benar-benar terpakai setiap hari. Plafon yang belum dipakai tidak dikenai bunga.",
      loanMonthlyRate: "Suku Bunga Bulanan %",
      loanMonthlyRateHint:
        "Dikutip per bulan. Bunga harian memakai persen ini dibagi jumlah hari pada bulan kalender itu.",
      loanMonthlyRateRequired: "Masukkan suku bunga bulanan.",
      loanShareholderName: "Nama Pemegang Saham",
      loanInterestPaid: "Bunga Dibayar",
      loanPrincipalReturned: "Pokok Dikembalikan",
      bankLoanKind: "Jenis Pinjaman",
      bankLoanKindStandby: "Pinjaman Standby",
      bankLoanKindTerm: "Pinjaman Berjangka",
      bankLoanKindHint:
        "Pinjaman Standby: isi bunga yang dibayar. Pinjaman Berjangka: isi angsuran yang dibayar kali ini.",
      bankLoanKindStandbyHint:
        "Bank biasanya menyebut ini Pinjaman Standby atau Kredit Rekening Koran. Bunga hanya dihitung dari saldo yang ditarik. Plafon yang belum dipakai tidak dikenai bunga.",
      bankLoanKindTermHint:
        "Ini Pinjaman Berjangka (Kredit Angsuran). Bank Indonesia umumnya memakai anuitas: satu angsuran tetap setiap bulan, di awal lebih banyak bunga, kemudian lebih banyak pokok.",
      bankLoanAnuitasHint:
        "Angsuran bulanan memakai rumus anuitas bank Indonesia: M = P × r × (1+r)^n / ((1+r)^n − 1), dengan r suku bunga bulanan. Ini cara biasa di BCA, Mandiri, dan BNI. Bukan satu-satunya cara — ada bank yang memakai flat atau efektif menurun — tetapi ERP ini memakai anuitas agar angsuran sesuai jadwal bank pada umumnya.",
      bankLoanKindRequired: "Pilih Pinjaman Standby atau Pinjaman Berjangka.",
      bankLoanFacilityLimit: "Plafon Kredit",
      bankLoanFacilityLimitHint:
        "Batas maksimum yang boleh ditarik pada fasilitas standby ini. Bunga hanya dihitung dari jumlah yang sudah ditarik, bukan dari sisa plafon.",
      bankLoanFacilityLimitRequired: "Masukkan plafon kredit.",
      bankLoanDrawnAmount: "Jumlah Ditarik",
      bankLoanPrincipal: "Pokok Pinjaman",
      bankLoanAnnualRate: "Suku Bunga Tahunan %",
      bankLoanAnnualRateHint:
        "Suku bunga nominal tahunan. Bunga harian adalah saldo terutang × suku bunga ini / 360, konvensi KRK / rekening koran Indonesia yang dipakai BCA dan Mandiri.",
      bankLoanAnnualRateRequired: "Masukkan suku bunga tahunan.",
      bankLoanTenorMonths: "Tenor (Bulan)",
      bankLoanMonthlyInstallment: "Perkiraan Angsuran Bulanan",
      bankLoanPaymentAmount: "Jumlah Dibayar Saat Ini",
      bankLoanPaymentAmountHint:
        "Bunga, angsuran bulanan, atau jumlah lain yang benar-benar didebit bank. Jangan masukkan seluruh plafon yang belum dipakai.",
      bankLoanRef: "Nomor Rekening Pinjaman / Referensi",
      bankLoanRefPlaceholder: "Nomor rekening pinjaman atau nota bank",
      bankLoanRefHint: "Nomor rekening pinjaman atau nota pembayaran dari bank.",
      bankLoanDocument: "Bukti Pembayaran",
      purchasePaymentProof: "Bukti Pembayaran",
      loanPaidDate: "Tanggal Bayar",
      purchaseTransferFee: "Biaya Transfer Bank",
      purchaseTransferFeeHint:
        "Biaya antar bank pada transfer ini (SKN, BI-FAST, atau RTGS). Isi 0 jika bank yang sama atau biayanya dibebaskan. Mencatatnya membuat kas ERP sesuai mutasi bank.",
      purchaseTransferFeePlaceholder: "0",
      purchaseVehicleBought: "Kendaraan Dibeli",
      purchaseVehicleCatalogEmpty:
        "Tambah tipe Kendaraan di Katalog Barang terlebih dahulu, lalu pilih di sini.",
      purchaseSelectItemDesc:
        "Pilih jenis item terlebih dahulu, lalu cari dan pilih item katalog.",
      purchaseSelectVehicleDesc:
        "Cari dan pilih tipe kendaraan dari Katalog Barang.",
      purchaseSelectItemTypeHint:
        "Pilih Peralatan, Bahan Kimia, Bahan Habis Pakai, Suku Cadang, atau Lainnya.",
      purchaseItemTypeLabel: "Jenis Item",
      purchaseItemTypeCount: "Item",
      purchaseSearchItemsPlaceholder: "Cari nama atau SKU",
      purchaseNoItemsForType: "Tidak ada item jenis ini di Katalog Barang.",
      purchaseNoItemsMatchSearch: "Tidak ada item yang cocok dengan pencarian ini.",
      purchaseChangeItem: "Ubah",
      governmentTaxType: "Jenis Pembayaran",
      governmentTaxTypeHint:
        "Pilih pembayaran pemerintah ini. BPJS dibayar ke virtual account. Jenis pajak memakai ID Billing DJP. PPN dikreditkan di SPT Masa. PPh Pasal 25 dan 29 dikreditkan saat SPT Tahunan Badan.",
      governmentTaxKindPpn: "PPN",
      governmentTaxKindPph25: "Angsuran PPh Badan",
      governmentTaxKindPph29: "PPh Badan Setoran Akhir",
      governmentTaxKindPph21: "PPh Pasal 21",
      governmentTaxKindPph23: "PPh Pasal 23",
      governmentTaxKindPph42: "PPh Final",
      governmentTaxKindStampDuty: "Bea Meterai",
      governmentTaxKindPbb: "Pajak Bumi Dan Bangunan",
      governmentTaxKindPph22: "Pajak Penghasilan Pasal 22",
      governmentTaxKindOther: "Pungutan Pemerintah Lain",
      governmentTaxKindBpjsKesehatan: "BPJS Kesehatan",
      governmentTaxKindBpjsKetenagakerjaan: "BPJS Ketenagakerjaan",
      governmentVirtualAccount: "Nomor Virtual Account",
      governmentVirtualAccountPlaceholder: "Nomor virtual account BPJS",
      governmentVirtualAccountHint:
        "Nomor virtual account pada tagihan BPJS atau transfer bank.",
      governmentBpjsPeriod: "Periode Iuran",
      governmentBpjsMonth: "Bulan",
      governmentBpjsYear: "Tahun",
      governmentBpjsPeriodHint:
        "Bulan iuran ini, bukan tanggal bayar.",
      governmentBpjsPaymentHint:
        "Bayar virtual account BPJS untuk program ini. Tanggungan perusahaan adalah beban.",
      governmentBpjsAmount: "Jumlah Ditransfer",
      governmentBpjsAmountHint:
        "Ketik jumlah yang dikirim ke virtual account. Tanggungan perusahaan adalah beban.",
      governmentBpjsDocument: "Bukti Pembayaran",
      commercialTaxKindPpn: "Pajak Pertambahan Nilai",
      commercialTaxKindPph23: "Pajak Penghasilan Pasal 23",
      commercialTaxKindPpnAndPph23:
        "Pajak Pertambahan Nilai Dan Pajak Penghasilan Pasal 23",
      commercialTaxKindPph42: "Pajak Penghasilan Final 4-2",
      commercialTaxKindPpnAndPph42:
        "Pajak Pertambahan Nilai Dan Pajak Penghasilan Final 4-2",
      commercialTaxKindPph21: "Pajak Penghasilan Pasal 21",
      commercialTaxKindPph22: "Pajak Penghasilan Pasal 22",
      commercialTaxKindPph26: "Pajak Penghasilan Pasal 26",
      commercialTaxKindStampDuty: "Bea Meterai",
      commercialTaxKindPbb: "Pajak Bumi Dan Bangunan",
      commercialTaxKindOther: "Pajak Lainnya",
      otherTaxName: "Pajak Apa Ini",
      otherTaxNameHint: "Ketik nama pajak ini.",
      otherTaxNamePlaceholder: "mis. Pajak Daerah",
      otherTaxNameRequired: "Masukkan nama pajak.",
      otherTaxRate: "Tarif Pajak",
      otherTaxRatePlaceholder: "mis. 10",
      otherTaxRateRequired: "Masukkan persentase tarif pajak.",
      otherTaxRateHint: "Persen yang dikenakan atau dibayar untuk pajak lain ini.",
      governmentBillingId: "ID Billing",
      governmentBillingIdPlaceholder: "mis. 020012345678901",
      governmentBillingIdHint:
        "ID Billing 15 digit dari Direktorat Jenderal Pajak (Coretax / DJP Online).",
      governmentBillingIdShort: "ID Billing {ref}",
      governmentDescription: "Uraian",
      governmentDescriptionPlaceholder: "mis. PPN masa Agustus",
      governmentAmount: "Jumlah Tagihan",
      governmentAmountHint: "Hanya Rupiah.",
      governmentCurrency: "Mata Uang",
      governmentCurrencyIdr: "Rupiah",
      governmentDocument: "Tagihan Billing",
      governmentDocumentRequired: "Unggah surat billing atau bukti tagihan.",
      governmentChip: "Pemerintah",
      purchaseImportTaxCreditNote:
        "PPN adalah kredit PPN Masukan bulanan. PPh Pasal 22 adalah kredit PPh Badan di akhir tahun.",
      purchaseImportPpnOnGoods: "PPN Pada Barang Impor",
      purchaseImportPpnOnHandling: "PPN Pada Biaya Handling",
      purchaseImportPpnOnItems: "PPN Pada Barang",
      purchaseImportPaidToVendor: "Dibayar Ke Vendor",
      purchaseImportPaidToVendorTotal: "Total Dibayar Ke Vendor",
      purchaseImportAmountSent: "Jumlah Dikirim",
      purchaseImportPaidToVendorHint:
        "Invoice Pabrik + Pengiriman yang termasuk + Asuransi yang termasuk + Biaya Transfer Bank, × Kurs Bank, ditambah Biaya Telex. Pengiriman atau asuransi terpisah ditambah setelah Jumlah Dikirim.",
      purchaseImportGrandTotalSpend: "Total Pengeluaran",
      purchaseImportCredits: "Kredit Pajak",
      purchaseImportVatCredit: "Kredit Pajak / Pajak Pertambahan Nilai",
      purchaseImportPph22Credit: "Pajak Penghasilan Pasal 22 / Kredit PPh",
      purchaseImportWarehouseSpendHint:
        "Biaya Gudang adalah biaya untuk mendatangkan produk ke Indonesia, dikurangi kredit pajak yang berlaku (Pajak Pertambahan Nilai dan Pajak Penghasilan Pasal 22).",
      purchaseImportWarehouseAfterDuties:
        "Kredit pajak dan biaya gudang diisi saat bea impor dicatat. Rupiah pabrik memakai Kurs Pencatatan, atau Kurs Bank pada pembayaran tunai. Kurs Pajak hanya untuk bea. Membayar nanti tidak mengubah biaya gudang atau proyek.",
      purchaseOrigin: "Di Mana Dibeli",
      purchaseOriginLocal: "Dibeli Lokal",
      purchaseOriginImport: "Impor Dari Luar Negeri",
      purchaseOriginHint:
        "Tagihan pemasok lokal tetap dalam Rupiah. Luar negeri: catat faktur pabrik, freight, asuransi, dan Kurs Pencatatan atau Kurs Bank sekarang. Pungutan impor setelah barang tiba di Jakarta.",
      importFulfillment: "Bagaimana Impor Ini Ditangani",
      importHandledInternally: "Ditangani Internal",
      importHandledInternallyHint:
        "Centang pungutan impor yang berlaku, lalu isi satu ID Billing dan unggah invoice Bea Impor yang sama dengan pungutan itu. Pilih Vendor Handling, atau Ditangani Kantor Pusat jika staf yang mengurus impor — maka tidak ada biaya handling.",
      importOutsourced: "Alih Daya",
      importOutsourcedHint:
        "Pihak ketiga membayar semua bea dan pajak. Relasi Global Solusi membayar faktur pabrik (sekarang atau nanti) dan mengganti biaya handling all-in mereka.",
      importDutiesBillingId: "ID Billing Bea Impor",
      importDutiesDocument: "Invoice Bea Impor",
      importDutiesDocumentHint:
        "Invoice ID Billing untuk pungutan impor itu. Ini dokumen bea dan pajak — tidak ada faktur pajak terpisah.",
      importDutiesNoTermsHint:
        "Bea dan pajak impor tidak punya tempo. Harus dibayar sekarang.",
      handlingVendor: "Vendor Handling",
      handlingVendorPlaceholder: "Pilih Vendor Handling",
      handlingVendorPlaceholderInternal:
        "Pilih Vendor Handling Atau Kantor Pusat",
      handlingVendorRequired: "Pilih Vendor Handling.",
      handlingVendorMustBeLocal:
        "Vendor Handling harus Perusahaan atau Perorangan.",
      handlingVendorRegisterLocalFirst:
        "Daftarkan pemasok Perusahaan atau Perorangan di Pemasok sebelum memilih Vendor Handling.",
      handlingByHeadOffice: "Ditangani Kantor Pusat",
      handlingByHeadOfficeHint:
        "Staf Kantor Pusat yang mengurus impor ini. Tidak ada biaya handling.",
      handlingFee: "Biaya Handling",
      handlingFeeHintInternal:
        "Biaya manajemen yang dikenakan agen bea cukai untuk membantu mengeluarkan barang.",
      handlingFeeHintOutsourced:
        "Jumlah all-in yang kami ganti ke handler. Invoice mereka sudah mencakup bea dan pajak.",
      handlingFeeRequired: "Isi biaya handling.",
      handlingFeeIncludesPpn: "Apakah Biaya Handling Dikenai PPN?",
      handlingFeePpnRate: "Tarif PPN Biaya Handling",
      handlingFeeTotalPaid: "Total dibayar termasuk PPN: {amount}.",
      handlingFeeInvoice: "Invoice Biaya Handling",
      handlingFeeInvoiceRequired: "Unggah invoice Biaya Handling.",
      handlingFeeInvoiceHint:
        "Invoice vendor handling untuk biayanya. Ini bukan invoice pabrik dan bukan invoice Bea Impor.",
      handlingFeeTaxInvoice: "Faktur Pajak Handling",
      handlingFeeTaxInvoiceRequired:
        "Unggah faktur pajak untuk biaya handling.",
      handlingFeeTaxInvoiceHint:
        "Faktur pajak biaya handling jika dikenai PPN. Ini kredit pajak masukan, bukan ID Billing Bea Impor.",
      purchaseFactoryInvoice: "Invoice Pabrik",
      purchaseFactoryInvoiceHint:
        "Invoice pemasok luar negeri untuk barangnya.",
      importDutiesDocumentCreditHint:
        "Invoice ID Billing yang dibayar ke pemerintah. PPN dan PPh Pasal 22 pada dokumen ini adalah kredit pajak.",
      purchaseBackToExpenses: "Pengeluaran",
      purchaseWhatWeBought: "Pada Pengeluaran Ini",
      purchaseNoLineItems: "Tidak ada yang tercatat pada pengeluaran ini.",
      purchaseLineItem: "Uraian",
      purchaseLineQty: "Jumlah",
      purchaseLineUnitCost: "Harga Satuan",
      purchaseExpenseLineTotal: "Total",
      purchaseDocuments: "Dokumen",
      purchaseDocumentsHint:
        "Semua file pada pengeluaran ini. Untuk impor: invoice pabrik, invoice ID Billing Bea Impor, invoice handling, dan faktur pajak handling jika dikenai PPN.",
      purchaseDocumentMissing: "Belum dilampirkan.",
      purchaseImportBreakdown: "Rincian Impor",
      purchaseImportCustomsValue: "Nilai Pabean (CIF)",
      purchaseImportCustomsRateDutiesHint:
        "Bea Cukai mengonversi CIF pabrik dengan Kurs Pajak mereka sendiri. Kurs Bank tidak dipakai di sini. Pengiriman atau asuransi Rupiah ditambah sesuai jumlah yang diisi.",
      purchaseReversed: "Dibatalkan",
      invoicePaid: "Invoice Dibayar",
      purchaseReverse: "Batalkan",
      purchaseReverseReason: "Mengapa pembelian ini dibatalkan?",
      purchaseReverseFailed: "Tidak dapat membatalkan pembelian ini.",
      purchaseOriginChipImport: "Impor",
      purchaseImportForeignPlaceholder: "mis. 5000",
      purchaseImportFactoryCurrencyHint:
        "Biaya Transfer Bank memakai mata uang ini. Pengiriman dan asuransi juga, kecuali dicentang Tidak Termasuk Dalam Invoice Pabrik.",
      purchaseImportNotIncludedInFactoryInvoice: "Tidak Termasuk Dalam Invoice Pabrik",
      purchaseImportSeparateFeeHint:
        "Dibayar pada transfer terpisah. Isi Kurs Bank untuk kiriman dan Kurs Pajak untuk mata uang ini.",
      purchaseImportSeparateIdrHint:
        "Isi jumlah ini dalam Rupiah. Kurs Bank dan Kurs Pajak tidak dipakai.",
      purchaseImportFreightSeparate: "Pengiriman (Pembayaran Terpisah)",
      purchaseImportInsuranceSeparate: "Asuransi (Pembayaran Terpisah)",
      purchaseImportRate: "Kurs Bank",
      purchaseImportRatePlaceholder: "mis. 16200",
      purchaseImportRateHint:
        "Kurs yang dipakai bank untuk kiriman ini. 16200 tampil sebagai Rp 16.200.",
      purchaseImportCustomsRate: "Kurs Pajak",
      purchaseImportCustomsRateFor: "Kurs Pajak ({currency})",
      purchaseImportCustomsRatePlaceholder: "mis. 16200",
      purchaseImportCustomsRateHint:
        "Kurs pajak resmi untuk mata uang ini. Dipakai untuk Nilai Pabean (CIF). Bukan Kurs Bank.",
      purchaseImportCustomsInvoiceIdr:
        "Nilai Pabean (CIF): {amount}.",
      purchaseImportBankCharge: "Biaya Transfer Bank",
      purchaseImportBankChargeHint:
        "Seluruh biaya transfer bank dalam mata uang Invoice Pabrik.",
      purchaseImportFullAmountFee: "Biaya Full Amount",
      purchaseImportLocalBankFee: "Biaya Telex",
      purchaseImportLocalBankFeeHint:
        "Biaya telex bank lokal, ditagih dalam Rupiah.",
      purchaseImportFreight: "Pengiriman",
      purchaseImportFreightHint:
        "Mata uang yang sama dengan Invoice Pabrik. Kosongkan jika pengiriman sudah masuk invoice pabrik.",
      purchaseImportInsurance: "Asuransi",
      purchaseImportInsuranceHint:
        "Mata uang yang sama dengan Invoice Pabrik. Biasanya tidak ada.",
      purchaseImportConvertedIdr: "{amount} dalam Rupiah",
      purchaseImportCharges: "Pungutan Impor Yang Berlaku",
      purchaseImportChargesHint:
        "Centang setiap pungutan pada invoice Bea Impor, satu per satu. Kosongkan jumlah jika memakai hitungan resmi, atau ketik jumlah dari pemberitahuan.",
      purchaseImportDutiesTotal: "Total Bea Impor",
      purchaseImportFormE: "Surat Keterangan Asal Form E",
      purchaseImportFormEHint:
        "Form E ASEAN / ATIGA. Jika diterima Bea Cukai, Bea Masuk biasanya 0%.",
      purchaseImportBeaMasuk: "Bea Masuk",
      purchaseImportBeaMasukHint:
        "Dikenakan atas nilai pabean dalam Rupiah (faktur + pengiriman + asuransi). Tarif tergantung kode HS. Isi persen dari pemberitahuan, atau jumlah yang dibayar.",
      purchaseImportPpnbm: "Pajak Penjualan Barang Mewah (PPnBM)",
      purchaseImportPpnbmHint:
        "Dikenakan atas Nilai Impor (nilai pabean + Bea Masuk). Hanya untuk barang mewah yang terdaftar. Biarkan mati untuk perlengkapan biasa.",
      purchaseImportPpn: "Pajak Pertambahan Nilai (PPN)",
      purchaseImportPpnHint:
        "Dikenakan atas Nilai Impor (nilai pabean + Bea Masuk). Barang biasa memakai tarif efektif 11%. Ini pajak masukan yang dapat dikreditkan — tidak ditambahkan ke harga satuan gudang.",
      purchaseImportPph22: "Pajak Penghasilan Pasal 22 (PPh 22)",
      purchaseImportPph22Hint:
        "Dikenakan atas Nilai Impor yang sama dengan PPN (nilai pabean + Bea Masuk). 2,5% jika punya Angka Pengenal Importir, 7,5% jika tidak. Pajak dibayar di muka — tidak ditambahkan ke harga satuan gudang.",
      purchaseImportPph22Basis: "Angka Pengenal Importir",
      purchaseImportPph22Api: "Punya Nomor (2,5%)",
      purchaseImportPph22WithoutApi: "Tanpa Nomor (7,5%)",
      purchaseImportPph22Custom: "Tarif Lain",
      purchaseImportRatePercent: "Persen Tarif",
      purchaseImportPaidAmount: "Jumlah Dibayar (Rupiah)",
      purchaseImportAutoAmount: "Terhitung",
      purchaseImportStockCost: "Biaya Gudang",
      purchaseImportStockCostHint:
        "Harga satuan gudang adalah Biaya Gudang ÷ jumlah pcs. PPN dan PPh Pasal 22 tetap tercatat di pengeluaran, tetapi tidak masuk ke stok.",
      purchaseImportUnitCost: "{qty} pcs → Harga Satuan Gudang {amount}",
      purchaseImportUnitCostNeedQty:
        "Tambahkan jumlah pcs agar harga satuan gudang dapat dihitung.",
      purchaseImportForeignLine: "Bagian Faktur (Valas)",
      purchaseImportRequired:
        "Masukkan jumlah faktur pabrik luar negeri.",
      purchaseImportCustomsRateRequired:
        "Masukkan Kurs Pajak untuk faktur Bea Impor.",
      purchaseFreeOfCharge: "Gratis",
      purchaseFreeOfChargeHint:
        "Ya jika vendor mengirim tanpa biaya (garansi, pengganti, complimentary). Stok tetap masuk. Tidak ada utang usaha.",
      purchaseFreeOfChargeServiceHint:
        "Ya jika vendor menyediakan ini tanpa biaya (garansi, complimentary). Tidak ada utang usaha.",
      purchaseFreeOfChargeReason: "Alasan Gratis",
      purchaseFreeOfChargeReasonPlaceholder:
        "Mis. Garansi — pabrik mengirim suku cadang pengganti",
      purchaseFreeOfChargeReasonRequired:
        "Isi alasan pembelian ini gratis.",
      purchaseFreeOfChargeChip: "Gratis",
      purchaseHasInvoice: "Apakah Ada Invoice?",
      purchaseHasInvoiceHint:
        "Vendor gratis sering tidak mengirim invoice. Pilih Tidak jika tidak ada.",
      purchaseAddShippingCost: "Tambah Biaya Pengiriman",
      purchaseAddShippingCostHint:
        "Uang tunai untuk menerima barang. Ini bukan faktur pabrik.",
      purchaseShippingCost: "Biaya Pengiriman",
      purchaseShippingAmount: "Jumlah",
      purchaseShippingRequired: "Isi biaya pengiriman.",
      purchaseShippingRateRequired: "Isi Kurs Bank untuk biaya pengiriman ini.",
      purchaseShippingIdrHint:
        "Isi jumlah dalam Rupiah. Kurs Bank tidak dipakai.",
      purchaseShippingFxHint:
        "Isi jumlah dan Kurs Bank yang dipakai bank untuk pembayaran ini.",
      purchaseAddRelatedCosts: "Tambah Biaya Terkait",
      purchaseAddRelatedCostsHint:
        "Uang tunai untuk jasa ini. Ini bukan faktur vendor.",
      purchaseRelatedCost: "Biaya Terkait",
      purchaseRelatedCostPlaceholder: "Mis. Kunjungan Lokasi, Izin",
      purchaseRelatedCostRequired: "Isi jenis biaya terkait ini.",
      purchaseRelatedCostAmountRequired: "Isi biaya terkait.",
      purchaseRelatedCostRateRequired:
        "Isi Kurs Bank untuk biaya terkait ini.",
      purchaseHasCustomsFees: "Apakah Ada Bea Cukai?",
      purchaseHasCustomsFeesHint:
        "Ada bea atau pungutan untuk melepas barang?",
      purchaseCustomsFeesImportOnlyHint:
        "Bea cukai hanya berlaku untuk impor.",
      purchaseDeclaredValue: "Nilai Deklarasi",
      purchaseDeclaredValueHint:
        "Nilai yang dideklarasikan vendor atau PIB. Ini dasar bea, bukan faktur pabrik.",
      purchaseDeclaredValueRequired: "Isi nilai deklarasi.",
      purchaseDeclaredIdrHint:
        "Isi jumlah dalam Rupiah. Kurs Pajak tidak dipakai.",
      purchaseDeclaredFxHint:
        "Isi jumlah dan Kurs Pajak (NDPBM) untuk mata uang ini.",
      purchaseDeclaredCustomsRateRequired:
        "Isi Kurs Pajak untuk nilai deklarasi ini.",
      purchaseIncludesPpn: "Termasuk Pajak",
      purchaseIncludesPpnHint:
        "Pilih Ya jika tagihan pemasok mencakup pajak. Setelah itu pilih apakah pajaknya Pajak Pertambahan Nilai, Pajak Penghasilan, atau keduanya.",
      purchaseIncludesPpnChip: "Dengan Pajak",
      purchaseNoPpnChip: "Tanpa Pajak",
      purchaseIncludedTaxKind: "Pajak Apa Yang Termasuk",
      purchaseIncludedTaxKindHint:
        "Pilih pajak yang tercetak pada tagihan pemasok ini.",
      purchaseIncludedTaxKindPlaceholder: "Pilih Pajak",
      purchaseIncludedTaxKindRequired: "Pilih jenis pajak pada tagihan ini.",
      purchasePphRate: "Tarif Pajak Penghasilan",
      purchasePphRatePlaceholder: "mis. 2",
      purchasePphRateRequired:
        "Masukkan persentase tarif pajak penghasilan untuk pembelian ini.",
      purchasePphRateHint:
        "Tarif biasa Pasal 23 adalah 2%. Ubah jika tagihan ini memakai tarif lain.",
      purchasePpnRate: "Tarif Pajak Pertambahan Nilai",
      purchasePpnRatePlaceholder: "mis. 12",
      purchasePpnRateRequired: "Masukkan persentase tarif pajak untuk pembelian ini.",
      outputPpnRateHint:
        "Tarif PPN Keluaran untuk invoice ini. Dapat diubah — tidak dikunci 11%. Default mengikuti tarif produk saat ini.",
      purchasePpnRateHint:
        "Nilai bawaan 11%. Ubah jika faktur memakai tarif pajak yang berbeda.",
      purchaseVatPreview:
        "Jumlah dibayar {dpp} + kredit pajak {tax} = harga satuan termasuk pajak {gross}.",
      purchaseVatSplitMismatch:
        "Jumlah dibayar ditambah kredit pajak harus sama dengan harga satuan termasuk pajak.",
      purchaseBankAccount: "Dibayar Dari Bank",
      purchaseBankAccountHint:
        "Rekening bank perusahaan yang dipakai untuk membayar pengeluaran ini.",
      purchaseBankAccountRequired:
        "Pilih bank perusahaan tempat pengeluaran ini dibayar.",
      purchaseDocument: "Invoice",
      purchaseChooseDocument: "Pilih file faktur pembelian.",
      purchaseUploadConfirm: "Simpan Pengeluaran",
      purchaseUploading: "Menyimpan…",
      purchaseUploadFailed: "Gagal menyimpan pembelian.",
      purchaseUploaded: "Ditambah",
      purchaseUploadedBy: "Ditambah oleh {name}",
      purchaseViewFile: "Lihat",
      purchaseInvoice: "Faktur pembelian",
      purchaseTaxInvoice: "Faktur Pajak",
      purchaseTaxInvoiceOptional: "Faktur Pajak (opsional)",
      purchaseTaxInvoiceHint:
        "Opsional faktur pajak untuk PPN masukan. Anda juga bisa melampirkannya nanti dari kartu pembelian.",
      purchaseChooseTaxInvoice: "Pilih file faktur pajak.",
      purchaseUploadTaxInvoice: "Unggah",
      purchaseUploadTaxInvoiceAction: "Unggah Faktur Pajak",
      purchaseUploadTaxInvoiceTitle: "Unggah Faktur Pajak",
      purchaseUploadTaxInvoiceDesc:
        "Lampirkan faktur pajak (PPN masukan) untuk pembelian ini.",
      purchaseUploadTaxInvoiceConfirm: "Simpan Faktur Pajak",
      purchaseUploadTaxInvoiceFailed: "Gagal mengunggah Faktur Pajak.",
      purchaseNoTaxInvoice: "—",
      purchaseMarkPaid: "Tandai Lunas",
      purchaseMarkPaidTitle: "Tandai Pembelian Lunas",
      purchaseMarkPaidDesc:
        "Unggah bukti pembayaran untuk mencatat kapan tagihan pemasok ini dilunasi dan menutup AP.",
      purchaseMarkPaidHint:
        "Lampirkan bukti transfer atau konfirmasi pembayaran. Ini menutup utang.",
      purchaseMarkPaidImportDesc:
        "Isi Kurs Bank dan biaya bank untuk transfer ini. Biaya gudang tetap pada Kurs Pencatatan. Jika Kurs Bank berbeda, Head Office mencatat selisih kurs.",
      purchaseMarkPaidBankRate: "Kurs Bank",
      purchaseMarkPaidBankRateHint:
        "Kurs bank pada transfer ini. Ini jumlah Rupiah yang Anda bayar. Bukan Kurs Pajak, dan tidak mengubah CIF atau biaya gudang.",
      purchaseMarkPaidBankRateRequired: "Masukkan Kurs Bank untuk pembayaran ini.",
      purchaseMarkPaidBookingRateShown:
        "Kurs Pencatatan adalah {rate}. Isi Kurs Bank pada transfer ini. Selisihnya dicatat ke Head Office.",
      purchaseMarkPaidImportHint:
        "Faktur pabrik {amount}. Isi Kurs Bank pada transfer ini. Biaya gudang tetap pada Kurs Pencatatan. Kurs Pajak tidak dipakai di sini.",
      purchaseMarkPaidBankCharge: "Biaya Bank",
      purchaseMarkPaidBankChargeHint:
        "Biaya SWIFT atau kabel pada transfer ini, dalam mata uang faktur pabrik.",
      purchaseMarkPaidTelexFee: "Biaya Telex",
      purchaseMarkPaidTelexFeeHint: "Biaya telex bank lokal untuk transfer ini, dalam Rupiah.",
      purchaseMarkPaidConfirm: "Konfirmasi Lunas",
      purchaseMarkPaidPending: "Mencatat…",
      purchaseMarkPaidFailed: "Gagal menandai pembelian sebagai lunas.",
      purchaseMarkPaidInvoiceRequired: "Faktur pembelian wajib diisi.",
      purchaseMarkPaidNotFound: "Faktur pembelian tidak ditemukan.",
      purchaseMarkPaidAlreadyPaid: "Pembelian ini sudah ditandai lunas.",
      purchasePaidAt: "Dibayar Pada",
      openInProgress: "Buka yang Berjalan",
      searchClients: "Cari klien…",
      searchProjects: "Cari proyek…",
      awaitingOrLate: "Menunggu pembayaran atau terlambat",
      noTaxPending: "Tidak ada Faktur Pajak menunggu",
      noTaxPendingDesc:
        "Saat Anda menerbitkan invoice untuk proyek bertanda dengan pajak, item muncul di sini hingga Faktur Pajak ditandai terkirim.",
      noTaxCompleted: "Tidak ada item selesai",
      noTaxCompletedDesc: "Faktur Pajak yang sudah dikirim akan muncul di sini.",
      taxInvoiceDue: "Faktur Pajak Jatuh Tempo",
      taxInvoiceSent: "Faktur Pajak Terkirim",
      markTaxDone: "Unggah Faktur Pajak",
      submitPayment: "Kirim pembayaran",
      rejectPayment: "Tolak bukti pembayaran",
      rejectPaymentConfirm:
        "Tolak bukti pembayaran ini? Invoice kembali ke Menunggu Pembayaran dan file unggahan dihapus.",
      noInvoicePeriods:
        "Belum ada periode invoice. Periode dibuka dari tanggal mulai kontrak nyata (Pindah ke Berjalan), atau saat Anda membuka halaman ini.",
      columns: {
        client: "Klien",
        project: "Proyek",
        period: "Periode",
        amount: "Jumlah",
        due: "Jatuh tempo",
        status: "Status"
      },
      filterSubcategory: "Filter berdasarkan subkategori",
      overdueCount: "{count} terlambat",
      unpaidCount: "{count} belum dibayar",
      allSettled: "Semua lunas",
      paidInvoiceOne: "{count} invoice lunas",
      paidInvoiceOther: "{count} invoice lunas",
      noPaidInvoices: "Belum ada invoice lunas",
      openCount: "{count} terbuka",
      lateCount: "{count} terlambat",
      issued: "Diterbitkan",
      completed: "Selesai",
      invoice: "Invoice",
      clients: "Klien",
      projects: "Proyek",
      projectOne: "{count} proyek",
      projectOther: "{count} proyek",
      billing: "Penagihan",
      lateInvoices: "Invoice terlambat",
      openInvoices: "Invoice terbuka",
      totalClients: "Total klien",
      emptyClients: "Tidak ada klien penagihan",
      emptyClientsDesc:
        "Klien dengan proyek muncul di sini untuk pelacakan invoice.",
      emptySearchClients: 'Tidak ada hasil untuk "{query}"',
      emptyProjects: "Tidak ada proyek untuk klien ini",
      emptyProjectsDesc: "Proyek aktif klien ini muncul di sini.",
      markTaxSentFailed: "Gagal menandai Faktur Pajak Terkirim.",
      billingPeriod: "Periode penagihan",
      paymentReceived1: "Pembayaran",
      paymentReceived2: "Diterima",
      paymentReceivedDialogTitle: "Catat pembayaran diterima",
      paymentReceivedDialogDesc:
        "Unggah bukti pembayaran, lalu konfirmasi. Membersihkan invoice jatuh tempo; proyek tetap aktif untuk bulan berikutnya.",
      paymentReceivedDialogDescHistory:
        "Unggah bukti pembayaran, lalu konfirmasi. Saat semua invoice lunas, proyek pindah ke Selesai.",
      taxInvoiceSentDialogTitle: "Unggah Faktur Pajak",
      taxInvoiceSentDialogDesc:
        "Unggah faktur pajak, lalu konfirmasi. Dapat dilakukan sebelum atau sesudah pembayaran dicatat.",
      documentVerifyContext: "Untuk",
      proofOfPayment: "Bukti pembayaran",
      taxInvoiceDocument: "Faktur pajak",
      chooseTaxInvoiceDocument:
        "Pilih gambar atau PDF faktur pajak.",
      paymentVerifyHint:
        "Dokumen tetap di server ini. Head Office mengonfirmasi di sini dengan alasan.",
      taxInvoiceVerifyHint:
        "Dokumen tetap di server ini. Head Office mengonfirmasi faktur pajak di sini dengan alasan.",
      purchaseTaxInvoiceVerifyHint:
        "Dokumen tetap di server ini. Head Office mengonfirmasi faktur pajak pemasok di sini dengan alasan.",
      inHouseVerifyReason: "Alasan Konfirmasi",
      inHouseVerifyReasonPlaceholder:
        "Mengapa dokumen ini diterima (wajib).",
      inHouseVerifyBanner:
        "File tetap di server Relasi Global Solusi. Head Office mengonfirmasi di aplikasi ini.",
      inHouseVerifyTitle: "Konfirmasi Pembayaran Internal",
      inHouseVerifyDesc:
        "Tinjau bukti yang diunggah di server ini, lalu konfirmasi dengan alasan.",
      inHouseVerifyConfirm: "Konfirmasi Dan Tandai Lunas",
      inHouseReasonRequired: "Isi alasan konfirmasi.",
      paymentVerifyChecking: "Menyimpan…",
      confirmTaxInvoiceSent: "Unggah Faktur Pajak",
      confirmPaymentReceived: "Konfirmasi pembayaran diterima",
      viewTaxInvoice: "Lihat faktur pajak",
      stillInPlanning: "Masih dalam Perencanaan",
      moveToInProgress: "Pindah ke Berjalan",
      pending: "Menunggu",
      completedTab: "Selesai",
      noClient: "Tanpa klien",
      invoiceDownloadDesc:
        "Unduh invoice dan unggah bukti pembayaran untuk proyek ini.",
      paidInvoiceCannotDelete: "Periode invoice yang sudah lunas tidak dapat dihapus.",
      deleteIssuedInvoiceConfirm:
        "Hapus “{label}”? Ini menghapus invoice yang diterbitkan, PDF, dan bukti pembayaran. Tindakan ini tidak dapat dibatalkan.",
      deletePeriodConfirm:
        "Hapus “{label}”? Tindakan ini tidak dapat dibatalkan.",
      thisBillingPeriod: "periode penagihan ini",
      paymentProofImageOrPdf: "Bukti pembayaran harus gambar atau PDF.",
      choosePaymentProof: "Pilih gambar atau PDF sebagai bukti pembayaran.",
      amountExample: "mis. 1500000",
      amountExampleLarge: "mis. 50000000",
      cyclesReadyTitle:
        "{count} siklus rutin perlu direkonsiliasi sebelum penagihan",
      cyclesReadyDesc: "",
      taxStillNeedTitle:
        "{count} Faktur Pajak masih perlu dibuat",
      taxStillNeedDesc:
        "Invoice komersial untuk proyek dengan pajak menunggu di daftar periksa Faktur Pajak.",
      openTaxChecklist: "Buka daftar periksa Faktur Pajak",
      invoiceCountAwaiting:
        "{count} invoice menunggu Faktur Pajak",
      invoiceCountAcknowledged: "{count} invoice sudah diakui",
      issuedOn: "Diterbitkan {date}",
      sentOn: "Dikirim {date}",
      projectDetails: "Detail proyek",
      planningInvoicingHint:
        "Penagihan tersedia setelah proyek ini dipindah ke Berjalan.",
      planningUnlockDesc:
        "Proyek ini masih dalam Perencanaan. Gunakan {action} di halaman proyek saat work order siap — penagihan dan invoice terbuka setelah itu.",
      paymentHistoryDesc:
        "Riwayat pembayaran, jatuh tempo, dan aksi invoice untuk proyek ini.",
      parking: {
        workspaceHint:
          "Masukkan pendapatan parking aktual per bulan. Syarat deal tetap; laba bersih = pendapatan dikurangi semua pengeluaran bulan itu.",
        monthTitle: "Bulan Parking",
        monthDesc: "Pilih bulan untuk mencatat pendapatan dan meninjau pengeluaran.",
        dealReadOnly: "Syarat deal tetap selama kontrak.",
        revenueTitle: "Pendapatan Bulanan",
        casualRevenueDesc:
          "Masukkan parkir kasual (lalu lintas biasa) saja. Parkir member adalah biaya bulanan tetap dan tidak dikenai pajak.",
        casualRevenue: "Parkir Kasual",
        memberRevenue: "Parkir Member",
        casualTax: "Pajak Parkir Kasual",
        notes: "Catatan",
        saveRevenue: "Simpan Pendapatan",
        saving: "Menyimpan…",
        saveFailed: "Gagal menyimpan pendapatan parking.",
        outflowsTitle: "Pengeluaran",
        outflowsDesc:
          "Sewa, bagi hasil, setup (sekali), pembelian proyek, dan upah staf yang ditugaskan.",
        noOutflows: "Belum ada pengeluaran untuk bulan ini.",
        revenue: "Pendapatan",
        moneyOut: "Beban",
        netProfit: "Laba Bersih",
        unavailable: "Workspace parking tidak tersedia untuk proyek ini."
      },
      payrollMgmt: {
        workspaceHint:
          "Ini staf Relasi Global Solusi di pekerjaan ini. Mereka check-in. Isi dari check-in, lalu terapkan potongan dari klien. Tidak perlu laporan progres. Lalu kirim persetujuan klien dan invoice.",
        periodTitle: "Periode Payroll",
        periodDesc: "Memakai hari cutoff klien ini, bukan Penggajian Internal.",
        feeHint:
          "Biaya manajemen {percent}% · pajak pada biaya {tax}% · termin pembayaran klien {days} hari.",
        listTitle: "Daftar Gaji Karyawan",
        listDesc:
          "Isi dari check-in pekerjaan ini, lalu tambah potongan klien sebelum generate.",
        cutoffRange: "Cutoff: {range}",
        reviewTitle: "Hari Dalam Periode Ini",
        reviewDesc:
          "Tinjau hari check-in setiap karyawan yang ditugaskan sebelum generate. Terapkan potongan klien pada daftar gaji di bawah.",
        reviewEmpty: "Belum ada staf Relasi Global Solusi yang ditugaskan ke pekerjaan ini.",
        generatePdf: "Buat PDF",
        pdfTitle: "Manajemen Payroll",
        clientAdjustment: "Potongan Klien",
        unlockFailed: "Tidak dapat membuka periode ini.",
        fillFromCico: "Isi Dari Check-In",
        addLine: "Tambah Karyawan",
        employeeName: "Nama Karyawan",
        amount: "Jumlah",
        accountNumber: "Nomor Rekening",
        lineNotes: "Catatan",
        wagesTotal: "Total Upah (Biaya)",
        feeAmount: "Biaya Manajemen ({percent}%)",
        taxAmount: "Pajak Pada Biaya ({percent}%)",
        clientBill: "Tagihan Klien",
        saveList: "Simpan Daftar",
        saving: "Menyimpan…",
        saveFailed: "Gagal menyimpan daftar gaji.",
        actionFailed: "Tidak dapat memperbarui periode payroll ini.",
        confirmWagesPaid: "Konfirmasi Upah Dibayar",
        confirmWagesPaidDesc:
          "Setelah klien menyetujui, Head Office dapat mengonfirmasi upah sudah dibayar. Unggah bukti pembayaran. Ini tidak menahan Payment Due.",
        wagesPaidProof: "Bukti Pembayaran Upah",
        wagesPaidOn: "Upah dikonfirmasi {date}",
        viewProof: "Lihat Bukti Pembayaran",
        unavailable: "Workspace Manajemen Payroll tidak tersedia untuk proyek ini.",
        status: {
          DRAFT: "Draf",
          WAGES_ENTERED: "Upah Diisi",
          AWAITING_CLIENT: "Menunggu Klien",
          CLIENT_APPROVED: "Disetujui Klien",
          WAGES_PAID: "Upah Dibayar",
          INVOICED: "Ditagih",
          REIMBURSED: "Dikembalikan"
        }
      },
      billingMode: "Mode penagihan",
      billingPeriodBasis: "Periode Penagihan",
      anniversaryInvoiceDay: "Hari invoice ulang tahun: {day}",
      calendarMonthInvoiceDay: "Penagihan bulan kalender",
      customPeriodCycle: " · Hari {from} – Hari {to}",
      priorPeriodOpenWarn:
        "“{next}” sudah dibuka sementara “{open}” belum selesai. Ingatkan klien sebelum tunggakan bertambah.",
      keepAmount: "Pertahankan Jumlah",
      adjustAmount: "Sesuaikan Jumlah",
      adjustAmountLabel: "Jumlah Invoice Disesuaikan",
      adjustAmountInvalid: "Masukkan jumlah invoice yang disesuaikan dengan benar.",
      reconcileAmountHelp:
        "Pertahankan harga kontrak, atau sesuaikan jumlah invoice untuk periode ini (persetujuan Operations Manager atau Area Manager diperlukan untuk menyesuaikan).",
      confirmReconcileKeep: "Rekonsiliasi & Kirim",
      confirmReconcileAdjust: "Sesuaikan & Kirim",
      reconcileDialogTitle: "Rekonsiliasi Periode",
      cycleFrom: " · siklus dari {date}",
      contractPrice: "Harga kontrak",
      savedPrice: "Tersimpan: {price}",
      contractPriceMonthlyHint:
        "Dipakai sebagai jumlah invoice saat mengompilasi periode (kecuali periode sudah punya jumlah sendiri).",
      contractPriceMilestoneHint:
        "Mengubah harga kontrak menghitung ulang invoice bertahap yang belum dibayar dari sisa kewajiban (jumlah yang sudah dibayar tetap). PDF yang sudah diterbitkan mungkin perlu dibuat ulang.",
      periods: "Periode",
      invoicedThrough: "Sudah ditagih hingga {percent}%",
      setPriceBeforeMilestone:
        "Tetapkan harga kontrak di atas sebelum menagih bertahap.",
      setPriceBeforeCompile:
        "Tetapkan harga kontrak di atas agar invoice hasil kompilasi menampilkan jumlah nyata, bukan “Sesuai kesepakatan / akan dikonfirmasi”.",
      cyclesReadyOnProject:
        "{count} siklus kontrak siap setelah periode berakhir. Rekonsiliasi terlebih dahulu, lalu kirim invoice pada baris di bawah.",
      nextMilestone: "Bertahap pembayaran berikutnya",
      nextMilestoneDesc:
        "Jadwal ditetapkan saat proyek dibuat. Kirim paket progress untuk Approve/Revise klien saat pekerjaan siap — invoice diterbitkan setelah disetujui.",
      invoicing: "Sedang menagih...",
      invoiceMilestone1: "Kirim untuk",
      invoiceMilestone2: "Review",
      createProgressInvoice: "Kirim progres untuk review",
      createProgressInvoiceDesc:
        "Proyek ini belum punya jadwal pembayaran tersimpan. Pilih % progres kumulatif untuk mengirim paket progress agar klien Approve atau Revise. Proyek berpindah ke Menunggu Persetujuan sampai kedua pihak setuju; invoice diterbitkan setelah disetujui.",
      monthlyBillingHelp:
        "Penagihan mengikuti tanggal mulai kontrak (siklus ulang tahun). Setelah siklus berakhir, Rekonsiliasi menyusun CICO staf menjadi laporan untuk portal klien (Approve atau Revise). Persetujuan klien otomatis menerbitkan invoice dan mengirim email ke kontak klien. Jatuh tempo memakai syarat pembayaran klien (Tunai = jatuh tempo saat dikirim). Proyek tetap aktif untuk siklus berikutnya.",
      noMilestonePeriods:
        "Belum ada periode bertahap. Proyek Pembersihan General, Pembersihan Fasad, dan Lanskap Satu Kali membuat jadwal pembayaran lengkap saat dibuat.",
      reportCountOne: "{count} laporan",
      reportCountOther: "{count} laporan",
      percentOfProject: " · {percent}% dari proyek",
      fromContractPrice: "dari harga kontrak",
      nothingLeftAfterRevision: "Tidak ada sisa setelah revisi kontrak",
      pdfMayShowPrevious: "PDF mungkin menampilkan jumlah sebelumnya",
      daysSinceInvoicedOne: "{count} hari sejak ditagih",
      daysSinceInvoicedOther: "{count} hari sejak ditagih",
      daysOverdueOne: "{count} hari terlambat",
      daysOverdueOther: "{count} hari terlambat",
      paidOn: "Lunas {date}",
      proofUploadedOn: "Bukti diunggah {date}",
      downloadPdf: "PDF",
      viewProof: "Lihat bukti",
      awaitingVerification: "Menunggu verifikasi",
      reconcile: "Rekonsiliasi",
      reconciling: "Sedang merekonsiliasi…",
      retryCompile1: "Coba",
      retryCompile2: "Kompilasi",
      confirmReconcilePeriod:
        "Rekonsiliasi “{label}” dan kirim laporan CICO ke klien untuk Approve atau Revise?",
      saveContractPriceFailed: "Gagal menyimpan harga kontrak.",
      sendMilestoneForReviewFailed: "Gagal mengirim bertahap untuk review.",
      deletePeriodFailed: "Gagal menghapus periode penagihan.",
      submitPaymentFailed: "Gagal mengirim pembayaran untuk verifikasi.",
      rejectPaymentFailed: "Gagal menolak bukti pembayaran.",
      compileInvoiceFailed: "Gagal mengompilasi invoice.",
      mutualApprovalBeforeInvoice:
        "Kirim periode penagihan ini untuk review klien dan HO (rekonsiliasi atau Ajukan Persetujuan) sebelum menerbitkan invoice.",
      reviewPendingBeforeInvoice:
        "Tunggu klien dan HO menyetujui laporan rekonsiliasi atau progress sebelum menerbitkan invoice.",
      reconcilePeriodFailed: "Gagal merekonsiliasi periode penagihan.",
      recordPaymentFailed: "Gagal mencatat pembayaran diterima.",
      reorderClientsFailed: "Gagal mengubah urutan klien.",
      filterResults: "{count} hasil",
      filterResultsIn: "{count} hasil di {type}",
      filterResultsFor: '{count} hasil untuk "{query}"',
      filterResultsInFor: '{count} hasil di {type} untuk "{query}"',
      breadcrumbAria: "Breadcrumb"
    },
    vat: {
      period: "Periode",
      rateHint:
        "DPP dan PPN dihitung dari jumlah termasuk pajak pada {rate}% sampai nilai faktur disimpan.",
      outputTotal: "PPN Keluaran",
      outputTotalHint: "PPN Keluaran untuk periode ini",
      inputTotal: "PPN Masukan",
      inputTotalHint: "PPN Masukan untuk periode ini",
      netPayable: "PPN Neto",
      netPayableHint: "PPN Masukan − PPN Keluaran. Plus adalah kredit. Minus adalah yang harus dibayar.",
      vatPaid: "PPN Dibayar",
      vatPaidHint: "Pembayaran ID Billing pemerintah bulan ini",
      vatRemaining: "PPN Masih Harus Dibayar",
      vatRemainingHint: "Sisa yang masih harus dibayar setelah pembayaran ID Billing",
      tabs: {
        output: "PPN Keluaran",
        input: "PPN Masukan",
        income: "Pajak Penghasilan",
        other: "Pajak Lain"
      },
      inputSourceImport: "Barang Impor",
      inputSourceItems: "Barang",
      inputSourceService: "Jasa",
      inputSourceVehicle: "Kendaraan",
      inputSourceHandling: "Biaya Handling",
      pendingCount: "{count} Menunggu",
      outputTitle: "PPN Keluaran",
      outputDesc:
        "Periode invoice klien yang membutuhkan faktur pajak pada bulan ini.",
      inputTitle: "PPN Masukan",
      inputDesc:
        "PPN Masukan bulan ini, menurut sumber: barang, barang impor, dan biaya handling. PPN impor dikreditkan dari pembayaran Bea Cukai. PPN handling dikreditkan dari faktur pajak handler.",
      otherTitle: "Pajak Lain",
      otherDesc:
        "PPh yang kami potong dan setor (Pasal 21 dan Pasal 23), PPh Final Pasal 4(2), bea meterai, dan pajak pemerintah lain. Potongan bukan kredit pajak perusahaan.",
      emptyOther: "Tidak Ada Pajak Lain",
      emptyOtherDesc:
        "Tidak ada potongan, PPh Final, atau bea meterai pada bulan ini.",
      otherRemittanceTotal: "Potongan Disetor",
      otherRemittanceTotalHint: "Pasal 21 dan Pasal 23 yang dibayar bulan ini",
      otherExpenseTotal: "Beban Pajak Lain",
      otherExpenseTotalHint: "Pasal 4(2), bea meterai, dan pajak lain bulan ini",
      incomeTitle: "PPh Badan Dibayar Di Muka",
      incomeDesc:
        "PPh Pasal 22 impor serta PPh Pasal 25 / 29 yang dibayar dengan ID Billing. Jumlah ini mengurangi PPh Badan pada SPT Tahunan.",
      incomeHint:
        "Contoh: jika PPh Badan setahun 100 juta dan kredit ini 90 juta, yang dibayar 10 juta.",
      incomeImportTotal: "PPh Pasal 22 Impor",
      incomeImportTotalHint: "Pajak dibayar di muka saat impor tahun ini",
      incomeInstallmentTotal: "Angsuran Dan Setoran Akhir",
      incomeInstallmentTotalHint: "Angsuran Pasal 25 dan setoran akhir Pasal 29",
      incomeCreditTotal: "Kredit Pajak Tersedia",
      incomeCreditTotalHint: "Total PPh Badan dibayar di muka tahun ini",
      emptyIncome: "Tidak Ada Kredit PPh",
      emptyIncomeDesc:
        "Tidak ada PPh Pasal 22 impor atau pembayaran PPh Badan pemerintah pada tahun ini.",
      incomeSourceImport: "Impor",
      incomeSourceGovernment: "ID Billing Pemerintah",
      openTaxInvoices: "Buka Faktur Pajak",
      openPurchases: "Buka Pembelian",
      taxDetail: "Rincian Pajak",
      backToTax: "Kembali Ke Pajak",
      relatedExpense: "Pengeluaran Ini",
      relatedBilling: "Penagihan Proyek",
      taxDocuments: "Dokumen Pajak",
      taxDocumentMissing: "Faktur pajak belum diunggah.",
      fakturReady: "Terunggah",
      fakturPending: "Menunggu",
      emptyOutput: "Tidak Ada PPN Keluaran",
      emptyOutputDesc:
        "Tidak ada periode faktur pajak klien pada bulan ini.",
      emptyInput: "Tidak Ada PPN Masukan",
      emptyInputDesc:
        "Tidak ada pembelian pemasok dengan PPN pada bulan ini.",
      invoicePeriodFallback: "Periode Invoice",
      columns: {
        client: "Klien",
        vendor: "Pemasok",
        date: "Tanggal",
        gross: "Gross",
        dpp: "DPP",
        ppn: "PPN",
        faktur: "Faktur",
        source: "Sumber",
        credit: "Pajak Dibayar Di Muka",
        amount: "Jumlah"
      }
    },
    sales: {
      title: "Penjualan",
      description:
        "Buat faktur penjualan di sini. PDF dibuat otomatis. Unggah faktur pajak untuk pembeli perusahaan jika diperlukan.",
      permissionDenied: "Anda tidak punya izin untuk mencatat penjualan.",
      loadFailed: "Tidak dapat memuat penjualan.",
      period: "Periode Penjualan",
      salesReportDownload: "Unduh Laporan Penjualan",
      salesReportTitle: "Laporan Penjualan",
      salesReportHint: "Penjualan menurut tanggal jual untuk periode yang dipilih.",
      salesReportDate: "Tanggal Jual",
      salesReportItem: "Item",
      salesReportBuyer: "Pembeli",
      salesReportAmount: "Jumlah",
      salesReportTotal: "Total",
      salesReportEmpty: "Tidak ada penjualan pada periode ini.",
      salesReportPeriodMonth: "{month} {year}",
      salesReportPeriodDay: "{day} {month} {year}",
      salesReportPeriodYear: "{year}",
      totalSales: "Total Penjualan",
      totalProfit: "Total Laba",
      totalCost: "Dasar Biaya",
      vatCollected: "PPN Dipungut",
      saleCount: "{count} Penjualan",
      saleCountOne: "1 Penjualan",
      thisYear: "Tahun ini {amount}",
      searchPlaceholder:
        "Cari penjualan: item, SKU, pembeli, catatan…",
      addSale: "Buat Faktur Penjualan",
      bankAccount: "Rekening Bank",
      bankAccountEmpty: "Tambah rekening bank di Detail Perusahaan terlebih dahulu.",
      bankAccountRequired: "Pilih rekening bank untuk invoice penjualan ini.",
      invoiceAutoHint:
        "PDF faktur penjualan dibuat otomatis dari Detail Perusahaan dan rekening bank ini. Anda tidak mengunggah faktur penjualan.",
      invoiceGenerateFailed: "Tidak dapat membuat PDF faktur penjualan.",
      generateInvoice: "Buat Faktur",
      viewPaymentProof: "Lihat Pembayaran",
      paidOn: "Dibayar {date}",
      attachMissing: "Lampirkan dokumen yang belum ada",
      hideAttach: "Sembunyikan lampiran",
      attachRequired: "Unggah bukti pembayaran atau faktur pajak, atau buat faktur penjualan.",
      attachSaved: "Dokumen penjualan disimpan.",
      attachFailed: "Tidak dapat menyimpan dokumen penjualan.",
      saveDocuments: "Simpan Dokumen",
      columns: {
        documents: "Dokumen"
      },
      docInvoiceReady: "Faktur",
      docInvoiceMissing: "Faktur belum ada",
      docPaymentReady: "Pembayaran",
      docPaymentMissing: "Menunggu Pembayaran",
      docTaxReady: "Faktur Pajak",
      docTaxMissing: "Faktur Pajak belum ada",
      form: {
        paymentProof: "Bukti Pembayaran Pelanggan",
        paymentProofHint:
          "Opsional. Unggah bukti transfer nanti jika pembayaran belum masuk.",
        paidAt: "Tanggal Pembayaran",
        paidAtHint:
          "Opsional. Default-nya tanggal penjualan saat bukti pembayaran diunggah."
      }
    },
    financialReport: {
      title: "Laporan Keuangan",
      description:
        "Pilih tahun, bulan atau setahun penuh, lalu General atau satu klien.",
      filterYear: "Tahun",
      filterPeriod: "Periode",
      filterPeriodYearly: "Setahun Penuh",
      filterReport: "Laporan",
      filterReportGeneral: "General",
      filterBank: "Rekening Bank",
      filterBankAll: "Semua Bank",
      filterBankUnassigned: "Belum Ditentukan",
      rangeHint:
        "Pendapatan memakai periode kalender. Upah memakai jendela 16–15 untuk bulan atau tahun yang sama. Tagihan pemasok yang belum dibayar adalah Utang Usaha, bukan beban.",
      periodNet: "Laba Periode",
      netPosition: "Posisi Bersih",
      netPositionHint:
        "Laba periode dikurangi Utang Usaha. Penarikan pinjaman tetap di halaman Pinjaman. Itu pendanaan, bukan pendapatan.",
      loanInterestDueThisPeriod: "Bunga Pinjaman Dibayar",
      loanInterestDueThisPeriodHint:
        "Bunga yang Anda catat di Pinjaman pada periode ini. Itu beban. Penarikan tetap di halaman Pinjaman.",
      clientsStillOwe: "Piutang Usaha",
      weStillOweVendors: "Utang Usaha",
      bpjsKesehatan: "BPJS Kesehatan",
      bpjsKetenagakerjaan: "BPJS Ketenagakerjaan",
      bpjsEmployeeCount: "{count} karyawan terdaftar",
      bpjsEmployeesTitle: "Karyawan Terdaftar",
      bpjsEmployeeDetailTitle: "Iuran Karyawan",
      bpjsNoEmployees: "Tidak ada karyawan penuh waktu aktif yang terdaftar di program ini.",
      bpjsTenure: "Masa Kerja",
      bpjsHiredAt: "Bergabung",
      bpjsBasePay: "Gaji Pokok",
      bpjsCompanyShare: "Tanggungan Perusahaan",
      bpjsEmployeeShare: "Potongan Karyawan",
      bpjsLineKesehatan: "BPJS Kesehatan",
      bpjsLineJht: "JHT",
      bpjsLineJp: "JP",
      bpjsLineJkk: "JKK",
      bpjsLineJkm: "JKM",
      bpjsWageBase: "Dasar Upah",
      accountsReceivableHint:
        "Invoice yang sudah dikirim dan belum dibayar klien. Jatuh tempo {overdue}.",
      accountsPayableHint:
        "Tagihan pemasok yang belum dibayar. Bukan laba. Jatuh tempo {overdue}.",
      net: "Laba Bersih Kumulatif",
      companyMoneyInHint:
        "Jumlah rekonsiliasi yang disetujui atau invoice, pajak dikeluarkan dengan membagi, plus deposit karyawan yang hangus. Deposit ditahan bukan pendapatan.",
      companyMoneyOutHint:
        "Stok terpakai di pekerjaan, tagihan pemasok saat dibayar, Penggajian Internal, pengeluaran parkir, overhead Head Office, dan deposit karyawan yang dikembalikan.",
      stockInWarehouse: "Nilai Persediaan",
      stockInWarehouseHint: "Nilai barang yang masih di gudang. Belum dibebankan ke pekerjaan.",
      headOfficeOverhead: "Overhead Head Office",
      headOfficeOverheadPeriodHint:
        "Gaji gudang, pembelian Internal yang dibayar periode ini, stok terpakai di Head Office atau Gudang Internal, dan selisih kurs impor.",
      importRateDifference: "Selisih Kurs Untuk Biaya Gudang Impor",
      importRateDifferenceHint:
        "Dicatat ke Head Office saat Kurs Bank pada pembayaran berbeda dari Kurs Pencatatan. Biaya gudang dan proyek tidak berubah.",
      importRateDifferenceExpenseLine: "Beban {amount}",
      importRateDifferenceIncomeLine: "Pendapatan {amount}",
      depositsHeld: "Deposit Karyawan Ditahan",
      depositsHeldHint:
        "Saldo yang ditahan. Bukan pendapatan dan bukan Utang Usaha. Tidak termasuk dalam laba periode.",
      depositsReturned: "Deposit Karyawan Dikembalikan",
      depositsReturnedHint:
        "Pengeluaran saat deposit ditahan dikembalikan di Penggajian Internal (proyek terakhir atau saat ini, atau Head Office).",
      depositsKept: "Deposit Karyawan Hangus",
      depositsKeptHint:
        "Pendapatan Head Office saat resign tidak sesuai prosedur.",
      jobHistoryTitle: "Klien Dan Pekerjaan",
      jobHistoryDesc:
        "Buka pekerjaan apa pun, termasuk yang sudah selesai. Total bulanan perusahaan tetap menghitung uang bertanggal bulan ini.",
      sameDaySplitNote:
        "Bekerja di {count} lokasi hari ini — gaji harian dibagi merata.",
      doubleShiftNote: "Shift ganda — dua tarif harian untuk hari ini.",
      totalClients: "Total Klien",
      withProjects: "Dengan Proyek",
      totalContractValue: "Total Nilai Kontrak",
      acrossClients: "Lintas Klien",
      totalProfit: "Total Laba",
      detail: {
        periodNet: "Rincian Laba Periode",
        netPosition: "Rincian Posisi Bersih",
        moneyIn: "Rincian Pendapatan",
        moneyOut: "Rincian Beban",
        ar: "Rincian Piutang Usaha",
        ap: "Rincian Utang Usaha",
        warehouse: "Rincian Nilai Persediaan",
        overhead: "Rincian Overhead Kantor Pusat",
        deposits: "Rincian Deposit Karyawan Ditahan",
        depositsReturned: "Rincian Deposit Karyawan Dikembalikan",
        depositsKept: "Rincian Deposit Karyawan Hangus",
        bpjsKesehatan: "Rincian BPJS Kesehatan",
        bpjsKetenagakerjaan: "Rincian BPJS Ketenagakerjaan",
        loanInterestDue: "Rincian Bunga Pinjaman Dibayar",
        loanInterestDueHelp:
          "Bunga yang Anda catat di Pinjaman pada periode ini. Setiap baris membuka fasilitas itu. Ini beban, bukan pendapatan proyek.",
        bpjsKesehatanHelp:
          "Perusahaan 4% dari upah yang dibatasi. Karyawan 1% sudah dipotong di Penggajian Internal. Kartu ini adalah jumlah yang masih terutang ke BPJS bulan ini.",
        bpjsKetenagakerjaanHelp:
          "Bagian perusahaan untuk JHT, JP, JKK, dan JKM. Bagian karyawan sudah dipotong di Penggajian Internal.",
        overheadWages: "Gaji Gudang",
        overheadPurchases: "Pembelian Internal",
        overheadStock: "Stok Internal Terpakai",
        overheadRateDifferenceExpense: "Beban Selisih Kurs Impor",
        overheadRateDifferenceIncome: "Pendapatan Selisih Kurs Impor",
        warehouseHelp:
          "Barang di gudang adalah aset, bukan beban, sampai dikeluarkan ke pekerjaan.",
        openInventory: "Buka Inventaris",
        moneyInHelp:
          "Pendapatan termasuk deposit karyawan yang hangus dan pendapatan Head Office saat Kurs Bank impor lebih rendah dari Kurs Pencatatan.",
        moneyOutHelp:
          "Beban termasuk overhead Head Office, deposit karyawan yang dikembalikan, dan beban Head Office saat Kurs Bank impor lebih tinggi dari Kurs Pencatatan.",
        overheadHelp:
          "Gaji Kantor Pusat, pembelian Internal yang dibayar periode ini, stok yang dipakai situs Internal, dan selisih kurs impor yang dicatat ke Head Office.",
        depositsHelp:
          "Deposit ditahan bukan pendapatan. Pengembalian adalah arus keluar. Deposit yang ditahan perusahaan adalah pendapatan Kantor Pusat.",
        depositsReturnedHelp:
          "Kas yang dibayar kembali di Penggajian Internal saat deposit keamanan dikembalikan.",
        depositsKeptHelp:
          "Pendapatan Head Office saat resign tidak sesuai prosedur dan deposit ditahan perusahaan.",
        netPositionHelp:
          "Laba periode dikurangi utang pemasok dan pinjaman yang masih terutang. Penarikan pinjaman bukan pendapatan. Piutang adalah yang masih terutang klien."
      },
      contractValueHint: "Jumlah harga kontrak proyek.",
      spendingHint:
        "Stok terpakai di pekerjaan, pembelian proyek, dan hari CICO Penggajian Internal di sini.",
      moneyIn: "Pendapatan",
      moneyInHint:
        "Jumlah rekonsiliasi yang disetujui, atau jumlah invoice, setelah pajak dikeluarkan dengan membagi.",
      moneyOut: "Beban",
      moneyOutHint:
        "Stok terpakai, pembelian proyek, dan Penggajian Internal yang dialokasikan ke pekerjaan ini.",
      moneyOutBreakdownTitle: "Rincian Beban",
      moneyOutBreakdownDesc:
        "Stok terpakai di pekerjaan ini plus Penggajian Internal (upah harian × hari CICO lengkap). Kerja multi-lokasi di hari yang sama membagi gaji harian merata.",
      inventoryOut: "Inventaris",
      wagesOut: "Gaji",
      moneyOutTotal: "Total Beban",
      profit: "Laba",
      profitHint: "Pendapatan − Beban",
      margin: "Margin",
      marginHint: "Laba ÷ Pendapatan",
      contractValue: "Nilai Kontrak",
      paymentsTitle: "Pembayaran Diterima",
      paymentsDesc:
        "Periode invoice berstatus Dibayar setelah konfirmasi pembayaran.",
      inventoryTitle: "Pengeluaran Inventaris",
      inventoryDesc: "Stok non-void yang dikeluarkan ke proyek ini.",
      wagesTitle: "Gaji Per Karyawan",
      wagesDesc:
        "Angka yang sama dengan Penggajian Internal: upah harian (gaji bulanan ÷ 26) × hari check-in dan check-out lengkap. Hari shift ganda dihitung dua hari dibayar. Jika seseorang bekerja di beberapa lokasi pada hari yang sama, gaji hari itu dibagi merata dan dicatat di baris.",
      emptyClients: "Belum Ada Klien",
      emptyClientsDesc:
        "Tambahkan klien dan proyek untuk melihat laporan keuangan.",
      emptyProjects: "Belum Ada Pekerjaan",
      emptyProjectsDesc:
        "Klien ini belum memiliki pekerjaan berjalan atau selesai untuk dilaporkan.",
      emptyPayments: "Belum Ada Pembayaran Terkonfirmasi",
      emptyPaymentsDesc:
        "Invoice yang dibayar untuk proyek ini akan muncul di sini setelah pembayaran dikonfirmasi.",
      emptyInventory: "Belum Ada Pengeluaran Inventaris",
      emptyInventoryDesc:
        "Stok yang dikeluarkan ke proyek ini akan muncul di sini sebagai uang keluar.",
      emptyWages: "Belum Ada Hari Dibayar",
      emptyWagesDesc:
        "Biaya gaji muncul di sini ketika ada check-in dan check-out lengkap di pekerjaan ini.",
      payRecoveryTitle: "Pay Recovery Lost Stock",
      payRecoveryDesc:
        "Biaya stok ada di Inventory Issues. Pay recovery adalah jumlah yang dipotong dari Penggajian Internal untuk lost stock di pekerjaan ini.",
      emptyPayRecovery: "Belum Ada Pay Recovery",
      emptyPayRecoveryDesc:
        "Potongan lost stock yang di-assign ke proyek ini muncul di sini.",
      payRecovery: "Pay Recovery",
      noClientsMatch: "Tidak ada klien yang cocok dengan pencarian Anda.",
      noProjectsMatch: "Tidak ada proyek yang cocok dengan filter Anda.",
      searchClients: "Cari Klien",
      searchProjects: "Cari Proyek",
      filterSubcategory: "Filter Berdasarkan Jenis",
      filterResults: "{count} hasil",
      filterResultsIn: "{count} hasil di {type}",
      filterResultsFor: '{count} hasil untuk "{query}"',
      filterResultsInFor: '{count} hasil di {type} untuk "{query}"',
      clientOne: "{count} klien",
      clientOther: "{count} klien",
      projectOne: "{count} proyek",
      projectOther: "{count} proyek",
      invoicePeriodFallback: "Periode Invoice",
      columns: {
        client: "Klien",
        project: "Proyek",
        contractValue: "Nilai Kontrak",
        spending: "Beban",
        moneyIn: "Pendapatan",
        receivable: "Piutang Usaha",
        profit: "Laba",
        period: "Periode",
        paidAt: "Dibayar Pada",
        amount: "Jumlah",
        item: "Item",
        issuedAt: "Dikeluarkan Pada",
        quantity: "Kuantitas",
        employee: "Karyawan",
        daysWorked: "Hari Kerja",
        dailyRate: "Upah Harian",
        wageCost: "Biaya Gaji"
      }
    },

    thr: {
      title: "THR",
      description:
        "Buat dan lacak pembayaran Tunjangan Hari Raya (Idul Fitri) dari gaji pokok karyawan.",
      directoryTitle: "Pembayaran THR",
      directoryDesc:
        "THR Lebaran memakai gaji pokok dan masa kerja. Layak mulai satu bulan penuh bekerja.",
      summaryTitle: "Pembuatan THR",
      summaryDesc:
        "Catatan dibuat otomatis saat halaman ini dibuka dalam {days} hari sebelum Idul Fitri. Generate manual hanya tersedia di dalam jendela itu.",
      targetYear: "Tahun Target",
      hariRayaDate: "Tanggal Hari Raya",
      totalAmount: "Total Jumlah",
      generateForYear: "Buat THR Untuk {year}",
      generating: "Membuat…",
      generateSuccess:
        "THR dibuat: {created} baru, {updated} diperbarui, {skipped} dilewati.",
      generateFailed: "Gagal membuat THR.",
      generateOutsideWindow:
        "THR hanya dapat dibuat dalam {days} hari sebelum Idul Fitri.",
      paymentsTitle: "Pembayaran Yang Dibuat",
      paymentsDesc: "Baris THR untuk {year}.",
      emptyTitle: "Belum Ada Pembayaran THR",
      emptyDesc:
        "Isi Gaji Pokok pada karyawan, lalu buat THR untuk tahun target.",
      columns: {
        employee: "Karyawan",
        tenure: "Masa Kerja",
        basePay: "Gaji Pokok",
        amount: "Jumlah THR",
        status: "Status",
        actions: "Tindakan"
      },
      tenureMonths: "{count} Bulan",
      statusDraft: "Draf",
      statusGenerated: "Dibuat",
      statusPaid: "Dibayar",
      markPaid: "Tandai Dibayar",
      markPaidFailed: "Gagal menandai THR sebagai dibayar."
    },
    loans: {
      title: "Pinjaman",
      description:
        "Buku manual. Catat uang yang diambil, bunga yang ditagih bank, dan pokok yang dikembalikan. Catatan itu terhubung ke Pengeluaran dan Laporan Keuangan. Penarikan adalah pendanaan, bukan pendapatan.",
      register: "Daftarkan Pinjaman",
      registerTitle: "Daftarkan Pinjaman",
      registerDesc:
        "Catat fasilitasnya dulu. Saat uang benar-benar masuk, catat penarikan agar laporan keuangan tahu dari mana kas itu berasal.",
      registerConfirm: "Simpan Pinjaman",
      saving: "Menyimpan…",
      failed: "Tidak dapat menyimpan pinjaman ini.",
      emptyTitle: "Belum Ada Pinjaman",
      emptyDesc:
        "Daftarkan fasilitas bank atau pinjaman pemegang saham, lalu catat penarikan dan pengembalian di sini.",
      name: "Nama Pinjaman",
      namePlaceholder: "mis. Pinjaman Standby BCA",
      source: "Sumber Pinjaman",
      lenderName: "Pemberi Pinjaman",
      lenderNameHint: "Bank atau pemegang saham tempat uang ini berasal.",
      startDate: "Tanggal Mulai",
      notes: "Catatan",
      notesPlaceholder: "Catatan opsional",
      recordInitialDraw: "Uang Sudah Diterima",
      recordInitialDrawHint:
        "Nyalakan jika bank atau pemegang saham sudah memasukkan uang ke rekening perusahaan.",
      hasMoneyBeenDrawn: "Apakah Uang Sudah Ditarik?",
      hasMoneyBeenDrawnHint:
        "Bank biasanya menahan fasilitas standby di rekening khusus. Pilih Ya hanya setelah uang ditarik ke rekening bank perusahaan.",
      moneyDrawn: "Uang Ditarik",
      initialDrawAmount: "Jumlah Diterima",
      initialDrawDate: "Tanggal Penarikan",
      initialDrawDateHint:
        "Tanggal uang benar-benar masuk ke rekening perusahaan. Boleh setelah tanggal mulai pinjaman.",
      bankAccount: "Rekening Bank Perusahaan",
      bankAccountHint: "Rekening tempat uang masuk, atau tempat pembayaran keluar.",
      bankAccountDrawnHint:
        "Rekening bank perusahaan tempat dana penarikan ditransfer.",
      statusActive: "Aktif",
      statusClosed: "Ditutup",
      outstandingPrincipal: "Pokok Yang Masih Terutang",
      interestPaidThisMonth: "Bunga Dibayar Bulan Ini",
      unusedLimit: "Sisa Plafon Kredit",
      recordDraw: "Catat Penarikan",
      recordDrawTitle: "Catat Uang Yang Diambil",
      recordDrawDesc:
        "Bank atau pemegang saham memasukkan jumlah ini ke perusahaan pada tanggal ini. Ini pendanaan, bukan pendapatan.",
      recordDrawConfirm: "Simpan Penarikan",
      recordReturn: "Kembalikan Pokok",
      recordReturnTitle: "Kembalikan Pokok",
      recordReturnDesc:
        "Ketik pokok yang dikembalikan. Saldo terutang turun sebesar itu. Ini bukan beban.",
      recordReturnConfirm: "Simpan Pengembalian",
      recordReturnSliceInterest: "Bunga Untuk Periode Ini",
      recordReturnSliceHint:
        "Bunga ini tidak ditagih di sini. Bayar di Pengeluaran → Tambah Pengeluaran → Pinjaman.",
      recordReturnSliceRange: "Dari {from} Sampai {to} ({days} Hari)",
      settleEarly: "Pelunasan Dipercepat",
      settleEarlyTitle: "Pelunasan Dipercepat",
      settleEarlyDesc:
        "Sisa pokok, bunga berjalan, denda pelunasan dipercepat, dan biaya admin jika ada. Persen denda dihitung dari sisa pokok, bukan dari pokok awal. Denda dan bunga adalah beban. Pinjaman lalu ditutup.",
      settleEarlyConfirm: "Lunasi Dan Tutup",
      remainingPrincipal: "Sisa Pokok",
      runningInterest: "Bunga Berjalan",
      penaltyPercent: "Denda Pelunasan Dipercepat %",
      penaltyPercentHint:
        "Persen ini dihitung dari sisa pokok pada tanggal pelunasan, bukan dari pokok awal. Jika setengah pokok sudah dibayar, 6% adalah 6% dari sisa yang masih terutang.",
      penaltyAmount: "Denda Pelunasan Dipercepat",
      adminFee: "Biaya Admin / Bank Lain",
      settleEarlyTotal: "Total Yang Dibayar",
      interestByMonth: "Bunga Per Bulan",
      usageSlicesTitle: "Pemakaian Per Tanggal",
      sliceFrom: "Dari",
      sliceTo: "Sampai",
      sliceAmountUsed: "Jumlah Terpakai",
      sliceDays: "Hari",
      sliceInterest: "Bunga",
      sliceOpen: "Berjalan",
      sliceEmpty: "Belum ada penarikan. Periode pemakaian muncul setelah uang diambil.",
      standbySliceHint:
        "Setiap baris adalah jumlah terpakai dari peristiwa sebelumnya sampai tanggal ini, pada saldo yang berlaku. Plafon yang belum dipakai tidak dikenai bunga.",
      extendLoan: "Perpanjang Pinjaman",
      extendLoanTitle: "Perpanjang Pinjaman",
      extendLoanStandbyDesc:
        "Masukkan plafon kredit yang baru. Pokok terutang tidak berubah. Sisa plafon adalah batas baru dikurangi yang sudah ditarik.",
      extendLoanTermDesc:
        "Masukkan suku bunga baru. Angsuran bulanan dihitung ulang dengan metode anuitas bank Indonesia dari sisa pokok dan sisa tenor.",
      extendLoanConfirm: "Simpan Perpanjangan",
      extendFailed: "Tidak dapat memperpanjang pinjaman ini.",
      newCeiling: "Plafon Kredit Baru",
      newCeilingHint:
        "Harus paling sedikit sama dengan pokok yang masih terutang.",
      newInterestRateHint:
        "Suku bunga baru. Angsuran dihitung ulang dengan anuitas dari sisa pokok.",
      extendTermInstallmentHint:
        "Anuitas dari sisa pokok untuk {months} bulan tenor yang tersisa.",
      dayCountActual: "Actual/{year}",
      dayCountHint:
        "Bunga standby memakai Actual/360: saldo setiap hari × suku bunga tahunan / 360. Penarikan tanggal 20 hanya dikenai bunga dari tanggal 20. Kutipan bulanan memakai persen bulan itu dibagi jumlah hari pada bulan tersebut.",
      proof: "Bukti Pembayaran",
      proofRequired: "Unggah bukti pembayaran.",
      reference: "Referensi",
      referencePlaceholder: "Nomor rekening pinjaman atau advice",
      columns: {
        name: "Pinjaman",
        source: "Sumber",
        outstanding: "Terutang",
        next: "Pembayaran Berikutnya",
        status: "Status"
      },
      movementsTitle: "Penarikan Dan Pengembalian",
      movementDraw: "Penarikan",
      movementInterest: "Bunga",
      movementProvision: "Provisi Bank",
      movementAdminFee: "Biaya Admin Bank",
      movementReturn: "Pengembalian",
      noMovements: "Belum ada penarikan atau pengembalian.",
      interestRate: "Suku Bunga",
      dayCount: "Hitungan Hari",
      creditCeiling: "Plafon Kredit",
      noInterest: "Tidak Dikenai Bunga",
      backToLoans: "Pinjaman"
    },
    bpjs: {
      title: "BPJS",
      description:
        "Pendaftaran dan catatan pembayaran. Catat pembayaran virtual account di Biaya.",
      alreadyPaid: "Sudah Dibayar",
      stillToPay: "Masih Harus Dibayar",
      payInExpensesHint:
        "Catat pembayaran BPJS di Biaya. Halaman ini adalah daftar pendaftaran dan pembayaran yang sudah dibukukan.",
      viewExpense: "Buka Biaya",
      dueDateHint: "Jatuh tempo {date}",
      overdue: "Terlambat",
      overdueHint: "Sudah lewat tanggal jatuh tempo",
      notOverdueHint: "Belum lewat tanggal jatuh tempo",
      kesehatan: "BPJS Kesehatan",
      ketenagakerjaan: "BPJS Ketenagakerjaan",
      period: "Periode Iuran",
      enrolled: "{count} Karyawan Terdaftar",
      emptyTitle: "Belum Ada Pendaftaran BPJS",
      emptyDesc:
        "Daftarkan karyawan penuh waktu di Karyawan agar Kesehatan dan Ketenagakerjaan tampil di sini.",
      backToBpjs: "BPJS",
      employeesEmpty: "Tidak ada karyawan terdaftar untuk program ini.",
      hiredAt: "Bergabung",
      tenure: "Masa Kerja",
      basePay: "Gaji Pokok",
      wageBase: "Dasar Upah",
      componentsTitle: "Rincian Program",
      lineKesehatan: "Kesehatan",
      lineJht: "JHT",
      lineJp: "JP",
      lineJkk: "JKK",
      lineJkm: "JKM",
      program: "Program",
      amount: "Jumlah",
      paidAt: "Tanggal Bayar",
      reference: "Referensi",
      remittancesTitle: "Sudah Dibayar Periode Ini",
      remittancesEmpty: "Belum ada pembayaran BPJS di Biaya untuk periode ini.",
      statusPaid: "Dibayar",
      statusDue: "Jatuh Tempo",
      statusOverdue: "Terlambat",
      columns: {
        program: "Program",
        companyShare: "Tanggungan Perusahaan",
        total: "Total",
        paid: "Sudah Dibayar",
        dueDate: "Tanggal Jatuh Tempo",
        status: "Status",
        employee: "Karyawan",
        employeeShare: "Bagian Karyawan"
      }
    },
    pettyCash: {
      title: "Kas Kecil",
      description:
        "Uang tunai yang dipercayakan kepada staf lapangan dan operasional untuk makan, menjamu klien, darurat, dan upah harian paruh waktu.",
      currentBalance: "Saldo saat ini",
      lifetimeIn: "Kas Kecil masuk (seumur hidup)",
      monthIn: "Masuk bulan ini",
      lifetimeOut: "Pengeluaran seumur hidup",
      monthOut: "Pengeluaran bulan ini",
      upcoming: "Upah paruh waktu yang masih dijadwalkan: {amount}",
      negativeWarning:
        "Saldo Kas Kecil di bawah nol. Catat isi ulang di Pengeluaran.",
      recordSpend: "Catat Belanja",
      spendTitle: "Catat Belanja Kas Kecil",
      spendDesc:
        "Unggah nota dan masukkan jumlah yang dibayar untuk mendebit Kas Kecil.",
      spendConfirm: "Debit Kas Kecil",
      spending: "Menyimpan…",
      spendFailed: "Tidak dapat mencatat belanja ini.",
      proof: "Nota / bukti",
      proofHint: "Foto nota atau bukti harus jelas.",
      proofRequired: "Unggah foto nota atau bukti pembayaran.",
      enteredAmount: "Jumlah dibayar",
      amountPlaceholder: "mis. 85000",
      date: "Tanggal",
      descriptionLabel: "Keterangan",
      descriptionPlaceholder: "mis. Makan siang tim lokasi",
      billIsFor: "Tagihan Ini Untuk",
      billIsForPlaceholder: "Pilih Area Manager atau di atasnya",
      billIsForRequired: "Pilih Area Manager atau di atasnya untuk tagihan ini.",
      billIsForHint:
        "Tetapkan belanja ini ke Area Manager, Operations Manager, atau Director.",
      project: "Proyek",
      projectPlaceholder: "Proyek (opsional)",
      projectHint: "Tandai lokasi jika belanja ini milik sebuah pekerjaan.",
      emptyTitle: "Belum Ada Catatan Kas Kecil",
      emptyDesc:
        "Tambah isi ulang Kas Kecil di Pengeluaran, atau catat belanja dengan foto nota.",
      viewProof: "Lihat bukti",
      columns: {
        date: "Tanggal",
        kind: "Jenis",
        description: "Keterangan",
        status: "Status",
        amount: "Jumlah",
        proof: "Bukti"
      },
      kind: {
        TOP_UP: "Isi ulang",
        SPEND: "Belanja",
        PART_TIME_PAY: "Upah paruh waktu"
      },
      status: {
        SCHEDULED: "Dijadwalkan",
        POSTED: "Dicatat",
        VOIDED: "Dibatalkan"
      }
    },
    payroll: {
      title: "Penggajian Internal",
      description:
        "Hanya untuk karyawan RGS (Kantor Pusat, gudang, dan operasional di payroll RGS). Bayar otomatis tarif harian setelah 9 jam (atau 2 × tarif harian setelah 18 jam pada shift ganda yang ditugaskan). Hari lebih pendek tetap kosong sampai Bayar Penuh atau jumlah kustom dimasukkan.",
      directoryTitle: "Penggajian Internal",
      directoryDesc:
        "Modul ini hanya untuk karyawan RGS. Proyek Manajemen Payroll klien ditagih terpisah.",
      periodTitle: "Periode Gaji",
      searchEmployee: "Cari nama atau nomor karyawan",
      periodDesc:
        "Upah = tarif harian (gaji pokok ÷ 26) × hari 9 jam lengkap di jendela ini. Shift ganda yang ditugaskan membayar dua hari hanya setelah 18 jam di proyek itu. Di bawah 9 atau 18 jam: hari tetap kosong sampai Bayar Penuh atau jumlah kustom. Hari tanpa CICO, termasuk cuti, tidak dibayar.",
      periodWindow:
        "Payroll period: 16 {prevMonth} – 15 {thisMonth}. Reconcile on the 16th.",
      periodWindowRange:
        "Payroll period: {range}. Reconcile on the 16th.",
      periodPreview: "Preview — periode ini di-reconcile pada tanggal 16.",
      periodReconciled: "Reconciled on the 16th.",
      periodPicker: "Periode Gaji",
      periodCurrent: "Saat Ini",
      dayListTitle: "Hari Dalam Periode Ini",
      dayDate: "Tanggal",
      daySite: "Proyek / Lokasi",
      dayCheckIn: "Check-In",
      dayCheckOut: "Check-Out",
      exempt: "Exempt",
      dayHours: "Jam",
      dayPay: "Upah",
      doubleShift: "Shift Ganda",
      doubleShiftPayNote: "2 × Tarif Harian",
      dayShift: "Shift",
      coveredShift: "Menggantikan {shift} ({name} Tidak Hadir)",
      coveredByName: "Digantikan Oleh {name}",
      hoursWorkedValue: "{hours} jam",
      underHoursNote:
        "Karyawan hanya bekerja {hours} jam (perlu {required}). Mohon putuskan.",
      fullPay: "Bayar Penuh",
      customAmountPlaceholder: "Jumlah Kustom",
      saveCustomPay: "Simpan Jumlah Kustom",
      checkedOutBeforeShiftEnd: "Check-Out Sebelum Akhir Shift",
      absent: "Tidak Hadir",
      restDay: "Hari Libur",
      onLeave: "Sedang Cuti",
      paySummaryTitle: "Ringkasan Gaji",
      noDays: "Tidak ada CICO lengkap dan tidak ada ketidakhadiran yang diharapkan di periode ini.",
      totalEmployees: "Karyawan",
      totalWage: "Total Upah",
      totalNetPay: "Total Gaji Bersih",
      tableTitle: "Detail Penggajian",
      tableDesc:
        "Staf RGS aktif dan siapa pun dengan CICO lengkap di periode ini. Hari kerja = 9 jam atau lebih (18 jam pada shift ganda yang ditugaskan). Hari di bawah jam tetap tidak dibayar sampai Bayar Penuh atau jumlah kustom. Bendera terlambat atau pulang awal tidak mengubah gaji di sini.",
      emptyTitle: "Karyawan Tidak Ditemukan",
      emptyDesc:
        "Tidak ada staf RGS aktif dengan gaji pokok, dan tidak ada hari CICO lengkap di periode ini.",
      columns: {
        dailyRate: "Upah Harian",
        daysWorked: "Hari Kerja",
        wage: "Upah",
        bpjsKesehatan: "BPJS Kesehatan",
        bpjsTk: "BPJS TK",
        deductions: "Potongan",
        netPay: "Gaji Bersih",
        bankName: "Bank",
        accountNumber: "Nomor Rekening",
        accountHolder: "Pemilik Rekening",
        actions: "Tindakan"
      },
      generatePdf: "Buat PDF",
      lockedBy: "Dikunci oleh {name} pada {time}",
      unlockedBy: "Dibuka oleh {name}, alasan: {reason}",
      unlockPeriod: "Buka Periode",
      unlockPeriodDesc:
        "Membuka kunci memungkinkan Kantor Pusat mengubah potongan dan membuat ulang periode ini. Perubahan absensi akan mengubah gaji lagi sampai Anda generate.",
      unlockReason: "Alasan Buka Kunci",
      lateCheckIn: "Check-In Terlambat",
      pdfTitle: "Penggajian Internal",
      pdfGenerated: "Dibuat",
      pdfGross: "Gross",
      addDeduction: "Tambah Potongan",
      addDeductionDesc:
        "Tambah potongan manual untuk {name}. Ketik sendiri jumlah Rupiah.",
      saveDeduction: "Simpan Potongan",
      deductionSaved: "Potongan disimpan untuk bulan ini.",
      deductionType: "Jenis Potongan",
      deductionAmount: "Jumlah (Rupiah)",
      deductionAmountHint:
        "Masukkan jumlah yang dipotong dari gaji bersih bulan ini.",
      deductionReason: "Alasan",
      lostStockItem: "Item Katalog (Opsional)",
      lostStockItemNone: "Ketik nama item saja",
      lostStockItemName: "Nama Item",
      lostStockQuantity: "Kuantitas",
      lostStockProject: "Proyek",
      selectProject: "Pilih Proyek",
      alreadyExpensed:
        "Stok sudah di-assign ke proyek ini (jangan keluarkan stok yang sama dua kali).",
      deductionTypes: {
        securityDeposit: "Deposit Keamanan",
        lostStock: "Stok Hilang",
        penalty: "Denda",
        other: "Lainnya",
        returnOfSecurityDeposit: "Pengembalian Deposit Keamanan",
        clientCompensation: "Kompensasi Klien",
        forfeitedWages: "Sisa Upah Tidak Dibayar"
      },
      depositStatus: {
        none: "None",
        held: "Held",
        returned: "Returned",
        keptByCompany: "Kept By The Company"
      },
      errors: {
        amountRequired: "Masukkan jumlah Rupiah lebih dari nol.",
        typeRequired: "Pilih jenis potongan.",
        reasonRequired: "Potongan Other wajib mengisi alasan.",
        employeeNotFound: "Karyawan tidak ditemukan.",
        projectRequired: "Pilih proyek atau Head Office.",
        itemRequired: "Pilih item katalog atau ketik nama item.",
        quantityRequired: "Masukkan kuantitas untuk item katalog.",
        insufficientStock:
          "Stok gudang tidak cukup. Gunakan nama item ketikan, atau tandai stok sudah di-assign ke proyek.",
        saveFailed: "Tidak dapat menyimpan potongan ini.",
        deleteFailed: "Tidak dapat menghapus potongan ini.",
        periodLocked:
          "Periode payroll ini terkunci. Kantor Pusat harus membuka kunci dengan alasan sebelum mengubah potongan atau gaji bersih.",
        securityDepositAlreadyHeld:
          "Karyawan ini sudah memiliki security deposit yang di-hold. Tidak boleh mengambil dua.",
        securityDepositNotRequired:
          "Security deposit tidak diaktifkan untuk karyawan ini. Aktifkan Security Deposit di data karyawan terlebih dahulu.",
        unlockHoOnly:
          "Hanya Kantor Pusat yang dapat membuka periode payroll yang terkunci.",
        unlockReasonRequired: "Masukkan alasan untuk membuka periode ini.",
        unlockFailed: "Tidak dapat membuka periode payroll ini.",
        decideFailed: "Tidak dapat menyimpan upah hari ini.",
        dayRequired: "Pilih hari kerja yang valid di periode payroll ini.",
        decisionRequired: "Pilih Bayar Penuh atau jumlah kustom.",
        dayNotComplete: "Hari ini belum memiliki check-in dan check-out lengkap.",
        dayAlreadyComplete:
          "Hari ini sudah memenuhi aturan 9 jam atau 18 jam, jadi dibayar otomatis.",
        exemptNoDayDecision:
          "Karyawan ini dibebaskan dari CICO dan dibayar gaji pokok bulanan, bukan per hari."
      }
    },
    reconciliation: {
      title: "Rekonsiliasi",
      description:
        "Siklus approve/revise bersama klien dan HO untuk laporan rekonsiliasi Regular Cleaning dan paket progress General/Facade sebelum invoice diterbitkan.",
      tabApproved: "Disetujui",
      tabRevised: "Direvisi",
      approvedHelp:
        "Paket yang menunggu klien, plus periode yang sudah disetujui (invoice terbit atau menunggu pembayaran).",
      revisedHelp:
        "Klien meminta perubahan. Setujui dengan nilai/nomor invoice revisi, atau tolak dengan penjelasan dan bukti.",
      silentTwoDaysBadge: "Diam 2+ Hari — Ingatkan Klien",
      silentTwoDaysHelp:
        "Klien belum merespons selama dua hari atau lebih. Ingatkan mereka — tidak ada persetujuan otomatis.",
      clientPendingTitle: "Menunggu review Anda",
      clientPendingHelp:
        "Approve untuk menerbitkan invoice, atau Revise dengan catatan dan bukti opsional untuk Head Office.",
      emptyTitle: "Belum ada data",
      emptyDescription:
        "Belum ada rekonsiliasi atau review progress di daftar ini.",
      openBilling: "Buka penagihan",
      viewReport: "Lihat laporan",
      sendForClientReview: "Kirim untuk review",
      clientActionTitle: "Review Anda",
      clientActionHelp:
        "Tinjau laporan, lalu Approve (invoice diterbitkan) atau Revise (jelaskan yang salah).",
      confirmClientApprove:
        "Setujui laporan ini? Invoice akan dibuat. Untuk bagian General atau Facade terakhir, proyek ditandai selesai pada saat ini.",
      approve: "Setujui",
      approving: "Menyetujui…",
      revise: "Revisi",
      reviseNoteLabel: "Apa yang salah atau tidak akurat?",
      reviseNotePlaceholder: "Jelaskan masalah pada laporan…",
      reviseProofLabel: "Bukti pendukung (opsional)",
      submitRevise: "Kirim revisi",
      submittingRevise: "Mengirim…",
      approveFailed: "Gagal menyetujui.",
      reviseFailed: "Gagal mengirim revisi.",
      hoRejectionTitle: "Tanggapan Head Office",
      viewHoProof: "Lihat bukti HO",
      hoProofTitle: "Dokumen pendukung HO",
      clientRevisionTitle: "Permintaan revisi klien",
      viewClientProof: "Lihat bukti klien",
      clientProofTitle: "Dokumen pendukung klien",
      hoApprove: "Setujui revisi",
      hoReject: "Tolak revisi",
      revisedInvoiceHelp:
        "Masukkan nilai invoice revisi (dan nomor invoice opsional) sebelum mengirim ke klien.",
      revisedAmount: "Nilai invoice revisi",
      revisedInvoiceNumber: "Nomor invoice revisi",
      confirmHoApprove: "Setujui & terbitkan invoice",
      issuingInvoice: "Menerbitkan…",
      rejectNoteLabel: "Jelaskan penolakan",
      rejectProofLabel: "Bukti pendukung (opsional)",
      confirmHoReject: "Kirim penolakan ke klien",
      sendingReject: "Mengirim…",
      hoApproveFailed: "Gagal menyetujui revisi.",
      hoRejectFailed: "Gagal menolak revisi.",
      completedPeriodsTitle: "Periode tertagih",
      invoiceSent: "Invoice terkirim",
      taxInvoiceIssued: "Faktur pajak",
      taxNa: "N/A (tanpa NPWP)"
    },
    progress: {
      title: "Laporan Progress",
      description:
        "Laporan foto lokasi untuk staf cleaning (Cleaning Staff, GC Staff, In-House Cleaning). Unggah selama shift — check-out diblokir sampai minimal satu laporan dikirim untuk proyek.",
      chooseProject: "Pilih Proyek",
      chooseProjectHint:
        "Umpan hanya lihat — buka proyek untuk memantau laporan saat foto diunggah.",
      chooseProjectHintClient:
        "Buka proyek untuk melihat catatan dan foto lokasi Anda.",
      searchClients: "Cari Klien",
      searchProjects: "Cari Proyek",
      clientsSection: "Klien",
      clientsSectionDesc: "Lokasi proyek Sedang Berjalan dikelompokkan menurut klien.",
      internalSection: "Internal",
      internalSectionDesc: "Kantor Pusat dan Gudang.",
      internalSiteHint: "Situs Internal",
      noClients: "Tidak Ada Klien",
      noClientsDesc: "Tidak ada klien dengan proyek yang dapat diakses.",
      noClientsMatch: "Tidak ada klien yang cocok dengan pencarian Anda.",
      noProjects: "Tidak Ada Proyek",
      noProjectsDesc: "Klien ini tidak memiliki proyek yang dapat Anda lihat.",
      noProjectsMatch: "Tidak ada proyek yang cocok dengan pencarian Anda.",
      projectCountOne: "{count} Proyek",
      projectCountOther: "{count} Proyek",
      breadcrumbAria: "Navigasi Laporan Progress",
      downloadProgressReport: "Unduh Laporan Progress",
      downloadAttendance: "Unduh Kehadiran",
      attendanceModeDay: "Hari",
      attendanceModeMonth: "Bulan",
      closedMonthHint:
        "Hanya bulan yang sudah ditutup yang dapat diunduh. Bulan berjalan tersedia setelah bulan itu berakhir.",
      dayNotClosed: "Hari Ini Masih Berlangsung",
      dayNotClosedHint: "Pilih tanggal yang sudah lewat untuk mengunduh laporan hari itu.",
      earlyCheckoutTitle: "Check-Out Sebelum Akhir Shift",
      earlyCheckoutDesc:
        "Staf yang check-out sebelum akhir shift yang direncanakan. Laporan sudah dicatat. Tidak ada potongan gaji otomatis.",
      earlyCheckoutEmptyDay: "Tidak Ada Check-Out Sebelum Akhir Shift Pada Hari Ini",
      earlyCheckoutEmptyMonth: "Tidak Ada Check-Out Sebelum Akhir Shift Pada Bulan Ini",
      attendancePdfTitle: "Kehadiran",
      attendancePdfShift: "Shift",
      attendancePdfHours: "Jam Kerja",
      attendancePdfEarly: "Sebelum Akhir Shift",
      attendancePdfEmpty: "Tidak ada kehadiran tercatat untuk periode ini.",
      backToProjects: "Kembali ke Proyek",
      viewMode: "Tampilan",
      filterByDate: "Tanggal Laporan",
      filterByDateHint: "Gunakan kalender untuk langsung ke hari tertentu.",
      filterByMonth: "Bulan Laporan",
      filterByMonthHint:
        "Baca setiap laporan dari tanggal 1 sampai akhir bulan ini, tanpa mengunduh.",
      filterByEmployee: "Filter menurut Karyawan",
      filterAllEmployees: "Semua Karyawan",
      feedReportCountOne: "{count} Laporan Progress",
      feedReportCountOther: "{count} Laporan Progress",
      myReportsTitle: "Laporan Progress Saya",
      myReportsHint:
        "Unggah Laporan Progress saat bekerja. Staf cleaning harus mengirim minimal satu Laporan Progress sebelum check-out CICO.",
      myReportsHintViewOnly:
        "Laporan Progress untuk staf cleaning pada proyek ini. Check-in dan check-out tidak memerlukan Laporan Progress untuk jabatan Anda.",
      checkInRequiredMessage:
        "Check in melalui CICO untuk proyek Anda sebelum mengirim Laporan Progress.",
      onLeaveMessage:
        "Laporan progress dijeda saat Anda Sedang Cuti. Hubungi Head Office jika status Anda perlu diperbarui.",
      submitReport: "Kirim Laporan Progress",
      editReport: "Ubah Laporan Progress",
      dialogTitle: "Laporan Progress",
      dialogDescription:
        "Staf cleaning: pilih proyek, area layanan, dan catatan, lalu unggah foto lokasi. Anda boleh mengirim beberapa laporan per proyek dan hari. Proyek, Area Layanan, Catatan, dan minimal satu foto wajib diisi.",
      dialogDescriptionCicoLocked:
        "Staf cleaning: pilih area layanan dan catatan, lalu unggah foto lokasi untuk hari kerja CICO yang sedang terbuka. Proyek, Area Layanan, Catatan, dan minimal satu foto wajib diisi.",
      editDialogTitle: "Ubah Laporan Progress",
      editDialogDescription:
        "Perbarui area layanan, catatan, atau foto untuk laporan progress ini. Tanggal laporan tidak dapat diubah. Pertahankan atau tambahkan minimal satu foto.",
      dateLockedCicoHint:
        "Tanggal laporan dikunci ke hari kerja CICO yang sedang terbuka untuk proyek ini.",
      dateLockedEditHint: "Tanggal laporan tidak dapat diubah setelah dikirim.",
      saveChanges: "Simpan Perubahan",
      emptyTitle: "Belum Ada Laporan Progress",
      emptyDescription:
        "Tidak ada proyek atau laporan foto untuk tanggal ini. Staf cleaning harus mengunggah foto lokasi untuk setiap proyek cleaning yang ditugaskan (termasuk Internal) selama shift.",
      emptyForDate: "Tidak ada laporan progress untuk tanggal ini.",
      emptyForMonth: "Tidak ada laporan progress untuk bulan ini.",
      selectProject: "Pilih Proyek",
      serviceArea: "Area Layanan",
      serviceAreaPlaceholder: "mis. Lobby, Lantai 3",
      notesPlaceholder: "Catatan tentang pekerjaan...",
      projectRequired: "Proyek wajib diisi.",
      serviceAreaRequired: "Area layanan wajib diisi.",
      notesRequired: "Catatan wajib diisi.",
      photoRequired: "Minimal satu foto wajib diisi.",
      progressPhoto: "Foto Progress",
      required: "(wajib)",
      reportsForDate: "Laporan untuk {date}",
      reportsForMonth: "Laporan untuk {range}",
      directoryHint: "Proyek → Karyawan → Laporan Progress",
      assignedEmployeeOne: "{count} karyawan ditugaskan",
      assignedEmployeeOther: "{count} karyawan ditugaskan",
      reportCountOne: "{count} Laporan Progress",
      reportCountOther: "{count} Laporan Progress",
      noReportsYet: "Belum ada laporan progress untuk tanggal ini.",
      untitledReport: "Laporan Progress",
      existingPhotos: "Foto yang Ada",
      existingPhotosHint:
        "Hapus foto jika salah, lalu tambahkan pengganti jika perlu.",
      noPhotosKept: "Semua foto yang ada dihapus — tambahkan minimal satu foto baru.",
      addPhotos: "Tambah Foto",
      removePhoto: "Hapus Foto",
      photoUploadHint:
        "JPG, PNG, WebP, atau GIF. Maksimal 10 MB per file. Beberapa foto diperbolehkan.",
      submittedCountOne: "{count} laporan dikirim",
      submittedCountOther: "{count} laporan dikirim",
      submitted: "Terkirim",
      noNotes: "Tidak ada catatan untuk laporan ini.",
      noPhotos: "Tidak ada foto terlampir",
      photoCountOne: "{count} foto",
      photoCountOther: "{count} foto",
      submitFailed: "Gagal mengirim laporan progress.",
      editFailed: "Gagal mengubah laporan progress.",
      errors: {
        employeeProfileNotFound: "Profil karyawan tidak ditemukan.",
        onProjectOnly:
          "Laporan progress hanya tersedia saat Anda Di Proyek.",
        activeOnly:
          "Laporan progress hanya tersedia saat status kepegawaian Anda Aktif.",
        onLeaveBlocked:
          "Laporan progress tidak tersedia saat Anda Sedang Cuti. Hubungi Kantor Pusat jika status perlu diperbarui.",
        projectRequired: "Proyek wajib diisi.",
        serviceAreaRequired: "Area Layanan wajib diisi.",
        notesRequired: "Catatan wajib diisi.",
        dateRequired: "Tanggal wajib diisi.",
        photoRequired: "Minimal satu foto wajib diisi.",
        photoMustBeImage: "Foto harus JPG, PNG, WebP, atau GIF.",
        photoTooLarge: "Setiap foto maksimal 10 MB.",
        notAssigned: "Anda tidak ditugaskan ke proyek ini.",
        backupWindow:
          "Penugasan cadangan ini hanya aktif pada tanggal yang ditetapkan manajer operasional.",
        cleaningOnly:
          "Laporan progress hanya untuk proyek cleaning (Rutin, General, Fasad, atau Internal).",
        cleaningPositionOnly:
          "Laporan progress hanya untuk jabatan staf cleaning (Cleaning Staff, GC Staff, atau In-House Cleaning Staff).",
        inProgressOnly:
          "Laporan progress hanya untuk proyek Sedang Berjalan (perintah kerja diterima).",
        reportNotFound: "Laporan progress tidak ditemukan.",
        editDenied:
          "Hanya penulis laporan yang dapat mengubah laporan progress ini.",
        headOfficeNotAllowed:
          "Staf meja Kantor Pusat tidak dapat mengirim laporan progress untuk situs komersial. In-House Cleaning Staff boleh mengirim di proyek Internal yang ditugaskan dengan CICO terbuka.",
        checkInRequired:
          "Anda harus check in melalui CICO sebelum mengirim Laporan Progress.",
        checkInRequiredForProject:
          "Anda harus check in melalui CICO untuk proyek ini sebelum mengirim Laporan Progress.",
        reportDateMustMatchCico:
          "Tanggal Laporan Progress harus sama dengan hari kerja CICO yang sedang terbuka untuk proyek ini.",
        monthNotClosed:
          "Bulan ini masih berlangsung. Unduhan tersedia setelah bulan berakhir.",
        dayNotClosed:
          "Hari ini masih berlangsung. Unduhan tersedia setelah hari berakhir.",
        exportFailed: "Gagal mengekspor PDF.",
        reportDateLocked: "Tanggal Laporan Progress tidak dapat diubah.",
        editDayLocked:
          "Laporan progress ini tidak dapat diubah setelah hari berakhir.",
        companyNotFound: "Perusahaan tidak ditemukan."
      },
      columns: {
        photos: "Foto",
        notes: "Catatan"
      }
    },
    cico: {
      title: "CICO",
      description:
        "Check-In / Check-Out untuk staf lapangan dan clock kantor Head Office / Warehouse.",
      employeeOnly: "CICO hanya tersedia untuk akun karyawan.",
      noEmployeeProfile:
        "CICO membutuhkan profil karyawan yang terhubung. Minta administrator menghubungkan login Anda ke data karyawan.",
      activeOnlyMessage:
        "CICO hanya tersedia untuk staf Aktif. Hubungi Kantor Pusat jika status Anda perlu diperbarui.",
      onProjectOnlyMessage:
        "CICO lapangan tersedia saat Anda Di Proyek dan ditugaskan ke lokasi cleaning. In-House Cleaning Staff: tugaskan dulu ke proyek Internal Head Office atau Warehouse. Warehouse Supervisor dan staf meja Corporate memakai CICO kantor.",
      errors: {
        notAssigned: "Anda tidak ditugaskan ke proyek ini.",
        backupWindow:
          "Penugasan cadangan ini hanya aktif pada tanggal yang ditetapkan manajer operasional.",
        cleaningOnly:
          "CICO hanya untuk proyek cleaning (Rutin, General, Fasad, atau Internal).",
        inProgressOnly:
          "Check-in hanya tersedia untuk proyek Sedang Berjalan (perintah kerja diterima).",
        noSiteLocation: "Proyek ini belum memiliki lokasi situs yang dikonfigurasi.",
        locationRequired: "Lokasi wajib. Izinkan akses lokasi browser.",
        employeeAccountsOnly: "CICO hanya tersedia untuk akun karyawan.",
        invalidRequest: "Permintaan tidak valid.",
        employeeProfileNotFound: "Profil karyawan tidak ditemukan.",
        inactiveEmployee:
          "CICO tidak tersedia untuk data karyawan yang diarsipkan atau dihapus.",
        activeOnly:
          "CICO hanya tersedia saat status kepegawaian Anda Aktif.",
        onLeaveBlocked:
          "CICO tidak tersedia saat Anda Sedang Cuti. Hubungi Kantor Pusat jika status perlu diperbarui.",
        onProjectOnly:
          "Check-in hanya tersedia saat Anda ditugaskan ke proyek cleaning Sedang Berjalan (Di Proyek).",
        selectProject: "Pilih proyek untuk check-in.",
        alreadyCheckedIn: "Sudah check-in di lokasi ini hari ini.",
        mustCheckOutBeforeNextSite:
          "Check out dari {site} sebelum check-in di lokasi lain.",
        photoRequired:
          "Foto check-in wajib. Ambil foto yang menunjukkan Anda di lokasi proyek ini.",
        photoMustBeImage: "Foto check-in harus berupa file gambar.",
        checkOutPhotoRequired:
          "Foto check-out wajib. Ambil foto yang menunjukkan Anda di lokasi proyek ini.",
        checkOutPhotoMustBeImage: "Foto check-out harus berupa file gambar.",
        mustCheckInFirst: "Anda harus check-in terlebih dahulu.",
        alreadyCheckedOut: "Sudah check-out untuk hari shift ini.",
        checkInProjectNoLocation:
          "Proyek check-in hari ini tidak memiliki lokasi situs.",
        tooFarCheckIn:
          "Anda berjarak {distance} m dari {site}. Check-in dalam radius {radius} m dari lokasi proyek tersebut.",
        tooFarCheckOut:
          "Anda berjarak {distance} m dari {site}. Check-out dalam radius {radius} m dari lokasi proyek tersebut.",
        lateCheckInNote: "Check-in terlambat (seharusnya sebelum {time}).",
        earlyCheckOutNote: "Check-out sebelum akhir shift. Laporan sudah dicatat.",
        earlyCheckoutTitle: "Check-Out Sebelum Akhir Shift",
        earlyCheckoutBody:
          "Anda check-out sebelum akhir shift. Jika dilanjutkan, laporan akan dikirim ke operational manager Anda.",
        progressRequiredBeforeCheckOut:
          "Laporan Progress wajib untuk check-out. Silakan unggah lalu coba CICO lagi."
      },
      todaysCico: "CICO Hari Ini",
      todaysSessions: "Sesi Hari Ini",
      checkOutPending: "Masih check-in",
      lateCheckIn: "Check-In Terlambat",
      earlyCheckOut: "Check-Out Sebelum Akhir Shift",
      recentHistory: "Riwayat Terbaru",
      checkIn: "Check In",
      checkOut: "Check Out",
      checkedIn: "Sudah Check In",
      checkedOut: "Sudah Check Out",
      gettingLocation: "Mengambil lokasi...",
      noHistory: "Belum ada riwayat check-in.",
      projectSite: "Lokasi Proyek",
      selectProject: "Pilih Proyek",
      noProjectsAssigned:
        "Belum ada proyek cleaning yang ditugaskan. Minta manajer menugaskan Anda ke lokasi Pembersihan Rutin, General, atau Fasad.",
      checkingInAt: "Check-in di",
      mustBeWithinMeters: "Harus berada dalam {meters} m dari lokasi ini.",
      yourShift: "Shift Anda:",
      clockInBeforeHint:
        "Clock-in sebelum {time} jika memungkinkan — check-in terlambat tetap diizinkan. Shift overnight tetap pada hari shift yang sama sampai check-out.",
      noShiftAssigned:
        "Belum ada shift — minta Kantor Pusat mengatur shift di Sumber Daya Manusia → Shift.",
      onSitePhoto: "Foto Check-In",
      required: "(wajib)",
      photoHelp:
        "Ambil foto yang jelas menunjukkan Anda di lokasi proyek ini (selfie atau bukti di lokasi). Check-in tidak akan berhasil tanpa foto.",
      checkOutPhotoHelp:
        "Ambil foto yang jelas menunjukkan Anda di lokasi proyek ini. Check-out tidak akan berhasil tanpa foto.",
      takePhoto: "Ambil / Unggah Foto",
      retakePhoto: "Ambil Ulang Foto",
      noPhotoSelected: "Belum ada foto dipilih",
      noPhotoSelectedCheckOut: "Belum ada foto check-out dipilih",
      checkInPhoto: "Foto Check-In",
      checkInPhotoAlt: "Foto check-in hari ini",
      checkOutPhoto: "Foto Check-Out",
      checkOutPhotoAlt: "Foto check-out hari ini",
      checkedInAt: "Check-in di:",
      shiftLabel: "Shift",
      progressRequiredTitle: "Laporan Progress Wajib",
      progressRequiredBody:
        "Laporan Progress wajib untuk check-out. Silakan unggah lalu coba CICO lagi.",
      uploadProgressNow: "Unggah Laporan Progress",
      footerNote:
        "CICO untuk staf cleaning Aktif Di Proyek pada lokasi cleaning yang ditugaskan (termasuk Internal). Anda harus berada di lokasi proyek, dan foto di lokasi wajib, untuk Check-In atau Check-Out. Check-out juga membutuhkan minimal satu Laporan Progress untuk hari shift ini.",
      footerNoteCheckInOnly:
        "Anda harus berada di lokasi proyek, dan foto di lokasi wajib, untuk Check-In atau Check-Out. Laporan Progress tidak wajib untuk jabatan Anda.",
      chooseImageFile: "Pilih file gambar untuk foto di lokasi Anda.",
      photoRequiredAlert:
        "Foto check-in wajib. Ambil foto yang menunjukkan Anda di lokasi proyek ini.",
      checkOutPhotoRequiredAlert:
        "Foto check-out wajib. Ambil foto yang menunjukkan Anda di lokasi proyek ini.",
      checkInFailed: "Check-in gagal.",
      checkOutFailed: "Check-out gagal.",
      locationFailed:
        "Tidak dapat mengambil lokasi Anda. Izinkan akses GPS lalu coba lagi.",
      geolocationUnsupported: "Geolokasi tidak didukung di perangkat ini.",
      columns: {
        project: "Proyek",
        checkIn: "Check-In",
        checkOut: "Check-Out"
      },
      adminPreview: {
        bannerTitle: "Mode Pratinjau — Check-In Dinonaktifkan",
        bannerBody:
          "Akun Kantor Pusat dapat meninjau aktivitas CICO hari ini dan tampilan staf lapangan di sini. Check-in dan check-out operasional tetap hanya untuk staf cleaning Aktif Di Proyek.",
        fieldBannerTitle: "Pratinjau CICO Admin Lapangan",
        fieldBannerBody:
          "Anda menggunakan CICO seolah ditugaskan ke proyek ini. Kehadiran nyata dapat tercatat pada profil karyawan yang terhubung.",
        checkedInToday: "Check-In Hari Ini",
        openCheckIns: "Check-In Terbuka",
        sitesWithActivity: "Situs Beraktivitas",
        viewAttendanceReport: "Laporan Progress",
        viewProjects: "Proyek",
        todaysSiteCheckIns: "Check-In Situs Hari Ini",
        noCheckInsToday: "Belum ada check-in tercatat hari ini.",
        fieldWorkerPreview: "Tampilan Staf Lapangan",
        fieldWorkerPreviewHint:
          "Contoh tampilan proyek — kontrol dinonaktifkan untuk akun Kantor Pusat.",
        fieldWorkerFlow: "CICO Lapangan",
        fieldWorkerFlowHint:
          "Pilih proyek Sedang Berjalan, lalu check-in di lokasi. Anda harus berada di lokasi proyek dan mengambil foto; Laporan Progress sebelum check-out hanya untuk jabatan staf cleaning.",
        controlsDisabled:
          "Check-in, check-out, dan unggah foto dinonaktifkan dalam mode pratinjau.",
        noSampleProject:
          "Tidak ada proyek cleaning Sedang Berjalan dengan lokasi situs untuk pratinjau.",
        noSelectableProject:
          "Tidak ada proyek Sedang Berjalan dengan lokasi situs. Tambahkan koordinat proyek terlebih dahulu.",
        noEmployeeProfile:
          "Akun admin Anda memerlukan profil karyawan terhubung untuk mencatat kehadiran CICO.",
        footerNote:
          "Ini pratinjau baca-saja. Gunakan Laporan Progress untuk pemantauan live dan Proyek untuk mengelola penugasan situs.",
        fieldFooterNote:
          "Kehadiran dicatat pada profil karyawan Anda. Anda harus berada di lokasi proyek untuk Check-In atau Check-Out."
      }
    },
    attendance: {
      checkedOutBeforeShiftEnd: "Check-Out Sebelum Akhir Shift",
      emptyTitle: "Tidak ada check-in",
      noCheckInToday: "Belum check-in hari ini",
      noCheckInsYet: "Belum ada check-in",
      columns: {
        employee: "Karyawan",
        project: "Proyek",
        checkIn: "Check-in",
        checkOut: "Check-out",
        date: "Tanggal"
      }
    },
    shifts: {
      title: "Shift",
      description:
        "Pilih klien, lalu situs proyek. Tambah shift bernama, tugaskan staf, tugaskan masing-masing ke Shift 1–4, atau tugaskan shift ganda atau cadangan. Check-in dan check-out tetap mencatat waktu absensi aktual.",
      breadcrumbAria: "Navigasi Shift",
      searchClients: "Cari Klien",
      searchProjects: "Cari Proyek",
      clientsSection: "Klien",
      clientsSectionDesc: "Situs proyek Berjalan dikelompokkan per klien.",
      internalSection: "Internal",
      internalSectionDesc: "Shift Kantor Pusat dan Gudang.",
      internalSiteHint: "Situs Internal",
      projectsSection: "Proyek",
      projectsSectionDesc: "Situs proyek untuk klien ini.",
      projectCountOne: "{count} Proyek",
      projectCountOther: "{count} Proyek",
      noClients: "Tidak Ada Klien",
      noClientsDesc:
        "Proyek Berjalan muncul di sini. Pindahkan proyek ke Berjalan terlebih dahulu.",
      noClientsMatch: "Tidak ada klien yang cocok.",
      noProjects: "Tidak Ada Proyek",
      noProjectsDesc: "Klien ini tidak memiliki situs proyek Berjalan.",
      noProjectsMatch: "Tidak ada proyek yang cocok.",
      manageShifts: "Kelola Shift",
      addShift: "Tambah Shift",
      addShiftDesc: "Tambah Shift {number} dan atur jamnya. Lalu tugaskan karyawan tetap ke shift itu.",
      addShiftHint:
        "Setiap shift 9 jam. Jam tidak boleh bertabrakan dengan shift lain di proyek ini. Berdampingan boleh — satu boleh selesai 16:00 dan yang berikutnya mulai 16:00.",
      shiftClash:
        "Shift {aNumber} ({aStart}–{aEnd}) bertabrakan dengan Shift {bNumber} ({bStart}–{bEnd}). Shift tidak boleh tumpang tindih. Ubah jamnya agar satu selesai sebelum yang berikutnya mulai.",
      addShiftConfirm: "Tambah Shift",
      addShiftSaving: "Menambah…",
      addShiftFailed: "Tidak dapat menambah shift.",
      addShiftEmpty: "Tambah shift bernama pertama, lalu tugaskan staf ke shift itu.",
      removeShift: "Hapus Shift",
      remove: "Hapus",
      removeShiftConfirm:
        "Hapus {shift}? Lepas staf, cadangan, dan shift ganda dari shift ini terlebih dahulu.",
      removeShiftSaving: "Menghapus…",
      removeShiftFailed: "Tidak dapat menghapus shift.",
      assignStaffDesc:
        "Pilih siapa yang bekerja di proyek ini. Lalu tugaskan masing-masing ke Shift 1, Shift 2, Shift 3, atau Shift 4.",
      assignStaffSaving: "Menyimpan…",
      assignStaffFailed: "Tidak dapat menugaskan staf.",
      backupTitle: "Cadangan",
      searchEmployeesPlaceholder: "Cari Karyawan...",
      emptyStaffTitle: "Tidak Ada Staf Ditugaskan",
      emptyStaffDescription:
        "Gunakan Tugaskan Staf di halaman ini, lalu tugaskan masing-masing ke Shift 1, Shift 2, Shift 3, atau Shift 4.",
      emptySearch: 'Tidak Ada Hasil Untuk "{query}"',
      emptySearchDesc: "Coba nama lain.",
      staffCount: "{count} Staf",
      projectNotFoundTitle: "Proyek Tidak Ditemukan",
      projectNotFoundDescription:
        "Proyek ini tidak aktif, atau sudah dihapus. Kembali dan pilih proyek lain.",
      shiftStart: "Mulai Shift",
      shiftEnd: "Selesai Shift",
      save: "Simpan",
      saving: "Menyimpan...",
      saveFailed: "Gagal memperbarui shift.",
      rosterTitle: "Shift Staf",
      windowsTitle: "Shift Proyek",
      windowsHint:
        "Atur jam di sini. Shift di proyek ini tidak boleh tumpang tindih. Tambah Shift jika situs perlu shift bernama lain (paling banyak 4). Gunakan Hapus pada baris setelah staf, cadangan, dan shift ganda dilepas dari shift itu.",
      assignShift: "Shift Ditugaskan",
      selectShift: "Pilih Shift",
      unassignedShift: "Tidak Ada Shift",
      columns: {
        employee: "Karyawan",
        employmentType: "Jenis Kepegawaian",
        shift: "Shift",
        hours: "Jam",
        actions: "Aksi"
      }
    },
    teams: {
      assignmentTitle: "Penugasan",
      assignmentDescription:
        "Buat tim berdasarkan area layanan, lalu masukkan karyawan tetap ke setiap roster.",
      availabilityTitle: "Ketersediaan Tim",
      addTeam: "Tambah Tim",
      editTeam: "Ubah Tim",
      deleteTeam: "Hapus Tim",
      members: "Anggota",
      addMember: "Tambah Anggota",
      name: "Nama Tim",
      kind: "Jenis Tim",
      kindGeneral: "General Cleaning",
      kindFacade: "Facade Cleaning",
      kindLandscaping: "Landscaping",
      searchPlaceholder: "Cari tim...",
      filterAll: "Semua",
      emptyTitle: "Belum Ada Tim",
      emptyDescription:
        "Tambah tim untuk suatu area layanan, lalu alokasikan karyawan tetap.",
      emptySearch: "Tidak ada tim yang cocok.",
      emptyMembers: "Belum ada anggota di tim ini.",
      emptyEligible: "Tidak ada karyawan yang dapat ditambahkan ke tim.",
      memberCount: "{count} anggota",
      memberCountOne: "1 anggota",
      statusAvailable: "Tersedia",
      statusOnSite: "Di Lokasi",
      createFailed: "Gagal membuat tim.",
      updateFailed: "Gagal mengubah tim.",
      deleteFailed: "Gagal menghapus tim.",
      deleteBlockedOnJob:
        "Tim ini sedang di pekerjaan. Lepas dari pekerjaan sebelum menghapus.",
      addMemberFailed: "Gagal menambahkan karyawan ke tim.",
      removeMemberFailed: "Gagal mengeluarkan karyawan dari tim.",
      deleteConfirm:
        "Hapus {name}? Anggota menjadi Tersedia dan keluar dari tim. Karyawan tidak dihapus.",
      previousMonth: "Bulan sebelumnya",
      nextMonth: "Bulan berikutnya",
      noAvailability: "Belum ada tim.",
      noAvailabilityDesc: "Buat tim di Penugasan terlebih dahulu.",
      openAssignment: "Buka Penugasan",
      occupiedLegend: "Di lokasi",
      availableLegend: "Tersedia",
      columns: {
        team: "Tim",
        type: "Jenis",
        members: "Anggota",
        status: "Status",
        actions: "Tindakan"
      }
    },
    leaves: {
      title: "Izin & Sakit",
      submitRequest: "Kirim Permintaan",
      newRequest: "Permintaan Baru",
      filterAll: "Semua",
      requestCount: "{count} Permintaan",
      permissionSection: "Izin",
      permissionSectionDesc: "Permintaan izin dan status persetujuannya.",
      sickSection: "Sakit",
      sickSectionDesc: "Permintaan sakit dan status persetujuannya.",
      stats: {
        permissionTitle: "Izin",
        permissionSubtitle: "Permintaan izin",
        sickTitle: "Sakit",
        sickSubtitle: "Permintaan sakit",
        pendingTitle: "Menunggu",
        pendingSubtitle: "Menunggu keputusan",
        approvedTitle: "Disetujui",
        approvedSubtitle: "Permintaan yang disetujui"
      },
      dialogTitle: "Permintaan Izin / Sakit",
      dialogDescription:
        "Ajukan permintaan izin atau cuti sakit untuk disetujui manajer.",
      emptyPermissionTitle: "Tidak Ada Permintaan Izin",
      emptySickTitle: "Tidak Ada Permintaan Sakit",
      emptyFilteredTitle: "Tidak Ada Permintaan yang Cocok",
      emptyFilteredDescription: "Tidak ada yang sesuai dengan filter yang dipilih.",
      emptyPermissionDescriptionEmployee:
        "Ajukan permintaan izin saat Anda membutuhkan waktu tidak masuk.",
      emptyPermissionDescriptionManager: "Tidak ada permintaan izin untuk ditampilkan.",
      emptySickDescriptionEmployee:
        "Ajukan permintaan sakit saat Anda membutuhkan waktu tidak masuk.",
      emptySickDescriptionManager: "Tidak ada permintaan sakit untuk ditampilkan.",
      approvedNotification: "Permintaan izin Anda telah disetujui.",
      approvedNotificationSingle: "{type} Anda telah disetujui",
      approvedNotificationMany: "{count} permintaan izin telah disetujui",
      approvedDetailSuffix: "Disetujui {when}",
      viewLeaveRequests: "Lihat Permintaan Izin",
      gotIt: "Mengerti",
      dismiss: "Tutup",
      saving: "Menyimpan…",
      dismissApprovedNotification: "Tutup notifikasi persetujuan izin",
      errors: {
        employeeProfileNotFound: "Profil karyawan tidak ditemukan.",
        availableOnly:
          "Permintaan izin dan sakit hanya tersedia saat penempatan Anda adalah Tersedia.",
        activeOnly:
          "Permintaan izin dan sakit hanya tersedia saat status kepegawaian Anda Aktif.",
        onLeaveBlocked:
          "Permintaan izin dan sakit tidak tersedia saat Anda Sedang Cuti.",
        datesRequired: "Tanggal wajib diisi.",
        reasonRequired: "Alasan wajib diisi.",
        invalidDates: "Tanggal tidak valid.",
        endBeforeStart: "Tanggal selesai tidak boleh sebelum tanggal mulai.",
        companyNotFound: "Perusahaan tidak ditemukan.",
        leaveNotFound: "Permintaan izin tidak ditemukan.",
        alreadyReviewed: "Permintaan ini sudah ditinjau.",
        notAllowedToApprove: "Anda tidak diizinkan menyetujui permintaan ini."
      },
      requestType: "Jenis Permintaan",
      startDate: "Tanggal Mulai",
      endDate: "Tanggal Selesai",
      reason: "Alasan",
      reasonPlaceholder: "Alasan permintaan...",
      proofDocument: "Dokumen Bukti",
      proofOptional: "(opsional)",
      dropFileOrBrowse: "Jatuhkan file di sini atau telusuri",
      proofMustBeImageOrPdf: "Bukti harus berupa gambar atau PDF.",
      submitFailed: "Gagal mengirim permintaan.",
      proof: "Bukti",
      period: "Periode",
      columns: {
        type: "Jenis",
        reason: "Alasan",
        status: "Status"
      }
    },
    approvals: {
      title: "Persetujuan",
      description: "Setujui izin, sakit, dan permintaan material.",
      emptyLeaveTitle: "Tidak Ada Permintaan Izin",
      emptyLeaveDescription: "Tidak ada izin atau sakit menunggu tinjauan.",
      emptyLeaveOnlyOwnDescription:
        "Tidak ada yang perlu Anda setujui saat ini. Permintaan Anda ada di atas dan membutuhkan peninjau lain.",
      emptyMaterialsTitle: "Tidak ada permintaan material",
      emptyMaterialsDescription:
        "Tidak ada permintaan material menunggu tinjauan.",
      needsAttentionSection: "Perlu Perhatian",
      needsAttentionSectionDesc:
        "Putuskan hasil retur item yang belum selesai. Keputusan Anda bersifat final.",
      emptyNeedsAttentionTitle: "Tidak Ada Retur Item",
      emptyNeedsAttentionDescription:
        "Retur item yang belum selesai muncul di sini untuk keputusan manajer.",
      leaveSection: "Izin & Sakit",
      leaveSectionDesc:
        "Permintaan izin dan sakit yang menunggu keputusan Anda.",
      ownPendingTitle: "Permintaan Anda menunggu peninjau lain",
      ownPendingDesc:
        "Anda tidak dapat menyetujui izin sendiri. Minta HO admin / Direktur lain (mis. manager) meninjau di Approvals.",
      statusPending: "Menunggu",
      materialsSection: "Permintaan Material",
      materialsSectionDesc:
        "Tinjau detail permintaan, cek stok gudang, lalu setujui (membuat Transfer Order) atau tolak.",
      pendingCount: "{count} menunggu",
      proof: "Bukti",
      period: "Periode",
      columns: {
        employee: "Karyawan",
        type: "Jenis",
        reason: "Alasan"
      }
    },
    materialRequests: {
      title: "Permintaan Material",
      description:
        "Ajukan material untuk proyek tempat Anda check-in. Operations Manager atau Area Manager menyetujui, lalu gudang mengirim transfer order.",
      newRequest: "Permintaan Baru",
      newRequestDesc:
        "Pilih tipe item, lalu pilih item katalog dan kuantitas untuk proyek check-in Anda. Item yang stoknya habis tidak dapat diminta.",
      myRequests: "Permintaan Saya",
      myRequestsDesc:
        "Lacak status persetujuan, progress transfer, dan konfirmasi penerimaan saat gudang menandai terkirim.",
      requestCount: "{count} permintaan",
      lineCount: "{count} item",
      submittedOn: "Dikirim {date}",
      emptyTitle: "Belum Ada Permintaan",
      emptyDescription: "Ajukan permintaan saat check-in lewat CICO.",
      mustBeCheckedIn:
        "Anda harus check-in (CICO) ke proyek sebelum meminta material.",
      checkedInHint: "Meminta untuk proyek check-in: {project}",
      checkedInProjectLabel: "Proyek check-in",
      checkedInHintDetail:
        "Permintaan ini terikat ke proyek ini dan muncul di Approvals untuk tinjauan OM.",
      selectItem: "Pilih Item…",
      selectItemTitle: "Pilih Item",
      selectItemDesc:
        "Pilih tipe item terlebih dahulu, lalu pilih item katalog.",
      itemTypeLabel: "Tipe Item",
      itemTypeHint: "Pilih tipe item yang diminta.",
      itemTypes: {
        sparePart: "Suku Cadang",
        consumable: "Bahan Habis Pakai",
        chemical: "Bahan Kimia",
        other: "Lainnya",
        equipment: "Peralatan",
        vehicle: "Kendaraan"
      },
      searchItemsPlaceholder: "Cari nama atau SKU…",
      noItemsForType: "Tidak ada item katalog untuk tipe ini.",
      noItemsMatchSearch: "Tidak ada item yang cocok dengan pencarian Anda.",
      addLine: "Tambah Baris",
      notesPlaceholder:
        "Catatan opsional untuk AM / gudang (urgensi, lokasi di site…)",
      reviewNotePlaceholder:
        "Catatan tinjauan opsional (disarankan saat menolak)",
      submit: "Kirim Permintaan",
      submitHint:
        "Setelah kirim: Approvals → Transfer Orders → Konfirmasi Diterima di site.",
      linesRequired: "Tambah minimal satu item.",
      quantityInvalid: "Kuantitas harus bilangan bulat positif.",
      projectInvalid: "Proyek check-in tidak dapat menerima material saat ini.",
      createFailed: "Tidak dapat membuat permintaan material.",
      created: "Permintaan material dikirim.",
      cancelFailed: "Tidak dapat membatalkan permintaan material.",
      cancelled: "Permintaan material dibatalkan.",
      notFound: "Permintaan material tidak ditemukan.",
      reviewFailed: "Tidak dapat meninjau permintaan material.",
      approved: "Permintaan disetujui — transfer order dibuat.",
      rejected: "Permintaan material ditolak.",
      noLines: "Tidak ada baris item.",
      stockShort: "Kurang dari permintaan",
      outOfStock: "Stok Habis",
      itemNotAvailable: "Item Tidak Tersedia",
      itemOutOfStock: "Item ini stoknya habis.",
      status: {
        requested: "Diminta",
        approved: "Disetujui",
        rejected: "Ditolak",
        cancelled: "Dibatalkan"
      },
      columns: {
        item: "Item",
        sku: "SKU",
        qty: "Kuantitas Diminta",
        onHand: "Stok Gudang",
        availability: "Ketersediaan",
        requester: "Pemohon",
        reviewed: "Ditinjau",
        notes: "Catatan",
        reviewNote: "Catatan tinjauan",
        requestedItems: "Item yang diminta"
      }
    },
    transferOrders: {
      title: "Transfer Barang",
      description:
        "Antrian Gudang: telusuri per klien dan proyek, kirim material yang disetujui, lalu site konfirmasi penerimaan.",
      pendingTitle: "Transfer Barang Tertunda",
      pendingTitleOther: "Transfer Barang Tertunda",
      pendingDesc:
        "Pesanan yang masih perlu tindakan gudang atau site.",
      itemSummary: "{qty} {unit} {name}",
      itemSummaryMore: "{qty} {unit} {name} dan {count} lainnya",
      directoryTitle: "Klien & Lokasi",
      directoryDesc:
        "Telusuri klien dan lokasi internal. Buka proyek untuk antrian gudang dan riwayat transfer order.",
      breadcrumbAria: "Navigasi transfer barang",
      searchClients: "Cari klien...",
      searchProjects: "Cari proyek...",
      noClientsMatch: "Tidak ada klien yang cocok dengan pencarian Anda.",
      noProjects: "Belum Ada Proyek",
      noProjectsDesc: "Klien ini tidak punya proyek yang dapat diakses.",
      noProjectsMatch: "Tidak ada proyek yang cocok dengan pencarian Anda.",
      internalSection: "Internal",
      internalSectionDesc:
        "Antrian dan riwayat transfer order Head Office serta Warehouse.",
      internalSiteHint: "Antrian lokasi internal",
      clientsSection: "Klien",
      clientsSectionDesc:
        "Telusuri klien dan proyek. Lencana menunjukkan menunggu kirim / dalam perjalanan.",
      projectsSection: "Proyek",
      projectCountOne: "{count} proyek",
      projectCountOther: "{count} proyek",
      badgePending: "{count} menunggu",
      badgeInTransit: "{count} transit",
      queueTitle: "Antrian Gudang",
      queueDesc:
        "Setiap kartu menampilkan proyek tujuan, pemohon, rincian item, dan ketersediaan stok sebelum Anda menandai terkirim.",
      emptyTitle: "Belum Ada Transfer Order",
      emptyDescription:
        "Permintaan material yang disetujui muncul di sini ketika klien atau lokasi punya barang untuk dikirim.",
      emptyProjectDescription:
        "Belum ada transfer order untuk proyek ini. Permintaan material yang disetujui akan muncul di sini.",
      notFound: "Transfer order tidak ditemukan.",
      sendFailed: "Tidak dapat menandai transfer sebagai terkirim.",
      sent: "Transfer ditandai terkirim. Stok sedang dalam perjalanan.",
      markSent: "Tandai Terkirim",
      receiveFailed: "Tidak dapat mengonfirmasi penerimaan.",
      receiveDenied:
        "Anda tidak memiliki izin untuk mengonfirmasi penerimaan transfer.",
      received: "Penerimaan dikonfirmasi. Proyek sudah dibebankan biayanya.",
      confirmReceived: "Konfirmasi Diterima",
      didNotReceive: "Tidak Diterima",
      didNotReceiveFailed:
        "Tidak dapat mencatat bahwa kiriman tidak diterima.",
      itemReturnCompleted: "Retur item selesai. Stok kembali ke gudang.",
      itemReturnFailed: "Tidak dapat menyelesaikan retur item.",
      completeItemReturn: "Selesaikan Retur Item",
      needsAttention: "Perlu Perhatian",
      escalated: "Retur item dikirim ke Perlu Perhatian.",
      escalateFailed: "Tidak dapat mengirim retur item ke Perlu Perhatian.",
      writeOffStock: "Hapus Stok",
      writeOffDone: "Stok dihapus. Catatan tetap disimpan.",
      writeOffFailed: "Tidak dapat menghapus stok ini.",
      assignToProject: "Tetapkan Ke Proyek",
      assignToProjectDone: "Stok ditetapkan ke proyek yang dipilih.",
      assignToProjectFailed: "Tidak dapat menetapkan stok ke proyek.",
      assignToStock: "Tetapkan Ke Stok",
      assignToStockDone: "Stok dikembalikan ke gudang.",
      assignToStockFailed: "Tidak dapat mengembalikan stok ke gudang.",
      projectRequired: "Pilih proyek.",
      originalProject: "Tujuan Awal",
      mustBeCheckedInToReceive:
        "Check-in (CICO) ke proyek ini sebelum mengonfirmasi penerimaan.",
      requestedBy: "Diminta oleh {name}",
      sentBy: "Dikirim oleh {name}",
      receivedBy: "Diterima oleh {name}",
      statPending: "{count} menunggu kirim",
      statSent: "{count} dalam perjalanan",
      statReceived: "{count} diterima",
      status: {
        pendingSend: "Menunggu Kirim",
        sent: "Terkirim",
        received: "Diterima",
        notReceived: "Tidak Diterima",
        returned: "Dikembalikan",
        needsAttention: "Perlu Perhatian",
        writtenOff: "Stok Dihapus",
        cancelled: "Dibatalkan"
      },
      columns: {
        createdAt: "Dibuat",
        sentAt: "Dikirim",
        receivedAt: "Diterima",
        itemsToSend: "Item yang dikirim"
      }
    },
    reports: {
      noProgressForEmployee:
        "Tidak ada Progress Report untuk karyawan ini pada hari ini.",
      noCicoForEmployee: "Tidak ada CICO untuk karyawan ini pada hari ini.",
      cicoCheckIn: "Check-In",
      cicoCheckOut: "Check-Out",
      cicoInProgress: "Sedang berjalan",
      pdfWorkDate: "Tanggal Kerja",
      pdfEmployeeNo: "No. Karyawan",
      progressPhoto: "Foto progress",
      noReports: "Tidak ada laporan untuk bulan ini.",
      months: {
        "1": "Januari",
        "2": "Februari",
        "3": "Maret",
        "4": "April",
        "5": "Mei",
        "6": "Juni",
        "7": "Juli",
        "8": "Agustus",
        "9": "September",
        "10": "Oktober",
        "11": "November",
        "12": "Desember"
      }
    },
    inventory: {
      title: "Inventaris",
      companyNotFound: "Perusahaan tidak ditemukan.",
      permissionDenied: "Anda tidak memiliki izin untuk mengelola inventaris.",
      assignPermissionDenied:
        "Hanya Operations Manager, Director, atau admin HO yang dapat menetapkan atau membatalkan inventaris proyek.",
      noStockToIssue:
        "Tidak ada item dengan stok tersedia. Catat penerimaan stok sebelum menetapkan ke proyek.",
      quantityExceedsStock:
        "Kuantitas melebihi stok tersedia. Tersedia: {available} {unit}.",
      quantityMustBeWhole: "{field} harus berupa bilangan bulat.",
      quantityMustBePositive: "{field} harus lebih besar dari nol.",
      quantityMustBeNonNegative: "{field} harus nol atau lebih besar.",
      costingNote:
        "Bahan habis pakai, kimia, dan stok lainnya memakai biaya rata-rata tertimbang untuk nilai dan pengeluaran proyek. Biaya Terakhir adalah harga satuan pembelian terakhir (cek lonjakan harga). Nilai peralatan yang dimiliki adalah jumlah biaya pembelian terkunci per aset.",
      searchPlaceholder: "Cari item, pemasok, proyek…",
      searchPurchasesPlaceholder:
        "Cari semua penerimaan stok: item, SKU, pemasok, invoice…",
      searchVehiclesPlaceholder: "Cari plat, kendaraan, tahun…",
      searchingPurchases: "Mencari penerimaan stok lama…",
      searchPurchasesFailed: "Tidak dapat mencari penerimaan stok.",
      itemTypeLocked: "Jenis item tidak dapat diubah setelah dibuat.",
      deleteItemFailed: "Tidak dapat menghapus item katalog.",
      addItem: "Tambah Item",
      addItemDesc:
        "Buat item katalog saja. Penerimaan stok dan stok dicatat terpisah.",
      editItem: "Edit Item",
      editItemDesc:
        "Perbarui detail katalog. SKU dan jenis item tetap ditetapkan sistem.",
      saveItem: "Simpan Item",
      stockReceiptsViaExpenses:
        "Catat stok di Keuangan → Pengeluaran dengan tujuan Stok. Tagihan belum dibayar tetap di Utang Usaha dan gudang terbarui otomatis.",
      addWriteOff: "Hapus Stok (Write-Off)",
      addWriteOffDesc:
        "Kurangi stok secara permanen dengan alasan yang wajib diisi. Hanya pengurangan — tidak boleh melebihi stok tersedia. Hanya OM+.",
      saveWriteOff: "Hapus Stok",
      addSoldOff: "Buat Faktur Penjualan",
      addSoldOffDesc:
        "Buat faktur penjualan untuk stok gudang. Pilih rekening bank — PDF dibuat otomatis. Unggah faktur pajak hanya untuk pembeli perusahaan. Mengurangi stok tersedia.",
      saveSoldOff: "Buat Faktur Penjualan",
      soldOffCreated: "Faktur penjualan telah dibuat.",
      createSoldOffFailed: "Tidak dapat membuat faktur penjualan.",
      searchSoldOffsFailed: "Tidak dapat mencari penjualan.",
      soldOffAssetQtyMismatch:
        "Jumlah aset peralatan yang dipilih harus sama dengan kuantitas penjualan.",
      soldOffSelectAssetsRequired:
        "Pilih unit peralatan yang dijual. Setiap unit sudah punya kode aset.",
      saleLossConfirmTitle: "Jual Dengan Rugi?",
      saleLossConfirmDescription:
        "Menjual item ini pada harga tersebut akan merugi. Apakah Anda yakin ingin melanjutkan?",
      searchingSoldOffs: "Mencari penjualan lama…",
      buyerTypeRequired: "Pilih Perorangan atau Perusahaan untuk pembeli.",
      buyerNameRequired: "Nama pembeli wajib diisi.",
      companyNameRequired: "Nama perusahaan wajib diisi.",
      buyerPicNameRequired: "Nama PIC wajib untuk pembeli perusahaan.",
      buyerPhoneRequired: "Nomor kontak pembeli wajib diisi.",
      buyerIdentityDocRequired:
        "Unggah faktur pajak untuk penjualan ini.",
      buyerTaxIdRequired:
        "NPWP perusahaan wajib untuk pembeli berbentuk perusahaan.",
      taxRateRequired: "Masukkan tarif pajak untuk penjualan ini.",
      taxAmountRequired: "Jumlah pajak penjualan harus lebih dari nol.",
      clientNotFound: "Klien yang ditautkan tidak ditemukan.",
      clientTypeMismatch:
        "Klien yang ditautkan harus sesuai dengan tipe pembeli yang dipilih.",
      searchClientsFailed: "Tidak dapat mencari klien.",
      deactivate: "Nonaktifkan",
      viewReceipt: "Lihat Bukti",
      viewSaleInvoice: "Lihat Faktur",
      viewBuyerIdentityDoc: "Lihat Faktur Pajak",
      saleDetailsTitle: "Detail Penjualan",
      saleDetailsDesc: "Detail lengkap untuk catatan penjualan ini.",
      saleDetailsLinkedClient: "Klien Tertaut",
      saleDetailsDocuments: "Dokumen",
      saleDetailsTaxInvoice: "Faktur Pajak",
      saleDetailsBuyerEmpty:
        "Tidak ada detail pembeli pada penjualan ini. Penjualan baru mencatat nama perusahaan/PIC atau identitas perorangan.",
      saleDetailsDocsEmpty: "Tidak ada dokumen terlampir.",
      saleDetailsExTaxHint: "Tidak termasuk pajak.",
      saleDetailsGainLossHint:
        "Laba/rugi memakai penjualan sebelum pajak vs dasar biaya sebelum pajak.",
      stockDetailTitle: "Detail Item Stok",
      stockDetailDesc:
        "Total dibeli, stok gudang, penugasan, penjualan, dan write-off untuk item ini.",
      stockDetailBought: "Dibeli (Sepanjang Waktu)",
      stockDetailAssigned: "Ditugaskan",
      stockDetailInStock: "Stok Gudang",
      stockDetailWrittenOff: "Dihapus (Write-Off)",
      stockDetailSold: "Terjual",
      stockDetailAssignmentsTitle: "Ditugaskan Per Proyek",
      stockDetailAssignmentsDesc:
        "Total sepanjang waktu per proyek (semua tanggal pengeluaran digabung). Pengeluaran yang dibatalkan tidak dihitung.",
      stockDetailEmptyAssignments: "Belum Ada Penugasan Proyek",
      stockDetailEmptyAssignmentsDesc:
        "Item ini belum dikeluarkan ke proyek mana pun.",
      stockDetailSalesTitle: "Terjual",
      stockDetailSalesDesc:
        "Kapan stok keluar dan kepada siapa. Buka Keuangan → Penjualan untuk faktur, pembayaran, dan harga.",
      stockDetailEmptySales: "Belum Ada Penjualan",
      stockDetailEmptySalesDesc: "Item ini belum pernah dijual.",
      stockDetailLoading: "Memuat detail item…",
      stockDetailLoadFailed: "Tidak dapat memuat detail item stok.",
      stockDetailSoldTo: "Dijual Kepada",
      stockDetailSoldAt: "Terjual",
      itemCreated: "Item katalog dibuat.",
      itemUpdated: "Item katalog diperbarui.",
      writeOffCreated: "Stok berhasil dihapus (write-off).",
      writeOffAssetsRequired:
        "Pilih unit peralatan yang akan dihapus. Setiap unit punya kode aset sendiri.",
      writeOffAssetQtyMismatch:
        "Jumlah unit peralatan yang dipilih harus sama dengan kuantitas write-off.",
      writeOffReversed: "Write-off dibatalkan. Stok dipulihkan.",
      reverseWriteOff: "Batalkan",
      reverseWriteOffTitle: "Batalkan Write-Off",
      reverseWriteOffDesc:
        "Pulihkan kuantitas ini ke stok tersedia dan aktifkan kembali aset peralatan terkait. Tindakan ini tidak dapat dibatalkan.",
      reverseWriteOffConfirm: "Batalkan Write-Off",
      reverseWriteOffFailed: "Tidak dapat membatalkan write-off.",
      writeOffAlreadyReversed: "Write-off ini sudah dibatalkan sebelumnya.",
      soldOffReversed: "Penjualan dibatalkan. Stok dipulihkan.",
      reverseSale: "Batalkan",
      reverseSaleTitle: "Batalkan Penjualan",
      reverseSaleDesc:
        "Pulihkan kuantitas ini ke stok tersedia dan aktifkan kembali aset peralatan terkait. Gunakan jika pembeli membatalkan pembelian. Tindakan ini tidak dapat dibatalkan.",
      reverseSaleConfirm: "Batalkan Penjualan",
      reverseSaleFailed: "Tidak dapat membatalkan penjualan.",
      saleAlreadyReversed: "Penjualan ini sudah dibatalkan sebelumnya.",
      itemNameRequired: "Nama item wajib diisi.",
      vehicleBrandRequired: "Masukkan merek kendaraan.",
      vehicleTypeRequired: "Masukkan tipe kendaraan.",
      itemTypeRequired: "Jenis item wajib diisi.",
      itemRequired: "Pilih item katalog.",
      projectRequired: "Pilih proyek.",
      itemNotFound: "Item katalog tidak ditemukan.",
      vendorNotFound: "Pemasok tidak ditemukan.",
      movementNotFound: "Pergerakan inventaris tidak ditemukan.",
      insufficientStock: "Stok tidak cukup. Tersedia: {available} {unit}.",
      insufficientUncodedStock:
        "Unit gudang baru tanpa kode aset tidak cukup. Tersedia: {available} {unit}.",
      insufficientEquipmentAssets:
        "Aset peralatan tersedia tidak cukup untuk write-off ini. Tersedia: {available}. Diperlukan: {requested}.",
      insufficientEquipmentAssetsForIssue:
        "Unit peralatan tersedia tidak cukup untuk dikeluarkan. Tersedia: {available}. Diperlukan: {requested}.",
      voidReasonRequired: "Alasan pembatalan wajib diisi.",
      writeOffReasonRequired: "Alasan write-off wajib diisi.",
      createItemFailed: "Tidak dapat membuat item katalog.",
      updateItemFailed: "Tidak dapat memperbarui item katalog.",
      deactivateItemFailed: "Tidak dapat menonaktifkan item katalog.",
      reactivateItemFailed: "Tidak dapat memulihkan item katalog.",
      voidFailed: "Tidak dapat membatalkan pergerakan.",
      createWriteOffFailed: "Tidak dapat mencatat write-off stok.",
      emptyPurchases: "Belum Ada Penerimaan Stok",
      emptyPurchasesDesc:
        "Catat pengeluaran produk dengan tujuan Stok di Keuangan → Pengeluaran. Stok gudang terbarui otomatis.",
      emptyIssues: "Belum Ada Pengeluaran Proyek",
      emptyIssuesDesc:
        "Pengeluaran ke proyek muncul di sini setelah Transfer Order ditandai terkirim. Ajukan stok melalui Permintaan Material → Persetujuan → Transfer Order.",
      emptyWriteOffs: "Belum Ada Write-Off",
      emptyWriteOffsDesc:
        "Write-off mengurangi stok secara permanen dengan alasan wajib yang tercatat.",
      emptySoldOffs: "Belum Ada Penjualan",
      emptySoldOffsDesc:
        "Buat faktur penjualan di Keuangan → Penjualan. Penjualan mengurangi stok gudang.",
      emptyStock: "Belum Ada Item Stok Aktif",
      emptyStockDesc:
        "Aktifkan item katalog dan catat penerimaan stok untuk melihat stok.",
      emptyAssetList: "Belum Ada Aset Peralatan Aktif",
      emptyAssetListDesc:
        "Aktifkan item katalog peralatan dan catat penerimaan stok untuk melihat aset yang dimiliki.",
      emptyVehicles: "Belum Ada Kendaraan",
      emptyVehiclesDesc:
        "Tambah tipe Vehicle di Katalog Barang, lalu catat setiap kendaraan di pengeluaran dengan plat dan tahunnya.",
      emptySearch: 'Tidak ada hasil untuk "{query}"',
      emptySearchDesc: "Coba nama item, SKU, pemasok, atau proyek lain.",
      tabs: {
        purchases: "Penerimaan Stok",
        issues: "Pengeluaran Proyek",
        stock: "Stok",
        assetList: "Daftar Aset",
        vehicles: "Kendaraan",
        writeOffs: "Penghapusan",
        factoryReturns: "Kembali Ke Pemasok"
      },
      stats: {
        purchasesSubtitle: "Stok masuk gudang (tanpa AP)",
        issuesSubtitle: "Ditetapkan ke proyek",
        stockSubtitle: "{low} di bawah stok minimum",
        assetListSubtitle: "{warehouse} di gudang · {owned} dimiliki",
        vehiclesSubtitle: "{count} kendaraan",
        writeOffsSubtitle: "Penghapusan stok permanen",
        factoryReturnsSubtitle: "Menunggu di pemasok"
      },
      projectIssues: {
        selectHint: "Pilih proyek untuk melihat inventaris yang dikeluarkan.",
        backToProjects: "Kembali Ke Proyek",
        issueCountOne: "1 Pengeluaran",
        issueCountOther: "{count} Pengeluaran",
        deployCountOne: "1 Diterjunkan",
        deployCountOther: "{count} Diterjunkan",
        totalCost: "Total Biaya {amount}",
        emptyProjects: "Belum Ada Proyek Dengan Pengeluaran",
        emptyProjectsDesc:
          "Keluarkan stok ke proyek agar muncul di daftar ini.",
        emptyProjectRows: "Belum Ada Pengeluaran Untuk Proyek Ini",
        emptyProjectRowsDesc:
          "Tidak ada item yang cocok dengan filter saat ini untuk proyek ini."
      },
      stock: {
        itemClickHint:
          "Klik item stok untuk melihat dibeli, stok gudang, ditugaskan, terjual, dan dihapus — plus kepada siapa dijual.",
        equipmentClickHint:
          "Klik item peralatan untuk membuka halaman produk, termasuk Kembali Ke Pemasok."
      },
      overview: {
        categoryEquipment: "Peralatan",
        categoryVehicles: "Kendaraan",
        categorySpareParts: "Suku Cadang",
        categoryChemicals: "Bahan Kimia",
        categoryConsumables: "Bahan Habis Pakai",
        categoryOthers: "Lainnya",
        assetCode: "Kode Aset",
        numberPlate: "Nomor Plat",
        location: "Lokasi",
        locationWarehouse: "Gudang",
        locationOnProject: "Di Proyek",
        serialNo: "No. Seri",
        acquisitionCost: "Biaya Perolehan",
        showSold: "Tampilkan Terjual",
        showWrittenOff: "Tampilkan Dihapus",
        emptyAssets: "Tidak ada unit peralatan aktif.",
        retired: "Pensiun",
        sold: "Terjual",
        soldTo: "Dijual Kepada",
        writtenOff: "Dihapus"
      },
      saleSource: {
        label: "Apa Yang Dijual?",
        required: "Pilih Baru Di Gudang atau Aset Yang Sudah Dikeluarkan.",
        placeholder: "Pilih Baru Atau Dikeluarkan",
        newInWarehouse: "Baru Di Gudang",
        issuedAsset: "Aset Yang Sudah Dikeluarkan",
        newHint:
          "{available} unit tersegel di gudang. Jual berdasarkan jumlah. Tanpa kode aset.",
        issuedHint:
          "Pilih unit yang sudah berkode. Lokasi adalah nama proyek, atau Head Office jika unit sudah kembali.",
        chooseHint:
          "Kotak baru tersegel tidak punya kode aset. Unit yang sudah dikeluarkan tetap memakai kodenya."
      },
      product: {
        description:
          "Stok gudang, unit berkode, penjualan, dan Kembali Ke Pemasok untuk peralatan ini.",
        backToInventory: "Kembali Ke Inventaris",
        newInWarehouse: "Baru Di Gudang",
        headOfficeUsed: "Head Office — Bekas",
        headOffice: "Head Office",
        inTransit: "Dalam Pengiriman",
        assetList: "Daftar Aset",
        assetListHint:
          "Kotak gudang baru tidak punya kode aset. Unit yang sudah dikeluarkan menampilkan kode dan lokasi.",
        newNoCode: "Baru — tanpa kode aset",
        newStockRow: "{qty} Baru — tanpa kode aset",
        soldNew: "Terjual — Baru, tanpa kode aset",
        soldNewNoCode: "Terjual — Baru, tanpa kode aset",
        soldNewRow: "{qty} Terjual — Baru, tanpa kode aset"
      },
      vehicles: {
        clickHint:
          "Klik kendaraan untuk melihat dan mengedit plat, tahun, dan detailnya.",
        back: "Kembali Ke Inventaris",
        locationCompany: "Perusahaan",
        updated: "Kendaraan diperbarui.",
        updateFailed: "Tidak dapat memperbarui kendaraan ini.",
        notFound: "Kendaraan tidak ditemukan.",
        plateTaken: "Nomor plat ini sudah tercatat."
      },
      factoryReturn: {
        title: "Kembali Ke Pemasok",
        send: "Kembali Ke Pemasok",
        sendDesc:
          "Kirim kotak gudang baru atau unit berkode. Refund ditutup sekarang. Repair atau Replace tetap terbuka sampai ada yang kembali.",
        sent: "Dikirim Ke Pemasok.",
        sendFailed: "Tidak dapat mengirim unit ini ke pemasok.",
        updated: "Pengembalian ke pemasok diperbarui.",
        updateFailed: "Tidak dapat memperbarui pengembalian ke pemasok ini.",
        permissionDenied:
          "Hanya Direktur atau pemilik yang dapat mengirim peralatan ke pemasok.",
        reasonRequired: "Isi alasan pengembalian ke pemasok.",
        intentRequired: "Pilih Refund, Repair, atau Replace.",
        sourceRequired: "Pilih Baru Di Gudang atau Aset Yang Sudah Dikeluarkan.",
        refundAmountRequired: "Isi jumlah refund dari pemasok.",
        assetsRequired: "Pilih unit berkode yang akan dikirim.",
        insufficientNew:
          "Unit gudang baru tanpa kode aset tidak cukup.",
        insufficientStock: "Stok gudang tidak cukup untuk pengembalian ke pemasok ini.",
        notFound: "Pengembalian ke pemasok tidak ditemukan.",
        notWaiting: "Pengembalian ke pemasok ini sudah ditutup.",
        refundFailed: "Tidak dapat mencatat refund pemasok.",
        repairFailed: "Tidak dapat mengonfirmasi unit yang sudah diperbaiki.",
        replaceFailed: "Tidak dapat menerima unit pengganti.",
        sentAt: "Dikirim",
        unit: "Unit",
        intent: "Tindakan Pemasok",
        reason: "Alasan",
        source: "Apa Yang Dikirim?",
        assets: "Aset Yang Sudah Dikeluarkan",
        refundAmount: "Jumlah Refund",
        recordRefund: "Catat Refund",
        recordRefundDesc:
          "Tutup pengembalian ini. Stok tetap berkurang. Jumlah refund dicatat di sini.",
        confirmRepaired: "Konfirmasi Diperbaiki",
        receiveReplacement: "Pengganti Diterima",
        vendorOptional: "Pemasok (Opsional)",
        newNoCode: "{qty} Baru — tanpa kode aset",
        newHint:
          "{available} unit tersegel tersedia. Jika diperbaiki, kembali tanpa kode.",
        issuedHint:
          "Pilih unit berkode. Repair memakai kode yang sama di Head Office. Pengganti masuk sebagai stok baru tanpa kode.",
        productHint:
          "Pengembalian yang masih menunggu selalu menampilkan Catat Refund, Konfirmasi Diperbaiki, dan Pengganti Diterima.",
        empty: "Belum Ada Pengembalian Ke Pemasok",
        emptyDesc:
          "Buka halaman produk peralatan untuk mengirim unit ke pemasok.",
        emptyDescDirector:
          "Buka item peralatan dari Daftar Aset untuk mengirim unit ke pemasok.",
        listHint:
          "Buka nama peralatan untuk mengirim unit atau menutup pengembalian yang masih menunggu.",
        intents: {
          REFUND: "Refund",
          REPAIR: "Repair",
          REPLACE: "Replace"
        },
        statuses: {
          WAITING: "Dikembalikan Ke Pemasok",
          REPAIRED: "Diperbaiki",
          REPLACED: "Diganti",
          REFUNDED: "Direfund"
        }
      },

      import: {
        noDataRows:
          "Tidak ada baris data di spreadsheet. Tambah baris di bawah header.",
        invalidRow: "Baris tidak valid.",
        duplicateInFile:
          "Item katalog “{name}” ({itemType}) duplikat di file ini atau sudah ada.",
        duplicateSkipped:
          "Melewati item katalog duplikat “{name}” ({itemType}).",
        skuAssignedOnSave:
          "SKU akan ditetapkan dari Jenis Item saat Anda konfirmasi."
      },
      columns: {
        sku: "SKU",
        plate: "Nomor Plat",
        vehicleYear: "Tahun",
        dateBought: "Tanggal Beli",
        item: "Item",
        status: "Status",
        actions: "Aksi",
        date: "Tanggal",
        vendor: "Pemasok",
        qty: "Kuantitas",
        unitPrice: "Harga Satuan",
        total: "Total",
        invoice: "Invoice",
        project: "Proyek",
        unitCost: "Biaya Satuan",
        projectCost: "Biaya Proyek",
        totalCost: "Total Biaya",
        onHand: "Stok",
        warehouseOnHand: "Gudang",
        owned: "Dimiliki",
        minStock: "Stok Min",
        avgCost: "Biaya Rata-Rata",
        lastCost: "Biaya Terakhir",
        valueOnHand: "Nilai Stok",
        valueOwned: "Nilai Dimiliki",
        writeOffValue: "Nilai Dihapus",
        writeOffReason: "Alasan Write-Off",
        writtenOffBy: "Dihapus Oleh",
        saleSubtotal: "Penjualan (Sebelum Pajak)",
        saleTotal: "Total Penjualan",
        costBasis: "Dasar Biaya (Sebelum Pajak)",
        gainLoss: "Laba / Rugi",
        saleInvoice: "Faktur Penjualan",
        buyer: "Pembeli",
        soldBy: "Dijual Oleh",
        notes: "Catatan"
      },
      form: {
        itemType: "Jenis Item",
        itemTypePlaceholder: "Pilih Jenis Item",
        itemTypeHint: "Klasifikasi item katalog (bukan penerimaan stok).",
        itemName: "Nama Item",
        itemNamePlaceholder: "mis. Pembersih Lantai 5L",
        vehicleBrand: "Merek",
        vehicleBrandPlaceholder: "mis. Mercedes-Benz",
        vehicleBrandHint: "Pabrikan tipe kendaraan ini.",
        vehicleType: "Tipe",
        vehicleTypePlaceholder: "mis. E300",
        vehicleTypeHint: "Tipe model, misalnya E300 atau S400.",
        vehicleBrandAndType: "Merek Dan Tipe",
        vehicleBrandAndTypeHint:
          "Merek lalu tipe, misalnya Mercedes-Benz E300.",
        vehiclePlate: "Nomor Plat",
        vehiclePlatePlaceholder: "mis. B 1234 ABC",
        vehiclePlateEditHint:
          "Ubah plat di sini. Tipe kendaraan yang sama bisa punya banyak plat.",
        vehicleYear: "Tahun Kendaraan",
        vehicleYearPlaceholder: "mis. 2024",
        vehicleYearHint: "Tahun model kendaraan ini.",
        catalogOnlyVehicleHint:
          "Ini hanya membuat tipe kendaraan. Catat setiap plat dan tahun saat menambah pengeluaran, lalu edit di Inventaris → Kendaraan.",
        sku: "SKU",
        skuHint:
          "Dibuat sistem dari Jenis Item saat disimpan (mis. TOOL-001, CNS-002). Tidak diisi manual.",
        skuPickType: "Pilih Jenis Item untuk pratinjau SKU",
        skuLoading: "Memuat…",
        skuReadonlyHint:
          "SKU ditetapkan dari Jenis Item saat dibuat dan tidak dapat diubah.",
        itemTypeLockedHint:
          "Jenis item ditetapkan saat dibuat dan tidak dapat diubah.",
        description: "Deskripsi",
        descriptionPlaceholder: "Catatan opsional tentang item katalog ini.",
        catalogOnlyHint:
          "Ini hanya membuat entri katalog. Gunakan Penerimaan Stok untuk menambah stok gudang.",
        unit: "Satuan",
        unitHint:
          "Cara stok dihitung: pcs, dus, kilogram, liter, dan satuan gudang lainnya.",
        minStock: "Stok Minimum",
        minStockHint: "Ambang peringatan stok rendah di tab Stok.",
        catalogItem: "Item Katalog",
        catalogItemPlaceholder: "Pilih Item Katalog",
        catalogItemSearchPlaceholder: "Cari nama, SKU, atau tipe…",
        catalogItemNoSearchMatch: "Tidak ada item berstok yang cocok dengan pencarian ini.",
        soldOffNoStockForType:
          "Tidak ada item stok jenis ini yang tersedia untuk dijual.",
        quantity: "Kuantitas",
        notes: "Catatan",
        issueItemHint: "Hanya item yang punya stok yang ditampilkan.",
        equipmentDeployed: "Diterjunkan",
        writeOffDate: "Tanggal Write-Off",
        writeOffReason: "Alasan Write-Off",
        writeOffReasonPlaceholder: "Jelaskan mengapa stok ini dihapus (rusak, kedaluwarsa, hilang, dsb.).",
        writeOffReasonHint: "Wajib diisi. Alasan ini dicatat permanen di jejak audit.",
        writeOffItemHint: "Stok tersedia: {available} {unit}. Write-off tidak boleh melebihi jumlah ini.",
        writeOffAssets: "Aset Peralatan",
        writeOffNoAssets: "Tidak ada unit peralatan gudang yang bisa dihapus.",
        writeOffAssetsHint:
          "Pilih unit yang tepat. Write-off tidak boleh memilih unit sendiri.",
        reverseWriteOffReason: "Alasan Pembatalan",
        reverseWriteOffReasonPlaceholder:
          "Catatan opsional mengapa write-off ini dibatalkan.",
        reverseWriteOffReasonHint:
          "Opsional. Nama Anda dan waktu pembatalan dicatat otomatis.",
        reverseSaleReason: "Alasan Pembatalan",
        reverseSaleReasonPlaceholder:
          "Catatan opsional mengapa penjualan ini dibatalkan (misalnya pembeli membatalkan).",
        reverseSaleReasonHint:
          "Opsional. Nama Anda dan waktu pembatalan dicatat otomatis.",
        saleDate: "Tanggal Penjualan",
        saleUnitPrice: "Harga Jual Satuan (Sebelum Pajak)",
        saleUnitPriceExTaxHint:
          "Masukkan harga satuan sebelum pajak. Pajak dihitung dari tarif di bawah.",
        saleSubtotal: "Subtotal (Sebelum Pajak)",
        saleTaxAmount: "Jumlah Pajak",
        saleTotal: "Total Penjualan (Termasuk Pajak)",
        saleVatExclusivePreview:
          "DPP {dpp} + Pajak {tax} ({rate}%) = {total}.",
        taxRate: "Tarif Pajak (%)",
        taxRatePlaceholder: "mis. 12",
        taxRateHint:
          "Nilai bawaan 11%. Ubah jika faktur memakai tarif pajak yang berbeda.",
        linkClient: "Tautkan Klien (Opsional)",
        clientSearchPlaceholder: "Cari klien berdasarkan nama, kode, atau NPWP…",
        clientOptionalPlaceholder: "Pilih Klien (Opsional)",
        clientNoSearchMatch: "Tidak ada klien yang cocok dengan pencarian ini.",
        linkClientHint:
          "Opsional. Mengisi nama pembeli dan NPWP perusahaan dari direktori klien.",
        linkClientHintCompany:
          "Opsional. Hanya menampilkan klien perusahaan. Mengisi nama pembeli dan NPWP.",
        linkClientHintIndividual:
          "Opsional. Hanya menampilkan klien perorangan. Mengisi nama pembeli.",
        buyerType: "Tipe Pembeli",
        buyerTypeIndividual: "Perorangan",
        buyerTypeCompany: "Perusahaan",
        buyerTypeHint:
          "Pilih tipe pembeli terlebih dahulu. Tautkan Klien dan detail pembeli muncul setelahnya.",
        buyer: "Nama Pembeli",
        buyerPlaceholder: "Nama pembeli",
        buyerManualHint:
          "Wajib. Isi pembeli sekali pakai, atau pertahankan/edit nama dari klien yang ditautkan.",
        companyName: "Nama Perusahaan",
        companyNamePlaceholder: "Nama perusahaan / pembeli",
        companyNameHint:
          "Wajib. Isi nama perusahaan, atau pertahankan/edit dari klien yang ditautkan.",
        buyerPicName: "Nama PIC",
        buyerPicNamePlaceholder: "Penanggung jawab",
        buyerPicNameHint: "Wajib. Narahubung di perusahaan.",
        buyerPhone: "Nomor Kontak",
        buyerPhonePlaceholder: "mis. 0812 3456 7890",
        buyerPhoneHint: "Wajib. Nomor telepon atau WhatsApp pembeli.",
        buyerPhoneHintCompany:
          "Wajib. Nomor telepon atau WhatsApp PIC.",
        buyerIdentityDoc: "Faktur Pajak",
        buyerIdentityDocHint:
          "Wajib untuk pembeli perusahaan. Unggah faktur pajak saja — PDF faktur penjualan dibuat otomatis.",
        buyerTaxId: "NPWP Perusahaan",
        buyerTaxIdIndividual: "NPWP",
        buyerTaxIdPlaceholder: "NPWP 15 Atau 16 Digit",
        buyerIdNumber: "NIK / KTP",
        buyerIdNumberPlaceholder: "NIK 16 Digit",
        buyerIdentityEitherHint:
          "Wajib: isi NPWP atau NIK / KTP — minimal salah satu.",
        soldOffItemHint:
          "Stok tersedia: {available} {unit}. Penjualan tidak boleh melebihi jumlah ini.",
        soldOffEquipmentHint:
          "Gudang {warehouse} · Di lokasi {onSite}. Pilih kode aset yang dijual.",
        soldOffAssets: "Aset Peralatan",
        soldOffNoAssets: "Tidak ada unit di gudang atau di lokasi untuk item ini.",
        soldOffAssetsHint:
          "Wajib. Pilih unit yang tepat. Unit di lokasi ditandai terjual di sana — tidak dikembalikan ke gudang dulu. Kode aset tetap sama.",
        soldOffOnSite: "Di Lokasi · {project}",
        soldOffNotesPlaceholder: "Catatan opsional tentang penjualan ini."
      },
      itemTypes: {
        Consumable: "Bahan Habis Pakai",
        Equipment: "Peralatan",
        Vehicle: "Kendaraan",
        "Spare Part": "Suku Cadang",
        Chemical: "Bahan Kimia",
        Other: "Lainnya"
      },
      units: {
        pcs: "Pcs",
        unit: "Unit",
        pair: "Pasang",
        set: "Set",
        roll: "Gulung",
        box: "Dus",
        carton: "Karton",
        pack: "Pak",
        bag: "Karung",
        sack: "Sak",
        drum: "Drum",
        bottle: "Botol",
        can: "Kaleng",
        kg: "Kilogram",
        g: "Gram",
        ton: "Ton",
        l: "Liter",
        ml: "Mililiter",
        m: "Meter",
        cm: "Sentimeter",
        m2: "Meter Persegi"
      }
    },
    itemCatalog: {
      title: "Katalog Barang",
      directoryTitle: "Katalog Barang",
      directoryDesc:
        "Tetapkan tipe barang dan SKU yang dipakai Inventaris dan pengeluaran.",
      companyNotFound: "Perusahaan tidak ditemukan.",
      permissionDenied: "Anda tidak memiliki izin untuk mengelola katalog barang.",
      searchPlaceholder: "Cari item, SKU, tipe…",
      addItem: "Tambah Item",
      importExcel: "Impor Excel",
      bulkCreateTitle: "Tambah item katalog secara massal",
      bulkCreateDesc:
        "Pilih jenis item, lalu tambah setiap item. Setiap item mendapat SKU sendiri.",
      bulkCreateSharedHint: "Setiap baris di bawah dibuat sebagai jenis item ini.",
      bulkCreateSkuHint:
        "Ditetapkan saat disimpan. Setiap item mendapat SKU bebas berikutnya untuk jenis ini.",
      bulkCreateItems: "Item",
      bulkCreateItemsHint:
        "Setiap baris adalah satu item katalog dengan SKU sendiri. Deskripsi opsional.",
      bulkCreateSuccess: "Berhasil menambah {count} item katalog.",
      deactivate: "Nonaktifkan",
      delete: "Hapus",
      deleteConfirm:
        "Hapus “{name}”? Item yang belum dipakai dihapus permanen. Item yang punya riwayat pembelian/stok diarsipkan agar riwayat tetap ada.",
      itemDeactivated: "Item katalog dinonaktifkan.",
      itemReactivated: "Item katalog dipulihkan.",
      itemDeleted: "Item katalog dihapus.",
      deactivateItemFailed: "Gagal menonaktifkan item katalog.",
      reactivateItemFailed: "Gagal memulihkan item katalog.",
      deleteItemFailed: "Gagal menghapus item katalog.",
      emptyItems: "Belum Ada Item Katalog",
      emptyItemsDesc: "Tambah item ke katalog sebelum mencatat penerimaan stok.",
      emptySearch: 'Tidak ada hasil untuk "{query}"',
      emptySearchDesc: "Coba nama item, SKU, atau tipe lain.",
      stats: {
        activeTitle: "Item Aktif",
        activeSubtitle: "{inactive} nonaktif",
        totalTitle: "Total Item",
        totalSubtitle: "Entri katalog aktif dan nonaktif"
      },
      status: {
        active: "Aktif",
        inactive: "Nonaktif"
      },
      columns: {
        sku: "SKU",
        item: "Item",
        itemType: "Tipe Item",
        status: "Status",
        actions: "Tindakan"
      }
    },
    companyDetails: {
      title: "Detail Perusahaan",
      description:
        "Identitas kantor yang dipakai pada invoice, laporan progress, dan kop surat.",
      directoryTitle: "Detail Perusahaan",
      directoryDesc:
        "Ini sumber tunggal untuk nama perusahaan, situs web, alamat kantor, dan kontak yang tercetak pada dokumen yang dihasilkan.",
      companyNotFound: "Perusahaan tidak ditemukan.",
      permissionDenied: "Hanya pemilik yang dapat mengubah Detail Perusahaan.",
      nameRequired: "Nama perusahaan wajib diisi.",
      websiteInvalid: "Masukkan alamat situs web yang valid.",
      saved: "Detail Perusahaan disimpan.",
      saveFailed: "Tidak dapat menyimpan Detail Perusahaan.",
      sections: {
        identity: "Identitas",
        identityHint:
          "Tercetak pada invoice, laporan progress, dan kop surat lainnya.",
        contact: "Kontak",
        contactHint: "Alamat kantor dan cara klien menghubungi perusahaan.",
        tax: "Pajak",
        bank: "Bank",
        bankHint:
          "Rekening penerima yang tercetak pada invoice. Tambahkan setiap rekening yang dapat dibayar klien."
      },
      form: {
        name: "Nama Perusahaan",
        website: "Situs Web Perusahaan",
        websitePlaceholder: "https://www.rgs.co.id",
        address: "Alamat Kantor",
        addressPlaceholder: "Jalan kantor, blok, kota, dan kode pos",
        addressHint:
          "Satu baris per baris alamat, sesuai yang muncul di kop surat.",
        phone: "Telepon",
        email: "Email",
        npwp: "NPWP",
        npwpHint: "NPWP perusahaan. Tercetak pada kop surat jika diisi.",
        bankName: "Nama Bank",
        bankAccountNumber: "Nomor Rekening",
        bankAccountName: "Pemilik Rekening",
        bankLabel: "Label",
        bankLabelHint: "Opsional. Contoh: Operasional, Pajak, atau Transfer Proyek."
      },
      bank: {
        add: "Tambah Rekening Bank",
        addTitle: "Tambah Rekening Bank",
        addDesc:
          "Rekening ini dapat tercetak pada invoice dan dipakai di Laporan Keuangan.",
        editTitle: "Ubah Rekening Bank",
        editDesc:
          "Perbarui rincian yang tercetak pada invoice baru yang memakai rekening ini.",
        save: "Simpan Rekening Bank",
        saved: "Rekening Bank disimpan.",
        saveFailed: "Tidak dapat menyimpan rekening bank.",
        deleted: "Rekening Bank dihapus.",
        deleteFailed: "Tidak dapat menghapus rekening bank.",
        notFound: "Rekening bank tidak ditemukan.",
        fieldRequired: "{field} wajib diisi.",
        cannotDeleteOpen:
          "Rekening ini masih terpasang pada invoice yang belum dibayar atau masih terbuka. Pilih rekening lain pada invoice tersebut terlebih dahulu, lalu hapus.",
        empty: "Belum Ada Rekening Bank",
        emptyDesc:
          "Tambahkan rekening bank agar invoice dapat mencetak tujuan pembayaran klien.",
        columns: {
          bankName: "Nama Bank",
          accountNumber: "Nomor Rekening",
          accountHolder: "Pemilik Rekening",
          label: "Label",
          actions: "Aksi"
        }
      }
    }
  },

  modules: {
    dashboard: "Dasbor",
    projects: "Proyek",
    teams: "Tim",
    progress: "Laporan Progress",
    cico: "CICO",
    pettyCash: "Kas Kecil",
    attendance: "Laporan Kehadiran",
    shifts: "Shift",
    leaves: "Izin & Sakit",
    approvals: "Persetujuan",
    materialRequests: "Permintaan Material",
    transferOrders: "Transfer Barang",
    reports: "Laporan Klien",
    inventory: "Inventaris",
    itemCatalog: "Katalog Barang",
    invoicing: "Invoice & Penagihan",
    reconciliation: "Rekonsiliasi",
    purchaseInvoices: "Pengeluaran",
    loans: "Pinjaman",
    bpjs: "BPJS",
    sales: "Penjualan",
    taxInvoices: "Pajak",
    vendorPayments: "Pembayaran & Pelunasan",
    thr: "THR",
    payroll: "Payroll Internal",
    financialReport: "Laporan Keuangan",
    clients: "Klien",
    vendors: "Pemasok",
    users: "Pengguna",
    employees: "Karyawan",
    departments: "Departemen",
    settings: "Detail Perusahaan",
    website: "CMS Situs Web"
  },

  bulkImport: {
    inventoryItemsTitle: "Impor katalog barang dari Excel",
    downloadExcelTemplate: "Template Excel",
    preparingTemplate: "Menyiapkan template…",
    invalid: "Tidak valid",
    duplicate: "Duplikat",
    willAdd: "Akan ditambah",
    willAddWithWarning: "Akan ditambah · peringatan",
    reviewImport: "Tinjau impor",
    readingFile: "Membaca file...",
    confirmAdd: "Konfirmasi tambah",
    confirmAddCount: "Konfirmasi tambah ({count})",
    dropFile: "Jatuhkan file di sini atau telusuri",
    chooseDifferent: "Ketuk untuk memilih file Excel lain",
    acceptsXlsx: "Menerima .xlsx · berfungsi di desktop dan ponsel",
    uploadDescription:
      "Unggah template Excel yang sudah diisi untuk membuat banyak {plural} sekaligus. Anda akan meninjau pratinjau sebelum data dibuat.",
    previewDescription:
      "Tinjau setiap baris di bawah. Baris bertanda “Akan ditambah” (termasuk peringatan) dibuat saat Anda mengonfirmasi.",
    taxIdDocumentRequiredCompany: "Unggah dokumen NPWP.",
    taxIdDocumentRequiredIndividual: "Unggah dokumen NPWP atau NIK.",
    noExtraDetails: "Tidak ada detail tambahan",
    rowLabel: "Baris {row}: {name}",
    rowIssue: "Baris {row}: {message}",
    skipped: "Dilewati",
    failed: "Gagal",
    invalidSkipped: "Baris tidak valid tidak akan dibuat.",
    createdInventoryItemsNote:
      "Hanya item katalog — SKU ditetapkan dari Jenis Item (mis. TOOL-001). Catat penerimaan stok terpisah untuk menambah stok.",
    uploadExcelRequired: "Unggah file Excel (.xlsx).",
    chooseExcel: "Pilih file Excel untuk diunggah.",
    noDataRows:
      "Tidak ada baris data di spreadsheet. Tambahkan baris di bawah header.",
    invalidRow: "Baris tidak valid.",
    invalidReviewResponse: "Tinjauan impor mengembalikan respons tidak valid.",
    reviewFailed: "Tidak dapat meninjau file impor {plural}.",
    importFailed: "Tidak dapat mengimpor {plural}.",
    templateDownloadFailed: "Tidak dapat mengunduh template Excel.",
    templateEmpty: "Template Excel kosong. Silakan coba lagi."
  },

  auth: {
    signIn: "Masuk",
    signingIn: "Sedang masuk...",
    forgotPassword: "Lupa kata sandi",
    forgotPasswordQuestion: "Lupa kata sandi?",
    saveAndContinue: "Simpan dan lanjutkan",
    savePasswordAndContinue: "Simpan kata sandi dan lanjutkan",
    saveAndSignIn: "Simpan dan masuk",
    settingUp: "Menyiapkan...",
    sending: "Mengirim...",
    sendResetLink: "Kirim tautan reset",
    updatePassword: "Perbarui kata sandi",
    backToLogin: "Kembali ke masuk",
    welcomeBack: "Selamat Datang Kembali",
    signInSubtitle:
      "Masuk untuk mengelola ruang kerja, proyek, dan operasi bisnis Anda.",
    username: "Nama pengguna",
    password: "Kata sandi",
    enterPassword: "Masukkan kata sandi Anda",
    showPassword: "Tampilkan kata sandi",
    hidePassword: "Sembunyikan kata sandi",
    protectedBy: "Dilindungi oleh RGS ONE Identity",
    firstTimeSigningIn: "Pertama kali masuk?",
    enterpriseEdition: "Edisi Enterprise",
    version: "Versi {version}",
    heroKicker: "Dibangun untuk tim layanan",
    heroTitle: "Jalankan operasi Anda",
    heroTitleAccent: "dengan kejelasan.",
    heroSubtitle:
      "Dari progres lokasi harian hingga absensi tim — semua kebutuhan bisnis cleaning Anda, terhubung.",
    highlightProjects: "Proyek, staf, dan lokasi dalam satu tampilan",
    highlightProgress: "Pelacakan progres harian dan absensi",
    highlightLeaves: "Permintaan cuti dan persetujuan",
    invalidCredentials: "Nama pengguna atau kata sandi tidak valid.",
    signInFailed: "Kami tidak dapat memproses masuk Anda. Silakan coba lagi.",
    passwordUpdated: "Kata sandi Anda telah diperbarui. Anda dapat masuk sekarang.",
    forgotTitle: "Lupa kata sandi",
    forgotSubtitle:
      "Masukkan nama pengguna Anda. Jika akun ada, kami akan mengirim tautan reset ke email pemulihan yang diatur administrator.",
    forgotSuccess:
      "Jika akun dengan nama pengguna itu ada, tautan reset kata sandi telah dikirim ke email pemulihan yang terdaftar.",
    forgotNoEmail:
      "Akun ini tidak memiliki email pemulihan. Silakan hubungi administrator Anda.",
    forgotSendFailed:
      "Kami tidak dapat mengirim email reset. Periksa pengaturan SMTP atau coba lagi nanti.",
    forgotFailed: "Kami tidak dapat memproses permintaan Anda. Silakan coba lagi.",
    resetTitle: "Atur kata sandi baru",
    resetSubtitle: "Pilih kata sandi baru untuk akun Anda.",
    resetInvalidTitle: "Tautan reset tidak valid",
    resetInvalidSubtitle: "Tautan reset kata sandi ini hilang atau tidak valid.",
    resetInvalidToken:
      "Tautan reset ini tidak valid atau sudah kedaluwarsa. Silakan minta yang baru.",
    resetFailed: "Kami tidak dapat mengatur ulang kata sandi Anda. Silakan coba lagi.",
    requestNewResetLink: "Minta tautan reset baru",
    firstLoginTitle: "Siapkan akun Anda",
    firstLoginSubtitle:
      "Pertama kali masuk? Pilih kata sandi dan email pemulihan untuk menyelesaikan pengaturan akun.",
    finishSetupTitle: "Selesaikan pengaturan akun",
    createPasswordTitle: "Buat kata sandi Anda",
    welcomeName: "Selamat datang, {name}.",
    finishSetupSubtitle:
      "Pilih kata sandi baru dan email pemulihan untuk menyelesaikan pengaturan akun.",
    createPasswordSubtitle:
      "Pilih kata sandi baru untuk menyelesaikan pengaturan akun.",
    recoveryEmail: "Email pemulihan",
    recoveryEmailHelp:
      "Hanya digunakan untuk reset kata sandi jika Anda lupa kata sandi.",
    recoveryEmailTitle: "Tambahkan email pemulihan",
    recoveryEmailSubtitle:
      "Tambahkan email pemulihan sebelum melanjutkan. Hanya digunakan jika Anda perlu mengatur ulang kata sandi.",
    signedInAs: "Masuk sebagai {username}",
    yourUsername: "Nama pengguna Anda",
    newPassword: "Kata sandi baru",
    confirmPassword: "Konfirmasi kata sandi",
    enterNewPassword: "Masukkan kata sandi baru",
    confirmNewPassword: "Konfirmasi kata sandi baru",
    passwordsDoNotMatch: "Kata sandi tidak cocok.",
    passwordTooShort: "Kata sandi minimal 8 karakter.",
    invalidRecoveryEmail: "Masukkan alamat email pemulihan yang valid.",
    recoveryEmailTaken: "Email pemulihan itu sudah digunakan.",
    savePasswordFailed: "Kami tidak dapat menyimpan kata sandi Anda. Silakan coba lagi.",
    saveRecoveryFailed:
      "Kami tidak dapat menyimpan email pemulihan Anda. Silakan coba lagi.",
    setupFailed: "Kami tidak dapat menyiapkan akun Anda. Silakan coba lagi.",
    accountAlreadySetUp:
      "Akun ini sudah memiliki kata sandi. Silakan masuk saja.",
    accountDeleted: "Akun ini telah dihapus. Hubungi administrator Anda.",
    accountNotFound: "Tidak ada akun untuk nama pengguna tersebut."
  },

  bulkCreate: {
    sharedTerms: "Ketentuan bersama",
    addLine: "Tambah baris",
    addFiveLines: "Tambah 5 baris",
    removeLine: "Hapus",
    lineNumber: "Baris {n}",
    maxLinesReached: "Anda dapat menambah hingga {max} baris.",
    emptyLines: "Tambah setidaknya satu baris yang lengkap.",
    lineError: "Baris {n}: {message}",
    addCount: "Tambah {count}",
    addingCount: "Menambah {count}…"
  },

  validation: {
    invalidEmail: "Masukkan alamat email yang valid.",
    npwpInvalid:
      "NPWP / NPWP Perusahaan harus 15 atau 16 digit (titik, strip, dan spasi opsional).",
    npwpOrNikInvalid:
      "NPWP Atau NIK Klien harus 15 atau 16 digit (titik, strip, dan spasi opsional).",
    npwpRequired: "NPWP wajib diisi.",
    npwpOrNikRequired: "NPWP atau NIK wajib diisi.",
    fieldInvalid: "{field} tidak valid."
  }
} as const satisfies DeepStringLeaves<EnMessages>;
