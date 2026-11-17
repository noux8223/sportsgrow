CREATE ROLE sportsgrow_app LOGIN PASSWORD 'local_app_password';
CREATE ROLE sportsgrow_report LOGIN PASSWORD 'local_report_password';
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
GRANT CONNECT ON DATABASE sportsgrow TO sportsgrow_app, sportsgrow_report;
