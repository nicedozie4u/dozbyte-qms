-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "user_id" UUID,
    "action" TEXT NOT NULL,
    "target" TEXT,
    "details" JSONB NOT NULL DEFAULT '{}',
    "ip" TEXT,
    "at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_log_tenant_id_at_idx" ON "audit_log"("tenant_id", "at");

-- CreateIndex
CREATE INDEX "audit_log_action_at_idx" ON "audit_log"("action", "at");

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
