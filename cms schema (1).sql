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
INSERT INTO `chief_complaints` VALUES ('ASTHMAATTACK02000','Asthma Attack'),('BODYPAIN02000','Body Pain'),('COUGH02000','Cough'),('DIFFICULTYOFBREATHING02000','Difficulty of Breathing'),('DIZZINESS02000','Dizziness'),('FEVER02000','Fever'),('LBM02000','Gastrointestinal Issues'),('HEADACHE02000','Headache'),('HEARTBURN02000','Heartburn'),('HIGHBLOOD02000','High Blood'),('INJURY02000','Injury'),('INSECTBITES02000','Insect Bites'),('LOSTCONSIOUSNESS02000','Lost Consciousness'),('MENSTRUALCRAMPS02000','Menstrual Cramps '),('NAUSEA02000','Nausea/Vomiting'),('RUNNYNOSE02000','Runny Nose'),('SORETHROAT02000','Sore Throat'),('TOOTHACHES02000','Tootaches');
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
  `visit_date` date DEFAULT NULL,
  `time_in` time DEFAULT NULL,
  `time_out` time DEFAULT NULL,
  `temperature` varchar(45) DEFAULT NULL,
  `respiratory_rate` varchar(45) DEFAULT NULL,
  `pulse_rate` varchar(45) DEFAULT NULL,
  `blood_pressure` varchar(45) DEFAULT NULL,
  `nursing_intervention` text,
  `health_advice` text,
  PRIMARY KEY (`visit_id`),
  KEY `student_id` (`student_id`),
  KEY `nurse_id` (`nurse_id`),
  KEY `clinic_visits_ibfk_3_idx` (`complaint_id`),
  CONSTRAINT `clinic_visits_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `students` (`student_id`),
  CONSTRAINT `clinic_visits_ibfk_2` FOREIGN KEY (`nurse_id`) REFERENCES `nurses` (`nurse_id`),
  CONSTRAINT `clinic_visits_ibfk_3` FOREIGN KEY (`complaint_id`) REFERENCES `chief_complaints` (`complaint_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `clinic_visits`
--

LOCK TABLES `clinic_visits` WRITE;
/*!40000 ALTER TABLE `clinic_visits` DISABLE KEYS */;
INSERT INTO `clinic_visits` VALUES ('VISIT-023E9Z0NH','02000345411','NURSE02000','HEADACHE02000','2026-08-21','22:21:00',NULL,'36.5','18','72','120/80','Give Paracetamol','Take Rest'),('VISIT-03KBJCDC9','02000345411','NURSE02000','HEADACHE02000','2026-08-21','23:12:00',NULL,'36.5','18','72','120/80','Give Katinko Spray','Take rest'),('VISIT-1RYZY5358','02000371918','NURSE02000','ASTHMAATTACK02000','2026-09-18','17:19:00',NULL,'35.0','17','70','120/80','pahinga','take care'),('VISIT-1SVJZ1E7P','02000345411','NURSE02000','HEADACHE02000','2026-07-31','13:40:00',NULL,'37.50','18','72','120/80','Given Rest','Take Rest'),('VISIT-1Z12SX2HK','02000345411','NURSE02000','FEVER02000','2026-07-21','15:13:00','15:15:00','40','18','72','120/80','Given rest','Take Rest'),('VISIT-3G0Z6E5AM','02000345411','NURSE02000','HEADACHE02000','2026-09-17','13:05:00','13:16:00','36.5','18','72','120/80','Give Rest','Take a rest'),('VISIT-465J66XGU','02000345411','NURSE02000','HEADACHE02000','2026-07-31','13:31:00',NULL,'36.5','18','72','120/80','Given Rest','Take Rest '),('VISIT-52P218VAQ','02000345411','NURSE02000','HEADACHE02000','2026-08-21','22:21:00',NULL,'36.5','18','72','120/80','Give Paracetamol','Take Rest'),('VISIT-55COWA0JB','02000345411','NURSE02000','HEADACHE02000','2026-09-15','22:27:00',NULL,'36.5','18','72','120/80','Give Medicine ','Take a rest'),('VISIT-5PY3PHBPD','02000120504','NURSE02000','HEADACHE02000','2026-07-14','12:08:00','14:45:00','36.6','16','72','118/76','Allowed rest in a dimmed clinic room, applied cold compress.','Take Rest, limit screen time, and stay hydrated.'),('VISIT-70DK14HLO','02000345411','NURSE02000','INSECTBITES02000','2026-09-17','13:16:00','17:07:00','36.5','18','72','120/80','Give a rest','Take Rest'),('VISIT-8B69QBA9C','02000345411','NURSE02000','HEADACHE02000','2026-08-21','22:26:00',NULL,'36.5','18','72','120/80','Give Paracetamol','Take Rest'),('VISIT-8XEMJ47FP','02000345411','NURSE02000','HEADACHE02000','2026-07-31','13:35:00',NULL,'36.5','18','72','120/80','Given Rest','Take Rest'),('VISIT-A0CK6Z0OA','02000257727','NURSE02000','DIZZINESS02000','2026-08-08','10:04:00',NULL,'40.5','20','80','120/80','Given rest','Take a rest'),('VISIT-A1X2Y3Z4A','02000001133','NURSE02000','FEVER02000','2025-01-15','08:30:00','09:00:00','38.5','19','85','110/70','Paracetamol administered.','Hydrate and rest.'),('VISIT-A7Y8Z9W0A','02000120504','NURSE02000','FEVER02000','2026-02-11','14:00:00','14:30:00','38.1','18','80','115/72','Cold compress applied.','Keep hydrated.'),('VISIT-AKYGU7SKU','02000345411','NURSE02000','INSECTBITES02000','2026-09-17','17:07:00','17:14:00','36.5','18','72','120/80','Give rest ','Take a rest'),('VISIT-AUYK097FX','02000565656','NURSE02000','HEADACHE02000','2026-09-03','23:56:00',NULL,'36.5','18','72','120/80','Given Medicine','Take Rest'),('VISIT-AWARQ3MQR','02000345411','NURSE02000',NULL,'2026-09-11','23:38:00','23:39:00',NULL,NULL,NULL,NULL,NULL,NULL),('VISIT-AWK8HCUZN','02000345411','NURSE02000','FEVER02000','2026-07-21','15:11:00','15:11:00','40','18','72','120/80','Given Rest','Take Rest'),('VISIT-B2X3Y4Z5B','02000120504','NURSE02000','FEVER02000','2025-03-14','09:15:00','09:45:00','38.2','20','82','120/80','Paracetamol given, cold towel on forehead.','Rest.'),('VISIT-B8Y9Z0W1B','02000345411','NURSE02000','FEVER02000','2026-03-05','09:15:00','09:45:00','38.5','20','88','120/80','Paracetamol given.','Sent home.'),('VISIT-BCAZV1J75','02000345411','NURSE02000','HEADACHE02000','2026-07-30','18:13:00',NULL,'40.0','18','72','120/80','Given rest','Take rest'),('VISIT-BPEH5J9QO','02000001133','NURSE02000','FEVER02000','2026-07-14','22:07:00','22:15:00','38.6','18','88','110/70','Administered Paracetamol as prescribed, cold compress applied.','Magpahinga (Rest), drink plenty of water, and monitor temperature.'),('VISIT-C3X4Y5Z6C','02000345411','NURSE02000','FEVER02000','2025-05-22','10:00:00','10:30:00','38.9','21','90','115/75','Monitored vitals, Paracetamol given.','Advised doctor visit if fever persists.'),('VISIT-C7K3D51UD','02000345411','NURSE02000','HEADACHE02000','2026-08-21','23:36:00',NULL,'36.5','18','72','120/80','Give Katinko','Take Rest'),('VISIT-C9Y0Z1W2C','02000001133','NURSE02000','FEVER02000','2026-04-18','11:30:00','12:00:00','38.3','19','82','112/75','Monitored vitals.','Rest.'),('VISIT-CYJ5QJE67','02000565656','NURSE02000','HEADACHE02000','2026-09-03','00:00:00',NULL,'36.5','18','30','120/80','Given a rest','Take a rest'),('VISIT-D0Y1Z2W3D','02000120504','NURSE02000','FEVER02000','2026-05-22','13:00:00','13:30:00','38.4','20','86','115/70','Cold compress applied.','Drink plenty of water.'),('VISIT-D4X5Y6Z7D','02000001133','NURSE02000','FEVER02000','2025-08-10','13:00:00','13:30:00','38.4','18','84','110/70','Cold compress applied.','Sent home to rest.'),('VISIT-DF0VPL867','02000345411','NURSE02000',NULL,'2026-09-12','14:40:00',NULL,NULL,NULL,NULL,NULL,NULL,NULL),('VISIT-DOKNBIX7G','02000345411','NURSE02000',NULL,'2026-09-11','23:47:00','23:48:00',NULL,NULL,NULL,NULL,NULL,NULL),('VISIT-E1Y2Z3W4E','02000345411','NURSE02000','FEVER02000','2026-06-10','10:30:00','11:00:00','38.3','21','85','118/78','Paracetamol given.','Rest in clinic.'),('VISIT-E5X6Y7Z8E','02000120504','NURSE02000','FEVER02000','2025-10-18','11:00:00','11:30:00','38.1','19','80','118/72','Paracetamol given.','Drink fluids.'),('VISIT-F2Y3Z4W5F','02000001133','NURSE02000','HEADACHE02000','2026-01-08','09:00:00','09:30:00','36.5','16','71','110/70','Clinic rest in quiet room.','Hydrate and rest eyes.'),('VISIT-F6X7Y8Z9F','02000345411','NURSE02000','FEVER02000','2025-12-12','10:30:00','11:00:00','38.7','22','89','115/70','Paracetamol given.','Sent home with guardian.'),('VISIT-G3Y4Z5W6G','02000120504','NURSE02000','HEADACHE02000','2026-02-15','13:30:00','14:00:00','36.6','17','73','120/80','Ice pack applied.','Limit screen time.'),('VISIT-G7X8Y9Z0G','02000345411','NURSE02000','COUGH02000','2025-02-10','08:00:00','08:30:00','36.8','16','72','110/70','Throat lozenges offered.','Wear a face mask.'),('VISIT-GEA1RZMJ8','02000120504','NURSE02000','DIFFICULTYOFBREATHING02000','2026-07-16','15:18:00','15:21:00','36.5','24','92','120/80','Assisted to a semi-Fowler position, loosened tight clothes, guided deep breathing.','Take rest at home, avoid physical exertion, and seek medical help if it persists.'),('VISIT-H4Y5Z6W7H','02000345411','NURSE02000','HEADACHE02000','2026-03-29','08:45:00','09:15:00','36.6','16','72','118/76','Rested.','Hydrate.'),('VISIT-H8X9Y0Z1H','02000001133','NURSE02000','COUGH02000','2025-06-20','09:00:00','09:30:00','36.7','17','74','115/75','Provided disposable face mask.','Drink warm fluids.'),('VISIT-I5Y6Z7W8I','02000001133','NURSE02000','HEADACHE02000','2026-04-15','10:30:00','11:00:00','36.5','16','70','110/70','Rested in clinic.','Rest.'),('VISIT-I9X0Y1Z2I','02000120504','NURSE02000','COUGH02000','2025-08-15','14:00:00','14:30:00','37.0','18','75','112/70','Lozenges offered, warm water given.','Avoid cold drinks.'),('VISIT-ITK0S9OIJ','02000345411','NURSE02000','HEADACHE02000','2026-09-15','20:24:00','22:09:00','36.5','18','72','120/80','Give Medicine','Take a rest'),('VISIT-J0X1Y2Z3J','02000345411','NURSE02000','COUGH02000','2025-11-05','10:00:00','10:30:00','36.9','16','73','120/80','Warm fluids advised.','Keep warm.'),('VISIT-J6Y7Z8W9J','02000120504','NURSE02000','HEADACHE02000','2026-05-28','14:00:00','14:30:00','36.7','18','75','115/75','Cold patch applied.','Check eyesight if frequent.'),('VISIT-K1X2Y3Z4K','02000001133','NURSE02000','HEADACHE02000','2025-04-05','11:00:00','11:30:00','36.5','16','70','110/70','Allowed rest in a quiet, dark room.','Advised resting eyes and drinking water.'),('VISIT-K7Y8Z9W0K','02000345411','NURSE02000','HEADACHE02000','2026-06-20','15:00:00','15:30:00','36.7','17','73','116/78','Clinic rest.','Sleep early.'),('VISIT-L2X3Y4Z5L','02000120504','NURSE02000','HEADACHE02000','2025-07-12','13:30:00','14:00:00','36.6','17','74','120/80','Applied ice pack to forehead.','Limit screen time.'),('VISIT-L8Y9Z0W1L','02000001133','NURSE02000','LBM02000','2026-02-05','10:00:00','10:30:00','36.6','18','74','110/70','Warm compress, restroom access.','Avoid greasy food.'),('VISIT-M3X4Y5Z6M','02000345411','NURSE02000','HEADACHE02000','2025-10-18','09:15:00','09:45:00','36.4','15','71','115/75','Rested in clinic.','Drink more fluids.'),('VISIT-M9Y0Z1W2M','02000120504','NURSE02000','LBM02000','2026-04-12','14:30:00','15:00:00','36.8','17','72','115/75','Provided restroom assistance, hydrate.','Drink warm fluids.'),('VISIT-MTMC0TSZV','02000350927','NURSE02000',NULL,'2026-09-12','13:05:00','13:06:00',NULL,NULL,NULL,NULL,NULL,NULL),('VISIT-N0Y1Z2W3N','02000345411','NURSE02000','LBM02000','2026-06-15','11:00:00','11:30:00','36.7','18','73','112/72','Hydration pack provided.','Rest.'),('VISIT-N4X5Y6Z7N','02000001133','NURSE02000','COUGH02000','2026-01-10','09:00:00','09:30:00','36.8','17','73','110/70','Warm water given.','Wear mask.'),('VISIT-N8Q7E70U2','02000345411','NURSE02000','HEADACHE02000','2026-08-21','23:38:00',NULL,'36.5','18','72','120/80','Give Katinko','Take Rest '),('VISIT-O1Y2Z3W4O','02000001133','NURSE02000','RUNNYNOSE02000','2026-01-20','09:00:00','09:30:00','36.8','18','74','110/70','Tissues & mask.','Wash hands often.'),('VISIT-O5X6Y7Z8O','02000120504','NURSE02000','COUGH02000','2026-01-28','14:00:00','14:30:00','37.1','18','75','120/80','Lozenges offered.','Rest.'),('VISIT-OQSBG87SA','02000345411','NURSE02000','FEVER02000','2026-07-29','16:28:00',NULL,'40.00','18','72','120/80','Given Rest','Take Rest'),('VISIT-P2Y3Z4W5P','02000120504','NURSE02000','RUNNYNOSE02000','2026-02-15','11:00:00','11:30:00','36.9','17','72','115/75','Provided face mask.','Rest.'),('VISIT-P6X7Y8Z9P','02000345411','NURSE02000','COUGH02000','2026-02-14','11:00:00','11:30:00','36.9','16','72','115/75','Mask given.','Drink warm fluids.'),('VISIT-PBO32WFOL','02000345411','NURSE02000','HEADACHE02000','2026-07-29','16:17:00',NULL,'36.5','18','72','120/80','Given Rest','Take Rest'),('VISIT-PP8GBW5PH','02000120504','NURSE02000','HEADACHE02000','2026-08-25','21:59:00',NULL,'36.5','18','72','120/80','Give Paracetamol ','Take Rest'),('VISIT-Q3Y4Z5W6Q','02000345411','NURSE02000','RUNNYNOSE02000','2026-03-25','10:30:00','11:00:00','37.1','18','73','120/80','Warm water given.','Mask up.'),('VISIT-Q7ILVC0W3','02000345411','NURSE02000','INSECTBITES02000','2026-09-17','17:14:00','17:20:00','36.5','18','72','120/80','Give medicine','Take a rest'),('VISIT-Q7X8Y9Z0Q','02000001133','NURSE02000','COUGH02000','2026-02-22','10:30:00','11:00:00','37.0','17','74','110/70','Lozenges provided.','Avoid cold snacks.'),('VISIT-QKKJE4OZ5','02000565656','NURSE02000','HEADACHE02000','2026-08-29','15:30:00',NULL,'36.5','18','72','120/80','Give Medicine','Take Rest'),('VISIT-R4Y5Z6W7R','02000001133','NURSE02000','RUNNYNOSE02000','2026-04-18','14:00:00','14:30:00','37.0','18','75','112/72','Tissues & mask.','Stay warm.'),('VISIT-R8X9Y0Z1R','02000120504','NURSE02000','COUGH02000','2026-03-05','09:15:00','09:45:00','36.7','18','76','112/75','Warm water compress.','Rest.'),('VISIT-RXT7VK576','02000345411','NURSE02000',NULL,'2026-09-12','12:12:00','13:15:00',NULL,NULL,NULL,NULL,NULL,NULL),('VISIT-S5Y6Z7W8S','02000120504','NURSE02000','RUNNYNOSE02000','2026-05-12','09:15:00','09:45:00','36.8','16','70','110/70','Provided mask.','Hydrate.'),('VISIT-S9X0Y1Z2S','02000345411','NURSE02000','COUGH02000','2026-03-29','15:00:00','15:30:00','36.8','16','70','118/76','Advised mask wearing.','Stay hydrated.'),('VISIT-T0X1Y2Z3T','02000001133','NURSE02000','COUGH02000','2026-04-12','13:30:00','14:00:00','37.2','19','78','115/70','Lozenges given.','Rest up.'),('VISIT-T157K0INZ','02000345411','NURSE02000','INSECTBITES02000','2026-09-17','17:20:00','22:55:00','36.5','18','72','120/80','Give rest','take a rest'),('VISIT-T6Y7Z8W9T','02000345411','NURSE02000','RUNNYNOSE02000','2026-06-30','13:00:00','13:30:00','36.9','17','72','115/75','Rest in clinic.','Mask up.'),('VISIT-TBC0L0CAS','02000565656','NURSE02000','HEADACHE02000','2026-09-03','23:57:00',NULL,'36.5','18','72','120/80','Given Rest','Take Rest'),('VISIT-U1X2Y3Z4U','02000120504','NURSE02000','COUGH02000','2026-04-25','11:15:00','11:45:00','37.1','18','74','120/80','Clinic rest, hot water.','Mask up.'),('VISIT-U7Y8Z9W0U','02000001133','NURSE02000','LBM02000','2026-07-08','14:30:00','15:00:00','36.8','18','74','112/72','Warm compress, ORS given.','Drink water, avoid dairy.'),('VISIT-UFF3Z7PR5','02000345411','NURSE02000','HEADACHE02000','2026-07-29','18:12:00',NULL,'36.5','18','72','120/80','Given Rest','Take Rest'),('VISIT-UWFNDUGLZ','02000257727','NURSE02000','DIZZINESS02000','2026-08-08','10:04:00',NULL,'40.5','20','80','120/80','Given rest','Take a rest'),('VISIT-V2X3Y4Z5V','02000345411','NURSE02000','COUGH02000','2026-05-08','08:45:00','09:15:00','36.9','17','73','110/70','Provided mask.','Drink warm tea.'),('VISIT-V8Y9Z0W1V','02000345411','NURSE02000','RUNNYNOSE02000','2026-07-14','15:00:00','15:30:00','36.8','17','71','110/70','Provided face mask.','Hydrate and wash hands.'),('VISIT-VQS962VUL','02000345411','NURSE02000','HEADACHE02000','2026-07-16','22:33:00','13:34:00','36.5','18','72','120/80','Give Paracetamol','Take rest'),('VISIT-W3X4Y5Z6W','02000001133','NURSE02000','COUGH02000','2026-05-18','14:30:00','15:00:00','37.2','18','75','112/72','Lozenges offered.','Rest.'),('VISIT-X4X5Y6Z7X','02000120504','NURSE02000','COUGH02000','2026-06-03','10:00:00','10:30:00','37.0','18','74','115/75','Warm water given.','Stay dry.'),('VISIT-Y59S7QKOD','02000345411','NURSE02000','DIFFICULTYOFBREATHING02000','2026-07-14','12:17:00','13:17:00','36.5','22','86','120/80','Monitored oxygen levels, coached rhythmic deep breathing, kept in quiet space.','Take rest, avoid running/exertion, and keep inhaler accessible if diagnosed.'),('VISIT-Y5X6Y7Z8Y','02000345411','NURSE02000','COUGH02000','2026-06-21','13:00:00','13:30:00','36.8','16','71','120/80','Mask given.','Drink fluids.'),('VISIT-YLPXI4XD4','02000345411','NURSE02000','FEVER02000','2026-07-21','15:10:00','15:11:00','40','18','72','120/80','Given Rest','Take Rest'),('VISIT-Z6X7Y8Z9Z','02000001133','NURSE02000','FEVER02000','2026-01-20','10:00:00','10:30:00','38.2','19','84','110/70','Paracetamol given.','Rest at home.');
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
INSERT INTO `consultation_dispensation` VALUES ('DISP-9ONDJDTHK','VISIT-Q7ILVC0W3','a00a43f3-bae9-47fb-9d74-940e49aa3a57',3.00,'pcs.','2026-09-17 09:16:51'),('DISP-C6ZHG6XSX','VISIT-T157K0INZ','a00a43f3-bae9-47fb-9d74-940e49aa3a57',3.00,'pcs.','2026-09-17 09:22:20'),('DISP-GSYSLQM3Z','VISIT-AKYGU7SKU','a00a43f3-bae9-47fb-9d74-940e49aa3a57',3.00,'pcs.','2026-09-17 09:09:22'),('DISP-JEF06CI31','VISIT-3G0Z6E5AM','66f77537-703c-451e-9049-2f83e41c8e92',2.00,'Tablet/s','2026-09-17 05:10:02'),('DISP-JR9TU6624','VISIT-70DK14HLO','a00a43f3-bae9-47fb-9d74-940e49aa3a57',2.00,'pcs.','2026-09-17 08:28:57'),('DISP-ZPQYUUA2W','VISIT-1RYZY5358','a00a43f3-bae9-47fb-9d74-940e49aa3a57',2.00,'pcs.','2026-09-18 09:40:40');
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
  `student_id` varchar(45) NOT NULL,
  `nurse_id` varchar(45) NOT NULL,
  `batch_id` varchar(45) NOT NULL,
  `dosage_consumption_unit_value` decimal(10,2) NOT NULL,
  `dosage_consumption_unit_of_measure` enum('mg','g','mcg','mL','L','Tablet/s','Capsule/s','Patch/es','Sachet','Vial','Prefilled Syringe','Spray/s','Inhaler','Box/es','pcs.') NOT NULL,
  `dispensed_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`direct_dispense_id`),
  KEY `student_id` (`student_id`),
  KEY `nurse_id` (`nurse_id`),
  KEY `batch_id` (`batch_id`),
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
INSERT INTO `direct_dispensation` VALUES ('0b1b7938-7488-435b-b122-0079fdc7896a','02000257727','NURSE02000','a00a43f3-bae9-47fb-9d74-940e49aa3a57',1.00,'pcs.','2026-09-18 09:38:40'),('490484b0-6bd8-4d05-a38d-62ff71620916','02000371918','NURSE02000','a00a43f3-bae9-47fb-9d74-940e49aa3a57',3.00,'pcs.','2026-09-18 09:39:26'),('5e499466-46fa-4160-b813-e786ec591236','02000257727','NURSE02000','7bd49b5e-e05e-40f9-823e-e0b0280da85c',5.00,'mL','2026-09-17 09:19:34'),('f5b039dc-83fe-4ffa-bc50-c7d739bd7871','02000001133','NURSE02000','a00a43f3-bae9-47fb-9d74-940e49aa3a57',6.00,'pcs.','2026-09-18 09:39:51'),('f6f5cf7c-7de2-4025-90cb-3763c6d6517b','02000345411','NURSE02000','a00a43f3-bae9-47fb-9d74-940e49aa3a57',2.00,'pcs.','2026-09-17 08:27:26');
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
INSERT INTO `doctor_appointment_students` VALUES ('APPT-0911caca','02000120504','Absent',NULL,NULL),('APPT-0a9d728c','02000345411','Present','2026-09-15 10:21:02',NULL),('APPT-3ca3df19','02000001133','Absent',NULL,NULL),('APPT-493a82ad','02000001133','Absent',NULL,NULL),('APPT-55443af8','02000257727','Pending',NULL,NULL),('APPT-5b93ee0d','02000257727','Absent',NULL,NULL),('APPT-5ece448c','02000257727','Present','2026-09-18 09:55:39',NULL),('APPT-68641972','02000120504','Absent',NULL,NULL),('APPT-701d0e4a','02000345411','Absent',NULL,NULL),('APPT-ba24e366','02000120504','Absent',NULL,NULL),('APPT-cf964b9f','02000257727','Absent',NULL,NULL),('APPT-efae1435','02000001133','Absent',NULL,NULL),('APPT-f4cd4273','02000120504','Absent',NULL,NULL),('APPT-ffa688e6','02000001133','Absent',NULL,NULL);
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
INSERT INTO `doctor_appointments` VALUES ('APPT-0911caca','DOC-ed638364','BATCH-1aa9e53e','2026-09-15 09:08:00','2026-09-15 09:13:00','NURSE02000','Scheduled'),('APPT-0a9d728c','DOC-ed638364','BATCH-1aa9e53e','2026-09-15 09:18:00','2026-09-15 09:23:00','NURSE02000','Scheduled'),('APPT-3ca3df19','DOC-ed638364','BATCH-c39cc872','2026-09-15 10:06:00','2026-09-15 10:11:00','NURSE02000','Scheduled'),('APPT-493a82ad','DOC-ed638364','BATCH-1aa9e53e','2026-09-15 09:03:00','2026-09-15 09:08:00','NURSE02000','Scheduled'),('APPT-55443af8','DOC-ed638364','BATCH-075c4035','2026-09-18 01:46:00','2026-09-26 02:01:00','NURSE02000','Scheduled'),('APPT-5b93ee0d','DOC-ed638364','BATCH-3a127e3d','2026-09-15 10:02:00','2026-09-15 10:07:00','NURSE02000','Scheduled'),('APPT-5ece448c','DOC-ed638364','BATCH-1aa9e53e','2026-09-15 09:13:00','2026-09-15 09:18:00','NURSE02000','Scheduled'),('APPT-68641972','DOC-ed638364','BATCH-febb34a1','2026-09-15 09:45:00','2026-09-15 09:50:00','NURSE02000','Scheduled'),('APPT-701d0e4a','DOC-ed638364','BATCH-c39cc872','2026-09-15 10:16:00','2026-09-15 10:21:00','NURSE02000','Scheduled'),('APPT-ba24e366','DOC-ed638364','BATCH-3a127e3d','2026-09-15 09:57:00','2026-09-15 10:02:00','NURSE02000','Scheduled'),('APPT-cf964b9f','DOC-ed638364','BATCH-febb34a1','2026-09-15 09:50:00','2026-09-15 09:55:00','NURSE02000','Scheduled'),('APPT-efae1435','DOC-ed638364','BATCH-febb34a1','2026-09-15 09:40:00','2026-09-15 09:45:00','NURSE02000','Scheduled'),('APPT-f4cd4273','DOC-ed638364','BATCH-c39cc872','2026-09-15 10:11:00','2026-09-15 10:16:00','NURSE02000','Scheduled'),('APPT-ffa688e6','DOC-ed638364','BATCH-3a127e3d','2026-09-15 09:52:00','2026-09-15 09:57:00','NURSE02000','Scheduled');
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
INSERT INTO `excuse_slip_notes` VALUES ('NOTE-1784890358550-190','EXC-e06c6aa9','Nurse','NURSE02000','Hi','2026-07-24 10:52:38'),('NOTE-1784890547167-340','EXC-e06c6aa9','Nurse','NURSE02000','ayos lang ako','2026-07-24 10:55:47'),('NOTE-1784890582534-633','EXC-524ed156','Nurse','NURSE02000','magresubmit ka','2026-07-24 10:56:22'),('NOTE-1786099198625-208','EXC-8b5d20de','Nurse','NURSE02000','sgeeee','2026-08-07 10:39:58'),('NOTE-1787371236061-935','EXC-d62ca3e6','Nurse','NURSE02000','magpasa ka ulit','2026-08-22 04:00:36'),('NOTE-1787989191111-55','EXC-cabb9867','Nurse','NURSE02000','Mag resubmit ka','2026-08-29 07:39:51'),('NOTE-1789191700343-909','EXC-92ab1a49','Nurse','NURSE02000','k.','2026-09-12 05:41:40'),('NOTE-81064842','EXC-e06c6aa9','Student','02000345411','hello','2026-07-24 10:22:17'),('NOTE-91b9e59e','EXC-e06c6aa9','Student','02000345411','kumusta ka','2026-07-24 10:54:28'),('NOTE-95dc96c2','EXC-8b5d20de','Student','02000345411','salamat','2026-08-07 10:40:48'),('NOTE-d806c3a9','EXC-e06c6aa9','Student','02000345411','miss na kita ','2026-07-24 10:54:35');
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
INSERT INTO `excuse_slip_requests` VALUES ('EXC-39d2f8df','02000349679','nagtae po ako','2026-09-07','2026-09-12','/uploads/02000349679-1789312302783-848689148.png','Completed','NURSE02000','2026-09-13 15:26:16','/uploads/EXC-39d2f8df-1789313176372-591242782.pdf','2026-09-13 15:11:42'),('EXC-524ed156','02000345411','bat ayaw na','2026-07-25','2026-07-27',NULL,'Denied','NURSE02000','2026-07-24 10:56:06',NULL,'2026-07-24 08:38:08'),('EXC-67a64c2b','02000345411','may lagnat po ako','2026-09-01','2026-09-05','/uploads/02000345411-1788766986922-816892501.jpg','Denied','NURSE02000','2026-09-07 07:47:34',NULL,'2026-09-07 07:43:07'),('EXC-8b5d20de','02000345411','Natatae ako by yahweh','2026-08-07','2026-08-07','/uploads/02000345411-1786099141060-541009884.png','Completed','NURSE02000','2026-08-07 10:45:02','/uploads/EXC-8b5d20de-1786099502398-435336806.png','2026-08-07 10:39:01'),('EXC-8df4d0c2','02000349679','headache','2026-09-09','2026-09-10','/uploads/02000349679-1789195125258-550985375.png','Completed','NURSE02000','2026-09-13 06:31:56','/uploads/EXC-8df4d0c2-1789281116161-643208917.pdf','2026-09-12 06:38:45'),('EXC-92ab1a49','02000371918','..','2026-09-12','2026-09-14',NULL,'Completed','NURSE02000','2026-09-12 05:44:03','/uploads/EXC-92ab1a49-1789191843054-39255530.png','2026-09-12 05:39:53'),('EXC-9838cb82','02000345411','Natatae na talaga ako pramis','2026-07-25','2026-07-28',NULL,'Completed','NURSE02000','2026-07-24 08:49:32','/uploads/EXC-9838cb82-1784882972143-28234062.png','2026-07-23 14:03:51'),('EXC-cabb9867','02000565656','Diarrhea','2026-08-31','2026-08-31','/uploads/02000565656-1787988362894-177907918.png','Completed','NURSE02000','2026-09-13 06:40:19','/uploads/EXC-cabb9867-1789281619744-972339274.pdf','2026-08-29 07:26:02'),('EXC-d62ca3e6','02000345411','LBM','2026-08-24','2026-08-24','/uploads/02000345411-1787371168110-186992049.png','Completed','NURSE02000','2026-09-13 06:40:45','/uploads/EXC-d62ca3e6-1789281644963-229615617.pdf','2026-08-22 03:59:28'),('EXC-dd29ce87','02000345411','Masakit ang ipin','2026-08-08','2026-08-09','/uploads/02000345411-1786175129857-732522744.png','Pending',NULL,NULL,NULL,'2026-08-08 07:45:29'),('EXC-e06c6aa9','02000345411','ayaw parin ba','2026-07-27','2026-07-31','/uploads/02000345411-1784882407329-958788533.png','Pending',NULL,NULL,NULL,'2026-07-24 08:40:07');
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
INSERT INTO `incident_reports` VALUES ('INC-1785134398372-563','02000345411','NURSE02000','2026-07-27 05:00:00','Room 201','Nadapa','Apply Bandaid','Rest in Clinic','2026-07-27 06:39:58'),('INC-1787989656429-484','02000565656','NURSE02000','2026-08-30 07:46:00','202','Nadapa','Binigyan ng bandaid','Taking a rest','2026-08-29 07:47:36'),('INC-1789205729555-177','02000257727','NURSE02000','2026-09-12 09:35:00','202','','','','2026-09-12 09:35:29');
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
INSERT INTO `mass_schedule_batches` VALUES ('BATCH-075c4035','NURSE02000','BSIT',NULL,'B','2026-09-26 09:46:00','2026-09-26 12:46:00','2026-09-18 09:47:24'),('BATCH-0832cd39','NURSE02000',NULL,NULL,NULL,'2026-09-15 06:00:00','2026-09-15 07:00:00','2026-09-15 05:54:34'),('BATCH-1aa9e53e','NURSE02000',NULL,NULL,NULL,'2026-09-15 09:03:00','2026-09-15 09:23:00','2026-09-15 09:01:42'),('BATCH-23cfc3e6','NURSE02000',NULL,NULL,NULL,'2026-07-26 00:50:00','2026-07-26 01:50:00','2026-07-26 08:35:27'),('BATCH-3a127e3d','NURSE02000',NULL,NULL,NULL,'2026-09-15 09:52:00','2026-09-15 10:12:00','2026-09-15 09:52:56'),('BATCH-6555eeff','NURSE02000','BSBA',NULL,NULL,'2026-07-26 00:30:00','2026-07-26 01:30:00','2026-07-26 08:33:32'),('BATCH-76ec0115','NURSE02000',NULL,NULL,NULL,'2026-07-26 00:50:00','2026-07-26 01:50:00','2026-07-26 08:38:15'),('BATCH-7955b63b','NURSE02000',NULL,NULL,NULL,'2026-09-15 06:45:00','2026-09-15 09:48:00','2026-09-15 06:44:40'),('BATCH-8364499c','NURSE02000',NULL,NULL,NULL,'2026-07-27 09:50:00','2026-07-27 10:50:00','2026-07-26 08:46:21'),('BATCH-86959624','NURSE02000','BSBA',NULL,NULL,'2026-07-26 00:30:00','2026-07-26 01:30:00','2026-07-26 08:24:27'),('BATCH-b554e91f','NURSE02000',NULL,NULL,NULL,'2026-07-25 21:00:00','2026-07-25 22:00:00','2026-07-26 04:53:21'),('BATCH-c39cc872','NURSE02000',NULL,NULL,NULL,'2026-09-15 10:06:00','2026-09-15 10:25:00','2026-09-15 10:05:34'),('BATCH-e340e3a8','NURSE02000',NULL,NULL,NULL,'2026-07-26 08:55:00','2026-07-26 09:55:00','2026-07-26 08:50:36'),('BATCH-e37e3cc2','NURSE02000',NULL,NULL,NULL,'2026-09-15 06:58:00','2026-09-15 08:58:00','2026-09-15 06:57:47'),('BATCH-febb34a1','NURSE02000',NULL,NULL,NULL,'2026-09-15 09:40:00','2026-09-15 10:00:00','2026-09-15 09:40:49');
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
INSERT INTO `medical_requirements` VALUES ('Babae'),('CBC'),('Drug Test'),('Hepa A'),('Hepa B'),('Maging Mayaman'),('Medical Certificate'),('Medicine'),('Special Requirements ito'),('X - Ray'),('X - Ray for third year'),('X Ray'),('X-Ray'),('XRAY');
/*!40000 ALTER TABLE `medical_requirements` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `medicine_indications`
--

DROP TABLE IF EXISTS `medicine_indications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `medicine_indications` (
  `medicine_id` varchar(45) NOT NULL,
  `complaint_id` varchar(45) NOT NULL,
  PRIMARY KEY (`medicine_id`,`complaint_id`),
  KEY `complaint_id` (`complaint_id`),
  CONSTRAINT `medicine_indications_ibfk_1` FOREIGN KEY (`medicine_id`) REFERENCES `medicines` (`medicine_id`) ON DELETE CASCADE,
  CONSTRAINT `medicine_indications_ibfk_2` FOREIGN KEY (`complaint_id`) REFERENCES `chief_complaints` (`complaint_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `medicine_indications`
--

LOCK TABLES `medicine_indications` WRITE;
/*!40000 ALTER TABLE `medicine_indications` DISABLE KEYS */;
INSERT INTO `medicine_indications` VALUES ('95242a99-ccf0-4daa-937b-b46516465647','BODYPAIN02000'),('78d441a2-a804-4914-b99e-523134df4b47','FEVER02000'),('78d441a2-a804-4914-b99e-523134df4b47','HEADACHE02000'),('142851d9-6ad0-4d6a-ae89-970db9000746','INSECTBITES02000');
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
INSERT INTO `medicine_inventory_batches` VALUES ('66f77537-703c-451e-9049-2f83e41c8e92','78d441a2-a804-4914-b99e-523134df4b47','2028-01-17',8,1.00,'2026-09-17 05:01:42'),('711a15bf-47a6-44e0-a5d2-c5b9b5ecd6f1','95242a99-ccf0-4daa-937b-b46516465647','2028-01-17',5,500.00,'2026-09-17 07:14:30'),('7bd49b5e-e05e-40f9-823e-e0b0280da85c','95242a99-ccf0-4daa-937b-b46516465647','2028-01-17',10,495.00,'2026-09-17 09:18:03'),('a00a43f3-bae9-47fb-9d74-940e49aa3a57','142851d9-6ad0-4d6a-ae89-970db9000746','2028-01-17',6,7.00,'2026-09-17 08:26:22');
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
INSERT INTO `medicines` VALUES ('142851d9-6ad0-4d6a-ae89-970db9000746','Ethyl','Alcohol','Box',10.00,'pcs.',1.00,'pcs.',10,5,20),('78d441a2-a804-4914-b99e-523134df4b47','Paracetamol','Biogesic','Tablet',1.00,'Tablet/s',1.00,'Tablet/s',10,5,20),('95242a99-ccf0-4daa-937b-b46516465647','Katinko','Katinko Spray','Spray',500.00,'mL',5.00,'mL',10,5,20);
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
  `recipient_user_id` varchar(45) NOT NULL,
  `title` varchar(150) NOT NULL,
  `message_body` text NOT NULL,
  `is_read` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`notification_id`),
  KEY `recipient_user_id` (`recipient_user_id`),
  CONSTRAINT `notifications_ibfk_1` FOREIGN KEY (`recipient_user_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notifications`
--

LOCK TABLES `notifications` WRITE;
/*!40000 ALTER TABLE `notifications` DISABLE KEYS */;
INSERT INTO `notifications` VALUES ('01996716-2a94-49a9-8c37-7ea9e6cec214','d806dd6e-bd0d-4820-8df1-0c40ae94dca0','New Health Screening Scheduled: Annual Dental Cleaning','You are scheduled for a BMI screening on 2026-09-18 from 00:36 to 01:36.',0,'2026-09-18 03:36:56'),('05cc7ad9-8c19-4ff5-a117-ead4422ceed1','STDNT120504','New Health Screening Scheduled: Annual BMI','You are scheduled for a BMI screening on 2026-08-03 from 08:00 to 12:00.',0,'2026-08-01 08:48:36'),('06e2369e-9b98-4907-a293-e3b312c02259','STDNT257727','Updated Schedule: Annual Checkup','Your BMI screening schedule has been updated to 2026-09-18 (17:48:00 - 21:48:00).',0,'2026-09-18 09:49:38'),('091949e5-ce48-4223-b847-521d4832c746','STDNT001133','New Health Screening Scheduled: Annual Dental Cleaning','You are scheduled for a BMI screening on 2026-09-18 from 00:36 to 01:36.',0,'2026-09-18 03:36:56'),('09ca3758-f3bb-42df-ab04-7025728838ca','STDNT001133','New Health Screening Scheduled: Annual BMI part 2','You are scheduled for a BMI screening on 2026-09-18 from 00:48 to 01:48.',0,'2026-09-18 03:48:06'),('0d3fe3ee-c6f3-47bc-9d41-105284d70532','STDNT120504','Updated Schedule: Test','Your BMI screening schedule has been updated to 2026-09-18 (12:00 - 13:00:00).',0,'2026-09-18 03:58:51'),('0e5d990c-9b79-4af0-8101-f3efc9132362','STDNT345411','New Health Screening Scheduled: Test','You are scheduled for a BMI screening on 2026-09-18 from 12:57 to 13:00.',0,'2026-09-18 03:56:40'),('0ed22fc3-c259-4168-a2a4-bf9d95aa2dcb','f95f98e6-f4ec-4a55-8c86-d56c044500c9','New Health Screening Scheduled: Test','You are scheduled for a BMI screening on 2026-09-18 from 12:57 to 13:00.',0,'2026-09-18 03:56:40'),('142008d4-0776-48be-9d95-acf2807e2b18','STDNT332211','New Health Screening Scheduled: Annual Vision Check up','You are scheduled for a Vision screening on 2026-09-15 from 18:22 to 18:50.',0,'2026-09-15 10:23:12'),('14383451-7b90-4408-a8b3-2cf87413d21b','a406d9f4-2525-4a26-af5a-5003dec47f67','New Health Screening Scheduled: Annual Vision Check up','You are scheduled for a Vision screening on 2026-09-15 from 18:22 to 18:50.',0,'2026-09-15 10:23:12'),('188c9927-231d-4047-a304-623ba7872f4d','STDNT371918','New Health Screening Scheduled: Test','You are scheduled for a BMI screening on 2026-09-18 from 12:57 to 13:00.',0,'2026-09-18 03:56:40'),('18a4cc45-aba1-48ce-adc4-5dc72e39ca57','cd890b6a-1dc8-4ee3-8247-7e4e138a32a5','New Health Screening Scheduled: Annual Vision Check up','You are scheduled for a Vision screening on 2026-09-15 from 18:22 to 18:50.',0,'2026-09-15 10:23:12'),('19db8a5f-1cd8-4e5d-8532-a5b12b2695ad','d806dd6e-bd0d-4820-8df1-0c40ae94dca0','Updated Schedule: Test','Your BMI screening schedule has been updated to 2026-09-18 (12:00 - 13:00:00).',0,'2026-09-18 03:58:51'),('1a2d42a2-8658-426a-9760-ed6c7db9f713','STDNT257727','New Health Screening Scheduled: Annual BMI','You are scheduled for a BMI screening on 2026-08-07 from 10:00 to 18:00.',0,'2026-08-07 11:20:28'),('24e2bb00-0024-485c-af1f-8fa5cae97f9b','d806dd6e-bd0d-4820-8df1-0c40ae94dca0','New Health Screening Scheduled: Annual Vision Check up','You are scheduled for a Vision screening on 2026-09-15 from 18:22 to 18:50.',0,'2026-09-15 10:23:12'),('2c13a0a8-f06d-44ff-b749-83c8c5688a56','STDNT350927','New Health Screening Scheduled: Test','You are scheduled for a BMI screening on 2026-09-18 from 12:57 to 13:00.',0,'2026-09-18 03:56:40'),('2c65a961-92ef-4735-a106-9cdfcdd0f0ac','f95f98e6-f4ec-4a55-8c86-d56c044500c9','New Health Screening Scheduled: Annual Dental Cleaning','You are scheduled for a BMI screening on 2026-09-18 from 00:36 to 01:36.',0,'2026-09-18 03:36:56'),('2ce8526d-db2b-4d64-8032-aabbbc0de9ce','STDNT001133','New Health Screening Scheduled: Annual BMI','You are scheduled for a BMI screening on 2026-07-30 from 22:34 to 23:00.',0,'2026-07-28 11:35:25'),('30b4bc58-26fa-4584-940d-72f790f73735','cd890b6a-1dc8-4ee3-8247-7e4e138a32a5','New Health Screening Scheduled: Annual BMI part 2','You are scheduled for a BMI screening on 2026-09-18 from 00:48 to 01:48.',0,'2026-09-18 03:48:06'),('31463ce8-ff8d-4fa8-b67e-32385343dadc','d806dd6e-bd0d-4820-8df1-0c40ae94dca0','New Health Screening Scheduled: Annual BMI part 2','You are scheduled for a BMI screening on 2026-09-18 from 00:48 to 01:48.',0,'2026-09-18 03:48:06'),('32196ef6-0988-4750-aab5-24b787c12721','STDNT120504','New Health Screening Scheduled: Annual BMI part 2','You are scheduled for a BMI screening on 2026-09-18 from 00:48 to 01:48.',0,'2026-09-18 03:48:06'),('34e4ec7a-4d02-424c-8814-2e82e1a70ce9','STDNT120504','New Health Screening Scheduled: Annual BMI','You are scheduled for a BMI screening on 2026-07-30 from 22:34 to 23:00.',0,'2026-07-28 11:35:25'),('395ce7bf-0f6c-4ac0-acf4-464d44315f88','STDNT001133','Cancelled Screening: Annual BMI Monitoring','The scheduled health screening \"Annual BMI Monitoring\" has been cancelled.',0,'2026-07-26 02:38:14'),('395f9772-93c4-4f6c-95cb-1653d28a879f','STDNT345411','Cancelled Screening: Annual BMI','The scheduled health screening \"Annual BMI\" has been cancelled.',0,'2026-07-28 11:35:32'),('3a8af398-43d3-4f65-aa82-eee81f8909bf','STDNT112233','New Health Screening Scheduled: Test','You are scheduled for a BMI screening on 2026-09-18 from 12:57 to 13:00.',0,'2026-09-18 03:56:40'),('40054d95-64b6-43c0-b5cf-2aeee5fa224d','STDNT112233','New Health Screening Scheduled: Annual BMI part 2','You are scheduled for a BMI screening on 2026-09-18 from 00:48 to 01:48.',0,'2026-09-18 03:48:06'),('40cb88bb-e23f-44ff-94c7-83947e8a858c','STDNT345411','New Health Screening Scheduled: Annual BMI','You are scheduled for a BMI screening on 2026-07-30 from 22:34 to 23:00.',0,'2026-07-28 11:35:25'),('4478675a-19f0-48b8-8da8-415ad5bbbfa4','STDNT001133','New Health Screening Scheduled: Annual BMI','You are scheduled for a BMI screening on 2026-08-03 from 08:00 to 12:00.',0,'2026-08-01 08:48:36'),('48d468d7-98d7-4a8a-ace8-b3b1b3ed7fff','STDNT350927','Updated Schedule: Test','Your BMI screening schedule has been updated to 2026-09-18 (12:00 - 13:00:00).',0,'2026-09-18 03:58:51'),('4964bf91-0cc2-49b7-ac4b-404b4241c899','STDNT120504','Cancelled Screening: Annual BMI','The scheduled health screening \"Annual BMI\" has been cancelled.',0,'2026-07-28 11:35:32'),('4b357a10-4690-4b11-bd04-aa66a8525cfc','STDNT001133','New Health Screening Scheduled: Test','You are scheduled for a BMI screening on 2026-09-18 from 12:57 to 13:00.',0,'2026-09-18 03:56:40'),('4b9f964b-b6ad-4616-abad-47033c247ee4','STDNT120504','New Health Screening Scheduled: Annual Dental Cleaning','You are scheduled for a BMI screening on 2026-09-18 from 00:36 to 01:36.',0,'2026-09-18 03:36:56'),('4c0062b6-9766-4dd5-b23b-11a546e9df3b','STDNT257727','New Health Screening Scheduled: Test','You are scheduled for a BMI screening on 2026-09-18 from 12:57 to 13:00.',0,'2026-09-18 03:56:40'),('4e5b524f-0367-4f87-ab2a-b1c7505acd55','a406d9f4-2525-4a26-af5a-5003dec47f67','New Health Screening Scheduled: Test','You are scheduled for a BMI screening on 2026-09-18 from 12:57 to 13:00.',0,'2026-09-18 03:56:40'),('51b0a1e0-f14a-4dd0-99aa-94b900e0451a','STDNT350927','New Health Screening Scheduled: Annual BMI','You are scheduled for a BMI screening on 2026-08-30 from 15:42 to 17:05.',0,'2026-08-29 07:44:34'),('542729e3-e2fc-4c64-8ddb-07060ee9ede3','cd890b6a-1dc8-4ee3-8247-7e4e138a32a5','New Health Screening Scheduled: Test','You are scheduled for a BMI screening on 2026-09-18 from 12:57 to 13:00.',0,'2026-09-18 03:56:40'),('55646c33-aab4-490d-8941-1a52effe41be','STDNT350927','New Health Screening Scheduled: Annual BMI part 2','You are scheduled for a BMI screening on 2026-09-18 from 00:48 to 01:48.',0,'2026-09-18 03:48:06'),('5cb8ca79-20f0-4e30-b53f-bd647b4509b0','f95f98e6-f4ec-4a55-8c86-d56c044500c9','New Health Screening Scheduled: Annual BMI part 2','You are scheduled for a BMI screening on 2026-09-18 from 00:48 to 01:48.',0,'2026-09-18 03:48:06'),('5ddaa43f-b93f-478b-a4c7-4ad077fcf6c5','STDNT120504','New Health Screening Scheduled: Annual Vision Check up','You are scheduled for a Vision screening on 2026-09-15 from 18:22 to 18:50.',0,'2026-09-15 10:23:12'),('5e121431-66da-44ba-b6b6-5524feb8f889','STDNT001133','New Health Screening Scheduled: Annual Dental Screening','You are scheduled for a Dental screening on 2026-09-15 from 13:01 to 13:05.',0,'2026-09-15 05:00:53'),('5edc2d0c-556c-4947-a2e4-50da60131881','STDNT345411','New Health Screening Scheduled: Annual BMI','You are scheduled for a BMI screening on 2026-08-07 from 10:00 to 18:00.',0,'2026-08-07 11:20:28'),('69110ad2-2aaa-459f-91e0-a425a4998b10','STDNT257727','New Health Screening Scheduled: Annual BMI','You are scheduled for a BMI screening on 2026-08-30 from 15:42 to 17:05.',0,'2026-08-29 07:44:34'),('69e54716-e35e-40ab-8eb2-89af613716b8','STDNT001133','New Health Screening Scheduled: Annual BMI','You are scheduled for a BMI screening on 2026-08-07 from 10:00 to 18:00.',0,'2026-08-07 11:20:28'),('6b1f5aa1-b9c1-44f9-b55e-4c34a0d1d3e3','STDNT120504','Cancelled Screening: Annual BMI Monitoring','The scheduled health screening \"Annual BMI Monitoring\" has been cancelled.',0,'2026-07-26 02:38:14'),('74939ed3-fd05-4c04-a090-a74c0e855cff','STDNT001133','New Health Screening Scheduled: Annual Vision Check up','You are scheduled for a Vision screening on 2026-09-15 from 18:22 to 18:50.',0,'2026-09-15 10:23:12'),('7aa43d6f-bdda-4b86-89fa-e9dd5083c486','a406d9f4-2525-4a26-af5a-5003dec47f67','New Health Screening Scheduled: Annual Dental Cleaning','You are scheduled for a BMI screening on 2026-09-18 from 00:36 to 01:36.',0,'2026-09-18 03:36:56'),('85783842-ed71-4afb-a6cd-94d595c58bbe','STDNT332211','New Health Screening Scheduled: Annual Dental Screening','You are scheduled for a Dental screening on 2026-09-15 from 13:01 to 13:05.',0,'2026-09-15 05:00:53'),('87a24c0d-e8ec-4eac-9fd6-cb540de5cf1e','cd890b6a-1dc8-4ee3-8247-7e4e138a32a5','New Health Screening Scheduled: Annual Dental Screening','You are scheduled for a Dental screening on 2026-09-15 from 13:01 to 13:05.',0,'2026-09-15 05:00:53'),('8889b632-38a7-4502-b9d3-9ea61c552590','STDNT120504','New Health Screening Scheduled: Annual Dental Screening','You are scheduled for a Dental screening on 2026-09-15 from 13:01 to 13:05.',0,'2026-09-15 05:00:53'),('88c6a357-7023-4642-864b-29ceb812715f','STDNT332211','New Health Screening Scheduled: Annual BMI','You are scheduled for a BMI screening on 2026-08-30 from 15:42 to 17:05.',0,'2026-08-29 07:44:34'),('8c593ea0-4a17-4a9c-a460-6ac79872c4cf','STDNT257727','New Health Screening Scheduled: Annual Vision Check up','You are scheduled for a Vision screening on 2026-09-15 from 18:22 to 18:50.',0,'2026-09-15 10:23:12'),('8c94d3dd-5ed4-4345-a239-3eda8350fe61','STDNT257727','New Health Screening Scheduled: Annual Dental Screening','You are scheduled for a Dental screening on 2026-09-15 from 13:01 to 13:05.',0,'2026-09-15 05:00:53'),('8f96a9b0-7978-4532-aa45-1d502f561888','cd890b6a-1dc8-4ee3-8247-7e4e138a32a5','Updated Schedule: Test','Your BMI screening schedule has been updated to 2026-09-18 (12:00 - 13:00:00).',0,'2026-09-18 03:58:51'),('9319896f-3c51-4498-abb9-bf9f7fd95a0f','STDNT345411','New Health Screening Scheduled: Annual Dental Cleaning','You are scheduled for a BMI screening on 2026-09-18 from 00:36 to 01:36.',0,'2026-09-18 03:36:56'),('960c45d4-a8c9-4174-a8ee-677f2042820d','STDNT112233','New Health Screening Scheduled: Annual Dental Screening','You are scheduled for a Dental screening on 2026-09-15 from 13:01 to 13:05.',0,'2026-09-15 05:00:53'),('9933228f-ae34-4844-a6e9-4f2ed1d1bc8e','STDNT257727','New Health Screening Scheduled: Annual BMI part 2','You are scheduled for a BMI screening on 2026-09-18 from 00:48 to 01:48.',0,'2026-09-18 03:48:06'),('9baa89b4-9c16-404e-b8ec-7b867c0ec4d4','STDNT332211','New Health Screening Scheduled: Annual Dental Cleaning','You are scheduled for a BMI screening on 2026-09-18 from 00:36 to 01:36.',0,'2026-09-18 03:36:56'),('9eaa81c0-766d-485b-97ba-3f112a0f4f7a','STDNT112233','New Health Screening Scheduled: Annual Vision Check up','You are scheduled for a Vision screening on 2026-09-15 from 18:22 to 18:50.',0,'2026-09-15 10:23:12'),('9f7a2c6e-300d-4eee-afb5-323ee24c53d1','STDNT345411','New Health Screening Scheduled: Annual BMI part 2','You are scheduled for a BMI screening on 2026-09-18 from 00:48 to 01:48.',0,'2026-09-18 03:48:06'),('a09a56bd-122c-4e24-9d65-62b92ec47789','STDNT001133','Updated Schedule: Test','Your BMI screening schedule has been updated to 2026-09-18 (12:00 - 13:00:00).',0,'2026-09-18 03:58:51'),('a4d00085-ee0a-4a83-8974-89496d5b8aba','STDNT112233','New Health Screening Scheduled: Annual BMI','You are scheduled for a BMI screening on 2026-08-30 from 15:42 to 17:05.',0,'2026-08-29 07:44:34'),('a68fe6df-bae1-4af9-bb40-b670c4e02a9f','STDNT345411','New Health Screening Scheduled: Annual BMI','You are scheduled for a BMI screening on 2026-08-03 from 08:00 to 12:00.',0,'2026-08-01 08:48:36'),('ab313883-7f19-4481-87af-2030b711bb99','STDNT345411','New Health Screening Scheduled: Annual Vision Check up','You are scheduled for a Vision screening on 2026-09-15 from 18:22 to 18:50.',0,'2026-09-15 10:23:12'),('adbb5826-a493-4aaf-bc84-6edfabfa64d4','STDNT371918','New Health Screening Scheduled: Annual Dental Screening','You are scheduled for a Dental screening on 2026-09-15 from 13:01 to 13:05.',0,'2026-09-15 05:00:53'),('ae64f95a-7331-4f1e-b127-f4c47e98ff46','a406d9f4-2525-4a26-af5a-5003dec47f67','New Health Screening Scheduled: Annual Dental Screening','You are scheduled for a Dental screening on 2026-09-15 from 13:01 to 13:05.',0,'2026-09-15 05:00:53'),('b064b2e1-beed-4c15-9fe8-15e4668fab01','STDNT371918','New Health Screening Scheduled: Annual Vision Check up','You are scheduled for a Vision screening on 2026-09-15 from 18:22 to 18:50.',0,'2026-09-15 10:23:12'),('b16f3163-198c-41de-b411-d6374ae0108b','STDNT345411','Cancelled Screening: Annual BMI Monitoring','The scheduled health screening \"Annual BMI Monitoring\" has been cancelled.',0,'2026-07-26 02:38:14'),('b27f2f07-6dab-4b35-9d22-e2c3c5c77893','STDNT120504','New Health Screening Scheduled: Test','You are scheduled for a BMI screening on 2026-09-18 from 12:57 to 13:00.',0,'2026-09-18 03:56:40'),('b3a705fc-6b0e-4474-b657-87f3ce8f8c7e','STDNT001133','New Health Screening Scheduled: Annual BMI Monitoring','You are scheduled for a BMI screening on 2026-07-27 from 20:25 to 22:25.',0,'2026-07-25 12:22:05'),('b4fd076c-d1ca-4d23-aacf-0aaa9b35e687','STDNT120504','New Health Screening Scheduled: Annual BMI Monitoring','You are scheduled for a BMI screening on 2026-07-27 from 20:25 to 22:25.',0,'2026-07-25 12:22:05'),('b55d0398-2772-4c45-91c8-189a967664dc','STDNT345411','New Health Screening Scheduled: Annual BMI Monitoring','You are scheduled for a BMI screening on 2026-07-27 from 20:25 to 22:25.',0,'2026-07-25 12:22:05'),('bac44ae2-9f7a-4d06-b70b-27cc691a137a','STDNT257727','New Health Screening Scheduled: Annual Dental Cleaning','You are scheduled for a BMI screening on 2026-09-18 from 00:36 to 01:36.',0,'2026-09-18 03:36:56'),('bafa11ef-8540-4045-b7ba-bb636d78a195','STDNT001133','Cancelled Screening: Annual BMI','The scheduled health screening \"Annual BMI\" has been cancelled.',0,'2026-07-28 11:35:32'),('bd396115-a7d1-41b1-86c9-f80047b7520f','STDNT257727','Updated Schedule: Test','Your BMI screening schedule has been updated to 2026-09-18 (12:00 - 13:00:00).',0,'2026-09-18 03:58:51'),('bd954e44-411c-44ee-aea9-cce56b60f4bd','a406d9f4-2525-4a26-af5a-5003dec47f67','Updated Schedule: Test','Your BMI screening schedule has been updated to 2026-09-18 (12:00 - 13:00:00).',0,'2026-09-18 03:58:51'),('bed9f312-bd34-452e-ba3e-014d53575ddd','f95f98e6-f4ec-4a55-8c86-d56c044500c9','Updated Schedule: Test','Your BMI screening schedule has been updated to 2026-09-18 (12:00 - 13:00:00).',0,'2026-09-18 03:58:51'),('bf8cb7eb-942d-4878-840b-dfac6aec2e27','STDNT350927','New Health Screening Scheduled: Annual Dental Cleaning','You are scheduled for a BMI screening on 2026-09-18 from 00:36 to 01:36.',0,'2026-09-18 03:36:56'),('c7242f1c-58d5-4fa8-adb7-8ecb84bb2869','STDNT371918','New Health Screening Scheduled: Annual Dental Cleaning','You are scheduled for a BMI screening on 2026-09-18 from 00:36 to 01:36.',0,'2026-09-18 03:36:56'),('c8ebe018-0430-4e0f-a694-71c09d8a34ea','cd890b6a-1dc8-4ee3-8247-7e4e138a32a5','New Health Screening Scheduled: Annual Dental Cleaning','You are scheduled for a BMI screening on 2026-09-18 from 00:36 to 01:36.',0,'2026-09-18 03:36:56'),('c92bb84b-50af-4ead-9ccf-f404a2ee4f87','STDNT332211','New Health Screening Scheduled: Test','You are scheduled for a BMI screening on 2026-09-18 from 12:57 to 13:00.',0,'2026-09-18 03:56:40'),('cdc1d251-968a-4ca0-a318-bd2c3dcfdae2','f95f98e6-f4ec-4a55-8c86-d56c044500c9','New Health Screening Scheduled: Annual Vision Check up','You are scheduled for a Vision screening on 2026-09-15 from 18:22 to 18:50.',0,'2026-09-15 10:23:12'),('cf446804-c4a7-4862-8063-1fc2b7cbfae0','STDNT371918','Updated Schedule: Test','Your BMI screening schedule has been updated to 2026-09-18 (12:00 - 13:00:00).',0,'2026-09-18 03:58:51'),('dc0d8003-8fc8-40b8-8a43-a85e77b9c492','d806dd6e-bd0d-4820-8df1-0c40ae94dca0','New Health Screening Scheduled: Test','You are scheduled for a BMI screening on 2026-09-18 from 12:57 to 13:00.',0,'2026-09-18 03:56:40'),('de2c1c55-19a1-4e0e-945c-6d02f643e869','d806dd6e-bd0d-4820-8df1-0c40ae94dca0','New Health Screening Scheduled: Annual Dental Screening','You are scheduled for a Dental screening on 2026-09-15 from 13:01 to 13:05.',0,'2026-09-15 05:00:53'),('e7687f0c-ac79-4aeb-939e-bb608e4fb6b0','STDNT345411','New Health Screening Scheduled: Annual Dental Screening','You are scheduled for a Dental screening on 2026-09-15 from 13:01 to 13:05.',0,'2026-09-15 05:00:53'),('eb53a76c-690e-4bbb-aaa8-69d2f4b1bada','STDNT332211','New Health Screening Scheduled: Annual BMI part 2','You are scheduled for a BMI screening on 2026-09-18 from 00:48 to 01:48.',0,'2026-09-18 03:48:06'),('eedce23d-81a6-47d6-bbe1-d143446186a6','STDNT112233','Updated Schedule: Test','Your BMI screening schedule has been updated to 2026-09-18 (12:00 - 13:00:00).',0,'2026-09-18 03:58:51'),('eee8c3c2-350a-42e5-87b3-e623c4074c41','STDNT350927','New Health Screening Scheduled: Annual Vision Check up','You are scheduled for a Vision screening on 2026-09-15 from 18:22 to 18:50.',0,'2026-09-15 10:23:12'),('ef418aad-ab38-41d4-9383-bc3b3297ef70','STDNT332211','Updated Schedule: Test','Your BMI screening schedule has been updated to 2026-09-18 (12:00 - 13:00:00).',0,'2026-09-18 03:58:51'),('f132f9e3-7417-49ad-918d-96e04800d646','STDNT371918','New Health Screening Scheduled: Annual BMI part 2','You are scheduled for a BMI screening on 2026-09-18 from 00:48 to 01:48.',0,'2026-09-18 03:48:06'),('f4108b33-6234-4b10-a3a7-f7017500bf00','STDNT257727','New Health Screening Scheduled: Annual Checkup','You are scheduled for a BMI screening on 2026-09-19 from 17:48 to 21:48.',0,'2026-09-18 09:49:28'),('f58aeeef-b894-404c-ac5b-4473ddec4779','STDNT350927','New Health Screening Scheduled: Annual Dental Screening','You are scheduled for a Dental screening on 2026-09-15 from 13:01 to 13:05.',0,'2026-09-15 05:00:53'),('f59609c0-798a-4f46-82fa-133c3afeb08c','STDNT345411','Updated Schedule: Test','Your BMI screening schedule has been updated to 2026-09-18 (12:00 - 13:00:00).',0,'2026-09-18 03:58:51'),('f7bd67a4-6265-414f-b9dc-236f87156d8b','STDNT371918','New Health Screening Scheduled: Annual BMI','You are scheduled for a BMI screening on 2026-08-30 from 15:42 to 17:05.',0,'2026-08-29 07:44:34'),('fb177e63-ad6a-4efe-b9ae-435c2dda6d29','f95f98e6-f4ec-4a55-8c86-d56c044500c9','New Health Screening Scheduled: Annual Dental Screening','You are scheduled for a Dental screening on 2026-09-15 from 13:01 to 13:05.',0,'2026-09-15 05:00:53'),('fba72399-6079-4842-b0b6-f0653ce0a2d7','a406d9f4-2525-4a26-af5a-5003dec47f67','New Health Screening Scheduled: Annual BMI part 2','You are scheduled for a BMI screening on 2026-09-18 from 00:48 to 01:48.',0,'2026-09-18 03:48:06'),('fee7dfce-f71c-4ba9-807e-bc80e304956b','STDNT112233','New Health Screening Scheduled: Annual Dental Cleaning','You are scheduled for a BMI screening on 2026-09-18 from 00:36 to 01:36.',0,'2026-09-18 03:36:56'),('NOTIF-051801b8','STDNT001133','New Doctor Visit Scheduled','You have been scheduled for a doctor visit on 9/15/2026, 6:06:00 PM. Please be at the clinic on time.',0,'2026-09-15 10:05:34'),('NOTIF-09a352f7','cd890b6a-1dc8-4ee3-8247-7e4e138a32a5','New Doctor Visit Scheduled','You have been scheduled for a doctor visit on 9/15/2026, 4:38:00 PM. Please be at the clinic on time.',0,'2026-09-15 06:57:47'),('NOTIF-10eab18f','STDNT345411','New Doctor Visit Scheduled','You have been scheduled for a doctor visit on 9/15/2026, 5:18:00 PM. Please be at the clinic on time.',0,'2026-09-15 09:01:42'),('NOTIF-10ff9473','STDNT332211','New Doctor Visit Scheduled','You have been scheduled for a doctor visit on 9/15/2026, 3:48:00 PM. Please be at the clinic on time.',0,'2026-09-15 06:57:47'),('NOTIF-12807204','STDNT001133','New Doctor Visit Scheduled','You have been scheduled for a doctor visit on 7/27/2026, 5:50:00 PM. Please be at the clinic on time.',0,'2026-07-26 08:46:21'),('NOTIF-1854605a','STDNT120504','New Doctor Visit Scheduled','You have been scheduled for a doctor visit on 7/26/2026, 5:05:00 PM. Please be at the clinic on time.',0,'2026-07-26 08:50:37'),('NOTIF-1aa0bbd3','STDNT001133','New Doctor Visit Scheduled','You have been scheduled for a doctor visit on 9/15/2026, 2:45:00 PM. Please be at the clinic on time.',0,'2026-09-15 06:44:40'),('NOTIF-1eecd835','STDNT345411','New Doctor Visit Scheduled','You have been scheduled for a doctor visit on 7/26/2026, 9:20:00 AM. Please be at the clinic on time.',0,'2026-07-26 08:35:27'),('NOTIF-1f80f660','a406d9f4-2525-4a26-af5a-5003dec47f67','New Doctor Visit Scheduled','You have been scheduled for a doctor visit on 9/15/2026, 2:55:00 PM. Please be at the clinic on time.',0,'2026-09-15 05:54:35'),('NOTIF-21643c0d','a406d9f4-2525-4a26-af5a-5003dec47f67','New Doctor Visit Scheduled','You have been scheduled for a doctor visit on 9/15/2026, 4:48:00 PM. Please be at the clinic on time.',0,'2026-09-15 06:57:47'),('NOTIF-22c8c81e','STDNT001133','New Doctor Visit Scheduled','You have been scheduled for a doctor visit on 7/26/2026, 8:30:00 AM. Please be at the clinic on time.',0,'2026-07-26 08:33:32'),('NOTIF-25909bc9','STDNT112233','New Doctor Visit Scheduled','You have been scheduled for a doctor visit on 9/15/2026, 2:05:00 PM. Please be at the clinic on time.',0,'2026-09-15 05:54:34'),('NOTIF-28cf3fde','cd890b6a-1dc8-4ee3-8247-7e4e138a32a5','New Doctor Visit Scheduled','You have been scheduled for a doctor visit on 9/15/2026, 5:15:00 PM. Please be at the clinic on time.',0,'2026-09-15 06:44:40'),('NOTIF-3117f4bb','STDNT001133','New Doctor Visit Scheduled','You have been scheduled for a doctor visit on 7/26/2026, 8:50:00 AM. Please be at the clinic on time.',0,'2026-07-26 08:38:15'),('NOTIF-39b0ebe5','STDNT350927','New Doctor Visit Scheduled','You have been scheduled for a doctor visit on 9/15/2026, 4:45:00 PM. Please be at the clinic on time.',0,'2026-09-15 06:44:40'),('NOTIF-3c3b2c79','STDNT120504','New Doctor Visit Scheduled','You have been scheduled for a doctor visit on 7/27/2026, 6:05:00 PM. Please be at the clinic on time.',0,'2026-07-26 08:46:21'),('NOTIF-4434e8f0','STDNT001133','New Doctor Visit Scheduled','You have been scheduled for a doctor visit on 9/15/2026, 5:03:00 PM. Please be at the clinic on time.',0,'2026-09-15 09:01:42'),('NOTIF-458933cc','STDNT345411','New Doctor Visit Scheduled','You have been scheduled for a doctor visit on 7/27/2026, 6:20:00 PM. Please be at the clinic on time.',0,'2026-07-26 08:46:21'),('NOTIF-45ebc0e4','STDNT001133','New Doctor Visit Scheduled','You have been scheduled for a doctor visit on 9/15/2026, 2:00:00 PM. Please be at the clinic on time.',0,'2026-09-15 05:54:34'),('NOTIF-57029e4a','a406d9f4-2525-4a26-af5a-5003dec47f67','New Doctor Visit Scheduled','You have been scheduled for a doctor visit on 9/15/2026, 5:30:00 PM. Please be at the clinic on time.',0,'2026-09-15 06:44:40'),('NOTIF-5741c2cd','STDNT257727','New Doctor Visit Scheduled','You have been scheduled for a doctor visit on 9/15/2026, 5:13:00 PM. Please be at the clinic on time.',0,'2026-09-15 09:01:42'),('NOTIF-58ba68c6','STDNT112233','New Doctor Visit Scheduled','You have been scheduled for a doctor visit on 9/15/2026, 3:00:00 PM. Please be at the clinic on time.',0,'2026-09-15 06:44:40'),('NOTIF-62653b51','STDNT345411','New Doctor Visit Scheduled','You have been scheduled for a doctor visit on 9/15/2026, 4:15:00 PM. Please be at the clinic on time.',0,'2026-09-15 06:44:40'),('NOTIF-648008fd','STDNT257727','New Doctor Visit Scheduled','You have been scheduled for a doctor visit on 9/15/2026, 6:02:00 PM. Please be at the clinic on time.',0,'2026-09-15 09:52:56'),('NOTIF-68bb472e','STDNT332211','New Doctor Visit Scheduled','You have been scheduled for a doctor visit on 9/15/2026, 4:00:00 PM. Please be at the clinic on time.',0,'2026-09-15 06:44:40'),('NOTIF-6d3d195d','STDNT257727','New Doctor Visit Scheduled','You have been scheduled for a doctor visit on 9/15/2026, 2:20:00 PM. Please be at the clinic on time.',0,'2026-09-15 05:54:35'),('NOTIF-6e4c91e1','cd890b6a-1dc8-4ee3-8247-7e4e138a32a5','New Doctor Visit Scheduled','You have been scheduled for a doctor visit on 9/15/2026, 2:50:00 PM. Please be at the clinic on time.',0,'2026-09-15 05:54:35'),('NOTIF-74a4cfed','STDNT120504','New Doctor Visit Scheduled','You have been scheduled for a doctor visit on 9/15/2026, 3:15:00 PM. Please be at the clinic on time.',0,'2026-09-15 06:44:40'),('NOTIF-7b9b52c1','d806dd6e-bd0d-4820-8df1-0c40ae94dca0','New Doctor Visit Scheduled','You have been scheduled for a doctor visit on 9/15/2026, 4:30:00 PM. Please be at the clinic on time.',0,'2026-09-15 06:44:40'),('NOTIF-87f7a033','STDNT371918','New Doctor Visit Scheduled','You have been scheduled for a doctor visit on 9/15/2026, 2:45:00 PM. Please be at the clinic on time.',0,'2026-09-15 05:54:35'),('NOTIF-8ef85d07','f95f98e6-f4ec-4a55-8c86-d56c044500c9','New Doctor Visit Scheduled','You have been scheduled for a doctor visit on 9/15/2026, 2:15:00 PM. Please be at the clinic on time.',0,'2026-09-15 05:54:35'),('NOTIF-8fcf5737','STDNT001133','New Doctor Visit Scheduled','You have been scheduled for a doctor visit on 7/26/2026, 4:55:00 PM. Please be at the clinic on time.',0,'2026-07-26 08:50:36'),('NOTIF-953d472a','STDNT120504','New Doctor Visit Scheduled','You have been scheduled for a doctor visit on 9/15/2026, 6:11:00 PM. Please be at the clinic on time.',0,'2026-09-15 10:05:34'),('NOTIF-9b281a3e','d806dd6e-bd0d-4820-8df1-0c40ae94dca0','New Doctor Visit Scheduled','You have been scheduled for a doctor visit on 9/15/2026, 2:35:00 PM. Please be at the clinic on time.',0,'2026-09-15 05:54:35'),('NOTIF-9d612996','STDNT120504','New Doctor Visit Scheduled','You have been scheduled for a doctor visit on 9/15/2026, 5:45:00 PM. Please be at the clinic on time.',0,'2026-09-15 09:40:49'),('NOTIF-a028a174','d806dd6e-bd0d-4820-8df1-0c40ae94dca0','New Doctor Visit Scheduled','You have been scheduled for a doctor visit on 9/15/2026, 4:08:00 PM. Please be at the clinic on time.',0,'2026-09-15 06:57:47'),('NOTIF-a13a5213','STDNT257727','New Doctor Visit Scheduled','You have been scheduled for a doctor visit on 9/15/2026, 3:45:00 PM. Please be at the clinic on time.',0,'2026-09-15 06:44:40'),('NOTIF-a4c7186b','STDNT345411','New Doctor Visit Scheduled','You have been scheduled for a doctor visit on 7/26/2026, 5:15:00 PM. Please be at the clinic on time.',0,'2026-07-26 08:50:37'),('NOTIF-a62120be','STDNT332211','New Doctor Visit Scheduled','You have been scheduled for a doctor visit on 9/15/2026, 2:25:00 PM. Please be at the clinic on time.',0,'2026-09-15 05:54:35'),('NOTIF-a7b6f3d3','STDNT001133','New Doctor Visit Scheduled','You have been scheduled for a doctor visit on 9/15/2026, 5:40:00 PM. Please be at the clinic on time.',0,'2026-09-15 09:40:49'),('NOTIF-b0106ba2','STDNT120504','New Doctor Visit Scheduled','You have been scheduled for a doctor visit on 7/26/2026, 9:05:00 AM. Please be at the clinic on time.',0,'2026-07-26 08:35:27'),('NOTIF-b41a6e79','STDNT120504','New Doctor Visit Scheduled','You have been scheduled for a doctor visit on 9/15/2026, 5:57:00 PM. Please be at the clinic on time.',0,'2026-09-15 09:52:56'),('NOTIF-b5003342','STDNT120504','New Doctor Visit Scheduled','You have been scheduled for a doctor visit on 9/15/2026, 3:18:00 PM. Please be at the clinic on time.',0,'2026-09-15 06:57:47'),('NOTIF-b879c263','STDNT112233','New Doctor Visit Scheduled','You have been scheduled for a doctor visit on 9/15/2026, 3:08:00 PM. Please be at the clinic on time.',0,'2026-09-15 06:57:47'),('NOTIF-b987146b','STDNT257727','New Doctor Visit Scheduled','You have been scheduled for a doctor visit on 9/26/2026, 5:46:00 PM. Please be at the clinic on time.',0,'2026-09-18 09:47:24'),('NOTIF-bb5aaf5d','STDNT120504','New Doctor Visit Scheduled','You have been scheduled for a doctor visit on 7/26/2026, 9:05:00 AM. Please be at the clinic on time.',0,'2026-07-26 08:38:15'),('NOTIF-bc1cd859','STDNT345411','New Doctor Visit Scheduled','You have been scheduled for a doctor visit on 7/26/2026, 9:20:00 AM. Please be at the clinic on time.',0,'2026-07-26 08:38:15'),('NOTIF-c161dd12','f95f98e6-f4ec-4a55-8c86-d56c044500c9','New Doctor Visit Scheduled','You have been scheduled for a doctor visit on 9/15/2026, 3:30:00 PM. Please be at the clinic on time.',0,'2026-09-15 06:44:40'),('NOTIF-c33802e4','STDNT001133','New Doctor Visit Scheduled','You have been scheduled for a doctor visit on 9/15/2026, 2:58:00 PM. Please be at the clinic on time.',0,'2026-09-15 06:57:47'),('NOTIF-c4575768','STDNT371918','New Doctor Visit Scheduled','You have been scheduled for a doctor visit on 9/15/2026, 4:28:00 PM. Please be at the clinic on time.',0,'2026-09-15 06:57:47'),('NOTIF-c56e32a6','STDNT350927','New Doctor Visit Scheduled','You have been scheduled for a doctor visit on 9/15/2026, 2:40:00 PM. Please be at the clinic on time.',0,'2026-09-15 05:54:35'),('NOTIF-cbbb5ab9','STDNT001133','New Doctor Visit Scheduled','You have been scheduled for a doctor visit on 7/26/2026, 8:50:00 AM. Please be at the clinic on time.',0,'2026-07-26 08:35:27'),('NOTIF-d3cd201f','STDNT371918','New Doctor Visit Scheduled','You have been scheduled for a doctor visit on 9/15/2026, 5:00:00 PM. Please be at the clinic on time.',0,'2026-09-15 06:44:40'),('NOTIF-d3f6aa64','STDNT257727','New Doctor Visit Scheduled','You have been scheduled for a doctor visit on 9/15/2026, 5:50:00 PM. Please be at the clinic on time.',0,'2026-09-15 09:40:49'),('NOTIF-d56d7d89','STDNT120504','New Doctor Visit Scheduled','You have been scheduled for a doctor visit on 9/15/2026, 5:08:00 PM. Please be at the clinic on time.',0,'2026-09-15 09:01:42'),('NOTIF-d8dad551','STDNT120504','New Doctor Visit Scheduled','You have been scheduled for a doctor visit on 9/15/2026, 2:10:00 PM. Please be at the clinic on time.',0,'2026-09-15 05:54:35'),('NOTIF-d93d6201','STDNT345411','New Doctor Visit Scheduled','You have been scheduled for a doctor visit on 9/15/2026, 2:30:00 PM. Please be at the clinic on time.',0,'2026-09-15 05:54:35'),('NOTIF-e30a96af','STDNT350927','New Doctor Visit Scheduled','You have been scheduled for a doctor visit on 9/15/2026, 4:18:00 PM. Please be at the clinic on time.',0,'2026-09-15 06:57:47'),('NOTIF-e3600b84','STDNT257727','New Doctor Visit Scheduled','You have been scheduled for a doctor visit on 9/15/2026, 3:38:00 PM. Please be at the clinic on time.',0,'2026-09-15 06:57:47'),('NOTIF-ec69d64d','STDNT001133','New Doctor Visit Scheduled','You have been scheduled for a doctor visit on 9/15/2026, 5:52:00 PM. Please be at the clinic on time.',0,'2026-09-15 09:52:56'),('NOTIF-ee881c93','STDNT345411','New Doctor Visit Scheduled','You have been scheduled for a doctor visit on 9/15/2026, 6:16:00 PM. Please be at the clinic on time.',0,'2026-09-15 10:05:34'),('NOTIF-f5ff20d2','STDNT345411','New Doctor Visit Scheduled','You have been scheduled for a doctor visit on 9/15/2026, 3:58:00 PM. Please be at the clinic on time.',0,'2026-09-15 06:57:47'),('NOTIF-f71f2282','STDNT257727','Doctor Visit Rescheduled','Your doctor visit appointment time has been updated to 9/18/2026, 9:46:00 AM.',0,'2026-09-18 09:48:13'),('NOTIF-faa1fe10','f95f98e6-f4ec-4a55-8c86-d56c044500c9','New Doctor Visit Scheduled','You have been scheduled for a doctor visit on 9/15/2026, 3:28:00 PM. Please be at the clinic on time.',0,'2026-09-15 06:57:47');
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
INSERT INTO `parent_student_mapping` VALUES ('PARENT006','02000112233'),('PARENT001','02000120504'),('PARENT007','02000121416'),('PARENT003','02000257727'),('PARENT001','02000345411'),('PARENT011','02000349679'),('PARENT005','02000350927'),('PARENT004','02000371918'),('PARENT02000','02000565656');
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
INSERT INTO `parents` VALUES ('PARENT001','PRNT001','Melicia','Bernardo','09196398316',1),('PARENT002','PRNT002','Eme','Siason','09615119118',1),('PARENT003','PRNT003','Jonalyn','Marcelo','09330680817',1),('PARENT004','PRNT004','Maribel','Sulit','09568281721',1),('PARENT005','PRNT005','Dariel','Siason','09267729272',1),('PARENT006','f4145eff-e8f5-4286-bfa4-90a2cbea05c3','','','',0),('PARENT007','6da53619-9d16-4920-8c2c-a813988a9c5c','Christine','Angeles','09191282739',0),('PARENT011','8bb1b248-0295-42b8-8d7b-0f7b83537c33','Cecille','Salvador','09196398319',0),('PARENT02000','8ea9175f-ce61-4c1b-aba0-1b1e2f5d8c74','Jonah','Magat','097382137872',0);
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
INSERT INTO `program_requirements_config` VALUES ('CFG-1783221381985-836','BSIT','X Ray',1,'2026-07-24',0),('CFG-1783231831143-366','BSBA','Drug Test',4,'2026-07-22',0),('CFG-1786101074333-109','BSIT','Medical Certificate',4,'2026-08-10',0),('CFG-1788767853795-196','BSIT','Hepa A',3,'2026-09-30',1),('CFG-1789724136273-304','BSHM','Hepa B',NULL,'2026-11-27',1),('CFG-1789724207620-530','BSIT','Hepa B',NULL,'2026-11-18',1);
/*!40000 ALTER TABLE `program_requirements_config` ENABLE KEYS */;
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
INSERT INTO `referral_request_services` VALUES ('REF-f5a86d77','SRV-031183e9'),('REF-1a95ec08','SRV-0ed79e0e'),('REF-f5a86d77','SRV-4428c2a3');
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
INSERT INTO `referral_slip_requests` VALUES ('REF-1a95ec08','02000257727','FAC-ed3a37fa','asthma attack','Completed','NURSE02000','2026-09-18 09:30:17','/uploads/REF-1a95ec08-1789723817212-233617702.pdf','2026-09-18 09:27:37'),('REF-f5a86d77','02000349679','FAC-915c0224','Requirements','Completed','NURSE02000','2026-09-13 15:26:01','/uploads/REF-f5a86d77-1789313161912-628647711.pdf','2026-09-13 15:25:10');
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
INSERT INTO `screening_schedule_participants` VALUES ('0186244a-27f4-4a53-b95b-52c4fa60ded3','ed619b42-a454-479e-89c7-6f186facec32','02000345411','PENDING',NULL,'2026-09-18 03:56:40'),('0214ec9f-2fbe-4996-abff-ecfe2c623699','ed619b42-a454-479e-89c7-6f186facec32','123456789','PENDING',NULL,'2026-09-18 03:56:40'),('0849c064-457b-4666-8a44-5658b7be15aa','ed619b42-a454-479e-89c7-6f186facec32','02000565656','PENDING',NULL,'2026-09-18 03:56:40'),('0a880732-0a17-4744-a0de-a47dfbf46440','6916bc69-9507-4c3f-9519-4b2123f5ebac','02000371918','PENDING',NULL,'2026-09-18 03:48:06'),('0cbf2846-5ba1-4aac-9b2a-87282f4d54fd','1dc0e18a-9561-412e-a393-1a1fd0ae71b6','02000257727','PENDING',NULL,'2026-09-15 05:00:53'),('0ce9e61e-3a95-4266-b068-a0d485e71c7f','1dc0e18a-9561-412e-a393-1a1fd0ae71b6','02000332211','PENDING',NULL,'2026-09-15 05:00:53'),('0ec8244f-63aa-44fe-82ee-3101413961f2','90302a92-1db5-4add-80d2-eb48105da1eb','02000120504','PENDING',NULL,'2026-09-15 10:23:12'),('112460bc-a0bc-4d8a-9395-02af32813dfc','079ce752-de63-4f50-ac5e-6364fbc5d770','02000120504','ABSENT',NULL,'2026-09-18 03:36:56'),('153afcf9-ec2b-4dd8-9b30-28bbb184b0bc','90302a92-1db5-4add-80d2-eb48105da1eb','02000345411','PRESENT','2026-09-15 10:23:36','2026-09-15 10:23:12'),('196ce305-f2ad-48ce-934b-b520cd266909','079ce752-de63-4f50-ac5e-6364fbc5d770','02000121416','ABSENT',NULL,'2026-09-18 03:36:56'),('1c01e811-ed01-4091-a3f1-806ce580baeb','079ce752-de63-4f50-ac5e-6364fbc5d770','02000371918','ABSENT',NULL,'2026-09-18 03:36:56'),('1ea65644-56e9-4215-9d35-3779660a495c','079ce752-de63-4f50-ac5e-6364fbc5d770','02000112233','ABSENT',NULL,'2026-09-18 03:36:56'),('262e3d50-2d08-4a0d-b17b-2aa2ac4bc312','1dc0e18a-9561-412e-a393-1a1fd0ae71b6','02000350927','PENDING',NULL,'2026-09-15 05:00:53'),('265c0dc6-e1b0-49ab-bf15-0f50a2fad025','ed619b42-a454-479e-89c7-6f186facec32','02000257727','PENDING',NULL,'2026-09-18 03:56:40'),('2d609ca5-1428-4a2f-b609-7f7f7cd11809','079ce752-de63-4f50-ac5e-6364fbc5d770','02000345411','ABSENT',NULL,'2026-09-18 03:36:56'),('2fd39018-0fac-4d31-88fe-9da055a1d15a','079ce752-de63-4f50-ac5e-6364fbc5d770','02000350927','ABSENT',NULL,'2026-09-18 03:36:56'),('44ab2b5b-5472-45dd-894a-b7b18b234592','ed619b42-a454-479e-89c7-6f186facec32','02000332211','PENDING',NULL,'2026-09-18 03:56:40'),('4b9e841a-d6fa-4bbd-bd48-1b74fd926e1e','90302a92-1db5-4add-80d2-eb48105da1eb','02000349679','PENDING',NULL,'2026-09-15 10:23:12'),('4ca84243-8ca7-4731-ae15-843140ca8d19','079ce752-de63-4f50-ac5e-6364fbc5d770','123456789','ABSENT',NULL,'2026-09-18 03:36:56'),('517bac32-e1f8-49cc-8f15-4568060b2ee7','6916bc69-9507-4c3f-9519-4b2123f5ebac','02000257727','PENDING',NULL,'2026-09-18 03:48:06'),('5a438149-4d80-44ac-9fed-d8bc28ba47f3','6916bc69-9507-4c3f-9519-4b2123f5ebac','02000565656','PENDING',NULL,'2026-09-18 03:48:06'),('5ae99852-5ce3-4a72-9ca2-a6588ccc75ce','7261367e-1d4b-45da-a392-63dae2539dd0','02000257727','PRESENT','2026-09-18 09:50:15','2026-09-18 09:49:28'),('5b192a3a-23fe-411a-9531-6af910b89699','ed619b42-a454-479e-89c7-6f186facec32','02000112233','PENDING',NULL,'2026-09-18 03:56:40'),('63edd8b7-6e71-43ba-a60d-abd5408032e3','6916bc69-9507-4c3f-9519-4b2123f5ebac','02000120504','PENDING',NULL,'2026-09-18 03:48:06'),('6b0c7463-b931-41f5-a9c0-292f5b44f1e2','90302a92-1db5-4add-80d2-eb48105da1eb','02000371918','PENDING',NULL,'2026-09-15 10:23:12'),('70127de8-b46b-4bc3-8883-5d3fb3926a70','1dc0e18a-9561-412e-a393-1a1fd0ae71b6','02000121416','PENDING',NULL,'2026-09-15 05:00:53'),('74ec41a0-6c40-4c05-82e5-9005cc73df4d','6916bc69-9507-4c3f-9519-4b2123f5ebac','02000332211','PENDING',NULL,'2026-09-18 03:48:06'),('7d9e4d8e-e16f-46b9-9cc1-573d71210377','ed619b42-a454-479e-89c7-6f186facec32','02000371918','PENDING',NULL,'2026-09-18 03:56:40'),('832d3fd2-ecb0-49d4-888a-917ad13d2843','ed619b42-a454-479e-89c7-6f186facec32','02000349679','PENDING',NULL,'2026-09-18 03:56:40'),('85171001-4260-4f20-ac0c-f8c8d905315c','90302a92-1db5-4add-80d2-eb48105da1eb','02000121416','PENDING',NULL,'2026-09-15 10:23:12'),('8529bd7f-7ace-49ab-ad04-4201499624d4','ed619b42-a454-479e-89c7-6f186facec32','02000120504','PENDING',NULL,'2026-09-18 03:56:40'),('8c80a3f5-1abc-44c8-94cb-4a27f0e1e2d8','6916bc69-9507-4c3f-9519-4b2123f5ebac','02000121416','PENDING',NULL,'2026-09-18 03:48:06'),('8df25d03-dc6e-4566-a4d4-5a79887387f0','90302a92-1db5-4add-80d2-eb48105da1eb','02000565656','PENDING',NULL,'2026-09-15 10:23:12'),('95d7757e-7ee9-4d4b-a438-8cde4ad814f1','ed619b42-a454-479e-89c7-6f186facec32','02000001133','PENDING',NULL,'2026-09-18 03:56:40'),('9645e35e-a9dd-412f-9a2c-af3974c1a2e4','90302a92-1db5-4add-80d2-eb48105da1eb','02000350927','PENDING',NULL,'2026-09-15 10:23:12'),('98e4ee9e-cebc-4676-93f4-0ae66e768248','6916bc69-9507-4c3f-9519-4b2123f5ebac','02000350927','PENDING',NULL,'2026-09-18 03:48:06'),('9c031034-b5d5-48a5-b65a-60dfca8e2769','6916bc69-9507-4c3f-9519-4b2123f5ebac','02000112233','PENDING',NULL,'2026-09-18 03:48:06'),('a272ddb2-e5b8-4e61-b537-9777e42d7af3','90302a92-1db5-4add-80d2-eb48105da1eb','02000332211','PENDING',NULL,'2026-09-15 10:23:12'),('a360713c-c8f8-4105-9188-f77448b55f66','079ce752-de63-4f50-ac5e-6364fbc5d770','02000349679','ABSENT',NULL,'2026-09-18 03:36:56'),('a5f1678d-b852-4817-a370-310710a0edec','ed619b42-a454-479e-89c7-6f186facec32','02000121416','PENDING',NULL,'2026-09-18 03:56:40'),('aa021026-b061-440b-9f54-2595449143b7','079ce752-de63-4f50-ac5e-6364fbc5d770','02000001133','ABSENT',NULL,'2026-09-18 03:36:56'),('af5c4777-c09e-43bb-b264-98e0d08aeea6','1dc0e18a-9561-412e-a393-1a1fd0ae71b6','02000120504','PENDING',NULL,'2026-09-15 05:00:53'),('b021b875-c62b-4d95-9863-f8cc95b319e9','6916bc69-9507-4c3f-9519-4b2123f5ebac','123456789','PENDING',NULL,'2026-09-18 03:48:06'),('b5c97935-0e14-4a97-bae3-944a17bd944c','079ce752-de63-4f50-ac5e-6364fbc5d770','02000565656','ABSENT',NULL,'2026-09-18 03:36:56'),('bb884353-0403-4187-b7a4-2ae122b8acfe','079ce752-de63-4f50-ac5e-6364fbc5d770','02000257727','ABSENT',NULL,'2026-09-18 03:36:56'),('c0910a0c-96e9-41e6-bbd3-7c3dcf3ce1ee','1dc0e18a-9561-412e-a393-1a1fd0ae71b6','02000371918','PENDING',NULL,'2026-09-15 05:00:53'),('c5173351-87b7-4be9-a124-8b0b4f21462e','90302a92-1db5-4add-80d2-eb48105da1eb','123456789','PENDING',NULL,'2026-09-15 10:23:12'),('c7c6733e-86a6-469e-b549-2a05ff9075e3','6916bc69-9507-4c3f-9519-4b2123f5ebac','02000345411','PENDING',NULL,'2026-09-18 03:48:06'),('cb595f50-3b87-44f7-beba-ffd0123ab3e7','6916bc69-9507-4c3f-9519-4b2123f5ebac','02000349679','PENDING',NULL,'2026-09-18 03:48:06'),('cc8212a5-786b-4e0e-b5d7-59f6aa341f08','90302a92-1db5-4add-80d2-eb48105da1eb','02000257727','PENDING',NULL,'2026-09-15 10:23:12'),('cd498c68-680c-4a1f-8193-224f4b26c7d9','1dc0e18a-9561-412e-a393-1a1fd0ae71b6','02000345411','PRESENT','2026-09-15 05:08:55','2026-09-15 05:00:53'),('ce429e10-0f69-4304-957e-8fc66ff2deb9','90302a92-1db5-4add-80d2-eb48105da1eb','02000112233','PENDING',NULL,'2026-09-15 10:23:12'),('d62dfd40-b105-410d-8659-7534b29f1fd4','90302a92-1db5-4add-80d2-eb48105da1eb','02000001133','PENDING',NULL,'2026-09-15 10:23:12'),('dd052d51-9911-43a0-acf7-6844937abf9e','1dc0e18a-9561-412e-a393-1a1fd0ae71b6','02000001133','PENDING',NULL,'2026-09-15 05:00:53'),('e5d90ce5-27c4-47a7-aa71-74d93f5fcc36','6916bc69-9507-4c3f-9519-4b2123f5ebac','02000001133','PENDING',NULL,'2026-09-18 03:48:06'),('e63dd3ce-ed95-4016-9676-6f4346809fd1','1dc0e18a-9561-412e-a393-1a1fd0ae71b6','02000349679','PENDING',NULL,'2026-09-15 05:00:53'),('e8db3eff-5f80-46b8-bb15-5002f334d585','ed619b42-a454-479e-89c7-6f186facec32','02000350927','PENDING',NULL,'2026-09-18 03:56:40'),('ed4a7dfb-1c85-43c3-83f8-cc672582cb2b','079ce752-de63-4f50-ac5e-6364fbc5d770','02000332211','ABSENT',NULL,'2026-09-18 03:36:56'),('ee39bc43-4097-4754-80a8-46c3bded1883','1dc0e18a-9561-412e-a393-1a1fd0ae71b6','02000112233','PENDING',NULL,'2026-09-15 05:00:53'),('f2707c3c-69d3-4cdf-8b25-542520b871b9','1dc0e18a-9561-412e-a393-1a1fd0ae71b6','02000565656','PENDING',NULL,'2026-09-15 05:00:53'),('f84a553d-ef50-4163-8e75-30f44fa8dd35','1dc0e18a-9561-412e-a393-1a1fd0ae71b6','123456789','PENDING',NULL,'2026-09-15 05:00:53');
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
INSERT INTO `screening_schedules` VALUES ('079ce752-de63-4f50-ac5e-6364fbc5d770','Annual Dental Cleaning',NULL,NULL,NULL,'2026-09-18','00:36:00','01:36:00',NULL,'BMI'),('1dc0e18a-9561-412e-a393-1a1fd0ae71b6','Annual Dental Screening',NULL,NULL,NULL,'2026-09-15','13:01:00','13:05:00',NULL,'Dental'),('6916bc69-9507-4c3f-9519-4b2123f5ebac','Annual BMI part 2',NULL,NULL,NULL,'2026-09-18','00:48:00','01:48:00',NULL,'BMI'),('7261367e-1d4b-45da-a392-63dae2539dd0','Annual Checkup',NULL,NULL,NULL,'2026-09-18','17:48:00','21:48:00',NULL,'BMI'),('87d7f704-2ffb-463d-aea6-568ed8142c5f','Annual BMI',NULL,NULL,NULL,'2026-08-03','08:00:00','12:00:00',NULL,'BMI'),('90302a92-1db5-4add-80d2-eb48105da1eb','Annual Vision Check up',NULL,NULL,NULL,'2026-09-15','18:22:00','18:50:00',NULL,'Vision'),('ed619b42-a454-479e-89c7-6f186facec32','Test',NULL,NULL,NULL,'2026-09-18','12:00:00','13:00:00',NULL,'BMI'),('eee8cc28-c236-4935-8ddb-a1af96876f52','Annual BMI',NULL,NULL,NULL,'2026-08-07','10:00:00','18:00:00',NULL,'BMI'),('f07eed8d-ec2f-4bff-a55c-d2c18224c54c','Annual BMI','BSIT',4,'B','2026-08-30','15:42:00','17:05:00',NULL,'BMI');
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
INSERT INTO `student_deadline_overrides` VALUES ('065c1947-7838-11f1-8d81-60ff9e91bd8f','02000120504','CFG-1783221381985-836','2026-07-21',0),('0c27c0b8-af93-11f1-a50c-9848a14ea245','02000349679','CFG-1783221381985-836','2026-07-24',1),('17911a64-a37d-11f1-aa13-7234afcf04a2','02000565656','CFG-1783221381985-836','2026-08-29',1),('215e89ed-9251-11f1-b34f-b898cf46efdd','02000257727','CFG-1786101074333-109','2026-08-10',0),('524ec7b7-7838-11f1-8d81-60ff9e91bd8f','02000001133','CFG-1783231831143-366','2026-12-17',0),('a2c0a4e9-ae75-11f1-a50c-9848a14ea245','02000345411','CFG-1788767853795-196','2026-09-30',1);
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
INSERT INTO `student_requirement_submissions` VALUES ('0b06564f-7917-11f1-a1e0-60ff9e91bd8f','02000120504','Special Requirements ito',NULL,'Not Submitted',0,'',NULL,NULL),('3a00592e-7838-11f1-8d81-60ff9e91bd8f','02000001133','Drug Test',NULL,'Pending',0,'',NULL,NULL),('3d4b233f-ae72-11f1-a50c-9848a14ea245','02000349679','X Ray','http://localhost:3001/uploads/02000349679-1789318197909-302341568.png','Submitted Late',1,'','2026-09-13 16:49:57',NULL),('402b169c-7821-11f1-8d81-60ff9e91bd8f','02000120504','Drug Test',NULL,'Pending',0,'magpasa kana',NULL,NULL),('426f4c9a-a37a-11f1-aa13-7234afcf04a2','02000565656','X Ray',NULL,'Pending',0,'',NULL,NULL),('530a8213-7923-11f1-a1e0-60ff9e91bd8f','02000345411','Maging Mayaman','http://localhost:3001/uploads/02000345411-1783343928873-368506398.jpg','Completed',0,'Malabo','2026-07-06 13:18:48',NULL),('77f10cd9-b344-11f1-9c8f-3b0d8d9c662a','02000112233','Hepa B',NULL,'Pending',0,'',NULL,NULL),('77f111f1-b344-11f1-9c8f-3b0d8d9c662a','02000120504','Hepa B',NULL,'Pending',0,'',NULL,NULL),('77f11287-b344-11f1-9c8f-3b0d8d9c662a','02000257727','Hepa B',NULL,'Pending',0,'',NULL,NULL),('77f113f9-b344-11f1-9c8f-3b0d8d9c662a','02000332211','Hepa B',NULL,'Pending',0,'',NULL,NULL),('77f1143f-b344-11f1-9c8f-3b0d8d9c662a','02000345411','Hepa B',NULL,'Pending',0,'',NULL,NULL),('77f11478-b344-11f1-9c8f-3b0d8d9c662a','02000349679','Hepa B',NULL,'Pending',0,'',NULL,NULL),('77f114aa-b344-11f1-9c8f-3b0d8d9c662a','02000350927','Hepa B',NULL,'Pending',0,'',NULL,NULL),('77f114d9-b344-11f1-9c8f-3b0d8d9c662a','02000371918','Hepa B',NULL,'Pending',0,'',NULL,NULL),('77f11510-b344-11f1-9c8f-3b0d8d9c662a','02000565656','Hepa B',NULL,'Pending',0,'',NULL,NULL),('77f1154d-b344-11f1-9c8f-3b0d8d9c662a','123456789','Hepa B',NULL,'Pending',0,'',NULL,NULL),('a0c45d2d-aa93-11f1-b797-e58f1fec4388','02000112233','Medical Certificate',NULL,'Not Submitted',0,NULL,NULL,NULL),('ab1fd0fe-af8c-11f1-a50c-9848a14ea245','02000349679','Drug Test','http://localhost:3001/uploads/02000349679-1789315448388-245292072.png','Completed',0,'','2026-09-13 16:04:08',NULL),('b43d1561-9250-11f1-b34f-b898cf46efdd','02000257727','Medical Certificate','http://localhost:3001/uploads/02000257727-1786101152931-84599543.png','Completed',0,'','2026-08-07 11:12:32',NULL),('c8a6cfc9-aa91-11f1-b797-e58f1fec4388','02000120504','Hepa A',NULL,'Pending',0,'',NULL,NULL),('c8a6e54a-aa91-11f1-b797-e58f1fec4388','02000565656','Hepa A',NULL,'Pending',0,'',NULL,NULL),('c8a6e66a-aa91-11f1-b797-e58f1fec4388','123456789','Hepa A',NULL,'Pending',0,'',NULL,NULL),('e5d0856c-781f-11f1-8d81-60ff9e91bd8f','02000120504','X Ray','http://localhost:3001/uploads/02000120504-1783484532507-891345005.png','Completed',0,'','2026-07-08 04:22:12',NULL),('e8509099-aa92-11f1-b797-e58f1fec4388','02000345411','Hepa A','http://localhost:3001/uploads/02000345411-1788768336368-296409805.jpg','Completed',0,'','2026-09-07 08:05:36',NULL);
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
INSERT INTO `student_special_requirements` VALUES ('02000120504','Drug Test','2026-07-15',1,'NURSE02000','2026-07-05 03:26:03'),('02000120504','Special Requirements ito','2026-07-15',0,'NURSE02000','2026-07-06 08:45:30'),('02000345411','Maging Mayaman','2026-07-07',1,'NURSE02000','2026-07-06 10:13:24'),('02000349679','Drug Test','2026-09-18',0,'NURSE02000','2026-09-13 16:03:32');
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
INSERT INTO `students` VALUES ('02000001133','STDNT001133','Alberto','Siason','BSBA',4,'B'),('02000112233','STDNT112233','John','Doe','BSIT',4,'B'),('02000120504','STDNT120504','Mico','Bernardo','BSIT',1,'A'),('02000121416','f95f98e6-f4ec-4a55-8c86-d56c044500c9','Sofia','Angeles','TM',1,'A'),('02000257727','STDNT257727','Clark Ken','Marcelo','BSIT',4,'B'),('02000332211','STDNT332211','Lebron','James','BSIT',4,'B'),('02000345411','STDNT345411','Yahweh','Bernardo','BSIT',3,'B'),('02000349679','d806dd6e-bd0d-4820-8df1-0c40ae94dca0','John Wilson','Salvador','BSIT',1,'B'),('02000350927','STDNT350927','Albert','Siason','BSIT',4,'B'),('02000371918','STDNT371918','Wilson','Sulit','BSIT',4,'B'),('02000565656','cd890b6a-1dc8-4ee3-8247-7e4e138a32a5','Kier','Magat','BSIT',1,'B'),('123456789','a406d9f4-2525-4a26-af5a-5003dec47f67','trebla','nosais','BSIT',1,'BSIT-A');
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
INSERT INTO `users` VALUES ('6da53619-9d16-4920-8c2c-a813988a9c5c','angeles.parent@baliuag.sti.edu.ph','Angeles_123','PRNT',1,'2026-08-10 10:56:13'),('8bb1b248-0295-42b8-8d7b-0f7b83537c33','salvador.parent@baliuag.sti.edu.ph','123','PRNT',1,'2026-09-12 06:04:42'),('8ea9175f-ce61-4c1b-aba0-1b1e2f5d8c74','magat.parent@baliuag.sti.edu.ph','Magat_123','PRNT',1,'2026-08-29 07:15:02'),('a406d9f4-2525-4a26-af5a-5003dec47f67','treblanosais','student123','STDNT',1,'2026-08-22 06:07:39'),('ADMN02000','admin.02000@baliuag.sti.edu.ph','Admin_123','ADMN',1,'2026-08-08 09:51:38'),('cd890b6a-1dc8-4ee3-8247-7e4e138a32a5','kier.565656@baliuag.sti.edu.ph','Kier_123','STDNT',1,'2026-08-29 07:15:02'),('d806dd6e-bd0d-4820-8df1-0c40ae94dca0','salvador.349679@baliuag.sti.edu.ph','Salvador_123','STDNT',1,'2026-09-12 06:04:42'),('f4145eff-e8f5-4286-bfa4-90a2cbea05c3','doe.parent@baliuag.sti.edu.ph','123','PRNT',1,'2026-08-10 10:21:29'),('f95f98e6-f4ec-4a55-8c86-d56c044500c9','angeles.121416@baliuag.sti.edu.ph','123','STDNT',1,'2026-08-10 10:56:13'),('NRS02000','nurse.02000@baliuag.sti.edu.ph','Nurse_123','NRS',1,'2026-06-21 11:22:08'),('PRNT001','bernardo.parent@baliuag.sti.edu.ph','Bernardo_123','PRNT',1,'2026-06-21 14:15:48'),('PRNT002','eme.parent@baliuag.sti.edu.ph','123','PRNT',1,'2026-08-04 12:01:36'),('PRNT003','marcelo.parent@baliuag.sti.edu.ph','123','PRNT',1,'2026-08-07 12:00:07'),('PRNT004','sulit.parent@baliuag.sti.edu.ph','123','PRNT',1,'2026-08-07 12:00:07'),('PRNT005','siason.parent@baliuag.sti.edu.ph','123','PRNT',1,'2026-08-07 12:00:07'),('STDNT001133','siason.001133@baliuag.sti.edu.ph','123','STDNT',1,'2026-07-02 09:28:25'),('STDNT112233','doe.112233@baliuag.sti.edu.ph','123','STDNT',0,'2026-08-07 14:07:14'),('STDNT120504','bernardo.120504@baliuag.sti.edu.ph','123','STDNT',1,'2026-06-21 14:18:08'),('STDNT257727','marcelo.257727@baliuag.sti.edu.ph','Clark_123','STDNT',1,'2026-08-07 10:52:16'),('STDNT332211','james.332211@baliuag.sti.edu.ph','123','STDNT',1,'2026-08-08 04:54:36'),('STDNT345411','bernardo.345411@baliuag.sti.edu.ph','Yahweh_123','STDNT',1,'2026-06-19 08:30:53'),('STDNT350927','siason.350927@baliuag.sti.edu.ph','Albert@123','STDNT',1,'2026-08-07 11:43:15'),('STDNT371918','sulit.371918@baliuag.sti.edu.ph','Ws@02132005','STDNT',1,'2026-08-07 11:23:56');
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

-- Dump completed on 2026-09-18 21:55:49
