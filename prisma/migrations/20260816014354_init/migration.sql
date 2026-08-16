-- CreateTable
CREATE TABLE "Card" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "brand" TEXT NOT NULL,
    "set" TEXT NOT NULL,
    "subset" TEXT NOT NULL DEFAULT '',
    "player" TEXT NOT NULL,
    "cardNumber" TEXT NOT NULL,
    "parallel" TEXT NOT NULL DEFAULT '',
    "serialNumbering" TEXT NOT NULL DEFAULT '',
    "isAuto" BOOLEAN NOT NULL DEFAULT false,
    "isRelic" BOOLEAN NOT NULL DEFAULT false,
    "sport" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Card_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CopyOwned" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    "certNumber" TEXT,
    "purchasePrice" DOUBLE PRECISION,
    "purchaseDate" TIMESTAMP(3),
    "frontImagePath" TEXT,
    "backImagePath" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CopyOwned_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sale" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "saleDate" TIMESTAMP(3) NOT NULL,
    "marketplace" TEXT NOT NULL,
    "listingTitle" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "retrievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceType" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Valuation" (
    "id" TEXT NOT NULL,
    "copyOwnedId" TEXT NOT NULL,
    "value" DOUBLE PRECISION,
    "low" DOUBLE PRECISION,
    "high" DOUBLE PRECISION,
    "sampleSize" INTEGER NOT NULL,
    "sufficient" BOOLEAN NOT NULL,
    "method" TEXT NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Valuation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValuationSaleUsed" (
    "valuationId" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,

    CONSTRAINT "ValuationSaleUsed_pkey" PRIMARY KEY ("valuationId","saleId")
);

-- CreateIndex
CREATE INDEX "Card_player_idx" ON "Card"("player");

-- CreateIndex
CREATE INDEX "Card_year_brand_set_idx" ON "Card"("year", "brand", "set");

-- CreateIndex
CREATE UNIQUE INDEX "Card_year_brand_set_subset_player_cardNumber_parallel_seria_key" ON "Card"("year", "brand", "set", "subset", "player", "cardNumber", "parallel", "serialNumbering", "isAuto", "isRelic", "sport");

-- CreateIndex
CREATE INDEX "CopyOwned_cardId_idx" ON "CopyOwned"("cardId");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_sourceUrl_key" ON "Sale"("sourceUrl");

-- CreateIndex
CREATE INDEX "Sale_cardId_grade_idx" ON "Sale"("cardId", "grade");

-- CreateIndex
CREATE INDEX "Sale_saleDate_idx" ON "Sale"("saleDate");

-- CreateIndex
CREATE INDEX "Valuation_copyOwnedId_computedAt_idx" ON "Valuation"("copyOwnedId", "computedAt");

-- CreateIndex
CREATE INDEX "ValuationSaleUsed_saleId_idx" ON "ValuationSaleUsed"("saleId");

-- AddForeignKey
ALTER TABLE "CopyOwned" ADD CONSTRAINT "CopyOwned_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Valuation" ADD CONSTRAINT "Valuation_copyOwnedId_fkey" FOREIGN KEY ("copyOwnedId") REFERENCES "CopyOwned"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValuationSaleUsed" ADD CONSTRAINT "ValuationSaleUsed_valuationId_fkey" FOREIGN KEY ("valuationId") REFERENCES "Valuation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValuationSaleUsed" ADD CONSTRAINT "ValuationSaleUsed_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
