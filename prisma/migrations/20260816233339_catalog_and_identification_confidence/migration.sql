-- AlterTable
ALTER TABLE "CopyOwned" ADD COLUMN     "identificationConfidence" TEXT,
ADD COLUMN     "identificationMethod" TEXT;

-- CreateTable
CREATE TABLE "CatalogCard" (
    "id" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "set" TEXT NOT NULL,
    "subset" TEXT NOT NULL DEFAULT '',
    "cardNumber" TEXT NOT NULL,
    "cardNumberPrefix" TEXT NOT NULL DEFAULT '',
    "player" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "isAuto" BOOLEAN NOT NULL DEFAULT false,
    "isRelic" BOOLEAN NOT NULL DEFAULT false,
    "copyrightYear" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogParallel" (
    "id" TEXT NOT NULL,
    "catalogCardId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "printRun" INTEGER,
    "oneOfOne" BOOLEAN NOT NULL DEFAULT false,
    "rarityOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CatalogParallel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CatalogCard_cardNumber_player_idx" ON "CatalogCard"("cardNumber", "player");

-- CreateIndex
CREATE INDEX "CatalogCard_cardNumberPrefix_player_idx" ON "CatalogCard"("cardNumberPrefix", "player");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogCard_brand_year_set_subset_cardNumber_key" ON "CatalogCard"("brand", "year", "set", "subset", "cardNumber");

-- CreateIndex
CREATE INDEX "CatalogParallel_catalogCardId_printRun_idx" ON "CatalogParallel"("catalogCardId", "printRun");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogParallel_catalogCardId_name_key" ON "CatalogParallel"("catalogCardId", "name");

-- AddForeignKey
ALTER TABLE "CatalogParallel" ADD CONSTRAINT "CatalogParallel_catalogCardId_fkey" FOREIGN KEY ("catalogCardId") REFERENCES "CatalogCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
