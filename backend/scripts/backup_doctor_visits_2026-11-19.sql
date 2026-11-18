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
INSERT INTO `consultation_request_logs` VALUES ('31ce8662-bf27-4b7c-8be1-974b60afec76','CREQ-111926001','Requested',NULL,'Waiting for Approval','Tootache','DSCH-111926001','STDNT257727','Student','Clark Ken Marcelo','2026-11-18 19:32:55'),('3759651c-07a7-48ab-99e4-2063bf349b12','CREQ-111926002','Accepted','Waiting List','Appointed','Listed automatically. Queue number #4','DSCH-111926001','STDNT345411','Student','Yahweh Bernardo','2026-11-18 19:53:10'),('46de61b7-6c6e-48fc-ba78-43bc5b6fbf29','CREQ-111926002','Fulfilled','Appointed','Fulfilled','The check-up was documented',NULL,'3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 20:10:51'),('8efdac3a-e484-467a-85eb-751408667cb6','CREQ-111926001','Withdrawn','Waiting for Approval','Withdrawn','Withdrawn by the student',NULL,'STDNT257727','Student','Clark Ken Marcelo','2026-11-18 19:51:30'),('9cf8c4e6-a7b4-4b8f-ae59-6aedac7eb3c8','CREQ-111926002','Requested',NULL,'Waiting List',NULL,'DSCH-111926001','STDNT345411','Student','Yahweh Bernardo','2026-11-18 19:53:10'),('b37862dc-0fb7-482e-b645-723c6fe08cf7','CREQ-111926002','Appointed','Waiting List','Appointed','Appointed to the session on 2026-11-19, queue number 4','DSCH-111926001','STDNT345411','Student','Yahweh Bernardo','2026-11-18 19:53:10');
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
INSERT INTO `consultation_requests` VALUES ('CREQ-111926001','02000257727','Dental',NULL,NULL,'Tootache','DOC-68eae295',NULL,'Withdrawn',0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,NULL,'2026-11-18 19:32:55','2026-11-18 19:51:30','DSCH-111926001','2026-11-19'),('CREQ-111926002','02000345411','Dental',4,NULL,'','DOC-68eae295',NULL,'Fulfilled',0,NULL,'STDNT345411','Student','Yahweh Bernardo','2026-11-18 19:53:10',NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,'DVSCHED-111926005','2026-11-18 19:53:10','2026-11-18 20:10:51','DSCH-111926001','2026-11-19');
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
INSERT INTO `doctor_appointment_logs` VALUES ('004ef34b-ffc5-41f5-8210-9ef3e958e68e','DVSCHED-111826002','Completed','Scheduled','Completed',NULL,NULL,NULL,NULL,'Check-up documented','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 15:00:29'),('06057924-3851-4556-bedd-a3388d776364','DVSCHED-111826004','Queue Skipped',NULL,NULL,NULL,NULL,NULL,NULL,'The student was not there when the number was called','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 15:36:16'),('089fbc26-b722-412d-b8f9-2e2e369b875e','DVSCHED-111926003','Completed','Scheduled','Completed',NULL,NULL,NULL,NULL,'Check-up documented','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 19:08:03'),('0de97859-51ce-4886-84a7-9d936098c8b9','DVSCHED-111826004','Queue Skipped',NULL,NULL,NULL,NULL,NULL,NULL,'The student was not there when the number was called','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 15:36:06'),('11c11dbf-a7b0-41af-b0be-cdbe3e67d9b8','DVSCHED-111826004','Queue Restored',NULL,NULL,NULL,NULL,NULL,NULL,'Went back to number #4','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 15:36:11'),('12d3bde5-e896-4854-a5ce-8bcc3fd54e22','DVSCHED-111826005','Queue Skipped',NULL,NULL,NULL,NULL,NULL,NULL,'The student was not there when the number was called','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 15:34:46'),('13502b6d-4d97-431e-adae-923256dede7b','DVSCHED-111926005','Queue Called',NULL,NULL,NULL,NULL,NULL,NULL,'Number #4 was called','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 20:10:02'),('1f7e94fa-88cb-4042-8def-c3502dea8da8','DVSCHED-111826003','Queue Called',NULL,NULL,NULL,NULL,NULL,NULL,'Number #3 was called','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 15:17:00'),('2026ee49-177d-49b8-a344-7a1a8f1754e4','DVSCHED-111826005','Queue Restored',NULL,NULL,NULL,NULL,NULL,NULL,'Went back to number #5','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 15:36:21'),('21885a88-6800-4fc3-a616-b4326cc9be65','DVSCHED-111926006','Queue Called',NULL,NULL,NULL,NULL,NULL,NULL,'Number W2 was called','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 20:27:18'),('25a0d409-b74f-4bf9-863d-db698cf5c74b','DVSCHED-111926001','Scheduled',NULL,'Scheduled',NULL,NULL,'2026-11-18 16:10:00','2026-11-18 17:59:00','Advance listing A1: queue number 1. test','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 16:08:58'),('25a64f96-57f5-4882-b3c4-e2f32d8e93e0','DVSCHED-111826005','Queue Restored',NULL,NULL,NULL,NULL,NULL,NULL,'Went back to number #5','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 15:35:34'),('2e71cd46-fbd1-4f44-9113-bca70f285598','DVSCHED-111926003','Queue Skipped',NULL,NULL,NULL,NULL,NULL,NULL,'The student was not there when the number was called','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 19:06:43'),('3002a24e-41b9-4806-b7ff-6e0cdfba89d5','DVSCHED-111826004','Queue Skipped',NULL,NULL,NULL,NULL,NULL,NULL,'The student was not there when the number was called','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 15:37:07'),('3068b42b-ac2a-4036-af99-f88334d6c942','DVSCHED-111926003','Queue Skipped',NULL,NULL,NULL,NULL,NULL,NULL,'The student was not there when the number was called','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 19:05:50'),('368c429c-62f8-4f29-833c-b167283938ce','DVSCHED-111826005','Queue Restored',NULL,NULL,NULL,NULL,NULL,NULL,'Went back to number #5','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 15:37:58'),('3f7c01b6-2ffa-4926-911a-175dcfd5c965','DVSCHED-111926003','Queue Restored',NULL,NULL,NULL,NULL,NULL,NULL,'Went back to number #3','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 19:07:15'),('433f0358-9b63-4bb3-b1bf-c6810c63be47','DVSCHED-111826004','Queue Called',NULL,NULL,NULL,NULL,NULL,NULL,'Number #4 was called','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 15:35:59'),('5039c71e-91b4-4a30-a51f-9ecc4cc5c900','DVSCHED-111826001','Scheduled',NULL,'Scheduled',NULL,NULL,'2026-11-18 14:55:00','2026-11-18 15:59:00','Advance listing A1: queue number 1. Tootache','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 14:53:05'),('515eea04-381e-407a-952b-c6d7b367e38e','DVSCHED-111826001','Completed','Scheduled','Completed',NULL,NULL,NULL,NULL,'Check-up documented','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 14:59:13'),('5318749a-d862-4517-8800-b3d63e5c1b81','DVSCHED-111926004','Queue Skipped',NULL,NULL,NULL,NULL,NULL,NULL,'The student was not there when the number was called','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 18:22:47'),('59f0a30d-d1c4-4aa6-bcdc-d350df778d06','DVSCHED-111926004','Queue Restored',NULL,NULL,NULL,NULL,NULL,NULL,'Went back to number W1','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 18:25:15'),('5cacf5a9-fc27-4a7c-aa7c-010025120987','DVSCHED-111926006','Walk-in',NULL,'Scheduled',NULL,NULL,'2026-11-18 16:10:00','2026-11-18 20:53:00','Walk-in W2: tootache','NRS02000','Nurse','Marilou Balarao','2026-11-18 20:26:47'),('5d2bdb2c-7fa0-44c1-b0b4-b77404274058','DVSCHED-111826005','Queue Skipped',NULL,NULL,NULL,NULL,NULL,NULL,'The student was not there when the number was called','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 15:36:48'),('5f33e630-4081-45e2-ba8c-5208e43372c7','DVSCHED-111826004','Queue Restored',NULL,NULL,NULL,NULL,NULL,NULL,'Went back to number #4','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 15:36:52'),('63290835-b7e4-4d05-95fb-fba9cb1b2b5d','DVSCHED-111926002','Scheduled',NULL,'Scheduled',NULL,NULL,'2026-11-18 16:10:00','2026-11-18 17:59:00','Advance listing A2: queue number 2. Test','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 16:08:58'),('6663a5e5-4c11-42ae-ab07-0bcca4929394','DVSCHED-111926001','Queue Called',NULL,NULL,NULL,NULL,NULL,NULL,'Number #1 was called','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 19:57:59'),('66954069-57e9-420d-a4ac-dac279057d05','DVSCHED-111926005','Scheduled',NULL,'Scheduled',NULL,NULL,'2026-11-18 16:10:00','2026-11-18 20:22:00','Listed by the student: queue number 4','STDNT345411','Student','Yahweh Bernardo','2026-11-18 19:53:10'),('6aaa1ec6-63b7-4f7b-84f8-fb6c1a8481eb','DVSCHED-111826004','Queue Skipped',NULL,NULL,NULL,NULL,NULL,NULL,'The student was not there when the number was called','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 15:36:56'),('6f34e8a6-d877-4ac3-b5d6-4a950d261b83','DVSCHED-111826005','Queue Skipped',NULL,NULL,NULL,NULL,NULL,NULL,'The student was not there when the number was called','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 15:35:59'),('708a57dc-36ce-4568-8800-737ed58cd7d0','DVSCHED-111926004','Completed','Scheduled','Completed',NULL,NULL,NULL,NULL,'Check-up documented','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 18:26:25'),('71feb42d-1b8e-4f01-89f2-6da852edb6f2','DVSCHED-111826002','Queue Called',NULL,NULL,NULL,NULL,NULL,NULL,'Number #2 was called','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 14:59:57'),('754c437a-f795-4506-baef-7f8e5dd03d36','DVSCHED-111826003','Completed','Scheduled','Completed',NULL,NULL,NULL,NULL,'Check-up documented','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 15:17:23'),('75fafbad-1391-48e3-add6-91368bb08169','DVSCHED-111826001','Queue Called',NULL,NULL,NULL,NULL,NULL,NULL,'Number #1 was called','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 14:57:48'),('772c1d59-ff82-48ad-9dec-ccad9186c4e5','DVSCHED-111926003','Queue Restored',NULL,NULL,NULL,NULL,NULL,NULL,'Went back to number #3','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 19:06:39'),('812f5369-dafc-49fd-ae28-471bf266d668','DVSCHED-111826004','Queue Restored',NULL,NULL,NULL,NULL,NULL,NULL,'Went back to number #4','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 15:37:00'),('89b560fc-d166-42cf-b1a0-0616894b3580','DVSCHED-111826005','Queue Called',NULL,NULL,NULL,NULL,NULL,NULL,'Number #5 was called','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 15:18:06'),('8bfa6e80-8ef7-4580-b1e7-627e3ca39a53','DVSCHED-111826002','Scheduled',NULL,'Scheduled',NULL,NULL,'2026-11-18 14:55:00','2026-11-18 15:59:00','Advance listing A2: queue number 2. Tootache','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 14:53:05'),('8eb42272-367d-4426-a10f-c9dc04cc2463','DVSCHED-111926003','Queue Skipped',NULL,NULL,NULL,NULL,NULL,NULL,'The student was not there when the number was called','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 19:07:12'),('8fbe1048-93e2-417a-80f6-c8039e4e7acf','DVSCHED-111826003','Scheduled',NULL,'Scheduled',NULL,NULL,'2026-11-18 14:55:00','2026-11-18 15:59:00','Advance listing A3: queue number 3. Test','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 14:53:06'),('92d97e19-37b3-4513-9067-48e72cfff9dc','DVSCHED-111926002','Completed','Scheduled','Completed',NULL,NULL,NULL,NULL,'Check-up documented','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 19:54:32'),('a26888f4-e05d-4eb8-b92e-4b36887b445c','DVSCHED-111926003','Scheduled',NULL,'Scheduled',NULL,NULL,'2026-11-18 16:10:00','2026-11-18 17:59:00','Advance listing A3: queue number 3. Test','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 16:08:58'),('a87573a0-1cf9-4996-a838-fc66fd04f6f4','DVSCHED-111926002','Queue Called',NULL,NULL,NULL,NULL,NULL,NULL,'Number #2 was called','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 19:54:06'),('b3f4d4ca-0107-404f-8ac7-2ed925446ec7','DVSCHED-111926003','Queue Skipped',NULL,NULL,NULL,NULL,NULL,NULL,'test','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 19:07:29'),('c46d5e19-88c0-4a22-93d8-23b56d33aa21','DVSCHED-111926001','Completed','Scheduled','Completed',NULL,NULL,NULL,NULL,'Check-up documented','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 20:03:44'),('c63fb928-3962-498d-9075-655bd3eb03cd','DVSCHED-111926004','Queue Called',NULL,NULL,NULL,NULL,NULL,NULL,'Number W1 was called','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 18:22:19'),('ca275422-f4e6-42d5-b756-185852126b7d','DVSCHED-111926004','Queue Restored',NULL,NULL,NULL,NULL,NULL,NULL,'Went back to number W1','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 18:22:39'),('d51c4a5d-36fa-4213-ac83-e81c3e331788','DVSCHED-111926005','Completed','Scheduled','Completed',NULL,NULL,NULL,NULL,'Check-up documented','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 20:10:51'),('e30a6810-1772-4ef4-8b92-dc0758d44e7c','DVSCHED-111926004','Walk-in',NULL,'Scheduled',NULL,NULL,'2026-11-18 16:10:00','2026-11-18 18:39:00','Walk-in W1: test','NRS02000','Nurse','Marilou Balarao','2026-11-18 18:11:08'),('e6bb7332-e88b-4e44-bf52-47eb955d266b','DVSCHED-111826004','Scheduled',NULL,'Scheduled',NULL,NULL,'2026-11-18 14:55:00','2026-11-18 15:59:00','Advance listing A4: queue number 4. Test','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 14:53:06'),('f140f091-3dde-481d-9bb6-5caa188a075d','DVSCHED-111926004','Queue Skipped',NULL,NULL,NULL,NULL,NULL,NULL,'The student was not there when the number was called','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 18:22:24'),('f69cf118-ca1d-455e-a9cd-354e73b6d406','DVSCHED-111926003','Queue Restored',NULL,NULL,NULL,NULL,NULL,NULL,'Went back to number #3','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 19:07:50'),('f8759ac0-354c-4968-97b4-dce43fcfd516','DVSCHED-111826005','Scheduled',NULL,'Scheduled',NULL,NULL,'2026-11-18 14:55:00','2026-11-18 15:59:00','Advance listing A5: queue number 5. Test','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 14:53:06'),('f9483859-4701-42ce-a234-04c5c2b07cbd','DVSCHED-111926006','Queue Skipped',NULL,NULL,NULL,NULL,NULL,NULL,'The student was not there when the number was called','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 20:27:38'),('fa45d4a2-5551-47e0-ac88-3927ebb1054b','DVSCHED-111926003','Queue Called',NULL,NULL,NULL,NULL,NULL,NULL,'Number #3 was called','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 19:05:46'),('fcfc29cb-780e-408f-8142-6e44dac57b34','DVSCHED-111926003','Queue Restored',NULL,NULL,NULL,NULL,NULL,NULL,'Went back to number #3','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-18 19:07:09');
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
INSERT INTO `doctor_appointment_students` VALUES ('DVSCHED-111826001','02000345411','Present','2026-11-18 14:57:41',NULL),('DVSCHED-111826002','02000257727','Present','2026-11-18 14:58:21',NULL),('DVSCHED-111826003','02000121416','Present','2026-11-18 14:58:45',NULL),('DVSCHED-111826004','02000371149','Present','2026-11-18 15:35:28',NULL),('DVSCHED-111826005','02000542435','Present','2026-11-18 15:01:25',NULL),('DVSCHED-111926001','02000001133','Present','2026-11-18 19:57:43',NULL),('DVSCHED-111926002','02000365964','Present','2026-11-18 19:53:57',NULL),('DVSCHED-111926003','0200032456','Present','2026-11-18 19:05:33',NULL),('DVSCHED-111926004','02000350927','Present','2026-11-18 18:11:08',NULL),('DVSCHED-111926005','02000345411','Present','2026-11-18 20:09:15',NULL),('DVSCHED-111926006','02000416698','Present','2026-11-18 20:26:47',NULL);
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
INSERT INTO `doctor_appointments` VALUES ('DVSCHED-111826001','DOC-68eae295',NULL,'2026-11-18 14:55:00','2026-11-18 15:59:00',NULL,'Completed','Dental Appointment','Tootache','Dental','DSCH-111826001','Doctor','Tootache',NULL,NULL,NULL,'DOC-68eae295',NULL,0,'Listed',1,'Done','2026-11-18 14:57:48',NULL,NULL),('DVSCHED-111826002','DOC-68eae295',NULL,'2026-11-18 14:55:00','2026-11-18 15:59:00',NULL,'Completed','Dental Appointment','Tootache','Dental','DSCH-111826001','Doctor','Tootache',NULL,NULL,NULL,'DOC-68eae295',NULL,0,'Listed',2,'Done','2026-11-18 14:59:57','2026-11-18 14:57:48',NULL),('DVSCHED-111826003','DOC-68eae295',NULL,'2026-11-18 14:55:00','2026-11-18 15:59:00',NULL,'Completed','Dental Appointment','Test','Dental','DSCH-111826001','Doctor','Test',NULL,NULL,NULL,'DOC-68eae295',NULL,0,'Listed',3,'Done','2026-11-18 15:17:00','2026-11-18 14:57:48',NULL),('DVSCHED-111826004','DOC-68eae295',NULL,'2026-11-18 14:55:00','2026-11-18 15:59:00',NULL,'Scheduled','Dental Appointment','Test','Dental','DSCH-111826001','Doctor','Test',NULL,NULL,NULL,'DOC-68eae295',NULL,0,'Listed',4,'Void','2026-11-18 15:37:00','2026-11-18 14:57:48','2026-11-18 15:37:07'),('DVSCHED-111826005','DOC-68eae295',NULL,'2026-11-18 14:55:00','2026-11-18 15:59:00',NULL,'Scheduled','Dental Appointment','Test','Dental','DSCH-111826001','Doctor','Test',NULL,NULL,NULL,'DOC-68eae295',NULL,0,'Listed',5,'Serving','2026-11-18 15:37:58','2026-11-18 14:59:57',NULL),('DVSCHED-111926001','DOC-68eae295',NULL,'2026-11-18 16:10:00','2026-11-18 20:22:00',NULL,'Completed','Dental Appointment','test','Dental','DSCH-111926001','Doctor','test',NULL,NULL,NULL,'DOC-68eae295',NULL,143,'Listed',1,'Done','2026-11-18 19:57:59','2026-11-18 18:22:19',NULL),('DVSCHED-111926002','DOC-68eae295',NULL,'2026-11-18 16:10:00','2026-11-18 20:22:00',NULL,'Completed','Dental Appointment','Test','Dental','DSCH-111926001','Doctor','Test',NULL,NULL,NULL,'DOC-68eae295',NULL,143,'Listed',2,'Done','2026-11-18 19:54:06','2026-11-18 18:22:19',NULL),('DVSCHED-111926003','DOC-68eae295',NULL,'2026-11-18 16:10:00','2026-11-18 19:35:00',NULL,'Completed','Dental Appointment','Test','Dental','DSCH-111926001','Doctor','Test',NULL,NULL,NULL,'DOC-68eae295',NULL,96,'Listed',3,'Done','2026-11-18 19:07:50','2026-11-18 18:22:19',NULL),('DVSCHED-111926004','DOC-68eae295',NULL,'2026-11-18 16:10:00','2026-11-18 18:39:00','NURSE02000','Completed','Dental Walk-in','test','Dental','DSCH-111926001','Walk-in','test',NULL,NULL,NULL,NULL,NULL,0,'Walk-in',1,'Done','2026-11-18 18:25:15',NULL,NULL),('DVSCHED-111926005','DOC-68eae295',NULL,'2026-11-18 16:10:00','2026-11-18 20:22:00',NULL,'Completed','Dental Appointment','Listed by the student','Dental','DSCH-111926001','Student',NULL,NULL,NULL,NULL,NULL,'CREQ-111926002',0,'Listed',4,'Done','2026-11-18 20:10:02','2026-11-18 19:54:06',NULL),('DVSCHED-111926006','DOC-68eae295',NULL,'2026-11-18 16:10:00','2026-11-18 20:53:00','NURSE02000','Scheduled','Dental Walk-in','tootache','Dental','DSCH-111926001','Walk-in','tootache',NULL,NULL,NULL,NULL,NULL,0,'Walk-in',2,'Void','2026-11-18 20:27:18',NULL,'2026-11-18 20:27:38');
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
INSERT INTO `doctor_assessments` VALUES ('DVAS-111826001','DVSCHED-111826001','02000345411','Test','Test','Test','2026-11-18 14:59:13',0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'DOC-68eae295','Tootache','Dental','Doctor','Dr. Sofia Cruz',0,NULL),('DVAS-111826002','DVSCHED-111826002','02000257727','test','test','test','2026-11-18 15:00:29',0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'DOC-68eae295','Tootache','Dental','Doctor','Dr. Sofia Cruz',0,NULL),('DVAS-111826003','DVSCHED-111826003','02000121416','','',NULL,'2026-11-18 15:17:23',0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'TPL-2e3e2c80','Dental check-up (oral health)',NULL,'DOC-68eae295','Test','Dental','Doctor','Dr. Sofia Cruz',0,NULL),('DVAS-111926001','DVSCHED-111926004','02000350927','test','test','test','2026-11-18 18:26:25',0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'DOC-68eae295','test','Dental','Doctor','Dr. Sofia Cruz',0,NULL),('DVAS-111926002','DVSCHED-111926003','0200032456','Test','Test','Test','2026-11-18 19:08:03',0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'DOC-68eae295','Test','Dental','Doctor','Dr. Sofia Cruz',0,NULL),('DVAS-111926003','DVSCHED-111926002','02000365964','Test','Test','Test','2026-11-18 19:54:31',0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'DOC-68eae295','Test','Dental','Doctor','Dr. Sofia Cruz',0,NULL),('DVAS-111926004','DVSCHED-111926001','02000001133','Test','Test','Test','2026-11-18 20:03:44',0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'DOC-68eae295','test','Dental','Doctor','Dr. Sofia Cruz',0,NULL),('DVAS-111926005','DVSCHED-111926005','02000345411','Test','Test','Test','2026-11-18 20:10:51',0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'DOC-68eae295','Tootache','Dental','Doctor','Dr. Sofia Cruz',0,NULL);
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
INSERT INTO `doctor_schedules` VALUES ('DSCH-111826001','DOC-68eae295','Dental','Once','2026-11-18',NULL,NULL,NULL,'22:55:00','23:59:00',15,1,'Clinic room',NULL,1,'Open',NULL,NULL,'2026-11-18 14:53:05','DOC-68eae295','Hybrid',NULL,0,NULL,1,1,1,15,1,'2026-11-18 22:53:06',NULL),('DSCH-111926001','DOC-68eae295','Dental','Once','2026-11-19',NULL,NULL,NULL,'00:10:00','04:53:00',15,1,'Clinic room',NULL,1,'Open',NULL,NULL,'2026-11-18 16:08:58','DOC-68eae295','Hybrid',NULL,174,'01:59:00',1,1,1,15,1,'2026-11-19 00:08:58',NULL);
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
INSERT INTO `schedule_requests` VALUES ('SCHREQ-111826001','DOC-68eae295','Dental','NURSE02000','2026-11-18',NULL,NULL,'5 student(s) in the Dental advance listing','Scheduled',NULL,'DSCH-111826001','2026-11-18 14:53:05','2026-11-18 14:50:09',1,5,NULL,NULL),('SCHREQ-111926001','DOC-68eae295','Dental','NURSE02000',NULL,NULL,NULL,'3 student(s) in the Dental advance listing','Scheduled',NULL,'DSCH-111926001','2026-11-18 16:08:58','2026-11-18 16:05:06',1,3,NULL,NULL);
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

-- Dump completed on 2026-11-19  4:32:43
