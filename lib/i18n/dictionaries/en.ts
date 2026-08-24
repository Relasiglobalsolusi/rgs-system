/** English UI messages — nested dictionary (source of truth for keys). */
export const en = {
  header: {
    today: "Today",
    language: "Language",
    english: "English",
    bahasaIndonesia: "Bahasa Indonesia",
    theme: "Theme",
    light: "Light",
    dark: "Dark",
    goodMorning: "Good Morning",
    goodAfternoon: "Good Afternoon",
    goodEvening: "Good Evening",
    guest: "Guest",
    user: "User",
    signOut: "Sign Out",
    signOutConfirm: "Are you sure you want to sign out?",
    dashboardAria: "RGS ONE — Dashboard"
  },

  ui: {
    clearSearch: "Clear Search",
    countryCode: "Country Code",
    phoneExcludeCountryCode: "Please exclude country code",
    moreActions: "More Actions",
    dragToReorder: "Drag To Reorder",
    reorder: "Reorder",
    previousPhoto: "Previous Photo",
    nextPhoto: "Next Photo",
    noRecordsFound: "No records found.",
    proofPreview: {
      description:
        "View attached proof. Press Escape or click outside to close."
    },
    rejectionNotice: {
      title: "Action could not be completed",
      description: "Review the issue below, revise as needed, then try again.",
      acknowledge: "OK",
      importTitle: "Import rows need attention",
      importDescription:
        "These rows were not accepted. Fix them in your Excel file, then upload again.",
      validationTitle: "Please revise and try again",
      validationDescription:
        "Something needs to be corrected before this can continue.",
      serverUnreachable:
        "Could not reach the server. Check that the app is running and try again."
    }
  },

  common: {
    actions: {
      add: "Add",
      edit: "Edit",
      delete: "Delete",
      save: "Save",
      cancel: "Cancel",
      close: "Close",
      confirm: "Confirm",
      clear: "Clear",
      back: "Back",
      submit: "Submit",
      approve: "Approve",
      reject: "Reject",
      restore: "Restore",
      download: "Download",
      upload: "Upload",
      view: "View",
      addBulk: "Add Bulk",
      saveChanges: "Save Changes",
      deleteSelected: "Delete Selected",
      restoreSelected: "Restore",
      permanentlyDelete: "Permanently Delete",
      permanentlyDelete1: "Permanently",
      permanentlyDelete2: "Delete",
      processing: "Processing...",
      saving: "Saving...",
      deleting: "Deleting...",
      submitting: "Submitting...",
      moving: "Moving…",
      adding: "Adding...",
      loading: "Loading...",
      yes: "Yes",
      no: "No",
      all: "All",
      select: "Select",
      done: "Done",
      remove: "Remove",
      update: "Update",
      copy: "Copy"
    },
    paymentTerms: {
      cashShort: "Cash",
      netShort: "Net {days}",
      cash: "Cash — due when invoice is submitted",
      net: "Net {days} — due within {days} days of invoice",
      netMonths: "Net {days} ({months} months)"
    },
    labels: {
      status: "Status",
      type: "Type",
      date: "Date",
      dates: "Dates",
      time: "Time",
      month: "Month",
      year: "Year",
      wholeMonth: "Whole Month",
      wholeYear: "Whole Year",
      description: "Description",
      actions: "Actions",
      client: "Client",
      employee: "Employee",
      employees: "Employees",
      department: "Department",
      prefix: "Prefix",
      period: "Period",
      active: "Active",
      inactive: "Inactive",
      searchProjects: "Search Projects...",
      searchBankAccounts: "Search Bank Accounts...",
      noMatchingProjects: "No projects match this search.",
      noMatchingBankAccounts: "No bank accounts match this search.",
      noResults: "No results",
      unknown: "Unknown",
      na: "—",
      dropFileOrBrowse: "Drop file here or browse",
      dropFilesOrBrowse: "Drop files here or browse",
      fileMustBeImageOrPdf: "Use a photo or PDF.",
      fileMustBeImage: "Use a photo.",
      selectedCount: "{count} selected",
      showingCount: "Showing {count}",
      ofTotal: "of {total}"
    },
    empty: {
      description: "There is no data to show for this view."
    },
    errors: {
      generic: "Something went wrong. Please try again.",
      tryAgain: "Please try again.",
      bulkFailed: "Bulk action failed. Please try again."
    },
    confirm: {
      cannotUndo: "This action cannot be undone.",
      unsavedTitle: "Unsaved Changes",
      unsavedDescription:
        "You have unsaved changes. Are you sure you want to exit?",
      exitWithoutSaving: "Exit Without Saving",
      keepEditing: "Keep Editing"
    },
      roles: {
      admin: "Admin",
      client: "Client",
      employee: "Employee",
      vendor: "Vendor"
    }
  },

  nav: {
    sections: {
      Dashboard: "Dashboard",
      Administration: "Administration",
      Operations: "Operations",
      "Human Resources": "Human Resources",
      Finance: "Finance"
    },
    items: {
      Dashboard: "Dashboard",
      Clients: "Clients",
      Vendors: "Vendors",
      Employees: "Employees",
      Users: "Users",
      "Website CMS": "Website CMS",
      Projects: "Projects",
      "All Projects": "All Projects",
      Planning: "Planning",
      "In Progress": "In Progress",
      "Pending Approval": "Pending Approval",
      "Payment Due": "Payment Due",
      "Completed Projects": "Completed Projects",
      Finance: "Finance",
      "Invoice and Billing": "Invoice and Billing",
      "All Billing": "All Billing",
      Reconciliation: "Reconciliation",
      "Tax Invoice": "Tax Invoice",
      Tax: "Tax",
      Purchases: "Expenses",
      Expenses: "Expenses",
      Loans: "Loan",
      Loan: "Loan",
      BPJS: "BPJS",
      Sales: "Sales",
      "Petty Cash": "Petty Cash",
      "Upload History": "Upload History",
      "Payment & Settlement": "Payment & Settlement",
      THR: "THR",
      Payroll: "Internal Payroll",
      "Internal Payroll": "Internal Payroll",
      "Financial Report": "Financial Report",
      VAT: "VAT",
      "Progress Reports": "Progress Report",
      "Progress Report": "Progress Report",
      CICO: "CICO",
      "Attendance Report": "Attendance Report",
      Shifts: "Shifts",
      "Leave & Sick": "Leave & Sick",
      Approvals: "Approvals",
      "Material Requests": "Material Requests",
      "Transfer Orders": "Transfer Orders",
      "Monthly Reports": "Client Reports",
      "Client Reports": "Client Reports",
      Inventory: "Inventory",
      "Item Catalog": "Goods Catalog",
      "Goods Catalog": "Goods Catalog",
      "Company Details": "Company Details",
      Teams: "Teams",
      Assignment: "Assignment",
      "Team Availability": "Team Availability"
    },
    collapse: "Collapse {label}",
    expand: "Expand {label}",
    openMenu: "Open Navigation",
    closeMenu: "Close Navigation",
    menuTitle: "Navigation",
    menuDescription:
      "Browse sidebar sections and modules such as Administration, Operations, HR, and Finance.",
    rearrange: "Rearrange Sidebar",
    rearrangeTitle: "Rearrange Sidebar",
    rearrangeDescription:
      "Reorder categories, modules, and nested items with ↑ / ↓ or drag, then Save. Only modules you can access are listed.",
    rearrangeShort: "Rearrange",
    saveOrder: "Save Order",
    resetOrder: "Reset Defaults",
    orderSaved: "Sidebar order saved",
    orderSaveFailed: "Could not save sidebar order",
    dragToReorder: "Drag To Reorder",
    dragItem: "Drag {label}",
    dragCategory: "Drag category {label}",
    moveUp: "Move {label} up",
    moveDown: "Move {label} down",
    hideSubItems: "Hide {count} sub-items",
    showSubItems: "Show {count} sub-items",
    underItem: "Under {label}",
    loadingMenu: "Loading your menu…",
    noModules: "No modules available."
  },

  status: {
    project: {
      PLANNED: "Planning",
      IN_PROGRESS: "In Progress",
      WAITING_FOR_APPROVAL: "Pending Approval",
      OFF_SITE: "Off-site",
      ON_HOLD: "On Hold",
      COMPLETED: "Completed",
      CANCELLED: "Cancelled"
    },
    workflow: {
      Planning: "Planning",
      "In Progress": "In Progress",
      "Pending Approval": "Pending Approval",
      "Waiting for Approval": "Pending Approval",
      "Off-site": "Off-site",
      "Payment Due": "Payment Due",
      "Awaiting payment": "Awaiting payment",
      Completed: "Completed",
      Cancelled: "Cancelled"
    },
    workflowChip: {
      inProgress1: "In",
      inProgress2: "Progress",
      paymentDue1: "Payment",
      paymentDue2: "Due",
      waitingForApproval1: "Pending",
      waitingForApproval2: "Approval",
      pendingApproval1: "Pending",
      pendingApproval2: "Approval",
      awaitingPayment1: "Awaiting",
      awaitingPayment2: "payment"
    },
    billing: {
      ONGOING: "Ongoing",
      COMPILING: "Compiling",
      AWAITING_CLIENT_REVIEW: "Awaiting Client Review",
      AWAITING_PAYMENT: "Awaiting Payment",
      PENDING_VERIFICATION: "Verifying Payment",
      PAID: "Paid",
      OVERDUE: "Overdue",
      LATE: "Late"
    },
    billingChip: {
      awaitingPayment1: "Awaiting",
      awaitingPayment2: "Payment",
      awaitingInvoice1: "Awaiting",
      awaitingInvoice2: "Invoice",
      verifyingPayment1: "Verifying",
      verifyingPayment2: "Payment",
      readyToReconcile1: "Ready to",
      readyToReconcile2: "Reconcile",
      readyToInvoice1: "Ready to",
      readyToInvoice2: "Invoice",
      awaitingClientReview1: "Pending",
      awaitingClientReview2: "Approval",
      taxInvoiceDue1: "Tax",
      taxInvoiceDue2: "Pending",
      taxInvoiceDone1: "Tax Invoice",
      taxInvoiceDone2: "Sent",
      latePayment1: "Late",
      latePayment2: "Payment",
      paymentDue1: "Payment",
      paymentDue2: "Due",
      invoiceDue1: "Invoice",
      invoiceDue2: "Due"
    },
    leave: {
      PENDING: "Pending",
      APPROVED: "Approved",
      REJECTED: "Rejected",
      CANCELLED: "Cancelled"
    },
    clientReview: {
      NONE: "—",
      AWAITING_CLIENT: "Awaiting Client",
      CLIENT_APPROVED: "Client Approved",
      CLIENT_REVISED: "Client Revised",
      HO_APPROVED_REVISION: "Revision Approved",
      HO_REJECTED_REVISION: "Revision Rejected"
    },
    clientReviewChip: {
      AWAITING_CLIENT1: "Awaiting",
      AWAITING_CLIENT2: "Client",
      CLIENT_APPROVED1: "Client",
      CLIENT_APPROVED2: "Approved",
      CLIENT_REVISED1: "Client",
      CLIENT_REVISED2: "Revised",
      HO_APPROVED_REVISION1: "Revision",
      HO_APPROVED_REVISION2: "Approved",
      HO_REJECTED_REVISION1: "Revision",
      HO_REJECTED_REVISION2: "Rejected"
    },
    reviewKind: {
      PROGRESS: "Progress",
      RECONCILIATION: "Reconciliation",
      PAYROLL_MANAGEMENT: "Payroll Management"
    },

    subcategory: {
      REGULAR_CLEANING: "Regular Cleaning",
      GENERAL_CLEANING: "General Cleaning",
      FACADE_CLEANING: "Facade Cleaning",
      CONTRACT_GENERAL_CLEANING: "General Cleaning",
      CONTRACT_FACADE_CLEANING: "Facade Cleaning",
      REGULAR_LANDSCAPING: "Regular Landscaping",
      ONE_TIME_LANDSCAPING: "One Time Landscaping",
      INTERNAL: "Internal Project",
      SECURITY: "Security",
      ONE_TIME_SECURITY: "One Time Security",
      PARKING: "Parking",
      PAYROLL_MANAGEMENT: "Payroll Management",
      short: {
        REGULAR_CLEANING: "Regular",
        GENERAL_CLEANING: "General",
        FACADE_CLEANING: "Facade",
        CONTRACT_GENERAL_CLEANING: "General",
        CONTRACT_FACADE_CLEANING: "Facade",
        REGULAR_LANDSCAPING: "Regular",
        ONE_TIME_LANDSCAPING: "One Time",
        INTERNAL: "Internal",
        SECURITY: "Security",
        ONE_TIME_SECURITY: "One Time",
        PARKING: "Parking",
        PAYROLL_MANAGEMENT: "Payroll"
      },
      cleaningSuffix: "Cleaning",
      landscapingSuffix: "Landscaping",
      projectSuffix: "Project",
      serviceSuffix: "Service"
    },
    billingMode: {
      MONTHLY: "Monthly",
      ON_COMPLETION: "On completion",
      MILESTONE: "Milestone",
      MULTI_VISIT: "Multiple visits"
    },
    billingPeriodBasis: {
      CALENDAR_MONTH: "Calendar Month",
      CONTRACT_CYCLE: "Custom Period"
    },
    department: {
      corporate: "Corporate",
      headOffice: "Head Office",
      warehouse: "Warehouse",
      operations: "Operations",
      finance: "Finance",
      cleaningStaff: "Cleaning Staff",
      generalCleaning: "General Cleaning",
      gondola: "Gondola",
      unassigned: "Unassigned"
    },
    jobTitle: {
      ceo: "CEO",
      directorOfOperations: "Director of Operations",
      operationsManager: "Operations Manager",
      areaManager: "Area Manager",
      cleaningStaff: "Cleaning Staff",
      generalCleaningStaff: "General Cleaning Staff",
      gondolaStaff: "Gondola Staff",
      technician: "Technician",
      owner: "Owner",
      technicianSales: "Technician / Sales",
      salesManager: "Sales Manager",
      accountExecutive: "Account Executive",
      salesCoordinator: "Sales Coordinator",
      keyAccount: "Key Account",
      salesSupervisor: "Sales Supervisor",
      procurementManager: "Procurement Manager",
      facilityManager: "Facility Manager",
      operationsLead: "Operations Lead",
      homeowner: "Homeowner",
      buildingManager: "Building Manager",
      exportManager: "Export Manager",
    }
  },

  pages: {
    dashboard: {
      title: "Dashboard",
      yourBilling: "Your Billing",
      yourBillingDesc: "Metrics for your vendor account only — no company-wide data.",
      vendorInvoices: "Your invoices",
      vendorInvoicesDesc: "Purchase invoices linked to your account",
      vendorAwaitingTax: "Needs Tax Invoice",
      vendorAwaitingTaxDesc: "PPN masukan still to upload",
      vendorTaxUploaded: "Tax invoices uploaded",
      vendorTaxUploadedDesc: "Faktur pajak on file",
      vendorPayments: "Overdue / open",
      vendorPaymentsDesc: "Bills past due vs still open (read-only)",
      vendorOpenInvoices: "Open invoices",
      vendorOpenTax: "Tax invoice upload",
      vendorOpenPayments: "Payment & settlement",
      todaysOperations: "Today's Operations",
      todaysOperationsDesc: "Live workforce and project metrics",
      workforcePresence: "Workforce presence and approvals",
      systemOverview: "System Overview",
      systemOverviewDesc: "Directory and account totals",
      yourProjects: "Your Projects",
      yourProjectsDesc: "Metrics for your organization's sites only",
      staffPresentToday: "Staff Present Today",
      notCheckedIn: "{count} not checked in",
      notCheckedInOnSites: "{count} not checked in on your sites",
      pendingApprovals: "Pending Approvals",
      activeProjects: "Active Projects",
      viewAll: "View all →",
      progressReportCountOne: "{count} progress report",
      progressReportCountOther: "{count} progress reports",
      noActiveProjects: "No active projects",
      noActiveProjectsDesc:
        "In-progress and planned projects will appear here.",
      totalInSystem: "{count} total in system",
      totalForOrg: "{count} total for your organization",
      activeEmployees: "Active Employees",
      currentlyOnPayroll: "Currently on payroll",
      siteStaffAssigned: "Site Staff Assigned",
      fieldStaffOnSites: "Field staff on your active sites",
      recentActivity: "Recent Activity",
      noRecentActivity: "No recent activity to show.",
      noRecentActivityTitle: "No recent activity",
      noRecentActivityDesc:
        "Progress reports and leave requests will show up here.",
      progressReport: "Progress report · {project}",
      photoOne: "{count} photo",
      photoOther: "{count} photos",
      serviceArea: "Service Area",
      checkedIn: "Checked in",
      leaveRequest: "Leave request",
      requiresReview: "Requires your review",
      allCaughtUp: "All caught up",
      systemUsers: "System users",
      loginAccounts: "Login accounts",
      activeClients: "Active clients",
      availableForProjects: "Available for projects",
      departments: "Departments",
      employeeCategories: "Employee categories",
      totalProjects: "Total projects",
      inProgressCount: "{count} in progress",
      guestName: "User",
      awaitingManagerReview: "Awaiting manager review",
      noPendingRequests: "No pending requests",
      todaysAttendance: "Today's Attendance",
      myAttendanceToday: "My Attendance Today",
      todaysAttendanceStats:
        "{present} present · {absent} absent · {rate}% checked in",
      notCheckedInYet: "Not checked in yet",
      checkedInAndOut: "Checked in and out",
      personalCheckInHint:
        "Your check-in for today will appear here after you clock in.",
      teamCheckInHint: "Records appear here as employees check in today.",
      showingLatestCheckIns: "Showing latest {count} check-ins",
      attendanceReport: "Progress Report",
      attendanceIn: "In",
      attendanceOut: "Out"
    },
    projects: {
      title: "Projects",
      allTitle: "All Projects",
      planningTitle: "Planning",
      inProgressTitle: "In Progress",
      pendingApprovalTitle: "Pending Approval",
      paymentDueTitle: "Payment Due",
      openBilling: "Open Billing",
      completedTitle: "Completed Projects",
      addProject: "Add Project",
      bankAccount: "Bank Account",
      bankAccountHint:
        "Printed on invoices for this project. You can change it later on the project page.",
      bankAccountChangeHint:
        "Changing this does not rewrite invoices that are already issued.",
      bankAccountEmpty: "Add a bank account in Company Details first.",
      bankAccountRequired: "Choose the bank account clients pay to.",
      bankAccountPlaceholder: "Select Bank Account",
      bankAccountSaved: "Bank Account saved.",
      newProject: "New Project",
      createProject: "Create Project",
      creating: "Creating...",
      bulkCreateTitle: "Add projects in bulk",
      bulkCreateDesc:
        "Add more than one project at once. Each line is the same as Add Project — fill everything in for that project.",
      bulkCreateLines: "Projects",
      bulkCreateLinesHint:
        "Each line is a full project record. There are no shared terms.",
      editProject: "Edit Project",
      createDescription:
        "Set up a project with client, site location on the map, and assigned staff.",
      createDescriptionContract:
        "Set up an ongoing Regular Cleaning contract with site location and standby staff.",
      createDescriptionMilestone:
        "Set up General or Facade work with a payment milestone schedule staff can invoice later.",
      createDescriptionLandscapingContract:
        "Set up an ongoing Regular Landscaping contract with site location and standby staff.",
      createDescriptionLandscapingOneTime:
        "Set up One-Time Landscaping with a payment plan staff can invoice later.",
      projectName: "Project name",
      selectClient: "Select client",
      startingStage: "Starting Stage",
      serviceArea: "Service Area",
      serviceAreaCleaning: "Cleaning",
      serviceAreaLandscaping: "Landscaping",
      serviceAreaParking: "Parking",
      serviceAreaSecurity: "Security",
      serviceAreaPayroll: "Payroll Management",
      serviceAreaHeadOffice: "Head Office",
      subcategory: "Subcategory",
      oneTime: "One Time",
      oneTimeType: "One Time Type",
      formRegular: "Regular",
      addServiceArea: "Add Service Area",
      addSubcategory: "Add Subcategory",
      catalogAreaTitle: "Add Service Area",
      catalogAreaDescription:
        "Create a service area that can be selected on Add Project. Choose whether this area can have One Time projects.",
      catalogSubTitle: "Add Subcategory",
      catalogSubDescription:
        "Add a subcategory under the selected service area.",
      catalogName: "Name",
      catalogNameId: "Name (Indonesian)",
      catalogNamePlaceholder: "e.g. Waste Management",
      catalogBillingKind: "Billing",
      catalogBillingContract: "Contract",
      catalogBillingOneTime: "One Time",
      catalogCreating: "Adding...",
      catalogCreateArea: "Add Service Area",
      catalogCreateSub: "Add Subcategory",
      manageServiceAreas: "Manage Service Areas",
      manageServiceAreasTitle: "Service Areas",
      manageServiceAreasDescription:
        "Add, edit, or delete service areas. Click a service area to manage its subcategories.",
      manageSubcategoriesDescription:
        "Add, rename, or delete subcategories for this service area. Edit changes this service area, including One Time.",
      serviceAreaCount: "{count} service areas",
      serviceAreaCountOne: "{count} service area",
      subcategoryManageCount: "{count} subcategories",
      subcategoryManageCountOne: "{count} subcategory",
      emptyServiceAreas: "No service areas yet. Add one to use on Add Project.",
      emptyCatalogSubcategories: "No subcategories in this service area.",
      backToServiceAreas: "Back To Service Areas",
      catalogEnableOneTime: "Enable One Time",
      catalogEnableOneTimeHint:
        "Yes allows one-shot projects for this service area.",
      catalogProjects: "Projects",
      catalogEditAreaTitle: "Edit Service Area",
      catalogEditAreaDescription:
        "Update the service area name and whether it can have One Time projects.",
      catalogEditSubTitle: "Edit Subcategory",
      catalogEditSubDescription:
        "Update the subcategory name and whether it is One Time.",
      catalogSubOneTimeHint:
        "Yes makes this subcategory One Time on Add Project.",
      catalogOneTimeLockedAreaHint:
        "Parking and Payroll Management stay contract only.",
      catalogOneTimeLockedSubHint:
        "This subcategory cannot be set as One Time.",
      catalogDeleteAreaTitle: "Delete Service Area?",
      catalogDeleteAreaConfirm: "Delete Service Area",
      catalogDeleteAreaDescEmpty:
        "This service area will be permanently removed.",
      catalogDeleteAreaDescInUse:
        "This service area cannot be deleted while a project is still ongoing.",
      catalogDeleteSubTitle: "Delete Subcategory?",
      catalogDeleteSubConfirm: "Delete Subcategory",
      catalogDeleteSubDescEmpty:
        "This subcategory will be permanently removed.",
      catalogDeleteSubDescInUse:
        "This subcategory cannot be deleted while a project is still ongoing.",
      catalogAreaInUseOne:
        "{count} ongoing project still uses this service area.",
      catalogAreaInUseOther:
        "{count} ongoing projects still use this service area.",
      catalogSubInUseOne:
        "{count} ongoing project still uses this subcategory.",
      catalogSubInUseOther:
        "{count} ongoing projects still use this subcategory.",
      catalogUpdateAreaFailed: "Could not update the service area.",
      catalogUpdateSubFailed: "Could not update the subcategory.",
      catalogDeleteAreaFailed: "Could not delete the service area.",
      catalogDeleteSubFailed: "Could not delete the subcategory.",
      directoryChipAll: "All",
      directoryChipInternal: "Internal",
      directoryChipOneTime: "One Time",
      directoryChipCleaning: "Cleaning",
      directoryChipSecurity: "Security",
      directoryChipParking: "Parking",
      directoryChipPayroll: "Payroll",
      directoryChipLandscaping: "Landscaping",
      directorySubRegular: "Regular",
      directorySubGeneral: "General",
      directorySubFacade: "Facade",
      directorySubLandscaping: "Landscaping",
      directorySubSecurity: "Security",
      directorySubCleaning: "Cleaning",
      billingPeriodBasis: "Billing Periods",
      billingPeriodBasisCalendarMonth: "Calendar Month",
      billingPeriodBasisContractCycle: "Custom Period",
      billingCycleFromDay: "From Day",
      billingCycleToDay: "To Day",
      billingPeriodBasisHelp:
        "Calendar Month bills each calendar month. Custom Period repeats every month from the day you pick to the other day. If To Day is on or before From Day, the period ends next month.",
      createDescriptionService:
        "Set up Security, Parking, or Payroll Management with the commercial terms for this client.",
      serviceCommercial: {
        monthlyFee: "Monthly Fee",
        monthlyFeeHint: "Price Exclude Tax. The invoice adds the tax you chose on this project.",
        setupCost: "Initial Setup Cost",
        setupCostHint: "One-time parking setup cost (IDR).",
        profitSharePercent: "Client Profit Share %",
        profitSharePercentHint:
          "Percentage of profit shared with the client. 0 means no profit sharing.",
        monthlyClientFee: "Monthly Client Fee",
        memberParkingUnitFee: "Member Parking Fee Per Car",
        memberParkingUnitFeeHint:
          "Fixed monthly fee per member car. This amount is not taxed.",
        memberParkingUnitCount: "Member Cars",
        memberParkingUnitCountHint:
          "How many member cars are registered. Member fee × cars is not taxed. All other parking income is taxed.",
        parkingTaxPercent: "Casual Parking Tax %",
        parkingTaxPercentHint:
          "Tax on casual (normal traffic) parking only. Default 10. Member parking is not taxed.",
        serviceFeePercent: "Management Fee %",
        serviceFeePercentHint:
          "Type the management fee percent for this job. There is no built-in default.",
        paymentTermsDays: "Payment Terms",
        paymentTermsDaysHint:
          "How many days after we invoice this project until the client pays. Same client, different project, different terms.",
        payrollCutoffEndDay: "Cutoff Day",
        payrollCutoffHint:
          "The day each pay period ends. The contract end snaps to this cutoff day. If the contract starts mid-period, the first period is only the leftover days up to this cutoff.",
        payrollTaxPercent: "Tax On Fee %",
        payrollTaxPercentHint:
          "Tax applies to the management fee only, not to wages. Default 11. You can change it later on the project page.",
        payrollTimelineHint:
          "Start date plus duration. The last day snaps to this client’s cutoff. Staff check in; Head Office fills wages from check-in and can deduct before Generate PDF.",
        payrollEconomicsHint:
          "Economics: fronted payroll = cost; management fee % = Relasi Global Solusi profit; tax is on the fee only; the client bill is wages + fee + tax."
      },
      billingLabel: "Billing",
      companyNpwp: "NPWP / NIK",
      companyNpwpHint:
        "The client tax ID used on a tax invoice. Change it in the Client directory.",
      withoutTaxNote:
        "This client has no NPWP or NIK yet. Add it on the client record — a tax invoice needs one or the other.",
      chargedTaxKind: "What Tax Do We Charge On This Project",
      chargedTaxKindHint:
        "Choose the tax we charge this client. Value Added Tax means we issue a tax invoice. Income tax is withheld or final. Other Tax asks for the name and percent.",
      chargedTaxKindPlaceholder: "Select The Tax",
      chargedTaxKindRequired: "Select the tax we charge on this project.",
      pphRatePercent: "Income Tax Rate",
      pphRatePercentHint:
        "Usual Article 23 withholding is 2%. Change it if this project uses another rate.",
      pphRatePercentPlaceholder: "e.g. 2",
      pphRatePercentRequired: "Enter the income tax rate for this project.",
      withoutTax: "Without Tax",
      deleteProject: "Delete project?",
      deleteProjectConfirm: "Delete project",
      deleteProjectDescription:
        "This project will be permanently removed from active projects. This action cannot be undone.",
      deleteProjectPaymentDueDescription:
        "This project and its unpaid invoice periods will be permanently removed from Payment Due. This action cannot be undone.",
      deleteFromCompleted: "Delete from Completed Projects?",
      deleteFromCompletedConfirm: "Delete from Completed Projects",
      deleteFromCompletedDescription:
        "This completed project and its billing records will be permanently removed. This action cannot be undone.",
      editDescription: "Update project details, timeline, staff, and billing options.",
      deletedSuccess: "“{name}” deleted.",
      deletedFromCompletedSuccess: "“{name}” removed from Completed Projects.",
      emptyAll: "No projects yet",
      emptyAllDesc: "Create a project to get started.",
      emptyPlanning: "No projects in Planning",
      emptyPlanningDesc: "New projects start here until a work order is received.",
      emptyInProgress: "No projects In Progress",
      emptyInProgressDesc:
        "Projects appear here after Move to In Progress from Planning.",
      emptyPendingApproval: "No periods pending approval",
      emptyPendingApprovalDesc:
        "Each billing period awaiting mutual approval appears as its own row after Submit for Approval or reconcile. The same project can appear more than once. Periods move to Payment Due once the client and HO both agree.",
      emptyPaymentDue: "No payment due",
      emptyPaymentDueDesc:
        "Each issued invoice period appears here until payment is verified. The same project can appear more than once. Regular Cleaning projects stay In Progress while a cycle is due.",
      emptyCompleted: "No completed projects",
      emptyCompletedDesc: "Finished and fully paid projects appear here.",
      moveToInProgress: "Move to In Progress",
      contractProof: "Signed Contract Proof",
      contractProofHint:
        "Upload the signed contract (PDF or image). Required to start In Progress, including when you create the project already In Progress.",
      extendContract: "Extend Contract",
      extendContract1: "Extend",
      extendContract2: "Contract",
      extendTo: "Extend To",
      extendToRequired: "Extend To date is required.",
      extendProof: "Extension Proof",
      extendProofRequired: "Extension proof is required.",
      extendProofHint: "Upload signed extension proof (PDF or image).",
      extendContractFailed: "Failed to extend contract.",
      renewContract: "Contract Renewed",
      renewContract1: "Contract",
      renewContract2: "Renewed",
      renewContractHint:
        "Same client and site. Enter the new start and end dates and upload the new signed agreement. Old invoices stay. Assign crew again after renew.",
      renewStart: "New Start Date",
      renewEnd: "New End Date",
      renewAgreement: "New Signed Agreement",
      renewStartRequired: "New start date is required.",
      renewEndRequired: "New end date is required.",
      renewAgreementRequired: "Upload the new signed agreement.",
      renewContractFailed: "Failed to renew the contract.",
      redoJob: "Re-do Job",
      redoJob1: "Re-do",
      redoJob2: "Job",
      redoJobHint:
        "Same client, site, and terms. Enter the new start date, upload the new signed paper, and assign crew again. Last crew may already be busy.",
      redoStart: "New Start Date",
      redoDuration: "Duration (days)",
      redoAgreement: "New Signed Paper",
      redoStartRequired: "New start date is required.",
      redoAgreementRequired: "Upload the new signed paper.",
      redoJobFailed: "Failed to re-do this job.",
      assignTeam: "Assign Team",
      assignTeamHint:
        "Assigning a team places every member on this job. People on a team can only be assigned through the team. Extra staff here are backups for this job only.",
      visitPlan: "Visit Windows",
      visitPlanHint:
        "Multiple visits finish the job each trip and invoice that visit. This is not milestone progress on one continuous job.",
      visitN: "Visit {n}",
      visitStart: "Visit start",
      visitEnd: "Visit end",
      addVisit: "Add visit",
      removeVisit: "Remove visit",
      visitCrew: "Visit Crew",
      visitCrewHint:
        "Assign one team or one employee to each visit. The same person or team cannot be used on overlapping dates.",
      visitCrewUnassigned: "Not Assigned",
      visitCrewAssign: "Assign Crew",
      visitCrewChange: "Change Crew",
      visitCrewClear: "Clear Assignment",
      visitCrewModeTeam: "Team",
      visitCrewModeEmployee: "Employee",
      visitCrewChooseMode: "Assign A Team Or An Employee",
      visitCrewSave: "Save Assignment",
      visitCrewFailed: "Could not save visit crew.",
      visitCrewClearFailed: "Could not clear visit crew.",
      visitCrewBusyOn: "Already used on {projectName} ({dates}).",
      visitCrewNeedChoice: "Choose a team or an employee.",
      visitCrewXor: "Assign a team or an employee, not both.",
      visitCrewCurrent: "On Site This Visit",
      visitCrewNoTeams: "No teams match this job type.",
      visitCrewEmpty: "No visits on this project.",
      visitCrewNotFound: "Visit not found.",
      visitCrewTeamMissing: "That team was not found.",
      visitCrewTeamWrongType: "That team cannot be assigned to this job type.",
      visitCrewEmployeeMissing: "That employee was not found.",
      visitCrewEmployeeOnTeam:
        "People on a team can only be assigned through the team.",
      moveDialogVisitCrewHelp:
        "Crew is assigned per visit on the project page, not in this dialog.",
      extendHistory: "Contract Extensions",
      extendHistoryEmpty: "No contract extensions yet.",
      extendHistoryExtendedOn: "Extended On",
      extendHistoryPreviousEnd: "Previous End",
      extendHistoryNewEnd: "New End",
      extendHistoryProof: "Proof",
      extendHistoryNotes: "Notes",
      moveToInProgressChip1: "Move to",
      moveToInProgressChip2: "In Progress",
      backToPlanning: "Back to Planning",
      backToPlanningChip1: "Back to",
      backToPlanningChip2: "Planning",
      verifyPayment: "Verify payment",
      verifying: "Verifying…",
      verifyPaymentFailed: "Failed to verify payment.",
      manageBilling: "Manage Billing",
      manageBillingChip1: "Manage",
      manageBillingChip2: "Billing",
      permissionDenied: "You do not have permission to manage this project.",
      notFound: "Project not found.",
      submitForApproval: {
        button: "Submit for Approval",
        chip1: "Submit for",
        chip2: "Approval",
        confirmTitle: "Submit for Approval",
        confirmDesc:
          "This compiles all progress reports into a PDF and opens client and HO review. The project status will change to Pending Approval.",
        confirm: "Submit",
        regularNotAllowed:
          "Regular Cleaning and Regular Landscaping use reconcile. Reconcile the due billing period to start approval.",
        internalNotAllowed:
          "Internal projects do not use Submit for Approval.",
        notAllowed:
          "Submit for Approval is only for General Cleaning, Facade Cleaning, and One-Time Landscaping.",
        inProgressOnly:
          "Only In Progress projects can be submitted for approval.",
        noOngoingMilestone:
          "No ongoing milestone period found. Please check the billing schedule.",
        failed: "Failed to submit project for approval."
      },
      assignStaff: "Assign Staff",
      assignStaffLater: "Assign staff later",
      shiftCount: "How Many Shifts",
      shiftCountHint:
        "Choose how many shifts this site runs, then set each shift's hours here. Human Resources → Shifts only assigns people to Shift 1, Shift 2, Shift 3, or Shift 4.",
      shiftCountOption: "{count} Shifts",
      shiftCountOptionOne: "1 Shift",
      shiftWindowLabel: "Shift {number} Hours",
      shiftWindowStart: "Shift {number} Start",
      shiftWindowEnd: "Shift {number} End",
      assignDoubleShift: "Assign Double Shift",
      assignDoubleShiftDesc:
        "Choose who covers an extra shift on this site, then which shift they take over. That cover applies only on the date you set. The next day they go back to their own shift. They are paid two daily rates for that date on Internal Payroll.",
      assignDoubleShiftConfirm: "Assign Double Shift",
      assignDoubleShiftSaving: "Assigning…",
      assignDoubleShiftFailed: "Could not assign the double shift.",
      doubleShiftEmployee: "Employee On Double Shift",
      doubleShiftEmployeePlaceholder: "Select who will work the double shift",
      doubleShiftEmployeeEmpty:
        "No regular staff on this site. Assign regular staff first, or use Assign Backup for a part-time cover.",
      doubleShiftEmployeeHint:
        "Only regular employees already assigned here. After this, choose which shift they take over.",
      doubleShiftDate: "Date",
      doubleShiftCover: "Shift To Take Over",
      doubleShiftCoverPlaceholder: "Select the shift they will take over",
      doubleShiftCoverEmpty:
        "This project needs at least two shifts, and another employee assigned to the shift being covered. Assign staff to those shifts under Human Resources → Shifts.",
      doubleShiftCoverHint:
        "This is the absent person's shift. The employee already has their own shift; this one is the extra cover for that date only.",
      removeDoubleShift: "Remove Double Shift",
      removeDoubleShiftConfirm:
        "Remove this double shift? That date goes back to one daily rate if they complete check-in and check-out.",
      removeDoubleShiftSaving: "Removing…",
      assignBackup: "Assign Backup",
      assignBackupDesc:
        "Assign a part-time employee to cover a named shift when no regular employee can take a double shift. They check in and check out from the start date through the end date. After the end date the backup ends and that shift is the regular employee's again. Petty Cash is debited when they check out — the operational manager pays them daily.",
      assignBackupConfirm: "Assign Backup",
      assignBackupSaving: "Assigning…",
      assignBackupFailed: "Could not assign the backup.",
      backupEmployee: "Part-Time Employee",
      backupEmployeePlaceholder: "Select a part-time employee",
      backupEmployeeEmpty: "No available part-time employees to assign.",
      backupEmployeeHint:
        "Part-time backups get a login so they can check in, check out, and submit progress reports during the dates you set. After the end date they are no longer on this site.",
      backupCover: "Shift To Cover",
      backupCoverPlaceholder: "Select whose shift the backup will cover",
      backupCoverEmpty:
        "Assign regular staff to a named shift first, then assign a backup to cover that person.",
      backupCoverHint:
        "Choose the regular employee and named shift being covered. Dates are the days this backup is booked. Petty Cash is debited after they check in and check out.",
      backupStart: "Start Date",
      backupEnd: "End Date",
      backupDailyRate: "Daily Rate",
      backupDailyRatePlaceholder: "e.g. 100000",
      backupDailyRateHint:
        "Petty Cash is debited this amount when they check out that day. Days they do not work are not taken.",
      removeBackup: "Remove Backup",
      removeBackupConfirm:
        "Remove this backup from the project? Days not yet paid will not be taken from Petty Cash.",
      removeBackupSaving: "Removing…",
      clearHistory: "Clear all completed",
      timeline: "Timeline",
      cleaningType: "Cleaning Type",
      due: "Due",
      paid: "Paid",
      /** Internal HO/Warehouse sites with no commercial start/end dates. */
      internalOngoing: "Ongoing",
      noLocation: "No location",
      assigned: "assigned",
      reportOne: "report",
      reportOther: "reports",
      late: "Late",
      awaitingInvoice: "Awaiting invoice",
      awaitingPayment: "Awaiting payment",
      verifyingPayment: "Verifying Payment",
      dueOn: "Due {date}",
      emptyShow: "No projects to show.",
      reorderFailed: "Failed to reorder projects.",
      moveBlockedNote: "Settle unpaid invoice to move back to Planning.",
      realContractStart: "Real contract start date",
      realJobStart: "Real job start date",
      realContractStartRequired: "Real contract start date is required.",
      realJobStartRequired: "Real job start date is required.",
      moveToInProgressFailed: "Failed to move project to In Progress.",
      moveDialogStaffHelp:
        "Assign staff now, or leave empty and assign later. Staff is required at check-in (CICO), not to move to In Progress.",
      timelineFields: {
        planningOngoingContract: "Planning — ongoing contract",
        ongoingContract: "Ongoing contract",
        planningContractHelp:
          "Input the estimated contract start date. The real start date is set when you move to in progress.",
        contractHelp:
          "Regular Cleaning is treated as a site contract. End date is calculated from start date and duration.",
        contractStart: "Contract start date",
        contractEnd: "Contract end date",
        durationMonths: "Duration",
        durationDays: "Duration",
        daysUnit: "days",
        planningStageFieldNote:
          "(estimated for projects in planning stage)",
        monthsShort: "{count} mo",
        yearOne: "1 year",
        yearsCount: "{count} years",
        estimatedProjectStart: "Estimated project start date",
        projectStart: "Project start date",
        estimatedProjectCompletion: "Estimated project completion date",
        planningJobHelp:
          "Input the estimated project start date and duration. The real start date is set when you move to in progress."
      },
      paymentPlan: {
        title: "Payment plan",
        help:
          "One project with multiple invoice periods. Staff invoice each milestone when ready — structure is fixed at create.",
        numberOfPayments: "Number of payments",
        splitEvenly: "Split evenly",
        defaultHint:
          "Default {count} × 25% → labels 25 / 50 / 75 / 100",
        eachPaymentPercent: "Each payment (% of contract)",
        paymentPercentAria: "Payment {n} percent",
        totalReadyToSave: "Total {sum}% — ready to save",
        totalMustEqual100: "Total {sum}% — must equal 100%",
        schedulePreview: "Schedule preview",
        milestoneLabel: "Milestone {percent}%",
        percentOfContract: "{percent}% of contract",
        amountFromBilling: " · amount from contract price in Billing",
        fixPercentagesToPreview:
          "Fix percentages so they sum to 100% to preview the schedule.",
        scheduleLockedNote:
          "Payment milestone schedule is set when the project is created and is not edited here. Invoice periods from Invoice and Billing."
      },
      planningEstimate: "Planning estimate:",
      moveDialogContract:
        "Work order received for “{name}”. Enter the real contract start date. Staff can be assigned now or later.",
      moveDialogJob:
        "Work order received for “{name}”. Enter the real job dates. Staff can be assigned now or later.",
      backToPlanningConfirm:
        "Back to Planning for “{name}”? Field ops pause until a work order is received again. Estimated and real dates are kept.",
      backToPlanningFailed: "Failed to send project Back to Planning.",
      subCategoryProjects: "{type} Projects",
      projectOne: "{count} project",
      projectOther: "{count} projects",
      itemOne: "{count} item",
      itemOther: "{count} items",
      forClient: "for",
      companyNotFound: "Company not found.",
      settleBeforePlanning:
        "Settle all unpaid invoices before moving a project back to Planning.",
      cyclesReadyTitle:
        "{count} routine cycle(s) need reconciliation before billing",
      cyclesReadyDesc: "",
      columns: {
        project: "Project",
        status: "Status"
      },
      detail: {
        staff: "Assigned staff",
        billing: "Billing",
        projectType: "Project Type",
        projectControls: "Project controls",
        client: "Client",
        bankAccount: "Bank Account",
        chargedTax: "Tax We Charge",
        location: "Location",
        estimatedStart: "Estimated start",
        contractPeriod: "Contract period",
        planningEstimate: "Planning estimate",
        contractStarted: "Contract start",
        contractPrice: "Contract Price (Exclude Tax)",
        anniversaryInvoiceDay:
          "Anniversary invoice day {day} (day after each cycle ends)",
        serviceBillingNote:
          "Commercial terms are stored on the project. Parking and Payroll Management do not use monthly invoice periods here.",
        contractPriceAndInvoices: "Invoice and Billing",
        estStart: "Est. start {date}",
        estimateTbd: "Estimate TBD",
        fullBilling: "Full Billing",
        noInvoicePeriods: "No invoice periods recorded.",
        invoice: "Invoice",
        downloadPdf: "Download PDF",
        shiftRange: "Shift {start} – {end}",
        noShiftSet: "No shift set",
        backupChip: "Backup {start} – {end} · {rate} / day",
        backupCoverChip:
          "Covered {shift} for {name} · {start} – {end} · {rate} / day",
        doubleShiftChip: "Double Shift {date}",
        doubleShiftCoverChip:
          "Covered {shift} on {date} ({name} Absent)",
        noStaff: "No staff assigned yet.",
        availableAfterInProgress: " · Available after Move to In Progress",
        siteLocation: "Site Location",
        cicoSiteLocation: "CICO Site Location",
        cicoSiteLocationHint:
          "GPS pin and site radius used for Head Office and Warehouse office CICO.",
        cicoCoordinates: "CICO Coordinates",
        cicoGeofenceRadius: "Site Radius",
        cicoGeofenceRadiusValue: "{meters} m",
        cicoGpsNotSet: "Not Set",
        cicoGpsEmptyManage:
          "No GPS pin is set yet. Use Edit to paste a Maps link or place the pin — required for Warehouse and Head Office CICO.",
        cicoGpsEmptyView:
          "No GPS pin is set yet. Ask Head Office to configure the CICO site location on this project.",
        invoicesPayments: "Invoices & Payments",
        downPaymentReceived: "Down Payment Received",
        downPaymentReceivedYes: "Yes · {amount} · {date}",
        downPaymentReceivedNo: "Not Received",
        downPaymentTaxInvoiceNote:
          "A Tax Invoice is required every time money comes in.",
        paymentsReceivedCount: "Payments received: {paid} of {total}",
        viewProgressReports: "View Progress Reports",
        viewProgressReportsChip1: "View Progress",
        viewProgressReportsChip2: "Reports",
        period: "Period",
        amount: "Amount",
        status: "Status",
        paid: "Paid",
        actualDurationDays: "Actual duration",
        estimatedDurationDays: "Initial estimated duration",
        durationDaysValue: "{count} days",
        inventoryCost: "Inventory Cost",
        inventoryIssues: "Inventory Issues",
        inventoryIssueFromInventoryOnly:
          "Stock and equipment are issued from Inventory (Material Requests → Transfer Orders). This list shows what is already on the project.",
        noInventoryIssues: "No inventory issued to this project yet.",
        viewInventory: "Open Inventory",
        voidIssue: "Void Issue",
        voidIssueTitle: "Void Inventory Issue",
        voidIssueDesc:
          "This returns the quantity to inventory and removes the cost from this project.",
        voidIssueConfirm: "Void Issue",
        voidIssueSuccess: "Inventory issue voided. Stock restored.",
        voidReason: "Void Reason",
        voidReasonPlaceholder: "Why is this issue being voided?"
      },
      periodPage: {
        openHint: "Open period details",
        backToProject: "Back To Project",
        whatThisIsTitle: "What This Period Is",
        whatThisIsMonthly:
          "This is one monthly billing cycle of {project}. It is not the whole contract. The list row for {start} – {end} is this cycle only: the reports, the amount, and the status chips belong to these dates.",
        whatThisIsMilestone:
          "This is a progress billing step of {project} ({percent}% of the job). The list row is this step only, not the whole job.",
        whatThisIsCompletion:
          "This is the completion bill for {project}. It covers {start} through {end}.",
        whatThisIsGeneric:
          "This is one billing period of {project}. It covers {start} through {end}. The list row is this period only, not the whole contract.",
        whyTitle: "Why The List Looks Like This",
        emptyInvoiceDates:
          "Invoice Sent and Due Date are empty because the sales invoice has not been issued yet. That happens after this period is approved.",
        pendingApprovalWhy:
          "Pending Approval means the progress package for this cycle was sent for review. The client must Approve or Revise. If they revise, Head Office reviews the change. The sales invoice is issued only after both sides agree.",
        pendingApprovalClientRevised:
          "The client asked for a revision. Head Office still needs to accept or reject that change before this period can be invoiced.",
        pendingApprovalHoRejected:
          "Head Office rejected the last revision. The client needs to review the package again.",
        taxPendingWhy:
          "Tax Pending means this client needs a tax invoice for this period, and it has not been recorded yet.",
        taxDoneWhy: "The tax invoice for this period has been recorded.",
        awaitingPaymentWhy:
          "The sales invoice has been issued. Payment is due on {date}.",
        overdueWhy:
          "The sales invoice is overdue. Payment was due on {date}.",
        verifyingWhy:
          "A payment proof was uploaded. Head Office still needs to confirm it.",
        paidWhy: "This period is paid. Payment was recorded on {date}.",
        ongoingWhy:
          "This cycle is still open. It has not been sent for approval or invoiced yet.",
        compilingWhy: "The invoice for this period is being compiled.",
        reconcileWhy:
          "This cycle has ended and is ready to reconcile before it can be sent to the client.",
        factsTitle: "Period Details",
        project: "Project",
        client: "Client",
        type: "Type",
        billingMode: "Billing Mode",
        amount: "Amount",
        fromContractPrice:
          "Taken from the project contract price until a period amount is set.",
        invoiceSent: "Invoice Sent",
        dueDate: "Due Date",
        paidOn: "Paid On",
        notYet: "Not yet",
        reportsTitle: "Progress Reports In This Period",
        reportsHint:
          "The list shows “{count} reports” because these field reports fall in this cycle.",
        reportsEmpty: "No progress reports fall in these dates yet.",
        photoCountOne: "{count} photo",
        photoCountOther: "{count} photos",
        noNotes: "No notes",
        serviceArea: "Service Area",
        openAllReports: "Open All Progress Reports",
        documentsTitle: "Documents",
        viewReviewReport: "View Report",
        noDocuments:
          "No documents have been generated for this period yet.",
        openBilling: "Open Billing",
        clientRevisionNote: "Client Revision Note",
        hoReviewNote: "Head Office Review Note",
        compileNote: "Compile Note"
      },
      filterAllProjects: "All Projects",
      equipmentPicker: {
        sectionTitle: "Assigned Equipment",
        noAssignedAssets: "No equipment assigned yet.",
        noAssignedAssetsHint:
          "Issue equipment from Inventory → Project Issues. Assigned units are tracked per unit and returned to the pool when released or when the project crew is released.",
        assigned: "assigned",
        removeFromAssignment: "Remove from assignment",
        releaseFailed: "Failed to release equipment unit.",
        assetRequired: "Asset is required.",
        assetNotOnProject: "This unit is not assigned to this project.",
        releaseTitle: "Release Equipment",
        releaseDesc:
          "This returns the unit to the available warehouse pool. Equipment is location/custody only — no project expense is booked.",
        releaseConfirm: "Release Unit",
        releaseSuccess: "Equipment unit released."
      },
      staffPicker: {
        removeFromAssignment: "Remove from assignment",
        noActiveStaff: "No active staff available.",
        department: "Department",
        selectDepartment: "Select department",
        searchDepartment: "Search department...",
        selectStaffPrompt: "Select staff to assign",
        noStaffSearch: "No staff match this search.",
        noStaffDepartment: "No staff in this department.",
        alreadyOnOtherProject:
          "This employee is already assigned to another project.",
        alreadyOnOtherProjectNamed:
          "This employee is already assigned to {projectName}.",
        assignedToOtherProject: "Already assigned to {projectName}."
      },
      locationPicker: {
        addressSearchFailed: "Could not search that address.",
        addressNotFound: "No address found for that search.",
        address: "Address",
        addressPlaceholder: "Filled from coordinates, or search an address",
        searchAddress: "Search",
        latitude: "Latitude",
        longitude: "Longitude",
        radius: "Site Radius (m)",
        radiusPlaceholder: "Radius (m)",
        internalCicoHint:
          "Set the map pin and site radius for office CICO at this Internal site (Head Office or Warehouse).",
        pasteLabel: "Paste Google Maps coordinates / link",
        pastePlaceholder:
          "-6.200000, 106.816666 or Google Maps / share.google URL",
        parseError:
          "Could not parse. Paste decimal coords (e.g. -6.2, 106.8) or a Google Maps link.",
        shortLinkError:
          "Could not resolve that Maps short link. In Google Maps, right-click the pin → copy the decimal coordinates and paste those instead.",
        coordsAppliedFilled: "Coordinates applied and address filled.",
        coordsLookingUp: "Coordinates applied — looking up address…",
        retryingLookup: "Retrying address lookup…",
        addressFilled: "Address filled.",
        resolvingShortLink: "Resolving Maps short link…",
        shortLinkLookingUp: "Short link resolved — looking up address…",
        pinMovedLookingUp: "Pin moved — looking up address…",
        pinSetLookingUp: "Pin set — looking up address…",
        urlNotAddress:
          "That looks like a URL, not a street address. Paste a Maps link in the field above, or type a real address.",
        addressFoundUpdated: "Address found and pin updated.",
        lookupFailedKept:
          "Coordinates applied; address lookup failed — existing site address kept.",
        lookupFailedPlaceholder:
          "Coordinates applied; address lookup failed — using coordinates as placeholder.",
        retrying: " Retrying…",
        retryLookup: "Retry address lookup",
        pinHelp: "Pin updates from paste. Drag or click the map to fine-tune."
      },
      finish: {
        confirmInvoice:
          "Request invoice for the current contract cycle before finishing?",
        invoiceRequested: "Invoice requested",
        noPeriodDue: "No period is due to invoice right now.",
        confirmFinish: "Mark this project as completed?",
        completedStatus: "Project marked completed.",
        requestInvoice: "Submit invoice",
        reconcile: "Reconcile",
        reconciling: "Reconciling...",
        submittingInvoice: "Submitting…",
        finishProject: "Finish project",
        finishProject1: "Finish",
        finishProject2: "Project",
        endContract: "End Contract",
        endContract1: "End",
        endContract2: "Contract",
        finishing: "Finishing...",
        confirmReconcileCycle:
          "Reconcile the due cycle for “{name}” and send the CICO report for client and HO review?",
        nothingToReconcile:
          "Nothing to reconcile. No due cycle is waiting for reconcile, or the next cycle is not due yet.",
        reconcilePeriodFailed: "Failed to reconcile this period.",
        confirmInvoiceCycle:
          "Invoice issue waits on mutual approval of the reconciliation report (Finance → Reconciliation).",
        nothingNewToInvoice:
          "Nothing new to invoice. Reconcile the due cycle first so the client and HO can approve, or “{label}” is already issued/paid.",
        invoicePeriodFailed: "Failed to invoice this period.",
        lastDay: "Last day on site",
        lastDayRequired: "Enter the real last day on site.",
        lastMonth: "Last Month",
        lastMonthRequired: "Pick the last month of the parking contract.",
        lastMonthHint:
          "Pick the last calendar month on site. The last day is the last day of that month. Parking bills that month in the Parking workspace. Reconcile on the 1st of the next month.",
        lastDayHint:
          "Pick the last working day (today or earlier). If you pick today, we reconcile tomorrow so that day is fully closed. Then the pack goes to the client for Approve.",
        confirmEndContract:
          "Are you sure you want to end this contract for “{name}”? If you confirm, pick the last working day. The last bill is reconciled the day after that date, then sent to the client. The job ends only after they approve, pay, and the tax invoice is uploaded.",
        confirmFinishNamed:
          "Finish “{name}”? An invoice will be generated for the client account. The project moves to Payment Due until payment is received. Unpaid invoices must be settled first.",
        settleUnpaidBeforeClose:
          "Settle all unpaid invoices before ending the contract or completing the project.",
        reconcileDueBeforeClose:
          "Reconcile all due billing periods before ending the contract or completing the project.",
        clientReviewBeforeClose:
          "Wait for client and HO to resolve open approval reviews before ending the contract or completing the project.",
        contractEnded: "Contract ended",
        endContractFailed: "Failed to end contract.",
        finishProjectFailed: "Failed to finish project.",
        invoiceErrorOpenBilling:
          "{finishedLabel}, but the invoice could not be issued:\n{error}{billingHint}\n\nOpen billing now?",
        openBillingNow: "Open billing now?",
        billingHintWithPath:
          "\n\nOpen Invoice and Billing to compile manually:\n{path}",
        billingHintGeneric:
          "\n\nOpen Invoice and Billing to compile the invoice manually.",
        createFailed: "Failed to create project.",
        updateFailed: "Failed to update project."
      },
      historyClear: {
        noProjects: "No projects to clear.",
        cleared: "Project history cleared.",
        clearedCount:
          "Cleared {count} completed project(s).",
        completedCount: "{count} completed project(s)",
        clearFailed: "Failed to clear completed projects.",
        warningNote:
          "Invoice periods, PDFs, progress reports, photos, and assignments are removed. Attendance records are kept but unlinked. Payment Due and active projects are not affected.",
        title: "Clear all project history?",
        description:
          "This permanently clears completed and cancelled project history from this view. Active projects are not affected.",
        confirm: "Clear history",
        clearing: "Clearing..."
      }
    },
    clients: {
      title: "Clients",
      descriptionAdmin: "Add a client organization.",
      directoryTitle: "Client Directory",
      directoryDesc:
        "Organization records, project assignments, and contact details.",
      companyNotFound: "Company not found.",
      addClient: "Add Client",
      bulkCreateTitle: "Add clients in bulk",
      bulkCreateDesc:
        "Add more than one client at once. Each line is the same as Add Client — fill everything in for that client.",
      bulkCreateLines: "Clients",
      bulkCreateLinesHint:
        "Each line is a full client record. There are no shared terms.",
      editClient: "Edit Client",
      searchPlaceholder: "Search clients...",
      deleted: "Deleted",
      active: "Active",
      activeSubtitle: "Client organizations currently enabled",
      deletedSubtitle: "Soft-deleted clients until restored",
      emptyTrash: "Deleted clients appear here until restored or permanently deleted.",
      emptyActive: "No clients yet",
      emptyActiveList: "No active clients",
      emptyActiveListDesc: "No client organizations to show.",
      emptyDeletedList: "No deleted clients",
      emptySearch: 'No results for "{query}"',
      emptySearchDesc:
        "Try a different company name, address, contact, or contact person.",
      deleteTitle: "Delete client?",
      deleteConfirm: "Delete client",
      deleteDescription:
        "This moves the client organization to Deleted clients. The record is kept and can be restored later.",
      deleteSoftNote:
        "Linked portal logins are disabled (not permanently deleted) and move to Deleted Client. Credentials are kept. After you restore this client, use Users → Revoked Access → Restore Access to re-enable portal login. Projects stay assigned to this client.",
      deleteForeverTitle: "Delete Client Forever?",
      deleteForeverConfirm: "Delete Forever",
      deleteForeverDescription:
        "This client organization will be permanently removed. Linked portal logins are permanently deleted. Clients with linked projects cannot be permanently deleted.",
      deleteForeverNote:
        "Only deleted clients with no linked projects can be permanently deleted. Linked portal logins are permanently deleted and cannot be restored. This action cannot be undone.",
      deleteForeverProjectsNote:
        "This client still has linked projects ({count}). Reassign or permanently remove those projects before deleting the client forever.",
      deleteForeverUsersNote:
        "Portal login(s) ({count}) will be permanently deleted and cannot be restored.",
      restoreTitle: "Restore client?",
      restoreConfirm: "Restore client",
      restoreDescription:
        "This restores the client organization from Deleted clients. Linked portal logins stay off — use Users → Revoked Access → Restore Access before they can sign in again.",
      restoreSoftNote:
        "Username and credentials stay preserved. After restore, linked logins appear under Revoked Access until you restore access. The client will appear in the active directory again. Clients deleted forever cannot be restored.",
      editDescription:
        "Update organization contact details. Soft-delete only via Delete. Manage portal logins in Users.",
      savedToast: "Client saved.",
      createFailed: "Failed to create client.",
      updateFailed: "Failed to update client.",
      deleteFailed: "Failed to delete client.",
      restoreFailed: "Failed to restore client.",
      reorderFailed: "Failed to reorder clients.",
      reorderInvalid: "One or more clients are invalid for reorder.",
      notFound: "Client not found.",
      alreadyDeleted: "Client is already deleted.",
      alreadyActive: "Client is already active.",
      permissionDenied: "You do not have permission to manage clients.",
      firstNameRequired: "First name is required.",
      clientNameRequired: "Client name is required.",
      contactFirstNameRequired: "Contact person first name is required.",
      nameAlreadyExists: 'A client named "{name}" already exists.',
      nameExistsInDeleted:
        'A client named "{name}" already exists in Deleted clients. Restore it or permanently delete it before reusing the name.',
      permanentDeleteRequiresDeleted:
        "Only deleted clients can be permanently deleted. Delete the client first.",
      permanentDeleteBlockedByProjects:
        "This client still has linked projects. Reassign or permanently remove those projects before deleting the client forever.",
      portalLoginDeletedClient:
        "{name}: portal login cannot be generated for deleted clients. Restore the client first.",
      portalLoginContactRequired:
        "{name}: contact person first name is required.",
      generatePortalFailed: "Failed to generate portal login.",
      selectAll: "Select All Clients",
      selectRow: "Select {name}",
      projectCount: "{count} project(s)",
      portalUserCount: "{count} portal user(s)",
      checkingSoftDelete: "Checking whether this client can be deleted…",
      softDeleteBlockedTitle: "Cannot delete this client yet",
      softDeleteBlocked:
        "Cannot delete this client while work or finances are still open: {blockers}.",
      softDeleteCheckFailed:
        "Could not verify whether this client can be deleted. Close and try again.",
      softDeleteBlockers: {
        openProjects:
          "{count} open project(s) (not Completed and settled)",
        unsettledBilling: "outstanding billing on {count} project(s)",
        pendingTaxInvoices: "{count} outstanding tax invoice(s)"
      },
      bulkDeleteTitle: "Delete {count} clients?",
      bulkDeleteForeverTitle: "Delete {count} clients forever?",
      bulkDeleteConfirm: "Delete {count} clients",
      bulkDeleteForeverConfirm: "Delete {count} forever",
      bulkRestoreTitle: "Restore {count} clients?",
      bulkRestoreConfirm: "Restore {count} clients",
      bulkSelected: "{count} clients selected",
      bulkActionApplies:
        "This action applies to all selected rows in the current view.",
      bulkDeleteForeverNote:
        "Only deleted clients with no linked projects can be permanently deleted. Linked portal logins are permanently deleted and cannot be restored. Clients with linked projects are blocked. This action cannot be undone.",
      bulkRestoreNote:
        "Username and credentials stay preserved. Restored clients appear in the active directory; linked logins move to Revoked Access.",
      bulkDeactivateSuccess: "{count} client(s) moved to Deleted clients.",
      bulkDeactivateAllFailed:
        "Could not delete selected clients. {detail}",
      bulkDeactivatePartial:
        "{success} client(s) moved to Deleted clients. {failed} failed.",
      bulkDeleteForeverSuccess: "{count} client(s) permanently removed.",
      bulkDeleteForeverAllFailed:
        "Could not permanently delete selected clients. {detail}",
      bulkDeleteForeverPartial:
        "{success} client(s) permanently removed. {failed} failed.",
      bulkRestoreSuccess:
        "{count} client(s) restored. Linked logins stay off until Restore Access.",
      bulkRestoreAllFailed: "Could not restore selected clients. {detail}",
      bulkRestorePartial:
        "{success} client(s) restored. Linked logins stay off until Restore Access. {failed} failed.",
      portalStatus: {
        yes: "Yes",
        revoked: "Revoked",
        no: "No"
      },
      columns: {
        client: "Client",
        shortCode: "Client ID",
        contact: "Contact",
        clientSince: "Client Since",
        projects: "Projects",
        portalLogin: "Portal Login",
        actions: "Actions"
      },
      form: {
        organization: "Organization",
        organizationDesc:
          "Client company details used for projects and contact records.",
        organizationIndividual: "Client",
        organizationIndividualDesc:
          "Personal details used for projects and contact records.",
        clientName: "Client Name",
        firstName: "First Name",
        lastName: "Last Name",
        shortCode: "Client ID",
        shortCodeHint:
          "Auto-assigned ID used in tax invoice and payment-proof filenames (e.g. C001).",
        shortCodePreviewHint:
          "Preview of the next Client ID. The final ID is assigned when you save.",
        shortCodeLoading: "Loading…",
        companyEmail: "Company Email",
        companyPhone: "Company Phone",
        email: "Email",
        phone: "Phone",
        address: "Address",
        companyNpwp: "NPWP",
        companyNpwpHint:
          "Required. Enter exactly 15 or 16 digits (dots/dashes OK).",
        clientNpwpOrNik: "NPWP / NIK",
        clientNpwpOrNikHint:
          "Required. Enter exactly 15 or 16 digits (dots/dashes OK).",
        taxIdDocumentCompany: "NPWP Document",
        taxIdDocumentIndividual: "NPWP / NIK Document",
        taxIdDocumentUploadCompany: "Upload NPWP Document (Photo Or Scan)",
        taxIdDocumentUploadIndividual: "Upload NPWP Or NIK Document (Photo Or Scan)",
        taxIdDocumentReplace: "Replace Tax ID Document (Photo Or Scan)",
        taxIdDocumentCurrent: "Current Tax ID Document:",
        taxIdDocumentView: "View File",
        taxIdDocumentHintCompany:
          "Required. Upload a clear photo or PDF of the company NPWP.",
        taxIdDocumentHintIndividual:
          "Required. Upload a clear photo or PDF of the NPWP or NIK.",
        taxIdDocumentHintEdit:
          "Keep the current file, or upload a replacement photo or PDF.",
        clientSince: "Client Since",
        clientSinceHint: "When this organization became an RGS client.",
        clientSinceHintIndividual: "When this person became an RGS client.",
        contactPerson: "Contact Person",
        contactPersonDescCreate:
          "Primary point of contact at the client organization.",
        contactPersonDescEdit:
          "Primary point of contact at the client organization.",
        contactFirstName: "Contact Person First Name",
        contactLastName: "Contact Person Last Name",
        contactPosition: "Contact Person Position",
        contactEmail: "Contact Person Email",
        contactPhone: "Contact Person Phone",
        portalAccess: "Portal Access",
        portalAccessDesc:
          "A portal Login ID is always created from the company name. Revoke access later in Users if needed.",
        portalAccessDescIndividual:
          "A portal Login ID is always created from their name. Revoke access later in Users if needed.",
        clientType: "Client Type",
        clientTypeCompany: "Company",
        clientTypeIndividual: "Individual",
        loginId: "Login ID",
        loginIdHint:
          "Eight letters from the company name. Pick a suggestion or edit, then regenerate if needed.",
        loginIdHintIndividual:
          "Eight letters from their name. Pick a suggestion or edit, then regenerate if needed.",
        loginIdInvalid: "Login ID must be exactly 8 letters (a–z).",
        regenerateLoginId: "Regenerate",
        multiProjectAccess: "Multi-Project Access",
        multiProjectAccessHint:
          "Off by default for individuals. When on with two or more projects, Admin can group projects and set a Security Code."
      },
      multiProject: {
        title: "Multi-Project Access",
        description:
          "Group projects and set Security Codes. Access becomes active with two or more projects while this is on.",
        loading: "Loading Multi-Project Access…",
        loadFailed: "Could not load Multi-Project Access.",
        retry: "Try Again",
        enabled: "Multi-Project Access",
        securityMode: "Security Mode",
        modeGroupOnly: "Group Only",
        modeMasterAndGroup: "Master And Group",
        readyTitle: "Multi-Project Access Is Ready",
        readyBody:
          "This client now has two or more projects and Multi-Project Access is on. Group their projects and set Security Codes, or turn Multi-Project Access off if they should open every project without a code.",
        groups: "Project Groups",
        groupName: "Group Name",
        addGroup: "Add Group",
        addGroupHint:
          "Name the group only. Then tick the projects that belong in it and use Assign To Group. Leftover projects stay ungrouped.",
        ungrouped: "Ungrouped Projects",
        ungroupedWarning:
          "Ungrouped projects stay inaccessible in the client portal while Multi-Project Access is active.",
        masterCode: "Master Security Code",
        groupCode: "Group Security Code",
        generateCode: "Generate Security Code",
        regenerateCode: "Regenerate Security Code",
        regenerateCodeConfirm:
          "Regenerate this Security Code? The current code will stop working.",
        codeHint: "Hint (last 2): {hint}",
        codeMissingFull:
          "The full Security Code is not on file. Regenerate to create a new one you can copy.",
        noCodeYet: "No active code",
        assign: "Assign To Group",
        assignTo: "Assign To",
        groupRequiredToAssign: "Choose a group first.",
        projectsRequiredToAssign: "Select at least one project to assign.",
        countable: "{count} countable projects",
        activeBadge: "Active",
        armedBadge: "Armed",
        saveSettings: "Save Multi-Project Settings",
        saveFailed: "Failed to save Multi-Project settings.",
        generateCodeFailed: "Failed to generate Security Code.",
        addGroupFailed: "Failed to add group.",
        deleteGroupFailed: "Failed to delete group.",
        assignFailed: "Failed to assign projects.",
        codeCopied: "Security Code copied.",
        copyFailed: "Could not copy. Select and copy manually.",
        groupNameRequired: "Group name is required.",
        groupNotFound: "Group not found.",
        groupRequiredForCode: "Group is required for a Group code.",
        masterCodeNoGroup: "Master Security Code cannot be tied to a group.",
        masterCodeGroupOnlyMode:
          "Master Security Code is not used in Group Only mode. Switch to Master And Group first.",
        notAuthorized: "Not authorized to manage clients."
      }
    },
    multiProjectUnlock: {
      title: "Enter Security Code",
      description: "Unlock project access for {client}.",
      picName: "PIC Name",
      picNameHint: "Enter the contact person name on file for this client.",
      securityCode: "Security Code",
      unlock: "Unlock",
      unlocking: "Unlocking...",
      changeCode: "Change Security Code"
    },
    vendors: {
      title: "Vendors",
      descriptionAdmin: "Manage vendor and supplier organizations.",
      directoryTitle: "Vendor Directory",
      directoryDesc:
        "Supplier organization records, contact details, and payment terms. Vendors are Head Office managed only — there is no vendor portal.",
      companyNotFound: "Company not found.",
      addVendor: "Add Vendor",
      bulkCreateTitle: "Add vendors in bulk",
      bulkCreateDesc:
        "Add more than one vendor at once. Each line is the same as Add Vendor — fill everything in for that vendor.",
      bulkCreateLines: "Vendors",
      bulkCreateLinesHint:
        "Each line is a full vendor record. There are no shared terms.",
      editVendor: "Edit Vendor",
      searchPlaceholder: "Search vendors...",
      deleted: "Deleted",
      active: "Active",
      activeSubtitle: "Vendor organizations currently enabled",
      deletedSubtitle: "Soft-deleted vendors until restored",
      emptyTrash:
        "Deleted vendors appear here until restored or permanently deleted.",
      emptyActive: "No vendors yet",
      emptyActiveList: "No active vendors",
      emptyActiveListDesc: "No vendor organizations to show.",
      emptyDeletedList: "No deleted vendors",
      emptySearch: 'No results for "{query}"',
      emptySearchDesc:
        "Try a different company name, address, contact, or contact person.",
      deleteTitle: "Delete vendor?",
      deleteConfirm: "Delete vendor",
      deleteDescription:
        "This moves the vendor organization to Deleted vendors. The record is kept and can be restored later.",
      deleteSoftNote:
        "Linked portal logins are disabled (not permanently deleted) and move to Deleted users. Credentials are kept. After you restore this vendor, use Users → Revoked Access → Restore Access to re-enable portal login.",
      checkingSoftDelete: "Checking whether this vendor can be deleted…",
      softDeleteBlockedTitle: "Cannot delete this vendor yet",
      softDeleteBlocked:
        "Cannot delete this vendor while money is still owed or tax documents are still pending: {blockers}.",
      softDeleteBlockers: {
        outstandingPayables: "{count} outstanding payable(s)",
        pendingTaxInvoices: "{count} outstanding tax invoice(s)"
      },
      deleteForeverTitle: "Delete vendor forever?",
      deleteForeverConfirm: "Delete forever",
      deleteForeverDescription:
        "This vendor organization will be permanently removed. Linked portal logins are permanently deleted. This action cannot be undone.",
      deleteForeverNote:
        "Only deleted vendors can be permanently deleted. Linked portal logins are permanently deleted and cannot be restored. This action cannot be undone.",
      restoreTitle: "Restore vendor?",
      restoreConfirm: "Restore vendor",
      restoreDescription:
        "This restores the vendor organization from Deleted vendors. Linked portal logins stay off — use Users → Revoked Access → Restore Access before they can sign in again.",
      restoreSoftNote:
        "Username and credentials stay preserved. After restore, linked logins appear under Revoked Access until you restore access. The vendor will appear in the active directory again. Vendors deleted forever cannot be restored.",
      editDescription:
        "Update organization contact details. Soft-delete only via Delete. Manage portal logins in Users.",
      savedToast: "Vendor saved.",
      createFailed: "Failed to create vendor.",
      updateFailed: "Failed to update vendor.",
      deleteFailed: "Failed to delete vendor.",
      restoreFailed: "Failed to restore vendor.",
      notFound: "Vendor not found.",
      alreadyDeleted: "Vendor is already deleted.",
      alreadyActive: "Vendor is already active.",
      permissionDenied: "You do not have permission to manage vendors.",
      vendorNameRequired: "Vendor name is required.",
      firstNameRequired: "First name is required.",
      contactFirstNameRequired: "Contact person first name is required.",
      permanentDeleteRequiresDeleted:
        "Only deleted vendors can be permanently deleted. Delete the vendor first.",
      selectAll: "Select All Vendors",
      selectRow: "Select {name}",
      bulkDeleteTitle: "Delete {count} vendors?",
      bulkDeleteForeverTitle: "Delete {count} vendors forever?",
      bulkDeleteConfirm: "Delete {count} vendors",
      bulkDeleteForeverConfirm: "Delete {count} forever",
      bulkRestoreTitle: "Restore {count} vendors?",
      bulkRestoreConfirm: "Restore {count} vendors",
      bulkSelected: "{count} vendors selected",
      bulkActionApplies:
        "This action applies to all selected rows in the current view.",
      bulkDeleteForeverNote:
        "Linked portal logins are permanently deleted and cannot be restored. This action cannot be undone.",
      bulkRestoreNote:
        "Username and credentials stay preserved. Restored vendors appear in the active directory; linked logins move to Revoked Access.",
      bulkDeactivateSuccess: "{count} vendor(s) moved to Deleted vendors.",
      bulkDeactivateAllFailed:
        "Could not delete selected vendors. {detail}",
      bulkDeactivatePartial:
        "{success} vendor(s) moved to Deleted vendors. {failed} failed.",
      bulkDeleteForeverSuccess: "{count} vendor(s) permanently removed.",
      bulkDeleteForeverAllFailed:
        "Could not permanently delete selected vendors. {detail}",
      bulkDeleteForeverPartial:
        "{success} vendor(s) permanently removed. {failed} failed.",
      bulkRestoreSuccess:
        "{count} vendor(s) restored. Linked logins stay off until Restore Access.",
      bulkRestoreAllFailed: "Could not restore selected vendors. {detail}",
      bulkRestorePartial:
        "{success} vendor(s) restored. Linked logins stay off until Restore Access. {failed} failed.",
      columns: {
        vendor: "Vendor",
        shortCode: "Vendor ID",
        contact: "Contact",
        vendorSince: "Vendor Since",
        actions: "Actions"
      },
      form: {
        organization: "Organization",
        organizationDesc:
          "Vendor company details used for purchases and contact records.",
        organizationIndividual: "Vendor",
        organizationIndividualDesc:
          "Personal details used for purchases and contact records.",
        organizationOverseas: "Overseas Vendor",
        organizationOverseasDesc:
          "A supplier outside Indonesia. Indonesian Tax ID is not required.",
        vendorName: "Vendor Name",
        firstName: "First Name",
        lastName: "Last Name",
        shortCode: "Vendor ID",
        shortCodeHint:
          "Auto-assigned ID used for vendor references (e.g. V001).",
        shortCodePreviewHint:
          "Preview of the next Vendor ID. The final ID is assigned when you save.",
        shortCodeLoading: "Loading…",
        companyEmail: "Company Email",
        companyPhone: "Company Phone",
        companyAddress: "Company Address",
        email: "Email",
        phone: "Phone",
        address: "Address",
        companyNpwp: "NPWP",
        companyNpwpHint:
          "Required. Enter exactly 15 or 16 digits (dots/dashes OK).",
        vendorNpwpOrNik: "NPWP / NIK",
        vendorNpwpOrNikHint:
          "Required. Enter exactly 15 or 16 digits (dots/dashes OK).",
        taxIdDocumentCompany: "NPWP Document",
        taxIdDocumentIndividual: "NPWP / NIK Document",
        taxIdDocumentUploadCompany: "Upload NPWP Document (Photo Or Scan)",
        taxIdDocumentUploadIndividual: "Upload NPWP Or NIK Document (Photo Or Scan)",
        taxIdDocumentReplace: "Replace Tax ID Document (Photo Or Scan)",
        taxIdDocumentCurrent: "Current Tax ID Document:",
        taxIdDocumentView: "View File",
        taxIdDocumentHintCompany:
          "Required. Upload a clear photo or PDF of the company NPWP.",
        taxIdDocumentHintIndividual:
          "Required. Upload a clear photo or PDF of the NPWP or NIK.",
        taxIdDocumentHintEdit:
          "Keep the current file, or upload a replacement photo or PDF.",
        vendorSince: "Vendor Since",
        vendorSinceHint: "When this organization became an RGS vendor.",
        vendorSinceHintIndividual: "When this person became an RGS vendor.",
        contactPerson: "Contact Person",
        contactPersonDescCreate:
          "Primary point of contact at the vendor organization.",
        contactPersonDescEdit:
          "Primary point of contact at the vendor organization.",
        contactFirstName: "Contact Person First Name",
        contactLastName: "Contact Person Last Name",
        contactPosition: "Contact Person Position",
        contactEmail: "Contact Person Email",
        contactPhone: "Contact Person Phone",
        vendorType: "Vendor Type",
        vendorTypeCompany: "Company",
        vendorTypeIndividual: "Individual",
        vendorTypeOverseas: "Overseas"
      }
    },
    employees: {
      title: "Employees",
      descriptionAdmin: "Manage head-office and field staff records.",
      directoryTitle: "Employee Directory",
      directoryDesc:
        "Staff records, department assignments, and site placements. Portal login access is optional on create and managed in Users.",
      companyNotFound: "Company not found.",
      addEmployee: "Add Employee",
      addBulk: "Add Bulk",
      addBulkFullTime: "Add Bulk Full Time",
      addBulkPartTime: "Add Bulk Part Time",
      bulkCreateFullTimeTitle: "Add Full Time employees",
      bulkCreatePartTimeTitle: "Add Part Time employees",
      bulkCreateDesc:
        "Add more than one employee at once. Each line is the same as Add Employee — fill everything in for that person.",
      bulkCreatePeople: "People",
      bulkCreatePeopleHint:
        "Each line is a full employee record. There are no shared terms.",
      editEmployee: "Edit Employee",
      searchPlaceholder: "Search Employees...",
      deleted: "Deleted",
      active: "Active",
      onLeave: "On Leave",
      onLeaveChipLine1: "On",
      onLeaveChipLine2: "Leave",
      leavePending: "Applying for Leave",
      leavePendingChipLine1: "Applying",
      leavePendingChipLine2: "For Leave",
      leavePendingFilter: "Applying for Leave",
      statusFilterAll: "All",
      emptyOnLeave: "No On Leave Employees",
      emptyOnLeaveDesc:
        "Employees marked On Leave in this view appear here.",
      emptyLeavePending: "No Employees Applying for Leave",
      emptyLeavePendingDesc:
        "Employees with a pending leave request appear here while their status stays Active.",
      allEmployees: "All Employees",
      allEmployeesSubtitle: "All active staff on the roster",
      fullTime: "Full Time",
      fullTimeSubtitle: "Assigned Full Time staff (Head Office or On Project)",
      partTime: "Part Time",
      partTimeSubtitle: "Assigned Part Time staff (On Project or Head Office)",
      managePositions: "Manage Positions",
      employeePositionsDescription:
        "Define job positions within each department.",
      positionCount: "{count} positions",
      positionCountOne: "{count} position",
      addPosition: "Add Position",
      emptyPositions: "No positions configured.",
      emptyPositionsDepartment: "No positions in this department.",
      deletedSubtitle: "Soft-deleted employees until restored",
      unassigned: "Unassigned",
      unassignedSubtitle: "Active staff waiting for Head Office or a project",
      filterDepartment: "Filter By Department",
      selectAll: "Select All Employees",
      selectRow: "Select {name}",
      emptyTrash:
        "Deleted employees appear here until restored or permanently removed from the directory.",
      emptyFullTime: "No Assigned Full Time Employees",
      emptyFullTimeDesc:
        "Full Time staff assigned to Head Office or a project appear here.",
      emptyPartTime: "No Assigned Part Time Employees",
      emptyPartTimeDesc:
        "Part Time staff assigned to a project or Head Office appear here.",
      emptyActive: "No Employees Yet",
      emptyActiveList: "No Active Employees",
      emptyActiveListDesc: "No employees to show.",
      emptyDeletedList: "No Deleted Employees",
      emptyUnassigned: "No Unassigned Employees",
      emptyUnassignedFt: "No Unassigned Full Time Employees",
      emptyUnassignedFtDesc:
        "Full Time staff waiting for Head Office or a project appear here.",
      emptyUnassignedPt: "No Unassigned Part Time Employees",
      emptyUnassignedPtDesc:
        "Part Time staff waiting for a project or Head Office appear here.",
      emptySearch: 'No Results For "{query}"',
      emptySearchDesc:
        "Try a different name, employee number, position, department, email, or phone.",
      emptyDepartment: "No {name} ({prefix}) Employees",
      emptyDepartmentDesc:
        "No employees in this department in the current view.",
      deleteTitle: "Delete Employee?",
      deleteConfirm: "Delete Employee",
      deleteDescription:
        "This moves the employee to Deleted Employees. Their record is kept for history but they will no longer appear as active staff.",
      deleteForeverTitle: "Delete Employee Forever?",
      deleteForeverConfirm: "Delete Forever",
      deleteForeverDescription:
        "This employee will be permanently hidden from the directory. Their linked user login and employee number are permanently released. Database records and historical data are kept for audit purposes.",
      restoreTitle: "Restore Employee?",
      restoreConfirm: "Restore Employee",
      restoreDescription:
        "This restores the employee from Deleted Employees. Linked login stays off — use Users → Revoked Access → Restore Access before they can sign in again.",
      restoreNote:
        "Username and credentials stay preserved. After restore, the linked login appears under Revoked Access until you restore access. Historical records (attendance, leave, progress) remain intact. Employees deleted forever cannot be restored.",
      editDescription:
        "Update employee details, department, and site assignments.",
      bulkDeleteTitle: "Delete {count} employees?",
      bulkDeleteForeverTitle: "Delete {count} employees forever?",
      bulkDeleteConfirm: "Delete {count} employees",
      bulkDeleteForeverConfirm: "Delete {count} forever",
      bulkRestoreTitle: "Restore {count} employees?",
      bulkRestoreConfirm: "Restore {count} employees",
      bulkSelected: "{count} employees selected",
      bulkActionApplies:
        "This action applies to all selected rows in the current view.",
      bulkDeactivateNote:
        "Linked user logins are disabled (not permanently deleted) and move to Deleted users. Credentials are kept. After restoring employees, use Users → Revoked Access → Restore Access to re-enable portal login. Historical records (attendance, leave, progress) are not deleted.",
      bulkDeleteForeverNote:
        "Linked user logins are permanently deleted and cannot be restored. Employee numbers become available for the next new hires in those departments. Attendance, leave, progress, and other historical records remain in the system. This action cannot be undone from the directory UI.",
      bulkRestoreNote:
        "Username and credentials stay preserved. Restored employees appear in the active directory; linked logins move to Revoked Access. Employees deleted forever cannot be restored.",
      bulkRestoreSuccess:
        "{count} employee(s) restored. Linked logins stay off until Restore Access.",
      bulkRestoreAllFailed: "Could not restore selected employees. {detail}",
      bulkRestorePartial:
        "{success} employee(s) restored. Linked logins stay off until Restore Access. {failed} failed.",
      bulkDeactivateSuccess:
        "{count} employee(s) moved to Deleted Employees.",
      bulkDeactivateAllFailed:
        "Could not delete selected employees. {detail}",
      bulkDeactivatePartial:
        "{success} employee(s) moved to Deleted Employees. {failed} failed.",
      bulkDeleteForeverSuccess:
        "{count} employee(s) permanently removed from directory.",
      bulkDeleteForeverAllFailed:
        "Could not permanently remove selected employees. {detail}",
      bulkDeleteForeverPartial:
        "{success} employee(s) permanently removed from directory. {failed} failed.",
      deleteFailed: "Failed to delete employee.",
      portalLoginRevoked:
        "{name}: already has a portal login. Use Users → Revoked Access → Restore Access if it is revoked.",
      errors: {
        deleteBlockedAssigned:
          "Cannot delete this employee while they are still assigned to a project. Release or unassign them first.",
        activeBlockedByApprovedLeave:
          "Cannot set employment status to Active while an approved leave covers today.",
        resignHoOnly: "Only Head Office can resign an employee.",
        resignFailed: "Could not resign this employee.",
        lastWorkingDayRequired: "Please enter the last working day.",
        procedureRequired: "Please choose According to procedure or Not according to procedure.",
        alreadyResigned: "This employee is already resigned or has a resign on file."
      },
      resign: "Resign",
      resignTitle: "Resign Employee",
      resignDescription: "Record resignation for {name}. This choice decides whether the security deposit is returned or kept by the company.",
      resignConfirm: "Resign Employee",
      resigning: "Resigning…",
      lastWorkingDay: "Last Working Day",
      resignProcedure: "Procedure",
      accordingToProcedure: "According To Procedure",
      accordingToProcedureHint:
        "Status becomes Resigned after the last working day. A held security deposit is returned on Internal Payroll as Return of security deposit.",
      notAccordingToProcedure: "Not According To Procedure",
      notAccordingToProcedureHint:
        "Status becomes Resigned after the last working day. A held security deposit is kept by the company. Last month wages still generate unless you choose not to pay the remaining wage.",
      forfeitRemainingWages: "Do Not Pay Remaining Wage",
      forfeitRemainingWagesHint:
        "They receive no Internal Payroll for unpaid days. That amount becomes income on their last project. Use this if they stole, disappeared, or left without following procedure.",
      resignNote: "Note (Optional)",
      depositHeldNote: "Security deposit held: {amount}.",
      depositStatusHeld: "On Hold",
      depositStatusReturned: "Refunded",
      depositStatusKept: "Kept By The Company",
      depositStatusNotHeld: "Not Held",
      depositStatusNotRequired: "Not Required",
      restoreFailed: "Failed to restore employee.",
      deleteForeverFailed:
        "Failed to permanently remove employee from directory.",
      reorderFailed: "Failed to reorder employees.",
      portalStatus: {
        yes: "Yes",
        revoked: "Revoked",
        no: "No"
      },
      projectAssignDialog: {
        title: "Assign To Head Office",
        description:
          "Assign this employee to Head Office. Site crew is assigned under Projects.",
        headOffice: "Head Office",
        siteCrewNote:
          "To assign staff to a cleaning site, use Projects → assign crew on the project.",
        assign: "Assign To Head Office",
        assigning: "Assigning…",
        assignFailed: "Failed to assign employee."
      },
      columns: {
        employee: "Employee",
        status: "Status",
        employeeNo: "ID",
        department: "Department",
        position: "Position",
        team: "Team",
        employmentType: "Employment Type",
        placement: "Placement",
        portalLogin: "Portal Login",
        securityDeposit: "Security Deposit",
        actions: "Actions"
      },
      manageDepartments: "Manage Departments",
      employeeDepartmentsTitle: "Employee Departments",
      employeeDepartmentsDescription:
        "Define departments such as Corporate or Operations. Departments control organization and employee numbering. Placement (Available / On project / Head Office / Field) is system-driven via Assign and Release. Finance roles live as positions under Corporate.",
      departmentCount: "{count} departments",
      departmentCountOne: "{count} department",
      addDepartment: "Add Department",
      emptyDepartments: "No departments yet. Add one to organize employees.",
      positionDialog: {
        createTitle: "Add Position",
        createDescription:
          "Add a job position for a department and set the default module access for new logins.",
        moduleAccess: "Default Module Access",
        moduleAccessHint:
          "New portal logins for this position start with these modules. To give one person more access, use Users → Permissions.",
        createButton: "Add Position",
        creating: "Adding…",
        editTitle: "Edit Position",
        positionName: "Position Name",
        selectDepartment: "Select Department",
        availableForNew: "Available For New Employees",
        employeeCountOne: "{count} employee uses this position.",
        employeeCountOther: "{count} employees use this position.",
        createFailed: "Failed to create position.",
        updateFailed: "Failed to update position.",
        deleteFailed: "Failed to delete position.",
        reorderFailed: "Failed to reorder positions.",
        deleteTitle: "Delete Position",
        deleteConfirm: "Delete Position",
        deleteDescWithEmployees:
          "Reassign employees before deleting this position.",
        deleteDescEmpty: "This position has no employees.",
        employeesReassignedOne: "{count} employee will be reassigned.",
        employeesReassignedOther: "{count} employees will be reassigned.",
        selectReplacement: "Select Replacement Position"
      },
      deptDialog: {
        createTitle: "Create Department",
        createDescription:
          "Add a department for grouping and numbering employees.",
        createButton: "Create Department",
        creating: "Creating...",
        editTitle: "Edit Department",
        editDescription: "Update the department name or availability.",
        departmentName: "Department Name",
        namePlaceholder: "e.g. Cleaning Staff",
        numberPrefix: "Number Prefix",
        prefixPlaceholder: "e.g. CS",
        prefixHint: "Employee numbers will use this prefix, e.g. CS-001",
        prefixHintEdit: "Used for employee numbers, e.g. {prefix}-001",
        activeAvailable: "Active (available for new assignments)",
        employeeCountOne: "{count} employee assigned",
        employeeCountOther: "{count} employees assigned",
        createFailed: "Failed to create department.",
        updateFailed: "Failed to update department.",
        deleteFailed: "Failed to delete department.",
        reorderFailed: "Failed to reorder departments.",
        deleteTitle: "Delete Department?",
        deleteConfirm: "Delete Department",
        deleteDescWithEmployees:
          "Choose where to move assigned employees before deleting this department.",
        deleteDescEmpty: "This department will be permanently removed.",
        employeesAssignedOne:
          "There is {count} employee assigned to this department.",
        employeesAssignedOther:
          "There are {count} employees assigned to this department.",
        moveEmployeesTo: "Move Employees To",
        selectDestination: "Select Destination",
        reassignHint:
          "Employees moved to another department receive a new employee number for that department. Employees moved to Unassign keep a UNA number; portal login is paused until they are reassigned.",
        noEmployeesAssigned:
          "No employees are assigned. This action cannot be undone."
      },

      form: {
        department: "Department",
        departmentControlsHint:
          "Department controls organization and employee numbering.",
        placement: "Placement",
        placementHint:
          "Department is organization and numbering; placement is where they work.",
        placementManaged:
          "{label} — managed through Assign / Release.",
        employmentType: "Employment Type",
        selectEmploymentType: "Select Employment Type",
        inHouseCleaningAssignHint:
          "In-House Cleaning Staff: assign them to the Internal Head Office or Warehouse project for CICO (department tells which site).",
        warehouseStaffPortalHint:
          "Warehouse Staff start without portal login. The Warehouse Supervisor runs Transfer Orders. You can generate a login later in Users if needed.",
        status: "Status",
        statusActiveHint:
          "On Leave is set when an approved leave period includes today. Active staff can use CICO and Progress.",
        statusOnLeaveHint:
          "On Leave from an approved leave request. CICO and Progress are paused until the leave period ends.",
        statusLeavePendingHint:
          "A leave request is pending approval. Employment status stays Active; CICO and Progress continue as usual.",
        selectDepartment: "Select department",
        selectPosition: "Select position",
        employeeNumber: "Employee Number",
        employeeNoPreview:
          "Preview of the next number for the selected department.",
        employeeNoBulkPreview:
          "First number preview. Each extra line takes the next number when you save.",
        employmentTypeBulkLocked:
          "This bulk add is locked to {type}.",
        employeeNoReassign:
          "Department changed — employee will be reassigned to the next available number.",
        employeeNoLocked: "Assigned number cannot be changed.",
        selectDeptFirst: "Select a department first",
        firstName: "First Name",
        lastName: "Last Name",
        position: "Position",
        positionHint:
          "Choose a position available for the selected department.",
        approvalAreas: "Approval Areas",
        approvalAreasHint:
          "Select at least one area this Operations Manager may approve — Cleaning, Landscaping, Security, Parking for site crews, and Head Office for desk staff leave.",
        manageAllProjects: "Access to All Projects",
        manageAllProjectsHintOm:
          "On: this Operations Manager covers every project in the ticked Approval Areas. Off: pick the projects one by one.",
        manageAllProjectsHintAm:
          "On: this Area Manager covers every project. Off: pick the projects one by one.",
        areaProjects: "Covered Projects",
        areaProjectsHint:
          "Tick the projects this person may manage. Leave Access to All Projects off to use this list.",
        areaProjectsEmpty:
          "No client projects are available yet. Add a project first.",
        areaProjectsSearch: "Search by project, client, or location",
        areaProjectsSelected: "{count} selected",
        areaProjectsNoneMatch: "No projects match “{query}”.",
        startDate: "Start Date",
        startDateHint: "Employee hire or start date for tenure tracking.",
        contactEmail: "Contact email",
        portalLogin: "Portal Login",
        finances: "Finances",
        financesHint:
          "Base pay and BPJS settings. Contributions recalculate as you change options.",
        financesHintPartTime:
          "Part Time staff are paid per day. Security Deposit is not collected. BPJS Ketenagakerjaan and BPJS Kesehatan are not enrolled.",
        partTimeExemptNote:
          "Paid per day, so Security Deposit is not collected. Exempt from BPJS Ketenagakerjaan and BPJS Kesehatan.",
        securityDepositRequired: "Security Deposit",
        securityDepositRequiredHint:
          "When on, Internal Payroll can take a security deposit for this person. Head Office can turn this on or off for any role.",
        cicoExempt: "Exempt From CICO",
        cicoExemptHint:
          "When on, this person does not check in or check out. Internal Payroll pays their full monthly wage automatically.",
        progressExempt: "Exempt From Progress Report",
        progressExemptHint:
          "When on, this person still checks in and out, but does not submit a Progress Report. Check-out is not blocked waiting for a report.",
        bankName: "Bank Name",
        bankAccountNumber: "Account Number",
        bankAccountName: "Account Holder Name",
        bankHint:
          "Printed on the Internal Payroll PDF so wages can be transferred. The account holder name must match the bank book.",
        basePay: "Base Pay",
        basePayHint: "Monthly wage in IDR used for BPJS and THR calculations.",
        basePayHintPartTime: "Daily wage in IDR. Part Time staff are paid per day.",
        bpjsKesehatan: "BPJS Kesehatan",
        bpjsKesehatanHelp:
          "Total 5% of monthly wage (capped at Rp 12,000,000): 4% company, 1% employee.",
        bpjsKetenagakerjaan: "BPJS Ketenagakerjaan",
        bpjsTkComponents: "Employment Components",
        bpjsTkHelpJht:
          "Jaminan Hari Tua — 3.7% company / 2% employee.",
        bpjsTkHelpJp:
          "Jaminan Pensiun — 2% company / 1% employee (wage cap Rp 10,547,400).",
        bpjsTkHelpJkk:
          "Jaminan Kecelakaan Kerja — company only at the rate you enter.",
        bpjsTkHelpJkm:
          "Jaminan Kematian — 0.3% company only.",
        jht: "Jaminan Hari Tua",
        jp: "Jaminan Pensiun",
        jkk: "Jaminan Kecelakaan Kerja",
        jkm: "Jaminan Kematian",
        jkkPercent: "Jaminan Kecelakaan Kerja Percent",
        jkkPercentHint: "Company rate from {min}% to {max}%.",
        employeeDeduction: "Employee Deduction",
        companyContribution: "Company Contribution",
        takeHomeFromBase: "Take-Home From Base",
        totalEmployerCost: "Total Employer Cost",
        onLeaveNotAssignable:
          "On Leave employees cannot be assigned. Set status to Active first.",
        idDocumentCurrent: "Current ID document:",
        idDocumentView: "View file",
        idDocumentUpload: "Upload ID document (photo or scan)",
        idDocumentReplace: "Replace ID document (photo or scan)",
        createFailed: "Failed to create employee.",
        updateFailed: "Failed to update employee.",
        releaseFailed: "Failed to release employee.",
        assignToHeadOffice: "Assign To Head Office",
        releaseFromAssignment: "Release Assignment"
      }
    },
    users: {
      title: "Users",
      description:
        "Manage ERP login accounts, restore access, and generate portal logins for clients and employees that need them.",
      directoryTitle: "User Accounts",
      directoryDesc:
        "Manage ERP login accounts. Generate a login from an existing employee, or from a client for portal access.",
      showingForClient: "Showing portal users for {name}.",
      editUser: "Edit User Account",
      searchPlaceholder: "Search users...",
      deleted: "Deleted",
      deletedClient: "Deleted Client",
      deletedEmployee: "Deleted Employee",
      withoutPortal: "Without portal login",
      noPortalLogin: "No Portal Login",
      noPortalLoginSubtitle:
        "No linked User — includes soft-deleted until permanently deleted",
      revokedAccess: "Revoked Access",
      revokedAccessSubtitle:
        "Logins disabled; credentials kept — restore to re-enable",
      active: "Active",
      activeSubtitle: "Login accounts currently enabled",
      deletedClientSubtitle: "Soft-deleted client portal logins",
      deletedEmployeeSubtitle: "Soft-deleted employee logins",
      restoreSelected: "Restore selected",
      permanentlyRemoveLogin1: "Permanently",
      permanentlyRemoveLogin2: "Remove Login",
      revoke1: "Revoke",
      revoke2: "Access",
      restore1: "Restore",
      restore2: "Access",
      moduleAccess: "{enabled}/{total} module access",
      accountOne: "account",
      accountOther: "accounts",
      sections: {
        admin: "Admin",
        clients: "Clients",
        employees: "Employees"
      },
      emptyTrash:
        "Deleted accounts appear here until restored or permanently deleted.",
      emptyActive: "No user accounts yet",
      emptyActiveList: "No active accounts",
      emptyActiveListDesc: "Enabled login accounts appear here.",
      emptyRevoked: "No revoked-access accounts",
      emptyRevokedDesc:
        "Logins disabled while the linked employee or client is still active appear here.",
      emptyDeletedClient: "No deleted client accounts",
      emptyDeletedClientDesc:
        "Soft-deleted client portal logins appear here until restored or permanently deleted.",
      emptyDeletedEmployee: "No deleted employee accounts",
      emptyDeletedEmployeeDesc:
        "Soft-deleted employee logins appear here until restored or permanently deleted.",
      emptyDeletedList: "No deleted users",
      emptySearch: 'No results for "{query}"',
      emptySearchDesc:
        "Try a different name, username, email, employee, or client.",
      emptyType: "No {type} accounts",
      emptyTypeDesc: "Try another account type filter or status card.",
      deleteTitle: "Delete user account?",
      deleteConfirm: "Delete Account",
      deleteDescription:
        "This soft-deletes the login. Linked employees or clients are soft-deleted too so the account appears under Deleted users until restored.",
      deleteForeverTitle: "Delete Account Forever?",
      deleteForeverConfirm: "Delete Forever",
      deleteForeverDescription:
        "This user account will be permanently removed from the system. This action cannot be undone.",
      restoreTitle: "Restore User Account?",
      restoreConfirm: "Restore Account",
      restoreDescription:
        "This restores soft-deleted linked employees or clients to the active roster. Linked logins stay off and move to Revoked Access until access is restored. Unlinked admin accounts are re-enabled.",
      restoreAccessTitle: "Restore login access?",
      restoreAccessDescription:
        "This re-enables the revoked login. The linked employee or client stays Active; credentials are unchanged.",
      revokeAccess: "Revoke Access",
      restoreAccess: "Restore Access",
      permissions: "Permissions",
      permissionsTitle: "Module Permissions",
      savePermissions: "Save Permissions",
      resetPermissions: "Reset To Defaults",
      generatePortalLogin: "Generate Portal Login",
      revokeAccessTitle: "Revoke Access?",
      revokeAccessDescription:
        "This disables the login. Credentials are kept so access can be restored later.",
      revokeAccessConfirm: "Revoke Access",
      revoking: "Revoking...",
      accessRevokedFor: "Access revoked for {name}.",
      revokeFailed: "Failed to revoke access.",
      bulkRevokeTitle: "Revoke Access for {count} Accounts?",
      bulkRevokeDescription:
        "This disables the selected logins. Credentials are kept so access can be restored later.",
      bulkRevokeConfirm: "Revoke Access for {count}",
      noEligibleRevoke: "No eligible accounts to revoke.",
      permanentlyRemoveTitle: "Permanently Remove Portal Login Access?",
      permanentlyRemoveDescription:
        "This permanently deletes the portal login. The linked employee or client record is kept, but they will no longer be able to sign in unless a new login is generated.",
      permanentlyRemoveConfirm: "Permanently Remove Login",
      permanentlyRemoving: "Removing...",
      permanentlyRemoveFailed: "Failed to permanently remove portal login.",
      bulkPermanentlyRemoveTitle:
        "Permanently Remove Portal Login for {count} Accounts?",
      bulkPermanentlyRemoveDescription:
        "This permanently deletes the selected portal logins. Linked employee or client records are kept.",
      bulkPermanentlyRemoveConfirm: "Permanently Remove {count}",
      noEligiblePermanentlyRemove:
        "No eligible accounts to permanently remove.",
      generatePortalTitle: "Generate Portal Login",
      generatePortalConfirmClients:
        "Create portal logins for {count} selected clients?",
      generatePortalConfirmEmployees:
        "Create portal logins for {count} selected employees?",
      generatePortalConfirmMixed:
        "Create portal logins for {count} selected accounts?",
      generatePortalButton: "Generate {count} Logins",
      generatePortalButtonOne: "Generate {count} Login",
      generating: "Generating...",
      generateEmployeeTitle: "Generate Portal Login?",
      generateEmployeeDescription:
        "Create a linked Users portal login for this employee. Username is based on first name.",
      generateClientTitle: "Generate Portal Login?",
      generateClientDescription:
        "Create a linked Users portal login for this client. Login ID is an 8-letter id from the client name.",
      generateFailed: "Failed to generate portal login.",
      withoutPortalSearch: "Search clients...",
      withoutPortalEmpty: "Everyone already has a portal login",
      withoutPortalEmptyDesc:
        "Clients and employees without a linked Users login appear here.",
      withoutPortalClients: "Clients",
      withoutPortalEmployees: "Employees",
      withoutPortalEmptyClients: "No clients without portal login.",
      withoutPortalEmptyEmployees: "No employees without portal login.",
      withoutPortalRestoreHint:
        "Soft-deleted records stay listed until permanently deleted. Restore the client or employee first, then generate a portal login.",
      withoutPortalSectionCount: "{count} without portal login",
      selectAllClients: "Select All Clients",
      selectAllEmployees: "Select All Employees",
      selectAllUsers: "Select All Users",
      selectClientRow: "Select {name}",
      selectEmployeeRow: "Select {name}",
      selectUserRow: "Select {name}",
      noUsersToShow: "No users to show.",
      bulkDeleteTitle: "Delete {count} User Accounts?",
      bulkDeleteConfirm: "Delete {count} Accounts",
      bulkDeleteForeverTitle: "Delete {count} Accounts Forever?",
      bulkDeleteForeverConfirm: "Delete {count} Forever",
      bulkRestoreTitle: "Restore {count} User Accounts?",
      bulkRestoreConfirm: "Restore {count} Accounts",
      bulkRestoreAccessTitle: "Restore Access for {count} Accounts?",
      bulkRestoreAccessConfirm: "Restore Access for {count}",
      bulkSelected: "{count} accounts selected",
      bulkRestoreAccessHint:
        "Credentials and module permissions are unchanged.",
      bulkRestoreDeletedHint:
        "Linked logins stay under Revoked Access until access is restored.",
      bulkDeactivateOwnSkipped:
        "Your own account cannot be deleted and will be skipped.",
      bulkDeactivateTrashHint:
        "Deleted users remain in the system and can be restored from the Deleted users tab.",
      bulkDeleteForeverHint:
        "Accounts linked to active employees are skipped. Client portal links are revoked. Employee records are kept but unlinked from deleted logins.",
      bulkDeactivateSuccess:
        "{count} user account(s) moved to Deleted users.",
      bulkDeactivateNone:
        "Could not delete selected users. {error}",
      bulkDeactivatePartial:
        "{success} user account(s) moved to Deleted users. {failed} failed.",
      bulkDeleteForeverSuccess:
        "{count} user account(s) permanently deleted.",
      bulkDeleteForeverNone:
        "Could not delete selected users. {error}",
      bulkDeleteForeverPartial:
        "{success} user account(s) permanently deleted. {failed} failed.",
      bulkRestoreAccessSuccess: "{count} login access restored.",
      bulkRestoreAccessSuccessOther: "{count} login accesses restored.",
      bulkRestoreDeletedSuccess: "{count} user account restored.",
      bulkRestoreDeletedSuccessOther: "{count} user accounts restored.",
      bulkRestoreNone: "Could not restore selected users. {error}",
      bulkRestorePartial: "{success} restored. {failed} failed.",
      companyNotFound: "Company not found.",
      tryAgain: "Please try again.",
      columns: {
        user: "User",
        type: "Type",
        linked: "Linked",
        modules: "Modules",
        password: "Password",
        actions: "Actions"
      },
      usernameDisplay: "Username: {username}",
      passwordNotSet: "Password not set",
      passwordHiddenCompact: "Password set",
      noPasswordOnFile:
        "No password set yet (first-login pending).",
      passwordHiddenOnFile:
        "Password set (not shown). No recoverable copy on file. The user must sign in again to refresh it, or use Reset Account to return to first-login pending.",
      passwordDecryptFailedCompact: "Cannot decrypt copy",
      passwordDecryptFailedOnFile:
        "Recoverable copy is on file but could not be decrypted. Use Reset Account to return the account to first-login pending so the user can set a new password.",
      firstLoginComplete: "First-Login Complete",
      firstLoginPending: "First-Login Pending",
      linkedEmployee: "Linked Employee: {label}",
      linkedClient: "Linked Client: {name}",
      linkedVendor: "Linked Vendor: {name}",
      linkedAccount: "Linked Account",
      cannotRevokeOwn: "You cannot revoke access for your own account",
      cannotDeleteOwn: "You cannot delete your own account",
      cannotRemovePortalOwn:
        "You cannot permanently remove portal login access for your own account",
      cannotRevokeOrRemoveOwn:
        "You cannot revoke access or permanently remove portal login for your own account",
      softDeleteCredentialsHint:
        "Credentials stay saved until forever-delete from trash. To disable login only while keeping the employee or client Active, use Revoke Access. To destroy the login forever and leave them under No Portal Login, use Permanently Remove Portal Login Access.",
      restoreAccessBody:
        "Username and password stay the same. Module permissions are unchanged.",
      restoreDeletedBody:
        "Username and password stay preserved. Linked login stays under Revoked Access until access is restored before the user can sign in again.",
      deleteForeverBody:
        "Password reset tokens and module overrides are removed. Linked client portal access is revoked. Employee records are kept but unlinked from this login.",
      deleteForeverActiveEmployee:
        "Linked employee {label} is still active. Soft-delete the employee or restore access first — permanent delete is blocked.",
      deleteForeverInactiveEmployee:
        "Linked employee {label} ({status}). The employee record will be kept but unlinked from this login.",
      permanentlyDeletedToast: 'Account "{name}" permanently deleted.',
      permissionsDescIntro:
        "Control which modules {name} ({username}) can access.",
      permissionsDescFooter:
        "Existing accounts keep stored overrides until you save. Saved changes apply on the next request.",
      permissionsDescClient:
        "Client portal defaults on: Dashboard, Projects, Progress Report, and Invoice and Billing.",
      permissionsDescVendor:
        "Vendor portal access is disabled — vendor-linked logins cannot sign in to any module. Toggles below have no effect until portal access is re-enabled.",
      permissionsDescEmployee:
        "Employee defaults: Dashboard, Progress Report, CICO (field staff), Leave & Sick; HO staff also get Projects.",
      permissionsDescAdmin:
        "Admin accounts start with full access to every module/page so they can delegate access per user.",
      permissionsDefaultOn: "Default: On",
      permissionsDefaultOff: "Default: Off",
      permissionsOverridden: "· Overridden",
      permissionsAccountType: "Account Type:",
      permissionsModulesEnabled:
        "{enabled} of {total} modules enabled",
      permissionsOverridesOne: "· {count} custom override",
      permissionsOverridesOther: "· {count} custom overrides",
      permissionsModuleAccessAria: "{module} access",
      form: {
        displayName: "Display Name",
        displayNamePlaceholder: "Account display name",
        username: "Username",
        usernamePlaceholder: "e.g. jsmith",
        usernameHint:
          "Login ID / username can be changed by Users managers only.",
        usernameReadOnlyHint:
          "Only Users managers can rename Login ID / username.",
        recoveryEmail: "Recovery Email",
        recoveryEmailPlaceholder: "password-reset@company.co.id",
        currentPassword: "Current Password",
        currentPasswordHint:
          "Recoverable copy shown here after the user completes first-login. Updated when the user or admin sets a new password. No copy while first-login is pending. Reset Account returns the account to first-login pending without issuing a password.",
        accountLink: "Account Link",
        unlinkedAdmin:
          "Unlinked admin account (no employee or client link).",
        accountLinkHint:
          "Links are set when the account is created from the Employee or Client directory and cannot be changed here.",
        resetAccount: "Reset Account",
        resetAccountHint:
          "Force first-login setup again. Clears recovery email and requires the user to choose a new password via /first-login. Employee/client links are not changed.",
        resetAccountConfirm:
          'Reset account for "{username}"?\n\nThis clears the recovery email and puts the account back into first-login pending. The user must complete first-login setup again (set password + recovery email). Employee/client links are kept.',
        you: "(You)"
      },
      errors: {
        saveFailed: "Failed to save user account.",
        resetFailed: "Failed to reset user account.",
        deleteFailed: "Failed to delete user account.",
        restoreAccessFailed: "Failed to restore login access.",
        restoreFailed: "Failed to restore user account.",
        permissionsSaveFailed: "Failed to save.",
        reorderFailed: "Failed to reorder users.",
        displayNameRequired: "Display name is required.",
        usernameRequired: "Username is required.",
        usernameInvalid:
          "Username must be 3-32 characters and use only letters, numbers, dots, dashes, or underscores.",
        usernameTaken: "Username already in use.",
        recoveryEmailRequired: "Recovery email is required.",
        recoveryEmailTaken: "Recovery email already in use.",
        userNotFound: "User not found.",
        companyNotFound: "Company not found.",
        reorderInvalid: "One or more users are invalid for reorder.",
        cannotRevokeOwn: "You cannot revoke access for your own account.",
        cannotRemovePortalOwn:
          "You cannot permanently remove portal login access for your own account.",
        cannotDeleteOwn: "You cannot delete your own account.",
        cannotDeleteOwnEmployee:
          "You cannot delete your own employee record while signed in.",
        revokeLinkedOnly:
          "Only client, vendor, or employee linked accounts can have access revoked.",
        permanentlyRemoveLinkedOnly:
          "Only client, vendor, or employee linked accounts can have portal login access permanently removed.",
        permanentlyRemoveActiveOnly:
          "Only active linked logins can be permanently removed. Restore access first, or use soft Delete for deactivated accounts.",
        permanentlyRemoveFailed:
          "Failed to permanently remove portal login access.",
        employeeArchivedCannotRestore:
          "Linked employee was permanently removed and cannot be restored.",
        restoreEmployeeFirst:
          "Restore the linked employee first, then use Restore Access.",
        restoreClientFirst:
          "Restore the linked client first, then use Restore Access.",
        restoreVendorFirst:
          "Restore the linked vendor first, then use Restore Access.",
        partTimeRestoreOnProjectOnly:
          "Part Time portal access is only available while assigned to a project.",
        onlyDeactivatedPermanentDelete:
          "Only deactivated accounts can be permanently deleted.",
        cannotDeleteActiveEmployee:
          "Cannot delete: linked employee {employeeNo} ({name}) is still active. Soft-delete the employee or restore access first.",
        cannotDeleteActiveClient:
          "Cannot delete: linked client {name} is still active. Soft-delete the client or restore access first.",
        deleteUserFailed: "Failed to delete user.",
        restoreUserFailed: "Failed to restore user.",
        revokeAccessFailed: "Failed to revoke access."
      }
    },
    billing: {
      title: "Invoice and Billing",
      taxInvoice: "Tax",
      ppnKeluaran: "Output VAT",
      purchase: "Expenses",
      purchaseDescription:
        "Record every company expense here: supplier bills, services, and Petty Cash top-ups.",
      purchaseTaxTitle: "Tax Invoice (Input VAT)",
      purchaseTaxDesc:
        "Purchase invoices that include PPN masukan or already have a tax invoice file.",
      hoPaymentsDesc:
        "Due dates and open/overdue status for vendor bills (from vendor payment terms).",
      vendorPaymentsTitle: "Payment & Settlement",
      settlementsTitle: "Payment & Settlement",
      settlementsCollections: "Collections (AR)",
      settlementsCollectionsDesc:
        "Client invoices awaiting payment or verification.",
      settlementsPayables: "Payables (AP)",
      settlementsPayablesDesc:
        "Vendor purchase invoices with a due date from payment terms.",
      settlementsArCount: "{count} unpaid client invoice(s)",
      settlementsApCount: "{count} vendor bill(s) with due dates",
      settlementsCardAr: "Accounts Receivable",
      settlementsCardArOverdue: "Overdue Receivables",
      settlementsCardArOverdueHint: "Client invoices past due",
      settlementsCardAp: "Accounts Payable",
      settlementsCardApOverdue: "Overdue Payables",
      settlementsCardApOverdueHint: "Vendor bills past due",
      settlementsArEmpty: "No open collections",
      settlementsArEmptyDesc:
        "Issued client invoices awaiting payment will appear here.",
      settlementsApEmpty: "No payables with due dates",
      settlementsApEmptyDesc:
        "Link purchases to vendors with payment terms to track AP due dates.",
      settlementsOpenBilling: "Open Invoice & Billing",
      settlementsOpenPurchases: "Open Purchases",
      vendorStatusTaxMissing: "Needs Tax Invoice",
      vendorStatusOpen: "Open",
      vendorStatusOverdue: "Overdue",
      vendorStatusPaid: "Paid",
      purchaseCount: "{count} purchase invoice(s)",
      purchasePeriod: "Period",
      expenseReportDownload: "Download Expense Report",
      expenseReportTitle: "Expense Report",
      expenseReportHint: "Expenses by invoice date for the selected period.",
      expenseReportDate: "Expense Date",
      expenseReportReference: "Invoice",
      expenseReportStatus: "Status",
      expenseReportAmount: "Amount",
      expenseReportTotal: "Total",
      expenseReportEmpty: "No expenses have an invoice date in this period.",
      expenseReportPeriodMonth: "{month} {year}",
      expenseReportPeriodDay: "{day} {month} {year}",
      expenseReportPeriodYear: "{year}",
      purchaseCardTotal: "Total Expenses",
      purchaseCardUnpaid: "Unpaid",
      purchaseCardUnpaidHint: "Still in Accounts Payable",
      purchaseCardOverdue: "Overdue Bills",
      purchaseCardOverdueHint: "Vendor invoices past the due date",
      purchaseCardIncompleteImport: "Incomplete Imports",
      purchaseCardIncompleteImportHint: "Shipping, duties, or vendor payment still missing",
      purchaseEmptyPeriod: "No Expenses This Month",
      purchaseEmptyPeriodDesc:
        "No expenses have a date in the selected month. Try another period or add an expense.",
      purchaseUpload: "Add Expense",
      purchaseUploadTitle: "Add Expense",
      purchaseUploadDesc:
        "Record a supplier bill, a service, or a Petty Cash top-up. Attach the bill when it is a vendor invoice.",
      purchaseSupplier: "Vendor",
      purchaseVendorSelect: "Select Vendor",
      purchaseVendorRequired: "Select a registered vendor.",
      purchaseVendorMustBeRegistered:
        "Vendors must be registered under Vendors before adding a purchase.",
      purchaseVendorRegisterOverseasFirst:
        "Register an Overseas vendor under Vendors before adding an import.",
      purchaseVendorRegisterLocalFirst:
        "Register a Company or Individual vendor under Vendors before adding a local purchase.",
      purchaseVendorMustBeOverseas:
        "Imported From Overseas only uses Overseas vendors.",
      purchaseVendorOverseasRequired: "Select an Overseas vendor.",
      purchaseInvoiceRef: "Invoice Number / Ref",
      purchaseInvoiceRefShort: "Invoice #{ref}",
      purchaseInvoiceRefNone: "No Invoice",
      purchaseInvoiceRefPlaceholder: "e.g. INV-1042",
      purchaseInvoiceDate: "Invoice Date",
      purchaseDate: "Date",
      purchasePaymentTerms: "Payment Terms",
      paymentDue: "Payment due",
      purchasePaymentTermsHint:
        "This purchase: {terms}. Payment due {dueDate}.",
      purchasePaymentTermsCashHint:
        "Cash — the supplier invoice is paid now ({dueDate}).",
      purchasePaymentTermsImportNetHint:
        "Net {days} — the factory invoice is accounts payable until Invoice Paid. Import duties are recorded after the goods arrive in Jakarta.",
      purchaseImportFactoryNowTitle: "Factory Invoice",
      purchaseImportFactoryNowHint:
        "Record the factory invoice now: when you will pay, the invoice amount and currency, plus freight and insurance if you already have them. Shipment to Jakarta is usually already being arranged, so those three costs are known. CIF is calculated from them and stays in that currency.",
      purchaseImportCifNowHint:
        "Customs Value (CIF) is factory invoice + freight + insurance. This figure does not change when you pay. Customs will use this same CIF later, with their own rate.",
      purchaseImportPayLaterTitle: "Vendor Remittance",
      purchaseImportPayLaterHint:
        "Bank Rate and bank fees are recorded when you actually transfer. That is how much Rupiah you paid for the goods. Bank Rate is not the Customs Rate. Paying does not change the CIF above.",
      purchaseImportCashPayNowHint:
        "Cash — the vendor is already paid. Enter the Bank Rate and any bank fees for this transfer. That is how much Rupiah you paid. This is not the Customs Rate and it does not change CIF.",
      purchaseImportBookingRate: "Booking Rate",
      purchaseImportBookingRateHint:
        "The daily rate on the day you record this invoice. Warehouse factory Rupiah is locked at this rate.",
      purchaseImportBookingRateRequired: "Enter the Booking Rate.",
      purchaseImportNetBookingHint:
        "Enter the Booking Rate — the daily rate on the day you record this invoice. Warehouse factory Rupiah is locked here. CIF stays in the original currency. Customs will use their own rate when the goods arrive. If the Bank Rate is different when you pay the vendor, Head Office books that rate difference as income or expense.",
      purchaseImportNetRemittanceLaterHint:
        "The Bank Rate used on the transfer is entered when the vendor is actually paid. Warehouse cost stays on the Booking Rate.",
      purchaseImportRateDifference:
        "Rate Difference On Import Warehouse Cost",
      purchaseImportRateDifferenceExpenseHint:
        "The Bank Rate was higher than the Booking Rate. This extra cost is Head Office overhead — not warehouse or project cost.",
      purchaseImportRateDifferenceIncomeHint:
        "The Bank Rate was lower than the Booking Rate. This saving is Head Office income — not warehouse or project profit.",
      purchaseImportDutiesLaterHint:
        "Import duty details are entered when the goods arrive in Jakarta.",
      purchaseImportDutiesSectionTitle: "Import Duties",
      purchaseImportDutiesSectionHint:
        "Customs take the factory CIF and apply their own Customs Rate. Tick the import charges that apply. Total Import Duties is calculated on that CIF — never on the Bank Rate.",
      purchaseImportBankRateWhenPaid:
        "Bank Rate is entered when you pay the vendor. It is not used for CIF or import duties.",
      purchaseImportDutiesOptionalHint:
        "Optional until the goods arrive in Jakarta. You can add the Billing ID and related costs later.",
      purchaseStatusRecordNotCompleted: "Record Not Completed",
      purchaseStatusAwaitingImportDuties: "Awaiting Import Duties",
      purchaseStatusAwaitingVendorPayment: "Awaiting Vendor Payment",
      purchaseStatusAwaitingHandling: "Awaiting Handling Invoice",
      purchaseStatusAwaitingShipping: "Awaiting Shipping",
      purchaseStatusComplete: "Complete",
      purchaseCompleteImportArrival: "Record Import Arrival",
      purchaseCompleteImportArrivalHint:
        "Customs use the CIF already recorded and their own Customs Rate. Enter that rate, the charges that apply, the Billing ID, and the duties invoice.",
      purchaseVehicleLease: "Vehicle Lease",
      purchaseVehicleLeaseHint:
        "Indonesian finance lease: down payment now, then monthly installments. Bank fees are usually paid up front.",
      purchaseVehicleLeaseToggle: "This vehicle is leased",
      purchaseVehicleIdentity: "Vehicle Identity",
      purchaseVehicleIdentityHint:
        "Enter the number plate and year. The plate is this vehicle’s identity. One vehicle per expense.",
      purchaseVehiclePlate: "Number Plate",
      purchaseVehiclePlatePlaceholder: "e.g. B 1234 ABC",
      purchaseVehiclePlateHint:
        "The number plate is this vehicle’s identity. One vehicle per expense.",
      purchaseVehiclePlateRequired: "Enter the vehicle number plate.",
      purchaseVehicleYear: "Vehicle Year",
      purchaseVehicleYearPlaceholder: "e.g. 2024",
      purchaseVehicleYearHint: "The model year of this vehicle.",
      purchaseVehicleYearRequired: "Enter the vehicle year.",
      purchaseLeaseOtr: "On The Road Price",
      purchaseLeaseDownPayment: "Down Payment",
      purchaseLeaseTenor: "Tenor (Months)",
      purchaseLeaseInterest: "Yearly Interest Percent",
      purchaseLeaseAdminFee: "Administration Fee",
      purchaseLeaseInsurance: "Insurance",
      purchaseLeaseFiduciary: "Fiduciary Fee",
      purchaseLeaseProvision: "Provision Fee",
      purchaseLeaseOtherFee: "Other Bank Fees",
      purchaseLeaseMonthly: "Monthly Installment",
      purchaseLeasePrincipal: "Financed Amount",
      purchaseLeaseUpfront: "Upfront To Pay",
      purchaseLeaseTotal: "Total Lease Cost",
      purchasePaymentTermsHintField:
        "Cash pays the supplier invoice now. Net leaves it as accounts payable until Invoice Paid.",
      purchaseAmount: "Amount",
      purchaseAmountPlaceholder: "e.g. 1500000",
      purchaseItemsBought: "Items Bought",
      purchaseAddItem: "Add Item",
      purchaseRemoveItem: "Remove Item",
      purchaseSelectItem: "Select Item",
      purchaseQty: "Qty",
      purchaseUnitCost: "Unit Cost",
      purchaseUnit: "Unit",
      purchaseServiceFor: "What The Service Is For",
      purchaseServiceForHint:
        "Type the work and the invoice amount. Do not break the bill into quantity and unit cost — for example Three Air Conditioner Visits and the total on the invoice.",
      purchaseServiceDescription: "Service Description",
      purchaseServiceDescriptionPlaceholder:
        "e.g. Three Office Air Conditioner Visits",
      purchaseServiceAmountRequired: "Enter the amount for service {n}.",
      purchaseAddService: "Add Service Line",
      purchaseServiceLineRequired: "Describe the service for line {n}.",
      purchaseServiceLinesRequired: "Add at least one service line.",
      purchaseLineLabel: "Item {n}",
      purchaseServiceLineLabel: "Service {n}",
      purchaseLineUnitHint: "Unit: {unit}",
      purchaseLineTotal: "Line {amount}",
      purchaseAmountTotal: "Total {amount}",
      purchaseLinesRequired: "Add at least one purchased item.",
      purchaseLineItemRequired: "Select an item for line {n}.",
      purchaseLineQtyRequired: "Enter a valid quantity for line {n}.",
      purchaseLineCostRequired: "Enter a valid unit cost for line {n}.",
      purchaseCatalogEmpty:
        "Add the item in Goods Catalog first, then choose it here.",
      purchaseNotes: "Notes",
      purchaseNotesPlaceholder: "Optional notes",
      purchasePurpose: "Purchase Purpose",
      purchasePurposeStock: "Stock",
      purchasePurposeProject: "Project",
      purchasePurposeInternal: "Internal",
      purchasePurposeHint:
        "Tag this service to a project, or to Head Office overhead. Products always become warehouse stock — issue them to a project from Inventory.",
      purchaseProject: "Project",
      purchaseProjectPlaceholder: "Select a project",
      purchaseProjectRequired: "Select the project this purchase is for.",
      purchasePaymentForChip: "Payment For",
      purchaseCategory: "Expense Type",
      purchaseCategoryProduct: "Product",
      purchaseCategoryVehicle: "Vehicle",
      purchaseCategoryService: "Service",
      purchaseCategoryPettyCash: "Petty Cash",
      purchaseCategoryGovernment: "Government",
      purchaseCategoryBankLoan: "Loan",
      purchaseCategoryHint:
        "A product becomes warehouse stock. A vehicle is bought locally and recorded under Inventory → Vehicles. Service, Petty Cash, Government, and Loan are not stock.",
      loanSource: "Loan Source",
      loanSourceBank: "Bank Loan",
      loanSourceShareholder: "Shareholder Loan",
      loanSourceHint:
        "Choose who lent the money first. For a bank loan, choose what this payment is for. Then choose the registered loan.",
      loanSourceRequired: "Choose Bank Loan or Shareholder Loan.",
      loanPaymentFor: "Payment For",
      loanPaymentForInterest: "Interest",
      loanPaymentForInstallment: "Installment",
      loanPaymentForProvision: "Bank Provision",
      loanPaymentForAdminFee: "Bank Admin Fee",
      loanPaymentForHint:
        "Interest and installment are the regular payment. Bank Provision and Bank Admin Fee attach to the registered loan you pick — they show on that loan’s page. The Financial Report treats them as bank fees, not interest, and not as a Standby versus Term split.",
      loanPaymentForRequired: "Choose what this payment is for.",
      loanExpenseProvisionHint:
        "Type the provision the bank charged. This is an expense and does not change outstanding principal.",
      loanExpenseAdminFeeHint:
        "Type the admin fee the bank charged. This is an expense and does not change outstanding principal.",
      loanPaymentThisMonthShouldBe: "Payment This Month Should Be",
      loanProvisionPaid: "Bank Provision",
      loanAdminFeePaid: "Bank Admin Fee",
      loanFacility: "Registered Loan",
      loanFacilityPlaceholder: "Select a registered loan",
      loanFacilityRequired: "Select the registered loan this payment belongs to.",
      loanFacilityEmpty:
        "Register the loan under Finance → Loans first, then come back here to record a return.",
      loanExpenseStandbyHint:
        "Type the interest the bank or shareholder charged. This does not change outstanding principal.",
      loanExpenseTermHint:
        "Type the amount paid this time. You can pay more or less than the usual installment.",
      loanOutstanding: "Outstanding Principal",
      loanChargesInterest: "Does The Shareholder Charge Interest?",
      loanChargesInterestHint:
        "If yes, choose Monthly Interest or Annual Interest, then enter the rate. Daily outstanding is billed each month as an unpaid expense.",
      loanInterestBasis: "Interest Quoted As",
      loanInterestBasisMonthly: "Monthly Interest",
      loanInterestBasisAnnual: "Annual Interest",
      loanInterestBasisRequired: "Choose Monthly Interest or Annual Interest.",
      loanInterestBasisHint:
        "Choose how the rate is written. Then enter the percent. Banks accrue bunga harian on the amount actually out each day. Unused credit ceiling does not accrue.",
      loanMonthlyRate: "Monthly Interest Rate %",
      loanMonthlyRateHint:
        "Quoted per month. Daily interest uses this percent divided by the days in that calendar month.",
      loanMonthlyRateRequired: "Enter the monthly interest rate.",
      loanShareholderName: "Shareholder Name",
      loanInterestPaid: "Interest Paid",
      loanPrincipalReturned: "Principal Returned",
      bankLoanKind: "Loan Type",
      bankLoanKindStandby: "Standby Loan",
      bankLoanKindTerm: "Term Loan",
      bankLoanKindHint:
        "Standby Loan: type the interest paid. Term Loan: type the installment paid this time.",
      bankLoanKindStandbyHint:
        "Indonesian banks call this a Standby Loan or Kredit Rekening Koran. Interest is charged only on the drawn amount. The unused limit does not accrue interest.",
      bankLoanKindTermHint:
        "This is a Term Loan (Kredit Angsuran). Indonesian banks usually use anuitas: one fixed monthly amount that starts as mostly interest and later becomes mostly principal.",
      bankLoanAnuitasHint:
        "Monthly payment uses the Indonesian bank anuitas formula: M = P × r × (1+r)^n / ((1+r)^n − 1), where r is the monthly rate. This is the usual method at BCA, Mandiri, and BNI. It is not the only method — some banks still use flat or sliding-effective — but anuitas is the one this ERP uses so the installment matches a typical bank schedule.",
      bankLoanKindRequired: "Choose Standby Loan or Term Loan.",
      bankLoanFacilityLimit: "Credit Ceiling",
      bankLoanFacilityLimitHint:
        "The maximum you may draw on this standby facility. Indonesian banks call this Plafon Kredit. Interest is charged only on the amount drawn, not on the unused ceiling.",
      bankLoanFacilityLimitRequired: "Enter the Credit Ceiling.",
      bankLoanDrawnAmount: "Amount Drawn",
      bankLoanPrincipal: "Loan Principal",
      bankLoanAnnualRate: "Annual Interest Rate %",
      bankLoanAnnualRateHint:
        "Nominal yearly rate. Daily interest is outstanding × this rate / 360, the Indonesian KRK / rekening koran convention used by BCA and Mandiri.",
      bankLoanAnnualRateRequired: "Enter the annual interest rate.",
      bankLoanTenorMonths: "Tenor (Months)",
      bankLoanMonthlyInstallment: "Estimated Monthly Installment",
      bankLoanPaymentAmount: "Amount Paid This Time",
      bankLoanPaymentAmountHint:
        "Interest, the monthly installment, or another amount the bank actually debited. Do not enter the full unused facility.",
      bankLoanRef: "Loan Account / Reference",
      bankLoanRefPlaceholder: "Bank loan account or advice number",
      bankLoanRefHint: "The bank’s loan account or payment advice number.",
      bankLoanDocument: "Payment Proof",
      purchasePaymentProof: "Payment Proof",
      loanPaidDate: "Paid Date",
      purchaseTransferFee: "Bank Transfer Fee",
      purchaseTransferFeeHint:
        "Interbank fee charged on this transfer (SKN, BI-FAST, or RTGS). Leave 0 when the same bank is used or the fee is waived. Booking it keeps the ERP cash in line with the bank statement.",
      purchaseTransferFeePlaceholder: "0",
      purchaseVehicleBought: "Vehicle Bought",
      purchaseVehicleCatalogEmpty:
        "Add a Vehicle type in Goods Catalog first, then choose it here.",
      purchaseSelectItemDesc:
        "Choose the item type first, then search and pick the catalog item.",
      purchaseSelectVehicleDesc:
        "Search and choose the vehicle type from Goods Catalog.",
      purchaseSelectItemTypeHint:
        "Choose Equipment, Chemical, Consumable, Spare Part, or Other.",
      purchaseItemTypeLabel: "Item Type",
      purchaseItemTypeCount: "Items",
      purchaseSearchItemsPlaceholder: "Search name or SKU",
      purchaseNoItemsForType: "No items of this type in Goods Catalog.",
      purchaseNoItemsMatchSearch: "No items match this search.",
      purchaseChangeItem: "Change",
      governmentTaxType: "Payment Type",
      governmentTaxTypeHint:
        "Choose what this government payment is. BPJS is paid to a virtual account. Tax types use a DJP Billing ID. Value Added Tax is credited in the monthly VAT return. Corporate Income Tax Article 25 and 29 are credited when you file the annual company return.",
      governmentTaxKindPpn: "Value Added Tax",
      governmentTaxKindPph25: "Corporate Income Tax Installment",
      governmentTaxKindPph29: "Corporate Income Tax Settlement",
      governmentTaxKindPph21: "Employee Income Tax",
      governmentTaxKindPph23: "Withholding Tax On Services",
      governmentTaxKindPph42: "Final Income Tax",
      governmentTaxKindStampDuty: "Stamp Duty",
      governmentTaxKindPbb: "Land And Building Tax",
      governmentTaxKindPph22: "Income Tax Article 22",
      governmentTaxKindOther: "Other Government Charge",
      governmentTaxKindBpjsKesehatan: "BPJS Kesehatan",
      governmentTaxKindBpjsKetenagakerjaan: "BPJS Ketenagakerjaan",
      governmentVirtualAccount: "Virtual Account Number",
      governmentVirtualAccountPlaceholder: "BPJS virtual account number",
      governmentVirtualAccountHint:
        "The virtual account number on the BPJS billing or bank transfer.",
      governmentBpjsPeriod: "Contribution Period",
      governmentBpjsMonth: "Month",
      governmentBpjsYear: "Year",
      governmentBpjsPeriodHint:
        "The month this iuran is for, not the day you paid.",
      governmentBpjsPaymentHint:
        "Pay the BPJS virtual account for this program. The company share is the expense.",
      governmentBpjsAmount: "Amount Transferred",
      governmentBpjsAmountHint:
        "Type the amount sent to the virtual account. Company share is the expense.",
      governmentBpjsDocument: "Payment Proof",
      commercialTaxKindPpn: "Value Added Tax",
      commercialTaxKindPph23: "Income Tax Article 23",
      commercialTaxKindPpnAndPph23: "Value Added Tax And Income Tax Article 23",
      commercialTaxKindPph42: "Final Income Tax Article 4-2",
      commercialTaxKindPpnAndPph42:
        "Value Added Tax And Final Income Tax Article 4-2",
      commercialTaxKindPph21: "Employee Income Tax Article 21",
      commercialTaxKindPph22: "Income Tax Article 22",
      commercialTaxKindPph26: "Income Tax Article 26",
      commercialTaxKindStampDuty: "Stamp Duty",
      commercialTaxKindPbb: "Land And Building Tax",
      commercialTaxKindOther: "Other Tax",
      otherTaxName: "What Tax Is This",
      otherTaxNameHint: "Type the name of this tax.",
      otherTaxNamePlaceholder: "e.g. Regional Tax",
      otherTaxNameRequired: "Enter the tax name.",
      otherTaxRate: "Tax Rate",
      otherTaxRatePlaceholder: "e.g. 10",
      otherTaxRateRequired: "Enter the tax rate percent.",
      otherTaxRateHint: "Percent charged or paid for this other tax.",
      governmentBillingId: "Billing ID",
      governmentBillingIdPlaceholder: "e.g. 020012345678901",
      governmentBillingIdHint:
        "The 15-digit ID Billing from Direktorat Jenderal Pajak (Coretax / DJP Online).",
      governmentBillingIdShort: "Billing ID {ref}",
      governmentDescription: "Description",
      governmentDescriptionPlaceholder: "e.g. Monthly Value Added Tax for August",
      governmentAmount: "Invoice Amount",
      governmentAmountHint: "Indonesian Rupiah only.",
      governmentCurrency: "Currency",
      governmentCurrencyIdr: "Indonesian Rupiah",
      governmentDocument: "Billing Invoice",
      governmentDocumentRequired: "Upload the billing notice or payment invoice.",
      governmentChip: "Government",
      purchaseImportTaxCreditNote:
        "Value Added Tax is a monthly input-VAT credit. Income Tax Article 22 is a year-end corporate tax credit.",
      purchaseImportPpnOnGoods: "Value Added Tax On Imported Goods",
      purchaseImportPpnOnHandling: "Value Added Tax On Handling Fee",
      purchaseImportPpnOnItems: "Value Added Tax On Items",
      purchaseImportPaidToVendor: "Paid To Vendor",
      purchaseImportPaidToVendorTotal: "Total Paid To Vendor",
      purchaseImportAmountSent: "Amount Sent",
      purchaseImportPaidToVendorHint:
        "Factory Invoice + included Freight + included Insurance + Bank Charge, × Bank Rate, plus Telex Fee. Separate freight or insurance is added after Amount Sent.",
      purchaseImportGrandTotalSpend: "Grand Total Spend",
      purchaseImportCredits: "Tax Credits",
      purchaseImportVatCredit: "Tax Credit / Value Added Tax",
      purchaseImportPph22Credit: "Income Tax Article 22 / PPh Credit",
      purchaseImportWarehouseSpendHint:
        "Warehouse Cost is what it cost to get the product to Indonesia, minus the applicable tax credits (Value Added Tax and Income Tax Article 22).",
      purchaseImportWarehouseAfterDuties:
        "Tax credits and warehouse cost are set when import duties are recorded. Factory Rupiah uses the Booking Rate, or the Bank Rate on Cash. Customs Rate is only for duties. Paying later does not change warehouse or project cost.",
      purchaseOrigin: "Where Was This Bought",
      purchaseOriginLocal: "Bought Locally",
      purchaseOriginImport: "Imported From Overseas",
      purchaseOriginHint:
        "Local supplier bills stay in Rupiah. Overseas: record the factory invoice, freight, insurance, and Booking Rate or Bank Rate now. Import charges come after the goods arrive in Jakarta.",
      importFulfillment: "How Is This Import Handled",
      importHandledInternally: "Handled Internally",
      importHandledInternallyHint:
        "Tick the import charges that apply, then enter the one Billing ID and upload the Import Duties invoice that matches those charges. Choose a Handling Vendor, or Handled By Head Office if staff process the import — then there is no handling fee.",
      importOutsourced: "Outsourced",
      importOutsourcedHint:
        "The handler pays all duties and tax. Relasi Global Solusi pays the factory invoice (now or later) and reimburses their all-in handling fee.",
      importDutiesBillingId: "Import Duties Billing ID",
      importDutiesDocument: "Import Duties Invoice",
      importDutiesDocumentHint:
        "The Billing ID invoice for those import charges. This is the duties and tax document — no separate tax invoice.",
      importDutiesNoTermsHint:
        "Import duties and tax have no payment terms. They must be paid now.",
      handlingVendor: "Handling Vendor",
      handlingVendorPlaceholder: "Select The Handling Vendor",
      handlingVendorPlaceholderInternal:
        "Select The Handling Vendor Or Head Office",
      handlingVendorRequired: "Select the Handling Vendor.",
      handlingVendorMustBeLocal:
        "The Handling Vendor must be a Company or Individual.",
      handlingVendorRegisterLocalFirst:
        "Register a Company or Individual vendor under Vendors before choosing a Handling Vendor.",
      handlingByHeadOffice: "Handled By Head Office",
      handlingByHeadOfficeHint:
        "Head Office staff handle this import. There is no handling fee.",
      handlingFee: "Handling Fee",
      handlingFeeHintInternal:
        "The management fee the customs agent charges to help get the goods out.",
      handlingFeeHintOutsourced:
        "The all-in amount we reimburse the handler. Their invoice covers duties and tax.",
      handlingFeeRequired: "Enter the handling fee.",
      handlingFeeIncludesPpn: "Is Value Added Tax Charged On This Handling Fee?",
      handlingFeePpnRate: "Handling Fee Value Added Tax Rate",
      handlingFeeTotalPaid: "Total paid including Value Added Tax: {amount}.",
      handlingFeeInvoice: "Handling Fee Invoice",
      handlingFeeInvoiceRequired: "Upload the Handling Fee invoice.",
      handlingFeeInvoiceHint:
        "The handling vendor’s invoice for their fee. This is not the factory invoice and not the Import Duties invoice.",
      handlingFeeTaxInvoice: "Handling Tax Invoice",
      handlingFeeTaxInvoiceRequired:
        "Upload the tax invoice for the handling fee.",
      handlingFeeTaxInvoiceHint:
        "The faktur pajak for the handling fee when Value Added Tax is charged. This is input tax, not the Import Duties Billing ID.",
      purchaseFactoryInvoice: "Factory Invoice",
      purchaseFactoryInvoiceHint:
        "The overseas supplier invoice for the goods.",
      importDutiesDocumentCreditHint:
        "The Billing ID invoice paid to the government. Value Added Tax and Income Tax Article 22 on this document are tax credits.",
      purchaseBackToExpenses: "Expenses",
      purchaseWhatWeBought: "On This Expense",
      purchaseNoLineItems: "Nothing is recorded on this expense.",
      purchaseLineItem: "Description",
      purchaseLineQty: "Quantity",
      purchaseLineUnitCost: "Unit Cost",
      purchaseExpenseLineTotal: "Total",
      purchaseDocuments: "Documents",
      purchaseDocumentsHint:
        "Every file attached to this expense. For an import that is the factory invoice, the Import Duties Billing ID invoice, the handling invoice, and the handling tax invoice when Value Added Tax is charged.",
      purchaseDocumentMissing: "Not attached.",
      purchaseImportBreakdown: "Import Breakdown",
      purchaseImportCustomsValue: "Customs Value (CIF)",
      purchaseImportCustomsRateDutiesHint:
        "Customs convert the factory CIF at their own Customs Rate. Bank Rate is never used here. Rupiah freight or insurance is added as entered.",
      purchaseReversed: "Reversed",
      invoicePaid: "Invoice Paid",
      purchaseReverse: "Reverse",
      purchaseReverseReason: "Why are you reversing this purchase?",
      purchaseReverseFailed: "Could not reverse this purchase.",
      purchaseOriginChipImport: "Imported",
      purchaseImportForeignPlaceholder: "e.g. 5000",
      purchaseImportFactoryCurrencyHint:
        "Bank Charge uses this currency. Freight and insurance do too, unless marked Not Included In Factory Invoice.",
      purchaseImportNotIncludedInFactoryInvoice: "Not Included In Factory Invoice",
      purchaseImportSeparateFeeHint:
        "Paid on a separate transfer. Enter the Bank Rate for remittance and the Customs Rate for this currency.",
      purchaseImportSeparateIdrHint:
        "Enter this amount in Rupiah. Bank Rate and Customs Rate are not used.",
      purchaseImportFreightSeparate: "Freight (Separate Payment)",
      purchaseImportInsuranceSeparate: "Insurance (Separate Payment)",
      purchaseImportRate: "Bank Rate",
      purchaseImportRatePlaceholder: "e.g. 16200",
      purchaseImportRateHint:
        "The rate the bank used for this remittance. 16200 is shown as Rp 16.200.",
      purchaseImportCustomsRate: "Customs Rate",
      purchaseImportCustomsRateFor: "Customs Rate ({currency})",
      purchaseImportCustomsRatePlaceholder: "e.g. 16200",
      purchaseImportCustomsRateHint:
        "The official tax rate for this currency. Used for Customs Value (CIF). Not the Bank Rate.",
      purchaseImportCustomsInvoiceIdr:
        "Customs Value (CIF): {amount}.",
      purchaseImportBankCharge: "Bank Charge",
      purchaseImportBankChargeHint:
        "The full bank charge in Factory Invoice currency.",
      purchaseImportFullAmountFee: "Full Amount Bank Fee",
      purchaseImportLocalBankFee: "Telex Fee",
      purchaseImportLocalBankFeeHint:
        "The local bank telex charge, billed in Rupiah.",
      purchaseImportFreight: "Freight",
      purchaseImportFreightHint:
        "Same currency as Factory Invoice. Leave empty if freight is already in the factory invoice.",
      purchaseImportInsurance: "Insurance",
      purchaseImportInsuranceHint:
        "Same currency as Factory Invoice. Usually none.",
      purchaseImportConvertedIdr: "{amount} in Rupiah",
      purchaseImportCharges: "Import Charges That Apply",
      purchaseImportChargesHint:
        "Tick each charge on the Import Duties invoice, one by one. Leave the paid amount blank to use the official calculation, or type the amount from the notice.",
      purchaseImportDutiesTotal: "Total Import Duties",
      purchaseImportFormE: "Certificate Of Origin Form E",
      purchaseImportFormEHint:
        "ASEAN Form E / ATIGA. When Customs accepts it, Customs Duty is usually 0%.",
      purchaseImportBeaMasuk: "Customs Duty (Bea Masuk)",
      purchaseImportBeaMasukHint:
        "Charged on the Rupiah customs value (invoice + freight + insurance). Rate depends on the HS code. Enter the percent from the notice, or the amount paid.",
      purchaseImportPpnbm: "Luxury Goods Tax (PPnBM)",
      purchaseImportPpnbmHint:
        "Charged on Import Value (customs value + Customs Duty). Only for listed luxury goods. Leave off for ordinary supplies.",
      purchaseImportPpn: "Value Added Tax (PPN)",
      purchaseImportPpnHint:
        "Charged on Import Value (customs value + Customs Duty). Ordinary goods use an effective 11%. This is recoverable input tax — not added to warehouse unit cost.",
      purchaseImportPph22: "Income Tax Article 22 (PPh 22)",
      purchaseImportPph22Hint:
        "Charged on the same Import Value as Value Added Tax (customs value + Customs Duty). 2.5% with an Importer Identification Number, 7.5% without. Prepaid tax — not added to warehouse unit cost.",
      purchaseImportPph22Basis: "Importer Identification",
      purchaseImportPph22Api: "Has Number (2.5%)",
      purchaseImportPph22WithoutApi: "No Number (7.5%)",
      purchaseImportPph22Custom: "Other Rate",
      purchaseImportRatePercent: "Rate Percent",
      purchaseImportPaidAmount: "Amount Paid (Rupiah)",
      purchaseImportAutoAmount: "Calculated",
      purchaseImportStockCost: "Warehouse Cost",
      purchaseImportStockCostHint:
        "Warehouse unit cost is Warehouse Cost ÷ pieces. Value Added Tax and Income Tax Article 22 stay on the expense but are not built into stock.",
      purchaseImportUnitCost: "{qty} pieces → Warehouse Unit Cost {amount}",
      purchaseImportUnitCostNeedQty:
        "Add the number of pieces so warehouse unit cost can be calculated.",
      purchaseImportForeignLine: "Invoice Share (Foreign)",
      purchaseImportRequired:
        "Enter the overseas factory invoice amount.",
      purchaseImportCustomsRateRequired:
        "Enter the Customs Rate for the Import Duties invoice.",
      purchaseFreeOfCharge: "Free Of Charge",
      purchaseFreeOfChargeHint:
        "Yes when the vendor sends this at no cost (warranty, replacement, complimentary). Stock still comes in. There is no payable.",
      purchaseFreeOfChargeServiceHint:
        "Yes when the vendor provides this at no cost (warranty, complimentary). There is no payable.",
      purchaseFreeOfChargeReason: "Free Of Charge Reason",
      purchaseFreeOfChargeReasonPlaceholder:
        "e.g. Under warranty — factory sent replacement spare parts",
      purchaseFreeOfChargeReasonRequired:
        "Enter the reason this purchase is free of charge.",
      purchaseFreeOfChargeChip: "Free Of Charge",
      purchaseHasInvoice: "Does This Have An Invoice?",
      purchaseHasInvoiceHint:
        "Free of charge vendors often send no invoice. Choose No if there is none.",
      purchaseAddShippingCost: "Add Shipping Cost",
      purchaseAddShippingCostHint:
        "Cash spent to receive the goods. This is not a factory invoice.",
      purchaseShippingCost: "Shipping Cost",
      purchaseShippingAmount: "Amount",
      purchaseShippingRequired: "Enter the shipping cost.",
      purchaseShippingRateRequired: "Enter the Bank Rate for this shipping cost.",
      purchaseShippingIdrHint:
        "Enter this amount in Rupiah. Bank Rate is not used.",
      purchaseShippingFxHint:
        "Enter the amount and the Bank Rate the bank used for this payment.",
      purchaseAddRelatedCosts: "Add Related Costs",
      purchaseAddRelatedCostsHint:
        "Cash spent for this service. This is not a vendor invoice.",
      purchaseRelatedCost: "Related Cost",
      purchaseRelatedCostPlaceholder: "e.g. Site Visit, Permit",
      purchaseRelatedCostRequired: "Enter what this related cost is.",
      purchaseRelatedCostAmountRequired: "Enter the related cost.",
      purchaseRelatedCostRateRequired:
        "Enter the Bank Rate for this related cost.",
      purchaseHasCustomsFees: "Are There Customs Fees?",
      purchaseHasCustomsFeesHint:
        "Any customs fees or duties to release the goods?",
      purchaseCustomsFeesImportOnlyHint:
        "Customs fees apply to imports only.",
      purchaseDeclaredValue: "Declared Value",
      purchaseDeclaredValueHint:
        "How much the vendor or PIB declared. This is the customs base, not a factory invoice.",
      purchaseDeclaredValueRequired: "Enter the declared value.",
      purchaseDeclaredIdrHint:
        "Enter this amount in Rupiah. Customs Rate is not used.",
      purchaseDeclaredFxHint:
        "Enter the amount and the Customs Rate (NDPBM) for this currency.",
      purchaseDeclaredCustomsRateRequired:
        "Enter the Customs Rate for this declared value.",
      purchaseIncludesPpn: "Tax Included",
      purchaseIncludesPpnHint:
        "Choose Yes when the supplier bill includes tax. You will then choose whether it is Value Added Tax, Income Tax, or both.",
      purchaseIncludesPpnChip: "With Tax",
      purchaseNoPpnChip: "No Tax",
      purchaseIncludedTaxKind: "What Tax Is Included",
      purchaseIncludedTaxKindHint:
        "Choose the tax printed on this supplier bill.",
      purchaseIncludedTaxKindPlaceholder: "Select The Tax",
      purchaseIncludedTaxKindRequired: "Select the tax type on this bill.",
      purchasePphRate: "Income Tax Rate",
      purchasePphRatePlaceholder: "e.g. 2",
      purchasePphRateRequired: "Enter the income tax rate percent for this purchase.",
      purchasePphRateHint:
        "Usual Article 23 rate is 2%. Change it if this bill uses another rate.",
      purchasePpnRate: "Value Added Tax Rate",
      purchasePpnRatePlaceholder: "e.g. 11",
      purchasePpnRateRequired: "Enter the tax rate percent for this purchase.",
      outputPpnRateHint:
        "Output PPN (PPN Keluaran) rate for this invoice. Editable — not locked to 11%. Default is the current product rate.",
      purchasePpnRateHint:
        "Defaults to 11%. Change this if the invoice uses a different tax rate.",
      purchaseVatPreview:
        "Amount paid {dpp} + tax credit {tax} = tax-included unit cost {gross}.",
      purchaseVatSplitMismatch:
        "The amount paid plus the tax credit must equal the tax-included unit cost.",
      purchaseBankAccount: "Paid From Bank",
      purchaseBankAccountHint:
        "The company bank account this expense is paid from.",
      purchaseBankAccountRequired: "Select the company bank this is paid from.",
      purchaseDocument: "Invoice",
      purchaseChooseDocument: "Choose a purchase invoice file.",
      purchaseUploadConfirm: "Save Expense",
      purchaseUploading: "Saving…",
      purchaseUploadFailed: "Failed to save purchase.",
      purchaseUploaded: "Added",
      purchaseUploadedBy: "Added by {name}",
      purchaseViewFile: "View",
      purchaseInvoice: "Purchase invoice",
      purchaseTaxInvoice: "Tax Invoice",
      purchaseTaxInvoiceOptional: "Tax Invoice (optional)",
      purchaseTaxInvoiceHint:
        "Optional faktur pajak for input VAT (PPN masukan). You can also attach it later from the purchase card.",
      purchaseChooseTaxInvoice: "Choose a tax invoice file.",
      purchaseUploadTaxInvoice: "Upload",
      purchaseUploadTaxInvoiceAction: "Upload Tax Invoice",
      purchaseUploadTaxInvoiceTitle: "Upload Tax Invoice",
      purchaseUploadTaxInvoiceDesc:
        "Attach the faktur pajak (input VAT) for this purchase.",
      purchaseUploadTaxInvoiceConfirm: "Save Tax Invoice",
      purchaseUploadTaxInvoiceFailed: "Failed to upload tax invoice.",
      purchaseNoTaxInvoice: "—",
      purchaseMarkPaid: "Mark Paid",
      purchaseMarkPaidTitle: "Mark Purchase Paid",
      purchaseMarkPaidDesc:
        "Upload proof of payment to record when this supplier bill was paid and close AP.",
      purchaseMarkPaidHint:
        "Attach the transfer receipt or payment confirmation. This closes the payable.",
      purchaseMarkPaidImportDesc:
        "Enter the Bank Rate and any bank fees for this transfer. Warehouse cost stays on the Booking Rate. If the Bank Rate is different, Head Office books the rate difference.",
      purchaseMarkPaidBankRate: "Bank Rate",
      purchaseMarkPaidBankRateHint:
        "The bank’s rate on this transfer. This is how much Rupiah you paid. It is not the Customs Rate and it does not change CIF or warehouse cost.",
      purchaseMarkPaidBankRateRequired: "Enter the Bank Rate for this payment.",
      purchaseMarkPaidBookingRateShown:
        "Booking Rate was {rate}. Enter the Bank Rate used on this transfer. Any difference is booked to Head Office.",
      purchaseMarkPaidImportHint:
        "Factory invoice {amount}. Enter the Bank Rate used on this transfer. Warehouse cost stays on the Booking Rate. Customs Rate is not used here.",
      purchaseMarkPaidBankCharge: "Bank Charge",
      purchaseMarkPaidBankChargeHint:
        "SWIFT or cable fee on this transfer, in the factory invoice currency.",
      purchaseMarkPaidTelexFee: "Telex Fee",
      purchaseMarkPaidTelexFeeHint: "Local bank telex fee for this transfer, in Rupiah.",
      purchaseMarkPaidConfirm: "Confirm Paid",
      purchaseMarkPaidPending: "Recording…",
      purchaseMarkPaidFailed: "Failed to mark purchase as paid.",
      purchaseMarkPaidInvoiceRequired: "Purchase invoice is required.",
      purchaseMarkPaidNotFound: "Purchase invoice not found.",
      purchaseMarkPaidAlreadyPaid: "This purchase is already marked paid.",
      purchasePaidAt: "Paid At",
      openInProgress: "Open In Progress",
      searchClients: "Search clients...",
      searchProjects: "Search projects...",
      awaitingOrLate: "Awaiting Payment or late",
      noTaxPending: "No Tax Invoices pending",
      noTaxPendingDesc:
        "When you issue an invoice for a project marked with tax, it appears here until the Tax Invoice is marked sent.",
      noTaxCompleted: "No completed items",
      noTaxCompletedDesc: "Sent Tax Invoices will show up here.",
      taxInvoiceDue: "Tax Invoice Due",
      taxInvoiceSent: "Tax Invoice Sent",
      markTaxDone: "Upload Tax Invoice",
      submitPayment: "Submit payment",
      rejectPayment: "Reject payment proof",
      rejectPaymentConfirm:
        "Reject this payment proof? The invoice returns to Awaiting Payment and the uploaded file is removed.",
      noInvoicePeriods:
        "No invoice periods yet. Periods open from the real contract start date (Move to In Progress), or when you open this page.",
      columns: {
        client: "Client",
        project: "Project",
        period: "Period",
        amount: "Amount",
        due: "Due",
        status: "Status"
      },
      filterSubcategory: "Filter by subcategory",
      overdueCount: "{count} overdue",
      unpaidCount: "{count} unpaid",
      allSettled: "All settled",
      paidInvoiceOne: "{count} paid invoice",
      paidInvoiceOther: "{count} paid invoices",
      noPaidInvoices: "No paid invoices yet",
      openCount: "{count} open",
      lateCount: "{count} late",
      issued: "Issued",
      completed: "Completed",
      invoice: "Invoice",
      clients: "Clients",
      projects: "Projects",
      projectOne: "{count} project",
      projectOther: "{count} projects",
      billing: "Billing",
      lateInvoices: "Late invoices",
      openInvoices: "Open invoices",
      totalClients: "Total clients",
      emptyClients: "No billing clients",
      emptyClientsDesc: "Clients with projects appear here for invoice tracking.",
      emptySearchClients: 'No results for "{query}"',
      emptyProjects: "No projects for this client",
      emptyProjectsDesc: "Active projects for this client appear here.",
      markTaxSentFailed: "Failed to mark Tax Invoice Sent.",
      billingPeriod: "Billing period",
      paymentReceived1: "Payment",
      paymentReceived2: "Received",
      paymentReceivedDialogTitle: "Record payment received",
      paymentReceivedDialogDesc:
        "Upload proof of payment, then confirm. Clears the due invoice; the project stays active for future months.",
      paymentReceivedDialogDescHistory:
        "Upload proof of payment, then confirm. When all invoices are paid, the project moves to Completed.",
      taxInvoiceSentDialogTitle: "Upload Tax Invoice",
      taxInvoiceSentDialogDesc:
        "Upload the tax invoice, then confirm. Can be done before or after payment is recorded.",
      documentVerifyContext: "For",
      proofOfPayment: "Proof of payment",
      taxInvoiceDocument: "Tax invoice",
      chooseTaxInvoiceDocument:
        "Please choose an image or PDF of the tax invoice.",
      paymentVerifyHint:
        "Documents stay on this server. Head Office confirms here with a reason.",
      taxInvoiceVerifyHint:
        "Documents stay on this server. Head Office confirms the tax invoice here with a reason.",
      purchaseTaxInvoiceVerifyHint:
        "Documents stay on this server. Head Office confirms the supplier tax invoice here with a reason.",
      inHouseVerifyReason: "Confirmation Reason",
      inHouseVerifyReasonPlaceholder:
        "Why this document is accepted (required).",
      inHouseVerifyBanner:
        "Files stay on Relasi Global Solusi servers. Head Office confirms them in this app.",
      inHouseVerifyTitle: "Confirm Payment In House",
      inHouseVerifyDesc:
        "Review the uploaded proof on this server, then confirm with a reason.",
      inHouseVerifyConfirm: "Confirm And Mark Paid",
      inHouseReasonRequired: "Enter a confirmation reason.",
      paymentVerifyChecking: "Saving…",
      confirmTaxInvoiceSent: "Upload Tax Invoice",
      confirmPaymentReceived: "Confirm payment received",
      viewTaxInvoice: "View tax invoice",
      stillInPlanning: "Still in Planning",
      moveToInProgress: "Move to In Progress",
      pending: "Pending",
      completedTab: "Completed",
      noClient: "No client",
      invoiceDownloadDesc:
        "Download invoices and upload payment proof for this project.",
      paidInvoiceCannotDelete: "Paid invoice periods cannot be deleted.",
      deleteIssuedInvoiceConfirm:
        "Delete “{label}”? This removes the issued invoice, any PDF, and payment proof. This cannot be undone.",
      deletePeriodConfirm:
        "Delete “{label}”? This cannot be undone.",
      thisBillingPeriod: "this billing period",
      paymentProofImageOrPdf: "Payment proof must be an image or PDF.",
      choosePaymentProof: "Please choose an image or PDF as proof of payment.",
      amountExample: "e.g. 1500000",
      amountExampleLarge: "e.g. 50000000",
      cyclesReadyTitle:
        "{count} routine cycle(s) need reconciliation before billing",
      cyclesReadyDesc: "",
      taxStillNeedTitle:
        "{count} Tax Invoice(s) still need to be created",
      taxStillNeedDesc:
        "Issued commercial invoices for projects marked with tax are waiting on the Tax Invoice checklist.",
      openTaxChecklist: "Open Tax Invoice checklist",
      invoiceCountAwaiting:
        "{count} invoice(s) awaiting Tax Invoice",
      invoiceCountAcknowledged: "{count} invoice(s) acknowledged",
      issuedOn: "Issued {date}",
      sentOn: "Sent {date}",
      projectDetails: "Project details",
      planningInvoicingHint:
        "Invoicing is available after this project moves to In Progress.",
      planningUnlockDesc:
        "This project is in Planning. Use {action} on the project page when the work order is ready — billing and invoices unlock after that.",
      paymentHistoryDesc:
        "Payment history, due dates, and invoice actions for this project.",
      parking: {
        workspaceHint:
          "Enter actual monthly parking revenue. Deal terms stay fixed; net profit is revenue minus all outflows for the month.",
        monthTitle: "Parking Month",
        monthDesc: "Pick the month to log revenue and review outflows.",
        dealReadOnly: "Deal terms are fixed for the life of the contract.",
        revenueTitle: "Monthly Revenue",
        casualRevenueDesc:
          "Enter casual (normal traffic) parking only. Member parking is the fixed monthly fee and is not taxed.",
        casualRevenue: "Casual Parking",
        memberRevenue: "Member Parking",
        casualTax: "Casual Parking Tax",
        notes: "Notes",
        saveRevenue: "Save Revenue",
        saving: "Saving…",
        saveFailed: "Failed to save parking revenue.",
        outflowsTitle: "Outflows",
        outflowsDesc:
          "Lease, profit share, setup (once), project purchases, and assigned staff wages.",
        noOutflows: "No outflows recorded for this month yet.",
        revenue: "Revenue",
        moneyOut: "Expenses",
        netProfit: "Net Profit",
        unavailable: "Parking workspace is not available for this project."
      },
      payrollMgmt: {
        workspaceHint:
          "These are Relasi Global Solusi staff on this job. They check in. Use Fill from check-in, then apply deductions the client sent. No progress report. Then send for client approval and invoice.",
        periodTitle: "Payroll Period",
        periodDesc: "Uses this client’s cutoff days, not Internal Payroll.",
        feeHint:
          "Management fee {percent}% · tax on fee {tax}% · client payment terms {days} days.",
        listTitle: "Employee Pay List",
        listDesc:
          "Fill from check-in for this job, then add client deductions before you generate.",
        cutoffRange: "Cutoff: {range}",
        reviewTitle: "Days In This Period",
        reviewDesc:
          "Review each assigned employee’s check-in days before you generate. Apply client deductions on the pay list below.",
        reviewEmpty: "No Relasi Global Solusi staff are assigned to this job yet.",
        generatePdf: "Generate PDF",
        pdfTitle: "Payroll Management",
        clientAdjustment: "Client Deduction",
        unlockFailed: "Could not unlock this period.",
        fillFromCico: "Fill From Check-In",
        addLine: "Add Employee",
        employeeName: "Employee Name",
        amount: "Amount",
        accountNumber: "Account Number",
        lineNotes: "Notes",
        wagesTotal: "Total Wages (Cost)",
        feeAmount: "Management Fee ({percent}%)",
        taxAmount: "Tax On Fee ({percent}%)",
        clientBill: "Client Bill",
        saveList: "Save List",
        saving: "Saving…",
        saveFailed: "Failed to save the pay list.",
        actionFailed: "Could not update this payroll period.",
        confirmWagesPaid: "Confirm Wages Paid",
        confirmWagesPaidDesc:
          "After the client approves, Head Office can confirm the wage bill was paid. Upload the payment proof. This does not block Payment Due.",
        wagesPaidProof: "Wage Payment Proof",
        wagesPaidOn: "Wages confirmed {date}",
        viewProof: "View Payment Proof",
        unavailable: "Payroll Management workspace is not available for this project.",
        status: {
          DRAFT: "Draft",
          WAGES_ENTERED: "Wages Entered",
          AWAITING_CLIENT: "Awaiting Client",
          CLIENT_APPROVED: "Client Approved",
          WAGES_PAID: "Wages Paid",
          INVOICED: "Invoiced",
          REIMBURSED: "Reimbursed"
        }
      },
      billingMode: "Billing mode",
      billingPeriodBasis: "Billing Periods",
      anniversaryInvoiceDay: "Anniversary invoice day: {day}",
      calendarMonthInvoiceDay: "Calendar month billing",
      cycleFrom: " · cycle from {date}",
      customPeriodCycle: " · Day {from} – Day {to}",
      priorPeriodOpenWarn:
        "“{next}” is open while “{open}” is still unsettled. Remind the client before the backlog grows.",
      keepAmount: "Keep Amount",
      adjustAmount: "Adjust Amount",
      adjustAmountLabel: "Adjusted Invoice Amount",
      adjustAmountInvalid: "Enter a valid adjusted invoice amount.",
      reconcileAmountHelp:
        "Keep the contract price, or adjust the invoice amount for this period (Operations Manager or Area Manager approval required to adjust).",
      confirmReconcileKeep: "Reconcile & Send",
      confirmReconcileAdjust: "Adjust & Send",
      invoiceAndBilling: "Invoice and Billing",
      priceExcludeTax: "Price Exclude Tax",
      contractPrice: "Contract Price",
      savedPrice: "Saved: {price}",
      invoiceTotalWithTax: "Invoice Total With Tax: {amount}",
      contractPriceMonthlyHint:
        "Type the price exclude tax. The invoice adds the tax you chose on this project.",
      contractPriceMilestoneHint:
        "Type the price exclude tax. Changing it recalculates remaining unpaid invoices from what is still owed, then adds the project tax. Paid amounts stay as paid.",
      periods: "Periods",
      invoicedThrough: "Invoiced through {percent}%",
      setPriceBeforeMilestone:
        "Set a contract price above before invoicing a milestone.",
      setPriceBeforeCompile:
        "Set a contract price above so compiled invoices show a real amount instead of “As agreed / to be confirmed”.",
      cyclesReadyOnProject:
        "{count} contract cycle(s) ready after the period ended. Reconcile first, then submit the invoice on the row below.",
      nextMilestone: "Next payment milestone",
      nextMilestoneDesc:
        "Schedule was set when the project was created. Send the progress package for client Approve/Revise when work is ready — the invoice is issued after approval.",
      invoicing: "Invoicing...",
      invoiceMilestone1: "Send for",
      invoiceMilestone2: "Review",
      createProgressInvoice: "Send progress for review",
      createProgressInvoiceDesc:
        "This project has no saved payment schedule. Pick a cumulative progress % to send a progress package for client Approve or Revise. The project moves to Pending Approval until both sides agree; the invoice is issued after approval.",
      monthlyBillingHelp:
        "Billing follows the contract start date (anniversary cycles). After a cycle ends, Reconcile compiles staff CICO into a report for the client portal (Approve or Revise). Client approval auto-issues the invoice and emails the client contact. Payment due uses the client’s payment terms (Cash = due on submit). The project stays active for future cycles.",
      noMilestonePeriods:
        "No milestone periods yet. New General Cleaning, Facade Cleaning, and One-Time Landscaping milestone projects create the full payment schedule at create time.",
      reportCountOne: "{count} report",
      reportCountOther: "{count} reports",
      percentOfProject: " · {percent}% of project",
      fromContractPrice: "from contract price",
      nothingLeftAfterRevision: "Nothing left after contract revision",
      pdfMayShowPrevious: "PDF may show previous amount",
      daysSinceInvoicedOne: "{count} day since invoiced",
      daysSinceInvoicedOther: "{count} days since invoiced",
      daysOverdueOne: "{count} day overdue",
      daysOverdueOther: "{count} days overdue",
      paidOn: "Paid {date}",
      proofUploadedOn: "Proof uploaded {date}",
      downloadPdf: "PDF",
      viewProof: "View proof",
      awaitingVerification: "Awaiting verification",
      reconcile: "Reconcile",
      reconciling: "Reconciling…",
      retryCompile1: "Retry",
      retryCompile2: "Compile",
      confirmReconcilePeriod:
        "Reconcile “{label}” and send the CICO report to the client for Approve or Revise?",
      reconcileDialogTitle: "Reconcile Period",
      saveContractPriceFailed: "Failed to save contract price.",
      sendMilestoneForReviewFailed: "Failed to send milestone for review.",
      deletePeriodFailed: "Failed to delete billing period.",
      submitPaymentFailed: "Failed to submit payment for verification.",
      rejectPaymentFailed: "Failed to reject payment proof.",
      compileInvoiceFailed: "Failed to compile invoice.",
      mutualApprovalBeforeInvoice:
        "Send this billing period for client and HO review (reconcile or Submit for Approval) before issuing the invoice.",
      reviewPendingBeforeInvoice:
        "Wait for the client and HO to approve the reconciliation or progress report before issuing the invoice.",
      reconcilePeriodFailed: "Failed to reconcile billing period.",
      recordPaymentFailed: "Failed to record payment received.",
      reorderClientsFailed: "Failed to reorder clients.",
      filterResults: "{count} results",
      filterResultsIn: "{count} results in {type}",
      filterResultsFor: '{count} results for "{query}"',
      filterResultsInFor: '{count} results in {type} for "{query}"',
      breadcrumbAria: "Breadcrumb"
    },
    vat: {
      period: "Period",
      rateHint:
        "DPP and PPN are derived from tax-inclusive amounts at {rate}% until faktur amounts are stored.",
      outputTotal: "Output VAT",
      outputTotalHint: "PPN Keluaran for this period",
      inputTotal: "Input VAT",
      inputTotalHint: "PPN Masukan for this period",
      netPayable: "Net VAT",
      netPayableHint: "Input VAT − Output VAT. Plus is credit. Minus is amount we owe.",
      vatPaid: "VAT Paid",
      vatPaidHint: "Government Billing ID payments this month",
      vatRemaining: "VAT Still To Pay",
      vatRemainingHint: "Amount still owed after Billing ID payments",
      tabs: {
        output: "Output VAT",
        input: "Input VAT",
        income: "Income Tax",
        other: "Other Tax"
      },
      inputSourceImport: "Imported Goods",
      inputSourceItems: "Items",
      inputSourceService: "Service",
      inputSourceVehicle: "Vehicle",
      inputSourceHandling: "Handling Fee",
      pendingCount: "{count} Pending",
      outputTitle: "Output VAT (PPN Keluaran)",
      outputDesc:
        "Client invoice periods that require a tax invoice in this month.",
      inputTitle: "Input VAT (PPN Masukan)",
      inputDesc:
        "Input VAT this month, by source: items, imported goods, and handling fee. Import VAT is credited from the customs payment. Handling-fee VAT is credited from the handler's tax invoice.",
      otherTitle: "Other Tax",
      otherDesc:
        "Income Tax we withhold and remit (Article 21 and Article 23), final Income Tax Article 4(2), stamp duty, and other government tax. Withholding is not a company tax credit.",
      emptyOther: "No Other Tax",
      emptyOtherDesc:
        "No withholding, final Income Tax, or stamp duty payments fall in this month.",
      otherRemittanceTotal: "Withholding Remitted",
      otherRemittanceTotalHint: "Article 21 and Article 23 paid this month",
      otherExpenseTotal: "Other Tax Expense",
      otherExpenseTotalHint: "Article 4(2), stamp duty, and other tax this month",
      incomeTitle: "Prepaid Corporate Income Tax",
      incomeDesc:
        "Income Tax Article 22 on imports and Corporate Income Tax Article 25 / 29 paid with a Billing ID. These reduce the company tax you owe when you file the annual return.",
      incomeHint:
        "Example: if annual company tax is 100 million and these credits are 90 million, you pay 10 million.",
      incomeImportTotal: "Import Income Tax Article 22",
      incomeImportTotalHint: "Prepaid tax collected at customs this year",
      incomeInstallmentTotal: "Installments And Settlement",
      incomeInstallmentTotalHint: "Article 25 installments and Article 29 settlement",
      incomeCreditTotal: "Tax Credit Available",
      incomeCreditTotalHint: "Total prepaid corporate income tax for this year",
      emptyIncome: "No Income Tax Credits",
      emptyIncomeDesc:
        "No import Income Tax Article 22 or government Corporate Income Tax payments fall in this year.",
      incomeSourceImport: "Import",
      incomeSourceGovernment: "Government Billing ID",
      columns: {
        client: "Client",
        vendor: "Vendor",
        date: "Date",
        gross: "Gross",
        dpp: "DPP",
        ppn: "VAT",
        faktur: "Tax Invoice",
        source: "Source",
        credit: "Prepaid Tax",
        amount: "Amount"
      },
      openTaxInvoices: "Open Tax Invoice",
      openPurchases: "Open Purchases",
      taxDetail: "Tax Details",
      backToTax: "Back To Tax",
      relatedExpense: "This Expense",
      relatedBilling: "Project Billing",
      taxDocuments: "Tax Documents",
      taxDocumentMissing: "No tax invoice uploaded yet.",
      fakturReady: "Uploaded",
      fakturPending: "Pending",
      emptyOutput: "No Output VAT",
      emptyOutputDesc:
        "No client tax-invoice periods fall in this month.",
      emptyInput: "No Input VAT",
      emptyInputDesc:
        "No supplier purchases with PPN fall in this month.",
      invoicePeriodFallback: "Invoice Period"
    },
    sales: {
      title: "Sales",
      description:
        "Generate the sales invoice here. The PDF is created automatically. Upload the tax invoice for company buyers when required.",
      permissionDenied: "You do not have permission to record sales.",
      loadFailed: "Could not load sales.",
      period: "Sale Period",
      salesReportDownload: "Download Sales Report",
      salesReportTitle: "Sales Report",
      salesReportHint: "Sales by sale date for the selected period.",
      salesReportDate: "Sale Date",
      salesReportItem: "Item",
      salesReportBuyer: "Buyer",
      salesReportAmount: "Amount",
      salesReportTotal: "Total",
      salesReportEmpty: "No sales fall in this period.",
      salesReportPeriodMonth: "{month} {year}",
      salesReportPeriodDay: "{day} {month} {year}",
      salesReportPeriodYear: "{year}",
      totalSales: "Total Sales",
      totalProfit: "Total Profit",
      totalCost: "Cost Basis",
      vatCollected: "VAT Collected",
      saleCount: "{count} Sales",
      saleCountOne: "1 Sale",
      thisYear: "This year {amount}",
      searchPlaceholder: "Search all sales: item, SKU, buyer, notes…",
      addSale: "Generate Sales Invoice",
      bankAccount: "Bank Account",
      bankAccountEmpty: "Add a bank account in Company Details first.",
      bankAccountRequired: "Choose the bank account for this sale invoice.",
      invoiceAutoHint:
        "The sale invoice PDF is generated automatically from Company Details and this bank account. You do not upload a sale invoice.",
      invoiceGenerateFailed: "Could not generate the sale invoice PDF.",
      generateInvoice: "Generate Invoice",
      viewPaymentProof: "View Payment",
      paidOn: "Paid {date}",
      attachMissing: "Attach missing documents",
      hideAttach: "Hide attach",
      attachRequired: "Upload a payment proof or tax invoice, or generate the sale invoice.",
      attachSaved: "Sale documents saved.",
      attachFailed: "Could not save sale documents.",
      saveDocuments: "Save Documents",
      columns: {
        documents: "Documents"
      },
      docInvoiceReady: "Invoice",
      docInvoiceMissing: "Invoice missing",
      docPaymentReady: "Payment",
      docPaymentMissing: "Payment Pending",
      docTaxReady: "Tax Invoice",
      docTaxMissing: "Tax Invoice missing",
      form: {
        paymentProof: "Customer Proof Of Payment",
        paymentProofHint:
          "Optional. Upload the bank transfer slip later if payment is not in yet.",
        paidAt: "Payment Date",
        paidAtHint: "Optional. Defaults to the sale date when payment proof is uploaded."
      }
    },
    financialReport: {
      title: "Financial Report",
      description:
        "Pick a year, a month or the whole year, and General or one client.",
      filterYear: "Year",
      filterPeriod: "Period",
      filterPeriodYearly: "Whole Year",
      filterReport: "Report",
      filterReportGeneral: "General",
      filterBank: "Bank Account",
      filterBankAll: "All Banks",
      filterBankUnassigned: "Unassigned",
      rangeHint:
        "Income uses the calendar period. Wages use the 16th–15th payroll window for that same month or year. Unpaid vendor bills are Accounts Payable, not expenses.",
      periodNet: "Period Profit",
      netPosition: "Net Position",
      netPositionHint:
        "Period profit minus Accounts Payable. Loan draws stay on the Loan page. They are funding, not revenue.",
      loanInterestDueThisPeriod: "Loan Interest Paid",
      loanInterestDueThisPeriodHint:
        "Interest you recorded on Loan this period. It is an expense. Draws stay on the Loan page.",
      clientsStillOwe: "Accounts Receivable",
      weStillOweVendors: "Accounts Payable",
      bpjsKesehatan: "BPJS Kesehatan",
      bpjsKetenagakerjaan: "BPJS Ketenagakerjaan",
      bpjsEmployeeCount: "{count} enrolled employees",
      bpjsEmployeesTitle: "Enrolled Employees",
      bpjsEmployeeDetailTitle: "Employee Contribution",
      bpjsNoEmployees: "No active full-time employees are enrolled in this program.",
      bpjsTenure: "Tenure",
      bpjsHiredAt: "Joined",
      bpjsBasePay: "Base Pay",
      bpjsCompanyShare: "Company Payable",
      bpjsEmployeeShare: "Employee Deduction",
      bpjsLineKesehatan: "BPJS Kesehatan",
      bpjsLineJht: "JHT",
      bpjsLineJp: "JP",
      bpjsLineJkk: "JKK",
      bpjsLineJkm: "JKM",
      bpjsWageBase: "Wage Base",
      accountsReceivableHint:
        "Invoices already sent that the client has not paid yet. Overdue {overdue}.",
      accountsPayableHint:
        "Unpaid vendor bills. Not profit. Overdue {overdue}.",
      net: "Lifetime Net Profit",
      companyMoneyInHint:
        "Approved or invoiced amounts after tax is taken out by dividing, plus retained employee deposits. Held deposits are not income.",
      companyMoneyOutHint:
        "Stock used on jobs, vendor bills when paid, Internal Payroll, parking outflows, Head Office overhead, and refunded employee deposits.",
      stockInWarehouse: "Inventory Value",
      stockInWarehouseHint: "Value of goods on hand. Not yet charged to a job.",
      headOfficeOverhead: "Head Office Overhead",
      headOfficeOverheadPeriodHint:
        "Warehouse wages, Internal purchases paid this period, stock used on Internal Head Office or Warehouse, and import rate differences.",
      importRateDifference: "Rate Difference On Import Warehouse Cost",
      importRateDifferenceHint:
        "Booked to Head Office when the Bank Rate on payment differs from the Booking Rate. Warehouse and project cost stay unchanged.",
      importRateDifferenceExpenseLine: "Expense {amount}",
      importRateDifferenceIncomeLine: "Income {amount}",
      depositsHeld: "Employee Deposits Held",
      depositsHeldHint:
        "Balances held. Not income and not Accounts Payable. Not included in period profit.",
      depositsReturned: "Employee Deposits Refunded",
      depositsReturnedHint:
        "Outflow when a held deposit is refunded on Internal Payroll (last or current project, or Head Office).",
      depositsKept: "Employee Deposits Retained",
      depositsKeptHint:
        "Head Office income when resignation is not according to procedure.",
      jobHistoryTitle: "Clients And Jobs",
      jobHistoryDesc:
        "Open any job, including completed work. Company monthly totals still count money dated this month.",
      sameDaySplitNote:
        "Worked {count} sites today — day's pay split equally.",
      doubleShiftNote: "Double shift — two daily rates for this day.",
      totalClients: "Total Clients",
      withProjects: "With Projects",
      totalContractValue: "Total Contract Value",
      acrossClients: "Across Clients",
      totalProfit: "Total Profit",
      detail: {
        periodNet: "Period Profit Detail",
        netPosition: "Net Position Detail",
        moneyIn: "Revenue Detail",
        moneyOut: "Expenses Detail",
        ar: "Accounts Receivable Detail",
        ap: "Accounts Payable Detail",
        warehouse: "Inventory Value Detail",
        overhead: "Head Office Overhead Detail",
        deposits: "Employee Deposits Held Detail",
        depositsReturned: "Employee Deposits Refunded Detail",
        depositsKept: "Employee Deposits Retained Detail",
        bpjsKesehatan: "BPJS Kesehatan Detail",
        bpjsKetenagakerjaan: "BPJS Ketenagakerjaan Detail",
        loanInterestDue: "Loan Interest Paid Detail",
        loanInterestDueHelp:
          "Interest you recorded on Loan this period. Each line opens that facility. This is expense, not project revenue.",
        bpjsKesehatanHelp:
          "Company 4% of the capped wage. Employee 1% is already deducted on Internal Payroll. This card is the amount still owed to BPJS this month.",
        bpjsKetenagakerjaanHelp:
          "Company shares for JHT, JP, JKK, and JKM on enrolled employees. Employee shares are already deducted on Internal Payroll.",
        overheadWages: "Warehouse Wages",
        overheadPurchases: "Internal Purchases",
        overheadStock: "Internal Stock Used",
        overheadRateDifferenceExpense: "Import Rate Difference Expense",
        overheadRateDifferenceIncome: "Import Rate Difference Income",
        warehouseHelp:
          "Goods still in the warehouse are assets, not expenses, until they are issued to a job.",
        openInventory: "Open Inventory",
        moneyInHelp:
          "Revenue includes retained employee deposits and Head Office income when an import Bank Rate is lower than the Booking Rate.",
        moneyOutHelp:
          "Expenses include Head Office overhead, refunded employee deposits, and Head Office expense when an import Bank Rate is higher than the Booking Rate.",
        overheadHelp:
          "Head Office wages, Internal purchases paid this period, stock used on Internal sites, and import rate differences booked to Head Office.",
        depositsHelp:
          "Held deposits are not income. Refunds are outflows. Retained deposits are Head Office income.",
        depositsReturnedHelp:
          "Cash paid back on Internal Payroll when a held Security deposit is refunded.",
        depositsKeptHelp:
          "Head Office income when resignation is not according to procedure and the deposit is retained.",
        netPositionHelp:
          "Period profit minus unpaid vendor bills and outstanding loans. Loan draws are not revenue. Accounts Receivable is what clients still owe."
      },
      contractValueHint: "Sum of project contract prices.",
      spendingHint: "Stock used on the job, project purchases, and Internal Payroll days clocked here.",
      moneyIn: "Revenue",
      moneyInHint:
        "Approved reconciliation amount, or the invoice amount, after tax is taken out by dividing.",
      moneyOut: "Expenses",
      moneyOutHint: "Stock used, project purchases, and Internal Payroll allocated to this job.",
      moneyOutBreakdownTitle: "Expense Breakdown",
      moneyOutBreakdownDesc:
        "Stock used on this job plus Internal Payroll (daily rate × complete CICO days). Same-day multi-site work splits that day's pay equally.",
      inventoryOut: "Inventory",
      wagesOut: "Wages",
      moneyOutTotal: "Total Expenses",
      profit: "Profit",
      profitHint: "Revenue − Expenses",
      margin: "Margin",
      marginHint: "Profit ÷ Revenue",
      contractValue: "Contract Value",
      paymentsTitle: "Payments Received",
      paymentsDesc: "Invoice periods marked Paid after payment confirmation.",
      inventoryTitle: "Inventory Issues",
      inventoryDesc: "Non-voided stock issued to this project.",
      wagesTitle: "Wages By Employee",
      wagesDesc:
        "Same numbers as Internal Payroll: daily rate (monthly pay ÷ 26) × complete check-in and check-out days. A double-shift day counts as two paid days. If someone worked several sites on one day, that day's pay is split equally and noted on the line.",
      emptyClients: "No Clients Yet",
      emptyClientsDesc: "Add clients and projects to see financial reports.",
      emptyProjects: "No Jobs Yet",
      emptyProjectsDesc:
        "This client has no open or completed jobs to report.",
      emptyPayments: "No Confirmed Payments",
      emptyPaymentsDesc:
        "Paid invoices for this project will appear here after payment is confirmed.",
      emptyInventory: "No Inventory Issues",
      emptyInventoryDesc:
        "Stock issued to this project will appear here as money out.",
      emptyWages: "No Paid Days",
      emptyWagesDesc:
        "Wage cost appears here when someone has a complete check-in and check-out on this job.",
      payRecoveryTitle: "Lost Stock Pay Recovery",
      payRecoveryDesc:
        "Stock cost is in Inventory Issues. Pay recovery is the amount withheld from Internal Payroll for lost stock on this job.",
      emptyPayRecovery: "No Pay Recovery",
      emptyPayRecoveryDesc:
        "Lost-stock deductions assigned to this project appear here.",
      payRecovery: "Pay Recovery",
      noClientsMatch: "No clients match your search.",
      noProjectsMatch: "No projects match your filters.",
      searchClients: "Search Clients",
      searchProjects: "Search Projects",
      filterSubcategory: "Filter By Type",
      filterResults: "{count} results",
      filterResultsIn: "{count} results in {type}",
      filterResultsFor: '{count} results for "{query}"',
      filterResultsInFor: '{count} results in {type} for "{query}"',
      clientOne: "{count} client",
      clientOther: "{count} clients",
      projectOne: "{count} project",
      projectOther: "{count} projects",
      invoicePeriodFallback: "Invoice Period",
      columns: {
        client: "Client",
        project: "Project",
        contractValue: "Contract Value",
        spending: "Expenses",
        moneyIn: "Revenue",
        receivable: "Accounts Receivable",
        profit: "Profit",
        period: "Period",
        paidAt: "Paid At",
        amount: "Amount",
        item: "Item",
        issuedAt: "Issued At",
        quantity: "Quantity",
        employee: "Employee",
        daysWorked: "Days Worked",
        dailyRate: "Daily Rate",
        wageCost: "Wage Cost"
      }
    },
    thr: {
      title: "THR",
      description:
        "Generate and track Tunjangan Hari Raya (Idul Fitri) payments from employee base pay.",
      directoryTitle: "THR Payments",
      directoryDesc:
        "Lebaran THR uses base pay and tenure. Eligible from one full month of service.",
      summaryTitle: "THR Generation",
      summaryDesc:
        "Records auto-generate when this page opens within {days} days before Idul Fitri. Manual generate is only available inside that window.",
      targetYear: "Target Year",
      hariRayaDate: "Hari Raya Date",
      totalAmount: "Total Amount",
      generateForYear: "Generate THR For {year}",
      generating: "Generating…",
      generateSuccess:
        "THR generated: {created} created, {updated} updated, {skipped} skipped.",
      generateFailed: "Failed to generate THR.",
      generateOutsideWindow:
        "THR can only be generated within {days} days before Idul Fitri.",
      paymentsTitle: "Generated Payments",
      paymentsDesc: "THR rows for {year}.",
      emptyTitle: "No THR Payments Yet",
      emptyDesc:
        "Set Base Pay on employees, then generate THR for the target year.",
      columns: {
        employee: "Employee",
        tenure: "Tenure",
        basePay: "Base Pay",
        amount: "THR Amount",
        status: "Status",
        actions: "Actions"
      },
      tenureMonths: "{count} Months",
      statusDraft: "Draft",
      statusGenerated: "Generated",
      statusPaid: "Paid",
      markPaid: "Mark Paid",
      markPaidFailed: "Failed to mark THR as paid."
    },
    loans: {
      title: "Loan",
      description:
        "A manual register. Record money taken, interest the bank charged, and principal returned. Those records link to Expenses and the Financial Report. Draws are funding, not revenue.",
      register: "Register Loan",
      registerTitle: "Register A Loan",
      registerDesc:
        "Log the facility first. When money actually arrives, record a draw so the financial report knows where the cash came from.",
      registerConfirm: "Save Loan",
      saving: "Saving…",
      failed: "Could not save this loan.",
      emptyTitle: "No Loans Registered",
      emptyDesc:
        "Register a bank facility or a shareholder loan, then record draws and returns here.",
      name: "Loan Name",
      namePlaceholder: "e.g. BCA Standby Loan",
      source: "Loan Source",
      lenderName: "Lender",
      lenderNameHint: "The bank or the shareholder this money comes from.",
      startDate: "Start Date",
      notes: "Notes",
      notesPlaceholder: "Optional notes",
      recordInitialDraw: "Money Already Received",
      recordInitialDrawHint:
        "Turn this on when the bank or shareholder has already put money into a company account.",
      hasMoneyBeenDrawn: "Has Money Been Drawn?",
      hasMoneyBeenDrawnHint:
        "Banks usually hold a standby facility in a dedicated account. Choose Yes only after money was withdrawn into a company bank account.",
      moneyDrawn: "Money Drawn",
      initialDrawAmount: "Amount Received",
      initialDrawDate: "Draw Date",
      initialDrawDateHint:
        "The date the money actually entered the company account. This can be after the loan start date.",
      bankAccount: "Company Bank Account",
      bankAccountHint: "The account the money went into, or is paid from.",
      bankAccountDrawnHint:
        "The company bank account the draw was transferred into.",
      statusActive: "Active",
      statusClosed: "Closed",
      outstandingPrincipal: "Outstanding Principal",
      interestPaidThisMonth: "Interest Paid This Month",
      unusedLimit: "Unused Credit Ceiling",
      recordDraw: "Record Draw",
      recordDrawTitle: "Record Money Taken",
      recordDrawDesc:
        "The bank or shareholder put this amount into the company on this date. This is funding, not revenue.",
      recordDrawConfirm: "Save Draw",
      recordReturn: "Return Principal",
      recordReturnTitle: "Return Principal",
      recordReturnDesc:
        "Type the principal you sent back. Outstanding goes down by that amount. This is not an expense.",
      recordReturnConfirm: "Save Return",
      recordReturnSliceInterest: "Interest For This Slice",
      recordReturnSliceHint:
        "This interest is not billed here. Pay it under Expenses → Add Expense → Loan.",
      recordReturnSliceRange: "From {from} To {to} ({days} Days)",
      settleEarly: "Settle Early",
      settleEarlyTitle: "Settle Early",
      settleEarlyDesc:
        "Pelunasan dipercepat. Remaining principal, running interest, early settlement penalty, and any admin fee. The penalty percent is applied to remaining principal, not the original loan amount. Penalty and interest are expense. The loan then closes.",
      settleEarlyConfirm: "Settle And Close",
      remainingPrincipal: "Remaining Principal",
      runningInterest: "Running Interest",
      penaltyPercent: "Early Settlement Penalty %",
      penaltyPercentHint:
        "This percent is applied to remaining principal at the settle date, not the original loan amount. If half the principal is already paid, 6% is 6% of what is still outstanding.",
      penaltyAmount: "Early Settlement Penalty",
      adminFee: "Admin / Other Bank Fee",
      settleEarlyTotal: "Total To Pay",
      interestByMonth: "Interest By Month",
      usageSlicesTitle: "Usage By Date",
      sliceFrom: "From",
      sliceTo: "To",
      sliceAmountUsed: "Amount Used",
      sliceDays: "Days",
      sliceInterest: "Interest",
      sliceOpen: "Open",
      sliceEmpty: "No draws yet. Usage slices appear after money is taken.",
      standbySliceHint:
        "Each row is the amount used from the previous event to this date, at the outstanding in force. Unused credit ceiling does not accrue.",
      extendLoan: "Extend Loan",
      extendLoanTitle: "Extend Loan",
      extendLoanStandbyDesc:
        "Enter the new credit ceiling. Outstanding principal stays the same. The unused ceiling is the new limit minus what is already drawn.",
      extendLoanTermDesc:
        "Enter the new interest rate. The monthly installment is recalculated with the Indonesian bank anuitas method on remaining principal and remaining tenor.",
      extendLoanConfirm: "Save Extension",
      extendFailed: "Could not extend this loan.",
      newCeiling: "New Credit Ceiling",
      newCeilingHint:
        "Must be at least the outstanding principal already drawn.",
      newInterestRateHint:
        "The new quoted rate. Monthly payment is recalculated with anuitas on remaining principal.",
      extendTermInstallmentHint:
        "Anuitas on remaining principal over the {months} months left on the tenor.",
      dayCountActual: "Actual/{year}",
      dayCountHint:
        "Standby interest is Actual/360: each day’s outstanding × annual rate / 360. A draw on the 20th is charged only from the 20th. Monthly quotes use that month’s percent ÷ days in the month.",
      proof: "Payment Proof",
      proofRequired: "Upload the payment proof.",
      reference: "Reference",
      referencePlaceholder: "Loan account or advice number",
      columns: {
        name: "Loan",
        source: "Source",
        outstanding: "Outstanding",
        next: "Next Payment",
        status: "Status"
      },
      movementsTitle: "Draws And Returns",
      movementDraw: "Draw",
      movementInterest: "Interest",
      movementProvision: "Bank Provision",
      movementAdminFee: "Bank Admin Fee",
      movementReturn: "Return",
      noMovements: "No draws or returns yet.",
      interestRate: "Interest Rate",
      dayCount: "Day Count",
      creditCeiling: "Credit Ceiling",
      noInterest: "Does Not Charge Interest",
      backToLoans: "Loan"
    },
    bpjs: {
      title: "BPJS",
      description:
        "Enrollment and payment record. Record the virtual-account payment in Expenses.",
      alreadyPaid: "Already Paid",
      stillToPay: "Still To Pay",
      payInExpensesHint:
        "Record BPJS payments in Expenses. This page is the enrollment list and the payments already booked.",
      viewExpense: "Open Expense",
      dueDateHint: "Due {date}",
      overdue: "Overdue",
      overdueHint: "Past the statutory due date",
      notOverdueHint: "Not yet past the due date",
      kesehatan: "BPJS Kesehatan",
      ketenagakerjaan: "BPJS Ketenagakerjaan",
      period: "Contribution Period",
      enrolled: "{count} Enrolled Employees",
      emptyTitle: "No BPJS Enrollment",
      emptyDesc:
        "Enroll full-time employees under Employees to see Kesehatan and Ketenagakerjaan here.",
      backToBpjs: "BPJS",
      employeesEmpty: "No enrolled employees for this program.",
      hiredAt: "Joined",
      tenure: "Tenure",
      basePay: "Base Pay",
      wageBase: "Wage Base",
      componentsTitle: "Program Lines",
      lineKesehatan: "Kesehatan",
      lineJht: "JHT",
      lineJp: "JP",
      lineJkk: "JKK",
      lineJkm: "JKM",
      program: "Program",
      amount: "Amount",
      paidAt: "Paid Date",
      reference: "Reference",
      remittancesTitle: "Paid This Period",
      remittancesEmpty: "No BPJS payment recorded in Expenses for this period yet.",
      statusPaid: "Paid",
      statusDue: "Due",
      statusOverdue: "Overdue",
      columns: {
        program: "Program",
        companyShare: "Company Share",
        total: "Total",
        paid: "Already Paid",
        dueDate: "Due Date",
        status: "Status",
        employee: "Employee",
        employeeShare: "Employee Share"
      }
    },
    pettyCash: {
      title: "Petty Cash",
      description:
        "Cash entrusted to field and operations staff for meals, client entertainment, emergencies, and daily part-time pay.",
      currentBalance: "Current balance",
      lifetimeIn: "Lifetime Petty Cash in",
      monthIn: "This month in",
      lifetimeOut: "Lifetime expenses",
      monthOut: "This month expenses",
      upcoming: "Scheduled part-time pay still ahead: {amount}",
      negativeWarning:
        "The float is below zero. Record a top-up under Expenses.",
      recordSpend: "Record Spend",
      spendTitle: "Record Petty Cash Spend",
      spendDesc:
        "Upload the bill and enter the amount paid to debit Petty Cash.",
      spendConfirm: "Debit Petty Cash",
      spending: "Saving…",
      spendFailed: "Could not record this spend.",
      proof: "Bill / receipt",
      proofHint: "Take a clear photo of the bill or receipt.",
      proofRequired: "Upload the bill or receipt photo.",
      enteredAmount: "Amount paid",
      amountPlaceholder: "e.g. 85000",
      date: "Date",
      descriptionLabel: "Description",
      descriptionPlaceholder: "e.g. Lunch for site team",
      billIsFor: "This Bill Is For",
      billIsForPlaceholder: "Select Area Manager or above",
      billIsForRequired: "Select which Area Manager or above this bill is for.",
      billIsForHint:
        "Attribute this spend to an Area Manager, Operations Manager, or Director.",
      project: "Project",
      projectPlaceholder: "Optional project",
      projectHint: "Tag a site when this spend belongs to a job.",
      emptyTitle: "No Petty Cash Entries Yet",
      emptyDesc:
        "Add a Petty Cash top-up under Expenses, or record a spend with a bill photo.",
      viewProof: "View proof",
      columns: {
        date: "Date",
        kind: "Type",
        description: "Description",
        status: "Status",
        amount: "Amount",
        proof: "Proof"
      },
      kind: {
        TOP_UP: "Top-up",
        SPEND: "Spend",
        PART_TIME_PAY: "Part-time pay"
      },
      status: {
        SCHEDULED: "Scheduled",
        POSTED: "Posted",
        VOIDED: "Voided"
      }
    },
    payroll: {
      title: "Internal Payroll",
      description:
        "Pay for RGS employees only (Head Office, warehouse, and operations on RGS payroll). Auto-pay is daily rate after 9 hours (or 2 × daily rate after 18 hours on an assigned double shift). Shorter days stay unpaid until Full pay or a custom amount is entered.",
      directoryTitle: "Internal Payroll",
      directoryDesc:
        "This module is only for RGS employees. Client Payroll Management projects are billed separately.",
      periodTitle: "Pay Period",
      searchEmployee: "Search by employee name or number",
      periodDesc:
        "Wage = daily rate (base pay ÷ 26) × complete 9-hour days in this window. An assigned double shift pays two days only after 18 hours on that project. Under 9 or 18 hours: the day stays blank until Full pay or a custom amount. Days without CICO, including leave, are unpaid.",
      periodWindow:
        "Payroll period: 16 {prevMonth} – 15 {thisMonth}. Reconcile on the 16th.",
      periodWindowRange:
        "Payroll period: {range}. Reconcile on the 16th.",
      periodPreview: "Preview — this period reconciles on the 16th.",
      periodReconciled: "Reconciled on the 16th.",
      periodPicker: "Payroll Period",
      periodCurrent: "Current",
      dayListTitle: "Days In This Period",
      dayDate: "Date",
      daySite: "Project / Site",
      dayCheckIn: "Check-In",
      dayCheckOut: "Check-Out",
      exempt: "Exempt",
      dayHours: "Hours",
      dayPay: "Pay",
      doubleShift: "Double Shift",
      doubleShiftPayNote: "2 × Daily Rate",
      dayShift: "Shift",
      coveredShift: "Covered {shift} ({name} Absent)",
      coveredByName: "Covered By {name}",
      hoursWorkedValue: "{hours} hours",
      underHoursNote:
        "Employee only worked {hours} hours (need {required}). Please decide.",
      fullPay: "Full Pay",
      customAmountPlaceholder: "Custom Amount",
      saveCustomPay: "Save Custom Amount",
      checkedOutBeforeShiftEnd: "Checked Out Before Shift End",
      absent: "Absent",
      restDay: "Rest Day",
      onLeave: "On Leave",
      paySummaryTitle: "Pay Summary",
      noDays: "No complete CICO and no expected absences in this period.",
      totalEmployees: "Employees",
      totalWage: "Total Wages",
      totalNetPay: "Total Net Pay",
      tableTitle: "Payroll Detail",
      tableDesc:
        "Active RGS staff and anyone with complete CICO in the period. Days worked = 9 hours or more (18 hours on an assigned double shift). Under-hours days stay unpaid until Full pay or a custom amount. Late or early flags do not change pay here.",
      emptyTitle: "No Employees Found",
      emptyDesc:
        "No active RGS staff with base pay, and no complete CICO days in this period.",
      columns: {
        dailyRate: "Daily Rate",
        daysWorked: "Days Worked",
        wage: "Wage",
        bpjsKesehatan: "BPJS Kesehatan",
        bpjsTk: "BPJS TK",
        deductions: "Deductions",
        netPay: "Net Pay",
        bankName: "Bank",
        accountNumber: "Account Number",
        accountHolder: "Account Holder",
        actions: "Actions"
      },
      generatePdf: "Generate PDF",
      lockedBy: "Locked by {name} at {time}",
      unlockedBy: "Unlocked by {name}, reason: {reason}",
      unlockPeriod: "Unlock Period",
      unlockPeriodDesc:
        "Unlocking lets Head Office change deductions and re-generate this period. Attendance edits will change pay again until you generate.",
      unlockReason: "Unlock Reason",
      lateCheckIn: "Late Check-In",
      pdfTitle: "Internal Payroll",
      pdfGenerated: "Generated",
      pdfGross: "Gross",
      addDeduction: "Add Deduction",
      addDeductionDesc: "Add a manual deduction for {name}. Type the Rupiah amount yourself.",
      saveDeduction: "Save Deduction",
      deductionSaved: "Deduction saved for this month.",
      deductionType: "Deduction Type",
      deductionAmount: "Amount (Rupiah)",
      deductionAmountHint: "Enter the amount to withhold from this month's net pay.",
      deductionReason: "Reason",
      lostStockItem: "Catalog Item (Optional)",
      lostStockItemNone: "Type an item name instead",
      lostStockItemName: "Item Name",
      lostStockQuantity: "Quantity",
      lostStockProject: "Project",
      selectProject: "Select Project",
      alreadyExpensed: "Stock already assigned to this project (do not take the same stock out twice).",
      deductionTypes: {
        securityDeposit: "Security Deposit",
        lostStock: "Lost Stock",
        penalty: "Penalty",
        other: "Other",
        returnOfSecurityDeposit: "Return Of Security Deposit",
        clientCompensation: "Client Compensation",
        forfeitedWages: "Remaining Wage Not Paid"
      },
      depositStatus: {
        none: "None",
        held: "Held",
        returned: "Returned",
        keptByCompany: "Kept By The Company"
      },
      errors: {
        amountRequired: "Please enter a Rupiah amount greater than zero.",
        typeRequired: "Please choose a deduction type.",
        reasonRequired: "Other deductions need a reason.",
        employeeNotFound: "Employee not found.",
        projectRequired: "Please choose a project or Head Office.",
        itemRequired: "Please choose a catalog item or type an item name.",
        quantityRequired: "Please enter a quantity for the catalog item.",
        insufficientStock: "Not enough warehouse stock. Use a typed item name, or mark stock as already assigned to the project.",
        saveFailed: "Could not save this deduction.",
        deleteFailed: "Could not remove this deduction.",
        periodLocked:
          "This payroll period is locked. Head Office must unlock it with a reason before changing deductions or net pay.",
        securityDepositAlreadyHeld:
          "This employee already has a security deposit held. Cannot take two.",
        securityDepositNotRequired:
          "Security deposit is not enabled for this employee. Turn on Security Deposit on their employee record first.",
        unlockHoOnly: "Only Head Office can unlock a locked payroll period.",
        unlockReasonRequired: "Please enter a reason to unlock this period.",
        unlockFailed: "Could not unlock this payroll period.",
        decideFailed: "Could not save this day's pay.",
        dayRequired: "Please choose a valid work day in this payroll period.",
        decisionRequired: "Please choose Full pay or a custom amount.",
        dayNotComplete: "This day does not have a completed check-in and check-out.",
        dayAlreadyComplete:
          "This day already meets the 9-hour or 18-hour rule, so it is paid automatically.",
        exemptNoDayDecision:
          "This employee is CICO-exempt and is paid monthly base, not by the day."
      }
    },
    reconciliation: {
      title: "Reconciliation",
      description:
        "Mutual client and HO approve/revise loops for Regular Cleaning reconcile reports and General/Facade progress packages before invoice issue.",
      tabApproved: "Approved",
      tabRevised: "Revised",
      approvedHelp:
        "Packages waiting on the client, plus periods already approved (invoice issued or pending payment).",
      revisedHelp:
        "Client requested changes. Approve with a revised invoice value/number, or reject with an explanation and proof.",
      silentTwoDaysBadge: "Silent 2+ Days — Remind Client",
      silentTwoDaysHelp:
        "Client has not responded for two or more days. Remind them — there is no auto-approve.",
      clientPendingTitle: "Awaiting your review",
      clientPendingHelp:
        "Approve to generate the invoice, or revise with a note and optional proof for Head Office.",
      emptyTitle: "Nothing here",
      emptyDescription: "No reconciliation or progress reviews in this list yet.",
      openBilling: "Open billing",
      viewReport: "View report",
      sendForClientReview: "Send for review",
      clientActionTitle: "Your review",
      clientActionHelp:
        "Review the report, then Approve (invoice is issued) or Revise (explain what is wrong).",
      confirmClientApprove:
        "Approve this report? An invoice will be generated. For a final General or Facade part, the project is marked completed at this point.",
      approve: "Approve",
      approving: "Approving…",
      revise: "Revise",
      reviseNoteLabel: "What is wrong or inaccurate?",
      reviseNotePlaceholder: "Describe the issue in the report…",
      reviseProofLabel: "Supporting proof (optional)",
      submitRevise: "Submit revision",
      submittingRevise: "Submitting…",
      approveFailed: "Failed to approve.",
      reviseFailed: "Failed to submit revision.",
      hoRejectionTitle: "Head Office response",
      viewHoProof: "View HO proof",
      hoProofTitle: "HO supporting document",
      clientRevisionTitle: "Client revision request",
      viewClientProof: "View client proof",
      clientProofTitle: "Client supporting document",
      hoApprove: "Approve revision",
      hoReject: "Reject revision",
      revisedInvoiceHelp:
        "Enter the revised invoice value (and optional invoice number) before issuing to the client.",
      revisedAmount: "Revised invoice amount",
      revisedInvoiceNumber: "Revised invoice number",
      confirmHoApprove: "Approve & issue invoice",
      issuingInvoice: "Issuing…",
      rejectNoteLabel: "Explain the rejection",
      rejectProofLabel: "Supporting proof (optional)",
      confirmHoReject: "Send rejection to client",
      sendingReject: "Sending…",
      hoApproveFailed: "Failed to approve revision.",
      hoRejectFailed: "Failed to reject revision.",
      completedPeriodsTitle: "Invoiced periods",
      invoiceSent: "Invoice sent",
      taxInvoiceIssued: "Tax invoice",
      taxNa: "N/A (no tax ID)"
    },
    progress: {
      title: "Progress Report",
      description:
        "Site photo reports for cleaning staff (Cleaning Staff, GC Staff, In-House Cleaning). Upload while on shift — check-out is blocked until at least one report is submitted for the project.",
      chooseProject: "Choose Project",
      chooseProjectHint:
        "View-only feed — open a project to monitor reports as photos are uploaded.",
      chooseProjectHintClient:
        "Open a project to view notes and photos for your sites.",
      searchClients: "Search Clients",
      searchProjects: "Search Projects",
      clientsSection: "Clients",
      clientsSectionDesc: "In Progress project sites grouped by client.",
      internalSection: "Internal",
      internalSectionDesc: "Head Office and Warehouse.",
      internalSiteHint: "Internal Site",
      noClients: "No Clients",
      noClientsDesc: "No clients with accessible projects were found.",
      noClientsMatch: "No clients match your search.",
      noProjects: "No Projects",
      noProjectsDesc: "This client has no projects you can view.",
      noProjectsMatch: "No projects match your search.",
      projectCountOne: "{count} Project",
      projectCountOther: "{count} Projects",
      breadcrumbAria: "Progress Report Navigation",
      downloadProgressReport: "Download Progress Report",
      downloadAttendance: "Download Attendance",
      attendanceModeDay: "Day",
      attendanceModeMonth: "Month",
      closedMonthHint:
        "Only closed months can be downloaded. The current month is available after it ends.",
      dayNotClosed: "This Day Is Still In Progress",
      dayNotClosedHint: "Pick a past date to download that day's reports.",
      earlyCheckoutTitle: "Checked Out Before Shift End",
      earlyCheckoutDesc:
        "Staff who checked out before the planned shift end. A report was recorded. There is no automatic pay cut.",
      earlyCheckoutEmptyDay: "No Check-Outs Before Shift End On This Day",
      earlyCheckoutEmptyMonth: "No Check-Outs Before Shift End In This Month",
      attendancePdfTitle: "Attendance",
      attendancePdfShift: "Shift",
      attendancePdfHours: "Work Hours",
      attendancePdfEarly: "Before Shift End",
      attendancePdfEmpty: "No attendance recorded for this period.",
      backToProjects: "Back to Projects",
      viewMode: "View",
      filterByDate: "Report Date",
      filterByDateHint: "Use the calendar to jump to a specific day.",
      filterByMonth: "Report Month",
      filterByMonthHint:
        "Read every report from the first day through the last day of this month, without downloading.",
      filterByEmployee: "Filter by Employee",
      filterAllEmployees: "All Employees",
      feedReportCountOne: "{count} Progress Report",
      feedReportCountOther: "{count} Progress Reports",
      myReportsTitle: "My Progress Reports",
      myReportsHint:
        "Upload Progress Reports while working. Cleaning staff must submit at least one Progress Report before CICO check-out.",
      myReportsHintViewOnly:
        "Progress Reports for cleaning staff on this project. Check-in and check-out do not require a Progress Report for your position.",
      checkInRequiredMessage:
        "Check in via CICO for your project before submitting a Progress Report.",
      onLeaveMessage:
        "Progress reports are paused while you are On Leave. Contact Head Office if your status should be updated.",
      submitReport: "Submit Progress Report",
      editReport: "Edit Progress Report",
      dialogTitle: "Progress Report",
      dialogDescription:
        "Cleaning staff: select your project, service area, and notes, then upload site photos. You may submit multiple reports per project and day. Project, Service Area, Notes, and at least one photo are required.",
      dialogDescriptionCicoLocked:
        "Cleaning staff: select your service area and notes, then upload site photos for today's open CICO work day. Project, Service Area, Notes, and at least one photo are required.",
      editDialogTitle: "Edit Progress Report",
      editDialogDescription:
        "Update the service area, notes, or photos for this progress report. The report date cannot be changed. Keep or add at least one photo.",
      dateLockedCicoHint:
        "Report date is locked to your open CICO work day for this project.",
      dateLockedEditHint: "Report date cannot be changed after submit.",
      saveChanges: "Save Changes",
      emptyTitle: "No Progress Reports",
      emptyDescription:
        "No projects or photo reports for this date. Cleaning staff should upload site photos for each assigned cleaning project (including Internal) while on shift.",
      emptyForDate: "No progress reports for this date.",
      emptyForMonth: "No progress reports for this month.",
      selectProject: "Select Project",
      serviceArea: "Service Area",
      serviceAreaPlaceholder: "e.g. Lobby, Floor 3",
      notesPlaceholder: "Notes about the work...",
      projectRequired: "Project is required.",
      serviceAreaRequired: "Service area is required.",
      notesRequired: "Notes are required.",
      photoRequired: "At least one photo is required.",
      progressPhoto: "Progress Photo",
      required: "(required)",
      reportsForDate: "Reports for {date}",
      reportsForMonth: "Reports for {range}",
      directoryHint: "Project → Employee → Progress Reports",
      assignedEmployeeOne: "{count} assigned employee",
      assignedEmployeeOther: "{count} assigned employees",
      reportCountOne: "{count} Progress Report",
      reportCountOther: "{count} Progress Reports",
      noReportsYet: "No progress reports yet for this date.",
      untitledReport: "Progress Report",
      existingPhotos: "Existing Photos",
      existingPhotosHint: "Remove a photo if it is wrong, then add replacements if needed.",
      noPhotosKept: "All existing photos removed — add at least one new photo.",
      addPhotos: "Add Photos",
      removePhoto: "Remove Photo",
      photoUploadHint:
        "JPG, PNG, WebP, or GIF. Up to 10 MB each. Multiple photos allowed.",
      submittedCountOne: "{count} report submitted",
      submittedCountOther: "{count} reports submitted",
      submitted: "Submitted",
      noNotes: "No notes for this report.",
      noPhotos: "No photos attached",
      photoCountOne: "{count} photo",
      photoCountOther: "{count} photos",
      submitFailed: "Failed to submit progress report.",
      editFailed: "Failed to update progress report.",
      errors: {
        employeeProfileNotFound: "Employee profile not found.",
        onProjectOnly:
          "Progress reports are only available while you are On project.",
        activeOnly:
          "Progress reports are only available while your employment status is Active.",
        onLeaveBlocked:
          "Progress reports are unavailable while you are On Leave. Contact Head Office if your status should be updated.",
        projectRequired: "Project is required.",
        serviceAreaRequired: "Service Area is required.",
        notesRequired: "Notes are required.",
        dateRequired: "Date is required.",
        photoRequired: "At least one photo is required.",
        photoMustBeImage: "Photos must be JPG, PNG, WebP, or GIF.",
        photoTooLarge: "Each photo must be 10 MB or smaller.",
        notAssigned: "You are not assigned to this project.",
        backupWindow:
          "This backup assignment is only active on the dates the operations manager set.",
        cleaningOnly:
          "Progress reports are only for cleaning projects (Regular, General, Facade, or Internal).",
        cleaningPositionOnly:
          "Progress reports are only for cleaning staff positions (Cleaning Staff, GC Staff, or In-House Cleaning Staff).",
        inProgressOnly:
          "Progress reports are only for In Progress projects (work order received).",
        reportNotFound: "Progress report not found.",
        editDenied:
          "Only the report author can edit this progress report.",
        headOfficeNotAllowed:
          "Head Office desk staff cannot submit progress reports for commercial sites. In-House Cleaning Staff may submit on assigned Internal sites with an open CICO.",
        checkInRequired:
          "You must check in via CICO before submitting a Progress Report.",
        checkInRequiredForProject:
          "You must be checked in via CICO for this project before submitting a Progress Report.",
        reportDateMustMatchCico:
          "Progress Report date must match your open CICO work day for this project.",
        monthNotClosed:
          "This month is still in progress. Download is available after the month ends.",
        dayNotClosed:
          "This day is still in progress. Download is available after the day ends.",
        exportFailed: "Failed to export PDF.",
        reportDateLocked: "Progress Report date cannot be changed.",
        editDayLocked:
          "This progress report can no longer be edited after the day is over.",
        companyNotFound: "Company not found."
      },
      columns: {
        photos: "Photos",
        notes: "Notes"
      }
    },
    cico: {
      title: "CICO",
      description:
        "Check-In / Check-Out for field staff and office clock for Head Office / Warehouse.",
      employeeOnly: "CICO is only available for employee accounts.",
      noEmployeeProfile:
        "CICO requires a linked employee profile. Ask an administrator to link your login to an employee record.",
      activeOnlyMessage:
        "CICO is only available for Active staff. Contact Head Office if your status should be updated.",
      onProjectOnlyMessage:
        "Field CICO is available while you are On Project and assigned to a cleaning site. In-House Cleaning Staff: assign them to the Internal Head Office or Warehouse project first. Warehouse Supervisor and Corporate desk staff use office CICO.",
      errors: {
        notAssigned: "You are not assigned to this project.",
        backupWindow:
          "This backup assignment is only active on the dates the operations manager set.",
        cleaningOnly:
          "CICO is only for cleaning projects (Regular, General, Facade, or Internal).",
        inProgressOnly:
          "Check-in is only available for In Progress projects (work order received).",
        noSiteLocation: "This project has no site location configured yet.",
        locationRequired: "Location is required. Allow browser location access.",
        employeeAccountsOnly: "CICO is only available for employee accounts.",
        invalidRequest: "Invalid request.",
        employeeProfileNotFound: "Employee profile not found.",
        inactiveEmployee:
          "CICO is not available for archived or removed employee records.",
        activeOnly:
          "CICO is only available while your employment status is Active.",
        onLeaveBlocked:
          "CICO is unavailable while you are On Leave. Contact Head Office if your status should be updated.",
        onProjectOnly:
          "Check-in is only available while you are assigned to an In Progress cleaning project (On Project).",
        selectProject: "Select a project to check in.",
        alreadyCheckedIn: "Already checked in at this site today.",
        mustCheckOutBeforeNextSite:
          "Check out of {site} before checking in at another site.",
        photoRequired:
          "A check-in photo is required. Take a photo that shows you at this project site.",
        photoMustBeImage: "Check-in photo must be an image file.",
        checkOutPhotoRequired:
          "A check-out photo is required. Take a photo that shows you at this project site.",
        checkOutPhotoMustBeImage: "Check-out photo must be an image file.",
        mustCheckInFirst: "You must check in first.",
        alreadyCheckedOut: "Already checked out for this shift day.",
        checkInProjectNoLocation: "Today's check-in project has no site location.",
        tooFarCheckIn:
          "You are {distance} m from {site}. Check in within {radius} m of that project site.",
        tooFarCheckOut:
          "You are {distance} m from {site}. Check out within {radius} m of that project site.",
        lateCheckInNote: "Late check-in (expected before {time}).",
        earlyCheckOutNote: "Checked out before shift end. A report was recorded.",
        earlyCheckoutTitle: "Checking Out Before Shift End",
        earlyCheckoutBody:
          "You are checking out before the end of your shift. If you continue, a report will be sent to your operational manager.",
        progressRequiredBeforeCheckOut:
          "A Progress Report is required to check out. Please upload it and retry CICO."
      },
      todaysCico: "Today's CICO",
      todaysSessions: "Today's Sessions",
      checkOutPending: "Still checked in",
      lateCheckIn: "Late Check-In",
      earlyCheckOut: "Checked Out Before Shift End",
      recentHistory: "Recent History",
      checkIn: "Check In",
      checkOut: "Check Out",
      checkedIn: "Checked In",
      checkedOut: "Checked Out",
      gettingLocation: "Getting location...",
      noHistory: "No check-in history yet.",
      projectSite: "Project Site",
      selectProject: "Select Project",
      noProjectsAssigned:
        "No cleaning projects assigned. Ask your manager to assign you to a Regular, General, or Facade Cleaning site.",
      checkingInAt: "Checking in at",
      mustBeWithinMeters: "Must be within {meters} m of this site.",
      yourShift: "Your Shift:",
      clockInBeforeHint:
        "Clock in before {time} when possible — late check-ins are still allowed. Overnight shifts stay on the same shift day until check-out.",
      noShiftAssigned:
        "No shift assigned yet — ask Head Office to set your shift under Human Resources → Shifts.",
      onSitePhoto: "Check-In Photo",
      required: "(required)",
      photoHelp:
        "Take a photo that clearly shows you at this project site (selfie or on-site proof). Check-in will not succeed without it.",
      checkOutPhotoHelp:
        "Take a photo that clearly shows you at this project site. Check-out will not succeed without it.",
      takePhoto: "Take / Upload Photo",
      retakePhoto: "Retake Photo",
      noPhotoSelected: "No photo selected yet",
      noPhotoSelectedCheckOut: "No check-out photo selected yet",
      checkInPhoto: "Check-In Photo",
      checkInPhotoAlt: "Today's check-in photo",
      checkOutPhoto: "Check-Out Photo",
      checkOutPhotoAlt: "Today's check-out photo",
      checkedInAt: "Checked in at:",
      shiftLabel: "Shift",
      progressRequiredTitle: "Progress Report Required",
      progressRequiredBody:
        "A Progress Report is required to check out. Please upload it and retry CICO.",
      uploadProgressNow: "Upload Progress Report",
      footerNote:
        "CICO for Active On Project cleaning staff at assigned cleaning sites (including Internal). You must be within the project site, and on-site photos are required, to check in or check out. Check-out also requires at least one Progress Report for this shift day.",
      footerNoteCheckInOnly:
        "You must be within the project site, and on-site photos are required, to check in or check out. A Progress Report is not required for your position.",
      chooseImageFile: "Please choose an image file for your on-site photo.",
      photoRequiredAlert:
        "A check-in photo is required. Take a photo that shows you at this project site.",
      checkOutPhotoRequiredAlert:
        "A check-out photo is required. Take a photo that shows you at this project site.",
      checkInFailed: "Check-in failed.",
      checkOutFailed: "Check-out failed.",
      locationFailed:
        "Could not get your location. Allow GPS access and try again.",
      geolocationUnsupported: "Geolocation is not supported on this device.",
      columns: {
        project: "Project",
        checkIn: "Check-In",
        checkOut: "Check-Out"
      },
      adminPreview: {
        bannerTitle: "Preview Mode — Check-In Disabled",
        bannerBody:
          "Head Office accounts can review today's CICO activity and the field worker layout here. Operational check-in and check-out remain for Active On Project cleaning staff only.",
        fieldBannerTitle: "Admin Field Preview",
        fieldBannerBody:
          "You are using CICO as if assigned to this project. Real attendance may be recorded on your linked employee profile.",
        checkedInToday: "Checked In Today",
        openCheckIns: "Open Check-Ins",
        sitesWithActivity: "Sites With Activity",
        viewAttendanceReport: "Progress Report",
        viewProjects: "Projects",
        todaysSiteCheckIns: "Today's Site Check-Ins",
        noCheckInsToday: "No check-ins recorded yet today.",
        fieldWorkerPreview: "Field Worker Layout",
        fieldWorkerPreviewHint:
          "Sample project layout — controls are disabled for Head Office accounts.",
        fieldWorkerFlow: "Field CICO",
        fieldWorkerFlowHint:
          "Select an In Progress project, then check in at site. You must be within the project site and take a photo; Progress Report before check-out applies only for cleaning staff positions.",
        controlsDisabled:
          "Check-in, check-out, and photo upload are disabled in preview mode.",
        noSampleProject:
          "No In Progress cleaning project with a site location is available for preview.",
        noSelectableProject:
          "No In Progress project with a site location is available. Add coordinates to a project first.",
        noEmployeeProfile:
          "Your admin account needs a linked employee profile to record CICO attendance.",
        footerNote:
          "This is a read-only preview. Use Progress Report for live monitoring and Projects to manage site assignments.",
        fieldFooterNote:
          "Attendance is recorded on your employee profile. You must be within the project site to check in or check out."
      }
    },
    attendance: {
      checkedOutBeforeShiftEnd: "Checked Out Before Shift End",
      emptyTitle: "No check-ins",
      noCheckInToday: "No check-in today",
      noCheckInsYet: "No check-ins yet",
      columns: {
        employee: "Employee",
        project: "Project",
        checkIn: "Check-in",
        checkOut: "Check-out",
        date: "Date"
      }
    },
    shifts: {
      title: "Shifts",
      description:
        "Choose a client, then a project site. Add named shifts, assign staff, assign each person to Shift 1–4, or assign a double shift or backup. Check-in and check-out still record actual punch times.",
      breadcrumbAria: "Shifts Navigation",
      searchClients: "Search Clients",
      searchProjects: "Search Projects",
      clientsSection: "Clients",
      clientsSectionDesc: "In Progress project sites grouped by client.",
      internalSection: "Internal",
      internalSectionDesc: "Head Office and Warehouse shifts.",
      internalSiteHint: "Internal Site",
      projectsSection: "Projects",
      projectsSectionDesc: "Project sites for this client.",
      projectCountOne: "{count} Project",
      projectCountOther: "{count} Projects",
      noClients: "No Clients",
      noClientsDesc:
        "In Progress projects appear here. Move a project to In Progress first.",
      noClientsMatch: "No clients match your search.",
      noProjects: "No Projects",
      noProjectsDesc: "This client has no In Progress project sites.",
      noProjectsMatch: "No projects match your search.",
      manageShifts: "Manage Shifts",
      addShift: "Add Shift",
      addShiftDesc: "Add Shift {number} and set its hours. Then assign a regular employee to it.",
      addShiftHint:
        "Each shift is 9 hours. Hours cannot overlap another shift on this project. Adjacent is fine — one can end at 16:00 and the next can start at 16:00.",
      shiftClash:
        "Shift {aNumber} ({aStart}–{aEnd}) clashes with Shift {bNumber} ({bStart}–{bEnd}). Shifts cannot overlap. Change the hours so one ends before the next starts.",
      addShiftConfirm: "Add Shift",
      addShiftSaving: "Adding…",
      addShiftFailed: "Could not add the shift.",
      addShiftEmpty: "Add the first named shift, then assign staff to it.",
      removeShift: "Remove Shift",
      remove: "Remove",
      removeShiftConfirm:
        "Remove {shift}? Unassign staff, backups, and double shifts from this shift first.",
      removeShiftSaving: "Removing…",
      removeShiftFailed: "Could not remove the shift.",
      assignStaffDesc:
        "Choose who works this project. Then assign each person to Shift 1, Shift 2, Shift 3, or Shift 4.",
      assignStaffSaving: "Saving…",
      assignStaffFailed: "Could not assign staff.",
      backupTitle: "Backup Covers",
      searchEmployeesPlaceholder: "Search Employees...",
      emptyStaffTitle: "No Staff Assigned",
      emptyStaffDescription:
        "Use Assign Staff on this page, then assign each person to Shift 1, Shift 2, Shift 3, or Shift 4.",
      emptySearch: 'No Results For "{query}"',
      emptySearchDesc: "Try a different name.",
      staffCount: "{count} Staff",
      projectNotFoundTitle: "Project Not Found",
      projectNotFoundDescription:
        "This project is not active, or it was removed. Go back and pick another project.",
      shiftStart: "Shift Start",
      shiftEnd: "Shift End",
      save: "Save",
      saving: "Saving...",
      saveFailed: "Failed to update shift.",
      rosterTitle: "Staff Shifts",
      windowsTitle: "Project Shifts",
      windowsHint:
        "Set hours here. Shifts on this project cannot overlap. Add Shift when the site needs another named shift (up to 4). Use Remove on a row after staff, backups, and double shifts are unassigned from that shift.",
      assignShift: "Assigned Shift",
      selectShift: "Select Shift",
      unassignedShift: "No Shift",
      columns: {
        employee: "Employee",
        employmentType: "Employment Type",
        shift: "Shift",
        hours: "Hours",
        actions: "Actions"
      }
    },
    teams: {
      assignmentTitle: "Assignment",
      assignmentDescription:
        "Create teams by service area, then add permanent employees to each roster.",
      availabilityTitle: "Team Availability",
      addTeam: "Add Team",
      editTeam: "Edit Team",
      deleteTeam: "Delete Team",
      members: "Members",
      addMember: "Add Member",
      name: "Team Name",
      kind: "Team Type",
      kindGeneral: "General Cleaning",
      kindFacade: "Facade Cleaning",
      kindLandscaping: "Landscaping",
      searchPlaceholder: "Search teams...",
      filterAll: "All",
      emptyTitle: "No Teams Yet",
      emptyDescription:
        "Add a team for a service area, then allocate permanent employees.",
      emptySearch: "No teams match this search.",
      emptyMembers: "No members on this team yet.",
      emptyEligible: "No eligible employees are free to join a team.",
      memberCount: "{count} members",
      memberCountOne: "1 member",
      statusAvailable: "Available",
      statusOnSite: "On Site",
      createFailed: "Could not create the team.",
      updateFailed: "Could not update the team.",
      deleteFailed: "Could not delete the team.",
      deleteBlockedOnJob:
        "This team is on a job. Take it off the job before deleting it.",
      addMemberFailed: "Could not add this employee to the team.",
      removeMemberFailed: "Could not remove this employee from the team.",
      deleteConfirm:
        "Delete {name}? Members become Available and leave the team. Employees are not deleted.",
      previousMonth: "Previous month",
      nextMonth: "Next month",
      noAvailability: "No teams to show.",
      noAvailabilityDesc: "Create a team under Assignment first.",
      openAssignment: "Open Assignment",
      occupiedLegend: "On site",
      availableLegend: "Available",
      columns: {
        team: "Team",
        type: "Type",
        members: "Members",
        status: "Status",
        actions: "Actions"
      }
    },
    leaves: {
      title: "Leave & Sick",
      submitRequest: "Submit Request",
      newRequest: "New Request",
      filterAll: "All",
      requestCount: "{count} Requests",
      permissionSection: "Permission",
      permissionSectionDesc: "Permission requests and their approval status.",
      sickSection: "Sick Leave",
      sickSectionDesc: "Sick leave requests and their approval status.",
      stats: {
        permissionTitle: "Permission",
        permissionSubtitle: "Permission requests",
        sickTitle: "Sick Leave",
        sickSubtitle: "Sick leave requests",
        pendingTitle: "Pending",
        pendingSubtitle: "Waiting for a decision",
        approvedTitle: "Approved",
        approvedSubtitle: "Approved requests"
      },
      dialogTitle: "Leave / Sick Request",
      dialogDescription:
        "Submit a permission or sick leave request for manager approval.",
      emptyPermissionTitle: "No Permission Requests",
      emptySickTitle: "No Sick Leave Requests",
      emptyFilteredTitle: "No Matching Requests",
      emptyFilteredDescription: "Nothing matches the selected filter.",
      emptyPermissionDescriptionEmployee:
        "Submit a permission request when you need time off.",
      emptyPermissionDescriptionManager: "No permission requests to show.",
      emptySickDescriptionEmployee:
        "Submit a sick leave request when you need time off.",
      emptySickDescriptionManager: "No sick leave requests to show.",
      approvedNotification: "Your leave request was approved.",
      approvedNotificationSingle: "Your {type} was approved",
      approvedNotificationMany: "{count} leave requests were approved",
      approvedDetailSuffix: "Approved {when}",
      viewLeaveRequests: "View Leave Requests",
      gotIt: "Got It",
      dismiss: "Dismiss",
      saving: "Saving…",
      dismissApprovedNotification: "Dismiss leave approval notification",
      errors: {
        employeeProfileNotFound: "Employee profile not found.",
        availableOnly:
          "Leave and sick requests are only available when your placement is Available.",
        activeOnly:
          "Leave and sick requests are only available while your employment status is Active.",
        onLeaveBlocked:
          "Leave and sick requests are unavailable while you are On Leave.",
        datesRequired: "Dates are required.",
        reasonRequired: "Reason is required.",
        invalidDates: "Invalid dates.",
        endBeforeStart: "End date cannot be before start date.",
        companyNotFound: "Company not found.",
        leaveNotFound: "Leave request not found.",
        alreadyReviewed: "This request has already been reviewed.",
        notAllowedToApprove: "You are not allowed to approve this request."
      },
      requestType: "Request Type",
      startDate: "Start Date",
      endDate: "End Date",
      reason: "Reason",
      reasonPlaceholder: "Reason for request...",
      proofDocument: "Proof Document",
      proofOptional: "(optional)",
      dropFileOrBrowse: "Drop file here or browse",
      proofMustBeImageOrPdf: "Proof must be an image or PDF.",
      submitFailed: "Failed to submit request.",
      proof: "Proof",
      period: "Period",
      columns: {
        type: "Type",
        reason: "Reason",
        status: "Status"
      }
    },
    approvals: {
      title: "Approvals",
      description: "Approve leave, sick, and material requests.",
      emptyLeaveTitle: "No Leave Requests",
      emptyLeaveDescription: "No pending leave or sick requests.",
      emptyLeaveOnlyOwnDescription:
        "Nothing for you to approve right now. Your own request is listed above and needs another approver.",
      emptyMaterialsTitle: "No material requests",
      emptyMaterialsDescription: "No pending material requests to review.",
      needsAttentionSection: "Needs Attention",
      needsAttentionSectionDesc:
        "Decide the outcome for unresolved item returns. Your decision is final.",
      emptyNeedsAttentionTitle: "No Item Returns",
      emptyNeedsAttentionDescription:
        "Unresolved item returns appear here for a manager decision.",
      leaveSection: "Leave & Sick",
      leaveSectionDesc: "Pending leave and sick requests waiting for your decision.",
      ownPendingTitle: "Your request is waiting for another approver",
      ownPendingDesc:
        "You cannot approve your own leave. Ask another HO admin / Director (e.g. manager) to review it in Approvals.",
      statusPending: "Pending",
      materialsSection: "Material Requests",
      materialsSectionDesc:
        "Review what was requested, check warehouse stock, then approve (creates a Transfer Order) or reject.",
      pendingCount: "{count} pending",
      proof: "Proof",
      period: "Period",
      columns: {
        employee: "Employee",
        type: "Type",
        reason: "Reason"
      }
    },
    materialRequests: {
      title: "Material Requests",
      description:
        "Request materials for the project you are checked into. The Operations Manager or Area Manager approves, then warehouse sends a transfer order.",
      newRequest: "New Request",
      newRequestDesc:
        "Choose an item type, then pick catalog items and quantities for your checked-in project. Items that are out of stock cannot be requested.",
      myRequests: "My Requests",
      myRequestsDesc:
        "Track approval status, transfer progress, and confirm receipt when the warehouse marks the order sent.",
      requestCount: "{count} requests",
      lineCount: "{count} items",
      submittedOn: "Submitted {date}",
      emptyTitle: "No Requests Yet",
      emptyDescription: "Submit a request while checked in via CICO.",
      mustBeCheckedIn:
        "You must be checked in (CICO) to a project before requesting materials.",
      checkedInHint: "Requesting for checked-in project: {project}",
      checkedInProjectLabel: "Checked-in project",
      checkedInHintDetail:
        "This request will be tied to this project and appear in Approvals for OM review.",
      selectItem: "Select Item…",
      selectItemTitle: "Select Item",
      selectItemDesc:
        "Choose the item type first, then pick a catalog item.",
      itemTypeLabel: "Item Type",
      itemTypeHint: "Choose what type of item is requested.",
      itemTypes: {
        sparePart: "Spare Parts",
        consumable: "Consumables",
        chemical: "Chemicals",
        other: "Other",
        equipment: "Equipment",
        vehicle: "Vehicles"
      },
      searchItemsPlaceholder: "Search by name or SKU…",
      noItemsForType: "No catalog items for this type.",
      noItemsMatchSearch: "No items match your search.",
      addLine: "Add Line",
      notesPlaceholder: "Optional notes for AM / warehouse (urgency, location on site…)",
      reviewNotePlaceholder: "Optional review note (required context for rejects recommended)",
      submit: "Submit Request",
      submitHint: "After submit: Approvals → Transfer Orders → Confirm Received on site.",
      linesRequired: "Add at least one item.",
      quantityInvalid: "Quantity must be a positive whole number.",
      projectInvalid: "Checked-in project cannot receive materials right now.",
      createFailed: "Could not create material request.",
      created: "Material request submitted.",
      cancelFailed: "Could not cancel material request.",
      cancelled: "Material request cancelled.",
      notFound: "Material request not found.",
      reviewFailed: "Could not review material request.",
      approved: "Material request approved — transfer order created.",
      rejected: "Material request rejected.",
      noLines: "No line items.",
      stockShort: "Below request",
      outOfStock: "Out Of Stock",
      itemNotAvailable: "Item Not Available",
      itemOutOfStock: "This item is out of stock.",
      status: {
        requested: "Requested",
        approved: "Approved",
        rejected: "Rejected",
        cancelled: "Cancelled"
      },
      columns: {
        item: "Item",
        sku: "SKU",
        qty: "Quantity Requested",
        onHand: "On Hand",
        availability: "Availability",
        requester: "Requester",
        reviewed: "Reviewed",
        notes: "Notes",
        reviewNote: "Review note",
        requestedItems: "Requested items"
      }
    },
    transferOrders: {
      title: "Transfer Orders",
      description:
        "Warehouse Queue: browse by client and project, send approved materials, then site confirms receipt.",
      pendingTitle: "Pending Transfer Order",
      pendingTitleOther: "Pending Transfer Orders",
      pendingDesc:
        "Open orders that still need warehouse or site action.",
      itemSummary: "{qty} {unit} {name}",
      itemSummaryMore: "{qty} {unit} {name} and {count} more",
      directoryTitle: "Clients & Sites",
      directoryDesc:
        "Browse clients and internal sites. Open a project for its warehouse queue and transfer-order history.",
      breadcrumbAria: "Transfer orders navigation",
      searchClients: "Search clients...",
      searchProjects: "Search projects...",
      noClientsMatch: "No clients match your search.",
      noProjects: "No Projects",
      noProjectsDesc: "This client has no accessible projects.",
      noProjectsMatch: "No projects match your search.",
      internalSection: "Internal",
      internalSectionDesc:
        "Head Office and Warehouse queues and transfer-order history.",
      internalSiteHint: "Internal site queue",
      clientsSection: "Clients",
      clientsSectionDesc:
        "Browse clients and projects. Badges show pending send / in transit.",
      projectsSection: "Projects",
      projectCountOne: "{count} project",
      projectCountOther: "{count} projects",
      badgePending: "{count} pending",
      badgeInTransit: "{count} transit",
      queueTitle: "Warehouse Queue",
      queueDesc:
        "Each card shows the destination project, requester, item breakdown, and stock availability before you mark sent.",
      emptyTitle: "No Transfer Orders",
      emptyDescription:
        "Approved material requests appear here when a client or site has items to send.",
      emptyProjectDescription:
        "No transfer orders for this project yet. Approved material requests will show here.",
      notFound: "Transfer order not found.",
      sendFailed: "Could not mark transfer as sent.",
      sent: "Transfer marked as sent. Stock is in transit.",
      markSent: "Mark Sent",
      receiveFailed: "Could not confirm receipt.",
      receiveDenied:
        "You do not have permission to confirm transfer receipt.",
      received: "Receipt confirmed. The project has been charged.",
      confirmReceived: "Confirm Received",
      didNotReceive: "Did Not Receive",
      didNotReceiveFailed: "Could not record that the shipment was not received.",
      itemReturnCompleted: "Item return completed. Stock is back in the warehouse.",
      itemReturnFailed: "Could not complete the item return.",
      completeItemReturn: "Complete Item Return",
      needsAttention: "Needs Attention",
      escalated: "Item return sent to Needs Attention.",
      escalateFailed: "Could not send this item return to Needs Attention.",
      writeOffStock: "Write Off Stock",
      writeOffDone: "Stock written off. The record is kept.",
      writeOffFailed: "Could not write off this stock.",
      assignToProject: "Assign To Project",
      assignToProjectDone: "Stock assigned to the selected project.",
      assignToProjectFailed: "Could not assign this stock to a project.",
      assignToStock: "Assign To Stock",
      assignToStockDone: "Stock returned to the warehouse.",
      assignToStockFailed: "Could not return this stock to the warehouse.",
      projectRequired: "Choose a project.",
      originalProject: "Original Destination",
      mustBeCheckedInToReceive:
        "Check in (CICO) to this project before confirming receipt.",
      requestedBy: "Requested by {name}",
      sentBy: "Sent by {name}",
      receivedBy: "Received by {name}",
      statPending: "{count} pending send",
      statSent: "{count} in transit",
      statReceived: "{count} received",
      status: {
        pendingSend: "Pending Send",
        sent: "Sent",
        received: "Received",
        notReceived: "Did Not Receive",
        returned: "Returned",
        needsAttention: "Needs Attention",
        writtenOff: "Written Off",
        cancelled: "Cancelled"
      },
      columns: {
        createdAt: "Created",
        sentAt: "Sent",
        receivedAt: "Received",
        itemsToSend: "Items to send"
      }
    },
    reports: {
      noProgressForEmployee:
        "No Progress Report for this employee on this day.",
      noCicoForEmployee: "No CICO for this employee on this day.",
      cicoCheckIn: "Check-In",
      cicoCheckOut: "Check-Out",
      cicoInProgress: "In progress",
      pdfWorkDate: "Work Date",
      pdfEmployeeNo: "Employee No.",
      progressPhoto: "Progress photo",
      noReports: "No reports for this month.",
      months: {
        "1": "January",
        "2": "February",
        "3": "March",
        "4": "April",
        "5": "May",
        "6": "June",
        "7": "July",
        "8": "August",
        "9": "September",
        "10": "October",
        "11": "November",
        "12": "December"
      }
    },
    inventory: {
      title: "Inventory",
      companyNotFound: "Company not found.",
      permissionDenied: "You do not have permission to manage inventory.",
      assignPermissionDenied:
        "Only an Operations Manager, Director, or HO admin can assign or void project inventory.",
      noStockToIssue:
        "No items have available stock. Record a stock receipt before assigning to a project.",
      quantityExceedsStock:
        "Quantity exceeds available stock. Available: {available} {unit}.",
      quantityMustBeWhole: "{field} must be a whole number.",
      quantityMustBePositive: "{field} must be greater than zero.",
      quantityMustBeNonNegative: "{field} must be zero or greater.",
      costingNote:
        "Consumables, chemicals, and other stock use weighted-average cost for value and project issues. Last Cost is the most recent purchase unit price (spike check). Equipment owned value is the sum of each asset’s locked purchase cost.",
      searchPlaceholder: "Search items, vendors, projects…",
      searchPurchasesPlaceholder:
        "Search all stock receipts by item, SKU, vendor, invoice…",
      searchVehiclesPlaceholder: "Search plate, vehicle, year…",
      searchingPurchases: "Searching older stock receipts…",
      searchPurchasesFailed: "Could not search stock receipts.",
      itemTypeLocked: "Item type cannot be changed after create.",
      deleteItemFailed: "Could not delete catalog item.",
      addItem: "Add Item",
      addItemDesc:
        "Create a catalog item only. Stock receipts and stock are recorded separately.",
      editItem: "Edit Item",
      editItemDesc:
        "Update catalog details. SKU and item type stay system-assigned.",
      saveItem: "Save Item",
      stockReceiptsViaExpenses:
        "Record stock in Finance → Expenses with purpose Stock. Unpaid bills stay on Accounts Payable and the warehouse updates automatically.",
      addWriteOff: "Write Off Stock",
      addWriteOffDesc:
        "Permanently remove stock from on-hand with a mandatory reason. Decrease only — cannot write off more than on-hand. OM+ only.",
      saveWriteOff: "Write Off",
      addSoldOff: "Generate Sales Invoice",
      addSoldOffDesc:
        "Generate the sales invoice for warehouse stock. Choose the bank account — the PDF is created automatically. Upload the tax invoice for company buyers only. Reduces on-hand stock.",
      saveSoldOff: "Generate Sales Invoice",
      soldOffCreated: "Sales invoice generated.",
      createSoldOffFailed: "Could not generate sales invoice.",
      searchingSoldOffs: "Searching older sales…",
      searchSoldOffsFailed: "Could not search sales.",
      soldOffAssetQtyMismatch:
        "Selected equipment assets must match the sale quantity.",
      soldOffSelectAssetsRequired:
        "Select the equipment units you are selling. Each unit already has an asset code.",
      saleLossConfirmTitle: "Sell At A Loss?",
      saleLossConfirmDescription:
        "Selling the item at this price will incur a loss. Are you sure you want to do this?",
      buyerTypeRequired: "Choose Individual or Company for the buyer.",
      buyerNameRequired: "Buyer name is required.",
      companyNameRequired: "Company name is required.",
      buyerPicNameRequired: "PIC name is required for company buyers.",
      buyerPhoneRequired: "Buyer contact number is required.",
      buyerIdentityDocRequired: "Upload the tax invoice (faktur pajak) for this sale.",
      buyerTaxIdRequired: "Company Tax ID (NPWP) is required for company buyers.",
      taxRateRequired: "Enter a tax rate for this sale.",
      taxAmountRequired: "Sale tax amount must be greater than zero.",
      clientNotFound: "Linked client was not found.",
      clientTypeMismatch:
        "Linked client must match the selected buyer type.",
      searchClientsFailed: "Could not Search clients...",
      deactivate: "Deactivate",
      viewReceipt: "View Receipt",
      viewSaleInvoice: "View Invoice",
      viewBuyerIdentityDoc: "View Tax Invoice",
      saleDetailsTitle: "Sale Details",
      saleDetailsDesc: "Full details for this sale record.",
      saleDetailsLinkedClient: "Linked Client",
      saleDetailsDocuments: "Documents",
      saleDetailsTaxInvoice: "Tax Invoice",
      saleDetailsBuyerEmpty:
        "No buyer details on this sale. Newer sales capture company/PIC or individual identity.",
      saleDetailsDocsEmpty: "No documents attached.",
      saleDetailsExTaxHint: "Does not include tax.",
      saleDetailsGainLossHint:
        "Gain/loss uses ex-tax sale vs ex-tax cost.",
      stockDetailTitle: "Stock Item Detail",
      stockDetailDesc:
        "Lifetime bought, warehouse stock, assignments, sales, and write-offs for this item.",
      stockDetailBought: "Bought (All Time)",
      stockDetailAssigned: "Assigned",
      stockDetailInStock: "In Stock",
      stockDetailWrittenOff: "Written Off",
      stockDetailSold: "Sold",
      stockDetailAssignmentsTitle: "Assigned By Project",
      stockDetailAssignmentsDesc:
        "Lifetime totals per project (all issue dates combined). Voided issues are excluded.",
      stockDetailEmptyAssignments: "No Project Assignments",
      stockDetailEmptyAssignmentsDesc:
        "This item has not been issued to any project yet.",
      stockDetailSalesTitle: "Sold",
      stockDetailSalesDesc:
        "When it left stock and who bought it. Open Finance → Sales for invoices, payment, and price.",
      stockDetailEmptySales: "No Sales Yet",
      stockDetailEmptySalesDesc: "This item has not been sold yet.",
      stockDetailLoading: "Loading item detail…",
      stockDetailLoadFailed: "Could not load stock item detail.",
      stockDetailSoldTo: "Sold To",
      stockDetailSoldAt: "Sold",
      itemCreated: "Catalog item created.",
      itemUpdated: "Catalog item updated.",
      writeOffCreated: "Stock written off.",
      writeOffAssetsRequired:
        "Select the equipment units to write off. Each unit has its own asset code.",
      writeOffAssetQtyMismatch:
        "The number of selected equipment units must match the write-off quantity.",
      writeOffReversed: "Write-off reversed. Stock restored.",
      reverseWriteOff: "Reverse",
      reverseWriteOffTitle: "Reverse Write-Off",
      reverseWriteOffDesc:
        "Restore this quantity to on-hand stock and reactivate linked equipment assets. This cannot be undone.",
      reverseWriteOffConfirm: "Reverse Write-Off",
      reverseWriteOffFailed: "Could not reverse write-off.",
      writeOffAlreadyReversed: "This write-off was already reversed.",
      soldOffReversed: "Sale reversed. Stock restored.",
      reverseSale: "Reverse",
      reverseSaleTitle: "Reverse Sale",
      reverseSaleDesc:
        "Restore this quantity to on-hand stock and reactivate linked equipment assets. Use this when the buyer cancels the purchase. This cannot be undone.",
      reverseSaleConfirm: "Reverse Sale",
      reverseSaleFailed: "Could not reverse sale.",
      saleAlreadyReversed: "This sale was already reversed.",
      itemNameRequired: "Item name is required.",
      vehicleBrandRequired: "Enter the vehicle brand.",
      vehicleTypeRequired: "Enter the vehicle type.",
      itemTypeRequired: "Item type is required.",
      itemRequired: "Choose a catalog item.",
      projectRequired: "Choose a project.",
      itemNotFound: "Catalog item not found.",
      vendorNotFound: "Vendor not found.",
      movementNotFound: "Inventory movement not found.",
      insufficientStock: "Not enough stock. Available: {available} {unit}.",
      insufficientUncodedStock:
        "Not enough new warehouse units without an asset code. Available: {available} {unit}.",
      insufficientEquipmentAssets:
        "Not enough available equipment assets for this write-off. Available: {available}. Required: {requested}.",
      insufficientEquipmentAssetsForIssue:
        "Not enough available equipment units to issue. Available: {available}. Required: {requested}.",
      voidReasonRequired: "A void reason is required.",
      writeOffReasonRequired: "A write-off reason is required.",
      createItemFailed: "Could not create catalog item.",
      updateItemFailed: "Could not update catalog item.",
      deactivateItemFailed: "Could not deactivate catalog item.",
      reactivateItemFailed: "Could not restore catalog item.",
      voidFailed: "Could not void movement.",
      createWriteOffFailed: "Could not record stock write-off.",
      emptyPurchases: "No Stock Receipts Yet",
      emptyPurchasesDesc:
        "Record a product expense with purpose Stock in Finance → Expenses. Warehouse stock updates automatically.",
      emptyIssues: "No Project Issues Yet",
      emptyIssuesDesc:
        "Project issues appear here after a Transfer Order is marked sent. Request stock via Material Requests → Approvals → Transfer Orders.",
      emptyWriteOffs: "No Write-Offs Yet",
      emptyWriteOffsDesc:
        "Write-offs permanently reduce on-hand stock with a mandatory reason.",
      emptySoldOffs: "No Sales Yet",
      emptySoldOffsDesc:
        "Generate a sales invoice under Finance → Sales. Sales reduce on-hand inventory.",
      emptyStock: "No Active Stock Items",
      emptyStockDesc: "Activate catalog items and record stock receipts to see stock.",
      emptyAssetList: "No Active Equipment Assets",
      emptyAssetListDesc:
        "Activate equipment catalog items and record stock receipts to see owned assets.",
      emptyVehicles: "No Vehicles Yet",
      emptyVehiclesDesc:
        "Add a Vehicle type in Goods Catalog, then record each vehicle on an expense with its plate and year.",
      emptySearch: 'No results for "{query}"',
      emptySearchDesc: "Try a different item name, SKU, vendor, or project.",
      tabs: {
        purchases: "Stock Receipts",
        issues: "Project Issues",
        stock: "Stock",
        assetList: "Asset List",
        vehicles: "Vehicles",
        writeOffs: "Write-Offs",
        factoryReturns: "Return To Vendor"
      },
      stats: {
        purchasesSubtitle: "Warehouse stock-in (no AP)",
        issuesSubtitle: "Assigned to projects",
        stockSubtitle: "{low} below min stock",
        assetListSubtitle: "{warehouse} in warehouse · {owned} owned",
        vehiclesSubtitle: "{count} vehicles",
        writeOffsSubtitle: "Permanent stock removals",
        factoryReturnsSubtitle: "Waiting at the vendor"
      },
      projectIssues: {
        selectHint: "Select a project to view issued inventory.",
        backToProjects: "Back To Projects",
        issueCountOne: "1 Issue",
        issueCountOther: "{count} Issues",
        deployCountOne: "1 Deployed",
        deployCountOther: "{count} Deployed",
        totalCost: "Total Cost {amount}",
        emptyProjects: "No Projects With Issues",
        emptyProjectsDesc:
          "Issue stock to a project to see it listed here.",
        emptyProjectRows: "No Issues For This Project",
        emptyProjectRowsDesc:
          "No issued items match the current filters for this project."
      },
      stock: {
        itemClickHint:
          "Click a stock item to see bought, in stock, assigned, sold, and written off — plus who it was sold to.",
        equipmentClickHint:
          "Click an equipment item to open its product page, including Return To Vendor."
      },
      overview: {
        categoryEquipment: "Equipment",
        categoryVehicles: "Vehicles",
        categorySpareParts: "Spare Parts",
        categoryChemicals: "Chemicals",
        categoryConsumables: "Consumables",
        categoryOthers: "Others",
        assetCode: "Asset Code",
        numberPlate: "Number Plate",
        location: "Location",
        locationWarehouse: "Warehouse",
        locationOnProject: "On Project",
        serialNo: "Serial No.",
        acquisitionCost: "Acquisition Cost",
        showSold: "Show Sold",
        showWrittenOff: "Show Written Off",
        emptyAssets: "No active equipment units.",
        retired: "Retired",
        sold: "Sold",
        soldTo: "Sold To",
        writtenOff: "Written Off"
      },
      saleSource: {
        label: "What Are You Selling?",
        required: "Choose New In Warehouse or Issued Asset.",
        placeholder: "Choose New Or Issued",
        newInWarehouse: "New In Warehouse",
        issuedAsset: "Issued Asset",
        newHint: "{available} sealed units in the warehouse. Sell by quantity. No asset code.",
        issuedHint:
          "Pick coded units. Location is the project name, or Head Office if the unit already came home.",
        chooseHint: "New sealed boxes have no asset code. Issued units keep their code."
      },
      product: {
        description:
          "Warehouse stock, coded units, sales, and Return To Vendor for this equipment.",
        backToInventory: "Back To Inventory",
        newInWarehouse: "New In Warehouse",
        headOfficeUsed: "Head Office — Used",
        headOffice: "Head Office",
        inTransit: "In Transit",
        assetList: "Asset List",
        assetListHint:
          "New warehouse boxes have no asset code. Issued units show their code and location.",
        newNoCode: "New — no asset code",
        newStockRow: "{qty} New — no asset code",
        soldNew: "Sold — New, no asset code",
        soldNewNoCode: "Sold — New, no asset code",
        soldNewRow: "{qty} Sold — New, no asset code"
      },
      vehicles: {
        clickHint: "Click a vehicle to see and edit its plate, year, and details.",
        back: "Back To Inventory",
        locationCompany: "Company",
        updated: "Vehicle updated.",
        updateFailed: "Could not update this vehicle.",
        notFound: "Vehicle not found.",
        plateTaken: "This number plate is already on file."
      },
      factoryReturn: {
        title: "Return To Vendor",
        send: "Return To Vendor",
        sendDesc:
          "Send a new warehouse box or a coded unit. Refund closes now. Repair or Replace stays open until something comes back.",
        sent: "Sent To Vendor.",
        sendFailed: "Could not send this unit to the vendor.",
        updated: "Vendor return updated.",
        updateFailed: "Could not update this vendor return.",
        permissionDenied:
          "Only a Director or the owner can send equipment to the vendor.",
        reasonRequired: "Enter the reason for this vendor return.",
        intentRequired: "Choose Refund, Repair, or Replace.",
        sourceRequired: "Choose New In Warehouse or Issued Asset.",
        refundAmountRequired: "Enter the vendor refund amount.",
        assetsRequired: "Select the coded units to send.",
        insufficientNew: "Not enough new warehouse units without an asset code.",
        insufficientStock: "Not enough warehouse stock for this vendor return.",
        notFound: "Vendor return not found.",
        notWaiting: "This vendor return is already closed.",
        refundFailed: "Could not record the vendor refund.",
        repairFailed: "Could not confirm the repaired unit.",
        replaceFailed: "Could not receive the replacement.",
        sentAt: "Sent",
        unit: "Unit",
        intent: "Vendor Action",
        reason: "Reason",
        source: "What Are You Sending?",
        assets: "Issued Assets",
        refundAmount: "Refund Amount",
        recordRefund: "Record Refund",
        recordRefundDesc:
          "Close this return. Stock stays down. The refund amount is recorded here.",
        confirmRepaired: "Confirm Repaired",
        receiveReplacement: "Replacement Received",
        vendorOptional: "Vendor (Optional)",
        newNoCode: "{qty} New — no asset code",
        newHint: "{available} sealed units available. They come back without a code if repaired.",
        issuedHint:
          "Pick coded units. Repair keeps the same code at Head Office. Replacement arrives as new stock with no code.",
        productHint:
          "Hanging returns always keep Record Refund, Confirm Repaired, and Replacement Received.",
        empty: "No Vendor Returns",
        emptyDesc: "Open an equipment product page to send a unit to the vendor.",
        emptyDescDirector:
          "Open an equipment item from Asset List to send a unit to the vendor.",
        listHint: "Open the equipment name to send a unit or close a hanging return.",
        intents: {
          REFUND: "Refund",
          REPAIR: "Repair",
          REPLACE: "Replace"
        },
        statuses: {
          WAITING: "Returned To Vendor",
          REPAIRED: "Repaired",
          REPLACED: "Replaced",
          REFUNDED: "Refunded"
        }
      },

      import: {
        noDataRows: "No data rows found in the spreadsheet. Add rows below the header.",
        invalidRow: "Invalid row.",
        duplicateInFile:
          "Duplicate catalog item “{name}” ({itemType}) in this file or already exists.",
        duplicateSkipped:
          "Skipped duplicate catalog item “{name}” ({itemType}).",
        skuAssignedOnSave: "SKU will be assigned from Item Type when you confirm."
      },
      columns: {
        sku: "SKU",
        plate: "Number Plate",
        vehicleYear: "Year",
        dateBought: "Date Bought",
        item: "Item",
        status: "Status",
        actions: "Actions",
        date: "Date",
        vendor: "Vendor",
        qty: "Quantity",
        unitPrice: "Unit Price",
        total: "Total",
        invoice: "Invoice",
        project: "Project",
        unitCost: "Unit Cost",
        projectCost: "Project Cost",
        totalCost: "Total Cost",
        onHand: "On Hand",
        warehouseOnHand: "Warehouse",
        owned: "Owned",
        minStock: "Min Stock",
        avgCost: "Avg Cost",
        lastCost: "Last Cost",
        valueOnHand: "Value On Hand",
        valueOwned: "Owned Value",
        writeOffValue: "Value Written Off",
        writeOffReason: "Write-Off Reason",
        writtenOffBy: "Written Off By",
        saleSubtotal: "Sale (Ex Tax)",
        saleTotal: "Sale Total",
        costBasis: "Cost Basis (Ex Tax)",
        gainLoss: "Gain / Loss",
        saleInvoice: "Sale Invoice",
        buyer: "Buyer",
        soldBy: "Sold By",
        notes: "Notes"
      },
      form: {
        itemType: "Item Type",
        itemTypePlaceholder: "Select Item Type",
        itemTypeHint: "Classify the catalog item (not a stock receipt).",
        itemName: "Item Name",
        itemNamePlaceholder: "e.g. Floor Cleaner 5L",
        vehicleBrand: "Brand",
        vehicleBrandPlaceholder: "e.g. Mercedes-Benz",
        vehicleBrandHint: "The maker of this vehicle type.",
        vehicleType: "Type",
        vehicleTypePlaceholder: "e.g. E300",
        vehicleTypeHint: "The model type, such as E300 or S400.",
        vehicleBrandAndType: "Brand And Type",
        vehicleBrandAndTypeHint:
          "Brand then type, for example Mercedes-Benz E300.",
        vehiclePlate: "Number Plate",
        vehiclePlatePlaceholder: "e.g. B 1234 ABC",
        vehiclePlateEditHint:
          "Change the plate here. The same type of vehicle can have many plates.",
        vehicleYear: "Vehicle Year",
        vehicleYearPlaceholder: "e.g. 2024",
        vehicleYearHint: "The model year of this vehicle.",
        catalogOnlyVehicleHint:
          "This creates the vehicle type only. Record each plate and year when you add the expense, then edit them under Inventory → Vehicles.",
        sku: "SKU",
        skuHint:
          "System-generated from Item Type when you save (e.g. TOOL-001, CNS-002). Not entered manually.",
        skuPickType: "Select Item Type to preview SKU",
        skuLoading: "Loading…",
        skuReadonlyHint:
          "SKU was assigned from Item Type at create and cannot be changed.",
        itemTypeLockedHint:
          "Item type is set at create and cannot be changed.",
        description: "Description",
        descriptionPlaceholder: "Optional notes about this catalog item.",
        catalogOnlyHint:
          "This creates the catalog entry only. Use Stock Receipts to add warehouse stock.",
        unit: "Unit",
        unitHint:
          "How stock is counted: piece, box, kilogram, liter, and the other warehouse measures.",
        minStock: "Min Stock",
        minStockHint: "Low-stock warning threshold on the Stock tab.",
        catalogItem: "Catalog Item",
        catalogItemPlaceholder: "Select Catalog Item",
        catalogItemSearchPlaceholder: "Search by name, SKU, or type…",
        catalogItemNoSearchMatch: "No stocked items match this search.",
        soldOffNoStockForType:
          "No stocked items of this type are available to sell.",
        quantity: "Quantity",
        notes: "Notes",
        issueItemHint: "Only items with on-hand stock are listed.",
        equipmentDeployed: "Deployed",
        writeOffDate: "Write-Off Date",
        writeOffReason: "Write-Off Reason",
        writeOffReasonPlaceholder: "Describe why this stock is being written off (damage, expiry, loss, etc.).",
        writeOffReasonHint: "Required. This reason is permanently recorded in the audit trail.",
        writeOffItemHint: "On hand: {available} {unit}. Write-off cannot exceed this amount.",
        writeOffAssets: "Equipment Assets",
        writeOffNoAssets: "No warehouse equipment units available to write off.",
        writeOffAssetsHint:
          "Select the exact units. Write-off cannot pick a unit for you.",
        reverseWriteOffReason: "Reverse Reason",
        reverseWriteOffReasonPlaceholder:
          "Optional note for why this write-off is being reversed.",
        reverseWriteOffReasonHint:
          "Optional. Your name and the reversal time are recorded automatically.",
        reverseSaleReason: "Reverse Reason",
        reverseSaleReasonPlaceholder:
          "Optional note for why this sale is being reversed (for example, buyer cancelled).",
        reverseSaleReasonHint:
          "Optional. Your name and the reversal time are recorded automatically.",
        saleDate: "Sale Date",
        saleUnitPrice: "Sale Unit Price (Ex Tax)",
        saleUnitPriceExTaxHint:
          "Enter the pre-tax (ex-tax) unit price. Tax is calculated from the rate below.",
        saleSubtotal: "Subtotal (Ex Tax)",
        saleTaxAmount: "Tax Amount",
        saleTotal: "Sale Total (Incl. Tax)",
        saleVatExclusivePreview:
          "DPP {dpp} + Tax {tax} ({rate}%) = {total}.",
        taxRate: "Tax Rate (%)",
        taxRatePlaceholder: "e.g. 11",
        taxRateHint:
          "Defaults to 11%. Change this if the invoice uses a different tax rate.",
        linkClient: "Link Client (Optional)",
        clientSearchPlaceholder: "Search clients...",
        clientOptionalPlaceholder: "Select Client (Optional)",
        clientNoSearchMatch: "No clients match this search.",
        linkClientHint:
          "Optional. Prefills buyer name and company NPWP from the client directory.",
        linkClientHintCompany:
          "Optional. Shows company clients only. Prefills buyer name and NPWP.",
        linkClientHintIndividual:
          "Optional. Shows individual clients only. Prefills buyer name.",
        buyerType: "Buyer Type",
        buyerTypeIndividual: "Individual",
        buyerTypeCompany: "Company",
        buyerTypeHint:
          "Choose buyer type first. Link Client and buyer details appear next.",
        buyer: "Buyer Name",
        buyerPlaceholder: "Buyer name",
        buyerManualHint:
          "Required. Enter a one-time buyer, or keep/edit the name from a linked client.",
        companyName: "Company Name",
        companyNamePlaceholder: "Company / buyer name",
        companyNameHint:
          "Required. Enter the company name, or keep/edit it from a linked client.",
        buyerPicName: "PIC Name",
        buyerPicNamePlaceholder: "Person in charge",
        buyerPicNameHint: "Required. Contact person at the company.",
        buyerPhone: "Contact Number",
        buyerPhonePlaceholder: "e.g. 0812 3456 7890",
        buyerPhoneHint: "Required. Phone or WhatsApp number for this buyer.",
        buyerPhoneHintCompany:
          "Required. Phone or WhatsApp number for the PIC.",
        buyerIdentityDoc: "Tax Invoice",
        buyerIdentityDocHint:
          "Required for company buyers. Upload the tax invoice (faktur pajak) only — the sales invoice PDF is generated automatically.",
        buyerTaxId: "Company Tax ID (NPWP)",
        buyerTaxIdIndividual: "Tax ID (NPWP)",
        buyerTaxIdPlaceholder: "15 Or 16 Digit NPWP",
        buyerIdNumber: "National ID (KTP)",
        buyerIdNumberPlaceholder: "16 Digit NIK / KTP",
        buyerIdentityEitherHint:
          "Required: enter Tax ID (NPWP) or National ID (KTP) — at least one.",
        soldOffItemHint:
          "On hand: {available} {unit}. Sale cannot exceed this amount.",
        soldOffEquipmentHint:
          "Warehouse {warehouse} · On site {onSite}. Pick the asset codes you are selling.",
        soldOffAssets: "Equipment Assets",
        soldOffNoAssets: "No warehouse or on-site units for this item.",
        soldOffAssetsHint:
          "Required. Pick the exact units. A unit on a site is marked sold there — it does not come back to the warehouse first. The asset code stays the same.",
        soldOffOnSite: "On Site · {project}",
        soldOffNotesPlaceholder: "Optional notes about this sale."
      },
      itemTypes: {
        Consumable: "Consumables",
        Equipment: "Equipment",
        Vehicle: "Vehicles",
        "Spare Part": "Spare Parts",
        Chemical: "Chemicals",
        Other: "Other"
      },
      units: {
        pcs: "Piece",
        unit: "Unit",
        pair: "Pair",
        set: "Set",
        roll: "Roll",
        box: "Box",
        carton: "Carton",
        pack: "Pack",
        bag: "Bag",
        sack: "Sack",
        drum: "Drum",
        bottle: "Bottle",
        can: "Can",
        kg: "Kilogram",
        g: "Gram",
        ton: "Ton",
        l: "Liter",
        ml: "Milliliter",
        m: "Meter",
        cm: "Centimeter",
        m2: "Square Meter"
      }
    },
    itemCatalog: {
      title: "Goods Catalog",
      directoryTitle: "Goods Catalog",
      directoryDesc:
        "Define goods types and SKUs used by Inventory and expenses.",
      companyNotFound: "Company not found.",
      permissionDenied: "You do not have permission to manage the goods catalog.",
      searchPlaceholder: "Search items, SKU, type…",
      addItem: "Add Item",
      importExcel: "Import Excel",
      bulkCreateTitle: "Add catalog items in bulk",
      bulkCreateDesc:
        "Choose the item type, then add each item. Every item gets its own SKU.",
      bulkCreateSharedHint: "Every line below is created as this item type.",
      bulkCreateSkuHint:
        "Assigned when you save. Each item gets the next free SKU for this type.",
      bulkCreateItems: "Items",
      bulkCreateItemsHint:
        "Each line is one catalog item with its own SKU. Description is optional.",
      bulkCreateSuccess: "Added {count} catalog items.",
      deactivate: "Deactivate",
      delete: "Delete",
      deleteConfirm:
        "Delete “{name}”? Unused items are removed permanently. Items with purchase or stock history are archived so history is kept.",
      itemDeactivated: "Catalog item deactivated.",
      itemReactivated: "Catalog item restored.",
      itemDeleted: "Catalog item deleted.",
      deactivateItemFailed: "Could not deactivate catalog item.",
      reactivateItemFailed: "Could not restore catalog item.",
      deleteItemFailed: "Could not delete catalog item.",
      emptyItems: "No Catalog Items Yet",
      emptyItemsDesc: "Add an item to the catalog before recording stock receipts.",
      emptySearch: 'No results for "{query}"',
      emptySearchDesc: "Try a different item name, SKU, or type.",
      stats: {
        activeTitle: "Active Items",
        activeSubtitle: "{inactive} inactive",
        totalTitle: "Total Items",
        totalSubtitle: "Active and inactive catalog entries"
      },
      status: {
        active: "Active",
        inactive: "Inactive"
      },
      columns: {
        sku: "SKU",
        item: "Item",
        itemType: "Item Type",
        status: "Status",
        actions: "Actions"
      }
    },
    companyDetails: {
      title: "Company Details",
      description:
        "Office identity used on invoices, progress reports, and letterheads.",
      directoryTitle: "Company Details",
      directoryDesc:
        "This is the source of truth for the company name, website, office address, and the contact printed on generated documents.",
      companyNotFound: "Company not found.",
      permissionDenied: "Only the owner can edit Company Details.",
      nameRequired: "Company name is required.",
      websiteInvalid: "Enter a valid website address.",
      saved: "Company Details saved.",
      saveFailed: "Could not save Company Details.",
      sections: {
        identity: "Identity",
        identityHint:
          "Printed on invoices, progress reports, and other letterheads.",
        contact: "Contact",
        contactHint: "Office address and how clients reach the company.",
        tax: "Tax",
        bank: "Bank",
        bankHint:
          "Recipient accounts printed on invoices. Add every account clients may pay to."
      },
      form: {
        name: "Company Name",
        website: "Company Website",
        websitePlaceholder: "https://www.rgs.co.id",
        address: "Office Address",
        addressPlaceholder: "Office street, block, city, and postal code",
        addressHint: "Use one line per address row, as it should appear on letterheads.",
        phone: "Phone",
        email: "Email",
        npwp: "NPWP",
        npwpHint: "Company tax ID. Printed on letterheads when filled.",
        bankName: "Bank Name",
        bankAccountNumber: "Account Number",
        bankAccountName: "Account Holder",
        bankLabel: "Label",
        bankLabelHint: "Optional. Example: Operating, Tax, or Project Transfers."
      },
      bank: {
        add: "Add Bank Account",
        addTitle: "Add Bank Account",
        addDesc: "This account can be printed on invoices and used in the Financial Report.",
        editTitle: "Edit Bank Account",
        editDesc: "Update the details printed on new invoices that use this account.",
        save: "Save Bank Account",
        saved: "Bank Account saved.",
        saveFailed: "Could not save the bank account.",
        deleted: "Bank Account deleted.",
        deleteFailed: "Could not delete the bank account.",
        notFound: "Bank account not found.",
        fieldRequired: "{field} is required.",
        cannotDeleteOpen:
          "This account is still attached to an unpaid or open invoice. Choose another account on those invoices first, then delete it.",
        empty: "No Bank Accounts",
        emptyDesc: "Add a bank account so invoices can print where the client should pay.",
        columns: {
          bankName: "Bank Name",
          accountNumber: "Account Number",
          accountHolder: "Account Holder",
          label: "Label",
          actions: "Actions"
        }
      }
    }
  },

  modules: {
    dashboard: "Dashboard",
    projects: "Projects",
    teams: "Teams",
    progress: "Progress Report",
    cico: "CICO",
    pettyCash: "Petty Cash",
    attendance: "Attendance Report",
    shifts: "Shifts",
    leaves: "Leave & Sick",
    approvals: "Approvals",
    materialRequests: "Material Requests",
    transferOrders: "Transfer Orders",
    reports: "Client Reports",
    inventory: "Inventory",
    itemCatalog: "Goods Catalog",
    invoicing: "Invoice and Billing",
    reconciliation: "Reconciliation",
    purchaseInvoices: "Expenses",
    loans: "Loan",
    bpjs: "BPJS",
    sales: "Sales",
    taxInvoices: "Tax",
    vendorPayments: "Payment & Settlement",
    thr: "THR",
    payroll: "Internal Payroll",
    financialReport: "Financial Report",
    clients: "Clients",
    vendors: "Vendors",
    users: "Users",
    employees: "Employees",
    departments: "Departments",
    settings: "Company Details",
    website: "Website CMS"
  },

  bulkImport: {
    inventoryItemsTitle: "Import goods catalog from Excel",
    downloadExcelTemplate: "Excel template",
    preparingTemplate: "Preparing template…",
    invalid: "Invalid",
    duplicate: "Duplicate",
    willAdd: "Will add",
    willAddWithWarning: "Will add · warning",
    reviewImport: "Review import",
    readingFile: "Reading file...",
    confirmAdd: "Confirm add",
    confirmAddCount: "Confirm add ({count})",
    dropFile: "Drop file here or browse",
    chooseDifferent: "Tap to choose a different Excel file",
    acceptsXlsx: "Accepts .xlsx · works on desktop and phone",
    uploadDescription:
      "Upload a filled Excel template to create many {plural} at once. You will review a preview before anything is created.",
    previewDescription:
      "Review each row below. Rows marked “Will add” (including warnings) are created when you confirm.",
    taxIdDocumentRequiredCompany: "Upload an NPWP document.",
    taxIdDocumentRequiredIndividual: "Upload an NPWP or NIK document.",
    noExtraDetails: "No extra details",
    rowLabel: "Row {row}: {name}",
    rowIssue: "Row {row}: {message}",
    skipped: "Skipped",
    failed: "Failed",
    invalidSkipped: "Invalid rows will not be created.",
    createdInventoryItemsNote:
      "Catalog items only — SKUs are assigned from Item Type (e.g. TOOL-001). Record stock receipts separately to add stock.",
    uploadExcelRequired: "Upload an Excel file (.xlsx).",
    chooseExcel: "Choose an Excel file to upload.",
    noDataRows: "No data rows found in the spreadsheet. Add rows below the header.",
    invalidRow: "Invalid row.",
    invalidReviewResponse: "Import review returned an invalid response.",
    reviewFailed: "Could not review the {plural} import file.",
    importFailed: "Could not import {plural}.",
    templateDownloadFailed: "Could not download the Excel template.",
    templateEmpty: "The Excel template was empty. Please try again."
  },

  auth: {
    signIn: "Sign in",
    signingIn: "Signing in...",
    forgotPassword: "Forgot password",
    forgotPasswordQuestion: "Forgot password?",
    saveAndContinue: "Save and continue",
    savePasswordAndContinue: "Save password and continue",
    saveAndSignIn: "Save and sign in",
    settingUp: "Setting up...",
    sending: "Sending...",
    sendResetLink: "Send reset link",
    updatePassword: "Update password",
    backToLogin: "Back to login",
    welcomeBack: "Welcome Back",
    signInSubtitle:
      "Sign in to manage your workspace, projects, and business operations.",
    username: "Username",
    password: "Password",
    enterPassword: "Enter your password",
    showPassword: "Show password",
    hidePassword: "Hide password",
    protectedBy: "Protected by RGS ONE Identity",
    firstTimeSigningIn: "First time signing in?",
    enterpriseEdition: "Enterprise Edition",
    version: "Version {version}",
    heroKicker: "Built for service teams",
    heroTitle: "Run your operations",
    heroTitleAccent: "with clarity.",
    heroSubtitle:
      "From daily site progress to team attendance — everything your cleaning business needs, connected.",
    highlightProjects: "Projects, staff, and locations in one view",
    highlightProgress: "Daily progress and attendance tracking",
    highlightLeaves: "Leave requests and approvals",
    invalidCredentials: "Invalid username or password.",
    signInFailed: "We could not sign you in. Please try again.",
    passwordUpdated: "Your password has been updated. You can sign in now.",
    forgotTitle: "Forgot password",
    forgotSubtitle:
      "Enter your username. If an account exists, we will send a reset link to the recovery email set by your administrator.",
    forgotSuccess:
      "If an account exists for that username, a password reset link has been sent to the recovery email on file.",
    forgotNoEmail:
      "This account has no recovery email on file. Please contact your administrator.",
    forgotSendFailed:
      "We could not send the reset email. Check SMTP settings or try again later.",
    forgotFailed: "We could not process your request. Please try again.",
    resetTitle: "Set new password",
    resetSubtitle: "Choose a new password for your account.",
    resetInvalidTitle: "Invalid reset link",
    resetInvalidSubtitle: "This password reset link is missing or invalid.",
    resetInvalidToken:
      "This reset link is invalid or has expired. Please request a new one.",
    resetFailed: "We could not reset your password. Please try again.",
    requestNewResetLink: "Request a new reset link",
    firstLoginTitle: "Set up your account",
    firstLoginSubtitle:
      "First time signing in? Choose a password and recovery email to finish setting up your account.",
    finishSetupTitle: "Finish account setup",
    createPasswordTitle: "Create your password",
    welcomeName: "Welcome, {name}.",
    finishSetupSubtitle:
      "Choose a new password and recovery email to finish setting up your account.",
    createPasswordSubtitle:
      "Choose a new password to finish setting up your account.",
    recoveryEmail: "Recovery email",
    recoveryEmailHelp:
      "Used only for password reset if you forget your password.",
    recoveryEmailTitle: "Add a recovery email",
    recoveryEmailSubtitle:
      "Add a recovery email before continuing. It is used only if you need to reset your password.",
    signedInAs: "Signed in as {username}",
    yourUsername: "Your username",
    newPassword: "New password",
    confirmPassword: "Confirm password",
    enterNewPassword: "Enter new password",
    confirmNewPassword: "Confirm new password",
    passwordsDoNotMatch: "Passwords do not match.",
    passwordTooShort: "Password must be at least 8 characters.",
    invalidRecoveryEmail: "Enter a valid recovery email address.",
    recoveryEmailTaken: "That recovery email is already in use.",
    savePasswordFailed: "We could not save your password. Please try again.",
    saveRecoveryFailed:
      "We could not save your recovery email. Please try again.",
    setupFailed: "We could not set up your account. Please try again.",
    accountAlreadySetUp:
      "This account already has a password. Please sign in instead.",
    accountDeleted: "This account has been deleted. Contact your administrator.",
    accountNotFound: "No account found for that username."
  },

  bulkCreate: {
    sharedTerms: "Shared terms",
    addLine: "Add line",
    addFiveLines: "Add 5 lines",
    removeLine: "Remove",
    lineNumber: "Line {n}",
    maxLinesReached: "You can add up to {max} lines.",
    emptyLines: "Add at least one complete line.",
    lineError: "Line {n}: {message}",
    addCount: "Add {count}",
    addingCount: "Adding {count}…"
  },

  validation: {
    invalidEmail: "Enter a valid email address.",
    npwpInvalid:
      "Company Tax ID (NPWP) must be 15 or 16 digits (formatting optional).",
    npwpOrNikInvalid:
      "Client NPWP Or NIK must be 15 or 16 digits (formatting optional).",
    npwpRequired: "NPWP is required.",
    npwpOrNikRequired: "NPWP or NIK is required.",
    fieldInvalid: "{field} is invalid."
  }
} as const;

export type EnMessages = typeof en;
