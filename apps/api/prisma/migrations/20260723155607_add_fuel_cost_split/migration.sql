/*
  Warnings:

  - Added the required column `totalFuelCost` to the `Ride` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Ride" ADD COLUMN     "totalFuelCost" DECIMAL(10,2) NOT NULL;
