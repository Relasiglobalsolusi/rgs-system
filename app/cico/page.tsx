import { prisma } from "@/lib/prisma";

import { requireModule, getEmployeeForUser } from "@/lib/session";

import { formatDisplayTime } from "@/lib/format-date";

import { formatTimeRange } from "@/lib/operating-hours";

import { getServerLocale } from "@/lib/i18n/locale";

import { createTranslator } from "@/lib/i18n/translate";



import AppShell from "@/components/layout/AppShell";

import SectionCard from "@/components/ui/SectionCard";

import CicoActions from "@/components/cico/CicoActions";

import CicoHistoryTable from "@/components/cico/CicoHistoryTable";



export default async function CicoPage() {

  const session = await requireModule("cico");

  const locale = await getServerLocale();

  const t = createTranslator(locale);



  // Client portal accounts never use CICO (employees only), even if overridden on.

  if (session.user.clientId) {

    return (

      <AppShell

        titleKey="pages.cico.title"

        descriptionKey="pages.cico.description"

      >

        <SectionCard>

          <p className="text-subtle">

            CICO is only available for employee accounts.

          </p>

        </SectionCard>

      </AppShell>

    );

  }



  const employee = await getEmployeeForUser(session.user.id);



  if (!employee) {

    return (

      <AppShell

        titleKey="pages.cico.title"

        descriptionKey="pages.cico.description"

      >

        <SectionCard>

          <p className="text-subtle">

            CICO requires a linked employee profile. Ask an administrator to

            link your login to an employee record.

          </p>

        </SectionCard>

      </AppShell>

    );

  }



  const today = new Date();

  today.setHours(0, 0, 0, 0);



  const [todayRecord, assignments, history] = await Promise.all([

    prisma.attendance.findUnique({

      where: {

        employeeId_date: {

          employeeId: employee.id,

          date: today,

        },

      },

      include: { project: true },

    }),

    prisma.projectAssignment.findMany({

      where: {

        employeeId: employee.id,

        project: {

          status: "IN_PROGRESS",

          latitude: { not: null },

          longitude: { not: null },

        },

      },

      include: {

        project: {

          select: {

            id: true,

            name: true,

            location: true,

            locationRadiusMeters: true,

          },

        },

      },

      orderBy: { project: { name: "asc" } },

    }),

    prisma.attendance.findMany({

      where: { employeeId: employee.id },

      include: {

        project: {

          select: {

            name: true,

          },

        },

      },

      orderBy: { date: "desc" },

      take: 30,

    }),

  ]);



  const assignedProjects = assignments.map((assignment) => ({

    id: assignment.project.id,

    name: assignment.project.name,

    location: assignment.project.location,

    locationRadiusMeters: assignment.project.locationRadiusMeters,

    shiftStart: assignment.shiftStart,

    shiftEnd: assignment.shiftEnd,

  }));



  return (

    <AppShell

      titleKey="pages.cico.title"

      descriptionKey="pages.cico.descriptionDetail"

    >

      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 pb-8">

        <SectionCard className="px-6 py-7 sm:px-8 sm:py-8">

          <h3 className="mb-6 text-lg font-semibold tracking-tight text-text">

            {t("pages.cico.todaysCico")}

          </h3>

          <CicoActions

            todayRecord={todayRecord}

            assignedProjects={assignedProjects}

          />

          {todayRecord && (

            <div className="mt-6 flex flex-wrap gap-x-8 gap-y-3 border-t border-border pt-5 text-sm text-subtle">

              <span>

                {t("pages.cico.columns.checkIn")}:{" "}

                <span className="font-medium text-text">

                  {todayRecord.checkIn

                    ? formatDisplayTime(todayRecord.checkIn)

                    : "-"}

                </span>

              </span>

              <span>

                {t("pages.cico.columns.checkOut")}:{" "}

                <span className="font-medium text-text">

                  {todayRecord.checkOut

                    ? formatDisplayTime(todayRecord.checkOut)

                    : "-"}

                </span>

              </span>

              {assignedProjects[0] && (

                <span>

                  {t("pages.cico.shiftLabel")}:{" "}

                  <span className="font-medium text-text">

                    {formatTimeRange(

                      assignedProjects.find(

                        (p) => p.id === todayRecord.projectId

                      )?.shiftStart,

                      assignedProjects.find(

                        (p) => p.id === todayRecord.projectId

                      )?.shiftEnd

                    )}

                  </span>

                </span>

              )}

            </div>

          )}

        </SectionCard>



        <SectionCard className="px-6 py-7 sm:px-8 sm:py-8">

          <h3 className="mb-5 text-lg font-semibold tracking-tight text-text">

            {t("pages.cico.recentHistory")}

          </h3>

          <CicoHistoryTable data={history} />

        </SectionCard>

      </div>

    </AppShell>

  );

}

