FROM liquibase/liquibase:5.0.4

RUN lpm add liquibase-mongodb mongodb --global
