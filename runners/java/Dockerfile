FROM eclipse-temurin:21-jdk-jammy

ENV ANDROID_HOME=/opt/android-sdk
ENV PATH=${PATH}:${ANDROID_HOME}/cmdline-tools/latest/bin:${ANDROID_HOME}/platform-tools

# Install dependencies
RUN apt-get update && apt-get install -y maven git curl wget unzip && \
    rm -rf /var/lib/apt/lists/*

# Install Android command-line tools
RUN mkdir -p ${ANDROID_HOME}/cmdline-tools && \
    wget -q https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip \
      -O /tmp/cmdline-tools.zip && \
    unzip -q /tmp/cmdline-tools.zip -d /tmp/cmdline-tools && \
    mv /tmp/cmdline-tools/cmdline-tools ${ANDROID_HOME}/cmdline-tools/latest && \
    rm /tmp/cmdline-tools.zip

# Accept licenses and install Android SDK components
RUN yes | sdkmanager --licenses && \
    sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0"

# Download Checkstyle
RUN wget -q https://github.com/checkstyle/checkstyle/releases/download/checkstyle-10.17.0/checkstyle-10.17.0-all.jar \
    -O /opt/checkstyle.jar

# Install Checkstyle script
RUN printf '#!/bin/sh\nfind /repo -name "*.java" | xargs java -jar /opt/checkstyle.jar -c /google_checks.xml -f xml 2>/dev/null || true\n' \
    > /usr/local/bin/run-checkstyle && \
    chmod +x /usr/local/bin/run-checkstyle

WORKDIR /repo