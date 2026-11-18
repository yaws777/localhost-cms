-- MySQL dump 10.13  Distrib 8.0.44, for Win64 (x86_64)
--
-- Host: localhost    Database: ClinicManagementSystem
-- ------------------------------------------------------
-- Server version	8.0.44

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `consultation_request_logs`
--

DROP TABLE IF EXISTS `consultation_request_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `consultation_request_logs` (
  `log_id` char(36) NOT NULL,
  `request_id` varchar(45) NOT NULL,
  `action` varchar(25) NOT NULL COMMENT 'Requested | Approved | Denied | Reminded | Reconfirm Sent | Reconfirmed | Declined Reconfirm | Appointed | Booked | Withdrawn | Fulfilled | Returned to Waiting List',
  `from_status` varchar(30) DEFAULT NULL,
  `to_status` varchar(30) DEFAULT NULL,
  `reason` varchar(255) DEFAULT NULL,
  `schedule_id` varchar(45) DEFAULT NULL,
  `actor_user_id` varchar(45) DEFAULT NULL,
  `actor_role` varchar(10) DEFAULT NULL,
  `actor_name` varchar(120) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`log_id`),
  KEY `idx_crl_request` (`request_id`,`created_at`),
  CONSTRAINT `fk_crl_request` FOREIGN KEY (`request_id`) REFERENCES `consultation_requests` (`request_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `consultation_request_logs`
--

LOCK TABLES `consultation_request_logs` WRITE;
/*!40000 ALTER TABLE `consultation_request_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `consultation_request_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `consultation_requests`
--

DROP TABLE IF EXISTS `consultation_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `consultation_requests` (
  `request_id` varchar(45) NOT NULL,
  `student_id` varchar(45) NOT NULL,
  `visit_type` varchar(30) NOT NULL DEFAULT 'General Check Up' COMMENT 'General Check Up | Dental | Vision | Other',
  `queue_no` int DEFAULT NULL COMMENT 'number in the waiting list of this visit_type, in the order of the request',
  `purpose_other` varchar(150) DEFAULT NULL,
  `reason` varchar(255) NOT NULL COMMENT 'why the student needs a consultation',
  `preferred_doctor_id` varchar(45) DEFAULT NULL,
  `preferred_note` varchar(255) DEFAULT NULL COMMENT 'preferred days / times, optional',
  `status` varchar(30) NOT NULL DEFAULT 'Waiting List' COMMENT 'Waiting List | Awaiting Reconfirmation | Reconfirmed | Appointed | Fulfilled | Missed | Denied | Withdrawn (Waiting for Approval / Booked: legacy)',
  `is_priority` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'set by staff when approving; priority students are scheduled first',
  `review_reason` varchar(255) DEFAULT NULL COMMENT 'reason when denied (or note when approved)',
  `reviewed_by_user_id` varchar(45) DEFAULT NULL,
  `reviewed_by_role` varchar(10) DEFAULT NULL,
  `reviewed_by_name` varchar(120) DEFAULT NULL,
  `reviewed_at` timestamp NULL DEFAULT NULL,
  `notified_schedule_id` varchar(45) DEFAULT NULL,
  `notified_date` date DEFAULT NULL,
  `last_notice_type` varchar(15) DEFAULT NULL COMMENT 'Reminder | Reconfirm',
  `last_notified_at` timestamp NULL DEFAULT NULL,
  `notify_count` smallint NOT NULL DEFAULT '0',
  `reconfirm_response` varchar(5) DEFAULT NULL COMMENT 'Yes | No',
  `reconfirm_note` varchar(255) DEFAULT NULL,
  `reconfirm_responded_at` timestamp NULL DEFAULT NULL,
  `appointment_id` char(36) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `listing_schedule_id` varchar(45) DEFAULT NULL,
  `listing_date` date DEFAULT NULL,
  PRIMARY KEY (`request_id`),
  KEY `idx_cr_student` (`student_id`,`created_at`),
  KEY `idx_cr_status` (`status`,`visit_type`),
  KEY `fk_cr_doctor` (`preferred_doctor_id`),
  KEY `idx_cr_queue` (`visit_type`,`queue_no`),
  CONSTRAINT `fk_cr_doctor` FOREIGN KEY (`preferred_doctor_id`) REFERENCES `doctors` (`doctor_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_cr_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`student_id`),
  CONSTRAINT `chk_cr_status` CHECK ((`status` in (_utf8mb4'Waiting for Approval',_utf8mb4'Denied',_utf8mb4'Waiting List',_utf8mb4'Awaiting Reconfirmation',_utf8mb4'Reconfirmed',_utf8mb4'Appointed',_utf8mb4'Booked',_utf8mb4'Fulfilled',_utf8mb4'Missed',_utf8mb4'Withdrawn')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `consultation_requests`
--

LOCK TABLES `consultation_requests` WRITE;
/*!40000 ALTER TABLE `consultation_requests` DISABLE KEYS */;
/*!40000 ALTER TABLE `consultation_requests` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `doctor_appointment_logs`
--

DROP TABLE IF EXISTS `doctor_appointment_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `doctor_appointment_logs` (
  `log_id` char(36) NOT NULL,
  `appointment_id` char(36) NOT NULL,
  `action` varchar(20) NOT NULL COMMENT 'Requested | Scheduled | Confirmed | Declined | Rescheduled | Cancelled | Completed | Walk-in',
  `from_status` varchar(30) DEFAULT NULL,
  `to_status` varchar(30) DEFAULT NULL,
  `old_start_time` timestamp NULL DEFAULT NULL,
  `old_end_time` timestamp NULL DEFAULT NULL,
  `new_start_time` timestamp NULL DEFAULT NULL,
  `new_end_time` timestamp NULL DEFAULT NULL,
  `reason` varchar(255) DEFAULT NULL,
  `actor_user_id` varchar(45) DEFAULT NULL,
  `actor_role` varchar(10) DEFAULT NULL COMMENT 'Doctor | Nurse | Student | System',
  `actor_name` varchar(120) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`log_id`),
  KEY `idx_dal_appointment` (`appointment_id`,`created_at`),
  CONSTRAINT `fk_dal_appointment` FOREIGN KEY (`appointment_id`) REFERENCES `doctor_appointments` (`appointment_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `doctor_appointment_logs`
--

LOCK TABLES `doctor_appointment_logs` WRITE;
/*!40000 ALTER TABLE `doctor_appointment_logs` DISABLE KEYS */;
INSERT INTO `doctor_appointment_logs` VALUES ('0d95228f-0108-40ff-a41d-b9c6d056c934','DVSCHED-111826004','Walk-in',NULL,'Scheduled',NULL,NULL,'2026-11-18 11:35:00','2026-11-18 13:49:00','Walk-in W1: Tootache','NRS02000','Nurse','Marilou Balarao','2026-11-18 13:28:33'),('0d9e7f41-f314-48a8-8420-c8ceed787cfe','DVSCHED-111826001','Scheduled',NULL,'Scheduled',NULL,NULL,'2026-11-25 11:18:00','2026-11-25 13:18:00','Advance listing A1: queue number 1. Test','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 11:17:17'),('11685c20-df77-4966-a29e-453c8e2d2525','DVSCHED-111826001','Rescheduled','Scheduled','Scheduled','2026-11-25 11:18:00','2026-11-25 13:18:00','2026-11-18 11:35:00','2026-11-18 13:18:00','The doctor moved the session: test','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 11:33:19'),('13d0d031-566c-4915-81cb-20d818d77666','DVSCHED-111826001','Completed','Scheduled','Completed',NULL,NULL,NULL,NULL,'Check-up documented','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 13:38:46'),('1464d780-8f17-4bec-9bff-da34fe93f97d','DVSCHED-111826006','Walk-in',NULL,'Scheduled',NULL,NULL,'2026-11-18 11:35:00','2026-11-18 13:49:00','Walk-in W3: Headache','NRS02000','Nurse','Marilou Balarao','2026-11-18 13:40:47'),('5a9ea35a-aa38-4128-b6d3-7086741beea6','DVSCHED-111826002','Scheduled',NULL,'Scheduled',NULL,NULL,'2026-11-25 11:18:00','2026-11-25 13:18:00','Advance listing A2: queue number 2. Test','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 11:17:17'),('80165dae-d93a-446c-a904-84f7066e7604','DVSCHED-111826003','Rescheduled','Scheduled','Scheduled','2026-11-25 11:18:00','2026-11-25 13:18:00','2026-11-18 11:35:00','2026-11-18 13:18:00','The doctor moved the session: test','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 11:33:19'),('983ffb91-f5a9-4bbe-ac83-77aa2c8145b5','DVSCHED-111826003','Completed','Scheduled','Completed',NULL,NULL,NULL,NULL,'Check-up documented','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 13:01:57'),('ad0d1ad7-8abd-4936-9db5-bcfafb5a1b5d','DVSCHED-111826002','Completed','Scheduled','Completed',NULL,NULL,NULL,NULL,'Check-up documented','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 13:04:47'),('b3efd5df-f7e0-4dfe-8163-feb81ee3f6fc','DVSCHED-111826003','Scheduled',NULL,'Scheduled',NULL,NULL,'2026-11-25 11:18:00','2026-11-25 13:18:00','Advance listing A3: queue number 3. Test','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 11:17:17'),('c4acded8-80a1-4e9a-9356-c5e99f4e3d35','DVSCHED-111826002','Rescheduled','Scheduled','Scheduled','2026-11-25 11:18:00','2026-11-25 13:18:00','2026-11-18 11:35:00','2026-11-18 13:18:00','The doctor moved the session: test','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 11:33:19'),('ca0ff2f9-4cd5-4e73-a3cb-248dcb35bf28','DVSCHED-111826001','Queue Called',NULL,NULL,NULL,NULL,NULL,NULL,'Number #1 was called','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 13:04:59'),('d5085085-2e44-453a-a28b-a382df7e61bc','DVSCHED-111826002','Queue Called',NULL,NULL,NULL,NULL,NULL,NULL,'Number #2 was called','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 13:03:16'),('eb88acb0-4363-456e-91f6-fe2212b99e9c','DVSCHED-111826005','Walk-in',NULL,'Scheduled',NULL,NULL,'2026-11-18 11:35:00','2026-11-18 13:49:00','Walk-in W2: Ligutan','NRS02000','Nurse','Marilou Balarao','2026-11-18 13:35:00'),('f6500477-569e-4ba1-889c-259383040e8d','DVSCHED-111826003','Queue Called',NULL,NULL,NULL,NULL,NULL,NULL,'Number #3 was called','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 13:00:38');
/*!40000 ALTER TABLE `doctor_appointment_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `doctor_appointment_students`
--

DROP TABLE IF EXISTS `doctor_appointment_students`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `doctor_appointment_students` (
  `appointment_id` char(36) NOT NULL,
  `student_id` varchar(45) NOT NULL,
  `attendance_status` varchar(20) DEFAULT 'Pending',
  `check_in_time` timestamp NULL DEFAULT NULL,
  `notes` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`appointment_id`,`student_id`),
  KEY `idx_student_id` (`student_id`),
  CONSTRAINT `fk_das_appointment` FOREIGN KEY (`appointment_id`) REFERENCES `doctor_appointments` (`appointment_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_das_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`student_id`) ON DELETE CASCADE,
  CONSTRAINT `chk_student_attendance` CHECK ((`attendance_status` in (_utf8mb4'Pending',_utf8mb4'Present',_utf8mb4'Absent',_utf8mb4'Excused')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `doctor_appointment_students`
--

LOCK TABLES `doctor_appointment_students` WRITE;
/*!40000 ALTER TABLE `doctor_appointment_students` DISABLE KEYS */;
INSERT INTO `doctor_appointment_students` VALUES ('DVSCHED-111826001','02000001133','Present','2026-11-18 13:04:03',NULL),('DVSCHED-111826002','02000120504','Present','2026-11-18 13:03:00',NULL),('DVSCHED-111826003','02000249174','Present','2026-11-18 12:53:08',NULL),('DVSCHED-111826004','02000257727','Present','2026-11-18 13:28:33',NULL),('DVSCHED-111826005','02000345411','Present','2026-11-18 13:35:00',NULL),('DVSCHED-111826006','02000356857','Present','2026-11-18 13:40:47',NULL);
/*!40000 ALTER TABLE `doctor_appointment_students` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `doctor_appointments`
--

DROP TABLE IF EXISTS `doctor_appointments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `doctor_appointments` (
  `appointment_id` char(36) NOT NULL,
  `doctor_id` varchar(45) NOT NULL,
  `batch_id` varchar(45) DEFAULT NULL,
  `start_time` timestamp NOT NULL,
  `end_time` timestamp NOT NULL,
  `assigned_by_nurse_id` varchar(45) DEFAULT NULL,
  `status` varchar(30) DEFAULT 'Scheduled',
  `title` varchar(45) NOT NULL,
  `announcement` text NOT NULL,
  `visit_type` varchar(30) NOT NULL DEFAULT 'General Check Up' COMMENT 'General Check Up | Dental | Vision | Other (see purpose_other) | Follow-up | Referral',
  `schedule_id` varchar(45) DEFAULT NULL,
  `booking_source` varchar(10) NOT NULL DEFAULT 'Nurse' COMMENT 'Nurse | Student | Walk-in',
  `booking_reason` varchar(255) DEFAULT NULL,
  `decline_reason` varchar(255) DEFAULT NULL,
  `parent_appointment_id` char(36) DEFAULT NULL,
  `purpose_other` varchar(150) DEFAULT NULL COMMENT 'the purpose, when visit_type = Other',
  `assigned_by_doctor_id` varchar(45) DEFAULT NULL,
  `request_id` varchar(45) DEFAULT NULL COMMENT 'consultation_requests.request_id that led to this appointment',
  `extended_minutes` smallint NOT NULL DEFAULT '0',
  `queue_lane` varchar(8) DEFAULT NULL COMMENT 'Listed (appointed by staff) | Walk-in (served after the listed lane)',
  `queue_no` smallint DEFAULT NULL COMMENT 'number inside the session and lane for that day',
  `queue_state` varchar(10) DEFAULT NULL COMMENT 'Waiting | Serving | Done | Void',
  `queue_called_at` timestamp NULL DEFAULT NULL,
  `queue_notified_at` timestamp NULL DEFAULT NULL COMMENT 'the "your turn is near" notice was sent',
  `queue_skipped_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`appointment_id`),
  KEY `idx_doctor_id` (`doctor_id`),
  KEY `idx_assigned_by_nurse_id` (`assigned_by_nurse_id`),
  KEY `idx_batch_id` (`batch_id`),
  KEY `idx_da_schedule` (`schedule_id`),
  KEY `idx_da_doctor_time` (`doctor_id`,`start_time`,`end_time`),
  KEY `fk_da_assigned_doctor` (`assigned_by_doctor_id`),
  KEY `idx_da_request` (`request_id`),
  KEY `idx_da_queue` (`schedule_id`,`start_time`,`queue_lane`,`queue_no`),
  CONSTRAINT `fk_da_assigned_doctor` FOREIGN KEY (`assigned_by_doctor_id`) REFERENCES `doctors` (`doctor_id`),
  CONSTRAINT `fk_da_batch` FOREIGN KEY (`batch_id`) REFERENCES `mass_schedule_batches` (`batch_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_da_doctor` FOREIGN KEY (`doctor_id`) REFERENCES `doctors` (`doctor_id`),
  CONSTRAINT `fk_da_nurse` FOREIGN KEY (`assigned_by_nurse_id`) REFERENCES `nurses` (`nurse_id`),
  CONSTRAINT `fk_da_schedule` FOREIGN KEY (`schedule_id`) REFERENCES `doctor_schedules` (`schedule_id`),
  CONSTRAINT `chk_appointment_status` CHECK ((`status` in (_utf8mb4'Scheduled',_utf8mb4'Completed',_utf8mb4'No-Show',_utf8mb4'Cancelled',_utf8mb4'Waiting for Approval',_utf8mb4'Declined'))),
  CONSTRAINT `chk_appointment_time` CHECK ((`end_time` > `start_time`)),
  CONSTRAINT `chk_da_queue_lane` CHECK (((`queue_lane` is null) or (`queue_lane` in (_utf8mb4'Listed',_utf8mb4'Walk-in')))),
  CONSTRAINT `chk_da_queue_state` CHECK (((`queue_state` is null) or (`queue_state` in (_utf8mb4'Waiting',_utf8mb4'Serving',_utf8mb4'Done',_utf8mb4'Void'))))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `doctor_appointments`
--

LOCK TABLES `doctor_appointments` WRITE;
/*!40000 ALTER TABLE `doctor_appointments` DISABLE KEYS */;
INSERT INTO `doctor_appointments` VALUES ('DVSCHED-111826001','DOC-68eae295',NULL,'2026-11-18 11:35:00','2026-11-18 13:49:00',NULL,'Completed','Dental Appointment','Test','Dental','DSCH-111826001','Doctor','Test',NULL,NULL,NULL,'DOC-68eae295',NULL,31,'Listed',1,'Done','2026-11-18 13:04:59','2026-11-18 13:00:38',NULL),('DVSCHED-111826002','DOC-68eae295',NULL,'2026-11-18 11:35:00','2026-11-18 13:18:00',NULL,'Completed','Dental Appointment','Test','Dental','DSCH-111826001','Doctor','Test',NULL,NULL,NULL,'DOC-68eae295',NULL,0,'Listed',2,'Done','2026-11-18 13:03:16','2026-11-18 13:00:38',NULL),('DVSCHED-111826003','DOC-68eae295',NULL,'2026-11-18 11:35:00','2026-11-18 13:18:00',NULL,'Completed','Dental Appointment','Test','Dental','DSCH-111826001','Doctor','Test',NULL,NULL,NULL,'DOC-68eae295',NULL,0,'Listed',3,'Done','2026-11-18 13:00:38',NULL,NULL),('DVSCHED-111826004','DOC-68eae295',NULL,'2026-11-18 11:35:00','2026-11-18 13:49:00','NURSE02000','Scheduled','Dental Walk-in','Tootache','Dental','DSCH-111826001','Walk-in','Tootache',NULL,NULL,NULL,NULL,NULL,0,'Walk-in',1,'Waiting',NULL,NULL,NULL),('DVSCHED-111826005','DOC-68eae295',NULL,'2026-11-18 11:35:00','2026-11-18 13:49:00','NURSE02000','Scheduled','Dental Walk-in','Ligutan','Dental','DSCH-111826001','Walk-in','Ligutan',NULL,NULL,NULL,NULL,NULL,0,'Walk-in',2,'Waiting',NULL,NULL,NULL),('DVSCHED-111826006','DOC-68eae295',NULL,'2026-11-18 11:35:00','2026-11-18 13:49:00','NURSE02000','Scheduled','Dental Walk-in','Headache','Dental','DSCH-111826001','Walk-in','Headache',NULL,NULL,NULL,NULL,NULL,0,'Walk-in',3,'Waiting',NULL,NULL,NULL);
/*!40000 ALTER TABLE `doctor_appointments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `doctor_assessments`
--

DROP TABLE IF EXISTS `doctor_assessments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `doctor_assessments` (
  `assessment_id` char(36) NOT NULL,
  `appointment_id` char(36) NOT NULL,
  `student_id` varchar(45) NOT NULL,
  `clinical_findings` text NOT NULL,
  `diagnosis` text NOT NULL,
  `treatment_recommendations` text,
  `assessment_date` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `is_abnormal` tinyint(1) NOT NULL DEFAULT '0',
  `follow_up_needed` tinyint(1) NOT NULL DEFAULT '0',
  `updated_by` varchar(45) DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `referral_facility` varchar(150) DEFAULT NULL,
  `referral_reason` text,
  `referral_issued_at` timestamp NULL DEFAULT NULL,
  `prescriptions` json DEFAULT NULL COMMENT '[{medicine, dosage, frequency, duration, instructions}]',
  `follow_up_notes` text,
  `follow_up_date` date DEFAULT NULL,
  `template_id` varchar(45) DEFAULT NULL,
  `template_name` varchar(120) DEFAULT NULL,
  `template_responses` json DEFAULT NULL COMMENT '[{key, label, type, value}] answers to the doctor template fields',
  `documented_by_doctor_id` varchar(45) DEFAULT NULL,
  `chief_complaint` varchar(255) DEFAULT NULL,
  `visit_type` varchar(30) DEFAULT NULL,
  `documented_by_role` varchar(10) DEFAULT NULL COMMENT 'Doctor | Nurse',
  `documented_by_name` varchar(120) DEFAULT NULL,
  `follow_up_closed` tinyint(1) NOT NULL DEFAULT '0' COMMENT '1 = taken off the follow-up list without a visit',
  `follow_up_closed_reason` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`assessment_id`),
  UNIQUE KEY `idx_appointment_student` (`appointment_id`,`student_id`),
  KEY `fk_assessment_doctor` (`documented_by_doctor_id`),
  CONSTRAINT `fk_assessment_doctor` FOREIGN KEY (`documented_by_doctor_id`) REFERENCES `doctors` (`doctor_id`),
  CONSTRAINT `fk_assessment_student_appointment` FOREIGN KEY (`appointment_id`, `student_id`) REFERENCES `doctor_appointment_students` (`appointment_id`, `student_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `doctor_assessments`
--

LOCK TABLES `doctor_assessments` WRITE;
/*!40000 ALTER TABLE `doctor_assessments` DISABLE KEYS */;
INSERT INTO `doctor_assessments` VALUES ('DVAS-111826001','DVSCHED-111826003','02000249174','Test','Test','Test','2026-11-18 13:01:57',0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'DOC-68eae295','Test','Dental','Doctor','Dr. Sofia Cruz',0,NULL),('DVAS-111826002','DVSCHED-111826002','02000120504','Test','Test','Test','2026-11-18 13:04:47',0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'DOC-68eae295','Test','Dental','Doctor','Dr. Sofia Cruz',0,NULL),('DVAS-111826003','DVSCHED-111826001','02000001133','Test','Test','Test','2026-11-18 13:38:46',0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'DOC-68eae295','Test','Dental','Doctor','Dr. Sofia Cruz',0,NULL);
/*!40000 ALTER TABLE `doctor_assessments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `doctor_schedules`
--

DROP TABLE IF EXISTS `doctor_schedules`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `doctor_schedules` (
  `schedule_id` varchar(45) NOT NULL,
  `doctor_id` varchar(45) NOT NULL,
  `visit_type` varchar(30) NOT NULL DEFAULT 'Any' COMMENT 'Any or one of the doctor visit types',
  `recurrence` varchar(10) NOT NULL DEFAULT 'Once' COMMENT 'Once | Weekly',
  `schedule_date` date DEFAULT NULL COMMENT 'Once: the date',
  `day_of_week` tinyint DEFAULT NULL COMMENT 'Weekly: 0=Sunday .. 6=Saturday',
  `valid_from` date DEFAULT NULL COMMENT 'Weekly: first date it applies',
  `valid_until` date DEFAULT NULL COMMENT 'Weekly: last date it applies',
  `start_time` time NOT NULL,
  `end_time` time NOT NULL,
  `slot_duration_min` smallint NOT NULL DEFAULT '15',
  `max_patients_per_slot` smallint NOT NULL DEFAULT '1',
  `location` varchar(100) DEFAULT NULL,
  `notes` varchar(255) DEFAULT NULL,
  `auto_confirm` tinyint(1) NOT NULL DEFAULT '0' COMMENT '1 = student bookings are confirmed without nurse approval',
  `status` varchar(10) NOT NULL DEFAULT 'Open' COMMENT 'Open | Closed',
  `closed_reason` varchar(255) DEFAULT NULL,
  `created_by_nurse_id` varchar(45) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by_doctor_id` varchar(45) DEFAULT NULL,
  `schedule_type` varchar(15) NOT NULL DEFAULT 'Open Slot' COMMENT 'Appointment | Open Slot | Walk-in',
  `announcement` varchar(500) DEFAULT NULL COMMENT 'text shown to students (mainly Walk-in sessions)',
  `extended_minutes` smallint NOT NULL DEFAULT '0' COMMENT 'total minutes the session was extended',
  `original_end_time` time DEFAULT NULL COMMENT 'end time before the first extension',
  `allow_appointment` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'staff appoint students into this session',
  `allow_open_booking` tinyint(1) NOT NULL DEFAULT '1' COMMENT 'students book a time block themselves',
  `allow_walk_in` tinyint(1) NOT NULL DEFAULT '1' COMMENT 'walk-ins are accepted during the session',
  `listing_limit` int DEFAULT NULL,
  `listing_open` tinyint(1) NOT NULL DEFAULT '0',
  `listing_opened_at` datetime DEFAULT NULL,
  `template_id` varchar(45) DEFAULT NULL,
  PRIMARY KEY (`schedule_id`),
  KEY `idx_ds_doctor` (`doctor_id`),
  KEY `idx_ds_date` (`schedule_date`),
  KEY `fk_ds_nurse` (`created_by_nurse_id`),
  KEY `fk_ds_created_doctor` (`created_by_doctor_id`),
  CONSTRAINT `fk_ds_created_doctor` FOREIGN KEY (`created_by_doctor_id`) REFERENCES `doctors` (`doctor_id`),
  CONSTRAINT `fk_ds_doctor` FOREIGN KEY (`doctor_id`) REFERENCES `doctors` (`doctor_id`),
  CONSTRAINT `fk_ds_nurse` FOREIGN KEY (`created_by_nurse_id`) REFERENCES `nurses` (`nurse_id`),
  CONSTRAINT `chk_ds_capacity` CHECK (((`max_patients_per_slot` >= 1) and (`slot_duration_min` >= 5))),
  CONSTRAINT `chk_ds_modes` CHECK ((((`allow_appointment` + `allow_open_booking`) + `allow_walk_in`) >= 1)),
  CONSTRAINT `chk_ds_recurrence` CHECK ((`recurrence` in (_utf8mb4'Once',_utf8mb4'Weekly'))),
  CONSTRAINT `chk_ds_status` CHECK ((`status` in (_utf8mb4'Open',_utf8mb4'Closed'))),
  CONSTRAINT `chk_ds_time` CHECK ((`end_time` > `start_time`)),
  CONSTRAINT `chk_ds_type` CHECK ((`schedule_type` in (_utf8mb4'Appointment',_utf8mb4'Open Slot',_utf8mb4'Walk-in',_utf8mb4'Hybrid')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `doctor_schedules`
--

LOCK TABLES `doctor_schedules` WRITE;
/*!40000 ALTER TABLE `doctor_schedules` DISABLE KEYS */;
INSERT INTO `doctor_schedules` VALUES ('DSCH-111826001','DOC-68eae295','Dental','Once','2026-11-18',NULL,NULL,NULL,'19:35:00','21:49:00',15,1,'Clinic room','Bring ID',1,'Open',NULL,NULL,'2026-11-18 11:17:17','DOC-68eae295','Hybrid','Bring ID',31,'21:18:00',1,1,1,15,1,'2026-11-18 19:17:17',NULL);
/*!40000 ALTER TABLE `doctor_schedules` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `doctor_unavailable_dates`
--

DROP TABLE IF EXISTS `doctor_unavailable_dates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `doctor_unavailable_dates` (
  `unavailable_id` varchar(45) NOT NULL,
  `doctor_id` varchar(45) NOT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `start_time` time DEFAULT NULL COMMENT 'NULL together with end_time = the whole day(s)',
  `end_time` time DEFAULT NULL,
  `reason` varchar(255) DEFAULT NULL,
  `created_by_user_id` varchar(45) DEFAULT NULL,
  `created_by_role` varchar(10) DEFAULT NULL COMMENT 'Doctor | Nurse',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`unavailable_id`),
  KEY `idx_dud_doctor_dates` (`doctor_id`,`start_date`,`end_date`),
  CONSTRAINT `fk_dud_doctor` FOREIGN KEY (`doctor_id`) REFERENCES `doctors` (`doctor_id`) ON DELETE CASCADE,
  CONSTRAINT `chk_dud_dates` CHECK ((`end_date` >= `start_date`)),
  CONSTRAINT `chk_dud_times` CHECK ((((`start_time` is null) and (`end_time` is null)) or ((`start_time` is not null) and (`end_time` is not null) and (`end_time` > `start_time`))))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `doctor_unavailable_dates`
--

LOCK TABLES `doctor_unavailable_dates` WRITE;
/*!40000 ALTER TABLE `doctor_unavailable_dates` DISABLE KEYS */;
/*!40000 ALTER TABLE `doctor_unavailable_dates` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `queue_counters`
--

DROP TABLE IF EXISTS `queue_counters`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `queue_counters` (
  `visit_type` varchar(30) NOT NULL,
  `last_no` int NOT NULL DEFAULT '0',
  PRIMARY KEY (`visit_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `queue_counters`
--

LOCK TABLES `queue_counters` WRITE;
/*!40000 ALTER TABLE `queue_counters` DISABLE KEYS */;
/*!40000 ALTER TABLE `queue_counters` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `schedule_requests`
--

DROP TABLE IF EXISTS `schedule_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `schedule_requests` (
  `schedule_request_id` varchar(45) NOT NULL,
  `doctor_id` varchar(45) NOT NULL,
  `visit_type` varchar(30) NOT NULL DEFAULT 'Any',
  `requested_by_nurse_id` varchar(45) DEFAULT NULL,
  `preferred_date` date DEFAULT NULL,
  `preferred_start` time DEFAULT NULL,
  `preferred_end` time DEFAULT NULL,
  `note` varchar(255) DEFAULT NULL,
  `status` varchar(10) NOT NULL DEFAULT 'Pending' COMMENT 'Pending | Scheduled | Declined | Cancelled',
  `decline_reason` varchar(255) DEFAULT NULL,
  `schedule_id` varchar(45) DEFAULT NULL COMMENT 'the schedule the doctor set for this request',
  `responded_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `for_advance` tinyint(1) NOT NULL DEFAULT '0',
  `advance_count` int DEFAULT NULL,
  `repeat_ids` text,
  `repeat_count` int DEFAULT NULL,
  PRIMARY KEY (`schedule_request_id`),
  KEY `idx_sr_doctor` (`doctor_id`,`status`),
  KEY `fk_sr_nurse` (`requested_by_nurse_id`),
  CONSTRAINT `fk_sr_doctor` FOREIGN KEY (`doctor_id`) REFERENCES `doctors` (`doctor_id`),
  CONSTRAINT `fk_sr_nurse` FOREIGN KEY (`requested_by_nurse_id`) REFERENCES `nurses` (`nurse_id`) ON DELETE SET NULL,
  CONSTRAINT `chk_sr_status` CHECK ((`status` in (_utf8mb4'Pending',_utf8mb4'Scheduled',_utf8mb4'Declined',_utf8mb4'Cancelled')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `schedule_requests`
--

LOCK TABLES `schedule_requests` WRITE;
/*!40000 ALTER TABLE `schedule_requests` DISABLE KEYS */;
INSERT INTO `schedule_requests` VALUES ('SCHREQ-111826001','DOC-68eae295','Dental','NURSE02000','2026-11-18',NULL,NULL,'3 student(s) in the Dental advance listing','Scheduled',NULL,'DSCH-111826001','2026-11-18 11:17:17','2026-11-18 11:15:36',1,3,NULL,NULL);
/*!40000 ALTER TABLE `schedule_requests` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `session_end_confirmations`
--

DROP TABLE IF EXISTS `session_end_confirmations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `session_end_confirmations` (
  `schedule_id` varchar(45) NOT NULL,
  `session_date` date NOT NULL,
  `confirmed_by` varchar(45) DEFAULT NULL,
  `confirmed_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`schedule_id`,`session_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `session_end_confirmations`
--

LOCK TABLES `session_end_confirmations` WRITE;
/*!40000 ALTER TABLE `session_end_confirmations` DISABLE KEYS */;
/*!40000 ALTER TABLE `session_end_confirmations` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-11-18 21:42:07
-- MySQL dump 10.13  Distrib 8.0.44, for Win64 (x86_64)
--
-- Host: localhost    Database: ClinicManagementSystem
-- ------------------------------------------------------
-- Server version	8.0.44

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Dumping data for table `clinic_visits`
--
-- WHERE:  visit_kind='Check-up'

LOCK TABLES `clinic_visits` WRITE;
/*!40000 ALTER TABLE `clinic_visits` DISABLE KEYS */;
INSERT INTO `clinic_visits` VALUES ('VISIT-111826003','02000249174','NURSE02000',NULL,NULL,'2026-11-18','20:53:00','21:29:00','36.5','16','80','120/80',NULL,NULL,'36.5','16','80','120/80','in good health condition','DVSCHED-111826003','Check-up'),('VISIT-111826004','02000120504','NURSE02000',NULL,NULL,'2026-11-18','21:03:00','21:29:00','36.5','16','80','120/80',NULL,NULL,'36.5','16','80','120/80','in good condition','DVSCHED-111826002','Check-up'),('VISIT-111826005','02000001133','NURSE02000',NULL,NULL,'2026-11-18','21:04:00','21:39:00','36.5','16','80','120/80',NULL,NULL,'36.5','16','80','120/80',NULL,'DVSCHED-111826001','Check-up'),('VISIT-111826006','02000345411','NURSE02000',NULL,NULL,'2026-11-18','21:35:00',NULL,'36.5','16','80','120/80',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'DVSCHED-111826005','Check-up'),('VISIT-111826007','02000356857','NURSE02000',NULL,NULL,'2026-11-18','21:40:00',NULL,'36.5','16','80','120/80',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'DVSCHED-111826006','Check-up');
/*!40000 ALTER TABLE `clinic_visits` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-11-18 21:42:08
