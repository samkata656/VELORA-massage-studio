-- btree_gist lets us combine "=" and range overlap "&&" in one EXCLUDE constraint
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('CLIENT', 'ADMIN');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('BOOKED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "BookingSource" AS ENUM ('WEB', 'ADMIN', 'AI');

-- CreateEnum
CREATE TYPE "ShiftSource" AS ENUM ('AUTO', 'MANUAL', 'AI');

-- CreateEnum
CREATE TYPE "AbsenceType" AS ENUM ('SICK', 'PAID_LEAVE', 'UNPAID', 'OTHER');

-- CreateEnum
CREATE TYPE "ContentSource" AS ENUM ('SEED', 'ADMIN', 'N8N');

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "SchedulerRole" AS ENUM ('ADMIN', 'AI', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('NONE', 'PROPOSED', 'APPLIED', 'DISCARDED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "role" "Role" NOT NULL DEFAULT 'CLIENT',
    "locale" TEXT NOT NULL DEFAULT 'bg',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Therapist" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL DEFAULT 'Massage therapist',
    "titleBg" TEXT NOT NULL DEFAULT 'Масажист',
    "bioEn" TEXT NOT NULL DEFAULT '',
    "bioBg" TEXT NOT NULL DEFAULT '',
    "color" TEXT NOT NULL DEFAULT '#A67C46',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Therapist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Room" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Procedure" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameBg" TEXT NOT NULL,
    "summaryEn" TEXT NOT NULL DEFAULT '',
    "summaryBg" TEXT NOT NULL DEFAULT '',
    "therapistsRequired" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "sort" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Procedure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcedureVariant" (
    "id" TEXT NOT NULL,
    "procedureId" TEXT NOT NULL,
    "durationMin" INTEGER NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ProcedureVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TherapistSkill" (
    "therapistId" TEXT NOT NULL,
    "procedureId" TEXT NOT NULL,

    CONSTRAINT "TherapistSkill_pkey" PRIMARY KEY ("therapistId","procedureId")
);

-- CreateTable
CREATE TABLE "Shift" (
    "id" TEXT NOT NULL,
    "therapistId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "source" "ShiftSource" NOT NULL DEFAULT 'AUTO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Shift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Absence" (
    "id" TEXT NOT NULL,
    "therapistId" TEXT NOT NULL,
    "fromDate" DATE NOT NULL,
    "toDate" DATE NOT NULL,
    "type" "AbsenceType" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Absence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "userId" TEXT,
    "guestName" TEXT NOT NULL,
    "guestEmail" TEXT NOT NULL,
    "guestPhone" TEXT NOT NULL,
    "procedureId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "endsAt" TIMESTAMPTZ(3) NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'BOOKED',
    "source" "BookingSource" NOT NULL DEFAULT 'WEB',
    "therapistChosen" BOOLEAN NOT NULL DEFAULT false,
    "cancelTokenHash" TEXT,
    "notes" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'bg',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppointmentAllocation" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "therapistId" TEXT NOT NULL,
    "roomId" INTEGER NOT NULL,
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "blockedUntil" TIMESTAMPTZ(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "AppointmentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Article" (
    "id" TEXT NOT NULL,
    "procedureId" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "titleBg" TEXT NOT NULL,
    "bodyEn" TEXT NOT NULL,
    "bodyBg" TEXT NOT NULL,
    "source" "ContentSource" NOT NULL DEFAULT 'SEED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Article_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchedulerMessage" (
    "id" TEXT NOT NULL,
    "role" "SchedulerRole" NOT NULL,
    "content" TEXT NOT NULL,
    "changes" JSONB,
    "preview" JSONB,
    "status" "ProposalStatus" NOT NULL DEFAULT 'NONE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchedulerMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookOutbox" (
    "id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "WebhookOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Procedure_slug_key" ON "Procedure"("slug");

-- CreateIndex
CREATE INDEX "ProcedureVariant_procedureId_idx" ON "ProcedureVariant"("procedureId");

-- CreateIndex
CREATE INDEX "Shift_date_idx" ON "Shift"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Shift_therapistId_date_key" ON "Shift"("therapistId", "date");

-- CreateIndex
CREATE INDEX "Absence_therapistId_fromDate_idx" ON "Absence"("therapistId", "fromDate");

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_code_key" ON "Appointment"("code");

-- CreateIndex
CREATE INDEX "Appointment_startsAt_idx" ON "Appointment"("startsAt");

-- CreateIndex
CREATE INDEX "Appointment_guestEmail_idx" ON "Appointment"("guestEmail");

-- CreateIndex
CREATE INDEX "AppointmentAllocation_therapistId_startsAt_idx" ON "AppointmentAllocation"("therapistId", "startsAt");

-- CreateIndex
CREATE INDEX "AppointmentAllocation_roomId_startsAt_idx" ON "AppointmentAllocation"("roomId", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "Article_procedureId_key" ON "Article"("procedureId");

-- CreateIndex
CREATE INDEX "WebhookOutbox_status_createdAt_idx" ON "WebhookOutbox"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcedureVariant" ADD CONSTRAINT "ProcedureVariant_procedureId_fkey" FOREIGN KEY ("procedureId") REFERENCES "Procedure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TherapistSkill" ADD CONSTRAINT "TherapistSkill_therapistId_fkey" FOREIGN KEY ("therapistId") REFERENCES "Therapist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TherapistSkill" ADD CONSTRAINT "TherapistSkill_procedureId_fkey" FOREIGN KEY ("procedureId") REFERENCES "Procedure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_therapistId_fkey" FOREIGN KEY ("therapistId") REFERENCES "Therapist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Absence" ADD CONSTRAINT "Absence_therapistId_fkey" FOREIGN KEY ("therapistId") REFERENCES "Therapist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_procedureId_fkey" FOREIGN KEY ("procedureId") REFERENCES "Procedure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProcedureVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentAllocation" ADD CONSTRAINT "AppointmentAllocation_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentAllocation" ADD CONSTRAINT "AppointmentAllocation_therapistId_fkey" FOREIGN KEY ("therapistId") REFERENCES "Therapist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentAllocation" ADD CONSTRAINT "AppointmentAllocation_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_procedureId_fkey" FOREIGN KEY ("procedureId") REFERENCES "Procedure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- No therapist and no room can be double-booked (periods include the 20-min buffer)
ALTER TABLE "AppointmentAllocation"
  ADD CONSTRAINT "allocation_therapist_no_overlap"
  EXCLUDE USING gist ("therapistId" WITH =, tstzrange("startsAt", "blockedUntil", '[)') WITH &&)
  WHERE ("active");

ALTER TABLE "AppointmentAllocation"
  ADD CONSTRAINT "allocation_room_no_overlap"
  EXCLUDE USING gist ("roomId" WITH =, tstzrange("startsAt", "blockedUntil", '[)') WITH &&)
  WHERE ("active");
