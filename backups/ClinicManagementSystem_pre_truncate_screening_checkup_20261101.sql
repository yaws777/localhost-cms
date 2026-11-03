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
-- Table structure for table `screening_schedule_participants`
--

DROP TABLE IF EXISTS `screening_schedule_participants`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `screening_schedule_participants` (
  `participant_id` varchar(45) NOT NULL,
  `screening_schedule_id` varchar(45) NOT NULL,
  `student_id` varchar(45) NOT NULL,
  `attendance_status` enum('PENDING','PRESENT','ABSENT') NOT NULL DEFAULT 'PENDING',
  `attended_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `attendance_note` varchar(255) DEFAULT NULL,
  `referral_appointment_id` char(36) DEFAULT NULL,
  PRIMARY KEY (`participant_id`),
  UNIQUE KEY `uq_participant_schedule_student` (`screening_schedule_id`,`student_id`),
  KEY `screening_schedule_id` (`screening_schedule_id`),
  KEY `student_id` (`student_id`),
  KEY `fk_participant_referral` (`referral_appointment_id`),
  CONSTRAINT `fk_participant_referral` FOREIGN KEY (`referral_appointment_id`) REFERENCES `doctor_appointments` (`appointment_id`) ON DELETE SET NULL,
  CONSTRAINT `screening_schedule_participants_ibfk_1` FOREIGN KEY (`screening_schedule_id`) REFERENCES `screening_schedules` (`screening_schedule_id`) ON DELETE CASCADE,
  CONSTRAINT `screening_schedule_participants_ibfk_2` FOREIGN KEY (`student_id`) REFERENCES `students` (`student_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `screening_schedule_participants`
--

LOCK TABLES `screening_schedule_participants` WRITE;
/*!40000 ALTER TABLE `screening_schedule_participants` DISABLE KEYS */;
INSERT INTO `screening_schedule_participants` VALUES ('04cb8fe3-e4a8-452e-b2c9-16c891357c40','HSSCHED-103026001','02000332211','ABSENT',NULL,'2026-10-30 12:51:24',NULL,NULL),('1014e1b2-3f3c-4569-b8b5-e00a7780dc7c','HSSCHED-103126001','02000250559','ABSENT',NULL,'2026-10-31 01:12:34',NULL,NULL),('1031c34c-7f77-425e-8e85-5950897562fb','HSSCHED-103126001','02000373183 ','ABSENT',NULL,'2026-10-31 01:12:34',NULL,NULL),('1500e5b9-e006-43cb-b484-a584ed65b0b6','HSSCHED-103126001','02000371918','ABSENT',NULL,'2026-10-31 01:12:34',NULL,NULL),('16a10b24-acfc-4b63-8966-7db31d7ba5f1','HSSCHED-103026001','02000338958 ','ABSENT',NULL,'2026-10-30 12:51:24',NULL,NULL),('1b1e476b-cfac-4562-9ed4-8617e2605f60','HSSCHED-103126001','02000434549 ','ABSENT',NULL,'2026-10-31 01:12:34',NULL,NULL),('232288d5-fd15-423e-aa8d-4c1767665ad5','HSSCHED-103126001','02000254206 ','ABSENT',NULL,'2026-10-31 01:12:34',NULL,NULL),('2bb70c64-5917-40e5-9b22-6bc50a885920','HSSCHED-103126001','02000257727','ABSENT',NULL,'2026-10-31 01:12:34',NULL,NULL),('2e15e7bb-aaf8-434e-ba19-db951cdcfcf8','HSSCHED-103126001','02000371149','ABSENT',NULL,'2026-10-31 01:12:34',NULL,NULL),('3183dfaa-5b1c-4b7d-b959-5a61c980b861','HSSCHED-103126001','02000354315 ','ABSENT',NULL,'2026-10-31 01:12:34',NULL,NULL),('39bdb0b9-fd4a-40d2-9602-5286359b6ff1','HSSCHED-103126001','02000350927','ABSENT',NULL,'2026-10-31 01:12:34',NULL,NULL),('3e48ee05-62cb-43be-a027-56ade99ed371','HSSCHED-103026001','02000112233','ABSENT',NULL,'2026-10-30 12:51:24',NULL,NULL),('3f83dbb7-a8cc-4d6f-8ce1-32de60cd1b9b','HSSCHED-103026001','02000325758','ABSENT',NULL,'2026-10-30 12:51:24',NULL,NULL),('3fc1cca8-ec84-48c6-a416-55828f97dadd','HSSCHED-103026001','02000250559','ABSENT',NULL,'2026-10-30 12:51:24',NULL,NULL),('3fc75263-88f7-4d5b-8120-8ba69e3d04fd','HSSCHED-103126001','02000368651','ABSENT',NULL,'2026-10-31 01:12:34',NULL,NULL),('52903475-4919-44b0-b466-417b57aa8e5b','HSSCHED-103026001','02000254206 ','ABSENT',NULL,'2026-10-30 12:51:24',NULL,NULL),('57810cd7-7d7f-4b16-8d18-a9e24e04c31a','HSSCHED-103126001','02000372405 ','ABSENT',NULL,'2026-10-31 01:12:34',NULL,NULL),('578804b8-f6d7-457e-9b95-450fda1729dd','HSSCHED-103026001','02000365964 ','ABSENT',NULL,'2026-10-30 12:51:24',NULL,NULL),('59658df6-5bf1-4774-b382-f760c9c4770a','HSSCHED-103126001','02000362937 ','ABSENT',NULL,'2026-10-31 01:12:34',NULL,NULL),('5aee0b86-a657-40de-b57d-cb649db96817','HSSCHED-103026001','02000249174 ','ABSENT',NULL,'2026-10-30 12:51:24',NULL,NULL),('697f299d-4ec9-4897-af86-baef40d486f0','HSSCHED-103026001','02000372405 ','ABSENT',NULL,'2026-10-30 12:51:24',NULL,NULL),('70d1e556-6564-462a-91d9-949902333108','HSSCHED-103026001','02000356857','ABSENT',NULL,'2026-10-30 12:51:24',NULL,NULL),('7446dd08-e7b5-488d-8852-b01984b8c929','HSSCHED-103026001','02000372990 ','ABSENT',NULL,'2026-10-30 12:51:24',NULL,NULL),('76d3926a-1768-4539-b9c9-9af1de56d5d2','HSSCHED-103126001','02000369629','ABSENT',NULL,'2026-10-31 01:12:34',NULL,NULL),('79f9c81a-f8ac-4304-8470-c1230434cbbe','HSSCHED-103026001','02000350927','ABSENT',NULL,'2026-10-30 12:51:24',NULL,NULL),('7ebc56dd-8373-4074-aaee-8bc32223a85e','HSSCHED-103126001','02000361665','ABSENT',NULL,'2026-10-31 01:12:34',NULL,NULL),('81ee614b-264b-4762-a643-8279faf31d16','HSSCHED-103026001','02000373183 ','ABSENT',NULL,'2026-10-30 12:51:24',NULL,NULL),('8b3cbb8a-b13a-4cfb-bdbb-2b6aec4387b2','HSSCHED-103126001','02000249174 ','ABSENT',NULL,'2026-10-31 01:12:34',NULL,NULL),('8c50a069-b0b9-4a2a-b881-6b80b2135a2f','HSSCHED-103026001','02000362937 ','ABSENT',NULL,'2026-10-30 12:51:24',NULL,NULL),('8d0e3e61-a7fc-4188-ab8a-5c5d047b2ff5','HSSCHED-103026001','02000374507','ABSENT',NULL,'2026-10-30 12:51:24',NULL,NULL),('8fb9a334-bffc-4ec4-b861-403a4febdd27','HSSCHED-103126001','02000338958 ','ABSENT',NULL,'2026-10-31 01:12:34',NULL,NULL),('94f01201-3fac-4e1d-81b1-46c379ebe01c','HSSCHED-103026001','02000368651','ABSENT',NULL,'2026-10-30 12:51:24',NULL,NULL),('9a56253b-153a-44a7-9962-f4b9063d0adc','HSSCHED-103026001','02000434549 ','ABSENT',NULL,'2026-10-30 12:51:24',NULL,NULL),('9b4d3f61-9213-4ed4-8f37-a2d61287f287','HSSCHED-103026001','02000371149','ABSENT',NULL,'2026-10-30 12:51:24',NULL,NULL),('9d77e3a3-3916-407d-889d-1e2153d79165','HSSCHED-103026001','02000371918','ABSENT',NULL,'2026-10-30 12:51:24',NULL,NULL),('a02724f7-9522-410d-8659-e95bfc724034','HSSCHED-103126001','02000325758','ABSENT',NULL,'2026-10-31 01:12:34',NULL,NULL),('b0210b23-537c-498b-98a8-e9a50cd5fa53','HSSCHED-103026001','02000361665','ABSENT',NULL,'2026-10-30 12:51:24',NULL,NULL),('b502a8c3-d82a-4343-ba52-41e69c35483b','HSSCHED-103126001','02000374507','PRESENT','2026-10-31 13:24:04','2026-10-31 01:12:34',NULL,NULL),('b8a66e64-62de-485e-abb5-64073e0ffd60','HSSCHED-103126001','02000332211','ABSENT',NULL,'2026-10-31 01:12:34',NULL,NULL),('ba254ab9-1172-499f-81d9-c7ff897ce32e','HSSCHED-103126001','02000272341 ','ABSENT',NULL,'2026-10-31 01:12:34',NULL,NULL),('befabb44-6556-4b00-aaf4-2359aceebcc3','HSSCHED-103026001','02000257727','ABSENT',NULL,'2026-10-30 12:51:24',NULL,NULL),('bf99fee7-209a-4f82-ad00-682ddac7c93d','HSSCHED-103126001','02000365964 ','ABSENT',NULL,'2026-10-31 01:12:34',NULL,NULL),('c0569a64-9eee-4361-a4d5-1c2b721e8f1a','HSSCHED-103126001','02000356857','ABSENT',NULL,'2026-10-31 01:12:34',NULL,NULL),('d0e07b7e-1dc1-4832-b487-6c7bf2411a22','HSSCHED-103026001','02000347082','ABSENT',NULL,'2026-10-30 12:51:24',NULL,NULL),('dac246d8-970e-4283-b1cb-f59aa7a9ab89','HSSCHED-103026001','02000369629','ABSENT',NULL,'2026-10-30 12:51:24',NULL,NULL),('ddf6f920-74f0-4b4f-8654-056bbc21a043','HSSCHED-103126001','02000347082','ABSENT',NULL,'2026-10-31 01:12:34',NULL,NULL),('e4b5b380-b380-4dcb-9840-822c59760e17','HSSCHED-103026001','02000371063','PRESENT','2026-10-30 13:47:30','2026-10-30 12:51:24',NULL,NULL),('e9d9296f-abe9-488c-9a2b-2d914c4b2b2a','HSSCHED-103126001','02000112233','ABSENT',NULL,'2026-10-31 01:12:34',NULL,NULL),('edf4f576-9e5c-428b-979c-f57fb7d346ff','HSSCHED-103126001','02000372990 ','ABSENT',NULL,'2026-10-31 01:12:34',NULL,NULL),('f0249d7e-e298-4514-9f2e-07b876f111cf','HSSCHED-103026001','02000354315 ','ABSENT',NULL,'2026-10-30 12:51:24',NULL,NULL),('fa55995a-8a22-4aa4-882c-494df65a71e7','HSSCHED-103026001','02000272341 ','ABSENT',NULL,'2026-10-30 12:51:24',NULL,NULL);
/*!40000 ALTER TABLE `screening_schedule_participants` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `screening_schedules`
--

DROP TABLE IF EXISTS `screening_schedules`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `screening_schedules` (
  `screening_schedule_id` varchar(45) NOT NULL,
  `title` varchar(150) NOT NULL,
  `target_program_id` varchar(45) DEFAULT NULL,
  `target_year_level` int DEFAULT NULL,
  `target_section` varchar(45) DEFAULT NULL,
  `scheduled_date` date NOT NULL,
  `start_time` time NOT NULL,
  `end_time` time NOT NULL,
  `announcement` text,
  `screening_type` varchar(60) DEFAULT 'BMI',
  `status` varchar(12) NOT NULL DEFAULT 'Scheduled',
  `cancelled_reason` varchar(255) DEFAULT NULL,
  `cancelled_at` timestamp NULL DEFAULT NULL,
  `makeup_of` varchar(45) DEFAULT NULL,
  `end_confirmed_at` datetime DEFAULT NULL,
  `extended_minutes` int NOT NULL DEFAULT '0',
  `original_end_time` time DEFAULT NULL,
  `school_year` varchar(9) DEFAULT NULL,
  PRIMARY KEY (`screening_schedule_id`),
  KEY `target_program_id` (`target_program_id`),
  KEY `idx_screening_school_year` (`school_year`),
  CONSTRAINT `screening_schedules_ibfk_1` FOREIGN KEY (`target_program_id`) REFERENCES `academic_programs` (`program_id`),
  CONSTRAINT `chk_screening_status` CHECK ((`status` in (_utf8mb4'Scheduled',_utf8mb4'Ongoing',_utf8mb4'Completed',_utf8mb4'Cancelled'))),
  CONSTRAINT `chk_time_order` CHECK ((`end_time` > `start_time`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `screening_schedules`
--

LOCK TABLES `screening_schedules` WRITE;
/*!40000 ALTER TABLE `screening_schedules` DISABLE KEYS */;
INSERT INTO `screening_schedules` VALUES ('HSSCHED-103026001','Annual BMI','BSIT',4,'B','2026-10-30','20:55:00','22:30:00','Bring ID','BMI','Scheduled',NULL,NULL,NULL,NULL,0,NULL,'2026-2027'),('HSSCHED-103126001','Make-up: Annual BMI','BSIT',4,'B','2026-10-31','20:55:00','23:30:00',NULL,'BMI','Scheduled',NULL,NULL,'HSSCHED-103026001',NULL,60,'22:30:00','2026-2027');
/*!40000 ALTER TABLE `screening_schedules` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `screening_custom_results`
--

DROP TABLE IF EXISTS `screening_custom_results`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `screening_custom_results` (
  `custom_record_id` varchar(45) NOT NULL,
  `student_id` varchar(45) NOT NULL,
  `screening_schedule_id` varchar(45) NOT NULL,
  `template_id` int NOT NULL,
  `answers` json NOT NULL,
  `is_abnormal` tinyint(1) NOT NULL DEFAULT '0',
  `remarks` text,
  `recorded_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`custom_record_id`),
  UNIQUE KEY `uq_custom_student_schedule` (`student_id`,`screening_schedule_id`),
  KEY `idx_custom_schedule` (`screening_schedule_id`),
  KEY `idx_custom_template` (`template_id`),
  CONSTRAINT `fk_custom_schedule` FOREIGN KEY (`screening_schedule_id`) REFERENCES `screening_schedules` (`screening_schedule_id`),
  CONSTRAINT `fk_custom_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`student_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `screening_custom_results`
--

LOCK TABLES `screening_custom_results` WRITE;
/*!40000 ALTER TABLE `screening_custom_results` DISABLE KEYS */;
/*!40000 ALTER TABLE `screening_custom_results` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `hearing_screening_records`
--

DROP TABLE IF EXISTS `hearing_screening_records`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `hearing_screening_records` (
  `hearing_record_id` varchar(45) NOT NULL,
  `student_id` varchar(45) NOT NULL,
  `screening_schedule_id` varchar(45) NOT NULL,
  `left_ear_result` varchar(10) NOT NULL COMMENT 'Pass | Refer',
  `right_ear_result` varchar(10) NOT NULL COMMENT 'Pass | Refer',
  `is_abnormal` tinyint(1) NOT NULL DEFAULT '0',
  `remarks` text,
  `recorded_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`hearing_record_id`),
  UNIQUE KEY `uq_hearing_student_schedule` (`student_id`,`screening_schedule_id`),
  KEY `idx_hearing_schedule` (`screening_schedule_id`),
  CONSTRAINT `fk_hearing_schedule` FOREIGN KEY (`screening_schedule_id`) REFERENCES `screening_schedules` (`screening_schedule_id`),
  CONSTRAINT `fk_hearing_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`student_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `hearing_screening_records`
--

LOCK TABLES `hearing_screening_records` WRITE;
/*!40000 ALTER TABLE `hearing_screening_records` DISABLE KEYS */;
/*!40000 ALTER TABLE `hearing_screening_records` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vision_screening_records`
--

DROP TABLE IF EXISTS `vision_screening_records`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vision_screening_records` (
  `vision_record_id` varchar(45) NOT NULL,
  `student_id` varchar(45) NOT NULL,
  `screening_schedule_id` varchar(45) DEFAULT NULL,
  `visual_acuity_left` varchar(10) DEFAULT NULL,
  `visual_acuity_right` varchar(10) DEFAULT NULL,
  `remarks` text,
  `recorded_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `appointment_id` char(36) DEFAULT NULL,
  `doctor_id` varchar(45) DEFAULT NULL,
  `va_left_corrected` varchar(10) DEFAULT NULL,
  `va_right_corrected` varchar(10) DEFAULT NULL,
  `wears_eyeglasses` tinyint(1) NOT NULL DEFAULT '0',
  `wears_contacts` tinyint(1) NOT NULL DEFAULT '0',
  `color_vision` varchar(20) DEFAULT NULL COMMENT 'Normal | Deficient',
  `eye_findings` text,
  `recommended_action` varchar(40) DEFAULT NULL COMMENT 'No action | Eyeglasses | Refer to ophthalmologist',
  PRIMARY KEY (`vision_record_id`),
  UNIQUE KEY `uq_vision_appt_student` (`appointment_id`,`student_id`),
  KEY `student_id` (`student_id`),
  KEY `screening_schedule_id` (`screening_schedule_id`),
  CONSTRAINT `fk_vision_appointment` FOREIGN KEY (`appointment_id`) REFERENCES `doctor_appointments` (`appointment_id`) ON DELETE CASCADE,
  CONSTRAINT `vision_screening_records_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `students` (`student_id`),
  CONSTRAINT `vision_screening_records_ibfk_2` FOREIGN KEY (`screening_schedule_id`) REFERENCES `screening_schedules` (`screening_schedule_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vision_screening_records`
--

LOCK TABLES `vision_screening_records` WRITE;
/*!40000 ALTER TABLE `vision_screening_records` DISABLE KEYS */;
/*!40000 ALTER TABLE `vision_screening_records` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `dental_assessment_records`
--

DROP TABLE IF EXISTS `dental_assessment_records`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `dental_assessment_records` (
  `dental_record_id` varchar(45) NOT NULL,
  `student_id` varchar(45) NOT NULL,
  `screening_schedule_id` varchar(45) DEFAULT NULL,
  `dental_findings` text,
  `remarks` text,
  `recorded_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `appointment_id` char(36) DEFAULT NULL,
  `doctor_id` varchar(45) DEFAULT NULL,
  `oral_hygiene` varchar(10) DEFAULT NULL COMMENT 'Good | Fair | Poor',
  `caries_count` int NOT NULL DEFAULT '0',
  `missing_count` int NOT NULL DEFAULT '0',
  `filled_count` int NOT NULL DEFAULT '0',
  `gum_condition` varchar(40) DEFAULT NULL,
  `malocclusion` tinyint(1) NOT NULL DEFAULT '0',
  `tooth_notes` text,
  `treatment_done` text,
  `treatment_needed` text,
  `referral_needed` tinyint(1) NOT NULL DEFAULT '0',
  `referral_to` varchar(120) DEFAULT NULL,
  `next_visit_recommendation` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`dental_record_id`),
  UNIQUE KEY `uq_dental_appt_student` (`appointment_id`,`student_id`),
  KEY `student_id` (`student_id`),
  KEY `screening_schedule_id` (`screening_schedule_id`),
  CONSTRAINT `dental_assessment_records_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `students` (`student_id`),
  CONSTRAINT `dental_assessment_records_ibfk_2` FOREIGN KEY (`screening_schedule_id`) REFERENCES `screening_schedules` (`screening_schedule_id`),
  CONSTRAINT `fk_dental_appointment` FOREIGN KEY (`appointment_id`) REFERENCES `doctor_appointments` (`appointment_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `dental_assessment_records`
--

LOCK TABLES `dental_assessment_records` WRITE;
/*!40000 ALTER TABLE `dental_assessment_records` DISABLE KEYS */;
/*!40000 ALTER TABLE `dental_assessment_records` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `bmi_monitoring_logs`
--

DROP TABLE IF EXISTS `bmi_monitoring_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `bmi_monitoring_logs` (
  `bmi_log_id` varchar(45) NOT NULL,
  `student_id` varchar(45) NOT NULL,
  `screening_schedule_id` varchar(45) NOT NULL,
  `height_cm` decimal(5,2) NOT NULL,
  `weight_kg` decimal(5,2) NOT NULL,
  `bmi_value` decimal(4,1) NOT NULL,
  `bmi_category` varchar(30) NOT NULL,
  `logged_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `is_abnormal` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`bmi_log_id`),
  UNIQUE KEY `uq_bmi_student_schedule` (`student_id`,`screening_schedule_id`),
  KEY `screening_schedule_id` (`screening_schedule_id`),
  CONSTRAINT `bmi_monitoring_logs_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `students` (`student_id`),
  CONSTRAINT `bmi_monitoring_logs_ibfk_2` FOREIGN KEY (`screening_schedule_id`) REFERENCES `screening_schedules` (`screening_schedule_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `bmi_monitoring_logs`
--

LOCK TABLES `bmi_monitoring_logs` WRITE;
/*!40000 ALTER TABLE `bmi_monitoring_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `bmi_monitoring_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vital_signs_records`
--

DROP TABLE IF EXISTS `vital_signs_records`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vital_signs_records` (
  `vital_record_id` varchar(45) NOT NULL,
  `student_id` varchar(45) NOT NULL,
  `screening_schedule_id` varchar(45) NOT NULL,
  `bp_systolic` smallint DEFAULT NULL,
  `bp_diastolic` smallint DEFAULT NULL,
  `pulse_rate` smallint DEFAULT NULL,
  `temperature_c` decimal(4,1) DEFAULT NULL,
  `respiratory_rate` smallint DEFAULT NULL,
  `bp_flag` varchar(10) DEFAULT NULL COMMENT 'Normal | Elevated | High | Low',
  `pulse_flag` varchar(10) DEFAULT NULL,
  `temperature_flag` varchar(10) DEFAULT NULL,
  `respiratory_flag` varchar(10) DEFAULT NULL,
  `is_abnormal` tinyint(1) NOT NULL DEFAULT '0',
  `remarks` text,
  `recorded_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`vital_record_id`),
  UNIQUE KEY `uq_vital_student_schedule` (`student_id`,`screening_schedule_id`),
  KEY `idx_vital_schedule` (`screening_schedule_id`),
  CONSTRAINT `fk_vital_schedule` FOREIGN KEY (`screening_schedule_id`) REFERENCES `screening_schedules` (`screening_schedule_id`),
  CONSTRAINT `fk_vital_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`student_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vital_signs_records`
--

LOCK TABLES `vital_signs_records` WRITE;
/*!40000 ALTER TABLE `vital_signs_records` DISABLE KEYS */;
/*!40000 ALTER TABLE `vital_signs_records` ENABLE KEYS */;
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
INSERT INTO `consultation_requests` VALUES ('CREQ-102926001','02000257727','Dental',1,NULL,'Tootache',NULL,NULL,'Withdrawn',0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,NULL,'2026-10-29 07:21:25','2026-10-29 15:23:45',NULL,NULL),('CREQ-102926002','02000347082','Dental',2,NULL,'Tootache',NULL,'Friday','Withdrawn',0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,NULL,'2026-10-29 10:33:31','2026-10-29 15:19:15',NULL,NULL),('CREQ-102926003','02000347082','General Check Up',1,NULL,'Fever for 3 days','DOC-ed638364',NULL,'Fulfilled',0,NULL,'NRS02000','Nurse','Marilou Balarao','2026-10-29 15:22:48',NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,'DVSCHED-102926003','2026-10-29 15:22:21','2026-10-29 16:43:55','DSCH-102926002','2026-10-30'),('CREQ-102926004','02000257727','General Check Up',2,NULL,'Cough for 3 days','DOC-ed638364',NULL,'Appointed',0,NULL,'NRS02000','Nurse','Marilou Balarao','2026-10-29 15:24:35',NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,'DVSCHED-103026002','2026-10-29 15:24:01','2026-10-29 17:24:58','DSCH-102926002','2026-10-30');
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
INSERT INTO `consultation_request_logs` VALUES ('0ca5b82f-e67a-4ac0-994e-2e49798ddab0','CREQ-102926002','Withdrawn','Waiting List','Withdrawn','Withdrawn by the student',NULL,'28f425bf-a7d1-470c-81db-1de9369a76cb','Student','Jay-em Batas','2026-10-29 15:19:15'),('0fb62eb8-b572-4b98-b0de-0a0a80a99812','CREQ-102926004','Appointed','Missed','Appointed','Accommodated as walk-in W2 after the skipped number','DSCH-102926002','218f3631-0689-4166-b4fb-14070c317d5f','Doctor','Dr. Alvin Ligutan','2026-10-29 17:24:58'),('10404bbc-8df5-4563-92f9-6698773a5deb','CREQ-102926003','Appointed','Waiting List','Appointed','Appointed to the session on 2026-10-30, queue number 1','DSCH-102926002','NRS02000','Nurse','Marilou Balarao','2026-10-29 15:22:48'),('1c70dd28-d31f-440c-9baa-a4f9497b1d39','CREQ-102926001','Returned to Waiting List','Appointed','Waiting List','Appointment cancelled: cancelled',NULL,'NRS02000','Nurse','Marilou Balarao','2026-10-29 15:15:46'),('3fe459a9-413c-4e86-8a7f-f48145fdac9e','CREQ-102926001','Appointed','Waiting List','Appointed','Appointed to the session on 2026-11-15, queue number 1','DSCH-102926001','NRS02000','Nurse','Marilou Balarao','2026-10-29 07:21:59'),('406fcc38-4810-4466-9968-a47b07e2f03f','CREQ-102926003','Requested',NULL,'Waiting for Approval','Fever for 3 days','DSCH-102926002','28f425bf-a7d1-470c-81db-1de9369a76cb','Student','Jay-em Batas','2026-10-29 15:22:21'),('43cdf1fb-7df1-44c4-89ce-5657e4523d15','CREQ-102926004','Appointed','Missed','Appointed','Accommodated as walk-in W1 after the skipped number','DSCH-102926002','218f3631-0689-4166-b4fb-14070c317d5f','Doctor','Dr. Alvin Ligutan','2026-10-29 16:44:37'),('5849d818-8c20-416f-a4f2-c4ffb3c7f521','CREQ-102926004','Missed','Appointed','Missed','Number W1 was skipped. The student was not there when the number was called',NULL,'218f3631-0689-4166-b4fb-14070c317d5f','Doctor','Dr. Alvin Ligutan','2026-10-29 17:24:32'),('62b98c78-0fe6-42f5-91a9-0b9cc6fa1d05','CREQ-102926003','Fulfilled','Appointed','Fulfilled','The check-up was documented',NULL,'218f3631-0689-4166-b4fb-14070c317d5f','Doctor','Dr. Alvin Ligutan','2026-10-29 16:43:55'),('856c0355-2abe-4254-a388-04519600f8b9','CREQ-102926001','Requested',NULL,'Waiting List','Waiting list number 1. Tootache',NULL,'STDNT257727','Student','Clark Ken Marcelo','2026-10-29 07:21:25'),('87e44597-e7a9-43b4-9d82-6413d5e6362c','CREQ-102926004','Requested',NULL,'Waiting for Approval','Cough for 3 days','DSCH-102926002','STDNT257727','Student','Clark Ken Marcelo','2026-10-29 15:24:01'),('8b8a8640-7462-4e84-bda2-d7d1f1e81351','CREQ-102926004','Missed','Appointed','Missed','Number #2 was skipped. not arrive',NULL,'218f3631-0689-4166-b4fb-14070c317d5f','Doctor','Dr. Alvin Ligutan','2026-10-29 16:44:34'),('8cdb72ea-5a74-4711-b404-b35da86d96a9','CREQ-102926004','Accepted','Waiting for Approval','Appointed','Listing accepted. Queue number #2','DSCH-102926002','NRS02000','Nurse','Marilou Balarao','2026-10-29 15:24:35'),('a774f2fe-48f2-4ee2-85d4-8ac79018c663','CREQ-102926003','Accepted','Waiting for Approval','Appointed','Listing accepted. Queue number #1','DSCH-102926002','NRS02000','Nurse','Marilou Balarao','2026-10-29 15:22:48'),('a8f49f1b-0887-41e9-ab41-90f48917d442','CREQ-102926002','Appointed','Waiting List','Appointed','Appointed to the session on 2026-11-15, queue number 2','DSCH-102926001','NRS02000','Nurse','Marilou Balarao','2026-10-29 10:34:02'),('c066e339-b23e-49ba-82e6-29eca4a3387d','CREQ-102926002','Returned to Waiting List','Appointed','Waiting List','Appointment cancelled: cancelled',NULL,'NRS02000','Nurse','Marilou Balarao','2026-10-29 15:15:53'),('ca41a9b8-b494-4885-83b8-efb69a885d31','CREQ-102926001','Withdrawn','Waiting List','Withdrawn','Withdrawn by the student',NULL,'STDNT257727','Student','Clark Ken Marcelo','2026-10-29 15:23:45'),('e8120202-3e5f-459f-9bb6-e82a8468f815','CREQ-102926002','Requested',NULL,'Waiting List','Waiting list number 2. Tootache',NULL,'28f425bf-a7d1-470c-81db-1de9369a76cb','Student','Jay-em Batas','2026-10-29 10:33:31'),('fff0c49a-4afa-44d0-ad30-3307dc9a0929','CREQ-102926004','Appointed','Waiting List','Appointed','Appointed to the session on 2026-10-30, queue number 2','DSCH-102926002','NRS02000','Nurse','Marilou Balarao','2026-10-29 15:24:35');
/*!40000 ALTER TABLE `consultation_request_logs` ENABLE KEYS */;
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
INSERT INTO `doctor_appointments` VALUES ('DVSCHED-102926001','DOC-68eae295',NULL,'2026-11-15 01:00:00','2026-11-15 04:00:00','NURSE02000','Cancelled','Dental Appointment','Tootache','Dental','DSCH-102926001','Nurse','Tootache','cancelled',NULL,NULL,NULL,'CREQ-102926001',0,'Listed',1,'Void',NULL,NULL),('DVSCHED-102926002','DOC-68eae295',NULL,'2026-11-15 01:00:00','2026-11-15 04:00:00','NURSE02000','Cancelled','Dental Appointment','Tootache','Dental','DSCH-102926001','Nurse','Tootache','cancelled',NULL,NULL,NULL,'CREQ-102926002',0,'Listed',2,'Void',NULL,NULL),('DVSCHED-102926003','DOC-ed638364',NULL,'2026-10-29 16:20:00','2026-10-30 07:20:00','NURSE02000','Completed','General Check Up Appointment','Fever for 3 days','General Check Up','DSCH-102926002','Nurse','Fever for 3 days',NULL,NULL,NULL,NULL,'CREQ-102926003',0,'Listed',1,'Done','2026-10-29 16:38:58',NULL),('DVSCHED-102926004','DOC-ed638364',NULL,'2026-10-29 16:20:00','2026-10-30 07:20:00','NURSE02000','Scheduled','General Check Up Appointment','Cough for 3 days','General Check Up','DSCH-102926002','Nurse','Cough for 3 days',NULL,NULL,NULL,NULL,'CREQ-102926004',0,'Listed',2,'Void','2026-10-29 16:44:10','2026-10-29 16:38:58'),('DVSCHED-103026001','DOC-ed638364',NULL,'2026-10-29 16:20:00','2026-10-30 07:20:00',NULL,'Scheduled','General Check Up Walk-in','Cough for 3 days','General Check Up','DSCH-102926002','Walk-in','Cough for 3 days',NULL,'DVSCHED-102926004',NULL,'DOC-ed638364','CREQ-102926004',0,'Walk-in',1,'Void','2026-10-29 16:45:08',NULL),('DVSCHED-103026002','DOC-ed638364',NULL,'2026-10-29 16:20:00','2026-10-30 07:20:00',NULL,'Scheduled','General Check Up Walk-in','Cough for 3 days','General Check Up','DSCH-102926002','Walk-in','Cough for 3 days',NULL,'DVSCHED-103026001',NULL,'DOC-ed638364','CREQ-102926004',0,'Walk-in',2,'Serving','2026-10-29 17:25:08',NULL),('DVSCHED-103126001','DOC-ed638364',NULL,'2026-11-01 02:00:00','2026-11-01 02:10:00',NULL,'Scheduled','Follow-up: General Check Up Appointment','Bring the lab results','Follow-up',NULL,'Doctor',NULL,NULL,'DVSCHED-102926003',NULL,'DOC-ed638364',NULL,0,NULL,NULL,NULL,NULL,NULL);
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
INSERT INTO `doctor_appointment_students` VALUES ('DVSCHED-102926001','02000257727','Pending',NULL,NULL),('DVSCHED-102926002','02000347082','Pending',NULL,NULL),('DVSCHED-102926003','02000347082','Present','2026-10-29 16:24:03',NULL),('DVSCHED-102926004','02000257727','Absent','2026-10-29 16:24:18','Skipped in the queue'),('DVSCHED-103026001','02000257727','Absent','2026-10-29 16:44:37','Skipped in the queue'),('DVSCHED-103026002','02000257727','Present','2026-10-29 17:24:58',NULL),('DVSCHED-103126001','02000347082','Absent',NULL,NULL);
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
INSERT INTO `doctor_appointment_logs` VALUES ('0f7054b2-cd6b-4a40-ad3f-699acfbf3494','DVSCHED-102926004','Queue Skipped',NULL,NULL,NULL,NULL,NULL,NULL,'not arrive','218f3631-0689-4166-b4fb-14070c317d5f','Doctor','Dr. Alvin Ligutan','2026-10-29 16:44:34'),('0fd88c5b-93ec-4257-92f0-20ecc23a5e29','DVSCHED-102926004','Scheduled',NULL,'Scheduled',NULL,NULL,'2026-10-30 00:00:00','2026-10-30 09:00:00','Listing accepted: queue number 2. Cough for 3 days','NRS02000','Nurse','Marilou Balarao','2026-10-29 15:24:35'),('14364c66-c4e7-4d31-8c11-a9760d6cbadb','DVSCHED-102926003','Completed','Scheduled','Completed',NULL,NULL,NULL,NULL,'Check-up documented','218f3631-0689-4166-b4fb-14070c317d5f','Doctor','Dr. Alvin Ligutan','2026-10-29 16:43:55'),('189c9f75-7bf2-428e-9b06-1ade662feb40','DVSCHED-103026001','Accommodated',NULL,'Scheduled',NULL,NULL,'2026-10-29 16:20:00','2026-10-30 07:20:00','Accommodated as a walk-in W1: Cough for 3 days','218f3631-0689-4166-b4fb-14070c317d5f','Doctor','Dr. Alvin Ligutan','2026-10-29 16:44:37'),('18d983de-6d4a-4c27-b77d-2c036681a4b7','DVSCHED-102926002','Scheduled',NULL,'Scheduled',NULL,NULL,'2026-11-15 01:00:00','2026-11-15 04:00:00','Appointed from the waiting list: queue number 2. Tootache','NRS02000','Nurse','Marilou Balarao','2026-10-29 10:34:02'),('1bc7e513-fcca-4f47-8f01-0e6bec93f0ee','DVSCHED-102926003','Queue Called',NULL,NULL,NULL,NULL,NULL,NULL,'Number #1 was called','218f3631-0689-4166-b4fb-14070c317d5f','Doctor','Dr. Alvin Ligutan','2026-10-29 16:38:58'),('2599f87f-954e-462e-acea-569ee2b39fc7','DVSCHED-103126001','Scheduled',NULL,'Scheduled',NULL,NULL,'2026-11-01 02:00:00','2026-11-01 02:10:00','Bring the lab results','218f3631-0689-4166-b4fb-14070c317d5f','Doctor','Dr. Alvin Ligutan','2026-10-31 10:20:44'),('3a3a632d-c0df-4fc7-b466-aaca2300128a','DVSCHED-103026001','Queue Called',NULL,NULL,NULL,NULL,NULL,NULL,'Number W1 was called','218f3631-0689-4166-b4fb-14070c317d5f','Doctor','Dr. Alvin Ligutan','2026-10-29 16:45:08'),('431cf737-4546-4292-aa6f-8b8e656d4375','DVSCHED-102926004','Rescheduled','Scheduled','Scheduled','2026-10-30 00:00:00','2026-10-30 09:00:00','2026-10-29 16:20:00','2026-10-30 07:20:00','The doctor moved the session: availability','218f3631-0689-4166-b4fb-14070c317d5f','Doctor','Dr. Alvin Ligutan','2026-10-29 16:01:45'),('473c5a7b-617a-4df5-872f-6ac8ec36897f','DVSCHED-103026001','Queue Skipped',NULL,NULL,NULL,NULL,NULL,NULL,'The student was not there when the number was called','218f3631-0689-4166-b4fb-14070c317d5f','Doctor','Dr. Alvin Ligutan','2026-10-29 17:24:32'),('79da1fad-f15f-4410-9f2e-f8fa0161ef8f','DVSCHED-103026002','Accommodated',NULL,'Scheduled',NULL,NULL,'2026-10-29 16:20:00','2026-10-30 07:20:00','Accommodated as a walk-in W2: Cough for 3 days','218f3631-0689-4166-b4fb-14070c317d5f','Doctor','Dr. Alvin Ligutan','2026-10-29 17:24:58'),('96d68920-8010-40f5-ad7e-90752ec4ca68','DVSCHED-102926003','Rescheduled','Scheduled','Scheduled','2026-10-30 00:00:00','2026-10-30 09:00:00','2026-10-29 16:20:00','2026-10-30 07:20:00','The doctor moved the session: availability','218f3631-0689-4166-b4fb-14070c317d5f','Doctor','Dr. Alvin Ligutan','2026-10-29 16:01:45'),('bda11d38-840c-495f-9e64-b376d9dcee5c','DVSCHED-102926002','Cancelled','Scheduled','Cancelled','2026-11-15 01:00:00','2026-11-15 04:00:00',NULL,NULL,'cancelled','NRS02000','Nurse','Marilou Balarao','2026-10-29 15:15:53'),('c5c5a270-35bc-4365-82b1-460424f1d4fc','DVSCHED-102926004','Queue Called',NULL,NULL,NULL,NULL,NULL,NULL,'Number #2 was called','218f3631-0689-4166-b4fb-14070c317d5f','Doctor','Dr. Alvin Ligutan','2026-10-29 16:44:10'),('cca90323-6e04-44d3-86e6-83b6bf770594','DVSCHED-102926003','Scheduled',NULL,'Scheduled',NULL,NULL,'2026-10-30 00:00:00','2026-10-30 09:00:00','Listing accepted: queue number 1. Fever for 3 days','NRS02000','Nurse','Marilou Balarao','2026-10-29 15:22:48'),('d2381f41-7673-4a35-a1b2-4b9f232367c7','DVSCHED-103026002','Queue Called',NULL,NULL,NULL,NULL,NULL,NULL,'Number W2 was called','218f3631-0689-4166-b4fb-14070c317d5f','Doctor','Dr. Alvin Ligutan','2026-10-29 17:25:08'),('dc974f4a-b6dc-4cd8-8b86-d4ff0d6e4af7','DVSCHED-102926001','Cancelled','Scheduled','Cancelled','2026-11-15 01:00:00','2026-11-15 04:00:00',NULL,NULL,'cancelled','NRS02000','Nurse','Marilou Balarao','2026-10-29 15:15:45'),('f845b9cc-5f84-4d84-9f69-a5de38ba1b6e','DVSCHED-102926001','Scheduled',NULL,'Scheduled',NULL,NULL,'2026-11-15 01:00:00','2026-11-15 04:00:00','Appointed from the waiting list: queue number 1. Tootache','NRS02000','Nurse','Marilou Balarao','2026-10-29 07:21:59');
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
INSERT INTO `doctor_assessments` VALUES ('DVAS-103026001','DVSCHED-102926003','02000347082','elevated body temperature of 38.5°C, inflamed throat, fatigue','Fever','rest, hydration, paracetamol 500mg every 6 hours','2026-10-29 16:43:55',0,1,NULL,NULL,NULL,NULL,NULL,'[{\"dosage\": \"1\", \"duration\": \"3 Days\", \"medicine\": \"Paracetamol\", \"frequency\": \"6\", \"instructions\": \"After  Meal\"}]',NULL,NULL,NULL,NULL,NULL,'DOC-ed638364','Fever for 3 days','General Check Up','Doctor','Dr. Alvin Ligutan',0,NULL);
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
INSERT INTO `doctor_schedules` VALUES ('DSCH-102926001','DOC-68eae295','Dental','Once','2026-11-15',NULL,NULL,NULL,'09:00:00','12:00:00',15,1,'Clinic room',NULL,1,'Open',NULL,NULL,'2026-10-29 07:20:13','DOC-68eae295','Hybrid',NULL,0,NULL,1,1,1,NULL,1,'2026-10-31 22:19:59'),('DSCH-102926002','DOC-ed638364','General Check Up','Once','2026-10-30',NULL,NULL,NULL,'00:20:00','15:20:00',10,1,'Clinic room','Bring Student ID',1,'Open',NULL,NULL,'2026-10-29 15:18:47','DOC-ed638364','Hybrid','Bring Student ID',0,NULL,1,1,1,50,1,'2026-10-29 23:20:52');
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
INSERT INTO `schedule_requests` VALUES ('SCHREQ-102926001','DOC-68eae295','Dental','NURSE02000','2026-10-31',NULL,NULL,NULL,'Scheduled',NULL,'DSCH-102926001','2026-10-29 07:20:13','2026-10-29 07:16:57'),('SCHREQ-102926002','DOC-ed638364','General Check Up','NURSE02000','2026-10-30','08:00:00','17:00:00','10 student waiting','Scheduled',NULL,'DSCH-102926002','2026-10-29 15:18:47','2026-10-29 15:17:53');
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
INSERT INTO `session_end_confirmations` VALUES ('DSCH-102926002','2026-10-30','NRS02000','2026-10-30 22:00:59');
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
INSERT INTO `queue_counters` VALUES ('Dental',2);
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
-- Table structure for table `consultation_service_listing`
--

DROP TABLE IF EXISTS `consultation_service_listing`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `consultation_service_listing` (
  `visit_type` varchar(30) NOT NULL,
  `listing_open` tinyint(1) NOT NULL DEFAULT '1' COMMENT '0 = the nurse closed the listing: students cannot ask for this service',
  `listing_limit` int DEFAULT NULL COMMENT 'most accepted listings at once; NULL = no limit',
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`visit_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `consultation_service_listing`
--

LOCK TABLES `consultation_service_listing` WRITE;
/*!40000 ALTER TABLE `consultation_service_listing` DISABLE KEYS */;
/*!40000 ALTER TABLE `consultation_service_listing` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-11-01 14:14:54
