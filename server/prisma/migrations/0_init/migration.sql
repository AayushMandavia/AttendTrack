-- CreateTable
CREATE TABLE "students" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lectures" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "studentIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lectures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_records" (
    "id" TEXT NOT NULL,
    "lectureId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "submitted" BOOLEAN NOT NULL DEFAULT true,
    "submittedBy" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "correctedBy" TEXT,
    "correctedAt" TIMESTAMP(3),
    "correctionReference" TEXT,

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "storageProvider" TEXT NOT NULL DEFAULT 'local',
    "originalFilename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadTimestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "extractionStatus" TEXT NOT NULL DEFAULT 'pending',
    "rawExtractedJson" JSONB,
    "missingFields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "manualVerified" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_letters" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "rawStudentName" TEXT,
    "rawStudentId" TEXT,
    "date" TEXT NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "subject" TEXT,
    "reference" TEXT,
    "uploadId" TEXT,
    "documentName" TEXT,
    "matchedSubject" TEXT,
    "lectureId" TEXT,
    "validation" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "attendance_letters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "actor" TEXT NOT NULL DEFAULT 'System',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "attendance_records_lectureId_studentId_key" ON "attendance_records"("lectureId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "documents_storageKey_key" ON "documents"("storageKey");

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_lectureId_fkey" FOREIGN KEY ("lectureId") REFERENCES "lectures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_letters" ADD CONSTRAINT "attendance_letters_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_letters" ADD CONSTRAINT "attendance_letters_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
