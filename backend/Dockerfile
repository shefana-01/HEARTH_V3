# syntax=docker/dockerfile:1.7
#
# One Dockerfile for every Java part of Hearth. docker-compose.yml builds it once per service, passing
# MODULE (the Maven module) and PORT. Stage 1 compiles with Maven; stage 2 is a small Java runtime that
# runs the service as an unprivileged user.
#
#   docker build --build-arg MODULE=services/task-service --build-arg PORT=8082 -t hearth/task-service backend

FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /src
# Poms first: while they do not change, the downloaded dependencies stay in Docker's cache.
COPY pom.xml .
COPY hearth-common/pom.xml hearth-common/
COPY api-gateway/pom.xml api-gateway/
COPY services/family-service/pom.xml services/family-service/
COPY services/task-service/pom.xml services/task-service/
COPY services/decision-service/pom.xml services/decision-service/
COPY services/care-service/pom.xml services/care-service/
COPY services/notification-service/pom.xml services/notification-service/
COPY services/audit-service/pom.xml services/audit-service/
COPY . .
ARG MODULE
# Optional, for builds behind a company proxy: pass a Maven settings file and a Java truststore as build
# secrets (docker build --secret id=maven_settings,src=... --secret id=truststore,src=...). Normal builds need neither.
RUN --mount=type=cache,target=/root/.m2/repository \
    --mount=type=secret,id=maven_settings,target=/root/.m2/settings.xml,required=false \
    --mount=type=secret,id=truststore,target=/run/truststore.jks,required=false \
    if [ -f /run/truststore.jks ]; then export MAVEN_OPTS="-Djavax.net.ssl.trustStore=/run/truststore.jks"; fi; \
    mvn -B -q -pl "${MODULE}" -am package -DskipTests \
 && cp "${MODULE}"/target/*-SNAPSHOT.jar /app.jar

FROM eclipse-temurin:21-jre-alpine
RUN addgroup -S hearth && adduser -S -G hearth hearth \
 && mkdir -p /data && chown hearth:hearth /data
WORKDIR /app
COPY --from=build /app.jar app.jar
USER hearth
ARG PORT=8080
ENV PORT=${PORT} \
    # Small heaps: seven services share one machine. Raise these for real traffic.
    JAVA_OPTS="-XX:MaxRAMPercentage=75 -XX:+UseSerialGC -Xss512k"
EXPOSE ${PORT}
HEALTHCHECK --interval=10s --timeout=3s --start-period=300s --retries=6 \
    CMD wget -qO- "http://127.0.0.1:${PORT}/actuator/health" | grep -q '"UP"' || exit 1
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar app.jar"]
