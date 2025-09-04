-- CreateTable
CREATE TABLE "brand" (
    "brand_id" SERIAL NOT NULL,
    "brand_name" VARCHAR,
    "supplier_id" VARCHAR,
    "product_type" VARCHAR,
    "created_by" VARCHAR DEFAULT now(),
    "created_date" TIMESTAMP(6),
    "updated_by" VARCHAR,
    "updated_date" TIMESTAMP(6),
    "product_sub_type" JSON,
    "brand_code" VARCHAR(4),

    CONSTRAINT "brand_pkey" PRIMARY KEY ("brand_id")
);

-- CreateTable
CREATE TABLE "category_master_new" (
    "id" SERIAL NOT NULL,
    "main_type" VARCHAR,
    "category" VARCHAR,
    "spec" JSON,

    CONSTRAINT "category_master_new_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goods_receipt" (
    "goods_id" SERIAL NOT NULL,
    "product_id" VARCHAR,
    "margin" VARCHAR,
    "base_price" DECIMAL,
    "charges" JSON,
    "mrp" DECIMAL,
    "batch_num" VARCHAR,
    "selling_price" DECIMAL,
    "created_by" VARCHAR,
    "created_date" TIMESTAMP(6),
    "updated_by" VARCHAR,
    "updated_date" TIMESTAMP(6),
    "purchase_order" VARCHAR,
    "sales_order" VARCHAR,
    "lr_num" VARCHAR,

    CONSTRAINT "GOODS_RECEIPT_pkey" PRIMARY KEY ("goods_id")
);

-- CreateTable
CREATE TABLE "inventory" (
    "INVENTORY_id" SERIAL NOT NULL,
    "prod_id" INTEGER,
    "batch_id" VARCHAR,
    "total_quantity" INTEGER,
    "blocked_quantity" INTEGER,
    "created_by" VARCHAR,
    "created_date" TIMESTAMP(6),
    "updated_by" VARCHAR,
    "updated_date" TIMESTAMP(6),
    "po_num" VARCHAR,
    "mrp" INTEGER,
    "base_price" INTEGER,
    "selling_price" INTEGER,
    "charges" INTEGER,

    CONSTRAINT "INVENTORY_pkey" PRIMARY KEY ("INVENTORY_id")
);

-- CreateTable
CREATE TABLE "logistics_master" (
    "logistics_id" SERIAL NOT NULL,
    "logistics_name" VARCHAR,
    "logistics_address" VARCHAR,
    "created_by" VARCHAR,
    "created_date" TIMESTAMP(6),
    "updated_by" VARCHAR,
    "updated_date" TIMESTAMP(6),
    "active" VARCHAR(1),

    CONSTRAINT "logistics_master_pkey" PRIMARY KEY ("logistics_id")
);

-- CreateTable
CREATE TABLE "payment_details" (
    "payment_id" INTEGER,
    "purchase_id" INTEGER,
    "mode_of_payment" VARCHAR,
    "amount" DECIMAL,
    "created_by" VARCHAR,
    "created_date" TIMESTAMP(6),
    "updated_by" VARCHAR,
    "updated_date" TIMESTAMP(6)
);

-- CreateTable
CREATE TABLE "product_master" (
    "product_id" SERIAL NOT NULL,
    "product_code" VARCHAR,
    "product_name" VARCHAR,
    "product_desc" VARCHAR,
    "product_type" VARCHAR,
    "product_sub_type" VARCHAR,
    "hsn" VARCHAR,
    "supplier_id" INTEGER,
    "brand_id" INTEGER,
    "product_spec" JSON,
    "package" VARCHAR,
    "no_of_items" INTEGER,
    "manufacturer_code" VARCHAR,
    "gst_perc" DECIMAL,
    "created_by" VARCHAR,
    "created_date" TIMESTAMP(6),
    "is_active" CHAR(1),
    "unit_of_measure" VARCHAR,
    "parent_product_id" INTEGER,
    "updated_by" VARCHAR,
    "updated_date" TIMESTAMP(6),
    "image1_link" VARCHAR,
    "image2_link" VARCHAR,
    "image3_link" VARCHAR,
    "color" VARCHAR,
    "color_family" VARCHAR,
    "search_field" tsvector,
    "prod_subtype2" VARCHAR,

    CONSTRAINT "PRODUCT_MASTER_pkey" PRIMARY KEY ("product_id")
);

-- CreateTable
CREATE TABLE "product_temp" (
    "product_id" SERIAL NOT NULL,
    "product_code" VARCHAR,
    "product_name" VARCHAR,
    "product_desc" VARCHAR,
    "product_type" VARCHAR,
    "product_sub_type" VARCHAR,
    "manufacturer_code" VARCHAR,
    "created_by" VARCHAR,
    "created_date" TIMESTAMP(6),
    "updated_by" VARCHAR,
    "updated_date" TIMESTAMP(6),

    CONSTRAINT "PRODUCT_Temp_pkey" PRIMARY KEY ("product_id")
);

-- CreateTable
CREATE TABLE "purchase_order" (
    "purchase_id" SERIAL NOT NULL,
    "po_number" VARCHAR,
    "total_amount" DECIMAL,
    "quote_document_link1" VARCHAR,
    "po_status" VARCHAR,
    "remarks" VARCHAR,
    "delivery_date" TIMESTAMP(6),
    "created_by" VARCHAR,
    "created_date" TIMESTAMP(6),
    "updated_by" VARCHAR,
    "updated_date" TIMESTAMP(6),
    "supplier_id" VARCHAR,
    "logistics_id" INTEGER,
    "po_notes" JSON,
    "products" JSON[],
    "lr_number" VARCHAR,

    CONSTRAINT "purchase_order_pkey" PRIMARY KEY ("purchase_id")
);

-- CreateTable
CREATE TABLE "sales_order" (
    "sales_id" SERIAL NOT NULL,
    "order_number" VARCHAR,
    "quote_id" INTEGER,
    "status" VARCHAR,
    "product_id" JSON,
    "remarks" VARCHAR,
    "delivery_date" TIMESTAMP(6),
    "created_by" VARCHAR,
    "created_date" TIMESTAMP(6),
    "updated_by" VARCHAR,
    "updated_date" TIMESTAMP(6),

    CONSTRAINT "sales_order_pkey" PRIMARY KEY ("sales_id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" INTEGER NOT NULL,
    "user_id" VARCHAR,
    "user_name" VARCHAR,
    "password" VARCHAR,
    "email" VARCHAR,
    "yearsinbusiness" INTEGER,
    "mobile" BIGINT,
    "landline" BIGINT,
    "website" VARCHAR,
    "address" JSON,
    "created_date" TIMESTAMP(6),
    "last_accessed_date" TIMESTAMP(6),
    "updated_date" TIMESTAMP(6),
    "product_type" JSON,
    "is_approved" CHAR(1),
    "is_active" CHAR(1),
    "approved_by" INTEGER,
    "user_type" VARCHAR,
    "gst_num" VARCHAR,
    "is_user_flagged" CHAR(1),
    "flagged_remarks" VARCHAR,
    "trade_name" VARCHAR,
    "search_user" tsvector,
    "sup_code" VARCHAR,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_code_unique" ON "product_master"("product_code");

-- CreateIndex
CREATE UNIQUE INDEX "po_num_unique" ON "purchase_order"("po_number");

-- CreateIndex
CREATE UNIQUE INDEX "sales_order_unique" ON "sales_order"("order_number");

-- CreateIndex
CREATE UNIQUE INDEX "unique user id" ON "users"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "unique name for each user" ON "users"("user_name");

-- AddForeignKey
ALTER TABLE "goods_receipt" ADD CONSTRAINT "goods_receipt_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product_master"("product_code") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "goods_receipt" ADD CONSTRAINT "goods_receipt_purchase_order_fkey" FOREIGN KEY ("purchase_order") REFERENCES "purchase_order"("po_number") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "goods_receipt" ADD CONSTRAINT "goods_receipt_sales_order_fkey" FOREIGN KEY ("sales_order") REFERENCES "sales_order"("order_number") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "product_master" ADD CONSTRAINT "PRODUCT_MASTER_parent_product_id_fkey" FOREIGN KEY ("parent_product_id") REFERENCES "product_master"("product_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "product_master" ADD CONSTRAINT "product_master_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brand"("brand_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "product_master" ADD CONSTRAINT "product_master_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "purchase_order" ADD CONSTRAINT "purchase_order_logistics_id_fkey" FOREIGN KEY ("logistics_id") REFERENCES "logistics_master"("logistics_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "purchase_order" ADD CONSTRAINT "purchase_order_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "users"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

