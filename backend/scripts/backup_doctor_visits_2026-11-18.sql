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
INSERT INTO `doctor_schedules` VALUES ('DSCH-111826001','DOC-68eae295','Dental','Once','2026-11-18',NULL,NULL,NULL,'10:38:00','11:59:00',15,1,'Clinic room','Bring ID',1,'Open',NULL,NULL,'2026-11-18 02:38:15','DOC-68eae295','Hybrid','Bring ID',0,NULL,1,1,1,15,1,'2026-11-18 10:38:16',NULL),('DSCH-111826002','DOC-68eae295','Dental','Once','2026-11-18',NULL,NULL,NULL,'13:37:00','19:04:00',15,1,'Clinic Room','Bring ID',1,'Open',NULL,NULL,'2026-11-18 05:33:17','DOC-68eae295','Hybrid','Bring ID',244,'15:00:00',1,1,1,15,0,NULL,NULL);
/*!40000 ALTER TABLE `doctor_schedules` ENABLE KEYS */;
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
INSERT INTO `doctor_appointments` VALUES ('DVSCHED-111826001','DOC-68eae295',NULL,'2026-11-18 02:38:00','2026-11-18 03:59:00',NULL,'Completed','Dental Appointment','Tootache','Dental','DSCH-111826001','Doctor','Tootache',NULL,NULL,NULL,'DOC-68eae295',NULL,0,'Listed',1,'Done','2026-11-18 03:07:25',NULL,NULL),('DVSCHED-111826002','DOC-68eae295',NULL,'2026-11-18 02:38:00','2026-11-18 03:59:00',NULL,'Scheduled','Dental Appointment','Toothache','Dental','DSCH-111826001','Doctor','Toothache',NULL,NULL,NULL,'DOC-68eae295',NULL,0,'Listed',2,'Void','2026-11-18 03:08:53','2026-11-18 03:03:20','2026-11-18 03:08:59'),('DVSCHED-111826003','DOC-68eae295',NULL,'2026-11-18 02:38:00','2026-11-18 03:59:00',NULL,'Scheduled','Dental Appointment','Cavity check','Dental','DSCH-111826001','Doctor','Cavity check',NULL,NULL,NULL,'DOC-68eae295',NULL,0,'Listed',3,'Void','2026-11-18 03:08:59','2026-11-18 03:03:20','2026-11-18 03:09:14'),('DVSCHED-111826004','DOC-68eae295',NULL,'2026-11-18 02:38:00','2026-11-18 03:59:00',NULL,'Scheduled','Dental Appointment','Gum bleeding','Dental','DSCH-111826001','Doctor','Gum bleeding',NULL,NULL,NULL,'DOC-68eae295',NULL,0,'Listed',4,'Void','2026-11-18 03:09:14','2026-11-18 03:03:20','2026-11-18 03:09:18'),('DVSCHED-111826005','DOC-68eae295',NULL,'2026-11-18 02:38:00','2026-11-18 03:59:00',NULL,'Scheduled','Dental Appointment','Braces adjustment','Dental','DSCH-111826001','Doctor','Braces adjustment',NULL,NULL,NULL,'DOC-68eae295',NULL,0,'Listed',5,'Void','2026-11-18 03:09:18','2026-11-18 03:07:15','2026-11-18 03:09:51'),('DVSCHED-111826006','DOC-68eae295',NULL,'2026-11-18 02:38:00','2026-11-18 03:59:00','NURSE02000','Completed','Dental Appointment','Tootache','Dental','DSCH-111826001','Nurse','Tootache',NULL,NULL,NULL,NULL,'CREQ-111826001',0,'Listed',6,'Done','2026-11-18 03:09:51','2026-11-18 03:08:59',NULL),('DVSCHED-111826007','DOC-68eae295',NULL,'2026-11-18 02:38:00','2026-11-18 03:59:00',NULL,'Completed','Dental Walk-in','Tootache','Dental','DSCH-111826001','Walk-in','Tootache',NULL,NULL,NULL,'DOC-68eae295',NULL,0,'Walk-in',1,'Done','2026-11-18 03:20:38',NULL,NULL),('DVSCHED-111826008','DOC-68eae295',NULL,'2026-11-18 02:38:00','2026-11-18 03:59:00',NULL,'Completed','Dental Walk-in','Tootache','Dental','DSCH-111826001','Walk-in','Tootache',NULL,NULL,NULL,'DOC-68eae295',NULL,0,'Walk-in',2,'Done','2026-11-18 03:24:38',NULL,NULL),('DVSCHED-111826009','DOC-68eae295',NULL,'2026-11-18 02:38:00','2026-11-18 03:59:00',NULL,'Scheduled','Dental Walk-in','tsw','Dental','DSCH-111826001','Walk-in','tsw',NULL,NULL,NULL,'DOC-68eae295',NULL,0,'Walk-in',3,'Serving','2026-11-18 03:25:32','2026-11-18 03:24:38',NULL),('DVSCHED-111826010','DOC-68eae295',NULL,'2026-11-18 05:37:00','2026-11-18 10:31:00',NULL,'Completed','Dental Walk-in','Headache','Dental','DSCH-111826002','Walk-in','Headache',NULL,NULL,NULL,'DOC-68eae295',NULL,211,'Walk-in',1,'Done','2026-11-18 05:49:31',NULL,NULL),('DVSCHED-111826011','DOC-68eae295',NULL,'2026-11-18 05:37:00','2026-11-18 11:04:00','NURSE02000','Scheduled','Dental Walk-in','tootache','Dental','DSCH-111826002','Walk-in','tootache',NULL,NULL,NULL,NULL,NULL,244,'Walk-in',2,'Serving','2026-11-18 10:03:54','2026-11-18 05:49:31',NULL),('DVSCHED-111826012','DOC-68eae295',NULL,'2026-11-18 05:37:00','2026-11-18 11:04:00','NURSE02000','Scheduled','Dental Walk-in','Tootache','Dental','DSCH-111826002','Walk-in','Tootache',NULL,NULL,NULL,NULL,NULL,33,'Walk-in',3,'Waiting',NULL,'2026-11-18 10:03:54',NULL),('DVSCHED-111826013','DOC-68eae295',NULL,'2026-11-18 05:37:00','2026-11-18 11:04:00','NURSE02000','Scheduled','Dental Walk-in','test','Dental','DSCH-111826002','Walk-in','test',NULL,NULL,NULL,NULL,NULL,33,'Walk-in',4,'Waiting',NULL,NULL,NULL),('DVSCHED-111826014','DOC-68eae295',NULL,'2026-11-18 05:37:00','2026-11-18 11:04:00','NURSE02000','Scheduled','Dental Walk-in','tootache','Dental','DSCH-111826002','Walk-in','tootache',NULL,NULL,NULL,NULL,NULL,33,'Walk-in',5,'Waiting',NULL,NULL,NULL),('DVSCHED-111826015','DOC-68eae295',NULL,'2026-11-18 05:37:00','2026-11-18 11:04:00','NURSE02000','Scheduled','Dental Walk-in','tootache','Dental','DSCH-111826002','Walk-in','tootache',NULL,NULL,NULL,NULL,NULL,33,'Walk-in',6,'Waiting',NULL,NULL,NULL);
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
INSERT INTO `doctor_appointment_students` VALUES ('DVSCHED-111826001','02000345411','Present','2026-11-18 03:07:30',NULL),('DVSCHED-111826002','02000338958','Absent',NULL,'Skipped in the queue'),('DVSCHED-111826003','02000369629','Absent',NULL,'Skipped in the queue'),('DVSCHED-111826004','02000250559','Absent',NULL,'Skipped in the queue'),('DVSCHED-111826005','02000354315','Absent',NULL,'Skipped in the queue'),('DVSCHED-111826006','02000350927','Present','2026-11-18 03:10:06',NULL),('DVSCHED-111826007','02000257727','Present','2026-11-18 03:20:21',NULL),('DVSCHED-111826008','02000257727','Present','2026-11-18 03:22:42',NULL),('DVSCHED-111826009','02000350927','Present','2026-11-18 03:24:04',NULL),('DVSCHED-111826010','02000345411','Present','2026-11-18 05:46:28',NULL),('DVSCHED-111826011','02000257727','Present','2026-11-18 05:47:30',NULL),('DVSCHED-111826012','02000369629','Present','2026-11-18 10:02:39',NULL),('DVSCHED-111826013','02000565721','Present','2026-11-18 10:15:28',NULL),('DVSCHED-111826014','02000345411','Present','2026-11-18 10:20:44',NULL),('DVSCHED-111826015','02000372405','Present','2026-11-18 10:29:52',NULL);
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
INSERT INTO `doctor_appointment_logs` VALUES ('01aaa506-a6f4-422d-97b1-d05b9d285fae','DVSCHED-111826004','Queue Skipped',NULL,NULL,NULL,NULL,NULL,NULL,'The student was not there when the number was called','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 03:09:18'),('01ab617b-6776-4357-800d-ca7465d41075','DVSCHED-111826003','Scheduled',NULL,'Scheduled',NULL,NULL,'2026-11-18 02:38:00','2026-11-18 03:59:00','Advance listing A3: queue number 3. Cavity check','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 02:38:15'),('09aeddc0-3eec-4737-be59-ef3f6acccb65','DVSCHED-111826009','Queue Called',NULL,NULL,NULL,NULL,NULL,NULL,'Number W3 was called','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 03:25:32'),('0ca93d87-b077-4e78-a900-72107b1645ff','DVSCHED-111826008','Queue Called',NULL,NULL,NULL,NULL,NULL,NULL,'Number W2 was called','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 03:24:38'),('17233625-2842-43ce-b5d0-6ad196faf37e','DVSCHED-111826012','Walk-in',NULL,'Scheduled',NULL,NULL,'2026-11-18 05:37:00','2026-11-18 10:31:00','Walk-in W3: Tootache','NRS02000','Nurse','Marilou Balarao','2026-11-18 10:02:39'),('17e5c55d-8283-4195-adfe-2e11238d92c4','DVSCHED-111826010','Completed','Scheduled','Completed',NULL,NULL,NULL,NULL,'Check-up documented','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 10:03:47'),('211ba6ff-a96a-4cc6-9958-e4c6af4a29ab','DVSCHED-111826003','Queue Skipped',NULL,NULL,NULL,NULL,NULL,NULL,'The student was not there when the number was called','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 03:09:14'),('26239d83-d64e-45f1-91a1-6166b201f613','DVSCHED-111826010','Queue Called',NULL,NULL,NULL,NULL,NULL,NULL,'Number W1 was called','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 05:49:31'),('363f950c-ea9b-4819-9a7b-737598642b85','DVSCHED-111826006','Scheduled',NULL,'Scheduled',NULL,NULL,'2026-11-18 02:38:00','2026-11-18 03:59:00','Listing accepted: queue number 6. Tootache','NRS02000','Nurse','Marilou Balarao','2026-11-18 02:48:03'),('3e7d9b04-3861-4d3a-9d1e-ec09b1728c48','DVSCHED-111826001','Scheduled',NULL,'Scheduled',NULL,NULL,'2026-11-18 02:38:00','2026-11-18 03:59:00','Advance listing A1: queue number 1. Tootache','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 02:38:15'),('48752e79-3674-42fe-b2e3-a01a0c3eab11','DVSCHED-111826006','Queue Called',NULL,NULL,NULL,NULL,NULL,NULL,'Number #6 was called','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 03:09:51'),('4903c21d-734c-4dc0-8da0-43d00320d179','DVSCHED-111826002','Queue Restored',NULL,NULL,NULL,NULL,NULL,NULL,'Went back to number #2','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 03:08:53'),('4ccb6d21-68ad-48fa-800e-fab35b3e95f3','DVSCHED-111826001','Queue Called',NULL,NULL,NULL,NULL,NULL,NULL,'Number #1 was called','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 03:03:20'),('50005eae-f0cb-4d67-8c3f-5200ed5036a3','DVSCHED-111826008','Completed','Scheduled','Completed',NULL,NULL,NULL,NULL,'Check-up documented','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 03:25:26'),('562af1f0-c866-450a-8562-b248fdaedb05','DVSCHED-111826011','Queue Called',NULL,NULL,NULL,NULL,NULL,NULL,'Number W2 was called','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 10:03:54'),('5f33dafb-0050-4690-881f-a9e2b0f4f283','DVSCHED-111826007','Walk-in',NULL,'Scheduled',NULL,NULL,'2026-11-18 02:38:00','2026-11-18 03:59:00','Walk-in W1: Tootache','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 03:20:21'),('65c0ac7e-16f6-4911-b7f6-b4e84a5e1920','DVSCHED-111826001','Completed','Scheduled','Completed',NULL,NULL,NULL,NULL,'Check-up documented','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 03:08:12'),('69e1814b-aeb9-4467-8668-89090e8a1c21','DVSCHED-111826002','Queue Skipped',NULL,NULL,NULL,NULL,NULL,NULL,'#2 did not time in before another number was called','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 03:07:25'),('6dba9576-ec3a-46ec-9301-26c9eb99e8d5','DVSCHED-111826013','Walk-in',NULL,'Scheduled',NULL,NULL,'2026-11-18 05:37:00','2026-11-18 10:31:00','Walk-in W4: test','NRS02000','Nurse','Marilou Balarao','2026-11-18 10:15:28'),('716104bf-22af-452e-8e11-b2471b2928b3','DVSCHED-111826007','Completed','Scheduled','Completed',NULL,NULL,NULL,NULL,'Check-up documented','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 03:22:24'),('7201cb6f-cce4-45d0-8781-c290518d374b','DVSCHED-111826009','Walk-in',NULL,'Scheduled',NULL,NULL,'2026-11-18 02:38:00','2026-11-18 03:59:00','Walk-in W3: tsw','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 03:24:04'),('7e678fc7-fbc5-434b-9697-4bea46fbc0e2','DVSCHED-111826005','Queue Called',NULL,NULL,NULL,NULL,NULL,NULL,'Number #5 was called','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 03:09:18'),('8366676a-104d-4bc6-9dd0-815ce1b179a6','DVSCHED-111826011','Walk-in',NULL,'Scheduled',NULL,NULL,'2026-11-18 05:37:00','2026-11-18 07:00:00','Walk-in W2: tootache','NRS02000','Nurse','Marilou Balarao','2026-11-18 05:47:30'),('8a1f91d9-5cf4-41ca-82e5-198d62bda5c6','DVSCHED-111826005','Queue Skipped',NULL,NULL,NULL,NULL,NULL,NULL,'The student was not there when the number was called','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 03:09:51'),('8e5997ee-a544-459d-abe4-3d5254117c03','DVSCHED-111826002','Scheduled',NULL,'Scheduled',NULL,NULL,'2026-11-18 02:38:00','2026-11-18 03:59:00','Advance listing A2: queue number 2. Toothache','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 02:38:15'),('8f06c509-5f30-492d-8dc4-7e743b09f78f','DVSCHED-111826001','Queue Skipped',NULL,NULL,NULL,NULL,NULL,NULL,'The student was not there when the number was called','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 03:07:15'),('a9d2753c-cdf5-46d7-8430-d9efef3756fd','DVSCHED-111826006','Completed','Scheduled','Completed',NULL,NULL,NULL,NULL,'Check-up documented','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 03:18:19'),('aff10940-3cb7-4cde-98ea-b0c8eb046f2f','DVSCHED-111826003','Queue Called',NULL,NULL,NULL,NULL,NULL,NULL,'Number #3 was called','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 03:08:59'),('bb97da86-a0eb-4902-9e8b-5b9ba2987c05','DVSCHED-111826014','Walk-in',NULL,'Scheduled',NULL,NULL,'2026-11-18 05:37:00','2026-11-18 10:31:00','Walk-in W5: tootache','NRS02000','Nurse','Marilou Balarao','2026-11-18 10:20:44'),('c1f4d2bb-6398-444b-a996-410301706ddb','DVSCHED-111826008','Walk-in',NULL,'Scheduled',NULL,NULL,'2026-11-18 02:38:00','2026-11-18 03:59:00','Walk-in W2: Tootache','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 03:22:42'),('c3cc661b-eed2-4e7f-9515-9912b76ecc4e','DVSCHED-111826004','Scheduled',NULL,'Scheduled',NULL,NULL,'2026-11-18 02:38:00','2026-11-18 03:59:00','Advance listing A4: queue number 4. Gum bleeding','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 02:38:15'),('c87bc8e8-7526-4d46-8448-8af42a4cc185','DVSCHED-111826001','Queue Restored',NULL,NULL,NULL,NULL,NULL,NULL,'Went back to number #1','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 03:07:25'),('dc526a23-cd3a-46ff-814c-b0ce148b4023','DVSCHED-111826010','Walk-in',NULL,'Scheduled',NULL,NULL,'2026-11-18 05:37:00','2026-11-18 07:00:00','Walk-in W1: Headache','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 05:46:28'),('e4a715b6-2fb5-4378-8aaf-8fd0769a876c','DVSCHED-111826004','Queue Called',NULL,NULL,NULL,NULL,NULL,NULL,'Number #4 was called','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 03:09:14'),('e4eb5f26-d3f0-469e-8271-9ef06b0498a5','DVSCHED-111826005','Scheduled',NULL,'Scheduled',NULL,NULL,'2026-11-18 02:38:00','2026-11-18 03:59:00','Advance listing A5: queue number 5. Braces adjustment','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 02:38:15'),('f1e52cde-1e62-4dcd-971d-15c3427c5b7f','DVSCHED-111826002','Queue Skipped',NULL,NULL,NULL,NULL,NULL,NULL,'The student was not there when the number was called','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 03:08:59'),('f4913cca-b12d-467b-9777-c6f765bc83b8','DVSCHED-111826002','Queue Called',NULL,NULL,NULL,NULL,NULL,NULL,'Number #2 was called','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 03:07:15'),('f986cd96-1697-4f11-b821-be7a0ded28a2','DVSCHED-111826007','Queue Called',NULL,NULL,NULL,NULL,NULL,NULL,'Number W1 was called','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 03:20:38'),('fe5af115-6403-4f6d-8d65-17a4ea144216','DVSCHED-111826015','Walk-in',NULL,'Scheduled',NULL,NULL,'2026-11-18 05:37:00','2026-11-18 10:31:00','Walk-in W6: tootache','NRS02000','Nurse','Marilou Balarao','2026-11-18 10:29:52');
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
INSERT INTO `doctor_assessments` VALUES ('DVAS-111826001','DVSCHED-111826001','02000345411','Test','Test','Test','2026-11-18 03:08:12',0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'DOC-68eae295','Tootache','Dental','Doctor','Dr. Sofia Cruz',0,NULL),('DVAS-111826002','DVSCHED-111826006','02000350927','Tews','Test','Test','2026-11-18 03:18:19',0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'DOC-68eae295','Tootache','Dental','Doctor','Dr. Sofia Cruz',0,NULL),('DVAS-111826003','DVSCHED-111826007','02000257727','TEst','Test','Test','2026-11-18 03:22:24',0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'DOC-68eae295','Tootache','Dental','Doctor','Dr. Sofia Cruz',0,NULL),('DVAS-111826004','DVSCHED-111826008','02000257727','Test','Test','Test','2026-11-18 03:25:26',0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'DOC-68eae295','Tootache','Dental','Doctor','Dr. Sofia Cruz',0,NULL),('DVAS-111826005','DVSCHED-111826010','02000345411','Test','Test','Test','2026-11-18 10:03:47',0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'DOC-68eae295','Headache','Dental','Doctor','Dr. Sofia Cruz',0,NULL);
/*!40000 ALTER TABLE `doctor_assessments` ENABLE KEYS */;
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
INSERT INTO `consultation_requests` VALUES ('CREQ-111826001','02000350927','Dental',6,NULL,'Tootache','DOC-68eae295',NULL,'Fulfilled',0,NULL,'NRS02000','Nurse','Marilou Balarao','2026-11-18 02:48:03',NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,'DVSCHED-111826006','2026-11-18 02:39:57','2026-11-18 03:18:19','DSCH-111826001','2026-11-18');
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
INSERT INTO `consultation_request_logs` VALUES ('072a1cec-e001-44f3-b236-7b3fc55f477b','CREQ-111826001','Accepted','Waiting for Approval','Appointed','Listing accepted. Queue number #6','DSCH-111826001','NRS02000','Nurse','Marilou Balarao','2026-11-18 02:48:03'),('2cbda6e5-a2d6-4f20-84bb-e9f5d10e8d76','CREQ-111826001','Requested',NULL,'Waiting for Approval','Tootache','DSCH-111826001','STDNT350927','Student','Albert Siason','2026-11-18 02:39:58'),('4bff6cc6-a0e7-4e18-a014-09ead7b2d0aa','CREQ-111826001','Fulfilled','Appointed','Fulfilled','The check-up was documented',NULL,'3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 03:18:19'),('79b151c8-5041-4032-9afb-e12c36e3c6e3','CREQ-111826001','Appointed','Waiting List','Appointed','Appointed to the session on 2026-11-18, queue number 6','DSCH-111826001','NRS02000','Nurse','Marilou Balarao','2026-11-18 02:48:03');
/*!40000 ALTER TABLE `consultation_request_logs` ENABLE KEYS */;
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
INSERT INTO `schedule_requests` VALUES ('SCHREQ-111826001','DOC-68eae295','Dental','NURSE02000',NULL,NULL,NULL,'5 student(s) in the Dental advance listing','Scheduled',NULL,'DSCH-111826001','2026-11-18 02:38:15','2026-11-18 02:35:10',1,5,NULL,NULL),('SCHREQ-111826002','DOC-68eae295','Dental','NURSE02000','2026-11-18',NULL,NULL,NULL,'Scheduled',NULL,'DSCH-111826002','2026-11-18 05:33:17','2026-11-18 05:32:14',0,NULL,NULL,NULL);
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
INSERT INTO `session_end_confirmations` VALUES ('DSCH-111826001','2026-11-18','3cf1d474-ce54-45f1-bc0c-30c07003353d','2026-11-18 13:16:10');
/*!40000 ALTER TABLE `session_end_confirmations` ENABLE KEYS */;
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
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-11-18 18:41:19
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
INSERT INTO `clinic_visits` VALUES ('VISIT-111826003','02000372405','NURSE02000',NULL,NULL,'2026-11-18','18:30:00',NULL,'36.5','18','80','120/80',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'DVSCHED-111826015','Check-up');
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

-- Dump completed on 2026-11-18 18:41:20
