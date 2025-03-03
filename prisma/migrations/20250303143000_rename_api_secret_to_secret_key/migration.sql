-- Renombrar la columna apiSecret a secretKey
ALTER TABLE "SubAccount" RENAME COLUMN "apiSecret" TO "secretKey";

-- Actualizar las restricciones y los índices si existen
-- Si hay algún índice o restricción que use la columna antigua, se actualizará automáticamente 