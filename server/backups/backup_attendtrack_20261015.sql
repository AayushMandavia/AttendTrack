--
-- PostgreSQL database dump
--

\restrict vC6FpUgkCYcyJmpXJDbY9yPjNfumJwwXV7QhBU8iW7L4buWT8WeDikc871OjdO3

-- Dumped from database version 16.14
-- Dumped by pg_dump version 16.14

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public._prisma_migrations OWNER TO postgres;

--
-- Name: attendance_letters; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.attendance_letters (
    id text NOT NULL,
    "studentId" text NOT NULL,
    "studentName" text NOT NULL,
    "rawStudentName" text,
    "rawStudentId" text,
    date text NOT NULL,
    "startTime" text,
    "endTime" text,
    subject text,
    reference text,
    "uploadId" text,
    "documentName" text,
    "matchedSubject" text,
    "lectureId" text,
    validation text NOT NULL,
    status text DEFAULT 'Pending'::text NOT NULL,
    "createdBy" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "reviewedBy" text,
    "reviewedAt" timestamp(3) without time zone
);


ALTER TABLE public.attendance_letters OWNER TO postgres;

--
-- Name: attendance_records; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.attendance_records (
    id text NOT NULL,
    "lectureId" text NOT NULL,
    "studentId" text NOT NULL,
    status text NOT NULL,
    submitted boolean DEFAULT true NOT NULL,
    "submittedBy" text NOT NULL,
    "submittedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "correctedBy" text,
    "correctedAt" timestamp(3) without time zone,
    "correctionReference" text
);


ALTER TABLE public.attendance_records OWNER TO postgres;

--
-- Name: audit_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_events (
    id text NOT NULL,
    action text NOT NULL,
    details text NOT NULL,
    actor text DEFAULT 'System'::text NOT NULL,
    "timestamp" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.audit_events OWNER TO postgres;

--
-- Name: documents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.documents (
    id text NOT NULL,
    "storageKey" text NOT NULL,
    "storageProvider" text DEFAULT 'local'::text NOT NULL,
    "originalFilename" text NOT NULL,
    "mimeType" text NOT NULL,
    "sizeBytes" integer NOT NULL,
    "uploadTimestamp" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "extractionStatus" text DEFAULT 'pending'::text NOT NULL,
    "rawExtractedJson" jsonb,
    "missingFields" text[] DEFAULT ARRAY[]::text[],
    notes text[] DEFAULT ARRAY[]::text[],
    "manualVerified" boolean DEFAULT false NOT NULL
);


ALTER TABLE public.documents OWNER TO postgres;

--
-- Name: lectures; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lectures (
    id text NOT NULL,
    subject text NOT NULL,
    "className" text NOT NULL,
    date text NOT NULL,
    "startTime" text NOT NULL,
    "endTime" text NOT NULL,
    "studentIds" text[],
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.lectures OWNER TO postgres;

--
-- Name: students; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.students (
    id text NOT NULL,
    name text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.students OWNER TO postgres;

--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
7eb02b63-f565-4dd2-834f-cffa0430b408	3f36ab917f3af229b3a672d61f822d2d1526f12e7d96a5dfce8067d5a652da80	2026-10-15 09:02:53.195091+00	0_init	\N	\N	2026-10-15 09:02:53.142522+00	1
\.


--
-- Data for Name: attendance_letters; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.attendance_letters (id, "studentId", "studentName", "rawStudentName", "rawStudentId", date, "startTime", "endTime", subject, reference, "uploadId", "documentName", "matchedSubject", "lectureId", validation, status, "createdBy", "createdAt", "reviewedBy", "reviewedAt") FROM stdin;
LTR-1792055156106	STU-002	Arjun Mehta	\N	\N	2026-10-14	10:30	11:30	Database Systems	\N	\N	\N	\N	\N	Needs clarification: partial time overlap	Pending	Attendance Coordinator	2026-10-15 09:05:56.108	\N	\N
LTR-1792055156130	STU-002	Arjun Mehta	\N	\N	2026-10-14	10:00	11:00	Database Systems	MED-EXCUSE-999	\N	\N	Database Systems	LEC-101	Exact lecture/time candidate	Pending	Attendance Coordinator	2026-10-15 09:05:56.133	\N	\N
LTR-1792055195212	STU-002	Arjun Mehta	\N	\N	2026-10-14	11:30	12:30	Computer Networks	\N	\N	\N	\N	\N	Needs clarification: partial time overlap	Pending	Attendance Coordinator	2026-10-15 09:06:35.216	\N	\N
LTR-1792055195240	STU-002	Arjun Mehta	\N	\N	2026-10-14	11:00	12:00	Computer Networks	MED-EXCUSE-NETWORKS	\N	\N	Computer Networks	LEC-102	Exact lecture/time candidate	Approved	Attendance Coordinator	2026-10-15 09:06:35.243	Coordinator Verma	2026-10-15 09:06:35.252
LTR-1792055232557	STU-002	Arjun Mehta	Arjun Mehta	STU-002	2026-10-14	10:30	11:30	Database Systems	\N	\N	\N	\N	LEC-101	Needs clarification: partial time overlap	Pending	Attendance Coordinator	2026-10-15 09:07:12.56	\N	\N
LTR-1792055232570	STU-002	Arjun Mehta	Arjun Mehta	STU-002	2026-10-14	10:00	11:00	Database Systems	CERT-2026-APPROVED	\N	\N	Database Systems	LEC-101	Exact lecture/time candidate	Approved	Attendance Coordinator	2026-10-15 09:07:12.573	Coordinator Verma	2026-10-15 09:07:12.577
LTR-1792055232619	STU-004	Dev Patel	\N	\N	2026-10-14	\N	\N	\N	\N	\N	\N	\N	\N	Needs clarification: no exact match	Rejected	Attendance Coordinator	2026-10-15 09:07:12.622	Coordinator Verma	2026-10-15 09:07:12.626
LTR-1792055270796	STU-001	Riya Shah	Riya S. Shah	STU-001	2026-10-14	10:00	11:00	Database Systems	EVT-2026-PERSIST-1	\N	excuse_letter.pdf	Database Systems	LEC-101	Exact lecture/time candidate	Pending	Attendance Coordinator	2026-10-15 09:07:50.799	\N	\N
LTR-1792055270814	STU-002	Arjun Mehta	Arjun Mehta	STU-002	2026-10-14	10:30	11:30	Database Systems	\N	\N	\N	\N	LEC-101	Needs clarification: partial time overlap	Pending	Attendance Coordinator	2026-10-15 09:07:50.816	\N	\N
LTR-1792055270825	STU-002	Arjun Mehta	Arjun Mehta	STU-002	2026-10-14	10:00	11:00	Database Systems	CERT-2026-APPROVED	\N	\N	Database Systems	LEC-101	Exact lecture/time candidate	Approved	Attendance Coordinator	2026-10-15 09:07:50.827	Coordinator Verma	2026-10-15 09:07:50.83
LTR-1792055270872	STU-004	Dev Patel	\N	\N	2026-10-14	\N	\N	\N	\N	\N	\N	\N	\N	Needs clarification: no exact match	Rejected	Attendance Coordinator	2026-10-15 09:07:50.875	Coordinator Verma	2026-10-15 09:07:50.885
LTR-1792055631588	STU-001	Riya Shah	Riya Shah (Extracted)	STU-001	2026-10-14	10:00	11:00	Database Systems	TEST-REF-EXACT-001	DOC-1792055631234-9f482d	sample_attendance_letter.pdf	Database Systems	LEC-101	Exact lecture/time candidate	Approved	Audit Verifier	2026-10-15 09:13:51.608	Audit Verifier	2026-10-15 09:13:51.709
LTR-1792055631652	STU-001	Riya Shah	Riya Shah (Ambiguous)	STU-001	2026-10-14	10:30	11:30	Database Systems	TEST-REF-AMBIGUOUS-001	DOC-1792055631234-9f482d	sample_attendance_letter.pdf	\N	\N	Needs clarification: partial time overlap	Rejected	Audit Verifier	2026-10-15 09:13:51.666	Audit Verifier	2026-10-15 09:13:51.765
LTR-1792055674764	STU-002	Arjun Mehta	Arjun Mehta	STU-002	2026-10-14	10:30	11:30	Database Systems	\N	\N	\N	\N	LEC-101	Needs clarification: partial time overlap	Pending	Attendance Coordinator	2026-10-15 09:14:34.767	\N	\N
LTR-1792055674778	STU-002	Arjun Mehta	Arjun Mehta	STU-002	2026-10-14	10:00	11:00	Database Systems	CERT-2026-APPROVED	\N	\N	Database Systems	LEC-101	Exact lecture/time candidate	Approved	Attendance Coordinator	2026-10-15 09:14:34.78	Coordinator Verma	2026-10-15 09:14:34.783
LTR-1792055674819	STU-004	Dev Patel	\N	\N	2026-10-14	\N	\N	\N	\N	\N	\N	\N	\N	Needs clarification: no exact match	Rejected	Attendance Coordinator	2026-10-15 09:14:34.821	Coordinator Verma	2026-10-15 09:14:34.828
LTR-1792055986470	STU-002	Arjun Mehta	Arjun Mehta	STU-002	2026-10-14	10:30	11:30	Database Systems	\N	\N	\N	\N	LEC-101	Needs clarification: partial time overlap	Pending	Attendance Coordinator	2026-10-15 09:19:46.473	\N	\N
LTR-1792055986485	STU-002	Arjun Mehta	Arjun Mehta	STU-002	2026-10-14	10:00	11:00	Database Systems	CERT-2026-APPROVED	\N	\N	Database Systems	LEC-101	Exact lecture/time candidate	Approved	Attendance Coordinator	2026-10-15 09:19:46.488	Coordinator Verma	2026-10-15 09:19:46.49
LTR-1792055986537	STU-004	Dev Patel	\N	\N	2026-10-14	\N	\N	\N	\N	\N	\N	\N	\N	Needs clarification: no exact match	Rejected	Attendance Coordinator	2026-10-15 09:19:46.54	Coordinator Verma	2026-10-15 09:19:46.545
LTR-1792056027119	STU-001	Riya Shah	Riya Shah (Partial Timing)	STU-001	2026-10-15	09:30	10:30	Signals & Systems	CERT-SIG-AMB-01	DOC-1792056027031-7be465	sample_attendance_letter.pdf	\N	\N	Needs clarification: partial time overlap	Rejected	Attendance Coordinator	2026-10-15 09:20:27.121	Attendance Coordinator	2026-10-15 09:20:27.132
LTR-1792056027107	STU-001	Riya Shah	Riya Shah (Extracted from Document)	STU-001	2026-10-15	09:00	10:00	Signals & Systems	CERT-SIG-2026-01	DOC-1792056027031-7be465	sample_attendance_letter.pdf	Signals & Systems	LEC-103	Exact lecture/time candidate	Approved	Attendance Coordinator	2026-10-15 09:20:27.11	Coordinator Verma	2026-10-15 09:20:27.141
LTR-1792055674748	STU-001	Riya Shah	Riya S. Shah	STU-001	2026-10-14	10:00	11:00	Database Systems	EVT-2026-PERSIST-1	\N	excuse_letter.pdf	Database Systems	LEC-101	Exact lecture/time candidate	Approved	Attendance Coordinator	2026-10-15 09:14:34.753	Teacher	2026-10-15 09:21:28.367
LTR-1792055986454	STU-001	Riya Shah	Riya S. Shah	STU-001	2026-10-14	10:00	11:00	Database Systems	EVT-2026-PERSIST-1	\N	excuse_letter.pdf	Database Systems	LEC-101	Exact lecture/time candidate	Approved	Attendance Coordinator	2026-10-15 09:19:46.459	Teacher	2026-10-15 09:21:30.338
LTR-1792056565915	STU-001	Riya Shah	Riya S. Shah	STU-001	2026-10-14	10:00	11:00	Database Systems	EVT-2026-PERSIST-1	\N	excuse_letter.pdf	Database Systems	LEC-101	Exact lecture/time candidate	Pending	Attendance Coordinator	2026-10-15 09:29:25.921	\N	\N
LTR-1792056565950	STU-002	Arjun Mehta	Arjun Mehta	STU-002	2026-10-14	10:30	11:30	Database Systems	\N	\N	\N	\N	LEC-101	Needs clarification: partial time overlap	Pending	Attendance Coordinator	2026-10-15 09:29:25.953	\N	\N
LTR-1792056565974	STU-002	Arjun Mehta	Arjun Mehta	STU-002	2026-10-14	10:00	11:00	Database Systems	CERT-2026-APPROVED	\N	\N	Database Systems	LEC-101	Exact lecture/time candidate	Approved	Attendance Coordinator	2026-10-15 09:29:25.976	Coordinator Verma	2026-10-15 09:29:25.983
LTR-1792056566043	STU-004	Dev Patel	\N	\N	2026-10-14	\N	\N	\N	\N	\N	\N	\N	\N	Needs clarification: no exact match	Rejected	Attendance Coordinator	2026-10-15 09:29:26.046	Coordinator Verma	2026-10-15 09:29:26.058
LTR-1792056622258	STU-001	Riya Shah	\N	\N	2026-10-15	\N	\N	Database Systems	\N	\N	\N	\N	\N	Needs clarification: no exact match	Pending	Test Actor	2026-10-15 09:30:22.264	\N	\N
LTR-1792056745939	STU-001	Riya Shah	Riya S. Shah	STU-001	2026-10-14	10:00	11:00	Database Systems	EVT-2026-PERSIST-1	\N	excuse_letter.pdf	Database Systems	LEC-101	Exact lecture/time candidate	Pending	Attendance Coordinator	2026-10-15 09:32:25.943	\N	\N
LTR-1792056745957	STU-002	Arjun Mehta	Arjun Mehta	STU-002	2026-10-14	10:30	11:30	Database Systems	\N	\N	\N	\N	LEC-101	Needs clarification: partial time overlap	Pending	Attendance Coordinator	2026-10-15 09:32:25.959	\N	\N
LTR-1792056745971	STU-002	Arjun Mehta	Arjun Mehta	STU-002	2026-10-14	10:00	11:00	Database Systems	CERT-2026-APPROVED	\N	\N	Database Systems	LEC-101	Exact lecture/time candidate	Approved	Attendance Coordinator	2026-10-15 09:32:25.974	Coordinator Verma	2026-10-15 09:32:25.98
LTR-1792056746036	STU-004	Dev Patel	\N	\N	2026-10-14	\N	\N	\N	\N	\N	\N	\N	\N	Needs clarification: no exact match	Rejected	Attendance Coordinator	2026-10-15 09:32:26.038	Coordinator Verma	2026-10-15 09:32:26.043
\.


--
-- Data for Name: attendance_records; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.attendance_records (id, "lectureId", "studentId", status, submitted, "submittedBy", "submittedAt", "correctedBy", "correctedAt", "correctionReference") FROM stdin;
ATT-LEC-102-STU-001	LEC-102	STU-001	Present	t	Prof. Sharma	2026-10-15 09:06:35.158	\N	\N	\N
ATT-LEC-102-STU-003	LEC-102	STU-003	Present	t	Prof. Sharma	2026-10-15 09:06:35.158	\N	\N	\N
ATT-LEC-102-STU-004	LEC-102	STU-004	Present	t	Prof. Sharma	2026-10-15 09:06:35.158	\N	\N	\N
ATT-LEC-102-STU-002	LEC-102	STU-002	Present	t	Prof. Sharma	2026-10-15 09:06:35.158	Coordinator Verma	2026-10-15 09:06:35.252	MED-EXCUSE-NETWORKS
ATT-LEC-103-STU-002	LEC-103	STU-002	Present	t	Prof. Kulkarni	2026-10-15 09:20:27.01	\N	\N	\N
ATT-LEC-103-STU-003	LEC-103	STU-003	Present	t	Prof. Kulkarni	2026-10-15 09:20:27.01	\N	\N	\N
ATT-LEC-103-STU-004	LEC-103	STU-004	Present	t	Prof. Kulkarni	2026-10-15 09:20:27.01	\N	\N	\N
ATT-LEC-103-STU-001	LEC-103	STU-001	Present	t	Prof. Kulkarni	2026-10-15 09:20:27.01	Coordinator Verma	2026-10-15 09:20:27.141	CERT-SIG-2026-01
ATT-LEC-101-STU-001	LEC-101	STU-001	Present	t	Prof. Sharma	2026-10-15 09:32:25.902	Teacher	2026-10-15 09:21:30.338	EVT-2026-PERSIST-1
ATT-LEC-101-STU-003	LEC-101	STU-003	Present	t	Prof. Sharma	2026-10-15 09:32:25.902	\N	\N	\N
ATT-LEC-101-STU-004	LEC-101	STU-004	Absent	t	Prof. Sharma	2026-10-15 09:32:25.902	\N	\N	\N
ATT-LEC-101-STU-002	LEC-101	STU-002	Present	t	Prof. Sharma	2026-10-15 09:32:25.902	Coordinator Verma	2026-10-15 09:32:25.98	CERT-2026-APPROVED
\.


--
-- Data for Name: audit_events; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.audit_events (id, action, details, actor, "timestamp") FROM stdin;
LOG-SEED-1792055017243	Database seeded	System initialized demo students and scheduled lectures.	System	2026-10-15 09:03:37.244
LOG-1792055156082-f573	Attendance submitted	Database Systems (2026-10-14 10:00-11:00); 4 student records.	Prof. Sharma	2026-10-15 09:05:56.084
LOG-1792055156110-cbba	Attendance letter queued	Arjun Mehta (STU-002), 2026-10-14, Needs clarification: partial time overlap.	Attendance Coordinator	2026-10-15 09:05:56.112
LOG-1792055156135-cb1a	Attendance letter queued	Arjun Mehta (STU-002), 2026-10-14, Exact lecture/time candidate.	Attendance Coordinator	2026-10-15 09:05:56.136
LOG-1792055195184-abb5	Attendance submitted	Computer Networks (2026-10-14 11:00-12:00); 4 student records.	Prof. Sharma	2026-10-15 09:06:35.187
LOG-1792055195218-f0c5	Attendance letter queued	Arjun Mehta (STU-002), 2026-10-14, Needs clarification: partial time overlap.	Attendance Coordinator	2026-10-15 09:06:35.22
LOG-1792055195243-d442	Attendance letter queued	Arjun Mehta (STU-002), 2026-10-14, Exact lecture/time candidate.	Attendance Coordinator	2026-10-15 09:06:35.246
LOG-1792055195264-9362	Attendance corrected	Arjun Mehta, Computer Networks: Absent ΓåÆ Present. Source MED-EXCUSE-NETWORKS.	Coordinator Verma	2026-10-15 09:06:35.266
LOG-1792055232531-0166	Attendance submitted	Database Systems (2026-10-14 10:00-11:00); 4 student records.	Prof. Sharma	2026-10-15 09:07:12.533
LOG-1792055232561-4bd0	Attendance letter queued	Arjun Mehta (STU-002), 2026-10-14, Needs clarification: partial time overlap.	Attendance Coordinator	2026-10-15 09:07:12.563
LOG-1792055232573-7338	Attendance letter queued	Arjun Mehta (STU-002), 2026-10-14, Exact lecture/time candidate.	Attendance Coordinator	2026-10-15 09:07:12.575
LOG-1792055232585-2dfe	Attendance corrected	Arjun Mehta, Database Systems: Absent ΓåÆ Present. Source CERT-2026-APPROVED.	Coordinator Verma	2026-10-15 09:07:12.588
LOG-1792055232624-f14c	Attendance letter queued	Dev Patel (STU-004), 2026-10-14, Needs clarification: no exact match.	Attendance Coordinator	2026-10-15 09:07:12.625
LOG-1792055232630-b48d	Attendance letter rejected	LTR-1792055232619; attendance unchanged.	Coordinator Verma	2026-10-15 09:07:12.632
LOG-1792055270784-99ef	Attendance submitted	Database Systems (2026-10-14 10:00-11:00); 4 student records.	Prof. Sharma	2026-10-15 09:07:50.785
LOG-1792055270802-752a	Attendance letter queued	Riya Shah (STU-001), 2026-10-14, Exact lecture/time candidate. (Attached: excuse_letter.pdf)	Attendance Coordinator	2026-10-15 09:07:50.803
LOG-1792055270816-d312	Attendance letter queued	Arjun Mehta (STU-002), 2026-10-14, Needs clarification: partial time overlap.	Attendance Coordinator	2026-10-15 09:07:50.817
LOG-1792055270827-9592	Attendance letter queued	Arjun Mehta (STU-002), 2026-10-14, Exact lecture/time candidate.	Attendance Coordinator	2026-10-15 09:07:50.828
LOG-1792055270836-b346	Attendance corrected	Arjun Mehta, Database Systems: Absent ΓåÆ Present. Source CERT-2026-APPROVED.	Coordinator Verma	2026-10-15 09:07:50.837
LOG-1792055270878-a863	Attendance letter queued	Dev Patel (STU-004), 2026-10-14, Needs clarification: no exact match.	Attendance Coordinator	2026-10-15 09:07:50.879
LOG-1792055270891-c6dd	Attendance letter rejected	LTR-1792055270872; attendance unchanged.	Coordinator Verma	2026-10-15 09:07:50.892
LOG-1792055631620-9bde	Attendance letter queued	Riya Shah (STU-001), 2026-10-14, Exact lecture/time candidate. (Attached: sample_attendance_letter.pdf)	Audit Verifier	2026-10-15 09:13:51.622
LOG-1792055631672-db18	Attendance letter queued	Riya Shah (STU-001), 2026-10-14, Needs clarification: partial time overlap. (Attached: sample_attendance_letter.pdf)	Audit Verifier	2026-10-15 09:13:51.675
LOG-1792055631734-f017	Attendance corrected	Riya Shah, Database Systems: Present ΓåÆ Present. Source TEST-REF-EXACT-001.	Audit Verifier	2026-10-15 09:13:51.737
LOG-1792055631780-adb6	Attendance letter rejected	LTR-1792055631652; attendance unchanged.	Audit Verifier	2026-10-15 09:13:51.782
LOG-1792055674740-0575	Attendance submitted	Database Systems (2026-10-14 10:00-11:00); 4 student records.	Prof. Sharma	2026-10-15 09:14:34.742
LOG-1792055674756-d4ce	Attendance letter queued	Riya Shah (STU-001), 2026-10-14, Exact lecture/time candidate. (Attached: excuse_letter.pdf)	Attendance Coordinator	2026-10-15 09:14:34.757
LOG-1792055674769-2b5d	Attendance letter queued	Arjun Mehta (STU-002), 2026-10-14, Needs clarification: partial time overlap.	Attendance Coordinator	2026-10-15 09:14:34.77
LOG-1792055674781-0318	Attendance letter queued	Arjun Mehta (STU-002), 2026-10-14, Exact lecture/time candidate.	Attendance Coordinator	2026-10-15 09:14:34.782
LOG-1792055674788-64e1	Attendance corrected	Arjun Mehta, Database Systems: Absent ΓåÆ Present. Source CERT-2026-APPROVED.	Coordinator Verma	2026-10-15 09:14:34.789
LOG-1792055674824-1a32	Attendance letter queued	Dev Patel (STU-004), 2026-10-14, Needs clarification: no exact match.	Attendance Coordinator	2026-10-15 09:14:34.825
LOG-1792055674833-0b7c	Attendance letter rejected	LTR-1792055674819; attendance unchanged.	Coordinator Verma	2026-10-15 09:14:34.834
LOG-1792055986446-ebda	Attendance submitted	Database Systems (2026-10-14 10:00-11:00); 4 student records.	Prof. Sharma	2026-10-15 09:19:46.447
LOG-1792055986462-da84	Attendance letter queued	Riya Shah (STU-001), 2026-10-14, Exact lecture/time candidate. (Attached: excuse_letter.pdf)	Attendance Coordinator	2026-10-15 09:19:46.464
LOG-1792055986474-1d7a	Attendance letter queued	Arjun Mehta (STU-002), 2026-10-14, Needs clarification: partial time overlap.	Attendance Coordinator	2026-10-15 09:19:46.476
LOG-1792055986488-e61c	Attendance letter queued	Arjun Mehta (STU-002), 2026-10-14, Exact lecture/time candidate.	Attendance Coordinator	2026-10-15 09:19:46.49
LOG-1792055986500-59ad	Attendance corrected	Arjun Mehta, Database Systems: Absent ΓåÆ Present. Source CERT-2026-APPROVED.	Coordinator Verma	2026-10-15 09:19:46.502
LOG-1792055986541-84fd	Attendance letter queued	Dev Patel (STU-004), 2026-10-14, Needs clarification: no exact match.	Attendance Coordinator	2026-10-15 09:19:46.543
LOG-1792055986550-5b94	Attendance letter rejected	LTR-1792055986537; attendance unchanged.	Coordinator Verma	2026-10-15 09:19:46.552
LOG-1792056027019-2c7a	Attendance submitted	Signals & Systems (2026-10-15 09:00-10:00); 4 student records.	Prof. Kulkarni	2026-10-15 09:20:27.019
LOG-1792056027112-547f	Attendance letter queued	Riya Shah (STU-001), 2026-10-15, Exact lecture/time candidate. (Attached: sample_attendance_letter.pdf)	Attendance Coordinator	2026-10-15 09:20:27.113
LOG-1792056027122-fa07	Attendance letter queued	Riya Shah (STU-001), 2026-10-15, Needs clarification: partial time overlap. (Attached: sample_attendance_letter.pdf)	Attendance Coordinator	2026-10-15 09:20:27.122
LOG-1792056027136-f87f	Attendance letter rejected	LTR-1792056027119; attendance unchanged.	Attendance Coordinator	2026-10-15 09:20:27.137
LOG-1792056027147-dc37	Attendance corrected	Riya Shah, Signals & Systems: Absent ΓåÆ Present. Source CERT-SIG-2026-01.	Coordinator Verma	2026-10-15 09:20:27.148
LOG-1792056088393-1148	Attendance corrected	Riya Shah, Database Systems: Present ΓåÆ Present. Source EVT-2026-PERSIST-1.	Teacher	2026-10-15 09:21:28.396
LOG-1792056090353-d4ce	Attendance corrected	Riya Shah, Database Systems: Present ΓåÆ Present. Source EVT-2026-PERSIST-1.	Teacher	2026-10-15 09:21:30.355
LOG-1792056565902-56f5	Attendance submitted	Database Systems (2026-10-14 10:00-11:00); 4 student records.	Prof. Sharma	2026-10-15 09:29:25.903
LOG-1792056565929-1164	Attendance letter queued	Riya Shah (STU-001), 2026-10-14, Exact lecture/time candidate. (Attached: excuse_letter.pdf)	Attendance Coordinator	2026-10-15 09:29:25.93
LOG-1792056565955-b01b	Attendance letter queued	Arjun Mehta (STU-002), 2026-10-14, Needs clarification: partial time overlap.	Attendance Coordinator	2026-10-15 09:29:25.956
LOG-1792056565979-1345	Attendance letter queued	Arjun Mehta (STU-002), 2026-10-14, Exact lecture/time candidate.	Attendance Coordinator	2026-10-15 09:29:25.98
LOG-1792056565996-f339	Attendance corrected	Arjun Mehta, Database Systems: Absent ΓåÆ Present. Source CERT-2026-APPROVED.	Coordinator Verma	2026-10-15 09:29:25.997
LOG-1792056566051-0dcc	Attendance letter queued	Dev Patel (STU-004), 2026-10-14, Needs clarification: no exact match.	Attendance Coordinator	2026-10-15 09:29:26.052
LOG-1792056566068-eb45	Attendance letter rejected	LTR-1792056566043; attendance unchanged.	Coordinator Verma	2026-10-15 09:29:26.069
LOG-1792056622270-2b77	Attendance letter queued	Riya Shah (STU-001), 2026-10-15, Needs clarification: no exact match.	Test Actor	2026-10-15 09:30:22.272
LOG-1792056745927-a773	Attendance submitted	Database Systems (2026-10-14 10:00-11:00); 4 student records.	Prof. Sharma	2026-10-15 09:32:25.929
LOG-1792056745947-ee07	Attendance letter queued	Riya Shah (STU-001), 2026-10-14, Exact lecture/time candidate. (Attached: excuse_letter.pdf)	Attendance Coordinator	2026-10-15 09:32:25.948
LOG-1792056745960-e650	Attendance letter queued	Arjun Mehta (STU-002), 2026-10-14, Needs clarification: partial time overlap.	Attendance Coordinator	2026-10-15 09:32:25.961
LOG-1792056745975-6162	Attendance letter queued	Arjun Mehta (STU-002), 2026-10-14, Exact lecture/time candidate.	Attendance Coordinator	2026-10-15 09:32:25.976
LOG-1792056745992-4441	Attendance corrected	Arjun Mehta, Database Systems: Absent ΓåÆ Present. Source CERT-2026-APPROVED.	Coordinator Verma	2026-10-15 09:32:25.994
LOG-1792056746040-e0c3	Attendance letter queued	Dev Patel (STU-004), 2026-10-14, Needs clarification: no exact match.	Attendance Coordinator	2026-10-15 09:32:26.041
LOG-1792056746049-a639	Attendance letter rejected	LTR-1792056746036; attendance unchanged.	Coordinator Verma	2026-10-15 09:32:26.05
\.


--
-- Data for Name: documents; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.documents (id, "storageKey", "storageProvider", "originalFilename", "mimeType", "sizeBytes", "uploadTimestamp", "extractionStatus", "rawExtractedJson", "missingFields", notes, "manualVerified") FROM stdin;
DOC-TEST-1792055232408	documents/2026/DOC-TEST-1792055232408_sample.pdf	local	sample.pdf	application/pdf	56	2026-10-15 09:07:12.43	success	{"studentId": "STU-001", "studentName": "Riya Shah"}	{}	{"All fields extracted"}	f
DOC-1792055232914-d889f0	documents/2026/DOC-1792055232914-d889f0_sample_maya_verma.jpg	local	sample_maya_verma.jpg	image/jpeg	25972	2026-10-15 09:07:13.071	partial	{"date": "2026-10-14", "endTime": "11:00", "subject": "Database Systems", "startTime": "10:00", "studentId": "", "studentName": "Maya Verma", "rawStudentId": "EXT-555", "rosterMatched": false, "rawStudentName": "Maya Verma"}	{studentId,reference}	{"OCR recognized text successfully (95% confidence).","Detected name \\"Maya Verma\\" does not match an enrolled student in the current roster. Please confirm the student manually.","Missing or uncertain fields: studentId, reference. Please verify manually."}	f
DOC-TEST-1792055270683	documents/2026/DOC-TEST-1792055270683_sample.pdf	local	sample.pdf	application/pdf	56	2026-10-15 09:07:50.704	success	{"studentId": "STU-001", "studentName": "Riya Shah"}	{}	{"All fields extracted"}	f
DOC-1792055271182-8e0eaf	documents/2026/DOC-1792055271182-8e0eaf_sample_maya_verma.jpg	local	sample_maya_verma.jpg	image/jpeg	25972	2026-10-15 09:07:51.358	partial	{"date": "2026-10-14", "endTime": "11:00", "subject": "Database Systems", "startTime": "10:00", "studentId": "", "studentName": "Maya Verma", "rawStudentId": "EXT-555", "rosterMatched": false, "rawStudentName": "Maya Verma"}	{studentId,reference}	{"OCR recognized text successfully (95% confidence).","Detected name \\"Maya Verma\\" does not match an enrolled student in the current roster. Please confirm the student manually.","Missing or uncertain fields: studentId, reference. Please verify manually."}	f
DOC-1792055631234-9f482d	documents/2026/DOC-1792055631234-9f482d_sample_attendance_letter.pdf	local	sample_attendance_letter.pdf	application/pdf	791	2026-10-15 09:13:51.486	success	{"date": "2026-10-14", "endTime": "11:00", "subject": "Database Systems", "reference": "EVT-2026-88", "startTime": "10:00", "studentId": "STU-002", "studentName": "Arjun Mehta", "rawStudentId": "STU-002", "rosterMatched": true, "rawStudentName": "Arjun Mehta"}	{}	{"All core fields extracted. Please review before queuing."}	f
DOC-TEST-1792055674622	documents/2026/DOC-TEST-1792055674622_sample.pdf	local	sample.pdf	application/pdf	56	2026-10-15 09:14:34.645	success	{"studentId": "STU-001", "studentName": "Riya Shah"}	{}	{"All fields extracted"}	f
DOC-1792055675203-5d405f	documents/2026/DOC-1792055675203-5d405f_sample_maya_verma.jpg	local	sample_maya_verma.jpg	image/jpeg	25972	2026-10-15 09:14:35.357	partial	{"date": "2026-10-14", "endTime": "11:00", "subject": "Database Systems", "startTime": "10:00", "studentId": "", "studentName": "Maya Verma", "rawStudentId": "EXT-555", "rosterMatched": false, "rawStudentName": "Maya Verma"}	{studentId,reference}	{"OCR recognized text successfully (95% confidence).","Detected name \\"Maya Verma\\" does not match an enrolled student in the current roster. Please confirm the student manually.","Missing or uncertain fields: studentId, reference. Please verify manually."}	f
DOC-TEST-1792055986327	documents/2026/DOC-TEST-1792055986327_sample.pdf	local	sample.pdf	application/pdf	56	2026-10-15 09:19:46.348	success	{"studentId": "STU-001", "studentName": "Riya Shah"}	{}	{"All fields extracted"}	f
DOC-1792055986846-f89d9d	documents/2026/DOC-1792055986846-f89d9d_sample_maya_verma.jpg	local	sample_maya_verma.jpg	image/jpeg	25972	2026-10-15 09:19:47.083	partial	{"date": "2026-10-14", "endTime": "11:00", "subject": "Database Systems", "startTime": "10:00", "studentId": "", "studentName": "Maya Verma", "rawStudentId": "EXT-555", "rosterMatched": false, "rawStudentName": "Maya Verma"}	{studentId,reference}	{"OCR recognized text successfully (95% confidence).","Detected name \\"Maya Verma\\" does not match an enrolled student in the current roster. Please confirm the student manually.","Missing or uncertain fields: studentId, reference. Please verify manually."}	f
DOC-1792056027031-7be465	documents/2026/DOC-1792056027031-7be465_sample_attendance_letter.pdf	local	sample_attendance_letter.pdf	application/pdf	791	2026-10-15 09:20:27.099	success	{"date": "2026-10-14", "endTime": "11:00", "subject": "Database Systems", "reference": "EVT-2026-88", "startTime": "10:00", "studentId": "STU-002", "studentName": "Arjun Mehta", "rawStudentId": "STU-002", "rosterMatched": true, "rawStudentName": "Arjun Mehta"}	{}	{"All core fields extracted. Please review before queuing."}	f
DOC-TEST-1792056565719	documents/2026/DOC-TEST-1792056565719_sample.pdf	local	sample.pdf	application/pdf	56	2026-10-15 09:29:25.744	success	{"studentId": "STU-001", "studentName": "Riya Shah"}	{}	{"All fields extracted"}	f
DOC-1792056566342-f41f4b	documents/2026/DOC-1792056566342-f41f4b_sample_maya_verma.jpg	local	sample_maya_verma.jpg	image/jpeg	25972	2026-10-15 09:29:26.553	partial	{"date": "2026-10-14", "endTime": "11:00", "subject": "Database Systems", "startTime": "10:00", "studentId": "", "studentName": "Maya Verma", "rawStudentId": "EXT-555", "rosterMatched": false, "rawStudentName": "Maya Verma"}	{studentId,reference}	{"OCR recognized text successfully (95% confidence).","Detected name \\"Maya Verma\\" does not match an enrolled student in the current roster. Please confirm the student manually.","Missing or uncertain fields: studentId, reference. Please verify manually."}	f
DOC-TEST-1792056745802	documents/2026/DOC-TEST-1792056745802_sample.pdf	local	sample.pdf	application/pdf	56	2026-10-15 09:32:25.824	success	{"studentId": "STU-001", "studentName": "Riya Shah"}	{}	{"All fields extracted"}	f
DOC-1792056746332-667089	documents/2026/DOC-1792056746332-667089_sample_maya_verma.jpg	local	sample_maya_verma.jpg	image/jpeg	25972	2026-10-15 09:32:26.518	partial	{"date": "2026-10-14", "endTime": "11:00", "subject": "Database Systems", "startTime": "10:00", "studentId": "", "studentName": "Maya Verma", "rawStudentId": "EXT-555", "rosterMatched": false, "rawStudentName": "Maya Verma"}	{studentId,reference}	{"OCR recognized text successfully (95% confidence).","Detected name \\"Maya Verma\\" does not match an enrolled student in the current roster. Please confirm the student manually.","Missing or uncertain fields: studentId, reference. Please verify manually."}	f
\.


--
-- Data for Name: lectures; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.lectures (id, subject, "className", date, "startTime", "endTime", "studentIds", "createdAt", "updatedAt") FROM stdin;
LEC-101	Database Systems	EXTC ΓÇö Year 3 / A	2026-10-14	10:00	11:00	{STU-001,STU-002,STU-003,STU-004}	2026-10-15 09:03:37.23	2026-10-15 09:03:37.23
LEC-102	Computer Networks	EXTC ΓÇö Year 3 / A	2026-10-14	11:00	12:00	{STU-001,STU-002,STU-003,STU-004}	2026-10-15 09:03:37.237	2026-10-15 09:03:37.237
LEC-103	Signals & Systems	EXTC ΓÇö Year 3 / A	2026-10-15	09:00	10:00	{STU-001,STU-002,STU-003,STU-004}	2026-10-15 09:03:37.24	2026-10-15 09:03:37.24
\.


--
-- Data for Name: students; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.students (id, name, "createdAt", "updatedAt") FROM stdin;
STU-001	Riya Shah	2026-10-15 09:03:37.206	2026-10-15 09:03:37.206
STU-002	Arjun Mehta	2026-10-15 09:03:37.222	2026-10-15 09:03:37.222
STU-003	Sara Khan	2026-10-15 09:03:37.224	2026-10-15 09:03:37.224
STU-004	Dev Patel	2026-10-15 09:03:37.226	2026-10-15 09:03:37.226
STU-999	Persistence Test Student	2026-10-15 09:04:49.558	2026-10-15 09:04:49.558
\.


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: attendance_letters attendance_letters_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendance_letters
    ADD CONSTRAINT attendance_letters_pkey PRIMARY KEY (id);


--
-- Name: attendance_records attendance_records_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendance_records
    ADD CONSTRAINT attendance_records_pkey PRIMARY KEY (id);


--
-- Name: audit_events audit_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_events
    ADD CONSTRAINT audit_events_pkey PRIMARY KEY (id);


--
-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);


--
-- Name: lectures lectures_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lectures
    ADD CONSTRAINT lectures_pkey PRIMARY KEY (id);


--
-- Name: students students_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_pkey PRIMARY KEY (id);


--
-- Name: attendance_records_lectureId_studentId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "attendance_records_lectureId_studentId_key" ON public.attendance_records USING btree ("lectureId", "studentId");


--
-- Name: documents_storageKey_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "documents_storageKey_key" ON public.documents USING btree ("storageKey");


--
-- Name: attendance_letters attendance_letters_studentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendance_letters
    ADD CONSTRAINT "attendance_letters_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public.students(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: attendance_letters attendance_letters_uploadId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendance_letters
    ADD CONSTRAINT "attendance_letters_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES public.documents(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: attendance_records attendance_records_lectureId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendance_records
    ADD CONSTRAINT "attendance_records_lectureId_fkey" FOREIGN KEY ("lectureId") REFERENCES public.lectures(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: attendance_records attendance_records_studentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendance_records
    ADD CONSTRAINT "attendance_records_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public.students(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict vC6FpUgkCYcyJmpXJDbY9yPjNfumJwwXV7QhBU8iW7L4buWT8WeDikc871OjdO3

