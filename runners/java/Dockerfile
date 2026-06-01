FROM eclipse-temurin:21-jdk-jammy

# Install Maven, git, curl
RUN apt-get update && apt-get install -y maven git curl wget && \
    rm -rf /var/lib/apt/lists/*

# Download Checkstyle
RUN wget -q https://github.com/checkstyle/checkstyle/releases/download/checkstyle-10.17.0/checkstyle-10.17.0-all.jar \
    -O /opt/checkstyle.jar

# Install Checkstyle script
RUN printf '#!/bin/sh\nfind /repo -name "*.java" | xargs java -jar /opt/checkstyle.jar -c /google_checks.xml -f xml 2>/dev/null || true\n' \
    > /usr/local/bin/run-checkstyle && \
    chmod +x /usr/local/bin/run-checkstyle

WORKDIR /repo