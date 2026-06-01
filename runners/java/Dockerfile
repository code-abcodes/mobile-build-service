FROM eclipse-temurin:21-jdk-jammy

ENV ANDROID_HOME=/opt/android-sdk
ENV PATH=${PATH}:${ANDROID_HOME}/cmdline-tools/latest/bin:${ANDROID_HOME}/platform-tools
ENV GRADLE_USER_HOME=/root/.gradle

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

# Install Gradle
RUN wget -q https://services.gradle.org/distributions/gradle-8.6-bin.zip \
      -O /tmp/gradle.zip && \
    mkdir -p /opt/gradle && \
    unzip -q /tmp/gradle.zip -d /opt/gradle && \
    rm /tmp/gradle.zip && \
    ln -s /opt/gradle/gradle-8.6/bin/gradle /usr/local/bin/gradle

# Create minimal Android project to pre-cache dependencies
RUN mkdir -p /cache-project/app/src/main/java/com/cache && \
    mkdir -p /cache-project/app/src/main/res

RUN printf 'pluginManagement {\n    repositories {\n        google()\n        mavenCentral()\n        gradlePluginPortal()\n    }\n}\ndependencyResolutionManagement {\n    repositoriesMode.set(RepositoriesMode.PREFER_SETTINGS)\n    repositories {\n        google()\n        mavenCentral()\n    }\n}\nrootProject.name = "cache"\ninclude ":app"\n' \
    > /cache-project/settings.gradle

RUN printf 'plugins {\n    id "com.android.application" version "8.2.2" apply false\n}\n' \
    > /cache-project/build.gradle

RUN printf 'plugins {\n    id "com.android.application"\n}\nandroid {\n    namespace "com.cache"\n    compileSdk 34\n    defaultConfig { minSdk 21; targetSdk 34; applicationId "com.cache" }\n}\ndependencies {\n    implementation "androidx.appcompat:appcompat:1.6.1"\n    implementation "com.google.android.material:material:1.11.0"\n    implementation "androidx.constraintlayout:constraintlayout:2.1.4"\n    implementation "androidx.recyclerview:recyclerview:1.3.2"\n    implementation "androidx.cardview:cardview:1.0.0"\n    implementation "androidx.navigation:navigation-fragment:2.7.7"\n    implementation "androidx.navigation:navigation-ui:2.7.7"\n    implementation "androidx.room:room-runtime:2.6.1"\n    implementation "androidx.lifecycle:lifecycle-viewmodel:2.7.0"\n    implementation "androidx.lifecycle:lifecycle-livedata:2.7.0"\n    implementation "androidx.work:work-runtime:2.9.0"\n    annotationProcessor "androidx.room:room-compiler:2.6.1"\n}\n' \
    > /cache-project/app/build.gradle

RUN printf '<?xml version="1.0" encoding="utf-8"?>\n<manifest xmlns:android="http://schemas.android.com/apk/res/android">\n    <application></application>\n</manifest>\n' \
    > /cache-project/app/src/main/AndroidManifest.xml

RUN cd /cache-project && \
    gradle :app:assembleDebug --no-daemon 2>&1 || true

RUN chmod -R a+rX /root/.gradle 2>/dev/null || true

# Download Checkstyle
RUN wget -q https://github.com/checkstyle/checkstyle/releases/download/checkstyle-10.17.0/checkstyle-10.17.0-all.jar \
    -O /opt/checkstyle.jar

RUN printf '#!/bin/sh\nfind /repo -name "*.java" | xargs java -jar /opt/checkstyle.jar -c /google_checks.xml -f xml 2>/dev/null || true\n' \
    > /usr/local/bin/run-checkstyle && \
    chmod +x /usr/local/bin/run-checkstyle

WORKDIR /repo