-- CreateTable
CREATE TABLE "device_push_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "device_push_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "device_push_tokens_user_id_token_key" ON "device_push_tokens"("user_id", "token");

-- CreateIndex
CREATE INDEX "device_push_tokens_user_id_idx" ON "device_push_tokens"("user_id");

-- AddForeignKey
ALTER TABLE "device_push_tokens" ADD CONSTRAINT "device_push_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
