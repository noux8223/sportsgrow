DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tax_invoices_status_check'
      AND conrelid = 'tax_invoices'::regclass
  ) THEN
    ALTER TABLE tax_invoices
      ADD CONSTRAINT tax_invoices_status_check
      CHECK (status IN ('draft', 'issued_manual', 'void'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payments_amount_positive_check'
      AND conrelid = 'payments'::regclass
  ) THEN
    ALTER TABLE payments
      ADD CONSTRAINT payments_amount_positive_check
      CHECK (amount_krw > 0);
  END IF;
END
$migration$;
