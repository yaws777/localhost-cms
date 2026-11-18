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
  `folder_id` int DEFAULT NULL,
  PRIMARY KEY (`screening_schedule_id`),
  KEY `target_program_id` (`target_program_id`),
  KEY `idx_screening_school_year` (`school_year`),
  KEY `idx_screening_folder` (`folder_id`),
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
INSERT INTO `screening_schedules` VALUES ('HSSCHED-110226003','Annual BMI','BSIT',4,'B','2026-11-02','01:50:00','22:31:00','Bring ID','BMI','Scheduled',NULL,NULL,NULL,'2026-11-02 23:59:20',1121,'03:50:00','2026-2027',NULL),('HSSCHED-110526001','Annual BMI','BSTM',1,'A','2026-11-06','08:00:00','10:00:00','Bring ID','BMI','Scheduled',NULL,NULL,NULL,NULL,0,NULL,'2026-2027',NULL),('HSSCHED-111426001','Sport Fest 2026 - 2027 Player',NULL,NULL,NULL,'2026-11-14','10:33:00','11:33:00',NULL,'Vital Signs','Scheduled',NULL,NULL,NULL,NULL,0,NULL,'2026-2027',1),('HSSCHED-111626001','Baciprisa Player Screening',NULL,NULL,NULL,'2026-11-16','23:46:00','23:55:00',NULL,'BMI & Vital Signs','Scheduled',NULL,NULL,NULL,NULL,0,NULL,'2026-2027',2),('HSSCHED-111726001','Sport Fest 2026 - 2027 Player',NULL,NULL,NULL,'2026-11-24','08:00:00','11:00:00',NULL,'BMI','Scheduled',NULL,NULL,NULL,NULL,0,NULL,'2026-2027',1),('HSSCHED-111726002','Make-up: Annual BMI','BSIT',4,'B','2026-11-18','01:50:00','22:31:00',NULL,'BMI','Scheduled',NULL,NULL,'HSSCHED-110226003',NULL,0,NULL,'2026-2027',NULL);
/*!40000 ALTER TABLE `screening_schedules` ENABLE KEYS */;
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
INSERT INTO `screening_schedule_participants` VALUES ('049570d6-6419-4723-8907-c915ca98aed6','HSSCHED-111726001','02000332211','PENDING',NULL,'2026-11-16 20:53:16',NULL,NULL),('05232beb-83de-4d77-bb0d-699d8290047b','HSSCHED-111726001','02000889900','PENDING',NULL,'2026-11-16 20:53:16',NULL,NULL),('05e4f2f6-02b5-427f-ae34-f233c45d07ab','HSSCHED-111726001','02000347082','PENDING',NULL,'2026-11-16 20:53:16',NULL,NULL),('07053e39-7638-4ea1-9cd3-fc99557d3fd4','HSSCHED-110226003','02000371918','ABSENT',NULL,'2026-11-01 17:18:38',NULL,NULL),('07371d3b-d295-4c14-adae-fde010be04b6','HSSCHED-111726001','02000336688','PENDING',NULL,'2026-11-16 20:53:16',NULL,NULL),('09caab70-2dbe-40a8-a545-33d6f807019f','HSSCHED-110226003','02000332211','ABSENT',NULL,'2026-11-01 17:18:38',NULL,NULL),('0a795fe4-9220-4f99-ac55-ddeaa53c1032','HSSCHED-111726001','02000354315','PENDING',NULL,'2026-11-16 20:53:16',NULL,NULL),('0b3aa660-ddc6-48f5-8a89-7266c325b26a','HSSCHED-111426001','02000416698','ABSENT',NULL,'2026-11-14 02:32:17',NULL,NULL),('0dfd15e5-f365-4a90-9dd8-00b5644fee8f','HSSCHED-111726001','02000120504','PENDING',NULL,'2026-11-16 20:53:16',NULL,NULL),('0fc29394-63d3-44b5-9f7c-bcec352bbce8','HSSCHED-111726001','02000373183','PENDING',NULL,'2026-11-16 20:53:16',NULL,NULL),('131f3b92-45e1-4bff-873b-e5fca936a10f','HSSCHED-110226003','02000362937','ABSENT',NULL,'2026-11-01 17:18:38',NULL,NULL),('15996e27-7250-4ff1-8087-dbe96bb12af2','HSSCHED-111726002','02000434549','PENDING',NULL,'2026-11-16 21:51:38',NULL,NULL),('1773744f-8f2f-4887-907e-f0a373cd58ce','HSSCHED-110226003','02000369629','ABSENT',NULL,'2026-11-01 17:18:38',NULL,NULL),('17cce4d5-9eed-4187-b75b-44e90a4eeaf9','HSSCHED-111726001','02000386764','PENDING',NULL,'2026-11-16 20:53:16',NULL,NULL),('19632a10-318f-498c-9040-798d73588491','HSSCHED-111726001','02000347849','PENDING',NULL,'2026-11-16 20:53:16',NULL,NULL),('1b8e8aac-48a4-4325-bb27-914356148942','HSSCHED-111726001','02000356857','PENDING',NULL,'2026-11-16 20:53:16',NULL,NULL),('202e84f8-8e42-4138-b978-99a9ebc58ff4','HSSCHED-110526001','02000236949','ABSENT',NULL,'2026-11-04 21:18:02',NULL,NULL),('219a4388-3fd5-4486-88fe-9675c613c193','HSSCHED-111726001','023456789','PENDING',NULL,'2026-11-16 20:53:16',NULL,NULL),('241e4741-8bd3-4796-a984-a9e4a4386372','HSSCHED-111426001','02000432018','ABSENT',NULL,'2026-11-14 02:32:17',NULL,NULL),('2660f414-bb02-49d6-8e2f-9a31e105154e','HSSCHED-110226003','02000325758','PRESENT','2026-11-02 06:21:55','2026-11-01 17:18:38',NULL,NULL),('273ec5f0-8d9f-480a-adcd-e8c9b50c0779','HSSCHED-110226003','02000372405','PRESENT','2026-11-01 17:58:26','2026-11-01 17:18:38',NULL,NULL),('29dfcd57-d000-4ca0-b2d6-39af085d337c','HSSCHED-111726001','02000416698','PENDING',NULL,'2026-11-16 20:53:16',NULL,NULL),('2cc49504-4ead-4edd-911d-d5e6fd1a61a6','HSSCHED-111726001','02000867323','PENDING',NULL,'2026-11-16 20:53:16',NULL,NULL),('32398d53-ecd0-4c7d-a867-271857dac7d9','HSSCHED-111726001','02000717171','PENDING',NULL,'2026-11-16 20:53:16',NULL,NULL),('3b63f306-f06e-451f-9df5-6c4e8f091da5','HSSCHED-110226003','02000373183','ABSENT',NULL,'2026-11-01 17:18:38',NULL,NULL),('3ff84046-2005-4cf5-bfa9-0e32adfcc5ef','HSSCHED-111726001','02000213546','PENDING',NULL,'2026-11-16 20:53:16',NULL,NULL),('3ffbd71b-93e0-4f70-a056-93a1c70cc674','HSSCHED-111726001','02000371149','PENDING',NULL,'2026-11-16 20:53:16',NULL,NULL),('418a8b11-71b7-4983-82a1-50d6dedf067c','HSSCHED-111726001','02000557799','PENDING',NULL,'2026-11-16 20:53:16',NULL,NULL),('441f1eb0-6d96-4a0a-ac1e-793ef529da99','HSSCHED-111726001','02000362937','PENDING',NULL,'2026-11-16 20:53:16',NULL,NULL),('47d0619e-337d-403e-8d2b-529f2c1a4652','HSSCHED-111726001','02000332380','PENDING',NULL,'2026-11-16 20:53:16',NULL,NULL),('4f5decd8-1fbf-4b83-897b-b1c6f0409f69','HSSCHED-111726002','02000338958','PENDING',NULL,'2026-11-16 21:51:38',NULL,NULL),('522eed21-e960-4545-9e81-4b0ac9e0e716','HSSCHED-110226003','02000354315','PRESENT','2026-11-01 18:26:05','2026-11-01 17:18:38',NULL,NULL),('54d8e6cb-6a1f-40a6-91d3-df4a0c1762e6','HSSCHED-111726001','02000365964','PENDING',NULL,'2026-11-16 20:53:16',NULL,NULL),('588d9633-0d6b-49ee-9c6d-595db2e8172f','HSSCHED-111726001','02000565721','PENDING',NULL,'2026-11-16 20:53:16',NULL,NULL),('5a517a0c-e47d-48fe-a32b-e87148fc84d7','HSSCHED-111726001','02000384574','PENDING',NULL,'2026-11-16 20:53:16',NULL,NULL),('5a6db729-a8e7-4b4a-b2bc-8b377407ff25','HSSCHED-110226003','02000112233','PRESENT','2026-11-02 06:22:21','2026-11-01 17:18:38',NULL,NULL),('5c1bc08f-a4ff-416b-a9da-02f2f91df3cc','HSSCHED-111726001','02000371918','PENDING',NULL,'2026-11-16 20:53:16',NULL,NULL),('60faad7f-6b1f-4a91-ab8e-10ad42104b74','HSSCHED-111726001','02000426327','PENDING',NULL,'2026-11-16 20:53:16',NULL,NULL),('6100a486-5875-4d44-b353-cfaac5291bc7','HSSCHED-111726002','02000369629','PENDING',NULL,'2026-11-16 21:51:38',NULL,NULL),('6243055f-5000-4763-ab6a-397c43812b7b','HSSCHED-111726001','02000372405','PENDING',NULL,'2026-11-16 20:53:16',NULL,NULL),('646e535b-e25a-40f8-917a-c7d38aef7c1a','HSSCHED-110226003','02000350927','ABSENT',NULL,'2026-11-01 17:18:38',NULL,NULL),('6a4cd454-4bcf-431e-9950-446d59b0354a','HSSCHED-111726001','0200038490','PENDING',NULL,'2026-11-16 20:53:16',NULL,NULL),('6ae23609-31c6-43f0-89cc-bc903ec5719e','HSSCHED-111726002','02000365964','PENDING',NULL,'2026-11-16 21:51:38',NULL,NULL),('6b3c62b6-bf02-4178-93e9-abeb7a9c2b9b','HSSCHED-111726001','02000258418','PENDING',NULL,'2026-11-16 20:53:16',NULL,NULL),('6bb879a1-5583-4564-a1aa-201c3a329a4a','HSSCHED-110226003','02000338958','ABSENT',NULL,'2026-11-01 17:18:38',NULL,NULL),('6f62cc52-0ab5-4b6e-9b3b-197f4f03971f','HSSCHED-111726001','02567890','PENDING',NULL,'2026-11-16 20:53:16',NULL,NULL),('710e75ee-a34e-4b12-88a5-2b4d58f6c2bd','HSSCHED-111726001','02000372990','PENDING',NULL,'2026-11-16 20:53:16',NULL,NULL),('739bb54f-4910-4d01-b713-b56076abf533','HSSCHED-111726001','02000434549','PENDING',NULL,'2026-11-16 20:53:16',NULL,NULL),('762935a0-1284-444d-91b6-c7416387006f','HSSCHED-111626001','02000354315','ABSENT',NULL,'2026-11-16 15:45:41',NULL,NULL),('7a67783c-c5f4-45e1-af04-cb052fc4dc32','HSSCHED-111726001','02000384575','PENDING',NULL,'2026-11-16 20:53:16',NULL,NULL),('7d5fe8af-09df-4dd0-b1ae-8a7682a74441','HSSCHED-111726001','02000369629','PENDING',NULL,'2026-11-16 20:53:16',NULL,NULL),('7ebff360-4ad0-4348-bb8c-481a752b0be4','HSSCHED-110226003','02000347082','PRESENT','2026-11-01 17:52:46','2026-11-01 17:18:38',NULL,NULL),('7ef07697-ae87-41d4-886a-a96ca6906d00','HSSCHED-111726002','02000254206','PENDING',NULL,'2026-11-16 21:51:38',NULL,NULL),('84d06c40-6dd7-4a88-a33d-fb1103748a72','HSSCHED-110226003','02000257727','ABSENT',NULL,'2026-11-01 17:18:38',NULL,NULL),('879fc289-7787-43c0-9397-1420d4e50725','HSSCHED-111726001','123456789','PENDING',NULL,'2026-11-16 20:53:16',NULL,NULL),('87e3d605-d12d-47d5-b592-10ba0f495783','HSSCHED-111726001','02000272341','PENDING',NULL,'2026-11-16 20:53:16',NULL,NULL),('892421d4-981c-45e5-a64e-8b52388c7312','HSSCHED-110226003','02000368651','PRESENT','2026-11-01 17:54:29','2026-11-01 17:18:38',NULL,NULL),('8a159c98-b5ef-453a-b7b5-1ca8a2cb7008','HSSCHED-110226003','02000371063','PRESENT','2026-11-01 17:51:38','2026-11-01 17:18:38',NULL,NULL),('90f8fe4b-84db-4fb7-b681-72529a832d5b','HSSCHED-110226003','02000374507','PRESENT','2026-11-02 15:05:26','2026-11-01 17:18:38',NULL,NULL),('91889fcd-1a0e-4902-a54a-c1bbb9985cd9','HSSCHED-111726002','02000361665','PENDING',NULL,'2026-11-16 21:51:38',NULL,NULL),('929a6fa6-9b6d-49da-a0e2-066e199ab320','HSSCHED-111626001','02000371063','PRESENT','2026-11-16 15:46:35','2026-11-16 15:45:41',NULL,NULL),('979c6062-1bfb-4f80-ac5f-986ed1d72762','HSSCHED-111726001','02000254206','PENDING',NULL,'2026-11-16 20:53:16',NULL,NULL),('9bc11c2d-a233-4aac-98b1-4e2b98168ba9','HSSCHED-110226003','02000249174','ABSENT',NULL,'2026-11-01 17:18:38',NULL,NULL),('9d0e00c0-0db5-490f-9d6d-b132922db91c','HSSCHED-111726001','02000539406','PENDING',NULL,'2026-11-16 20:53:16',NULL,NULL),('a04f4be1-9fcd-4cee-9291-8821fef4e947','HSSCHED-110226003','02000272341','ABSENT',NULL,'2026-11-01 17:18:38',NULL,NULL),('a0cc41d4-467f-4e24-81c6-4a3ee83ea9d0','HSSCHED-110226003','02000365964','ABSENT',NULL,'2026-11-01 17:18:38',NULL,NULL),('a2722075-5ffe-49a7-811b-f048bf712d8f','HSSCHED-111726002','02000371149','PENDING',NULL,'2026-11-16 21:51:38',NULL,NULL),('a3a12087-c034-4a80-9104-9c7d0ec743df','HSSCHED-111726001','02000368651','PENDING',NULL,'2026-11-16 20:53:16',NULL,NULL),('a69e234e-0db5-44d6-93e5-03e130017661','HSSCHED-111726001','02000548128','PENDING',NULL,'2026-11-16 20:53:16',NULL,NULL),('a7b1c253-ecf1-4759-99ef-fe5b9c9b6eda','HSSCHED-111726002','02000373183','PENDING',NULL,'2026-11-16 21:51:38',NULL,NULL),('a984d165-acba-4a6e-9991-2e58afb17f4f','HSSCHED-111726001','02000542435','PENDING',NULL,'2026-11-16 20:53:16',NULL,NULL),('ad172a4c-3402-4cb9-9b7c-cf99aba05d3a','HSSCHED-111726002','02000362937','PENDING',NULL,'2026-11-16 21:51:38',NULL,NULL),('b19b0e17-70e5-43b2-8fe4-115223e71e9d','HSSCHED-111726001','02000361665','PENDING',NULL,'2026-11-16 20:53:16',NULL,NULL),('b4198adf-02d9-4fba-9017-a8f184bd5652','HSSCHED-110226003','02000356857','PRESENT','2026-11-01 17:54:07','2026-11-01 17:18:38',NULL,NULL),('b5e39aec-c234-42a8-955c-5d23b03b90ba','HSSCHED-111626001','02000368651','ABSENT',NULL,'2026-11-16 15:45:41',NULL,NULL),('b803ef5e-569b-4109-bc3d-43a7b5dc5af4','HSSCHED-110226003','02000254206','ABSENT',NULL,'2026-11-01 17:18:38',NULL,NULL),('ba65baf9-3dfb-483e-b60a-55a389dac4b3','HSSCHED-111726002','02000272341','PENDING',NULL,'2026-11-16 21:51:38',NULL,NULL),('bab2f054-87ef-41bc-acfa-dd01ab40d684','HSSCHED-110226003','02000361665','ABSENT',NULL,'2026-11-01 17:18:38',NULL,NULL),('bb21f1da-13c3-4677-8ef7-9e2bd9a29019','HSSCHED-110226003','02000371149','ABSENT',NULL,'2026-11-01 17:18:38',NULL,NULL),('bd15224e-4f0e-4373-af5f-24bcf9e591c0','HSSCHED-111726001','02000374507','PENDING',NULL,'2026-11-16 20:53:16',NULL,NULL),('bfec54bb-580f-4ebc-bf49-360dba6dd586','HSSCHED-110226003','02000372990','PRESENT','2026-11-02 06:21:37','2026-11-01 17:18:38',NULL,NULL),('c0bba875-bee7-48a0-b126-aace2378e55a','HSSCHED-111726001','02000345411','PENDING',NULL,'2026-11-16 20:53:16',NULL,NULL),('c171c2fb-4786-455f-8aef-8e9ac69c8d82','HSSCHED-111726001','0200032456','PENDING',NULL,'2026-11-16 20:53:16',NULL,NULL),('c1f9712e-4684-4235-982e-54d6edb438ad','HSSCHED-111726001','02000121416','PENDING',NULL,'2026-11-16 20:53:16',NULL,NULL),('c2dc280a-98e1-484f-ae4d-ba7237508c0c','HSSCHED-111726001','02000112233','PENDING',NULL,'2026-11-16 20:53:16',NULL,NULL),('c392ffce-8bf4-4e3e-8b9c-ceef3d977926','HSSCHED-111726002','02000249174','PENDING',NULL,'2026-11-16 21:51:38',NULL,NULL),('c5f96021-f6db-4e9e-90e8-b953f7b3eec1','HSSCHED-110226003','02000434549','ABSENT',NULL,'2026-11-01 17:18:38',NULL,NULL),('cb63930e-63e5-4df4-b26e-41991c0891a3','HSSCHED-111726001','02000325758','PENDING',NULL,'2026-11-16 20:53:16',NULL,NULL),('cc4b8967-ffdd-48cc-990c-c269166e5561','HSSCHED-111726001','02000001133','PENDING',NULL,'2026-11-16 20:53:16',NULL,NULL),('ccc4b228-464f-46fe-8f59-ac6e7d18490a','HSSCHED-111726002','02000332211','PENDING',NULL,'2026-11-16 21:51:38',NULL,NULL),('ce6b4e96-3dd4-4904-931a-5151fed6d40c','HSSCHED-111726001','02000338958','PENDING',NULL,'2026-11-16 20:53:16',NULL,NULL),('cff881aa-2934-449d-9e9b-3d2d59ddbdd7','HSSCHED-111426001','02000236949','ABSENT',NULL,'2026-11-14 02:32:17',NULL,NULL),('d02e46ed-0c89-45ab-ab74-4a008c0f7eae','HSSCHED-111726001','02000548274','PENDING',NULL,'2026-11-16 20:53:16',NULL,NULL),('d44d64f4-54d8-4ccd-b7d3-537c69dd3520','HSSCHED-111726002','02000371918','PENDING',NULL,'2026-11-16 21:51:38',NULL,NULL),('d65ea5ab-afcd-4706-9f96-07d1cdc3f2c3','HSSCHED-111726001','02000349679','PENDING',NULL,'2026-11-16 20:53:16',NULL,NULL),('d8d98ac6-b860-44cb-abfa-6f9bff57923c','HSSCHED-111726001','02000236949','PENDING',NULL,'2026-11-16 20:53:16',NULL,NULL),('d8d9a1df-ea1f-47f7-981e-549c749ab246','HSSCHED-111726001','02000371063','PENDING',NULL,'2026-11-16 20:53:16',NULL,NULL),('dae5e5da-c30f-45c3-a220-66b4c6b51b2d','HSSCHED-111726001','02000565656','PENDING',NULL,'2026-11-16 20:53:16',NULL,NULL),('df7c0e60-5890-40cc-b184-4fc509f9a981','HSSCHED-111726001','02000387044','PENDING',NULL,'2026-11-16 20:53:16',NULL,NULL),('e6ccc8d3-508e-4543-a9dd-4293d064fff6','HSSCHED-111726001','02000249174','PENDING',NULL,'2026-11-16 20:53:16',NULL,NULL),('e77347d4-16ca-4d1c-8e2f-9f0867f13796','HSSCHED-111726001','02000350927','PENDING',NULL,'2026-11-16 20:53:16',NULL,NULL),('ec775f32-49c5-4439-aa1f-4a96f33996b1','HSSCHED-111726002','02000350927','PENDING',NULL,'2026-11-16 21:51:38',NULL,NULL),('eeb67de9-28ae-4ff3-8837-8af4850806a2','HSSCHED-111726001','02000250559','PENDING',NULL,'2026-11-16 20:53:16',NULL,NULL),('f3e55f26-9269-4d54-92f3-55590d3bad01','HSSCHED-111726002','02000257727','PENDING',NULL,'2026-11-16 21:51:38',NULL,NULL),('f52298b3-0651-4231-a758-a71f941cdbcd','HSSCHED-111726001','02000232323','PENDING',NULL,'2026-11-16 20:53:16',NULL,NULL),('f655f830-1c11-4612-818b-1a8c1c5fb477','HSSCHED-111726001','02000396716','PENDING',NULL,'2026-11-16 20:53:16',NULL,NULL),('f7e498e7-b6e5-4c36-b6c9-a46db25c9cfb','HSSCHED-111726001','02000257727','PENDING',NULL,'2026-11-16 20:53:16',NULL,NULL),('f84af0c9-274a-49d6-bd12-23b0087102bf','HSSCHED-111726001','02000432018','PENDING',NULL,'2026-11-16 20:53:16',NULL,NULL),('f8fc413b-fadf-4e23-ac0b-d458878f04d9','HSSCHED-110226003','02000250559','PRESENT','2026-11-01 17:52:30','2026-11-01 17:18:38',NULL,NULL),('fd0f6cd2-e8d9-458a-bb7a-1a5a39673150','HSSCHED-111726001','02000338046','PENDING',NULL,'2026-11-16 20:53:16',NULL,NULL);
/*!40000 ALTER TABLE `screening_schedule_participants` ENABLE KEYS */;
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
INSERT INTO `screening_custom_results` VALUES ('CUSTOM-110226001','02000371063','HSSCHED-110226003',2,'{\"f1\": 177, \"f2\": 60, \"f3\": 19.2, \"f3__label\": \"Normal\"}',0,NULL,'2026-11-01 17:52:11'),('CUSTOM-110226002','02000250559','HSSCHED-110226003',2,'{\"f1\": 177, \"f2\": 60, \"f3\": 19.2, \"f3__label\": \"Normal\"}',0,NULL,'2026-11-01 17:52:39'),('CUSTOM-110226003','02000347082','HSSCHED-110226003',2,'{\"f1\": 177, \"f2\": 60, \"f3\": 19.2, \"f3__label\": \"Normal\"}',0,NULL,'2026-11-01 17:52:59'),('CUSTOM-110226004','02000356857','HSSCHED-110226003',2,'{\"f1\": 177, \"f2\": 60, \"f3\": 19.2, \"f3__label\": \"Normal\"}',0,NULL,'2026-11-01 17:54:20'),('CUSTOM-110226005','02000368651','HSSCHED-110226003',2,'{\"f1\": 177, \"f2\": 55, \"f3\": 17.6, \"f3__label\": \"Underweight\"}',1,NULL,'2026-11-01 17:54:42'),('CUSTOM-110226006','02000372405','HSSCHED-110226003',2,'{\"f1\": 177, \"f2\": 60, \"f3\": 19.2, \"f3__label\": \"Normal\"}',0,NULL,'2026-11-01 17:58:41'),('CUSTOM-110226007','02000354315','HSSCHED-110226003',2,'{\"f1\": 177, \"f2\": 55, \"f3\": 17.6, \"f3__label\": \"Underweight\"}',1,NULL,'2026-11-01 18:26:20'),('CUSTOM-110226008','02000372990','HSSCHED-110226003',2,'{\"f1\": 177, \"f2\": 58, \"f3\": 18.5, \"f3__label\": \"Normal\"}',0,NULL,'2026-11-02 06:21:48'),('CUSTOM-110226009','02000325758','HSSCHED-110226003',2,'{\"f1\": 177, \"f2\": 57, \"f3\": 18.2, \"f3__label\": \"Underweight\"}',1,NULL,'2026-11-02 06:22:07'),('CUSTOM-110226010','02000112233','HSSCHED-110226003',2,'{\"f1\": 155, \"f2\": 55, \"f3\": 22.9, \"f3__label\": \"Normal\"}',0,NULL,'2026-11-02 06:22:43'),('CUSTOM-110226011','02000374507','HSSCHED-110226003',2,'{\"f1\": 177, \"f2\": 59, \"f3\": 18.8, \"f3__label\": \"Normal\"}',0,NULL,'2026-11-02 15:05:46'),('CUSTOM-111626001','02000371063','HSSCHED-111626001',5,'{\"f1\": 177, \"f2\": 60, \"f3\": 19.2, \"f4\": 115, \"f5\": 70, \"f6\": 60, \"f7\": 37.5, \"f8\": 15, \"f3__label\": \"Normal\"}',0,NULL,'2026-11-16 15:49:33');
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
INSERT INTO `dental_assessment_records` VALUES ('DENT-110526001','02000347082',NULL,'Oral hygiene: Good. DMFT 0 (Decayed 0, Missing 0, Filled 0). Gums: not noted. Malocclusion: No.',NULL,'2026-11-05 05:02:06','DVSCHED-110526001','DOC-68eae295','Good',0,0,0,NULL,0,NULL,NULL,NULL,0,NULL,NULL),('DENT-110526002','02000345411',NULL,'Oral hygiene: Good. DMFT 0 (Decayed 0, Missing 0, Filled 0). Gums: not noted. Malocclusion: No.',NULL,'2026-11-05 06:15:04','DVSCHED-110526002','DOC-68eae295','Good',0,0,0,NULL,0,NULL,NULL,NULL,0,NULL,NULL),('DENT-110526003','02000001133',NULL,'Oral hygiene: Good. DMFT 0 (Decayed 0, Missing 0, Filled 0). Gums: not noted. Malocclusion: No.',NULL,'2026-11-05 06:21:13','DVSCHED-110526003','DOC-68eae295','Good',0,0,0,NULL,0,NULL,NULL,NULL,0,NULL,NULL);
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
-- Table structure for table `screening_folders`
--

DROP TABLE IF EXISTS `screening_folders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `screening_folders` (
  `folder_id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(80) NOT NULL,
  `created_by` varchar(50) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `archived_at` datetime DEFAULT NULL,
  `archived_by` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`folder_id`),
  UNIQUE KEY `uq_screening_folders_name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `screening_folders`
--

LOCK TABLES `screening_folders` WRITE;
/*!40000 ALTER TABLE `screening_folders` DISABLE KEYS */;
INSERT INTO `screening_folders` VALUES (1,'Sportfest Player Screening','NRS02000','2026-11-14 02:32:17',NULL,NULL),(2,'Basciprisa Player Screening','NRS02000','2026-11-16 15:45:41',NULL,NULL);
/*!40000 ALTER TABLE `screening_folders` ENABLE KEYS */;
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
INSERT INTO `doctor_schedules` VALUES ('DSCH-110526001','DOC-68eae295','Dental','Once','2026-11-05',NULL,NULL,NULL,'14:10:00','23:24:00',15,1,'Clinic room','Bring ID',1,'Open',NULL,NULL,'2026-11-05 06:03:42','DOC-68eae295','Hybrid','Bring ID',434,'16:10:00',1,1,1,20,1,'2026-11-05 14:03:43',NULL),('DSCH-111426001','DOC-68eae295','Dental','Once','2026-11-14',NULL,NULL,NULL,'10:50:00','12:00:00',15,1,'Clinic room',NULL,1,'Open',NULL,NULL,'2026-11-14 02:48:42','DOC-68eae295','Hybrid',NULL,0,NULL,1,1,1,20,1,'2026-11-14 10:48:43',NULL),('DSCH-111526001','DOC-ed638364','Vision','Once','2026-11-15',NULL,NULL,NULL,'09:00:00','12:00:00',15,1,'Clinic room','Bring ID',1,'Open',NULL,NULL,'2026-11-15 00:27:36','DOC-ed638364','Hybrid','Bring ID',0,NULL,1,1,1,15,1,'2026-11-15 08:27:36',NULL),('DSCH-111526002','DOC-68eae295','Dental','Once','2026-11-15',NULL,NULL,NULL,'21:30:00','23:59:00',15,1,'Clinic room','Bring ID',1,'Open',NULL,NULL,'2026-11-15 13:27:52','DOC-68eae295','Hybrid','Bring ID',0,NULL,1,1,1,15,1,'2026-11-15 21:27:52',NULL),('DSCH-111626001','DOC-68eae295','Dental','Once','2026-11-16',NULL,NULL,NULL,'22:21:00','23:59:00',15,1,'Clinic room',NULL,1,'Open',NULL,NULL,'2026-11-16 14:20:40','DOC-68eae295','Hybrid',NULL,0,NULL,1,1,1,15,1,'2026-11-16 22:20:40',NULL),('DSCH-111826001','DOC-68eae295','Dental','Once','2026-11-18',NULL,NULL,NULL,'00:45:00','07:31:00',15,1,NULL,NULL,1,'Open',NULL,NULL,'2026-11-17 16:42:22','DOC-68eae295','Hybrid',NULL,216,'03:55:00',1,1,1,15,1,'2026-11-18 00:42:22',NULL);
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
INSERT INTO `doctor_appointments` VALUES ('DVSCHED-110526001','DOC-68eae295',NULL,'2026-11-05 06:10:00','2026-11-05 08:10:00',NULL,'Completed','Dental Appointment','Tootache','Dental','DSCH-110526001','Doctor','Tootache',NULL,NULL,NULL,'DOC-68eae295',NULL,0,'Listed',1,'Done','2026-11-05 06:10:25',NULL,NULL),('DVSCHED-110526002','DOC-68eae295',NULL,'2026-11-05 06:10:00','2026-11-05 08:10:00',NULL,'Completed','Dental Appointment','Tootache','Dental','DSCH-110526001','Doctor','Tootache',NULL,NULL,NULL,'DOC-68eae295',NULL,0,'Listed',2,'Done',NULL,'2026-11-05 06:10:25',NULL),('DVSCHED-110526003','DOC-68eae295',NULL,'2026-11-05 06:10:00','2026-11-05 08:10:00',NULL,'Completed','Dental Appointment','Gums','Dental','DSCH-110526001','Doctor','Gums',NULL,NULL,NULL,'DOC-68eae295',NULL,0,'Listed',3,'Done',NULL,'2026-11-05 06:10:25',NULL),('DVSCHED-110526004','DOC-68eae295',NULL,'2026-11-05 06:10:00','2026-11-05 08:10:00','NURSE02000','Completed','Dental Walk-in','tootache','Dental','DSCH-110526001','Walk-in','tootache',NULL,NULL,NULL,NULL,NULL,0,'Walk-in',1,'Done',NULL,NULL,NULL),('DVSCHED-110526005','DOC-68eae295',NULL,'2026-11-05 06:10:00','2026-11-05 08:10:00',NULL,'Completed','Dental Walk-in','tootache','Dental','DSCH-110526001','Walk-in','tootache',NULL,NULL,NULL,'DOC-68eae295',NULL,0,'Walk-in',2,'Done',NULL,NULL,NULL),('DVSCHED-110526006','DOC-68eae295',NULL,'2026-11-05 06:10:00','2026-11-05 08:10:00',NULL,'Completed','Dental Walk-in','Fever','Dental','DSCH-110526001','Walk-in','Fever',NULL,NULL,NULL,'DOC-68eae295',NULL,0,'Walk-in',3,'Done',NULL,NULL,NULL),('DVSCHED-110526007','DOC-68eae295',NULL,'2026-11-05 06:10:00','2026-11-05 15:24:00',NULL,'Cancelled','Dental Walk-in','Fever','Dental','DSCH-110526001','Walk-in','Fever','The session ended before number W4 was called.',NULL,NULL,'DOC-68eae295',NULL,169,'Walk-in',4,'Void',NULL,NULL,NULL),('DVSCHED-110526008','DOC-68eae295',NULL,'2026-11-05 06:10:00','2026-11-05 15:24:00',NULL,'Cancelled','Dental Walk-in','Fever','Dental','DSCH-110526001','Walk-in','Fever','The session ended before number W5 was called.',NULL,NULL,'DOC-68eae295',NULL,169,'Walk-in',5,'Void',NULL,NULL,NULL),('DVSCHED-111426001','DOC-68eae295',NULL,'2026-11-14 02:50:00','2026-11-14 04:00:00',NULL,'Completed','Follow-up Appointment','Follow-up of Dental','Follow-up','DSCH-111426001','Doctor','Follow-up of Dental',NULL,'DVSCHED-110526006',NULL,'DOC-68eae295',NULL,0,'Listed',1,'Done','2026-11-14 02:50:22',NULL,NULL),('DVSCHED-111426002','DOC-68eae295',NULL,'2026-11-14 02:50:00','2026-11-14 04:00:00',NULL,'Completed','Follow-up Appointment','Follow-up of Dental','Follow-up','DSCH-111426001','Doctor','Follow-up of Dental',NULL,'DVSCHED-110526001',NULL,'DOC-68eae295',NULL,0,'Listed',2,'Done','2026-11-14 02:53:44','2026-11-14 02:50:22',NULL),('DVSCHED-111426003','DOC-68eae295',NULL,'2026-11-14 02:50:00','2026-11-14 04:00:00',NULL,'Completed','Dental Appointment','Tootache','Dental','DSCH-111426001','Doctor','Tootache',NULL,NULL,NULL,'DOC-68eae295',NULL,0,'Listed',3,'Done','2026-11-14 02:54:32','2026-11-14 02:50:22',NULL),('DVSCHED-111426004','DOC-68eae295',NULL,'2026-11-14 02:50:00','2026-11-14 04:00:00',NULL,'Completed','Dental Appointment','Tootache','Dental','DSCH-111426001','Doctor','Tootache',NULL,NULL,NULL,'DOC-68eae295',NULL,0,'Listed',4,'Done','2026-11-14 15:20:56','2026-11-14 02:50:22',NULL),('DVSCHED-111426005','DOC-68eae295',NULL,'2026-11-14 02:50:00','2026-11-14 04:00:00',NULL,'Cancelled','Dental Appointment','Tootache','Dental','DSCH-111426001','Doctor','Tootache','The session ended before number #5 was called.',NULL,NULL,'DOC-68eae295',NULL,0,'Listed',5,'Void',NULL,'2026-11-14 02:53:44',NULL),('DVSCHED-111426006','DOC-68eae295',NULL,'2026-11-14 02:50:00','2026-11-14 04:00:00',NULL,'Cancelled','Dental Appointment','Tootache','Dental','DSCH-111426001','Doctor','Tootache','The session ended before number #6 was called.',NULL,NULL,'DOC-68eae295',NULL,0,'Listed',6,'Void',NULL,'2026-11-14 02:54:32',NULL),('DVSCHED-111526001','DOC-ed638364',NULL,'2026-11-15 01:00:00','2026-11-15 04:00:00',NULL,'Completed','Vision Appointment','check my vision','Vision','DSCH-111526001','Doctor','check my vision',NULL,NULL,NULL,'DOC-ed638364',NULL,0,'Listed',1,'Done','2026-11-15 02:04:43',NULL,NULL),('DVSCHED-111526002','DOC-ed638364',NULL,'2026-11-15 01:00:00','2026-11-15 04:00:00',NULL,'Scheduled','Vision Appointment','Check my eyes','Vision','DSCH-111526001','Doctor','Check my eyes',NULL,NULL,NULL,'DOC-ed638364',NULL,0,'Listed',2,'Void','2026-11-15 02:29:39','2026-11-15 02:04:44',NULL),('DVSCHED-111526003','DOC-ed638364',NULL,'2026-11-15 01:00:00','2026-11-15 04:00:00',NULL,'Completed','Vision Appointment','check my condition','Vision','DSCH-111526001','Doctor','check my condition',NULL,NULL,NULL,'DOC-ed638364',NULL,0,'Listed',3,'Done','2026-11-15 02:29:49','2026-11-15 02:04:44',NULL),('DVSCHED-111526004','DOC-ed638364',NULL,'2026-11-15 01:00:00','2026-11-15 04:00:00','NURSE02000','Completed','Vision Appointment','Appointed from the waiting list','Vision','DSCH-111526001','Nurse',NULL,NULL,NULL,NULL,NULL,NULL,0,'Listed',4,'Done','2026-11-15 02:16:09','2026-11-15 02:04:44',NULL),('DVSCHED-111526005','DOC-68eae295',NULL,'2026-11-15 13:30:00','2026-11-15 15:59:00',NULL,'Scheduled','Follow-up Appointment','Follow-up of Follow-up','Follow-up','DSCH-111526002','Doctor','Follow-up of Follow-up',NULL,'DVSCHED-111426002',NULL,'DOC-68eae295',NULL,0,'Listed',1,'Void','2026-11-15 13:33:46',NULL,'2026-11-15 13:34:34'),('DVSCHED-111526006','DOC-68eae295',NULL,'2026-11-15 13:30:00','2026-11-15 15:59:00',NULL,'Completed','Follow-up Appointment','Follow-up of Follow-up','Follow-up','DSCH-111526002','Doctor','Follow-up of Follow-up',NULL,'DVSCHED-111426001',NULL,'DOC-68eae295',NULL,0,'Listed',2,'Done','2026-11-15 13:34:34','2026-11-15 13:30:44',NULL),('DVSCHED-111526007','DOC-68eae295',NULL,'2026-11-15 13:30:00','2026-11-15 15:59:00',NULL,'Scheduled','Follow-up Appointment','Follow-up of Dental','Follow-up','DSCH-111526002','Doctor','Follow-up of Dental',NULL,'DVSCHED-111426003',NULL,'DOC-68eae295',NULL,0,'Listed',3,'Void','2026-11-15 13:35:58','2026-11-15 13:30:44',NULL),('DVSCHED-111526008','DOC-68eae295',NULL,'2026-11-15 13:30:00','2026-11-15 15:59:00',NULL,'Cancelled','Dental Appointment','Tootache','Dental','DSCH-111526002','Doctor','Tootache','The session ended before number #4 was called.',NULL,NULL,'DOC-68eae295',NULL,0,'Listed',4,'Void',NULL,'2026-11-15 13:30:44',NULL),('DVSCHED-111526009','DOC-68eae295',NULL,'2026-11-15 13:30:00','2026-11-15 15:59:00',NULL,'Cancelled','Dental Appointment','Tootache','Dental','DSCH-111526002','Doctor','Tootache','The session ended before number #5 was called.',NULL,NULL,'DOC-68eae295',NULL,0,'Listed',5,'Void',NULL,'2026-11-15 13:30:53',NULL),('DVSCHED-111526010','DOC-68eae295',NULL,'2026-11-15 13:30:00','2026-11-15 15:59:00',NULL,'Cancelled','Dental Appointment','Red Gums','Dental','DSCH-111526002','Doctor','Red Gums','The session ended before number #6 was called.',NULL,NULL,'DOC-68eae295',NULL,0,'Listed',6,'Void',NULL,'2026-11-15 13:35:58',NULL),('DVSCHED-111626001','DOC-68eae295',NULL,'2026-11-16 10:00:00','2026-11-16 10:30:00',NULL,'Cancelled','Dental Appointment','Dental','Dental',NULL,'Doctor','Dental','Not Available',NULL,NULL,'DOC-68eae295',NULL,0,NULL,NULL,NULL,NULL,NULL,NULL),('DVSCHED-111626002','DOC-68eae295',NULL,'2026-11-16 14:21:00','2026-11-16 15:59:00',NULL,'Scheduled','Dental Appointment','Tootache','Dental','DSCH-111626001','Doctor','Tootache',NULL,NULL,NULL,'DOC-68eae295',NULL,0,'Listed',1,'Void','2026-11-16 14:25:51',NULL,'2026-11-16 14:25:53'),('DVSCHED-111626003','DOC-68eae295',NULL,'2026-11-16 14:21:00','2026-11-16 15:59:00',NULL,'Scheduled','Dental Appointment','Tootache','Dental','DSCH-111626001','Doctor','Tootache',NULL,NULL,NULL,'DOC-68eae295',NULL,0,'Listed',2,'Void','2026-11-16 14:25:53','2026-11-16 14:24:36','2026-11-16 14:25:56'),('DVSCHED-111626004','DOC-68eae295',NULL,'2026-11-16 14:21:00','2026-11-16 15:59:00',NULL,'Completed','Dental Appointment','Tootache','Dental','DSCH-111626001','Doctor','Tootache',NULL,NULL,NULL,'DOC-68eae295',NULL,0,'Listed',3,'Done','2026-11-16 14:25:56','2026-11-16 14:24:36',NULL),('DVSCHED-111626005','DOC-68eae295',NULL,'2026-11-16 14:21:00','2026-11-16 15:59:00',NULL,'Cancelled','Dental Appointment','Red Gums','Dental','DSCH-111626001','Doctor','Red Gums','The session ended before number #4 was called.',NULL,NULL,'DOC-68eae295',NULL,0,'Listed',4,'Void',NULL,'2026-11-16 14:24:36',NULL),('DVSCHED-111626006','DOC-68eae295',NULL,'2026-11-16 14:21:00','2026-11-16 15:59:00',NULL,'Cancelled','Dental Appointment','Swollen Teeth','Dental','DSCH-111626001','Doctor','Swollen Teeth','The session ended before number #5 was called.',NULL,NULL,'DOC-68eae295',NULL,0,'Listed',5,'Void',NULL,'2026-11-16 14:25:39',NULL),('DVSCHED-111626007','DOC-68eae295',NULL,'2026-11-16 14:21:00','2026-11-16 15:59:00','NURSE02000','Cancelled','Dental Appointment','Tootache','Dental','DSCH-111626001','Nurse','Tootache','The session ended before number #6 was called.',NULL,NULL,NULL,'CREQ-111626001',0,'Listed',6,'Void',NULL,'2026-11-16 14:25:47',NULL),('DVSCHED-111626008','DOC-68eae295',NULL,'2026-11-16 14:21:00','2026-11-16 15:59:00',NULL,'Cancelled','Dental Appointment','Appointed from the waiting list','Dental','DSCH-111626001','Doctor',NULL,'The session ended before number #7 was called.',NULL,NULL,'DOC-68eae295',NULL,0,'Listed',7,'Void',NULL,NULL,NULL),('DVSCHED-111826001','DOC-68eae295',NULL,'2026-11-17 16:45:00','2026-11-17 19:55:00',NULL,'Completed','Dental Appointment','Red Gums','Dental','DSCH-111826001','Doctor','Red Gums',NULL,NULL,NULL,'DOC-68eae295',NULL,0,'Listed',1,'Done','2026-11-17 16:49:58',NULL,NULL),('DVSCHED-111826002','DOC-68eae295',NULL,'2026-11-17 16:45:00','2026-11-17 19:55:00',NULL,'Completed','Dental Appointment','Swollen Teeth','Dental','DSCH-111826001','Doctor','Swollen Teeth',NULL,NULL,NULL,'DOC-68eae295',NULL,0,'Listed',2,'Done','2026-11-17 16:54:29','2026-11-17 16:45:32',NULL),('DVSCHED-111826003','DOC-68eae295',NULL,'2026-11-17 16:45:00','2026-11-17 19:55:00',NULL,'Completed','Dental Walk-in','tootache','Dental','DSCH-111826001','Walk-in','tootache',NULL,NULL,NULL,'DOC-68eae295',NULL,0,'Walk-in',1,'Done','2026-11-17 16:45:41','2026-11-17 16:45:32',NULL),('DVSCHED-111826004','DOC-68eae295',NULL,'2026-11-17 16:45:00','2026-11-17 19:55:00',NULL,'Completed','Dental Walk-in','Tootache','Dental','DSCH-111826001','Walk-in','Tootache',NULL,NULL,NULL,'DOC-68eae295',NULL,0,'Walk-in',2,'Done','2026-11-17 16:48:38',NULL,NULL),('DVSCHED-111826005','DOC-68eae295',NULL,'2026-11-17 16:45:00','2026-11-17 19:55:00',NULL,'Completed','Dental Walk-in','Tootache','Dental','DSCH-111826001','Walk-in','Tootache',NULL,NULL,NULL,'DOC-68eae295',NULL,0,'Walk-in',3,'Done','2026-11-17 16:51:37',NULL,NULL),('DVSCHED-111826006','DOC-68eae295',NULL,'2026-11-17 16:45:00','2026-11-17 19:55:00',NULL,'Completed','Dental Walk-in','test','Dental','DSCH-111826001','Walk-in','test',NULL,NULL,NULL,'DOC-68eae295',NULL,0,'Walk-in',4,'Done','2026-11-17 17:03:23',NULL,NULL);
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
INSERT INTO `doctor_appointment_students` VALUES ('DVSCHED-110526001','02000347082','Present','2026-11-05 06:10:17',NULL),('DVSCHED-110526002','02000345411','Present','2026-11-05 06:14:54',NULL),('DVSCHED-110526003','02000001133','Present','2026-11-05 06:21:02',NULL),('DVSCHED-110526004','02000121416','Present','2026-11-05 07:31:02',NULL),('DVSCHED-110526005','02000356857','Present','2026-11-05 07:33:12',NULL),('DVSCHED-110526006','02000371063','Present','2026-11-05 07:40:09',NULL),('DVSCHED-110526007','02000338958','Present','2026-11-05 12:06:23',NULL),('DVSCHED-110526008','02000372405','Present','2026-11-05 12:06:37',NULL),('DVSCHED-111426001','02000371063','Present','2026-11-14 02:50:35',NULL),('DVSCHED-111426002','02000347082','Present','2026-11-14 02:53:51',NULL),('DVSCHED-111426003','02000257727','Present','2026-11-14 02:55:43',NULL),('DVSCHED-111426004','02000565656','Present','2026-11-14 15:20:58',NULL),('DVSCHED-111426005','02000249174','Pending',NULL,NULL),('DVSCHED-111426006','02000373183','Pending',NULL,NULL),('DVSCHED-111526001','02000371918','Present','2026-11-15 02:04:53',NULL),('DVSCHED-111526002','02000372990','Absent',NULL,'Voided in the queue'),('DVSCHED-111526003','02000374507','Present','2026-11-15 02:31:58',NULL),('DVSCHED-111526004','02000345411','Present','2026-11-15 02:16:15',NULL),('DVSCHED-111526005','02000347082','Absent',NULL,'Skipped in the queue'),('DVSCHED-111526006','02000371063','Present','2026-11-15 13:34:49',NULL),('DVSCHED-111526007','02000257727','Absent',NULL,NULL),('DVSCHED-111526008','02000565656','Pending',NULL,NULL),('DVSCHED-111526009','02000371918','Pending',NULL,NULL),('DVSCHED-111526010','02000350927','Pending',NULL,NULL),('DVSCHED-111626001','02000371063','Pending',NULL,NULL),('DVSCHED-111626002','02000371063','Absent',NULL,'Skipped in the queue'),('DVSCHED-111626003','02000565656','Absent',NULL,'Skipped in the queue'),('DVSCHED-111626004','02000371918','Present','2026-11-16 14:31:57',NULL),('DVSCHED-111626005','02000350927','Pending',NULL,NULL),('DVSCHED-111626006','02000347082','Pending',NULL,NULL),('DVSCHED-111626007','02000249174','Pending',NULL,NULL),('DVSCHED-111626008','02000257727','Pending',NULL,NULL),('DVSCHED-111826001','02000350927','Present','2026-11-17 16:50:19',NULL),('DVSCHED-111826002','02000347082','Present','2026-11-17 17:01:39',NULL),('DVSCHED-111826003','02000257727','Present','2026-11-17 16:45:28',NULL),('DVSCHED-111826004','02000236949','Present','2026-11-17 16:46:36',NULL),('DVSCHED-111826005','02000432018','Present','2026-11-17 16:49:35',NULL),('DVSCHED-111826006','02000272341','Present','2026-11-17 17:02:27',NULL);
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
INSERT INTO `doctor_appointment_logs` VALUES ('01da2570-cfab-4f47-811d-982db0377ca8','DVSCHED-111626001','Scheduled',NULL,'Scheduled',NULL,NULL,'2026-11-16 10:00:00','2026-11-16 10:30:00','Dental','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-16 09:58:28'),('04093a4f-3e20-480a-a829-789a8fadd7a0','DVSCHED-111526004','Scheduled',NULL,'Scheduled',NULL,NULL,'2026-11-15 01:00:00','2026-11-15 04:00:00','Appointed from the waiting list: queue number 4','NRS02000','Nurse','Marilou Balarao','2026-11-15 00:29:38'),('0781e483-d471-4728-bbb5-c7052056a1e7','DVSCHED-110526008','Cancelled','Scheduled','Cancelled',NULL,NULL,NULL,NULL,'The session ended before number W5 was called.',NULL,'System',NULL,'2026-11-05 15:25:19'),('08056032-7b1f-411e-b626-b9f2fdea7cf9','DVSCHED-111526005','Queue Restored',NULL,NULL,NULL,NULL,NULL,NULL,'Went back to number #1','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-15 13:33:46'),('08a586ab-d70f-4804-9849-4dbd57884820','DVSCHED-111526005','Queue Skipped',NULL,NULL,NULL,NULL,NULL,NULL,'#1 did not time in before another number was called','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-15 13:34:34'),('09e1e529-ba5e-4cdc-aa8f-a1a0b270d616','DVSCHED-111826002','Completed','Scheduled','Completed',NULL,NULL,NULL,NULL,'Check-up documented','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-17 17:03:10'),('0b02e67e-5877-4a1f-b837-1d6ef9c85d96','DVSCHED-111626004','Queue Restored',NULL,NULL,NULL,NULL,NULL,NULL,'Went back to number #3','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-16 14:25:56'),('10291a8f-59a5-4718-bea6-681fa73d38b6','DVSCHED-111826005','Completed','Scheduled','Completed',NULL,NULL,NULL,NULL,'Check-up documented','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-17 16:52:39'),('11aaaeea-31b5-4b7f-a75c-a93d667b0e58','DVSCHED-111526002','Queue Restored',NULL,NULL,NULL,NULL,NULL,NULL,'Went back to number #2','218f3631-0689-4166-b4fb-14070c317d5f','Doctor','Dr. Alvin Ligutan','2026-11-15 02:29:39'),('130ddaae-15b2-47f2-afd5-022815ab6ef0','DVSCHED-111826003','Walk-in',NULL,'Scheduled',NULL,NULL,'2026-11-17 16:45:00','2026-11-17 19:55:00','Walk-in W1: tootache','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-17 16:45:28'),('149d8a4a-f9b9-44fb-999b-686618c96056','DVSCHED-111526006','Queue Restored',NULL,NULL,NULL,NULL,NULL,NULL,'Went back to number #2','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-15 13:33:17'),('1929b93d-4863-4de6-b76e-cfb824f5e20c','DVSCHED-111826004','Queue Called',NULL,NULL,NULL,NULL,NULL,NULL,'Number W2 was called','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-17 16:48:38'),('1acf6ca1-f7a7-488c-8d35-0729d1a2c86f','DVSCHED-111526009','Scheduled',NULL,'Scheduled',NULL,NULL,'2026-11-15 13:30:00','2026-11-15 15:59:00','Advance listing A3: queue number 5. Tootache','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-15 13:27:52'),('1d5bf497-274c-498e-b241-d45250748cf3','DVSCHED-110526008','Walk-in',NULL,'Scheduled',NULL,NULL,'2026-11-05 06:10:00','2026-11-05 12:35:00','Walk-in W5: Fever','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-05 12:06:37'),('1da5f02c-2713-4233-931c-d24f23644696','DVSCHED-111426002','Queue Called',NULL,NULL,NULL,NULL,NULL,NULL,'Number #2 was called','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-14 02:53:44'),('2186da73-112b-4891-91ac-17ee1dc21c6a','DVSCHED-110526004','Walk-in',NULL,'Scheduled',NULL,NULL,'2026-11-05 06:10:00','2026-11-05 08:10:00','Walk-in W1: tootache','NRS02000','Nurse','Marilou Balarao','2026-11-05 07:31:02'),('21b168d7-6a17-4fd4-b925-fbc478e1a18c','DVSCHED-111526003','Queue Restored',NULL,NULL,NULL,NULL,NULL,NULL,'Went back to number #3','218f3631-0689-4166-b4fb-14070c317d5f','Doctor','Dr. Alvin Ligutan','2026-11-15 02:16:04'),('21dd448c-f9c7-4cc1-9232-83c9077b5cda','DVSCHED-111426004','Queue Called',NULL,NULL,NULL,NULL,NULL,NULL,'Number #4 was called','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-14 15:20:56'),('21f86493-490e-4a32-8734-24dbefb9bf2b','DVSCHED-111526002','Queue Restored',NULL,NULL,NULL,NULL,NULL,NULL,'Went back to number #2','218f3631-0689-4166-b4fb-14070c317d5f','Doctor','Dr. Alvin Ligutan','2026-11-15 02:08:00'),('22b9ed7f-ee73-45bd-8894-1490e68cd1d8','DVSCHED-111526002','Queue Restored',NULL,NULL,NULL,NULL,NULL,NULL,'Went back to number #2','218f3631-0689-4166-b4fb-14070c317d5f','Doctor','Dr. Alvin Ligutan','2026-11-15 02:07:19'),('28578bf1-f665-4480-9a3f-60b71b5d6de8','DVSCHED-111526005','Scheduled',NULL,'Scheduled',NULL,NULL,'2026-11-15 13:30:00','2026-11-15 15:59:00','Repeat moved into the requested schedule: queue number 1. Follow-up of Follow-up','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-15 13:27:52'),('2914b7f8-c940-45fa-aa8d-11c8a9b16eaa','DVSCHED-111826002','Queue Skipped',NULL,NULL,NULL,NULL,NULL,NULL,'The student was not there when the number was called','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-17 16:45:41'),('292157c5-6890-4135-8ba1-266c0fc90cf7','DVSCHED-110526001','Queue Called',NULL,NULL,NULL,NULL,NULL,NULL,'Number #1 was called','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-05 06:10:25'),('2b766d76-f830-426d-a5a3-97bf4cc8d994','DVSCHED-111526003','Queue Skipped',NULL,NULL,NULL,NULL,NULL,NULL,'#3 did not time in before another number was called','218f3631-0689-4166-b4fb-14070c317d5f','Doctor','Dr. Alvin Ligutan','2026-11-15 02:16:09'),('2b898c49-cb21-4b18-bd4e-164fd742ee61','DVSCHED-111826003','Queue Called',NULL,NULL,NULL,NULL,NULL,NULL,'Number W1 was called','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-17 16:45:41'),('2f871743-3988-48df-b5b7-89b88f15cafa','DVSCHED-111526004','Queue Restored',NULL,NULL,NULL,NULL,NULL,NULL,'Went back to number #4','218f3631-0689-4166-b4fb-14070c317d5f','Doctor','Dr. Alvin Ligutan','2026-11-15 02:16:09'),('2f8a069f-2697-4dfd-b845-b1f3e973fb3e','DVSCHED-111526006','Queue Skipped',NULL,NULL,NULL,NULL,NULL,NULL,'#2 did not time in before another number was called','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-15 13:33:46'),('2fac88e4-9138-4e79-8487-4ce51d50bebd','DVSCHED-111526005','Queue Skipped',NULL,NULL,NULL,NULL,NULL,NULL,'The student was not there when the number was called','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-15 13:30:53'),('309b1bd3-067f-4160-a75a-acbd93c76e30','DVSCHED-111626002','Queue Skipped',NULL,NULL,NULL,NULL,NULL,NULL,'The student was not there when the number was called','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-16 14:25:39'),('323498eb-61e2-4014-b094-05b08f5305b3','DVSCHED-110526001','Completed','Scheduled','Completed',NULL,NULL,NULL,NULL,'Check-up documented','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-05 07:24:36'),('35680a64-6041-4f46-9c0d-792a1889f868','DVSCHED-110526007','Cancelled','Scheduled','Cancelled',NULL,NULL,NULL,NULL,'The session ended before number W4 was called.',NULL,'System',NULL,'2026-11-05 15:25:19'),('35b086a2-8816-4751-8a4e-fa44685c5c81','DVSCHED-111626003','Queue Skipped',NULL,NULL,NULL,NULL,NULL,NULL,'The student was not there when the number was called','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-16 14:25:47'),('3884c072-bc6f-41b4-8a95-8026de7d9232','DVSCHED-111426006','Scheduled',NULL,'Scheduled',NULL,NULL,'2026-11-14 02:50:00','2026-11-14 04:00:00','Advance listing A5: queue number 6. Tootache','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-14 02:48:43'),('3a24098d-d3a5-4756-bdcc-3172999221e6','DVSCHED-111426006','Cancelled','Scheduled','Cancelled',NULL,NULL,NULL,NULL,'The session ended before number #6 was called.',NULL,'System',NULL,'2026-11-14 16:00:00'),('3b3ab49a-96e5-4619-8c94-120c2943e738','DVSCHED-111426004','Scheduled',NULL,'Scheduled',NULL,NULL,'2026-11-14 02:50:00','2026-11-14 04:00:00','Advance listing A3: queue number 4. Tootache','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-14 02:48:42'),('3bd393ff-5f05-4770-b113-564a3cb04dc6','DVSCHED-111826001','Completed','Scheduled','Completed',NULL,NULL,NULL,NULL,'Check-up documented','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-17 16:50:33'),('3dec11ec-0d1d-428c-9ae0-7d6a62833dfb','DVSCHED-110526003','Completed','Scheduled','Completed',NULL,NULL,NULL,NULL,'Check-up documented','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-05 06:21:13'),('3f98f836-5547-4753-a333-cc770f384b67','DVSCHED-111526007','Scheduled',NULL,'Scheduled',NULL,NULL,'2026-11-15 13:30:00','2026-11-15 15:59:00','Repeat moved into the requested schedule: queue number 3. Follow-up of Dental','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-15 13:27:52'),('3fd89b9c-9d88-4cb5-9162-e7000bbb1dae','DVSCHED-111526001','Completed','Scheduled','Completed',NULL,NULL,NULL,NULL,'Check-up documented','218f3631-0689-4166-b4fb-14070c317d5f','Doctor','Dr. Alvin Ligutan','2026-11-15 02:05:07'),('409b91df-ba0a-4cb5-b31e-a5b999a7807d','DVSCHED-111626003','Queue Called',NULL,NULL,NULL,NULL,NULL,NULL,'Number #2 was called','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-16 14:25:39'),('4626ade0-95a4-47e9-b4ca-0bea6818e703','DVSCHED-111826001','Queue Skipped',NULL,NULL,NULL,NULL,NULL,NULL,'The student was not there when the number was called','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-17 16:45:37'),('48cd0e7f-51f5-4708-b986-5c35f9c39119','DVSCHED-110526007','Walk-in',NULL,'Scheduled',NULL,NULL,'2026-11-05 06:10:00','2026-11-05 12:35:00','Walk-in W4: Fever','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-05 12:06:23'),('4b1cf96a-22d3-4c14-91f7-1880c25262dc','DVSCHED-111526006','Queue Skipped',NULL,NULL,NULL,NULL,NULL,NULL,'#2 did not time in before another number was called','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-15 13:30:58'),('4d3ef439-bf56-4513-94d5-fdd423a072ca','DVSCHED-111826006','Walk-in',NULL,'Scheduled',NULL,NULL,'2026-11-17 16:45:00','2026-11-17 19:55:00','Walk-in W4: test','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-17 17:02:27'),('55f62d4a-1f04-481e-9b0a-373b382f3e70','DVSCHED-111426001','Completed','Scheduled','Completed',NULL,NULL,NULL,NULL,'Check-up documented','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-14 02:53:30'),('57919af0-0ce1-4d65-8fff-5ca2b4fadb78','DVSCHED-111626002','Queue Restored',NULL,NULL,NULL,NULL,NULL,NULL,'Went back to number #1','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-16 14:25:51'),('5a20dc10-7856-4d32-810b-bc8e74fac35f','DVSCHED-111426001','Queue Called',NULL,NULL,NULL,NULL,NULL,NULL,'Number #1 was called','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-14 02:50:22'),('5d240c6a-5f1d-49b5-bb7e-43e5ae7d45a9','DVSCHED-111626004','Queue Called',NULL,NULL,NULL,NULL,NULL,NULL,'Number #3 was called','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-16 14:25:47'),('5d6f0045-e7bf-4d55-8b2e-f1c469c7eb6e','DVSCHED-111826005','Queue Called',NULL,NULL,NULL,NULL,NULL,NULL,'Number W3 was called','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-17 16:51:37'),('5f8ced86-0631-4aed-ab65-9dc5aa753d05','DVSCHED-111526002','Scheduled',NULL,'Scheduled',NULL,NULL,'2026-11-15 01:00:00','2026-11-15 04:00:00','Advance listing A2: queue number 2. Check my eyes','218f3631-0689-4166-b4fb-14070c317d5f','Doctor','Dr. Alvin Ligutan','2026-11-15 00:27:36'),('635fa06e-b22f-40ca-8c06-d25083f83fcb','DVSCHED-111526005','Queue Called',NULL,NULL,NULL,NULL,NULL,NULL,'Number #1 was called','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-15 13:30:44'),('637d6b41-1073-4096-8ffe-b7149fbcd5b9','DVSCHED-110526006','Completed','Scheduled','Completed',NULL,NULL,NULL,NULL,'Check-up documented','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-05 07:40:53'),('666dab52-71a7-4102-820d-b766e8e2faed','DVSCHED-111626002','Queue Skipped',NULL,NULL,NULL,NULL,NULL,NULL,'#1 did not time in before another number was called','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-16 14:25:53'),('6754687b-8eb3-4287-b02b-eb57e83b52cf','DVSCHED-111426002','Scheduled',NULL,'Scheduled',NULL,NULL,'2026-11-14 02:50:00','2026-11-14 04:00:00','Repeat moved into the requested schedule: queue number 2. Follow-up of Dental','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-14 02:48:42'),('68aaf298-9452-44b5-b700-4f280d17fdaf','DVSCHED-110526002','Completed','Scheduled','Completed',NULL,NULL,NULL,NULL,'Check-up documented','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-05 06:15:04'),('6a660d4a-8d47-4089-a612-5134fd6bdbaa','DVSCHED-111526010','Scheduled',NULL,'Scheduled',NULL,NULL,'2026-11-15 13:30:00','2026-11-15 15:59:00','Advance listing A4: queue number 6. Red Gums','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-15 13:27:52'),('6e1278d0-f5a7-4aa3-8eef-82aff343c87b','DVSCHED-111626004','Completed','Scheduled','Completed',NULL,NULL,NULL,NULL,'Check-up documented','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-16 14:35:40'),('70e25b33-bb82-4588-b441-13549ffb3c94','DVSCHED-111526010','Cancelled','Scheduled','Cancelled',NULL,NULL,NULL,NULL,'The session ended before number #6 was called.',NULL,'System',NULL,'2026-11-15 16:00:00'),('71561b14-864d-4dd9-b703-450ba5bf45e2','DVSCHED-111526003','Queue Restored',NULL,NULL,NULL,NULL,NULL,NULL,'Went back to number #3','218f3631-0689-4166-b4fb-14070c317d5f','Doctor','Dr. Alvin Ligutan','2026-11-15 02:29:49'),('73de236a-7922-469f-9e18-3d9e7f2d1cc9','DVSCHED-111826001','Rescheduled','Scheduled','Scheduled','2026-11-17 16:55:00','2026-11-17 19:55:00','2026-11-17 16:45:00','2026-11-17 19:55:00','The doctor moved the session: extra time','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-17 16:44:24'),('74d30eac-2ba9-42eb-ae9e-770157888901','DVSCHED-111526001','Queue Called',NULL,NULL,NULL,NULL,NULL,NULL,'Number #1 was called','218f3631-0689-4166-b4fb-14070c317d5f','Doctor','Dr. Alvin Ligutan','2026-11-15 02:04:44'),('77283e93-355f-4d81-ae9b-c7f7129141ce','DVSCHED-111526002','Queue Called',NULL,NULL,NULL,NULL,NULL,NULL,'Number #2 was called','218f3631-0689-4166-b4fb-14070c317d5f','Doctor','Dr. Alvin Ligutan','2026-11-15 02:05:31'),('775e5354-a833-4348-84b1-1410f05e82b9','DVSCHED-111826004','Walk-in',NULL,'Scheduled',NULL,NULL,'2026-11-17 16:45:00','2026-11-17 19:55:00','Walk-in W2: Tootache','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-17 16:46:36'),('77872062-f12e-4548-8ffa-b12a3a8c8ffc','DVSCHED-111426002','Completed','Scheduled','Completed',NULL,NULL,NULL,NULL,'Check-up documented','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-14 02:54:25'),('7982ab22-aa6a-4053-ba5f-2f24b978bfb5','DVSCHED-111526006','Scheduled',NULL,'Scheduled',NULL,NULL,'2026-11-15 13:30:00','2026-11-15 15:59:00','Repeat moved into the requested schedule: queue number 2. Follow-up of Follow-up','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-15 13:27:52'),('7ac7de51-ce92-42a4-aef9-520d9ac6b98e','DVSCHED-111526003','Queue Restored',NULL,NULL,NULL,NULL,NULL,NULL,'Went back to number #3','218f3631-0689-4166-b4fb-14070c317d5f','Doctor','Dr. Alvin Ligutan','2026-11-15 02:29:35'),('7c626cde-ce06-49e3-837f-d8ade500c7d9','DVSCHED-110526001','Scheduled',NULL,'Scheduled',NULL,NULL,'2026-11-05 06:10:00','2026-11-05 08:10:00','Advance listing A1: queue number 1. Tootache','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-05 06:03:42'),('7ce56da7-d0ca-443f-961d-c790ea0b5855','DVSCHED-111826005','Walk-in',NULL,'Scheduled',NULL,NULL,'2026-11-17 16:45:00','2026-11-17 19:55:00','Walk-in W3: Tootache','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-17 16:49:35'),('7d1d8697-eb82-499b-9382-acdfb9f899c3','DVSCHED-111626001','Cancelled','Scheduled','Cancelled','2026-11-16 10:00:00','2026-11-16 10:30:00',NULL,NULL,'Not Available','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-16 09:59:10'),('7ed031a7-9944-40a1-910a-7e30aaba97e1','DVSCHED-111626003','Queue Skipped',NULL,NULL,NULL,NULL,NULL,NULL,'#2 did not time in before another number was called','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-16 14:25:56'),('82235e10-335c-452c-a16f-61d23e764190','DVSCHED-111826006','Queue Called',NULL,NULL,NULL,NULL,NULL,NULL,'Number W4 was called','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-17 17:03:23'),('83feb5f3-0557-4f26-8bdf-adcfed2fcc37','DVSCHED-111826001','Queue Restored',NULL,NULL,NULL,NULL,NULL,NULL,'Went back to number #1','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-17 16:49:58'),('84cabd2e-9ee9-4895-883c-b2690afb54b7','DVSCHED-111426004','Completed','Scheduled','Completed',NULL,NULL,NULL,NULL,'Check-up documented','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-14 15:22:35'),('8c016397-09d6-45c5-864b-b88d22e66d87','DVSCHED-111826003','Completed','Scheduled','Completed',NULL,NULL,NULL,NULL,'Check-up documented','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-17 16:47:59'),('94a54d0f-1e14-4356-b391-667405ff68c7','DVSCHED-111626002','Queue Called',NULL,NULL,NULL,NULL,NULL,NULL,'Number #1 was called','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-16 14:24:36'),('95a536a1-89a7-4749-841a-25817b7e67f4','DVSCHED-111526004','Completed','Scheduled','Completed',NULL,NULL,NULL,NULL,'Check-up documented','218f3631-0689-4166-b4fb-14070c317d5f','Doctor','Dr. Alvin Ligutan','2026-11-15 02:18:51'),('97438fa3-f417-4a43-9ca6-08328d68d7fd','DVSCHED-111426005','Scheduled',NULL,'Scheduled',NULL,NULL,'2026-11-14 02:50:00','2026-11-14 04:00:00','Advance listing A4: queue number 5. Tootache','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-14 02:48:43'),('99371b8d-56cf-4ce5-8d74-d8bbd6cefa58','DVSCHED-110526003','Scheduled',NULL,'Scheduled',NULL,NULL,'2026-11-05 06:10:00','2026-11-05 08:10:00','Advance listing A3: queue number 3. Gums','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-05 06:03:43'),('9aec3233-4933-465d-ad2d-2ec7a940007d','DVSCHED-111626002','Scheduled',NULL,'Scheduled',NULL,NULL,'2026-11-16 14:21:00','2026-11-16 15:59:00','Advance listing A1: queue number 1. Tootache','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-16 14:20:40'),('9ba25283-3518-42d0-9b4b-bac773a3b4eb','DVSCHED-111426003','Completed','Scheduled','Completed',NULL,NULL,NULL,NULL,'Check-up documented','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-14 02:56:15'),('a0ebfbfd-534c-428f-8c15-31498147efcf','DVSCHED-111826002','Queue Called',NULL,NULL,NULL,NULL,NULL,NULL,'Number #2 was called','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-17 16:45:37'),('a105b091-7d2c-48e7-ad8c-3d06e97f2884','DVSCHED-111826001','Queue Called',NULL,NULL,NULL,NULL,NULL,NULL,'Number #1 was called','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-17 16:45:32'),('a11ea2ba-b4a9-439a-8365-035a0452d27b','DVSCHED-111826002','Queue Restored',NULL,NULL,NULL,NULL,NULL,NULL,'Went back to number #2','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-17 16:54:29'),('a3981314-cc5e-45e6-8b14-0fd470623e21','DVSCHED-111526008','Scheduled',NULL,'Scheduled',NULL,NULL,'2026-11-15 13:30:00','2026-11-15 15:59:00','Advance listing A2: queue number 4. Tootache','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-15 13:27:52'),('a43de547-732d-416a-b0d8-a96db3cb75b0','DVSCHED-111526003','Queue Skipped',NULL,NULL,NULL,NULL,NULL,NULL,'#3 did not time in before another number was called','218f3631-0689-4166-b4fb-14070c317d5f','Doctor','Dr. Alvin Ligutan','2026-11-15 02:29:39'),('a4f2bb6b-a4f8-401d-9df8-5a2250e9c629','DVSCHED-111626008','Cancelled','Scheduled','Cancelled',NULL,NULL,NULL,NULL,'The session ended before number #7 was called.',NULL,'System',NULL,'2026-11-16 16:00:00'),('a5c5656d-5316-4d6e-a194-b1c6adbb39b0','DVSCHED-111526006','Queue Called',NULL,NULL,NULL,NULL,NULL,NULL,'Number #2 was called','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-15 13:30:53'),('a7cf141b-667a-4bec-9497-718fb23f509c','DVSCHED-111526002','Queue Skipped',NULL,NULL,NULL,NULL,NULL,NULL,'The student was not there when the number was called','218f3631-0689-4166-b4fb-14070c317d5f','Doctor','Dr. Alvin Ligutan','2026-11-15 02:05:55'),('a8cade77-73a6-46dd-8f96-7452bddaab76','DVSCHED-111526002','Queue Restored',NULL,NULL,NULL,NULL,NULL,NULL,'Went back to number #2','218f3631-0689-4166-b4fb-14070c317d5f','Doctor','Dr. Alvin Ligutan','2026-11-15 02:06:46'),('afe894f6-52bf-4eee-ab0f-427d18a84f1a','DVSCHED-111626003','Scheduled',NULL,'Scheduled',NULL,NULL,'2026-11-16 14:21:00','2026-11-16 15:59:00','Advance listing A6: queue number 2. Tootache','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-16 14:20:40'),('b1be96b9-e776-42e5-8276-c004d1ed971b','DVSCHED-111826006','Completed','Scheduled','Completed',NULL,NULL,NULL,NULL,'Check-up documented','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-17 17:06:56'),('b53007af-d48b-4428-8786-cab54eacd2c4','DVSCHED-111526004','Queue Skipped',NULL,NULL,NULL,NULL,NULL,NULL,'The student was not there when the number was called','218f3631-0689-4166-b4fb-14070c317d5f','Doctor','Dr. Alvin Ligutan','2026-11-15 02:06:43'),('b65ceaf6-4b84-4161-9771-9a3800c5dc4d','DVSCHED-111626006','Cancelled','Scheduled','Cancelled',NULL,NULL,NULL,NULL,'The session ended before number #5 was called.',NULL,'System',NULL,'2026-11-16 16:00:00'),('b685e278-5e8c-4017-8473-0443ca09acca','DVSCHED-111526007','Queue Called',NULL,NULL,NULL,NULL,NULL,NULL,'Number #3 was called','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-15 13:35:58'),('b7c7fa91-8479-4b10-aad2-3be018853ca7','DVSCHED-111626005','Scheduled',NULL,'Scheduled',NULL,NULL,'2026-11-16 14:21:00','2026-11-16 15:59:00','Advance listing A8: queue number 4. Red Gums','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-16 14:20:40'),('b945e173-d0b2-471b-9861-4e04b8ba3fee','DVSCHED-111526009','Cancelled','Scheduled','Cancelled',NULL,NULL,NULL,NULL,'The session ended before number #5 was called.',NULL,'System',NULL,'2026-11-15 16:00:00'),('bf1e8f28-3a02-49d3-a1fa-71c6e77127a2','DVSCHED-111526002','Queue Skipped',NULL,NULL,NULL,NULL,NULL,NULL,'#2 did not time in before another number was called','218f3631-0689-4166-b4fb-14070c317d5f','Doctor','Dr. Alvin Ligutan','2026-11-15 02:16:04'),('c034e97f-1358-4396-b331-d5f2c6909630','DVSCHED-111526006','Completed','Scheduled','Completed',NULL,NULL,NULL,NULL,'Check-up documented','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-15 13:35:10'),('c03ca5bc-0648-4214-a221-dc3a6f1df614','DVSCHED-110526005','Completed','Scheduled','Completed',NULL,NULL,NULL,NULL,'Check-up documented','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-05 07:34:24'),('c0cae553-2489-4253-91ac-a321cef88f22','DVSCHED-111626004','Queue Skipped',NULL,NULL,NULL,NULL,NULL,NULL,'#3 did not time in before another number was called','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-16 14:25:51'),('c0da56eb-8fea-4a5e-becb-d87459f400cd','DVSCHED-110526004','Completed','Scheduled','Completed',NULL,NULL,NULL,NULL,'Check-up documented','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-05 07:32:42'),('c12f1f53-791c-4aab-872e-ecbdc37d9584','DVSCHED-111626004','Scheduled',NULL,'Scheduled',NULL,NULL,'2026-11-16 14:21:00','2026-11-16 15:59:00','Advance listing A7: queue number 3. Tootache','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-16 14:20:40'),('c2b8407c-6f58-47c4-a658-c46c81c4cf8f','DVSCHED-111626008','Scheduled',NULL,'Scheduled',NULL,NULL,'2026-11-16 14:21:00','2026-11-16 15:59:00','Appointed from the waiting list: queue number 7','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-16 14:28:20'),('c7231931-e0a3-479e-86c8-4a8af7623259','DVSCHED-111526003','Completed','Scheduled','Completed',NULL,NULL,NULL,NULL,'Check-up documented','218f3631-0689-4166-b4fb-14070c317d5f','Doctor','Dr. Alvin Ligutan','2026-11-15 02:34:26'),('c8db468b-88f0-4020-959d-840e1759f184','DVSCHED-111526005','Queue Restored',NULL,NULL,NULL,NULL,NULL,NULL,'Went back to number #1','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-15 13:30:58'),('cd5d7a2a-064b-4079-97a0-b69bba0b4c15','DVSCHED-111526002','Queue Skipped',NULL,NULL,NULL,NULL,NULL,NULL,'#2 did not time in before another number was called','218f3631-0689-4166-b4fb-14070c317d5f','Doctor','Dr. Alvin Ligutan','2026-11-15 02:29:35'),('cd8199ff-8cbd-4152-a366-2aabbc471201','DVSCHED-110526002','Scheduled',NULL,'Scheduled',NULL,NULL,'2026-11-05 06:10:00','2026-11-05 08:10:00','Advance listing A2: queue number 2. Tootache','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-05 06:03:42'),('d1073f18-df3e-47d4-a6c2-cd338eeaef4a','DVSCHED-111426003','Queue Called',NULL,NULL,NULL,NULL,NULL,NULL,'Number #3 was called','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-14 02:54:32'),('d115f3d6-1324-4f16-84b8-e813f29cffba','DVSCHED-111426003','Scheduled',NULL,'Scheduled',NULL,NULL,'2026-11-14 02:50:00','2026-11-14 04:00:00','Advance listing A1: queue number 3. Tootache','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-14 02:48:42'),('d226af1b-6340-40d9-9f7d-9bc3cac4971c','DVSCHED-111426001','Scheduled',NULL,'Scheduled',NULL,NULL,'2026-11-14 02:50:00','2026-11-14 04:00:00','Repeat moved into the requested schedule: queue number 1. Follow-up of Dental','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-14 02:48:42'),('d3fd5b20-fada-4eae-8a44-cfb7653301f2','DVSCHED-110526006','Walk-in',NULL,'Scheduled',NULL,NULL,'2026-11-05 06:10:00','2026-11-05 08:10:00','Walk-in W3: Fever','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-05 07:40:09'),('d7a69f20-4199-4389-b4af-1a0bc3566be0','DVSCHED-111526003','Queue Called',NULL,NULL,NULL,NULL,NULL,NULL,'Number #3 was called','218f3631-0689-4166-b4fb-14070c317d5f','Doctor','Dr. Alvin Ligutan','2026-11-15 02:05:55'),('d8e8a7c1-a9a9-4aa9-9dc4-a4ed20699fe2','DVSCHED-111826004','Completed','Scheduled','Completed',NULL,NULL,NULL,NULL,'Check-up documented','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-17 16:49:15'),('dc9926eb-c6a4-4b88-82a5-eeca90fcddf5','DVSCHED-111526004','Queue Called',NULL,NULL,NULL,NULL,NULL,NULL,'Number #4 was called','218f3631-0689-4166-b4fb-14070c317d5f','Doctor','Dr. Alvin Ligutan','2026-11-15 02:06:09'),('dd408f5e-8332-4c14-b09e-68c756351f05','DVSCHED-111526005','Queue Skipped',NULL,NULL,NULL,NULL,NULL,NULL,'#1 did not time in before another number was called','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-15 13:33:17'),('e1b303cb-612a-4ab8-85a0-33dc0bc943a1','DVSCHED-111626003','Queue Restored',NULL,NULL,NULL,NULL,NULL,NULL,'Went back to number #2','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-16 14:25:53'),('e1ffa089-728b-4570-8b72-ef1bd4605554','DVSCHED-111526003','Scheduled',NULL,'Scheduled',NULL,NULL,'2026-11-15 01:00:00','2026-11-15 04:00:00','Advance listing A3: queue number 3. check my condition','218f3631-0689-4166-b4fb-14070c317d5f','Doctor','Dr. Alvin Ligutan','2026-11-15 00:27:36'),('e54caba6-83f9-4492-8598-084e431330ed','DVSCHED-111526006','Queue Restored',NULL,NULL,NULL,NULL,NULL,NULL,'Went back to number #2','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-15 13:34:34'),('e5ce3a1d-c90f-4b4f-a864-d63967bf6ca5','DVSCHED-111526003','Queue Skipped',NULL,NULL,NULL,NULL,NULL,NULL,'The student was not there when the number was called','218f3631-0689-4166-b4fb-14070c317d5f','Doctor','Dr. Alvin Ligutan','2026-11-15 02:06:09'),('e7b76303-5759-4f62-a562-7b48158fd1e3','DVSCHED-111526002','Queue Skipped',NULL,NULL,NULL,NULL,NULL,NULL,'The student was not there when the number was called','218f3631-0689-4166-b4fb-14070c317d5f','Doctor','Dr. Alvin Ligutan','2026-11-15 02:07:56'),('e82f6603-1ed7-4278-8000-a371f9c9aea2','DVSCHED-111626006','Scheduled',NULL,'Scheduled',NULL,NULL,'2026-11-16 14:21:00','2026-11-16 15:59:00','Advance listing A5: queue number 5. Swollen Teeth','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-16 14:20:40'),('e947c19d-4e22-40c0-8402-614cc151520e','DVSCHED-111526002','Queue Skipped',NULL,NULL,NULL,NULL,NULL,NULL,'The student was not there when the number was called','218f3631-0689-4166-b4fb-14070c317d5f','Doctor','Dr. Alvin Ligutan','2026-11-15 02:07:16'),('ea359849-7e06-4b7a-8a4a-6462cd387816','DVSCHED-111626005','Cancelled','Scheduled','Cancelled',NULL,NULL,NULL,NULL,'The session ended before number #4 was called.',NULL,'System',NULL,'2026-11-16 16:00:00'),('ebcd596b-6b6a-43f4-8f09-cbb153d4b01b','DVSCHED-111826002','Rescheduled','Scheduled','Scheduled','2026-11-17 16:55:00','2026-11-17 19:55:00','2026-11-17 16:45:00','2026-11-17 19:55:00','The doctor moved the session: extra time','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-17 16:44:24'),('ec30516c-eb49-43c6-8950-7a89be076ebc','DVSCHED-111626007','Scheduled',NULL,'Scheduled',NULL,NULL,'2026-11-16 14:21:00','2026-11-16 15:59:00','Listing accepted: queue number 6. Tootache','NRS02000','Nurse','Marilou Balarao','2026-11-16 14:23:39'),('ef3e0f11-a9f2-490e-96f6-4ce32d22321d','DVSCHED-111526002','Queue Restored',NULL,NULL,NULL,NULL,NULL,NULL,'Went back to number #2','218f3631-0689-4166-b4fb-14070c317d5f','Doctor','Dr. Alvin Ligutan','2026-11-15 02:19:03'),('f24bc712-7d40-4c7c-97d1-2463ce4edff4','DVSCHED-110526005','Walk-in',NULL,'Scheduled',NULL,NULL,'2026-11-05 06:10:00','2026-11-05 08:10:00','Walk-in W2: tootache','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-05 07:33:12'),('f4070a72-43b5-4eb3-aa96-0dc0d48f9338','DVSCHED-111526008','Cancelled','Scheduled','Cancelled',NULL,NULL,NULL,NULL,'The session ended before number #4 was called.',NULL,'System',NULL,'2026-11-15 16:00:00'),('f51432f4-ed75-4113-af54-e39bcd48975a','DVSCHED-111526002','Queue Voided',NULL,NULL,NULL,NULL,NULL,NULL,'The student was not there when the number was called','218f3631-0689-4166-b4fb-14070c317d5f','Doctor','Dr. Alvin Ligutan','2026-11-15 02:29:43'),('f586f9b9-72b5-433a-9296-76c0b7c9c154','DVSCHED-111426005','Cancelled','Scheduled','Cancelled',NULL,NULL,NULL,NULL,'The session ended before number #5 was called.',NULL,'System',NULL,'2026-11-14 16:00:00'),('f6b29d10-87ff-4b2d-9b0d-20eac11099e2','DVSCHED-111626007','Cancelled','Scheduled','Cancelled',NULL,NULL,NULL,NULL,'The session ended before number #6 was called.',NULL,'System',NULL,'2026-11-16 16:00:00'),('f735ff13-86cd-4007-be27-ec438832c66c','DVSCHED-111826002','Scheduled',NULL,'Scheduled',NULL,NULL,'2026-11-17 16:55:00','2026-11-17 19:55:00','Advance listing A2: queue number 2. Swollen Teeth','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-17 16:42:22'),('f9a9293c-4f39-42c0-83c0-4050e23e466a','DVSCHED-111526001','Scheduled',NULL,'Scheduled',NULL,NULL,'2026-11-15 01:00:00','2026-11-15 04:00:00','Advance listing A1: queue number 1. check my vision','218f3631-0689-4166-b4fb-14070c317d5f','Doctor','Dr. Alvin Ligutan','2026-11-15 00:27:36'),('fedbf3ac-9b65-4660-91fd-40f6e07fca2d','DVSCHED-111826001','Scheduled',NULL,'Scheduled',NULL,NULL,'2026-11-17 16:55:00','2026-11-17 19:55:00','Advance listing A1: queue number 1. Red Gums','3cf1d474-ce54-45f1-bc0c-30c07003353d','Doctor','Dr. Sofia Cruz','2026-11-17 16:42:22');
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
INSERT INTO `doctor_assessments` VALUES ('DVAS-110526001','DVSCHED-110526002','02000345411','Oral hygiene: Good. DMFT 0 (Decayed 0, Missing 0, Filled 0). Gums: not noted. Malocclusion: No.','No significant dental findings',NULL,'2026-11-05 06:15:04',0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'DOC-68eae295','Tootache','Dental','Doctor','Dr. Sofia Cruz',0,NULL),('DVAS-110526002','DVSCHED-110526003','02000001133','Oral hygiene: Good. DMFT 0 (Decayed 0, Missing 0, Filled 0). Gums: not noted. Malocclusion: No.','No significant dental findings',NULL,'2026-11-05 06:21:13',0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'DOC-68eae295','Gums','Dental','Doctor','Dr. Sofia Cruz',0,NULL),('DVAS-110526003','DVSCHED-110526001','02000347082','Red Gums','Gingivitis','Consult to a dental clinic','2026-11-05 07:24:36',0,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'DOC-68eae295','Tootache','Dental','Doctor','Dr. Sofia Cruz',0,NULL),('DVAS-110526004','DVSCHED-110526004','02000121416','Unclean','Cavity','Teeth Cleaning','2026-11-05 07:32:42',0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'DOC-68eae295','tootache','Dental','Doctor','Dr. Sofia Cruz',0,NULL),('DVAS-110526005','DVSCHED-110526005','02000356857','Yellow','Cavity','General Cleaning','2026-11-05 07:34:24',0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'DOC-68eae295','tootache','Dental','Doctor','Dr. Sofia Cruz',0,NULL),('DVAS-110526006','DVSCHED-110526006','02000371063','Test','Test','Test','2026-11-05 07:40:53',0,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-11-12',NULL,NULL,NULL,'DOC-68eae295','Fever','Dental','Doctor','Dr. Sofia Cruz',0,NULL),('DVAS-111426001','DVSCHED-111426001','02000371063','Gums Swelling','Gingivitis','Always Tootbrush','2026-11-14 02:53:30',0,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-11-21',NULL,NULL,NULL,'DOC-68eae295','Follow-up of Dental','Follow-up','Doctor','Dr. Sofia Cruz',0,NULL),('DVAS-111426002','DVSCHED-111426002','02000347082','Test ','Test ','Test','2026-11-14 02:54:25',0,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-11-21',NULL,NULL,NULL,'DOC-68eae295','Follow-up of Dental','Follow-up','Doctor','Dr. Sofia Cruz',0,NULL),('DVAS-111426003','DVSCHED-111426003','02000257727','Test ','Test','Test','2026-11-14 02:56:15',0,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'DOC-68eae295','Tootache','Dental','Doctor','Dr. Sofia Cruz',0,NULL),('DVAS-111426004','DVSCHED-111426004','02000565656','','',NULL,'2026-11-14 15:22:35',0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'TPL-2e3e2c80','Dental check-up (oral health)','[{\"key\": \"f2\", \"type\": \"text\", \"label\": \"Tooth pain location\", \"value\": \"Side Teeth\"}, {\"key\": \"f3\", \"type\": \"radio\", \"label\": \"Brushing frequency\", \"value\": \"Once a day\"}, {\"key\": \"f4\", \"type\": \"yesno\", \"label\": \"Wears braces or retainers?\", \"value\": \"No\"}, {\"key\": \"f6\", \"type\": \"checkbox\", \"label\": \"Findings\", \"value\": [\"Plaque or tartar\"]}, {\"key\": \"f7\", \"type\": \"textarea\", \"label\": \"Treatment advised\", \"value\": \"Consistent Cleaning\"}]','DOC-68eae295','Tootache','Dental','Doctor','Dr. Sofia Cruz',0,NULL),('DVAS-111526001','DVSCHED-111526001','02000371918','','',NULL,'2026-11-15 02:05:07',0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'TPL-580e1dfb','Vision examination','[{\"key\": \"f2\", \"type\": \"checkbox\", \"label\": \"Eye complaints\", \"value\": [\"Blurred vision\"]}]','DOC-ed638364','check my vision','Vision','Doctor','Dr. Alvin Ligutan',0,NULL),('DVAS-111526002','DVSCHED-111526004','02000345411','','',NULL,'2026-11-15 02:18:51',0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'TPL-580e1dfb','Vision examination','[{\"key\": \"f2\", \"type\": \"checkbox\", \"label\": \"Eye complaints\", \"value\": [\"Blurred vision\"]}, {\"key\": \"f3\", \"type\": \"yesno\", \"label\": \"Wears eyeglasses?\", \"value\": \"No\"}, {\"key\": \"f4\", \"type\": \"yesno\", \"label\": \"Wears contact lenses?\", \"value\": \"No\"}, {\"key\": \"f5\", \"type\": \"date\", \"label\": \"Date of last eye exam\", \"value\": \"2026-11-15\"}, {\"key\": \"f7\", \"type\": \"text\", \"label\": \"Left eye (uncorrected)\", \"value\": \"0/20\"}, {\"key\": \"f8\", \"type\": \"text\", \"label\": \"Right eye (uncorrected)\", \"value\": \"0/20\"}, {\"key\": \"f9\", \"type\": \"text\", \"label\": \"Left eye (corrected)\", \"value\": \"20/20\"}, {\"key\": \"f10\", \"type\": \"text\", \"label\": \"Right eye (corrected)\", \"value\": \"20/20\"}, {\"key\": \"f11\", \"type\": \"select\", \"label\": \"Color vision\", \"value\": \"Normal\"}, {\"key\": \"f12\", \"type\": \"select\", \"label\": \"Eye alignment\", \"value\": \"Normal\"}, {\"key\": \"f13\", \"type\": \"textarea\", \"label\": \"Eye condition findings\", \"value\": \"Goods\"}, {\"key\": \"f14\", \"type\": \"select\", \"label\": \"Recommended action\", \"value\": \"Refer to ophthalmologist\"}]','DOC-ed638364','Appointed from the waiting list','Vision','Doctor','Dr. Alvin Ligutan',0,NULL),('DVAS-111526003','DVSCHED-111526003','02000374507','Redness Eye','Sore Eyes','Wear Sun Glassess avoid screen time','2026-11-15 02:34:26',0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'DOC-ed638364','check my eye condition','Vision','Doctor','Dr. Alvin Ligutan',0,NULL),('DVAS-111526004','DVSCHED-111526006','02000371063','Test','Test','Test','2026-11-15 13:35:10',0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'DOC-68eae295','Follow-up of Follow-up','Follow-up','Doctor','Dr. Sofia Cruz',0,NULL),('DVAS-111626001','DVSCHED-111626004','02000371918','Red Gums','Gingivitis','Go to the dental clinic','2026-11-16 14:35:40',0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'DOC-68eae295','Tootache','Dental','Doctor','Dr. Sofia Cruz',0,NULL),('DVAS-111826001','DVSCHED-111826003','02000257727','Too much Plaque','Plaque or Tartar','Clean your teeth 3 times a day','2026-11-17 16:47:59',0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'DOC-68eae295','tootache','Dental','Doctor','Dr. Sofia Cruz',0,NULL),('DVAS-111826002','DVSCHED-111826004','02000236949','Test ','Test','Test','2026-11-17 16:49:15',0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'DOC-68eae295','Tootache','Dental','Doctor','Dr. Sofia Cruz',0,NULL),('DVAS-111826003','DVSCHED-111826001','02000350927','Test ','Test','Test','2026-11-17 16:50:33',0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'DOC-68eae295','Red Gums','Dental','Doctor','Dr. Sofia Cruz',0,NULL),('DVAS-111826004','DVSCHED-111826005','02000432018','Test','Test','Test','2026-11-17 16:52:39',0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'DOC-68eae295','Tootache','Dental','Doctor','Dr. Sofia Cruz',0,NULL),('DVAS-111826005','DVSCHED-111826002','02000347082','Test','Test','Test','2026-11-17 17:03:10',0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'DOC-68eae295','Swollen Teeth','Dental','Doctor','Dr. Sofia Cruz',0,NULL),('DVAS-111826006','DVSCHED-111826006','02000272341','test','test','test','2026-11-17 17:06:56',0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'DOC-68eae295','test','Dental','Doctor','Dr. Sofia Cruz',0,NULL);
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
INSERT INTO `consultation_requests` VALUES ('CREQ-111626001','02000249174','Dental',6,NULL,'Tootache','DOC-68eae295',NULL,'Denied',0,'The session ended before number #6 was called.','NRS02000','Nurse','Marilou Balarao','2026-11-16 16:00:00',NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,NULL,'2026-11-16 14:22:50','2026-11-16 16:00:00','DSCH-111626001','2026-11-16');
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
INSERT INTO `consultation_request_logs` VALUES ('1730cb03-6395-4194-b3d1-b27ff80d907f','CREQ-111626001','Place Cancelled','Appointed','Denied','The session ended before number #6 was called.',NULL,NULL,'System',NULL,'2026-11-16 16:00:00'),('68bd472c-44f5-48dc-a266-f3608da6603f','CREQ-111626001','Appointed','Waiting List','Appointed','Appointed to the session on 2026-11-16, queue number 6','DSCH-111626001','NRS02000','Nurse','Marilou Balarao','2026-11-16 14:23:39'),('ac06f9b2-c769-4256-ae11-b2aa5bc13b17','CREQ-111626001','Requested',NULL,'Waiting for Approval','Tootache','DSCH-111626001','b1de1b0d-3ff0-4bf4-927a-cb2e53d7c695','Student','Nigel Paul Matunan','2026-11-16 14:22:50'),('c25b01a2-ddcb-432b-8a2b-953a5f9bbde6','CREQ-111626001','Accepted','Waiting for Approval','Appointed','Listing accepted. Queue number #6','DSCH-111626001','NRS02000','Nurse','Marilou Balarao','2026-11-16 14:23:39');
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
INSERT INTO `schedule_requests` VALUES ('SCHREQ-110526001','DOC-68eae295','Dental','NURSE02000','2026-11-05',NULL,NULL,'3 student(s) in the Dental advance listing','Scheduled',NULL,'DSCH-110526001','2026-11-05 06:03:42','2026-11-05 06:01:58',1,3,NULL,NULL),('SCHREQ-111426001','DOC-68eae295','Dental','NURSE02000','2026-11-14',NULL,NULL,'5 student(s) in the Dental advance listing','Scheduled',NULL,'DSCH-111426001','2026-11-14 02:48:42','2026-11-14 02:45:20',1,5,'[{\"appointment_id\":\"DVSCHED-110526006\",\"student_id\":\"02000371063\"},{\"appointment_id\":\"DVSCHED-110526001\",\"student_id\":\"02000347082\"}]',2),('SCHREQ-111526001','DOC-ed638364','Vision','NURSE02000','2026-11-15',NULL,NULL,'3 student(s) in the Vision advance listing','Scheduled',NULL,'DSCH-111526001','2026-11-15 00:27:36','2026-11-15 00:25:35',1,3,NULL,NULL),('SCHREQ-111526002','DOC-68eae295','Dental','NURSE02000',NULL,NULL,NULL,'5 student(s) in the Dental advance listing','Scheduled',NULL,'DSCH-111526002','2026-11-15 13:27:52','2026-11-15 13:26:01',1,5,'[{\"appointment_id\":\"DVSCHED-111426002\",\"student_id\":\"02000347082\"},{\"appointment_id\":\"DVSCHED-111426001\",\"student_id\":\"02000371063\"},{\"appointment_id\":\"DVSCHED-111426003\",\"student_id\":\"02000257727\"}]',3),('SCHREQ-111626001','DOC-68eae295','Dental','NURSE02000',NULL,NULL,NULL,'5 student(s) in the Dental advance listing','Scheduled',NULL,'DSCH-111626001','2026-11-16 14:20:40','2026-11-16 13:58:47',1,5,NULL,NULL),('SCHREQ-111826001','DOC-68eae295','Dental','NURSE02000',NULL,NULL,NULL,'2 student(s) in the Dental advance listing','Scheduled',NULL,'DSCH-111826001','2026-11-17 16:42:22','2026-11-17 16:40:50',1,2,NULL,NULL);
/*!40000 ALTER TABLE `schedule_requests` ENABLE KEYS */;
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
INSERT INTO `session_end_confirmations` VALUES ('DSCH-110526001','2026-11-05','NRS02000','2026-11-05 23:25:19'),('DSCH-111526001','2026-11-15','NRS02000','2026-11-15 12:14:24');
/*!40000 ALTER TABLE `session_end_confirmations` ENABLE KEYS */;
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
  `cutoff_kind` varchar(10) DEFAULT NULL,
  `cutoff_at` datetime DEFAULT NULL,
  `listed_at` datetime DEFAULT NULL,
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
INSERT INTO `advance_listing_entries` VALUES ('ADVL-110526001','02000347082','Dental','Tootache',1,'Scheduled','DSCH-110526001','2026-11-05','DVSCHED-110526001',NULL,'2026-11-05 05:58:08','2026-11-05 06:03:42','ADVLS-110526001',NULL,NULL,NULL,NULL,NULL,NULL),('ADVL-110526002','02000345411','Dental','Tootache',2,'Scheduled','DSCH-110526001','2026-11-05','DVSCHED-110526002',NULL,'2026-11-05 06:00:49','2026-11-05 06:03:42','ADVLS-110526001',NULL,NULL,NULL,NULL,NULL,NULL),('ADVL-110526003','02000001133','Dental','Gums',3,'Scheduled','DSCH-110526001','2026-11-05','DVSCHED-110526003',NULL,'2026-11-05 06:01:27','2026-11-05 06:03:43','ADVLS-110526001',NULL,NULL,NULL,NULL,NULL,NULL),('ADVL-111426001','02000257727','Dental','Tootache',1,'Scheduled','DSCH-111426001','2026-11-14','DVSCHED-111426003',NULL,'2026-11-14 02:38:40','2026-11-14 02:48:42','ADVLS-110526002',NULL,NULL,NULL,NULL,NULL,NULL),('ADVL-111426002','02000371063','Dental','Tootache',2,'Moved',NULL,NULL,NULL,NULL,'2026-11-14 02:43:16','2026-11-15 13:23:21','ADVLS-110526002',NULL,'2026-11-15','ADVL-111526004','DROP','2026-11-15 21:22:46',NULL),('ADVL-111426003','02000565656','Dental','Tootache',3,'Scheduled','DSCH-111426001','2026-11-14','DVSCHED-111426004',NULL,'2026-11-14 02:43:45','2026-11-14 02:48:42','ADVLS-110526002',NULL,NULL,NULL,NULL,NULL,NULL),('ADVL-111426004','02000249174 ','Dental','Tootache',4,'Scheduled','DSCH-111426001','2026-11-14','DVSCHED-111426005',NULL,'2026-11-14 02:44:18','2026-11-14 02:48:43','ADVLS-110526002',NULL,NULL,NULL,NULL,NULL,NULL),('ADVL-111426005','02000373183 ','Dental','Tootache',5,'Scheduled','DSCH-111426001','2026-11-14','DVSCHED-111426006',NULL,'2026-11-14 02:44:36','2026-11-14 02:48:43','ADVLS-110526002',NULL,NULL,NULL,NULL,NULL,NULL),('ADVL-111526001','02000371918','Vision','check my vision',1,'Scheduled','DSCH-111526001','2026-11-15','DVSCHED-111526001',NULL,'2026-11-15 00:24:13','2026-11-15 00:27:36','ADVLS-110526002',NULL,NULL,NULL,NULL,NULL,NULL),('ADVL-111526002','02000372990 ','Vision','Check my eyes',2,'Scheduled','DSCH-111526001','2026-11-15','DVSCHED-111526002',NULL,'2026-11-15 00:24:42','2026-11-15 00:27:36','ADVLS-110526002',NULL,NULL,NULL,NULL,NULL,NULL),('ADVL-111526003','02000374507','Vision','check my condition',3,'Scheduled','DSCH-111526001','2026-11-15','DVSCHED-111526003',NULL,'2026-11-15 00:25:06','2026-11-15 00:27:36','ADVLS-110526002',NULL,NULL,NULL,NULL,NULL,NULL),('ADVL-111526004','02000371063','Dental','Tootache',1,'Scheduled','DSCH-111626001','2026-11-16','DVSCHED-111626002',NULL,'2026-11-15 13:23:21','2026-11-16 14:20:40','ADVLS-111526001',NULL,NULL,NULL,NULL,NULL,'2026-11-14 10:43:16'),('ADVL-111526005','02000565656','Dental','Tootache',2,'Moved',NULL,NULL,NULL,NULL,'2026-11-15 13:24:01','2026-11-16 13:58:19','ADVLS-111526001','DSCH-111526002','2026-11-15','ADVL-111626001','TIME','2026-11-16 00:00:00','2026-11-15 21:24:01'),('ADVL-111526006','02000371918','Dental','Tootache',3,'Moved',NULL,NULL,NULL,NULL,'2026-11-15 13:24:21','2026-11-16 13:58:22','ADVLS-111526001','DSCH-111526002','2026-11-15','ADVL-111626002','TIME','2026-11-16 00:00:00','2026-11-15 21:24:21'),('ADVL-111526007','02000350927','Dental','Red Gums',4,'Moved',NULL,NULL,NULL,NULL,'2026-11-15 13:24:44','2026-11-16 13:58:26','ADVLS-111526001','DSCH-111526002','2026-11-15','ADVL-111626003','TIME','2026-11-16 00:00:00','2026-11-15 21:24:44'),('ADVL-111526008','02000347082','Dental','Swollen Teeth',5,'Moved',NULL,NULL,NULL,NULL,'2026-11-15 13:25:35','2026-11-17 16:40:10','ADVLS-111526001','DSCH-111626001','2026-11-16','ADVL-111826002','TIME','2026-11-17 00:00:00','2026-11-15 21:25:35'),('ADVL-111626001','02000565656','Dental','Tootache',6,'Scheduled','DSCH-111626001','2026-11-16','DVSCHED-111626003',NULL,'2026-11-16 13:58:19','2026-11-16 14:20:40','ADVLS-111526001',NULL,NULL,NULL,NULL,NULL,'2026-11-15 21:24:01'),('ADVL-111626002','02000371918','Dental','Tootache',7,'Scheduled','DSCH-111626001','2026-11-16','DVSCHED-111626004',NULL,'2026-11-16 13:58:22','2026-11-16 14:20:40','ADVLS-111526001',NULL,NULL,NULL,NULL,NULL,'2026-11-15 21:24:21'),('ADVL-111626003','02000350927','Dental','Red Gums',8,'Moved',NULL,NULL,NULL,NULL,'2026-11-16 13:58:26','2026-11-17 16:40:07','ADVLS-111526001','DSCH-111626001','2026-11-16','ADVL-111826001','TIME','2026-11-17 00:00:00','2026-11-15 21:24:44'),('ADVL-111826001','02000350927','Dental','Red Gums',1,'Scheduled','DSCH-111826001','2026-11-18','DVSCHED-111826001',NULL,'2026-11-17 16:40:07','2026-11-17 16:42:22','ADVLS-111826001',NULL,NULL,NULL,NULL,NULL,'2026-11-15 21:24:44'),('ADVL-111826002','02000347082','Dental','Swollen Teeth',2,'Scheduled','DSCH-111826001','2026-11-18','DVSCHED-111826002',NULL,'2026-11-17 16:40:10','2026-11-17 16:42:22','ADVLS-111826001',NULL,NULL,NULL,NULL,NULL,'2026-11-15 21:25:35');
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
INSERT INTO `advance_listings` VALUES ('ADVLS-110526001','Advance listing for next december','2026-11-05 13:57:17',NULL,'2026-11-05 21:02:54','dropped','[{\"visit_type\":\"Dental\",\"listing_limit\":15},{\"visit_type\":\"General Check Up\",\"listing_limit\":15}]','NRS02000','2026-11-05 21:02:54'),('ADVLS-110526002','Advance listing for next december','2026-11-05 21:08:56',NULL,'2026-11-15 08:29:12','dropped','[{\"visit_type\":\"Dental\",\"listing_limit\":15},{\"visit_type\":\"Vision\",\"listing_limit\":15}]','NRS02000','2026-11-15 21:22:46'),('ADVLS-111526001','Advance listing for next december','2026-11-15 21:23:01',NULL,'2026-11-18 00:39:37','dropped','[{\"visit_type\":\"Dental\",\"listing_limit\":15},{\"visit_type\":\"Vision\",\"listing_limit\":15}]','NRS02000','2026-11-18 00:39:37'),('ADVLS-111826001','Advance listing for next december','2026-11-18 00:40:02',NULL,NULL,NULL,'[{\"visit_type\":\"Dental\",\"listing_limit\":15},{\"visit_type\":\"Vision\",\"listing_limit\":15}]','NRS02000',NULL);
/*!40000 ALTER TABLE `advance_listings` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-11-18  7:05:15
