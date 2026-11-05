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
INSERT INTO `doctor_appointments` VALUES ('DVSCHED-110526001','DOC-68eae295',NULL,'2026-11-05 04:30:00','2026-11-05 05:00:00',NULL,'Completed','Dental Appointment','Tootache','Dental','DSCH-110526001','Doctor','Tootache',NULL,NULL,NULL,'DOC-68eae295',NULL,0,'Listed',1,'Done','2026-11-05 04:30:25',NULL),('DVSCHED-110526002','DOC-68eae295',NULL,'2026-11-05 04:30:00','2026-11-05 05:00:00',NULL,'Cancelled','Dental Appointment','Toothache','Dental','DSCH-110526001','Doctor','Toothache','The session ended before number #2 was called.',NULL,NULL,'DOC-68eae295',NULL,0,'Listed',2,'Void',NULL,'2026-11-05 04:30:25'),('DVSCHED-110526003','DOC-68eae295',NULL,'2026-11-05 04:30:00','2026-11-05 05:00:00',NULL,'Cancelled','Dental Appointment','Tootache','Dental','DSCH-110526001','Doctor','Tootache','The session ended before number #3 was called.',NULL,NULL,'DOC-68eae295',NULL,0,'Listed',3,'Void',NULL,'2026-11-05 04:30:25');
/*!40000 ALTER TABLE `doctor_appointments` ENABLE KEYS */;
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
INSERT INTO `doctor_appointment_students` VALUES ('DVSCHED-110526001','02000347082','Present','2026-11-05 04:30:38',NULL),('DVSCHED-110526002','02000345411','Pending',NULL,NULL),('DVSCHED-110526003','02000257727','Pending',NULL,NULL);
/*!40000 ALTER TABLE `doctor_appointment_students` ENABLE KEYS */;
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
INSERT INTO `doctor_appointment_logs` VALUES ('1017fb9e-5f61-4e30-81fc-bead0994ad57','DVSCHED-110526001','Completed','Scheduled','Completed',NULL,NULL,NULL,NULL,'Check-up documented','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-05 05:02:06'),('1beb9d18-46d8-46de-b326-3921dedb4f7d','DVSCHED-110526001','Scheduled',NULL,'Scheduled',NULL,NULL,'2026-11-05 04:30:00','2026-11-05 05:00:00','Advance listing A1: queue number 1. Tootache','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-05 04:24:37'),('41537385-5f23-4b19-811d-32ffe2627bab','DVSCHED-110526002','Scheduled',NULL,'Scheduled',NULL,NULL,'2026-11-05 04:30:00','2026-11-05 05:00:00','Advance listing A2: queue number 2. Toothache','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-05 04:24:37'),('5e9efb2f-4902-40fc-8f70-3e89d3b68376','DVSCHED-110526003','Cancelled','Scheduled','Cancelled',NULL,NULL,NULL,NULL,'The session ended before number #3 was called.',NULL,'System',NULL,'2026-11-05 05:02:14'),('5ff1e9f0-3fbd-4ab6-9111-7ae6cc58aed7','DVSCHED-110526003','Scheduled',NULL,'Scheduled',NULL,NULL,'2026-11-05 04:30:00','2026-11-05 05:00:00','Advance listing A3: queue number 3. Tootache','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-05 04:24:37'),('6f6c9975-e828-4f6d-af21-115627035711','DVSCHED-110526002','Cancelled','Scheduled','Cancelled',NULL,NULL,NULL,NULL,'The session ended before number #2 was called.',NULL,'System',NULL,'2026-11-05 05:02:14'),('85ae0f14-3efa-42bd-a466-62921154a184','DVSCHED-110526001','Queue Called',NULL,NULL,NULL,NULL,NULL,NULL,'Number #1 was called','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-05 04:30:25');
/*!40000 ALTER TABLE `doctor_appointment_logs` ENABLE KEYS */;
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
INSERT INTO `doctor_assessments` VALUES ('DVAS-110526001','DVSCHED-110526001','02000347082','Oral hygiene: Good. DMFT 0 (Decayed 0, Missing 0, Filled 0). Gums: not noted. Malocclusion: No.','No significant dental findings',NULL,'2026-11-05 05:02:06',0,1,NULL,NULL,NULL,NULL,NULL,NULL,'Bring the lab results',NULL,NULL,NULL,NULL,'DOC-68eae295','Tootache','Dental','Doctor','Dr. Sofia Cruz',0,NULL);
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
INSERT INTO `doctor_schedules` VALUES ('DSCH-110526001','DOC-68eae295','Dental','Once','2026-11-05',NULL,NULL,NULL,'12:30:00','13:00:00',15,1,'Clinic room','Bring ID',1,'Open',NULL,NULL,'2026-11-05 04:24:37','DOC-68eae295','Hybrid','Bring ID',0,NULL,1,1,1,10,1,'2026-11-05 12:24:37',NULL);
/*!40000 ALTER TABLE `doctor_schedules` ENABLE KEYS */;
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
INSERT INTO `schedule_requests` VALUES ('SCHREQ-110326001','DOC-68eae295','Dental','NURSE02000','2026-11-06',NULL,NULL,'3 student(s) in the Dental advance listing','Cancelled',NULL,NULL,'2026-11-03 23:33:35','2026-11-03 08:44:15',1,3,NULL,NULL),('SCHREQ-110426001','DOC-ed638364','General Check Up','NURSE02000','2026-11-06',NULL,NULL,'1 student(s) in the General Check Up advance listing','Cancelled',NULL,NULL,'2026-11-04 03:51:04','2026-11-03 23:39:44',1,1,NULL,NULL),('SCHREQ-110426002','DOC-68eae295','Dental','NURSE02000','2026-11-04',NULL,NULL,'3 student(s) in the Dental advance listing','Cancelled',NULL,NULL,'2026-11-05 01:38:01','2026-11-04 03:58:06',1,3,NULL,NULL),('SCHREQ-110526001','DOC-68eae295','Dental','NURSE02000','2026-11-05',NULL,NULL,'3 student(s) in the Dental advance listing','Scheduled',NULL,'DSCH-110526001','2026-11-05 04:24:37','2026-11-05 04:16:23',1,3,NULL,NULL);
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
INSERT INTO `session_end_confirmations` VALUES ('DSCH-110526001','2026-11-05','3cf1d474-ce54-45f1-bc0c-30c07003353d','2026-11-05 13:02:14');
/*!40000 ALTER TABLE `session_end_confirmations` ENABLE KEYS */;
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
-- Table structure for table `advance_listing_entries`
--

DROP TABLE IF EXISTS `advance_listing_entries`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `advance_listing_entries` (
  `entry_id` varchar(45) NOT NULL,
  `student_id` varchar(45) NOT NULL,
  `visit_type` varchar(60) NOT NULL,
  `reason` varchar(255) NOT NULL,
  `advance_no` int NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'Waiting',
  `schedule_id` varchar(45) DEFAULT NULL,
  `session_date` date DEFAULT NULL,
  `appointment_id` varchar(45) DEFAULT NULL,
  `remove_reason` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `listing_id` varchar(45) DEFAULT NULL,
  `cutoff_schedule_id` varchar(45) DEFAULT NULL,
  `cutoff_date` date DEFAULT NULL,
  `moved_to_entry_id` varchar(45) DEFAULT NULL,
  PRIMARY KEY (`entry_id`),
  KEY `idx_advance_student` (`student_id`,`status`),
  KEY `idx_advance_service` (`visit_type`,`status`),
  KEY `idx_advance_schedule` (`schedule_id`,`session_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `advance_listing_entries`
--

LOCK TABLES `advance_listing_entries` WRITE;
/*!40000 ALTER TABLE `advance_listing_entries` DISABLE KEYS */;
INSERT INTO `advance_listing_entries` VALUES ('ADVL-110326001','02000345411','Dental','Tootache',1,'Removed',NULL,NULL,NULL,'remove','2026-11-03 08:42:10','2026-11-05 02:38:48','ADVLS-110326001',NULL,'2026-11-05',NULL),('ADVL-110326002','02000257727','Dental','Toothache',2,'Removed',NULL,NULL,NULL,'remove','2026-11-03 08:43:16','2026-11-05 02:38:53','ADVLS-110326001',NULL,'2026-11-05',NULL),('ADVL-110326003','02000350927','Dental','Tooatche',3,'Removed',NULL,NULL,NULL,'remove','2026-11-03 08:43:45','2026-11-05 02:38:58','ADVLS-110326001',NULL,'2026-11-05',NULL),('ADVL-110326004','02000347082','General Check Up','Fever',1,'Removed',NULL,NULL,NULL,'Testing','2026-11-03 09:08:38','2026-11-03 23:36:23','ADVLS-110326001',NULL,NULL,NULL),('ADVL-110326005','02000349679','General Check Up','Fever',2,'Removed',NULL,NULL,NULL,'Testing','2026-11-03 10:36:06','2026-11-03 23:36:31','ADVLS-110326002',NULL,NULL,NULL),('ADVL-110426001','02000347082','General Check Up','Fever for 30 days',1,'Moved',NULL,NULL,NULL,NULL,'2026-11-03 23:36:57','2026-11-05 00:12:25','ADVLS-110326002',NULL,'2026-11-05','ADVL-110526001'),('ADVL-110526001','02000347082','General Check Up','Fever for 30 days',1,'Removed',NULL,NULL,NULL,'remove','2026-11-05 00:12:25','2026-11-05 02:39:05','ADVLS-110526001',NULL,'2026-11-05',NULL),('ADVL-110526002','02000347082','Dental','Tootache',1,'Scheduled','DSCH-110526001','2026-11-05','DVSCHED-110526001',NULL,'2026-11-05 02:40:25','2026-11-05 04:24:37','ADVLS-110526002',NULL,NULL,NULL),('ADVL-110526003','02000345411','Dental','Toothache',2,'Scheduled','DSCH-110526001','2026-11-05','DVSCHED-110526002',NULL,'2026-11-05 02:41:30','2026-11-05 04:24:37','ADVLS-110526002',NULL,NULL,NULL),('ADVL-110526004','02000257727','Dental','Tootache',3,'Scheduled','DSCH-110526001','2026-11-05','DVSCHED-110526003',NULL,'2026-11-05 02:41:54','2026-11-05 04:24:37','ADVLS-110526002',NULL,NULL,NULL);
/*!40000 ALTER TABLE `advance_listing_entries` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `advance_listings`
--

DROP TABLE IF EXISTS `advance_listings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `advance_listings` (
  `listing_id` varchar(45) NOT NULL,
  `title` varchar(120) NOT NULL,
  `opened_at` datetime NOT NULL,
  `closes_at` datetime DEFAULT NULL,
  `closed_at` datetime DEFAULT NULL,
  `close_reason` varchar(20) DEFAULT NULL,
  `services_json` text,
  `created_by_user_id` varchar(45) DEFAULT NULL,
  `completed_at` datetime DEFAULT NULL,
  PRIMARY KEY (`listing_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `advance_listings`
--

LOCK TABLES `advance_listings` WRITE;
/*!40000 ALTER TABLE `advance_listings` DISABLE KEYS */;
INSERT INTO `advance_listings` VALUES ('ADVLS-110326001','Advance listing','2026-11-03 17:07:17',NULL,'2026-11-03 17:57:07','manual','[{\"visit_type\":\"General Check Up\",\"listing_limit\":30}]',NULL,'2026-11-03 17:57:07'),('ADVLS-110326002','advance listing for november','2026-11-03 17:57:50',NULL,'2026-11-05 08:10:15','dropped','[{\"visit_type\":\"Dental\",\"listing_limit\":30},{\"visit_type\":\"General Check Up\",\"listing_limit\":30}]','NRS02000','2026-11-05 08:10:15'),('ADVLS-110526001','Advance listing for next december','2026-11-05 08:12:16',NULL,'2026-11-05 10:38:26','dropped','[{\"visit_type\":\"Dental\",\"listing_limit\":30},{\"visit_type\":\"General Check Up\",\"listing_limit\":30}]','NRS02000','2026-11-05 10:38:33'),('ADVLS-110526002','Advance listing for december','2026-11-05 10:39:30',NULL,NULL,NULL,'[{\"visit_type\":\"Dental\",\"listing_limit\":30},{\"visit_type\":\"General Check Up\",\"listing_limit\":30}]','NRS02000',NULL);
/*!40000 ALTER TABLE `advance_listings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `advance_listing_services`
--

DROP TABLE IF EXISTS `advance_listing_services`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `advance_listing_services` (
  `visit_type` varchar(60) NOT NULL,
  `listing_limit` int NOT NULL,
  `is_open` tinyint(1) NOT NULL DEFAULT '1',
  `moved_at` datetime DEFAULT NULL,
  PRIMARY KEY (`visit_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `advance_listing_services`
--

LOCK TABLES `advance_listing_services` WRITE;
/*!40000 ALTER TABLE `advance_listing_services` DISABLE KEYS */;
INSERT INTO `advance_listing_services` VALUES ('Dental',30,0,'2026-11-05 12:25:00'),('General Check Up',30,1,NULL);
/*!40000 ALTER TABLE `advance_listing_services` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `advance_listing_settings`
--

DROP TABLE IF EXISTS `advance_listing_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `advance_listing_settings` (
  `setting_id` tinyint NOT NULL,
  `is_open` tinyint(1) NOT NULL DEFAULT '0',
  `opened_at` datetime DEFAULT NULL,
  `closes_at` datetime DEFAULT NULL,
  `updated_by_user_id` varchar(45) DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `current_listing_id` varchar(45) DEFAULT NULL,
  PRIMARY KEY (`setting_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `advance_listing_settings`
--

LOCK TABLES `advance_listing_settings` WRITE;
/*!40000 ALTER TABLE `advance_listing_settings` DISABLE KEYS */;
INSERT INTO `advance_listing_settings` VALUES (1,1,'2026-11-05 10:39:30',NULL,'NRS02000','2026-11-05 02:39:30','ADVLS-110526002');
/*!40000 ALTER TABLE `advance_listing_settings` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-11-05 13:52:30
