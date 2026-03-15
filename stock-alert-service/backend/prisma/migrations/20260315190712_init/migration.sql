-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "image" TEXT,
    "provider" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Stock" (
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "market" TEXT NOT NULL,
    "indexMembership" TEXT[],

    CONSTRAINT "Stock_pkey" PRIMARY KEY ("symbol")
);

-- CreateTable
CREATE TABLE "StockPrice" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "price" DECIMAL(15,4) NOT NULL,
    "volume" BIGINT,
    "recordedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockAnalytics" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "high6m" DECIMAL(15,4) NOT NULL,
    "high6mUpdatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockAnalytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertSetting" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "thresholds" INTEGER[],

    CONSTRAINT "AlertSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Favorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "dropPercent" DECIMAL(5,2) NOT NULL,
    "level" INTEGER NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "StockPrice_symbol_recordedAt_idx" ON "StockPrice"("symbol", "recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "StockAnalytics_symbol_key" ON "StockAnalytics"("symbol");

-- CreateIndex
CREATE UNIQUE INDEX "AlertSetting_userId_key" ON "AlertSetting"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Favorite_userId_symbol_key" ON "Favorite"("userId", "symbol");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_userId_endpoint_key" ON "PushSubscription"("userId", "endpoint");

-- CreateIndex
CREATE INDEX "AlertLog_userId_symbol_level_sentAt_idx" ON "AlertLog"("userId", "symbol", "level", "sentAt");

-- AddForeignKey
ALTER TABLE "StockPrice" ADD CONSTRAINT "StockPrice_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "Stock"("symbol") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAnalytics" ADD CONSTRAINT "StockAnalytics_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "Stock"("symbol") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertSetting" ADD CONSTRAINT "AlertSetting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "Stock"("symbol") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
