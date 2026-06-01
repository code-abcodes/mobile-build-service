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

# Pre-cache common Android dependencies
RUN mkdir -p /cache-project/app && \
    cat > /cache-project/settings.gradle << 'EOF'
pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.PREFER_SETTINGS)
    repositories {
        google()
        mavenCentral()
    }
}
rootProject.name = "cache"
include ':app'
EOF
RUN cat > /cache-project/build.gradle << 'EOF'
plugins {
    id 'com.android.application' version '8.2.2' apply false
}
EOF
RUN cat > /cache-project/app/build.gradle << 'EOF'
plugins {
    id 'com.android.application'
}
android {
    namespace 'com.cache'
    compileSdk 34
    defaultConfig { minSdk 21; targetSdk 34 }
}
dependencies {
    implementation 'androidx.appcompat:appcompat:1.6.1'
    implementation 'com.google.android.material:material:1.11.0'
    implementation 'androidx.constraintlayout:constraintlayout:2.1.4'
    implementation 'androidx.recyclerview:recyclerview:1.3.2'
    implementation 'androidx.cardview:cardview:1.0.0'
    implementation 'androidx.navigation:navigation-fragment:2.7.7'
    implementation 'androidx.navigation:navigation-ui:2.7.7'
    implementation 'androidx.room:room-runtime:2.6.1'
    implementation 'androidx.lifecycle:lifecycle-viewmodel:2.7.0'
    implementation 'androidx.lifecycle:lifecycle-livedata:2.7.0'
    implementation 'androidx.work:work-runtime:2.9.0'
    annotationProcessor 'androidx.room:room-compiler:2.6.1'
}
EOF
RUN cd /cache-project && \
    wget -q https://services.gradle.org/distributions/gradle-8.6-bin.zip \
      -O /tmp/gradle.zip && \
    mkdir -p /opt/gradle && \
    unzip -q /tmp/gradle.zip -d /opt/gradle && \
    rm /tmp/gradle.zip && \
    ln -s /opt/gradle/gradle-8.6/bin/gradle /usr/local/bin/gradle && \
    gradle dependencies --no-daemon 2>/dev/null || true

# Download Checkstyle
RUN wget -q https://github.com/checkstyle/checkstyle/releases/download/checkstyle-10.17.0/checkstyle-10.17.0-all.jar \
    -O /opt/checkstyle.jar

# Install Checkstyle script
RUN printf '#!/bin/sh\nfind /repo -name "*.java" | xargs java -jar /opt/checkstyle.jar -c /google_checks.xml -f xml 2>/dev/null || true\n' \
    > /usr/local/bin/run-checkstyle && \
    chmod +x /usr/local/bin/run-checkstyle

WORKDIR /repo