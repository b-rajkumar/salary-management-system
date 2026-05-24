DROP INDEX idx_employees_country_jobTitle;

CREATE INDEX idx_employees_country_jobTitle_nocase
  ON employees (country, jobTitle COLLATE NOCASE);
