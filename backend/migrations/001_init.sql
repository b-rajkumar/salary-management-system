CREATE TABLE employees (
  id          INTEGER PRIMARY KEY,
  firstName   TEXT    NOT NULL,
  lastName    TEXT    NOT NULL,
  email       TEXT    NOT NULL UNIQUE,
  jobTitle    TEXT    NOT NULL,
  department  TEXT    NOT NULL,
  country     TEXT    NOT NULL,
  salary      INTEGER NOT NULL,
  hireDate    TEXT    NOT NULL,
  createdAt   TEXT    NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  updatedAt   TEXT    NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX idx_employees_country          ON employees (country);
CREATE INDEX idx_employees_country_jobTitle ON employees (country, jobTitle);
