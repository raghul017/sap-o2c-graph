DDL_STATEMENTS = [
    """
    CREATE TABLE IF NOT EXISTS business_partners (
      businessPartner TEXT PRIMARY KEY,
      customer TEXT,
      businessPartnerCategory TEXT,
      businessPartnerFullName TEXT,
      businessPartnerName TEXT,
      industry TEXT,
      businessPartnerIsBlocked INTEGER,
      isMarkedForArchiving INTEGER,
      creationDate TEXT,
      creationTime TEXT
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS business_partner_addresses (
      businessPartner TEXT,
      addressId TEXT,
      cityName TEXT,
      country TEXT,
      postalCode TEXT,
      region TEXT,
      streetName TEXT,
      PRIMARY KEY (businessPartner, addressId)
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS customer_company_assignments (
      customer TEXT,
      companyCode TEXT,
      paymentTerms TEXT,
      reconciliationAccount TEXT,
      deletionIndicator INTEGER,
      PRIMARY KEY (customer, companyCode)
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS customer_sales_area_assignments (
      customer TEXT,
      salesOrganization TEXT,
      distributionChannel TEXT,
      division TEXT,
      currency TEXT,
      customerPaymentTerms TEXT,
      deliveryPriority TEXT,
      supplyingPlant TEXT,
      PRIMARY KEY (customer, salesOrganization, distributionChannel, division)
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS sales_order_headers (
      salesOrder TEXT PRIMARY KEY,
      salesOrderType TEXT,
      salesOrganization TEXT,
      distributionChannel TEXT,
      organizationDivision TEXT,
      soldToParty TEXT,
      totalNetAmount REAL,
      transactionCurrency TEXT,
      overallDeliveryStatus TEXT,
      overallOrdReltdBillgStatus TEXT,
      creationDate TEXT,
      requestedDeliveryDate TEXT,
      headerBillingBlockReason TEXT,
      deliveryBlockReason TEXT,
      customerPaymentTerms TEXT
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS sales_order_items (
      salesOrder TEXT,
      salesOrderItem INTEGER,
      salesOrderItemCategory TEXT,
      material TEXT,
      requestedQuantity REAL,
      requestedQuantityUnit TEXT,
      netAmount REAL,
      transactionCurrency TEXT,
      materialGroup TEXT,
      productionPlant TEXT,
      storageLocation TEXT,
      itemBillingBlockReason TEXT,
      salesDocumentRjcnReason TEXT,
      PRIMARY KEY (salesOrder, salesOrderItem)
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS sales_order_schedule_lines (
      salesOrder TEXT,
      salesOrderItem INTEGER,
      scheduleLine TEXT,
      confirmedDeliveryDate TEXT,
      orderQuantityUnit TEXT,
      confdOrderQtyByMatlAvailCheck REAL,
      PRIMARY KEY (salesOrder, salesOrderItem, scheduleLine)
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS outbound_delivery_headers (
      deliveryDocument TEXT PRIMARY KEY,
      shippingPoint TEXT,
      overallGoodsMovementStatus TEXT,
      overallPickingStatus TEXT,
      overallProofOfDeliveryStatus TEXT,
      headerBillingBlockReason TEXT,
      deliveryBlockReason TEXT,
      hdrGeneralIncompletionStatus TEXT,
      creationDate TEXT,
      creationTime TEXT,
      actualGoodsMovementDate TEXT,
      actualGoodsMovementTime TEXT,
      lastChangeDate TEXT
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS outbound_delivery_items (
      deliveryDocument TEXT,
      deliveryDocumentItem TEXT,
      referenceSdDocument TEXT,
      referenceSdDocumentItem INTEGER,
      material TEXT,
      actualDeliveryQuantity REAL,
      deliveryQuantityUnit TEXT,
      plant TEXT,
      storageLocation TEXT,
      itemBillingBlockReason TEXT,
      batch TEXT,
      PRIMARY KEY (deliveryDocument, deliveryDocumentItem)
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS billing_document_headers (
      billingDocument TEXT PRIMARY KEY,
      billingDocumentType TEXT,
      soldToParty TEXT,
      accountingDocument TEXT,
      totalNetAmount REAL,
      transactionCurrency TEXT,
      billingDocumentIsCancelled INTEGER,
      cancelledBillingDocument TEXT,
      companyCode TEXT,
      fiscalYear TEXT,
      creationDate TEXT,
      creationTime TEXT,
      billingDocumentDate TEXT
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS billing_document_items (
      billingDocument TEXT,
      billingDocumentItem TEXT,
      material TEXT,
      billingQuantity REAL,
      billingQuantityUnit TEXT,
      netAmount REAL,
      transactionCurrency TEXT,
      referenceSdDocument TEXT,
      referenceSdDocumentItem INTEGER,
      PRIMARY KEY (billingDocument, billingDocumentItem)
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS billing_document_cancellations (
      billingDocument TEXT PRIMARY KEY,
      billingDocumentType TEXT,
      soldToParty TEXT,
      accountingDocument TEXT,
      totalNetAmount REAL,
      transactionCurrency TEXT,
      billingDocumentIsCancelled INTEGER,
      cancelledBillingDocument TEXT,
      companyCode TEXT,
      fiscalYear TEXT,
      creationDate TEXT,
      creationTime TEXT
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS journal_entry_ar (
      companyCode TEXT,
      fiscalYear TEXT,
      accountingDocument TEXT,
      accountingDocumentItem TEXT,
      glAccount TEXT,
      referenceDocument TEXT,
      customer TEXT,
      amountInTransactionCurrency REAL,
      transactionCurrency TEXT,
      amountInCompanyCodeCurrency REAL,
      companyCodeCurrency TEXT,
      postingDate TEXT,
      documentDate TEXT,
      accountingDocumentType TEXT,
      clearingDate TEXT,
      clearingAccountingDocument TEXT,
      financialAccountType TEXT,
      PRIMARY KEY (companyCode, fiscalYear, accountingDocument, accountingDocumentItem)
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS payments_ar (
      companyCode TEXT,
      fiscalYear TEXT,
      accountingDocument TEXT,
      accountingDocumentItem TEXT,
      customer TEXT,
      clearingDate TEXT,
      clearingAccountingDocument TEXT,
      amountInTransactionCurrency REAL,
      transactionCurrency TEXT,
      amountInCompanyCodeCurrency REAL,
      companyCodeCurrency TEXT,
      postingDate TEXT,
      documentDate TEXT,
      glAccount TEXT,
      financialAccountType TEXT,
      PRIMARY KEY (companyCode, fiscalYear, accountingDocument, accountingDocumentItem)
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS products (
      product TEXT PRIMARY KEY,
      productType TEXT,
      baseUnit TEXT,
      grossWeight REAL,
      netWeight REAL,
      weightUnit TEXT,
      productGroup TEXT,
      division TEXT,
      industrySector TEXT,
      isMarkedForDeletion INTEGER,
      creationDate TEXT
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS product_descriptions (
      product TEXT,
      language TEXT,
      productDescription TEXT,
      PRIMARY KEY (product, language)
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS plants (
      plant TEXT PRIMARY KEY,
      plantName TEXT,
      salesOrganization TEXT,
      distributionChannel TEXT,
      division TEXT,
      language TEXT,
      isMarkedForArchiving INTEGER
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS product_plants (
      product TEXT,
      plant TEXT,
      countryOfOrigin TEXT,
      profitCenter TEXT,
      mrpType TEXT,
      availabilityCheckType TEXT,
      PRIMARY KEY (product, plant)
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS product_storage_locations (
      product TEXT,
      plant TEXT,
      storageLocation TEXT,
      physicalInventoryBlockInd TEXT,
      PRIMARY KEY (product, plant, storageLocation)
    );
    """,
]


INDEX_STATEMENTS = [
    "CREATE INDEX IF NOT EXISTS idx_soi_salesorder ON sales_order_items(salesOrder);",
    "CREATE INDEX IF NOT EXISTS idx_odi_refsddoc ON outbound_delivery_items(referenceSdDocument);",
    "CREATE INDEX IF NOT EXISTS idx_bdi_refsddoc ON billing_document_items(referenceSdDocument);",
    "CREATE INDEX IF NOT EXISTS idx_bdh_accountingdoc ON billing_document_headers(accountingDocument);",
    "CREATE INDEX IF NOT EXISTS idx_je_refdoc ON journal_entry_ar(referenceDocument);",
    "CREATE INDEX IF NOT EXISTS idx_pay_accountingdoc ON payments_ar(accountingDocument);",
    "CREATE INDEX IF NOT EXISTS idx_pp_product ON product_plants(product);",
    "CREATE INDEX IF NOT EXISTS idx_psl_product ON product_storage_locations(product);",
]
