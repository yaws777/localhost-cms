-- MySQL dump 10.13  Distrib 8.0.44, for Win64 (x86_64)
--
-- Host: localhost    Database: clinicmanagementsystem
-- ------------------------------------------------------
-- Server version	8.0.44

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `academic_programs`
--

DROP TABLE IF EXISTS `academic_programs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `academic_programs` (
  `program_id` varchar(45) NOT NULL,
  `program_name` varchar(100) NOT NULL,
  `type` varchar(20) NOT NULL,
  PRIMARY KEY (`program_id`),
  CONSTRAINT `academic_programs_chk_1` CHECK ((`type` in (_utf8mb4'Course',_utf8mb4'Strand')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `academic_programs`
--

LOCK TABLES `academic_programs` WRITE;
/*!40000 ALTER TABLE `academic_programs` DISABLE KEYS */;
INSERT INTO `academic_programs` VALUES ('ABM','Accountancy, Business & Management','Strand'),('BSBA','Bachelor of Science in Business Administration','Course'),('BSHM','Bachelor of Science in Hospitality Management','Course'),('BSIT','Bachelor of Science in Information Technology','Course'),('BSTM','Bachelor of Science in Tourism Management','Course'),('CULINARY','Culinary Arts','Strand'),('ICT/MAWD','Information & Communication Technology / Mobile App & Website Development ','Strand'),('TM','Tourism Management','Strand');
/*!40000 ALTER TABLE `academic_programs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `admin`
--

DROP TABLE IF EXISTS `admin`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `admin` (
  `admin_id` varchar(45) NOT NULL DEFAULT (uuid()),
  `user_id` varchar(45) NOT NULL,
  `first_name` varchar(255) NOT NULL,
  `last_name` varchar(255) NOT NULL,
  PRIMARY KEY (`admin_id`),
  UNIQUE KEY `user_id` (`user_id`),
  CONSTRAINT `fk_admin_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `admin`
--

LOCK TABLES `admin` WRITE;
/*!40000 ALTER TABLE `admin` DISABLE KEYS */;
INSERT INTO `admin` VALUES ('ADMIN02000','ADMN02000','STI','Admin');
/*!40000 ALTER TABLE `admin` ENABLE KEYS */;
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
  PRIMARY KEY (`bmi_log_id`),
  KEY `student_id` (`student_id`),
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
-- Table structure for table `chief_complaints`
--

DROP TABLE IF EXISTS `chief_complaints`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `chief_complaints` (
  `complaint_id` varchar(45) NOT NULL,
  `complaint_name` varchar(150) NOT NULL,
  PRIMARY KEY (`complaint_id`),
  UNIQUE KEY `complaint_name` (`complaint_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `chief_complaints`
--

LOCK TABLES `chief_complaints` WRITE;
/*!40000 ALTER TABLE `chief_complaints` DISABLE KEYS */;
INSERT INTO `chief_complaints` VALUES ('ASTHMAATTACK02000','Asthma Attack'),('BODYPAIN02000','Body Pain'),('COUGH02000','Cough'),('DIFFICULTYOFBREATHING02000','Difficulty of Breathing'),('DIZZINESS02000','Dizziness'),('FEVER02000','Fever'),('LBM02000','Gastrointestinal Issues'),('HEADACHE02000','Headache'),('HEARTBURN02000','Heartburn'),('HIGHBLOOD02000','High Blood'),('INJURY02000','Injury'),('LOSTCONSIOUSNESS02000','Lost Consciousness'),('MENSTRUALCRAMPS02000','Menstrual Cramps '),('NAUSEA02000','Nausea/Vomiting'),('OTHERS02000','Others'),('RUNNYNOSE02000','Runny Nose'),('SORETHROAT02000','Sore Throat'),('TOOTHACHES02000','Tootaches');
/*!40000 ALTER TABLE `chief_complaints` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `clinic_visits`
--

DROP TABLE IF EXISTS `clinic_visits`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `clinic_visits` (
  `visit_id` varchar(45) NOT NULL,
  `student_id` varchar(45) NOT NULL,
  `nurse_id` varchar(45) NOT NULL,
  `complaint_id` varchar(45) DEFAULT NULL,
  `specify_complaint_text` text,
  `visit_date` date DEFAULT NULL,
  `time_in` time DEFAULT NULL,
  `time_out` time DEFAULT NULL,
  `temperature` varchar(45) DEFAULT NULL,
  `respiratory_rate` varchar(45) DEFAULT NULL,
  `pulse_rate` varchar(45) DEFAULT NULL,
  `blood_pressure` varchar(45) DEFAULT NULL,
  `nursing_intervention` text,
  `recommendations` text,
  PRIMARY KEY (`visit_id`),
  KEY `student_id` (`student_id`),
  KEY `nurse_id` (`nurse_id`),
  KEY `clinic_visits_ibfk_3_idx` (`complaint_id`),
  CONSTRAINT `clinic_visits_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `students` (`student_id`),
  CONSTRAINT `clinic_visits_ibfk_2` FOREIGN KEY (`nurse_id`) REFERENCES `nurses` (`nurse_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `clinic_visits`
--

LOCK TABLES `clinic_visits` WRITE;
/*!40000 ALTER TABLE `clinic_visits` DISABLE KEYS */;
INSERT INTO `clinic_visits` VALUES ('VISIT-023E9Z0NH','02000345411','NURSE02000','HEADACHE02000',NULL,'2026-08-21','22:21:00',NULL,'36.5','18','72','120/80','Give Paracetamol','Take Rest'),('VISIT-03KBJCDC9','02000345411','NURSE02000','HEADACHE02000',NULL,'2026-08-21','23:12:00',NULL,'36.5','18','72','120/80','Give Katinko Spray','Take rest'),('VISIT-0AGJWHWFL','02000257727','NURSE02000',NULL,NULL,'2026-09-22','21:40:00','23:23:00',NULL,NULL,NULL,NULL,NULL,NULL),('VISIT-1RYZY5358','02000371918','NURSE02000','ASTHMAATTACK02000',NULL,'2026-09-18','17:19:00',NULL,'35.0','17','70','120/80','pahinga','take care'),('VISIT-1SVJZ1E7P','02000345411','NURSE02000','HEADACHE02000',NULL,'2026-07-31','13:40:00',NULL,'37.50','18','72','120/80','Given Rest','Take Rest'),('VISIT-1Z12SX2HK','02000345411','NURSE02000','FEVER02000',NULL,'2026-07-21','15:13:00','15:15:00','40','18','72','120/80','Given rest','Take Rest'),('VISIT-2FVAAYV12','02000257727','NURSE02000',NULL,NULL,'2026-09-23','20:18:00',NULL,NULL,NULL,NULL,NULL,NULL,NULL),('VISIT-2L15EXLAT','02000345411','NURSE02000','HEADACHE02000',NULL,'2026-09-22','09:52:00','09:59:00','36.5','18','72','120/80','Give Medicine','Take rest '),('VISIT-3G0Z6E5AM','02000345411','NURSE02000','HEADACHE02000',NULL,'2026-09-17','13:05:00','13:16:00','36.5','18','72','120/80','Give Rest','Take a rest'),('VISIT-465J66XGU','02000345411','NURSE02000','HEADACHE02000',NULL,'2026-07-31','13:31:00',NULL,'36.5','18','72','120/80','Given Rest','Take Rest '),('VISIT-47910UN2E','02000257727','NURSE02000','OTHERS02000',NULL,'2026-09-24','19:09:00','19:10:00','36.5','15','72','120/80','Give Medicine ','Take Rest'),('VISIT-52P218VAQ','02000345411','NURSE02000','HEADACHE02000',NULL,'2026-08-21','22:21:00',NULL,'36.5','18','72','120/80','Give Paracetamol','Take Rest'),('VISIT-55COWA0JB','02000345411','NURSE02000','HEADACHE02000',NULL,'2026-09-15','22:27:00',NULL,'36.5','18','72','120/80','Give Medicine ','Take a rest'),('VISIT-5PY3PHBPD','02000120504','NURSE02000','HEADACHE02000',NULL,'2026-07-14','12:08:00','14:45:00','36.6','16','72','118/76','Allowed rest in a dimmed clinic room, applied cold compress.','Take Rest, limit screen time, and stay hydrated.'),('VISIT-6FH3CGYSG','02000257727','NURSE02000','OTHERS02000',NULL,'2026-09-24','18:53:00','18:53:00','36.5','18','72','120/80','Give Medicine ','Take Rest'),('VISIT-6N3K3MYW8','02000345411','NURSE02000',NULL,NULL,'2026-09-22','10:01:00','10:05:00',NULL,NULL,NULL,NULL,NULL,NULL),('VISIT-70DK14HLO','02000345411','NURSE02000','INSECTBITES02000',NULL,'2026-09-17','13:16:00','17:07:00','36.5','18','72','120/80','Give a rest','Take Rest'),('VISIT-8B69QBA9C','02000345411','NURSE02000','HEADACHE02000',NULL,'2026-08-21','22:26:00',NULL,'36.5','18','72','120/80','Give Paracetamol','Take Rest'),('VISIT-8DTIOBUZJ','02000257727','NURSE02000','HEADACHE02000',NULL,'2026-09-21','19:43:00','20:14:00','36.5','15','72','120/80','Give Medicine','Take Rest'),('VISIT-8XEMJ47FP','02000345411','NURSE02000','HEADACHE02000',NULL,'2026-07-31','13:35:00',NULL,'36.5','18','72','120/80','Given Rest','Take Rest'),('VISIT-A0CK6Z0OA','02000257727','NURSE02000','DIZZINESS02000',NULL,'2026-08-08','10:04:00',NULL,'40.5','20','80','120/80','Given rest','Take a rest'),('VISIT-A1X2Y3Z4A','02000001133','NURSE02000','FEVER02000',NULL,'2025-01-15','08:30:00','09:00:00','38.5','19','85','110/70','Paracetamol administered.','Hydrate and rest.'),('VISIT-A4KEQVXZK','02000257727','NURSE02000',NULL,NULL,'2026-09-22','18:49:00','18:49:00',NULL,NULL,NULL,NULL,NULL,NULL),('VISIT-A7Y8Z9W0A','02000120504','NURSE02000','FEVER02000',NULL,'2026-02-11','14:00:00','14:30:00','38.1','18','80','115/72','Cold compress applied.','Keep hydrated.'),('VISIT-AKYGU7SKU','02000345411','NURSE02000','INSECTBITES02000',NULL,'2026-09-17','17:07:00','17:14:00','36.5','18','72','120/80','Give rest ','Take a rest'),('VISIT-AM9YQW2RR','02000257727','NURSE02000','OTHERS02000',NULL,'2026-09-24','16:59:00','18:50:00','36.5','13','72','120/80','Give Medicine ','Take Rest'),('VISIT-AUYK097FX','02000565656','NURSE02000','HEADACHE02000',NULL,'2026-09-03','23:56:00',NULL,'36.5','18','72','120/80','Given Medicine','Take Rest'),('VISIT-AWARQ3MQR','02000345411','NURSE02000',NULL,NULL,'2026-09-11','23:38:00','23:39:00',NULL,NULL,NULL,NULL,NULL,NULL),('VISIT-AWK8HCUZN','02000345411','NURSE02000','FEVER02000',NULL,'2026-07-21','15:11:00','15:11:00','40','18','72','120/80','Given Rest','Take Rest'),('VISIT-B2X3Y4Z5B','02000120504','NURSE02000','FEVER02000',NULL,'2025-03-14','09:15:00','09:45:00','38.2','20','82','120/80','Paracetamol given, cold towel on forehead.','Rest.'),('VISIT-B8Y9Z0W1B','02000345411','NURSE02000','FEVER02000',NULL,'2026-03-05','09:15:00','09:45:00','38.5','20','88','120/80','Paracetamol given.','Sent home.'),('VISIT-BCAZV1J75','02000345411','NURSE02000','HEADACHE02000',NULL,'2026-07-30','18:13:00',NULL,'40.0','18','72','120/80','Given rest','Take rest'),('VISIT-BPEH5J9QO','02000001133','NURSE02000','FEVER02000',NULL,'2026-07-14','22:07:00','22:15:00','38.6','18','88','110/70','Administered Paracetamol as prescribed, cold compress applied.','Magpahinga (Rest), drink plenty of water, and monitor temperature.'),('VISIT-C3A02J5JX','02000345411','NURSE02000','COUGH02000',NULL,'2026-09-23','08:46:00','09:00:00','40','20','77','129/80','advil','rest'),('VISIT-C3X4Y5Z6C','02000345411','NURSE02000','FEVER02000',NULL,'2025-05-22','10:00:00','10:30:00','38.9','21','90','115/75','Monitored vitals, Paracetamol given.','Advised doctor visit if fever persists.'),('VISIT-C7K3D51UD','02000345411','NURSE02000','HEADACHE02000',NULL,'2026-08-21','23:36:00',NULL,'36.5','18','72','120/80','Give Katinko','Take Rest'),('VISIT-C7YER103K','02000257727','NURSE02000','HEADACHE02000',NULL,'2026-09-22','10:05:00','10:10:00','36.5','14','72','120/80','Give Medicine ','Take Rest'),('VISIT-C9Y0Z1W2C','02000001133','NURSE02000','FEVER02000',NULL,'2026-04-18','11:30:00','12:00:00','38.3','19','82','112/75','Monitored vitals.','Rest.'),('VISIT-CYJ5QJE67','02000565656','NURSE02000','HEADACHE02000',NULL,'2026-09-03','00:00:00',NULL,'36.5','18','30','120/80','Given a rest','Take a rest'),('VISIT-D0Y1Z2W3D','02000120504','NURSE02000','FEVER02000',NULL,'2026-05-22','13:00:00','13:30:00','38.4','20','86','115/70','Cold compress applied.','Drink plenty of water.'),('VISIT-D4X5Y6Z7D','02000001133','NURSE02000','FEVER02000',NULL,'2025-08-10','13:00:00','13:30:00','38.4','18','84','110/70','Cold compress applied.','Sent home to rest.'),('VISIT-D8EQS4EBU','02000257727','NURSE02000',NULL,NULL,'2026-09-22','23:42:00',NULL,NULL,NULL,NULL,NULL,NULL,NULL),('VISIT-DARE21X7P','02000257727','NURSE02000',NULL,NULL,'2026-09-18','03:02:00',NULL,NULL,NULL,NULL,NULL,NULL,NULL),('VISIT-DF0VPL867','02000345411','NURSE02000',NULL,NULL,'2026-09-12','14:40:00',NULL,NULL,NULL,NULL,NULL,NULL,NULL),('VISIT-DI4TBD4RW','02000257727','NURSE02000',NULL,NULL,'2026-09-23','08:44:00','08:45:00',NULL,NULL,NULL,NULL,NULL,NULL),('VISIT-DOKNBIX7G','02000345411','NURSE02000',NULL,NULL,'2026-09-11','23:47:00','23:48:00',NULL,NULL,NULL,NULL,NULL,NULL),('VISIT-E1Y2Z3W4E','02000345411','NURSE02000','FEVER02000',NULL,'2026-06-10','10:30:00','11:00:00','38.3','21','85','118/78','Paracetamol given.','Rest in clinic.'),('VISIT-E5X6Y7Z8E','02000120504','NURSE02000','FEVER02000',NULL,'2025-10-18','11:00:00','11:30:00','38.1','19','80','118/72','Paracetamol given.','Drink fluids.'),('VISIT-F2Y3Z4W5F','02000001133','NURSE02000','HEADACHE02000',NULL,'2026-01-08','09:00:00','09:30:00','36.5','16','71','110/70','Clinic rest in quiet room.','Hydrate and rest eyes.'),('VISIT-F61OCNWUJ','02000257727','NURSE02000',NULL,NULL,'2026-09-21','20:23:00','01:19:00',NULL,NULL,NULL,NULL,NULL,NULL),('VISIT-F6X7Y8Z9F','02000345411','NURSE02000','FEVER02000',NULL,'2025-12-12','10:30:00','11:00:00','38.7','22','89','115/70','Paracetamol given.','Sent home with guardian.'),('VISIT-FDQF7C4HJ','02000257727','NURSE02000','HEADACHE02000',NULL,'2026-09-22','12:22:00','12:28:00','36.5','18','72','120/80','Give Medicine ','Take Rest'),('VISIT-G3Y4Z5W6G','02000120504','NURSE02000','HEADACHE02000',NULL,'2026-02-15','13:30:00','14:00:00','36.6','17','73','120/80','Ice pack applied.','Limit screen time.'),('VISIT-G7X8Y9Z0G','02000345411','NURSE02000','COUGH02000',NULL,'2025-02-10','08:00:00','08:30:00','36.8','16','72','110/70','Throat lozenges offered.','Wear a face mask.'),('VISIT-GEA1RZMJ8','02000120504','NURSE02000','DIFFICULTYOFBREATHING02000',NULL,'2026-07-16','15:18:00','15:21:00','36.5','24','92','120/80','Assisted to a semi-Fowler position, loosened tight clothes, guided deep breathing.','Take rest at home, avoid physical exertion, and seek medical help if it persists.'),('VISIT-GQJ0JZXXF','02000257727','NURSE02000','OTHERS02000','Toothless','2026-09-24','21:35:00','21:37:00','36.5','18','72','120/80','Give Medicine','Take Rest'),('VISIT-H4Y5Z6W7H','02000345411','NURSE02000','HEADACHE02000',NULL,'2026-03-29','08:45:00','09:15:00','36.6','16','72','118/76','Rested.','Hydrate.'),('VISIT-H8X9Y0Z1H','02000001133','NURSE02000','COUGH02000',NULL,'2025-06-20','09:00:00','09:30:00','36.7','17','74','115/75','Provided disposable face mask.','Drink warm fluids.'),('VISIT-I5Y6Z7W8I','02000001133','NURSE02000','HEADACHE02000',NULL,'2026-04-15','10:30:00','11:00:00','36.5','16','70','110/70','Rested in clinic.','Rest.'),('VISIT-I9X0Y1Z2I','02000120504','NURSE02000','COUGH02000',NULL,'2025-08-15','14:00:00','14:30:00','37.0','18','75','112/70','Lozenges offered, warm water given.','Avoid cold drinks.'),('VISIT-ITK0S9OIJ','02000345411','NURSE02000','HEADACHE02000',NULL,'2026-09-15','20:24:00','22:09:00','36.5','18','72','120/80','Give Medicine','Take a rest'),('VISIT-J0X1Y2Z3J','02000345411','NURSE02000','COUGH02000',NULL,'2025-11-05','10:00:00','10:30:00','36.9','16','73','120/80','Warm fluids advised.','Keep warm.'),('VISIT-J6Y7Z8W9J','02000120504','NURSE02000','HEADACHE02000',NULL,'2026-05-28','14:00:00','14:30:00','36.7','18','75','115/75','Cold patch applied.','Check eyesight if frequent.'),('VISIT-K1X2Y3Z4K','02000001133','NURSE02000','HEADACHE02000',NULL,'2025-04-05','11:00:00','11:30:00','36.5','16','70','110/70','Allowed rest in a quiet, dark room.','Advised resting eyes and drinking water.'),('VISIT-K7G5206FO','02000257727','NURSE02000','OTHERS02000',NULL,'2026-09-24','18:58:00','18:59:00','36.5','18','72','120/80','Give Medicine','Take Medicine'),('VISIT-K7Y8Z9W0K','02000345411','NURSE02000','HEADACHE02000',NULL,'2026-06-20','15:00:00','15:30:00','36.7','17','73','116/78','Clinic rest.','Sleep early.'),('VISIT-L2X3Y4Z5L','02000120504','NURSE02000','HEADACHE02000',NULL,'2025-07-12','13:30:00','14:00:00','36.6','17','74','120/80','Applied ice pack to forehead.','Limit screen time.'),('VISIT-L8Y9Z0W1L','02000001133','NURSE02000','LBM02000',NULL,'2026-02-05','10:00:00','10:30:00','36.6','18','74','110/70','Warm compress, restroom access.','Avoid greasy food.'),('VISIT-M3X4Y5Z6M','02000345411','NURSE02000','HEADACHE02000',NULL,'2025-10-18','09:15:00','09:45:00','36.4','15','71','115/75','Rested in clinic.','Drink more fluids.'),('VISIT-M9Y0Z1W2M','02000120504','NURSE02000','LBM02000',NULL,'2026-04-12','14:30:00','15:00:00','36.8','17','72','115/75','Provided restroom assistance, hydrate.','Drink warm fluids.'),('VISIT-MEFD2Z2YI','02000345411','NURSE02000',NULL,NULL,'2026-09-22','23:42:00',NULL,NULL,NULL,NULL,NULL,NULL,NULL),('VISIT-MJGE2A7MU','02000257727','NURSE02000','HEADACHE02000',NULL,'2026-09-21','20:23:00','20:24:00','36.5','18','72','120/80','Give Medicine ','Take Rest'),('VISIT-MTMC0TSZV','02000350927','NURSE02000',NULL,NULL,'2026-09-12','13:05:00','13:06:00',NULL,NULL,NULL,NULL,NULL,NULL),('VISIT-N0Y1Z2W3N','02000345411','NURSE02000','LBM02000',NULL,'2026-06-15','11:00:00','11:30:00','36.7','18','73','112/72','Hydration pack provided.','Rest.'),('VISIT-N4X5Y6Z7N','02000001133','NURSE02000','COUGH02000',NULL,'2026-01-10','09:00:00','09:30:00','36.8','17','73','110/70','Warm water given.','Wear mask.'),('VISIT-N8Q7E70U2','02000345411','NURSE02000','HEADACHE02000',NULL,'2026-08-21','23:38:00',NULL,'36.5','18','72','120/80','Give Katinko','Take Rest '),('VISIT-O1Y2Z3W4O','02000001133','NURSE02000','RUNNYNOSE02000',NULL,'2026-01-20','09:00:00','09:30:00','36.8','18','74','110/70','Tissues & mask.','Wash hands often.'),('VISIT-O5X6Y7Z8O','02000120504','NURSE02000','COUGH02000',NULL,'2026-01-28','14:00:00','14:30:00','37.1','18','75','120/80','Lozenges offered.','Rest.'),('VISIT-OQSBG87SA','02000345411','NURSE02000','FEVER02000',NULL,'2026-07-29','16:28:00',NULL,'40.00','18','72','120/80','Given Rest','Take Rest'),('VISIT-OWHJFJY3U','02000257727','NURSE02000',NULL,NULL,'2026-09-22','18:47:00','18:48:00',NULL,NULL,NULL,NULL,NULL,NULL),('VISIT-P2Y3Z4W5P','02000120504','NURSE02000','RUNNYNOSE02000',NULL,'2026-02-15','11:00:00','11:30:00','36.9','17','72','115/75','Provided face mask.','Rest.'),('VISIT-P6X7Y8Z9P','02000345411','NURSE02000','COUGH02000',NULL,'2026-02-14','11:00:00','11:30:00','36.9','16','72','115/75','Mask given.','Drink warm fluids.'),('VISIT-PBO32WFOL','02000345411','NURSE02000','HEADACHE02000',NULL,'2026-07-29','16:17:00',NULL,'36.5','18','72','120/80','Given Rest','Take Rest'),('VISIT-PP8GBW5PH','02000120504','NURSE02000','HEADACHE02000',NULL,'2026-08-25','21:59:00',NULL,'36.5','18','72','120/80','Give Paracetamol ','Take Rest'),('VISIT-PTE51NJ4A','02000345411','NURSE02000','INSECTBITES02000',NULL,'2026-09-19','12:29:00',NULL,'36.5','18','72','120/80','Give Medicine','Take a rest'),('VISIT-Q3Y4Z5W6Q','02000345411','NURSE02000','RUNNYNOSE02000',NULL,'2026-03-25','10:30:00','11:00:00','37.1','18','73','120/80','Warm water given.','Mask up.'),('VISIT-Q7ILVC0W3','02000345411','NURSE02000','INSECTBITES02000',NULL,'2026-09-17','17:14:00','17:20:00','36.5','18','72','120/80','Give medicine','Take a rest'),('VISIT-Q7X8Y9Z0Q','02000001133','NURSE02000','COUGH02000',NULL,'2026-02-22','10:30:00','11:00:00','37.0','17','74','110/70','Lozenges provided.','Avoid cold snacks.'),('VISIT-QKKJE4OZ5','02000565656','NURSE02000','HEADACHE02000',NULL,'2026-08-29','15:30:00',NULL,'36.5','18','72','120/80','Give Medicine','Take Rest'),('VISIT-QX9M2AGB6','02000257727','NURSE02000',NULL,NULL,'2026-09-22','10:05:00','10:15:00',NULL,NULL,NULL,NULL,NULL,NULL),('VISIT-R4Y5Z6W7R','02000001133','NURSE02000','RUNNYNOSE02000',NULL,'2026-04-18','14:00:00','14:30:00','37.0','18','75','112/72','Tissues & mask.','Stay warm.'),('VISIT-R8X9Y0Z1R','02000120504','NURSE02000','COUGH02000',NULL,'2026-03-05','09:15:00','09:45:00','36.7','18','76','112/75','Warm water compress.','Rest.'),('VISIT-RXT7VK576','02000345411','NURSE02000',NULL,NULL,'2026-09-12','12:12:00','13:15:00',NULL,NULL,NULL,NULL,NULL,NULL),('VISIT-S3N0XA1QT','02000257727','NURSE02000',NULL,NULL,'2026-09-22','18:47:00','18:48:00',NULL,NULL,NULL,NULL,NULL,NULL),('VISIT-S5Y6Z7W8S','02000120504','NURSE02000','RUNNYNOSE02000',NULL,'2026-05-12','09:15:00','09:45:00','36.8','16','70','110/70','Provided mask.','Hydrate.'),('VISIT-S9X0Y1Z2S','02000345411','NURSE02000','COUGH02000',NULL,'2026-03-29','15:00:00','15:30:00','36.8','16','70','118/76','Advised mask wearing.','Stay hydrated.'),('VISIT-T0X1Y2Z3T','02000001133','NURSE02000','COUGH02000',NULL,'2026-04-12','13:30:00','14:00:00','37.2','19','78','115/70','Lozenges given.','Rest up.'),('VISIT-T157K0INZ','02000345411','NURSE02000','INSECTBITES02000',NULL,'2026-09-17','17:20:00','22:55:00','36.5','18','72','120/80','Give rest','take a rest'),('VISIT-T6Y7Z8W9T','02000345411','NURSE02000','RUNNYNOSE02000',NULL,'2026-06-30','13:00:00','13:30:00','36.9','17','72','115/75','Rest in clinic.','Mask up.'),('VISIT-TBC0L0CAS','02000565656','NURSE02000','HEADACHE02000',NULL,'2026-09-03','23:57:00',NULL,'36.5','18','72','120/80','Given Rest','Take Rest'),('VISIT-TDS9H8ZI2','02000257727','NURSE02000',NULL,NULL,'2026-09-22','23:24:00','23:40:00',NULL,NULL,NULL,NULL,NULL,NULL),('VISIT-U1X2Y3Z4U','02000120504','NURSE02000','COUGH02000',NULL,'2026-04-25','11:15:00','11:45:00','37.1','18','74','120/80','Clinic rest, hot water.','Mask up.'),('VISIT-U7Y8Z9W0U','02000001133','NURSE02000','LBM02000',NULL,'2026-07-08','14:30:00','15:00:00','36.8','18','74','112/72','Warm compress, ORS given.','Drink water, avoid dairy.'),('VISIT-UFF3Z7PR5','02000345411','NURSE02000','HEADACHE02000',NULL,'2026-07-29','18:12:00',NULL,'36.5','18','72','120/80','Given Rest','Take Rest'),('VISIT-UWFNDUGLZ','02000257727','NURSE02000','DIZZINESS02000',NULL,'2026-08-08','10:04:00',NULL,'40.5','20','80','120/80','Given rest','Take a rest'),('VISIT-V2X3Y4Z5V','02000345411','NURSE02000','COUGH02000',NULL,'2026-05-08','08:45:00','09:15:00','36.9','17','73','110/70','Provided mask.','Drink warm tea.'),('VISIT-V8Y9Z0W1V','02000345411','NURSE02000','RUNNYNOSE02000',NULL,'2026-07-14','15:00:00','15:30:00','36.8','17','71','110/70','Provided face mask.','Hydrate and wash hands.'),('VISIT-VQS962VUL','02000345411','NURSE02000','HEADACHE02000',NULL,'2026-07-16','22:33:00','13:34:00','36.5','18','72','120/80','Give Paracetamol','Take rest'),('VISIT-W3X4Y5Z6W','02000001133','NURSE02000','COUGH02000',NULL,'2026-05-18','14:30:00','15:00:00','37.2','18','75','112/72','Lozenges offered.','Rest.'),('VISIT-X4X5Y6Z7X','02000120504','NURSE02000','COUGH02000',NULL,'2026-06-03','10:00:00','10:30:00','37.0','18','74','115/75','Warm water given.','Stay dry.'),('VISIT-XH7DGVZ9A','02000257727','NURSE02000',NULL,NULL,'2026-09-21','01:20:00',NULL,NULL,NULL,NULL,NULL,NULL,NULL),('VISIT-XTQRCAD3M','02000257727','NURSE02000','HEADACHE02000',NULL,'2026-09-21','20:17:00','20:20:00','36.5','18','72','120/80','Give Medicine','Take rest'),('VISIT-Y59S7QKOD','02000345411','NURSE02000','DIFFICULTYOFBREATHING02000',NULL,'2026-07-14','12:17:00','13:17:00','36.5','22','86','120/80','Monitored oxygen levels, coached rhythmic deep breathing, kept in quiet space.','Take rest, avoid running/exertion, and keep inhaler accessible if diagnosed.'),('VISIT-Y5X6Y7Z8Y','02000345411','NURSE02000','COUGH02000',NULL,'2026-06-21','13:00:00','13:30:00','36.8','16','71','120/80','Mask given.','Drink fluids.'),('VISIT-YGNLB54C9','02000257727','NURSE02000',NULL,NULL,'2026-09-22','23:24:00','23:40:00',NULL,NULL,NULL,NULL,NULL,NULL),('VISIT-YLPXI4XD4','02000345411','NURSE02000','FEVER02000',NULL,'2026-07-21','15:10:00','15:11:00','40','18','72','120/80','Given Rest','Take Rest'),('VISIT-Z0AA97O0U','02000257727','NURSE02000','OTHERS02000','Sore Eyes','2026-09-24','21:12:00','22:12:00','36.5','18','72','120/80','Give Medicine','Take Rest'),('VISIT-Z6X7Y8Z9Z','02000001133','NURSE02000','FEVER02000',NULL,'2026-01-20','10:00:00','10:30:00','38.2','19','84','110/70','Paracetamol given.','Rest at home.'),('VISIT-ZTDMGGGYS','02000371918','NURSE02000','INSECTBITES02000',NULL,'2026-09-19','13:41:00',NULL,'35','17','71','120/75','give medecine','take a rest');
/*!40000 ALTER TABLE `clinic_visits` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `consultation_dispensation`
--

DROP TABLE IF EXISTS `consultation_dispensation`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `consultation_dispensation` (
  `consultation_dispense_id` varchar(45) NOT NULL,
  `visit_id` varchar(45) NOT NULL,
  `batch_id` varchar(45) NOT NULL,
  `dosage_consumption_unit_value` decimal(10,2) NOT NULL,
  `dosage_consumption_unit_of_measure` enum('mg','g','mcg','mL','L','Tablet/s','Capsule/s','Patch/es','Sachet','Vial','Prefilled Syringe','Spray/s','Inhaler','Box/es','pcs.') NOT NULL,
  `dispensed_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`consultation_dispense_id`),
  KEY `visit_id` (`visit_id`),
  KEY `batch_id` (`batch_id`),
  CONSTRAINT `consultation_dispensation_ibfk_1` FOREIGN KEY (`visit_id`) REFERENCES `clinic_visits` (`visit_id`) ON DELETE CASCADE,
  CONSTRAINT `consultation_dispensation_ibfk_2` FOREIGN KEY (`batch_id`) REFERENCES `medicine_inventory_batches` (`batch_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `consultation_dispensation`
--

LOCK TABLES `consultation_dispensation` WRITE;
/*!40000 ALTER TABLE `consultation_dispensation` DISABLE KEYS */;
INSERT INTO `consultation_dispensation` VALUES ('DISP-07CNVM4P0','VISIT-2L15EXLAT','a00a43f3-bae9-47fb-9d74-940e49aa3a57',1.00,'pcs.','2026-09-22 02:00:22'),('DISP-261XZ4PDA','VISIT-Z0AA97O0U','7bd49b5e-e05e-40f9-823e-e0b0280da85c',5.00,'mL','2026-09-24 13:13:35'),('DISP-3VJQDC7D4','VISIT-C7YER103K','a00a43f3-bae9-47fb-9d74-940e49aa3a57',1.00,'pcs.','2026-09-22 02:10:05'),('DISP-3Z12N1N5F','VISIT-MJGE2A7MU','a00a43f3-bae9-47fb-9d74-940e49aa3a57',3.00,'pcs.','2026-09-21 12:25:28'),('DISP-4ORKSJZH0','VISIT-GQJ0JZXXF','66f77537-703c-451e-9049-2f83e41c8e92',1.00,'Tablet/s','2026-09-24 13:37:23'),('DISP-8EUIRTOXO','VISIT-47910UN2E','a00a43f3-bae9-47fb-9d74-940e49aa3a57',1.00,'pcs.','2026-09-24 13:02:45'),('DISP-8I6UO1DFE','VISIT-6FH3CGYSG','a00a43f3-bae9-47fb-9d74-940e49aa3a57',1.00,'pcs.','2026-09-24 10:54:09'),('DISP-9ONDJDTHK','VISIT-Q7ILVC0W3','a00a43f3-bae9-47fb-9d74-940e49aa3a57',3.00,'pcs.','2026-09-17 09:16:51'),('DISP-BKXDWYMDW','VISIT-C3A02J5JX','66f77537-703c-451e-9049-2f83e41c8e92',1.00,'Tablet/s','2026-09-23 00:51:31'),('DISP-C6ZHG6XSX','VISIT-T157K0INZ','a00a43f3-bae9-47fb-9d74-940e49aa3a57',3.00,'pcs.','2026-09-17 09:22:20'),('DISP-D8OTDPPYE','VISIT-XTQRCAD3M','66f77537-703c-451e-9049-2f83e41c8e92',5.00,'Tablet/s','2026-09-21 12:18:29'),('DISP-GSYSLQM3Z','VISIT-AKYGU7SKU','a00a43f3-bae9-47fb-9d74-940e49aa3a57',3.00,'pcs.','2026-09-17 09:09:22'),('DISP-JEF06CI31','VISIT-3G0Z6E5AM','66f77537-703c-451e-9049-2f83e41c8e92',2.00,'Tablet/s','2026-09-17 05:10:02'),('DISP-JR9TU6624','VISIT-70DK14HLO','a00a43f3-bae9-47fb-9d74-940e49aa3a57',2.00,'pcs.','2026-09-17 08:28:57'),('DISP-KED4QHBHM','VISIT-AM9YQW2RR','66f77537-703c-451e-9049-2f83e41c8e92',1.00,'Tablet/s','2026-09-24 10:52:06'),('DISP-M5P668KQX','VISIT-8DTIOBUZJ','7bd49b5e-e05e-40f9-823e-e0b0280da85c',5.00,'mL','2026-09-21 12:12:42'),('DISP-UOHIETWRR','VISIT-ZTDMGGGYS','a00a43f3-bae9-47fb-9d74-940e49aa3a57',10.00,'pcs.','2026-09-19 05:43:41'),('DISP-WHMOHQ48Q','VISIT-PTE51NJ4A','a00a43f3-bae9-47fb-9d74-940e49aa3a57',5.00,'pcs.','2026-09-19 04:32:43'),('DISP-XLOUJAK91','VISIT-K7G5206FO','a00a43f3-bae9-47fb-9d74-940e49aa3a57',1.00,'pcs.','2026-09-24 12:44:34'),('DISP-ZPQYUUA2W','VISIT-1RYZY5358','a00a43f3-bae9-47fb-9d74-940e49aa3a57',2.00,'pcs.','2026-09-18 09:40:40');
/*!40000 ALTER TABLE `consultation_dispensation` ENABLE KEYS */;
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
  `screening_schedule_id` varchar(45) NOT NULL,
  `dental_findings` text NOT NULL,
  `remarks` text,
  `recorded_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`dental_record_id`),
  KEY `student_id` (`student_id`),
  KEY `screening_schedule_id` (`screening_schedule_id`),
  CONSTRAINT `dental_assessment_records_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `students` (`student_id`),
  CONSTRAINT `dental_assessment_records_ibfk_2` FOREIGN KEY (`screening_schedule_id`) REFERENCES `screening_schedules` (`screening_schedule_id`)
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
-- Table structure for table `direct_dispensation`
--

DROP TABLE IF EXISTS `direct_dispensation`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `direct_dispensation` (
  `direct_dispense_id` varchar(45) NOT NULL,
  `student_id` varchar(45) DEFAULT NULL,
  `nurse_id` varchar(45) NOT NULL,
  `batch_id` varchar(45) NOT NULL,
  `dosage_consumption_unit_value` decimal(10,2) NOT NULL,
  `dosage_consumption_unit_of_measure` enum('mg','g','mcg','mL','L','Tablet/s','Capsule/s','Patch/es','Sachet','Vial','Prefilled Syringe','Spray/s','Inhaler','Box/es','pcs.') NOT NULL,
  `dispensed_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`direct_dispense_id`),
  KEY `nurse_id` (`nurse_id`),
  KEY `batch_id` (`batch_id`),
  KEY `direct_dispensation_ibfk_1` (`student_id`),
  CONSTRAINT `direct_dispensation_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `students` (`student_id`) ON DELETE CASCADE,
  CONSTRAINT `direct_dispensation_ibfk_2` FOREIGN KEY (`nurse_id`) REFERENCES `nurses` (`nurse_id`) ON DELETE CASCADE,
  CONSTRAINT `direct_dispensation_ibfk_3` FOREIGN KEY (`batch_id`) REFERENCES `medicine_inventory_batches` (`batch_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `direct_dispensation`
--

LOCK TABLES `direct_dispensation` WRITE;
/*!40000 ALTER TABLE `direct_dispensation` DISABLE KEYS */;
INSERT INTO `direct_dispensation` VALUES ('0abb42b3-c885-47cc-bd33-38598d649010','02000371918','NURSE02000','7bd49b5e-e05e-40f9-823e-e0b0280da85c',457.00,'mL','2026-09-19 05:40:08'),('0b1b7938-7488-435b-b122-0079fdc7896a','02000257727','NURSE02000','a00a43f3-bae9-47fb-9d74-940e49aa3a57',1.00,'pcs.','2026-09-18 09:38:40'),('19c04c79-8619-4313-adda-fb5e282a12a4','02000257727','NURSE02000','a00a43f3-bae9-47fb-9d74-940e49aa3a57',11.00,'pcs.','2026-09-19 05:39:11'),('1e975d9a-eb90-47da-ad09-ecddfdf3a054','02000001133','NURSE02000','66f77537-703c-451e-9049-2f83e41c8e92',2.00,'Tablet/s','2026-09-19 05:25:52'),('437b2bbf-33c1-4d05-9ef7-5c639a4cebf7','02000257727','NURSE02000','66f77537-703c-451e-9049-2f83e41c8e92',1.00,'Tablet/s','2026-09-22 04:24:13'),('446d4e24-66ce-4d2e-b8d6-cb7b9733bc16','02000345411','NURSE02000','a00a43f3-bae9-47fb-9d74-940e49aa3a57',10.00,'pcs.','2026-09-19 05:38:40'),('490484b0-6bd8-4d05-a38d-62ff71620916','02000371918','NURSE02000','a00a43f3-bae9-47fb-9d74-940e49aa3a57',3.00,'pcs.','2026-09-18 09:39:26'),('5e499466-46fa-4160-b813-e786ec591236','02000257727','NURSE02000','7bd49b5e-e05e-40f9-823e-e0b0280da85c',5.00,'mL','2026-09-17 09:19:34'),('5f5de30e-f97e-4ca9-a332-158090ad6791','02000371918','NURSE02000','7bd49b5e-e05e-40f9-823e-e0b0280da85c',18.00,'mL','2026-09-19 05:39:42'),('6c46134d-c7f1-4fc7-b24d-d3b1395f17f3','02000345411','NURSE02000','a00a43f3-bae9-47fb-9d74-940e49aa3a57',8.00,'pcs.','2026-09-19 06:45:37'),('8d234245-e1d3-451d-ab22-9b5348e98451','02000371918','NURSE02000','66f77537-703c-451e-9049-2f83e41c8e92',3.00,'Tablet/s','2026-09-19 05:32:08'),('b869d88f-3124-4126-9c2b-1e2b5052d2fd','02000257727','NURSE02000','66f77537-703c-451e-9049-2f83e41c8e92',1.00,'Tablet/s','2026-08-19 04:28:33'),('bde270f1-5be9-4cce-b8c8-944fb7f18bba','02000349679','NURSE02000','7bd49b5e-e05e-40f9-823e-e0b0280da85c',15.00,'mL','2026-09-19 05:37:20'),('c2a4b9c4-e907-4662-b7a5-405219040fe6','02000349679','NURSE02000','7bd49b5e-e05e-40f9-823e-e0b0280da85c',505.00,'mL','2026-09-19 05:40:37'),('cfa8c9b9-d0b9-4264-b1ef-b36a671de41e','02000371918','NURSE02000','66f77537-703c-451e-9049-2f83e41c8e92',2.00,'Tablet/s','2026-09-19 05:26:31'),('dee7db80-033e-40eb-9f26-cf691ab01a2d','02000257727','NURSE02000','7bd49b5e-e05e-40f9-823e-e0b0280da85c',5.00,'mL','2026-09-19 05:36:29'),('e68a0f4b-e653-46c6-96ee-f82e17b3f239','02000350927','NURSE02000','a00a43f3-bae9-47fb-9d74-940e49aa3a57',3.00,'pcs.','2026-08-19 04:29:21'),('f5b039dc-83fe-4ffa-bc50-c7d739bd7871','02000001133','NURSE02000','a00a43f3-bae9-47fb-9d74-940e49aa3a57',6.00,'pcs.','2026-07-18 09:39:51'),('f6f5cf7c-7de2-4025-90cb-3763c6d6517b','02000345411','NURSE02000','a00a43f3-bae9-47fb-9d74-940e49aa3a57',2.00,'pcs.','2026-07-17 08:27:26'),('fb7c05b3-2f41-40bc-b014-9afee0a27bde','02000257727','NURSE02000','a00a43f3-bae9-47fb-9d74-940e49aa3a57',2.00,'pcs.','2026-09-22 03:12:08');
/*!40000 ALTER TABLE `direct_dispensation` ENABLE KEYS */;
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
  CONSTRAINT `chk_student_attendance` CHECK ((`attendance_status` in (_utf8mb4'Pending',_utf8mb4'Present',_utf8mb4'Absent')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `doctor_appointment_students`
--

LOCK TABLES `doctor_appointment_students` WRITE;
/*!40000 ALTER TABLE `doctor_appointment_students` DISABLE KEYS */;
INSERT INTO `doctor_appointment_students` VALUES ('APPT-0033adaf','02000112233','Absent',NULL,NULL),('APPT-03b279e4','02000349679','Absent',NULL,NULL),('APPT-03e8f59f','02000120504','Absent',NULL,NULL),('APPT-08ade5ca','02000120504','Absent',NULL,NULL),('APPT-090352ef','02000349679','Absent',NULL,NULL),('APPT-0911caca','02000120504','Absent',NULL,NULL),('APPT-0a11e7ca','02000349679','Absent',NULL,NULL),('APPT-0a8bf1fc','02000112233','Absent',NULL,NULL),('APPT-0a9d728c','02000345411','Present','2026-09-15 10:21:02',NULL),('APPT-0b41a387','02000350927','Absent',NULL,NULL),('APPT-0cc9187b','02000345411','Absent',NULL,NULL),('APPT-0d808451','02000112233','Absent',NULL,NULL),('APPT-0d995cc4','02000350927','Absent',NULL,NULL),('APPT-0e0a44a0','02000349679','Absent',NULL,NULL),('APPT-0e6e8f80','02000349679','Absent',NULL,NULL),('APPT-127a1947','02000332211','Absent',NULL,NULL),('APPT-184ab4e0','02000565656','Absent',NULL,NULL),('APPT-1888f254','02000121416','Absent',NULL,NULL),('APPT-18a3071c','02000350927','Absent',NULL,NULL),('APPT-191b380b','02000350927','Absent',NULL,NULL),('APPT-1b13dbee','02000371918','Absent',NULL,NULL),('APPT-1bf45ad6','02000332211','Absent',NULL,NULL),('APPT-1d4946cd','02000350927','Absent',NULL,NULL),('APPT-20439ff4','02000345411','Absent',NULL,NULL),('APPT-24dd6248','02000121416','Absent',NULL,NULL),('APPT-26b6b683','02000371918','Absent',NULL,NULL),('APPT-2708095c','02000121416','Absent',NULL,NULL),('APPT-27c6fb5e','02000345411','Absent',NULL,NULL),('APPT-29c414f5','02000001133','Absent',NULL,NULL),('APPT-2a71910a','02000257727','Absent',NULL,NULL),('APPT-2bd37bc4','02000565656','Absent',NULL,NULL),('APPT-2da99156','02000257727','Present','2026-09-22 12:37:10',NULL),('APPT-2e135b50','02000121416','Absent',NULL,NULL),('APPT-2e3fc63c','123456789','Absent',NULL,NULL),('APPT-2f68ea48','02000332211','Absent',NULL,NULL),('APPT-32914072','02000345411','Absent',NULL,NULL),('APPT-339c3977','02000112233','Absent',NULL,NULL),('APPT-3b3bb031','02000121416','Absent',NULL,NULL),('APPT-3c09c76c','02000120504','Absent',NULL,NULL),('APPT-3ca3df19','02000001133','Absent',NULL,NULL),('APPT-3fdd5563','123456789','Absent',NULL,NULL),('APPT-4050103c','02000332211','Absent',NULL,NULL),('APPT-425dad6a','02000257727','Absent',NULL,NULL),('APPT-44307fe2','02000345411','Absent',NULL,NULL),('APPT-449d26ff','02000120504','Absent',NULL,NULL),('APPT-45da8105','02000565656','Absent',NULL,NULL),('APPT-45e47343','02000565656','Absent',NULL,NULL),('APPT-469c19e8','02000001133','Absent',NULL,NULL),('APPT-493a82ad','02000001133','Absent',NULL,NULL),('APPT-49bbf3bd','02000349679','Absent',NULL,NULL),('APPT-49f1f9d8','02000112233','Absent',NULL,NULL),('APPT-4ab4cdb6','02000350927','Absent',NULL,NULL),('APPT-4c57c8f1','02000371918','Absent',NULL,NULL),('APPT-4d2c1ce8','02000257727','Absent',NULL,NULL),('APPT-4d9c0069','02000120504','Absent',NULL,NULL),('APPT-4d9d577f','02000565656','Absent',NULL,NULL),('APPT-502d710a','02000345411','Absent',NULL,NULL),('APPT-50da2c62','123456789','Absent',NULL,NULL),('APPT-51da7ea8','02000121416','Absent',NULL,NULL),('APPT-55443af8','02000257727','Absent',NULL,NULL),('APPT-566e6087','123456789','Absent',NULL,NULL),('APPT-568fc3e8','02000120504','Absent',NULL,NULL),('APPT-57b3d24f','02000257727','Absent',NULL,NULL),('APPT-5b93ee0d','02000257727','Absent',NULL,NULL),('APPT-5d3bf96c','02000332211','Absent',NULL,NULL),('APPT-5e45c376','02000371918','Absent',NULL,NULL),('APPT-5ece448c','02000257727','Present','2026-09-18 14:47:50',NULL),('APPT-5f572ae4','02000371918','Absent',NULL,NULL),('APPT-60e65ce9','02000565656','Absent',NULL,NULL),('APPT-61bf4e52','02000565656','Absent',NULL,NULL),('APPT-62604c9b','123456789','Absent',NULL,NULL),('APPT-67955b73','02000120504','Absent',NULL,NULL),('APPT-683215fb','02000257727','Present','2026-09-18 17:50:15',NULL),('APPT-68641972','02000120504','Absent',NULL,NULL),('APPT-6bd48512','02000332211','Absent',NULL,NULL),('APPT-6c667755','02000345411','Absent',NULL,NULL),('APPT-6e7f32e3','02000565656','Absent',NULL,NULL),('APPT-6ed766d8','02000350927','Absent',NULL,NULL),('APPT-701d0e4a','02000345411','Absent',NULL,NULL),('APPT-72f672a0','02000112233','Absent',NULL,NULL),('APPT-73a57b72','02000371918','Absent',NULL,NULL),('APPT-755ddefc','02000001133','Absent',NULL,NULL),('APPT-75ca2a1c','02000121416','Absent',NULL,NULL),('APPT-760bab33','02000332211','Absent',NULL,NULL),('APPT-77387d15','02000120504','Absent',NULL,NULL),('APPT-79bdeef3','123456789','Absent',NULL,NULL),('APPT-7b7ca2e1','02000257727','Present','2026-09-18 18:11:29',NULL),('APPT-7e410fed','02000120504','Absent',NULL,NULL),('APPT-7e8596a2','123456789','Absent',NULL,NULL),('APPT-8113b768','02000565656','Absent',NULL,NULL),('APPT-8432ce5b','02000349679','Absent',NULL,NULL),('APPT-84a131c4','02000001133','Absent',NULL,NULL),('APPT-85302d09','02000001133','Absent',NULL,NULL),('APPT-85771fe2','02000371918','Absent',NULL,NULL),('APPT-86ab0c13','02000350927','Absent',NULL,NULL),('APPT-88e8f59b','02000121416','Absent',NULL,NULL),('APPT-8f1515dc','02000371918','Absent',NULL,NULL),('APPT-90986ab6','02000345411','Absent',NULL,NULL),('APPT-947c65eb','02000257727','Absent',NULL,NULL),('APPT-94f9de50','02000332211','Absent',NULL,NULL),('APPT-97664d2f','02000121416','Absent',NULL,NULL),('APPT-986cbc8f','02000257727','Absent',NULL,NULL),('APPT-9a01d199','02000112233','Absent',NULL,NULL),('APPT-9a17d0ee','02000257727','Present','2026-09-22 14:07:12',NULL),('APPT-9b3c612f','02000257727','Absent',NULL,NULL),('APPT-9c326aba','02000257727','Absent',NULL,NULL),('APPT-9c364e4e','02000565656','Absent',NULL,NULL),('APPT-9c57b861','02000112233','Absent',NULL,NULL),('APPT-9e3a19a5','02000332211','Absent',NULL,NULL),('APPT-9e5d918f','02000565656','Absent',NULL,NULL),('APPT-a0b7a59f','02000345411','Absent',NULL,NULL),('APPT-a29d4e29','02000345411','Absent',NULL,NULL),('APPT-a3babcf4','123456789','Absent',NULL,NULL),('APPT-a5e61c38','02000371918','Absent',NULL,NULL),('APPT-a71977f8','02000001133','Absent',NULL,NULL),('APPT-a890c949','02000001133','Absent',NULL,NULL),('APPT-aa9b171f','02000001133','Absent',NULL,NULL),('APPT-ab3302aa','02000349679','Absent',NULL,NULL),('APPT-abdcd73b','02000349679','Absent',NULL,NULL),('APPT-ae292b23','123456789','Absent',NULL,NULL),('APPT-af2ea950','02000257727','Present','2026-09-18 18:12:06',NULL),('APPT-af7b9cb3','123456789','Absent',NULL,NULL),('APPT-afc9cb96','02000345411','Present','2026-09-21 15:37:43',NULL),('APPT-afd02188','02000350927','Absent',NULL,NULL),('APPT-b0545205','02000349679','Absent',NULL,NULL),('APPT-b65f504c','02000345411','Absent',NULL,NULL),('APPT-b6caab80','02000565656','Absent',NULL,NULL),('APPT-ba24e366','02000120504','Absent',NULL,NULL),('APPT-bc213396','02000121416','Absent',NULL,NULL),('APPT-bd1e3324','02000371918','Absent',NULL,NULL),('APPT-beb0e36b','02000350927','Absent',NULL,NULL),('APPT-c686f136','02000332211','Absent',NULL,NULL),('APPT-c8d0e7ce','02000371918','Absent',NULL,NULL),('APPT-cbd5b34b','02000257727','Absent',NULL,NULL),('APPT-cc69ae2b','02000349679','Absent',NULL,NULL),('APPT-cf964b9f','02000257727','Absent',NULL,NULL),('APPT-d2a7c6af','02000001133','Absent',NULL,NULL),('APPT-d5af04e0','02000345411','Absent',NULL,NULL),('APPT-d80a3827','02000120504','Absent',NULL,NULL),('APPT-d8248a34','02000349679','Absent',NULL,NULL),('APPT-d84621c9','02000001133','Absent',NULL,NULL),('APPT-d8773044','02000120504','Absent',NULL,NULL),('APPT-dbc2f7e1','02000371918','Absent',NULL,NULL),('APPT-dcb7d6e3','02000120504','Absent',NULL,NULL),('APPT-dd2ece85','02000345411','Present','2026-09-18 16:13:59',NULL),('APPT-e013bcf6','123456789','Absent',NULL,NULL),('APPT-e105f645','02000112233','Absent',NULL,NULL),('APPT-e706f1cb','02000120504','Absent',NULL,NULL),('APPT-e9d708d7','02000350927','Absent',NULL,NULL),('APPT-eb60f865','02000257727','Absent',NULL,NULL),('APPT-ed8dc0d2','02000112233','Absent',NULL,NULL),('APPT-edfb29a0','02000112233','Absent',NULL,NULL),('APPT-efae1435','02000001133','Absent',NULL,NULL),('APPT-f1a56f42','02000332211','Absent',NULL,NULL),('APPT-f24bfd2f','02000332211','Absent',NULL,NULL),('APPT-f2e1faa2','02000257727','Absent',NULL,NULL),('APPT-f39f54d5','02000345411','Absent',NULL,NULL),('APPT-f3d17fca','02000001133','Absent',NULL,NULL),('APPT-f4cd4273','02000120504','Absent',NULL,NULL),('APPT-f8f8bdde','02000350927','Absent',NULL,NULL),('APPT-fad1478b','02000001133','Absent',NULL,NULL),('APPT-fb21ce1b','123456789','Absent',NULL,NULL),('APPT-fc6b862e','02000112233','Absent',NULL,NULL),('APPT-fc892d9d','02000120504','Absent',NULL,NULL),('APPT-fd77d2b7','02000121416','Absent',NULL,NULL),('APPT-ffa688e6','02000001133','Absent',NULL,NULL);
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
  `assigned_by_nurse_id` varchar(45) NOT NULL,
  `status` varchar(20) DEFAULT 'Scheduled',
  `title` varchar(45) NOT NULL,
  `announcement` text NOT NULL,
  PRIMARY KEY (`appointment_id`),
  KEY `idx_doctor_id` (`doctor_id`),
  KEY `idx_assigned_by_nurse_id` (`assigned_by_nurse_id`),
  KEY `idx_batch_id` (`batch_id`),
  CONSTRAINT `fk_da_batch` FOREIGN KEY (`batch_id`) REFERENCES `mass_schedule_batches` (`batch_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_da_doctor` FOREIGN KEY (`doctor_id`) REFERENCES `doctors` (`doctor_id`),
  CONSTRAINT `fk_da_nurse` FOREIGN KEY (`assigned_by_nurse_id`) REFERENCES `nurses` (`nurse_id`),
  CONSTRAINT `chk_appointment_status` CHECK ((`status` in (_utf8mb4'Scheduled',_utf8mb4'Completed',_utf8mb4'No-Show',_utf8mb4'Cancelled'))),
  CONSTRAINT `chk_appointment_time` CHECK ((`end_time` > `start_time`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `doctor_appointments`
--

LOCK TABLES `doctor_appointments` WRITE;
/*!40000 ALTER TABLE `doctor_appointments` DISABLE KEYS */;
INSERT INTO `doctor_appointments` VALUES ('APPT-0033adaf','DOC-ed638364','BATCH-f4d58272','2026-09-18 16:32:00','2026-09-18 16:37:00','NURSE02000','Scheduled','',''),('APPT-03b279e4','DOC-ed638364','BATCH-ef0c5a69','2026-09-22 12:42:00','2026-09-22 12:47:00','NURSE02000','Scheduled','Annua Dental Assessment','bring ID'),('APPT-03e8f59f','DOC-ed638364','BATCH-00d32b06','2026-09-18 17:39:00','2026-09-18 17:44:00','NURSE02000','Cancelled','',''),('APPT-08ade5ca','DOC-ed638364','BATCH-216c9122','2026-09-21 16:53:00','2026-09-21 17:02:00','NURSE02000','Scheduled','Annual Doctor Visit','Bring ID'),('APPT-090352ef','DOC-ed638364','BATCH-21225e53','2026-09-18 17:12:00','2026-09-18 17:17:00','NURSE02000','Scheduled','',''),('APPT-0911caca','DOC-ed638364','BATCH-1aa9e53e','2026-09-15 09:08:00','2026-09-15 09:13:00','NURSE02000','Scheduled','',''),('APPT-0a11e7ca','DOC-ed638364','BATCH-1ccbd265','2026-09-18 18:08:00','2026-09-18 18:13:00','NURSE02000','Scheduled','test nanaman','dala ID'),('APPT-0a8bf1fc','DOC-ed638364','BATCH-ef0c5a69','2026-09-22 12:12:00','2026-09-22 12:17:00','NURSE02000','Scheduled','Annua Dental Assessment','bring ID'),('APPT-0a9d728c','DOC-ed638364','BATCH-1aa9e53e','2026-09-15 09:18:00','2026-09-15 09:23:00','NURSE02000','Scheduled','',''),('APPT-0b41a387','DOC-ed638364','BATCH-f4d58272','2026-09-18 17:51:00','2026-09-18 17:56:00','NURSE02000','Cancelled','',''),('APPT-0cc9187b','DOC-ed638364','BATCH-2f9c4460','2026-09-19 07:54:00','2026-09-19 08:04:00','NURSE02000','Scheduled','Annual Physical Exam','bring id '),('APPT-0d808451','DOC-ed638364','BATCH-a21c095a','2026-09-18 17:36:00','2026-09-18 17:41:00','NURSE02000','Scheduled','test again','pahinga'),('APPT-0d995cc4','DOC-ed638364','BATCH-2f9c4460','2026-09-19 08:14:00','2026-09-19 08:24:00','NURSE02000','Scheduled','Annual Physical Exam','bring id '),('APPT-0e0a44a0','DOC-ed638364','BATCH-f4d58272','2026-09-18 17:46:00','2026-09-18 17:51:00','NURSE02000','Cancelled','',''),('APPT-0e6e8f80','DOC-ed638364','BATCH-00d32b06','2026-09-18 18:04:00','2026-09-18 18:09:00','NURSE02000','Cancelled','',''),('APPT-127a1947','DOC-ed638364','BATCH-ba959091','2026-09-18 19:00:00','2026-09-18 19:05:00','NURSE02000','Scheduled','test nga ulit','bring valid ID'),('APPT-184ab4e0','DOC-ed638364','BATCH-ba959091','2026-09-18 19:25:00','2026-09-18 19:30:00','NURSE02000','Scheduled','test nga ulit','bring valid ID'),('APPT-1888f254','DOC-ed638364','BATCH-a21c095a','2026-09-18 17:46:00','2026-09-18 17:51:00','NURSE02000','Scheduled','test again','pahinga'),('APPT-18a3071c','DOC-ed638364','BATCH-1ccbd265','2026-09-18 18:13:00','2026-09-18 18:18:00','NURSE02000','Scheduled','test nanaman','dala ID'),('APPT-191b380b','DOC-ed638364','BATCH-4b20256e','2026-09-18 17:37:00','2026-09-18 17:42:00','NURSE02000','Scheduled','General Checkup','Fasting'),('APPT-1b13dbee','DOC-ed638364','BATCH-ba959091','2026-09-18 19:20:00','2026-09-18 19:25:00','NURSE02000','Scheduled','test nga ulit','bring valid ID'),('APPT-1bf45ad6','DOC-ed638364','BATCH-a21c095a','2026-09-18 17:56:00','2026-09-18 18:01:00','NURSE02000','Scheduled','test again','pahinga'),('APPT-1d4946cd','DOC-ed638364','BATCH-7dd7ad3e','2026-09-18 18:56:00','2026-09-18 19:01:00','NURSE02000','Scheduled','test nangani','bring valid id'),('APPT-20439ff4','DOC-ed638364','BATCH-6f2c0294','2026-09-21 16:40:00','2026-09-21 16:50:00','NURSE02000','Scheduled','Annual Dental Visit','bring ID'),('APPT-24dd6248','DOC-ed638364','BATCH-2f9c4460','2026-09-19 07:24:00','2026-09-19 07:34:00','NURSE02000','Scheduled','Annual Physical Exam','bring id '),('APPT-26b6b683','DOC-ed638364','BATCH-f4d58272','2026-09-18 17:56:00','2026-09-18 18:01:00','NURSE02000','Cancelled','',''),('APPT-2708095c','DOC-ed638364','BATCH-ad8c8ef0','2026-09-18 17:25:00','2026-09-18 18:23:00','NURSE02000','Scheduled','Test','wear proper attire'),('APPT-27c6fb5e','DOC-ed638364','BATCH-ba959091','2026-09-18 19:05:00','2026-09-18 19:10:00','NURSE02000','Scheduled','test nga ulit','bring valid ID'),('APPT-29c414f5','DOC-ed638364','BATCH-21225e53','2026-09-18 16:37:00','2026-09-18 16:42:00','NURSE02000','Scheduled','',''),('APPT-2a71910a','DOC-ed638364','BATCH-a21c095a','2026-09-18 17:51:00','2026-09-18 17:56:00','NURSE02000','Scheduled','test again','pahinga'),('APPT-2bd37bc4','DOC-ed638364','BATCH-7dd7ad3e','2026-09-18 19:06:00','2026-09-18 19:11:00','NURSE02000','Scheduled','test nangani','bring valid id'),('APPT-2da99156','DOC-ed638364','BATCH-ef0c5a69','2026-09-22 12:27:00','2026-09-22 12:32:00','NURSE02000','Scheduled','Annua Dental Assessment','bring ID'),('APPT-2e135b50','DOC-ed638364','BATCH-7dd7ad3e','2026-09-18 18:31:00','2026-09-18 18:36:00','NURSE02000','Scheduled','test nangani','bring valid id'),('APPT-2e3fc63c','DOC-ed638364','BATCH-1ccbd265','2026-09-18 18:28:00','2026-09-18 18:33:00','NURSE02000','Scheduled','test nanaman','dala ID'),('APPT-2f68ea48','DOC-ed638364','BATCH-7dd7ad3e','2026-09-18 18:41:00','2026-09-18 18:46:00','NURSE02000','Scheduled','test nangani','bring valid id'),('APPT-32914072','DOC-ed638364','BATCH-7dd7ad3e','2026-09-18 18:46:00','2026-09-18 18:51:00','NURSE02000','Scheduled','test nangani','bring valid id'),('APPT-339c3977','DOC-ed638364','BATCH-ad8c8ef0','2026-09-18 17:25:00','2026-09-18 18:23:00','NURSE02000','Scheduled','Test','wear proper attire'),('APPT-3b3bb031','DOC-ed638364','BATCH-21225e53','2026-09-18 16:52:00','2026-09-18 16:57:00','NURSE02000','Scheduled','',''),('APPT-3c09c76c','DOC-ed638364','BATCH-7dd7ad3e','2026-09-18 18:26:00','2026-09-18 18:31:00','NURSE02000','Scheduled','test nangani','bring valid id'),('APPT-3ca3df19','DOC-ed638364','BATCH-c39cc872','2026-09-15 10:06:00','2026-09-15 10:11:00','NURSE02000','Scheduled','',''),('APPT-3fdd5563','DOC-ed638364','BATCH-4b20256e','2026-09-18 17:52:00','2026-09-18 17:57:00','NURSE02000','Scheduled','General Checkup','Fasting'),('APPT-4050103c','DOC-ed638364','BATCH-21225e53','2026-09-18 17:02:00','2026-09-18 17:07:00','NURSE02000','Scheduled','',''),('APPT-425dad6a','DOC-ed638364','BATCH-7dd7ad3e','2026-09-18 18:36:00','2026-09-18 18:41:00','NURSE02000','Scheduled','test nangani','bring valid id'),('APPT-44307fe2','DOC-ed638364','BATCH-4b20256e','2026-09-18 17:27:00','2026-09-18 17:32:00','NURSE02000','Scheduled','General Checkup','Fasting'),('APPT-449d26ff','DOC-ed638364','BATCH-f4d58272','2026-09-18 17:21:00','2026-09-18 17:26:00','NURSE02000','Cancelled','',''),('APPT-45da8105','DOC-ed638364','BATCH-4b20256e','2026-09-18 17:47:00','2026-09-18 17:52:00','NURSE02000','Scheduled','General Checkup','Fasting'),('APPT-45e47343','DOC-ed638364','BATCH-ef0c5a69','2026-09-22 12:57:00','2026-09-22 13:02:00','NURSE02000','Scheduled','Annua Dental Assessment','bring ID'),('APPT-469c19e8','DOC-ed638364','BATCH-1ccbd265','2026-09-18 17:33:00','2026-09-18 17:38:00','NURSE02000','Scheduled','test nanaman','dala ID'),('APPT-493a82ad','DOC-ed638364','BATCH-1aa9e53e','2026-09-15 09:03:00','2026-09-15 09:08:00','NURSE02000','Scheduled','',''),('APPT-49bbf3bd','DOC-ed638364','BATCH-7dd7ad3e','2026-09-18 18:51:00','2026-09-18 18:56:00','NURSE02000','Scheduled','test nangani','bring valid id'),('APPT-49f1f9d8','DOC-ed638364','BATCH-7dd7ad3e','2026-09-18 18:21:00','2026-09-18 18:26:00','NURSE02000','Scheduled','test nangani','bring valid id'),('APPT-4ab4cdb6','DOC-ed638364','BATCH-21225e53','2026-09-18 17:17:00','2026-09-18 17:22:00','NURSE02000','Scheduled','',''),('APPT-4c57c8f1','DOC-ed638364','BATCH-3811c9c4','2026-09-18 18:55:00','2026-09-18 19:00:00','NURSE02000','Scheduled','test part 3','bring valid id'),('APPT-4d2c1ce8','DOC-ed638364','BATCH-00d32b06','2026-09-18 17:49:00','2026-09-18 17:54:00','NURSE02000','Cancelled','',''),('APPT-4d9c0069','DOC-ed638364','BATCH-ad8c8ef0','2026-09-18 17:25:00','2026-09-18 18:23:00','NURSE02000','Scheduled','Test','wear proper attire'),('APPT-4d9d577f','DOC-ed638364','BATCH-a21c095a','2026-09-18 18:21:00','2026-09-18 18:26:00','NURSE02000','Scheduled','test again','pahinga'),('APPT-502d710a','DOC-ed638364','BATCH-3811c9c4','2026-09-18 18:40:00','2026-09-18 18:45:00','NURSE02000','Scheduled','test part 3','bring valid id'),('APPT-50da2c62','DOC-ed638364','BATCH-00d32b06','2026-09-18 18:24:00','2026-09-18 18:29:00','NURSE02000','Cancelled','',''),('APPT-51da7ea8','DOC-ed638364','BATCH-f4d58272','2026-09-18 17:26:00','2026-09-18 17:31:00','NURSE02000','Cancelled','',''),('APPT-55443af8','DOC-ed638364','BATCH-075c4035','2026-09-18 01:46:00','2026-09-26 02:01:00','NURSE02000','Scheduled','',''),('APPT-566e6087','DOC-ed638364','BATCH-7dd7ad3e','2026-09-18 19:11:00','2026-09-18 19:16:00','NURSE02000','Scheduled','test nangani','bring valid id'),('APPT-568fc3e8','DOC-ed638364','BATCH-7b62ea28','2026-09-21 15:41:00','2026-09-21 15:46:00','NURSE02000','Scheduled','Annual Physical Exam','Bring ID'),('APPT-57b3d24f','DOC-ed638364','BATCH-4b20256e','2026-09-18 17:17:00','2026-09-18 17:22:00','NURSE02000','Scheduled','General Checkup','Fasting'),('APPT-5b93ee0d','DOC-ed638364','BATCH-3a127e3d','2026-09-15 10:02:00','2026-09-15 10:07:00','NURSE02000','Scheduled','',''),('APPT-5d3bf96c','DOC-ed638364','BATCH-2f9c4460','2026-09-19 07:44:00','2026-09-19 07:54:00','NURSE02000','Scheduled','Annual Physical Exam','bring id '),('APPT-5e45c376','DOC-ed638364','BATCH-4b20256e','2026-09-18 17:42:00','2026-09-18 17:47:00','NURSE02000','Scheduled','General Checkup','Fasting'),('APPT-5ece448c','DOC-ed638364','BATCH-1aa9e53e','2026-09-15 09:13:00','2026-09-15 09:18:00','NURSE02000','Scheduled','',''),('APPT-5f572ae4','DOC-ed638364','BATCH-7dd7ad3e','2026-09-18 19:01:00','2026-09-18 19:06:00','NURSE02000','Scheduled','test nangani','bring valid id'),('APPT-60e65ce9','DOC-ed638364','BATCH-ad8c8ef0','2026-09-18 17:25:00','2026-09-18 18:23:00','NURSE02000','Scheduled','Test','wear proper attire'),('APPT-61bf4e52','DOC-ed638364','BATCH-3811c9c4','2026-09-18 19:00:00','2026-09-18 19:05:00','NURSE02000','Scheduled','test part 3','bring valid id'),('APPT-62604c9b','DOC-ed638364','BATCH-ba959091','2026-09-18 19:30:00','2026-09-18 19:35:00','NURSE02000','Scheduled','test nga ulit','bring valid ID'),('APPT-67955b73','DOC-ed638364','BATCH-ef0c5a69','2026-09-22 12:17:00','2026-09-22 12:22:00','NURSE02000','Scheduled','Annua Dental Assessment','bring ID'),('APPT-683215fb','DOC-ed638364','BATCH-21225e53','2026-09-18 16:41:00','2026-09-18 17:02:00','NURSE02000','Scheduled','',''),('APPT-68641972','DOC-ed638364','BATCH-febb34a1','2026-09-15 09:45:00','2026-09-15 09:50:00','NURSE02000','Scheduled','',''),('APPT-6bd48512','DOC-ed638364','BATCH-ef0c5a69','2026-09-22 12:32:00','2026-09-22 12:37:00','NURSE02000','Scheduled','Annua Dental Assessment','bring ID'),('APPT-6c667755','DOC-ed638364','BATCH-ef0c5a69','2026-09-22 12:37:00','2026-09-22 12:42:00','NURSE02000','Scheduled','Annua Dental Assessment','bring ID'),('APPT-6e7f32e3','DOC-ed638364','BATCH-21225e53','2026-09-18 17:27:00','2026-09-18 17:32:00','NURSE02000','Scheduled','',''),('APPT-6ed766d8','DOC-ed638364','BATCH-3811c9c4','2026-09-18 18:50:00','2026-09-18 18:55:00','NURSE02000','Scheduled','test part 3','bring valid id'),('APPT-701d0e4a','DOC-ed638364','BATCH-c39cc872','2026-09-15 10:16:00','2026-09-15 10:21:00','NURSE02000','Scheduled','',''),('APPT-72f672a0','DOC-ed638364','BATCH-4b20256e','2026-09-18 17:02:00','2026-09-18 17:07:00','NURSE02000','Scheduled','General Checkup','Fasting'),('APPT-73a57b72','DOC-ed638364','BATCH-ad8c8ef0','2026-09-18 17:25:00','2026-09-18 18:23:00','NURSE02000','Scheduled','Test','wear proper attire'),('APPT-755ddefc','DOC-ed638364','BATCH-f4d58272','2026-09-19 09:12:00','2026-09-19 09:16:00','NURSE02000','Cancelled','',''),('APPT-75ca2a1c','DOC-ed638364','BATCH-ba959091','2026-09-18 18:50:00','2026-09-18 18:55:00','NURSE02000','Scheduled','test nga ulit','bring valid ID'),('APPT-760bab33','DOC-ed638364','BATCH-3811c9c4','2026-09-18 18:35:00','2026-09-18 18:40:00','NURSE02000','Scheduled','test part 3','bring valid id'),('APPT-77387d15','DOC-ed638364','BATCH-2f9c4460','2026-09-19 07:14:00','2026-09-19 07:24:00','NURSE02000','Scheduled','Annual Physical Exam','bring id '),('APPT-79bdeef3','DOC-ed638364','BATCH-f4d58272','2026-09-18 18:06:00','2026-09-18 18:11:00','NURSE02000','Cancelled','',''),('APPT-7b7ca2e1','DOC-ed638364','BATCH-f4d58272','2026-09-18 17:31:00','2026-09-18 17:36:00','NURSE02000','Cancelled','',''),('APPT-7e410fed','DOC-ed638364','BATCH-21225e53','2026-09-18 16:43:00','2026-09-18 16:52:00','NURSE02000','Scheduled','',''),('APPT-7e8596a2','DOC-ed638364','BATCH-ef0c5a69','2026-09-22 13:02:00','2026-09-22 13:07:00','NURSE02000','Scheduled','Annua Dental Assessment','bring ID'),('APPT-8113b768','DOC-ed638364','BATCH-00d32b06','2026-09-18 18:19:00','2026-09-18 18:24:00','NURSE02000','Cancelled','',''),('APPT-8432ce5b','DOC-ed638364','BATCH-2f9c4460','2026-09-19 08:04:00','2026-09-19 08:14:00','NURSE02000','Scheduled','Annual Physical Exam','bring id '),('APPT-84a131c4','DOC-ed638364','BATCH-4b20256e','2026-09-18 16:57:00','2026-09-18 17:02:00','NURSE02000','Scheduled','General Checkup','Fasting'),('APPT-85302d09','DOC-ed638364','BATCH-7dd7ad3e','2026-09-18 18:16:00','2026-09-18 18:21:00','NURSE02000','Scheduled','test nangani','bring valid id'),('APPT-85771fe2','DOC-ed638364','BATCH-21225e53','2026-09-18 17:22:00','2026-09-18 17:27:00','NURSE02000','Scheduled','',''),('APPT-86ab0c13','DOC-ed638364','BATCH-ef0c5a69','2026-09-22 12:47:00','2026-09-22 12:52:00','NURSE02000','Scheduled','Annua Dental Assessment','bring ID'),('APPT-88e8f59b','DOC-ed638364','BATCH-1ccbd265','2026-09-18 17:48:00','2026-09-18 17:53:00','NURSE02000','Scheduled','test nanaman','dala ID'),('APPT-8f1515dc','DOC-ed638364','BATCH-00d32b06','2026-09-18 18:14:00','2026-09-18 18:19:00','NURSE02000','Cancelled','',''),('APPT-90986ab6','DOC-ed638364','BATCH-1ccbd265','2026-09-18 18:03:00','2026-09-18 18:08:00','NURSE02000','Scheduled','test nanaman','dala ID'),('APPT-947c65eb','DOC-ed638364','BATCH-6f2c0294','2026-09-21 16:30:00','2026-09-21 16:40:00','NURSE02000','Scheduled','Annual Dental Visit','bring ID'),('APPT-94f9de50','DOC-ed638364','BATCH-ad8c8ef0','2026-09-18 17:25:00','2026-09-18 18:23:00','NURSE02000','Scheduled','Test','wear proper attire'),('APPT-97664d2f','DOC-ed638364','BATCH-4b20256e','2026-09-18 17:12:00','2026-09-18 17:17:00','NURSE02000','Scheduled','General Checkup','Fasting'),('APPT-986cbc8f','DOC-ed638364','BATCH-6d6325a8','2026-09-21 15:38:00','2026-09-21 15:43:00','NURSE02000','Scheduled','Annual Dental Check up','bring id'),('APPT-9a01d199','DOC-ed638364','BATCH-2f9c4460','2026-09-19 07:04:00','2026-09-19 07:14:00','NURSE02000','Scheduled','Annual Physical Exam','bring id '),('APPT-9a17d0ee','DOC-ed638364','BATCH-0fc596b4','2026-09-22 14:00:00','2026-09-22 14:10:00','NURSE02000','Completed','Annual Dental Visit','bring id'),('APPT-9b3c612f','DOC-ed638364','BATCH-7b62ea28','2026-09-21 15:46:00','2026-09-21 15:51:00','NURSE02000','Scheduled','Annual Physical Exam','Bring ID'),('APPT-9c326aba','DOC-ed638364','BATCH-ad8c8ef0','2026-09-18 17:25:00','2026-09-18 18:23:00','NURSE02000','Scheduled','Test','wear proper attire'),('APPT-9c364e4e','DOC-ed638364','BATCH-2f9c4460','2026-09-19 08:34:00','2026-09-19 08:44:00','NURSE02000','Scheduled','Annual Physical Exam','bring id '),('APPT-9c57b861','DOC-ed638364','BATCH-00d32b06','2026-09-18 17:34:00','2026-09-18 17:39:00','NURSE02000','Cancelled','',''),('APPT-9e3a19a5','DOC-ed638364','BATCH-00d32b06','2026-09-18 17:54:00','2026-09-18 17:59:00','NURSE02000','Cancelled','',''),('APPT-9e5d918f','DOC-ed638364','BATCH-f4d58272','2026-09-18 18:01:00','2026-09-18 18:06:00','NURSE02000','Cancelled','',''),('APPT-a0b7a59f','DOC-ed638364','BATCH-216c9122','2026-09-21 17:02:00','2026-09-21 17:11:00','NURSE02000','Scheduled','Annual Doctor Visit','Bring ID'),('APPT-a29d4e29','DOC-ed638364','BATCH-00d32b06','2026-09-18 17:59:00','2026-09-18 18:04:00','NURSE02000','Cancelled','',''),('APPT-a3babcf4','DOC-ed638364','BATCH-2f9c4460','2026-09-19 08:44:00','2026-09-19 08:54:00','NURSE02000','Scheduled','Annual Physical Exam','bring id '),('APPT-a5e61c38','DOC-ed638364','BATCH-1ccbd265','2026-09-18 18:18:00','2026-09-18 18:23:00','NURSE02000','Scheduled','test nanaman','dala ID'),('APPT-a71977f8','DOC-ed638364','BATCH-2f9c4460','2026-09-19 06:54:00','2026-09-19 07:04:00','NURSE02000','Scheduled','Annual Physical Exam','bring id '),('APPT-a890c949','DOC-ed638364','BATCH-a21c095a','2026-09-18 17:31:00','2026-09-18 17:36:00','NURSE02000','Scheduled','test again','pahinga'),('APPT-aa9b171f','DOC-ed638364','BATCH-ad8c8ef0','2026-09-18 17:21:00','2026-09-18 18:23:00','NURSE02000','Scheduled','Test','wear proper attire'),('APPT-ab3302aa','DOC-ed638364','BATCH-3811c9c4','2026-09-18 18:45:00','2026-09-18 18:50:00','NURSE02000','Scheduled','test part 3','bring valid id'),('APPT-abdcd73b','DOC-ed638364','BATCH-4b20256e','2026-09-18 17:32:00','2026-09-18 17:37:00','NURSE02000','Scheduled','General Checkup','Fasting'),('APPT-ae292b23','DOC-ed638364','BATCH-3811c9c4','2026-09-18 19:05:00','2026-09-18 19:10:00','NURSE02000','Scheduled','test part 3','bring valid id'),('APPT-af2ea950','DOC-ed638364','BATCH-1ccbd265','2026-09-18 17:53:00','2026-09-18 17:58:00','NURSE02000','Scheduled','test nanaman','dala ID'),('APPT-af7b9cb3','DOC-ed638364','BATCH-ad8c8ef0','2026-09-18 17:25:00','2026-09-18 18:23:00','NURSE02000','Scheduled','Test','wear proper attire'),('APPT-afc9cb96','DOC-ed638364','BATCH-6d6325a8','2026-09-21 15:43:00','2026-09-21 15:48:00','NURSE02000','Scheduled','Annual Dental Check up','bring id'),('APPT-afd02188','DOC-ed638364','BATCH-ba959091','2026-09-18 19:15:00','2026-09-18 19:20:00','NURSE02000','Scheduled','test nga ulit','bring valid ID'),('APPT-b0545205','DOC-ed638364','BATCH-ba959091','2026-09-18 19:10:00','2026-09-18 19:15:00','NURSE02000','Scheduled','test nga ulit','bring valid ID'),('APPT-b65f504c','DOC-ed638364','BATCH-ad8c8ef0','2026-09-18 17:25:00','2026-09-18 18:23:00','NURSE02000','Scheduled','Test','wear proper attire'),('APPT-b6caab80','DOC-ed638364','BATCH-1ccbd265','2026-09-18 18:23:00','2026-09-18 18:28:00','NURSE02000','Scheduled','test nanaman','dala ID'),('APPT-ba24e366','DOC-ed638364','BATCH-3a127e3d','2026-09-15 09:57:00','2026-09-15 10:02:00','NURSE02000','Scheduled','',''),('APPT-bc213396','DOC-ed638364','BATCH-ef0c5a69','2026-09-22 12:22:00','2026-09-22 12:27:00','NURSE02000','Scheduled','Annua Dental Assessment','bring ID'),('APPT-bd1e3324','DOC-ed638364','BATCH-ef0c5a69','2026-09-22 12:52:00','2026-09-22 12:57:00','NURSE02000','Scheduled','Annua Dental Assessment','bring ID'),('APPT-beb0e36b','DOC-ed638364','BATCH-a21c095a','2026-09-18 18:11:00','2026-09-18 18:16:00','NURSE02000','Scheduled','test again','pahinga'),('APPT-c686f136','DOC-ed638364','BATCH-4b20256e','2026-09-18 17:22:00','2026-09-18 17:27:00','NURSE02000','Scheduled','General Checkup','Fasting'),('APPT-c8d0e7ce','DOC-ed638364','BATCH-2f9c4460','2026-09-19 08:24:00','2026-09-19 08:34:00','NURSE02000','Scheduled','Annual Physical Exam','bring id '),('APPT-cbd5b34b','DOC-ed638364','BATCH-3811c9c4','2026-09-18 18:30:00','2026-09-18 18:35:00','NURSE02000','Scheduled','test part 3','bring valid id'),('APPT-cc69ae2b','DOC-ed638364','BATCH-a21c095a','2026-09-18 18:06:00','2026-09-18 18:11:00','NURSE02000','Scheduled','test again','pahinga'),('APPT-cf964b9f','DOC-ed638364','BATCH-febb34a1','2026-09-15 09:50:00','2026-09-15 09:55:00','NURSE02000','Scheduled','',''),('APPT-d2a7c6af','DOC-ed638364','BATCH-ba959091','2026-09-18 18:35:00','2026-09-18 18:40:00','NURSE02000','Scheduled','test nga ulit','bring valid ID'),('APPT-d5af04e0','DOC-ed638364','BATCH-a21c095a','2026-09-18 18:01:00','2026-09-18 18:06:00','NURSE02000','Scheduled','test again','pahinga'),('APPT-d80a3827','DOC-ed638364','BATCH-ba959091','2026-09-18 18:45:00','2026-09-18 18:50:00','NURSE02000','Scheduled','test nga ulit','bring valid ID'),('APPT-d8248a34','DOC-ed638364','BATCH-ad8c8ef0','2026-09-18 17:25:00','2026-09-18 18:23:00','NURSE02000','Scheduled','Test','wear proper attire'),('APPT-d84621c9','DOC-ed638364','BATCH-00d32b06','2026-09-18 17:29:00','2026-09-18 17:34:00','NURSE02000','Cancelled','',''),('APPT-d8773044','DOC-ed638364','BATCH-1ccbd265','2026-09-18 17:43:00','2026-09-18 17:48:00','NURSE02000','Scheduled','test nanaman','dala ID'),('APPT-dbc2f7e1','DOC-ed638364','BATCH-a21c095a','2026-09-18 18:16:00','2026-09-18 18:21:00','NURSE02000','Scheduled','test again','pahinga'),('APPT-dcb7d6e3','DOC-ed638364','BATCH-3811c9c4','2026-09-18 18:25:00','2026-09-18 18:30:00','NURSE02000','Scheduled','test part 3','bring valid id'),('APPT-dd2ece85','DOC-ed638364','BATCH-f4d58272','2026-09-18 17:41:00','2026-09-18 17:46:00','NURSE02000','Scheduled','',''),('APPT-e013bcf6','DOC-ed638364','BATCH-21225e53','2026-09-18 17:32:00','2026-09-18 17:37:00','NURSE02000','Scheduled','',''),('APPT-e105f645','DOC-ed638364','BATCH-3811c9c4','2026-09-18 18:20:00','2026-09-18 18:25:00','NURSE02000','Scheduled','test part 3','bring valid id'),('APPT-e706f1cb','DOC-ed638364','BATCH-a21c095a','2026-09-18 17:41:00','2026-09-18 17:46:00','NURSE02000','Scheduled','test again','pahinga'),('APPT-e9d708d7','DOC-ed638364','BATCH-ad8c8ef0','2026-09-18 17:25:00','2026-09-18 18:23:00','NURSE02000','Scheduled','Test','wear proper attire'),('APPT-eb60f865','DOC-ed638364','BATCH-ba959091','2026-09-18 18:55:00','2026-09-18 19:00:00','NURSE02000','Scheduled','test nga ulit','bring valid ID'),('APPT-ed8dc0d2','DOC-ed638364','BATCH-ba959091','2026-09-18 18:40:00','2026-09-18 18:45:00','NURSE02000','Scheduled','test nga ulit','bring valid ID'),('APPT-edfb29a0','DOC-ed638364','BATCH-1ccbd265','2026-09-18 17:38:00','2026-09-18 17:43:00','NURSE02000','Scheduled','test nanaman','dala ID'),('APPT-efae1435','DOC-ed638364','BATCH-febb34a1','2026-09-15 09:40:00','2026-09-15 09:45:00','NURSE02000','Scheduled','',''),('APPT-f1a56f42','DOC-ed638364','BATCH-1ccbd265','2026-09-18 17:58:00','2026-09-18 18:03:00','NURSE02000','Scheduled','test nanaman','dala ID'),('APPT-f24bfd2f','DOC-ed638364','BATCH-f4d58272','2026-09-18 17:36:00','2026-09-18 17:41:00','NURSE02000','Cancelled','',''),('APPT-f2e1faa2','DOC-ed638364','BATCH-2f9c4460','2026-09-19 07:34:00','2026-09-19 07:44:00','NURSE02000','Scheduled','Annual Physical Exam','bring id '),('APPT-f39f54d5','DOC-ed638364','BATCH-21225e53','2026-09-18 17:07:00','2026-09-18 17:12:00','NURSE02000','Scheduled','',''),('APPT-f3d17fca','DOC-ed638364','BATCH-6d6325a8','2026-09-21 15:33:00','2026-09-21 15:38:00','NURSE02000','Scheduled','Annual Dental Check up','bring id'),('APPT-f4cd4273','DOC-ed638364','BATCH-c39cc872','2026-09-15 10:11:00','2026-09-15 10:16:00','NURSE02000','Scheduled','',''),('APPT-f8f8bdde','DOC-ed638364','BATCH-00d32b06','2026-09-18 18:09:00','2026-09-18 18:14:00','NURSE02000','Cancelled','',''),('APPT-fad1478b','DOC-ed638364','BATCH-ef0c5a69','2026-09-22 12:07:00','2026-09-22 12:12:00','NURSE02000','Scheduled','Annua Dental Assessment','bring ID'),('APPT-fb21ce1b','DOC-ed638364','BATCH-a21c095a','2026-09-18 18:26:00','2026-09-18 18:31:00','NURSE02000','Scheduled','test again','pahinga'),('APPT-fc6b862e','DOC-ed638364','BATCH-21225e53','2026-09-18 16:42:00','2026-09-18 16:47:00','NURSE02000','Scheduled','',''),('APPT-fc892d9d','DOC-ed638364','BATCH-4b20256e','2026-09-18 17:07:00','2026-09-18 17:12:00','NURSE02000','Scheduled','General Checkup','Fasting'),('APPT-fd77d2b7','DOC-ed638364','BATCH-00d32b06','2026-09-18 17:44:00','2026-09-18 17:49:00','NURSE02000','Cancelled','',''),('APPT-ffa688e6','DOC-ed638364','BATCH-3a127e3d','2026-09-15 09:52:00','2026-09-15 09:57:00','NURSE02000','Scheduled','','');
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
  PRIMARY KEY (`assessment_id`),
  UNIQUE KEY `idx_appointment_student` (`appointment_id`,`student_id`),
  CONSTRAINT `fk_assessment_student_appointment` FOREIGN KEY (`appointment_id`, `student_id`) REFERENCES `doctor_appointment_students` (`appointment_id`, `student_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `doctor_assessments`
--

LOCK TABLES `doctor_assessments` WRITE;
/*!40000 ALTER TABLE `doctor_assessments` DISABLE KEYS */;
INSERT INTO `doctor_assessments` VALUES ('ASM-3f854d27','APPT-9a17d0ee','02000257727','goods','goods','goods\n','2026-09-22 14:07:42');
/*!40000 ALTER TABLE `doctor_assessments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `doctors`
--

DROP TABLE IF EXISTS `doctors`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `doctors` (
  `doctor_id` varchar(45) NOT NULL,
  `first_name` varchar(100) NOT NULL,
  `last_name` varchar(100) NOT NULL,
  `specialization` varchar(100) DEFAULT NULL,
  `contact_number` varchar(20) DEFAULT NULL,
  PRIMARY KEY (`doctor_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `doctors`
--

LOCK TABLES `doctors` WRITE;
/*!40000 ALTER TABLE `doctors` DISABLE KEYS */;
INSERT INTO `doctors` VALUES ('DOC-ed638364','Alvin','Ligutan','General Physicican','09196398319');
/*!40000 ALTER TABLE `doctors` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `emergency_contacts`
--

DROP TABLE IF EXISTS `emergency_contacts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `emergency_contacts` (
  `contact_id` varchar(45) NOT NULL,
  `student_id` varchar(45) NOT NULL,
  `contact_name` varchar(200) NOT NULL,
  `relationship` varchar(50) NOT NULL,
  `contact_number` varchar(20) NOT NULL,
  `address` varchar(255) NOT NULL,
  PRIMARY KEY (`contact_id`),
  KEY `student_id` (`student_id`),
  CONSTRAINT `emergency_contacts_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `students` (`student_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `emergency_contacts`
--

LOCK TABLES `emergency_contacts` WRITE;
/*!40000 ALTER TABLE `emergency_contacts` DISABLE KEYS */;
INSERT INTO `emergency_contacts` VALUES ('106c4dc4-119c-4d70-aa2e-812d85f7eb7e','02000565656','Jonah Magat','Mother','09330680817','Georgiville Village, Orchid St., Brgy. Tarcan'),('2e41a8be-b6bd-4b2d-b2ad-8adbbaf5cab2','02000349679','Cecille Salvador','Mother','09122467876','Pampanga'),('31f1a1b9-176a-412e-9cec-1b3066b87aec','02000121416','Christine Angeles','Mother','09196398329','Georgiville Village, Orchid St., Brgy. Tarcan'),('4bea4330-935f-4374-85e5-31bc4d77adef','02000371918','Clarita Torres','Auntie','0926456822565','Stonino Zone 1, Baliuag,Bulacan'),('6030cabe-7abb-486a-8940-e66ecb1a4354','02000345411','Melicia Bernardo','Grandmother','09196398319','Georgiville Village, Orchid St., Brgy. Tarcan'),('70c39524-f1f7-47e5-876d-3c15e9032c21','02000120504','Mike Bernardo','Father','09196398329','Georgiville Village, Orchid St., Brgy. Tarcan'),('7a42eba2-841c-4545-ad87-b75a8411d03c','123456789','Yahweh Bernardo','Father','09323813833','Georgiville Village, Orchid St., Brgy. Tarcan'),('cccca6ef-2b59-496f-83c0-21a2aa0a6212','02000112233','Kenneth Doe','Father','09323813833','Makinabang,Baliuag,Bulacan'),('dae2383a-b61c-487f-a2a0-7b9ab1eab1b8','02000257727','Jonalyn D. Marcelo','Mother','09330680817','Sto.Cristo Baliuag City Bulacan'),('eb4d5243-7b55-4444-b6b6-6156c27b5d25','02000350927','Queenie Siason','Mother','09308673269','Makinabang, Baliuag, Bulacan');
/*!40000 ALTER TABLE `emergency_contacts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `emergency_hotline_directory`
--

DROP TABLE IF EXISTS `emergency_hotline_directory`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `emergency_hotline_directory` (
  `hotline_id` varchar(45) NOT NULL,
  `facility_name` varchar(150) NOT NULL,
  `contact_number` varchar(50) NOT NULL,
  `description_notes` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`hotline_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `emergency_hotline_directory`
--

LOCK TABLES `emergency_hotline_directory` WRITE;
/*!40000 ALTER TABLE `emergency_hotline_directory` DISABLE KEYS */;
INSERT INTO `emergency_hotline_directory` VALUES ('HOT-1785132135385-548','Marcelo Hospital','09196398319','For Emergency');
/*!40000 ALTER TABLE `emergency_hotline_directory` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `excuse_slip_notes`
--

DROP TABLE IF EXISTS `excuse_slip_notes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `excuse_slip_notes` (
  `note_id` varchar(45) NOT NULL,
  `request_id` varchar(45) NOT NULL,
  `sender_type` varchar(10) NOT NULL,
  `sender_id` varchar(45) NOT NULL,
  `message` text NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`note_id`),
  KEY `request_id` (`request_id`),
  CONSTRAINT `excuse_slip_notes_ibfk_1` FOREIGN KEY (`request_id`) REFERENCES `excuse_slip_requests` (`request_id`) ON DELETE CASCADE,
  CONSTRAINT `excuse_slip_notes_chk_1` CHECK ((`sender_type` in (_utf8mb4'Nurse',_utf8mb4'Student')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `excuse_slip_notes`
--

LOCK TABLES `excuse_slip_notes` WRITE;
/*!40000 ALTER TABLE `excuse_slip_notes` DISABLE KEYS */;
INSERT INTO `excuse_slip_notes` VALUES ('NOTE-1784890358550-190','EXC-e06c6aa9','Nurse','NURSE02000','Hi','2026-07-24 10:52:38'),('NOTE-1784890547167-340','EXC-e06c6aa9','Nurse','NURSE02000','ayos lang ako','2026-07-24 10:55:47'),('NOTE-1784890582534-633','EXC-524ed156','Nurse','NURSE02000','magresubmit ka','2026-07-24 10:56:22'),('NOTE-1786099198625-208','EXC-8b5d20de','Nurse','NURSE02000','sgeeee','2026-08-07 10:39:58'),('NOTE-1787371236061-935','EXC-d62ca3e6','Nurse','NURSE02000','magpasa ka ulit','2026-08-22 04:00:36'),('NOTE-1787989191111-55','EXC-cabb9867','Nurse','NURSE02000','Mag resubmit ka','2026-08-29 07:39:51'),('NOTE-1789191700343-909','EXC-92ab1a49','Nurse','NURSE02000','k.','2026-09-12 05:41:40'),('NOTE-1790125776928-385','EXC-7d4697a3','Nurse','NURSE02000','Wan2','2026-09-23 01:09:36'),('NOTE-81064842','EXC-e06c6aa9','Student','02000345411','hello','2026-07-24 10:22:17'),('NOTE-91b9e59e','EXC-e06c6aa9','Student','02000345411','kumusta ka','2026-07-24 10:54:28'),('NOTE-95dc96c2','EXC-8b5d20de','Student','02000345411','salamat','2026-08-07 10:40:48'),('NOTE-d806c3a9','EXC-e06c6aa9','Student','02000345411','miss na kita ','2026-07-24 10:54:35');
/*!40000 ALTER TABLE `excuse_slip_notes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `excuse_slip_requests`
--

DROP TABLE IF EXISTS `excuse_slip_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `excuse_slip_requests` (
  `request_id` varchar(45) NOT NULL,
  `student_id` varchar(45) NOT NULL,
  `reason_for_excuse` text NOT NULL,
  `valid_absence_start` date NOT NULL,
  `valid_absence_end` date NOT NULL,
  `student_proof_url` varchar(512) DEFAULT NULL,
  `status` varchar(20) DEFAULT 'Pending',
  `issued_by` varchar(45) DEFAULT NULL,
  `issued_at` timestamp NULL DEFAULT NULL,
  `issued_slip_url` varchar(512) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`request_id`),
  KEY `student_id` (`student_id`),
  KEY `issued_by` (`issued_by`),
  CONSTRAINT `excuse_slip_requests_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `students` (`student_id`),
  CONSTRAINT `excuse_slip_requests_ibfk_2` FOREIGN KEY (`issued_by`) REFERENCES `nurses` (`nurse_id`),
  CONSTRAINT `excuse_slip_requests_chk_1` CHECK ((`status` in (_utf8mb4'Pending',_utf8mb4'Approved',_utf8mb4'Completed',_utf8mb4'Denied',_utf8mb4'Rejected')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `excuse_slip_requests`
--

LOCK TABLES `excuse_slip_requests` WRITE;
/*!40000 ALTER TABLE `excuse_slip_requests` DISABLE KEYS */;
INSERT INTO `excuse_slip_requests` VALUES ('EXC-078e9660','02000257727','nagtae talaga','2026-09-14','2026-09-19',NULL,'Completed','NURSE02000','2026-09-21 17:48:28','/uploads/EXC-078e9660-1790012908452-118802707.pdf','2026-09-21 17:47:54'),('EXC-1e3c2ceb','02000257727','nagtatae talaga','2026-09-14','2026-09-18','/uploads/02000257727-1790014539046-494972576.txt','Completed','NURSE02000','2026-09-21 18:24:45','/uploads/EXC-1e3c2ceb-1790015085312-769209544.pdf','2026-09-21 18:15:39'),('EXC-2c3fec20','02000257727','nagtae ','2026-09-14','2026-09-18','/uploads/02000257727-1790051417415-691913385.png','Completed','NURSE02000','2026-09-22 04:33:20','/uploads/EXC-2c3fec20-1790051600065-402806894.pdf','2026-09-22 04:30:17'),('EXC-308c4efe','02000257727','dfghjk','2026-09-21','2026-09-22','/uploads/02000257727-1790125553451-701635250.jpg','Completed','NURSE02000','2026-09-23 01:06:46','/uploads/EXC-308c4efe-1790125606149-478283194.pdf','2026-09-23 01:05:53'),('EXC-39d2f8df','02000349679','nagtae po ako','2026-09-07','2026-09-12','/uploads/02000349679-1789312302783-848689148.png','Completed','NURSE02000','2026-09-13 15:26:16','/uploads/EXC-39d2f8df-1789313176372-591242782.pdf','2026-09-13 15:11:42'),('EXC-3a2b2ccc','02000257727','nagtae talaga ako','2026-09-14','2026-09-18','/uploads/02000257727-1790013118892-256889194.png','Completed','NURSE02000','2026-09-21 17:52:37','/uploads/EXC-3a2b2ccc-1790013157241-773844572.pdf','2026-09-21 17:51:58'),('EXC-3ad8a56c','02000257727','nagtatae talaga','2026-09-14','2026-09-18','/uploads/02000257727-1790014539967-176562137.txt','Completed','NURSE02000','2026-09-21 18:24:49','/uploads/EXC-3ad8a56c-1790015089229-255575692.pdf','2026-09-21 18:15:39'),('EXC-524ed156','02000345411','bat ayaw na','2026-07-25','2026-07-27',NULL,'Denied','NURSE02000','2026-07-24 10:56:06',NULL,'2026-07-24 08:38:08'),('EXC-588bcb23','02000257727','nagtae talaga ako','2026-09-14','2026-09-18','/uploads/02000257727-1790013594723-719492019.png','Completed','NURSE02000','2026-09-21 18:00:17','/uploads/EXC-588bcb23-1790013617879-130403692.pdf','2026-09-21 17:59:54'),('EXC-5ff6659e','02000257727','sumakit tiyan','2026-09-14','2026-09-16',NULL,'Completed','NURSE02000','2026-09-22 15:50:53','/uploads/EXC-5ff6659e-1790092252990-741106568.pdf','2026-09-22 06:35:07'),('EXC-67a64c2b','02000345411','may lagnat po ako','2026-09-01','2026-09-05','/uploads/02000345411-1788766986922-816892501.jpg','Denied','NURSE02000','2026-09-07 07:47:34',NULL,'2026-09-07 07:43:07'),('EXC-750b4050','02000257727','nagtatae talaga','2026-09-14','2026-09-18','/uploads/02000257727-1790015019598-437026077.txt','Completed','NURSE02000','2026-09-21 18:24:35','/uploads/EXC-750b4050-1790015075252-368146495.pdf','2026-09-21 18:23:39'),('EXC-7d4697a3','02000257727','sadfghj','2026-09-15','2026-09-15','/uploads/02000257727-1790125736783-764588838.png','Completed','NURSE02000','2026-09-23 01:09:36','/uploads/EXC-7d4697a3-1790125776901-134748174.pdf','2026-09-23 01:08:56'),('EXC-84dd62e8','02000257727','nagtae','2026-09-14','2026-09-18','/uploads/02000257727-1790012512628-293230297.txt','Completed','NURSE02000','2026-09-21 17:44:08','/uploads/EXC-84dd62e8-1790012648585-68557691.pdf','2026-09-21 17:41:52'),('EXC-8b5d20de','02000345411','Natatae ako by yahweh','2026-08-07','2026-08-07','/uploads/02000345411-1786099141060-541009884.png','Completed','NURSE02000','2026-08-07 10:45:02','/uploads/EXC-8b5d20de-1786099502398-435336806.png','2026-08-07 10:39:01'),('EXC-8df4d0c2','02000349679','headache','2026-09-09','2026-09-10','/uploads/02000349679-1789195125258-550985375.png','Completed','NURSE02000','2026-09-13 06:31:56','/uploads/EXC-8df4d0c2-1789281116161-643208917.pdf','2026-09-12 06:38:45'),('EXC-92ab1a49','02000371918','..','2026-09-12','2026-09-14',NULL,'Completed','NURSE02000','2026-09-12 05:44:03','/uploads/EXC-92ab1a49-1789191843054-39255530.png','2026-09-12 05:39:53'),('EXC-9370e61e','02000257727','nagtae','2026-09-14','2026-09-14',NULL,'Completed','NURSE02000','2026-09-21 17:44:19','/uploads/EXC-9370e61e-1790012659415-287296487.pdf','2026-09-21 17:36:16'),('EXC-96f23604','02000257727','operation','2026-09-23','2026-09-23','/uploads/02000257727-1790125273544-938562985.jpg','Denied','NURSE02000','2026-09-23 01:03:48',NULL,'2026-09-23 01:01:13'),('EXC-9838cb82','02000345411','Natatae na talaga ako pramis','2026-07-25','2026-07-28',NULL,'Completed','NURSE02000','2026-07-24 08:49:32','/uploads/EXC-9838cb82-1784882972143-28234062.png','2026-07-23 14:03:51'),('EXC-b87a4c3d','02000257727','masakit tiyam','2026-09-14','2026-09-18','/uploads/02000257727-1790015673638-750545043.png','Completed','NURSE02000','2026-09-21 18:36:27','/uploads/EXC-b87a4c3d-1790015787568-228552817.pdf','2026-09-21 18:34:33'),('EXC-bdc35969','02000257727','nagtatae po talaga ako ','2026-09-14','2026-09-18',NULL,'Completed','NURSE02000','2026-09-21 18:36:37','/uploads/EXC-bdc35969-1790015797665-628894133.pdf','2026-09-21 18:25:33'),('EXC-c405eed0','02000345411','masakit tiyan','2026-09-14','2026-09-16','/uploads/02000345411-1790010216289-898011866.png','Completed','NURSE02000','2026-09-21 17:04:23','/uploads/EXC-c405eed0-1790010263786-899490026.pdf','2026-09-21 17:03:36'),('EXC-cabb9867','02000565656','Diarrhea','2026-08-31','2026-08-31','/uploads/02000565656-1787988362894-177907918.png','Completed','NURSE02000','2026-09-13 06:40:19','/uploads/EXC-cabb9867-1789281619744-972339274.pdf','2026-08-29 07:26:02'),('EXC-cc84b470','02000257727','nagtae','2026-09-14','2026-09-18','/uploads/02000257727-1790012818363-286161729.png','Completed','NURSE02000','2026-09-21 17:47:10','/uploads/EXC-cc84b470-1790012830488-546937917.pdf','2026-09-21 17:46:58'),('EXC-d62ca3e6','02000345411','LBM','2026-08-24','2026-08-24','/uploads/02000345411-1787371168110-186992049.png','Completed','NURSE02000','2026-09-13 06:40:45','/uploads/EXC-d62ca3e6-1789281644963-229615617.pdf','2026-08-22 03:59:28'),('EXC-dd29ce87','02000345411','Masakit ang ipin','2026-08-08','2026-08-09','/uploads/02000345411-1786175129857-732522744.png','Completed','NURSE02000','2026-09-19 06:46:34','/uploads/EXC-dd29ce87-1789800394333-354140231.pdf','2026-08-08 07:45:29'),('EXC-e06c6aa9','02000345411','ayaw parin ba','2026-07-27','2026-07-31','/uploads/02000345411-1784882407329-958788533.png','Completed','NURSE02000','2026-09-21 17:35:12','/uploads/EXC-e06c6aa9-1790012112705-960239768.pdf','2026-07-24 08:40:07'),('EXC-e4b62c83','02000257727','nagtatae talaga','2026-09-14','2026-09-18','/uploads/02000257727-1790014536337-869218197.txt','Completed','NURSE02000','2026-09-21 18:24:56','/uploads/EXC-e4b62c83-1790015096857-520014406.pdf','2026-09-21 18:15:36'),('EXC-e51fdc4e','02000257727','Sumakit tiyan','2026-09-14','2026-09-25','/uploads/02000257727-1789996671225-349343860.png','Completed','NURSE02000','2026-09-21 13:24:35','/uploads/EXC-e51fdc4e-1789997075317-745816195.pdf','2026-09-21 13:17:51'),('EXC-e616e4c5','02000257727','nagtae\r\n','2026-09-14','2026-09-19','/uploads/02000257727-1790012755430-65997000.png','Completed','NURSE02000','2026-09-21 17:46:15','/uploads/EXC-e616e4c5-1790012775765-46000168.pdf','2026-09-21 17:45:55'),('EXC-ecc84d90','02000257727','nagtatae talaga','2026-09-14','2026-09-18','/uploads/02000257727-1790014540677-505341390.txt','Completed','NURSE02000','2026-09-21 18:24:41','/uploads/EXC-ecc84d90-1790015081260-809310078.pdf','2026-09-21 18:15:40');
/*!40000 ALTER TABLE `excuse_slip_requests` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `facility_services`
--

DROP TABLE IF EXISTS `facility_services`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `facility_services` (
  `service_id` varchar(45) NOT NULL,
  `facility_id` varchar(45) NOT NULL,
  `service_name` varchar(255) NOT NULL,
  `description` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`service_id`),
  KEY `facility_id` (`facility_id`),
  CONSTRAINT `facility_services_ibfk_1` FOREIGN KEY (`facility_id`) REFERENCES `partner_facilities` (`facility_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `facility_services`
--

LOCK TABLES `facility_services` WRITE;
/*!40000 ALTER TABLE `facility_services` DISABLE KEYS */;
INSERT INTO `facility_services` VALUES ('SRV-031183e9','FAC-915c0224','X -Ray',NULL,'2026-09-13 12:56:26'),('SRV-0ed79e0e','FAC-ed3a37fa','Medical Certificate',NULL,'2026-09-13 12:59:08'),('SRV-4428c2a3','FAC-915c0224','Hepa A',NULL,'2026-09-13 15:06:46');
/*!40000 ALTER TABLE `facility_services` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `incident_reports`
--

DROP TABLE IF EXISTS `incident_reports`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `incident_reports` (
  `incident_id` varchar(45) NOT NULL,
  `student_id` varchar(45) NOT NULL,
  `nurse_id` varchar(45) NOT NULL,
  `incident_datetime` timestamp NOT NULL,
  `incident_location` varchar(255) NOT NULL,
  `incident_description` text NOT NULL,
  `first_aid_administered` text NOT NULL,
  `current_physical_situation` text NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`incident_id`),
  KEY `student_id` (`student_id`),
  KEY `nurse_id` (`nurse_id`),
  CONSTRAINT `incident_reports_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `students` (`student_id`),
  CONSTRAINT `incident_reports_ibfk_2` FOREIGN KEY (`nurse_id`) REFERENCES `nurses` (`nurse_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `incident_reports`
--

LOCK TABLES `incident_reports` WRITE;
/*!40000 ALTER TABLE `incident_reports` DISABLE KEYS */;
INSERT INTO `incident_reports` VALUES ('INC-1785134398372-563','02000345411','NURSE02000','2026-07-27 05:00:00','Room 201','Nadapa','Apply Bandaid','Rest in Clinic','2026-07-27 06:39:58'),('INC-1787989656429-484','02000565656','NURSE02000','2026-08-30 07:46:00','202','Nadapa','Binigyan ng bandaid','Taking a rest','2026-08-29 07:47:36'),('INC-1789205729555-177','02000257727','NURSE02000','2026-09-12 09:35:00','202','','','','2026-09-12 09:35:29'),('INC-1790045119033-747','02000345411','NURSE02000','2026-09-22 02:44:00','2nd floor','falling','give betadine','rest in clinic','2026-09-22 02:45:19'),('INC-1790045303874-622','02000257727','NURSE02000','2026-09-22 02:47:00','201','Falling','Give First Aid','Back to Class','2026-09-22 02:48:23'),('INC-1790046007274-222','02000257727','NURSE02000','2026-09-22 02:59:00','201','Falling','Give Bethadine','Take Rest','2026-09-22 03:00:07');
/*!40000 ALTER TABLE `incident_reports` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `insurance_vault_files`
--

DROP TABLE IF EXISTS `insurance_vault_files`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `insurance_vault_files` (
  `vault_file_id` varchar(45) NOT NULL,
  `student_id` varchar(45) NOT NULL,
  `document_name` varchar(150) NOT NULL,
  `file_url` varchar(512) NOT NULL,
  `description_notes` text,
  `uploaded_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `managed_by_nurse_id` varchar(45) DEFAULT NULL,
  PRIMARY KEY (`vault_file_id`),
  KEY `student_id` (`student_id`),
  KEY `managed_by_nurse_id` (`managed_by_nurse_id`),
  CONSTRAINT `insurance_vault_files_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `students` (`student_id`) ON DELETE CASCADE,
  CONSTRAINT `insurance_vault_files_ibfk_2` FOREIGN KEY (`managed_by_nurse_id`) REFERENCES `nurses` (`nurse_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `insurance_vault_files`
--

LOCK TABLES `insurance_vault_files` WRITE;
/*!40000 ALTER TABLE `insurance_vault_files` DISABLE KEYS */;
INSERT INTO `insurance_vault_files` VALUES ('VF-1785217495873','02000345411','Insurance Vault Created','','Vault folder initialized.','2026-07-28 05:44:55','NURSE02000'),('VF-1787989693722','02000565656','Insurance Vault Created','','Vault folder initialized.','2026-08-29 07:48:13','NURSE02000'),('VF-1787989725711','02000565656','Dog','/uploads/02000565656-1787989725645-766416513.png','','2026-08-29 07:48:45','NURSE02000');
/*!40000 ALTER TABLE `insurance_vault_files` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `mass_schedule_batches`
--

DROP TABLE IF EXISTS `mass_schedule_batches`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `mass_schedule_batches` (
  `batch_id` varchar(45) NOT NULL,
  `assigned_by_nurse_id` varchar(45) NOT NULL,
  `target_program` varchar(100) DEFAULT NULL,
  `target_year_level` int DEFAULT NULL,
  `target_section` varchar(20) DEFAULT NULL,
  `start_time` timestamp NOT NULL,
  `end_time` timestamp NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`batch_id`),
  KEY `assigned_by_nurse_id` (`assigned_by_nurse_id`),
  CONSTRAINT `mass_schedule_batches_ibfk_1` FOREIGN KEY (`assigned_by_nurse_id`) REFERENCES `nurses` (`nurse_id`),
  CONSTRAINT `chk_batch_time` CHECK ((`end_time` > `start_time`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `mass_schedule_batches`
--

LOCK TABLES `mass_schedule_batches` WRITE;
/*!40000 ALTER TABLE `mass_schedule_batches` DISABLE KEYS */;
INSERT INTO `mass_schedule_batches` VALUES ('BATCH-00d32b06','NURSE02000',NULL,NULL,NULL,'2026-09-18 17:29:00','2026-09-18 18:29:00','2026-09-18 16:30:02'),('BATCH-075c4035','NURSE02000','BSIT',NULL,'B','2026-09-26 09:46:00','2026-09-26 12:46:00','2026-09-18 09:47:24'),('BATCH-0832cd39','NURSE02000',NULL,NULL,NULL,'2026-09-15 06:00:00','2026-09-15 07:00:00','2026-09-15 05:54:34'),('BATCH-0fc596b4','NURSE02000',NULL,NULL,NULL,'2026-09-22 14:00:00','2026-09-22 15:00:00','2026-09-22 14:05:34'),('BATCH-1aa9e53e','NURSE02000',NULL,NULL,NULL,'2026-09-15 09:03:00','2026-09-15 09:23:00','2026-09-15 09:01:42'),('BATCH-1ccbd265','NURSE02000',NULL,NULL,NULL,'2026-09-18 17:33:00','2026-09-18 19:33:00','2026-09-18 17:34:01'),('BATCH-21225e53','NURSE02000',NULL,NULL,NULL,'2026-09-18 16:37:00','2026-09-18 18:00:00','2026-09-18 16:35:16'),('BATCH-216c9122','NURSE02000',NULL,NULL,NULL,'2026-09-21 16:53:00','2026-09-21 17:30:00','2026-09-21 16:51:16'),('BATCH-23cfc3e6','NURSE02000',NULL,NULL,NULL,'2026-07-26 00:50:00','2026-07-26 01:50:00','2026-07-26 08:35:27'),('BATCH-2f9c4460','NURSE02000',NULL,NULL,NULL,'2026-09-19 06:54:00','2026-09-19 08:54:00','2026-09-19 06:53:56'),('BATCH-3811c9c4','NURSE02000','BSIT',NULL,NULL,'2026-09-18 18:20:00','2026-09-18 19:20:00','2026-09-18 18:19:41'),('BATCH-3a127e3d','NURSE02000',NULL,NULL,NULL,'2026-09-15 09:52:00','2026-09-15 10:12:00','2026-09-15 09:52:56'),('BATCH-4b20256e','NURSE02000',NULL,NULL,NULL,'2026-09-18 16:57:00','2026-09-18 17:58:00','2026-09-18 16:57:42'),('BATCH-6555eeff','NURSE02000','BSBA',NULL,NULL,'2026-07-26 00:30:00','2026-07-26 01:30:00','2026-07-26 08:33:32'),('BATCH-6d6325a8','NURSE02000',NULL,NULL,NULL,'2026-09-21 15:33:00','2026-09-21 15:50:00','2026-09-21 15:32:30'),('BATCH-6f2c0294','NURSE02000',NULL,NULL,NULL,'2026-09-21 16:30:00','2026-09-21 16:52:00','2026-09-21 16:48:27'),('BATCH-76ec0115','NURSE02000',NULL,NULL,NULL,'2026-07-26 00:50:00','2026-07-26 01:50:00','2026-07-26 08:38:15'),('BATCH-7955b63b','NURSE02000',NULL,NULL,NULL,'2026-09-15 06:45:00','2026-09-15 09:48:00','2026-09-15 06:44:40'),('BATCH-7b62ea28','NURSE02000',NULL,NULL,NULL,'2026-09-21 15:41:00','2026-09-21 15:59:00','2026-09-21 15:39:15'),('BATCH-7dd7ad3e','NURSE02000',NULL,NULL,NULL,'2026-09-18 18:16:00','2026-09-18 19:16:00','2026-09-18 18:14:53'),('BATCH-8364499c','NURSE02000',NULL,NULL,NULL,'2026-07-27 09:50:00','2026-07-27 10:50:00','2026-07-26 08:46:21'),('BATCH-86959624','NURSE02000','BSBA',NULL,NULL,'2026-07-26 00:30:00','2026-07-26 01:30:00','2026-07-26 08:24:27'),('BATCH-a21c095a','NURSE02000',NULL,NULL,NULL,'2026-09-18 17:31:00','2026-09-18 18:31:00','2026-09-18 17:32:07'),('BATCH-ad8c8ef0','NURSE02000',NULL,NULL,NULL,'2026-09-18 17:25:00','2026-09-18 18:23:00','2026-09-18 17:23:32'),('BATCH-b554e91f','NURSE02000',NULL,NULL,NULL,'2026-07-25 21:00:00','2026-07-25 22:00:00','2026-07-26 04:53:21'),('BATCH-ba959091','NURSE02000',NULL,NULL,NULL,'2026-09-18 18:35:00','2026-09-18 19:51:00','2026-09-18 18:25:38'),('BATCH-c39cc872','NURSE02000',NULL,NULL,NULL,'2026-09-15 10:06:00','2026-09-15 10:25:00','2026-09-15 10:05:34'),('BATCH-e340e3a8','NURSE02000',NULL,NULL,NULL,'2026-07-26 08:55:00','2026-07-26 09:55:00','2026-07-26 08:50:36'),('BATCH-e37e3cc2','NURSE02000',NULL,NULL,NULL,'2026-09-15 06:58:00','2026-09-15 08:58:00','2026-09-15 06:57:47'),('BATCH-ef0c5a69','NURSE02000',NULL,NULL,NULL,'2026-09-22 12:07:00','2026-09-22 13:00:00','2026-09-22 02:29:12'),('BATCH-f4d58272','NURSE02000','BSIT',1,NULL,'2026-09-18 17:11:00','2026-09-18 18:11:00','2026-09-18 16:12:40'),('BATCH-febb34a1','NURSE02000',NULL,NULL,NULL,'2026-09-15 09:40:00','2026-09-15 10:00:00','2026-09-15 09:40:49');
/*!40000 ALTER TABLE `mass_schedule_batches` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `medical_requirements`
--

DROP TABLE IF EXISTS `medical_requirements`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `medical_requirements` (
  `requirement_name` varchar(150) NOT NULL,
  PRIMARY KEY (`requirement_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `medical_requirements`
--

LOCK TABLES `medical_requirements` WRITE;
/*!40000 ALTER TABLE `medical_requirements` DISABLE KEYS */;
INSERT INTO `medical_requirements` VALUES ('Babae'),('CBC'),('Dental Assessment'),('Drug Test'),('Hepa A'),('Hepa B'),('Maging Mayaman'),('Medical Certificate'),('Medicine'),('Special Requirements ito'),('Urine Test'),('Vision Assessment'),('X - Ray'),('X - Ray for third year'),('X Ray'),('X-Ray'),('XRAY');
/*!40000 ALTER TABLE `medical_requirements` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `medicine_indications`
--

DROP TABLE IF EXISTS `medicine_indications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `medicine_indications` (
  `indication_id` varchar(45) NOT NULL,
  `medicine_id` varchar(45) NOT NULL,
  `complaint_id` varchar(45) NOT NULL,
  `specify_complaint_text` varchar(45) DEFAULT NULL,
  PRIMARY KEY (`indication_id`),
  KEY `medicine_id` (`medicine_id`),
  KEY `medicine_indications_ibfk_2` (`complaint_id`),
  CONSTRAINT `medicine_indications_ibfk_1` FOREIGN KEY (`medicine_id`) REFERENCES `medicines` (`medicine_id`),
  CONSTRAINT `medicine_indications_ibfk_2` FOREIGN KEY (`complaint_id`) REFERENCES `chief_complaints` (`complaint_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `medicine_indications`
--

LOCK TABLES `medicine_indications` WRITE;
/*!40000 ALTER TABLE `medicine_indications` DISABLE KEYS */;
INSERT INTO `medicine_indications` VALUES ('1b1c8cbe-9527-4164-babf-c142b66bb144','78d441a2-a804-4914-b99e-523134df4b47','HEADACHE02000',NULL),('522cac0d-39fe-40ce-85f4-f18b1801e080','95242a99-ccf0-4daa-937b-b46516465647','BODYPAIN02000',NULL),('dbd49bac-44e2-4686-88de-1a7381314433','78d441a2-a804-4914-b99e-523134df4b47','FEVER02000',NULL),('f07dfb7c-897c-4ffa-bb05-15a7b3755add','95242a99-ccf0-4daa-937b-b46516465647','FEVER02000',NULL),('f1f3d0c4-d81f-4805-9705-52875e5e2118','142851d9-6ad0-4d6a-ae89-970db9000746','OTHERS02000','Infection');
/*!40000 ALTER TABLE `medicine_indications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `medicine_inventory_batches`
--

DROP TABLE IF EXISTS `medicine_inventory_batches`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `medicine_inventory_batches` (
  `batch_id` varchar(45) NOT NULL,
  `medicine_id` varchar(45) NOT NULL,
  `expiration_date` date NOT NULL,
  `current_stock` int NOT NULL DEFAULT '0',
  `remaining_volume` decimal(10,2) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`batch_id`),
  KEY `medicine_id` (`medicine_id`),
  CONSTRAINT `medicine_inventory_batches_ibfk_1` FOREIGN KEY (`medicine_id`) REFERENCES `medicines` (`medicine_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `medicine_inventory_batches`
--

LOCK TABLES `medicine_inventory_batches` WRITE;
/*!40000 ALTER TABLE `medicine_inventory_batches` DISABLE KEYS */;
INSERT INTO `medicine_inventory_batches` VALUES ('66f77537-703c-451e-9049-2f83e41c8e92','78d441a2-a804-4914-b99e-523134df4b47','2028-01-27',1,1.00,'2026-09-17 05:01:42'),('7bd49b5e-e05e-40f9-823e-e0b0280da85c','95242a99-ccf0-4daa-937b-b46516465647','2028-01-17',8,485.00,'2026-09-17 09:18:03'),('9eb083ea-d3ed-45ad-a52c-4b3f4373bfbe','95242a99-ccf0-4daa-937b-b46516465647','2028-12-22',19,500.00,'2026-09-22 10:55:18'),('a00a43f3-bae9-47fb-9d74-940e49aa3a57','142851d9-6ad0-4d6a-ae89-970db9000746','2028-01-17',0,0.00,'2026-09-17 08:26:22');
/*!40000 ALTER TABLE `medicine_inventory_batches` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `medicines`
--

DROP TABLE IF EXISTS `medicines`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `medicines` (
  `medicine_id` varchar(45) NOT NULL,
  `generic_name` varchar(100) NOT NULL,
  `brand_name` varchar(100) NOT NULL,
  `dosage_form` enum('Tablet','Capsule','Sachet','Patch','Syrup','Suspension','Drops','Bottle','Vial','Prefilled Syringe','Ointment','Cream','Inhaler','Spray','Gel','Box') NOT NULL,
  `strength_unit_value` decimal(10,2) NOT NULL,
  `strength_unit_of_measure` enum('mg','g','mcg','mL','L','Tablet/s','Capsule/s','Patch/es','Sachet','Vial','Prefilled Syringe','Spray/s','Inhaler','Box/es','pcs.') NOT NULL,
  `avg_dosage_consumption_value` decimal(10,2) DEFAULT '0.00',
  `avg_dosage_consumption_unit_of_measure` enum('mg','g','mcg','mL','L','Tablet/s','Capsule/s','Patch/es','Sachet','Vial','Prefilled Syringe','Spray/s','Inhaler','Box/es','pcs.') NOT NULL,
  `low_stock_level` int NOT NULL DEFAULT '0',
  `critical_stock_level` int NOT NULL DEFAULT '0',
  `adequate_stock_level` int NOT NULL DEFAULT '0',
  PRIMARY KEY (`medicine_id`),
  CONSTRAINT `chk_consumption_unit_hierarchy` CHECK ((((`strength_unit_of_measure` in (_utf8mb4'Tablet/s',_utf8mb4'Capsule/s',_utf8mb4'Patch/es',_utf8mb4'Sachet',_utf8mb4'Vial',_utf8mb4'Prefilled Syringe',_utf8mb4'Spray/s',_utf8mb4'Inhaler',_utf8mb4'Box/es',_utf8mb4'pcs.')) and (`avg_dosage_consumption_unit_of_measure` = `strength_unit_of_measure`)) or ((`strength_unit_of_measure` = _utf8mb4'g') and (`avg_dosage_consumption_unit_of_measure` in (_utf8mb4'g',_utf8mb4'mg',_utf8mb4'mcg'))) or ((`strength_unit_of_measure` = _utf8mb4'mg') and (`avg_dosage_consumption_unit_of_measure` in (_utf8mb4'mg',_utf8mb4'mcg'))) or ((`strength_unit_of_measure` = _utf8mb4'mcg') and (`avg_dosage_consumption_unit_of_measure` = _utf8mb4'mcg')) or ((`strength_unit_of_measure` = _utf8mb4'L') and (`avg_dosage_consumption_unit_of_measure` in (_utf8mb4'L',_utf8mb4'mL'))) or ((`strength_unit_of_measure` = _utf8mb4'mL') and (`avg_dosage_consumption_unit_of_measure` = _utf8mb4'mL')))),
  CONSTRAINT `chk_valid_dosage_units` CHECK ((((`dosage_form` = _utf8mb4'Tablet') and (`strength_unit_of_measure` in (_utf8mb4'mg',_utf8mb4'g',_utf8mb4'mcg',_utf8mb4'Tablet/s'))) or ((`dosage_form` = _utf8mb4'Capsule') and (`strength_unit_of_measure` in (_utf8mb4'mg',_utf8mb4'g',_utf8mb4'mcg',_utf8mb4'Capsule/s'))) or ((`dosage_form` = _utf8mb4'Sachet') and (`strength_unit_of_measure` in (_utf8mb4'mg',_utf8mb4'g',_utf8mb4'mcg',_utf8mb4'Sachet'))) or ((`dosage_form` = _utf8mb4'Patch') and (`strength_unit_of_measure` in (_utf8mb4'mg',_utf8mb4'mcg',_utf8mb4'Patch/es'))) or ((`dosage_form` = _utf8mb4'Inhaler') and (`strength_unit_of_measure` in (_utf8mb4'mg',_utf8mb4'mcg',_utf8mb4'Inhaler'))) or ((`dosage_form` in (_utf8mb4'Syrup',_utf8mb4'Suspension',_utf8mb4'Drops',_utf8mb4'Bottle')) and (`strength_unit_of_measure` in (_utf8mb4'mL',_utf8mb4'L',_utf8mb4'mg',_utf8mb4'mcg'))) or ((`dosage_form` = _utf8mb4'Vial') and (`strength_unit_of_measure` in (_utf8mb4'mL',_utf8mb4'L',_utf8mb4'mg',_utf8mb4'mcg',_utf8mb4'Vial'))) or ((`dosage_form` = _utf8mb4'Prefilled Syringe') and (`strength_unit_of_measure` in (_utf8mb4'mL',_utf8mb4'mg',_utf8mb4'Prefilled Syringe'))) or ((`dosage_form` in (_utf8mb4'Ointment',_utf8mb4'Cream',_utf8mb4'Gel')) and (`strength_unit_of_measure` in (_utf8mb4'g',_utf8mb4'mg',_utf8mb4'mL'))) or ((`dosage_form` = _utf8mb4'Spray') and (`strength_unit_of_measure` in (_utf8mb4'mg',_utf8mb4'mcg',_utf8mb4'mL',_utf8mb4'Spray/s'))) or ((`dosage_form` = _utf8mb4'Box') and (`strength_unit_of_measure` in (_utf8mb4'mg',_utf8mb4'g',_utf8mb4'mcg',_utf8mb4'mL',_utf8mb4'Box/es',_utf8mb4'pcs.')))))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `medicines`
--

LOCK TABLES `medicines` WRITE;
/*!40000 ALTER TABLE `medicines` DISABLE KEYS */;
INSERT INTO `medicines` VALUES ('142851d9-6ad0-4d6a-ae89-970db9000746','Ethyl','Alcohol','Box',10.00,'pcs.',1.00,'pcs.',7,3,10),('78d441a2-a804-4914-b99e-523134df4b47','Paracetamol','Biogesic','Tablet',1.00,'Tablet/s',1.00,'Tablet/s',10,5,20),('95242a99-ccf0-4daa-937b-b46516465647','Katinko','Katinko Spray','Spray',500.00,'mL',5.00,'mL',10,5,20);
/*!40000 ALTER TABLE `medicines` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `messages`
--

DROP TABLE IF EXISTS `messages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `messages` (
  `message_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `sender_id` varchar(45) COLLATE utf8mb4_unicode_ci NOT NULL,
  `receiver_id` varchar(45) COLLATE utf8mb4_unicode_ci NOT NULL,
  `message_type` enum('text','image','file','audio','video') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'text',
  `content` text COLLATE utf8mb4_unicode_ci,
  `media_url` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_read` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` timestamp(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`message_id`),
  KEY `idx_sender_receiver` (`sender_id`,`receiver_id`,`message_id` DESC),
  KEY `idx_receiver_read` (`receiver_id`,`is_read`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `messages`
--

LOCK TABLES `messages` WRITE;
/*!40000 ALTER TABLE `messages` DISABLE KEYS */;
INSERT INTO `messages` VALUES (2,'NRS02000','STDNT345411','text','hi',NULL,1,'2026-09-03 05:22:01.339','2026-09-04 13:52:06'),(3,'NRS02000','PRNT001','text','hi',NULL,0,'2026-09-03 05:32:41.130','2026-09-03 05:32:41'),(4,'STDNT345411','NRS02000','text','hello po',NULL,1,'2026-09-04 13:52:17.195','2026-09-04 13:52:53'),(5,'STDNT345411','NRS02000','text','Hello Nurse!!!',NULL,1,'2026-09-07 07:37:25.658','2026-09-12 06:59:06'),(6,'STDNT257727','PRNT003','text','hi',NULL,0,'2026-09-18 09:21:54.704','2026-09-18 09:21:54'),(7,'STDNT257727','NRS02000','text','hihi',NULL,1,'2026-09-18 09:22:00.801','2026-09-18 09:24:03');
/*!40000 ALTER TABLE `messages` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notifications`
--

DROP TABLE IF EXISTS `notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notifications` (
  `notification_id` varchar(45) NOT NULL,
  `sender_id` varchar(45) DEFAULT NULL,
  `recipient_id` varchar(45) NOT NULL,
  `title` varchar(255) DEFAULT NULL,
  `message` text NOT NULL,
  `type` varchar(50) DEFAULT 'general',
  `is_read` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `read_at` timestamp NULL DEFAULT NULL,
  `navigate_jd` varchar(45) DEFAULT NULL,
  PRIMARY KEY (`notification_id`),
  KEY `fk_notifications_sender` (`sender_id`),
  KEY `idx_recipient_read` (`recipient_id`,`is_read`,`created_at` DESC),
  CONSTRAINT `fk_notifications_recipient` FOREIGN KEY (`recipient_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_notifications_sender` FOREIGN KEY (`sender_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notifications`
--

LOCK TABLES `notifications` WRITE;
/*!40000 ALTER TABLE `notifications` DISABLE KEYS */;
INSERT INTO `notifications` VALUES ('00177fa1-0088-428d-b504-226664e83fcc',NULL,'a406d9f4-2525-4a26-af5a-5003dec47f67','New Health Screening: Annual BMI Monitoring','You have been scheduled for a BMI Screening.\nDate: 2026-09-22\nTime: 00:31 - 02:30\nProgram: All Programs','SCREENING_SCHEDULED',0,'2026-09-21 16:28:57',NULL,NULL),('007cb8f0-cf7b-4edd-a67a-a1f2641af10a','NRS02000','PRNT003','Clinic Visit Logged: Clark Ken Marcelo','Clark Ken Marcelo visited for General Checkup. Time In: 21:40:00','clinic_visit',0,'2026-09-22 13:40:21',NULL,NULL),('00d9e5f5-ed1f-4030-a97a-2eff090f2970',NULL,'STDNT112233','Doctor Visit Rescheduled','Moved to 9/23/26, 12:39 PM.','BATCH_RESCHEDULED',0,'2026-09-22 04:26:09',NULL,NULL),('011f9281-aa13-4b50-ab23-06cb91110a81',NULL,'STDNT350927','Rescheduled: Annual BMI','New schedule: 2026-09-22 from 10:22:00 to 12:24:00.','SCREENING_UPDATED',0,'2026-09-22 02:23:02',NULL,NULL),('0134e013-05de-4ddd-b0f0-ce80b60f5f95','NRS02000','STDNT112233','Doctor Visit Scheduled','Appointment with Dr. Alvin Ligutan on 9/23/26, 10:39 AM.','APPOINTMENT_SCHEDULED',0,'2026-09-22 02:29:12',NULL,NULL),('0222e989-256f-4c90-89b2-984cdbb30a2c',NULL,'a406d9f4-2525-4a26-af5a-5003dec47f67','Cancelled Screening: Annual BMI Monitoring','The scheduled BMI screening (\"Annual BMI Monitoring\") on 2026-09-22 has been cancelled.','SCREENING_CANCELLED',0,'2026-09-21 16:29:18',NULL,NULL),('045b9249-ee72-4217-8ff3-a11bd5dffcb3','NRS02000','STDNT257727','Excuse Slip Request Completed','Your Excuse Slip (ID: EXC-b87a4c3d) has been completed.','document_request_action',1,'2026-09-21 18:36:27','2026-09-22 06:24:00',NULL),('048c8c22-3d7a-43d1-b277-557ebeab9386','NRS02000','STDNT345411','Clinic Time Out: Yahweh Bernardo','Yahweh Bernardo checked out of the clinic at 09:59.','clinic_timeout',0,'2026-09-22 01:59:29',NULL,NULL),('04cb2ca2-6a2a-43b5-bff8-c12d690b713b',NULL,'STDNT257727','Assessment Filed','Diagnosis: goods. Recommendations: goods\n.','ASSESSMENT_COMPLETED',1,'2026-09-22 14:07:42','2026-09-22 14:07:57',NULL),('060974b4-4096-4d51-b9fb-9941e86df29a',NULL,'STDNT257727','Rescheduled: Annual BMI','New schedule: 2026-09-22 from 10:22:00 to 12:24:00.','SCREENING_UPDATED',1,'2026-09-22 02:23:02','2026-09-22 06:23:29',NULL),('0649274e-34a5-48b2-9960-8a65e1257eb8','NRS02000','STDNT257727','Excuse Slip Request Completed','Your Excuse Slip (ID: EXC-e616e4c5) has been completed.','document_request_action',1,'2026-09-21 17:46:15','2026-09-22 06:24:15',NULL),('06dc9f23-9837-4d41-866b-e48990c4a811','NRS02000','STDNT371918','Doctor Visit Scheduled','Appointment with Dr. Alvin Ligutan on 9/23/26, 11:19 AM.','APPOINTMENT_SCHEDULED',0,'2026-09-22 02:29:13',NULL,NULL),('0778dc28-abb3-4eee-879b-4f77e9430d05',NULL,'STDNT350927','Cancelled Screening: Annual BMI Monitoring','The scheduled BMI screening (\"Annual BMI Monitoring\") on 2026-09-22 has been cancelled.','SCREENING_CANCELLED',0,'2026-09-21 16:29:16',NULL,NULL),('07884d47-c186-4b7a-b78e-c01e00351875','NRS02000','STDNT257727','Excuse Slip Request Completed','Your Excuse Slip (ID: EXC-9370e61e) has been completed.','document_request_action',1,'2026-09-21 17:44:19','2026-09-22 06:24:16',NULL),('0995ca4d-52c9-4e4d-916a-cfce7ee2e1b3','NRS02000','PRNT001','Clinic Visit Logged: Yahweh Bernardo','Yahweh Bernardo visited for General Checkup. Time In: 10:01:00','clinic_visit',0,'2026-09-22 02:01:00',NULL,NULL),('09cb0238-b4f1-11f1-81cf-88241b1f4709',NULL,'STDNT257727','requirement','Your requirement \"Dental Assessment\" status was updated to \"Completed\". Remarks: None','requirement_update',1,'2026-09-20 12:44:36','2026-09-20 12:44:54',NULL),('09d96e5b-718e-4c30-b50e-3d0d0b88aad4','STDNT257727','NRS02000','New Student Submission','Clark Ken Marcelo (Bachelor of Science in Information Technology) submitted \"Urine Test\" (Submitted).','requirement_submission',1,'2026-09-21 18:53:59','2026-09-21 18:54:19',NULL),('09fdab8c-263a-48f0-b8cf-f2877dc16ff5',NULL,'STDNT332211','Scheduled: Annual BMI','BMI Screening on 2026-09-24 from 10:22 to 12:24.','SCREENING_SCHEDULED',0,'2026-09-22 02:22:27',NULL,NULL),('0a3e2fa6-b509-11f1-81cf-88241b1f4709',NULL,'STDNT257727','Requirement Status Updated','Your requirement \"Vision Assessment\" status was updated to \"Completed\". Remarks: None','requirement_update',1,'2026-09-20 15:36:25','2026-09-20 16:00:14',NULL),('0a98bdad-2a7d-4cbc-a632-b23b58ece52e','NRS02000','STDNT257727','Clinic Visit Logged: Clark Ken Marcelo','Clark Ken Marcelo visited for General Checkup. Time In: 21:35:00','clinic_visit',0,'2026-09-24 13:35:31',NULL,NULL),('0b459ab1-6e0e-4660-bb66-0356156f6d57',NULL,'d806dd6e-bd0d-4820-8df1-0c40ae94dca0','New Health Screening: Annual BMI Monitoring','You have been scheduled for a BMI Screening.\nDate: 2026-09-22\nTime: 00:31 - 02:30\nProgram: All Programs','SCREENING_SCHEDULED',0,'2026-09-21 16:28:58',NULL,NULL),('0bb65330-8ffc-4c6c-be2d-a662f4a14ccf','NRS02000','STDNT257727','Clinic Visit Logged: Clark Ken Marcelo','Clark Ken Marcelo visited for General Checkup. Time In: 08:44:00','clinic_visit',0,'2026-09-23 00:44:26',NULL,NULL),('0ca19c11-be07-4b98-8bc2-6281c310f553','NRS02000','PRNT003','Clinic Visit Logged: Clark Ken Marcelo','Clark Ken Marcelo visited for General Checkup. Time In: 18:47:00','clinic_visit',0,'2026-09-22 10:47:40',NULL,NULL),('0ccf2e78-87a6-434d-95ca-01291aa26d23',NULL,'f95f98e6-f4ec-4a55-8c86-d56c044500c9','Doctor Visit Rescheduled','Moved to 9/23/26, 12:49 PM.','BATCH_RESCHEDULED',0,'2026-09-22 04:26:09',NULL,NULL),('0ccf522b-8957-4fed-b2f8-739ad41cf820','NRS02000','STDNT257727','Excuse Slip Request Completed','Your Excuse Slip (ID: EXC-bdc35969) has been completed.','document_request_action',1,'2026-09-21 18:36:37','2026-09-22 06:23:54',NULL),('10d75b37-cb54-4ad7-928a-cee9efdd91ac',NULL,'f95f98e6-f4ec-4a55-8c86-d56c044500c9','New Health Screening: Annual BMI Monitoring','You have been scheduled for a BMI Screening.\nDate: 2026-09-22\nTime: 00:31 - 02:30\nProgram: All Programs','SCREENING_SCHEDULED',0,'2026-09-21 16:28:57',NULL,NULL),('10dce0ea-0000-43b8-8941-7bf0a94292d4','NRS02000','PRNT003','Clinic Visit Logged: Clark Ken Marcelo','Clark Ken Marcelo visited for General Checkup. Time In: 23:42:00','clinic_visit',0,'2026-09-22 15:42:06',NULL,NULL),('11025b68-a749-4225-8167-fffec084d2d1','NRS02000','PRNT003','Clinic Visit Logged: Clark Ken Marcelo','Clark Ken Marcelo visited for General Checkup. Time In: 08:44:00','clinic_visit',0,'2026-09-23 00:44:26',NULL,NULL),('115d7974-561c-4f9d-8b5f-6b31cdcfdad4','NRS02000','STDNT345411','Documentation Updated: Yahweh Bernardo','Yahweh Bernardo - Headache. Intervention: Give Medicine. Advice: Take rest . Time Out: 09:59:00.','clinic_documentation',0,'2026-09-22 02:00:22',NULL,NULL),('124c01a5-d2b1-4868-8b46-5c4eabb45363','NRS02000','STDNT257727','Excuse Slip Request Completed','Your Excuse Slip (ID: EXC-e4b62c83) has been completed.','document_request_action',1,'2026-09-21 18:24:56','2026-09-22 06:23:59',NULL),('13e9df09-3deb-4f4e-bb0e-77d12aca214b','NRS02000','STDNT257727','Excuse Slip Request Completed','Your Excuse Slip (ID: EXC-7d4697a3) has been completed. Note: Wan2','document_request_action',0,'2026-09-23 01:09:36',NULL,NULL),('13f040df-b21e-44b4-a3cd-576913c2e91a','NRS02000','STDNT257727','Clinic Visit Documented: Clark Ken Marcelo','Clark Ken Marcelo visit documented for Others. Time In: 21:35:00 Recommendations: Take Rest','clinic_visit_update',0,'2026-09-24 13:37:23',NULL,NULL),('15ad7a07-499f-4ebe-93ef-c0f8ad972250',NULL,'STDNT350927','Rescheduled: Annual BMI','New schedule: 2026-09-23 from 10:22:00 to 12:24:00.','SCREENING_UPDATED',0,'2026-09-22 02:22:48',NULL,NULL),('18098186-7b7a-4d53-80ce-9c68d27cb4d0','NRS02000','PRNT003','Update on Clark Ken Marcelo\'s Request','The Excuse Slip requested for Clark Ken Marcelo was completed.','document_request_action',0,'2026-09-21 18:36:27',NULL,NULL),('18bf060f-0463-4cca-a4b7-8326c808e67d',NULL,'STDNT001133','New Health Screening: Annual BMI Monitoring','You have been scheduled for a BMI Screening.\nDate: 2026-09-22\nTime: 00:31 - 02:30\nProgram: All Programs','SCREENING_SCHEDULED',0,'2026-09-21 16:28:58',NULL,NULL),('18c7f970-1ca7-4c25-9268-306d78fff2c4','NRS02000','PRNT003','Clinic Time Out: Clark Ken Marcelo','Clark Ken Marcelo checked out of the clinic at 23:23.','clinic_timeout',0,'2026-09-22 15:23:36',NULL,NULL),('1af08ea6-5af0-4d37-b3d5-d306f65e69c7','NRS02000','STDNT257727','Excuse Slip Request Completed','Your Excuse Slip (ID: EXC-84dd62e8) has been completed.','document_request_action',1,'2026-09-21 17:44:08','2026-09-22 06:24:18',NULL),('1b438cba-bc83-476c-bc36-20d3ae809c4e',NULL,'STDNT257727','Scheduled: Annual BMI','BMI Screening on 2026-09-24 from 10:22 to 12:24.','SCREENING_SCHEDULED',1,'2026-09-22 02:22:27','2026-09-22 06:23:33',NULL),('1bbb3484-b9dd-46bc-af40-cf7a02b6f80c','NRS02000','PRNT003','Update on Clark Ken Marcelo\'s Request','The Excuse Slip requested for Clark Ken Marcelo was completed.','document_request_action',0,'2026-09-21 18:24:41',NULL,NULL),('1c1b6ceb-0fb3-4447-a73d-05c326d6722e',NULL,'cd890b6a-1dc8-4ee3-8247-7e4e138a32a5','Cancelled Screening: Annual BMI Monitoring','The scheduled BMI screening (\"Annual BMI Monitoring\") on 2026-09-22 has been cancelled.','SCREENING_CANCELLED',0,'2026-09-21 16:29:16',NULL,NULL),('1ec8c09a-a709-47a4-afbe-a054aa9c99bc','NRS02000','PRNT001','Clinic Visit Logged: Yahweh Bernardo','Yahweh Bernardo visited for General Checkup. Time In: 23:42:00','clinic_visit',0,'2026-09-22 15:42:45',NULL,NULL),('20020f6c-b5e1-11f1-81cf-88241b1f4709','STDNT345411','NRS02000','New Student Submission','Yahweh Bernardo (Bachelor of Science in Information Technology) submitted \"Hepa B\" (Submitted).','requirement_submission',1,'2026-09-21 17:23:13','2026-09-21 17:23:24',NULL),('215f7c4b-0674-47c8-bcd6-f6248425eff0',NULL,'6fd1f602-2615-4e52-921f-804ff6a669df','Scheduled: Annual','BMI Screening on 2026-09-25 from 15:21 to 17:21.','SCREENING_SCHEDULED',0,'2026-09-25 07:23:15',NULL,NULL),('21604977-b5ed-11f1-81cf-88241b1f4709','STDNT257727','NRS02000','New Student Submission','Clark Ken Marcelo (Bachelor of Science in Information Technology) submitted \"Urine Test\" (Submitted).','requirement_submission',1,'2026-09-21 18:49:09','2026-09-21 18:55:48',NULL),('218fd193-74fb-46e6-ae3b-506c14b9f558',NULL,'STDNT001133','New Health Screening: Annual BMI Monitoring','You have been scheduled for a BMI Screening.\nDate: 2026-09-22\nTime: 00:31 - 02:30\nProgram: All Programs','SCREENING_SCHEDULED',0,'2026-09-21 16:28:57',NULL,NULL),('2212eaa9-3d47-4e9f-ab4c-81cebb5da20b','NRS02000','STDNT257727','Clinic Visit Logged: Clark Ken Marcelo','Clark Ken Marcelo visited for General Checkup. Time In: 23:24:00','clinic_visit',0,'2026-09-22 15:24:18',NULL,NULL),('23167860-9407-4a6a-b55d-47b27dbb4123',NULL,'f95f98e6-f4ec-4a55-8c86-d56c044500c9','Cancelled Screening: Annual BMI Monitoring','The scheduled BMI screening (\"Annual BMI Monitoring\") on 2026-09-22 has been cancelled.','SCREENING_CANCELLED',0,'2026-09-21 16:29:16',NULL,NULL),('236b3f96-ca12-406b-87a1-3ebacf3af7cc',NULL,'STDNT371918','New Health Screening: Annual BMI Monitoring','You have been scheduled for a BMI Screening.\nDate: 2026-09-22\nTime: 00:31 - 02:30\nProgram: All Programs','SCREENING_SCHEDULED',0,'2026-09-21 16:28:57',NULL,NULL),('23f2f451-aa09-41ca-9e96-f66633c9a2cc','STDNT257727','NRS02000','New Excuse Slip Request','Clark Ken Marcelo submitted an Excuse Slip request for 2026-09-15 to 2026-09-15. Reason: sadfghj','excuse_slip_request',1,'2026-09-23 01:08:56','2026-09-23 02:42:58',NULL),('240b4795-85e2-4b20-9c02-f31e574d8433','NRS02000','PRNT003','Update on Clark Ken Marcelo\'s Request','The Excuse Slip requested for Clark Ken Marcelo was completed.','document_request_action',0,'2026-09-23 01:06:46',NULL,NULL),('24593c5c-1245-424f-a6f7-2e083f287768','NRS02000','STDNT345411','Doctor Visit Scheduled','Appointment with Dr. Alvin Ligutan on 9/23/26, 11:04 AM.','APPOINTMENT_SCHEDULED',0,'2026-09-22 02:29:13',NULL,NULL),('24a4e006-e62d-40ff-931e-23e6d066ab66','NRS02000','STDNT257727','Incident Report Filed','Incident recorded at 201 on 9/22/26, 10:59 AM.','INCIDENT_REPORT',1,'2026-09-22 03:00:07','2026-09-22 06:23:28',NULL),('24ad595f-5915-43d1-9b1e-2a2903156123',NULL,'cd890b6a-1dc8-4ee3-8247-7e4e138a32a5','Doctor Visit Rescheduled','Moved to 9/23/26, 1:24 PM.','BATCH_RESCHEDULED',0,'2026-09-22 04:26:09',NULL,NULL),('25b17914-6bba-4c79-92d5-76b44dea4570','NRS02000','STDNT345411','Clinic Time Out: Yahweh Bernardo','Yahweh Bernardo checked out of the clinic at 09:00.','clinic_timeout',0,'2026-09-23 00:52:04',NULL,NULL),('25e8ef21-2f4f-4176-a72e-12b91ee955fe',NULL,'STDNT257727','Cancelled Screening: Annual BMI Monitoring','The scheduled BMI screening (\"Annual BMI Monitoring\") on 2026-09-22 has been cancelled.','SCREENING_CANCELLED',1,'2026-09-21 16:29:18','2026-09-22 06:24:21',NULL),('26e5c8f9-7d09-4394-9e6c-8906eb76593d',NULL,'f95f98e6-f4ec-4a55-8c86-d56c044500c9','New Health Screening: Annual BMI Monitoring','You have been scheduled for a BMI Screening.\nDate: 2026-09-22\nTime: 00:31 - 02:30\nProgram: All Programs','SCREENING_SCHEDULED',0,'2026-09-21 16:28:56',NULL,NULL),('27afda25-3d21-4e19-b82f-4a47c3e9451a','NRS02000','STDNT257727','Excuse Slip Request Completed','Your Excuse Slip (ID: EXC-2c3fec20) has been completed.','document_request_action',1,'2026-09-22 04:33:20','2026-09-22 06:23:17',NULL),('27ba3aa8-8931-4938-9b13-eeb568ffb26b','NRS02000','PRNT003','Update on Clark Ken Marcelo\'s Request','The Excuse Slip requested for Clark Ken Marcelo was denied.','document_request_action',0,'2026-09-23 01:03:49',NULL,NULL),('2877f5ed-d265-4e97-b5ba-4baa4013c4bd','NRS02000','f95f98e6-f4ec-4a55-8c86-d56c044500c9','Doctor Visit Scheduled','Appointment with Dr. Alvin Ligutan on 9/23/26, 10:49 AM.','APPOINTMENT_SCHEDULED',0,'2026-09-22 02:29:12',NULL,NULL),('28bb807e-f999-4152-8d3b-e659bc9fb091','NRS02000','PRNT003','Clinic Visit Logged: Clark Ken Marcelo','Clark Ken Marcelo visited for General Checkup. Time In: 23:24:00','clinic_visit',0,'2026-09-22 15:24:19',NULL,NULL),('2a0b79f1-c453-4aa3-9f1b-2c9a76842c15',NULL,'f95f98e6-f4ec-4a55-8c86-d56c044500c9','Rescheduled: Annual BMI','New schedule: 2026-09-22 from 10:22:00 to 12:24:00.','SCREENING_UPDATED',0,'2026-09-22 02:23:02',NULL,NULL),('2b456816-f315-4e64-8b02-cd1ad5fe0cd6',NULL,'STDNT120504','New Health Screening: Annual BMI Monitoring','You have been scheduled for a BMI Screening.\nDate: 2026-09-22\nTime: 00:31 - 02:30\nProgram: All Programs','SCREENING_SCHEDULED',0,'2026-09-21 16:28:56',NULL,NULL),('2c2cbd38-320e-4411-b61c-c438399d937f',NULL,'STDNT112233','Cancelled Screening: Annual BMI Monitoring','The scheduled BMI screening (\"Annual BMI Monitoring\") on 2026-09-22 has been cancelled.','SCREENING_CANCELLED',0,'2026-09-21 16:29:16',NULL,NULL),('2c50a2e0-db64-4f78-ab8e-fa602c312c62',NULL,'cd890b6a-1dc8-4ee3-8247-7e4e138a32a5','Scheduled: Annual BMI','BMI Screening on 2026-09-24 from 10:22 to 12:24.','SCREENING_SCHEDULED',0,'2026-09-22 02:22:27',NULL,NULL),('2d163d4a-6827-459a-850f-e84eca184984','NRS02000','STDNT257727','Referral Slip Request Completed','Your Referral Slip (ID: REF-1f577a3d) has been completed.','document_request_action',1,'2026-09-22 06:05:21','2026-09-22 06:06:07',NULL),('2da403b1-6c79-4843-903d-ddc8ca80cd72',NULL,'STDNT332211','Cancelled Screening: Annual BMI Monitoring','The scheduled BMI screening (\"Annual BMI Monitoring\") on 2026-09-22 has been cancelled.','SCREENING_CANCELLED',0,'2026-09-21 16:29:18',NULL,NULL),('2e0f5a5f-97c7-4a37-ad5d-737aad9cd037',NULL,'d806dd6e-bd0d-4820-8df1-0c40ae94dca0','Doctor Visit Rescheduled','Moved to 9/22/26, 8:42 PM.','BATCH_RESCHEDULED',0,'2026-09-22 12:05:43',NULL,NULL),('2f06b29d-e3f6-4a60-b31d-23e18ba8e2f5',NULL,'cd890b6a-1dc8-4ee3-8247-7e4e138a32a5','Rescheduled: Annual BMI','New schedule: 2026-09-23 from 10:22:00 to 12:24:00.','SCREENING_UPDATED',0,'2026-09-22 02:22:48',NULL,NULL),('3027d929-29ed-424f-9008-b1c41c347b33',NULL,'a406d9f4-2525-4a26-af5a-5003dec47f67','Rescheduled: Annual BMI','New schedule: 2026-09-23 from 10:22:00 to 12:24:00.','SCREENING_UPDATED',0,'2026-09-22 02:22:48',NULL,NULL),('318dbe04-4556-4681-8004-d5b76966cb98',NULL,'STDNT112233','New Health Screening: Annual BMI Monitoring','You have been scheduled for a BMI Screening.\nDate: 2026-09-22\nTime: 00:31 - 02:30\nProgram: All Programs','SCREENING_SCHEDULED',0,'2026-09-21 16:28:56',NULL,NULL),('3219d8aa-0458-4e28-89a5-cb8e82fdefbe','NRS02000','STDNT257727','Clinic Time Out: Clark Ken Marcelo','Clark Ken Marcelo checked out of the clinic at 19:10.','clinic_timeout',0,'2026-09-24 11:10:06',NULL,NULL),('3261ef38-4de4-4a6f-b49b-762d73f33fea','NRS02000','STDNT257727','Excuse Slip Request Completed','Your Excuse Slip (ID: EXC-3a2b2ccc) has been completed.','document_request_action',1,'2026-09-21 17:52:37','2026-09-22 06:24:12',NULL),('32e2a89f-b5e1-11f1-81cf-88241b1f4709',NULL,'STDNT345411','Requirement Status Updated','Your requirement \"Hepa B\" status was updated to \"Completed\". Remarks: None','requirement_update',0,'2026-09-21 17:23:45',NULL,NULL),('33428a7d-1aad-4c79-8c3e-fb8874633883','NRS02000','STDNT257727','Clinic Visit Logged: Clark Ken Marcelo','Clark Ken Marcelo visited for General Checkup. Time In: 18:58:00','clinic_visit',0,'2026-09-24 10:58:48',NULL,NULL),('3368d477-5321-41f5-9e82-a27dc75b98f3','NRS02000','PRNT003','Clinic Visit Logged: Clark Ken Marcelo','Clark Ken Marcelo visited for General Checkup. Time In: 21:12:00','clinic_visit',0,'2026-09-24 13:12:19',NULL,NULL),('349fd07c-7b72-4bf4-8063-2653855fab44','STDNT257727','NRS02000','New Excuse Slip Request','Clark Ken Marcelo submitted an Excuse Slip request for 2026-09-14 to 2026-09-18. Reason: nagtae ','excuse_slip_request',1,'2026-09-22 04:30:17','2026-09-22 04:30:58',NULL),('3542ed30-a132-4264-8169-361ea9ce1efc','STDNT257727','NRS02000','New Excuse Slip Request','Clark Ken Marcelo submitted an Excuse Slip request for 2026-09-23 to 2026-09-23. Reason: operation','excuse_slip_request',1,'2026-09-23 01:01:13','2026-09-23 01:01:38',NULL),('35912275-d48c-4dd6-b21f-791456aeb02f','NRS02000','STDNT257727','Clinic Time Out: Clark Ken Marcelo','Clark Ken Marcelo checked out of the clinic at 10:10.','clinic_timeout',1,'2026-09-22 02:10:39','2026-09-22 06:23:42',NULL),('36a7f6c6-96e8-4e03-ad3f-33a4ff760411',NULL,'d806dd6e-bd0d-4820-8df1-0c40ae94dca0','Scheduled: Annual BMI','BMI Screening on 2026-09-24 from 10:22 to 12:24.','SCREENING_SCHEDULED',0,'2026-09-22 02:22:27',NULL,NULL),('371b2939-6953-4913-abbc-55983d875ae2',NULL,'STDNT350927','Scheduled: Annual BMI','BMI Screening on 2026-09-24 from 10:22 to 12:24.','SCREENING_SCHEDULED',0,'2026-09-22 02:22:27',NULL,NULL),('3724a1dd-cff8-4c6b-bf98-4e23275cf01f','NRS02000','PRNT003','Clinic Time Out: Clark Ken Marcelo','Clark Ken Marcelo checked out of the clinic at 18:48.','clinic_timeout',0,'2026-09-22 10:48:46',NULL,NULL),('3748d958-c55f-4b3f-abac-19aeaba88364','NRS02000','PRNT003','Update on Clark Ken Marcelo\'s Request','The Excuse Slip requested for Clark Ken Marcelo was completed.','document_request_action',0,'2026-09-21 18:24:35',NULL,NULL),('38056fdd-f563-4473-a53f-94c618e4bed3','NRS02000','PRNT003','Clinic Visit Documented: Clark Ken Marcelo','Clark Ken Marcelo visit documented for Others. Time In: 21:12:00 Recommendations: Take Rest','clinic_visit_update',0,'2026-09-24 13:13:35',NULL,NULL),('388a98c0-1c12-4d87-8843-ff4d600cca8a','NRS02000','PRNT003','Update on Clark Ken Marcelo\'s Request','The Excuse Slip requested for Clark Ken Marcelo was completed.','document_request_action',0,'2026-09-22 15:50:53',NULL,NULL),('38d56eff-3ecd-463d-9496-343d671f0217',NULL,'STDNT371918','Cancelled Screening: Annual BMI Monitoring','The scheduled BMI screening (\"Annual BMI Monitoring\") on 2026-09-22 has been cancelled.','SCREENING_CANCELLED',0,'2026-09-21 16:29:16',NULL,NULL),('396fd808-59c7-4076-90ea-602e5af077ee',NULL,'STDNT332211','New Health Screening: Annual BMI Monitoring','You have been scheduled for a BMI Screening.\nDate: 2026-09-22\nTime: 00:31 - 02:30\nProgram: All Programs','SCREENING_SCHEDULED',0,'2026-09-21 16:28:58',NULL,NULL),('397ebef6-8fee-4f58-850c-15c2b159b67d',NULL,'STDNT332211','Scheduled: Annual','BMI Screening on 2026-09-25 from 15:21 to 17:21.','SCREENING_SCHEDULED',0,'2026-09-25 07:23:15',NULL,NULL),('39e4ff30-e531-44d4-997a-244ebc95b4cb','NRS02000','PRNT003','Update on Clark Ken Marcelo\'s Request','The Excuse Slip requested for Clark Ken Marcelo was completed.','document_request_action',0,'2026-09-21 17:52:37',NULL,NULL),('39ef6833-05f0-4327-a938-7473ce5c5949','NRS02000','PRNT003','Update on Clark Ken Marcelo\'s Request','The Excuse Slip requested for Clark Ken Marcelo was completed.','document_request_action',0,'2026-09-21 17:44:19',NULL,NULL),('3a0ca4d1-a9c3-4b56-8685-4d8803c71ea8','NRS02000','STDNT257727','Excuse Slip Request Completed','Your Excuse Slip (ID: EXC-5ff6659e) has been completed.','document_request_action',0,'2026-09-22 15:50:53',NULL,NULL),('3a72ec7f-b5b1-11f1-81cf-88241b1f4709',NULL,'d806dd6e-bd0d-4820-8df1-0c40ae94dca0','Requirement Status Updated','Your requirement \"X Ray\" status was updated to \"Completed\". Remarks: None','requirement_update',0,'2026-09-21 11:40:21',NULL,NULL),('3c3bc1f9-c3eb-4dc3-bcd2-b573bd718e97','NRS02000','STDNT257727','Clinic Time Out: Clark Ken Marcelo','Clark Ken Marcelo checked out of the clinic at 08:45.','clinic_timeout',0,'2026-09-23 00:45:42',NULL,NULL),('3c701e13-8b75-4e43-8d15-17a886c3ce0b',NULL,'a406d9f4-2525-4a26-af5a-5003dec47f67','New Health Screening: Annual BMI Monitoring','You have been scheduled for a BMI Screening.\nDate: 2026-09-22\nTime: 00:31 - 02:30\nProgram: All Programs','SCREENING_SCHEDULED',0,'2026-09-21 16:28:56',NULL,NULL),('3c73c05f-e194-4bab-85f8-e8fbab8bb0ca',NULL,'STDNT112233','New Health Screening: Annual BMI Monitoring','You have been scheduled for a BMI Screening.\nDate: 2026-09-22\nTime: 00:31 - 02:30\nProgram: All Programs','SCREENING_SCHEDULED',0,'2026-09-21 16:28:58',NULL,NULL),('3d269e4e-50a9-4a26-b0d7-e6f927985e28',NULL,'a406d9f4-2525-4a26-af5a-5003dec47f67','Scheduled: Annual','BMI Screening on 2026-09-25 from 15:21 to 17:21.','SCREENING_SCHEDULED',0,'2026-09-25 07:23:15',NULL,NULL),('3d61d13e-2441-4147-ad7f-7dab87de8f6f','NRS02000','STDNT257727','Clinic Time Out: Clark Ken Marcelo','Clark Ken Marcelo checked out of the clinic at 18:59.','clinic_timeout',0,'2026-09-24 10:59:11',NULL,NULL),('3e3f3e65-9e94-42a4-b78f-ea55ade49e8d',NULL,'STDNT112233','Rescheduled: Annual BMI','New schedule: 2026-09-23 from 10:22:00 to 12:24:00.','SCREENING_UPDATED',0,'2026-09-22 02:22:48',NULL,NULL),('3ea7d445-6c79-4d86-b6ba-691fe902a4c6',NULL,'d806dd6e-bd0d-4820-8df1-0c40ae94dca0','Rescheduled: Annual BMI','New schedule: 2026-09-23 from 10:22:00 to 12:24:00.','SCREENING_UPDATED',0,'2026-09-22 02:22:48',NULL,NULL),('40199943-6dd5-46e5-901c-f06d25d1fce2','NRS02000','STDNT257727','Clinic Time Out: Clark Ken Marcelo','Clark Ken Marcelo checked out of the clinic at 10:15.','clinic_timeout',1,'2026-09-22 02:10:59','2026-09-22 06:23:41',NULL),('40ee1d3b-6d0e-4c27-a617-c8814f8f7071',NULL,'a406d9f4-2525-4a26-af5a-5003dec47f67','Rescheduled: Annual BMI','New schedule: 2026-09-22 from 10:22:00 to 12:24:00.','SCREENING_UPDATED',0,'2026-09-22 02:23:02',NULL,NULL),('42d36d53-57a2-43b6-8465-4cdf7b143f9c',NULL,'STDNT350927','Doctor Visit Rescheduled','Moved to 9/22/26, 8:47 PM.','BATCH_RESCHEDULED',0,'2026-09-22 12:05:43',NULL,NULL),('438497fe-5aee-4d4e-b541-1c854bb30da0','NRS02000','STDNT257727','Clinic Visit Logged: Clark Ken Marcelo','Clark Ken Marcelo visited for General Checkup. Time In: 18:47:00','clinic_visit',1,'2026-09-22 10:47:39','2026-09-22 10:59:42',NULL),('43891688-4369-42f3-b4ac-a50fd4c2fd12','NRS02000','PRNT003','Update on Clark Ken Marcelo\'s Request','The Excuse Slip requested for Clark Ken Marcelo was completed.','document_request_action',0,'2026-09-21 17:46:15',NULL,NULL),('462b322f-5167-432b-9c13-5a6419f5e435',NULL,'STDNT120504','Cancelled Screening: Annual BMI Monitoring','The scheduled BMI screening (\"Annual BMI Monitoring\") on 2026-09-22 has been cancelled.','SCREENING_CANCELLED',0,'2026-09-21 16:29:18',NULL,NULL),('4695edd8-c097-44b9-b29f-230c99e1ad7f',NULL,'STDNT257727','Requirement Status Updated','Your requirement \"Drug Test\" status was updated to \"Pending\". Remarks: None','requirement_update',1,'2026-09-21 18:45:31','2026-09-22 06:23:56',NULL),('48211532-4e7b-48f4-aab3-0622ce8adeb7',NULL,'STDNT120504','Rescheduled: Annual BMI','New schedule: 2026-09-22 from 10:22:00 to 12:24:00.','SCREENING_UPDATED',0,'2026-09-22 02:23:02',NULL,NULL),('48760bbb-e820-43ab-82fc-b8396f00ca5d',NULL,'STDNT371918','Rescheduled: Annual BMI','New schedule: 2026-09-23 from 10:22:00 to 12:24:00.','SCREENING_UPDATED',0,'2026-09-22 02:22:48',NULL,NULL),('49be549e-2ca8-4fd2-97d1-0ad747cd23dd',NULL,'d806dd6e-bd0d-4820-8df1-0c40ae94dca0','Cancelled Screening: Annual BMI Monitoring','The scheduled BMI screening (\"Annual BMI Monitoring\") on 2026-09-22 has been cancelled.','SCREENING_CANCELLED',0,'2026-09-21 16:29:16',NULL,NULL),('4a3eeff1-6032-4e21-85be-4b01ba0d8a74',NULL,'STDNT371918','Doctor Visit Rescheduled','Moved to 9/23/26, 1:19 PM.','BATCH_RESCHEDULED',0,'2026-09-22 04:26:09',NULL,NULL),('4bc2a860-36b3-41c0-a9ec-13c7a1a363e5',NULL,'STDNT257727','New Health Screening: Annual BMI Monitoring','You have been scheduled for a BMI Screening.\nDate: 2026-09-22\nTime: 00:31 - 02:30\nProgram: All Programs','SCREENING_SCHEDULED',1,'2026-09-21 16:28:58','2026-09-22 06:24:24',NULL),('4d2b3349-b507-11f1-81cf-88241b1f4709','STDNT257727','NRS02000','New Student Submission','Clark Ken Marcelo (Bachelor of Science in Information Technology) submitted \"Vision Assessment\" (Submitted).','requirement_submission',1,'2026-09-20 15:23:58','2026-09-20 15:29:38',NULL),('4f96e1f7-b505-11f1-81cf-88241b1f4709','STDNT257727','NRS02000','New Student Submission','Clark Ken Marcelo (Bachelor of Science in Information Technology) submitted \"Vision Assessment\" (Submitted).','requirement_submission',1,'2026-09-20 15:09:43','2026-09-20 15:29:48',NULL),('509753c0-763e-4939-91e8-83a26e7e711d',NULL,'STDNT112233','New Health Screening: Annual BMI Monitoring','You have been scheduled for a BMI Screening.\nDate: 2026-09-22\nTime: 00:31 - 02:30\nProgram: All Programs','SCREENING_SCHEDULED',0,'2026-09-21 16:28:57',NULL,NULL),('51abeb22-0881-4183-a5bd-a17981e51c44',NULL,'d806dd6e-bd0d-4820-8df1-0c40ae94dca0','Rescheduled: Annual BMI','New schedule: 2026-09-22 from 10:22:00 to 12:24:00.','SCREENING_UPDATED',0,'2026-09-22 02:23:02',NULL,NULL),('5290d188-10bf-41be-b375-d2c7b7ffc469',NULL,'STDNT001133','Cancelled Screening: Annual BMI Monitoring','The scheduled BMI screening (\"Annual BMI Monitoring\") on 2026-09-22 has been cancelled.','SCREENING_CANCELLED',0,'2026-09-21 16:29:18',NULL,NULL),('534d0242-89d6-4123-9a3c-96cf86455f98',NULL,'STDNT001133','Doctor Visit Rescheduled','Moved to 9/22/26, 8:07 PM.','BATCH_RESCHEDULED',0,'2026-09-22 12:05:43',NULL,NULL),('53bd4dd9-eab1-4e28-9a8e-68b7e790bb85','STDNT257727','NRS02000','New Excuse Slip Request','Clark Ken Marcelo submitted an Excuse Slip request for 2026-09-14 to 2026-09-18. Reason: nagtatae po talaga ako ','excuse_slip_request',1,'2026-09-21 18:25:33','2026-09-21 18:36:13',NULL),('5459c619-222e-49c6-aacf-38c3df6506e4','NRS02000','STDNT257727','Documentation Updated: Clark Ken Marcelo','Clark Ken Marcelo - Headache. Intervention: Give Medicine . Advice: Take Rest. Time Out: 12:28:00.','clinic_documentation',1,'2026-09-22 04:23:07','2026-09-22 04:27:09',NULL),('55393723-8f4a-4b95-a764-c39ba9ef7718',NULL,'STDNT001133','Scheduled: Annual BMI','BMI Screening on 2026-09-24 from 10:22 to 12:24.','SCREENING_SCHEDULED',0,'2026-09-22 02:22:27',NULL,NULL),('55aeab2c-b4c2-4c3a-8039-2817a3d8a091','STDNT257727','NRS02000','New Excuse Slip Request','Clark Ken Marcelo submitted an Excuse Slip request for 2026-09-14 to 2026-09-18. Reason: masakit tiyam','excuse_slip_request',1,'2026-09-21 18:34:33','2026-09-21 18:36:09',NULL),('586ef4e8-2a3d-43ab-90ed-02c1f82b7ae8',NULL,'STDNT345411','New Health Screening: Annual BMI Monitoring','You have been scheduled for a BMI Screening.\nDate: 2026-09-22\nTime: 00:31 - 02:30\nProgram: All Programs','SCREENING_SCHEDULED',1,'2026-09-21 16:28:56','2026-09-21 17:02:43',NULL),('58ed5f0a-6515-48e7-9c1a-bf0ccc9558fc',NULL,'STDNT350927','Cancelled Screening: Annual BMI Monitoring','The scheduled BMI screening (\"Annual BMI Monitoring\") on 2026-09-22 has been cancelled.','SCREENING_CANCELLED',0,'2026-09-21 16:29:18',NULL,NULL),('59573ba7-94e7-4cd7-9456-38cfa3b688a7',NULL,'STDNT332211','Doctor Visit Rescheduled','Moved to 9/22/26, 8:32 PM.','BATCH_RESCHEDULED',0,'2026-09-22 12:05:43',NULL,NULL),('5968c6e5-edaf-4ac0-b005-8ae2a3039428','NRS02000','PRNT001','Clinic Visit Logged: Yahweh Bernardo','Yahweh Bernardo visited for General Checkup. Time In: 09:52:00','clinic_visit',0,'2026-09-22 01:52:53',NULL,NULL),('5a724221-8d43-492a-a605-04c15494729a',NULL,'STDNT350927','New Health Screening: Annual BMI Monitoring','You have been scheduled for a BMI Screening.\nDate: 2026-09-22\nTime: 00:31 - 02:30\nProgram: All Programs','SCREENING_SCHEDULED',0,'2026-09-21 16:28:57',NULL,NULL),('5b16fcdc-8b48-449b-87e2-4fee50466bca','NRS02000','PRNT001','Documentation Updated: Yahweh Bernardo','Yahweh Bernardo - Cough. Intervention: advil. Advice: rest.','clinic_documentation',0,'2026-09-23 00:51:31',NULL,NULL),('5c47cb78-5f02-4ce5-aa80-8976c6c0b271','NRS02000','PRNT001','Update on Yahweh Bernardo\'s Request','The Excuse Slip requested for Yahweh Bernardo was completed.','document_request_action',0,'2026-09-21 17:35:12',NULL,NULL),('5d11df89-5fe2-49b7-b5b5-7190a2811fe5',NULL,'STDNT120504','Rescheduled: Annual BMI','New schedule: 2026-09-23 from 10:22:00 to 12:24:00.','SCREENING_UPDATED',0,'2026-09-22 02:22:48',NULL,NULL),('5d890f2a-c01f-4aaf-aa0c-a0487b374058',NULL,'STDNT120504','Cancelled Screening: Annual BMI Monitoring','The scheduled BMI screening (\"Annual BMI Monitoring\") on 2026-09-22 has been cancelled.','SCREENING_CANCELLED',0,'2026-09-21 16:29:16',NULL,NULL),('5db42c73-c3ba-4e7e-8145-594db15b5903','NRS02000','STDNT345411','Clinic Visit Logged: Yahweh Bernardo','Yahweh Bernardo visited for General Checkup. Time In: 23:42:00','clinic_visit',0,'2026-09-22 15:42:45',NULL,NULL),('5f029309-6fb1-4e5c-a544-c4523e9befb7','NRS02000','STDNT257727','Clinic Visit Logged: Clark Ken Marcelo','Clark Ken Marcelo visited for General Checkup. Time In: 18:53:00','clinic_visit',0,'2026-09-24 10:53:00',NULL,NULL),('604cd522-36b3-450a-bb46-0daf5a2d7bd7','NRS02000','STDNT257727','Clinic Time Out: Clark Ken Marcelo','Clark Ken Marcelo checked out of the clinic at 23:40.','clinic_timeout',0,'2026-09-22 15:40:35',NULL,NULL),('6120c294-1f21-4dad-91d6-4d40715c421b','NRS02000','PRNT003','Update on Clark Ken Marcelo\'s Request','The Excuse Slip requested for Clark Ken Marcelo was completed.','document_request_action',0,'2026-09-21 18:36:38',NULL,NULL),('63ce76ce-f503-438f-a203-c671168cee6a','NRS02000','PRNT003','Clinic Time Out: Clark Ken Marcelo','Clark Ken Marcelo checked out of the clinic at 18:48.','clinic_timeout',0,'2026-09-22 10:48:56',NULL,NULL),('655a3b95-85a3-41dc-9f8a-933bed690e66','NRS02000','PRNT003','Update on Clark Ken Marcelo\'s Request','The Excuse Slip requested for Clark Ken Marcelo was completed.','document_request_action',0,'2026-09-21 18:00:18',NULL,NULL),('6699e8ca-2434-4e89-865d-9ef09acd4c05',NULL,'STDNT332211','Cancelled Screening: Annual BMI Monitoring','The scheduled BMI screening (\"Annual BMI Monitoring\") on 2026-09-22 has been cancelled.','SCREENING_CANCELLED',0,'2026-09-21 16:29:16',NULL,NULL),('67001b79-069a-4630-a68a-c54e6f9ddff4',NULL,'cd890b6a-1dc8-4ee3-8247-7e4e138a32a5','Doctor Visit Rescheduled','Moved to 9/22/26, 8:57 PM.','BATCH_RESCHEDULED',0,'2026-09-22 12:05:43',NULL,NULL),('674261eb-b70f-44d5-bb84-462d5a70f196',NULL,'STDNT120504','Scheduled: Annual BMI','BMI Screening on 2026-09-24 from 10:22 to 12:24.','SCREENING_SCHEDULED',0,'2026-09-22 02:22:27',NULL,NULL),('687f59f8-d438-4aac-9b7c-030ee35a77ce','NRS02000','PRNT003','Clinic Time Out: Clark Ken Marcelo','Clark Ken Marcelo checked out of the clinic at 19:10.','clinic_timeout',0,'2026-09-24 11:10:06',NULL,NULL),('68868445-8f27-420f-bf26-8ea8874f65ee','NRS02000','PRNT003','Clinic Time Out: Clark Ken Marcelo','Clark Ken Marcelo checked out of the clinic at 18:49.','clinic_timeout',0,'2026-09-22 10:49:23',NULL,NULL),('68a8fafa-44a4-4794-b30b-2266091dce9e','NRS02000','STDNT257727','Clinic Visit Documented: Clark Ken Marcelo','Clark Ken Marcelo visit documented for Others. Time In: 21:12:00 Recommendations: Take Rest','clinic_visit_update',0,'2026-09-24 13:13:35',NULL,NULL),('68b9a51d-5b09-4078-a94e-80fbfb515555',NULL,'STDNT257727','Requirement Status Updated','Your requirement \"Urine Test\" status was updated to \"Pending\". Remarks: None','requirement_update',1,'2026-09-21 18:48:16','2026-09-21 18:49:01',NULL),('6b17dda6-e0b3-4a81-8a18-84ce9596ed7d','STDNT257727','NRS02000','New Excuse Slip Request','Clark Ken Marcelo submitted an Excuse Slip request for 2026-09-21 to 2026-09-22. Reason: dfghjk','excuse_slip_request',1,'2026-09-23 01:05:53','2026-09-23 01:05:57',NULL),('6c272a8a-ca35-4f3c-8504-5c68b6c06965','NRS02000','STDNT257727','Excuse Slip Request Completed','Your Excuse Slip (ID: EXC-308c4efe) has been completed.','document_request_action',0,'2026-09-23 01:06:46',NULL,NULL),('6c966837-19bf-4943-b87e-9dc693da7b7e','NRS02000','PRNT003','Update on Clark Ken Marcelo\'s Request','The Referral Slip requested for Clark Ken Marcelo was completed.','document_request_action',0,'2026-09-22 06:05:22',NULL,NULL),('6ddfdc0d-2141-43a3-83f5-de5b2361c6b7',NULL,'f95f98e6-f4ec-4a55-8c86-d56c044500c9','Rescheduled: Annual BMI','New schedule: 2026-09-23 from 10:22:00 to 12:24:00.','SCREENING_UPDATED',0,'2026-09-22 02:22:48',NULL,NULL),('6f45975c-abc9-4769-b1d1-4a3b2281defb',NULL,'STDNT345411','Cancelled Screening: Annual BMI Monitoring','The scheduled BMI screening (\"Annual BMI Monitoring\") on 2026-09-22 has been cancelled.','SCREENING_CANCELLED',1,'2026-09-21 16:29:16','2026-09-21 17:02:40',NULL),('6f56b6fd-d23a-41a4-8688-024c30bd4840',NULL,'a406d9f4-2525-4a26-af5a-5003dec47f67','Doctor Visit Rescheduled','Moved to 9/22/26, 9:02 PM.','BATCH_RESCHEDULED',0,'2026-09-22 12:05:43',NULL,NULL),('6f5cca92-6b45-4b83-a283-a9165d8a5b1c','NRS02000','STDNT257727','Clinic Visit Logged: Clark Ken Marcelo','Clark Ken Marcelo visited for General Checkup. Time In: 10:05:00','clinic_visit',1,'2026-09-22 02:05:49','2026-09-22 06:23:53',NULL),('713281e6-f2e4-4b01-8c36-1952f46403b8',NULL,'STDNT120504','New Health Screening: Annual BMI Monitoring','You have been scheduled for a BMI Screening.\nDate: 2026-09-22\nTime: 00:31 - 02:30\nProgram: All Programs','SCREENING_SCHEDULED',0,'2026-09-21 16:28:57',NULL,NULL),('7213fd9e-729a-4b78-ae80-a235bebb727c','STDNT257727','NRS02000','New Excuse Slip Request','Clark Ken Marcelo submitted an Excuse Slip request for 2026-09-14 to 2026-09-16. Reason: sumakit tiyan','excuse_slip_request',1,'2026-09-22 06:35:07','2026-09-22 07:00:54',NULL),('7416df98-206e-485b-9110-d71d31961598','NRS02000','PRNT003','Clinic Visit Logged: Clark Ken Marcelo','Clark Ken Marcelo visited for General Checkup. Time In: 18:58:00','clinic_visit',0,'2026-09-24 10:58:48',NULL,NULL),('7573151e-854c-4bb3-ab80-bd45e764ee01',NULL,'STDNT112233','Scheduled: Annual BMI','BMI Screening on 2026-09-24 from 10:22 to 12:24.','SCREENING_SCHEDULED',0,'2026-09-22 02:22:27',NULL,NULL),('75c7b725-d96f-4391-a9cf-b2744ea83bdc','NRS02000','STDNT257727','Clinic Time Out: Clark Ken Marcelo','Clark Ken Marcelo checked out of the clinic at 23:23.','clinic_timeout',0,'2026-09-22 15:23:36',NULL,NULL),('75f583de-d8b3-40c2-90c3-efb3535f6ace','NRS02000','PRNT003','Clinic Visit Logged: Clark Ken Marcelo','Clark Ken Marcelo visited for General Checkup. Time In: 19:09:00','clinic_visit',0,'2026-09-24 11:09:43',NULL,NULL),('777bb76b-2f5e-4c8d-879d-955a79a5ef97',NULL,'STDNT257727','New Health Screening: Annual BMI Monitoring','You have been scheduled for a BMI Screening.\nDate: 2026-09-22\nTime: 00:31 - 02:30\nProgram: All Programs','SCREENING_SCHEDULED',1,'2026-09-21 16:28:57','2026-09-22 06:24:25',NULL),('7935c6c7-d7d6-4d01-b28f-2f1c89e84e51','NRS02000','STDNT257727','Clinic Visit Logged: Clark Ken Marcelo','Clark Ken Marcelo visited for General Checkup. Time In: 12:22:00','clinic_visit',1,'2026-09-22 04:22:08','2026-09-22 04:27:05',NULL),('79444dd9-795d-45e0-9807-4eeacd0e0b7a','NRS02000','STDNT257727','Excuse Slip Request Denied','Your Excuse Slip (ID: EXC-96f23604) has been denied.','document_request_action',0,'2026-09-23 01:03:48',NULL,NULL),('7aac3df4-246b-4fc8-be60-d13e661dea8f',NULL,'STDNT001133','Doctor Visit Rescheduled','Moved to 9/23/26, 12:34 PM.','BATCH_RESCHEDULED',0,'2026-09-22 04:26:09',NULL,NULL),('7bdb3de8-56ee-4eba-a495-98e07cac735c',NULL,'STDNT345411','Rescheduled: Annual BMI','New schedule: 2026-09-23 from 10:22:00 to 12:24:00.','SCREENING_UPDATED',0,'2026-09-22 02:22:48',NULL,NULL),('7d5f332f-764e-4a94-8772-33e516dbee69','NRS02000','PRNT003','Documentation Updated: Clark Ken Marcelo','Clark Ken Marcelo - Headache. Intervention: Give Medicine . Advice: Take Rest.','clinic_documentation',0,'2026-09-22 02:10:05',NULL,NULL),('7e3740f6-e45e-4b70-a18d-c0d82ba24030',NULL,'STDNT120504','Doctor Visit Rescheduled','Moved to 9/23/26, 12:44 PM.','BATCH_RESCHEDULED',0,'2026-09-22 04:26:09',NULL,NULL),('7ee45e17-66c5-477c-a6d0-87944fc757b8','NRS02000','PRNT003','Clinic Visit Logged: Clark Ken Marcelo','Clark Ken Marcelo visited for General Checkup. Time In: 18:47:00','clinic_visit',0,'2026-09-22 10:47:39',NULL,NULL),('7f96a65c-0568-4465-93be-ef872276de56','STDNT257727','NRS02000','New Referral Slip Request','Clark Ken Marcelo submitted a Referral Slip request for Premiere Laboratory. Reason: for requirements','referral_slip_request',1,'2026-09-22 05:11:59','2026-09-22 05:12:11',NULL),('801c754d-b504-11f1-81cf-88241b1f4709','NRS02000','STDNT257727','Special Requirement Assigned','You have been assigned a special requirement: \"Vision Assessment\". Deadline: 2026-09-26','special_requirement',1,'2026-09-20 15:03:55','2026-09-20 15:04:09',NULL),('82581237-48c5-4935-b17b-6c3183c480a2',NULL,'d806dd6e-bd0d-4820-8df1-0c40ae94dca0','Doctor Visit Rescheduled','Moved to 9/23/26, 1:09 PM.','BATCH_RESCHEDULED',0,'2026-09-22 04:26:09',NULL,NULL),('826e2d34-8e23-4a2b-920f-eddb5b2aee35',NULL,'STDNT257727','Cancelled Screening: Annual BMI Monitoring','The scheduled BMI screening (\"Annual BMI Monitoring\") on 2026-09-22 has been cancelled.','SCREENING_CANCELLED',1,'2026-09-21 16:29:16','2026-09-22 06:24:23',NULL),('82918680-8369-49da-b7a7-327091c72655',NULL,'cd890b6a-1dc8-4ee3-8247-7e4e138a32a5','New Health Screening: Annual BMI Monitoring','You have been scheduled for a BMI Screening.\nDate: 2026-09-22\nTime: 00:31 - 02:30\nProgram: All Programs','SCREENING_SCHEDULED',0,'2026-09-21 16:28:57',NULL,NULL),('82ee3450-fe00-435a-849b-7d4d4730e28a','NRS02000','STDNT257727','Medicine Dispensed','Dispensed 1 Tablet/s of Biogesic (Paracetamol).','MEDICINE_DISPENSE',1,'2026-09-22 04:24:13','2026-09-22 04:27:07',NULL),('82f586f0-d10a-4c48-9464-5dc46c0026c1','NRS02000','STDNT257727','Excuse Slip Request Completed','Your Excuse Slip (ID: EXC-1e3c2ceb) has been completed.','document_request_action',1,'2026-09-21 18:24:45','2026-09-22 06:24:02',NULL),('84801eda-9369-4918-97e0-f7ae71a71f40','NRS02000','PRNT003','Clinic Time Out: Clark Ken Marcelo','Clark Ken Marcelo checked out of the clinic at 23:40.','clinic_timeout',0,'2026-09-22 15:40:35',NULL,NULL),('8596939c-4d25-400b-b48f-49a6ae19486a',NULL,'STDNT350927','New Health Screening: Annual BMI Monitoring','You have been scheduled for a BMI Screening.\nDate: 2026-09-22\nTime: 00:31 - 02:30\nProgram: All Programs','SCREENING_SCHEDULED',0,'2026-09-21 16:28:56',NULL,NULL),('860de676-67d9-474f-a78d-01e88f3a4982','NRS02000','STDNT345411','Clinic Visit Logged: Yahweh Bernardo','Yahweh Bernardo visited for General Checkup. Time In: 10:01:00','clinic_visit',0,'2026-09-22 02:01:00',NULL,NULL),('86c1a27e-2ecb-4399-9d58-6c64b0408e8b','NRS02000','PRNT003','Clinic Visit Logged: Clark Ken Marcelo','Clark Ken Marcelo visited for General Checkup. Time In: 16:59:00','clinic_visit',0,'2026-09-24 08:59:09',NULL,NULL),('87aaa02e-8e26-4546-9819-159c7d650a00','NRS02000','STDNT345411','Excuse Slip Request Completed','Your Excuse Slip (ID: EXC-e06c6aa9) has been completed.','document_request_action',0,'2026-09-21 17:35:12',NULL,NULL),('887eacdf-174e-4221-ab9b-7b9c936c7f92',NULL,'STDNT332211','New Health Screening: Annual BMI Monitoring','You have been scheduled for a BMI Screening.\nDate: 2026-09-22\nTime: 00:31 - 02:30\nProgram: All Programs','SCREENING_SCHEDULED',0,'2026-09-21 16:28:57',NULL,NULL),('8974aceb-c57a-4db3-b556-a38f37dc6367','NRS02000','PRNT003','Clinic Time Out: Clark Ken Marcelo','Clark Ken Marcelo checked out of the clinic at 23:40.','clinic_timeout',0,'2026-09-22 15:40:56',NULL,NULL),('897f26e2-71fa-4209-b1e0-f84960f31332','NRS02000','STDNT001133','Doctor Visit Scheduled','Appointment with Dr. Alvin Ligutan on 9/23/26, 10:34 AM.','APPOINTMENT_SCHEDULED',0,'2026-09-22 02:29:12',NULL,NULL),('89bbfdca-c61c-4efd-9ffa-4c3f3efc6120','NRS02000','STDNT257727','Medicine Dispensed','Dispensed 2 pcs. of Alcohol (Ethyl).','MEDICINE_DISPENSE',1,'2026-09-22 03:12:09','2026-09-22 06:23:24',NULL),('8b3dedee-124f-421b-9b40-53c659e1afa4','NRS02000','STDNT257727','Clinic Time Out: Clark Ken Marcelo','Clark Ken Marcelo checked out of the clinic at 18:48.','clinic_timeout',1,'2026-09-22 10:48:46','2026-09-22 10:59:41',NULL),('8d435b4b-b5df-11f1-81cf-88241b1f4709','NRS02000','STDNT001133','Special Requirement Assigned','You have been assigned a special requirement: \"Drug Test\". Deadline: 2026-09-29','special_requirement',0,'2026-09-21 17:11:57',NULL,NULL),('8edf3eb1-c781-424b-8000-c53a037a253b',NULL,'STDNT371918','Rescheduled: Annual BMI','New schedule: 2026-09-22 from 10:22:00 to 12:24:00.','SCREENING_UPDATED',0,'2026-09-22 02:23:02',NULL,NULL),('8fa93847-2a1d-4943-93c9-2b167b526232',NULL,'STDNT112233','Doctor Visit Rescheduled','Moved to 9/22/26, 8:12 PM.','BATCH_RESCHEDULED',0,'2026-09-22 12:05:43',NULL,NULL),('90b6a55f-f68b-4e83-a110-ee6ae9a967c6','NRS02000','d806dd6e-bd0d-4820-8df1-0c40ae94dca0','Doctor Visit Scheduled','Appointment with Dr. Alvin Ligutan on 9/23/26, 11:09 AM.','APPOINTMENT_SCHEDULED',0,'2026-09-22 02:29:13',NULL,NULL),('911c6cb8-07ca-4c34-ba84-91124a7ddab5','NRS02000','PRNT003','Update on Clark Ken Marcelo\'s Request','The Excuse Slip requested for Clark Ken Marcelo was completed. Note: Wan2','document_request_action',0,'2026-09-23 01:09:37',NULL,NULL),('91f62fd2-4027-4b56-a047-6a1f0cfcef89','NRS02000','PRNT003','Update on Clark Ken Marcelo\'s Request','The Excuse Slip requested for Clark Ken Marcelo was completed.','document_request_action',0,'2026-09-21 18:24:57',NULL,NULL),('927fccce-7e57-4da1-ae6c-75e37f48ce11','NRS02000','STDNT257727','Clinic Visit Logged: Clark Ken Marcelo','Clark Ken Marcelo visited for General Checkup. Time In: 19:09:00','clinic_visit',0,'2026-09-24 11:09:43',NULL,NULL),('934e7aa1-9c91-4e4e-ad0f-87e490471e7e',NULL,'STDNT257727','Requirement Status Updated','Your requirement \"Drug Test\" status was updated to \"Pending\". Remarks: None','requirement_update',0,'2026-09-23 19:01:58',NULL,NULL),('93e662da-84f6-45e1-a24c-5f064229827e',NULL,'STDNT345411','New Health Screening: Annual BMI Monitoring','You have been scheduled for a BMI Screening.\nDate: 2026-09-22\nTime: 00:31 - 02:30\nProgram: All Programs','SCREENING_SCHEDULED',1,'2026-09-21 16:28:57','2026-09-21 17:02:35',NULL),('93ec66a0-bcac-4459-8a89-f69ec433221c','NRS02000','PRNT003','Clinic Visit Logged: Clark Ken Marcelo','Clark Ken Marcelo visited for General Checkup. Time In: 18:49:00','clinic_visit',0,'2026-09-22 10:49:07',NULL,NULL),('94b7e97d-4ba5-494d-b925-45fb0bc7aa35',NULL,'STDNT345411','Doctor Visit Rescheduled','Moved to 9/22/26, 8:37 PM.','BATCH_RESCHEDULED',0,'2026-09-22 12:05:43',NULL,NULL),('958649ce-d118-48ed-80fc-1112bd32cde3','NRS02000','STDNT257727','Documentation Updated: Clark Ken Marcelo','Clark Ken Marcelo - Headache. Intervention: Give Medicine . Advice: Take Rest.','clinic_documentation',1,'2026-09-22 02:10:05','2026-09-22 06:23:44',NULL),('96756696-a6e5-4cac-b328-e6142b17de5c','NRS02000','PRNT001','Clinic Visit Logged: Yahweh Bernardo','Yahweh Bernardo visited for General Checkup. Time In: 08:46:00','clinic_visit',0,'2026-09-23 00:46:52',NULL,NULL),('97719b87-fba2-4ca7-914a-319322721911','NRS02000','STDNT345411','Incident Report Filed','Incident recorded at 2nd floor on 9/22/26, 10:44 AM.','INCIDENT_REPORT',0,'2026-09-22 02:45:19',NULL,NULL),('97c10180-8905-4500-88d6-8cc67e2b6ad1',NULL,'STDNT371918','Scheduled: Annual BMI','BMI Screening on 2026-09-24 from 10:22 to 12:24.','SCREENING_SCHEDULED',0,'2026-09-22 02:22:27',NULL,NULL),('9951097b-7870-4549-bd1d-e9571b280fa5','NRS02000','STDNT345411','Clinic Visit Logged: Yahweh Bernardo','Yahweh Bernardo visited for General Checkup. Time In: 08:46:00','clinic_visit',0,'2026-09-23 00:46:52',NULL,NULL),('9a0501e5-4de5-4f6e-9793-be57f8f3e16f','NRS02000','PRNT003','Documentation Updated: Clark Ken Marcelo','Clark Ken Marcelo - Headache. Intervention: Give Medicine . Advice: Take Rest. Time Out: 12:28:00.','clinic_documentation',0,'2026-09-22 04:23:07',NULL,NULL),('9b3611f0-8f46-4b8a-8e15-fda8cceaedac',NULL,'d806dd6e-bd0d-4820-8df1-0c40ae94dca0','New Health Screening: Annual BMI Monitoring','You have been scheduled for a BMI Screening.\nDate: 2026-09-22\nTime: 00:31 - 02:30\nProgram: All Programs','SCREENING_SCHEDULED',0,'2026-09-21 16:28:56',NULL,NULL),('9c873403-f2bd-43b5-8b96-51a76fd027e3','NRS02000','STDNT257727','Clinic Time Out: Clark Ken Marcelo','Clark Ken Marcelo checked out of the clinic at 18:48.','clinic_timeout',1,'2026-09-22 10:48:56','2026-09-22 10:59:37',NULL),('9edbd395-b507-11f1-81cf-88241b1f4709','STDNT257727','NRS02000','New Student Submission','Clark Ken Marcelo (Bachelor of Science in Information Technology) submitted \"Vision Assessment\" (Submitted).','requirement_submission',1,'2026-09-20 15:26:15','2026-09-20 15:29:36',NULL),('9edc1961-60f8-4f1f-a871-b8bf878e3d00',NULL,'f95f98e6-f4ec-4a55-8c86-d56c044500c9','Scheduled: Annual BMI','BMI Screening on 2026-09-24 from 10:22 to 12:24.','SCREENING_SCHEDULED',0,'2026-09-22 02:22:27',NULL,NULL),('9f6a0611-1e43-4044-b326-4417cfedd3d7','NRS02000','PRNT003','Child Medicine Dispensing','Clark Ken Marcelo was dispensed 2 pcs. of Alcohol (Ethyl).','MEDICINE_DISPENSE_PARENT',0,'2026-09-22 03:12:09',NULL,NULL),('9f873169-9a75-44af-9c70-a9f8b68d78c7','NRS02000','PRNT003','Clinic Visit Logged: Clark Ken Marcelo','Clark Ken Marcelo visited for General Checkup. Time In: 18:53:00','clinic_visit',0,'2026-09-24 10:53:00',NULL,NULL),('9fb1dc8a-6930-4ffa-bacb-9d9f6496b590',NULL,'STDNT345411','Scheduled: Annual','BMI Screening on 2026-09-25 from 15:21 to 17:21.','SCREENING_SCHEDULED',0,'2026-09-25 07:23:15',NULL,NULL),('9fd64e97-98ea-4a53-9cab-bec8f0a0f881',NULL,'STDNT345411','New Health Screening: Annual BMI Monitoring','You have been scheduled for a BMI Screening.\nDate: 2026-09-22\nTime: 00:31 - 02:30\nProgram: All Programs','SCREENING_SCHEDULED',1,'2026-09-21 16:28:58','2026-09-21 17:02:42',NULL),('a147bd5a-1293-4cc3-9dd4-7501ee8f4b78',NULL,'a406d9f4-2525-4a26-af5a-5003dec47f67','New Health Screening: Annual BMI Monitoring','You have been scheduled for a BMI Screening.\nDate: 2026-09-22\nTime: 00:31 - 02:30\nProgram: All Programs','SCREENING_SCHEDULED',0,'2026-09-21 16:28:58',NULL,NULL),('a19d75b5-aef0-4a91-bf74-7b613249f023','NRS02000','PRNT001','Clinic Time Out: Yahweh Bernardo','Yahweh Bernardo checked out of the clinic at 10:05.','clinic_timeout',0,'2026-09-22 02:02:00',NULL,NULL),('a22fbf3e-d984-48fa-85f9-fda5f210a5d2',NULL,'d806dd6e-bd0d-4820-8df1-0c40ae94dca0','Scheduled: Annual','BMI Screening on 2026-09-25 from 15:21 to 17:21.','SCREENING_SCHEDULED',0,'2026-09-25 07:23:15',NULL,NULL),('a292741b-7a6e-403b-8c06-846a19624c74',NULL,'STDNT371918','New Health Screening: Annual BMI Monitoring','You have been scheduled for a BMI Screening.\nDate: 2026-09-22\nTime: 00:31 - 02:30\nProgram: All Programs','SCREENING_SCHEDULED',0,'2026-09-21 16:28:56',NULL,NULL),('a573cea3-a07d-4044-bbd4-3023eaf4d907',NULL,'STDNT350927','Doctor Visit Rescheduled','Moved to 9/23/26, 1:14 PM.','BATCH_RESCHEDULED',0,'2026-09-22 04:26:09',NULL,NULL),('a5cc7ccb-1421-4333-8931-04b4abc7a5de',NULL,'STDNT371918','New Health Screening: Annual BMI Monitoring','You have been scheduled for a BMI Screening.\nDate: 2026-09-22\nTime: 00:31 - 02:30\nProgram: All Programs','SCREENING_SCHEDULED',0,'2026-09-21 16:28:58',NULL,NULL),('a680b012-6330-4b91-a08d-80a260d6cd17',NULL,'STDNT345411','Doctor Visit Rescheduled','Moved to 9/23/26, 1:04 PM.','BATCH_RESCHEDULED',0,'2026-09-22 04:26:09',NULL,NULL),('a7f7c128-ca28-49d9-bc5c-a628fa8e79e8',NULL,'STDNT345411','Cancelled Screening: Annual BMI Monitoring','The scheduled BMI screening (\"Annual BMI Monitoring\") on 2026-09-22 has been cancelled.','SCREENING_CANCELLED',1,'2026-09-21 16:29:18','2026-09-21 17:02:37',NULL),('a82c6e5d-a2b8-48a0-aca1-7ab2a8689f48','NRS02000','PRNT003','Student Incident Report','Incident involving Clark Ken Marcelo recorded at 201 on 9/22/26, 10:59 AM.','INCIDENT_REPORT_PARENT',0,'2026-09-22 03:00:07',NULL,NULL),('a8bb348a-b504-11f1-81cf-88241b1f4709','STDNT257727','NRS02000','New Student Submission','Clark Ken Marcelo (Bachelor of Science in Information Technology) submitted \"Vision Assessment\" (Submitted).','requirement_submission',1,'2026-09-20 15:05:04','2026-09-20 15:29:50',NULL),('a8fdc2ff-b505-11f1-81cf-88241b1f4709','STDNT257727','NRS02000','New Student Submission','Clark Ken Marcelo (Bachelor of Science in Information Technology) submitted \"Vision Assessment\" (Submitted).','requirement_submission',1,'2026-09-20 15:12:13','2026-09-20 15:29:46',NULL),('a9f08fe6-8623-4257-96d4-9d5f3b2e7cba',NULL,'STDNT001133','Cancelled Screening: Annual BMI Monitoring','The scheduled BMI screening (\"Annual BMI Monitoring\") on 2026-09-22 has been cancelled.','SCREENING_CANCELLED',0,'2026-09-21 16:29:16',NULL,NULL),('aa0fcc93-67c1-467c-a82b-95914b4d19b1',NULL,'STDNT112233','Scheduled: Annual','BMI Screening on 2026-09-25 from 15:21 to 17:21.','SCREENING_SCHEDULED',0,'2026-09-25 07:23:15',NULL,NULL),('aa16c74a-8483-4bc3-81db-e1a99007fde9','NRS02000','NRS02000','Clinic Time Out: Yahweh Bernardo','Yahweh Bernardo checked out of the clinic at 10:05.','clinic_timeout',1,'2026-09-22 02:02:00','2026-09-22 02:02:12',NULL),('aa18737b-0aec-40b5-8cdf-82d11aa9ea8b',NULL,'STDNT350927','Scheduled: Annual','BMI Screening on 2026-09-25 from 15:21 to 17:21.','SCREENING_SCHEDULED',0,'2026-09-25 07:23:15',NULL,NULL),('aac48d0c-d27c-45b2-a375-a1f055a5aeca',NULL,'STDNT332211','Rescheduled: Annual BMI','New schedule: 2026-09-23 from 10:22:00 to 12:24:00.','SCREENING_UPDATED',0,'2026-09-22 02:22:48',NULL,NULL),('ab71fb6d-57d5-4369-b2e4-3430b0770d0d',NULL,'cd890b6a-1dc8-4ee3-8247-7e4e138a32a5','Cancelled Screening: Annual BMI Monitoring','The scheduled BMI screening (\"Annual BMI Monitoring\") on 2026-09-22 has been cancelled.','SCREENING_CANCELLED',0,'2026-09-21 16:29:18',NULL,NULL),('abdef7af-88f2-4e6d-895b-b6de740fbfc9',NULL,'STDNT371918','Scheduled: Annual','BMI Screening on 2026-09-25 from 15:21 to 17:21.','SCREENING_SCHEDULED',0,'2026-09-25 07:23:15',NULL,NULL),('ac7b4677-b507-11f1-81cf-88241b1f4709','STDNT257727','NRS02000','New Student Submission','Clark Ken Marcelo (Bachelor of Science in Information Technology) submitted \"Vision Assessment\" (Submitted).','requirement_submission',1,'2026-09-20 15:26:38','2026-09-20 15:29:35',NULL),('adb18345-823f-42e1-8f96-03fea53b6520','NRS02000','PRNT003','Clinic Time Out: Clark Ken Marcelo','Clark Ken Marcelo checked out of the clinic at 10:15.','clinic_timeout',0,'2026-09-22 02:10:59',NULL,NULL),('ae97c869-43d0-4494-9837-f9650737d920',NULL,'a406d9f4-2525-4a26-af5a-5003dec47f67','Doctor Visit Rescheduled','Moved to 9/23/26, 1:29 PM.','BATCH_RESCHEDULED',0,'2026-09-22 04:26:09',NULL,NULL),('af5a0fa8-1688-4f87-a768-5a5063a69d37',NULL,'cd890b6a-1dc8-4ee3-8247-7e4e138a32a5','Rescheduled: Annual BMI','New schedule: 2026-09-22 from 10:22:00 to 12:24:00.','SCREENING_UPDATED',0,'2026-09-22 02:23:02',NULL,NULL),('af85fd95-0399-4d8b-bc71-225389b118ea',NULL,'STDNT371918','Cancelled Screening: Annual BMI Monitoring','The scheduled BMI screening (\"Annual BMI Monitoring\") on 2026-09-22 has been cancelled.','SCREENING_CANCELLED',0,'2026-09-21 16:29:18',NULL,NULL),('b0e17ad9-bdc6-4e69-a520-e21ce16e3883','NRS02000','PRNT001','Clinic Time Out: Yahweh Bernardo','Yahweh Bernardo checked out of the clinic at 09:59.','clinic_timeout',0,'2026-09-22 01:59:29',NULL,NULL),('b100e191-de47-497e-aa4d-1c74affff853','NRS02000','PRNT003','Clinic Time Out: Clark Ken Marcelo','Clark Ken Marcelo checked out of the clinic at 08:45.','clinic_timeout',0,'2026-09-23 00:45:42',NULL,NULL),('b125f315-2b2f-4b6c-8d38-1934d2b2bf4b','NRS02000','PRNT003','Update on Clark Ken Marcelo\'s Request','The Excuse Slip requested for Clark Ken Marcelo was completed.','document_request_action',0,'2026-09-21 18:24:45',NULL,NULL),('b148d2ab-ac96-4086-ae95-cdc16cbeca1b',NULL,'a406d9f4-2525-4a26-af5a-5003dec47f67','Scheduled: Annual BMI','BMI Screening on 2026-09-24 from 10:22 to 12:24.','SCREENING_SCHEDULED',0,'2026-09-22 02:22:27',NULL,NULL),('b29552ea-872d-4d56-b1a1-747547282a02',NULL,'STDNT257727','Scheduled: Annual','BMI Screening on 2026-09-25 from 15:21 to 17:21.','SCREENING_SCHEDULED',0,'2026-09-25 07:23:15',NULL,NULL),('b36d10ed-b505-11f1-81cf-88241b1f4709','STDNT257727','NRS02000','New Student Submission','Clark Ken Marcelo (Bachelor of Science in Information Technology) submitted \"Vision Assessment\" (Submitted).','requirement_submission',1,'2026-09-20 15:12:31','2026-09-20 15:29:45',NULL),('b3b9f845-215e-495d-880c-28229e9ee031','NRS02000','PRNT003','Clinic Visit Logged: Clark Ken Marcelo','Clark Ken Marcelo visited for General Checkup. Time In: 20:18:00','clinic_visit',0,'2026-09-23 12:18:04',NULL,NULL),('b4c1db63-5a73-47d7-981d-ebc596cc8481','NRS02000','PRNT003','Clinic Time Out: Clark Ken Marcelo','Clark Ken Marcelo checked out of the clinic at 21:37.','clinic_timeout',0,'2026-09-24 13:37:39',NULL,NULL),('b4f51752-103e-427d-b626-95183049dba1','NRS02000','STDNT257727','Clinic Visit Logged: Clark Ken Marcelo','Clark Ken Marcelo visited for General Checkup. Time In: 21:12:00','clinic_visit',0,'2026-09-24 13:12:19',NULL,NULL),('b6311f1c-b5eb-11f1-81cf-88241b1f4709','NRS02000','STDNT257727','Special Requirement Assigned','You have been assigned a special requirement: \"Urine Test\". Deadline: 2026-09-29','special_requirement',1,'2026-09-21 18:39:00','2026-09-21 18:43:05',NULL),('b6a8c7c5-4caa-4d56-ade5-3c94b64eff45',NULL,'STDNT345411','Rescheduled: Annual BMI','New schedule: 2026-09-22 from 10:22:00 to 12:24:00.','SCREENING_UPDATED',0,'2026-09-22 02:23:02',NULL,NULL),('b6f819fb-b0ba-471a-8f6e-feb667bed86a',NULL,'STDNT345411','Scheduled: Annual BMI','BMI Screening on 2026-09-24 from 10:22 to 12:24.','SCREENING_SCHEDULED',0,'2026-09-22 02:22:27',NULL,NULL),('b7650d84-d416-4501-9407-be4558b80671','NRS02000','STDNT332211','Doctor Visit Scheduled','Appointment with Dr. Alvin Ligutan on 9/23/26, 10:59 AM.','APPOINTMENT_SCHEDULED',0,'2026-09-22 02:29:13',NULL,NULL),('b76b629a-bc36-4e3d-8cb1-71ca77dcb65d','NRS02000','STDNT257727','Clinic Time Out: Clark Ken Marcelo','Clark Ken Marcelo checked out of the clinic at 23:40.','clinic_timeout',0,'2026-09-22 15:40:56',NULL,NULL),('b76eed69-eb1e-48ba-aaea-d72652af19c7','NRS02000','PRNT001','Clinic Time Out: Yahweh Bernardo','Yahweh Bernardo checked out of the clinic at 09:00.','clinic_timeout',0,'2026-09-23 00:52:04',NULL,NULL),('b9723246-fe89-4fe3-bd96-4c4e86fc160b','NRS02000','STDNT350927','Doctor Visit Scheduled','Appointment with Dr. Alvin Ligutan on 9/23/26, 11:14 AM.','APPOINTMENT_SCHEDULED',0,'2026-09-22 02:29:13',NULL,NULL),('bad0c8f2-4f9e-4a99-9c51-e93a57975724','NRS02000','PRNT003','Clinic Visit Logged: Clark Ken Marcelo','Clark Ken Marcelo visited for General Checkup. Time In: 10:05:00','clinic_visit',0,'2026-09-22 02:05:50',NULL,NULL),('bb9957cd-bcb6-44d0-86af-b519bea643b7','NRS02000','PRNT003','Clinic Time Out: Clark Ken Marcelo','Clark Ken Marcelo checked out of the clinic at 18:59.','clinic_timeout',0,'2026-09-24 10:59:11',NULL,NULL),('bc0e2d5e-1fd3-4d85-80d2-7b26aa16f90d','NRS02000','STDNT257727','Excuse Slip Request Completed','Your Excuse Slip (ID: EXC-750b4050) has been completed.','document_request_action',1,'2026-09-21 18:24:35','2026-09-22 06:24:05',NULL),('bc139262-04fe-42b6-b963-ca0cda4cc51f',NULL,'STDNT257727','Doctor Visit Rescheduled','Moved to 9/22/26, 8:27 PM.','BATCH_RESCHEDULED',1,'2026-09-22 12:05:43','2026-09-22 14:23:42',NULL),('bca4d8a9-b505-11f1-81cf-88241b1f4709','STDNT257727','NRS02000','New Student Submission','Clark Ken Marcelo (Bachelor of Science in Information Technology) submitted \"Vision Assessment\" (Submitted).','requirement_submission',1,'2026-09-20 15:12:46','2026-09-20 15:29:44',NULL),('bd74439c-077d-44f6-a593-be869cf8c568','NRS02000','STDNT257727','Doctor Visit Scheduled','Appointment with Dr. Alvin Ligutan on 9/23/26, 10:54 AM.','APPOINTMENT_SCHEDULED',1,'2026-09-22 02:29:12','2026-09-22 06:23:26',NULL),('bdc271cc-5cd6-437c-acfa-fa8664390ce4','NRS02000','STDNT257727','Excuse Slip Request Completed','Your Excuse Slip (ID: EXC-ecc84d90) has been completed.','document_request_action',1,'2026-09-21 18:24:41','2026-09-22 06:24:08',NULL),('bf273173-b22e-4a40-98f8-1c828d805ade',NULL,'STDNT350927','New Health Screening: Annual BMI Monitoring','You have been scheduled for a BMI Screening.\nDate: 2026-09-22\nTime: 00:31 - 02:30\nProgram: All Programs','SCREENING_SCHEDULED',0,'2026-09-21 16:28:58',NULL,NULL),('c088c394-b60e-4bcf-b375-78c9b92f81a8','NRS02000','STDNT257727','Clinic Visit Logged: Clark Ken Marcelo','Clark Ken Marcelo visited for General Checkup. Time In: 10:05:00','clinic_visit',1,'2026-09-22 02:05:50','2026-09-22 06:23:47',NULL),('c149e4c9-13bb-4a4a-a713-77377aa7f270','NRS02000','PRNT003','Clinic Visit Documented: Clark Ken Marcelo','Clark Ken Marcelo visit documented for Others. Time In: 19:09:00 Recommendations: Take Rest','clinic_visit_update',0,'2026-09-24 13:02:45',NULL,NULL),('c2439ed9-a6b1-407d-9ae5-59d613bd874b',NULL,'cd890b6a-1dc8-4ee3-8247-7e4e138a32a5','New Health Screening: Annual BMI Monitoring','You have been scheduled for a BMI Screening.\nDate: 2026-09-22\nTime: 00:31 - 02:30\nProgram: All Programs','SCREENING_SCHEDULED',0,'2026-09-21 16:28:58',NULL,NULL),('c34fe9ca-a780-4efb-8cd5-557f645067be','NRS02000','STDNT257727','Clinic Visit Logged: Clark Ken Marcelo','Clark Ken Marcelo visited for General Checkup. Time In: 23:24:00','clinic_visit',0,'2026-09-22 15:24:19',NULL,NULL),('c3b14b82-b507-11f1-81cf-88241b1f4709','STDNT257727','NRS02000','New Student Submission','Clark Ken Marcelo (Bachelor of Science in Information Technology) submitted \"Vision Assessment\" (Submitted).','requirement_submission',1,'2026-09-20 15:27:17','2026-09-20 15:29:33',NULL),('c3bfb690-c3e1-46d2-b639-5538c930dc6a','NRS02000','STDNT257727','Excuse Slip Request Completed','Your Excuse Slip (ID: EXC-588bcb23) has been completed.','document_request_action',1,'2026-09-21 18:00:17','2026-09-22 06:24:10',NULL),('c504913c-9cdb-4913-991d-fc2147c2e0e3','NRS02000','STDNT345411','Clinic Visit Logged: Yahweh Bernardo','Yahweh Bernardo visited for General Checkup. Time In: 09:52:00','clinic_visit',0,'2026-09-22 01:52:53',NULL,NULL),('c513823a-7983-49fc-af6a-a27ee770ae6a','NRS02000','PRNT003','Clinic Visit Logged: Clark Ken Marcelo','Clark Ken Marcelo visited for General Checkup. Time In: 12:22:00','clinic_visit',0,'2026-09-22 04:22:08',NULL,NULL),('c64e3ea1-3750-4f8c-a01d-ef7166f28f04',NULL,'7b6279f2-9149-4006-9678-f37c2e3b729f','Scheduled: Annual','BMI Screening on 2026-09-25 from 15:21 to 17:21.','SCREENING_SCHEDULED',0,'2026-09-25 07:23:15',NULL,NULL),('c67d073f-44f3-4b89-8643-543792f51682',NULL,'cd890b6a-1dc8-4ee3-8247-7e4e138a32a5','Scheduled: Annual','BMI Screening on 2026-09-25 from 15:21 to 17:21.','SCREENING_SCHEDULED',0,'2026-09-25 07:23:15',NULL,NULL),('c735bf19-b506-11f1-81cf-88241b1f4709','STDNT257727','NRS02000','New Student Submission','Clark Ken Marcelo (Bachelor of Science in Information Technology) submitted \"Vision Assessment\" (Submitted).','requirement_submission',1,'2026-09-20 15:20:14','2026-09-20 15:29:42',NULL),('c8a09cc4-0c24-4a36-bd09-acff488d4cdd','STDNT257727','NRS02000','New Excuse Slip Request','Clark Ken Marcelo submitted an Excuse Slip request for 2026-09-14 to 2026-09-18. Reason: nagtatae talaga','excuse_slip_request',1,'2026-09-21 18:23:39','2026-09-21 18:36:10',NULL),('c95adf0f-65b3-49fd-a5b1-ad9c54951f8e','NRS02000','PRNT003','Clinic Visit Logged: Clark Ken Marcelo','Clark Ken Marcelo visited for General Checkup. Time In: 10:05:00','clinic_visit',0,'2026-09-22 02:05:49',NULL,NULL),('caa6369e-a730-4882-b74b-05729bb610e2',NULL,'STDNT371918','Doctor Visit Rescheduled','Moved to 9/22/26, 8:52 PM.','BATCH_RESCHEDULED',0,'2026-09-22 12:05:43',NULL,NULL),('cb351fa8-0985-4523-823f-3a37e7f4d18b',NULL,'STDNT001133','Rescheduled: Annual BMI','New schedule: 2026-09-22 from 10:22:00 to 12:24:00.','SCREENING_UPDATED',0,'2026-09-22 02:23:02',NULL,NULL),('cc32419f-de14-4259-95a1-eefd31e333fb','NRS02000','PRNT003','Clinic Visit Logged: Clark Ken Marcelo','Clark Ken Marcelo visited for General Checkup. Time In: 23:24:00','clinic_visit',0,'2026-09-22 15:24:18',NULL,NULL),('cdcc0b53-4cf9-4330-bdbc-13680262c522',NULL,'STDNT001133','Scheduled: Annual','BMI Screening on 2026-09-25 from 15:21 to 17:21.','SCREENING_SCHEDULED',0,'2026-09-25 07:23:15',NULL,NULL),('ceb802db-fd10-4150-93da-2d5480039bca',NULL,'cd890b6a-1dc8-4ee3-8247-7e4e138a32a5','New Health Screening: Annual BMI Monitoring','You have been scheduled for a BMI Screening.\nDate: 2026-09-22\nTime: 00:31 - 02:30\nProgram: All Programs','SCREENING_SCHEDULED',0,'2026-09-21 16:28:56',NULL,NULL),('cfeb5d1e-7225-442c-9866-00682a6f8a5b','NRS02000','STDNT257727','Clinic Time Out: Clark Ken Marcelo','Clark Ken Marcelo checked out of the clinic at 18:49.','clinic_timeout',1,'2026-09-22 10:49:23','2026-09-22 10:59:33',NULL),('d0066524-73b3-401c-a87f-8e88d0dfe980','NRS02000','PRNT003','Update on Clark Ken Marcelo\'s Request','The Excuse Slip requested for Clark Ken Marcelo was completed.','document_request_action',0,'2026-09-21 17:44:09',NULL,NULL),('d118b5a0-36d6-437f-9d2f-d14f040eee9f','NRS02000','STDNT257727','Clinic Visit Logged: Clark Ken Marcelo','Clark Ken Marcelo visited for General Checkup. Time In: 23:42:00','clinic_visit',0,'2026-09-22 15:42:06',NULL,NULL),('d2ecc82d-08c9-43ee-9ff4-cb3f753ef10f','NRS02000','STDNT257727','Doctor Visit Scheduled','Appointment with Dr. Alvin Ligutan on 9/22/26, 10:00 PM.','APPOINTMENT_SCHEDULED',1,'2026-09-22 14:05:34','2026-09-22 14:23:39',NULL),('d3359de8-f23c-4453-a3c2-21a7721c677a',NULL,'STDNT257727','Doctor Visit Rescheduled','Moved to 9/23/26, 12:54 PM.','BATCH_RESCHEDULED',1,'2026-09-22 04:26:09','2026-09-22 04:26:42',NULL),('d33a70e6-3405-4cfa-b056-a88149067312','NRS02000','STDNT120504','Doctor Visit Scheduled','Appointment with Dr. Alvin Ligutan on 9/23/26, 10:44 AM.','APPOINTMENT_SCHEDULED',0,'2026-09-22 02:29:12',NULL,NULL),('d3eb02f3-b0ad-4a52-bb3d-a734db05b4fe','NRS02000','STDNT257727','Clinic Visit Logged: Clark Ken Marcelo','Clark Ken Marcelo visited for General Checkup. Time In: 18:47:00','clinic_visit',1,'2026-09-22 10:47:40','2026-09-22 10:59:39',NULL),('d5cc1281-03e1-4854-97ae-7bbe13feb83e',NULL,'STDNT120504','New Health Screening: Annual BMI Monitoring','You have been scheduled for a BMI Screening.\nDate: 2026-09-22\nTime: 00:31 - 02:30\nProgram: All Programs','SCREENING_SCHEDULED',0,'2026-09-21 16:28:58',NULL,NULL),('d8b468c5-ed84-4d0b-96fd-56a093e722f0','NRS02000','PRNT003','Child Medicine Dispensing','Clark Ken Marcelo was dispensed 1 Tablet/s of Biogesic (Paracetamol).','MEDICINE_DISPENSE_PARENT',0,'2026-09-22 04:24:13',NULL,NULL),('d92224c2-1e74-45f6-b8dd-254b7e62f712',NULL,'a406d9f4-2525-4a26-af5a-5003dec47f67','Cancelled Screening: Annual BMI Monitoring','The scheduled BMI screening (\"Annual BMI Monitoring\") on 2026-09-22 has been cancelled.','SCREENING_CANCELLED',0,'2026-09-21 16:29:16',NULL,NULL),('d9a8c92e-4b10-456a-b87a-139fdbe361c8','NRS02000','STDNT257727','Clinic Time Out: Clark Ken Marcelo','Clark Ken Marcelo checked out of the clinic at 21:37.','clinic_timeout',0,'2026-09-24 13:37:39',NULL,NULL),('da1d11af-b507-11f1-81cf-88241b1f4709','STDNT257727','NRS02000','New Student Submission','Clark Ken Marcelo (Bachelor of Science in Information Technology) submitted \"Vision Assessment\" (Submitted).','requirement_submission',1,'2026-09-20 15:27:55','2026-09-20 15:29:28',NULL),('da5bba07-9487-4c0a-89b5-d75801c31291',NULL,'STDNT120504','Doctor Visit Rescheduled','Moved to 9/22/26, 8:17 PM.','BATCH_RESCHEDULED',0,'2026-09-22 12:05:43',NULL,NULL),('db31b0b4-c9ed-463a-a02f-673fa5766e2e','NRS02000','PRNT003','Update on Clark Ken Marcelo\'s Request','The Excuse Slip requested for Clark Ken Marcelo was completed.','document_request_action',0,'2026-09-21 18:24:49',NULL,NULL),('dc7ffe97-ef29-4760-a95c-18bb424850c2',NULL,'STDNT332211','New Health Screening: Annual BMI Monitoring','You have been scheduled for a BMI Screening.\nDate: 2026-09-22\nTime: 00:31 - 02:30\nProgram: All Programs','SCREENING_SCHEDULED',0,'2026-09-21 16:28:56',NULL,NULL),('e053c575-6b48-473f-bf45-3b92f600b93d','NRS02000','PRNT003','Update on Clark Ken Marcelo\'s Request','The Excuse Slip requested for Clark Ken Marcelo was completed.','document_request_action',0,'2026-09-22 04:33:20',NULL,NULL),('e0d0ea69-b4f0-11f1-81cf-88241b1f4709','STDNT257727','NRS02000','requirement','Student Clark Ken Marcelo (Bachelor of Science in Information Technology) submitted \"Dental Assessment\" (Submitted).','requirement_submission',1,'2026-09-20 12:43:28','2026-09-20 12:44:06',NULL),('e0f9f76c-1430-4ce0-a549-db9455f38239',NULL,'STDNT112233','Rescheduled: Annual BMI','New schedule: 2026-09-22 from 10:22:00 to 12:24:00.','SCREENING_UPDATED',0,'2026-09-22 02:23:02',NULL,NULL),('e1a6408c-8a69-4c9c-aed1-efbc0a3efb01','NRS02000','PRNT001','Documentation Updated: Yahweh Bernardo','Yahweh Bernardo - Headache. Intervention: Give Medicine. Advice: Take rest . Time Out: 09:59:00.','clinic_documentation',0,'2026-09-22 02:00:22',NULL,NULL),('e25c8994-6977-4c79-8a65-faef0a21fb0f','NRS02000','STDNT257727','Clinic Visit Logged: Clark Ken Marcelo','Clark Ken Marcelo visited for General Checkup. Time In: 21:40:00','clinic_visit',1,'2026-09-22 13:40:21','2026-09-22 14:23:41',NULL),('e376fa11-8941-4471-83dc-9313f7d79301',NULL,'STDNT257727','Requirement Status Updated','Your requirement \"Urine Test\" status was updated to \"Completed\". Remarks: None','requirement_update',1,'2026-09-21 18:54:48','2026-09-22 06:23:50',NULL),('e37d7e33-ba08-4c62-a99e-e1c1c1c7530b',NULL,'f95f98e6-f4ec-4a55-8c86-d56c044500c9','Doctor Visit Rescheduled','Moved to 9/22/26, 8:22 PM.','BATCH_RESCHEDULED',0,'2026-09-22 12:05:43',NULL,NULL),('e50daa5d-9867-4601-aed0-816f39c0b99c',NULL,'STDNT332211','Doctor Visit Rescheduled','Moved to 9/23/26, 12:59 PM.','BATCH_RESCHEDULED',0,'2026-09-22 04:26:09',NULL,NULL),('e5447074-2a5b-415d-a0f0-d087c9a6fc6b',NULL,'STDNT120504','Scheduled: Annual','BMI Screening on 2026-09-25 from 15:21 to 17:21.','SCREENING_SCHEDULED',0,'2026-09-25 07:23:15',NULL,NULL),('e646d8f8-b957-4620-b3a4-d60ce7d247e3',NULL,'f95f98e6-f4ec-4a55-8c86-d56c044500c9','Cancelled Screening: Annual BMI Monitoring','The scheduled BMI screening (\"Annual BMI Monitoring\") on 2026-09-22 has been cancelled.','SCREENING_CANCELLED',0,'2026-09-21 16:29:18',NULL,NULL),('e6670034-9c34-4b02-9e5e-36dedfdd7e4a','NRS02000','PRNT003','Clinic Visit Documented: Clark Ken Marcelo','Clark Ken Marcelo visit documented for Others. Time In: 21:35:00 Recommendations: Take Rest','clinic_visit_update',0,'2026-09-24 13:37:23',NULL,NULL),('e6e9a716-2aa4-4d29-9c8c-3bbce3e55102',NULL,'d806dd6e-bd0d-4820-8df1-0c40ae94dca0','New Health Screening: Annual BMI Monitoring','You have been scheduled for a BMI Screening.\nDate: 2026-09-22\nTime: 00:31 - 02:30\nProgram: All Programs','SCREENING_SCHEDULED',0,'2026-09-21 16:28:57',NULL,NULL),('e968d849-b507-11f1-81cf-88241b1f4709','STDNT257727','NRS02000','New Student Submission','Clark Ken Marcelo (Bachelor of Science in Information Technology) submitted \"Vision Assessment\" (Submitted).','requirement_submission',1,'2026-09-20 15:28:21','2026-09-20 15:29:23',NULL),('e96f5182-fb15-495c-a134-34f1f9fea542','NRS02000','STDNT257727','Excuse Slip Request Completed','Your Excuse Slip (ID: EXC-3ad8a56c) has been completed.','document_request_action',1,'2026-09-21 18:24:49','2026-09-22 06:24:04',NULL),('e9ca2aad-c537-419f-bda3-54fb149f1bca',NULL,'f95f98e6-f4ec-4a55-8c86-d56c044500c9','Scheduled: Annual','BMI Screening on 2026-09-25 from 15:21 to 17:21.','SCREENING_SCHEDULED',0,'2026-09-25 07:23:15',NULL,NULL),('ea6bc2a9-3f8c-4648-bad1-a920e21dad23','NRS02000','STDNT257727','Clinic Visit Logged: Clark Ken Marcelo','Clark Ken Marcelo visited for General Checkup. Time In: 18:49:00','clinic_visit',1,'2026-09-22 10:49:07','2026-09-22 10:59:35',NULL),('ea701890-5730-4d70-b0d9-ca0a02d63d74',NULL,'STDNT332211','Rescheduled: Annual BMI','New schedule: 2026-09-22 from 10:22:00 to 12:24:00.','SCREENING_UPDATED',0,'2026-09-22 02:23:02',NULL,NULL),('f090ac57-b3c8-4257-bed7-a54cb936bbd4','NRS02000','cd890b6a-1dc8-4ee3-8247-7e4e138a32a5','Doctor Visit Scheduled','Appointment with Dr. Alvin Ligutan on 9/23/26, 11:24 AM.','APPOINTMENT_SCHEDULED',0,'2026-09-22 02:29:13',NULL,NULL),('f0c32fbe-d43e-45f9-99c0-989d84055caa','NRS02000','STDNT257727','Clinic Visit Logged: Clark Ken Marcelo','Clark Ken Marcelo visited for General Checkup. Time In: 20:18:00','clinic_visit',0,'2026-09-23 12:18:04',NULL,NULL),('f0d8009e-ae09-4751-a057-4b1483aa3a33','NRS02000','STDNT345411','Documentation Updated: Yahweh Bernardo','Yahweh Bernardo - Cough. Intervention: advil. Advice: rest.','clinic_documentation',0,'2026-09-23 00:51:31',NULL,NULL),('f15b9916-65b2-4e4b-8ce3-ca4fe67a214e',NULL,'STDNT001133','New Health Screening: Annual BMI Monitoring','You have been scheduled for a BMI Screening.\nDate: 2026-09-22\nTime: 00:31 - 02:30\nProgram: All Programs','SCREENING_SCHEDULED',0,'2026-09-21 16:28:56',NULL,NULL),('f237bea7-8dbf-4991-b1a9-479e58f9fce1','NRS02000','NRS02000','Clinic Visit Logged: Yahweh Bernardo','Yahweh Bernardo visited for General Checkup. Time In: 09:52:00','clinic_visit',1,'2026-09-22 01:52:53','2026-09-22 01:53:16',NULL),('f2a4c83b-b506-11f1-81cf-88241b1f4709','STDNT257727','NRS02000','New Student Submission','Clark Ken Marcelo (Bachelor of Science in Information Technology) submitted \"Vision Assessment\" (Submitted).','requirement_submission',1,'2026-09-20 15:21:27','2026-09-20 15:29:40',NULL),('f2e113eb-6adf-4caa-b160-11a2f97bd2fa',NULL,'d806dd6e-bd0d-4820-8df1-0c40ae94dca0','Cancelled Screening: Annual BMI Monitoring','The scheduled BMI screening (\"Annual BMI Monitoring\") on 2026-09-22 has been cancelled.','SCREENING_CANCELLED',0,'2026-09-21 16:29:18',NULL,NULL),('f466e25a-44b7-4b26-ba25-8a453cdddf81','NRS02000','STDNT257727','Clinic Visit Documented: Clark Ken Marcelo','Clark Ken Marcelo visit documented for Others. Time In: 19:09:00 Recommendations: Take Rest','clinic_visit_update',0,'2026-09-24 13:02:45',NULL,NULL),('f52b9e17-61d0-4574-a758-b149bd638d31',NULL,'STDNT257727','Rescheduled: Annual BMI','New schedule: 2026-09-23 from 10:22:00 to 12:24:00.','SCREENING_UPDATED',1,'2026-09-22 02:22:48','2026-09-22 06:23:31',NULL),('f61e4d74-102a-4ec6-9c93-658bf87ef13a','NRS02000','STDNT257727','Clinic Visit Logged: Clark Ken Marcelo','Clark Ken Marcelo visited for General Checkup. Time In: 16:59:00','clinic_visit',0,'2026-09-24 08:59:09',NULL,NULL),('f6558024-6b5a-4351-9358-358b9b0a3faa','NRS02000','a406d9f4-2525-4a26-af5a-5003dec47f67','Doctor Visit Scheduled','Appointment with Dr. Alvin Ligutan on 9/23/26, 11:29 AM.','APPOINTMENT_SCHEDULED',0,'2026-09-22 02:29:13',NULL,NULL),('f67dee70-0c9e-4056-aa66-14c2595a6bb7','NRS02000','PRNT003','Clinic Time Out: Clark Ken Marcelo','Clark Ken Marcelo checked out of the clinic at 10:10.','clinic_timeout',0,'2026-09-22 02:10:39',NULL,NULL),('f7e282b6-890c-4696-b717-1ab0ee226a46',NULL,'STDNT112233','Cancelled Screening: Annual BMI Monitoring','The scheduled BMI screening (\"Annual BMI Monitoring\") on 2026-09-22 has been cancelled.','SCREENING_CANCELLED',0,'2026-09-21 16:29:18',NULL,NULL),('fad9b199-fc8d-4a92-a154-1ba2a238e08b',NULL,'STDNT001133','Requirement Status Updated','Your requirement \"Drug Test\" status was updated to \"Pending\". Remarks: None','requirement_update',0,'2026-09-23 19:01:10',NULL,NULL),('fc0d509d-6d0f-4366-8ed5-4018bdf5399d','NRS02000','STDNT345411','Clinic Time Out: Yahweh Bernardo','Yahweh Bernardo checked out of the clinic at 10:05.','clinic_timeout',0,'2026-09-22 02:02:00',NULL,NULL),('fca62366-6c1c-4077-8b76-83376eafdfd0',NULL,'STDNT257727','New Health Screening: Annual BMI Monitoring','You have been scheduled for a BMI Screening.\nDate: 2026-09-22\nTime: 00:31 - 02:30\nProgram: All Programs','SCREENING_SCHEDULED',1,'2026-09-21 16:28:56','2026-09-22 06:24:27',NULL),('fd9b4d24-4bac-492f-8798-d0da865b67d9',NULL,'STDNT001133','Rescheduled: Annual BMI','New schedule: 2026-09-23 from 10:22:00 to 12:24:00.','SCREENING_UPDATED',0,'2026-09-22 02:22:48',NULL,NULL),('fdb2be65-0701-439a-a24f-c56f5da8bd51',NULL,'f95f98e6-f4ec-4a55-8c86-d56c044500c9','New Health Screening: Annual BMI Monitoring','You have been scheduled for a BMI Screening.\nDate: 2026-09-22\nTime: 00:31 - 02:30\nProgram: All Programs','SCREENING_SCHEDULED',0,'2026-09-21 16:28:58',NULL,NULL),('ff354817-bbc1-45e6-8a4e-081053a4c365','NRS02000','PRNT003','Clinic Visit Logged: Clark Ken Marcelo','Clark Ken Marcelo visited for General Checkup. Time In: 21:35:00','clinic_visit',0,'2026-09-24 13:35:31',NULL,NULL),('NOTIF-02BIL63QU','NRS02000','STDNT257727','Excuse Slip Request Completed','Your Excuse Slip (ID: EXC-078e9660) has been completed.','document_request_action',1,'2026-09-21 17:48:28','2026-09-22 06:24:14',NULL),('NOTIF-1TDGXOPNW','STDNT257727','NRS02000','New Excuse Slip Request','Clark Ken Marcelo submitted an Excuse Slip request for 2026-09-14 to 2026-09-18. Reason: nagtae','excuse_slip_request',1,'2026-09-21 17:46:58','2026-09-21 18:36:59',NULL),('NOTIF-3a431b8f',NULL,'STDNT257727','Annual Physical Exam','You have been scheduled for a doctor visit (Annual Physical Exam) on 9/21/2026, 11:46:00 PM. Note: Bring ID','general',1,'2026-09-21 15:39:15','2026-09-22 04:27:04',NULL),('NOTIF-4ASL4VQAE','STDNT257727','NRS02000','New Excuse Slip Request','Clark Ken Marcelo submitted an Excuse Slip request for 2026-09-14 to 2026-09-14. Reason: nagtae','excuse_slip_request',1,'2026-09-21 17:36:16','2026-09-21 17:43:31',NULL),('NOTIF-7da3c445',NULL,'STDNT120504','Annual Physical Exam','You have been scheduled for a doctor visit (Annual Physical Exam) on 9/21/2026, 11:41:00 PM. Note: Bring ID','general',0,'2026-09-21 15:39:15',NULL,NULL),('NOTIF-81B172SJC','STDNT345411','NRS02000','New Excuse Slip Request','Yahweh Bernardo submitted an Excuse Slip request for 2026-09-14 to 2026-09-16. Reason: masakit tiyan','excuse_slip_request',1,'2026-09-21 17:03:36','2026-09-21 17:03:51',NULL),('NOTIF-87SYKBVAJ','NRS02000','STDNT345411','Excuse Slip Request Completed','Your Excuse Slip (ID: EXC-c405eed0) has been completed.','document_request_action',0,'2026-09-21 17:04:23',NULL,NULL),('NOTIF-9KR3J4TKE','STDNT257727','NRS02000','New Excuse Slip Request','Clark Ken Marcelo submitted an Excuse Slip request for 2026-09-14 to 2026-09-18. Reason: nagtae talaga ako','excuse_slip_request',1,'2026-09-21 17:51:58','2026-09-21 18:36:57',NULL),('NOTIF-BWKTF92Z9','STDNT257727','NRS02000','New Excuse Slip Request','Clark Ken Marcelo submitted an Excuse Slip request for 2026-09-14 to 2026-09-25. Reason: Sumakit tiyan','excuse_slip_request',1,'2026-09-21 13:17:51','2026-09-21 13:18:10',NULL),('NOTIF-c510f526',NULL,'STDNT345411','Annual Dental Check up','You have been scheduled for a doctor visit (Annual Dental Check up) on 9/21/2026, 11:43:00 PM. Note: bring id','general',1,'2026-09-21 15:32:30','2026-09-21 17:02:45',NULL),('NOTIF-CQOXSF3NC','NRS02000','PRNT001','Update on Yahweh Bernardo\'s Request','The Excuse Slip requested for Yahweh Bernardo was completed.','document_request_action',0,'2026-09-21 17:04:23',NULL,NULL),('NOTIF-EA03HGPH2','NRS02000','PRNT003','Clinic Visit: Clark Ken Marcelo','Clark Ken Marcelo visited the clinic for General Checkup.\nIntervention: None\nAdvice: None\nMedicine: None','clinic_visit',0,'2026-09-21 12:23:48',NULL,NULL),('NOTIF-f80ef5fe',NULL,'STDNT257727','Annual Dental Check up','You have been scheduled for a doctor visit (Annual Dental Check up) on 9/21/2026, 11:38:00 PM. Note: bring id','general',1,'2026-09-21 15:32:30','2026-09-21 15:32:54',NULL),('NOTIF-f81c6ba6',NULL,'STDNT001133','Annual Dental Check up','You have been scheduled for a doctor visit (Annual Dental Check up) on 9/21/2026, 11:33:00 PM. Note: bring id','general',0,'2026-09-21 15:32:30',NULL,NULL),('NOTIF-H6S1UI7SF','STDNT257727','NRS02000','New Excuse Slip Request','Clark Ken Marcelo submitted an Excuse Slip request for 2026-09-14 to 2026-09-19. Reason: nagtae\r\n','excuse_slip_request',1,'2026-09-21 17:45:55','2026-09-21 18:37:02',NULL),('NOTIF-HF5PO7P4R','NRS02000','STDNT257727','Clinic Visit Summary','Your visit for General Checkup has been logged. Advice: None','clinic_visit',1,'2026-09-21 12:23:49','2026-09-21 12:25:47',NULL),('NOTIF-MXFM6RP40','NRS02000','STDNT257727','Excuse Slip Request Completed','Your Excuse Slip (ID: EXC-cc84b470) has been completed.','document_request_action',1,'2026-09-21 17:47:10','2026-09-21 17:48:01',NULL),('NOTIF-O3DIYYMYS','NRS02000','PRNT003','Update on Clark Ken Marcelo\'s Request','The Excuse Slip requested for Clark Ken Marcelo was completed.','document_request_action',0,'2026-09-21 17:47:10',NULL,NULL),('NOTIF-O6TKQ4FE9','NRS02000','PRNT003','Clinic Visit: Clark Ken Marcelo','Clark Ken Marcelo visited the clinic for General Checkup.\nIntervention: None\nAdvice: None\nMedicine: None','clinic_visit',0,'2026-09-21 17:20:03',NULL,NULL),('NOTIF-QXDD061XC','NRS02000','PRNT003','Clinic Visit: Clark Ken Marcelo','Clark Ken Marcelo visited the clinic for General Checkup.\nIntervention: None\nAdvice: None\nMedicine: None','clinic_visit',0,'2026-09-21 12:23:49',NULL,NULL),('NOTIF-RHU2G33WK','STDNT257727','NRS02000','New Excuse Slip Request','Clark Ken Marcelo submitted an Excuse Slip request for 2026-09-14 to 2026-09-18. Reason: nagtae','excuse_slip_request',1,'2026-09-21 17:41:52','2026-09-21 17:43:29',NULL),('NOTIF-S3KXYTL4O','NRS02000','PRNT003','Update on Clark Ken Marcelo\'s Request','The Excuse Slip requested for Clark Ken Marcelo was completed.','document_request_action',0,'2026-09-21 13:24:35',NULL,NULL),('NOTIF-VTDX0ZAPS','STDNT257727','NRS02000','New Excuse Slip Request','Clark Ken Marcelo submitted an Excuse Slip request for 2026-09-14 to 2026-09-19. Reason: nagtae talaga','excuse_slip_request',1,'2026-09-21 17:47:54','2026-09-21 18:37:01',NULL),('NOTIF-WIZY2R86B','NRS02000','PRNT003','Update on Clark Ken Marcelo\'s Request','The Excuse Slip requested for Clark Ken Marcelo was completed.','document_request_action',0,'2026-09-21 17:48:28',NULL,NULL),('NOTIF-WNQ9U0BQI','NRS02000','STDNT257727','Clinic Visit Summary','Your visit for General Checkup has been logged. Advice: None','clinic_visit',1,'2026-09-21 12:23:48','2026-09-21 12:25:52',NULL),('NOTIF-X0XC9CU40','STDNT257727','NRS02000','New Excuse Slip Request','Clark Ken Marcelo submitted an Excuse Slip request for 2026-09-14 to 2026-09-18. Reason: nagtae talaga ako','excuse_slip_request',1,'2026-09-21 17:59:54','2026-09-21 18:36:53',NULL),('NOTIF-XJR1C70TS','NRS02000','STDNT257727','Clinic Visit Summary','Your visit for General Checkup has been logged. Advice: None','clinic_visit',1,'2026-09-21 17:20:03','2026-09-22 06:24:20',NULL),('NOTIF-YGXT522N3','NRS02000','STDNT257727','Excuse Slip Request Completed','Your Excuse Slip (ID: EXC-e51fdc4e) has been completed.','document_request_action',1,'2026-09-21 13:24:35','2026-09-21 13:24:50',NULL);
/*!40000 ALTER TABLE `notifications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `nurses`
--

DROP TABLE IF EXISTS `nurses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `nurses` (
  `nurse_id` varchar(45) NOT NULL,
  `user_id` varchar(45) NOT NULL,
  `first_name` varchar(100) NOT NULL,
  `last_name` varchar(100) NOT NULL,
  PRIMARY KEY (`nurse_id`),
  UNIQUE KEY `user_id` (`user_id`),
  CONSTRAINT `nurses_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `nurses`
--

LOCK TABLES `nurses` WRITE;
/*!40000 ALTER TABLE `nurses` DISABLE KEYS */;
INSERT INTO `nurses` VALUES ('NURSE02000','NRS02000','Mhaya','Balarao');
/*!40000 ALTER TABLE `nurses` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `parent_student_mapping`
--

DROP TABLE IF EXISTS `parent_student_mapping`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `parent_student_mapping` (
  `parent_id` varchar(45) NOT NULL,
  `student_id` varchar(45) NOT NULL,
  PRIMARY KEY (`parent_id`,`student_id`),
  KEY `FK_Student` (`student_id`),
  CONSTRAINT `FK_Parent` FOREIGN KEY (`parent_id`) REFERENCES `parents` (`parent_id`) ON DELETE CASCADE,
  CONSTRAINT `FK_Student` FOREIGN KEY (`student_id`) REFERENCES `students` (`student_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `parent_student_mapping`
--

LOCK TABLES `parent_student_mapping` WRITE;
/*!40000 ALTER TABLE `parent_student_mapping` DISABLE KEYS */;
INSERT INTO `parent_student_mapping` VALUES ('PARENT006','02000112233'),('PARENT001','02000120504'),('PARENT007','02000121416'),('PARENT003','02000257727'),('PARENT001','02000345411'),('PARENT011','02000349679'),('PARENT005','02000350927'),('PARENT004','02000371918'),('PARENT02000','02000565656'),('kkkk_parent','023456789'),('kkkk_parent','02567890');
/*!40000 ALTER TABLE `parent_student_mapping` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `parents`
--

DROP TABLE IF EXISTS `parents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `parents` (
  `parent_id` varchar(45) NOT NULL,
  `user_id` varchar(45) NOT NULL,
  `first_name` varchar(100) DEFAULT NULL,
  `last_name` varchar(100) DEFAULT NULL,
  `primary_phone` varchar(20) DEFAULT NULL,
  `is_sms_verified` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`parent_id`),
  UNIQUE KEY `user_id` (`user_id`),
  CONSTRAINT `parents_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `parents`
--

LOCK TABLES `parents` WRITE;
/*!40000 ALTER TABLE `parents` DISABLE KEYS */;
INSERT INTO `parents` VALUES ('kkkk_parent','13718843-97d3-4f37-8899-33b4a8cf9237','kkkkkkk','oooooo','09999999999',0),('PARENT001','PRNT001','Melicia','Bernardo','09196398316',1),('PARENT002','PRNT002','Eme','Siason','09615119118',1),('PARENT003','PRNT003','Jonalyn','Marcelo','09330680817',1),('PARENT004','PRNT004','Maribel','Sulit','09568281721',1),('PARENT005','PRNT005','Dariel','Siason','09267729272',1),('PARENT006','f4145eff-e8f5-4286-bfa4-90a2cbea05c3','','','',0),('PARENT007','6da53619-9d16-4920-8c2c-a813988a9c5c','Christine','Angeles','09191282739',0),('PARENT011','8bb1b248-0295-42b8-8d7b-0f7b83537c33','Cecille','Salvador','09196398319',0),('PARENT02000','8ea9175f-ce61-4c1b-aba0-1b1e2f5d8c74','Jonah','Magat','097382137872',0);
/*!40000 ALTER TABLE `parents` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `partner_facilities`
--

DROP TABLE IF EXISTS `partner_facilities`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `partner_facilities` (
  `facility_id` varchar(45) NOT NULL,
  `facility_name` varchar(255) NOT NULL,
  `address` text,
  `contact_number` varchar(45) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`facility_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `partner_facilities`
--

LOCK TABLES `partner_facilities` WRITE;
/*!40000 ALTER TABLE `partner_facilities` DISABLE KEYS */;
INSERT INTO `partner_facilities` VALUES ('FAC-915c0224','Premiere Laboratory','Baliuag, Bulacan',NULL,'2026-09-13 12:55:55'),('FAC-ed3a37fa','Marcelo Hospital','Baliuag, Bulacan',NULL,'2026-09-13 12:58:01');
/*!40000 ALTER TABLE `partner_facilities` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `program_requirements_config`
--

DROP TABLE IF EXISTS `program_requirements_config`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `program_requirements_config` (
  `config_id` varchar(45) NOT NULL,
  `program_id` varchar(45) NOT NULL,
  `requirement_name` varchar(150) NOT NULL,
  `year_level` int DEFAULT NULL,
  `submission_deadline` date NOT NULL,
  `allow_late_submission` tinyint NOT NULL DEFAULT '0',
  PRIMARY KEY (`config_id`),
  UNIQUE KEY `program_id` (`program_id`,`requirement_name`),
  KEY `requirement_name` (`requirement_name`),
  CONSTRAINT `program_requirements_config_ibfk_1` FOREIGN KEY (`program_id`) REFERENCES `academic_programs` (`program_id`),
  CONSTRAINT `program_requirements_config_ibfk_2` FOREIGN KEY (`requirement_name`) REFERENCES `medical_requirements` (`requirement_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `program_requirements_config`
--

LOCK TABLES `program_requirements_config` WRITE;
/*!40000 ALTER TABLE `program_requirements_config` DISABLE KEYS */;
INSERT INTO `program_requirements_config` VALUES ('CFG-1783221381985-836','BSIT','X Ray',1,'2026-07-24',0),('CFG-1783231831143-366','BSBA','Drug Test',4,'2026-07-22',0),('CFG-1786101074333-109','BSIT','Medical Certificate',4,'2026-08-10',0),('CFG-1788767853795-196','BSIT','Hepa A',3,'2026-09-30',1),('CFG-1789724136273-304','BSHM','Hepa B',NULL,'2026-11-27',1),('CFG-1789724207620-530','BSIT','Hepa B',NULL,'2026-11-18',1),('CFG-1789798042617-694','ABM','Drug Test',NULL,'2026-10-19',1),('CFG-1789800055684-472','BSBA','Hepa A',NULL,'2026-10-19',1);
/*!40000 ALTER TABLE `program_requirements_config` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `push_subscriptions`
--

DROP TABLE IF EXISTS `push_subscriptions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `push_subscriptions` (
  `subscription_id` varchar(45) NOT NULL,
  `user_id` varchar(45) NOT NULL,
  `endpoint` text NOT NULL,
  `p256dh` varchar(255) NOT NULL,
  `auth` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`subscription_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `push_subscriptions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `push_subscriptions`
--

LOCK TABLES `push_subscriptions` WRITE;
/*!40000 ALTER TABLE `push_subscriptions` DISABLE KEYS */;
INSERT INTO `push_subscriptions` VALUES ('0463d69e-b5eb-11f1-81cf-88241b1f4709','STDNT257727','https://fcm.googleapis.com/fcm/send/cBR-3MpYlFI:APA91bHAzhMhGpiDjAV2otkmMv08cN8X27X8t--DubnguLOTYNOdNAYQV8mXsXGZhT7Aq40d6kBk4UXTFrXgC14dr-aralg7E7xn0VFN9z4gNGBoY4t6GSasKQrb0wJuWraObyJc8vjT','BDdpIl8ohd04mbGwTQjnXI-30A885eR-Qdmf87mmaplKeo7NTVIP7BCiTmKEXyZwzT40SGqJVTCw04-Bon30Q2I','Cb50xKmWMItDgvkKAFCjlA','2026-09-21 18:34:02'),('29b08beb-b5ea-11f1-81cf-88241b1f4709','NRS02000','https://fcm.googleapis.com/fcm/send/cBR-3MpYlFI:APA91bHAzhMhGpiDjAV2otkmMv08cN8X27X8t--DubnguLOTYNOdNAYQV8mXsXGZhT7Aq40d6kBk4UXTFrXgC14dr-aralg7E7xn0VFN9z4gNGBoY4t6GSasKQrb0wJuWraObyJc8vjT','BDdpIl8ohd04mbGwTQjnXI-30A885eR-Qdmf87mmaplKeo7NTVIP7BCiTmKEXyZwzT40SGqJVTCw04-Bon30Q2I','Cb50xKmWMItDgvkKAFCjlA','2026-09-21 18:27:55');
/*!40000 ALTER TABLE `push_subscriptions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `referral_request_services`
--

DROP TABLE IF EXISTS `referral_request_services`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `referral_request_services` (
  `request_id` varchar(45) NOT NULL,
  `service_id` varchar(45) NOT NULL,
  PRIMARY KEY (`request_id`,`service_id`),
  KEY `service_id` (`service_id`),
  CONSTRAINT `referral_request_services_ibfk_1` FOREIGN KEY (`request_id`) REFERENCES `referral_slip_requests` (`request_id`) ON DELETE CASCADE,
  CONSTRAINT `referral_request_services_ibfk_2` FOREIGN KEY (`service_id`) REFERENCES `facility_services` (`service_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `referral_request_services`
--

LOCK TABLES `referral_request_services` WRITE;
/*!40000 ALTER TABLE `referral_request_services` DISABLE KEYS */;
INSERT INTO `referral_request_services` VALUES ('REF-1f577a3d','SRV-031183e9'),('REF-f5a86d77','SRV-031183e9'),('REF-1a95ec08','SRV-0ed79e0e'),('REF-f5a86d77','SRV-4428c2a3');
/*!40000 ALTER TABLE `referral_request_services` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `referral_slip_notes`
--

DROP TABLE IF EXISTS `referral_slip_notes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `referral_slip_notes` (
  `note_id` varchar(45) NOT NULL,
  `request_id` varchar(45) NOT NULL,
  `sender_type` varchar(10) NOT NULL,
  `sender_id` varchar(45) NOT NULL,
  `message` text NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`note_id`),
  KEY `request_id` (`request_id`),
  CONSTRAINT `referral_slip_notes_ibfk_1` FOREIGN KEY (`request_id`) REFERENCES `referral_slip_requests` (`request_id`) ON DELETE CASCADE,
  CONSTRAINT `referral_slip_notes_chk_1` CHECK ((`sender_type` in (_utf8mb4'Nurse',_utf8mb4'Student')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `referral_slip_notes`
--

LOCK TABLES `referral_slip_notes` WRITE;
/*!40000 ALTER TABLE `referral_slip_notes` DISABLE KEYS */;
/*!40000 ALTER TABLE `referral_slip_notes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `referral_slip_requests`
--

DROP TABLE IF EXISTS `referral_slip_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `referral_slip_requests` (
  `request_id` varchar(45) NOT NULL,
  `student_id` varchar(45) NOT NULL,
  `facility_id` varchar(45) NOT NULL,
  `reason_for_referral` text NOT NULL,
  `status` varchar(20) DEFAULT 'Pending',
  `issued_by` varchar(45) DEFAULT NULL,
  `issued_at` timestamp NULL DEFAULT NULL,
  `issued_slip_url` varchar(512) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`request_id`),
  KEY `student_id` (`student_id`),
  KEY `facility_id` (`facility_id`),
  KEY `issued_by` (`issued_by`),
  CONSTRAINT `referral_slip_requests_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `students` (`student_id`),
  CONSTRAINT `referral_slip_requests_ibfk_2` FOREIGN KEY (`issued_by`) REFERENCES `nurses` (`nurse_id`),
  CONSTRAINT `referral_slip_requests_ibfk_3` FOREIGN KEY (`facility_id`) REFERENCES `partner_facilities` (`facility_id`),
  CONSTRAINT `referral_slip_requests_chk_1` CHECK ((`status` in (_utf8mb4'Pending',_utf8mb4'Approved',_utf8mb4'Completed',_utf8mb4'Denied',_utf8mb4'Rejected')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `referral_slip_requests`
--

LOCK TABLES `referral_slip_requests` WRITE;
/*!40000 ALTER TABLE `referral_slip_requests` DISABLE KEYS */;
INSERT INTO `referral_slip_requests` VALUES ('REF-1a95ec08','02000257727','FAC-ed3a37fa','asthma attack','Completed','NURSE02000','2026-09-18 09:30:17','/uploads/REF-1a95ec08-1789723817212-233617702.pdf','2026-09-18 09:27:37'),('REF-1f577a3d','02000257727','FAC-915c0224','for requirements','Completed','NURSE02000','2026-09-22 06:05:21','/uploads/REF-1f577a3d-1790057121811-433641401.pdf','2026-09-22 05:11:59'),('REF-f5a86d77','02000349679','FAC-915c0224','Requirements','Completed','NURSE02000','2026-09-13 15:26:01','/uploads/REF-f5a86d77-1789313161912-628647711.pdf','2026-09-13 15:25:10');
/*!40000 ALTER TABLE `referral_slip_requests` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `roles`
--

DROP TABLE IF EXISTS `roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `roles` (
  `role_id` varchar(45) NOT NULL,
  `role_name` varchar(50) NOT NULL,
  PRIMARY KEY (`role_id`),
  UNIQUE KEY `role_name` (`role_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `roles`
--

LOCK TABLES `roles` WRITE;
/*!40000 ALTER TABLE `roles` DISABLE KEYS */;
INSERT INTO `roles` VALUES ('ADMN','Admin'),('NRS','Nurse'),('PRNT','Parent'),('STDNT','Student');
/*!40000 ALTER TABLE `roles` ENABLE KEYS */;
UNLOCK TABLES;

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
  PRIMARY KEY (`participant_id`),
  KEY `screening_schedule_id` (`screening_schedule_id`),
  KEY `student_id` (`student_id`),
  CONSTRAINT `screening_schedule_participants_ibfk_1` FOREIGN KEY (`screening_schedule_id`) REFERENCES `screening_schedules` (`screening_schedule_id`) ON DELETE CASCADE,
  CONSTRAINT `screening_schedule_participants_ibfk_2` FOREIGN KEY (`student_id`) REFERENCES `students` (`student_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `screening_schedule_participants`
--

LOCK TABLES `screening_schedule_participants` WRITE;
/*!40000 ALTER TABLE `screening_schedule_participants` DISABLE KEYS */;
INSERT INTO `screening_schedule_participants` VALUES ('0186244a-27f4-4a53-b95b-52c4fa60ded3','ed619b42-a454-479e-89c7-6f186facec32','02000345411','PENDING',NULL,'2026-09-18 03:56:40'),('0214ec9f-2fbe-4996-abff-ecfe2c623699','ed619b42-a454-479e-89c7-6f186facec32','123456789','PENDING',NULL,'2026-09-18 03:56:40'),('07b06538-54ac-4081-8eba-975908c14f38','5d5600d9-df98-470a-a3cd-5b0d7171e40b','02000120504','PENDING',NULL,'2026-09-22 02:22:27'),('0849c064-457b-4666-8a44-5658b7be15aa','ed619b42-a454-479e-89c7-6f186facec32','02000565656','PENDING',NULL,'2026-09-18 03:56:40'),('0a880732-0a17-4744-a0de-a47dfbf46440','6916bc69-9507-4c3f-9519-4b2123f5ebac','02000371918','PENDING',NULL,'2026-09-18 03:48:06'),('0cbf2846-5ba1-4aac-9b2a-87282f4d54fd','1dc0e18a-9561-412e-a393-1a1fd0ae71b6','02000257727','PENDING',NULL,'2026-09-15 05:00:53'),('0ce9e61e-3a95-4266-b068-a0d485e71c7f','1dc0e18a-9561-412e-a393-1a1fd0ae71b6','02000332211','PENDING',NULL,'2026-09-15 05:00:53'),('0ec8244f-63aa-44fe-82ee-3101413961f2','90302a92-1db5-4add-80d2-eb48105da1eb','02000120504','PENDING',NULL,'2026-09-15 10:23:12'),('112460bc-a0bc-4d8a-9395-02af32813dfc','079ce752-de63-4f50-ac5e-6364fbc5d770','02000120504','ABSENT',NULL,'2026-09-18 03:36:56'),('147f1254-ecb8-4e87-80f2-4e014678f40b','2ecfdccd-90a5-4c85-8682-97170bce6987','02000350927','PENDING',NULL,'2026-09-25 07:23:15'),('153afcf9-ec2b-4dd8-9b30-28bbb184b0bc','90302a92-1db5-4add-80d2-eb48105da1eb','02000345411','PRESENT','2026-09-15 10:23:36','2026-09-15 10:23:12'),('1952279d-2991-40ad-8db9-a552b2548f62','5a4c4572-e09a-4b08-a922-9834f94f04d7','02000350927','PENDING',NULL,'2026-09-21 16:28:56'),('196ce305-f2ad-48ce-934b-b520cd266909','079ce752-de63-4f50-ac5e-6364fbc5d770','02000121416','ABSENT',NULL,'2026-09-18 03:36:56'),('1a0f7525-67c3-4b2c-8453-2070ec334175','2ae4d218-3272-420e-ac66-9e32e8614467','02000350927','PENDING',NULL,'2026-09-19 06:49:27'),('1c01e811-ed01-4091-a3f1-806ce580baeb','079ce752-de63-4f50-ac5e-6364fbc5d770','02000371918','ABSENT',NULL,'2026-09-18 03:36:56'),('1c8bac4e-4816-4888-8f50-a376b39251aa','2ecfdccd-90a5-4c85-8682-97170bce6987','02000001133','PENDING',NULL,'2026-09-25 07:23:15'),('1ea65644-56e9-4215-9d35-3779660a495c','079ce752-de63-4f50-ac5e-6364fbc5d770','02000112233','ABSENT',NULL,'2026-09-18 03:36:56'),('1ec07081-2ddc-43be-b55b-d40f7ca32bbb','5d5600d9-df98-470a-a3cd-5b0d7171e40b','02000565656','PENDING',NULL,'2026-09-22 02:22:27'),('1f1c96b2-311a-49e3-a3ad-5fe4a08c28d8','394dd798-dc50-457c-832c-8674ccfedb28','02000332211','PENDING',NULL,'2026-09-18 18:23:32'),('23a7f7f1-5dc1-4edf-a5cb-96645059c588','394dd798-dc50-457c-832c-8674ccfedb28','02000001133','PENDING',NULL,'2026-09-18 18:23:32'),('262e3d50-2d08-4a0d-b17b-2aa2ac4bc312','1dc0e18a-9561-412e-a393-1a1fd0ae71b6','02000350927','PENDING',NULL,'2026-09-15 05:00:53'),('265c0dc6-e1b0-49ab-bf15-0f50a2fad025','ed619b42-a454-479e-89c7-6f186facec32','02000257727','PENDING',NULL,'2026-09-18 03:56:40'),('2d609ca5-1428-4a2f-b609-7f7f7cd11809','079ce752-de63-4f50-ac5e-6364fbc5d770','02000345411','ABSENT',NULL,'2026-09-18 03:36:56'),('2e756962-6e98-42f1-a63f-49d5af6ea552','394dd798-dc50-457c-832c-8674ccfedb28','02000257727','PENDING',NULL,'2026-09-18 18:23:32'),('2fd39018-0fac-4d31-88fe-9da055a1d15a','079ce752-de63-4f50-ac5e-6364fbc5d770','02000350927','ABSENT',NULL,'2026-09-18 03:36:56'),('31d29662-0458-4634-816b-0b8228920f7f','5d5600d9-df98-470a-a3cd-5b0d7171e40b','02000345411','PENDING',NULL,'2026-09-22 02:22:27'),('37325e99-0786-4119-a400-0921d24e58b3','394dd798-dc50-457c-832c-8674ccfedb28','02000349679','PENDING',NULL,'2026-09-18 18:23:32'),('38045a6c-c942-482a-a9b0-212ccd35ee87','5d5600d9-df98-470a-a3cd-5b0d7171e40b','02000350927','PENDING',NULL,'2026-09-22 02:22:27'),('396b8726-31ec-4253-aca0-c12e5a766088','2ecfdccd-90a5-4c85-8682-97170bce6987','123456789','PENDING',NULL,'2026-09-25 07:23:15'),('3faefadd-3c93-47c7-921d-eca1c566d9d5','2ae4d218-3272-420e-ac66-9e32e8614467','02000121416','PENDING',NULL,'2026-09-19 06:49:27'),('44ab2b5b-5472-45dd-894a-b7b18b234592','ed619b42-a454-479e-89c7-6f186facec32','02000332211','PENDING',NULL,'2026-09-18 03:56:40'),('4b9e841a-d6fa-4bbd-bd48-1b74fd926e1e','90302a92-1db5-4add-80d2-eb48105da1eb','02000349679','PENDING',NULL,'2026-09-15 10:23:12'),('4ca84243-8ca7-4731-ae15-843140ca8d19','079ce752-de63-4f50-ac5e-6364fbc5d770','123456789','ABSENT',NULL,'2026-09-18 03:36:56'),('4ff87f97-55bc-46b8-a53c-83daa390ea47','394dd798-dc50-457c-832c-8674ccfedb28','02000371918','PENDING',NULL,'2026-09-18 18:23:32'),('517bac32-e1f8-49cc-8f15-4568060b2ee7','6916bc69-9507-4c3f-9519-4b2123f5ebac','02000257727','PENDING',NULL,'2026-09-18 03:48:06'),('51d847db-c455-4117-a404-9e31d164cba3','5a4c4572-e09a-4b08-a922-9834f94f04d7','02000349679','PENDING',NULL,'2026-09-21 16:28:56'),('5a438149-4d80-44ac-9fed-d8bc28ba47f3','6916bc69-9507-4c3f-9519-4b2123f5ebac','02000565656','PENDING',NULL,'2026-09-18 03:48:06'),('5ae99852-5ce3-4a72-9ca2-a6588ccc75ce','7261367e-1d4b-45da-a392-63dae2539dd0','02000257727','PRESENT','2026-09-18 09:50:15','2026-09-18 09:49:28'),('5b192a3a-23fe-411a-9531-6af910b89699','ed619b42-a454-479e-89c7-6f186facec32','02000112233','PENDING',NULL,'2026-09-18 03:56:40'),('5f954416-237d-48b3-bdf3-8a89571581c7','2ecfdccd-90a5-4c85-8682-97170bce6987','023456789','PENDING',NULL,'2026-09-25 07:23:15'),('613fdcf1-fbf9-45cb-a519-7e48b995b7a5','394dd798-dc50-457c-832c-8674ccfedb28','02000565656','PENDING',NULL,'2026-09-18 18:23:32'),('6214a28d-2845-42fe-8350-a01a4c26288e','2ae4d218-3272-420e-ac66-9e32e8614467','02000345411','PENDING',NULL,'2026-09-19 06:49:27'),('63edd8b7-6e71-43ba-a60d-abd5408032e3','6916bc69-9507-4c3f-9519-4b2123f5ebac','02000120504','PENDING',NULL,'2026-09-18 03:48:06'),('685cd86b-7191-4aa9-8195-b0e2d4e2dda4','2ecfdccd-90a5-4c85-8682-97170bce6987','02000371918','PENDING',NULL,'2026-09-25 07:23:15'),('69c10fa0-1a42-4987-bef4-7ea570b2eb27','5a4c4572-e09a-4b08-a922-9834f94f04d7','02000112233','PENDING',NULL,'2026-09-21 16:28:56'),('6b0c7463-b931-41f5-a9c0-292f5b44f1e2','90302a92-1db5-4add-80d2-eb48105da1eb','02000371918','PENDING',NULL,'2026-09-15 10:23:12'),('6bdbb53f-76ab-416f-8257-65158910ba52','2ae4d218-3272-420e-ac66-9e32e8614467','02000349679','PENDING',NULL,'2026-09-19 06:49:27'),('70127de8-b46b-4bc3-8883-5d3fb3926a70','1dc0e18a-9561-412e-a393-1a1fd0ae71b6','02000121416','PENDING',NULL,'2026-09-15 05:00:53'),('74ec41a0-6c40-4c05-82e5-9005cc73df4d','6916bc69-9507-4c3f-9519-4b2123f5ebac','02000332211','PENDING',NULL,'2026-09-18 03:48:06'),('7511ecf8-a1d6-4222-b388-d1d2991c4441','2ae4d218-3272-420e-ac66-9e32e8614467','02000565656','PENDING',NULL,'2026-09-19 06:49:27'),('757536fb-c2ec-4dc0-9269-b482753408a6','2ecfdccd-90a5-4c85-8682-97170bce6987','02567890','PENDING',NULL,'2026-09-25 07:23:15'),('77dd3fee-8488-4452-9aed-66c309e88924','5a4c4572-e09a-4b08-a922-9834f94f04d7','02000257727','PENDING',NULL,'2026-09-21 16:28:56'),('7836968d-4072-4ef9-8463-6037c6d0fd46','5a4c4572-e09a-4b08-a922-9834f94f04d7','02000565656','PENDING',NULL,'2026-09-21 16:28:56'),('78694d31-b1c3-4f8d-ae9b-9ab7ff696bd7','2ecfdccd-90a5-4c85-8682-97170bce6987','02000332211','PENDING',NULL,'2026-09-25 07:23:15'),('7999e667-bc03-47ea-8de8-6aa3f1c70af4','2ae4d218-3272-420e-ac66-9e32e8614467','123456789','PENDING',NULL,'2026-09-19 06:49:27'),('7d9e4d8e-e16f-46b9-9cc1-573d71210377','ed619b42-a454-479e-89c7-6f186facec32','02000371918','PENDING',NULL,'2026-09-18 03:56:40'),('826207cc-1ff8-46aa-bff0-85e4660069fa','2ecfdccd-90a5-4c85-8682-97170bce6987','02000349679','PENDING',NULL,'2026-09-25 07:23:15'),('831c1aef-539f-4cfb-8bea-9276d3b6f432','5d5600d9-df98-470a-a3cd-5b0d7171e40b','02000112233','PENDING',NULL,'2026-09-22 02:22:27'),('832d3fd2-ecb0-49d4-888a-917ad13d2843','ed619b42-a454-479e-89c7-6f186facec32','02000349679','PENDING',NULL,'2026-09-18 03:56:40'),('85171001-4260-4f20-ac0c-f8c8d905315c','90302a92-1db5-4add-80d2-eb48105da1eb','02000121416','PENDING',NULL,'2026-09-15 10:23:12'),('8529bd7f-7ace-49ab-ad04-4201499624d4','ed619b42-a454-479e-89c7-6f186facec32','02000120504','PENDING',NULL,'2026-09-18 03:56:40'),('8c80a3f5-1abc-44c8-94cb-4a27f0e1e2d8','6916bc69-9507-4c3f-9519-4b2123f5ebac','02000121416','PENDING',NULL,'2026-09-18 03:48:06'),('8df25d03-dc6e-4566-a4d4-5a79887387f0','90302a92-1db5-4add-80d2-eb48105da1eb','02000565656','PENDING',NULL,'2026-09-15 10:23:12'),('91498ec2-adb8-471a-884a-31b7458636d8','2ae4d218-3272-420e-ac66-9e32e8614467','02000371918','PENDING',NULL,'2026-09-19 06:49:27'),('94f6d9f4-adea-4c5b-b087-5efbc841028d','2ecfdccd-90a5-4c85-8682-97170bce6987','02000345411','PENDING',NULL,'2026-09-25 07:23:15'),('95d7757e-7ee9-4d4b-a438-8cde4ad814f1','ed619b42-a454-479e-89c7-6f186facec32','02000001133','PENDING',NULL,'2026-09-18 03:56:40'),('9645e35e-a9dd-412f-9a2c-af3974c1a2e4','90302a92-1db5-4add-80d2-eb48105da1eb','02000350927','PENDING',NULL,'2026-09-15 10:23:12'),('98e4ee9e-cebc-4676-93f4-0ae66e768248','6916bc69-9507-4c3f-9519-4b2123f5ebac','02000350927','PENDING',NULL,'2026-09-18 03:48:06'),('9c031034-b5d5-48a5-b65a-60dfca8e2769','6916bc69-9507-4c3f-9519-4b2123f5ebac','02000112233','PENDING',NULL,'2026-09-18 03:48:06'),('9dfa3d66-4ac7-4530-a807-9888ce77f8ef','2ecfdccd-90a5-4c85-8682-97170bce6987','02000565656','PENDING',NULL,'2026-09-25 07:23:15'),('9f8d5eea-e28f-497e-92ff-76c2ec851616','2ae4d218-3272-420e-ac66-9e32e8614467','02000332211','PENDING',NULL,'2026-09-19 06:49:27'),('a272ddb2-e5b8-4e61-b537-9777e42d7af3','90302a92-1db5-4add-80d2-eb48105da1eb','02000332211','PENDING',NULL,'2026-09-15 10:23:12'),('a360713c-c8f8-4105-9188-f77448b55f66','079ce752-de63-4f50-ac5e-6364fbc5d770','02000349679','ABSENT',NULL,'2026-09-18 03:36:56'),('a5f1678d-b852-4817-a370-310710a0edec','ed619b42-a454-479e-89c7-6f186facec32','02000121416','PENDING',NULL,'2026-09-18 03:56:40'),('a6985e86-b3ad-4e36-883e-2c9fff6d6a80','5a4c4572-e09a-4b08-a922-9834f94f04d7','02000332211','PENDING',NULL,'2026-09-21 16:28:56'),('aa021026-b061-440b-9f54-2595449143b7','079ce752-de63-4f50-ac5e-6364fbc5d770','02000001133','ABSENT',NULL,'2026-09-18 03:36:56'),('af5c4777-c09e-43bb-b264-98e0d08aeea6','1dc0e18a-9561-412e-a393-1a1fd0ae71b6','02000120504','PENDING',NULL,'2026-09-15 05:00:53'),('b021b875-c62b-4d95-9863-f8cc95b319e9','6916bc69-9507-4c3f-9519-4b2123f5ebac','123456789','PENDING',NULL,'2026-09-18 03:48:06'),('b1e7899d-bbfa-4ccf-9afb-67a6e975530e','5d5600d9-df98-470a-a3cd-5b0d7171e40b','123456789','PENDING',NULL,'2026-09-22 02:22:27'),('b1fc66f4-efa3-4085-820f-9fc4bb97c4aa','5d5600d9-df98-470a-a3cd-5b0d7171e40b','02000121416','PENDING',NULL,'2026-09-22 02:22:27'),('b5c97935-0e14-4a97-bae3-944a17bd944c','079ce752-de63-4f50-ac5e-6364fbc5d770','02000565656','ABSENT',NULL,'2026-09-18 03:36:56'),('b6a41695-ff28-47cf-94a5-e570fdc747d4','5d5600d9-df98-470a-a3cd-5b0d7171e40b','02000257727','PENDING',NULL,'2026-09-22 02:22:27'),('bb884353-0403-4187-b7a4-2ae122b8acfe','079ce752-de63-4f50-ac5e-6364fbc5d770','02000257727','ABSENT',NULL,'2026-09-18 03:36:56'),('c0910a0c-96e9-41e6-bbd3-7c3dcf3ce1ee','1dc0e18a-9561-412e-a393-1a1fd0ae71b6','02000371918','PENDING',NULL,'2026-09-15 05:00:53'),('c145e132-2304-43eb-9ed3-621e55b1d274','5a4c4572-e09a-4b08-a922-9834f94f04d7','02000371918','PENDING',NULL,'2026-09-21 16:28:56'),('c41f8677-d9ac-48cf-951c-e79111344b03','5d5600d9-df98-470a-a3cd-5b0d7171e40b','02000332211','PENDING',NULL,'2026-09-22 02:22:27'),('c5173351-87b7-4be9-a124-8b0b4f21462e','90302a92-1db5-4add-80d2-eb48105da1eb','123456789','PENDING',NULL,'2026-09-15 10:23:12'),('c755c8c6-404d-46e7-abd4-3c30d18eb692','2ae4d218-3272-420e-ac66-9e32e8614467','02000112233','PENDING',NULL,'2026-09-19 06:49:27'),('c7c6733e-86a6-469e-b549-2a05ff9075e3','6916bc69-9507-4c3f-9519-4b2123f5ebac','02000345411','PENDING',NULL,'2026-09-18 03:48:06'),('c8239e49-f7a4-4327-b0d1-edccc691940a','2ecfdccd-90a5-4c85-8682-97170bce6987','02000121416','PENDING',NULL,'2026-09-25 07:23:15'),('c8cd031a-a7be-4778-bd95-f6923f6106b2','5a4c4572-e09a-4b08-a922-9834f94f04d7','02000345411','PENDING',NULL,'2026-09-21 16:28:56'),('cb595f50-3b87-44f7-beba-ffd0123ab3e7','6916bc69-9507-4c3f-9519-4b2123f5ebac','02000349679','PENDING',NULL,'2026-09-18 03:48:06'),('cc3b46d4-4550-4a68-b1fb-7df1889a1562','2ae4d218-3272-420e-ac66-9e32e8614467','02000001133','PENDING',NULL,'2026-09-19 06:49:27'),('cc8212a5-786b-4e0e-b5d7-59f6aa341f08','90302a92-1db5-4add-80d2-eb48105da1eb','02000257727','PENDING',NULL,'2026-09-15 10:23:12'),('ccb83e4f-8574-4585-ae92-489f276089d3','2ecfdccd-90a5-4c85-8682-97170bce6987','02000257727','PRESENT','2026-09-25 07:24:21','2026-09-25 07:23:15'),('cd498c68-680c-4a1f-8193-224f4b26c7d9','1dc0e18a-9561-412e-a393-1a1fd0ae71b6','02000345411','PRESENT','2026-09-15 05:08:55','2026-09-15 05:00:53'),('ce429e10-0f69-4304-957e-8fc66ff2deb9','90302a92-1db5-4add-80d2-eb48105da1eb','02000112233','PENDING',NULL,'2026-09-15 10:23:12'),('ce5ce2ce-7cb6-493e-b7a3-ca6fc8b92066','5d5600d9-df98-470a-a3cd-5b0d7171e40b','02000001133','PENDING',NULL,'2026-09-22 02:22:27'),('d09a0301-f947-431d-8a2d-000d4ccc1378','5a4c4572-e09a-4b08-a922-9834f94f04d7','123456789','PENDING',NULL,'2026-09-21 16:28:56'),('d1f2d6c8-87d2-498e-85ca-87323bded712','2ae4d218-3272-420e-ac66-9e32e8614467','02000120504','PENDING',NULL,'2026-09-19 06:49:27'),('d32023d1-b610-4451-b71e-d7f31353d792','394dd798-dc50-457c-832c-8674ccfedb28','02000350927','PENDING',NULL,'2026-09-18 18:23:32'),('d57466f8-439e-4f37-bdbf-60f5666258ec','394dd798-dc50-457c-832c-8674ccfedb28','02000120504','PENDING',NULL,'2026-09-18 18:23:32'),('d62dfd40-b105-410d-8659-7534b29f1fd4','90302a92-1db5-4add-80d2-eb48105da1eb','02000001133','PENDING',NULL,'2026-09-15 10:23:12'),('dd052d51-9911-43a0-acf7-6844937abf9e','1dc0e18a-9561-412e-a393-1a1fd0ae71b6','02000001133','PENDING',NULL,'2026-09-15 05:00:53'),('ddda1e24-7eff-4aa3-a2c4-31c60fec18b1','394dd798-dc50-457c-832c-8674ccfedb28','02000345411','PENDING',NULL,'2026-09-18 18:23:32'),('df2142b7-f277-4612-855d-ab6b018215c2','2ecfdccd-90a5-4c85-8682-97170bce6987','02000112233','PENDING',NULL,'2026-09-25 07:23:15'),('dfe4ef96-b617-4ea4-b245-2308142b29fe','394dd798-dc50-457c-832c-8674ccfedb28','02000121416','PENDING',NULL,'2026-09-18 18:23:32'),('e1954495-a236-4201-a764-15bf7d4d9f91','5a4c4572-e09a-4b08-a922-9834f94f04d7','02000120504','PENDING',NULL,'2026-09-21 16:28:56'),('e24ae49d-efb1-4ed0-b08b-4d6be0d7dde1','394dd798-dc50-457c-832c-8674ccfedb28','123456789','PENDING',NULL,'2026-09-18 18:23:32'),('e5d90ce5-27c4-47a7-aa71-74d93f5fcc36','6916bc69-9507-4c3f-9519-4b2123f5ebac','02000001133','PENDING',NULL,'2026-09-18 03:48:06'),('e63dd3ce-ed95-4016-9676-6f4346809fd1','1dc0e18a-9561-412e-a393-1a1fd0ae71b6','02000349679','PENDING',NULL,'2026-09-15 05:00:53'),('e7e69439-4eab-4514-9388-09e117d0bdc9','2ecfdccd-90a5-4c85-8682-97170bce6987','02000120504','PENDING',NULL,'2026-09-25 07:23:15'),('e8db3eff-5f80-46b8-bb15-5002f334d585','ed619b42-a454-479e-89c7-6f186facec32','02000350927','PENDING',NULL,'2026-09-18 03:56:40'),('e9e1176b-7fe4-4e20-81af-a58c08ad6f3d','394dd798-dc50-457c-832c-8674ccfedb28','02000112233','PENDING',NULL,'2026-09-18 18:23:32'),('ed4a7dfb-1c85-43c3-83f8-cc672582cb2b','079ce752-de63-4f50-ac5e-6364fbc5d770','02000332211','ABSENT',NULL,'2026-09-18 03:36:56'),('ee39bc43-4097-4754-80a8-46c3bded1883','1dc0e18a-9561-412e-a393-1a1fd0ae71b6','02000112233','PENDING',NULL,'2026-09-15 05:00:53'),('f0d44d1b-adb6-4266-9dcb-d7b853e86cf9','5d5600d9-df98-470a-a3cd-5b0d7171e40b','02000371918','PENDING',NULL,'2026-09-22 02:22:27'),('f2707c3c-69d3-4cdf-8b25-542520b871b9','1dc0e18a-9561-412e-a393-1a1fd0ae71b6','02000565656','PENDING',NULL,'2026-09-15 05:00:53'),('f36323b3-2406-4e91-b8af-667c06203d78','5a4c4572-e09a-4b08-a922-9834f94f04d7','02000001133','PENDING',NULL,'2026-09-21 16:28:56'),('f4035572-fd8c-4e8e-b459-f6da2fa31225','2ae4d218-3272-420e-ac66-9e32e8614467','02000257727','PRESENT','2026-09-19 06:50:02','2026-09-19 06:49:27'),('f84a553d-ef50-4163-8e75-30f44fa8dd35','1dc0e18a-9561-412e-a393-1a1fd0ae71b6','123456789','PENDING',NULL,'2026-09-15 05:00:53'),('ff4fc1d3-df6e-4930-b29c-ea947c95768d','5d5600d9-df98-470a-a3cd-5b0d7171e40b','02000349679','PENDING',NULL,'2026-09-22 02:22:27'),('ff96168e-f5da-46ca-a987-f7c9ea705464','5a4c4572-e09a-4b08-a922-9834f94f04d7','02000121416','PENDING',NULL,'2026-09-21 16:28:56');
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
  `screening_type` varchar(30) DEFAULT 'BMI',
  PRIMARY KEY (`screening_schedule_id`),
  KEY `target_program_id` (`target_program_id`),
  CONSTRAINT `screening_schedules_ibfk_1` FOREIGN KEY (`target_program_id`) REFERENCES `academic_programs` (`program_id`),
  CONSTRAINT `chk_time_order` CHECK ((`end_time` > `start_time`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `screening_schedules`
--

LOCK TABLES `screening_schedules` WRITE;
/*!40000 ALTER TABLE `screening_schedules` DISABLE KEYS */;
INSERT INTO `screening_schedules` VALUES ('079ce752-de63-4f50-ac5e-6364fbc5d770','Annual Dental Cleaning',NULL,NULL,NULL,'2026-09-18','00:36:00','01:36:00',NULL,'BMI'),('1dc0e18a-9561-412e-a393-1a1fd0ae71b6','Annual Dental Screening',NULL,NULL,NULL,'2026-09-15','13:01:00','13:05:00',NULL,'Dental'),('2ae4d218-3272-420e-ac66-9e32e8614467','Annual BMI ',NULL,NULL,NULL,'2026-09-19','14:49:00','15:49:00',NULL,'BMI'),('2ecfdccd-90a5-4c85-8682-97170bce6987','Annual',NULL,NULL,NULL,'2026-09-25','15:21:00','17:21:00',NULL,'BMI'),('394dd798-dc50-457c-832c-8674ccfedb28','annual check bmi part 3',NULL,NULL,NULL,'2026-09-19','02:25:00','03:25:00',NULL,'BMI'),('5a4c4572-e09a-4b08-a922-9834f94f04d7','Annual BMI Monitoring',NULL,NULL,NULL,'2026-09-22','00:31:00','02:30:00',NULL,'BMI'),('5d5600d9-df98-470a-a3cd-5b0d7171e40b','Annual BMI',NULL,NULL,NULL,'2026-09-22','10:22:00','12:24:00',NULL,'BMI'),('6916bc69-9507-4c3f-9519-4b2123f5ebac','Annual BMI part 2',NULL,NULL,NULL,'2026-09-18','00:48:00','01:48:00',NULL,'BMI'),('7261367e-1d4b-45da-a392-63dae2539dd0','Annual Checkup',NULL,NULL,NULL,'2026-09-18','17:48:00','21:48:00',NULL,'BMI'),('87d7f704-2ffb-463d-aea6-568ed8142c5f','Annual BMI',NULL,NULL,NULL,'2026-08-03','08:00:00','12:00:00',NULL,'BMI'),('90302a92-1db5-4add-80d2-eb48105da1eb','Annual Vision Check up',NULL,NULL,NULL,'2026-09-15','18:22:00','18:50:00',NULL,'Vision'),('ed619b42-a454-479e-89c7-6f186facec32','Test',NULL,NULL,NULL,'2026-09-18','12:00:00','13:00:00',NULL,'BMI'),('eee8cc28-c236-4935-8ddb-a1af96876f52','Annual BMI',NULL,NULL,NULL,'2026-08-07','10:00:00','18:00:00',NULL,'BMI'),('f07eed8d-ec2f-4bff-a55c-d2c18224c54c','Annual BMI','BSIT',4,'B','2026-08-30','15:42:00','17:05:00',NULL,'BMI');
/*!40000 ALTER TABLE `screening_schedules` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `student_deadline_overrides`
--

DROP TABLE IF EXISTS `student_deadline_overrides`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `student_deadline_overrides` (
  `override_id` varchar(45) NOT NULL,
  `student_id` varchar(45) NOT NULL,
  `config_id` varchar(45) NOT NULL,
  `override_deadline` date DEFAULT NULL,
  `override_allow_late_submission` tinyint DEFAULT NULL,
  PRIMARY KEY (`override_id`),
  KEY `config_id` (`config_id`),
  CONSTRAINT `student_deadline_overrides_ibfk_1` FOREIGN KEY (`config_id`) REFERENCES `program_requirements_config` (`config_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `student_deadline_overrides`
--

LOCK TABLES `student_deadline_overrides` WRITE;
/*!40000 ALTER TABLE `student_deadline_overrides` DISABLE KEYS */;
INSERT INTO `student_deadline_overrides` VALUES ('065c1947-7838-11f1-8d81-60ff9e91bd8f','02000120504','CFG-1783221381985-836','2026-07-21',0),('0c27c0b8-af93-11f1-a50c-9848a14ea245','02000349679','CFG-1783221381985-836','2026-07-24',1),('17911a64-a37d-11f1-aa13-7234afcf04a2','02000565656','CFG-1783221381985-836','2026-08-29',1),('215e89ed-9251-11f1-b34f-b898cf46efdd','02000257727','CFG-1786101074333-109','2026-08-10',0),('32e1c3b2-b5e1-11f1-81cf-88241b1f4709','02000345411','CFG-1789724207620-530','2026-11-18',1),('524ec7b7-7838-11f1-8d81-60ff9e91bd8f','02000001133','CFG-1783231831143-366','2026-12-17',0),('78006ca3-b3f5-11f1-9c8f-3b0d8d9c662a','02000257727','CFG-1789724207620-530','2026-11-18',1),('9f4bbda1-b5ec-11f1-81cf-88241b1f4709','02000257727','CFG-1783231831143-366','2026-12-17',1),('a2c0a4e9-ae75-11f1-a50c-9848a14ea245','02000345411','CFG-1788767853795-196','2026-09-30',1);
/*!40000 ALTER TABLE `student_deadline_overrides` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `student_health_information`
--

DROP TABLE IF EXISTS `student_health_information`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `student_health_information` (
  `health_info_id` varchar(45) NOT NULL,
  `student_id` varchar(45) NOT NULL,
  `has_allergies` tinyint(1) DEFAULT '0',
  `allergy_food` varchar(255) DEFAULT NULL,
  `allergy_medicine` varchar(255) DEFAULT NULL,
  `allergy_insect_sting` varchar(255) DEFAULT NULL,
  `allergy_environmental` varchar(255) DEFAULT NULL,
  `allergy_others` varchar(255) DEFAULT NULL,
  `reaction_diarrhea` tinyint(1) DEFAULT '0',
  `reaction_hives` tinyint(1) DEFAULT '0',
  `reaction_local` tinyint(1) DEFAULT '0',
  `reaction_rash` tinyint(1) DEFAULT '0',
  `reaction_swelling` tinyint(1) DEFAULT '0',
  `reaction_trouble_breathing` tinyint(1) DEFAULT '0',
  `reaction_others` varchar(255) DEFAULT NULL,
  `allergy_medication_taken` varchar(255) DEFAULT NULL,
  `has_asthma` tinyint(1) DEFAULT '0',
  `asthma_triggers` varchar(255) DEFAULT NULL,
  `asthma_medication_taken` varchar(255) DEFAULT NULL,
  `has_other_respiratory` tinyint(1) DEFAULT '0',
  `other_respiratory_specify` varchar(255) DEFAULT NULL,
  `other_respiratory_medication` varchar(255) DEFAULT NULL,
  `has_blood_disorders` tinyint(1) DEFAULT '0',
  `blood_disorder_anemia` tinyint(1) DEFAULT '0',
  `blood_disorder_leukopenia` tinyint(1) DEFAULT '0',
  `blood_disorder_thrombocytopenia` tinyint(1) DEFAULT '0',
  `has_chicken_pox` tinyint(1) DEFAULT '0',
  `chicken_pox_age` int DEFAULT NULL,
  `has_digestive_disorders` tinyint(1) DEFAULT '0',
  `digestive_ulcer` tinyint(1) DEFAULT '0',
  `digestive_appendicitis` tinyint(1) DEFAULT '0',
  `digestive_gastritis` tinyint(1) DEFAULT '0',
  `digestive_hemorrhoids` tinyint(1) DEFAULT '0',
  `digestive_medication_taken` varchar(255) DEFAULT NULL,
  `has_heart_problems` tinyint(1) DEFAULT '0',
  `heart_problems_specify` varchar(255) DEFAULT NULL,
  `heart_problems_medication` varchar(255) DEFAULT NULL,
  `has_kidney_bladder_problems` tinyint(1) DEFAULT '0',
  `kidney_bladder_specify` varchar(255) DEFAULT NULL,
  `kidney_bladder_medication` varchar(255) DEFAULT NULL,
  `has_measles` tinyint(1) DEFAULT '0',
  `measles_age` int DEFAULT NULL,
  `has_metabolic_diseases` tinyint(1) DEFAULT '0',
  `metabolic_hyperglycemia` tinyint(1) DEFAULT '0',
  `metabolic_hypoglycemia` tinyint(1) DEFAULT '0',
  `has_muscle_bone_disorder` tinyint(1) DEFAULT '0',
  `muscle_bone_specify` varchar(255) DEFAULT NULL,
  `has_seizure_episode` tinyint(1) DEFAULT '0',
  `seizure_last_episode_date` date DEFAULT NULL,
  `seizure_medication_taken` varchar(255) DEFAULT NULL,
  `has_surgery` tinyint(1) DEFAULT '0',
  `surgery_specify` varchar(255) DEFAULT NULL,
  `surgery_date` date DEFAULT NULL,
  `has_vision_problem` tinyint(1) DEFAULT '0',
  `vision_specify` varchar(255) DEFAULT NULL,
  `vision_with_eyeglasses` tinyint(1) DEFAULT '0',
  `vision_with_contact_lens` tinyint(1) DEFAULT '0',
  `has_hearing_problem` tinyint(1) DEFAULT '0',
  `hearing_specify` varchar(255) DEFAULT NULL,
  `has_other_condition` tinyint(1) DEFAULT '0',
  `other_condition_specify` varchar(255) DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`health_info_id`),
  UNIQUE KEY `student_id` (`student_id`),
  CONSTRAINT `student_health_information_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `students` (`student_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `student_health_information`
--

LOCK TABLES `student_health_information` WRITE;
/*!40000 ALTER TABLE `student_health_information` DISABLE KEYS */;
INSERT INTO `student_health_information` VALUES ('102cab01-2954-484a-9abf-b1afc4679d20','02000350927',0,'','','','','',0,0,0,0,0,0,'','',0,'','',0,'','',0,0,0,0,0,NULL,0,0,0,0,0,'',0,'','',0,'','',0,NULL,0,0,0,0,'',0,NULL,'',0,'',NULL,0,'',0,0,0,'',1,'','2026-08-07 11:52:02'),('16e199df-4a31-468a-a639-263b2a8ad770','02000565656',1,'crab','','','','',0,0,0,1,0,0,'','',0,'','',0,'','',0,0,0,0,0,NULL,0,0,0,0,0,'',0,'','',0,'','',0,NULL,0,0,0,0,'',0,NULL,'',0,'',NULL,0,'',0,0,0,'',0,'','2026-08-29 07:20:14'),('1b2eb47c-d109-4f19-84e6-0d8d3b28ee9e','02000257727',1,'crab','cetirizine','','','',1,0,0,1,0,0,'','',0,'','',0,'','',0,0,0,0,0,NULL,0,0,0,0,0,'',1,'','',0,'','',0,NULL,0,0,0,1,'right wrist',0,NULL,'',0,'',NULL,0,'',0,0,0,'',0,'','2026-08-07 11:03:58'),('476fc38d-8384-494e-b334-a13a057bd7db','02000349679',0,'','','','','',0,0,0,0,0,0,'','',0,'','',0,'','',0,0,0,0,1,19,0,0,0,0,0,'',0,'','',0,'','',0,NULL,0,0,0,0,'',0,NULL,'',0,'',NULL,0,'',0,0,0,'',0,'','2026-09-12 06:20:40'),('850df23e-8090-4538-ae0e-d7aa06a90c68','02000120504',0,'','','','','',0,0,0,0,0,0,'','',1,'Dust','Inhaler',0,'','',0,0,0,0,0,NULL,0,0,0,0,0,'',0,'','',0,'','',0,NULL,0,0,0,0,'',0,NULL,'',0,'',NULL,0,'',0,0,0,'',0,'','2026-07-08 04:21:17'),('89fde078-79f3-4ca1-957d-f74b7e01cfc4','123456789',0,'','','','','',0,0,0,0,0,0,'','',1,'','',0,'','',0,0,0,0,0,NULL,0,0,0,0,0,'',0,'','',0,'','',0,NULL,0,0,0,0,'',0,NULL,'',0,'',NULL,0,'',0,0,0,'',0,'','2026-08-22 06:09:31'),('9caf3136-c93c-47e1-86a4-0ca518000297','02000371918',1,'crab','cetirizine','','','',0,0,0,1,0,0,'','',0,'','',0,'','',0,0,0,0,0,NULL,0,0,0,0,0,'',0,'','',0,'','',0,NULL,0,0,0,0,'',0,NULL,'',0,'',NULL,0,'',0,0,0,'',0,'','2026-08-07 11:31:39'),('ad94ce24-9aa6-4f9d-ba8a-3b3d97bec6fb','02000121416',1,'Shrimp','','','','',0,0,0,1,0,0,'','Ceterizine',0,'','',0,'','',0,0,0,0,0,NULL,0,0,0,0,0,'',0,'','',0,'','',0,NULL,0,0,0,0,'',0,NULL,'',0,'',NULL,0,'',0,0,0,'',0,'','2026-08-10 11:01:43'),('b94a7c03-b31d-46ae-9b7f-cd2567817136','02000112233',0,'','','','','',0,0,0,0,0,0,'','',0,'','',0,'','',0,0,0,0,0,NULL,0,0,0,0,0,'',0,'','',0,'','',0,NULL,0,0,0,0,'',0,NULL,'',0,'',NULL,0,'',0,0,0,'',1,'Sneeze','2026-08-07 14:22:48'),('f11815e9-5185-4beb-a4c9-9c1bfe9fcfe4','02000345411',0,'','','','','',0,0,0,0,0,0,'','',0,'','',0,'','',0,0,0,0,0,NULL,0,0,0,0,0,'',0,'','',0,'','',0,NULL,0,0,0,0,'',0,NULL,'',0,'',NULL,0,'',0,0,0,'',0,'','2026-06-22 11:56:34');
/*!40000 ALTER TABLE `student_health_information` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `student_personal_information`
--

DROP TABLE IF EXISTS `student_personal_information`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `student_personal_information` (
  `student_id` varchar(45) NOT NULL,
  `gender` varchar(45) NOT NULL,
  `birth_date` date NOT NULL,
  `age` int NOT NULL,
  `address` varchar(255) NOT NULL,
  `contact_number` varchar(20) NOT NULL,
  `height_cm` decimal(5,2) NOT NULL,
  `weight_kg` decimal(5,2) NOT NULL,
  `father_name` varchar(150) NOT NULL,
  `mother_name` varchar(150) NOT NULL,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`student_id`),
  CONSTRAINT `student_personal_information_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `students` (`student_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `student_personal_information`
--

LOCK TABLES `student_personal_information` WRITE;
/*!40000 ALTER TABLE `student_personal_information` DISABLE KEYS */;
INSERT INTO `student_personal_information` VALUES ('02000112233','Female','2004-12-05',21,'Makinabang,Baliuag,Bulacan','09323813833',155.50,55.00,'Kenneth Doe','Elsa Doe','2026-08-07 14:22:48'),('02000120504','Male','2004-12-07',20,'Georgiville Village, Orchid St., Brgy. Tarcan ','09196398329',155.00,54.00,'Mike Bernardo','Imelda Bernardo','2026-07-08 04:38:01'),('02000121416','Female','2004-01-25',22,'Georgiville Village, Orchid St., Brgy. Tarcan','09196398319',155.50,55.00,'Mark Angeles','Christine Angeles','2026-08-10 11:01:43'),('02000257727','Male','2004-06-08',22,'Sto.Cristo Baliuag City Bulacan','09323813833',170.18,45.00,'Sherwin B. Marcelo','Jonalyn D. Marcelo','2026-08-07 11:01:16'),('02000345411','Male','2004-12-05',20,'Georgiville Village, Orchid St., Brgy. Tarcan','342134234',155.00,54.00,'Ronald','Rochell','2026-09-11 18:36:10'),('02000349679','Male','2004-11-02',21,'Pampanga','09222708420',170.00,55.00,'John Salvador','Cecille Salvador','2026-09-12 06:20:40'),('02000350927','Male','2004-02-11',18,'Makinabang,Baliuag,Bulacan','09308673269',168.00,50.00,'Dariel Siason','Queenie Siason','2026-08-07 11:52:02'),('02000371918','Male','2005-02-13',21,'076,zone 1 Barangca,Baliuag,Bulacan','09468152467',165.10,65.00,'Wilfredo Sulit','Maribel Sulit','2026-08-07 11:31:39'),('02000565656','Male','2004-12-05',21,'Georgiville Village, Orchid St., Brgy. Tarcan','09330680817',165.00,55.00,'Robert Magat','Jonah Magat','2026-08-29 07:20:14'),('123456789','Male','2005-02-11',21,'Georgiville Village, Orchid St., Brgy. Tarcan','0926456822565',168.00,50.00,'Ronald','Elsa Doe','2026-08-22 06:09:31');
/*!40000 ALTER TABLE `student_personal_information` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `student_requirement_submissions`
--

DROP TABLE IF EXISTS `student_requirement_submissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `student_requirement_submissions` (
  `submission_id` varchar(45) NOT NULL,
  `student_id` varchar(45) NOT NULL,
  `requirement_name` varchar(150) NOT NULL,
  `file_url` varchar(512) DEFAULT NULL,
  `status` enum('Pending','Submitted','Completed','Rejected','Resubmit','Submitted Late','Not Submitted') NOT NULL DEFAULT 'Pending',
  `is_late` tinyint(1) DEFAULT '0',
  `nurse_remarks` text,
  `submitted_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `reviewed_by` varchar(45) DEFAULT NULL,
  PRIMARY KEY (`submission_id`),
  KEY `student_id` (`student_id`),
  KEY `requirement_name` (`requirement_name`),
  KEY `reviewed_by` (`reviewed_by`),
  CONSTRAINT `student_requirement_submissions_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `students` (`student_id`),
  CONSTRAINT `student_requirement_submissions_ibfk_2` FOREIGN KEY (`requirement_name`) REFERENCES `medical_requirements` (`requirement_name`),
  CONSTRAINT `student_requirement_submissions_ibfk_3` FOREIGN KEY (`reviewed_by`) REFERENCES `nurses` (`nurse_id`),
  CONSTRAINT `student_requirement_submissions_chk_1` CHECK ((`status` in (_utf8mb4'Pending',_utf8mb4'Submitted',_utf8mb4'Completed',_utf8mb4'Rejected',_utf8mb4'Submitted Late',_utf8mb4'Not Submitted',_utf8mb4'Resubmit')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `student_requirement_submissions`
--

LOCK TABLES `student_requirement_submissions` WRITE;
/*!40000 ALTER TABLE `student_requirement_submissions` DISABLE KEYS */;
INSERT INTO `student_requirement_submissions` VALUES ('04694ace-b4ea-11f1-81cf-88241b1f4709','02000257727','Dental Assessment','http://localhost:3001/uploads/02000257727-1789908208164-613554414.png','Completed',0,'','2026-09-20 12:43:28',NULL),('0b06564f-7917-11f1-a1e0-60ff9e91bd8f','02000120504','Special Requirements ito',NULL,'Not Submitted',0,'',NULL,NULL),('10f3352d-b3f5-11f1-9c8f-3b0d8d9c662a','02000001133','Hepa A',NULL,'Pending',0,'',NULL,NULL),('14a5dda7-b4dc-11f1-81cf-88241b1f4709','123456789','X Ray',NULL,'Not Submitted',0,NULL,NULL,NULL),('3a00592e-7838-11f1-8d81-60ff9e91bd8f','02000001133','Drug Test',NULL,'Pending',0,'',NULL,NULL),('3d4b233f-ae72-11f1-a50c-9848a14ea245','02000349679','X Ray','http://localhost:3001/uploads/02000349679-1789318197909-302341568.png','Completed',1,'','2026-09-13 16:49:57',NULL),('402b169c-7821-11f1-8d81-60ff9e91bd8f','02000120504','Drug Test',NULL,'Pending',0,'magpasa kana',NULL,NULL),('426f4c9a-a37a-11f1-aa13-7234afcf04a2','02000565656','X Ray',NULL,'Pending',0,'',NULL,NULL),('530a8213-7923-11f1-a1e0-60ff9e91bd8f','02000345411','Maging Mayaman','http://localhost:3001/uploads/02000345411-1783343928873-368506398.jpg','Completed',0,'Malabo','2026-07-06 13:18:48',NULL),('77f10cd9-b344-11f1-9c8f-3b0d8d9c662a','02000112233','Hepa B',NULL,'Pending',0,'',NULL,NULL),('77f111f1-b344-11f1-9c8f-3b0d8d9c662a','02000120504','Hepa B',NULL,'Pending',0,'',NULL,NULL),('77f11287-b344-11f1-9c8f-3b0d8d9c662a','02000257727','Hepa B','http://localhost:3001/uploads/02000257727-1789800159543-692389425.png','Completed',0,'','2026-09-19 06:42:39',NULL),('77f113f9-b344-11f1-9c8f-3b0d8d9c662a','02000332211','Hepa B',NULL,'Pending',0,'',NULL,NULL),('77f1143f-b344-11f1-9c8f-3b0d8d9c662a','02000345411','Hepa B','http://localhost:3001/uploads/02000345411-1790011393424-988689273.png','Completed',0,'','2026-09-21 17:23:13',NULL),('77f11478-b344-11f1-9c8f-3b0d8d9c662a','02000349679','Hepa B',NULL,'Pending',0,'',NULL,NULL),('77f114aa-b344-11f1-9c8f-3b0d8d9c662a','02000350927','Hepa B',NULL,'Pending',0,'',NULL,NULL),('77f114d9-b344-11f1-9c8f-3b0d8d9c662a','02000371918','Hepa B',NULL,'Pending',0,'',NULL,NULL),('77f11510-b344-11f1-9c8f-3b0d8d9c662a','02000565656','Hepa B',NULL,'Pending',0,'',NULL,NULL),('77f1154d-b344-11f1-9c8f-3b0d8d9c662a','123456789','Hepa B',NULL,'Pending',0,'',NULL,NULL),('7d9d575a-b77e-11f1-863e-d55d52829770','02000350927','Medical Certificate',NULL,'Not Submitted',0,NULL,NULL,NULL),('801c2cac-b504-11f1-81cf-88241b1f4709','02000257727','Vision Assessment','http://localhost:3001/uploads/02000257727-1789918101040-601594909.png','Completed',0,'','2026-09-20 15:28:21',NULL),('82240a4a-b4dc-11f1-81cf-88241b1f4709','02000371918','Medical Certificate',NULL,'Not Submitted',0,NULL,NULL,NULL),('9f4adc9c-b5ec-11f1-81cf-88241b1f4709','02000257727','Drug Test',NULL,'Pending',0,'',NULL,NULL),('a0c45d2d-aa93-11f1-b797-e58f1fec4388','02000112233','Medical Certificate',NULL,'Not Submitted',0,NULL,NULL,NULL),('ab1fd0fe-af8c-11f1-a50c-9848a14ea245','02000349679','Drug Test','http://localhost:3001/uploads/02000349679-1789315448388-245292072.png','Completed',0,'','2026-09-13 16:04:08',NULL),('b43d1561-9250-11f1-b34f-b898cf46efdd','02000257727','Medical Certificate','http://localhost:3001/uploads/02000257727-1786101152931-84599543.png','Completed',0,'','2026-08-07 11:12:32',NULL),('b630dd06-b5eb-11f1-81cf-88241b1f4709','02000257727','Urine Test','http://localhost:3001/uploads/02000257727-1790016839640-87045018.png','Completed',0,'','2026-09-21 18:53:59',NULL),('c8a6cfc9-aa91-11f1-b797-e58f1fec4388','02000120504','Hepa A',NULL,'Pending',0,'',NULL,NULL),('c8a6e54a-aa91-11f1-b797-e58f1fec4388','02000565656','Hepa A',NULL,'Pending',0,'',NULL,NULL),('c8a6e66a-aa91-11f1-b797-e58f1fec4388','123456789','Hepa A',NULL,'Pending',0,'',NULL,NULL),('e50055c3-b6ee-11f1-81cf-88241b1f4709','023456789','X Ray',NULL,'Not Submitted',0,NULL,NULL,NULL),('e5d0856c-781f-11f1-8d81-60ff9e91bd8f','02000120504','X Ray','http://localhost:3001/uploads/02000120504-1783484532507-891345005.png','Completed',0,'','2026-07-08 04:22:12',NULL),('e8509099-aa92-11f1-b797-e58f1fec4388','02000345411','Hepa A','http://localhost:3001/uploads/02000345411-1788768336368-296409805.jpg','Completed',0,'','2026-09-07 08:05:36',NULL);
/*!40000 ALTER TABLE `student_requirement_submissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `student_special_requirements`
--

DROP TABLE IF EXISTS `student_special_requirements`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `student_special_requirements` (
  `student_id` varchar(45) NOT NULL,
  `requirement_name` varchar(150) NOT NULL,
  `submission_deadline` date NOT NULL,
  `allow_late_submission` tinyint(1) DEFAULT '0',
  `assigned_by_nurse_id` varchar(45) NOT NULL,
  `assigned_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`student_id`,`requirement_name`),
  KEY `requirement_name` (`requirement_name`),
  KEY `assigned_by_nurse_id` (`assigned_by_nurse_id`),
  CONSTRAINT `student_special_requirements_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `students` (`student_id`) ON DELETE CASCADE,
  CONSTRAINT `student_special_requirements_ibfk_2` FOREIGN KEY (`requirement_name`) REFERENCES `medical_requirements` (`requirement_name`),
  CONSTRAINT `student_special_requirements_ibfk_3` FOREIGN KEY (`assigned_by_nurse_id`) REFERENCES `nurses` (`nurse_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `student_special_requirements`
--

LOCK TABLES `student_special_requirements` WRITE;
/*!40000 ALTER TABLE `student_special_requirements` DISABLE KEYS */;
INSERT INTO `student_special_requirements` VALUES ('02000001133','Drug Test','2026-09-29',0,'NURSE02000','2026-09-21 17:11:57'),('02000120504','Drug Test','2026-07-15',1,'NURSE02000','2026-07-05 03:26:03'),('02000120504','Special Requirements ito','2026-07-15',0,'NURSE02000','2026-07-06 08:45:30'),('02000257727','Dental Assessment','2026-09-24',1,'NURSE02000','2026-09-20 11:54:21'),('02000257727','Urine Test','2026-10-01',0,'NURSE02000','2026-09-21 18:39:00'),('02000257727','Vision Assessment','2026-09-26',1,'NURSE02000','2026-09-20 15:03:55'),('02000345411','Maging Mayaman','2026-07-07',1,'NURSE02000','2026-07-06 10:13:24'),('02000349679','Drug Test','2026-09-18',0,'NURSE02000','2026-09-13 16:03:32');
/*!40000 ALTER TABLE `student_special_requirements` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `students`
--

DROP TABLE IF EXISTS `students`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `students` (
  `student_id` varchar(45) NOT NULL,
  `user_id` varchar(45) NOT NULL,
  `first_name` varchar(100) DEFAULT NULL,
  `last_name` varchar(100) DEFAULT NULL,
  `program_id` varchar(45) NOT NULL,
  `year_level` int DEFAULT NULL,
  `section` varchar(45) DEFAULT NULL,
  PRIMARY KEY (`student_id`),
  UNIQUE KEY `user_id` (`user_id`),
  KEY `program_id` (`program_id`),
  CONSTRAINT `students_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `students_ibfk_2` FOREIGN KEY (`program_id`) REFERENCES `academic_programs` (`program_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `students`
--

LOCK TABLES `students` WRITE;
/*!40000 ALTER TABLE `students` DISABLE KEYS */;
INSERT INTO `students` VALUES ('02000001133','STDNT001133','Alberto','Siason','BSBA',4,'B'),('02000112233','STDNT112233','John','Doe','BSIT',4,'B'),('02000120504','STDNT120504','Mico','Bernardo','BSIT',1,'A'),('02000121416','f95f98e6-f4ec-4a55-8c86-d56c044500c9','Sofia','Angeles','TM',1,'A'),('02000257727','STDNT257727','Clark Ken','Marcelo','BSIT',4,'B'),('02000332211','STDNT332211','Lebron','James','BSIT',4,'B'),('02000345411','STDNT345411','Yahweh','Bernardo','BSIT',3,'B'),('02000349679','d806dd6e-bd0d-4820-8df1-0c40ae94dca0','John Wilson','Salvador','BSIT',1,'B'),('02000350927','STDNT350927','Albert','Siason','BSIT',4,'B'),('02000371918','STDNT371918','Wilson','Sulit','BSIT',4,'B'),('02000565656','cd890b6a-1dc8-4ee3-8247-7e4e138a32a5','Kier','Magat','BSIT',1,'B'),('023456789','7b6279f2-9149-4006-9678-f37c2e3b729f','jjjjjjj','ooooo','BSIT',1,'it1a'),('02567890','6fd1f602-2615-4e52-921f-804ff6a669df','kkkk','llll','CULINARY',1,'cula1'),('123456789','a406d9f4-2525-4a26-af5a-5003dec47f67','trebla','nosais','BSIT',1,'BSIT-A');
/*!40000 ALTER TABLE `students` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `user_id` varchar(45) NOT NULL,
  `username` varchar(255) NOT NULL,
  `password_hash` varchar(255) NOT NULL DEFAULT '123',
  `role_id` varchar(45) NOT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `username` (`username`),
  KEY `role_id` (`role_id`),
  CONSTRAINT `users_ibfk_1` FOREIGN KEY (`role_id`) REFERENCES `roles` (`role_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES ('13718843-97d3-4f37-8899-33b4a8cf9237','kkkk_parent@baliuag.sti.edu.ph','12345','PRNT',1,'2026-09-23 01:24:51'),('6da53619-9d16-4920-8c2c-a813988a9c5c','angeles.parent@baliuag.sti.edu.ph','Angeles_123','PRNT',1,'2026-08-10 10:56:13'),('6fd1f602-2615-4e52-921f-804ff6a669df','kkkk@baliuag.sti.edu.ph','Nurse_123','STDNT',1,'2026-09-23 01:14:20'),('7b6279f2-9149-4006-9678-f37c2e3b729f','asdf@baliuag.sti.edu.ph','Nurse_123','STDNT',1,'2026-09-23 01:26:52'),('8bb1b248-0295-42b8-8d7b-0f7b83537c33','salvador.parent@baliuag.sti.edu.ph','123','PRNT',1,'2026-09-12 06:04:42'),('8ea9175f-ce61-4c1b-aba0-1b1e2f5d8c74','magat.parent@baliuag.sti.edu.ph','Magat_123','PRNT',1,'2026-08-29 07:15:02'),('a406d9f4-2525-4a26-af5a-5003dec47f67','treblanosais','student123','STDNT',1,'2026-08-22 06:07:39'),('ADMN02000','admin.02000@baliuag.sti.edu.ph','Admin_123','ADMN',1,'2026-08-08 09:51:38'),('cd890b6a-1dc8-4ee3-8247-7e4e138a32a5','kier.565656@baliuag.sti.edu.ph','Kier_123','STDNT',1,'2026-08-29 07:15:02'),('d806dd6e-bd0d-4820-8df1-0c40ae94dca0','salvador.349679@baliuag.sti.edu.ph','Salvador_123','STDNT',1,'2026-09-12 06:04:42'),('f4145eff-e8f5-4286-bfa4-90a2cbea05c3','doe.parent@baliuag.sti.edu.ph','123','PRNT',1,'2026-08-10 10:21:29'),('f95f98e6-f4ec-4a55-8c86-d56c044500c9','angeles.121416@baliuag.sti.edu.ph','123','STDNT',1,'2026-08-10 10:56:13'),('NRS02000','nurse.02000@baliuag.sti.edu.ph','Nurse_123','NRS',1,'2026-06-21 11:22:08'),('PRNT001','bernardo.parent@baliuag.sti.edu.ph','Bernardo_123','PRNT',1,'2026-06-21 14:15:48'),('PRNT002','eme.parent@baliuag.sti.edu.ph','123','PRNT',1,'2026-08-04 12:01:36'),('PRNT003','marcelo.parent@baliuag.sti.edu.ph','Marcelo_123','PRNT',1,'2026-08-07 12:00:07'),('PRNT004','sulit.parent@baliuag.sti.edu.ph','123','PRNT',1,'2026-08-07 12:00:07'),('PRNT005','siason.parent@baliuag.sti.edu.ph','123','PRNT',1,'2026-08-07 12:00:07'),('STDNT001133','siason.001133@baliuag.sti.edu.ph','123','STDNT',1,'2026-07-02 09:28:25'),('STDNT112233','doe.112233@baliuag.sti.edu.ph','123','STDNT',0,'2026-08-07 14:07:14'),('STDNT120504','bernardo.120504@baliuag.sti.edu.ph','123','STDNT',1,'2026-06-21 14:18:08'),('STDNT257727','marcelo.257727@baliuag.sti.edu.ph','Clark_123','STDNT',1,'2026-08-07 10:52:16'),('STDNT332211','james.332211@baliuag.sti.edu.ph','123','STDNT',1,'2026-08-08 04:54:36'),('STDNT345411','bernardo.345411@baliuag.sti.edu.ph','Yahweh_123','STDNT',1,'2026-06-19 08:30:53'),('STDNT350927','siason.350927@baliuag.sti.edu.ph','Albert@123','STDNT',1,'2026-08-07 11:43:15'),('STDNT371918','sulit.371918@baliuag.sti.edu.ph','Ws@02132005','STDNT',1,'2026-08-07 11:23:56');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
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
  `screening_schedule_id` varchar(45) NOT NULL,
  `visual_acuity_left` varchar(10) NOT NULL,
  `visual_acuity_right` varchar(10) NOT NULL,
  `remarks` text,
  `recorded_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`vision_record_id`),
  KEY `student_id` (`student_id`),
  KEY `screening_schedule_id` (`screening_schedule_id`),
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
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-09-25 16:08:00
