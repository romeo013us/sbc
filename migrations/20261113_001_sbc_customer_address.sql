-- SBC Account 360 prerequisite. Run only on the authorized MySQL writer after a verified backup.
-- Non-destructive and idempotent for existing tenant-scoped CRM databases.
-- MySQL 8 compatible (ADD COLUMN IF NOT EXISTS is not portable to MySQL).
SET @sbc_customer_address_exists := (
 SELECT COUNT(*) FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE()
 AND TABLE_NAME = 'sbc_customers'
 AND COLUMN_NAME = 'address'
);
SET @sbc_customer_address_sql := IF(
 @sbc_customer_address_exists = 0,
 'ALTER TABLE sbc_customers ADD COLUMN address VARCHAR(500) NOT NULL DEFAULT ''''',
 'SELECT ''sbc_customers.address already exists'' AS schema_state'
);
PREPARE sbc_address_ddl FROM @sbc_customer_address_sql;
EXECUTE sbc_address_ddl;
DEALLOCATE PREPARE sbc_address_ddl;
