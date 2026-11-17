CREATE OR REPLACE FUNCTION purge_expired_audit_events() RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$ DECLARE removed bigint; BEGIN DELETE FROM public.audit_events WHERE at < now()-interval '13 months'; GET DIAGNOSTICS removed=ROW_COUNT; RETURN removed; END $$;
REVOKE ALL ON FUNCTION purge_expired_audit_events() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION purge_expired_audit_events() TO sportsgrow_app;
