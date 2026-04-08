FROM ubuntu:24.04

# 1. Install base dependencies and native Postgres 16
RUN apt-get update && apt-get install -y \
    gnupg \
    curl \
    openssl \
    ca-certificates \
    postgresql-16 \
    postgresql-contrib

# 2. Install Dotenvx
RUN curl -sfS https://dotenvx.sh | sh

# 3. Setup directories and copy files
COPY ./.env /

# Postgres auto-runs any .sql or .sh files placed here on first boot!
COPY ./docker/postgres/init.sh /docker-entrypoint-initdb.d/

# Ensure the init script is executable
RUN chmod +x /docker-entrypoint-initdb.d/init.sh

# 4. Persist data (Postgres default data directory in Ubuntu)
VOLUME /var/lib/postgresql/16/main

RUN sed -i "s/#listen_addresses =.*/listen_addresses = '*'/" /etc/postgresql/16/main/postgresql.conf \
 && echo "host all all 0.0.0.0/0 md5" >> /etc/postgresql/16/main/pg_hba.conf

# 5. Expose default Postgres port
EXPOSE 5432

# 6. Set user to postgres (Required as Postgres refuses to run as root)
USER postgres

# 7. Start Postgres directing it to the correct config and data paths
CMD ["/usr/lib/postgresql/16/bin/postgres", "-D", "/var/lib/postgresql/16/main", "-c", "config_file=/etc/postgresql/16/main/postgresql.conf"]