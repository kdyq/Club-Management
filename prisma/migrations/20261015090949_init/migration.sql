-- CreateTable
CREATE TABLE `club` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(32) NOT NULL,
    `name` VARCHAR(64) NOT NULL,
    `short_name` VARCHAR(32) NULL,
    `logo_url` VARCHAR(255) NULL,
    `cover_url` VARCHAR(255) NULL,
    `description` TEXT NULL,
    `school_name` VARCHAR(64) NULL,
    `college_name` VARCHAR(64) NULL,
    `founded_at` DATE NULL,
    `contact_email` VARCHAR(64) NULL,
    `contact_phone` VARCHAR(20) NULL,
    `advisor_name` VARCHAR(32) NULL,
    `max_members` INTEGER NOT NULL DEFAULT 0,
    `status` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `created_by` BIGINT UNSIGNED NULL,
    `updated_by` BIGINT UNSIGNED NULL,
    `deleted_at` BIGINT UNSIGNED NOT NULL DEFAULT 0,

    UNIQUE INDEX `club_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `term` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `club_id` BIGINT UNSIGNED NOT NULL,
    `name` VARCHAR(32) NOT NULL,
    `start_date` DATE NOT NULL,
    `end_date` DATE NOT NULL,
    `is_current` BOOLEAN NOT NULL DEFAULT false,
    `status` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `created_by` BIGINT UNSIGNED NULL,
    `updated_by` BIGINT UNSIGNED NULL,
    `deleted_at` BIGINT UNSIGNED NOT NULL DEFAULT 0,

    INDEX `term_club_id_status_idx`(`club_id`, `status`),
    UNIQUE INDEX `term_club_id_name_deleted_at_key`(`club_id`, `name`, `deleted_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `department` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `club_id` BIGINT UNSIGNED NOT NULL,
    `parent_id` BIGINT UNSIGNED NULL,
    `name` VARCHAR(32) NOT NULL,
    `leader_member_id` BIGINT UNSIGNED NULL,
    `description` VARCHAR(255) NULL,
    `sort` INTEGER NOT NULL DEFAULT 0,
    `status` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `created_by` BIGINT UNSIGNED NULL,
    `updated_by` BIGINT UNSIGNED NULL,
    `deleted_at` BIGINT UNSIGNED NOT NULL DEFAULT 0,

    INDEX `department_club_id_status_idx`(`club_id`, `status`),
    INDEX `department_parent_id_idx`(`parent_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(64) NOT NULL,
    `password_hash` VARCHAR(100) NOT NULL,
    `real_name` VARCHAR(32) NOT NULL,
    `student_no` VARCHAR(32) NULL,
    `gender` INTEGER NOT NULL DEFAULT 0,
    `avatar_url` VARCHAR(255) NULL,
    `phone` VARCHAR(20) NULL,
    `email` VARCHAR(64) NULL,
    `college` VARCHAR(64) NULL,
    `major` VARCHAR(64) NULL,
    `class_name` VARCHAR(32) NULL,
    `grade` VARCHAR(8) NULL,
    `qq` VARCHAR(20) NULL,
    `wechat_openid` VARCHAR(64) NULL,
    `register_source` INTEGER NOT NULL DEFAULT 1,
    `status` INTEGER NOT NULL DEFAULT 1,
    `last_login_at` DATETIME(3) NULL,
    `last_login_ip` VARCHAR(45) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `created_by` BIGINT UNSIGNED NULL,
    `updated_by` BIGINT UNSIGNED NULL,
    `deleted_at` BIGINT UNSIGNED NOT NULL DEFAULT 0,

    UNIQUE INDEX `user_username_key`(`username`),
    UNIQUE INDEX `user_student_no_key`(`student_no`),
    INDEX `user_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `member` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `club_id` BIGINT UNSIGNED NOT NULL,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `term_id` BIGINT UNSIGNED NOT NULL,
    `dept_id` BIGINT UNSIGNED NULL,
    `member_no` VARCHAR(32) NULL,
    `position` INTEGER NOT NULL DEFAULT 6,
    `join_date` DATE NULL,
    `leave_date` DATE NULL,
    `leave_reason` VARCHAR(255) NULL,
    `status` INTEGER NOT NULL DEFAULT 1,
    `is_core` BOOLEAN NOT NULL DEFAULT false,
    `total_points` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `created_by` BIGINT UNSIGNED NULL,
    `updated_by` BIGINT UNSIGNED NULL,
    `deleted_at` BIGINT UNSIGNED NOT NULL DEFAULT 0,

    INDEX `member_club_id_status_idx`(`club_id`, `status`),
    INDEX `member_dept_id_idx`(`dept_id`),
    INDEX `member_term_id_idx`(`term_id`),
    UNIQUE INDEX `member_club_id_user_id_term_id_deleted_at_key`(`club_id`, `user_id`, `term_id`, `deleted_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `role` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `club_id` BIGINT UNSIGNED NOT NULL,
    `name` VARCHAR(32) NOT NULL,
    `code` VARCHAR(32) NOT NULL,
    `data_scope` INTEGER NOT NULL DEFAULT 1,
    `description` VARCHAR(255) NULL,
    `is_system` BOOLEAN NOT NULL DEFAULT false,
    `sort` INTEGER NOT NULL DEFAULT 0,
    `status` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `created_by` BIGINT UNSIGNED NULL,
    `updated_by` BIGINT UNSIGNED NULL,
    `deleted_at` BIGINT UNSIGNED NOT NULL DEFAULT 0,

    INDEX `role_club_id_status_idx`(`club_id`, `status`),
    UNIQUE INDEX `role_club_id_code_deleted_at_key`(`club_id`, `code`, `deleted_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `permission` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `parent_id` BIGINT UNSIGNED NULL,
    `name` VARCHAR(32) NOT NULL,
    `code` VARCHAR(64) NOT NULL,
    `type` INTEGER NOT NULL DEFAULT 2,
    `path` VARCHAR(128) NULL,
    `component` VARCHAR(128) NULL,
    `icon` VARCHAR(64) NULL,
    `sort` INTEGER NOT NULL DEFAULT 0,
    `status` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `created_by` BIGINT UNSIGNED NULL,
    `updated_by` BIGINT UNSIGNED NULL,
    `deleted_at` BIGINT UNSIGNED NOT NULL DEFAULT 0,

    UNIQUE INDEX `permission_code_key`(`code`),
    INDEX `permission_parent_id_idx`(`parent_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `member_role` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `member_id` BIGINT UNSIGNED NOT NULL,
    `role_id` BIGINT UNSIGNED NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `member_role_member_id_role_id_key`(`member_id`, `role_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `role_permission` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `role_id` BIGINT UNSIGNED NOT NULL,
    `permission_id` BIGINT UNSIGNED NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `role_permission_role_id_permission_id_key`(`role_id`, `permission_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sys_dict` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(64) NOT NULL,
    `name` VARCHAR(64) NOT NULL,
    `remark` VARCHAR(255) NULL,
    `status` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` BIGINT UNSIGNED NOT NULL DEFAULT 0,

    UNIQUE INDEX `sys_dict_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sys_dict_item` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `dict_id` BIGINT UNSIGNED NOT NULL,
    `label` VARCHAR(64) NOT NULL,
    `value` VARCHAR(64) NOT NULL,
    `sort` INTEGER NOT NULL DEFAULT 0,
    `color` VARCHAR(16) NULL,
    `is_default` BOOLEAN NOT NULL DEFAULT false,
    `status` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` BIGINT UNSIGNED NOT NULL DEFAULT 0,

    INDEX `sys_dict_item_dict_id_idx`(`dict_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sys_config` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `club_id` BIGINT UNSIGNED NULL,
    `config_key` VARCHAR(64) NOT NULL,
    `config_value` VARCHAR(255) NOT NULL,
    `name` VARCHAR(64) NOT NULL,
    `remark` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` BIGINT UNSIGNED NOT NULL DEFAULT 0,

    UNIQUE INDEX `sys_config_club_id_config_key_key`(`club_id`, `config_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `approval_flow` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `club_id` BIGINT UNSIGNED NOT NULL,
    `code` VARCHAR(32) NOT NULL,
    `name` VARCHAR(64) NOT NULL,
    `biz_type` VARCHAR(32) NOT NULL,
    `description` VARCHAR(255) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `status` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `created_by` BIGINT UNSIGNED NULL,
    `updated_by` BIGINT UNSIGNED NULL,
    `deleted_at` BIGINT UNSIGNED NOT NULL DEFAULT 0,

    UNIQUE INDEX `approval_flow_club_id_code_version_key`(`club_id`, `code`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `approval_node` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `flow_id` BIGINT UNSIGNED NOT NULL,
    `seq` INTEGER NOT NULL DEFAULT 1,
    `name` VARCHAR(32) NOT NULL,
    `approver_type` INTEGER NOT NULL,
    `approver_value` VARCHAR(64) NULL,
    `approve_mode` INTEGER NOT NULL DEFAULT 1,
    `allow_empty_skip` BOOLEAN NOT NULL DEFAULT false,
    `timeout_hours` INTEGER NOT NULL DEFAULT 0,
    `timeout_action` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` BIGINT UNSIGNED NOT NULL DEFAULT 0,

    INDEX `approval_node_flow_id_seq_idx`(`flow_id`, `seq`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `approval_instance` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `club_id` BIGINT UNSIGNED NOT NULL,
    `flow_id` BIGINT UNSIGNED NOT NULL,
    `biz_type` VARCHAR(32) NOT NULL,
    `biz_id` BIGINT UNSIGNED NOT NULL,
    `title` VARCHAR(128) NOT NULL,
    `applicant_member_id` BIGINT UNSIGNED NOT NULL,
    `current_seq` INTEGER NOT NULL DEFAULT 1,
    `status` INTEGER NOT NULL DEFAULT 1,
    `form_data_json` JSON NULL,
    `submit_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `finish_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` BIGINT UNSIGNED NOT NULL DEFAULT 0,

    INDEX `approval_instance_biz_type_biz_id_idx`(`biz_type`, `biz_id`),
    INDEX `approval_instance_applicant_member_id_status_idx`(`applicant_member_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `approval_task` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `instance_id` BIGINT UNSIGNED NOT NULL,
    `node_id` BIGINT UNSIGNED NOT NULL,
    `seq` INTEGER NOT NULL,
    `approver_member_id` BIGINT UNSIGNED NOT NULL,
    `status` INTEGER NOT NULL DEFAULT 1,
    `opinion` VARCHAR(500) NULL,
    `attachment_file_id` BIGINT UNSIGNED NULL,
    `delegate_from` BIGINT UNSIGNED NULL,
    `handled_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` BIGINT UNSIGNED NOT NULL DEFAULT 0,

    INDEX `approval_task_instance_id_status_idx`(`instance_id`, `status`),
    INDEX `approval_task_approver_member_id_status_idx`(`approver_member_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `activity_category` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `club_id` BIGINT UNSIGNED NOT NULL,
    `name` VARCHAR(32) NOT NULL,
    `color` VARCHAR(16) NULL,
    `sort` INTEGER NOT NULL DEFAULT 0,
    `status` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` BIGINT UNSIGNED NOT NULL DEFAULT 0,

    INDEX `activity_category_club_id_status_idx`(`club_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `activity` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `club_id` BIGINT UNSIGNED NOT NULL,
    `category_id` BIGINT UNSIGNED NULL,
    `term_id` BIGINT UNSIGNED NULL,
    `title` VARCHAR(128) NOT NULL,
    `cover_url` VARCHAR(255) NULL,
    `summary` VARCHAR(255) NULL,
    `content` TEXT NULL,
    `location` VARCHAR(128) NULL,
    `start_time` DATETIME(3) NOT NULL,
    `end_time` DATETIME(3) NOT NULL,
    `signup_start` DATETIME(3) NULL,
    `signup_end` DATETIME(3) NULL,
    `capacity` INTEGER NOT NULL DEFAULT 0,
    `min_members` INTEGER NOT NULL DEFAULT 0,
    `need_audit` BOOLEAN NOT NULL DEFAULT false,
    `allow_guest` BOOLEAN NOT NULL DEFAULT false,
    `organizer_member_id` BIGINT UNSIGNED NULL,
    `contact_info` VARCHAR(128) NULL,
    `checkin_type` INTEGER NOT NULL DEFAULT 1,
    `checkin_start` DATETIME(3) NULL,
    `checkin_end` DATETIME(3) NULL,
    `qr_secret` VARCHAR(64) NULL,
    `qr_refresh_sec` INTEGER NOT NULL DEFAULT 30,
    `points` INTEGER NOT NULL DEFAULT 0,
    `volunteer_hours` DECIMAL(6, 1) NOT NULL DEFAULT 0,
    `budget_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `actual_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `status` INTEGER NOT NULL DEFAULT 1,
    `approval_instance_id` BIGINT UNSIGNED NULL,
    `summary_report` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `created_by` BIGINT UNSIGNED NULL,
    `updated_by` BIGINT UNSIGNED NULL,
    `deleted_at` BIGINT UNSIGNED NOT NULL DEFAULT 0,

    INDEX `activity_club_id_status_start_time_idx`(`club_id`, `status`, `start_time`),
    INDEX `activity_term_id_idx`(`term_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `activity_registration` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `club_id` BIGINT UNSIGNED NOT NULL,
    `activity_id` BIGINT UNSIGNED NOT NULL,
    `member_id` BIGINT UNSIGNED NULL,
    `user_id` BIGINT UNSIGNED NULL,
    `guest_name` VARCHAR(32) NULL,
    `guest_phone` VARCHAR(20) NULL,
    `apply_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `status` INTEGER NOT NULL DEFAULT 1,
    `audit_by` BIGINT UNSIGNED NULL,
    `audit_at` DATETIME(3) NULL,
    `audit_remark` VARCHAR(255) NULL,
    `remark` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` BIGINT UNSIGNED NOT NULL DEFAULT 0,

    INDEX `activity_registration_activity_id_status_idx`(`activity_id`, `status`),
    UNIQUE INDEX `activity_registration_activity_id_member_id_deleted_at_key`(`activity_id`, `member_id`, `deleted_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `activity_checkin` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `club_id` BIGINT UNSIGNED NOT NULL,
    `activity_id` BIGINT UNSIGNED NOT NULL,
    `registration_id` BIGINT UNSIGNED NULL,
    `member_id` BIGINT UNSIGNED NOT NULL,
    `checkin_time` DATETIME(3) NULL,
    `checkin_type` INTEGER NOT NULL DEFAULT 1,
    `checkin_lat` DECIMAL(10, 7) NULL,
    `checkin_lng` DECIMAL(10, 7) NULL,
    `checkin_ip` VARCHAR(45) NULL,
    `device_info` VARCHAR(255) NULL,
    `signout_time` DATETIME(3) NULL,
    `duration_min` INTEGER NULL,
    `status` INTEGER NOT NULL DEFAULT 1,
    `is_makeup` BOOLEAN NOT NULL DEFAULT false,
    `makeup_by` BIGINT UNSIGNED NULL,
    `makeup_reason` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` BIGINT UNSIGNED NOT NULL DEFAULT 0,

    UNIQUE INDEX `activity_checkin_registration_id_key`(`registration_id`),
    INDEX `activity_checkin_activity_id_status_idx`(`activity_id`, `status`),
    UNIQUE INDEX `activity_checkin_activity_id_member_id_deleted_at_key`(`activity_id`, `member_id`, `deleted_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `activity_leave` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `club_id` BIGINT UNSIGNED NOT NULL,
    `activity_id` BIGINT UNSIGNED NOT NULL,
    `member_id` BIGINT UNSIGNED NOT NULL,
    `reason` VARCHAR(500) NOT NULL,
    `attachment_file_id` BIGINT UNSIGNED NULL,
    `status` INTEGER NOT NULL DEFAULT 1,
    `audit_by` BIGINT UNSIGNED NULL,
    `audit_at` DATETIME(3) NULL,
    `audit_remark` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` BIGINT UNSIGNED NOT NULL DEFAULT 0,

    UNIQUE INDEX `activity_leave_activity_id_member_id_deleted_at_key`(`activity_id`, `member_id`, `deleted_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fund_account` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `club_id` BIGINT UNSIGNED NOT NULL,
    `name` VARCHAR(32) NOT NULL,
    `account_no` VARCHAR(32) NULL,
    `initial_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `is_default` BOOLEAN NOT NULL DEFAULT false,
    `status` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `created_by` BIGINT UNSIGNED NULL,
    `updated_by` BIGINT UNSIGNED NULL,
    `deleted_at` BIGINT UNSIGNED NOT NULL DEFAULT 0,

    INDEX `fund_account_club_id_status_idx`(`club_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fund_category` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `club_id` BIGINT UNSIGNED NOT NULL,
    `parent_id` BIGINT UNSIGNED NULL,
    `name` VARCHAR(32) NOT NULL,
    `type` INTEGER NOT NULL,
    `sort` INTEGER NOT NULL DEFAULT 0,
    `status` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` BIGINT UNSIGNED NOT NULL DEFAULT 0,

    INDEX `fund_category_club_id_type_status_idx`(`club_id`, `type`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fund_transaction` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `club_id` BIGINT UNSIGNED NOT NULL,
    `account_id` BIGINT UNSIGNED NOT NULL,
    `category_id` BIGINT UNSIGNED NULL,
    `term_id` BIGINT UNSIGNED NULL,
    `type` INTEGER NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `title` VARCHAR(128) NOT NULL,
    `occurred_at` DATE NOT NULL,
    `biz_type` VARCHAR(32) NULL,
    `biz_id` BIGINT UNSIGNED NULL,
    `handler_member_id` BIGINT UNSIGNED NULL,
    `status` INTEGER NOT NULL DEFAULT 2,
    `approval_instance_id` BIGINT UNSIGNED NULL,
    `void_reason` VARCHAR(255) NULL,
    `remark` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `created_by` BIGINT UNSIGNED NULL,
    `updated_by` BIGINT UNSIGNED NULL,
    `deleted_at` BIGINT UNSIGNED NOT NULL DEFAULT 0,

    INDEX `fund_transaction_club_id_occurred_at_idx`(`club_id`, `occurred_at`),
    INDEX `fund_transaction_biz_type_biz_id_idx`(`biz_type`, `biz_id`),
    INDEX `fund_transaction_account_id_idx`(`account_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `operation_log` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `club_id` BIGINT UNSIGNED NULL,
    `user_id` BIGINT UNSIGNED NULL,
    `member_id` BIGINT UNSIGNED NULL,
    `module` VARCHAR(32) NULL,
    `action` VARCHAR(32) NULL,
    `biz_type` VARCHAR(32) NULL,
    `biz_id` BIGINT UNSIGNED NULL,
    `request_uri` VARCHAR(255) NULL,
    `request_method` VARCHAR(8) NULL,
    `request_params` JSON NULL,
    `before_value` JSON NULL,
    `after_value` JSON NULL,
    `ip` VARCHAR(45) NULL,
    `user_agent` VARCHAR(255) NULL,
    `duration_ms` INTEGER NULL,
    `status` INTEGER NOT NULL DEFAULT 1,
    `error_msg` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `operation_log_club_id_created_at_idx`(`club_id`, `created_at`),
    INDEX `operation_log_biz_type_biz_id_idx`(`biz_type`, `biz_id`),
    INDEX `operation_log_user_id_created_at_idx`(`user_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `login_log` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NULL,
    `username` VARCHAR(64) NULL,
    `ip` VARCHAR(45) NULL,
    `location` VARCHAR(64) NULL,
    `browser` VARCHAR(64) NULL,
    `os` VARCHAR(64) NULL,
    `status` INTEGER NOT NULL DEFAULT 1,
    `msg` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `login_log_user_id_created_at_idx`(`user_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `announcement` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `club_id` BIGINT UNSIGNED NOT NULL,
    `title` VARCHAR(128) NOT NULL,
    `content` TEXT NOT NULL,
    `type` INTEGER NOT NULL DEFAULT 2,
    `cover_url` VARCHAR(255) NULL,
    `is_top` BOOLEAN NOT NULL DEFAULT false,
    `publish_status` INTEGER NOT NULL DEFAULT 1,
    `publish_at` DATETIME(3) NULL,
    `expire_at` DATETIME(3) NULL,
    `target_scope` JSON NULL,
    `publisher_member_id` BIGINT UNSIGNED NULL,
    `view_count` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` BIGINT UNSIGNED NOT NULL DEFAULT 0,

    INDEX `announcement_club_id_publish_status_publish_at_idx`(`club_id`, `publish_status`, `publish_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notification` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `club_id` BIGINT UNSIGNED NOT NULL,
    `title` VARCHAR(128) NOT NULL,
    `content` TEXT NOT NULL,
    `type` INTEGER NOT NULL DEFAULT 1,
    `biz_type` VARCHAR(32) NULL,
    `biz_id` BIGINT UNSIGNED NULL,
    `sender_id` BIGINT UNSIGNED NULL,
    `channel_json` JSON NULL,
    `send_time` DATETIME(3) NULL,
    `status` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` BIGINT UNSIGNED NOT NULL DEFAULT 0,

    INDEX `notification_club_id_type_created_at_idx`(`club_id`, `type`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notification_receiver` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `notification_id` BIGINT UNSIGNED NOT NULL,
    `receiver_user_id` BIGINT UNSIGNED NOT NULL,
    `is_read` BOOLEAN NOT NULL DEFAULT false,
    `read_at` DATETIME(3) NULL,
    `is_deleted` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notification_receiver_receiver_user_id_is_read_idx`(`receiver_user_id`, `is_read`),
    UNIQUE INDEX `notification_receiver_notification_id_receiver_user_id_key`(`notification_id`, `receiver_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notification_template` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `club_id` BIGINT UNSIGNED NULL,
    `code` VARCHAR(64) NOT NULL,
    `name` VARCHAR(64) NOT NULL,
    `title_tpl` VARCHAR(255) NOT NULL,
    `content_tpl` TEXT NOT NULL,
    `channel_mask` INTEGER NOT NULL DEFAULT 1,
    `status` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` BIGINT UNSIGNED NOT NULL DEFAULT 0,

    UNIQUE INDEX `notification_template_club_id_code_key`(`club_id`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `message_channel_config` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `club_id` BIGINT UNSIGNED NOT NULL,
    `channel` INTEGER NOT NULL,
    `config_json` JSON NOT NULL,
    `status` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` BIGINT UNSIGNED NOT NULL DEFAULT 0,

    UNIQUE INDEX `message_channel_config_club_id_channel_key`(`club_id`, `channel`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `file_folder` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `club_id` BIGINT UNSIGNED NOT NULL,
    `parent_id` BIGINT UNSIGNED NULL,
    `name` VARCHAR(64) NOT NULL,
    `scope` INTEGER NOT NULL DEFAULT 2,
    `owner_dept_id` BIGINT UNSIGNED NULL,
    `sort` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `created_by` BIGINT UNSIGNED NULL,
    `deleted_at` BIGINT UNSIGNED NOT NULL DEFAULT 0,

    INDEX `file_folder_club_id_parent_id_idx`(`club_id`, `parent_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `file` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `club_id` BIGINT UNSIGNED NOT NULL,
    `folder_id` BIGINT UNSIGNED NULL,
    `name` VARCHAR(255) NOT NULL,
    `original_name` VARCHAR(255) NOT NULL,
    `ext` VARCHAR(16) NULL,
    `mime_type` VARCHAR(128) NULL,
    `size` BIGINT UNSIGNED NOT NULL,
    `storage_type` INTEGER NOT NULL DEFAULT 1,
    `storage_path` VARCHAR(500) NOT NULL,
    `md5` VARCHAR(32) NULL,
    `file_group_id` BIGINT UNSIGNED NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `is_latest` BOOLEAN NOT NULL DEFAULT true,
    `download_count` INTEGER NOT NULL DEFAULT 0,
    `biz_type` VARCHAR(32) NULL,
    `biz_id` BIGINT UNSIGNED NULL,
    `scope` INTEGER NOT NULL DEFAULT 2,
    `uploader_id` BIGINT UNSIGNED NULL,
    `status` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` BIGINT UNSIGNED NOT NULL DEFAULT 0,

    INDEX `file_club_id_folder_id_idx`(`club_id`, `folder_id`),
    INDEX `file_md5_idx`(`md5`),
    INDEX `file_biz_type_biz_id_idx`(`biz_type`, `biz_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `file_grant` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `file_id` BIGINT UNSIGNED NOT NULL,
    `target_type` INTEGER NOT NULL,
    `target_id` BIGINT UNSIGNED NOT NULL,
    `can_read` BOOLEAN NOT NULL DEFAULT true,
    `can_write` BOOLEAN NOT NULL DEFAULT false,
    `can_download` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `file_grant_file_id_target_type_target_id_key`(`file_id`, `target_type`, `target_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `asset` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `club_id` BIGINT UNSIGNED NOT NULL,
    `code` VARCHAR(32) NULL,
    `name` VARCHAR(64) NOT NULL,
    `category` VARCHAR(32) NULL,
    `spec` VARCHAR(64) NULL,
    `unit` VARCHAR(16) NULL,
    `total_qty` INTEGER NOT NULL DEFAULT 0,
    `available_qty` INTEGER NOT NULL DEFAULT 0,
    `location` VARCHAR(64) NULL,
    `purchase_date` DATE NULL,
    `price` DECIMAL(12, 2) NULL,
    `keeper_member_id` BIGINT UNSIGNED NULL,
    `status` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` BIGINT UNSIGNED NOT NULL DEFAULT 0,

    INDEX `asset_club_id_status_idx`(`club_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `asset_borrow` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `club_id` BIGINT UNSIGNED NOT NULL,
    `asset_id` BIGINT UNSIGNED NOT NULL,
    `member_id` BIGINT UNSIGNED NOT NULL,
    `qty` INTEGER NOT NULL,
    `borrow_time` DATETIME(3) NOT NULL,
    `expect_return_time` DATETIME(3) NULL,
    `actual_return_time` DATETIME(3) NULL,
    `status` INTEGER NOT NULL DEFAULT 1,
    `approver_member_id` BIGINT UNSIGNED NULL,
    `remark` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` BIGINT UNSIGNED NOT NULL DEFAULT 0,

    INDEX `asset_borrow_club_id_status_idx`(`club_id`, `status`),
    INDEX `asset_borrow_asset_id_idx`(`asset_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `venue` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `club_id` BIGINT UNSIGNED NOT NULL,
    `name` VARCHAR(64) NOT NULL,
    `location` VARCHAR(128) NULL,
    `capacity` INTEGER NOT NULL DEFAULT 0,
    `open_weekdays` VARCHAR(32) NULL,
    `open_time` VARCHAR(8) NULL,
    `close_time` VARCHAR(8) NULL,
    `status` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` BIGINT UNSIGNED NOT NULL DEFAULT 0,

    INDEX `venue_club_id_status_idx`(`club_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `venue_booking` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `club_id` BIGINT UNSIGNED NOT NULL,
    `venue_id` BIGINT UNSIGNED NOT NULL,
    `activity_id` BIGINT UNSIGNED NULL,
    `member_id` BIGINT UNSIGNED NOT NULL,
    `book_date` DATE NOT NULL,
    `start_time` VARCHAR(8) NOT NULL,
    `end_time` VARCHAR(8) NOT NULL,
    `purpose` VARCHAR(255) NULL,
    `status` INTEGER NOT NULL DEFAULT 1,
    `approver_member_id` BIGINT UNSIGNED NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` BIGINT UNSIGNED NOT NULL DEFAULT 0,

    INDEX `venue_booking_venue_id_book_date_status_idx`(`venue_id`, `book_date`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `duty_plan` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `club_id` BIGINT UNSIGNED NOT NULL,
    `term_id` BIGINT UNSIGNED NOT NULL,
    `name` VARCHAR(64) NOT NULL,
    `start_date` DATE NOT NULL,
    `end_date` DATE NOT NULL,
    `publish_status` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` BIGINT UNSIGNED NOT NULL DEFAULT 0,

    INDEX `duty_plan_club_id_term_id_idx`(`club_id`, `term_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `duty_schedule` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `plan_id` BIGINT UNSIGNED NOT NULL,
    `club_id` BIGINT UNSIGNED NOT NULL,
    `duty_date` DATE NOT NULL,
    `weekday` INTEGER NOT NULL,
    `start_time` VARCHAR(8) NOT NULL,
    `end_time` VARCHAR(8) NOT NULL,
    `location` VARCHAR(64) NULL,
    `member_id` BIGINT UNSIGNED NOT NULL,
    `status` INTEGER NOT NULL DEFAULT 1,
    `checkin_time` DATETIME(3) NULL,
    `checkin_lat` DECIMAL(10, 7) NULL,
    `checkin_lng` DECIMAL(10, 7) NULL,
    `actual_minutes` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` BIGINT UNSIGNED NOT NULL DEFAULT 0,

    INDEX `duty_schedule_club_id_duty_date_idx`(`club_id`, `duty_date`),
    INDEX `duty_schedule_member_id_duty_date_idx`(`member_id`, `duty_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `duty_log` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `schedule_id` BIGINT UNSIGNED NOT NULL,
    `member_id` BIGINT UNSIGNED NOT NULL,
    `content` TEXT NOT NULL,
    `handover_content` TEXT NULL,
    `attachment_file_id` BIGINT UNSIGNED NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` BIGINT UNSIGNED NOT NULL DEFAULT 0,

    INDEX `duty_log_schedule_id_idx`(`schedule_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `duty_swap` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `schedule_id` BIGINT UNSIGNED NOT NULL,
    `from_member_id` BIGINT UNSIGNED NOT NULL,
    `to_member_id` BIGINT UNSIGNED NOT NULL,
    `reason` VARCHAR(255) NOT NULL,
    `status` INTEGER NOT NULL DEFAULT 1,
    `approver_member_id` BIGINT UNSIGNED NULL,
    `approved_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` BIGINT UNSIGNED NOT NULL DEFAULT 0,

    INDEX `duty_swap_schedule_id_idx`(`schedule_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `member_availability` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `club_id` BIGINT UNSIGNED NOT NULL,
    `member_id` BIGINT UNSIGNED NOT NULL,
    `term_id` BIGINT UNSIGNED NOT NULL,
    `weekday` INTEGER NOT NULL,
    `start_time` VARCHAR(8) NOT NULL,
    `end_time` VARCHAR(8) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` BIGINT UNSIGNED NOT NULL DEFAULT 0,

    INDEX `member_availability_club_id_term_id_weekday_idx`(`club_id`, `term_id`, `weekday`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fund_budget` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `club_id` BIGINT UNSIGNED NOT NULL,
    `term_id` BIGINT UNSIGNED NULL,
    `activity_id` BIGINT UNSIGNED NULL,
    `category_id` BIGINT UNSIGNED NULL,
    `name` VARCHAR(64) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `used_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `period_start` DATE NULL,
    `period_end` DATE NULL,
    `status` INTEGER NOT NULL DEFAULT 1,
    `approval_instance_id` BIGINT UNSIGNED NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` BIGINT UNSIGNED NOT NULL DEFAULT 0,

    INDEX `fund_budget_club_id_status_idx`(`club_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fund_voucher` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `transaction_id` BIGINT UNSIGNED NOT NULL,
    `file_id` BIGINT UNSIGNED NOT NULL,
    `sort` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `fund_voucher_transaction_id_idx`(`transaction_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `member_fee_standard` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `club_id` BIGINT UNSIGNED NOT NULL,
    `term_id` BIGINT UNSIGNED NOT NULL,
    `name` VARCHAR(64) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `due_date` DATE NOT NULL,
    `target_type` INTEGER NOT NULL DEFAULT 1,
    `target_ids` JSON NULL,
    `status` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` BIGINT UNSIGNED NOT NULL DEFAULT 0,

    INDEX `member_fee_standard_club_id_term_id_idx`(`club_id`, `term_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `member_fee` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `club_id` BIGINT UNSIGNED NOT NULL,
    `fee_standard_id` BIGINT UNSIGNED NOT NULL,
    `member_id` BIGINT UNSIGNED NOT NULL,
    `should_amount` DECIMAL(12, 2) NOT NULL,
    `paid_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `paid_at` DATETIME(3) NULL,
    `pay_method` INTEGER NULL,
    `voucher_file_id` BIGINT UNSIGNED NULL,
    `status` INTEGER NOT NULL DEFAULT 1,
    `operator_member_id` BIGINT UNSIGNED NULL,
    `remark` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` BIGINT UNSIGNED NOT NULL DEFAULT 0,

    INDEX `member_fee_club_id_status_idx`(`club_id`, `status`),
    UNIQUE INDEX `member_fee_fee_standard_id_member_id_key`(`fee_standard_id`, `member_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `point_rule` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `club_id` BIGINT UNSIGNED NOT NULL,
    `code` VARCHAR(32) NOT NULL,
    `name` VARCHAR(64) NOT NULL,
    `event_type` INTEGER NOT NULL,
    `points` INTEGER NOT NULL,
    `max_per_term` INTEGER NOT NULL DEFAULT 0,
    `valid_from` DATE NULL,
    `valid_to` DATE NULL,
    `status` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` BIGINT UNSIGNED NOT NULL DEFAULT 0,

    UNIQUE INDEX `point_rule_club_id_code_key`(`club_id`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `point_record` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `club_id` BIGINT UNSIGNED NOT NULL,
    `member_id` BIGINT UNSIGNED NOT NULL,
    `term_id` BIGINT UNSIGNED NULL,
    `rule_id` BIGINT UNSIGNED NULL,
    `points` INTEGER NOT NULL,
    `reason` VARCHAR(255) NULL,
    `biz_type` VARCHAR(32) NULL,
    `biz_id` BIGINT UNSIGNED NULL,
    `occurred_at` DATETIME(3) NOT NULL,
    `operator_id` BIGINT UNSIGNED NULL,
    `status` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` BIGINT UNSIGNED NOT NULL DEFAULT 0,

    INDEX `point_record_club_id_member_id_idx`(`club_id`, `member_id`),
    INDEX `point_record_term_id_idx`(`term_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `assessment` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `club_id` BIGINT UNSIGNED NOT NULL,
    `term_id` BIGINT UNSIGNED NOT NULL,
    `member_id` BIGINT UNSIGNED NOT NULL,
    `attendance_score` DECIMAL(5, 2) NULL,
    `activity_score` DECIMAL(5, 2) NULL,
    `duty_score` DECIMAL(5, 2) NULL,
    `contribution_score` DECIMAL(5, 2) NULL,
    `total_score` DECIMAL(5, 2) NULL,
    `grade` VARCHAR(16) NULL,
    `comment` VARCHAR(500) NULL,
    `evaluator_member_id` BIGINT UNSIGNED NULL,
    `status` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` BIGINT UNSIGNED NOT NULL DEFAULT 0,

    INDEX `assessment_club_id_term_id_idx`(`club_id`, `term_id`),
    UNIQUE INDEX `assessment_term_id_member_id_deleted_at_key`(`term_id`, `member_id`, `deleted_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `volunteer_hour` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `club_id` BIGINT UNSIGNED NOT NULL,
    `member_id` BIGINT UNSIGNED NOT NULL,
    `activity_id` BIGINT UNSIGNED NULL,
    `hours` DECIMAL(6, 1) NOT NULL,
    `certify_status` INTEGER NOT NULL DEFAULT 1,
    `certifier_member_id` BIGINT UNSIGNED NULL,
    `certified_at` DATETIME(3) NULL,
    `certificate_no` VARCHAR(32) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` BIGINT UNSIGNED NOT NULL DEFAULT 0,

    INDEX `volunteer_hour_club_id_member_id_idx`(`club_id`, `member_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `recruit_campaign` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `club_id` BIGINT UNSIGNED NOT NULL,
    `term_id` BIGINT UNSIGNED NULL,
    `title` VARCHAR(128) NOT NULL,
    `description` TEXT NULL,
    `cover_url` VARCHAR(255) NULL,
    `start_time` DATETIME(3) NOT NULL,
    `end_time` DATETIME(3) NOT NULL,
    `plan_headcount` INTEGER NOT NULL DEFAULT 0,
    `target_dept_ids` JSON NULL,
    `form_schema_json` JSON NULL,
    `status` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` BIGINT UNSIGNED NOT NULL DEFAULT 0,

    INDEX `recruit_campaign_club_id_status_idx`(`club_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `recruit_application` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `campaign_id` BIGINT UNSIGNED NOT NULL,
    `club_id` BIGINT UNSIGNED NOT NULL,
    `applicant_name` VARCHAR(32) NOT NULL,
    `student_no` VARCHAR(32) NOT NULL,
    `gender` INTEGER NOT NULL DEFAULT 0,
    `college` VARCHAR(64) NULL,
    `major` VARCHAR(64) NULL,
    `grade` VARCHAR(8) NULL,
    `class_name` VARCHAR(32) NULL,
    `phone` VARCHAR(20) NULL,
    `email` VARCHAR(64) NULL,
    `dept_pref_1` VARCHAR(32) NULL,
    `dept_pref_2` VARCHAR(32) NULL,
    `self_intro` TEXT NULL,
    `form_data_json` JSON NULL,
    `resume_file_id` BIGINT UNSIGNED NULL,
    `status` INTEGER NOT NULL DEFAULT 1,
    `reject_reason` VARCHAR(255) NULL,
    `converted_member_id` BIGINT UNSIGNED NULL,
    `submit_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` BIGINT UNSIGNED NOT NULL DEFAULT 0,

    INDEX `recruit_application_campaign_id_status_idx`(`campaign_id`, `status`),
    INDEX `recruit_application_student_no_idx`(`student_no`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `interview_slot` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `campaign_id` BIGINT UNSIGNED NOT NULL,
    `dept_id` BIGINT UNSIGNED NULL,
    `interview_date` DATE NOT NULL,
    `start_time` VARCHAR(8) NOT NULL,
    `end_time` VARCHAR(8) NOT NULL,
    `location` VARCHAR(64) NULL,
    `interviewer_member_id` BIGINT UNSIGNED NULL,
    `capacity` INTEGER NOT NULL DEFAULT 1,
    `booked_count` INTEGER NOT NULL DEFAULT 0,
    `status` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` BIGINT UNSIGNED NOT NULL DEFAULT 0,

    INDEX `interview_slot_campaign_id_interview_date_idx`(`campaign_id`, `interview_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `interview_appointment` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `application_id` BIGINT UNSIGNED NOT NULL,
    `slot_id` BIGINT UNSIGNED NOT NULL,
    `status` INTEGER NOT NULL DEFAULT 1,
    `remark` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `interview_appointment_slot_id_idx`(`slot_id`),
    UNIQUE INDEX `interview_appointment_application_id_key`(`application_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `interview_score` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `application_id` BIGINT UNSIGNED NOT NULL,
    `interviewer_member_id` BIGINT UNSIGNED NOT NULL,
    `expression_score` DECIMAL(5, 2) NULL,
    `skill_score` DECIMAL(5, 2) NULL,
    `attitude_score` DECIMAL(5, 2) NULL,
    `total_score` DECIMAL(5, 2) NULL,
    `comment` VARCHAR(500) NULL,
    `suggestion` INTEGER NOT NULL DEFAULT 2,
    `scored_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `interview_score_application_id_interviewer_member_id_key`(`application_id`, `interviewer_member_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vote` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `club_id` BIGINT UNSIGNED NOT NULL,
    `title` VARCHAR(128) NOT NULL,
    `description` TEXT NULL,
    `type` INTEGER NOT NULL DEFAULT 1,
    `is_anonymous` BOOLEAN NOT NULL DEFAULT false,
    `max_choices` INTEGER NOT NULL DEFAULT 1,
    `start_time` DATETIME(3) NOT NULL,
    `end_time` DATETIME(3) NOT NULL,
    `target_scope` JSON NULL,
    `status` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` BIGINT UNSIGNED NOT NULL DEFAULT 0,

    INDEX `vote_club_id_status_idx`(`club_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vote_option` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `vote_id` BIGINT UNSIGNED NOT NULL,
    `content` VARCHAR(255) NOT NULL,
    `image_url` VARCHAR(255) NULL,
    `sort` INTEGER NOT NULL DEFAULT 0,
    `vote_count` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `vote_option_vote_id_idx`(`vote_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vote_record` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `vote_id` BIGINT UNSIGNED NOT NULL,
    `option_id` BIGINT UNSIGNED NOT NULL,
    `member_id` BIGINT UNSIGNED NOT NULL,
    `voted_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `ip` VARCHAR(45) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `vote_record_vote_id_option_id_member_id_key`(`vote_id`, `option_id`, `member_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `activity_photo` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `activity_id` BIGINT UNSIGNED NOT NULL,
    `file_id` BIGINT UNSIGNED NOT NULL,
    `caption` VARCHAR(255) NULL,
    `sort` INTEGER NOT NULL DEFAULT 0,
    `status` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` BIGINT UNSIGNED NOT NULL DEFAULT 0,

    INDEX `activity_photo_activity_id_idx`(`activity_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `honor` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `club_id` BIGINT UNSIGNED NOT NULL,
    `title` VARCHAR(128) NOT NULL,
    `level` VARCHAR(16) NULL,
    `awarded_at` DATE NULL,
    `description` TEXT NULL,
    `certificate_file_id` BIGINT UNSIGNED NULL,
    `sort` INTEGER NOT NULL DEFAULT 0,
    `status` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` BIGINT UNSIGNED NOT NULL DEFAULT 0,

    INDEX `honor_club_id_status_idx`(`club_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `activity_task` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `activity_id` BIGINT UNSIGNED NOT NULL,
    `title` VARCHAR(128) NOT NULL,
    `assignee_member_id` BIGINT UNSIGNED NULL,
    `due_time` DATETIME(3) NULL,
    `status` INTEGER NOT NULL DEFAULT 1,
    `remark` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` BIGINT UNSIGNED NOT NULL DEFAULT 0,

    INDEX `activity_task_activity_id_status_idx`(`activity_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `department` ADD CONSTRAINT `department_leader_member_id_fkey` FOREIGN KEY (`leader_member_id`) REFERENCES `member`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `department` ADD CONSTRAINT `department_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `department`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `member` ADD CONSTRAINT `member_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `member` ADD CONSTRAINT `member_term_id_fkey` FOREIGN KEY (`term_id`) REFERENCES `term`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `member` ADD CONSTRAINT `member_dept_id_fkey` FOREIGN KEY (`dept_id`) REFERENCES `department`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `permission` ADD CONSTRAINT `permission_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `permission`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `member_role` ADD CONSTRAINT `member_role_member_id_fkey` FOREIGN KEY (`member_id`) REFERENCES `member`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `member_role` ADD CONSTRAINT `member_role_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `role`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `role_permission` ADD CONSTRAINT `role_permission_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `role`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `role_permission` ADD CONSTRAINT `role_permission_permission_id_fkey` FOREIGN KEY (`permission_id`) REFERENCES `permission`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sys_dict_item` ADD CONSTRAINT `sys_dict_item_dict_id_fkey` FOREIGN KEY (`dict_id`) REFERENCES `sys_dict`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `approval_node` ADD CONSTRAINT `approval_node_flow_id_fkey` FOREIGN KEY (`flow_id`) REFERENCES `approval_flow`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `approval_instance` ADD CONSTRAINT `approval_instance_flow_id_fkey` FOREIGN KEY (`flow_id`) REFERENCES `approval_flow`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `approval_instance` ADD CONSTRAINT `approval_instance_applicant_member_id_fkey` FOREIGN KEY (`applicant_member_id`) REFERENCES `member`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `approval_task` ADD CONSTRAINT `approval_task_instance_id_fkey` FOREIGN KEY (`instance_id`) REFERENCES `approval_instance`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `approval_task` ADD CONSTRAINT `approval_task_node_id_fkey` FOREIGN KEY (`node_id`) REFERENCES `approval_node`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `approval_task` ADD CONSTRAINT `approval_task_approver_member_id_fkey` FOREIGN KEY (`approver_member_id`) REFERENCES `member`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `activity` ADD CONSTRAINT `activity_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `activity_category`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `activity` ADD CONSTRAINT `activity_term_id_fkey` FOREIGN KEY (`term_id`) REFERENCES `term`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `activity` ADD CONSTRAINT `activity_organizer_member_id_fkey` FOREIGN KEY (`organizer_member_id`) REFERENCES `member`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `activity_registration` ADD CONSTRAINT `activity_registration_activity_id_fkey` FOREIGN KEY (`activity_id`) REFERENCES `activity`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `activity_registration` ADD CONSTRAINT `activity_registration_member_id_fkey` FOREIGN KEY (`member_id`) REFERENCES `member`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `activity_checkin` ADD CONSTRAINT `activity_checkin_activity_id_fkey` FOREIGN KEY (`activity_id`) REFERENCES `activity`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `activity_checkin` ADD CONSTRAINT `activity_checkin_registration_id_fkey` FOREIGN KEY (`registration_id`) REFERENCES `activity_registration`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `activity_checkin` ADD CONSTRAINT `activity_checkin_member_id_fkey` FOREIGN KEY (`member_id`) REFERENCES `member`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `activity_leave` ADD CONSTRAINT `activity_leave_activity_id_fkey` FOREIGN KEY (`activity_id`) REFERENCES `activity`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `activity_leave` ADD CONSTRAINT `activity_leave_member_id_fkey` FOREIGN KEY (`member_id`) REFERENCES `member`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fund_category` ADD CONSTRAINT `fund_category_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `fund_category`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fund_transaction` ADD CONSTRAINT `fund_transaction_account_id_fkey` FOREIGN KEY (`account_id`) REFERENCES `fund_account`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fund_transaction` ADD CONSTRAINT `fund_transaction_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `fund_category`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fund_transaction` ADD CONSTRAINT `fund_transaction_term_id_fkey` FOREIGN KEY (`term_id`) REFERENCES `term`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fund_transaction` ADD CONSTRAINT `fund_transaction_handler_member_id_fkey` FOREIGN KEY (`handler_member_id`) REFERENCES `member`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `announcement` ADD CONSTRAINT `announcement_publisher_member_id_fkey` FOREIGN KEY (`publisher_member_id`) REFERENCES `member`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notification_receiver` ADD CONSTRAINT `notification_receiver_notification_id_fkey` FOREIGN KEY (`notification_id`) REFERENCES `notification`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notification_receiver` ADD CONSTRAINT `notification_receiver_receiver_user_id_fkey` FOREIGN KEY (`receiver_user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `file_folder` ADD CONSTRAINT `file_folder_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `file_folder`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `file` ADD CONSTRAINT `file_folder_id_fkey` FOREIGN KEY (`folder_id`) REFERENCES `file_folder`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `file` ADD CONSTRAINT `file_uploader_id_fkey` FOREIGN KEY (`uploader_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `file_grant` ADD CONSTRAINT `file_grant_file_id_fkey` FOREIGN KEY (`file_id`) REFERENCES `file`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `asset_borrow` ADD CONSTRAINT `asset_borrow_asset_id_fkey` FOREIGN KEY (`asset_id`) REFERENCES `asset`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `asset_borrow` ADD CONSTRAINT `asset_borrow_member_id_fkey` FOREIGN KEY (`member_id`) REFERENCES `member`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `asset_borrow` ADD CONSTRAINT `asset_borrow_approver_member_id_fkey` FOREIGN KEY (`approver_member_id`) REFERENCES `member`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `venue_booking` ADD CONSTRAINT `venue_booking_venue_id_fkey` FOREIGN KEY (`venue_id`) REFERENCES `venue`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `venue_booking` ADD CONSTRAINT `venue_booking_member_id_fkey` FOREIGN KEY (`member_id`) REFERENCES `member`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `venue_booking` ADD CONSTRAINT `venue_booking_approver_member_id_fkey` FOREIGN KEY (`approver_member_id`) REFERENCES `member`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `duty_plan` ADD CONSTRAINT `duty_plan_term_id_fkey` FOREIGN KEY (`term_id`) REFERENCES `term`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `duty_schedule` ADD CONSTRAINT `duty_schedule_plan_id_fkey` FOREIGN KEY (`plan_id`) REFERENCES `duty_plan`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `duty_schedule` ADD CONSTRAINT `duty_schedule_member_id_fkey` FOREIGN KEY (`member_id`) REFERENCES `member`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `duty_log` ADD CONSTRAINT `duty_log_schedule_id_fkey` FOREIGN KEY (`schedule_id`) REFERENCES `duty_schedule`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `duty_log` ADD CONSTRAINT `duty_log_member_id_fkey` FOREIGN KEY (`member_id`) REFERENCES `member`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `duty_swap` ADD CONSTRAINT `duty_swap_schedule_id_fkey` FOREIGN KEY (`schedule_id`) REFERENCES `duty_schedule`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `duty_swap` ADD CONSTRAINT `duty_swap_from_member_id_fkey` FOREIGN KEY (`from_member_id`) REFERENCES `member`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `duty_swap` ADD CONSTRAINT `duty_swap_to_member_id_fkey` FOREIGN KEY (`to_member_id`) REFERENCES `member`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `member_availability` ADD CONSTRAINT `member_availability_member_id_fkey` FOREIGN KEY (`member_id`) REFERENCES `member`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `member_availability` ADD CONSTRAINT `member_availability_term_id_fkey` FOREIGN KEY (`term_id`) REFERENCES `term`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fund_budget` ADD CONSTRAINT `fund_budget_term_id_fkey` FOREIGN KEY (`term_id`) REFERENCES `term`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fund_budget` ADD CONSTRAINT `fund_budget_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `fund_category`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fund_voucher` ADD CONSTRAINT `fund_voucher_transaction_id_fkey` FOREIGN KEY (`transaction_id`) REFERENCES `fund_transaction`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `member_fee_standard` ADD CONSTRAINT `member_fee_standard_term_id_fkey` FOREIGN KEY (`term_id`) REFERENCES `term`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `member_fee` ADD CONSTRAINT `member_fee_fee_standard_id_fkey` FOREIGN KEY (`fee_standard_id`) REFERENCES `member_fee_standard`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `member_fee` ADD CONSTRAINT `member_fee_member_id_fkey` FOREIGN KEY (`member_id`) REFERENCES `member`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `member_fee` ADD CONSTRAINT `member_fee_operator_member_id_fkey` FOREIGN KEY (`operator_member_id`) REFERENCES `member`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `point_record` ADD CONSTRAINT `point_record_member_id_fkey` FOREIGN KEY (`member_id`) REFERENCES `member`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `point_record` ADD CONSTRAINT `point_record_term_id_fkey` FOREIGN KEY (`term_id`) REFERENCES `term`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `point_record` ADD CONSTRAINT `point_record_rule_id_fkey` FOREIGN KEY (`rule_id`) REFERENCES `point_rule`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assessment` ADD CONSTRAINT `assessment_term_id_fkey` FOREIGN KEY (`term_id`) REFERENCES `term`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assessment` ADD CONSTRAINT `assessment_member_id_fkey` FOREIGN KEY (`member_id`) REFERENCES `member`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assessment` ADD CONSTRAINT `assessment_evaluator_member_id_fkey` FOREIGN KEY (`evaluator_member_id`) REFERENCES `member`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `volunteer_hour` ADD CONSTRAINT `volunteer_hour_member_id_fkey` FOREIGN KEY (`member_id`) REFERENCES `member`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `volunteer_hour` ADD CONSTRAINT `volunteer_hour_activity_id_fkey` FOREIGN KEY (`activity_id`) REFERENCES `activity`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recruit_campaign` ADD CONSTRAINT `recruit_campaign_term_id_fkey` FOREIGN KEY (`term_id`) REFERENCES `term`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recruit_application` ADD CONSTRAINT `recruit_application_campaign_id_fkey` FOREIGN KEY (`campaign_id`) REFERENCES `recruit_campaign`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recruit_application` ADD CONSTRAINT `recruit_application_converted_member_id_fkey` FOREIGN KEY (`converted_member_id`) REFERENCES `member`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `interview_slot` ADD CONSTRAINT `interview_slot_campaign_id_fkey` FOREIGN KEY (`campaign_id`) REFERENCES `recruit_campaign`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `interview_slot` ADD CONSTRAINT `interview_slot_dept_id_fkey` FOREIGN KEY (`dept_id`) REFERENCES `department`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `interview_slot` ADD CONSTRAINT `interview_slot_interviewer_member_id_fkey` FOREIGN KEY (`interviewer_member_id`) REFERENCES `member`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `interview_appointment` ADD CONSTRAINT `interview_appointment_application_id_fkey` FOREIGN KEY (`application_id`) REFERENCES `recruit_application`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `interview_appointment` ADD CONSTRAINT `interview_appointment_slot_id_fkey` FOREIGN KEY (`slot_id`) REFERENCES `interview_slot`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `interview_score` ADD CONSTRAINT `interview_score_application_id_fkey` FOREIGN KEY (`application_id`) REFERENCES `recruit_application`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `interview_score` ADD CONSTRAINT `interview_score_interviewer_member_id_fkey` FOREIGN KEY (`interviewer_member_id`) REFERENCES `member`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vote_option` ADD CONSTRAINT `vote_option_vote_id_fkey` FOREIGN KEY (`vote_id`) REFERENCES `vote`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vote_record` ADD CONSTRAINT `vote_record_vote_id_fkey` FOREIGN KEY (`vote_id`) REFERENCES `vote`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vote_record` ADD CONSTRAINT `vote_record_option_id_fkey` FOREIGN KEY (`option_id`) REFERENCES `vote_option`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vote_record` ADD CONSTRAINT `vote_record_member_id_fkey` FOREIGN KEY (`member_id`) REFERENCES `member`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `activity_photo` ADD CONSTRAINT `activity_photo_activity_id_fkey` FOREIGN KEY (`activity_id`) REFERENCES `activity`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `activity_task` ADD CONSTRAINT `activity_task_activity_id_fkey` FOREIGN KEY (`activity_id`) REFERENCES `activity`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `activity_task` ADD CONSTRAINT `activity_task_assignee_member_id_fkey` FOREIGN KEY (`assignee_member_id`) REFERENCES `member`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
